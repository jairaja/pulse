export type TranslationCandidate = {
  provider: 'google' | 'openai';
  translatedText: string;
  qualityScore: number;
};

export async function rankTranslations(candidates: TranslationCandidate[]) {
  return [...candidates].sort((a, b) => b.qualityScore - a.qualityScore)[0];
}
