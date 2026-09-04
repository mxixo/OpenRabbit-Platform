"use strict";

(function () {
  if (window.__openRabbitAgentChatLoaded) return;
  window.__openRabbitAgentChatLoaded = true;

  const state = { messages: [], provider: null, providerStatus: null };
  const BRAND_ASSETS = {
    chatgpt: 'https://cdn.jsdelivr.net/npm/@thesvg/icons/icons/openai-chatgpt.svg',
    gemini: 'https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/google-gemini/default.svg',
    claude: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg'
  };

  function providerLogo(src, alt, style = '') {
    return `<img src="${src}" alt="${alt}" loading="eager" decoding="async" referrerpolicy="no-referrer" style="width:34px;height:34px;display:block;object-fit:contain;${style}">`;
  }

  function injectStyles() {
    if (document.getElementById('openrabbitAgentStyles')) return;
    const style = document.createElement('style');
    style.id = 'openrabbitAgentStyles';
    style.textContent = `
      .or-agent-backdrop{position:fixed;inset:0;background:rgba(1,8,18,.72);backdrop-filter:blur(8px);z-index:9998;display:none;align-items:center;justify-content:center;padding:24px}
      .or-agent-backdrop.open{display:flex}
      .or-agent-shell{width:min(860px,96vw);height:min(740px,90vh);background:linear-gradient(180deg,#0b2035,#071524);border:1px solid #285886;border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.55);display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;color:#f7fbff}
      .or-agent-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #173f68;background:#07182a}
      .or-agent-title{display:flex;align-items:center;gap:11px}.or-agent-mark{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(#7f2ef0,#1559c8);font-size:22px}.or-agent-title b{font-size:18px}.or-agent-title small{display:block;color:#9cafc7;margin-top:2px}
      .or-agent-close{border:1px solid #285886;background:#0d243b;color:#fff;border-radius:9px;width:38px;height:38px;font-size:20px;cursor:pointer}
      .or-agent-body{position:relative;overflow:auto}.or-agent-messages{padding:18px;overflow:auto;display:flex;flex-direction:column;gap:12px;min-height:100%}
      .or-agent-empty{margin:auto;max-width:520px;text-align:center;color:#aebed0;line-height:1.55}.or-agent-empty strong{display:block;color:#fff;font-size:22px;margin-bottom:8px}
      .or-agent-msg{max-width:82%;padding:12px 14px;border-radius:14px;line-height:1.48;white-space:pre-wrap;font-size:14px}.or-agent-msg.user{align-self:flex-end;background:linear-gradient(135deg,#1763da,#10469f);border-bottom-right-radius:4px}.or-agent-msg.assistant{align-self:flex-start;background:#102840;border:1px solid #214b75;border-bottom-left-radius:4px}.or-agent-msg.error{align-self:flex-start;background:#391a25;border:1px solid #7e3147;color:#ffd7e1}
      .or-agent-compose{padding:14px;border-top:1px solid #173f68;background:#07182a}.or-agent-row{display:grid;grid-template-columns:1fr auto;gap:9px}.or-agent-input{width:100%;min-height:54px;max-height:150px;resize:vertical;background:#08192b;color:#fff;border:1px solid #285886;border-radius:12px;padding:13px 14px;outline:none}.or-agent-input:focus{border-color:#4a83dd;box-shadow:0 0 0 2px rgba(74,131,221,.15)}.or-agent-send{min-width:110px;border:0;border-radius:12px;background:linear-gradient(135deg,#7425dc,#1559c8);color:#fff;font-weight:900;padding:0 18px;cursor:pointer}.or-agent-send:disabled{opacity:.55;cursor:wait}
      .or-agent-meta{margin-top:8px;display:flex;justify-content:space-between;gap:10px;color:#8fa3bb;font-size:11px}.or-agent-status.ok{color:#8df4c8}.or-agent-status.warn{color:#ffd38a}
      .or-provider{padding:26px;min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center}.or-provider h2{margin:0 0 8px;font-size:27px}.or-provider>p{max-width:650px;text-align:center;color:#aebed0;line-height:1.55;margin:0 0 22px}
      .or-provider-grid{width:min(680px,100%);display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.or-provider-card{border:1px solid #285886;border-radius:15px;background:linear-gradient(#0e2944,#0a1c30);padding:17px;text-align:left;color:#fff;min-height:170px;display:flex;flex-direction:column;gap:9px}.or-provider-card.ready{cursor:pointer}.or-provider-card.ready:hover{border-color:#4b85d9;transform:translateY(-1px)}.or-provider-logo{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:22px;font-weight:900;background:#fff;color:#111}.or-provider-card h3{margin:3px 0 0;font-size:16px}.or-provider-card p{margin:0;color:#aebed0;font-size:12px;line-height:1.45;flex:1}.or-provider-action{border:0;border-radius:9px;padding:10px 12px;background:linear-gradient(135deg,#1763da,#10469f);color:#fff;font-weight:900;cursor:pointer}.or-provider-card.disabled{opacity:.62}.or-provider-card.disabled .or-provider-action{background:#20364d;cursor:default}.or-provider-note{margin-top:14px;color:#7f95ad;font-size:11px;text-align:center;max-width:650px}.or-provider-working{margin-top:15px;color:#ffd38a;font-size:12px;text-align:center;min-height:18px}.or-provider-connected{margin-top:2px;color:#8df4c8;font-weight:800;font-size:11px;min-height:16px}
      @media(max-width:720px){.or-provider-grid{grid-template-columns:1fr}.or-agent-shell{height:94vh}.or-provider-card{min-height:140px}}
    `;
    document.head.appendChild(style);
  }

  function buildUi() {
    if (document.getElementById('openrabbitAgentBackdrop')) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'openrabbitAgentBackdrop';
    backdrop.className = 'or-agent-backdrop';
    backdrop.innerHTML = `
      <section class="or-agent-shell" role="dialog" aria-modal="true" aria-label="Talk to OpenRabbit">
        <header class="or-agent-head">
          <div class="or-agent-title"><div class="or-agent-mark">🐇</div><div><b>OpenRabbit Agent</b><small id="openrabbitAgentProviderLabel">Ready to connect your AI</small></div></div>
          <button class="or-agent-close" type="button" aria-label="Close">×</button>
        </header>
        <div class="or-agent-body" id="openrabbitAgentBody"></div>
        <footer class="or-agent-compose" id="openrabbitAgentCompose" hidden>
          <div class="or-agent-row"><textarea id="openrabbitAgentInput" class="or-agent-input" placeholder="Ask OpenRabbit…"></textarea><button id="openrabbitAgentSend" class="or-agent-send" type="button">Send</button></div>
          <div class="or-agent-meta"><span id="openrabbitAgentStatus" class="or-agent-status">Checking AI connection…</span><span>Enter to send · Shift+Enter for new line</span></div>
        </footer>
      </section>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('.or-agent-close')?.addEventListener('click', close);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && backdrop.classList.contains('open')) close(); });
  }

  function providerMarkup(status) {
    const available = status?.codexAvailable !== false;
    const signedIn = Boolean(status?.connected);
    return `
      <div class="or-provider">
        <h2>Ready to connect your AI</h2>
        <p>Choose the intelligence provider that will power OpenRabbit on this computer. Login-first connections keep setup simple and avoid asking users to paste API keys.</p>
        <div class="or-provider-grid">
          <div class="or-provider-card ready" data-provider="chatgpt">
            <div class="or-provider-logo">${providerLogo(BRAND_ASSETS.chatgpt, 'ChatGPT logo')}</div>
            <h3>OpenAI / ChatGPT</h3>
            <p>${signedIn ? 'Your ChatGPT account is already authenticated on this computer.' : 'Sign in securely through the OpenAI / Codex login flow.'}</p>
            <div class="or-provider-connected">${signedIn ? '✓ Signed in' : ''}</div>
            <button class="or-provider-action" id="openrabbitConnectChatGPT" type="button">Continue with ChatGPT</button>
          </div>
          <div class="or-provider-card disabled">
            <div class="or-provider-logo">${providerLogo(BRAND_ASSETS.gemini, 'Google Gemini logo', 'width:36px;height:36px;')}</div>
            <h3>Google Gemini</h3>
            <p>Login-first Gemini provider support is planned next.</p>
            <button class="or-provider-action" type="button" disabled>Coming next</button>
          </div>
          <div class="or-provider-card disabled">
            <div class="or-provider-logo" style="background:#f7f1e8">${providerLogo(BRAND_ASSETS.claude, 'Claude logo', 'width:38px;height:38px;')}</div>
            <h3>Anthropic Claude</h3>
            <p>Account-based Claude provider support is planned next.</p>
            <button class="or-provider-action" type="button" disabled>Coming next</button>
          </div>
        </div>
        <div class="or-provider-working" id="openrabbitProviderWorking">${available ? '' : 'AI login helper is not installed yet. Relaunch after the desktop dependency finishes installing.'}</div>
        <div class="or-provider-note">Your provider credentials stay local to this computer and are never committed to the OpenRabbit repository.</div>
      </div>`;
  }

  function renderProvider(status) {
    const body = document.getElementById('openrabbitAgentBody');
    const compose = document.getElementById('openrabbitAgentCompose');
    if (!body) return;
    compose.hidden = true;
    body.innerHTML = providerMarkup(status);
    document.getElementById('openrabbitConnectChatGPT')?.addEventListener('click', connectChatGPT);
  }

  function renderChat() {
    const body = document.getElementById('openrabbitAgentBody');
    const compose = document.getElementById('openrabbitAgentCompose');
    if (!body || !compose) return;
    body.innerHTML = `<div class="or-agent-messages" id="openrabbitAgentMessages"><div class="or-agent-empty" id="openrabbitAgentEmpty"><strong>Talk to OpenRabbit</strong>Ask a question, plan a task, or tell the agent what you want to accomplish. Connected tools and approval-gated actions will be added here as OpenRabbit grows.</div></div>`;
    compose.hidden = false;
    const input = document.getElementById('openrabbitAgentInput');
    const send = document.getElementById('openrabbitAgentSend');
    if (send && !send.dataset.wired) { send.dataset.wired = 'true'; send.addEventListener('click', submit); }
    if (input && !input.dataset.wired) {
      input.dataset.wired = 'true';
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
      });
    }
    setStatus('AI connected · ready', 'ok');
  }

  function renderMessage(role, text, extraClass = '') {
    const container = document.getElementById('openrabbitAgentMessages');
    if (!container) return;
    document.getElementById('openrabbitAgentEmpty')?.remove();
    const bubble = document.createElement('div');
    bubble.className = `or-agent-msg ${role} ${extraClass}`.trim();
    bubble.textContent = text;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    return bubble;
  }

  function setStatus(text, type = '') {
    const status = document.getElementById('openrabbitAgentStatus');
    if (!status) return;
    status.textContent = text;
    status.className = `or-agent-status ${type}`.trim();
  }

  function setProviderLabel(text) {
    const label = document.getElementById('openrabbitAgentProviderLabel');
    if (label) label.textContent = text;
  }

  async function refreshStatus() {
    try {
      const provider = await window.openRabbitDesktop?.getAgentProviderStatus?.();
      state.providerStatus = provider;
      state.provider = provider?.provider || null;
      if (provider?.connected) {
        setProviderLabel(provider.label || 'AI connected');
        renderChat();
      } else {
        setProviderLabel('Ready to connect your AI');
        renderProvider(provider);
      }
      return provider;
    } catch (error) {
      setProviderLabel('Ready to connect your AI');
      renderProvider({ codexAvailable: false, detail: error?.message || String(error) });
      return null;
    }
  }

  async function connectChatGPT() {
    const button = document.getElementById('openrabbitConnectChatGPT');
    const working = document.getElementById('openrabbitProviderWorking');
    if (!window.openRabbitDesktop?.connectChatGPT) return;
    if (button) button.disabled = true;
    if (working) working.textContent = state.providerStatus?.connected ? 'Using your signed-in ChatGPT account…' : 'Opening ChatGPT sign-in in your browser… Complete the OpenAI login, then return here.';
    try {
      let result = state.providerStatus;
      if (!result?.connected) result = await window.openRabbitDesktop.connectChatGPT();
      state.provider = result?.provider || 'openai-chatgpt';
      state.providerStatus = result;
      setProviderLabel('ChatGPT connected');
      renderChat();
      setStatus('ChatGPT connected · ready', 'ok');
    } catch (error) {
      if (working) working.textContent = error?.message || String(error);
      if (button) button.disabled = false;
    }
  }

  async function submit() {
    const input = document.getElementById('openrabbitAgentInput');
    const send = document.getElementById('openrabbitAgentSend');
    const text = (input?.value || '').trim();
    if (!text || !window.openRabbitDesktop?.agentChat) return;
    state.messages.push({ role: 'user', content: text });
    renderMessage('user', text);
    input.value = '';
    send.disabled = true;
    setStatus('OpenRabbit is thinking…');
    const pending = renderMessage('assistant', 'Thinking…');
    try {
      const result = await window.openRabbitDesktop.agentChat(state.messages);
      pending?.remove();
      const answer = result?.text || 'No response received.';
      state.messages.push({ role: 'assistant', content: answer });
      renderMessage('assistant', answer);
      setStatus(`${result?.model || 'AI'} · ready`, 'ok');
    } catch (error) {
      pending?.remove();
      renderMessage('assistant', error?.message || String(error), 'error');
      setStatus('AI request failed', 'warn');
    } finally {
      send.disabled = false;
      input?.focus();
    }
  }

  async function open(prefill = '') {
    injectStyles();
    buildUi();
    const backdrop = document.getElementById('openrabbitAgentBackdrop');
    backdrop?.classList.add('open');
    await refreshStatus();
    const input = document.getElementById('openrabbitAgentInput');
    if (prefill && input) input.value = prefill;
    setTimeout(() => input?.focus(), 30);
  }

  function close() { document.getElementById('openrabbitAgentBackdrop')?.classList.remove('open'); }

  function wireLaunchers() {
    document.querySelectorAll('.agent-btn').forEach((button) => {
      if (button.dataset.openrabbitAgentWired === 'true') return;
      button.dataset.openrabbitAgentWired = 'true';
      button.style.cursor = 'pointer';
      button.addEventListener('click', () => open());
    });
    const command = document.getElementById('commandBar');
    if (command && command.dataset.openrabbitAgentWired !== 'true') {
      command.dataset.openrabbitAgentWired = 'true';
      command.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const value = command.value.trim();
          command.value = '';
          open(value);
        }
      });
    }
  }

  injectStyles();
  buildUi();
  wireLaunchers();
})();
