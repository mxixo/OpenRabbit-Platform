"use strict";
const assert=require('assert');
const {GoogleApiClient,GmailClient,GoogleCalendarClient,normalizeGmailMessage}=require('../integrations/google/productivity-clients');
(async()=>{
  const calls=[];
  const fetchImpl=async(url,options={})=>{calls.push([url,options]);if(url.includes('/messages?'))return {ok:true,json:async()=>({messages:[{id:'m1',threadId:'t1'}]})};if(url.includes('/messages/m1'))return {ok:true,json:async()=>({id:'m1',threadId:'t1',snippet:'see you',payload:{headers:[{name:'Subject',value:'Meet tomorrow'},{name:'From',value:'a@example.com'}],mimeType:'text/plain',body:{data:Buffer.from('Can we meet?').toString('base64url')}}})};if(url.includes('/events?'))return {ok:true,json:async()=>({items:[{id:'e1',summary:'Review',start:{dateTime:'2026-08-20T12:00:00-07:00'},end:{dateTime:'2026-08-20T12:30:00-07:00'}}]})};if(url.endsWith('/events'))return {ok:true,json:async()=>({id:'e2',summary:options.body?JSON.parse(options.body).summary:'',start:{dateTime:'2026-08-20T12:00:00-07:00'},end:{dateTime:'2026-08-20T12:30:00-07:00'}})};throw new Error(`unexpected URL ${url}`);};
  const api=new GoogleApiClient({tokenProvider:async()=> 'x'.repeat(40),fetchImpl});
  const gmail=new GmailClient({apiClient:api});const calendar=new GoogleCalendarClient({apiClient:api});
  const hits=await gmail.search({query:'is:unread',limit:10});assert.equal(hits[0].id,'m1');
  const msg=await gmail.read({messageId:'m1'});assert.equal(msg.subject,'Meet tomorrow');assert.match(msg.body,/Can we meet/);
  const events=await calendar.listEvents({start:'2026-08-20T00:00:00-07:00',end:'2026-08-21T00:00:00-07:00'});assert.equal(events[0].id,'e1');
  const created=await calendar.createEvent({title:'Review',start:'2026-08-20T12:00:00-07:00',end:'2026-08-20T12:30:00-07:00'});assert.equal(created.id,'e2');
  assert.ok(calls.every(([,o])=>o.headers.Authorization.startsWith('Bearer ')));
  console.log('google-productivity-clients.test.js: OK');
})().catch(e=>{console.error(e);process.exit(1)});
