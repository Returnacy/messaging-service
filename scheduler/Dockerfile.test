FROM node:current-alpine3.22 AS builder
WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY types ./types
COPY db ./db
COPY utils ./utils
COPY scheduler ./scheduler

RUN corepack enable && pnpm install --no-frozen-lockfile
RUN pnpm run -r build