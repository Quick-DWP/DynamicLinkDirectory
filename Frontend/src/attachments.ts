import { apiUrl } from './config';
import { authedFetch, getToken } from './auth';

export type Attachment = {
  uuid: string;
  link_id: string;
  filename: string;
  mime_type: string;
  size: number;
  sort_order: number;
  created_at: string;
};

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // keep in sync with the backend

export async function listAttachments(linkId: string): Promise<Attachment[]> {
  return authedFetch(`/api/attachments/link/${linkId}`);
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadAttachment(linkId: string, file: File): Promise<Attachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('File must be 25 MB or smaller.');
  }
  const dataUrl = await readAsDataURL(file);
  const comma = dataUrl.indexOf(',');
  const semi = dataUrl.indexOf(';');
  const mime = (semi > 5 ? dataUrl.slice(5, semi) : file.type) || 'application/octet-stream';
  const base64 = dataUrl.slice(comma + 1);
  return authedFetch(`/api/attachments/link/${linkId}`, {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, mime_type: mime, data: base64 }),
  });
}

export async function renameAttachment(uuid: string, filename: string): Promise<Attachment> {
  return authedFetch(`/api/attachments/${uuid}`, {
    method: 'PATCH',
    body: JSON.stringify({ filename }),
  });
}

export async function deleteAttachment(uuid: string): Promise<void> {
  await authedFetch(`/api/attachments/${uuid}`, { method: 'DELETE' });
}

// Fetch the raw bytes WITH the bearer token so previews/downloads work even when
// the directory requires login (an <img>/<iframe> src can't carry our token).
export async function fetchAttachmentBlob(uuid: string): Promise<Blob> {
  const token = getToken();
  const res = await fetch(apiUrl(`/api/attachments/${uuid}/raw`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Failed to load file');
  return res.blob();
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const n = bytes / 1024 ** i;
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}

// What kind of inline preview a MIME type supports.
export type PreviewKind = 'image' | 'pdf' | 'text' | 'none';
export function previewKind(mime: string): PreviewKind {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('text/') || m === 'application/json') return 'text';
  return 'none';
}

export function fileEmoji(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m === 'application/pdf') return '📕';
  if (m.startsWith('image/')) return '🖼️';
  if (m.startsWith('text/') || m === 'application/json') return '📄';
  if (m.includes('word')) return '📘';
  if (m.includes('sheet') || m.includes('excel') || m === 'text/csv') return '📊';
  if (m.includes('presentation') || m.includes('powerpoint')) return '📙';
  if (m.includes('zip')) return '🗜️';
  return '📎';
}
