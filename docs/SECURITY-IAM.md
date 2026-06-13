# StrikeScope — Security & IAM

Enterprise-style identity and access control for a self-hosted, multi-tenant CRM platform.

**Related:** [Architecture](ARCHITECTURE.md) · [Sentinel roadmap](ROADMAP-SENTINEL.md) · [SECURITY.md](../SECURITY.md)

---

## Threat model (summary)

StrikeScope assumes:

- Operators self-host on private infrastructure or VPC
- Multiple companies (tenants) share one server instance with logical isolation
- CRM users handle regulated PII (SSN fragments, DOB, co-signer data)
- Automation integrations use scoped service keys, not shared user passwords

**Out of scope today:** federated SSO (SAML/OIDC), hardware security modules, centralized SIEM ingestion.

---

## Authentication

| Mechanism | Implementation |
|-----------|----------------|
| Password storage | bcrypt (cost factor 12) |
| Session token | JWT signed with `JWT_SECRET` |
| MFA | TOTP via `speakeasy` (optional per user) |
| Customer portal | Separate login path with `customer` role |
| Field apps | Dedicated field-auth routes with scoped tokens |

**Production requirement:** `JWT_SECRET` must be set when `DEV_MODE` is not `true`. Server refuses startup without it.

**Dev mode:** Auto-attaches dev admin context for local velocity — must be disabled in production.

---

## Authorization model

### Role hierarchy

| Role | Scope |
|------|-------|
| `server_admin` | Platform operator — companies, domains, server dashboard, Dev Studio |
| `company_admin` | Full CRM access within a tenant |
| `user` | Template role — view-only baseline (disabled until explicitly enabled) |
| Sales / project / field roles | `sales_manager`, `sales_agent`, `project_admin`, `project_manager`, `foreman`, `crewman`, `technician` |
| `customer` | Portal access to assigned project |

Roles are stored per company in `roles` with system vs custom distinction.

### Entity-level permissions (RBAC)

Each role receives CRUD flags per **entity**:

`leads` · `customers` · `projects` · `contacts` · `agreements` · `submissions` · `settings` · `users` · `audit` · `forms`

Enforced server-side via `requirePermission()` in [`packages/server/src/auth.ts`](../packages/server/src/auth.ts). Client mirrors checks with `can()` in [`packages/admin/src/auth.tsx`](../packages/admin/src/auth.tsx).

### Field-level permissions (PII)

Sensitive fields are defined in [`packages/server/src/field-permissions.ts`](../packages/server/src/field-permissions.ts):

| Entity | Fields | Category |
|--------|--------|----------|
| `leads` | `co_signer_name`, `co_signer_email`, `co_signer_phone` | Co-signer information |
| `contacts` | `ssn_last_four`, `date_of_birth` | PII |

Stored in `role_field_permissions` with independent **view** and **edit** flags. API responses strip or mask fields when the active role lacks view permission.

This implements **least-privilege at the column level** — not just route-level gates.

---

## Multi-tenancy

- `companies` table — tenant workspace
- `user_company_memberships` — users may belong to multiple companies with distinct roles
- `company_domains` + subdomain routing — hostname resolves active tenant context
- Workspace isolation covered by [`packages/server/src/__tests__/workspace-isolation.test.ts`](../packages/server/src/__tests__/workspace-isolation.test.ts)

---

## Audit trail

Operational audit events land in `activities` — user actions on CRM records (create, update, delete, assignment). Exposed in Admin → **Audit Trail**.

Audit entity permissions are separately gated — roles without `audit` view cannot read the trail.

---

## Automation credentials

- **Service keys** (`ssap_*` prefix) — scoped API access for Activepieces and webhook flows
- **Embed JWTs** — short-lived tokens for automation UI embed without sharing user sessions

Keys are stored hashed; rotation is operator responsibility.

---

## Application hardening

| Control | Location |
|---------|----------|
| Helmet (CSP, headers) | `packages/server/src/index.ts` |
| Rate limiting | 200 req/min general; 30 req/min mutations |
| CORS | Configurable `CORS_ORIGINS` |
| File upload limits | Multer with type/size constraints |
| SQL | Parameterized queries via better-sqlite3 |

---

## Roadmap gaps (honest)

| Capability | Status |
|------------|--------|
| SAML / OIDC / SSO | Not implemented — planned federation layer |
| SCIM provisioning | Not implemented |
| Centralized SIEM export | Roadmap — see [ROADMAP-SENTINEL.md](ROADMAP-SENTINEL.md) |
| Hardware key MFA | TOTP only today |
| Secrets vault (HashiCorp, etc.) | Environment variables + DB connection records |

---

*Last updated: 2026-06-13*
