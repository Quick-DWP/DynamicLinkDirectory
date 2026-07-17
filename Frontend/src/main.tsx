import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { initAppConfig } from './config'
import { handleAzureRedirect } from './azure'
import { azureLogin } from './auth'

await initAppConfig()

// If we're returning from a Microsoft sign-in redirect, exchange the ID token
// for an app session before React mounts.
async function handleMicrosoftReturn() {
  try {
    const idToken = await handleAzureRedirect()
    if (idToken) {
      await azureLogin(idToken)
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  } catch (err) {
    sessionStorage.setItem('msLoginError', err instanceof Error ? err.message : String(err))
    // Clear the leftover ?code/#code so a failed attempt doesn't get reprocessed.
    window.history.replaceState({}, document.title, window.location.pathname)
  }
}

// Never let the Microsoft exchange block the UI indefinitely — always render.
await Promise.race([
  handleMicrosoftReturn(),
  new Promise((resolve) => setTimeout(resolve, 8000)),
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
