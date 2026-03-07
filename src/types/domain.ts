export type BinaryChoice = 'YES' | 'NO';

export type DailyQuestion = {
  id: string;
  text: string;
  date: string;
  userPrediction?: BinaryChoice;
  userVote?: BinaryChoice;
};

export type ResultsSnapshot = {
  worldYesPercent: number;
  countryYesPercent: number;
  userVote: BinaryChoice;
  worldResult: BinaryChoice;
  countryResult: BinaryChoice;
};

export type HeatMapCountry = {
  code: string;
  latitude: number;
  longitude: number;
  yesRatio: number;
};
