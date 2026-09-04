"use strict";

const viewMeta={
  dashboard:["Today","Your operating picture"],
  calendar:["Calendar","Confirmed + proposed schedule"],
  mail:["Mail","Prioritized by required action"],
  agent:["Agent Activity","Human-in-the-loop control"],
  properties:["Properties","Search, map and underwriting"],
  crm:["CRM","Leads, clients and follow-up"],
  social:["Social","Approval-gated content automation"]
};

function activateView(name){
  document.querySelectorAll('.view').forEach((el)=>el.classList.toggle('active',el.id===`view-${name}`));
  document.querySelectorAll('.nav-btn').forEach((el)=>el.classList.toggle('active',el.dataset.view===name));
  const [title,context]=viewMeta[name]||["OpenRabbit",""];
  document.getElementById('pageTitle').textContent=title;
  document.getElementById('pageContext').textContent=context;
  localStorage.setItem('openrabbit.activeView',name);
}

document.querySelectorAll('.nav-btn').forEach((button)=>button.addEventListener('click',()=>activateView(button.dataset.view)));
document.querySelectorAll('[data-jump]').forEach((button)=>button.addEventListener('click',()=>activateView(button.dataset.jump)));

const previousView=localStorage.getItem('openrabbit.activeView');
if(previousView&&viewMeta[previousView])activateView(previousView);

const mapToggle=document.getElementById('mapToggle');
mapToggle?.addEventListener('click',()=>{
  const panel=document.getElementById('mapPanel');
  panel.hidden=!panel.hidden;
  mapToggle.textContent=panel.hidden?'Map':'Hide map';
});

const commandBar=document.getElementById('commandBar');
commandBar?.addEventListener('keydown',(event)=>{
  if(event.key!=="Enter")return;
  const query=commandBar.value.trim().toLowerCase();
  if(!query)return;
  if(query.includes('calendar')||query.includes('meeting'))activateView('calendar');
  else if(query.includes('mail')||query.includes('email')||query.includes('inbox'))activateView('mail');
  else if(query.includes('property')||query.includes('deal')||query.includes('map'))activateView('properties');
  else if(query.includes('crm')||query.includes('lead')||query.includes('client')||query.includes('pipeline'))activateView('crm');
  else if(query.includes('social')||query.includes('post')||query.includes('instagram')||query.includes('linkedin'))activateView('social');
  else if(query.includes('agent')||query.includes('approval'))activateView('agent');
  else activateView('dashboard');
  commandBar.value='';
});

function markApproved(button){
  const row=button.closest('.activity-row');
  if(!row)return;
  const pill=row.querySelector('.pill');
  pill?.classList.remove('proposed');
  if(pill){pill.classList.add('approved');pill.textContent=button.textContent==='Reject'?'Rejected':'Approved';}
  row.querySelectorAll('.approval-action').forEach((action)=>action.disabled=true);
}

document.querySelectorAll('.approval-action').forEach((button)=>button.addEventListener('click',()=>markApproved(button)));

document.getElementById('approveAllMeetings')?.addEventListener('click',()=>{
  document.querySelectorAll('.cal-item.proposed').forEach((item)=>{item.classList.remove('proposed');item.classList.add('approved');});
  const btn=document.getElementById('approveAllMeetings');
  btn.textContent='Approved';btn.disabled=true;
});

document.getElementById('approvePost')?.addEventListener('click',()=>{
  const btn=document.getElementById('approvePost');
  btn.textContent='Approved for publishing';btn.disabled=true;
});

document.getElementById('refreshBtn')?.addEventListener('click',()=>location.reload());

document.addEventListener('keydown',(event)=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();commandBar?.focus();
  }
});
