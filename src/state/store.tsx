import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { AppState } from '../domain/types';
import type { Action } from './reducer';
import { appReducer, getInitialState } from './reducer';
import { loadState, saveState } from './persistence';

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(
    appReducer,
    undefined,
    () => {
      const saved = loadState();
      if (saved) {
        const base = getInitialState();
        return {
          ...base,
          ...saved,
          ui: { ...base.ui, ...saved.ui },
        };
      }
      return getInitialState();
    }
  );

  useEffect(() => {
    saveState(state);
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
