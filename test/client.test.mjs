/**
 * The browser half, rendered without a browser.
 *
 * The bundle registers into `window.__ModuleLoader__`; this file loads it the
 * same way the page does, then renders each registration with a minimal React
 * stand-in. That catches the failures a syntax check cannot: a view that reads
 * a prop it was never given, a locale key with no dictionary entry, a style
 * value of `undefined`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const source = readFileSync(join(ROOT, 'client.js'), 'utf8');
const DICTS = (() => {
  const zh = source.slice(source.indexOf('zh: {'), source.indexOf('en: {'));
  const en = source.slice(source.indexOf('en: {'), source.indexOf('\n    };', source.indexOf('en: {')));
  return { zh, en };
})();

function loadBundle() {
  let captured = null;
  new Function('window', source)({ __ModuleLoader__: { load: (spec) => { captured = spec; } } });
  assert.ok(captured, 'the bundle registers itself');
  return captured;
}

const React = {
  // Real React puts children in `props.children`; a component that reads
  // `props.children` (Card does) must see them here too.
  createElement: (type, props, ...children) => {
    const kids = children.flat(Infinity);
    return { type, props: { ...(props || {}), children: kids }, children: kids };
  },
  Fragment: 'Fragment',
  useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
  useRef: (value) => ({ current: value }),
  useEffect: (fn) => { if (typeof fn === 'function') fn(); },
  useMemo: (fn) => fn(),
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
};

/** Expand function components so assertions see real elements. */
function expand(tree) {
  let current = tree;
  for (let pass = 0; pass < 50; pass++) {
    let changed = false;
    const visit = (node) => {
      if (node === null || node === false || typeof node !== 'object') return node;
      if (Array.isArray(node)) return node.map(visit);
      if (typeof node.type === 'function') {
        changed = true;
        return visit(node.type(node.props));
      }
      return { ...node, children: (node.children || []).map(visit) };
    };
    current = visit(current);
    if (!changed) break;
  }
  return current;
}

function collect(tree, predicate, out = []) {
  const visit = (node) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (predicate(node)) out.push(node);
    (node.children || []).forEach(visit);
  };
  visit(tree);
  return out;
}

/** Register the bundle against a fake client context and return its views. */
function mountClient(overrides = {}) {
  const spec = loadBundle();
  const module = spec.factory((name) => (name === 'react' ? React : {}));
  const views = {};
  const registrations = [];
  const snapshot = {
    status: 'ready',
    writable: true,
    revision: 3,
    value: { dimensions: [{ id: 'tone', label: '调性', match: ['幽默'], ask: '调性？', suggest: '默认克制。' }] },
  };
  const ctx = {
    locale: {
      register: () => () => {},
      bind: () => (key) => key,
      getLocale: () => ({ active: 'zh' }),
      getSnapshot: () => ({ revision: 0 }),
      subscribe: () => () => {},
    },
    remote: {
      commands: { execute: async () => ({ ok: true, value: { result: { kind: 'success' } } }) },
      settings: { update: async () => ({ ok: true, value: {} }) },
    },
    configForms: { get: () => ({ getSnapshot: () => snapshot, subscribe: () => () => {} }) },
    slots: {
      inject: (_key, callback) => {
        const effect = callback();
        if (effect && typeof effect.next === 'function') {
          let step = effect.next();
          while (!step.done) step = effect.next();
        }
      },
      register: (options, component) => {
        views[`${options.name}#${options.id ?? options.key ?? ''}`] = component;
        registrations.push(options.name);
        return () => {};
      },
    },
    effect: () => {},
    ...overrides,
  };
  module.apply(ctx);
  return { module, views, registrations, snapshot };
}

const translate = () => (key) => key;
const block = (key, meta, isError = false) => ({
  kind: 'tool-result',
  callId: 'call-1',
  name: key,
  args: null,
  call: { name: key, argsRaw: key === 'lamp_refine' ? '{"wish":"做个网站"}' : '{"path":"alpha"}' },
  content: isError ? [{ type: 'text', text: 'boom' }] : [],
  isError,
  meta,
  subCalls: [],
});

test('the bundle declares the services it reads', () => {
  const { module } = mountClient();
  for (const name of ['slots', 'remote', 'remote.settings', 'remote.commands', 'configForms', 'locale']) {
    assert.ok(module.inject.includes(name), `inject declares ${name}`);
  }
});

test('every registration is made on the right slot', () => {
  const { registrations } = mountClient();
  assert.deepEqual(registrations.filter((n) => n === 'tool.call.toolview').length, 2);
  assert.ok(registrations.includes('settings.section'));
  assert.ok(registrations.includes('settings.section.icon'));
  assert.ok(registrations.includes('conversation.input.right'));
});

