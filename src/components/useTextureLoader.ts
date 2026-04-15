import { useCallback } from 'react';
import { useStore } from '../store/useStore';
import type { TextureAsset } from '../store/useStore';
import { toCanonicalTexturePath } from '../lib/texturePath';

export function useTextureLoader() {
  const addTexture = useStore((s) => s.addTexture);

  const loadFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((file) => {
        if (!file.type.startsWith('image/')) return;

        const relativePath = file.webkitRelativePath || file.name;
        const normalizedPath = toCanonicalTexturePath(relativePath);

        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const asset: TextureAsset = {
            path: normalizedPath,
            objectUrl,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          };
          addTexture(asset);
        };
        img.src = objectUrl;
      });
    },
    [addTexture],
  );

  return { loadFiles };
}
