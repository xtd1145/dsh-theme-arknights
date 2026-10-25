#!/usr/bin/env node
"use strict"
/**
 * test/palette-contrast.test.js — 阵营 × 档位 × 明暗的 WCAG 对比度验算。
 *
 * 颜色是量出来的，不是挑出来的。这个脚本解析 src/styles/faction.css 里那六组
 * --edge-* 变量，再叠上 src/styles/lab.css 的档位层（第三档「莱茵终端版」改写
 * 纸面家族，强调色留给阵营），对每一个**实际落在某个表面上**的角色算对比度：
 *
 *   正文 / 次要文字                      压在 paper 与 panel 上
 *   强调色作为文字                       压在 paper 与 panel 上
 *   实心强调底上的字                     压在 accent 上
 *   回合状态文字与它的亮带               压在两种底色上（扫光会扫过字形）
 *   语义状态色                           压在 paper 上
 *   细线 / 重线                          装饰强度区间
 *
 * 门槛按 WCAG 2.1：正文 AAA 7:1（一套界面主题的正文没有理由停在及格线），
 * 其余 AA 4.5:1；装饰性表面另有一套更低的判据（它们描述「有多抢眼」）。
 *
 * 退出码：0 全部达标 / 1 有不达标项。
 */

const fs = require('fs')
const path = require('path')

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

/* ------------------------------------------------------------------ *
 * WCAG 对比度
 * ------------------------------------------------------------------ */

const toLinear = (channel) => {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

const parseHex = (hex) => {
  const text = String(hex).replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(text)) return null
  return [
    parseInt(text.slice(0, 2), 16),
    parseInt(text.slice(2, 4), 16),
    parseInt(text.slice(4, 6), 16),
  ]
}

const luminance = (rgb) => 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2])

function contrast(foreground, background) {
  const a = parseHex(foreground)
  const b = parseHex(background)
  if (a === null || b === null) return null
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/* ------------------------------------------------------------------ *
 * 解析六组变量
 * ------------------------------------------------------------------ */

const CSS = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'faction.css'), 'utf8')
const LAB_CSS = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'lab.css'), 'utf8')

