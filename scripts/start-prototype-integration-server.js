"use strict";

require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { ConnectionRegistry } = require("../integrations/connection-registry");
const { GmailOAuthAdapter } = require("../integrations/google/gmail-oauth");
const { HubSpotOAuthAdapter } = require("../integrations/hubspot-oauth");
const { AgentGateway } = require("../integrations/agent-gateway");
const { OpenAIResponsesProvider } = require("../integrations/openai-responses-provider");

const PORT = Number(process.env.OPENRABBIT_PROTOTYPE_PORT || 8787);
const APP_ORIGIN = process.env.OPENRABBIT_APP_ORIGIN || `http://localhost:${PORT}`;
const USER_ID = process.env.OPENRABBIT_PROTOTYPE_USER_ID || "prototype-user";
const STATIC_ROOT = path.resolve(__dirname, "../clients/openrabbit-command-center");
const auditEvents = [];

const registry = new ConnectionRegistry({});
const gmailConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const gmail = gmailConfigured ? new GmailOAuthAdapter({clientId:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET,redirectUri:process.env.GOOGLE_REDIRECT_URI||`${APP_ORIGIN}/api/integrations/gmail/callback`,registry}) : null;
const hubspotConfigured = Boolean((process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET) || process.env.HUBSPOT_ACCESS_TOKEN);
const hubspotOAuth = process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET ? new HubSpotOAuthAdapter({clientId:process.env.HUBSPOT_CLIENT_ID,clientSecret:process.env.HUBSPOT_CLIENT_SECRET,redirectUri:process.env.HUBSPOT_REDIRECT_URI||`${APP_ORIGIN}/api/integrations/hubspot/callback`,registry}) : null;
const hubspotApi = hubspotOAuth || (process.env.HUBSPOT_ACCESS_TOKEN ? new HubSpotOAuthAdapter({clientId:"static",clientSecret:"static",redirectUri:APP_ORIGIN,registry}) : null);
const openAIProvider = process.env.OPENAI_API_KEY ? new OpenAIResponsesProvider({apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||"gpt-5.6"}) : null;
const configuredProviderTools=(()=>{try{return JSON.parse(process.env.OPENRABBIT_OPENAI_TOOLS_JSON||"[]")}catch{return []}})();
const agentGateway=new AgentGateway({providers:openAIProvider?{openai:openAIProvider}:{},approvalPolicy:{requiresApproval:(a)=>Boolean(a?.external||a?.consequential)},audit:{record:async(e)=>{auditEvents.push(e);if(auditEvents.length>100)auditEvents.shift()}}});

