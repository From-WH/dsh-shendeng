/**
 * Integration: load the real plugin into a real Cordis context.
 *
 * Fake contexts cannot catch Cordis's dependency guard ("cannot get property X
 * without inject"), which silently disabled a whole registration in an earlier
 * version of this plugin. Importing Cordis from the installed app makes the
 * test run that guard for real; without the app the suite skips.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT } from './helpers.mjs';

const CORDIS = '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai/cordis/lib/index.js';
let cordis = null;
try {
  cordis = await import(CORDIS);
} catch {
  cordis = null;
}

const skip = cordis ? false : 'DeepSeek Harness app not installed';
const settle = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

const host = await import(`${ROOT}index.js`);

/** A root context providing the named services as inert stubs. */
function makeRoot(serviceNames) {
  const { Context, Service } = cordis;
  const root = new Context();
  const registered = { tools: {}, commands: {}, projections: {}, sections: [] };
  const impls = {
    tools: {
      register(definition) { registered.tools[definition.name] = definition; return () => {}; },
      get() { return {}; },
    },
    commands: { register(definition) { registered.commands[definition.name] = definition; return () => {}; } },
    sessionProjections: {
      async register(definition) {
        registered.projections[definition.key] = definition;
        return { stateOf: () => definition.init(), dispose: async () => {} };
      },
    },
    systemPrompt: { section(section) { registered.sections.push(section); return () => {}; } },
    fs: { resolve: async (path) => ({ displayPath: path, targetKey: path }), listDir: async () => [], stat: async () => undefined, readText: async () => '' },
    workingDirectory: { get: () => '/' },
  };
  for (const name of serviceNames) {
    class Stub extends Service {
      constructor(ctx) {
        super(ctx, name);
        Object.assign(this, impls[name]);
      }
    }
    root.plugin(Stub);
  }
  return { root, registered };
}

test('activates and registers everything in a real Cordis context', { skip }, async () => {
  const { root, registered } = makeRoot(['tools', 'commands', 'sessionProjections', 'systemPrompt', 'fs', 'workingDirectory']);
  root.plugin(host, {});
  await settle();
  assert.deepEqual(Object.keys(registered.tools).sort(), ['lamp_refine', 'lamp_scan']);
  assert.ok(registered.commands.lamp, 'the /lamp command mounts');
  assert.deepEqual(Object.keys(registered.projections).sort(), ['shenDeng', 'shenDengUsage']);
  assert.equal(registered.sections.length, 1);
  await root.dispose?.();
});

test('a missing service keeps the plugin inactive instead of half-loaded', { skip }, async () => {
  // Without `fs`, `inject` cannot be satisfied; Cordis must not hand the plugin
  // a context it would throw on.
  const { root, registered } = makeRoot(['tools', 'commands', 'sessionProjections', 'systemPrompt', 'workingDirectory']);
  root.plugin(host, {});
  await settle();
  assert.deepEqual(Object.keys(registered.tools), [], 'nothing registers without the declared services');
  await root.dispose?.();
});
