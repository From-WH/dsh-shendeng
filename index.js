/**
 * 神灯 (Shen Deng) — Host half.
 *
 * A wish is a target. The lamp reads the workspace, then tells the model how far
 * the user's wish is from a buildable specification: which dimensions are
 * already settled, which are still blank, and what a sensible default is for
 * each blank one. It never invents a requirement; it exposes the missing ones.
 *
 * Two tools:
 *   `lamp_scan`   — bounded workspace structure (tree, file mix, manifests).
 *   `lamp_refine` — the same scan plus a six-dimension wish audit, a filled
 *                   brief, and one recommended default per open dimension.
 *
 * A short prompt section points the model here only when a request is
 * under-specified, so the cost stays near zero on clear requests.
 *
 * The lamp also has a per-Session switch (`/lamp on|off`). Its state is a
 * projection over the command events the framework already logs, so the switch
 * survives a reload without this plugin inventing an event type, and the model
 * and the UI read the same truth.
 */

import z from './vendor/schemastery.mjs';
import { lampState, lampView, usageState, usageView } from './schema.js';

/** Services this plugin cannot work without. */
export const inject = [
  'tools',
  'fs',
  'systemPrompt',
  'workingDirectory',
  'commands',
  'sessionProjections',
];

const SWITCH_COMMAND = 'lamp';

const SKIP_NAMES = new Set([
  'node_modules', '.git', '.hg', '.svn', '.DS_Store', 'dist', 'build', 'out',
  'target', 'vendor', 'coverage', '__pycache__', '.venv', 'venv', '.next',
  '.nuxt', '.svelte-kit', '.turbo', '.cache', '.gradle', '.idea', '.vscode',
  'Pods', 'DerivedData', '.pnpm-store', '.yarn', 'tmp', 'temp', '.tmp',
]);

const MANIFESTS = new Map([
  ['package.json', 'node'],
  ['tsconfig.json', 'typescript'],
  ['pnpm-workspace.yaml', 'workspace'],
  ['pyproject.toml', 'python'],
  ['requirements.txt', 'python'],
  ['setup.py', 'python'],
  ['Cargo.toml', 'rust'],
  ['go.mod', 'go'],
  ['pom.xml', 'java'],
  ['build.gradle', 'java'],
  ['Gemfile', 'ruby'],
  ['composer.json', 'php'],
  ['Dockerfile', 'docker'],
  ['docker-compose.yml', 'docker'],
  ['cordis.patch.yml', 'dsh-bundle'],
  ['README.md', 'readme'],
  ['README.zh.md', 'readme'],
  ['AGENTS.md', 'agent-instructions'],
  ['CLAUDE.md', 'agent-instructions'],
]);

const TEXT_EXTS = new Set([
  '.md', '.txt', '.json', '.yml', '.yaml', '.toml', '.js', '.mjs', '.cjs',
  '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.rb', '.php', '.css',
  '.html', '.sh',
]);

/** One scan request, after defaults and bounds. */
function normalizeScanOptions(input) {
  const depth = clampInt(input.depth, 1, 6, 3);
  const maxTreeLines = clampInt(input.max_tree_lines, 10, 200, 60);
  return { depth, maxTreeLines };
}