test('the lamp command rows render in every state', () => {
  const { views } = mountClient();
  const refine = views['tool.call.toolview#lamp_refine'];
  const scan = views['tool.call.toolview#lamp_scan'];

  const refineCases = [
    { shenDeng: { kind: 'refine', score: 1, total: 6, clear: false, intent: 'modify', targets: ['alpha'], gaps: [{ id: 'a', label: 'L', question: 'Q', suggestion: 'S' }], vague: ['随意'], brief: 'B', facts: ['F'] } },
    { shenDeng: { kind: 'refine', score: 6, total: 6, clear: true, intent: 'create', targets: [], gaps: [], vague: [], brief: 'B', facts: [] } },
    { shenDeng: { kind: 'refine', score: 0, total: 6, clear: false, intent: 'ask', targets: [], gaps: [], vague: [], brief: '问', facts: [] } },
  ];
  for (const meta of refineCases) {
    const tree = expand(refine({ translate, useDisclosure: () => ({ expanded: true, toggle() {} }), block: block('lamp_refine', meta) }));
    assert.ok(collect(tree, (n) => n.type === 'svg').length > 0, 'renders the lamp glyph');
  }

  const scanTree = expand(scan({
    translate,
    useDisclosure: () => ({ expanded: true, toggle() {} }),
    block: block('lamp_scan', { shenDeng: { kind: 'scan', root: '/w', files: 2, directories: 1, tree: ['a/', '  b.js'], extensions: [{ ext: '.js', count: 1 }], manifests: [], truncated: true } }),
  }));
  assert.ok(collect(scanTree, (n) => n.type === 'pre').length > 0, 'scan shows the tree');
});

test('a failed tool call reports the failure instead of a blank row', () => {
  const { views } = mountClient();
  const tree = expand(views['tool.call.toolview#lamp_refine']({
    translate,
    useDisclosure: () => ({ expanded: false, toggle() {} }),
    block: block('lamp_refine', undefined, true),
  }));
  const texts = [];
  const gather = (node) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) { node.forEach(gather); return; }
    if (typeof node === 'string') { texts.push(node); return; }
    if (typeof node !== 'object') return;
    gather(node.children);
  };
  gather(tree);
  assert.ok(texts.some((t) => t.includes('failed') || t.includes('boom')), 'the error text reaches the row');
});

test('the composer control is a single icon that switches to undo', () => {
  const { views } = mountClient();
  const dock = views['conversation.input.right#shen-deng-console'];
  const base = {
    translate,
    useProjection: () => ({ active: true }),
    useInput: (select) => (select ? select({ draft: '做个网站', phase: 'plain' }) : { draft: '做个网站', phase: 'plain' }),
    inputActions: { setDraft: () => {} },
    execute: async () => null,
    rewrite: async () => ({ ok: true, text: 'next', gaps: [] }),
  };
  const tree = expand(dock(base));
  const buttons = collect(tree, (n) => n.type === 'button');
  assert.equal(buttons.length, 1, 'one control, no label text beside it');
  assert.ok(String(buttons[0].props.className).includes('sd-lampbtn'));
  // No secondary text: the row holds one button and nothing beside it.
  const holder = collect(tree, (n) => n.props?.className === 'sd-composer-btn')[0];
  assert.ok(holder, 'the control sits in its own holder');
  assert.equal(collect(holder, (n) => n.type === 'button').length, 1, 'exactly one control');
  // And no text-bearing spans survived the simplification.
  for (const dead of ['sd-title', 'sd-sub', 'sd-stats', 'sd-dot']) {
    assert.equal(collect(tree, (n) => n.props?.className === dead).length, 0, `${dead} is gone`);
  }
});

test('the control disables itself when the composer cannot be enhanced', () => {
  const { views } = mountClient();
  const dock = views['conversation.input.right#shen-deng-console'];
  const render = (inputActions, input) => expand(dock({
    translate,
    useProjection: () => ({ active: true }),
    useInput: (select) => (select ? select(input) : input),
    inputActions,
    execute: async () => null,
    rewrite: async () => ({ ok: true, text: 'next', gaps: [] }),
  }));
  const noActions = collect(render(undefined, { draft: 'x', phase: 'plain' }), (n) => n.type === 'button')[0];
  assert.equal(noActions.props.disabled, true, 'no setDraft means no action');
  const empty = collect(render({ setDraft: () => {} }, { draft: '', phase: 'plain' }), (n) => n.type === 'button')[0];
  assert.equal(empty.props.disabled, true, 'empty draft means no action');
  const locked = collect(render({ setDraft: () => {} }, { draft: 'x', phase: 'sending' }), (n) => n.type === 'button')[0];
  assert.equal(locked.props.disabled, true, 'a sending composer means no action');
});

