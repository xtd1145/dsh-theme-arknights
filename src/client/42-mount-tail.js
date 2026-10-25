    `)
      syncRadiusMode()
      syncGlass()
      syncPaletteClass()
      syncLayoutClass()
      syncFactionBar()
      /* 终端铭牌与作战位置标记：DOM 还没渲染时是一次空操作，随后的
         MutationObserver 会在应用挂载侧栏/输入区时补画。 */
      syncTerminalUI()
    }
