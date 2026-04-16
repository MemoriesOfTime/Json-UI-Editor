import { useState } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import type { UIElement } from '../store/useStore';

interface ElementTreeNodeProps {
  element: UIElement;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ElementTreeNode({
  element,
  depth,
  selectedId,
  onSelect,
}: ElementTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = element.children.length > 0;
  const isSelected = selectedId === element.id;

  return (
    <li>
      <div
        className={`flex w-full items-center gap-1 py-1.5 pr-3 text-left text-xs ${
          isSelected
            ? 'mc-select-active'
            : 'mc-hover-item mc-text'
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
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
            />
          ))}
        </ul>
      )}
    </li>
  );
}
