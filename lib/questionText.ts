import { countGraphemes } from 'unicode-segmenter/grapheme';
export const normalizeQuestion = (text: string) => text.trim().normalize('NFC');
export const questionLength = countGraphemes;
