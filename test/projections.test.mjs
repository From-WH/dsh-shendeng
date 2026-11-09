/** The two session projections: the switch and the usage counter. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../index.js';
import { makeHost } from './helpers.mjs';

async function projections() {
  const host = makeHost();
  await apply(host.ctx, undefined);
  return host.projections;
}

const run = (id, args) => ({ type: 'command/run', seq: 1, time: 1, data: { commandId: id, name: 'lamp', args } });
const done = (id, kind) => ({ type: 'command/done', seq: 2, time: 2, data: { commandId: id, kind } });
const toolResult = (meta) => ({ type: 'tool/result', seq: 3, time: 3, data: { meta } });

test('the switch starts dark', async () => {
  const { shenDeng } = await projections();
  assert.deepEqual(shenDeng.wire.view(shenDeng.init()), { active: false, pending: false });
});

test('a successful /lamp commits the state it named', async () => {
  const { shenDeng } = await projections();
  let state = shenDeng.init();
  state = shenDeng.apply(state, run('c1', 'on'));
  assert.deepEqual(shenDeng.wire.view(state), { active: false, pending: true }, 'pending while the command runs');
  state = shenDeng.apply(state, done('c1', 'success'));
  assert.deepEqual(shenDeng.wire.view(state), { active: true, pending: false });
  state = shenDeng.apply(state, run('c2', 'off'));
  state = shenDeng.apply(state, done('c2', 'success'));
  assert.deepEqual(shenDeng.wire.view(state), { active: false, pending: false });
});

test('a failed /lamp changes nothing', async () => {
  const { shenDeng } = await projections();
  let state = shenDeng.init();
  state = shenDeng.apply(state, run('c1', 'on'));
  state = shenDeng.apply(state, done('c1', 'success'));
  state = shenDeng.apply(state, run('c2', 'off'));
  state = shenDeng.apply(state, done('c2', 'error'));
  assert.deepEqual(shenDeng.wire.view(state), { active: true, pending: false }, 'the earlier state survives');
});

test('an unrecognised argument records no intent', async () => {
  const { shenDeng } = await projections();
  let state = shenDeng.init();
  state = shenDeng.apply(state, run('c1', 'garbage'));
  assert.deepEqual(shenDeng.wire.view(state), { active: false, pending: false });
  state = shenDeng.apply(state, done('c1', 'error'));
  assert.deepEqual(shenDeng.wire.view(state), { active: false, pending: false });
});

test('unrelated events leave the switch untouched and identity-stable', async () => {
  const { shenDeng } = await projections();
  const state = shenDeng.init();
  const next = shenDeng.apply(state, { type: 'turn/start', seq: 9, time: 9, data: { turn: 1 } });
  assert.equal(next, state, 'same reference, so no re-render');
});

test('the usage counter folds what the tools actually did', async () => {
  const { shenDengUsage } = await projections();
  let state = shenDengUsage.init();
  assert.deepEqual(state, { checks: 0, gaps: 0, vague: 0, scans: 0 });

  state = shenDengUsage.apply(state, toolResult({ shenDeng: { kind: 'refine', gaps: [{ id: 'a' }, { id: 'b' }], vague: ['随便'] } }));
  state = shenDengUsage.apply(state, toolResult({ shenDeng: { kind: 'scan' } }));
  state = shenDengUsage.apply(state, toolResult({ shenDeng: { kind: 'refine', gaps: [{ id: 'c' }], vague: [] } }));

  assert.equal(state.checks, 2);
  assert.equal(state.gaps, 3);
  assert.equal(state.vague, 1);
  assert.equal(state.scans, 1);
  assert.deepEqual(shenDengUsage.wire.view(state), { checks: 2, gaps: 3 }, 'only the two dock numbers travel');
});

test('the usage counter ignores results without lamp metadata', async () => {
  const { shenDengUsage } = await projections();
  const state = shenDengUsage.init();
  for (const meta of [undefined, null, {}, { other: 1 }, 'x', 42]) {
    assert.equal(shenDengUsage.apply(state, toolResult(meta)), state, `meta ${JSON.stringify(meta)} is inert`);
  }
});

test('the usage counter ignores non-result events', async () => {
  const { shenDengUsage } = await projections();
  const state = shenDengUsage.init();
  assert.equal(shenDengUsage.apply(state, { type: 'turn/start', seq: 1, time: 1, data: {} }), state);
});

test('both projections validate through their declared schemas', async () => {
  const { shenDeng, shenDengUsage } = await projections();
  for (const [projection, state] of [[shenDeng, shenDeng.init()], [shenDengUsage, shenDengUsage.init()]]) {
    assert.doesNotThrow(() => projection.stateSchema.parse(state));
    assert.doesNotThrow(() => projection.wire.viewSchema.parse(projection.wire.view(state)));
    assert.ok(Number.isInteger(projection.stateVersion) && projection.stateVersion >= 0);
  }
});
