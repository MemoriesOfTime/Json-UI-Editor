# Json UI Editor

**在线使用**: <https://jsonui.mot.dev/>

一个基于浏览器的 **Minecraft Bedrock Edition** UI JSON 可视化编辑器。通过 File System Access API 加载资源包目录，在画布上以所见即所得的方式拖拽、编辑 UI 元素，最终导出为 Bedrock 格式的 JSON 文件。

> **浏览器要求**: Chrome / Edge 86+（依赖 File System Access API）

## 功能特性

- **资源包加载** — 直接读取本地资源包目录，自动解析 UI JSON 文件与纹理资源
- **可视化编辑** — 画布上拖拽/缩放控件，实时调整位置、尺寸、锚点与各类属性
- **元素树管理** — 层级化树状视图，支持添加、删除、嵌套容器元素
- **纹理管理** — 上传/展示/删除纹理贴图，支持 UV 裁切渲染
- **Bedrock 锚点系统** — 完整支持 `anchor_from` / `anchor_to` 九方向锚点定位
- **元素继承** — 解析 `name@parent` 继承语法，导出时自动重建
- **草稿机制** — 切换文件时自动保存未提交的编辑，重新打开时优先恢复草稿
- **导出与保存** — 序列化为 Bedrock UI JSON 格式，支持下载或直接写回资源包
- **国际化** — 支持中文 / 英文切换
- **主题切换** — 亮色 / 暗色模式，Minecraft 风格 / OreUI 风格可切换

## 技术栈

| 类别    | 技术                                      |
| ----- | --------------------------------------- |
| 框架    | React 19 + TypeScript (strict mode)     |
| 构建    | Vite 8 + @vitejs/plugin-react           |
| 样式    | Tailwind CSS 3 (PostCSS + Autoprefixer) |
| 状态管理  | Zustand 5                               |
| 拖拽/缩放 | react-rnd                               |
| 图标    | lucide-react                            |

## 快速开始

### 环境要求

- Node.js 18+
- Chrome / Edge 86+

### 安装与开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview

# ESLint 检查
npm run lint

# 运行测试
npm run test
```

## 项目结构

```
src/
├── main.tsx                    # 入口
├── App.tsx                     # 主应用：三栏布局（左侧边栏 + 画布 + 右侧属性面板）
├── index.css                   # Tailwind 入口 & 主题样式
├── components/
│   ├── CanvasElement.tsx       # 画布元素：递归渲染、拖拽/缩放/拖入子元素
│   ├── ElementTreeNode.tsx     # 元素树节点组件
│   ├── SidebarSection.tsx      # 侧边栏分区组件
│   ├── TexturePanel.tsx        # 纹理管理面板：上传/展示/删除纹理
│   └── useTextureLoader.ts     # Hook：将 File 转为 TextureAsset 并存入 store
├── lib/
│   ├── i18n.ts                 # 国际化：中/英文字典与翻译函数
│   ├── locales/
│   │   ├── en.ts               # 英文字典
│   │   └── zh.ts               # 中文字典
│   ├── labelRendering.ts       # 标签渲染工具
│   ├── loadResourcePack.ts     # 加载资源包：读取目录、解析 UI 文件、收集纹理、保存
│   ├── parseUiJson.ts          # 解析 Bedrock UI JSON → ParsedControl 树（含 @ 继承）
│   ├── serializeUiFile.ts      # 将 UIElement 树序列化为 Bedrock JSON 格式
│   ├── texturePath.ts          # 纹理路径处理
│   └── theme.ts                # 主题/风格切换管理
└── store/
    └── useStore.ts             # Zustand store：元素树 CRUD、锚点计算、文件草稿管理
```

## 核心数据流

```
资源包目录 ──→ loadResourcePack ──→ parseUiJson ──→ parsedControlsToElements ──→ Store
                                                                          │
                                                                    CanvasElement
                                                                     (拖拽/缩放)
                                                                          │
                                                                    updateElement
                                                                          │
Store ──→ serializeUiFile ──→ Bedrock UI JSON ──→ 下载 / 写回资源包
```

1. **加载**: `loadResourcePack` 读取资源包目录 → `parseUiJson` 将原始 JSON 解析为 `ParsedControl[]` → `parsedControlsToElements` 转为 `UIElement[]` 存入 store
2. **编辑**: 画布上的 `CanvasElement` (react-rnd) 处理拖拽/缩放 → 调用 store 的 `updateElement` → 递归更新树
3. **导出**: `serializeUiFile` 将 `UIElement` 树转回 Bedrock JSON 格式 → 下载或写回资源包

## 架构设计

### 锚点系统

Bedrock UI 使用 `anchor_from` / `anchor_to` 定位，支持 9 个方向点。`applyAnchor` 计算显示位置，`resolveOffsetFromPosition` 从像素坐标反推 offset。所有画布元素通过这两个函数在 anchor 坐标和像素坐标之间转换。

### 元素继承

Bedrock UI 使用 `name@parent` 语法表示继承。`parseControlKey` 解析此语法，`serializeElement` 输出时重建。

### 草稿机制

切换文件时，当前文件的元素树保存在 `drafts` 字典中，重新打开时优先使用草稿（未保存的编辑），否则从解析数据重建。

### 支持的元素类型

`panel` · `image` · `label` · `collection_panel` · `chest_grid_item` · `factory` · `grid` · `button` · `toggle` · `dropdown` · `slider` · `slider_box` · `edit_box` · `input_panel` · `stack_panel`
