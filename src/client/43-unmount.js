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
