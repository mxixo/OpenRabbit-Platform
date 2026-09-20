const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const requiredPaths = [
  'README.md',
  'docs/QUICKSTART.md',
  'docs/PRODUCTION-CONNECTIONS.md',
  '.env.example',
  'clients/desktop-shell/package.json',
  'clients/desktop-shell/main.js',
  'clients/desktop-shell/preload.js',
  'clients/desktop-shell/gateway-client.js',
  'clients/desktop-shell/auth-client.js',
  'clients/desktop-shell/runtime-config.json',
  'clients/real-estate-workspace/login.html',
  'clients/real-estate-workspace/index.html'
];

let failed = false;

function check(condition, success, failure) {
  if (condition) console.log(`PASS  ${success}`);
  else { failed = true; console.error(`FAIL  ${failure}`); }
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
check(nodeMajor >= 20, `Node.js version supported (${process.version})`, `Node.js 20+ required; found ${process.version}`);

for (const relative of requiredPaths) check(fs.existsSync(path.join(root, relative)), `${relative} present`, `${relative} missing`);

const desktopNodeModules = path.join(root, 'clients', 'desktop-shell', 'node_modules');
check(fs.existsSync(desktopNodeModules), 'Desktop dependencies installed', 'Desktop dependencies missing; run npm run bootstrap:local');

const desktopPackagePath = path.join(root, 'clients', 'desktop-shell', 'package.json');
if (fs.existsSync(desktopPackagePath)) {
  const desktopPackage = JSON.parse(fs.readFileSync(desktopPackagePath, 'utf8'));
  check(Boolean(desktopPackage.devDependencies && desktopPackage.devDependencies.electron), 'Electron dependency declared', 'Electron dependency is not declared');
  check(Boolean(desktopPackage.build && desktopPackage.build.mac && desktopPackage.build.win && desktopPackage.build.linux), 'Desktop packaging targets declared for macOS, Windows, and Linux', 'One or more desktop packaging targets are missing');
  for (const file of ['main.js','preload.js','gateway-client.js','auth-client.js','runtime-config.json']) {
    check(desktopPackage.build.files.includes(file), `${file} packaged`, `${file} is missing from the desktop package`);
  }
}

// Invoke the same Node test files as the root `desktop:test` script directly.
// Spawning `npm.cmd` from Node with shell:false is not portable across current
// Windows GitHub-hosted runners and can fail before npm launches, producing a
// false shareability failure even when both desktop smoke tests are healthy.
for (const relative of ['tests/desktop-shell.test.js', 'tests/ai-managed-interface.test.js']) {
  const test = spawnSync(process.execPath, [path.join(root, relative)], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: false
  });
  if (test.error) {
    console.error(`Desktop smoke process error (${relative}): ${test.error.message}`);
  }
  check(
    !test.error && test.status === 0,
    `${relative} passed`,
    `${relative} failed`
  );
}

if (failed) {
  console.error('\nOpenRabbit shareability verification failed. See the checks above.');
  process.exit(1);
}

console.log('\nOpenRabbit shareability verification passed.');
console.log('You can now launch with: npm run desktop:start');
