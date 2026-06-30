import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../config';
import { fetchSiteSettings, normalizeTheme, type LayoutTheme } from '../settings';
import type { DirectoryGroup, Link } from '../types';
import LinkIcon from '../components/LinkIcon';

const keyOf = (group: DirectoryGroup) => group.uuid ?? 'uncategorized';

const GotoIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export default function DirectoryPage() {
  const [groups, setGroups] = useState<DirectoryGroup[]>([]);
  const [theme, setTheme] = useState<LayoutTheme>('cards');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  // Categories start collapsed (auto-collapse); user can expand individually.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Sidebar layout: which category is shown in the content pane.
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const loadDirectory = async () => {
    setLoading(true);
    setError('');
    try {
      const [dirRes, settings] = await Promise.all([
        fetch(apiUrl('/api/directory')).then((r) => r.json()),
        fetchSiteSettings(),
      ]);
      if (!dirRes?.ok) {
        throw new Error(dirRes?.message || 'Failed to load directory');
      }
      const data: DirectoryGroup[] = dirRes.data || [];
      setGroups(data);
      setTheme(normalizeTheme(settings?.layout_theme));
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

  const toggle = (key: string) => setExpanded((cur) => ({ ...cur, [key]: !cur[key] }));

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

  // Sidebar layout: resolve the currently shown category, keeping the selection valid.
  const activeGroup = filteredGroups.find((g) => keyOf(g) === activeKey) ?? filteredGroups[0] ?? null;

  useEffect(() => {
    if (theme !== 'sidebar') return;
    const keys = filteredGroups.map(keyOf);
    if (keys.length === 0) {
      if (activeKey !== null) setActiveKey(null);
    } else if (!activeKey || !keys.includes(activeKey)) {
      setActiveKey(keys[0]);
    }
  }, [theme, filteredGroups, activeKey]);

  // Layout-specific container/list classes.
  const sectionClass = theme === 'cards' ? 'directory-grid' : 'directory-stack';
  const listClass = theme === 'compact' ? 'compact-list' : theme === 'tiles' ? 'tile-grid' : 'item-list';

  const linkAnchorProps = (link: Link) => ({
    href: ensureHref(link.url),
    target: link.open_in_new_tab ? '_blank' : undefined,
    rel: link.open_in_new_tab ? 'noopener noreferrer' : undefined,
    onClick: () => trackClick(link.uuid),
  });

  const renderLink = (link: Link) => {
    if (theme === 'tiles') {
      // Launcher style: the whole tile is the link.
      return (
        <a key={link.uuid} className="link-tile" title={link.title} aria-label={`Open ${link.title}`} {...linkAnchorProps(link)}>
          <span className="tile-icon"><LinkIcon link={link} size={30} /></span>
          <span className="tile-title">{link.title}</span>
        </a>
      );
    }

    if (theme === 'compact') {
      return (
        <div className="link-row" key={link.uuid}>
          <span className="lr-icon" aria-hidden="true"><LinkIcon link={link} size={18} /></span>
          <div className="lr-main">
            <span className="lr-title">{link.title}</span>
            <span className="lr-host">{hostnameOf(link.url)}</span>
          </div>
          <a className="goto-btn sm" title={`Open ${link.title}`} aria-label={`Open ${link.title}`} {...linkAnchorProps(link)}>
            <GotoIcon />
          </a>
        </div>
      );
    }

    // cards / single
    return (
      <div className="item-card link-card" key={link.uuid}>
        <div className="link-main">
          <strong className="link-title"><LinkIcon link={link} size={18} /> {link.title}</strong>
          {link.description ? <span>{link.description}</span> : null}
          <div className="pill-row compact">
            <span className="pill">{hostnameOf(link.url)}</span>
          </div>
        </div>
        <a className="goto-btn" title={`Open ${link.title}`} aria-label={`Open ${link.title}`} {...linkAnchorProps(link)}>
          <GotoIcon />
        </a>
      </div>
    );
  };

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
          {search ? <button className="secondary-btn" onClick={() => setSearch('')}>Clear</button> : null}
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

      {theme === 'sidebar' && filteredGroups.length > 0 ? (
        <section className="dld-console">
          <aside className="dld-side">
            {filteredGroups.map((group) => {
              const key = keyOf(group);
              return (
                <button
                  key={key}
                  type="button"
                  className={`side-item${key === activeKey ? ' on' : ''}`}
                  onClick={() => setActiveKey(key)}
                >
                  <span className="side-label">{group.icon ? `${group.icon} ` : ''}{group.name}</span>
                  <span className="side-count">{group.links.length}</span>
                </button>
              );
            })}
          </aside>
          <div className="dld-main">
            {activeGroup ? (
              <>
                <header className="dld-main-head">
                  <h3>{activeGroup.icon ? `${activeGroup.icon} ` : ''}{activeGroup.name}</h3>
                  {activeGroup.description ? <p className="muted-copy">{activeGroup.description}</p> : null}
                </header>
                <div className="item-list">{activeGroup.links.map((link) => renderLink(link))}</div>
              </>
            ) : null}
          </div>
        </section>
      ) : (
      <section className={sectionClass}>
        {filteredGroups.map((group) => {
          const key = keyOf(group);
          const isOpen = searchActive || !!expanded[key];
          return (
            <article
              className={`panel${group.color ? ' cat-accent' : ''}`}
              key={key}
              style={group.color ? { borderLeftColor: group.color } : undefined}
            >
              <button type="button" className="group-header" onClick={() => toggle(key)} aria-expanded={isOpen}>
                <span className="eyebrow group-title" style={group.color ? { color: group.color } : undefined}>
                  {group.icon ? `${group.icon} ` : ''}{group.name}
                  <span className="group-count">{group.links.length}</span>
                </span>
                <span className="group-chevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
              </button>

              {isOpen ? (
                <>
                  {group.description ? <p className="muted-copy group-desc">{group.description}</p> : null}
                  <div className={listClass}>
                    {group.links.map((link) => renderLink(link))}
                  </div>
                </>
              ) : null}
            </article>
          );
        })}
      </section>
      )}
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
