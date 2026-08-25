/**
 * Static (non-rotating) isometric scenery sprites, baked the same way as the vehicles —
 * see public/assets/toycars/CREDITS.txt. A single frame each is enough: they're simple,
 * roughly axis-symmetric shapes (a cone, two pine-tree variants).
 */
export const PROP_KEYS = ['tree', 'tree-pine', 'item-cone'] as const;
export type PropKey = (typeof PROP_KEYS)[number];

export function propAssetUrl(key: PropKey): string {
  const base = import.meta.env.BASE_URL;
  return `${base}assets/toycars/props/${key}.png`;
}
