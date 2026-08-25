import { lazy } from 'react';
import type { MechanicId } from '../domain/types';

/**
 * Every mechanic now has a full V2 adapter (canvas rendering, particles,
 * procedural sound). V1 adapters remain only as a legacy fallback for any
 * mechanic id missing from this registry.
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
  toyRace: lazy(() => import('./toyRace/ToyRaceAdapterV2')),
};
