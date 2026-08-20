"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function queueFile(app) { return path.join(app.getPath('userData'), 'openrabbit-action-queue.json'); }
function now() { return new Date().toISOString(); }
function read(app) {
  try {
    const file = queueFile(app);
    if (!fs.existsSync(file)) return { version: 1, actions: [], audit: [] };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { version: 1, actions: Array.isArray(parsed.actions) ? parsed.actions : [], audit: Array.isArray(parsed.audit) ? parsed.audit : [] };
  } catch { return { version: 1, actions: [], audit: [] }; }
}
function write(app, state) {
  const file = queueFile(app);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, 0o600); } catch {}
}
function audit(state, actionId, event, detail = {}) {
  state.audit.unshift({ id: crypto.randomUUID(), actionId, event, detail, at: now() });
  state.audit = state.audit.slice(0, 1000);
}
function normalize(input = {}) {
  const approvalRequired = input.approvalRequired !== false;
  return {
    id: input.id || crypto.randomUUID(),
    type: String(input.type || 'agent_task').slice(0, 80),
    title: String(input.title || 'OpenRabbit next action').slice(0, 160),
    reason: String(input.reason || '').slice(0, 1000),
    prompt: String(input.prompt || '').slice(0, 4000),
    provider: String(input.provider || '').slice(0, 80),
    payload: input.payload && typeof input.payload === 'object' ? input.payload : {},
    priority: ['high','medium','low'].includes(input.priority) ? input.priority : 'medium',
    approvalRequired,
    status: approvalRequired ? 'proposed' : 'approved',
    createdAt: now(), updatedAt: now(), approvedAt: null, completedAt: null,
    source: String(input.source || 'openrabbit-ai').slice(0, 100),
    confidence: Number.isFinite(Number(input.confidence)) ? Math.max(0, Math.min(1, Number(input.confidence))) : null,
    result: null, error: null
  };
}
function list(app, options = {}) {
  const state = read(app);
  let items = state.actions;
  if (options.status) items = items.filter(a => a.status === options.status);
  return items.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, Number(options.limit || 100));
}
function enqueue(app, input) {
  const state = read(app);
  const dedupe = String(input?.dedupeKey || '').trim();
  if (dedupe) {
    const existing = state.actions.find(a => a.dedupeKey === dedupe && ['proposed','approved','executing'].includes(a.status));
    if (existing) return existing;
  }
  const action = normalize(input);
  action.dedupeKey = dedupe || null;
  state.actions.unshift(action);
  state.actions = state.actions.slice(0, 500);
  audit(state, action.id, 'queued', { approvalRequired: action.approvalRequired, source: action.source });
  write(app, state);
  return action;
}
function transition(app, id, nextStatus, detail = {}) {
  const state = read(app);
  const action = state.actions.find(a => a.id === id);
  if (!action) throw new Error('Action not found.');
  const allowed = {
    proposed: ['approved','rejected'], approved: ['executing','rejected'], executing: ['completed','failed'],
    failed: ['approved','rejected'], completed: [], rejected: []
  };
  if (!(allowed[action.status] || []).includes(nextStatus)) throw new Error(`Cannot move action from ${action.status} to ${nextStatus}.`);
  action.status = nextStatus; action.updatedAt = now();
  if (nextStatus === 'approved') action.approvedAt = now();
  if (nextStatus === 'completed') { action.completedAt = now(); action.result = detail.result ?? detail; action.error = null; }
  if (nextStatus === 'failed') action.error = String(detail.error || detail.message || 'Action failed.').slice(0, 2000);
  audit(state, id, nextStatus, detail);
  write(app, state);
  return action;
}
function approve(app,id){ return transition(app,id,'approved'); }
function reject(app,id,reason='Dismissed by user'){ return transition(app,id,'rejected',{reason}); }
function markExecuting(app,id){ return transition(app,id,'executing'); }
function complete(app,id,result={}){ return transition(app,id,'completed',{result}); }
function fail(app,id,error){ return transition(app,id,'failed',{error:String(error?.message||error||'Action failed.')}); }
function auditLog(app, limit=200){ return read(app).audit.slice(0, Number(limit||200)); }

module.exports = { list, enqueue, approve, reject, markExecuting, complete, fail, auditLog };
