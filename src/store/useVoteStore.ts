import { create } from 'zustand';
import { BinaryChoice } from '@/types/domain';

type VoteState = {
  prediction?: BinaryChoice;
  vote?: BinaryChoice;
  setPrediction: (choice: BinaryChoice) => void;
  setVote: (choice: BinaryChoice) => void;
  reset: () => void;
};

export const useVoteStore = create<VoteState>((set) => ({
  setPrediction: (prediction) => set({ prediction }),
  setVote: (vote) => set({ vote }),
  reset: () => set({ prediction: undefined, vote: undefined }),
}));
