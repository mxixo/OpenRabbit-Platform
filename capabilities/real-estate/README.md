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

## Pack relationship

`packs/real-estate` composes this capability with worker presets and CRM integrations.
