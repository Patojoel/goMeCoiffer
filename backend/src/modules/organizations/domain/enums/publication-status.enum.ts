/** Visibilité d'un salon dans la marketplace ; la publication arrive au lot 3. */
export const PublicationStatus = {
  NOT_PUBLISHED: 'NOT_PUBLISHED',
} as const;
export type PublicationStatus = (typeof PublicationStatus)[keyof typeof PublicationStatus];
