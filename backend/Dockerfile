# Same entry point PM2 already runs in production
# (deploy/ecosystem.production.config.cjs: src/server.js) on the same Node
# major version as production (v22).
FROM node:22-alpine

WORKDIR /app

# Dependencies in their own layer so this only re-runs when package.json changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App code only. No .env (secrets come from the environment at run time, never
# baked into the image) and no uploads/ (that's a mounted volume — see
# docker-compose.yml — so existing files are never copied into or lost with the image).
COPY src ./src

EXPOSE 5001

CMD ["node", "src/server.js"]
