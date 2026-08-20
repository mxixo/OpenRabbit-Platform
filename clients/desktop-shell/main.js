const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const hubspotOAuth = require('./hubspot-oauth');

const repoRoot = path.join(__dirname, '..', '..');
let workspaceServer;
let workspaceOrigin;

function loadLocalEnv() {
  if (app.isPackaged) return;
  const envPath = path.join(repoRoot, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function integrationTokenFile(kind) {
  const safeKind = kind === 'calendar' ? 'calendar' : 'gmail';
  if (!app.isPackaged) {
    const explicit = safeKind === 'calendar' ? process.env.GOOGLE_CALENDAR_OAUTH_TOKEN_FILE : process.env.GOOGLE_GMAIL_OAUTH_TOKEN_FILE;
    const configured = explicit || `.openrabbit/google-${safeKind}-oauth.json`;
    return path.isAbsolute(configured) ? configured : path.join(repoRoot, configured);
  }
  return path.join(app.getPath('userData'), `google-${safeKind}-oauth.json`);
}

function codexExecutable() {
  const local = path.join(__dirname, 'node_modules', '.bin', process.platform === 'win32' ? 'codex.cmd' : 'codex');
  if (fs.existsSync(local)) return local;
  return process.platform === 'win32' ? 'codex.cmd' : 'codex';
}

function openRabbitCodexHome() {
  const home = path.join(app.getPath('userData'), 'codex');
  fs.mkdirSync(home, { recursive: true });
  return home;
}

function codexEnvironment() {
  const env = { ...process.env, CODEX_HOME: openRabbitCodexHome(), CI: '1', NO_COLOR: '1' };
  delete env.OPENAI_API_KEY;
  delete env.CODEX_API_KEY;
  delete env.CODEX_ACCESS_TOKEN;
  return env;
}

function compactCodexError(stderr, stdout, fallback) {
  const raw = String(stderr || stdout || fallback || 'Codex command failed.').trim();
  const lines = raw.split(/\r?\n/).filter(Boolean);
  return lines.slice(-14).join('\n') || 'Codex command failed.';
}

function runCodex(args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(codexExecutable(), args, {cwd:options.cwd||app.getPath('temp'),env:options.env||codexEnvironment(),timeout:options.timeout||60000,maxBuffer:8*1024*1024,windowsHide:true}, (error, stdout, stderr) => {
      if (error) { const wrapped=new Error(compactCodexError(stderr,stdout,error.message||error)); wrapped.code=error.code; wrapped.signal=error.signal; return reject(wrapped); }
      resolve({stdout:String(stdout||'').trim(),stderr:String(stderr||'').trim()});
    });
  });
}

function runCodexHeadless(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child=spawn(codexExecutable(),args,{cwd:options.cwd||app.getPath('temp'),env:options.env||codexEnvironment(),windowsHide:true,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='',settled=false; const timeoutMs=options.timeout||60000;
    const timer=setTimeout(()=>{if(settled)return;settled=true;try{child.kill('SIGKILL')}catch{}reject(new Error(compactCodexError(stderr,stdout,`Codex timed out after ${Math.round(timeoutMs/1000)} seconds.`)))},timeoutMs);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8'); child.stdout.on('data',c=>stdout+=c); child.stderr.on('data',c=>stderr+=c);
    child.once('error',error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error)});
    child.once('close',(code,signal)=>{if(settled)return;settled=true;clearTimeout(timer);if(code!==0)return reject(new Error(compactCodexError(stderr,stdout,`Codex exited with code ${code}${signal?` (${signal})`:''}.`)));resolve({stdout:stdout.trim(),stderr:stderr.trim()})});
  });
}

async function codexAuthStatus() {
  try {
    const result=await runCodex(['login','status'],{timeout:15000}); const text=`${result.stdout}\n${result.stderr}`.trim(); const lower=text.toLowerCase();
    if(lower.includes('logged in using chatgpt')) return {connected:true,provider:'openai-chatgpt',authMode:'chatgpt',label:'ChatGPT connected',detail:text,codexAvailable:true};
    return {connected:false,provider:null,authMode:null,label:'Ready to connect your AI',detail:text||'Not logged in',codexAvailable:true};
  } catch(error) {
    const detail=error.message||String(error),lower=detail.toLowerCase();
    if(lower.includes('not logged in')||lower.includes('run codex login')) return {connected:false,provider:null,authMode:null,label:'Ready to connect your AI',detail,codexAvailable:true};
    const unavailable=/enoent|not found|is not recognized|no such file/i.test(detail); return {connected:false,provider:null,authMode:null,label:'Ready to connect your AI',detail,codexAvailable:!unavailable};
  }
}

async function agentProviderStatus(){return codexAuthStatus()}

async function startChatGPTLogin(){
  const before=await codexAuthStatus(); if(before.connected&&before.authMode==='chatgpt')return before;
  try{await runCodex(['login'],{timeout:10*60*1000,env:codexEnvironment()})}catch(error){const message=error.message||String(error);if(/enoent|not found|is not recognized|no such file/i.test(message))throw new Error('The OpenAI login helper is not installed. Close OpenRabbit, run npm install, then launch OpenRabbit again.');throw new Error(`ChatGPT sign-in did not complete: ${message}`)}
  const status=await codexAuthStatus(); if(!status.connected||status.authMode!=='chatgpt')throw new Error(status.detail||'ChatGPT sign-in did not complete.'); return status;
}

