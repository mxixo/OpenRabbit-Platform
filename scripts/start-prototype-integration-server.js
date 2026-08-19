"use strict";

require("dotenv").config();
const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const{URL}=require("url");
const{ConnectionRegistry}=require("../integrations/connection-registry");
const{GmailOAuthAdapter,CALENDAR_SCOPE}=require("../integrations/google/gmail-oauth");
const{HubSpotOAuthAdapter}=require("../integrations/hubspot-oauth");
const{AgentGateway}=require("../integrations/agent-gateway");
const{OpenAIResponsesProvider}=require("../integrations/openai-responses-provider");

const PORT=Number(process.env.OPENRABBIT_PROTOTYPE_PORT||8787);
const APP_ORIGIN=process.env.OPENRABBIT_APP_ORIGIN||`http://localhost:${PORT}`;
const USER_ID=process.env.OPENRABBIT_PROTOTYPE_USER_ID||"prototype-user";
const STATIC_ROOT=path.resolve(__dirname,"../clients/openrabbit-command-center");
const SCAN_INTERVAL_MS=Math.max(60000,Number(process.env.OPENRABBIT_SCAN_INTERVAL_MS||600000));
const auditEvents=[],approvals=[],meetingProposals=[];
const scannedMessageIds=new Set();
const registry=new ConnectionRegistry({});

const gmailConfigured=Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET);
const gmail=gmailConfigured?new GmailOAuthAdapter({clientId:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET,redirectUri:process.env.GOOGLE_REDIRECT_URI||`${APP_ORIGIN}/api/integrations/gmail/callback`,registry}):null;
const hubspotConfigured=Boolean((process.env.HUBSPOT_CLIENT_ID&&process.env.HUBSPOT_CLIENT_SECRET)||process.env.HUBSPOT_ACCESS_TOKEN);
const hubspotOAuth=process.env.HUBSPOT_CLIENT_ID&&process.env.HUBSPOT_CLIENT_SECRET?new HubSpotOAuthAdapter({clientId:process.env.HUBSPOT_CLIENT_ID,clientSecret:process.env.HUBSPOT_CLIENT_SECRET,redirectUri:process.env.HUBSPOT_REDIRECT_URI||`${APP_ORIGIN}/api/integrations/hubspot/callback`,registry}):null;
const hubspotApi=hubspotOAuth||(process.env.HUBSPOT_ACCESS_TOKEN?new HubSpotOAuthAdapter({clientId:"static",clientSecret:"static",redirectUri:APP_ORIGIN,registry}):null);
const openAIProvider=process.env.OPENAI_API_KEY?new OpenAIResponsesProvider({apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||"gpt-5.6"}):null;
const configuredProviderTools=(()=>{try{return JSON.parse(process.env.OPENRABBIT_OPENAI_TOOLS_JSON||"[]")}catch{return[]}})();
const recordAudit=async event=>{auditEvents.push({...event,timestamp:event.timestamp||new Date().toISOString()});if(auditEvents.length>300)auditEvents.shift()};
const agentGateway=new AgentGateway({providers:openAIProvider?{openai:openAIProvider}:{},approvalPolicy:{requiresApproval:a=>Boolean(a?.external||a?.consequential)},audit:{record:recordAudit}});

function sendJson(res,status,body){const p=JSON.stringify(body);res.writeHead(status,{"content-type":"application/json; charset=utf-8","content-length":Buffer.byteLength(p)});res.end(p)}
function redirect(res,location){res.writeHead(302,{location});res.end()}
function safeAppPath(p){return(!p||!p.startsWith("/")||p.startsWith("//"))?"/index.html":p}
function contentType(f){return({".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"})[path.extname(f)]||"application/octet-stream"}
function serveStatic(urlPath,res){const requested=urlPath==="/"?"/index.html":urlPath,file=path.resolve(STATIC_ROOT,`.${requested}`);if(!file.startsWith(`${STATIC_ROOT}${path.sep}`)||!fs.existsSync(file)||!fs.statSync(file).isFile())return false;const data=fs.readFileSync(file);res.writeHead(200,{"content-type":contentType(file),"content-length":data.length,"cache-control":"no-store"});res.end(data);return true}
async function readJson(req,{maxBytes=200000}={}){return new Promise((resolve,reject)=>{let size=0,raw="";req.setEncoding("utf8");req.on("data",c=>{size+=Buffer.byteLength(c);if(size>maxBytes){reject(new Error("Request body too large"));req.destroy();return}raw+=c});req.on("end",()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(new Error("Invalid JSON body"))}});req.on("error",reject)})}
function hasScope(c,scope){return Boolean(c?.scopes?.includes(scope))}
function extractEmail(v){const m=String(v||"").match(/<([^>]+)>/);return(m?m[1]:String(v||"")).trim().toLowerCase()}
function parseJsonText(text){const raw=String(text||"").trim().replace(/^```json\s*/i,"").replace(/```$/," ").trim();try{return JSON.parse(raw)}catch{const a=raw.indexOf("["),b=raw.lastIndexOf("]");if(a>=0&&b>a){try{return JSON.parse(raw.slice(a,b+1))}catch{}}const c=raw.indexOf("{"),d=raw.lastIndexOf("}");if(c>=0&&d>c){try{return JSON.parse(raw.slice(c,d+1))}catch{}}return[]}}

