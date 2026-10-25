#!/usr/bin/env node
"use strict"
/**
 * check.js — 样式表与两侧契约的静态校验。
 *
 * `scripts/build.js --check` 只证明「产物与源码一致」，它证明不了产物本身是
 * 对的。这个脚本检查的都是**已经出过一次事故的形状**：
 *
 *   1. 两侧的 FIELD_DEFAULTS 必须逐字段相等。
 *      浏览器在宿主把 section 送达之前读自己那份默认值，两份不一致的表现是
 *      「启动时开关显示 A，往返闭合后跳到 B」——一个只在真实页面上出现、
 *      单元测试里看不见的错位。
 *
 *   2. theme.css 引用的每个 --edge-* 变量，都必须在**三套阵营 × 明暗的每一组**
 *      里被定义。一个拼错的变量名不会报错：var() 解析成空值，那个令牌变成无效，
 *      对应的界面元素直接掉回浏览器初始色。这类「某个角落颜色不对」最难查。
 *
 *   3. 六组阵营变量集必须各自完整。漏掉一条暗色规则的表现是「切到暗色后掉回
 *      默认阵营的色板」——看起来像主题只生效了一半。
 *
 *   4. 命名空间三处必须一致（patch 行 id / host SETTINGS_ENTRY / client
 *      PREFS_ENTRY）。不一致 = 表单能打开但写不进去。
 *
 *   5. 样式表必须能安全嵌进 insertCss 的模板字面量（无反引号、无 ${）。
 *
 * 退出码：0 全部通过 / 1 有失败项。
 */

const fs = require('fs')
const path = require('path')

const ROOT = __dirname

let failures = 0
let checks = 0

function ok(label, detail) {
  checks += 1
  console.log('  ok   ' + label + (detail === undefined ? '' : '  ' + detail))
}

function fail(label, detail) {
  checks += 1
  failures += 1
  console.log('  FAIL ' + label + (detail === undefined ? '' : '\n       ' + detail))
}

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8')
}

/* ------------------------------------------------------------------ *
 * 1. 两侧 FIELD_DEFAULTS
 * ------------------------------------------------------------------ */

/** 从一段源码里抠出 `NAME = { … }` 的字段表。
 *
 *  字段表里没有嵌套对象，所以「从 `{` 到第一个 `}`」就是它的范围。 */
function extractFieldTable(source, name) {
  const start = source.indexOf(name)
  if (start === -1) return null
  const open = source.indexOf('{', start)
  if (open === -1) return null
  const close = source.indexOf('}', open)
  if (close === -1) return null
  const body = source.slice(open + 1, close)
  const out = {}
  const pattern = /^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*'([^']*)'\s*,?/gm
  let match = pattern.exec(body)
  while (match !== null) {
    out[match[1]] = match[2]
    match = pattern.exec(body)
  }
  return out
}

console.log('\n[1] 两侧 FIELD_DEFAULTS 一致')

const hostTable = extractFieldTable(read('src/host/10-identity.js'), 'const FIELD_DEFAULTS')
const clientTable = extractFieldTable(read('src/client/10-prefs-store.js'), 'const PREFS_FIELD_DEFAULTS')

if (hostTable === null) fail('src/host/10-identity.js 里找不到 FIELD_DEFAULTS')
else if (clientTable === null) fail('src/client/10-prefs-store.js 里找不到 PREFS_FIELD_DEFAULTS')
else {
  const hostKeys = Object.keys(hostTable).sort()
  const clientKeys = Object.keys(clientTable).sort()
  if (hostKeys.join(',') === clientKeys.join(',')) {
    ok('字段集相同', hostKeys.length + ' 个')
  } else {
    const missing = hostKeys.filter((k) => clientKeys.indexOf(k) === -1)
    const extra = clientKeys.filter((k) => hostKeys.indexOf(k) === -1)
    fail('字段集不同', 'host 独有: ' + JSON.stringify(missing) + ' / client 独有: ' + JSON.stringify(extra))
  }
  let mismatch = 0
  for (const key of hostKeys) {
    if (clientTable[key] !== undefined && clientTable[key] !== hostTable[key]) {
      mismatch += 1
      fail('字段 ' + key + ' 默认值不同', 'host=' + JSON.stringify(hostTable[key]) + ' client=' + JSON.stringify(clientTable[key]))
    }
  }
  if (mismatch === 0) ok('每个字段的默认值相同')
}

