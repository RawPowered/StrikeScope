# StrikeScope Sentinel — Roadmap

**Status: In progress / not shipped**

StrikeScope today ships enterprise IAM (RBAC, field-level PII, MFA, audit) and an automation orchestration layer (Activepieces + event emitter). The **Sentinel** program extends this into a **locally powered AI-assisted SIEM/SOAR** surface — designed for operators who self-host and maintain their own security playbooks.

This document describes intent and architecture only. No Sentinel dashboard or correlation engine ships in the current codebase.

---

## Problem

Self-hosted CRM platforms generate rich operational signals:

- IAM changes (role edits, permission grants, failed logins)
- Automation deliveries and webhook failures
- Schema migrations and Dev Studio deploy events
- Field-app geofence overrides and document uploads

Today these live in separate tables and logs. Sentinel would **correlate** them into security-relevant incidents without sending tenant data to a third-party cloud SIEM.

---

## Design principles

1. **Local-first** — correlation and AI reasoning on operator infrastructure (Ollama-class), same pattern as Dev Studio
2. **Playbook-owned** — companies author and version response playbooks; platform provides hooks, not prescriptive vendor rules
3. **Fail closed on IAM** — Sentinel observes; it does not bypass RBAC
4. **Honest scope** — CRM audit ≠ full SOC telemetry; Sentinel targets application-layer security events first

---

## Planned inputs (correlation sources)

| Source | Signal examples |
|--------|-----------------|
| `activities` audit table | Record deletes, role changes, bulk exports |
| Auth routes | Failed login bursts, MFA enrollment/disable |
| Automations emitter | Webhook failures, retry exhaustion |
| Dev Studio deploy log | Schema migrations, ship/rollback events |
| Service key usage | Automation key auth anomalies |

---

## Planned playbook model

```yaml
# Illustrative — not implemented
playbook: suspicious_permission_escalation
trigger:
  event: role_permissions.updated
  filter: entity in [users, settings] AND actor.role != server_admin
steps:
  - notify: company_admin
  - require: mfa_reconfirm
  - log: sentinel_incidents
```

Playbooks would integrate with the existing Activepieces sidecar where appropriate, or execute inline for low-latency IAM responses.

---

## Planned SOAR actions (response layer)

- Disable user / revoke sessions
- Freeze automation service key
- Snapshot DB + block Dev Studio ship
- Open incident record with AI-generated timeline summary
- Optional webhook to external SOC (operator-provided endpoint)

---

## Relationship to Dev Studio AI

Dev Studio already **observes data structures** via RAG over platform knowledge, migrations, and SQL schema. Sentinel reuses that embedding/index infrastructure to:

- Summarize incident timelines in natural language
- Suggest playbook steps from historical patterns
- Flag schema changes that widen PII exposure

Dev Studio remains a **platform engineering** tool; Sentinel is a **security operations** consumer of the same local AI stack.

---

## Non-goals (v1 sentinel)

- Replacing Splunk, Sentinel, or Elastic for network-layer telemetry
- Real-time kernel or container intrusion detection
- Managed cloud SOC service
- Claiming compliance certifications (SOC 2, FedRAMP) by default

---

## Milestones (proposed)

| Phase | Deliverable |
|-------|-------------|
| 1 | Structured security event schema + export API from audit/auth |
| 2 | Local correlation rules engine (no AI) |
| 3 | Playbook runner integrated with Activepieces |
| 4 | Ollama-assisted incident summarization + playbook drafting |
| 5 | Sentinel admin UI in Server Admin |

---

*Last updated: 2026-06-13*
