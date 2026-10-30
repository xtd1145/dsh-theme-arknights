#!/usr/bin/env node
"use strict"
/**
 * test/verify-real.js — 在**真实的 DSH 页面**上验证主题。
 *
 * 与 test/shoot.js 的区别：shoot.js 打开的是一个仿 DSH 的 fixture 并手工注入
 * client.js；这个脚本打开的是 dsh web 真的服务出来的页面，插件由 DSH 自己挂载。
 * 所以它验证的是整条真实链路：profile 配置 → loader 挂载 → client bundle 收录 →
 * 浏览器执行 → 界面生效。
 *
 * 用法：
 *   node test/verify-real.js <带 token 的 URL>
 *
 * 退出码：0 通过 / 1 有问题。
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')

/* 截图落在临时目录：这里的页面是用户自己的真实工作区，工作区名与会话标题
   都会进画面，不能写进仓库的 docs/screenshots。 */
const OUT_DIR = path.join(os.tmpdir(), 'dsh-verify-out')
const PORT = 9353
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => fs.existsSync(p))

async function main() {
  const url = process.argv[2]
  if (url === undefined) {
    console.error('用法: node test/verify-real.js <带 token 的 dsh web URL>')
    process.exit(1)
  }
  if (EDGE === undefined) throw new Error('找不到 Edge/Chrome')

  const profileDir = path.join(os.tmpdir(), 'dsh-verify-' + Date.now())
  const browser = spawn(
    EDGE,
    [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--hide-scrollbars', '--window-size=1366,768',
      '--remote-debugging-port=' + PORT, '--user-data-dir=' + profileDir, 'about:blank',
    ],
    { stdio: 'ignore' }
  )
  const cleanup = () => { try { browser.kill() } catch (e) { /* gone */ } }
  process.on('exit', cleanup)

  let page = null
  for (let i = 0; i < 60 && page === null; i += 1) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json()
      page = list.find((t) => t.type === 'page') || null
    } catch (e) { /* not up yet */ }
    if (page === null) await sleep(300)
  }
  if (page === null) throw new Error('CDP 不可达')

  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })

  let nextId = 1
  const pending = new Map()
  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    const entry = pending.get(msg.id)
    if (entry === undefined) return
    pending.delete(msg.id)
    if (msg.error === undefined) entry.resolve(msg.result)
    else entry.reject(new Error(JSON.stringify(msg.error)))
  }
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = nextId += 1
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params: params || {} }))
  })
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails !== undefined) {
      return { __error: JSON.stringify(r.exceptionDetails).slice(0, 400) }
    }
    return r.result.value
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')

  /* 记录所有 /plugins/ 请求的状态，这是「client bundle 有没有被收录」的直接证据。 */
  const pluginRequests = []
  /* 同时收集页面内的报错：主题的默认关闭功能被打开时如果抛错，只会在控制台里
     留一行，界面看不出异常——那正是最难发现的一类问题。 */
  const consoleErrors = []
  socket.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.method === 'Network.responseReceived') {
      const r = msg.params.response
      if (r.url.indexOf('/plugins/') !== -1) {
        pluginRequests.push({ url: r.url.replace(/^https?:\/\/[^/]+/, ''), status: r.status })
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      consoleErrors.push('exception: ' + (d.exception && d.exception.description ? d.exception.description : d.text))
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      const text = (msg.params.args || []).map((a) => (a.value !== undefined ? a.value : a.description || '')).join(' ')
      consoleErrors.push('console.error: ' + String(text).slice(0, 300))
    }
  })

  console.log('打开真实 DSH 页面: ' + url.replace(/token=[^&]+/, 'token=***'))
  /* --window-size 在这台 Edge 上不生效（页面仍是 1600×1000）；直接锁视口。
     1366×768 是用户报「点开目录后柜面空白」的尺寸，柜面只有 ~220px 高，
     单行会话必须靠托盘才能留在视口里。 */
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1366, height: 768, deviceScaleFactor: 1, mobile: false,
  })
  await send('Page.navigate', { url })
  await sleep(12000)

  const report = await evaluate(`
    (() => {
      const body = document.body;
      const boot = window.__DSH_BOOT__ || null;
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.getAttribute('src'));
      return {
        title: document.title,
        bodyClasses: body === null ? null : body.className,
        hasBoot: boot !== null,
        scriptSrcs: scripts.filter(s => s && s.indexOf('/plugins/') !== -1),
        themeMarker: document.querySelectorAll('style[data-plugin="dsh-theme-arknights"]').length,
        bar: document.querySelectorAll('.ak-bar').length,
        edgeAccent: getComputedStyle(body).getPropertyValue('--edge-accent').trim(),
        edgePaper: getComputedStyle(body).getPropertyValue('--edge-paper').trim(),
        bodyBg: getComputedStyle(body).backgroundColor,
        tokenAttr: getComputedStyle(body).getPropertyValue('--dsw-alias-bg-base').trim(),
        themed: body.classList.contains('theme-arknights-themed'),
        advanced: body.classList.contains('theme-arknights-advanced'),
        /* 那些**默认关闭**的可选功能的运行时痕迹。它们只有被用户打开时才存在，
           所以这里报数即可，不做断言。 */
        loaderPlate: document.querySelectorAll('[data-ak-loader]').length,
        thunderPlate: document.querySelectorAll('[data-ak-thunder]').length,
        balanceCapsule: document.querySelectorAll('[data-ak-balance]').length,
        watermark: document.querySelectorAll('[data-ak-watermark]').length,
      };
    })()
  `)

  console.log('\n=== 页面状态')
  console.log('  标题        : ' + report.title)
  console.log('  boot 注入   : ' + report.hasBoot)
  console.log('  body class  : ' + report.bodyClasses)
  console.log('  /plugins/ 脚本: ' + JSON.stringify(report.scriptSrcs))
  console.log('  主题样式表   : ' + report.themeMarker + ' 个')
  console.log('  悬浮阵营条   : ' + report.bar + ' 个')
  console.log('  --edge-accent: ' + report.edgeAccent)
  console.log('  --edge-paper : ' + report.edgePaper)
  console.log('  body 背景    : ' + report.bodyBg)
  console.log('  令牌层值     : ' + report.tokenAttr)
  console.log('  themed/advanced: ' + report.themed + ' / ' + report.advanced)
  console.log('  可选功能节点: loader=' + report.loaderPlate
    + ' thunder=' + report.thunderPlate + ' capsule=' + report.balanceCapsule + ' watermark=' + report.watermark)

  if (consoleErrors.length > 0) {
    console.log('\n=== 页面报错（' + consoleErrors.length + ' 条）')
    for (const e of consoleErrors.slice(0, 8)) console.log('  ' + e)
  } else {
    console.log('\n  页面无 console.error / 未捕获异常')
  }

  console.log('\n=== /plugins/ 请求')
  for (const r of pluginRequests) console.log('  ' + r.status + '  ' + r.url)
  if (pluginRequests.length === 0) console.log('  （没有任何 /plugins/ 请求）')

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(path.join(OUT_DIR, 'real-page.png'), Buffer.from(shot.data, 'base64'))
  console.log('\n截图: ' + path.join(OUT_DIR, 'real-page.png'))

  /* ---- 在真实页面上逐个阵营切换并截图 ----------------------------------
     走的是**用户真正的入口**：向 document 派发 Ctrl+Shift+1/2/3。所以这一步验证
     的不只是「配色变量对不对」，而是「快捷键 → 偏好 → <body> class → 样式重解析」
     整条链在真机上通得过。最后切回罗德岛，避免把验证用的阵营留在用户的 profile 里。 */
  console.log('\n=== 真实页面逐个阵营切换')
  /* 强调色按**当前明暗**取值：三套阵营各有亮/暗两档，页面此刻处于哪一档由
     body[data-ds-dark-theme] 决定。写死一个值会在另一档下假失败。 */
  const EXPECTED_ACCENT = {
    rhodes: { light: '#1a6fa8', dark: '#4fb3e8' },
    laterano: { light: '#1a3fd0', dark: '#6b8cff' },
    rhine: { light: '#1a1a1c', dark: '#ececee' },
  }
  const factionShots = []
  for (const [key, expectFaction] of [
    ['2', 'laterano'],
    ['3', 'rhine'],
    ['1', 'rhodes'],
  ]) {
    await evaluate(`
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: '${key}', ctrlKey: true, shiftKey: true, bubbles: true,
      }));
      'sent'
    `)
    await sleep(900)
    const after = await evaluate(`
      (() => {
        const body = document.body;
        return {
          classes: body.className,
          isDark: body.hasAttribute('data-ds-dark-theme'),
          accent: getComputedStyle(body).getPropertyValue('--edge-accent').trim(),
          paper: getComputedStyle(body).getPropertyValue('--edge-paper').trim(),
          bg: getComputedStyle(body).backgroundColor,
          badge: (document.querySelector('.ak-bar__badge') || {}).textContent || null,
        };
      })()
    `)
    const cls = String(after.classes)
    const hasLaterano = cls.indexOf('theme-arknights-laterano') !== -1
    const hasRhine = cls.indexOf('theme-arknights-rhine') !== -1
    const classOk = expectFaction === 'laterano' ? hasLaterano && !hasRhine
      : expectFaction === 'rhine' ? hasRhine && !hasLaterano
        : !hasLaterano && !hasRhine
    const expectAccent = EXPECTED_ACCENT[expectFaction][after.isDark ? 'dark' : 'light']
    const accentOk = String(after.accent).toLowerCase() === expectAccent

    if (classOk && accentOk) {
      console.log('  ok   Ctrl+Shift+' + key + ' → ' + expectFaction + '  accent=' + after.accent + '  bg=' + after.bg + '  badge=' + after.badge)
    } else {
      console.log('  FAIL Ctrl+Shift+' + key + ' → 期望 ' + expectFaction + '/' + expectAccent
        + '，实际 class=' + cls + ' accent=' + after.accent)
    }

    const perShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    const fileName = 'real-' + expectFaction + '.png'
    fs.writeFileSync(path.join(OUT_DIR, fileName), Buffer.from(perShot.data, 'base64'))
    factionShots.push({ fileName, classOk, accentOk })
  }
  console.log('  截图: ' + factionShots.map((s) => s.fileName).join(', '))

  /* 莱茵终端档的柜面是唯一一块**只在真页面结构上才成立**的布局（fixture 里
     没有 per-item wrapper 与分组）。工作区板被摊平后必须全部落进同一面柜子，
     否则真页面就会退回「第一块 36px、其余 251px 铺满侧栏」的那次事故。 */
  const cabinet = await evaluate(`
    (() => {
      if (!document.body.classList.contains('theme-arknights-lab')) return { lab: false }
      const field = document.querySelector("[data-ak-tui='column-field']")
      const rows = Array.from(document.querySelectorAll("[data-ak-tui='sector-row']"))
      const activeRows = rows.filter((r) => r.getAttribute('data-ak-active') === 'true')
      const blocks = Array.from(document.querySelectorAll('[data-ak-block]'))
      const plate = document.querySelector('.ak-terminal-sector-head__plate')
      const sidebar = document.querySelector("[data-ak-tui='sidebar']")
      const box = (el) => {
        const r = el.getBoundingClientRect()
        return { w: Math.round(r.width), h: Math.round(r.height) }
      }
      /* 侧栏底部：0.2.1-rc.5 多了一行「更多」，而 session-manager 的「会话与工作
         区」写着 flex-basis:100% 会换到第二行，正好和它完全重叠（把主题样式表禁
         掉也一样叠）。文本叶子两两求交，非空就是撞上了。 */
      const leaves = Array.from(document.querySelectorAll("[data-slot='sidebar'] *")).filter((el) => {
        if (el.children.length > 0) return false
        const b = el.getBoundingClientRect()
        return b.top > 600 && b.width > 0 && b.height > 0 && (el.textContent || '').trim() !== ''
      }).map((el) => {
        const b = el.getBoundingClientRect()
        return { t: (el.textContent || '').trim().slice(0, 12), x: b.x, y: b.y, w: b.width, h: b.height }
      })
      const bottomOverlaps = []
      for (let i = 0; i < leaves.length; i += 1) {
        for (let j = i + 1; j < leaves.length; j += 1) {
          const a = leaves[i]
          const b = leaves[j]
          if (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2
            && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2) {
            bottomOverlaps.push(a.t + ' × ' + b.t)
          }
        }
      }
      return {
        lab: true,
        rows: rows.length,
        widths: rows.map((r) => Math.round(r.getBoundingClientRect().width)),
        heights: rows.map((r) => Math.round(r.getBoundingClientRect().height)),
        names: rows.map((r) => String(r.getAttribute('data-ak-name') || '').trim()),
        activeCount: activeRows.length,
        activeNames: activeRows.map((r) => String(r.getAttribute('data-ak-name') || '').trim()),
        field: field === null ? null : Object.assign(box(field), {
          rows: field.querySelectorAll("[data-ak-tui='sector-row']").length,
          blocks: field.querySelectorAll('[data-ak-block]').length,
          spillX: field.scrollWidth - field.clientWidth,
        }),
        blocks: blocks.length,
        plate: plate === null ? '' : plate.textContent.trim(),
        sidebarZ: sidebar === null ? null : getComputedStyle(sidebar).zIndex,
        bottomOverlaps,
      }
    })()
  `)
  if (cabinet.lab === false) {
    console.log('\n  当前界面版本不是莱茵终端档，跳过柜面结构检查')
  } else {
    console.log('\n=== 柜面（莱茵终端档）')
    console.log('  工作区板 : ' + cabinet.rows + ' 块，宽 ' + JSON.stringify(cabinet.widths))
    console.log('  会话板   : ' + cabinet.blocks + ' 块')
    console.log('  柜面     : ' + JSON.stringify(cabinet.field) + '  铭牌: ' + cabinet.plate)
  }

  /* ---- 点击一个折叠目录：它必须成为唯一的当前板，铭牌跟着换，柜面只排
     它这一组的会话；再点一次收回，页面回到部署工作区。这一步走的是真实的
     鼠标事件，覆盖「点击后没有反应、展开的会话淹在墙下」那次真机 bug。 */
  let clickProbe = null
  let clickRestored = null
  let clickTarget = null
  let clickTargets = []
  let hoverTarget = null
  let hoverTip = null
  if (cabinet.lab === true) {
    /* 可见、折叠、非当前的行里取前几个。真页面第一个往往是没有可渲染会话的
       目录；空态要验证，但「点开后会话在视口里」必须拿一个真有会话的目录来验。 */
    clickTargets = await evaluate(`
      (() => {
        const field = document.querySelector("[data-ak-tui='column-field']")
        if (field === null) return []
        const fr = field.getBoundingClientRect()
        return Array.from(document.querySelectorAll("[data-ak-tui='sector-row']"))
          .filter((r) => r.getAttribute('data-ak-active') !== 'true'
            && r.getAttribute('aria-expanded') === 'false'
            && (() => {
              const b = r.getBoundingClientRect()
              return b.top >= fr.top && b.bottom <= fr.bottom && b.width > 0 && b.height > 0
            })())
          .slice(0, 8)
          .map((r) => ({
            key: r.getAttribute('data-row-key'),
            name: String(r.getAttribute('data-ak-name') || '').trim(),
          }))
      })()
    `)
    if (clickTargets.length === 0) {
      console.log('\n  没有可点击的折叠目录（可能全部展开），跳过点击验证')
    } else {
      hoverTarget = clickTargets[0]
      clickTarget = hoverTarget
      console.log('\n=== 点击目录（候选 ' + JSON.stringify(clickTargets.map((t) => t.name))
        + '，取第一个有会话的）')
      const rowCenter = (key) => evaluate(`
        (() => {
          const row = Array.from(document.querySelectorAll("[data-ak-tui='sector-row']"))
            .find((r) => r.getAttribute('data-row-key') === ${JSON.stringify(key)})
          if (row === undefined) return null
          const b = row.getBoundingClientRect()
          return [Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2)]
        })()
      `)
      const first = await rowCenter(hoverTarget.key)
      if (first !== null) {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: first[0], y: first[1] })
        await sleep(400)
      }
      hoverTip = await evaluate(`
        (() => {
          const tip = document.querySelector('.ak-sector-tip')
          if (tip === null) return null
          const r = tip.getBoundingClientRect()
          return {
            text: tip.textContent.trim(),
            hidden: tip.hidden,
            inView: r.left >= 0 && r.top >= 0
              && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
          }
        })()
      `)
      console.log('  悬停铭牌: ' + JSON.stringify(hoverTip))
      const readClickState = (key) => evaluate(`
        (() => {
          const key = ${JSON.stringify(key)}
          const field = document.querySelector("[data-ak-tui='column-field']")
          const rows = Array.from(document.querySelectorAll("[data-ak-tui='sector-row']"))
          const active = rows.filter((r) => r.getAttribute('data-ak-active') === 'true')
          const target = rows.find((r) => r.getAttribute('data-row-key') === key) || null
          const plate = document.querySelector('.ak-terminal-sector-head__plate')
          const blocks = Array.from(document.querySelectorAll('[data-ak-block]'))
          let group = null
          if (target !== null) {
            let node = target.parentElement
            while (node !== null && node !== field && node !== document.body) {
              if (node.querySelectorAll("[class*='_sessionRow']").length > 0) { group = node; break }
              node = node.parentElement
            }
          }
          const sessionRows = field === null
            ? [] : Array.from(field.querySelectorAll("[class*='_sessionRow']"))
          const head = document.querySelector("[data-ak-tui='sector-head']")
          const fieldBox = field === null ? null : field.getBoundingClientRect()
          const inField = (el) => {
            if (fieldBox === null) return false
            const b = el.getBoundingClientRect()
            return b.top >= fieldBox.top - 1 && b.bottom <= fieldBox.bottom + 1
              && b.left >= fieldBox.left - 1 && b.right <= fieldBox.right + 1
          }
          return {
            activeCount: active.length,
            activeName: active.length === 0 ? '' : String(active[0].getAttribute('data-ak-name') || '').trim(),
            plate: plate === null ? '' : plate.textContent.trim(),
            expanded: target === null ? null : target.getAttribute('aria-expanded'),
            blocks: blocks.length,
            blocksInView: blocks.filter(inField).length,
            titled: blocks.filter((b) => String(b.getAttribute('title') || '').trim() !== '').length,
            activeInView: active.length > 0 && inField(active[0]),
            /* 托盘是 sticky 的，「落在矩形里」不等于「看得见」：0.2.1-rc.5 侧栏
               多了 112px 面板导航后柜面只剩 155px，当前板半截被托盘盖住，而
               inField 仍然判它可见。这里量的是板底到会话块顶的净空。 */
            fieldH: fieldBox === null ? null : Math.round(fieldBox.height),
            slabH: active.length === 0 ? null : Math.round(active[0].getBoundingClientRect().height),
            slabClear: active.length === 0 || blocks.length === 0 ? null
              : Math.round(blocks[0].getBoundingClientRect().top - active[0].getBoundingClientRect().bottom),
            readout: field === null ? null : field.getAttribute('data-ak-blocks'),
            tray: field === null ? null : field.getAttribute('data-ak-tray'),
            empty: head === null ? null : head.getAttribute('data-ak-empty'),
            inGroup: group === null ? blocks.length === 0 : blocks.every((b) => group.contains(b)),
            visibleForeign: sessionRows.filter((r) => !r.hasAttribute('data-ak-block')
              && getComputedStyle(r).display !== 'none').length,
            hiddenForeign: sessionRows.filter((r) => !r.hasAttribute('data-ak-block')
              && getComputedStyle(r).display === 'none').length,
          }
        })()
      `)
      const clickRow = async (cand) => {
        const c = await rowCenter(cand.key)
        if (c === null) return false
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c[0], y: c[1] })
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c[0], y: c[1], button: 'left', clickCount: 1 })
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c[0], y: c[1], button: 'left', clickCount: 1 })
        await sleep(2000)
        return true
      }
      const collapseRow = async (cand) => {
        const ok = await evaluate(`
          (() => {
            const row = Array.from(document.querySelectorAll("[data-ak-tui='sector-row']"))
              .find((r) => r.getAttribute('data-row-key') === ${JSON.stringify(cand.key)})
            if (row === undefined) return false
            row.click()
            return true
          })()
        `)
        await sleep(1800)
        return ok === true
      }
      let emptyProbe = null
      let chosen = null
      let lastCollapsed = false
      for (const cand of clickTargets) {
        clickTarget = cand
        const opened = await clickRow(cand)
        if (!opened) { console.log('  MISS ' + cand.name); continue }
        const probe = await readClickState(cand.key)
        console.log('  展开 ' + cand.name + ' : blocks=' + probe.blocks
          + ' 在视口=' + probe.blocksInView + ' tray=' + probe.tray
          + ' 柜面=' + probe.fieldH + 'px 板=' + probe.slabH + 'px 净空=' + probe.slabClear
          + ' 空态=' + probe.empty)
        if (probe.blocks > 0) {
          chosen = cand
          clickProbe = probe
          /* 1366×768 是用户报 bug 的尺寸：柜面只剩 ~220px，单行会话必须靠
             托盘留在视口里。截图留给人眼复核，断言在下面统一跑。 */
          const openShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
          const openPath = path.join(OUT_DIR, 'real-open.png')
          fs.writeFileSync(openPath, Buffer.from(openShot.data, 'base64'))
          console.log('  展开态截图: ' + openPath)
          break
        }
        emptyProbe = probe
        lastCollapsed = await collapseRow(cand)
        console.log('    → 该目录没有可排的会话，收回继续找（' + (lastCollapsed ? 'ok' : 'MISS') + '）')
      }
      console.log('  选中: ' + clickTarget.name + '  有会话=' + (chosen !== null))
      if (chosen !== null) {
        /* 再点一次收回。不能复用第一次的坐标：柜面现在会为展开的目录滚到会话区，
           原来那块板可能已经滚出视口或压在托盘下面。直接派发 click，仍然走应用
           自己的目录行处理与主题的 capture 监听，只避开「坐标已经变了」这件事。 */
        lastCollapsed = await collapseRow(chosen)
        clickRestored = await readClickState(chosen.key)
        console.log('  收回点击: ' + (lastCollapsed ? 'ok' : 'MISS'))
      } else {
        clickProbe = emptyProbe
        clickRestored = await readClickState(clickTarget.key)
      }
      if (clickProbe !== null) {
        console.log('  展开后 : active=' + clickProbe.activeCount + ' name=' + clickProbe.activeName
          + ' plate=' + clickProbe.plate + ' blocks=' + clickProbe.blocks
          + ' 在视口=' + clickProbe.blocksInView + ' tray=' + clickProbe.tray
          + ' 全在本组=' + clickProbe.inGroup + ' 可见外来会话=' + clickProbe.visibleForeign
          + ' 藏起=' + clickProbe.hiddenForeign)
      }
      if (clickRestored !== null) {
        console.log('  收回后 : active=' + clickRestored.activeCount + ' name=' + clickRestored.activeName
          + ' plate=' + clickRestored.plate + ' blocks=' + clickRestored.blocks
          + ' tray=' + clickRestored.tray + ' expanded=' + clickRestored.expanded)
      }
    }
  }

  /* ---- 判定 ---- */
  let problems = 0
  const check = (label, cond, detail) => {
    if (cond) console.log('  ok   ' + label)
    else { console.log('  FAIL ' + label + (detail ? '  ' + detail : '')); problems += 1 }
  }
  console.log('\n=== 判定')
  check('页面加载出了 DSH（有 boot 注入）', report.hasBoot === true)
  check('主题样式表已注入', report.themeMarker > 0, '实际 ' + report.themeMarker)
  check('body 带 themed class', report.themed === true, String(report.bodyClasses))
  check('--edge-accent 已解析', /^#[0-9a-fA-F]{6}$/.test(String(report.edgeAccent)), String(report.edgeAccent))
  check('令牌层跟随主题', String(report.tokenAttr).toLowerCase() === String(report.edgePaper).toLowerCase(), report.tokenAttr + ' vs ' + report.edgePaper)
  check('悬浮阵营条已挂载', report.bar === 1, '实际 ' + report.bar)
  check('页面无 console.error / 未捕获异常', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))

  if (cabinet.lab === true) {
    check('柜面把全部工作区板收进同一个容器', cabinet.field !== null && cabinet.rows > 0
      && cabinet.field.rows === cabinet.rows, '柜面 ' + (cabinet.field === null ? '-' : cabinet.field.rows) + ' / 总 ' + cabinet.rows)
    check('每块工作区板都是竖板宽度', cabinet.widths.length > 0 && cabinet.widths.every((w) => w <= 40),
      JSON.stringify(cabinet.widths))
    check('每块工作区板都是竖长条', cabinet.heights.length > 0 && cabinet.heights.every((h, i) => h > cabinet.widths[i]))
    check('会话板落在同一面柜面上', cabinet.blocks === 0
      || (cabinet.field !== null && cabinet.field.blocks === cabinet.blocks), '柜面 ' + (cabinet.field === null ? '-' : cabinet.field.blocks) + ' / 总 ' + cabinet.blocks)
    check('柜面铭牌有字', String(cabinet.plate).trim() !== '', '「' + cabinet.plate + '」')
    check('柜面没有横向溢出', cabinet.field !== null && cabinet.field.spillX <= 1, String(cabinet.field === null ? '-' : cabinet.field.spillX))
    check('侧栏抬到应用整页纹理之上', cabinet.sidebarZ === '5', 'z-index=' + cabinet.sidebarZ)
    check('侧栏底部没有互相压住的按钮', (cabinet.bottomOverlaps || []).length === 0,
      JSON.stringify(cabinet.bottomOverlaps))
    check('每块工作区板都有名字', cabinet.rows > 0 && cabinet.names.every((n) => n !== ''),
      JSON.stringify(cabinet.names))
    check('只有一块当前板', cabinet.activeCount === 1, '实际 ' + cabinet.activeCount
      + ' 块 ' + JSON.stringify(cabinet.activeNames))
    check('柜面铭牌跟随当前板', cabinet.activeCount === 1 && cabinet.plate === cabinet.activeNames[0],
      '「' + cabinet.plate + '」 vs 「' + cabinet.activeNames[0] + '」')
    if (clickTarget !== null && clickProbe !== null && clickRestored !== null) {
      check('悬停显示工作区名字', hoverTip !== null && hoverTip.hidden === false
        && hoverTip.text === hoverTarget.name && hoverTip.inView === true,
        JSON.stringify(hoverTip) + ' vs 「' + hoverTarget.name + '」')
      check('点击目录后成为唯一当前板', clickProbe.activeCount === 1
        && clickProbe.activeName === clickTarget.name, 'active=' + clickProbe.activeCount
        + ' name=' + clickProbe.activeName)
      check('点击后铭牌跟随该目录', clickProbe.plate === clickTarget.name,
        '「' + clickProbe.plate + '」 vs 「' + clickTarget.name + '」')
      check('点击后柜面只排该目录的会话', clickProbe.inGroup === true
        && clickProbe.visibleForeign === 0, '全在本组=' + clickProbe.inGroup
        + ' 可见外来会话=' + clickProbe.visibleForeign)
      check('点击后目录处于展开状态', clickProbe.expanded === 'true',
        'aria-expanded=' + clickProbe.expanded)
      /* 真机 bug：会话确实渲染了，但排在整面工作区墙后面，柜面矮的时候
         永远看不见。点开后至少一块会话必须落在柜面的可见矩形里。 */
      if (clickProbe.blocks > 0) {
        const wantReadout = (clickProbe.blocks < 10 ? '0' : '') + clickProbe.blocks
        check('点开后会话块进入柜面视口', clickProbe.blocksInView > 0,
          '在视口 ' + clickProbe.blocksInView + ' / ' + clickProbe.blocks)
        /* 方块里的标题是截断的，而应用那张会盖住抬头的悬停预览卡在 lab 档被
           收起；标题必须能从原生 tooltip 读全。 */
        check('会话块带完整标题提示', clickProbe.titled === clickProbe.blocks,
          clickProbe.titled + ' / ' + clickProbe.blocks)
        check('会话读数带与方块数一致', clickProbe.readout === wantReadout,
          String(clickProbe.readout) + ' vs ' + wantReadout)
        if (clickProbe.tray === 'true') {
          check('单行托盘里当前板仍然可见', clickProbe.activeInView === true)
          check('当前板没有被托盘压住', clickProbe.slabClear !== null && clickProbe.slabClear >= 0,
            '板底→块顶净空 ' + clickProbe.slabClear + 'px（柜面 ' + clickProbe.fieldH
            + 'px，板 ' + clickProbe.slabH + 'px）')
        }
      } else {
        check('没有会话的目录显示空态', clickProbe.empty === 'true',
          'data-ak-empty=' + clickProbe.empty)
      }
      check('再点一次回到部署工作区', clickRestored.expanded === 'false'
        && clickRestored.activeCount === 1
        && clickRestored.activeName === cabinet.activeNames[0]
        && clickRestored.plate === cabinet.plate
        && clickRestored.blocks === cabinet.blocks
        && clickRestored.tray === null,
      'active=' + clickRestored.activeName + ' blocks=' + clickRestored.blocks
      + ' tray=' + clickRestored.tray
      + ' expected ' + cabinet.activeNames[0] + '/' + cabinet.blocks)
    }
  }

  /* 三阵营切换：每一步的 class 与强调色都必须在真实页面上对上。 */
  for (const shot of factionShots) {
    check('切换截图 ' + shot.fileName + ' 的 class 与强调色', shot.classOk && shot.accentOk)
  }

  console.log('\n' + (problems === 0 ? '真实页面验证通过' : '真实页面验证失败：' + problems + ' 项'))
  socket.close()
  cleanup()
  process.exit(problems === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('验证失败: ' + (error && error.message ? error.message : String(error)))
  process.exit(1)
})
