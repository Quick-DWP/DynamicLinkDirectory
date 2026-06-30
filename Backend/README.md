# Backend

Reusable Fastify backend for the full-stack template.

## What It Does

- Boots a Fastify server with plugin-based registration.
- Serves the built frontend from `public/dist`.
- Exposes a small example API under `/api/template-items`.
- Keeps database support optional through `config.json`.
- Preserves logging, cron, websocket, and Sequelize starter structure from the original Fastify template.

## Run

```bash
npm install
npm run dev
```

PowerShell note:

- If `npm` is blocked on Windows by execution policy, run `npm.cmd install` and `npm.cmd run dev` instead.

Production start:

```bash
npm run start
```

## Config

- Local runtime file: `config.json`
- Shared example file: `config.example.json`

Main sections:

- `app.port`: Fastify port
- `logging`: message, request, and Sequelize query logging
	- Query log files are only initialized when `database.enabled` is `true`
- `database.enabled`: turn DB integration on or off
- `database.sync`: Sequelize sync behavior
- `database.seed.force_template_items_sync`: force the example seed set

## API

- `GET /api/health`
- `GET /api/template/meta`
- `GET /api/template-items`
- `POST /api/template-items`
- `PATCH /api/template-items/:id`

## Database Notes

- When `database.enabled` is `false`, the server still runs and serves the frontend.
- When `database.enabled` is `false`, query log files are not created.
- DB-backed example routes return setup guidance until the database is enabled and configured.
- The example model is `TemplateItems`, intended to be replaced by your real project models.

Reset and reseed the example table:

```bash
npm run db:reset-seed
```

## Frontend Integration

- Vite builds into `Backend/public/dist`.
- Any non-API route falls back to the frontend `index.html`.
- This lets Fastify serve both API and production frontend from one deployable backend.
