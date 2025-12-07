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
# Runtime stage - Same as dispatcher
###############################################
FROM node:20-alpine
ENV NODE_ENV=production \
	NODE_OPTIONS="--max_old_space_size=512"
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/tsconfig.base.json ./
COPY --from=build /app/scheduler/package.json ./scheduler/package.json
COPY --from=build /app/scheduler/dist ./scheduler/dist
COPY --from=build /app/scheduler/node_modules ./scheduler/node_modules
COPY --from=build /app/db/package.json ./db/package.json
COPY --from=build /app/db/dist ./db/dist
COPY --from=build /app/db/node_modules ./db/node_modules
COPY --from=build /app/types/package.json ./types/package.json
COPY --from=build /app/types/dist ./types/dist
COPY --from=build /app/types/node_modules ./types/node_modules

USER node

# Default to run-once mode for Railway cron jobs
ENV SCHEDULER_RUN_ONCE=true

CMD ["node", "scheduler/dist/src/scheduler.js"]