/* ------------------------------------------------------------------ *
 * 2. 六组阵营变量集 vs theme.css 的引用
 * ------------------------------------------------------------------ */

console.log('\n[2] 阵营变量集完整（3 阵营 × 明暗）')

const themeCss = read('src/styles/theme.css')
const factionCss = read('src/styles/faction.css')
const labCss = read('src/styles/lab.css')

/** 抠出 faction.css 里某个选择器块声明的变量。 */
function varsOf(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = factionCss.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'))
  if (match === null) return null
  const out = new Set()
  for (const decl of match[1].matchAll(/(--edge-[a-z0-9-]+)\s*:/g)) out.add(decl[1])
  return out
}

/* 每一组都必须自带的变量。这是**契约**：theme.css 的所有功能样式都读它们，
   任何一组缺一个，那一处功能就会在该阵营下掉回浏览器初始色。 */
const REQUIRED_VARS = [
  '--edge-paper', '--edge-panel', '--edge-overlay', '--edge-soft',
  '--edge-line', '--edge-line-2',
  '--edge-ink', '--edge-ink-2',
  '--edge-accent', '--edge-accent-rgb', '--edge-accent-deep', '--edge-accent-onpaper',
  '--edge-signal', '--edge-signal-dim',
  '--edge-status-light', '--edge-status-light-mid', '--edge-status-dark', '--edge-status-dark-mid',
  '--edge-error', '--edge-success', '--edge-warn', '--edge-btn-muted',
  '--edge-glow-light', '--edge-glow-dark', '--edge-wm-alpha',
  '--edge-glass-fill', '--edge-glass-alpha', '--edge-glass-blur', '--edge-glass-edge', '--edge-glass-sheen',
]

/* 只在每个**阵营的亮色组**里声明一次、被该阵营的暗色组通过层叠继承的变量。
   它们与明暗无关（标题字族与字距就是阵营的性格），所以刻意不在暗色组重复：
   重复反而是漂移的来源。校验要求的是「每个阵营恰好声明一次」。 */
const STYLE_VARS = ['--edge-font-display', '--edge-tracking-display']

const GROUPS = [
  { label: '罗德岛·亮', selector: 'body.theme-arknights-themed', styleVars: true },
  { label: '罗德岛·暗', selector: 'body.theme-arknights-themed[data-ds-dark-theme]', styleVars: false },
  { label: '拉特兰·亮', selector: 'body.theme-arknights-themed.theme-arknights-laterano', styleVars: true },
  { label: '拉特兰·暗', selector: 'body.theme-arknights-themed.theme-arknights-laterano[data-ds-dark-theme]', styleVars: false },
  { label: '莱茵·亮', selector: 'body.theme-arknights-themed.theme-arknights-rhine', styleVars: true },
  { label: '莱茵·暗', selector: 'body.theme-arknights-themed.theme-arknights-rhine[data-ds-dark-theme]', styleVars: false },
]

for (const group of GROUPS) {
  const declared = varsOf(group.selector)
  if (declared === null) {
    fail(group.label + ': 找不到规则块', group.selector)
    continue
  }
  const required = group.styleVars ? REQUIRED_VARS.concat(STYLE_VARS) : REQUIRED_VARS
  const missing = required.filter((name) => !declared.has(name))
  if (missing.length === 0) {
    ok(group.label, required.length + ' 个变量齐全' + (group.styleVars ? '（含字体与字距）' : ''))
  } else {
    fail(group.label + ' 缺少变量', JSON.stringify(missing))
  }
}

