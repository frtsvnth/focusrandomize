
import type { Team } from '../../domain/types';

export function TeamBadge({ team, size = 'md' }: { team: Team; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 10 : size === 'md' ? 14 : 20;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {team.logo ? (
        <span style={{ fontSize: s + 4 }}>{team.logo}</span>
      ) : (
        <span
          style={{
            width: s,
            height: s,
            borderRadius: '50%',
            background: team.color,
            display: 'inline-block',
            boxShadow: `0 0 6px ${team.color}66`,
          }}
        />
      )}
      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{team.name}</span>
    </span>
  );
}
