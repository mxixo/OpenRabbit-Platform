const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '..', 'clients', 'real-estate-workspace');
const target = path.resolve(__dirname, 'workspace');

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
console.log(`Copied workspace from ${source} to ${target}`);
