FROM node:current-alpine3.22

WORKDIR /app

# copy root package.json + lockfile + workspace packages
COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY types ./types
COPY db ./db
COPY utils ./utils

# install everything from root (workspaces aware)
RUN corepack enable && pnpm install --no-frozen-lockfile

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

WORKDIR /app/db
RUN pnpm run build