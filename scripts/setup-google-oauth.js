"use strict";

const http=require('http');
const fs=require('fs');
const {buildGoogleAuthorizationUrl,exchangeGoogleAuthorizationCode,saveRefreshTokenFile}=require('../integrations/google/oauth-authorization-flow');

function required(env,name){const value=env[name];if(typeof value!=="string"||!value.trim())throw new Error(`${name} is required`);return value.trim();}
async function main(env=process.env){
  if(fs.existsSync('.env')&&typeof process.loadEnvFile==='function')process.loadEnvFile('.env');
  const clientId=required(env,'GOOGLE_OAUTH_CLIENT_ID');const clientSecret=required(env,'GOOGLE_OAUTH_CLIENT_SECRET');
  const port=Number(env.GOOGLE_OAUTH_CALLBACK_PORT||53682);const redirectUri=env.GOOGLE_OAUTH_REDIRECT_URI||`http://127.0.0.1:${port}/oauth/google/callback`;const tokenFile=env.GOOGLE_OAUTH_TOKEN_FILE||'.openrabbit/google-oauth.json';
  const {url,state}=buildGoogleAuthorizationUrl({clientId,redirectUri});
  const server=http.createServer(async(req,res)=>{
    const requestUrl=new URL(req.url,redirectUri);if(requestUrl.pathname!=='/oauth/google/callback'){res.writeHead(404);return res.end('Not found');}
    if(requestUrl.searchParams.get('state')!==state){res.writeHead(400);return res.end('OAuth state mismatch. You can close this window and retry.');}
    const error=requestUrl.searchParams.get('error');if(error){res.writeHead(400);return res.end(`Google authorization failed: ${error}`);}
    try{const tokens=await exchangeGoogleAuthorizationCode({clientId,clientSecret,redirectUri,code:requestUrl.searchParams.get('code')});if(!tokens.refreshToken)throw new Error('Google did not return a refresh token. Revoke prior consent or retry with consent prompt.');saveRefreshTokenFile(tokenFile,tokens.refreshToken);res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});res.end('OpenRabbit Google authorization complete. You can close this window.');console.log(`Saved Google refresh token securely to ${tokenFile}`);}catch(err){res.writeHead(500);res.end(`OpenRabbit authorization failed: ${err.message}`);console.error(err.message);}finally{server.close();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  console.log('\nAuthorize OpenRabbit with Google by opening this URL:\n');console.log(url);console.log(`\nWaiting for Google callback at ${redirectUri}`);
}
if(require.main===module)main().catch(err=>{console.error(`Google OAuth setup failed: ${err.message}`);process.exit(1);});
module.exports={main};
