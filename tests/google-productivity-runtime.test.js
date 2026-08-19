"use strict";
const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {loadGoogleProductivityConfig,createGoogleProductivityRuntime}=require('../runtime/google-productivity-runtime');
(()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'openrabbit-google-runtime-'));
  const config=loadGoogleProductivityConfig({OPENRABBIT_ORG_ID:'org-1',GOOGLE_OAUTH_CLIENT_ID:'client',GOOGLE_OAUTH_CLIENT_SECRET:'secret',GOOGLE_OAUTH_REFRESH_TOKEN:'refresh',GOOGLE_GMAIL_USER_ID:'me',GOOGLE_CALENDAR_ID:'primary',OPENRABBIT_MAIL_SCAN_INTERVAL_MS:'60000',OPENRABBIT_MEETING_PROPOSAL_FILE:path.join(tmp,'proposals.json')});
  const runtime=createGoogleProductivityRuntime(config,{extractor:async()=>[]});
  assert.ok(runtime.mailClient);assert.ok(runtime.calendarClient);assert.ok(runtime.capabilityProvider);assert.ok(runtime.detector);assert.ok(runtime.workflow);assert.ok(runtime.scheduler);assert.equal(runtime.scheduler.intervalMs,60000);assert.ok(fs.existsSync(config.proposalFile));
  console.log('google-productivity-runtime.test.js: OK');
})();
