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
ENV CI=true \
    GITHUB_PACKAGES_TOKEN=${GITHUB_PACKAGES_TOKEN}
# Perform install with GitHub Packages auth (token is provided via build-arg in CI). The root .npmrc references the env var so the token itself is not baked into the file.
RUN corepack enable && \
	(pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile)

RUN pnpm --filter @messaging-service/db exec prisma generate || true
RUN pnpm --filter @messaging-service/db build && \
	pnpm --filter @messaging-service/dispatcher build

# Remove devDependencies (CI=true avoids TTY prompt)
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
COPY --from=build /app/dispatcher/package.json ./dispatcher/package.json
COPY --from=build /app/dispatcher/dist ./dispatcher/dist
COPY --from=build /app/db/package.json ./db/package.json
COPY --from=build /app/db/dist ./db/dist
COPY --from=build /app/utils/package.json ./utils/package.json
RUN if [ -d /app/utils/dist ]; then mkdir -p utils/dist && cp -r /app/utils/dist ./utils/; fi

USER node
CMD ["node", "dispatcher/dist/src/dispatcher.js"]