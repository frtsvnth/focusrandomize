import type { AppState, Team, MechanicId, ScriptPlan } from '../domain/types';
import { selectNextTeam, consumePinnedNext } from '../engine/selectionEngine';

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
  | { type: 'PIN_NEXT'; payload: string | undefined };

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultTeams(): Team[] {
  const names = [
    'Платформа',
    'Мобилка',
    'Веб',
    'DevOps',
    'QA',
    'Данные',
    'Дизайн',
    'Безопасность',
  ];
  const colors = [
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#06b6d4',
    '#3b82f6',
    '#a855f7',
    '#ec4899',
  ];
  return names.map((name, i) => ({
    id: generateId(),
    name,
    color: colors[i % colors.length],
    enabled: true,
  }));
}

export function getInitialState(): AppState {
  const teams = defaultTeams();
  return {
    masterTeams: teams,
    session: {
      activeTeamIds: teams.map((t) => t.id),
      history: [],
      mechanic: 'wheel',
      isActive: false,
    },
    scriptPlan: {},
    settings: {
      adminPin: '',
      soundEnabled: true,
      reducedMotion:
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      theme: 'dark',
    },
    ui: {
      mode: 'presenter',
      isRevealing: false,
      adminUnlocked: false,
    },
  };
}

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_MODE': {
      return {
        ...state,
        ui: { ...state.ui, mode: action.payload },
      };
    }
    case 'UNLOCK_ADMIN': {
      return {
        ...state,
        ui: { ...state.ui, adminUnlocked: true },
      };
    }
    case 'ADD_TEAM': {
      const next = {
        ...state,
        masterTeams: [...state.masterTeams, action.payload],
      };
      if (!next.session.isActive) {
        next.session = {
          ...next.session,
          activeTeamIds: [...next.session.activeTeamIds, action.payload.id],
        };
      }
      return next;
    }
    case 'UPDATE_TEAM': {
      return {
        ...state,
        masterTeams: state.masterTeams.map((t) =>
          t.id === action.payload.id ? action.payload : t
        ),
      };
    }
    case 'DELETE_TEAM': {
      return {
        ...state,
        masterTeams: state.masterTeams.filter((t) => t.id !== action.payload),
        session: {
          ...state.session,
          activeTeamIds: state.session.activeTeamIds.filter(
            (id) => id !== action.payload
          ),
        },
      };
    }
    case 'REORDER_TEAMS': {
      const map = new Map(state.masterTeams.map((t) => [t.id, t]));
      const ordered = action.payload
        .map((id) => map.get(id))
        .filter((t): t is Team => !!t);
      return { ...state, masterTeams: ordered };
    }
    case 'SET_SCRIPT_PLAN': {
      return { ...state, scriptPlan: action.payload };
    }
    case 'PIN_NEXT': {
      return {
        ...state,
        scriptPlan: { ...state.scriptPlan, pinnedNext: action.payload },
      };
    }
    case 'START_SESSION': {
      const enabledIds = state.masterTeams
        .filter((t) => t.enabled)
        .map((t) => t.id);
      return {
        ...state,
        session: {
          activeTeamIds: enabledIds,
          history: [],
          mechanic: state.session.mechanic,
          isActive: true,
        },
        ui: { ...state.ui, isRevealing: false, lastResult: undefined },
      };
    }
    case 'RESET_SESSION': {
      const enabledIds = state.masterTeams
        .filter((t) => t.enabled)
        .map((t) => t.id);
      return {
        ...state,
        session: {
          ...state.session,
          activeTeamIds: enabledIds,
          history: [],
          isActive: true,
        },
        ui: { ...state.ui, isRevealing: false, lastResult: undefined },
      };
    }
    case 'UNDO_LAST_PICK': {
      if (state.session.history.length === 0) return state;
      const newHistory = state.session.history.slice(0, -1);
      const last = state.session.history[state.session.history.length - 1];
      return {
        ...state,
        session: {
          ...state.session,
          history: newHistory,
          activeTeamIds: [...state.session.activeTeamIds, last.teamId],
        },
      };
    }
    case 'REMOVE_FROM_SESSION': {
      return {
        ...state,
        session: {
          ...state.session,
          activeTeamIds: state.session.activeTeamIds.filter(
            (id) => id !== action.payload
          ),
        },
      };
    }
    case 'RESTORE_TO_SESSION': {
      if (state.session.activeTeamIds.includes(action.payload)) return state;
      return {
        ...state,
        session: {
          ...state.session,
          activeTeamIds: [...state.session.activeTeamIds, action.payload],
        },
      };
    }
    case 'SELECT_MECHANIC': {
      return {
        ...state,
        session: { ...state.session, mechanic: action.payload },
      };
    }
    case 'RUN_SELECTION': {
      if (!state.session.isActive) return state;
      const result = selectNextTeam(state);
      if (!result) return state;
      let next = consumePinnedNext(state);
      next = {
        ...next,
        session: {
          ...next.session,
          activeTeamIds: next.session.activeTeamIds.filter(
            (id) => id !== result.team.id
          ),
        },
        ui: {
          ...next.ui,
          lastResult: result,
          isRevealing: true,
        },
      };
      return next;
    }
    case 'REVEAL_RESULT': {
      return { ...state, ui: { ...state.ui, isRevealing: true } };
    }
    case 'CLEAR_REVEAL': {
      const lastResult = state.ui.lastResult;
      const newHistory = lastResult
        ? [
            ...state.session.history,
            {
              teamId: lastResult.team.id,
              reason: lastResult.reason,
              timestamp: Date.now(),
              stepIndex: state.session.history.length,
            },
          ]
        : state.session.history;
      return {
        ...state,
        session: { ...state.session, history: newHistory },
        ui: { ...state.ui, isRevealing: false, lastResult: undefined },
      };
    }
    case 'SET_SETTINGS': {
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };
    }
    case 'IMPORT_STATE': {
      return {
        ...action.payload,
        ui: {
          ...action.payload.ui,
          isRevealing: false,
        },
      };
    }
    default:
      return state;
  }
}
