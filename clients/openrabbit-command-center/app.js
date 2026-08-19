"use strict";

const drawer = document.getElementById("agentDrawer");
const talkBtn = document.getElementById("talkBtn");
const closeDrawer = document.getElementById("closeDrawer");
const agentSearch = document.getElementById("agentSearch");
const dashboard = document.querySelector(".dashboard");

function openAgent(prefill=""){
  drawer.classList.add("open");
  const textarea = drawer.querySelector("textarea");
  if(prefill) textarea.value = prefill;
  setTimeout(()=>textarea.focus(),100);
}

function closeAgent(){ drawer.classList.remove("open"); }

function focusWindow(selector){
  const panel = document.querySelector(selector);
  if(!panel) return;
  document.querySelectorAll(".panel.focused").forEach((p)=>p.classList.remove("focused"));
  panel.classList.add("focused");
  panel.scrollIntoView({behavior:"smooth",block:"center"});
  window.setTimeout(()=>panel.classList.remove("focused"),1800);
}

function expandWindow(panel){
  if(!panel) return;
  const alreadyExpanded = panel.classList.contains("expanded");
  document.querySelectorAll(".panel.expanded").forEach((p)=>p.classList.remove("expanded"));
  document.body.classList.toggle("window-open", !alreadyExpanded);
  if(!alreadyExpanded){
    panel.classList.add("expanded");
    panel.scrollTop = 0;
  }
}

function installWindowControls(){
  document.querySelectorAll(".panel:not(.agent-hero)").forEach((panel)=>{
    const head = panel.querySelector(":scope > .panel-head");
    if(!head || head.querySelector(".window-controls")) return;
    const controls = document.createElement("div");
    controls.className = "window-controls";
    controls.innerHTML = '<button class="window-focus" title="Focus window">◎</button><button class="window-expand" title="Expand window">↗</button>';
    head.appendChild(controls);
    controls.querySelector(".window-focus").addEventListener("click",(event)=>{event.stopPropagation();focusWindow(`.${[...panel.classList].find((x)=>["email","calendar","market","activity","crm","social"].includes(x))}`)});
    controls.querySelector(".window-expand").addEventListener("click",(event)=>{event.stopPropagation();expandWindow(panel)});
  });
}

function addToast(message){
  let stack = document.querySelector(".toast-stack");
  if(!stack){stack=document.createElement("div");stack.className="toast-stack";document.body.appendChild(stack)}
  const toast=document.createElement("div");toast.className="toast";toast.textContent=message;stack.appendChild(toast);
  requestAnimationFrame(()=>toast.classList.add("show"));
  setTimeout(()=>{toast.classList.remove("show");setTimeout(()=>toast.remove(),250)},2200);
}

function installCardInteractions(){
  document.querySelectorAll(".mail-list article").forEach((item)=>item.addEventListener("click",()=>{
    item.classList.toggle("selected");
    const subject=item.querySelector("strong")?.textContent?.trim();
    addToast(subject?`Opened: ${subject}`:"Email opened");
  }));

  document.querySelectorAll(".kanban article").forEach((card)=>card.addEventListener("click",()=>{
    document.querySelectorAll(".kanban article.selected").forEach((x)=>x.classList.remove("selected"));
    card.classList.add("selected");
    const name=card.querySelector("b")?.textContent?.trim()||"CRM record";
    openAgent(`Open the full record for ${name}, summarize the latest activity, and recommend the next action.`);
  }));

  document.querySelectorAll(".event").forEach((eventCard)=>eventCard.addEventListener("click",()=>{
    document.querySelectorAll(".event.selected").forEach((x)=>x.classList.remove("selected"));
    eventCard.classList.add("selected");
    addToast(`Selected ${eventCard.querySelector("b")?.textContent?.trim()||"calendar event"}`);
  }));

  document.querySelector(".property-card")?.addEventListener("click",()=>openAgent("Open 1638 W Mohave St. Show the deal timeline, contract status, comps, outstanding tasks, and recommended next steps."));

  document.querySelectorAll(".agent-actions button").forEach((button)=>button.addEventListener("click",()=>{
    const prompts={
      "Find Opportunities":"Scan my market and pipeline for the best opportunities I should act on today.",
      "Draft Messages":"Draft the highest-priority messages I need to send today and queue them for approval.",
      "Analyze Market":"Analyze current Phoenix market conditions and surface anything that changes my strategy.",
      "Manage Follow Ups":"Review CRM, email, and calendar together and identify every follow-up that is due or at risk.",
      "Create Content":"Create today's social post based on my active deals, market activity, and content calendar.",
      "Optimize Schedule":"Review my calendar, open tasks, follow-ups, and priorities and propose an optimized schedule."
    };
    openAgent(prompts[button.textContent.trim()]||button.textContent.trim());
  }));
}

function runAgentDemo(){
  const textarea=drawer.querySelector("textarea");
  const request=textarea.value.trim();
  if(!request){textarea.focus();return}
  addToast("OpenRabbit analyzed the environment and prepared a draft action plan.");
  textarea.value="";
  closeAgent();
}

talkBtn?.addEventListener("click",()=>openAgent());
closeDrawer?.addEventListener("click",closeAgent);
agentSearch?.addEventListener("keydown",(event)=>{
  if(event.key === "Enter"){
    openAgent(event.currentTarget.value.trim());
    event.currentTarget.value = "";
  }
});

drawer?.querySelector(".primary")?.addEventListener("click",runAgentDemo);

document.addEventListener("keydown",(event)=>{
  if((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k"){
    event.preventDefault();
    agentSearch?.focus();
  }
  if(event.key === "Escape"){
    if(document.querySelector(".panel.expanded")){
      document.querySelectorAll(".panel.expanded").forEach((p)=>p.classList.remove("expanded"));
      document.body.classList.remove("window-open");
    }else closeAgent();
  }
});

document.querySelectorAll(".nav").forEach((button)=>{
  button.addEventListener("click",()=>{
    document.querySelectorAll(".nav").forEach((item)=>item.classList.remove("active"));
    button.classList.add("active");
    const label = button.textContent.trim();
    const targetMap = {Calendar:".calendar",CRM:".crm",Email:".email",Social:".social",Market:".market"};
    if(label === "Home"){
      dashboard?.scrollIntoView({behavior:"smooth",block:"start"});
      return;
    }
    focusWindow(targetMap[label]);
  });
});

document.querySelectorAll(".tabs, .segmented").forEach((group)=>{
  group.querySelectorAll("button").forEach((button)=>button.addEventListener("click",()=>{
    group.querySelectorAll("button").forEach((item)=>item.classList.remove("active"));
    button.classList.add("active");
  }));
});

installWindowControls();
installCardInteractions();
