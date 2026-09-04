"use strict";

const crypto=require('crypto');
const fs=require('fs');
const path=require('path');

const DEFAULT_SCOPES=[
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events'
];

function required(value,name){if(typeof value!=="string"||!value.trim())throw new Error(`${name} is required`);return value.trim();}
function base64url(buffer){return buffer.toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function randomState(){return base64url(crypto.randomBytes(24));}

function buildGoogleAuthorizationUrl({clientId,redirectUri,scopes=DEFAULT_SCOPES,state=randomState(),prompt='consent'}={}){
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:required(clientId,'clientId'),redirect_uri:required(redirectUri,'redirectUri'),response_type:'code',access_type:'offline',include_granted_scopes:'true',prompt,scope:scopes.join(' '),state}).toString();
  return {url:url.toString(),state};
}

async function exchangeGoogleAuthorizationCode({clientId,clientSecret,redirectUri,code,fetchImpl=globalThis.fetch}={}){
  if(typeof fetchImpl!=="function")throw new Error('fetch implementation is required');
  const body=new URLSearchParams({client_id:required(clientId,'clientId'),client_secret:required(clientSecret,'clientSecret'),redirect_uri:required(redirectUri,'redirectUri'),code:required(code,'code'),grant_type:'authorization_code'});
  const response=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||!payload.access_token){throw new Error(payload?.error_description||payload?.error||`Google authorization exchange failed (${response.status})`);}
  return {accessToken:payload.access_token,refreshToken:payload.refresh_token||null,expiresIn:Number(payload.expires_in)||3600,scope:payload.scope||'',tokenType:payload.token_type||'Bearer'};
}

function saveRefreshTokenFile(filePath,refreshToken){
  const token=required(refreshToken,'refreshToken');const resolved=path.resolve(filePath);fs.mkdirSync(path.dirname(resolved),{recursive:true});
  const tmp=`${resolved}.tmp`;fs.writeFileSync(tmp,JSON.stringify({version:1,refreshToken:token},null,2),{mode:0o600});fs.chmodSync(tmp,0o600);fs.renameSync(tmp,resolved);try{fs.chmodSync(resolved,0o600);}catch{}
  return resolved;
}

function loadRefreshTokenFile(filePath){const resolved=path.resolve(filePath);const parsed=JSON.parse(fs.readFileSync(resolved,'utf8'));return required(parsed.refreshToken,'refreshToken');}

module.exports={DEFAULT_SCOPES,buildGoogleAuthorizationUrl,exchangeGoogleAuthorizationCode,saveRefreshTokenFile,loadRefreshTokenFile};
