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
ARG FORCE_REINSTALL=0
ENV CI=true \
    GITHUB_PACKAGES_TOKEN=${GITHUB_PACKAGES_TOKEN} \
    FORCE_REINSTALL=${FORCE_REINSTALL}
RUN corepack enable && \
	echo "Force key: $FORCE_REINSTALL" && \
	(pnpm install -r --frozen-lockfile || pnpm install -r --no-frozen-lockfile)

RUN pnpm --filter @messaging-service/db exec prisma generate || true
RUN pnpm --filter @messaging-service/types build && \
	pnpm --filter @messaging-service/utils build || true && \
	pnpm --filter @messaging-service/db build && \
	pnpm --filter @messaging-service/scheduler build

# Keeping full node_modules (including dev deps) to avoid pruning workspace links needed at runtime.

###############################################
# Runtime stage
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
COPY --from=build /app/types/node_modules ./types/node_modules
RUN if [ -d /app/types/dist ]; then mkdir -p types/dist && cp -r /app/types/dist ./types/; fi
COPY --from=build /app/utils/package.json ./utils/package.json
RUN if [ -d /app/utils/node_modules ]; then mkdir -p utils/node_modules && cp -r /app/utils/node_modules/* ./utils/node_modules/; fi
RUN if [ -d /app/utils/dist ]; then mkdir -p utils/dist && cp -r /app/utils/dist ./utils/; fi

USER node
CMD ["node", "scheduler/dist/src/scheduler.js"]