FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY services/worker/package.json services/worker/
RUN npm ci --workspace=@ragify/worker --include-workspace-root

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/core packages/core
COPY services/worker services/worker

ENV NODE_ENV=production
WORKDIR /app/services/worker
CMD ["npx", "tsx", "src/index.ts"]
