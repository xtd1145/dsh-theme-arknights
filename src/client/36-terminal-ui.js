
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
      return { count: rows.length, activeSector, plateName, field, activeRow, openGroup }
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
        paintSessionBlocks(sidebar, rowsState)
        /* 铭牌：参考的柜面把当前档案的名字钉在一块黑底小牌上，这块牌比 36px 的
           板子宽得多，所以它钉在抬头里、柜面正上方，而不是钉在某一块板上。 */
        if (terminalSectorHeadEl !== null) {
          const active = rowsState.activeSector === '' ? '01' : rowsState.activeSector
          akSetText(terminalSectorHeadEl.querySelector('[data-ak-part="count"]'), terminalPad(rowsState.count) + terminalWords().sectorUnit)
          akSetAttr(terminalSectorHeadEl, 'data-ak-active-sector', active)
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
      terminalTipEl = null
      if (typeof document === 'undefined' || document.body === null) return
      document.querySelectorAll('.ak-terminal-deck, .ak-terminal-sector-head, .ak-sector-code, .ak-sector-tip, .ak-deploy-menu__head, .ak-terminal-footer').forEach((node) => {
        if (node.parentNode !== null) node.parentNode.removeChild(node)
      })
      document.querySelectorAll('.ak-deploy-menu').forEach((node) => node.classList.remove('ak-deploy-menu'))
      document.querySelectorAll('[data-ak-tui]').forEach((node) => node.removeAttribute('data-ak-tui'))
      document.querySelectorAll('[data-ak-clicks]').forEach((node) => node.removeAttribute('data-ak-clicks'))
      /* 柜列与方块的计数写在 data 属性上（样式表用 attr() 读出来当读数），
         它们同样是运行时标注，卸装时必须一并收回。 */
      for (const name of ['data-ak-sector', 'data-ak-active', 'data-ak-blank',
        'data-ak-name', 'data-ak-block', 'data-ak-blocks', 'data-ak-columns',
        'data-ak-active-block', 'data-ak-active-column']) {
        document.querySelectorAll('[' + name + ']').forEach((node) => node.removeAttribute(name))
      }
      /* 刻度尺定位用的数字通道写在行内样式里，也要收回。 */
      for (const name of ['--ak-col', '--ak-cols', '--ak-blk', '--ak-blks']) {
        document.querySelectorAll('[style*="' + name + '"]').forEach((node) => node.style.removeProperty(name))
      }
    }

    const syncTerminalUI = () => {
      if (!isEnabled() || !isTerminalLayout()) {
        destroyTerminalUI()
        return
      }
      bindTerminalObserver()
      paintTerminalUI()
    }

    /* setFaction() 的即时重绘钩子（在 35-faction-bar 里声明并调用）。
       阵营 class 翻转后样式表已经换色，这里只需把铭牌/菜单抬头的字标
       改掉；不重建节点。 */
    akTerminalRepaint = paintTerminalUI
