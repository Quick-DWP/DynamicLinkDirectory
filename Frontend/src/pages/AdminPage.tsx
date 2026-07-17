import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authedFetch, useAuth, logout, changePassword, type AuthUser } from '../auth';
import LoginGate from '../components/LoginGate';
import ConfirmModal from '../components/ConfirmModal';
import { listUsers, createUser, updateUser, deleteUser, type AdminUser } from '../users';
import { fetchSiteSettings, updateSiteSettings, uploadLogo, deleteLogo, logoUrl, normalizeTheme, normalizeShell, normalizePalette, DEFAULT_ACCENT, LAYOUT_THEMES, SHELL_LAYOUTS, type LayoutTheme, type ShellLayout, type ThemePalette } from '../settings';
import type { Category, Link } from '../types';
import EmojiPicker from '../components/EmojiPicker';
import ColorPicker from '../components/ColorPicker';
import LayoutPicker from '../components/LayoutPicker';
import ShellPicker from '../components/ShellPicker';
import PalettePicker from '../components/PalettePicker';
import Toggle from '../components/Toggle';
import AttachmentManager from '../components/AttachmentManager';

const ADMIN_TABS = [
  { id: 'settings', label: 'Site settings' },
  { id: 'categories', label: 'Categories' },
  { id: 'links', label: 'Links' },
  { id: 'users', label: 'Users' },
  { id: 'account', label: 'Account' },
] as const;
type AdminTab = (typeof ADMIN_TABS)[number]['id'];

const EMPTY_USER = { username: '', email: '', display_name: '', role: 'viewer', password: '', is_active: true };
const EMPTY_CATEGORY = { name: '', description: '', icon: '', color: '', sort_order: 0, default_expanded: false, is_active: true };
const EMPTY_LINK = { title: '', url: '', description: '', note: '', icon: '', category_id: '', sort_order: 0, open_in_new_tab: true, is_active: true };

