"use strict";

const tabs=[...document.querySelectorAll(".deal-tabs [data-tab]")];
const panes=[...document.querySelectorAll("[data-pane]")];
const drawer=document.getElementById("dealAgentDrawer");
const closeDrawer=document.getElementById("closeDealDrawer");
const runBtn=document.getElementById("runDealAgent");
const search=document.getElementById("dealAgentSearch");

function toast(message){
  const stack=document.querySelector(".toast-stack");
  const el=document.createElement("div");
  el.className="toast";el.textContent=message;stack.appendChild(el);
  requestAnimationFrame(()=>el.classList.add("show"));
  setTimeout(()=>{el.classList.remove("show");setTimeout(()=>el.remove(),220)},2200);
}

function openTab(name){
  tabs.forEach((tab)=>tab.classList.toggle("active",tab.dataset.tab===name));
  panes.forEach((pane)=>pane.classList.toggle("active",pane.dataset.pane===name));
  window.scrollTo({top:0,behavior:"smooth"});
}

function openAgent(prefill=""){
  drawer.classList.add("open");
  const textarea=drawer.querySelector("textarea");
  if(prefill) textarea.value=prefill;
  setTimeout(()=>textarea.focus(),80);
}

function runAgent(){
  const textarea=drawer.querySelector("textarea");
  const value=textarea.value.trim();
  if(!value){textarea.focus();return}
  const response=drawer.querySelector(".agent-response");
  response.hidden=false;
  response.querySelector("b").textContent="Action plan prepared";
  response.querySelector("p").textContent="Prototype: OpenRabbit used CRM, email, documents, tasks, timeline, underwriting, and approval context from this deal to prepare the requested next action.";
  toast("OpenRabbit prepared a deal-aware action plan.");
}

tabs.forEach((tab)=>tab.addEventListener("click",()=>openTab(tab.dataset.tab)));
document.querySelectorAll("[data-jump]").forEach((button)=>button.addEventListener("click",()=>openTab(button.dataset.jump)));
document.querySelectorAll("[data-agent]").forEach((button)=>button.addEventListener("click",()=>openAgent(button.dataset.agent)));
closeDrawer?.addEventListener("click",()=>drawer.classList.remove("open"));
runBtn?.addEventListener("click",runAgent);
search?.addEventListener("keydown",(event)=>{if(event.key==="Enter"){openAgent(search.value.trim());search.value=""}});

document.querySelectorAll(".task-list input").forEach((box)=>box.addEventListener("change",()=>toast(box.checked?"Task marked complete":"Task reopened")));
document.querySelector(".approve-btn")?.addEventListener("click",(event)=>{event.currentTarget.textContent="Approved";event.currentTarget.disabled=true;toast("Buyer update approved for execution.")});
document.querySelectorAll(".document-grid button:not([data-agent]), .mini-action:not([data-agent])").forEach((button)=>button.addEventListener("click",()=>toast(`${button.textContent.trim()} — prototype action`)));

document.addEventListener("keydown",(event)=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();search?.focus()}
  if(event.key==="Escape") drawer.classList.remove("open");
});