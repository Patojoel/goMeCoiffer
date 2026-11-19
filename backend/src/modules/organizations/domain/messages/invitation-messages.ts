const ROLE_LABELS: Readonly<Record<string, string>> = {
  SALON_ADMIN: 'Administrateur de salon',
  HAIRDRESSER: 'Coiffeur / Coiffeuse / Barbier',
  FINANCE_MANAGER: 'Responsable financier',
  PRACTITIONER: 'Praticien / Praticienne de beauté',
};

export const InvitationMessages = {
  /** Texte 100 % fixe, sans code, sans lien secret et sans nom du salon (D-046) ; seuls le rôle et la date changent. */
  invitation(input: { role: string; deadline: Date; timezone: string }): string {
    const day = new Intl.DateTimeFormat('fr-FR', {
      timeZone: input.timezone,
      day: '2-digit',
      month: '2-digit',
    }).format(input.deadline);
    return (
      `GoMeCoiffer : un salon vous invite à rejoindre son équipe comme ${ROLE_LABELS[input.role] ?? input.role}. ` +
      `Pour accepter avant le ${day}, ouvrez gomecoiffer.cm/rejoindre avec ce numéro. ` +
      'Ne communiquez jamais un code reçu par SMS.'
    );
  },
};
