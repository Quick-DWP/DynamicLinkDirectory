import { useEffect, useState } from 'react';
import { apiUrl } from './config';

export type AuthUser = {
  uuid: string;
  username: string;
  email?: string | null;
  display_name: string;
  role: string;
  last_login_at: string | null;
};

const TOKEN_KEY = 'dld_token';

// --- Shared auth state (single source of truth across the app) ---
let currentUser: AuthUser | null = null;
let authLoaded = false;
let loadingPromise: Promise<AuthUser | null> | null = null;
const subscribers = new Set<() => void>();

function emitAuth() {
  for (const fn of subscribers) fn();
}

function setCurrentUser(user: AuthUser | null) {
  currentUser = user;
  authLoaded = true;
  emitAuth();
}

// Resolve the current user from the stored token (once; shared across callers).
export async function refreshAuth(): Promise<AuthUser | null> {
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const user = await fetchMe();
      setCurrentUser(user);
      return user;
    })().finally(() => { loadingPromise = null; });
  }
  return loadingPromise;
}

// React hook: current user + whether the initial check has completed.
export function useAuth(): { user: AuthUser | null; loaded: boolean } {
  const [snap, setSnap] = useState({ user: currentUser, loaded: authLoaded });
  useEffect(() => {
    const update = () => setSnap({ user: currentUser, loaded: authLoaded });
    subscribers.add(update);
    update();
    if (!authLoaded) void refreshAuth();
    return () => { subscribers.delete(update); };
  }, []);
  return snap;
}

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
      // Only declare a JSON body when there actually is one — Fastify rejects an
      // empty body sent with Content-Type: application/json (e.g. DELETE/logout).
      ...(init?.body != null ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  if (response.status === 401) {
    clearToken();
    setCurrentUser(null);
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
  setCurrentUser(result.data.user as AuthUser);
  return result.data.user as AuthUser;
}

// Exchange a verified Microsoft ID token for an app session.
export async function azureLogin(idToken: string): Promise<AuthUser> {
  const response = await fetch(apiUrl('/api/auth/azure-login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const result = await response.json();
  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || 'Microsoft sign-in failed');
  }
  setToken(result.data.token);
  setCurrentUser(result.data.user as AuthUser);
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

export async function changePassword(current_password: string, new_password: string): Promise<void> {
  await authedFetch('/api/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({ current_password, new_password }),
  });
}

export async function logout(): Promise<void> {
  try {
    await authedFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore — clearing the local token is what matters
  }
  clearToken();
  setCurrentUser(null);
}
