import { create } from 'zustand';
import type { ResourcePackProject } from '../lib/loadResourcePack';
import type { ParsedControl } from '../lib/parseUiJson';

export type ElementType =
  | 'panel'
  | 'image'
  | 'label'
  | 'collection_panel'
  | 'chest_grid_item'
  | 'factory'
  | 'grid';

export type AnchorType =
  | 'top_left'
  | 'top_middle'
  | 'top_right'
  | 'left_middle'
  | 'center'
  | 'right_middle'
  | 'bottom_left'
  | 'bottom_middle'
  | 'bottom_right';

export interface UIElement {
  id: string;
  type: ElementType;
  name: string;
  inheritsFrom?: string;
  rawProps: Record<string, unknown>;
  size: [number, number];
  offset: [number, number];
  anchor_from?: AnchorType;
  anchor_to?: AnchorType;
  alpha?: number;
  clips_children?: boolean;
  allow_clipping?: boolean;
  text?: string;
  color?: [number, number, number];
  collection_index?: number;
  collection_name?: string;
  texture?: string;
  uv?: [number, number];
  uv_size?: [number, number];
  keep_ratio?: boolean;
  fill?: boolean;
  bilinear?: boolean;
  layer?: number;
  visible?: boolean;
  propagate_alpha?: boolean;
  children: UIElement[];
}

export interface TextureAsset {
  path: string;
  objectUrl: string;
  naturalWidth: number;
  naturalHeight: number;
}

interface AddElementOptions {
  parentId?: string | null;
  position?: [number, number];
}

interface EditorState {
  project: ResourcePackProject | null;
  activeFile: string | null;
  canvasSize: [number, number];
  elements: UIElement[];
  drafts: Record<string, UIElement[]>;
  selectedId: string | null;
  textureMap: Record<string, TextureAsset>;
  setProject: (project: ResourcePackProject) => void;
  setActiveFile: (fileName: string) => void;
  setElements: (elements: UIElement[]) => void;
  selectElement: (id: string | null) => void;
  updateElement: (id: string, updates: Partial<UIElement>) => void;
  addElement: (type: ElementType, options?: AddElementOptions) => string | null;
  removeElement: (id: string) => void;
  addTexture: (asset: TextureAsset) => void;
  removeTexture: (path: string) => void;
}

export const ANCHOR_OPTIONS: AnchorType[] = [
  'top_left',
  'top_middle',
  'top_right',
  'left_middle',
  'center',
  'right_middle',
  'bottom_left',
  'bottom_middle',
  'bottom_right',
];

export const ADDABLE_ELEMENT_TYPES: ElementType[] = [
  'panel',
  'image',
  'label',
  'collection_panel',
  'chest_grid_item',
];

const CONTAINER_TYPES = new Set<ElementType>([
  'panel',
  'collection_panel',
  'factory',
  'grid',
]);

const DEFAULT_ELEMENT_SIZES: Record<ElementType, [number, number]> = {
  panel: [140, 100],
  image: [64, 64],
  label: [140, 24],
  collection_panel: [180, 120],
  chest_grid_item: [18, 18],
  factory: [120, 40],
  grid: [140, 100],
};

/**
 * 解析 Bedrock UI 的百分比尺寸值
 * 支持: 数字、"100%"、"50%sm"、"100%cm"、"100%cx"、"100%cy"、"100%x"、"100%y"
 */
function resolveSizeValue(
  raw: unknown,
  axis: 0 | 1,
  parentSize: [number, number],
  canvasSize: [number, number],
): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return parentSize[axis];

  const match = raw.match(/^(-?\d+(?:\.\d+)?)%/);
  if (!match) {
    if (raw === 'default') return parentSize[axis];
    const num = Number(raw);
    return Number.isFinite(num) ? num : parentSize[axis];
  }

  const pct = parseFloat(match[1]) / 100;
  const suffix = raw.slice(raw.indexOf('%') + 1);

  switch (suffix) {
    case '': return parentSize[axis] * pct;
    case 'x': return parentSize[0] * pct;
    case 'y': return parentSize[1] * pct;
    case 'sm': return Math.min(canvasSize[0], canvasSize[1]) * pct;
    case 'cm': return Math.min(canvasSize[0], canvasSize[1]) * pct;
    case 'cx': return canvasSize[0] * pct;
    case 'cy': return canvasSize[1] * pct;
    default: return parentSize[axis] * pct;
  }
}

