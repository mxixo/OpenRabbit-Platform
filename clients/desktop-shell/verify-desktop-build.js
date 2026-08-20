const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');

const requiredFiles = ['main-v2.js','main.js','preload.js','gateway-client.js','auth-client.js','action-queue.js','ai-provider-registry.js','runtime-config.json','hubspot-oauth.js'];
for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Required desktop source is missing: ${file}`);
  }
  if (!pkg.build.files.includes(file)) {
    throw new Error(`Required desktop source is not packaged by electron-builder: ${file}`);
  }
}
if (pkg.main !== 'main-v2.js') throw new Error(`Desktop entrypoint must be main-v2.js; found ${pkg.main}`);

const workspaceLive = path.join(__dirname, '..', 'real-estate-workspace', 'live-data.js');
if (!fs.existsSync(workspaceLive)) throw new Error('Live dashboard binding is missing: live-data.js');

const iconPath = path.join(__dirname, 'build', 'icon.png');
if (!fs.existsSync(iconPath)) {
  throw new Error('Generated app icon is missing: build/icon.png');
}

console.log('Desktop packaging verification passed.');
