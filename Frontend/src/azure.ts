import { PublicClientApplication } from '@azure/msal-browser';
import { apiUrl } from './config';

export type AzureConfig = { enabled: boolean; tenant_id?: string; client_id?: string };

let cachedConfig: AzureConfig | null = null;

// Public Azure config from the backend (single source of truth).
export async function fetchAzureConfig(): Promise<AzureConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await fetch(apiUrl('/api/auth/azure-config'));
    const json = await res.json();
    cachedConfig = json?.ok && json.data ? json.data : { enabled: false };
  } catch {
    cachedConfig = { enabled: false };
  }
  return cachedConfig!;
}

let msal: PublicClientApplication | null = null;

async function getMsal(cfg: AzureConfig): Promise<PublicClientApplication | null> {
  if (!cfg.enabled || !cfg.client_id || !cfg.tenant_id) return null;
  if (!msal) {
    msal = new PublicClientApplication({
      auth: {
        clientId: cfg.client_id,
        authority: `https://login.microsoftonline.com/${cfg.tenant_id}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'sessionStorage' },
    });
    await msal.initialize();
  }
  return msal;
}

// Kick off the Microsoft redirect sign-in (navigates away from the app).
export async function startAzureLogin(): Promise<void> {
  const cfg = await fetchAzureConfig();
  const instance = await getMsal(cfg);
  if (!instance) throw new Error('Microsoft sign-in is not available.');
  await instance.loginRedirect({ scopes: ['openid', 'profile', 'email'] });
}

// On app bootstrap: if we're returning from Microsoft, return the ID token.
export async function handleAzureRedirect(): Promise<string | null> {
  const cfg = await fetchAzureConfig();
  const instance = await getMsal(cfg);
  if (!instance) return null;
  const result = await instance.handleRedirectPromise();
  return result?.idToken || null;
}
