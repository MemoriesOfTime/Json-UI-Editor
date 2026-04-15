export const zh: Record<string, string> = {
  // 应用
  'app.title': 'Json UI Editor',

  // 按钮
  'btn.openResourcePack': '打开资源包',
  'btn.loading': '加载中...',
  'btn.save': '保存',
  'btn.saving': '保存中...',
  'btn.export': '导出',
  'btn.preview': '预览',
  'btn.close': '关闭',
  'btn.copyToClipboard': '复制到剪贴板',
  'btn.toggleRightSidebar': '切换右侧属性栏',

  // 侧边栏
  'sidebar.uiFiles': 'UI 文件',
  'sidebar.components': '组件',
  'sidebar.target': '目标: {label}',
  'sidebar.elements': '元素 ({count})',
  'sidebar.rootCanvas': '根画布',
  'sidebar.dragHint':
    '点击会添加到当前选中容器；拖到画布或某个容器，可按落点创建。',
  'sidebar.openHint': '打开资源包以开始使用',
  'sidebar.openHintSub':
    '点击左侧按钮加载资源包后，即可从组件库拖拽新增控件',

  // 属性面板
  'props.title': '属性',
  'props.selectHint': '选择一个元素进行编辑',
  'props.selected': '已选中',
  'props.name': '名称 (ID)',
  'props.type': '类型',
  'props.inheritsFrom': '继承自',
  'props.anchorFrom': '锚点起点',
  'props.anchorTo': '锚点终点',
  'props.layer': '层级',
  'props.sizeX': '宽度',
  'props.sizeY': '高度',
  'props.offsetX': '偏移 X',
  'props.offsetY': '偏移 Y',
  'props.text': '文本',
  'props.colorR': '颜色 R',
  'props.colorG': '颜色 G',
  'props.colorB': '颜色 B',
  'props.collectionName': '集合名称',
  'props.collectionIndex': '集合索引',
  'props.texturePath': '纹理路径',
  'props.uvCropping': 'UV 裁剪',
  'props.uvX': 'UV X',
  'props.uvY': 'UV Y',
  'props.uvWidth': 'UV 宽度',
  'props.uvHeight': 'UV 高度',
  'props.jsonPreview': 'JSON 预览',

  // 元素类型
  'element.panel.label': '面板',
  'element.panel.desc': '通用容器',
  'element.image.label': '图片',
  'element.image.desc': '背景与贴图',
  'element.label.label': '标签',
  'element.label.desc': '文本元素',
  'element.collection_panel.label': '集合面板',
  'element.collection_panel.desc': '物品集合容器',
  'element.chest_grid_item.label': '箱子格子项',
  'element.chest_grid_item.desc': '箱子槽位实例',
  'element.factory.label': '工厂',
  'element.factory.desc': '模板工厂',
  'element.grid.label': '网格',
  'element.grid.desc': '网格容器',

  // 纹理面板
  'texture.title': '纹理',
  'texture.dropHint': '拖拽图片或点击上传',

  // 状态消息
  'status.resourcePackLoaded': '资源包已加载，可直接拖拽组件到画布',
  'status.loadFailed': '资源包加载失败，请检查目录结构',
  'status.browserNotSupported':
    '当前浏览器不支持 File System Access API，请使用 Chrome/Edge 86+',
  'status.exported': '已导出 {file}',
  'status.saved': '已保存到资源包: {file}',
  'status.saveFailed': '保存失败，请确认目录权限是否允许写入',
  'status.added': '已新增 {type}',
  'status.addedToContainer': '已添加到容器 {name}',
  'status.addedToRoot': '已添加到根画布',
  'status.uiDirNotFound': '未找到 ui 目录',

  // 顶部栏
  'header.noFileSelected': '未选择文件',
  'header.elements': '{count} 个元素',
};