function varsOf(selector, text) {
  const source = text === undefined ? CSS : text
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'))
  if (match === null) return null
  const out = {}
  for (const decl of match[1].matchAll(/(--edge-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[decl[1]] = decl[2].trim()
  }
  return out
}

/* 第三档「莱茵终端版」叠在阵营之上：它接管纸面家族与语义状态色，强调色留给
   阵营。所以每一档的验算表 = 阵营组 ∪ 档位组，与运行时的层叠顺序一致。 */
const LAB_LAYER = {
  light: 'body.theme-arknights-advanced.theme-arknights-lab',
  dark: 'body.theme-arknights-advanced.theme-arknights-lab[data-ds-dark-theme]',
}

const FACTION_GROUPS = [
  { label: '罗德岛', mode: 'light', light: 'body.theme-arknights-themed', dark: 'body.theme-arknights-themed[data-ds-dark-theme]' },
  { label: '罗德岛', mode: 'dark', light: 'body.theme-arknights-themed', dark: 'body.theme-arknights-themed[data-ds-dark-theme]' },
  { label: '拉特兰', mode: 'light', light: 'body.theme-arknights-themed.theme-arknights-laterano', dark: 'body.theme-arknights-themed.theme-arknights-laterano[data-ds-dark-theme]' },
  { label: '拉特兰', mode: 'dark', light: 'body.theme-arknights-themed.theme-arknights-laterano', dark: 'body.theme-arknights-themed.theme-arknights-laterano[data-ds-dark-theme]' },
  { label: '莱茵生命', mode: 'light', light: 'body.theme-arknights-themed.theme-arknights-rhine', dark: 'body.theme-arknights-themed.theme-arknights-rhine[data-ds-dark-theme]' },
  { label: '莱茵生命', mode: 'dark', light: 'body.theme-arknights-themed.theme-arknights-rhine', dark: 'body.theme-arknights-themed.theme-arknights-rhine[data-ds-dark-theme]' },
]

const GROUPS = FACTION_GROUPS.concat(
  FACTION_GROUPS.map((group) => Object.assign({}, group, {
    lab: true,
    label: group.label + '·莱茵终端档',
  }))
)

/* 暗色组继承同阵营亮色组的造型变量（字体、字距）。测试把两组叠起来，拿到的是
   运行时**实际生效**的那一份变量表，而不是「这一组自己写了什么」。 */
function effectiveVars(group) {
  const light = varsOf(group.light)
  const dark = varsOf(group.dark)
  if (light === null || dark === null) return null
  const faction = group.mode === 'light' ? Object.assign({}, light) : Object.assign({}, light, dark)
  if (!group.lab) return faction
  /* 档位组叠在阵营组之上，顺序与样式表一致（lab.css 在 faction.css 之后）。
     漏掉这一步，验算的就是「阵营那套纸 + 档位那套字」这种运行时不存在的组合。 */
  const labLight = varsOf(LAB_LAYER.light, LAB_CSS)
  const labDark = varsOf(LAB_LAYER.dark, LAB_CSS)
  if (labLight === null || labDark === null) return null
  return group.mode === 'light'
    ? Object.assign({}, faction, labLight)
    : Object.assign({}, faction, labLight, labDark)
}

/* ------------------------------------------------------------------ *
 * 逐组验算
 * ------------------------------------------------------------------ */

const accents = []

for (const group of GROUPS) {
  const vars = effectiveVars(group)
  const title = group.label + '·' + (group.mode === 'light' ? '亮色' : '暗色')
  console.log('\n[' + title + ']')

  if (vars === null) {
    fail(title + ': 解析不到变量块')
    continue
  }

  const at = (name) => vars['--edge-' + name]

  /* 正文与次要文字 */
  for (const surface of ['paper', 'panel']) {
    const body = contrast(at('ink'), at(surface))
    if (body === null) fail(title + ': 正文 on ' + surface + ' 无法计算')
    else if (body >= 7) ok('正文 on ' + surface, body.toFixed(2) + ':1 ≥ 7')
    else fail('正文 on ' + surface + ' 未达 AAA', body.toFixed(2) + ':1 < 7  (' + at('ink') + ' on ' + at(surface) + ')')

    const secondary = contrast(at('ink-2'), at(surface))
    if (secondary === null) fail(title + ': 次要文字 on ' + surface + ' 无法计算')
    else if (secondary >= 4.5) ok('次要文字 on ' + surface, secondary.toFixed(2) + ':1 ≥ 4.5')
    else fail('次要文字 on ' + surface + ' 未达 AA', secondary.toFixed(2) + ':1 < 4.5')
  }

  /* 强调色作为文字。
     **按模式取不同的档**：亮色纸面上明金/亮蓝会被吃掉亮度，所以亮色模式用的是
     下沉过的 --edge-accent-onpaper；暗色模式底是近黑，直接用 --edge-accent。
     每组都定义了这两个变量（样式表要求六组齐全），但只有一个会被该模式使用，
     检查错的那一个只会造出一堆假失败。 */
  const accentTextVar = group.mode === 'light' ? 'accent-onpaper' : 'accent'
  for (const surface of ['paper', 'panel']) {
    const read = contrast(at(accentTextVar), at(surface))
    if (read === null) fail(title + ': 强调文字 on ' + surface + ' 无法计算')
    else if (read >= 4.5) ok('强调文字 on ' + surface, read.toFixed(2) + ':1 ≥ 4.5  (' + accentTextVar + ')')
    else fail('强调文字 on ' + surface + ' 未达 AA', read.toFixed(2) + ':1 < 4.5  (' + at(accentTextVar) + ' on ' + at(surface) + ')')
  }

  /* 实心强调底上的字。亮色模式用纸色作前景（强调底是深色），暗色用纸色同样成立
     ——这一主题的 accent 在两种模式下都与自己的纸色形成足够反差。 */
  const onAccent = contrast(at('paper'), at('accent'))
  if (onAccent === null) fail(title + ': 实心强调底上的字无法计算')
  else if (onAccent >= 4.5) ok('实心强调底上的字', onAccent.toFixed(2) + ':1 ≥ 4.5')
  else fail('实心强调底上的字未达 AA', onAccent.toFixed(2) + ':1 < 4.5  (' + at('paper') + ' on ' + at('accent') + ')')

  /* 回合状态文字：扫光亮带会压在字形上，所以两种底色都要过。
     同样**按模式只检查该用的那一档**：亮色模式读 --edge-status-light，暗色模式读
     --edge-status-dark。两者都定义在每组里（六组齐全的要求），但只有一个生效。 */
  const statusVar = group.mode === 'light' ? 'status-light' : 'status-dark'
  for (const surface of ['paper', 'panel']) {
    const value = contrast(at(statusVar), at(surface))
    if (value === null) fail(title + ': ' + statusVar + ' on ' + surface + ' 无法计算')
    else if (value >= 4.5) ok(statusVar + ' on ' + surface, value.toFixed(2) + ':1 ≥ 4.5')
    else fail(statusVar + ' on ' + surface + ' 未达 AA', value.toFixed(2) + ':1 < 4.5  (' + at(statusVar) + ')')
  }

  /* 语义状态色 */
  for (const token of ['error', 'success', 'warn']) {
    const value = contrast(at(token), at('paper'))
    if (value === null) fail(title + ': ' + token + ' on paper 无法计算')
    else if (value >= 4.5) ok(token + ' on paper', value.toFixed(2) + ':1 ≥ 4.5')
    else fail(token + ' on paper 未达 AA', value.toFixed(2) + ':1 < 4.5  (' + at(token) + ')')
  }

  /* 装饰性表面 */
  const hairline = contrast(at('line'), at('paper'))
  if (hairline === null) fail(title + ': 细线无法计算')
  else if (hairline >= 1.12) ok('细线 on paper', hairline.toFixed(2) + ':1 ≥ 1.12')
  else fail('细线太弱（形同不存在）', hairline.toFixed(2) + ':1 < 1.12')

  const heavy = contrast(at('line-2'), at('paper'))
  if (heavy === null) fail(title + ': 重线无法计算')
  else if (heavy >= 1.35) ok('重线 on paper', heavy.toFixed(2) + ':1 ≥ 1.35')
  else fail('重线太弱（看不清边界）', heavy.toFixed(2) + ':1 < 1.35')

  /* accent-rgb 必须与 accent 一致（半透明色块靠它） */
  const accentHex = at('accent')
  const parsed = parseHex(accentHex)
  const rgbRaw = at('accent-rgb')
  if (parsed === null) {
    fail(title + ': accent 不是六位 hex', String(accentHex))
  } else if (rgbRaw === undefined) {
    fail(title + ': 缺少 accent-rgb')
  } else {
    const wanted = parsed.join(', ')
    const got = rgbRaw.split(',').map((part) => part.trim()).join(', ')
    if (wanted === got) ok('accent-rgb 与 accent 一致')
    else fail('accent-rgb 与 accent 不一致', 'accent=' + accentHex + ' → ' + wanted + '，accent-rgb=' + got)
  }

  accents.push({ label: group.label, mode: group.mode, lab: group.lab === true, accent: accentHex, paper: at('paper') })
}

/* ------------------------------------------------------------------ *
 * 三套阵营必须真的不同
 * ------------------------------------------------------------------ */

console.log('\n[阵营之间必须可区分]')

for (const mode of ['light', 'dark']) {
  const ofMode = accents.filter((row) => row.mode === mode && row.lab === false)
  const unique = new Set(ofMode.map((row) => String(row.accent).toLowerCase()))
  if (ofMode.length === 3 && unique.size === 3) {
    ok(mode + ' 下三套阵营的强调色两两不同', ofMode.map((row) => row.label + '=' + row.accent).join('  '))
  } else {
    fail(mode + ' 下阵营强调色有重复或缺失', ofMode.map((row) => row.label + '=' + row.accent).join('  '))
  }
}

/* 档位换的是材质不是身份：lab 组仍读阵营那一份 accent，纸面家族整套换掉。
   所以「lab 与同阵营同明暗的普通组相比，accent 相同、paper 不同」是这一档唯一
   能被静态验算的存在性证明——哪天 lab.css 的纸面令牌被误删，这条会先红。 */
for (const row of accents) {
  if (row.lab === false) continue
  const faction = accents.find(
    (other) => other.lab === false && other.mode === row.mode && row.label.indexOf(other.label + '·') === 0
  )
  if (faction === undefined) {
    fail('找不到莱茵终端档对应的阵营组', row.label)
    continue
  }
  if (String(row.accent).toLowerCase() === String(faction.accent).toLowerCase()) {
    ok(row.label + ' 强调色仍归阵营', faction.accent)
  } else {
    fail(row.label + ' 越界改了强调色', faction.accent + ' → ' + row.accent + '（颜色只该有阵营那一份真相）')
  }
  if (String(row.paper).toLowerCase() !== String(faction.paper).toLowerCase()) {
    ok(row.label + ' 换了纸面家族', faction.paper + ' → ' + row.paper)
  } else {
    fail(row.label + ' 没有换纸', row.paper + '（档位层失效，切档不会有任何视觉变化）')
  }
}

/* ------------------------------------------------------------------ *
 * 汇总
 * ------------------------------------------------------------------ */

console.log('\n' + (failures === 0 ? '通过' : '失败') + '：' + (checks - failures) + '/' + checks + ' 项')
process.exit(failures === 0 ? 0 : 1)
