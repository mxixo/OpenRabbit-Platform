const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const desktopDir = path.join(root, 'clients', 'desktop-shell');
const workspaceDir = path.join(root, 'clients', 'real-estate-workspace');
const desktopPackage = JSON.parse(fs.readFileSync(path.join(desktopDir, 'package.json'), 'utf8'));
const mainSource = fs.readFileSync(path.join(desktopDir, 'main.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(desktopDir, 'preload.js'), 'utf8');
const gatewayClientSource = fs.readFileSync(path.join(desktopDir, 'gateway-client.js'), 'utf8');
const authClientSource = fs.readFileSync(path.join(desktopDir, 'auth-client.js'), 'utf8');
const runtimeConfig = JSON.parse(fs.readFileSync(path.join(desktopDir, 'runtime-config.json'), 'utf8'));
const workspaceHtml = fs.readFileSync(path.join(workspaceDir, 'index.html'), 'utf8');
const loginHtml = fs.readFileSync(path.join(workspaceDir, 'login.html'), 'utf8');
const connectionsHtml = fs.readFileSync(path.join(workspaceDir, 'connections.html'), 'utf8');
const marketHtml = fs.readFileSync(path.join(workspaceDir, 'market.html'), 'utf8');
const faqHtml = fs.readFileSync(path.join(workspaceDir, 'faq.html'), 'utf8');
const mapSource = fs.readFileSync(path.join(workspaceDir, 'market-map.js'), 'utf8');

assert.strictEqual(desktopPackage.main, 'main.js');
assert.strictEqual(desktopPackage.version, '0.1.4');
for (const script of ['dist:mac', 'dist:win', 'dist:linux']) assert.ok(desktopPackage.scripts[script], `${script} packaging script is required`);
for (const file of ['main.js', 'preload.js', 'gateway-client.js', 'auth-client.js', 'runtime-config.json']) {
  assert.ok(fs.existsSync(path.join(desktopDir, file)), `${file} must exist`);
  assert.ok(desktopPackage.build.files.includes(file), `${file} must be packaged by electron-builder`);
}
for (const file of ['index.html', 'login.html', 'connections.html', 'market.html', 'faq.html', 'market-map.js']) assert.ok(fs.existsSync(path.join(workspaceDir, file)), `${file} must exist`);

for (const loginText of ['Welcome to OpenRabbit', 'Sign in', 'Create account', 'normal sign-in screens']) {
  assert.match(loginHtml, new RegExp(loginText, 'i'), `login must surface ${loginText}`);
}
assert.doesNotMatch(loginHtml, /client secret|client_id|paste.*token|API key field/i, 'account login must not expose developer configuration');
assert.match(loginHtml, /getAccountStatus/);
assert.match(loginHtml, /api\.signIn/);
assert.match(loginHtml, /api\.signUp/);

for (const dashboardText of ['OpenRabbit Command Center', 'Ready to connect', 'Email', 'Calendar', 'CRM / Pipeline', 'Social Media', 'Map Search', 'Connection Status']) {
  assert.match(workspaceHtml, new RegExp(dashboardText, 'i'), `dashboard must surface ${dashboardText}`);
}
for (const connectionText of ['Connect the accounts you already use', 'Gmail', 'Google Calendar', 'OpenRabbit AI', 'Maps', 'HubSpot / CRM', 'No API keys']) {
  assert.match(connectionsHtml, new RegExp(connectionText, 'i'), `connections screen must surface ${connectionText}`);
}
for (const demoText of ['Fully Connected Demo', 'Agent Activity']) assert.match(faqHtml, new RegExp(demoText, 'i'), `FAQ demo must retain ${demoText}`);
for (const marketText of ['Phoenix Opportunity Map', 'Search map', 'Opportunity Feed', 'Investor Criteria', 'googleMap']) assert.match(marketHtml, new RegExp(marketText, 'i'), `market screen must retain ${marketText}`);

assert.match(mainSource, /require\('\.\/auth-client'\)/, 'desktop must include OpenRabbit account auth');
assert.match(mainSource, /auth\.currentUser\(app\)/, 'desktop must resolve a real OpenRabbit user');
assert.match(mainSource, /login\.html/, 'desktop must gate the workspace behind account login');
assert.match(mainSource, /openrabbit:account-sign-in/, 'desktop must expose account sign in');
assert.match(mainSource, /openrabbit:account-sign-up/, 'desktop must expose account sign up');
assert.match(mainSource, /openrabbit:account-sign-out/, 'desktop must expose account sign out');
assert.match(mainSource, /gateway\.status\(app\)/, 'desktop status must come from the hosted gateway');
assert.match(mainSource, /gateway\.startGoogle\(app/, 'desktop Google connection must start through hosted gateway');
assert.match(mainSource, /gateway\.startHubSpot\(app\)/, 'desktop HubSpot connection must start through hosted gateway');
assert.match(mainSource, /gateway\.verify\(app/, 'desktop must wait for verified provider state');
assert.match(mainSource, /gateway\.mapsConfig\(app\)/, 'desktop must obtain Maps configuration from OpenRabbit');

for (const method of ['getAccountStatus', 'signIn', 'signUp', 'signOut']) assert.match(preloadSource, new RegExp(method), `desktop bridge must expose ${method}`);
assert.doesNotMatch(preloadSource, /mapsBrowserKey\s*:/, 'desktop renderer bridge must not rely on a locally-entered Maps key');
assert.match(preloadSource, /getMapsConfig/, 'desktop bridge must expose managed Maps configuration');
assert.match(preloadSource, /disconnectIntegration/, 'desktop bridge must support account disconnect');

assert.match(authClientSource, /safeStorage/, 'desktop account session should use OS-backed encryption when available');
assert.match(authClientSource, /\/auth\/v1\/token\?grant_type=password/, 'desktop must use the account provider sign-in endpoint');
assert.match(authClientSource, /\/auth\/v1\/signup/, 'desktop must support account creation');
assert.match(authClientSource, /refresh_token/, 'desktop must refresh account sessions');
assert.match(gatewayClientSource, /runtime-config\.json/, 'desktop gateway client must read packaged public runtime config');
assert.match(gatewayClientSource, /x-openrabbit-user/, 'gateway calls must remain namespaced to an OpenRabbit identity');
assert.match(gatewayClientSource, /identity\.accessToken/, 'gateway calls must carry the signed-in account session when available');
assert.ok(runtimeConfig.connectionGatewayUrl);
assert.ok(runtimeConfig.supabaseUrl);
assert.ok(runtimeConfig.supabasePublishableKey.startsWith('sb_publishable_'));

assert.match(workspaceHtml, /getIntegrationStatus/, 'dashboard must refresh real connection state');
assert.match(workspaceHtml, /getMapsConfig/, 'dashboard Maps must use OpenRabbit-managed configuration');
assert.match(workspaceHtml, /Built in/, 'Maps should be described as a platform capability, not a user account connection');
assert.match(connectionsHtml, /disconnectIntegration/, 'connections center must allow disconnecting accounts');
assert.doesNotMatch(connectionsHtml, /client secret|client_id|API key field|paste.*token/i, 'customer connection UI must not ask for technical credentials');
assert.match(mapSource, /maps\.googleapis\.com\/maps\/api\/js/, 'market must load Google Maps JavaScript API');
assert.match(mapSource, /geocoder\.geocode/, 'market must support address search');

const resources = desktopPackage.build && desktopPackage.build.extraResources;
assert.ok(Array.isArray(resources));
assert.ok(resources.some(entry => entry.from === '../real-estate-workspace' && entry.to === 'workspace'));
assert.match(mainSource, /contextIsolation:\s*true/);
assert.match(mainSource, /nodeIntegration:\s*false/);
assert.match(mainSource, /sandbox:\s*true/);
assert.match(mainSource, /shell\.openExternal/);
assert.match(mainSource, /process\.resourcesPath/);

console.log('desktop-shell.test.js: OK');