test('an empty or replaced composer never offers undo', () => {
  // The reported bug: after sending, the icon stayed as "undo". The component
  // drops its stored original as soon as the composer stops holding the text
  // the enhance produced, so these three inputs must all render the lamp.
  const { views } = mountClient();
  const dock = views['conversation.input.right#shen-deng-console'];
  for (const draft of ['', 'something else entirely']) {
    const tree = expand(dock({
      translate,
      useProjection: () => ({ active: true }),
      useInput: (select) => (select ? select({ draft, phase: 'plain' }) : { draft, phase: 'plain' }),
      inputActions: { setDraft: () => {} },
      execute: async () => null,
      rewrite: async () => ({ ok: true, text: 'enhanced', gaps: [] }),
    }));
    const button = collect(tree, (n) => n.type === 'button')[0];
    assert.ok(!String(button.props.className).includes('--undo'),
      `no undo offer for ${JSON.stringify(draft)}`);
  }
});

test('the settings page offers three strength levels', () => {
  const { views } = mountClient();
  const page = views['settings.section#shen-deng-level'];
  assert.ok(page, 'the section is registered under its new id');
  const tree = expand(page({
    translate,
    form: () => ({
      getSnapshot: () => ({ value: { level: 'medium' }, writable: true, revision: 4 }),
      subscribe: () => () => {},
    }),
    update: async () => ({ ok: true }),
  }));
  const options = collect(tree, (n) => n.props.role === 'radio');
  assert.equal(options.length, 3, 'low, medium, high');
  assert.deepEqual(options.map((o) => o.props['aria-checked']), [false, true, false],
    'medium is selected by default');
  // The old dimension editor must be gone entirely.
  assert.equal(collect(tree, (n) => n.type === 'input').length, 0, 'no dimension inputs remain');
});

test('picking a level writes only that field', async () => {
  const { views } = mountClient();
  const page = views['settings.section#shen-deng-level'];
  const writes = [];
  const tree = expand(page({
    translate,
    form: () => ({
      getSnapshot: () => ({ value: { level: 'low' }, writable: true, revision: 7 }),
      subscribe: () => () => {},
    }),
    update: async (patch, revision) => { writes.push([patch, revision]); return { ok: true }; },
  }));
  const options = collect(tree, (n) => n.props.role === 'radio');
  const high = options[2];
  high.props.onClick();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(writes, [[{ level: 'high' }, 7]], 'a minimal patch with the current revision');
});

test('the settings icon is registered under the section id and renders', () => {
  const { views } = mountClient();
  const icon = views['settings.section.icon#shen-deng-level'];
  assert.ok(icon, 'the nav row gets its own glyph, not the generic Settings one');
  for (const props of [{ size: 16, active: true }, { size: 16, active: false }, {}]) {
    const tree = expand(icon(props));
    assert.ok(collect(tree, (n) => n.type === 'path').length >= 4, 'the lamp is drawn');
  }
});

test('no rendered style carries undefined or NaN', () => {
  const { views } = mountClient();
  const trees = [
    views['settings.section#shen-deng-level']({
      translate,
      form: () => ({ getSnapshot: () => ({ value: { level: 'low' }, writable: true, revision: 0 }), subscribe: () => () => {} }),
      update: async () => ({ ok: true }),
    }),
    views['conversation.input.right#shen-deng-console']({
      translate,
      useProjection: () => ({ active: true }),
      useInput: (select) => (select ? select({ draft: 'x', phase: 'plain' }) : { draft: 'x', phase: 'plain' }),
      execute: async () => null,
      rewrite: async () => ({ ok: true, text: 'y', gaps: [] }),
      setDraft: () => {},
    }),
    views['settings.section.icon#shen-deng-level']({ size: 16, active: true }),
  ];
  const bad = [];
  for (const tree of trees) {
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (node.props && node.props.style && typeof node.props.style === 'object') {
        for (const [key, value] of Object.entries(node.props.style)) {
          if (typeof value === 'string' && /undefined|NaN/.test(value)) bad.push(`${key}=${value}`);
        }
      }
      (node.children || []).forEach(visit);
    };
    visit(expand(tree));
  }
  assert.deepEqual(bad, []);
});

test('every locale key used by the views exists in both dictionaries', () => {
  const used = new Set();
  for (const match of source.matchAll(/\bt\('([A-Za-z][\w.]*)'\)/g)) used.add(match[1]);
  assert.ok(used.size > 20, 'the scan found the keys');
  for (const [nome, dict] of Object.entries(DICTS)) {
    const missing = [...used].filter((key) => !new RegExp(`\\b${key}\\s*:`).test(dict));
    assert.deepEqual(missing, [], `${nome} is missing keys`);
  }
});
