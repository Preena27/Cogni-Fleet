# CogniFleet — System Architecture

This document describes how CogniFleet is designed: the concept, the tiers, the
data model, the backend modules, the domain workflows, the realtime layer, and
the frontend — plus the design principles and the known seams.

---

## 1. What the system is

CogniFleet is a **multi-tenant fleet-operations platform** for a trucking
business. A **Manager** (dispatcher/owner) runs a fleet of vehicles and drivers:
they create freight loads, assign them, watch them move in real time, collect
proof of delivery, and auto-generate invoices. A **Driver** receives assignments
on a mobile-style screen, accepts/rejects, reports progress/issues/SOS, and
submits proof of delivery.

The distinguishing idea is an **AI Operations Advisor**: a rule engine that
continuously reads the live database state and produces ranked recommendations
(maintenance, license expiry, load assignment, profitability, capacity) plus a
chat assistant that answers questions about the fleet — optionally upgraded to an
LLM (OpenAI) when a key is present.

Three conceptual layers:

| Layer | Responsibility |
| --- | --- |
| **Operational core** | CRUD over loads, drivers, vehicles, warehouses; the trip lifecycle state machine |
| **Automation engine** | Event pipelines that react to lifecycle events (assign/accept/breakdown/complete) and emit logs, alerts, invoices |
| **Intelligence layer** | Derives metrics, recommendations, and chat answers from the operational data |

---

## 2. Architecture (three tiers)

```
┌──────────────────────────────────────────────────────────────────────┐
│  REACT SPA  (Vite dev server :5173 / static build)                     │
│                                                                        │
│   App.tsx  ── React Context (AppContext) ── holds ALL domain data      │
│     │            │                                                     │
│     │            ├── secureFetch()  → injects Bearer JWT, handles 401  │
│     │            └── WebSocket /ws?token=…  → REFRESH_DATA / LOG events │
│     │                                                                  │
│   pages/: Dashboard, Loads, Dispatch, TrackingMap, Fleet, Drivers,     │
│           POD, Billing, Reports, Messages, Settings, DriverApp         │
│   components/: AIAssistant, CameraCapture                             │
└───────────────┬───────────────────────────────────┬──────────────────┘
                │ JSON over HTTP (same-origin /api)  │ WebSocket /ws
                ▼                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│  FASTAPI BACKEND                                                       │
│                                                                        │
│  main.py  → app, CORS, lifespan(startup: create tables + optional seed)│
│             includes routers, owns /ws, /api/health                    │
│                                                                        │
│  Dependency layer:  get_db()  ·  get_current_user()  ·  require_*()    │
│  Cross-cutting:     config.py · security.py · access.py               │
│                                                                        │
│  routers/ (domain endpoints, all tenant-scoped)                        │
│    auth · settings · vehicles · drivers · trips · warehouses ·         │
│    pods · invoices · alerts · messages · ai · system                   │
│                                                                        │
│  Domain services:                                                      │
│    automation.py  (event pipelines)   ai_service.py (intelligence)     │
│    websocket.py   (broadcast hub)     seed.py (demo tenants)           │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ SQLAlchemy ORM
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  DATABASE  (SQLite by default; any SQLAlchemy URL)                     │
│  users · user_settings · vehicles · drivers · trips · warehouses ·     │
│  proof_of_delivery · invoices · alerts · automation_logs · messages    │
└──────────────────────────────────────────────────────────────────────┘
```

Key architectural choices:

- **Stateless HTTP API + a single broadcast WebSocket.** The client refetches on
  signal rather than receiving granular deltas (see §8).
- **Domain-modular routers** behind one app — one deployable unit, one database.
- **Shared-nothing tenants in one schema**: every tenant-owned row carries
  `manager_id`, and all queries are filtered by it (single-DB multi-tenancy).

---

## 3. Request lifecycle (authorization and scoping)

This is the backbone of the system's security design:

```
HTTP request
  → CORSMiddleware (origins from settings.cors_origins)
  → route matches a router (e.g. GET /api/trips)
  → Depends(get_db)            # SQLAlchemy session, closed after request
  → Depends(get_current_user)  # decode JWT → load User, or 401
        └─ require_manager / require_driver  # role gate, or 403
  → handler runs
        └─ access.py helpers (owned_trip_or_404, owned_driver_or_404, …)
           → guarantees the row belongs to current_user (manager) or is
             assigned to them (driver), else 404 (not 403 — avoids leaking existence)
  → serializer (schemas.py, Pydantic v2 from_attributes)
  → JSON response
```

