FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY services/webhooks/package.json services/webhooks/
RUN npm ci --workspace=@ragify/webhooks --include-workspace-root

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/core packages/core
COPY services/webhooks services/webhooks

ENV NODE_ENV=production
ENV PORT=3003
WORKDIR /app/services/webhooks
CMD ["npx", "tsx", "src/index.ts"]
