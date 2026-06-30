import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../config';
import type { DirectoryGroup } from '../types';

const keyOf = (group: DirectoryGroup) => group.uuid ?? 'uncategorized';

export default function DirectoryPage() {
  const [groups, setGroups] = useState<DirectoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  // Categories start collapsed (auto-collapse); user can expand individually.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const loadDirectory = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/directory'));
      const result = await response.json();
      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || 'Failed to load directory');
      }
      const data: DirectoryGroup[] = result.data || [];
      setGroups(data);
      // Seed each group's open state from its configured default.
      setExpanded(Object.fromEntries(data.map((g) => [keyOf(g), !!g.default_expanded])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDirectory();
  }, []);

  const toggle = (key: string) => {
    setExpanded((cur) => ({ ...cur, [key]: !cur[key] }));
  };

  // Fire-and-forget click tracking that won't block opening the link.
  const trackClick = (uuid: string) => {
    const url = apiUrl(`/api/links/${uuid}/click`);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
    } else {
      void fetch(url, { method: 'POST', keepalive: true });
    }
  };

  const searchActive = search.trim() !== '';

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => {
        const groupMatches = group.name.toLowerCase().includes(q);
        const links = group.links.filter((link) =>
          groupMatches ||
          link.title.toLowerCase().includes(q) ||
          link.description.toLowerCase().includes(q) ||
          link.url.toLowerCase().includes(q),
        );
        return { ...group, links };
      })
      .filter((group) => group.links.length > 0);
  }, [groups, search]);

  const totalLinks = filteredGroups.reduce((sum, group) => sum + group.links.length, 0);

  return (
    <section className="page-stack">
      <article className="panel panel-header-row">
        <div>
          <p className="eyebrow">Directory</p>
          <h2>Browse links</h2>
          <p className="muted-copy">
            {loading
              ? 'Loading...'
              : `${totalLinks} link${totalLinks === 1 ? '' : 's'} across ${filteredGroups.length} group${filteredGroups.length === 1 ? '' : 's'}.`}
          </p>
        </div>
        <button className="secondary-btn" onClick={() => void loadDirectory()} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </article>

      <article className="panel">
        <div className="dld-toolbar">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search links by name, description, URL, or group..."
            aria-label="Search links"
          />
          {search ? (
            <button className="secondary-btn" onClick={() => setSearch('')}>Clear</button>
          ) : null}
        </div>
      </article>

      {error ? <p className="message error">{error}</p> : null}

      {!loading && !error && filteredGroups.length === 0 ? (
        <article className="panel">
          <p className="muted-copy">
            {search ? `No links match "${search}".` : 'No links yet. Add some from the Admin page.'}
          </p>
        </article>
      ) : null}

      <section className="directory-grid">
        {filteredGroups.map((group) => {
          const key = keyOf(group);
          const isOpen = searchActive || !!expanded[key];
          return (
            <article
              className={`panel${group.color ? ' cat-accent' : ''}`}
              key={key}
              style={group.color ? { borderLeftColor: group.color } : undefined}
            >
              <button
                type="button"
                className="group-header"
                onClick={() => toggle(key)}
                aria-expanded={isOpen}
              >
                <span className="eyebrow group-title" style={group.color ? { color: group.color } : undefined}>
                  {group.icon ? `${group.icon} ` : ''}{group.name}
                  <span className="group-count">{group.links.length}</span>
                </span>
                <span className="group-chevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
              </button>

              {isOpen ? (
                <>
                  {group.description ? <p className="muted-copy group-desc">{group.description}</p> : null}
                  <div className="item-list">
                    {group.links.map((link) => (
                      <div className="item-card link-card" key={link.uuid}>
                        <div className="link-main">
                          <strong>{link.icon ? `${link.icon} ` : ''}{link.title}</strong>
                          {link.description ? <span>{link.description}</span> : null}
                          <div className="pill-row compact">
                            <span className="pill">{hostnameOf(link.url)}</span>
                          </div>
                        </div>
                        <a
                          className="goto-btn"
                          href={ensureHref(link.url)}
                          target={link.open_in_new_tab ? '_blank' : undefined}
                          rel={link.open_in_new_tab ? 'noopener noreferrer' : undefined}
                          onClick={() => trackClick(link.uuid)}
                          aria-label={`Open ${link.title}`}
                          title={`Open ${link.title}`}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </article>
          );
        })}
      </section>
    </section>
  );
}

function ensureHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(ensureHref(url)).hostname || url;
  } catch {
    return url;
  }
}
