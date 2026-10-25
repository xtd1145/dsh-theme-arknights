#!/usr/bin/env node
"use strict"
/**
 * test/shoot.js — 把主题注入一个**真实的 DSH 页面**并截图三套阵营 × 两个档位。
 *
 * 为什么不是单元测试：令牌层与样式表最终要落到应用自己的 DOM 上，而「--ak-*
 * 声明在 <body> 上、--dsw-alias-* 以 var() 引用它们」这条链路只有在真实页面里
 * 才成立。所以这个脚本连 CDP，注入 client.js（用一份会像应用那样把令牌写成
 * <body> 行内样式的假 theme 服务，加一份可写的假 configForms 偏好通道），然后
 * 逐个档位与阵营截图。档位走偏好通道而不是手工加 class：界面版本是 prefs 读的，
 * 手工 class 拍到的是运行时不存在的组合。
 *
 * 它**不修改** profile、不安装插件：注入只发生在这一张临时浏览器标签里。
 *
 * 用法：
 *   node test/shoot.js                 # 截本地的仿 DSH 骨架页面（默认，可靠）
 *   node test/shoot.js <url>           # 截一个真实的 DSH 页面（需要带 token）
 *   node test/shoot.js fixture dark    # 只截暗色
 *
 * 产物：docs/screenshots/*.png（进阶版 6 张 + 莱茵终端档 6 张）
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const { pathToFileURL } = require('url')

const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'docs', 'screenshots')
const FIXTURE = path.join(__dirname, 'fixtures', 'preview.html')

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]

const PORT = 9341
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function findBrowser() {
  for (const candidate of EDGE_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate
  }
  throw new Error('找不到 Edge 或 Chrome，无法截图')
}

/** 极简 CDP 客户端。 */
async function connect() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json()
      const page = list.find((target) => target.type === 'page')
      if (page !== undefined) return page
    } catch (error) { /* 还没起来 */ }
    await sleep(300)
  }
  throw new Error('CDP 连不上')
}

