# Ragify worker — polls crawl_jobs on VM2
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install workspace deps (core + worker only)
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/worker/package.json apps/worker/

RUN npm ci --workspace=@ragify/worker --include-workspace-root

COPY packages/core packages/core
COPY apps/worker apps/worker

WORKDIR /app/apps/worker
ENV NODE_ENV=production

CMD ["npx", "tsx", "src/index.ts"]
