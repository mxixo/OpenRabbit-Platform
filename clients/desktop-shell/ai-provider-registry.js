const fs = require('fs');
const path = require('path');

const PROVIDERS = Object.freeze([
  {
    id: 'openai-chatgpt',
    name: 'ChatGPT',
    company: 'OpenAI',
    transport: 'codex-account',
    implemented: true,
    description: 'Use your ChatGPT account through the bundled Codex runtime.'
  },
  {
    id: 'anthropic-claude',
    name: 'Claude',
    company: 'Anthropic',
    transport: 'provider-adapter',
    implemented: false,
    description: 'Provider slot reserved for Claude account/API transport.'
  },
  {
    id: 'google-gemini',
    name: 'Gemini',
    company: 'Google',
    transport: 'provider-adapter',
    implemented: false,
    description: 'Provider slot reserved for Gemini account/API transport.'
  },
  {
    id: 'custom-openai-compatible',
    name: 'Other AI',
    company: 'Custom',
    transport: 'openai-compatible',
    implemented: false,
    description: 'OpenAI-compatible endpoint adapter for additional models.'
  }
]);

function providerFile(app) {
  return path.join(app.getPath('userData'), 'ai-provider.json');
}

function readSelection(app) {
  try {
    const parsed = JSON.parse(fs.readFileSync(providerFile(app), 'utf8'));
    if (PROVIDERS.some(provider => provider.id === parsed?.providerId)) return parsed.providerId;
  } catch {}
  return 'openai-chatgpt';
}

function writeSelection(app, providerId) {
  const provider = PROVIDERS.find(item => item.id === providerId);
  if (!provider) throw new Error('Unknown AI provider.');
  const file = providerFile(app);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ providerId, updatedAt: new Date().toISOString() }, null, 2));
  return provider;
}

function list(app, runtimeStatus = {}) {
  const selectedId = readSelection(app);
  return PROVIDERS.map(provider => ({
    ...provider,
    selected: provider.id === selectedId,
    connected: provider.id === 'openai-chatgpt' ? Boolean(runtimeStatus.chatgptConnected) : false,
    available: provider.implemented
  }));
}

function selected(app, runtimeStatus = {}) {
  const selectedId = readSelection(app);
  return list(app, runtimeStatus).find(provider => provider.id === selectedId) || list(app, runtimeStatus)[0];
}

function select(app, providerId, runtimeStatus = {}) {
  writeSelection(app, String(providerId || ''));
  return selected(app, runtimeStatus);
}

module.exports = {
  PROVIDERS,
  list,
  selected,
  select
};
