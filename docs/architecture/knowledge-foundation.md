# Knowledge Foundation
## Purpose
Phase 5 begins with a foundational knowledge substrate that supports:
- ingestion-ready knowledge records
- retrieval-oriented search scoring (text + embedding + tags)
- lightweight entity/relationship modeling for graph expansion

This phase is intentionally in-process and interface-first so higher-scale indexing, embedding pipelines, and external vector backends can be layered without breaking contracts.

## Implemented in this slice
- Runtime-core knowledge contracts in `packages/runtime-core/src/interfaces/knowledge.ts`:
  - `KnowledgeRecord`, `KnowledgeQuery`, `KnowledgeSearchResult`
  - `KnowledgeEntity`, `KnowledgeRelationship`
  - `KnowledgeStore` contract for record and graph primitives
- In-memory implementation in `packages/runtime-core/src/core/in-memory-knowledge-store.ts`:
  - deterministic put/get/delete record lifecycle
  - search scoring over text, embedding similarity, and tag constraints
  - entity and relationship upsert/list behavior for graph adjacency
- Unit coverage in `packages/runtime-core/tests/unit/knowledge-store.test.ts` for:
  - record persistence and retrieval
  - text/embedding ranking behavior
  - tag-filtered retrieval and relationship listing

## Boundaries in this slice
- No external embedding provider calls.
- No durable vector database integration.
- No graph traversal engine beyond direct relationship listing.
- No ingestion scheduler/ETL orchestration.

## Next step focus for Phase 5
- Add ingestion pipeline contracts (source adapters, normalization, chunking).
- Introduce embedding generation abstraction and deterministic test doubles.
- Add retrieval evaluation fixtures and semantic relevance benchmarks.
- Add explicit partitioning boundaries for world knowledge vs tenant/business knowledge.
