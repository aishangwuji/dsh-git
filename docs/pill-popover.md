# Pill Popover：胶囊触发器 + 悬浮选择面板

这是 Git 面板里仓库/分支/工作区切换器使用的 UI 样式。记录在这里，方便以后在其他插件、面板或页面里复用同一套语言。

## 一句话定义

**胶囊触发器（pill trigger） + 悬浮命令面板（floating command menu）**：触发器是一枚高度 26px 的全圆角胶囊，点开后在下方浮出一张 14px 圆角、带一层细边和投影的卡片，卡片里是分组标题 + 胶囊行，选中行右侧打勾。

它属于 **popover**（浮层选择器）这一类，不是：

- 原生 `<select>`：系统弹层无法样式化，和整体胶囊语言冲突；
- 右键 `ContextMenu`：不依赖指针位置，而是锚定在触发器下方；
- `Dialog`/`Modal`：不抢焦点、不遮罩，点外部即关闭。

## 视觉规格

所有颜色都走 DSH 设计 token，深浅主题自动跟随；括号里是 fallback，仅用于 token 缺失的兜底。

### 触发器

| 属性 | 值 |
|---|---|
| 高度 | 26px |
| 圆角 | `999px`（全圆角胶囊） |
| 内边距 | `0 26px 0 10px`（右侧留给箭头） |
| 背景 | `--dsw-alias-bg-layer-1` |
| 文字 | 11.5px，`--dsw-alias-label-primary`，超长省略 |
| 箭头 | 右侧 9px，6px 高的三角形，`--dsw-alias-label-tertiary` |
| hover | `--dsw-alias-interactive-bg-hover` |
| 展开态 | `--dsw-alias-bg-layer-2` |
| 禁用 | `opacity: .5`，`cursor: default` |

### 面板

| 属性 | 值 |
|---|---|
| 定位 | `position: absolute`，距触发器 6px，默认左对齐；`dshg-menu-end` 改为右对齐 |
| 最小宽度 | 240px |
| 最大宽度 | `min(420px, 82vw)` |
| 最大高度 | 340px，内部滚动 |
| 圆角 | 14px |
| 内边距 | 6px |
| 边框 | 1px `--dsw-alias-border-l1` |
| 背景 | `--dsw-alias-bg-overlay` |
| 阴影 | `--dsw-elevation-panel` |
| 层级 | `z-index: 30`（高于面板内容，低于全局 tooltip 的 10000） |

### 分组标题

`9.5px` / `600` / `uppercase` / `letter-spacing: .04em`，颜色 `--dsw-alias-label-tertiary`，内边距 `6px 8px 3px`。

### 行

| 属性 | 值 |
|---|---|
| 高度 | 最小 28px |
| 圆角 | `999px`（行本身也是胶囊） |
| 内边距 | `0 8px` |
| 字号 | 12px，`gap: 7px` |
| hover / 键盘聚焦 | `--dsw-alias-interactive-bg-hover` |
| 选中 | `--dsw-alias-bg-layer-2` + `font-weight: 600` |
| 勾选图标 | 13px，`--dsw-alias-state-business-primary`，贴右 |
| 右侧提示（`hint`） | 10px，`--dsw-alias-label-tertiary` |
| 禁用行 | `opacity: .45`，不可点 |

### 其他部件

- **筛选框**：26px 高胶囊输入框，`--dsw-alias-bg-layer-1`，1px `--dsw-alias-border-l2`。
- **分组动作**：底部居中的文字按钮（如 `子仓库 4` / `收起`），上方 1px 分隔线，24px 高胶囊，文字用 `--dsw-alias-state-business-primary`。
- **空态 / 错误**：`padding: 8px 10px`，11px，次要色；错误用删除红色。

## 交互与状态

- 点击触发器切换展开；点击外部（`pointerdown` 捕获阶段）关闭；`Esc` 关闭。
- 选择一行：先关闭，再执行动作；当前项（如当前仓库/分支）带勾，且不再触发重复动作。
- 触发器上可带计数徽标（如仓库的更改数）和图标（分支、仓库）。
- 列表可超出高度后滚动；带筛选的变体（分支菜单）把「Tab + 筛选框」固定在顶部，只有列表区滚动；远端列表把当前分支的上游分支排在最前，其余按名称排序。
- 触发器 `aria-haspopup="listbox"`、`aria-expanded`，面板 `role="listbox"`，行 `role="option"` + `aria-selected`。

## 变体

1. **普通列表**：工作区切换。
2. **分组列表 + 底部分组动作**：仓库切换（`项目` / `子仓库` 分组，底部 `子仓库 N` 展开）。
3. **固定头 + 筛选 + 滚动列表**：分支切换（`本地` / `远端` 两个 Tab，列表区固定高度滚动）。
4. **对话框字段 + 筛选列表**：worktree 基线分支（全宽胶囊触发，`BranchFieldMenu` 顶部筛选、列表固定高度滚动；对话框 body 临时取消滚动裁剪，让面板可以浮出卡片）。

## 何时用 / 何时不用

适用：选项较少（约 ≤ 15 条）、需要分组或勾选状态、需要替代原生 `<select>` 且要和胶囊语言一致。

不适用：选项很多且需要搜索 → 用变体 3（带筛选）；需要多选 → 另做多选面板；破坏性动作 → 需要二次确认，不要放在单击即执行的行里。

## 复用清单

复制以下内容即可在另一个插件里复刻（类名前缀 `dshg-` 建议换成目标插件前缀）：

- 组件：`PillSelect`、`MenuItem`（含 `IconCheck` 的使用）、`cx` 小工具；
- CSS：`.dshg-pillselect`、`.dshg-pillselect-trigger`、`.dshg-pillselect-chevron`、`.dshg-pill-label`、`.dshg-pill-strong`、`.dshg-menu*` 整段；
- 依赖：`React.createElement` 包装（本插件里是 `h`）、`t()/tf()` 取文案、`useState/useRef/useCallback/useEffect`；
- token：`--dsw-alias-bg-layer-1/2`、`--dsw-alias-interactive-bg-hover`、`--dsw-alias-border-l1/l2`、`--dsw-alias-bg-overlay`、`--dsw-elevation-panel`、`--dsw-alias-label-primary/tertiary`、`--dsw-alias-state-business-primary`。

## 代码索引

- `PillSelect`：[client.js](../client.js) 第 1317 行附近
- `MenuItem`：第 1299 行附近
- `BranchFieldMenu`：第 1669 行附近
- 分支菜单（固定头 + 滚动列表）：`BranchSwitcher` 与 `.dshg-menu-branch` / `.dshg-menu-list`
- 对话框字段变体：`.dshg-pillselect-field` / `.dshg-menu-field`，由 `CreateWorktreeDialog` 使用
- 分组逻辑（项目 / 子仓库 / 不可用）：`repoGroups` 与 `PanelHeader` 的仓库 `PillSelect`

## 已知限制 / 后续可补

- 目前只支持 `Esc` 和点外部关闭，**没有** `↑`/`↓`/`Home`/`End` 键盘导航与首字母跳转；
- 面板是绝对定位在触发器容器内，超出视口边缘时不会自动翻转（只有 `dshg-menu-end` 手动右对齐）；
- 如果以后在多个插件复用，建议把组件和 CSS 抽到一个共享包里，而不是各自复制。
