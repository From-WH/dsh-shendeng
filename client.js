/**
 * 神灯 (Shen Deng) — Client half.
 *
 * Renders the two lamp tools in the Chat flow:
 *   `lamp_refine` — the prompt check: six dimensions, which are settled, which
 *                    are still blank, and the default offered for each blank one.
 *   `lamp_scan`   — the workspace read: tree, file mix, manifests.
 *
 * Both rows are driven by the result metadata the Host writes
 * (`meta.shenDeng`), so the card never re-parses model-facing prose.
 */
window.__ModuleLoader__.load({
  id: 'dsh-shendeng',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'shenDeng';

    const DICTS = {
      zh: {
        lamp: '神灯 · 提示词增强',
        refineTitle: '提示词检查',
        scanTitle: '工作区结构',
        noWish: '（空的提示词）',
        settled: '已说明',
        gapHeading: '还缺什么',
        vagueHeading: '这些词不算信息',
        briefHeading: '可直接使用的工作说明',
        factsHeading: '工作区依据',
        clearTitle: '目标已经足够清晰',
        intentModify: '改现有',
        intentCreate: '做新的',
        intentAsk: '提问',
        askTitle: '这是提问，直接回答',
        gapCount: '{n} 个维度待定',
        scoreText: '{n}/{total} 维度已说明',
        files: '文件',
        dirs: '目录',
        truncated: '已截断',
        show: '展开',
        hide: '收起',
        running: '正在读工作区…',
        failed: '神灯没有点亮',
        switchOnTitle: '点击关闭提示词增强',
        switchOffTitle: '点击点亮：开启提示词增强',
        switchFailed: '切换失败',
        dockTitle: '神灯',
        rwAction: '增强提示词',
        rwActionTitle: '增强当前提示词',
        rwReady: '增强提示词',
        rwNeedText: '先输入提示词',
        rwWorking: '增强中…',
        rwEnhanced: '已增强',
        rwDone: '已增强',
        rwDoneOpen: '已增强；待补：{gaps}',
        rwUnchanged: '已经很完整',
        rwFailed: '增强失败',
        rwNoModel: '没有可用模型',
        rwEmpty: '还没有输入提示词',
        rwUndo: '撤销',
        rwUndoTitle: '恢复增强前的提示词',
        rwUndone: '已恢复',
        rwOff: '神灯未点亮',
        cfgIntro: '决定点神灯时，它给你补多少内容。',
        cfgLevelLabel: '增强强度',
        lvlLow: '低',
        lvlLowHint: '只补最关键的一点，尽量不动原文',
        lvlMedium: '中',
        lvlMediumHint: '补齐交付物、落点与验收，其余按需',
        lvlHigh: '高',
        lvlHighHint: '六个维度逐项写全，并标出待确认项',
        cfgReadonly: '当前环境只读，无法保存。',
        tplReport: '汇报',
        tplTranslate: '翻译',
        tplCode: '写代码',
        tplWriting: '写作 / 文案',
        tplDefault: '内置六维（恢复默认）',
        cfgRemove: '删除',
        cfgSave: '保存',
        cfgRevert: '放弃修改',
        cfgSaved: '已保存',
        cfgErrSave: '保存失败',
        cfgErrId: '每条检查都需要一个名称',
        cfgErrMatch: '每条检查至少要有一个要留意的词',
        cfgErrDup: '有两条检查重名了',
        cfgFieldId: '标识',
        cfgFieldLabel: '检查项名称',
        cfgFieldMatch: '提到这些词就算说明了',
        cfgMatchHint: '逗号分隔。写用户需求里可能出现的词，比如“轻松, 语气, 正式”',
        cfgFieldAsk: '要问的问题',
        cfgFieldSuggest: '不用问时的默认做法',
        manifestHeading: '项目清单',
      },
      en: {
        lamp: 'Lamp · prompt enhancer',
        refineTitle: 'Prompt check',
        scanTitle: 'Workspace structure',
        noWish: '(empty prompt)',
        settled: 'settled',
        gapHeading: 'Still missing',
        vagueHeading: 'These words carry no information',
        briefHeading: 'Ready-to-use brief',
        factsHeading: 'Workspace basis',
        clearTitle: 'The target is clear enough',
        intentModify: 'Change existing',
        intentCreate: 'Build new',
        intentAsk: 'Question',
        askTitle: 'This is a question — answer it',
        gapCount: '{n} dimension(s) open',
        scoreText: '{n}/{total} settled',
        files: 'files',
        dirs: 'dirs',
        truncated: 'truncated',
        show: 'Show',
        hide: 'Hide',
        running: 'Reading the workspace…',
        failed: 'The lamp did not light',
        switchOnTitle: 'Click to turn prompt enhancement off',
        switchOffTitle: 'Click to turn prompt enhancement on',
        switchFailed: 'Switch failed',
        dockTitle: 'Lamp',
        rwAction: 'Enhance prompt',
        rwActionTitle: 'Enhance the current prompt',
        rwReady: 'Enhance prompt',
        rwNeedText: 'Type a prompt first',
        rwWorking: 'Enhancing…',
        rwEnhanced: 'Enhanced',
        rwDone: 'Enhanced',
        rwDoneOpen: 'Enhanced; still open: {gaps}',
        rwUnchanged: 'Already complete',
        rwFailed: 'Enhance failed',
        rwNoModel: 'No model available',
        rwEmpty: 'No prompt yet',
        rwUndo: 'Undo',
        rwUndoTitle: 'Restore the previous prompt',
        rwUndone: 'Restored',
        rwOff: 'Lamp is off',
        cfgIntro: 'How much the lamp adds when you press it.',
        cfgLevelLabel: 'Enhancement strength',
        lvlLow: 'Low',
        lvlLowHint: 'Add the one thing that matters, keep the rest as written',
        lvlMedium: 'Medium',
        lvlMediumHint: 'Fill in deliverable, destination, and acceptance',
        lvlHigh: 'High',
        lvlHighHint: 'Write out all six dimensions and flag what needs confirming',
        cfgReadonly: 'Read-only environment; saving is disabled.',
        tplReport: 'Reporting',
        tplTranslate: 'Translation',
        tplCode: 'Coding',
        tplWriting: 'Writing',
        tplDefault: 'Built-in six (reset)',
        cfgRemove: 'Remove',
        cfgSave: 'Save',
        cfgRevert: 'Revert',
        cfgSaved: 'Saved',
        cfgErrSave: 'Save failed',
        cfgErrId: 'Every check needs a name',
        cfgErrMatch: 'Every check needs at least one word to look for',
        cfgErrDup: 'Two checks share the same name',
        cfgFieldId: 'Name',
        cfgFieldLabel: 'Shown as',
        cfgFieldMatch: 'Counts as addressed when the wish mentions…',
        cfgMatchHint: 'Comma-separated words that may appear in the request, e.g. "light, formal"',
        cfgFieldAsk: 'Question to ask',
        cfgFieldSuggest: 'Default when not asked',
        manifestHeading: 'Manifests',
      },
    };

    function detectLocale() {
      if (typeof navigator !== 'undefined' && navigator.language) {
        return String(navigator.language).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
      }
      return 'en';
    }

    /**
     * Build a translate function that reads the live locale on every call and
     * subscribes the calling component to locale changes, so switching the UI
     * language re-renders these rows instead of freezing the boot locale.
     */
    function makeTranslator(localeSvc) {
      let bound = null;
      if (localeSvc && typeof localeSvc.bind === 'function') {
        try { bound = localeSvc.bind(NS); } catch (error) { bound = null; }
      }

      function activeLocale() {
        if (localeSvc && typeof localeSvc.getLocale === 'function') {
          try {
            const snapshot = localeSvc.getLocale();
            const id = snapshot && (snapshot.active || snapshot.locale || snapshot.id);
            if (typeof id === 'string' && id) {
              return id.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
            }
          } catch (error) { /* fall through to detection */ }
        }
        return detectLocale();
      }

      const subscribable = localeSvc
        && typeof localeSvc.getSnapshot === 'function'
        && typeof localeSvc.subscribe === 'function';
      const subscribe = subscribable ? function (notify) { return localeSvc.subscribe(notify); } : null;
      const revisionOf = subscribable ? function () {
        const snapshot = localeSvc.getSnapshot();
        return snapshot && typeof snapshot.revision === 'number' ? snapshot.revision : 0;
      } : null;

      function useLocaleRevision() {
        if (!subscribable) return 0;
        return React.useSyncExternalStore(subscribe, revisionOf);
      }

      function useTranslate() {
        useLocaleRevision();
        const dict = DICTS[activeLocale()] || DICTS.en;
        return function t(key) {
          if (bound) {
            let value;
            try { value = bound(key); } catch (error) { value = undefined; }
            if (typeof value === 'string' && value !== '' && value !== key) return value;
          }
          const text = dict[key];
          return typeof text === 'string' ? text : key;
        };
      }

      return useTranslate;
    }

    function fill(template, values) {
      return template.replace(/\{(\w+)\}/g, function (whole, key) {
        return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : whole;
      });
    }

    /* ---------------------------------------------------------------- *
     * Shared chrome
     * ---------------------------------------------------------------- */

    /**
     * The lamp glyph: an Aladdin silhouette in brass over dark glass, with a
     * mandala filigree on the belly and a manifold-lit spout. Dormant it is
     * cold teal-grey metal; lit the filigree and the flame take on amber.
     *
     * Every coordinate stays inside the 0 0 16 16 viewBox.
     */
    /** Every glyph gets its own gradient ids: duplicate ids are invalid HTML,
        and when an instance unmounts, its defs go with it — any other instance
        still pointing at those ids would then paint nothing at all. */
    let LAMP_UID = 0;

    function AladdinLamp(props) {
      const size = props.size || 16;
      const lit = props.lit === true;
      const id = props.uid || 'lamp' + (++LAMP_UID);
      // `url(#x) color` is SVG's paint fallback: if the gradient cannot be
      // resolved, the solid colour takes over and the lamp stays visible.
      const metal = lit
        ? 'url(#sd-metal-lit-' + id + ') #a06cd0'
        : 'url(#sd-metal-off-' + id + ') #6a628e';
      const filigree = lit ? 'rgba(255, 226, 255, 0.9)' : 'rgba(170, 186, 226, 0.5)';
      const flame = lit ? 'url(#sd-flame-' + id + ') #b98cff' : 'transparent';

      return h('svg', {
        viewBox: '0 0 16 16', width: size, height: size,
        className: 'sd-lamp-svg', 'aria-hidden': true,
        style: { display: 'block', overflow: 'visible' },
      },
        h('defs', null,
          h('linearGradient', { id: 'sd-flame-' + id, x1: '0', y1: '1', x2: '0', y2: '0' },
            h('stop', { offset: '0%', stopColor: '#7fd4ff' }),
            h('stop', { offset: '38%', stopColor: '#b98cff' }),
            h('stop', { offset: '72%', stopColor: '#ff9ee0' }),
            h('stop', { offset: '100%', stopColor: '#fff6ff' }),
          ),
          // Dormant: cold violet steel.
          h('linearGradient', { id: 'sd-metal-off-' + id, x1: '0', y1: '0', x2: '0.35', y2: '1' },
            h('stop', { offset: '0%', stopColor: '#9a92c4' }),
            h('stop', { offset: '48%', stopColor: '#5f5788' }),
            h('stop', { offset: '100%', stopColor: '#332c4d' }),
          ),
          // Lit: rose-gold over amethyst, the mystery palette.
          h('linearGradient', { id: 'sd-metal-lit-' + id, x1: '0', y1: '0', x2: '0.35', y2: '1' },
            h('stop', { offset: '0%', stopColor: '#ffd6f2' }),
            h('stop', { offset: '34%', stopColor: '#d18ce8' }),
            h('stop', { offset: '68%', stopColor: '#8b5ed6' }),
            h('stop', { offset: '100%', stopColor: '#4a3a86' }),
          ),
        ),
        // body
        h('path', {
          d: 'M3.1 11.05h9.8c0 .7-.6 1.26-1.34 1.26H4.44c-.74 0-1.34-.56-1.34-1.26z',
          fill: metal,
        }),
        h('path', {
          d: 'M3.95 10.5c-.48-1.55-.13-3.06.92-3.94.84-.7 1.95-.95 2.98-.86.96.09 1.74.49 2.23 1.11.6.78.76 1.85.41 2.86-.14.41-.35.76-.62 1.07-.49.55-1.17.84-1.93.84H5.36c-.6 0-1.15-.35-1.41-.88z',
          fill: metal,
        }),
        // spout
        h('path', {
          d: 'M4.31 9.12C3.26 8.4 2.44 7.43 2.01 6.34c1.46-.25 2.86.2 3.91 1.17z',
          fill: metal,
        }),
        // lid
        h('path', {
          d: 'M7.86 5.78c0-.6.49-1.09 1.09-1.09s1.09.49 1.09 1.09z',
          fill: metal,
        }),
        // ring handle
        h('path', {
          d: 'M10.78 6.6c.92-.1 1.68.49 1.81 1.36.14.88-.4 1.7-1.28 1.9',
          fill: 'none', stroke: metal, strokeWidth: 1.05, strokeLinecap: 'round',
        }),
        // mandala filigree on the belly
        lit
          ? h('g', { stroke: filigree, strokeWidth: 0.42, fill: 'none', opacity: 0.95 },
              h('circle', { cx: 7.85, cy: 8.55, r: 2.05 }),
              h('circle', { cx: 7.85, cy: 8.55, r: 1.15, strokeDasharray: '0.5 0.85' }),
              h('path', { d: 'M7.85 6.5v4.1M5.8 8.55h4.1M6.4 7.1l2.9 2.9M9.3 7.1l-2.9 2.9', opacity: 0.65 }),
            )
          : h('circle', {
              cx: 7.85, cy: 8.55, r: 1.75,
              fill: 'none', stroke: filigree, strokeWidth: 0.4, strokeDasharray: '1.1 1.3',
            }),
        // flame at the spout lip
        lit
          ? h('path', {
              className: 'sd-flame',
              d: 'M1.98 6.26c.44.44.76.93.88 1.42.05.23.05.44 0 .63-.14-.25-.35-.44-.63-.55-.26-.1-.54-.09-.77.05.02-.55.18-1.06.52-1.55z',
              fill: flame,
            })
          : null,
      );
    }

    const ROW_STYLE = {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      minWidth: 0,
      color: 'var(--dsw-alias-label-secondary)',
      fontSize: 'var(--dsh-content-font-size-secondary, 13px)',
      lineHeight: '24px',
    };

    const BUTTON_STYLE = {
      all: 'unset',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      minWidth: 0,
      width: '100%',
    };

    function Chevron(props) {
      return h('svg', {
        viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': true,
        style: {
          flex: 'none',
          color: 'var(--dsw-alias-label-secondary)',
          transform: props.open ? 'rotate(90deg)' : 'none',
          transition: 'transform 120ms ease',
        },
      }, h('path', {
        d: 'M6 3.5 L10.5 8 L6 12.5',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
        strokeLinecap: 'round', strokeLinejoin: 'round',
      }));
    }

    function Section(props) {
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        h('div', {
          style: {
            fontSize: 11,
            lineHeight: '16px',
            letterSpacing: '0.02em',
            color: 'var(--dsw-alias-label-secondary)',
            opacity: 0.85,
          },
        }, props.title),
        props.children,
      );
    }

    function Card(props) {
      return h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          margin: '4px 0 4px 4px',
          padding: '10px 12px',
          border: '0.5px solid var(--dsw-alias-border-l1)',
          borderRadius: 'var(--dsw-radius-lg, 10px)',
          background: 'var(--dsw-alias-bg-layer-1)',
          color: 'var(--dsw-alias-label-primary)',
        },
      }, props.children);
    }

    function Dots(props) {
      const items = [];
      for (let index = 0; index < props.total; index++) {
        const on = index < props.score;
        items.push(h('span', {
          key: index,
          title: on ? props.settledLabel : '',
          style: {
            width: 6,
            height: 6,
            borderRadius: 3,
            background: on ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-border-l2)',
            flex: 'none',
          },
        }));
      }
      return h('div', {
        style: { display: 'flex', alignItems: 'center', gap: 3, flex: 'none' },
        role: 'img',
        'aria-label': props.ariaLabel,
      }, items);
    }

    /* ---------------------------------------------------------------- *
     * lamp_refine
     * ---------------------------------------------------------------- */

    function RefineBody(props) {
      const data = props.data;
      const t = props.t;
      const gaps = Array.isArray(data.gaps) ? data.gaps : [];
      const vague = Array.isArray(data.vague) ? data.vague : [];
      const facts = Array.isArray(data.facts) ? data.facts : [];

      const targets = Array.isArray(data.targets) ? data.targets : [];
      const intentLabel = data.intent === 'modify'
        ? t('intentModify')
        : data.intent === 'create'
          ? t('intentCreate')
          : data.intent === 'ask'
            ? t('intentAsk')
            : null;

      return h(Card, null,
        intentLabel !== null || targets.length > 0
          ? h('div', {
              style: {
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '4px 8px',
                fontSize: 12,
                lineHeight: '18px',
                color: 'var(--dsw-alias-label-secondary)',
              },
            },
              intentLabel !== null
                ? h('span', {
                    style: {
                      padding: '1px 7px',
                      borderRadius: 999,
                      border: '0.5px solid var(--dsw-alias-border-l2)',
                      background: 'var(--dsw-alias-bg-layer-2)',
                      whiteSpace: 'nowrap',
                    },
                  }, intentLabel)
                : null,
              targets.map(function (target) {
                return h('span', {
                  key: target,
                  style: {
                    fontFamily: 'var(--dsw-font-markdown-code-block-small, ui-monospace, monospace)',
                    color: 'var(--dsw-alias-label-primary)',
                  },
                }, target);
              }),
            )
          : null,

        data.intent === 'ask'
          ? h('div', {
              style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13 },
            }, t('askTitle'))
          : gaps.length === 0 && vague.length === 0
            ? h('div', {
                style: { color: 'var(--dsw-alias-state-success-primary)', fontSize: 13 },
              }, t('clearTitle'))
            : null,

        gaps.length > 0
          ? h(Section, { title: t('gapHeading') },
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                gaps.map(function (gap) {
                  return h('div', {
                    key: gap.id,
                    style: {
                      display: 'grid',
                      gridTemplateColumns: 'max-content 1fr',
                      columnGap: 10,
                      alignItems: 'baseline',
                      fontSize: 12,
                      lineHeight: '18px',
                    },
                  },
                    h('span', {
                      style: {
                        color: 'var(--dsw-alias-state-warn-primary)',
                        whiteSpace: 'nowrap',
                      },
                    }, gap.label),
                    h('span', { style: { display: 'flex', flexDirection: 'column', gap: 1 } },
                      h('span', { style: { color: 'var(--dsw-alias-label-primary)' } }, gap.question),
                      h('span', {
                        style: { color: 'var(--dsw-alias-label-secondary)', opacity: 0.9 },
                      }, gap.suggestion),
                    ),
                  );
                }),
              ),
            )
          : null,

        vague.length > 0
          ? h(Section, { title: t('vagueHeading') },
              h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
                vague.map(function (word) {
                  return h('span', {
                    key: word,
                    style: {
                      padding: '1px 7px',
                      borderRadius: 999,
                      border: '0.5px solid var(--dsw-alias-border-l2)',
                      background: 'var(--dsw-alias-bg-layer-2)',
                      fontSize: 11,
                      lineHeight: '16px',
                      color: 'var(--dsw-alias-label-secondary)',
                    },
                  }, word);
                }),
              ),
            )
          : null,

        typeof data.brief === 'string' && data.brief !== ''
          ? h(Section, { title: t('briefHeading') },
              h('pre', {
                style: {
                  margin: 0,
                  padding: '8px 10px',
                  borderRadius: 'var(--dsw-radius-sm, 6px)',
                  background: 'var(--dsw-alias-bg-layer-2)',
                  color: 'var(--dsw-alias-label-primary)',
                  font: 'var(--dsw-font-markdown-code-block-small, 12px/18px ui-monospace, monospace)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 260,
                  overflow: 'auto',
                },
              }, data.brief),
            )
          : null,

        facts.length > 0
          ? h(Section, { title: t('factsHeading') },
              h('div', {
                style: { display: 'flex', flexDirection: 'column', gap: 1, fontSize: 11.5, lineHeight: '17px' },
              }, facts.map(function (fact, index) {
                return h('div', {
                  key: index,
                  style: { color: 'var(--dsw-alias-label-secondary)' },
                }, '· ' + fact);
              })),
            )
          : null,
      );
    }

    function RefineRow(props) {
      const t = props.translate();
      const disclosure = props.useDisclosure();
      const data = props.data;
      const wish = props.wish;
      const score = typeof data.score === 'number' ? data.score : 0;
      const total = typeof data.total === 'number' ? data.total : 6;
      const gapCount = Array.isArray(data.gaps) ? data.gaps.length : 0;
      const summary = data.intent === 'ask'
        ? t('askTitle')
        : props.settled
          ? fill(t('scoreText'), { n: score, total: total })
          : gapCount > 0
            ? fill(t('gapCount'), { n: gapCount })
            : t('running');

      return h('div', { style: { display: 'flex', flexDirection: 'column' } },
        h('div', { style: ROW_STYLE },
          h('button', {
            type: 'button',
            style: BUTTON_STYLE,
            onClick: disclosure.toggle,
            'aria-expanded': disclosure.expanded,
          },
            h(AladdinLamp, { size: 14, lit: false }),
            h('span', { style: { flex: 'none', color: 'var(--dsw-alias-label-primary)' } }, t('refineTitle')),
            h('span', {
              style: {
                width: 2, height: 2, borderRadius: 1, flex: 'none',
                background: 'var(--dsw-alias-label-secondary)', opacity: 0.6,
              },
            }),
            h('span', {
              style: {
                flex: 'auto',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
            }, wish !== '' ? wish : summary),
            h(Dots, {
              score: score,
              total: total,
              settledLabel: t('settled'),
              ariaLabel: fill(t('scoreText'), { n: score, total: total }),
            }),
            h(Chevron, { open: disclosure.expanded }),
          ),
        ),
        disclosure.expanded
          ? h('div', { style: { marginTop: '2px' } },
              h(RefineBody, { data: data, t: t }),
            )
          : null,
      );
    }

    /* ---------------------------------------------------------------- *
     * lamp_scan
     * ---------------------------------------------------------------- */

    function ScanBody(props) {
      const data = props.data;
      const t = props.t;
      const tree = Array.isArray(data.tree) ? data.tree : [];
      const extensions = Array.isArray(data.extensions) ? data.extensions : [];
      const manifests = Array.isArray(data.manifests) ? data.manifests : [];

      return h(Card, null,
        h('div', {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px 12px',
            fontSize: 12,
            lineHeight: '18px',
            color: 'var(--dsw-alias-label-secondary)',
          },
        },
          h('span', { style: { color: 'var(--dsw-alias-label-primary)' } }, data.root || ''),
          h('span', null, `${data.files ?? 0} ${t('files')} · ${data.directories ?? 0} ${t('dirs')}`),
          data.truncated === true ? h('span', null, t('truncated')) : null,
        ),

        tree.length > 0
          ? h('pre', {
              style: {
                margin: 0,
                padding: '8px 10px',
                borderRadius: 'var(--dsw-radius-sm, 6px)',
                background: 'var(--dsw-alias-bg-layer-2)',
                font: 'var(--dsw-font-markdown-code-block-small, 12px/17px ui-monospace, monospace)',
                color: 'var(--dsw-alias-label-secondary)',
                whiteSpace: 'pre',
                overflow: 'auto',
                maxHeight: 240,
              },
            }, tree.join('\n'))
          : null,

        extensions.length > 0
          ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
              extensions.map(function (item) {
                return h('span', {
                  key: item.ext,
                  style: {
                    padding: '1px 7px',
                    borderRadius: 999,
                    border: '0.5px solid var(--dsw-alias-border-l1)',
                    background: 'var(--dsw-alias-bg-layer-2)',
                    fontSize: 11,
                    lineHeight: '16px',
                    color: 'var(--dsw-alias-label-secondary)',
                  },
                }, `${item.ext} ×${item.count}`);
              }),
            )
          : null,

        manifests.length > 0
          ? h(Section, { title: t('manifestHeading') },
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: 1, fontSize: 11.5 } },
                manifests.map(function (manifest) {
                  return h('div', {
                    key: manifest.path,
                    style: { color: 'var(--dsw-alias-label-secondary)' },
                  }, '· ' + manifest.path);
                }),
              ),
            )
          : null,
      );
    }

    function ScanRow(props) {
      const t = props.translate();
      const disclosure = props.useDisclosure();
      const data = props.data;
      const count = typeof data.files === 'number' ? data.files : null;
      const summary = count === null
        ? props.root || ''
        : `${count} ${t('files')} · ${data.directories ?? 0} ${t('dirs')}`;

      return h('div', { style: { display: 'flex', flexDirection: 'column' } },
        h('div', { style: ROW_STYLE },
          h('button', {
            type: 'button',
            style: BUTTON_STYLE,
            onClick: disclosure.toggle,
            'aria-expanded': disclosure.expanded,
          },
            h(AladdinLamp, { size: 14, lit: false }),
            h('span', { style: { flex: 'none', color: 'var(--dsw-alias-label-primary)' } }, t('scanTitle')),
            h('span', {
              style: {
                width: 2, height: 2, borderRadius: 1, flex: 'none',
                background: 'var(--dsw-alias-label-secondary)', opacity: 0.6,
              },
            }),
            h('span', {
              style: {
                flex: 'auto', minWidth: 0, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              },
            }, summary),
            h(Chevron, { open: disclosure.expanded }),
          ),
        ),
        disclosure.expanded
          ? h('div', { style: { marginTop: '2px' } }, h(ScanBody, { data: data, t: t }))
          : null,
      );
    }

    /* ---------------------------------------------------------------- *
     * Dispatch
     * ---------------------------------------------------------------- */

    function readArgs(block) {
      const raw = block.call?.argsRaw ?? (block.phase === 'start' ? block.argsRaw : undefined);
      if (typeof raw !== 'string' || raw === '') return null;
      try {
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }

    function lampData(block) {
      const meta = block.meta;
      if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return null;
      const data = meta.shenDeng;
      if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
      return data;
    }

    function failureText(block) {
      const content = Array.isArray(block.content) ? block.content : [];
      for (const part of content) {
        if (part && part.type === 'text' && typeof part.text === 'string' && part.text !== '') {
          return part.text.split('\n')[0];
        }
      }
      return '';
    }

    function makeRow(kind) {
      return function LampRow(props) {
        const t = props.translate();
        const block = props.block;
        if (block && block.isError === true) {
          return h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
              color: 'var(--dsw-alias-state-error-primary)',
              fontSize: 'var(--dsh-content-font-size-secondary, 13px)',
              lineHeight: '24px',
            },
          },
            h(AladdinLamp, { size: 14, lit: false }),
            h('span', null, t('failed')),
            h('span', {
              style: {
                minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', color: 'var(--dsw-alias-label-secondary)',
              },
            }, failureText(block)),
          );
        }

        const args = readArgs(block);
        const data = lampData(block);

        if (kind === 'scan') {
          return h(ScanRow, {
            translate: props.translate,
            useDisclosure: props.useDisclosure,
            data: data || {},
            root: args && typeof args.path === 'string' ? args.path : '',
          });
        }
        return h(RefineRow, {
          translate: props.translate,
          useDisclosure: props.useDisclosure,
          data: data || { score: 0, total: 6, gaps: [] },
          settled: data !== null,
          wish: args && typeof args.prompt === 'string' ? args.prompt.trim() : '',
        });
      };
    }

    /* ---------------------------------------------------------------- *
     * The lamp console (below the composer)
     * ---------------------------------------------------------------- */

    const LAMP_CSS = `
@keyframes sd-spin { to { transform: rotate(360deg); } }
@keyframes sd-spin-r { to { transform: rotate(-360deg); } }
@keyframes sd-flicker {
  0%,100% { opacity: 1; transform: scale(1); }
  38% { opacity: .84; transform: scale(.975); }
  52% { opacity: .66; transform: scale(.95); }
  66% { opacity: .92; transform: scale(1); }
}
@keyframes sd-breathe { 0%,100% { opacity: .3; } 50% { opacity: .7; } }
@keyframes sd-rise {
  0% { opacity: 0; transform: translate3d(0,2px,0) scale(.55); }
  20% { opacity: .85; }
  100% { opacity: 0; transform: translate3d(1.5px,-13px,0) scale(.3); }
}
@keyframes sd-ignite {
  0% { opacity: 0; transform: translateY(2px) scale(.5); }
  58% { opacity: 1; transform: translateY(0) scale(1.12); }
  100% { opacity: 1; transform: none; }
}

/* one quiet row under the composer */
.sd-cfg {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
}
.sd-cfg-intro {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  line-height: 18px;
}
.sd-cfg-levels {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sd-cfg-level {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
  text-align: left;
  padding: 9px 32px 9px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease;
}
.sd-cfg-level:hover:not(:disabled) { border-color: var(--dsw-alias-border-l3); }
.sd-cfg-level--on {
  border-color: rgba(176, 130, 240, 0.75);
  background: color-mix(in srgb, rgba(176, 130, 240, 0.14) 100%, transparent);
}
.sd-cfg-level:disabled { cursor: default; opacity: .6; }
.sd-cfg-level-name { font-weight: 500; line-height: 18px; }
.sd-cfg-level-hint { color: var(--dsw-alias-label-secondary); font-size: 11.5px; line-height: 16px; }
.sd-cfg-level-mark {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(176, 130, 240, 1);
}
.sd-cfg-error { margin: 0; color: var(--dsw-alias-state-error-primary); font-size: 11.5px; }

.sd-composer-btn {
  display: inline-flex;
  align-items: center;
  flex: none;
}

.sd-lampbtn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  flex: none;
  padding: 0 6px 0 0;
  border: 0;
  background: none;
  cursor: pointer;
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11.5px;
  line-height: 16px;
  white-space: nowrap;
  transition: color 180ms ease;
}

/* The label is part of the button: one row, no floating layer. */
.sd-label { pointer-events: none; }
.sd-lampbtn[data-lit="1"] { color: var(--dsw-alias-label-primary); }
.sd-lampbtn[data-error="1"], .sd-label[data-error="1"] { color: var(--dsw-alias-state-error-primary); }
.sd-lampbtn:disabled { cursor: default; opacity: .55; }

.sd-lampbtn:focus-visible { outline: 1.5px solid rgba(196, 152, 255, 0.8); outline-offset: 2px; }

.sd-lampbtn:hover:not(:disabled) { transform: translateY(-1px); }
.sd-lampbtn:active:not(:disabled) { transform: translateY(0) scale(.94); }

.sd-lampbtn svg.sd-lamp-svg { position: relative; display: block; }
.sd-flame {
  transform-origin: 50% 92%;
  animation: sd-ignite 420ms cubic-bezier(.22,1.2,.4,1) both, sd-flicker 3.4s ease-in-out 420ms infinite;
}
.sd-ember {
  position: absolute;
  width: 1.5px;
  height: 1.5px;
  border-radius: 50%;
  background: #e6b9ff;
  box-shadow: 0 0 3px rgba(196, 140, 255, 0.9);
  opacity: 0;
  pointer-events: none;
}
.sd-lampbtn[data-lit="1"] .sd-ember { animation: sd-rise 2.8s ease-out infinite; }

/* The lamp's own halo: the only decorative light left in the dock. */
.sd-lampbtn[data-lit="1"] {
  filter: drop-shadow(0 0 5px rgba(196, 140, 255, 0.55));
}

.sd-lampbtn--undo { color: var(--dsw-alias-label-secondary); }
.sd-lampbtn--undo:hover { color: var(--dsw-alias-label-primary); }



@media (prefers-reduced-motion: reduce) {
  .sd-composer-btn * { animation: none !important; transition: none !important; }
}
`;

    function useLampStyles() {
      React.useEffect(function () {
        if (typeof document === 'undefined') return undefined;
        const id = 'shen-deng/lamp-console.css';
        if (document.querySelector('style[data-plugin-css="' + id + '"]') !== null) return undefined;
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-shendeng';
        tag.dataset.pluginCss = id;
        tag.textContent = LAMP_CSS;
        document.head.appendChild(tag);
        return function () { tag.remove(); };
      }, []);
    }

    /** Two counter-rotating dashed mandala rings around the lamp. */
    function MandalaRings(props) {
      const lit = props.lit;
      const stroke = lit ? 'rgba(255, 196, 112, 0.85)' : 'rgba(150, 168, 200, 0.5)';
      const accent = lit ? 'rgba(255, 176, 80, 0.7)' : 'rgba(120, 210, 220, 0.42)';
      return h(React.Fragment, null,
        h('svg', {
          className: 'sd-ring-a', viewBox: '0 0 40 40', 'aria-hidden': true,
          style: { width: '100%', height: '100%' },
        },
          h('circle', { cx: 20, cy: 20, r: 18.2, fill: 'none', stroke: stroke, strokeWidth: 0.7, strokeDasharray: '2.2 4.4' }),
          h('circle', { cx: 20, cy: 20, r: 14.6, fill: 'none', stroke: accent, strokeWidth: 0.5, strokeDasharray: '0.6 6.2' }),
        ),
        h('svg', {
          className: 'sd-ring-b', viewBox: '0 0 40 40', 'aria-hidden': true,
          style: { width: '100%', height: '100%' },
        },
          h('circle', { cx: 20, cy: 20, r: 16.4, fill: 'none', stroke: accent, strokeWidth: 0.5, strokeDasharray: '7.2 5.6' }),
        ),
      );
    }

    /**
     * The lamp console below the composer: a dormant/lit switch whose state comes
     * from the Session projection and whose writes go through `/lamp`.
     */
    /**
     * The dock control: one click turns the current composer draft into a
     * complete, unambiguous instruction.
     *
     * The lamp is now an **action**, not a switch. The switch state survives as
     * the enable flag: when the lamp is dark the button explains how to turn it
     * on; when it is lit, pressing rewrites the draft in place, and an undo
     * restores the original text.
     */
    function LampConsole(props) {
      const t = props.translate();
      const lit = lampStateOf(props.useProjection('shenDeng')).lit;
      const input = props.useInput((state) => state);
      const draft = input && typeof input.draft === 'string' ? input.draft : '';
      const locked = input !== undefined && input.phase !== undefined && input.phase !== 'plain';
      // `inputActions.setDraft` is the composer's own write path: it replaces
      // the whole draft (chips included) in one undo step.
      const setDraft = (text) => {
        const actions = props.inputActions;
        if (actions !== undefined && typeof actions.setDraft === 'function') actions.setDraft(text);
      };

      const [busy, setBusy] = React.useState(false);
      const [failure, setFailure] = React.useState(null);
      const [note, setNote] = React.useState(null);
      useLampStyles();

      // The undo offer belongs to exactly one draft: `previous` is the text an
      // enhance replaced, `enhanced` is what it produced. Both are dropped as
      // soon as the composer stops holding `enhanced` — sent, cleared, or
      // edited past it — because restoring `previous` into a different message
      // would be wrong, and leaving the icon as "undo" over an empty composer
      // is the bug this guards against.
      const [enhanced, setEnhanced] = React.useState(null);
      const [previous, setPrevious] = React.useState(null);
      React.useEffect(function () {
        if (enhanced === null) return;
        if (draft !== enhanced) {
          setEnhanced(null);
          setPrevious(null);
          setNote(null);
        }
      }, [draft, enhanced]);

      const hasDraft = draft.trim() !== '';
      const canRun = lit && hasDraft && !busy && !locked
        && typeof props.rewrite === 'function'
        && props.inputActions !== undefined
        && typeof props.inputActions.setDraft === 'function';

      const run = function () {
        if (!canRun) return;
        const original = draft;
        setBusy(true);
        setFailure(null);
        setNote(null);
        Promise.resolve(props.rewrite(original)).then(
          function (result) {
            setBusy(false);
            if (result === null || typeof result !== 'object') {
              setFailure(t('rwFailed'));
              return;
            }
            if (result.ok !== true) {
              setFailure(result.reason === 'no-llm' || result.reason === 'no-model'
                ? t('rwNoModel')
                : result.reason === 'empty-draft'
                  ? t('rwEmpty')
                  : t('rwFailed'));
              return;
            }
            if (result.text === original) {
              setNote(t('rwUnchanged'));
              return;
            }
            // Keep one step of undo: an enhance the user dislikes must be
            // cheap to discard, or they will stop trusting the button.
            setPrevious(original);
            setEnhanced(result.text);
            setDraft(result.text);
            setNote(result.gaps && result.gaps.length > 0
              ? fill(t('rwDoneOpen'), { gaps: result.gaps.join('、') })
              : t('rwDone'));
          },
          function (error) {
            setBusy(false);
            setFailure(error instanceof Error ? error.message : String(error));
          },
        );
      };

      const undo = function () {
        if (previous === null) return;
        setDraft(previous);
        setPrevious(null);
        setEnhanced(null);
        setNote(t('rwUndone'));
        setFailure(null);
      };

      // One icon with its label beside it. The icon is the action; while an
      // enhance is still undoable it becomes undo, and reverts to the lamp as
      // soon as that draft leaves the composer.
      const showingUndo = previous !== null && !busy;
      const stateText = busy
        ? t('rwWorking')
        : failure !== null
          ? failure
          : showingUndo
            ? t('rwEnhanced')
            : !lit
              ? t('rwOff')
              : hasDraft
                ? t('rwReady')
                : t('rwNeedText');

      // The label sits after the icon, inline: no floating layer, no layout
      // shift beyond the width of a short word.
      const label = busy
        ? t('rwWorking')
        : failure !== null
          ? t('rwFailed')
          : showingUndo
            ? t('rwEnhanced')
            : !lit
              ? t('rwOff')
              : hasDraft
                ? t('rwReady')
                : t('rwNeedText');

      const iconLabel = failure !== null
        ? failure
        : busy
          ? t('rwWorking')
          : showingUndo
            ? t('rwUndoTitle')
            : !lit
              ? t('switchOffTitle')
              : hasDraft
                ? t('rwActionTitle')
                : t('rwNeedText');

      const disabled = busy || (showingUndo ? false : (lit ? !canRun : false));

      return h('div', { className: 'sd-composer-btn', 'data-lit': lit ? '1' : '0' },
        h('button', {
          type: 'button',
          className: 'sd-lampbtn' + (showingUndo ? ' sd-lampbtn--undo' : ''),
          'data-lit': lit ? '1' : '0',
          'aria-busy': busy ? 'true' : undefined,
          'aria-label': iconLabel,
          title: iconLabel,
          'data-error': failure !== null ? '1' : '0',
          disabled,
          onClick: showingUndo ? undo : run,
        },
          showingUndo
            ? h(UndoGlyph, { size: 16 })
            : h(AladdinLamp, { size: 18, lit: lit && hasDraft }),
          h('span', {
            className: 'sd-label',
            'data-error': failure !== null ? '1' : '0',
          }, label),
        ),
      );
    }

    /** A counter-clockwise arrow: undo. */
    function UndoGlyph(props) {
      const size = props.size || 18;
      return h('svg', {
        viewBox: '0 0 16 16', width: size, height: size, 'aria-hidden': true,
        style: { display: 'block', flex: 'none' },
      },
        h('path', {
          d: 'M3.2 8.6a4.9 4.9 0 1 1 1.7 3.7',
          fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
          strokeLinecap: 'round',
        }),
        h('path', {
          d: 'M3.1 4.6v4.1h4.1',
          fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
          strokeLinecap: 'round', strokeLinejoin: 'round',
        }),
      );
    }

    function LampSettingsIcon(props) {
      const size = props.size || 16;
      const active = props.active === true;
      return h('svg', {
        viewBox: '0 0 16 16', width: size, height: size,
        'aria-hidden': true,
        style: { display: 'block', flex: 'none', color: 'inherit' },
      },
        // lamp body
        h('path', {
          d: 'M2.6 10.4h9.2c0 .66-.55 1.2-1.23 1.2H3.83c-.68 0-1.23-.54-1.23-1.2z',
          fill: 'currentColor', opacity: active ? 1 : 0.92,
        }),
        h('path', {
          d: 'M3.45 9.86c-.44-1.42-.12-2.8.85-3.6.77-.64 1.78-.87 2.72-.79.88.08 1.6.45 2.05 1.02.55.71.7 1.69.38 2.62-.13.37-.32.7-.57.98-.45.5-1.07.77-1.77.77H4.74c-.55 0-1.05-.32-1.29-.81z',
          fill: 'currentColor', opacity: active ? 1 : 0.92,
        }),
        // spout
        h('path', {
          d: 'M3.78 8.5C2.82 7.84 2.07 6.95 1.68 5.95c1.34-.23 2.62.18 3.58 1.07z',
          fill: 'currentColor', opacity: active ? 1 : 0.88,
        }),
        // three check ticks — the prompt-check signal
        h('g', {
          stroke: 'currentColor', strokeWidth: 1, strokeLinecap: 'round', strokeLinejoin: 'round',
          fill: 'none', opacity: active ? 1 : 0.75,
        },
          h('path', { d: 'M9.1 5.5h3.2M10.7 3.9l3.2 0M10.7 7.1l3.2 0' }),
        ),
        // lid knob
        h('path', {
          d: 'M7.35 5.1c0-.52.42-.94.94-.94s.94.42.94.94z',
          fill: 'currentColor', opacity: active ? 1 : 0.9,
        }),
      );
    }


    /**
     * Settings page: how hard the enhancer works.
     *
     * The page used to expose a six-dimension table. That table is now internal
     * (it backs `lamp_refine` for the model), and what a user actually wants to
     * decide is how much the button adds to their prompt — one choice, three
     * levels.
     */
    function LampSettingsPage(props) {
      const t = props.translate();
      const form = props.form();
      const readSnapshot = function () { return form.getSnapshot(); };
      const subscribe = typeof form.subscribe === 'function'
        ? function (notify) { return form.subscribe(notify); }
        : function () { return function () {}; };
      const snapshot = React.useSyncExternalStore(subscribe, readSnapshot);

      const current = (function () {
        const value = snapshot && snapshot.value ? snapshot.value.level : undefined;
        return value === 'low' || value === 'high' ? value : 'medium';
      })();
      const writable = !(snapshot && snapshot.writable === false);
      const revision = snapshot && typeof snapshot.revision === 'number' ? snapshot.revision : undefined;

      const [saving, setSaving] = React.useState(false);
      const [failure, setFailure] = React.useState(null);

      const choose = function (level) {
        if (!writable || saving || level === current) return;
        setSaving(true);
        setFailure(null);
        Promise.resolve(props.update({ level }, revision)).then(
          function () { setSaving(false); },
          function (error) {
            setSaving(false);
            setFailure(error instanceof Error ? error.message : String(error));
          },
        );
      };

      const LEVEL_COPY = [
        { key: 'low', label: t('lvlLow'), hint: t('lvlLowHint') },
        { key: 'medium', label: t('lvlMedium'), hint: t('lvlMediumHint') },
        { key: 'high', label: t('lvlHigh'), hint: t('lvlHighHint') },
      ];

      return h('div', { className: 'sd-cfg' },
        h('p', { className: 'sd-cfg-intro' },
          writable ? t('cfgIntro') : t('cfgReadonly')),

        h('div', { className: 'sd-cfg-levels', role: 'radiogroup', 'aria-label': t('cfgLevelLabel') },
          LEVEL_COPY.map(function (item) {
            const active = item.key === current;
            return h('button', {
              key: item.key,
              type: 'button',
              role: 'radio',
              'aria-checked': active,
              className: 'sd-cfg-level' + (active ? ' sd-cfg-level--on' : ''),
              disabled: !writable || saving,
              onClick: function () { choose(item.key); },
            },
              h('span', { className: 'sd-cfg-level-name' }, item.label),
              h('span', { className: 'sd-cfg-level-hint' }, item.hint),
              active ? h('span', { className: 'sd-cfg-level-mark', 'aria-hidden': true }, '✓') : null,
            );
          }),
        ),

        failure !== null
          ? h('p', { className: 'sd-cfg-error' }, failure)
          : null,
      );
    }

    /** Active dictionary, read fresh on every call so a locale switch is picked up. */
    function currentDict(localeSvc) {
      if (localeSvc && typeof localeSvc.getLocale === 'function') {
        try {
          const snapshot = localeSvc.getLocale();
          const id = snapshot && (snapshot.active || snapshot.locale || snapshot.id);
          if (typeof id === 'string' && id) {
            return DICTS[id.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'] || DICTS.en;
          }
        } catch (error) { /* fall through to detection */ }
      }
      return DICTS[detectLocale()] || DICTS.en;
    }

    /** Plain-text lookup for code that runs outside a component. */
    function t0(key) {
      return currentDict(null)[key] ?? key;
    }

    /** Slot label thunk: re-read on every projection, so it follows the locale. */
    function labelThunk(localeSvc) {
      return function () { return currentDict(localeSvc).lamp; };
    }

    /** Whether the lamp is lit for this Session, tolerating an absent projection. */
    function lampStateOf(value) {
      if (value === undefined || value === null) return { lit: false, pending: false, known: false };
      return {
        lit: value.active === true,
        pending: value.pending === true,
        known: true,
      };
    }

    /* ---------------------------------------------------------------- *
     * Registration
     * ---------------------------------------------------------------- */

    return {
      // `remote.commands` is the Client face that runs a slash command on the
      // Host; without it injected, `ctx.remote` is undefined and the switch
      // cannot report anything but a failure.
      inject: ['slots', 'remote', 'remote.settings', 'remote.commands', 'configForms', 'locale'],
      apply(ctx) {
        let localeSvc = null;
        try {
          localeSvc = ctx.locale || null;
        } catch (error) {
          localeSvc = null;
        }
        if (localeSvc && typeof localeSvc.register === 'function') {
          ctx.effect(function () { return localeSvc.register(NS, 'en', DICTS.en); }, 'shen-deng locale en');
          ctx.effect(function () { return localeSvc.register(NS, 'zh', DICTS.zh); }, 'shen-deng locale zh');
        }

        ctx.slots.inject('tool.call.toolview', function* () {
          yield ctx.slots.register({
            name: 'tool.call.toolview',
            key: 'lamp_refine',
            inject: function () { return { translate: makeTranslator(localeSvc) }; },
          }, makeRow('refine'));
          yield ctx.slots.register({
            name: 'tool.call.toolview',
            key: 'lamp_scan',
            inject: function () { return { translate: makeTranslator(localeSvc) }; },
          }, makeRow('scan'));
        });

        /**
         * One runner shared by both mount points. The command goes through the
         * same `/lamp` path the model sees; the only difference is that the
         * closed-book composer has no Session yet, so there is nothing to write.
         */
        /** Marker the Host prefixes a rewritten draft with; see index.js. */
        const REWRITE_MARK = '\u0000LAMP-REWRITE\u0000';

        /**
         * Run one command and return its raw result text, or a string naming
         * the failure.
         */
        const runLampRaw = async (sessionId, line) => {
          if (sessionId === undefined) return { ok: false, reason: 'no-session' };
          let commands;
          try {
            commands = ctx.remote?.commands;
          } catch (error) {
            return { ok: false, reason: 'remote-unavailable' };
          }
          if (commands === undefined || typeof commands.execute !== 'function') {
            return { ok: false, reason: 'command-unavailable' };
          }
          let result;
          try {
            result = await commands.execute(sessionId, line, []);
          } catch (error) {
            return { ok: false, reason: error instanceof Error ? error.message : 'command-threw' };
          }
          if (!result || result.ok !== true) return { ok: false, reason: 'command-failed' };
          if (result.value === undefined) return { ok: false, reason: 'unknown-command' };
          const inner = result.value.result;
          if (inner === undefined || inner === null) return { ok: false, reason: 'no-result' };
          return typeof inner.text === 'string' ? inner.text : '';
        };

        /**
         * Split a `/lamp rewrite` reply into `{ ok, text, reason }`.
         *
         * The marker carries a control character, so a model-supplied draft
         * cannot forge it; anything unmarked is treated as a plain failure to
         * keep the button honest.
         */
        const parseRewriteReply = (raw) => {
          if (typeof raw !== 'string' || raw.indexOf(REWRITE_MARK) !== 0) {
            return { ok: false, reason: 'bad-reply' };
          }
          const body = raw.slice(REWRITE_MARK.length);
          if (body.indexOf('ok:') === 0) return { ok: true, text: body.slice(3), gaps: [] };
          if (body.indexOf('fail:') === 0) return { ok: false, reason: body.slice(5) };
          return { ok: false, reason: 'bad-reply' };
        };

        const runLamp = (sessionId) => async (line) => {
          if (sessionId === undefined) return 'start a conversation first';
          let commands;
          try {
            commands = ctx.remote?.commands;
          } catch (error) {
            return `remote unavailable: ${error instanceof Error ? error.message : String(error)}`;
          }
          if (commands === undefined || typeof commands.execute !== 'function') {
            return 'command service is unavailable in this window';
          }
          let result;
          try {
            result = await commands.execute(sessionId, line, []);
          } catch (error) {
            return error instanceof Error ? error.message : String(error);
          }
          if (!result || result.ok !== true) {
            return result && result.error ? `${result.error.message} (${result.error.code})` : 'command failed';
          }
          if (result.value === undefined) return `unknown command: ${line}`;
          if (result.value.result && result.value.result.kind === 'error') {
            return result.value.result.text;
          }
          return null;
        };

        // Settings page: choose how much the enhancer adds. Writes go through
        // the profile patch, so the change applies without a restart.
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'shen-deng-level',
          order: 40,
          label: labelThunk(localeSvc),
          inject: () => ({
            translate: makeTranslator(localeSvc),
            form: () => ctx.configForms.get('shen-deng'),
            update: async (patch, revision) => {
              const settings = ctx.remote?.settings;
              if (settings === undefined || typeof settings.update !== 'function') {
                return { ok: false, error: { message: t0('cfgErrSave'), code: 'no-settings' } };
              }
              return settings.update('shen-deng', patch, revision);
            },
          }),
        }, LampSettingsPage));

        // Without this the nav row falls back to the generic Settings glyph,
        // which is exactly the duplication this replaces.
        ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon',
          id: 'shen-deng-level',
        }, LampSettingsIcon));

        ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
          name: 'conversation.input.right',
          id: 'shen-deng-console',
          order: 5,
          label: labelThunk(localeSvc),
          inject: (sessionId) => ({
            translate: makeTranslator(localeSvc),
            execute: runLamp(sessionId),
            // Commands are the only remote entry a plugin may expose, so the
            // rewrite rides `/lamp rewrite` and returns its text after a marker.
            rewrite: async (draft) => {
              const raw = await runLampRaw(sessionId, '/lamp rewrite ' + draft);
              if (typeof raw !== 'string') return raw;
              return parseRewriteReply(raw);
            },
          }),
        }, LampConsole));

      },
    };
  },
});
