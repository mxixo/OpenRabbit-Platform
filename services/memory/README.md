# memory
Durable and session memory services with tenant-safe partitioning.

## Phase 4 memory substrate
- Agent-scoped and session-scoped memory records (`agentId`, `sessionId`).
- Memory domains (`working`, `long-term`, `world`, `business`) with default `working` writes.
- Memory quality metadata support:
  - confidence scoring
  - freshness timestamps and decay policy metadata
  - consolidation metadata (`accessCount`, `lastAccessedAt`, `promotedAt`)
- Consolidation operation to promote frequently accessed working memories into long-term memory.