async function activeGmailConnection(){if(!gmail)return null;let c=await registry.findProviderConnection({userId:USER_ID,provider:"gmail"});if(!c)return null;if(c.expiresAt&&c.expiresAt<=Date.now()+60000&&c.refreshToken){const r=await gmail.refresh(c.refreshToken);await registry.save({...c,accessToken:r.access_token,refreshToken:r.refresh_token||c.refreshToken,expiresAt:Date.now()+Number(r.expires_in||3600)*1000,scopes:c.scopes});c=await registry.findProviderConnection({userId:USER_ID,provider:"gmail"})}return c}
async function activeHubSpotConnection(){if(process.env.HUBSPOT_ACCESS_TOKEN)return{provider:"hubspot",accountId:process.env.HUBSPOT_PORTAL_ID||"private-app",accessToken:process.env.HUBSPOT_ACCESS_TOKEN,scopes:["crm.objects.contacts.read","crm.objects.deals.read"]};if(!hubspotOAuth)return null;let c=await registry.findProviderConnection({userId:USER_ID,provider:"hubspot"});if(!c)return null;if(c.expiresAt&&c.expiresAt<=Date.now()+60000&&c.refreshToken){const r=await hubspotOAuth.refresh(c.refreshToken);await registry.save({...c,accessToken:r.access_token,refreshToken:r.refresh_token||c.refreshToken,expiresAt:Date.now()+Number(r.expires_in||1800)*1000,scopes:c.scopes});c=await registry.findProviderConnection({userId:USER_ID,provider:"hubspot"})}return c}

async function scanInboxForMeetings({force=false}={}){
  const c=await activeGmailConnection();
  if(!c||!openAIProvider)return{scanned:0,created:0,reason:"gmail-or-openai-not-connected"};
  const inbox=await gmail.listInbox({accessToken:c.accessToken,maxResults:20,query:"in:inbox newer_than:3d"});
  const candidates=(inbox.messages||[]).filter(m=>force||!scannedMessageIds.has(m.id));
  candidates.forEach(m=>scannedMessageIds.add(m.id));
  if(!candidates.length)return{scanned:0,created:0};
  const prompt=[
    "Identify only emails that clearly imply a meeting, appointment, call, showing, inspection, closing, tour, consultation, or scheduled conversation.",
    "Return ONLY a JSON array. Each item must be {messageId,title,start,end,location,attendees,confidence,rationale}.",
    "confidence must be a number from 0 to 1.",
    "Use ISO-8601 datetimes only when the email gives enough evidence. If the date or time is ambiguous, set start and end to null; never guess.",
    "Default duration to 60 minutes only when a start time is explicit but no end time is stated.",
    `Current time: ${new Date().toISOString()}`,
    `Emails: ${JSON.stringify(candidates.map(m=>({messageId:m.id,from:m.from,to:m.to,subject:m.subject,date:m.date,snippet:m.snippet,bodyText:m.bodyText||""})))}`
  ].join("\n");
  const result=await openAIProvider.run({input:prompt,context:{workspace:"background-inbox-scan",policy:"Extract meeting proposals only. Never invent missing date/time."}});
  const extracted=parseJsonText(result.text);
  let created=0;
  for(const item of Array.isArray(extracted)?extracted:[]){
    if(!item||!item.messageId||!candidates.some(m=>m.id===item.messageId))continue;
    if(meetingProposals.some(p=>p.sourceMessageId===item.messageId&&p.status==="pending"))continue;
    const source=candidates.find(m=>m.id===item.messageId),rawConfidence=Number(item.confidence||0),confidence=Math.max(0,Math.min(1,rawConfidence>1?rawConfidence/100:rawConfidence));
    const proposal={id:crypto.randomUUID(),type:"meeting",status:"pending",source:"gmail",sourceMessageId:item.messageId,sourceSubject:source?.subject||"",sourceFrom:source?.from||"",title:String(item.title||source?.subject||"Proposed meeting"),start:item.start||null,end:item.end||null,location:item.location||"",attendees:Array.isArray(item.attendees)?item.attendees.filter(Boolean):[],confidence,rationale:String(item.rationale||"Identified from email"),createdAt:new Date().toISOString()};
    meetingProposals.unshift(proposal);created++;
    await recordAudit({type:"meeting.proposed",provider:"gmail",proposalId:proposal.id,summary:proposal.title,sourceMessageId:proposal.sourceMessageId});
  }
  if(meetingProposals.length>100)meetingProposals.length=100;
  await recordAudit({type:"scan.completed",provider:"gmail",summary:`Scanned ${candidates.length} message(s); ${created} meeting proposal(s) created`});
  return{scanned:candidates.length,created};
}

