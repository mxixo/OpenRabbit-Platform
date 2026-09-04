FROM node:22-alpine
WORKDIR /app
COPY services/connection-gateway ./services/connection-gateway
RUN chmod +x services/connection-gateway/entrypoint.sh
ENV NODE_ENV=production
ENV OPENRABBIT_CONNECTION_GATEWAY_HOST=0.0.0.0
ENV OPENRABBIT_CONNECTION_GATEWAY_PORT=8790
ENV OPENRABBIT_GATEWAY_DATA_DIR=/data
EXPOSE 8790
ENTRYPOINT ["services/connection-gateway/entrypoint.sh"]
