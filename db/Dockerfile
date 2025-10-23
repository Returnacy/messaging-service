FROM node:20-alpine

WORKDIR /app

# Accept GitHub Packages token at build time to pull private scope packages
ARG GITHUB_PACKAGES_TOKEN
ENV GITHUB_PACKAGES_TOKEN=${GITHUB_PACKAGES_TOKEN}

# copy root package.json + lockfile + workspace packages
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY types ./types
COPY db ./db
COPY utils ./utils

# install everything from root (workspaces aware)
ENV CI=true
RUN apk add --no-cache ca-certificates openssl \
	&& printf '@returnacy:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}\nalways-auth=true\n' > .npmrc \
	&& corepack enable \
	&& (pnpm install --frozen-lockfile --reporter=append-only || pnpm install --no-frozen-lockfile --reporter=append-only)

# NOTE: No database connection or migrations are executed at build time.
# Prisma client generation happens via the prebuild script in package.json (prisma generate)
# Runtime variables like DATABASE_URL will be provided by the deployment platform (e.g. Railway).

WORKDIR /app/db
RUN pnpm run build