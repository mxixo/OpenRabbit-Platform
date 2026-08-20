FROM node:22-alpine
WORKDIR /app
COPY services/connection-gateway ./services/connection-gateway
ENV NODE_ENV=production
ENV OPENRABBIT_CONNECTION_GATEWAY_HOST=0.0.0.0
ENV OPENRABBIT_CONNECTION_GATEWAY_PORT=8790
EXPOSE 8790
CMD ["node", "services/connection-gateway/server.js"]
