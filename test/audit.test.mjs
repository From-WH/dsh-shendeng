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
  assert.equal(gap.suggestion, '先确认目标，再动手。');
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
  assert.equal(detectIntent('新建 release notes，写三个改动', scan), 'create');
  assert.equal(detectIntent('Fix the off-by-one in alpha', scan), 'modify');
  assert.equal(detectIntent('为什么测试挂了', scan), 'ask');
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

test('short words do not settle a dimension they do not mean', () => {
  const give = auditWish('给我写个函数', scan);
  assert.ok(give.settled.includes('artifact'));
  assert.ok(!give.settled.includes('audience'), '给我 is the speaker, not an audience');

  const effect = auditWish('效果不好', scan);
  assert.ok(!effect.settled.includes('acceptance'), 'a complaint is not an acceptance test');
  assert.equal(effect.intent, 'modify');
  assert.match(effect.gaps.find((gap) => gap.id === 'destination').question, /要改的是哪一个/);

  const asked = '我只是想问一下，昨天那个改动提交了吗';
  const only = auditWish(asked, scan);
  assert.equal(only.intent, 'ask');
  assert.equal(only.gaps.length, 0);
  assert.match(buildBrief(asked, only, scan), /这是提问/);
  assert.ok(!buildBrief(asked, only, scan).includes('默认改'), 'a question must not pick a directory to edit');
});

test('a stated requirement is kept, including in ordinary wording', () => {
  const letter = '给老板写一封邮件说明周五发布延期到下周三，正式，200字以内，结论放第一句，我复制发出去就能用';
  const letterAudit = auditWish(letter, scan);
  for (const id of ['artifact', 'destination', 'audience', 'constraints', 'acceptance']) {
    assert.ok(letterAudit.settled.includes(id), `${id} should be read off the letter`);
  }
  const letterBrief = buildBrief(letter, letterAudit, scan);
  assert.ok(!letterBrief.includes('新建一个独立目录'), 'a letter is not a new code directory');
  assert.ok(!letterBrief.includes('不加新依赖'), 'a letter does not grow a toolchain constraint');
  assert.match(letterBrief, /验收标准：文中已说明/);

  const fix = 'Fix the off-by-one in alpha/cart.js line 88. Only that function. No new dependencies. npm test must pass. First version only.';
  const fixAudit = auditWish(fix, scan);
  for (const id of ['artifact', 'destination', 'constraints', 'acceptance', 'scope']) {
    assert.ok(fixAudit.settled.includes(id), `${id} should be read off the English fix`);
  }
  assert.equal(fixAudit.clear, true);
  const fixBrief = buildBrief(fix, fixAudit, scan);
  assert.match(fixBrief, /验收标准：文中已说明/);
  assert.ok(!fixBrief.includes('打开就能看到结果'));

  const notes = '在 docs 目录新建 release-notes.md，给同事看，正式语气，只写本次三个改动，每条不超过两句，不要写别的，打开文件能看就算完成';
  const notesAudit = auditWish(notes, scan);
  assert.equal(notesAudit.intent, 'create', '改动 is a noun here, not a modify verb');
  assert.ok(notesAudit.settled.includes('acceptance'), '打开能看就算完成 is the acceptance');

  const bound = auditWish('每条不超过两句', scan);
  assert.ok(bound.settled.includes('constraints'), 'a length cap is a constraint, not a missing toolchain rule');
});

test('a text-only brief says the workspace was never read', () => {
  const empty = { read: false, root: '', files: 0, directories: 0, topLevel: [], extensions: [], manifests: [], tree: [], truncated: false };
  const result = auditWish('做个网站', empty);
  const brief = buildBrief('做个网站', result, empty);
  assert.match(brief, /本次未读取工作区/);
  assert.ok(!brief.includes('/fixture'), 'no stale workspace path');
});
