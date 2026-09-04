"use strict";
const assert=require('assert');
const {loadConfig,createServer}=require('../scripts/start-productivity-api');

const config=loadConfig({OPENRABBIT_PRODUCTIVITY_PORT:'8787',OPENRABBIT_PRODUCTIVITY_HOST:'127.0.0.1',OPENRABBIT_API_TOKEN:'x'.repeat(32),OPENRABBIT_ACTOR_ID:'actor-1',OPENRABBIT_ORG_ID:'org-1',GOOGLE_OAUTH_CLIENT_ID:'client',GOOGLE_OAUTH_CLIENT_SECRET:'secret',GOOGLE_OAUTH_REFRESH_TOKEN:'refresh',OPENAI_API_KEY:'sk-test'});
assert.equal(config.port,8787);assert.equal(config.host,'127.0.0.1');assert.equal(config.google.orgId,'org-1');
let handled=false;const api={async handle(input){handled=true;assert.equal(input.actorId,'actor-1');return {status:200,data:{ok:true}};}};const authenticate=async()=>({actorId:'actor-1',orgId:'org-1'});const server=createServer({api,authenticate});assert.ok(server&&typeof server.listen==='function');server.close();assert.equal(handled,false);
console.log('productivity-service-entrypoint.test.js: OK');
