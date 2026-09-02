import { useEffect, useState } from 'react';

const STORAGE_KEY = 'focus-randomizer-release-banner-v1';
const NEW_VERSION_URL = 'https://sme.pupupu.cloud/whogoesnext/';

export default function ReleaseBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
  };

  if (!visible) return null;

  return (
    <div className="release-banner" role="region" aria-label="Вышла новая версия приложения">
      <div
        style={{
          padding: 1,
          borderRadius: 18,
          background: 'linear-gradient(135deg, var(--accent), var(--purple), var(--pink))',
          boxShadow: '0 12px 48px rgba(0,0,0,0.45), 0 0 40px var(--accent-glow)',
        }}
      >
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 16px',
            borderRadius: 17,
            background: 'linear-gradient(135deg, rgba(17,24,39,0.96), rgba(11,18,33,0.96))',
            backdropFilter: 'blur(16px)',
          }}
        >
          <span className="release-shine" aria-hidden="true" />

          <div
            style={{
              flexShrink: 0,
              width: 42,
              height: 42,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              background: 'linear-gradient(135deg, var(--purple), var(--pink))',
              boxShadow: '0 0 20px var(--accent-glow)',
            }}
          >
            ✨
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: 0.01 }}>
              Вышла новая версия — Who Goes Next
            </div>
            <div className="release-hide-mobile" style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>
              Обновлённый выбор очередности команд. Эта версия остаётся доступной.
            </div>
          </div>

          <a
            href={NEW_VERSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flexShrink: 0,
              textDecoration: 'none',
              padding: '11px 18px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 800,
              color: '#020617',
              background: 'linear-gradient(135deg, var(--accent), var(--purple))',
              boxShadow: '0 6px 20px var(--accent-glow)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            Перейти
          </a>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Закрыть баннер"
            title="Закрыть"
            style={{
              flexShrink: 0,
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              borderRadius: 9,
              fontSize: 16,
              lineHeight: 1,
              color: 'var(--text-dim)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
