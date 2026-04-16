import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent, MouseEvent } from 'react';
import { Rnd } from 'react-rnd';
import { Image as ImageIcon } from 'lucide-react';
import { getTextureLookupCandidates } from '../lib/texturePath';
import {
  applyAnchor,
  isContainerElement,
  resolveOffsetFromPosition,
  useStore,
} from '../store/useStore';
import type { ElementType, UIElement } from '../store/useStore';

export const COMPONENT_DRAG_MIME = 'application/x-jsonui-component-type';

interface StandardImageCanvasProps {
  objectUrl: string;
  name: string;
  uvX: number;
  uvY: number;
  sourceUvW: number;
  sourceUvH: number;
  size: [number, number];
  bilinear: boolean;
  clipStyle?: CSSProperties;
  filterStr?: string;
  keepRatio: boolean;
  fill: boolean;
}

function StandardImageCanvas({
  objectUrl,
  name,
  uvX,
  uvY,
  sourceUvW,
  sourceUvH,
  size,
  bilinear,
  clipStyle,
  filterStr,
  keepRatio,
  fill,
}: StandardImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const displayW = Math.max(1, Math.round(size[0]));
    const displayH = Math.max(1, Math.round(size[1]));
    const dpr = window.devicePixelRatio || 1;
    const pixelW = Math.max(1, Math.round(displayW * dpr));
    const pixelH = Math.max(1, Math.round(displayH * dpr));

    canvas.width = pixelW;
    canvas.height = pixelH;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = new Image();
    image.decoding = 'async';

    let cancelled = false;
    image.onload = () => {
      if (cancelled) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, displayW, displayH);
      ctx.imageSmoothingEnabled = bilinear;
      if (bilinear) {
        ctx.imageSmoothingQuality = 'high';
      }

      const scaleXRaw = displayW / sourceUvW;
      const scaleYRaw = displayH / sourceUvH;
      const uniformScale = keepRatio
        ? fill
          ? Math.max(scaleXRaw, scaleYRaw)
          : Math.min(scaleXRaw, scaleYRaw)
        : null;
      const scaleX = uniformScale ?? scaleXRaw;
      const scaleY = uniformScale ?? scaleYRaw;
      const destW = sourceUvW * scaleX;
      const destH = sourceUvH * scaleY;
      const offsetX = keepRatio ? (displayW - destW) / 2 : 0;
      const offsetY = keepRatio ? (displayH - destH) / 2 : 0;

      ctx.drawImage(
        image,
        uvX,
        uvY,
        sourceUvW,
        sourceUvH,
        offsetX,
        offsetY,
        destW,
        destH,
      );
    };
    image.src = objectUrl;

    return () => {
      cancelled = true;
    };
  }, [bilinear, fill, keepRatio, objectUrl, size, sourceUvH, sourceUvW, uvX, uvY]);

  return (
    <div className="absolute inset-0 overflow-hidden" style={clipStyle}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        draggable={false}
        style={{ filter: filterStr }}
        aria-label={name}
      />
    </div>
  );
}

interface Props {
  el: UIElement;
  parentSize: [number, number];
  selectedId: string | null;
  draggingType: ElementType | null;
  canvasScale: number;
  parentAlpha?: number;
  onSelect: (id: string) => void;
  onDragStop: (id: string, offset: [number, number]) => void;
  onResizeStop: (
    id: string,
    size: [number, number],
    offset: [number, number],
  ) => void;
  onDropNewElement: (
    type: ElementType,
    parentId: string | null,
    position: [number, number],
  ) => void;
}

