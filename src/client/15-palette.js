
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