function clampInt(value, min, max, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function extensionOf(name) {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '(none)';
  return name.slice(dot).toLowerCase();
}

/**
 * Walk one directory tree depth-first with hard caps, collecting a display
 * tree, the extension mix, and the manifests that describe the project.
 * Directories are visited before files at each level so a repository's shape
 * reads top-down rather than as a list of loose files.
 */
async function scanWorkspace(ctx, options, rootTarget) {
  const root = rootTarget.displayPath;
  const visited = new Set();
  const treeLines = [];
  const manifests = [];
  const extensions = new Map();
  let files = 0;
  let directories = 0;
  let truncated = false;
  const topLevel = [];

  const walk = async (target, depth, prefix, relPath) => {
    if (visited.has(target.targetKey)) return;
    visited.add(target.targetKey);

    let entries;
    try {
      entries = await ctx.fs.listDir(target);
    } catch {
      return;
    }
    const shown = entries
      .filter((entry) => !SKIP_NAMES.has(entry.name))
      .sort((left, right) => {
        const leftDir = left.type === 'directory' ? 0 : 1;
        const rightDir = right.type === 'directory' ? 0 : 1;
        return leftDir - rightDir || left.name.localeCompare(right.name);
      });

    for (const entry of shown) {
      if (depth === 0) topLevel.push(entry.name);
      const isDirectory = entry.type === 'directory';
      const line = `${prefix}${entry.name}${isDirectory ? '/' : ''}`;
      if (treeLines.length < options.maxTreeLines) treeLines.push(line);
      else truncated = true;

      if (isDirectory) {
        directories += 1;
        if (depth + 1 < options.depth) await walk(entry.target, depth + 1, `${prefix}  `, `${relPath}${entry.name}/`);
        continue;
      }
      if (entry.type !== 'file') continue;
      files += 1;
      const ext = extensionOf(entry.name);
      extensions.set(ext, (extensions.get(ext) ?? 0) + 1);
      const kind = MANIFESTS.get(entry.name);
      if (kind !== undefined && manifests.length < 8 && (entry.size ?? 0) <= 200_000) {
        manifests.push({ path: `${relPath}${entry.name}`, kind, excerpt: await readExcerpt(ctx, entry.target) });
      }
    }
  };

  await walk(rootTarget, 0, '', '');

  const ranked = [...extensions.entries()]
    .filter(([ext]) => ext !== '(none)')
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([ext, count]) => ({ ext, count }));

  return {
    read: true,
    root,
    files,
    directories,
    topLevel,
    extensions: ranked,
    manifests,
    tree: treeLines,
    truncated,
  };
}

