
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
         lands on top of the contour sheet a couple of RGB steps away from the page
         colour — a panel that is technically painted and visually absent.

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
