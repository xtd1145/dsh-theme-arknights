    /* ---- OS 减弱动效偏好 ------------------------------------------------
       被三处共用：输出滚动动画（23-*）、雷霆大字（31-*）的动画门，以及设置页里
       「动画开了但系统要求减弱」时对该行的置灰。定义在这里而不是各自的片段里，
       是因为这三处必须给出同一个答案——半套界面理会系统偏好、另一套不理会，比全
       不理会更难解释。实时读取而不是启动时缓存一次：改完系统设置不需要刷新页面。 */
    const prefersReducedMotion = () => typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