async function main() {
  /* 默认截本地 fixture：它自包含、不依赖任何正在跑的服务，也不碰用户的 profile。
     传一个 http URL 时才去截真实页面（那种页面需要带 token 才能进去）。 */
  const arg = process.argv[2]
  const useFixture = arg === undefined || arg === 'fixture' || arg === ''
  const url = useFixture ? pathToFileURL(FIXTURE).href : arg
  const modeFilter = process.argv[3] || 'both'

  const browserPath = findBrowser()
  const profileDir = path.join(os.tmpdir(), 'dsh-arknights-shots-' + Date.now())
  const browser = spawn(
    browserPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--window-size=1600,1000',
      '--remote-debugging-port=' + PORT,
      '--user-data-dir=' + profileDir,
      'about:blank',
    ],
    { stdio: 'ignore' }
  )
  const cleanup = () => { try { browser.kill() } catch (error) { /* 已经退出 */ } }
  process.on('exit', cleanup)

  const page = await connect()
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
  })

  let nextId = 1
  const pending = new Map()
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    const entry = pending.get(message.id)
    if (entry === undefined) return
    pending.delete(message.id)
    if (message.error === undefined) entry.resolve(message.result)
    else entry.reject(new Error(JSON.stringify(message.error)))
  }
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = nextId += 1
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params: params || {} }))
  })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails !== undefined) {
      throw new Error('页面内异常: ' + JSON.stringify(result.exceptionDetails).slice(0, 600))
    }
    return result.result.value
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false,
  })

  console.log('打开 ' + (useFixture ? 'fixtures/preview.html' : String(url).replace(/token=[^&]+/, 'token=***')))
  await send('Page.navigate', { url })
  /* 真实页面要加载会话与工作区，给足时间；fixture 是静态的，快得多。 */
  await sleep(useFixture ? 1200 : 9000)

  const title = await evaluate('document.title')
  console.log('页面标题: ' + String(title))

  /* ---- 注入主题 ---------------------------------------------------- */

  const bundle = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8')

  await evaluate(`
    window.__akCaptured = null;
    window.__ModuleLoader__ = { load: (definition) => { window.__akCaptured = definition; } };

    /* 假的 Host 偏好通道（configForms 那一代）。真实页面上这一层是 Host 提供的
       可写 section；有了它，截图脚本才能像用户改设置一样把「界面版本」递进
       client——档位是靠 prefs 读的，不是靠 body class，所以手工加 class 拍到的是
       一个运行时不存在的组合（陶瓷材质 + 进阶版文案）。 */
    window.__akSection = {};
    window.__akNotify = null;
    window.__akForm = {
      getSnapshot: () => ({ status: 'ready', writable: true, value: window.__akSection }),
      subscribe: (listener) => {
        window.__akNotify = listener;
        return () => { window.__akNotify = null; };
      },
      set: (field, value) => {
        window.__akSection[field] = String(value);
        return Promise.resolve(true);
      },
      unset: (field) => { delete window.__akSection[field]; return Promise.resolve(true); },
    };
    'shim ready'
  `)

  await evaluate(bundle + '\n; "bundle evaluated"')

  const injected = await evaluate(`
    (() => {
      if (window.__akCaptured === null) return { error: '没有捕获到模块定义' };
      const mod = window.__akCaptured.factory((spec) => { throw new Error('no module ' + spec); });

      /* 假 theme 服务：像应用一样把每个令牌写成 <body> 的行内样式。
         这正是「切阵营只是一个 class」那条机制的验证点——行内样式里是
         var(--ak-*)，而 --ak-* 由样式表按 <body> 的 class 声明。 */
      const isDark = () => document.body.hasAttribute('data-ds-dark-theme');
      const theme = {
        overrideTokens: (source, tokens) => {
          window.__akLayer = tokens;
          for (const [name, pair] of Object.entries(tokens)) {
            document.body.style.setProperty(name, isDark() ? pair.dark : pair.light);
          }
          return () => {};
        },
      };
      const slots = {
        inject: (name, callback) => callback(),
        register: () => () => {},
      };
      const configForms = {
        get: (ns) => (ns === 'theme-arknights' ? window.__akForm : null),
        describe: () => ({ getSnapshot: () => ({ view: { namespaces: [{ ns: 'theme-arknights' }] } }) }),
      };
      const ctx = {
        get: (key) => ({ theme, slots, configForms })[key],
        effect: (callback) => { window.__akDispose = callback(); },
      };
      mod.apply(ctx);
      return {
        applied: window.__dshThemeArknightsApplied === true,
        classes: document.body.className,
        styleSheets: document.querySelectorAll('style[data-plugin="dsh-theme-arknights"]').length,
        tokenCount: Object.keys(window.__akLayer || {}).length,
      };
    })()
  `)
  console.log('注入结果: ' + JSON.stringify(injected))

  /* ---- 逐档位 × 阵营截图 -------------------------------------------- */

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const shots = []
  /* fixture 才有「会话页 / 空状态」两个可切的状态；真实页面拍它当前这一屏。 */
  const states = useFixture ? ['chat', 'deploy'] : ['chat']
  for (const stateName of states) {
    if (useFixture) {
      await evaluate(`document.body.setAttribute('data-ak-state', '${stateName}'); '${stateName}'`)
      await sleep(250)
    }
    for (const mode of (modeFilter === 'both' ? ['light', 'dark'] : [modeFilter])) {
      for (const tier of ['advanced', 'lab']) {
        for (const faction of ['rhodes', 'laterano', 'rhine']) {
        const key = faction === 'rhodes' ? '1' : faction === 'laterano' ? '2' : '3'
        await evaluate(`
          (() => {
            const dark = ${mode === 'dark'};
            if (dark) document.body.setAttribute('data-ds-dark-theme', '');
            else document.body.removeAttribute('data-ds-dark-theme');
            /* 应用在明暗切换时会重设全部令牌，这里照做。 */
            if (window.__akLayer) {
              for (const [name, pair] of Object.entries(window.__akLayer)) {
                document.body.style.setProperty(name, dark ? pair.dark : pair.light);
              }
            }
            /* 档位经 Host 通道下发：section 变 → 订阅 → reconcileFromPrefs 重排
               body class 并重画终端文案。 */
            window.__akSection.layout = '${tier}';
            if (window.__akNotify) window.__akNotify();
            document.dispatchEvent(new KeyboardEvent('keydown', {
              key: '${key}', ctrlKey: true, shiftKey: true, bubbles: true,
            }));
            return document.body.className;
          })()
        `)
        await sleep(700)
        const state = await evaluate(`
          (() => {
            const body = document.body;
            const badge = document.querySelector('.ak-bar__badge');
            const bar = document.querySelector('.ak-bar');
            const bg = getComputedStyle(body).backgroundColor;
            const ink = getComputedStyle(body).color;
            /* 强调色与纸面都读**解析后**的值：--edge-accent 由样式表按 <body> 的
               class 定义，能读到具体 hex 就证明变量组真的生效了。 */
            const accent = getComputedStyle(body).getPropertyValue('--edge-accent').trim();
            const paper = getComputedStyle(body).getPropertyValue('--edge-paper').trim();
            /* 令牌层写进行内样式的值仍是 var(--edge-*) 字面量（自定义属性不会在
               getPropertyValue 里被解析），所以要验证的是「它被换成了变量引用」
               而不是「被解析成颜色」——前者才是这套机制成立的条件。 */
            const tokenRef = getComputedStyle(body).getPropertyValue('--dsw-alias-bg-base').trim();
            /* 档位文案是终端层在每次扫描时重写的：读到 RHINE 就证明 lab 这一档
               不只是叠了 CSS，DOM 层的词表也跟着换了档。 */
            const deck = document.querySelector('[data-ak-part="deckBrand"]');
            const foot = document.querySelector('[data-ak-part="footChannel"]');
            /* 两级选择的实际形状：容器是否横排、柱子是否纵向、方块是否横向。
               读 getBoundingClientRect 而不是猜 class——「一列一列」和「一个一个
               方块」是几何承诺，只有盒子尺寸能证明它兑现了。 */
            const box = (el) => {
              if (el === null) return null;
              const r = el.getBoundingClientRect();
              return { w: Math.round(r.width), h: Math.round(r.height) };
            };
            const dirOf = (sel) => {
              const el = document.querySelector(sel);
              if (el === null) return null;
              const cs = getComputedStyle(el);
              /* flexDirection 对非 flex 容器也返回 'row'（那是它的初始值，不是
                 生效值），所以必须先判 display。只看方向会把进阶版误判成横排。 */
              const flex = cs.display === 'flex' || cs.display === 'inline-flex';
              return { display: cs.display, row: flex && cs.flexDirection.indexOf('row') === 0 };
            };
            const column = document.querySelector("[data-ak-tui='sector-row']");
            const block = document.querySelector('[data-ak-block]');
            return {
              classes: body.className,
              accent,
              paper,
              background: bg,
              ink,
              badge: badge === null ? null : badge.textContent,
              barItems: bar === null ? 0 : bar.querySelectorAll('.ak-bar__item').length,
              deck: deck === null ? null : deck.textContent,
              foot: foot === null ? null : foot.textContent,
              sectors: document.querySelectorAll('[class*="_projectRow"] .ak-sector-code').length,
              tokenRef,
              columnField: dirOf("[data-ak-tui='column-field']"),
              sessionStack: dirOf("[data-ak-tui='session-stack']"),
              column: box(column),
              block: box(block),
              blocks: document.querySelectorAll('[data-ak-block]').length,
              readout: (() => {
                const a = document.querySelector('[data-ak-part="readoutActive"]');
                const t = document.querySelector('[data-ak-part="readoutTotal"]');
                return a === null || t === null ? null : a.textContent + '/' + t.textContent;
              })(),
              keys: (() => {
                const k = document.querySelector('[data-ak-part="keysHint"]');
                return k === null ? null : k.textContent;
              })(),
            };
          })()
        `)
        const name = (tier === 'lab' ? 'lab-' : '')
          + (stateName === 'deploy' ? 'deploy-' : '')
          + faction + '-' + mode + '.png'
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
        fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(shot.data, 'base64'))
        shots.push({ name, faction, mode, tier, stateName, state })
        console.log('  ' + name + '  accent=' + state.accent + '  paper=' + state.paper
          + '  deck=' + state.deck + '  sectors=' + state.sectors
          + '  col=' + (state.columnField === null ? '-' : (state.columnField.row ? 'row' : 'col'))
          + '  blk=' + (state.sessionStack === null ? '-' : (state.sessionStack.row ? 'row' : 'col'))
          + '  readout=' + state.readout + '  badge=' + state.badge)
        }
      }
    }
  }

  /* ---- 报告 -------------------------------------------------------- */

  console.log('\n=== 一致性检查')
  let problems = 0

  for (const shot of shots) {
    const wanted = shot.faction
    const classes = String(shot.state.classes)

    /* ---- 阵营 class 必须与文件名一致 ---- */
    const hasLaterano = classes.indexOf('theme-arknights-laterano') !== -1
    const hasRhine = classes.indexOf('theme-arknights-rhine') !== -1
    const classOk =
      wanted === 'laterano' ? hasLaterano && !hasRhine
        : wanted === 'rhine' ? hasRhine && !hasLaterano
          : !hasLaterano && !hasRhine
    if (classOk) {
      console.log('  ok   ' + shot.name + ': class 与阵营一致')
    } else {
      console.log('  FAIL ' + shot.name + ': class 与阵营不符 (' + classes + ')')
      problems += 1
    }

    /* ---- 主题与进阶版标记必须在位 ---- */
    if (classes.indexOf('theme-arknights-themed') !== -1) {
      console.log('  ok   ' + shot.name + ': 带 themed 标记')
    } else {
      console.log('  FAIL ' + shot.name + ': 缺少 theme-arknights-themed')
      problems += 1
    }

    /* ---- 档位 class ----
       lab 是叠在 advanced 之上的一层材质，所以两个 class 必须同时在位；只多了
       lab 而没带上 advanced，说明 syncLayoutClass 的层叠写错了。 */
    const hasAdvanced = classes.indexOf('theme-arknights-advanced') !== -1
    const hasLabClass = classes.indexOf('theme-arknights-lab') !== -1
    const tierClassOk = shot.tier === 'lab' ? hasAdvanced && hasLabClass : hasAdvanced && !hasLabClass
    if (tierClassOk) {
      console.log('  ok   ' + shot.name + ': 档位 class 正确（' + shot.tier + '）')
    } else {
      console.log('  FAIL ' + shot.name + ': 档位 class 不符 (' + classes + ')')
      problems += 1
    }

    /* ---- 终端文案跟着档位走 ----
       铭牌词表由 36-terminal-ui.js 在每次扫描时按 readLayout() 重写：读到 RHINE
       而不只是陶瓷底色，才证明 DOM 层也切了档。fixture 里没有应用那套
       `_sidebarCol` / `_projectRow` 锚点，DOM 层不会挂载——读不到铭牌就跳过，
       截真实页面（node test/shoot.js <url>）时这一条才会真的判。 */
    const wantedDeck = shot.tier === 'lab' ? 'RHINE' : 'PRTS'
    if (shot.state.deck === null) {
      console.log('  --   ' + shot.name + ': 页面上没有终端铭牌，跳过文案判定')
    } else {
      if (String(shot.state.deck) === wantedDeck) {
        console.log('  ok   ' + shot.name + ': 铭牌文案 = ' + wantedDeck)
      } else {
        console.log('  FAIL ' + shot.name + ': 铭牌文案是 ' + shot.state.deck + '，应为 ' + wantedDeck + '（档位只改了 CSS，DOM 层没跟上）')
        problems += 1
      }
      if (Number(shot.state.sectors) > 0) {
        console.log('  ok   ' + shot.name + ': 工作区行编号 ' + shot.state.sectors + ' 条')
      } else {
        console.log('  FAIL ' + shot.name + ': 侧栏没有一条工作区编号，终端 DOM 层没挂上')
        problems += 1
      }
    }

    /* ---- 两级选择的几何：柱列横排 + 方块横排 ----
       莱茵终端档的承诺是「工作区纵向一列一列、会话横向一个一个方块」——那是
       几何而不是颜色，所以判容器的 flex 方向与盒子长宽比。进阶版必须仍然是
       纵向清单：两档拍出来一样，说明这一档只改了底色没改结构。
       fixture 没有侧栏滚动条，柱子/方块的尺寸完全由样式表决定，正好当量尺。 */
    const isLab = shot.tier === 'lab'
    if (shot.state.columnField === null) {
      console.log('  --   ' + shot.name + ': 页面上没有柱列/方块容器，跳过几何判定')
    } else {
      const dirChecks = [
        ['柱列容器', shot.state.columnField],
        ['方块容器', shot.state.sessionStack],
      ]
      for (const [label, dir] of dirChecks) {
        if (dir === null) {
          console.log('  FAIL ' + shot.name + ': 找不到' + label + '，两级容器没标出来')
          problems += 1
          continue
        }
        const good = isLab ? dir.row === true : dir.row !== true
        if (good) {
          console.log('  ok   ' + shot.name + ': ' + label + ' ' + dir.display
            + (dir.row ? ' 横排' : ' 纵向'))
        } else {
          console.log('  FAIL ' + shot.name + ': ' + label + ' ' + dir.display
            + (dir.row ? ' 横排' : ' 纵向') + '（' + shot.tier + ' 档应为 ' + (isLab ? '横排' : '纵向') + '）')
          problems += 1
        }
      }
      /* 两档各给一个判据，不复用同一个取反：进阶版的清单行是「宽>高且很矮」，
         而 lab 的方块也是「宽>高」——只是高得多。取反会把这两种形状混为一谈。 */
      const shapes = [
        ['工作区柱子', shot.state.column, (b) => b.h > b.w && b.h >= 90, (b) => b.w > b.h && b.h < 48, '竖柱', '清单行'],
        ['会话方块', shot.state.block, (b) => b.w > b.h && b.h >= 60, (b) => b.w > b.h && b.h < 48, '横方块', '清单行'],
      ]
      for (const [label, box, labTest, advTest, labWant, advWant] of shapes) {
        if (box === null) {
          console.log('  FAIL ' + shot.name + ': 找不到' + label + '，终端层没挂上')
          problems += 1
          continue
        }
        const good = isLab ? labTest(box) : advTest(box)
        if (good) {
          console.log('  ok   ' + shot.name + ': ' + label + ' ' + box.w + '×' + box.h
            + ' = ' + (isLab ? labWant : advWant))
        } else {
          console.log('  FAIL ' + shot.name + ': ' + label + ' ' + box.w + '×' + box.h
            + '，' + shot.tier + ' 档应为 ' + (isLab ? labWant : advWant))
          problems += 1
        }
      }
      if (/^\d\d\/\d\d$/.test(String(shot.state.readout))) {
        console.log('  ok   ' + shot.name + ': 大读数 ' + shot.state.readout + '（当前列 / 总列）')
      } else {
        console.log('  FAIL ' + shot.name + ': 大读数不是两位/两位 (' + shot.state.readout + ')')
        problems += 1
      }
      const wantedKeys = isLab ? '换列' : '浏览'
      if (String(shot.state.keys).indexOf(wantedKeys) !== -1) {
        console.log('  ok   ' + shot.name + ': 键位提示跟随档位')
      } else {
        console.log('  FAIL ' + shot.name + ': 键位提示是「' + shot.state.keys + '」，缺「' + wantedKeys + '」')
        problems += 1
      }
      if (!isLab || Number(shot.state.blocks) > 0) {
        console.log('  ok   ' + shot.name + ': 会话方块 ' + shot.state.blocks + ' 块')
      } else {
        console.log('  FAIL ' + shot.name + ': 一块会话方块都没标出来')
        problems += 1
      }
    }

    /* ---- 强调色必须解析成具体颜色（证明六组变量真的生效） ---- */
    if (/^#[0-9a-fA-F]{6}$/.test(String(shot.state.accent))) {
      console.log('  ok   ' + shot.name + ': --edge-accent = ' + shot.state.accent)
    } else {
      console.log('  FAIL ' + shot.name + ': --edge-accent 没有解析 (' + shot.state.accent + ')')
      problems += 1
    }

    /* ---- 令牌层必须真的跟着阵营走 ----
       Chromium 的 getPropertyValue 对自定义属性返回**已解析**的值，所以行内那句
       `var(--edge-paper)` 读回来是一个具体颜色。这恰好是最强的证据：它等于该阵营
       自己的纸色，就说明「令牌层 → var(--edge-*) → 样式表变量组」这条链真的通了，
       而且换阵营时整条链一起变。 */
    const tokenRef = String(shot.state.tokenRef)
    const paper = String(shot.state.paper)
    if (/^#[0-9a-fA-F]{6}$/.test(tokenRef) && tokenRef.toLowerCase() === paper.toLowerCase()) {
      console.log('  ok   ' + shot.name + ': 令牌层跟着阵营走 (' + tokenRef + ' = --edge-paper)')
    } else {
      console.log('  FAIL ' + shot.name + ': 令牌层没有跟随阵营 (--dsw-alias-bg-base=' + tokenRef + '  --edge-paper=' + paper + ')')
      problems += 1
    }

    /* ---- 悬浮阵营条必须挂上，且有 3 个阵营 ---- */
    if (shot.state.barItems === 3) {
      console.log('  ok   ' + shot.name + ': 悬浮条有 3 个阵营，徽标 ' + shot.state.badge)
    } else {
      console.log('  FAIL ' + shot.name + ': 悬浮条异常，按钮数 ' + shot.state.barItems + '，徽标 ' + shot.state.badge)
      problems += 1
    }
  }
  /* ---- 档位换的是材质，不是身份 ----
     与同阵营同明暗的进阶版截图对照：accent 必须一模一样（颜色只有阵营那一份
     真相），paper 必须不同（否则这一档切了等于没切）。 */
  for (const shot of shots) {
    if (shot.tier !== 'lab') continue
    const base = shots.find(
      (other) => other.tier === 'advanced' && other.faction === shot.faction
        && other.mode === shot.mode && other.stateName === shot.stateName
    )
    if (base === undefined) continue
    if (String(base.state.accent).toLowerCase() === String(shot.state.accent).toLowerCase()) {
      console.log('  ok   ' + shot.name + ': 强调色仍归阵营 (' + shot.state.accent + ')')
    } else {
      console.log('  FAIL ' + shot.name + ': 档位越界改了强调色 (' + base.state.accent + ' → ' + shot.state.accent + ')')
      problems += 1
    }
    if (String(base.state.paper).toLowerCase() !== String(shot.state.paper).toLowerCase()) {
      console.log('  ok   ' + shot.name + ': 纸面家族已换 (' + base.state.paper + ' → ' + shot.state.paper + ')')
    } else {
      console.log('  FAIL ' + shot.name + ': 纸面没换 (' + shot.state.paper + ')，lab 层未生效')
      problems += 1
    }
  }
  console.log(problems === 0 ? '  全部一致' : '  ' + problems + ' 项问题')
  console.log('\n截图写入 ' + path.relative(ROOT, OUT_DIR))

  socket.close()
  cleanup()
  process.exit(problems === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('截图失败: ' + (error && error.message ? error.message : String(error)))
  process.exit(1)
})
