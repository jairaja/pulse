export type BinaryChoice = 'YES' | 'NO';

export type Question = {
  id: string;
  text: string;
  language: string;
  opensAt: string;
  closesAt: string;
};

export type ResultSnapshot = {
  questionId: string;
  worldYesPct: number;
  countryYesPct: number;
  totalVotes: number;
  countryCode: string;
  worldResult: BinaryChoice;
};
