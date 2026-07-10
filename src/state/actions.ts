import type { Team, MechanicId, ScriptPlan, AppState } from '../domain/types';

export type Action =
  | { type: 'SET_MODE'; payload: 'presenter' | 'admin' }
  | { type: 'UNLOCK_ADMIN' }
  | { type: 'ADD_TEAM'; payload: Team }
  | { type: 'UPDATE_TEAM'; payload: Team }
  | { type: 'DELETE_TEAM'; payload: string }
  | { type: 'REORDER_TEAMS'; payload: string[] }
  | { type: 'SET_SCRIPT_PLAN'; payload: ScriptPlan }
  | { type: 'START_SESSION' }
  | { type: 'RESET_SESSION' }
  | { type: 'UNDO_LAST_PICK' }
  | { type: 'REMOVE_FROM_SESSION'; payload: string }
  | { type: 'RESTORE_TO_SESSION'; payload: string }
  | { type: 'SELECT_MECHANIC'; payload: MechanicId }
  | { type: 'RUN_SELECTION' }
  | { type: 'REVEAL_RESULT' }
  | { type: 'CLEAR_REVEAL' }
  | { type: 'SET_SETTINGS'; payload: Partial<AppState['settings']> }
  | { type: 'IMPORT_STATE'; payload: AppState }
  | { type: 'PIN_NEXT'; payload: string | undefined }
  | { type: 'SET_HISTORY_VISIBLE'; payload: boolean };

export const actions = {
  setMode: (payload: 'presenter' | 'admin'): Action => ({ type: 'SET_MODE', payload }),
  unlockAdmin: (): Action => ({ type: 'UNLOCK_ADMIN' }),
  addTeam: (payload: Team): Action => ({ type: 'ADD_TEAM', payload }),
  updateTeam: (payload: Team): Action => ({ type: 'UPDATE_TEAM', payload }),
  deleteTeam: (payload: string): Action => ({ type: 'DELETE_TEAM', payload }),
  reorderTeams: (payload: string[]): Action => ({ type: 'REORDER_TEAMS', payload }),
  setScriptPlan: (payload: ScriptPlan): Action => ({ type: 'SET_SCRIPT_PLAN', payload }),
  startSession: (): Action => ({ type: 'START_SESSION' }),
  resetSession: (): Action => ({ type: 'RESET_SESSION' }),
  undoLastPick: (): Action => ({ type: 'UNDO_LAST_PICK' }),
  removeFromSession: (payload: string): Action => ({ type: 'REMOVE_FROM_SESSION', payload }),
  restoreToSession: (payload: string): Action => ({ type: 'RESTORE_TO_SESSION', payload }),
  selectMechanic: (payload: MechanicId): Action => ({ type: 'SELECT_MECHANIC', payload }),
  runSelection: (): Action => ({ type: 'RUN_SELECTION' }),
  revealResult: (): Action => ({ type: 'REVEAL_RESULT' }),
  clearReveal: (): Action => ({ type: 'CLEAR_REVEAL' }),
  setSettings: (payload: Partial<AppState['settings']>): Action => ({ type: 'SET_SETTINGS', payload }),
  importState: (payload: AppState): Action => ({ type: 'IMPORT_STATE', payload }),
  pinNext: (payload: string | undefined): Action => ({ type: 'PIN_NEXT', payload }),
  setHistoryVisible: (payload: boolean): Action => ({ type: 'SET_HISTORY_VISIBLE', payload }),
};
