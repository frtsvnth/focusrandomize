import { useState, useRef } from 'react';
import { useAppState } from '../../state/store';
import { exportJSON, importJSON } from '../../state/persistence';
import type { Team } from '../../domain/types';

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function randomColor() {
  const colors = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#a855f7','#ec4899','#f43f5e','#14b8a6'];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default function AdminMode() {
  const { state, dispatch } = useAppState();
  const [pinInput, setPinInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const unlocked = state.ui.adminUnlocked || !state.settings.adminPin;

  const handleUnlock = () => {
    if (pinInput === state.settings.adminPin) {
      dispatch({ type: 'UNLOCK_ADMIN' });
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
    dispatch({ type: 'ADD_TEAM', payload: team });
  };

  const updateTeam = (team: Team) => {
    dispatch({ type: 'UPDATE_TEAM', payload: team });
  };

  const deleteTeam = (id: string) => {
    if (confirm('Удалить команду?')) dispatch({ type: 'DELETE_TEAM', payload: id });
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
    dispatch({ type: 'REORDER_TEAMS', payload: ids });
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
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#fff' }}>Админ-панель</h1>
        </div>
        <button onClick={() => dispatch({ type: 'SET_MODE', payload: 'presenter' })} style={{ background: 'rgba(255,255,255,0.06)', color: '#e2e8f0' }}>
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
          {/* Session controls — FIRST */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Управление сессией</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <button onClick={() => dispatch({ type: 'START_SESSION' })} style={{ background: 'linear-gradient(135deg, var(--accent), var(--purple))', color: '#020617' }}>
                🚀 Новая сессия
              </button>
              <button onClick={() => dispatch({ type: 'RESET_SESSION' })} style={{ background: 'rgba(255,255,255,0.06)', color: '#e2e8f0' }}>
                ↺ Сбросить текущую
              </button>
              <button onClick={() => dispatch({ type: 'UNDO_LAST_PICK' })} style={{ background: 'rgba(255,255,255,0.06)', color: '#e2e8f0' }}>
                ↩ Отменить последний выбор
              </button>
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              Активных команд: <strong style={{ color: '#e2e8f0' }}>{activeIds.length}</strong> | Выбрано: <strong style={{ color: '#e2e8f0' }}>{history.length}</strong>
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
                      style={{ background: 'transparent', color: idx === 0 ? '#334155' : '#64748b', padding: '2px 6px', fontSize: 12, borderRadius: 4 }}
                    >▲</button>
                    <button
                      onClick={() => moveTeam(t.id, 'down')}
                      disabled={idx === state.masterTeams.length - 1}
                      style={{ background: 'transparent', color: idx === state.masterTeams.length - 1 ? '#334155' : '#64748b', padding: '2px 6px', fontSize: 12, borderRadius: 4 }}
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
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
                        onClick={() => dispatch({ type: 'REMOVE_FROM_SESSION', payload: t.id })}
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', padding: '5px 8px', fontSize: 12, borderRadius: 8 }}
                        title="Убрать из текущей сессии"
                      >
                        −
                      </button>
                    ) : (
                      <button
                        onClick={() => dispatch({ type: 'RESTORE_TO_SESSION', payload: t.id })}
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
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Сценарий очередности</h2>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 6 }}>
                  Полный порядок (ID команд через запятую)
                </label>
                <input
                  style={{ width: '100%' }}
                  value={state.scriptPlan.fullOrder?.join(', ') ?? ''}
                  onChange={(e) => {
                    const ids = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                    dispatch({ type: 'SET_SCRIPT_PLAN', payload: { ...state.scriptPlan, fullOrder: ids.length ? ids : undefined } });
                  }}
                />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 6 }}>
                  Фиксированные позиции (JSON: {'{'}&quot;1&quot;:&quot;teamId&quot;{'}'})
                </label>
                <input
                  style={{ width: '100%' }}
                  value={state.scriptPlan.fixedPositions ? JSON.stringify(state.scriptPlan.fixedPositions) : ''}
                  onChange={(e) => {
                    try {
                      const obj = e.target.value ? JSON.parse(e.target.value) : undefined;
                      dispatch({ type: 'SET_SCRIPT_PLAN', payload: { ...state.scriptPlan, fixedPositions: obj } });
                    } catch {
                      // ignore
                    }
                  }}
                />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 13, display: 'block', marginBottom: 6 }}>
                  Следующая команда (принудительно)
                </label>
                <select
                  style={{ width: '100%' }}
                  value={state.scriptPlan.pinnedNext ?? ''}
                  onChange={(e) => dispatch({ type: 'PIN_NEXT', payload: e.target.value || undefined })}
                >
                  <option value="">— Не задано —</option>
                  {state.masterTeams.filter((t) => t.enabled).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => dispatch({ type: 'SET_SCRIPT_PLAN', payload: {} })}
                style={{ background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', justifySelf: 'start' }}
              >
                Сбросить правила
              </button>
            </div>
          </div>

          {/* Settings */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Настройки</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#e2e8f0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={state.settings.soundEnabled}
                  onChange={(e) => dispatch({ type: 'SET_SETTINGS', payload: { soundEnabled: e.target.checked } })}
                />
                Звуковые эффекты
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#e2e8f0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={state.settings.reducedMotion}
                  onChange={(e) => dispatch({ type: 'SET_SETTINGS', payload: { reducedMotion: e.target.checked } })}
                />
                Уменьшить анимацию (доступность)
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>PIN админки (только UI):</span>
                <input
                  type="text"
                  value={state.settings.adminPin}
                  onChange={(e) => dispatch({ type: 'SET_SETTINGS', payload: { adminPin: e.target.value } })}
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
                style={{ background: 'rgba(255,255,255,0.06)', color: '#e2e8f0' }}
              >
                📥 Экспорт JSON
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                style={{ background: 'rgba(255,255,255,0.06)', color: '#e2e8f0' }}
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
                    dispatch({ type: 'IMPORT_STATE', payload: parsed });
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
            <div style={{ fontSize: 13, color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'monospace' }}>
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
