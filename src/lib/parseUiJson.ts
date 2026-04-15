export type ElementType = 'panel' | 'image' | 'label' | 'collection_panel' | 'chest_grid_item' | 'factory' | 'grid';

export interface ParsedControl {
  key: string;
  inheritsFrom?: string;
  rawProps: Record<string, unknown>;
  type?: ElementType;
  size?: [number, number];
  offset?: [number, number];
  anchor_from?: string;
  anchor_to?: string;
  layer?: number;
  alpha?: number;
  clips_children?: boolean;
  allow_clipping?: boolean;
  text?: string;
  color?: [number, number, number];
  texture?: string;
  uv?: [number, number];
  uv_size?: [number, number];
  keep_ratio?: boolean;
  fill?: boolean;
  bilinear?: boolean;
  collection_index?: number;
  collection_name?: string;
  visible?: boolean;
  propagate_alpha?: boolean;
  modifications?: ParsedModification[];
  controls?: ParsedControl[];
}

export interface ParsedModification {
  array_name?: string;
  operation?: string;
  value?: Record<string, unknown>;
}

export interface ParsedRoute {
  title: string;
  rootPanel: string;
  screenContent: string;
}

export interface ParsedUiFile {
  fileName: string;
  namespace: string;
  rawJson: Record<string, unknown>;
  rootControls: ParsedControl[];
  routes?: ParsedRoute[];
}

function parseControlKey(rawKey: string): { name: string; inheritsFrom?: string } {
  const atIdx = rawKey.indexOf('@');
  if (atIdx === -1) return { name: rawKey };
  return {
    name: rawKey.substring(0, atIdx),
    inheritsFrom: rawKey.substring(atIdx + 1),
  };
}

function parseControl(rawKey: string, rawValue: Record<string, unknown>): ParsedControl {
  const { name, inheritsFrom } = parseControlKey(rawKey);
  const ctrl: ParsedControl = { key: name, rawProps: { ...rawValue } };
  if (inheritsFrom) ctrl.inheritsFrom = inheritsFrom;

  if (typeof rawValue.type === 'string') ctrl.type = rawValue.type as ElementType;
  if (Array.isArray(rawValue.size) && rawValue.size.length >= 2) {
    ctrl.size = [Number(rawValue.size[0]), Number(rawValue.size[1])];
  }
  if (Array.isArray(rawValue.offset) && rawValue.offset.length >= 2) {
    ctrl.offset = [Number(rawValue.offset[0]), Number(rawValue.offset[1])];
  }
  if (typeof rawValue.anchor_from === 'string') ctrl.anchor_from = rawValue.anchor_from;
  if (typeof rawValue.anchor_to === 'string') ctrl.anchor_to = rawValue.anchor_to;
  if (typeof rawValue.layer === 'number') ctrl.layer = rawValue.layer;
  if (typeof rawValue.alpha === 'number') ctrl.alpha = rawValue.alpha;
  if (typeof rawValue.clips_children === 'boolean') {
    ctrl.clips_children = rawValue.clips_children;
  }
  if (typeof rawValue.allow_clipping === 'boolean') {
    ctrl.allow_clipping = rawValue.allow_clipping;
  }
  if (typeof rawValue.text === 'string') ctrl.text = rawValue.text;
  if (Array.isArray(rawValue.color) && rawValue.color.length >= 3) {
    ctrl.color = [Number(rawValue.color[0]), Number(rawValue.color[1]), Number(rawValue.color[2])];
  }
  if (typeof rawValue.texture === 'string') ctrl.texture = rawValue.texture;
  if (Array.isArray(rawValue.uv) && rawValue.uv.length >= 2) {
    ctrl.uv = [Number(rawValue.uv[0]), Number(rawValue.uv[1])];
  }
  if (Array.isArray(rawValue.uv_size) && rawValue.uv_size.length >= 2) {
    ctrl.uv_size = [Number(rawValue.uv_size[0]), Number(rawValue.uv_size[1])];
  }
  if (typeof rawValue.keep_ratio === 'boolean') ctrl.keep_ratio = rawValue.keep_ratio;
  if (typeof rawValue.fill === 'boolean') ctrl.fill = rawValue.fill;
  if (typeof rawValue.bilinear === 'boolean') ctrl.bilinear = rawValue.bilinear;
  if (typeof rawValue.collection_index === 'number') ctrl.collection_index = rawValue.collection_index;
  if (typeof rawValue.collection_name === 'string') ctrl.collection_name = rawValue.collection_name;
  if (typeof rawValue.visible === 'boolean') ctrl.visible = rawValue.visible;
  if (typeof rawValue.propagate_alpha === 'boolean') ctrl.propagate_alpha = rawValue.propagate_alpha;

  if (Array.isArray(rawValue.modifications)) {
    ctrl.modifications = rawValue.modifications
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null && !Array.isArray(item),
      )
      .map((item) => {
        const modification: ParsedModification = {};
        if (typeof item.array_name === 'string') modification.array_name = item.array_name;
        if (typeof item.operation === 'string') modification.operation = item.operation;
        if (
          typeof item.value === 'object' &&
          item.value !== null &&
          !Array.isArray(item.value)
        ) {
          modification.value = item.value as Record<string, unknown>;
        }
        return modification;
      });
  }

  if (Array.isArray(rawValue.controls)) {
    ctrl.controls = rawValue.controls.map((child: Record<string, unknown>) => {
      const childKey = Object.keys(child)[0];
      const childVal = child[childKey] as Record<string, unknown>;
      return parseControl(childKey, childVal);
    });
  }

  return ctrl;
}

export function parseUiJson(json: Record<string, unknown>, fileName: string): ParsedUiFile {
  const namespace = typeof json.namespace === 'string' ? json.namespace : '';
  const rootControls: ParsedControl[] = [];

  for (const [key, value] of Object.entries(json)) {
    if (key === 'namespace') continue;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;

    const rawVal = value as Record<string, unknown>;
    const control = parseControl(key, rawVal);
    rootControls.push(control);
  }

  return { fileName, namespace, rawJson: json, rootControls };
}

export function parseRoutesFromChestScreen(parsed: ParsedUiFile): ParsedRoute[] {
  const routes: ParsedRoute[] = [];
  for (const ctrl of parsed.rootControls) {
    if (!ctrl.controls) continue;
    for (const mod of ctrl.controls) {
      const mods = mod.modifications;
      if (!Array.isArray(mods)) continue;
      for (const m of mods) {
        const val = m.value;
        if (!val) continue;
        const req = val.requires;
        if (typeof req !== 'string') continue;
        const match = req.match(/\$new_container_title\s*=\s*'([^']+)'/);
        if (!match) continue;
        routes.push({
          title: match[1],
          rootPanel: typeof val.$root_panel === 'string' ? val.$root_panel : '',
          screenContent:
            typeof val.$screen_content === 'string' ? val.$screen_content : '',
        });
      }
    }
  }
  return routes;
}

export function extractFlatControls(root: ParsedControl): ParsedControl[] {
  const result: ParsedControl[] = [];

  function walk(ctrl: ParsedControl) {
    result.push(ctrl);
    if (ctrl.controls) {
      for (const child of ctrl.controls) walk(child);
    }
  }

  walk(root);
  return result;
}
