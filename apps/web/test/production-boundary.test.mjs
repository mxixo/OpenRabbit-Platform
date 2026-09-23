import assert from 'node:assert/strict';
import test from 'node:test';

import {verifyProductionSupabaseBuildEnv} from '../production-boundary.mjs';

const PROJECT_REF='abcdefghijklmnopqrst';
const PROJECT_URL=`https://${PROJECT_REF}.supabase.co`;
const KEY='publishable-key';

test('allows an intentionally unconfigured marketing-only build',()=>{
  assert.deepEqual(verifyProductionSupabaseBuildEnv({}),{configured:false});
});

test('accepts a complete canonical designated project boundary',()=>{
  assert.deepEqual(
    verifyProductionSupabaseBuildEnv({
      VITE_SUPABASE_PROJECT_REF:PROJECT_REF,
      VITE_SUPABASE_URL:PROJECT_URL,
      VITE_SUPABASE_ANON_KEY:KEY,
    }),
    {configured:true,projectRef:PROJECT_REF,projectUrl:PROJECT_URL}
  );
});

test('rejects partial account configuration',()=>{
  assert.throws(
    ()=>verifyProductionSupabaseBuildEnv({
      VITE_SUPABASE_URL:PROJECT_URL,
      VITE_SUPABASE_ANON_KEY:KEY,
    }),
    /must include VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_SUPABASE_PROJECT_REF together/
  );
});

test('rejects project substitution',()=>{
  assert.throws(
    ()=>verifyProductionSupabaseBuildEnv({
      VITE_SUPABASE_PROJECT_REF:PROJECT_REF,
      VITE_SUPABASE_URL:'https://zzzzzzzzzzzzzzzzzzzz.supabase.co',
      VITE_SUPABASE_ANON_KEY:KEY,
    }),
    /does not match/
  );
});

test('rejects noncanonical origins',()=>{
  for(const url of [
    `http://${PROJECT_REF}.supabase.co`,
    `${PROJECT_URL}/rest/v1`,
    `${PROJECT_URL}?redirect=1`,
    `${PROJECT_URL}#fragment`,
  ]){
    assert.throws(
      ()=>verifyProductionSupabaseBuildEnv({
        VITE_SUPABASE_PROJECT_REF:PROJECT_REF,
        VITE_SUPABASE_URL:url,
        VITE_SUPABASE_ANON_KEY:KEY,
      })
    );
  }
});
