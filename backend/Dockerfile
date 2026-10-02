FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY admin ./admin
COPY catalog ./catalog

RUN mkdir -p /data/uploads /data/backups && chown -R node:node /app /data

USER node

ENV NODE_ENV=production
ENV PORT=8787
ENV DATA_DIR=/data

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/health >/dev/null || exit 1

CMD ["node", "src/server.js"]
