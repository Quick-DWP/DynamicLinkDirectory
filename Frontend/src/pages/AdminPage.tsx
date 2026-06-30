import { useEffect, useMemo, useState } from 'react';
import { authedFetch, fetchMe, login, logout, type AuthUser } from '../auth';
import { fetchSiteSettings, updateSiteSettings } from '../settings';
import type { Category, Link } from '../types';
import EmojiPicker from '../components/EmojiPicker';
import ColorPicker from '../components/ColorPicker';

const EMPTY_CATEGORY = { name: '', description: '', icon: '', color: '', sort_order: 0, default_expanded: false, is_active: true };
const EMPTY_LINK = { title: '', url: '', description: '', icon: '', category_id: '', sort_order: 0, open_in_new_tab: true, is_active: true };

function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export default function AdminPage({ onSettingsSaved }: { onSettingsSaved: () => void }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void (async () => {
      setUser(await fetchMe());
      setChecking(false);
    })();
  }, []);

  if (checking) {
    return (
      <section className="page-stack">
        <article className="panel"><p className="muted-copy">Loading...</p></article>
      </section>
    );
  }

  if (!user) {
    return <LoginGate onLoggedIn={setUser} />;
  }

  return <AdminConsole user={user} onLoggedOut={() => setUser(null)} onSettingsSaved={onSettingsSaved} />;
}

