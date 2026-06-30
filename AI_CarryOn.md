# AI_CarryOn.md

> Purpose: short handoff for the project being built from this template.
> Last updated: 2026-06-30

## Current Goal

**Project: Dynamic Link Directory (DLD)** — a web portal where an admin
curates a list of links organized into categories, and users browse/click them.

v1 + first refinement pass (auth, DnD, search, click tracking) are built and verified end-to-end.

## Current State

- **Domain**: `Categories` (name, description, icon, color, sort_order, is_active),
  `Links` (title, url, description, icon, category_id FK, sort_order, click_count, is_active),
  `Users` (username, display_name, password_hash/salt via scrypt, role, is_active, last_login_at),
  `Sessions` (user_id FK, token, expires_at). Category hasMany Links (delete → links' category_id null);
  User hasMany Sessions (cascade delete).
- **Auth**: full accounts. `POST /api/auth/login` → opaque bearer token (stored in `sessions`),
  `POST /api/auth/logout`, `GET /api/auth/me`, `PATCH /api/auth/password` (change own password).
  `fastify.authenticate` preHandler (app/plugins/auth.js) guards ALL `/api/categories`, `/api/links`,
  `/api/users` routes. Token sent as `Authorization: Bearer`. Default admin seeded from
  `config.auth.default_admin` (admin / admin123 — change via the in-app Account panel).
  Frontend stores token in localStorage (`dld_token`); `/admin` shows a login gate.
  **Login rate limit**: in-memory per ip+username; lock after `config.auth.login_rate_limit.max_attempts`
  (default 5) → 429 + Retry-After (window/lockout default 15 min each).
  **User management** (admin): `/api/users` CRUD (`user.route.js`); last active admin can't be
  deleted/deactivated/demoted; can't delete self. Admin UI has Account (change password) + Users panels.
  **Session cleanup**: cron (`app/plugins/cron.js`) purges expired sessions daily 03:00 + once on boot.
- **Public API** (no auth): `GET /api/directory`, `POST /api/links/:uuid/click` (increments click_count),
  `GET /api/meta`, `GET /api/health`.
- **Admin API** (auth required): `/api/categories` + `/api/links` — GET list, POST, PATCH /:uuid,
  DELETE /:uuid, POST /reorder ({ order: [uuid,...] } → assigns sort_order 1..n).
- **Site settings** (`Settings` key/value table in `dld_dev.settings`): `GET /api/settings` (public, merged
  over code defaults in setting.route.js; also returns `has_logo`), `PUT /api/settings` (admin). Keys: `site_title`,
  `site_subtitle`, `layout_theme`, `theme_color`, `shell_layout`, `theme_palette`. Rows written only on save;
  unsaved keys fall back to defaults. Frontend helpers in `Frontend/src/settings.ts` (registries + resolvers).
- **Logo**: stored as a BYTEA blob in `dld_dev.site_assets` (key `logo`, mime_type, data, size). Routes (in
  setting.route.js): `GET /api/settings/logo` (public, serves bytes with `nosniff` + sandbox CSP),
  `POST /api/settings/logo` (admin, body `{ mime_type, data(base64) }`, 5 MB cap → 413, route bodyLimit 8 MB,
  magic-byte check vs declared MIME), `DELETE /api/settings/logo` (admin). Shown center-cropped 1:1 in the
  topbar brand + classic hero (`object-fit: cover`). Admin has upload/preview/remove.
- **Link icons**: `LinkIcon` shows the link's emoji if set, else the site favicon (Google s2 service),
  falling back to 🔗. Link form validates URL format on save + warns on duplicate URLs (non-blocking).
- **Layout width**: content is full-width (the 1160px cap was removed from `.app-frame` + `.topbar-*`).
- **Theming (4 admin-selectable dimensions, all in Admin → Site settings, applied live):**
  - `shell_layout` — whole-site chrome: `classic` (hero) or `topbar` (sticky app bar). Rendered in App.tsx.
  - `layout_theme` — directory content: `cards` / `compact` / `tiles` / `single` / `sidebar`. Rendered in DirectoryPage.
  - `theme_color` — accent hex (per-layout default via `defaultColorFor`); App derives `--accent`/`--accent-deep`/`--accent-soft`.
  - `theme_palette` — ambient + surfaces: `warm`/`cool`/`mint`/`rose`/`slate`; sets `--bg`,`--glow-1/2`,`--panel`,`--card`,`--line`,`--shadow`.
  - App applies accent + palette CSS vars to `document.documentElement` so `<html>` bg and all panels/cards/pills re-theme.
    CSS surfaces use these vars (no hard-coded warm literals left except topbar light text).
- **Frontend**: `/` = DirectoryPage (public; search, collapsible categories w/ per-category `default_expanded`,
  goto icon-button per link — card body does not navigate, `open_in_new_tab` honored, click tracking via sendBeacon).
  `/admin` = AdminPage (login gate → console: site settings + visual pickers (LayoutPicker/ShellPicker/PalettePicker),
  EmojiPicker, ColorPicker, Toggle switches for booleans, DnD reorder, category filter + search, click counts, logout).
  Links MUST belong to a category (no "Uncategorized" in the form; New-link category syncs with the selected category).
  Admin feedback is scoped per section and renders under the relevant action button. "New" buttons live in the list panels.
  Native HTML5 DnD, no new deps.
- **DB**: Postgres at 192.168.100.100:54322, schema `dld_dev`. `Backend/config.json` has DB enabled.
- **Schema patches**: `Backend/database/patches.js` runs idempotent `ADD COLUMN IF NOT EXISTS`
  on boot (needed because `sync.alter` is off — see blocker below). Added this way: `links.click_count`,
  `links.open_in_new_tab`, `categories.default_expanded`. New tables (users/sessions/settings) are created by `sync`.
- **Verified 2026-06-30**: frontend build + type-check clean; auth (401/login/logout/expiry); category & link
  reorder; click_count increments; all settings (layout/color/shell/palette) round-trip via API; SPA served.

### Known blockers / risks

- **`database.sync.alter` MUST stay `false`.** On this Postgres (Supabase local, port 54322),
  Sequelize `describeTable` runs a comment subquery that errors with
  "more than one row returned by a subquery" when multiple tables share column names in one schema.
  Setting `alter: true` makes the server crash on boot. For schema changes, alter the DB manually
  or use a dedicated migration step, not Sequelize auto-alter.

### Refinement backlog

Done: full-account auth, DnD reorder, search/filter, click tracking, per-link open-in-new-tab,
per-category default-expanded, collapsible directory, site settings, selectable shell layout +
directory layout + accent color + background palette (palette also themes panel/card/border surfaces),
visual pickers, toggle switches, scoped feedback, list New buttons, category-required links.

Hardening pass done (2026-06-30): change-password + user management, login rate limiting,
logo magic-byte + sandbox-CSP hardening, expired-session purge cron, link URL validation +
duplicate warning, auto-favicon.

Still open / nice-to-have:
- **Still change the default admin password** (admin/admin123) on real deployments — now doable in-app (Account panel).
- A "Custom" palette option backed by two color pickers (presets only for now).
- Optional extra shells (e.g. left-rail sidebar) — add to `SHELL_LAYOUTS` + branch in App.tsx.
- Legacy `links.category_id = null` rows still exist (the "what" link); directory groups them as "Other".
- HTTPS/secure cookie option instead of localStorage token, if deployed beyond LAN.
- DnD across categories for links (currently reorders within the current filter only).
- Auto-favicon uses an external service (Google s2) — won't resolve internal-only hosts; consider a self-hosted/proxy option or a toggle.
- A test + CI smoke check (suggestion #8, not yet done).

Do not store long implementation history here. Put that in `AI_ProgressTracking.md`.

## Template Baseline

- `Backend/` is the Fastify backend starter.
- `Frontend/` is the React + Vite frontend starter.
- Frontend production builds output into `Backend/public/dist`.
- `run.bat` at the repository root starts the backend via `npm --prefix Backend start` — double-click or run from any terminal.
- Frontend automatically uses the current origin for API calls (no manual base URL config needed when backend serves frontend).
- Example endpoints included by default:
  - `/api/health`
  - `/api/template/meta`
  - `/api/template-items`
- Database support is optional and disabled by default in the shipped local config.
- Query log files are only created when database is enabled.

## Key Files

Update this section to reflect the real project after you begin implementation.

- `Backend/server.js`
- `Backend/config.example.json`
- `Backend/app/routes/api/template-item.route.js`
- `Backend/database/models/template_item.model.js`
- `Backend/database/seeds/seed_template_items.js`
- `Frontend/src/App.tsx`
- `Frontend/src/config.ts` — API base URL auto-detection logic
- `Frontend/src/pages/HomePage.tsx`
- `Frontend/src/pages/ExampleItemsPage.tsx`

### Planning / AI context

- `AI_CarryOn.md` = short current-state handoff for the implementing project
- `AI_ProgressTracking.md` = append-only implementation history for the implementing project
- `AI_TemplateCreation.md` = template-maintainer notes, not implementer history

## Git State

- Replace this section with the live git state of the derived project when work begins.
- Template baseline remote:
  - `origin`
  - `https://github.com/OteEnded/OteFullStackTemplate_Fastify_React.git`

## Verification State

- Replace this section with real verification notes for the derived project.
- Template baseline was verified before publication on 2026-04-17.

Notes:

- `AI_TemplateCreation.md` is intentionally ignored by git.
- `Backend/config.json` is ignored through `Backend/.gitignore`.
- Frontend build output under `Backend/public/dist/` is ignored at the root level.

## Commit Message Policy

Use a consistent commit format:

- `OteEnded[feat]: ...`
- `OteEnded[fix]: ...`
- `OteEnded[refactor]: ...`
- `OteEnded[docs]: ...`
- `OteEnded[chore]: ...`

Examples:

- `OteEnded[feat]: add initial fullstack template structure`
- `OteEnded[refactor]: replace checklist flow with generic template items`
- `OteEnded[docs]: add root template README`

Git workflow policy:

- **Do NOT add a Claude / AI `Co-Authored-By` line (or any AI attribution) to commits.** Author commits as OteEnded only.
- Do not commit automatically after every edit.
- Commit only when the user explicitly asks for a commit.
- Before committing, re-check `git status` and make sure ignored files stay out of the commit (especially `Backend/config.json` — it holds DB credentials).
- Keep `AI_CarryOn.md` (current state) and `AI_ProgressTracking.md` (chronological history) updated as work progresses.
- If the remote changes later, record it in this file for the derived project.
- Keep this file short and current.

Git state (live):

- `origin` → `https://github.com/Otenization/DynamicLinkDirectory.git`, branch `main`.
- Local git identity (repo scope): `OteEnded <ratnaritjumnong@gmail.com>`.

## Suggested Next Steps

1. Replace the example `TemplateItems` flow with the real domain.
2. Update this file with the actual current goal and implementation state.
3. Start appending detailed work history in `AI_ProgressTracking.md`.