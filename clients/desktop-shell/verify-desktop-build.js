const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');

const requiredFiles = ['main.js', 'preload.js', 'gateway-client.js', 'runtime-config.json', 'hubspot-oauth.js'];
for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Required desktop source is missing: ${file}`);
  }
  if (!pkg.build.files.includes(file)) {
    throw new Error(`Required desktop source is not packaged by electron-builder: ${file}`);
  }
}

const iconPath = path.join(__dirname, 'build', 'icon.png');
if (!fs.existsSync(iconPath)) {
  throw new Error('Generated app icon is missing: build/icon.png');
}

console.log('Desktop packaging verification passed.');
