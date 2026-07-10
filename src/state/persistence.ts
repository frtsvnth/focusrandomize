import type { AppState } from '../domain/types';
import { appStateSchema } from '../domain/schema';

const STORAGE_KEY = 'sprint-review-show-v2';

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function loadState(): Partial<AppState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const result = appStateSchema.safeParse(parsed);
    if (result.success) {
      return result.data as Partial<AppState>;
    }
    // Graceful fallback: try to return partial data even if schema drifted
    return parsed as Partial<AppState>;
  } catch {
    return null;
  }
}

export function exportJSON(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importJSON(json: string): AppState | null {
  try {
    const parsed = JSON.parse(json);
    const result = appStateSchema.safeParse(parsed);
    if (result.success) {
      return result.data as AppState;
    }
    // eslint-disable-next-line no-console
    console.warn('Import validation failed', result.error.flatten());
    return null;
  } catch {
    return null;
  }
}
