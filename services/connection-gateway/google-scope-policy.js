'use strict';

const GMAIL_READONLY = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_MODIFY = 'https://www.googleapis.com/auth/gmail.modify';
const GMAIL_SEND = 'https://www.googleapis.com/auth/gmail.send';
const GMAIL_FULL = 'https://mail.google.com/';
const CALENDAR = 'https://www.googleapis.com/auth/calendar';
const CALENDAR_EVENTS = 'https://www.googleapis.com/auth/calendar.events';
const CALENDAR_READONLY = 'https://www.googleapis.com/auth/calendar.readonly';
const CALENDAR_EVENTS_READONLY = 'https://www.googleapis.com/auth/calendar.events.readonly';

function grantedScopes(token) {
  const raw = token && typeof token.scope === 'string' ? token.scope : '';
  return new Set(raw.split(/\s+/).map(value => value.trim()).filter(Boolean));
}

function hasAny(token, accepted) {
  const actual = grantedScopes(token);
  return accepted.some(scope => actual.has(scope));
}

function canReadGmail(token) {
  return hasAny(token, [GMAIL_READONLY, GMAIL_MODIFY, GMAIL_FULL]);
}

function canSendGmail(token) {
  return hasAny(token, [GMAIL_SEND, GMAIL_MODIFY, GMAIL_FULL]);
}

function canReadCalendar(token) {
  return hasAny(token, [CALENDAR_READONLY, CALENDAR_EVENTS_READONLY, CALENDAR_EVENTS, CALENDAR]);
}

function canCreateCalendarEvent(token) {
  return hasAny(token, [CALENDAR_EVENTS, CALENDAR]);
}

function publicCapabilityEvidence(token) {
  return {
    mailRead: canReadGmail(token),
    mailSend: canSendGmail(token),
    calendarRead: canReadCalendar(token),
    calendarWrite: canCreateCalendarEvent(token),
  };
}

module.exports = {
  GMAIL_READONLY,
  GMAIL_MODIFY,
  GMAIL_SEND,
  GMAIL_FULL,
  CALENDAR,
  CALENDAR_EVENTS,
  CALENDAR_READONLY,
  CALENDAR_EVENTS_READONLY,
  grantedScopes,
  canReadGmail,
  canSendGmail,
  canReadCalendar,
  canCreateCalendarEvent,
  publicCapabilityEvidence,
};
