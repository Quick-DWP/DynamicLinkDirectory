import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { listAttachments, fetchAttachmentBlob, formatBytes, fileEmoji, type Attachment } from '../attachments';
import { useFocusTrap } from '../useFocusTrap';
import AttachmentPreview from './AttachmentPreview';

type Props = { linkId: string; title: string; onClose: () => void; initialUuid?: string };

// Modal: lists a link's files and previews them in-page. Used by both the viewer
// directory and the admin editor (which opens it focused on a specific file).
export default function AttachmentModal({ linkId, title, onClose, initialUuid }: Props) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const dialogRef = useFocusTrap<HTMLDivElement>(onClose);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAttachments(linkId)
      .then((rows) => {
        if (cancelled) return;
        setFiles(rows);
        const start = initialUuid && rows.some((r) => r.uuid === initialUuid) ? initialUuid : rows[0]?.uuid ?? null;
        setSelected(start);
      })
      .catch(() => { if (!cancelled) setError('Could not load attachments.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [linkId, initialUuid]);

  const download = async (f: Attachment) => {
    const blob = await fetchAttachmentBlob(f.uuid);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const current = files.find((f) => f.uuid === selected) || null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} className="modal-card att-modal" role="dialog" aria-modal="true" aria-label={`Attachments for ${title}`} onClick={(e) => e.stopPropagation()}>
        <div className="att-modal-head">
          <div>
            <p className="eyebrow">Attachments</p>
            <h3>{title}</h3>
          </div>
          <button type="button" className="att-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {loading ? (
          <p className="muted-copy">Loading…</p>
        ) : error ? (
          <p className="message error">{error}</p>
        ) : files.length === 0 ? (
          <p className="muted-copy">No files attached to this link.</p>
        ) : (
          <div className="att-modal-body">
            <ul className="att-list">
              {files.map((f) => (
                <li key={f.uuid} className="att-list-row">
                  <button
                    type="button"
                    className={`att-item${f.uuid === selected ? ' on' : ''}`}
                    onClick={() => setSelected(f.uuid)}
                  >
                    <span className="att-emoji" aria-hidden="true">{fileEmoji(f.mime_type)}</span>
                    <span className="att-item-main">
                      <span className="att-name">{f.filename}</span>
                      <span className="att-meta">{formatBytes(f.size)}</span>
                    </span>
                  </button>
                  <button type="button" className="att-dl" title={`Download ${f.filename}`} aria-label={`Download ${f.filename}`} onClick={() => void download(f)}>⇩</button>
                </li>
              ))}
            </ul>
            <div className="att-viewer">
              {current ? <AttachmentPreview attachment={current} /> : null}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