async function integrationStatus(){
  const [ai, hubspot] = await Promise.all([codexAuthStatus(), hubspotOAuth.status()]);
  return {
    gmail:fs.existsSync(integrationTokenFile('gmail')),
    calendar:fs.existsSync(integrationTokenFile('calendar')),
    maps:Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY||process.env.OPENRABBIT_MAPS_BROWSER_KEY),
    hubspot:Boolean(hubspot.connected),
    hubspotDetail:hubspot,
    openai:Boolean(ai.connected),
    openaiDetail:ai.label
  };
}

function openRabbitAgentInstructions(){return ['You are OpenRabbit, the AI operating agent inside the OpenRabbit desktop application.','Be concise, practical and action-oriented.','You may explain what OpenRabbit can do, help the user plan work, analyze supplied information, and guide them through the interface.','Do not claim that an external action, email, calendar change, CRM write, social post, or property-data lookup happened unless a connected OpenRabbit tool actually performed it.','When an integration is not connected, clearly say what connection is required.','This desktop chat is currently conversational only. Do not modify local files or execute external actions.'].join(' ')}
function conversationPrompt(rawMessages){const messages=Array.isArray(rawMessages)?rawMessages:[];const transcript=messages.slice(-20).map(message=>{const role=message?.role==='assistant'?'OpenRabbit':'User';return `${role}: ${String(message?.content||'').slice(0,12000)}`}).filter(Boolean).join('\n\n');if(!transcript.trim())throw new Error('Type a message for OpenRabbit first.');return `${openRabbitAgentInstructions()}\n\nConversation:\n${transcript}\n\nRespond only as OpenRabbit to the latest user message. Do not inspect or modify files. Do not use shell commands or tools.`}
async function runCodexAgent(rawMessages){const status=await codexAuthStatus();if(!status.connected||status.authMode!=='chatgpt')throw new Error('ChatGPT is not connected to OpenRabbit yet. Choose Continue with ChatGPT first.');const prompt=conversationPrompt(rawMessages);const result=await runCodexHeadless(['--ask-for-approval','never','exec','--ephemeral','--skip-git-repo-check','--sandbox','read-only',prompt],{cwd:app.getPath('temp'),env:codexEnvironment(),timeout:60000});const text=result.stdout.trim();if(!text)throw new Error(compactCodexError(result.stderr,'','ChatGPT returned an empty response.'));return {text,model:'ChatGPT via Codex',provider:'openai-chatgpt'}}
async function runOpenRabbitAgent(rawMessages){return runCodexAgent(rawMessages)}

async function startGoogleOAuth(kind='gmail') {
  const provider = kind === 'calendar' ? 'calendar' : 'gmail';
  const clientId=(process.env.GOOGLE_OAUTH_CLIENT_ID||'').trim(),clientSecret=(process.env.GOOGLE_OAUTH_CLIENT_SECRET||'').trim();
  if(!clientId||!clientSecret)throw new Error('Google OAuth is not configured. Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to your local OpenRabbit configuration.');
  const port=Number(process.env.GOOGLE_OAUTH_CALLBACK_PORT||53682),redirectUri=process.env.GOOGLE_OAUTH_REDIRECT_URI||`http://127.0.0.1:${port}/oauth/google/callback`,state=crypto.randomBytes(24).toString('hex');
  const providerScope=provider==='calendar'?'https://www.googleapis.com/auth/calendar.readonly':'https://www.googleapis.com/auth/gmail.readonly';
  const scopes=['openid','email',providerScope];
  const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth'); auth.searchParams.set('client_id',clientId);auth.searchParams.set('redirect_uri',redirectUri);auth.searchParams.set('response_type','code');auth.searchParams.set('scope',scopes.join(' '));auth.searchParams.set('access_type','offline');auth.searchParams.set('prompt','consent');auth.searchParams.set('state',state);
  return new Promise((resolve,reject)=>{
    let settled=false; const finish=(error,value)=>{if(settled)return;settled=true;try{server.close()}catch{}if(error)reject(error);else resolve(value)};
    const server=http.createServer(async(req,res)=>{const requestUrl=new URL(req.url,redirectUri);if(requestUrl.pathname!=='/oauth/google/callback'){res.writeHead(404);return res.end('Not found')}if(requestUrl.searchParams.get('state')!==state){res.writeHead(400);res.end('OAuth state mismatch.');return finish(new Error('Google OAuth state mismatch.'))}const oauthError=requestUrl.searchParams.get('error');if(oauthError){res.writeHead(400);res.end(`Google authorization failed: ${oauthError}`);return finish(new Error(oauthError))}const code=requestUrl.searchParams.get('code');try{const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,grant_type:'authorization_code',redirect_uri:redirectUri})});const tokens=await response.json();if(!response.ok)throw new Error(tokens.error_description||tokens.error||`Google token exchange failed (${response.status})`);if(!tokens.refresh_token)throw new Error('Google did not return a refresh token. Revoke prior OpenRabbit consent and try again.');const tokenFile=integrationTokenFile(provider);fs.mkdirSync(path.dirname(tokenFile),{recursive:true});fs.writeFileSync(tokenFile,JSON.stringify({provider,refresh_token:tokens.refresh_token,created_at:new Date().toISOString()},null,2),{mode:0o600});try{fs.chmodSync(tokenFile,0o600)}catch{}res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(`<!doctype html><title>OpenRabbit connected</title><style>body{font-family:system-ui;background:#111126;color:white;display:grid;place-items:center;height:100vh;margin:0}.c{max-width:520px;text-align:center}h1{color:#b89cff}</style><div class="c"><h1>OpenRabbit is connected</h1><p>${provider==='calendar'?'Google Calendar':'Gmail'} authorization completed successfully. You can close this window and return to OpenRabbit.</p></div>`);finish(null,{connected:true,provider})}catch(error){res.writeHead(500,{'content-type':'text/plain; charset=utf-8'});res.end(`OpenRabbit authorization failed: ${error.message}`);finish(error)}});server.once('error',error=>finish(error));server.listen(port,'127.0.0.1',async()=>{try{await shell.openExternal(auth.toString())}catch(error){finish(error)}})
  });
}

