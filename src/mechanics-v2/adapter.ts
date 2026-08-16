import type { MechanicAdapterProps } from '../mechanics/adapter';
import type { useSoundV2 } from '../hooks/useSoundV2';

export type SoundV2Api = ReturnType<typeof useSoundV2>;

export interface MechanicAdapterV2Props extends MechanicAdapterProps {
  sound: SoundV2Api;
}
