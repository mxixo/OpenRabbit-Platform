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

Write/side-effect worker tasks can return `202` with a blocked task result containing an `approvalId`. The approval list and decision routes let a client surface that pending action to a human and then approve or deny it.

The gateway owns envelope validation, permissions, route matching, stable API errors, and reliability accounting. It does not own pack installation, worker execution, approval policy, or domain logic; those remain behind the backend/orchestrator boundary.

The current Real Estate backend uses the in-memory approval request store. Durable persistence is still a production follow-up.
