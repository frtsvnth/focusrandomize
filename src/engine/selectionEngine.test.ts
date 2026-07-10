import { describe, it, expect } from 'vitest';
import { selectNextTeam, getActiveTeams, consumePinnedNext } from '../engine/selectionEngine';
import type { AppState, Team } from '../domain/types';

function makeState(overrides?: Partial<AppState>): AppState {
  const teams: Team[] = [
    { id: 't1', name: 'A', color: '#f00', enabled: true },
    { id: 't2', name: 'B', color: '#0f0', enabled: true },
    { id: 't3', name: 'C', color: '#00f', enabled: true },
  ];
  return {
    masterTeams: teams,
    session: {
      activeTeamIds: teams.map((t) => t.id),
      history: [],
      mechanic: 'wheel',
      isActive: true,
    },
    scriptPlan: {},
    settings: {
      adminPin: '',
      soundEnabled: true,
      reducedMotion: false,
      theme: 'dark',
      enabledMechanics: ['wheel'],
    },
    ui: {
      mode: 'presenter',
      isRevealing: false,
      adminUnlocked: false,
      historyVisible: true,
    },
    ...overrides,
  } as AppState;
}

describe('getActiveTeams', () => {
  it('returns only enabled teams in session', () => {
    const state = makeState();
    const active = getActiveTeams(state);
    expect(active).toHaveLength(3);
  });

  it('excludes disabled teams', () => {
    const state = makeState({
      masterTeams: [
        { id: 't1', name: 'A', color: '#f00', enabled: true },
        { id: 't2', name: 'B', color: '#0f0', enabled: false },
        { id: 't3', name: 'C', color: '#00f', enabled: true },
      ],
    });
    const active = getActiveTeams(state);
    expect(active.map((t) => t.id)).toEqual(['t1', 't3']);
  });
});

describe('selectNextTeam', () => {
  it('returns null when no active teams', () => {
    const state = makeState({ session: { ...makeState().session, activeTeamIds: [] } });
    expect(selectNextTeam(state)).toBeNull();
  });

  it('respects pinnedNext', () => {
    const state = makeState({ scriptPlan: { pinnedNext: 't2' } });
    const result = selectNextTeam(state);
    expect(result?.team.id).toBe('t2');
    expect(result?.reason).toBe('pinned-next');
  });

  it('respects fixedPositions', () => {
    const state = makeState({ scriptPlan: { fixedPositions: { 0: 't3' } } });
    const result = selectNextTeam(state);
    expect(result?.team.id).toBe('t3');
    expect(result?.reason).toBe('forced-position');
  });

  it('respects fullOrder', () => {
    const state = makeState({ scriptPlan: { fullOrder: ['t2', 't1', 't3'] } });
    const result = selectNextTeam(state);
    expect(result?.team.id).toBe('t2');
    expect(result?.reason).toBe('scripted-order');
  });

  it('falls back to random when no script', () => {
    const state = makeState();
    const result = selectNextTeam(state);
    expect(result).not.toBeNull();
    expect(['t1', 't2', 't3']).toContain(result?.team.id);
    expect(result?.reason).toBe('true-random');
  });

  it('excludes lastTeamId from pool', () => {
    const state = makeState({ scriptPlan: { lastTeamId: 't1' } });
    // run many times to be confident t1 is excluded
    for (let i = 0; i < 20; i++) {
      const result = selectNextTeam(state);
      if (result && result.reason === 'true-random') {
        expect(result.team.id).not.toBe('t1');
      }
    }
  });

  it('pinnedNext overrides lastTeamId exclusion', () => {
    const state = makeState({ scriptPlan: { lastTeamId: 't2', pinnedNext: 't2' } });
    const result = selectNextTeam(state);
    expect(result?.team.id).toBe('t2');
  });
});

describe('consumePinnedNext', () => {
  it('clears pinnedNext', () => {
    const state = makeState({ scriptPlan: { pinnedNext: 't1' } });
    const next = consumePinnedNext(state);
    expect(next.scriptPlan.pinnedNext).toBeUndefined();
  });

  it('returns same state if no pinnedNext', () => {
    const state = makeState();
    const next = consumePinnedNext(state);
    expect(next.scriptPlan.pinnedNext).toBeUndefined();
  });
});
