"use strict";

const AUTH_URL = "https://app.hubspot.com/oauth/authorize";
const TOKEN_URL = "https://api.hubapi.com/oauth/2026-03/token";
const API_BASE = "https://api.hubapi.com";
const DEFAULT_SCOPES = ["oauth","crm.objects.contacts.read","crm.objects.deals.read"];

class HubSpotOAuthAdapter {
  constructor({ clientId, clientSecret, redirectUri, registry, fetchImpl = global.fetch }) {
    if (!clientId || !clientSecret || !redirectUri) throw new Error("HubSpot OAuth configuration missing");
    if (!registry) throw new Error("Connection registry required");
    this.clientId = clientId; this.clientSecret = clientSecret; this.redirectUri = redirectUri; this.registry = registry; this.fetch = fetchImpl;
  }

  authorizationUrl({ userId, redirectTo = "/index.html", scopes = DEFAULT_SCOPES }) {
    const state = this.registry.createOAuthState({ provider:"hubspot", userId, redirectTo });
    const q = new URLSearchParams({ client_id:this.clientId, redirect_uri:this.redirectUri, scope:scopes.join(" "), state });
    return { url:`${AUTH_URL}?${q}`, state };
  }

  async exchangeCode({ code, state }) {
    const oauthState = this.registry.consumeOAuthState(state);
    const body = new URLSearchParams({ grant_type:"authorization_code", client_id:this.clientId, client_secret:this.clientSecret, redirect_uri:this.redirectUri, code });
    const res = await this.fetch(TOKEN_URL,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
    if(!res.ok) throw new Error(`HubSpot token exchange failed: ${res.status}`);
    const token = await res.json();
    const expiresAt = Date.now() + Number(token.expires_in || 1800) * 1000;
    const accountId = token.hub_id ? String(token.hub_id) : "default";
    await this.registry.save({ userId:oauthState.userId, provider:"hubspot", accountId, accessToken:token.access_token, refreshToken:token.refresh_token, expiresAt, scopes:DEFAULT_SCOPES });
    return { provider:"hubspot", accountId, redirectTo:oauthState.redirectTo, scopes:DEFAULT_SCOPES };
  }

  async refresh(refreshToken) {
    const body = new URLSearchParams({ grant_type:"refresh_token", client_id:this.clientId, client_secret:this.clientSecret, refresh_token:refreshToken });
    const res = await this.fetch(TOKEN_URL,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
    if(!res.ok) throw new Error(`HubSpot token refresh failed: ${res.status}`);
    return res.json();
  }

  async api(path, accessToken, options={}) {
    const res = await this.fetch(`${API_BASE}${path}`,{...options,headers:{authorization:`Bearer ${accessToken}`,"content-type":"application/json",...(options.headers||{})}});
    if(!res.ok) throw new Error(`HubSpot API failed: ${res.status}`);
    return res.json();
  }

  async listContacts({ accessToken, limit = 20 }) {
    const props = ["firstname","lastname","email","phone","company","lifecyclestage","lastmodifieddate"].join(",");
    const data = await this.api(`/crm/v3/objects/contacts?limit=${Math.max(1,Math.min(limit,100))}&properties=${encodeURIComponent(props)}`, accessToken);
    return { contacts:(data.results||[]).map(r=>({id:r.id,...r.properties})), paging:data.paging||null };
  }

  async listDeals({ accessToken, limit = 20 }) {
    const props = ["dealname","amount","closedate","pipeline","dealstage","hs_lastmodifieddate"].join(",");
    const data = await this.api(`/crm/v3/objects/deals?limit=${Math.max(1,Math.min(limit,100))}&properties=${encodeURIComponent(props)}`, accessToken);
    return { deals:(data.results||[]).map(r=>({id:r.id,...r.properties})), paging:data.paging||null };
  }

  async searchContactByEmail({ accessToken, email }) {
    if(!email) return null;
    const body = JSON.stringify({filterGroups:[{filters:[{propertyName:"email",operator:"EQ",value:email}]}],properties:["firstname","lastname","email","phone","company","lifecyclestage"],limit:1,sorts:[]});
    const data = await this.api("/crm/v3/objects/contacts/search",accessToken,{method:"POST",body});
    const r=(data.results||[])[0];
    return r ? {id:r.id,...r.properties} : null;
  }
}

module.exports = { HubSpotOAuthAdapter, DEFAULT_SCOPES };