# OpenRabbit Real Estate Workspace

Minimal browser client for the first production-grade underwriting loop.

It consumes:

`GET /v1/orgs/:orgId/deals/:dealId/workspace`

and renders the current deal, underwriting KPIs, downside/base/upside scenarios, data confidence, recommendation, target purchase price, diligence items, approval state, and audit history.

This is intentionally a thin client. Business logic stays in the product API/workflow layer. The disabled action buttons are placeholders for the next product slice: revising assumptions and creating/deciding controlled approvals.

For local use, serve this directory from the same origin as the real-estate API (or add an explicit API base URL/CORS policy later). Enter the organization, deal ID, and bearer token, then load the workspace.
