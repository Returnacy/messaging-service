#!/usr/bin/env node

/**
 * Wrapper script to run scheduler with proper module resolution in Docker.
 * This ensures Node can find all dependencies in the pnpm workspace.
 */

// Set working directory to /app to ensure correct node_modules resolution
process.chdir('/app');

// Import and run the scheduler
await import('./scheduler/dist/src/scheduler.js');
