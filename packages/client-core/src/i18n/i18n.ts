import { fr, type Dictionary, type MessageKey } from './fr.js';

const dictionaries = { fr } satisfies Record<string, Dictionary>;
export type Locale = keyof typeof dictionaries;

let current: Locale = 'fr';

export const getLocale = (): Locale => current;

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

export type { Dictionary, MessageKey };
