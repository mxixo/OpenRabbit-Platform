# memory

Durable and session memory services with tenant-safe partitioning.

Every service operation requires a trusted `MemoryAccessContext` containing the authenticated organization, subject, and authorized namespace. Organization and namespace are kept separate from caller-controlled record/query input and are included with the record id in storage keys. Persisted legacy records without organization scope fail closed.

Namespaces remain the finer-grained worker, team, or thread boundary. Ingress must derive the complete access context from authentication and worker policy; it must not accept tenant identity or namespace authority from a request body.

The JSON-file adapter is a single-process development option. Multi-instance deployments must use a transactional shared store with concurrency control.
