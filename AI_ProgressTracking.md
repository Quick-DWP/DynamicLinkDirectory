# AI Progress Tracking

## Purpose

- This file stores detailed, chronological AI work logs for this repository.
- Use it for implementation history in the project built from this template.
- Keep long history here, not in `AI_CarryOn.md`.

## Logging Rules

- Add a new entry after each meaningful planning or implementation update.
- Keep each entry concise but specific.
- Include date, summary, files touched, decisions, and next action.
- Before writing a timestamp, get the real current local time from the terminal. On Windows PowerShell, use `Get-Date -Format "yyyy-MM-dd HH:mm:ss K"` and record the local `YYYY-MM-DD HH:mm` value from that output.
- Use newest entries at the bottom (append-only).

## Entry Template

### YYYY-MM-DD HH:mm

- Summary:
- Files touched:
- Decisions:
- Next action:

## Entries

### 2026-06-30 09:43

- Summary: Built Dynamic Link Directory v1 from the template — replaced TemplateItems with `Categories` + `Links` (Sequelize, FK with onDelete SET NULL), public `GET /api/directory`, admin CRUD + reorder, DirectoryPage + AdminPage, branding, seed data.
- Files touched: Backend models/routes/seeds/index, `config.json` (DB → `dld_dev`), Frontend App/config/types/pages, README.
- Decisions: Open admin (no auth) + separate Categories table (per user). `sync.alter` MUST stay `false` (Supabase describeTable bug crashes boot) — created tables via seed; later additive columns via `database/patches.js`.
- Next action: Refinements.

### 2026-06-30 10:30

- Summary: First refinement pass — full user-account auth (Users/Sessions, scrypt, bearer tokens, `fastify.authenticate` guarding category/link routes, default admin seed), drag-and-drop reorder, search/filter, click tracking (`links.click_count` + public click endpoint), category color accent.
- Files touched: `lib/auth.js`, `app/plugins/auth.js`, `app/routes/api/auth.route.js`, models (user/session), `patches.js`, Frontend `auth.ts` + pages.
- Decisions: DB-backed opaque session tokens; token in localStorage; click via `navigator.sendBeacon`.
- Next action: UX/theming refinements.

### 2026-06-30 11:30

- Summary: Directory UX — collapsible categories (per-category `default_expanded`), goto icon-button per link (card body no longer navigates), removed public click counter; per-link `open_in_new_tab`; emoji picker + color picker; masonry fix (`align-items`/multi-column); admin-bar layout fix; picker layout (specificity) fixes.
- Files touched: DirectoryPage, AdminPage, EmojiPicker, ColorPicker, models/patches (`open_in_new_tab`, `default_expanded`), `index.css`.
- Decisions: Clear (×) button moved inside inputs; directory uses CSS multi-column to avoid grid row gaps.
- Next action: Site-level theming + layout selection.

### 2026-06-30 12:06

- Summary: Site settings + theming system. `Settings` key/value table; `GET/PUT /api/settings`. Four admin-selectable dimensions applied live via CSS vars on `document.documentElement`: shell layout (classic/topbar), directory layout (cards/compact/tiles/single/sidebar), accent color (per-layout default), background palette (warm/cool/mint/rose/slate — now also themes panel/card/border/shadow surfaces, not just bg). Visual pickers (Layout/Shell/Palette), toggle switches replacing boolean dropdowns, scoped admin feedback rendered under the action button, "New" buttons moved to list panels, links now require a category (no Uncategorized; new-link category syncs with selected category).
- Files touched: `setting.route.js`, `settings.ts`, `App.tsx`, `DirectoryPage.tsx`, `AdminPage.tsx`, components (LayoutPicker, ShellPicker, PalettePicker, Toggle), `index.css`, `README.md`, AI docs.
- Decisions: Surfaces driven by palette vars; accent shades derived in JS; presets-only palettes (custom deferred). Commits carry NO Claude co-author (recorded in AI_CarryOn).
- Next action: Commit + push; continue refinements as requested.

### 2026-06-30 12:17

