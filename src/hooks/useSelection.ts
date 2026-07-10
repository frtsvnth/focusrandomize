import { useCallback } from 'react';
import { useAppState } from '../state/store';
import { actions } from '../state/actions';

export function useSelection() {
  const { state, dispatch } = useAppState();

  const canPick = state.session.isActive && state.session.activeTeamIds.length > 0;

  const startSelection = useCallback(() => {
    if (!canPick) return;
    dispatch(actions.runSelection());
  }, [canPick, dispatch]);

  const clearReveal = useCallback(() => {
    dispatch(actions.clearReveal());
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