async function readExcerpt(ctx, target) {
  try {
    const info = await ctx.fs.stat(target);
    if (info === undefined || info.type !== 'file' || (info.size ?? 0) > 200_000) return '';
    const text = await ctx.fs.readText(target);
    return text.length > 700 ? `${text.slice(0, 700)}…` : text;
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ *
 * Wish audit
 * ------------------------------------------------------------------ */

/**
 * The built-in six dimensions.
 *
 * A deployment can replace this whole list through the plugin's `config.dimensions`,
 * but the defaults are the thing the lamp is *for*: deliverable, destination,
 * audience, constraints, acceptance, scope. Every entry needs an `id`, a
 * `label`, an `ask` (the question the user sees), a `suggest` (the default the
 * model may apply without asking), and a `match` (a list of phrases that mean
 * this dimension was already addressed).
 */
const DEFAULT_DIMENSIONS = [
  {
    id: 'artifact',
    label: '交付物',
    match: ['网站','网页','页面','插件','脚本','程序','应用','app','cli','命令行','工具','文档','报告','文章','文案','图片','海报','图','表格','excel','ppt','幻灯片','视频','封面','接口','api','函数','组件','游戏','机器人','bot','模型','数据库','配置','主题','按钮','动画','原型','demo','项目','系统','功能','文件','这行','这一行','函数名','变量',
      '.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.go','.rs','.java','.rb','.php','.css','.html','.md','.json','.yml','.yaml','.toml','.sh','.svg','.png','.jpg','.jpeg','.docx','.xlsx','.pptx','.pdf'],
    ask: '最终要拿到什么？一个文件、一个能跑的程序，还是一段文字？',
    suggest: '先定一个可打开、可运行的产物，而不是“一套方案”。',
  },
  {
    id: 'destination',
    label: '落点',
    match: ['放到','保存到','输出到','写在','目录','路径','文件夹','markdown','word','excel','pdf','json','yaml','仓库','项目里','现有','已有','接进','集成'],
    ask: '它应该落在哪里？新建文件、改进现有文件，还是只给结论？',
    suggest: '默认在当前工作区新建一个独立目录，不覆盖已有文件。',
    // The one dimension with workspace evidence: naming an existing entry here
    // settles it without the wording ever saying "目录".
    resolve: 'targets',
  },
  {
    id: 'audience',
    label: '受众与语气',
    match: ['给','面向','用户','读者','同事','老板','客户','新人','团队','专业','口语','幽默','正式','简洁','通俗','严肃','好玩','小朋友','面试','答辩'],
    ask: '这是给谁看的？决定用词深度、长度和语气。',
    suggest: '默认按“聪明但不懂这个领域的人”来写，少术语、多例子。',
  },
  {
    id: 'constraints',
    label: '硬约束',
    match: ['必须','不要','只能','限制','字数','长度','版本','技术栈','react','vue','python','node','不能','兼容','风格','颜色','配色','无依赖','离线','预算'],
    ask: '有什么不能动的前提？技术栈、字数、必须复用的东西。',
    suggest: '默认不加新依赖，复用工作区已有的工具链。',
  },
  {
    id: 'acceptance',
    label: '验收标准',
    match: ['成功','验收','测试','能跑','可用','通过','准确','覆盖','效果','标准','检查','保证','不报错','完美','满意'],
    ask: '怎样算做完了？一条能当场验证的判据最有用。',
    suggest: '默认以“打开就能看到结果 / 跑通一次真实输入”为验收。',
  },
  {
    id: 'scope',
    label: '范围',
    match: ['全部','整个','所有','只','仅','部分','第一版','mvp','先做','初版','简化','完整','每一步','细节','框架','维度','每次'],
    ask: '这一版做到哪算够？全量还是先要一个最小可用版本。',
    suggest: '默认先交一个能端到端跑通的最小版本，再逐步加。',
  },
];

/** Escape one literal phrase for use inside a RegExp. */
function escapePhrase(phrase) {
  return phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile one dimension's `match` list into a matcher.
 *
 * A plain string matches as a literal substring (case-insensitive); `/…/`
 * syntax is accepted as a regular expression for callers that need one. File
 * extensions are matched literally, which is why `match` lists spell them
 * without the backslash the old hand-written regexes needed.
 */
function compileMatcher(match) {
  if (match instanceof RegExp) return match;
  if (typeof match === 'string') {
    const trimmed = match.trim();
    const literal = /^\/(.+)\/([a-z]*)$/i.exec(trimmed);
    if (literal !== null) {
      try {
        return new RegExp(literal[1], literal[2]);
      } catch {
        /* fall through to a literal match */
      }
    }
    if (trimmed === '') return null;
    return new RegExp(escapePhrase(trimmed), 'i');
  }
  if (Array.isArray(match)) {
    const phrases = match.filter((item) => typeof item === 'string' && item.trim() !== '');
    if (phrases.length === 0) return null;
    // Phrases only. The old compile step appended a file-extension alternation
    // to every list, which made any wish mentioning "index.js" count as
    // addressing the audience, the scope, everything — extensions belong to
    // whichever dimension explicitly lists them.
    return new RegExp(`(?:${phrases.map(escapePhrase).join('|')})`, 'i');
  }
  return null;
}

/**
 * Validate and normalize `config.dimensions`.
 *
 * Returns the compiled dimension table the audit walks. An unknown or empty
 * list falls back to the built-in six rather than leaving the lamp with
 * nothing to check.
 */
function resolveDimensions(configured) {
  const source = Array.isArray(configured) && configured.length > 0 ? configured : DEFAULT_DIMENSIONS;
  const seen = new Set();
  const resolved = [];
  for (const [index, entry] of source.entries()) {
    if (entry === null || typeof entry !== 'object') continue;
    const id = typeof entry.id === 'string' && entry.id.trim() !== '' ? entry.id.trim() : null;
    if (id === null || seen.has(id)) continue;
    const test = compileMatcher(entry.match);
    if (test === null) continue;
    seen.add(id);
    resolved.push({
      id,
      label: typeof entry.label === 'string' && entry.label.trim() !== '' ? entry.label : id,
      test,
      question: typeof entry.ask === 'string' && entry.ask.trim() !== '' ? entry.ask : `关于「${id}」，还有什么要说明的？`,
      suggestion: typeof entry.suggest === 'string' && entry.suggest.trim() !== '' ? entry.suggest : '先按最小可用版本处理。',
      resolve: entry.resolve === 'targets' ? 'targets' : undefined,
      order: index,
    });
  }
  return resolved.length > 0 ? resolved : resolveDimensions(DEFAULT_DIMENSIONS);
}

/** The built-in table, compiled once, for direct importers of the pure helpers. */
const BUILT_IN = resolveDimensions(undefined);

const VAGUE_MARKERS = [
  '随便', '大概', '差不多', '看着办', '你懂的', '优化一下', '弄一下', '搞一下',
  '做好看', '高级感', '大气', '有质感', '丰富一点', '多来点', '整一个', '帮我弄',
  '更好用', '更好', '改一下', '改改',
];

/** Words that ask for a change to something that already exists. */
const MODIFY_INTENT = /(改|优化|重构|完善|补充|修复|升级|调整|继续|基于|迭代|更新|删掉|去掉|加上|新增)/;

/** Words that ask for something new, which no existing target can satisfy. */
const CREATE_INTENT = /(新建|从零|重写|重新做|另起|做一个|写一个|生成|搭一个|来一个)/;

/**
 * Existing workspace entries the wish names outright. A user who writes
 * "shen-deng 这个插件" has already answered the destination question; the lamp
 * must not answer it back with "create a new directory".
 */
function resolveTargets(text, scan) {
  if (scan === null || scan === undefined) return [];
  // Exported helpers are called with whatever a caller has; never assume a string.
  const haystack = typeof text === 'string' ? text.toLowerCase() : '';
  const candidates = new Set();
  for (const name of scan.topLevel ?? []) candidates.add(name);
  for (const manifest of scan.manifests ?? []) {
    const parts = manifest.path.split('/');
    if (parts.length > 0) candidates.add(parts[0]);
  }
  const hits = [];
  for (const candidate of candidates) {
    if (candidate.length < 2) continue;
    if (haystack.includes(candidate.toLowerCase())) hits.push(candidate);
  }
  return hits.sort((left, right) => right.length - left.length);
}

/** Whether the wish asks to change something existing, or to make something new. */
export function detectIntent(wishText, scan) {
  const text = typeof wishText === 'string' ? wishText : '';
  const targets = resolveTargets(text, scan);
  const creates = CREATE_INTENT.test(text);
  const modifies = MODIFY_INTENT.test(text);
  if (creates && !modifies) return 'create';
  if (modifies && !creates) return 'modify';
  if (targets.length > 0 && modifies) return 'modify';
  if (creates) return 'create';
  return 'unclear';
}

/**
 * Score the wish against the six dimensions.
 * @param wish - the user's request, close to verbatim.
 * @param scan - workspace scan, or null for a text-only audit.
 */
export function auditWish(wish, scan = null, table = BUILT_IN) {
  const text = typeof wish === 'string' ? wish : '';
  const settled = [];
  const gaps = [];
  const notes = {};
  for (const dimension of table) {
    const worded = dimension.test.test(text);
    const evidence = dimensionEvidence(dimension, text, scan);
    if (worded || evidence !== null) {
      settled.push(dimension.id);
      if (evidence !== null) notes[dimension.id] = evidence.note;
      continue;
    }
    const gap = {
      id: dimension.id,
      label: dimension.label,
      question: dimension.question,
      suggestion: dimension.suggestion,
    };
    // A change request with no recognisable target is the most expensive gap:
    // say so instead of offering the create-something-new default.
    if (dimension.id === 'destination' && detectIntent(text, scan) === 'modify') {
      const menu = (scan?.topLevel ?? []).slice(0, 6);
      gap.question = menu.length > 0
        ? `要改的是哪一个？工作区里能对上号的有：${menu.join('、')}`
        : '要改的是哪一个？工作区里没有能对上号的名字。';
      gap.suggestion = menu.length > 0 ? `默认改 ${menu[0]}。` : '先确认目标，再动手。';
    }
    gaps.push(gap);
  }
  const vague = VAGUE_MARKERS.filter((marker) => text.includes(marker));
  return {
    settled,
    gaps,
    notes,
    vague,
    targets: resolveTargets(text, scan),
    intent: detectIntent(text, scan),
    score: settled.length,
    total: table.length,
    clear: gaps.length === 0 && vague.length === 0,
  };
}

/**
 * Workspace evidence that settles a dimension without the wish naming it.
 *
 * Only the built-in destination dimension uses this: naming an existing
 * directory answers "where", even when the wish never says "directory".
 */
function dimensionEvidence(dimension, text, scan) {
  if (dimension.resolve !== 'targets') return null;
  const targets = resolveTargets(text, scan);
  if (targets.length === 0) return null;
  const shown = targets.slice(0, 4).join('、');
  return {
    note: `指名了工作区已有目标：${shown}`,
    suggestion: `默认改进 ${shown}，原地修改，不动其他文件。`,
  };
}

/** Build the filled brief: the wish, then one line per dimension with defaults. */
export function buildBrief(wish, audit, scan, table = BUILT_IN) {
  const lines = [`目标：${wish.trim() || '（未填写）'}`];
  const gapsById = new Map(audit.gaps.map((gap) => [gap.id, gap]));
  for (const dimension of table) {
    if (audit.settled.includes(dimension.id)) {
      const note = audit.notes?.[dimension.id];
      lines.push(`${dimension.label}：${note ?? '文中已说明'}`);
      continue;
    }
    const gap = gapsById.get(dimension.id);
    lines.push(`${dimension.label}：（待定）建议 ${(gap?.suggestion ?? dimension.suggestion).replace(/^默认/, '')}`);
  }
  if (scan.read === false) {
    lines.push('工作区依据：本次未读取工作区（纯文本体检）。');
    return lines.join('\n');
  }
  const stack = [...new Set(scan.manifests.map((manifest) => manifest.kind).filter((kind) => kind !== 'readme'))];
  const facts = [
    `工作区：${scan.root}（${scan.files} 个文件 / ${scan.directories} 个目录）`,
    stack.length > 0 ? `已有技术线索：${stack.join('、')}` : '没有识别到项目清单，按纯文本工作区处理',
    scan.extensions.length > 0 ? `文件构成：${scan.extensions.map((item) => `${item.ext}×${item.count}`).join('，')}` : '目录基本为空',
  ];
  if (audit.targets.length > 0) facts.push(`命中已有目标：${audit.targets.join('、')}`);
  lines.push('工作区依据：', ...facts.map((fact) => `- ${fact}`));
  return lines.join('\n');
}

function scanFacts(scan) {
  if (scan.read === false) return ['本次未读取工作区（纯文本体检）'];
  const stack = [...new Set(scan.manifests.map((manifest) => manifest.kind).filter((kind) => kind !== 'readme' && kind !== 'agent-instructions'))];
  const facts = [
    `${scan.files} 个文件 / ${scan.directories} 个目录`,
    stack.length > 0 ? `识别到：${stack.join('、')}` : '未识别到项目清单',
  ];
  if (scan.extensions.length > 0) facts.push(`主要是 ${scan.extensions.slice(0, 3).map((item) => item.ext).join(' / ')}`);
  if (scan.manifests.some((manifest) => manifest.kind === 'readme')) facts.push('已有 README');
  return facts;
}

/** Compact, model-facing text for one refine result. */
function renderRefineText(result) {
  const intentLabel = result.intent === 'modify' ? '改现有' : result.intent === 'create' ? '做新的' : '暂未看出';
  const lines = [
    `许愿体检：${result.score}/${result.total} 个维度已说明${result.clear ? '（已足够清晰）' : ''}`,
    `意图：${intentLabel}${result.targets.length > 0 ? `；工作区命中：${result.targets.join('、')}` : ''}`,
  ];
  if (result.gaps.length > 0) {
    lines.push('', '还缺：');
    for (const gap of result.gaps) lines.push(`- ${gap.label}：${gap.question} 建议 ${gap.suggestion}`);
  }
  if (result.vague.length > 0) {
    lines.push('', `模糊表述：${result.vague.join('、')} —— 这些词没有可执行的含义，需要换成具体名词或数字。`);
  }
  lines.push('', '可直接使用的工作说明：', result.brief);
  lines.push('', '下一步：只问上面最影响结果的一两项；其余按建议默认执行，并在回答里说明默认了什么。');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

/**
 * Plugin configuration, as a Standard Schema.
 *
 * Cordis only requires `'~standard'.validate()` on `Config`; it does not
 * require Schemastery. Since a linked bundle cannot resolve the profile's
 * `@deepseek-ai/schemastery`, this object implements that one interface and
 * keeps the bundle dependency-free — the same reason `schema.js` carries its
 * own validators.
 */
/**
 * Plugin configuration as a real Schemastery schema, vendored because a linked
 * bundle cannot resolve the profile's `@deepseek-ai/schemastery`.
 *
 * `dimensions` is `.volatile()`: the Settings UI lists it, edits persist
 * through the profile patch, and they apply in place — `apply` keeps the field
 * reference and re-reads it on every wish check, so no restart is needed.
 */
export const Config = z.object({
  dimensions: z.array(z.object({
    id: z.string().required().description('唯一标识，同名去重'),
    label: z.string().description('显示名；缺省用 id'),
    match: z.array(z.string()).required().description('短语列表；/…/ 形式按正则处理'),
    ask: z.string().description('向用户提出的问题'),
    suggest: z.string().description('模型可直接采用的默认'),
    resolve: z.string().description("写 'targets' 启用工作区指代识别"),
  })).volatile().description('体检维度表；整体替换内置六维'),
});
/* ------------------------------------------------------------------ *
 * The lamp switch/* ------------------------------------------------------------------ *
 * The lamp switch
 * ------------------------------------------------------------------ */

/**
 * Projection over the switch's own durable events.
 *
 * It appends no event of its own: `/lamp` already logs `command/run` (with the
 * selection) and `command/done` (with the outcome), both of which every reader
 * of a Session understands. A new event type would have to be `ignorable`, and
 * a live `append()` cannot set that marker, so the Session would refuse to
 * reopen. Deriving from events the framework already writes keeps the switch
 * durable, replayable, and harmless to older readers.
 *
 * The fold is: a successful `/lamp` command commits the state it named; a
 * failed one changes nothing; the run in flight is tracked so the UI can show
 * the selection before it lands.
 */
const lampProjection = {
  key: 'shenDeng',
  stateVersion: 1,
  stateSchema: lampState,
  init: () => ({ active: false, running: null }),
  apply: (state, event) => {
    if (event.type === 'command/run' && event.data.name === SWITCH_COMMAND) {
      const wanted = parseLampArgs(event.data.args ?? '');
      // An unrecognised spelling is rejected by the handler; record no intent
      // so a later successful command is the only thing that moves the switch.
      if (wanted === null) return state;
      return { ...state, running: { commandId: event.data.commandId, wanted } };
    }
    if (event.type === 'command/done' && event.data.commandId === state.running?.commandId) {
      if (event.data.kind !== 'success') return { ...state, running: null };
      return { active: state.running.wanted, running: null };
    }
    return state;
  },
  wire: {
    viewSchema: lampView,
    view: (state) => ({
      active: state.active,
      pending: state.running !== null && state.running.wanted !== state.active,
    }),
  },
};

/**
 * Parse `/lamp` input.
 *
 * `on`/`off` (and bare `/lamp`, which means on) are the accepted spellings.
 * Anything else is refused rather than silently treated as "on": a typo should
 * not quietly change the lamp's behaviour.
 * @returns `true` to light, `false` to put out, or `null` for unrecognised input.
 */
function parseLampArgs(rawInput) {
  const input = typeof rawInput === 'string' ? rawInput.trim().toLowerCase() : '';
  if (input === '' || input === 'on') return true;
  if (input === 'off') return false;
  return null;
}

/* ------------------------------------------------------------------ *
 * Usage counters
 * ------------------------------------------------------------------ */

/**
 * Counts what the lamp actually did in this Session, folded from the
 * `tool/result` events that carry its metadata.
 *
 * It deliberately does not report a token saving. The saving would be "tokens
 * a rework would have burned", which is a counterfactual with no measurement;
 * these three numbers are facts read straight out of the log.
 */
const usageProjection = {
  key: 'shenDengUsage',
  stateVersion: 1,
  stateSchema: usageState,
  init: () => ({ checks: 0, gaps: 0, vague: 0, scans: 0 }),
  apply: (state, event) => {
    if (event.type !== 'tool/result') return state;
    const meta = event.data.meta;
    if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) return state;
    const lamp = meta.shenDeng;
    if (lamp === null || typeof lamp !== 'object') return state;
    if (lamp.kind === 'scan') return { ...state, scans: state.scans + 1 };
    if (lamp.kind === 'refine') {
      const gaps = Array.isArray(lamp.gaps) ? lamp.gaps.length : 0;
      const vague = Array.isArray(lamp.vague) ? lamp.vague.length : 0;
      return {
        ...state,
        checks: state.checks + 1,
        gaps: state.gaps + gaps,
        vague: state.vague + vague,
      };
    }
    return state;
  },
  wire: {
    // Only the two numbers the dock shows travel to the client.
    viewSchema: usageView,
    view: (state) => ({ checks: state.checks, gaps: state.gaps }),
  },
};

/* ------------------------------------------------------------------ *
 * Plugin
 * ------------------------------------------------------------------ */

/**
 * Register the lamp's tools and its prompt section.
 * @param ctx - the plugin context (tools, fs, systemPrompt, workingDirectory).
 */
export async function apply(ctx, config) {
  // dimensions is volatile: the field arrives as a live reference when the
  // Settings service is mounted (plain value otherwise). Read it per wish
  // check so GUI edits apply without a restart.
  const dimsRef = config?.dimensions;
  const currentTable = () => {
    const raw = dimsRef !== undefined && dimsRef !== null && typeof dimsRef.get === 'function'
      ? dimsRef.get()
      : dimsRef;
    return resolveDimensions(raw);
  };

  // Awaiting registration makes `stateOf` a synchronous read for every caller
  // below; a later projection change reaches the client, never this closure.
  const lamp = await ctx.sessionProjections.register(lampProjection);
  // The counters are independent: a Session can have usage with the switch off.
  await ctx.sessionProjections.register(usageProjection);

  /** Whether the lamp is lit for one Session. */
  const isLit = (session) => lamp.stateOf(session).active;

  ctx.commands.register({
    definitionId: 'shen-deng:lamp',
    name: SWITCH_COMMAND,
    description: '打开或关闭神灯（许愿体检）',
    input: { hint: 'on|off' },
    handler: ({ agent, rawInput }) => {
      const wanted = parseLampArgs(rawInput);
      if (wanted === null) {
        return { kind: 'error', text: '用法：/lamp on 或 /lamp off' };
      }
      // The projection commits this command's outcome on `command/done`, which
      // the framework appends right after this handler returns. Reporting the
      // resulting state here keeps the text and the switch in agreement.
      const already = isLit(agent.session) === wanted;
      return {
        kind: 'success',
        text: wanted
          ? already
            ? '神灯已经点亮。'
            : '神灯已点亮：需求不明确时，我会先做一次许愿体检。'
          : already
            ? '神灯本来就是灭的。'
            : '神灯已熄灭：我不再主动做许愿体检，工具仍可手动调用。',
      };
    },
  });

  /** The switch state an assembly should see, from its agent scope. */
  const litFromContext = (context) => {
    const session = context?.agent?.session;
    if (session === undefined) return false;
    try {
      return isLit(session);
    } catch {
      return false;
    }
  };

  ctx.tools.register({
    name: 'lamp_scan',
    description:
      'Read the session workspace as a bounded structure: a short directory tree, the file-extension mix, and excerpts of project manifests. Use it when you need the layout before deciding where work belongs.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory to scan. Defaults to the session working directory; relative paths resolve against it.',
        },
        depth: {
          type: 'integer',
          description: 'Directory levels to descend, 1-6. Defaults to 3.',
        },
        max_tree_lines: {
          type: 'integer',
          description: 'Maximum tree lines to return, 10-200. Defaults to 60.',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['root', 'files', 'directories', 'tree', 'extensions', 'manifests', 'truncated'],
        properties: {
          root: { type: 'string' },
          files: { type: 'integer' },
          directories: { type: 'integer' },
          tree: { type: 'array', items: { type: 'string' } },
          extensions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['ext', 'count'],
              properties: {
                ext: { type: 'string' },
                count: { type: 'integer' },
              },
            },
          },
          manifests: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['path', 'kind', 'excerpt'],
              properties: {
                path: { type: 'string' },
                kind: { type: 'string' },
                excerpt: { type: 'string' },
              },
            },
          },
          truncated: { type: 'boolean' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `Workspace: ${value.root} — ${value.files} files / ${value.directories} directories${value.truncated ? ' (truncated)' : ''}`,
          '',
          ...value.tree,
          '',
          value.extensions.length > 0
            ? `File mix: ${value.extensions.map((item) => `${item.ext}×${item.count}`).join(', ')}`
            : 'No files with extensions.',
          ...(value.manifests.length > 0
            ? ['', 'Manifests:', ...value.manifests.map((manifest) => `- ${manifest.path} (${manifest.kind})`)]
            : []),
        ].join('\n'),
      }],
      presentationMeta: (_args, value) => ({ shenDeng: {
        kind: 'scan',
        root: value.root,
        files: value.files,
        directories: value.directories,
        tree: value.tree.slice(0, 80),
        extensions: value.extensions,
        manifests: value.manifests.map((manifest) => ({ path: manifest.path, kind: manifest.kind })),
        truncated: value.truncated,
      } }),
    },
    async execute(args, exec) {
      if (exec.agent === undefined) throw new Error('lamp_scan needs an owning agent session');
      const options = normalizeScanOptions(args ?? {});
      const cwd = ctx.workingDirectory.get(exec.agent.session);
      const requested = typeof args?.path === 'string' && args.path.trim() !== '' ? args.path : cwd;
      const target = await ctx.fs.resolve(requested, { cwd });
      // Scan the resolved target by re-rooting the walk on it.
      const scan = await scanWorkspace(ctx, options, target);
      return {
        root: scan.root,
        files: scan.files,
        directories: scan.directories,
        tree: scan.tree,
        extensions: scan.extensions,
        manifests: scan.manifests,
        truncated: scan.truncated,
      };
    },
  });

  ctx.tools.register({
    name: 'lamp_refine',
    description:
      'Turn a wish into a buildable brief. Reads the workspace, checks the wish against six dimensions (deliverable, destination, audience, constraints, acceptance, scope), and returns the gaps, one recommended default per gap, and a filled brief. Use it before building on an under-specified request, then ask only the gaps that change the outcome.',
    parameters: {
      type: 'object',
      required: ['wish'],
      properties: {
        wish: {
          type: 'string',
          description: "The user's request, close to verbatim. Do not summarise away the ambiguity you are checking for.",
        },
        path: {
          type: 'string',
          description: 'Directory the brief should be reasoned about. Defaults to the session working directory.',
        },
        include_workspace: {
          type: 'boolean',
          description: 'Whether to read the workspace first. Defaults to true; pass false for a pure text audit.',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['score', 'total', 'clear', 'intent', 'targets', 'gaps', 'vague', 'brief', 'facts'],
        properties: {
          score: { type: 'integer' },
          total: { type: 'integer' },
          clear: { type: 'boolean' },
          intent: { type: 'string' },
          targets: { type: 'array', items: { type: 'string' } },
          gaps: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'label', 'question', 'suggestion'],
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                question: { type: 'string' },
                suggestion: { type: 'string' },
              },
            },
          },
          vague: { type: 'array', items: { type: 'string' } },
          brief: { type: 'string' },
          facts: { type: 'array', items: { type: 'string' } },
        },
      },
      render: (_args, value) => [{ type: 'text', text: renderRefineText(value) }],
      presentationMeta: (_args, value) => ({ shenDeng: {
        kind: 'refine',
        score: value.score,
        total: value.total,
        clear: value.clear,
        intent: value.intent,
        targets: value.targets,
        gaps: value.gaps,
        vague: value.vague,
        brief: value.brief,
        facts: value.facts,
      } }),
    },
    async execute(args, exec) {
      if (exec.agent === undefined) throw new Error('lamp_refine needs an owning agent session');
      const wish = typeof args?.wish === 'string' ? args.wish : '';
      if (wish.trim() === '') throw new Error('lamp_refine needs a non-empty wish');

      let scan = null;
      if (args?.include_workspace !== false) {
        const cwd = ctx.workingDirectory.get(exec.agent.session);
        const requested = typeof args?.path === 'string' && args.path.trim() !== '' ? args.path : cwd;
        const target = await ctx.fs.resolve(requested, { cwd });
        scan = await scanWorkspace(ctx, normalizeScanOptions({ depth: 3, max_tree_lines: 40 }), target);
      }
      const emptyScan = { read: false, root: '', files: 0, directories: 0, topLevel: [], extensions: [], manifests: [], tree: [], truncated: false };
      const effectiveScan = scan ?? emptyScan;
      const audit = auditWish(wish, scan, currentTable());
      return {
        score: audit.score,
        total: audit.total,
        clear: audit.clear,
        intent: audit.intent,
        targets: audit.targets,
        gaps: audit.gaps,
        vague: audit.vague,
        brief: buildBrief(wish, audit, effectiveScan, currentTable()),
        facts: scanFacts(effectiveScan),
      };
    },
  });

  ctx.systemPrompt.section({
    name: 'shen-deng:wish-check',
    order: 860,
    text: (context) => {
      if (ctx.tools.get('lamp_refine', context.scope) === undefined) return '';
      if (!litFromContext(context)) return '';
      return [
        '## 神灯 / wish check',
        'A wish is a target; without one there is nothing to aim at. When a request is under-specified (no clear deliverable, destination, or acceptance), call `lamp_refine` with the request close to verbatim before you build. It returns the missing dimensions, a default for each, and a filled brief that already knows the workspace.',
        'Ask the user only the one or two gaps that change the outcome, and state the defaults you applied for the rest instead of asking about them. Skip the lamp when the request is already specific.',
      ].join('\n\n');
    },
  });
}
