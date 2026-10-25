/**
 * dsh-theme-arknights — Edge Intelligence Theme (browser client bundle)
 * 《明日方舟》三阵营终端风主题：罗德岛 / 拉特兰 / 莱茵生命。
 * 底色的工业编辑风最早还原自《明日方舟：终末地》官网
 * （https://endfield.hypergryph.com）；视觉层、阵营系统与终端层已在本项目重写。
 *
 * Client 半部：
 *   1) theme.overrideTokens —— 覆盖主题令牌（亮/暗双色），跟随当前阵营的调色板；
 *   2) insertCss —— 注入字体栈、强调色、直角化、去蓝、hover 反色等全局样式。
 *      （动态插件环境走 styles.insert；安装为独立 bundle 时直接注入 <style> 到 head。）
 *   3) 设置页「明日方舟阵营主题」—— 设置项按五组分类（主题 / 背景 / 动画 / 娱乐 / 音频），
 *      默认值 / 语义标记通过 DSH 的设置命名空间随 profile 落盘。DSH 0.1.7-rc.1 起
 *      走 client `ctx.configForms`（host index.js 导出的 volatile `Config`，命名空间
 *      = profile entry id `theme-arknights`）；旧版 DSH 回落到 `ctx.settingsScope`
 *      （host 的 `ctx.settings.register('dsh-theme-arknights', …)`）。文案跟随 DSH
 *      的语言设置。不再使用 localStorage：见本文 apply() 顶部
 *      「Durable preference store」注释。
 *
 * 文档：README.md 为索引；设计语言见 docs/design-language.md，
 * 各开关行为见 docs/features.md，实现决策与实测数据见 docs/engineering-notes.md。
 *
 * 由 dsh-client-modules 以 /plugins/theme-arknights/client.js 形式加载；
 * 通过 `dsh plugin --profile web add github:xtd1145/dsh-theme-arknights` 安装挂载。
 */
window.__ModuleLoader__.load({
	id: "dsh-theme-arknights",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

/* ---------- Build marker: new code must be able to displace old CSS ----------
   The page-level idempotency flag (window.__dshThemeArknightsApplied) exists
   because the installed bundle is mounted twice on some boots (boot loader +
   cordis composition); only the first mount may own tokens and the sheet.

   A BOOLEAN flag cannot tell those duplicate mounts apart from a REBUILD
   SWAP: dsh-client-modules puts changed bundles into a live tab through its
   rebuilt()/HMR hook, i.e. the module is re-evaluated in a page that already
   ran the previous build, without our dispose ever running. That page carries
   the flag but the OLD stylesheet, so a plain `if (flag) return` froze the tab
   on the previous CSS forever — 「代码明明改了，页面还是老样子」, with no error
   anywhere and no amount of reloading-by-hand in between.

   So the flag is paired with this marker. The window property is written ONLY
   by this build; a pre-marker build wrote the flag alone, which makes "flag set
   but no marker" the exact signature of a stale swap and lets apply() fall
   through and re-install. The marker also rides in the sheet as a comment, so
   which build is mounted can be read straight out of devtools. Bump it whenever
   the stylesheet changes. */
const SHEET_MARKER = 'ak-build/2026-10-25-terminal-deployment'

function insertCss(css) {
  // Dynamic Cordis runner provides the `styles` global; standalone bundle does not.
  if (typeof styles !== 'undefined' && styles && typeof styles.insert === 'function') {
    return styles.insert(css)
  }
  // Idempotency: the installed bundle can be applied more than once (boot loader +
  // cordis composition both mount it). Never stack duplicate theme stylesheets.
  document.querySelectorAll('style[data-plugin="dsh-theme-arknights"]').forEach((old) => old.remove())
  const el = document.createElement('style')
  el.setAttribute('data-plugin', 'dsh-theme-arknights')
  el.textContent = css
  document.head.appendChild(el)
  return () => {
    if (el.parentNode) el.parentNode.removeChild(el)
  }
}

function apply(ctx) {    // Idempotency: the installed bundle can be applied more than once (boot loader +
    // cordis composition both mount it). Only the first application owns tokens/styles;
    // duplicate overrideTokens would replace the layer and break the toggle's dispose.
    // The flag is RELEASED by the run's dispose (see the ctx.effect cleanup below), so
    // a dispose followed by a re-apply in the same page session mounts the theme again
    // instead of staying dead until a hard reload.
    if (typeof window !== 'undefined' && window.__dshThemeArknightsApplied) {
      // Same build mounted again (boot loader + cordis composition): the first
      // mount owns tokens/styles, so leave it alone. A DIFFERENT build means this
      // module was swapped into a live tab by the rebuilt()/HMR path without a
      // dispose: the old sheet is still mounted and the flag would freeze the tab
      // on the old CSS. Drop that stale sheet and fall through to a fresh apply.
      if (window.__dshThemeArknightsBuild === SHEET_MARKER) return
      try {
        document.querySelectorAll('style[data-plugin="dsh-theme-arknights"]').forEach((old) => old.remove())
      } catch (e) { /* no inspectable DOM (tests, non-browser host): nothing to clean */ }
    }
    // Claim the flag only once the theme service is actually there: a boot order where
    // it is still missing must not lock the flag in place and kill every later apply.
    const theme = ctx.get('theme')
    if (theme === undefined) return
    if (typeof window !== 'undefined') {
      window.__dshThemeArknightsApplied = true
      window.__dshThemeArknightsBuild = SHEET_MARKER
    }
