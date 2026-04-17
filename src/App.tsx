import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Languages,
  LayoutDashboard,
  Layers,
  Moon,
  MousePointer2,
  Palette,
  Plus,
  Save,
  Settings,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { CanvasElement, COMPONENT_DRAG_MIME } from './components/CanvasElement';
import { ElementTreeNode } from './components/ElementTreeNode';
import { Footer } from './components/Footer';
import { SidebarSection } from './components/SidebarSection';
import { TexturePanel } from './components/TexturePanel';
import { useI18nStore, useT } from './lib/i18n';
import {
  loadResourcePack,
  loadTextureAssets,
  saveUiFile,
} from './lib/loadResourcePack';
import { serializeUiFile } from './lib/serializeUiFile';
import { useThemeStore } from './lib/theme';
import {
  ADDABLE_ELEMENT_TYPES,
  ANCHOR_OPTIONS,
  ELEMENT_TYPE_OPTIONS,
  applyAnchor,
  findElementById,
  findParentIdByChildId,
  flattenElements,
  getDefaultElementSize,
  getNextCollectionIndex,
  isContainerElement,
  resolveControlFrame,
  resolveElementLayoutTree,
  useStore,
} from './store/useStore';
import type { ElementType, UIElement } from './store/useStore';

function clampPosition(
  position: [number, number],
  elementSize: [number, number],
  parentSize: [number, number],
): [number, number] {
  return [
    Math.max(0, Math.min(position[0], Math.max(0, parentSize[0] - elementSize[0]))),
    Math.max(0, Math.min(position[1], Math.max(0, parentSize[1] - elementSize[1]))),
  ];
}

function getInsertParentId(
  elements: UIElement[],
  selectedId: string | null,
): string | null {
  if (!selectedId) return null;

  const selectedElement = findElementById(elements, selectedId);
  if (!selectedElement) return null;

  if (isContainerElement(selectedElement.type)) {
    return selectedElement.id;
  }

  return findParentIdByChildId(elements, selectedId);
}

interface CanvasBackgroundImage {
  name: string;
  objectUrl: string;
  naturalWidth: number;
  naturalHeight: number;
}

const VIEWPORT_PRESETS: Array<{
  value: string;
  label: string;
  size: [number, number];
}> = [
  { value: '1280x720', label: 'HD 1280×720', size: [1280, 720] },
  { value: '1366x768', label: 'WXGA 1366×768', size: [1366, 768] },
  { value: '1600x900', label: 'HD+ 1600×900', size: [1600, 900] },
  { value: '1920x1080', label: 'FHD 1920×1080', size: [1920, 1080] },
  { value: '2560x1440', label: 'QHD 2560×1440', size: [2560, 1440] },
  { value: '3840x2160', label: '4K 3840×2160', size: [3840, 2160] },
];

const EDITOR_STAGE_GAP = 16;
const MIN_EDITOR_ZOOM_SCALE = 0.01;

