import { useEffect, useRef, useState } from 'react';
import { fetchAttachmentBlob, previewKind, type Attachment } from '../attachments';

type Props = { attachment: Attachment };

// Renders an inline preview for a single attachment. Bytes are fetched with the
// bearer token and shown via a blob: URL, so this works under the login gate.
// Only safe, previewable types render inline; everything else offers a download.
export default function AttachmentPreview({ attachment }: Props) {
  const [url, setUrl] = useState('');
  const [textBody, setTextBody] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const urlRef = useRef('');

  const kind = previewKind(attachment.mime_type);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setTextBody(null);
    setUrl('');

    fetchAttachmentBlob(attachment.uuid)
      .then(async (blob) => {
        if (cancelled) return;
        if (kind === 'text') {
          const t = await blob.text();
          if (cancelled) return;
          setTextBody(t.length > 200_000 ? `${t.slice(0, 200_000)}\n\n… (truncated)` : t);
        } else {
          const objectUrl = URL.createObjectURL(blob);
          urlRef.current = objectUrl;
          setUrl(objectUrl);
        }
      })
      .catch(() => { if (!cancelled) setError('Could not load this file.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = ''; }
    };
  }, [attachment.uuid, kind]);

  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (loading) return <div className="att-preview-state">Loading preview…</div>;
  if (error) return <div className="att-preview-state error">{error}</div>;

  if (kind === 'image') {
    return (
      <div className="att-preview-shell">
        <img className="att-preview-img" src={url} alt={attachment.filename} />
      </div>
    );
  }

  if (kind === 'pdf') {
    return (
      <div className="att-preview-shell">
        <iframe className="att-preview-frame" src={url} title={attachment.filename} />
      </div>
    );
  }

  if (kind === 'text') {
    return (
      <div className="att-preview-shell">
        <pre className="att-preview-text">{textBody}</pre>
      </div>
    );
  }

  // Not previewable inline — offer a download.
  return (
    <div className="att-preview-state">
      <p>This file type can’t be previewed here.</p>
      <button type="button" className="primary-btn" onClick={download}>Download “{attachment.filename}”</button>
    </div>
  );
}
