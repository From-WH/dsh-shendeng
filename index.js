/**
 * 神灯 (Shen Deng) — Host half.
 *
 * The plugin's main surface is the enhance button beside the composer: the
 * user writes a prompt, presses the lamp, and the text is rewritten into a
 * complete instruction that already knows the workspace (so "that project"
 * becomes a real directory name) and is written straight back into the input.
 *
 * Three tools back that:
 *   `lamp_rewrite` — rewrite a prompt through the configured model.
 *   `lamp_refine`  — the same six-dimension check, callable directly when the
 *                    model must decide whether to ask or to build.
 *   `lamp_scan`    — bounded workspace structure (tree, file mix, manifests).
 *
 * A short prompt section points the model at `lamp_refine` only when a request
 * is under-specified, so the cost stays near zero on clear requests.
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

/**
 * Services the rewrite path needs but the rest of the lamp does not.
 *
 * They are read with `ctx.get()` rather than declared in `inject`, so a profile
 * without a model adapter still loads the lamp; clicking the lamp there reports
 * the missing service instead of taking the whole plugin down.
 */
const OPTIONAL_SERVICES = ['llm', 'agentDefaultModel'];

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
    // Concrete nouns only. Bare 图/文件/功能/项目 match almost any sentence
    // and then the brief treats a vague wish as if the deliverable was named.
    match: ['网站','网页','页面','插件','脚本','程序','应用','app','cli','命令行','工具','文档','报告','文章','文案','邮件','周报','简历','翻译','translate','email','图片','海报','表格','excel','ppt','幻灯片','视频','封面','接口','api','函数','组件','游戏','机器人','bot','模型','数据库','按钮','动画','原型','demo',
      '.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.go','.rs','.java','.rb','.php','.css','.html','.md','.json','.yml','.yaml','.toml','.sh','.svg','.png','.jpg','.jpeg','.docx','.xlsx','.pptx','.pdf'],
    ask: '最终要拿到什么？一个文件、一个能跑的程序，还是一段文字？',
    suggest: '先定一个可打开、可运行的产物，而不是“一套方案”。',
  },
  {
    id: 'destination',
    label: '落点',
    match: ['放到','保存到','输出到','写在','目录','路径','文件夹','markdown','word','excel','pdf','json','yaml','仓库','项目里','现有','已有','接进','集成','发出去','发到','复制到'],
    ask: '它应该落在哪里？新建文件、改进现有文件，还是只给结论？',
    suggest: '默认在当前工作区新建一个独立目录，不覆盖已有文件。',
    // The one dimension with workspace evidence: naming an existing entry here
    // settles it without the wording ever saying "目录".
    resolve: 'targets',
  },
  {
    id: 'audience',
    label: '受众与语气',
    // "给" alone matches 给我, which names the speaker, not an audience.
    match: ['面向','写给','读者','同事','老板','客户','新人','团队','用户','专业','口语','幽默','正式','简洁','通俗','严肃','好玩','小朋友','面试','答辩'],
    ask: '这是给谁看的？决定用词深度、长度和语气。',
    suggest: '默认按“聪明但不懂这个领域的人”来写，少术语、多例子。',
  },
  {
    id: 'constraints',
    label: '硬约束',
    match: ['必须','不要','只能','不能','限制','字数','长度','版本','技术栈','react','vue','python','node','兼容','风格','配色','无依赖','离线','预算','不加','别加','不超过','不少于','至少','最多','字以内','字以上','字左右','/\\d+\\s*字/','no new dependenc','without new dependenc','do not add'],
    ask: '有什么不能动的前提？技术栈、字数、必须复用的东西。',
    suggest: '默认不加新依赖，复用工作区已有的工具链。',
  },
  {
    id: 'acceptance',
    label: '验收标准',
    // "测试" and "效果" alone fire on complaints ("测试挂了", "效果不好").
    match: ['验收','能跑','跑通','通过','可用','不报错','即可','就算完成','算完成','算做完','就能用','就能看','能看到','打开就能','测试通过','跑测试','测试要过','npm test','must pass','tests pass','node --check'],
    ask: '怎样算做完了？一条能当场验证的判据最有用。',
    suggest: '默认以“打开就能看到结果 / 跑通一次真实输入”为验收。',
  },
  {
    id: 'scope',
    label: '范围',
    // "只" alone matches 只是问. Scope needs a bound, not the character.
    match: ['第一版','mvp','先做','初版','简化','最小','这一版','全量','全部','整个','只做','只改','只写','只动','仅做','仅改','不要改别的','别的不改','不动其他','其他不改','only that','only this','first version','this version'],
    ask: '这一版做到哪算够？全量还是先要一个最小可用版本。',
    suggest: '默认先交一个能端到端跑通的最小版本，再逐步加。',
  },
];

