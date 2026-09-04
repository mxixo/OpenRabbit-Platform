# Capability: Real Estate

Target home for real-estate domain functionality.

## Contract shape (example)

```ts
{
  id: "real-estate",
  version: "0.1.0",
  name: "Real Estate",
  tools: [{ name: "deal.underwrite" }],
  workflows: [{ id: "commercial-investment", name: "Commercial investment analysis" }],
  dependsOnCapabilities: ["crm"],
  integrations: ["rentcast", "mls"]
}
```

## Near-term migration source

- OpenRabbit app commercial investment workflow skill
- underwriting/analysis logic
- MLS / Rentcast connectors via `integrations/`
- validated local OpenClaw real-estate skills listed in `manifest.json`

`manifest.json` is the runtime-neutral capability inventory. It records the
business tools and workflows OpenRabbit intends to expose without making
OpenClaw, Codex, or any single model provider the owner of that logic.

## Pack relationship

`packs/real-estate` composes this capability with worker presets and CRM integrations.
