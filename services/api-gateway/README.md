# api-gateway

Ingress service exposing authenticated public and internal platform APIs.

## Platform API v1

The gateway supports a thin product-facing route layer backed by a registered `PlatformApiBackend`.

Initial routes:

- `POST /v1/orgs/:orgId/packs/real-estate/install`
- `GET /v1/orgs/:orgId/workers`
- `POST /v1/orgs/:orgId/workers/:workerId/tasks`
- `GET /v1/orgs/:orgId/tasks/:taskId`
- `GET /v1/orgs/:orgId/approvals`
- `POST /v1/orgs/:orgId/approvals/:approvalId/approve`
- `POST /v1/orgs/:orgId/approvals/:approvalId/deny`
- `GET /v1/orgs/:orgId/plans/:date`
- `GET /v1/orgs/:orgId/plans/:date/items`
- `PUT /v1/orgs/:orgId/plans/:date`

The daily-plan routes are provider-neutral. They expose normalized OpenRabbit plan state rather than Google Calendar objects. A backend may implement them with the Core `CalendarPlanStore`; if planning is not composed yet, the gateway returns `PLANNING_BACKEND_NOT_AVAILABLE` instead of pretending calendar functionality exists.

Write/side-effect worker tasks can return `202` with a blocked task result containing an `approvalId`. The approval list and decision routes let a client surface that pending action to a human and then approve or deny it.

The gateway owns envelope validation, permissions, route matching, stable API errors, and reliability accounting. It does not own pack installation, worker execution, approval policy, calendar-provider behavior, or domain logic; those remain behind backend/orchestrator and integration boundaries.

The current Real Estate backend uses in-memory approval and audit stores. Durable persistence and a composed calendar planning backend remain production follow-ups.
