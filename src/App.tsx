import {
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Languages,
  LayoutDashboard,
  Layers,
  MousePointer2,
  Plus,
  Save,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import { CanvasElement, COMPONENT_DRAG_MIME } from './components/CanvasElement';
import { TexturePanel } from './components/TexturePanel';
import { useI18nStore, useT } from './lib/i18n';
import {
  loadResourcePack,
  loadTextureAssets,
  saveUiFile,
} from './lib/loadResourcePack';
import { serializeUiFile } from './lib/serializeUiFile';
import {
  ADDABLE_ELEMENT_TYPES,
  ANCHOR_OPTIONS,
  findElementById,
  findParentIdByChildId,
  flattenElements,
  getDefaultElementSize,
  isContainerElement,
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

  const [showPreview, setShowPreview] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingType, setDraggingType] = useState<ElementType | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const selectedElement = findElementById(elements, selectedId);
  const insertParentId = getInsertParentId(elements, selectedId);
  const insertParentElement = findElementById(elements, insertParentId);
  const currentFile = project?.uiFiles.find((file) => file.name === activeFile) || null;
  const currentNamespace = currentFile?.parsed.namespace || '';
  const jsonPreview = currentFile
    ? serializeUiFile(currentFile.parsed, elements, canvasSize)
    : '';
  const elementCount = flattenElements(elements).length;

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
          setActiveFile(firstScreen.name);
        }
      }

      setStatusMessage(t('status.resourcePackLoaded'));
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

  function handleExport() {
    if (!activeFile) return;

    const blob = new Blob([jsonPreview], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = activeFile;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusMessage(t('status.exported', { file: activeFile }));
  }

  async function handleSave() {
    if (!project || !activeFile) return;

    try {
      setSaving(true);
      await saveUiFile(project.dirHandle, activeFile, jsonPreview);
      setStatusMessage(t('status.saved', { file: activeFile }));
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
    const targetParent = parentId ? findElementById(elements, parentId) : null;
    const parentSize = targetParent?.size || canvasSize;
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
    const parentSize = insertParentElement?.size || canvasSize;
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
      Math.round(event.clientX - rect.left),
      Math.round(event.clientY - rect.top),
    ]);
    setDraggingType(null);
  }

  function renderElementTree(items: UIElement[], depth = 0): ReactNode {
    return items.map((element) => (
      <li key={element.id}>
        <button
          type="button"
          onClick={() => selectElement(element.id)}
          className={`flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs transition-colors ${
            selectedId === element.id
              ? 'bg-blue-600/20 text-blue-400'
              : 'hover:bg-zinc-800'
          }`}
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
        >
          <Layers className="h-3 w-3 opacity-70" />
          <span className="min-w-0 flex-1 truncate">{element.name}</span>
          <span className="text-[10px] text-zinc-600">{element.type}</span>
        </button>
        {element.children.length > 0 && (
          <ul className="space-y-1">{renderElementTree(element.children, depth + 1)}</ul>
        )}
      </li>
    ));
  }

  const insertTargetLabel = insertParentElement
    ? `${insertParentElement.name} (${insertParentElement.type})`
    : t('sidebar.rootCanvas');

  return (
    <div className="flex h-screen w-full select-none bg-zinc-950 text-zinc-300">
      <aside className="flex w-72 flex-col border-r border-zinc-800 bg-zinc-900/50">
        <div className="border-b border-zinc-800 p-4">
          <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-100">
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
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {t('sidebar.uiFiles')}
                </h2>
                <ul className="space-y-1 text-sm">
                  {project.uiFiles.map((file) => (
                    <li
                      key={file.name}
                      onClick={() => setActiveFile(file.name)}
                      className={`flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 ${
                        activeFile === file.name
                          ? 'bg-blue-600/20 font-medium text-blue-400'
                          : 'hover:bg-zinc-800'
                      }`}
                    >
                      <Layers className="h-3 w-3 opacity-70" />
                      <span className="truncate">{file.name}</span>
                      <span className="ml-auto text-[10px] text-zinc-500">
                        {file.parsed.namespace}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {t('sidebar.components')}
                </h2>
                <span className="text-[10px] text-zinc-600">
                  {t('sidebar.target', { label: insertTargetLabel })}
                </span>
              </div>

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
                    className="flex w-full items-center gap-3 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <div className="rounded bg-zinc-800 p-1.5 text-blue-400">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-zinc-200">
                        {t(`element.${type}.label`)}
                      </div>
                      <div className="truncate text-[11px] text-zinc-500">
                        {t(`element.${type}.desc`)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <p className="mt-2 text-[10px] leading-4 text-zinc-600">
                {t('sidebar.dragHint')}
              </p>
            </div>

            {elementCount > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {t('sidebar.elements', { count: elementCount })}
                </h2>
                <ul className="space-y-1">{renderElementTree(elements)}</ul>
              </div>
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
          className="absolute right-0 top-1/2 z-50 flex h-16 w-5 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-zinc-800 bg-zinc-900/90 text-zinc-500 shadow-md backdrop-blur transition-all hover:bg-zinc-800 hover:text-zinc-300"
          title={t('btn.toggleRightSidebar')}
        >
          {isRightSidebarOpen ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        <header
          className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {activeFile || t('header.noFileSelected')}
            </span>
            {currentNamespace && (
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                ns: {currentNamespace}
              </span>
            )}
            <span className="text-xs text-zinc-500">
              {t('header.elements', { count: elementCount })}
            </span>
            {statusMessage && (
              <span className="text-xs text-emerald-400">{statusMessage}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
              className="flex items-center gap-1.5 rounded bg-zinc-800 px-2.5 py-1.5 text-xs transition-colors hover:bg-zinc-700"
            >
              <Languages className="h-3.5 w-3.5" />
              {locale === 'zh' ? 'EN' : '中文'}
            </button>
            <button
              onClick={() => setShowPreview(true)}
              disabled={!activeFile}
              className="rounded bg-zinc-800 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-700 disabled:opacity-40"
            >
              {t('btn.preview')}
            </button>
            <button
              onClick={handleSave}
              disabled={!activeFile || saving}
              className="flex items-center gap-2 rounded bg-emerald-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              {saving ? t('btn.saving') : t('btn.save')}
            </button>
            <button
              onClick={handleExport}
              disabled={!activeFile}
              className="flex items-center gap-2 rounded bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              {t('btn.export')}
            </button>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-zinc-950 p-8">
          {activeFile ? (
            <div
              className={`relative overflow-hidden border bg-zinc-900 shadow-2xl transition-colors ${
                draggingType
                  ? 'border-emerald-400/60 ring-2 ring-emerald-500/20'
                  : 'border-zinc-800'
              }`}
              style={{ width: canvasSize[0], height: canvasSize[1] }}
              onClick={(event) => event.stopPropagation()}
              onDragOver={(event) => {
                if (!draggingType) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={handleRootDrop}
            >
              {elements.map((element) => (
                <CanvasElement
                  key={element.id}
                  el={element}
                  parentSize={canvasSize}
                  selectedId={selectedId}
                  draggingType={draggingType}
                  onSelect={selectElement}
                  onDragStop={handleDragStop}
                  onResizeStop={handleResizeStop}
                  onDropNewElement={createElementAt}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-zinc-600">
              <FolderOpen className="h-16 w-16 opacity-20" />
              <p className="text-lg">{t('sidebar.openHint')}</p>
              <p className="text-sm text-zinc-700">
                {t('sidebar.openHintSub')}
              </p>
            </div>
          )}
        </div>
      </main>

      <aside
        className={`flex flex-col overflow-hidden border-zinc-800 bg-zinc-900/50 transition-all duration-300 ${
          isRightSidebarOpen ? 'w-80 border-l' : 'w-0 border-l-0'
        }`}
      >
        <div className="flex h-full w-80 flex-col">
          <div className="border-b border-zinc-800 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Settings className="h-4 w-4" />
              {t('props.title')}
            </h2>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          {!selectedElement ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-zinc-500">
              <MousePointer2 className="h-8 w-8 opacity-20" />
              <p>{t('props.selectHint')}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                <div>
                  <p className="text-xs text-zinc-500">{t('props.selected')}</p>
                  <p className="text-sm text-zinc-200">{selectedElement.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeElement(selectedElement.id)}
                  className="rounded p-2 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-400">{t('props.name')}</label>
                <input
                  type="text"
                  value={selectedElement.name}
                  onChange={(event) =>
                    updateElement(selectedElement.id, { name: event.target.value })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-200"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-400">{t('props.type')}</label>
                <select
                  value={selectedElement.type}
                  onChange={(event) =>
                    updateElement(selectedElement.id, {
                      type: event.target.value as ElementType,
                    })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-200"
                >
                  <option value="panel">panel</option>
                  <option value="image">image</option>
                  <option value="label">label</option>
                  <option value="collection_panel">collection_panel</option>
                  <option value="chest_grid_item">chest_grid_item</option>
                  <option value="factory">factory</option>
                  <option value="grid">grid</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-400">{t('props.inheritsFrom')}</label>
                <input
                  type="text"
                  value={selectedElement.inheritsFrom || ''}
                  onChange={(event) =>
                    updateElement(selectedElement.id, {
                      inheritsFrom: event.target.value || undefined,
                    })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">{t('props.anchorFrom')}</label>
                  <select
                    value={selectedElement.anchor_from || 'top_left'}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        anchor_from: event.target.value as UIElement['anchor_from'],
                      })
                    }
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-200"
                  >
                    {ANCHOR_OPTIONS.map((anchor) => (
                      <option key={anchor} value={anchor}>
                        {anchor}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">{t('props.anchorTo')}</label>
                  <select
                    value={selectedElement.anchor_to || 'top_left'}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        anchor_to: event.target.value as UIElement['anchor_to'],
                      })
                    }
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-200"
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
                <label className="text-xs text-zinc-400">{t('props.layer')}</label>
                <input
                  type="number"
                  value={selectedElement.layer ?? 1}
                  onChange={(event) =>
                    updateElement(selectedElement.id, {
                      layer: Number(event.target.value),
                    })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">{t('props.sizeX')}</label>
                  <input
                    type="number"
                    value={selectedElement.size[0]}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        size: [Number(event.target.value), selectedElement.size[1]],
                      })
                    }
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">{t('props.sizeY')}</label>
                  <input
                    type="number"
                    value={selectedElement.size[1]}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        size: [selectedElement.size[0], Number(event.target.value)],
                      })
                    }
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">{t('props.offsetX')}</label>
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
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">{t('props.offsetY')}</label>
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
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
                  />
                </div>
              </div>

              {selectedElement.type === 'label' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400">{t('props.text')}</label>
                    <input
                      type="text"
                      value={selectedElement.text || ''}
                      onChange={(event) =>
                        updateElement(selectedElement.id, {
                          text: event.target.value,
                        })
                      }
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400">{t('props.colorR')}</label>
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
                        className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400">{t('props.colorG')}</label>
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
                        className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400">{t('props.colorB')}</label>
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
                        className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
                      />
                    </div>
                  </div>
                </>
              )}

              {(selectedElement.type === 'collection_panel' ||
                selectedElement.type === 'chest_grid_item') && (
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">{t('props.collectionName')}</label>
                  <input
                    type="text"
                    value={selectedElement.collection_name || ''}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        collection_name: event.target.value,
                      })
                    }
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs"
                  />
                </div>
              )}

              {selectedElement.type === 'chest_grid_item' && (
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">{t('props.collectionIndex')}</label>
                  <input
                    type="number"
                    value={selectedElement.collection_index ?? 0}
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        collection_index: Number(event.target.value),
                      })
                    }
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
                  />
                </div>
              )}

              {selectedElement.type === 'image' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400">{t('props.texturePath')}</label>
                    <input
                      type="text"
                      value={selectedElement.texture || ''}
                      onChange={(event) =>
                        updateElement(selectedElement.id, {
                          texture: event.target.value,
                        })
                      }
                      className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs"
                    />
                  </div>

                  <div className="mt-4 border-t border-zinc-800 pt-4">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      {t('props.uvCropping')}
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs text-zinc-400">{t('props.uvX')}</label>
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
                          className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-zinc-400">{t('props.uvY')}</label>
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
                          className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs text-zinc-400">{t('props.uvWidth')}</label>
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
                          className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-zinc-400">{t('props.uvHeight')}</label>
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
                          className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="flex max-h-full w-full max-w-3xl flex-col rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <h3 className="text-lg font-semibold text-zinc-100">{t('props.jsonPreview')}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-300">
                {jsonPreview}
              </pre>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-800 p-4">
              <button
                onClick={() => setShowPreview(false)}
                className="rounded bg-zinc-800 px-4 py-2 text-sm transition-colors hover:bg-zinc-700"
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
