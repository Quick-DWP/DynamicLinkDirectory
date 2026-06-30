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
  `POST /api/auth/logout`, `GET /api/auth/me`. `fastify.authenticate` preHandler (app/plugins/auth.js)
  guards ALL `/api/categories` and `/api/links` routes. Token sent as `Authorization: Bearer`.
  Default admin seeded from `config.auth.default_admin` (**admin / admin123 — change this**).
  Frontend stores token in localStorage (`dld_token`); `/admin` shows a login gate.
- **Public API** (no auth): `GET /api/directory`, `POST /api/links/:uuid/click` (increments click_count),
  `GET /api/meta`, `GET /api/health`.
- **Admin API** (auth required): `/api/categories` + `/api/links` — GET list, POST, PATCH /:uuid,
  DELETE /:uuid, POST /reorder ({ order: [uuid,...] } → assigns sort_order 1..n).
- **Frontend**: `/` = DirectoryPage (public; search box, click tracking via sendBeacon, category color accent),
  `/admin` = AdminPage (login gate → console with drag-and-drop reorder for categories & links,
  category filter + search, click counts, logout). Native HTML5 DnD, no new deps.
- **DB**: Postgres at 192.168.100.100:54322, schema `dld_dev`. `Backend/config.json` has DB enabled.
- **Schema patches**: `Backend/database/patches.js` runs idempotent `ADD COLUMN IF NOT EXISTS`
  on boot (needed because `sync.alter` is off — see blocker below). `click_count` was added this way.
- **Verified 2026-06-30**: frontend build + type-check clean; unauthed writes blocked (401);
  login/logout/session-expiry work; category reorder persists; click_count increments; SPA served.

### Known blockers / risks

- **`database.sync.alter` MUST stay `false`.** On this Postgres (Supabase local, port 54322),
  Sequelize `describeTable` runs a comment subquery that errors with
  "more than one row returned by a subquery" when multiple tables share column names in one schema.
  Setting `alter: true` makes the server crash on boot. For schema changes, alter the DB manually
  or use a dedicated migration step, not Sequelize auto-alter.

### Refinement backlog

Done in first refinement pass: full-account auth, drag-and-drop reorder, search/filter,
click tracking, category color accent.

Still open / nice-to-have:
- **Change the default admin password** (admin/admin123) and ideally add a user-management UI.
- Periodic cleanup of expired rows in `sessions` (currently only purged lazily on use).
- `GET /api/links/:uuid` single-fetch route does not exist (only list/patch/delete) — add if needed.
- HTTPS/secure cookie option instead of localStorage token, if deployed beyond LAN.
- DnD across categories for links (currently reorders within the current filter only).

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

- Do not commit automatically after every edit.
- Commit only when the user explicitly asks for a commit.
- Before committing, re-check `git status` and make sure ignored files stay out of the commit.
- If the remote changes later, record it in this file for the derived project.
- Keep this file short and current.

## Suggested Next Steps

1. Replace the example `TemplateItems` flow with the real domain.
2. Update this file with the actual current goal and implementation state.
3. Start appending detailed work history in `AI_ProgressTracking.md`.