"use strict";

(function () {
  if (window.__openRabbitAgentChatLoaded) return;
  window.__openRabbitAgentChatLoaded = true;

  const state = { messages: [] };

  function injectStyles() {
    if (document.getElementById('openrabbitAgentStyles')) return;
    const style = document.createElement('style');
    style.id = 'openrabbitAgentStyles';
    style.textContent = `
      .or-agent-backdrop{position:fixed;inset:0;background:rgba(1,8,18,.72);backdrop-filter:blur(8px);z-index:9998;display:none;align-items:center;justify-content:center;padding:24px}
      .or-agent-backdrop.open{display:flex}
      .or-agent-shell{width:min(820px,96vw);height:min(720px,88vh);background:linear-gradient(180deg,#0b2035,#071524);border:1px solid #285886;border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.55);display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;color:#f7fbff}
      .or-agent-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #173f68;background:#07182a}
      .or-agent-title{display:flex;align-items:center;gap:11px}.or-agent-mark{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(#7f2ef0,#1559c8);font-size:22px}.or-agent-title b{font-size:18px}.or-agent-title small{display:block;color:#9cafc7;margin-top:2px}
      .or-agent-close{border:1px solid #285886;background:#0d243b;color:#fff;border-radius:9px;width:38px;height:38px;font-size:20px;cursor:pointer}
      .or-agent-messages{padding:18px;overflow:auto;display:flex;flex-direction:column;gap:12px}
      .or-agent-empty{margin:auto;max-width:520px;text-align:center;color:#aebed0;line-height:1.55}.or-agent-empty strong{display:block;color:#fff;font-size:22px;margin-bottom:8px}
      .or-agent-msg{max-width:82%;padding:12px 14px;border-radius:14px;line-height:1.48;white-space:pre-wrap;font-size:14px}.or-agent-msg.user{align-self:flex-end;background:linear-gradient(135deg,#1763da,#10469f);border-bottom-right-radius:4px}.or-agent-msg.assistant{align-self:flex-start;background:#102840;border:1px solid #214b75;border-bottom-left-radius:4px}.or-agent-msg.error{align-self:flex-start;background:#391a25;border:1px solid #7e3147;color:#ffd7e1}
      .or-agent-compose{padding:14px;border-top:1px solid #173f68;background:#07182a}.or-agent-row{display:grid;grid-template-columns:1fr auto;gap:9px}.or-agent-input{width:100%;min-height:54px;max-height:150px;resize:vertical;background:#08192b;color:#fff;border:1px solid #285886;border-radius:12px;padding:13px 14px;outline:none}.or-agent-input:focus{border-color:#4a83dd;box-shadow:0 0 0 2px rgba(74,131,221,.15)}.or-agent-send{min-width:110px;border:0;border-radius:12px;background:linear-gradient(135deg,#7425dc,#1559c8);color:#fff;font-weight:900;padding:0 18px;cursor:pointer}.or-agent-send:disabled{opacity:.55;cursor:wait}
      .or-agent-meta{margin-top:8px;display:flex;justify-content:space-between;gap:10px;color:#8fa3bb;font-size:11px}.or-agent-status.ok{color:#8df4c8}.or-agent-status.warn{color:#ffd38a}
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
          <div class="or-agent-title"><div class="or-agent-mark">🐇</div><div><b>OpenRabbit Agent</b><small>Powered by OpenAI</small></div></div>
          <button class="or-agent-close" type="button" aria-label="Close">×</button>
        </header>
        <div class="or-agent-messages" id="openrabbitAgentMessages">
          <div class="or-agent-empty" id="openrabbitAgentEmpty"><strong>Talk to OpenRabbit</strong>Ask a question, plan a task, or tell the agent what you want to accomplish. Connected tools and approval-gated actions will be added here as OpenRabbit grows.</div>
        </div>
        <footer class="or-agent-compose">
          <div class="or-agent-row"><textarea id="openrabbitAgentInput" class="or-agent-input" placeholder="Ask OpenRabbit…"></textarea><button id="openrabbitAgentSend" class="or-agent-send" type="button">Send</button></div>
          <div class="or-agent-meta"><span id="openrabbitAgentStatus" class="or-agent-status">Checking OpenAI connection…</span><span>Enter to send · Shift+Enter for new line</span></div>
        </footer>
      </section>`;
    document.body.appendChild(backdrop);

    backdrop.querySelector('.or-agent-close')?.addEventListener('click', close);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && backdrop.classList.contains('open')) close(); });

    const input = document.getElementById('openrabbitAgentInput');
    const send = document.getElementById('openrabbitAgentSend');
    send?.addEventListener('click', submit);
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    });
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

  async function refreshStatus() {
    try {
      const integration = await window.openRabbitDesktop?.getIntegrationStatus?.();
      if (integration?.openai) setStatus('OpenAI connected · ready', 'ok');
      else setStatus('OpenAI key not configured on this computer', 'warn');
    } catch {
      setStatus('Unable to verify OpenAI connection', 'warn');
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
      setStatus(`OpenAI connected · ${result?.model || 'agent'} · ready`, 'ok');
    } catch (error) {
      pending?.remove();
      renderMessage('assistant', error?.message || String(error), 'error');
      setStatus('OpenAI request failed', 'warn');
    } finally {
      send.disabled = false;
      input?.focus();
    }
  }

  function open(prefill = '') {
    injectStyles();
    buildUi();
    const backdrop = document.getElementById('openrabbitAgentBackdrop');
    const input = document.getElementById('openrabbitAgentInput');
    backdrop?.classList.add('open');
    if (prefill && input) input.value = prefill;
    refreshStatus();
    setTimeout(() => input?.focus(), 30);
  }

  function close() {
    document.getElementById('openrabbitAgentBackdrop')?.classList.remove('open');
  }

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
