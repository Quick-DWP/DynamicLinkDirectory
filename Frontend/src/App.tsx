import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { getAppConfig } from './config';
import { useAuth, logout } from './auth';
import { fetchSiteSettings, resolveAccent, accentVars, paletteVars, DEFAULT_ACCENT, normalizeShell, normalizePalette, logoUrl, type ShellLayout, type ThemePalette } from './settings';
import DirectoryPage from './pages/DirectoryPage';
import AdminPage from './pages/AdminPage';
import LoginGate from './components/LoginGate';
import './index.css';

const heroNavClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'app-nav-link active' : 'app-nav-link');
const topNavClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'topbar-link active' : 'topbar-link');

// Neutral sign-in page (not framed as admin). Lands on the directory afterwards.
function LoginRoute() {
  const { user, loaded } = useAuth();
  const navigate = useNavigate();
  if (loaded && user) return <Navigate to="/" replace />;
  return <LoginGate onLoggedIn={() => navigate('/', { replace: true })} />;
}

export default function App() {
  const config = getAppConfig();
  // Hero text, accent, palette, and the whole-site shell all come from DB-backed settings.
  const [title, setTitle] = useState(config.app.name);
  const [subtitle, setSubtitle] = useState(config.app.subtitle);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [shell, setShell] = useState<ShellLayout>('classic');
  const [palette, setPalette] = useState<ThemePalette>('warm');
  const [hasLogo, setHasLogo] = useState(false);
  const [logoTick, setLogoTick] = useState(0); // cache-bust the logo after changes
  const { user } = useAuth();
  const onLogout = () => { void logout(); };

  const loadSettings = async () => {
    const settings = await fetchSiteSettings();
    if (settings) {
      setTitle(settings.site_title || config.app.name);
      setSubtitle(settings.site_subtitle || config.app.subtitle);
      setAccent(resolveAccent(settings));
      setShell(normalizeShell(settings.shell_layout));
      setPalette(normalizePalette(settings.theme_palette));
      setHasLogo(!!settings.has_logo);
      setLogoTick((t) => t + 1);
    }
  };

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply accent + palette as CSS variables on the document root so the page
  // background (on <html>) and every component pick them up.
  useEffect(() => {
    const root = document.documentElement;
    const vars = { ...accentVars(accent), ...paletteVars(palette) };
    for (const [key, val] of Object.entries(vars)) {
      root.style.setProperty(key, val);
    }
  }, [accent, palette]);

  // Keep the browser tab title in sync with the site title.
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);

  // Use the uploaded logo as the browser tab favicon when present.
  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) return;
    if (hasLogo) {
      link.removeAttribute('type');
      link.href = logoUrl(logoTick);
    } else {
      link.setAttribute('type', 'image/svg+xml');
      link.href = '/favicon.svg';
    }
  }, [hasLogo, logoTick]);

  const routes = (
    <Routes>
      <Route path="/" element={<DirectoryPage />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/admin" element={<AdminPage onSettingsSaved={loadSettings} />} />
    </Routes>
  );

  return (
    <BrowserRouter>
      {shell === 'topbar' ? (
        <div className="topbar-app">
          <header className="topbar">
            <div className="topbar-inner">
              <div className="topbar-brand">
                {hasLogo
                  ? <img className="brand-logo" src={logoUrl(logoTick)} alt="" />
                  : <span className="brand-mark" aria-hidden="true" />}
                <div className="brand-text">
                  <strong>{title}</strong>
                  {subtitle ? <span>{subtitle}</span> : null}
                </div>
              </div>
              <nav className="topbar-nav" aria-label="Primary">
                <NavLink to="/" end className={topNavClass}>Directory</NavLink>
                {user?.role === 'admin' ? <NavLink to="/admin" className={topNavClass}>Admin</NavLink> : null}
                {!user ? <NavLink to="/login" className={topNavClass}>Log in</NavLink> : null}
                {user ? <button type="button" className="topbar-link" onClick={onLogout}>Log out</button> : null}
              </nav>
            </div>
          </header>
          <div className="topbar-content">{routes}</div>
        </div>
      ) : (
        <main className="app-shell">
          <div className="app-glow app-glow-left" aria-hidden="true" />
          <div className="app-glow app-glow-right" aria-hidden="true" />

          <section className="app-frame">
            <header className="hero">
              {hasLogo ? <img className="hero-logo" src={logoUrl(logoTick)} alt="" /> : null}
              <p className="hero-kicker">Web Portal</p>
              <h1>{title}</h1>
              <p className="hero-copy">{subtitle}</p>
            </header>

            <nav className="app-nav" aria-label="Primary">
              <NavLink to="/" end className={heroNavClass}>Directory</NavLink>
              {user?.role === 'admin' ? <NavLink to="/admin" className={heroNavClass}>Admin</NavLink> : null}
              {!user ? <NavLink to="/login" className={heroNavClass}>Log in</NavLink> : null}
              {user ? <button type="button" className="app-nav-link" onClick={onLogout}>Log out</button> : null}
            </nav>

            {routes}
          </section>
        </main>
      )}
    </BrowserRouter>
  );
}
