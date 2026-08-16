import { useEffect, useState, useCallback, Suspense, memo } from 'react';
import { useAppState } from '../../../state/store';
import { useSelection } from '../../../hooks/useSelection';
import { useSoundV2 } from '../../../hooks/useSoundV2';
import { MECHANIC_META } from '../../../mechanics/adapter';
import { V1_ADAPTERS } from '../../../mechanics';
import { V2_ADAPTERS } from '../../../mechanics-v2';
import AmbientField from '../../../mechanics-v2/engine/AmbientField';
import { TeamBadge } from '../../shared/TeamBadge';
import { actions } from '../../../state/actions';
import type { MechanicId, Team } from '../../../domain/types';
import type { SoundV2Api } from '../../../mechanics-v2/adapter';

const MechanicStage = memo(function MechanicStage({
  mechanic,
  teams,
  targetTeam,
  seed,
  reducedMotion,
  onComplete,
  sound,
}: {
  mechanic: MechanicId;
  teams: Team[];
  targetTeam: Team;
  seed: number;
  reducedMotion: boolean;
  onComplete: (winner?: Team) => void;
  sound: SoundV2Api;
}) {
  const Component = V2_ADAPTERS[mechanic] ?? V1_ADAPTERS[mechanic];
  return (
    <Suspense
      fallback={
        <div style={{ color: 'var(--text-dim)', fontSize: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
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
        sound={sound}
      />
    </Suspense>
  );
});

export default function PresenterModeV2() {
  const { state, dispatch } = useAppState();
  const { canPick, isRevealing, lastResult, mechanic, startSelection, clearReveal } =
    useSelection();

  const enabledMechanics = state.settings.enabledMechanics;

  useEffect(() => {
    if (enabledMechanics.length > 0 && !enabledMechanics.includes(mechanic)) {
      dispatch(actions.selectMechanic(enabledMechanics[0]));
    }
  }, [enabledMechanics, mechanic, dispatch]);

  const sound = useSoundV2();
  const [animating, setAnimating] = useState(false);
  const [prerolling, setPrerolling] = useState(false);

  const historyVisible = state.ui.historyVisible;
  const reducedMotion = state.settings.reducedMotion;
  const isV2Mechanic = !!V2_ADAPTERS[mechanic];

  const activeTeams = state.masterTeams.filter((t) =>
    state.session.activeTeamIds.includes(t.id)
  );

  const historyTeams = state.session.history
    .map((h) => state.masterTeams.find((t) => t.id === h.teamId))
    .filter((t): t is NonNullable<typeof t> => !!t);

  const handleStart = useCallback(() => {
    if (!canPick || animating || prerolling) return;
    sound.playClick();
    setPrerolling(true);
    if (!reducedMotion) sound.playDrumroll(0.85);
    const delay = reducedMotion ? 120 : 900;
    setTimeout(() => {
      setPrerolling(false);
      setAnimating(true);
      startSelection();
    }, delay);
  }, [canPick, animating, prerolling, reducedMotion, sound, startSelection]);

  const handleAnimationComplete = useCallback(
    (_winner?: Team) => {
      if (!isV2Mechanic) {
        // V1 fallback mechanics don't play their own sound/particles.
        sound.playFanfare();
      }
      setAnimating(false);
    },
    [isV2Mechanic, sound]
  );

  const handleNext = useCallback(() => {
    clearReveal();
  }, [clearReveal]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (isRevealing && !animating) handleNext();
        else if (!isRevealing && !animating && !prerolling) handleStart();
      }
      if (e.key === 'f') {
        document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isRevealing, animating, prerolling, handleNext, handleStart]);

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
        position: 'relative',
      }}
    >
      <AmbientField reducedMotion={reducedMotion} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 15,
                background: 'linear-gradient(135deg, var(--accent), var(--purple), var(--pink))',
                backgroundSize: '200% 200%',
                animation: 'v2-gradient-shift 6s ease infinite',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 23,
                boxShadow: '0 6px 24px var(--accent-glow)',
              }}
            >
              🎲
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 23,
                  fontWeight: 900,
                  letterSpacing: -0.5,
                  background: 'linear-gradient(120deg, var(--text), var(--accent))',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                Кто следующий?
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    marginLeft: 10,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: 'rgba(167,139,250,0.18)',
                    color: 'var(--purple)',
                    WebkitBackgroundClip: 'initial',
                    backgroundClip: 'initial',
                    verticalAlign: 'middle',
                    letterSpacing: 0.5,
                  }}
                >
                  V2
                </span>
              </h1>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                {state.session.isActive ? 'Сессия активна' : 'Нет активной сессии'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => dispatch(actions.setHistoryVisible(!historyVisible))}
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
              onClick={() => dispatch(actions.setSettings({ soundEnabled: !state.settings.soundEnabled }))}
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
            enabledMechanics.map((m) => {
              const hasV2 = !!V2_ADAPTERS[m];
              return (
                <button
                  key={m}
                  onClick={() => {
                    sound.playClick();
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {MECHANIC_META[m].label}
                  {hasV2 && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '2px 5px',
                        borderRadius: 999,
                        background: mechanic === m ? 'rgba(2,6,23,0.25)' : 'rgba(52,211,153,0.18)',
                        color: mechanic === m ? '#020617' : 'var(--success)',
                      }}
                    >
                      NEW
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Stage */}
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
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>Все механики выключены</div>
              <div style={{ fontSize: 13, marginTop: 8, color: 'var(--text-dim)' }}>
                Перейдите в Админ → Механики и выберите нужные
              </div>
            </div>
          ) : prerolling ? (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 40,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(3,7,18,0.75)',
                backdropFilter: 'blur(6px)',
              }}
            >
              <div
                style={{
                  fontSize: 90,
                  animation: 'v2-preroll-pulse 0.9s ease-in-out infinite',
                  filter: 'drop-shadow(0 0 40px var(--accent-glow))',
                }}
              >
                🎯
              </div>
              <div
                style={{
                  fontSize: 16,
                  color: 'var(--text-dim)',
                  marginTop: 18,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                Определяем следующего…
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
                reducedMotion={reducedMotion}
                onComplete={handleAnimationComplete}
                sound={sound}
              />
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', animation: 'float 4s ease-in-out infinite' }}>
                <div style={{ fontSize: 72, marginBottom: 16, filter: 'drop-shadow(0 0 30px var(--accent-glow))' }}>🎯</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>
                  Нажмите «Старт», чтобы выбрать следующую команду
                </div>
                <div style={{ fontSize: 13, marginTop: 8, color: 'var(--text-dim)' }}>Или просто нажмите Пробел</div>
              </div>

              <button
                onClick={handleStart}
                disabled={!canPick}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  fontSize: 22,
                  padding: '18px 48px',
                  background: canPick ? 'linear-gradient(135deg, var(--accent), var(--purple), var(--pink))' : '#334155',
                  backgroundSize: '200% 200%',
                  animation: canPick ? 'v2-gradient-shift 4s ease infinite, v2-cta-pulse 3s ease-in-out infinite' : 'none',
                  color: canPick ? '#020617' : '#94a3b8',
                  borderRadius: 16,
                  boxShadow: canPick ? '0 10px 40px var(--accent-glow)' : 'none',
                }}
              >
                {canPick ? '▶ Старт' : 'Все команды выступили'}
              </button>
            </>
          )}
        </div>

        {/* Result overlay */}
        {isRevealing && !animating && !prerolling && lastResult && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: `radial-gradient(circle at 50% 35%, ${lastResult.team.color}22 0%, transparent 42%), rgba(2,4,10,0.97)`,
              backdropFilter: 'blur(14px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              flexDirection: 'column',
              gap: 26,
            }}
            className="reveal-anim"
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 22,
                padding: '40px 64px',
                borderRadius: 28,
                background: 'rgba(1,3,9,0.75)',
                border: `1px solid ${lastResult.team.color}33`,
                boxShadow: `0 0 90px ${lastResult.team.color}22, inset 0 0 60px rgba(0,0,0,0.4)`,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: 5,
                  fontWeight: 700,
                }}
              >
                Слово предоставляется
              </div>
              <div
                style={{
                  fontSize: 'clamp(40px, 7vw, 76px)',
                  fontWeight: 900,
                  color: lastResult.team.color,
                  textShadow: `0 0 40px ${lastResult.team.color}bb, 0 2px 10px rgba(0,0,0,0.9)`,
                  textAlign: 'center',
                  letterSpacing: -1.5,
                  animation: 'v2-title-pop 0.6s cubic-bezier(0.22,1,0.36,1)',
                }}
              >
                {lastResult.team.logo && (
                  <span style={{ fontSize: '0.8em', marginRight: 16, verticalAlign: 'middle' }}>{lastResult.team.logo}</span>
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
                  fontWeight: 800,
                }}
              >
                🎤 Передать слово
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        {historyVisible && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flexShrink: 0 }}>
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
                  <div style={{ color: '#475569', fontSize: 13 }}>Пока никто не выступал</div>
                )}
                {historyTeams.map((t, i) => (
                  <div
                    key={`${t.id}-${i}`}
                    style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}
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
    </div>
  );
}
