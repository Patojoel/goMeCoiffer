import { fr, type Dictionary, type MessageKey } from './fr';

/** Dictionnaires par langue ; une 2e langue s'ajoute ici avec le même type `Dictionary`. */
const dictionaries = { fr } satisfies Record<string, Dictionary>;
export type Locale = keyof typeof dictionaries;

let current: Locale = 'fr';

export const setLocale = (locale: Locale) => {
  current = locale;
};

/** Traduit une clé ; `{nom}` est remplacé par `params.nom`. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const message: string = dictionaries[current][key];
  return params
    ? message.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
    : message;
}

export type { MessageKey };
