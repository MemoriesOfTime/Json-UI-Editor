import React, { useRef } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { useT } from '../lib/i18n';
import { useStore } from '../store/useStore';
import { useTextureLoader } from './useTextureLoader';
import { SidebarSection } from './SidebarSection';

export function TexturePanel() {
  const textureMap = useStore((s) => s.textureMap);
  const removeTexture = useStore((s) => s.removeTexture);
  const { loadFiles } = useTextureLoader();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = Object.values(textureMap);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      loadFiles(e.dataTransfer.files);
    }
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
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {entries.map((t) => (
              <li
                key={t.path}
                className="group flex items-center gap-2 px-2 py-1.5 mc-panel"
              >
                <img
                  src={t.objectUrl}
                  alt=""
                  className="w-8 h-8 object-cover flex-shrink-0 mc-input"
                  style={{ imageRendering: 'pixelated' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs mc-text truncate">{t.path}</p>
                  <p className="text-[10px] mc-text-dim">
                    {t.naturalWidth}×{t.naturalHeight}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTexture(t.path);
                  }}
                  className="mc-btn mc-btn-danger p-1 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SidebarSection>
  );
}
