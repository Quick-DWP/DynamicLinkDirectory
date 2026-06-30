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

No implementation entries yet.

When a real project starts from this template, append entries here.

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