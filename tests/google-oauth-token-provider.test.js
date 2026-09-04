"use strict";
const assert=require('assert');
const {GoogleRefreshTokenProvider}=require('../integrations/google/oauth-token-provider');
(async()=>{
  let calls=0;let now=1000;
  const fetchImpl=async(url,options)=>{calls++;assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(options.method,'POST');assert.match(options.body,/grant_type=refresh_token/);return {ok:true,status:200,json:async()=>({access_token:`token-${calls}`,expires_in:3600})};};
  const provider=new GoogleRefreshTokenProvider({clientId:'client',clientSecret:'secret',refreshToken:'refresh',fetchImpl,now:()=>now,skewMs:60000});
  const first=await provider.getAccessToken();const second=await provider.getAccessToken();assert.equal(first,'token-1');assert.equal(second,'token-1');assert.equal(calls,1);
  now+=3600*1000;const third=await provider.getAccessToken();assert.equal(third,'token-2');assert.equal(calls,2);
  provider.clear();await provider.getAccessToken();assert.equal(calls,3);
  console.log('google-oauth-token-provider.test.js: OK');
})().catch(e=>{console.error(e);process.exit(1)});
