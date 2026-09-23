import {useEffect,useMemo,useRef,useState} from 'react';
import {
  ADAPTIVE_ONBOARDING_DRAFT_KEY,
  ADAPTIVE_ONBOARDING_MAX_STEP,
  recommendAdaptiveOnboardingPreview,
  resetAdaptiveOnboardingProfile,
  restoreAdaptiveOnboardingDraft,
  serializeAdaptiveOnboardingDraft,
} from '@openrabbit/runtime-core/adaptive-onboarding';
import './onboarding.css';

const WORK_AREAS=[
  ['real_estate','Real estate'],
  ['business','Business operations'],
  ['city_public_service','City / public service'],
  ['personal','Personal command center'],
  ['configure_with_ai','Configure with AI'],
];
const OUTCOMES=[
  ['deadline_awareness','Stay ahead of deadlines'],
  ['lead_deal_movement','Move leads and deals forward'],
  ['decision_preparation','Prepare better decisions'],
  ['content_outreach','Prepare content and outreach'],
  ['cross_device_operation','Continue work across devices'],
];
const STARTING_STATES=[
  ['improve_existing','Improve what I already use'],
  ['create_new','Create a new workspace'],
  ['both','Blend existing tools with a new workspace'],
];
const PRESENTATION=[
  ['calendar_first','Calendar first'],
  ['communications_first','Communications first'],
  ['pipeline_first','Pipeline first'],
  ['map_first','Map first'],
  ['compact','Compact'],
  ['guided','Guided next action'],
];

function loadDraft(){
  const fallback=resetAdaptiveOnboardingProfile();
  try{
    const raw=window.localStorage.getItem(ADAPTIVE_ONBOARDING_DRAFT_KEY);
    return raw?restoreAdaptiveOnboardingDraft(raw):fallback;
  }catch{
    try{window.localStorage.removeItem(ADAPTIVE_ONBOARDING_DRAFT_KEY)}catch{
      // Storage cleanup is best-effort; the neutral in-memory profile remains safe.
    }
    return fallback;
  }
}

function Choice({checked,label,onChange,type='checkbox',name}){
  return <label className="onboarding-choice"><input type={type} name={name} checked={checked} onChange={onChange}/><span>{label}</span></label>;
}

