
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
      },
      lab: {
        deckBrand: 'RHINE',
        deckLabel: 'TRACK<br>SELECT',
        headChannel: 'RHINE <b>//</b> LIBRARY',
        headTitle: '终端工作位置',
        headMeta: 'TERMINAL WORKSPACE POSITION',
        footChannel: 'RHINE <b>//</b> PLAYBACK LEDGER',
        menuChannel: 'RHINE <b>//</b> LIBRARY CONTROL',
        menuTitle: '终端工作位置',
        menuSub: 'TERMINAL WORKSPACE POSITION',
        sectorPrefix: 'TRACK ',
        sectorUnit: ' TRACKS',
        positionUnit: ' TRACKS',
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
       扫描都要确认它仍然紧贴 sectionHeader。 */
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
        '</div>'
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

    /* ---- 工位编号 --------------------------------------------------------
       行内的编号是一个真实 span（不是伪元素），所以可以和原生图标、文字
       一起参与 flex 排版；重渲染后由扫描补回。 */
    const paintWorkspaceRows = (sidebar) => {
      if (sidebar === null) return { count: 0, activeSector: '' }
      /* 空 key 是 DSH 的“未分组”会话桶，不是可部署工作区。 */
      const rows = sidebar.querySelectorAll('[class*="_projectRow"][data-row-key^="workspace:"]:not([data-row-key="workspace:"])')
      const deployed = readDeployedWorkspace()
      let activeSector = ''
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

        const structuralActive = row.className.indexOf('_selected') !== -1
          || row.className.indexOf('folderActive') !== -1
          || row.getAttribute('aria-selected') === 'true'
          || row.getAttribute('aria-current') !== null
          || row.getAttribute('aria-expanded') === 'true'
          || row.getAttribute('data-state') === 'selected'
          || row.querySelector('[class*="_folderActive"]') !== null
        const title = row.querySelector('[class*="_title"]')
        const active = deployed === null
          ? structuralActive
          : deployed !== '' && title !== null && (title.textContent || '').trim() === deployed
        akSetAttr(row, 'data-ak-active', active ? 'true' : 'false')
        if (active && activeSector === '') activeSector = sector
      })
      return { count: rows.length, activeSector }
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
        const sidebar = document.querySelector('[data-slot="sidebar"]')
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
        if (terminalSectorHeadEl !== null) {
          akSetText(terminalSectorHeadEl.querySelector('[data-ak-part="count"]'), terminalPad(rowsState.count) + terminalWords().sectorUnit)
          akSetAttr(terminalSectorHeadEl, 'data-ak-active-sector', rowsState.activeSector === '' ? '01' : rowsState.activeSector)
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
      if (typeof document === 'undefined' || document.body === null) return
      document.querySelectorAll('.ak-terminal-deck, .ak-terminal-sector-head, .ak-sector-code, .ak-deploy-menu__head, .ak-terminal-footer').forEach((node) => {
        if (node.parentNode !== null) node.parentNode.removeChild(node)
      })
      document.querySelectorAll('.ak-deploy-menu').forEach((node) => node.classList.remove('ak-deploy-menu'))
      document.querySelectorAll('[data-ak-tui]').forEach((node) => node.removeAttribute('data-ak-tui'))
      document.querySelectorAll('[data-ak-sector]').forEach((node) => node.removeAttribute('data-ak-sector'))
      document.querySelectorAll('[data-ak-active]').forEach((node) => node.removeAttribute('data-ak-active'))
      document.querySelectorAll('[data-ak-blank]').forEach((node) => node.removeAttribute('data-ak-blank'))
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
