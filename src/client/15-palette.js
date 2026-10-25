
    /* ---------- 三阵营 + 界面版本 ------------------------------------------
       阵营与界面版本各自只是 <body> 上的一组 class；样式表按这些 class 定义
       全部变量，所以切换是纯 class 翻转：不重新注册令牌层、不重算样式、无 JS
       重绘。这与配色切换是同一条机制，只是从两套扩到三套，并多了一个维度。

       - 阵营（faction）  rhodes（默认，不带 class）/ laterano / rhine
       - 界面版本（layout）universal（通用适配）/ advanced（进阶版，重排 UI）

       'rhodes' 是默认，所以未设置与任何无法识别的值都回落到它——一份坏掉的
       持久化文档不会让界面停在「无阵营」的半吊子状态。

       唯一的例外仍是等高线画布（canvas 描边不能是 CSS 变量），它改为**读
       --edge-accent 的实时值**再自行加 alpha，因此三套阵营（以及未来任何新增
       配色）都自动跟随，不必在这里再列举一遍颜色。 */
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
       universal 与 advanced 共用同一套令牌与配色（见样式表），差别只在是否
       重排应用的整体布局。默认 advanced —— 这一版就是「本主题不只是换颜色」
       的地方；想要保守外观的用户随时切回 universal。 */
    const LAYOUT_KEY = 'dsh-theme-arknights-layout'
    const LAYOUT_ADVANCED_CLASS = 'theme-arknights-advanced'
    const readLayout = () => (prefsGet(LAYOUT_KEY) === 'universal' ? 'universal' : 'advanced')

    const syncLayoutClass = () => {
      if (typeof document === 'undefined' || document.body === null) return
      if (isEnabled() && readLayout() === 'advanced') document.body.classList.add(LAYOUT_ADVANCED_CLASS)
      else document.body.classList.remove(LAYOUT_ADVANCED_CLASS)
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

    /* ---- 兼容名 ----------------------------------------------------------
       下面这几个名字是 20-contour.js / 43-unmount.js 仍在引用的旧接口。保留它们
       比在多个文件里改名字安全：两套阵营时代的调用点都指向同一件事。 */
    const PALETTE_CLASS = FACTION_CLASS.rhine
    const syncPaletteClass = syncFactionClass
    const isWulingPalette = () => isFaction('rhine')
