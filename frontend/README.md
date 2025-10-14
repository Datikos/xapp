```markdown
# frontend (Angular)

This directory contains the Angular frontend app.

Quick start
1. From repo root:
   - npm run install:frontend

2. Run dev server:
   - npm run start:frontend
   - By default the app runs at http://localhost:4200

Build
- From the repo root:
  - npm run build:frontend
- Or directly inside `frontend`:
  - npm install
  - npm run build

Proxying API requests
- To forward API requests to a backend (e.g. http://localhost:3000), use a proxy file:
  - Serve with: `ng serve --proxy-config proxy.conf.json`
  - Example `proxy.conf.json` routes `/api/*` to `http://localhost:3000`.

Notes
- Node 18+ is recommended.
- This project was created with the latest Angular CLI at the time of scaffolding.
```