/* 三份样式表引用到的 --edge-* 必须全部在契约清单里（否则说明有一处引用没人定义）。 */
const referenced = new Set()
for (const css of [themeCss, factionCss, labCss]) {
  for (const match of css.matchAll(/var\((--edge-[a-z0-9-]+)/g)) referenced.add(match[1])
}
/* 这四个是加载屏排版与字体，定义在 theme.css 自己身上，不在六组里。 */
const LOCALLY_DEFINED = ['--edge-word', '--edge-gap', '--edge-font']
const undocumented = Array.from(referenced).filter(
  (name) =>
    REQUIRED_VARS.indexOf(name) === -1 &&
    STYLE_VARS.indexOf(name) === -1 &&
    LOCALLY_DEFINED.indexOf(name) === -1
)
if (undocumented.length === 0) {
  ok('被引用的 --edge-* 全部有归属', referenced.size + ' 个')
} else {
  fail('有 --edge-* 变量被引用但既不在契约清单、也不是本地定义的', JSON.stringify(undocumented))
}

/* ------------------------------------------------------------------ *
 * 3. 阵营 class 与 JS 侧数据对齐
 * ------------------------------------------------------------------ */

console.log('\n[3] 阵营 class 与 JS 数据对齐')

const palette = read('src/client/15-palette.js')
const ids = (palette.match(/FACTION_IDS = \[([^\]]*)\]/) || [])[1]
const idList = ids === undefined ? [] : (ids.match(/'([a-z]+)'/g) || []).map((s) => s.replace(/'/g, ''))
if (idList.length === 3) ok('FACTION_IDS 有 3 个阵营', JSON.stringify(idList))
else fail('FACTION_IDS 应当有 3 个阵营', JSON.stringify(idList))

for (const id of ['laterano', 'rhine']) {
  if (factionCss.indexOf('.theme-arknights-' + id) !== -1) ok('样式表里有 .theme-arknights-' + id + ' 的规则')
  else fail('样式表里没有 .theme-arknights-' + id + ' 的规则', '切到该阵营不会有任何变化')
}

/* js 侧的 FACTION_META 必须覆盖 FACTION_IDS。 */
const bar = read('src/client/35-faction-bar.js')
for (const id of idList) {
  if (bar.indexOf("id: '" + id + "'") !== -1) ok('悬浮条覆盖阵营 ' + id)
  else fail('悬浮条的 FACTION_META 缺少阵营 ' + id)
}

/* ------------------------------------------------------------------ *
 * 3b. 界面版本档位（lab 是叠在 advanced 之上的第三层）
 * ------------------------------------------------------------------ */

console.log('\n[3b] 界面版本档位与莱茵终端层')

const layoutIds = (palette.match(/LAYOUT_IDS = \[([^\]]*)\]/) || [])[1]
const layoutList = layoutIds === undefined ? [] : (layoutIds.match(/'[a-z]+'/g) || []).map((s) => s.replace(/'/g, ''))
if (layoutList.length === 3) ok('LAYOUT_IDS 有 3 个档位', JSON.stringify(layoutList))
else fail('LAYOUT_IDS 应当有 3 个档位', JSON.stringify(layoutList))

/* lab.css 必须在 faction.css 之后：层叠顺序就是档位顺序。写反了会得到
   「切到莱茵终端版但纸面还是阵营的那套」——规则全在，一条都不生效。 */
const clientManifest = read('src/client/manifest.js')
const factionEntry = clientManifest.indexOf("'../styles/faction.css'")
const labEntry = clientManifest.indexOf("'../styles/lab.css'")
if (factionEntry !== -1 && labEntry !== -1 && labEntry > factionEntry) {
  ok('manifest 在 faction.css 之后注册了 lab.css')
} else {
  fail('lab.css 没有注册在 faction.css 之后', 'factionEntry=' + factionEntry + ' labEntry=' + labEntry)
}

/* lab 接管的是「材质」：纸面家族整套覆盖，强调色仍由阵营决定。少写一个，
   那个表面就会在切档后留下阵营的原色，看起来像档只生效了一半。 */
const LAB_SURFACE = [
  '--edge-paper', '--edge-panel', '--edge-overlay', '--edge-soft',
  '--edge-line', '--edge-line-2', '--edge-ink', '--edge-ink-2',
]
const LAB_GROUPS = [
  { label: '莱茵终端·亮', selector: 'body.theme-arknights-advanced.theme-arknights-lab' },
  { label: '莱茵终端·暗', selector: 'body.theme-arknights-advanced.theme-arknights-lab[data-ds-dark-theme]' },
]
for (const group of LAB_GROUPS) {
  const escaped = group.selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = labCss.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'))
  if (match === null) {
    fail(group.label + ': 找不到规则块', group.selector)
    continue
  }
  const declared = new Set()
  for (const decl of match[1].matchAll(/(--edge-[a-z0-9-]+)\s*:/g)) declared.add(decl[1])
  const missing = LAB_SURFACE.filter((name) => !declared.has(name))
  if (missing.length === 0) ok(group.label, LAB_SURFACE.length + ' 个表面变量齐全')
  else fail(group.label + ' 缺少表面变量', JSON.stringify(missing))
}

/* 三档都必须有两份语言的标签与提示：少一个 key，设置页那一段就渲染成
   「undefined」，而且只在切到那一档时可见。 */
const copy = read('src/client/50-settings-copy.js')
for (const id of layoutList) {
  for (const [prefix, name] of [['layout_', '档位名'], ['layoutHint_', '档位提示']]) {
    const hits = (copy.match(new RegExp(prefix + id + ':', 'g')) || []).length
    if (hits === 2) ok(name + ' ' + id + ' 中英各一份')
    else fail(name + ' ' + id + ' 的文案份数不对', hits + ' 处，应为 2（zh + en）')
  }
}

/* ------------------------------------------------------------------ *
 * 4. 极性 / 枚举
 * ------------------------------------------------------------------ */

console.log('\n[4] 开关极性与枚举')

if (hostTable !== null) {
  const ENUM_FIELDS = {
    faction: ['rhodes', 'laterano', 'rhine'],
    layout: ['universal', 'advanced', 'lab'],
    radius: ['square', 'round'],
    glass: ['off', 'on'],
    scrollAnimLevel: ['soft', 'standard', 'snappy'],
    creditDisplay: ['remaining', 'used'],
    balanceCapsulePosition: ['center', 'left', 'right'],
  }
  let bad = 0
  for (const [field, value] of Object.entries(hostTable)) {
    if (ENUM_FIELDS[field] !== undefined) {
      if (ENUM_FIELDS[field].indexOf(value) === -1) {
        bad += 1
        fail('枚举字段 ' + field + ' 的默认值不在候选集内', JSON.stringify(value))
      }
      continue
    }
    /* audioSoundDir 是自由文本，audioVolume/audioDebounceMs 是数字串。 */
    if (['audioSoundDir', 'audioVolume', 'audioDebounceMs'].indexOf(field) !== -1) continue
    if (value !== '0' && value !== '1') {
      bad += 1
      fail('开关字段 ' + field + ' 的默认值不是 \'0\' 或 \'1\'', JSON.stringify(value))
    }
  }
  if (bad === 0) ok('所有开关与枚举都合法', Object.keys(hostTable).length + ' 个字段')
}

/* ------------------------------------------------------------------ *
 * 5. 样式表可安全嵌入模板字面量
 * ------------------------------------------------------------------ */

console.log('\n[5] 选择器锚点必须是应用里真实存在的 localName')

/* 白名单 = dsh-theme-endfield 在 DSH 0.2.0-rc.2 上验证过的 CSS-module localName。
 * 这些名字来自它的样式表（它发布并跑过完整测试），所以「出现过」就等于「命中过」。
 *
 * 这条检查的价值：第一版进阶版写了 _transcript / _bubble / _role / _sectionTitle /
 * _groupLabel / _primaryButton——它们**一个都不存在**，规则全是死代码，而界面上
 * 看不出任何报错，只是「装饰没生效」。靠肉眼是查不出这种事的。 */
const KNOWN_LOCAL_NAMES = new Set([
  /* 布局 */
  '_frame', '_header', '_body', '_footer', '_root', '_slot', '_strip', '_fade', '_trigger',
  '_centerCol', '_sidebarCol', '_rightbarCol', '_detailsCol',
  '_composerSeat', '_composerHero', '_headerActions',
  /* 内容 */
  '_card', '_title', '_headline', '_label', '_icon', '_iconButton', '_badge', '_arrow', '_chevron',
  '_sessionRow', '_projectRow', '_actionRow', '_searchResultRow', '_command', '_folder',
  '_add', '_addButton', '_close', '_clearButton', '_searchButton', '_inspectButton',
  '_primary', '_secondaryButton', '_dangerButton', '_selected', '_itemDesc', '_previewBadge',
  '_heroGlow', '_word', '_warning', '_confirmation', '_confirmAction', '_modalAction',
  '_doubleCheck', '_acknowledgement', '_newSession', '_newSessionLabel',
  '_compactionButton', '_compactionRow', '_compactionSep', '_colorMessages', '_colorSystem',
])

/** 抠出样式表里所有 `[class*='_x']` / `[class$='_x']` 的 localName。 */
const usedAnchors = new Set()
for (const css of [factionCss, labCss]) {
  for (const m of css.matchAll(/\[class[*$]=['"](_[A-Za-z0-9]+)['"]\]/g)) usedAnchors.add(m[1])
}

const unknownAnchors = Array.from(usedAnchors).filter((name) => !KNOWN_LOCAL_NAMES.has(name))
if (unknownAnchors.length === 0) {
  ok('样式表只用了已验证的 localName', usedAnchors.size + ' 个')
} else {
  fail('样式表用了应用里不存在的 localName（规则永不命中）', JSON.stringify(unknownAnchors))
}

/* 同时禁止把 class 写成 data 属性：`[data-composer-seat]` 是这类错误的典型形态。 */
const fakeDataAttrs = []
for (const css of [factionCss, labCss]) {
  for (const m of css.matchAll(/\[data-(composer[a-z-]*|sidebar[a-z-]*|frame[a-z-]*|transcript[a-z-]*|bubble[a-z-]*)\]/g)) {
    fakeDataAttrs.push(m[0])
  }
}
if (fakeDataAttrs.length === 0) ok('没有把 class 误写成 data 属性')
else fail('有 data-* 选择器可能是把 class 写错了', JSON.stringify(fakeDataAttrs))

/* ------------------------------------------------------------------ *
 * 6. 样式表可安全嵌入模板字面量
 * ------------------------------------------------------------------ */

console.log('\n[6] 样式表可安全嵌入模板字面量')

const BACKTICK = String.fromCharCode(96)
for (const [name, css] of [['theme.css', themeCss], ['faction.css', factionCss], ['lab.css', labCss]]) {
  if (css.indexOf(BACKTICK) === -1) ok(name + ' 无反引号')
  else fail(name + ' 里出现了反引号', '它会提前结束 insertCss 的模板字面量')
  if (css.indexOf('${') === -1) ok(name + ' 无 ${')
  else fail(name + ' 里出现了 ${', '它会被模板字面量当成插值')
  /* CSS 的 \XXXX 转义在模板字面量里会变成八进制字面量，直接是语法错误。 */
  const cssEscape = css.match(/\\[0-9a-fA-F]{1,6}/)
  if (cssEscape === null) ok(name + ' 无 \\XXXX 转义')
  else fail(name + ' 里出现了 CSS 十六进制转义', JSON.stringify(cssEscape[0]) + ' —— 请换成字面字符')
}

/* ------------------------------------------------------------------ *
 * 6. 产物与命名空间
 * ------------------------------------------------------------------ */

console.log('\n[7] 产物与命名空间')

const clientBundle = read('client.js')
const hostBundle = read('index.js')

if (/SHEET_MARKER\s*=\s*'[^']+'/.test(clientBundle)) ok('client.js 带 SHEET_MARKER')
else fail('client.js 缺少 SHEET_MARKER', 'HMR 换入新构建时会冻结在旧 CSS 上')

if (clientBundle.indexOf('insertCss(') !== -1) ok('client.js 调用 insertCss')
else fail('client.js 没有调用 insertCss')

if (hostBundle.indexOf('SETTINGS_ENTRY') !== -1) ok('index.js 声明了 SETTINGS_ENTRY')
else fail('index.js 缺少 SETTINGS_ENTRY')

const patchYml = read('cordis.patch.yml')
const patchId = (patchYml.match(/^\s*-\s*id:\s*([a-z0-9-]+)\s*$/m) || [])[1]
const hostEntry = (hostBundle.match(/SETTINGS_ENTRY = '([^']+)'/) || [])[1]
const clientEntry = (clientBundle.match(/PREFS_ENTRY = '([^']+)'/) || [])[1]
if (patchId !== undefined && patchId === hostEntry && patchId === clientEntry) {
  ok('命名空间三处一致', patchId)
} else {
  fail('命名空间不一致', 'patch="' + String(patchId) + '" host="' + String(hostEntry) + '" client="' + String(clientEntry) + '"')
}

/* 宿主 schema 的字段最终会出现在产物里：逐个字段名在产物中查一遍。比数行数可靠
   —— 产物里的缩进会随源码分片变化，而行数统计对格式极其敏感。 */
if (hostTable !== null) {
  const missingInBundle = Object.keys(hostTable).filter(
    (field) => hostBundle.indexOf(field + ": '") === -1
  )
  if (missingInBundle.length === 0) {
    ok('产物里带上了全部 ' + Object.keys(hostTable).length + ' 个字段默认值')
  } else {
    fail('产物里缺少字段默认值', JSON.stringify(missingInBundle))
  }
}

/* ------------------------------------------------------------------ *
 * 汇总
 * ------------------------------------------------------------------ */

console.log('\n' + (failures === 0 ? '通过' : '失败') + '：' + (checks - failures) + '/' + checks + ' 项')
process.exit(failures === 0 ? 0 : 1)
