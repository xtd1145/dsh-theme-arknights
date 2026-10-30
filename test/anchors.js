#!/usr/bin/env node
"use strict"
/**
 * test/anchors.js — DSH 升级适配审计
 *
 * 主题的所有装饰都挂在 CSS-module 的 localName 上（`[class*='_sessionRow']`）。
 * DSH 一次升级就可能把它们改掉，而界面上**不会报错**——只会安静地掉装饰。
 * 这个脚本把样式表里用到的锚点逐个拿到本机真实安装的 DSH bundle 里查一遍。
 *
 * 一个应用里同时存在两套 CSS-module 命名：
 *   · 后缀式 `bhn1Oq_sessionRow`   → `[class*='_sessionRow']` 命中
 *   · 前缀式 `acknowledgement_cjd8z_38` → 必须写 `[class*='acknowledgement_']`
 * 所以每个锚点两种形式都测，命中任一即算活着。
 *
 * 用法：
 *   node test/anchors.js                 # 自动定位全局 @deepseek-ai/dsh
 *   node test/anchors.js <DSH 包目录>     # 指定安装（例如备份的旧版本）
 *
 * 退出码：0 = 全部命中；1 = 有锚点两种形式都查不到。
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const REPO = path.resolve(__dirname, '..')
const SHEETS = ['theme.css', 'faction.css', 'lab.css']

/* 有意保留的「自愈钩子」：应用当前没有这个类名，规则本来就不该命中，等上游
   把它加回来时自动生效。theme.css 里那段注释是它的出处。 */
const SELF_HEALING = new Set(['_heroGlow'])

const candidates = [
  process.argv[2],
  process.env.DSH_PKG,
  path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    'npm', 'node_modules', '@deepseek-ai', 'dsh'),
  '/usr/local/lib/node_modules/@deepseek-ai/dsh',
].filter(Boolean)

const root = candidates.find((p) => fs.existsSync(path.join(p, 'package.json')))
if (root === undefined) {
  console.error('找不到 DSH 包。试过：\n  ' + candidates.join('\n  '))
  console.error('用法: node test/anchors.js <DSH 包目录>')
  process.exit(2)
}
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version

/* 样式表里的锚点，以及**它被写成哪种形式**：
 *   [class*='_x'] → 后缀式写法（对 `hash_local` 有效）
 *   [class*='x_'] → 前缀式写法（对 `local_hash` 有效）
 * 光看应用里有没有这个类名不够——应用只有前缀式而样式表只写后缀式，规则一样
 * 是死代码，而这是这类失效最难发现的样子。 */
