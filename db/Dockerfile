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

# NOTE: No database connection or migrations are executed at build time.
# Prisma client generation happens via the prebuild script in package.json (prisma generate)
# Runtime variables like DATABASE_URL will be provided by the deployment platform (e.g. Railway).

WORKDIR /app/db
RUN pnpm run build