"use strict";

function required(value,name){if(typeof value!=="string"||!value.trim())throw new Error(`${name} is required`);return value.trim();}

class GoogleRefreshTokenProvider {
  constructor({clientId,clientSecret,refreshToken,fetchImpl=globalThis.fetch,now=()=>Date.now(),skewMs=60000}={}){
    this.clientId=required(clientId,"clientId");this.clientSecret=required(clientSecret,"clientSecret");this.refreshToken=required(refreshToken,"refreshToken");
    if(typeof fetchImpl!=="function")throw new Error("fetch implementation is required");this.fetch=fetchImpl;this.now=now;this.skewMs=skewMs;this.cached=null;this.inFlight=null;
  }
  async getAccessToken(){if(this.cached&&this.cached.expiresAt-this.skewMs>this.now())return this.cached.accessToken;if(this.inFlight)return this.inFlight;this.inFlight=this.refresh().finally(()=>{this.inFlight=null;});return this.inFlight;}
  async refresh(){const body=new URLSearchParams({client_id:this.clientId,client_secret:this.clientSecret,refresh_token:this.refreshToken,grant_type:"refresh_token"});const response=await this.fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:body.toString()});const payload=await response.json().catch(()=>({}));if(!response.ok||!payload.access_token){const err=new Error(payload?.error_description||payload?.error||`Google token refresh failed (${response.status})`);err.status=response.status;throw err;}const expiresIn=Math.max(60,Number(payload.expires_in)||3600);this.cached={accessToken:payload.access_token,expiresAt:this.now()+expiresIn*1000};return this.cached.accessToken;}
  clear(){this.cached=null;}
}

function createGoogleTokenProvider(config){const provider=new GoogleRefreshTokenProvider(config);return ()=>provider.getAccessToken();}

module.exports={GoogleRefreshTokenProvider,createGoogleTokenProvider};
