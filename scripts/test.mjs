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
const run = (bin, args, env) => {
  const result = spawnSync(bin, args, { stdio: 'inherit', env: env ?? process.env });
  if (result.status !== 0) failed = true;
};

run(process.execPath, ['--test', ...units]);

const electron = '/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness';
const integration = join(testDir, 'cordis.integration.mjs');
if (existsSync(electron) && existsSync(integration)) {
  // The app binary is Electron. Without this it opens the GUI instead of
  // running the Node test runner, and a clean exit hides a skipped suite.
  run(electron, ['--test', integration], { ...process.env, ELECTRON_RUN_AS_NODE: '1' });
} else {
  console.log('# cordis integration skipped: DeepSeek Harness app or test missing');
}

process.exit(failed ? 1 : 0);
