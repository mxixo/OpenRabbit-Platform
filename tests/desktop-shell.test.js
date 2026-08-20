const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const desktopDir = path.join(root, 'clients', 'desktop-shell');
const workspaceDir = path.join(root, 'clients', 'real-estate-workspace');
const desktopPackage = JSON.parse(fs.readFileSync(path.join(desktopDir, 'package.json'), 'utf8'));
const mainSource = fs.readFileSync(path.join(desktopDir, 'main.js'), 'utf8');
const mainV2Source = fs.readFileSync(path.join(desktopDir, 'main-v2.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(desktopDir, 'preload.js'), 'utf8');
const gatewayClientSource = fs.readFileSync(path.join(desktopDir, 'gateway-client.js'), 'utf8');
const authClientSource = fs.readFileSync(path.join(desktopDir, 'auth-client.js'), 'utf8');
const runtimeConfig = JSON.parse(fs.readFileSync(path.join(desktopDir, 'runtime-config.json'), 'utf8'));
const workspaceHtml = fs.readFileSync(path.join(workspaceDir, 'index.html'), 'utf8');
const loginHtml = fs.readFileSync(path.join(workspaceDir, 'login.html'), 'utf8');
const connectionsHtml = fs.readFileSync(path.join(workspaceDir, 'connections.html'), 'utf8');
const marketHtml = fs.readFileSync(path.join(workspaceDir, 'market.html'), 'utf8');
const mapSource = fs.readFileSync(path.join(workspaceDir, 'market-map.js'), 'utf8');
const mapFallback = fs.readFileSync(path.join(workspaceDir, 'map-fallback.js'), 'utf8');
const liveDataSource = fs.readFileSync(path.join(workspaceDir, 'live-data.js'), 'utf8');
const microsoftUiSource = fs.readFileSync(path.join(workspaceDir, 'microsoft-ui.js'), 'utf8');
const aiOrbSource = fs.readFileSync(path.join(workspaceDir, 'ai-orb.js'), 'utf8');
const proactiveSource = fs.readFileSync(path.join(workspaceDir, 'proactive-brief.js'), 'utf8');

assert.strictEqual(desktopPackage.main, 'main-v2.js');
assert.strictEqual(desktopPackage.version, '0.1.5');
for (const script of ['dist:mac', 'dist:win', 'dist:linux']) assert.ok(desktopPackage.scripts[script], `${script} packaging script is required`);
for (const file of ['main-v2.js','main.js','preload.js','gateway-client.js','auth-client.js','runtime-config.json']) {
  assert.ok(fs.existsSync(path.join(desktopDir, file)), `${file} must exist`);
  assert.ok(desktopPackage.build.files.includes(file), `${file} must be packaged by electron-builder`);
}
for (const file of ['index.html','login.html','connections.html','market.html','market-map.js','live-data.js','map-fallback.js','microsoft-ui.js','ai-orb.js','proactive-brief.js']) {
  assert.ok(fs.existsSync(path.join(workspaceDir, file)), `${file} must exist`);
}

for (const loginText of ['Welcome to OpenRabbit','Sign in','Create account','normal sign-in screens']) assert.match(loginHtml,new RegExp(loginText,'i'));
assert.doesNotMatch(loginHtml,/client secret|client_id|paste.*token|API key field/i);
for (const dashboardText of ['OpenRabbit Command Center','Ready to connect','Email','Calendar','CRM / Pipeline','Social Media','Map Search','Connection Status']) assert.match(workspaceHtml,new RegExp(dashboardText,'i'));
for (const connectionText of ['Connect the accounts you already use','Gmail','Google Calendar','OpenRabbit AI','Maps','HubSpot / CRM','No API keys']) assert.match(connectionsHtml,new RegExp(connectionText,'i'));
for (const marketText of ['Phoenix Opportunity Map','Search map','Opportunity Feed','Investor Criteria','googleMap']) assert.match(marketHtml,new RegExp(marketText,'i'));

assert.match(mainSource,/require\('\.\/auth-client'\)/);
assert.match(mainSource,/gateway\.setUserResolver/);
assert.match(mainSource,/login\.html/);
assert.match(mainV2Source,/openrabbit:live-snapshot/);
assert.match(mainV2Source,/openrabbit:start-social-oauth/);
assert.match(mainV2Source,/openrabbit:start-microsoft-oauth/);
for (const injected of ['live-data.js','map-fallback.js','microsoft-ui.js','ai-orb.js','proactive-brief.js']) assert.match(mainV2Source,new RegExp(injected.replace('.','\\.')));
for (const method of ['getAccountStatus','signIn','signUp','signOut','getLiveSnapshot','connectSocial','connectMicrosoft']) assert.match(preloadSource,new RegExp(method));
assert.match(authClientSource,/safeStorage/);
assert.match(gatewayClientSource,/\/v1\/live/);
assert.match(gatewayClientSource,/startSocial/);
assert.match(gatewayClientSource,/startMicrosoft/);
assert.match(gatewayClientSource,/identity\.accessToken/);
assert.ok(runtimeConfig.connectionGatewayUrl);
assert.ok(runtimeConfig.supabaseUrl);
assert.ok(runtimeConfig.supabasePublishableKey.startsWith('sb_publishable_'));

for (const liveToken of ['getLiveSnapshot','Live Gmail','Live Calendar','Live HubSpot','Instagram / Facebook','LinkedIn','TikTok']) assert.match(liveDataSource,new RegExp(liveToken,'i'));
assert.match(microsoftUiSource,/Outlook \/ Microsoft 365/i);
assert.match(microsoftUiSource,/Microsoft Calendar/i);
assert.match(mapFallback,/openstreetmap\.org/i);
assert.match(mapFallback,/nominatim\.openstreetmap\.org/i);
assert.match(mapFallback,/Built in/i);
assert.match(aiOrbSource,/What do you want to accomplish/i);
assert.match(aiOrbSource,/No workflow builder required/i);
assert.match(proactiveSource,/OpenRabbit next moves/i);
assert.match(proactiveSource,/getLiveSnapshot/i);
assert.match(proactiveSource,/Connect signals across email, calendar, CRM and social/i);
assert.match(proactiveSource,/approvalRequired/i);
assert.match(workspaceHtml,/getIntegrationStatus/);
assert.match(workspaceHtml,/getMapsConfig/);
assert.match(connectionsHtml,/disconnectIntegration/);
assert.doesNotMatch(connectionsHtml,/client secret|client_id|API key field|paste.*token/i);
assert.match(mapSource,/maps\.googleapis\.com\/maps\/api\/js/);
assert.match(mapSource,/geocoder\.geocode/);

const resources=desktopPackage.build&&desktopPackage.build.extraResources;
assert.ok(Array.isArray(resources));
assert.ok(resources.some(entry=>entry.from==='../real-estate-workspace'&&entry.to==='workspace'));
assert.match(mainSource,/contextIsolation:\s*true/);
assert.match(mainSource,/nodeIntegration:\s*false/);
assert.match(mainSource,/sandbox:\s*true/);
assert.match(mainSource,/shell\.openExternal/);

console.log('desktop-shell.test.js: OK');