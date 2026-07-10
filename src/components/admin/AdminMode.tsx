import { useState, useRef } from 'react';
import { useAppState } from '../../state/store';
import { exportJSON, importJSON } from '../../state/persistence';
import { MECHANIC_META } from '../../mechanics/adapter';
import { actions } from '../../state/actions';
import type { Team, MechanicId, ThemeId } from '../../domain/types';

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function randomColor() {
  const colors = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#a855f7','#ec4899','#f43f5e','#14b8a6'];
  return colors[Math.floor(Math.random() * colors.length)];
}

const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'dark', label: 'Тёмная' },
  { id: 'light', label: 'Светлая' },
  { id: 'neon', label: 'Неон' },
  { id: 'retro', label: 'Ретро' },
  { id: 'space', label: 'Космос' },
];

export default function AdminMode() {
  const { state, dispatch } = useAppState();
  const [pinInput, setPinInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [queueSelect, setQueueSelect] = useState('');

  const unlocked = state.ui.adminUnlocked || !state.settings.adminPin;

  const handleUnlock = () => {
    if (pinInput === state.settings.adminPin) {
      dispatch(actions.unlockAdmin());
    }
  };

  const addTeam = () => {
    const name = prompt('Название команды?');
    if (!name) return;
    const team: Team = {
      id: generateId(),
      name,
      color: randomColor(),
      enabled: true,
    };
    dispatch(actions.addTeam(team));
  };

  const updateTeam = (team: Team) => {
    dispatch(actions.updateTeam(team));
  };

  const deleteTeam = (id: string) => {
    if (confirm('Удалить команду?')) dispatch(actions.deleteTeam(id));
  };

  const moveTeam = (id: string, direction: 'up' | 'down') => {
    const ids = state.masterTeams.map((t) => t.id);
    const idx = ids.indexOf(id);
    if (idx === -1) return;
    if (direction === 'up' && idx > 0) {
      [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    }
    if (direction === 'down' && idx < ids.length - 1) {
      [ids[idx + 1], ids[idx]] = [ids[idx], ids[idx + 1]];
    }
    dispatch(actions.reorderTeams(ids));
  };

  const activeIds = state.session.activeTeamIds;
  const history = state.session.history;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--purple), var(--pink))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>⚙️</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>Админ-панель</h1>
        </div>
        <button onClick={() => dispatch(actions.setMode('presenter'))} style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text)' }}>
          ← Назад к шоу
        </button>
      </div>

      {!unlocked && (
        <div className="card" style={{ marginBottom: 24, border: '1px solid rgba(251,191,36,0.2)' }}>
          <div style={{ color: 'var(--warning)', marginBottom: 12, fontSize: 14 }}>
            🔒 Доступ к админке — только на уровне интерфейса. Это не настоящая аутентификация.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="password" placeholder="Введите PIN" value={pinInput} onChange={(e) => setPinInput(e.target.value)} />
            <button onClick={handleUnlock} style={{ background: 'var(--accent)', color: '#020617' }}>Разблокировать</button>
          </div>
        </div>
      )}

      {unlocked && (
        <>
          {/* Session controls */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Управление сессией</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <button onClick={() => dispatch(actions.startSession())} style={{ background: 'linear-gradient(135deg, var(--accent), var(--purple))', color: '#020617' }}>
                🚀 Новая сессия
              </button>
              <button onClick={() => dispatch(actions.resetSession())} style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text)' }}>
                ↺ Сбросить текущую
              </button>
              <button onClick={() => dispatch(actions.undoLastPick())} style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text)' }}>
                ↩ Отменить последний выбор
              </button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Активных команд: <strong style={{ color: 'var(--text)' }}>{activeIds.length}</strong> | Выбрано: <strong style={{ color: 'var(--text)' }}>{history.length}</strong>
            </div>
          </div>

          {/* Teams */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Команды</h2>
              <button onClick={addTeam} style={{ background: 'linear-gradient(135deg, var(--success), #10b981)', color: '#020617' }}>+ Добавить</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {state.masterTeams.map((t, idx) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.05)',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Move buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button
                      onClick={() => moveTeam(t.id, 'up')}
                      disabled={idx === 0}
                      style={{ background: 'transparent', color: idx === 0 ? '#334155' : 'var(--text-dim)', padding: '2px 6px', fontSize: 12, borderRadius: 4 }}
                    >▲</button>
                    <button
                      onClick={() => moveTeam(t.id, 'down')}
                      disabled={idx === state.masterTeams.length - 1}
                      style={{ background: 'transparent', color: idx === state.masterTeams.length - 1 ? '#334155' : 'var(--text-dim)', padding: '2px 6px', fontSize: 12, borderRadius: 4 }}
                    >▼</button>
                  </div>
                  <input
                    type="color"
                    value={t.color}
                    onChange={(e) => updateTeam({ ...t, color: e.target.value })}
                    style={{ width: 32, height: 32, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                  />
                  <input
                    value={t.logo ?? ''}
                    placeholder="🎭"
                    onChange={(e) => updateTeam({ ...t, logo: e.target.value || undefined })}
                    style={{ width: 56, textAlign: 'center' }}
                  />
                  <input
                    value={t.name}
                    onChange={(e) => updateTeam({ ...t, name: e.target.value })}
                    style={{ flex: 1, minWidth: 120 }}
                  />
                  <code style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', flexShrink: 0 }}>{t.id.slice(0, 8)}…</code>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={t.enabled}
                      onChange={(e) => updateTeam({ ...t, enabled: e.target.checked })}
                    />
                    В игре
                  </label>
                  {state.session.isActive && (
                    activeIds.includes(t.id) ? (
                      <button
                        onClick={() => dispatch(actions.removeFromSession(t.id))}
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text)', padding: '5px 8px', fontSize: 12, borderRadius: 8 }}
                        title="Убрать из текущей сессии"
                      >
                        −
                      </button>
                    ) : (
                      <button
                        onClick={() => dispatch(actions.restoreToSession(t.id))}
                        style={{ background: 'var(--success)', color: '#020617', padding: '5px 8px', fontSize: 12, borderRadius: 8 }}
                        title="Вернуть в сессию"
                      >
                        +
                      </button>
                    )
                  )}
                  <button onClick={() => deleteTeam(t.id)} style={{ background: 'var(--danger)', color: '#fff', padding: '5px 10px', fontSize: 12, borderRadius: 8 }}>
                    Удл.
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Script Plan */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Очередь выступлений</h2>
            <div style={{ display: 'grid', gap: 14 }}>
              {/* Visual queue list */}
              <div>
                <label style={{ color: 'var(--text-dim)', fontSize: 13, display: 'block', marginBottom: 8 }}>
                  Запланированный порядок
                </label>
                {state.scriptPlan.fullOrder && state.scriptPlan.fullOrder.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    {state.scriptPlan.fullOrder.map((id, idx) => {
                      const team = state.masterTeams.find(t => t.id === id);
                      return (
                        <div
                          key={`${id}-${idx}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            background: 'rgba(255,255,255,0.04)',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.08)',
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--text-dim)',
                            flexShrink: 0,
                          }}>{idx + 1}</span>
                          <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: team?.color ?? '#475569',
                            flexShrink: 0,
                          }} />
                          <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>
                            {team ? team.name : <span style={{ color: '#ef4444' }}>?? {id.slice(0, 8)}…</span>}
                          </span>
                          <button
                            onClick={() => {
                              const next = state.scriptPlan.fullOrder!.filter((fid) => fid !== id);
                              dispatch(
                                actions.setScriptPlan({ ...state.scriptPlan, fullOrder: next.length ? next : undefined })
                              );
                            }}
                            style={{ background: 'transparent', color: '#ef4444', padding: '2px 6px', fontSize: 12, borderRadius: 4 }}
                            title="Убрать из очереди"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ color: '#475569', fontSize: 13, marginBottom: 8 }}>
                    Очередь не задана — команды будут выбираться случайно
                  </div>
                )}
              </div>

              {/* Add team to end */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={queueSelect}
                  onChange={(e) => setQueueSelect(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">-- Выберите команду --</option>
                  {state.masterTeams
                    .filter((t) => t.enabled)
                    .filter((t) => !state.scriptPlan.fullOrder?.includes(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
                <button
                  onClick={() => {
                    if (!queueSelect) return;
                    dispatch(
                      actions.setScriptPlan({
                        ...state.scriptPlan,
                        fullOrder: [...(state.scriptPlan.fullOrder ?? []), queueSelect],
                      })
                    );
                    setQueueSelect('');
                  }}
                  style={{ background: 'var(--accent)', color: '#020617', whiteSpace: 'nowrap' }}
                >
                  В конец очереди
                </button>
              </div>

              {/* Quick actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {state.masterTeams
                  .filter((t) => t.enabled)
                  .filter((t) => !state.scriptPlan.fullOrder?.includes(t.id))
                  .slice(0, 8)
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        dispatch(
                          actions.setScriptPlan({
                            ...state.scriptPlan,
                            fullOrder: [...(state.scriptPlan.fullOrder ?? []), t.id],
                          })
                        );
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        color: '#cbd5e1',
                        padding: '4px 10px',
                        fontSize: 12,
                        borderRadius: 8,
                      }}
                    >
                      + {t.name}
                    </button>
                  ))}
              </div>

              {/* Pinned next */}
              <div>
                <label style={{ color: 'var(--text-dim)', fontSize: 13, display: 'block', marginBottom: 6 }}>
                  Следующая команда (принудительно)
                </label>
                <select
                  style={{ width: '100%' }}
                  value={state.scriptPlan.pinnedNext ?? ''}
                  onChange={(e) => dispatch(actions.pinNext(e.target.value || undefined))}
                >
                  <option value="">— Не задано —</option>
                  {state.masterTeams.filter((t) => t.enabled).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Always last */}
              <div>
                <label style={{ color: 'var(--text-dim)', fontSize: 13, display: 'block', marginBottom: 6 }}>
                  Команда, выступающая последней
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    style={{ flex: 1 }}
                    value={state.scriptPlan.lastTeamId ?? ''}
                    onChange={(e) =>
                      dispatch(
                        actions.setScriptPlan({ ...state.scriptPlan, lastTeamId: e.target.value || undefined })
                      )
                    }
                  >
                    <option value="">— Не задано —</option>
                    {state.masterTeams.filter((t) => t.enabled).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {state.scriptPlan.lastTeamId && (
                    <button
                      onClick={() =>
                        dispatch(
                          actions.setScriptPlan({ ...state.scriptPlan, lastTeamId: undefined })
                        )
                      }
                      style={{ background: 'transparent', color: '#ef4444', padding: '6px 10px', fontSize: 13, borderRadius: 8 }}
                      title="Снять отметку"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {state.scriptPlan.lastTeamId && (
                  <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>
                    {state.masterTeams.find((t) => t.id === state.scriptPlan.lastTeamId)?.name ?? ''} будет выступать последней
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => dispatch(actions.setScriptPlan({}))}
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text)' }}
                >
                  Очистить очередь
                </button>
              </div>
            </div>
          </div>

          {/* Mechanics */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Механики</h2>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
              По умолчанию все выключены. Включите те, которые хотите использовать в шоу.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(Object.keys(MECHANIC_META) as MechanicId[]).map((m) => {
                const enabled = state.settings.enabledMechanics.includes(m);
                return (
                  <label
                    key={m}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      color: enabled ? 'var(--text)' : '#475569',
                      cursor: 'pointer',
                      padding: '6px 0',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...state.settings.enabledMechanics, m]
                          : state.settings.enabledMechanics.filter((id) => id !== m);
                        dispatch(actions.setSettings({ enabledMechanics: next }));
                      }}
                    />
                    <span style={{ fontWeight: enabled ? 600 : 400 }}>{MECHANIC_META[m].label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>— {MECHANIC_META[m].description}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Settings */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Настройки</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={state.settings.soundEnabled}
                  onChange={(e) => dispatch(actions.setSettings({ soundEnabled: e.target.checked }))}
                />
                Звуковые эффекты
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={state.settings.reducedMotion}
                  onChange={(e) => dispatch(actions.setSettings({ reducedMotion: e.target.checked }))}
                />
                Уменьшить анимацию (доступность)
              </label>

              {/* Theme picker */}
              <div>
                <label style={{ color: 'var(--text-dim)', fontSize: 13, display: 'block', marginBottom: 8 }}>
                  Тема оформления
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => dispatch(actions.setSettings({ theme: theme.id }))}
                      style={{
                        background: state.settings.theme === theme.id
                          ? 'linear-gradient(135deg, var(--accent), var(--purple))'
                          : 'rgba(255,255,255,0.06)',
                        color: state.settings.theme === theme.id ? '#020617' : 'var(--text)',
                        padding: '8px 16px',
                        fontSize: 13,
                        borderRadius: 10,
                      }}
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>PIN админки (только UI):</span>
                <input
                  type="text"
                  value={state.settings.adminPin}
                  onChange={(e) => dispatch(actions.setSettings({ adminPin: e.target.value }))}
                  placeholder="Пусто = без защиты"
                  style={{ flex: 1, maxWidth: 240 }}
                />
              </div>
            </div>
          </div>

          {/* Backup */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Резервная копия</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const blob = new Blob([exportJSON(state)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'sprint-review-show.json';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text)' }}
              >
                📥 Экспорт JSON
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text)' }}
              >
                📤 Импорт JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  const parsed = importJSON(text);
                  if (parsed) {
                    dispatch(actions.importState(parsed));
                    alert('Импорт успешен');
                  } else {
                    alert('Некорректный JSON');
                  }
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          {/* Debug */}
          <div className="card">
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Отладка</h2>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'monospace' }}>
              <div>Статус: {state.session.isActive ? 'активна' : 'неактивна'}</div>
              <div>Осталось: {activeIds.map((id) => state.masterTeams.find((t) => t.id === id)?.name).filter(Boolean).join(', ')}</div>
              <div>История: {history.map((h) => `${state.masterTeams.find((t) => t.id === h.teamId)?.name} (${h.reason})`).join(' → ')}</div>
              {state.ui.lastResult && (
                <div style={{ color: 'var(--accent)' }}>
                  Последний: {state.ui.lastResult.team.name} | причина: {state.ui.lastResult.reason} | seed: {state.ui.lastResult.animationHint.seed}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
