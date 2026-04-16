import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Upload, Trash2, ChevronDown, ChevronRight, Folder, FolderOpen, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useT } from '../lib/i18n';
import { useStore } from '../store/useStore';
import type { TextureAsset } from '../store/useStore';
import { useTextureLoader } from './useTextureLoader';
import { SidebarSection } from './SidebarSection';

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  asset?: TextureAsset;
}

function buildTextureTree(entries: TextureAsset[]): TreeNode {
  const root: TreeNode = { name: '', path: '', children: new Map() };

  for (const asset of entries) {
    const parts = asset.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const childPath = parts.slice(0, i + 1).join('/');

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: childPath,
          children: new Map(),
          asset: i === parts.length - 1 ? asset : undefined,
        });
      } else if (i === parts.length - 1) {
        current.children.get(part)!.asset = asset;
      }

      current = current.children.get(part)!;
    }
  }

  return root;
}

function sortedChildren(node: TreeNode): TreeNode[] {
  return [...node.children.values()].sort((a, b) => {
    const aIsFolder = a.children.size > 0;
    const bIsFolder = b.children.size > 0;
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

type FitMode = 'fit' | 'actual';

const FIT_MODES: FitMode[] = ['fit', 'actual'];
const FIT_MODE_I18N: Record<FitMode, string> = {
  fit: 'texture.preview.fitWindow',
  actual: 'texture.preview.actualSize',
};

const MIN_ZOOM = 0.01;
const MAX_ZOOM = 100;
const ZOOM_FACTOR = 1.25;
const FIT_MODE_STORAGE_KEY = 'jsonui_texture_preview_fit_mode';

function calcFitZoom(mode: FitMode, cw: number, ch: number, nw: number, nh: number): number {
  const w = nw || 1;
  const h = nh || 1;
  switch (mode) {
    case 'fit':    return Math.min(cw / w, ch / h);
    case 'actual': return 1;
  }
}

function loadSavedFitMode(): FitMode {
  try {
    const saved = localStorage.getItem(FIT_MODE_STORAGE_KEY);
    if (saved && FIT_MODES.includes(saved as FitMode)) return saved as FitMode;
  } catch { /* ignore */ }
  return 'fit';
}

function TexturePreviewModal({ asset, onClose }: { asset: TextureAsset; onClose: () => void }) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<[number, number]>([640, 480]);
  const [fitMode, setFitMode] = useState<FitMode>(loadSavedFitMode);
  // 用户手动缩放覆盖（null 表示使用自动计算的缩放）
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const [offset, setOffset] = useState<[number, number]>([0, 0]);

  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const last = useRef<[number, number]>([0, 0]);

  // 切换图片时重置手动缩放（React 推荐的渲染期间调整状态模式）
  const [prevAsset, setPrevAsset] = useState(asset);
  if (prevAsset !== asset) {
    setPrevAsset(asset);
    setUserZoom(null);
    setOffset([0, 0]);
  }

  const clampZoom = useCallback((z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)), []);

  // 根据适配模式自动计算的缩放值
  const autoZoom = useMemo(
    () => calcFitZoom(fitMode, containerSize[0], containerSize[1], asset.naturalWidth, asset.naturalHeight),
    [fitMode, containerSize, asset.naturalWidth, asset.naturalHeight],
  );

  // 最终缩放：用户手动覆盖 || 自动计算
  const zoom = clampZoom(userZoom ?? autoZoom);

  // 保持 autoZoom 引用供事件回调使用
  const autoZoomRef = useRef(autoZoom);
  useEffect(() => { autoZoomRef.current = autoZoom; }, [autoZoom]);

  // 测量容器实际尺寸
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setContainerSize([width, height]);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 鼠标滚轮缩放
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
      setUserZoom((prev) => clampZoom(Math.round((prev ?? autoZoomRef.current) * factor * 1000) / 1000));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampZoom]);

  const handleFitModeChange = useCallback((mode: FitMode) => {
    setFitMode(mode);
    setUserZoom(null);
    setOffset([0, 0]);
    try { localStorage.setItem(FIT_MODE_STORAGE_KEY, mode); } catch { /* ignore */ }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    draggingRef.current = true;
    setIsDragging(true);
    last.current = [e.clientX, e.clientY];
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - last.current[0];
    const dy = e.clientY - last.current[1];
    last.current = [e.clientX, e.clientY];
    setOffset((prev) => [prev[0] + dx, prev[1] + dy]);
  }, []);

  const handleMouseUp = useCallback(() => {
    draggingRef.current = false;
    setIsDragging(false);
  }, []);

  const resetView = useCallback(() => {
    setUserZoom(null);
    setOffset([0, 0]);
  }, []);

  const displayW = Math.round(asset.naturalWidth * zoom);
  const displayH = Math.round(asset.naturalHeight * zoom);
  const isPannable = displayW > containerSize[0] || displayH > containerSize[1];

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="mc-panel relative max-w-[90vw] max-h-[90vh] p-3 flex flex-col gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部栏 */}
        <div className="flex items-center justify-between gap-2 flex-none">
          <p className="text-xs mc-text truncate flex-1 min-w-0">{asset.path}</p>
          <div className="flex items-center gap-1 flex-shrink-0">
            {FIT_MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => handleFitModeChange(mode)}
                className={`mc-btn px-1.5 py-0.5 text-[10px] whitespace-nowrap ${fitMode === mode ? 'brightness-150' : 'opacity-50'}`}
                title={t(FIT_MODE_I18N[mode])}
              >
                {t(FIT_MODE_I18N[mode])}
              </button>
            ))}
            <span className="text-[10px] mc-text-dim mx-0.5 select-none">|</span>
            <span className="text-[10px] mc-text-dim tabular-nums w-8 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setUserZoom((prev) => clampZoom((prev ?? autoZoomRef.current) / ZOOM_FACTOR))}
              disabled={zoom <= MIN_ZOOM}
              className="mc-btn p-1 disabled:opacity-40"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button onClick={resetView} className="mc-btn p-1" title={t('texture.preview.reset')}>
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setUserZoom((prev) => clampZoom((prev ?? autoZoomRef.current) * ZOOM_FACTOR))}
              disabled={zoom >= MAX_ZOOM}
              className="mc-btn p-1 disabled:opacity-40"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="mc-btn p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 图片容器 */}
        <div
          ref={containerRef}
          className="overflow-hidden mc-input relative"
          style={{ width: '80vw', maxWidth: 640, height: '60vh', maxHeight: 480, cursor: isPannable ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={asset.objectUrl}
            alt={asset.path}
            draggable={false}
            className="absolute select-none pointer-events-none"
            style={{
              imageRendering: 'pixelated',
              left: '50%',
              top: '50%',
              width: asset.naturalWidth || 1,
              height: asset.naturalHeight || 1,
              transform: `translate(calc(-50% + ${offset[0]}px), calc(-50% + ${offset[1]}px)) scale(${zoom})`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            }}
          />
        </div>

        {/* 底部信息 */}
        <p className="text-[10px] mc-text-dim text-center flex-none">
          {asset.naturalWidth}×{asset.naturalHeight} → {displayW}×{displayH}
        </p>
      </div>
    </div>
  );
}

