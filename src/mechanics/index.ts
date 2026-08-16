import { lazy } from 'react';
import type { MechanicId } from '../domain/types';

/** Shared registry of V1 adapters, reused as a fallback by the V2 shell for mechanics not yet upgraded. */
export const V1_ADAPTERS: Record<MechanicId, React.LazyExoticComponent<React.FC<any>>> = {
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
