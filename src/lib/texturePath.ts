function normalizeTextureRef(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/{2,}/g, '/');
}

function ensureTexturesPrefix(value: string): string {
  return value.startsWith('textures/') ? value : `textures/${value}`;
}

function stripPngExtension(value: string): string {
  return value.endsWith('.png') ? value.slice(0, -4) : value;
}

function addUnique(out: string[], seen: Set<string>, value: string) {
  if (!value || seen.has(value)) return;
  seen.add(value);
  out.push(value);
}

export function toCanonicalTexturePath(value: string): string {
  const normalized = ensureTexturesPrefix(normalizeTextureRef(value));
  return normalized.endsWith('.png') ? normalized : `${normalized}.png`;
}

export function getTextureLookupCandidates(value: string): string[] {
  if (!value.trim()) return [];

  const normalized = normalizeTextureRef(value);
  const prefixed = ensureTexturesPrefix(normalized);
  const variants = [normalized, prefixed];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const variant of variants) {
    addUnique(out, seen, variant);
    addUnique(out, seen, stripPngExtension(variant));
    addUnique(out, seen, `${stripPngExtension(variant)}.png`);
  }

  return out;
}
