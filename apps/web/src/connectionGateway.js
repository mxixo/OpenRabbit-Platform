const DEFAULT_PRODUCTIVITY_API_BASE='/api/productivity'
const CALLBACK_PATH='/connections/google/callback'

function cleanBase(value){return String(value||DEFAULT_PRODUCTIVITY_API_BASE).replace(/\/$/,'')}
function normalizeProvider(value){return String(value||'').trim().toLowerCase()}
function normalizeScopes(scopes){return Array.from(new Set((scopes||[]).map(value=>String(value||'').trim()).filter(Boolean))).sort()}

function storageKey(connectionId){return `openrabbit.connection.${connectionId}`}

export function saveConnectionSession(session,storage=window.sessionStorage){
  if(!session?.connectionId)throw new Error('connectionId is required')
  storage.setItem(storageKey(session.connectionId),JSON.stringify(session))
}

export function loadConnectionSession(connectionId,storage=window.sessionStorage){
  const raw=storage.getItem(storageKey(connectionId))
  if(!raw)return null
  try{return JSON.parse(raw)}catch{return null}
}

export function clearConnectionSession(connectionId,storage=window.sessionStorage){storage.removeItem(storageKey(connectionId))}

export async function createGoogleConnectionSession({returnPath='/settings/connections',requestedScopes=[]}={},options={}){
  const apiBase=cleanBase(options.apiBase)
  const response=await fetch(`${apiBase}/connections/google/session`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    credentials:'include',
    body:JSON.stringify({returnPath,requestedScopes:normalizeScopes(requestedScopes)})
  })
  if(!response.ok)throw new Error(`Could not prepare Google connection (${response.status})`)
  const session=await response.json()
  if(normalizeProvider(session.provider)!=='google'||!session.connectionId||!session.authorizationUrl)throw new Error('Invalid Google connection session')
  saveConnectionSession(session,options.storage||window.sessionStorage)
  return session
}

export function buildGoogleCallbackUrl(connectionId,{origin=window.location.origin}={}){
  if(!connectionId)throw new Error('connectionId is required')
  return new URL(`${CALLBACK_PATH}?connectionId=${encodeURIComponent(connectionId)}`,origin).toString()
}

export async function completeGoogleConnectionCallback({connectionId,code,state,error,errorDescription}={},options={}){
  if(!connectionId)throw new Error('Missing connectionId')
  const storage=options.storage||window.sessionStorage
  const session=loadConnectionSession(connectionId,storage)
  if(!session)throw new Error('Connection session is missing or expired. Start the Google connection again.')
  if(state!==session.state)throw new Error('Google connection state did not match. Start again.')
  if(error)throw new Error(errorDescription||error)
  if(!code)throw new Error('Google did not return an authorization code.')
  const apiBase=cleanBase(options.apiBase)
  const response=await fetch(`${apiBase}/connections/google/callback`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    credentials:'include',
    body:JSON.stringify({connectionId,code,state})
  })
  const payload=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(payload.message||`Google connection failed (${response.status})`)
  clearConnectionSession(connectionId,storage)
  return payload
}

export async function openGoogleAuthorizationPopup(session,options={}){
  if(!session?.authorizationUrl)throw new Error('authorizationUrl is required')
  const popup=(options.openWindow||window.open)(
    session.authorizationUrl,
    'openrabbit-google-connection',
    'popup=yes,width=620,height=780,resizable=yes,scrollbars=yes'
  )
  if(!popup)throw new Error('Your browser blocked the Google authorization window. Allow pop-ups for OpenRabbit and try again.')
  try{popup.focus()}catch{
    // Popup focus is best-effort; the authorization window remains usable if focus is denied.
  }
  return popup
}
