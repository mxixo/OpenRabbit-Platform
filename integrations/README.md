# Integrations (Layer 5)

External system connectors.

Canonical contracts in `@openrabbit/runtime-core`:

- `IntegrationAdapter`
- `IntegrationAdapterRegistry` / `InMemoryIntegrationAdapterRegistry`

Kinds include: `mcp`, `rest`, `graphql`, `webhook`, `oauth`, `custom`.

MCP is one integration family — not the product identity.
Existing `mcp/*` packages are the first concrete integration stack.

Concrete adapters:

- `whatsapp-business/` — verified inbound webhook ingestion and read-only urgent-message review.
