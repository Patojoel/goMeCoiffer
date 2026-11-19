/** Un navigateur porte au plus un jeton par compte, et jamais plus de 5 jetons. */
export const MAX_DEVICE_TOKENS = 5;
const PADDING_TOKEN = 'no-device';

/**
 * Jetons à rechercher : toujours 5, les manquants remplacés par un jeton sans valeur. La recherche coûte pareil
 * avec ou sans cookie, donc sa durée ne révèle pas qu'un compte existe.
 */
export function deviceLookupTokens(cookieTokens: readonly string[]): string[] {
  return Array.from({ length: MAX_DEVICE_TOKENS }, (_, i) => cookieTokens[i] ?? PADDING_TOKEN);
}

/**
 * Nouveau contenu du cookie après une réussite : le jeton qui désignait l'appareil est remplacé sur place par le
 * jeton neuf ; sinon le jeton neuf s'ajoute à la fin et le plus ancien sort au-delà de 5.
 */
export function rotateDeviceTokens(
  cookieTokens: readonly string[],
  matchedToken: string | null,
  fresh: string,
): string[] {
  const tokens = cookieTokens.slice(0, MAX_DEVICE_TOKENS);
  const replaced = matchedToken === null ? -1 : tokens.indexOf(matchedToken);
  if (replaced >= 0) return tokens.map((token, i) => (i === replaced ? fresh : token));
  return [...tokens, fresh].slice(-MAX_DEVICE_TOKENS);
}
