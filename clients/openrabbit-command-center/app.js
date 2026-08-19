"use strict";

const drawer = document.getElementById("agentDrawer");
const talkBtn = document.getElementById("talkBtn");
const closeDrawer = document.getElementById("closeDrawer");
const agentSearch = document.getElementById("agentSearch");

function openAgent(prefill=""){
  drawer.classList.add("open");
  const textarea = drawer.querySelector("textarea");
  if(prefill) textarea.value = prefill;
  setTimeout(()=>textarea.focus(),100);
}

talkBtn?.addEventListener("click",()=>openAgent());
closeDrawer?.addEventListener("click",()=>drawer.classList.remove("open"));
agentSearch?.addEventListener("keydown",(event)=>{
  if(event.key === "Enter"){
    openAgent(event.currentTarget.value.trim());
    event.currentTarget.value = "";
  }
});

document.addEventListener("keydown",(event)=>{
  if((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k"){
    event.preventDefault();
    agentSearch?.focus();
  }
  if(event.key === "Escape") drawer.classList.remove("open");
});

document.querySelectorAll(".nav").forEach((button)=>{
  button.addEventListener("click",()=>{
    document.querySelectorAll(".nav").forEach((item)=>item.classList.remove("active"));
    button.classList.add("active");
    const label = button.textContent.trim();
    const targetMap = {Calendar:".calendar",CRM:".crm",Email:".email",Social:".social",Market:".market"};
    const target = document.querySelector(targetMap[label]);
    if(target) target.scrollIntoView({behavior:"smooth",block:"center"});
  });
});

document.querySelectorAll(".tabs, .segmented").forEach((group)=>{
  group.querySelectorAll("button").forEach((button)=>button.addEventListener("click",()=>{
    group.querySelectorAll("button").forEach((item)=>item.classList.remove("active"));
    button.classList.add("active");
  }));
});