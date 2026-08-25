import { useEffect, useState, useCallback, lazy, Suspense, memo } from 'react';
import { useAppState } from '../../state/store';
import { useSelection } from '../../hooks/useSelection';
import { useSound } from '../../hooks/useSound';
import { MECHANIC_META } from '../../mechanics/adapter';
import { TeamBadge } from '../shared/TeamBadge';
import { actions } from '../../state/actions';
import type { MechanicId, Team } from '../../domain/types';

const adapters: Partial<Record<MechanicId, React.LazyExoticComponent<React.FC<any>>>> = {
  wheel: lazy(() => import('../../mechanics/wheel/WheelAdapter')),
  slot: lazy(() => import('../../mechanics/slotMachine/SlotMachineAdapter')),
  race: lazy(() => import('../../mechanics/race/RaceAdapter')),
  claw: lazy(() => import('../../mechanics/claw/ClawAdapter')),
  cards: lazy(() => import('../../mechanics/cards/CardsAdapter')),
  stickman: lazy(() => import('../../mechanics/stickman/StickmanAdapter')),
  elevator: lazy(() => import('../../mechanics/elevator/ElevatorAdapter')),
  tornado: lazy(() => import('../../mechanics/tornado/TornadoAdapter')),
  dice: lazy(() => import('../../mechanics/dice/DiceRollAdapter')),
  gladiator: lazy(() => import('../../mechanics/gladiator/GladiatorAdapter')),
  alien: lazy(() => import('../../mechanics/alien/AlienAbductionAdapter')),
};

