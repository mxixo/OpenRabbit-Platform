"use strict";

const drawer = document.getElementById("marketAgentDrawer");
const closeDrawer = document.getElementById("marketCloseDrawer");
const runAgent = document.getElementById("marketRunAgent");
const textarea = drawer?.querySelector("textarea");
const popover = document.getElementById("propertyPopover");

const propertyData = {
  "Royal Palm Inn": {score:91,title:"Royal Palm Inn",subtitle:"2510 W Palo Verde Dr · Phoenix, AZ",ask:"$1.6M",fit:"High",matches:"3",prompt:"Analyze Royal Palm Inn with comps, redevelopment upside, contamination risk, zoning, investor fit, and negotiation strategy."},
  "1638 W Mohave St": {score:84,title:"1638 W Mohave St",subtitle:"Phoenix, AZ 85007",ask:"$315K",fit:"Execution",matches:"1",prompt:"Review 1638 W Mohave St for closing execution, outstanding tasks, transaction risk, and next actions."},
  "Westminster St": {score:78,title:"Westminster St",subtitle:"Phoenix, AZ",ask:"$330K",fit:"Offer",matches:"2",prompt:"Review Westminster St, current offer position, buyer fit, and recommended negotiation next step."},
  "Phoenix 4-Plex": {score:88,title:"Phoenix 4-Plex",subtitle:"Central Phoenix",ask:"TBD",fit:"High",matches:"4",prompt:"Analyze the Phoenix 4-plex against investor criteria, estimate offer range, and identify due diligence priorities."}
};

function openAgent(prompt=""){
  drawer?.classList.add("open");
  if(textarea){ textarea.value = prompt; setTimeout(()=>textarea.focus(),80); }
}
function closeAgent(){ drawer?.classList.remove("open"); }
function openRecord(name){
  if(name === "1638 W Mohave St") window.location.href = "./deal.html";
  else openAgent(`Open the full CRM/property record for ${name}, attach all known context, and recommend the next action.`);
}
function renderProperty(name, anchor){
  const data = propertyData[name];
  if(!data || !popover) return;
  popover.innerHTML = `<span class="score">Opportunity Score ${data.score}</span><h3>${data.title}</h3><p>${data.subtitle}</p><div class="pop-grid"><b>${data.ask}</b><span>Current ask</span><b>${data.fit}</b><span>Strategic fit</span><b>${data.matches}</b><span>Investor matches</span></div><div class="pop-actions"><button id="openDealBtn">Open Record</button><button id="analyzePropertyBtn">Analyze</button></div>`;
  if(anchor?.offsetParent){
    const x = Math.min(anchor.offsetLeft + 54, anchor.parentElement.clientWidth - 280);
    const y = Math.max(40, anchor.offsetTop - 25);
    popover.style.left = `${x}px`; popover.style.top = `${y}px`;
  } else { popover.style.left="18px"; popover.style.top="72px"; }
  popover.style.display="block";
  document.getElementById("analyzePropertyBtn")?.addEventListener("click",()=>openAgent(data.prompt));
  document.getElementById("openDealBtn")?.addEventListener("click",()=>openRecord(name));
}

document.querySelectorAll(".pin").forEach((pin)=>pin.addEventListener("click",()=>{
  document.querySelectorAll(".pin.selected").forEach((x)=>x.classList.remove("selected"));
  pin.classList.add("selected"); renderProperty(pin.dataset.property, pin);
}));
window.addEventListener("openrabbit:market-property",event=>renderProperty(event.detail?.name));
document.querySelectorAll("[data-prompt]").forEach((button)=>button.addEventListener("click",()=>openAgent(button.dataset.prompt)));
document.getElementById("marketAgentBtn")?.addEventListener("click",()=>openAgent("Review the entire market workspace and tell me the three highest-priority actions I should take next."));
closeDrawer?.addEventListener("click",closeAgent);
runAgent?.addEventListener("click",()=>{if(!textarea?.value.trim()) return textarea?.focus();const original=runAgent.textContent;runAgent.textContent="Prepared ✓";setTimeout(()=>{runAgent.textContent=original;closeAgent();},900)});
document.querySelectorAll(".saved-search").forEach((item)=>item.addEventListener("click",()=>{document.querySelectorAll(".saved-search").forEach((x)=>x.classList.remove("active"));item.classList.add("active")}));
document.querySelectorAll(".tabs, .map-tools").forEach((group)=>group.querySelectorAll("button").forEach((button)=>button.addEventListener("click",()=>{group.querySelectorAll("button").forEach((x)=>x.classList.remove("active"));button.classList.add("active")})));
document.addEventListener("keydown",(event)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();openAgent()}if(event.key==="Escape")closeAgent()});
const defaultPin=document.querySelector('.pin[data-property="Royal Palm Inn"]');if(defaultPin)renderProperty("Royal Palm Inn",defaultPin);
