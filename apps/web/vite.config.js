import {fileURLToPath,URL} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins:[react()],
  resolve:{
    alias:{
      '@openrabbit/runtime-core':fileURLToPath(new URL('../../packages/runtime-core/src/index.ts',import.meta.url)),
    },
  },
});
