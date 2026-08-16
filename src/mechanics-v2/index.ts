import { lazy } from 'react';
import type { MechanicId } from '../domain/types';

/**
 * Mechanics that already got the full V2 treatment (canvas rendering, particles,
 * procedural sound). Anything not listed here falls back to its V1 adapter,
 * still wrapped in the V2 presentation shell, until it's upgraded too.
 */
export const V2_ADAPTERS: Partial<Record<MechanicId, React.LazyExoticComponent<React.FC<any>>>> = {
  wheel: lazy(() => import('./wheel/WheelAdapterV2')),
  slot: lazy(() => import('./slotMachine/SlotMachineAdapterV2')),
  race: lazy(() => import('./race/RaceAdapterV2')),
  claw: lazy(() => import('./claw/ClawAdapterV2')),
  cards: lazy(() => import('./cards/CardsAdapterV2')),
  stickman: lazy(() => import('./stickman/StickmanAdapterV2')),
  elevator: lazy(() => import('./elevator/ElevatorAdapterV2')),
  tornado: lazy(() => import('./tornado/TornadoAdapterV2')),
  dice: lazy(() => import('./dice/DiceRollAdapterV2')),
  gladiator: lazy(() => import('./gladiator/GladiatorAdapterV2')),
  alien: lazy(() => import('./alien/AlienAbductionAdapterV2')),
};
