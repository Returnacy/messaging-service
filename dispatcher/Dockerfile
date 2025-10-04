###############################################
# Build stage
###############################################
FROM node:20-alpine AS build
WORKDIR /app

# Copy manifests early for caching (include lockfile once committed)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY .npmrc .npmrc
COPY types/package.json types/package.json
COPY utils/package.json utils/package.json
COPY db/package.json db/package.json
COPY dispatcher/package.json dispatcher/package.json

COPY types ./types
COPY utils ./utils
COPY db ./db
COPY dispatcher ./dispatcher

ARG GITHUB_PACKAGES_TOKEN
ARG FORCE_REINSTALL=0
ENV CI=true \
    GITHUB_PACKAGES_TOKEN=${GITHUB_PACKAGES_TOKEN} \
    FORCE_REINSTALL=${FORCE_REINSTALL}
# Perform recursive install (workspace) – FORCE_REINSTALL can be bumped to bust cache
RUN corepack enable && \
	echo "Force key: $FORCE_REINSTALL" && \
	(pnpm install -r --frozen-lockfile || pnpm install -r --no-frozen-lockfile)

RUN pnpm --filter @messaging-service/db exec prisma generate || true
RUN pnpm --filter @messaging-service/types build && \
	pnpm --filter @messaging-service/db build && \
	pnpm --filter @messaging-service/dispatcher build

# Remove devDependencies (CI=true avoids TTY prompt)
# Install only production dependencies (avoid prune to prevent accidental removal of required packages like dotenv)
# Keeping full node_modules (including dev deps) to avoid pruning workspace links needed at runtime.
# TODO: later optimize by using `pnpm deploy --filter @messaging-service/dispatcher --prod`.

###############################################
# Runtime stage
###############################################
FROM node:20-alpine
ENV NODE_ENV=production \
	NODE_OPTIONS="--max_old_space_size=512"
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/tsconfig.base.json ./
COPY --from=build /app/dispatcher/package.json ./dispatcher/package.json
COPY --from=build /app/dispatcher/dist ./dispatcher/dist
COPY --from=build /app/dispatcher/node_modules ./dispatcher/node_modules
COPY --from=build /app/db/package.json ./db/package.json
COPY --from=build /app/db/dist ./db/dist
COPY --from=build /app/db/node_modules ./db/node_modules
COPY --from=build /app/types/package.json ./types/package.json
COPY --from=build /app/types/dist ./types/dist
COPY --from=build /app/types/node_modules ./types/node_modules
# (dotenv optional at runtime; we rely on env vars from the orchestrator)

USER node
CMD ["node", "dispatcher/dist/src/dispatcher.js"]