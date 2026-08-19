const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const desktopDir = path.join(root, 'clients', 'desktop-shell');
const workspaceDir = path.join(root, 'clients', 'real-estate-workspace');

const desktopPackage = JSON.parse(
  fs.readFileSync(path.join(desktopDir, 'package.json'), 'utf8')
);
const mainSource = fs.readFileSync(path.join(desktopDir, 'main.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(desktopDir, 'preload.js'), 'utf8');
const workspaceHtml = fs.readFileSync(path.join(workspaceDir, 'index.html'), 'utf8');
const shellSource = fs.readFileSync(path.join(workspaceDir, 'shell.js'), 'utf8');

assert.strictEqual(desktopPackage.main, 'main.js');
assert.ok(desktopPackage.scripts['dist:mac'], 'macOS packaging script is required');
assert.ok(desktopPackage.scripts['dist:win'], 'Windows packaging script is required');
assert.ok(desktopPackage.scripts['dist:linux'], 'Linux packaging script is required');

assert.ok(fs.existsSync(path.join(workspaceDir, 'index.html')), 'workspace index.html must exist');
assert.ok(fs.existsSync(path.join(workspaceDir, 'app.js')), 'workspace app.js must exist');
assert.ok(fs.existsSync(path.join(workspaceDir, 'shell.js')), 'operating environment shell.js must exist');

for (const view of ['dashboard','calendar','mail','agent','properties','social']) {
  assert.match(workspaceHtml, new RegExp(`id=["']view-${view}["']`), `${view} view must exist`);
  assert.match(shellSource, new RegExp(`${view}`), `${view} must be routable from shell navigation`);
}

for (const requiredDealElement of ['dealTitle','dealMeta','setupPanel','app','newDealBtn','loadExistingBtn','createDealBtn','orgId','dealId','token']) {
  assert.match(workspaceHtml, new RegExp(`id=["']${requiredDealElement}["']`), `deal workspace element ${requiredDealElement} must remain available`);
}

assert.match(workspaceHtml, /script src=["']\.\/shell\.js["']/, 'workspace must load shell.js');
assert.match(workspaceHtml, /script src=["']\.\/app\.js["']/, 'workspace must preserve underwriting app.js');
assert.match(shellSource, /openrabbit\.activeView/, 'active desktop view should persist locally');
assert.match(shellSource, /metaKey\|\|event\.ctrlKey/, 'command bar should support keyboard focus shortcut');

const resources = desktopPackage.build && desktopPackage.build.extraResources;
assert.ok(Array.isArray(resources), 'desktop build must define extraResources');
assert.ok(
  resources.some((entry) => entry.from === '../real-estate-workspace' && entry.to === 'workspace'),
  'desktop package must bundle the real-estate workspace'
);

assert.match(mainSource, /contextIsolation:\s*true/, 'contextIsolation must stay enabled');
assert.match(mainSource, /nodeIntegration:\s*false/, 'nodeIntegration must stay disabled');
assert.match(mainSource, /sandbox:\s*true/, 'Electron sandbox must stay enabled');
assert.match(mainSource, /shell\.openExternal/, 'external links must open outside the Electron renderer');
assert.match(mainSource, /process\.resourcesPath/, 'packaged app must load workspace from resourcesPath');

assert.ok(preloadSource.length > 0, 'preload.js must exist and remain loadable');

console.log('desktop-shell.test.js: OK');
