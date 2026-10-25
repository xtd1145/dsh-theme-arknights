#!/usr/bin/env node
"use strict"
/**
 * scripts/build.js — 把 src/ 下的源码片段拼成两个发布产物。
 *
 *   index.js    Host 半，由 src/host/manifest.js 决定顺序
 *   client.js   Client 半，由 src/client/manifest.js 决定顺序
 *
 * 用法：
 *   node scripts/build.js            写入产物
 *   node scripts/build.js --check    只校验产物是否与源码一致（CI 门禁用）
 *
 * 退出码：0 成功 / 1 失败。--check 失败时打印第一处差异的行号与两侧内容。
 */

const path = require('path')
const { buildOne } = require('./lib/bundle.js')

const ROOT = path.join(__dirname, '..')
const CHECK = process.argv.indexOf('--check') !== -1

const TARGETS = [
  { manifest: path.join('src', 'host', 'manifest.js'), out: 'index.js' },
  { manifest: path.join('src', 'client', 'manifest.js'), out: 'client.js' },
]

let failed = false

for (const target of TARGETS) {
  try {
    const result = buildOne({ root: ROOT, manifest: target.manifest, out: target.out, check: CHECK })
    const status = result.ok ? (CHECK ? 'ok' : 'built') : 'FAIL'
    console.log(status.padEnd(6) + target.out + '  ' + result.reason)
    if (!result.ok) failed = true
  } catch (error) {
    console.log('FAIL  ' + target.out + '  ' + (error && error.message ? error.message : String(error)))
    failed = true
  }
}

process.exit(failed ? 1 : 0)
