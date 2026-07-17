# Devtools

Developer-only tooling for the Dynamic Link Directory portal. **Not part of the
shipped app** — nothing here is bundled or deployed.

## Playwright UX/UI smoke tests

Renders the real pages against a running server, asserts the copy/behaviour we
care about, and drops full-page screenshots into `screenshots/` for a human to
review.

### Prerequisites

The portal must be running locally first (from the repo root):

```bat
run.bat
```

or just the backend if the frontend is already built:

```bat
npm --prefix Backend start
```

It defaults to `http://localhost:9008`. If yours differs, set `BASE_URL`.

### Setup (once)

```bash
cd Devtools
npm install
npm run install:browser   # downloads the Chromium build Playwright drives
```

### Run

```bash
cd Devtools
npm test                        # against http://localhost:9008
BASE_URL=http://localhost:3000 npm test   # custom port
```

Screenshots land in `Devtools/screenshots/`. Test artifacts (traces, reports)
land in `Devtools/test-results/`. Both are git-ignored.

### What it checks

- **Login card copy** — the eyebrow is a contextual label (`Account` / `Admin` /
  `Private`), not a third "Sign in", and the primary button is full-width.
- **Login destination** — signing in lands on the directory, never `/admin`.
- **Classic-shell hero** — a long site title wraps to a readable number of lines
  (rewrites `/api/settings` in the browser only; the database is never touched).
- **Least privilege** — the admin "New user" form defaults to **Viewer**.

The admin-form check signs in with `admin` / `admin123`; if that account's
password has been changed it skips cleanly rather than failing.
