export const errorsFr = {
  'errors.unauthenticated.staff': 'Votre session a expiré. Reconnectez-vous avec votre mot de passe.',
  'errors.unauthenticated.client':
    'Votre session a expiré. Recevez un nouveau code pour retrouver vos réservations.',
  'errors.forbidden.title': 'Accès refusé',
  'errors.forbidden.permission':
    "Votre rôle dans ce salon ne donne pas ce droit. Demandez au propriétaire du salon de l'ajouter à votre rôle.",
  'errors.forbidden.systemRole': 'Cet espace est réservé à l’équipe GoMeCoiffer.',
  'errors.forbidden.staffSignInRequired':
    'Cet espace est réservé aux salons. Connectez-vous avec votre mot de passe, ou créez votre compte salon.',
  'errors.notFound': "Cette ressource n'existe pas ou n'est pas accessible depuis ce salon.",
  'errors.conflict': 'Cette opération est en conflit avec l’état actuel. Actualisez puis réessayez.',
  'errors.slotNoLongerAvailable': "Ce créneau vient d'être pris. Choisissez un autre horaire.",
  'errors.tooManyRequests':
    'Trop de demandes en peu de temps. Patientez quelques instants avant de réessayer.',
  'errors.network': 'Le serveur est injoignable. Vérifiez votre connexion internet puis réessayez.',
  'errors.generic': 'Une erreur inattendue est survenue. Réessayez dans quelques instants.',
} as const;
