"use strict";

const drawer=document.getElementById("communicationsDrawer");
const closeBtn=document.getElementById("communicationsClose");
const agentBtn=document.getElementById("communicationsAgentBtn");
const runBtn=document.getElementById("communicationsRun");
const toast=document.getElementById("communicationsToast");
const search=document.getElementById("conversationSearch");
const draft=document.getElementById("messageDraft");
const conversationItems=document.getElementById("conversationItems");

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
function initials(value){return String(value||"?").replace(/<.*?>/g,"").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"?"}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
function friendlyDate(value){const d=new Date(value);if(Number.isNaN(d.getTime()))return value||"";return d.toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}

function selectConversation(card){
  document.querySelectorAll(".conversation").forEach(x=>x.classList.remove("selected"));card.classList.add("selected");
  const name=card.dataset.contact;const profile=profiles[name]||{};const live=card.dataset.live==="gmail";
  document.getElementById("threadContact").textContent=name;
  document.getElementById("threadChannel").textContent=profile.channel||card.dataset.channel.toUpperCase();
  document.getElementById("threadDeal").textContent=live?"Live Gmail conversation · CRM match pending":`Linked deal: ${profile.deal||card.dataset.deal||"—"}`;
  document.getElementById("aiSummary").textContent=profile.summary||(live?`Live Gmail message loaded. OpenRabbit can summarize the message, search for CRM/deal matches, and recommend the next action once the agent gateway is connected.`:"OpenRabbit has no summary yet.");
  document.getElementById("contextName").textContent=name;
  document.getElementById("contextDeal").textContent=profile.deal||(live?"CRM match pending":"—");
  const health=document.querySelector(".context-block p:nth-of-type(3)");if(health)health.textContent=`Relationship health: ${profile.health||(live?"Not scored":"Unknown")}`;
  const subject=card.querySelector("strong")?.textContent||"Message";const snippet=card.querySelector("p")?.textContent||"";
  if(live) document.getElementById("threadMessages").innerHTML=`<div class="message incoming"><small>${escapeHtml(card.dataset.date||"")}</small><p><b>${escapeHtml(subject)}</b><br>${escapeHtml(snippet)}</p></div>`;
  draft.value="";showToast(`Opened conversation with ${name}`);
}

function bindConversationCards(){document.querySelectorAll(".conversation").forEach(card=>card.onclick=()=>selectConversation(card))}

function installGmailControl(){
  const actions=document.querySelector(".communications-actions");if(!actions||document.getElementById("gmailConnectionBtn"))return;
  const button=document.createElement("button");button.id="gmailConnectionBtn";button.textContent="Checking Gmail…";button.disabled=true;actions.prepend(button);
}

async function loadGmail(){
  installGmailControl();const button=document.getElementById("gmailConnectionBtn");
  try{
    const statusRes=await fetch("/api/integrations/gmail/status");if(!statusRes.ok)throw new Error("Integration server unavailable");const status=await statusRes.json();
    if(!status.connected){button.disabled=false;button.textContent="Connect Gmail";button.onclick=()=>{window.location.href="/api/integrations/gmail/connect?redirectTo=/communications.html"};return}
    button.disabled=true;button.textContent=`Gmail · ${status.accountId}`;
    const inboxRes=await fetch("/api/integrations/gmail/inbox?limit=12");if(!inboxRes.ok)throw new Error("Unable to load Gmail inbox");const inbox=await inboxRes.json();
    const mockNonEmail=[...conversationItems.querySelectorAll('.conversation:not([data-channel="email"])')].map(x=>x.outerHTML).join("");
    const liveEmail=(inbox.messages||[]).map(message=>`<article class="conversation" data-channel="email" data-contact="${escapeHtml(message.from)}" data-deal="" data-risk="low" data-live="gmail" data-message-id="${escapeHtml(message.id)}" data-date="${escapeHtml(message.date)}"><div class="avatar">${escapeHtml(initials(message.from))}</div><div class="conversation-copy"><div class="conversation-row"><b>${escapeHtml(message.from)}</b><span>${escapeHtml(friendlyDate(message.date))}</span></div><strong>${escapeHtml(message.subject)}</strong><p>${escapeHtml(message.snippet)}</p><div class="chips"><span>Gmail · Live</span></div></div></article>`).join("");
    conversationItems.innerHTML=liveEmail+mockNonEmail;bindConversationCards();
    document.getElementById("inboxMeta").textContent=`${(inbox.messages||[]).length} live Gmail messages + other channels`;
    const first=conversationItems.querySelector(".conversation");if(first)selectConversation(first);
    showToast(`Live Gmail connected: ${status.accountId}`);
  }catch(error){
    button.disabled=false;button.textContent="Connect Gmail";button.onclick=()=>{window.location.href="/api/integrations/gmail/connect?redirectTo=/communications.html"};
    console.warn("Gmail live mode unavailable; retaining prototype data.",error);
  }
}

