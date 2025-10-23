###############################################
# Build stage
###############################################
FROM node:20-alpine AS build
WORKDIR /app

# Copy manifests first for better layer caching (include lockfile)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY .npmrc .npmrc
COPY types/package.json types/package.json
COPY utils/package.json utils/package.json
COPY db/package.json db/package.json
COPY server/package.json server/package.json

# Copy sources (only needed workspaces)
COPY types ./types
COPY utils ./utils
COPY db ./db
COPY server ./server

ARG GITHUB_PACKAGES_TOKEN
ENV CI=true \
    GITHUB_PACKAGES_TOKEN=${GITHUB_PACKAGES_TOKEN}
RUN corepack enable && \
	(pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile)

# Prisma generate (if not done via lifecycle)
RUN pnpm --filter @messaging-service/db exec prisma generate || true

# Build packages needed at runtime (build order: types/utils -> db -> server)
RUN pnpm --filter @messaging-service/types build && \
	pnpm --filter @messaging-service/utils build || true && \
	pnpm --filter @messaging-service/db build && \
	pnpm --filter @messaging-service/server build

# Note: do not prune at the workspace root here. Pruning at root can drop workspace package dependencies
# (like fastify) that the server runtime needs. If image size becomes a concern, switch to `pnpm deploy`.

###############################################
# Runtime stage
###############################################
FROM node:20-alpine
ENV NODE_ENV=production \
	NODE_OPTIONS="--max_old_space_size=512"
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/tsconfig.base.json ./
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
# Include package-level node_modules for proper pnpm workspace resolution
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/db/package.json ./db/package.json
COPY --from=build /app/db/dist ./db/dist
COPY --from=build /app/db/node_modules ./db/node_modules
COPY --from=build /app/utils/package.json ./utils/package.json
COPY --from=build /app/utils/dist ./utils/dist
COPY --from=build /app/utils/node_modules ./utils/node_modules

# Include types workspace package for runtime imports
COPY --from=build /app/types/package.json ./types/package.json
COPY --from=build /app/types/dist ./types/dist
COPY --from=build /app/types/node_modules ./types/node_modules

USER node
CMD ["node", "server/dist/src/app.js"]