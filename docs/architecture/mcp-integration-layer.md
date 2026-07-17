# MCP Integration Layer
## Purpose
Define a production-ready MCP integration baseline with clear boundaries between:
- contracts (`mcp/contracts`)
- adapters (`mcp/adapters`)
- in-process server runtime (`mcp/servers`)
- orchestrator routing integration (`services/orchestrator`)

## Layered design
### Contracts
`mcp/contracts/src/index.ts` provides:
- request/response envelopes
- tool/resource descriptors
- server descriptor metadata
- tool/resource operation result shapes

### Adapters
`mcp/adapters/src` provides:
- runtime-core MCP bridge adapter
- payload validation helper for request envelopes
- in-memory registry adapter for tools/resources

### Servers
`mcp/servers/src` provides:
- in-memory MCP server implementation
- tool/resource registration APIs
- request routing for `tools/list`, `tools/call`, `resources/list`, `resources/read`
- deterministic error mapping for unsupported methods and missing handlers

## Core service integration
`services/orchestrator` now supports:
- MCP server registration
- routed MCP request dispatch
- deterministic orchestrator-level MCP error responses when unstarted/unregistered

## Non-goals in this phase
- No external MCP transport listeners
- No network-connected tool backends
- No third-party API integration inside MCP handlers