- **Authentication** = HS256 JWT issued at login, signed with
  `settings.secret_key`, carrying `sub` (username) + `role`, expiring after
  `ACCESS_TOKEN_EXPIRE_MINUTES`.
- **Authorization** = role dependency + ownership guard. This is where
  cross-tenant access is blocked.
- **`access.py`** is deliberately tiny — one helper per aggregate — so scoping
  logic isn't duplicated across the endpoints.

---

## 4. Data model

```
                    ┌──────────┐
                    │  User    │  role: manager | driver
                    │ (tenant) │  hashed_password, company_name …
                    └────┬─────┘
        ┌────────────────┼─────────────────┬───────────────┬──────────────┐
        │1:1             │1:N (manager_id) │               │              │
  ┌─────▼─────┐   ┌──────▼──────┐   ┌───────▼──────┐  ┌─────▼─────┐  ┌─────▼─────┐
  │UserSettings│   │  Vehicle    │   │   Driver     │  │ Warehouse │  │  Message  │
  └───────────┘   └──────┬──────┘   └───────┬──────┘  └───────────┘  └───────────┘
                          │ 1:1 vehicle_id   │ user_id (1:1 to login)
                          └────────┬─────────┘
                                   │
                              ┌────▼────┐   manager_id
                              │  Trip   │◄────────────── tenant owner
                              └────┬────┘
                      ┌────────────┼──────────────┐
              1:1 (trip_id)        │1:N           │1:N
        ┌──────────────┐    ┌──────▼──────┐  ┌────▼─────┐
        │ProofOfDelivery│   │  Invoice    │  │  Alert   │ (trip_id/driver_id refs)
        └──────────────┘    └─────────────┘  └──────────┘
                                        ┌──────────────┐
                                        │AutomationLog │ (audit/event trail)
                                        └──────────────┘
```

Design notes:

- **`manager_id` is the tenancy key** on `Vehicle`, `Driver`, `Trip`,
  `Warehouse`, `Invoice`, `ProofOfDelivery`, `Alert`, `AutomationLog`. `User` is
  the tenant root.
- **`Driver` is a profile**, optionally linked 1:1 to a `User` (the login). A
  driver may exist without a login (profile only) — `Driver.user_id` is nullable.
- **Driver ↔ Vehicle** is a 1:1-ish assignment via `Driver.vehicle_id` (the
  "primary" truck); `Trip` carries the authoritative `driver_id`/`vehicle_id`
  pair for that load.
- **Flexible JSON-in-TEXT columns** (`stops`, `history`, `route_coordinates`,
  `route_taken`, `documents`, `inventory`, `dock_appointments`) hold
  nested/variable data. This is a deliberate SQLite-friendly choice — no join
  tables for timelines/stops — at the cost of queryability.
- **`Trip` embeds a lot of live state**: status, ETA, fuel used/cost/price,
  revenue, distance, `remaining_distance`, `assignment_reason/confidence/time`,
  plus `history`/`stops`/`route_coordinates`. It is the richest aggregate and the
  hub of the domain.

### The Trip state machine

```
Draft ──► Unassigned ──(manual/auto assign)──► Assigned ──(driver accepts)──► Accepted
                 ▲                                 │                              │
                 │                                 │(driver rejects)              ▼
                 └─────────────────────────────────┘                          In Transit
                                                                                   │
                       Problem ◄──(issue/SOS/breakdown)                            │
                          │                                                        ▼
                          └────────────────────────────────────────► Completed / Delivered
                                                                          (then Invoice + POD)
```

States used in code: `Draft`, `Unassigned`, `Assigned`, `Accepted`, `Loading`,
`In Transit`, `Problem`, `Delivered`, `Completed`. A driver's accept/reject is
the state transition that flips assets to `On Duty`.

---

## 5. Backend module design

| Module | Role | Design intent |
| --- | --- | --- |
| `main.py` | App assembly: CORS, lifespan, router inclusion, `/ws`, `/api/health` | Thin composition root |
| `config.py` | `Settings` object from env + `.env` | No secrets in code; fail-closed in production |
| `security.py` | Hashing, JWT, `get_current_user`, `require_manager/driver` | One place for auth primitives |
| `access.py` | `owned_*_or_404` guards | One place for tenancy enforcement |
| `database.py` | Engine/session/`get_db` | Infrastructure |
| `models.py` | SQLAlchemy ORM | Persistence |
| `schemas.py` | Pydantic v2 I/O contracts | Validation + serialization boundary |
| `routers/*` | HTTP endpoints by domain | Vertical slices |
| `automation.py` | Event pipelines | The automation engine |
| `ai_service.py` | Intelligence + assistant | The AI advisor |
| `websocket.py` | `ConnectionManager` broadcast hub | Realtime fan-out |
| `seed.py` | Opt-in demo tenants | Dev/demo bootstrap |

