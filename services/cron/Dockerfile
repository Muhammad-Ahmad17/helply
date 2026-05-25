FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY services/cron/package.json services/cron/
RUN npm ci --workspace=@ragify/cron --include-workspace-root

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/core packages/core
COPY services/cron services/cron

ENV NODE_ENV=production
ENV PORT=3004
WORKDIR /app/services/cron
CMD ["npx", "tsx", "src/index.ts"]
