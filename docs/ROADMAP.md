# CogniFleet — Improvement & Future Plan

A grounded roadmap based on the current codebase: what to harden, what to build
next, and in what order. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the design
and its known seams.

---

## 1. Where the project stands

| Area | State | Verdict |
| --- | --- | --- |
| Security / tenancy | JWT, tenant scoping, fail-closed secret | **Solid foundation** |
| Correctness | Idempotent completion, no double-count, unique invoices | **Good, tested** |
| Architecture | Router modules, automation pipelines, intelligence layer | **Clear, modular** |
| Operations | SQLite, no migrations, no CI, no rate limiting | **Not production-ready** |
| Scale | Single broadcast WebSocket, in-request pipelines, no pagination | **Demo-scale** |
| Product | Manager + driver apps, POD, billing, AI advisor | **Strong MVP** |

The honest read: a **well-structured MVP** that needs an operational hardening
pass before real users, then product depth (real integrations, forecasting,
multi-role) to grow.

---

## 2. Improvements (make it production-grade)

### A. Reliability & correctness — *highest priority*

| # | Improvement | Why | Effort |
| --- | --- | --- | --- |
| A1 | **Add Alembic migrations** (replace `create_all`) | No safe schema evolution today; `create_all` cannot alter columns | M |
| A2 | **Unify the state enums into one state-machine module** | Driver `availability` uses `On Duty`/`Driving`/`IDLE`/`Off Duty` inconsistently; trip has `Completed`/`Delivered` overlap → subtle bugs | M |
| A3 | **Make the completion pipeline transactional** (single `db.commit`) | Logs/alerts/invoice currently commit in several steps; a mid-pipeline failure leaves partial state | M |
| A4 | **Move automation/webhook work out of the request** (`BackgroundTasks` → then a queue) | A slow agent webhook or pipeline blocks the HTTP response | M→L |
| A5 | **Pagination + filtering on all list endpoints** | `/api/trips` returns everything; grows unbounded | S |
| A6 | **Test coverage** for AI service, invoices, alerts, warehouses | Only auth/tenancy/lifecycle/WebSocket are covered now | M |

### B. Security hardening

| # | Improvement | Why |
| --- | --- | --- |
| B1 | **Rate-limit login/register** (`slowapi`) + lockout/backoff | Brute-force is currently unthrottled |
| B2 | **Move JWT out of `localStorage`** → short-lived access token + httpOnly refresh cookie | `localStorage` tokens are stealable via any XSS; add CSRF protection if using cookies |
| B3 | **Validate POD uploads** (size, content-type *and* magic bytes, store outside webroot) | File uploads are an attack surface |
| B4 | **Structured audit log** for auth + sensitive mutations | Compliance + incident response |
| B5 | **Password policy + optional email verification / MFA** | Standard account security |
| B6 | **Secrets management** (not `.env` on disk in prod) → vault/SSM | Avoid secret sprawl |

### C. Performance & scale

| # | Improvement | Why |
| --- | --- | --- |
| C1 | **Postgres in production** (`DATABASE_URL`) | SQLite cannot take concurrent writes |
| C2 | **Per-tenant WebSocket rooms + delta payloads** | Today every client gets every broadcast and refetches everything |
| C3 | **Cache the fleet-intelligence snapshot** (per manager, TTL) | `get_full_fleet_intelligence` scans all tables on every AI call |
| C4 | **Fix N+1 / aggregate in SQL** where possible | JSON-in-TEXT forces Python-side analysis; move hot metrics to SQL/views |
| C5 | **Frontend code-splitting + `React.lazy`** | Bundle is > 1 MB; lazy-load routes/modules |
| C6 | **Frontend data layer** (TanStack Query) | Replace "refetch everything on every signal" with cache + targeted invalidation |

### D. Code quality & operations

| # | Improvement | Why |
| --- | --- | --- |
| D1 | **CI pipeline** (GitHub Actions: pytest, lint, `tsc --noEmit`, build) | Prevent regressions; currently manual |
| D2 | **`pre-commit`** (ruff/black, eslint/prettier) | Consistent style |
| D3 | **Docker + docker-compose** (api + db + web) | Reproducible dev and deploy |
| D4 | **Structured logging + Sentry + metrics** (`/metrics` Prometheus) | Observe failures in prod |
| D5 | **Dependabot / dependency scanning** | Keep dependencies patched |
| D6 | **API versioning (`/api/v1`)** | Let the contract evolve without breaking clients |
| D7 | **Reduce the 119 frontend lint warnings** and tighten lint rules | Signal-to-noise |

