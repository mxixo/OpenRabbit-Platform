# Data Provenance & Agent Observability

## Goal
Users should be able to understand what OpenRabbit can access, what it did, and why, without being interrupted during routine work.

## Autonomy status surface
Display a compact status such as:
**AUTONOMY: SEAMLESS · 6 CONNECTED SERVICES · 14 CAPABILITIES**

Daily activity can summarize:
**37 automatic · 2 surfaced · 0 blocked**

## Action receipt
For each meaningful action store:
- initiating user/workflow
- model/runtime and version
- capability/tool
- provider connection ID
- policy class and decision
- data/resource provenance
- request timestamp
- execution timestamp
- provider result/receipt
- verification status
- retry/idempotency key
- failure/escalation details

## “Why does OpenRabbit know this?”
Answer from recorded provenance. Never ask the model to reconstruct access history from memory.

## Permission granularity
Where providers allow it, distinguish read, search history, create/draft, send/publish, modify, delete, use proactively, and retain/use as memory.

## Security boundary
Credentials are brokered server-side and never exposed to the worker model. Browser/cloud execution should use controlled profiles/environments rather than inheriting arbitrary desktop extensions or unrelated local application data.
