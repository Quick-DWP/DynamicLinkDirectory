import { apiUrl } from './config';
import { authedFetch } from './auth';

export type SiteSettings = {
  site_title: string;
  site_subtitle: string;
};

// Public read of site settings (title/subtitle shown in the hero).
export async function fetchSiteSettings(): Promise<SiteSettings | null> {
  try {
    const response = await fetch(apiUrl('/api/settings'));
    const result = await response.json();
    if (!response.ok || !result?.ok) return null;
    return result.data as SiteSettings;
  } catch {
    return null;
  }
}

// Admin update (requires auth). Returns the full updated settings object.
export async function updateSiteSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  return authedFetch('/api/settings', { method: 'PUT', body: JSON.stringify(patch) });
}
