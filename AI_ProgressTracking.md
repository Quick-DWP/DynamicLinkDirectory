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

### 2026-07-17 15:16 — Phase 2: Microsoft (Azure AD) sign-in

- Summary: Added MSAL redirect login. Backend: `lib/azure.js` verifies MS ID token (jose + JWKS, issuer/audience checks); `GET /api/auth/azure-config` (public SPA ids), `POST /api/auth/azure-login` (verify → match `users.email` case-insensitively → issue session; 403 if unprovisioned, 401 on bad token). Users gained `email` (nullable) and password is now optional (MS-only accounts) — via model + idempotent patches (ADD email, DROP NOT NULL on password_hash/salt). Users API: email in create/patch with case-insensitive uniqueness; create requires password OR email. Frontend: `src/azure.ts` (MSAL PublicClientApplication, loginRedirect, handleRedirectPromise), `azureLogin` in auth.ts, main.tsx handles the redirect return, LoginGate shows "Continue with Microsoft", admin user editor has an Email field.
- Config: `config.auth.azure { enabled, tenant_id, client_id, audience }` — tenant/client only, **no client secret** (the SPA/ID-token flow doesn't need it; the shared secret should be rotated/deleted in Entra).
- Entra setup: register the app **origin** as a **SPA** redirect URI (MSAL uses redirectUri = window.location.origin); leave implicit-grant checkboxes off.
- Deps: backend `jose`, frontend `@azure/msal-browser` (bundle grew ~230 KB).
- Verified: boot + 6 patches clean; azure-config returns ids; azure-login no-token 400 / bad-token 401; password login OK; MS-only user (email, no password) created; neither-provided 400; duplicate email (diff case) 409. Live MS redirect + the 403-not-authorized path need a real browser sign-in with the Entra SPA redirect URI configured.
- Next action: user provisions their MS email as an admin user, configures the Entra SPA redirect URI, and tests the live "Continue with Microsoft" flow.

### 2026-07-17 15:20 — Azure JIT provisioning

- Summary: Changed azure-login from "must be pre-provisioned (403)" to just-in-time provisioning: an unknown Microsoft sign-in is auto-created as a **viewer** — username = email (uniqued if collision), display_name from the token `name` claim, email set, password null. Existing users keep their role. New config flag `azure.auto_provision` (default true; set false to restore the 403 behavior). Single-tenant app registration means only the QT tenant can authenticate, which is the access boundary.
- Files: `auth.route.js`, `config.json` (local), `config.example.json`, AI docs.
- Verified: no regression — bad token 401, password login 200, azure-config enabled. (Live JIT create needs a real MS sign-in.)
- Note: app port changed locally to 9008 → Entra SPA redirect URI must be `http://localhost:9008` (origin follows the port).
- Next action: configure Entra SPA redirect URI for the running origin; test live MS login (first sign-in should auto-create a viewer).

### 2026-07-17 15:39 — Azure login UX fixes

- Summary: (a) MSAL redirect URI must be registered as **SPA** (not Web) — that was the "couldn't sign you in" cause; code was fine. (b) Land on directory after MS sign-in via `handleRedirectPromise({ navigateToLoginRequestUrl: false })` (v5 moved the flag to the call) + replaceState('/'). (c) Hardened main.tsx so a failed MS exchange never blank-screens (guard + 8s timeout, clears stale ?code). (d) Directory now reacts to auth (`useAuth`) — logout re-gates it when require_login is on. (e) Added a neutral `/login` route (not the admin gate); header "Log in" → /login → lands on '/'. (f) Made the "Sign in" button full-width to match "Continue with Microsoft".
- Files: `azure.ts`, `main.tsx`, `App.tsx`, `pages/DirectoryPage.tsx`, `components/LoginGate.tsx`, `index.css`.
- Next action: optional `azure.admin_emails` auto-elevation so the first MS admin doesn't need a manual bump.

### 2026-07-17 — UX/UI sanity pass

- Summary: Reviewed the app for UX that doesn't make sense and fixed: (a) login card no longer reads "Sign in / Sign in / Sign in to continue" — the eyebrow is now a contextual label (`Account` / `Admin` / `Private`) via a new `eyebrow` prop on `LoginGate`; (b) "New user" in Admin now defaults to **Viewer** instead of Admin (least-privilege; matches MS JIT provisioning); (c) empty-directory message is role-aware — viewers see "No links have been added yet." instead of being told to use the Admin page they can't reach; (d) classic-shell hero `<h1>` relaxed (`max-width` 11ch→20ch, `line-height` 1→1.05, slightly smaller clamp) so the long rebranded title no longer wraps into a cramped, colliding column; (e) username field autofocuses on the login form.
- Files: `components/LoginGate.tsx`, `App.tsx`, `pages/AdminPage.tsx`, `pages/DirectoryPage.tsx`, `index.css`.
- Also fixed (surfaced by the Playwright screenshots): MS-provisioned accounts (username = email) showed a double `@` in the Admin user list (`@ratnarit@quick-transformation.com`); the handle now drops the leading `@` when the username is an email.
- Added `Devtools/` — a Playwright UX/UI smoke harness (not shipped; `Devtools/{node_modules,test-results,playwright-report,screenshots}` are git-ignored). 5 tests: login-card copy (`/login`, admin gate, private gate), classic-shell long-title wrap (rewrites `/api/settings` in-browser only — no DB write), and admin "New user" defaulting to Viewer + login landing on the directory. Run: `cd Devtools && npm i && npm run install:browser && npm test` against a running portal (`BASE_URL` overridable).
- Verified: `npm run build` (tsc + vite) clean; all 5 Playwright tests green; screenshots eyeballed.

### 2026-07-17 — Admin-only link "note"

- Summary: Links now have an optional `note` — an internal remark admins can add/see in the Links editor that is **never** exposed on the public directory. DB: nullable `note TEXT` on the `links` model + idempotent `ADD COLUMN IF NOT EXISTS "note" TEXT` patch (sync.alter stays false). API: `POST/PATCH /api/links` accept `note` (empty → null); admin `GET /api/links` returns it; **`GET /api/directory` excludes it** via `attributes: { exclude: ['note'] }` (defense in depth — DirectoryPage never renders it either). UI: "Note (admin only)" textarea under Description in the link editor, plus a `📝 note` pill on list cards that have one.
- Files: `Backend/database/models/link.model.js`, `Backend/database/patches.js`, `Backend/app/routes/api/link.route.js`, `Backend/app/routes/api/index.js`, `Frontend/src/types.ts`, `Frontend/src/pages/AdminPage.tsx`.
- Verified against a throwaway `PORT=9009` instance (same shared DB): 9-check API script — note saves/edits/clears, admin list returns it, directory payload has neither the `note` key nor the secret text. Added a committed Playwright regression test (`Devtools`) asserting the same + the editor field; all 6 green.
- ACTION for the running app: restart the portal (`run.bat` / `pull-run.bat`) so the new backend loads — the `note` column already exists in the DB (patch ran), but the live `:9008` server is still on the old code until restarted.

### 2026-07-20 — UX/UI audit fixes

Acted on the audit findings:
- **Dead CSS removed** (~890 lines of leftover template styles: login-select/combobox, list-table, audit-table, chip, yn, review, submit-btn, history, section-title, footer, etc.) + **consolidated the duplicate/conflicting `.field` and `.field span` rules**. CSS bundle 34.6 KB → 27.0 KB.
- **Keyboard focus**: universal `:focus-visible` accent ring across custom controls; inputs get an accent border + soft ring on focus.
- **Modal a11y**: new `useFocusTrap` hook — `AttachmentModal` and `ConfirmModal` now move focus in on open, trap Tab, close on Escape, and restore focus to the trigger on close. `ConfirmModal` is now portaled to `document.body` too.
- **Tiles layout**: links with attachments now show a 📎-count corner badge that opens the preview modal (previously unreachable in Tiles). `link-tile-wrap` + `.tile-attach`.
- **Sidebar layout**: the category menu column no longer stretches to full height (was a big empty navy block with few categories) — `align-self: start` + rounded left edge.
- **EmojiPicker**: closes on Escape.
- **Admin header**: tab-aware subtitle (no more "drag cards to reorder" on Settings/Account); Refresh shown only on list tabs (categories/links/users).
- **Attachment upload**: per-file progress label ("Uploading 2/3…") instead of a static "Working…".
- Verified with Playwright (10/10) + screenshots of tiles/sidebar/forms. Files: `index.css`, `useFocusTrap.ts` (new), `components/{AttachmentModal,ConfirmModal,EmojiPicker,AttachmentManager}.tsx`, `pages/{AdminPage,DirectoryPage}.tsx`, `Devtools/tests/ux.spec.js`.

### 2026-07-17 — Fix: non-ASCII attachment names + modal position

- Bug: attachments with non-Latin filenames (e.g. Thai PDF) never previewed/downloaded — the raw endpoint put the raw name in `Content-Disposition`, and Node aborts the response on non-ASCII header values (fetch "terminated"). Fix: send an ASCII-sanitized `filename="…"` plus RFC 5987 `filename*=UTF-8''<pct-encoded>` for the real name. Also dropped the redundant manual `Content-Length` (Fastify sets it from the buffer). Verified the 261 KB Thai PDF now returns 200 with all bytes.
- Bug: the attachment modal opened from the admin editor appeared pinned to the bottom / off-screen. Cause: it rendered inside a `.panel` that has `backdrop-filter`, which becomes the containing block for `position: fixed`, so the overlay centered within the tall panel instead of the viewport. Fix: `AttachmentModal` now renders through `createPortal(…, document.body)`, so it always centers on the viewport (viewer + admin). Playwright asserts the overlay is viewport-pinned.
- Files: `Backend/app/routes/api/attachment.route.js`, `Frontend/src/components/AttachmentModal.tsx`, `Devtools/tests/ux.spec.js`. 10/10 green.

### 2026-07-17 — Nullable role + domain-gated Microsoft provisioning + unauthorized screen

- `role` is now nullable (model `allowNull: true`; patch drops NOT NULL + default 'admin'). null = "no access".
- Microsoft JIT: new sign-ins get `viewer` only if their email domain matches `auth.azure.auto_provision_domain` (comma-separated allowed; set to `quick-transformation.com` in the Quick-DWP config). Others are still created (so admins can grant access later) but with **no role**. If the domain isn't configured, behaviour is unchanged (all sign-ins become viewers) — backward compatible.
- Authorization: `gateView` now 403s an authenticated account whose role isn't admin/viewer (directory + attachments). `requireAdmin` already blocks them. A role-less, signed-in user sees a dedicated **"Not authorized — contact an administrator"** screen (`Unauthorized.tsx`); the whole app short-circuits to it and the nav shows only Log out. `isAuthorized()` helper in `auth.ts`; `AuthUser.role`/`AdminUser.role` now `string | null`.
- Admin Users editor: role select gained a **"No access (unauthorized)"** option; the list shows `no access` for null-role accounts. Create/patch store an empty role as null.
- Verified on `PORT=9009`: 12-check API script (null role stored, no-role can log in but 403 on directory/attachments/admin, admin grant→200, revoke→403) + Playwright unauthorized-screen test. 10/10 green.
- CONFIG (gitignored, not committed): `Backend/config.json` gained `auth.azure.auto_provision_domain: "quick-transformation.com"`. Restart the portal to apply.

### 2026-07-17 — Admin routing + save-keeps-selection + modal preview + UX pass

- Admin tabs are now real routes (`/admin/:tab`; `/admin` redirects to `/admin/categories`). Refresh and deep links land on the same section. Driven by `useParams`/`useNavigate` in `AdminPage`; unknown slugs redirect to categories. SPA fallback already serves `index.html` for deep links.
- Editors no longer clear on save: saving a link / category / user now re-selects the saved record (using the API's returned row) instead of resetting to a blank "New" form. Creating a record keeps you on it (and for links, reveals the attachments panel immediately).
- Admin attachment "View" now opens the in-page preview modal (reused `AttachmentModal` with a new `initialUuid` prop) instead of a raw new tab.
- Devtools: admin password no longer hardcoded — the suite reads `DLD_ADMIN_USER`/`DLD_ADMIN_PASS` (defaults to the template dev creds). Added tests for save-keeps-selection and admin-tab routing; extended the attachments test to cover the admin View modal. Login helper hardened (per-key delay + fill fallback + wait-for-enabled) against the autofocus race. 9/9 green (run with `DLD_ADMIN_PASS=… BASE_URL=… npx playwright test`).
- Files: `App.tsx`, `pages/AdminPage.tsx`, `components/AttachmentModal.tsx`, `components/AttachmentManager.tsx`, `Devtools/tests/ux.spec.js`.

### 2026-07-17 — Per-link file attachments (+ viewer preview)

- Summary: Each link can now hold many files (spec / guideline / manual…). Admins upload/rename/delete them in the link editor; viewers open an "Attachments" button on the directory to preview or download.
- Storage: new `link_attachments` table (bytes in Postgres BYTEA, like the logo) — `uuid, rolling_id, link_id(FK→links, CASCADE), filename, mime_type, size, data(BLOB long), sort_order`. Created automatically by `sequelize.sync` (new table; no alter). Model registered + associated in `models/index.js`.
- API (`/api/attachments`): `GET /link/:linkId` (gateView, metadata only — bytes never listed), `GET /:uuid/raw` (gateView, streams bytes with `nosniff` + sandbox CSP), `POST /link/:linkId` (admin, base64 body, 25 MB cap, MIME allowlist, extension fallback, PDF magic-byte check), `PATCH /:uuid` (admin rename/reorder), `DELETE /:uuid` (admin). Link DELETE also purges attachments (belt-and-suspenders with the FK cascade). `/api/directory` now includes `attachment_count` per link (still excludes `note` + bytes).
- Preview under the login gate: the raw endpoint follows `require_login`, so an `<img>/<iframe src>` (no bearer) can't load it. Frontend fetches bytes **with the token** into a `blob:` URL — works gated or public. Inline preview for images / PDF / text; other types get a download button. Object URLs are revoked on unmount.
- Frontend: `attachments.ts` helper; `AttachmentPreview`, viewer `AttachmentModal` (list + preview + per-file download), admin `AttachmentManager` (upload/rename/delete/view). Wired: paperclip button beside copy/goto on the directory (cards + compact), manager in the admin link editor (existing links only). `types.ts` Link gains `attachment_count`. CSS in `index.css`.
- Verified on `PORT=9009`: a 20-check API script (upload, list has no bytes, raw round-trip + nosniff, directory count, sort_order, 415 for text/html, 400 for fake-PDF, rename, 401 without token, link-delete cascade, cleanup) — all pass. Playwright regression added (admin upload → viewer modal preview); 7/7 green. Screenshots eyeballed.
- ACTION: restart the portal (`pull-run.bat`) — the `link_attachments` table already exists (created on the 9009 boot), but the live server needs the new routes.

### 2026-07-17 — Added admin account

- kanokporn@quick-transformation.com created as an **admin** (Microsoft-only sign-in; username = email; display name "Kanokporn"). Data change only — no code.

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