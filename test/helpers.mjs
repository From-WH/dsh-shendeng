/**
 * Shared test helpers for the lamp.
 *
 * Two things this module insists on:
 *
 * 1. A **fake workspace** — the scan reads a real directory, so tests build a
 *    throwaway tree with known files instead of pointing at anything real.
 * 2. A **fake Host context** — `apply` takes a context with a handful of
 *    services, and a test that stubbed them ad hoc would drift from what the
 *    plugin actually calls. Registering through one factory keeps them honest.
 */
import { readdirSync, readFileSync, statSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const ROOT = new URL('..', import.meta.url).pathname;

/** A throwaway workspace tree on disk. */
export const SANDBOX = mkdtempSync(join(tmpdir(), 'shendeng-test-'));
process.on('exit', () => rmSync(SANDBOX, { recursive: true, force: true }));

/**
 * Build a small workspace with a known shape.
 * @param files - `{ 'relative/path': 'contents' }`
 * @returns the workspace root.
 */
export function makeWorkspace(files, name = 'ws') {
  const root = join(SANDBOX, name);
  mkdirSync(root, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

/**
 * A workspace scan result, for tests that exercise the audit without disk I/O.
 * Mirrors the shape `scanWorkspace` returns.
 */
export function scanFixture(overrides = {}) {
  return {
    read: true,
    root: '/fixture',
    files: 3,
    directories: 2,
    topLevel: ['alpha', 'beta', 'notes.md'],
    extensions: [{ ext: '.js', count: 7 }],
    manifests: [{ path: 'alpha/package.json', kind: 'node', excerpt: '{"name":"alpha"}' }],
    tree: ['alpha/', '  index.js', 'beta/', 'notes.md'],
    truncated: false,
    ...overrides,
  };
}

/**
 * Build a Host context double.
 *
 * Every service the plugin declares in `inject` appears here. A test that adds
 * a service to the plugin but forgets the stub fails loudly at `apply`, which
 * is the behaviour we want.
 */
export function makeHost(overrides = {}) {
  const tools = {};
  const commands = {};
  const projections = {};
  const sections = [];
  const registered = { tools, commands, projections, sections };

  const ctx = {
    sessionProjections: {
      register: async (definition) => {
        projections[definition.key] = definition;
        return {
          stateOf: () => definition.init(),
          dispose: async () => {},
        };
      },
    },
    commands: {
      register: (definition) => {
        commands[definition.name] = definition;
        return () => {};
      },
    },
    tools: {
      register: (definition) => {
        tools[definition.name] = definition;
        return () => {};
      },
      get: () => ({}),
    },
    systemPrompt: {
      section: (section) => {
        sections.push(section);
        return () => {};
      },
    },
    fs: {
      resolve: async (path) => ({ displayPath: path, targetKey: `key:${path}` }),
      listDir: async () => [],
      stat: async () => undefined,
      readText: async () => '',
    },
    workingDirectory: { get: () => SANDBOX },
    ...overrides,
  };

  return Object.assign({ ctx }, registered);
}

/**
 * A filesystem provider backed by the real disk.
 *
 * `scanWorkspace` needs `listDir`/`stat`/`readText` to behave like the Host's
 * provider, so a stub returning empty arrays would make every scan test vacuous.
 * Entries mirror the provider contract: `{ name, type, size, target }`.
 */
export function diskFs() {
  const target = (path) => ({ displayPath: path, targetKey: path });
  return {
    resolve: async (path) => target(path),
    listDir: async (node) => readdirSync(node.displayPath, { withFileTypes: true }).map((entry) => {
      const full = join(node.displayPath, entry.name);
      const isDir = entry.isDirectory();
      return {
        name: entry.name,
        type: isDir ? 'directory' : 'file',
        size: isDir ? 0 : statSync(full).size,
        target: target(full),
      };
    }),
    stat: async (node) => {
      const info = statSync(node.displayPath);
      return { type: info.isDirectory() ? 'directory' : 'file', size: info.size };
    },
    readText: async (node) => readFileSync(node.displayPath, 'utf8'),
  };
}

/** Minimal execution context for a tool call. */
export function execContext() {
  return { agent: { session: {} }, signal: new AbortController().signal };
}

/** Shape-check one gap object from a refine result. */
export function isGap(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.id === 'string' && value.id !== ''
    && typeof value.label === 'string' && value.label !== ''
    && typeof value.question === 'string' && value.question !== ''
    && typeof value.suggestion === 'string' && value.suggestion !== '';
}
