"use strict";

const gateway = require('./gateway-client');

const EXECUTABLE = new Set(['send_email','create_calendar_event','update_crm']);

function executable(type) { return EXECUTABLE.has(String(type || '')); }

async function execute(app, action) {
  if (!action || !executable(action.type)) {
    throw new Error(`Action type ${action?.type || 'unknown'} is not executable yet.`);
  }
  const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
  if (action.type === 'send_email') return gateway.executeAction(app, 'send-email', payload);
  if (action.type === 'create_calendar_event') return gateway.executeAction(app, 'create-calendar-event', payload);
  if (action.type === 'update_crm') return gateway.executeAction(app, 'update-crm', payload);
  throw new Error('Unsupported action.');
}

module.exports = { EXECUTABLE, executable, execute };