bindConversationCards();

document.querySelectorAll(".channel").forEach(button=>button.addEventListener("click",()=>{
  document.querySelectorAll(".channel").forEach(x=>x.classList.remove("active"));button.classList.add("active");
  const channel=button.dataset.channel;const view=button.dataset.view;let visible=0;
  document.querySelectorAll(".conversation").forEach(card=>{let show=true;if(channel&&channel!=="all")show=card.dataset.channel===channel;if(view==="at-risk")show=card.dataset.risk==="high";if(view==="deals")show=Boolean(card.dataset.deal);if(view==="needs-reply")show=["medium","high"].includes(card.dataset.risk);if(view==="approval")show=false;card.hidden=!show;if(show)visible++});
  document.getElementById("inboxMeta").textContent=`${visible} conversation${visible===1?"":"s"}`;
}));
search?.addEventListener("input",()=>{const term=search.value.trim().toLowerCase();let visible=0;document.querySelectorAll(".conversation").forEach(card=>{const show=card.textContent.toLowerCase().includes(term);card.hidden=!show;if(show)visible++});document.getElementById("inboxMeta").textContent=`${visible} conversation${visible===1?"":"s"}`});
document.getElementById("summarizeBtn")?.addEventListener("click",()=>showToast("OpenRabbit refreshed the conversation summary and next-step risk."));
document.getElementById("nextActionBtn")?.addEventListener("click",()=>{const contact=document.getElementById("threadContact").textContent;openAgent(`Review the conversation with ${contact}, the linked CRM/deal context, and prepare the best next action. Do not send anything without approval.`)});
document.getElementById("draftWithAiBtn")?.addEventListener("click",()=>{const contact=document.getElementById("threadContact").textContent;draft.value=`Hi ${contact.split(" ")[0]}, thanks for the update. I’m reviewing the next steps now and will follow up with the relevant timing/details shortly.`;showToast("OpenRabbit drafted a reply using conversation and deal context.")});
document.getElementById("queueApprovalBtn")?.addEventListener("click",()=>{if(!draft.value.trim()){showToast("Draft a message before sending it to approval.");return}showToast("Message moved to the human approval queue. Nothing was sent.")});
document.getElementById("composeBtn")?.addEventListener("click",()=>{draft.focus();draft.value="";showToast("New message composer ready.")});
document.getElementById("openRecordBtn")?.addEventListener("click",()=>{const deal=document.getElementById("contextDeal").textContent;if(deal.includes("1638 W Mohave"))window.location.href="./deal.html";else showToast("CRM record handoff prepared for prototype.")});
document.getElementById("dealWorkspaceBtn")?.addEventListener("click",()=>{const deal=document.getElementById("contextDeal").textContent;if(deal.includes("1638 W Mohave"))window.location.href="./deal.html";else showToast("Linked deal workspace would open here.")});
document.querySelectorAll(".approveDraft").forEach(button=>button.addEventListener("click",()=>openAgent(`Review this queued draft: ${button.parentElement.querySelector("b").textContent}. Show recipient, CRM/deal context, risks, and the exact message before I approve or reject it.`)));
agentBtn?.addEventListener("click",()=>openAgent("Review all communications, identify urgent replies, stale follow-ups, deal risks, and drafts that need my approval."));closeBtn?.addEventListener("click",closeAgent);runBtn?.addEventListener("click",()=>{showToast("OpenRabbit prepared a communications action plan. External sends remain approval-gated.");closeAgent()});document.addEventListener("keydown",event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();openAgent()}if(event.key==="Escape")closeAgent()});

loadGmail();
