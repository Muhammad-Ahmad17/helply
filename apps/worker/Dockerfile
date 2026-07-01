FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
RUN npm ci -w @ragify/worker -w @ragify/core --include-workspace-root --omit=dev
COPY packages/core packages/core
COPY apps/worker apps/worker
WORKDIR /app/apps/worker
ENV NODE_ENV=production
CMD ["npm", "start"]
