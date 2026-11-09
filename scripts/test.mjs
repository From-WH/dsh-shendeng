#!/usr/bin/env node
/**
 * Test runner.
 *
 * Unit tests run under the current Node. The Cordis integration test needs the
 * DeepSeek Harness app's own module tree (it imports Cordis from the asar), so
 * it runs through the app's Electron binary; without the app it prints a skip
 * line instead of failing.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const testDir = join(root, 'test');
const units = readdirSync(testDir)
  .filter((file) => file.endsWith('.test.mjs') && file !== 'cordis.integration.mjs')
  .map((file) => join(testDir, file));

let failed = false;
const run = (bin, args) => {
  const result = spawnSync(bin, args, { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
};

run(process.execPath, ['--test', ...units]);

const electron = '/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness';
const integration = join(testDir, 'cordis.integration.mjs');
if (existsSync(electron) && existsSync(integration)) {
  run(electron, ['--test', integration]);
} else {
  console.log('# cordis integration skipped: DeepSeek Harness app or test missing');
}

process.exit(failed ? 1 : 0);
