import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { getAppConfig } from './config';
import { fetchSiteSettings } from './settings';
import DirectoryPage from './pages/DirectoryPage';
import AdminPage from './pages/AdminPage';
import './index.css';

export default function App() {
  const config = getAppConfig();
  // Hero text comes from DB-backed site settings, falling back to bundled config.
  const [title, setTitle] = useState(config.app.name);
  const [subtitle, setSubtitle] = useState(config.app.subtitle);

  const loadSettings = async () => {
    const settings = await fetchSiteSettings();
    if (settings) {
      setTitle(settings.site_title || config.app.name);
      setSubtitle(settings.site_subtitle || config.app.subtitle);
    }
  };

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BrowserRouter>
      <main className="app-shell">
        <div className="app-glow app-glow-left" aria-hidden="true" />
        <div className="app-glow app-glow-right" aria-hidden="true" />

        <section className="app-frame">
          <header className="hero">
            <p className="hero-kicker">Web Portal</p>
            <h1>{title}</h1>
            <p className="hero-copy">{subtitle}</p>
          </header>

          <nav className="app-nav" aria-label="Primary">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'app-nav-link active' : 'app-nav-link'}>
              Directory
            </NavLink>
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'app-nav-link active' : 'app-nav-link'}>
              Admin
            </NavLink>
          </nav>

          <Routes>
            <Route path="/" element={<DirectoryPage />} />
            <Route path="/admin" element={<AdminPage onSettingsSaved={loadSettings} />} />
          </Routes>
        </section>
      </main>
    </BrowserRouter>
  );
}
