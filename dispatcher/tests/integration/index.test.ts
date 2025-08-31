import { exec } from 'child_process';
import path from 'path';
import { test } from 'vitest';

test('index starts (smoke)', async () => {
  const p = exec('node dist/index.js', { cwd: path.resolve(__dirname, '..') });

  await new Promise<void>((resolve) => {
    setTimeout(() => {
      p.kill();
      resolve();
    }, 500);
  });
});