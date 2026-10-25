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
      '--hide-scrollbars', '--window-size=1600,1000',
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })

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
  let hoverTip = null
  if (cabinet.lab === true) {
    clickTarget = await evaluate(`
      (() => {
        const field = document.querySelector("[data-ak-tui='column-field']")
        if (field === null) return null
        const fr = field.getBoundingClientRect()
        const rows = Array.from(document.querySelectorAll("[data-ak-tui='sector-row']"))
        const row = rows.find((r) => r.getAttribute('data-ak-active') !== 'true'
          && r.getAttribute('aria-expanded') === 'false'
          && (() => {
            const b = r.getBoundingClientRect()
            return b.top >= fr.top && b.bottom <= fr.bottom && b.width > 0 && b.height > 0
          })())
        if (row === undefined) return null
        const b = row.getBoundingClientRect()
        return {
          key: row.getAttribute('data-row-key'),
          name: String(row.getAttribute('data-ak-name') || '').trim(),
          x: Math.round(b.x + b.width / 2),
          y: Math.round(b.y + b.height / 2),
        }
      })()
    `)
    if (clickTarget === null) {
      console.log('\n  没有可点击的折叠目录（可能全部展开），跳过点击验证')
    } else {
      console.log('\n=== 点击目录（' + clickTarget.name + '）')
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: clickTarget.x, y: clickTarget.y })
      await sleep(400)
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
      const readClickState = () => evaluate(`
        (() => {
          const key = ${JSON.stringify(clickTarget.key)}
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
          return {
            activeCount: active.length,
            activeName: active.length === 0 ? '' : String(active[0].getAttribute('data-ak-name') || '').trim(),
            plate: plate === null ? '' : plate.textContent.trim(),
            expanded: target === null ? null : target.getAttribute('aria-expanded'),
            blocks: blocks.length,
            inGroup: group === null ? blocks.length === 0 : blocks.every((b) => group.contains(b)),
            visibleForeign: sessionRows.filter((r) => !r.hasAttribute('data-ak-block')
              && getComputedStyle(r).display !== 'none').length,
            hiddenForeign: sessionRows.filter((r) => !r.hasAttribute('data-ak-block')
              && getComputedStyle(r).display === 'none').length,
          }
        })()
      `)
      const mouse = async (type) => send('Input.dispatchMouseEvent', {
        type, x: clickTarget.x, y: clickTarget.y, button: 'left', clickCount: 1,
      })
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: clickTarget.x, y: clickTarget.y })
      await mouse('mousePressed')
      await mouse('mouseReleased')
      await sleep(2000)
      clickProbe = await readClickState()
      console.log('  展开后 : active=' + clickProbe.activeCount + ' name=' + clickProbe.activeName
        + ' plate=' + clickProbe.plate + ' blocks=' + clickProbe.blocks
        + ' 全在本组=' + clickProbe.inGroup + ' 可见外来会话=' + clickProbe.visibleForeign
        + ' 藏起=' + clickProbe.hiddenForeign)
      /* 再点一次收回。坐标不变：柜面现在不会因为展开而自动滚动。 */
      await mouse('mousePressed')
      await mouse('mouseReleased')
      await sleep(2000)
      clickRestored = await readClickState()
      console.log('  收回后 : active=' + clickRestored.activeCount + ' name=' + clickRestored.activeName
        + ' plate=' + clickRestored.plate + ' blocks=' + clickRestored.blocks
        + ' expanded=' + clickRestored.expanded)
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
    check('每块工作区板都有名字', cabinet.rows > 0 && cabinet.names.every((n) => n !== ''),
      JSON.stringify(cabinet.names))
    check('只有一块当前板', cabinet.activeCount === 1, '实际 ' + cabinet.activeCount
      + ' 块 ' + JSON.stringify(cabinet.activeNames))
    check('柜面铭牌跟随当前板', cabinet.activeCount === 1 && cabinet.plate === cabinet.activeNames[0],
      '「' + cabinet.plate + '」 vs 「' + cabinet.activeNames[0] + '」')
    if (clickTarget !== null && clickProbe !== null && clickRestored !== null) {
      check('悬停显示工作区名字', hoverTip !== null && hoverTip.hidden === false
        && hoverTip.text === clickTarget.name && hoverTip.inView === true,
        JSON.stringify(hoverTip) + ' vs 「' + clickTarget.name + '」')
      check('点击目录后成为唯一当前板', clickProbe.activeCount === 1
        && clickProbe.activeName === clickTarget.name, 'active=' + clickProbe.activeCount
        + ' name=' + clickProbe.activeName)
      check('点击后铭牌跟随该目录', clickProbe.plate === clickTarget.name,
        '「' + clickProbe.plate + '」 vs 「' + clickTarget.name + '」')
      check('点击后柜面只排该目录的会话', clickProbe.inGroup === true
        && clickProbe.visibleForeign === 0, '全在本组=' + clickProbe.inGroup
        + ' 可见外来会话=' + clickProbe.visibleForeign)
      check('再点一次回到部署工作区', clickRestored.expanded === 'false'
        && clickRestored.activeCount === 1
        && clickRestored.activeName === cabinet.activeNames[0]
        && clickRestored.plate === cabinet.plate
        && clickRestored.blocks === cabinet.blocks,
      'active=' + clickRestored.activeName + ' blocks=' + clickRestored.blocks
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
