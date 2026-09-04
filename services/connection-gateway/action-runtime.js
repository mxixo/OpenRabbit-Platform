"use strict";

function required(value, name) {
  const v = String(value || '').trim();
  if (!v) throw new Error(`${name} is required.`);
  return v;
}
function jsonBody(req, max=1024*1024) {
  return new Promise((resolve,reject)=>{let raw='';req.setEncoding('utf8');req.on('data',c=>{raw+=c;if(raw.length>max){reject(new Error('Request body too large.'));req.destroy();}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch{reject(new Error('Invalid JSON body.'));}});req.on('error',reject);});
}
async function fetchJson(url, options={}) {
  const response=await fetch(url,options);const text=await response.text();let body={};try{body=text?JSON.parse(text):{};}catch{body={message:text};}
  if(!response.ok)throw new Error(body?.error?.message||body?.message||body?.error||`Provider request failed (${response.status})`);return body;
}
function base64url(text){return Buffer.from(String(text),'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function emailAddress(value){const v=required(value,'Email recipient');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw new Error('A valid recipient email is required.');return v;}

async function sendGmail(accessToken,payload){
  const to=emailAddress(payload.to);const subject=required(payload.subject,'Email subject').slice(0,998);const body=required(payload.body||payload.text,'Email body');
  const raw=[`To: ${to}`,`Subject: ${subject}`,'MIME-Version: 1.0','Content-Type: text/plain; charset="UTF-8"','',body].join('\r\n');
  const result=await fetchJson('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify({raw:base64url(raw),threadId:payload.threadId||undefined})});
  return {ok:true,provider:'gmail',messageId:result.id,threadId:result.threadId};
}
async function createGoogleEvent(accessToken,payload){
  const summary=required(payload.summary||payload.title,'Event title');const start=required(payload.start,'Event start');const end=required(payload.end,'Event end');
  const event={summary,description:String(payload.description||''),location:String(payload.location||''),start:{dateTime:start,timeZone:payload.timeZone||undefined},end:{dateTime:end,timeZone:payload.timeZone||undefined}};
  if(Array.isArray(payload.attendees))event.attendees=payload.attendees.map(x=>({email:emailAddress(typeof x==='string'?x:x.email)}));
  const result=await fetchJson('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',{method:'POST',headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify(event)});
  return {ok:true,provider:'google-calendar',eventId:result.id,htmlLink:result.htmlLink||'',status:result.status||''};
}
async function updateHubSpot(accessToken,payload){
  const objectType=['contacts','deals','companies'].includes(payload.objectType)?payload.objectType:null;if(!objectType)throw new Error('HubSpot objectType must be contacts, deals, or companies.');
  const id=required(payload.id,'HubSpot record id');const properties=payload.properties&&typeof payload.properties==='object'?payload.properties:null;if(!properties||!Object.keys(properties).length)throw new Error('HubSpot properties are required.');
  const result=await fetchJson(`https://api.hubapi.com/crm/v3/objects/${objectType}/${encodeURIComponent(id)}`,{method:'PATCH',headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify({properties})});
  return {ok:true,provider:'hubspot',objectType,id:result.id,updatedAt:result.updatedAt||new Date().toISOString()};
}
module.exports={jsonBody,sendGmail,createGoogleEvent,updateHubSpot};
