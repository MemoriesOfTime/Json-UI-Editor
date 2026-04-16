export const en: Record<string, string> = {
  // App
  'app.title': 'Json UI Editor',

  // Buttons
  'btn.openResourcePack': 'Open Resource Pack',
  'btn.loading': 'Loading...',
  'btn.save': 'Save',
  'btn.saving': 'Saving...',
  'btn.export': 'Export',
  'btn.preview': 'Preview',
  'btn.close': 'Close',
  'btn.copyToClipboard': 'Copy to Clipboard',
  'btn.toggleRightSidebar': 'Toggle Right Sidebar',
  'btn.switchToLight': 'Switch to Light Mode',
  'btn.switchToDark': 'Switch to Dark Mode',
  'btn.lightMode': 'Light',
  'btn.darkMode': 'Dark',

  // Sidebar
  'sidebar.uiFiles': 'UI Files',
  'sidebar.components': 'Components',
  'sidebar.target': 'target: {label}',
  'sidebar.elements': 'Elements ({count})',
  'sidebar.rootCanvas': 'root canvas',
  'sidebar.dragHint':
    'Click to add to the selected container, or drag to canvas/container to create at the drop point.',
  'sidebar.openHint': 'Open a resource pack to get started',
  'sidebar.openHintSub':
    'Click the button on the left to load a resource pack, then drag components from the library',

  // Properties
  'props.title': 'Properties',
  'props.selectHint': 'Select an element to edit',
  'props.selected': 'Selected',
  'props.name': 'Name (ID)',
  'props.type': 'Type',
  'props.inheritsFrom': 'Inherits From',
  'props.anchorFrom': 'Anchor From',
  'props.anchorTo': 'Anchor To',
  'props.layer': 'Layer',
  'props.sizeX': 'Size X',
  'props.sizeY': 'Size Y',
  'props.offsetX': 'Offset X',
  'props.offsetY': 'Offset Y',
  'props.text': 'Text',
  'props.colorR': 'Color R',
  'props.colorG': 'Color G',
  'props.colorB': 'Color B',
  'props.collectionName': 'Collection Name',
  'props.collectionIndex': 'Collection Index',
  'props.texturePath': 'Texture Path',
  'props.uvCropping': 'UV Cropping',
  'props.uvX': 'UV X',
  'props.uvY': 'UV Y',
  'props.uvWidth': 'UV Width',
  'props.uvHeight': 'UV Height',
  'props.jsonPreview': 'JSON Preview',

  // Element types
  'element.panel.label': 'Panel',
  'element.panel.desc': 'General container',
  'element.image.label': 'Image',
  'element.image.desc': 'Backgrounds & textures',
  'element.label.label': 'Label',
  'element.label.desc': 'Text element',
  'element.collection_panel.label': 'Collection Panel',
  'element.collection_panel.desc': 'Item collection container',
  'element.chest_grid_item.label': 'Chest Grid Item',
  'element.chest_grid_item.desc': 'Chest slot instance',
  'element.factory.label': 'Factory',
  'element.factory.desc': 'Template factory',
  'element.grid.label': 'Grid',
  'element.grid.desc': 'Grid container',

  // Texture panel
  'texture.title': 'Textures',
  'texture.dropHint': 'Drop images or click to upload',

  // Status messages
  'status.resourcePackLoaded':
    'Resource pack loaded, drag components to canvas',
  'status.resourcePackLoadedWithWarnings':
    'Resource pack loaded, skipped {count} unreadable files',
  'status.loadFailed':
    'Failed to load resource pack, check directory structure',
  'status.browserNotSupported':
    'Browser does not support File System Access API, please use Chrome/Edge 86+',
  'status.exported': 'Exported {file}',
  'status.saved': 'Saved to resource pack: {file}',
  'status.saveFailed': 'Save failed, check directory write permissions',
  'status.added': 'Added {type}',
  'status.addedToContainer': 'Added to container {name}',
  'status.addedToRoot': 'Added to root canvas',
  'status.uiDirNotFound': 'UI directory not found',

  // Header
  'header.noFileSelected': 'No file selected',
  'header.elements': '{count} elements',
};
