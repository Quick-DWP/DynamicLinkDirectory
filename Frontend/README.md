# Frontend

Reusable React + Vite frontend for the full-stack template.

## What It Does

- Loads runtime config from `public/config.json` with fallback to `public/config.example.json`.
- Uses React Router for a small starter UI.
- Includes Tailwind CSS in the frontend toolchain through PostCSS.
- Talks to the Fastify backend example API.
- Builds directly into `../Backend/public/dist` for Fastify to serve.

Current styling note:

- The shipped example UI is styled mostly through `src/index.css`.
- Tailwind CSS is configured and available if you want to use utility classes in the next project.

## Run

```bash
npm install
npm run dev
```

PowerShell note:

- If `npm` is blocked on Windows by execution policy, run `npm.cmd install`, `npm.cmd run dev`, and `npm.cmd run build` instead.

Build for backend hosting:

```bash
npm run build
```

## Starter Pages

- `/`: template overview and runtime status
- `/items`: small CRUD-style example wired to the backend template item API

## Config

Runtime config shape:

```json
{
  "app": {
    "name": "FullStack Template",
    "subtitle": "Fastify serves the React build and optional DB-backed API examples."
  },
  "api": {
    "base_url": ""
  }
}
```

**API base URL behavior:**

- When `api.base_url` is empty (default), the frontend automatically uses the current origin (the domain it was loaded from) for API calls.
- This works seamlessly when the backend serves the frontend, as the API and frontend share the same origin.
- Set `api.base_url` explicitly only if you need cross-origin API calls (e.g., frontend on `app.example.com` calling API at `api.example.com`).