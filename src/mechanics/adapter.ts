import type { Team, MechanicId } from '../domain/types';

export interface MechanicAdapterProps {
  teams: Team[];
  targetTeam: Team;
  seed: number;
  reducedMotion: boolean;
  onComplete: () => void;
}

export const MECHANIC_META: Record<
  MechanicId,
  { label: string; description: string }
> = {
  wheel: { label: 'Колесо Фортуны', description: 'Крутите колесо!' },
  plinko: { label: 'Плинко', description: 'Бросьте шарик' },
  pinball: { label: 'Пинбол', description: 'Запустите шар' },
  slot: { label: 'Автомат', description: 'Дёрните рычаг' },
  race: { label: 'Скачки', description: 'Кто первым к финишу' },
  claw: { label: 'Хватайка', description: 'Захватите капсулу' },
  cards: { label: 'Тайные карты', description: 'Откройте одну' },
};
