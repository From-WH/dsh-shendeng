/** The six-dimension audit, as a pure function. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditWish, buildBrief, detectIntent } from '../index.js';
import { scanFixture, isGap } from './helpers.mjs';

const scan = scanFixture();

test('a specific wish leaves few gaps', () => {
  const result = auditWish(
    '把 alpha 的 index.js 深度上限从 6 改到 8，跑 node --check 通过即可，只做第一版',
    scan,
  );
  assert.equal(result.total, 6);
  assert.ok(result.score >= 4, `expected a settled wish, got ${result.score}/6`);
  assert.ok(result.gaps.every(isGap), 'every gap carries id/label/question/suggestion');
});

test('a vague wish leaves every gap open', () => {
  const result = auditWish('随便弄个东西', scan);
  assert.equal(result.score, 0);
  assert.equal(result.gaps.length, 6);
  assert.ok(result.vague.includes('随便'), 'vague markers are reported');
});

test('naming an existing directory settles the destination', () => {
  const result = auditWish('把 alpha 优化一下', scan);
  assert.ok(result.settled.includes('destination'), 'destination is answered by the name alone');
  assert.equal(result.notes.destination, '指名了工作区已有目标：alpha');
  assert.ok(!result.gaps.some((g) => g.id === 'destination'));
});

test('an unnamed change request lists the entries it could mean', () => {
  const result = auditWish('改一下', scan);
  const gap = result.gaps.find((g) => g.id === 'destination');
  assert.ok(gap, 'destination stays open');
  assert.match(gap.question, /要改的是哪一个/);
  assert.match(gap.question, /alpha/, 'the real top-level names are offered');
});

test('a file extension counts as a deliverable, not as every dimension', () => {
  // The compiler once appended an extension alternation to every dimension,
  // which made any ".js" mention look like it answered audience and scope too.
  const result = auditWish('改一下 index.js', scan);
  assert.ok(result.settled.includes('artifact'));
  assert.ok(!result.settled.includes('audience'), 'audience is not settled by a filename');
  assert.ok(!result.settled.includes('scope'), 'scope is not settled by a filename');
});

test('intent separates making something new from changing something', () => {
  assert.equal(detectIntent('写一个全新的页面', scan), 'create');
  assert.equal(detectIntent('把 alpha 改一下', scan), 'modify');
  assert.equal(detectIntent('', scan), 'unclear');
});

test('non-string wishes are handled rather than thrown on', () => {
  for (const value of [undefined, null, 123, {}, []]) {
    assert.doesNotThrow(() => auditWish(value, scan), `auditWish(${JSON.stringify(value)})`);
    assert.doesNotThrow(() => detectIntent(value, scan), `detectIntent(${JSON.stringify(value)})`);
  }
});

test('the audit works without a workspace', () => {
  const result = auditWish('做个网站', null);
  assert.equal(result.total, 6);
  assert.deepEqual(result.targets, [], 'no workspace means no name matches');
});

test('the brief restates the wish and accounts for every dimension', () => {
  const result = auditWish('做个网站', scan);
  const brief = buildBrief('做个网站', result, scan);
  assert.match(brief, /^目标：做个网站/m);
  for (const dimension of ['交付物', '落点', '受众与语气', '硬约束', '验收标准', '范围']) {
    assert.ok(brief.includes(dimension), `${dimension} appears in the brief`);
  }
  assert.ok(brief.includes('工作区依据'));
});

test('a text-only brief says the workspace was never read', () => {
  const empty = { read: false, root: '', files: 0, directories: 0, topLevel: [], extensions: [], manifests: [], tree: [], truncated: false };
  const result = auditWish('做个网站', empty);
  const brief = buildBrief('做个网站', result, empty);
  assert.match(brief, /本次未读取工作区/);
  assert.ok(!brief.includes('/fixture'), 'no stale workspace path');
});