function getViewportPresetValue(viewportSize: [number, number]): string {
  const preset = VIEWPORT_PRESETS.find(
    ({ size }) => size[0] === viewportSize[0] && size[1] === viewportSize[1],
  );
  return preset?.value ?? 'custom';
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

function App() {
  const {
    project,
    activeFile,
    canvasSize,
    elements,
    selectedId,
    selectElement,
    updateElement,
    addElement,
    removeElement,
    setProject,
    setActiveFile,
    addTexture,
    canUndo,
    canRedo,
    undo,
    redo,
    addUiFile,
  } = useStore();

  const t = useT();
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const theme = useThemeStore((s) => s.theme);
  const style = useThemeStore((s) => s.style);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const setStyle = useThemeStore((s) => s.setStyle);

  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isEditorToolbarCollapsed, setIsEditorToolbarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingType, setDraggingType] = useState<ElementType | null>(null);
  const [canvasBackground, setCanvasBackground] =
    useState<CanvasBackgroundImage | null>(null);
  const [canvasBackgroundOpacity, setCanvasBackgroundOpacity] = useState(0.72);
  const [viewportSize, setViewportSize] = useState<[number, number]>([1920, 1080]);
  const [uiScalePercent, setUiScalePercent] = useState(100);
  const [editorZoomPercent, setEditorZoomPercent] = useState(100);
  const [isEditorZoomAuto, setIsEditorZoomAuto] = useState(true);
  const [editorToolbarHeight, setEditorToolbarHeight] = useState(0);
  const [editorViewportBounds, setEditorViewportBounds] =
    useState<[number, number]>([1920, 1080]);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const backgroundLoadVersionRef = useRef(0);
  const editorCanvasAreaRef = useRef<HTMLDivElement | null>(null);
  const editorToolbarRef = useRef<HTMLDivElement | null>(null);
  const appearanceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showPreview) {
        return;
      }

      if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const shouldUndo = key === 'z' && !event.shiftKey;
      const shouldRedo = key === 'y' || (key === 'z' && event.shiftKey);

      if (shouldUndo && canUndo) {
        event.preventDefault();
        undo();
      }

      if (shouldRedo && canRedo) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canRedo, canUndo, redo, showPreview, undo]);

  useEffect(
    () => () => {
      if (canvasBackground?.objectUrl) {
        URL.revokeObjectURL(canvasBackground.objectUrl);
      }
    },
    [canvasBackground],
  );

  useEffect(() => {
    const area = editorCanvasAreaRef.current;
    if (!area) return;

    const measureBounds = () => {
      const currentArea = editorCanvasAreaRef.current;
      if (!currentArea) return;

      const style = window.getComputedStyle(currentArea);
      const horizontalPadding =
        parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const verticalPadding =
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const toolbarHeight = editorToolbarRef.current?.offsetHeight ?? 0;
      const availableWidth = Math.max(
        0,
        currentArea.clientWidth - horizontalPadding,
      );
      const availableHeight = Math.max(
        0,
        currentArea.clientHeight - verticalPadding - toolbarHeight - EDITOR_STAGE_GAP,
      );

      setEditorToolbarHeight(toolbarHeight);
      setEditorViewportBounds([availableWidth, availableHeight]);
    };

    measureBounds();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureBounds);
      return () => {
        window.removeEventListener('resize', measureBounds);
      };
    }

    const observer = new ResizeObserver(() => {
      measureBounds();
    });
    observer.observe(area);

    if (editorToolbarRef.current) {
      observer.observe(editorToolbarRef.current);
    }

    window.addEventListener('resize', measureBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureBounds);
    };
  }, [activeFile, project]);

  useEffect(() => {
    if (!isAppearanceOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (appearanceRef.current && !appearanceRef.current.contains(e.target as Node)) {
        setIsAppearanceOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isAppearanceOpen]);

  const currentFile = project?.uiFiles.find((file) => file.path === activeFile) || null;
  const editableRoot = currentFile?.parsed.rootControls.find(
    (control) =>
      control.key.endsWith('_menu_root') || control.key.endsWith('_menu_panel'),
  ) || null;
  const logicalCanvasSize = canvasSize;
  const resolvedRootFrame = resolveControlFrame(
    editableRoot,
    logicalCanvasSize,
    logicalCanvasSize,
  );
  const logicalRootSize = resolvedRootFrame.size;
  const displayElements = resolveElementLayoutTree(
    elements,
    logicalRootSize,
    logicalCanvasSize,
  );
  const selectedElement = findElementById(displayElements, selectedId);
  const insertParentId = getInsertParentId(displayElements, selectedId);
  const insertParentElement = findElementById(displayElements, insertParentId);
  const logicalRootPosition = applyAnchor(
    resolvedRootFrame.anchorFrom,
    resolvedRootFrame.anchorTo,
    logicalCanvasSize[0],
    logicalCanvasSize[1],
    logicalRootSize[0],
    logicalRootSize[1],
    resolvedRootFrame.offset,
  );
  const fitViewportScale = Math.min(
    viewportSize[0] / Math.max(logicalCanvasSize[0], 1),
    viewportSize[1] / Math.max(logicalCanvasSize[1], 1),
  );
  const renderScale = fitViewportScale * (uiScalePercent / 100);
  const autoEditorZoomScale = (() => {
    const widthScale =
      editorViewportBounds[0] / Math.max(viewportSize[0], 1);
    const heightScale =
      editorViewportBounds[1] / Math.max(viewportSize[1], 1);
    const nextScale = Math.min(widthScale, heightScale);
    if (!Number.isFinite(nextScale)) {
      return 1;
    }

    return Math.max(nextScale, MIN_EDITOR_ZOOM_SCALE);
  })();
  const editorZoomScale = isEditorZoomAuto
    ? autoEditorZoomScale
    : editorZoomPercent / 100;
  const displayedEditorZoomPercent = Math.round(editorZoomScale * 100);
  const totalCanvasScale = renderScale * editorZoomScale;
  const scaledCanvasSize: [number, number] = [
    logicalCanvasSize[0] * renderScale,
    logicalCanvasSize[1] * renderScale,
  ];
  const scaledViewportSize: [number, number] = [
    viewportSize[0] * editorZoomScale,
    viewportSize[1] * editorZoomScale,
  ];
  const canvasDisplayOffset: [number, number] = [
    Math.max(0, (viewportSize[0] - scaledCanvasSize[0]) / 2),
    Math.max(0, (viewportSize[1] - scaledCanvasSize[1]) / 2),
  ];
  const jsonPreview = currentFile
    ? serializeUiFile(currentFile.parsed, elements)
    : '';
  const elementCount = flattenElements(displayElements).length;
  const viewportPresetValue = getViewportPresetValue(viewportSize);

  async function handleOpenProject() {
    try {
      if (!('showDirectoryPicker' in window)) {
        alert(t('status.browserNotSupported'));
        return;
      }

      const dirHandle = await (window as Window & {
        showDirectoryPicker: (options?: Record<string, unknown>) => Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker({ mode: 'readwrite' });

      setLoading(true);

      const loadedProject = await loadResourcePack(dirHandle);
      setProject(loadedProject);

      if (loadedProject.texturePaths.length > 0) {
        await loadTextureAssets(
          dirHandle,
          loadedProject.texturePaths,
          addTexture,
        );
      }

      if (loadedProject.uiFiles.length > 0) {
        const firstScreen = loadedProject.uiFiles.find(
          (file) =>
            file.name !== 'chest_screen.json' && file.name !== '_ui_defs.json',
        );
        if (firstScreen) {
          setActiveFile(firstScreen.path);
        }
      }
    } catch (error: unknown) {
      const typedError = error as { name?: string };
      if (typedError.name !== 'AbortError') {
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleDragStop(id: string, offset: [number, number]) {
    updateElement(id, { offset });
  }

  function handleResizeStop(
    id: string,
    size: [number, number],
    offset: [number, number],
  ) {
    updateElement(id, { size, offset });
  }

  function getTypeChangeUpdates(
    element: UIElement,
    nextType: ElementType,
  ): Partial<UIElement> {
    const updates: Partial<UIElement> = { type: nextType };

    if (nextType === 'chest_grid_item') {
      updates.inheritsFrom = 'chest.chest_grid_item';
      updates.collection_name = element.collection_name || 'container_items';
      updates.collection_index =
        element.collection_index ?? getNextCollectionIndex(elements);
      return updates;
    }

    if (nextType === 'collection_panel' && !element.collection_name) {
      updates.collection_name = 'container_items';
    }

    if (element.inheritsFrom === 'chest.chest_grid_item') {
      updates.inheritsFrom = undefined;
      updates.collection_index = undefined;
      if (nextType !== 'collection_panel') {
        updates.collection_name = undefined;
      }
    }

    return updates;
  }

  function handleNewFile() {
    const input = prompt(t('status.enterFileName'));
    if (!input?.trim()) return;
    addUiFile(input.trim());
  }

  function handleExport() {
    if (!currentFile) return;

    const blob = new Blob([jsonPreview], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = currentFile.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleSave() {
    if (!project || !currentFile) return;

    try {
      setSaving(true);
      await saveUiFile(project.dirHandle, currentFile.path, jsonPreview);
    } catch (error) {
      console.error(error);
      alert(t('status.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  function createElementAt(
    type: ElementType,
    parentId: string | null,
    dropPosition: [number, number],
  ) {
    const targetParent = parentId ? findElementById(displayElements, parentId) : null;
    const parentSize = targetParent?.size || logicalRootSize;
    const elementSize = getDefaultElementSize(type);
    const nextPosition = clampPosition(
      [
        Math.round(dropPosition[0] - elementSize[0] / 2),
        Math.round(dropPosition[1] - elementSize[1] / 2),
      ],
      elementSize,
      parentSize,
    );

    addElement(type, { parentId, position: nextPosition });
  }

  function handlePaletteClick(type: ElementType) {
    const parentId = insertParentId;
    const parentSize = insertParentElement?.size || logicalRootSize;
    const elementSize = getDefaultElementSize(type);
    const centeredPosition = clampPosition(
      [
        Math.round((parentSize[0] - elementSize[0]) / 2),
        Math.round((parentSize[1] - elementSize[1]) / 2),
      ],
      elementSize,
      parentSize,
    );

    addElement(type, { parentId, position: centeredPosition });
  }

  function handleRootDrop(event: DragEvent<HTMLDivElement>) {
    const droppedType = event.dataTransfer.getData(
      COMPONENT_DRAG_MIME,
    ) as ElementType;
    if (!droppedType) return;

    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    createElementAt(droppedType, null, [
      Math.round((event.clientX - rect.left) / totalCanvasScale),
      Math.round((event.clientY - rect.top) / totalCanvasScale),
    ]);
    setDraggingType(null);
  }

  function handleCanvasBackgroundChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      event.target.value = '';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    const nextLoadVersion = backgroundLoadVersionRef.current + 1;
    backgroundLoadVersionRef.current = nextLoadVersion;

    image.onload = () => {
      if (backgroundLoadVersionRef.current !== nextLoadVersion) {
        URL.revokeObjectURL(objectUrl);
        return;
      }

      setViewportSize([image.naturalWidth, image.naturalHeight]);
      setCanvasBackground({
        name: file.name,
        objectUrl,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      });
    };

    image.onerror = () => {
      if (backgroundLoadVersionRef.current !== nextLoadVersion) {
        URL.revokeObjectURL(objectUrl);
        return;
      }

      URL.revokeObjectURL(objectUrl);
    };

    image.src = objectUrl;
    event.target.value = '';
  }

  function handleClearCanvasBackground() {
    backgroundLoadVersionRef.current += 1;
    setCanvasBackground(null);
  }

  function handleViewportSizeChange(axis: 0 | 1, rawValue: string) {
    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue) || nextValue <= 0) {
      return;
    }

    setViewportSize((current) => {
      const nextSize: [number, number] = [...current] as [number, number];
      nextSize[axis] = Math.round(nextValue);
      return nextSize;
    });
  }

  function handleViewportPresetChange(value: string) {
    if (value === 'custom') return;

    const preset = VIEWPORT_PRESETS.find((item) => item.value === value);
    if (!preset) return;

    setViewportSize([...preset.size] as [number, number]);
  }

  function handleUiScaleChange(rawValue: string) {
    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue) || nextValue <= 0) {
      return;
    }

    setUiScalePercent(Math.round(nextValue));
  }

  function handleEditorZoomChange(rawValue: string) {
    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue) || nextValue <= 0 || nextValue > 500) {
      return;
    }

    setEditorZoomPercent(Math.round(nextValue));
  }

  function handleEditorZoomAutoToggle() {
    setIsEditorZoomAuto((current) => {
      if (current) {
        setEditorZoomPercent(displayedEditorZoomPercent);
      }
      return !current;
    });
  }



  const insertTargetLabel = insertParentElement
    ? `${insertParentElement.name} (${insertParentElement.type})`
    : t('sidebar.rootCanvas');

  return (
    <div className="flex flex-col h-screen w-full select-none mc-bg mc-text">
      <div className="flex min-h-0 flex-1">
      <aside className="flex h-full min-h-0 w-72 flex-col overflow-hidden mc-panel">
        <div className="flex h-14 shrink-0 items-center px-4 mc-border-h">
          <h1 className="flex items-center gap-2 mc-title text-xl font-bold">
            <LayoutDashboard className="h-5 w-5" />
            {t('app.title')}
          </h1>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-6">
          <div className="space-y-6">
            <button
              onClick={handleOpenProject}
              disabled={loading}
              className="mc-btn mc-btn-blue flex w-full items-center justify-center gap-2 text-sm"
            >
              <FolderOpen className="h-4 w-4" />
              {loading ? t('btn.loading') : t('btn.openResourcePack')}
            </button>

            {project && (
              <SidebarSection title={t('sidebar.uiFiles')}>
                <ul className="space-y-1 text-sm">
                  {project.uiFiles.map((file) => (
                    <li
                      key={file.path}
                      onClick={() => setActiveFile(file.path)}
                      title={file.path}
                      className={`flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 ${
                        activeFile === file.path
                          ? 'mc-select-active'
                          : 'mc-hover-item'
                      }`}
                    >
                      <Layers className="h-3 w-3 opacity-70" />
                      <span className="truncate">{file.name}</span>
                      <span className="ml-auto text-[10px] mc-text-dim">
                        {file.parsed.namespace}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleNewFile}
                  className="mc-btn flex w-full items-center justify-center gap-2 text-sm mt-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('btn.newFile')}
                </button>
              </SidebarSection>
            )}

            <SidebarSection
              title={t('sidebar.components')}
              extra={
                <span className="text-[10px] mc-text-dim font-normal normal-case tracking-normal">
                  {t('sidebar.target', { label: insertTargetLabel })}
                </span>
              }
            >
              <div className="space-y-2">
                {ADDABLE_ELEMENT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    draggable={Boolean(activeFile)}
                    disabled={!activeFile}
                    onClick={() => handlePaletteClick(type)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(COMPONENT_DRAG_MIME, type);
                      event.dataTransfer.effectAllowed = 'copy';
                      setDraggingType(type);
                    }}
                    onDragEnd={() => setDraggingType(null)}
                    className="mc-btn flex w-full items-center gap-3 text-left"
                  >
                    <div className="mc-icon-box p-1.5 mc-text-icon">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm mc-text">
                        {t(`element.${type}.label`)}
                      </div>
                      <div className="truncate text-[11px] mc-text-dim">
                        {t(`element.${type}.desc`)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <p className="mt-2 text-[10px] leading-4 mc-text-dim">
                {t('sidebar.dragHint')}
              </p>
            </SidebarSection>

            {elementCount > 0 && (
              <SidebarSection title={t('sidebar.elements', { count: elementCount })}>
                <ul className="space-y-0.5">
                  {elements.map((element) => (
                    <ElementTreeNode
                      key={element.id}
                      element={element}
                      depth={0}
                      selectedId={selectedId}
                      onSelect={selectElement}
                      parentId={null}
                    />
                  ))}
                </ul>
              </SidebarSection>
            )}

            <TexturePanel />
          </div>
        </div>
      </aside>

      <main
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        onClick={() => selectElement(null)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsRightSidebarOpen(!isRightSidebarOpen);
          }}
          className="mc-panel absolute right-0 top-1/2 z-50 flex h-16 w-5 -translate-y-1/2 items-center justify-center mc-text-dim"
          title={t('btn.toggleRightSidebar')}
        >
          {isRightSidebarOpen ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        <header
          className="flex h-14 items-center justify-between px-4 mc-panel border-l-0 border-r-0"
          style={style === 'oreui'
            ? { boxShadow: '0 2px 8px var(--mc-panel-shadow)' }
            : { boxShadow: 'inset 0 1px 0 var(--mc-panel-shadow), inset 0 -1px 0 var(--mc-panel-shadow)' }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-4">
            <span className="mc-text text-sm font-medium">
              {currentFile?.path || t('header.noFileSelected')}
            </span>
            <span className="text-xs mc-text-dim">
              {t('header.elements', { count: elementCount })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={appearanceRef}>
              <button
                onClick={() => setIsAppearanceOpen((v) => !v)}
                className="mc-btn flex items-center gap-1.5 text-xs"
              >
                <Palette className="h-3.5 w-3.5" />
                {style === 'minecraft' ? t('btn.styleMinecraft') : t('btn.styleOreUI')}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
              {isAppearanceOpen && (
                <div className="mc-panel absolute right-0 top-full mt-1 z-50 min-w-[160px] py-1.5">
                  <div className="mc-dropdown-label">{t('btn.styleLabel')}</div>
                  <button
                    onClick={() => { setStyle('minecraft'); setIsAppearanceOpen(false); }}
                    className="mc-dropdown-item w-full text-xs"
                  >
                    <span className="flex-1 text-left">{t('btn.styleMinecraft')}</span>
                    {style === 'minecraft' && <Check className="h-3.5 w-3.5 mc-text-check" />}
                  </button>
                  <button
                    onClick={() => { setStyle('oreui'); setIsAppearanceOpen(false); }}
                    className="mc-dropdown-item w-full text-xs"
                  >
                    <span className="flex-1 text-left">{t('btn.styleOreUI')}</span>
                    {style === 'oreui' && <Check className="h-3.5 w-3.5 mc-text-check" />}
                  </button>
                  <div className="mc-dropdown-separator" />
                  <div className="mc-dropdown-label">{t('btn.themeLabel')}</div>
                  <button
                    onClick={() => { if (theme !== 'light') toggleTheme(); setIsAppearanceOpen(false); }}
                    className="mc-dropdown-item w-full text-xs"
                  >
                    <Sun className="h-3.5 w-3.5" />
                    <span className="flex-1 text-left">{t('btn.lightMode')}</span>
                    {theme === 'light' && <Check className="h-3.5 w-3.5 mc-text-check" />}
                  </button>
                  <button
                    onClick={() => { if (theme !== 'dark') toggleTheme(); setIsAppearanceOpen(false); }}
                    className="mc-dropdown-item w-full text-xs"
                  >
                    <Moon className="h-3.5 w-3.5" />
                    <span className="flex-1 text-left">{t('btn.darkMode')}</span>
                    {theme === 'dark' && <Check className="h-3.5 w-3.5 mc-text-check" />}
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
              className="mc-btn flex items-center gap-1.5 text-xs"
            >
              <Languages className="h-3.5 w-3.5" />
              {locale === 'zh' ? 'EN' : '中文'}
            </button>
            <button
              onClick={() => setShowPreview(true)}
              disabled={!currentFile}
              className="mc-btn text-xs"
            >
              {t('btn.preview')}
            </button>
            <button
              onClick={handleSave}
              disabled={!currentFile || saving}
              className="mc-btn mc-btn-primary flex items-center gap-1.5 text-xs"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? t('btn.saving') : t('btn.save')}
            </button>
            <button
              onClick={handleExport}
              disabled={!currentFile}
              className="mc-btn mc-btn-blue flex items-center gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              {t('btn.export')}
            </button>
          </div>
        </header>

        <div className="relative flex flex-1 flex-col overflow-hidden mc-bg-deep">
          {currentFile && (
            <div
              ref={editorToolbarRef}
              className="absolute left-0 right-0 top-0 z-20 flex justify-center pointer-events-none"
            >
              <div
                className="pointer-events-auto flex max-w-full flex-col items-center"
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  id="editor-canvas-toolbar"
                  role="group"
                  aria-label={t('canvas.toolbarTitle')}
                  className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                    isEditorToolbarCollapsed
                      ? 'grid-rows-[0fr] opacity-0'
                      : 'grid-rows-[1fr] opacity-100'
                  }`}
                >
                  <div className="overflow-hidden min-h-0">
                    <div className="flex flex-wrap items-center gap-3 mc-panel px-4 py-3">
                      <div className="flex items-center gap-2 text-xs mc-text-dim">
                        <span>{t('canvas.viewportSize')}</span>
                        <select
                          value={viewportPresetValue}
                          onChange={(event) =>
                            handleViewportPresetChange(event.target.value)
                          }
                          className="mc-input text-xs"
                        >
                          <option value="custom">{t('canvas.customViewport')}</option>
                          {VIEWPORT_PRESETS.map((preset) => (
                            <option key={preset.value} value={preset.value}>
                              {preset.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={viewportSize[0]}
                          onChange={(event) =>
                            handleViewportSizeChange(0, event.target.value)
                          }
                          className="w-24 mc-input text-xs"
                        />
                        <span>×</span>
                        <input
                          type="number"
                          min="1"
                          value={viewportSize[1]}
                          onChange={(event) =>
                            handleViewportSizeChange(1, event.target.value)
                          }
                          className="w-24 mc-input text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-2 text-xs mc-text-dim">
                        <span>{t('canvas.guiScale')}</span>
                        <input
                          type="number"
                          min="10"
                          step="5"
                          value={uiScalePercent}
                          onChange={(event) => handleUiScaleChange(event.target.value)}
                          className="w-20 mc-input text-xs"
                        />
                        <span>%</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs mc-text-dim">
                        <span>{t('canvas.editorZoom')}</span>
                        <button
                          type="button"
                          onClick={handleEditorZoomAutoToggle}
                          className={`mc-btn px-2 py-1 text-xs ${
                            isEditorZoomAuto
                              ? 'mc-btn-blue'
                              : ''
                          }`}
                        >
                          {t('canvas.editorZoomAuto')}
                        </button>
                        <input
                          type="number"
                          min="10"
                          step="5"
                          value={isEditorZoomAuto ? displayedEditorZoomPercent : editorZoomPercent}
                          onChange={(event) => handleEditorZoomChange(event.target.value)}
                          disabled={isEditorZoomAuto}
                          className="w-20 mc-input text-xs"
                        />
                        <span>%</span>
                      </div>

                      <input
                        ref={backgroundInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCanvasBackgroundChange}
                      />
                      <button
                        type="button"
                        onClick={() => backgroundInputRef.current?.click()}
                        className="mc-btn flex items-center gap-2 text-sm"
                      >
                        <ImageIcon className="h-4 w-4" />
                        {t('btn.loadBackground')}
                      </button>

                      {canvasBackground ? (
                        <>
                          <div className="min-w-0">
                            <p className="truncate text-sm mc-text">
                              {canvasBackground.name}
                            </p>
                            <p className="text-[11px] mc-text-dim">
                              {canvasBackground.naturalWidth}×{canvasBackground.naturalHeight} ·{' '}
                              {t('canvas.backgroundHint')}
                            </p>
                          </div>

                          <label className="flex items-center gap-2 text-xs mc-text-dim">
                            <span>{t('canvas.backgroundOpacity')}</span>
                            <input
                              type="range"
                              min="0.15"
                              max="1"
                              step="0.05"
                              value={canvasBackgroundOpacity}
                              onChange={(event) =>
                                setCanvasBackgroundOpacity(Number(event.target.value))
                              }
                              className="w-28 accent-mc-aqua"
                            />
                            <span>{Math.round(canvasBackgroundOpacity * 100)}%</span>
                          </label>

                          <button
                            type="button"
                            onClick={handleClearCanvasBackground}
                            className="mc-btn mc-btn-danger text-sm"
                          >
                            {t('btn.clearBackground')}
                          </button>
                        </>
                      ) : (
                        <p className="text-xs mc-text-dim">
                          {t('canvas.backgroundEmpty')}
                        </p>
                      )}

                      <p className="text-xs mc-text-dim">
                        {t('canvas.logicalScreen')}: {logicalCanvasSize[0]}×{logicalCanvasSize[1]}
                      </p>
                      <p className="text-xs mc-text-dim">
                        {t('canvas.uiRoot')}: {logicalRootSize[0]}×{logicalRootSize[1]}
                      </p>
                      <p className="text-xs mc-text-dim">
                        {t('canvas.renderScale')}: {renderScale.toFixed(2)}x
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditorToolbarCollapsed((current) => !current)}
                  aria-controls="editor-canvas-toolbar"
                  aria-expanded={!isEditorToolbarCollapsed}
                  aria-label={
                    isEditorToolbarCollapsed
                      ? t('btn.expandCanvasToolbar')
                      : t('btn.collapseCanvasToolbar')
                  }
                  title={
                    isEditorToolbarCollapsed
                      ? t('btn.expandCanvasToolbar')
                      : t('btn.collapseCanvasToolbar')
                  }
                  className="mc-panel z-10 -mt-px flex h-5 w-16 shrink-0 items-center justify-center mc-text-dim"
                >
                  {isEditorToolbarCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          <div
            ref={editorCanvasAreaRef}
            className="flex flex-1 overflow-auto p-8"
          >
            {currentFile ? (
              <div className="mx-auto flex min-h-full w-fit flex-col items-center justify-start gap-4">
                <div
                  className="flex flex-col items-center gap-8"
                  style={{
                    paddingTop: editorToolbarHeight + EDITOR_STAGE_GAP,
                  }}
                >
                  <div
                    className="relative"
                    style={{ width: scaledViewportSize[0], height: scaledViewportSize[1] }}
                  >
                    <div
                      className="relative overflow-hidden bg-black mc-panel"
                      style={{
                        width: viewportSize[0],
                        height: viewportSize[1],
                        transform: `scale(${editorZoomScale})`,
                        transformOrigin: 'top left',
                      }}
                    >
                      {canvasBackground ? (
                        <>
                          <img
                            src={canvasBackground.objectUrl}
                            alt={canvasBackground.name}
                            className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
                            style={{ opacity: canvasBackgroundOpacity }}
                            draggable={false}
                          />
                          <div className="pointer-events-none absolute inset-0 bg-black/10" />
                        </>
                      ) : (
                        <img
                          src="/images/default-background.png"
                          alt=""
                          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                          draggable={false}
                        />
                      )}

                      <div className="pointer-events-none absolute inset-0 border border-white/10" />

                      <div
                        className="absolute"
                        style={{
                          left: canvasDisplayOffset[0],
                          top: canvasDisplayOffset[1],
                          width: scaledCanvasSize[0],
                          height: scaledCanvasSize[1],
                        }}
                      >
                        <div
                          className="absolute left-0 top-0"
                          style={{
                            width: logicalCanvasSize[0],
                            height: logicalCanvasSize[1],
                            transform: `scale(${renderScale})`,
                            transformOrigin: 'top left',
                          }}
                        >
                          <div className="pointer-events-none absolute inset-0 border border-dashed border-white/15" />

                          <div
                            className={`absolute overflow-hidden border transition-colors ${
                              draggingType
                                ? 'mc-select-outline'
                                : 'mc-canvas-border border-zinc-400/30 dark:border-zinc-500/30'
                            }`}
                            style={{
                              left: logicalRootPosition[0],
                              top: logicalRootPosition[1],
                              width: logicalRootSize[0],
                              height: logicalRootSize[1],
                            }}
                            onClick={(event) => event.stopPropagation()}
                            onDragOver={(event) => {
                              if (!draggingType) return;
                              event.preventDefault();
                              event.dataTransfer.dropEffect = 'copy';
                            }}
                            onDrop={handleRootDrop}
                          >
                            <div className="pointer-events-none absolute inset-0 border border-dashed border-white/25" />

                            {displayElements.map((element) => (
                              <CanvasElement
                                key={element.id}
                                el={element}
                                parentSize={logicalRootSize}
                                selectedId={selectedId}
                                draggingType={draggingType}
                                canvasScale={totalCanvasScale}
                                onSelect={selectElement}
                                onDragStop={handleDragStop}
                                onResizeStop={handleResizeStop}
                                onDropNewElement={createElementAt}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          ) : (
            <div className="mx-auto flex min-h-full w-full flex-col items-center justify-center gap-3 mc-text-dim">
              <FolderOpen className="h-16 w-16 opacity-20" />
              <p className="text-lg">{t('sidebar.openHint')}</p>
              <p className="text-sm mc-text-dim opacity-50">
                {t('sidebar.openHintSub')}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>

      <aside
        className={`flex min-h-0 flex-col overflow-hidden mc-panel border-t-0 transition-all duration-300 ${
          isRightSidebarOpen ? 'w-80' : 'w-0 border-l-0 border-r-0'
        }`}
        style={isRightSidebarOpen
          ? (style === 'oreui'
            ? { boxShadow: '2px 0 8px var(--mc-panel-shadow)' }
            : { boxShadow: 'inset 1px 0 0 var(--mc-panel-shadow), inset -1px -1px 0 var(--mc-panel-shadow)' })
          : undefined}
      >
        <div className="flex h-full min-h-0 w-80 flex-col">
          <div className="flex h-14 items-center px-4 mc-border-h">
            <h2 className="flex items-center gap-2 text-sm font-semibold mc-text">
              <Settings className="h-4 w-4" />
              {t('props.title')}
            </h2>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          {!selectedElement ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center mc-text-dim">
              <MousePointer2 className="h-8 w-8 opacity-20" />
              <p>{t('props.selectHint')}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mc-panel px-3 py-2">
                <div>
                  <p className="text-xs mc-text-dim">{t('props.selected')}</p>
                  <p className="text-sm mc-text">{selectedElement.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeElement(selectedElement.id)}
                  className="mc-btn mc-btn-danger p-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs mc-text-dim">{t('props.name')}</label>
                <input
                  type="text"
                  value={selectedElement.name}
                  onChange={(event) =>
                    updateElement(selectedElement.id, { name: event.target.value })
                  }
                  className="w-full mc-input text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs mc-text-dim">{t('props.type')}</label>
                <select
                  value={selectedElement.type}
                  onChange={(event) =>
                    updateElement(
                      selectedElement.id,
                      getTypeChangeUpdates(
                        selectedElement,
                        event.target.value as ElementType,
                      ),
                    )
                  }
                  className="w-full mc-input text-sm"
                >
                  {ELEMENT_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs mc-text-dim">{t('props.inheritsFrom')}</label>
                <input
                  type="text"
                  value={selectedElement.inheritsFrom || ''}
                  onChange={(event) =>
                    updateElement(selectedElement.id, {
                      inheritsFrom: event.target.value || undefined,
                    })
                  }
                  className="w-full mc-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs mc-text-dim">{t('props.anchorFrom')}</label>
                  <select
                    value={selectedElement.anchor_from || 'center'}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        anchor_from: event.target.value as UIElement['anchor_from'],
                      })
                    }
                    className="w-full mc-input text-sm"
                  >
                    {ANCHOR_OPTIONS.map((anchor) => (
                      <option key={anchor} value={anchor}>
                        {anchor}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs mc-text-dim">{t('props.anchorTo')}</label>
                  <select
                    value={selectedElement.anchor_to || 'center'}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        anchor_to: event.target.value as UIElement['anchor_to'],
                      })
                    }
                    className="w-full mc-input text-sm"
                  >
                    {ANCHOR_OPTIONS.map((anchor) => (
                      <option key={anchor} value={anchor}>
                        {anchor}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs mc-text-dim">{t('props.layer')}</label>
                <input
                  type="number"
                  value={selectedElement.layer ?? 1}
                  onChange={(event) =>
                    updateElement(selectedElement.id, {
                      layer: Number(event.target.value),
                    })
                  }
                  className="w-full mc-input text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs mc-text-dim">{t('props.sizeX')}</label>
                  <input
                    type="number"
                    value={selectedElement.size[0]}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        size: [Number(event.target.value), selectedElement.size[1]],
                      })
                    }
                    className="w-full mc-input text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs mc-text-dim">{t('props.sizeY')}</label>
                  <input
                    type="number"
                    value={selectedElement.size[1]}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        size: [selectedElement.size[0], Number(event.target.value)],
                      })
                    }
                    className="w-full mc-input text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs mc-text-dim">{t('props.offsetX')}</label>
                  <input
                    type="number"
                    value={selectedElement.offset[0]}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        offset: [
                          Number(event.target.value),
                          selectedElement.offset[1],
                        ],
                      })
                    }
                    className="w-full mc-input text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs mc-text-dim">{t('props.offsetY')}</label>
                  <input
                    type="number"
                    value={selectedElement.offset[1]}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        offset: [
                          selectedElement.offset[0],
                          Number(event.target.value),
                        ],
                      })
                    }
                    className="w-full mc-input text-sm"
                  />
                </div>
              </div>

              {selectedElement.type === 'label' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs mc-text-dim">{t('props.text')}</label>
                    <input
                      type="text"
                      value={selectedElement.text || ''}
                      onChange={(event) =>
                        updateElement(selectedElement.id, {
                          text: event.target.value,
                        })
                      }
                      className="w-full mc-input text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs mc-text-dim">{t('props.colorR')}</label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={selectedElement.color?.[0] ?? 1}
                        onChange={(event) =>
                          updateElement(selectedElement.id, {
                            color: [
                              Number(event.target.value),
                              selectedElement.color?.[1] ?? 1,
                              selectedElement.color?.[2] ?? 1,
                            ],
                          })
                        }
                        className="w-full mc-input text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs mc-text-dim">{t('props.colorG')}</label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={selectedElement.color?.[1] ?? 1}
                        onChange={(event) =>
                          updateElement(selectedElement.id, {
                            color: [
                              selectedElement.color?.[0] ?? 1,
                              Number(event.target.value),
                              selectedElement.color?.[2] ?? 1,
                            ],
                          })
                        }
                        className="w-full mc-input text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs mc-text-dim">{t('props.colorB')}</label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={selectedElement.color?.[2] ?? 1}
                        onChange={(event) =>
                          updateElement(selectedElement.id, {
                            color: [
                              selectedElement.color?.[0] ?? 1,
                              selectedElement.color?.[1] ?? 1,
                              Number(event.target.value),
                            ],
                          })
                        }
                        className="w-full mc-input text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              {(selectedElement.type === 'collection_panel' ||
                selectedElement.type === 'chest_grid_item') && (
                <div className="space-y-2">
                  <label className="text-xs mc-text-dim">{t('props.collectionName')}</label>
                  <input
                    type="text"
                    value={selectedElement.collection_name || ''}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        collection_name: event.target.value,
                      })
                    }
                    className="w-full mc-input text-xs"
                  />
                </div>
              )}

              {selectedElement.type === 'chest_grid_item' && (
                <div className="space-y-2">
                  <label className="text-xs mc-text-dim">{t('props.collectionIndex')}</label>
                  <input
                    type="number"
                    value={selectedElement.collection_index ?? 0}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        collection_index: Number(event.target.value),
                      })
                    }
                    className="w-full mc-input text-sm"
                  />
                </div>
              )}

              {selectedElement.type === 'image' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs mc-text-dim">{t('props.texturePath')}</label>
                    <input
                      type="text"
                      value={selectedElement.texture || ''}
                      onChange={(event) =>
                        updateElement(selectedElement.id, {
                          texture: event.target.value,
                        })
                      }
                      className="w-full mc-input text-xs"
                    />
                  </div>

                  <div className="mt-4 pt-4 mc-border-h">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider mc-text-dim">
                      {t('props.uvCropping')}
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs mc-text-dim">{t('props.uvX')}</label>
                        <input
                          type="number"
                          value={selectedElement.uv?.[0] ?? 0}
                          onChange={(event) =>
                            updateElement(selectedElement.id, {
                              uv: [
                                Number(event.target.value),
                                selectedElement.uv?.[1] ?? 0,
                              ],
                            })
                          }
                          className="w-full mc-input text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs mc-text-dim">{t('props.uvY')}</label>
                        <input
                          type="number"
                          value={selectedElement.uv?.[1] ?? 0}
                          onChange={(event) =>
                            updateElement(selectedElement.id, {
                              uv: [
                                selectedElement.uv?.[0] ?? 0,
                                Number(event.target.value),
                              ],
                            })
                          }
                          className="w-full mc-input text-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs mc-text-dim">{t('props.uvWidth')}</label>
                        <input
                          type="number"
                          value={selectedElement.uv_size?.[0] ?? 0}
                          onChange={(event) =>
                            updateElement(selectedElement.id, {
                              uv_size: [
                                Number(event.target.value),
                                selectedElement.uv_size?.[1] ?? 0,
                              ],
                            })
                          }
                          className="w-full mc-input text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs mc-text-dim">{t('props.uvHeight')}</label>
                        <input
                          type="number"
                          value={selectedElement.uv_size?.[1] ?? 0}
                          onChange={(event) =>
                            updateElement(selectedElement.id, {
                              uv_size: [
                                selectedElement.uv_size?.[0] ?? 0,
                                Number(event.target.value),
                              ],
                            })
                          }
                          className="w-full mc-input text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        </div>
      </aside>

      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="flex max-h-full w-full max-w-3xl flex-col mc-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 mc-border-h">
              <h3 className="text-lg font-semibold mc-text">{t('props.jsonPreview')}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="mc-btn p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm mc-text">
                {jsonPreview}
              </pre>
            </div>

            <div className="mc-border-h" />
            <div className="flex justify-end gap-2 p-4">
              <button
                onClick={() => setShowPreview(false)}
                className="mc-btn text-sm"
              >
                {t('btn.close')}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(jsonPreview).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="mc-btn mc-btn-blue text-sm"
              >
                {copied ? t('btn.copied') : t('btn.copyToClipboard')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      <Footer />
    </div>
  );
}

export default App;
