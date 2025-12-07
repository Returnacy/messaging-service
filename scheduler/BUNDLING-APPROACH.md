# Scheduler Bundling Approach

## Problem Solved

The previous workspace-based scheduler had module resolution issues in Docker because pnpm workspace symlinks don't transfer correctly to runtime containers. This caused "Cannot find package 'node-cron'" errors.

## Solution

**Bundle all dependencies into a single JavaScript file** using esbuild during the build process. This eliminates module resolution issues while keeping the workspace structure.

## How It Works

### Build Process

1. **TypeScript Compilation**: `tsc -b .` compiles TypeScript to JavaScript
2. **Bundling**: `node build.mjs` uses esbuild to bundle all dependencies into `dist/scheduler.bundle.js`
3. **Result**: A single 1.6MB file with all code (except @prisma/client)

### What's Bundled

✅ All npm dependencies (bullmq, ioredis, pino, node-cron)
✅ Workspace dependencies (@messaging-service/db, @messaging-service/types)
✅ All application code

### What's NOT Bundled

❌ @prisma/client (native module, installed separately in Docker)

### Docker Changes

**Before** (runtime stage):
```dockerfile
# Copy all workspace packages
COPY --from=build /app/types ./types
COPY --from=build /app/db ./db
COPY --from=build /app/scheduler ./scheduler

# Install all dependencies with pnpm
RUN pnpm install --prod
```

**After** (runtime stage):
```dockerfile
# Copy only the bundle and Prisma schema
COPY --from=build /app/scheduler/dist/scheduler.bundle.js ./
COPY --from=build /app/db/prisma ./prisma

# Install ONLY @prisma/client
RUN npm install @prisma/client@6.14.0
```

## Benefits

1. **No Module Resolution Issues**: Single file = no symlink problems
2. **Faster Runtime Install**: Only installs @prisma/client instead of entire workspace
3. **Smaller Runtime Image**: No pnpm, no workspace files
4. **Same Codebase**: Still uses workspace packages during development
5. **Clear Errors**: If bundle is broken, build fails (not runtime)

## Package.json Changes

```json
{
  "scripts": {
    "build": "tsc -b . && node build.mjs",
    "start": "node dist/scheduler.bundle.js"
  },
  "devDependencies": {
    "esbuild": "^0.24.2"
  }
}
```

## Verification

Bundle includes all dependencies:
- bullmq: ✓ (306 occurrences)
- ioredis: ✓ (94 occurrences)
- pino: ✓ (108 occurrences)
- node-cron: ✓ (38 occurrences)

## Railway Deployment

No changes needed from your side! Railway will:
1. Run the Dockerfile from the messaging-service root
2. Build stage: Install workspace, compile TypeScript, bundle with esbuild
3. Runtime stage: Copy bundle + Prisma, install @prisma/client only
4. Execute: `node scheduler.bundle.js`

The bundled scheduler will work exactly like before, but without module resolution issues.
