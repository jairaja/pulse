import { create } from 'zustand';
import { BinaryChoice } from '@/types/domain';

interface VotingState {
  predictionByQuestion: Record<string, BinaryChoice>;
  voteByQuestion: Record<string, BinaryChoice>;
  submitPrediction: (questionId: string, prediction: BinaryChoice) => void;
  submitVote: (questionId: string, vote: BinaryChoice) => void;
}

export const useVotingStore = create<VotingState>((set) => ({
  predictionByQuestion: {},
  voteByQuestion: {},
  submitPrediction: (questionId, prediction) =>
    set((state) => ({
      predictionByQuestion: {
        ...state.predictionByQuestion,
        [questionId]: prediction,
      },
    })),
  submitVote: (questionId, vote) =>
    set((state) => ({
      voteByQuestion: {
        ...state.voteByQuestion,
        [questionId]: vote,
      },
    })),
}));
