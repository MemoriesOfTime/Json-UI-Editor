import { useState } from 'react';
import type { DragEvent, MouseEvent } from 'react';
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

interface Props {
  el: UIElement;
  parentSize: [number, number];
  selectedId: string | null;
  draggingType: ElementType | null;
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
        const uvX = el.uv?.[0] ?? 0;
        const uvY = el.uv?.[1] ?? 0;
        const uvW = el.uv_size?.[0] ?? textureAsset.naturalWidth;
        const uvH = el.uv_size?.[1] ?? textureAsset.naturalHeight;
        const keepRatio = el.keep_ratio !== false;
        const fill = el.fill === true;
        const bilinear = el.bilinear === true;
        const scaleXRaw = uvW > 0 ? el.size[0] / uvW : 1;
        const scaleYRaw = uvH > 0 ? el.size[1] / uvH : 1;
        const uniformScale = keepRatio
          ? fill
            ? Math.max(scaleXRaw, scaleYRaw)
            : Math.min(scaleXRaw, scaleYRaw)
          : null;
        const scaleX = uniformScale ?? scaleXRaw;
        const scaleY = uniformScale ?? scaleYRaw;
        const sourceWidth = uvW * scaleX;
        const sourceHeight = uvH * scaleY;
        const offsetX = keepRatio ? (el.size[0] - sourceWidth) / 2 : 0;
        const offsetY = keepRatio ? (el.size[1] - sourceHeight) / 2 : 0;

        return (
          <div className="absolute inset-0 overflow-hidden">
            <img
              src={textureAsset.objectUrl}
              alt={el.name}
              draggable={false}
              style={{
                position: 'absolute',
                left: offsetX - uvX * scaleX,
                top: offsetY - uvY * scaleY,
                width: textureAsset.naturalWidth * scaleX,
                height: textureAsset.naturalHeight * scaleY,
                imageRendering: bilinear ? 'auto' : 'pixelated',
              }}
            />
            {el.color && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: `rgb(${el.color[0] * 255},${el.color[1] * 255},${el.color[2] * 255})`,
                  mixBlendMode: 'multiply',
                }}
              />
            )}
          </div>
        );
      }

      return (
        <div className="absolute inset-0 flex items-center justify-center border border-dashed border-zinc-700 bg-zinc-800">
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
        <div className="absolute inset-0 flex flex-col items-center justify-center border border-zinc-600 bg-black/40 text-xs">
          <span className="opacity-50">{el.collection_index}</span>
        </div>
      );
    }

    if (el.type === 'panel' || el.type === 'collection_panel') {
      return (
        <div className="absolute inset-0 border border-dashed border-zinc-700 bg-zinc-800/30">
          {el.type === 'collection_panel' && (
            <span className="absolute left-1 top-0.5 text-[9px] text-zinc-600">
              collection_panel
            </span>
          )}
        </div>
      );
    }

    if (el.type === 'factory' || el.type === 'grid') {
      return (
        <div className="absolute inset-0 flex items-center justify-center border border-dotted border-zinc-600 bg-zinc-800/20">
          <span className="text-[9px] text-zinc-600">{el.type}</span>
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
      bounds="parent"
      className={`absolute ${
        isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-zinc-600'
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
                Math.round(event.clientX - rect.left),
                Math.round(event.clientY - rect.top),
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
