import { useState } from 'react';
import type { Link } from '../types';

function hostOf(url: string): string {
  const v = (url || '').trim();
  try { return new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`).hostname; }
  catch { return ''; }
}

type Props = {
  link: Pick<Link, 'icon' | 'url'>;
  size?: number;
};

// Shows the link's custom emoji if set; otherwise the site's favicon, falling
// back to a generic 🔗 if the favicon can't be loaded.
export default function LinkIcon({ link, size = 18 }: Props) {
  const [failed, setFailed] = useState(false);

  if (link.icon) {
    return <span className="link-icon-emoji" style={{ fontSize: size }}>{link.icon}</span>;
  }

  const host = hostOf(link.url);
  if (!host || failed) {
    return <span className="link-icon-emoji" style={{ fontSize: size }}>🔗</span>;
  }

  return (
    <img
      className="link-favicon"
      width={size}
      height={size}
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
