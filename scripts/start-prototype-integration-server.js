"use strict";

require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { ConnectionRegistry } = require("../integrations/connection-registry");
const { GmailOAuthAdapter } = require("../integrations/google/gmail-oauth");
const { AgentGateway } = require("../integrations/agent-gateway");
const { OpenAIResponsesProvider } = require("../integrations/openai-responses-provider");

const PORT = Number(process.env.OPENRABBIT_PROTOTYPE_PORT || 8787);
const APP_ORIGIN = process.env.OPENRABBIT_APP_ORIGIN || `http://localhost:${PORT}`;
const USER_ID = process.env.OPENRABBIT_PROTOTYPE_USER_ID || "prototype-user";
const STATIC_ROOT = path.resolve(__dirname, "../clients/openrabbit-command-center");
const auditEvents = [];

const registry = new ConnectionRegistry({});
const gmailConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const gmail = gmailConfigured ? new GmailOAuthAdapter({ clientId:process.env.GOOGLE_CLIENT_ID, clientSecret:process.env.GOOGLE_CLIENT_SECRET, redirectUri:process.env.GOOGLE_REDIRECT_URI || `${APP_ORIGIN}/api/integrations/gmail/callback`, registry }) : null;
const openAIProvider = process.env.OPENAI_API_KEY ? new OpenAIResponsesProvider({ apiKey:process.env.OPENAI_API_KEY, model:process.env.OPENAI_MODEL || "gpt-5.6" }) : null;
const configuredProviderTools = (()=>{ try{return JSON.parse(process.env.OPENRABBIT_OPENAI_TOOLS_JSON || "[]")}catch{return []} })();
const agentGateway = new AgentGateway({ providers:openAIProvider?{openai:openAIProvider}:{}, approvalPolicy:{requiresApproval:(action)=>Boolean(action?.external||action?.consequential)}, audit:{record:async(event)=>{auditEvents.push(event);if(auditEvents.length>100)auditEvents.shift()}} });

function sendJson(res,status,body){const payload=JSON.stringify(body);res.writeHead(status,{"content-type":"application/json; charset=utf-8","content-length":Buffer.byteLength(payload)});res.end(payload)}
function redirect(res,location){res.writeHead(302,{location});res.end()}
function safeAppPath(pathname){return(!pathname||!pathname.startsWith("/")||pathname.startsWith("//"))?"/communications.html":pathname}
function contentType(file){return({".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"})[path.extname(file)]||"application/octet-stream"}
function serveStatic(urlPath,res){const requested=urlPath==="/"?"/index.html":urlPath;const file=path.resolve(STATIC_ROOT,`.${requested}`);if(!file.startsWith(`${STATIC_ROOT}${path.sep}`))return false;if(!fs.existsSync(file)||!fs.statSync(file).isFile())return false;const data=fs.readFileSync(file);res.writeHead(200,{"content-type":contentType(file),"content-length":data.length,"cache-control":"no-store"});res.end(data);return true}
async function readJson(req,{maxBytes=100000}={}){return new Promise((resolve,reject)=>{let size=0,raw="";req.setEncoding("utf8");req.on("data",chunk=>{size+=Buffer.byteLength(chunk);if(size>maxBytes){reject(new Error("Request body too large"));req.destroy();return}raw+=chunk});req.on("end",()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(new Error("Invalid JSON body"))}});req.on("error",reject)})}
async function activeGmailConnection(){if(!gmail)return null;let connection=await registry.findProviderConnection({userId:USER_ID,provider:"gmail"});if(!connection)return null;if(connection.expiresAt&&connection.expiresAt<=Date.now()+60000&&connection.refreshToken){const refreshed=await gmail.refresh(connection.refreshToken);await registry.save({...connection,accessToken:refreshed.access_token,refreshToken:refreshed.refresh_token||connection.refreshToken,expiresAt:Date.now()+Number(refreshed.expires_in||3600)*1000,scopes:connection.scopes});connection=await registry.findProviderConnection({userId:USER_ID,provider:"gmail"})}return connection}

