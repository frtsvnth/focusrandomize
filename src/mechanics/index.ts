import { lazy } from 'react';
import type { MechanicId } from '../domain/types';

/**
 * Legacy V1 adapters, kept as a fallback for the V2 shell. Partial because mechanics added
 * after the V1->V2 migration (e.g. toyRace) only ever get a V2 adapter.
 */
export const V1_ADAPTERS: Partial<Record<MechanicId, React.LazyExoticComponent<React.FC<any>>>> = {
  wheel: lazy(() => import('./wheel/WheelAdapter')),
  slot: lazy(() => import('./slotMachine/SlotMachineAdapter')),
  race: lazy(() => import('./race/RaceAdapter')),
  claw: lazy(() => import('./claw/ClawAdapter')),
  cards: lazy(() => import('./cards/CardsAdapter')),
  stickman: lazy(() => import('./stickman/StickmanAdapter')),
  elevator: lazy(() => import('./elevator/ElevatorAdapter')),
  tornado: lazy(() => import('./tornado/TornadoAdapter')),
  dice: lazy(() => import('./dice/DiceRollAdapter')),
  gladiator: lazy(() => import('./gladiator/GladiatorAdapter')),
  alien: lazy(() => import('./alien/AlienAbductionAdapter')),
};