function withScheme(raw: string): string {
  const v = raw.trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function isValidHttpUrl(raw: string): boolean {
  const v = raw.trim();
  if (!v) return false;
  let u: URL;
  try { u = new URL(withScheme(v)); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname;
  return host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes('.');
}

function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  try { return new URL(withScheme(v)).href.replace(/\/+$/, '').toLowerCase(); }
  catch { return v.replace(/\/+$/, '').toLowerCase(); }
}

function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export default function AdminPage({ onSettingsSaved }: { onSettingsSaved: () => void }) {
  const { user, loaded } = useAuth();

  if (!loaded) {
    return (
      <section className="page-stack">
        <article className="panel"><p className="muted-copy">Loading...</p></article>
      </section>
    );
  }

  if (!user) {
    return <LoginGate eyebrow="Admin" heading="Sign in" subtext="Use an admin account to manage the directory." />;
  }

  if (user.role !== 'admin') {
    return (
      <section className="page-stack">
        <article className="panel">
          <p className="eyebrow">Admin</p>
          <h2>No admin access</h2>
          <p className="muted-copy">You’re signed in as {user.display_name || user.username}, but this account isn’t an admin. Ask an administrator for access.</p>
          <div className="button-row">
            <button className="secondary-btn" onClick={() => void logout()}>Log out</button>
          </div>
        </article>
      </section>
    );
  }

  return <AdminConsole user={user} onSettingsSaved={onSettingsSaved} />;
}

function AdminConsole({ user, onSettingsSaved }: { user: AuthUser; onSettingsSaved: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [busy, setBusy] = useState(false);

  // Feedback is scoped to a section so it renders next to the form that produced it.
  const [feedback, setFeedback] = useState<{ scope: string; type: 'error' | 'success'; text: string } | null>(null);

  // The active tab is a real route (/admin/:tab) so refresh and deep links land
  // on the same section the user was in.
  const { tab: tabParam } = useParams();
  const navigate = useNavigate();
  const tab: AdminTab = (ADMIN_TABS.some((t) => t.id === tabParam) ? tabParam : 'categories') as AdminTab;
  useEffect(() => {
    if (tabParam && !ADMIN_TABS.some((t) => t.id === tabParam)) {
      navigate('/admin/categories', { replace: true });
    }
  }, [tabParam, navigate]);
  const [confirmState, setConfirmState] = useState<{ title: string; body: ReactNode; onConfirm: () => void } | null>(null);
  const notify = (scope: string, type: 'error' | 'success', text: string) => setFeedback({ scope, type, text });
  const renderFeedback = (scope: string) =>
    feedback && feedback.scope === scope ? <p className={`message ${feedback.type}`}>{feedback.text}</p> : null;

  const [siteTitle, setSiteTitle] = useState('');
  const [siteSubtitle, setSiteSubtitle] = useState('');
  const [siteLayout, setSiteLayout] = useState<LayoutTheme>('cards');
  const [siteColor, setSiteColor] = useState(DEFAULT_ACCENT);
  const [siteShell, setSiteShell] = useState<ShellLayout>('classic');
  const [sitePalette, setSitePalette] = useState<ThemePalette>('warm');
  const [siteRequireLogin, setSiteRequireLogin] = useState(false);
  const [siteAutoFavicon, setSiteAutoFavicon] = useState(true);
  const [hasLogo, setHasLogo] = useState(false);
  const [logoTick, setLogoTick] = useState(0);

  // Account (change own password)
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNext, setPwNext] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');

  // Users management
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSelected, setUserSelected] = useState<string | null>(null);
  const [userForm, setUserForm] = useState(EMPTY_USER);

  const [catSelected, setCatSelected] = useState<string | null>(null);
  const [catForm, setCatForm] = useState(EMPTY_CATEGORY);

  const [linkSelected, setLinkSelected] = useState<string | null>(null);
  const [linkForm, setLinkForm] = useState(EMPTY_LINK);

  const [linkFilter, setLinkFilter] = useState('');   // category_id or ''
  const [linkSearch, setLinkSearch] = useState('');
  const [linkSort, setLinkSort] = useState<'order' | 'clicks'>('order');

  const [catDrag, setCatDrag] = useState<number | null>(null);
  const [catOver, setCatOver] = useState<number | null>(null);
  const [linkDrag, setLinkDrag] = useState<number | null>(null);
  const [linkOver, setLinkOver] = useState<number | null>(null);

  // Wrap admin calls so an expired session drops back to the login screen.
  const guard = async (scope: string, fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      if (err instanceof Error && err.message === 'AUTH') {
        // authedFetch already cleared the session; useAuth will drop to login.
        return;
      }
      notify(scope, 'error', err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setBusy(false);
    }
  };

  const loadAll = async () => {
    const [cats, lks, usrs] = await Promise.all([
      authedFetch('/api/categories'),
      authedFetch('/api/links'),
      listUsers(),
    ]);
    setCategories(cats || []);
    setLinks(lks || []);
    setUsers(usrs || []);
  };

  const loadSettings = async () => {
    const s = await fetchSiteSettings();
    if (s) {
      const layout = normalizeTheme(s.layout_theme);
      setSiteTitle(s.site_title);
      setSiteSubtitle(s.site_subtitle);
      setSiteLayout(layout);
      setSiteColor(s.theme_color || DEFAULT_ACCENT);
      setSiteShell(normalizeShell(s.shell_layout));
      setSitePalette(normalizePalette(s.theme_palette));
      setSiteRequireLogin(!!s.require_login);
      setSiteAutoFavicon(s.auto_favicon !== false);
      setHasLogo(!!s.has_logo);
      setLogoTick((t) => t + 1);
    }
  };

  const onLogoFile = (file: File | null) => {
    if (!file) return;
    void guard('settings', async () => {
      await uploadLogo(file);
      notify('settings', 'success', 'Logo uploaded.');
      await loadSettings();
      onSettingsSaved();
    });
  };

  const removeLogo = () => guard('settings', async () => {
    await deleteLogo();
    notify('settings', 'success', 'Logo removed.');
    await loadSettings();
    onSettingsSaved();
  });

  useEffect(() => {
    void guard('global', loadAll);
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSiteSettings = () => guard('settings', async () => {
    if (!siteTitle.trim()) { notify('settings', 'error', 'Site title is required.'); return; }
    await updateSiteSettings({ site_title: siteTitle.trim(), site_subtitle: siteSubtitle, layout_theme: siteLayout, theme_color: siteColor, shell_layout: siteShell, theme_palette: sitePalette, require_login: siteRequireLogin, auto_favicon: siteAutoFavicon });
    notify('settings', 'success', 'Site settings saved.');
    onSettingsSaved();
  });

  // ---- Account ----
  const savePassword = () => guard('account', async () => {
    if (pwNext.length < 6) { notify('account', 'error', 'New password must be at least 6 characters.'); return; }
    if (pwNext !== pwConfirm) { notify('account', 'error', 'New passwords do not match.'); return; }
    await changePassword(pwCurrent, pwNext);
    setPwCurrent(''); setPwNext(''); setPwConfirm('');
    notify('account', 'success', 'Password changed.');
  });

  // ---- Users ----
  const selectUser = (u: AdminUser | null) => {
    if (!u) { setUserSelected(null); setUserForm(EMPTY_USER); return; }
    setUserSelected(u.uuid);
    setUserForm({ username: u.username, email: u.email || '', display_name: u.display_name, role: u.role, password: '', is_active: u.is_active });
  };

  const saveUser = () => guard('users', async () => {
    let saved;
    if (userSelected) {
      saved = await updateUser(userSelected, {
        email: userForm.email.trim(),
        display_name: userForm.display_name,
        role: userForm.role,
        is_active: userForm.is_active,
        ...(userForm.password ? { password: userForm.password } : {}),
      });
      notify('users', 'success', 'User updated.');
    } else {
      if (!userForm.username.trim()) { notify('users', 'error', 'Username is required.'); return; }
      if (!userForm.password && !userForm.email.trim()) {
        notify('users', 'error', 'Set a password or an email (for Microsoft sign-in).'); return;
      }
      if (userForm.password && userForm.password.length < 6) {
        notify('users', 'error', 'Password must be at least 6 characters.'); return;
      }
      saved = await createUser({ ...userForm, email: userForm.email.trim() });
      notify('users', 'success', 'User created.');
    }
    await loadAll();
    // Keep the editor on the saved account rather than resetting to a blank form.
    selectUser(saved?.uuid ? saved : null);
  });

  const removeUser = (uuid: string) => guard('users', async () => {
    await deleteUser(uuid);
    notify('users', 'success', 'User deleted.');
    await loadAll();
    if (userSelected === uuid) selectUser(null);
  });

  const confirmDeleteUser = (u: AdminUser) => {
    setConfirmState({
      title: `Delete user “${u.username}”?`,
      body: <p className="muted-copy">This can’t be undone. They will no longer be able to sign in.</p>,
      onConfirm: () => void removeUser(u.uuid),
    });
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

  const saveCategory = () => guard('category', async () => {
    if (!catForm.name.trim()) { notify('category', 'error', 'Category name is required.'); return; }
    const saved = catSelected
      ? await authedFetch(`/api/categories/${catSelected}`, { method: 'PATCH', body: JSON.stringify(catForm) })
      : await authedFetch('/api/categories', { method: 'POST', body: JSON.stringify(catForm) });
    notify('category', 'success', catSelected ? 'Category updated.' : 'Category created.');
    await loadAll();
    // Keep the editor on the saved category (don't reset to a blank form).
    selectCategory(saved?.uuid ? saved : null);
  });

  const deleteCategory = (uuid: string) => guard('category', async () => {
    const res = await authedFetch(`/api/categories/${uuid}`, { method: 'DELETE' });
    const n = res?.removed_links || 0;
    notify('category', 'success', n > 0 ? `Category deleted (${n} link${n === 1 ? '' : 's'} removed).` : 'Category deleted.');
    await loadAll();
    if (catSelected === uuid) selectCategory(null);
  });

  const confirmDeleteCategory = (cat: Category) => {
    const n = links.filter((l) => l.category_id === cat.uuid).length;
    setConfirmState({
      title: `Delete category “${cat.name}”?`,
      body: (
        <>
          <p className="muted-copy">This can’t be undone.</p>
          {n > 0
            ? <p className="message error">This category has {n} link{n === 1 ? '' : 's'} — they will be deleted too.</p>
            : <p className="muted-copy">It has no links.</p>}
        </>
      ),
      onConfirm: () => void deleteCategory(cat.uuid),
    });
  };

  const dropCategory = (to: number) => guard('category', async () => {
    if (catDrag === null || catDrag === to) { setCatDrag(null); setCatOver(null); return; }
    const reordered = reorder(categories, catDrag, to);
    setCategories(reordered);
    setCatDrag(null); setCatOver(null);
    await authedFetch('/api/categories/reorder', {
      method: 'POST',
      body: JSON.stringify({ order: reordered.map((c) => c.uuid) }),
    });
    await loadAll();
    notify('category', 'success', 'Category order saved.');
  });

  // ---- Links ----
  const selectLink = (link: Link | null) => {
    if (!link) { setLinkSelected(null); setLinkForm({ ...EMPTY_LINK, category_id: catSelected || categories[0]?.uuid || '' }); return; }
    setLinkSelected(link.uuid);
    setLinkForm({
      title: link.title, url: link.url, description: link.description, note: link.note || '', icon: link.icon || '',
      category_id: link.category_id || '', sort_order: link.sort_order,
      open_in_new_tab: link.open_in_new_tab, is_active: link.is_active,
    });
  };

  const saveLink = () => guard('link', async () => {
    if (!linkForm.title.trim()) { notify('link', 'error', 'Link title is required.'); return; }
    if (!linkForm.url.trim()) { notify('link', 'error', 'Link URL is required.'); return; }
    if (!isValidHttpUrl(linkForm.url)) { notify('link', 'error', 'Enter a valid URL (e.g. https://example.com).'); return; }
    if (!linkForm.category_id) { notify('link', 'error', 'Select a category for this link.'); return; }
    const saved = linkSelected
      ? await authedFetch(`/api/links/${linkSelected}`, { method: 'PATCH', body: JSON.stringify(linkForm) })
      : await authedFetch('/api/links', { method: 'POST', body: JSON.stringify(linkForm) });
    notify('link', 'success', linkSelected ? 'Link updated.' : 'Link created.');
    await loadAll();
    // Keep the editor on the saved link — so you can keep editing or add
    // attachments to a link you just created, instead of losing your place.
    selectLink(saved?.uuid ? saved : null);
  });

  const deleteLink = (uuid: string) => guard('link', async () => {
    await authedFetch(`/api/links/${uuid}`, { method: 'DELETE' });
    notify('link', 'success', 'Link deleted.');
    await loadAll();
    if (linkSelected === uuid) selectLink(null);
  });

  const confirmDeleteLink = (link: Link) => {
    setConfirmState({
      title: `Delete link “${link.title}”?`,
      body: <p className="muted-copy">This can’t be undone.</p>,
      onConfirm: () => void deleteLink(link.uuid),
    });
  };

  const categoryName = (id: string | null) => categories.find((c) => c.uuid === id)?.name || 'Uncategorized';

  // Displayed links: filter by category, then by search text, then sort.
  const displayedLinks = useMemo(() => {
    const q = linkSearch.trim().toLowerCase();
    const filtered = links.filter((l) => {
      if (linkFilter && (l.category_id || '') !== linkFilter) return false;
      if (!q) return true;
      return l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q) || l.description.toLowerCase().includes(q);
    });
    if (linkSort === 'clicks') {
      return [...filtered].sort((a, b) => b.click_count - a.click_count);
    }
    return filtered;
  }, [links, linkFilter, linkSearch, linkSort]);

  const totalClicks = useMemo(() => links.reduce((sum, l) => sum + l.click_count, 0), [links]);

  // New-link category mirrors the category selected on the left (or the first one).
  // While editing an existing link, leave its own category alone.
  useEffect(() => {
    if (linkSelected) return;
    const next = catSelected || categories[0]?.uuid || '';
    setLinkForm((f) => (f.category_id === next ? f : { ...f, category_id: next }));
  }, [catSelected, categories, linkSelected]);

  // Non-blocking warning if another link already uses the same URL.
  const duplicateLink = useMemo(() => {
    const n = normalizeUrl(linkForm.url);
    if (!n) return null;
    return links.find((l) => l.uuid !== linkSelected && normalizeUrl(l.url) === n) || null;
  }, [links, linkForm.url, linkSelected]);

  // Drag is only meaningful on the unsearched list in manual order.
  const linkDragEnabled = linkSearch.trim() === '' && linkSort === 'order';

  const dropLink = (to: number) => guard('link', async () => {
    if (linkDrag === null || linkDrag === to) { setLinkDrag(null); setLinkOver(null); return; }
    const reordered = reorder(displayedLinks, linkDrag, to);
    setLinkDrag(null); setLinkOver(null);
    await authedFetch('/api/links/reorder', {
      method: 'POST',
      body: JSON.stringify({ order: reordered.map((l) => l.uuid) }),
    });
    await loadAll();
    notify('link', 'success', 'Link order saved.');
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
            <button className="secondary-btn" onClick={() => void guard('global', loadAll)} disabled={busy}>Refresh</button>
          </div>
        </div>
      </article>

      {renderFeedback('global')}

      <nav className="admin-tabs" aria-label="Admin sections">
        {ADMIN_TABS.map((t) => (
          <button key={t.id} type="button" className={`admin-tab${tab === t.id ? ' on' : ''}`} onClick={() => navigate(`/admin/${t.id}`)}>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Site settings */}
      {tab === 'settings' && (
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
        <div className="field"><span>Logo</span>
          <div className="logo-row">
            {hasLogo
              ? <img className="logo-preview" src={logoUrl(logoTick)} alt="Current logo" />
              : <span className="logo-preview empty" aria-hidden="true">—</span>}
            <div className="logo-actions">
              <label className="file-btn">
                {hasLogo ? 'Replace logo' : 'Upload logo'}
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={(e) => { onLogoFile(e.target.files?.[0] || null); e.target.value = ''; }} disabled={busy} />
              </label>
              {hasLogo ? <button type="button" className="secondary-btn" onClick={() => void removeLogo()} disabled={busy}>Remove</button> : null}
            </div>
          </div>
          <p className="dld-hint">Up to 5 MB. Displayed as a centered 1:1 square (cropped to fit).</p>
        </div>
        <div className="field"><span>Require login to view</span>
          <Toggle checked={siteRequireLogin} onChange={setSiteRequireLogin} onLabel="Login required" offLabel="Public" />
          <p className="dld-hint">When on, visitors must sign in to see the directory. Create viewer accounts under Users below.</p>
        </div>
        <div className="field"><span>Link favicons</span>
          <Toggle checked={siteAutoFavicon} onChange={setSiteAutoFavicon} onLabel="Show favicons" offLabel="Off" />
          <p className="dld-hint">Links without a custom emoji show the site’s favicon (fetched from an external service). Turn off for internal-only or privacy-sensitive portals.</p>
        </div>
        <div className="field"><span>Site layout</span>
          <ShellPicker value={siteShell} onChange={setSiteShell} />
        </div>
        <p className="dld-hint">{SHELL_LAYOUTS.find((s) => s.value === siteShell)?.hint}</p>
        <div className="field"><span>Directory layout</span>
          <LayoutPicker value={siteLayout} onChange={setSiteLayout} />
        </div>
        <p className="dld-hint">{LAYOUT_THEMES.find((t) => t.value === siteLayout)?.hint}</p>
        <div className="field"><span>Theme color (accent)</span>
          <ColorPicker value={siteColor} onChange={(v) => setSiteColor(v)} />
        </div>
        <div className="field"><span>Theme palette (background)</span>
          <PalettePicker value={sitePalette} onChange={setSitePalette} />
        </div>
        <div className="button-row">
          <button className="primary-btn" onClick={() => void saveSiteSettings()} disabled={busy}>Save site settings</button>
        </div>
        {renderFeedback('settings')}
      </article>
      )}

      {/* Categories */}
      {tab === 'categories' && (
      <section className="workspace-grid">
        <article className="panel">
          <div className="panel-list-head">
            <div>
              <p className="eyebrow">Categories</p>
              <h3>Groups ({categories.length})</h3>
            </div>
            <button className="secondary-btn" onClick={() => selectCategory(null)} disabled={busy}>+ New</button>
          </div>
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
            <div className="field"><span>Visible</span>
              <Toggle checked={catForm.is_active} onChange={(v) => setCatForm((f) => ({ ...f, is_active: v }))} onLabel="Active" offLabel="Hidden" />
            </div>
          </div>
          <div className="field"><span>Expanded by default (on directory)</span>
            <Toggle checked={catForm.default_expanded} onChange={(v) => setCatForm((f) => ({ ...f, default_expanded: v }))} onLabel="Expanded" offLabel="Collapsed" />
            {siteLayout === 'sidebar' ? (
              <p className="dld-hint warn">⚠ Sidebar layout ignores this — it shows one category at a time and auto-selects the first one by order.</p>
            ) : null}
          </div>

          <div className="button-row">
            <button className="primary-btn" onClick={() => void saveCategory()} disabled={busy}>{catSelected ? 'Save changes' : 'Create category'}</button>
            {catSelected ? (
              <button className="secondary-btn" onClick={() => { const c = categories.find((x) => x.uuid === catSelected); if (c) confirmDeleteCategory(c); }} disabled={busy}>Delete</button>
            ) : null}
          </div>
          {renderFeedback('category')}
        </article>
      </section>
      )}

      {/* Links */}
      {tab === 'links' && (
      <section className="workspace-grid">
        <article className="panel">
          <div className="panel-list-head">
            <div>
              <p className="eyebrow">Links</p>
              <h3>Links ({displayedLinks.length}{displayedLinks.length !== links.length ? ` of ${links.length}` : ''})</h3>
            </div>
            <button className="secondary-btn" onClick={() => selectLink(null)} disabled={busy || categories.length === 0}>+ New</button>
          </div>

          <div className="dld-toolbar">
            <select value={linkFilter} onChange={(e) => setLinkFilter(e.target.value)} aria-label="Filter by category">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.uuid} value={c.uuid}>{c.name}</option>)}
            </select>
            <select value={linkSort} onChange={(e) => setLinkSort(e.target.value as 'order' | 'clicks')} aria-label="Sort links">
              <option value="order">Sort: manual order</option>
              <option value="clicks">Sort: most opened</option>
            </select>
            <input value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} placeholder="Search links..." aria-label="Search links" />
          </div>
          <p className="dld-hint">
            {totalClicks} total open{totalClicks === 1 ? '' : 's'}. {linkDragEnabled ? 'Drag to reorder.' : 'Switch to manual order and clear search to reorder by dragging.'}
          </p>

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
                  {link.note ? <span className="pill" title={link.note}>📝 note</span> : null}
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

          {categories.length === 0 ? (
            <p className="message error">Add a category first — links must belong to a category.</p>
          ) : null}

          <label className="field"><span>Title</span>
            <input value={linkForm.title} onChange={(e) => setLinkForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Admin Dashboard" />
          </label>
          <label className="field"><span>URL</span>
            <input value={linkForm.url} onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://example.com" />
          </label>
          {duplicateLink ? <p className="dld-hint warn">⚠ “{duplicateLink.title}” already uses this URL.</p> : null}
          <label className="field"><span>Description</span>
            <textarea value={linkForm.description} onChange={(e) => setLinkForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </label>
          <label className="field"><span>Note (admin only)</span>
            <textarea value={linkForm.note} onChange={(e) => setLinkForm((f) => ({ ...f, note: e.target.value }))} rows={2} placeholder="Internal remark — visible to admins here only, never shown on the directory." />
          </label>
          <div className="field-row">
            <div className="field"><span>Icon (emoji)</span>
              <EmojiPicker value={linkForm.icon} onChange={(v) => setLinkForm((f) => ({ ...f, icon: v }))} />
            </div>
            <label className="field"><span>Category</span>
              <select value={linkForm.category_id} onChange={(e) => setLinkForm((f) => ({ ...f, category_id: e.target.value }))}>
                <option value="" disabled>Select a category…</option>
                {categories.map((cat) => <option key={cat.uuid} value={cat.uuid}>{cat.name}</option>)}
              </select>
            </label>
          </div>
          <div className="field-row">
            <label className="field"><span>Sort order</span>
              <input type="number" value={linkForm.sort_order} onChange={(e) => setLinkForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
            </label>
            <div className="field"><span>Open in</span>
              <Toggle checked={linkForm.open_in_new_tab} onChange={(v) => setLinkForm((f) => ({ ...f, open_in_new_tab: v }))} onLabel="New tab" offLabel="Same tab" />
            </div>
          </div>
          <div className="field"><span>Visible</span>
            <Toggle checked={linkForm.is_active} onChange={(v) => setLinkForm((f) => ({ ...f, is_active: v }))} onLabel="Active" offLabel="Hidden" />
          </div>

          <div className="button-row">
            <button className="primary-btn" onClick={() => void saveLink()} disabled={busy || categories.length === 0}>{linkSelected ? 'Save changes' : 'Create link'}</button>
            {linkSelected ? (
              <button className="secondary-btn" onClick={() => { const l = links.find((x) => x.uuid === linkSelected); if (l) confirmDeleteLink(l); }} disabled={busy}>Delete</button>
            ) : null}
          </div>
          {renderFeedback('link')}

          <div className="att-section">
            {linkSelected ? (
              <AttachmentManager linkId={linkSelected} title={linkForm.title} />
            ) : (
              <p className="dld-hint">💾 Save the link first — then you can attach files (spec, guideline, manual…).</p>
            )}
          </div>
        </article>
      </section>
      )}

      {/* Account */}
      {tab === 'account' && (
      <article className="panel">
        <p className="eyebrow">Account</p>
        <h3>Change your password</h3>
        <label className="field"><span>Current password</span>
          <input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} autoComplete="current-password" />
        </label>
        <div className="field-row">
          <label className="field"><span>New password</span>
            <input type="password" value={pwNext} onChange={(e) => setPwNext(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="field"><span>Confirm new password</span>
            <input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} autoComplete="new-password" />
          </label>
        </div>
        <div className="button-row">
          <button className="primary-btn" onClick={() => void savePassword()} disabled={busy}>Change password</button>
        </div>
        {renderFeedback('account')}
      </article>
      )}

      {/* Users */}
      {tab === 'users' && (
      <section className="workspace-grid">
        <article className="panel">
          <div className="panel-list-head">
            <div>
              <p className="eyebrow">Users</p>
              <h3>Accounts ({users.length})</h3>
            </div>
            <button className="secondary-btn" onClick={() => selectUser(null)} disabled={busy}>+ New</button>
          </div>
          <div className="item-list">
            {users.map((u) => (
              <button
                key={u.uuid}
                className={`item-card${u.uuid === userSelected ? ' active' : ''}`}
                onClick={() => selectUser(u)}
              >
                <strong>{u.display_name || u.username}</strong>
                <span>{u.username.includes('@') ? u.username : `@${u.username}`}</span>
                <div className="pill-row compact">
                  <span className="pill">{u.role}</span>
                  <span className="pill">{u.is_active ? 'active' : 'disabled'}</span>
                  {u.uuid === user.uuid ? <span className="pill">you</span> : null}
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">Editor</p>
          <h3>{userSelected ? 'Edit user' : 'New user'}</h3>

          <label className="field"><span>Username</span>
            <input value={userForm.username} onChange={(e) => setUserForm((f) => ({ ...f, username: e.target.value }))} disabled={!!userSelected} autoComplete="off" placeholder="login name" />
          </label>
          <label className="field"><span>Email (for Microsoft sign-in)</span>
            <input type="email" value={userForm.email} onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} autoComplete="off" placeholder="name@quick-transformation.com" />
          </label>
          <label className="field"><span>Display name</span>
            <input value={userForm.display_name} onChange={(e) => setUserForm((f) => ({ ...f, display_name: e.target.value }))} />
          </label>
          <div className="field-row">
            <label className="field"><span>Role</span>
              <select value={userForm.role === 'admin' ? 'admin' : 'viewer'} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="admin">Admin (can manage)</option>
                <option value="viewer">Viewer (can only view)</option>
              </select>
            </label>
            <div className="field"><span>Active</span>
              <Toggle checked={userForm.is_active} onChange={(v) => setUserForm((f) => ({ ...f, is_active: v }))} onLabel="Active" offLabel="Disabled" />
            </div>
          </div>
          <label className="field"><span>{userSelected ? 'New password (blank = keep current)' : 'Password (optional if email set)'}</span>
            <input type="password" value={userForm.password} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" placeholder={userSelected ? '••••••' : 'leave blank for Microsoft-only login'} />
          </label>
          <p className="dld-hint">Set an <b>email</b> to allow Microsoft sign-in (matched case-insensitively). A password enables username/password login. Admins manage everything; viewers can only view. The last active admin can’t be removed or demoted.</p>

          <div className="button-row">
            <button className="primary-btn" onClick={() => void saveUser()} disabled={busy}>{userSelected ? 'Save changes' : 'Create user'}</button>
            {userSelected && userSelected !== user.uuid ? (
              <button className="secondary-btn" onClick={() => { const u = users.find((x) => x.uuid === userSelected); if (u) confirmDeleteUser(u); }} disabled={busy}>Delete</button>
            ) : null}
          </div>
          {renderFeedback('users')}
        </article>
      </section>
      )}

      {confirmState ? (
        <ConfirmModal
          title={confirmState.title}
          busy={busy}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => { const fn = confirmState.onConfirm; setConfirmState(null); fn(); }}
        >
          {confirmState.body}
        </ConfirmModal>
      ) : null}
    </section>
  );
}
