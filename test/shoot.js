#!/usr/bin/env node
"use strict"
/**
 * test/shoot.js — 把主题注入一个**真实的 DSH 页面**并截图三套阵营。
 *
 * 为什么不是单元测试：令牌层与样式表最终要落到应用自己的 DOM 上，而「--ak-*
 * 声明在 <body> 上、--dsw-alias-* 以 var() 引用它们」这条链路只有在真实页面里
 * 才成立。所以这个脚本连 CDP，注入 client.js（用一份会像应用那样把令牌写成
 * <body> 行内样式的假 theme 服务），然后逐个阵营截图。
 *
 * 它**不修改** profile、不安装插件：注入只发生在这一张临时浏览器标签里。
 *
 * 用法：
 *   node test/shoot.js                 # 截本地的仿 DSH 骨架页面（默认，可靠）
 *   node test/shoot.js <url>           # 截一个真实的 DSH 页面（需要带 token）
 *   node test/shoot.js fixture dark    # 只截暗色
 *
 * 产物：docs/screenshots/*.png
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
      const ctx = {
        get: (key) => ({ theme, slots })[key],
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

  /* ---- 逐个阵营截图 ------------------------------------------------ */

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const shots = []
  for (const mode of (modeFilter === 'both' ? ['light', 'dark'] : [modeFilter])) {
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
             class 定义，能读到具体 hex 就证明六组规则真的生效了。 */
          const accent = getComputedStyle(body).getPropertyValue('--edge-accent').trim();
          const paper = getComputedStyle(body).getPropertyValue('--edge-paper').trim();
          /* 令牌层写进行内样式的值仍是 var(--edge-*) 字面量（自定义属性不会在
             getPropertyValue 里被解析），所以要验证的是「它被换成了变量引用」
             而不是「被解析成颜色」——前者才是这套机制成立的条件。 */
          const tokenRef = getComputedStyle(body).getPropertyValue('--dsw-alias-bg-base').trim();
          return {
            classes: body.className,
            accent,
            paper,
            background: bg,
            ink,
            badge: badge === null ? null : badge.textContent,
            barItems: bar === null ? 0 : bar.querySelectorAll('.ak-bar__item').length,
            tokenRef,
          };
        })()
      `)
      const name = faction + '-' + mode + '.png'
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(shot.data, 'base64'))
      shots.push({ name, state })
      console.log('  ' + name + '  accent=' + state.accent + '  bg=' + state.background + '  badge=' + state.badge)
    }
  }

  /* ---- 报告 -------------------------------------------------------- */

  console.log('\n=== 一致性检查')
  let problems = 0

  /** 该截图对应的阵营，从文件名前缀取。 */
  const factionOfShot = (name) => name.split('-')[0]

  for (const shot of shots) {
    const wanted = factionOfShot(shot.name)
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
