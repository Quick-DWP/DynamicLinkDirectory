import { logout, useAuth } from '../auth';

// Shown to a signed-in account that has no access role. They can see nothing
// but this message and a way to sign out.
export default function Unauthorized() {
  const { user } = useAuth();
  return (
    <section className="page-stack">
      <article className="panel login-card">
        <p className="eyebrow">Access</p>
        <h2>Not authorized</h2>
        <p className="muted-copy">
          You’re signed in{user?.display_name ? ` as ${user.display_name}` : ''}, but your account
          isn’t authorized to use this portal yet. Please contact an administrator to request access.
        </p>
        <div className="button-row">
          <button type="button" className="primary-btn login-submit" onClick={() => void logout()}>Sign out</button>
        </div>
      </article>
    </section>
  );
}
