/**
 * 神灯 (Shen Deng) — Client half.
 *
 * Renders the two lamp tools in the Chat flow:
 *   `lamp_refine` — the wish audit: six dimensions, which are settled, which
 *                    are still blank, and the default offered for each blank one.
 *   `lamp_scan`   — the workspace read: tree, file mix, manifests.
 *
 * Both rows are driven by the result metadata the Host writes
 * (`meta.shenDeng`), so the card never re-parses model-facing prose.
 */
window.__ModuleLoader__.load({
  id: '@local/shen-deng',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'shenDeng';

    const DICTS = {
      zh: {
        lamp: '神灯',
        refineTitle: '许愿体检',
        scanTitle: '工作区结构',
        noWish: '（空的许愿）',
        settled: '已说明',
        gapHeading: '还缺什么',
        vagueHeading: '这些词不算信息',
        briefHeading: '可直接使用的工作说明',
        factsHeading: '工作区依据',
        clearTitle: '目标已经足够清晰',
        intentModify: '改现有',
        intentCreate: '做新的',
        gapCount: '{n} 个维度待定',
        scoreText: '{n}/{total} 维度已说明',
        files: '文件',
        dirs: '目录',
        truncated: '已截断',
        show: '展开',
        hide: '收起',
        running: '正在读工作区…',
        failed: '神灯没有点亮',
        switchOn: '神灯已点亮',
        switchOff: '神灯已熄灭',
        switchOnTitle: '点击熄灭：关闭许愿体检',
        switchOffTitle: '点击点亮：需求模糊时先做许愿体检',
        switchWorking: '正在切换…',
        switchFailed: '切换失败',
        dockTitle: '神灯',
        dockMeta: '点击点亮，或输入 /lamp on',
        dockMetaOn: '需求模糊时先体检再动手',
        statsPending: '尚未体检',
        statsChecks: '已体检 {n} 次',
        statsGaps: '拦截 {n} 处歧义',
        cfgIntro: '体检维度表：改完即生效，无需重启。',
        cfgReadonly: '当前环境只读，无法保存。',
        cfgAdd: '加一维',
        cfgRemove: '删除',
        cfgSave: '保存',
        cfgRevert: '放弃修改',
        cfgSaved: '已保存',
        cfgErrSave: '保存失败',
        cfgErrId: '每一维都需要非空 id',
        cfgErrMatch: '每一维都需要至少一个匹配词',
        cfgErrDup: 'id 重复',
        cfgFieldId: 'id',
        cfgFieldLabel: '显示名',
        cfgFieldMatch: '匹配词',
        cfgMatchHint: '逗号分隔；/…/ 形式按正则处理',
        cfgFieldAsk: '问题',
        cfgFieldSuggest: '默认建议',
        manifestHeading: '项目清单',
      },
      en: {
        lamp: 'Lamp',
        refineTitle: 'Wish check',
        scanTitle: 'Workspace structure',
        noWish: '(empty wish)',
        settled: 'settled',
        gapHeading: 'Still missing',
        vagueHeading: 'These words carry no information',
        briefHeading: 'Ready-to-use brief',
        factsHeading: 'Workspace basis',
        clearTitle: 'The target is clear enough',
        intentModify: 'Change existing',
        intentCreate: 'Build new',
        gapCount: '{n} dimension(s) open',
        scoreText: '{n}/{total} settled',
        files: 'files',
        dirs: 'dirs',
        truncated: 'truncated',
        show: 'Show',
        hide: 'Hide',
        running: 'Reading the workspace…',
        failed: 'The lamp did not light',
        switchOn: 'Lamp lit',
        switchOff: 'Lamp off',
        switchOnTitle: 'Click to extinguish: turn the wish check off',
        switchOffTitle: 'Click to light: check the wish when a request is vague',
        switchWorking: 'Switching…',
        switchFailed: 'Switch failed',
        dockTitle: 'Lamp',
        dockMeta: 'click to light, or /lamp on',
        dockMetaOn: 'vague requests get a wish check first',
        statsPending: 'no checks yet',
        statsChecks: '{n} wish checks',
        statsGaps: '{n} gaps caught',
        cfgIntro: 'Dimension table for the wish check. Edits apply immediately.',
        cfgReadonly: 'Read-only environment; saving is disabled.',
        cfgAdd: 'Add',
        cfgRemove: 'Remove',
        cfgSave: 'Save',
        cfgRevert: 'Revert',
        cfgSaved: 'Saved',
        cfgErrSave: 'Save failed',
        cfgErrId: 'Every dimension needs a non-empty id',
        cfgErrMatch: 'Every dimension needs at least one match phrase',
        cfgErrDup: 'Duplicate id',
        cfgFieldId: 'id',
        cfgFieldLabel: 'Label',
        cfgFieldMatch: 'Match',
        cfgMatchHint: 'Comma-separated; /…/ form is treated as a regex',
        cfgFieldAsk: 'Question',
        cfgFieldSuggest: 'Default suggestion',
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
    function AladdinLamp(props) {
      const size = props.size || 16;
      const lit = props.lit === true;
      const id = props.uid || 'sd';
      const metal = lit ? 'url(#sd-metal-lit-' + id + ')' : 'url(#sd-metal-off-' + id + ')';
      const filigree = lit ? 'rgba(255, 226, 255, 0.9)' : 'rgba(170, 186, 226, 0.5)';
      const flame = lit ? 'url(#sd-flame-' + id + ')' : 'transparent';

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

        gaps.length === 0 && vague.length === 0
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
      const summary = props.settled
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
          wish: args && typeof args.wish === 'string' ? args.wish.trim() : '',
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
.sd-dock {
  display: flex;
  justify-content: center;
  width: 100%;
  padding: 3px 0 1px;
}

/* The row owns the light pool so it can span the text; the lamp only reports
   that it is lit. One element, one falloff, no seam between lamp and text. */
.sd-row { position: relative; }
.sd-row::before {
  content: "";
  position: absolute;
  /* Originates at the lamp and spills rightward across the text, so no light
     is wasted off the left edge and the falloff follows reading direction. */
  left: 13px;
  top: 50%;
  width: 420px;
  height: 44px;
  margin-top: -22px;
  background: radial-gradient(ellipse 100% 50% at 0% 50%,
    rgba(255, 196, 250, 0.15) 0%,
    rgba(196, 138, 255, 0.095) 16%,
    rgba(150, 130, 255, 0.058) 34%,
    rgba(110, 150, 255, 0.026) 56%,
    transparent 78%);
  filter: blur(8px);
  opacity: 0;
  transform: translateX(-6px) scale(.97);
  transition: opacity 520ms ease, transform 720ms cubic-bezier(.2,.9,.3,1);
  pointer-events: none;
  z-index: 0;
}
.sd-row[data-lit="1"]::before { opacity: 1; transform: translateX(0) scale(1); }

.sd-row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  max-width: 760px;
  min-width: 0;
  padding: 0 3px;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11.5px;
  line-height: 16px;
  letter-spacing: .03em;
}

/* the lamp itself is the control */
.sd-lampbtn {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex: none;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  border-radius: 50%;
  transition: transform 220ms cubic-bezier(.3,1.3,.5,1);
}
.sd-lampbtn:hover:not(:disabled) { transform: translateY(-1px); }
.sd-lampbtn:active:not(:disabled) { transform: translateY(0) scale(.94); }
.sd-lampbtn:disabled { cursor: default; opacity: .55; }
.sd-lampbtn:focus-visible { outline: 1.5px solid rgba(196, 152, 255, 0.8); outline-offset: 2px; }

/* the text beside it is a second hit area on the same action */
.sd-text-btn {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 7px;
  min-width: 0;
  padding: 0 8px 0 1px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: 6px;
}
/* No independent fill here: the row's single light pool reaches this text.
   Painting a second rectangle was what made the lit state look cut out. */
.sd-text-btn:disabled { cursor: default; opacity: .55; }
.sd-text-btn:focus-visible { outline: 1.5px solid rgba(196, 152, 255, 0.8); outline-offset: 3px; }

.sd-title {
  font-size: 12px;
  line-height: 16px;
  flex: none;
  letter-spacing: .04em;
  /* Theme-owned so it stays legible in both palettes; the lamp keeps its own
     violet identity, the words beside it follow the surrounding UI. */
  color: var(--dsw-alias-label-primary);
  white-space: nowrap;
  transition: color 240ms ease;
}
.sd-text-btn[data-lit="1"] .sd-title {
  font-weight: 500;
}

.sd-sub {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 15px;
  color: var(--dsw-alias-label-secondary);
  transition: color 240ms ease;
}
.sd-sub[data-error="1"] { color: var(--dsw-alias-state-error-primary); }

/* The one-line separator between state and detail. */
.sd-dot {
  flex: none;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  opacity: .38;
  align-self: center;
}.sd-sub[data-error="1"] { color: var(--dsw-alias-state-error-primary); }

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

/* the text block takes the free space; the stats pill sits at the end */
.sd-stats {
  position: relative;
  z-index: 1;
  flex: none;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.sd-stats[data-placeholder="1"] { opacity: .72; }

@media (prefers-reduced-motion: reduce) {
  .sd-dock * { animation: none !important; transition: none !important; }
}
`;

    function useLampStyles() {
      React.useEffect(function () {
        if (typeof document === 'undefined') return undefined;
        const id = 'shen-deng/lamp-console.css';
        if (document.querySelector('style[data-plugin-css="' + id + '"]') !== null) return undefined;
        const tag = document.createElement('style');
        tag.dataset.plugin = '@local/shen-deng';
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
    function LampConsole(props) {
      const t = props.translate();
      const value = lampStateOf(props.useProjection('shenDeng'));
      const rawUsage = props.useProjection('shenDengUsage');
      const usage = rawUsage && typeof rawUsage === 'object'
        ? { checks: Number(rawUsage.checks) || 0, gaps: Number(rawUsage.gaps) || 0 }
        : { checks: 0, gaps: 0 };
      const lit = value.lit;
      const [busy, setBusy] = React.useState(false);
      const [failure, setFailure] = React.useState(null);
      useLampStyles();

      const toggle = function () {
        if (busy) return;
        setBusy(true);
        setFailure(null);
        Promise.resolve(props.execute(lit ? '/lamp off' : '/lamp on')).then(
          function (error) {
            setBusy(false);
            if (error !== null && error !== undefined) setFailure(String(error));
          },
          function (error) {
            setBusy(false);
            setFailure(error instanceof Error ? error.message : String(error));
          },
        );
      };

      const badge = busy ? t('switchWorking') : lit ? t('switchOn') : t('switchOff');
      const subtitle = failure !== null
        ? failure
        : busy
          ? t('switchWorking')
          : lit
            ? t('dockSubOn')
            : t('dockSubOff');

      const stateLabel = lit ? t('switchOn') : t('switchOff');
      const meta = failure !== null
        ? failure
        : busy
          ? t('switchWorking')
          : lit
            ? t('dockMetaOn')
            : t('dockMeta');

      return h('div', { className: 'sd-dock' },
        h('div', { className: 'sd-row', 'data-lit': lit ? '1' : '0' },
          // The lamp IS the control: no track, no knob. Pressing the lamp
          // lights it; pressing again puts it out.
          h('button', {
            type: 'button',
            className: 'sd-lampbtn',
            'data-lit': lit ? '1' : '0',
            'aria-pressed': lit,
            'aria-label': lit ? t('switchOnTitle') : t('switchOffTitle'),
            title: lit ? t('switchOnTitle') : t('switchOffTitle'),
            disabled: busy,
            onClick: toggle,
          },
            h(AladdinLamp, { size: 24, lit: lit }),
            lit
              ? h(React.Fragment, null,
                  h('span', { className: 'sd-ember', style: { left: 3, top: 2, animationDelay: '0ms' } }),
                  h('span', { className: 'sd-ember', style: { left: 9, top: 0, animationDelay: '950ms' } }),
                )
              : null,
          ),

          h('button', {
            type: 'button',
            className: 'sd-text-btn',
            'data-lit': lit ? '1' : '0',
            'aria-pressed': lit,
            disabled: busy,
            onClick: toggle,
            title: lit ? t('switchOnTitle') : t('switchOffTitle'),
          },
            h('span', { className: 'sd-title' }, stateLabel),
            h('span', { className: 'sd-dot', 'aria-hidden': true }),
            failure !== null
              ? h('span', { className: 'sd-sub', 'data-error': '1', title: failure }, failure)
              : h('span', { className: 'sd-sub' }, meta),
          ),

          // Real counts folded from this Session's own log — not an estimate.
          h('span', {
            className: 'sd-stats',
            'data-placeholder': usage.checks === 0 ? '1' : '0',
            title: usage.checks === 0
              ? t('statsPending')
              : fill(t('statsChecks'), { n: usage.checks }) + ' · ' + fill(t('statsGaps'), { n: usage.gaps }),
          },
            usage.checks === 0
              ? t('statsPending')
              : fill(t('statsChecks'), { n: usage.checks }) + ' · ' + fill(t('statsGaps'), { n: usage.gaps })),
        ),
      );
    }

    /**
     * Settings page for the dimension table.
     *
     * Reads the volatile `dimensions` field through the shared config-form
     * store and writes the whole list through `settings.update`, which
     * persists into the profile patch and applies in place (no restart).
     */
    function LampSettingsPage(props) {
      const t = props.translate();
      const form = props.form();
      const readSnapshot = function () { return form.getSnapshot(); };
      const subscribe = typeof form.subscribe === 'function'
        ? function (notify) { return form.subscribe(notify); }
        : function () { return function () {}; };
      const snapshot = React.useSyncExternalStore(subscribe, readSnapshot);

      const seed = function () {
        const dims = snapshot && snapshot.value && Array.isArray(snapshot.value.dimensions)
          ? snapshot.value.dimensions
          : [];
        return dims.map(function (d) {
          return {
            id: String(d.id ?? ''),
            label: String(d.label ?? ''),
            match: Array.isArray(d.match) ? d.match.join(', ') : String(d.match ?? ''),
            ask: String(d.ask ?? ''),
            suggest: String(d.suggest ?? ''),
          };
        });
      };

      const [rows, setRows] = React.useState(seed);
      const [status, setStatus] = React.useState(null);
      const [dirty, setDirty] = React.useState(false);

      const edit = function (index, key, value) {
        setDirty(true);
        setRows(function (list) {
          const next = list.slice();
          next[index] = { ...next[index], [key]: value };
          return next;
        });
      };
      const add = function () {
        setDirty(true);
        setRows(function (list) { return [...list, { id: '', label: '', match: '', ask: '', suggest: '' }]; });
      };
      const remove = function (index) {
        setDirty(true);
        setRows(function (list) { return list.filter(function (_, i) { return i !== index; }); });
      };
      const revert = function () { setRows(seed); setDirty(false); setStatus(null); };

      const save = async function () {
        setStatus('saving');
        const dimensions = rows.map(function (r) {
          return {
            id: r.id.trim(),
            label: r.label.trim(),
            match: r.match.split(',').map(function (x) { return x.trim(); }).filter(Boolean),
            ask: r.ask.trim(),
            suggest: r.suggest.trim(),
          };
        });
        const ids = new Set();
        for (const d of dimensions) {
          if (d.id === '') { setStatus(t('cfgErrId')); return; }
          if (d.match.length === 0) { setStatus(t('cfgErrMatch')); return; }
          if (ids.has(d.id)) { setStatus(t('cfgErrDup')); return; }
          ids.add(d.id);
        }
        try {
          const revision = snapshot && snapshot.revision;
          const result = await props.update(dimensions, revision);
          if (result && result.ok === false) {
            setStatus(result.error ? `${result.error.message} (${result.error.code})` : t('cfgErrSave'));
            return;
          }
          setDirty(false);
          setStatus(t('cfgSaved'));
        } catch (error) {
          setStatus(error instanceof Error ? error.message : String(error));
        }
      };

      const inputStyle = {
        flex: '1 1 120px',
        minWidth: 0,
        padding: '3px 6px',
        border: '0.5px solid var(--dsw-alias-border-l2)',
        borderRadius: 'var(--dsw-radius-sm, 6px)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: 11.5,
      };

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--dsw-alias-label-primary)', fontSize: 12 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          h('span', { style: { color: 'var(--dsw-alias-label-secondary)', flex: 1 } },
            snapshot && snapshot.writable === false ? t('cfgReadonly') : t('cfgIntro')),
          h('button', {
            type: 'button', onClick: add,
            style: { border: '0.5px solid var(--dsw-alias-border-l2)', background: 'none', color: 'var(--dsw-alias-label-secondary)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', font: 'inherit' },
          }, t('cfgAdd')),
        ),
        rows.map(function (row, index) {
          return h('div', {
            key: index,
            style: {
              display: 'grid', gridTemplateColumns: '86px 1fr 1fr', gap: '6px 8px',
              padding: 8, border: '0.5px solid var(--dsw-alias-border-l1)', borderRadius: 8,
            },
          },
            h('span', { style: { gridColumn: '1 / 2', color: 'var(--dsw-alias-label-secondary)', alignSelf: 'center' } }, t('cfgFieldId')),
            h('input', { value: row.id, onChange: function (e) { edit(index, 'id', e.target.value); }, style: inputStyle, placeholder: 'tone' }),
            h('span', { style: { alignSelf: 'center', display: 'flex', justifyContent: 'flex-end' } },
              h('button', {
                type: 'button', onClick: function () { remove(index); },
                style: { border: '0.5px solid var(--dsw-alias-border-l2)', background: 'none', color: 'var(--dsw-alias-state-error-primary)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', font: 'inherit' },
              }, t('cfgRemove'))),
            h('span', { style: { color: 'var(--dsw-alias-label-secondary)', alignSelf: 'center' } }, t('cfgFieldLabel')),
            h('input', { value: row.label, onChange: function (e) { edit(index, 'label', e.target.value); }, style: inputStyle, placeholder: '调性' }),
            h('span'),
            h('span', { style: { color: 'var(--dsw-alias-label-secondary)', alignSelf: 'center' } }, t('cfgFieldMatch')),
            h('div', { style: { gridColumn: '2 / 4', display: 'flex', flexDirection: 'column', gap: 4 } },
              h('input', { value: row.match, onChange: function (e) { edit(index, 'match', e.target.value); }, style: inputStyle, placeholder: '幽默, 严肃, /字数?\s*\d+/' }),
              h('span', { style: { fontSize: 10.5, color: 'var(--dsw-alias-label-secondary)' } }, t('cfgMatchHint'))),
            h('span', { style: { color: 'var(--dsw-alias-label-secondary)', alignSelf: 'center' } }, t('cfgFieldAsk')),
            h('input', { value: row.ask, onChange: function (e) { edit(index, 'ask', e.target.value); }, style: inputStyle }),
            h('span'),
            h('span', { style: { color: 'var(--dsw-alias-label-secondary)', alignSelf: 'center' } }, t('cfgFieldSuggest')),
            h('input', { value: row.suggest, onChange: function (e) { edit(index, 'suggest', e.target.value); }, style: inputStyle }),
            h('span'),
          );
        }),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          h('button', {
            type: 'button', onClick: save, disabled: !dirty || busyUnsupported(),
            style: {
              border: '0.5px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-2)',
              color: dirty ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
              borderRadius: 6, padding: '3px 12px', cursor: dirty ? 'pointer' : 'default', font: 'inherit',
            },
          }, t('cfgSave')),
          dirty ? h('button', {
            type: 'button', onClick: revert,
            style: { border: '0', background: 'none', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer', font: 'inherit' },
          }, t('cfgRevert')) : null,
          status !== null
            ? h('span', {
                role: 'status',
                style: { color: /失败|错误|fail/i.test(status) ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-label-secondary)' },
              }, status)
            : null,
        ),
      );

      function busyUnsupported() { return snapshot != null && snapshot.writable === false; }
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

        // The real seat: below the composer card, once a Session exists.
        // Settings page: edit the dimension table without touching patch.yml.
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'shen-deng-dimensions',
          order: 40,
          label: labelThunk(localeSvc),
          inject: () => ({
            translate: makeTranslator(localeSvc),
            form: () => ctx.configForms.get('shen-deng'),
            update: async (dimensions, revision) => {
              const settings = ctx.remote?.settings;
              if (settings === undefined || typeof settings.update !== 'function') {
                return { ok: false, error: { message: t0('cfgErrSave'), code: 'no-settings' } };
              }
              return settings.update('shen-deng', { dimensions }, revision);
            },
          }),
        }, LampSettingsPage));

        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'shen-deng-console',
          order: 20,
          label: labelThunk(localeSvc),
          inject: (sessionId) => ({
            translate: makeTranslator(localeSvc),
            execute: runLamp(sessionId),
          }),
        }, LampConsole));

      },
    };
  },
});
