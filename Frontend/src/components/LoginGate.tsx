import { useEffect, useState } from 'react';
import { login, type AuthUser } from '../auth';
import { fetchAzureConfig, startAzureLogin } from '../azure';

type Props = {
  onLoggedIn?: (user: AuthUser) => void;
  heading?: string;
  subtext?: string;
};

export default function LoginGate({ onLoggedIn, heading = 'Sign in', subtext = 'Enter your credentials to continue.' }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [azureEnabled, setAzureEnabled] = useState(false);

  useEffect(() => {
    void fetchAzureConfig().then((c) => setAzureEnabled(!!c.enabled));
    const stashed = sessionStorage.getItem('msLoginError');
    if (stashed) {
      setError(stashed);
      sessionStorage.removeItem('msLoginError');
    }
  }, []);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const u = await login(username.trim(), password);
      onLoggedIn?.(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page-stack">
      <article className="panel login-card">
        <p className="eyebrow">Sign in</p>
        <h2>{heading}</h2>
        <p className="muted-copy">{subtext}</p>

        {error ? <p className="message error">{error}</p> : null}

        <label className="field"><span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label className="field"><span>Password</span>
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

        {azureEnabled ? (
          <>
            <div className="login-divider">or</div>
            <button type="button" className="secondary-btn ms-btn" onClick={() => void startAzureLogin()}>
              <svg viewBox="0 0 23 23" width="16" height="16" aria-hidden="true">
                <rect x="1" y="1" width="10" height="10" fill="#f25022" />
                <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
                <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
                <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
              </svg>
              Continue with Microsoft
            </button>
          </>
        ) : null}
      </article>
    </section>
  );
}