export function CanvasElement({
  el,
  parentSize,
  selectedId,
  draggingType,
  canvasScale,
  parentAlpha = 1,
  onSelect,
  onDragStop,
  onResizeStop,
  onDropNewElement,
}: Props) {
  const textureMap = useStore((state) => state.textureMap);
  const textureAsset = el.texture
    ? getTextureLookupCandidates(el.texture)
        .map((candidate) => textureMap[candidate])
        .find(Boolean)
    : undefined;
  const [isDropTargetActive, setIsDropTargetActive] = useState(false);

  const uvX = el.uv?.[0] ?? 0;
  const uvY = el.uv?.[1] ?? 0;
  const uvW = el.uv_size?.[0] ?? textureAsset?.naturalWidth ?? 0;
  const uvH = el.uv_size?.[1] ?? textureAsset?.naturalHeight ?? 0;

  const displayPosition = applyAnchor(
    el.anchor_from,
    el.anchor_to,
    parentSize[0],
    parentSize[1],
    el.size[0],
    el.size[1],
    el.offset,
  );
  const canDropChildren = isContainerElement(el.type);
  const isSelected = selectedId === el.id;
  const shouldClip = el.clips_children === true || el.allow_clipping === true;
  const selfAlpha =
    typeof el.alpha === 'number'
      ? Math.max(0, Math.min(el.alpha, 1))
      : 1;
  const propagateAlpha = el.propagate_alpha !== false;
  // 元素自身始终使用 selfAlpha * parentAlpha
  const opacity = selfAlpha * parentAlpha;
  // propagate_alpha 控制是否将自身 alpha 传递给子元素
  const childAlpha = propagateAlpha ? opacity : parentAlpha;

  // visible 属性为 false 时跳过渲染
  if (el.visible === false) return null;

  const renderContent = () => {
    if (el.type === 'image') {
      if (textureAsset) {
        const bilinear = el.bilinear === true;
        const rendering: CSSProperties['imageRendering'] = bilinear ? 'auto' : 'pixelated';
        const filters: string[] = [];
        if (el.grayscale) filters.push('grayscale(1)');
        const filterStr = filters.length > 0 ? filters.join(' ') : undefined;

        // clip_direction / clip_ratio 裁剪
        let clipStyle: CSSProperties | undefined;
        if (el.clip_direction && el.clip_ratio !== undefined) {
          const r = Math.max(0, Math.min(1, el.clip_ratio));
          const hidden = (1 - r) * 100;
          switch (el.clip_direction) {
            case 'left':   clipStyle = { clipPath: `inset(0 ${hidden}% 0 0)` }; break;
            case 'right':  clipStyle = { clipPath: `inset(0 0 0 ${hidden}%)` }; break;
            case 'up':     clipStyle = { clipPath: `inset(0 0 ${hidden}% 0)` }; break;
            case 'down':   clipStyle = { clipPath: `inset(${hidden}% 0 0 0)` }; break;
            case 'center': {
              const h = hidden / 2;
              clipStyle = { clipPath: `inset(${h}% ${h}% ${h}% ${h}%)` };
              break;
            }
          }
        }

        const colorOverlay = el.color ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: `rgb(${el.color[0] * 255},${el.color[1] * 255},${el.color[2] * 255})`,
              mixBlendMode: 'multiply',
            }}
          />
        ) : null;

        // 九宫格(nineslice)渲染
        if (el.nineslice_size !== undefined) {
          let sT: number, sR: number, sB: number, sL: number;
          if (typeof el.nineslice_size === 'number') {
            sT = sR = sB = sL = el.nineslice_size;
          } else {
            [sL, sT, sR, sB] = el.nineslice_size;
          }
          const repeatMode =
            el.tiled === true ? 'round' :
            el.tiled === 'x' ? 'round stretch' :
            el.tiled === 'y' ? 'stretch round' : 'stretch';

          return (
            <div className="absolute inset-0" style={clipStyle}>
              <div
                className="absolute inset-0"
                style={{
                  borderStyle: 'solid',
                  borderWidth: `${sT}px ${sR}px ${sB}px ${sL}px`,
                  borderImageSource: `url(${textureAsset.objectUrl})`,
                  borderImageSlice: `${sT} ${sR} ${sB} ${sL} fill`,
                  borderImageWidth: `${sT}px ${sR}px ${sB}px ${sL}px`,
                  borderImageRepeat: repeatMode,
                  imageRendering: rendering,
                  filter: filterStr,
                  boxSizing: 'border-box',
                }}
              />
              {colorOverlay}
            </div>
          );
        }

        // 平铺(tiled)渲染
        if (el.tiled === true || el.tiled === 'x' || el.tiled === 'y') {
          const scX = el.tiled_scale?.[0] ?? 1;
          const scY = el.tiled_scale?.[1] ?? 1;
          const uvW = el.uv_size?.[0] ?? textureAsset.naturalWidth;
          const uvH = el.uv_size?.[1] ?? textureAsset.naturalHeight;
          const repeat = el.tiled === 'x' ? 'repeat-x' : el.tiled === 'y' ? 'repeat-y' : 'repeat';

          return (
            <div className="absolute inset-0" style={clipStyle}>
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${textureAsset.objectUrl})`,
                  backgroundRepeat: repeat,
                  backgroundSize: `${uvW * scX}px ${uvH * scY}px`,
                  imageRendering: rendering,
                  filter: filterStr,
                }}
              />
              {colorOverlay}
            </div>
          );
        }

        // 标准 UV 渲染：
        // 以纹理内有效源区域作为采样基准，再拉伸到目标尺寸。
        const sourceUvW = Math.max(
          0,
          Math.min(uvW, textureAsset.naturalWidth - uvX),
        );
        const sourceUvH = Math.max(
          0,
          Math.min(uvH, textureAsset.naturalHeight - uvY),
        );
        if (sourceUvW <= 0 || sourceUvH <= 0) {
          return colorOverlay;
        }

        const keepRatio = el.keep_ratio === true;
        const fill = el.fill === true;

        return (
          <div className="absolute inset-0">
            <StandardImageCanvas
              objectUrl={textureAsset.objectUrl}
              name={el.name}
              uvX={uvX}
              uvY={uvY}
              sourceUvW={sourceUvW}
              sourceUvH={sourceUvH}
              size={el.size}
              bilinear={bilinear}
              clipStyle={clipStyle}
              filterStr={filterStr}
              keepRatio={keepRatio}
              fill={fill}
            />
            {colorOverlay}
          </div>
        );
      }

      return (
        <div className="absolute inset-0 flex items-center justify-center border border-dashed border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
          <ImageIcon className="h-6 w-6 opacity-30" />
        </div>
      );
    }

    if (el.type === 'label') {
      return (
        <div
          className="absolute inset-0 flex items-center justify-center truncate px-1 text-sm"
          style={{
            color: el.color
              ? `rgb(${el.color[0] * 255},${el.color[1] * 255},${el.color[2] * 255})`
              : 'white',
          }}
        >
          {el.text}
        </div>
      );
    }

    if (el.type === 'chest_grid_item') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center border border-zinc-300 bg-black/20 text-xs dark:border-zinc-600 dark:bg-black/40">
          <span className="opacity-50">{el.collection_index}</span>
        </div>
      );
    }

    if (el.type === 'panel' || el.type === 'collection_panel' ||
        el.type === 'input_panel' || el.type === 'screen') {
      const typeLabel = el.type !== 'panel' ? el.type : null;
      return (
        <div className="absolute inset-0 border border-dashed border-zinc-300 bg-zinc-100/30 dark:border-zinc-700 dark:bg-zinc-800/30">
          {typeLabel && (
            <span className="absolute left-1 top-0.5 text-[9px] text-zinc-400 dark:text-zinc-600">
              {typeLabel}
            </span>
          )}
        </div>
      );
    }

    if (el.type === 'stack_panel') {
      const isHorizontal = el.orientation === 'horizontal';
      return (
        <div className="absolute inset-0 border border-dashed border-teal-300 bg-teal-100/20 dark:border-teal-800 dark:bg-teal-900/20">
          <span className="absolute left-1 top-0.5 text-[9px] text-teal-500 dark:text-teal-600">
            stack_panel ({isHorizontal ? 'H' : 'V'})
          </span>
        </div>
      );
    }

    if (el.type === 'scroll_view') {
      return (
        <div className="absolute inset-0 border border-dashed border-indigo-300 bg-indigo-100/20 dark:border-indigo-800 dark:bg-indigo-900/20">
          <span className="absolute left-1 top-0.5 text-[9px] text-indigo-500 dark:text-indigo-600">
            scroll_view
          </span>
        </div>
      );
    }

    if (el.type === 'button' || el.type === 'toggle' || el.type === 'dropdown') {
      return (
        <div className="absolute inset-0 border border-solid border-zinc-300 bg-zinc-200/40 dark:border-zinc-600 dark:bg-zinc-700/40">
          <span className="absolute left-1 top-0.5 text-[9px] text-zinc-500 dark:text-zinc-400">
            {el.type}
          </span>
        </div>
      );
    }

    if (el.type === 'slider' || el.type === 'slider_box' ||
        el.type === 'edit_box' || el.type === 'scrollbar_track' || el.type === 'scrollbar_box') {
      return (
        <div className="absolute inset-0 border border-solid border-zinc-300 bg-zinc-100/40 dark:border-zinc-600 dark:bg-zinc-800/40">
          <span className="absolute left-1 top-0.5 text-[9px] text-zinc-400 dark:text-zinc-500">
            {el.type}
          </span>
        </div>
      );
    }

    if (el.type === 'factory' || el.type === 'grid') {
      return (
        <div className="absolute inset-0 flex items-center justify-center border border-dotted border-zinc-300 bg-zinc-100/20 dark:border-zinc-600 dark:bg-zinc-800/20">
          <span className="text-[9px] text-zinc-400 dark:text-zinc-600">{el.type}</span>
        </div>
      );
    }

    if (el.type === 'custom' || el.type === 'selection_wheel') {
      return (
        <div className="absolute inset-0 flex items-center justify-center border border-dotted border-amber-300 bg-amber-100/20 dark:border-amber-800 dark:bg-amber-900/20">
          <span className="text-[9px] text-amber-500 dark:text-amber-600">{el.type}</span>
        </div>
      );
    }

    return null;
  };

  return (
    <Rnd
      size={{ width: el.size[0], height: el.size[1] }}
      position={{ x: displayPosition[0], y: displayPosition[1] }}
      onDragStop={(_, data) => {
        const nextOffset = resolveOffsetFromPosition(
          el.anchor_from,
          el.anchor_to,
          parentSize[0],
          parentSize[1],
          el.size[0],
          el.size[1],
          [data.x, data.y],
        );
        onDragStop(el.id, nextOffset);
      }}
      onResizeStop={(_, _direction, ref, _delta, position) => {
        const nextSize: [number, number] = [
          parseInt(ref.style.width, 10),
          parseInt(ref.style.height, 10),
        ];
        const nextOffset = resolveOffsetFromPosition(
          el.anchor_from,
          el.anchor_to,
          parentSize[0],
          parentSize[1],
          nextSize[0],
          nextSize[1],
          [position.x, position.y],
        );
        onResizeStop(el.id, nextSize, nextOffset);
      }}
      scale={canvasScale}
      bounds="parent"
      className={`absolute ${
        isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-zinc-300 dark:hover:ring-zinc-600'
      }`}
      style={{ zIndex: el.layer ?? 1 }}
      onClick={(event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        onSelect(el.id);
      }}
      onDragOver={
        canDropChildren
          ? (event: DragEvent<HTMLDivElement>) => {
              if (!draggingType) return;
              event.preventDefault();
              event.stopPropagation();
              setIsDropTargetActive(true);
              event.dataTransfer.dropEffect = 'copy';
            }
          : undefined
      }
      onDragLeave={
        canDropChildren
          ? (event: DragEvent<HTMLDivElement>) => {
              event.stopPropagation();
              setIsDropTargetActive(false);
            }
          : undefined
      }
      onDrop={
        canDropChildren
          ? (event: DragEvent<HTMLDivElement>) => {
              const droppedType = event.dataTransfer.getData(
                COMPONENT_DRAG_MIME,
              ) as ElementType;
              if (!droppedType) return;

              event.preventDefault();
              event.stopPropagation();
              setIsDropTargetActive(false);

              const rect = event.currentTarget.getBoundingClientRect();
              onDropNewElement(droppedType, el.id, [
                Math.round((event.clientX - rect.left) / canvasScale),
                Math.round((event.clientY - rect.top) / canvasScale),
              ]);
            }
          : undefined
      }
    >
      <div
        className="relative h-full w-full"
        style={{ overflow: shouldClip ? 'hidden' : 'visible', opacity }}
      >
        {renderContent()}

        {canDropChildren && draggingType && (
          <div
            className={`pointer-events-none absolute inset-0 border border-dashed transition-colors ${
              isDropTargetActive
                ? 'border-emerald-400 bg-emerald-500/10'
                : 'border-transparent'
            }`}
          />
        )}

        {el.children.length > 0 && (
          <div className="absolute inset-0">
            {el.children.map((child) => (
              <CanvasElement
                key={child.id}
                el={child}
                parentSize={el.size}
                selectedId={selectedId}
                draggingType={draggingType}
                canvasScale={canvasScale}
                parentAlpha={childAlpha}
                onSelect={onSelect}
                onDragStop={onDragStop}
                onResizeStop={onResizeStop}
                onDropNewElement={onDropNewElement}
              />
            ))}
          </div>
        )}
      </div>
    </Rnd>
  );
}
