export const fr = {
  'common.retry': 'Réessayer',
  'common.loading': 'Chargement…',
  'common.backHome': "Retour à l'accueil",

  'app.name': 'GoMeCoiffer',

  'marketplace.title': 'Trouvez votre salon',
  'marketplace.intro':
    'Réservez coiffure, barbier, esthétique et soins près de chez vous. Le catalogue des salons arrive bientôt.',
  'marketplace.nav.label': 'Navigation principale',
  'marketplace.nav.salonSpace': 'Espace salon',

  'salon.title': 'Espace salon',
  'salon.intro':
    'Votre planning, vos prestations et votre équipe seront ici. Connectez-vous avec votre compte salon pour y accéder.',

  'admin.title': 'Administration GoMeCoiffer',
  'admin.intro': 'Espace réservé à l’équipe GoMeCoiffer : salons, abonnements et suivi de la plateforme.',

  'health.title': 'État du service',
  'health.ok': 'API disponible',
  'health.okHint': 'Tout fonctionne : vous pouvez réserver et gérer votre salon normalement.',
  'health.databaseDown': 'Base de données indisponible',
  'health.databaseDownHint':
    'Le service répond mais ne peut pas enregistrer pour le moment. Patientez quelques minutes puis réessayez.',
  'health.error': 'Impossible de joindre le service',
  'health.errorHint':
    'Vérifiez votre connexion internet puis réessayez. Si le problème continue, revenez dans quelques minutes.',

  'rbac.forbidden.title': 'Accès refusé',
  'rbac.forbidden.permission':
    "Votre rôle dans ce salon ne donne pas ce droit. Demandez au propriétaire du salon de l'ajouter à votre rôle.",
  'rbac.forbidden.systemRole': 'Cet espace est réservé à l’équipe GoMeCoiffer.',

  'notFound.title': 'Page introuvable',
  'notFound.hint': "Cette adresse n'existe pas ou a changé. Revenez à l'accueil pour retrouver votre chemin.",
} as const;

export type MessageKey = keyof typeof fr;
export type Dictionary = Record<MessageKey, string>;