- Summary: (a) Made content full-width (removed 1160px cap on app-frame + topbar inner/content). (b) Logo upload: new `site_assets` table (BYTEA blob), `GET/POST/DELETE /api/settings/logo` (public serve / admin upload base64 with 5 MB limit + raised route bodyLimit / admin delete), `has_logo` in settings GET; logo shown center-cropped 1:1 in topbar brand + classic hero; admin upload/preview/remove control. (c) Added a warning under category "Expanded by default" when the sidebar layout is selected (it auto-expands first category by order).
- Files touched: `setting.route.js`, `models/site_asset.model.js` + `models/index.js`, `settings.ts`, `App.tsx`, `AdminPage.tsx`, `index.css`.
- Decisions: Store logo as DB blob (not filesystem) per request; base64-over-JSON upload (no multipart dep) with per-route bodyLimit 8 MB; validate mime + 5 MB server-side (413) and client-side. New table created by `sync` (no patch).
- Verified: has_logo flag, 404 before upload, upload 200 (served as image/png), 401 unauthed, 413 oversize, delete → 404. Full build/type-check clean.
- Next action: Commit + push.

### 2026-06-30 12:27

- Summary: Hardening pass started. Decoupled theme color from layout (separate commit). Then #1 — account + user management: `PATCH /api/auth/password` (verify current, min 6); admin `/api/users` CRUD (`user.route.js`) with last-active-admin protection (can't delete self, delete/deactivate/demote last admin) and duplicate-username 409. Frontend `users.ts` + auth `changePassword`; Admin gained an Account (change password) panel and a Users management section (list + editor, role, active toggle, set/reset password).
- Files touched: `auth.route.js`, `user.route.js`, `app/routes/api/index.js`, `Frontend/src/auth.ts`, `Frontend/src/users.ts`, `Frontend/src/pages/AdminPage.tsx`.
- Verified: list/create/login-as-new/duplicate-409/change-password/wrong-current-400/self-delete-400/delete-200. Build clean.
- Next action: #2 login rate-limiting.

### 2026-06-30 12:29

- Summary: #2 — login rate limiting. In-memory throttle in `auth.route.js` keyed by `ip:username`: after `max_attempts` failures within `window_minutes`, lock for `lockout_minutes` (defaults 5 / 15 / 15, configurable under `config.auth.login_rate_limit`). Returns 429 + `Retry-After`; success resets the counter; opportunistic map cleanup. Per-process (single backend).
- Files touched: `auth.route.js`, `config.json` (local), `config.example.json`.
- Verified: 5×401 then 6th→429 (Retry-After 900); a different account/key still logs in 200.
- Next action: #3 SVG logo hardening.

### 2026-06-30 12:31

- Summary: #3 — logo upload hardening. On upload, verify magic bytes match the declared MIME (`logoBytesMatch`) so an HTML/script file can't be stored as an image. On serve, add `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` so a malicious SVG can't execute scripts if opened directly. SVG stays allowed.
- Files touched: `setting.route.js`.
- Verified: valid PNG 200; HTML-as-image/png 400; valid SVG 200; GET /logo returns nosniff + sandbox CSP headers.
- Next action: #4 purge expired sessions (cron).

### 2026-06-30 12:33

- Summary: #4 — wired the cron scaffold to purge expired sessions. `purge-expired-sessions` job (daily 03:00) deletes `sessions` where `expires_at < now`; also sweeps once on `onReady`. Jobs start on ready / stop on close via cronManager.
- Files touched: `app/plugins/cron.js`.
- Verified: inserted an expired session row, booted → log "Purged 1 expired session(s)", row count 0 after boot.
- Next action: #7 URL validation + duplicate-link warning.

### 2026-06-30 12:35

- Summary: #7 — link form URL validation + duplicate warning. `isValidHttpUrl` (parseable http/https, hostname must have a dot or be localhost/IP) blocks save with a clear message. `normalizeUrl` powers a live, non-blocking "⚠ '<title>' already uses this URL" hint under the URL field (excludes the link being edited).
- Files touched: `Frontend/src/pages/AdminPage.tsx`.
- Verified: build/type-check clean.
- Next action: #10 auto-favicon for links.

### 2026-06-30 12:36

- Summary: #10 — auto-favicon. New `LinkIcon` component: shows the link's custom emoji if set, else the site favicon via Google s2 (`https://www.google.com/s2/favicons?domain=<host>&sz=64`), falling back to 🔗 on load error. Used in all directory layouts (cards/compact/tiles). Note: relies on an external favicon service and won't resolve internal-only hosts.
- Files touched: `Frontend/src/components/LinkIcon.tsx`, `DirectoryPage.tsx`, `index.css`.
- Verified: build/type-check clean.
- Next action: hardening/quality batch (1,2,3,4,7,10) complete.

### 2026-06-30 13:13

