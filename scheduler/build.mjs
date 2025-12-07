#!/usr/bin/env node
import { build } from 'esbuild';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json to get dependencies
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));
const dependencies = Object.keys(pkg.dependencies || {});

// Bundle the scheduler into a single file
// External: @prisma/client (native module, can't be bundled)
// Bundle everything else including workspace dependencies
await build({
  entryPoints: ['dist/src/scheduler.js'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/scheduler.bundle.js',
  external: ['@prisma/client'],
  sourcemap: true,
  minify: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});

console.log('✓ Scheduler bundled successfully to dist/scheduler.bundle.js');
