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

    /* ---------- Durable preference store (replaces localStorage) ----------
       The theme's switches used to persist through `localStorage`, which DSH
       Desktop broke on every restart: Desktop binds a fresh random localhost
       port per launch, so the origin (and thus the browser storage scope)
       changed and the saved settings silently reset to defaults.

       The durable authority is DSH's own settings service, and DSH 0.1.7-rc.1
       moved it once more. The whole pre-0.1.7 seam — a host
       `ctx.settings.register(namespace, schema)` persisted by
       `@deepseek-ai/dsh-settings-file` to `<dshHome>/settings.yaml`, mirrored
       to the browser as the `ctx.settingsScope` service — is GONE: the package
       is not in the distribution any more, `settings.yaml` is not the settings
       carrier, and the client has no `settingsScope` service at all.

       What replaced it (see index.js for the host side):

         host    the plugin entry exports a schemastery `Config` whose fields
                 are `.volatile()`. `ctx.settings` projects it into a form and
                 persists user edits into the PROFILE PATCH
                 (<profile>/cordis.patch.yml) through `ctx.configEditor`,
                 i.e. a path owned by DSH and independent of the web origin.
         client  `ctx.get('configForms')` — the settings domain's shared-form
                 service — `.get(<profile entry id>)` returns that entry's
                 ConfigForm: getSnapshot() / subscribe() / set() / unset() /
                 mutate().

       The namespace is now the PROFILE ENTRY ID, not a plugin-chosen string:
       this package's cordis.patch.yml inserts `id: theme-arknights`, and
       index.js exports that same id as SETTINGS_ENTRY. Both halves still speak
       the old namespace string for the legacy fallback and as the prefix of
       every UI key in the tables below.

       Older hosts (<= 0.1.5-rc.2) keep the old seam, which this file still
       binds when no `configForms` service exists — see the transport-selection
       note further down. Either way the values live host-side, so:

         dsh web     (browser, fixed loopback port)  -> host persistence
         DSH Desktop (browser, random loopback port) -> host persistence

       Both are loopback pages, so DSH resolves the connection to 'host' mode
       and the values land on disk; a change of port does not move them because
       nothing lives in browser storage any more. (0.2.1-rc.2 removed the `mode`
       field from the form snapshot entirely — writes then always ride
       `remote.settings.mutate()` to the Host document, so "is this page
       loopback?" is no longer a question that generation can answer or needs.)

       Value model. Namespace fields are the tails of the old localStorage keys
       and are stored as the same strings, so the semantics (and any older
       <settings.yaml> section from a prior build) keep scanning identically:
         default-ON switches store  '1'  and read as  !== '0'
         default-OFF switches store '0'  and read as  === '1'
         palette/radius/fps/speed  store one of their documented literals.
       FIELD_DEFAULTS is the shipped fallback and mirrors index.js.

       Resilience. Before the transport hands us a section (boot), or in an
       environment with neither settings service at all (an out-of-DSH page,
       in-process tests), the store falls back to FIELD_DEFAULTS overlaid with
       any in-page overrides made this session. Writes are committed to the
       settings transport only when it is ready + writable; otherwise they are
       kept session-local so toggles still work in place but do not persist
       (there is no durable backend to persist to — and no localStorage). */
    /* DSH 0.1.7-rc.1 settings namespace: the profile entry id of this plugin's
       row (index.js SETTINGS_ENTRY, cordis.patch.yml `id: theme-arknights`).
       `configForms.get()` is keyed by exactly that string. */
    const PREFS_ENTRY = 'theme-arknights'
    /* Pre-0.1.7 namespace string. Still the prefix of every UI key in the
       tables below, and the namespace the legacy `settingsScope` bind asks
       for — so it stays even though the modern transport never uses it. */
    const PREFS_NS = 'dsh-theme-arknights'
    const PREFS_FIELD_DEFAULTS = {
      enabled: '1',
      faction: 'rhodes',
      layout: 'advanced',
      factionBar: '1',
      radius: 'square',
      glass: 'off',
      /* 输出滚动动画 —— default ON: it changes nothing about what the app decides
         (the read-back stays exact) and only softens the streaming pin, so it is a
         pure improvement for a feature whose whole point is that the output was
         hard to read while it streamed. See 23-scroll-anim.js. */
      scrollAnim: '1',
      scrollAnimLevel: 'standard',
      watermark: '1',
      watermarkPersist: '0',
      loader: '0',
      thunder: '0',
      thunderAnim: '0',
      /* 顶部余额胶囊 — opt-in, like thunder: a fixed capsule at the top center
         of the frame showing the account balance, fed by the host-side
         /theme-arknights/balance route. Ships OFF so an upgrade never adds a
         floating element the user did not ask for. */
      balanceCapsule: '0',
      /* 渠道额度胶囊的右侧百分比读数选「已用」还是「剩余」——两个值都有真实语义，
         不存在默认就错的答案，所以默认 used（与插件自身徽章一致的读法）。
         仅影响 credits 模式的右侧百分比槽位；左侧主数字始终为剩余额度。 */
      creditDisplay: 'remaining',
      /* 余额胶囊的停靠位 —— center（顶部居中）| left（靠左）| right（靠右）。
         仅当胶囊开启时有意义：选择靠边停靠可让开侧边栏与顶部工具栏的交叠区。 */
      balanceCapsulePosition: 'center',
      /* 防遮挡的两个子开关 —— 侧边栏展开自动隐藏 / 指针靠近自动隐藏。
         default-ON：用户抱怨的就是遮挡，两个行为同时默认生效；单独关掉
         其中一个的出口保留在这里（开关语义与其余 default-ON 一致：!== '0'）。 */
      balanceCapsuleSidebarHide: '0',
      balanceCapsuleHoverHide: '1',
      /* 音频通知 (host half: lib/audio.js). Two live slots — the prompt that
         starts a turn and the final answer that ends one. `audioAttention` and
         `audioTurnFail` are 预留: the sounds and switches ship, the triggers do
         not, and the settings rows say so.

         The MASTER switch ships OFF (opt-in), mirroring index.js FIELD_DEFAULTS
         and lib/audio.js FALLBACK: an install that upgrades into this feature
         must not start making noise by itself. The per-slot switches stay ON, so
         turning the master on is what starts the sound. */
      audioEnabled: '0',
      audioVolume: '100',
      audioBoot: '1',
      audioTurnStart: '1',
      audioTurnDone: '1',
      audioAttention: '1',
      audioTurnFail: '1',
      audioDebounceMs: '2500',
      audioSoundDir: '',
      audioHumanOnly: '1',
      audioDiag: '0',
    }
    /* Convert a namespaced storage key tail to the camelCase field the settings
       schema declares (index.js FIELD_DEFAULTS). A build that derived the field
       by stripping the namespace prefix instead left a compound name in its
       kebab-case spelling, so this conversion is also the read migration for any
       key the explicit table below does not list. */
    const prefsFieldFromKey = (rawKey) => {
      const prefix = PREFS_NS + '-'
      const tail = rawKey.indexOf(prefix) === 0 ? rawKey.slice(prefix.length) : rawKey
      return tail.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase())
    }
    /* Which schema field each UI/store key names. The left half is the key the
       theme's own code has always used (the localStorage-era name, which the
       settings rows, locales and tests all still speak); the right half is the
       field the HOST registered in its schema (index.js FIELD_DEFAULTS — the
       only names a scope.set can actually store).

       THEY ARE NOT THE SAME STRING for any compound field, and deriving one
       from the other by stripping the namespace prefix — the old
       `k.slice(PREFS_NS.length + 1)` — is the bug this table exists to kill: it
       turned 'dsh-theme-arknights-thunder-anim' into 'thunder-anim', while the
       schema declares 'thunderAnim'. Every compound field was affected this way
       (thunderAnim, watermarkPersist): the write landed on an UNDECLARED key, schemastery
       kept it (it validates declared fields and passes extras through) but the
       declared field stayed at its default, so the switch worked for the page
       session, persisted junk into settings.yaml, and came back at its default
       on the next load. Hence "开关刷新后复位".

       Keys are therefore listed EXPLICITLY, never computed. */
    const PREFS_KEY_TO_FIELD = {
      'dsh-theme-arknights-enabled': 'enabled',
      'dsh-theme-arknights-faction': 'faction',
      'dsh-theme-arknights-layout': 'layout',
      'dsh-theme-arknights-faction-bar': 'factionBar',
      'dsh-theme-arknights-radius': 'radius',
      'dsh-theme-arknights-glass': 'glass',
      /* 输出滚动动画. The two keys happen to equal their schema fields, so the
         prefix-strip fallback would also resolve them — they are listed explicitly
         because the table is the ONE place a UI key becomes a field, and because
         test/settings-namespace.test.js requires every declared host field to have
         an entry here. */
      'dsh-theme-arknights-scroll-anim': 'scrollAnim',
      'dsh-theme-arknights-scroll-anim-level': 'scrollAnimLevel',
      'dsh-theme-arknights-watermark': 'watermark',
      'dsh-theme-arknights-watermark-persist': 'watermarkPersist',
      'dsh-theme-arknights-loader': 'loader',
      'dsh-theme-arknights-thunder': 'thunder',
      'dsh-theme-arknights-thunder-anim': 'thunderAnim',
      'dsh-theme-arknights-balance-capsule': 'balanceCapsule',
      'dsh-theme-arknights-credit-display': 'creditDisplay',
      'dsh-theme-arknights-balance-capsule-position': 'balanceCapsulePosition',
      'dsh-theme-arknights-balance-capsule-sidebar-hide': 'balanceCapsuleSidebarHide',
      'dsh-theme-arknights-balance-capsule-hover-hide': 'balanceCapsuleHoverHide',
      /* 音频通知. These tails happen to equal their schema fields, so every one of
         them would also resolve correctly through the prefix-strip fallback — they
         are listed explicitly because test/settings-namespace.test.js asserts that
         EVERY declared host field has a mapping entry, and because "the mapping is
         the one place a UI key becomes a field" only holds if it is complete. */
      'dsh-theme-arknights-audio-enabled': 'audioEnabled',
      'dsh-theme-arknights-audio-volume': 'audioVolume',
      'dsh-theme-arknights-audio-boot': 'audioBoot',
      'dsh-theme-arknights-audio-turn-start': 'audioTurnStart',
      'dsh-theme-arknights-audio-turn-done': 'audioTurnDone',
      'dsh-theme-arknights-audio-attention': 'audioAttention',
      'dsh-theme-arknights-audio-turn-fail': 'audioTurnFail',
      'dsh-theme-arknights-audio-debounce-ms': 'audioDebounceMs',
      'dsh-theme-arknights-audio-sound-dir': 'audioSoundDir',
      'dsh-theme-arknights-audio-human-only': 'audioHumanOnly',
      'dsh-theme-arknights-audio-diag': 'audioDiag',
    }
    /* The pre-migration spelling of a compound field, for the sections that the
       buggy build already wrote: 'thunderAnim' -> 'thunder-anim'. Derived from
       the table (not from the schema, which cannot know it) so the two can never
       drift, and only for fields that really do have a distinct legacy double:
       every single-word field maps to itself and is skipped. */
    const PREFS_FIELD_TO_LEGACY_KEY = (() => {
      const m = {}
      for (const field of Object.keys(PREFS_KEY_TO_FIELD)) {
        const f = PREFS_KEY_TO_FIELD[field]
        const legacy = field.slice(PREFS_NS.length + 1)
        if (legacy !== f) m[f] = legacy
      }
      return m
    })()
    /* The single place a UI/store key turns into a schema field name: both the
       read path (prefsGet) and the write path (prefsSet/prefsCommit) go through
       it, so a switch can never read a field other than the one it writes. A key
       that is already a field name passes through, which is what the settings
       panel's own state and the tests use. */
    const prefsFieldOf = (rawKey) => {
      if (Object.prototype.hasOwnProperty.call(PREFS_KEY_TO_FIELD, rawKey)) return PREFS_KEY_TO_FIELD[rawKey]
      if (Object.prototype.hasOwnProperty.call(PREFS_FIELD_DEFAULTS, rawKey)) return rawKey
      /* Last resort: a key this table does not list. It is camelCased through
         prefsFieldFromKey rather than handed back as the raw tail, so a compound
         name reaching this path still lands on the camelCase field the host
         DECLARES instead of on an undeclared kebab key — which is precisely the
         failure mode the table above exists to prevent, and which a future
         compound row could otherwise reintroduce silently. */
      return prefsFieldFromKey(rawKey)
    }
    /* ---------- 音频通知 preferences (host half owns playback) ----------
       The browser's whole job here is switches, a volume number and the preview
       buttons; every sound is played by the host process, including the previews
       (that is the point: the preview must go through the same path as a real
       notification, or testing it proves nothing). The keys below pass through
       prefsFieldOf unchanged and equal the schema field names, so a switch can
       never write an undeclared field. */
    const AUDIO_ENABLED_KEY = 'audioEnabled'
    const AUDIO_BOOT_KEY = 'audioBoot'
    const AUDIO_TURN_START_KEY = 'audioTurnStart'
    const AUDIO_TURN_DONE_KEY = 'audioTurnDone'
    const AUDIO_VOLUME_KEY = 'audioVolume'
    const AUDIO_HUMAN_ONLY_KEY = 'audioHumanOnly'
    const AUDIO_DIAG_KEY = 'audioDiag'
    const AUDIO_SOUND_DIR_KEY = 'audioSoundDir'
    const AUDIO_STATE_URL = '/theme-arknights/audio/state'
    const AUDIO_PREVIEW_URL = '/theme-arknights/audio/preview'
    const AUDIO_ATTENTION_URL = '/theme-arknights/audio/attention'
    /* ---------- 顶部余额胶囊 (host half owns the balance query) ----------
       The page cannot reach the account service itself — only Host consumers
       can obtain the request credential — so the capsule polls the host-side
       route below and renders whatever it returns. */
    const BALANCE_URL = '/theme-arknights/balance'
    const BALANCE_POLL_MS = 60000
    // The pricing window ticks every second (countdown to the next edge).
    const BALANCE_TICK_MS = 1000
    // The capsule opens as the brand panel and collapses into the balance row
    // once the first account answer lands (success or failure — an offline host
    // must not leave the brand pose up forever). MIN keeps the brand readable on
    // a fast network; MAX is the cap when nothing ever answers.
    const BALANCE_BOOT_MIN_MS = 900
    const BALANCE_BOOT_MAX_MS = 5000
    /* 胶囊停靠位与防遮挡的字面量集（设置页下拉与读取器共用） */
    const BALANCE_POSITION_KEY = 'balanceCapsulePosition'
    const BALANCE_POSITION_OPTIONS = ['center', 'left', 'right']
    const readBalanceCapsulePosition = () => {
      const v = prefsGet(BALANCE_POSITION_KEY)
      return BALANCE_POSITION_OPTIONS.indexOf(v) >= 0 ? v : 'center'
    }
    /* 防遮挡子开关：default-ON（!== '0'），与主开关的读取惯例一致。 */
    const BALANCE_SIDEBAR_HIDE_KEY = 'balanceCapsuleSidebarHide'
    const BALANCE_HOVER_HIDE_KEY = 'balanceCapsuleHoverHide'
    const isBalanceSidebarHideOn = () => prefsGet(BALANCE_SIDEBAR_HIDE_KEY) === '1'
    const isBalanceHoverHideOn = () => prefsGet(BALANCE_HOVER_HIDE_KEY) !== '0'
    /* ---------- 渠道额度 (dsh-codearts-auth / jet-hub) ----------
       When the session's model directory names one of the providers the
       dsh-codearts-auth plugin serves, the capsule swaps the DeepSeek wallet
       read for that channel's remaining credits. The numbers come over the
       same management RPC the plugin's own client uses —
       connection.rpc.call('/api', 'jet-hub', { method: 'usage.badge', ... }) —
       so session credentials and the host-side badge cache (TTL 120s, failure
       TTL 15s) come for free; the page only ever names the provider.
       The id table IS the plugin's contract: usage.badge answers for these
       twelve, and anything else — notably the built-in DeepSeek models — keeps
       the wallet display, so an absent plugin can never blank the capsule. */
    const JET_HUB_RPC_SCOPE = '/api'
    const JET_HUB_RPC_CHANNEL = 'jet-hub'
    const JET_HUB_PROVIDER_LABELS = {
      codearts: 'CodeArts',
      buddy: 'CodeBuddy',
      workbuddy: 'WorkBuddy',
      lobsterai: 'LobsterAI',
      qoder: 'Qoder',
      qodercn: 'Qoder CN',
      trae: 'TRAE',
      cline: 'Cline',
      loomy: 'Loomy',
      raccoon: 'Raccoon',
      minimax: 'MiniMax',
      zcode: 'ZCode',
      opencode: 'OpenCode',
    }
    // Default ON for the master switch and both live slots; default OFF for the
    // diagnostics switch, so the host console stays quiet unless asked.
    const isAudioOn = () => prefsGet(AUDIO_ENABLED_KEY) !== '0'
    const isAudioBootOn = () => prefsGet(AUDIO_BOOT_KEY) !== '0'
    const isAudioStartOn = () => prefsGet(AUDIO_TURN_START_KEY) !== '0'
    const isAudioDoneOn = () => prefsGet(AUDIO_TURN_DONE_KEY) !== '0'
    const isAudioHumanOnly = () => prefsGet(AUDIO_HUMAN_ONLY_KEY) !== '0'
    const isAudioDiagOn = () => prefsGet(AUDIO_DIAG_KEY) === '1'
    const readAudioVolume = () => {
      const parsed = Number.parseInt(prefsGet(AUDIO_VOLUME_KEY), 10)
      return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 100
    }
    const readAudioSoundDir = () => prefsGet(AUDIO_SOUND_DIR_KEY) || ''
    /** Ask the host to play one slot through the real notification path. */
    const previewSlot = (slot) => {
      if (typeof fetch !== 'function') return Promise.resolve({ played: false, why: 'no fetch' })
      return fetch(AUDIO_PREVIEW_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slot }),
      }).then(
        (res) => res.json().catch(() => ({ played: false, why: 'bad response' })),
        (error) => ({ played: false, why: String(error && error.message ? error.message : error) }),
      )
    }
    /* ---------- 需要你回应：界面观察器 ----------
       WHY THIS EXISTS. The host-side seams that would normally carry this moment
       (`approval/request`, `user-questions/request`, raised by dsh-user-approval
       and dsh-tool-ask-user) do not fire in every deployment. Measured here: with
       the theme plugin mounted, a question was on screen and ANSWERED while the
       host half's counter stayed at 0 — because `ask_user_question` in this
       composition is provided outside the profile's plugin stack, so
       `dsh-tool-ask-user` never runs and the waterfall is never raised.

       The UI is therefore the only place where "a human must act" is always real.
       The host still owns the sound (switch, volume, debounce) — the page only
       reports that a confirmation box appeared. The host-side listeners stay in
       place for compositions where they DO fire; both paths end at the same slot
       and the host's debounce collapses a double report into one sound.

       ANCHORS: only the per-panel DATA ATTRIBUTES, never a class name.

       A class-based first attempt was tried and it mis-fired in the field:
       `[class*='_card']` matches 15 different components across the installed
       client packages (model selector, agent-preset picker, …) and
       `[class*='_frame']` matches 8, so opening any such card rang the attention
       sound while no confirmation box was on screen. What the panels actually
       expose, verified against the installed packages, is one stable attribute
       each:
         approval panel    <div data-approval-key="…">
         plan review panel <div data-plan-review-key="…">
         question dialog   <div data-question-key="…">

       A marker that disappears in a future UI release silences this feature
       without breaking anything — hence the counter in the settings page, which
       is the only way to notice that the anchors stopped matching. */
    const ATTENTION_MARKERS = [
      { kind: 'approval', selector: '[data-approval-key]' },
      { kind: 'plan-review', selector: '[data-plan-review-key]' },
      { kind: 'question', selector: '[data-question-key]' },
    ];
    // Exposed on the module so a test can assert the anchors stay semantic (see
    // exports.__attentionMarkers at the bottom of this file).
    module.exports.__attentionMarkers = ATTENTION_MARKERS;
    /** Which kind of pending interaction is on screen right now, if any. */
    const detectPendingInteraction = () => {
      if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return null
      for (const marker of ATTENTION_MARKERS) {
        try {
          if (document.querySelector(marker.selector) !== null) return marker.kind
        } catch (e) { /* malformed selector: treat as absent */ }
      }
      return null
    }
    /** Tell the host a confirmation box appeared; it decides whether to sound. */
    const reportAttention = (kind) => {
      if (typeof fetch !== 'function') return Promise.resolve({ played: false, why: 'no fetch' })
      return fetch(AUDIO_ATTENTION_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind }),
      }).then(
        (res) => res.json().catch(() => ({ played: false, why: 'bad response' })),
        (error) => ({ played: false, why: String(error && error.message ? error.message : error) }),
      )
    }
    const prefsListeners = []
    const prefsLocal = Object.assign({}, PREFS_FIELD_DEFAULTS) // schema defaults, for boot / no transport
    // The subset of prefsLocal a USER has actually edited this session. It is what
    // prefsGetValue overlays on the fetched section: prefsLocal as a whole carries
    // the shipped defaults, so overlaying all of it would shadow the very values
    // the host just served (watermark off would read back as its default on).
    const prefsLocalEdited = new Set()
    // Fields a panel toggle changed so far but that have not yet been durably
    // committed to the host scope. If the scope was not ready at apply() time and
    // only appears later, these are replayed so a pre-bind edit still persists
    // instead of silently living in page-only memory.
    const prefsDirty = new Set()
    // Fields whose value THIS SESSION changed (see prefsSet), regardless of where
    // that edit currently stands. Used to tell "the host already holds this value"
    // apart from "the user put it back to a value the host happens to hold":
    // only the former means there is nothing left to persist.
    const prefsEdited = new Set()
    let prefsFieldValue = null // last schema-resolved user+base+defaults section from the scope, if any
    /* The bound settings transport: a DSH 0.1.7 `ConfigForm` or a legacy
       `settingsScope`. Both answer getSnapshot()/subscribe()/set(), which is
       all the store below needs; `prefsScopeKind` records which one it is (for
       diagnostics and the write-settlement contract). */
    let prefsScope = null
    let prefsScopeKind = null // 'configForms' | 'settingsScope' | null
    let prefsScopeNs = null // the namespace / profile entry id the scope came from
    let prefsUnsubscribe = null // disposer of the active scope subscription, if any
    let prefsBindTimer = null // retry handle for a settings transport that arrives late
    let prefsRetryTimer = null // bounded retry for held edits whose ready cue has not arrived
    let prefsSettleTimer = null // bounded settle watch for a transport bound before it was ready
    // Max held-edit retry passes. The ready transition is normally the cue; this
    // bounded timer is the safety net for a mirror whose first describe predates
    // a late host registration and sees no document commit to rerun on.
    const PREFS_RETRY_LIMIT = 20 // ~20 * 500ms = up to ~10s after the last held edit
    let prefsRetryCount = 0
    // True while prefsReplayDirty is mid-pass. A normal DSH scope.set is async,
    // but the mirror can fold a ready snapshot in synchronously (and document
    // mocks/transitions too), which would re-enter the replay from the theme's
    // own subscription and write the same held edits twice. The bus flag makes a
    // single replay pass authoritative; re-entrant calls become no-ops.
    let prefsReplayBusy = false
    /* Theme layers install *their* reconcile here once they exist (updated from
       the bottom of apply) so a transport event can live-apply a real change. */
    let reconcileFromPrefs = null
    /* True once an authoritative (status:'ready') section has been read for THIS
       page load, plus the one-shot hook the startup surfaces that depend on such a
       section install below. See prefsMarkSettled. */
    let prefsSettledOnce = false
    let onPrefsSettled = null
    /* Whether the settings page has rendered its body, for the boot report: a
       report from a page whose settings page was never opened is expected to
       show nothing, and must not be mistaken for a failure. */
    let panelMounted = false
    /* --- transport selection ------------------------------------------------
       Two DSH generations expose the same durable-preference seam under
       different names, and the theme has to work on both without throwing on
       whichever is absent:

         0.1.7-rc.1   cfg = ctx.get('configForms')   (the settings domain's
                      shared-form service)
                      cfg.get(<profile entry id>) -> ConfigForm with
                      getSnapshot() / subscribe() / set() / unset() / mutate()
                      and a snapshot of { status, value, base, user, revision,
                      writable, mode }. set() returns Promise<boolean>: false
                      means the Host refused or SKIPPED the write (the classic
                      case being memory mode on a non-loopback page).
                      0.2.1-rc.2 keeps this seam but DELETED `mode`: the
                      snapshot is { status, value, base, user, revision,
                      writable } and every accepted set() is a
                      remote.settings.mutate() against the Host document.
                      Treat a missing `mode` as durable; only an explicit
                      mode:'memory' (0.1.7 on a non-loopback page) refuses.
         <=0.1.5-rc.2 binder = ctx.get('settingsScope') / ctx.settingsScope
                      binder.bind({ namespace, decode }) -> scope with the same
                      snapshot fields, and a fire-and-forget set().

       Same snapshot vocabulary, same write intent, so everything downstream of
       acquisition is shared; only the lookup, the namespace string and the
       settlement of set() differ. `configForms` is tried FIRST because on
       0.1.7 the legacy service does not exist at all.

       A ConfigForm is keyed by the PROFILE ENTRY ID, which the patch layer
       assigns: this package's own bundle patch inserts `theme-arknights`, but a
       hand-written insert may use the package name and the loader's tree path
       prefixes include groups with `include:`. PREFS_ENTRY_CANDIDATES lists the
       spellings this package can be installed under, in likelihood order.
       Acquisition prefers whichever candidate the Host actually SERVES and
       otherwise binds the first one immediately: a form is only a lazy view over
       the shared mirror, so binding early is what lets a slow boot deliver its
       section late instead of losing that page load's settings entirely. A wrong
       guess self-heals — while the bound form reports 'unavailable' and the
       mirror reloads, prefsOnScopeChange moves the binding to whichever
       candidate is served. */
    const PREFS_ENTRY_CANDIDATES = [
      PREFS_ENTRY,                   // this package's cordis.patch.yml row id
      'include:' + PREFS_ENTRY,      // loader tree path when bundle-mounted
      PREFS_NS,                      // a row inserted under the old namespace name
      'include:' + PREFS_NS,
    ]
    /* The 0.1.7 shared-form service, or undefined on a host that has none. Both
       access forms are tried: the injected-property spelling DSH's own client
       plugins use, then the optional-lookup form this module has always used. */
    const getConfigForms = () => {
      try {
        if (ctx.configForms !== undefined && ctx.configForms !== null
          && typeof ctx.configForms.get === 'function') return ctx.configForms
      } catch (e) { /* property may be a getter that throws when not available */ }
      try {
        const forms = ctx.get('configForms')
        if (forms !== undefined && forms !== null && typeof forms.get === 'function') return forms
      } catch (e) { /* optional service lookup */ }
      return undefined
    }
    // Try the idiomatic injected-property access first (how DSH client plugins like
    // dsh-client-locale consume services — exports.inject plus `ctx.xxx`), then
    // the lookup form this module has historically used for optional services.
    const getSettingsScopeBinder = () => {
      try {
        if (ctx.settingsScope !== undefined && ctx.settingsScope !== null
          && typeof ctx.settingsScope.bind === 'function') return ctx.settingsScope
      } catch (e) { /* property may be a getter that throws when not available */ }
      try { return ctx.get('settingsScope') } catch (e) { return undefined }
    }
    /* The namespaces the Host's describe view actually SERVES, for diagnostics.
       This is the one fact that tells "the host half exported no Config" apart
       from "the client bound an entry spelling this install does not use": both
       leave the bound form unserved, and only the served list says which one
       happened. Returns null while the mirror has not answered yet. */
    const prefsServedNamespaces = () => {
      try {
        const forms = getConfigForms()
        if (forms === undefined || typeof forms.describe !== 'function') return null
        const mirrored = forms.describe().getSnapshot()
        const view = mirrored && mirrored.view
        if (!view || !Array.isArray(view.namespaces)) return null
        return view.namespaces.map((row) => row && row.ns)
      } catch (e) { return null }
    }
    /* Snapshot of any transport object, or null when it cannot be read. */
    const prefsSnapshotOf = (scope) => {
      if (!scope || typeof scope.getSnapshot !== 'function') return null
      try { return scope.getSnapshot() } catch (e) { return null }
    }
    /* The first CANDIDATE spelling the Host actually serves (status 'ready'),
       or null. Kept separate from acquisition because it is also the re-check a
       bound-but-unserved form runs when the mirror reloads. */
    const prefsFindReadyForm = () => {
      const forms = getConfigForms()
      if (forms === undefined) return null
      for (const ns of PREFS_ENTRY_CANDIDATES) {
        let form = null
        try { form = forms.get(ns) } catch (e) { form = null }
        if (!form || typeof form.getSnapshot !== 'function') continue
        const snap = prefsSnapshotOf(form)
        if (snap !== null && snap.status === 'ready') return { scope: form, kind: 'configForms', ns }
      }
      return null
    }
    /* Acquire the transport for this page.
       A SERVED candidate wins outright. Otherwise the FIRST candidate is bound
       anyway, even while the mirror is still 'loading' or reports it
       'unavailable': a ConfigForm always exists (it is a lazy view over the
       shared mirror), and binding it immediately is what lets a slow or
       later-served Host still deliver its section through the subscription —
       exactly how the legacy binder behaved. A wrong guess is not fatal:
       prefsOnScopeChange re-selects as soon as another candidate is served. */
    const acquirePrefsScope = () => {
      const ready = prefsFindReadyForm()
      if (ready !== null) return ready
      const forms = getConfigForms()
      if (forms !== undefined) {
        for (const ns of PREFS_ENTRY_CANDIDATES) {
          let form = null
          try { form = forms.get(ns) } catch (e) { form = null }
          if (form && typeof form.getSnapshot === 'function') return { scope: form, kind: 'configForms', ns }
        }
      }
      const binder = getSettingsScopeBinder()
      if (binder !== undefined && binder !== null && typeof binder.bind === 'function') {
        let scope = null
        try { scope = binder.bind({ namespace: PREFS_NS, decode: prefsResolveSection }) } catch (e) { dbg('bind threw', e && e.message); scope = null }
        if (scope !== null && scope !== undefined) return { scope, kind: 'settingsScope', ns: PREFS_NS }
      }
      return null
    }
    /* A schema-accepted section from the transport, else in-memory defaults
       (PREFS_FIELD_DEFAULTS is the fallback BEFORE a first section arrives).
       Fields the user has edited this session are overlaid ON TOP on purpose: a
       toggle writes prefsLocal synchronously and only then does the host echo the
       section back, so reading the fetched section first would show the panel the
       new state while the theme still acted on the old one until the round-trip
       closed. Only EDITED fields are overlaid (see prefsLocalEdited), so a served
       value for any other field is still what the theme reads. */
    let prefsOverlayCache = null
    const prefsGetValue = () => {
      const base = prefsFieldValue || PREFS_FIELD_DEFAULTS
      if (prefsLocalEdited.size === 0) return base
      /* Hot path: the watermark observer and the output-scroll animator read
         prefs many times per frame. Rebuilding this overlay per read allocated a
         fresh object with every field each time; caching it against the base-section
         REFERENCE keeps those reads allocation-free. prefsSet invalidates on
         every edit (the only place prefsLocalEdited grows), and a new section
         from the host arrives as a different `base` reference, so a stale pair
         can never be served. Callers treat the result as read-only — prefsGet
         is the sole runtime consumer and only reads single fields. */
      if (prefsOverlayCache !== null && prefsOverlayCache.base === base) return prefsOverlayCache.out
      const out = Object.assign({}, base)
      for (const field of prefsLocalEdited) out[field] = prefsLocal[field]
      prefsOverlayCache = { base, out }
      return out
    }
    /** read one field as its raw stored string: <stored-or-default>, never null. */
    const prefsGet = (rawKey) => {
      const field = prefsFieldOf(rawKey)
      const sec = prefsGetValue()
      if (sec && Object.prototype.hasOwnProperty.call(sec, field)) return String(sec[field])
      return PREFS_FIELD_DEFAULTS[field]
    }
    /** subscribe to any change of the whole namespace (transport or local). */
    const prefsSubscribe = (listener) => {
      prefsListeners.push(listener)
      return () => {
        const i = prefsListeners.indexOf(listener)
        if (i >= 0) prefsListeners.splice(i, 1)
      }
    }
    const prefsEmit = () => {
      for (const l of prefsListeners.slice()) { try { l() } catch (e) { /* keep going */ } }
      if (reconcileFromPrefs) try { reconcileFromPrefs() } catch (e) { /* keep going */ }
    }
    /* The FIRST authoritative section of a page load is a moment of its own: it is
       the instant the stored preferences become knowable at all. On a real page
       load the Host serves that section over the wire, so every read made while
       apply() runs — including the boot plate's — falls back to the schema
       defaults. A surface whose whole job happens at startup therefore cannot act
       on its apply()-time read; it hangs off this transition instead.

       Fires at most once per page load, and only AFTER the section has been
       resolved (prefsFieldValue assigned) and any legacy migration has run, so a
       hook reading prefsGet() sees final values rather than a half-applied
       snapshot. Deliberately not re-fired by later sections: a section that
       changes later is an ordinary runtime edit, not a page load. */
    const prefsMarkSettled = () => {
      if (prefsSettledOnce) return
      prefsSettledOnce = true
      if (onPrefsSettled) try { onPrefsSettled() } catch (e) { /* keep going */ }
    }
    const dbg = (...a) => { try { if (typeof console !== 'undefined' && console.warn) console.warn('[dsh-theme-arknights:prefs]', ...a) } catch (e) { /* noop */ } }

    /* --- Durable write gate -----------------------------------------------
       A scope snapshot from @deepseek-ai/dsh-client-ui-settings carries the
       flags below; the ones that must ALL hold before a scope.set can durably
       land are:
         status  === 'ready'  the Host's describe view actually SERVES this
                              namespace and a decoded value stands. It stays
                              'loading' before the first accepted section and
                              becomes 'unavailable' when the namespace is NOT in
                              the host's served list (the host half has not run
                              its ctx.settings.register(...) yet, or the mirror
                              last fetched before it appeared). A scope.set into
                              a 'loading'/'unavailable' host scope reaches no
                              durable store.
         writable=== true     the Host document accepts writes.
         mode    === 'host'   OPTIONAL. Loopback page syncing the Host
                              document; 'memory' (a non-loopback page) never
                              persists. @deepseek-ai/dsh-client-ui-settings
                              0.2.1-rc.2 DELETED this field (and the whole
                              `persistence` concept) along with the CSS
                              'memory' mode, so on that generation the
                              snapshot is only { status, value, base, user,
                              revision, writable } and a missing `mode` means
                              "no persistence policy to consult": every
                              write rides ctx.remote.settings.mutate() to the
                              Host document. Only a snapshot that explicitly
                              says mode:'memory' (0.1.7-rc.*, a non-loopback
                              page) may refuse the write; `undefined` must be
                              treated as durable, or a 0.2.1 page would hold
                              every edit forever and log exactly the
                              `mode= undefined` boot report this gate is
                              meant to explain.
       Gating on snap.writable ALONE is the old bug: a host-mode describe view
       answers writable=true even while this namespace is still unserved, so the
       old code fired scope.set into a namespace the host had not registered,
       cleared the dirty mark and logged the misleading
       `commit ... status= unavailable` warn — the preference kept working for
       the page session but vanished on the next reload. We issue a real wire
       write only once the namespace is genuinely served, and keep the edit
       dirty so a later ready transition (re)plays it. */
    const prefsSnap = () => {
      const scope = prefsScope
      if (!scope) return null
      try { return scope.getSnapshot() } catch (e) { return null }
    }
    /* `mode` is a 0.1.7-only snapshot field (see the gate note above): it is
       absent on 0.2.1-rc.2+, where absence means "always durable", and only an
       explicit mode:'memory' still vetoes a write. */
    const prefsDurablyServed = (snap) => !!snap
      && (snap.mode === undefined || snap.mode === 'host')
      && snap.status === 'ready'
      && !!snap.writable
    /* One field write through the bound transport, with one settlement contract
       for both generations. The legacy scope.set() is fire-and-forget; a
       ConfigForm's set() returns Promise<boolean>, where false means the Host
       REFUSED or SKIPPED the write (most commonly memory mode on a non-loopback
       page) and a rejection means the wire call failed. Either way the edit is
       put back into prefsDirty so a later ready/replay pass retries it instead
       of the setting looking saved while nothing reached the document.
       Deliberately NOT marked dirty up front for a thenable write: DSH's own
       client folds an ACCEPTED write into the shared mirror before the returned
       promise resolves, so a synchronous dirty mark would make every toggle
       emit a redundant second write. A late repair beats a duplicate write.
       @returns true when the write was issued (not when it was accepted). */
    const prefsWriteField = (field, value) => {
      const scope = prefsScope
      if (!scope || typeof scope.set !== 'function') return false
      let result = null
      try { result = scope.set(field, String(value)) } catch (e) {
        dbg('set threw', field, e && e.message)
        prefsDirty.add(field)
        return false
      }
      if (result && typeof result.then === 'function') {
        result.then((ok) => {
          if (ok === false) {
            dbg('set REFUSED by the host', field, value)
            prefsDirty.add(field)
            prefsScheduleRetry()
          } else {
            prefsDirty.delete(field)
          }
        }, (e) => {
          dbg('set REJECTED', field, value, String(e && e.message || e))
          prefsDirty.add(field)
        })
      } else {
        prefsDirty.delete(field)
      }
      return true
    }
    /* Push edits recorded while the scope was not durably served as soon as it
       is (bind catch-up + an unavailable/loading -> ready subscription both call
       this). A dirty field is cleared only once it is WRITTEN to a served host
       scope, or once the host's own FETCHED section already holds that exact
       value. Guarded against races the same way as prefsCommit: a rejected async
       write keeps the field for a later try. */
    const prefsReplayDirty = () => {
      if (prefsReplayBusy) return
      if (prefsDirty.size === 0) return
      prefsReplayBusy = true
      try {
        const snap = prefsSnap()
        const durable = prefsDurablyServed(snap)
        for (const field of Array.from(prefsDirty)) {
          const local = prefsLocal[field]
          const hostValue = snap && snap.value
            ? (Object.prototype.hasOwnProperty.call(snap.value, field) ? String(snap.value[field]) : undefined)
            : undefined
          /* An edit the host ALREADY holds needs no write — provided the host
             really holds it, rather than the user having just typed that value
             back in. Those differ in exactly one case, and it is the one that
             matters: the user reverts a field to a value the host's stale view
             still reports (the pre-migration default is the common one), and
             skipping the write would silently drop the revert. So only a field
             this session never edited is cleared on equality; an edited field is
             cleared by its write.
             Equality with the shipped DEFAULT is likewise not a reason to clear:
             the host may still hold a non-default value, and "put it back to the
             default" is then a real edit that has to reach the document. */
          if (local === hostValue && !prefsEdited.has(field)) {
            prefsDirty.delete(field)
            continue
          }
          if (!durable) continue
          // Optimistically clear; a refused/rejected write puts the field back
          // into prefsDirty from prefsWriteField's settlement handler.
          if (prefsWriteField(field, local)) {
            dbg('replayed held', field, '=', local)
            prefsDirty.delete(field)
          }
        }
      } finally {
        prefsReplayBusy = false
      }
    }
    /* Bounded safety net for a held edit whose "ready" cue never arrives on its
       own. A normal scope subscription fires on the ready transition and replays
       immediately; this is only for a mirror whose first describe predated a late
       host registration and that sees no intermediate document commit / reconnect
       to rerun on. Each tick simply calls prefsReplayDirty() again; once nothing
       is held (all written) the loop stops itself. Stops after PREFS_RETRY_LIMIT
       ticks so an environment where the namespace is genuinely never served does
       not spin forever. */
    const prefsStopRetry = () => {
      if (prefsRetryTimer !== null && typeof clearTimeout === 'function') clearTimeout(prefsRetryTimer)
      prefsRetryTimer = null
      prefsRetryCount = 0
    }
    const prefsScheduleRetry = () => {
      // Nothing held any more: no reason to keep ticking.
      if (prefsDirty.size === 0) { prefsStopRetry(); return }
      // A durably-served scope needs no timer — its subscription replays fast.
      if (prefsDurablyServed(prefsSnap())) { prefsStopRetry(); return }
      if (prefsRetryTimer !== null) return // already ticking
      if (typeof setTimeout !== 'function') return // no timer environment
      prefsRetryCount = 0
      const tick = () => {
        prefsRetryTimer = null
        prefsRetryCount += 1
        if (prefsRetryCount > PREFS_RETRY_LIMIT) { prefsStopRetry(); return }
        if (prefsDirty.size === 0) { prefsStopRetry(); return }
        if (prefsDurablyServed(prefsSnap())) { prefsStopRetry(); return }
        prefsReplayDirty()
        if (prefsDirty.size > 0) prefsRetryTimer = setTimeout(tick, 500)
        else prefsStopRetry()
      }
      prefsRetryTimer = setTimeout(tick, 500)
    }
    const prefsCommit = (field, encoded) => {
      // Best-effort durable write. A real wire write happens only while the
      // scope is durably served (see the gate note above); before that we stay
      // session-local, record the edit in prefsDirty and let prefsReplayDirty
      // push it once the namespace is served. We deliberately do NOT
      // prefsEmit() here: the caller's toggle already reconciles the layer it
      // changes, and the authoritative echo arrives through the scope
      // subscription below, so an immediate synchronous emit would do the same
      // work twice.
      const scope = prefsScope
      if (scope) {
        const snap = prefsSnapshotOf(scope)
        if (prefsDurablyServed(snap)) {
          dbg('commit', field, '=', encoded, 'via', prefsScopeKind, prefsScopeNs, 'status=', snap.status, 'mode=', snap.mode)
          prefsWriteField(field, encoded)
          return true
        }
        dbg('held (namespace not durably served yet)', field, '=', encoded, 'snap=', snap === null ? null : { status: snap.status, writable: snap.writable, mode: snap.mode }, 'hostServes=', prefsServedNamespaces())
      } else {
        dbg('commit with NO settings transport bound (page-local only)', field, encoded, 'hostServes=', prefsServedNamespaces())
      }
      prefsDirty.add(field)
      prefsScheduleRetry()
      return false
    }
    /** write one field with the exact stored-string value the UI derives. */
    const prefsSet = (rawKey, encoded) => {
      const field = prefsFieldOf(rawKey)
      prefsLocal[field] = String(encoded)
      prefsLocalEdited.add(field)
      prefsEdited.add(field)
      prefsOverlayCache = null
      prefsCommit(field, prefsLocal[field])
    }
    /* Normalize a section the transport handed us to a full set of SCHEMA
       fields: the declared fields the mirror resolved, plus schema defaults for
       any it has not. Field names come from the one table (prefsFieldOf), so a
       section is keyed exactly the way the theme reads it. */
    const prefsResolveSection = (section) => {
      const out = Object.assign({}, PREFS_FIELD_DEFAULTS)
      if (section === null || typeof section !== 'object') return out
      for (const field of Object.keys(PREFS_FIELD_DEFAULTS)) {
        if (Object.prototype.hasOwnProperty.call(section, field)) out[field] = String(section[field])
      }
      return out
    }
    /* Sections written by the BUILD THAT SHIPPED THE FIELD-NAME BUG still carry
       the pre-migration spelling of a compound field ('thunderAnim' written as
       'thunder-anim'), because that write landed on an undeclared key the schema
       passes through instead of storing it into the declared field. Without this
       pass the user's stored choice is ignored and the field default silently
       wins — for them the switch would look like it reset again after the fix.
       Returns the [field, value] pairs whose recorded legacy value is the one to
       honour, i.e. the edits that need re-committing onto the declared field.

       WHEN IS THE DECLARED FIELD THE USER'S OWN VALUE? This is the whole
       question, because a fetched section ALWAYS carries every declared field:
       the schema merges its defaults into the stored section, so
       `hasOwnProperty` cannot tell a user-set value from an implied default.
       And in practice only ONE signal can: a value that differs from the shipped
       default. A declared field sitting at its default is indistinguishable from
       an untouched one — the section is the merged view, so nothing survives in
       it to say whether the document stored that default or the schema inserted
       it. Therefore:

         declared absent or === default  -> nothing recorded a choice for this
                                            field, so the stray legacy key is the
                                            only trace of one: honour it.
         declared set to anything else    -> a correctly-writing build stored it,
                                            so it wins and the stray key is
                                            ignored. (Never let the pre-migration
                                            spelling overwrite a real edit.)

       That makes the migration idempotent in the good direction: after the value
       is re-committed, the declared field is non-default and the stray key can
       never win again. */
    const prefsLegacyFields = (section) => {
      const out = []
      if (section === null || typeof section !== 'object') return out
      for (const field of Object.keys(PREFS_FIELD_TO_LEGACY_KEY)) {
        const legacy = PREFS_FIELD_TO_LEGACY_KEY[field]
        if (!Object.prototype.hasOwnProperty.call(section, legacy)) continue
        const value = section[legacy]
        if (value === undefined || value === null || String(value) === '') continue
        const declared = Object.prototype.hasOwnProperty.call(section, field) ? String(section[field]) : undefined
        if (declared !== undefined && declared !== PREFS_FIELD_DEFAULTS[field]) continue
        out.push([field, String(value)])
      }
      return out
    }
    /* Re-commit a legacy-spelled value onto the declared field, once. Writes go
       through prefsSet, i.e. through the same durable gate as a user toggle: on a
       served scope it lands on the schema field immediately, on one that is not
       served yet it is held and replayed (and mirrored locally, so the theme
       behaves correctly meanwhile). The stale key itself is left in the document
       — the theme no longer declares or reads it, and rewriting a section it does
       not own would be a bigger hammer than the bug deserves. */
    const prefsMigrated = new Set()
    // The section object this pass has already run against. A section is a fresh
    // object on every transport update, so identity is what says "this document
    // has not been examined yet" — and it keeps the pass from re-running against
    // its own writes within the same snapshot.
    let prefsMigratedFor = null
    const prefsMigrateLegacy = (section) => {
      if (section === null || typeof section !== 'object') return
      if (section === prefsMigratedFor) return
      prefsMigratedFor = section
      for (const [field, value] of prefsLegacyFields(section)) {
        if (prefsMigrated.has(field)) continue
        prefsMigrated.add(field)
        dbg('migrating legacy-spelled field', PREFS_FIELD_TO_LEGACY_KEY[field], '->', field, '=', value)
        prefsSet(field, value)
      }
    }
    /* Everything a bound transport needs after acquisition: adopt the initial
       snapshot, subscribe, then run the catch-up / legacy-repair / settled
       passes the single-transport version already ran. */
    /* Drop the active transport subscription, if any. Called by the re-selection
       below (switching to a different entry spelling) and by run teardown. */
    const prefsReleaseSubscription = () => {
      if (typeof prefsUnsubscribe === 'function') {
        try { prefsUnsubscribe() } catch (e) { /* the transport may already be gone */ }
      }
      prefsUnsubscribe = null
    }
    const prefsOnScopeChange = (scope) => {
      const snap = prefsSnapshotOf(scope)
      if (snap === null) return
      /* Re-selection. A form bound before the mirror answered reports 'loading'
         (bound while the Host was still sending its describe view) or
         'unavailable' (this install does not use that entry spelling); the
         moment the Host serves one of the OTHER candidates, move the binding
         there instead of staying deaf to the real entry. Re-selection uses a
         ready-only scan, so it can never bounce between two unserved
         candidates.

         'loading' is included in the trigger — not only 'unavailable' — because
         a real boot binds during exactly that window: client.js reaches
         acquirePrefsScope() while the mirror is still fetching, so the FIRST
         candidate is bound with status:'loading'. If that guess is the wrong
         spelling, the fix-up has to happen on the unserved side of the
         transition; waiting for 'unavailable' alone misses a wrong form that
         goes straight from 'loading' to a served other candidate. */
      if ((snap.status === 'unavailable' || snap.status === 'loading') && prefsScopeKind === 'configForms') {
        const ready = prefsFindReadyForm()
        if (ready !== null && ready.ns !== prefsScopeNs) {
          dbg('re-selecting settings entry', prefsScopeNs, '->', ready.ns)
          prefsReleaseSubscription()
          prefsScope = null
          prefsScopeKind = null
          prefsScopeNs = null
          prefsBindScope(ready)
          // A re-selection happens long after apply() (the mirror answered
          // late), so the theme is already mounted and must reconcile onto the
          // section that just arrived. Harmless at apply time, where no layer
          // has installed its reconciler yet.
          prefsEmit()
          return
        }
      }
      /* ONLY a status that cannot carry a section is ignored here. 'loading' is
         deliberately NOT ignored: it is the state a real page load STARTS in
         (the Host serves the section over the wire, so the bound form reports
         status:'loading', writable:false, valueKeys:0 while apply() runs), and
         the transition that matters — loading -> ready — is a single
         subscription event. Returning early on 'loading' swallowed exactly that
         event, so a section that settled after the bind never reached
         prefsFieldValue, the held edits were never replayed onto it, and
         prefsMarkSettled() never fired. Everything then fell back to the schema
         defaults until the next reload, even though the Host had served the
         user's values. The bounded settle watch usually rescued it, which is why
         the failure was intermittent rather than total. */
      if (snap.status !== 'ready' && snap.status !== 'unavailable' && snap.status !== 'loading') return
      if (snap.status === 'ready' && snap.value !== undefined) prefsFieldValue = prefsResolveSection(snap.value)
      // An unavailable/loading -> ready transition is precisely when an edit we
      // HELD (see prefsCommit) can finally be written: replay any dirty fields
      // the moment the namespace is durably served. prefsReplayDirty is a no-op
      // when nothing is held or the scope is not yet served.
      prefsReplayDirty()
      // The FIRST served section is also the first chance to see a document the
      // buggy build wrote (before that there is nothing to read), so the legacy
      // repair runs here too — and again on any later section that has not been
      // examined yet. Whatever it queues is replayed below.
      prefsMigrateLegacy(snap.value)
      prefsReplayDirty()
      prefsEmit()
      /* Deliberately last: the startup hook must read the section only after it
         is resolved and migrated (and after prefsEmit has let the layer
         reconciler mount a theme the settled section switched on), and it must
         fire once rather than on every snapshot. */
      if (snap.status === 'ready' && snap.value !== undefined) prefsMarkSettled()
    }
    const prefsBindScope = (acquired) => {
      const scope = acquired.scope
      prefsScope = scope
      prefsScopeKind = acquired.kind
      prefsScopeNs = acquired.ns
      const initial = prefsSnapshotOf(scope)
      if (initial) dbg('bound', acquired.kind, 'ns=', acquired.ns, '; initial status=', initial.status, 'writable=', initial.writable, 'mode=', initial.mode, 'valueKeys=', initial.value ? Object.keys(initial.value).length : 0)
      if (initial && initial.status === 'ready' && initial.value !== undefined) {
        prefsFieldValue = prefsResolveSection(initial.value)
      }
      /* The subscription disposer is RETAINED here (the single-transport version
         dropped it): a ConfigForm is a shared, provider-owned controller, so the
         run's teardown must remove this listener instead of leaking it into the
         next run — see the prefs ctx.effect below. */
      if (typeof scope.subscribe === 'function') {
        try {
          const unsubscribe = scope.subscribe(() => prefsOnScopeChange(scope))
          if (typeof unsubscribe === 'function') prefsUnsubscribe = unsubscribe
        } catch (e) { dbg('subscribe threw', e && e.message) }
      }
      // Catch up: an edit made before the scope settled must still persist. Replay
      // only genuinely user-changed fields (those prefsSet recorded as dirty) that
      // now differ from a freshly-fetched, durably-served host section.
      prefsReplayDirty()
      // Then repair a section the buggy build wrote with the pre-migration field
      // spelling, and re-run the catch-up for whatever that migration queued.
      prefsMigrateLegacy(initial && initial.value)
      prefsReplayDirty()
      /* A section that was ALREADY ready when the scope bound is authoritative on
         the first read too. In practice no hook is installed yet at this point in
         apply() (the boot-loader block below runs later), so this normally just
         records the transition — the plate's own apply()-time read is already
         correct when the section beat apply(), and that path is unchanged. */
      if (initial && initial.status === 'ready' && initial.value !== undefined) prefsMarkSettled()
      // Safety net for a transport bound before the Host served it (no-op when
      // the section was ready already).
      prefsStartSettleWatch(0)
    }
    /* Bounded settle watch for a transport that was bound before the Host served
       it. The subscription is normally the cue — the shared describe mirror
       re-derives every form on a reload and the store notifies on a snapshot
       change — but a mirror that answers WITHOUT replacing the bound form's
       snapshot (or that only ever serves a different entry spelling) would leave
       this page load on schema defaults forever. This is the bounded safety net
       the legacy generation had as its 250 ms binder poll: it re-checks a limited
       number of times, moves to a newly served candidate spelling when one
       appears, and stops the moment the bound snapshot is ready. */
    const PREFS_SETTLE_LIMIT = 20 // ~20 * 500ms = up to ~10s after the bind
    const prefsStartSettleWatch = (attempt) => {
      if (prefsScope === null) return
      /* A re-bind or a re-selection can start a new chain while an earlier one
         is still pending; drop the old timer first so exactly one chain runs.
         The passes are idempotent, but duplicate chains duplicate logs and
         duplicate snapshot work. Clearing an already-fired handle is harmless. */
      if (prefsSettleTimer !== null && typeof clearTimeout === 'function') clearTimeout(prefsSettleTimer)
      prefsSettleTimer = null
      const snap = prefsSnapshotOf(prefsScope)
      if (snap !== null && snap.status === 'ready') {
        /* The form is served but its store never emitted (or the value arrived
           between acquisition and subscription). Run the same passes the
           subscription would have run — adopt, replay, migrate, settle — unless
           the bind already did them, then stop watching. */
        if (prefsFieldValue === null || prefsDirty.size > 0) prefsOnScopeChange(prefsScope)
        return
      }
      if (attempt >= PREFS_SETTLE_LIMIT) {
        /* Give up loudly, once. This is the page load that will lose the user's
           switches on the next reload, and the line below says which side is at
           fault: boundNs/status describe the client's binding, hostServes lists
           what the host actually serves (our entry id missing from it means the
           host half exported no Config — see index.js). */
        const finalSnap = prefsSnapshotOf(prefsScope)
        dbg('settle watch gave up after', attempt, 'attempts; preferences stay page-local. boundNs=', prefsScopeNs, 'status=', finalSnap === null ? null : finalSnap.status, 'mode=', finalSnap === null ? null : finalSnap.mode, 'hostServes=', prefsServedNamespaces())
        return
      }
      const ready = prefsFindReadyForm()
      if (ready !== null && ready.ns !== prefsScopeNs) {
        dbg('settle watch re-selecting settings entry', prefsScopeNs, '->', ready.ns)
        prefsReleaseSubscription()
        prefsScope = null
        prefsScopeKind = null
        prefsScopeNs = null
        prefsBindScope(ready)
        prefsEmit()
        return
      }
      if (typeof setTimeout !== 'function') return
      prefsSettleTimer = setTimeout(() => prefsStartSettleWatch(attempt + 1), 500)
    }
    /* One-shot boot report, logged ONLY when the store did not end up in the
       healthy state (a served, settled, writable host section with nothing held).
       "The switches reset on reload" has several causes that look identical from
       the outside — the entry spelling is wrong, the mirror never answered, the
       page is memory-backed, or an edit never reached the document — and each one
       is a property of THIS machine's install. When everything is fine this says
       nothing at all; when it is not, one line names the cause instead of leaving
       it to guesswork. */
    const prefsReportBoot = () => {
      const snap = prefsSnapshotOf(prefsScope)
      // Health is the same predicate the write gate uses — `mode` is absent on
      // 0.2.1-rc.2+, so requiring mode:'host' here would print a boot report on
      // a perfectly working page (that is exactly the `mode= undefined` line
      // this report itself used to emit).
      const healthy = prefsDurablyServed(snap) && prefsDirty.size === 0
      if (healthy) return
      dbg('boot report (preferences did NOT reach a durable section):',
        'boundNs=', prefsScopeNs, 'kind=', prefsScopeKind,
        'status=', snap === null ? null : snap.status,
        'mode=', snap === null ? null : snap.mode,
        'writable=', snap === null ? null : snap.writable,
        'valueKeys=', snap && snap.value ? Object.keys(snap.value).length : 0,
        'settled=', prefsSettledOnce,
        'dirty=', Array.from(prefsDirty),
        'panelMounted=', panelMounted,
        'hostServes=', prefsServedNamespaces(),
        'candidates=', PREFS_ENTRY_CANDIDATES)
    }
    /* DIAG-ROUND5 (a host-vs-store value comparison printed on every load) was
       removed here: its cause was confirmed and fixed by the durable
       configForms transport, and dbg() is an unconditional console.warn, so the
       probe had become pure console noise on healthy pages. */
    let prefsBootReportTimer = null
    if (typeof setTimeout === 'function') {
      // After the mirror has had a fair chance to answer (the settle watch's own
      // budget), state the outcome once whether or not it worked. Tracked so the
      // dispose effect below can revoke it: after a teardown prefsScope is null,
      // which reads as "unhealthy" and would print a misleading boot report for
      // a page that is simply gone.
      prefsBootReportTimer = setTimeout(prefsReportBoot, PREFS_SETTLE_LIMIT * 500 + 500)
    }
    /* Repeatedly try to obtain a settings transport until one is servable. DSH
       web mounts plugin rows concurrently, so the settings service (and its
       describe mirror) can legitimately settle AFTER this theme's apply() runs;
       without this retry a single synchronous attempt that raced would leave
       prefsScope null forever and every subsequent toggle would silently stay
       page-local — the exact "works now, gone on refresh" symptom. */
    const rebindPrefs = (attempt) => {
      if (prefsScope !== null) return
      if (attempt > 40) { dbg('gave up binding a settings transport after retries; staying in-memory', 'hostServes=', prefsServedNamespaces()); return }
      let acquired = null
      try { acquired = acquirePrefsScope() } catch (e) { dbg('acquisition threw', e && e.message); acquired = null }
      if (acquired === null) {
        if (typeof setTimeout === 'function') {
          if (attempt % 8 === 0) dbg('waiting for a settings transport (attempt', attempt, ')')
          prefsBindTimer = setTimeout(() => rebindPrefs(attempt + 1), 250)
        }
        return
      }
      try {
        prefsBindScope(acquired)
      } catch (e) {
        // A throw in the middle of a bind leaves nothing usable behind: release
        // the slot and keep retrying instead of pretending a broken transport is
        // bound.
        prefsScope = null
        prefsScopeKind = null
        prefsScopeNs = null
        dbg('bind failed', e && e.message)
        if (typeof setTimeout === 'function') prefsBindTimer = setTimeout(() => rebindPrefs(attempt + 1), 250)
      }
    }
    // Kick off the (re)trying transport acquisition.
    rebindPrefs(0)
    // Dispose on run teardown (mirrors ctx.effect owned resources). One effect
    // owns the whole store — the earlier pair was a strict duplicate — and it
    // also releases the transport subscription: a ConfigForm is shared and
    // provider-owned, so leaving our listener behind would leak it into the
    // next run of this plugin in the same page.
    ctx.effect(() => () => {
      prefsListeners.length = 0
      prefsReleaseSubscription()
      prefsScope = null
      prefsScopeKind = null
      prefsScopeNs = null
      prefsFieldValue = null
      onPrefsSettled = null
      if (prefsBindTimer !== null && typeof clearTimeout === 'function') clearTimeout(prefsBindTimer)
      prefsBindTimer = null
      if (prefsRetryTimer !== null && typeof clearTimeout === 'function') clearTimeout(prefsRetryTimer)
      prefsRetryTimer = null
      if (prefsSettleTimer !== null && typeof clearTimeout === 'function') clearTimeout(prefsSettleTimer)
      prefsSettleTimer = null
      if (prefsBootReportTimer !== null && typeof clearTimeout === 'function') clearTimeout(prefsBootReportTimer)
      prefsBootReportTimer = null
    })

    const RADIUS_KEY = 'dsh-theme-arknights-radius'
    const ENABLED_KEY = 'dsh-theme-arknights-enabled'
    const isEnabled = () => prefsGet(ENABLED_KEY) !== '0'
    const GLASS_KEY = 'dsh-theme-arknights-glass'
    const GLASS_OPTIONS = ['off', 'subtle', 'standard', 'strong']
    const readGlass = () => {
      const value = prefsGet(GLASS_KEY)
      return GLASS_OPTIONS.includes(value) ? value : 'off'
    }
    const syncGlass = () => {
      if (typeof document === 'undefined' || document.body === null) return
      const value = readGlass()
      if (isEnabled() && value !== 'off') document.body.setAttribute?.('data-ak-glass', value)
      else document.body.removeAttribute?.('data-ak-glass')
    }
    const syncRadiusMode = () => {
      // The bundle can run before <body> exists (see runLoader's DOMContentLoaded
      // deferral for the same window); a classList touch on null would throw and
      // kill the whole install. syncFactionClass guards the same way.
      if (typeof document === 'undefined' || document.body === null) return
      const mode = prefsGet(RADIUS_KEY) || 'square'
      if (mode === 'round') document.body.classList.add('theme-arknights-round')
      else document.body.classList.remove('theme-arknights-round')
    }

    /* ---------- 三阵营 + 界面版本 ------------------------------------------
       阵营与界面版本各自只是 <body> 上的一组 class；样式表按这些 class 定义
       全部变量，所以切换是纯 class 翻转：不重新注册令牌层、不重算样式、无 JS
       重绘。这与配色切换是同一条机制，只是从两套扩到三套，并多了一个维度。

       - 阵营（faction）  rhodes（默认，不带 class）/ laterano / rhine
       - 界面版本（layout）universal（通用适配）/ advanced（进阶版，重排 UI）

       'rhodes' 是默认，所以未设置与任何无法识别的值都回落到它——一份坏掉的
       持久化文档不会让界面停在「无阵营」的半吊子状态。

       因此三套阵营（以及未来任何新增配色）都自动跟随，不必在这里再列举
       一遍颜色。 */
    const FACTION_KEY = 'dsh-theme-arknights-faction'
    const FACTION_IDS = ['rhodes', 'laterano', 'rhine']
    /* 默认阵营不带 class —— 它就是样式表里不带阵营 class 的那一组。 */
    const FACTION_CLASS = {
      rhodes: '',
      laterano: 'theme-arknights-laterano',
      rhine: 'theme-arknights-rhine',
    }
    /** 主题正在接管页面的标记，样式表的顶层规则都挂在它下面。 */
    const THEMED_CLASS = 'theme-arknights-themed'

    const readFaction = () => {
      const value = prefsGet(FACTION_KEY)
      return FACTION_IDS.indexOf(value) === -1 ? 'rhodes' : value
    }

    /* 读 DOM，不读存储：画布/观察器必须与屏幕上真实的那个阵营一致。 */
    const isFaction = (id) => {
      if (typeof document === 'undefined' || document.body === null) return false
      const cls = FACTION_CLASS[id]
      if (cls === undefined || cls === '') return false
      return document.body.classList.contains(cls)
    }

    const syncFactionClass = () => {
      if (typeof document === 'undefined' || document.body === null) return
      const active = isEnabled() ? readFaction() : null
      for (const id of FACTION_IDS) {
        const cls = FACTION_CLASS[id]
        if (cls === '') continue
        if (active === id) document.body.classList.add(cls)
        else document.body.classList.remove(cls)
      }
      if (active === null) document.body.classList.remove(THEMED_CLASS)
      else document.body.classList.add(THEMED_CLASS)
    }

    /* ---- 界面版本 --------------------------------------------------------
       三个档位是**叠加的层**，不是互斥的分支：
         universal  只换配色与字体细节，应用骨架不动
         advanced   + 明日方舟终端版式（HUD 侧栏、切角、扫描装饰、四角括号）
         lab        + 莱茵终端材质（陶瓷纸面、条纹行、transport 输入条）

       lab 重排的东西全都挂在 advanced 注入的钩子上（data-ak-tui/*、
       .ak-terminal-*），所以它必须连着 advanced 的 class 一起挂，而不是取代
       advanced——只挂 lab 会得到一个「材质换了、结构没了」的半吊子界面。
       默认 advanced —— 这一版就是「本主题不只是换颜色」的地方；想要保守外观
       的用户随时切回 universal。 */
    const LAYOUT_KEY = 'dsh-theme-arknights-layout'
    const LAYOUT_IDS = ['universal', 'advanced', 'lab']
    const LAYOUT_ADVANCED_CLASS = 'theme-arknights-advanced'
    const LAYOUT_LAB_CLASS = 'theme-arknights-lab'
    const readLayout = () => {
      const value = prefsGet(LAYOUT_KEY)
      return LAYOUT_IDS.indexOf(value) === -1 ? 'advanced' : value
    }

    /** 终端层要不要跑：advanced 与 lab 都需要那套 DOM 钩子。 */
    const isTerminalLayout = () => {
      const mode = readLayout()
      return mode === 'advanced' || mode === 'lab'
    }

    const syncLayoutClass = () => {
      if (typeof document === 'undefined' || document.body === null) return
      const active = isEnabled() ? readLayout() : 'universal'
      if (active !== 'universal') document.body.classList.add(LAYOUT_ADVANCED_CLASS)
      else document.body.classList.remove(LAYOUT_ADVANCED_CLASS)
      if (active === 'lab') document.body.classList.add(LAYOUT_LAB_CLASS)
      else document.body.classList.remove(LAYOUT_LAB_CLASS)
    }

    /* ---- 强调色的实时值 --------------------------------------------------
       canvas 描边与少数需要 JS 参与的表面用它。读的是计算值，所以三套阵营、
       明暗两种模式、以及用户在设置里改任何一项之后它都自动正确。 */
    const readAccentHex = () => {
      try {
        if (typeof document === 'undefined' || document.body === null) return '#888888'
        const raw = getComputedStyle(document.body).getPropertyValue('--edge-accent').trim()
        if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase()
        if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
          return ('#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3]).toLowerCase()
        }
      } catch (e) { /* 计算样式读不到就退回中性灰 */ }
      return '#888888'
    }

    /* ---------- background ARKNIGHTS watermark (settings-toggleable) ----------
       Two independent switches:
         WATERMARK_KEY  — the watermark itself (default ON), shown on the hero page.
         WATERMARK_PERSIST_KEY — "keep showing it off the hero page" (default OFF),
           which also paints it on an active conversation / settings / any other page.
       On the hero page the mark is centred on the headline. Off the hero page there
       is no headline to follow, so it is centred in the conversation column instead
       and mounted INSIDE that column rather than on <body>: a fixed body child
       paints above the message text (it has no z-index competitor to lose to),
       which would wash out what the user is reading. See mountPointFor().

       Both placements must stay strictly BEHIND the app's own chrome. That is a
       z-index question in the hero case and it is genuinely subtle -- see the long
       note on s.zIndex in styleWatermark(); it is locked down by
       test/watermark-stacking.test.js, which compares real screenshots because a
       pointer-events:none layer cannot be hit-tested. */
    const WATERMARK_KEY = 'dsh-theme-arknights-watermark'
    const WATERMARK_PERSIST_KEY = 'dsh-theme-arknights-watermark-persist'
    const isWatermarkOn = () => prefsGet(WATERMARK_KEY) !== '0'
    // Default OFF: the hero-only behaviour stays the shipped default.
    const isWatermarkPersistOn = () => prefsGet(WATERMARK_PERSIST_KEY) === '1'
    /* Hash-free selectors only. DSH 0.1.2-rc.1 rebuilt its CSS modules and every
       hex hash changed (0/33 of the old pinned hashes survive), so anything of the
       form [class*='pXSMma_root'] dies silently on upgrade. The stable hooks are
       the semantic SUFFIX of the module class plus structural attributes:
         data-phase is rendered ONLY on ConversationRoot (settling|hero|active) and
         a status dot, and only ConversationRoot's class ends in '_root', so
         [class$='_root'][data-phase=…] names the conversation column exactly. */
    const isHeroVisible = () => {
      if (typeof document === 'undefined') return false
      const hero = document.querySelector('[class$="_root"][data-phase="hero"]')
      if (!hero) return false
      const r = hero.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    /** The visible conversation column — the persist-mode anchor and mount parent. */
    const findConversationRoot = () => {
      if (typeof document === 'undefined') return null
      const all = document.querySelectorAll('[class$="_root"][data-phase]')
      for (const el of all) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) return el
      }
      return null
    }
    /** The app frame — the persist-mode fallback anchor.
     *  Located via its CENTRE COLUMN child rather than by matching '_frame': that
     *  suffix is used by three components (layout frame plus two question cards),
     *  so a [class*='_frame'] match is ambiguous and could mount the mark inside a
     *  card. '_centerCol' is unique to the layout frame, and matching the module
     *  SUFFIX instead of a pinned hash survives an app rebuild that rehashes. */
    const findAppFrame = () => {
      if (typeof document === 'undefined') return null
      const col = document.querySelector('[class$="_centerCol"], [class*="_centerCol "]')
      const frame = col !== null ? col.parentElement : null
      if (frame === null) return null
      const r = frame.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return null
      return frame
    }
    const findVisibleHeadline = () => {
      if (typeof document === 'undefined') return null
      /* DSH 0.2 renamed the hero headline export from '*_headlineText' to
         '*_headline' (HeroShell.module.css); in the 0.2 app.asar 'headlineText'
         occurs 0 times across all @deepseek-ai packages. Match both spellings
         so 0.1.2-rc.1-era builds keep working.
         The build prefix is NOT stable across upgrades — it was Hqq-bq_ on
         0.2.0-rc.2 and is pXSMma_ on 0.2.1-rc.5 — which is exactly why this
         matches on the localName suffix. Verified against 0.2.1-rc.5: hits
         only pXSMma_headline ("探索未至之境"), never pXSMma_root/_stack/
         _titleGroup/_previewBadge, Dc7zOa_* or RlGAzG_*. */
      const all = document.querySelectorAll('[class$="_headline"], [class$="_headlineText"]')
      for (const h of all) {
        const r = h.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) return h
      }
      return null
    }
    let watermarkEl = null
    let watermarkRaf = null
    let watermarkHost = null
    /* Where the mark belongs for the current page, and how it must stack there:
         hero    -> <body>, above the (empty) hero backdrop, following the headline.
         persist -> inside the conversation column, BEHIND the message text.
       Returning the parent alongside the mode keeps the two decisions in one place,
       so remount happens exactly when either the parent or the stacking changes. */
    const mountPointFor = () => {
      if (isHeroVisible()) return { mode: 'hero', parent: document.body }
      const conv = findConversationRoot()
      if (conv !== null) return { mode: 'persist', parent: conv }
      // No conversation column on screen (e.g. a full-page settings view). A body
      // child at z-index:-1 paints BELOW the body/frame's own opaque backgrounds
      // there and never shows, so prefer the app FRAME: while the mark is mounted
      // in it the stylesheet gives the frame isolation:isolate (the same pair of
      // properties the conversation column gets above), so -1 stays above the
      // frame background and strictly below the page content. body is only the
      // last resort for a page that has no frame at all.
      const frame = findAppFrame()
      return { mode: 'persist', parent: frame !== null ? frame : document.body }
    }
    /* Park the hero mark where it cannot be seen. Used when the headline anchor
       is missing or measured zero (see positionWatermark) — issue #29's guard
       against the "wordmark plastered on the bottom edge" failure shape. */
    const hideWatermarkOffScreen = () => {
      const s = watermarkEl.style
      if (s.top !== '-9999px') s.top = '-9999px'
      if (s.transform !== '') s.transform = ''
    }
    const positionWatermark = () => {
      if (!watermarkEl) return
      if (watermarkEl.getAttribute('data-ak-watermark') === 'persist') {
        // Centred in its own positioned parent — no per-frame measurement needed.
        return
      }
      const headline = findVisibleHeadline()
      /* No headline (host renamed the class again, transient mount) or a zero
         box: park the mark off-screen instead of leaving `top` empty. In hero
         mode styleWatermark() deliberately does not set `top`, and a fixed
         element with no top falls back to its static position — as <body>'s
         last child that is the BOTTOM EDGE of the viewport, the exact failure
         shape of issue #29 on DSH 0.2 where '*_headlineText' matched nothing.
         Failing closed (hidden) is always recoverable on the next sync; a mark
         smeared across the screen edge is a visible bug every time. */
      if (!headline) { hideWatermarkOffScreen(); return }
      const r = headline.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) { hideWatermarkOffScreen(); return }
      const cy = r.top + r.height / 2
      const cx = r.left + r.width / 2
      const vw = (typeof window !== 'undefined' && window.innerWidth) || (typeof document !== 'undefined' ? document.documentElement.clientWidth : 0)
      const top = (cy - 55) + 'px'
      const tx = 'translateX(' + (cx - vw / 2) + 'px)'
      // Only write when the value actually changed, so a stable layout costs nothing.
      if (watermarkEl.style.top !== top) watermarkEl.style.top = top
      if (watermarkEl.style.transform !== tx) watermarkEl.style.transform = tx
    }
    const watermarkRafLoop = () => {
      // Only the hero placement is measured per frame; persist mode is pure CSS, so
      // the loop must stop when the mode changes rather than spin for nothing.
      if (!watermarkEl || watermarkEl.getAttribute('data-ak-watermark') !== 'hero') {
        watermarkRaf = null
        return
      }
      positionWatermark()
      watermarkRaf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(watermarkRafLoop) : null
    }
    const styleWatermark = (el, mode) => {
      const s = el.style
      s.display = 'flex'
      s.alignItems = 'center'
      s.justifyContent = 'center'
      s.pointerEvents = 'none'
      s.fontWeight = '900'
      s.letterSpacing = '0.1em'
      s.color = 'var(--dsw-alias-label-primary)'
      s.textTransform = 'uppercase'
      s.userSelect = 'none'
      /* The theme's own face, via its own variable. It used to read
         --dsw-font-family directly, which now points at the APP's stack (the
         theme no longer overrides that token) — so reading it here would silently
         un-style the wordmark. --edge-font is body-scoped and falls back to the
         same stack, so this element is themed with or without the token. */
      s.fontFamily = 'var(--edge-font)'
      /* Strength comes from a CSS variable, never a literal number, so the two
         colour schemes can carry DIFFERENT alphas (defined in the stylesheet) and
         a scheme flip simply re-resolves the variable — no observer, no repaint
         logic here. An inline numeric opacity would also outrank the stylesheet,
         which is exactly what made this value unthemeable before. */
      s.opacity = 'var(--edge-wm-alpha)'
      if (mode === 'hero') {
        s.position = 'fixed'
        s.left = '0'
        s.right = '0'
        s.top = ''
        s.bottom = ''
        s.height = '110px'
        /* z-index 0, NOT 1 — this is the fix for the wordmark painting on top of
           the app's own popovers, and the cause was a z-index TIE:
             the hero composer wrapper ('*_composerHero') is position:relative +
             z-index:1, so it IS a stacking context and the model-select menu's
             z-index:20 is trapped inside it; that 20 never competes at body level.
           The mark used to be z-index:1 too — the same level as composerHero in
           the root stacking context — and ties are broken by DOM order. Appended
           to <body> last, the mark won every tie and painted over the whole
           composer subtree, dropdown included (measured: 12027 changed pixels
           inside the opaque menu box, matching 11002 px found in a real capture).
           At 0 it loses to composerHero (1), the tabs (1) and the composer seat
           (7), yet still paints ABOVE the app frame's own opaque bg-base: the
           frame is position:relative with z-index:auto, so it creates no stacking
           context, both boxes paint in the same step, and the mark is still the
           later sibling. Verified by test/watermark-stacking.test.js. */
        s.zIndex = '0'
        s.fontSize = '9.5vw'
        s.transform = ''
      } else {
        // Fill the conversation column and sit behind its content. z-index:-1 paints
        // below in-flow text but still above the column's own background, which is
        // why the column is given `isolation: isolate` in the stylesheet: without a
        // stacking context there, -1 would slide behind that background and vanish.
        s.position = 'absolute'
        s.left = '0'
        s.right = '0'
        s.top = '0'
        s.bottom = '0'
        s.height = ''
        s.zIndex = '-1'
        s.fontSize = '9.5vw'
        s.transform = ''
      }
    }
    const syncWatermarkVisibility = () => {
      /* Streaming fast path. A mounted persist-mode mark is still correctly
         placed while (a) the switches that could turn it off are unchanged,
         (b) no hero root exists in the document and (c) its host is still
         attached — all three decidable WITHOUT a single getBoundingClientRect.
         The observer fires on every body mutation batch, so during token
         streaming this used to run the full mountPointFor() below (several
         querySelector(All) + rect reads = one forced layout) per frame. Any
         check failing here falls through to the full decision, so every real
         transition — theme off, hero appearing, host detached, persist flipped
         off — is still caught on the same batch. */
      if (watermarkEl !== null && watermarkHost !== null && watermarkHost.isConnected
        && typeof document !== 'undefined'
        && watermarkEl.getAttribute('data-ak-watermark') === 'persist'
        && isEnabled() && isWatermarkOn() && isWatermarkPersistOn()
        && document.querySelector('[class$="_root"][data-phase="hero"]') === null) return
      const on = isEnabled() && isWatermarkOn()
      const target = on ? mountPointFor() : null
      // Off the hero page the mark only survives when the persist switch is on.
      // parent can be null during very early boot (no <body> yet) — never mount.
      const shouldShow = target !== null && target.parent !== null
        && (target.mode === 'hero' || isWatermarkPersistOn())
      if (shouldShow && watermarkEl) {
        // A page change can flip the mode or move the parent — restyle/reparent in place.
        if (watermarkEl.getAttribute('data-ak-watermark') !== target.mode) {
          watermarkEl.setAttribute('data-ak-watermark', target.mode)
          styleWatermark(watermarkEl, target.mode)
        }
        if (watermarkHost !== target.parent) {
          target.parent.appendChild(watermarkEl)
          watermarkHost = target.parent
        }
      } else if (shouldShow && !watermarkEl) {
        const el = document.createElement('div')
        el.setAttribute('data-ak-watermark', target.mode)
        /* Translation-proofing. The wordmark is a brand name that must never be
           rewritten by Chrome/Edge "translate this page", a Google Translate widget
           or a translator extension.
           The real defence is structural: the glyphs come from CSS `content` on a
           ::before (see the stylesheet), so there is NO DOM text node to translate —
           text-walking translators cannot see it at all. The attributes below are the
           declarative belt-and-braces for anything that inspects the element itself:
             translate="no"   — the HTML5 opt-out honoured by Chrome/Edge translate
             class notranslate — Google Translate's own opt-out hook
             lang="en"        — stops "this looks like Chinese page text" heuristics
           aria-hidden keeps a purely decorative mark out of the accessibility tree. */
        el.setAttribute('translate', 'no')
        el.setAttribute('lang', 'en')
        el.setAttribute('aria-hidden', 'true')
        el.className = 'notranslate'
        styleWatermark(el, target.mode)
        target.parent.appendChild(el)
        watermarkEl = el
        watermarkHost = target.parent
      } else if (!shouldShow && watermarkEl) {
        if (watermarkEl.parentNode) watermarkEl.parentNode.removeChild(watermarkEl)
        watermarkEl = null
        watermarkHost = null
      }
      // While visible, follow the headline every frame (page switches, sidebar
      // width changes, animations) — no reliance on observer timing. The persist
      // placement is pure CSS, so it needs no frame loop.
      const needsLoop = watermarkEl !== null && watermarkEl.getAttribute('data-ak-watermark') === 'hero'
      if (needsLoop && !watermarkRaf && typeof requestAnimationFrame === 'function') {
        watermarkRaf = requestAnimationFrame(watermarkRafLoop)
      } else if (!needsLoop && watermarkRaf !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(watermarkRaf)
        watermarkRaf = null
      }
    }
    const onWatermarkResize = () => { if (watermarkEl) positionWatermark() }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', onWatermarkResize)
    }
    let watermarkObserver = null
    /* The re-attach seam for the output-scroll animator: it has to attach to nodes
       the app renders asynchronously (the conversation scrollport), and the
       observer below is already the page's "something changed, re-attach" channel.
       Declared here as a real mutable binding — not referenced directly, and not
       `const` — because the fragment that defines it is concatenated AFTER this
       one and a later `const` sits in its temporal dead zone during apply(), where
       `typeof` does NOT protect against a TDZ ReferenceError the way it does for an
       undeclared name. Assigned inside that fragment. */
    let scrollAnimSyncHook = () => {}
    /* The bundle can be evaluated before <body> exists (the same window runLoader
       defends with a DOMContentLoaded deferral). The old code created the observer
       only when body was already there and never retried, so an early-boot apply
       left the watermark and the animator without their (re)attach channel
       for good. Deferred install instead, and right after installing, catch up on
       everything the observer missed while it did not exist yet. */
    const installWatermarkObserver = () => {
      if (watermarkObserver !== null) return
      if (typeof MutationObserver === 'undefined' || typeof document === 'undefined' || document.body === null) return
      watermarkObserver = new MutationObserver(() => {
        syncWatermarkVisibility()
        // The app frame does not exist during early boot and is replaced on some
        // route changes, so the layer has to be able to (re)attach later. This
        // fires on every DOM change on the page, including every streaming token,
        // so the hook's first act is an O(1) "still attached?" check.
        scrollAnimSyncHook()
      })
      watermarkObserver.observe(document.body, { childList: true, subtree: true })
    }
    const watermarkObserverLate = () => {
      installWatermarkObserver()
      if (watermarkObserver === null) return
      syncWatermarkVisibility()
      scrollAnimSyncHook()
    }
    if (typeof document !== 'undefined' && document.body !== null) installWatermarkObserver()
    else if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('DOMContentLoaded', watermarkObserverLate, { once: true })
    }
    /* ---- OS 减弱动效偏好 ------------------------------------------------
       被三处共用：输出滚动动画（23-*）、雷霆大字（31-*）的动画门，以及设置页里
       「动画开了但系统要求减弱」时对该行的置灰。定义在这里而不是各自的片段里，
       是因为这三处必须给出同一个答案——半套界面理会系统偏好、另一套不理会，比全
       不理会更难解释。实时读取而不是启动时缓存一次：改完系统设置不需要刷新页面。 */
    const prefersReducedMotion = () => typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    /* ---------- 输出滚动动画（流式跟随的柔性化） ----------
       DSH streams an answer by appending into the transcript and then PINNING the
       scrollport to the new floor with a direct assignment (useScrollFollow.jump):

           element.scrollTop = metrics.floor
           const landed = { ...metrics, top: element.scrollTop }
           this.following = this.nearBottom(landed)     // 25px threshold

       Measured against a fixture built from the shipped ChatView/ChatReading code:
       one growth step moves the port by exactly +60px with NO intermediate frame,
       so the transcript teleports a whole paragraph at a time. That is the
       「硬生生滚动」 this fragment removes.

       WHY NOT `scroll-behavior: smooth`. It is the obvious one-liner and it is
       UNSAFE here. Measured: under smooth, the read-back taken immediately after
       the app's own write returns the OLD position (403 where the target was
       4409), because only the animation's START is committed synchronously. The app
       feeds exactly that read-back into `nearBottom()`, so `floor - oldTop > 25`
       makes it conclude "the reader scrolled away" and DROP tail-following — the
       answer silently stops following itself. Every mechanism that changes what a
       `scrollTop` read returns after a write is therefore disqualified, however
       attractive it looks in CSS.

       WHAT THIS DOES INSTEAD. It never writes to the port. It listens for the
       port's `scroll` event and, for each STREAMING stride, compensates the
       transcript column with a transform:

           offset += (top_after - top_before)
           column.style.transform = 'translateY(' + offset + 'px)'

       which leaves the content exactly where it was on screen; the offset then
       decays to zero over the following frames, so the eye sees a glide where the
       app performed a jump. Measured with that write inside the `scroll` handler
       (51px stride every 40ms):

           worst on-screen step            51.0px -> 21.9px
           app scrollTop read-back error    0.000px   (follow intent survives)
           residual offset at rest          0, port still exactly at the floor

       21.9px is the FLOOR for any causal smoother, not a tuning shortfall: the
       transcript genuinely grows 51px every 40ms, so the content must cover that
       distance across the ~2.5 frames available, and ~20px per frame is exactly
       that. Spreading the movement across frames is the whole win.

       Why the `scroll` event rather than patching the `scrollTop` accessor — both
       measured with the identical loop: the event hook matches the patch for
       `scrollTop` writes (21.88 vs 21.87px) and BEATS it for
       `scrollTo({behavior:'instant'})` writes (21.88 vs 32.0px — the patch sees
       nothing at all), because Chrome dispatches `scroll` in the rendering steps
       before rAF and therefore before paint. It also catches every other way the
       position can move (wheel, anchors, browser scroll restoration) and survives
       React replacing the port, while shadowing no DOM accessor. The first version
       of this loop applied the transform on the NEXT animation frame instead; it
       measured `maxStep` equal to the raw stride (51px) — no animation at all — so
       the write has to happen inside the handler, never in a scheduled callback.

       Why a transform and not an interpolated `scrollTop`: the app re-pins to the
       floor on every growth step and classifies any movement it did not make as
       reader input, so writing intermediate positions would fight its state
       machine. A transform is invisible to it. Measured: translating the column
       does NOT inflate the port's scrollable overflow (scrollHeight stayed 3182
       through translateY 0/60/240 — the app's own `overflow: visible clip` chain
       contains it), so the app keeps measuring the floor it expects and the
       compensation can never feed back into its arithmetic.

       THE GATE — which strides are softened, and why geometry is enough. Only the
       streaming pin. A stride is softened when the port was ALREADY at the floor
       before it (within the app's own 25px tolerance, plus slack for a stride that
       arrives a frame late), moved DOWNWARD, and is no larger than `cap`.

       That test needs no upstream hook, and it is sufficient rather than merely
       convenient: a stride that starts at the floor and moves down can only be the
       app pinning newly grown content (or content that grew between frames, where
       animating it is exactly right). Everything else is excluded by construction —
       loading older history, restoring a session and jumping to a turn all begin
       away from the floor, upward movement never qualifies, and a reader's own
       wheel stride cannot start at the floor and move down because there is nothing
       left to scroll. The app's own `data-chat-following-tail` attribute exists and
       means the same thing, but it is deliberately NOT used: a hash-free attribute
       of ours plus plain geometry keeps working across an upstream rename, while an
       upstream contract would turn a rename into a silently dead feature.

       ON THE DECAY CONSTANT. In steady streaming the offset settles at the closed form

           lag = stride / (1 - e^(-interval / tau))

       and the per-frame step at `rate x dt`, so `tau` buys smoothing with lag and
       nothing else: a smaller tau is strictly snappier and strictly less smooth. That
       closed form is what the measured numbers match — at a 96px stride every 60ms
       with tau=70ms it predicts 167px and the suite measures 163px; at a realistic
       cadence (one 24px line every 250ms) it predicts 6.7px and the suite measures
       3.1px. `tau` must nonetheless stay well above one frame (~16.7ms), or the offset
       reaches zero before the next paint and the compensation silently becomes a
       no-op. `standard` (tau 70ms) is the default because it holds the newest line
       inside one line-height at any realistic rate; `soft`/`snappy` move that trade
       either way, and the level row exposes all three. The unbounded-lag variants the
       first draft carried measured a 135px catch-up frame once growth stopped — which
       is why `cap` rejects over-large strides outright instead of letting the offset
       grow.

       WHY THE TAIL IS ALLOWED TO SIT BELOW THE FLOOR. With the full stride
       compensated, the newest text starts `offset` px below the visible floor and
       slides up into place. That IS the smoothing — the alternative (compensating
       only part of the stride) hides less but also smooths less, at the same tau. The
       cost is real and rate-dependent, which is why it is asserted at two cadences
       rather than one: a fraction of one line at realistic rates, and ~110px at the
       deliberately brutal synthetic rate the other measurements use.

       MEASURING THE LAG IS ITSELF A TRAP (worth knowing before editing that test).
       The lag must be read as a POSITIVE distance between the tail and the port's
       bottom edge, from a baseline taken when no offset is on screen. Taking the
       baseline too early — the scroll event is delivered in the rendering steps, not
       synchronously with the write — leaves that pin's offset in the baseline and
       biases EVERY later sample low, to the point of reporting a negative lag (content
       above the fold, which is impossible). That happened here: a 9.6px-stale baseline
       made the metric read -12px. The test now waits two frames before draining and
       asserts `minLag >= -1` so the metric cannot lie in the safe-looking direction
       again.

       `transform` on the column creates a containing block for fixed descendants.
       Checked against the shipped bundles: the transcript subtree contains none
       (the two `position: fixed` rules in the chat/conversation bundles belong to
       portalled stat dialogs, rendered outside this tree, and the one JS
       `style.transform` write belongs to the turn rail's virtualizer, whose items
       are siblings of the column), and the sticky elements (composer seat, turn
       rail, group headers) are siblings rather than descendants, so they are
       unaffected. */

    const SCROLL_ANIM_KEY = 'dsh-theme-arknights-scroll-anim'
    const SCROLL_ANIM_LEVEL_KEY = 'dsh-theme-arknights-scroll-anim-level'
    const SCROLL_ANIM_LEVELS = ['soft', 'standard', 'snappy']
    /* Decay time constant (ms) and the per-stride ceiling (px) for each level.
       `tau` buys smoothing with lag, so the levels are the same curve at three
       speeds. `cap` is a SAFETY bound, not a shaping knob: a stride larger than it
       is a session restore or a turn jump, and is shown instantly.

       WHAT `cap` COSTS, stated honestly. A single streaming step can exceed it — a
       large code fence or a tool result landing in one commit is a few hundred px —
       and that step is then shown as a hard jump like any other. The caps are set
       where that starts to be the better trade: animating a 300px+ block means the
       block starts 300px+ below the fold and glides up for a third of a second,
       which is a bigger visual event than the jump it replaces. `soft` (420)
       therefore animates more than `standard` (300); raising these is a legitimate
       preference, which is why the level row exists. Measured at 400px: instant
       under `standard`, animated under `soft`.

       Deliberately NOT clamped: capping `offset` instead of rejecting the stride
       leaves the content short of where the app put it, and the shortfall shows up
       as an INSTANT jump in the very next frame. Measured on the probe: the
       clamped variants report `stepMax` equal to the raw stride (192px of 192px,
       i.e. no smoothing at all) while the unclamped curve reports 43.9px. */
    const SCROLL_ANIM_TUNING = {
      soft: { tau: 110, cap: 420 },
      standard: { tau: 70, cap: 300 },
      snappy: { tau: 45, cap: 200 },
    }
    /* How close to the floor the port had to be BEFORE the stride for that stride to
       count as a streaming follow: the app's own 25px tolerance plus slack, so a
       stride arriving one frame late still qualifies. A preserved reading position
       sits hundreds of px out and never does. */
    const SCROLL_ANIM_FOLLOW_SLACK = 40
    const isScrollAnimOn = () => prefsGet(SCROLL_ANIM_KEY) !== '0'
    const readScrollAnimLevel = () => {
      const raw = prefsGet(SCROLL_ANIM_LEVEL_KEY)
      return SCROLL_ANIM_LEVELS.indexOf(raw) === -1 ? 'standard' : raw
    }
    /** The tuning to use right now — re-read per frame, so the level row takes
        effect mid-animation rather than at the next scroll. */
    const scrollAnimTuning = () => SCROLL_ANIM_TUNING[readScrollAnimLevel()] || SCROLL_ANIM_TUNING.standard
    /* One entry per attached scrollport, not a single slot: the app can mount more
       than one ConversationRoot (the embedded variant), and each owns its own port. */
    const scrollAnimPorts = new Map()
    let scrollAnimRaf = null
    let scrollAnimFrameAt = 0
    let scrollAnimMotionQuery = null

    /* Everything that must hold for the feature to run at all. The OS preference is
       read live through the shared prefersReducedMotion() gate (see 17-motion-gate.js),
       so every animated surface answers it the same way; the hidden-tab test is here
       because a frozen rAF would otherwise leave an offset stranded on the
       transcript while the tab is away. */
    const scrollAnimActive = () => isEnabled() && isScrollAnimOn()
      && !prefersReducedMotion()
      && (typeof document === 'undefined' || !document.hidden)

    /** Mirror our state onto the port as a hash-free hook (tests and devtools read it). */
    const scrollAnimMark = (entry, state) => {
      if (entry.state === state) return
      entry.state = state
      if (state === null) entry.port.removeAttribute('data-ak-scroll-anim')
      else entry.port.setAttribute('data-ak-scroll-anim', state)
    }

    const scrollAnimClear = (entry) => {
      entry.offset = 0
      if (entry.column !== null) {
        if (entry.column.style.transform !== '') entry.column.style.transform = ''
        if (entry.column.style.willChange !== '') entry.column.style.willChange = ''
      }
      scrollAnimMark(entry, entry.attached ? 'idle' : null)
    }
    /* Write the transform, or clear it once the offset has decayed under the visible
       threshold. That epsilon is what makes the resting state REACHABLE rather than
       merely approached: an exponential decay is asymptotic and never arrives, so
       without it the page keeps a `translateY(0.09px)` — and its compositing layer —
       alive indefinitely. Measured before it existed: the offset stalled at 0.09px
       and the port stayed in the 'active' state with the transform never cleared.

       0.5 is a CSS pixel, not a device pixel: at any DPR ≥ 1 it is at most half a
       device pixel, and it is removed on the frame that reaches it, so the resting
       geometry is exactly the app's own rather than "small". */
    const SCROLL_ANIM_EPSILON = 0.5
    const scrollAnimPaint = (entry) => {
      if (entry.column === null) return false
      if (entry.offset <= SCROLL_ANIM_EPSILON) {
        entry.offset = 0
        if (entry.column.style.transform !== '') {
          entry.column.style.transform = ''
          entry.column.style.willChange = ''
        }
        scrollAnimMark(entry, 'idle')
        return false
      }
      if (entry.column.style.willChange !== 'transform') entry.column.style.willChange = 'transform'
      entry.column.style.transform = 'translateY(' + entry.offset.toFixed(2) + 'px)'
      scrollAnimMark(entry, 'active')
      return true
    }

    const scrollAnimStop = () => {
      if (scrollAnimRaf === null) return
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(scrollAnimRaf)
      scrollAnimRaf = null
      scrollAnimFrameAt = 0
    }
    const scrollAnimFrame = (now) => {
      scrollAnimRaf = null
      /* `dt` is clamped: a background tab or a long GC pause must not be repaid as
         one giant catch-up step, which would be exactly the visible jump this
         feature exists to remove. */
      const dt = Math.min(64, scrollAnimFrameAt === 0 ? 16 : now - scrollAnimFrameAt)
      scrollAnimFrameAt = now
      const decay = Math.exp(-dt / scrollAnimTuning().tau)
      let live = false
      for (const entry of scrollAnimPorts.values()) {
        if (entry.offset === 0) continue
        entry.offset *= decay
        if (scrollAnimPaint(entry)) live = true
      }
      if (live && typeof requestAnimationFrame === 'function') {
        scrollAnimRaf = requestAnimationFrame(scrollAnimFrame)
      } else {
        scrollAnimFrameAt = 0
      }
    }
    const scrollAnimRun = () => {
      if (scrollAnimRaf !== null) return
      if (typeof requestAnimationFrame !== 'function') return
      scrollAnimFrameAt = 0
      scrollAnimRaf = requestAnimationFrame(scrollAnimFrame)
    }

    /* The transcript column: the app's own `data-chat-flow` hook, which is hash-free
       and therefore survives an upstream rebuild. `querySelector` returns the
       OUTERMOST match in document order, which is the ChatView column; the nested
       `data-chat-flow` a process group carries is a descendant of it. */
    const scrollAnimColumnOf = (port) => {
      const found = port.querySelector('[data-chat-flow]')
      return found === null ? null : found
    }

    /* The reflow gate's anchor and the quantity it measures.

       WHAT IS ACTUALLY BEING COMPENSATED. The eye tracks existing content, and its
       on-screen displacement over one stride is

           visual = layoutDelta - delta          (layoutDelta = content-space movement)

       where `delta` is the app's pin and `layoutDelta` is how far the layout itself moved
       that content. For pure streaming appends `layoutDelta` is 0, so `visual == -delta`
       and compensating `+delta` reproduces the previous position exactly. For a
       disclosure EXPANSION the growth is above the tail, so the layout pushes it down by
       159px while the pin pulls it up by about the same amount: `visual ~= 0`, i.e. the
       content never moved and there is nothing to smooth. Measured on both shapes:

         stream, append at the end : delta=+32,  layoutDelta=0   -> visual=-32 (animate)
         expand, disclosure opens  : delta=+159, layoutDelta=159 -> visual=  0 (instant)

       So the compensation is `delta - layoutDelta`, not `delta`. That single expression
       covers both cases and, unlike a boolean, degrades gracefully when growth is partly
       above and partly below the fold.

       WHERE layoutDelta IS MEASURED, AND WHY IT IS TRANSFORM-FREE. `layoutDelta` is the
       change in the anchor's offset from the COLUMN's own top edge. Both rects include
       our transform, so subtracting them cancels it exactly — which matters, because a
       previous version measured the anchor against the PORT instead. The port does not
       move with the transform, so that version folded the change in our own offset
       between two strides into the measurement; the decay (tens of px per stride at
       tau=70ms) was then misread as a reflow, the animation was torn down mid-flight and
       the suite caught the result as a 156px step against a raw 96px stride.

       And the anchor is the LAST element child: that is the node streaming appends at, so
       its top edge is the one position a bottom-append cannot move. An earlier attempt
       walked to the DEEPEST last descendant, whose own geometry the expansion changes,
       and measured 0.5px against a 159px reflow — blind. */
    const scrollAnimAnchorOf = (column) => {
      if (column === null) return null
      return column.lastElementChild
    }
    const scrollAnimLayoutOf = (entry) => {
      const column = entry.column
      if (column === null || !column.isConnected) return null
      const anchor = scrollAnimAnchorOf(column)
      /* An EMPTY column has no content to measure: report null rather than falling back
         to the column itself, whose offset from its own top edge is identically 0. An
         earlier version did fall back and thereby pinned the baseline at 0 for the whole
         session, so the first big reflow read as `layoutDelta 0` and animated — the
         disclosure case this gate exists for. */
      if (anchor === null) return null
      return { node: anchor, rel: anchor.getBoundingClientRect().top - column.getBoundingClientRect().top }
    }

    /* The per-port handler. `lastTop`/`lastFloor` are OUR OWN reads of the port; this
       code never writes to it, which is the entire point of the design.

       THE REFLOW GATE — why a stride is not the same thing as a visual displacement.
       The compensation below is only correct when the stride is pure GROWTH at the
       bottom: content is appended, nothing above moves, and the app's pin therefore
       translates the eye by exactly `-delta`. So `offset += delta` reproduces the
       previous visual position and the offset can then decay into the new one.

       An EXPANSION (a reasoning/tool disclosure opening) breaks that premise: the
       layout itself gets taller ABOVE the fold, so the existing content is pushed down
       by the growth H before any scrolling happens. The app then pins to the new floor,
       which moves the port by `delta`, and the two partly cancel — the real visual
       displacement is `H - delta`, not `-delta`. Adding `delta` anyway OVERSHOOTS by
       the whole growth: the content is thrown down by H and then has to glide all the
       way back, which is exactly the spasm users report on expanding a thinking block.
       Measured on the disclosure case at the default level: OFF displaces the tail by
       39.5px for a single frame, ON by 159px followed by a 659ms slide home.

       So the handler MEASURES whether the layout above the fold moved, instead of
       assuming it did not. `getBoundingClientRect()` on a content anchor is the only
       honest source for that: `scrollHeight` alone cannot distinguish "appended at the
       bottom" (smoothable) from "pushed down everything above" (must stay instant),
       because both raise it.

       The anchor is a node deep in the transcript — NOT a child of the column, because
       the column carries our transform and re-reading it after a paint would fold our
       own offset into the measurement (a feedback loop). Comparing the same node's
       position ACROSS the stride, with the transform applied both times, cancels our
       own contribution exactly, so the difference is layout movement only. */
    const scrollAnimOnScroll = (entry) => {
      const port = entry.port
      const top = port.scrollTop
      const floor = Math.max(0, port.scrollHeight - port.clientHeight)
      const delta = top - entry.lastTop
      const wasAtFloor = entry.lastFloor - entry.lastTop <= SCROLL_ANIM_FOLLOW_SLACK
      /* Resolve the column before measuring: the anchor is read against the column's own
         top edge, so the column must be current. */
      if (entry.column === null || !entry.column.isConnected) {
        entry.column = scrollAnimColumnOf(port)
        entry.lastLayout = null
      }
      const layout = scrollAnimLayoutOf(entry)
      /* How far the layout moved existing content since the previous stride. Compared
         only when it is the SAME node: a replaced anchor is a new measurement, and
         differencing across two nodes would invent a reflow out of the swap. `null`
         (no content yet, or a fresh node) means "no baseline", treated as no reflow so
         the feature keeps working rather than latching off. */
      const layoutDelta = layout === null || entry.lastLayout === null || entry.lastLayout.node !== layout.node
        ? 0
        : layout.rel - entry.lastLayout.rel
      entry.lastTop = top
      entry.lastFloor = floor
      entry.lastLayout = layout
      if (!scrollAnimActive()) { scrollAnimClear(entry); return }
      /* Not a stream pin: upward movement, a reading position the app preserved, or a
         jump. Each must be shown immediately, exactly as the app performed it. */
      if (delta <= 0.5 || !wasAtFloor || delta > scrollAnimTuning().cap) {
        scrollAnimClear(entry)
        return
      }
      /* THE VISUAL DISPLACEMENT, which is what the eye tracks and what this feature
         exists to smooth: the pin minus however far the layout itself moved that
         content. Pure streaming appends leave `layoutDelta` at 0, so this equals the
         stride and animates; a disclosure expansion moves the layout by the same amount
         the pin does, so this is ~0 and the frame is shown instantly instead of being
         thrown 159px down and glided back. */
      const visual = delta - layoutDelta
      if (visual > scrollAnimTuning().cap) { scrollAnimClear(entry); return }
      if (visual <= SCROLL_ANIM_EPSILON) { scrollAnimClear(entry); return }
      if (entry.column === null) return
      entry.offset += visual
      scrollAnimPaint(entry)
      scrollAnimRun()
    }

    /* A reader gesture wins immediately — the app's own READING_INTENTS list. */
    const scrollAnimOnIntent = (entry) => { if (entry.offset !== 0) scrollAnimClear(entry) }

    const scrollAnimDetach = (entry) => {
      if (entry.attached && typeof entry.port.removeEventListener === 'function') {
        entry.attached = false
        entry.port.removeEventListener('scroll', entry.onScroll)
        entry.port.removeEventListener('wheel', entry.onIntent)
        entry.port.removeEventListener('touchstart', entry.onIntent)
        entry.port.removeEventListener('pointerdown', entry.onIntent)
        entry.port.removeEventListener('keydown', entry.onIntent)
      }
      entry.attached = false
      scrollAnimClear(entry)
      scrollAnimMark(entry, null)
    }
    const scrollAnimAttach = (port) => {
      if (scrollAnimPorts.has(port)) return
      const entry = {
        port,
        column: null,
        attached: false,
        state: null,
        offset: 0,
        lastTop: port.scrollTop,
        lastFloor: Math.max(0, port.scrollHeight - port.clientHeight),
        /* Anchor state for the reflow-aware compensation. Seeded on attach and again on
           every stride, so the measurement always has a same-node baseline. */
        lastLayout: null,
        onScroll: null,
        onIntent: null,
      }
      entry.onScroll = () => { scrollAnimOnScroll(entry) }
      entry.onIntent = () => { scrollAnimOnIntent(entry) }
      /* Passive everywhere: the handler only reads geometry and writes a transform,
         so it must never be able to hold up the app's own scrolling. */
      if (typeof port.addEventListener === 'function') {
        port.addEventListener('scroll', entry.onScroll, { passive: true })
        port.addEventListener('wheel', entry.onIntent, { passive: true })
        port.addEventListener('touchstart', entry.onIntent, { passive: true })
        port.addEventListener('pointerdown', entry.onIntent, { passive: true })
        port.addEventListener('keydown', entry.onIntent, { passive: true })
        entry.attached = true
      }
      entry.column = scrollAnimColumnOf(port)
      entry.lastLayout = scrollAnimLayoutOf(entry)
      scrollAnimPorts.set(port, entry)
      scrollAnimMark(entry, 'idle')
    }

    /* Idempotent reconcile: attach to every port that exists, drop every port that
       went away, and release everything while the switch, the master switch or the
       OS motion preference says no. Runs on mount, on every preference echo, and
       from the page observer's per-mutation hook, so a port that appears later
       (opening a session, or a second embedded conversation view) is picked up with
       no reload.

       NO early-return shortcut, deliberately. An earlier version short-circuited
       with an O(1) "are the ports we already own still connected?" check to avoid a
       querySelectorAll per mutation batch — but that makes a SECOND port unable to
       ever attach while the first one is healthy, which is a correctness bug bought
       with an imaginary saving. Measured on a 1934-node session-like DOM:
       querySelectorAll('[data-conversation-scroll]') costs 0.0003ms per call, which
       is the same order as the watermark observer's own accepted fast-path query
       (0.0002ms) and ~0.0007% of a 24fps frame budget. The scan is also strictly
       cheaper than the work the rest of this hook already does per mutation. */
    const syncScrollAnim = () => {
      if (typeof document === 'undefined') return
      const on = scrollAnimActive()
      if (!on && scrollAnimPorts.size === 0) { scrollAnimStop(); return }
      const live = document.querySelectorAll('[data-conversation-scroll]')
      for (const [port, entry] of Array.from(scrollAnimPorts.entries())) {
        if (!on || !port.isConnected || !Array.prototype.includes.call(live, port)) {
          scrollAnimDetach(entry)
          scrollAnimPorts.delete(port)
        }
      }
      if (!on) { scrollAnimStop(); return }
      for (const port of live) {
        if (!scrollAnimPorts.has(port)) scrollAnimAttach(port)
      }
      /* A column React replaced mid-animation would otherwise keep its transform
         forever if no further stride arrives to re-resolve it (the stride handler
         does re-resolve, but it only runs on a scroll). Detached nodes are not
         painted, so this is about not handing a stale offset back to a node the app
         might reuse — cheap, and it removes the whole class.

         The gate's baseline is dropped with it: a replaced column is a new layout, so
         comparing the new anchor's position against the old column's would report a
         large fake reflow and permanently disable the animation. */
      for (const entry of scrollAnimPorts.values()) {
        if (entry.column !== null && !entry.column.isConnected) {
          scrollAnimClear(entry)
          entry.lastLayout = null
        }
      }
    }
    /* Return to the app's exact geometry without animating: the OS motion preference
       flipping on, the tab going hidden (a frozen rAF would otherwise strand a large
       offset and decay it on return), teardown. */
    const scrollAnimSnap = () => {
      scrollAnimStop()
      for (const entry of scrollAnimPorts.values()) scrollAnimClear(entry)
    }
    const destroyScrollAnim = () => {
      scrollAnimStop()
      for (const [port, entry] of Array.from(scrollAnimPorts.entries())) {
        scrollAnimDetach(entry)
        scrollAnimPorts.delete(port)
      }
    }
    const onScrollAnimEnvironmentChange = () => {
      if (!scrollAnimActive()) scrollAnimSnap()
      else syncScrollAnim()
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', onScrollAnimEnvironmentChange)
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      scrollAnimMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      if (typeof scrollAnimMotionQuery.addEventListener === 'function') {
        scrollAnimMotionQuery.addEventListener('change', onScrollAnimEnvironmentChange)
      }
    }
    // Let the page observer declared above re-attach as the app renders.
    scrollAnimSyncHook = syncScrollAnim

    /* ---------- boot loading screen (settings-toggleable, default OFF) ----------
       Recreates the launcher boot screen this theme's plate is modelled on: a full-viewport black plate with
       an 8px signal-yellow progress rail down the left edge, a meter group (tick +
       percentage + status line) that rides the fill end, and the centred ARKNIGHTS
       wordmark. It plays once per page load, then fades out and removes itself.

       Default OFF as requested: a loading plate that covers the app is opt-in, and
       an off switch must cost nothing, so nothing is built or timed until enabled.

       Geometry is not guessed — it is measured off the reference frame (1340x731):
         rail width 8px, fill 57.5% of viewport height at the captured moment,
         meter left edge x=24, tick 4x15px, digits cap-height 28px (~39px Arial),
         status line 15px below the digits in #666.
       Those ratios are reproduced here as em/percentage values so they hold at any
       viewport size. */
    const LOADER_KEY = 'dsh-theme-arknights-loader'
    // Default OFF (=== '1' rather than !== '0'): opt-in, per the request.
    const isLoaderOn = () => prefsGet(LOADER_KEY) === '1'
    let loaderEl = null
    let loaderRaf = null
    let loaderTick = null
    let loaderFuse = null
    let loaderExitTimer = null
    let loaderPlateH = 0
    let loaderMeterH = 0
    // Last-resort hard kill. Deliberately NOT cleared by clearLoaderTimers(): the
    // completion flourish calls that to stop the progress clocks, and this timer has
    // to outlive it so a stalled flourish can still never leave the app covered.
    let loaderKill = null
    let loaderDone = false
    const clearLoaderTimers = () => {
      if (loaderRaf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(loaderRaf)
      loaderRaf = null
      if (loaderTick !== null && typeof clearInterval === 'function') clearInterval(loaderTick)
      loaderTick = null
      if (loaderFuse !== null && typeof clearTimeout === 'function') clearTimeout(loaderFuse)
      loaderFuse = null
      if (loaderExitTimer !== null && typeof clearTimeout === 'function') clearTimeout(loaderExitTimer)
      loaderExitTimer = null
    }
    /** Remove the plate and release every timer/handle it owns. Idempotent. */
    const destroyLoader = () => {
      clearLoaderTimers()
      if (loaderKill !== null && typeof clearTimeout === 'function') clearTimeout(loaderKill)
      loaderKill = null
      if (loaderEl && loaderEl.parentNode) loaderEl.parentNode.removeChild(loaderEl)
      loaderEl = null
      loaderPlateH = 0
      loaderMeterH = 0
    }
    /* One boot animation. The progress value is derived from elapsed WALL-CLOCK time,
       never accumulated per frame, so it cannot drift.

       Two clocks drive the same `step`, deliberately:
         requestAnimationFrame — smooth, vsync-aligned updates while the tab paints;
         setInterval           — a coarse fallback that keeps advancing when rAF is
                                 throttled or suspended (background/occluded tab, an
                                 embedded webview, a headless renderer that stops
                                 painting after first paint).
       rAF alone is NOT safe here: when it stalls, a full-screen plate would stay on
       screen forever. Because progress is time-based and `step` is idempotent for a
       given instant, running from both clocks is harmless — whichever fires first
       just renders the current value.

       `loaderFuse` is the last line of defence: a single timeout that force-finishes
       the plate even if both clocks stop, so the app can never stay covered. */
    /* 启动加载动画音. The sound is played by the HOST (lib/audio.js) — the page
       only reports that the plate started, so volume, debounce, the custom-sound
       directory and the slot switch all stay in one place. `audioBootSent` makes
       this exactly once per page load, which is the loader's own contract: the
       预览 button re-runs the plate deliberately and must not re-ring a boot
       sound, and neither must a toggle-on. */
    let audioBootSent = false
    const playBootChime = () => {
      if (audioBootSent) return
      audioBootSent = true
      // Master switch, slot switch and volume are the host's call; the page only
      // avoids the round-trip when the feature is switched off outright.
      if (typeof isAudioOn === 'function' && !isAudioOn()) return
      try {
        previewSlot('boot').catch(() => { /* host bridge absent: boot stays silent */ })
      } catch (e) { /* keep going */ }
    }
    const runLoader = () => {
      // The plate is themed BY this theme: with the master switch off its
      // stylesheet is gone and the plate would render as stray unstyled text in
      // the page flow (the percentage and status rows are real DOM text), so an
      // off switch must not be able to start it — including the settings 预览
      // button and the toggle-on path, which both land here.
      if (!isEnabled()) return
      if (loaderDone || loaderEl !== null) return
      if (typeof document === 'undefined') return
      // The plate is a <body> child. If the client bundle is evaluated before the
      // body exists, defer to DOMContentLoaded instead of silently skipping the
      // animation (loaderDone stays false, so the retry is the real first run).
      if (!document.body) {
        if (typeof document.addEventListener === 'function') {
          document.addEventListener('DOMContentLoaded', () => { runLoader() }, { once: true })
        }
        return
      }
      loaderDone = true
      playBootChime()

      const el = document.createElement('div')
      el.setAttribute('data-ak-loader', '')
      // Same translation-proofing as the watermark: every glyph the plate shows is
      // brand/UI chrome drawn from CSS `content` or set as textContent on elements
      // marked notranslate, so "translate this page" cannot rewrite ARKNIGHTS.
      el.setAttribute('translate', 'no')
      el.setAttribute('lang', 'en')
      el.setAttribute('aria-hidden', 'true')
      el.className = 'notranslate'
      /* Poster layout, following the supplied key-art reference (1184x685).
         The brand block is a LEFT-aligned stack that sits in the right third of
         the plate: kicker, END, FIELD, then a detail cluster and the tagline, all
         sharing one left rhythm line. No localized chip — the reference wordmark is
         latin-only, so every glyph here comes from CSS content() and the plate
         carries no translatable DOM text at all.
         The meter (tick + percent + status) RIDES THE FILL END: its top follows the
         rail's fill height, matching the launcher reference where the readout sits
         just under the leading edge of the yellow bar.
         `-wipe` is the completion flourish: once the rail reaches 100% it expands
         from the rail into a full-screen yellow sweep to the right, then the whole
         plate fades out. It is a separate layer so the sweep can cover the brand
         block and meter without disturbing their layout. */
      el.innerHTML =
        '<div data-ak-loader-tex></div>' +
        '<div data-ak-loader-track></div>' +
        '<div data-ak-loader-fill></div>' +
        '<div data-ak-loader-meter>' +
        '<span data-ak-loader-tick></span>' +
        '<span data-ak-loader-pct></span>' +
        '<span data-ak-loader-status></span>' +
        '</div>' +
        '<div data-ak-loader-brand>' +
        '<span data-ak-loader-kicker></span>' +
        '<span data-ak-loader-word data-ak-loader-word1></span>' +
        '<span data-ak-loader-word data-ak-loader-word2></span>' +
        '<span data-ak-loader-detail>' +
        '<span data-ak-loader-chev></span>' +
        '<span data-ak-loader-sub></span>' +
        '<span data-ak-loader-seq></span>' +
        '<span data-ak-loader-squares>' +
        '<i data-on></i><i data-on></i><i data-on></i><i></i><i></i><i></i>' +
        '<i data-on></i><i data-on></i><i></i><i></i><i></i><i></i>' +
        '</span>' +
        '</span>' +
        '<span data-ak-loader-tag></span>' +
        '</div>' +
        '<div data-ak-loader-wipe></div>'
      document.body.appendChild(el)
      loaderEl = el

      const fill = el.querySelector('[data-ak-loader-fill]')
      const meter = el.querySelector('[data-ak-loader-meter]')
      const pct = el.querySelector('[data-ak-loader-pct]')
      const status = el.querySelector('[data-ak-loader-status]')
      const DURATION = 1750
      const start = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now()
      loaderPlateH = el.clientHeight || Math.ceil(el.getBoundingClientRect().height) || 0
      loaderMeterH = meter ? Math.ceil(meter.getBoundingClientRect().height) : 0
      const now = () => ((typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now())
      /* Completion sequence, in order:
           WIPE_MS  the rail expands rightward into a full-screen yellow sweep;
           EXIT_MS  the whole plate (yellow included) fades to transparent.
         The fuse below must outlast WIPE_MS + EXIT_MS, or it would tear the plate
         down mid-flourish. */
      const WIPE_MS = 520
      const EXIT_MS = 620
      let finished = false
      /* Play the yellow sweep, then fade out, then remove. Guarded so the two clocks
         plus the fuse can all reach the end without stacking timers, restarting the
         sweep, or double-removing the node.

         Both phases are driven from JS on the same dual-clock/wall-clock basis as
         the progress ramp, NOT from a CSS transition. Measured reason: a CSS
         transition is not a reliable animation primitive in every renderer this
         plate can run in — in the verification renderer a transition declared this
         way emitted no transitionrun/start/end events at all and the computed width
         stayed pinned at its start value indefinitely, which would leave a 10px
         stub on screen instead of a sweep. Driving it here means the flourish
         advances wherever the progress ramp advances, and it stays measurable. */
      const finish = () => {
        if (finished) return
        finished = true
        // Stop the progress clocks but keep the plate: the flourish reuses these
        // handles, so clearLoaderTimers() must not be what tears the node down.
        clearLoaderTimers()
        if (!loaderEl) return
        const el = loaderEl
        const wipeEl = el.querySelector('[data-ak-loader-wipe]')
        const hasRaf = typeof requestAnimationFrame === 'function'
        const hasTimeout = typeof window !== 'undefined' && typeof window.setTimeout === 'function'
        // Someone who asked for less motion gets the plate gone, not a flourish.
        const reduceMotion = typeof window !== 'undefined'
          && typeof window.matchMedia === 'function'
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduceMotion || (!hasRaf && !hasTimeout)) { destroyLoader(); return }
        el.setAttribute('data-ak-loader-wiping', '')
        // JS owns opacity from here, so the stylesheet transition must not fight it.
        el.style.transition = 'none'
        const t0 = now()
        const plateW = el.clientWidth || 0
        const RAIL = 10
        let exitMarked = false
        const flourish = () => {
          if (!loaderEl) return
          const elapsed = now() - t0
          // phase 1 — sweep out of the rail across the full width
          const wt = Math.min(1, elapsed / WIPE_MS)
          const eased = 1 - Math.pow(1 - wt, 3)
          if (wipeEl) {
            wipeEl.style.opacity = '1'
            wipeEl.style.width = (RAIL + eased * Math.max(0, plateW - RAIL)).toFixed(1) + 'px'
          }
          // phase 2 — fade the whole plate, yellow included
          const fadeMs = elapsed - WIPE_MS
          if (fadeMs > 0) {
            if (!exitMarked) { exitMarked = true; el.setAttribute('data-ak-loader-exit', '') }
            el.style.opacity = Math.max(0, 1 - fadeMs / EXIT_MS).toFixed(3)
          }
          if (elapsed >= WIPE_MS + EXIT_MS) { destroyLoader(); return }
          loaderRaf = hasRaf ? requestAnimationFrame(flourish) : null
        }
        // First frame synchronously so the sweep never starts from a blank frame.
        flourish()
        if (typeof setInterval === 'function') loaderTick = setInterval(flourish, 30)
        if (hasTimeout) loaderExitTimer = window.setTimeout(destroyLoader, WIPE_MS + EXIT_MS + 400)
      }
      const step = () => {
        if (finished || !loaderEl) return
        const t = Math.min(1, (now() - start) / DURATION)
        // easeOutCubic: quick climb, gentle settle onto 100%.
        const eased = 1 - Math.pow(1 - t, 3)
        const value = Math.round(eased * 100)
        const shown = value + '%'
        if (fill) fill.style.height = (eased * 100).toFixed(2) + '%'
        if (pct && pct.textContent !== shown) pct.textContent = shown
        if (status) {
          const label = value < 45 ? 'Connecting...' : (value < 99 ? 'Updating...' : 'Ready')
          if (status.textContent !== label) status.textContent = label
        }
        /* Meter follows the fill's leading edge, driven by the SAME eased value so
           the bar and its readout can never disagree. Positioned in px and clamped:
           the group is ~90px tall, so a raw percentage would push it off the bottom
           of the screen as the fill nears 100%. GAP keeps the tick just below the
           leading edge (per the reference, the readout trails the edge). Measure
           after updating the text: the initial empty meter is much shorter than the
           completed percentage/status group and would otherwise make 100% overflow.
           Keep extra room below the line box because the percentage uses a compact
           line-height and its glyphs can paint below that box. */
        if (meter) {
          const SAFE_BOTTOM = 64
          if (value >= 100) {
            /* Anchor the completed readout from the bottom. At this point the
               percentage and status have their final font metrics, so bottom
               anchoring is more reliable than clamping a cached top position. */
            meter.style.setProperty('top', 'auto', 'important')
            meter.style.setProperty('bottom', SAFE_BOTTOM + 'px', 'important')
          } else {
            meter.style.removeProperty('bottom')
            meter.style.removeProperty('top')
            const plateRect = el.getBoundingClientRect()
            loaderMeterH = Math.ceil(meter.getBoundingClientRect().height)
            const GAP = 10
            const raw = eased * (plateRect.height || loaderPlateH) + GAP
            const maxTop = Math.max(0, (plateRect.height || loaderPlateH) - loaderMeterH - SAFE_BOTTOM)
            meter.style.top = Math.min(raw, maxTop).toFixed(1) + 'px'
            /* Use the rendered rectangle as the final authority. Font metrics and
               fractional viewport sizes can make the line box differ from the
               cached height, especially in a narrow window. Correct any remaining
               overflow instead of allowing the readout to be clipped. */
            const meterRect = meter.getBoundingClientRect()
            const allowedBottom = plateRect.bottom - SAFE_BOTTOM
            if (meterRect.bottom > allowedBottom) {
              const currentTop = parseFloat(meter.style.top) || 0
              meter.style.top = Math.max(0, currentTop - meterRect.bottom + allowedBottom).toFixed(1) + 'px'
            }
          }
        }
        if (t >= 1) {
          el.setAttribute('data-ak-loader-complete', '')
          // Hold the completed frame for a beat so 100% is actually readable.
          if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
            if (loaderExitTimer === null) loaderExitTimer = window.setTimeout(finish, 220)
          } else finish()
          return
        }
        loaderRaf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(step) : null
      }
      // Paint the first frame synchronously: the plate must never flash at 0%/empty.
      step()
      // Clock 2: coarse fallback that survives rAF throttling.
      if (typeof setInterval === 'function') loaderTick = setInterval(step, 60)
      if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
        // Fuse: if both progress clocks stall, force the completion sequence.
        loaderFuse = window.setTimeout(() => { finished = false; finish() }, DURATION + 1600)
        // Hard kill: covers the flourish itself stalling (a suspended tab can hold a
        // CSS transition indefinitely). Outlasts fuse + wipe + fade, then removes the
        // node unconditionally, so the app can never stay covered.
        loaderKill = window.setTimeout(destroyLoader, DURATION + 1600 + WIPE_MS + EXIT_MS + 400)
      } else if (loaderRaf === null && loaderTick === null) {
        destroyLoader()
      }
    }

    /* The first authoritative settings section can land AFTER apply() has run (the
       Host serves it over the wire), and until it does every prefsGet falls back
       to the schema default — for the loader that default is '0' ("default off"),
       so the boot-time call in apply() is a silent no-op and the plate never plays
       however the user has it stored. That is the whole "the startup animation
       stopped appearing" symptom, and it is invisible to any test whose fixture
       scope answers 'ready' from the first synchronous read.

       This closes the window. The store calls it once, on the first real section
       of the page load — which IS the "once per page load" moment the boot-time
       call is trying to hit — and the guards below keep every other case out:
         - a section that changes LATER (another window, a reverting host) never
           reaches here at all, because the store fires this hook only once;
         - a plate already played or mid-play is left alone;
         - a user who has answered this question in-session (the settings toggle)
           outranks a section that was still in flight when they answered it. What
           enforces that is prefsGetValue overlaying prefsLocalEdited, so
           isLoaderOn() already reads the session value; the prefsEdited check
           below merely pins the same intent at this call site instead of leaning
           on the overlay's internals. The plain 预览 button needs neither guard:
           runLoader() sets loaderDone the instant it starts. */
    onPrefsSettled = () => {
      if (loaderDone || loaderEl !== null) return
      if (prefsEdited.has('loader')) return
      if (!isEnabled()) return
      if (!isLoaderOn()) return
      runLoader()
    }

    /* ---------- 雷霆大字 (娱乐模式, default OFF) ----------
       A task-boundary announcement: when a turn starts, 「任务开始」 slams into the
       middle of the screen in heavy white type; when it ends, 「任务完成」 does the
       same. Each stays for exactly 3s and removes itself.

       WHERE THE SIGNAL COMES FROM. This is turn-level state, not tool-level, so it
       reads the ONE authoritative bit: ConversationSnapshot.running on the current
       session (@deepseek-ai/dsh-client-runtime — the same field the app's own
       turn-status label and stop button switch on). No DOM sniffing: the class
       hashes those surfaces carry are not a contract, and a spinner appearing is
       not the same event as a turn starting.

       Reached through ctx.get('sessions'), NOT inject: the theme must still mount
       when the sessions service is absent (the in-process settings tests supply a
       ctx with only theme/slots), and a missing service means "no announcements",
       not "no theme".

       EDGES, NOT LEVELS. Only a false->true / true->false transition announces. The
       first readable value of a session is recorded as a BASELINE and stays silent,
       which is what stops 「任务开始」 from firing merely because the user switched
       into a session that was already running. */
    const THUNDER_KEY = 'dsh-theme-arknights-thunder'
    /* The slam-in animation is its OWN switch, default OFF: showing the word is
       one decision, animating it is another. With it off the word still appears
       instantly, holds 3s and leaves; only the scale punch and the fade are
       dropped. */
    const THUNDER_ANIM_KEY = 'dsh-theme-arknights-thunder-anim'
    const THUNDER_START = '任务开始'
    const THUNDER_DONE = '任务完成'
    // Hold time, per the request: visible for 3s, then gone.
    const THUNDER_MS = 3000
    // Default OFF (=== '1' rather than !== '0'): opt-in, like the boot animation.
    const isThunderOn = () => prefsGet(THUNDER_KEY) === '1'
    // Default OFF for the same reason, and read independently of the parent switch.
    const isThunderAnimOn = () => prefsGet(THUNDER_ANIM_KEY) === '1'
    /* The OS preference still wins over an enabled animation switch. Checked live
       rather than cached, so changing the OS setting takes effect on the next
       announcement. */
    const thunderWantsAnim = () => isThunderAnimOn() && !prefersReducedMotion()
    let thunderEl = null
    let thunderTimer = null
    // Detaches the click-to-dismiss listener; null when none is armed.
    let thunderDismiss = () => {}
    /** Remove the plate and release its timer and listener. Idempotent. */
    const destroyThunder = () => {
      if (thunderTimer !== null && typeof clearTimeout === 'function') clearTimeout(thunderTimer)
      thunderTimer = null
      /* Detach BEFORE removing the node, and reset the handle first so the listener
         calling back into here cannot re-enter this line. */
      const detach = thunderDismiss
      thunderDismiss = () => {}
      detach()
      if (thunderEl && thunderEl.parentNode) thunderEl.parentNode.removeChild(thunderEl)
      thunderEl = null
    }
    /* Announce one word. A second call inside the 3s window REPLACES the first
       (turn/end immediately followed by a queued turn/start is a real sequence), so
       the node is rebuilt rather than reused — that restarts the CSS animation,
       which merely re-setting textContent would not. */
    const showThunder = (text) => {
      if (!isEnabled() || !isThunderOn()) return
      if (typeof document === 'undefined' || !document.body) return
      destroyThunder()
      const el = document.createElement('div')
      el.setAttribute('data-ak-thunder', '')
      // Pure decoration over content the user is already reading: never announced,
      // never hit-tested (pointer-events:none lives in the stylesheet).
      el.setAttribute('aria-hidden', 'true')
      /* No animation: the word appears at full size and full opacity, holds, then is
         removed by the timer below. Two independent reasons land on this same static
         path — the animation switch being off (the default) and the OS asking for
         reduced motion — so both go through thunderWantsAnim(). */
      if (!thunderWantsAnim()) el.setAttribute('data-ak-thunder-still', '')
      const word = document.createElement('span')
      word.setAttribute('data-ak-thunder-word', '')
      word.textContent = text
      el.appendChild(word)
      document.body.appendChild(el)
      thunderEl = el
      /* CLICK ANYWHERE TO DISMISS EARLY, without waiting out the 3s.

         Listening on the DOCUMENT rather than on the plate is the whole point. The
         plate is pointer-events:none on purpose (it is a caption laid over text the
         user may be mid-sentence in, not a modal), and making it clickable would turn
         it into a full-screen click-eater for 3 seconds: the dismissing click would
         be swallowed instead of reaching whatever the user actually aimed at. With a
         document listener the click BOTH dismisses the word and lands normally, so
         clicking blank space costs nothing and clicking a control still works.

         pointerdown, not click, for two reasons: it covers mouse/touch/pen in one
         event, and it fires on press so the word disappears the instant the user
         acts. It also cannot self-dismiss when 预览 triggers this from a button's
         click handler — that interaction's pointerdown has already been dispatched
         before this listener exists, and a later click event does not re-fire it.

         Capture phase so an app handler calling stopPropagation cannot make the word
         undismissable. */
      if (typeof document.addEventListener === 'function' && typeof document.removeEventListener === 'function') {
        const onPointerDown = () => { destroyThunder() }
        document.addEventListener('pointerdown', onPointerDown, true)
        thunderDismiss = () => { document.removeEventListener('pointerdown', onPointerDown, true) }
      }
      // No timer available (a stripped test host) must not leave the plate up.
      if (typeof setTimeout === 'function') thunderTimer = setTimeout(destroyThunder, THUNDER_MS)
      else destroyThunder()
    }

    /* Resolved LAZILY, never cached at apply() time. The web boot mounts every
       plugin row concurrently (`Promise.all` over the manifest in dsh-web-frontend)
       and this theme declares no `inject`, so apply() can legitimately run before
       dsh-client-runtime has provided `sessions`. A one-shot `const sessions =
       ctx.get('sessions')` here would capture undefined for the whole session and
       the feature would be permanently dead depending on load order — the exact
       kind of race that only shows up on a slow or cold page load.

       Declaring inject: ['sessions'] is the other valid fix, but it would put the
       WHOLE THEME into cordis' pending state until that service appears, which
       would delay the token/stylesheet mount that everything else here depends on.
       A theme must paint even if the announcement feature never gets its service,
       so the lookup is deferred instead and re-tried on the retry timer below. */
    const getSessions = () => {
      const s = ctx.get('sessions')
      return (s === undefined || s === null) ? undefined : s
    }
    let thunderUnsubList = null
    let thunderUnsubSession = null
    let thunderRebindTimer = null
    /* Retry budget for thunderRebind, bounded like every other retry in this
       file (rebindPrefs 40, settle watch 20): a permanently absent sessions
       service must not leave a 120 ms poll running for the life of the page.
       A settings change re-runs syncThunder -> thunderRebind, which restarts
       the budget. */
    let thunderRebindAttempts = 0
    let thunderWatchedId = null
    // null = nothing readable observed yet, so the next value is a baseline.
    let thunderLastRunning = null
    /** The running bit of one session face, or null when it cannot be read. */
    const thunderReadRunning = (face) => {
      try {
        const snap = face.getSnapshot()
        if (snap === null || typeof snap !== 'object') return null
        return snap.running === true
      } catch (e) {
        return null
      }
    }
    const thunderDetach = () => {
      if (thunderUnsubSession !== null) {
        try { thunderUnsubSession() } catch (e) { /* already torn down */ }
        thunderUnsubSession = null
      }
      thunderWatchedId = null
      thunderLastRunning = null
    }
    /** Subscribe to selection changes once; idempotent. */
    const thunderSubscribeList = (sessions) => {
      if (thunderUnsubList !== null) return
      let unsub = null
      try { unsub = sessions.list.subscribe(() => { thunderRebind() }) } catch (e) { unsub = null }
      thunderUnsubList = (typeof unsub === 'function') ? unsub : null
    }
    /* WHICH session the user is looking at.
       The list snapshot used to carry a `current` session id, and this file read it.
       Newer Controllers deliberately moved view selection out of themselves — the
       list state is { ids, byId, phase, projectionsBySession } and the contract says
       outright that "view selection remains outside the Controller" — so `current`
       is simply gone there. The old read therefore resolved to undefined, the watch
       bailed out, and the announcement went permanently silent: the whole feature
       looked switched on in settings while nothing ever fired.
       The runtime's own answer is the `mainView` retention count. The workspace main
       view retains whatever it displays with
       `sessions.retain(target, { source: 'mainView' })`, and every shipped package
       that needs "the current session" resolves it with exactly this scan
       (ui-session, ui-layout, ui-workspace, ui-settings-general, ui-cordis,
       ui-agent-preset, ui-open-in-app). Selection changes reach us as ordinary list
       publishes — the Controller copies the retention record onto the row
       (`publishRetention` -> `list.set`), so switching sessions re-runs this scan
       through the subscription below, with no polling of our own.
       `snap.current` is kept as a fallback so a host that still publishes it keeps
       working; both shapes are covered by test/thunder-edges.test.js. */
    const thunderCurrentId = (snap) => {
      const byId = snap.byId
      if (byId !== null && typeof byId === 'object') {
        const ids = Object.keys(byId)
        for (let i = 0; i < ids.length; i += 1) {
          const row = byId[ids[i]]
          if (row === null || typeof row !== 'object') continue
          const kept = row.retainedBy
          if (kept !== null && typeof kept === 'object' && (kept.mainView ?? 0) > 0) return ids[i]
        }
      }
      const legacy = snap.current
      return (typeof legacy === 'string' || typeof legacy === 'number') ? legacy : undefined
    }
    /* Follow the CURRENT session. `sessions.list` publishes the selection, and the
       runtime's own list subscriber (registered at construction, so it runs first)
       stages the session that makes binding() resolve. A miss here is therefore
       ordinary timing rather than an error, so it retries on a short timer instead
       of giving up — that single deferred retry is also what covers the very first
       reconcile during boot, before any session is staged. */
    const thunderRebind = () => {
      const sessions = getSessions()
      if (thunderRebindTimer !== null && typeof clearTimeout === 'function') clearTimeout(thunderRebindTimer)
      thunderRebindTimer = null
      /* Service not there yet: keep retrying rather than giving up for good, since
         the only reason to be here is that the feature is switched on — but only
         within the budget above. */
      if (sessions === undefined) {
        if (thunderRebindAttempts >= 100) {
          dbg('thunder rebind gave up: no sessions service after', thunderRebindAttempts, 'tries')
          return
        }
        thunderRebindAttempts += 1
        if (typeof setTimeout === 'function') thunderRebindTimer = setTimeout(thunderRebind, 120)
        return
      }
      // The list subscription may have been skipped earlier (no service then), so
      // attach it as soon as one exists.
      thunderSubscribeList(sessions)
      let snap = null
      try {
        snap = sessions.list.getSnapshot()
      } catch (e) {
        // Unreadable list: leave the previous watch exactly as it is. A flaky read
        // must not be mistaken for "the user left this session".
        return
      }
      const id = (snap === null || typeof snap !== 'object') ? undefined : thunderCurrentId(snap)
      if (id === undefined || id === null) {
        /* Nothing on screen to announce. This is a WAITING state rather than a
           failure, and the difference matters: the old code treated it as final, so
           a list that had no current session at boot never recovered. The main view
           retains its session when it gets one, that retention lands in the list, and
           the subscription attached above comes straight back here — so we simply
           wait, keeping no timer. The one case that needs the timer is a list
           subscription that could not be attached at all, because then no future
           publish can ever reach us. */
        thunderDetach()
        if (thunderUnsubList === null) {
          if (thunderRebindAttempts >= 100) {
            dbg('thunder rebind gave up: no current session and no list subscription')
            return
          }
          thunderRebindAttempts += 1
          if (typeof setTimeout === 'function') thunderRebindTimer = setTimeout(thunderRebind, 120)
        }
        return
      }
      /* Already watching this one: skip the detach/resubscribe churn. `sessions.list`
         publishes for every unrelated reason (a title change, a job row, a sidebar
         refresh), and rebinding on each one would tear down and re-add the same
         subscription constantly.

         Deliberately NOT claimed as an edge-correctness guard: the reseed would be
         synchronous, so `running` cannot change inside the gap and the baseline
         would land on the value it already held. Verified by removing this line —
         the edge assertions still pass. It is a cost guard, and it is honest about
         being one. */
      if (id === thunderWatchedId && thunderUnsubSession !== null) return
      thunderDetach()
      let face = null
      try {
        const binding = sessions.binding(id)
        if (binding !== undefined && binding !== null) face = binding.session
      } catch (e) {
        face = null
      }
      if (face === null || typeof face.subscribe !== 'function' || typeof face.getSnapshot !== 'function') {
        if (thunderRebindAttempts >= 100) {
          dbg('thunder rebind gave up: session face never became bindable for', id)
          return
        }
        thunderRebindAttempts += 1
        if (typeof setTimeout === 'function') thunderRebindTimer = setTimeout(thunderRebind, 120)
        return
      }
      thunderRebindAttempts = 0
      thunderWatchedId = id
      thunderLastRunning = thunderReadRunning(face)
      let unsub = null
      try {
        unsub = face.subscribe(() => {
          const next = thunderReadRunning(face)
          if (next === null || next === thunderLastRunning) return
          const prev = thunderLastRunning
          thunderLastRunning = next
          // First readable value is the baseline, not an edge — see the note above.
          if (prev === null) return
          showThunder(next ? THUNDER_START : THUNDER_DONE)
        })
      } catch (e) {
        unsub = null
      }
      thunderUnsubSession = (typeof unsub === 'function') ? unsub : null
      if (thunderUnsubSession === null) thunderWatchedId = null
    }
    const thunderStopWatch = () => {
      if (thunderRebindTimer !== null && typeof clearTimeout === 'function') clearTimeout(thunderRebindTimer)
      thunderRebindTimer = null
      thunderRebindAttempts = 0
      if (thunderUnsubList !== null) {
        try { thunderUnsubList() } catch (e) { /* already torn down */ }
        thunderUnsubList = null
      }
      thunderDetach()
    }
    /* Switched off costs nothing: no subscription, no timer, no plate. An off switch
       must not leave a listener behind that wakes on every streamed token just to
       return early. */
    const syncThunder = () => {
      if (!(isEnabled() && isThunderOn())) {
        thunderStopWatch()
        destroyThunder()
        return
      }
      // thunderRebind() resolves the service itself and re-arms its own retry, so
      // there is nothing to check here — being switched on is the whole condition.
      thunderRebind()
    }

    /* ---------- 需要你回应 watcher ----------
       A coarse poll rather than a MutationObserver. The reason is the failure mode
       rather than the cost: an observer watching a container that the app later
       replaces (or an anchor that renders before `document.body` exists) stops
       delivering and cannot tell anyone, while a poll that asks "is a confirmation
       box on screen?" keeps working through any re-render, and its only symptom is
       up to `AUDIO_ATTENTION_POLL_MS` of latency — imperceptible for a chime.

       The edge is "a box is on screen after a moment where none was". A box that
       stays open does not re-report, so a forgotten dialog cannot beep forever; and
       a re-render that briefly drops the node and puts it back would re-report, so
       the poll is deliberately slower than a React remount. Whatever still slips
       through lands on the host's per-slot debounce, which is the backstop for
       every path. */
    /* Detection is edge-triggered on a MutationObserver, with a slow poll as the
       backstop. The first version polled alone at 400ms, which stacked its
       worst-case latency on top of the ~200-400ms it takes the host to cold-start
       the player process — the user measured the total as "a bit delayed". The
       observer cuts the first term to roughly one animation frame; the poll stays
       because an observer bound to a container the app later replaces would stop
       delivering silently, and a poll cannot. Its period is deliberately longer
       than a React remount, so a re-render that briefly drops and re-adds the node
       cannot register as two separate boxes. */
    const AUDIO_ATTENTION_POLL_MS = 1000
    /* The app mutates the DOM continuously while a turn streams, so a mutation
       cannot run the query on its own frame: it only schedules one. Coalescing on
       the next frame keeps the check off the render path and collapses a burst of
       mutations into a single look. */
    let audioAttentionTimer = null
    let audioAttentionObserver = null
    let audioAttentionFrame = null
    let audioAttentionKind = null
    const audioAttentionTick = () => {
      try {
        const kind = detectPendingInteraction()
        if (kind === null) {
          audioAttentionKind = null
          return
        }
        if (kind === audioAttentionKind) return
        audioAttentionKind = kind
        if (!isAudioOn()) return
        reportAttention(kind)
      } catch (e) { /* never let the watcher break the page */ }
    }
    /** Collapse a burst of mutations into one look on the next frame. */
    const audioAttentionSchedule = () => {
      if (audioAttentionFrame !== null) return
      if (typeof requestAnimationFrame !== 'function') {
        audioAttentionTick()
        return
      }
      audioAttentionFrame = requestAnimationFrame(() => {
        audioAttentionFrame = null
        audioAttentionTick()
      })
    }
    const syncAudioAttentionWatch = () => {
      const wanted = isEnabled() && isAudioOn()
      if (wanted && audioAttentionTimer === null && typeof setInterval === 'function') {
        audioAttentionKind = null
        audioAttentionTimer = setInterval(audioAttentionTick, AUDIO_ATTENTION_POLL_MS)
        if (typeof MutationObserver === 'function' && typeof document !== 'undefined' && document.body) {
          audioAttentionObserver = new MutationObserver(audioAttentionSchedule)
          try {
            audioAttentionObserver.observe(document.body, { childList: true, subtree: true })
          } catch (e) {
            audioAttentionObserver = null
          }
        }
        audioAttentionTick()
      } else if (!wanted && audioAttentionTimer !== null) {
        stopAudioAttentionWatch()
      }
    }
    const stopAudioAttentionWatch = () => {
      if (audioAttentionTimer !== null && typeof clearInterval === 'function') clearInterval(audioAttentionTimer)
      audioAttentionTimer = null
      if (audioAttentionObserver !== null) {
        try { audioAttentionObserver.disconnect() } catch (e) { /* already gone */ }
        audioAttentionObserver = null
      }
      if (audioAttentionFrame !== null) {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(audioAttentionFrame)
        audioAttentionFrame = null
      }
      audioAttentionKind = null
    }
    // Exposed so the watcher test can drive the mutation path (the observer's own
    // callback in a browser) without a real MutationObserver.
    module.exports.__attentionCheck = audioAttentionTick
    module.exports.__attentionSchedule = audioAttentionSchedule

    /* ---------- 顶部余额胶囊 ----------
       A fixed capsule at the top center of the frame showing the account
       balance AND the API's peak/off-peak pricing window, styled after the
       Arknights HUD plate: dark pill, currency + big tnum number, a small
       countdown to the next window edge, the elapsed-window percentage pushed
       to the right, and the accent-yellow round badge.

       WHY A HOST ROUTE. Only Host consumers can obtain the request credential
       the account service needs, so the page cannot query the balance itself —
       it polls /theme-arknights/balance (index.js registerBalanceBridge) and
       renders whatever arrives. A failed or empty answer keeps the last known
       numbers on screen instead of flashing an error state; a 60s poll keeps a
       drifted display within a minute of the truth at the cost of one cheap
       local request.

       WHY THE PRICING WINDOW IS COMPUTED LOCALLY. No host service exposes the
       schedule (deepseekAccount carries balance only), and the published rule
       is fixed wall-clock: Beijing time Mon-Fri 9:00-12:00 and 14:00-18:00 are
       PEAK (高峰), everything else — evenings, nights, weekends, statutory
       holidays — is OFF-PEAK (低谷) at half price. The holiday half of that
       sentence needs a calendar, so this file carries one transcribed from the
       State Council notices (BALANCE_HOLIDAY_NOTICES) instead of guessing; the
       capsule says "已过/剩余", not "what you will pay". A 1s tick keeps the
       countdown honest to the second.

       WHY RAW DOM, NOT A SLOT COMPONENT. Every other floating surface in this
       theme (thunder plate, watermark) is a plain fixed element owned by
       lifecycle code this file already has — mount/unmount/sync/reconcile —
       and a slot registration would hand the frame's React tree a component
       that must survive re-roots this theme does not control. The capsule is
       static once painted (only text nodes change), so raw DOM loses nothing.
       It is NOT clickable and NOT interactive: pointer-events:none, like the
       thunder plate, so it can never eat a click aimed at the header behind it. */
    const BALANCE_KEY = 'balanceCapsule'
    const isBalanceCapsuleOn = () => prefsGet(BALANCE_KEY) === '1'
    /* What the credits mode's RIGHT-hand percentage slot reads: 已用xx% (the
       plugin's own badge reading) or 剩余xx%. Anything other than 'remaining'
       reads as 'used' — the preference is a two-literal choice, stored as
       exactly one of them, and the tolerant default mirrors how every other
       two-literal select in this panel reads its stored value. */
    const CREDIT_DISPLAY_KEY = 'creditDisplay'
    const readCreditDisplay = () => (prefsGet(CREDIT_DISPLAY_KEY) === 'used' ? 'used' : 'remaining')
    let balanceEl = null
    let balanceTimer = null
    let balancePollTimer = null
    let balanceBusy = false
    /* ---------- 防遮挡（sidebar 展开 / 鼠标靠近）运行时状态 ----------
       balanceShadeEl 是被监听的布局列（左侧 `_sidebarCol`，靠边停靠时换成
       `_rightbarCol`），null 表示尚未发现或胶囊不在 DOM。观察器只在胶囊存在时
       挂着，destroy 时一并断开。鼠标判定用「指针在胶囊中线 160px 竖带内且不
       高于胶囊顶」——低频 mousemove 上用矩形测试，比逐帧 closest() 便宜。 */
    let balanceSidebarRo = null
    let balanceSidebarMo = null
    let balanceShadeEl = null
    let balanceSidebarOpen = false
    let balanceHoverHide = false
    let balanceHideRaf = 0
    // Non-zero while the brand pose is up: the wall-clock moment it was raised.
    let balanceBootAt = 0
    // Set by the first completed fetch, answer or not.
    let balanceBootAnswered = false
    /* Channel-credit state. `provider` is the provider the LAST successful
       directory read named (null = DeepSeek / unknown -> wallet display);
       `creditsBusy` guards the usage.badge round-trip the way balanceBusy
       guards the wallet fetch; `creditsUnsub` detaches the model-directory
       subscription on destroy. */
    let creditProvider = null
    let creditProviderResolved = false
    let creditsBusy = false
    let creditsUnsub = null
    let creditsRebindTimer = null
    let creditsRebindAttempts = 0
    /* Rate limiting the usage.badge calls. Two refresh paths feed creditsApply
       — the shared 60s poll and every model-directory publish — and without a
       client-side floor both would fire an RPC each time. The host badge cache
       (TTL 120s) would absorb some of it, but the plugin's own badge polls at
       the same endpoint too, so the theme keeps its own 5-minute floor: a
       credit number is a slowly-moving quantity and the capsule is a glance.
       A channel SWITCH bypasses the floor (the number must follow the switch
       immediately); a failed fetch retries after 30s instead of the full
       floor, because failure answers are cached by the host for only 15s. */
    const CREDITS_MIN_INTERVAL_MS = 5 * 60 * 1000
    const CREDITS_FAILURE_RETRY_MS = 30000
    let creditLastFetchAt = 0
    // The directory store currently subscribed; a new session hands us a new
    // store, which is what re-arms the watch in creditsRefresh.
    let creditsWatchedStore = null

    /* Whether the brand pose plays at all. Reduced motion gets the settled
       capsule immediately — the animation is decoration, the balance is not. */
    const isBalanceBootAnimated = () =>
      typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

    /* ---------- 防遮挡：状态合成与观察器 ----------
       胶囊的隐藏态由两个独立原因合成（sidebar 展开有占位条常驻、指针靠近是
       瞬时的），各自带设置页开关：balanceShadeApply() 在落盘前把两个原因
       与各自开关相与，balanceShadeReason() 仍保留「原始原因合成」语义。
       会话与遮挡无关，重新渲染会话时布局列节点可能被 React 重挂——所以
       sidebarCol 缩放突变时由 ResizeObserver 自己重找目标（isConnected 守卫）。 */
    const BALANCE_SIDEBAR_PROBE_ATTR = 'data-ak-balance-sidebar-probe'
    /* 每次判定都重读偏好（isBalanceSidebarHideOn / isBalanceHoverHideOn）：
       设置页的开关是低频写入、判定是低频事件（列宽变化 / mousemove），重读
       让开关即时生效而无需重建胶囊。开关刚关掉时残留的隐藏态由开关处理器
       里的 balanceShadeApply() 同帧清除。 */
    const balanceShadeReason = () => (balanceSidebarOpen || balanceHoverHide ? true : false)
    const balanceShadeApply = () => {
      if (balanceEl === null) return
      const wantHide = (isBalanceSidebarHideOn() && balanceSidebarOpen)
        || (isBalanceHoverHideOn() && balanceHoverHide)
      if (wantHide) balanceEl.setAttribute('data-ak-balance-shade', '')
      else balanceEl.removeAttribute('data-ak-balance-shade')
    }
    /* 在整份 DOM 里找当前布局的侧栏列。两个后缀在客户端 UI 里唯一属于布局
       frame（`_centerCol`/`_sidebarCol`/`_rightbarCol`），位置选择决定盯哪根：
       居中盯左栏（DSH 左栏是常驻 push 布局），靠右盯右栏。 */
    const balanceSidebarSelector = () => {
      const pos = readBalanceCapsulePosition()
      return pos === 'right'
        ? '[class$="_rightbarCol"], [class*="_rightbarCol "]'
        : '[class$="_sidebarCol"], [class*="_sidebarCol "]'
    }
    const balanceFindSidebarCol = () => {
      if (typeof document === 'undefined' || !document.querySelector) return null
      try {
        const nodes = document.querySelectorAll(balanceSidebarSelector())
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i]
          if (node && typeof node.isConnected === 'boolean' ? node.isConnected : true) return node
        }
      } catch (e) { /* selector 引擎不可用时不遮挡判定退化为关闭 */ }
      return null
    }
    /* 列宽是否越过「展开」阈值。收起后的占位列仍有渲染宽度（骨架/图标条），
       所以不能用 >0 判定：只在展开宽度明显大于收起条时才算遮挡。 */
    const BALANCE_SIDEBAR_OPEN_PX = 96
    const balanceShadeSync = () => {
      if (balanceEl === null) return
      let open = false
      if (balanceShadeEl !== null && balanceShadeEl.isConnected !== false) {
        const rect = balanceShadeEl.getBoundingClientRect()
        open = rect.width >= BALANCE_SIDEBAR_OPEN_PX
      }
      if (open !== balanceSidebarOpen) {
        balanceSidebarOpen = open
        balanceShadeApply()
      }
    }
    const balanceWatchSidebar = () => {
      const col = balanceFindSidebarCol()
      if (col === balanceShadeEl) return
      if (balanceSidebarRo !== null) {
        try { balanceSidebarRo.disconnect() } catch (e) { /* already gone */ }
        balanceSidebarRo = null
      }
      if (balanceSidebarMo !== null) {
        try { balanceSidebarMo.disconnect() } catch (e) { /* already gone */ }
        balanceSidebarMo = null
      }
      balanceShadeEl = col
      balanceSidebarOpen = false
      if (col !== null && typeof ResizeObserver === 'function') {
        balanceSidebarRo = new ResizeObserver(() => {
          /* React 重挂列节点后旧引用会脱链——重启监听指向新节点。 */
          if (balanceShadeEl !== null && balanceShadeEl.isConnected === false) {
            balanceWatchSidebar()
            return
          }
          balanceShadeSync()
        })
        try { balanceSidebarRo.observe(col) } catch (e) { balanceSidebarRo = null }
      }
      /* 布局列是惰性挂载的：首帧 querySelector 可能扑空，用 MutationObserver
         盯 body 的子树变化，一旦列出现就换上 ResizeObserver。 */
      if (col === null && balanceEl !== null && typeof MutationObserver === 'function' && typeof document !== 'undefined' && document.body) {
        balanceSidebarMo = new MutationObserver(() => {
          if (balanceEl === null) return
          if (balanceFindSidebarCol() !== null) balanceWatchSidebar()
        })
        try { balanceSidebarMo.observe(document.body, { childList: true, subtree: true }) } catch (e) { balanceSidebarMo = null }
      }
      balanceShadeSync()
    }
    /* 鼠标靠近自动隐藏。pointer-events:none 让胶囊吃不到自己的事件，所以判定
       挂在 window 的 mousemove 上，并用一个共享 rect 的几何测试（中线 ±160px、
       顶向上 8px、底向下 12px 的呼吸余量）。节流到 rAF 一次；离开判定还带
       240ms 的滞回，防止指针在边缘抖动时胶囊闪烁。 */
    const BALANCE_HOVER_HALF_W = 160
    const BALANCE_HOVER_TOP = -8
    const BALANCE_HOVER_BOTTOM = 12
    const BALANCE_HOVER_HYSTERESIS_MS = 240
    let balanceHoverUntil = 0
    const balanceHoverSync = (now) => {
      const hide = now < balanceHoverUntil
      if (hide !== balanceHoverHide) {
        balanceHoverHide = hide
        balanceShadeApply()
      }
    }
    const balanceOnMouseMove = (ev) => {
      if (balanceEl === null) return
      const clientX = ev && typeof ev.clientX === 'number' ? ev.clientX : null
      const clientY = ev && typeof ev.clientY === 'number' ? ev.clientY : null
      if (clientX === null || clientY === null) return
      const rect = balanceEl.getBoundingClientRect()
      if (rect.width <= 0) return
      const inside = clientX >= rect.left + rect.width / 2 - BALANCE_HOVER_HALF_W
        && clientX <= rect.left + rect.width / 2 + BALANCE_HOVER_HALF_W
        && clientY >= rect.top + BALANCE_HOVER_TOP
        && clientY <= rect.bottom + BALANCE_HOVER_BOTTOM
      const now = Date.now()
      if (inside) balanceHoverUntil = now + BALANCE_HOVER_HYSTERESIS_MS
      if (balanceHideRaf !== 0 || typeof cancelAnimationFrame !== 'function') {
        balanceHoverSync(now)
        return
      }
      balanceHideRaf = requestAnimationFrame(() => {
        balanceHideRaf = 0
        balanceHoverSync(Date.now())
      })
    }

    const destroyBalanceCapsule = () => {
      if (balanceTimer !== null && typeof clearInterval === 'function') {
        clearInterval(balanceTimer)
        balanceTimer = null
      }
      if (balancePollTimer !== null && typeof clearInterval === 'function') {
        clearInterval(balancePollTimer)
        balancePollTimer = null
      }
      // Detach the model-directory watch, too: a stale subscriber would keep
      // firing creditsRefresh into a capsule that no longer exists.
      if (typeof creditsUnsub === 'function') {
        try { creditsUnsub() } catch (e) { /* store already gone */ }
      }
      creditsUnsub = null
      if (creditsRebindTimer !== null && typeof clearTimeout === 'function') {
        clearTimeout(creditsRebindTimer)
        creditsRebindTimer = null
      }
      creditProvider = null
      creditProviderResolved = false
      creditsRebindAttempts = 0
      creditsWatchedStore = null
      if (balanceSidebarRo !== null) {
        try { balanceSidebarRo.disconnect() } catch (e) { /* already gone */ }
        balanceSidebarRo = null
      }
      if (balanceSidebarMo !== null) {
        try { balanceSidebarMo.disconnect() } catch (e) { /* already gone */ }
        balanceSidebarMo = null
      }
      balanceShadeEl = null
      balanceSidebarOpen = false
      balanceHoverHide = false
      balanceHoverUntil = 0
      if (balanceHideRaf !== 0 && typeof cancelAnimationFrame === 'function') {
        try { cancelAnimationFrame(balanceHideRaf) } catch (e) { /* already gone */ }
      }
      balanceHideRaf = 0
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        try { window.removeEventListener('mousemove', balanceOnMouseMove) } catch (e) { /* not attached */ }
      }
      if (balanceEl !== null && balanceEl.parentNode) {
        try { balanceEl.parentNode.removeChild(balanceEl) } catch (e) { /* already gone */ }
      }
      balanceEl = null
      balanceBootAt = 0
      balanceBootAnswered = false
    }

    /* One wallet pair -> the capsule's three text values. The balance arrives as
       strings ("12.34"), so the integer part is sliced out of the text rather
       than parsed: parsing would round a partial yuan amount into a lie about
       the user's money, and the screenshot style wants the big integer anyway.
       The fraction is capped at TWO digits — the source can carry more (or the
       bonus split can produce long tails), and a capsule is a glanceable read,
       not a ledger: it shows 29.35, not 29.354285714285714. */
    const balancePickWallet = (wallets) => {
      if (!Array.isArray(wallets) || wallets.length === 0) return null
      const preferred = wallets.find((w) => w && w.currency === 'CNY') || wallets[0]
      const raw = String((preferred && preferred.balance) || '0')
      const num = Number.parseFloat(raw)
      if (!Number.isFinite(num)) return null
      const [intPart, fracPart = ''] = raw.split('.')
      return {
        currency: (preferred && preferred.currency) || '',
        int: intPart || '0',
        frac: fracPart.slice(0, 2),
      }
    }

    const balancePaint = (data) => {
      if (balanceEl === null || typeof document === 'undefined') return
      const setText = (attr, text) => {
        const node = balanceEl.querySelector('[' + attr + ']')
        if (node) node.textContent = text
      }
      setText('data-ak-balance-int', data.int)
      setText('data-ak-balance-frac', data.frac === '' ? '' : '.' + data.frac)
      setText('data-ak-balance-currency', data.currency === 'USD' ? '$' : '¥')
    }

    /* ---------- 渠道额度渲染 (dsh-codearts-auth / jet-hub) ----------
       Two display modes share one capsule. The wallet read above is the
       DeepSeek mode; when the session's model directory names a jet-hub
       provider, the money group swaps to that channel's remaining credits.

       Numbers mirror the plugin's own badge formatting: credits are integers
       or two decimals, token-quantity units compact past 1e3/1e6 (12.34K /
       1.20M), and the unit tag reads 积分 or Token. A FAILED answer paints --
       rather than 0 — a zero would read as "out of quota" and that is a lie
       the user may act on. The badge response carries `provider` back; a
       stale reply for a channel the user already left is dropped, which is
       the only thing keeping a channel switch and an in-flight fetch from
       crossing wires. */
    const creditFormatTokens = (value) => {
      const abs = Math.abs(value)
      if (abs >= 1e6) return (value / 1e6).toFixed(2) + 'M'
      if (abs >= 1e3) return (value / 1e3).toFixed(2) + 'K'
      return String(Math.round(value))
    }
    const creditFormatValue = (value, unit) =>
      (unit === 'token' ? creditFormatTokens(value)
        : (Number.isInteger(value) ? String(value) : value.toFixed(2)))
    const creditUnitLabel = (unit) => (unit === 'token' ? 'Token' : '积分')

    /* The unit tag rides the packages (the account total carries none); any
       package's unit answers for the row. 'credits' normalizes to 'credit' so
       one spelling owns the 积分 branch. */
    const creditPickUnit = (packages) => {
      if (Array.isArray(packages)) {
        for (const pkg of packages) {
          if (pkg && pkg.unit) return (pkg.unit === 'credits' ? 'credit' : pkg.unit)
        }
      }
      return 'credit'
    }

    /* RpcCreditsBalanceAccount[] -> one glanceable number PLUS the consumption
       ratio the right-hand dial shows in credits mode. usage.badge answers one
       row per enabled account; the read is the FIRST account without an
       error. Active packages carry remaining/total/used, so they are summed
       into { total (剩余), quotaTotal (总额度), used (已用), unit } — the
       account-level balance.total is only the fallback when no usable package
       exists, and it carries no quota, so the dial reads no consumption from
       it (an invented percentage would be a lie). */
    const creditPickAccount = (accounts) => {
      if (!Array.isArray(accounts)) return null
      for (const account of accounts) {
        if (!account || typeof account !== 'object' || account.error) continue
        const bal = account.balance
        if (!bal || typeof bal !== 'object') continue
        if (Array.isArray(bal.packages) && bal.packages.length > 0) {
          let total = 0
          let quotaTotal = 0
          let used = 0
          let any = false
          let unit = 'credit'
          for (const pkg of bal.packages) {
            if (!pkg || pkg.active !== true || !Number.isFinite(pkg.remaining)) continue
            any = true
            unit = pkg.unit === 'credits' ? 'credit' : pkg.unit
            total += pkg.remaining
            if (Number.isFinite(pkg.total)) quotaTotal += pkg.total
            if (Number.isFinite(pkg.used)) used += pkg.used
          }
          if (any) return { total, quotaTotal, used, unit }
        }
        if (Number.isFinite(bal.total)) {
          return { total: bal.total, quotaTotal: 0, used: 0, unit: creditPickUnit(bal.packages) }
        }
      }
      return null
    }

    const creditPaint = (paint) => {
      if (balanceEl === null || typeof document === 'undefined') return
      const setText = (attr, text) => {
        const node = balanceEl.querySelector('[' + attr + ']')
        if (node) node.textContent = text
      }
      setText('data-ak-credit-int', paint.int)
      setText('data-ak-credit-unit', paint.unitText)
      setText('data-ak-credit-channel', paint.channel)
      // Consumption read for the right-hand slot in credits mode. The dial's
      // share rides the same --ak-balance-sweep custom property the
      // pricing clock uses, so mode switches never re-layout the pill: the
      // value just changes meaning. No quota (quotaTotal 0) keeps the sweep
      // empty rather than inventing a percentage.
      setText('data-ak-credit-pct', paint.pctText || '')
      // The ring sweep follows the slot's meaning: 已用xx% sweeps the consumed
      // share, 剩余xx% sweeps the remaining share — dial and readout always
      // tell the same story. (The wallet pricing clock early-returns in
      // credits mode, so this property is ours to write here.)
      if (typeof balanceEl.style?.setProperty === 'function') {
        balanceEl.style.setProperty(
          '--ak-balance-sweep',
          (Number.isFinite(paint.sweepPct) ? paint.sweepPct * 3.6 : 0) + 'deg',
        )
      }
      // The two modes are mutually exclusive DOM states driven by one attribute
      // the stylesheet keys off — no inline style writes, no per-poll churn.
      balanceEl.setAttribute('data-ak-credit-mode', paint.mode)
    }

    /* The capsule paints ONE mode at a time. 'wallet' keeps the DeepSeek
       money group; 'credits' swaps in the channel read; while a jet-hub
       provider is live but has not answered yet the capsule shows the channel
       name with -- rather than yesterday's wallet number under a different
       channel's name. Consumption reads need a quota: without one the pct
       slot stays empty and the dial sweep is zeroed, never guessed. */
    const creditPaintIdle = () => {
      if (creditProvider === null) {
        creditPaint({ mode: 'wallet', int: '', unitText: '', channel: '', pctText: '', usedPct: NaN, sweepPct: NaN })
        return
      }
      creditPaint({
        mode: 'credits',
        int: '--',
        unitText: '',
        channel: JET_HUB_PROVIDER_LABELS[creditProvider] || creditProvider,
        pctText: '',
        usedPct: NaN,
        sweepPct: NaN,
      })
    }

    /* Fetch the badge for `provider` and paint it, unless the user has switched
       channels in the meantime (the reply's provider echo guards the race the
       same way the plugin's own badge does). The consumption share for the
       right-hand dial is used/quota of the SAME account the number comes from;
       with no quota the pct slot stays empty and the sweep zeroes.
       RATE LIMIT. `force` (a channel switch) always fetches; the throttled
       path keeps a per-provider floor of CREDITS_MIN_INTERVAL_MS measured from
       the last COMPLETED fetch of that provider, so the 60s poll and the
       directory-publish path collapse onto one actual RPC per interval. The
       state is per-provider because switching A -> B -> A within one floor
       must still answer the second A visit with a fetch (its own stamp is old
       and the painted numbers belong to B). Failures re-arm at the shorter
       CREDITS_FAILURE_RETRY_MS — the host caches failure answers for only 15s,
       so a longer floor would just add silence after a transient error. */
    const creditLastFetch = {}
    const creditsApply = async (provider, force) => {
      if (creditsBusy) return
      let connection = null
      try { connection = ctx.get('connection') } catch (e) { connection = null }
      if (!connection || !connection.rpc || typeof connection.rpc.call !== 'function') return
      if (force !== true) {
        const last = creditLastFetch[provider] || 0
        if (Date.now() - last < CREDITS_MIN_INTERVAL_MS) return
      }
      creditsBusy = true
      let failed = false
      try {
        const payload = force === true ? { provider, force: true } : { provider }
        const reply = await connection.rpc.call(JET_HUB_RPC_SCOPE, JET_HUB_RPC_CHANNEL, {
          method: 'usage.badge',
          payload,
        })
        // Stale reply: the channel moved on while this was in flight.
        if (creditProvider !== provider) return
        if (!reply || reply.ok !== true) throw new Error('usage.badge not ok')
        const value = reply.value && typeof reply.value === 'object' ? reply.value : reply
        if (value.provider !== provider) return
        creditLastFetch[provider] = Date.now()
        const picked = creditPickAccount(value.accounts)
        // Consumption: 已用 / 总额度, from the summed active packages. Both
        // bounds must be sane or the dial refuses to speak (0 quota, more used
        // than granted, negative anything -> no invented percentage).
        let usedPct = NaN
        if (picked && picked.quotaTotal > 0 && picked.used >= 0
          && picked.used <= picked.quotaTotal) {
          usedPct = Math.min(100, Math.round((picked.used / picked.quotaTotal) * 100))
        }
        // Remaining share for the right-hand slot's 剩余xx% read: the same
        // sanity bounds, mirrored — the share of quota still left.
        let remainingPct = NaN
        if (usedPct === usedPct) remainingPct = 100 - usedPct
        // The RIGHT-hand slot is what the user chooses: 已用xx% (the plugin's
        // own badge reading) or 剩余xx% (remaining share of the quota). Both
        // come from the SAME summed account; the lead figure on the left
        // always stays the remaining balance. The dial sweeps the SAME share
        // the slot reads, so ring and number never disagree. 'remaining'
        // needs a quota too — a share of nothing is not a number — so without
        // one the slot stays empty and the sweep zeroes either way.
        const displayUsed = readCreditDisplay() === 'used'
        creditPaint({
          mode: 'credits',
          int: picked ? creditFormatValue(picked.total, picked.unit) : '--',
          unitText: picked ? creditUnitLabel(picked.unit) : '',
          channel: JET_HUB_PROVIDER_LABELS[provider] || provider,
          pctText: Number.isFinite(displayUsed ? usedPct : remainingPct)
            ? (displayUsed ? '已用' : '剩余') + (displayUsed ? usedPct : remainingPct) + '%'
            : '',
          usedPct,
          sweepPct: displayUsed ? usedPct : remainingPct,
        })
      } catch (e) {
        failed = true
        // Plugin absent, not logged in, or channel down: -- is the honest read.
        if (creditProvider === provider) {
          creditPaint({
            mode: 'credits',
            int: '--',
            unitText: '',
            channel: JET_HUB_PROVIDER_LABELS[provider] || provider,
            pctText: '',
            usedPct: NaN,
            sweepPct: NaN,
          })
        }
      } finally {
        if (failed) {
          // Re-arm early after a failure: the host only caches the failure
          // answer for 15s, so the next poll (or publish) should be allowed
          // to retry instead of sitting out the whole floor.
          creditLastFetch[provider] = Date.now() - CREDITS_MIN_INTERVAL_MS + CREDITS_FAILURE_RETRY_MS
        }
        creditsBusy = false
      }
    }

    /* Which jet-hub provider the CURRENT session is on, if any. Same lazy
       resolution contract as thunder: the theme declares no inject, so every
       service arrives late and each read must re-get it. The model directory
       is resolved per session id (directoryFor), loaded once (a directory that
       has never been loaded carries no `current`), and subscribed so a channel
       switch mid-session repaints the capsule without waiting for the poll. */
    const creditsRefresh = async (force) => {
      if (balanceEl === null) return
      let sessions = null
      try { sessions = ctx.get('sessions') } catch (e) { sessions = null }
      if (!sessions || !sessions.list || typeof sessions.list.getSnapshot !== 'function') return
      let snap = null
      try { snap = sessions.list.getSnapshot() } catch (e) { snap = null }
      const id = snap ? thunderCurrentId(snap) : undefined
      if (id === undefined || id === null) {
        if (creditProvider !== null) { creditProvider = null; creditPaintIdle() }
        return
      }
      let directories = null
      try { directories = ctx.get('modelDirectories') } catch (e) { directories = null }
      if (!directories || typeof directories.directoryFor !== 'function') return
      let directory = null
      try { directory = directories.directoryFor(id) } catch (e) { directory = null }
      if (!directory || !directory.store) return
      // Watch each directory's store exactly once: a session switch hands us a
      // new directory object, which is what re-arms the subscription here.
      if (creditsWatchedStore !== directory.store) {
        if (typeof creditsUnsub === 'function') { try { creditsUnsub() } catch (e) { /* gone */ } }
        creditsUnsub = null
        creditsWatchedStore = directory.store
        if (typeof directory.store.subscribe === 'function') {
          try {
            creditsUnsub = directory.store.subscribe(() => { creditsRebind() })
          } catch (e) { creditsUnsub = null }
        }
      }
      if (typeof directory.load === 'function') {
        try { await directory.load() } catch (e) { /* unreadable: fall through to snapshot */ }
      }
      let state = null
      try { state = directory.store.getSnapshot() } catch (e) { state = null }
      const provider = state && state.current ? state.current.provider : undefined
      const next = (typeof provider === 'string' && JET_HUB_PROVIDER_LABELS[provider] !== undefined)
        ? provider
        : null
      if (next !== creditProvider || (next !== null && !creditProviderResolved)) {
        creditProvider = next
        creditProviderResolved = next !== null
        creditPaintIdle()
      }
      // A switch (force, from the store subscription) bypasses the rate
      // floor so the read follows the channel immediately; the 60s poll
      // passes force=false and is throttled by creditsApply.
      if (next !== null) await creditsApply(next, force === true)
    }

    /* Store events land here; a channel flip re-reads the directory and
       repaints. Debounced so a burst of publishes collapses into one read.
       The debounce itself is also the switch detector: if the provider the
       delayed read resolves differs from the one painted, the fetch is
       forced — ordinary publishes (balance churn, model-list updates) keep
       the throttle. */
    const creditsRebind = () => {
      if (balanceEl === null) return
      if (creditsRebindTimer !== null && typeof clearTimeout === 'function') clearTimeout(creditsRebindTimer)
      creditsRebindTimer = null
      if (typeof setTimeout !== 'function') { creditsRefresh(true); return }
      creditsRebindTimer = setTimeout(() => {
        creditsRebindTimer = null
        creditsRefresh(true)
      }, 150)
    }

    /* First resolve races the boot pose; a bounded retry covers the model
       service arriving late, mirroring the thunder budget. */
    const creditsStart = () => {
      creditsRebindAttempts = 0
      const attempt = () => {
        if (balanceEl === null) return
        let sessions = null
        try { sessions = ctx.get('sessions') } catch (e) { sessions = null }
        if (sessions === undefined || sessions === null) {
          creditsRebindAttempts += 1
          if (creditsRebindAttempts <= 100 && typeof setTimeout === 'function') {
            creditsRebindTimer = setTimeout(attempt, 120)
          }
          return
        }
        creditsRefresh()
      }
      attempt()
    }

    /* ======================================================================
     * 悬浮阵营条 —— 三套阵营的常驻快速入口
     *
     * 这是本主题自己新增的唯一常驻 DOM（其余界面全部由样式表覆盖）。位置在
     * 右上角，显示当前阵营的徽标与名字，点开是三选；键盘 Ctrl/Cmd+Shift+1/2/3
     * 直选、Ctrl/Cmd+Shift+K 循环。设置页里的三张卡片是另一个入口，两者写的是
     * 同一个偏好字段，所以任何一处切换都会同步另一处。
     *
     * 为什么值得单独做：阵营是一个会反复切换的偏好（配色与版式都不同，适合按当前
     * 任务切换心境），而「打开设置 → 找到主题页 → 点卡片」这条路走三次就烦了。
     *
     * 无障碍：整条是 role="group" 容器，每个阵营是 aria-pressed 的切换按钮，当前
     * 态同时用徽标文字与颜色表达，所以不依赖色觉判断。
     * ==================================================================== */
    const FACTION_BAR_KEY = 'dsh-theme-arknights-faction-bar'

    /* 阵营元数据。这里不放颜色：真正生效的配色全部在样式表的六组 --edge-* 规则
       里，悬浮条与设置页只出形状（.ak-crest 走 currentColor）。在 JS 里再抄一份
       色值只会和样式表悄悄分叉——上一次就是这样，色块显示的是暖金与青绿，而界面
       实际给的是电光蓝与单色。hint 描述的是选完之后真的能看到的东西。 */
    const FACTION_META = [
      {
        id: 'rhodes',
        badge: 'R.I.',
        nav: { zh: '罗德岛', en: 'Rhodes Island' },
        hint: { zh: '舰船指挥 · 冷蓝网格', en: 'Ship command · cold blue mesh' },
        keys: '1',
      },
      {
        id: 'laterano',
        badge: 'LTR',
        nav: { zh: '拉特兰', en: 'Laterano' },
        hint: { zh: '圣城 · 电光蓝图纸', en: 'Holy city · electric-blue blueprint' },
        keys: '2',
      },
      {
        id: 'rhine',
        badge: 'R.L',
        nav: { zh: '莱茵生命', en: 'Rhine Lab' },
        hint: { zh: '实验室 · 单色结构', en: 'Laboratory · mono structure' },
        keys: '3',
      },
    ]

    /* 设置页重画钩子：51-settings-page 挂载后把它指向自己的重画函数；没有面板时
       保持 null。**声明必须排在 setFaction 之前**，否则 setFaction 第一次运行时
       会在 `let` 的暂时性死区里撞上 ReferenceError（typeof 不保护 let/const）。 */
    let akSyncSettingsPanel = null

    /* 进阶版终端层的即时重绘钩子（36-terminal-ui 挂载后赋值）。与设置页钩子
       同理，声明必须排在 setFaction 之前。 */
    let akTerminalRepaint = null

    const factionMetaOf = (id) => {
      for (const meta of FACTION_META) if (meta.id === id) return meta
      return FACTION_META[0]
    }

    /* 语言：只读 navigator，不声明 locale 命名空间——一个声明了命名空间却没有
       装 face 的 entry 会让插槽装配直接抛错，把「设置页是中文」变成「设置页崩掉」。 */
    const akIsZh = () => {
      try {
        const lang = String(navigator.language || navigator.userLanguage || 'en').toLowerCase()
        return lang.indexOf('zh') === 0
      } catch (e) { return false }
    }
    const akPick = (pair) => (akIsZh() ? pair.zh : pair.en)

    /** 切到指定阵营。写偏好 → 应用 class → 刷新两处 UI。
     *  prefsSet 刻意不 emit（见 14-durable-gate 里 prefsCommit 的注释），所以这里
     *  自己把「应用」这一步做掉，不能让界面等宿主的回显。 */
    const setFaction = (id) => {
      const target = factionMetaOf(id)
      prefsSet(FACTION_KEY, target.id)
      syncFactionClass()
      paintFactionBar()
      try { if (akSyncSettingsPanel !== null) akSyncSettingsPanel() } catch (e) { /* 面板没开 */ }
      try { if (akTerminalRepaint !== null) akTerminalRepaint() } catch (e) { /* 终端层未挂载 */ }
      return target
    }

    /** 循环到下一套阵营，顺序按 FACTION_META 声明。 */
    const cycleFaction = () => {
      const current = readFaction()
      let index = 0
      for (let i = 0; i < FACTION_META.length; i += 1) if (FACTION_META[i].id === current) index = i
      return setFaction(FACTION_META[(index + 1) % FACTION_META.length].id)
    }

    /* ---- 键盘 ------------------------------------------------------------
       Ctrl/Cmd+Shift+数字直选，Ctrl/Cmd+Shift+K 循环。三条约束：
         1. 带 Shift —— 避开浏览器自己的 Ctrl+1..9 切标签页；
         2. 不碰 Alt —— 避开 Windows 的 Alt 菜单键序列；
         3. 别人已经 preventDefault 过就让位 —— 另一个插件先声明同一组合时不该
            两个一起响应。
       主题关掉时不响应：一个已关闭的主题不该还在偷按键。 */
    const akOnKeydown = (event) => {
      if (!isEnabled()) return
      if (!(event.ctrlKey || event.metaKey)) return
      if (!event.shiftKey) return
      if (event.altKey) return
      if (event.defaultPrevented) return
      const key = String(event.key || '').toLowerCase()
      if (key === 'k') {
        event.preventDefault()
        cycleFaction()
        return
      }
      for (const meta of FACTION_META) {
        if (key === meta.keys) {
          event.preventDefault()
          setFaction(meta.id)
          return
        }
      }
    }

    /* ---- DOM ------------------------------------------------------------ */
    let factionBarRoot = null
    /* 默认收起：这是一层压在内容右上角的浮层，展开时三行会盖住第一条消息的尾部。
       收起后只剩当前阵营一行 + 一个 ▾，切换仍然一次点击到位（▾ → 三选）。 */
    let factionBarOpen = false
    let factionBarKeysBound = false

    const bindFactionKeys = () => {
      if (factionBarKeysBound) return
      if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return
      document.addEventListener('keydown', akOnKeydown)
      factionBarKeysBound = true
    }

    const unbindFactionKeys = () => {
      if (!factionBarKeysBound) return
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('keydown', akOnKeydown)
      }
      factionBarKeysBound = false
    }

    const buildFactionBar = () => {
      if (factionBarRoot !== null) return
      if (typeof document === 'undefined' || document.body === null) return

      const root = document.createElement('div')
      root.className = 'ak-bar'
      root.setAttribute('role', 'group')
      root.setAttribute('aria-label', akIsZh() ? '明日方舟阵营主题' : 'Arknights faction theme')

      const current = document.createElement('button')
      current.type = 'button'
      current.className = 'ak-bar__current'
      current.addEventListener('click', () => {
        factionBarOpen = !factionBarOpen
        paintFactionBar()
      })

      const crest = document.createElement('span')
      crest.className = 'ak-crest'
      crest.setAttribute('data-ak-crest', readFaction())
      crest.setAttribute('aria-hidden', 'true')
      const badge = document.createElement('span')
      badge.className = 'ak-bar__badge'
      const label = document.createElement('span')
      label.className = 'ak-bar__label'
      const caret = document.createElement('span')
      caret.className = 'ak-bar__caret'
      caret.textContent = '\u25be'
      current.appendChild(crest)
      current.appendChild(badge)
      current.appendChild(label)
      current.appendChild(caret)

      const list = document.createElement('div')
      list.className = 'ak-bar__list'
      for (const meta of FACTION_META) {
        const item = document.createElement('button')
        item.type = 'button'
        item.className = 'ak-bar__item'
        item.setAttribute('data-faction', meta.id)
        item.title = akPick(meta.hint) + '  \u00b7  Ctrl+Shift+' + meta.keys
        item.addEventListener('click', () => setFaction(meta.id))

        const crest = document.createElement('span')
        crest.className = 'ak-crest'
        crest.setAttribute('data-ak-crest', meta.id)
        crest.setAttribute('aria-hidden', 'true')
        const text = document.createElement('span')
        text.className = 'ak-bar__badge'
        text.textContent = meta.badge

        item.appendChild(crest)
        item.appendChild(text)
        list.appendChild(item)
      }

      root.appendChild(current)
      root.appendChild(list)
      document.body.appendChild(root)
      factionBarRoot = root
      paintFactionBar()
    }

    /** 把当前状态画到阵营条上：纯读状态 → 写属性。 */
    const paintFactionBar = () => {
      if (factionBarRoot === null) return
      if (!isEnabled() || prefsGet(FACTION_BAR_KEY) === '0') {
        factionBarRoot.style.display = 'none'
        return
      }
      factionBarRoot.style.display = ''
      const meta = factionMetaOf(readFaction())
      factionBarRoot.setAttribute('data-open', factionBarOpen ? 'true' : 'false')

      /* 当前态徽标只有一份 DOM，切换阵营时要跟着换形状；下拉那三枚按 meta.id
         各自固定，不需要重画。用 .ak-bar__current 限定：badge 在两边同名，
         而 querySelector 只会命中文档序第一个，把作用域写清楚免得以后调换
         结构时悄悄改错元素。 */
      const crest = factionBarRoot.querySelector('.ak-bar__current .ak-crest')
      const badge = factionBarRoot.querySelector('.ak-bar__badge')
      const label = factionBarRoot.querySelector('.ak-bar__label')
      if (crest !== null) crest.setAttribute('data-ak-crest', meta.id)
      if (badge !== null) badge.textContent = meta.badge
      if (label !== null) label.textContent = akPick(meta.nav)

      for (const item of factionBarRoot.querySelectorAll('.ak-bar__item')) {
        const pressed = item.getAttribute('data-faction') === meta.id
        item.setAttribute('aria-pressed', pressed ? 'true' : 'false')
      }
    }

    const destroyFactionBar = () => {
      unbindFactionKeys()
      if (factionBarRoot === null) return
      if (factionBarRoot.parentNode !== null) factionBarRoot.parentNode.removeChild(factionBarRoot)
      factionBarRoot = null
    }

    /** 偏好/开关变化后的统一入口：该建的建、该藏的藏、该重画的重画。
     *  键盘监听与阵营条解耦：即使把悬浮条关掉，快捷键仍然可用（它是另一个
     *  快速入口，不该被一个显示开关连带禁用）。 */
    const syncFactionBar = () => {
      if (!isEnabled()) {
        destroyFactionBar()
        return
      }
      bindFactionKeys()
      if (prefsGet(FACTION_BAR_KEY) === '0') {
        if (factionBarRoot !== null) factionBarRoot.style.display = 'none'
        return
      }
      buildFactionBar()
      paintFactionBar()
    }

    /* ======================================================================
     * 终端界面层 —— 进阶版的「作战终端」
     *
     * 进阶版不再只是换颜色：侧栏顶部有一块 PRTS 铭牌，工作区列表变成
     * 「终端作战位置」，空状态的工作区选择器被包进同名的作战位置面板，
     * 打开工作区菜单时顶部会出现一块部署控制抬头，每一项带扇区编号。
     *
     * 为什么这些必须由 JS 做、而不是纯 CSS：
     *   工作区菜单是 portaled 的，只有打开时才存在；侧栏列表会被应用反复
     *   重渲染；工作区数量与当前选中项都是运行时数据。伪元素拿不到这些，
     *   所以这一层只做「结构标注 + 少量装饰节点」，颜色、边框、排版仍然
     *   全部交给样式表。每个扫描动作都是幂等的，应用重绘后重新标注即可。
     *
     * 所有注入节点都带 .ak-* 类与 data-ak-tui 标记，卸载时一并收回；
     * 原生节点上的标记也全部清掉，所以关掉主题后页面回到应用原样。
     * ==================================================================== */

    const TERMINAL_META = {
      rhodes: {
        sector: '01',
        code: 'R.I.',
        en: 'RHODES ISLAND',
        zh: '罗德岛',
        roleEn: 'SHIP COMMAND TERMINAL',
        status: 'LINK ESTABLISHED',
        freq: '121.5',
        channel: 'PRTS // RHODES ISLAND COMMAND',
        position: '舰船指挥终端',
      },
      laterano: {
        sector: '02',
        code: 'LTR',
        en: 'LATERANO',
        zh: '拉特兰',
        roleEn: 'CIVITAS GEOMETRY TERMINAL',
        status: 'AXIOM LINK STABLE',
        freq: '144.0',
        channel: 'LATERANO // AXIOM CHANNEL',
        position: '圣城数理终端',
      },
      rhine: {
        sector: '03',
        code: 'R.L',
        en: 'RHINE LAB',
        zh: '莱茵生命',
        roleEn: 'RESEARCH ANALYSIS OS',
        status: 'ANALYSIS ONLINE',
        freq: '88.6',
        channel: 'RHINE LAB // ANALYSIS OS',
        position: '研究分析终端',
      },
    }

    const terminalMeta = () => TERMINAL_META[readFaction()] || TERMINAL_META.rhodes
    const terminalPad = (n) => (n < 10 ? '0' + n : String(n))

    /* ---- 终端用词（按界面版本取，不按阵营） ------------------------------
       advanced 说的是明日方舟自己的话（PRTS / SECTOR / 终端作战位置），lab 说的是
       参考项目那套音乐终端的话（RHINE / TRACK / 终端工作位置）。两档共用同一批
       注入节点和同一批 data-ak-part 槽位，所以差别只落在字面上：词表按档位取，
       每次扫描重写一遍——切档不需要重建 DOM，重建才是闪烁的来源。

       阵营词（TERMINAL_META）继续负责身份（R.I. / LTR / R.L、频道号），词表只负
       管「怎么称呼这块面板」。两者正交，所以切阵营不用动词表、切档位不用动颜色。

       这里是唯一一处两档共用文案的地方：写进 buildX 的 innerHTML 只是首帧默认值
       （advanced 那份），paintX 会立刻按当前档位改写。 */
    const TERMINAL_WORDS = {
      advanced: {
        deckBrand: 'PRTS',
        deckLabel: 'SECTOR<br>COMMAND',
        headChannel: 'PRTS <b>//</b> DEPLOYMENT',
        headTitle: '终端作战位置',
        headMeta: 'TERMINAL DEPLOYMENT POSITION',
        footChannel: 'PRTS <b>//</b> OPERATIONS LEDGER',
        menuChannel: 'PRTS <b>//</b> DEPLOYMENT CONTROL',
        menuTitle: '终端作战位置',
        menuSub: 'TERMINAL DEPLOYMENT POSITION',
        /* 编号前缀与计数单位不在 data-ak-part 槽位里（它们是拼接出来的一行字），
           所以单独列出来由 paint 拼。 */
        sectorPrefix: 'SECTOR ',
        sectorUnit: ' SECTORS',
        positionUnit: ' POSITIONS',
        /* 大读数的标签与键位提示：进阶版说的是「一条纵向列表 + 部署」，莱茵终端
           档说的是「一列一列的档案板 + 换列／选块」。同一批槽位，两种读法。 */
        readoutLabel: 'SECTOR',
        keysHint: '↑ ↓ 浏览 · ENTER 部署',
        blockLabel: 'SESSION',
      },
      lab: {
        deckBrand: 'RHINE',
        deckLabel: 'TRACK<br>SELECT',
        headChannel: 'RHINE <b>//</b> LIBRARY',
        headTitle: '终端工作位置',
        headMeta: 'WORKSPACE POSITION',
        footChannel: 'RHINE <b>//</b> PLAYBACK LEDGER',
        menuChannel: 'RHINE <b>//</b> LIBRARY CONTROL',
        menuTitle: '终端工作位置',
        menuSub: 'TERMINAL WORKSPACE POSITION',
        sectorPrefix: 'TRACK ',
        sectorUnit: ' TRACKS',
        positionUnit: ' TRACKS',
        readoutLabel: 'COLUMN',
        keysHint: '← → 换列 · ↑ ↓ 选块',
        blockLabel: 'BLOCK',
      },
    }
    const terminalWords = () => (readLayout() === 'lab' ? TERMINAL_WORDS.lab : TERMINAL_WORDS.advanced)

    const akSetAttr = (el, name, value) => {
      if (el !== null && el !== undefined && el.getAttribute(name) !== value) el.setAttribute(name, value)
    }
    const akSetText = (el, text) => {
      if (el !== null && el !== undefined && el.textContent !== text) el.textContent = text
    }
    /* 词表里的 <b> 是给样式表的重音槽位，所以这几个节点写 innerHTML。
       写进去的永远是上面那张字面量表，不含任何用户或模型文本。 */
    const akSetHtml = (el, html) => {
      if (el !== null && el !== undefined && el.innerHTML !== html) el.innerHTML = html
    }
    const akSetWords = (root, words) => {
      if (root === null || root === undefined) return
      for (const key of Object.keys(words)) {
        const value = words[key]
        const node = root.querySelector('[data-ak-part="' + key + '"]')
        if (node === null) continue
        if (value.indexOf('<') === -1) akSetText(node, value)
        else akSetHtml(node, value)
      }
    }
    const akMark = (el, role) => {
      if (el !== null && el !== undefined) akSetAttr(el, 'data-ak-tui', role)
    }

    let terminalObserver = null
    let terminalScanTimer = null
    let terminalDeckEl = null
    let terminalSectorHeadEl = null
    let terminalFooterEl = null
    let terminalMenuRoots = null
    /* 用户在柜面上点了哪一格。点击目录行只展开会话，并不会把工作区设成
       当前部署；柜面需要把这个「正在浏览」的目录也当成当前格，否则点了
       没有视觉回应、展开出来的会话也还在墙下看不见。 */
    let terminalOpenedKey = ''
    /* 已经为用户滚到过会话区的那一格。柜面矮的时候（768px 高的窗口只剩
       两百来像素）会话方块排在全部工作区板之后，不滚就永远在视口外；但每
       次扫描都滚会和用户自己拖动滚动条打架，所以只对「刚点开的这一格」滚
       一次。 */
    let terminalRevealedKey = ''
    let terminalTipEl = null
    let sectorTipBound = false

    /* 只关心会改变终端结构的区域：侧栏、空状态输入区、打开中的菜单。
       流式输出会持续改消息 DOM，把它排除掉，观察器就不必为每个 token
       排一次扫描。 */
    const TERMINAL_LIVE = '[data-slot="sidebar"], [data-slot="conversation.composer"], [class*="_composerHero"], [role="menu"]'

    const isTerminalElement = (node) => {
      if (node === null || node === undefined || node.nodeType !== 1) return false
      try {
        if (node.matches(TERMINAL_LIVE)) return true
        return node.closest(TERMINAL_LIVE) !== null || node.querySelector(TERMINAL_LIVE) !== null
      } catch (e) { return false }
    }

    const scheduleTerminalScan = (delay) => {
      if (terminalScanTimer !== null && typeof clearTimeout === 'function') clearTimeout(terminalScanTimer)
      terminalScanTimer = setTimeout(() => {
        terminalScanTimer = null
        paintTerminalUI()
      }, delay === undefined ? 120 : delay)
    }

    /* 拖窗口不产生 DOM 变更，MutationObserver 不会响；而柜面一矮，托盘与档案板
       的尺寸就得重算，否则板又会被托盘压掉半块。 */
    let cabinetResizeBound = false
    const bindCabinetResize = () => {
      if (cabinetResizeBound) return
      if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return
      cabinetResizeBound = true
      window.addEventListener('resize', () => {
        if (!isEnabled() || !isTerminalLayout()) return
        scheduleTerminalScan(160)
      })
    }

    const bindTerminalObserver = () => {
      if (terminalObserver !== null) return
      if (typeof MutationObserver === 'undefined' || typeof document === 'undefined' || document.body === null) return
      terminalObserver = new MutationObserver((records) => {
        if (!isEnabled() || !isTerminalLayout()) return
        for (const record of records) {
          if (record.type === 'attributes') {
            if (isTerminalElement(record.target)) {
              scheduleTerminalScan()
              return
            }
            continue
          }
          if (isTerminalElement(record.target)) {
            scheduleTerminalScan()
            return
          }
          for (const node of record.addedNodes) {
            if (isTerminalElement(node)) {
              scheduleTerminalScan()
              return
            }
          }
        }
      })
      terminalObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'aria-expanded', 'aria-selected', 'aria-checked', 'aria-current', 'data-state'],
      })
    }

    /* ---- 侧栏铭牌 --------------------------------------------------------
       一块真正的 HUD 铭牌，而不是伪元素里的两行字：扇区号、阵营字标、
       链路状态和信号格都在这里，切阵营时只改文本与属性，不重建节点。 */
    const buildTerminalDeck = () => {
      const deck = document.createElement('div')
      deck.className = 'ak-terminal-deck'
      deck.setAttribute('data-ak-tui', 'deck')
      deck.setAttribute('aria-hidden', 'true')
      deck.innerHTML =
        '<div class="ak-terminal-deck__top">' +
          '<span class="ak-terminal-deck__prts"><span data-ak-part="deckBrand">PRTS</span> <b>//</b> <span data-ak-part="code">R.I.</span></span>' +
          '<span class="ak-terminal-deck__status"><i></i><span data-ak-part="status">LINK ESTABLISHED</span></span>' +
        '</div>' +
        '<div class="ak-terminal-deck__main">' +
          '<span class="ak-terminal-deck__sector" data-ak-part="sector">01</span>' +
          '<span class="ak-terminal-deck__sectorLabel" data-ak-part="deckLabel">SECTOR<br>COMMAND</span>' +
          '<span class="ak-terminal-deck__ident">' +
            '<span class="ak-terminal-deck__en" data-ak-part="en">RHODES ISLAND</span>' +
            '<span class="ak-terminal-deck__zh" data-ak-part="zh">罗德岛</span>' +
          '</span>' +
        '</div>' +
        '<div class="ak-terminal-deck__bottom">' +
          '<span data-ak-part="roleEn">SHIP COMMAND TERMINAL</span>' +
          '<span class="ak-terminal-deck__signal" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
          '<span class="ak-terminal-deck__freq">CH <b data-ak-part="freq">121.5</b></span>' +
        '</div>'
      return deck
    }

    const paintTerminalDeck = (deck) => {
      const meta = terminalMeta()
      deck.querySelectorAll('[data-ak-part]').forEach((part) => {
        const key = part.getAttribute('data-ak-part')
        if (meta[key] !== undefined) akSetText(part, meta[key])
      })
      akSetWords(deck, terminalWords())
      const channel = deck.querySelector('[data-ak-part="channel"]')
      if (channel !== null) akSetText(channel, meta.channel)
      deck.setAttribute('data-faction', readFaction())
    }

    /* ---- 终端作战位置 ----------------------------------------------------
       侧栏工作区列表上方的一块部署抬头。它跟随群组重渲染，所以每次
       扫描都要确认它仍然紧贴 sectionHeader。

       底部那行大读数（「COLUMN 01 / 04」+ 键位提示）是参考项目里「当前第几列 /
       共几列」那块硬件计数器的对应物：数字永远比标签大、分母永远比分子小，
       所以三个值各占一个槽位，由样式表分派字号，而不是拼成一串等宽文本。 */
    const buildSectorHead = () => {
      const head = document.createElement('div')
      head.className = 'ak-terminal-sector-head'
      head.setAttribute('data-ak-tui', 'sector-head')
      head.setAttribute('aria-hidden', 'true')
      head.innerHTML =
        '<div class="ak-terminal-sector-head__top">' +
          '<span data-ak-part="headChannel">PRTS <b>//</b> DEPLOYMENT</span>' +
          '<span data-ak-part="count">00 SECTORS</span>' +
        '</div>' +
        '<div class="ak-terminal-sector-head__title" data-ak-part="headTitle">终端作战位置</div>' +
        '<div class="ak-terminal-sector-head__meta">' +
          '<span data-ak-part="headMeta">TERMINAL DEPLOYMENT POSITION</span>' +
          '<span class="ak-terminal-sector-head__live"><i></i>SELECT</span>' +
        '</div>' +
        '<div class="ak-terminal-sector-head__readout">' +
          '<span class="ak-terminal-sector-head__roLabel" data-ak-part="readoutLabel">SECTOR</span>' +
          '<span class="ak-terminal-sector-head__roActive" data-ak-part="readoutActive">01</span>' +
          '<i class="ak-terminal-sector-head__roSlash">/</i>' +
          '<span class="ak-terminal-sector-head__roTotal" data-ak-part="readoutTotal">00</span>' +
          '<span class="ak-terminal-sector-head__keys" data-ak-part="keysHint">↑ ↓ 浏览 · ENTER 部署</span>' +
        '</div>' +
        '<div class="ak-terminal-sector-head__plate" data-ak-part="plate"></div>'
      return head
    }

    /* ---- 终端页脚 --------------------------------------------------------
       只在空状态出现：底部一条很细的作战记录带，把主区下半部分从留白变成
       「终端还在运行」的证据。进入对话后自动收回，不去挤输入区。 */
    const buildTerminalFooter = () => {
      const foot = document.createElement('div')
      foot.className = 'ak-terminal-footer'
      foot.setAttribute('data-ak-tui', 'footer')
      foot.setAttribute('aria-hidden', 'true')
      foot.innerHTML =
        '<span class="ak-terminal-footer__rule"></span>' +
        '<span data-ak-part="footChannel">PRTS <b>//</b> OPERATIONS LEDGER</span>' +
        '<span class="ak-terminal-footer__sector" data-ak-part="sector">SECTOR 01</span>' +
        '<span data-ak-part="footerLink">CH 121.5 · LINK ESTABLISHED</span>' +
        '<span class="ak-terminal-footer__rule"></span>'
      return foot
    }

    const paintTerminalFooter = (sector) => {
      if (terminalFooterEl === null) return
      const meta = terminalMeta()
      const words = terminalWords()
      akSetWords(terminalFooterEl, words)
      akSetText(terminalFooterEl.querySelector('[data-ak-part="sector"]'), words.sectorPrefix + sector)
      akSetText(terminalFooterEl.querySelector('[data-ak-part="footerLink"]'), 'CH ' + meta.freq + ' · ' + meta.status)
    }

    /* ---- 工作区菜单抬头 --------------------------------------------------
       菜单是 portal，打开时才存在，关闭后节点直接被应用移除；所以抬头
       完全跟着菜单的生命周期走，不在 body 上另建浮动层。 */
    const buildMenuHead = () => {
      const head = document.createElement('div')
      head.className = 'ak-deploy-menu__head'
      head.setAttribute('data-ak-tui', 'menu-head')
      head.setAttribute('aria-hidden', 'true')
      head.innerHTML =
        '<div class="ak-deploy-menu__top">' +
          '<span data-ak-part="menuChannel">PRTS <b>//</b> DEPLOYMENT CONTROL</span>' +
          '<span><b data-ak-part="sector">01</b> · <span data-ak-part="count">00 POSITIONS</span></span>' +
        '</div>' +
        '<div class="ak-deploy-menu__title">' +
          '<span data-ak-part="menuTitle">终端作战位置</span>' +
          '<i data-ak-part="menuSub">TERMINAL DEPLOYMENT POSITION</i>' +
          '<em data-ak-part="code">R.I.</em>' +
        '</div>'
      return head
    }

    const paintMenuHead = (head, count, sector) => {
      const meta = terminalMeta()
      const words = terminalWords()
      akSetWords(head, words)
      akSetText(head.querySelector('[data-ak-part="code"]'), meta.code)
      akSetText(head.querySelector('[data-ak-part="sector"]'), sector === '' ? meta.sector : sector)
      akSetText(head.querySelector('[data-ak-part="count"]'), terminalPad(count) + words.positionUnit)
    }

    const isWorkspaceMenu = (menu) => {
      if (menu === null || menu === undefined) return false
      const footer = menu.querySelector('[class*="_footer"]')
      const addButton = footer === null ? null : footer.querySelector('button')
      if (addButton === null) return false
      const label = (addButton.textContent || '') + ' ' + (addButton.getAttribute('aria-label') || '')
      return /添加工作区|add workspace|workspace/i.test(label)
    }

    const paintMenu = (menu) => {
      if (!isWorkspaceMenu(menu)) return
      akMark(menu, 'menu')
      if (menu.classList.contains('ak-deploy-menu') === false) menu.classList.add('ak-deploy-menu')

      const viewport = menu.querySelector('[class*="_viewport"]')
      if (viewport === null) return
      akMark(viewport, 'menu-viewport')
      const footer = menu.querySelector('[class*="_footer"]')
      if (footer !== null) akMark(footer, 'menu-footer')

      let head = viewport.querySelector('.ak-deploy-menu__head')
      if (head === null) {
        head = buildMenuHead()
        viewport.insertBefore(head, viewport.firstChild)
      }

      const items = viewport.querySelectorAll('[role="menuitem"]')
      let activeSector = ''
      items.forEach((item, index) => {
        const sector = terminalPad(index + 1)
        akMark(item, 'menu-item')
        akSetAttr(item, 'data-ak-sector', sector)
        const active = item.className.indexOf('_selected') !== -1
          || item.getAttribute('aria-checked') === 'true'
          || item.getAttribute('aria-selected') === 'true'
          || item.getAttribute('aria-current') !== null
          || item.getAttribute('data-state') === 'selected'
        akSetAttr(item, 'data-ak-active', active ? 'true' : 'false')
        if (active && activeSector === '') activeSector = sector
      })
      paintMenuHead(head, items.length, activeSector)
      akSetAttr(head, 'data-ak-active-sector', activeSector === '' ? terminalMeta().sector : activeSector)
    }

    const paintMenus = () => {
      if (terminalMenuRoots === null) terminalMenuRoots = new Set()
      const seen = new Set()
      document.querySelectorAll('[role="menu"]').forEach((menu) => {
        if (!isWorkspaceMenu(menu)) return
        seen.add(menu)
        terminalMenuRoots.add(menu)
        paintMenu(menu)
      })
      for (const menu of terminalMenuRoots) {
        if (seen.has(menu) && menu.isConnected) continue
        const head = menu.querySelector === undefined ? null : menu.querySelector('.ak-deploy-menu__head')
        if (head !== null && head.parentNode !== null) head.parentNode.removeChild(head)
        if (menu.classList !== undefined) menu.classList.remove('ak-deploy-menu')
        terminalMenuRoots.delete(menu)
      }
    }

    /* 空状态里真正被选中的工作区以 hero 的选择器按钮文本为准：按钮文本
       等于 aria-label 时是占位文案（未选择），否则就是工作区名。侧栏行的
       aria-expanded 只代表目录展开，不能单独当作「作战位置已选定」，否则
       刚展开一个目录就会显示成已部署。会话页没有 hero，此时退回结构信号。 */
    const readDeployedWorkspace = () => {
      const row = document.querySelector('[class*="_heroWorkspaceRow"]')
      if (row === null) return null
      const button = row.querySelector('button[aria-haspopup="menu"]')
      if (button === null) return null
      const name = (button.textContent || '').trim()
      const label = (button.getAttribute('aria-label') || '').trim()
      return name === label ? '' : name
    }

    /* ---- 列表容器 --------------------------------------------------------
       柜体要的是「一层装下全部格的容器」。真页面里这件事比 fixture 深一层：
       每个行各自包着一层布局 wrapper，几行又包着一层分组（都是 module 哈希，
       不能写死）。所以从行往上走，直到某一层装下了**全部**行；沿途经过的
       wrapper 与分组标成 flat（display: contents）摊平，否则它们会隔着柜体
       把行一行一行重新竖回去 —— 之前只取 parentElement，结果柜体圈住的是第一
       行自己的包裹层，其余行留在外面、按原生宽度铺满侧栏。

       走到侧栏根或 body 还没凑齐就放弃：那会把抬头、输入框一起圈进柜体。 */
    const akCabinetField = (rows, role) => {
      if (rows.length < 2) return null
      const holdsAll = (node) => rows.every((row) => node.contains(row))
      let field = rows[0].parentElement
      let guard = 0
      while (field !== null && field !== document.body && guard < 8) {
        guard += 1
        if (field.getAttribute('data-slot') === 'sidebar') return null
        if (holdsAll(field)) break
        field = field.parentElement
      }
      if (field === null || field === document.body || !holdsAll(field)) return null
      const held = field.getAttribute('data-ak-tui')
      if (held !== null && held !== role) return null
      rows.forEach((row) => {
        let node = row.parentElement
        while (node !== null && node !== field) {
          if (node.getAttribute('data-ak-tui') === null) akMark(node, 'flat')
          node = node.parentElement
        }
      })
      akMark(field, role)
      return field
    }

    /* 会话与工作区住在同一棵树里（当前工作区的会话就排在它自己那组里），
       所以两遍扫描共用同一个柜体：工作区先跑、把容器标成 column-field，
       会话这一遍只把包裹层摊平、把计数写回同一层。 */
    const findCabinetField = (rows) => {
      const all = document.querySelectorAll("[data-ak-tui='column-field']")
      for (const node of all) {
        if (rows.every((row) => node.contains(row))) return node
      }
      return null
    }

    /* ---- 数字通道 --------------------------------------------------------
       刻度尺要按「第几格」定位，而 CSS 的 attr() 只能取字符串、进不了 calc()
       （attr(x type(<integer>)) 的支持还不足以依赖）。所以数量与序号除了写进
       data 属性给读数用，另外以自定义属性的形式写进行内样式给几何用。 */
    const akSetNum = (node, name, value) => {
      if (node === null) return
      const next = String(value)
      if (node.style.getPropertyValue(name) !== next) node.style.setProperty(name, next)
    }

    /* ---- 工位编号 --------------------------------------------------------
       行内的编号是一个真实 span（不是伪元素），所以可以和原生图标、文字
       一起参与 flex 排版；重渲染后由扫描补回。 */
    const paintWorkspaceRows = (sidebar) => {
      if (sidebar === null) return { count: 0, activeSector: '', plateName: '', field: null, activeRow: null, openGroup: null }
      /* 空 key 是 DSH 的“未分组”会话桶，不是可部署工作区：它是一枚 34px 高的
         折叠头，进了柜面就是一条横贯整行的板子。单独标出来，由 lab 层收掉。 */
      const rows = []
      sidebar.querySelectorAll('[class*="_projectRow"][data-row-key^="workspace:"]').forEach((row) => {
        if (row.getAttribute('data-row-key') === 'workspace:') {
          akMark(row, 'bucket-row')
          return
        }
        rows.push(row)
      })
      const field = akCabinetField(rows, 'column-field')
      const lab = document.body !== null && document.body.classList.contains('theme-arknights-lab')
      if (!lab) {
        terminalOpenedKey = ''
      }
      const deployed = readDeployedWorkspace()
      let firstName = ''
      let deployedRow = null
      rows.forEach((row, index) => {
        const sector = terminalPad(index + 1)
        akMark(row, 'sector-row')
        akSetAttr(row, 'data-ak-sector', sector)

        let code = row.querySelector(':scope > .ak-sector-code')
        if (code === null) {
          code = document.createElement('span')
          code.className = 'ak-sector-code'
          code.setAttribute('data-ak-tui', 'sector-code')
          code.setAttribute('aria-hidden', 'true')
          row.insertBefore(code, row.firstChild)
        }
        akSetText(code, sector)

        /* aria-expanded 只说明这个目录被展开，不说明它是当前工作区。用户可能
           同时展开好几个目录；把它当选中信号会让每一块板都点亮（真页面截图
           里七块板全是奶油色、编号全翻黑牌，就是这个原因）。 */
        const structuralActive = row.className.indexOf('_selected') !== -1
          || row.className.indexOf('folderActive') !== -1
          || row.getAttribute('aria-selected') === 'true'
          || row.getAttribute('aria-current') !== null
          || row.getAttribute('data-state') === 'selected'
          || row.querySelector('[class*="_folderActive"]') !== null
        const title = row.querySelector('[class*="_title"]')
        const name = title === null ? '' : (title.textContent || '').trim()
        /* 名字写在 data 属性上：36px 的板面放不下，但悬停铭牌要读它。
           不能用 title 属性，原生 tooltip 会和我们自己的黑牌叠在一起。 */
        akSetAttr(row, 'data-ak-name', name)
        if (index === 0) firstName = name
        /* 有 hero 时以 hero 里选中的工作区为准；没有 hero（对话页）时退回
           结构信号。structuralActive 可能有多个候选，只认第一个。 */
        const deployedMatch = deployed !== null && deployed !== '' && name === deployed
        if (deployedMatch && deployedRow === null) deployedRow = row
        if (deployed === null && structuralActive && deployedRow === null) deployedRow = row
      })

      /* 用户刚点过的目录优先：点击只展开会话，不会把工作区设为当前部署。
         如果点击把它自己收起来了（aria-expanded=false），这次点击就是折叠，
         不能继续点亮它。 */
      let clickedRow = null
      if (lab && terminalOpenedKey !== '') {
        for (const row of rows) {
          if (row.getAttribute('data-row-key') === terminalOpenedKey) { clickedRow = row; break }
        }
        if (clickedRow === null) terminalOpenedKey = ''
      }
      let openRow = null
      if (clickedRow !== null) {
        if (clickedRow.getAttribute('aria-expanded') === 'false') {
          terminalOpenedKey = ''
        } else {
          openRow = clickedRow
        }
      }

      const activeRow = openRow !== null ? openRow : deployedRow
      rows.forEach((row) => {
        akSetAttr(row, 'data-ak-active', row === activeRow ? 'true' : 'false')
      })
      const activeSector = activeRow === null ? '' : String(activeRow.getAttribute('data-ak-sector') || '')
      const activeName = activeRow === null ? '' : String(activeRow.getAttribute('data-ak-name') || '')
      const plateName = activeName === '' ? firstName : activeName

      /* 当前目录的会话住在它自己那一组里。从当前行往上找第一层「已经装着
         会话行」的祖先；找到柜面本身还没找到，就说明这一组没有会话。之后
         paintSessionBlocks 只看这一组，别的展开目录的会话不混进柜面。 */
      let openGroup = null
      const boundary = field !== null ? field : sidebar
      if (activeRow !== null) {
        let node = activeRow.parentElement
        while (node !== null && node !== boundary && node !== document.body) {
          if (node.querySelectorAll('[class*="_sessionRow"]').length > 0) { openGroup = node; break }
          node = node.parentElement
        }
      }

      if (field !== null) {
        const activeColumn = activeSector === '' ? '01' : activeSector
        akSetAttr(field, 'data-ak-columns', terminalPad(rows.length))
        akSetAttr(field, 'data-ak-active-column', activeColumn)
        akSetNum(field, '--ak-col', parseInt(activeColumn, 10))
        akSetNum(field, '--ak-cols', Math.max(rows.length, 1))
      }
      /* plateName 由扫描层交给分区抬头，不写在这里：铭牌钉在柜面顶沿、档案板的
         正上方那一行（参考就是这么排的），36px 的板面放不下一个工作区名。 */
      return { count: rows.length, activeSector, plateName, field, activeRow, openGroup,
        opened: openRow !== null }
    }

    /* ---- 会话短档案板 ----------------------------------------------------
       参考的第二级选择是「同一面柜体上的短档案板」。DSH 的会话行就是这一批
       条目，所以这里只负责标出容器与块序号，板子本身多大、哪块点亮全在样式表。
       计数走 data 属性而不是注入节点：读数是一条纯文本，CSS 的 attr() 就够，
       少造一个要在卸载时收回的节点。

       块身份也用 data-ak-block，不再占一个 data-ak-tui 槽位：会话行同时带
       应用的 `_panelRow` 类，paintChrome 会把那一层标成 'panel-row'。两个
       角色挤同一个属性时后写的赢，板子样式会静默失效——截图门禁真的抓到过。 */
    const paintSessionBlocks = (sidebar, state) => {
      if (sidebar === null) return { count: 0, active: '', field: null }
      const all = Array.prototype.slice.call(sidebar.querySelectorAll('[class*="_sessionRow"]'))
      const lab = document.body !== null && document.body.classList.contains('theme-arknights-lab')
      /* 参考的柜面只有一套轨道：当前档案的会话。DSH 允许同时展开多个目录，
         但柜面如果把每组的会话都排进来，读数会变成「05 个块」，而用户点的
         那组只占其中一段。这里只留当前目录这一组；搜索态没有工作区行时才
         退回全部。 */
      let rows = all
      if (lab && state !== undefined && state !== null && state.count > 0) {
        rows = state.openGroup === null ? [] : all.filter((row) => state.openGroup.contains(row))
      }
      all.forEach((row) => {
        if (rows.indexOf(row) === -1) {
          row.removeAttribute('data-ak-block')
          row.removeAttribute('data-ak-active')
        }
      })
      let active = ''
      rows.forEach((row, index) => {
        const block = terminalPad(index + 1)
        akSetAttr(row, 'data-ak-block', block)
        /* 方块里的标题是截断的，而 lab 又把应用那张会盖住抬头的悬停预览卡
           收掉了；给装不下的标题补一条原生 tooltip 兜底。只在行本来没有
           title 时写，免得盖掉应用自己的提示。 */
        if (lab && !row.hasAttribute('title')) {
          const title = row.querySelector("[class*='_title']")
          const text = title === null ? '' : String(title.textContent || '').trim()
          if (text !== '') {
            row.setAttribute('title', text)
            akSetAttr(row, 'data-ak-tip', 'true')
          }
        }
        const selected = row.className.indexOf('_selected') !== -1
          || row.getAttribute('aria-selected') === 'true'
          || row.getAttribute('aria-current') !== null
          || row.getAttribute('data-state') === 'selected'
          || row.querySelector('[class*="_selected"]') !== null
        akSetAttr(row, 'data-ak-active', selected ? 'true' : 'false')
        if (selected && active === '') active = block
      })
      const field = (state !== undefined && state !== null && state.field !== null ? state.field : null)
        || findCabinetField(rows) || (rows.length > 0 ? akCabinetField(rows, 'column-field') : null)
      if (field !== null) {
        /* 应用的「展开其余 N 个会话」默认是 order 0 的整行按钮，会跟着工作区
           板一起排队，把墙面切成 6 + 1 + 6；标出来交给 lab 排到方块之后。
           它和会话行一样按组过滤：别的展开目录的按钮不能混进当前柜面。 */
        if (lab) {
          const group = state !== undefined && state !== null ? state.openGroup : null
          field.querySelectorAll('[class*="_sessionOverflowButton"]').forEach((button) => {
            akMark(button, 'session-overflow')
            akSetAttr(button, 'data-ak-foreign',
              group !== null && group.contains(button) ? 'false' : 'true')
          })
        }
        rows.forEach((row) => {
          let node = row.parentElement
          while (node !== null && node !== field && field.contains(node)) {
            if (node.getAttribute('data-ak-tui') === null) akMark(node, 'flat')
            node = node.parentElement
          }
        })
        if (rows.length > 0) {
          const activeBlock = active === '' ? '01' : active
          akSetAttr(field, 'data-ak-blocks', terminalPad(rows.length))
          akSetAttr(field, 'data-ak-active-block', activeBlock)
          akSetNum(field, '--ak-blk', parseInt(activeBlock, 10))
          akSetNum(field, '--ak-blks', Math.max(rows.length, 1))
        } else {
          /* 会话全没了（切走工作区、或这一组还没展开）：读数带必须跟着消失，
             否则黑板上留一行「BLOCK 01 / 00」。 */
          field.removeAttribute('data-ak-blocks')
          field.removeAttribute('data-ak-active-block')
          field.style.removeProperty('--ak-blk')
          field.style.removeProperty('--ak-blks')
        }
      }
      return { count: rows.length, active, field }
    }

    /* ---- 打开一格之后让会话真的出现在柜面上 ------------------------------
       柜面矮的时候（768px 高的窗口只剩两百来像素），会话区排在整面墙后面，
       展开后不滚就永远在视口外。三种走法，按会话块占几行区分：
         · 一行：钉在柜面下沿当托盘（lab.css 的 data-ak-tray），再把当前板
           滚到托盘上方，板与会话同屏；
         · 多行：每一行都贴同一个底边会叠在一起，所以不钉，改为把会话区滚
           进视口，先保证看得到会话；
         · 本来就看得见：什么都不动。
       只处理「刚点开」的那一次：之后用户自己拖滚动条，扫描不能把他拽回去。 */
    const sessionBlocks = (field) => Array.prototype.slice.call(field.querySelectorAll('[data-ak-block]'))

    const blocksInOneRow = (blocks) => {
      if (blocks.length === 0) return false
      const top = blocks[0].offsetTop
      for (const block of blocks) {
        if (block.offsetTop !== top) return false
      }
      return true
    }

    const scrollFieldTo = (field, top) => {
      const limit = Math.max(0, field.scrollHeight - field.clientHeight)
      const next = Math.max(0, Math.min(limit, top))
      if (typeof field.scrollTo === 'function') field.scrollTo({ top: next, behavior: 'smooth' })
      else field.scrollTop = next
    }

    /* ---- 柜面不够高时把格位一起缩 ----------------------------------------
       DSH 0.2.1-rc.5 在侧栏里加了「插件 / 自动化任务 / 更多」三行面板导航
       （112px），1366×768 下柜面从 221px 掉到 155px：托盘（读数带 + 一排方块）
       与 108px 的档案板加起来 196px，必然互压——真页面上半块板被托盘吃掉；
       不展开目录时也一样，108 的板在一面 155px 的柜里只看得见一行半，第二行
       只露个板头。所以格位尺寸按柜面**实际可用高度**算，写在这三个变量上：
       托盘态保证「板 + 托盘」同屏，普通态保证「至少两行板」。装得下参考尺寸
       的时候变量缺席，一切仍是参考原值。返回托盘应占的高度，供滚动定位用。 */
    const CABINET = {
      slabMax: 108, slabMin: 56, blockMax: 74, blockMin: 46, trayPad: 14, gap: 8,
    }
    const CABINET_VARS = ['--lab-slab-h', '--lab-block-h', '--lab-tray-h']

    const fitCabinet = (field, tray) => {
      const defaultTray = CABINET.blockMax + CABINET.trayPad
      const avail = field.clientHeight
      if (avail <= 0) return defaultTray
      /* 同值不重写：这条在每次扫描里都会跑，写 CSSOM 会让浏览器重算整棵样式树。 */
      const setVar = (name, value) => {
        if (field.style.getPropertyValue(name) !== value) field.style.setProperty(name, value)
      }
      const clearVar = (name) => {
        if (field.style.getPropertyValue(name) !== '') field.style.removeProperty(name)
      }
      if (tray) {
        if (defaultTray + CABINET.gap + CABINET.slabMax <= avail) {
          for (const name of CABINET_VARS) clearVar(name)
          return defaultTray
        }
        const blockH = Math.max(CABINET.blockMin, Math.min(CABINET.blockMax, Math.round(avail * 0.36)))
        const trayH = blockH + CABINET.trayPad
        const slabH = Math.max(CABINET.slabMin,
          Math.min(CABINET.slabMax, avail - trayH - CABINET.gap))
        setVar('--lab-slab-h', slabH + 'px')
        setVar('--lab-block-h', blockH + 'px')
        setVar('--lab-tray-h', trayH + 'px')
        return trayH
      }
      /* 没展开目录时柜面整面都是墙：155px 里塞 108 的板只能看见一行半，第二行
         只露个板头，像被裁断了。按「至少看得见两行」压一次。 */
      const rows = 2
      const want = Math.floor((avail - CABINET.gap * (rows - 1)) / rows)
      if (want >= CABINET.slabMax) {
        clearVar('--lab-slab-h')
        return defaultTray
      }
      setVar('--lab-slab-h', Math.max(CABINET.slabMin, want) + 'px')
      clearVar('--lab-block-h')
      clearVar('--lab-tray-h')
      return defaultTray
    }

    const revealOpenFolder = (field, activeRow) => {
      if (field === null) return
      const blocks = sessionBlocks(field)
      if (blocks.length === 0) return
      const frame = field.getBoundingClientRect()
      const first = blocks[0].getBoundingClientRect()
      const last = blocks[blocks.length - 1].getBoundingClientRect()
      if (first.top >= frame.top + 4 && last.bottom <= frame.bottom - 4) return

      if (blocksInOneRow(blocks)) {
        field.setAttribute('data-ak-tray', 'true')
        /* 尺寸可能刚刚被改过，重新读一次布局再定位：目标是「当前板整块落在
           托盘上方」，而不是只保证它在矩形里——半块板被托盘盖住也算看不见。 */
        const trayH = fitCabinet(field, true)
        if (activeRow !== null) {
          const limit = field.clientHeight - trayH - 4
          const rowBottom = activeRow.offsetTop + activeRow.offsetHeight - field.scrollTop
          if (rowBottom > limit) field.scrollTop += rowBottom - limit
          if (activeRow.offsetTop - field.scrollTop < 4) {
            scrollFieldTo(field, activeRow.offsetTop - 4)
          }
        }
        return
      }

      /* 多行方块比柜面还高：让会话区顶部贴住柜面上沿，剩下的用户自己滚。
         格位尺寸由调用方按「非托盘态」统一算，这里不插手。 */
      let delta = last.bottom - (frame.bottom - 4)
      if (delta < 0) delta = 0
      if (first.top - delta < frame.top + 22) delta = first.top - frame.top - 22
      if (delta <= 0.5) return
      scrollFieldTo(field, field.scrollTop + delta)
    }

    /* 钉住的托盘只容得下一行；会话数量变了（新开一个会话）就收回托盘，
       否则后面的行会全部贴住同一个底边。返回值 = 这一轮柜面是不是托盘态，
       调用方据此决定格位尺寸（fitCabinet）。 */
    const syncSessionTray = (field, opened, count) => {
      if (field === null) return false
      if (field.getAttribute('data-ak-tray') !== 'true') return false
      if (!opened || count === 0 || !blocksInOneRow(sessionBlocks(field))) {
        field.removeAttribute('data-ak-tray')
        return false
      }
      return true
    }

    /* ---- 悬停铭牌 --------------------------------------------------------
       36px 的板面写不下名字，参考里名字也归一块独立的黑牌。这里把同一块
       黑牌做成跟随指针的浮层：悬停任意一格时在它旁边出现，名字长也不挤
       柜面。用 fixed 定位挂在 body 上，不被柜面的滚动容器裁掉。 */
    const hideSectorTip = () => {
      if (terminalTipEl !== null) terminalTipEl.hidden = true
    }

    const showSectorTip = (row) => {
      const name = String(row.getAttribute('data-ak-name') || '').trim()
      if (name === '' || typeof document === 'undefined' || document.body === null) {
        hideSectorTip()
        return
      }
      if (terminalTipEl === null || !terminalTipEl.isConnected) {
        terminalTipEl = document.createElement('div')
        terminalTipEl.className = 'ak-sector-tip'
        terminalTipEl.setAttribute('aria-hidden', 'true')
        document.body.appendChild(terminalTipEl)
      }
      terminalTipEl.textContent = name
      terminalTipEl.hidden = false
      /* 先亮出来再量尺寸：display:none 的元素量出来是 0。右侧放不下就翻
         到板子左边，上下再夹回视口。 */
      const rect = row.getBoundingClientRect()
      const tip = terminalTipEl.getBoundingClientRect()
      let left = rect.right + 7
      if (left + tip.width > window.innerWidth - 6) left = rect.left - tip.width - 7
      if (left < 6) left = 6
      let top = rect.top + (rect.height - tip.height) / 2
      if (top + tip.height > window.innerHeight - 6) top = window.innerHeight - tip.height - 6
      if (top < 6) top = 6
      terminalTipEl.style.left = left + 'px'
      terminalTipEl.style.top = top + 'px'
    }

    const bindSectorTip = () => {
      if (sectorTipBound || typeof document === 'undefined') return
      sectorTipBound = true
      document.addEventListener('pointerover', (event) => {
        if (!isEnabled() || !isTerminalLayout()) return
        if (document.body === null || !document.body.classList.contains('theme-arknights-lab')) return
        const node = event.target
        const row = node !== null && node !== undefined && node.closest !== undefined
          ? node.closest("[data-ak-tui='sector-row']") : null
        if (row !== null) showSectorTip(row)
      })
      document.addEventListener('pointerout', (event) => {
        const node = event.target
        const row = node !== null && node !== undefined && node.closest !== undefined
          ? node.closest("[data-ak-tui='sector-row']") : null
        if (row === null) return
        const next = event.relatedTarget
        if (next !== null && next !== undefined && row.contains(next)) return
        hideSectorTip()
      })
      document.addEventListener('scroll', hideSectorTip, true)
      window.addEventListener('blur', hideSectorTip)
    }

    /* 点击目录 = 在柜面上打开这一格。应用的点击只切换 aria-expanded，
       不会把工作区设成当前部署；主题记下这一格，点亮它、把铭牌换成它，
       柜面只排这一组的会话。 */
    const bindTerminalClicks = (sidebar) => {
      if (sidebar === null || sidebar.getAttribute('data-ak-clicks') === 'on') return
      sidebar.setAttribute('data-ak-clicks', 'on')
      sidebar.addEventListener('click', (event) => {
        if (!isEnabled() || !isTerminalLayout()) return
        if (document.body === null || !document.body.classList.contains('theme-arknights-lab')) return
        const node = event.target
        const row = node !== null && node !== undefined && node.closest !== undefined
          ? node.closest("[data-ak-tui='sector-row']") : null
        if (row === null || !sidebar.contains(row)) return
        terminalOpenedKey = String(row.getAttribute('data-row-key') || '')
        hideSectorTip()
        /* 应用在同一个 tick 里改 aria-expanded、渲染会话；等它落定再扫。 */
        scheduleTerminalScan(160)
      }, true)
    }

    const paintHero = (activeSector) => {
      const hero = document.querySelector('[class*="_composerHero"]')
      if (hero === null) {
        if (terminalFooterEl !== null && terminalFooterEl.parentNode !== null) terminalFooterEl.parentNode.removeChild(terminalFooterEl)
        terminalFooterEl = null
        return
      }
      const sector = activeSector === '' ? '01' : activeSector
      akMark(hero, 'hero')
      akSetAttr(hero, 'data-ak-sector', sector)

      if (terminalFooterEl === null || !terminalFooterEl.isConnected) {
        terminalFooterEl = buildTerminalFooter()
        document.body.appendChild(terminalFooterEl)
      }
      paintTerminalFooter(sector)

      const stack = hero.querySelector('[class*="_headline"]')
      const stackRoot = stack === null ? hero : stack.parentElement
      if (stackRoot !== null) {
        akMark(stackRoot, 'hero-stack')
        akSetAttr(stackRoot, 'data-ak-sector', sector)
      }

      const deployRow = hero.querySelector('[class*="_heroWorkspaceRow"]')
      if (deployRow !== null) {
        akMark(deployRow, 'deploy-row')
        akSetAttr(deployRow, 'data-ak-sector', sector)
        const buttons = deployRow.querySelectorAll('button[aria-haspopup="menu"]')
        buttons.forEach((button, index) => {
          akMark(button, index === 0 ? 'workspace' : 'mode')
        })
      }
    }

    const paintChrome = (sidebar) => {
      const frame = document.querySelector('[class*="_frame"]')
      if (frame !== null) {
        const center = frame.querySelector('[class*="_centerCol"]') || frame
        const header = center.querySelector('[class*="_header"]') || frame.querySelector('[class*="_header"]')
        if (header !== null) {
          akMark(header, 'header')
          const blank = Array.from(header.classList).some((cls) => cls.indexOf('headerBlank') !== -1)
          akSetAttr(header, 'data-ak-blank', blank ? 'true' : 'false')
        }
      }
      if (sidebar !== null) {
        const logo = sidebar.querySelector('[class*="_logoRow"]')
        if (logo !== null) {
          akMark(logo, 'logo')
          const root = logo.parentElement
          if (root !== null) akMark(root, 'sidebar')
        }
        const newSession = sidebar.querySelector('[class*="_newSession"]')
        if (newSession !== null) akMark(newSession, 'new-session')
        sidebar.querySelectorAll('[class*="_panelRow"]').forEach((row) => akMark(row, 'panel-row'))
      }
      document.querySelectorAll('[data-composer-card]').forEach((card) => akMark(card, 'composer'))
      document.querySelectorAll('[class*="_composerSeat"]').forEach((seat) => akMark(seat, 'composer-seat'))
    }

    const paintTerminalUI = () => {
      if (!isEnabled() || !isTerminalLayout()) return
      if (typeof document === 'undefined' || document.body === null) return
      try {
        bindSectorTip()
        const sidebar = document.querySelector('[data-slot="sidebar"]')
        bindTerminalClicks(sidebar)
        const logo = sidebar === null ? null : sidebar.querySelector('[class*="_logoRow"]')
        const sidebarRoot = logo === null ? null : logo.parentElement

        if (sidebarRoot !== null) {
          akMark(sidebarRoot, 'sidebar')
          if (terminalDeckEl === null || !terminalDeckEl.isConnected || terminalDeckEl.parentElement !== sidebarRoot) {
            if (terminalDeckEl !== null && terminalDeckEl.parentNode !== null) terminalDeckEl.parentNode.removeChild(terminalDeckEl)
            terminalDeckEl = buildTerminalDeck()
            logo.insertAdjacentElement('afterend', terminalDeckEl)
          }
          paintTerminalDeck(terminalDeckEl)
        } else if (terminalDeckEl !== null) {
          if (terminalDeckEl.parentNode !== null) terminalDeckEl.parentNode.removeChild(terminalDeckEl)
          terminalDeckEl = null
        }

        const workspaces = document.querySelector('[data-slot="sidebar.workspaces"]')
        const sectionHeader = workspaces === null ? null : workspaces.querySelector('[class*="_sectionHeader"]')
        if (sectionHeader !== null) {
          akMark(sectionHeader, 'section-header')
          const label = sectionHeader.querySelector('[class*="_sectionLabel"]')
          if (label !== null) akMark(label, 'section-label')
          if (terminalSectorHeadEl === null || !terminalSectorHeadEl.isConnected || terminalSectorHeadEl.nextElementSibling !== sectionHeader) {
            if (terminalSectorHeadEl !== null && terminalSectorHeadEl.parentNode !== null) terminalSectorHeadEl.parentNode.removeChild(terminalSectorHeadEl)
            terminalSectorHeadEl = buildSectorHead()
            sectionHeader.parentNode.insertBefore(terminalSectorHeadEl, sectionHeader)
          }
          akSetWords(terminalSectorHeadEl, terminalWords())
        } else if (terminalSectorHeadEl !== null) {
          if (terminalSectorHeadEl.parentNode !== null) terminalSectorHeadEl.parentNode.removeChild(terminalSectorHeadEl)
          terminalSectorHeadEl = null
        }

        const rowsState = paintWorkspaceRows(workspaces)
        const blocksState = paintSessionBlocks(sidebar, rowsState)
        const trayOn = syncSessionTray(blocksState.field, rowsState.opened, blocksState.count)
        /* 格位尺寸跟着柜面高度走（拖窗口、应用侧栏面板增减都会改它）。这里只改
           尺寸，不碰滚动位置——用户自己拖到的地方不能被扫描拽回去。 */
        if (blocksState.field !== null) fitCabinet(blocksState.field, trayOn)
        if (rowsState.opened && blocksState.count > 0 && blocksState.field !== null) {
          if (terminalRevealedKey !== terminalOpenedKey) {
            revealOpenFolder(blocksState.field, rowsState.activeRow)
            terminalRevealedKey = terminalOpenedKey
          }
        } else if (!rowsState.opened) {
          terminalRevealedKey = ''
        }
        /* 铭牌：参考的柜面把当前档案的名字钉在一块黑底小牌上，这块牌比 36px 的
           板子宽得多，所以它钉在抬头里、柜面正上方，而不是钉在某一块板上。 */
        if (terminalSectorHeadEl !== null) {
          const active = rowsState.activeSector === '' ? '01' : rowsState.activeSector
          akSetText(terminalSectorHeadEl.querySelector('[data-ak-part="count"]'), terminalPad(rowsState.count) + terminalWords().sectorUnit)
          akSetAttr(terminalSectorHeadEl, 'data-ak-active-sector', active)
          akSetAttr(terminalSectorHeadEl, 'data-ak-empty',
            rowsState.opened && blocksState.count === 0 ? 'true' : 'false')
          akSetText(terminalSectorHeadEl.querySelector('[data-ak-part="readoutActive"]'), active)
          akSetText(terminalSectorHeadEl.querySelector('[data-ak-part="readoutTotal"]'), terminalPad(rowsState.count))
          akSetText(terminalSectorHeadEl.querySelector('[data-ak-part="plate"]'), rowsState.plateName)
        }

        paintHero(rowsState.activeSector)
        paintChrome(sidebar)
        paintMenus()
      } catch (e) {
        /* 应用正在换页时某个节点可能瞬间消失；下一轮观察器会重试。 */
      }
    }

    const destroyTerminalUI = () => {
      if (terminalObserver !== null) {
        terminalObserver.disconnect()
        terminalObserver = null
      }
      if (terminalScanTimer !== null && typeof clearTimeout === 'function') clearTimeout(terminalScanTimer)
      terminalScanTimer = null
      terminalDeckEl = null
      terminalSectorHeadEl = null
      terminalFooterEl = null
      terminalMenuRoots = null
      terminalOpenedKey = ''
      terminalRevealedKey = ''
      terminalTipEl = null
      if (typeof document === 'undefined' || document.body === null) return
      document.querySelectorAll('.ak-terminal-deck, .ak-terminal-sector-head, .ak-sector-code, .ak-sector-tip, .ak-deploy-menu__head, .ak-terminal-footer').forEach((node) => {
        if (node.parentNode !== null) node.parentNode.removeChild(node)
      })
      document.querySelectorAll('.ak-deploy-menu').forEach((node) => node.classList.remove('ak-deploy-menu'))
      document.querySelectorAll('[data-ak-tui]').forEach((node) => node.removeAttribute('data-ak-tui'))
      document.querySelectorAll('[data-ak-clicks]').forEach((node) => node.removeAttribute('data-ak-clicks'))
      /* 会话块的 tooltip 是我们写的，卸装时收回；没有标记的 title 属于应用本身。 */
      document.querySelectorAll('[data-ak-tip]').forEach((node) => {
        node.removeAttribute('title')
        node.removeAttribute('data-ak-tip')
      })
      /* 柜列与方块的计数写在 data 属性上（样式表用 attr() 读出来当读数），
         它们同样是运行时标注，卸装时必须一并收回。 */
      for (const name of ['data-ak-sector', 'data-ak-active', 'data-ak-blank',
        'data-ak-name', 'data-ak-block', 'data-ak-blocks', 'data-ak-columns',
        'data-ak-active-block', 'data-ak-active-column', 'data-ak-empty', 'data-ak-tray',
        'data-ak-foreign']) {
        document.querySelectorAll('[' + name + ']').forEach((node) => node.removeAttribute(name))
      }
      /* 刻度尺定位用的数字通道、柜面格位尺寸都写在行内样式里，也要收回。 */
      for (const name of ['--ak-col', '--ak-cols', '--ak-blk', '--ak-blks',
        '--lab-slab-h', '--lab-block-h', '--lab-tray-h']) {
        document.querySelectorAll('[style*="' + name + '"]').forEach((node) => node.style.removeProperty(name))
      }
    }

    const syncTerminalUI = () => {
      if (!isEnabled() || !isTerminalLayout()) {
        destroyTerminalUI()
        return
      }
      bindTerminalObserver()
      bindCabinetResize()
      paintTerminalUI()
    }

    /* setFaction() 的即时重绘钩子（在 35-faction-bar 里声明并调用）。
       阵营 class 翻转后样式表已经换色，这里只需把铭牌/菜单抬头的字标
       改掉；不重建节点。 */
    akTerminalRepaint = paintTerminalUI

    /* ---------- 峰谷定价窗口（本地计算） ----------
       The published rule (api-docs.deepseek.com pricing): Beijing time Mon-Fri
       9:00-12:00 and 14:00-18:00 are PEAK; everything else — nights, weekends,
       statutory holidays — is OFF-PEAK at half price. Two cases the summary
       rule leaves open are settled by DeepSeek's own 「API 峰谷时间补充说明」
       (2026-09-19): a Chinese statutory holiday is off-peak ALL DAY, and a
       调休 make-up workday that lands on a weekend is still billed as a weekend,
       i.e. off-peak all day as well. The second ruling is why the weekend test
       below needs no exception list — every 调休 day in the notices is a
       Saturday or Sunday (check.js enforces exactly that), so "weekend =>
       valley" already bills them off-peak.

       Everything is computed against UTC+8 directly (a fixed offset zone, no
       DST), so the result is exact regardless of the viewer's machine zone:
       shifting a Date by +8h and reading its UTC fields yields the Beijing
       wall clock.

       The window is the longest run of CONSECUTIVE EQUAL-PRICE blocks, not the
       calendar day. Midnight is not a price edge, so Friday's evening valley
       runs on through the weekend into Monday 09:00, and a 7-day national
       holiday reads as ONE valley rather than resetting every midnight. Peak
       blocks stay 3h/4h, so a peak read is identical to the old day-scoped one.

       Returns { peak, holiday, elapsedMs, totalMs, remainingMs, elapsedPct } —
       elapsed/total drive the 「低谷已过33%」 read, remainingMs the
       「剩余42:29:37」 countdown, peak the 高峰/低谷 label and holiday the name
       of the statutory holiday the day sits in ('' otherwise). Only the brand
       pose names the holiday: the settled row must not grow a character, or it
       would push the pill past the width its breakpoint was derived from. */

    /* Statutory-holiday calendar, transcribed from the State Council's yearly
       放假安排 notice. `from`/`to` are INCLUSIVE Beijing dates (MM-DD); `makeup`
       lists the weekend days worked to make the span and is kept as evidence
       for the ruling above (the code bills them as weekends, like any other
       Saturday). A year WITHOUT an entry falls back to the plain weekday/weekend
       rule — an unlisted holiday would be billed as peak — so check.js fails
       when the CURRENT Beijing year is missing, which is the reminder to add the
       next notice (published each November). Pure data, no logic: safe to
       evaluate on its own by the guard. */
    const BALANCE_HOLIDAY_NOTICES = {
      2026: {
        notice: '国办发明电〔2025〕7号',
        spans: [
          { name: '元旦', from: '01-01', to: '01-03', makeup: ['01-04'] },
          { name: '春节', from: '02-15', to: '02-23', makeup: ['02-14', '02-28'] },
          { name: '清明节', from: '04-04', to: '04-06', makeup: [] },
          { name: '劳动节', from: '05-01', to: '05-05', makeup: ['05-09'] },
          { name: '端午节', from: '06-19', to: '06-21', makeup: [] },
          { name: '中秋节', from: '09-25', to: '09-27', makeup: [] },
          { name: '国庆节', from: '10-01', to: '10-07', makeup: ['09-20', '10-10'] },
        ],
      },
    }

    /* 'YYYY-MM-DD' -> holiday name, expanded once from the spans above. */
    const BALANCE_HOLIDAY_DATES = new Map()
    const balanceBeijingKey = (ms) => {
      const d = new Date(ms + 8 * 3600 * 1000) // Beijing wall clock, read as UTC
      const mo = d.getUTCMonth() + 1
      const day = d.getUTCDate()
      return d.getUTCFullYear() + '-' + (mo < 10 ? '0' : '') + mo + '-' + (day < 10 ? '0' : '') + day
    }
    for (const year of Object.keys(BALANCE_HOLIDAY_NOTICES)) {
      for (const span of BALANCE_HOLIDAY_NOTICES[year].spans) {
        const from = span.from.split('-').map(Number)
        const to = span.to.split('-').map(Number)
        const last = Date.UTC(Number(year), to[0] - 1, to[1])
        for (let at = Date.UTC(Number(year), from[0] - 1, from[1]); at <= last; at += 24 * 3600 * 1000) {
          BALANCE_HOLIDAY_DATES.set(balanceBeijingKey(at), span.name)
        }
      }
    }

    /* Statutory holiday covering the Beijing day of `ms`, '' on ordinary days. */
    const balanceHolidayName = (ms) => BALANCE_HOLIDAY_DATES.get(balanceBeijingKey(ms)) || ''

    /* True when the WHOLE Beijing day containing `ms` is off-peak: a weekend
       (including the 调休 workdays that fall on one) or a statutory holiday. */
    const balanceDayIsOffPeak = (ms) => {
      const weekday = new Date(ms + 8 * 3600 * 1000).getUTCDay()
      return weekday === 0 || weekday === 6 || BALANCE_HOLIDAY_DATES.has(balanceBeijingKey(ms))
    }

    const BALANCE_PEAK_WINDOWS = [[9 * 60, 12 * 60], [14 * 60, 18 * 60]] // minutes-of-day
    /* One ordinary weekday as valley/peak blocks, derived from the peak windows
       above so the two can never disagree: valley, peak, valley, peak, valley. */
    const balanceWeekdayBlocks = () => {
      const blocks = []
      let at = 0
      for (const win of BALANCE_PEAK_WINDOWS) {
        if (win[0] > at) blocks.push([at, win[0], false])
        blocks.push([win[0], win[1], true])
        at = win[1]
      }
      if (at < 24 * 60) blocks.push([at, 24 * 60, false])
      return blocks
    }
    const BALANCE_WEEKDAY_BLOCKS = balanceWeekdayBlocks()
    const BALANCE_OFF_PEAK_DAY_BLOCKS = [[0, 24 * 60, false]]
    /* Ceiling on the equal-price walk. A 9-day 春节 plus its weekends is ~20
       blocks, so this is unreachable in practice; it only stops a broken table
       from walking for a whole second inside a 1s tick. */
    const BALANCE_WINDOW_WALK_CAP = 4096
    const balancePricingWindow = (now) => {
      const t = now.getTime()
      const shift = new Date(t + 8 * 3600 * 1000)
      const minute = shift.getUTCHours() * 60 + shift.getUTCMinutes()
      const secOfDay = minute * 60 + shift.getUTCSeconds()
      const dayMs = 24 * 3600 * 1000
      const dayStart = t - secOfDay * 1000 // Beijing midnight, absolute time
      const blocksAt = (dayOffset) =>
        (balanceDayIsOffPeak(dayStart + dayOffset * dayMs)
          ? BALANCE_OFF_PEAK_DAY_BLOCKS
          : BALANCE_WEEKDAY_BLOCKS)
      const blocks = blocksAt(0)
      let slot = 0
      for (let i = 0; i < blocks.length; i += 1) {
        if (minute >= blocks[i][0] && minute < blocks[i][1]) {
          slot = i
          break
        }
      }
      const peak = blocks[slot][2]
      let windowStart = dayStart + blocks[slot][0] * 60 * 1000
      let windowEnd = dayStart + blocks[slot][1] * 60 * 1000
      if (!peak) {
        /* Walk the flat block sequence outwards from today's block while the
           neighbour stays a valley; the first peak block is the edge. Midnight
           needs no special case because it is not a price edge, which is what
           makes a weekend (or a whole national holiday) one contiguous valley. */
        let day = 0
        let i = slot
        for (let step = 0; step < BALANCE_WINDOW_WALK_CAP; step += 1) {
          if (i > 0) {
            i -= 1
          } else {
            day -= 1
            i = blocksAt(day).length - 1
          }
          const back = blocksAt(day)[i]
          if (back[2]) break
          windowStart = dayStart + day * dayMs + back[0] * 60 * 1000
        }
        day = 0
        i = slot
        for (let step = 0; step < BALANCE_WINDOW_WALK_CAP; step += 1) {
          if (i + 1 < blocksAt(day).length) {
            i += 1
          } else {
            day += 1
            i = 0
          }
          const next = blocksAt(day)[i]
          if (next[2]) break
          windowEnd = dayStart + day * dayMs + next[1] * 60 * 1000
        }
      }
      const elapsedMs = Math.max(0, t - windowStart)
      const totalMs = Math.max(1, windowEnd - windowStart)
      return {
        peak,
        holiday: peak ? '' : balanceHolidayName(dayStart),
        elapsedMs,
        totalMs,
        remainingMs: Math.max(0, windowEnd - t),
        elapsedPct: Math.min(100, Math.round((elapsedMs / totalMs) * 100)),
      }
    }

    /* hh:mm:ss with hours unclamped — a weekend valley legitimately runs past
       a day boundary in feel, and the reference screenshot shows exactly that
       shape ("剩余42:29:37"). */
    const balanceFormatCountdown = (ms) => {
      const total = Math.max(0, Math.floor(ms / 1000))
      const h = Math.floor(total / 3600)
      const m = Math.floor((total % 3600) / 60)
      const s = total % 60
      const pad = (n) => (n < 10 ? '0' + String(n) : String(n))
      return String(h) + ':' + pad(m) + ':' + pad(s)
    }

    /* Re-derive the window from wall clock and repaint the pricing half. Runs
       every tick; before the first balance answer arrives the money half still
       shows its 待机 (¥--) seed, so the capsule never renders an empty slot.
       The dial is driven by ONE custom property: the ring's conic-gradient reads
       --ak-balance-sweep, so progress never re-lays-out the pill. */
    const balancePaintWindow = () => {
      if (balanceEl === null || typeof document === 'undefined') return
      // Credits mode owns the right-hand dial (consumption share) and has no
      // pricing window: the peak/off-peak clock is a DeepSeek API concept, so
      // a jet-hub channel must not have the next tick overwrite the sweep or
      // resurrect the countdown text. The 1s interval keeps running for the
      // wallet mode's collapse bookkeeping; this early return is the whole
      // mode handoff.
      if (creditProvider !== null) {
        if (balanceBootAt !== 0) {
          const waited = Date.now() - balanceBootAt
          const ready = balanceBootAnswered || waited >= BALANCE_BOOT_MAX_MS
          if (waited >= BALANCE_BOOT_MIN_MS && ready && loaderEl === null) {
            balanceBootAt = 0
            balanceEl.removeAttribute('data-ak-balance-boot')
          }
        }
        return
      }
      let win
      try {
        win = balancePricingWindow(new Date())
      } catch (e) {
        return
      }
      const setText = (attr, text) => {
        const node = balanceEl.querySelector('[' + attr + ']')
        if (node) node.textContent = text
      }
      const phase = balanceEl.querySelector('[data-ak-balance-phase]')
      if (phase) {
        phase.textContent = win.peak ? '高峰' : '低谷'
        phase.setAttribute('data-ak-balance-phase-peak', win.peak ? '1' : '0')
      }
      setText('data-ak-balance-remain', balanceFormatCountdown(win.remainingMs))
      setText('data-ak-balance-pct', (win.peak ? '高峰已过' : '低谷已过') + win.elapsedPct + '%')
      // The brand pose names the window it opens onto, so the panel never claims
      // 低谷 while the clock has already crossed into 高峰.
      const brandTitle = balanceEl.querySelector('[data-ak-balance-brand-title]')
      if (brandTitle) {
        // The pose names the window it opens onto; on a statutory holiday it
        // names the holiday, because 低谷 alone would read as an ordinary night.
        const label = win.peak
          ? 'DeepSeek 当前高峰'
          : 'DeepSeek ' + (win.holiday === '' ? '当前低谷' : win.holiday + '低谷')
        if (brandTitle.textContent !== label) brandTitle.textContent = label
      }
      if (typeof balanceEl.style?.setProperty === 'function') {
        balanceEl.style.setProperty('--ak-balance-sweep', win.elapsedPct * 3.6 + 'deg')
      }
      /* Collapse the brand pose: held for at least MIN so the brand is readable,
         released by the first answer, capped by MAX when the host never replies,
         and never released while the boot plate is up — the two overlays sit at
         the same point on screen and would cross-fade over each other. No
         radius write-back any more: the stadium is DRAWN by the pill's own
         gradient layers (see the stylesheet), which no border-radius or
         zero-radius pass can strand. */
      if (balanceBootAt !== 0) {
        const waited = Date.now() - balanceBootAt
        const ready = balanceBootAnswered || waited >= BALANCE_BOOT_MAX_MS
        if (waited >= BALANCE_BOOT_MIN_MS && ready && loaderEl === null) {
          balanceBootAt = 0
          balanceEl.removeAttribute('data-ak-balance-boot')
        }
      }
    }

    const balanceFetch = async () => {
      if (balanceBusy || typeof fetch !== 'function') return
      balanceBusy = true
      try {
        const res = await fetch(BALANCE_URL, { method: 'GET' })
        const payload = await res.json().catch(() => null)
        // A wallet answer never overwrites the channel read: while a jet-hub
        // provider is live the money group belongs to it, so the DeepSeek
        // poll only refreshes the numbers the wallet mode will show when the
        // user switches back.
        if (payload && payload.ok && creditProvider === null) {
          const wallet = balancePickWallet(payload.wallets)
          if (wallet) balancePaint(wallet)
        }
      } catch (e) { /* keep last known values; the next poll retries */ } finally {
        balanceBusy = false
        // "Answered" covers a failed request too: the brand pose is a waiting
        // room, not a promise that money is on the way.
        balanceBootAnswered = true
      }
    }

    /* `forceBoot` replays the opening pose for the settings 预览 button. It is
       the one caller allowed to override the OS reduced-motion preference: the
       user asked for this animation by name, and without the override the button
       would look broken to exactly the people who turn motion down. */
    const showBalanceCapsule = (forceBoot) => {
      if (!isEnabled() || !isBalanceCapsuleOn()) return
      if (typeof document === 'undefined' || !document.body) return
      if (balanceEl !== null) return
      const el = document.createElement('div')
      el.setAttribute('data-ak-balance', '')
        /* The pill's silhouette is DRAWN by its background gradients (see the
           stylesheet section): two end discs + a band, correct in every renderer.
           border-radius must therefore be ZERO, pinned inline with priority: the
           host roots corner-shape at superellipse(1.5) (Chrome 139+), and the
           squircle it draws for any radius — even a correctly clamped 999px —
           is exactly what stranded this capsule twice (measured: a settled
           32px pill with ~14px caps while the dial's gradient ring in the same
           screenshot was a perfect circle). With no clip box, nothing can shave
           the drawn caps; the zero-radius pass and any host !important both lose
           to an inline !important. Guarded because a jsdom-ish host hands back a
           createElement() node whose style object carries no setProperty. */
      const bootAnimated = forceBoot === true || isBalanceBootAnimated()
      if (el.style && typeof el.style.setProperty === 'function') {
        el.style.setProperty('border-radius', '0', 'important')
      }
      // Informational overlay over navigation: never announced, never hit-tested.
      el.setAttribute('aria-hidden', 'true')
      el.innerHTML =
        '<span data-ak-balance-icon></span>' +
        '<span data-ak-balance-money>' +
        '<span data-ak-balance-currency>¥</span>' +
        '<span data-ak-balance-int>--</span>' +
        '<span data-ak-balance-frac></span>' +
        '</span>' +
        // The channel read lives in its own group and swaps with the wallet via
        // the pill's data-ak-credit-mode attribute (wallet | credits).
        '<span data-ak-credit-money>' +
        '<span data-ak-credit-channel></span>' +
        '<span data-ak-credit-int>--</span>' +
        '<span data-ak-credit-unit></span>' +
        '</span>' +
        // The pricing countdown is the wallet mode's middle read only — peak/
        // off-peak windows are a DeepSeek API concept, so the credits mode
        // hides the whole run via the same mode attribute.
        '<span data-ak-balance-window>' +
        '<span data-ak-balance-phase>低谷</span>' +
        // The 「时段剩余hh:mm:ss」 tail is its own group so a phone can drop
        // the countdown while the 高峰/低谷 label survives: the static glue
        // text has no node of its own and could not be hidden any other way.
        '<span data-ak-balance-remain-run>' +
        '时段剩余' +
        '<span data-ak-balance-remain></span>' +
        '</span>' +
        '</span>' +
        // The right-hand slot carries one read per mode: the elapsed pricing
        // share (wallet) or the channel's consumption share (credits). Two
        // exclusive nodes, swapped by the same attribute.
        '<span data-ak-balance-pct></span>' +
        '<span data-ak-credit-pct></span>' +
        '<span data-ak-balance-badge>' +
        '<span data-ak-balance-ring></span>' +
        '<span data-ak-balance-clock></span>' +
        '</span>' +
        // The brand pose lives in the same box, absolutely placed over the row:
        // it is inert when the attribute is off (opacity 0, pointer-events none).
        '<span data-ak-balance-brand>' +
        '<span data-ak-balance-brand-mark></span>' +
        '<span data-ak-balance-brand-copy>' +
        '<span data-ak-balance-brand-kicker>/// DEEPSEEK API</span>' +
        '<span data-ak-balance-brand-title>DeepSeek 当前低谷</span>' +
        '</span>' +
        '</span>'
      document.body.appendChild(el)
      balanceEl = el
      balanceBootAnswered = false
      /* 停靠位：CSS 在 [data-ak-balance-position='left'|'right'] 上换
         top/left 定位；居中是基规则，不需要属性。位置偏好变化走
         syncBalanceCapsule -> showBalanceCapsule（destroy 重建），所以这里
         一次性写入即可，运行期不会漂移。 */
      const bootPosition = readBalanceCapsulePosition()
      if (bootPosition !== 'center') el.setAttribute('data-ak-balance-position', bootPosition)
      /* 防遮挡接线（33 片段定义观察器）：先清一次隐藏态，再挂侧栏监听与
         window mousemove —— 挂载失败（stub 环境）时两个判定保持关闭。 */
      balanceSidebarOpen = false
      balanceHoverHide = false
      balanceWatchSidebar()
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        try { window.addEventListener('mousemove', balanceOnMouseMove) } catch (e) { /* stub */ }
      }
      if (bootAnimated) {
        // Raised before the first paint, so the pill never flashes the settled
        // row on its way into the pose.
        el.setAttribute('data-ak-balance-boot', '')
        balanceBootAt = Date.now()
      } else {
        balanceBootAt = 0
      }
      // Wallet mode is the seed: an absent model service or a DeepSeek session
      // must never leave the channel group blanking the money read.
      el.setAttribute('data-ak-credit-mode', 'wallet')
      creditPaintIdle()
      balanceFetch()
      creditsStart()
      balancePaintWindow()
      if (typeof setInterval === 'function') {
        balanceTimer = setInterval(balancePaintWindow, BALANCE_TICK_MS)
        // One poll heartbeat drives both reads: the wallet fetch and a channel
        // re-resolve. The credit half is throttled inside creditsApply
        // (CREDITS_MIN_INTERVAL_MS since that provider's last completed
        // fetch), so the 60s heartbeat itself costs one cheap local lookup
        // and an actual usage.badge RPC only every five minutes per provider.
        balancePollTimer = setInterval(() => {
          balanceFetch()
          creditsRefresh(false)
        }, BALANCE_POLL_MS)
      }
    }

    /* True when a live pill carries a docking attribute that no longer matches
       the preference (a centered pill mounts with NO attribute). Kept out of
       syncBalanceCapsule so the mount call stays that function's only job. */
    const balancePositionChanged = () => {
      if (balanceEl === null) return false
      const want = readBalanceCapsulePosition()
      return balanceEl.getAttribute('data-ak-balance-position') !== (want === 'center' ? null : want)
    }

    const syncBalanceCapsule = () => {
      if (!(isEnabled() && isBalanceCapsuleOn())) {
        destroyBalanceCapsule()
        return
      }
      // Rebuild when the dock changed; a plain sync stays motion-aware.
      if (balancePositionChanged()) destroyBalanceCapsule()
      showBalanceCapsule()
    }

    let disposeToken = () => {}
    let disposeStyles = () => {}
    let mounted = false
    const mount = () => {
      if (mounted) return
      mounted = true
      disposeToken = theme.overrideTokens('edge-intelligence-theme', {
      '--dsw-alias-bg-base': {
        light: 'var(--edge-paper)',
        dark: 'var(--edge-paper)',
      },
      '--dsw-alias-bg-layer-1': {
        light: 'var(--edge-panel)',
        dark: 'var(--edge-panel)',
      },
      '--dsw-alias-bg-layer-2': {
        light: 'var(--edge-soft)',
        dark: 'var(--edge-soft)',
      },
      '--dsw-alias-bg-overlay': {
        light: 'var(--edge-overlay)',
        dark: 'var(--edge-overlay)',
      },
      '--dsw-alias-border-l1': {
        light: 'var(--edge-line)',
        dark: 'var(--edge-line)',
      },
      '--dsw-alias-border-l2': {
        light: 'var(--edge-line-2)',
        dark: 'var(--edge-line-2)',
      },
      '--dsw-alias-brand-primary': {
        light: 'var(--edge-ink)',
        dark: 'var(--edge-accent)',
      },
      '--dsw-alias-label-primary': {
        light: 'var(--edge-ink)',
        dark: 'var(--edge-ink)',
      },
      '--dsw-alias-label-secondary': {
        light: 'var(--edge-ink-2)',
        dark: 'var(--edge-ink-2)',
      },
      '--dsw-alias-state-error-primary': {
        light: 'var(--edge-error)',
        dark: 'var(--edge-error)',
      },
      '--dsw-alias-state-success-primary': {
        light: 'var(--edge-success)',
        dark: 'var(--edge-success)',
      },
      '--dsw-alias-state-warn-primary': {
        light: 'var(--edge-warn)',
        dark: 'var(--edge-warn)',
      },
      '--dsw-specific-sidebar-fill': {
        light: 'var(--edge-paper)',
        dark: 'var(--edge-paper)',
      },
      /* ---------- menus stay OPAQUE (0.2's translucent menu material) ----------
         Every 0.2 menu is drawn by the shared MenuSurface primitive (shipped by
         @deepseek-ai/dsh-client-ui-primitives, consumed by dsh-client-ui-commands,
         dsh-client-ui-input-trigger, dsh-client-ui-model-selection, …): one
         [data-menu-material="translucent"] box whose ONLY paint is a z-index:-1 child

             .<hash>_material { position:absolute; inset:0; z-index:-1;
               border-radius:inherit;
               background: var(--dsw-menu-surface-fill);
               backdrop-filter: var(--dsw-menu-backdrop-filter); }

         with the two variables coming from the design platform:

             body { --dsw-menu-surface-fill:#f8f9fa94;      (light, 58% alpha)
                    --dsw-specific-menu:var(--dsw-menu-surface-fill); }
             body[data-ds-dark-theme] { --dsw-menu-surface-fill:#43454a73; }  (45%)
             [data-menu-material] { --dsw-menu-backdrop-filter:blur(40px) saturate(150%) }

         So the shipped menu surface is a TRANSLUCENT fill that leans on a 40px
         backdrop blur for its separation — and it is the only surface in the app the
         theme left alone.

         Reported symptom: the slash-command menu read as having NO background at all,
         with the transcript legible straight through it. There is no theme rule to
         blame (the theme paints no menu and sets no backdrop-filter outside glass),
         which fits the mechanism: the blur does not composite in this window (Chromium
         cannot blur a transparent window, which is why the same component ships a
         separate opaque `data-menu-backing` element for macOS only), so the 45% fill
         lands a couple of RGB steps away from the page colour — a panel that is
         technically painted and visually absent.

         The fix is one token, not a selector: the theme already owns an opaque
         popover colour (--dsw-alias-bg-overlay, the app's own "Overlay and popover
         background"), so the menu surface is pinned to it. Every MenuSurface inherits
         it, and so does --dsw-specific-menu, which is defined as
         var(--dsw-menu-surface-fill). A token cannot be renamed out from under us the
         way a hashed class name can.

         The blur is deliberately LEFT IN PLACE: an opaque fill paints over whatever
         the backdrop filter produced, so the platform keeps its own compositing path
         (and its macOS backing element) while the user sees a solid panel. Removing it
         would mean adding a rule that must match a hashed class, for no visual gain.

         Guarded by test/menu-surface.test.js: it renders this exact markup over a
         striped backdrop, proves the shipped default really is translucent (the
         fixture is not vacuous), then runs the real client.js and requires EVERY pixel
         inside the menu to be the opaque overlay colour. check.js pins the token name
         and its value, and selftest.js injects the shipped translucent literal back to
         prove the guard bites. */
      '--dsw-menu-surface-fill': {
        light: 'var(--edge-overlay)',
        dark: 'var(--edge-overlay)',
      },
      /* Turn-status label ("Deep diving…") on DSH 0.2, where it stopped being
         gradient text. The label moved from
         @deepseek-ai/dsh-client-ui-conversation (gradient text: background-image
         plus background-clip:text, recoloured by the two rules further down) to
         @deepseek-ai/dsh-client-ui-chat, whose whole rule is

             .<hash>_running {
               --dsw-alias-label-shimmer: var(--dsw-alias-label-deep-diving-shimmer);
               color: var(--dsw-alias-label-deep-diving);
             }

         over a masked-sweep overlay. There is no gradient left to repaint, so the
         label is retinted through the two tokens it actually reads — the same
         seam this layer already uses for every other colour:
             -deep-diving          rests the glyphs
             -deep-diving-shimmer  is what the mask reveals as the sweep
         Both are declared by @deepseek-ai/dsh-client-ui-theme on <body> and
         consumed ONLY by that one chat rule (verified against the shipped 0.2
         bundles), so retinting them here cannot bleed into another surface.
         Values reuse the measured --edge-status-* stops, so the contrast work
         documented on the turn-status rules below still applies unchanged: light
         dips to #6b5d00 / #3f3600, dark lifts to #fff500 / #a08a00, and the
         武陵青 palette swaps both pairs by redefining --edge-status-* on body. */
      '--dsw-alias-label-deep-diving': {
        light: 'var(--edge-status-light)',
        dark: 'var(--edge-status-dark)',
      },
      '--dsw-alias-label-deep-diving-shimmer': {
        light: 'var(--edge-status-light-mid)',
        dark: 'var(--edge-status-dark-mid)',
      },
    })

    disposeStyles = insertCss(`
      /* ak-build/2026-10-06-darker-dim — read this to tell which build's sheet is mounted.
         Kept literal (no template interpolation): check.js requires the stylesheet literal to be
         interpolation-free. test/theme-sheet-refresh.test.js pins it equal to SHEET_MARKER. */
      /* ================= typography: SCOPED to the theme's own elements =====
         The theme used to redeclare the app's two font TOKENS at :root:
             --dsw-font-family: Arial, ...      -> dropped, see below
             --ds-font-family-code: <mono list> -> dropped (see the note under it)
         and that is what broke third-party widgets.

         WHY IT BROKE THEM. The app declares --dsw-font-family at :root and then
         renders the UI root font from it — dsh-web-frontend ships exactly
         'body{font-family:var(--dsw-font-family, <system stack>)}'. A :root
         declaration WINS over the app's own :root one, so the entire UI root
         font became Arial; a widget injected into the app root (DeepSeek-
         Balance-Whale-Widget and friends) carries 'font-family:inherit' and
         therefore inherited Arial, losing its own face for its balance digits.
         The root font token is a SHARED PUBLIC INTERFACE of the app, not a
         theme-private knob: overriding it silently restyles every third-party
         component on the page, so this theme no longer touches either token.

         WHAT KEEPS THE LOOK. The theme's industrial editorial face lives in
         --edge-font, declared on body and applied ONLY to elements this theme
         owns: the boot plate, the watermark wordmark, and the settings panel.
         --dsw-font-family is still READ on those elements, as the trailing
         fallback of that stack, so nothing outside the theme is ever affected
         while the app's own font configuration stays part of the protocol. The
         ORDER of that stack matters and is documented where it is declared —
         flipping it re-types the boot plate.

         The code token went for the same reason. It is nearly identical to the
         app's own list (only the final fallbacks differ: Liberation Mono, Menlo,
         Courier, PingFang SC, Microsoft YaHei here vs Helvetica, Arial,
         sans-serif in the app), so dropping the override is visually inert on
         every code surface the theme does not own.

         NO GLOBAL TEXT PROPERTIES EITHER. There is deliberately no 'body { ... }'
         rule setting font-family / font-feature-settings / font-variant-*: all
         three inherit, so all three leak into injected third-party nodes exactly
         the way the token did. openType features belong on the specific elements
         that measure with them instead (see the loader's own tabular figures). */
      /* ================= accent palette =================================
         Every accent value in this stylesheet reads from the variables below
         instead of a literal, so the whole theme repaints from ONE declaration
         block. Two palettes ship:

           谷地黄 (default)  signal yellow  #fff500 — the site accent this palette started from
           武陵青            teal-cyan      #14d0d0

         WHY THIS BLOCK IS ON body AND NOT :root. The app applies its theme
         tokens as INLINE STYLES ON <body> (dsh-client-ui-layout does
         body.style.setProperty(name, value) for every token in the snapshot).
         A custom property declared at :root that substitutes one of those
         tokens is resolved AT THE html ELEMENT, where the token does not
         exist, so it becomes guaranteed-invalid and computes to nothing.
         That was not theory: the shipped --edge-line / --edge-paper /
         --edge-soft were declared at :root and measured EMPTY in a real
         browser, which silently disabled the themed scrollbar
         (scrollbar-color computed to 'auto') and left the table/hairline
         rules falling back. Moving them onto body is what makes them resolve
         (see test/probe-edge-line.js).

         The same fact is what makes the palette switch free: the theme's
         token overrides are values like var(--edge-accent), body carries the
         palette class, so flipping the class re-resolves every token and
         every rule below with NO JavaScript repaint at all — verified in a
         real browser (test/probe-css.js), not assumed.

         --edge-accent-rgb is the same colour as a bare comma list, because
         rgba() needs channels rather than a hex; substituting a comma-list
         custom property inside rgba() is legal and was verified in the same
         probe. Keeping both in one place is why the ~30 translucent washes
         did not have to become 60 declarations.

         Values are MEASURED, not chosen — see test/palette-contrast.test.js,
         which fails the build if any of them stops clearing its bar:
           ink #101110 on 谷地黄 16.50:1 · on 武陵青 6.62:1   (AA, solid chips)
           accent as dark-mode icon ink   15.26:1  ·  6.12:1  (>=3 icon floor) */
      body {
        --edge-accent: #fff500;
        --edge-accent-rgb: 255, 245, 0;
        /* Hover/pressed step of the accent, still carrying ink-coloured text:
           谷地黄 13.60:1 · 武陵青 5.31:1. */
        --edge-accent-deep: #e8e000;
        /* The one place the accent must survive on CREAM as a fill (the light
           deepseek-450 slot): pure signal yellow is nearly paper-white there,
           so light mode uses a darkened step of the same hue. */
        --edge-accent-onpaper: #d9c700;
        /* Turn-status gradient text stops — see the long note on that rule.
           Gradient text paints glyphs with EVERY stop, and reduced-motion pins
           the mid band permanently inside the letters, so all four clear AA
           against both surfaces of their mode:
             谷地黄 light #6b5d00 5.35 / mid #3f3600 9.82
                    dark  #fff500 15.26 / mid #a08a00 5.11
             武陵青 light #006a6a 5.22 / mid #003f3f 9.58
                    dark  #14d0d0 9.14 / mid #7ee7e7 12.06 */
        --edge-status-light: #6b5d00;
        --edge-status-light-mid: #3f3600;
        --edge-status-dark: #fff500;
        --edge-status-dark-mid: #a08a00;
        /* Hero backdrop glow alpha, per scheme. These are the measured values
           from the note on that rule: the replacement must not change how deep
           the hero reads compared with the app's own #6187D8 at 8%. */
        --edge-glow-light: 0.08;
        --edge-glow-dark: 0.05;
      }
      /* ---------- 武陵青 (teal-cyan, #14d0d0) ----------
         Only the palette changes here; paper, ink, borders and the semantic
         state colours (error red, success green, warn amber) are shared, so
         this block is exactly the set of values that carry the accent hue.

         BRIGHTNESS. The first version shipped #0daaaa (the literal
         rgb(13, 170, 170) that was asked for) and read as too dark next to the
         signal yellow it alternates with — measured, that is not a matter of
         taste: relative luminance was 31.7% against the yellow's 86.6%, so on a
         near-black page the cyan chip carried barely a third of the presence.
         #14d0d0 keeps the same hue axis (R low, G == B, so it is still the same
         teal rather than drifting toward grey-cyan) and lifts luminance to
         49.8% — 57% brighter — while every measured invariant still holds:
           ink #101110 on the chip   6.62 -> 9.88:1   (AA, and now better)
           chip as dark-mode ink     6.62 -> 9.88:1   (icon floor is 3)
         It is deliberately NOT taken to the yellow's luminance: past ~#16dcdc
         the light-mode chip stops separating from cream (1.39:1 at #16dcdc
         versus 1.56:1 here), and a cyan that pale reads white-ish rather than
         teal. This is the brightest step that still looks like 武陵青 in both
         schemes. */
      body.theme-ak-wuling {
        --edge-accent: #14d0d0;
        /* Same colour, channel-list form, for the ~30 rgba() washes. Derived from
           the hex above and kept beside it so the two cannot drift. */
        --edge-accent-rgb: 20, 208, 208;
        /* Hover step. Chosen to match the PERCEPTUAL drop the yellow palette uses
           (#fff500 -> #e8e000 is ΔY 19.9) rather than a copied percentage, so
           hover feels equally strong in both palettes: ΔY 19.7 here, 7.72:1 under
           ink text. */
        --edge-accent-deep: #10b8b8;
        /* Cyan is still far darker than yellow under ink (9.88 vs 16.50), so it
           needs no separate on-cream step — the accent itself reads on paper. */
        --edge-accent-onpaper: #14d0d0;
        /* Light mode dips deep, exactly as the yellow palette does: on cream no
           tint above #007070 clears AA on both surfaces, and that is a property of
           the paper, not of how bright the accent is — so these two are unchanged
           by the brightening. */
        --edge-status-light: #006a6a;
        --edge-status-light-mid: #003f3f;
        --edge-status-dark: #14d0d0;
        /* Dark mode LIFTS for its mid band instead of dipping like yellow's
           #a08a00: a darker cyan mid stop measured 3.54:1 and failed, because cyan
           at this lightness has less headroom below it than yellow does. Raised
           with the accent so the shimmer keeps a visible band: #7ee7e7 is 12.06:1
           and ΔY 40.6 from the accent (the old #4fd6d6 would now sit only ΔY 27.8
           away and read flatter). */
        --edge-status-dark-mid: #7ee7e7;
        /* Cyan carries real luminance where yellow is nearly neutral on cream, so
           the glow alphas are measured rather than inherited. Both stay inside the
           depth of the #6187D8 glow they replace (budget: light 9.90, dark 11.28).
           Dark comes down from 0.05 to 0.04 because the brighter accent lifts a
           near-black page faster: 0.05 now measures |ΔY| 7.6 where the old cyan
           measured 6.0. */
        --edge-glow-light: 0.08;
        --edge-glow-dark: 0.04;
      }
      /* Token-derived aliases. These MUST be on body, not :root — see above. */
      body {
        --edge-signal: var(--edge-accent);
        --edge-signal-dim: rgba(var(--edge-accent-rgb), 0.7);
        --edge-paper: var(--dsw-alias-bg-base);
        --edge-panel: var(--dsw-alias-bg-layer-1);
        --edge-line: var(--dsw-alias-border-l1);
        --edge-soft: var(--dsw-alias-bg-layer-2);
        /* The theme's own face. THREE things are deliberate here.

           (1) THE THEME STACK LEADS, with --dsw-font-family as a trailing
               fallback — and this ORDER was measured, not guessed. On this host
               the app's token renders in Segoe UI while the theme's stack renders
               Arial (same string, 81.688px vs 84.516px — measured by
               test/font-scope.test.js), so reading the token FIRST would silently
               repaint the boot plate, the watermark and the settings panel in a
               different face and invalidate every Arial-based proportion the
               loader was measured with (see the pixel-scan notes on the brand
               block). Leading with the theme stack keeps those surfaces exactly
               as they render today, which is what this fix has to promise: the
               request is to stop RESTYLING THE WHOLE APP, not to re-type the
               theme.
           (2) THE TOKEN IS STILL HONOURED, which is the protocol half of the
               requirement: it is read, not ignored, and it is what applies on a
               host with no Arial/Narrow/PingFang/YaHei at all — so a system
               carrying neither the theme stack nor a configured root font still
               lands on the app's stack instead of an arbitrary generic. A user
               who deliberately configures a root font family therefore still
               reaches the theme's own elements. If a future author wants the
               world's configuration to win OUTRIGHT over the theme face, swapping
               the two halves of this declaration is the whole change — say so in
               the commit, because it re-types the boot plate.
           (3) IT IS DECLARED ON body, NOT :root, for the same reason the aliases
               above are — see the app-token note higher up. The var() fallback is
               not decoration either: a custom property that substitutes a token
               missing at the element it is READ from computes to nothing, the
               trap that already shipped once with --edge-line
               (test/probe-edge-line.js). Resolving where the value is used cannot
               hit it. */
        --edge-font: Arial, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif, var(--dsw-font-family);
      }
      /* ---------- where the theme's face is applied, and where it is NOT ----------
         Only elements this theme created or owns. Every one of the three is a
         node the theme injected itself, so a third-party widget can never be an
         ancestor or a descendant of one of them — unless it attaches INSIDE the
         boot plate or the watermark, which it does not: those layers are
         pointer-events:none, aria-hidden chrome.
           [data-ak-loader]  the boot plate      (also carries the feature
                                                       settings the layout measures:
                                                       tabular figures + the
                                                       altered single-storey
                                                       glyph)
           [data-ak-watermark] the ARKNIGHTS wordmark
           .ak-settings      the 「明日方舟阵营主题」 panel root
         Deliberately NOT on body: the app renders its UI root font from
         var(--dsw-font-family) on body, and a body font-family here would
         re-break every installed widget exactly as the old :root override did. */
      [data-ak-loader],
      [data-ak-watermark],
      .ak-settings {
        font-family: var(--edge-font);
        font-feature-settings: "tnum" 1, "ss01" 1;
        font-variant-ligatures: no-common-ligatures;
      }
      /* The persist-mode watermark is a z-index:-1 child of the conversation column.
         Two properties are needed on that column, and only while the mark is mounted
         there (the :has() guard makes this a no-op whenever the feature is off):
           isolation: isolate — without a stacking context, z-index:-1 escapes to the
             nearest ancestor context and paints behind the column's own opaque
             background, i.e. invisible.
           position: relative — the column ships as position:static, so an absolutely
             positioned child would resolve against the app frame instead and spill
             across the sidebar. This makes the column the containing block so
             inset:0 means "exactly this column".
         Every absolute descendant the app itself renders (header:after, tab:after,
         heroGlow, the overlay composer seat) already has a positioned ancestor
         nearer than this column, so their containing blocks are unchanged. */
      /* Suffix-only match: the :has(>) guard pins this to exactly the element the
         JS mounted the watermark into (only the conversation column or the app
         frame ever hosts it), so the broad '_root' suffix cannot over-match. */
      [class$='_root']:has(> [data-ak-watermark]) {
        isolation: isolate;
        position: relative;
      }
      /* The persist FALLBACK mounts inside the app FRAME on pages with no
         conversation column (a full-page settings view). Same reason as the rule
         above: without isolation, the mark's z-index:-1 escapes to the root
         stacking context and paints below the frame's own opaque background —
         i.e. it never shows, which is exactly what the old body-level fallback
         did. The frame is already position:relative, so
         isolation alone is enough here. The :has() guard keeps the frame's
         stacking behaviour stock whenever the mark is not mounted in it. */
      [class*='_frame']:has(> [data-ak-watermark]) {
        isolation: isolate;
      }
      /* The mark sits behind text, so it must never intercept selection or clicks. */
      [data-ak-watermark] {
        pointer-events: none !important;
      }
      /* ---------- watermark strength, per colour scheme ----------
         One variable per scheme instead of one number in JS, because the two
         schemes genuinely need different alphas and a scheme flip must re-resolve
         with no JS involved.

         Computed, not eyeballed — contrast of the composited ink against its own
         background (the mark is always BEHIND text, so this measures how loudly
         the decoration competes for attention, never foreground readability):

              alpha | dark #101110  | light #e8e8e2
              0.07  | 1.171 : 1     | 1.152 : 1
              0.085 | 1.215 : 1     | 1.186 : 1
              0.10  | 1.278 : 1     | 1.225 : 1
              0.13  | 1.406 : 1     | 1.310 : 1   <- previous dark value
              0.16  | 1.541 : 1     | 1.398 : 1   <- previous persist value

         Dark mode is the reported problem: adding luminance to a near-black page
         makes the wordmark read far louder than the same alpha subtracted from
         cream, and at 0.13/0.16 it visibly cluttered the UI. Dark therefore drops
         to 0.085 (1.215:1) — still clearly present, no longer competing. Light
         keeps more strength (0.13) because cream needs it to register at all;
         1.310:1 there looks quieter than 1.215:1 on black.
         Floor is ~1.06:1, below which the mark reads as absent. */
      body {
        --edge-wm-alpha: 0.13;
      }
      body[data-ds-dark-theme] {
        --edge-wm-alpha: 0.085;
      }
      /* Translation-proof glyphs: the wordmark is drawn from the CSS 'content'
         property, not a DOM text node, so page translators (which walk text nodes)
         have nothing to rewrite. The element's own text stays empty; ::before
         carries the letters. */
      [data-ak-watermark]::before {
        content: 'ARKNIGHTS';
        display: block;
        white-space: nowrap;
      }
      /* Optional bounded frost. No full-window blur, nested filters or animation. */
      body[data-ak-glass] {
        --edge-glass-fill: 248 247 240;
        --edge-glass-alpha: .8;
        --edge-glass-blur: 14px;
        --edge-glass-edge: rgb(255 255 255 / .65);
        --edge-glass-sheen: rgb(255 255 255 / .35);
      }
      body[data-ak-glass][data-ds-dark-theme] {
        --edge-glass-fill: 31 36 34;
        --edge-glass-alpha: .76;
        --edge-glass-edge: rgb(255 255 255 / .18);
        --edge-glass-sheen: rgb(255 255 255 / .07);
      }
      body[data-ak-glass='subtle'] { --edge-glass-alpha: .68; --edge-glass-blur: 8px; }
      body[data-ak-glass='strong'] { --edge-glass-alpha: .9; --edge-glass-blur: 22px; }
      body[data-ak-glass='subtle'][data-ds-dark-theme] { --edge-glass-alpha: .64; }
      body[data-ak-glass='strong'][data-ds-dark-theme] { --edge-glass-alpha: .88; }
      /* WHY [data-sidebar-right-open]: the docked right panel div (SidebarPanel)
         is position:absolute; top:0;bottom:0;right:0 and stays in the DOM even
         when collapsed — only its inner [data-dockkit-host=dock] child is slid
         off-screen with visibility:hidden. Frosting the bare 'push' panel would
         leave an opaque glass rectangle covering the right half of the screen
         while collapsed, so frost it only when the panel is expanded. */
      /* WHY no backdrop-filter on [data-composer-card]: a backdrop-filter (like
         any filter) makes the element the containing block for position:fixed
         descendants. The send-button tooltip is fixed-positioned from viewport
         coords, so blurring the card resolved its coords against the shrunk
         card box — pushing it past the card's right edge and making its
         ResizeObserver re-measure in a loop (visible layout jitter). The card
         keeps the same opaque glass fill without the filter; the docked panel
         hosts no fixed tooltip so it can keep the real frost. See glass.md. */
      body[data-ak-glass]
        :is([data-composer-card], [data-sidebar-right-panel='push'][data-sidebar-right-open]) {
        background-color: rgb(var(--edge-glass-fill) / var(--edge-glass-alpha)) !important;
        background-image: linear-gradient(145deg, var(--edge-glass-sheen), transparent 58%),
          radial-gradient(ellipse at 0% 0%, color-mix(in srgb, var(--edge-accent) 10%, transparent), transparent 75%) !important;
        --dsw-elevation-stroke-color: var(--edge-glass-edge);
      }
      body[data-ak-glass] [data-sidebar-right-panel='push'][data-sidebar-right-open] {
        -webkit-backdrop-filter: blur(var(--edge-glass-blur)) saturate(1.05);
        backdrop-filter: blur(var(--edge-glass-blur)) saturate(1.05);
      }
      body[data-ak-glass] [data-slot='sidebar'] > div {
        background-image: linear-gradient(145deg, var(--edge-glass-sheen), transparent 58%),
          radial-gradient(ellipse at 0% 0%, color-mix(in srgb, var(--edge-accent) 8%, transparent), transparent 75%);
        box-shadow: inset -1px 0 0 var(--edge-glass-edge);
      }
      @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
        body[data-ak-glass]
          :is([data-composer-card], [data-sidebar-right-panel='push'][data-sidebar-right-open]) {
          background-color: rgb(var(--edge-glass-fill) / .96) !important;
        }
      }
      @media (prefers-reduced-transparency: reduce) {
        body[data-ak-glass]
          :is([data-composer-card], [data-sidebar-right-panel='push'][data-sidebar-right-open]) {
          background-color: rgb(var(--edge-glass-fill)) !important;
          -webkit-backdrop-filter: none; backdrop-filter: none;
        }
      }
      /* The composer card never gets a backdrop-filter in any tier or media state
         (fixed-descendant containing block — see the WHY comment above). */
      ::selection {
        color: #000;
        background: var(--edge-signal, var(--edge-accent));
      }
      /* Square corners (default): zero EVERY classed element, then restore circles/pills below.
         body.theme-ak-round disables all of this and restores app-native rounding. */
      body:not(.theme-ak-round) button,
      body:not(.theme-ak-round) input,
      body:not(.theme-ak-round) textarea,
      body:not(.theme-ak-round) select,
      body:not(.theme-ak-round) [role='button'],
      body:not(.theme-ak-round) [role='dialog'],
      body:not(.theme-ak-round) [role='menu'],
      body:not(.theme-ak-round) [role='tooltip'],
      body:not(.theme-ak-round) [role='tab'] {
        border-radius: 0 !important;
      }
      body:not(.theme-ak-round) [class] {
        border-radius: 0 !important;
      }
      body:not(.theme-ak-round) [class*='avatar'],
      body:not(.theme-ak-round) [class*='Avatar'],
      body:not(.theme-ak-round) [class*='spinner'],
      body:not(.theme-ak-round) [class*='Spinner'],
      body:not(.theme-ak-round) [class*='dot'],
      body:not(.theme-ak-round) [class*='Dot'],
      body:not(.theme-ak-round) [class*='actionButton' i],
      body:not(.theme-ak-round) [class$='_iconButton'] {
        border-radius: 50% !important;
        /* The host roots corner-shape at superellipse(1.5) (Chrome 139+ draws
           corners as squircles). 50% of a square is only a CIRCLE when the
           shape is round, so every re-circled element must say so too. */
        corner-shape: round !important;
      }
      /* Hover feedback should track the pointer immediately; the app's broad
         transition rule otherwise makes colour changes feel delayed. */
      button,
      [role='button'] {
        transition: none !important;
      }
      body:not(.theme-ak-round) [class*='scrollbar'],
      body:not(.theme-ak-round) [class*='Scrollbar'] {
        border-radius: 0 !important;
      }
      * {
        scrollbar-width: thin;
        scrollbar-color: var(--edge-line) transparent;
      }
      /* ---------- Light mode: deepen tertiary/secondary labels for icon visibility ---------- */
      body:not([data-ds-dark-theme]) {
        --dsw-alias-label-tertiary: #6a6d68;
        --dsw-alias-label-caption: #5a5d58;
        --dsw-alias-label-dimmed: #9a9d98;
        --edge-btn-muted: #dcddd6;
      }
      /* ---------- Neutralize remaining DeepSeek brand blues ---------- */
      body {
        --dsw-static-deepseek-50: #dcddd6;
        --dsw-static-deepseek-100: #dcddd6;
        --dsw-static-deepseek-200: #d8d9d5;
        --dsw-static-deepseek-300: #c8cac5;
        --dsw-static-deepseek-400: #757874;
        --dsw-static-deepseek-450: var(--edge-accent-onpaper);
        --dsw-static-deepseek-500: #101110;
        --dsw-static-deepseek-600: #101110;
        --dsw-static-deepseek-800: #3a3c38;
        --dsw-static-deepseek-900: #2a2c2a;
        --dsw-static-blue-900: #101110;
        --dsw-alias-button-info-fill: #101110;
        --dsw-alias-button-info-hover: #2a2b28;
        --dsw-alias-state-business-primary: #101110;
        --dsw-alias-state-business-tertiary: rgba(var(--edge-accent-rgb), 0.14);
        --dsw-alias-brand-primary-new-colorprimary-new-color: #101110;
        --dsw-alias-label-primary-bluish: #101110;
        --dsw-specific-bubble: #f2f2ec;
        --dsw-specific-bubble-highlight: #dcddd6;
        --dsw-specific-sidebar-nav-item-active-accent: #101110;
        --dsw-alias-interactive-bg-hover-accent: rgba(var(--edge-accent-rgb), 0.14);
        --dsw-alias-border-l3: #b6b8b3;
        --dsw-alias-border-l4: #9a9d98;
      }
      body[data-ds-dark-theme] {
        --dsw-static-deepseek-50: #242624;
        --dsw-static-deepseek-100: #242624;
        --dsw-static-deepseek-200: #2f312e;
        --dsw-static-deepseek-300: #3a3c38;
        --dsw-static-deepseek-400: #898d89;
        --dsw-static-deepseek-450: var(--edge-accent);
        --dsw-static-deepseek-500: #f5f5f0;
        --dsw-static-deepseek-600: #d8d9d5;
        --dsw-static-deepseek-800: #343633;
        --dsw-static-deepseek-900: #242624;
        --dsw-static-blue-900: #f5f5f0;
        --dsw-alias-button-info-fill: var(--edge-accent);
        --dsw-alias-button-info-hover: var(--edge-accent);
        --dsw-alias-state-business-primary: var(--edge-accent);
        --dsw-alias-state-business-tertiary: rgba(var(--edge-accent-rgb), 0.22);
        --dsw-alias-brand-primary-new-colorprimary-new-color: var(--edge-accent);
        --dsw-alias-label-primary-bluish: #f5f5f0;
        --dsw-specific-bubble: #181a18;
        --dsw-specific-bubble-highlight: #242624;
        --dsw-specific-sidebar-nav-item-active-accent: var(--edge-accent);
        --dsw-alias-interactive-bg-hover-accent: rgba(var(--edge-accent-rgb), 0.22);
        --dsw-alias-border-l3: #4f534f;
        --dsw-alias-border-l4: #5f6460;
        --edge-btn-muted: #3a3c38;
      }
      /* ---------- Signal yellow everywhere (light: visible but soft) ---------- */
      body {
        --dsw-alias-interactive-bg-hover: rgba(var(--edge-accent-rgb), 0.16);
        --dsw-alias-interactive-bg-active: rgba(var(--edge-accent-rgb), 0.26);
        --dsw-alias-interactive-bg-hover-solid: var(--edge-accent);
        --dsw-alias-bg-multi-select: rgba(var(--edge-accent-rgb), 0.16);
        --dsw-alias-bg-skeleton: rgba(var(--edge-accent-rgb), 0.12);
        --dsw-alias-markdown-citation: rgba(var(--edge-accent-rgb), 0.16);
        --dsw-alias-markdown-code-block-banner: rgba(var(--edge-accent-rgb), 0.10);
        --dsw-alias-markdown-code-segment-selected: rgba(var(--edge-accent-rgb), 0.22);
        --dsw-alias-markdown-code-segment-unselected: rgba(var(--edge-accent-rgb), 0.06);
        --dsw-alias-markdown-inline-code: rgba(var(--edge-accent-rgb), 0.14);
        --dsw-alias-markdown-tag: rgba(var(--edge-accent-rgb), 0.18);
        --dsw-alias-scrollbar-bg-l1: transparent;
        --dsw-alias-scrollbar-bg-l2: transparent;
        --dsw-alias-scrollbar-hover-l1: var(--edge-accent);
        --dsw-alias-scrollbar-hover-l2: var(--edge-accent);
        --dsw-specific-sidebar-nav-item-active: rgba(var(--edge-accent-rgb), 0.16);
        --dsw-specific-sidebar-nav-item-hover: rgba(var(--edge-accent-rgb), 0.12);
      }
      body[data-ds-dark-theme] {
        --dsw-alias-interactive-bg-hover: rgba(var(--edge-accent-rgb), 0.18);
        --dsw-alias-interactive-bg-active: rgba(var(--edge-accent-rgb), 0.28);
        --dsw-alias-interactive-bg-hover-solid: var(--edge-accent);
        --dsw-alias-bg-multi-select: rgba(var(--edge-accent-rgb), 0.18);
        --dsw-alias-bg-skeleton: rgba(var(--edge-accent-rgb), 0.14);
        --dsw-alias-markdown-citation: rgba(var(--edge-accent-rgb), 0.20);
        --dsw-alias-markdown-code-block-banner: rgba(var(--edge-accent-rgb), 0.12);
        --dsw-alias-markdown-code-segment-selected: rgba(var(--edge-accent-rgb), 0.26);
        --dsw-alias-markdown-code-segment-unselected: rgba(var(--edge-accent-rgb), 0.08);
        --dsw-alias-markdown-inline-code: rgba(var(--edge-accent-rgb), 0.18);
        --dsw-alias-markdown-tag: rgba(var(--edge-accent-rgb), 0.22);
        --dsw-alias-scrollbar-bg-l1: transparent;
        --dsw-alias-scrollbar-bg-l2: transparent;
        --dsw-alias-scrollbar-hover-l1: var(--edge-accent);
        --dsw-alias-scrollbar-hover-l2: var(--edge-accent);
        --dsw-specific-sidebar-nav-item-active: rgba(var(--edge-accent-rgb), 0.20);
        --dsw-specific-sidebar-nav-item-hover: rgba(var(--edge-accent-rgb), 0.16);
      }
      input, textarea, [contenteditable='true'] {
        caret-color: var(--edge-accent);
      }
      :focus-visible {
        outline: 2px solid var(--edge-accent) !important;
        outline-offset: 1px;
      }
      a {
        text-decoration-thickness: 1px;
      }
      a:hover {
        text-decoration-color: var(--edge-accent);
      }
      body[data-ds-dark-theme] a:hover {
        color: var(--edge-accent);
      }
      ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }
      ::-webkit-scrollbar-thumb {
        border-radius: 0;
        background: var(--edge-line);
      }
      ::-webkit-scrollbar-thumb:hover {
        background: var(--edge-accent) !important;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      /* ---------- Hover text contrast (reference page inversion) ---------- */
      /* Note: plain buttons are excluded — their own fill/text color must survive hover
         (e.g. yellow toggle button keeps black text; white-on-dark send button stays white). */
      :is([role='tab'], [role='menuitem'], [role='option'], [role='link'], [role='treeitem'], [role='checkbox'], [role='switch'], [role='radio'], [role='combobox'], [class*='nav-item' i], [class*='menu-item' i], [class*='list-item' i], [class*='session-item' i], [class*='workspace-item' i], [class*='search-result' i], [class*='item' i], [class*='tab' i], [class*='card' i], [class*='row' i], [class*='tool' i], [class*='composer' i]):hover {
        color: var(--dsw-alias-label-primary) !important;
      }
      /* ---------- Workspace browser rows (ui-sidebar) ---------- */
      /* Hash-free rebuild of the old .YDXeBa_* rules: those class names are
         '<hash>_suffix' CSS-module exports and 0.1.2-rc.1 rehashed every module,
         killing all 33 pinned hashes. Matching survives on the SEMANTIC suffix
         ('_sessionRow' etc.), scoped to the sidebar column — '_slot'/'_row' style
         suffixes are too generic to match bare, but the sidebar column suffix is
         unique to the layout frame (the same hook findAppFrame()
         already relies on). Compound states match on substrings, NOT [class$=]: a
         suffix match needs the WHOLE class attribute to end with the string, so
         'x_sessionRow x_selected' would silently miss the second condition.
         '_unselected' is safe against '_selected' here — the leading underscore
         breaks the substring. */
      [class$='_sidebarCol'] [class*='_slot'] {
        color: var(--dsw-alias-brand-primary) !important;
      }
      [class$='_sidebarCol'] [class*='_projectRow']:hover,
      [class$='_sidebarCol'] [class*='_sessionRow']:hover,
      [class$='_sidebarCol'] [class*='_sessionRow'][class*='_selected'],
      [class$='_sidebarCol'] [class*='_searchResultRow']:hover,
      [class$='_sidebarCol'] [class*='_searchResultRow'][class*='_selected'] {
        background: rgba(var(--edge-accent-rgb), 0.22) !important;
      }
      [class$='_sidebarCol'] [class*='_projectRow']:hover *,
      [class$='_sidebarCol'] [class*='_sessionRow']:hover *,
      [class$='_sidebarCol'] [class*='_sessionRow'][class*='_selected'] *,
      [class$='_sidebarCol'] [class*='_searchResultRow']:hover *,
      [class$='_sidebarCol'] [class*='_searchResultRow'][class*='_selected'] * {
        color: #000 !important;
      }
      /* ---------- Light mode: workspace folder / icon buttons ink ---------- */
      body:not([data-ds-dark-theme]) [class$='_sidebarCol'] [class*='_folder'],
      body:not([data-ds-dark-theme]) [class$='_sidebarCol'] [class*='_chevron'],
      body:not([data-ds-dark-theme]) [class$='_sidebarCol'] [class*='_arrow'],
      body:not([data-ds-dark-theme]) [class$='_sidebarCol'] [class*='_iconButton'],
      body:not([data-ds-dark-theme]) [class$='_sidebarCol'] [class*='_searchButton'],
      body:not([data-ds-dark-theme]) [class$='_sidebarCol'] [class*='_clearButton'] {
        color: #101110 !important;
      }
      /* ---------- Dark mode: solid signal-yellow inversions ---------- */
      body[data-ds-dark-theme] [class$='_sidebarCol'] [class*='_projectRow']:hover,
      body[data-ds-dark-theme] [class$='_sidebarCol'] [class*='_sessionRow']:hover,
      body[data-ds-dark-theme] [class$='_sidebarCol'] [class*='_sessionRow'][class*='_selected'],
      body[data-ds-dark-theme] [class$='_sidebarCol'] [class*='_searchResultRow']:hover,
      body[data-ds-dark-theme] [class$='_sidebarCol'] [class*='_searchResultRow'][class*='_selected'] {
        background: var(--edge-accent) !important;
      }
      /* WHY '_badge' not bare 'badge': app CSS-module badges are '<hash>_badge'
         (zf92ZW_badge footer, dlU_AG_badge …), but third-party plugins name
         their own widgets without the underscore word boundary —
         dsh-codearts-auth paints a 280px .dim-jh-badgePop account card whose
         EVERY class contains 'badge', so the bare substring hover turned the
         whole popup solid yellow. Same lesson as the '_add' hook (see
         selector-guard part 3). */
      body[data-ds-dark-theme] [class*='_badge' i]:hover,
      body[data-ds-dark-theme] [class*='_badge' i][data-active] {
        background: var(--edge-accent) !important;
      }
      /* ---------- Dark mode: icon buttons (plus / ellipsis / stop / actions) ---------- */
      /* The cordis approval trio is EXCLUDED here. Those three buttons carry their own
         solid fill (signal yellow for approve, error red for decline) from the approval
         block below, so a signal-yellow glyph renders yellow-on-yellow — an invisible
         check. A 'body[data-ds-dark-theme] [attr]' selector (0,2,1) also outranks the
         plain '[data-cordis-approve]' (0,1,0) rules below, so source order cannot undo it:
         the exclusion has to happen in this selector. Their ink is set below. */
      body[data-ds-dark-theme] [class$='_iconButton'],
      body[data-ds-dark-theme] [data-cordis-switch],
      body[data-ds-dark-theme] [class*='actionButton' i]:not([data-cordis-approve]):not([data-cordis-approve-plugin]):not([data-cordis-decline]) {
        color: var(--edge-accent) !important;
      }
      body[data-ds-dark-theme] [class$='_iconButton']:hover:not(:disabled),
      body[data-ds-dark-theme] [data-cordis-switch]:hover:not(:disabled),
      body[data-ds-dark-theme] [class*='actionButton' i]:not([data-cordis-approve]):not([data-cordis-approve-plugin]):not([data-cordis-decline]):hover:not(:disabled) {
        color: #000 !important;
        background: var(--edge-accent) !important;
      }
      /* ---------- Cordis approval buttons (allow once / allow plugin / decline) ---------- */
      /* Each button is a solid chip, so its glyph must contrast with its OWN fill:
         black check on signal yellow, white X on error red. The icons are
         fill="currentColor" svg paths, so 'color' alone drives the glyph — but the
         svg/path are also targeted explicitly, because any inherited-color rule that
         wins on a descendant would otherwise repaint the glyph and hide it again. */
      [data-cordis-approve],
      [data-cordis-approve-plugin],
      [data-cordis-approve] svg,
      [data-cordis-approve-plugin] svg,
      [data-cordis-approve] svg path,
      [data-cordis-approve-plugin] svg path {
        color: #101110 !important;
        fill: currentColor !important;
      }
      [data-cordis-approve],
      [data-cordis-approve-plugin] {
        background: var(--edge-accent) !important;
      }
      [data-cordis-decline],
      [data-cordis-decline] svg,
      [data-cordis-decline] svg path {
        color: #fff !important;
        fill: currentColor !important;
      }
      [data-cordis-decline] {
        background: var(--dsw-alias-state-error-primary) !important;
      }
      /* The second check of the double-check icon is dimmed to .7 opacity by the panel's
         own stylesheet; on the solid chip keep both strokes at full ink. */
      [data-cordis-approve-plugin] [class$='_doubleCheck'] svg {
        opacity: 1 !important;
      }
      [data-cordis-approve]:hover:not(:disabled),
      [data-cordis-approve-plugin]:hover:not(:disabled) {
        background: var(--edge-accent-deep) !important;
      }
      [data-cordis-decline]:hover:not(:disabled) {
        background: #d6281d !important;
      }
      /* ---------- 审批弹窗：全屏白条 + 上下遮罩（抽卡确认框式） ----------
         The shipped panel is a rounded warn-bordered card parked inside the
         composer column (max-width: --dsh-chat-content-width). The reference
         dialog is a different shape entirely: a PAPER BAND that runs from the
         left screen edge to the right, vertically centred, with the dimming
         only above and below it. That is reproduced without touching React's
         tree: the panel's own root becomes a fixed full-viewport flex layer
         whose translucent black background is the mask, and the card is
         stretched to the band. The band paints opaque over the middle of the
         mask, so the darkening only ever shows above and below it — the
         「上下有遮罩，不是全屏」 shape, with zero extra DOM.
         Selectors are hash-free by project law (test/selector-guard.test.js):
         the root is pinned by its SEMANTIC data-approval-key attribute (the
         same anchor the attention watcher uses) and the children by their
         CSS-module SUFFIXES, each rule scoped under the root so a generic
         '_card' / '_body' elsewhere in the app is untouched.
         position:fixed escapes the composer column's width cap and the
         frame's overflow clip; no ancestor between the seat and the viewport
         carries a transform/filter, and if a future one did, the band simply
         stays in flow — degraded position, never a broken dialog. */
      [data-approval-key] {
        position: fixed !important;
        inset: 0 !important;
        z-index: 1000;
        display: flex !important;
        flex-direction: column;
        justify-content: center;
        align-items: stretch;
        padding: 0 !important;
        background: rgba(6, 6, 6, 0.62);
      }
      /* The band: square, full-bleed, paper. The zero-radius pass in round
         mode would restore the app's --dsw-radius-xl here, and a rounded band
         contradicts the reference — pin it flat with priority. */
      [data-approval-key] > [class$='_card'] {
        width: 100%;
        max-width: none !important;
        box-sizing: border-box;
        border: none !important;
        border-radius: 0 !important;
        background: var(--edge-paper) !important;
        box-shadow: none !important;
        padding: 26px 24px 22px !important;
      }
      /* 「等待审批」 strip: the reference top line is a bare centred caption,
         not a tinted bar — drop the warn fill, keep the dot + copy. */
      [data-approval-key] [class*='_strip'] {
        justify-content: center;
        background: transparent !important;
        padding: 0 0 6px !important;
        font-size: 12px;
        letter-spacing: 0.04em;
      }
      [data-approval-key] [class*='_body'] {
        align-items: center;
        text-align: center;
        padding: 4px 0 0 !important;
        gap: 8px !important;
      }
      [data-approval-key] [class*='_headline'] {
        font-size: 17px;
        line-height: 1.5;
      }
      [data-approval-key] [class*='_command'] {
        text-align: center;
        word-break: break-all;
      }
      /* Two stadium actions straddling the band's lower half, cancel-left /
         confirm-right like the reference. The blanket square pass
         (body:not(.theme-ak-round) [class], 0,2,1 !important) and the
         plain button rule both try to flatten these, so every radius here
         rides (0,2,2) with !important — and the stadium holds in BOTH corner
         modes, exactly like the balance pill. corner-shape: round is what
         actually draws the 「半圆」: the host roots corner-shape at
         superellipse(1.5), which renders even a correctly clamped 999px
         radius as a squircle with ~3/4-radius caps (measured on Chrome 154:
         a 36px button drew 14px caps), so the declaration must be undone
         right here, on the same element that asks for the stadium. */
      [data-approval-key] [class*='_actionRow'] {
        justify-content: center;
        gap: 28px;
        padding: 22px 0 2px !important;
      }
      body [data-approval-key] [class*='_actionRow'] button {
        flex: none;
        min-width: 190px;
        padding: 9px 26px !important;
        border-radius: 999px !important;
        corner-shape: round !important;
        border: none !important;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.06em;
        cursor: pointer;
      }
      /* 拒绝 = the dark capsule with a white ✕; 允许一次 = the signal-yellow
         capsule with the ◎ target. Ink-on-accent contrast is the same pairing
         test/palette-contrast.test.js pins at AA for every other solid chip. */
      body [data-approval-key] [class*='_actionRow'] button:first-child {
        background: #33312e !important;
        color: #f5f5f0 !important;
      }
      body [data-approval-key] [class*='_actionRow'] button:first-child:hover:not(:disabled) {
        background: #46433f !important;
      }
      body [data-approval-key] [class*='_actionRow'] button:last-child {
        background: var(--edge-accent) !important;
        color: #101110 !important;
      }
      body [data-approval-key] [class*='_actionRow'] button:last-child:hover:not(:disabled) {
        background: var(--edge-accent-deep) !important;
      }
      body [data-approval-key] [class*='_actionRow'] button:disabled {
        opacity: 0.45;
      }
      body [data-approval-key] [class*='_actionRow'] button:first-child::after {
        content: '✕';
        margin-left: 10px;
        font-weight: 700;
      }
      body [data-approval-key] [class*='_actionRow'] button:last-child::after {
        content: '◎';
        margin-left: 10px;
      }
      /* ---------- 完全权限确认框：通栏白条（左右到屏幕边缘）+ 上下遮罩 ----------
         The 「确认启用完全权限？」 box is NOT the approval panel above: it is
         the shared ui-primitives Modal (a portal on <body>: role=presentation
         root > mask + role=dialog card) wrapped by RiskConfirmation, whose
         ONLY semantic mark is the _confirmation class it adds to the dialog.
         Reference shape (the source game's confirm dialog): the paper band runs
         edge to edge HORIZONTALLY only — vertically it is one content-high
         strip centred in the viewport, the existing full-viewport mask —
         already there, already behind the card — shows above and below it,
         and the capsule pair STRADDLES the band's bottom edge (upper half on
         paper, lower half over the dim). NOT a full-screen white takeover,
         and the band stays the bright paper in the dark palette too. Scoping is exact: every rule
         hangs under [role='dialog'][class*='_confirmation'], and the one
         rule that must reach the shared root (its 24px side padding would
         strand the band short of the screen edges) addresses it through
         :has() so plain modals elsewhere keep the app's compact card.
         This module's class names put the semantic word in the MIDDLE
         (_header_o6lrb_71), unlike the suffix form used above, so the child
         hooks are [class*='_word'] substrings — still hash-free and still
         pinned by test/selector-guard.test.js. */
      [role='presentation']:has(> [role='dialog'][class*='_confirmation']) {
        padding: 0 !important;
      }
      [role='dialog'][class*='_confirmation'] {
        width: 100% !important;
        max-width: none !important;
        max-height: none !important;
        box-sizing: border-box;
        gap: 16px;
        /* no bottom padding: the capsule pair is the last content, so the box
           ends at the capsules and the band can stop through their middle */
        padding: 28px 0 0 !important;
        border: none !important;
        /* flat band in BOTH corner modes: the square pass already zeroes it,
           and round mode must not hand back --dsw-radius-panel */
        border-radius: 0 !important;
        /* The reference band is the bright paper in BOTH palettes — in the dark
           scheme the app's paper token is #101110, so var(--edge-paper) painted
           a dark strip and the band stopped reading as 白条. Pinned literal
           #f5f5f0 (the theme's paper white) instead. The fill covers all but
           the bottom 18px of the box — half of the 36px capsule — so the caps
           straddle the band's bottom edge: upper half on paper, lower half over
           the dim mask that already sits behind the card. */
        background: linear-gradient(#f5f5f0, #f5f5f0) 0 0 / 100% calc(100% - 18px) no-repeat !important;
        /* A box shadow would wrap the whole box and float under the hanging
           caps; drop-shadow follows the PAINTED silhouette — band edge and
           capsule shapes — which is the shadow the reference draws. */
        box-shadow: none !important;
        filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.35));
        font-family: var(--edge-font);
      }
      /* Ink side of the paper: in the dark palette the app's labels are
         #f5f5f0 (paper-on-dark) and would vanish on the white band, so the
         dialog scope re-declares the label tokens as ink — every var() the
         copy references flips at once, while elements carrying their own
         colour (a danger-red warning line) keep it. The explicit hooks catch
         the title and close glyph even if they switch token names. */
      body[data-ds-dark-theme] [role='dialog'][class*='_confirmation'] {
        --dsw-alias-label-primary: #101110;
        --dsw-alias-label-secondary: #4a4c48;
        --dsw-alias-label-primary-bluish: #101110;
        color: #101110;
      }
      body[data-ds-dark-theme] [role='dialog'][class*='_confirmation'] [class*='_title'],
      body[data-ds-dark-theme] [role='dialog'][class*='_confirmation'] [class*='_body'],
      body[data-ds-dark-theme] [role='dialog'][class*='_confirmation'] [class*='_close'] {
        color: #101110 !important;
      }
      /* The dark scheme needs a DARKER dim. The app's mask token is black at
         50% (light 24%), which over the #101110 page leaves the transcript
         behind the band fully legible — the dim reads as grey haze, not
         blackout, so the band stops floating. Pinned to black at 80% so the
         band sits on near-black like the reference. Scoped to this modal's
         root only (the mask element itself is hash-named; the only hash-free
         mark it carries is aria-hidden) — every other modal keeps the app's
         own dim, and the light palette is untouched. */
      body[data-ds-dark-theme] [role='presentation']:has(> [role='dialog'][class*='_confirmation']) > [aria-hidden='true']::after {
        background: rgba(0, 0, 0, 0.8) !important;
      }
      [role='dialog'][class*='_confirmation'] [class*='_header'] {
        position: relative;
        justify-content: center;
        padding: 0 56px !important;
      }
      [role='dialog'][class*='_confirmation'] [class*='_title'] {
        font-size: 19px;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-align: center;
      }
      [role='dialog'][class*='_confirmation'] [class*='_close'] {
        position: absolute;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
      }
      [role='dialog'][class*='_confirmation'] [class*='_body'] {
        align-items: center;
        gap: 16px;
        margin-top: 0;
        padding: 0 24px !important;
      }
      /* DSH ships TWO CSS-module naming schemes at once: most packages emit
         'hash_local' (so [class*='_local'] hits, e.g. bhn1Oq_sessionRow),
         while this one emits 'local_hash' — the real class is
         acknowledgement_cjd8z_38, so the underscore-first form alone matched
         nothing and these three rules were dead code. Match both shapes.
         (Found by 'node test/anchors.js' while adapting to 0.2.1-rc.5.
         No backticks in here: this sheet is embedded into a JS template.) */
      [role='dialog'][class*='_confirmation'] :is([class*='_acknowledgement'], [class*='acknowledgement_']) {
        max-width: 640px;
        margin-top: 0;
      }
      [role='dialog'][class*='_confirmation'] :is([class*='_acknowledgement'], [class*='acknowledgement_']) input {
        accent-color: var(--edge-accent);
      }
      [role='dialog'][class*='_confirmation'] [class*='_warning'] {
        max-width: 640px;
      }
      [role='dialog'][class*='_confirmation'] [class*='_footer'] {
        justify-content: center;
        gap: 28px;
        padding: 0 !important;
      }
      /* Same capsule pair as the approval band — cancel dark, confirm signal
         yellow. The (0,3,1)+!important route keeps the stadium alive through
         the blanket square pass, exactly like [data-approval-key] above. The
         confirm button is disabled until the checkbox is ticked; the app's
         own disabled paint is replaced with a dim so the yellow never turns
         into an app-grey slab. corner-shape: round undoes the host's
         superellipse(1.5) root default — without it the 999px radius draws
         as a squircle, not the reference's semicircular caps. */
      body [role='dialog'][class*='_confirmation'] [class*='_modalAction'],
      body [role='dialog'][class*='_confirmation'] [class*='_confirmAction'] {
        flex: none;
        min-width: 190px;
        padding: 9px 26px !important;
        border-radius: 999px !important;
        corner-shape: round !important;
        border: none !important;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.06em;
        cursor: pointer;
      }
      body [role='dialog'][class*='_confirmation'] [class*='_modalAction'] {
        background: #33312e !important;
        color: #f5f5f0 !important;
      }
      body [role='dialog'][class*='_confirmation'] [class*='_modalAction']:hover {
        background: #46433f !important;
      }
      body [role='dialog'][class*='_confirmation'] [class*='_confirmAction'] {
        background: var(--edge-accent) !important;
        color: #101110 !important;
      }
      body [role='dialog'][class*='_confirmation'] [class*='_confirmAction']:hover:not(:disabled) {
        background: var(--edge-accent-deep) !important;
      }
      /* Disabled until the checkbox is ticked. The app dims disabled buttons
         with element-level opacity — but this capsule straddles TWO backdrops,
         and translucent yellow goes chalky over the white band and muddy olive
         over the dim below it: one button, two dirty colours, read as 灰色.
         So the disabled look is painted part by part at FULL opacity instead:
         the fill is baked to the exact colour translucent yellow makes over
         the white band (color-mix with the band paper — the upper half then
         matches the old 45%-over-paper look exactly), the label drops its
         alpha, and the keyline/disc dim through their own pseudo opacity. Both
         halves render identically and the yellow never turns grey. */
      body [role='dialog'][class*='_confirmation'] [class*='_confirmAction']:disabled {
        opacity: 1 !important;
        background: color-mix(in srgb, var(--edge-accent) 42%, #f5f5f0) !important;
        color: rgba(16, 17, 16, 0.45) !important;
        box-shadow: none;
      }
      body [role='dialog'][class*='_confirmation'] [class*='_confirmAction']:disabled::before,
      body [role='dialog'][class*='_confirmation'] [class*='_confirmAction']:disabled::after {
        opacity: 0.35;
      }
      body [role='dialog'][class*='_confirmation'] button:disabled {
        opacity: 0.45;
      }
      /* Reference dressing for both capsule pairs (approval band + this box):
         a thin light keyline inset ~3px inside the silhouette, the trailing
         icon sitting in its own disc, and a soft drop shadow — the reference
         dialog's capsules all carry these three. The keyline and the disc are
         rounded shapes, so they pin corner-shape: round against the host's
         superellipse(1.5) default just like the capsule itself. */
      body [role='dialog'][class*='_confirmation'] [class*='_modalAction']::after {
        content: '✕';
        font-weight: 700;
      }
      body [role='dialog'][class*='_confirmation'] [class*='_confirmAction']::after {
        content: '◎';
      }
      body [data-approval-key] [class*='_actionRow'] button,
      body [role='dialog'][class*='_confirmation'] [class*='_modalAction'],
      body [role='dialog'][class*='_confirmation'] [class*='_confirmAction'] {
        position: relative;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.22);
      }
      body [data-approval-key] [class*='_actionRow'] button::before,
      body [role='dialog'][class*='_confirmation'] [class*='_modalAction']::before,
      body [role='dialog'][class*='_confirmation'] [class*='_confirmAction']::before {
        content: '';
        position: absolute;
        inset: 3px;
        border-radius: 999px !important;
        corner-shape: round !important;
        border: 1px solid rgba(245, 245, 240, 0.32);
        pointer-events: none;
      }
      /* On the accent capsule the keyline reads white (paper-on-yellow in the
         reference); on the dark capsule the same ink-white at lower alpha. */
      body [data-approval-key] [class*='_actionRow'] button:last-child::before,
      body [role='dialog'][class*='_confirmation'] [class*='_confirmAction']::before {
        border-color: rgba(255, 255, 255, 0.7);
      }
      /* The trailing glyph lives in its own disc: darker-than-button for the
         dark capsule (white ✕), ink disc with accent glyph for the yellow one
         — the reference's ◎ target. */
      body [data-approval-key] [class*='_actionRow'] button::after,
      body [role='dialog'][class*='_confirmation'] [class*='_modalAction']::after,
      body [role='dialog'][class*='_confirmation'] [class*='_confirmAction']::after {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        margin-left: 10px;
        border-radius: 999px !important;
        corner-shape: round !important;
        font-size: 11px;
        line-height: 1;
      }
      body [data-approval-key] [class*='_actionRow'] button:first-child::after,
      body [role='dialog'][class*='_confirmation'] [class*='_modalAction']::after {
        background: #211f1d;
        color: #f5f5f0;
      }
      body [data-approval-key] [class*='_actionRow'] button:last-child::after,
      body [role='dialog'][class*='_confirmation'] [class*='_confirmAction']::after {
        background: #1c1b19;
        color: var(--edge-accent);
      }
      /* ---------- Tables: bright signal-yellow hover (reference .data-table) ---------- */
      [class*='tableScroll' i] th,
      [class*='table' i] th {
        background: var(--edge-soft) !important;
        border-bottom-color: var(--edge-line) !important;
      }
      [class*='tableScroll' i] td,
      [class*='table' i] td {
        border-bottom-color: var(--edge-line) !important;
      }
      tbody tr:hover,
      tbody tr:hover *,
      [class*='table' i] tbody tr:hover,
      [class*='table' i] tbody tr:hover *,
      [class*='tableScroll' i] tbody tr:hover,
      [class*='tableScroll' i] tbody tr:hover * {
        color: var(--dsw-alias-label-primary) !important;
        background: color-mix(in srgb, var(--edge-accent) 15%, var(--dsw-alias-bg-base)) !important;
      }
      /* Text selection keeps the full accent, visibly distinct from row hover. */
      /* ---------- New session button (sidebar) ---------- */
      [class$='_newSession'] {
        color: var(--edge-paper) !important;
        background: var(--edge-accent) !important;
        border-color: var(--edge-accent) !important;
      }
      body:not(.theme-ak-round) [class$='_newSession'] {
        border-radius: 0 !important;
      }
      [class$='_newSession']:hover,
      [class$='_newSession']:focus-visible {
        color: var(--edge-paper) !important;
        background: var(--edge-accent-deep) !important;
        border-color: var(--edge-accent-deep) !important;
      }
      [class$='_newSession'] svg {
        color: var(--edge-paper) !important;
      }
      [class$='_newSessionLabel'] {
        color: var(--edge-paper) !important;
      }
      /* ---------- Badge hover: signal-yellow inversion (reference .kpi:hover) ---------- */
      /* '_badge' (underscore word boundary) for the same reason as the dark-mode
         rule above: bare 'badge' substring-matches third-party plugin classes
         (dsh-codearts-auth .dim-jh-badgePop popup + all its children). */
      [class*='_badge' i]:hover,
      [class*='_badge' i]:hover *,
      [class*='_badge' i][data-active],
      [class*='_badge' i][data-active] * {
        color: #000 !important;
      }
      /* ---------- Cordis action buttons (run/stop) ---------- */
      /* Approval chips excluded again: they already own a solid fill, and this blanket
         hover would repaint the decline chip yellow and re-tint the approve glyphs. */
      [data-cordis-switch]:hover:not(:disabled),
      [class*='actionButton' i]:not([data-cordis-approve]):not([data-cordis-approve-plugin]):not([data-cordis-decline]):hover:not(:disabled) {
        color: #000 !important;
        background: var(--edge-accent) !important;
      }
      body:not(.theme-ak-round) [data-cordis-switch],
      body:not(.theme-ak-round) [class*='actionButton' i] {
        border-radius: 999px !important;
        /* Same squircle trap as the approval stadium above: 999px only reads
           as a pill when the corner SHAPE is round. */
        corner-shape: round !important;
      }
      /* ---------- Session header actions (agent preset / subagent / jobs) ---------- */
      [class$='_trigger']:hover:not(:disabled),
      [class$='_trigger'][aria-expanded='true'],
      [class$='_trigger']:focus-visible {
        color: var(--edge-paper) !important;
        background: var(--edge-accent) !important;
      }
      /* ---------- Agent-preset header chip: accent fill, stock geometry ---------- */
      /* Hash-free scope for the old .SVAs4q_label: the chip is the preset label the
         agent-preset plugin registers into the "conversation.session.header.actions"
         slot. A bare [class*='_label'] is PROHIBITED here: it was tried first and it
         yellowed plain list labels (产物 / settings / jobs names), which is why this
         was hash-pinned in the first place.

         DOM measured off the running 0.1.5-rc.2 GUI (not inferred):

           div.pI_x6G_centerCol
             > header.wSkVaW_header
                 > div.wSkVaW_titleRow
                   > div.wSkVaW_titleCluster
                     > div.wSkVaW_headerActions
                       > div                  <- the slot's own entry wrapper.
                         > span.SVAs4q_label     It has NO class at all, so it
                           > svg.SVAs4q_icon     cannot be named either.

         Two silent-failure lessons are baked in here — a selector that matches
         nothing reports nothing, so both cost a shipped bug:
           1. The chip is NOT a child of _header; it is four levels down. Every '>'
              between the header and the chip encodes how many wrappers upstream
              happens to render, and upstream has now added wrappers twice.
           2. The chip's own parent is a class-less wrapper, so the depth cannot be
              collapsed onto a named container either.
         The scope therefore STOPS at the actions container and the chip is picked
         out by a property of the chip itself: it is the only _label in that slot
         carrying an icon. The jobs rows render text-only _label spans and the
         schedule module declares no _label local at all, so the scope still does
         exactly what it exists for. */
      [class$='_centerCol'] [class$='_header'] [class$='_headerActions'] [class*='_label']:has(> svg) {
        color: var(--edge-paper) !important;
        background: var(--edge-accent) !important;
        padding: 0 12px !important;
      }
      body:not(.theme-ak-round) [class$='_centerCol'] [class$='_header'] [class$='_headerActions'] [class*='_label']:has(> svg) {
        border-radius: 0 !important;
      }
      [class$='_centerCol'] [class$='_header'] [class$='_headerActions'] [class*='_label']:has(> svg) svg,
      [class$='_centerCol'] [class$='_header'] [class$='_headerActions'] [class*='_label']:has(> svg) [class*='_icon'] {
        opacity: 1 !important;
        color: var(--edge-paper) !important;
      }
      /* DELIBERATELY NOT STRETCHED. This rule used to carry flex:1 1 auto and
         max-width:none, and an earlier attempt of this fix also flattened the slot
         wrapper (display:contents) and grew _headerActions, to reproduce the old
         "chip fills the action row" look. On the real 0.1.5-rc.2 header that turns
         the chip into a full-width yellow BAR across the top of the conversation
         (measured: 923px of a 976px row) — nothing like the stock chip it is
         replacing, and reported straight back as "现在变成一个长条了".
         The theme's job here is the ACCENT, not the geometry: the chip keeps its
         stock size/hit area (height, 180px cap and ellipsis included) and only its
         colours change. Everything that made it grow is gone — do not reintroduce
         flex/max-width/display overrides without looking at it on the real page. */
      /* ================= dark compaction notice + residual blues ================= */
      /* Dark mode: warm label grays (compaction notice title/summary/sep used bluish defaults) */
      body[data-ds-dark-theme] {
        --dsw-alias-label-tertiary: #9a9d98;
        --dsw-alias-label-caption: #a4a6a1;
        --dsw-alias-label-dimmed: #70736f;
        --dsw-alias-label-primary-dimmed: #d8d9d5;
        --dsw-alias-label-primary-inverted: #101110;
      }
      /* Preset menu descriptions readable without hover in dark */
      body[data-ds-dark-theme] [class$='_itemDesc'] {
        color: #c5c7c2 !important;
      }
      /* Light + dark: warm the remaining bluish-gray surfaces / buttons / code blocks */
      body {
        --dsw-alias-bg-layer-3: #dcddd6;
        --dsw-alias-bg-module-platform: #f2f2ec;
        --dsw-alias-markdown-code-block: #ecece6;
        --dsw-alias-button-elevated-fill: #f2f2ec;
        --dsw-alias-button-floating-fill: #f2f2ec;
        --dsw-alias-button-floating-hover: #e8e8e2;
        --dsw-alias-button-ghost-active-fill: #dcddd6;
        --dsw-alias-button-ghost-active-hover: #d8d9d5;
        --dsw-alias-button-ghost-active-border: #b6b8b3;
        --dsw-alias-button-primary-hover: #2a2b28;
        --dsw-alias-button-contrast-fill: #3a3c38;
        --dsw-alias-tooltip-bg: #2a2b28;
        --dsw-specific-input-major: #f2f2ec;
        --dsw-specific-selector: #e8e8e2;
        --dsw-specific-tip: #e8e8e2;
        --dsw-static-blue-400: #757874;
        --dsw-static-blue-450: var(--edge-accent);
        --dsw-static-blue-500: #101110;
        --dsw-alias-label-quaternary: #6a6d68;
        --dsw-alias-label-error: #ff3b30;
        --dsw-alias-label-inverse: #101110;
        --dsw-alias-line-secondary: #d8d9d5;
        --dsw-alias-separator-primary: #9a9d98;
        --dsw-alias-border-secondary: #b6b8b3;
        --dsw-alias-bg-primary: #f2f2ec;
        --dsw-alias-interactive-bg-primary: var(--edge-accent);
        --dsw-alias-fill-l2: #dcddd6;
        --dsw-alias-fill-tsp-secondary: #dcddd6;
      }
      body[data-ds-dark-theme] {
        --dsw-alias-bg-layer-3: #2c2e2a;
        --dsw-alias-bg-module-platform: #2c2e2a;
        --dsw-alias-bg-layer-2: #1e201d;
        --dsw-alias-markdown-code-block: #181a18;
        --dsw-alias-button-elevated-fill: #3a3c38;
        --dsw-alias-button-floating-fill: #343633;
        --dsw-alias-button-floating-hover: #3a3c38;
        --dsw-alias-button-ghost-active-fill: #343633;
        --dsw-alias-button-ghost-active-hover: #3f413d;
        --dsw-alias-button-ghost-active-border: #5f6460;
        --dsw-alias-button-primary-hover: var(--edge-accent-deep);
        --dsw-alias-button-contrast-fill: #f5f5f0;
        --dsw-alias-tooltip-bg: #2a2b28;
        --dsw-specific-input-major: #202220;
        --dsw-specific-selector: #2c2e2a;
        --dsw-specific-tip: #2c2e2a;
        --dsw-static-blue-400: #9a9d98;
        --dsw-static-blue-450: var(--edge-accent);
        --dsw-static-blue-500: #f5f5f0;
        --dsw-alias-label-quaternary: #9a9d98;
        --dsw-alias-label-error: #ff6b61;
        --dsw-alias-label-inverse: #101110;
        --dsw-alias-line-secondary: #343633;
        --dsw-alias-separator-primary: #70736f;
        --dsw-alias-border-secondary: #4a4d49;
        --dsw-alias-bg-primary: #181a18;
        --dsw-alias-interactive-bg-primary: var(--edge-accent);
        --dsw-alias-fill-l2: #242624;
        --dsw-alias-fill-tsp-secondary: #242624;
      }
      /* Token meter: messages segment signal yellow, system warm gray (tools keeps purple)
         Both suffixes are unique to the ContextMeter component, so a bare substring
         match is safe (hash-pinned .JObwrW_* died in the 0.1.2-rc.1 rehash). */
      [class*='_colorMessages'] {
        --meter-tint: var(--edge-accent) !important;
      }
      [class*='_colorSystem'] {
        --meter-tint: #9a9d98 !important;
      }
      /* Appearance theme cube selected border: warm.
         '_selected' as a bare substring is safe-ish BECAUSE the rule only sets
         border-color: an element without a border is untouched, and any bordered
         selected element gets the warm line colour — which is the theme's
         de-blue-ing goal everywhere anyway. In dark mode the broad accent rule
         further down (0,2,0 specificity) outranks this and keeps its own colour. */
      [class*='_selected'] {
        border-color: var(--dsw-alias-border-l2) !important;
      }
      /* Hero preview badge: solid signal-yellow + black (reference accent chip).
         '_previewBadge' is unique to the hero shell (HeroShell on 0.1.2-rc.1). */
      [class*='_previewBadge'] {
        color: #101110 !important;
        background: var(--edge-accent) !important;
        border-color: var(--edge-accent) !important;
      }
      /* ---------- Hero backdrop glow: brand blue -> signal yellow ----------
         The empty-conversation hero paints one large blurred ellipse behind the
         composer card (ConversationRoot's <HeroGlow>, class *_heroGlow, figma
         313:14109; feGaussianBlur stdDeviation 50, ellipse 135% of the column
         width centred 92px above its bottom edge).
         Its colour is an SVG PRESENTATION ATTRIBUTE — fill="#6187D8"
         fill-opacity="0.08" — not a token, so the whole "neutralize remaining
         DeepSeek brand blues" variable block above could never reach it: a soft
         periwinkle haze survived the theme on that one page. A presentation
         attribute loses to ANY author CSS declaration, so restyling the ellipse
         here is sufficient and no app source is touched.

         Opacity is per scheme, and the two values are MEASURED, not picked: the
         app's exact glow svg was rendered headless over each --dsw-alias-bg-base
         and the ellipse core sampled, so the replacement can be matched to the
         presence of the glow it replaces (Y = 0.2126R+0.7152G+0.0722B):
           light #e8e8e2 (Y 231.5): 8% #6187D8 -> #DDE0E1 (Y 223.3, -8.2)
                                    8% #fff500 -> #E9E8D0 (Y 230.4, -1.1)
           dark  #101110 (Y  16.8): 8% #6187D8 -> #161A1F (Y  25.0, +8.2)
                                    5% #fff500 -> #1C1C0F (Y  27.1, +10.3)
         Light keeps 8%: yellow there is almost luminance-NEUTRAL and shifts only
         chroma (blue channel -18), i.e. a warm breath on the paper rather than
         the blue's grey-blue darkening — gentler than what it replaces, not
         louder. Dark had to come down from 8%/7%: over near-black, added
         luminance reads far more readily than subtracted blue does over cream
         (7% measured #20200E, Y +13.4 — about 1.6x the blue's lift), and 5%
         lands within ~2 Y of the original glow. So the hero keeps exactly the
         depth it had, in the theme's own accent.
         Matched on the '_heroGlow' CSS-module suffix, never on a build hash.
         NOTE: 0.1.2-rc.1 removed the glow SVG entirely (the hero was merged into
         ConversationRoot with no <HeroGlow>), and the module is still absent in
         0.2 (verified against the shipped 0.2.0-rc.2 bundles), so these rules
         match nothing today; they are kept as a self-healing hook in case
         upstream restores it. */
      [class*='_heroGlow'] ellipse {
        fill: var(--edge-signal, var(--edge-accent)) !important;
        fill-opacity: var(--edge-glow-light) !important;
      }
      body[data-ds-dark-theme] [class*='_heroGlow'] ellipse {
        fill-opacity: var(--edge-glow-dark) !important;
      }
      /* Brand wordmark HARNESS chip: signal-yellow box + black letters (both modes) */
      body {
        --dsw-alias-label-primary-inverted: #101110;
      }
      [class*='brand'] svg rect,
      [class$='_newSession'] svg rect {
        fill: var(--edge-accent) !important;
      }
      /* Compaction notice row: soft yellow wash + accent in dark, hover = solid inversion */
      body[data-ds-dark-theme] [class$='_compactionRow'] {
        background: rgba(var(--edge-accent-rgb), 0.08) !important;
        border-left: 2px solid rgba(var(--edge-accent-rgb), 0.55) !important;
      }
      body[data-ds-dark-theme] [class$='_compactionButton']:hover:not(:disabled),
      body[data-ds-dark-theme] [class$='_compactionButton']:focus-visible {
        background: var(--edge-accent) !important;
      }
      body[data-ds-dark-theme] [class$='_compactionButton']:hover *,
      body[data-ds-dark-theme] [class$='_compactionButton']:focus-visible * {
        color: #000 !important;
      }
      body[data-ds-dark-theme] [class$='_compactionButton']:hover [class$='_compactionSep'],
      body[data-ds-dark-theme] [class$='_compactionButton']:focus-visible [class$='_compactionSep'] {
        background: #000 !important;
      }
      /* ================= composer add (+) button hover inversion ================= */
      /* Dark: + icon signal yellow at rest; on hover solid yellow bg + black icon.

         SCOPED TO THE COMPOSER, like the '_arrow' rule below and for the same
         reason: the hook is a bare SUBSTRING ('_add'), so every upstream class that
         merely CONTAINS it was painted too. Audited against the installed bundles
         (0.1.7-era), the collision set is:
           RlGAzG_add             composer + button                    <- the target
           _3nPmjq_addActions     settings > 模型 add-block WRAPPER   <- the report
           _3nPmjq_addBlock / _addCard / _addModes / _addPanel / _addModelButton
           _0SbxAa_add            deliverables file-diff ADDED line
           LFNH1G_added / kuvljq_added / pFy1Ka_diffAdded /
           haSm5q_promptDiffLineadded
           qWvkEq_address*        sidebar-browser address bar
           fO69Vq_addButton / _3nPmjq_addButton   (what the old ':not()' excluded)

         The reported screenshot is the WRAPPER. '_addActions' is a plain <div>
         around 添加模型提供商, so ':disabled' never applies and pointing at the
         BUTTON hovers the wrapper as well. The theme filled the wrapper with the
         SOLID accent while the button kept upstream's translucent wash
         (rgba(255,245,0,.18)) plus color: label-primary — #f5f5f0 on #fff500 =
         1.05:1, an invisible label. The button's dashed border kept drawing over
         the fill, which is exactly what the report shows. Measured on the running
         build (not inferred): rest -> wrapper transparent, hover -> wrapper
         rgb(255,245,0) under a button at rgb(245,245,240).

         ':not([class*='_addButton'])' could not have caught it — the wrapper is not
         the button — and every '*_add*' container upstream adds would have had to be
         appended to that exclusion list one bug report at a time. Scoping fixes the
         whole family at once, the same way '_arrow' was fixed.

         The scope is the pair the composer '_primary' / '_arrow' rules already use,
         so the + keeps its inversion. '[data-composer-seat]' is included because the
         seat declares it upstream ('data-composer-seat', an e2e anchor): a
         '[class$=]' hook dies silently the moment upstream appends a second class to
         that element, which is the failure mode this file has already paid for.

         Note the + is the ONLY composer element whose class contains '_add'; the
         scope cannot reach the settings wrappers, the diff lines or the address bar.
         Verified by test/hover-check.js against real hovered pixels in both
         palettes and both schemes. */
      body[data-ds-dark-theme] :is([data-composer-seat], [class$='_composerSeat'], [class$='_composerHero']) [class*='_add'] {
        color: var(--edge-accent) !important;
      }
      body[data-ds-dark-theme] :is([data-composer-seat], [class$='_composerSeat'], [class$='_composerHero']) [class*='_add']:hover:not(:disabled),
      body[data-ds-dark-theme] :is([data-composer-seat], [class$='_composerSeat'], [class$='_composerHero']) [class*='_add']:focus-visible {
        color: #000 !important;
        background: var(--edge-accent) !important;
      }
      /* ================= composer primary send/stop button ================= */
      /* Dark: hardcoded #fff icon on yellow info-fill -> black icon; hover deeper yellow.
         Scoped to the composer (the seat band in a live conversation, the hero
         wrapper on the empty state) and to <button>: '_primary' as a bare suffix is
         too generic to trust with a colour flip anywhere else. */
      body[data-ds-dark-theme] :is([class$='_composerSeat'], [class$='_composerHero']) button[class*='_primary'] {
        color: #101110 !important;
      }
      body[data-ds-dark-theme] :is([class$='_composerSeat'], [class$='_composerHero']) button[class*='_primary']:hover:not(:disabled) {
        color: #101110 !important;
        background: var(--edge-accent-deep) !important;
      }
      /* ================= light-mode white-on-dark buttons keep white icon ================= */
      /* Generic hover inversion would make the white send icon black on the dark fill.
         (The old list also had .zGbnIq_primaryButton from settings › 模型; upstream
         removed that class in 0.1.2-rc.1. If a replacement appears, name it here
         explicitly rather than widening the composer scope.) */
      body:not([data-ds-dark-theme]) :is([class$='_composerSeat'], [class$='_composerHero']) button[class*='_primary'],
      body:not([data-ds-dark-theme]) :is([class$='_composerSeat'], [class$='_composerHero']) button[class*='_primary']:hover:not(:disabled) {
        color: #fff !important;
      }
      /* ================= buttons the theme fills with the SOLID accent =================
         Settings > 模型 draws its row actions with a '<hash>_secondaryButton'
         class (zGbnIq_ in the 0.1.1 bundles), whose upstream rule is:
             color:      var(--dsw-alias-label-primary)
             background: var(--dsw-alias-interactive-bg-hover-solid)   (on :hover)
         This theme maps that background token to the solid accent but upstream keeps
         owning the foreground — so in dark mode the label stayed label-primary
         (#f5f5f0) on signal yellow. Measured from a real screenshot of the 编辑
         button: 63 px of #f5f5f0 sitting on #fff500 = 1.05:1, i.e. the word was
         invisible. On 武陵青 the same pairing is 2.61:1 — still failing, just less
         obviously, which is how it stayed hidden.

         Why the existing hover-inversion rule did not already cover it: that
         selector deliberately EXCLUDES plain buttons, because a button's own fill
         and text must survive hover (the yellow toggle keeps black text, the
         white-on-dark send button keeps white). This button is the case where the
         fill comes from the THEME and the text from the APP, so it has to be named.

         Scoped to the accent-filled states only, so the resting transparent button
         keeps label-primary and stays correct in both schemes (measured 16.00:1
         dark / 16.84:1 light). Guarded by test/settings-buttons.test.js.

         .HOVERPROBE is included deliberately: a screenshot/computed-style test
         cannot trigger :hover, so the test swaps in that class, which has the same
         0,1,0 specificity as the pseudo-class and therefore the same cascade
         outcome. Naming it here keeps the rule the test verifies identical to the
         rule that ships, instead of testing a near-copy. It never matches in the
         real app, since nothing renders that class.

         The class list is not just the reported button. Auditing the installed
         bundles for elements whose hover background is that token found SIX, and
         three of them additionally re-assert color:label-primary in the same rule
         (so they would fight a token-level fix):
           *_secondaryButton   settings > 模型 row actions           <- reported
           *_inspectButton     inspect panels (cordis / skill / tool —
                               three modules, one semantic suffix)
           *_arrow             attachment carousel arrow
           *_add               composer + (already handled above)
         All are the same defect on different screens, so they are fixed together
         rather than one bug report at a time.

         MATCHING IS HASH-FREE and matched on the SUBSTRING, not [class$=...]: an
         attribute-suffix match requires the WHOLE class attribute to end with the
         string, so it silently misses any element that carries a second class
         after it (measured: [class$='_inspectButton'] failed on
         class="gNWCoW_inspectButton HOVERPROBE"). Upstream composes class lists
         freely AND rehashes modules between releases (0.1.2-rc.1 killed all 33
         pinned hashes), so the semantic token embedded in the class is the only
         durable hook — '_secondaryButton' / '_inspectButton' are specific enough
         that no other component uses them.

         '_arrow' is the one exception that needs SCOPING, not a bare match: two
         other components (trajectory, workspace) also carry *_arrow classes and
         take NO hover fill, so a bare match would force ink onto elements that
         keep their normal background — black-on-near-black in dark mode,
         inventing a new contrast bug while fixing this one. The attachment
         carousel lives inside the composer, so the composer wrappers scope it;
         if a hover-filled arrow ever renders elsewhere, add its scope here. */
      :is([class*='_secondaryButton'], [class*='_inspectButton']):hover:not(:disabled),
      :is([class*='_secondaryButton'], [class*='_inspectButton']):hover:not(:disabled) svg,
      :is([class*='_secondaryButton'], [class*='_inspectButton']):hover:not(:disabled) svg path,
      :is([class*='_secondaryButton'], [class*='_inspectButton']).HOVERPROBE:not(:disabled),
      :is([class*='_secondaryButton'], [class*='_inspectButton']).HOVERPROBE:not(:disabled) svg,
      :is([class*='_secondaryButton'], [class*='_inspectButton']).HOVERPROBE:not(:disabled) svg path,
      :is([class$='_composerSeat'], [class$='_composerHero']) [class*='_arrow']:hover:not(:disabled),
      :is([class$='_composerSeat'], [class$='_composerHero']) [class*='_arrow']:hover:not(:disabled) svg,
      :is([class$='_composerSeat'], [class$='_composerHero']) [class*='_arrow']:hover:not(:disabled) svg path,
      :is([class$='_composerSeat'], [class$='_composerHero']) [class*='_arrow'].HOVERPROBE:not(:disabled),
      :is([class$='_composerSeat'], [class$='_composerHero']) [class*='_arrow'].HOVERPROBE:not(:disabled) svg,
      :is([class$='_composerSeat'], [class$='_composerHero']) [class*='_arrow'].HOVERPROBE:not(:disabled) svg path {
        /* Ink on accent: 16.50:1 on 谷地黄, 6.62:1 on 武陵青 — both AA. */
        color: #101110 !important;
        fill: currentColor !important;
      }
      /* ---------- light mode: the danger (移除) button needs a darker red ----------
         Not part of the accent work, but measured by the same test and failing:
         --dsw-alias-state-error-primary is #ff3b30, which on the settings panel
         (#f2f2ec) is only 3.16:1 — below AA for the 12px label it paints. iOS-style
         reds are tuned for white-on-red fills, not red-on-paper text. Darkening the
         TEXT colour alone (the token keeps its value for fills/dots elsewhere)
         brings it to 5.12:1 while staying unmistakably red.
         (0.1.2-rc.1 removed the old zGbnIq_dangerButton class; the semantic suffix
         is kept so the rule re-arms itself if the button returns under the same
         name, and no-ops harmlessly until then.) */
      body:not([data-ds-dark-theme]) [class*='_dangerButton'] {
        color: #c62016 !important;
      }
      /* ================= dark mode: selected rows = solid signal-yellow + black text ================= */
      /* The translucent yellow wash makes white text look muddy olive; the reference
         inverts to black-on-signal-yellow, so selected rows get the full inversion. */
      body[data-ds-dark-theme] [class*='selected' i]:not([class*='unselected' i]) {
        color: #000 !important;
        background: var(--edge-accent) !important;
        border-color: var(--edge-accent) !important;
      }
      body[data-ds-dark-theme] [class*='selected' i]:not([class*='unselected' i]) *:not(svg):not(path) {
        color: #000 !important;
      }
      /* ================= ask_user_question option chips ================= */
      /* Two contrast collisions in the question card (@deepseek-ai/dsh-client-ui-user-questions),
         both measured on a real card rather than guessed.

         1) The recommended chip. Upstream paints it with
              color: var(--dsw-alias-button-info-fill)
              background: var(--dsw-specific-sidebar-nav-item-active-accent)
            i.e. it uses info-fill as a FOREGROUND. This theme maps that token and the
            nav accent to the SAME value in both modes (#101110 light / #fff500 dark),
            so the label painted itself onto its own fill and the chip measured as a
            single flat colour with ZERO glyph pixels. Broken in BOTH modes, not just
            dark. Pin the pair explicitly instead of retuning either token, because
            both are consumed as real background fills elsewhere. */
      :is([role='radio'], [role='checkbox']) [class*='badge' i] {
        color: #101110 !important;
        background: var(--edge-accent) !important;
      }
      /* On a selected row the row itself is already solid signal yellow, so the chip
         inverts to keep its edge instead of dissolving into the row. */
      body[data-ds-dark-theme] [class*='selected' i]:not([class*='unselected' i]) [class*='badge' i] {
        color: var(--edge-accent) !important;
        background: #101110 !important;
      }
      /* 2) The option number ("1", "2", ...). The blanket dark inversion above
            recolours descendant TEXT to black but cannot touch a descendant's own
            background, so this chip kept its overlay fill
            (--dsw-alias-bg-overlay = #1c1e1c) and rendered a black digit on
            near-black: measured 1.25:1, i.e. the numbering vanished on the selected
            row. Wash the chip rather than filling it, so the digit reads on yellow
            and the chip still looks like a chip. */
      body[data-ds-dark-theme] [class*='selected' i]:not([class*='unselected' i]) [class*='number' i] {
        color: #101110 !important;
        background: rgba(16, 17, 16, 0.16) !important;
      }
      /* ---------- Turn-status label ("Deep diving...") ----------
         MOVED AND RE-MECHANISED ON DSH 0.2, so the recolour moved with it.

         On 0.1.x the label was owned by @deepseek-ai/dsh-client-ui-conversation as
         'Md3f7G_turnStatus' and painted as GRADIENT TEXT — a linear-gradient
         background, -webkit-text-fill-color: transparent plus background-clip:
         text, shimmered by animating background-position:

           background: linear-gradient(90deg,
             var(--dsw-static-deepseek-500) 0%   40%,
             var(--dsw-static-deepseek-200) 50%,
             var(--dsw-static-deepseek-500) 60% 100%);
           color: #0000; -webkit-text-fill-color: transparent;

         Two consequences drove the 0.1.x rules that used to live here:
           1. A plain 'color:' CANNOT recolour that label — the transparent text
              fill wins, so the recolour had to go through the gradient itself.
           2. Retinting the shared --dsw-static-deepseek-* tokens would be the wrong
              lever: --dsw-static-deepseek-500/200 also back
              --dsw-alias-button-info-fill, --dsw-alias-state-business-primary and
              --dsw-specific-bubble-highlight (verified in
              dsh-client-ui-theme/styles/design-platform.css), so the theme maps
              them to ink/paper on purpose.
         Hence only background-image was overridden, leaving upstream's
         background-size, background-position and shimmer animation untouched.

         ON 0.2 THERE IS NO GRADIENT AND NO 'turnStatus' CLASS. The same label now
         lives in @deepseek-ai/dsh-client-ui-chat as '<hash>_running' and is
         masked-sweep text whose only levers are the two
         --dsw-alias-label-deep-diving* tokens. A rule matching '[class*=
         "turnStatus"]' can never fire on 0.2, so the recolour is carried by the
         theme.overrideTokens layer above instead (search for
         '--dsw-alias-label-deep-diving'). Measured on a real 0.2.0-rc.2 page with
         the old rules still present: the token kept resolving to the app's own
         color-mix(in srgb, #101110 70%, #172554) and the label lost the theme
         colour entirely. test/selector-guard.test.js pins both the 0.2 class hook
         and the token pair so this cannot silently rot again.

         COLOUR CHOICE IS MEASURED, NOT PICKED BY EYE — and it did not have to be
         re-derived for 0.2, because both tokens paint glyphs against the SAME two
         surfaces (bg-base and bg-layer-1), and under prefers-reduced-motion the
         sweep is effectively held inside the text. Every stop therefore still has
         to clear WCAG AA 4.5:1 against both. Measured:
           light bg #e8e8e2 / #f2f2ec —  #fff500 scores 1.02:1 (invisible; the naive
             "just make it yellow" reading of this request), #8f7c00 3.38, #7d6c00
             4.25, and #6b5d00 5.35 is the FIRST gold that clears AA (mid #3f3600
             9.82);
           dark  bg #101110 / #181a18 —  #fff500 15.26 (mid #a08a00 5.11), while
             #8f7c00 falls to 4.21 and fails.
         Hence the sweep DIPS deeper in both modes instead of lifting brighter:
         in light mode no gold above #6b5d00 can clear AA, and in dark mode a pale
         lift band desaturates to near-white and loses the yellow entirely.
         Light mode is a deep gold rather than signal yellow for the same reason the
         watermark and rail are not: on cream, #fff500 is not a colour choice, it is
         an erasure. The 武陵青 palette swaps both stops to its own teal pair
         (#006a6a / #003f3f light, #14d0d0 / #7ee7e7 dark) by redefining
         --edge-status-* in its body class, so the palette flip re-resolves the
         tokens with no JS repaint — the same var() trick as --dsw-alias-brand-primary. */
      /* ================= boot loading screen ================= */
      /* Fixed plate above everything, including the shell overlay layer. It exists
         only while the boot animation plays and is removed afterwards, so none of
         these rules match during normal use. Measurements come from the reference
         frame (1340x731) expressed as ratios so they scale with the viewport. */
      [data-ak-loader] {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        background: #101110;
        /* Not inherited from the app: the plate can paint before tokens resolve,
           and since the theme stopped overriding the root font token it must not
           depend on inheritance for its face either. Both the family and the
           openType features are declared here rather than globally. */
        color: #f5f5f0;
        font-family: var(--edge-font);
        font-feature-settings: "tnum" 1, "ss01" 1;
        overflow: hidden;
        /* Never trap the user: even mid-animation the app underneath stays usable. */
        pointer-events: none;
        opacity: 1;
        /* No opacity transition: the fade is driven from JS (see finish()) because a
           CSS transition proved not to run in every renderer this plate targets.
           finish() also sets inline transition:none so nothing can fight it. */
      }
      /* Kept as a state hook (and a fallback for a renderer that never runs the JS
         fade) — the inline opacity written by finish() is what actually animates. */
      [data-ak-loader][data-ak-loader-exit] {
        opacity: 0;
      }
      /* Faint industrial grid, matching the reference backdrop texture. */
      [data-ak-loader-tex] {
        position: absolute;
        inset: 0;
        opacity: 0.55;
        background-image:
          repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.014) 0 1px, transparent 1px 4px),
          repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.010) 0 1px, transparent 1px 120px);
      }
      /* 8px rail: dim track full height, signal-yellow fill from the top down. */
      /* 10px rail, measured from the reference (10/1184 of the width). */
      [data-ak-loader-track] {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 10px;
        background: rgba(var(--edge-accent-rgb), 0.10);
      }
      [data-ak-loader-fill] {
        position: absolute;
        left: 0;
        top: 0;
        width: 10px;
        height: 0%;
        background: var(--edge-accent);
      }
      /* Meter RIDES THE FILL END: its top offset is set per frame from the same eased
         progress value that drives the fill height (see step()), so the readout
         descends with the bar. The exact offset and the clamping are done in JS,
         where the group's real height is known — a pure CSS percentage would let the
         readout hang off the bottom of the screen as the fill approaches 100%.
         Deliberately no CSS transition on the top offset: it is already updated every
         frame, and a transition would make the readout visibly lag the bar. */
      [data-ak-loader-meter] {
        position: absolute;
        left: 26px;
        top: 0;
        will-change: top;
      }
      [data-ak-loader][data-ak-loader-complete] [data-ak-loader-meter] {
        position: fixed !important;
        left: 26px !important;
        top: auto !important;
        bottom: 64px !important;
      }
      /* ---- completion flourish: yellow sweep to the right, then fade ----
         Starts as the rail itself (same 10px width, same colour, same left edge) and
         widens to cover the viewport, so the sweep reads as the finished bar flooding
         the screen rather than a new element appearing.
         Width and opacity are animated from JS (see finish()), deliberately NOT by a
         CSS transition: measured in the verification renderer, a transition declared
         here never started — no transitionrun/start/end events fired and the computed
         width stayed at 10px well past its duration — which would leave a thin stub
         instead of a sweep. These rules therefore only describe the resting state and
         must not declare a width/opacity transition that would fight the JS. */
      [data-ak-loader-wipe] {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 10px;
        background: var(--edge-accent);
        opacity: 0;
      }
      [data-ak-loader-tick] {
        display: block;
        width: 4px;
        height: 15px;
        background: var(--edge-accent);
      }
      [data-ak-loader-pct] {
        display: block;
        margin-top: 7px;
        color: var(--edge-accent);
        font-size: 39px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.01em;
        font-variant-numeric: tabular-nums;
      }
      [data-ak-loader-status] {
        display: block;
        margin-top: 12px;
        color: #666;
        font-size: 11px;
        font-weight: 400;
        letter-spacing: 0.02em;
      }
      /* ---- Poster brand block --------------------------------------------------
         Measured from the supplied key-art (1184x685) by scanning its pixels, not
         estimated — the ink bands on the right half of the reference are:
           block left ink edge  x=868  -> 868/1184 = 73.3% of the width
           right-most ink       x=1098 -> right gap 86px = 7.3% of the width
           kicker band          y 258..260   h=3    (ratio to cap 0.10)
           END band             y 265..293   h=29   -> cap 4.23% of plate height
           FIELD band           y 297..325   h=29   -> line pitch 32px, 32/29 = 1.10
           chevron band         y 498..506   x=841  -> outdent 868-841 = 27px
           tagline band         y 543..551   h=9, run width 231px
         The block is LEFT-aligned internally (all rows share x=868) but placed on
         the right — that combination is what gives the reference its look; a
         right-aligned (ragged-left) block reads completely differently.

         GEOMETRY MODEL — the block is anchored by its RIGHT margin, not by a left
         percentage. That is deliberate and is what fixes two measured faults:
           1. A left percentage (the old --edge-rail: 73%) sets where the block
              STARTS and lets its width run toward the right edge, so the margin
              that a viewer actually reads as "too far right" was never controlled.
              Anchoring 'right' makes that margin the declared quantity, and the
              rhythm line falls out of the widest row instead of being guessed.
           2. Sizing purely in vh made the wordmark shrink on a wide-but-short
              window and, at the old 4.2vh, rendered the cap at 3.01% of plate
              height against the reference's 4.23% — measurably ~70% of reference,
              which is why it read as too small.
         --edge-word is therefore clamp(26px, min(5.2vh, 4.8vw), 64px):
           min(5.2vh, 4.8vw)  scales with the SMALLER axis, so neither a short nor
                              a narrow window can push the block into the rail;
           26px floor         keeps the sub-rows legible on a tiny plate;
           64px ceiling       measured: without it, cap-height fell to 2.69% of H
                              at 2560x1440 (the block visibly shrank on a large
                              display); 64px holds it at ~3.2% and up.
         Verified across 13 viewports from 520x900 to 2560x1440: cap-height stays
         within 3.1-3.9% of plate height (reference 4.23%, intentionally a touch
         under — see below) with no overflow past any edge and >=150px clearance
         from the progress rail and its meter.
         The block still renders slightly under reference scale on purpose: the
         key-art is a full-bleed poster, whereas this plate flashes over an app.
         Every row is a ratio of --edge-word, so this one value rescales the whole
         block without disturbing the measured proportions above. The small rows
         additionally carry a px floor — see the max() calls below. */
      [data-ak-loader] {
        --edge-word: clamp(26px, min(5.2vh, 4.8vw), 64px);
        /* Distance from the plate's right edge to the block's right edge. The %
           term keeps it proportional on a wide display; the px term stops it
           collapsing on a narrow one. */
        --edge-gap: max(64px, 12%);
      }
      [data-ak-loader-brand] {
        position: absolute;
        right: var(--edge-gap);
        top: 50%;
        transform: translateY(-50%);
        /* No max-width: every row sets white-space: nowrap, so a width cap cannot
           wrap them — it only clips. The block moves instead (see the --edge-gap
           media queries) so the longest row always fits. */
      }
      /* Anchor to --edge-word like every other row. Without this the em below
         resolves against the inherited root font-size (16px), which rendered the
         kicker at 2.25x its reference size and bloated the whole block. */
      [data-ak-loader-kicker] {
        display: block;
        font-size: var(--edge-word);
      }
      [data-ak-loader-kicker]::before {
        content: 'DEEPSEEK HARNESS';
        display: block;
        margin-bottom: 0.5em;
        color: #f5f5f0;
        /* max() floor: the reference ratio alone (0.135em of the wordmark) computes
           to ~4px on a short plate, which renders as an illegible grey smudge
           rather than text. 9px is the smallest size this still reads at. */
        font-size: max(9px, 0.155em);
        font-weight: 600;
        letter-spacing: 0.26em;
        white-space: nowrap;
        opacity: 0.95;
      }
      /* Both rows: the negative margin cancels Arial's left side bearing so the
         INK edge lands on the rhythm line, not the glyph box edge. */
      [data-ak-loader-word] {
        display: block;
        margin-left: -0.055em;
        color: #f5f5f0;
        font-size: var(--edge-word);
        font-weight: 900;
        /* 0.80, not 1.10: the reference pitch/cap of 1.10 is measured between
           INK tops, while line-height spans the full em box (ascender+descender),
           which for Arial-900 is ~1.38x the cap height. 1.10 as a line-height
           renders a visibly loose 1.52 ink pitch. */
        line-height: 0.80;
        letter-spacing: 0.01em;
        white-space: nowrap;
      }
      [data-ak-loader-word1]::before { content: 'ARK'; }
      [data-ak-loader-word2]::before { content: 'NIGHTS'; }
      /* ---- detail cluster: chevron outdented into the left margin ---- */
      [data-ak-loader-detail] {
        display: block;
        position: relative;
        margin-top: 1.9em;
        font-size: var(--edge-word);
      }
      [data-ak-loader-chev] {
        position: absolute;
        left: -0.26em;
        top: 0.02em;
        width: 0.12em;
        height: 0.24em;
      }
      /* Two stacked chevrons drawn from borders — no glyph, no font dependency. */
      [data-ak-loader-chev]::before,
      [data-ak-loader-chev]::after {
        content: '';
        position: absolute;
        left: 0;
        width: 0.10em;
        height: 0.10em;
        border-left: 0.028em solid var(--edge-accent);
        border-bottom: 0.028em solid var(--edge-accent);
        transform: rotate(-45deg);
      }
      [data-ak-loader-chev]::before { top: 0; }
      [data-ak-loader-chev]::after { top: 0.09em; }
      [data-ak-loader-sub]::before {
        content: 'EDGE INTELLIGENCE THEME';
        display: block;
        color: #8a8d88;
        /* Same legibility floor as the kicker: measured, the bare ratio rendered
           this row 3px tall — visible as a blur, not readable as words. */
        font-size: max(9px, 0.135em);
        font-weight: 500;
        letter-spacing: 0.12em;
        white-space: nowrap;
      }
      [data-ak-loader-seq]::before {
        content: 'TERRA RESEARCH COMMISSION / BOOT SEQUENCE';
        display: block;
        margin-top: 0.4em;
        color: #6a6d64;
        font-size: max(8px, 0.125em);
        font-weight: 500;
        letter-spacing: 0.10em;
        white-space: nowrap;
      }
      [data-ak-loader-squares] {
        display: grid;
        grid-template-columns: repeat(6, 0.115em);
        gap: 0.04em;
        margin-top: 0.30em;
      }
      [data-ak-loader-squares] i {
        display: block;
        height: 0.05em;
        background: #2e302d;
      }
      [data-ak-loader-squares] i[data-on] {
        background: var(--edge-accent);
      }
      /* Tagline closes the block on the same rhythm line.
         Reference: cap 11px across 232px, i.e. cap/width 0.38 — unreachable in
         Arial, where an 11px-cap run of this string measures 299px (340px at the
         reference's tracking). The source art uses a condensed face, and probing
         the renderer showed Arial Narrow genuinely resolves here (245px vs Arial's
         299px on the same probe), so it is used with Arial as the fallback: on a
         host without it the run simply sets wider in Arial and still fits, because
         the size below is a ratio of the wordmark rather than a fixed px. */
      [data-ak-loader-tag]::before {
        content: 'OVER THE FRONTIER / INTO THE FRONT';
        display: block;
        margin-top: 1.05em;
        color: #f5f5f0;
        font-family: "Arial Narrow", Arial, sans-serif;
        font-size: max(10px, 0.34em);
        font-weight: 500;
        letter-spacing: 0.06em;
        white-space: nowrap;
      }
      [data-ak-loader-tag] {
        display: block;
        font-size: var(--edge-word);
      }
      /* Narrow windows: pull the block toward the right edge so the measured ratios
         survive instead of the text clipping. Only the margin changes — --edge-word
         already scales itself off the smaller viewport axis, so the wordmark needs
         no per-breakpoint override. */
      @media (max-width: 1100px) {
        [data-ak-loader] { --edge-gap: max(48px, 9%); }
      }
      @media (max-width: 760px) {
        [data-ak-loader] { --edge-gap: max(28px, 5%); }
      }
      /* Reduced motion is handled in finish(), which skips the sweep/fade entirely
         and removes the plate outright; nothing here needs to disable a transition,
         since the plate no longer declares one. */
      /* Settings page root (the settings.section slot's own wrapper div, the one
         element of that panel this theme gets to name). Declaring the theme face
         here means every row, hint and button inside it inherits it BY
         CONSTRUCTION, without touching the app's root font token. The class is
         stable and additive, so it is safe to target. It also carries no colours:
         the panel keeps taking its ink and surfaces from app tokens, which is
         what keeps it readable on both schemes and with the theme switched off
         (see test/settings-off.test.js). */
      .ak-settings {
        font-family: var(--edge-font);
      }
      /* Settings page group headers (rendered by the settings.section slot).
         The label is accent ink that stays AA on both surfaces: light mode uses
         the darkened accent stops (--edge-status-light: #6b5d00 / #006a6a),
         dark mode the bright ones (--edge-status-dark: #fff500 / #14d0d0) — the
         same measured pairs the turn-status shimmer uses. The palette class
         flips both variables, so the header follows the palette for free. */
      .ak-settings-group-title {
        color: var(--edge-status-light);
      }
      body[data-ds-dark-theme] .ak-settings-group-title {
        color: var(--edge-status-dark);
      }
      /* ================= 雷霆大字 (娱乐模式) =================
         The task-boundary announcement. Fixed, centred, above the shell overlay
         layer and the app's own dialogs but BELOW the boot plate (2147483000), so
         a boot animation still wins the screen it owns.

         WHITE, EXPLICITLY. The request asks for white text, and white is the one
         thing this theme's own tokens cannot promise: --dsw-alias-label-primary is
         INK (#101110) in light mode, so inheriting it would print the word in near
         black on cream. The glyph colour is therefore a literal #fff in both
         schemes, and legibility over unknown page content is bought by the plate's
         own scrim plus a dark text shadow rather than by the page background.

         THE SCRIM ALPHA IS MEASURED, NOT PICKED BY EYE — and the first value was
         WRONG. Shipping 0.28 looked fine in dark mode (18.92:1) and was almost
         invisible in light: white on ink-over-cream measured 2.29:1 on bg-base and
         2.11:1 on bg-layer-1, i.e. the same "on cream, #fff500 is not a colour
         choice, it is an erasure" failure this theme already documents for the
         watermark and the turn-status label — except here it was pure white. Caught
         by rendering the plate and measuring the pixels (test/thunder-shot.js), not
         by reading the CSS.

         Measured white-vs-scrimmed-surface, ink #101110 over each light surface:
             alpha   bg-base #e8e8e2   bg-layer-1 #f2f2ec   dark #101110
             0.28         2.29:1            2.11:1            18.92:1
             0.40         3.13:1            2.90:1            18.92:1
             0.50         4.17:1            3.89:1            18.92:1
             0.55         4.85:1            4.55:1            18.92:1
         0.55 is the first step where BOTH light surfaces clear 4.5:1 — the AA bar
         for ordinary body text, which is deliberate headroom for a word whose own
         bar is only the 3:1 large-text floor. Dark mode is unaffected either way
         (ink over near-black is the same colour), so the light surfaces are what
         set this number.

         pointer-events:none on both layers keeps every click, selection and scroll
         underneath working while the word is up — the plate is a caption, not a
         modal. Click-to-dismiss does NOT change that: the listener lives on the
         DOCUMENT in the capture phase (see showThunder), so a press both clears the
         word and reaches whatever the user aimed at. Giving this layer
         'pointer-events: auto' to catch the click itself would turn it into a
         full-screen click-eater for 3 seconds — verified by injecting exactly that
         and watching test/thunder-dismiss.test.js fail on hit-testing. */
      [data-ak-thunder] {
        position: fixed;
        inset: 0;
        z-index: 2147482000;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        background: rgba(16, 17, 16, 0.55);
        animation: ak-thunder-plate 3000ms linear 1 both;
      }
      [data-ak-thunder-word] {
        /* 大字: heavy, oversized, and scaled off the viewport so it stays a
           screen-filling statement at any window size rather than a fixed 48px that
           looks large on a phone and small on a 4K panel. Same clamp discipline as
           --edge-word on the boot plate. */
        font-family: "Arial Black", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
        font-size: clamp(44px, 13vw, 176px);
        font-weight: 900;
        line-height: 1;
        letter-spacing: 0.12em;
        /* The trailing letter-spacing would otherwise push the word off-centre. */
        text-indent: 0.12em;
        color: #fff;
        white-space: nowrap;
        text-align: center;
        /* Ink halo: what makes white type survive on cream paper, where a pure
           white glyph would otherwise have almost no edge. */
        text-shadow:
          0 0 2px rgba(16, 17, 16, 0.55),
          0 4px 18px rgba(16, 17, 16, 0.65),
          0 0 46px rgba(var(--edge-accent-rgb), 0.45);
        animation: ak-thunder-word 3000ms cubic-bezier(0.16, 1, 0.3, 1) 1 both;
      }
      /* The slam: overshoot in, hold, then fade. Keyframe percentages are the 3s
         hold expressed as one timeline, so a single animation covers entry, hold and
         exit and nothing has to be re-timed in JS. */
      @keyframes ak-thunder-word {
        0%   { opacity: 0; transform: scale(2.4); }
        7%   { opacity: 1; transform: scale(0.94); }
        12%  { transform: scale(1); }
        80%  { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.06); }
      }
      @keyframes ak-thunder-plate {
        0%   { opacity: 0; }
        5%   { opacity: 1; }
        80%  { opacity: 1; }
        100% { opacity: 0; }
      }
      /* The STATIC path: the word appears at full size and opacity, holds its 3s,
         then the JS timer removes it. Two independent reasons reach this attribute
         (see showThunder): the 动画 sub-switch being off — which is the DEFAULT — and
         the OS asking for reduced motion. Driving it from an attribute rather than a
         media query alone is what makes the default state testable in a browser that
         cannot toggle the OS preference from script.

         'opacity: 1' is load-bearing, not redundant: the animated rules start at
         'opacity: 0' and rely on the keyframes to bring the word in, so cancelling
         only 'animation' would leave a permanently invisible plate. */
      [data-ak-thunder][data-ak-thunder-still],
      [data-ak-thunder][data-ak-thunder-still] [data-ak-thunder-word] {
        animation: none;
        opacity: 1;
        transform: none;
      }
      /* Belt-and-braces for reduced motion: the attribute above already covers it,
         but this keeps the guarantee in CSS even if a future edit reaches the DOM
         without going through showThunder(). */
      @media (prefers-reduced-motion: reduce) {
        [data-ak-thunder],
        [data-ak-thunder] [data-ak-thunder-word] {
          animation: none;
          opacity: 1;
          transform: none;
        }
      }

      /* ---------- 顶部余额胶囊 ----------
         The reference HUD plate: a near-black stadium/pill — BOTH ends fully
         rounded (radius = half the height), independent of the theme's
         直角/圆角 setting because the reference capsule itself is always a
         pill. Sits at the TOP CENTER of the frame, below the window chrome,
         over the header — which is why it is pointer-events:none (a caption,
         not a control: the same discipline as the thunder plate above) and
         why its z-index stops short of the app's own modals.

         Layout is traced 1:1 off the reference capsule: a white three-layer
         square mark (a fabricated glyph would be tofu on machines without that
         face), the ¥ money big and white, the countdown run small and grey —
         「低谷时段剩余42:08:13」, with the 高峰/低谷 label INSIDE that grey run
         so the countdown's subject travels with it — then 「低谷已过33%」 pushed
         to the right end by the auto margin, and a round dial closing the pill.

         The dial is the one piece that carries a value: a dark disc (a shade
         deeper than the pill, so it reads as inset), an accent ring swept
         clockwise from 12 o'clock for the elapsed share of the window, and an
         accent clock face whose needle points at ~1 o'clock. The ring is a
         conic-gradient masked down to a 4px band, so a tick writes ONE custom
         property (--ak-balance-sweep) and never touches a node. */
      /* ---------- 顶部余额胶囊 stadium ----------
         The pill's silhouette is DRAWN, not rounded: two radial-gradient discs
         (one per end, radius = half the height, held in --ak-balance-cap)
         plus a linear-gradient band spanning between their centres. Why: the
         999px border-radius route proved unreliable on a real user's renderer
         twice over — first the 14px -> 999px write-back was lost, then a
         settled screenshot showed squircle ends (~14px caps on a 32px pill)
         while the dial's GRADIENT ring in the same frame rendered a perfect
         circle. Gradients are the one shape primitive that has never failed
          here, so roundness now rides the same mechanism as the ring. The box's
          own border-radius is pinned to 0 (inline, priority): any radius would
          clip these gradients by the rounded box and re-expose the very
          squircle this route exists to survive. @property registers the cap
          radius as a real length so the collapse tweens it on the SAME 420ms
          curve as height — cap(t) = height(t)/2 every frame, so the drawn
          stadium matches the morphing box at every instant. The 0.5px feather
          on each disc edge is anti-aliasing against the hard rectangle seam. */
      @property --ak-balance-cap {
        syntax: '<length>';
        inherits: false;
        initial-value: 16px;
      }
      [data-ak-balance] {
        --ak-balance-cap: 16px;
        position: fixed;
        top: 6px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 900;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 6px;
        /* The reference pill is a 448x48 stadium; rebuilt at 32px tall with the
           same 9.3:1 proportion it reads as a slim chip next to the header tabs
           instead of a slab across them. The min-width holds the wide gap
           between the countdown and the elapsed read, and the min() keeps a
           narrow window from being overrun: min-width beats max-width in CSS,
           so a bare 300px would win even against calc(100vw - 16px). */
        min-width: min(300px, calc(100vw - 16px));
        max-width: calc(100vw - 16px);
        height: 32px;
        padding: 0 1px 0 14px;
        /* ZERO on purpose: the background is always clipped by the border
           radius, and the host's root corner-shape: superellipse(1.5) drew
           that clip as a squircle — measured: a settled 32px pill with ~14px
           caps. With no radius to clip by, the gradient layers below ARE the
           silhouette — see the section comment. */
        border-radius: 0;
        /* Covers every circle INSIDE the pill (badge, ring, clock, brand
           mark): they inherit the host's superellipse(1.5) like everything
           else, and a 999px radius only draws a true disc when the shape is
           round. The pill itself needs no shape — its radius is zero.
           !important like every other pin in this sheet: the host re-applies
           its superellipse on its own selectors, and an unqualified round
           loses to it (that is how the dial came out squircle-shaped). */
        corner-shape: round !important;
        /* The silhouette is DRAWN (see the section comment): two discs at the
           ends + a band between their centres. A plain colour would be clipped
           by the host's superellipse corner shape; this way the outline IS the
           gradient, correct wherever gradients paint. The transparent stops
           repeat the fill colour at alpha 0 — plain 'transparent' would fringe
           grey through the 0.5px feather. */
        background:
          radial-gradient(circle at var(--ak-balance-cap) 50%,
            #312f30 calc(var(--ak-balance-cap) - 0.5px),
            rgba(49, 47, 48, 0) var(--ak-balance-cap)),
          radial-gradient(circle at calc(100% - var(--ak-balance-cap)) 50%,
            #312f30 calc(var(--ak-balance-cap) - 0.5px),
            rgba(49, 47, 48, 0) var(--ak-balance-cap)),
          linear-gradient(#312f30, #312f30) var(--ak-balance-cap) 0 / calc(100% - 2 * var(--ak-balance-cap)) 100% no-repeat;
        color: #f1f1ec;
        font-family: var(--edge-font);
        font-size: 13px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: 0.01em;
        pointer-events: none;
        user-select: none;
        white-space: nowrap;
        /* Boot pose -> balance row. The box moves (height, width floor,
           padding), the drawn caps move with it (--ak-balance-cap is a
           registered <length>, so it interpolates on the SAME 420ms curve as
           height — cap(t) = height(t)/2 every frame), and the two contents
           cross-fade in place, so the collapse reads as ONE object changing
           shape instead of two layouts swapping. No border-radius entry: the
           radius is 999px for the pill's whole life and the engine clamps it
           to half the CURRENT height every frame, where it works. */
        transition:
          height 420ms cubic-bezier(0.22, 0.72, 0.2, 1),
          min-width 420ms cubic-bezier(0.22, 0.72, 0.2, 1),
          padding 420ms cubic-bezier(0.22, 0.72, 0.2, 1),
          --ak-balance-cap 420ms cubic-bezier(0.22, 0.72, 0.2, 1),
          opacity 180ms ease,
          transform 240ms cubic-bezier(0.22, 0.72, 0.2, 1);
      }
      /* Boot pose: the brand panel from the reference — 448x72 — held while the
         first account answer is still in flight. JS drops the attribute once the
         balance lands (or the cap expires) and the pill animates down into its
          row. The pose grows the drawn caps with the box (--ak-balance-cap
          16px -> 36px on the same 420ms curve as height), so the silhouette is
          a stadium at every instant without ever asking border-radius for it. */
      [data-ak-balance][data-ak-balance-boot] {
        --ak-balance-cap: 36px;
        height: 72px;
        min-width: min(448px, calc(100vw - 16px));
        padding: 0 22px;
      }
      /* The rows keep their layout under the brand block (opacity only), so the
         collapse never reflows twice.
         The FADE is declared on a rule that survives the pose, and only the
         held-down 'opacity: 0' lives under the boot attribute. A transition runs
         only if the property is still declared on the element AFTER the change:
         declaring both halves inside the boot-attribute selector meant removing
         the attribute deleted the transition along with the 'opacity: 0', so on
         the very frame the collapse started the balance row snapped to full
         opacity while the brand was still mid-fade — two reads overprinted for
         a fifth of a second, and the pose read as a glitch instead of a morph
         (measured: row opacity 0 -> 1 in one sample while height was still
         72px). The short delay is what makes it a cross-fade: the brand (220ms)
         is most of the way out before the numbers (170ms) are a third of the way
         in, and both are done well inside the 420ms the box takes to shrink, so
         the whole collapse ends as one gesture. */
      [data-ak-balance] > :not([data-ak-balance-brand]) {
        transition: opacity 170ms linear 90ms;
      }
      [data-ak-balance][data-ak-balance-boot] > :not([data-ak-balance-brand]) {
        opacity: 0;
      }
      [data-ak-balance-brand] {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        /* Measured off the reference: the mark and the copy sit 30px apart, and
           the lockup as a whole rides 28px left of centre (hence the padding on
           the right, which leaves centring — and its narrow-window behaviour —
           intact). */
        gap: 30px;
        padding-right: 56px;
        opacity: 0;
        transition: opacity 220ms linear;
        pointer-events: none;
      }
      [data-ak-balance][data-ak-balance-boot] [data-ak-balance-brand] {
        opacity: 1;
      }
      /* Same concentric-square mark as the capsule icon, but on a disc — the
         brand pose shows the round lockup, the collapsed row the square one. */
      [data-ak-balance-brand-mark] {
        position: relative;
        flex: none;
        width: 24px;
        height: 24px;
        border-radius: 999px;
        background: #f1f1ec;
      }
      [data-ak-balance-brand-mark]::before {
        content: '';
        position: absolute;
        inset: 5px;
        border-radius: 2px;
        background: #312f30;
      }
      [data-ak-balance-brand-mark]::after {
        content: '';
        position: absolute;
        inset: 9px;
        border-radius: 1px;
        background: #f1f1ec;
      }
      [data-ak-balance-brand-copy] {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }
      /* Tracked-out uppercase is how this theme draws a technical label (the
         loader kicker does the same), so the brand line stays in --edge-font
         rather than importing a second family for one row. */
      [data-ak-balance-brand-kicker] {
        font-size: 9px;
        font-weight: 500;
        letter-spacing: 0.02em;
        color: #8d8c88;
        white-space: nowrap;
      }
      [data-ak-balance-brand-title] {
        font-size: 22px;
        font-weight: 700;
        letter-spacing: 0.01em;
        color: #f1f1ec;
        white-space: nowrap;
      }
      /* Three concentric squares, measured off the reference at 16x: a 14px
         white rounded square, a 6px dark core punched into it, and a 3px white
         pip at the centre — all pseudo-elements, no glyph and no image. */
      [data-ak-balance] [data-ak-balance-icon] {
        position: relative;
        flex: none;
        width: 10px;
        height: 10px;
        margin-right: 4px;
        border-radius: 3px;
        corner-shape: round !important;
        background: #f1f1ec;
      }
      [data-ak-balance] [data-ak-balance-icon]::before {
        content: '';
        position: absolute;
        inset: 2px;
        border-radius: 2px;
        corner-shape: round !important;
        background: #312f30;
      }
      [data-ak-balance] [data-ak-balance-icon]::after {
        content: '';
        position: absolute;
        inset: 3.5px;
        border-radius: 1px;
        corner-shape: round !important;
        background: #f1f1ec;
      }
      /* ¥ + integer + fraction are one unbroken run: the reference has no gap
         between the sign and the digits, so the group owns the baseline. */
      [data-ak-balance] [data-ak-balance-money] {
        display: inline-flex;
        align-items: baseline;
        flex: none;
      }
      [data-ak-balance] [data-ak-balance-currency],
      [data-ak-balance] [data-ak-balance-int] {
        font-size: 14px;
        font-weight: 700;
        color: #f1f1ec;
        /* Tabular figures on the element itself — never a global font/font-family
           declaration (see docs/engineering-notes.md: the :root font incident). */
        font-variant-numeric: tabular-nums;
        font-feature-settings: 'tnum' 1, 'ss01' 1;
      }
      [data-ak-balance] [data-ak-balance-frac] {
        font-size: 9px;
        font-weight: 600;
        color: #a2a1a2;
        font-variant-numeric: tabular-nums;
      }
      /* ---------- 渠道额度 group (dsh-codearts-auth) ----------
         The wallet and the channel read occupy the same visual slot, so they
         are two exclusive states of one pill, switched by the
         data-ak-credit-mode attribute: 'wallet' (default — DeepSeek
         numbers) hides the channel group, 'credits' hides the wallet group.
         Attribute-driven, not class-driven, so no per-poll class churn and
         the markup owns both halves up front. The pricing window and the
         elapsed-pct read are wallet-only for the same reason the money group
         is: peak/off-peak is a DeepSeek API concept, and in credits mode the
         right-hand slot shows the channel's consumption share instead. */
      [data-ak-balance] [data-ak-credit-money] {
        display: none;
        align-items: baseline;
        flex: none;
      }
      [data-ak-balance] [data-ak-credit-pct] {
        display: none;
        margin-left: auto;
        font-size: 13px;
        font-weight: 700;
        color: #f1f1ec;
        font-variant-numeric: tabular-nums;
      }
      [data-ak-balance][data-ak-credit-mode='credits'] [data-ak-balance-money],
      [data-ak-balance][data-ak-credit-mode='credits'] [data-ak-balance-window],
      [data-ak-balance][data-ak-credit-mode='credits'] [data-ak-balance-pct] {
        display: none;
      }
      [data-ak-balance][data-ak-credit-mode='credits'] [data-ak-credit-money] {
        display: inline-flex;
      }
      [data-ak-balance][data-ak-credit-mode='credits'] [data-ak-credit-pct] {
        display: inline;
      }
      [data-ak-balance] [data-ak-credit-channel] {
        margin-right: 5px;
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: #8d8c88;
        white-space: nowrap;
      }
      [data-ak-balance] [data-ak-credit-int] {
        font-size: 14px;
        font-weight: 700;
        color: #f1f1ec;
        font-variant-numeric: tabular-nums;
        font-feature-settings: 'tnum' 1, 'ss01' 1;
      }
      [data-ak-balance] [data-ak-credit-unit] {
        margin-left: 3px;
        font-size: 9px;
        font-weight: 600;
        color: #a2a1a2;
      }
      /* 低谷时段剩余hh:mm:ss — one grey caption, not three tokens. */
      [data-ak-balance] [data-ak-balance-window] {
        font-size: 9px;
        font-weight: 500;
        color: #a2a1a2;
      }
      [data-ak-balance] [data-ak-balance-phase] {
        color: inherit;
      }
      /* Off-peak is the cheap window; a peak label is the one thing the user
         should be able to catch out of the corner of an eye, so it turns
         accent. */
      [data-ak-balance] [data-ak-balance-phase][data-ak-balance-phase-peak='1'] {
        color: var(--edge-accent);
      }
      [data-ak-balance] [data-ak-balance-remain] {
        font-variant-numeric: tabular-nums;
      }
      /* The elapsed read: money-sized and white, held at the right end by the
         auto margin that swallows the pill's free space. */
      [data-ak-balance] [data-ak-balance-pct] {
        margin-left: auto;
        font-size: 13px;
        font-weight: 700;
        color: #f1f1ec;
        font-variant-numeric: tabular-nums;
      }
      /* Measured gap from the reference: the elapsed read stops 14px short of the
         dial, which the pill's own gap alone does not cover. */
      [data-ak-balance] [data-ak-balance-badge] {
        position: relative;
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-left: 3px;
        width: 27px;
        height: 27px;
        border-radius: 999px;
        corner-shape: round !important;
        background: #262425;
      }
      /* Progress ring: the accent segment covers the elapsed share starting at
         12 o'clock; the mask keeps only the outer 4px band. */
      [data-ak-balance] [data-ak-balance-ring] {
        position: absolute;
        inset: 1.5px;
        border-radius: 999px;
        corner-shape: round !important;
        background: conic-gradient(
          from 0deg,
          var(--edge-accent) 0deg var(--ak-balance-sweep, 0deg),
          transparent var(--ak-balance-sweep, 0deg) 360deg
        );
        -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px));
        mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px));
      }
      [data-ak-balance] [data-ak-balance-clock] {
        position: relative;
        width: 12px;
        height: 12px;
        border-radius: 999px;
        corner-shape: round !important;
        background: var(--edge-accent);
      }
      /* The needle: hangs from the face's centre up to ~1 o'clock, in the
         disc's own dark so it reads as a hole cut in the accent. */
      [data-ak-balance] [data-ak-balance-clock]::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        width: 1.5px;
        height: 3px;
        margin: -3px 0 0 -0.75px;
        border-radius: 1px;
        background: #262425;
        transform: rotate(25deg);
        transform-origin: 50% 100%;
      }
      /* Phones: drop the 「时段剩余hh:mm:ss」 tail first and keep the
         高峰/低谷 label. A seconds-precision countdown is the read nobody
         glances at on a one-hand viewport, and it is also the WIDEST token
         run in the pill — at phone widths (390–480px) it alone would push
         the capsule past the header tabs it floats over. The breakpoint is
         the conventional phone ceiling, comfortably above the pill's 300px
         natural width, so desktop and tablet layouts are untouched.
         The width floor goes with the tail it was sized for: 300px exists to
         hold the gap between the countdown and the elapsed share, so leaving
         it in place would only stretch the pill back out with whitespace
         (margin-left: auto on the elapsed read swallows every spare pixel).
         Zero lets the box shrink-to-fit its remaining reads, and the fixed
         6px gap owns the spacing. The boot pose keeps its own wider floor:
         that rule carries the -boot attribute and outranks this one, so the
         opening panel still morphs. */
      @media (max-width: 480px) {
        [data-ak-balance] {
          min-width: 0;
        }
        [data-ak-balance] [data-ak-balance-remain-run] {
          display: none;
        }
      }
      /* Narrow windows: the countdown is the least load-bearing read of the
         three, so it is the one that yields before a nowrap overflow can push
         the dial and the elapsed share off the right edge. The breakpoint sits
         just under the pill's natural 300px + 16px slack, so the reference
         layout is untouched at every width it actually fits in. */
      @media (max-width: 316px) {
        [data-ak-balance] [data-ak-balance-window] {
          display: none;
        }
      }
      /* ---------- 防遮挡：停靠位变体与自动隐藏 ----------
         停靠位由胶囊上的 data-ak-balance-position 属性选择（center 是
         基规则本身，不需要属性）：靠左贴着左栏外缘留 8px，靠右对称。位置
         变体只动定位三件套，轮廓（渐变端盘 + stadium）与内部排版不动，所以
         任何停靠位下胶囊都保持同一形状。 */
      [data-ak-balance][data-ak-balance-position='left'] {
        top: 6px;
        left: 8px;
        transform: none;
      }
      [data-ak-balance][data-ak-balance-position='right'] {
        top: 6px;
        left: auto;
        right: 8px;
        transform: none;
      }
      /* 自动隐藏（侧边栏展开 / 指针靠近）写成单属性渐隐：JS 只切换
         data-ak-balance-shade，视觉在 CSS 里完成。透明之外再向上收
         6px 并关掉 hit-test 的余地（pointer-events 本来就是 none），过渡走
         基规则已声明的 opacity/transform 通道，遮挡消失后原路淡回。boot
         姿态期间被遮挡时同样收起——开场动画是装饰，遮挡是事实。 */
      [data-ak-balance][data-ak-balance-shade] {
        opacity: 0;
        transform: translateX(-50%) translateY(-6px);
      }
      [data-ak-balance][data-ak-balance-shade][data-ak-balance-position] {
        transform: translateY(-6px);
      }

      /* ---------- Ink fills need an inverted foreground in light mode ----------
         --dsw-alias-state-business-primary is ink in the light palette (see the
         neutralize block above), and consumers paint it as a FILL while their
         glyph stays on --dsw-alias-label-primary — which is ink too. Fill and
         glyph then resolve to #101110 and the control reads as a solid black
         rectangle: the host's active settings tab lost its own label, and
         third-party switches lost their knob.

         Fixing it here rather than by repainting the token keeps the light
         palette's ink/paper language: the fill stays ink, only the glyph moves
         to the host's pure white. Not --dsw-alias-label-primary-inverted: this
         sheet already repaints that role to ink in both palettes (see the warm
         label block), so the knob would stay invisible.

         Both selectors are structural rather than hash-named where the host
         allows it: the tab hook is the ARIA contract, the switch hook is the
         third-party class already pinned by dsh-better-display's own build.
         The tab hook is scoped to dialogs on purpose: the app's top-level nav
         is role=tab too, but it sits on paper with an ink underline, so its
         selected label must stay ink. */
      body:not([data-ds-dark-theme]) [role='dialog'] [role='tab'][aria-selected='true'] {
        color: var(--dsw-static-neutral-bluish-00) !important;
      }
      body:not([data-ds-dark-theme]) .xXul0q_switch[data-on]::after {
        background: var(--dsw-static-neutral-bluish-00) !important;
      }

/* ============================================================================
 * dsh-theme-arknights — faction palette + layout layer
 *
 * 本文件追加在 theme.css（功能样式）之后，做两件事：
 *
 *   1. **定义三套阵营 × 明暗的 --edge-* 变量组**。theme.css 里所有功能样式都
 *      读这些变量，令牌层（41-mount-tokens.js）也全部改成了 var(--edge-*) 引用，
 *      所以换阵营 = <body> 上的 class 翻转，应用自身的界面底色也一起跟着换。
 *
 *   2. **明日方舟风格的几何层**（两版共用）+ **进阶版排版重排**
 *      （body.theme-arknights-advanced）。通用适配版只换配色与纹理，进阶版重排
 *      侧栏/顶栏/输入区/消息区的视觉包装。
 *
 * 为什么分成「两版」
 * ----------------
 * 换配色几乎零风险，重排布局则依赖应用的 DOM。所以「好看」与「安全」被拆成两个
 * 可以独立选择的档位：universal 只有配色与细节，advanced 才动结构。任何一条
 * advanced 规则失配（上游改版）都只会少一处装饰，不会破版——这也是为什么进阶
 * 版全部用伪元素与宽容选择器，而不是改写 flex 骨架。
 *
 * 明日方舟的视觉语言（本文件的设计依据）
 * ------------------------------------
 *   - **全直角 + 斜切角**：卡片右下切一刀，是系列 UI 最有辨识度的几何动作
 *   - **HUD 标注**：编号、状态灯、坐标刻度、十字准星
 *   - **细双线**：一根发丝线 + 一段强调色短线，用于分区
 *   - **扫描线与网格**：极低不透明度的技术底纹
 *   - **大写窄字英文 + 中文黑体**：标题压字距、正文放开
 * ========================================================================== */

/* ---------------------------------------------------------------------------
 * 1. 三阵营 × 明暗
 *
 * 六组必须各自完整 —— 漏掉一条暗色规则的表现是「切到暗色后掉回默认阵营的色板」，
 * 看起来像主题只生效了一半。check.js 与 test/palette-contrast.test.js 都会拦。
 *
 * 取名规则：--edge-accent 是该阵营的「强色」，--edge-signal 是点缀色。
 * 罗德岛与拉特兰两者同色，莱茵生命则相反：accent 是黑白（无彩色），
 * 只有 signal 是橙色 —— 这正是参考里那套 ANALYSIS OS 的做法。
 * ------------------------------------------------------------------------- */

/* ---- 罗德岛 Rhodes Island · 亮色 ------------------------------------------ */
/*
 * 参考《罗德岛个人通讯终端》：纯黑底 + 白字 + 冷钢蓝点缀，
 *   装饰是粒子点阵与节点拓扑，线框极细。这里只是把「终端」的观感
 *   搬到网页上：底色压到近纯黑，强调色收成钢蓝而不是亮蓝。
 */
body.theme-arknights-themed {
  /* 纸面 */
  --edge-paper: #f2f4f6;
  --edge-panel: #fafbfc;
  --edge-overlay: #ffffff;
  --edge-soft: #e6eaee;
  --edge-line: #d5dbe1;
  --edge-line-2: #b6bfc8;
  --edge-ink: #0b0d0f;
  --edge-ink-2: #4b545c;
  
  /* 强调。亮色档本身就压得够暗（皇家蓝/钢蓝/墨黑），所以不必再拆一个
     onpaper 下沉档——accent 与 accent-onpaper 取同一个值，减一处漂移来源。 */
  --edge-accent: #1a6fa8;
  --edge-accent-rgb: 26, 111, 168;
  --edge-accent-deep: #14557f;
  --edge-accent-onpaper: #1a6fa8;
  --edge-signal: #1a6fa8;
  --edge-signal-dim: rgba(26, 111, 168, 0.7);
  
  /* 回合状态文字（遮罩扫光读这两个） */
  --edge-status-light: #155a88;
  --edge-status-light-mid: #104363;
  --edge-status-dark: #4fb3e8;
  --edge-status-dark-mid: #9bd4f4;
  
  /* 语义状态色 */
  --edge-error: #b42318;
  --edge-success: #197c4a;
  --edge-warn: #9a5b00;
  --edge-btn-muted: #dfe4e9;
  
  /* 装饰强度 */
  --edge-glow-light: 0.05;
  --edge-glow-dark: 0.04;
  --edge-wm-alpha: 0.09;
  
  /* 标题字族与字距：三套阵营的性格差异主要落在这里 */
  --edge-font-display: 'Barlow Condensed', 'Oswald', 'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --edge-tracking-display: 0.10em;
  
  /* 磨砂玻璃（可选） */
  --edge-glass-fill: 242 244 246;
  --edge-glass-alpha: 0.84;
  --edge-glass-blur: 14px;
  --edge-glass-edge: rgb(255 255 255 / 0.7);
  --edge-glass-sheen: rgb(255 255 255 / 0.4);
}

/* ---- 罗德岛 Rhodes Island · 暗色 ------------------------------------------ */
body.theme-arknights-themed[data-ds-dark-theme] {
  /* 纸面 */
  --edge-paper: #08090a;
  --edge-panel: #101214;
  --edge-overlay: #14171a;
  --edge-soft: #171a1d;
  --edge-line: #24282c;
  --edge-line-2: #383e45;
  --edge-ink: #f2f5f7;
  --edge-ink-2: #98a2ab;
  
  /* 强调。亮色档本身就压得够暗（皇家蓝/钢蓝/墨黑），所以不必再拆一个
     onpaper 下沉档——accent 与 accent-onpaper 取同一个值，减一处漂移来源。 */
  --edge-accent: #4fb3e8;
  --edge-accent-rgb: 79, 179, 232;
  --edge-accent-deep: #2f93c8;
  --edge-accent-onpaper: #1a6fa8;
  --edge-signal: #4fb3e8;
  --edge-signal-dim: rgba(79, 179, 232, 0.7);
  
  /* 回合状态文字（遮罩扫光读这两个） */
  --edge-status-light: #155a88;
  --edge-status-light-mid: #104363;
  --edge-status-dark: #4fb3e8;
  --edge-status-dark-mid: #9bd4f4;
  
  /* 语义状态色 */
  --edge-error: #ff6b61;
  --edge-success: #4fbf5c;
  --edge-warn: #ffb700;
  --edge-btn-muted: #1e2226;
  
  /* 装饰强度 */
  --edge-glow-light: 0.05;
  --edge-glow-dark: 0.10;
  --edge-wm-alpha: 0.06;
  
  /* 磨砂玻璃（可选） */
  --edge-glass-fill: 12 14 16;
  --edge-glass-alpha: 0.78;
  --edge-glass-blur: 16px;
  --edge-glass-edge: rgb(255 255 255 / 0.16);
  --edge-glass-sheen: rgb(255 255 255 / 0.06);
}

/* ---- 拉特兰 Laterano（数理风） · 亮色 ------------------------------------------ */
/*
 * 参考《拉特兰数理风 PPT》：冷灰白图纸 + 浅蓝网格，**皇家蓝 #1a3fd0**
 *   是唯一的强色；装饰是坐标系、圆形辅助线与数值标注；大标题用衬线粗体。
 *   与「暖金圣城」的直觉相反——这一版的拉特兰是「理律与几何」的气质。
 */
body.theme-arknights-themed.theme-arknights-laterano {
  /* 纸面 */
  --edge-paper: #eceef2;
  --edge-panel: #f6f7f9;
  --edge-overlay: #ffffff;
  --edge-soft: #e0e4ea;
  --edge-line: #d3d8e0;
  --edge-line-2: #b3bccb;
  --edge-ink: #14161a;
  --edge-ink-2: #4d545f;
  
  /* 强调。亮色档本身就压得够暗（皇家蓝/钢蓝/墨黑），所以不必再拆一个
     onpaper 下沉档——accent 与 accent-onpaper 取同一个值，减一处漂移来源。 */
  --edge-accent: #1a3fd0;
  --edge-accent-rgb: 26, 63, 208;
  --edge-accent-deep: #1230a8;
  --edge-accent-onpaper: #1a3fd0;
  --edge-signal: #1a3fd0;
  --edge-signal-dim: rgba(26, 63, 208, 0.7);
  
  /* 回合状态文字（遮罩扫光读这两个） */
  --edge-status-light: #1a3fd0;
  --edge-status-light-mid: #102a94;
  --edge-status-dark: #6b8cff;
  --edge-status-dark-mid: #a8bcff;
  
  /* 语义状态色 */
  --edge-error: #b42318;
  --edge-success: #0f6b3f;
  --edge-warn: #8a5300;
  --edge-btn-muted: #dde1ea;
  
  /* 装饰强度 */
  --edge-glow-light: 0.06;
  --edge-glow-dark: 0.05;
  --edge-wm-alpha: 0.09;
  
  /* 标题字族与字距：三套阵营的性格差异主要落在这里 */
  --edge-font-display: 'Cormorant Garamond', 'EB Garamond', 'Georgia', 'Songti SC', 'Noto Serif SC', 'SimSun', serif;
  --edge-tracking-display: 0.04em;
  
  /* 磨砂玻璃（可选） */
  --edge-glass-fill: 236 238 242;
  --edge-glass-alpha: 0.86;
  --edge-glass-blur: 14px;
  --edge-glass-edge: rgb(255 255 255 / 0.7);
  --edge-glass-sheen: rgb(255 255 255 / 0.4);
}

/* ---- 拉特兰 Laterano（数理风） · 暗色 ------------------------------------------ */
body.theme-arknights-themed.theme-arknights-laterano[data-ds-dark-theme] {
  /* 纸面 */
  --edge-paper: #0b0d12;
  --edge-panel: #141821;
  --edge-overlay: #12161e;
  --edge-soft: #1b2029;
  --edge-line: #262c38;
  --edge-line-2: #3a4353;
  --edge-ink: #eef1f6;
  --edge-ink-2: #96a0b0;
  
  /* 强调。亮色档本身就压得够暗（皇家蓝/钢蓝/墨黑），所以不必再拆一个
     onpaper 下沉档——accent 与 accent-onpaper 取同一个值，减一处漂移来源。 */
  --edge-accent: #6b8cff;
  --edge-accent-rgb: 107, 140, 255;
  --edge-accent-deep: #4569e8;
  --edge-accent-onpaper: #1a3fd0;
  --edge-signal: #6b8cff;
  --edge-signal-dim: rgba(107, 140, 255, 0.7);
  
  /* 回合状态文字（遮罩扫光读这两个） */
  --edge-status-light: #1a3fd0;
  --edge-status-light-mid: #102a94;
  --edge-status-dark: #6b8cff;
  --edge-status-dark-mid: #a8bcff;
  
  /* 语义状态色 */
  --edge-error: #ff6b61;
  --edge-success: #4fbf5c;
  --edge-warn: #ffb700;
  --edge-btn-muted: #232a38;
  
  /* 装饰强度 */
  --edge-glow-light: 0.06;
  --edge-glow-dark: 0.12;
  --edge-wm-alpha: 0.07;
  
  /* 磨砂玻璃（可选） */
  --edge-glass-fill: 14 18 26;
  --edge-glass-alpha: 0.78;
  --edge-glass-blur: 16px;
  --edge-glass-edge: rgb(255 255 255 / 0.16);
  --edge-glass-sheen: rgb(255 255 255 / 0.06);
}

/* ---- 莱茵生命 Rhine Lab（ANALYSIS OS） · 亮色 ------------------------------------------ */
/*
 * 参考《莱茵生命主题 PPT》：**几乎无彩色**——极浅暖白与纯黑两个极端，
 *   字标是宽松字距的无衬线三行排版，装饰是十字准星与极细网格，大面积留白。
 *   所以这里的强调色就是「黑 / 白」本身，只用一点橙色点缀（--edge-signal）
 *   来标记状态，而不是整片荧光绿。
 */
body.theme-arknights-themed.theme-arknights-rhine {
  /* 纸面 */
  --edge-paper: #f6f5f3;
  --edge-panel: #fbfaf9;
  --edge-overlay: #ffffff;
  --edge-soft: #eceae6;
  --edge-line: #dedbd6;
  --edge-line-2: #c2beb7;
  --edge-ink: #0d0c0b;
  --edge-ink-2: #55504a;
  
  /* 强调。亮色档本身就压得够暗（皇家蓝/钢蓝/墨黑），所以不必再拆一个
     onpaper 下沉档——accent 与 accent-onpaper 取同一个值，减一处漂移来源。 */
  --edge-accent: #1a1a1c;
  --edge-accent-rgb: 26, 26, 28;
  --edge-accent-deep: #000000;
  --edge-accent-onpaper: #1a1a1c;
  --edge-signal: #c9701a;
  --edge-signal-dim: rgba(201, 112, 26, 0.7);
  
  /* 回合状态文字（遮罩扫光读这两个） */
  --edge-status-light: #1a1a1c;
  --edge-status-light-mid: #4a4a4e;
  --edge-status-dark: #ececee;
  --edge-status-dark-mid: #ffffff;
  
  /* 语义状态色 */
  --edge-error: #a32318;
  --edge-success: #1a6b46;
  --edge-warn: #8a5a00;
  --edge-btn-muted: #e8e5e0;
  
  /* 装饰强度 */
  --edge-glow-light: 0.02;
  --edge-glow-dark: 0.02;
  --edge-wm-alpha: 0.08;
  
  /* 标题字族与字距：三套阵营的性格差异主要落在这里 */
  --edge-font-display: 'Inter', 'Helvetica Neue', 'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --edge-tracking-display: 0.18em;
  
  /* 磨砂玻璃（可选） */
  --edge-glass-fill: 246 245 243;
  --edge-glass-alpha: 0.88;
  --edge-glass-blur: 14px;
  --edge-glass-edge: rgb(255 255 255 / 0.7);
  --edge-glass-sheen: rgb(255 255 255 / 0.4);
}

/* ---- 莱茵生命 Rhine Lab（ANALYSIS OS） · 暗色 ------------------------------------------ */
body.theme-arknights-themed.theme-arknights-rhine[data-ds-dark-theme] {
  /* 纸面 */
  --edge-paper: #0a0a0b;
  --edge-panel: #121213;
  --edge-overlay: #161617;
  --edge-soft: #19191b;
  --edge-line: #26262a;
  --edge-line-2: #3a3a40;
  --edge-ink: #f2f1ef;
  --edge-ink-2: #a09b95;
  
  /* 强调。亮色档本身就压得够暗（皇家蓝/钢蓝/墨黑），所以不必再拆一个
     onpaper 下沉档——accent 与 accent-onpaper 取同一个值，减一处漂移来源。 */
  --edge-accent: #ececee;
  --edge-accent-rgb: 236, 236, 238;
  --edge-accent-deep: #ffffff;
  --edge-accent-onpaper: #1a1a1c;
  --edge-signal: #e8862a;
  --edge-signal-dim: rgba(232, 134, 42, 0.7);
  
  /* 回合状态文字（遮罩扫光读这两个） */
  --edge-status-light: #1a1a1c;
  --edge-status-light-mid: #4a4a4e;
  --edge-status-dark: #ececee;
  --edge-status-dark-mid: #ffffff;
  
  /* 语义状态色 */
  --edge-error: #ff6b61;
  --edge-success: #4fbf5c;
  --edge-warn: #ffb700;
  --edge-btn-muted: #202022;
  
  /* 装饰强度 */
  --edge-glow-light: 0.02;
  --edge-glow-dark: 0.05;
  --edge-wm-alpha: 0.06;
  
  /* 磨砂玻璃（可选） */
  --edge-glass-fill: 12 12 13;
  --edge-glass-alpha: 0.80;
  --edge-glass-blur: 16px;
  --edge-glass-edge: rgb(255 255 255 / 0.16);
  --edge-glass-sheen: rgb(255 255 255 / 0.06);
}

/* ---------------------------------------------------------------------------
 * 2. 公共派生量
 *
 * 与阵营无关的形状与强度，从强调色算出来。任何一处「强调色」都必须读变量——
 * 写死一个六位色值就会在另外两套阵营里变成一枚异物。
 * ------------------------------------------------------------------------- */
body.theme-arknights-themed {
  --ak-wash: rgba(var(--edge-accent-rgb), 0.08);
  --ak-wash-strong: rgba(var(--edge-accent-rgb), 0.16);
  --ak-hairline: rgba(var(--edge-accent-rgb), 0.3);
  --ak-cut: 10px;
  --ak-display: var(--edge-font-display);
}

/* 等宽数字：表格、耗时、百分比、token 计数在跳动时不产生横向抖动。
   挂在 <body> 上让所有后代继承，比按猜测的组件类名逐个挂可靠得多。 */
body.theme-arknights-themed {
  font-variant-numeric: tabular-nums;
}

/* ---------------------------------------------------------------------------
 * 3. 基础样式（两版共用）
 *
 * 只有「角色级」的东西：选中色、光标、焦点环、滚动条、标题字族。几何装饰全部
 * 归第 5 节的进阶版，这样通用适配版真的保持应用原生骨架。
 *
 * 选择器纪律：只用**已验证存在的** localName（见第 5 节顶部清单）。
 * ------------------------------------------------------------------------- */

body.theme-arknights-themed ::selection {
  background: var(--edge-accent);
  color: var(--edge-paper);
}

body.theme-arknights-themed {
  caret-color: var(--edge-accent);
}

body.theme-arknights-themed :focus-visible {
  outline: 2px solid var(--edge-accent);
  outline-offset: 1px;
}

/* ---- 滚动条：轨透明，滑块随阵营，悬停变强调色 -------------------------- */
body.theme-arknights-themed * {
  scrollbar-color: var(--edge-line-2) transparent;
  scrollbar-width: thin;
}

body.theme-arknights-themed ::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

body.theme-arknights-themed ::-webkit-scrollbar-track {
  background: transparent;
}

body.theme-arknights-themed ::-webkit-scrollbar-thumb {
  background: var(--edge-line-2);
  border-radius: 0;
}

body.theme-arknights-themed ::-webkit-scrollbar-thumb:hover {
  background: var(--edge-accent);
}

/* ---- 标题字族：三阵营的性格差异主要落在这一条 -------------------------- */
body.theme-arknights-themed [class$='_title'],
body.theme-arknights-themed [class$='_headline'] {
  font-family: var(--ak-display);
  letter-spacing: var(--edge-tracking-display);
}

/* ---- 表格行悬停：实心强调色淡底 ---------------------------------------- */
body.theme-arknights-themed tr:hover > td {
  background: var(--ak-wash);
}


/* ============================================================================
 * 4. 终端层派生量（仅进阶版）
 *
 * 这一层不再使用「加一条框、加一条线」的做法，而是把界面当成一台作战终端：
 * 侧栏是 PRTS 铭牌与终端作战位置，主区是部署图纸，输入框是任务简报通道，
 * 菜单是部署控制面板。下面所有规则都只挂在 .theme-arknights-advanced 上，
 * 通用适配版保持应用原生骨架。
 * ========================================================================== */

body.theme-arknights-advanced {
  --ak-mono: 'Cascadia Mono', 'JetBrains Mono', 'Consolas', ui-monospace, monospace;
  --ak-condensed: 'Bahnschrift SemiCondensed', 'Bahnschrift', 'Barlow Condensed', 'Oswald', var(--edge-font-display);
  --ak-hud: var(--ak-mono);
  --ak-cut: 12px;
  --ak-line: var(--edge-line);
  --ak-line-strong: var(--edge-line-2);
  --ak-wash: rgba(var(--edge-accent-rgb), 0.08);
  --ak-wash-strong: rgba(var(--edge-accent-rgb), 0.16);
  --ak-hairline: rgba(var(--edge-accent-rgb), 0.3);
  --ak-grid-small: rgba(var(--edge-accent-rgb), 0.05);
  --ak-grid-large: rgba(var(--edge-accent-rgb), 0.09);
  --ak-dot: rgba(var(--edge-accent-rgb), 0.38);
  --ak-signal-line: rgba(var(--edge-accent-rgb), 0.34);
  --ak-panel: var(--edge-panel);
  --ak-panel-raised: var(--edge-overlay);
  --ak-depth: 0 24px 60px -36px rgba(0, 0, 0, 0.72);
  --ak-deck-bg: linear-gradient(135deg, rgba(var(--edge-accent-rgb), 0.14), transparent 58%), var(--edge-soft);
  --ak-display-tui: var(--edge-font-display);
}

body.theme-arknights-advanced:not([data-ds-dark-theme]) {
  --ak-depth: 0 20px 46px -32px rgba(28, 34, 42, 0.32);
  --ak-dot: rgba(var(--edge-accent-rgb), 0.3);
}

/* ============================================================================
 * 5. 三阵营氛围层
 *
 * 每一套阵营一张 SVG 遮罩：遮罩只给形状，颜色统一来自 --edge-accent，所以
 * 换阵营 / 明暗无需另画图。画在 frame 的固定伪元素上，低于菜单与弹窗的
 * z-index，不抢点击。
 * ========================================================================== */

body.theme-arknights-advanced [class*='_frame'] {
  position: relative;
}

body.theme-arknights-advanced [class*='_frame']::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background-color: var(--edge-accent);
  /* 罗德岛：轨道圆环 + 节点拓扑 + 通讯弧线 + 精密网格 */
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1800' height='1100'%3E%3Cdefs%3E%3Cpattern id='g' width='90' height='90' patternUnits='userSpaceOnUse'%3E%3Cpath d='M90 0H0V90' fill='none' stroke='%23fff' stroke-width='.5' stroke-opacity='.16'/%3E%3C/pattern%3E%3Cpattern id='m' width='450' height='450' patternUnits='userSpaceOnUse'%3E%3Cpath d='M450 0H0V450' fill='none' stroke='%23fff' stroke-width='.7' stroke-opacity='.18'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='1800' height='1100' fill='url(%23g)'/%3E%3Crect width='1800' height='1100' fill='url(%23m)'/%3E%3Cg fill='none' stroke='%23fff'%3E%3Cg stroke-opacity='.34'%3E%3Ccircle cx='1370' cy='380' r='330'/%3E%3Ccircle cx='1370' cy='380' r='470'/%3E%3Ccircle cx='1370' cy='380' r='170' stroke-opacity='.22'/%3E%3Cpath d='M840 380H1900M1370 -160V920' stroke-opacity='.12'/%3E%3C/g%3E%3Cg stroke-opacity='.5'%3E%3Cpath d='M1370 50V78M1370 682V710M1040 380H1068M1672 380H1700'/%3E%3Cpath d='M1180 190 L1240 250M1560 190 L1500 250M1180 570 L1240 510M1560 570 L1500 510' stroke-opacity='.28'/%3E%3C/g%3E%3Cg stroke-opacity='.24'%3E%3Cpath d='M-80 840 Q 220 620 540 860 T 1080 820'/%3E%3Cpath d='M-40 120 Q 180 180 240 380'/%3E%3Cpath d='M1480 960 Q 1620 880 1840 940'/%3E%3Cpath d='M280 250 L420 170 L540 300 L330 430 Z'/%3E%3C/g%3E%3Cg fill='%23fff' stroke='none'%3E%3Ccircle cx='280' cy='250' r='2.6'/%3E%3Ccircle cx='420' cy='170' r='1.8'/%3E%3Ccircle cx='540' cy='300' r='2.2'/%3E%3Ccircle cx='330' cy='430' r='1.6'/%3E%3Ccircle cx='1050' cy='780' r='2'/%3E%3Ccircle cx='980' cy='860' r='1.4'/%3E%3C/g%3E%3Cg stroke-opacity='.22'%3E%3Cpath d='M90 1010H360M90 990V1010M360 990V1010'/%3E%3Cpath d='M1440 1010H1710M1440 990V1010M1710 990V1010'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1800' height='1100'%3E%3Cdefs%3E%3Cpattern id='g' width='90' height='90' patternUnits='userSpaceOnUse'%3E%3Cpath d='M90 0H0V90' fill='none' stroke='%23fff' stroke-width='.5' stroke-opacity='.16'/%3E%3C/pattern%3E%3Cpattern id='m' width='450' height='450' patternUnits='userSpaceOnUse'%3E%3Cpath d='M450 0H0V450' fill='none' stroke='%23fff' stroke-width='.7' stroke-opacity='.18'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='1800' height='1100' fill='url(%23g)'/%3E%3Crect width='1800' height='1100' fill='url(%23m)'/%3E%3Cg fill='none' stroke='%23fff'%3E%3Cg stroke-opacity='.34'%3E%3Ccircle cx='1370' cy='380' r='330'/%3E%3Ccircle cx='1370' cy='380' r='470'/%3E%3Ccircle cx='1370' cy='380' r='170' stroke-opacity='.22'/%3E%3Cpath d='M840 380H1900M1370 -160V920' stroke-opacity='.12'/%3E%3C/g%3E%3Cg stroke-opacity='.5'%3E%3Cpath d='M1370 50V78M1370 682V710M1040 380H1068M1672 380H1700'/%3E%3Cpath d='M1180 190 L1240 250M1560 190 L1500 250M1180 570 L1240 510M1560 570 L1500 510' stroke-opacity='.28'/%3E%3C/g%3E%3Cg stroke-opacity='.24'%3E%3Cpath d='M-80 840 Q 220 620 540 860 T 1080 820'/%3E%3Cpath d='M-40 120 Q 180 180 240 380'/%3E%3Cpath d='M1480 960 Q 1620 880 1840 940'/%3E%3Cpath d='M280 250 L420 170 L540 300 L330 430 Z'/%3E%3C/g%3E%3Cg fill='%23fff' stroke='none'%3E%3Ccircle cx='280' cy='250' r='2.6'/%3E%3Ccircle cx='420' cy='170' r='1.8'/%3E%3Ccircle cx='540' cy='300' r='2.2'/%3E%3Ccircle cx='330' cy='430' r='1.6'/%3E%3Ccircle cx='1050' cy='780' r='2'/%3E%3Ccircle cx='980' cy='860' r='1.4'/%3E%3C/g%3E%3Cg stroke-opacity='.22'%3E%3Cpath d='M90 1010H360M90 990V1010M360 990V1010'/%3E%3Cpath d='M1440 1010H1710M1440 990V1010M1710 990V1010'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  -webkit-mask-size: cover;
  mask-size: cover;
  -webkit-mask-position: center top;
  mask-position: center top;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  opacity: 0.62;
  mix-blend-mode: screen;
}

/* 拉特兰：浅蓝图纸 + 同心圆 + 电光蓝斜切碎片 + 坐标刻度 */
body.theme-arknights-advanced.theme-arknights-laterano [class*='_frame']::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1800' height='1100'%3E%3Cdefs%3E%3Cpattern id='g' width='36' height='36' patternUnits='userSpaceOnUse'%3E%3Cpath d='M36 0H0V36' fill='none' stroke='%23fff' stroke-width='.4' stroke-opacity='.2'/%3E%3C/pattern%3E%3Cpattern id='m' width='180' height='180' patternUnits='userSpaceOnUse'%3E%3Cpath d='M180 0H0V180' fill='none' stroke='%23fff' stroke-width='.6' stroke-opacity='.24'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='1800' height='1100' fill='url(%23g)'/%3E%3Crect width='1800' height='1100' fill='url(%23m)'/%3E%3Cg fill='none' stroke='%23fff'%3E%3Cg stroke-opacity='.36'%3E%3Ccircle cx='330' cy='300' r='90'/%3E%3Ccircle cx='330' cy='300' r='150'/%3E%3Ccircle cx='330' cy='300' r='230'/%3E%3Ccircle cx='330' cy='300' r='300' stroke-opacity='.12'/%3E%3Cpath d='M330 -40V640M-60 300H720' stroke-opacity='.14'/%3E%3C/g%3E%3Cg stroke-opacity='.5'%3E%3Cpath d='M330 50V68M330 532V550M80 300H98M562 300H580'/%3E%3Cpath d='M180 150 L210 180M480 150 L450 180M180 450 L210 420M480 450 L450 420' stroke-opacity='.35'/%3E%3C/g%3E%3Cg stroke-opacity='.3'%3E%3Cpath d='M-120 900 L620 -40M180 1140 L920 100'/%3E%3Cpath d='M220 980 A 90 90 0 0 1 400 980'/%3E%3Cpath d='M240 980 A 130 130 0 0 1 420 980'/%3E%3C/g%3E%3C/g%3E%3Cg fill='%23fff' stroke='none'%3E%3Cpolygon points='1440,0 1800,0 1800,560 1620,360' fill-opacity='.09'/%3E%3Cpolygon points='1800,620 1800,1100 1380,1100 1660,760' fill-opacity='.07'/%3E%3Cpolygon points='1210,0 1420,0 1800,700 1700,700' fill-opacity='.04'/%3E%3Ccircle cx='330' cy='70' r='2.4'/%3E%3Ccircle cx='580' cy='300' r='2'/%3E%3Ccircle cx='330' cy='550' r='1.8'/%3E%3C/g%3E%3Cg fill='none' stroke='%23fff' stroke-opacity='.28'%3E%3Cpath d='M1540 70H1720M1540 60V80M1720 60V80'/%3E%3Cpath d='M1500 900H1690M1500 890V910M1690 890V910'/%3E%3C/g%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1800' height='1100'%3E%3Cdefs%3E%3Cpattern id='g' width='36' height='36' patternUnits='userSpaceOnUse'%3E%3Cpath d='M36 0H0V36' fill='none' stroke='%23fff' stroke-width='.4' stroke-opacity='.2'/%3E%3C/pattern%3E%3Cpattern id='m' width='180' height='180' patternUnits='userSpaceOnUse'%3E%3Cpath d='M180 0H0V180' fill='none' stroke='%23fff' stroke-width='.6' stroke-opacity='.24'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='1800' height='1100' fill='url(%23g)'/%3E%3Crect width='1800' height='1100' fill='url(%23m)'/%3E%3Cg fill='none' stroke='%23fff'%3E%3Cg stroke-opacity='.36'%3E%3Ccircle cx='330' cy='300' r='90'/%3E%3Ccircle cx='330' cy='300' r='150'/%3E%3Ccircle cx='330' cy='300' r='230'/%3E%3Ccircle cx='330' cy='300' r='300' stroke-opacity='.12'/%3E%3Cpath d='M330 -40V640M-60 300H720' stroke-opacity='.14'/%3E%3C/g%3E%3Cg stroke-opacity='.5'%3E%3Cpath d='M330 50V68M330 532V550M80 300H98M562 300H580'/%3E%3Cpath d='M180 150 L210 180M480 150 L450 180M180 450 L210 420M480 450 L450 420' stroke-opacity='.35'/%3E%3C/g%3E%3Cg stroke-opacity='.3'%3E%3Cpath d='M-120 900 L620 -40M180 1140 L920 100'/%3E%3Cpath d='M220 980 A 90 90 0 0 1 400 980'/%3E%3Cpath d='M240 980 A 130 130 0 0 1 420 980'/%3E%3C/g%3E%3C/g%3E%3Cg fill='%23fff' stroke='none'%3E%3Cpolygon points='1440,0 1800,0 1800,560 1620,360' fill-opacity='.09'/%3E%3Cpolygon points='1800,620 1800,1100 1380,1100 1660,760' fill-opacity='.07'/%3E%3Cpolygon points='1210,0 1420,0 1800,700 1700,700' fill-opacity='.04'/%3E%3Ccircle cx='330' cy='70' r='2.4'/%3E%3Ccircle cx='580' cy='300' r='2'/%3E%3Ccircle cx='330' cy='550' r='1.8'/%3E%3C/g%3E%3Cg fill='none' stroke='%23fff' stroke-opacity='.28'%3E%3Cpath d='M1540 70H1720M1540 60V80M1720 60V80'/%3E%3Cpath d='M1500 900H1690M1500 890V910M1690 890V910'/%3E%3C/g%3E%3C/svg%3E");
  opacity: 0.42;
}

/* 莱茵生命：单色 ∞ 结构 + 贯穿全页的 X 对角线 + 十字准星 + 极细分度 */
body.theme-arknights-advanced.theme-arknights-rhine [class*='_frame']::before {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1800' height='1100'%3E%3Cdefs%3E%3Cpattern id='g' width='72' height='72' patternUnits='userSpaceOnUse'%3E%3Cpath d='M72 0H0V72' fill='none' stroke='%23fff' stroke-width='.5' stroke-opacity='.2'/%3E%3C/pattern%3E%3Cpattern id='m' width='360' height='360' patternUnits='userSpaceOnUse'%3E%3Cpath d='M360 0H0V360' fill='none' stroke='%23fff' stroke-width='.7' stroke-opacity='.24'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='1800' height='1100' fill='url(%23g)'/%3E%3Crect width='1800' height='1100' fill='url(%23m)'/%3E%3Cg fill='none' stroke='%23fff'%3E%3Cpath d='M0 0 L1800 1100M1800 0 L0 1100' stroke-opacity='.28'/%3E%3Cg stroke-opacity='.34'%3E%3Cellipse cx='1130' cy='420' rx='300' ry='165' transform='rotate(24 1130 420)'/%3E%3Cellipse cx='1130' cy='420' rx='300' ry='165' transform='rotate(-24 1130 420)'/%3E%3C/g%3E%3Cg stroke-opacity='.4'%3E%3Cpath d='M1130 300V330M1130 510V540M1010 420H1040M1220 420H1250'/%3E%3Ccircle cx='1130' cy='420' r='18' stroke-opacity='.3'/%3E%3Cpath d='M330 760H380M355 735V785'/%3E%3Ccircle cx='355' cy='760' r='44' stroke-opacity='.18'/%3E%3C/g%3E%3Cg stroke-opacity='.22'%3E%3Cpath d='M1380 160H1460M1600 840H1660M120 180H210M680 930H740'/%3E%3C/g%3E%3C/g%3E%3Cg fill='%23fff' stroke='none'%3E%3Crect x='1510' y='220' width='128' height='48' fill-opacity='.16'/%3E%3Crect x='1654' y='238' width='12' height='12' fill-opacity='.4'/%3E%3Ccircle cx='1130' cy='420' r='2.6'/%3E%3Ccircle cx='355' cy='760' r='2.2'/%3E%3C/g%3E%3Cg fill='none' stroke='%23fff' stroke-opacity='.18'%3E%3Cpath d='M40 40H90M40 40V90M1760 1060H1710M1760 1060V1010'/%3E%3C/g%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1800' height='1100'%3E%3Cdefs%3E%3Cpattern id='g' width='72' height='72' patternUnits='userSpaceOnUse'%3E%3Cpath d='M72 0H0V72' fill='none' stroke='%23fff' stroke-width='.5' stroke-opacity='.2'/%3E%3C/pattern%3E%3Cpattern id='m' width='360' height='360' patternUnits='userSpaceOnUse'%3E%3Cpath d='M360 0H0V360' fill='none' stroke='%23fff' stroke-width='.7' stroke-opacity='.24'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='1800' height='1100' fill='url(%23g)'/%3E%3Crect width='1800' height='1100' fill='url(%23m)'/%3E%3Cg fill='none' stroke='%23fff'%3E%3Cpath d='M0 0 L1800 1100M1800 0 L0 1100' stroke-opacity='.28'/%3E%3Cg stroke-opacity='.34'%3E%3Cellipse cx='1130' cy='420' rx='300' ry='165' transform='rotate(24 1130 420)'/%3E%3Cellipse cx='1130' cy='420' rx='300' ry='165' transform='rotate(-24 1130 420)'/%3E%3C/g%3E%3Cg stroke-opacity='.4'%3E%3Cpath d='M1130 300V330M1130 510V540M1010 420H1040M1220 420H1250'/%3E%3Ccircle cx='1130' cy='420' r='18' stroke-opacity='.3'/%3E%3Cpath d='M330 760H380M355 735V785'/%3E%3Ccircle cx='355' cy='760' r='44' stroke-opacity='.18'/%3E%3C/g%3E%3Cg stroke-opacity='.22'%3E%3Cpath d='M1380 160H1460M1600 840H1660M120 180H210M680 930H740'/%3E%3C/g%3E%3C/g%3E%3Cg fill='%23fff' stroke='none'%3E%3Crect x='1510' y='220' width='128' height='48' fill-opacity='.16'/%3E%3Crect x='1654' y='238' width='12' height='12' fill-opacity='.4'/%3E%3Ccircle cx='1130' cy='420' r='2.6'/%3E%3Ccircle cx='355' cy='760' r='2.2'/%3E%3C/g%3E%3Cg fill='none' stroke='%23fff' stroke-opacity='.18'%3E%3Cpath d='M40 40H90M40 40V90M1760 1060H1710M1760 1060V1010'/%3E%3C/g%3E%3C/svg%3E");
  opacity: 0.34;
}

/* 亮色纸面上用 multiply：只压暗、不增亮，白底不动，文字不受影响。 */
body.theme-arknights-advanced:not([data-ds-dark-theme]) [class*='_frame']::before {
  mix-blend-mode: multiply;
}

/* ---- 静态气氛：光晕、点阵、纸张颗粒 ------------------------------------ */
body.theme-arknights-advanced [class*='_frame']::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background-image:
    radial-gradient(circle at 80% 16%, rgba(var(--edge-accent-rgb), 0.11), transparent 42%),
    radial-gradient(circle at 10% 90%, rgba(var(--edge-accent-rgb), 0.07), transparent 38%),
    radial-gradient(circle, var(--ak-dot) 1px, transparent 1.4px),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.05'/%3E%3C/svg%3E");
  background-size: 100% 100%, 100% 100%, 250px 210px, 180px 180px;
  background-position: center, center, 0 0, 0 0;
  background-repeat: no-repeat, no-repeat, repeat, repeat;
  opacity: 0.9;
}

body.theme-arknights-advanced.theme-arknights-laterano [class*='_frame']::after {
  background-image:
    radial-gradient(circle at 86% 20%, rgba(var(--edge-accent-rgb), 0.12), transparent 40%),
    linear-gradient(128deg, transparent 46%, rgba(var(--edge-accent-rgb), 0.055) 46.15%, transparent 46.6%),
    radial-gradient(circle, var(--ak-dot) 1px, transparent 1.4px),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.05'/%3E%3C/svg%3E");
  background-size: 100% 100%, 100% 100%, 230px 190px, 180px 180px;
}

body.theme-arknights-advanced.theme-arknights-rhine {
  --ak-dot: rgba(201, 112, 26, 0.34);
  --ak-signal-line: rgba(201, 112, 26, 0.5);
}

body.theme-arknights-advanced.theme-arknights-rhine[data-ds-dark-theme] {
  --ak-dot: rgba(232, 134, 42, 0.34);
}

body.theme-arknights-advanced.theme-arknights-rhine [class*='_frame']::after {
  background-image:
    radial-gradient(circle at 78% 24%, rgba(var(--edge-accent-rgb), 0.05), transparent 36%),
    radial-gradient(circle, var(--ak-dot) 1px, transparent 1.4px),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.06'/%3E%3C/svg%3E");
  background-size: 100% 100%, 320px 260px, 180px 180px;
}

/* ---- 扫描光带：只有罗德岛保留常驻动效 -------------------------------- */
@keyframes ak-terminal-sweep {
  0% { transform: translateY(-24vh); opacity: 0; }
  10% { opacity: 0.5; }
  88% { opacity: 0.5; }
  100% { transform: translateY(116vh); opacity: 0; }
}

body.theme-arknights-advanced:not(.theme-arknights-laterano):not(.theme-arknights-rhine)::after {
  content: '';
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  height: 150px;
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(var(--edge-accent-rgb), 0.025) 44%,
    rgba(var(--edge-accent-rgb), 0.06) 50%,
    rgba(var(--edge-accent-rgb), 0.025) 56%,
    transparent
  );
  animation: ak-terminal-sweep 12s linear infinite;
}

/* ---- 页面边缘 HUD：四角括号 + 右缘刻度尺 ------------------------------ */
body.theme-arknights-advanced::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background-image:
    linear-gradient(var(--edge-accent), var(--edge-accent)),
    linear-gradient(var(--edge-accent), var(--edge-accent)),
    linear-gradient(var(--edge-accent), var(--edge-accent)),
    linear-gradient(var(--edge-accent), var(--edge-accent)),
    linear-gradient(var(--edge-accent), var(--edge-accent)),
    linear-gradient(var(--edge-accent), var(--edge-accent)),
    linear-gradient(var(--edge-accent), var(--edge-accent)),
    linear-gradient(var(--edge-accent), var(--edge-accent)),
    repeating-linear-gradient(to bottom, var(--edge-line-2) 0 1px, transparent 1px 12px);
  background-size:
    26px 1px, 1px 26px,
    26px 1px, 1px 26px,
    26px 1px, 1px 26px,
    26px 1px, 1px 26px,
    4px 100%;
  background-position:
    12px 12px, 12px 12px,
    right 12px top 12px, right 12px top 12px,
    12px bottom 12px, 12px bottom 12px,
    right 12px bottom 12px, right 12px bottom 12px,
    right 12px top 0;
  background-repeat: no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, repeat-y;
  opacity: 0.55;
}

/* ============================================================================
 * 6. 侧栏：PRTS 铭牌与终端作战位置
 * ========================================================================== */

body.theme-arknights-advanced [class$='_sidebarCol'] {
  border-right: 1px solid var(--ak-line-strong);
  background: linear-gradient(180deg, rgba(var(--edge-accent-rgb), 0.045), transparent 24%);
}

body.theme-arknights-advanced [data-ak-tui='sidebar'] {
  position: relative;
  background-color: var(--ak-panel);
  background-image:
    linear-gradient(90deg, rgba(var(--edge-accent-rgb), 0.04), transparent 46%),
    repeating-linear-gradient(to bottom, transparent 0 39px, rgba(var(--edge-accent-rgb), 0.045) 39px 40px);
}

body.theme-arknights-advanced [data-ak-tui='logo'] {
  border-bottom: 1px solid var(--ak-line);
}

/* ---- PRTS 铭牌 --------------------------------------------------------- */
body.theme-arknights-advanced .ak-terminal-deck {
  position: relative;
  margin: 8px 12px 10px;
  padding: 8px 10px 7px;
  color: var(--edge-ink);
  background: var(--ak-deck-bg);
  border: 1px solid var(--ak-line-strong);
  border-left: 3px solid var(--edge-accent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
  font-family: var(--ak-mono);
  overflow: hidden;
}

body.theme-arknights-advanced .ak-terminal-deck::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, var(--edge-accent), transparent 72%);
  pointer-events: none;
}

body.theme-arknights-advanced .ak-terminal-deck::after {
  content: '';
  position: absolute;
  right: -26px;
  top: -30px;
  width: 104px;
  height: 104px;
  border: 1px solid var(--ak-hairline);
  border-radius: 50%;
  box-shadow: 0 0 0 12px rgba(var(--edge-accent-rgb), 0.045);
  pointer-events: none;
}

body.theme-arknights-advanced .ak-terminal-deck__top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 7.5px;
  letter-spacing: 0.14em;
  color: var(--edge-ink-2);
  text-transform: uppercase;
}

body.theme-arknights-advanced .ak-terminal-deck__prts b {
  color: var(--edge-accent);
  font-weight: 400;
}

body.theme-arknights-advanced .ak-terminal-deck__status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  font-size: 6.5px;
  letter-spacing: 0.1em;
  color: var(--edge-success);
}

body.theme-arknights-advanced .ak-terminal-deck__status i,
body.theme-arknights-advanced .ak-terminal-sector-head__live i {
  display: inline-block;
  width: 4px;
  height: 4px;
  background: currentColor;
  box-shadow: 0 0 4px currentColor;
  animation: ak-terminal-pulse 2.6s ease-in-out infinite;
}

@keyframes ak-terminal-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

body.theme-arknights-advanced .ak-terminal-deck__main {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 5px;
}

body.theme-arknights-advanced .ak-terminal-deck__sector {
  flex: 0 0 auto;
  font-family: var(--ak-condensed);
  font-size: 34px;
  font-weight: 600;
  line-height: 0.82;
  letter-spacing: -0.02em;
  color: var(--edge-accent);
}

body.theme-arknights-advanced .ak-terminal-deck__sectorLabel {
  flex: 0 0 auto;
  padding-left: 8px;
  border-left: 1px solid var(--ak-line-strong);
  font-size: 6px;
  line-height: 1.15;
  letter-spacing: 0.2em;
  color: var(--edge-ink-2);
}

body.theme-arknights-advanced .ak-terminal-deck__ident {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  margin-left: auto;
  text-align: right;
}

body.theme-arknights-advanced .ak-terminal-deck__en {
  overflow: hidden;
  font-family: var(--ak-condensed);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.13em;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--edge-ink);
}

body.theme-arknights-advanced .ak-terminal-deck__zh {
  font-size: 8px;
  line-height: 1;
  letter-spacing: 0.3em;
  color: var(--edge-ink-2);
}

body.theme-arknights-advanced .ak-terminal-deck__bottom {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  margin-top: 7px;
  padding-top: 5px;
  border-top: 1px solid var(--ak-line);
  font-size: 6px;
  line-height: 1;
  letter-spacing: 0.14em;
  color: var(--edge-ink-2);
  white-space: nowrap;
}

body.theme-arknights-advanced .ak-terminal-deck__signal {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 9px;
}

body.theme-arknights-advanced .ak-terminal-deck__signal i {
  display: block;
  width: 2px;
  background: var(--edge-accent);
}

body.theme-arknights-advanced .ak-terminal-deck__signal i:nth-child(1) { height: 3px; opacity: 0.35; }
body.theme-arknights-advanced .ak-terminal-deck__signal i:nth-child(2) { height: 5px; opacity: 0.5; }
body.theme-arknights-advanced .ak-terminal-deck__signal i:nth-child(3) { height: 7px; opacity: 0.72; }
body.theme-arknights-advanced .ak-terminal-deck__signal i:nth-child(4) { height: 9px; opacity: 1; }

body.theme-arknights-advanced .ak-terminal-deck__freq b {
  color: var(--edge-accent);
  font-weight: 400;
}

/* 拉特兰：双线边 + 衬线字标 */
body.theme-arknights-advanced.theme-arknights-laterano .ak-terminal-deck {
  border-left: 4px double var(--edge-accent);
}

body.theme-arknights-advanced.theme-arknights-laterano .ak-terminal-deck__sector,
body.theme-arknights-advanced.theme-arknights-laterano .ak-terminal-deck__en {
  font-family: var(--ak-display-tui);
  font-weight: 500;
}

/* 莱茵生命：单色、更少装饰、橙色状态灯 */
body.theme-arknights-advanced.theme-arknights-rhine .ak-terminal-deck {
  border-left-width: 1px;
  background: linear-gradient(135deg, rgba(var(--edge-accent-rgb), 0.06), transparent 58%), var(--edge-soft);
}

body.theme-arknights-advanced.theme-arknights-rhine .ak-terminal-deck__status {
  color: var(--edge-signal);
}

body.theme-arknights-advanced.theme-arknights-rhine .ak-terminal-deck::after {
  box-shadow: 0 0 0 12px rgba(var(--edge-accent-rgb), 0.02);
}

/* ---- 侧栏工作区抬头：终端作战位置 -------------------------------------- */
body.theme-arknights-advanced .ak-terminal-sector-head {
  position: relative;
  margin: 10px 12px 2px;
  padding: 7px 0 7px 10px;
  border-top: 1px solid var(--ak-line-strong);
  border-bottom: 1px solid var(--ak-line);
  border-left: 2px solid var(--edge-accent);
  background: linear-gradient(90deg, rgba(var(--edge-accent-rgb), 0.09), transparent 78%);
  font-family: var(--ak-mono);
}

body.theme-arknights-advanced .ak-terminal-sector-head__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 6.5px;
  letter-spacing: 0.16em;
  color: var(--edge-ink-2);
}

body.theme-arknights-advanced .ak-terminal-sector-head__top b {
  color: var(--edge-accent);
  font-weight: 400;
}

body.theme-arknights-advanced .ak-terminal-sector-head__top [data-ak-part='count'] {
  color: var(--edge-accent);
}

body.theme-arknights-advanced .ak-terminal-sector-head__title {
  margin-top: 3px;
  font-family: var(--ak-condensed);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: 0.14em;
  color: var(--edge-ink);
}

body.theme-arknights-advanced .ak-terminal-sector-head__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 3px;
  font-size: 6px;
  letter-spacing: 0.14em;
  color: var(--edge-ink-2);
}

body.theme-arknights-advanced .ak-terminal-sector-head__live {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--edge-accent);
}

body.theme-arknights-advanced .ak-terminal-sector-head__live i {
  background: var(--edge-accent);
  box-shadow: 0 0 0 2px rgba(var(--edge-accent-rgb), 0.12);
}

/* 大读数行：「SECTOR 01 / 04」+ 一句键位提示。分子比标签大、分母比分子小，
   这一档读起来像终端的状态行；莱茵终端档把它拉成参考那种硬件计数器（lab.css）。 */
body.theme-arknights-advanced .ak-terminal-sector-head__readout {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--ak-line);
  font-size: 6.5px;
  letter-spacing: 0.16em;
  color: var(--edge-ink-2);
}

body.theme-arknights-advanced .ak-terminal-sector-head__roActive {
  font-size: 13px;
  line-height: 1;
  letter-spacing: 0.04em;
  color: var(--edge-accent);
}

body.theme-arknights-advanced .ak-terminal-sector-head__roSlash {
  font-style: normal;
  opacity: 0.5;
}

body.theme-arknights-advanced .ak-terminal-sector-head__roTotal {
  color: var(--edge-ink);
}

body.theme-arknights-advanced .ak-terminal-sector-head__keys {
  margin-left: auto;
  font-size: 6px;
  letter-spacing: 0.1em;
  opacity: 0.8;
}

/* 铭牌槽：莱茵终端档在抬头底部钉一块写着当前工作区名字的黑牌（lab.css）；
   进阶版没有这件器材，节点常驻但不显示。 */
body.theme-arknights-advanced .ak-terminal-sector-head__plate {
  display: none;
}

/* 原生 sectionHeader 变成抬头下方的工具条 */
body.theme-arknights-advanced [data-ak-tui='section-header'] {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px 5px 12px !important;
  border-bottom: 1px solid var(--ak-line);
}

body.theme-arknights-advanced [data-ak-tui='section-label'] {
  display: none;
}

body.theme-arknights-advanced [data-ak-tui='section-header'] > *:nth-child(2) {
  margin-left: auto;
}

body.theme-arknights-advanced [data-ak-tui='section-header'] button {
  color: var(--edge-ink-2);
}

body.theme-arknights-advanced [data-ak-tui='section-header'] button:hover {
  color: var(--edge-accent);
}

/* ---- 工作区行：编号 + 切角选中态 -------------------------------------- */
body.theme-arknights-advanced [data-ak-tui='sector-row'] {
  position: relative;
  margin: 1px 8px;
  padding: 5px 8px 5px 6px !important;
  border: 1px solid transparent;
  border-left: 2px solid transparent;
  border-radius: 0;
  transition: background 120ms ease, border-color 120ms ease;
}

body.theme-arknights-advanced [data-ak-tui='sector-row']:hover {
  background: var(--ak-wash);
  border-color: var(--ak-line);
}

body.theme-arknights-advanced [data-ak-tui='sector-row'][data-ak-active='true'] {
  background: var(--edge-accent) !important;
  border-color: var(--edge-accent);
  color: var(--edge-paper) !important;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%);
}

body.theme-arknights-advanced [data-ak-tui='sector-row'][data-ak-active='true']::after {
  content: '';
  position: absolute;
  top: 4px;
  right: 4px;
  width: 5px;
  height: 5px;
  border-top: 1px solid var(--edge-paper);
  border-right: 1px solid var(--edge-paper);
  opacity: 0.72;
  pointer-events: none;
}

body.theme-arknights-advanced [data-ak-tui='sector-row'][data-ak-active='true'] .ak-sector-code {
  color: var(--edge-paper);
  font-weight: 700;
  opacity: 0.9;
}

body.theme-arknights-advanced [data-ak-tui='sector-row'][data-ak-active='true'] svg,
body.theme-arknights-advanced [data-ak-tui='sector-row'][data-ak-active='true'] [class*='_title'] {
  color: var(--edge-paper);
}

body.theme-arknights-advanced .ak-sector-code {
  flex: 0 0 18px;
  font-family: var(--ak-mono);
  font-size: 8px;
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.02em;
  color: var(--edge-ink-2);
  opacity: 0.72;
  pointer-events: none;
}

body.theme-arknights-advanced [data-ak-tui='sector-row'][data-ak-active='true'] .ak-sector-code {
  color: var(--edge-paper);
  font-weight: 700;
  opacity: 0.9;
}

body.theme-arknights-advanced [data-ak-tui='sector-row'] [class*='_title'] {
  font-family: var(--ak-condensed);
  letter-spacing: 0.04em;
}

/* ---- 会话行：更克制的终端条目 ------------------------------------------ */
body.theme-arknights-advanced [class*='_sessionRow'] {
  position: relative;
  border-left: 2px solid transparent;
  border-radius: 0;
  transition: background 120ms ease, border-color 120ms ease;
}

body.theme-arknights-advanced [class*='_sessionRow']:hover {
  background: var(--ak-wash);
  border-left-color: var(--ak-hairline);
}

body.theme-arknights-advanced [class*='_sessionRow'][class*='_selected'],
body.theme-arknights-advanced [class*='_sessionRow'][aria-selected='true'] {
  background: linear-gradient(90deg, rgba(var(--edge-accent-rgb), 0.14), transparent 82%) !important;
  border-left-color: var(--edge-accent);
}

/* ---- 新会话：终端里的 DEPLOY 按钮 ------------------------------------- */
body.theme-arknights-advanced [data-ak-tui='new-session'] {
  position: relative;
  margin: 0 12px 8px;
  height: 34px;
  border: 1px solid var(--ak-line-strong);
  border-left: 3px solid var(--edge-accent);
  border-radius: 0;
  background: linear-gradient(90deg, rgba(var(--edge-accent-rgb), 0.15), transparent 80%);
  color: var(--edge-ink);
  font-family: var(--ak-condensed);
  font-size: 12px;
  letter-spacing: 0.14em;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
  transition: background 130ms ease, border-color 130ms ease;
}

body.theme-arknights-advanced [data-ak-tui='new-session']:hover {
  background: linear-gradient(90deg, rgba(var(--edge-accent-rgb), 0.25), rgba(var(--edge-accent-rgb), 0.05) 88%);
  border-color: var(--edge-accent);
}

body.theme-arknights-advanced.theme-arknights-laterano [data-ak-tui='new-session'] {
  border-color: var(--edge-accent);
  background: var(--edge-accent);
  color: var(--edge-paper);
}

body.theme-arknights-advanced.theme-arknights-laterano [data-ak-tui='new-session']:hover {
  background: var(--edge-accent-deep);
}

body.theme-arknights-advanced.theme-arknights-rhine [data-ak-tui='new-session'] {
  border-color: var(--edge-accent);
  border-left: 3px solid var(--edge-signal);
  background: var(--edge-accent);
  color: var(--edge-paper);
}

body.theme-arknights-advanced.theme-arknights-rhine [data-ak-tui='new-session']:hover {
  background: var(--edge-accent);
  filter: brightness(1.08);
}

body.theme-arknights-advanced [data-ak-tui='panel-row'] {
  font-family: var(--ak-condensed);
  letter-spacing: 0.06em;
}

/* ============================================================================
 * 7. 顶栏与主区：指挥频道 + 部署图纸
 * ========================================================================== */

body.theme-arknights-advanced [data-ak-tui='header'] {
  position: relative;
  border-bottom-color: transparent !important;
}

body.theme-arknights-advanced [data-ak-tui='header'][data-ak-blank='true'] {
  background: linear-gradient(180deg, rgba(var(--edge-accent-rgb), 0.055), transparent) !important;
  border-bottom: 1px solid var(--ak-line) !important;
}

body.theme-arknights-advanced [data-ak-tui='header'][data-ak-blank='true']::before {
  content: 'PRTS // RHODES ISLAND COMMAND';
  position: absolute;
  left: 22px;
  top: 50%;
  transform: translateY(-50%);
  font-family: var(--ak-hud);
  font-size: 7.5px;
  letter-spacing: 0.22em;
  color: var(--edge-ink-2);
  pointer-events: none;
}

body.theme-arknights-advanced.theme-arknights-laterano [data-ak-tui='header'][data-ak-blank='true']::before {
  content: 'LATERANO // AXIOM CHANNEL';
}

body.theme-arknights-advanced.theme-arknights-rhine [data-ak-tui='header'][data-ak-blank='true']::before {
  content: 'RHINE LAB // ANALYSIS OS';
}

body.theme-arknights-advanced [data-ak-tui='header'][data-ak-blank='true']::after {
  content: 'SIGNAL 04 · LINK STABLE';
  position: absolute;
  right: 62px;
  top: 50%;
  transform: translateY(-50%);
  font-family: var(--ak-hud);
  font-size: 6.5px;
  letter-spacing: 0.18em;
  color: var(--edge-accent);
  opacity: 0.8;
  pointer-events: none;
}

body.theme-arknights-advanced.theme-arknights-rhine [data-ak-tui='header'][data-ak-blank='true']::after {
  content: 'ANALYSIS 03 · STABLE';
  color: var(--edge-signal);
}

/* ---- 空状态外框：四角括号 ---------------------------------------------- */
body.theme-arknights-advanced [data-ak-tui='hero'] {
  position: relative;
}

body.theme-arknights-advanced [data-ak-tui='hero']::before {
  content: '';
  position: absolute;
  inset: -18px -10px -12px;
  z-index: 1;
  pointer-events: none;
  background-image:
    linear-gradient(var(--edge-accent), var(--edge-accent)),
    linear-gradient(var(--edge-accent), var(--edge-accent)),
    linear-gradient(var(--edge-accent), var(--edge-accent)),
    linear-gradient(var(--edge-accent), var(--edge-accent)),
    linear-gradient(var(--edge-accent), var(--edge-accent)),
    linear-gradient(var(--edge-accent), var(--edge-accent)),
    linear-gradient(var(--edge-accent), var(--edge-accent)),
    linear-gradient(var(--edge-accent), var(--edge-accent));
  background-size: 18px 1px, 1px 18px, 18px 1px, 1px 18px, 18px 1px, 1px 18px, 18px 1px, 1px 18px;
  background-position: left top, left top, right top, right top, left bottom, left bottom, right bottom, right bottom;
  background-repeat: no-repeat;
  opacity: 0.55;
}

/* ---- 幽灵扇区号与抬头 -------------------------------------------------- */
body.theme-arknights-advanced [data-ak-tui='hero-stack'] {
  position: relative;
  isolation: isolate;
}

body.theme-arknights-advanced [data-ak-tui='hero-stack']::before {
  content: attr(data-ak-sector);
  position: absolute;
  right: -2%;
  top: -58px;
  z-index: -1;
  font-family: var(--ak-condensed);
  font-size: clamp(120px, 15vw, 236px);
  font-weight: 700;
  line-height: 0.8;
  letter-spacing: -0.06em;
  color: rgba(var(--edge-accent-rgb), 0.022);
  -webkit-text-stroke: 1px rgba(var(--edge-accent-rgb), 0.34);
  pointer-events: none;
  user-select: none;
}

body.theme-arknights-advanced:not([data-ds-dark-theme]) [data-ak-tui='hero-stack']::before {
  color: rgba(var(--edge-accent-rgb), 0.03);
  -webkit-text-stroke-color: rgba(var(--edge-accent-rgb), 0.3);
}

body.theme-arknights-advanced.theme-arknights-laterano [data-ak-tui='hero-stack']::before {
  font-family: var(--ak-display-tui);
  font-weight: 500;
  letter-spacing: 0;
  -webkit-text-stroke-width: 0.8px;
}

body.theme-arknights-advanced.theme-arknights-rhine [data-ak-tui='hero-stack']::before {
  color: rgba(var(--edge-accent-rgb), 0.055);
  -webkit-text-stroke-width: 0;
}

body.theme-arknights-advanced [data-ak-tui='hero-stack']::after {
  content: 'SECTOR ' attr(data-ak-sector) ' // TERMINAL DEPLOYMENT';
  position: absolute;
  left: 0;
  right: 0;
  top: -21px;
  z-index: 1;
  font-family: var(--ak-hud);
  font-size: 7px;
  line-height: 1;
  letter-spacing: 0.28em;
  text-align: center;
  color: var(--edge-accent);
  opacity: 0.8;
  pointer-events: none;
}

body.theme-arknights-advanced [class*='_heroGlow'] {
  background: radial-gradient(ellipse at center, rgba(var(--edge-accent-rgb), 0.16), transparent 68%) !important;
  filter: blur(2px);
  opacity: 0.9;
}

body.theme-arknights-advanced:not([data-ds-dark-theme]) [class*='_heroGlow'] {
  background: radial-gradient(ellipse at center, rgba(var(--edge-accent-rgb), 0.1), transparent 68%) !important;
}

body.theme-arknights-advanced [class*='_headline'] {
  font-family: var(--ak-condensed);
  font-weight: 600;
  letter-spacing: 0.1em;
}

body.theme-arknights-advanced [class*='_previewBadge'] {
  padding: 1px 7px;
  border: 1px solid var(--edge-accent) !important;
  border-radius: 0;
  background: var(--edge-accent) !important;
  color: var(--edge-paper) !important;
  font-family: var(--ak-hud);
  font-size: 8px;
  letter-spacing: 0.14em;
  clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%);
}

/* ---- 终端作战位置面板 -------------------------------------------------- */
body.theme-arknights-advanced [data-ak-tui='deploy-row'] {
  position: relative;
  margin-top: 28px !important;
  padding: 22px 10px 9px !important;
  border: 1px solid var(--ak-line-strong);
  border-left: 2px solid var(--edge-accent);
  background:
    linear-gradient(90deg, rgba(var(--edge-accent-rgb), 0.12), transparent 62%),
    var(--ak-panel);
  box-shadow: inset 0 1px 0 rgba(var(--edge-accent-rgb), 0.12);
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%);
}

body.theme-arknights-advanced [data-ak-tui='deploy-row']::before {
  content: '终端作战位置  //  TERMINAL DEPLOYMENT POSITION';
  position: absolute;
  left: 0;
  top: 0;
  height: 17px;
  padding: 0 12px 0 10px;
  font-family: var(--ak-hud);
  font-size: 7px;
  line-height: 17px;
  letter-spacing: 0.17em;
  color: var(--edge-paper);
  background: var(--edge-accent);
  clip-path: polygon(0 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
  pointer-events: none;
}

body.theme-arknights-advanced [data-ak-tui='deploy-row']::after {
  content: 'SECTOR ' attr(data-ak-sector) ' // READY';
  position: absolute;
  right: 12px;
  top: 3px;
  font-family: var(--ak-hud);
  font-size: 6.5px;
  letter-spacing: 0.14em;
  color: var(--edge-accent);
  pointer-events: none;
}

body.theme-arknights-advanced [data-ak-tui='workspace'] {
  position: relative;
  min-height: 27px;
  padding: 3px 9px;
  border: 1px solid var(--ak-line-strong);
  border-radius: 0;
  background: rgba(var(--edge-accent-rgb), 0.07);
  color: var(--edge-ink);
  font-family: var(--ak-condensed);
  font-size: 12px;
  letter-spacing: 0.06em;
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);
}

body.theme-arknights-advanced [data-ak-tui='workspace']:hover {
  border-color: var(--edge-accent);
  background: var(--ak-wash-strong);
}

body.theme-arknights-advanced [data-ak-tui='workspace'] svg {
  color: var(--edge-accent);
}

body.theme-arknights-advanced [data-ak-tui='workspace']::after {
  content: '▾';
  margin-left: 6px;
  font-family: var(--ak-hud);
  font-size: 8px;
  color: var(--edge-accent);
}

body.theme-arknights-advanced [data-ak-tui='mode'] {
  min-height: 27px;
  padding: 3px 8px;
  border: 1px solid var(--ak-line);
  border-radius: 0;
  background: transparent;
  color: var(--edge-ink-2);
  font-family: var(--ak-mono);
  font-size: 9px;
  letter-spacing: 0.06em;
}

body.theme-arknights-advanced [data-ak-tui='mode']:hover {
  border-color: var(--edge-accent);
  color: var(--edge-ink);
}

/* ---- 输入卡：任务简报通道 ---------------------------------------------- */
body.theme-arknights-advanced [data-ak-tui='composer'] {
  position: relative;
  border: 1px solid var(--ak-line-strong) !important;
  border-radius: 0 !important;
  background-color: var(--ak-panel-raised) !important;
  background-image:
    repeating-linear-gradient(0deg, transparent 0 23px, rgba(var(--edge-accent-rgb), 0.028) 23px 24px),
    repeating-linear-gradient(90deg, transparent 0 23px, rgba(var(--edge-accent-rgb), 0.022) 23px 24px),
    linear-gradient(180deg, rgba(var(--edge-accent-rgb), 0.075), transparent 42%) !important;
  box-shadow:
    inset 2px 0 0 var(--edge-accent),
    inset 0 0 0 1px rgba(var(--edge-accent-rgb), 0.06),
    0 20px 54px -36px rgba(0, 0, 0, 0.75);
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%);
}

body.theme-arknights-advanced [data-ak-tui='composer']::before {
  content: 'INPUT CHANNEL // MISSION BRIEF';
  position: absolute;
  left: 20px;
  top: 6px;
  z-index: 2;
  font-family: var(--ak-hud);
  font-size: 6.5px;
  line-height: 1.4;
  letter-spacing: 0.2em;
  color: var(--edge-ink-2);
  opacity: 0.72;
  pointer-events: none;
}

body.theme-arknights-advanced [data-ak-tui='composer']::after {
  content: '';
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 12px;
  height: 12px;
  border-right: 1px solid var(--edge-accent);
  border-bottom: 1px solid var(--edge-accent);
  opacity: 0.55;
  pointer-events: none;
}

body.theme-arknights-advanced [data-ak-tui='composer']:focus-within {
  border-color: var(--edge-accent) !important;
  box-shadow:
    inset 2px 0 0 var(--edge-accent),
    inset 0 0 0 1px rgba(var(--edge-accent-rgb), 0.16),
    0 22px 58px -34px rgba(var(--edge-accent-rgb), 0.35);
}

body.theme-arknights-advanced [data-ak-tui='composer-seat'] {
  position: relative;
}

/* ---- 空状态页脚：作战记录带 -------------------------------------------- */
body.theme-arknights-advanced .ak-terminal-footer {
  position: fixed;
  left: 50%;
  bottom: 22px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 11px;
  transform: translateX(-50%);
  pointer-events: none;
  white-space: nowrap;
  font-family: var(--ak-hud);
  font-size: 6.5px;
  letter-spacing: 0.2em;
  color: var(--edge-ink-2);
  opacity: 0.74;
}

@media (max-width: 900px) {
  body.theme-arknights-advanced .ak-terminal-footer {
    display: none;
  }
}

body.theme-arknights-advanced .ak-terminal-footer b {
  color: var(--edge-accent);
  font-weight: 400;
}

body.theme-arknights-advanced .ak-terminal-footer__sector {
  padding: 2px 7px;
  border: 1px solid var(--ak-hairline);
  color: var(--edge-accent);
  letter-spacing: 0.16em;
}

body.theme-arknights-advanced .ak-terminal-footer__rule {
  width: clamp(24px, 8vw, 110px);
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--ak-line-strong));
}

body.theme-arknights-advanced .ak-terminal-footer__rule:last-child {
  background: linear-gradient(90deg, var(--ak-line-strong), transparent);
}

/* ---- 通用卡片与弹窗：保持直角语言 -------------------------------------- */
body.theme-arknights-advanced [class*='_card'] {
  border-radius: 0;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%);
}

body.theme-arknights-advanced [role='dialog'] {
  border: 1px solid var(--ak-line-strong);
  border-radius: 0;
  box-shadow:
    inset 0 0 0 1px rgba(var(--edge-accent-rgb), 0.1),
    var(--ak-depth);
}

/* ============================================================================
 * 8. 工作区菜单：部署控制面板
 * ========================================================================== */

body.theme-arknights-advanced [data-ak-tui='menu'] {
  padding: 0 !important;
  border: 1px solid var(--ak-line-strong);
  border-left: 2px solid var(--edge-accent);
  border-radius: 0;
  background: var(--ak-panel-raised) !important;
  box-shadow:
    inset 0 1px 0 rgba(var(--edge-accent-rgb), 0.12),
    var(--ak-depth);
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%);
}

body.theme-arknights-advanced .ak-deploy-menu__head {
  position: sticky;
  top: 0;
  z-index: 3;
  padding: 7px 11px 6px;
  border-bottom: 1px solid var(--ak-line-strong);
  background:
    linear-gradient(90deg, rgba(var(--edge-accent-rgb), 0.14), transparent 72%),
    var(--ak-panel);
  font-family: var(--ak-mono);
  pointer-events: none;
}

body.theme-arknights-advanced .ak-deploy-menu__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 6.5px;
  line-height: 1;
  letter-spacing: 0.16em;
  color: var(--edge-ink-2);
  white-space: nowrap;
}

body.theme-arknights-advanced .ak-deploy-menu__top b {
  color: var(--edge-accent);
  font-weight: 400;
}

body.theme-arknights-advanced .ak-deploy-menu__top [data-ak-part='sector'] {
  color: var(--edge-accent);
  font-size: 8px;
}

body.theme-arknights-advanced .ak-deploy-menu__title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 4px;
  white-space: nowrap;
}

body.theme-arknights-advanced .ak-deploy-menu__title > span {
  font-family: var(--ak-condensed);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: 0.14em;
  color: var(--edge-ink);
}

body.theme-arknights-advanced .ak-deploy-menu__title > i {
  font-family: var(--ak-hud);
  font-size: 5.5px;
  font-style: normal;
  letter-spacing: 0.12em;
  color: var(--edge-ink-2);
}

body.theme-arknights-advanced .ak-deploy-menu__title > em {
  margin-left: auto;
  font-family: var(--ak-hud);
  font-size: 7px;
  font-style: normal;
  letter-spacing: 0.14em;
  color: var(--edge-accent);
}

body.theme-arknights-advanced [data-ak-tui='menu-viewport'] {
  padding: 4px !important;
  max-height: min(62vh, 560px);
  scrollbar-width: thin;
}

body.theme-arknights-advanced [data-ak-tui='menu-item'] {
  display: flex;
  align-items: center;
  width: calc(100% - 4px) !important;
  height: 35px !important;
  margin: 1px 2px;
  padding: 5px 8px !important;
  border: 1px solid transparent;
  border-left: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--edge-ink);
  font-family: var(--ak-condensed);
  font-size: 12px;
  letter-spacing: 0.03em;
  transition: background 110ms ease, border-color 110ms ease;
}

body.theme-arknights-advanced [data-ak-tui='menu-item']::before {
  content: attr(data-ak-sector);
  flex: 0 0 20px;
  font-family: var(--ak-mono);
  font-size: 7.5px;
  letter-spacing: 0;
  color: var(--edge-ink-2);
  opacity: 0.7;
}

body.theme-arknights-advanced [data-ak-tui='menu-item']:hover,
body.theme-arknights-advanced [data-ak-tui='menu-item']:focus-visible {
  background: var(--ak-wash);
  border-color: var(--ak-line);
  border-left-color: var(--ak-hairline);
}

body.theme-arknights-advanced [data-ak-tui='menu-item'][data-ak-active='true'] {
  background: linear-gradient(90deg, var(--edge-accent), rgba(var(--edge-accent-rgb), 0.82)) !important;
  border-color: var(--edge-accent);
  color: var(--edge-paper) !important;
  box-shadow: inset 2px 0 0 rgba(255, 255, 255, 0.25);
}

body.theme-arknights-advanced [data-ak-tui='menu-item'][data-ak-active='true']::before {
  color: var(--edge-paper);
  opacity: 0.8;
}

body.theme-arknights-advanced [data-ak-tui='menu-item'][data-ak-active='true'] svg {
  color: var(--edge-paper);
}

body.theme-arknights-advanced [data-ak-tui='menu-footer'] {
  padding: 4px !important;
  border-top: 1px solid var(--ak-line);
}

body.theme-arknights-advanced [data-ak-tui='menu-footer'] button {
  border: 1px dashed var(--ak-line-strong) !important;
  border-radius: 0 !important;
  font-family: var(--ak-mono);
  font-size: 9px;
  letter-spacing: 0.06em;
  color: var(--edge-ink-2);
}

body.theme-arknights-advanced [data-ak-tui='menu-footer'] button:hover {
  border-color: var(--edge-accent) !important;
  color: var(--edge-ink);
  background: var(--ak-wash);
}

/* ============================================================================
 * 9. 悬浮阵营条
 * ========================================================================== */

/* 挂在 <body> 末尾的常驻浮层，所以自己定位：右上角、表头条（40px）下方一行，
   和顶部的额度胶囊（top:6px，可居左/中/右停靠）错开，两者不会互相压字。
   z-index 与额度胶囊同级（900）：高于页面内容，低于应用自己的弹窗。 */
.ak-bar {
  position: fixed;
  top: 46px;
  right: 16px;
  z-index: 900;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  border-radius: 0;
  border: 1px solid var(--edge-line-2);
  border-left: 2px solid var(--edge-accent);
  background: var(--edge-overlay);
  font-family: 'Cascadia Mono', 'JetBrains Mono', Consolas, ui-monospace, monospace;
  box-shadow: 0 10px 28px -18px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);
}

.ak-bar__current {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  font: inherit;
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--edge-ink);
  background: transparent;
  border: 0;
  border-radius: 0;
  cursor: pointer;
}

/* 三选一默认收起，只留当前态那一行：常驻浮层不该长期占住右上角。 */
.ak-bar__list {
  display: none;
  flex-direction: column;
  border-top: 1px solid var(--edge-line);
}

.ak-bar[data-open='true'] .ak-bar__list {
  display: flex;
}

.ak-bar__item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font: inherit;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-align: left;
  color: var(--edge-ink-2);
  background: transparent;
  border: 0;
  border-radius: 0;
  cursor: pointer;
}

.ak-bar__current:hover,
.ak-bar__item:hover {
  color: var(--edge-ink);
  background: var(--ak-wash);
}

/* 当前阵营：整行反白。徽标走 currentColor，所以形状跟着一起反白，
   不依赖颜色也能认出是哪一套（badge 文字同时在）。 */
.ak-bar__item[aria-pressed='true'] {
  color: var(--edge-paper);
  background: var(--edge-accent);
}

.ak-bar__label {
  margin-left: 2px;
}

.ak-bar__caret {
  margin-left: auto;
  padding-left: 6px;
  font-size: 10px;
  opacity: 0.55;
}

.ak-bar__badge {
  border-radius: 0;
  font-family: 'Cascadia Mono', 'JetBrains Mono', Consolas, ui-monospace, monospace;
}

/* ---- 阵营徽标 ----------------------------------------------------------
   三张内联 SVG 只出形状，颜色走 currentColor，所以选中项反白时徽标跟着一起
   反白，明暗两套配色也不用各画一份。形状挂在元素自己的 data-ak-crest 上，
   而不是 body 的阵营 class 上——设置页的三张卡片要同时摆出三枚，主题关掉时
   它们也还在。图案是按各阵营的界面语言重画的几何记号（罗德岛：罗盘环 + 源石
   菱形；拉特兰：光环 + 立柱十字 + 两侧光翼；莱茵生命：交叉双轨 + 准星点），
   不是任何官方标识的描摹。 */
.ak-crest {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  background-color: currentColor;
  -webkit-mask-image: var(--ak-crest);
  mask-image: var(--ak-crest);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}

[data-ak-crest='rhodes'] {
  --ak-crest: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='%23fff' stroke-width='1.6'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M12 6.5 16 12 12 17.5 8 12Z'/%3E%3Cpath d='M1.5 12h3M19.5 12h3'/%3E%3C/g%3E%3Cpath fill='%23fff' d='M12 9.6 13.7 12 12 14.4 10.3 12Z'/%3E%3C/svg%3E");
}

[data-ak-crest='laterano'] {
  --ak-crest: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='%23fff' stroke-width='1.6'%3E%3Ccircle cx='12' cy='8.4' r='4.6'/%3E%3Cpath d='M12 13v8.5M7.5 17.5h9'/%3E%3Cpath d='M2.6 4.4 6 7.2M21.4 4.4 18 7.2'/%3E%3C/g%3E%3C/svg%3E");
}

[data-ak-crest='rhine'] {
  --ak-crest: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='%23fff' stroke-width='1.6'%3E%3Cellipse cx='12' cy='12' rx='9.2' ry='4.4' transform='rotate(28 12 12)'/%3E%3Cellipse cx='12' cy='12' rx='9.2' ry='4.4' transform='rotate(-28 12 12)'/%3E%3C/g%3E%3Ccircle cx='12' cy='12' r='1.9' fill='%23fff'/%3E%3C/svg%3E");
}

/* 下拉里的三枚与设置页阵营行的三枚同为 13px：两处都是 11px 字号的按钮，
   15px 会把文字挤下去。 */
.ak-bar__item .ak-crest,
.ak-settings .ak-crest {
  width: 13px;
  height: 13px;
}

/* ============================================================================
 * 10. 品牌文案：三阵营各自的字标与加载屏序列
 *
 * theme.css 里的字标全部由 CSS content 绘制（元素没有 DOM 文本节点），
 * 换品牌只覆盖 content，不改 DOM。
 * ========================================================================== */

body.theme-arknights-themed [data-ak-watermark]::before {
  content: 'RHODES ISLAND';
}

/* 终端层已经有图纸几何与幽灵扇区号，巨型字标再保持原强度会和它们互相压字。
   这里只压低水印自身的可见度，不动它的位置与尺寸，关掉终端层即恢复。 */
body.theme-arknights-advanced [data-ak-watermark] {
  opacity: 0.36;
  font-family: var(--ak-display);
}

body.theme-arknights-advanced:not([data-ds-dark-theme]) [data-ak-watermark] {
  opacity: 0.42;
}

body.theme-arknights-themed.theme-arknights-laterano [data-ak-watermark]::before {
  content: 'LATERANO';
}

body.theme-arknights-themed.theme-arknights-rhine [data-ak-watermark]::before {
  content: 'RHINE LAB';
}

body.theme-arknights-themed [data-ak-loader-word1]::before { content: 'RHODES'; }
body.theme-arknights-themed [data-ak-loader-word2]::before { content: 'ISLAND'; }
body.theme-arknights-themed.theme-arknights-laterano [data-ak-loader-word1]::before { content: 'LATER'; }
body.theme-arknights-themed.theme-arknights-laterano [data-ak-loader-word2]::before { content: 'ANO'; }
body.theme-arknights-themed.theme-arknights-rhine [data-ak-loader-word1]::before { content: 'RHINE'; }
body.theme-arknights-themed.theme-arknights-rhine [data-ak-loader-word2]::before { content: 'LAB'; }

body.theme-arknights-themed [data-ak-loader-kicker]::before {
  content: 'RHODES ISLAND COMMAND THEME';
}

body.theme-arknights-themed.theme-arknights-laterano [data-ak-loader-kicker]::before {
  content: 'LATERANO HOLY CITY THEME';
}

body.theme-arknights-themed.theme-arknights-rhine [data-ak-loader-kicker]::before {
  content: 'RHINE LAB RESEARCH THEME';
}

body.theme-arknights-themed [data-ak-loader-tag]::before {
  content: 'RHODES ISLAND / BOOT SEQUENCE';
}

body.theme-arknights-themed.theme-arknights-laterano [data-ak-loader-tag]::before {
  content: 'LATERANO / BOOT SEQUENCE';
}

body.theme-arknights-themed.theme-arknights-rhine [data-ak-loader-tag]::before {
  content: 'RHINE LAB / BOOT SEQUENCE';
}

body.theme-arknights-themed [data-ak-loader-sub]::before {
  content: 'RESIST AND ENDURE / RHODES ISLAND';
}

body.theme-arknights-themed.theme-arknights-laterano [data-ak-loader-sub]::before {
  content: 'SUB UMBRA ALARUM / LATERANO';
}

body.theme-arknights-themed.theme-arknights-rhine [data-ak-loader-sub]::before {
  content: 'KNOWLEDGE IS THE ONLY FRONTIER / RHINE LAB';
}

body.theme-arknights-themed [data-ak-thunder-word] {
  font-family: var(--edge-font-display);
  letter-spacing: var(--edge-tracking-display);
}

/* ============================================================================
 * 11. 响应式与减少动态效果
 * ========================================================================== */

@media (max-width: 1180px) {
  body.theme-arknights-advanced [data-ak-tui='hero-stack']::before {
    font-size: clamp(96px, 15vw, 180px);
    opacity: 0.75;
  }
}

@media (max-width: 900px) {
  body.theme-arknights-advanced [class*='_frame']::before {
    opacity: 0.34;
  }

  body.theme-arknights-advanced [data-ak-tui='hero']::before {
    display: none;
  }

  body.theme-arknights-advanced [data-ak-tui='deploy-row']::after {
    display: none;
  }

  body.theme-arknights-advanced [data-ak-tui='header'][data-ak-blank='true']::after {
    display: none;
  }
}

@media (max-width: 760px) {
  body.theme-arknights-advanced [data-ak-tui='hero-stack']::after {
    display: none;
  }

  body.theme-arknights-advanced [data-ak-tui='deploy-row']::before {
    font-size: 6px;
    letter-spacing: 0.1em;
  }

  body.theme-arknights-advanced .ak-deploy-menu__title > i {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  body.theme-arknights-advanced::after,
  body.theme-arknights-advanced .ak-terminal-deck__status i,
  body.theme-arknights-advanced .ak-terminal-sector-head__live i {
    animation: none !important;
  }

  body.theme-arknights-advanced::after {
    opacity: 0;
  }

  body.theme-arknights-advanced [data-ak-tui='sector-row'],
  body.theme-arknights-advanced [class*='_sessionRow'],
  body.theme-arknights-advanced [data-ak-tui='new-session'],
  body.theme-arknights-advanced [data-ak-tui='menu-item'],
  .ak-bar,
  .ak-bar__item {
    transition: none !important;
  }
}

/* ============================================================================
 * dsh-theme-arknights — lab.css · 第三档「莱茵终端版」
 *
 * 追加在 faction.css 之后。它不是第四套阵营，也不是 advanced 的替代品：它是
 * **叠在 advanced 之上的一层材质**，所以它的每条结构规则都同时挂着
 * .theme-arknights-advanced.theme-arknights-lab —— 少挂前者，lab 会去重排一个
 * 没有注入钩子的裸界面；少挂后者，档位切换就找不到这一层。
 *
 * 设计依据：MikeQu223/Rhine-Music-Database（Qt6/QML 的音乐库终端）与它的演示
 * 视频。它的界面不是「明日方舟的阵营皮肤」，而是一台**器材**：固定 1920×1080
 * 舞台、整屏陶瓷白面板、数值一律右对齐、标题是一行大写拉丁 + 一行中文副标题、
 * 返回键是实心块、全局只有一个圆形元素（播放盘），页脚写 POWERED BY RHINE LAB。
 *
 * 更要紧的是它的**立面与选择模型**：那台终端的整面墙是一组**档案柜**，本档把
 * 这套读法整个搬过来当侧栏的结构。
 *   第一级  档案立面 —— 每个可选项是一块竖立的平板，排满一行再起一行；板面
 *           上部靠左贴一枚暖色编号标签，当前那块整板点亮、微微前移，板上钉一块
 *           黑底名牌；柜面上方钉一条写着当前条目名字的黑铭牌。
 *           读数在抬头：「COLUMN 01 / 05」与「← → 换列 · ↑ ↓ 选块」。
 *           → DSH 的**工作区**。
 *   第二级  短档案板 —— 当前列表里的条目铺成同读法的横向短板，板号压在左上角
 *           标签上，当前板点亮、标签翻成黑牌；两批格子之间一条「BLOCK 01 / 06」。
 *           → DSH 的**会话**。
 * 于是侧栏不再是一条纵向清单，而是「先挑板、再挑格」的两级器材界面。
 *
 * 分工（与阵营维度正交）
 * ----------------------
 *   阵营（faction.css）  强调色、点缀色、回合状态色、徽标形状 —— 「谁的设备」
 *   档位（本文件）       纸面家族、字体字距、玻璃、阴影、几何语言、装饰密度
 *                        —— 「设备是哪一代」
 * 因此本文件**不覆盖 --edge-accent / --accent-rgb / --accent-onpaper / --signal
 * / --status-***：身份色仍然只有阵营那一份真相，切阵营在 lab 里一样看得见。
 * 陶瓷底 + 钢蓝 / 电光蓝 / 墨黑三种强调都成立，其中莱茵生命那一套与参考项目
 * 几乎重合。
 *
 * 唯一的例外是 --edge-error / --success / --warn 三个语义状态色：它们判的是
 * 「压在哪张纸上」，而纸正是本层换掉的东西，所以按陶瓷/石墨重新量过一遍
 * （test/palette-contrast.test.js 会把阵营的莱茵终端档逐组验算）。
 *
 * 参考项目的两条硬规则被完整保留：
 *   1. 一个界面里只允许一个圆形元素（播放盘）。本层把它给发送按钮，其余全部
 *      直角 —— 所以 advanced 的斜切 clip-path 在这里退回直线。
 *   2. 数值永远靠右、标签永远靠左，中间用一根发丝线连起来。侧栏计数、频道号、
 *      扇区编号都按这个排。
 * ========================================================================== */

/* ---------------------------------------------------------------------------
 * 1. 材质令牌：陶瓷白 / 石墨黑
 *
 * 纸面家族整套接管（这是档位的本体），强调色留给阵营。--lab-* 是本层自己的
 * 派生量，不进 check.js 的阵营契约清单，因为它们不描述颜色身份，只描述材质：
 * 条纹、值块、发丝线，以及参考里那台器材的「硬件件」颜色——硬件件用的就是
 * 阵营强调色，所以这里没有第二份色值需要维护。
 * ------------------------------------------------------------------------- */

/* ---- 亮色：陶瓷 ---------------------------------------------------------- */
body.theme-arknights-advanced.theme-arknights-lab {
  /* 纸面取自参考的陶瓷档，但整族上移一格：它的页底 #e1ded6 压上钢蓝强调色
     只有 4.02:1，实心按钮上的字不到 AA。把 #edebe4（参考的面板档）当成本档的
     paper，最紧的那一档（罗德岛）刚好回到 4.53:1，而条纹仍然是 #edebe4 /
     #e7e5df 那对——观感不变，判据过关。 */
  --edge-paper: #edebe4;
  --edge-panel: #f1efe9;
  --edge-overlay: #f7f6f1;
  --edge-soft: #e7e5df;
  --edge-line: #dcd8ce;
  --edge-line-2: #b3afa1;
  --edge-ink: #1a1c19;
  --edge-ink-2: #55584d;

  --edge-btn-muted: #e4e1d9;
  --edge-error: #9f3830;
  --edge-success: #3d5c33;
  --edge-warn: #7a5a12;

  /* 装饰强度：陶瓷面是哑光器材，不该有辉光；点阵与颗粒一并压到最低。 */
  --edge-glow-light: 0.02;
  --edge-glow-dark: 0.02;
  --edge-wm-alpha: 0.07;

  /* 字族：参考用一版宽字距的中性 grotesque 做标题，正文不动。 */
  --edge-font-display: 'Inter', 'Helvetica Neue', 'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --edge-tracking-display: 0.16em;

  --edge-glass-fill: 241 239 233;
  --edge-glass-alpha: 0.86;
  --edge-glass-blur: 12px;
  --edge-glass-edge: rgb(255 255 255 / 0.6);
  --edge-glass-sheen: rgb(255 255 255 / 0.34);

  /* 本层派生量 */
  --lab-chip: #f1efe9;
  --lab-hairline: rgba(85, 88, 77, 0.22);
  --lab-hairline-strong: rgba(85, 88, 77, 0.4);
  --lab-depth: 0 18px 42px -30px rgba(60, 58, 46, 0.34);
  --lab-plate: linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0) 38%);

  /* 柜体：亮色档没有参考那片深色立面可借——它是一台陶瓷器材——所以柜面取
     瓷灰、板面取纸白，标签是一枚黄铜小牌（参考里每块板贴的也是暖色标签）。
     选中的板把纸面照亮，标签才翻成黑牌——两档的明暗关系因此是同一条。 */
  --lab-cavity: #d5d0c4;
  --lab-cavity-deep: #bdb7a8;
  --lab-slab: #f1efe9;
  --lab-slab-lit: rgba(255, 255, 255, 0.9);
  --lab-slab-side: rgba(85, 88, 77, 0.22);
  --lab-slab-shadow: rgba(60, 58, 46, 0.24);
  --lab-tab: #b08a46;
  --lab-tab-ink: #171812;
  --lab-plaque: #101210;
  --lab-plaque-ink: #efe6cf;
  --lab-dot: rgba(85, 88, 77, 0.16);
  --lab-rail: rgba(85, 88, 77, 0.3);

  /* 被灯打亮的那块板不是上了强调色的板：参考里它只是把纸面照到发白，
     所以选中态用「亮纸」而不是阵营色。文字随之固定为深墨——纸在亮暗两档
     都亮，--edge-paper 却是「页面底色」，暗档里是黑的，不能拿来当纸上的字。 */
  --lab-lit-slab: #fffdf6;
  --lab-lit-ink: #141613;
  --lab-lit-edge: rgba(255, 255, 255, 1);
  --lab-lit-glow: rgba(60, 58, 46, 0.3);
}

/* ---- 暗色：石墨 ------------------------------------------------------------
   参考的暗色不是纯黑，是带一点绿相的深石墨（#141613 / #161914），文字
   #eeeeeb；分层同样靠发丝线。语义色取自它自己的取样：薄荷绿与铁锈红。 */
body.theme-arknights-advanced.theme-arknights-lab[data-ds-dark-theme] {
  --edge-paper: #141613;
  --edge-panel: #161914;
  --edge-overlay: #1d211b;
  --edge-soft: #30312b;
  --edge-line: #303b43;
  --edge-line-2: #4a5147;
  --edge-ink: #eeeeeb;
  --edge-ink-2: #a2a89a;

  --edge-btn-muted: #24271f;
  --edge-error: #d9695c;
  --edge-success: #8fe3bb;
  --edge-warn: #d8b26a;

  --edge-glow-light: 0.02;
  --edge-glow-dark: 0.05;
  --edge-wm-alpha: 0.05;

  --edge-glass-fill: 22 25 20;
  --edge-glass-alpha: 0.8;
  --edge-glass-blur: 14px;
  --edge-glass-edge: rgb(255 255 255 / 0.12);
  --edge-glass-sheen: rgb(255 255 255 / 0.05);

  --lab-chip: #22261f;
  --lab-hairline: rgba(162, 168, 154, 0.22);
  --lab-hairline-strong: rgba(162, 168, 154, 0.4);
  --lab-depth: 0 20px 48px -32px rgba(0, 0, 0, 0.72);
  --lab-plate: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0) 40%);

  /* 暗色档就是参考的实景：柜面几乎吃光，板面只比柜面亮一档，靠受光顶边站
     起来；标签是唯一持续发亮的暖色小块（参考那面墙上每块板都贴着一枚）。 */
  --lab-cavity: #0b0c0a;
  --lab-cavity-deep: #050604;
  --lab-slab: #171812;
  --lab-slab-lit: rgba(216, 181, 106, 0.3);
  --lab-slab-side: rgba(0, 0, 0, 0.6);
  --lab-slab-shadow: rgba(0, 0, 0, 0.55);
  --lab-tab: #d9b56d;
  --lab-tab-ink: #171812;
  --lab-plaque: #060705;
  --lab-plaque-ink: #efe6cf;
  --lab-dot: rgba(216, 181, 106, 0.12);
  --lab-rail: rgba(162, 168, 154, 0.24);

  /* 参考实景：整面墙吃光，只有被选中的那一列被灯打亮成暖白——不是换成
     阵营色。暗档的亮板因此是奶油纸色，亮档是更白一档的纸；两档里板上的
     字都用深墨，标签翻成黑牌。 */
  --lab-lit-slab: #f0e2bd;
  --lab-lit-ink: #171812;
  --lab-lit-edge: rgba(255, 255, 255, 0.85);
  --lab-lit-glow: rgba(216, 181, 106, 0.5);
}

/* 结构层的派生量同样要跟着改：终端层用 --ak-* 描述网格、点阵与深度，
   这些在陶瓷档里都比明日方舟那套更弱。 */
body.theme-arknights-advanced.theme-arknights-lab {
  --ak-cut: 0px;
  --ak-grid-small: rgba(var(--edge-accent-rgb), 0.035);
  --ak-grid-large: rgba(var(--edge-accent-rgb), 0.06);
  --ak-wash: rgba(85, 88, 77, 0.07);
  --ak-wash-strong: rgba(85, 88, 77, 0.13);
  --ak-hairline: var(--lab-hairline);
  --ak-signal-line: var(--lab-hairline-strong);
  --ak-depth: var(--lab-depth);
  --ak-deck-bg: var(--lab-plate), var(--edge-panel);
}

body.theme-arknights-advanced.theme-arknights-lab[data-ds-dark-theme] {
  --ak-wash: rgba(162, 168, 154, 0.07);
  --ak-wash-strong: rgba(162, 168, 154, 0.13);
  --ak-dot: rgba(162, 168, 154, 0.22);
  --ak-depth: var(--lab-depth);
}

/* 应用自己在 body::before 上铺了一层整页点阵 + 六边形水印（fixed, z-index:4）。
   侧栏整列都在它下面，于是柜面上浮着点阵、水印穿过板面——柜体是实物，不是
   背景纹理。把侧栏抬到那一层之上；其余区域仍然保留应用的底纹。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='sidebar'] {
  z-index: 5;
}

/* ---------------------------------------------------------------------------
 * 2. 几何语言：斜切退回直线，分层交给发丝线
 *
 * advanced 的招牌动作是 clip-path 切角；参考的招牌动作是**没有切角**，只有一
 * 根根把面板分开的细线。这一节把前者关掉、把后者补上，其余结构规则才能读起来
 * 像同一台机器。
 * ------------------------------------------------------------------------- */

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='hero']::before,
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='hero-stack']::before,
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='hero-stack']::after {
  content: none;
}

/* 光晕是一个真实节点，不是伪元素，所以只能收起而不是 content:none。 */
body.theme-arknights-advanced.theme-arknights-lab [class*='_heroGlow'] {
  display: none;
}

/* 扫描光带只在罗德岛阵营那组规则里存在（选择器带两个 :not），所以这里要用
   同样的 :not 把它压掉：权重必须不低于它，写成通用一条会静默失效。 */
body.theme-arknights-advanced.theme-arknights-lab:not(.theme-arknights-laterano):not(.theme-arknights-rhine)::after {
  content: none;
}

/* 氛围层换成等距陶瓷块：一块压在右上、一块压在左下，形状来自遮罩，颜色仍然是
   --edge-accent —— 所以阵营切三套，这块「设备外壳」跟着换三种色，但绝不出现
   明日方舟的圆环、图纸网格或扫描带。 */
body.theme-arknights-advanced.theme-arknights-lab [class*='_frame']::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background-color: var(--edge-accent);
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1800' height='1100'%3E%3Cdefs%3E%3Cpattern id='h' width='64' height='64' patternUnits='userSpaceOnUse'%3E%3Cpath d='M64 0H0V64' fill='none' stroke='%23fff' stroke-width='.4' stroke-opacity='.3'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='1800' height='1100' fill='url(%23h)'/%3E%3Cg fill='%23fff'%3E%3Cg fill-opacity='.5'%3E%3Cpath d='M1420 120 l150 78 v156 l-150 78 -150-78 V198Z' fill-opacity='.07'/%3E%3Cpath d='M1420 150 l120 62 v124 l-120 62 -120-62 V212Z' fill-opacity='0' stroke='%23fff' stroke-opacity='.34' stroke-width='1'/%3E%3C/g%3E%3Cg fill-opacity='.4'%3E%3Cpath d='M300 760 l110 57 v114 l-110 57 -110-57 V817Z' fill-opacity='.055'/%3E%3Cpath d='M300 786 l84 44 v88 l-84 44 -84-44 V830Z' fill-opacity='0' stroke='%23fff' stroke-opacity='.3' stroke-width='1'/%3E%3C/g%3E%3C/g%3E%3Cg stroke='%23fff' stroke-opacity='.3' stroke-width='1' fill='none'%3E%3Cpath d='M0 300H1800M0 300H1800'/%3E%3Cpath d='M1560 0V1100'/%3E%3C/g%3E%3Cg fill='%23fff'%3E%3Crect x='60' y='1024' width='220' height='3' fill-opacity='.34'/%3E%3Crect x='300' y='1024' width='60' height='3' fill-opacity='.2'/%3E%3Crect x='1440' y='72' width='180' height='3' fill-opacity='.3'/%3E%3C/g%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1800' height='1100'%3E%3Cdefs%3E%3Cpattern id='h' width='64' height='64' patternUnits='userSpaceOnUse'%3E%3Cpath d='M64 0H0V64' fill='none' stroke='%23fff' stroke-width='.4' stroke-opacity='.3'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='1800' height='1100' fill='url(%23h)'/%3E%3Cg fill='%23fff'%3E%3Cg fill-opacity='.5'%3E%3Cpath d='M1420 120 l150 78 v156 l-150 78 -150-78 V198Z' fill-opacity='.07'/%3E%3Cpath d='M1420 150 l120 62 v124 l-120 62 -120-62 V212Z' fill-opacity='0' stroke='%23fff' stroke-opacity='.34' stroke-width='1'/%3E%3C/g%3E%3Cg fill-opacity='.4'%3E%3Cpath d='M300 760 l110 57 v114 l-110 57 -110-57 V817Z' fill-opacity='.055'/%3E%3Cpath d='M300 786 l84 44 v88 l-84 44 -84-44 V830Z' fill-opacity='0' stroke='%23fff' stroke-opacity='.3' stroke-width='1'/%3E%3C/g%3E%3C/g%3E%3Cg stroke='%23fff' stroke-opacity='.3' stroke-width='1' fill='none'%3E%3Cpath d='M0 300H1800M0 300H1800'/%3E%3Cpath d='M1560 0V1100'/%3E%3C/g%3E%3Cg fill='%23fff'%3E%3Crect x='60' y='1024' width='220' height='3' fill-opacity='.34'/%3E%3Crect x='300' y='1024' width='60' height='3' fill-opacity='.2'/%3E%3Crect x='1440' y='72' width='180' height='3' fill-opacity='.3'/%3E%3C/g%3E%3C/svg%3E");
  -webkit-mask-size: cover;
  mask-size: cover;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  opacity: 0.5;
  mix-blend-mode: multiply;
}

body.theme-arknights-advanced.theme-arknights-lab[data-ds-dark-theme] [class*='_frame']::before {
  mix-blend-mode: screen;
  opacity: 0.36;
}

/* 页面边缘 HUD：四角括号换成「上沿一条通长的发丝线 + 右缘刻度」，
   这是参考里那种把整屏当成一块面板边缘的画法。 */
body.theme-arknights-advanced.theme-arknights-lab::before {
  background-image:
    linear-gradient(var(--lab-hairline-strong), var(--lab-hairline-strong)),
    linear-gradient(var(--lab-hairline-strong), var(--lab-hairline-strong)),
    repeating-linear-gradient(to bottom, var(--lab-hairline-strong) 0 1px, transparent 1px 16px);
  background-size: 100% 1px, 1px 100%, 3px 100%;
  background-position: 0 44px, right 10px top 0, right 10px top 0;
  background-repeat: no-repeat, no-repeat, repeat-y;
  opacity: 0.5;
}

/* 卡片与弹窗退回直线。 */
body.theme-arknights-advanced.theme-arknights-lab [class*='_card'],
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='composer'],
body.theme-arknights-advanced.theme-arknights-lab .ak-bar {
  clip-path: none;
  border-radius: 0;
}

/* ---------------------------------------------------------------------------
 * 3. 第一级选择：工作区 = 一面档案立面
 *
 * 参考的主界面是一整面**等距文件柜**：一块一块竖立的档案板排满柜面，每块板靠
 * 一条受光的顶边和一道背光的右缘从暗处立起来；板面上部靠左贴一枚暖色小标签，
 * 当前那块被灯整块打亮、往前挪出半步，板上钉一块黑底名牌。柜面本身几乎全黑，
 * 只有灯下的那几块读得出颜色。
 *
 * 侧栏只有 223px，搬不过来的首先是透视。能搬、也只需要搬的是这套读法：
 *   · 柜面（容器）比格子暗，格子是一块一块平板，**不画斜面、不做拉手、不加
 *     纹理** —— 参考里没有这些，上一个版本自己加的三件都在这里退场了；
 *   · 标签是每块板上唯一的暖色小块，钉在板面上部靠左；当前板的标签翻成黑牌，
 *     和参考里那块钉在亮板上的黑牌是同一件东西；
 *   · 名字不写在板面上：板只有 36px 宽。名字归柜面上方正中的那块黑铭牌
 *     （见 3.5），宽度是整行，和参考把名字钉在黑牌上的做法一致。
 *
 * 容器 [data-ak-tui='column-field'] 由 36-terminal-ui.js 从行往上找到「装下
 * 全部行」的那一层：真页面里每个行外面套着一层 per-item wrapper，几行又套着
 * 一层分组，全是 module 哈希，写死等于埋一条永不命中的规则。沿途的 wrapper
 * 必须摊成 display: contents，否则柜体只圈得住第一组——上一个版本的真页面
 * bug 就是把第一组的 wrapper 当成了柜体：第一块板 36px，其余 251px 铺满侧栏。
 *
 * 工作区与当前工作区的会话住在同一棵树里，所以两批格子共用这一个容器：
 * 工作区 order 0、读数带 order 1、会话 order 2，换行由读数带那条 100% 的伪
 * 元素强制完成。
 * ------------------------------------------------------------------------- */

/* ---- 柜面 -------------------------------------------------------------- */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='column-field'] {
  position: relative;
  display: flex;
  /* 换行而不是横滚：柜面排不满就再起一行，比「一排要横向拖动才看完」更像柜子。 */
  flex-flow: row wrap;
  align-content: flex-start;
  justify-content: flex-start;
  gap: 6px 5px;
  /* 底部只留 6px：应用给柜面的高度正好卡住三排板 + 一排方块，14px 的留白
     会多出 7px 滚动量，平白让滚动条常驻。 */
  padding: 8px 8px 6px;
  border: 0;
  border-top: 2px solid var(--lab-rail);
  border-bottom: 1px solid var(--lab-cavity-deep);
  border-radius: 0;
  background-color: var(--lab-cavity);
  /* 参考的柜面地上铺着一层很淡的点阵。二维里它不承担透视，只负责说明「这是一
     块场地而不是一张卡片」，所以压到几乎看不见。 */
  background-image: radial-gradient(circle at 1px 1px, var(--lab-dot) 1px, transparent 1.6px);
  background-size: 14px 14px;
  /* 应用把这一层的高度钉死在侧栏里（flex:1），不会跟着柜面长高；工作区一多，
     最后一块板和会话方块会被 region 的 overflow:hidden 裁掉。柜面自己滚，且
     始终给滚动条留 6px —— 真页面里滚动条默认 17px，一出现就把六列挤成五列。 */
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: var(--lab-rail) transparent;
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='column-field']::-webkit-scrollbar {
  width: 6px;
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='column-field']::-webkit-scrollbar-track {
  background: transparent;
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='column-field']::-webkit-scrollbar-thumb {
  background: var(--lab-rail);
}

/* 行外面的 per-item wrapper、分组、布局槽全部摊平：行成为柜面的直接格位。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='flat'] {
  display: contents;
}

/* 应用在列表末尾还挂着两个空占位（一个零高的 div、一个空 span）。它们不是格子，
   却会各占一个格位、把最后一排顶歪。只收空的直系成员，不碰尚未标好的分组。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='column-field'] > :not([data-ak-tui='flat']):empty {
  display: none;
}

/* 「未分组」折叠头不是工作区，是 34px 高的一条横板，进柜面就会横断整面墙。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='bucket-row'] {
  display: none;
}

/* ---- 会话区的读数带 ----------------------------------------------------
   柜面上两批格子之间的一条 HUD 小字，同时充当强制换行。它是容器自己的伪元素，
   因此本身就是一个 flex 项：没有会话时 data-ak-blocks 缺席，伪元素不生成。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='column-field'][data-ak-blocks]::before {
  content: 'BLOCK ' attr(data-ak-active-block) ' / ' attr(data-ak-blocks);
  order: 1;
  flex: 0 0 100%;
  margin: 8px 0 -2px;
  font-family: var(--ak-mono);
  font-size: 7px;
  line-height: 1;
  letter-spacing: 0.24em;
  color: var(--edge-ink-2);
}

/* 「展开其余 N 个会话」是应用给超长会话列表的折叠按钮。它默认 order:0、
   整行宽，跟着工作区板一起排队，真页面上把墙面切成 6 + 1 + 6，还撑出
   43px 的空行（后面几块板的点击坐标因此整体错位）。柜面里它只能是第二级
   选择末尾的一条窄操作带，不能占第一级的格位。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='column-field'] [data-ak-tui='session-overflow'] {
  order: 3;
  flex: 0 0 100%;
  display: flex;
  align-items: center;
  width: 100%;
  height: 22px;
  margin: 2px 0 0;
  padding: 0 5px;
  box-sizing: border-box;
  border: 0;
  border-left: 2px solid var(--lab-hairline-strong);
  border-radius: 0;
  background: var(--lab-chip);
  color: var(--edge-ink-2);
  font-family: var(--ak-mono);
  font-size: 7px;
  line-height: 1;
  letter-spacing: 0.14em;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='column-field'] [data-ak-tui='session-overflow']:hover {
  background: var(--edge-overlay);
  color: var(--edge-ink);
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='column-field'] [data-ak-tui='session-overflow'][data-ak-foreign='true'] {
  display: none;
}

/* ---- 一块档案板 --------------------------------------------------------
   36px 宽、108px 高：参考里每块板的立面比例也是这个竖长条。定宽而不是
   flex-grow —— 柜面的格宽是死的，排不满右边留空，这样才不像「一组自适应卡片」。
   6×36 + 5×5 的格距是 270px 侧栏里一排六格的算法。
   高度是**上限而不是承诺**：DSH 0.2.1-rc.5 在侧栏里加了「插件 / 自动化任务 /
   更多」三行面板导航（112px），1366×768 下柜面从 221px 掉到 155px，托盘（读数带
   + 一排方块）与 108 的板必然互压——真页面上半块板被托盘吃掉。所以 JS 按柜面
   实际可用高度写 --lab-slab-h，柜面够高时它缺席、仍是参考原尺寸。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='sector-row'] {
  position: relative;
  order: 0;
  flex: 0 0 36px;
  display: block;
  /* 默认 108；柜面不够高时由 JS 按可用高度改写 --lab-slab-h（见下面的托盘注释）。 */
  height: var(--lab-slab-h, 108px);
  /* 进阶版给每行留了 margin: 1px 8px。格距由容器 gap 负责，留着它会把每格撑成
     52px —— 五格放不进 223px 的侧栏，柜面会莫名多出几行。 */
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  clip-path: none;
  background-color: var(--lab-slab);
  background-image: none;
  /* 受光的顶边 + 背光的右缘，参考里每块板就靠这两条线从柜面上立起来。 */
  box-shadow:
    inset 0 1px 0 var(--lab-slab-lit),
    inset -1px 0 0 var(--lab-slab-side),
    0 3px 4px -2px var(--lab-slab-shadow);
  overflow: hidden;
}

/* 板面只放得下编号：图标、箭头、徽标、操作键、工作区名一律收起（名字归铭牌）。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='sector-row'] > :not(.ak-sector-code) {
  display: none;
}

/* 标签：参考每块板上部都贴一枚暖色小块，编号写在上面。它不是一个装饰伪元素：
   编号是一个真实 span（行内原本就有它自己的位置），卸载时一并收回。
   两处 !important 都不是风格：通用令牌层有两条「整行选中 / 整行悬停时把后代
   全刷成 #000」的兜底（theme.css 的 _projectRow:hover * 与暗色档的
   [class*='selected'] *:not(svg)），编号躲不掉——不写就是黑牌黑字。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='sector-row'] .ak-sector-code {
  position: absolute;
  left: 6px;
  /* 板被柜面压矮时标签跟着上移，但不爬到板顶以外。 */
  top: max(5px, calc(var(--lab-slab-h, 108px) * 0.11));
  display: flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 19px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: var(--lab-tab);
  color: var(--lab-tab-ink) !important;
  font-family: var(--ak-mono);
  font-size: 8.5px;
  line-height: 1;
  letter-spacing: 0;
  text-align: center;
  opacity: 1;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* ---- 铭牌 --------------------------------------------------------------
   参考把当前档案的名字钉在一块黑底小牌上。36px 的板面放不下名字，所以这块牌
   钉在抬头里、柜面正上方，宽度是整行；它是抬头自己的节点（不是伪元素），空名
   时由 :empty 收掉，不会在柜面上留一条黑杠。
   铭牌同时是「暗面」：黑底暖白字，和亮板的配色反过来，正好是参考里那块钉在
   亮板上的黑牌。 */
body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-sector-head__plate {
  display: flex;
  align-items: center;
  min-height: 19px;
  margin-top: 5px;
  padding: 3px 6px 2px 5px;
  border-left: 3px solid var(--edge-accent);
  background: var(--lab-plaque);
  color: var(--lab-plaque-ink);
  font-family: var(--ak-mono);
  font-size: 9px;
  line-height: 1.2;
  letter-spacing: 0.06em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-sector-head__plate:empty {
  display: none;
}

/* 柜面矮的时候，所有东西都排在墙后，空目录点开就只剩一面空墙。空态挂在
   抬头里（铭牌下面），不受柜面滚动影响：点开就知道这一格真的没有会话。 */
body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-sector-head[data-ak-empty='true']::after {
  content: 'NO RECORDS // 该目录暂无会话';
  display: block;
  margin-top: 4px;
  padding: 3px 5px 2px;
  border-left: 2px solid var(--lab-hairline-strong);
  background: var(--lab-chip);
  color: var(--edge-ink-2);
  font-family: var(--ak-mono);
  font-size: 7.5px;
  line-height: 1.3;
  letter-spacing: 0.08em;
}

/* 悬停 = 手搭上板沿。!important 是因为通用令牌层给悬停的工作区行刷了一层
   半透明强调色洗色（theme.css 的 _projectRow:hover），洗色会让板面透出柜面。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='sector-row']:hover {
  background-color: var(--edge-overlay) !important;
}

/* 当前板：整块被灯打亮、往前挪出半步，顶边压一道白光；编号翻成黑牌。
   亮的是纸，不是强调色——参考里被选中的那一列只是照得更亮，柜体没有因此
   换一种颜色。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='sector-row'][data-ak-active='true'] {
  z-index: 1;
  transform: translateY(-3px);
  /* 暗色档里 theme.css 用「background: 强调色 !important」画选中行，简写把
     background-image 一起钉成 none —— 不写 !important 的话板面上那道受光渐变
     不会出现（会话方块那一条同理，两处是一对）。 */
  background-color: var(--lab-lit-slab) !important;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.35), rgba(0, 0, 0, 0.06)) !important;
  box-shadow:
    inset 0 2px 0 var(--lab-lit-edge),
    inset -1px 0 0 rgba(90, 76, 44, 0.28),
    0 12px 22px -10px var(--lab-lit-glow),
    0 0 0 1px rgba(90, 76, 44, 0.18);
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='sector-row'][data-ak-active='true'] .ak-sector-code {
  background: var(--lab-plaque);
  /* 也要 !important：上面那条基础规则的字色已经是 !important 了，两边都带权时
     才轮到具体性说话，漏写这一个是黑牌黑字。 */
  color: var(--lab-plaque-ink) !important;
  opacity: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}

/* 进阶版在当前板右上角画一枚 L 形角标。莱茵柜面用奶油亮板 + 黑牌表示选中，
   角标叠上去就是每块板都多一只角；lab 档不画它。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='sector-row'][data-ak-active='true']::after {
  content: none;
}

/* 悬停铭牌：36px 的板面写不下工作区名，名字跟随指针出现在板子旁边。
   固定定位挂在 body 上，不归柜面的滚动容器裁切。 */
.ak-sector-tip {
  position: fixed;
  z-index: 40;
  max-width: 210px;
  padding: 3px 6px 2px;
  border-left: 2px solid var(--edge-accent);
  background: var(--lab-plaque);
  color: var(--lab-plaque-ink);
  font-family: var(--ak-mono);
  font-size: 8.5px;
  line-height: 1.3;
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.42);
}

.ak-sector-tip[hidden] {
  display: none;
}

/* 抬头里那一排小计数在 lab 档退场：大读数已经写了「共几列」，同一只计数器
   不该在同一块面板上出现两次。 */
body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-sector-head__top [data-ak-part='count'] {
  display: none;
}

/* ---- 抬头的大读数：器材计数器 ------------------------------------------ */
body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-sector-head__readout {
  align-items: flex-end;
  /* 侧栏只有 223px，30px 的大数字加键位芯片放不下。让芯片自己掉到第二行，
     而不是把它的字裁成「← → 换」。 */
  flex-wrap: wrap;
  gap: 4px 0;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--lab-hairline);
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-sector-head__roLabel {
  margin-right: 7px;
  padding-bottom: 3px;
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-sector-head__roActive {
  font-size: 30px;
  font-weight: 500;
  line-height: 0.82;
  letter-spacing: -0.01em;
  color: var(--edge-ink);
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-sector-head__roSlash {
  margin: 0 3px 2px;
  font-size: 11px;
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-sector-head__roTotal {
  padding-bottom: 1px;
  font-size: 13px;
  color: var(--edge-ink-2);
}

/* 键位提示在参考里是一枚芯片，不是一句裸字。 */
body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-sector-head__keys {
  /* flex 项默认会先压缩再换行：不钉住宽度的话这枚芯片会被挤成「← → 换」，
     换行规则等于没写。 */
  flex: 0 0 auto;
  white-space: nowrap;
  margin-left: auto;
  padding: 2px 5px;
  border: 1px solid var(--lab-hairline);
  background: var(--lab-chip);
  color: var(--edge-ink-2);
  font-size: 6.5px;
  letter-spacing: 0.16em;
  opacity: 1;
}

/* ---------------------------------------------------------------------------
 * 4. 第二级选择：会话 = 柜下半截的短档案板
 *
 * 第一级选「哪一块板」，第二级选「这块板里有什么」。DSH 的会话行就是这一批
 * 条目，把它们按同一套读法画成短板：同一块板面、同一条受光顶边、同一枚暖色
 * 编号标签，当前那块整块打亮、标签翻成黑牌。两批格子共用 3 节的柜面，靠
 * order 分开：读数带（3 节）在中间强制换行。
 *
 * 板宽定死 86px：两格正好排满 fixture 的 208px 轨道，在真页面那条更窄的
 * （约 187px）上留出十来个像素的余量。
 * ------------------------------------------------------------------------- */

/* 只画当前目录那一组。应用允许同时展开多个目录，但柜面上只应该有一套轨道；
   其余组的会话行留在 DOM 里（应用还要用），只是不占柜面的格位。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='column-field'] [class*='_sessionRow']:not([data-ak-block]) {
  display: none;
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-block] {
  position: relative;
  order: 2;
  flex: 0 0 86px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  margin: 0;
  /* 托盘是 sticky 的，高度必须是确定的：内容撑高会让托盘底（读数带）盖不住
     方块。矮柜面下 JS 写 --lab-block-h 把它压下来。 */
  height: var(--lab-block-h, 74px);
  padding: max(14px, calc(var(--lab-block-h, 74px) * 0.3)) 7px 6px;
  border: 0;
  border-radius: 0;
  clip-path: none;
  background-color: var(--lab-slab);
  background-image: none;
  box-shadow:
    inset 0 1px 0 var(--lab-slab-lit),
    inset -1px 0 0 var(--lab-slab-side),
    0 3px 4px -2px var(--lab-slab-shadow);
  overflow: hidden;
  text-align: left;
}

/* 标签：块号写在板面左上角那枚暖色小块上，和第一级同一套读法。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-block]::after {
  content: attr(data-ak-block);
  position: absolute;
  left: 5px;
  top: 5px;
  min-width: 16px;
  height: 15px;
  padding: 2px 4px 0;
  box-sizing: border-box;
  background: var(--lab-tab);
  color: var(--lab-tab-ink) !important;
  font-family: var(--ak-mono);
  font-size: 8px;
  line-height: 1;
  letter-spacing: 0;
  text-align: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-block] [class*='_title'] {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  width: 100%;
  margin: 0;
  flex: 0 0 auto;
  color: var(--edge-ink);
  font-size: 11.5px;
  line-height: 1.32;
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-block] [class*='_itemDesc'] {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: 9px;
  line-height: 1.35;
  color: var(--edge-ink-2);
  opacity: 0.85;
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-block] [class*='_actionRow'],
body.theme-arknights-advanced.theme-arknights-lab [data-ak-block] [class*='_chevron'],
body.theme-arknights-advanced.theme-arknights-lab [data-ak-block] [class*='_icon'],
body.theme-arknights-advanced.theme-arknights-lab [data-ak-block] [class*='_slot'],
body.theme-arknights-advanced.theme-arknights-lab [data-ak-block] button {
  display: none;
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-block]:hover {
  /* 同上：会话行的悬停洗色也是 !important 的半透明层。 */
  background-color: var(--edge-overlay) !important;
}

/* 应用给会话行挂的悬停预览卡固定挂在 body 上（z-index 100），在真页面里会
   落到侧栏左上角，把抬头和「新会话」整块盖住。lab 的方块已经写着标题和描述；
   而且点开第二排板时托盘正好出现在指针下方，这张卡会立刻自己弹出来。 */
body.theme-arknights-advanced.theme-arknights-lab [class*='_card']:has(> [class*='_hoverContent']) {
  display: none !important;
}

/* 当前板：和第一级同一盏灯——纸面照白、微移，标签翻成黑牌。
   data-ak-active 是 JS 统一算出来的选中态，原生两个选择器留作扫描前的兜底。
   这里的 !important 不是风格问题：进阶版用「background: 渐变 !important」画
   选中行的洗色（faction.css 的 _sessionRow 那条），简写连 background-color
   一起钉成 transparent；文字也要显式压回深墨——亮纸上的字不分明暗档，而原生
   选中行给后代刷的是另一套颜色。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-block][data-ak-active='true'],
body.theme-arknights-advanced.theme-arknights-lab [class*='_sessionRow'][class*='_selected'],
body.theme-arknights-advanced.theme-arknights-lab [class*='_sessionRow'][aria-selected='true'] {
  z-index: 1;
  transform: translateY(-3px);
  background-color: var(--lab-lit-slab) !important;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.35), rgba(0, 0, 0, 0.06)) !important;
  color: var(--lab-lit-ink) !important;
  box-shadow:
    inset 0 2px 0 var(--lab-lit-edge),
    inset -1px 0 0 rgba(90, 76, 44, 0.28),
    0 12px 22px -10px var(--lab-lit-glow),
    0 0 0 1px rgba(90, 76, 44, 0.18) !important;
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-block][data-ak-active='true'] [class*='_title'],
body.theme-arknights-advanced.theme-arknights-lab [data-ak-block][data-ak-active='true'] [class*='_itemDesc'] {
  color: var(--lab-lit-ink) !important;
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-block][data-ak-active='true']::after {
  background: var(--lab-plaque);
  /* 基础规则的字色带 !important（暗档标签是深色字），这里不跟一枚 !important
     就是黑牌黑字——真页面上「01」曾经因此整块看不见。 */
  color: var(--lab-plaque-ink) !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}

/* ---- 会话托盘 ----------------------------------------------------------
   柜面不够高时（0.2.1-rc.5 起，1366×768 只剩 155px），会话区排在整面墙后面，
   点开也看不见。一行方块可以钉在柜面下沿：读数带加高成整条托盘底，方块坐在
   上面，当前板滚到托盘上方；多行方块不钉（每行都会贴同一个底边，叠成一摞），
   由 JS 改成滚动。托盘只由 [data-ak-tray='true'] 打开，平时柜面还是完整的墙面。
   托盘、方块、板三个尺寸都读 CSS 变量：柜面矮到装不下「108 的板 + 88 的托盘」
   时，由 JS 按可用高度一起算，保证板不会被托盘吃掉半块。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='column-field'][data-ak-tray='true'] [data-ak-block] {
  position: sticky;
  bottom: 0;
  z-index: 4;
  box-shadow:
    inset 0 1px 0 var(--lab-slab-lit),
    inset -1px 0 0 var(--lab-slab-side),
    0 -8px 16px rgba(0, 0, 0, 0.45);
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='column-field'][data-ak-tray='true']::before {
  position: sticky;
  bottom: 0;
  z-index: 3;
  height: var(--lab-tray-h, 88px);
  margin: 0;
  padding: 6px 0 0;
  box-sizing: border-box;
  background: var(--lab-cavity);
  box-shadow:
    0 -1px 0 var(--lab-hairline),
    0 -10px 24px rgba(0, 0, 0, 0.4);
}

/* 「新会话」在参考里对应的是实心按钮块，而不是带箭头的终端指令。
   它住在分区抬头里，不在柜面上，所以 lab 只改材质，不参与格位排序。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='new-session']::after {
  content: none;
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='new-session'] {
  flex: 0 0 auto;
  clip-path: none;
  border: 1px solid var(--edge-accent);
  border-radius: 0;
  background: var(--edge-accent);
  color: var(--edge-paper);
  letter-spacing: 0.1em;
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='new-session']:hover {
  background: var(--edge-accent-deep);
  border-color: var(--edge-accent-deep);
  color: var(--edge-paper);
}

/* ---------------------------------------------------------------------------
 * 5. 侧栏铭牌：从 HUD 面板改成器材标签
 *
 * advanced 的铭牌是「PRTS 终端牌」：斜切、扇区大字、信号格。同一批 DOM 在
 * 这里读起来像参考里的分区标签：顶部一行拉丁小字 + 一根发丝线，扇区号收成
 * 右侧值块，信号格换成一条刻度尺。字面内容（RHINE / TRACK、SELECT）由
 * 36-terminal-ui.js 的词表负责，本层只管形状。
 * ------------------------------------------------------------------------- */

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-deck {
  /* 侧栏在档案立面之后会长到溢出，铭牌不能被 flex 压缩——它一被压，
     底行的频道号与刻度尺就直接消失。 */
  flex: 0 0 auto;
  clip-path: none;
  border: 1px solid var(--lab-hairline);
  border-left: 3px solid var(--edge-accent);
  border-radius: 0;
  background: var(--lab-plate), var(--edge-panel);
  box-shadow: none;
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-deck::before,
body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-deck::after {
  content: none;
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-deck__top {
  border-bottom: 1px solid var(--lab-hairline);
}

/* 扇区号：左大字换成右侧对齐的值块 —— 参考的编号从不占版面中心。重排只靠
   order，不动 DOM：__main 本来就是 flex，所以三块的新顺序是「名称 … 标签 编号」。 */
body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-deck__sector {
  order: 3;
  flex: 0 0 auto;
  min-width: 42px;
  padding: 3px 7px;
  border: 1px solid var(--lab-hairline-strong);
  background: var(--lab-chip);
  color: var(--edge-ink);
  font-family: var(--ak-mono);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: 0.08em;
  text-align: right;
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-deck__sectorLabel {
  order: 2;
  margin-left: auto;
  padding-left: 0;
  border-left: 0;
  font-size: 7px;
  letter-spacing: 0.2em;
  text-align: right;
  color: var(--edge-ink-2);
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-deck__ident {
  order: 1;
  margin-left: 0;
  text-align: left;
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-deck__en {
  letter-spacing: var(--edge-tracking-display);
  color: var(--edge-ink);
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-deck__status i,
body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-sector-head__live i {
  border-radius: 0;
  background: var(--edge-accent);
}

/* 信号格：四根柱状条换成一段一段的刻度尺 —— 同一份信息，器材的说法。 */
body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-deck__signal i {
  width: 3px;
  height: 7px !important;
  opacity: 0.5 !important;
  background: var(--lab-hairline-strong);
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-deck__signal i:last-child {
  background: var(--edge-accent);
  opacity: 1 !important;
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-deck__bottom {
  border-top: 1px solid var(--lab-hairline);
}

/* 频道号靠右：值块与侧栏编号同一形状。 */
body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-deck__freq {
  margin-left: auto;
  padding: 2px 6px;
  border: 1px solid var(--lab-hairline);
  background: var(--lab-chip);
  color: var(--edge-ink-2);
}

/* ---- 分区抬头 ---------------------------------------------------------- */
body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-sector-head {
  clip-path: none;
  border: 1px solid var(--lab-hairline);
  border-left: 3px solid var(--edge-accent);
  border-radius: 0;
  /* 进阶版的抬头只有左内边距：它的文字都是整行块。lab 里键位芯片要贴右站，
     没有右内边距就会压在边框上。 */
  padding-right: 6px;
  background: var(--edge-panel);
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-sector-head__top {
  border-bottom: 1px solid var(--lab-hairline);
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='section-header'] {
  border-bottom: 1px solid var(--lab-hairline);
}

/* ---------------------------------------------------------------------------
 * 6. 空状态：标题两行制 + 工作位置面板
 *
 * 参考的每一个抬头都是「大写拉丁一行 + 中文一行」，且中文行更小、更淡。
 * advanced 已经有这个骨架（hero-stack / deploy-row），这里只把它的军事味
 * 换成器材味：去掉外框四角括号与幽灵扇区号，把面板改成一格一格的陶瓷块。
 * ------------------------------------------------------------------------- */

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='hero-stack']::after,
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='deploy-row']::after,
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='workspace']::after,
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='header'][data-ak-blank='true']::before,
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='header'][data-ak-blank='true']::after,
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='composer']::after {
  content: none;
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='header'][data-ak-blank='true'] {
  border-bottom: 1px solid var(--lab-hairline);
}

/* 空状态抬头：左侧一条 3px 的硬件色竖带，是参考里给「当前面板」记名的方式。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='deploy-row'] {
  clip-path: none;
  border: 1px solid var(--lab-hairline);
  border-left: 3px solid var(--edge-accent);
  border-radius: 0;
  background: var(--edge-panel);
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='deploy-row']::before {
  content: 'WORKSPACE // TERMINAL LIBRARY';
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='workspace'],
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='mode'] {
  clip-path: none;
  border-radius: 0;
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='workspace'][data-ak-active='true'] {
  background: var(--edge-accent);
  color: var(--edge-paper);
}

/* ---------------------------------------------------------------------------
 * 7. 输入区：transport 条 + 全局唯一的圆盘
 *
 * 参考的输入/播放条是一根横通的板：上方一条发丝线、左侧编号、右侧一枚圆形
 * 播放盘。DSH 的 composer 就是它对应的那块，所以这一节把 advanced 的
 * 「任务简报通道」换成「播放条」，并把整个界面唯一的圆形留给发送按钮。
 * ------------------------------------------------------------------------- */

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='composer'] {
  border: 1px solid var(--lab-hairline-strong) !important;
  border-top: 2px solid var(--edge-accent);
  border-radius: 0 !important;
  background-color: var(--edge-overlay) !important;
  background-image: var(--lab-plate) !important;
  box-shadow: var(--lab-depth);
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='composer']:focus-within {
  border-color: var(--edge-accent) !important;
  box-shadow: var(--lab-depth), inset 0 0 0 1px rgba(var(--edge-accent-rgb), 0.14);
}

/* 发送盘：参考里唯一允许自己不是直角的那个元素。用 !important 是因为应用的
   圆角写在行内样式上；形状是本档的承诺，不该被上游的一行 style 改掉。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='composer'] button[class*='_primary'] {
  border-radius: 50% !important;
  background: var(--edge-accent) !important;
  color: var(--edge-paper) !important;
  box-shadow: inset 0 0 0 1px rgba(var(--edge-accent-rgb), 0.4);
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='composer'] button[class*='_primary']:hover:not(:disabled) {
  background: var(--edge-accent-deep) !important;
  color: var(--edge-paper) !important;
}

/* 「+」附件键保持直角，并且只描边——圆盘只有一个，这是参考的硬规则。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='composer'] [class*='_add'] {
  border-radius: 0 !important;
  border: 1px solid var(--lab-hairline-strong);
  background: var(--lab-chip);
}

/* 输入条左上角的标注：advanced 写的是「任务简报通道」，这一档写它是谁的设备。
   直接改写同一条 ::before 的 content，而不是关掉再另造一个 —— 两处标签会打架。 */
body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='composer']::before {
  left: 10px;
  top: 5px;
  font-size: 6px;
  letter-spacing: 0.24em;
  color: var(--edge-ink-2);
  opacity: 0.8;
  content: 'RHINE TERMINAL // INPUT';
}

/* ---------------------------------------------------------------------------
 * 8. 页脚与悬浮条：POWERED BY RHINE LAB
 *
 * advanced 的页脚是一条作战记录带。参考的页脚是一行硬件署名。同一位置、同一
 * 尺寸，把措辞换掉、把 sector 徽章换成右对齐值块即可。
 * ------------------------------------------------------------------------- */

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-footer {
  gap: 9px;
  opacity: 0.62;
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-footer [data-ak-part='footChannel']::after {
  content: ' · POWERED BY RHINE LAB';
  letter-spacing: 0.24em;
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-footer__sector {
  border: 1px solid var(--lab-hairline);
  background: var(--lab-chip);
  color: var(--edge-ink-2);
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-footer__rule {
  background: linear-gradient(90deg, transparent, var(--lab-hairline-strong));
}

body.theme-arknights-advanced.theme-arknights-lab .ak-terminal-footer__rule:last-child {
  background: linear-gradient(90deg, var(--lab-hairline-strong), transparent);
}

/* 悬浮阵营条：与参考的面板一致 —— 直边、发丝线、右对齐值块，去掉切角。 */
body.theme-arknights-advanced.theme-arknights-lab .ak-bar {
  border-left-width: 3px;
  box-shadow: var(--lab-depth);
}

body.theme-arknights-advanced.theme-arknights-lab .ak-bar__item[aria-pressed='true'] {
  border-radius: 0;
}

/* ---------------------------------------------------------------------------
 * 9. 侧栏底部栏：把应用自己的按钮排开
 *
 * DSH 0.2.1-rc.5 在侧栏底部多了一行「更多」（settingsArea），而 session-manager
 * 那条「会话与工作区」仍写着 flex-basis:100%，于是它换到第二行、正好和「更多」
 * 叠在同一行上（x=8..272 对 x=10..270，y 都是 726）——把主题样式表整个禁掉也
 * 一样叠，是应用自己的账。柜面已经因为侧栏新加的三行面板导航少了 66px，不能再
 * 靠把底部栏撑高来避让；让它按内容宽排回第一行（「插件市场」右边还剩 144px）
 * 就互不侵犯。类名走 localName 匹配，不写 hHd-Xa_ 这种构建前缀。
 * ------------------------------------------------------------------------- */

body.theme-arknights-advanced.theme-arknights-lab [class*='_footerActions'] .sm-footerBtn {
  flex: 0 1 auto;
  width: auto;
}

/* ---------------------------------------------------------------------------
 * 10. 工作区菜单：部署控制面板 → 库面板
 * ------------------------------------------------------------------------- */

body.theme-arknights-advanced.theme-arknights-lab .ak-deploy-menu__head {
  clip-path: none;
  border: 1px solid var(--lab-hairline);
  border-left: 3px solid var(--edge-accent);
  border-radius: 0;
  background: var(--edge-panel);
}

body.theme-arknights-advanced.theme-arknights-lab .ak-deploy-menu [role='menuitem'] {
  border-radius: 0;
  clip-path: none;
}

body.theme-arknights-advanced.theme-arknights-lab .ak-deploy-menu [role='menuitem'][data-ak-active='true'] {
  background: var(--edge-accent);
  color: var(--edge-paper);
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='menu-item']::before {
  letter-spacing: 0.12em;
}

/* ---------------------------------------------------------------------------
 * 11. 品牌文案：加载屏的两行大字跟随档位
 *
 * 阵营决定署名的身份，档位决定它说什么话。lab 之下加载屏念的是这台设备的
 * 名字（RHINE / TERMINAL），三套阵营共用；boot 序列的副行同理。选择器带上
 * .theme-arknights-lab 之后与 faction.css 的同名规则权重相同、来源更晚，
 * 所以只需要这一段，不必把三套阵营各写一遍。
 * ------------------------------------------------------------------------- */

body.theme-arknights-advanced.theme-arknights-lab [data-ak-loader-word1]::before {
  content: 'RHINE';
}

body.theme-arknights-advanced.theme-arknights-lab [data-ak-loader-word2]::before {
  content: 'TERMINAL';
}

/* ---------------------------------------------------------------------------
 * 12. 窄屏
 *
 * 本层没有常驻动画（扫描带与辉光都关掉了），柜体也已经是换行的：档案板排满
 * 一行再起一行，窄侧栏不会把它们压成横滚。板的尺寸是死格宽，当前格的上浮是
 * transform，不参与布局，所以窄屏下没有要退回的几何，只剩一件事——5 格一排
 * 放不下时让格距吃掉余量，而不是让格子被压窄。
 * ------------------------------------------------------------------------- */

@media (max-width: 1100px) {
  body.theme-arknights-advanced.theme-arknights-lab [data-ak-tui='column-field'] {
    gap: 6px 4px;
  }
}
    `)
      syncRadiusMode()
      syncGlass()
      syncFactionClass()
      syncLayoutClass()
      syncFactionBar()
      /* 终端铭牌与作战位置标记：DOM 还没渲染时是一次空操作，随后的
         MutationObserver 会在应用挂载侧栏/输入区时补画。 */
      syncTerminalUI()
    }
    const unmount = () => {
      if (!mounted) return
      mounted = false
      disposeToken()
      disposeStyles()
      disposeToken = () => {}
      disposeStyles = () => {}
      // Guarded like every other body touch: an unload race must not throw here.
      if (typeof document !== 'undefined' && document.body !== null) {
        document.body.classList.remove('theme-arknights-round')
        /* 阵营与界面版本的 class 必须跟定义它们的样式表一起走：留下一个没有
           任何规则解释的 class，会让 isFaction() 报告一个页面已不再使用的阵营。
           存储里的偏好不动，所以重新启用会恢复。 */
        for (const id of FACTION_IDS) {
          const cls = FACTION_CLASS[id]
          if (cls !== '') document.body.classList.remove(cls)
        }
        document.body.classList.remove(THEMED_CLASS)
        document.body.classList.remove(LAYOUT_ADVANCED_CLASS)
        document.body.classList.remove(LAYOUT_LAB_CLASS)
        document.body.removeAttribute?.('data-ak-glass')
      }
      destroyFactionBar()
      /* 终端层注入的铭牌、扇区编号与菜单抬头都不带主题样式表的兜底：
         先收回它们，再拆样式表。 */
      destroyTerminalUI()
      // The plate is styled by the theme stylesheet just torn down — an orphaned
      // plate would sit there as an unstyled black-less div, so drop it too.
      destroyLoader()
      /* The output-scroll animator holds a transform on the transcript column. The
         theme does not style that column, so an orphaned offset would survive as a
         permanently shifted transcript — the one thing here that must be released
         even though it is invisible to the stylesheet. */
      destroyScrollAnim()
      /* The announcement plate is styled entirely by that stylesheet too, so an
         in-flight word would become an unstyled, un-positioned block of text in the
         document flow. Stop watching as well: with the theme off there is nothing to
         announce into. */
      thunderStopWatch()
      destroyThunder()
      /* The watermark must go with the stylesheet too, and it cannot wait for
         syncWatermarkVisibility(): with the sheet torn down its
         `opacity: var(--edge-wm-alpha)` computes invalid and falls back to 1,
         so an orphaned mark sits on the page as a fully opaque 9.5vw ARKNIGHTS.
         This path also runs when the switch is turned off from ANOTHER window
         (reconcileFromPrefs -> unmount), where nothing else removes the node —
         the local toggle path only looked covered because toggleTheme happened
         to call syncWatermarkVisibility() itself. */
      if (watermarkRaf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(watermarkRaf)
      watermarkRaf = null
      if (watermarkEl !== null && watermarkEl.parentNode) watermarkEl.parentNode.removeChild(watermarkEl)
      watermarkEl = null
      watermarkHost = null
      // The attention poll belongs to the themed, audio-enabled page; leaving it
      // running would keep reporting confirmations for a theme that is off.
      stopAudioAttentionWatch()
      // Same for the balance capsule: its poll and its node both live inside the
      // themed page, and its styles were just torn down with the sheet above.
      destroyBalanceCapsule()
    }

    if (isEnabled()) {
      mount()
      syncWatermarkVisibility()
      // Output-scroll animation: a no-op until the app renders a conversation
      // scrollport. The same observer retries it as the app mounts one, so opening
      // a session later needs no reload.
      syncScrollAnim()
      // Boot animation: only on a real page load, only when switched on, and only
      // after the stylesheet above exists (mount() inserted it).
      if (isLoaderOn()) runLoader()
      // Task announcements: subscribes only while switched on, and the first value
      // it reads is a baseline, so enabling mid-turn stays silent.
      syncThunder()
      // 需要你回应: starts only while the theme and the audio feature are both on.
      syncAudioAttentionWatch()
      // 顶部余额胶囊: mounts only while its own switch is on, and polls the
      // host-side balance route only while mounted.
      syncBalanceCapsule()
    }

    /* Live preference reconciler. The namespace scope subscription in the store
       block near the top of apply() calls this every time an authoritative
       section change lands (our own committed writes echo back, another window /
       device edits the same profile's settings document
       (<profile>/cordis.patch.yml on 0.1.7, <dshHome>/settings.yaml before it),
       or the host reverts a value). It mirrors the initial mount block above so a
       runtime change re-paints exactly the live surfaces it can: the master switch mounts/unmounts
       the token + stylesheet layers, then radius/palette/watermark/
       thunder re-derive from the new value. The boot loader is deliberately not
       replayed here: it is a once-per-page-load plate, so a mid-session section
       change must not slam a startup animation over a running app. The one thing
       that DOES start it outside apply() is the first authoritative settle
       (onPrefsSettled) — that is the same page-load moment, not a later edit — plus
       the plate's own toggle and 预览 button. Every layer entry point is idempotent
       (mount() and unmount() guard on `mounted`, syncScrollAnim is a no-op until the
       app renders a conversation scrollport), so repeated echoes are cheap and safe. */
    reconcileFromPrefs = () => {
      const enabledNext = isEnabled()
      const enabledNow = mounted
      if (enabledNext && !enabledNow) mount()
      else if (!enabledNext && enabledNow) unmount()
      if (enabledNext) {
        // These sync helpers read the store on each call, so no snapshot passing.
        syncRadiusMode()
        syncGlass()
        syncFactionClass()
        syncLayoutClass()
        syncFactionBar()
        syncTerminalUI()
        syncWatermarkVisibility()
        syncScrollAnim()
        syncThunder()
        // Same reason: it re-reads both switches and starts or stops the poll.
        syncAudioAttentionWatch()
        // Same reason: it re-reads its switch and mounts or removes the capsule.
        syncBalanceCapsule()
      } else {
        // Switched off mid-session: the watcher must not keep polling a page the
        // theme no longer owns.
        stopAudioAttentionWatch()
        // And the capsule must not keep polling the balance route on an unthemed
        // page — destroyBalanceCapsule also clears its interval.
        destroyBalanceCapsule()
        // 悬浮阵营条同理：关掉主题后它既没有样式也没有意义。
        destroyFactionBar()
        // 终端层也随样式表一起走；标记与注入节点都不能留在原生页面上。
        destroyTerminalUI()
      }
    }

    /* ---------- Settings page copy: zh / en dictionaries ----------
       The panel followed DSH's language setting for nothing before this: every
       label was a hardcoded Chinese literal, so an English UI showed a wholly
       Chinese settings page.

       The texts go through the app's own `locale` service (@deepseek-ai/dsh-client-
       locale) rather than a private language guess: it already owns the user's
       preference, its own durable storage and the re-render channel, and reading
       navigator.language here would drift from the setting the user actually chose.

       zh is the source of truth for the key set (this repo's convention) and en is
       kept complete against it — a key present in one and missing in the other would
       silently fall back to the raw key string in the UI, which is why the test suite
       compares the two key sets rather than trusting review.

       Naming: keys are grouped by row (`theme*`, `palette*`, `thunder*`) so a row's
       copy stays discoverable next to its switch. */
    const ARK_NS = 'settings.theme-arknights'
    const LOCALE_ZH = {
      nav: '明日方舟阵营主题',
      /* The separator between a row label and its value. It is a DICTIONARY KEY, not
         a literal: Chinese uses the full-width '：' with no trailing space, English
         the ASCII ': '. Hardcoding the full-width form (as the first version did) put
         a Chinese colon into every English row — subtle, but exactly the kind of
         thing that makes a localized page feel machine-translated. */
      sep: '：',
      on: '开启',
      off: '关闭',
      groupTheme: '主题',
      groupBg: '背景',
      groupAnim: '动画',
      groupFun: '娱乐',
      /* 折叠分组：组头是「编号 名称」加一个随展开态翻转的箭头；
         展开后的「收起」提示放在箭头的 title 上而非行内，收起的
         五个组头并排时行内文案会重复五次。 */
      themeRow: '明日方舟阵营主题',
      themeOn: '开启主题',
      themeOff: '关闭主题',
      factionRow: '阵营',
      factionHint: '三套皮肤共用同一份版式，只换纸面、墨色与强调色',
      faction_name_rhodes: '罗德岛',
      faction_name_laterano: '拉特兰',
      faction_name_rhine: '莱茵生命',
      layoutRow: '界面版本',
      layout_universal: '通用适配',
      layout_advanced: '进阶版',
      layout_lab: '莱茵终端版',
      layoutHint_universal: '只换配色与字体细节，界面骨架与应用原生一致',
      layoutHint_advanced: '重排整体 UI：HUD 侧栏、切角、扫描装饰与四角括号',
      /* lab 是 advanced 之上再叠的一层，不是它的替代品，所以 hint 要说清「先有
         进阶版，再多什么」，否则用户会以为三档是三种互斥的重排方式。 */
      layoutHint_lab: '在进阶版之上再叠一层陶瓷材质：暖白纸面、条纹行、右对齐数值、圆形发送盘与 transport 式输入条',
      radiusRow: '主题圆角',
      radiusRound: '圆角',
      radiusSquare: '直角',
      radiusToRound: '切换圆角',
      radiusToSquare: '切换直角',
      glassRow: '磨砂玻璃', glassHint: '停靠面板使用局部模糊；输入框使用同色底但不模糊，避免气泡抖动',
      glassOff: '关闭', glassSubtle: '轻度', glassStandard: '标准', glassStrong: '浓厚',
      /* 输出滚动动画. The hint has to name the MECHANISM, because the observable
         effect ("smoother scrolling") is easy to mistake for scroll-behavior:smooth
         — which is the one thing this feature must not be, since it would break the
         app's own follow state machine (see 23-scroll-anim.js). */
      scrollAnimRow: '输出滚动动画',
      scrollAnimOn: '开启动画',
      scrollAnimOff: '关闭动画',
      scrollAnimHintOn: '模型输出时把「整段跳一大格」摊成逐帧滑动；不改动应用自己的滚动位置，因此跟随不会中断',
      scrollAnimHintOff: '默认开启；关闭后输出回到原生的一格一格硬滚动',
      scrollAnimHintReduced: '系统已开启「减少动态效果」，当前保持原生滚动',
      scrollAnimLevelRow: '动画强度',
      scrollAnimLevelSoft: '柔和',
      scrollAnimLevelStandard: '标准',
      scrollAnimLevelSnappy: '轻快',
      scrollAnimLevelHint: '越柔和越顺滑，但最新一行离底部越远；越轻快越跟手',
      scrollAnimNeedOn: '请先开启输出滚动动画',
      watermarkRow: '背景水印',
      watermarkOn: '开启水印',
      watermarkOff: '关闭水印',
      wmPersistRow: '水印保持显示',
      wmPersistOn: '保持显示',
      wmPersistOff: '仅新建页',
      wmPersistHintOn: '在对话等非新建会话页面也显示水印（置于正文之下）',
      wmPersistHintOff: '仅在新建会话页显示水印',
      wmPersistNeedWm: '请先开启背景水印',
      loaderRow: '启动加载动画',
      loaderOn: '开启动画',
      loaderOff: '关闭动画',
      loaderHintOn: '刷新页面时播放启动加载屏（左侧进度轨 + 百分比，跟随当前配色）',
      loaderHintOff: '默认关闭；开启后每次刷新页面播放一次',
      loaderNeed: '请先开启启动加载动画',
      preview: '预览',
      thunderRow: '雷霆大字',
      thunderOn: '开启大字',
      thunderOff: '关闭大字',
      thunderHintOn: '任务开始/结束时，在屏幕中央用白色粗体大字显示「任务开始」/「任务完成」，3 秒后自动隐藏；点击屏幕任意处可立即关闭',
      thunderHintOff: '默认关闭；开启后任务开始/结束时在屏幕中央显示「任务开始」/「任务完成」白色大字，3 秒后自动隐藏，点击任意处可立即关闭',
      thunderNeed: '请先开启雷霆大字',
      thunderAnimRow: '大字入场动画',
      thunderAnimOn: '开启动画',
      thunderAnimOff: '关闭动画',
      thunderAnimHintOn: '大字由大缩小砸入并淡出（关闭后为直接显示，仍保持 3 秒）',
      thunderAnimHintOff: '默认关闭；大字直接出现、3 秒后消失，不做缩放与淡入淡出',
      thunderAnimHintReduced: '系统已开启「减少动态效果」，当前直接显示',
      /* 顶部余额胶囊：数据由宿主路由代理（页面拿不到账户凭证），所以提示里
          说明「余额来自本机服务」而不是承诺实时精确。 */
      balanceRow: '顶部余额胶囊',
      balanceOn: '开启余额胶囊',
      balanceOff: '关闭余额胶囊',
      balanceHintOn: '在页面顶部中间悬浮显示账户余额与峰谷定价时段（每分钟刷新余额，时段倒计时每秒走字；右侧「预览」可重播开场动画）',
      balanceHintOff: '默认关闭；开启后悬浮显示余额与峰谷时段（高峰为工作日 9-12 点、14-18 点；周末、法定节假日全天、以及落在周末的调休上班日都按低谷半价）',
      balanceNeed: '请先开启顶部余额胶囊',
      balancePositionRow: '胶囊位置',
      balancePositionCenter: '顶部居中',
      balancePositionLeft: '靠左',
      balancePositionRight: '靠右',
      balancePositionHint: '切换胶囊的停靠位；靠边停靠可让开侧边栏与顶部内容的交叠区，切换立即生效',
      balanceSidebarHideRow: '侧栏自动隐藏',
      balanceSidebarHideHintOn: '侧边栏展开时胶囊自动淡出让位，收起后恢复显示（默认关闭，可在此开启）',
      balanceSidebarHideHintOff: '侧边栏展开时胶囊保持显示，可能遮挡侧栏顶部内容（默认不隐藏）',
      balanceSidebarHideNeed: '请先开启顶部余额胶囊',
      balanceHoverHideRow: '靠近自动隐藏',
      balanceHoverHideHintOn: '指针移到胶囊附近时自动淡出，移开后恢复（避免挡住下方文字）',
      balanceHoverHideHintOff: '指针靠近时胶囊保持显示',
      balanceHoverHideNeed: '请先开启顶部余额胶囊',
      creditDisplayRow: '渠道额度读数',
      creditDisplayRemaining: '剩余',
      creditDisplayUsed: '已用',
      creditDisplayHintRemaining: '渠道模式右侧百分比显示「剩余xx%」（剩余/总额度），圆环同步走剩余份额；主数字始终为剩余额度。需渠道报出总额度，否则右侧留空。切换后下次取数生效',
      creditDisplayHintUsed: '渠道模式右侧百分比显示「已用xx%」（已用/总额度），圆环同步走已用份额；主数字始终为剩余额度。需渠道报出总额度，否则右侧留空。切换后下次取数生效',
      /* 音频通知：播放发生在宿主进程（lib/audio.js），所以这里的每一行都在
         说明「什么时候响」而不是「怎么响」；试听按钮走宿主真实播放链路。 */
      groupAudio: '音频',
      audioRow: '音频通知',
      audioOn: '开启提示音',
      audioOff: '关闭提示音',
      audioHintOn: '由宿主进程播放，页面最小化或切到别的应用时同样能听到',
      audioHintOff: '默认关闭；开启后按下面的开关出声（也可以只留想要的几个）',
      audioBootRow: '启动加载动画音',
      audioBootOn: '开启',
      audioBootOff: '关闭',
      audioBootHint: '播放启动加载屏时响一次；只认真正的页面加载，点「预览」重播不会响',
      audioStartRow: '任务开始音',
      audioStartOn: '开启',
      audioStartOff: '关闭',
      audioStartHint: '只在你从会话框提交指令后播放（后台唤醒、目标续跑不计）',
      audioDoneRow: '任务结束音',
      audioDoneOn: '开启',
      audioDoneOff: '关闭',
      audioDoneHint: '只在我产出最终结果后播放；中途报错或等待审批时不出声',
      audioVolumeRow: '音量',
      audioVolumeHint: '只缩放提示音本身，不改系统音量',
      audioSlotStart: '开始',
      audioSlotDone: '结束',
      audioSlotBoot: '开机',
      audioSlotAttention: '待回应',
      audioSlotFail: '出错',
      audioSlotQuestion: '提问',
      audioSlotApproval: '审批',
      audioSlotUi: '界面',
      audioAttentionRow: '需要你回应',
      audioTurnFailRow: '出错提示音',
      audioReservedHint: '审批请求、我的提问、计划求批都会响',
      audioReservedNeed: '无事件接线：不需要人工干预的错误保持静音',
      audioSoundDirRow: '自定义音效目录',
      audioSoundDirHint: '把 turn-start.wav / turn-done.wav 放进该目录即可覆盖内置音；留空则查工作区与桌面',
      audioSoundDirDefault: '未设置（用桌面 / 工作区 / 内置音）',
      audioFileRow: '当前音源',
      audioFileBundled: '内置合成音',
      audioFileOwn: '自定义文件',
      audioFileMissing: '未找到文件',
      audioHumanOnlyRow: '开始音仅认会话框',
      audioHumanOnlyOn: '仅会话框',
      audioHumanOnlyOff: '宽松模式',
      audioHumanOnlyHintOn: '只认带提交凭据的用户消息，最不容易误触发',
      audioHumanOnlyHintOff: '任何用户来源消息都算（调试用，后台唤醒可能误响）',
      audioDiagRow: '诊断日志',
      audioDiagOn: '开启',
      audioDiagOff: '关闭',
      audioDiagHint: '在宿主控制台与 /theme-arknights/audio/state 记录每次事件判定',
      audioTest: '试听',
      audioTestPlaying: '播放中…',
      audioTestOk: '已交由宿主播放',
      audioTestFail: '宿主未播放',
      audioTestOff: '请先开启音频通知',
      audioNeedOn: '请先开启音频通知',
      audioRefresh: '刷新状态',
    }
    const LOCALE_EN = {
      nav: 'Arknights Theme',
      sep: ': ',
      /* Capitalised: these are VALUES in a "Label: Value" readout, not sentence
         fragments, and the screenshot showed lowercase reading like a typo there. */
      on: 'On',
      off: 'Off',
      groupTheme: 'THEME',
      groupBg: 'BACKGROUND',
      groupAnim: 'ANIMATION',
      groupFun: 'ENTERTAINMENT',
      themeRow: 'Arknights faction theme',
      themeOn: 'Turn on',
      themeOff: 'Turn off',
      factionRow: 'Faction',
      factionHint: 'Three skins share one layout; only paper, ink and accent change',
      faction_name_rhodes: 'Rhodes Island',
      faction_name_laterano: 'Laterano',
      faction_name_rhine: 'Rhine Lab',
      layoutRow: 'Interface version',
      layout_universal: 'Universal',
      layout_advanced: 'Advanced',
      layout_lab: 'Rhine Terminal',
      layoutHint_universal: 'Only palette and type details; layout stays as the app ships it',
      layoutHint_advanced: 'Restyles the whole UI: HUD sidebar, cut corners, scan decals, corner brackets',
      layoutHint_lab: 'On top of Advanced: ceramic paper, striped rows, right-aligned values, a round send disc and a transport-style composer',
      radiusRow: 'Corners',
      radiusRound: 'Rounded',
      radiusSquare: 'Square',
      radiusToRound: 'Use rounded',
      radiusToSquare: 'Use square',
      glassRow: 'Frosted glass', glassHint: 'Local blur on the docked panel; the composer keeps an opaque tint without blur so tooltips stay stable',
      glassOff: 'Off', glassSubtle: 'Subtle', glassStandard: 'Standard', glassStrong: 'Strong',
      scrollAnimRow: 'Output scroll animation',
      scrollAnimOn: 'Turn on',
      scrollAnimOff: 'Turn off',
      scrollAnimHintOn: 'Spreads the streaming pin over frames instead of jumping a whole block at once; the app keeps its own scroll position, so following never breaks',
      scrollAnimHintOff: 'On by default; turning it off restores the original step-by-step jumping',
      scrollAnimHintReduced: 'Your system asks for reduced motion, so scrolling stays native',
      scrollAnimLevelRow: 'Animation strength',
      scrollAnimLevelSoft: 'Soft',
      scrollAnimLevelStandard: 'Standard',
      scrollAnimLevelSnappy: 'Snappy',
      scrollAnimLevelHint: 'Softer is smoother but keeps the newest line further from the bottom; snappier follows closer',
      scrollAnimNeedOn: 'Turn on the output scroll animation first',
      watermarkRow: 'Background wordmark',
      watermarkOn: 'Turn on',
      watermarkOff: 'Turn off',
      wmPersistRow: 'Keep wordmark visible',
      wmPersistOn: 'Keep visible',
      wmPersistOff: 'New session only',
      wmPersistHintOn: 'Also shown on conversations and other pages, behind the text',
      wmPersistHintOff: 'Shown only on the new-session screen',
      wmPersistNeedWm: 'Turn on the background wordmark first',
      loaderRow: 'Boot animation',
      loaderOn: 'Turn on',
      loaderOff: 'Turn off',
      loaderHintOn: 'Plays the boot screen on reload (progress rail + percentage, following the palette)',
      loaderHintOff: 'Off by default; plays once on every page reload when enabled',
      loaderNeed: 'Turn on the boot animation first',
      preview: 'Preview',
      thunderRow: 'Task announcement',
      thunderOn: 'Turn on',
      thunderOff: 'Turn off',
      thunderHintOn: 'Slams 任务开始 / 任务完成 across the screen centre in heavy white type for 3s; click anywhere to dismiss',
      thunderHintOff: 'Off by default; shows 任务开始 / 任务完成 in heavy white type at the screen centre for 3s, dismissable by clicking anywhere',
      thunderNeed: 'Turn on the task announcement first',
      thunderAnimRow: 'Announcement entry animation',
      thunderAnimOn: 'Animate',
      thunderAnimOff: 'Turn off',
      thunderAnimHintOn: 'The word punches in from oversized and fades out (appears instantly when off, still held 3s)',
      thunderAnimHintOff: 'Off by default; the word appears instantly and leaves after 3s, with no scaling or fading',
      thunderAnimHintReduced: 'Your system asks for reduced motion, so it appears instantly',
      balanceRow: 'Balance capsule',
      balanceOn: 'Turn on',
      balanceOff: 'Turn off',
      balanceHintOn: 'Floats a capsule at the top centre of the page showing your account balance and the API peak/off-peak pricing window (balance every minute, window countdown every second; Preview on the right replays the opening animation)',
      balanceHintOff: 'Off by default; floats a balance + pricing-window capsule (peak = weekdays 9-12 & 14-18 Beijing; weekends, Chinese statutory holidays and make-up workdays that land on a weekend are off-peak, half price)',
      balanceNeed: 'Turn on the balance capsule first',
      balancePositionRow: 'Capsule position',
      balancePositionCenter: 'Top centre',
      balancePositionLeft: 'Left',
      balancePositionRight: 'Right',
      balancePositionHint: 'Choose where the capsule docks; an edge dock keeps it clear of the sidebar and the top content. The change applies immediately',
      balanceSidebarHideRow: 'Sidebar auto-hide',
      balanceSidebarHideHintOn: 'Fades the capsule away while the sidebar is open and restores it when the sidebar closes (off by default; turn it on here)',
      balanceSidebarHideHintOff: 'The capsule stays visible while the sidebar is open and may cover sidebar content (the default; no auto-hide)',
      balanceSidebarHideNeed: 'Turn on the balance capsule first',
      balanceHoverHideRow: 'Pointer auto-hide',
      balanceHoverHideHintOn: 'Fades the capsule away while the pointer is near and restores it afterwards (keeps the text below readable)',
      balanceHoverHideHintOff: 'The capsule stays visible while the pointer is near',
      balanceHoverHideNeed: 'Turn on the balance capsule first',
      creditDisplayRow: 'Channel credits readout',
      creditDisplayRemaining: 'Remaining',
      creditDisplayUsed: 'Used',
      creditDisplayHintRemaining: 'In credits mode the right-hand percentage shows the remaining share (of the reported quota) and the ring sweeps that same remaining share; the lead figure always stays the remaining balance. The slot stays empty when the channel reports no quota; the change applies at the next fetch',
      creditDisplayHintUsed: 'In credits mode the right-hand percentage shows the used share (of the reported quota) and the ring sweeps that same used share; the lead figure always stays the remaining balance. The slot stays empty when the channel reports no quota; the change applies at the next fetch',
      groupAudio: 'AUDIO',
      audioRow: 'Audio notifications',
      audioOn: 'Turn on',
      audioOff: 'Turn off',
      audioHintOn: 'Played by the host process, so a minimized page or another app in front still gets the sound',
      audioHintOff: 'Off by default; turning it on enables the slots below (keep only the ones you want)',
      audioBootRow: 'Boot animation sound',
      audioBootOn: 'Turn on',
      audioBootOff: 'Turn off',
      audioBootHint: 'Rings once when the boot plate plays; a real page load only — the Preview button replays it silently',
      audioStartRow: 'Task-start sound',
      audioStartOn: 'Turn on',
      audioStartOff: 'Turn off',
      audioStartHint: 'Plays only after you submit from the composer (wakeups and goal continuations do not count)',
      audioDoneRow: 'Task-end sound',
      audioDoneOn: 'Turn on',
      audioDoneOff: 'Turn off',
      audioDoneHint: 'Plays only after the final answer; interrupted turns and approval waits stay silent',
      audioVolumeRow: 'Volume',
      audioVolumeHint: 'Rescales only the notification sound, never the system volume',
      audioSlotStart: 'Start',
      audioSlotDone: 'Done',
      audioSlotBoot: 'Boot',
      audioSlotAttention: 'Attention',
      audioSlotFail: 'Error',
      audioSlotQuestion: 'Questions',
      audioSlotApproval: 'Approvals',
      audioSlotUi: 'Seen',
      audioAttentionRow: 'Needs your response',
      audioTurnFailRow: 'Error sound',
      audioReservedHint: 'Fires on approval requests, my questions and plan reviews',
      audioReservedNeed: 'Not wired by design: an error needing no human decision stays silent',
      audioSoundDirRow: 'Custom sound directory',
      audioSoundDirHint: 'Drop turn-start.wav / turn-done.wav there to override the built-in tone; blank falls back to the workspace and the Desktop',
      audioSoundDirDefault: 'Not set (Desktop / workspace / bundled)',
      audioFileRow: 'Current source',
      audioFileBundled: 'Bundled synthesized tone',
      audioFileOwn: 'Your own file',
      audioFileMissing: 'No file found',
      audioHumanOnlyRow: 'Start sound: composer only',
      audioHumanOnlyOn: 'Composer only',
      audioHumanOnlyOff: 'Loose mode',
      audioHumanOnlyHintOn: 'Requires the submission credential a real prompt carries — least likely to misfire',
      audioHumanOnlyHintOff: 'Any user-source message counts (debugging; background wakeups may misfire)',
      audioDiagRow: 'Diagnostics',
      audioDiagOn: 'Turn on',
      audioDiagOff: 'Turn off',
      audioDiagHint: 'Logs every event verdict to the host console and /theme-arknights/audio/state',
      audioTest: 'Preview',
      audioTestPlaying: 'Playing…',
      audioTestOk: 'Handed to the host',
      audioTestFail: 'The host did not play it',
      audioTestOff: 'Turn audio notifications on first',
      audioNeedOn: 'Turn audio notifications on first',
      audioRefresh: 'Refresh state',
    }

    /* The locale service is optional, exactly like `theme` and `sessions`: the
       in-process settings tests mount this theme with a ctx carrying only
       theme/slots, and a composition without the locale plugin must still get a
       working (Chinese) settings page rather than a crash. `t` therefore falls back
       to the zh dictionary, and only the key itself as a last resort — a visible
       key beats a blank row. */
    const locale = ctx.get('locale')
    let t = (key) => (Object.prototype.hasOwnProperty.call(LOCALE_ZH, key) ? LOCALE_ZH[key] : key)
    let localeReady = false
    if (locale !== undefined && typeof locale.register === 'function' && typeof locale.bind === 'function') {
      /* Registered through ctx.effect so the dictionaries retire with the run;
         re-applying the bundle would otherwise throw on the duplicate (ns, locale)
         the service rejects by design. */
      ctx.effect(() => locale.register(ARK_NS, { zh: LOCALE_ZH, en: LOCALE_EN }))
      const bound = locale.bind(ARK_NS)
      if (typeof bound === 'function') {
        t = bound
        localeReady = true
      }
    }

    /* ---------- Settings page: 主题 (own settings.section) ---------- */
    const slots = ctx.get('slots')
    const disposeRows = []
    let disposeSettings = () => { disposeRows.forEach((d) => d()) }
    if (slots !== undefined) {
      slots.inject('settings.section', () => {
        const d = slots.register(
        /* `label` is a THUNK, not a string: the slot contract re-evaluates it per
           read, so the nav row follows a language switch with no re-registration.

           `locale` is declared ONLY when a locale service actually exists. It is not
           what drives the re-render — ui-renderer's useLocaleRevision subscribes
           EVERY outlet to the locale revision, so this panel re-renders on a language
           switch either way, and the body reads `t` from the apply closure rather than
           from the injected seat. What declaring it buys is the framework's own
           re-derivation of that seat; what it COSTS when the service is missing is a
           hard failure — ui-renderer throws SlotAssemblyError ("entry declares locale
           namespace ... but no locale face is installed") for an entry declaring a
           namespace with no installed face. Declaring it unconditionally would turn a
           composition without the locale plugin from "settings page in Chinese" into
           "settings page crashes", so the key is spread in only when present. */
        Object.assign(
          { name: 'settings.section', id: 'theme-arknights', order: 35, label: () => t('nav') },
          localeReady ? { locale: ARK_NS } : {}
        ),
        () => {
          const R = (typeof React !== 'undefined') ? React : ((typeof require === 'function') ? require('react') : null)
          if (!R) return null
          const [enabled, setEnabled] = R.useState(isEnabled())
          const [wmOn, setWmOn] = R.useState(isWatermarkOn())
          const [wmPersist, setWmPersist] = R.useState(isWatermarkPersistOn())
          const [loaderOn, setLoaderOn] = R.useState(isLoaderOn())
          const [scrollAnim, setScrollAnim] = R.useState(isScrollAnimOn())
          const [scrollAnimLevel, setScrollAnimLevel] = R.useState(readScrollAnimLevel())
          const [thunderOn, setThunderOn] = R.useState(isThunderOn())
          const [thunderAnim, setThunderAnim] = R.useState(isThunderAnimOn())
          const [balanceOn, setBalanceOn] = R.useState(isBalanceCapsuleOn())
          const [balancePosition, setBalancePosition] = R.useState(readBalanceCapsulePosition())
          const [balanceSidebarHide, setBalanceSidebarHide] = R.useState(isBalanceSidebarHideOn())
          const [balanceHoverHide, setBalanceHoverHide] = R.useState(isBalanceHoverHideOn())
          const [creditDisplay, setCreditDisplay] = R.useState(readCreditDisplay())
          const [faction, setFactionState] = R.useState(readFaction())
          const [layoutMode, setLayoutMode] = R.useState(readLayout())
          const [glass, setGlass] = R.useState(readGlass())
          const [mode, setMode] = R.useState(prefsGet(RADIUS_KEY) || 'square')
          /* 音频通知 is a HOST feature: the browser only owns its switches and
             the preview buttons. `hostState` mirrors what the host half reports
             over /theme-arknights/audio/state (which file each slot actually
             resolved to), so the panel can show the truth instead of assuming
             the bundled tone is in use. */
          const [audioOn, setAudioOn] = R.useState(isAudioOn())
          const [audioBoot, setAudioBoot] = R.useState(isAudioBootOn())
          const [audioStart, setAudioStart] = R.useState(isAudioStartOn())
          const [audioDone, setAudioDone] = R.useState(isAudioDoneOn())
          const [audioVolume, setAudioVolume] = R.useState(readAudioVolume())
          const [audioHumanOnly, setAudioHumanOnly] = R.useState(isAudioHumanOnly())
          const [audioDiag, setAudioDiag] = R.useState(isAudioDiagOn())
          const [hostState, setHostState] = R.useState(null)
          const [previewNote, setPreviewNote] = R.useState('')
          const refreshHostState = () => {
            if (typeof fetch !== 'function') return
            fetch(AUDIO_STATE_URL, { headers: { accept: 'application/json' } })
              .then((res) => (res.ok ? res.json() : null))
              .then((json) => { if (json) setHostState(json) })
              .catch(() => { /* host bridge absent: the rows simply show no source */ })
          }
          /* Re-sync the panel onto the settings section when it finally arrives.
             Every useState above seeded itself from prefsGet() during the FIRST
             render — which, on a real page load, happens while the Host is still
             sending the section, so each read fell back to the schema default.
             Without this effect the switches stayed frozen at those defaults for
             the whole session (the theme's own surfaces recovered, because
             reconcileFromPrefs re-derives them, but the panel's React state had
             no such path): the user sees their settings "reset after refresh"
             even though the values were on disk and the theme was applying them.

             Subscribing to the store rather than using the one-shot
             onPrefsSettled hook is deliberate — that slot is already claimed by
             the boot loader, and a subscription additionally keeps the panel
             honest when the Host or another surface changes a value mid-session.
             prefsEmit runs on every transport snapshot and on every local edit, so
             this simply re-derives the same reads the initializers used; React
             bails out of the re-render when a value is unchanged.

             `useEffect` is feature-detected the way the rest of this panel
             feature-detects React: it must render on a host (or test double)
             whose React face does not expose the hook rather than throwing
             during render. Losing the effect only costs the live re-sync, which
             is no worse than the behaviour before this fix. */
          if (typeof R.useEffect === 'function') {
            panelMounted = true
            /* Re-derive every switch from the store. Kept as one named function so
               the mount pass and every later subscription event run identical
               reads — a switch can never be re-synced from a different source
               than the one the initializers used. */
            const resyncPanelFromPrefs = () => {
              setEnabled(isEnabled())
              setWmOn(isWatermarkOn())
              setWmPersist(isWatermarkPersistOn())
              setLoaderOn(isLoaderOn())
              setScrollAnim(isScrollAnimOn())
              setScrollAnimLevel(readScrollAnimLevel())
              setThunderOn(isThunderOn())
              setThunderAnim(isThunderAnimOn())
              setBalanceOn(isBalanceCapsuleOn())
              setBalancePosition(readBalanceCapsulePosition())
              setBalanceSidebarHide(isBalanceSidebarHideOn())
              setBalanceHoverHide(isBalanceHoverHideOn())
              setCreditDisplay(readCreditDisplay())
              setFactionState(readFaction())
              setLayoutMode(readLayout())
              setGlass(readGlass())
              setMode(prefsGet(RADIUS_KEY) || 'square')
              /* The 音频 rows seed themselves from the same store, so they are
                 re-derived here as well — the section can arrive after the
                 panel's first render, which would otherwise leave every audio
                 switch frozen at its schema default for the whole session. */
              setAudioOn(isAudioOn())
              setAudioBoot(isAudioBootOn())
              setAudioStart(isAudioStartOn())
              setAudioDone(isAudioDoneOn())
              setAudioVolume(readAudioVolume())
              setAudioHumanOnly(isAudioHumanOnly())
              setAudioDiag(isAudioDiagOn())
            }
            R.useEffect(() => {
              /* Subscribe FIRST, then re-derive once. A subscription alone is not
                 enough: the panel can finish mounting AFTER the section already
                 settled, in which case the ready transition that would have
                 notified it has already been emitted and no later event is
                 guaranteed (the mirror only re-reads on a Host document change or
                 a reconnect). Running the pass here makes the panel's state
                 converge whenever it mounts, with no dependence on
                 having been present for the transition. */
              const unsubscribe = prefsSubscribe(resyncPanelFromPrefs)
              resyncPanelFromPrefs()
              return unsubscribe
            }, [])
            // One read per panel mount: the host is the only authority on which
            // file each slot resolved to, and re-reading on every render would
            // hammer the route while the user drags the volume slider. Guarded
            // with the effect above, because the in-process settings tests drive
            // this panel with a minimal recording React that has no effect hook
            // at all — an unguarded call would turn "cannot refresh the source
            // read-out" into "the whole panel throws".
            R.useEffect(() => { refreshHostState() }, [])
          }
          const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--dsw-alias-border-l1)' }
          /* Which copy key names each 动画强度 level. The level ids are the stored
             literals (SCROLL_ANIM_LEVELS, shared with the runtime), so a level can
             never be stored under a name the row cannot render. */
          const SCROLL_ANIM_LEVEL_COPY = { soft: 'scrollAnimLevelSoft', standard: 'scrollAnimLevelStandard', snappy: 'scrollAnimLevelSnappy' }
          const labelStyle = { color: 'var(--dsw-alias-label-primary)', fontSize: '13px', fontWeight: 500, lineHeight: '1.5' }
          // Sub-label explaining what a switch does, so the row is self-describing.
          const hintStyle = { display: 'block', color: 'var(--dsw-alias-label-tertiary)', fontSize: '12px', fontWeight: 400, lineHeight: '1.5', marginTop: '2px' }
          const btnStyleFor = (on, disabled) => {
            /* The switches are themed BY the theme they configure, so while the
               theme is ON the "on" fill reads from the palette variable rather
               than a literal — an inline #fff500 here would keep every enabled
               button yellow while the rest of the UI turned cyan.

               But --edge-accent / --edge-btn-muted live in the theme's own
               stylesheet, which unmount() removes when the theme is switched
               OFF. The hardcoded ink (#000) would then sit on a transparent
               button — invisible in dark mode, where the app panel is dark.
               So when the theme is OFF these buttons fall back to app-native
               tokens (filled chip for "on", outline for "off"), which are the
               same surfaces the rest of the settings page uses. */
            const themed = enabled
            return {
              color: !themed ? 'var(--dsw-alias-label-primary)' : (on ? '#000' : 'var(--dsw-alias-label-primary)'),
              background: !themed
                ? (on ? 'var(--dsw-alias-interactive-bg-hover-solid)' : 'transparent')
                : (on ? 'var(--edge-accent)' : 'var(--edge-btn-muted)'),
              border: '1px solid var(--dsw-alias-border-l2)',
              borderRadius: mode === 'round' ? '999px' : '0',
              padding: '4px 14px',
              fontSize: '12px',
              // A disabled control has to look disabled, not merely ignore clicks.
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.45 : 1,
              whiteSpace: 'nowrap',
            }
          }
          const setGlassValue = (value) => {
            if (!GLASS_OPTIONS.includes(value)) return
            prefsSet(GLASS_KEY, value)
            setGlass(value)
            syncGlass()
          }
          /* ---------- toggles ----------
             EVERY handler below derives its `next` value from the STORE
             (prefsGet / the is* / read* readers), never from the React state
             variable of the same name. Those two can disagree, and when they do
             the toggle writes the WRONG value to the durable section:

               - the initial useState(readPalette()) runs while the Host section
                 is still 'loading', so it seeds the schema DEFAULT;
               - the mount effect re-derives it, but that pass and any later
                 subscription pass only run on a store event, so a panel that
                 mounted mid-transition can still be showing a default;
               - prefsGetValue overlays prefsLocalEdited on top of the fetched
                 section, so the store and the rendered switch are two different
                 reads by construction.

             Reading the store here makes the click a decision about the CURRENT
             durable value rather than about whatever the last render happened to
             capture, so a stale panel can no longer persist a default over a
             real choice. The state setter still runs, so the UI follows. */
          const toggleTheme = () => {
            const next = !isEnabled()
            prefsSet(ENABLED_KEY, next ? '1' : '0')
            setEnabled(next)
            if (next) { mount(); syncWatermarkVisibility() }
            else { unmount(); syncWatermarkVisibility() }
            /* The announcement watcher is gated on the master switch too, so it has
               to be reconciled here. unmount() already stops it, but turning the
               theme back ON must restart it — otherwise the feature would stay dead
               until the next page load. */
            syncThunder()
          }
          /* 阵营切换。视觉部分全部由 syncFactionClass() 的 class 翻转承担：
             氛围层与令牌都读 CSS 变量，所以不需要任何显式重绘。
             走 setFaction() 而不是自己写 prefsSet：那个函数是三个入口（设置页 /
             悬浮阵营条 / 快捷键）共用的唯一路径，它还会刷新悬浮条的徽标。 */
          const chooseFaction = (id) => {
            setFaction(id)
            setFactionState(readFaction())
          }
          /* 界面版本切换。三档共用同一套令牌与配色，差别只在叠了几层结构，所以
             这里仍然是 class 的加减（见 syncLayoutClass）。写成「选中某个值」而不是
             「在两档间翻转」：三档里翻转会丢掉中间那一档，而 lab 必须是显式选择——
             它同时挂 advanced 与 lab 两个 class。 */
          const chooseLayout = (id) => {
            if (LAYOUT_IDS.indexOf(id) === -1) return
            prefsSet(LAYOUT_KEY, id)
            setLayoutMode(id)
            syncLayoutClass()
            /* 终端层只属于 advanced 与 lab：切到通用版要立刻收回注入节点，切到
               那两档则重新扫描。 */
            syncTerminalUI()
          }
          /* 输出滚动动画. syncScrollAnim() reads the pref store, so the write above is
             what it acts on: turning it off must RELEASE the offset immediately (a
             disabled feature that leaves a transform on the transcript is worse than
             never having had the feature). Turning it on attaches to whatever port is
             already on screen, so the next streamed step is already smooth. */
          const toggleScrollAnim = () => {
            const next = !isScrollAnimOn()
            prefsSet(SCROLL_ANIM_KEY, next ? '1' : '0')
            setScrollAnim(next)
            syncScrollAnim()
          }
          const setScrollAnimLevelValue = (level) => {
            if (SCROLL_ANIM_LEVELS.indexOf(level) === -1) return
            prefsSet(SCROLL_ANIM_LEVEL_KEY, level)
            setScrollAnimLevel(level)
          }
          const toggleWm = () => {            const next = !isWatermarkOn()
            prefsSet(WATERMARK_KEY, next ? '1' : '0')
            setWmOn(next)
            syncWatermarkVisibility()
          }
          const toggleWmPersist = () => {
            const next = !isWatermarkPersistOn()
            prefsSet(WATERMARK_PERSIST_KEY, next ? '1' : '0')
            setWmPersist(next)
            syncWatermarkVisibility()
          }
          const toggleLoader = () => {
            const next = !isLoaderOn()
            prefsSet(LOADER_KEY, next ? '1' : '0')
            setLoaderOn(next)
            // Turning it on plays it once right away, so the switch shows what it
            // bought instead of making the user reload to find out.
            if (next) { loaderDone = false; destroyLoader(); runLoader() }
            else destroyLoader()
          }
          const replayLoader = () => {
            loaderDone = false
            destroyLoader()
            runLoader()
          }
          const toggleThunder = () => {
            const next = !isThunderOn()
            prefsSet(THUNDER_KEY, next ? '1' : '0')
            setThunderOn(next)
            /* syncThunder() reads the pref store, so the write above is what it acts
               on. Turning it ON also shows the word once: a switch whose effect only
               appears at some unpredictable later moment gives the user no way to
               tell whether it worked. The preview runs BEFORE the watcher attaches,
               so it cannot be mistaken for a real edge. */
            if (next) showThunder(THUNDER_START)
            else destroyThunder()
            syncThunder()
          }
          const previewThunder = () => { showThunder(THUNDER_DONE) }
          const toggleBalanceCapsule = () => {
            const next = !isBalanceCapsuleOn()
            prefsSet(BALANCE_KEY, next ? '1' : '0')
            setBalanceOn(next)
            /* syncBalanceCapsule() reads the pref store, so the write above is what
               it acts on. Turning it ON mounts the capsule immediately: the first
               fetch fires inside showBalanceCapsule, so the numbers appear within
               one round-trip instead of after an arbitrary delay. */
            syncBalanceCapsule()
          }
          /* 已用 / 剩余 is a select, not a toggle: the two values are answers to
             "what does the right-hand percentage read", not polarities of one
             switch, and a two-state toggle button cannot show which side is
             live the way the row's 状态 label does. Mirrors setGlassValue:
             validate, persist, then mirror into React state. The capsule
             repaints on the NEXT fetch — creditsApply reads the pref store per
             answer, so no forced RPC is spent on a cosmetic re-read (the 5-min
             floor stays honest). */
          const CREDIT_DISPLAY_OPTIONS = ['remaining', 'used']
          const setCreditDisplayValue = (value) => {
            if (CREDIT_DISPLAY_OPTIONS.indexOf(value) === -1) return
            prefsSet(CREDIT_DISPLAY_KEY, value)
            setCreditDisplay(value)
          }
          /* 停靠位 is a select like the credit readout: three literals, one meaning
             ("where does the pill dock"), no polarity. syncBalanceCapsule() rebuilds
             the live capsule (destroy -> remount) when the position changed, so the
             move is visible immediately; with the capsule off the write simply waits
             for the next mount. */
          const BALANCE_POSITION_SELECT_OPTIONS = BALANCE_POSITION_OPTIONS
          const setBalancePositionValue = (value) => {
            if (BALANCE_POSITION_SELECT_OPTIONS.indexOf(value) === -1) return
            prefsSet(BALANCE_POSITION_KEY, value)
            setBalancePosition(value)
            syncBalanceCapsule()
          }
          /* 防遮挡子开关 are polar toggles like the master switch: each writes
             its default-ON field and mirrors into React state. The live capsule
             picks both values up on its NEXT shade decision (every sidebar
             resize and mousemove re-reads the pref store), so no rebuild is
             needed — but a switch turned OFF while the capsule is currently
             hidden must un-hide it immediately, which syncBalanceCapsule's
             plain re-show does not do. balanceShadeApply() re-derives from the
             store, so calling it (when a pill is live) clears the stale shade
             on the same tick. */
          const toggleBalanceSidebarHide = () => {
            const next = !isBalanceSidebarHideOn()
            prefsSet(BALANCE_SIDEBAR_HIDE_KEY, next ? '1' : '0')
            setBalanceSidebarHide(next)
            if (typeof balanceShadeApply === 'function') balanceShadeApply()
          }
          const toggleBalanceHoverHide = () => {
            const next = !isBalanceHoverHideOn()
            prefsSet(BALANCE_HOVER_HIDE_KEY, next ? '1' : '0')
            setBalanceHoverHide(next)
            if (typeof balanceShadeApply === 'function') balanceShadeApply()
          }
          /* 预览: the opening pose is a one-shot moment — a real load shows it once
             and there is no reload button on the settings page. Remounting the
             capsule is the whole preview: destroyBalanceCapsule() clears the timers
             and the node, and the forced show re-runs the brand pose followed by the
             same collapse into the balance row the real load performs. */
          const previewBalanceBoot = () => {
            if (!isEnabled() || !isBalanceCapsuleOn()) return
            destroyBalanceCapsule()
            showBalanceCapsule(true)
          }
          const toggleThunderAnim = () => {
            const next = !isThunderAnimOn()
            prefsSet(THUNDER_ANIM_KEY, next ? '1' : '0')
            setThunderAnim(next)
            /* Nothing to reconcile: the next showThunder() reads the switch and marks
               the plate accordingly. Replaying now is what makes the change legible —
               the difference between the two modes is only visible during the entry,
               so a silent toggle would look like it did nothing. */
            showThunder(THUNDER_START)
          }
          const toggleMode = () => {
            const next = (prefsGet(RADIUS_KEY) || 'square') === 'round' ? 'square' : 'round'
            prefsSet(RADIUS_KEY, next)
            setMode(next)
            if (next === 'round') document.body.classList.add('theme-arknights-round')
            else document.body.classList.remove('theme-arknights-round')
          }
          /* ---------- 音频通知 handlers ----------
             A switch writes its field and updates local state; the host half
             watches the same namespace, so the next event uses the new value
             without a reload. The preview buttons deliberately do NOT play
             anything in the browser: they ask the host, so what you hear while
             testing is exactly what a real notification will sound like. */
          const showPreviewNote = (result) => {
            if (result && result.played) setPreviewNote(t('audioTestOk'))
            else setPreviewNote(t('audioTestFail') + (result && result.why ? '：' + result.why : ''))
          }
          const playPreview = (slot) => { previewSlot(slot).then(showPreviewNote) }
          const audioTestButton = (slot, labelKey) => R.createElement('button', {
            key: 'audio-test-' + slot,
            type: 'button',
            onClick: () => playPreview(slot),
            style: btnStyleFor(false, !audioOn),
            // Previewing while the master switch is off is refused by the host
            // (volume 0 / disabled), so the button says why instead of failing
            // silently.
            disabled: !audioOn,
            title: audioOn ? '' : t('audioNeedOn'),
          }, t('audioTest') + ' · ' + t(labelKey))
          const toggleAudio = () => {
            const next = !audioOn
            prefsSet(AUDIO_ENABLED_KEY, next ? '1' : '0')
            setAudioOn(next)
            // The attention watcher is gated on this switch, so it has to be
            // reconciled here as well as on the pref echo.
            syncAudioAttentionWatch()
            if (next) playPreview('turn-done')
          }
          const toggleAudioStart = () => {
            const next = !audioStart
            prefsSet(AUDIO_TURN_START_KEY, next ? '1' : '0')
            setAudioStart(next)
            if (next) playPreview('turn-start')
          }
          const toggleAudioBoot = () => {
            const next = !audioBoot
            prefsSet(AUDIO_BOOT_KEY, next ? '1' : '0')
            setAudioBoot(next)
            // Preview the boot slot itself: the real one fires from the loader,
            // which is awkward to re-trigger from here.
            if (next) playPreview('boot')
          }
          const toggleAudioDone = () => {
            const next = !audioDone
            prefsSet(AUDIO_TURN_DONE_KEY, next ? '1' : '0')
            setAudioDone(next)
            if (next) playPreview('turn-done')
          }
          const setAudioVolumeValue = (next) => {
            const clamped = Math.min(100, Math.max(0, Math.round(next)))
            prefsSet(AUDIO_VOLUME_KEY, String(clamped))
            setAudioVolume(clamped)
          }
          const toggleAudioHumanOnly = () => {
            const next = !audioHumanOnly
            prefsSet(AUDIO_HUMAN_ONLY_KEY, next ? '1' : '0')
            setAudioHumanOnly(next)
          }
          const toggleAudioDiag = () => {
            const next = !audioDiag
            prefsSet(AUDIO_DIAG_KEY, next ? '1' : '0')
            setAudioDiag(next)
          }
          const applySoundDir = (value) => {
            const text = typeof value === 'string' ? value.trim() : ''
            prefsSet(AUDIO_SOUND_DIR_KEY, text)
            refreshHostState()
          }
          /** The host's view of one slot, or undefined while it has not answered. */
          const slotState = (slot) => {
            if (hostState === null || !Array.isArray(hostState.slots)) return undefined
            return hostState.slots.find((entry) => entry.id === slot)
          }
          // The two reserved rows have no switch, so their value read-out reports
          // whether the SOUND is previewable instead of pretending to be a toggle.
          const audioTestReady = () => (hostState === null ? true : slotState('attention') !== undefined)
          const sourceSummary = () => {
            const done = slotState('turn-done')
            if (done === undefined) return '—'
            if (done.file === null) return t('audioFileMissing')
            return done.bundled ? t('audioFileBundled') : t('audioFileOwn')
          }
          const sourceDetail = () => {
            const rows = []
            for (const slot of ['boot', 'turn-start', 'turn-done']) {
              const state = slotState(slot)
              const name = slot === 'boot' ? t('audioSlotBoot') : slot === 'turn-start' ? t('audioSlotStart') : t('audioSlotDone')
              rows.push(name + t('sep') + (state === undefined || state.file === null ? t('audioFileMissing') : state.file))
            }
            /* How many intervention requests this host half has actually seen.
               Without it, "no sound" cannot distinguish "the event never reached
               the plugin" from "the plugin chose to stay silent" — the two are
               indistinguishable from the page. Re-open this page (or press 刷新)
               after answering a question to watch the counter move. */
            if (hostState !== null && hostState.attention !== undefined) {
              rows.push(t('audioAttentionRow') + t('sep')
                + t('audioSlotUi') + ' ' + String(hostState.attention.ui)
                + ' / ' + t('audioSlotQuestion') + ' ' + String(hostState.attention.question)
                + ' / ' + t('audioSlotApproval') + ' ' + String(hostState.attention.approval))
            }
            if (hostState !== null && Array.isArray(hostState.log) && hostState.log.length > 0) {
              const last = hostState.log[hostState.log.length - 1]
              rows.push(t('audioDiagRow') + t('sep') + last.kind + (last.detail ? ' ' + last.detail : ''))
            }
            return rows.join('　·　')
          }
          const pageStyle = { maxWidth: '640px', padding: '4px 0 16px' }
          /* The switches are grouped into four concerns so the page can be
             scanned instead of read as a flat list: 主题 (master switch +
             appearance), 背景 (watermark), 动画 (boot loader),
             娱乐 (雷霆大字 announcements + their entry animation).
             Each group is an editorial numbered header; rows keep their stable
             React keys. The last row of each group drops its divider so the next
             group header's own rule is the only line between groups.

             The header shows the group name in the ACTIVE language plus a latin
             all-caps line. Under English both would collapse to the same word, so
             the second line is dropped there rather than printed twice — the latin
             line is editorial styling for the Chinese name, not a translation. */
          const groupTitle = (no, key, first) => {
            const name = t(key)
            const latin = LOCALE_EN[key]
            const parts = [
              R.createElement('span', { key: 'mark', 'aria-hidden': 'true', style: { width: '4px', height: '14px', flex: '0 0 auto', background: 'currentColor' } }),
              R.createElement('span', { key: 'cn', style: { fontSize: '12px', fontWeight: 600, letterSpacing: '0.14em', lineHeight: '1.5' } }, no + ' ' + name),
            ]
            if (latin !== undefined && latin !== name) {
              parts.push(R.createElement('span', { key: 'en', style: { fontSize: '10px', fontWeight: 500, letterSpacing: '0.2em', opacity: 0.72, lineHeight: '1.5' } }, latin))
            }
            return R.createElement('div', {
              key: 'group-title-' + no,
              className: 'ak-settings-group-title',
              style: {
                display: 'flex', alignItems: 'center', gap: '8px',
                marginTop: first ? '0' : '26px', paddingBottom: '8px',
                borderBottom: '1px solid var(--dsw-alias-border-l1)',
              },
            }, parts)
          }
          /** "<row label>: <on|off>" — one spelling for every status row. */
          const stateOf = (on) => t(on ? 'on' : 'off')
          const row = (key, last, children) => R.createElement('div', { key, style: last ? { ...rowStyle, borderBottom: 'none' } : rowStyle }, children)
          return R.createElement('div', { className: 'ak-settings', style: pageStyle }, [
            /* --- 01 主题：总开关在最前，随后是配色与圆角 --- */
            R.createElement('div', { key: 'group-theme' }, [
              groupTitle('01', 'groupTheme', true),
              row('theme', false, [
                R.createElement('span', { style: labelStyle }, t('themeRow') + t('sep') + stateOf(enabled)),
                R.createElement('button', { type: 'button', onClick: toggleTheme, style: btnStyleFor(enabled) }, t(enabled ? 'themeOff' : 'themeOn'))
              ]),
              row('faction', false, [
                R.createElement('span', { style: labelStyle },
                  t('factionRow') + t('sep') + t('faction_name_' + faction),
                  R.createElement('span', { style: hintStyle }, t('factionHint'))
                ),
                /* 三个阵营各一枚徽标按钮：形状是各自的几何记号（.ak-crest 走
                   currentColor），选中那一枚连形状一起反白。这里不铺阵营色——
                   颜色只有样式表一份真相，选中后的整页配色就是它，JS 里再抄一份
                   色值迟早和它对不上。 */
                R.createElement('span', { style: { display: 'flex', gap: '6px', flex: '0 0 auto', alignItems: 'center' } },
                  FACTION_META.map((meta) => {
                    const active = faction === meta.id
                    return R.createElement('button', {
                      key: meta.id,
                      type: 'button',
                      'aria-label': meta.nav[akIsZh() ? 'zh' : 'en'],
                      'aria-pressed': active ? 'true' : 'false',
                      title: akPick(meta.hint),
                      onClick: () => chooseFaction(meta.id),
                      style: {
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '5px 9px', cursor: 'pointer',
                        font: 'inherit', fontSize: '11px', letterSpacing: '0.06em',
                        /* 主题关掉时 --edge-* 不存在，退回应用自己的令牌，否则
                           按钮会变成一片没有颜色的空洞。 */
                        color: active
                          ? (enabled ? 'var(--edge-paper)' : 'var(--dsw-alias-label-primary-inverted)')
                          : 'var(--dsw-alias-label-secondary)',
                        background: active
                          ? (enabled ? 'var(--edge-accent)' : 'var(--dsw-alias-interactive-bg-hover-solid)')
                          : 'transparent',
                        border: '1px solid ' + (active ? 'transparent' : 'var(--dsw-alias-border-l2)'),
                        borderRadius: mode === 'round' ? '999px' : '0',
                      },
                    }, [
                      R.createElement('span', {
                        key: 'cr',
                        'aria-hidden': 'true',
                        className: 'ak-crest',
                        'data-ak-crest': meta.id,
                      }),
                      R.createElement('span', { key: 'tx' }, meta.badge),
                    ])
                  })
                )
              ]),
              row('layout', false, [
                R.createElement('span', { style: labelStyle },
                  t('layoutRow') + t('sep') + t('layout_' + layoutMode),
                  R.createElement('span', { style: hintStyle }, t('layoutHint_' + layoutMode))
                ),
                /* 三档分段控件：与阵营行同一种形状，选中的那一段实心反白。
                   这里同样不铺颜色常量——强调色只有样式表一份真相。 */
                R.createElement('span', {
                  style: { display: 'flex', gap: '4px', flex: '0 0 auto', alignItems: 'center' },
                  role: 'group',
                  'aria-label': t('layoutRow'),
                }, LAYOUT_IDS.map((id) => {
                  const active = layoutMode === id
                  return R.createElement('button', {
                    key: id,
                    type: 'button',
                    'aria-pressed': active ? 'true' : 'false',
                    title: t('layoutHint_' + id),
                    onClick: () => chooseLayout(id),
                    style: {
                      padding: '5px 8px', cursor: 'pointer',
                      font: 'inherit', fontSize: '11px', letterSpacing: '0.04em',
                      color: active
                        ? (enabled ? 'var(--edge-paper)' : 'var(--dsw-alias-label-primary-inverted)')
                        : 'var(--dsw-alias-label-secondary)',
                      background: active
                        ? (enabled ? 'var(--edge-accent)' : 'var(--dsw-alias-interactive-bg-hover-solid)')
                        : 'transparent',
                      border: '1px solid ' + (active ? 'transparent' : 'var(--dsw-alias-border-l2)'),
                      borderRadius: mode === 'round' ? '999px' : '0',
                    },
                  }, t('layout_' + id))
                }))
              ]),
              row('glass', false, [
                R.createElement('span', { style: labelStyle }, t('glassRow'),
                  R.createElement('span', { style: hintStyle }, t('glassHint'))),
                R.createElement('select', {
                  'aria-label': t('glassRow'), value: glass,
                  onChange: (event) => setGlassValue(event.target.value),
                  style: { color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-1)',
                    border: '1px solid var(--dsw-alias-border-l2)', padding: '6px 10px' },
                }, GLASS_OPTIONS.map((value) => R.createElement('option', { key: value, value },
                  t({ off: 'glassOff', subtle: 'glassSubtle', standard: 'glassStandard', strong: 'glassStrong' }[value]))))
              ]),
              row('radius', true, [
                R.createElement('span', { style: labelStyle }, t('radiusRow') + t('sep') + t(mode === 'round' ? 'radiusRound' : 'radiusSquare')),
                R.createElement('button', { type: 'button', onClick: toggleMode, style: btnStyleFor(mode === 'round') }, t(mode === 'round' ? 'radiusToSquare' : 'radiusToRound'))
              ]),
            ]),
            /* --- 02 背景：水印，主开关在前、附属开关在后 --- */
            R.createElement('div', { key: 'group-bg' }, [
              groupTitle('02', 'groupBg', false),
              row('watermark', false, [
                R.createElement('span', { style: labelStyle }, t('watermarkRow') + t('sep') + stateOf(wmOn)),
                R.createElement('button', { type: 'button', onClick: toggleWm, style: btnStyleFor(wmOn) }, t(wmOn ? 'watermarkOff' : 'watermarkOn'))
              ]),
              row('watermark-persist', true, [
                R.createElement('span', { style: labelStyle },
                  t('wmPersistRow') + t('sep') + stateOf(wmPersist),
                  R.createElement('span', { style: hintStyle },
                    t(wmPersist ? 'wmPersistHintOn' : 'wmPersistHintOff')
                  )
                ),
                R.createElement('button', {
                  type: 'button',
                  onClick: toggleWmPersist,
                  style: btnStyleFor(wmPersist, !wmOn),
                  // The switch only has meaning while the watermark itself is on.
                  disabled: !wmOn,
                  title: wmOn ? '' : t('wmPersistNeedWm'),
                }, t(wmPersist ? 'wmPersistOff' : 'wmPersistOn'))
              ]),
            ]),
            /* --- 03 动画：输出滚动动画 + 启动加载动画 --- */
            R.createElement('div', { key: 'group-anim' }, [
              groupTitle('03', 'groupAnim', false),
              row('scroll-anim', false, [
                R.createElement('span', { style: labelStyle },
                  t('scrollAnimRow') + t('sep') + stateOf(scrollAnim),
                  R.createElement('span', { style: hintStyle },
                    // Say so when the OS preference is overriding the switch, rather
                    // than letting it look like the toggle is broken.
                    (scrollAnim && prefersReducedMotion())
                      ? t('scrollAnimHintReduced')
                      : t(scrollAnim ? 'scrollAnimHintOn' : 'scrollAnimHintOff')
                  )
                ),
                R.createElement('button', {
                  type: 'button',
                  onClick: toggleScrollAnim,
                  style: btnStyleFor(scrollAnim),
                }, t(scrollAnim ? 'scrollAnimOff' : 'scrollAnimOn'))
              ]),
              /* 动画强度 is a level, not a polarity: the three values are points on
                 one smoothing/lag trade-off, so they get a segmented row like FPS
                 and 速度 rather than a toggle. Disabled while the feature is off,
                 because a level for a disabled animation is not a choice. */
              row('scroll-anim-level', false, [
                R.createElement('span', { style: labelStyle },
                  t('scrollAnimLevelRow') + t('sep') + t(SCROLL_ANIM_LEVEL_COPY[scrollAnimLevel]),
                  R.createElement('span', { style: hintStyle }, t('scrollAnimLevelHint'))
                ),
                R.createElement('span', { style: { display: 'flex', gap: '4px', flex: '0 0 auto' } },
                  ...SCROLL_ANIM_LEVELS.map((level) => R.createElement('button', {
                    key: 'scroll-level-' + level,
                    type: 'button',
                    onClick: () => setScrollAnimLevelValue(level),
                    style: btnStyleFor(scrollAnimLevel === level, !scrollAnim),
                    disabled: !scrollAnim,
                    title: scrollAnim ? '' : t('scrollAnimNeedOn'),
                  }, t(SCROLL_ANIM_LEVEL_COPY[level])))
                )
              ]),
              row('loader', true, [
                R.createElement('span', { style: labelStyle },
                  t('loaderRow') + t('sep') + stateOf(loaderOn),
                  R.createElement('span', { style: hintStyle },
                    t(loaderOn ? 'loaderHintOn' : 'loaderHintOff')
                  )
                ),
                R.createElement('span', { style: { display: 'flex', gap: '8px', flex: '0 0 auto' } },
                  // Replay only makes sense while the feature is on; it lets the user
                  // re-watch the animation without reloading the page.
                  R.createElement('button', {
                    type: 'button',
                    onClick: replayLoader,
                    // The master switch gates this too: the plate is styled by the
                    // stylesheet the master switch removes, so previewing while the
                    // theme is off has nothing to show (runLoader refuses as well).
                    style: btnStyleFor(false, !loaderOn || !enabled),
                    disabled: !loaderOn || !enabled,
                    title: loaderOn ? '' : t('loaderNeed'),
                  }, t('preview')),
                  R.createElement('button', { type: 'button', onClick: toggleLoader, style: btnStyleFor(loaderOn) }, t(loaderOn ? 'loaderOff' : 'loaderOn'))
                )
              ]),
            ]),
            /* --- 04 娱乐：雷霆大字（主开关 + 入场动画子开关） --- */
            R.createElement('div', { key: 'group-fun' }, [
              groupTitle('04', 'groupFun', false),
              row('thunder', false, [
                R.createElement('span', { style: labelStyle },
                  t('thunderRow') + t('sep') + stateOf(thunderOn),
                  R.createElement('span', { style: hintStyle },
                    t(thunderOn ? 'thunderHintOn' : 'thunderHintOff')
                  )
                ),
                R.createElement('span', { style: { display: 'flex', gap: '8px', flex: '0 0 auto' } },
                  // Same affordance as the boot animation: let the user see the
                  // effect now instead of waiting for the next task boundary.
                  R.createElement('button', {
                    type: 'button',
                    onClick: previewThunder,
                    style: btnStyleFor(false, !thunderOn),
                    disabled: !thunderOn,
                    title: thunderOn ? '' : t('thunderNeed'),
                  }, t('preview')),
                  R.createElement('button', { type: 'button', onClick: toggleThunder, style: btnStyleFor(thunderOn) }, t(thunderOn ? 'thunderOff' : 'thunderOn'))
                )
              ]),
              row('thunder-anim', true, [
                R.createElement('span', { style: labelStyle },
                  t('thunderAnimRow') + t('sep') + stateOf(thunderAnim),
                  R.createElement('span', { style: hintStyle },
                    // Say so when the OS preference is overriding the switch, rather
                    // than letting it look like the toggle is broken.
                    (thunderAnim && prefersReducedMotion())
                      ? t('thunderAnimHintReduced')
                      : t(thunderAnim ? 'thunderAnimHintOn' : 'thunderAnimHintOff')
                  )
                ),
                R.createElement('button', {
                  type: 'button',
                  onClick: toggleThunderAnim,
                  style: btnStyleFor(thunderAnim, !thunderOn),
                  // Only meaningful while the announcement itself is on.
                  disabled: !thunderOn,
                  title: thunderOn ? '' : t('thunderNeed'),
                }, t(thunderAnim ? 'thunderAnimOff' : 'thunderAnimOn'))
              ]),
              /* --- 顶部余额胶囊：同样属于「娱乐」组的悬浮层 --- */
              row('balance-capsule', false, [
                R.createElement('span', { style: labelStyle },
                  t('balanceRow') + t('sep') + stateOf(balanceOn),
                  R.createElement('span', { style: hintStyle },
                    t(balanceOn ? 'balanceHintOn' : 'balanceHintOff')
                  )
                ),
                R.createElement('span', { style: { display: 'flex', gap: '8px', flex: '0 0 auto' } },
                  // Same affordance as the boot plate: the theme draws this opening
                  // pose once per page load, so let the user watch it again without
                  // reloading. Gated on the theme AND the capsule, because the pose is
                  // drawn by the stylesheet the master switch removes.
                  R.createElement('button', {
                    type: 'button',
                    onClick: previewBalanceBoot,
                    style: btnStyleFor(false, !balanceOn || !enabled),
                    disabled: !balanceOn || !enabled,
                    title: balanceOn ? '' : t('balanceNeed'),
                  }, t('preview')),
                  R.createElement('button', {
                    type: 'button',
                    onClick: toggleBalanceCapsule,
                    style: btnStyleFor(balanceOn),
                  }, t(balanceOn ? 'balanceOff' : 'balanceOn'))
                )
              ]),
              /* --- 胶囊位置 + 防遮挡：停靠位是三档 select，行为在胶囊上 ---
                 The select mirrors the credit-display row; the hint names BOTH
                 automatic hiding rules (sidebar open / pointer nearby) so the
                 behaviour is discoverable without reading the source. The row is
                 only meaningful while the capsule is on, but the select stays
                 enabled: writing a dock with the capsule off is a valid
                 pre-configuration that the next mount honours. */
              row('balance-capsule-position', false, [
                R.createElement('span', { style: labelStyle },
                  t('balancePositionRow') + t('sep') + t('balancePosition' + balancePosition.charAt(0).toUpperCase() + balancePosition.slice(1)),
                  R.createElement('span', { style: hintStyle },
                    t('balancePositionHint')
                  )
                ),
                R.createElement('select', {
                  'aria-label': t('balancePositionRow'), value: balancePosition,
                  onChange: (event) => setBalancePositionValue(event.target.value),
                  style: { color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-1)',
                    border: '1px solid var(--dsw-alias-border-l2)', padding: '6px 10px' },
                }, BALANCE_POSITION_SELECT_OPTIONS.map((value) => R.createElement('option', { key: value, value },
                  t('balancePosition' + value.charAt(0).toUpperCase() + value.slice(1)))))
              ]),
              /* --- 防遮挡两个子开关：侧栏展开自动隐藏 / 指针靠近自动隐藏 ---
                 Both ship ON because the遮挡 they answer is what the capsule
                 rows exist for; each toggle can silence its rule individually.
                 The switches stay enabled with the capsule off (a
                 pre-configuration the next mount honours), mirroring the
                 position select above; the hint states what fades and when. */
              row('balance-capsule-sidebar-hide', false, [
                R.createElement('span', { style: labelStyle },
                  t('balanceSidebarHideRow') + t('sep') + stateOf(balanceSidebarHide),
                  R.createElement('span', { style: hintStyle },
                    t(balanceSidebarHide ? 'balanceSidebarHideHintOn' : 'balanceSidebarHideHintOff')
                  )
                ),
                R.createElement('button', {
                  type: 'button',
                  onClick: toggleBalanceSidebarHide,
                  style: btnStyleFor(balanceSidebarHide),
                }, t(balanceSidebarHide ? 'balanceOff' : 'balanceOn'))
              ]),
              row('balance-capsule-hover-hide', false, [
                R.createElement('span', { style: labelStyle },
                  t('balanceHoverHideRow') + t('sep') + stateOf(balanceHoverHide),
                  R.createElement('span', { style: hintStyle },
                    t(balanceHoverHide ? 'balanceHoverHideHintOn' : 'balanceHoverHideHintOff')
                  )
                ),
                R.createElement('button', {
                  type: 'button',
                  onClick: toggleBalanceHoverHide,
                  style: btnStyleFor(balanceHoverHide),
                }, t(balanceHoverHide ? 'balanceOff' : 'balanceOn'))
              ]),
              /* --- 渠道额度读数：右侧百分比显示已用 or 剩余 ---
                 The row lives directly under the capsule switch because it only
                 describes that capsule's credits mode; the select mirrors the
                 glass/renderer rows rather than a toggle, and the hint states
                 what changes (the right-hand slot) and what does not (the lead
                 figure always stays the remaining balance). */
              row('credit-display', false, [
                R.createElement('span', { style: labelStyle },
                  t('creditDisplayRow') + t('sep') + t(creditDisplay === 'used' ? 'creditDisplayUsed' : 'creditDisplayRemaining'),
                  R.createElement('span', { style: hintStyle },
                    t(creditDisplay === 'used' ? 'creditDisplayHintUsed' : 'creditDisplayHintRemaining')
                  )
                ),
                R.createElement('select', {
                  'aria-label': t('creditDisplayRow'), value: creditDisplay,
                  onChange: (event) => setCreditDisplayValue(event.target.value),
                  style: { color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-1)',
                    border: '1px solid var(--dsw-alias-border-l2)', padding: '6px 10px' },
                }, CREDIT_DISPLAY_OPTIONS.map((value) => R.createElement('option', { key: value, value },
                  t(value === 'used' ? 'creditDisplayUsed' : 'creditDisplayRemaining'))))
              ]),
            ]),
            /* --- 05 音频：两个生效槽位 + 两个预留槽位 ---
               Every row states WHEN it fires, because that is the whole contract
               of this feature; the two reserved rows say outright that they will
               not fire yet, so a switch that does nothing cannot read as broken. */
            R.createElement('div', { key: 'group-audio' }, [
              groupTitle('05', 'groupAudio', false),
              row('audio', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioRow') + t('sep') + stateOf(audioOn),
                  R.createElement('span', { style: hintStyle },
                    t(audioOn ? 'audioHintOn' : 'audioHintOff')
                  )
                ),
                R.createElement('button', { type: 'button', onClick: toggleAudio, style: btnStyleFor(audioOn) }, t(audioOn ? 'audioOff' : 'audioOn'))
              ]),
              /* The boot row pairs two independent switches stacked on the right:
                 the sound's own on/off, and the loader's preview button. They are
                 separate switches because the loader can be on with no sound. */
              row('audio-boot', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioBootRow') + t('sep') + stateOf(audioBoot),
                  R.createElement('span', { style: hintStyle }, t('audioBootHint'))
                ),
                R.createElement('span', { style: { display: 'flex', flexDirection: 'column', gap: '6px', flex: '0 0 auto', alignItems: 'stretch' } },
                  R.createElement('button', {
                    type: 'button', onClick: replayLoader,
                    style: btnStyleFor(false, !loaderOn || !enabled),
                    disabled: !loaderOn || !enabled,
                    title: loaderOn ? '' : t('loaderNeed'),
                  }, t('preview') + ' · ' + t('loaderRow')),
                  R.createElement('button', {
                    type: 'button', onClick: toggleAudioBoot,
                    style: btnStyleFor(audioBoot, !audioOn), disabled: !audioOn,
                    title: audioOn ? '' : t('audioNeedOn'),
                  }, t(audioBoot ? 'audioBootOff' : 'audioBootOn'))
                )
              ]),
              row('audio-start', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioStartRow') + t('sep') + stateOf(audioStart),
                  R.createElement('span', { style: hintStyle }, t('audioStartHint'))
                ),
                R.createElement('span', { style: { display: 'flex', gap: '8px', flex: '0 0 auto' } },
                  audioTestButton('turn-start', 'audioSlotStart'),
                  R.createElement('button', {
                    type: 'button', onClick: toggleAudioStart,
                    style: btnStyleFor(audioStart, !audioOn), disabled: !audioOn,
                    title: audioOn ? '' : t('audioNeedOn'),
                  }, t(audioStart ? 'audioStartOff' : 'audioStartOn'))
                )
              ]),
              row('audio-done', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioDoneRow') + t('sep') + stateOf(audioDone),
                  R.createElement('span', { style: hintStyle }, t('audioDoneHint'))
                ),
                R.createElement('span', { style: { display: 'flex', gap: '8px', flex: '0 0 auto' } },
                  audioTestButton('turn-done', 'audioSlotDone'),
                  R.createElement('button', {
                    type: 'button', onClick: toggleAudioDone,
                    style: btnStyleFor(audioDone, !audioOn), disabled: !audioOn,
                    title: audioOn ? '' : t('audioNeedOn'),
                  }, t(audioDone ? 'audioDoneOff' : 'audioDoneOn'))
                )
              ]),
              row('audio-volume', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioVolumeRow') + t('sep') + String(audioVolume) + '%',
                  R.createElement('span', { style: hintStyle }, t('audioVolumeHint'))
                ),
                R.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' } },
                  R.createElement('input', {
                    type: 'range', min: 0, max: 100, step: 5,
                    'aria-label': t('audioVolumeRow'),
                    value: audioVolume,
                    disabled: !audioOn,
                    onChange: (event) => setAudioVolumeValue(Number(event.target.value)),
                    onMouseUp: () => { previewSlot('turn-done').then(showPreviewNote) },
                    style: { width: '140px', accentColor: enabled ? 'var(--edge-accent)' : undefined },
                  }),
                  R.createElement('span', { style: { ...labelStyle, minWidth: '38px', textAlign: 'right' } }, String(audioVolume) + '%')
                )
              ]),
              row('audio-attention', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioAttentionRow') + t('sep') + stateOf(audioTestReady()),
                  R.createElement('span', { style: hintStyle }, t('audioReservedHint'))
                ),
                R.createElement('span', { style: { display: 'flex', gap: '8px', flex: '0 0 auto' } },
                  audioTestButton('attention', 'audioSlotAttention')
                )
              ]),
              row('audio-fail', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioTurnFailRow') + t('sep') + stateOf(audioTestReady()),
                  R.createElement('span', { style: hintStyle }, t('audioReservedHint'))
                ),
                R.createElement('span', { style: { display: 'flex', gap: '8px', flex: '0 0 auto' } },
                  audioTestButton('turn-fail', 'audioSlotFail')
                )
              ]),
              row('audio-source', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioFileRow') + t('sep') + sourceSummary(),
                  R.createElement('span', { style: hintStyle, wordBreak: 'break-all' }, sourceDetail())
                ),
                R.createElement('button', {
                  type: 'button', onClick: () => { setPreviewNote(''); refreshHostState() },
                  style: btnStyleFor(false),
                }, t('audioRefresh'))
              ]),
              row('audio-dir', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioSoundDirRow') + t('sep') + (readAudioSoundDir() || t('audioSoundDirDefault')),
                  R.createElement('span', { style: hintStyle }, t('audioSoundDirHint'))
                ),
                R.createElement('span', { style: { display: 'flex', gap: '8px', flex: '0 0 auto' } },
                  R.createElement('input', {
                    type: 'text',
                    'aria-label': t('audioSoundDirRow'),
                    defaultValue: readAudioSoundDir(),
                    placeholder: t('audioSoundDirDefault'),
                    onKeyDown: (event) => { if (event.key === 'Enter') applySoundDir(event.target.value) },
                    onBlur: (event) => applySoundDir(event.target.value),
                    style: { width: '200px', color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l2)', padding: '6px 8px', fontSize: '12px' },
                  })
                )
              ]),
              row('audio-human', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioHumanOnlyRow') + t('sep') + t(audioHumanOnly ? 'audioHumanOnlyOn' : 'audioHumanOnlyOff'),
                  R.createElement('span', { style: hintStyle },
                    t(audioHumanOnly ? 'audioHumanOnlyHintOn' : 'audioHumanOnlyHintOff')
                  )
                ),
                R.createElement('button', {
                  type: 'button', onClick: toggleAudioHumanOnly,
                  style: btnStyleFor(audioHumanOnly, !audioOn), disabled: !audioOn,
                  title: audioOn ? '' : t('audioNeedOn'),
                }, t(audioHumanOnly ? 'audioHumanOnlyOff' : 'audioHumanOnlyOn'))
              ]),
              row('audio-diag', true, [
                R.createElement('span', { style: labelStyle },
                  t('audioDiagRow') + t('sep') + stateOf(audioDiag),
                  R.createElement('span', { style: hintStyle },
                    previewNote !== '' ? previewNote : t('audioDiagHint')
                  )
                ),
                R.createElement('button', { type: 'button', onClick: toggleAudioDiag, style: btnStyleFor(audioDiag) }, t(audioDiag ? 'audioDiagOff' : 'audioDiagOn'))
              ]),
            ]),
          ])
        }
      )
      disposeRows.push(d)
      return d
    })
    }

    ctx.effect(() => () => {
      unmount()
      // Release the idempotency flag so a re-apply after this dispose can mount
      // the theme again; leaving it set killed the theme until a hard reload.
      // The build marker goes with it: a disposed page must look un-mounted to
      // the next apply() no matter which build performs it.
      if (typeof window !== 'undefined') {
        window.__dshThemeArknightsApplied = false
        delete window.__dshThemeArknightsBuild
      }
      if (watermarkObserver) watermarkObserver.disconnect()
      /* A deferred observer install may still be waiting on DOMContentLoaded when
         the run ends; drop the pending listener so a disposed run is not wired
         back into the page. removeEventListener is a no-op when it never fired
         or already ran ({ once }), so both branches are safe. */
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('DOMContentLoaded', watermarkObserverLate)
      }
      if (watermarkRaf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(watermarkRaf)
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') window.removeEventListener('resize', onWatermarkResize)
      if (watermarkEl && watermarkEl.parentNode) watermarkEl.parentNode.removeChild(watermarkEl)
      // The plate owns a rAF handle and a fixed DOM node; both must go with the run.
      destroyLoader()
      /* The announcement feature owns two store subscriptions, a retry timeout and
         a hide timeout, all of which outlive the DOM node — unmount() covers the
         switched-off path, but a fiber unload while the theme is ON must release
         them here too, or the callbacks keep firing against a dead run. */
      thunderStopWatch()
      destroyThunder()
      // Same reason as the announcement watcher: a poll that outlives its fiber
      // keeps POSTing against a dead run.
      stopAudioAttentionWatch()
      // Same reason: the capsule owns a 60s balance poll and a fixed DOM node,
      // both of which must go with the run.
      destroyBalanceCapsule()
      disposeSettings()
    })
  }

		exports.name = "dsh-theme-arknights";
		exports.inject = ["theme"];
		exports.apply = apply;
		/* The attention markers are attached by apply() itself (they are declared in
		   its scope) and read by test/audio-attention-watch.test.js, which asserts
		   they stay semantic: a hashed module class would rot on an upstream rebuild
		   and the watcher would just stop matching, with no error anywhere. */
		return module.exports;
	}
});
