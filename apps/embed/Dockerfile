FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
COPY apps/embed/package.json apps/embed/
RUN npm ci -w @ragify/embed --include-workspace-root --omit=dev
COPY apps/embed apps/embed
WORKDIR /app/apps/embed
ENV NODE_ENV=production
ENV TRANSFORMERS_CACHE=/cache
RUN mkdir -p /cache
EXPOSE 8080
CMD ["npx", "tsx", "src/index.ts"]
