import {
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
  } = useStore();

  const t = useT();
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [showPreview, setShowPreview] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isEditorToolbarCollapsed, setIsEditorToolbarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingType, setDraggingType] = useState<ElementType | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
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
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const backgroundLoadVersionRef = useRef(0);
  const editorCanvasAreaRef = useRef<HTMLDivElement | null>(null);
  const editorToolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

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
  const currentNamespace = currentFile?.parsed.namespace || '';
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
      setStatusMessage(null);

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

      setStatusMessage(
        loadedProject.skippedFiles.length > 0
          ? t('status.resourcePackLoadedWithWarnings', {
              count: loadedProject.skippedFiles.length,
            })
          : t('status.resourcePackLoaded'),
      );
    } catch (error: unknown) {
      const typedError = error as { name?: string };
      if (typedError.name !== 'AbortError') {
        console.error(error);
        setStatusMessage(t('status.loadFailed'));
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

  function handleExport() {
    if (!currentFile) return;

    const blob = new Blob([jsonPreview], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = currentFile.name;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusMessage(t('status.exported', { file: currentFile.path }));
  }

  async function handleSave() {
    if (!project || !currentFile) return;

    try {
      setSaving(true);
      await saveUiFile(project.dirHandle, currentFile.path, jsonPreview);
      setStatusMessage(t('status.saved', { file: currentFile.path }));
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
    setStatusMessage(t('status.added', { type: t(`element.${type}.label`) }));
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
    setStatusMessage(
      parentId
        ? t('status.addedToContainer', { name: insertParentElement?.name || parentId })
        : t('status.addedToRoot'),
    );
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
      setStatusMessage(t('status.canvasBackgroundLoadFailed'));
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
      setStatusMessage(t('status.canvasBackgroundLoaded', { file: file.name }));
    };

    image.onerror = () => {
      if (backgroundLoadVersionRef.current !== nextLoadVersion) {
        URL.revokeObjectURL(objectUrl);
        return;
      }

      URL.revokeObjectURL(objectUrl);
      setStatusMessage(t('status.canvasBackgroundLoadFailed'));
    };

    image.src = objectUrl;
    event.target.value = '';
  }

  function handleClearCanvasBackground() {
    backgroundLoadVersionRef.current += 1;
    setCanvasBackground(null);
    setStatusMessage(t('status.canvasBackgroundCleared'));
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
    <div className="flex h-screen w-full select-none bg-zinc-100 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
      <aside className="flex w-72 flex-col border-r border-zinc-200 bg-white/50 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            <LayoutDashboard className="h-5 w-5" />
            {t('app.title')}
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            <button
              onClick={handleOpenProject}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
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
                          ? 'bg-blue-600/20 font-medium text-blue-400'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Layers className="h-3 w-3 opacity-70" />
                      <span className="truncate">{file.name}</span>
                      <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">
                        {file.parsed.namespace}
                      </span>
                    </li>
                  ))}
                </ul>
              </SidebarSection>
            )}

            <SidebarSection
              title={t('sidebar.components')}
              extra={
                <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-normal normal-case tracking-normal">
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
                    className="flex w-full items-center gap-3 rounded border border-zinc-200 bg-white px-3 py-2 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <div className="rounded bg-zinc-100 p-1.5 text-blue-400 dark:bg-zinc-800">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-zinc-800 dark:text-zinc-200">
                        {t(`element.${type}.label`)}
                      </div>
                      <div className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">
                        {t(`element.${type}.desc`)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <p className="mt-2 text-[10px] leading-4 text-zinc-400 dark:text-zinc-600">
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
        className="relative flex flex-1 flex-col overflow-hidden"
        onClick={() => selectElement(null)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsRightSidebarOpen(!isRightSidebarOpen);
          }}
          className="absolute right-0 top-1/2 z-50 flex h-16 w-5 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-zinc-200 bg-white/90 text-zinc-400 shadow-md backdrop-blur transition-all hover:bg-zinc-50 hover:text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          title={t('btn.toggleRightSidebar')}
        >
          {isRightSidebarOpen ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        <header
          className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white/50 px-4 dark:border-zinc-800 dark:bg-zinc-900/50"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {currentFile?.path || t('header.noFileSelected')}
            </span>
            {currentNamespace && (
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                ns: {currentNamespace}
              </span>
            )}
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {t('header.elements', { count: elementCount })}
            </span>
            {statusMessage && (
              <span className="text-xs text-emerald-500 dark:text-emerald-400">{statusMessage}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 rounded bg-zinc-100 px-2.5 py-1.5 text-xs transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              title={theme === 'dark' ? t('btn.switchToLight') : t('btn.switchToDark')}
            >
              {theme === 'dark' ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
              {theme === 'dark' ? t('btn.lightMode') : t('btn.darkMode')}
            </button>
            <button
              onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
              className="flex items-center gap-1.5 rounded bg-zinc-100 px-2.5 py-1.5 text-xs transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <Languages className="h-3.5 w-3.5" />
              {locale === 'zh' ? 'EN' : '中文'}
            </button>
            <button
              onClick={() => setShowPreview(true)}
              disabled={!currentFile}
              className="rounded bg-zinc-100 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-200 disabled:opacity-40 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              {t('btn.preview')}
            </button>
            <button
              onClick={handleSave}
              disabled={!currentFile || saving}
              className="flex items-center gap-2 rounded bg-emerald-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              {saving ? t('btn.saving') : t('btn.save')}
            </button>
            <button
              onClick={handleExport}
              disabled={!currentFile}
              className="flex items-center gap-2 rounded bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              {t('btn.export')}
            </button>
          </div>
        </header>

        <div className="relative flex flex-1 flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950">
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
                    <div className="flex flex-wrap items-center gap-3 rounded-b-xl border border-t-0 border-zinc-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{t('canvas.viewportSize')}</span>
                        <select
                          value={viewportPresetValue}
                          onChange={(event) =>
                            handleViewportPresetChange(event.target.value)
                          }
                          className="rounded border border-zinc-200 bg-white px-2 py-1 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
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
                          className="w-24 rounded border border-zinc-200 bg-white px-2 py-1 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                        />
                        <span>×</span>
                        <input
                          type="number"
                          min="1"
                          value={viewportSize[1]}
                          onChange={(event) =>
                            handleViewportSizeChange(1, event.target.value)
                          }
                          className="w-24 rounded border border-zinc-200 bg-white px-2 py-1 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                        />
                      </div>

                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{t('canvas.guiScale')}</span>
                        <input
                          type="number"
                          min="10"
                          step="5"
                          value={uiScalePercent}
                          onChange={(event) => handleUiScaleChange(event.target.value)}
                          className="w-20 rounded border border-zinc-200 bg-white px-2 py-1 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                        />
                        <span>%</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{t('canvas.editorZoom')}</span>
                        <button
                          type="button"
                          onClick={handleEditorZoomAutoToggle}
                          className={`rounded px-2 py-1 transition-colors ${
                            isEditorZoomAuto
                              ? 'bg-blue-600 text-white hover:bg-blue-500'
                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
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
                          className="w-20 rounded border border-zinc-200 bg-white px-2 py-1 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
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
                        className="flex items-center gap-2 rounded bg-zinc-100 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                      >
                        <ImageIcon className="h-4 w-4" />
                        {t('btn.loadBackground')}
                      </button>

                      {canvasBackground ? (
                        <>
                          <div className="min-w-0">
                            <p className="truncate text-sm text-zinc-700 dark:text-zinc-200">
                              {canvasBackground.name}
                            </p>
                            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                              {canvasBackground.naturalWidth}×{canvasBackground.naturalHeight} ·{' '}
                              {t('canvas.backgroundHint')}
                            </p>
                          </div>

                          <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
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
                              className="w-28 accent-blue-500"
                            />
                            <span>{Math.round(canvasBackgroundOpacity * 100)}%</span>
                          </label>

                          <button
                            type="button"
                            onClick={handleClearCanvasBackground}
                            className="rounded bg-zinc-100 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                          >
                            {t('btn.clearBackground')}
                          </button>
                        </>
                      ) : (
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">
                          {t('canvas.backgroundEmpty')}
                        </p>
                      )}

                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        {t('canvas.logicalScreen')}: {logicalCanvasSize[0]}×{logicalCanvasSize[1]}
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        {t('canvas.uiRoot')}: {logicalRootSize[0]}×{logicalRootSize[1]}
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
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
                  className="z-10 -mt-px flex h-5 w-16 shrink-0 items-center justify-center rounded-b-md border border-t-0 border-zinc-200 bg-white/90 text-zinc-400 shadow-md backdrop-blur transition-all hover:bg-zinc-50 hover:text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
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
                      className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-black shadow-2xl dark:border-zinc-800"
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
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.14),_transparent_42%),linear-gradient(180deg,_rgba(39,39,42,0.92),_rgba(9,9,11,1))]" />
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
                            className={`absolute overflow-hidden border bg-white/8 shadow-2xl transition-colors dark:bg-zinc-900/20 ${
                              draggingType
                                ? 'border-emerald-400/70 ring-2 ring-emerald-500/20'
                                : 'border-white/30'
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
            <div className="mx-auto flex min-h-full w-full flex-col items-center justify-center gap-3 text-zinc-400 dark:text-zinc-600">
              <FolderOpen className="h-16 w-16 opacity-20" />
              <p className="text-lg">{t('sidebar.openHint')}</p>
              <p className="text-sm text-zinc-300 dark:text-zinc-700">
                {t('sidebar.openHintSub')}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>

      <aside
        className={`flex flex-col overflow-hidden border-zinc-200 bg-white/50 transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-900/50 ${
          isRightSidebarOpen ? 'w-80 border-l' : 'w-0 border-l-0'
        }`}
      >
        <div className="flex h-full w-80 flex-col">
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <Settings className="h-4 w-4" />
              {t('props.title')}
            </h2>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          {!selectedElement ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-zinc-400 dark:text-zinc-500">
              <MousePointer2 className="h-8 w-8 opacity-20" />
              <p>{t('props.selectHint')}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">{t('props.selected')}</p>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200">{selectedElement.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeElement(selectedElement.id)}
                  className="rounded p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-400 dark:text-zinc-500 dark:hover:bg-zinc-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.name')}</label>
                <input
                  type="text"
                  value={selectedElement.name}
                  onChange={(event) =>
                    updateElement(selectedElement.id, { name: event.target.value })
                  }
                  className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.type')}</label>
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
                  className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  {ELEMENT_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.inheritsFrom')}</label>
                <input
                  type="text"
                  value={selectedElement.inheritsFrom || ''}
                  onChange={(event) =>
                    updateElement(selectedElement.id, {
                      inheritsFrom: event.target.value || undefined,
                    })
                  }
                  className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.anchorFrom')}</label>
                  <select
                    value={selectedElement.anchor_from || 'center'}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        anchor_from: event.target.value as UIElement['anchor_from'],
                      })
                    }
                    className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                  >
                    {ANCHOR_OPTIONS.map((anchor) => (
                      <option key={anchor} value={anchor}>
                        {anchor}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.anchorTo')}</label>
                  <select
                    value={selectedElement.anchor_to || 'center'}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        anchor_to: event.target.value as UIElement['anchor_to'],
                      })
                    }
                    className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
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
                <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.layer')}</label>
                <input
                  type="number"
                  value={selectedElement.layer ?? 1}
                  onChange={(event) =>
                    updateElement(selectedElement.id, {
                      layer: Number(event.target.value),
                    })
                  }
                  className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.sizeX')}</label>
                  <input
                    type="number"
                    value={selectedElement.size[0]}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        size: [Number(event.target.value), selectedElement.size[1]],
                      })
                    }
                    className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.sizeY')}</label>
                  <input
                    type="number"
                    value={selectedElement.size[1]}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        size: [selectedElement.size[0], Number(event.target.value)],
                      })
                    }
                    className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.offsetX')}</label>
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
                    className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.offsetY')}</label>
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
                    className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
              </div>

              {selectedElement.type === 'label' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.text')}</label>
                    <input
                      type="text"
                      value={selectedElement.text || ''}
                      onChange={(event) =>
                        updateElement(selectedElement.id, {
                          text: event.target.value,
                        })
                      }
                      className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.colorR')}</label>
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
                        className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.colorG')}</label>
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
                        className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.colorB')}</label>
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
                        className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
                      />
                    </div>
                  </div>
                </>
              )}

              {(selectedElement.type === 'collection_panel' ||
                selectedElement.type === 'chest_grid_item') && (
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.collectionName')}</label>
                  <input
                    type="text"
                    value={selectedElement.collection_name || ''}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        collection_name: event.target.value,
                      })
                    }
                    className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
              )}

              {selectedElement.type === 'chest_grid_item' && (
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.collectionIndex')}</label>
                  <input
                    type="number"
                    value={selectedElement.collection_index ?? 0}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        collection_index: Number(event.target.value),
                      })
                    }
                    className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
              )}

              {selectedElement.type === 'image' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.texturePath')}</label>
                    <input
                      type="text"
                      value={selectedElement.texture || ''}
                      onChange={(event) =>
                        updateElement(selectedElement.id, {
                          texture: event.target.value,
                        })
                      }
                      className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </div>

                  <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {t('props.uvCropping')}
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.uvX')}</label>
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
                          className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.uvY')}</label>
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
                          className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.uvWidth')}</label>
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
                          className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-zinc-500 dark:text-zinc-400">{t('props.uvHeight')}</label>
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
                          className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-8 dark:bg-black/80"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="flex max-h-full w-full max-w-3xl flex-col rounded-lg border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t('props.jsonPreview')}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-700 dark:text-zinc-300">
                {jsonPreview}
              </pre>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 p-4 dark:border-zinc-800">
              <button
                onClick={() => setShowPreview(false)}
                className="rounded bg-zinc-100 px-4 py-2 text-sm transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                {t('btn.close')}
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(jsonPreview)}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-500"
              >
                {t('btn.copyToClipboard')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
