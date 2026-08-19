"use strict";

function required(value,name){if(typeof value!=="string"||!value.trim())throw new Error(`${name} is required`);return value.trim();}

const MEETING_SCHEMA={
  type:'object',additionalProperties:false,required:['candidates'],properties:{candidates:{type:'array',items:{type:'object',additionalProperties:false,required:['isMeeting','confidence','evidence','event'],properties:{isMeeting:{type:'boolean'},confidence:{type:'number',minimum:0,maximum:1},evidence:{type:'array',items:{type:'string'}},event:{type:'object',additionalProperties:false,required:['title','start','end','timeZone','location','description','attendees'],properties:{title:{type:'string'},start:{type:'string'},end:{type:'string'},timeZone:{type:'string'},location:{type:'string'},description:{type:'string'},attendees:{type:'array',items:{type:'string'}}}}}}}}
};

function extractOutputText(payload){
  if(typeof payload?.output_text==='string')return payload.output_text;
  for(const item of payload?.output||[])for(const part of item?.content||[])if(part?.type==='output_text'&&typeof part.text==='string')return part.text;
  throw new Error('OpenAI response did not contain output text');
}

function createOpenAiMeetingExtractor({apiKey,model='gpt-5.6-luna',fetchImpl=globalThis.fetch,timeZone='America/Phoenix'}={}){
  const key=required(apiKey,'apiKey');if(typeof fetchImpl!=="function")throw new Error('fetch implementation is required');
  return async function extract(message={}){
    const instructions='Identify only concrete meeting or appointment requests with enough evidence to place on a calendar. Do not invent dates, times, attendees, or locations. If ambiguous, return isMeeting false. Preserve source evidence snippets. Use ISO 8601 timestamps when a meeting is concrete.';
    const input=`Default timezone: ${timeZone}\nFrom: ${message.from||''}\nSubject: ${message.subject||''}\nReceived: ${message.receivedAt||''}\nBody:\n${message.body||''}`;
    const response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:[{role:'system',content:instructions},{role:'user',content:input}],text:{format:{type:'json_schema',name:'meeting_candidates',strict:true,schema:MEETING_SCHEMA}}})});
    const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload?.error?.message||`OpenAI meeting extraction failed (${response.status})`);
    const parsed=JSON.parse(extractOutputText(payload));return parsed.candidates||[];
  };
}

module.exports={MEETING_SCHEMA,extractOutputText,createOpenAiMeetingExtractor};