function resolveRawArray(
  raw: unknown,
  parentSize: [number, number],
  canvasSize: [number, number],
  fallback: [number, number],
): [number, number] {
  if (!Array.isArray(raw) || raw.length < 2) return fallback;
  const w = resolveSizeValue(raw[0], 0, parentSize, canvasSize);
  const h = resolveSizeValue(raw[1], 1, parentSize, canvasSize);
  return [
    Number.isFinite(w) ? w : fallback[0],
    Number.isFinite(h) ? h : fallback[1],
  ];
}

let idCounter = 0;

function nextId(): string {
  return `el_${++idCounter}`;
}

function persistDraft(
  activeFile: string | null,
  drafts: Record<string, UIElement[]>,
  elements: UIElement[],
): Record<string, UIElement[]> {
  if (!activeFile) return drafts;
  return {
    ...drafts,
    [activeFile]: elements,
  };
}

function controlToElement(
  ctrl: ParsedControl,
  parentSize: [number, number],
  canvasSize: [number, number],
): UIElement {
  // 从 rawProps 解析百分比尺寸/偏移，ctrl.size/ctrl.offset 对百分比值为 NaN
  const rawSize = ctrl.rawProps.size;
  const rawOffset = ctrl.rawProps.offset;
  const resolvedSize: [number, number] = Array.isArray(rawSize)
    ? resolveRawArray(rawSize, parentSize, canvasSize, parentSize)
    : (ctrl.size && Number.isFinite(ctrl.size[0]) && Number.isFinite(ctrl.size[1])
      ? ctrl.size
      : [100, 100]);
  const resolvedOffset: [number, number] = Array.isArray(rawOffset)
    ? resolveRawArray(rawOffset, parentSize, canvasSize, [0, 0])
    : (ctrl.offset || [0, 0]);

  const el: UIElement = {
    id: nextId(),
    type: ctrl.type || (ctrl.inheritsFrom ? 'chest_grid_item' : 'panel'),
    name: ctrl.key,
    rawProps: { ...ctrl.rawProps },
    size: resolvedSize,
    offset: resolvedOffset,
    children: ctrl.controls?.map((c) => controlToElement(c, resolvedSize, canvasSize)) || [],
  };

  if (ctrl.inheritsFrom) el.inheritsFrom = ctrl.inheritsFrom;
  if (ctrl.anchor_from) el.anchor_from = ctrl.anchor_from as AnchorType;
  if (ctrl.anchor_to) el.anchor_to = ctrl.anchor_to as AnchorType;
  if (ctrl.alpha !== undefined) el.alpha = ctrl.alpha;
  if (ctrl.clips_children !== undefined) el.clips_children = ctrl.clips_children;
  if (ctrl.allow_clipping !== undefined) el.allow_clipping = ctrl.allow_clipping;
  if (ctrl.text !== undefined) el.text = ctrl.text;
  if (ctrl.color) el.color = ctrl.color;
  if (ctrl.collection_index !== undefined) el.collection_index = ctrl.collection_index;
  if (ctrl.collection_name) el.collection_name = ctrl.collection_name;
  if (ctrl.texture) el.texture = ctrl.texture;
  if (ctrl.uv) el.uv = ctrl.uv;
  if (ctrl.uv_size) el.uv_size = ctrl.uv_size;
  if (ctrl.keep_ratio !== undefined) el.keep_ratio = ctrl.keep_ratio;
  if (ctrl.fill !== undefined) el.fill = ctrl.fill;
  if (ctrl.bilinear !== undefined) el.bilinear = ctrl.bilinear;
  if (ctrl.layer !== undefined) el.layer = ctrl.layer;
  if (ctrl.visible !== undefined) el.visible = ctrl.visible;
  if (ctrl.propagate_alpha !== undefined) el.propagate_alpha = ctrl.propagate_alpha;

  return el;
}

export function parsedControlsToElements(
  controls: ParsedControl[],
  canvasSize: [number, number],
): UIElement[] {
  return controls.map((ctrl) => controlToElement(ctrl, canvasSize, canvasSize));
}

export function flattenElements(elements: UIElement[]): UIElement[] {
  return elements.flatMap((el) => [el, ...flattenElements(el.children)]);
}

export function findElementById(
  elements: UIElement[],
  id: string | null,
): UIElement | null {
  if (!id) return null;
  for (const el of elements) {
    if (el.id === id) return el;
    const childMatch = findElementById(el.children, id);
    if (childMatch) return childMatch;
  }
  return null;
}

