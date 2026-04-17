import { useCallback, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import type { UIElement } from '../store/useStore';
import {
  findElementById,
  flattenElements,
  isContainerElement,
  useStore,
} from '../store/useStore';

const TREE_DRAG_MIME = 'application/x-jsonui-tree-element';

type DropPosition = 'before' | 'inside' | 'after';

interface ElementTreeNodeProps {
  element: UIElement;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  parentId: string | null;
}

export function ElementTreeNode({
  element,
  depth,
  selectedId,
  onSelect,
  parentId,
}: ElementTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const hasChildren = element.children.length > 0;
  const isSelected = selectedId === element.id;
  const isContainer = isContainerElement(element.type);

  const getDropPosition = useCallback(
    (e: React.DragEvent<HTMLDivElement>): DropPosition => {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const ratio = y / rect.height;

      if (isContainer && ratio > 0.3 && ratio < 0.7) {
        return 'inside';
      }
      return ratio <= 0.5 ? 'before' : 'after';
    },
    [isContainer],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData(TREE_DRAG_MIME, element.id);
      e.dataTransfer.effectAllowed = 'move';
      e.stopPropagation();
    },
    [element.id],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const dragId = e.dataTransfer.types.includes(TREE_DRAG_MIME);
      if (!dragId) return;

      const pos = getDropPosition(e);
      setDropPosition(pos);
    },
    [getDropPosition],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (rowRef.current?.contains(e.relatedTarget as Node)) return;
      setDropPosition(null);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDropPosition(null);

      const dragId = e.dataTransfer.getData(TREE_DRAG_MIME);
      if (!dragId || dragId === element.id) return;

      const elements = useStore.getState().elements;
      const dragged = findElementById(elements, dragId);
      if (!dragged) return;

      const descendantIds = new Set(flattenElements(dragged.children).map((c) => c.id));
      if (descendantIds.has(element.id) || dragId === element.id) return;

      const pos = getDropPosition(e);
      const moveElement = useStore.getState().moveElement;

      if (pos === 'inside') {
        if (!isContainerElement(element.type)) return;
        moveElement(dragId, element.id, element.children.length);
        return;
      }

      const targetParentId = parentId;
      const siblings = targetParentId
        ? (findElementById(elements, targetParentId)?.children ?? elements)
        : elements;
      const targetIndexInSiblings = siblings.findIndex((c) => c.id === element.id);
      if (targetIndexInSiblings === -1) return;

      const insertIndex =
        pos === 'before' ? targetIndexInSiblings : targetIndexInSiblings + 1;

      moveElement(dragId, targetParentId, insertIndex);
    },
    [element, parentId, getDropPosition],
  );

  const handleDragEnd = useCallback(() => {
    setDropPosition(null);
  }, []);

  return (
    <li>
      <div
        ref={rowRef}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        className={`relative flex w-full items-center gap-1 py-1.5 pr-3 text-left text-xs cursor-grab active:cursor-grabbing ${
          isSelected
            ? 'mc-select-active'
            : 'mc-hover-item mc-text'
        } ${dropPosition === 'inside' ? 'ring-1 ring-blue-400/60 rounded' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {dropPosition === 'before' && (
          <div className="absolute left-1 right-1 top-0 h-0.5 bg-blue-400 rounded-full" />
        )}

        <div
          className={`flex items-center justify-center w-4 h-4 ${
            hasChildren ? 'cursor-pointer mc-hover-item' : ''
          }`}
          onClick={(e) => {
            if (hasChildren) {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 opacity-70" />
            )
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onSelect(element.id)}
          className="flex flex-1 min-w-0 items-center gap-2"
        >
          <Layers className="h-3 w-3 opacity-70" />
          <span className="min-w-0 flex-1 truncate text-left">{element.name}</span>
          <span className="text-[10px] mc-text-dim">{element.type}</span>
        </button>

        {dropPosition === 'after' && (
          <div className="absolute left-1 right-1 bottom-0 h-0.5 bg-blue-400 rounded-full" />
        )}
      </div>

      {hasChildren && isExpanded && (
        <ul className="space-y-0.5 mt-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {element.children.map((child) => (
            <ElementTreeNode
              key={child.id}
              element={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              parentId={element.id}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