async function approveMeetingProposal(proposal){
  const c=await activeGmailConnection();
  if(!c||!hasScope(c,CALENDAR_SCOPE))throw new Error("Calendar write permission not granted");
  if(!proposal.start||!proposal.end)throw new Error("Proposal needs a confirmed date and time before it can be added");
  const event=await gmail.createCalendarEvent({accessToken:c.accessToken,summary:proposal.title,start:proposal.start,end:proposal.end,description:`Proposed by OpenRabbit from Gmail.\n\n${proposal.rationale}\nSource: ${proposal.sourceSubject}`,location:proposal.location,attendees:proposal.attendees});
  proposal.status="approved";proposal.calendarEventId=event.id;proposal.calendarHtmlLink=event.htmlLink;proposal.decidedAt=new Date().toISOString();
  await recordAudit({type:"meeting.approved",provider:"calendar",proposalId:proposal.id,summary:proposal.title,calendarEventId:event.id});
  return proposal;
}

const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,APP_ORIGIN);
  if(req.method==="GET"&&url.pathname==="/api/health")return sendJson(res,200,{ok:true,service:"openrabbit-prototype",gmailConfigured,hubspotConfigured,openaiConfigured:Boolean(openAIProvider),googleMapsConfigured:Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY),providerToolCount:configuredProviderTools.length,approvalCount:approvals.length,meetingProposalCount:meetingProposals.filter(p=>p.status==="pending").length,scanIntervalMs:SCAN_INTERVAL_MS});
  if(req.method==="GET"&&url.pathname==="/api/config/public")return sendJson(res,200,{appOrigin:APP_ORIGIN,googleMapsBrowserKey:process.env.GOOGLE_MAPS_BROWSER_KEY||null,openaiConfigured:Boolean(openAIProvider),gmailConfigured,hubspotConfigured,scanIntervalMs:SCAN_INTERVAL_MS});
  if(req.method==="GET"&&url.pathname==="/api/integrations/status"){const[g,h]=await Promise.all([activeGmailConnection(),activeHubSpotConnection()]);return sendJson(res,200,{gmail:{configured:gmailConfigured,connected:Boolean(g),accountId:g?.accountId||null,scopes:g?.scopes||[]},calendar:{configured:gmailConfigured,connected:hasScope(g,CALENDAR_SCOPE),accountId:g?.accountId||null},openai:{configured:Boolean(openAIProvider),model:openAIProvider?.model||null},googleMaps:{configured:Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY)},hubspot:{configured:hubspotConfigured,connected:Boolean(h),accountId:h?.accountId||null,mode:process.env.HUBSPOT_ACCESS_TOKEN?"private-app":"oauth"},proactive:{meetingProposals:meetingProposals.filter(p=>p.status==="pending").length,scanIntervalMs:SCAN_INTERVAL_MS}})}

  if(req.method==="GET"&&url.pathname==="/api/integrations/gmail/connect"){if(!gmail)return sendJson(res,503,{error:"Google OAuth is not configured"});const{url:auth}=gmail.authorizationUrl({userId:USER_ID,redirectTo:safeAppPath(url.searchParams.get("redirectTo")||"/communications.html")});return redirect(res,auth)}
  if(req.method==="GET"&&url.pathname==="/api/integrations/calendar/connect"){if(!gmail)return sendJson(res,503,{error:"Google OAuth is not configured"});const{url:auth}=gmail.authorizationUrl({userId:USER_ID,redirectTo:safeAppPath(url.searchParams.get("redirectTo")||"/calendar.html")});return redirect(res,auth)}
  if(req.method==="GET"&&url.pathname==="/api/integrations/gmail/callback"){if(!gmail)return sendJson(res,503,{error:"Google OAuth is not configured"});if(url.searchParams.get("error"))return redirect(res,"/connections.html?google=error");const code=url.searchParams.get("code"),state=url.searchParams.get("state");if(!code||!state)return sendJson(res,400,{error:"Missing OAuth code/state"});const r=await gmail.exchangeCode({code,state});await recordAudit({type:"integration.connected",provider:"google",actor:USER_ID,accountId:r.accountId,scopes:r.scopes});setTimeout(()=>scanInboxForMeetings().catch(e=>recordAudit({type:"scan.error",provider:"gmail",summary:e.message})),1500);return redirect(res,`${safeAppPath(r.redirectTo)}?google=connected`)}
  if(req.method==="GET"&&url.pathname==="/api/integrations/gmail/status"){const c=await activeGmailConnection();return sendJson(res,200,c?{connected:true,configured:true,accountId:c.accountId,scopes:c.scopes}:{connected:false,configured:gmailConfigured})}
  if(req.method==="GET"&&url.pathname==="/api/integrations/calendar/status"){const c=await activeGmailConnection();return sendJson(res,200,{configured:gmailConfigured,connected:hasScope(c,CALENDAR_SCOPE),accountId:c?.accountId||null,scope:CALENDAR_SCOPE})}
  if(req.method==="GET"&&url.pathname==="/api/integrations/gmail/inbox"){const c=await activeGmailConnection();if(!c)return sendJson(res,401,{error:"Gmail not connected"});const inbox=await gmail.listInbox({accessToken:c.accessToken,maxResults:Math.max(1,Math.min(30,Number(url.searchParams.get("limit")||12))),query:url.searchParams.get("q")||"in:inbox"});return sendJson(res,200,{connected:true,accountId:c.accountId,...inbox})}
  if(req.method==="POST"&&url.pathname==="/api/integrations/gmail/drafts"){const c=await activeGmailConnection();if(!c)return sendJson(res,401,{error:"Gmail not connected"});const b=await readJson(req);if(!b.to)return sendJson(res,400,{error:"to is required"});const draft=await gmail.createDraft({accessToken:c.accessToken,to:b.to,subject:b.subject||"",body:b.body||""});await recordAudit({type:"email.draft.created",provider:"gmail",summary:b.subject||`Draft to ${b.to}`,draftId:draft.id});return sendJson(res,201,{draft})}
  if(req.method==="POST"&&url.pathname==="/api/integrations/gmail/send"){const c=await activeGmailConnection();if(!c)return sendJson(res,401,{error:"Gmail not connected"});const b=await readJson(req);if(!b.to)return sendJson(res,400,{error:"to is required"});if(!b.approved)return sendJson(res,409,{error:"Explicit approval required before sending",requiresApproval:true});const message=await gmail.sendEmail({accessToken:c.accessToken,to:b.to,subject:b.subject||"",body:b.body||""});await recordAudit({type:"email.sent",provider:"gmail",summary:b.subject||`Email to ${b.to}`,messageId:message.id});return sendJson(res,200,{message})}

  if(req.method==="GET"&&url.pathname==="/api/integrations/calendar/events"){const c=await activeGmailConnection();if(!c)return sendJson(res,401,{error:"Google account not connected"});if(!hasScope(c,CALENDAR_SCOPE))return sendJson(res,403,{error:"Calendar permission not granted",reconnect:"/api/integrations/calendar/connect?redirectTo=/calendar.html"});const now=new Date(),timeMin=url.searchParams.get("timeMin")||new Date(now.getTime()-12*60*60*1000).toISOString(),timeMax=url.searchParams.get("timeMax")||new Date(now.getTime()+7*24*60*60*1000).toISOString();const data=await gmail.listCalendarEvents({accessToken:c.accessToken,timeMin,timeMax,maxResults:Math.max(1,Math.min(100,Number(url.searchParams.get("limit")||30)))});return sendJson(res,200,{connected:true,accountId:c.accountId,...data})}
  if(req.method==="POST"&&url.pathname==="/api/integrations/calendar/events"){const c=await activeGmailConnection();if(!c||!hasScope(c,CALENDAR_SCOPE))return sendJson(res,401,{error:"Calendar not connected with write access"});const b=await readJson(req);if(!b.approved)return sendJson(res,409,{error:"Explicit approval required before creating a calendar event",requiresApproval:true});if(!b.summary||!b.start||!b.end)return sendJson(res,400,{error:"summary, start and end are required"});const event=await gmail.createCalendarEvent({accessToken:c.accessToken,summary:b.summary,start:b.start,end:b.end,description:b.description||"",location:b.location||"",attendees:Array.isArray(b.attendees)?b.attendees:[]});await recordAudit({type:"calendar.event.created",provider:"calendar",summary:b.summary,calendarEventId:event.id});return sendJson(res,201,{event})}
  const calendarDelete=url.pathname.match(/^\/api\/integrations\/calendar\/events\/([^/]+)$/);
  if(req.method==="DELETE"&&calendarDelete){const c=await activeGmailConnection();if(!c||!hasScope(c,CALENDAR_SCOPE))return sendJson(res,401,{error:"Calendar not connected with write access"});const b=await readJson(req);if(!b.approved)return sendJson(res,409,{error:"Explicit approval required before deleting a calendar event",requiresApproval:true});await gmail.deleteCalendarEvent({accessToken:c.accessToken,eventId:calendarDelete[1]});await recordAudit({type:"calendar.event.deleted",provider:"calendar",summary:b.summary||calendarDelete[1],calendarEventId:calendarDelete[1]});return sendJson(res,200,{deleted:true,eventId:calendarDelete[1]})}

  if(req.method==="GET"&&url.pathname==="/api/proactive/meeting-proposals")return sendJson(res,200,{proposals:meetingProposals,scanIntervalMs:SCAN_INTERVAL_MS});
  if(req.method==="POST"&&url.pathname==="/api/proactive/scan"){const b=await readJson(req);return sendJson(res,200,await scanInboxForMeetings({force:Boolean(b.force)}))}
  const proposalMatch=url.pathname.match(/^\/api\/proactive\/meeting-proposals\/([^/]+)\/(approve|reject)$/);
  if(req.method==="POST"&&proposalMatch){const proposal=meetingProposals.find(p=>p.id===proposalMatch[1]);if(!proposal)return sendJson(res,404,{error:"Meeting proposal not found"});if(proposal.status!=="pending")return sendJson(res,409,{error:"Proposal already decided",proposal});if(proposalMatch[2]==="reject"){proposal.status="rejected";proposal.decidedAt=new Date().toISOString();await recordAudit({type:"meeting.rejected",provider:"calendar",proposalId:proposal.id,summary:proposal.title});return sendJson(res,200,{proposal})}return sendJson(res,200,{proposal:await approveMeetingProposal(proposal)})}

  if(req.method==="GET"&&url.pathname==="/api/integrations/hubspot/connect"){if(!hubspotOAuth)return sendJson(res,503,{error:"HubSpot OAuth is not configured"});const{url:auth}=hubspotOAuth.authorizationUrl({userId:USER_ID,redirectTo:safeAppPath(url.searchParams.get("redirectTo")||"/crm.html")});return redirect(res,auth)}
  if(req.method==="GET"&&url.pathname==="/api/integrations/hubspot/callback"){if(!hubspotOAuth)return sendJson(res,503,{error:"HubSpot OAuth is not configured"});if(url.searchParams.get("error"))return redirect(res,"/connections.html?hubspot=error");const code=url.searchParams.get("code"),state=url.searchParams.get("state");if(!code||!state)return sendJson(res,400,{error:"Missing OAuth code/state"});const r=await hubspotOAuth.exchangeCode({code,state});await recordAudit({type:"integration.connected",provider:"hubspot",actor:USER_ID,accountId:r.accountId});return redirect(res,`${safeAppPath(r.redirectTo)}?hubspot=connected`)}
  if(req.method==="GET"&&url.pathname==="/api/integrations/hubspot/status"){const c=await activeHubSpotConnection();return sendJson(res,200,c?{connected:true,configured:true,accountId:c.accountId,mode:process.env.HUBSPOT_ACCESS_TOKEN?"private-app":"oauth"}:{connected:false,configured:hubspotConfigured})}
  if(req.method==="GET"&&url.pathname==="/api/integrations/hubspot/contacts"){const c=await activeHubSpotConnection();if(!c)return sendJson(res,401,{error:"HubSpot not connected"});return sendJson(res,200,await hubspotApi.listContacts({accessToken:c.accessToken,limit:Number(url.searchParams.get("limit")||20)}))}
  if(req.method==="GET"&&url.pathname==="/api/integrations/hubspot/deals"){const c=await activeHubSpotConnection();if(!c)return sendJson(res,401,{error:"HubSpot not connected"});return sendJson(res,200,await hubspotApi.listDeals({accessToken:c.accessToken,limit:Number(url.searchParams.get("limit")||20)}))}
  if(req.method==="GET"&&url.pathname==="/api/integrations/hubspot/match"){const c=await activeHubSpotConnection();if(!c)return sendJson(res,200,{connected:false,match:null});const email=extractEmail(url.searchParams.get("email"));if(!email)return sendJson(res,400,{error:"email is required"});const match=await hubspotApi.searchContactByEmail({accessToken:c.accessToken,email});return sendJson(res,200,{connected:true,email,match})}

  if(req.method==="POST"&&url.pathname==="/api/agent/run"){if(!openAIProvider)return sendJson(res,503,{error:"OpenAI provider is not configured"});const body=await readJson(req),input=String(body.input||"").trim();if(!input)return sendJson(res,400,{error:"input is required"});const context={...(body.context&&typeof body.context==="object"?body.context:{}),pendingMeetingProposals:meetingProposals.filter(p=>p.status==="pending").slice(0,10)};const result=await agentGateway.run({provider:"openai",input,context,providerTools:configuredProviderTools,actor:{type:"prototype-user",id:USER_ID}});return sendJson(res,200,{text:result.text,responseId:result.responseId,model:result.model,toolTrace:result.toolTrace,proposedActions:result.proposedActions})}

  if(req.method==="POST"&&url.pathname==="/api/approvals"){const body=await readJson(req),record={id:crypto.randomUUID(),status:"pending",type:String(body.type||"action"),summary:String(body.summary||"Approval requested"),payload:body.payload||{},context:body.context||{},createdAt:new Date().toISOString(),createdBy:USER_ID};approvals.unshift(record);if(approvals.length>100)approvals.pop();await recordAudit({type:"approval.created",actor:USER_ID,approvalId:record.id,summary:record.summary});return sendJson(res,201,record)}
  if(req.method==="GET"&&url.pathname==="/api/approvals")return sendJson(res,200,{approvals});
  const approvalMatch=url.pathname.match(/^\/api\/approvals\/([^/]+)\/(approve|reject)$/);if(req.method==="POST"&&approvalMatch){const record=approvals.find(a=>a.id===approvalMatch[1]);if(!record)return sendJson(res,404,{error:"Approval not found"});if(record.status!=="pending")return sendJson(res,409,{error:"Approval already decided",approval:record});record.status=approvalMatch[2]==="approve"?"approved":"rejected";record.decidedAt=new Date().toISOString();record.decidedBy=USER_ID;await recordAudit({type:`approval.${record.status}`,actor:USER_ID,approvalId:record.id,summary:record.summary});return sendJson(res,200,record)}
  if(req.method==="GET"&&url.pathname==="/api/audit")return sendJson(res,200,{events:auditEvents.slice().reverse()});
  if(req.method==="GET"&&serveStatic(url.pathname,res))return;
  return sendJson(res,404,{error:"Not found"});
}catch(error){console.error(error);return sendJson(res,500,{error:error.message||"Prototype integration server failed"})}});

server.listen(PORT,()=>{
  console.log(`OpenRabbit prototype running at ${APP_ORIGIN}`);
  console.log(`Proactive Gmail scan every ${Math.round(SCAN_INTERVAL_MS/60000)} minute(s) while this server is running.`);
  setTimeout(()=>scanInboxForMeetings().catch(e=>recordAudit({type:"scan.error",provider:"gmail",summary:e.message})),2500);
  setInterval(()=>scanInboxForMeetings().catch(e=>recordAudit({type:"scan.error",provider:"gmail",summary:e.message})),SCAN_INTERVAL_MS).unref();
});