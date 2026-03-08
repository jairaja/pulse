export type BinaryChoice = 'YES' | 'NO';

export type ThemeMode = 'system' | 'dark' | 'light';

export interface UserProfile {
  id: string;
  anonymousUuid: string;
  deviceId: string;
  countryCode: string;
  languageCode: string;
  themeMode: ThemeMode;
  createdAt: string;
}

export interface Question {
  id: string;
  questionText: string;
  originalLanguageCode: string;
  translatedLanguageCode: string;
  activeOn: string;
  isSponsored: boolean;
  status: 'draft' | 'active' | 'closed' | 'disabled';
}

export interface Vote {
  questionId: string;
  userId: string;
  choice: BinaryChoice;
  countryCode: string;
  createdAt: string;
}

export interface Prediction {
  questionId: string;
  userId: string;
  prediction: BinaryChoice;
  createdAt: string;
}

export interface PulseResult {
  questionId: string;
  worldYesPercent: number;
  worldNoPercent: number;
  countryYesPercent: number;
  countryNoPercent: number;
  totalVotes: number;
}

export interface MyPulseMetrics {
  answeredCount: number;
  worldAgreementPercent: number;
  worldDisagreementPercent: number;
  predictionAccuracyPercent: number;
}
