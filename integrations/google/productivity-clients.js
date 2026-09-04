"use strict";

function required(value,name){if(typeof value!=="string"||!value.trim())throw new Error(`${name} is required`);return value.trim();}

class GoogleApiClient {
  constructor({tokenProvider,fetchImpl=globalThis.fetch}={}){
    if(typeof tokenProvider!=="function") throw new Error("tokenProvider is required");
    if(typeof fetchImpl!=="function") throw new Error("fetch implementation is required");
    this.tokenProvider=tokenProvider;this.fetch=fetchImpl;
  }
  async request(url,{method="GET",body}={}){
    const token=required(await this.tokenProvider(),"Google access token");
    const response=await this.fetch(url,{method,headers:{Authorization:`Bearer ${token}`,...(body!==undefined?{"Content-Type":"application/json"}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){const message=payload?.error?.message||`Google API request failed (${response.status})`;const error=new Error(message);error.status=response.status;throw error;}
    return payload;
  }
}

function decodeBase64Url(value=""){const normalized=value.replace(/-/g,"+").replace(/_/g,"/");return Buffer.from(normalized,"base64").toString("utf8");}
function headersMap(headers=[]){return Object.fromEntries(headers.map(h=>[String(h.name||"").toLowerCase(),h.value||""]));}
function findTextPart(payload={}){
  if(payload.mimeType==="text/plain"&&payload.body?.data) return decodeBase64Url(payload.body.data);
  for(const part of payload.parts||[]){const text=findTextPart(part);if(text)return text;}
  if(payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}
function normalizeGmailMessage(raw={}){const h=headersMap(raw.payload?.headers);return {id:raw.id,threadId:raw.threadId,subject:h.subject||"",from:h.from||"",to:h.to||"",date:h.date||"",snippet:raw.snippet||"",body:findTextPart(raw.payload),internalDate:raw.internalDate};}

class GmailClient {
  constructor({apiClient,userId="me"}={}){if(!apiClient?.request)throw new Error("apiClient is required");this.api=apiClient;this.userId=userId;}
  async search({query,limit=25}={}){const q=required(query,"query");const max=Math.max(1,Math.min(Number(limit)||25,100));const url=`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(this.userId)}/messages?q=${encodeURIComponent(q)}&maxResults=${max}`;const data=await this.api.request(url);return (data.messages||[]).map(x=>({id:x.id,threadId:x.threadId}));}
  async read({messageId}={}){const id=required(messageId,"messageId");const url=`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(this.userId)}/messages/${encodeURIComponent(id)}?format=full`;return normalizeGmailMessage(await this.api.request(url));}
  async createDraft(message){const raw=encodeMimeMessage(message);const url=`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(this.userId)}/drafts`;const data=await this.api.request(url,{method:"POST",body:{message:{raw}}});return {id:data.id,messageId:data.message?.id};}
  async send(message){const raw=encodeMimeMessage(message);const url=`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(this.userId)}/messages/send`;const data=await this.api.request(url,{method:"POST",body:{raw}});return {id:data.id,threadId:data.threadId};}
}

function encodeMimeMessage(message={}){const to=(message.to||[]).join(", ");const cc=(message.cc||[]).join(", ");const lines=[`To: ${to}`,...(cc?[`Cc: ${cc}`]:[]),`Subject: ${message.subject||""}`,"Content-Type: text/plain; charset=UTF-8","",message.body||""];return Buffer.from(lines.join("\r\n"),"utf8").toString("base64url");}

class GoogleCalendarClient {
  constructor({apiClient,calendarId="primary"}={}){if(!apiClient?.request)throw new Error("apiClient is required");this.api=apiClient;this.calendarId=calendarId;}
  async listEvents({start,end,query}={}){const params=new URLSearchParams({timeMin:required(start,"start"),timeMax:required(end,"end"),singleEvents:"true",orderBy:"startTime"});if(query)params.set("q",query);const url=`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events?${params}`;const data=await this.api.request(url);return (data.items||[]).map(normalizeCalendarEvent);}
  async createEvent(event){const url=`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(event.calendarId||this.calendarId)}/events`;return normalizeCalendarEvent(await this.api.request(url,{method:"POST",body:toGoogleEvent(event)}));}
  async updateEvent(eventId,patch){const id=required(eventId,"eventId");const url=`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(id)}`;return normalizeCalendarEvent(await this.api.request(url,{method:"PATCH",body:toGoogleEvent(patch,true)}));}
}
function toGoogleEvent(event={},partial=false){const out={};if(event.title!==undefined)out.summary=event.title;if(event.description!==undefined)out.description=event.description;if(event.location!==undefined)out.location=event.location;if(event.start!==undefined)out.start={dateTime:event.start,...(event.timeZone?{timeZone:event.timeZone}:{})};if(event.end!==undefined)out.end={dateTime:event.end,...(event.timeZone?{timeZone:event.timeZone}:{})};if(event.attendees!==undefined)out.attendees=(event.attendees||[]).map(a=>typeof a==="string"?{email:a}:a);if(!partial&&(!out.summary||!out.start||!out.end))throw new Error("title, start and end are required");return out;}
function normalizeCalendarEvent(item={}){return {id:item.id,title:item.summary||"",start:item.start?.dateTime||item.start?.date,end:item.end?.dateTime||item.end?.date,location:item.location,description:item.description,attendees:(item.attendees||[]).map(a=>a.email).filter(Boolean),htmlLink:item.htmlLink,status:item.status};}

module.exports={GoogleApiClient,GmailClient,GoogleCalendarClient,normalizeGmailMessage,normalizeCalendarEvent,encodeMimeMessage,toGoogleEvent};
