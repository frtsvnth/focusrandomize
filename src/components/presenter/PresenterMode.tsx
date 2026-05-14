import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useAppState } from '../../state/store';
import { useSelection } from '../../hooks/useSelection';
import { useSound } from '../../hooks/useSound';
import { MECHANIC_META } from '../../mechanics/adapter';
import { TeamBadge } from '../shared/TeamBadge';
import type { MechanicId } from '../../domain/types';

const adapters: Record<MechanicId, React.LazyExoticComponent<React.FC<any>>> = {
  wheel: lazy(() => import('../../mechanics/wheel/WheelAdapter')),
  plinko: lazy(() => import('../../mechanics/plinko/PlinkoAdapter')),
  pinball: lazy(() => import('../../mechanics/pinball/PinballAdapter')),
  slot: lazy(() => import('../../mechanics/slotMachine/SlotMachineAdapter')),
  race: lazy(() => import('../../mechanics/race/RaceAdapter')),
  claw: lazy(() => import('../../mechanics/claw/ClawAdapter')),
  cards: lazy(() => import('../../mechanics/cards/CardsAdapter')),
};

export default function PresenterMode() {
  const { state, dispatch } = useAppState();
  const { canPick, isRevealing, lastResult, mechanic, startSelection, clearReveal } =
    useSelection();
  const { playClick, playWin } = useSound();
  const [animating, setAnimating] = useState(false);

  const activeTeams = state.masterTeams.filter((t) =>
    state.session.activeTeamIds.includes(t.id)
  );
  const poolTeams = isRevealing && lastResult
    ? state.masterTeams.filter((t) =>
        state.session.activeTeamIds.includes(t.id) || t.id === lastResult.team.id
      )
    : activeTeams;
  const historyTeams = state.session.history
    .map((h) => state.masterTeams.find((t) => t.id === h.teamId))
    .filter((t): t is NonNullable<typeof t> => !!t);

  const handleStart = useCallback(() => {
    if (!canPick || animating) return;
    playClick();
    setAnimating(true);
    startSelection();
  }, [canPick, animating, playClick, startSelection]);

  const handleAnimationComplete = useCallback(() => {
    playWin();
    setAnimating(false);
  }, [playWin]);

  const handleNext = useCallback(() => {
    clearReveal();
  }, [clearReveal]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (isRevealing && !animating) handleNext();
        else if (!isRevealing && !animating) handleStart();
      }
      if (e.key === 'f') {
        document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isRevealing, animating, handleNext, handleStart]);

  const MechanicComponent = adapters[mechanic];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '28px 32px',
        gap: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, var(--accent), var(--purple))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              boxShadow: '0 4px 16px rgba(34,211,238,0.25)',
            }}
          >
            🎲
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, color: '#fff', fontWeight: 800, letterSpacing: -0.5 }}>
              Sprint Review Show
            </h1>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {state.session.isActive ? 'Сессия активна' : 'Нет активной сессии'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => dispatch({ type: 'SET_SETTINGS', payload: { soundEnabled: !state.settings.soundEnabled } })}
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: state.settings.soundEnabled ? 'var(--accent)' : '#64748b',
              padding: '10px 14px',
              fontSize: 18,
            }}
            title={state.settings.soundEnabled ? 'Выключить звук' : 'Включить звук'}
          >
            {state.settings.soundEnabled ? '🔊' : '🔇'}
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_MODE', payload: 'admin' })}
            style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}
          >
            ⚙️ Админ
          </button>
        </div>
      </div>

      {/* Mechanic tabs */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(Object.keys(MECHANIC_META) as MechanicId[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              playClick();
              dispatch({ type: 'SELECT_MECHANIC', payload: m });
            }}
            style={{
              background: mechanic === m
                ? 'linear-gradient(135deg, var(--accent), var(--purple))'
                : 'rgba(255,255,255,0.04)',
              color: mechanic === m ? '#020617' : '#cbd5e1',
              border: mechanic === m ? 'none' : '1px solid rgba(255,255,255,0.06)',
              padding: '10px 18px',
              fontSize: 13,
            }}
          >
            {MECHANIC_META[m].label}
          </button>
        ))}
      </div>

      {/* Stage */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          position: 'relative',
        }}
      >
        {isRevealing && lastResult ? (
          <Suspense fallback={
            <div style={{ color: '#64748b', fontSize: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="reveal-anim">Загрузка механики…</span>
            </div>
          }>
            <MechanicComponent
              teams={poolTeams}
              targetTeam={lastResult.team}
              seed={lastResult.animationHint.seed}
              reducedMotion={state.settings.reducedMotion}
              onComplete={handleAnimationComplete}
            />
          </Suspense>
        ) : (
          <div style={{ textAlign: 'center', color: '#94a3b8', animation: 'float 4s ease-in-out infinite' }}>
            <div style={{
              fontSize: 72,
              marginBottom: 16,
              filter: 'drop-shadow(0 0 30px rgba(34,211,238,0.2))',
            }}>🎯</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#e2e8f0' }}>
              Нажмите «Старт», чтобы выбрать следующую команду
            </div>
            <div style={{ fontSize: 13, marginTop: 8, color: '#64748b' }}>
              Или просто нажмите Пробел
            </div>
          </div>
        )}

        {!isRevealing && (
          <button
            onClick={handleStart}
            disabled={!canPick}
            style={{
              fontSize: 22,
              padding: '18px 48px',
              background: canPick
                ? 'linear-gradient(135deg, var(--accent), var(--purple))'
                : '#334155',
              color: canPick ? '#020617' : '#94a3b8',
              borderRadius: 16,
              boxShadow: canPick ? '0 8px 32px rgba(34,211,238,0.3)' : 'none',
              animation: canPick ? 'pulse-glow 3s ease-in-out infinite' : 'none',
            }}
          >
            {canPick ? '▶ Старт' : 'Все команды выступили'}
          </button>
        )}

        {isRevealing && !animating && lastResult && (
          <button
            onClick={handleNext}
            style={{
              fontSize: 18,
              padding: '14px 32px',
              background: 'linear-gradient(135deg, var(--success), #10b981)',
              color: '#020617',
              borderRadius: 14,
              boxShadow: '0 6px 24px rgba(52,211,153,0.3)',
            }}
          >
            Далее ➜
          </button>
        )}
      </div>

      {/* Result overlay */}
      {isRevealing && !animating && lastResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3,7,18,0.92)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            flexDirection: 'column',
            gap: 24,
          }}
          className="reveal-anim"
        >
          <div style={{ fontSize: 18, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 3 }}>
            Слово предоставляется
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              color: lastResult.team.color,
              textShadow: `0 0 60px ${lastResult.team.color}aa, 0 0 120px ${lastResult.team.color}44`,
              textAlign: 'center',
              letterSpacing: -1,
            }}
          >
            {lastResult.team.logo && (
              <span style={{ fontSize: 56, marginRight: 16, verticalAlign: 'middle' }}>
                {lastResult.team.logo}
              </span>
            )}
            {lastResult.team.name}
          </div>
          <button
            onClick={handleNext}
            style={{
              fontSize: 18,
              padding: '14px 36px',
              background: '#fff',
              color: '#020617',
              borderRadius: 14,
              fontWeight: 700,
            }}
          >
            🎤 Передать слово
          </button>
        </div>
      )}

      {/* Footer info */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
        }}
      >
        <div className="card">
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>
            Осталось ({activeTeams.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {activeTeams.map((t) => (
              <div
                key={t.id}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  padding: '6px 12px',
                }}
              >
                <TeamBadge team={t} size="sm" />
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>
            История
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {historyTeams.length === 0 && (
              <div style={{ color: '#475569', fontSize: 13 }}>Пока никто не выступал</div>
            )}
            {historyTeams.map((t, i) => (
              <div key={`${t.id}-${i}`} style={{ fontSize: 13, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.06)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#94a3b8',
                }}>{i + 1}</span>
                <TeamBadge team={t} size="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