- Summary: Roles + configurable view-login. Auth plugin now exposes three guards: `authenticate` (any active user), `requireAdmin` (role==='admin' else 403), `gateView` (requires login only when the `require_login` setting is 'true'). All management APIs (categories, links, users, settings PUT, logo POST/DELETE) moved to `requireAdmin`; `GET /api/directory` uses `gateView`. New `require_login` setting (default 'false'). Frontend: shared `LoginGate` component (extracted from AdminPage); Directory shows the gate when login is required and sends the bearer token; AdminPage shows a "no admin access" screen for non-admin users; Site settings gained a "Require login to view" toggle; user editor role is now an admin/viewer select. `fetchSiteSettings` coerces `require_login` to boolean.
- Files touched: `app/plugins/auth.js`, `category/link/user/setting` routes, `api/index.js`, `Frontend/src/components/LoginGate.tsx` (new), `settings.ts`, `auth`-consumers, `DirectoryPage.tsx`, `AdminPage.tsx`.
- Verified: viewer→403 on manage / admin→200; require_login off → directory 200 no token; on → 401 no token, 200 with viewer token; settings stay public; viewer login works; cleanup ok.
- Next action: as directed.

### 2026-06-30 13:27

- Summary: (fix) `authedFetch` only sets `Content-Type: application/json` when a body is present — Fastify was rejecting empty-body JSON requests, which broke all DELETE/logout calls ("Body cannot be empty…"). (feat) Admin console is now tabbed (Site settings / Categories / Links / Users / Account) so admins don't scroll; header bar + global feedback stay above the tabs; default tab Categories.
- Files touched: `Frontend/src/auth.ts`, `Frontend/src/pages/AdminPage.tsx`, `Frontend/src/index.css`.
- Verified: reproduced empty-body-JSON 400 then confirmed no-Content-Type DELETE reaches the route; build/type-check clean.
- Next action: as directed.

### 2026-06-30 13:40

- Summary: (feat) Header Log out + role-aware nav. Centralized auth in a shared store (`useAuth`/`refreshAuth` in auth.ts; login/logout/401 update it). Header shows Log out when signed in and the Admin link only for role 'admin'. AdminPage now consumes `useAuth` (removed its own fetchMe/user state + the in-console Log out); LoginGate `onLoggedIn` optional.
- Files: `auth.ts`, `App.tsx`, `AdminPage.tsx`, `components/LoginGate.tsx`, `index.css`.

### 2026-06-30 13:43

- Summary: (feat) Delete confirmation modals for category/link/user via reusable `ConfirmModal`. Category delete now CASCADES: backend deletes the category's links in a transaction and returns `removed_links`; the modal warns how many links will be deleted (or that there are none). Success message reports the count.
- Files: `components/ConfirmModal.tsx` (new), `AdminPage.tsx`, `index.css`, `Backend/app/routes/api/category.route.js`.
- Verified: temp category + 2 links → delete returns removed_links:2, links gone. Build/type-check clean.
- Next action: as directed.

### 2026-06-30 13:48

- Summary: (fix) Hiding the Admin nav for non-admins had also hidden it from logged-out users, removing the only login entry point. Header now shows a "Log in" link when signed out, "Admin" only for admins, "Log out" when signed in.
- Files: `Frontend/src/App.tsx`.
- Next action: as directed.

### 2026-06-30 13:50

