# dsh-git 项目说明

`@aishangwuji/dsh-git` 是 DSH 的 Git 工作台面板：工作区状态、变更树、提交图、提交/分支/worktree、fetch/pull/push。本文只记录这个插件自己的结构、约束、命令和技术债；DSH 插件的通用加载模型见工作区根目录的 `AGENTS.md`。

## 1. 结构（0.2.1）

```
index.js                插件入口：inject、apply、HTTP 路由、runOperation 分发
host/                   宿主域模块（全部 ≤600 行）
  core.js               错误/上限/路径与 ref 校验（纯函数）
  git.js                唯一的 argv-only git 入口、可执行文件解析、环境
  state.js              缓存、按仓库写队列、confirm 守卫
  discovery.js          工作区白名单、仓库扫描
  status.js             快照/计数/辅助读/状态页
  history.js            筛选后的提交图、提交详情、diff、分支树
  write.js              stage/commit/checkout/branch/fetch/pull/push/init
  worktrees.js          托管 worktree 布局、列出、增删
  route.js              同源围栏、有界 body 读取、JSON 响应
  runtime.js            apply 绑定的 ctx/logger（跨模块唯一共享状态）
client/                 客户端源码段（拼接成 client.js）
  00-preamble.js        基线 require、NS/RPC_PATH、桥接
  10-i18n.js            zh/en 词典
  20-format.js … 69-commit.js   文案/仓库/paint 缓存/图标/树/分支/对话框/历史/提交
  70-panel.js           GitPanel + GitPanelRoot（剩余最大单段，见技术债）
  75-styles.js          样式表 fetch + adopt + 自检
  80-decorations.js     工作区树状态装饰与 tooltip
  90-apply.js           apply() 与测试接缝
client.js               构建产物（提交进仓库，不要手改）
styles.css              面板样式表，由宿主路由提供
scripts/                build-client.mjs / ssr-check.mjs / panel-render-check.mjs
test/                   host / client / invariants 三个套件
docs/                   first-paint.md（首帧与预热）、pill-popover.md（胶囊弹层规范）
```

数据流：**先画缓存 → 后台校准（SWR）→ 一次 RPC 拿全量**；失败不清缓存，只标 stale。

宿主路由只有一个前缀 `/dsh-git-6b1e`：

- `POST /dsh-git-6b1e/rpc`，body `{ op, ... }`，返回 `{ ok, value }` 或 `{ ok:false, error:{ code, message, detail } }`；
- `GET /dsh-git-6b1e/styles.css`，返回 `text/css`；
- 两个入口都过同源围栏（`Origin` 与 `webServer.getOrigin()` 比对）与工作区白名单（`requireWorkspace`）。

写操作纪律：每个仓库一条 promise 队列（`withRepoLock`），破坏性操作必须带 `confirm: true`，否则 `CONFIRM_REQUIRED`。

## 2. 项目约束（违反会被测试拦下）

| 约束 | 在哪拦 |
|---|---|
| `index.js` < 400 行、每个 `host/*.js` ≤ 600 行 | `test/invariants.test.mjs` |
| 每个 `client/*.js` ≤ 1200 行 | 同上 |
| 宿主只 import `node:*` 与相对路径 | 同上 |
| 每个 `dispatch` 的 op 要么在只读白名单，要么在 `WRITE_OPS` | 同上 |
| 破坏性操作必须 `requireConfirm` | 同上 |
| `zh` / `en` 词典键完全一致；`t('字面量')` 的键都存在 | 同上 |
| 提交的 `client.js` 必须等于 `client/` 的构建结果 | `npm run check:client`（CI 也跑） |

**规则即测试**：要改这些规则，先改 `test/invariants.test.mjs` 里的断言，再改代码，不要绕。

## 3. 日常命令

```powershell
npm test              # host + client + invariants 三个套件
npm run check:render  # 冷启动骨架屏 + 有数据面板的两个渲染自检
npm run build:client  # 重新生成 client.js（改 client/*.js 之后必须跑）
npm run check:client  # 校验 client.js 与源码一致（CI 也用这条）
npm run check         # 上面全部（发版前必跑）
```

渲染自检会从 `C:\Users\15216\.dsh\profiles\desktop\package.json` 解析 React（解析不到时自动跳过）。宿主测试需要 `git` 在 `PATH` 上，会在临时目录造一个包含嵌套仓库 / 忽略目录 / worktree / bare 仓库的 fixture。

## 4. 这个项目踩过的坑

1. **“面板没样式 = CSP 拦截 / shadow root / adoptedStyleSheets 不支持”**
   事实：样式规则原本以 60KB 模板字面量放在客户端产物里，到达页面时内容被清空（面板自检量到 `style=3 adopted=1 sheet=0`，而磁盘文件里有 386 条规则）。
   对策：CSS 独立成 `styles.css`，由宿主路由提供，客户端 `fetch` → `new CSSStyleSheet().replaceSync()` → `adoptedStyleSheets`，`<link rel="stylesheet">` 兜底。不要再把大段 CSS 塞回客户端产物。

2. **“面板自检那条橙色横条是 bug”**
   事实：它是永久性自检（正常永不出现）。出现时读它打印的 `status/css/rules/adopted/err`：`err=HTTP 405` 表示宿主没重启；`css=0` 表示样式表没取到；`rules=0` 表示构造式样式表为空。

3. **“刷新页面就能加载新宿主”**
   事实：不能。宿主只在 profile 装载时读一次；`client.js` 才是刷新即生效。改 `index.js` / `host/*` / `styles.css` 路由 / `cordis.patch.yml` 后必须重启 DSH，或在插件页把本 bundle 关掉再打开。

## 5. 技术债

1. `client/70-panel.js` 1041 行：`GitPanel` 仍是单组件。拆法是把子渲染（头部 / 更改 / 历史 / 提交栏）提成独立组件并传 props，属于有风险的改动，已有 1200 行上限作棘轮。
2. 只在 `main` 座位渲染面板，`sidebar.panellist` 只是入口图标；没有 docked 侧栏面板体。
3. e2e 仍是“离线渲染自检 + 路由级测试”，没有真实浏览器端到端。

## 6. 仓库与发布

- GitHub：`aishangwuji/dsh-git`（public，`main`）
- npm：`@aishangwuji/dsh-git`
- 发布：`npm publish --access public --registry=https://registry.npmjs.org`；通用 npm/2FA/GitHub Release 流程见 `D:\Projects\dsh\AGENTS.md` §5。
- 本机 profile 里是 `link:D:/Projects/dsh/dsh-git`（开发用）；改宿主代码后仍需重启 DSH。


