import ar from './ar.json';
import bn from './bn.json';
import es from './es.json';
import fr from './fr.json';
import hi from './hi.json';
import pt from './pt.json';
import ru from './ru.json';
import ur from './ur.json';
import zh from './zh-Hans.json';
import type { Language } from '../preferencesModel';

/** Static product text only. Question/announcement translations are separate stored content. */
export const catalogs: Partial<Record<Language, Record<string, string>>> = {
  ar, bn, es, fr, hi, pt, ru, ur, 'zh-Hans': zh
};
