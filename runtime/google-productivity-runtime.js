"use strict";

const path=require('path');
const {GoogleApiClient,GmailClient,GoogleCalendarClient}=require('../integrations/google/productivity-clients');
const {createGoogleTokenProvider}=require('../integrations/google/oauth-token-provider');
const {loadRefreshTokenFile}=require('../integrations/google/oauth-authorization-flow');
const {createOpenAiMeetingExtractor}=require('../integrations/openai/meeting-extractor');
const {ProductivityCapabilityProviderAdapter}=require('../capabilities/productivity/provider-adapter');
const {StructuredMeetingDetector}=require('../capabilities/productivity/meeting-detector');
const {DurableMeetingProposalStore}=require('../capabilities/productivity/durable-meeting-proposal-store');
const {MeetingProposalWorkflow}=require('../capabilities/productivity/meeting-proposals');
const {MailScanScheduler}=require('../capabilities/productivity/mail-scan-scheduler');

function required(env,name){const value=env[name];if(typeof value!=="string"||!value.trim())throw new Error(`${name} is required`);return value.trim();}
function numberEnv(env,name,fallback){const raw=env[name];if(raw===undefined||raw==='')return fallback;const value=Number(raw);if(!Number.isFinite(value))throw new Error(`${name} must be numeric`);return value;}
function resolveRefreshToken(env){if(env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim())return env.GOOGLE_OAUTH_REFRESH_TOKEN.trim();const file=env.GOOGLE_OAUTH_TOKEN_FILE||path.join(process.cwd(),'.openrabbit','google-oauth.json');return loadRefreshTokenFile(file);}

function loadGoogleProductivityConfig(env=process.env){return {
  orgId:required(env,'OPENRABBIT_ORG_ID'),clientId:required(env,'GOOGLE_OAUTH_CLIENT_ID'),clientSecret:required(env,'GOOGLE_OAUTH_CLIENT_SECRET'),refreshToken:resolveRefreshToken(env),
  gmailUserId:env.GOOGLE_GMAIL_USER_ID||'me',calendarId:env.GOOGLE_CALENDAR_ID||'primary',scanQuery:env.OPENRABBIT_MAIL_SCAN_QUERY||'is:unread',scanLimit:numberEnv(env,'OPENRABBIT_MAIL_SCAN_LIMIT',25),scanIntervalMs:numberEnv(env,'OPENRABBIT_MAIL_SCAN_INTERVAL_MS',300000),proposalFile:env.OPENRABBIT_MEETING_PROPOSAL_FILE||path.join(process.cwd(),'.openrabbit','meeting-proposals.json'),
  openAiApiKey:required(env,'OPENAI_API_KEY'),openAiModel:env.OPENRABBIT_MEETING_MODEL||'gpt-5.6-luna',timeZone:env.OPENRABBIT_TIME_ZONE||'America/Phoenix'
};}

function createGoogleProductivityRuntime(config,{extractor,fetchImpl=globalThis.fetch,onScanResult=()=>{},onScanError=()=>{}}={}){
  const meetingExtractor=extractor||createOpenAiMeetingExtractor({apiKey:config.openAiApiKey,model:config.openAiModel,fetchImpl,timeZone:config.timeZone});
  const tokenProvider=createGoogleTokenProvider({clientId:config.clientId,clientSecret:config.clientSecret,refreshToken:config.refreshToken,fetchImpl});
  const apiClient=new GoogleApiClient({tokenProvider,fetchImpl});const mailClient=new GmailClient({apiClient,userId:config.gmailUserId});const calendarClient=new GoogleCalendarClient({apiClient,calendarId:config.calendarId});
  const capabilityProvider=new ProductivityCapabilityProviderAdapter({mailClient,calendarClient});const detector=new StructuredMeetingDetector({extractor:meetingExtractor});const store=new DurableMeetingProposalStore({filePath:config.proposalFile});const workflow=new MeetingProposalWorkflow({capabilityProvider,detector,store});
  const scheduler=new MailScanScheduler({workflow,orgId:config.orgId,query:config.scanQuery,limit:config.scanLimit,intervalMs:config.scanIntervalMs,onResult:onScanResult,onError:onScanError});
  return {tokenProvider,apiClient,mailClient,calendarClient,capabilityProvider,detector,store,workflow,scheduler};
}
module.exports={loadGoogleProductivityConfig,createGoogleProductivityRuntime,resolveRefreshToken};
