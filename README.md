# CogniFleet

AI-assisted fleet management for dispatch managers and drivers.

- **Backend** — FastAPI + SQLAlchemy + SQLite (optional OpenAI integration)
- **Frontend** — React 19 + TypeScript + Vite + Tailwind

---

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env        # then set SECRET_KEY (see below)

uvicorn app.main:app --reload --port 8000
```

Interactive API docs: <http://localhost:8000/docs>

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` and `/ws` to the backend on
port 8000 (see `frontend/vite.config.ts`), so the browser only ever talks to a
single origin.

### Demo accounts

Demo data is only seeded when `SEED_DEMO_DATA=true` (default outside
production). The seed creates two isolated tenants:

| Role    | Username  | Password | Notes                          |
| ------- | --------- | -------- | ------------------------------ |
| Manager | `admin`   | `admin`  | Tenant A (John, Marcus)        |
| Manager | `manager` | `admin`  | Tenant B (Emily, Robert, Lisa) |
| Driver  | `driver1` | `driver` | Tenant A driver                |
| Driver  | `driver2` | `driver` | Tenant B driver                |

> These credentials are for local demos only. Disable `SEED_DEMO_DATA` and
> rotate accounts before exposing the app.

---

## Configuration

All configuration is read from the environment. See `backend/.env.example`.

| Variable                       | Default                       | Purpose                                                        |
| ------------------------------ | ----------------------------- | -------------------------------------------------------------- |
| `SECRET_KEY`                   | *(none)*                      | JWT signing key. **Required** when `ENVIRONMENT=production`.    |
| `ENVIRONMENT`                  | `development`                 | Set to `production` to fail closed on `SECRET_KEY`.            |
| `ACCESS_TOKEN_EXPIRE_MINUTES`  | `480`                         | Token lifetime.                                                |
| `DATABASE_URL`                 | `sqlite:///./fleet.db`        | SQLAlchemy database URL.                                       |
| `CORS_ORIGINS`                 | `http://localhost:5173,...`   | Comma-separated allowed browser origins. Never `*`.            |
| `SEED_DEMO_DATA`               | `true` (outside production)   | Seed demo tenants on an empty database.                        |
| `OPENAI_API_KEY`               | *(none)*                      | Enables live AI answers; falls back to heuristics when unset.  |

Generate a secret with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

For a production build, point the frontend at the API with `VITE_API_BASE`
(see `frontend/src/config.ts`); by default it uses same-origin relative URLs.

---

## Testing

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

The suite spins up an isolated throwaway database and covers authentication,
multi-tenant isolation, the trip lifecycle and the completion pipeline.

```bash
cd frontend
npm run build     # type-check (strict) + production build
npm run lint
```

---

## Project structure

```
backend/
  app/
    main.py         # app factory: CORS, routers, lifespan, WebSocket
    config.py       # environment-driven settings
    security.py     # password hashing, JWT, auth dependencies
    access.py       # tenant/ownership guards for resources
    seed.py         # opt-in demo data
    routers/        # one module per domain (auth, trips, vehicles, ...)
    automation.py   # event pipelines (assignment, completion, alerts)
    ai_service.py   # intelligence feed + assistant (tenant-scoped)
  tests/            # pytest API + security tests
frontend/
  src/
    config.ts       # API base + authenticated WebSocket URL
    App.tsx         # app shell, data context, realtime channel
    pages/          # feature screens
    components/     # shared UI
```

---

## Security model

- Every `/api/*` route requires a valid JWT except registration/login and the
  health check. There is no anonymous access to fleet data.
- Managers only ever see and mutate their **own** drivers, vehicles, trips,
  warehouses, invoices, alerts, PODs and automation logs. Drivers can only act
  on trips assigned to them.
- Passwords are hashed with PBKDF2-SHA256; passwords must be at least 8
  characters.
- The WebSocket channel requires a valid token (`/ws?token=...`).
- No secrets are committed. `SECRET_KEY` has no default in production.

## Hardening changes

This codebase was remediated from an earlier state. Notable fixes:

- **Broken access control** — unauth REST/WebSocket access and cross-tenant
  data leakage fixed with shared auth/ownership dependencies.
- **Hard-coded JWT secret** — replaced with `SECRET_KEY` from the environment.
- **Driver accept/reject dead route** — duplicate `/api/trips/{id}/accept`
  handlers merged so the driver flow actually runs.
- **Mileage/fuel double-counting** — the completion pipeline now applies only
  the not-yet-counted distance, and is idempotent (no duplicate invoices,
  PODs or mileage when the driver and manager flows both finalise a trip).
- **Invoice number collisions** — sequential, unique generation.
- **Stored XSS** — AI assistant markdown output is HTML-escaped.
- **Token leakage** — the frontend no longer calls a third-party agent webhook
  directly; auto-assignment goes through the backend.
- **Frontend config** — hard-coded `localhost:8000` removed in favour of a
  same-origin proxy/`VITE_API_BASE`; TypeScript `strict` enabled.
- **Repo hygiene** — removed a committed SQLite database, scratch migration
  scripts and stray lockfiles; `.env` ignored.
