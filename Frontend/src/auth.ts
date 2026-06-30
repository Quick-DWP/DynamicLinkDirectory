import { apiUrl } from './config';

export type AuthUser = {
  uuid: string;
  username: string;
  display_name: string;
  role: string;
  last_login_at: string | null;
};

const TOKEN_KEY = 'dld_token';

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// fetch wrapper that attaches the bearer token and parses the { ok, data } envelope.
// Throws on non-ok responses; throws a special 'AUTH' error on 401 so callers can
// drop the session and show the login screen.
export async function authedFetch(path: string, init?: RequestInit) {
  const token = getToken();
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  if (response.status === 401) {
    clearToken();
    throw new Error('AUTH');
  }

  const result = await response.json();
  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || 'Request failed');
  }
  return result.data;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const response = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const result = await response.json();
  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || 'Login failed');
  }
  setToken(result.data.token);
  return result.data.user as AuthUser;
}

export async function fetchMe(): Promise<AuthUser | null> {
  if (!getToken()) return null;
  try {
    const data = await authedFetch('/api/auth/me');
    return data.user as AuthUser;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await authedFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore — clearing the local token is what matters
  }
  clearToken();
}