const anchors = new Set()
const written = new Map()
for (const sheet of SHEETS) {
  const css = fs.readFileSync(path.join(REPO, 'src/styles/' + sheet), 'utf8')
  for (const m of css.matchAll(/\[class[*$]=['"]([A-Za-z0-9_]+)['"]\]/g)) {
    const value = m[1]
    let anchor = null
    let form = null
    if (value.charAt(0) === '_') { anchor = value; form = 'suffix' }
    else if (value.charAt(value.length - 1) === '_') { anchor = '_' + value.slice(0, -1); form = 'prefix' }
    if (anchor === null) continue
    anchors.add(anchor)
    const rec = written.get(anchor) || { suffix: false, prefix: false }
    rec[form] = true
    written.set(anchor, rec)
  }
}

/** bundle 文件：包里每个依赖的 lib/ 与 dist/（前端主 bundle 在
 *  dsh-web-frontend/dist/assets/ 下，CSS-module 类名全在那里，只扫 lib 会漏掉
 *  整个应用）。含 @scope/ 下一层。 */
const bundleFiles = (dir) => {
  const out = []
  const collect = (d) => {
    let names = []
    try { names = fs.readdirSync(d) } catch (e) { return }
    for (const f of names) {
      const p = path.join(d, f)
      try { if (/\.(js|css)$/.test(f) && fs.statSync(p).isFile()) out.push(p) } catch (e) { /* skip */ }
    }
  }
  const walk = (d, depth) => {
    let entries = []
    try { entries = fs.readdirSync(d) } catch (e) { return }
    for (const name of entries) {
      const p = path.join(d, name)
      let st = null
      try { st = fs.statSync(p) } catch (e) { continue }
      if (!st.isDirectory()) continue
      if (name.startsWith('@')) { walk(p, depth + 1); continue }
      for (const sub of ['lib', 'dist', path.join('dist', 'assets')]) collect(path.join(p, sub))
    }
  }
  walk(path.join(root, 'node_modules'), 0)
  for (const sub of ['lib', 'dist', path.join('dist', 'assets')]) collect(path.join(root, sub))
  return out
}

const files = bundleFiles(root)
console.log('DSH 包   : ' + root)
console.log('版本     : ' + version)
console.log('bundle   : ' + files.length + ' 个 bundle 文件')
console.log('样式表锚点: ' + anchors.size + ' 个（来自 ' + SHEETS.join(' / ') + '）\n')

/* 流式扫描：前端主包是几 MB 的大文件，不能把所有文本留在内存里。每读一个文件
   推进两件事——哪些锚点已经以「后缀式 hash_local」出现过，以及见过哪些
   「前缀式 local_hash_line」类名（`acknowledgement_cjd8z_38`）。锚点全命中后
   就不再测子串，只继续收类名。 */
const suffixHits = new Set()
const prefixHits = new Set()
const pending = new Set(Array.from(anchors))
const CLASS_RE = /\.([A-Za-z0-9_-]{2,80})(?=[\s,{:.>#\[~])/g
const MODULE_RE = /([A-Za-z][A-Za-z0-9]{1,40})_[0-9A-Za-z]{4,7}_[0-9]{1,5}/g
let scanned = 0

for (const f of files) {
  let t = ''
  try { t = fs.readFileSync(f, 'utf8') } catch (e) { continue }
  scanned += 1
  if (pending.size > 0) {
    for (const a of Array.from(pending)) {
      if (t.indexOf(a) !== -1) { suffixHits.add(a); pending.delete(a) }
    }
  }
  for (const m of t.matchAll(MODULE_RE)) {
    const anchor = '_' + m[1]
    if (anchors.has(anchor)) prefixHits.add(anchor)
  }
  for (const m of t.matchAll(CLASS_RE)) {
    const head = m[1].split('_')[0]
    const anchor = '_' + head
    if (head.indexOf('_') !== -1 && anchors.has(anchor)) prefixHits.add(anchor)
  }
  t = null
}

const dead = []        /* 应用里根本没有这个类名 → 规则是死代码 */
const mismatched = []  /* 应用里有，但样式表写的形式命不中 */
const healed = []
const alive = []
for (const anchor of Array.from(anchors).sort()) {
  const appSuffix = suffixHits.has(anchor)
  const appPrefix = prefixHits.has(anchor)
  const w = written.get(anchor) || { suffix: false, prefix: false }
  const live = (appSuffix && w.suffix) || (appPrefix && w.prefix)
  if (live) { alive.push(anchor); continue }
  if (!appSuffix && !appPrefix) {
    if (SELF_HEALING.has(anchor)) healed.push(anchor)
    else dead.push(anchor)
    continue
  }
  mismatched.push({ anchor, appSuffix, appPrefix, w })
}
console.log('扫描     : ' + scanned + ' 个文件；应用里查到的类名 后缀式 '
  + suffixHits.size + ' 个 / 前缀式 ' + prefixHits.size + ' 个')

if (mismatched.length > 0) {
  console.log('形式对不上（应用里有这个类名，但样式表写的形式永不命中）')
  for (const m of mismatched) {
    const bare = m.anchor.slice(1)
    const want = m.appPrefix && !m.appSuffix
      ? '应用只有前缀式，补 [class*=\'' + bare + '_\']'
      : '应用只有后缀式，写 [class*=\'' + m.anchor + '\']'
    const has = (m.w.suffix ? "已写 [class*='" + m.anchor + "']" : '')
      + (m.w.prefix ? (m.w.suffix ? ' + ' : '') + "已写 [class*='" + bare + "_']" : '')
    console.log('  ! ' + m.anchor + '  →  ' + want + '（样式表' + (has === '' ? '什么都没写' : has) + '）')
  }
  console.log('')
}
if (healed.length > 0) {
  console.log('自愈钩子（应用当前没有这个类名，规则按设计不命中）')
  healed.forEach((a) => console.log('  ~ ' + a))
  console.log('')
}
if (dead.length === 0 && mismatched.length === 0) {
  console.log('通过：' + alive.length + ' 个锚点在本机 DSH ' + version + ' 里都命得中'
    + (healed.length > 0 ? '（另有 ' + healed.length + ' 条自愈钩子）' : ''))
  process.exit(0)
}
if (dead.length > 0) {
  console.log('死锚点（' + version + ' 的 bundle 里两种形式都查不到 → 规则是死代码）')
  dead.forEach((a) => console.log('  ✗ ' + a))
}
console.log('\n要么改选择器，要么把这条规则删掉；不要留着当装饰。')
process.exit(1)
