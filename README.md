# Dynamic Link Directory

A simple web portal for curating and browsing links. An admin organizes links into
categories and customizes how they appear; users open the directory and jump to the
links they need.

Built on a Fastify + React full-stack template: Fastify serves both the API and the
built React app as a single server.

## Features

**Public directory (`/`)**

- Links grouped into categories, each with its own icon and accent color
- Collapsible categories (each category has a configurable default-expanded state)
- Search across link titles, descriptions, URLs, and group names
- Per-link "open in new tab" behavior
- Click tracking (records how often each link is opened)

**Admin console (`/admin`)**

- Login-protected with real user accounts (sessions + hashed passwords)
- Create / edit / delete categories and links
- Drag-and-drop reordering for both categories and links
- Emoji picker for icons and a color picker for category accents
- Show/hide (active) toggles, category filter, and link search
- Editable site title and description (shown in the page header)

## Stack

- **Backend:** Fastify 5, Sequelize 6, PostgreSQL (`pg`)
- **Frontend:** React 19, React Router 7, Vite, Tailwind tooling (+ a hand-written `index.css`)
- **Auth:** opaque DB-backed session tokens, passwords hashed with Node's built-in `scrypt`
- **Runtime:** Node.js (ES modules)

## Project Structure

```text
Backend/
  app/
    plugins/        db, auth, request-logger, cron, websocket
    routes/api/     auth, settings, categories, links, public directory
  database/
    models/         categories, links, users, sessions, settings, logs
    seeds/          sample directory data + default admin user
    patches.js      idempotent additive column patches (run on boot)
    index.js        Sequelize init + sync + seed
  config.json       local config (gitignored) — DB connection, auth, logging
  config.example.json
  server.js

Frontend/
  src/
    pages/          DirectoryPage, AdminPage
    components/     EmojiPicker, ColorPicker
    config.ts       runtime config + API base URL detection
    auth.ts         token storage + authed fetch helpers
    settings.ts     site settings helpers
    types.ts
  vite.config.ts    builds into ../Backend/public/dist

run.bat             starts the backend from the repo root
```

The frontend production build outputs into `Backend/public/dist`, which Fastify serves,
so the whole app runs from the backend in production.

## Data Model

- **Category** — `name`, `description`, `icon`, `color`, `sort_order`, `default_expanded`, `is_active`
- **Link** — `title`, `url`, `description`, `icon`, `category_id` (FK), `sort_order`, `click_count`, `open_in_new_tab`, `is_active`
- **User** — `username`, `display_name`, `password_hash` / `password_salt` (scrypt), `role`, `is_active`, `last_login_at`
- **Session** — `user_id` (FK), `token`, `expires_at`
- **Setting** — `key` / `value` (site title, subtitle)

A category *has many* links; deleting a category sets its links' `category_id` to null
(the links become "Uncategorized" and appear under an "Other" group). A user *has many*
sessions (deleted in cascade).

## Setup

### 1. Install dependencies

```bash
cd Backend  && npm install
cd Frontend && npm install
```

> On Windows PowerShell, use `npm.cmd` if `npm` is blocked by execution policy.

### 2. Configure the backend

Copy the example config and fill in your database connection:

```bash
cd Backend
cp config.example.json config.json     # PowerShell: Copy-Item config.example.json config.json
```

Key fields in `config.json`:

- `database.enabled` — must be `true`
- `database.connection` — host, port, username, password, database
- `database.connection.schemas.project` — the Postgres schema to use (e.g. `dld_dev`)
- `auth.session_ttl_hours` — how long a login lasts (default 168 = 7 days)
- `auth.default_admin` — seeded on first run if no users exist

> **`database.sync.alter` must stay `false`.** This Postgres setup trips a Sequelize
> `describeTable` bug when `alter` is on, which crashes the server at boot. New tables are
> created by `sync`; new columns are added by the idempotent `database/patches.js` step.

### 3. Build the frontend

```bash
cd Frontend
npm run build      # outputs to Backend/public/dist
```

### 4. Run

```bash
cd Backend
npm run dev        # or: npm start   (or double-click run.bat from the repo root)
```

Open `http://localhost:3000`. The first boot creates the schema, the tables, seeds
sample categories/links, and seeds the default admin user.

### Reset sample data

```bash
cd Backend
npm run db:reset-seed
```

## Admin Access

The first boot seeds an admin account from `config.auth.default_admin`
(default username `admin`, password `admin123`).

> **Change the default password** before using this beyond a trusted local network.
> The session token is stored in the browser's `localStorage`; for public deployment,
> move to HTTPS and consider secure cookies.

Go to `/admin`, sign in, and manage the directory.

## API

All responses use the envelope `{ ok: boolean, data?, message? }`.

### Public

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Service health check |
| GET | `/api/meta` | App metadata |
| GET | `/api/settings` | Site title/subtitle (merged with defaults) |
| GET | `/api/directory` | Active categories (ordered) with their active links |
| POST | `/api/links/:uuid/click` | Increment a link's click counter |
| POST | `/api/auth/login` | Log in → `{ token, expires_at, user }` |

### Admin (require `Authorization: Bearer <token>`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Invalidate the current session |
| PUT | `/api/settings` | Update site title/subtitle |
| GET/POST | `/api/categories` | List / create categories |
| PATCH/DELETE | `/api/categories/:uuid` | Update / delete a category |
| POST | `/api/categories/reorder` | Reorder by `{ order: [uuid, ...] }` |
| GET/POST | `/api/links` | List / create links (filters: `?category_id=`, `?active=`) |
| PATCH/DELETE | `/api/links/:uuid` | Update / delete a link |
| POST | `/api/links/reorder` | Reorder by `{ order: [uuid, ...] }` |

## Notes

- When `database.enabled` is `false`, the server still boots and serves the frontend,
  but DB-backed routes return a 503 with setup guidance.
- The frontend auto-detects the API base URL from its own origin, so no URL config is
  needed when the backend serves the frontend. Set `api.base_url` in
  `Frontend/public/config.json` only for cross-origin setups.
- `AI_CarryOn.md` holds the current project state and gotchas for the next contributor.
