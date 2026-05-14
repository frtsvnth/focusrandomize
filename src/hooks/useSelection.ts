import { useCallback } from 'react';
import { useAppState } from '../state/store';

export function useSelection() {
  const { state, dispatch } = useAppState();

  const canPick = state.session.isActive && state.session.activeTeamIds.length > 0;

  const startSelection = useCallback(() => {
    if (!canPick) return;
    dispatch({ type: 'RUN_SELECTION' });
  }, [canPick, dispatch]);

  const clearReveal = useCallback(() => {
    dispatch({ type: 'CLEAR_REVEAL' });
  }, [dispatch]);

  return {
    canPick,
    isRevealing: state.ui.isRevealing,
    lastResult: state.ui.lastResult,
    mechanic: state.session.mechanic,
    startSelection,
    clearReveal,
  };
}
