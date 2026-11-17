const xaf = new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 });

/** Montant en FCFA entiers (jamais de décimale). */
export const formatXaf = (amount: number): string => xaf.format(amount);

/** Heure `HH:mm` d'un instant ISO dans le fuseau IANA du salon. */
export const formatTimeInZone = (isoInstant: string, timeZone: string): string =>
  new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(
    new Date(isoInstant),
  );