export function findParentIdByChildId(
  elements: UIElement[],
  childId: string,
  parentId: string | null = null,
): string | null {
  for (const el of elements) {
    if (el.id === childId) return parentId;
    const childMatch = findParentIdByChildId(el.children, childId, el.id);
    if (childMatch !== null) return childMatch;
  }
  return null;
}

function updateElementInTree(
  elements: UIElement[],
  id: string,
  updates: Partial<UIElement>,
): UIElement[] {
  return elements.map((el) => {
    if (el.id === id) {
      return { ...el, ...updates };
    }
    if (el.children.length === 0) {
      return el;
    }
    return {
      ...el,
      children: updateElementInTree(el.children, id, updates),
    };
  });
}

function removeElementFromTree(elements: UIElement[], id: string): UIElement[] {
  return elements
    .filter((el) => el.id !== id)
    .map((el) => {
      if (el.children.length === 0) {
        return el;
      }
      return {
        ...el,
        children: removeElementFromTree(el.children, id),
      };
    });
}

function insertElementInTree(
  elements: UIElement[],
  parentId: string | null,
  newElement: UIElement,
): { elements: UIElement[]; inserted: boolean } {
  if (!parentId) {
    return { elements: [...elements, newElement], inserted: true };
  }

  let inserted = false;
  const nextElements = elements.map((el) => {
    if (el.id === parentId) {
      inserted = true;
      return {
        ...el,
        children: [...el.children, newElement],
      };
    }

    if (el.children.length === 0) {
      return el;
    }

    const result = insertElementInTree(el.children, parentId, newElement);
    if (result.inserted) {
      inserted = true;
      return {
        ...el,
        children: result.elements,
      };
    }

    return el;
  });

  return { elements: nextElements, inserted };
}

function getNextUniqueName(elements: UIElement[], prefix: string): string {
  const usedNames = new Set(flattenElements(elements).map((el) => el.name));
  let index = 1;
  let candidate = `${prefix}_${index}`;

  while (usedNames.has(candidate)) {
    index += 1;
    candidate = `${prefix}_${index}`;
  }

  return candidate;
}

function getNextCollectionIndex(elements: UIElement[]): number {
  const usedIndexes = new Set(
    flattenElements(elements)
      .filter((el) => el.type === 'chest_grid_item')
      .map((el) => el.collection_index ?? -1),
  );

  let index = 0;
  while (usedIndexes.has(index)) {
    index += 1;
  }

  return index;
}

export function getDefaultElementSize(type: ElementType): [number, number] {
  return DEFAULT_ELEMENT_SIZES[type];
}

export function isContainerElement(type: ElementType): boolean {
  return CONTAINER_TYPES.has(type);
}

function createElementTemplate(
  type: ElementType,
  elements: UIElement[],
  position: [number, number],
): UIElement {
  const size = getDefaultElementSize(type);
  const base: UIElement = {
    id: nextId(),
    type,
    name: getNextUniqueName(elements, type === 'chest_grid_item' ? 'slot' : type),
    rawProps: {},
    size,
    offset: position,
    layer: 1,
    children: [],
  };

  if (type === 'image') {
    base.texture = '';
  }

  if (type === 'label') {
    base.text = 'Label';
    base.color = [1, 1, 1];
  }

  if (type === 'collection_panel') {
    base.collection_name = 'container_items';
  }

  if (type === 'chest_grid_item') {
    base.name = `slot_${getNextCollectionIndex(elements)}`;
    base.inheritsFrom = 'chest.chest_grid_item';
    base.collection_index = getNextCollectionIndex(elements);
    base.collection_name = 'container_items';
  }

  return base;
}

function getAnchorPoint(
  anchor: AnchorType | undefined,
  width: number,
  height: number,
): [number, number] {
  const currentAnchor = anchor || 'top_left';

  switch (currentAnchor) {
    case 'top_left':
      return [0, 0];
    case 'top_middle':
      return [width / 2, 0];
    case 'top_right':
      return [width, 0];
    case 'left_middle':
      return [0, height / 2];
    case 'center':
      return [width / 2, height / 2];
    case 'right_middle':
      return [width, height / 2];
    case 'bottom_left':
      return [0, height];
    case 'bottom_middle':
      return [width / 2, height];
    case 'bottom_right':
      return [width, height];
  }
}

