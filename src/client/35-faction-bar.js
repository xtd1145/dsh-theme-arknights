
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

    /* 阵营元数据。`accent` 里的颜色只给悬浮条与设置页卡片的色块用，不参与实际
       渲染——真正生效的颜色全部在样式表的六组 --edge-* 规则里，所以「选之前看到
       的」与「选之后得到的」来自同一份设计。 */
    const FACTION_META = [
      {
        id: 'rhodes',
        badge: 'R.I.',
        nav: { zh: '罗德岛', en: 'Rhodes Island' },
        hint: { zh: '舰船指挥 · 冷蓝网格', en: 'Ship command · cold blue mesh' },
        accent: { light: '#0f6bb0', dark: '#4aa8e8' },
        keys: '1',
      },
      {
        id: 'laterano',
        badge: 'LTR',
        nav: { zh: '拉特兰', en: 'Laterano' },
        hint: { zh: '圣城 · 暖金圣光', en: 'Holy city · warm gold light' },
        accent: { light: '#886812', dark: '#e8c168' },
        keys: '2',
      },
      {
        id: 'rhine',
        badge: 'R.L',
        nav: { zh: '莱茵生命', en: 'Rhine Lab' },
        hint: { zh: '实验室 · 荧光青绿', en: 'Laboratory · fluorescent teal' },
        accent: { light: '#00795c', dark: '#00d9a3' },
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
    let factionBarOpen = true
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

      const badge = document.createElement('span')
      badge.className = 'ak-bar__badge'
      const label = document.createElement('span')
      label.className = 'ak-bar__label'
      const caret = document.createElement('span')
      caret.className = 'ak-bar__caret'
      caret.textContent = '\u25be'
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

        const swatch = document.createElement('span')
        swatch.className = 'ak-bar__swatch'
        swatch.setAttribute('data-accent-light', meta.accent.light)
        swatch.setAttribute('data-accent-dark', meta.accent.dark)
        const text = document.createElement('span')
        text.className = 'ak-bar__badge'
        text.textContent = meta.badge

        item.appendChild(swatch)
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

      const badge = factionBarRoot.querySelector('.ak-bar__badge')
      const label = factionBarRoot.querySelector('.ak-bar__label')
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
