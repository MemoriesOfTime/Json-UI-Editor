# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

JsonUI Editor — 一个基于浏览器的 Minecraft Bedrock Edition UI JSON 可视化编辑器。用户通过 File System Access API 加载资源包目录，在画布上拖拽/编辑 UI 元素，最终导出为 Bedrock 格式的 JSON 文件。

**注意**: 需要 Chrome/Edge 86+ 才能使用 File System Access API。

## 常用命令

```bash
npm run dev        # 启动开发服务器 (Vite)
npm run build      # TypeScript 类型检查 + 生产构建 (tsc -b && vite build)
npm run lint       # ESLint 检查
npm run preview    # 预览生产构建
```

## 技术栈

- **框架**: React 19 + TypeScript (strict mode, `verbatimModuleSyntax`, `noUnusedLocals/Parameters`)
- **构建**: Vite 8 + @vitejs/plugin-react
- **样式**: Tailwind CSS 3 (PostCSS + Autoprefixer)
- **状态管理**: Zustand 5 (单 store)
- **拖拽/缩放**: react-rnd
- **图标**: lucide-react

## 架构

```
src/
  main.tsx              # 入口
  App.tsx               # 主应用：三栏布局（左侧边栏 + 画布 + 右侧属性面板）
  index.css             # Tailwind 入口
  components/
    CanvasElement.tsx    # 画布元素：递归渲染、拖拽/缩放/拖入子元素（react-rnd）
    TexturePanel.tsx     # 纹理管理面板：上传/展示/删除纹理
    useTextureLoader.ts  # Hook：将 File 转为 TextureAsset 并存入 store
  lib/
    loadResourcePack.ts  # 加载资源包：读取目录、解析 UI 文件、收集纹理路径、保存
    parseUiJson.ts       # 解析 Bedrock UI JSON → ParsedControl 树（含 @ 继承语法）
  store/
    useStore.ts          # Zustand store：元素树 CRUD、锚点计算、文件草稿管理
```

### 核心数据流

1. **加载**: `loadResourcePack` 读取资源包目录 → `parseUiJson` 将原始 JSON 解析为 `ParsedControl[]` → `parsedControlsToElements` 转为 `UIElement[]` 存入 store
2. **编辑**: 画布上的 `CanvasElement` (react-rnd) 处理拖拽/缩放 → 调用 store 的 `updateElement` → 递归更新树
3. **导出**: `serializeElement` 将 `UIElement` 树转回 Bedrock JSON 格式 → 下载或写回资源包

### 锚点系统

Bedrock UI 使用 `anchor_from` / `anchor_to` 定位，支持 9 个方向点。`applyAnchor` 计算显示位置，`resolveOffsetFromPosition` 从像素坐标反推 offset。所有画布元素通过这两个函数在 anchor 坐标和像素坐标之间转换。

### 元素继承

Bedrock UI 使用 `name@parent` 语法表示继承。`parseControlKey` 解析此语法，`serializeElement` 输出时重建。

### 草稿机制

切换文件时，当前文件的元素树保存在 `drafts` 字典中，重新打开时优先使用草稿（未保存的编辑），否则从解析数据重建。

### 元素树操作

所有元素以树结构存储。`updateElementInTree`、`removeElementFromTree`、`insertElementInTree` 递归操作。`flattenElements` 用于遍历所有层级元素（如计数、名称去重）。

## 编码约定

- 组件使用函数组件 + hooks
- 类型定义集中在 `store/useStore.ts` 和 `lib/parseUiJson.ts`
- 使用 `type` 而非 `interface` 导入（受 `verbatimModuleSyntax` 约束）
- Zustand store 无中间件，直接 `create` + `set`
- 递归组件（`CanvasElement` 渲染子元素、`renderElementTree` 渲染元素列表）
