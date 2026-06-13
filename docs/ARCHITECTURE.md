# StrikeScope — Architecture

## Overview

Self-hosted **multi-tenant CRM platform**: Admin CRM + Server Admin, Field/Installer PWAs, Monitor feed, optional Activepieces automations — backed by **Express + SQLite**.

System map: `EnVars/SysMap.xml` · Variable map: `EnVars/VarMap.xml`  
Security: [SECURITY-IAM.md](SECURITY-IAM.md) · Sentinel roadmap: [ROADMAP-SENTINEL.md](ROADMAP-SENTINEL.md)

## Tech Stack

| Layer | Choice |
|-------|--------|
| Server | Express 4 + better-sqlite3 + ws + multer |
| Admin CRM | React 19 + Vite 8 + react-router-dom 7 + Tailwind v4 + Radix UI |
| Data | @tanstack/react-query + @tanstack/react-table |
| Shared | TypeScript types + api-client in `shared/` |
| Auth | JWT + bcrypt + optional TOTP MFA |
| DB | SQLite (WAL); dated SQL migrations in `packages/server/src/migrations/` |
| Automations | Activepieces (Docker sidecar) + custom piece |
| AI (dev) | Ollama + Dev Studio RAG agent |

## Apps (npm workspaces)

| App | Port | Role |
|-----|------|------|
| `packages/admin` | 5173 | Company CRM + Server Admin |
| `packages/server` | 3001 | API + WebSocket + static admin dist |
| `packages/installer` | 5174 | Field photo PWA |
| `packages/field` | 5176 | Field ops PWA (time, geofence) |
| `packages/monitor` | 5175 | Live submission feed |

## CRM Information Architecture

```
Company Platform
├── Dashboard
├── Leads (Pipeline | Do Not Contact)
├── Contacts (+ directory)
├── Customers → Info | Contacts | Files | Projects | Activity
├── Projects / Active Jobs
├── Tasks (submissions)
└── Admin → Roles, Audit, Connections, Automations, Territory, …

Server Admin (/server/*)
├── Companies, Users, Domains
├── Project Types, Task Templates
├── Dev Studio (dev mode)
└── Deleted Items
```

## Key CRM Tables

| Table | Purpose |
|-------|---------|
| `companies` | Multi-tenant workspace |
| `users`, `user_company_memberships` | Auth + workspace membership |
| `roles`, `role_permissions`, `role_field_permissions` | RBAC + field-level PII |
| `lead_stages`, `leads` | Pipeline; DNC via `dnc_at` / `dnc_reason` |
| `customers`, `contacts` | Accounts |
| `agreements`, `customer_documents` | Contracts + file vault |
| `projects`, `project_task_items` | Install jobs |
| `activities` | Audit trail |
| `submissions`, `submission_images` | Field photos |
| `connections` | S3/FTP/SSH storage connectors |

## Admin Frontend Layout

- `layout/AppShell.tsx` — sidebar + command palette (Ctrl+K)
- `features/*` — plugin-style CRM modules
- `pages/Roles.tsx` — entity + field permission matrix
- `hooks/useCrmQueries.ts` — React Query entity hooks

## API Highlights

| Route | Notes |
|-------|-------|
| `POST /api/auth/login` | JWT + optional MFA step |
| `GET/POST /api/admin/roles` | RBAC configuration |
| `GET /api/admin/activities` | Audit trail |
| `GET /api/admin/leads/dnc` | Do-not-contact list |
| `GET/POST /api/admin/customers/:id/files` | Document vault |
| `/api/admin/dev-studio/*` | AI agent (dev mode only) |

## Migrations

SQL files in `packages/server/src/migrations/` run via `migrations/runner.ts` on server start. Track applied migrations in `schema_migrations`.

## Roles & permission entities

Roles: `server_admin` · `company_admin` · CRM roles · `customer`

Entities: `leads`, `customers`, `contacts`, `agreements`, `projects`, `submissions`, `settings`, `users`, `audit`, `forms`

Field-level PII: see [SECURITY-IAM.md](SECURITY-IAM.md)
