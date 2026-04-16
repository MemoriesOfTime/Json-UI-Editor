import type { ParsedControl, ParsedUiFile } from './parseUiJson';
import type { ElementType, UIElement } from '../store/useStore';

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function setOptionalProp(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  if (value === undefined) {
    delete target[key];
    return;
  }
  target[key] = value;
}

function getControlKey(name: string, inheritsFrom?: string): string {
  return inheritsFrom ? `${name}@${inheritsFrom}` : name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwnProp(target: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function isChestGridItemElement(el: UIElement): boolean {
  return el.type === 'chest_grid_item' && el.inheritsFrom === 'chest.chest_grid_item';
}

function getSerializedType(el: UIElement): ElementType | undefined {
  if (el.dirty?.type) {
    return el.type === 'chest_grid_item' ? undefined : el.type;
  }

  return el.sourceType;
}

function serializeElement(el: UIElement): Record<string, unknown> {
  const baseProps = cloneJson(el.rawProps);
  const serializedType = getSerializedType(el);
  const serializesAsChestGridItem = isChestGridItemElement(el);

  if (serializedType === undefined) {
    delete baseProps.type;
  } else {
    baseProps.type = serializedType;
  }

  if (el.dirty?.size || !hasOwnProp(baseProps, 'size')) {
    baseProps.size = el.size;
  }
  if (el.dirty?.offset || !hasOwnProp(baseProps, 'offset')) {
    baseProps.offset = el.offset;
  }
  setOptionalProp(baseProps, 'anchor_from', el.anchor_from);
  setOptionalProp(baseProps, 'anchor_to', el.anchor_to);
  setOptionalProp(baseProps, 'layer', el.layer);
  setOptionalProp(baseProps, 'alpha', el.alpha);
  setOptionalProp(baseProps, 'clips_children', el.clips_children);
  setOptionalProp(baseProps, 'allow_clipping', el.allow_clipping);

  if (el.type === 'image') {
    baseProps.texture = el.texture || '';
    setOptionalProp(baseProps, 'uv', el.uv);
    setOptionalProp(baseProps, 'uv_size', el.uv_size);
    setOptionalProp(baseProps, 'keep_ratio', el.keep_ratio);
    setOptionalProp(baseProps, 'fill', el.fill);
    setOptionalProp(baseProps, 'bilinear', el.bilinear);
    setOptionalProp(baseProps, 'grayscale', el.grayscale);
    setOptionalProp(baseProps, 'nineslice_size', el.nineslice_size);
    setOptionalProp(baseProps, 'tiled', el.tiled);
    setOptionalProp(baseProps, 'tiled_scale', el.tiled_scale);
    setOptionalProp(baseProps, 'clip_direction', el.clip_direction);
    setOptionalProp(baseProps, 'clip_ratio', el.clip_ratio);
    setOptionalProp(baseProps, 'clip_pixelperfect', el.clip_pixelperfect);
    setOptionalProp(baseProps, 'texture_file_system', el.texture_file_system);
    setOptionalProp(baseProps, 'base_size', el.base_size);
  }

  if (el.type === 'label') {
    baseProps.text = el.text || '';
    setOptionalProp(baseProps, 'color', el.color);
    setOptionalProp(baseProps, 'text_alignment', el.text_alignment);
    setOptionalProp(baseProps, 'shadow', el.shadow);
    setOptionalProp(baseProps, 'font_size', el.font_size);
    setOptionalProp(baseProps, 'font_scale_factor', el.font_scale_factor);
    setOptionalProp(baseProps, 'line_padding', el.line_padding);
    setOptionalProp(baseProps, 'localize', el.localize);
    setOptionalProp(baseProps, 'font_type', el.font_type);
    setOptionalProp(baseProps, 'backup_font_type', el.backup_font_type);
  }

  if (el.type === 'collection_panel') {
    setOptionalProp(baseProps, 'collection_name', el.collection_name);
  } else if (el.dirty?.type && !serializesAsChestGridItem) {
    delete baseProps.collection_name;
  }

  if (serializesAsChestGridItem) {
    baseProps.collection_index = el.collection_index ?? 0;
    setOptionalProp(baseProps, 'collection_name', el.collection_name);
  } else {
    delete baseProps.collection_index;
  }

  if (el.children.length > 0) {
    baseProps.controls = el.children.map(serializeElement);
  } else {
    delete baseProps.controls;
  }

  return { [getControlKey(el.name, el.inheritsFrom)]: baseProps };
}

function findEditableRoot(parsed: ParsedUiFile): ParsedControl | null {
  return (
    parsed.rootControls.find(
      (control) =>
        control.key.endsWith('_menu_root') || control.key.endsWith('_menu_panel'),
    ) || null
  );
}

export function serializeUiFile(
  parsed: ParsedUiFile,
  elements: UIElement[],
): string {
  const nextJson = cloneJson(parsed.rawJson);
  const editableRoot = findEditableRoot(parsed);

  if (editableRoot) {
    const rootKey = getControlKey(editableRoot.key, editableRoot.inheritsFrom);
    const rootBase = isRecord(nextJson[rootKey])
      ? { ...(nextJson[rootKey] as Record<string, unknown>) }
      : cloneJson(editableRoot.rawProps);

    rootBase.controls = elements.map(serializeElement);
    nextJson[rootKey] = rootBase;
  } else {
    for (const control of parsed.rootControls) {
      delete nextJson[getControlKey(control.key, control.inheritsFrom)];
    }
    for (const element of elements) {
      Object.assign(nextJson, serializeElement(element));
    }
  }

  if (typeof nextJson.namespace !== 'string') {
    nextJson.namespace = parsed.namespace;
  }

  return JSON.stringify(nextJson, null, 2);
}
