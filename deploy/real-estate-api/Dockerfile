FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY capabilities ./capabilities
COPY scripts/start-real-estate-api.js ./scripts/start-real-estate-api.js

ENV NODE_ENV=production
EXPOSE 3000
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.OPENRABBIT_API_PORT||3000)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "scripts/start-real-estate-api.js"]
