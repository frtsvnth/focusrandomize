/**
 * Pre-baked isometric sprite sheets (16 rotation frames, 4x4 grid, 192x192/frame),
 * rendered offline from the Kenney "Toy Car Kit" 3D models (CC0) — see
 * public/assets/toycars/CREDITS.txt. Not tinted per team; the 8 stock models already
 * read as visually distinct, same idea as the horse emoji cycling in RaceAdapterV2.
 */
export const VEHICLE_KEYS = [
  'vehicle-racer',
  'vehicle-racer-low',
  'vehicle-speedster',
  'vehicle-drag-racer',
  'vehicle-monster-truck',
  'vehicle-suv',
  'vehicle-truck',
  'vehicle-vintage-racer',
] as const;

export type VehicleKey = (typeof VEHICLE_KEYS)[number];

export const VEHICLE_FRAME_SIZE = 192;
export const VEHICLE_FRAME_COUNT = 16;

export function vehicleAssetUrl(key: VehicleKey): string {
  const base = import.meta.env.BASE_URL;
  return `${base}assets/toycars/${key}.png`;
}
