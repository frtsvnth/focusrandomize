export interface Team {
  id: string;
  name: string;
  color: string;
  logo?: string;
  enabled: boolean;
}

export interface PickRecord {
  teamId: string;
  reason: SelectionReason;
  timestamp: number;
  stepIndex: number;
}

export type SelectionReason =
  | 'forced-position'
  | 'pinned-next'
  | 'scripted-order'
  | 'true-random';

export type MechanicId =
  | 'wheel'
  | 'plinko'
  | 'pinball'
  | 'slot'
  | 'race'
  | 'claw'
  | 'cards';

export interface Session {
  activeTeamIds: string[];
  history: PickRecord[];
  mechanic: MechanicId;
  isActive: boolean;
}

export interface ScriptPlan {
  fullOrder?: string[];
  fixedPositions?: Record<number, string>;
  pinnedNext?: string;
}

export interface AnimationHint {
  seed: number;
  durationMs: number;
  suspenseMs: number;
}

export interface DebugMeta {
  remainingOrder?: string[];
  appliedRule: string;
  poolSize: number;
}

export interface SelectionResult {
  team: Team;
  reason: SelectionReason;
  animationHint: AnimationHint;
  debugMeta: DebugMeta;
}

export interface Settings {
  adminPin: string;
  soundEnabled: boolean;
  reducedMotion: boolean;
  theme: 'dark' | 'light';
}

export interface AppState {
  masterTeams: Team[];
  session: Session;
  scriptPlan: ScriptPlan;
  settings: Settings;
  ui: {
    mode: 'presenter' | 'admin';
    isRevealing: boolean;
    lastResult?: SelectionResult;
    adminUnlocked: boolean;
  };
}
