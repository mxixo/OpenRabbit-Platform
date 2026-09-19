# OpenRabbit Policy Engine

Runtime implementation target for the autonomy doctrine.

Principle: **maximum useful autonomy within explicit boundaries, minimum unnecessary interruption, complete observability.**

The policy engine is separate from the worker model. It classifies proposed external actions as GREEN, YELLOW, RED, or BLOCK using durable delegated authority, capability scopes, and hard platform boundaries.
