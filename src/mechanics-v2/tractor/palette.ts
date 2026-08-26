import { hexToRgb } from '../engine/canvasUtils';

/**
 * Scene colors, derived from the app's active theme tokens rather than hardcoded —
 * every mechanic must read the current theme (see `readThemePalette`) so a theme
 * switch repaints the ride without a reload. Values are packed 0xRRGGBB numbers,
 * the format Phaser's Graphics/tint APIs expect.
 */
export interface ScenePalette {
  skyTop: number;
  skyBottom: number;
  sun: number;
  cloud: number;
  hills: number;
  hillsShadow: number;
  field: number;
  fieldShadow: number;
  road: number;
  roadEdge: number;
  roadLine: number;
  ground: number;
  foregroundPole: number;
  foregroundGrass: number;
  vehicleBody: number;
  vehicleTrim: number;
  tireRubber: number;
  wheelHub: number;
  exhaustMetal: number;
  driverSilhouette: number;
  trailerBed: number;
  trailerFrontWall: number;
}

function mix(hexA: string, hexB: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(hexA);
  const [br, bg, bb] = hexToRgb(hexB);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b = Math.round(ab + (bb - ab) * t);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const darken = (hex: string, t: number) => mix(hex, '#000000', t);

function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

const FALLBACK: Record<string, string> = {
  '--bg': '#030712',
  '--surface-2': '#111827',
  '--text': '#f1f5f9',
  '--accent': '#22d3ee',
  '--purple': '#a78bfa',
  '--success': '#34d399',
  '--warning': '#fbbf24',
};

function readVar(styles: CSSStyleDeclaration, name: string): string {
  const v = styles.getPropertyValue(name).trim();
  return v || FALLBACK[name];
}

/** Reads the app's current theme (CSS custom properties on `<html>`) and derives a full scene palette from it. */
export function readThemePalette(): ScenePalette {
  const styles = getComputedStyle(document.documentElement);
  const bg = readVar(styles, '--bg');
  const surface2 = readVar(styles, '--surface-2');
  const text = readVar(styles, '--text');
  const accent = readVar(styles, '--accent');
  const purple = readVar(styles, '--purple');
  const success = readVar(styles, '--success');
  const warning = readVar(styles, '--warning');

  const field = mix(success, bg, 0.35);
  const road = darken(surface2, 0.35);
  const hills = mix(surface2, accent, 0.15);

  return {
    skyTop: hexToNumber(bg),
    skyBottom: hexToNumber(mix(surface2, accent, 0.25)),
    sun: hexToNumber(warning),
    cloud: hexToNumber(mix(text, bg, 0.6)),
    hills: hexToNumber(hills),
    hillsShadow: hexToNumber(darken(hills, 0.25)),
    field: hexToNumber(field),
    fieldShadow: hexToNumber(darken(field, 0.2)),
    road: hexToNumber(road),
    roadEdge: hexToNumber(accent),
    roadLine: hexToNumber(mix(text, road, 0.5)),
    ground: hexToNumber(darken(field, 0.35)),
    foregroundPole: hexToNumber(purple),
    foregroundGrass: hexToNumber(darken(field, 0.1)),
    vehicleBody: hexToNumber(accent),
    vehicleTrim: hexToNumber(warning),
    tireRubber: hexToNumber(darken(text, 0.82)),
    wheelHub: hexToNumber(mix(accent, text, 0.25)),
    exhaustMetal: hexToNumber(mix(text, surface2, 0.5)),
    driverSilhouette: hexToNumber(darken(text, 0.7)),
    trailerBed: hexToNumber(darken(accent, 0.4)),
    trailerFrontWall: hexToNumber(mix(accent, text, 0.15)),
  };
}

/**
 * True for themes whose background reads as "dark" — gates dark-only flourishes (the
 * tractor's headlight cone, background stars). A relative-luminance threshold on the sky
 * color rather than a hardcoded theme list, so any future theme is handled automatically.
 */
export function isDarkPalette(palette: ScenePalette): boolean {
  const r = (palette.skyTop >> 16) & 255;
  const g = (palette.skyTop >> 8) & 255;
  const b = palette.skyTop & 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.4;
}
