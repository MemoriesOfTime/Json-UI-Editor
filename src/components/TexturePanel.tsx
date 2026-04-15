import React, { useRef } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { useT } from '../lib/i18n';
import { useStore } from '../store/useStore';
import { useTextureLoader } from './useTextureLoader';

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
    <div className="space-y-3">
      <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider dark:text-zinc-500">
        {t('texture.title')}
      </h2>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border border-dashed border-zinc-300 rounded-lg p-3 text-center cursor-pointer hover:border-zinc-400 hover:bg-zinc-50 transition-colors dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/50"
      >
        <Upload className="w-5 h-5 mx-auto mb-1 opacity-40" />
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{t('texture.dropHint')}</p>
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
              className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-100/60 group dark:bg-zinc-800/60"
            >
              <img
                src={t.objectUrl}
                alt=""
                className="w-8 h-8 object-cover rounded border border-zinc-200 flex-shrink-0 dark:border-zinc-700"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-700 truncate dark:text-zinc-300">{t.path}</p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  {t.naturalWidth}×{t.naturalHeight}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTexture(t.path);
                }}
                className="p-1 rounded hover:bg-zinc-200 text-zinc-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity dark:hover:bg-zinc-700 dark:text-zinc-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
