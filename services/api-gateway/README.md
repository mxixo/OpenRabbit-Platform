# api-gateway

Ingress service exposing authenticated public and internal platform APIs.

## Platform API v1

The gateway now supports a thin product-facing route layer backed by a registered `PlatformApiBackend`.

Initial routes:

- `POST /v1/orgs/:orgId/packs/real-estate/install`
- `GET /v1/orgs/:orgId/workers`
- `POST /v1/orgs/:orgId/workers/:workerId/tasks`
- `GET /v1/orgs/:orgId/tasks/:taskId`

The gateway owns envelope validation, permissions, route matching, stable API errors, and reliability accounting. It does not own pack installation, worker execution, or domain logic; those remain behind the backend/orchestrator boundary.

A composition layer can register a backend that delegates these operations to the Real Estate bootstrap/orchestrator path.
