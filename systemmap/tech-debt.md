---
scope: dsh-git
covered_paths:
  - dsh-git/index.js
  - dsh-git/client/
  - dsh-git/test/
last_verified_commit: 363c07b
verified_at: 2026-11-20
status: current
note: 技术债/未接入模块的持久记录；AGENTS.md 只保留边界、结构、约束、命令、坑、仓库状态。
---

# dsh-git 技术债与未决项

## 已知问题

### `GitPanel` 仍是单组件

`client/70-panel.js` 1041 行，`GitPanel` 把头部 / 更改 / 历史 / 提交栏都放在一个组件里。拆法是把子渲染提成独立组件并传 props；属于有风险的改动，已有 1200 行上限作棘轮。

### 没有 docked 侧栏面板体

只在 `main` 座位渲染面板，`sidebar.panellist` 只是入口图标；没有 docked 侧栏面板体。

### e2e 仍是离线自检

目前是“离线渲染自检 + 路由级测试”，没有真实浏览器端到端。

## 未接入模块 / 待评估

无。

## 处理约定

新增技术债写本文件，并在 `AGENTS.md` §2 只保留一句指针；状态变化时更新本文件，不要回写 AGENTS。