function sendJson(res,status,body){const p=JSON.stringify(body);res.writeHead(status,{"content-type":"application/json; charset=utf-8","content-length":Buffer.byteLength(p)});res.end(p)}
function redirect(res,location){res.writeHead(302,{location});res.end()}
function safeAppPath(p){return(!p||!p.startsWith("/")||p.startsWith("//"))?"/index.html":p}
function contentType(f){return({".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"})[path.extname(f)]||"application/octet-stream"}
function serveStatic(urlPath,res){const requested=urlPath==="/"?"/index.html":urlPath;const file=path.resolve(STATIC_ROOT,`.${requested}`);if(!file.startsWith(`${STATIC_ROOT}${path.sep}`)||!fs.existsSync(file)||!fs.statSync(file).isFile())return false;const data=fs.readFileSync(file);res.writeHead(200,{"content-type":contentType(file),"content-length":data.length,"cache-control":"no-store"});res.end(data);return true}
async function readJson(req,{maxBytes=100000}={}){return new Promise((resolve,reject)=>{let size=0,raw="";req.setEncoding("utf8");req.on("data",c=>{size+=Buffer.byteLength(c);if(size>maxBytes){reject(new Error("Request body too large"));req.destroy();return}raw+=c});req.on("end",()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(new Error("Invalid JSON body"))}});req.on("error",reject)})}
async function activeGmailConnection(){if(!gmail)return null;let c=await registry.findProviderConnection({userId:USER_ID,provider:"gmail"});if(!c)return null;if(c.expiresAt&&c.expiresAt<=Date.now()+60000&&c.refreshToken){const r=await gmail.refresh(c.refreshToken);await registry.save({...c,accessToken:r.access_token,refreshToken:r.refresh_token||c.refreshToken,expiresAt:Date.now()+Number(r.expires_in||3600)*1000,scopes:c.scopes});c=await registry.findProviderConnection({userId:USER_ID,provider:"gmail"})}return c}
async function activeHubSpotConnection(){if(process.env.HUBSPOT_ACCESS_TOKEN)return{provider:"hubspot",accountId:process.env.HUBSPOT_PORTAL_ID||"private-app",accessToken:process.env.HUBSPOT_ACCESS_TOKEN,scopes:["crm.objects.contacts.read","crm.objects.deals.read"]};if(!hubspotOAuth)return null;let c=await registry.findProviderConnection({userId:USER_ID,provider:"hubspot"});if(!c)return null;if(c.expiresAt&&c.expiresAt<=Date.now()+60000&&c.refreshToken){const r=await hubspotOAuth.refresh(c.refreshToken);await registry.save({...c,accessToken:r.access_token,refreshToken:r.refresh_token||c.refreshToken,expiresAt:Date.now()+Number(r.expires_in||1800)*1000,scopes:c.scopes});c=await registry.findProviderConnection({userId:USER_ID,provider:"hubspot"})}return c}
function extractEmail(v){const m=String(v||"").match(/<([^>]+)>/);return (m?m[1]:String(v||"")).trim().toLowerCase()}