/** Escape one literal phrase for use inside a RegExp. */
function escapePhrase(phrase) {
  return phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * One phrase as a regex source.
 *
 * `/…/` is a caller-supplied pattern. A leading-dot token is a file extension
 * and must not match inside a longer suffix. A Latin word is bounded so "app"
 * does not fire inside "happy" and "word" does not fire inside "password".
 * Chinese phrases stay substrings: there is no word boundary to lean on, so
 * the lists themselves have to be long enough not to be ambiguous.
 */
function phraseToSource(phrase) {
  const trimmed = phrase.trim();
  const wrapped = /^\/(.+)\/([a-z]*)$/i.exec(trimmed);
  if (wrapped !== null) {
    try {
      new RegExp(wrapped[1]);
      return wrapped[1];
    } catch {
      /* a broken pattern is still a literal phrase */
    }
  }
  if (/^\.[a-z0-9]+$/i.test(trimmed)) return `${escapePhrase(trimmed)}(?![a-z0-9])`;
  if (/^[a-z][a-z0-9.+_-]*$/i.test(trimmed)) return `\\b${escapePhrase(trimmed)}\\b`;
  return escapePhrase(trimmed);
}

/**
 * Compile one dimension's `match` list into a matcher.
 *
 * A plain string matches as a literal substring (case-insensitive); `/…/`
 * syntax is accepted as a regular expression for callers that need one.
 */
function compileMatcher(match) {
  if (match instanceof RegExp) return match;
  if (typeof match === 'string') {
    const trimmed = match.trim();
    if (trimmed === '') return null;
    return new RegExp(phraseToSource(trimmed), 'i');
  }
  if (Array.isArray(match)) {
    const phrases = match.filter((item) => typeof item === 'string' && item.trim() !== '');
    if (phrases.length === 0) return null;
    // Phrases only. The old compile step appended a file-extension alternation
    // to every list, which made any wish mentioning "index.js" count as
    // addressing the audience, the scope, everything — extensions belong to
    // whichever dimension explicitly lists them.
    return new RegExp(`(?:${phrases.map(phraseToSource).join('|')})`, 'i');
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

/**
 * Words that ask for a change to something that already exists.
 * Bare "改" matches the noun 改动 ("三个改动"), so that one character is
 * declined when 动 follows it. 修改 and 改一下 still count.
 */
const MODIFY_INTENT = /优化|重构|完善|补充|修复|升级|调整|继续|基于|迭代|更新|删掉|去掉|加上|新增|改进|修改|改一下|改改|改(?!动)|\bfix(?:es|ed|ing)?\b|\brefactor\b|\bupdate\b|\bchange\b/i;

/** Words that ask for something new, which no existing target can satisfy. */
const CREATE_INTENT = /新建|从零|重写|重新做|另起|做一个|写一个|做个|生成|搭一个|来一个|\bcreate\b|\bbuild\b|\bwrite\b/i;

/** A complaint about something that already exists, with no new artifact named. */
const COMPLAINT = /不好|太丑|不行|没反应|挂了|出问题/;

/** Prose tasks. Their defaults are a text, not a new code directory. */
const PROSE = /邮件|周报|文章|文案|简历|翻译|\btranslate\b|\bemail\b/i;

/**
 * A question or an explanation request. Running the six-dimension brief on
 * these turns "为什么测试挂了" into "默认改 src".
 */
function isQuestion(text) {
  const trimmed = text.trim();
  if (trimmed === '') return false;
  if (/是什么意思|什么意思|干嘛的|干吗的|是干嘛|是干吗|只是想问|只是问/.test(trimmed)) return true;
  if (/[?？]\s*$/.test(trimmed) && !/做|写|改|修|加|实现|生成|新建/.test(trimmed)) return true;
  if (/^(?:请问|为什么|为何|怎么|如何|什么是|啥意思|解释一下|看一下|帮我看看这)/.test(trimmed)) {
    return !/做|写一|改一|修一|实现|生成|新建/.test(trimmed);
  }
  return false;
}

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

/**
 * Whether the wish asks to change something existing, to make something new,
 * or is just a question.
 */
export function detectIntent(wishText, scan) {
  const text = typeof wishText === 'string' ? wishText : '';
  if (isQuestion(text)) return 'ask';
  const targets = resolveTargets(text, scan);
  const creates = CREATE_INTENT.test(text);
  const modifies = MODIFY_INTENT.test(text);
  if (creates && !modifies) return 'create';
  if (modifies && !creates) return 'modify';
  if (targets.length > 0 && modifies) return 'modify';
  if (creates) return 'create';
  if (COMPLAINT.test(text)) return 'modify';
  return 'unclear';
}

/**
 * Score the wish against the six dimensions.
 * @param wish - the user's request, close to verbatim.
 * @param scan - workspace scan, or null for a text-only audit.
 */
export function auditWish(wish, scan = null, table = BUILT_IN) {
  const text = typeof wish === 'string' ? wish : '';
  const intent = detectIntent(text, scan);
  const targets = resolveTargets(text, scan);
  if (intent === 'ask') {
    return {
      settled: [],
      gaps: [],
      notes: {},
      vague: [],
      targets,
      intent,
      score: 0,
      total: table.length,
      clear: false,
    };
  }
  const settled = [];
  const gaps = [];
  const notes = {};
  const prose = PROSE.test(text);
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
    if (dimension.id === 'destination' && intent === 'modify') {
      const menu = (scan?.topLevel ?? []).slice(0, 6);
      gap.question = menu.length > 0
        ? `要改的是哪一个？工作区里能对上号的有：${menu.join('、')}`
        : '要改的是哪一个？工作区里没有能对上号的名字。';
      // Do not pick menu[0]. An unnamed "效果不好" would otherwise become "edit src".
      gap.suggestion = '先确认目标，再动手。';
    } else if (prose && dimension.id === 'destination') {
      gap.question = '直接发在对话里，还是写成文件？';
      gap.suggestion = '默认直接给出正文，不新建代码目录。';
    }
    if (prose && dimension.id === 'acceptance') {
      gap.suggestion = '默认读一遍能直接使用，不用跑代码。';
    }
    if (prose && dimension.id === 'constraints') {
      gap.suggestion = '默认沿用原文的长度和术语，不加代码层面的限制。';
    }
    if (prose && dimension.id === 'scope') {
      gap.suggestion = '默认就这一份，不扩展成系列。';
    }
    gaps.push(gap);
  }
  const vague = VAGUE_MARKERS.filter((marker) => text.includes(marker));
  // Audience and scope can take a default without changing the outcome.
  // A missing deliverable, landing place, constraint, or acceptance cannot:
  // those are where a wrong default overwrites what the user already said,
  // or invents a project the user did not ask for.
  const hasArtifact = table.some((dimension) => dimension.id === 'artifact');
  const blocking = gaps.some((gap) => gap.id !== 'audience' && gap.id !== 'scope');
  return {
    settled,
    gaps,
    notes,
    vague,
    targets,
    intent,
    score: settled.length,
    total: table.length,
    clear: vague.length === 0 && !blocking && (!hasArtifact || settled.includes('artifact')),
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
  const said = typeof wish === 'string' ? wish.trim() : '';
  if (audit.intent === 'ask') {
    return `这是提问，不是施工请求。按原话回答，不要补交付物、落点和验收，也不要改工作区。\n原话：${said || '（未填写）'}`;
  }
  const lines = [`目标：${said || '（未填写）'}`];
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
  if (result.intent === 'ask') {
    return [
      '提示词检查：这是提问，不是施工请求。',
      result.brief,
      '下一步：直接回答，不要改工作区，也不要追问交付物。',
    ].join('\n\n');
  }
  const intentLabel = result.intent === 'modify' ? '改现有' : result.intent === 'create' ? '做新的' : '暂未看出';
  const lines = [
    `提示词检查：${result.score}/${result.total} 个维度已说明${result.clear ? '（已足够清晰）' : ''}`,
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
  lines.push('', result.clear
    ? '下一步：目标已经够清楚，按工作说明直接做，不要再追问。标成「文中已说明」的部分保持用户原话。'
    : '下一步：只问上面最影响结果的一两项；其余按建议默认执行。标成「文中已说明」的部分不要改成默认值。');
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
 * reference and re-reads it on every prompt check, so no restart is needed.
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
 * Prompt rewrite
 * ------------------------------------------------------------------ */

/**
 * The instruction handed to the model.
 *
 * It is deliberately narrow: keep the user's intent, fill only what the six
 * dimensions would have asked for, and never add scope the user did not imply.
 * A rewrite that invents requirements is worse than no rewrite, because the
 * user sends it without reading closely.
 */
const REWRITE_SYSTEM = [
  '你是一个提示词增强器。用户会给你一段他自己写的提示词。',
  '你的任务：在不改变原意、不新增范围的前提下，把这段提示词增强成一条更完整、更准确的执行指令。',
  '',
  '规则：',
  '1. 保留用户已经说清楚的一切，包括他指定的文件名、目录、技术栈、数字。不要删。',
  '2. 只补充用户没说、但执行时必须知道的信息：交付物是什么、落在哪里、给谁看、有什么硬约束、怎样算完成、这一版做多大。',
  '3. 无法从提示词推断的信息，不要编造。用一句简短的话点出这个空缺，让用户自己填，例如“（篇幅待定）”。',
  '4. 不要写成邮件、不要寒暄、不要解释你在做什么。只输出改写后的指令本身。',
  '5. 保持用户的语言（中文提示词输出中文）。',
  '6. 长度控制在原提示词的 3 倍以内。宁可短而准，不要长而空。',
  '7. 如果给了工作区信息，就用它来把模糊的指代替换成本名：用户说“那个插件”“这个项目”时，指出具体是哪个目录；用户没说落点时，给出工作区里已有、且最像的两个候选；用户提到文件时，用真实存在的文件名。工作区里没有的，不要编造。',
].join('\n');

/**
 * A compact, factual view of the workspace for the rewrite.
 *
 * This is what makes the difference between "（落点待定）" and "落在 alpha/
 * 目录". It stays small on purpose: a rewrite is a cheap operation and must not
 * drag a whole tree through the model.
 */
function workspaceContext(scan) {
  if (scan === null || scan === undefined || scan.read === false) return '';
  const lines = [`工作区：${scan.root}`];
  if (scan.topLevel.length > 0) lines.push(`顶层条目：${scan.topLevel.slice(0, 20).join('、')}`);
  if (scan.manifests.length > 0) {
    const kinds = [...new Set(scan.manifests.map((m) => m.kind))];
    lines.push(`项目类型：${kinds.join('、')}`);
    lines.push(`清单文件：${scan.manifests.slice(0, 6).map((m) => m.path).join('、')}`);
  }
  if (scan.extensions.length > 0) {
    lines.push(`文件构成：${scan.extensions.slice(0, 5).map((e) => `${e.ext}×${e.count}`).join('，')}`);
  }
  if (scan.tree.length > 0) lines.push(`目录树：\n${scan.tree.slice(0, 30).join('\n')}`);
  return lines.join('\n');
}

/** Assemble one rewrite request. */
function rewriteMessages(draft, context) {
  const body = context === '' ? draft : `${context}\n\n---\n\n用户提示词：\n${draft}`;
  return [
    { role: 'system', content: [{ type: 'text', text: REWRITE_SYSTEM }] },
    { role: 'user', content: [{ type: 'text', text: body }] },
  ];
}

/**
 * Collect a model stream into plain text.
 * @returns the text, or throws on a failed stream.
 */
async function collectStream(stream) {
  let text = '';
  let failure = null;
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text;
    else if (chunk.type === 'finish' && chunk.reason && chunk.reason.kind !== 'stop') failure = chunk.reason;
  }
  if (failure !== null) throw new Error(`模型没有正常结束：${failure.kind}`);
  return text.trim();
}

/**
 * Strip the packaging a model sometimes adds despite the instruction: a
 * leading label, a fenced block, or surrounding quotes.
 */
export function unwrapRewrite(text) {
  let out = typeof text === 'string' ? text.trim() : '';
  const fence = /^```[a-z]*\n([\s\S]*?)\n```$/i.exec(out);
  if (fence !== null) out = fence[1].trim();
  out = out.replace(/^(改写后|优化后|增强后|改写结果|优化结果|增强结果|提示词)[:：]\s*/u, '');
  if (out.length > 1 && /^["「“]/.test(out) && /["」”]$/.test(out)) out = out.slice(1, -1).trim();
  return out;
}

/**
 * Rewrite one draft through the configured model.
 * @returns `{ ok: true, text }` or `{ ok: false, reason }`.
 */
async function rewriteDraft(ctx, draft, context = '') {
  const llm = ctx.get('llm');
  if (llm === undefined || typeof llm.stream !== 'function') {
    return { ok: false, reason: 'no-llm' };
  }
  const selector = ctx.get('agentDefaultModel');
  const selection = selector === undefined || typeof selector.currentSelection !== 'function'
    ? undefined
    : selector.currentSelection();
  if (selection === undefined || typeof selection.provider !== 'string' || typeof selection.model !== 'string') {
    return { ok: false, reason: 'no-model' };
  }
  try {
    const text = await collectStream(llm.stream({
      provider: selection.provider,
      model: selection.model,
      messages: rewriteMessages(draft, context),
    }));
    const cleaned = unwrapRewrite(text);
    if (cleaned === '') return { ok: false, reason: 'empty' };
    return { ok: true, text: cleaned };
  } catch (error) {
    return { ok: false, reason: 'stream-failed', detail: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Wire format between the command and the Client.
 *
 * A command result is plain text, so the rewritten draft travels after this
 * marker. It is a control character sequence a model would never emit, so the
 * Client can split without ambiguity in either language.
 */
const REWRITE_MARK = '\u0000LAMP-REWRITE\u0000';

/**
 * Scan the owning Session's workspace for grounding a rewrite.
 *
 * Bounded and failure-tolerant: a rewrite without workspace context is still
 * useful, so a scan error degrades to the empty string rather than failing the
 * button.
 */
async function rewriteWorkspaceContext(ctx, agent) {
  try {
    if (agent === undefined || agent.session === undefined) return '';
    const root = ctx.workingDirectory.get(agent.session);
    const target = await ctx.fs.resolve(root);
    const scan = await scanWorkspace(ctx, normalizeScanOptions({ depth: 2, max_tree_lines: 24 }), target);
    return workspaceContext(scan);
  } catch {
    return '';
  }
}

/**
 * Run a rewrite on behalf of `/lamp rewrite` and fold the outcome into the
 * one text field a command may return.
 */
async function rewriteForCommand(ctx, draft, agent) {
  const context = await rewriteWorkspaceContext(ctx, agent);
  const result = await rewriteDraft(ctx, draft, context);
  if (!result.ok) return { kind: 'error', text: `${REWRITE_MARK}fail:${result.reason}` };
  return { kind: 'success', text: `${REWRITE_MARK}ok:${result.text}` };
}

/* ------------------------------------------------------------------ *
 * The lamp switch
 * ------------------------------------------------------------------ */

/**
 * Projection over the switch's own durable events.
 *
 * The default is `active: true`: an installed lamp is ready to use, and `/lamp
 * off` is the opt-out rather than `/lamp on` the opt-in.
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
  // Lit by default: the control is an enhance button beside the composer, so an
  // install that starts dark looks broken rather than additive.
  init: () => ({ active: true, running: null }),
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
    description: '打开或关闭神灯（提示词增强）',
    input: { hint: 'on|off' },
    handler: ({ agent, rawInput }) => {
      const input = typeof rawInput === 'string' ? rawInput.trim() : '';
      // `/lamp rewrite <draft>` is the Client's path to the rewrite: commands
      // are the only remote entry a plugin may expose, and this one returns
      // the text the browser writes back into the composer.
      if (/^rewrite\b/i.test(input)) {
        const draft = input.slice('rewrite'.length).trim();
        if (draft === '') return { kind: 'error', text: REWRITE_MARK + 'empty-draft' };
        return rewriteForCommand(ctx, draft, agent);
      }
      const wanted = parseLampArgs(input);
      if (wanted === null) {
        return { kind: 'error', text: '用法：/lamp on、/lamp off 或 /lamp rewrite <提示词>' };
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
            : '神灯已点亮：可以在输入框旁增强提示词。'
          : already
            ? '神灯本来就是灭的。'
            : '神灯已熄灭：增强按钮不再生效，工具仍可手动调用。',
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
      'Read the session workspace as a bounded structure: a short directory tree, the file-extension mix, and excerpts of project manifests. The enhance path uses it to turn vague references into real names; call it yourself when you need the layout before deciding where work belongs.',
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
      'Check a prompt against six dimensions (deliverable, destination, audience, constraints, acceptance, scope) and return what is missing, one recommended default per gap, and a filled instruction. Use it when a request is under-specified and you must decide whether to ask or to build. If intent is "ask", answer the question and do not build. Keep every line marked 文中已说明 as the user said it; apply a default only to a 待定 line.',
    parameters: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: {
          type: 'string',
          description: "The prompt to check, close to verbatim. Do not summarise away the ambiguity you are checking for.",
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
      const wish = typeof args?.prompt === 'string' ? args.prompt : '';
      if (wish.trim() === '') throw new Error('lamp_refine needs a non-empty prompt');

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

  /**
   * The rewrite tool behind the dock button.
   *
   * The Client sends the composer draft and receives rewritten text; it never
   * talks to a model directly, and this tool is the only path that does. A
   * model-facing tool (rather than a hidden remote method) keeps the capability
   * visible to the agent too — the model can rewrite a draft it was handed.
   */
  ctx.tools.register({
    name: 'lamp_rewrite',
    description:
      'Enhance a prompt so it is complete and unambiguous before it is sent: keep everything the user already said, ground vague references in the workspace, fill only what execution genuinely needs (deliverable, destination, audience, constraints, acceptance, scope), and mark what cannot be inferred instead of inventing it. Returns the enhanced text plus which dimensions were still open.',
    parameters: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt to enhance, verbatim as the user wrote it.',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['ok', 'text', 'gaps', 'reason'],
        properties: {
          ok: { type: 'boolean' },
          text: { type: 'string' },
          gaps: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.ok
          ? `Enhanced${value.gaps.length > 0 ? ` (still open: ${value.gaps.join(', ')})` : ''}:\n\n${value.text}`
          : `Enhance unavailable: ${value.reason}`,
      }],
      presentationMeta: (_args, value) => ({ shenDeng: { kind: 'rewrite', ok: value.ok, reason: value.reason, gaps: value.gaps } }),
    },
    async execute(args, exec) {
      const draft = typeof args?.prompt === 'string' ? args.prompt.trim() : '';
      if (draft === '') {
        return { ok: false, text: '', gaps: [], reason: 'empty-draft' };
      }
      // What the six dimensions would still ask; the UI shows this as a hint
      // so the user knows what the rewrite had to leave open.
      const audit = auditWish(draft, null, currentTable());
      const gaps = audit.gaps.map((gap) => gap.label);
      const context = await rewriteWorkspaceContext(ctx, exec?.agent);
      const result = await rewriteDraft(ctx, draft, context);
      if (!result.ok) {
        return { ok: false, text: '', gaps, reason: result.reason };
      }
      return { ok: true, text: result.text, gaps, reason: '' };
    },
  });

  ctx.systemPrompt.section({
    name: 'shen-deng:prompt-enhance',
    order: 860,
    text: (context) => {
      if (ctx.tools.get('lamp_refine', context.scope) === undefined) return '';
      if (!litFromContext(context)) return '';
      return [
        '## 神灯 / prompt enhancement',
        'The user can enhance the composer prompt from the button beside the input; that is the primary path and needs nothing from you. `lamp_refine` is the same six-dimension check available to you directly: use it when a request is under-specified (no clear deliverable, destination, or acceptance) and you must decide whether to ask or to build.',
        'If the result says intent is ask, answer the question and do not build. If it says the request is clear, build from the brief. Otherwise ask only the one or two gaps that change the outcome. Anything marked 文中已说明 stays as the user said it; apply a default only to a 待定 line, and say which default you used. Do not offer a separate "prompt check" ceremony — the button already does that job.',
      ].join('\n\n');
    },
  });
}
