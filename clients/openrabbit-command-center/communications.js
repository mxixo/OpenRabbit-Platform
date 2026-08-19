"use strict";

const drawer=document.getElementById("communicationsDrawer");
const closeBtn=document.getElementById("communicationsClose");
const agentBtn=document.getElementById("communicationsAgentBtn");
const runBtn=document.getElementById("communicationsRun");
const toast=document.getElementById("communicationsToast");
const search=document.getElementById("conversationSearch");
const draft=document.getElementById("messageDraft");

const profiles={
  "Tanner Hertzog":{deal:"1638 W Mohave St",channel:"EMAIL",summary:"Contract execution is confirmed. No response is required immediately, but title and inspection milestones should be checked next.",health:"Strong",stage:"Under Contract"},
  "Melissa Sora-Saenz":{deal:"1638 W Mohave St",channel:"EMAIL",summary:"Title has the executed contract. A concise follow-up should confirm escrow opening, earnest money instructions, and the next title milestone.",health:"Strong",stage:"Under Contract"},
  "Olivia Grijalva":{deal:"1638 W Mohave St",channel:"SMS",summary:"Client is waiting for inspection timing. Once the inspection window is confirmed, send a simple availability update and next-step explanation.",health:"Strong",stage:"Under Contract"},
  "Paris Robbins":{deal:"Phoenix Multifamily Search",channel:"WHATSAPP",summary:"Investor follow-up is aging and should be prioritized. Send a concise update with the strongest current opportunity and confirm whether the buy box has changed.",health:"At risk",stage:"Active Search"},
  "Instagram Lead":{deal:"Buyer Lead",channel:"SOCIAL DM",summary:"New first-time-buyer lead is asking about down payment assistance. Respond quickly, qualify timeline and income, and offer a short buyer consultation.",health:"New",stage:"New Lead"}
};

function showToast(message){toast.textContent=message;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),2200)}
function openAgent(prefill=""){drawer.classList.add("open");const area=drawer.querySelector("textarea");if(prefill)area.value=prefill;setTimeout(()=>area.focus(),80)}
function closeAgent(){drawer.classList.remove("open")}

function selectConversation(card){
  document.querySelectorAll(".conversation").forEach(x=>x.classList.remove("selected"));card.classList.add("selected");
  const name=card.dataset.contact;const profile=profiles[name]||{};
  document.getElementById("threadContact").textContent=name;
  document.getElementById("threadChannel").textContent=profile.channel||card.dataset.channel.toUpperCase();
  document.getElementById("threadDeal").textContent=`Linked deal: ${profile.deal||card.dataset.deal||"—"}`;
  document.getElementById("aiSummary").textContent=profile.summary||"OpenRabbit has no summary yet.";
  document.getElementById("contextName").textContent=name;
  document.getElementById("contextDeal").textContent=profile.deal||"—";
  document.querySelector(".context-block p:nth-of-type(3)").textContent=`Relationship health: ${profile.health||"Unknown"}`;
  draft.value="";
  showToast(`Opened conversation with ${name}`);
}

document.querySelectorAll(".conversation").forEach(card=>card.addEventListener("click",()=>selectConversation(card)));

document.querySelectorAll(".channel").forEach(button=>button.addEventListener("click",()=>{
  document.querySelectorAll(".channel").forEach(x=>x.classList.remove("active"));button.classList.add("active");
  const channel=button.dataset.channel;const view=button.dataset.view;
  let visible=0;
  document.querySelectorAll(".conversation").forEach(card=>{
    let show=true;
    if(channel && channel!=="all") show=card.dataset.channel===channel;
    if(view==="at-risk") show=card.dataset.risk==="high";
    if(view==="deals") show=Boolean(card.dataset.deal);
    if(view==="needs-reply") show=["medium","high"].includes(card.dataset.risk);
    if(view==="approval") show=false;
    card.hidden=!show;if(show)visible++;
  });
  document.getElementById("inboxMeta").textContent=`${visible} conversation${visible===1?"":"s"}`;
}));

search?.addEventListener("input",()=>{
  const term=search.value.trim().toLowerCase();let visible=0;
  document.querySelectorAll(".conversation").forEach(card=>{const show=card.textContent.toLowerCase().includes(term);card.hidden=!show;if(show)visible++});
  document.getElementById("inboxMeta").textContent=`${visible} conversation${visible===1?"":"s"}`;
});

document.getElementById("summarizeBtn")?.addEventListener("click",()=>showToast("OpenRabbit refreshed the conversation summary and next-step risk."));
document.getElementById("nextActionBtn")?.addEventListener("click",()=>{
  const contact=document.getElementById("threadContact").textContent;
  openAgent(`Review the conversation with ${contact}, the linked CRM/deal context, and prepare the best next action. Do not send anything without approval.`);
});
document.getElementById("draftWithAiBtn")?.addEventListener("click",()=>{
  const contact=document.getElementById("threadContact").textContent;
  draft.value=`Hi ${contact.split(" ")[0]}, thanks for the update. I’m reviewing the next steps now and will follow up with the relevant timing/details shortly.`;
  showToast("OpenRabbit drafted a reply using conversation and deal context.");
});
document.getElementById("queueApprovalBtn")?.addEventListener("click",()=>{
  if(!draft.value.trim()){showToast("Draft a message before sending it to approval.");return}
  showToast("Message moved to the human approval queue. Nothing was sent.");
});
document.getElementById("composeBtn")?.addEventListener("click",()=>{draft.focus();draft.value="";showToast("New message composer ready.")});
document.getElementById("openRecordBtn")?.addEventListener("click",()=>{
  const deal=document.getElementById("contextDeal").textContent;
  if(deal.includes("1638 W Mohave")) window.location.href="./deal.html"; else showToast("CRM record handoff prepared for prototype.");
});
document.getElementById("dealWorkspaceBtn")?.addEventListener("click",()=>{
  const deal=document.getElementById("contextDeal").textContent;
  if(deal.includes("1638 W Mohave")) window.location.href="./deal.html"; else showToast("Linked deal workspace would open here.");
});
document.querySelectorAll(".approveDraft").forEach(button=>button.addEventListener("click",()=>openAgent(`Review this queued draft: ${button.parentElement.querySelector("b").textContent}. Show recipient, CRM/deal context, risks, and the exact message before I approve or reject it.`)));
agentBtn?.addEventListener("click",()=>openAgent("Review all communications, identify urgent replies, stale follow-ups, deal risks, and drafts that need my approval."));
closeBtn?.addEventListener("click",closeAgent);
runBtn?.addEventListener("click",()=>{showToast("OpenRabbit prepared a communications action plan. External sends remain approval-gated.");closeAgent()});
document.addEventListener("keydown",event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();openAgent()}if(event.key==="Escape")closeAgent()});
