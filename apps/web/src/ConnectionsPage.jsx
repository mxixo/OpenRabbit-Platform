import {useCallback,useEffect,useRef,useState} from 'react';
import {Check,ExternalLink,RefreshCw,ShieldCheck,Unplug} from 'lucide-react';
import {
  disconnectConnection,
  listConnections,
  openGoogleAuthorizationPopup,
  verifyConnection,
} from './connectionGateway';
import './connections.css';

const googleKinds={
  gmail:{kind:'gmail',writeCapability:'mail.send',writeLabel:'Authorize sending'},
  'google-calendar':{kind:'calendar',writeCapability:'calendar.write',writeLabel:'Authorize calendar writes'},
};

function statusFor(connection){
  if(connection.planned)return {label:'Planned',tone:'muted'};
  if(connection.platformCapability)return connection.verified?{label:'Available',tone:'good'}:{label:'Unavailable',tone:'muted'};
  if(!connection.configured)return {label:'Not configured',tone:'muted'};
  if(connection.verified)return {label:'Verified',tone:'good'};
  if(connection.connected&&connection.verificationState==='provider_unavailable')return {label:'Provider unavailable',tone:'warn'};
  if(connection.connected&&connection.verificationState==='refresh_failed')return {label:'Reconnect required',tone:'warn'};
  if(connection.connected)return {label:'Needs verification',tone:'warn'};
  return {label:'Not connected',tone:'muted'};
}

function capabilityCopy(connection){
  if(connection.id==='gmail'&&connection.capabilities){
    return connection.capabilities.mailSend?'Read + send authorized':'Read-only';
  }
  if(connection.id==='google-calendar'&&connection.capabilities){
    return connection.capabilities.calendarWrite?'Read + write authorized':'Read-only';
  }
  return null;
}

export default function ConnectionsPage({session}){
  const [connections,setConnections]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState('');
  const popupTimer=useRef(null);

  const refresh=useCallback(async()=>{
    setError('');
    try{
      const rows=await listConnections(session);
      setConnections(rows);
    }catch(err){
      setError(err?.message||'OpenRabbit could not load connection state.');
    }finally{
      setLoading(false);
    }
  },[session]);

  useEffect(()=>{
    refresh();
    return()=>{if(popupTimer.current)window.clearInterval(popupTimer.current)};
  },[refresh]);

  async function run(id,action,success){
    setBusy(id);
    setError('');
    setNotice('');
    try{
      await action();
      await refresh();
      if(success)setNotice(success);
    }catch(err){
      setError(err?.message||'The connection action failed.');
    }finally{
      setBusy('');
    }
  }

  async function authorize(connection,capability='read'){
    const config=googleKinds[connection.id];
    if(!config)return;
    setBusy(connection.id);
    setError('');
    setNotice('');
    try{
      const popup=await openGoogleAuthorizationPopup(session,{kind:config.kind,capability});
      if(popupTimer.current)window.clearInterval(popupTimer.current);
      popupTimer.current=window.setInterval(async()=>{
        if(!popup.closed)return;
        window.clearInterval(popupTimer.current);
        popupTimer.current=null;
        setBusy('');
        await refresh();
        setNotice('Google authorization finished. OpenRabbit refreshed provider-authoritative connection state.');
      },700);
    }catch(err){
      setBusy('');
      setError(err?.message||'Google authorization could not be started.');
    }
  }

  function renderActions(connection){
    const isBusy=busy===connection.id;
    const google=googleKinds[connection.id];
    if(connection.planned||connection.platformCapability)return null;
    if(google&&connection.configured&&!connection.connected){
      return <button className="button small" disabled={isBusy} onClick={()=>authorize(connection,'read')}><ExternalLink/> Connect read-only</button>;
    }
    if(!connection.connected)return null;
    const needsWrite=connection.id==='gmail'
      ?!connection.capabilities?.mailSend
      :connection.id==='google-calendar'
        ?!connection.capabilities?.calendarWrite
        :false;
    return <div className="connection-actions">
      <button disabled={isBusy} onClick={()=>run(connection.id,()=>verifyConnection(session,connection.id),'Provider authority rechecked.')}><RefreshCw/> Verify</button>
      {google&&needsWrite&&<button disabled={isBusy} onClick={()=>authorize(connection,google.writeCapability)}><ShieldCheck/> {google.writeLabel}</button>}
      <button className="danger-link" disabled={isBusy} onClick={()=>run(connection.id,()=>disconnectConnection(session,connection.id),connection.id.startsWith('google')?'Google access revoked. Gmail and Calendar state was reconciled.':'Connection removed.')}><Unplug/> Disconnect</button>
    </div>;
  }

  return <section className="connections-page">
    <div className="connections-heading">
      <div><p className="section-kicker">CONNECTION TRUST CENTER</p><h1>Connections</h1><p>OpenRabbit shows backend-authoritative provider state. Connecting does not automatically grant write authority.</p></div>
      <button className="connection-refresh" onClick={refresh} disabled={loading||Boolean(busy)}><RefreshCw/> Refresh</button>
    </div>
    <div className="connection-policy"><ShieldCheck/><div><strong>Least privilege by default</strong><span>Google starts read-only. Gmail send or Calendar write access is requested separately only when you choose to enable it.</span></div></div>
    {error&&<div className="connection-message error" role="alert">{error}</div>}
    {notice&&<div className="connection-message success" role="status"><Check/> {notice}</div>}
    {loading?<div className="connection-loading">Loading provider state…</div>:<div className="connection-grid">
      {connections.map(connection=>{const state=statusFor(connection);const capability=capabilityCopy(connection);return <article className="connection-card" key={connection.id}>
        <div className="connection-card-head"><div><span className="connection-category">{connection.category}</span><h2>{connection.label}</h2></div><span className={`connection-status ${state.tone}`}>{state.label}</span></div>
        <p>{connection.id==='gmail'?'Read recent email through the governed Google connection.':connection.id==='google-calendar'?'Read upcoming calendar events through the governed Google connection.':connection.planned?'This provider is on the roadmap and is not available yet.':connection.platformCapability?'Platform capability managed by OpenRabbit configuration.':'Provider connection managed by the OpenRabbit gateway.'}</p>
        {capability&&<div className="connection-capability"><ShieldCheck/> {capability}</div>}
        {connection.updatedAt&&<small>Provider state updated {new Date(connection.updatedAt).toLocaleString()}</small>}
        {renderActions(connection)}
      </article>})}
    </div>}
    {!loading&&connections.length===0&&!error&&<div className="connection-loading">No provider records were returned by the connection gateway.</div>}
    <p className="connection-footnote">Disconnecting either Google connection revokes the shared Google grant and can disconnect both Gmail and Google Calendar. OpenRabbit refreshes the provider state after the action instead of assuming success from the button click.</p>
  </section>;
}