function TextureTreeNode({
  node,
  depth,
  expanded,
  toggleExpand,
  removeTexture,
  onPreview,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (path: string) => void;
  removeTexture: (path: string) => void;
  onPreview: (asset: TextureAsset) => void;
}) {
  const isFolder = node.children.size > 0;
  const isOpen = expanded.has(node.path);
  const items = sortedChildren(node);

  if (isFolder) {
    return (
      <li>
        <div
          className="flex items-center gap-1.5 px-1 py-1 cursor-pointer hover:brightness-125 rounded"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => toggleExpand(node.path)}
        >
          {isOpen ? (
            <ChevronDown className="w-3 h-3 flex-shrink-0 mc-text-dim" />
          ) : (
            <ChevronRight className="w-3 h-3 flex-shrink-0 mc-text-dim" />
          )}
          {isOpen ? (
            <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 mc-text-dim" />
          ) : (
            <Folder className="w-3.5 h-3.5 flex-shrink-0 mc-text-dim" />
          )}
          <span className="text-xs mc-text truncate">{node.name}</span>
          <span className="text-[10px] mc-text-dim ml-auto">
            {node.children.size}
          </span>
        </div>
        {isOpen && (
          <ul>
            {items.map((child) => (
              <TextureTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                toggleExpand={toggleExpand}
                removeTexture={removeTexture}
                onPreview={onPreview}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li
      className="group flex items-center gap-2 py-1 rounded hover:brightness-125 cursor-pointer"
      style={{ paddingLeft: `${depth * 12 + 4}px`, paddingRight: '4px' }}
      onClick={() => node.asset && onPreview(node.asset)}
    >
      {node.asset && (
        <img
          src={node.asset.objectUrl}
          alt=""
          className="w-6 h-6 object-cover flex-shrink-0 mc-input"
          style={{ imageRendering: 'pixelated' }}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs mc-text truncate">{node.name}</p>
        {node.asset && (
          <p className="text-[10px] mc-text-dim">
            {node.asset.naturalWidth}×{node.asset.naturalHeight}
          </p>
        )}
      </div>
      <ZoomIn className="w-3 h-3 mc-text-dim opacity-0 group-hover:opacity-100 flex-shrink-0" />
      <button
        onClick={(e) => {
          e.stopPropagation();
          removeTexture(node.path);
        }}
        className="mc-btn mc-btn-danger p-1 opacity-0 group-hover:opacity-100 flex-shrink-0"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </li>
  );
}

export function TexturePanel() {
  const textureMap = useStore((s) => s.textureMap);
  const removeTexture = useStore((s) => s.removeTexture);
  const { loadFiles } = useTextureLoader();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const entries = Object.values(textureMap);
  const tree = buildTextureTree(entries);
  const rootItems = sortedChildren(tree);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<TextureAsset | null>(null);

  // 纹理变化时自动展开第一级目录（渲染期间调整状态）
  const rootFoldersKey = useMemo(
    () => rootItems.filter((c) => c.children.size > 0).map((c) => c.path).join(','),
    [rootItems],
  );
  const [prevFoldersKey, setPrevFoldersKey] = useState(rootFoldersKey);
  if (prevFoldersKey !== rootFoldersKey) {
    setPrevFoldersKey(rootFoldersKey);
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const child of rootItems) {
        if (child.children.size > 0) {
          next.add(child.path);
        }
      }
      return next;
    });
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      loadFiles(e.dataTransfer.files);
    }
  };

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <SidebarSection title={t('texture.title')}>
      <div className="space-y-3">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="mc-input cursor-pointer p-3 text-center"
        >
          <Upload className="w-5 h-5 mx-auto mb-1 opacity-40" />
          <p className="text-xs mc-text-dim">{t('texture.dropHint')}</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) loadFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {entries.length > 0 && (
          <ul>
            {rootItems.map((child) => (
              <TextureTreeNode
                key={child.path}
                node={child}
                depth={0}
                expanded={expanded}
                toggleExpand={toggleExpand}
                removeTexture={removeTexture}
                onPreview={setPreview}
              />
            ))}
          </ul>
        )}
      </div>

      {preview && (
        <TexturePreviewModal
          asset={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </SidebarSection>
  );
}