**Dependency-injection pattern** (used throughout):

```python
def get_trips(db: Session = Depends(get_db),
              current_user: models.User = Depends(get_current_user)):
    if current_user.role == "driver":  # drivers see only their own
        ...
    return db.query(Trip).filter(Trip.manager_id == current_user.id).all()
```

---

## 6. Domain workflows

### A. Assignment (two paths)

- **Manual assign** — manager picks driver + vehicle; both validated to belong to
  the same tenant; trip → `Assigned`; driver/vehicle → `On Duty`; history entry
  appended.
- **Auto assign** — backend POSTs a payload (trip + available drivers/vehicles)
  to an external agent webhook; maps the returned driver/vehicle back to
  **own-tenant** records; falls back to "first available in tenant" if the agent
  fails. (`evaluate_auto_assignment()` also offers a local scoring alternative:
  availability, rating, type match, capacity, maintenance — top 5.)

### B. The automation engine (`automation.py`)

Every significant event runs an **async pipeline** that (1) writes an
`AutomationLog` row, (2) may create an `Alert`, and (3) **broadcasts**
`REFRESH_DATA` + `AUTOMATION_LOG` over the WebSocket. Pipelines:

| Pipeline | Trigger | Effects |
| --- | --- | --- |
| `run_trip_assigned_pipeline` | trip assigned | notify-driver log + low-severity alert |
| `run_driver_response_pipeline` | driver accept/reject | accept → assets `On Duty`; reject → trip reset to `Unassigned`, high alert |
| `run_traffic_detected_pipeline` | simulate `traffic` | reroute log, new ETA, info alert |
| `run_breakdown_pipeline` | simulate `breakdown` | trip `Problem`, vehicle `Maintenance` + health drop, critical alert, maintenance ticket log |
| `run_trip_completed_pipeline` | end trip / POD approve / simulate `complete` | **idempotent**: applies only not-yet-counted distance, updates odometer/fuel/hours, maintenance alerts, invoice, report log, POD placeholder, success alert |

This is the system's workflow engine: it is **event-driven but synchronous
within the request** (awaited), which keeps state consistent and lets the same
code be reused by driver, manager, and simulation triggers.

### C. Completion and billing (the money path)

