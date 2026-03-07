import { create } from 'zustand';
import { BinaryChoice } from '@/types/domain';

type SessionState = {
  deviceId: string;
  predictionSubmitted: boolean;
  prediction?: BinaryChoice;
  setDeviceId: (id: string) => void;
  setPrediction: (prediction: BinaryChoice) => void;
  resetPrediction: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  deviceId: '',
  predictionSubmitted: false,
  setDeviceId: (id) => set({ deviceId: id }),
  setPrediction: (prediction) => set({ predictionSubmitted: true, prediction }),
  resetPrediction: () => set({ predictionSubmitted: false, prediction: undefined })
}));
