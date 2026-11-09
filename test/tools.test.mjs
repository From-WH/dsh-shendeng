/** The two tools and the switch command, against a fake Host context. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../index.js';
import { diskFs, execContext, isGap, makeHost, makeWorkspace } from './helpers.mjs';

test('registers both tools, the command, both projections and one prompt section', async () => {
  const host = makeHost();
  await apply(host.ctx, undefined);
  assert.deepEqual(Object.keys(host.tools).sort(), ['lamp_refine', 'lamp_scan']);
  assert.ok(host.commands.lamp, '/lamp is registered');
  assert.deepEqual(Object.keys(host.projections).sort(), ['shenDeng', 'shenDengUsage']);
  assert.equal(host.sections.length, 1);
  assert.equal(host.sections[0].name, 'shen-deng:wish-check');
});

test('lamp_refine refuses to run without an owning agent', async () => {
  const host = makeHost();
  await apply(host.ctx, undefined);
  await assert.rejects(
    () => host.tools.lamp_refine.execute({ wish: 'x' }, { signal: new AbortController().signal }),
    /owning agent session/,
  );
});

test('lamp_refine refuses an empty wish', async () => {
  const host = makeHost();
  await apply(host.ctx, undefined);
  for (const args of [{}, { wish: '' }, { wish: '   ' }, { wish: null }]) {
    await assert.rejects(() => host.tools.lamp_refine.execute(args, execContext()), /non-empty wish/);
  }
});

test('lamp_refine can skip the workspace read', async () => {
  const host = makeHost();
  await apply(host.ctx, undefined);
  const out = await host.tools.lamp_refine.execute({ wish: '做个网站', include_workspace: false }, execContext());
  assert.equal(out.total, 6);
  assert.match(out.facts[0], /未读取工作区/);
});

test('lamp_refine reads a real workspace and honours the scan bounds', async () => {
  const root = makeWorkspace({
    'alpha/package.json': '{"name":"alpha"}',
    'alpha/index.js': 'export const a = 1;\n',
    'beta/notes.md': '# notes\n',
  }, 'bounds');
  const host = makeHost({ workingDirectory: { get: () => root }, fs: diskFs() });
  await apply(host.ctx, undefined);
  const out = await host.tools.lamp_refine.execute({ wish: '把 alpha 改一下' }, execContext());
  assert.ok(out.facts.some((f) => f.includes('个文件')), 'the scan reports counts');
  assert.equal(out.targets.includes('alpha'), true, 'the real directory name is matched');
});

test('lamp_scan clamps out-of-range options instead of failing', async () => {
  const root = makeWorkspace({ 'a.js': '1\n', 'b/c.js': '2\n' }, 'clamp');
  const host = makeHost({ workingDirectory: { get: () => root }, fs: diskFs() });
  await apply(host.ctx, undefined);
  for (const args of [{ depth: 0 }, { depth: 99 }, { depth: -5 }, { depth: 'x' }, { max_tree_lines: 1 }, { max_tree_lines: 9999 }]) {
    const out = await host.tools.lamp_scan.execute(args, execContext());
    assert.ok(Array.isArray(out.tree), `tree is an array for ${JSON.stringify(args)}`);
    assert.ok(out.tree.length <= 200);
  }
});

test('lamp_scan walks depth-first so a directory reads with its children', async () => {
  const root = makeWorkspace({ 'alpha/a.js': '1\n', 'zeta.txt': 'x\n', 'beta/b.js': '2\n' }, 'order');
  const host = makeHost({ workingDirectory: { get: () => root }, fs: diskFs() });
  await apply(host.ctx, undefined);
  const out = await host.tools.lamp_scan.execute({ depth: 2 }, execContext());
  const alphaAt = out.tree.findIndex((line) => line.startsWith('alpha/'));
  const zetaAt = out.tree.findIndex((line) => line.includes('zeta.txt'));
  const childAt = out.tree.findIndex((line) => line.includes('a.js'));
  assert.ok(alphaAt >= 0 && zetaAt >= 0 && childAt >= 0, 'all entries appear');
  assert.ok(childAt > alphaAt && childAt < zetaAt, 'alpha child sits between alpha and the next sibling');
});

test('the prompt section follows the switch', async () => {
  for (const [active, expected] of [[true, true], [false, false]]) {
    const host = makeHost();
    host.ctx.sessionProjections = {
      register: async (definition) => ({
        stateOf: () => ({ active }),
        dispose: async () => {},
      }),
    };
    await apply(host.ctx, undefined);
    const text = host.sections[0].text({ scope: {}, agent: { session: {} } });
    assert.equal(text.length > 0, expected, `lamp ${active ? 'lit' : 'dark'} → section ${expected ? 'present' : 'empty'}`);
  }
});

test('the prompt section disappears when the tool is not visible', async () => {
  const host = makeHost();
  await apply(host.ctx, undefined);
  const text = host.sections[0].text({ scope: {}, agent: { session: {} } });
  assert.equal(text.length, 0, 'tools.get returning a value means lit; here state is dark');
});

test('/lamp accepts on, off and nothing else', async () => {
  const host = makeHost();
  await apply(host.ctx, undefined);
  const call = (rawInput) => host.commands.lamp.handler({ agent: { session: {} }, rawInput, attachments: [], signal: new AbortController().signal });
  assert.equal(call('').kind, 'success');
  assert.equal(call('on').kind, 'success');
  assert.equal(call('ON').kind, 'success');
  assert.equal(call(' off ').kind, 'success');
  // A typo must be refused, not silently treated as "on".
  for (const raw of ['garbage', 'on please', 'true']) {
    const result = call(raw);
    assert.equal(result.kind, 'error', `"${raw}" is refused`);
    assert.match(result.text, /用法/);
  }
});

test('malformed configuration falls back to the built-in six', async () => {
  for (const config of [null, {}, { dimensions: null }, { dimensions: 'x' }, { dimensions: [null] }, { dimensions: [{ id: 'a', match: [] }] }]) {
    const host = makeHost();
    await assert.doesNotReject(() => apply(host.ctx, config), `apply(${JSON.stringify(config)})`);
    const out = await host.tools.lamp_refine.execute({ wish: '做个网站', include_workspace: false }, execContext());
    assert.equal(out.total, 6, `built-ins for ${JSON.stringify(config)}`);
  }
});

test('configured dimensions replace the built-in set', async () => {
  const host = makeHost();
  await apply(host.ctx, {
    dimensions: [
      { id: 'tone', label: '调性', match: ['幽默'], ask: '调性？', suggest: '默认克制。' },
      { id: 'length', label: '篇幅', match: ['字'], ask: '多长？', suggest: '默认 800 字。' },
    ],
  });
  const out = await host.tools.lamp_refine.execute({ wish: '要幽默一点', include_workspace: false }, execContext());
  assert.equal(out.total, 2);
  assert.deepEqual(out.gaps.map((g) => g.id), ['length'], 'tone is settled by 幽默');
  assert.ok(out.gaps.every(isGap));
});

test('a volatile dimension reference is re-read on every call', async () => {
  const host = makeHost();
  const live = { value: [{ id: 'tone', label: '调性', match: ['幽默'], ask: '?', suggest: '默认。' }] };
  await apply(host.ctx, { dimensions: { get: () => live.value } });
  const first = await host.tools.lamp_refine.execute({ wish: '做个东西', include_workspace: false }, execContext());
  assert.equal(first.total, 1);
  live.value = [
    { id: 'a', label: 'A', match: ['x'], ask: '?', suggest: '默认。' },
    { id: 'b', label: 'B', match: ['y'], ask: '?', suggest: '默认。' },
  ];
  const second = await host.tools.lamp_refine.execute({ wish: '做个东西', include_workspace: false }, execContext());
  assert.equal(second.total, 2, 'an edit applies without a restart');
});
