import type {
  AppState,
  Team,
  SelectionResult,
  SelectionReason,
} from '../domain/types';
import { hashString } from '../utils/seededRandom';

export function getActiveTeams(state: AppState): Team[] {
  return state.masterTeams.filter(
    (t) => t.enabled && state.session.activeTeamIds.includes(t.id)
  );
}

export function selectNextTeam(state: AppState): SelectionResult | null {
  const active = getActiveTeams(state);
  if (active.length === 0) return null;

  const step = state.session.history.length;
  const plan = state.scriptPlan;

  // Build pool, excluding lastTeamId if there are other teams left
  const lastTeam = plan.lastTeamId
    ? active.find((t) => t.id === plan.lastTeamId)
    : undefined;
  const pool = lastTeam && active.length > 1
    ? active.filter((t) => t.id !== plan.lastTeamId)
    : active;

  let target: Team | undefined;
  let reason: SelectionReason = 'true-random';
  let appliedRule = 'true-random';

  // 1. Pinned next (can override last-team exclusion)
  if (plan.pinnedNext) {
    const found = active.find((t) => t.id === plan.pinnedNext);
    if (found) {
      target = found;
      reason = 'pinned-next';
      appliedRule = `pinned-next: ${found.id}`;
    }
  }

  // 2. Fixed positions
  if (!target && plan.fixedPositions && plan.fixedPositions[step]) {
    const fid = plan.fixedPositions[step];
    const found = active.find((t) => t.id === fid);
    if (found) {
      target = found;
      reason = 'forced-position';
      appliedRule = `fixed-position[${step}]: ${found.id}`;
    }
  }

  // 3. Full scripted order
  if (!target && plan.fullOrder && step < plan.fullOrder.length) {
    const fid = plan.fullOrder[step];
    const found = active.find((t) => t.id === fid);
    if (found) {
      target = found;
      reason = 'scripted-order';
      appliedRule = `scripted-order[${step}]: ${found.id}`;
    }
  }

  // 4. True random (from the filtered pool excluding last team)
  if (!target) {
    randomFromPool: {
      if (pool.length === 0) break randomFromPool;
      const idx = Math.floor(Math.random() * pool.length);
      target = pool[idx];
      reason = 'true-random';
      appliedRule = 'true-random';
    }
  }

  // If nothing was selected (shouldn't happen), fallback
  if (!target) {
    target = active[0];
    reason = 'true-random';
    appliedRule = 'true-random';
  }

  const seed =
    reason === 'true-random'
      ? Math.floor(Math.random() * 2 ** 32)
      : hashString(`${target.id}#${step}#scripted`);

  const durationMs = 3000 + Math.floor(Math.random() * 3000);
  const suspenseMs = 600;

  const remainingOrder = plan.fullOrder
    ? plan.fullOrder.slice(step + 1).filter((id) =>
        active.some((t) => t.id === id)
      )
    : undefined;

  return {
    team: target,
    reason,
    animationHint: {
      seed,
      durationMs,
      suspenseMs,
    },
    debugMeta: {
      remainingOrder,
      appliedRule,
      poolSize: active.length,
    },
  };
}

export function consumePinnedNext(state: AppState): AppState {
  if (!state.scriptPlan.pinnedNext) return state;
  return {
    ...state,
    scriptPlan: {
      ...state.scriptPlan,
      pinnedNext: undefined,
    },
  };
}
