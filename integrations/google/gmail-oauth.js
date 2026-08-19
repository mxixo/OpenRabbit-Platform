"use strict";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const DEFAULT_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly", CALENDAR_SCOPE];

class GmailOAuthAdapter {
  constructor({ clientId, clientSecret, redirectUri, registry, fetchImpl = global.fetch }) {
    if (!clientId || !clientSecret || !redirectUri) throw new Error("Gmail OAuth configuration missing");
    if (!registry) throw new Error("Connection registry required");
    this.clientId = clientId; this.clientSecret = clientSecret; this.redirectUri = redirectUri; this.registry = registry; this.fetch = fetchImpl;
  }

  authorizationUrl({ userId, redirectTo = "/communications.html", scopes = DEFAULT_SCOPES }) {
    const state = this.registry.createOAuthState({ provider: "gmail", userId, redirectTo });
    const q = new URLSearchParams({ client_id:this.clientId, redirect_uri:this.redirectUri, response_type:"code", access_type:"offline", prompt:"consent", include_granted_scopes:"true", scope:scopes.join(" "), state });
    return { url:`${AUTH_URL}?${q}`, state };
  }

  async exchangeCode({ code, state }) {
    const oauthState = this.registry.consumeOAuthState(state);
    const body = new URLSearchParams({ code, client_id:this.clientId, client_secret:this.clientSecret, redirect_uri:this.redirectUri, grant_type:"authorization_code" });
    const res = await this.fetch(TOKEN_URL,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
    if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
    const token = await res.json();
    const expiresAt = Date.now() + Number(token.expires_in || 3600) * 1000;
    const profile = await this.gmailFetch("/profile", token.access_token);
    await this.registry.save({ userId:oauthState.userId, provider:"gmail", accountId:profile.emailAddress || "default", accessToken:token.access_token, refreshToken:token.refresh_token, expiresAt, scopes:String(token.scope || "").split(" ").filter(Boolean) });
    return { provider:"gmail", accountId:profile.emailAddress, redirectTo:oauthState.redirectTo, scopes:String(token.scope || "").split(" ").filter(Boolean) };
  }

  async refresh(refreshToken) {
    const body = new URLSearchParams({ client_id:this.clientId, client_secret:this.clientSecret, refresh_token:refreshToken, grant_type:"refresh_token" });
    const res = await this.fetch(TOKEN_URL,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
    if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
    return res.json();
  }

  async gmailFetch(path, accessToken) {
    const res = await this.fetch(`${GMAIL_BASE}${path}`,{headers:{authorization:`Bearer ${accessToken}`}});
    if (!res.ok) throw new Error(`Gmail API failed: ${res.status}`);
    return res.json();
  }

  async calendarFetch(path, accessToken) {
    const res = await this.fetch(`${CALENDAR_BASE}${path}`,{headers:{authorization:`Bearer ${accessToken}`}});
    if (!res.ok) throw new Error(`Google Calendar API failed: ${res.status}`);
    return res.json();
  }

  async listInbox({ accessToken, maxResults = 12, query = "in:inbox" }) {
    const list = await this.gmailFetch(`/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`, accessToken);
    const messages = await Promise.all((list.messages || []).map(async ({id}) => {
      const msg = await this.gmailFetch(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, accessToken);
      const headers = Object.fromEntries((msg.payload?.headers || []).map(h=>[h.name.toLowerCase(),h.value]));
      return { id, threadId:msg.threadId, from:headers.from || "", subject:headers.subject || "(no subject)", date:headers.date || "", snippet:msg.snippet || "", labelIds:msg.labelIds || [] };
    }));
    return { messages, nextPageToken:list.nextPageToken || null };
  }

  async listCalendarEvents({ accessToken, timeMin, timeMax, maxResults = 30 }) {
    const q = new URLSearchParams({singleEvents:"true",orderBy:"startTime",maxResults:String(maxResults)});
    if (timeMin) q.set("timeMin", timeMin);
    if (timeMax) q.set("timeMax", timeMax);
    const data = await this.calendarFetch(`/calendars/primary/events?${q}`, accessToken);
    const events = (data.items || []).map(event => ({
      id:event.id,
      summary:event.summary || "(untitled)",
      description:event.description || "",
      location:event.location || "",
      status:event.status || "confirmed",
      htmlLink:event.htmlLink || "",
      start:event.start?.dateTime || event.start?.date || null,
      end:event.end?.dateTime || event.end?.date || null,
      allDay:Boolean(event.start?.date && !event.start?.dateTime),
      organizer:event.organizer?.email || "",
      attendees:(event.attendees || []).map(a=>({email:a.email,responseStatus:a.responseStatus}))
    }));
    return {calendar:"primary",events,nextPageToken:data.nextPageToken||null,timeZone:data.timeZone||null};
  }
}

module.exports = { GmailOAuthAdapter, DEFAULT_SCOPES, CALENDAR_SCOPE };