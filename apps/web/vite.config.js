import {fileURLToPath,URL} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins:[react()],
  resolve:{
    alias:{
      '@openrabbit/runtime-core/adaptive-onboarding':fileURLToPath(new URL('../../packages/runtime-core/src/core/adaptive-onboarding.ts',import.meta.url)),
    },
  },
});
