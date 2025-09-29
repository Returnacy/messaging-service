###############################################
# Build stage
###############################################
FROM node:20-alpine AS build
WORKDIR /app

# Copy manifests first for better layer caching (include lockfile)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY types/package.json types/package.json
COPY utils/package.json utils/package.json
COPY db/package.json db/package.json
COPY server/package.json server/package.json

# Copy sources (only needed workspaces)
COPY types ./types
COPY utils ./utils
COPY db ./db
COPY server ./server

ENV CI=true
RUN corepack enable && \
	(pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile)

# Prisma generate (if not done via lifecycle)
RUN pnpm --filter @messaging-service/db exec prisma generate || true

# Build db & server
RUN pnpm --filter @messaging-service/db build && \
	pnpm --filter @messaging-service/server build

# Remove devDependencies
RUN pnpm prune --prod || pnpm install --prod --no-optional --frozen-lockfile

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
COPY --from=build /app/db/package.json ./db/package.json
COPY --from=build /app/db/dist ./db/dist
COPY --from=build /app/utils/package.json ./utils/package.json
# utils may or may not have a build output; copy if present
RUN if [ -d /app/utils/dist ]; then mkdir -p utils/dist && cp -r /app/utils/dist ./utils/; fi

USER node
CMD ["node", "server/dist/src/app.js"]