const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,APP_ORIGIN);
 if(req.method==="GET"&&url.pathname==="/api/health")return sendJson(res,200,{ok:true,service:"openrabbit-prototype",gmailConfigured,hubspotConfigured,openaiConfigured:Boolean(openAIProvider),googleMapsConfigured:Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY),providerToolCount:configuredProviderTools.length});
 if(req.method==="GET"&&url.pathname==="/api/config/public")return sendJson(res,200,{appOrigin:APP_ORIGIN,googleMapsBrowserKey:process.env.GOOGLE_MAPS_BROWSER_KEY||null,openaiConfigured:Boolean(openAIProvider),gmailConfigured,hubspotConfigured});
 if(req.method==="GET"&&url.pathname==="/api/integrations/status"){const[g,h]=await Promise.all([activeGmailConnection(),activeHubSpotConnection()]);return sendJson(res,200,{gmail:{configured:gmailConfigured,connected:Boolean(g),accountId:g?.accountId||null},openai:{configured:Boolean(openAIProvider),model:openAIProvider?.model||null},googleMaps:{configured:Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY)},hubspot:{configured:hubspotConfigured,connected:Boolean(h),accountId:h?.accountId||null,mode:process.env.HUBSPOT_ACCESS_TOKEN?"private-app":"oauth"}})}
 if(req.method==="GET"&&url.pathname==="/api/integrations/gmail/connect"){if(!gmail)return sendJson(res,503,{error:"Gmail OAuth is not configured"});const{url:auth}=gmail.authorizationUrl({userId:USER_ID,redirectTo:safeAppPath(url.searchParams.get("redirectTo")||"/communications.html")});return redirect(res,auth)}
 if(req.method==="GET"&&url.pathname==="/api/integrations/gmail/callback"){if(!gmail)return sendJson(res,503,{error:"Gmail OAuth is not configured"});if(url.searchParams.get("error"))return redirect(res,`/communications.html?gmail=error`);const code=url.searchParams.get("code"),state=url.searchParams.get("state");if(!code||!state)return sendJson(res,400,{error:"Missing OAuth code/state"});const r=await gmail.exchangeCode({code,state});return redirect(res,`${safeAppPath(r.redirectTo)}?gmail=connected`)}
 if(req.method==="GET"&&url.pathname==="/api/integrations/gmail/status"){const c=await activeGmailConnection();return sendJson(res,200,c?{connected:true,configured:true,accountId:c.accountId,scopes:c.scopes}:{connected:false,configured:gmailConfigured})}
 if(req.method==="GET"&&url.pathname==="/api/integrations/gmail/inbox"){const c=await activeGmailConnection();if(!c)return sendJson(res,401,{error:"Gmail not connected"});const inbox=await gmail.listInbox({accessToken:c.accessToken,maxResults:Math.max(1,Math.min(30,Number(url.searchParams.get("limit")||12))),query:url.searchParams.get("q")||"in:inbox"});return sendJson(res,200,{connected:true,accountId:c.accountId,...inbox})}
 if(req.method==="GET"&&url.pathname==="/api/integrations/hubspot/connect"){if(!hubspotOAuth)return sendJson(res,503,{error:"HubSpot OAuth is not configured"});const{url:auth}=hubspotOAuth.authorizationUrl({userId:USER_ID,redirectTo:safeAppPath(url.searchParams.get("redirectTo")||"/crm.html")});return redirect(res,auth)}
 if(req.method==="GET"&&url.pathname==="/api/integrations/hubspot/callback"){if(!hubspotOAuth)return sendJson(res,503,{error:"HubSpot OAuth is not configured"});if(url.searchParams.get("error"))return redirect(res,"/connections.html?hubspot=error");const code=url.searchParams.get("code"),state=url.searchParams.get("state");if(!code||!state)return sendJson(res,400,{error:"Missing OAuth code/state"});const r=await hubspotOAuth.exchangeCode({code,state});return redirect(res,`${safeAppPath(r.redirectTo)}?hubspot=connected`)}
 if(req.method==="GET"&&url.pathname==="/api/integrations/hubspot/status"){const c=await activeHubSpotConnection();return sendJson(res,200,c?{connected:true,configured:true,accountId:c.accountId,mode:process.env.HUBSPOT_ACCESS_TOKEN?"private-app":"oauth"}:{connected:false,configured:hubspotConfigured})}
 if(req.method==="GET"&&url.pathname==="/api/integrations/hubspot/contacts"){const c=await activeHubSpotConnection();if(!c)return sendJson(res,401,{error:"HubSpot not connected"});return sendJson(res,200,await hubspotApi.listContacts({accessToken:c.accessToken,limit:Number(url.searchParams.get("limit")||20)}))}
 if(req.method==="GET"&&url.pathname==="/api/integrations/hubspot/deals"){const c=await activeHubSpotConnection();if(!c)return sendJson(res,401,{error:"HubSpot not connected"});return sendJson(res,200,await hubspotApi.listDeals({accessToken:c.accessToken,limit:Number(url.searchParams.get("limit")||20)}))}
 if(req.method==="GET"&&url.pathname==="/api/integrations/hubspot/match"){const c=await activeHubSpotConnection();if(!c)return sendJson(res,200,{connected:false,match:null});const email=extractEmail(url.searchParams.get("email"));if(!email)return sendJson(res,400,{error:"email is required"});const match=await hubspotApi.searchContactByEmail({accessToken:c.accessToken,email});return sendJson(res,200,{connected:true,email,match})}
 if(req.method==="POST"&&url.pathname==="/api/agent/run"){if(!openAIProvider)return sendJson(res,503,{error:"OpenAI provider is not configured"});const body=await readJson(req);const input=String(body.input||"").trim();if(!input)return sendJson(res,400,{error:"input is required"});const context=body.context&&typeof body.context==="object"?body.context:{};const result=await agentGateway.run({provider:"openai",input,context,providerTools:configuredProviderTools,actor:{type:"prototype-user",id:USER_ID}});return sendJson(res,200,{text:result.text,responseId:result.responseId,model:result.model,toolTrace:result.toolTrace,proposedActions:result.proposedActions})}
 if(req.method==="GET"&&url.pathname==="/api/audit")return sendJson(res,200,{events:auditEvents.slice(-30).reverse()});
 if(req.method==="GET"&&serveStatic(url.pathname,res))return;
 return sendJson(res,404,{error:"Not found"});
}catch(error){console.error(error);return sendJson(res,500,{error:error.message||"Prototype integration server failed"})}});
server.listen(PORT,()=>console.log(`OpenRabbit prototype running at ${APP_ORIGIN}`));