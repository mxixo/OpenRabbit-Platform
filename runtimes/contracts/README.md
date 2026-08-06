# Runtime contracts

Canonical TypeScript interfaces live in `@openrabbit/runtime-core`:

- `src/interfaces/runtime-provider.ts`

This directory is the Layer-3 ownership home. During migration, import contracts
from `@openrabbit/runtime-core` (or relative package path until workspace publish).

Adapters implement `RuntimeProvider`; they do not redefine core session/task shapes.
