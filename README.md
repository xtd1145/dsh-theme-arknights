# dsh-theme-arknights

三套《明日方舟》阵营风格的 DSH Web 主题 —— **罗德岛**、**拉特兰**、**莱茵生命**。它不只替换颜色：进阶版把整个界面重排成一台作战终端，工作区列表就是**「终端作战位置」**，空状态的部署选择器、工作区菜单、输入区和顶栏都接入同一套 HUD 语言。

功能面（等高线背景、启动加载板、雷霆大字、余额胶囊、音频通知、输出滚动动画…）与 [dsh-theme-endfield](https://github.com/ymh0000123/dsh-theme-endfield) 对齐；视觉层、三阵营系统与终端界面层是本项目重写的。

- **Client 侧**（`client.js`）：令牌映射、三套阵营样式表、终端 DOM 层、快速切换器、设置页、全部视觉效果。
- **Host 侧**（`index.js`）：偏好持久化（DSH 设置表单 + profile 落盘）与音频通知播放。

| 罗德岛·亮色 | 拉特兰·亮色 | 莱茵生命·亮色 |
| --- | --- | --- |
| ![罗德岛·亮色](docs/screenshots/rhodes-light.png) | ![拉特兰·亮色](docs/screenshots/laterano-light.png) | ![莱茵生命·亮色](docs/screenshots/rhine-light.png) |

以上均为真实 DSH 页面截图：侧栏扇区 12（`ds`）是当前选中工作区，空状态选择器、页脚与铭牌读同一个扇区号。

## 两档界面版本

设置里的 **界面版本** 一个开关切换。两档共用同一套令牌与三套配色，区别在于是否重排布局：

| 版本 | 做什么 | 适用 |
| --- | --- | --- |
| **进阶版**（默认） | 重排整体 UI：PRTS 铭牌、终端作战位置、扇区编号、部署选择面板、菜单抬头、任务简报输入区、顶栏频道、作战记录页脚、切角与 HUD 标注、三套阵营氛围层 | 想要完整明日方舟观感 |
| **通用适配** | 只换配色、标题字族、圆角与细节，界面骨架与应用原生完全一致 | 保守 / 上游改版后临时退避 |

进阶版的全部规则**只加装饰、不改布局骨架**：CSS 选择器失配时最坏结果是少一处装饰，不会破版。终端 DOM 层也只做标注与少量装饰节点，关闭主题或切到通用适配时会把注入节点、观察器和原生节点上的属性全部收回。

## 终端作战位置

这是进阶版的核心结构，也是「工作区选择」在明日方舟语境里的落点：

- 侧栏工作区列表上方是一块 **PRTS // DEPLOYMENT** 抬头，标题为「终端作战位置」，右侧显示实时扇区总数；列表每一行前面有 `01`、`02`… 的作战位置编号。DSH 的「未分组」会话桶不是工作区，不参与编号与计数。
- 当前真正被部署的工作区**整行填充强调色**并切角，扇区号、图标、标题同步反白。判定依据是空状态工作区选择器上显示的名字，而不是目录的展开状态——展开一个目录不等于部署了它。
- 空状态的工作区选择器被包进一块 **「终端作战位置 // TERMINAL DEPLOYMENT POSITION」** 面板，右上角读 `SECTOR xx // READY`；打开工作区菜单时，菜单顶部出现 **PRTS // DEPLOYMENT CONTROL**，列出 `xx POSITIONS`，每一项同样带扇区编号与选中态。
- 进入对话后，页脚收回、空状态部署面板消失，但侧栏的作战位置与顶栏频道仍在；对话页没有 hero 可读时，选中态回退到应用自身的结构信号，不会把当前会话对应的目录弄丢。
- 底部有一条只在空状态出现的 **PRTS // OPERATIONS LEDGER** 页脚，显示当前扇区、频道与链路状态。

![工作区菜单：部署控制面板](docs/screenshots/rhodes-menu.png)

## 三套阵营

三套的设计依据是三个二创/官方风格的参考（逐帧看过）：

| 阵营 | 参考 | 纸面（亮 / 暗） | 强调色（亮 / 暗） | 标题字族 | 氛围纹理 |
| --- | --- | --- | --- | --- | --- |
| **罗德岛**（默认） | [罗德岛个人通讯终端](https://www.bilibili.com/video/BV1JS4y1q7xJ) | 冷白 `#f2f4f6` / 近黑 `#08090a` | `#1a6fa8` / `#4fb3e8` | Barlow Condensed 窄字重无衬线 | 轨道圆环 + 节点拓扑 + 通讯弧线 + 精密网格 |
| **拉特兰** | [拉特兰数理风 PPT](https://www.bilibili.com/video/BV1B5GdzeE46) | 冷灰蓝图纸 `#eceef2` / 深蓝黑 `#0b0d12` | 皇家蓝 `#1a3fd0` / `#6b8cff` | Cormorant Garamond 衬线 | 浅蓝图纸 + 同心圆 + 坐标刻度 + 斜切碎片 |
| **莱茵生命** | [莱茵生命主题 PPT](https://www.bilibili.com/video/BV19Z4y187gi) | 暖白 `#f6f5f3` / 纯黑 `#0a0a0b` | 黑白 `#1a1a1c` / `#ececee`，信号橙 `#c9701a` / `#e8862a` | Inter 宽松字距无衬线 | 单色 ∞ 结构 + X 对角线 + 十字准星 + 极细分度 |

三套都**换的不只是颜色**：纹理几何、标题字族、字距、光晕强度、状态灯颜色、侧栏字标（`R.I. / 01`、`LTR / 02`、`R.L / 03`）与频道名（`CH 121.5` / `144.0` / `88.6`）都各自一套。版式骨架共用，所以切换时页面不跳动。

两点和直觉相反、但按参考纠正过来的地方：

- **拉特兰不是暖金圣城**，而是「理律与几何」：冷灰蓝图纸 + 饱和皇家蓝 + 圆形辅助线。它的参考明确是数理风。
- **莱茵生命不是荧光青绿**，而是**几乎无彩色**：黑白灰两个极端 + 宽松字距 + 十字准星，只留一点橙色（`--edge-signal`）作状态点缀。

| 罗德岛·暗色 | 拉特兰·暗色 | 莱茵生命·暗色 |
| --- | --- | --- |
| ![罗德岛·暗色](docs/screenshots/rhodes-dark.png) | ![拉特兰·暗色](docs/screenshots/laterano-dark.png) | ![莱茵生命·暗色](docs/screenshots/rhine-dark.png) |

背景纹理的写法是 **SVG 遮罩**：data URI 里只有形状（`mask-image`，只取 alpha），颜色来自 `background-color: var(--edge-accent)`。同一张形状在暗色下用 `screen`、亮色下用 `multiply`，所以三套阵营 × 明暗共用 3 份遮罩，不需要 6 张图，也没有下载任何位图素材。

## 快速切换：三个入口

| 入口 | 操作 |
| --- | --- |
| **设置页**：设置 › 明日方舟阵营主题 | 阵营行三个徽标按钮（底色是各自阵营的强调色），另有界面版本开关 |
| **悬浮阵营条**：右上角常驻胶囊 | 点当前徽标展开三选 |
| **键盘** | `Ctrl/Cmd+Shift+1` / `2` / `3` 直选，`Ctrl/Cmd+Shift+K` 循环 |

三者写同一个偏好字段，所以任何一处切换都同步其余两处。键盘用 `Shift` 组合是为了不抢浏览器自己的 `Ctrl+1..9` 切标签页。

## 功能

开关集中在 **设置 › 明日方舟阵营主题**，共 36 个字段：

| 组 | 功能 |
| --- | --- |
| **01 主题** | 总开关、阵营（三选）、界面版本（两选）、圆角模式、磨砂玻璃 |
| **02 背景** | 等高线背景（标量场真等值线，marching squares 提取）、动态等高线、鼠标轨迹变形、绘制后端（Canvas / Worker / WebGL）、帧率 24/60/120、速度 1x/2x/4x、滚动暂停、背景水印、水印保持显示 |
| **03 动画** | 输出滚动动画（把流式输出的整段跳变摊成逐帧滑动，不改应用滚动位置）、动画强度、启动加载动画 |
| **04 娱乐** | 雷霆大字（任务开始/完成，3 秒自动消失，点击即关）、大字入场动画、顶部余额胶囊（DeepSeek 峰谷时段 / 渠道额度）、渠道额度读数、胶囊位置与防遮挡 |
| **05 音频** | 音频通知总开关（**默认关**，opt-in）、启动/开始/结束/需要回应/出错四个槽位、音量、防抖间隔、自定义音效目录、诊断日志 |

音频由**宿主进程**播放而不是浏览器：页面最小化、切到别的应用时同样能听到——那恰好是最需要提示的场合。

进阶版终端层没有单独的开关，跟随「界面版本」。除了这些开关，还有一批随主题自动生效的可读性修正（审批弹窗重绘为全屏白条、按钮对比度、预览徽标、顶栏模式胶囊、回合状态标签着色等），详见 [docs/design-language.md](docs/design-language.md)。

## 安装

```bash
dsh plugin --profile web add github:xtd1145/dsh-theme-arknights
```

重启或重新加载 `web` profile 后生效。

> **与 dsh-theme-endfield 互斥**：两套主题同时挂载会互相覆盖令牌层与样式表，视觉会混搭。请只启用其中一个。

### 手动安装（复制到 profile）

在 `<profile>/cordis.patch.yml` 追加一行（`id` 必须与 `index.js` 的 `SETTINGS_ENTRY`、`client.js` 的 `PREFS_ENTRY` 一致，`check.js` 会校验这三处）：

```yaml
- id: theme-arknights
  name: dsh-theme-arknights
```

> **必须复制整份目录，不能漏 `lib/`。** host 半在顶层 `require('./lib/audio.js')`，缺了它 DSH 只会
> 打印一行 `theme-arknights (dsh-theme-arknights): failed to import`，界面上表现为「主题没生效」，
> 很容易误判成样式问题。
>
> 特别注意：PowerShell 的 `Copy-Item -Path 'src\*' -Destination dest -Recurse -Exclude @('node_modules')`
> **会静默漏掉部分顶层目录**（实测漏了 `lib/`、`scripts/`、`sounds/`、`src/`，而 `locale/`、`docs/` 却复制过去了）。
> 用 robocopy 更可靠，装完顺手验一下 host 半能否加载：
>
> ```powershell
> robocopy <repo> <profile>\node_modules\dsh-theme-arknights /E /XD node_modules .git
> node -e "console.log(require('<profile>/node_modules/dsh-theme-arknights').Config !== undefined)"
> ```

### 更新插件文件时的加载时机

| 改动 | 生效方式 |
| --- | --- |
| Client 半 `client.js` | Host 按请求从磁盘读取，浏览器刷新即可 |
| Host 半 `index.js` | 只在 profile 启动时 import 一次，**必须整进程重启 DSH** |

### 设置总是「刷新后复位」

先看 Host 侧有没有这份 `Config`（`require('./index.js').Config` 不是 `undefined`）。没有 Config 时 DSH 不投影表单，所有开关只在页面内生效。排查顺序：

1. `index.js` 是否导出 `Config`，且 36 个字段是否都带 `.volatile()`
2. Host 日志里有没有 `Config built from …（volatile mode: native/synthesized）`
3. 设置页是否出现（没有 slots 服务时会安静跳过，但悬浮条与快捷键仍可用）

## 开发与验证

```bash
node scripts/build.js        # 由 src/ 拼出 index.js + client.js
npm run check                # 产物是否过期 + 静态契约校验（29 项）
npm test                     # 构建校验 + 契约 + 对比度（92 项断言）
npm run shots                # 用 fixture 页面截三套阵营（需本机 Edge/Chrome）
npm run verify -- <url>      # 在**真实 dsh web 页面**上验证并截图
```

| 验证 | 覆盖什么 |
| --- | --- |
| `check.js` | 两侧字段表逐字段一致、六组阵营变量完整、被引用的 `--edge-*` 全部有归属、**选择器锚点必须是应用里真实存在的 localName**、命名空间三处一致、样式表可安全嵌入模板字面量 |
| `test/palette-contrast.test.js` | 六组配色 × 每个角色的 WCAG 对比度（正文 AAA、其余 AA、装饰另有一套区间） |
| `test/shoot.js` | 在浏览器里注入 client.js 到 fixture，逐个阵营截图并断言 class 翻转、`--edge-accent` 解析、令牌层是否跟着阵营走、悬浮条三选 |
| `test/verify-real.js` | 打开**真实的 dsh web 页面**（插件由 DSH 自己挂载），断言：`/plugins/dsh-theme-arknights/client.js` 进入 combo、样式表注入、body class、强调色、令牌层、悬浮条；再逐个阵营派发 `Ctrl+Shift+1/2/3` 并截图 |

### 关于「锚点必须是真实 localName」

这一条检查是踩出来的：进阶版第一版用了 `_transcript` / `_bubble` / `_role` /
`_sectionTitle` / `_groupLabel` / `_primaryButton` 这些**应用里并不存在**的类名
（还把输入区的 class 误写成了 `data-composer-seat` 属性）。它们不会报错，只是规则
永不命中——界面上表现为「装饰没生效」，肉眼查不出来。

`check.js` 现在用 dsh-theme-endfield 在同一版 DSH 上验证过的 localName 做白名单
（`_frame` / `_header` / `_centerCol` / `_sidebarCol` / `_rightbarCol` /
`_composerSeat` / `_card` / `_sessionRow` …），写了白名单外的名字直接构建失败。

## 项目结构

```text
src/client/        Client 侧源码片段（拼接顺序见 src/client/manifest.js）
  36-terminal-ui.js        进阶版终端 DOM 层（铭牌/作战位置/页脚/菜单抬头）
src/host/          Host 侧源码片段（拼接顺序见 src/host/manifest.js）
src/styles/theme.css     功能样式（等高线、玻璃、加载屏、大字、胶囊、审批弹窗重绘…）
src/styles/faction.css   三阵营变量组 + 明日方舟氛围层 + 进阶版终端排版层
src/contour-worker.js / contour-webgl.js   等高线的可选渲染后端
client.js / index.js      发布产物，由 scripts/build.js 拼出（不要直接编辑）
lib/               音频通知：槽位定义、WAV 合成与播放运行时
sounds/            生成的通知音
scripts/           构建：lib/bundle.js 拼接器 + 各入口
test/              对比度测试、浏览器截图验证、fixture
docs/              设计文档与截图
cordis.patch.yml   Bundle 注入配置
```

## 技术要点

**换阵营只是一个 class 翻转。** 令牌层（`41-mount-tokens.js`）把每个 `--dsw-alias-*` 覆盖成 `var(--edge-*)`，而 `--edge-*` 的六组取值（3 阵营 × 明暗）声明在 `faction.css` 的 `<body>` 规则里。因为应用是把令牌写成 `<body>` 行内样式的，行内 `var()` 会引用同元素上由样式表声明的自定义属性——于是切阵营不重新注册令牌层、不重算应用样式、无 JS 重绘。

**终端层是幂等的 DOM 标注。** 工作区菜单是 portaled 的，侧栏会被应用反复重渲染，工作区数量与选中项都是运行时数据，伪元素拿不到。`36-terminal-ui.js` 只观察会改变终端结构的区域（侧栏、空状态输入区、打开中的菜单），排除流式消息 DOM；所有扫描可重复执行，节点带 `data-ak-tui` 标记，关主题或切通用适配时全部收回。铭牌、抬头、菜单抬头只更新文本与属性，不重建节点。

**「已部署」不是「已展开」。** 侧栏行的 `aria-expanded` 只代表目录展开；直接拿它当选中态，会把刚展开的目录画成已部署。选中态以空状态选择器显示的**工作区名**与行标题比对为准；对话页没有空状态时，才回退到应用自身的选中信号。

**背景全部由代码生成。** 三张 SVG 遮罩只提供 alpha 形状，颜色读 `--edge-accent`；点阵、光晕与纸张颗粒由 CSS 渐变 / 内联噪声 SVG 承担。切阵营、切明暗、改强调色都会自动跟随，没有外部位图，也不需要为 6 种组合准备 6 份素材。

**大量边界处理**：等高线在关闭时零逐帧开销、输出滚动动画不改 `scrollTop`（跟随不中断）、加载板的双时钟驱动与硬性保险丝、大字用捕获阶段 `pointerdown` 关掉（不吃掉用户真正想点的那一下）、所有动效尊重 `prefers-reduced-motion`。

## 素材归属

本插件是**非官方同人作品**，与鹰角网络（Hypergryph）不存在任何隶属、赞助或背书关系。

- 《明日方舟》（Arknights）的游戏名称、阵营设定、标识、商标及相关美术素材，版权归**鹰角网络（上海鹰角网络科技有限公司，Hypergryph Network Technology）**所有。
- 本仓库**不包含任何游戏原始素材，也没有下载外部背景图片**：三套阵营的配色、纹理、字标与终端界面都是按阵营性格重新绘制的 CSS / 内联 SVG。
- 视觉参考：[罗德岛个人通讯终端](https://www.bilibili.com/video/BV1JS4y1q7xJ)、[拉特兰数理风 PPT](https://www.bilibili.com/video/BV1B5GdzeE46)、[莱茵生命主题 PPT](https://www.bilibili.com/video/BV19Z4y187gi)。
- 功能实现参考了 [dsh-theme-endfield](https://github.com/ymh0000123/dsh-theme-endfield)（MIT），视觉层为本项目重写。
- 本项目原创代码以 MIT 许可证发布。若权利方认为任何内容使用不当，请通过 Issue 联系，会立即删除或替换。

## 许可证

MIT，仅覆盖本项目的原创代码；第三方素材的归属见[素材归属](#素材归属)。