function LoginGate({ onLoggedIn }: { onLoggedIn: (u: AuthUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const u = await login(username.trim(), password);
      onLoggedIn(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page-stack">
      <article className="panel login-card">
        <p className="eyebrow">Admin</p>
        <h2>Sign in</h2>
        <p className="muted-copy">Enter your admin credentials to manage the directory.</p>

        {error ? <p className="message error">{error}</p> : null}

        <label className="field">
          <span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          />
        </label>

        <div className="button-row">
          <button className="primary-btn" onClick={() => void submit()} disabled={busy || !username || !password}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </div>
      </article>
    </section>
  );
}

function AdminConsole({ user, onLoggedOut, onSettingsSaved }: { user: AuthUser; onLoggedOut: () => void; onSettingsSaved: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [siteTitle, setSiteTitle] = useState('');
  const [siteSubtitle, setSiteSubtitle] = useState('');

  const [catSelected, setCatSelected] = useState<string | null>(null);
  const [catForm, setCatForm] = useState(EMPTY_CATEGORY);

  const [linkSelected, setLinkSelected] = useState<string | null>(null);
  const [linkForm, setLinkForm] = useState(EMPTY_LINK);

  const [linkFilter, setLinkFilter] = useState('');   // category_id or ''
  const [linkSearch, setLinkSearch] = useState('');

  const [catDrag, setCatDrag] = useState<number | null>(null);
  const [catOver, setCatOver] = useState<number | null>(null);
  const [linkDrag, setLinkDrag] = useState<number | null>(null);
  const [linkOver, setLinkOver] = useState<number | null>(null);

  // Wrap admin calls so an expired session drops back to the login screen.
  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      if (err instanceof Error && err.message === 'AUTH') {
        onLoggedOut();
        return;
      }
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setBusy(false);
    }
  };

  const loadAll = async () => {
    setError('');
    const [cats, lks] = await Promise.all([
      authedFetch('/api/categories'),
      authedFetch('/api/links'),
    ]);
    setCategories(cats || []);
    setLinks(lks || []);
  };

  const loadSettings = async () => {
    const s = await fetchSiteSettings();
    if (s) { setSiteTitle(s.site_title); setSiteSubtitle(s.site_subtitle); }
  };

  useEffect(() => {
    void guard(loadAll);
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (msg: string) => { setMessage(msg); setError(''); };

  const saveSiteSettings = () => guard(async () => {
    if (!siteTitle.trim()) { setError('Site title is required.'); return; }
    await updateSiteSettings({ site_title: siteTitle.trim(), site_subtitle: siteSubtitle });
    flash('Site settings saved.');
    onSettingsSaved();
  });

  const doLogout = async () => {
    await logout();
    onLoggedOut();
  };

  // ---- Categories ----
  const selectCategory = (cat: Category | null) => {
    if (!cat) { setCatSelected(null); setCatForm(EMPTY_CATEGORY); return; }
    setCatSelected(cat.uuid);
    setCatForm({
      name: cat.name, description: cat.description, icon: cat.icon || '',
      color: cat.color || '', sort_order: cat.sort_order,
      default_expanded: cat.default_expanded, is_active: cat.is_active,
    });
  };

  const saveCategory = () => guard(async () => {
    if (!catForm.name.trim()) { setError('Category name is required.'); return; }
    if (catSelected) {
      await authedFetch(`/api/categories/${catSelected}`, { method: 'PATCH', body: JSON.stringify(catForm) });
      flash('Category updated.');
    } else {
      await authedFetch('/api/categories', { method: 'POST', body: JSON.stringify(catForm) });
      flash('Category created.');
    }
    await loadAll();
    selectCategory(null);
  });

  const deleteCategory = (uuid: string) => guard(async () => {
    await authedFetch(`/api/categories/${uuid}`, { method: 'DELETE' });
    flash('Category deleted. Its links are now uncategorized.');
    await loadAll();
    if (catSelected === uuid) selectCategory(null);
  });

  const dropCategory = (to: number) => guard(async () => {
    if (catDrag === null || catDrag === to) { setCatDrag(null); setCatOver(null); return; }
    const reordered = reorder(categories, catDrag, to);
    setCategories(reordered);
    setCatDrag(null); setCatOver(null);
    await authedFetch('/api/categories/reorder', {
      method: 'POST',
      body: JSON.stringify({ order: reordered.map((c) => c.uuid) }),
    });
    await loadAll();
    flash('Category order saved.');
  });

  // ---- Links ----
  const selectLink = (link: Link | null) => {
    if (!link) { setLinkSelected(null); setLinkForm(EMPTY_LINK); return; }
    setLinkSelected(link.uuid);
    setLinkForm({
      title: link.title, url: link.url, description: link.description, icon: link.icon || '',
      category_id: link.category_id || '', sort_order: link.sort_order,
      open_in_new_tab: link.open_in_new_tab, is_active: link.is_active,
    });
  };

  const saveLink = () => guard(async () => {
    if (!linkForm.title.trim()) { setError('Link title is required.'); return; }
    if (!linkForm.url.trim()) { setError('Link URL is required.'); return; }
    if (linkSelected) {
      await authedFetch(`/api/links/${linkSelected}`, { method: 'PATCH', body: JSON.stringify(linkForm) });
      flash('Link updated.');
    } else {
      await authedFetch('/api/links', { method: 'POST', body: JSON.stringify(linkForm) });
      flash('Link created.');
    }
    await loadAll();
    selectLink(null);
  });

  const deleteLink = (uuid: string) => guard(async () => {
    await authedFetch(`/api/links/${uuid}`, { method: 'DELETE' });
    flash('Link deleted.');
    await loadAll();
    if (linkSelected === uuid) selectLink(null);
  });

  const categoryName = (id: string | null) => categories.find((c) => c.uuid === id)?.name || 'Uncategorized';

  // Displayed links: filter by category, then by search text.
  const displayedLinks = useMemo(() => {
    const q = linkSearch.trim().toLowerCase();
    return links.filter((l) => {
      if (linkFilter && (l.category_id || '') !== linkFilter) return false;
      if (!q) return true;
      return l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q) || l.description.toLowerCase().includes(q);
    });
  }, [links, linkFilter, linkSearch]);

  // Drag is only meaningful on the unsearched list (stable indices map to real order).
  const linkDragEnabled = linkSearch.trim() === '';

  const dropLink = (to: number) => guard(async () => {
    if (linkDrag === null || linkDrag === to) { setLinkDrag(null); setLinkOver(null); return; }
    const reordered = reorder(displayedLinks, linkDrag, to);
    setLinkDrag(null); setLinkOver(null);
    await authedFetch('/api/links/reorder', {
      method: 'POST',
      body: JSON.stringify({ order: reordered.map((l) => l.uuid) }),
    });
    await loadAll();
    flash('Link order saved.');
  });

  return (
    <section className="page-stack">
      <article className="panel panel-header-row">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Manage directory</h2>
          <p className="muted-copy">Add and organize categories and links. Drag cards to reorder. Changes appear on the Directory page immediately.</p>
        </div>
        <div className="admin-bar">
          <span className="who">Signed in as {user.display_name || user.username}</span>
          <div className="admin-bar-actions">
            <button className="secondary-btn" onClick={() => void guard(loadAll)} disabled={busy}>Refresh</button>
            <button className="secondary-btn" onClick={() => void doLogout()}>Log out</button>
          </div>
        </div>
      </article>

      {error ? <p className="message error">{error}</p> : null}
      {message ? <p className="message success">{message}</p> : null}

      {/* Site settings */}
      <article className="panel">
        <p className="eyebrow">Site settings</p>
        <h3>Title & description</h3>
        <p className="muted-copy">Shown in the page header on every page.</p>
        <label className="field"><span>Site title</span>
          <input value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} placeholder="Dynamic Link Directory" />
        </label>
        <label className="field"><span>Site description</span>
          <textarea value={siteSubtitle} onChange={(e) => setSiteSubtitle(e.target.value)} rows={2} placeholder="A simple web portal — browse and jump to the links you need." />
        </label>
        <div className="button-row">
          <button className="primary-btn" onClick={() => void saveSiteSettings()} disabled={busy}>Save site settings</button>
        </div>
      </article>

      {/* Categories */}
      <section className="workspace-grid">
        <article className="panel">
          <p className="eyebrow">Categories</p>
          <h3>Groups ({categories.length})</h3>
          <p className="dld-hint">Drag to reorder.</p>
          <div className="item-list">
            {categories.map((cat, i) => (
              <button
                key={cat.uuid}
                className={`item-card draggable${cat.uuid === catSelected ? ' active' : ''}${catOver === i ? ' drag-over' : ''}${catDrag === i ? ' dragging' : ''}`}
                onClick={() => selectCategory(cat)}
                draggable
                onDragStart={() => setCatDrag(i)}
                onDragOver={(e) => { e.preventDefault(); setCatOver(i); }}
                onDragLeave={() => setCatOver((v) => (v === i ? null : v))}
                onDrop={(e) => { e.preventDefault(); void dropCategory(i); }}
                onDragEnd={() => { setCatDrag(null); setCatOver(null); }}
              >
                <strong>{cat.icon ? `${cat.icon} ` : ''}{cat.name}</strong>
                {cat.description ? <span>{cat.description}</span> : null}
                <div className="pill-row compact">
                  <span className="pill">order {cat.sort_order}</span>
                  <span className="pill">{cat.is_active ? 'active' : 'hidden'}</span>
                  <span className="pill">{cat.default_expanded ? 'expanded' : 'collapsed'}</span>
                  {cat.color ? <span className="pill" style={{ color: cat.color }}>{cat.color}</span> : null}
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">Editor</p>
          <h3>{catSelected ? 'Edit category' : 'New category'}</h3>

          <label className="field"><span>Name</span>
            <input value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Internal Tools" />
          </label>
          <label className="field"><span>Description</span>
            <textarea value={catForm.description} onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </label>
          <div className="field-row">
            <div className="field"><span>Icon (emoji)</span>
              <EmojiPicker value={catForm.icon} onChange={(v) => setCatForm((f) => ({ ...f, icon: v }))} />
            </div>
            <div className="field"><span>Color</span>
              <ColorPicker value={catForm.color} onChange={(v) => setCatForm((f) => ({ ...f, color: v }))} />
            </div>
          </div>
          <div className="field-row">
            <label className="field"><span>Sort order</span>
              <input type="number" value={catForm.sort_order} onChange={(e) => setCatForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
            </label>
            <label className="field"><span>Visible</span>
              <select value={catForm.is_active ? 'yes' : 'no'} onChange={(e) => setCatForm((f) => ({ ...f, is_active: e.target.value === 'yes' }))}>
                <option value="yes">Active</option>
                <option value="no">Hidden</option>
              </select>
            </label>
          </div>
          <label className="field"><span>Expanded by default (on directory)</span>
            <select value={catForm.default_expanded ? 'yes' : 'no'} onChange={(e) => setCatForm((f) => ({ ...f, default_expanded: e.target.value === 'yes' }))}>
              <option value="no">Collapsed</option>
              <option value="yes">Expanded</option>
            </select>
          </label>

          <div className="button-row">
            <button className="primary-btn" onClick={() => void saveCategory()} disabled={busy}>{catSelected ? 'Save changes' : 'Create category'}</button>
            {catSelected ? (
              <>
                <button className="secondary-btn" onClick={() => selectCategory(null)} disabled={busy}>New</button>
                <button className="secondary-btn" onClick={() => void deleteCategory(catSelected)} disabled={busy}>Delete</button>
              </>
            ) : null}
          </div>
        </article>
      </section>

      {/* Links */}
      <section className="workspace-grid">
        <article className="panel">
          <p className="eyebrow">Links</p>
          <h3>Links ({displayedLinks.length}{displayedLinks.length !== links.length ? ` of ${links.length}` : ''})</h3>

          <div className="dld-toolbar">
            <select value={linkFilter} onChange={(e) => setLinkFilter(e.target.value)} aria-label="Filter by category">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.uuid} value={c.uuid}>{c.name}</option>)}
            </select>
            <input value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} placeholder="Search links..." aria-label="Search links" />
          </div>
          <p className="dld-hint">{linkDragEnabled ? 'Drag to reorder.' : 'Clear search to reorder by dragging.'}</p>

          <div className="item-list">
            {displayedLinks.map((link, i) => (
              <button
                key={link.uuid}
                className={`item-card${linkDragEnabled ? ' draggable' : ''}${link.uuid === linkSelected ? ' active' : ''}${linkOver === i ? ' drag-over' : ''}${linkDrag === i ? ' dragging' : ''}`}
                onClick={() => selectLink(link)}
                draggable={linkDragEnabled}
                onDragStart={() => linkDragEnabled && setLinkDrag(i)}
                onDragOver={(e) => { if (linkDragEnabled) { e.preventDefault(); setLinkOver(i); } }}
                onDragLeave={() => setLinkOver((v) => (v === i ? null : v))}
                onDrop={(e) => { if (linkDragEnabled) { e.preventDefault(); void dropLink(i); } }}
                onDragEnd={() => { setLinkDrag(null); setLinkOver(null); }}
              >
                <strong>{link.icon ? `${link.icon} ` : ''}{link.title}</strong>
                <span>{link.url}</span>
                <div className="pill-row compact">
                  <span className="pill">{categoryName(link.category_id)}</span>
                  <span className="pill">order {link.sort_order}</span>
                  <span className="pill">{link.is_active ? 'active' : 'hidden'}</span>
                  <span className="count-badge">👁 {link.click_count}</span>
                </div>
              </button>
            ))}
            {displayedLinks.length === 0 ? <p className="muted-copy">No links match.</p> : null}
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">Editor</p>
          <h3>{linkSelected ? 'Edit link' : 'New link'}</h3>

          <label className="field"><span>Title</span>
            <input value={linkForm.title} onChange={(e) => setLinkForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Admin Dashboard" />
          </label>
          <label className="field"><span>URL</span>
            <input value={linkForm.url} onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://example.com" />
          </label>
          <label className="field"><span>Description</span>
            <textarea value={linkForm.description} onChange={(e) => setLinkForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </label>
          <div className="field-row">
            <div className="field"><span>Icon (emoji)</span>
              <EmojiPicker value={linkForm.icon} onChange={(v) => setLinkForm((f) => ({ ...f, icon: v }))} />
            </div>
            <label className="field"><span>Category</span>
              <select value={linkForm.category_id} onChange={(e) => setLinkForm((f) => ({ ...f, category_id: e.target.value }))}>
                <option value="">Uncategorized</option>
                {categories.map((cat) => <option key={cat.uuid} value={cat.uuid}>{cat.name}</option>)}
              </select>
            </label>
          </div>
          <div className="field-row">
            <label className="field"><span>Sort order</span>
              <input type="number" value={linkForm.sort_order} onChange={(e) => setLinkForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
            </label>
            <label className="field"><span>Open in</span>
              <select value={linkForm.open_in_new_tab ? 'new' : 'same'} onChange={(e) => setLinkForm((f) => ({ ...f, open_in_new_tab: e.target.value === 'new' }))}>
                <option value="new">New tab</option>
                <option value="same">Same tab</option>
              </select>
            </label>
          </div>
          <label className="field"><span>Visible</span>
            <select value={linkForm.is_active ? 'yes' : 'no'} onChange={(e) => setLinkForm((f) => ({ ...f, is_active: e.target.value === 'yes' }))}>
              <option value="yes">Active</option>
              <option value="no">Hidden</option>
            </select>
          </label>

          <div className="button-row">
            <button className="primary-btn" onClick={() => void saveLink()} disabled={busy}>{linkSelected ? 'Save changes' : 'Create link'}</button>
            {linkSelected ? (
              <>
                <button className="secondary-btn" onClick={() => selectLink(null)} disabled={busy}>New</button>
                <button className="secondary-btn" onClick={() => void deleteLink(linkSelected)} disabled={busy}>Delete</button>
              </>
            ) : null}
          </div>
        </article>
      </section>
    </section>
  );
}