export default function OnboardingPage(){
  const [profile,setProfile]=useState(loadDraft);
  const [storageStatus,setStorageStatus]=useState('');
  const [toolText,setToolText]=useState(()=>profile.existingTools.join(', '));
  const headingRef=useRef(null);

  useEffect(()=>{
    document.title='Set up OpenRabbit';
  },[]);

  useEffect(()=>{
    headingRef.current?.focus({preventScroll:true});
  },[profile.currentStep]);

  useEffect(()=>{
    try{
      window.localStorage.setItem(ADAPTIVE_ONBOARDING_DRAFT_KEY,serializeAdaptiveOnboardingDraft(profile));
      setStorageStatus('Saved on this device');
    }catch{
      setStorageStatus('Draft could not be saved');
    }
  },[profile]);

  const preview=useMemo(()=>{
    if(profile.currentStep!==ADAPTIVE_ONBOARDING_MAX_STEP)return null;
    try{return recommendAdaptiveOnboardingPreview(profile)}catch{
      // Invalid state fails closed to no preview rather than widening authority or provider access.
      return null;
    }
  },[profile]);

  function patch(values){setProfile(current=>({...current,...values}));}
  function next(){setProfile(current=>({...current,currentStep:Math.min(ADAPTIVE_ONBOARDING_MAX_STEP,current.currentStep+1),previewSeen:current.currentStep+1>=ADAPTIVE_ONBOARDING_MAX_STEP||current.previewSeen}));}
  function back(){setProfile(current=>({...current,currentStep:Math.max(1,current.currentStep-1)}));}
  function toggleOutcome(value){
    const exists=profile.desiredOutcomes.includes(value);
    if(exists&&profile.desiredOutcomes.length===1)return;
    patch({desiredOutcomes:exists?profile.desiredOutcomes.filter(item=>item!==value):[...profile.desiredOutcomes,value]});
  }
  function togglePresentation(value){
    const exists=profile.presentationPreferences.includes(value);
    if(!exists&&profile.presentationPreferences.length>=3)return;
    patch({presentationPreferences:exists?profile.presentationPreferences.filter(item=>item!==value):[...profile.presentationPreferences,value]});
  }
  function updateTools(value){
    setToolText(value);
    patch({existingTools:value.split(',').map(item=>item.trim()).filter(Boolean)});
  }
  function reset(){
    const fresh=resetAdaptiveOnboardingProfile();
    setProfile(fresh);
    setToolText('');
    try{window.localStorage.removeItem(ADAPTIVE_ONBOARDING_DRAFT_KEY)}catch{
      // UI reset still succeeds in memory if the browser denies storage access.
    }
  }

  const step=profile.currentStep;
  const progress=Math.round((step/ADAPTIVE_ONBOARDING_MAX_STEP)*100);
  const stepHeadingProps={id:'onboarding-title',ref:headingRef,tabIndex:-1};

  return <main className="onboarding-shell">
    <section className="onboarding-card" aria-labelledby="onboarding-title">
      <header className="onboarding-header">
        <a href="/" className="onboarding-brand">OpenRabbit</a>
        <button type="button" className="onboarding-reset" onClick={reset}>Reset</button>
      </header>
      <div className="onboarding-progress" aria-label={`Onboarding step ${step} of ${ADAPTIVE_ONBOARDING_MAX_STEP}`}>
        <div><span>Step {step} of {ADAPTIVE_ONBOARDING_MAX_STEP}</span><span>{progress}%</span></div>
        <progress max="100" value={progress}>{progress}%</progress>
      </div>

      {step===1&&<div className="onboarding-step">
        <p className="onboarding-kicker">WORK AREA</p>
        <h1 {...stepHeadingProps}>What should OpenRabbit help you run?</h1>
        <p>Choose the closest fit. This changes the workspace recommendation, not your account permissions.</p>
        <fieldset><legend className="sr-only">Primary work area</legend>{WORK_AREAS.map(([value,label])=><Choice key={value} type="radio" name="work-area" label={label} checked={profile.primaryWorkArea===value} onChange={()=>patch({primaryWorkArea:value})}/>)}</fieldset>
      </div>}

      {step===2&&<div className="onboarding-step">
        <p className="onboarding-kicker">OUTCOMES</p>
        <h1 {...stepHeadingProps}>What do you want OpenRabbit to improve first?</h1>
        <p>Select one or more. At least one outcome stays selected so the preview remains deterministic.</p>
        <fieldset><legend className="sr-only">Desired outcomes</legend>{OUTCOMES.map(([value,label])=><Choice key={value} label={label} checked={profile.desiredOutcomes.includes(value)} onChange={()=>toggleOutcome(value)}/>)}</fieldset>
      </div>}

      {step===3&&<div className="onboarding-step">
        <p className="onboarding-kicker">TOOLS</p>
        <h1 {...stepHeadingProps}>Which tools are already part of your day?</h1>
        <p>This is inventory only. Nothing is connected or authorized during onboarding.</p>
        <label className="onboarding-field">Tools, separated by commas<input value={toolText} onChange={event=>updateTools(event.target.value)} placeholder="Gmail, Google Calendar, HubSpot" autoComplete="off"/></label>
        <div className="onboarding-trust-note" role="note">Provider access remains off. Your preview can be generated without private provider data.</div>
      </div>}

      {step===4&&<div className="onboarding-step">
        <p className="onboarding-kicker">STARTING POINT</p>
        <h1 {...stepHeadingProps}>How should the workspace begin?</h1>
        <fieldset><legend className="sr-only">Starting state</legend>{STARTING_STATES.map(([value,label])=><Choice key={value} type="radio" name="starting-state" label={label} checked={profile.startingState===value} onChange={()=>patch({startingState:value})}/>)}</fieldset>
      </div>}

      {step===5&&<div className="onboarding-step">
        <p className="onboarding-kicker">PRESENTATION</p>
        <h1 {...stepHeadingProps}>How should OpenRabbit organize your view?</h1>
        <p>Choose up to three. You can return here and change these preferences later.</p>
        <fieldset><legend className="sr-only">Presentation preferences</legend>{PRESENTATION.map(([value,label])=><Choice key={value} label={label} checked={profile.presentationPreferences.includes(value)} onChange={()=>togglePresentation(value)}/>)}</fieldset>
      </div>}

      {step===6&&<div className="onboarding-step">
        <p className="onboarding-kicker">SIMULATED PREVIEW</p>
        <h1 {...stepHeadingProps}>Here is the workspace OpenRabbit would start with.</h1>
        <div className="onboarding-simulated" role="status">Simulated preview — no private provider data is being shown.</div>
        {preview?<div className="onboarding-preview">
          <div><span>Recommended pack</span><strong>{preview.recommendedIndustryPack}</strong></div>
          <div><span>Primary workflow</span><strong>{preview.primaryWorkflow}</strong></div>
          <div><span>Authority</span><strong>{preview.authorityProfile}</strong></div>
          <div className="onboarding-preview-wide"><span>Workspace layout</span><ul>{preview.workspaceLayout.map(item=><li key={item}>{item}</li>)}</ul></div>
          <div className="onboarding-preview-wide"><span>Connection plan</span>{preview.connectionPlan.length?<ul>{preview.connectionPlan.map(item=><li key={item.provider}>{item.provider}: ready to connect later</li>)}</ul>:<p>No provider connection is required for this preview.</p>}</div>
        </div>:<div className="onboarding-trust-note">Preview unavailable. Go back and review your choices.</div>}
        <button type="button" className="onboarding-edit" onClick={()=>patch({currentStep:5})}>Edit presentation choices</button>
      </div>}

      <footer className="onboarding-actions">
        <span role="status" aria-live="polite">{storageStatus}</span>
        <div>{step>1&&<button type="button" className="secondary" onClick={back}>Back</button>}{step<ADAPTIVE_ONBOARDING_MAX_STEP&&<button type="button" className="primary" onClick={next}>Continue</button>}{step===ADAPTIVE_ONBOARDING_MAX_STEP&&<a className="primary link-button" href="/app">Continue to OpenRabbit</a>}</div>
      </footer>
    </section>
  </main>;
}
