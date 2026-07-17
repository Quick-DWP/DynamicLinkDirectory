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
try {
  const idToken = await handleAzureRedirect()
  if (idToken) {
    await azureLogin(idToken)
    window.history.replaceState({}, document.title, window.location.pathname)
  }
} catch (err) {
  sessionStorage.setItem('msLoginError', err instanceof Error ? err.message : String(err))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
