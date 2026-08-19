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

assert.strictEqual(desktopPackage.main, 'main.js');
assert.ok(desktopPackage.scripts['dist:mac'], 'macOS packaging script is required');
assert.ok(desktopPackage.scripts['dist:win'], 'Windows packaging script is required');
assert.ok(desktopPackage.scripts['dist:linux'], 'Linux packaging script is required');

assert.ok(fs.existsSync(path.join(workspaceDir, 'index.html')), 'workspace index.html must exist');
assert.ok(fs.existsSync(path.join(workspaceDir, 'app.js')), 'workspace app.js must exist');

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
