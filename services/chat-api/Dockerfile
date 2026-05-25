# Ragify chat-api service
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY services/chat-api/package.json services/chat-api/
RUN npm ci --workspace=@ragify/chat-api --include-workspace-root

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/core packages/core
COPY services/chat-api services/chat-api

ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app/services/chat-api
CMD ["npx", "tsx", "src/index.ts"]
