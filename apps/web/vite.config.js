import {fileURLToPath,URL} from 'node:url';
import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import {verifyProductionSupabaseBuildEnv} from './production-boundary.mjs';

export default defineConfig(({command,mode})=>{
  if(command==='build'&&mode==='production'){
    verifyProductionSupabaseBuildEnv(loadEnv(mode,process.cwd(),''));
  }
  return {
    plugins:[react()],
    resolve:{
      alias:{
        '@openrabbit/runtime-core/adaptive-onboarding':fileURLToPath(new URL('../../packages/runtime-core/src/core/adaptive-onboarding.ts',import.meta.url)),
      },
    },
  };
});
