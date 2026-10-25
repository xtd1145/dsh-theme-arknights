"use strict"
/**
 * scripts/lib/bundle.js — 源码片段拼接器。
 *
 * 唯一职责：按 manifest 列出的顺序，把片段文件字面拼成一个产物字符串。
 * 没有任何包装、重排、缩进调整或行尾归一化——这样 `--check` 的「产物与源码
 * 逐字节一致」才是一句可验证的话，而不是一句期望。
 *
 * 两类片段：
 *   .js    原样拼接。
 *   .css   包成 `const THEME_CSS = \`…\``。因为要放进模板字面量，样式表里不能
 *          出现反引号或 `${`；出现就**报错**而不是转义——静默转义会让产物里的
 *          CSS 与源文件不再逐字相同，下一次 --check 就再也说不清哪边是对的。
 */

const fs = require('fs')
const path = require('path')

/** 读取行尾并原样保留：产物必须与源片段逐字节一致，包含 CRLF/LF。 */
function readFragment(file) {
  return fs.readFileSync(file, 'utf8')
}

/** 校验一段 CSS 可以安全地嵌进模板字面量，并原样返回。
 *
 *  产物里的样式表是 `insertCss(\`…\`)` 的**裸内容**——`41-mount-tokens.js` 打开那个
 *  模板字面量，`42-mount-tail.js` 闭合它，中间的样式表片段就是内容本身。所以这里
 *  不加任何包装，只做安全检查：反引号会提前结束字符串，`${` 会被当成插值。
 *  出现任何一个都**报错而不是转义**——静默转义会让产物里的 CSS 与源文件不再逐字
 *  相同，下一次 --check 就再也说不清哪边是对的。 */
function assertCssSafe(css, label) {
  if (css.indexOf('`') !== -1) {
    const line = css.slice(0, css.indexOf('`')).split('\n').length
    throw new Error(
      label + ': 样式表第 ' + line + ' 行出现了反引号。它会提前结束 insertCss 的模板字面量。'
    )
  }
  if (css.indexOf('${') !== -1) {
    const line = css.slice(0, css.indexOf('${')).split('\n').length
    throw new Error(
      label + ': 样式表第 ' + line + ' 行出现了 ${。它会被模板字面量当成插值。'
    )
  }
  return css
}

/**
 * 按 manifest 拼接一个产物。
 *
 * @param root - 包根目录。
 * @param manifestPath - manifest 文件的绝对路径。
 * @returns 产物的完整文本。
 */
function bundle(root, manifestPath) {
  const entries = require(manifestPath)
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(path.relative(root, manifestPath) + ': manifest 必须是一个非空数组')
  }
  const baseDir = path.dirname(manifestPath)

  /* 先把片段全部读进来，因为样式表要合并：产物里只能有一个
     `const THEME_CSS = \`…\``，多个样式表片段按 manifest 顺序拼进同一个字符串。
     拼接点取**第一个** css 片段的位置——它决定了这个常量在 apply() 函数体里的
     声明位置，而片段顺序就是执行顺序，往后挪会让先引用它的代码撞上 TDZ。 */
  const loaded = []
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object' || typeof entry.file !== 'string') {
      throw new Error(path.relative(root, manifestPath) + ': 每个条目都要有 { file }')
    }
    const file = path.resolve(baseDir, entry.file)
    if (!fs.existsSync(file)) {
      throw new Error('片段不存在: ' + path.relative(root, file) + '（来自 manifest 的 ' + entry.file + '）')
    }
    loaded.push({
      text: readFragment(file),
      isCss: path.extname(file) === '.css',
      file,
    })
  }

  const cssAll = loaded.filter((item) => item.isCss).map((item) => item.text).join('\n')
  const cssFiles = loaded.filter((item) => item.isCss).map((item) => path.basename(item.file))

  const parts = []
  let cssEmitted = false
  for (const item of loaded) {
    if (item.isCss) {
      if (!cssEmitted) {
        /* 多个样式表片段按 manifest 顺序拼进同一个模板字面量，整体做一次安全检查。 */
        parts.push(assertCssSafe(cssAll, cssFiles.join(' + ')))
        cssEmitted = true
      }
      continue
    }
    parts.push(item.text)
  }
  return parts.join('')
}

/**
 * 构建一个目标，或在 --check 模式下只校验产物是否过期。
 *
 * @param options.root - 包根目录。
 * @param options.manifest - manifest 的相对路径。
 * @param options.out - 产物的相对路径。
 * @param options.check - true 时只比较，不写盘。
 * @returns `{ ok, out, reason }`。
 */
function buildOne(options) {
  const { root, manifest, out, check } = options
  const manifestPath = path.join(root, manifest)
  const outPath = path.join(root, out)
  const produced = bundle(root, manifestPath)
  if (check) {
    if (!fs.existsSync(outPath)) {
      return { ok: false, out, reason: '产物不存在，请先跑 npm run build' }
    }
    const actual = fs.readFileSync(outPath, 'utf8')
    if (actual === produced) return { ok: true, out, reason: '与源码一致' }
    /* 只报第一处差异，就够定位了：行号 + 两边的行内容。 */
    const a = actual.split('\n')
    const b = produced.split('\n')
    const limit = Math.max(a.length, b.length)
    for (let i = 0; i < limit; i += 1) {
      if (a[i] !== b[i]) {
        return {
          ok: false,
          out,
          reason:
            '产物已过期，第一处差异在第 ' + (i + 1) + ' 行\n' +
            '  产物: ' + JSON.stringify(a[i] === undefined ? '<EOF>' : a[i]) + '\n' +
            '  源码: ' + JSON.stringify(b[i] === undefined ? '<EOF>' : b[i]),
        }
      }
    }
    return { ok: false, out, reason: '产物已过期（行内容相同但长度不同，检查行尾）' }
  }
  fs.writeFileSync(outPath, produced)
  return { ok: true, out, reason: '已写入' }
}

module.exports = { bundle, buildOne, assertCssSafe }
