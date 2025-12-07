###############################################
# Build stage
###############################################
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY .npmrc .npmrc
COPY types/package.json types/package.json
COPY utils/package.json utils/package.json
COPY db/package.json db/package.json
COPY scheduler/package.json scheduler/package.json

COPY types ./types
COPY utils ./utils
COPY db ./db
COPY scheduler ./scheduler

ARG GITHUB_PACKAGES_TOKEN
ENV CI=true \
    GITHUB_PACKAGES_TOKEN=${GITHUB_PACKAGES_TOKEN}
RUN corepack enable && \
	(pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile)

RUN pnpm --filter @messaging-service/db exec prisma generate
RUN pnpm --filter @messaging-service/db build && \
	pnpm --filter @messaging-service/scheduler build

###############################################
# Runtime stage - Minimal with bundled code
###############################################
FROM node:20-alpine
ENV NODE_ENV=production \
	NODE_OPTIONS="--max_old_space_size=512"
WORKDIR /app

# Copy workspace config for proper module resolution
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/tsconfig.base.json ./

# Copy node_modules with Prisma client (from pnpm workspace)
COPY --from=build /app/node_modules ./node_modules

# Copy db package structure for Prisma client resolution
COPY --from=build /app/db/package.json ./db/package.json
COPY --from=build /app/db/node_modules ./db/node_modules

# Copy the bundled scheduler
COPY --from=build /app/scheduler/dist/scheduler.bundle.js ./scheduler.bundle.js
COPY --from=build /app/scheduler/dist/scheduler.bundle.js.map ./scheduler.bundle.js.map

USER node

# Default to run-once mode for Railway cron jobs
ENV SCHEDULER_RUN_ONCE=true

# Run the bundled scheduler - single file, no module resolution issues
CMD ["node", "scheduler.bundle.js"]
