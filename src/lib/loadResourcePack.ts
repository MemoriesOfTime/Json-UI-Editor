import type { ParsedUiFile, ParsedRoute } from '../lib/parseUiJson';
import { parseUiJson, parseRoutesFromChestScreen } from '../lib/parseUiJson';
import type { TextureAsset } from '../store/useStore';
import { toCanonicalTexturePath } from './texturePath';

export interface ProjectFile {
  name: string;
  path: string;
  parsed: ParsedUiFile;
}

export interface ResourcePackProject {
  dirHandle: FileSystemDirectoryHandle;
  uiFiles: ProjectFile[];
  routes: ParsedRoute[];
  texturePaths: string[];
  skippedFiles: string[];
}

export async function loadResourcePack(
  dirHandle: FileSystemDirectoryHandle,
): Promise<ResourcePackProject> {
  const uiFiles: ProjectFile[] = [];
  const texturePaths: string[] = [];
  const skippedFiles: string[] = [];
  let routes: ParsedRoute[] = [];

  const uiDefs = await readUiDefs(dirHandle);
  const texturesDir = await getSubDir(dirHandle, 'textures');

  if (uiDefs.length > 0) {
    for (const defPath of uiDefs) {
      const normalizedPath = normalizeRelativePath(defPath);
      try {
        const fileHandle = await getFileHandleByRelativePath(
          dirHandle,
          normalizedPath,
        );
        const file = await fileHandle.getFile();
        const text = await file.text();
        const json = JSON.parse(text);
        const fileName = getBaseName(normalizedPath);
        const parsed = parseUiJson(json, fileName);
        uiFiles.push({ name: fileName, path: normalizedPath, parsed });
      } catch (error) {
        console.warn(`Failed to load UI file: ${normalizedPath}`, error);
        skippedFiles.push(normalizedPath);
      }
    }
  }

  const chestFile = uiFiles.find((f) => f.name === 'chest_screen.json');
  if (chestFile) {
    routes = parseRoutesFromChestScreen(chestFile.parsed);
  }

  if (texturesDir) {
    await collectTexturePaths(texturesDir, 'textures', texturePaths);
  }

  return { dirHandle, uiFiles, routes, texturePaths, skippedFiles };
}

async function readUiDefs(dirHandle: FileSystemDirectoryHandle): Promise<string[]> {
  try {
    const uiDir = await getSubDir(dirHandle, 'ui');
    if (!uiDir) return [];
    const fileHandle = await uiDir.getFileHandle('_ui_defs.json');
    const file = await fileHandle.getFile();
    const text = await file.text();
    const json = JSON.parse(text);
    return Array.isArray(json.ui_defs) ? json.ui_defs : [];
  } catch {
    return [];
  }
}

async function getSubDir(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await parent.getDirectoryHandle(name);
  } catch {
    return null;
  }
}

function normalizeRelativePath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+/, '');
}

function getRelativePathParts(relativePath: string): string[] {
  return normalizeRelativePath(relativePath).split('/').filter(Boolean);
}

function getBaseName(relativePath: string): string {
  const parts = getRelativePathParts(relativePath);
  return parts[parts.length - 1] || relativePath;
}

async function getFileHandleByRelativePath(
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<FileSystemFileHandle> {
  const parts = getRelativePathParts(relativePath);
  if (parts.length === 0) {
    throw new Error(`Invalid relative path: ${relativePath}`);
  }

  let current = rootHandle;
  for (let i = 0; i < parts.length - 1; i += 1) {
    current = await current.getDirectoryHandle(parts[i]);
  }

  return current.getFileHandle(parts[parts.length - 1]);
}

async function collectTexturePaths(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: string[],
): Promise<void> {
  const entries: [string, FileSystemHandle][] = [];
  for await (const [name, handle] of dir.entries()) {
    entries.push([name, handle]);
  }
  for (const [entryName, handle] of entries) {
    const entryPath = `${prefix}/${entryName}`;
    if (handle.kind === 'file' && entryName.endsWith('.png')) {
      out.push(toCanonicalTexturePath(entryPath));
    } else if (handle.kind === 'directory') {
      await collectTexturePaths(handle as FileSystemDirectoryHandle, entryPath, out);
    }
  }
}

export async function loadTextureAssets(
  dirHandle: FileSystemDirectoryHandle,
  paths: string[],
  onAsset: (asset: TextureAsset) => void,
): Promise<void> {
  for (const path of paths) {
    try {
      const fileHandle = await getFileHandleByRelativePath(dirHandle, path);
      const file = await fileHandle.getFile();
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => {
          onAsset({
            path,
            objectUrl,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          });
          resolve();
        };
        img.onerror = () => resolve();
        img.src = objectUrl;
      });
    } catch {
      // skip
    }
  }
}

export async function saveUiFile(
  dirHandle: FileSystemDirectoryHandle,
  relativePath: string,
  contents: string,
): Promise<void> {
  const fileHandle = await getFileHandleByRelativePath(dirHandle, relativePath);
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}
