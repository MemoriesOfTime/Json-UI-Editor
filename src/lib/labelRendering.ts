import type { AnchorType } from '../store/useStore';

type AlignAxis = 'start' | 'center' | 'end';

interface LabelRenderingInput {
  text?: string;
  text_alignment?: string;
  anchor_from?: AnchorType;
  anchor_to?: AnchorType;
  shadow?: boolean;
  font_size?: string;
  font_scale_factor?: number;
  line_padding?: number;
  font_type?: string;
  backup_font_type?: string;
}

interface ResolvedTextAlign {
  horizontal: AlignAxis;
  vertical: AlignAxis;
}

export interface ResolvedLabelRendering {
  text: string;
  horizontalAlign: AlignAxis;
  verticalAlign: AlignAxis;
  fontSizePx: number;
  lineHeightPx: number;
  fontFamily: string;
  shadowOffsetPx: number;
  hasShadow: boolean;
}

const FONT_SIZE_PX: Record<string, number> = {
  small: 8,
  normal: 10,
  large: 16,
  extra_large: 24,
};

const PIXEL_FONT_STACK = '"Courier New", "Lucida Console", monospace';
const SANS_FONT_STACK = '"Noto Sans", "Segoe UI", sans-serif';
const DEFAULT_LINE_HEIGHT_RATIO = 1.2;

function getAnchorAxis(anchor: string | undefined, axis: 'x' | 'y'): AlignAxis | null {
  if (!anchor) return null;

  if (axis === 'x') {
    if (anchor.includes('left')) return 'start';
    if (anchor.includes('right')) return 'end';
    if (anchor.includes('middle') || anchor === 'center') return 'center';
    return null;
  }

  if (anchor.includes('top')) return 'start';
  if (anchor.includes('bottom')) return 'end';
  if (anchor.includes('middle') || anchor === 'center') return 'center';
  return null;
}

function mergeAutoAxis(values: Array<AlignAxis | null>): AlignAxis {
  const filtered = values.filter((value): value is AlignAxis => value !== null);
  if (filtered.length === 0) return 'center';
  if (filtered.every((value) => value === 'end')) return 'end';
  if (filtered.every((value) => value === 'start')) return 'start';
  if (filtered.includes('center')) return 'center';
  return filtered[0];
}

function getExplicitAlignment(textAlignment: string | undefined): ResolvedTextAlign | null {
  if (!textAlignment) return null;

  const horizontal = getAnchorAxis(textAlignment, 'x');
  const vertical = getAnchorAxis(textAlignment, 'y');

  if (horizontal === null && vertical === null) {
    return null;
  }

  return {
    horizontal: horizontal ?? 'center',
    vertical: vertical ?? 'center',
  };
}

export function resolveLabelAlignment(
  textAlignment: string | undefined,
  anchorFrom: AnchorType | undefined,
  anchorTo: AnchorType | undefined,
): ResolvedTextAlign {
  const explicit = getExplicitAlignment(textAlignment);
  if (explicit) return explicit;

  return {
    horizontal: mergeAutoAxis([
      getAnchorAxis(anchorFrom, 'x'),
      getAnchorAxis(anchorTo, 'x'),
    ]),
    vertical: mergeAutoAxis([
      getAnchorAxis(anchorFrom, 'y'),
      getAnchorAxis(anchorTo, 'y'),
    ]),
  };
}

function resolveFontSizePx(fontSize: string | undefined, fontScaleFactor: number | undefined): number {
  const baseSize = FONT_SIZE_PX[fontSize || 'normal'] ?? FONT_SIZE_PX.normal;
  const scale = fontScaleFactor ?? 1;
  return Math.max(1, Math.round(baseSize * scale * 100) / 100);
}

function resolveFontFamily(fontType: string | undefined, backupFontType: string | undefined): string {
  const candidates = [fontType, backupFontType];

  for (const candidate of candidates) {
    const value = candidate?.toLowerCase();
    if (!value) continue;
    if (value.includes('notosans') || value.includes('sans')) {
      return SANS_FONT_STACK;
    }
    if (value.includes('minecraft') || value.includes('smooth')) {
      return PIXEL_FONT_STACK;
    }
  }

  return PIXEL_FONT_STACK;
}

export function resolveLabelRendering(input: LabelRenderingInput): ResolvedLabelRendering {
  const alignment = resolveLabelAlignment(
    input.text_alignment,
    input.anchor_from,
    input.anchor_to,
  );
  const fontSizePx = resolveFontSizePx(
    input.font_size,
    input.font_scale_factor,
  );
  const linePadding = input.line_padding ?? 0;
  const baseLineHeightPx = fontSizePx * DEFAULT_LINE_HEIGHT_RATIO;
  const lineHeightPx = Math.max(
    1,
    Math.round((baseLineHeightPx + linePadding) * 100) / 100,
  );
  const shadowScale = input.font_scale_factor ?? 1;

  return {
    text: input.text || '',
    horizontalAlign: alignment.horizontal,
    verticalAlign: alignment.vertical,
    fontSizePx,
    lineHeightPx,
    fontFamily: resolveFontFamily(input.font_type, input.backup_font_type),
    shadowOffsetPx: Math.max(0.5, Math.round(shadowScale * 100) / 100),
    hasShadow: input.shadow === true,
  };
}