`run_trip_completed_pipeline` is the single finalization funnel. It computes fuel
from distance ÷ `mileage_kml`, applies the **remaining** distance only (so
incremental `/progress` updates don't double-count), generates a **unique
sequential invoice** (`INV-<year>-000N`, 18% tax), arms maintenance alerts
against service thresholds, and opens a POD placeholder. The idempotency guard
(an existing invoice) is what makes "driver ends trip" and "manager approves POD"
safe together.

### D. Proof of delivery

Driver submits signature + photo → POD `Pending` + alert. Manager approves → trip
`Completed` (runs the completion pipeline) or rejects → trip `Problem`. Deletion
is manager-only and tenant-guarded.

---

## 7. The intelligence layer (`ai_service.py`)

Two capabilities, both **tenant-scoped** and **database-derived**:

1. **`get_full_fleet_intelligence(db, manager_id)`** — builds a snapshot by
   scanning the tenant's vehicles, drivers, trips, alerts, invoices:
   - per-vehicle financials (revenue, fuel cost, cost/km, profit/km, service
     margin),
   - per-driver utilization and compliance (legal hours remaining vs. an 11-hour
     cap, license expiry countdown),
   - a **Proactive Recommendation Engine** producing ranked recommendations
     (CRITICAL → INFO) across Maintenance, Driver/License, Profit,
     Load-assignment, and Capacity, each with `why`, `expected_impact`, and a
     machine-actionable `action_type` + `action_payload`,
   - a scorecard and daily briefing.

2. **`ask_ai_assistant(query, …)`** — a **router with two engines**:
   - **LLM path** (if `OPENAI_API_KEY`): injects the intelligence snapshot as a
     system prompt, asks `gpt-4o-mini`, temperature 0.2.
   - **Deterministic fallback**: entity resolution (specific vehicle / driver /
     trip by name) then topic routing (profit, available drivers, most
     profitable, fuel cost, maintenance, licenses, duty hours, loads, capacity)
     then a default 360° report.

The `action_type`s from recommendations are executable through
`POST /api/ai/execute-recommendation` — so the advisor is a **closed loop**
(recommend → one-click execute → run the relevant pipeline). Every recommendation
cites the SQL numbers behind it, which keeps it explainable.

---

## 8. Realtime layer

`websocket.py` is a `ConnectionManager` holding a list of sockets and
broadcasting JSON to all of them. Authentication is at the handshake
(`/ws?token=<JWT>`; invalid → close 1008).

Two message types:

- `{"type":"REFRESH_DATA","module":"trips"|"drivers"|…}` → the client calls
  `refreshData(module)` (refetch that REST collection).
- `{"type":"AUTOMATION_LOG","log":{…}}` → the client appends to the live
  automation feed, filtered by `manager_id`/`driver_id` for the current user.

**Design trade-off:** a single broadcast hub + "refetch on signal" is simple and
always consistent (no partial-update bugs), but it is chatty and not
channel-isolated — every client receives every broadcast and filters client-side.
A production evolution would be per-tenant rooms and delta payloads.

---

## 9. Frontend design

- **`App.tsx` is the application kernel.** It provides `AppContext` containing
  *all* domain collections (trips, drivers, vehicles, warehouses, invoices, pods,
  alerts, automationLogs), plus `role`, auth state, `secureFetch`,
  `refreshData`/`refreshAll`, toasts, and dark mode.
- **`secureFetch(url, options)`** wraps `fetch`, injects
  `Authorization: Bearer <token>` from `localStorage`, and on `401` clears
  storage and flips `isLoggedIn` (global sign-out). Every data call goes through
  it.
- **`config.ts`** centralizes the API base (same-origin `/api`, overridable via
  `VITE_API_BASE`) and builds the **authenticated** WebSocket URL.
- **Routing** (`react-router-dom`): `/` dashboard, `/loads`, `/dispatch`,
  `/map`, `/fleet`, `/drivers`, `/pod`, `/billing`, `/reports`, `/messages`,
  `/settings`, `/driver-app`. Role determines which shell/experiences render
  (manager console vs. driver app).
- **Data flow:** page mounts → `refreshAll()` → `secureFetch` per collection →
  context state → React re-renders; WebSocket `REFRESH_DATA` triggers the same
  refresh. Mutations call REST then `refreshData(module)`.
- **`SettingsContext`** layers per-user UI preferences (units, map, route style)
  on top.
- **`AIAssistant.tsx`** renders assistant markdown → HTML (HTML-escaped before the
  markdown transform, closing a stored-XSS hole).
- **Vite proxy** forwards `/api` and `/ws` to `:8000` in dev, so the browser is
  single-origin (no CORS in dev, no baked-in host).

---

## 10. Cross-cutting concerns

- **Configuration and secrets:** everything env-driven; `.env` auto-loaded;
  `SECRET_KEY` mandatory in production, ephemeral in dev; CORS is an explicit
  allowlist (never `*`).
- **Multi-tenancy:** enforced at the query layer (`manager_id`) and a small set of
  ownership guards; drivers are scoped by assignment.
- **Auditability:** `automation_logs` is effectively an event/audit trail,
  surfaced live in the UI.
- **Optional external integrations:** the auto-assign agent webhook and OpenAI are
  both *optional* with graceful fallbacks — the system is fully functional
  without either.
- **Seeding:** `seed.py` creates two isolated demo tenants so the UI has
  realistic cross-tenant data.

---

## 11. Design principles

1. **One backend, one database, many tenants** — simplicity over distribution.
2. **Every mutation flows through a guarded endpoint and, if lifecycle-
   significant, through an automation pipeline** — consistency and a single
   source of truth.
3. **The database is the brain** — intelligence is *derived from live state*, not
   a separate store; recommendations are explainable and executable.
4. **Realtime is signal-based** — broadcast + refetch, trading bandwidth for
   correctness.
5. **Flexibility via JSON-in-TEXT** for irregular nested data, keeping the schema
   small.
6. **Events are first-class** — `AutomationLog` + `Alert` + WebSocket make the
   automation visible and auditable.

---

## 12. Known seams

- **Single broadcast WebSocket** (no tenant rooms/deltas) — scales poorly to many
  concurrent tenants.
- **Synchronous, in-request pipelines** — an external webhook or slow step blocks
  the request; a queue/worker would be the production pattern.
- **JSON-in-TEXT columns** are not queryable/aggregatable at the DB level (all
  analysis happens in Python).
- **Some state enums are inconsistent** (e.g. driver `availability` uses
  `On Duty`, `Driving`, `IDLE`, `Off Duty` across pipelines; trip has overlapping
  `Completed`/`Delivered`).
- **No background scheduler** — aging, license-expiry, and capacity forecasts are
  computed on read, not pushed proactively.
- **SQLite** default is great for dev/demo but not for concurrent production
  writes.
