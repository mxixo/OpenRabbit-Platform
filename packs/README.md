# Industry Packs

Packs are opinionated bundles:

- capability module ids
- integration adapter ids
- worker presets
- workflow presets / defaults

Canonical contracts in `@openrabbit/runtime-core`:

- `IndustryPackManifest`
- `IndustryPackCatalog` / `InMemoryIndustryPackCatalog`
- `IndustryPackInstaller` / `InMemoryIndustryPackInstaller`

## Rules

1. Packs must not contain a second platform core.
2. Installers compose existing capabilities; they do not reimplement them.
3. Worker presets are optional and materialize into `WorkerDefinition`s when requested.
4. Shared capabilities are not uninstalled automatically when a pack is removed.
