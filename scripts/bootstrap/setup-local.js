const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const npmCommand = process.platform === 'win32' ? 'npm' : 'npm';

function fail(message) {
  console.error(`\n[OpenRabbit bootstrap] ${message}`);
  process.exit(1);
}

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(`Command failed with exit code ${result.status}.`);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (!Number.isFinite(nodeMajor) || nodeMajor < 20) {
  fail(`Node.js 20 or newer is required. Current version: ${process.version}`);
}

console.log(`[OpenRabbit bootstrap] Node ${process.version} on ${process.platform}/${process.arch}`);

const envExample = path.join(root, '.env.example');
const envFile = path.join(root, '.env');
if (!fs.existsSync(envExample)) fail('.env.example is missing.');
if (!fs.existsSync(envFile)) {
  fs.copyFileSync(envExample, envFile);
  console.log('[OpenRabbit bootstrap] Created local .env from .env.example. No secrets were added.');
} else {
  console.log('[OpenRabbit bootstrap] Existing .env preserved.');
}

run(npmCommand, ['install', '--no-audit', '--no-fund'], root);
run(npmCommand, ['install', '--no-audit', '--no-fund'], path.join(root, 'clients', 'desktop-shell'));

console.log('\n[OpenRabbit bootstrap] Complete.');
console.log('Next: npm run verify:shareable');
console.log('Then: npm run desktop:start');