const MechanicStage = memo(function MechanicStage({
  mechanic,
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
}: {
  mechanic: MechanicId;
  teams: Team[];
  targetTeam: Team;
  seed: number;
  reducedMotion: boolean;
  onComplete: (winner?: Team) => void;
}) {
  const Component = adapters[mechanic];
  if (!Component) {
    return (
      <div style={{ color: '#64748b', fontSize: 16 }}>
        Эта механика доступна только в V2. Переключите движок в настройках.
      </div>
    );
  }
  return (
    <Suspense
      fallback={
        <div style={{ color: '#64748b', fontSize: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="reveal-anim">Загрузка механики…</span>
        </div>
      }
    >
      <Component
        teams={teams}
        targetTeam={targetTeam}
        seed={seed}
        reducedMotion={reducedMotion}
        onComplete={onComplete}
      />
    </Suspense>
  );
});

export default function PresenterMode() {
  const { state, dispatch } = useAppState();
  const { canPick, isRevealing, lastResult, mechanic, startSelection, clearReveal } =
    useSelection();

  // Defensive: a persisted mechanic id no longer present in MECHANIC_META (renamed/removed
  // mechanic, or state saved by a newer build) must never crash the whole show.
  const enabledMechanics = state.settings.enabledMechanics.filter((m) => MECHANIC_META[m]);

  // If current mechanic is disabled and there are enabled ones, switch to first enabled
  useEffect(() => {
    if (enabledMechanics.length > 0 && !enabledMechanics.includes(mechanic)) {
      dispatch(actions.selectMechanic(enabledMechanics[0]));
    }
  }, [enabledMechanics, mechanic, dispatch]);

  const { playClick, playWin } = useSound();
  const [animating, setAnimating] = useState(false);

  const historyVisible = state.ui.historyVisible;

  const activeTeams = state.masterTeams.filter((t) =>
    state.session.activeTeamIds.includes(t.id)
  );

  const historyTeams = state.session.history
    .map((h) => state.masterTeams.find((t) => t.id === h.teamId))
    .filter((t): t is NonNullable<typeof t> => !!t);

  const handleStart = useCallback(() => {
    if (!canPick || animating) return;
    playClick();
    setAnimating(true);
    startSelection();
  }, [canPick, animating, playClick, startSelection]);

  const handleAnimationComplete = useCallback(
    (_winner?: Team) => {
      playWin();
      setAnimating(false);
    },
    [playWin]
  );

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

  const noMechanicsEnabled = enabledMechanics.length === 0;

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '28px 32px 20px',
        gap: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
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
              boxShadow: '0 4px 16px var(--accent-glow)',
            }}
          >
            🎲
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                color: 'var(--text)',
                fontWeight: 800,
                letterSpacing: -0.5,
              }}
            >
              Кто следующий?
            </h1>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
              {state.session.isActive ? 'Сессия активна' : 'Нет активной сессии'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() =>
              dispatch(actions.setHistoryVisible(!historyVisible))
            }
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: historyVisible ? 'var(--accent)' : 'var(--text-dim)',
              padding: '10px 14px',
              fontSize: 16,
            }}
            title={historyVisible ? 'Скрыть историю' : 'Показать историю'}
          >
            {historyVisible ? '📋' : '📭'}
          </button>
          <button
            onClick={() =>
              dispatch(
                actions.setSettings({
                  soundEnabled: !state.settings.soundEnabled,
                })
              )
            }
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: state.settings.soundEnabled ? 'var(--accent)' : 'var(--text-dim)',
              padding: '10px 14px',
              fontSize: 18,
            }}
            title={state.settings.soundEnabled ? 'Выключить звук' : 'Включить звук'}
          >
            {state.settings.soundEnabled ? '🔊' : '🔇'}
          </button>
          <button
            onClick={() => dispatch(actions.setMode('admin'))}
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-dim)' }}
          >
            ⚙️ Админ
          </button>
        </div>
      </div>

      {/* Mechanic tabs */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
        {noMechanicsEnabled ? (
          <div
            style={{
              padding: '10px 18px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 12,
              color: 'var(--text-dim)',
              fontSize: 13,
            }}
          >
            ⚠️ В админке включите хотя бы одну механику
          </div>
        ) : (
          enabledMechanics.map((m) => (
            <button
              key={m}
              onClick={() => {
                playClick();
                dispatch(actions.selectMechanic(m));
              }}
              style={{
                background:
                  mechanic === m
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
          ))
        )}
      </div>

      {/* Stage - fills remaining space */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          position: 'relative',
          minHeight: 0,
        }}
      >
        {noMechanicsEnabled ? (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🛠️</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
              Все механики выключены
            </div>
            <div style={{ fontSize: 13, marginTop: 8, color: 'var(--text-dim)' }}>
              Перейдите в Админ → Механики и выберите нужные
            </div>
          </div>
        ) : isRevealing && lastResult ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg)',
              padding: 24,
            }}
          >
            <MechanicStage
              mechanic={mechanic}
              teams={activeTeams}
              targetTeam={lastResult.team}
              seed={lastResult.animationHint.seed}
              reducedMotion={state.settings.reducedMotion}
              onComplete={handleAnimationComplete}
            />
          </div>
        ) : (
          <>
            <div
              style={{
                textAlign: 'center',
                color: 'var(--text-dim)',
                animation: 'float 4s ease-in-out infinite',
              }}
            >
              <div
                style={{
                  fontSize: 72,
                  marginBottom: 16,
                  filter: 'drop-shadow(0 0 30px var(--accent-glow))',
                }}
              >
                🎯
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>
                Нажмите «Старт», чтобы выбрать следующую команду
              </div>
              <div style={{ fontSize: 13, marginTop: 8, color: 'var(--text-dim)' }}>
                Или просто нажмите Пробел
              </div>
            </div>

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
                boxShadow: canPick ? '0 8px 32px var(--accent-glow)' : 'none',
                animation: canPick ? 'pulse-glow 3s ease-in-out infinite' : 'none',
              }}
            >
              {canPick ? '▶ Старт' : 'Все команды выступили'}
            </button>
          </>
        )}
      </div>

      {/* Result overlay - only when animation done */}
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
          <div
            style={{
              fontSize: 18,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 3,
            }}
          >
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
              <span
                style={{
                  fontSize: 56,
                  marginRight: 16,
                  verticalAlign: 'middle',
                }}
              >
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

      {/* Footer info - collapsible */}
      {historyVisible && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            flexShrink: 0,
          }}
        >
          <div className="card">
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-dim)',
                marginBottom: 10,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                fontWeight: 700,
              }}
            >
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
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-dim)',
                marginBottom: 10,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                fontWeight: 700,
              }}
            >
              История
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {historyTeams.length === 0 && (
                <div style={{ color: '#475569', fontSize: 13 }}>
                  Пока никто не выступал
                </div>
              )}
              {historyTeams.map((t, i) => (
                <div
                  key={`${t.id}-${i}`}
                  style={{
                    fontSize: 13,
                    color: 'var(--text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.06)',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-dim)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <TeamBadge team={t} size="sm" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
