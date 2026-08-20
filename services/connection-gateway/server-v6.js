"use strict";
const http=require('http');
const base=require('./server-v5');
const ms=require('./microsoft-runtime');

const port=Number(process.env.OPENRABBIT_CONNECTION_GATEWAY_PORT||8790);
const host=process.env.OPENRABBIT_CONNECTION_GATEWAY_HOST||'0.0.0.0';
const publicBaseUrl=String(process.env.OPENRABBIT_CONNECTION_GATEWAY_PUBLIC_URL||`http://127.0.0.1:${port}`).replace(/\/$/,'');
function json(res,status,body){const p=JSON.stringify(body);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(p),'cache-control':'no-store','access-control-allow-origin':process.env.OPENRABBIT_GATEWAY_CORS_ORIGIN||'*','access-control-allow-headers':'authorization,content-type,x-openrabbit-user','access-control-allow-methods':'GET,POST,DELETE,OPTIONS'});res.end(p);}
function html(res,status,body){res.writeHead(status,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(body);}
function safe(v){return String(v||'').replace(/[<>&"']/g,'');}
async function identity(req,res){const i=await base.authenticate(req);if(i)return i;json(res,401,{error:'UNAUTHORIZED',message:'Sign in to OpenRabbit to continue.'});return null;}
async function callback(res,url){const record=ms.pop(url.searchParams.get('state'));if(!record)return html(res,400,'<h1>OpenRabbit authorization expired</h1><p>Please return to OpenRabbit and try again.</p>');if(url.searchParams.get('error'))return html(res,400,`<h1>Microsoft authorization failed</h1><p>${safe(url.searchParams.get('error_description')||url.searchParams.get('error'))}</p>`);try{await ms.exchange(url.searchParams.get('code'),record);return html(res,200,'<style>body{font-family:system-ui;background:#0b1020;color:#fff;display:grid;place-items:center;height:100vh}.c{text-align:center}h1{color:#a78bfa}</style><div class="c"><h1>OpenRabbit connected</h1><p>Your Microsoft 365 account is connected. You can close this window and return to OpenRabbit.</p></div>');}catch(e){return html(res,500,`<h1>OpenRabbit connection failed</h1><p>${safe(e.message)}</p>`);}}
function mergedProviders(){return base.providers.map(p=>p.id==='microsoft'?{...p,planned:false,configured:ms.configured()}:{...p,configured:p.id==='gmail'||p.id==='google-calendar'?Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID&&process.env.GOOGLE_OAUTH_CLIENT_SECRET):p.id==='hubspot'?Boolean(process.env.HUBSPOT_OAUTH_CLIENT_ID&&process.env.HUBSPOT_OAUTH_CLIENT_SECRET):p.id==='meta'?Boolean(process.env.META_APP_ID&&process.env.META_APP_SECRET):p.id==='linkedin'?Boolean(process.env.LINKEDIN_CLIENT_ID&&process.env.LINKEDIN_CLIENT_SECRET):p.id==='tiktok'?Boolean(process.env.TIKTOK_CLIENT_KEY&&process.env.TIKTOK_CLIENT_SECRET):p.id==='google-maps'?Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY):false});}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,publicBaseUrl);
    if(req.method==='OPTIONS')return json(res,204,{});
    if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,service:'openrabbit-connection-gateway',version:6,configured:{microsoft:ms.configured(),google:Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID&&process.env.GOOGLE_OAUTH_CLIENT_SECRET),hubspot:Boolean(process.env.HUBSPOT_OAUTH_CLIENT_ID&&process.env.HUBSPOT_OAUTH_CLIENT_SECRET),maps:Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY),meta:Boolean(process.env.META_APP_ID&&process.env.META_APP_SECRET),linkedin:Boolean(process.env.LINKEDIN_CLIENT_ID&&process.env.LINKEDIN_CLIENT_SECRET),tiktok:Boolean(process.env.TIKTOK_CLIENT_KEY&&process.env.TIKTOK_CLIENT_SECRET)}});
    if(req.method==='GET'&&url.pathname==='/v1/providers')return json(res,200,{providers:mergedProviders()});
    if(req.method==='GET'&&url.pathname==='/oauth/microsoft/callback')return callback(res,url);
    if(req.method==='POST'&&url.pathname==='/v1/connections/microsoft/start'){const i=await identity(req,res);if(!i)return;try{return json(res,200,{authorizationUrl:ms.start(i.userId)});}catch(e){return json(res,503,{error:'PROVIDER_NOT_CONFIGURED',message:e.message});}}
    if(req.method==='POST'&&url.pathname==='/v1/connections/microsoft/verify'){const i=await identity(req,res);if(!i)return;return json(res,200,{provider:'microsoft',...(await ms.verify(i.userId))});}
    if(req.method==='DELETE'&&url.pathname==='/v1/connections/microsoft'){const i=await identity(req,res);if(!i)return;ms.remove(i.userId);return json(res,200,{connected:false,provider:'microsoft'});}
    if(req.method==='GET'&&url.pathname==='/v1/connections'){const i=await identity(req,res);if(!i)return;const state=await base.connectionState(i.userId);const m=await ms.verify(i.userId);const merged=state.map(x=>x.id==='microsoft'?{...x,planned:false,configured:ms.configured(),...m}:x);return json(res,200,{user:i.userId,connections:merged});}
    if(req.method==='GET'&&url.pathname==='/v1/live'){const i=await identity(req,res);if(!i)return;const [snap,m]=await Promise.all([base.liveSnapshot(i.userId),ms.snapshot(i.userId).catch(e=>({connected:false,error:e.message,mail:[],calendar:[]}))]);if(m.connected){if(!snap.mail.connected)snap.mail={connected:true,provider:'microsoft',items:m.mail,total:m.mail.length,profile:m.profile};if(!snap.calendar.connected)snap.calendar={connected:true,provider:'microsoft',events:m.calendar,timeZone:'Microsoft 365',profile:m.profile};}snap.microsoft=m;return json(res,200,{...snap,generatedAt:new Date().toISOString()});}
    return base.server.emit('request',req,res);
  }catch(e){console.error(e);if(!res.headersSent)json(res,500,{error:'INTERNAL_ERROR',message:'Connection gateway request failed.'});}
});
if(require.main===module)server.listen(port,host,()=>console.log(`OpenRabbit Connection Gateway v6 listening on ${publicBaseUrl}`));
module.exports={server};
