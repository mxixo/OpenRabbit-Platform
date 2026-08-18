"use strict";

window.__openrabbitAppBootstrap = null;

async function loadOpenRabbitBootstrap(){
  const params = new URLSearchParams(location.search);
  const requestedOrg = params.get("org");
  const path = `/v1/app/bootstrap${requestedOrg?`?org=${encodeURIComponent(requestedOrg)}`:""}`;
  const response = await fetch(path, { headers: { "accept": "application/json" }, credentials: "same-origin" });
  const payload = await response.json().catch(()=>({}));
  if(!response.ok){
    const message = payload?.error?.message || payload?.message || `Workspace sign-in required (${response.status})`;
    throw new Error(message);
  }
  const bootstrap = payload?.data?.result ?? payload?.data ?? payload;
  window.__openrabbitAppBootstrap = bootstrap;
  window.dispatchEvent(new CustomEvent("openrabbit:app-bootstrap", { detail: bootstrap }));
  return bootstrap;
}

window.__openrabbitBootstrapReady = loadOpenRabbitBootstrap().catch((error)=>{
  window.__openrabbitBootstrapError = error;
  window.dispatchEvent(new CustomEvent("openrabbit:app-bootstrap-error", { detail: { message: error instanceof Error ? error.message : "Sign-in required" } }));
  return null;
});