function workspaceDirectory(){if(app.isPackaged)return path.join(process.resourcesPath,'workspace');return path.join(__dirname,'..','real-estate-workspace')}
function enhancementScriptPath(){return path.join(workspaceDirectory(),'startup-enhancements.js')}
function agentChatScriptPath(){return path.join(workspaceDirectory(),'agent-chat.js')}
function contentType(filePath){const ext=path.extname(filePath).toLowerCase();return ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'}[ext]||'application/octet-stream')}
function startWorkspaceServer(){if(workspaceServer&&workspaceOrigin)return Promise.resolve(workspaceOrigin);const root=path.resolve(workspaceDirectory()),port=Number(process.env.OPENRABBIT_DESKTOP_PORT||53683);return new Promise((resolve,reject)=>{workspaceServer=http.createServer((req,res)=>{try{const requestUrl=new URL(req.url,`http://127.0.0.1:${port}`);let pathname=decodeURIComponent(requestUrl.pathname);if(pathname==='/')pathname='/index.html';const relative=pathname.replace(/^\/+/,''),filePath=path.resolve(root,relative);if(filePath!==root&&!filePath.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden')}if(!fs.existsSync(filePath)||!fs.statSync(filePath).isFile()){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'content-type':contentType(filePath),'cache-control':'no-store'});fs.createReadStream(filePath).pipe(res)}catch{res.writeHead(500);res.end('OpenRabbit workspace server error')}});workspaceServer.once('error',reject);workspaceServer.listen(port,'127.0.0.1',()=>{workspaceOrigin=`http://127.0.0.1:${port}`;resolve(workspaceOrigin)})})}
async function createWindow(){const origin=await startWorkspaceServer();const window=new BrowserWindow({width:1440,height:960,minWidth:1080,minHeight:720,backgroundColor:'#0b0d10',title:'OpenRabbit',show:false,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});window.once('ready-to-show',()=>window.show());window.webContents.setWindowOpenHandler(({url})=>{if(/^https?:\/\//i.test(url)&&!url.startsWith(origin))shell.openExternal(url);return{action:'deny'}});window.webContents.on('will-navigate',(event,url)=>{if(/^https?:\/\//i.test(url)&&!url.startsWith(origin)){event.preventDefault();shell.openExternal(url)}});window.webContents.on('did-finish-load',()=>{for(const scriptPath of[enhancementScriptPath(),agentChatScriptPath()]){try{const script=fs.readFileSync(scriptPath,'utf8');window.webContents.executeJavaScript(script).catch(error=>console.error('OpenRabbit renderer enhancement failed',error))}catch(error){console.error('OpenRabbit renderer enhancement unavailable',scriptPath,error)}}});window.loadURL(`${origin}/index.html`)}
app.whenReady().then(async()=>{loadLocalEnv();ipcMain.handle('openrabbit:integration-status',()=>integrationStatus());ipcMain.handle('openrabbit:start-google-oauth',(_event,kind)=>startGoogleOAuth(kind));ipcMain.handle('openrabbit:start-hubspot-oauth',()=>hubspotOAuth.startOAuth());ipcMain.handle('openrabbit:agent-provider-status',()=>agentProviderStatus());ipcMain.handle('openrabbit:connect-chatgpt',()=>startChatGPTLogin());ipcMain.handle('openrabbit:agent-chat',(_event,messages)=>runOpenRabbitAgent(messages));try{await createWindow()}catch(error){console.error('OpenRabbit failed to start',error);app.quit()}app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow().catch(console.error)})});
app.on('window-all-closed',()=>{if(workspaceServer){try{workspaceServer.close()}catch{}}if(process.platform!=='darwin')app.quit()});