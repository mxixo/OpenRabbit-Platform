"use strict";
const assert=require('assert');
const {MailScanScheduler}=require('../capabilities/productivity/mail-scan-scheduler');
(async()=>{
  let scans=0;let intervalFn;let cleared=false;
  const workflow={scanMail:async(input)=>{scans++;assert.equal(input.orgId,'org-1');return [{id:`p${scans}`}];}};
  const scheduler=new MailScanScheduler({workflow,orgId:'org-1',intervalMs:60000,setIntervalImpl:(fn)=>{intervalFn=fn;return 123;},clearIntervalImpl:(id)=>{assert.equal(id,123);cleared=true;}});
  scheduler.start({runImmediately:false});assert.equal(scheduler.started,true);await intervalFn();assert.equal(scans,1);
  scheduler.stop();assert.equal(cleared,true);assert.equal(scheduler.started,false);
  let release;const slow={scanMail:()=>new Promise(r=>{release=r;})};const overlap=new MailScanScheduler({workflow:slow,orgId:'org-1',intervalMs:60000});const first=overlap.tick();const second=await overlap.tick();assert.deepEqual(second,{skipped:true,reason:'scan_in_progress'});release([]);await first;
  console.log('mail-scan-scheduler.test.js: OK');
})().catch(e=>{console.error(e);process.exit(1)});
