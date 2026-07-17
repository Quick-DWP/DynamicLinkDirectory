import { authedFetch } from './auth';

export type AdminUser = {
  uuid: string;
  username: string;
  email: string | null;
  display_name: string;
  role: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

export type UserInput = {
  username?: string;
  email?: string;
  display_name?: string;
  password?: string;
  role?: string;
  is_active?: boolean;
};

export async function listUsers(): Promise<AdminUser[]> {
  return authedFetch('/api/users');
}

export async function createUser(payload: UserInput): Promise<AdminUser> {
  return authedFetch('/api/users', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateUser(uuid: string, payload: UserInput): Promise<AdminUser> {
  return authedFetch(`/api/users/${uuid}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteUser(uuid: string): Promise<void> {
  await authedFetch(`/api/users/${uuid}`, { method: 'DELETE' });
}