const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,APP_ORIGIN);
  if(req.method==="GET"&&url.pathname==="/api/health")return sendJson(res,200,{ok:true,service:"openrabbit-prototype",gmailConfigured,openaiConfigured:Boolean(openAIProvider),googleMapsConfigured:Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY),providerToolCount:configuredProviderTools.length});
  if(req.method==="GET"&&url.pathname==="/api/config/public")return sendJson(res,200,{appOrigin:APP_ORIGIN,googleMapsBrowserKey:process.env.GOOGLE_MAPS_BROWSER_KEY||null,openaiConfigured:Boolean(openAIProvider),gmailConfigured});
  if(req.method==="GET"&&url.pathname==="/api/integrations/status"){const gmailConnection=await activeGmailConnection();return sendJson(res,200,{gmail:{configured:gmailConfigured,connected:Boolean(gmailConnection),accountId:gmailConnection?.accountId||null},openai:{configured:Boolean(openAIProvider),model:openAIProvider?.model||null},googleMaps:{configured:Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY)},hubspot:{configured:Boolean(process.env.HUBSPOT_ACCESS_TOKEN||process.env.HUBSPOT_CLIENT_ID),connected:Boolean(process.env.HUBSPOT_ACCESS_TOKEN)}})}
  if(req.method==="GET"&&url.pathname==="/api/integrations/gmail/connect"){if(!gmail)return sendJson(res,503,{error:"Gmail OAuth is not configured"});const redirectTo=safeAppPath(url.searchParams.get("redirectTo")||"/communications.html");const{url:authorizationUrl}=gmail.authorizationUrl({userId:USER_ID,redirectTo});return redirect(res,authorizationUrl)}
  if(req.method==="GET"&&url.pathname==="/api/integrations/gmail/callback"){if(!gmail)return sendJson(res,503,{error:"Gmail OAuth is not configured"});const error=url.searchParams.get("error");if(error)return redirect(res,`/communications.html?gmail=error&reason=${encodeURIComponent(error)}`);const code=url.searchParams.get("code"),state=url.searchParams.get("state");if(!code||!state)return sendJson(res,400,{error:"Missing OAuth code/state"});const result=await gmail.exchangeCode({code,state});const destination=safeAppPath(result.redirectTo);return redirect(res,`${destination}${destination.includes("?")?"&":"?"}gmail=connected`)}
  if(req.method==="GET"&&url.pathname==="/api/integrations/gmail/status"){if(!gmail)return sendJson(res,200,{connected:false,configured:false});const connection=await activeGmailConnection();return sendJson(res,200,connection?{connected:true,configured:true,accountId:connection.accountId,scopes:connection.scopes}:{connected:false,configured:true})}
  if(req.method==="GET"&&url.pathname==="/api/integrations/gmail/inbox"){if(!gmail)return sendJson(res,503,{error:"Gmail OAuth is not configured"});const connection=await activeGmailConnection();if(!connection)return sendJson(res,401,{error:"Gmail not connected",connectUrl:"/api/integrations/gmail/connect"});const maxResults=Math.max(1,Math.min(30,Number(url.searchParams.get("limit")||12)));const query=url.searchParams.get("q")||"in:inbox";const inbox=await gmail.listInbox({accessToken:connection.accessToken,maxResults,query});return sendJson(res,200,{connected:true,accountId:connection.accountId,...inbox})}
  if(req.method==="POST"&&url.pathname==="/api/agent/run"){if(!openAIProvider)return sendJson(res,503,{error:"OpenAI provider is not configured"});const body=await readJson(req);const input=String(body.input||"").trim();if(!input)return sendJson(res,400,{error:"input is required"});const context=(body.context&&typeof body.context==="object")?body.context:{};const result=await agentGateway.run({provider:"openai",input,context,providerTools:configuredProviderTools,actor:{type:"prototype-user",id:USER_ID}});return sendJson(res,200,{text:result.text,responseId:result.responseId,model:result.model,toolTrace:result.toolTrace,proposedActions:result.proposedActions})}
  if(req.method==="GET"&&url.pathname==="/api/audit")return sendJson(res,200,{events:auditEvents.slice(-30).reverse()});
  if(req.method==="GET"&&serveStatic(url.pathname,res))return;
  return sendJson(res,404,{error:"Not found"});
}catch(error){console.error(error);return sendJson(res,500,{error:error.message||"Prototype integration server failed"})}});

server.listen(PORT,()=>console.log(`OpenRabbit prototype running at ${APP_ORIGIN}`));