### E. Product-grade UX

| # | Improvement | Why |
| --- | --- | --- |
| E1 | **Error boundaries + loading/empty/error states everywhere** | Resilience and polish |
| E2 | **Driver app as an installable PWA with an offline queue** | Drivers often have poor connectivity |
| E3 | **Accessibility pass** (labels, focus, contrast) | Inclusivity + compliance |
| E4 | **Real notifications** (email/SMS/push) | Pipelines currently only *log* "sent SMS" |

---

## 3. Future plan (where the product goes)

### Phase 1 — Production-ready MVP *(~4–8 weeks)*
**Goal:** safely run one real customer.

- Migrations, CI, Docker, Postgres, rate limiting, pagination, background
  pipeline execution.
- Real notifications (email at minimum).
- Error tracking + uptime/health monitoring.
- Token-handling hardening (B2).

### Phase 2 — Operational depth *(~2–4 months)*
**Goal:** genuinely useful day to day.

- **Telematics integration** (Samsara/Geotab) or device GPS → replace simulated
  coordinates.
- **ELD / hours-of-service compliance** automation.
- **Route optimization** (OR-Tools) and a map-provider switch
  (Mapbox/Google).
- **Accounting integration** (QuickBooks/Xero) + PDF invoice export.
- **Reporting & analytics** module (utilization, cost/km, on-time %, margin)
  with CSV/PDF export.
- **RBAC**: manager / dispatcher / finance / driver roles.

### Phase 3 — Intelligence & scale *(~4–9 months)*
**Goal:** differentiation.

- **Predictive maintenance** (service-due forecasting from odometer/telemetry
  trends).
- **Demand & capacity forecasting**; smarter **auto-assignment** (learned
  scoring, not just rules).
- **LLM-native advisor**: semantic search over loads/drivers (embeddings),
  tool-calling so the assistant executes real actions, streaming answers.
- **Multi-process realtime** (Redis pub/sub for WebSocket fan-out) + tenant
  rooms.
- **Subscriptions/billing** (Stripe) if going SaaS.

### Phase 4 — Platform / ecosystem *(6–12 months)*

- Public **API + webhooks**, partner integrations, plugin surface.
- **Multi-warehouse, multi-currency, tax rules** by region.
- **Mobile-native driver app** (React Native / Expo) if the PWA is not enough.
- **Compliance posture**: data retention, GDPR tooling, SOC2-style controls.

---

## 4. Priority matrix (do these first)

```
HIGH IMPACT / LOW EFFORT    → do now
  A1 migrations · A5 pagination · B1 rate limiting · D1 CI · C5 code-splitting

HIGH IMPACT / HIGHER EFFORT → next quarter
  A4 background pipelines · B2 token hardening · C1 Postgres · C2 WebSocket rooms · C3 AI cache

LOW IMPACT / LOW EFFORT     → opportunistic
  D2 pre-commit · D7 lint warnings · E3 accessibility

LOW IMPACT / HIGH EFFORT    → defer
  C2 delta-payload redesign before scale · D6 versioning before external clients
```

---

## 5. Suggested 90-day sequence

| Weeks | Focus | Deliverable |
| --- | --- | --- |
| 1–2 | **CI + quality gates** | GitHub Actions green on every push (pytest, lint, build) |
| 2–3 | **Migrations** | Alembic baseline + first migration; remove `create_all` |
| 3–4 | **Security pass** | Login rate limit, upload validation, audit log |
| 4–6 | **Background pipelines** | Automation runs off the request path |
| 6–7 | **Pagination + indexes** | List endpoints paged; DB indexes on `manager_id`/`status` |
| 7–9 | **Postgres + Docker** | One-command stack; production DB |
| 9–10 | **Realtime hardening** | Tenant-scoped WebSocket rooms |
| 10–12 | **Notifications + observability** | Email notifications, Sentry, metrics dashboard |

---

## 6. Success metrics to track

- **API p95 latency** < 300 ms on list endpoints.
- **Test coverage** ≥ 70% on the backend.
- **Zero** cross-tenant access in pen-tests.
- **First-load bundle** < 400 KB gzipped.
- **Mean time to detect** failures < 5 min (Sentry/alerts).
