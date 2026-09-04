"use strict";

class MailScanScheduler {
  constructor({workflow,orgId,actorId="openrabbit-mail-worker",query="is:unread",limit=25,intervalMs=5*60*1000,onResult=()=>{},onError=()=>{},setIntervalImpl=setInterval,clearIntervalImpl=clearInterval}={}){
    if(!workflow?.scanMail)throw new Error("workflow.scanMail is required");if(!orgId)throw new Error("orgId is required");if(!Number.isFinite(intervalMs)||intervalMs<60000)throw new Error("intervalMs must be at least 60000");
    this.workflow=workflow;this.orgId=orgId;this.actorId=actorId;this.query=query;this.limit=limit;this.intervalMs=intervalMs;this.onResult=onResult;this.onError=onError;this.setIntervalImpl=setIntervalImpl;this.clearIntervalImpl=clearIntervalImpl;this.timer=null;this.running=false;
  }
  async tick(){if(this.running)return {skipped:true,reason:"scan_in_progress"};this.running=true;try{const proposals=await this.workflow.scanMail({orgId:this.orgId,actorId:this.actorId,query:this.query,limit:this.limit});const result={skipped:false,count:proposals.length,proposals};await this.onResult(result);return result;}catch(error){await this.onError(error);throw error;}finally{this.running=false;}}
  start({runImmediately=true}={}){if(this.timer)return this;if(runImmediately)this.tick().catch(()=>{});this.timer=this.setIntervalImpl(()=>this.tick().catch(()=>{}),this.intervalMs);return this;}
  stop(){if(this.timer){this.clearIntervalImpl(this.timer);this.timer=null;}return this;}
  get started(){return Boolean(this.timer);}
}

module.exports={MailScanScheduler};