export function applyAnchor(
  anchorFrom: AnchorType | undefined,
  anchorTo: AnchorType | undefined,
  parentW: number,
  parentH: number,
  elW: number,
  elH: number,
  offset: [number, number],
): [number, number] {
  const [parentAnchorX, parentAnchorY] = getAnchorPoint(
    anchorTo,
    parentW,
    parentH,
  );
  const [elementAnchorX, elementAnchorY] = getAnchorPoint(
    anchorFrom,
    elW,
    elH,
  );

  return [
    parentAnchorX - elementAnchorX + offset[0],
    parentAnchorY - elementAnchorY + offset[1],
  ];
}

export function resolveOffsetFromPosition(
  anchorFrom: AnchorType | undefined,
  anchorTo: AnchorType | undefined,
  parentW: number,
  parentH: number,
  elW: number,
  elH: number,
  position: [number, number],
): [number, number] {
  const [parentAnchorX, parentAnchorY] = getAnchorPoint(
    anchorTo,
    parentW,
    parentH,
  );
  const [elementAnchorX, elementAnchorY] = getAnchorPoint(
    anchorFrom,
    elW,
    elH,
  );

  return [
    Math.round(position[0] - (parentAnchorX - elementAnchorX)),
    Math.round(position[1] - (parentAnchorY - elementAnchorY)),
  ];
}

export const useStore = create<EditorState>((set) => ({
  project: null,
  activeFile: null,
  canvasSize: [320, 240] as [number, number],
  elements: [],
  drafts: {},
  selectedId: null,
  textureMap: {},
  setProject: (project) => {
    idCounter = 0;
    set({
      project,
      activeFile: null,
      elements: [],
      drafts: {},
      selectedId: null,
      canvasSize: [320, 240] as [number, number],
    });
  },
  setActiveFile: (fileName) => {
    set((state) => {
      if (!state.project) {
        return {
          activeFile: fileName,
          elements: [],
          selectedId: null,
          canvasSize: [320, 240] as [number, number],
        };
      }

      const file = state.project.uiFiles.find((entry) => entry.name === fileName);
      if (!file) {
        return {
          activeFile: fileName,
          elements: [],
          selectedId: null,
          canvasSize: [320, 240] as [number, number],
        };
      }

      const mainRoot = file.parsed.rootControls.find(
        (control) =>
          control.key.endsWith('_menu_root') || control.key.endsWith('_menu_panel'),
      );
      const rawCanvasSize = mainRoot?.size || [320, 240] as [number, number];
      const canvasSize: [number, number] = [
        Number.isFinite(rawCanvasSize[0]) ? rawCanvasSize[0] : 320,
        Number.isFinite(rawCanvasSize[1]) ? rawCanvasSize[1] : 240,
      ];
      const controls = mainRoot ? mainRoot.controls || [] : file.parsed.rootControls;
      const elements =
        state.drafts[fileName] || parsedControlsToElements(controls, canvasSize);

      return { activeFile: fileName, elements, selectedId: null, canvasSize };
    });
  },
  setElements: (elements) =>
    set((state) => ({
      elements,
      drafts: persistDraft(state.activeFile, state.drafts, elements),
    })),
  selectElement: (id) => set({ selectedId: id }),
  updateElement: (id, updates) =>
    set((state) => {
      const elements = updateElementInTree(state.elements, id, updates);
      return {
        elements,
        drafts: persistDraft(state.activeFile, state.drafts, elements),
      };
    }),
  addElement: (type, options) => {
    let createdId: string | null = null;

    set((state) => {
      const position = options?.position || [0, 0];
      const newElement = createElementTemplate(type, state.elements, position);
      const insertion = insertElementInTree(
        state.elements,
        options?.parentId || null,
        newElement,
      );
      const elements = insertion.inserted
        ? insertion.elements
        : [...state.elements, newElement];

      createdId = newElement.id;

      return {
        elements,
        selectedId: newElement.id,
        drafts: persistDraft(state.activeFile, state.drafts, elements),
      };
    });

    return createdId;
  },
  removeElement: (id) =>
    set((state) => {
      const elements = removeElementFromTree(state.elements, id);
      return {
        elements,
        selectedId: state.selectedId === id ? null : state.selectedId,
        drafts: persistDraft(state.activeFile, state.drafts, elements),
      };
    }),
  addTexture: (asset) =>
    set((state) => ({
      textureMap: { ...state.textureMap, [asset.path]: asset },
    })),
  removeTexture: (path) =>
    set((state) => {
      const next = { ...state.textureMap };
      const entry = next[path];
      if (entry) {
        URL.revokeObjectURL(entry.objectUrl);
        delete next[path];
      }
      return { textureMap: next };
    }),
}));
