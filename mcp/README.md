# MCP
Model Context Protocol servers, adapters, and contracts.
## Implemented integration layer
- `mcp/contracts`: versioned MCP request/response, tool, resource, and server contracts.
- `mcp/adapters`: runtime-core bridge, request validation helpers, and in-memory registry adapter.
- `mcp/servers`: in-process MCP server with deterministic routing for tools/resources/requests.

See `docs/architecture/mcp-integration-layer.md` for architecture and boundaries.
