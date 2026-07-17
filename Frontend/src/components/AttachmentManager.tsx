import { useEffect, useRef, useState } from 'react';
import {
  listAttachments, uploadAttachment, renameAttachment, deleteAttachment,
  formatBytes, fileEmoji, type Attachment,
} from '../attachments';
import AttachmentModal from './AttachmentModal';

const ACCEPT = '.pdf,image/*,.txt,.csv,.md,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,application/pdf';

// Admin control (inside the link editor) to attach/manage files for one link.
// Attachments save immediately — independent of the link's own "Save" button.
export default function AttachmentManager({ linkId, title }: { linkId: string; title: string }) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [editing, setEditing] = useState<{ uuid: string; name: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try { setFiles(await listAttachments(linkId)); } catch { /* handled elsewhere */ }
  };

  useEffect(() => {
    setMsg(null); setEditing(null); setConfirmDel(null); setViewing(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId]);

  const onFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const chosen = Array.from(list);
    setBusy(true); setMsg(null);
    let done = 0;
    try {
      for (const file of chosen) { await uploadAttachment(linkId, file); done += 1; }
      setMsg({ type: 'success', text: `Uploaded ${done} file${done === 1 ? '' : 's'}.` });
      await load();
    } catch (e) {
      await load();
      setMsg({ type: 'error', text: `${done > 0 ? `Uploaded ${done}, then failed: ` : ''}${e instanceof Error ? e.message : 'Upload failed.'}` });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveRename = async () => {
    if (!editing || !editing.name.trim()) return;
    setBusy(true);
    try { await renameAttachment(editing.uuid, editing.name.trim()); setEditing(null); await load(); }
    catch (e) { setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Rename failed.' }); }
    finally { setBusy(false); }
  };

  const remove = async (uuid: string) => {
    setBusy(true);
    try { await deleteAttachment(uuid); setConfirmDel(null); await load(); setMsg({ type: 'success', text: 'File removed.' }); }
    catch (e) { setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Delete failed.' }); }
    finally { setBusy(false); }
  };

  return (
    <div className="att-manager">
      <div className="att-manager-head">
        <span className="att-manager-title">Attachments ({files.length})</span>
        <label className="file-btn">
          {busy ? 'Working…' : '+ Upload file'}
          <input ref={fileRef} type="file" multiple accept={ACCEPT} disabled={busy} onChange={(e) => void onFiles(e.target.files)} />
        </label>
      </div>
      <p className="dld-hint">PDF, images, text/CSV, Office docs, ZIP — up to 25 MB each. Shown on the directory behind an “Attachments” button.</p>

      {files.length === 0 ? (
        <p className="muted-copy att-empty">No files yet.</p>
      ) : (
        <ul className="att-admin-list">
          {files.map((f) => (
            <li key={f.uuid} className="att-admin-row">
              <span className="att-emoji" aria-hidden="true">{fileEmoji(f.mime_type)}</span>
              {editing?.uuid === f.uuid ? (
                <input
                  className="att-rename-input"
                  value={editing.name}
                  autoFocus
                  onChange={(e) => setEditing({ uuid: f.uuid, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') void saveRename(); if (e.key === 'Escape') setEditing(null); }}
                />
              ) : (
                <span className="att-admin-main">
                  <span className="att-name">{f.filename}</span>
                  <span className="att-meta">{formatBytes(f.size)} · {f.mime_type}</span>
                </span>
              )}
              <span className="att-admin-actions">
                {editing?.uuid === f.uuid ? (
                  <>
                    <button type="button" className="mini-btn" disabled={busy} onClick={() => void saveRename()}>Save</button>
                    <button type="button" className="mini-btn" onClick={() => setEditing(null)}>Cancel</button>
                  </>
                ) : confirmDel === f.uuid ? (
                  <>
                    <button type="button" className="mini-btn danger" disabled={busy} onClick={() => void remove(f.uuid)}>Confirm</button>
                    <button type="button" className="mini-btn" onClick={() => setConfirmDel(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="mini-btn" onClick={() => setViewing(f.uuid)}>View</button>
                    <button type="button" className="mini-btn" onClick={() => setEditing({ uuid: f.uuid, name: f.filename })}>Rename</button>
                    <button type="button" className="mini-btn danger" onClick={() => setConfirmDel(f.uuid)}>Delete</button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {msg ? <p className={`message ${msg.type}`}>{msg.text}</p> : null}

      {viewing ? (
        <AttachmentModal linkId={linkId} title={title || 'Attachment'} initialUuid={viewing} onClose={() => setViewing(null)} />
      ) : null}
    </div>
  );
}