- Summary: (#1) Browser tab now reflects site settings — `document.title` syncs to `site_title`, and the tab favicon uses the uploaded logo when present (falls back to /favicon.svg).
- Files: `Frontend/src/App.tsx`.

### 2026-06-30 13:52

- Summary: (#2 data cleanup) Deleted the orphaned legacy "what" link (null category) via the admin API (bounded delete by uuid; raw SQL mass-delete was blocked by the safety classifier). No code change. (#5) Click analytics: Links tab gained a sort control (manual order / most opened) and a "N total opens" stat; DnD reorder only when sorted by manual order with no search.
- Files: `Frontend/src/pages/AdminPage.tsx`.

### 2026-06-30 13:54

- Summary: (#6) Auto-favicon toggle. New `auto_favicon` setting (default true). When off, links without a custom emoji show 🔗 instead of fetching the external favicon (privacy / internal hosts). LinkIcon takes a `favicons` prop; DirectoryPage passes the setting; admin Site settings has a "Link favicons" toggle.
- Files: `setting.route.js`, `settings.ts`, `components/LinkIcon.tsx`, `DirectoryPage.tsx`, `AdminPage.tsx`.
- Verified: default true; PUT false persists + re-reads false; reset.

### 2026-06-30 13:56

- Summary: (#9) Added a React `ErrorBoundary` (class component) wrapping `<App>` in main.tsx; render errors now show a friendly "This page hit an error" panel with a Reload button instead of a blank screen.
- Files: `Frontend/src/components/ErrorBoundary.tsx` (new), `Frontend/src/main.tsx`.

### 2026-06-30 13:58

- Summary: (#10) Smoke test + CI. `Backend/scripts/smoke.mjs` (npm run smoke) hits /api/health, /api/meta, /api/settings and accepts /api/directory 200-or-401 (login-gated is healthy); exits non-zero on failure. GitHub Actions `.github/workflows/ci.yml` on push/PR to main: backend `npm ci` + `node --check` on all tracked .js, frontend `npm ci` + `npm run build` (tsc+vite). No DB needed — catches build/type/syntax regressions.
- Files: `Backend/scripts/smoke.mjs` (new), `Backend/package.json`, `.github/workflows/ci.yml` (new).
- Verified: smoke against a running server passes (health/meta/settings/directory 200); exit 0.
- Next action: batch (1,2,5,6,9,10) complete.

### 2026-06-30 14:02

- Summary: Removed the GitHub Actions CI workflow (`.github/workflows/ci.yml`) at the user's request. Kept the smoke test (`Backend/scripts/smoke.mjs` / `npm run smoke`) as a manual check.
- Files: deleted `.github/workflows/ci.yml`.

### 2026-07-01 14:49

- Summary: (feat) Copy-link button on directory links. New `CopyLinkButton` copies the link URL to clipboard (clipboard API + textarea fallback) and shows a green ✓ for ~1.5s. Added beside the goto button in cards/single/sidebar (wrapped in `.link-actions`) and compact rows; tiles unchanged (whole tile is the link). Styled neutral so goto stays primary.
- Files: `Frontend/src/components/CopyLinkButton.tsx` (new), `DirectoryPage.tsx`, `index.css`.

### 2026-07-01 14:50

- Summary: Added `pull-run.bat` — `git pull` then `call run.bat` (aborts if pull fails). Convenience for updating + starting the backend on a deployed Windows box.
- Files: `pull-run.bat` (new).

### 2026-07-01 14:52

- Summary: `run.bat` is now a full pipeline — installs Backend deps, installs Frontend deps, builds the frontend (→ Backend/public/dist), then starts the backend. Each step aborts on failure. Combined with `pull-run.bat`, one double-click updates + rebuilds + launches.
- Files: `run.bat`.

### 2026-07-17 14:23

- Summary: Phase 1 closed and tagged `v1.0.0`. Handoff: `origin` repointed from Otenization (personal) to the fork `https://github.com/Quick-DWP/DynamicLinkDirectory.git`; `main` + `v1.0.0` pushed there, upstream tracking set. Phase 2 development continues on the fork.
- Files: `AI_CarryOn.md`, `AI_ProgressTracking.md`.
- Pre-prod hardening still queued (not done): env-var secrets, global error handler, npm ci/start.bat + engines, CORS tightening, HTTPS/process manager (ops).

---

## Template Updates

### 2026-05-05 15:16

- Summary: Added `run.bat` at the repository root so users can start the backend from the root directory without changing directories.
- Files touched: `run.bat`, `README.md`, `AI_CarryOn.md`, `AI_ProgressTracking.md`
- Decisions: `run.bat` calls `npm --prefix Backend start`; kept it minimal so it works on any Windows machine with Node installed.
- Next action: Push the update to GitHub.

### 2026-05-05 16:52

- Summary: Fixed backend startup so query log files are only initialized when database support is enabled, and updated docs to match this behavior.
- Files touched: `Backend/server.js`, `Backend/README.md`, `README.md`, `AI_ProgressTracking.md`
- Decisions: Keep query log initialization inside the database-enabled startup branch to avoid creating unused `queries_*.log` files when DB is off.
- Next action: Commit and push the logging behavior fix.

### 2026-06-17 10:41

- Summary: Changed frontend API base URL to automatically use the current origin (window.location.origin) when config.base_url is empty, eliminating the need for manual configuration when backend serves frontend.
- Files touched: `Frontend/src/config.ts`, `Frontend/public/config.json`, `Frontend/public/config.example.json`, `Frontend/README.md`, `README.md`, `AI_ProgressTracking.md`
- Decisions: Default to same-origin API calls since this is the common case when backend serves the built frontend; allow explicit base_url override for cross-origin scenarios.
- Next action: Commit and push the dynamic API base URL feature.