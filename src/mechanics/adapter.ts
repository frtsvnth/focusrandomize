import type { Team, MechanicId } from '../domain/types';

export interface MechanicAdapterProps {
  teams: Team[];
  targetTeam: Team;
  seed: number;
  reducedMotion: boolean;
  onComplete: (winner?: Team) => void;
}

export const MECHANIC_META: Record<
  MechanicId,
  { label: string; description: string }
> = {
  wheel: { label: 'Колесо Фортуны', description: 'Крутите колесо!' },
  slot: { label: 'Автомат', description: 'Дёрните рычаг' },
  race: { label: 'Скачки', description: 'Кто первым к финишу' },
  claw: { label: 'Хватайка', description: 'Захватите капсулу' },
  cards: { label: 'Тайные карты', description: 'Откройте одну' },
  stickman: { label: 'Битва стикменов', description: 'Сражайтесь до победы' },
  elevator: { label: 'Лифт', description: 'Кто на этом этаже?' },
  tornado: { label: 'Торнадо', description: 'Вихрь отбора' },
  dice: { label: 'Кости', description: 'Брось кубик' },
  gladiator: { label: 'Гладиаторы', description: 'Бой на арене' },
  alien: { label: 'Похищение', description: 'НЛО выбирает жертву' },
  toyRace: { label: 'Игрушечные гонки', description: 'Машинки мчатся по трассе' },
  tractor: { label: 'Трактор', description: 'Трактор трясёт прицеп на ухабах' },
};
