"use strict";
require("dotenv").config();
const port=process.env.OPENRABBIT_PROTOTYPE_PORT||"8787";
const origin=process.env.OPENRABBIT_APP_ORIGIN||`http://localhost:${port}`;
const checks=[
  ["OpenAI agent",Boolean(process.env.OPENAI_API_KEY),"OPENAI_API_KEY"],
  ["Gmail OAuth",Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET),"GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET"],
  ["Google Maps",Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY),"GOOGLE_MAPS_BROWSER_KEY"],
  ["HubSpot",Boolean((process.env.HUBSPOT_CLIENT_ID&&process.env.HUBSPOT_CLIENT_SECRET)||process.env.HUBSPOT_ACCESS_TOKEN),"HUBSPOT_CLIENT_ID + HUBSPOT_CLIENT_SECRET (or HUBSPOT_ACCESS_TOKEN)"]
];
console.log("\nOpenRabbit prototype preflight\n");
for(const [name,ok,env] of checks)console.log(`${ok?"✓":"○"} ${name.padEnd(16)} ${ok?"configured":`missing ${env}`}`);
console.log(`\nApp origin:       ${origin}`);
console.log(`Gmail callback:   ${process.env.GOOGLE_REDIRECT_URI||`${origin}/api/integrations/gmail/callback`}`);
console.log(`HubSpot callback: ${process.env.HUBSPOT_REDIRECT_URI||`${origin}/api/integrations/hubspot/callback`}`);
const coreReady=checks[0][1]&&checks[1][1];
console.log(`\nCore vertical slice: ${coreReady?"READY TO ATTEMPT LIVE DEMO":"NOT YET CREDENTIALED"}`);
console.log(`Full four-provider demo: ${checks.every(x=>x[1])?"READY TO ATTEMPT":"PARTIALLY CONFIGURED"}\n`);
process.exitCode=coreReady?0:2;