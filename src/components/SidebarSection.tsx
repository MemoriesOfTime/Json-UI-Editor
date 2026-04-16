import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SidebarSectionProps {
  title: ReactNode;
  extra?: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
}

export function SidebarSection({
  title,
  extra,
  defaultExpanded = true,
  children,
}: SidebarSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div>
      <div
        className="mb-2 flex cursor-pointer items-center justify-between group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="mc-section-title flex items-center gap-1 select-none">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          {title}
        </h2>
        {extra && (
          <div onClick={(e) => e.stopPropagation()}>{extra}</div>
        )}
      </div>
      {isExpanded && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
