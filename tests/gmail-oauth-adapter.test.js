"use strict";
const assert = require("assert");
const { ConnectionRegistry } = require("../integrations/connection-registry");
const { GmailOAuthAdapter } = require("../integrations/google/gmail-oauth");

(async()=>{
  const registry = new ConnectionRegistry({store:new Map()});
  const calls=[];
  const fakeFetch=async(url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url).includes("oauth2.googleapis.com/token")) return {ok:true,json:async()=>({access_token:"access",refresh_token:"refresh",expires_in:3600,scope:"openid email https://www.googleapis.com/auth/gmail.readonly"})};
    if(String(url).endsWith("/profile")) return {ok:true,json:async()=>({emailAddress:"demo@example.com"})};
    if(String(url).includes("/messages?")) return {ok:true,json:async()=>({messages:[{id:"m1"}]})};
    if(String(url).includes("/messages/m1")) return {ok:true,json:async()=>({id:"m1",threadId:"t1",snippet:"hello",payload:{headers:[{name:"From",value:"Client <client@example.com>"},{name:"Subject",value:"Offer update"},{name:"Date",value:"Tue"}]}})};
    throw new Error(`unexpected ${url}`);
  };
  const adapter=new GmailOAuthAdapter({clientId:"cid",clientSecret:"secret",redirectUri:"http://localhost/callback",registry,fetchImpl:fakeFetch});
  const auth=adapter.authorizationUrl({userId:"u1"});
  assert(auth.url.includes("gmail.readonly"));
  const connected=await adapter.exchangeCode({code:"code",state:auth.state});
  assert.equal(connected.accountId,"demo@example.com");
  const saved=await registry.get({userId:"u1",provider:"gmail",accountId:"demo@example.com"});
  assert.equal(saved.refreshToken,"refresh");
  const discovered=await registry.findProviderConnection({userId:"u1",provider:"gmail"});
  assert.equal(discovered.accountId,"demo@example.com");
  const inbox=await adapter.listInbox({accessToken:"access"});
  assert.equal(inbox.messages[0].subject,"Offer update");
  assert(calls.length>=4);
  console.log("gmail-oauth-adapter.test.js passed");
})().catch(err=>{console.error(err);process.exit(1)});