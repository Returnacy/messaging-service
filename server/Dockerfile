FROM node:current-alpine3.22 AS builder
WORKDIR /app

# Copy root files for monorepo context
COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY types ./types
COPY db ./db
COPY utils ./utils
COPY server ./server

RUN corepack enable && pnpm install --no-frozen-lockfile
RUN pnpm run -r build