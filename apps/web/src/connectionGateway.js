const configuredBaseUrl=String(import.meta.env.VITE_OPENRABBIT_CONNECTION_GATEWAY_URL||'').trim().replace(/\/$/,'')

function endpoint(path){return `${configuredBaseUrl}${path}`}

function requireAccessToken(session){
  const token=String(session?.access_token||'').trim()
  if(!token)throw new Error('A signed-in OpenRabbit session is required to manage connections.')
  return token
}

async function gatewayRequest(session,path,{method='GET',body}={}){
  const token=requireAccessToken(session)
  const response=await fetch(endpoint(path),{
    method,
    headers:{
      authorization:`Bearer ${token}`,
      ...(body===undefined?{}:{'content-type':'application/json'})
    },
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  })
  const text=await response.text()
  let payload={}
  try{payload=text?JSON.parse(text):{}}catch{payload={error:text||`Gateway returned HTTP ${response.status}`}}
  if(!response.ok){
    const message=payload?.error?.message||payload?.message||payload?.error||`Connection gateway returned HTTP ${response.status}`
    const error=new Error(String(message))
    error.status=response.status
    error.payload=payload
    throw error
  }
  return payload
}

export function connectionGatewayConfigured(){
  return Boolean(configuredBaseUrl)||typeof window!=='undefined'
}

export async function listConnections(session){
  const payload=await gatewayRequest(session,'/v1/connections')
  return Array.isArray(payload?.connections)?payload.connections:[]
}

export async function verifyConnection(session,provider){
  const id=encodeURIComponent(String(provider||'').trim())
  if(!id)throw new Error('A connection provider is required.')
  return gatewayRequest(session,`/v1/connections/${id}/verify`,{method:'POST'})
}

export async function disconnectConnection(session,provider){
  const id=encodeURIComponent(String(provider||'').trim())
  if(!id)throw new Error('A connection provider is required.')
  return gatewayRequest(session,`/v1/connections/${id}`,{method:'DELETE'})
}

export async function startGoogleAuthorization(session,{kind,capability='read'}={}){
  const normalizedKind=kind==='calendar'?'calendar':'gmail'
  const allowed=normalizedKind==='calendar'?new Set(['read','calendar.write']):new Set(['read','mail.send'])
  if(!allowed.has(capability))throw new Error(`Unsupported ${normalizedKind} authorization capability.`)
  const query=new URLSearchParams({kind:normalizedKind,capability})
  const payload=await gatewayRequest(session,`/v1/connections/google/start?${query.toString()}`,{method:'POST'})
  const authorizationUrl=String(payload?.authorizationUrl||'').trim()
  if(!authorizationUrl.startsWith('https://accounts.google.com/'))throw new Error('Connection gateway did not return a trusted Google authorization URL.')
  return authorizationUrl
}

export async function openGoogleAuthorization(session,options){
  const authorizationUrl=await startGoogleAuthorization(session,options)
  window.location.assign(authorizationUrl)
}

export async function openGoogleAuthorizationPopup(session,options){
  const authorizationUrl=await startGoogleAuthorization(session,options)
  const popup=window.open(
    authorizationUrl,
    'openrabbit-google-oauth',
    'popup=yes,width=620,height=780,resizable=yes,scrollbars=yes'
  )
  if(!popup)throw new Error('Your browser blocked the Google authorization window. Allow pop-ups for OpenRabbit and try again.')
  try{popup.focus()}catch{}
  return popup
}
