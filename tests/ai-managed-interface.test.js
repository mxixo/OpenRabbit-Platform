const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const orb = fs.readFileSync(path.join(root, 'clients/real-estate-workspace/ai-orb.js'), 'utf8');
const mainV2 = fs.readFileSync(path.join(root, 'clients/desktop-shell/main-v2.js'), 'utf8');
const principle = fs.readFileSync(path.join(root, 'docs/AI-MANAGED-INTERFACE.md'), 'utf8');

assert.match(orb, /orBrainOrb/, 'floating OpenRabbit control must exist');
assert.match(orb, /pointermove/, 'floating OpenRabbit control must be draggable');
assert.match(orb, /getAgentProviderStatus/, 'AI brain must reflect real provider state');
assert.match(orb, /agentChat/, 'AI brain must send prompts through the desktop AI bridge');
assert.match(orb, /No workflow builder required/i, 'AI brain should hide workflow-builder complexity from users');
assert.match(mainV2, /ai-orb\.js/, 'AI brain must be injected throughout the workspace');
assert.match(principle, /not a workflow-builder/i, 'product principle must reject customer-facing workflow builders');
assert.match(principle, /Email[\s\S]*Calendar[\s\S]*CRM[\s\S]*Maps[\s\S]*Social/i, 'AI-managed surface list must cover core operating areas');

console.log('ai-managed-interface.test.js: OK');
