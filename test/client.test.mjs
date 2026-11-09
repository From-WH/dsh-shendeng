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
  assert.ok(registrations.includes('conversation.composer.dock'));
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

test('the composer console renders lit, dark, and with no counter yet', () => {
  const { views } = mountClient();
  const console = views['conversation.composer.dock#shen-deng-console'];
  const cases = [
    [{ active: false }, undefined],
    [{ active: true }, { checks: 2, gaps: 5 }],
    [{ active: true }, null],
  ];
  for (const [projection, usage] of cases) {
    const tree = expand(console({
      translate,
      useProjection: (key) => (key === 'shenDeng' ? projection : key === 'shenDengUsage' ? usage : undefined),
      execute: async () => null,
    }));
    const row = collect(tree, (n) => n.props.className === 'sd-row')[0];
    assert.ok(row, 'the row renders');
    const classes = row.children.filter((c) => c && typeof c === 'object').map((c) => c.props.className);
    assert.deepEqual(classes, ['sd-lampbtn', 'sd-text-btn', 'sd-stats']);
  }
});

test('the settings page renders its rows and the template chips', () => {
  const { views } = mountClient();
  const page = views['settings.section#shen-deng-dimensions'];
  const tree = expand(page({
    translate,
    form: () => ({ getSnapshot: () => ({ value: { dimensions: [{ id: 'tone', label: '调性', match: ['幽默'], ask: '?', suggest: '默认。' }] }, writable: true, revision: 1 }), subscribe: () => () => {} }),
    update: async () => ({ ok: true }),
  }));
  const inputs = collect(tree, (n) => n.type === 'input');
  assert.equal(inputs.length, 5, 'one row fills five inputs');
  // The page shows the label first, then the id, then the three text fields.
  assert.deepEqual(inputs.map((i) => i.props.value), ['tone', '调性', '幽默', '?', '默认。']);
  const labels = collect(tree, (n) => n.type === 'button').map((b) => b.children[0]);
  assert.ok(labels.length >= 5, 'template chips and actions are present');
});

test('the settings icon is registered under the section id and renders', () => {
  const { views } = mountClient();
  const icon = views['settings.section.icon#shen-deng-dimensions'];
  assert.ok(icon, 'the nav row gets its own glyph, not the generic Settings one');
  for (const props of [{ size: 16, active: true }, { size: 16, active: false }, {}]) {
    const tree = expand(icon(props));
    assert.ok(collect(tree, (n) => n.type === 'path').length >= 4, 'the lamp is drawn');
  }
});

test('no rendered style carries undefined or NaN', () => {
  const { views } = mountClient();
  const trees = [
    views['settings.section#shen-deng-dimensions']({ translate, form: () => ({ getSnapshot: () => ({ value: { dimensions: [] }, writable: true, revision: 0 }), subscribe: () => () => {} }), update: async () => ({ ok: true }) }),
    views['conversation.composer.dock#shen-deng-console']({ translate, useProjection: () => ({ active: true }), execute: async () => null }),
    views['settings.section.icon#shen-deng-dimensions']({ size: 16, active: true }),
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
