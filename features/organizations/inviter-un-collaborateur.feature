# language: fr
@UC-006
Fonctionnalité: Inviter un collaborateur dans son salon
  Pour constituer son équipe sans partager son propre compte,
  la propriétaire invite un collaborateur par son numéro de téléphone et lui choisit un rôle dans le salon ouvert :
  l'invitation ne donne aucun accès tant que la personne ne l'a pas acceptée (UC-007).

  Contexte:
    Étant donné que nous sommes le 19/11/2026 à 10 h 00, heure de Douala
    Et que l'organisation de Mireille Ndongo compte les salons "Go Beauty Akwa" et "Go Beauty Bastos"
    Et que les appartenances actives sont :
      | personne        | salon                 | rôle         |
      | Mireille Ndongo | Go Beauty Akwa        | Propriétaire |
      | Mireille Ndongo | Go Beauty Bastos      | Propriétaire |
      | Clarisse Fotso  | Élégance Bonamoussadi | Propriétaire |
      | Paul Ebode      | Élégance Bonamoussadi | Coiffeur     |
      | Paul Ebode      | Paul Barber Deïdo     | Propriétaire |
      | Awa Tchoua      | Go Beauty Akwa        | Coiffeur     |
    Et que Mireille est connectée et travaille dans le salon "Go Beauty Akwa"

  @nominal @RG-006-01 @RG-006-06 @RG-006-07 @EX-022 @EX-006
  Scénario: Une propriétaire invite un barbier dans son salon
    Quand Mireille invite "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Alors une invitation en attente pour "Brice Nana" apparaît dans les invitations de "Go Beauty Akwa"
    Et elle est valable jusqu'au 26/11/2026 à 10 h 00
    Et Brice Nana n'a encore aucun accès au salon "Go Beauty Akwa"

  @nominal @RG-006-02 @EX-022 @EX-037
  Plan du scénario: La propriétaire peut inviter à chacun des quatre rôles de collaborateur
    Quand Mireille invite "Esther Ngo Bilong", au 6 77 88 99 00, comme "<rôle>"
    Alors une invitation en attente pour "Esther Ngo Bilong" apparaît avec le rôle "<rôle>"

    Exemples:
      | rôle                              |
      | Administrateur de salon           |
      | Coiffeur / Coiffeuse / Barbier    |
      | Responsable financier             |
      | Praticien / Praticienne de beauté |

  @nominal @RG-006-11
  Scénario: La personne invitée est prévenue par un SMS sans code
    Quand Mireille invite "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Alors le 6 55 44 33 22 reçoit, après la réponse, le SMS "GoMeCoiffer : un salon vous invite à rejoindre son équipe comme Coiffeur / Coiffeuse / Barbier. Pour accepter avant le 26/11, ouvrez gomecoiffer.cm/rejoindre avec ce numéro. Ne communiquez jamais un code reçu par SMS."
    Et ce SMS ne contient aucun code

  @alternatif @RG-006-09 @EX-004
  Scénario: Une personne qui travaille déjà dans d'autres salons peut être invitée avec un autre rôle
    Quand Mireille invite "Paul Ebode", au 6 99 00 11 22, comme "Administrateur de salon"
    Alors une invitation en attente pour "Paul Ebode" apparaît dans les invitations de "Go Beauty Akwa"
    Et Paul est toujours "Propriétaire" de "Paul Barber Deïdo" et "Coiffeur" chez "Élégance Bonamoussadi"

  @securite @RG-006-10 @D-019
  Plan du scénario: La réponse ne révèle pas si le numéro a déjà un compte GoMeCoiffer
    Étant donné que le <numéro> <état du numéro>
    Quand Mireille invite "<nom>", au <numéro>, comme "Coiffeur / Coiffeuse / Barbier"
    Alors l'invitation est enregistrée avec la même réponse que pour un numéro sans compte
    Et le <numéro> reçoit le même SMS d'invitation que pour un numéro sans compte

    Exemples:
      | nom         | numéro        | état du numéro                |
      | Brice Nana  | 6 55 44 33 22 | n'a aucun compte GoMeCoiffer  |
      | Aïcha Bello | 6 91 23 45 67 | porte un compte client léger  |
      | Paul Ebode  | 6 99 00 11 22 | porte un compte du personnel  |

  @alternatif @RG-006-03 @EX-015
  Scénario: Une esthéticienne est invitée comme praticienne de beauté
    Quand Mireille invite "Grâce Mbarga", au 6 70 11 22 33, comme "Praticien / Praticienne de beauté"
    Alors une invitation en attente pour "Grâce Mbarga" apparaît avec le rôle "Praticien / Praticienne de beauté"
    Et aucune spécialité n'est attachée à l'invitation

  @erreur @securite @RG-006-02 @RG-006-03 @EX-015 @EX-014 @EX-012 @EX-017
  Plan du scénario: Seuls les quatre rôles de collaborateur peuvent être donnés par invitation
    Quand Mireille invite "Grâce Mbarga", au 6 70 11 22 33, comme "<rôle demandé>"
    Alors l'invitation est refusée avec le motif "Certaines informations sont invalides : corrigez les champs signalés."
    Et aucune invitation n'est enregistrée

    Exemples:
      | rôle demandé              | raison                                 |
      | Propriétaire              | rôle lié à la propriété                |
      | Esthéticienne             | métier, pas un rôle                    |
      | Manucure                  | métier, pas un rôle                    |
      | Administrateur Opérations | rôle système attribué par GoMeCoiffer  |

  @erreur @RG-006-05
  Plan du scénario: Le nom de la personne invitée compte 2 à 80 caractères
    Quand Mireille invite une personne nommée <nom saisi>, au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Alors l'invitation est <résultat>

    Exemples:
      | nom saisi                 | résultat                                                                                     |
      | "B"                       | refusée avec le motif "Certaines informations sont invalides : corrigez les champs signalés." |
      | "Bo"                      | enregistrée                                                                                  |
      | un nom de 80 caractères   | enregistrée                                                                                  |
      | un nom de 81 caractères   | refusée avec le motif "Certaines informations sont invalides : corrigez les champs signalés." |
      | "   Brice    Nana  "      | enregistrée au nom de "Brice Nana"                                                           |

  @erreur @RG-006-05
  Plan du scénario: Le numéro de la personne invitée est un numéro camerounais
    Quand Mireille invite "Brice Nana", au <numéro saisi>, comme "Coiffeur / Coiffeuse / Barbier"
    Alors l'invitation est <résultat>

    Exemples:
      | numéro saisi      | résultat                                                                                                       |
      | 6 55 44 33 22     | enregistrée                                                                                                    |
      | +237 655 44 33 22 | enregistrée                                                                                                    |
      | 6 55 44 33 2      | refusée avec le motif "Numéro de téléphone camerounais invalide (9 chiffres, ex. 6 77 12 34 56)."               |
      | +33 6 12 34 56 78 | refusée avec le motif "Numéro de téléphone camerounais invalide (9 chiffres, ex. 6 77 12 34 56)."               |

  @securite @RG-006-01 @EX-024
  Plan du scénario: La demande ne porte que le nom, le numéro et le rôle
    Quand Mireille invite "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier" en indiquant aussi <information>
    Alors l'invitation est refusée avec le motif "Certaines informations sont invalides : corrigez les champs signalés."
    Et aucune invitation n'est enregistrée

    Exemples:
      | information                               |
      | le salon "Élégance Bonamoussadi"          |
      | une validité de 30 jours                  |
      | la permission « gérer les réservations »  |
      | la spécialité « Barbier »                 |

  @securite @RG-006-06 @EX-006
  Scénario: Une invitation en attente ne donne aucun accès au salon
    Étant donné que Mireille a invité Paul, au 6 99 00 11 22, comme "Administrateur de salon"
    Quand Paul consulte la liste de ses salons
    Alors il n'y voit pas "Go Beauty Akwa"
    Et l'ouverture du salon "Go Beauty Akwa" par Paul est refusée comme pour un salon qui n'existe pas

  @securite @RG-006-01 @EX-007 @EX-024
  Scénario: Un coiffeur ne peut pas inviter de collaborateur
    Étant donné qu'Awa est connectée et travaille dans le salon "Go Beauty Akwa"
    Quand Awa invite "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Alors l'invitation est refusée avec le motif "Votre rôle dans ce salon ne permet pas cette action : demandez-la au propriétaire."
    Et aucune invitation n'est enregistrée

  @erreur @RG-006-01
  Scénario: Sans salon ouvert, personne n'est invité
    Étant donné que Paul est connecté, sans salon ouvert
    Quand Paul invite "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Alors l'invitation est refusée avec le motif "Choisissez d’abord le salon sur lequel vous travaillez."

  @erreur @RG-006-01
  Scénario: Sans session, personne n'est invité
    Étant donné que la session de Mireille a expiré
    Quand Mireille invite "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Alors l'invitation est refusée avec le motif "Session absente ou expirée : reconnectez-vous."

  @erreur @RG-006-01 @EX-024
  Scénario: Une invitation sans jeton de sécurité est refusée
    Quand Mireille invite "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier" sans jeton de sécurité
    Alors l'invitation est refusée avec le motif "Jeton de sécurité absent ou expiré : rechargez la page puis recommencez."
    Et aucune invitation n'est enregistrée

  @securite @RG-006-01 @EX-024 @BR-12
  Scénario: L'invitation vise toujours le salon ouvert
    Étant donné que Mireille passe au salon "Go Beauty Bastos"
    Quand Mireille invite "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Alors l'invitation apparaît dans les invitations de "Go Beauty Bastos"
    Et les invitations de "Go Beauty Akwa" n'ont pas changé

  @erreur @RG-006-09
  Plan du scénario: Une personne déjà dans l'équipe du salon n'est pas invitée une deuxième fois
    Quand Mireille invite "<nom>", au <numéro>, comme "Coiffeur / Coiffeuse / Barbier"
    Alors l'invitation est refusée avec le motif "Cette personne fait déjà partie de l'équipe de ce salon."
    Et aucun SMS n'est envoyé

    Exemples:
      | nom             | numéro        |
      | Awa Tchoua      | 6 66 10 20 30 |
      | Mireille Ndongo | 6 77 12 34 56 |

  @erreur @RG-006-08
  Scénario: Une seule invitation en attente par numéro dans un salon
    Étant donné que Mireille a invité "Brice Nana", au 6 55 44 33 22, le 19/11/2026 à 9 h 00
    Quand Mireille invite "Brice Nana", au 6 55 44 33 22, comme "Responsable financier"
    Alors l'invitation est refusée avec le motif "Une invitation est déjà en attente pour ce numéro. Annulez-la pour en envoyer une nouvelle."
    Et l'invitation de 9 h 00 est toujours en attente, avec son rôle d'origine

  @alternatif @RG-006-08 @RG-006-07
  Scénario: Après l'expiration d'une invitation, on peut inviter de nouveau
    Étant donné que Mireille a invité "Brice Nana", au 6 55 44 33 22, le 10/11/2026 à 10 h 00
    Quand Mireille invite "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Alors une invitation en attente pour "Brice Nana" apparaît, valable jusqu'au 26/11/2026 à 10 h 00
    Et l'invitation du 10/11/2026 est indiquée comme expirée

  @alternatif @RG-006-08
  Scénario: Le même numéro peut être invité dans deux salons différents
    Étant donné que Clarisse a invité "Brice Nana", au 6 55 44 33 22, dans "Élégance Bonamoussadi"
    Quand Mireille invite "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Alors une invitation en attente pour "Brice Nana" apparaît dans les invitations de "Go Beauty Akwa"
    Et Mireille ne voit pas l'invitation de Clarisse

  @securite @RG-006-08
  Scénario: Deux envois simultanés de la même invitation n'en créent qu'une
    Quand Mireille envoie deux fois en même temps l'invitation de "Brice Nana", au 6 55 44 33 22
    Alors une seule invitation en attente pour le 6 55 44 33 22 existe dans "Go Beauty Akwa"
    Et un seul SMS d'invitation est envoyé

  @alternatif @RG-006-07
  Plan du scénario: Une invitation est en attente pendant 7 jours exactement
    Étant donné que Mireille a invité "Brice Nana" le 19/11/2026 à 10 h 00
    Quand Mireille consulte ses invitations le <instant>
    Alors l'invitation de Brice Nana est indiquée comme <état>

    Exemples:
      | instant                    | état       |
      | 26/11/2026 à 9 h 59 min 59 s | en attente |
      | 26/11/2026 à 10 h 00       | expirée    |

  @securite @RG-006-12
  Plan du scénario: Un salon envoie au plus 20 invitations par 24 heures
    Étant donné que "Go Beauty Akwa" a envoyé <envoyées> invitations depuis le 18/11/2026 à 10 h 00
    Quand Mireille invite "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Alors l'invitation est <résultat>

    Exemples:
      | envoyées | résultat                                                                                                                         |
      | 19       | enregistrée                                                                                                                      |
      | 20       | refusée avec le motif "Vous avez envoyé beaucoup d'invitations aujourd'hui. Réessayez demain ou contactez l'assistance GoMeCoiffer." |

  @securite @RG-006-12
  Scénario: Un salon garde au plus 50 invitations en attente
    Étant donné que "Go Beauty Akwa" a 50 invitations en attente
    Quand Mireille invite "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Alors l'invitation est refusée avec le motif "Vous avez déjà 50 invitations en attente. Annulez celles qui ne servent plus avant d'en envoyer d'autres."

  @securite @RG-006-12 @RG-006-10
  Scénario: Au-delà de 3 SMS d'invitation par 24 heures, un numéro n'en reçoit plus mais l'invitation est enregistrée
    Étant donné que le 6 55 44 33 22 a reçu 3 SMS d'invitation d'autres salons depuis le 18/11/2026 à 10 h 00
    Quand Mireille invite "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Alors une invitation en attente pour "Brice Nana" apparaît dans les invitations de "Go Beauty Akwa"
    Et la réponse est la même que lorsqu'un SMS est envoyé
    Et le 6 55 44 33 22 ne reçoit aucun SMS

  @erreur @RG-006-11
  Scénario: Une panne du fournisseur de SMS ne fait pas perdre l'invitation
    Étant donné que le fournisseur de SMS est indisponible
    Quand Mireille invite "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Alors une invitation en attente pour "Brice Nana" apparaît dans les invitations de "Go Beauty Akwa"
    Et on lui propose de prévenir Brice Nana par WhatsApp

  @erreur @RG-006-16
  Scénario: Une panne pendant l'enregistrement ne laisse rien
    Étant donné que le service GoMeCoiffer tombe en panne pendant l'enregistrement de l'invitation
    Quand Mireille invite "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Alors l'invitation est refusée avec le motif "Invitation impossible pour le moment. Réessayez dans quelques minutes."
    Et aucune invitation n'est enregistrée
    Et aucun SMS n'est envoyé

  @nominal @RG-006-14
  Scénario: La propriétaire consulte les invitations de son salon
    Étant donné que les invitations de "Go Beauty Akwa" sont :
      | personne      | numéro        | rôle                              | envoyée le          | état       |
      | Brice Nana    | 6 55 44 33 22 | Coiffeur / Coiffeuse / Barbier    | 19/11/2026 à 9 h 00 | en attente |
      | Grâce Mbarga  | 6 70 11 22 33 | Praticien / Praticienne de beauté | 10/11/2026 à 8 h 00 | en attente |
      | Ruth Abena    | 6 50 60 70 80 | Responsable financier             | 15/11/2026 à 8 h 00 | annulée    |
    Quand Mireille consulte les invitations de "Go Beauty Akwa"
    Alors elle voit, dans cet ordre :
      | personne     | numéro        | rôle                              | état       | valable jusqu'au     |
      | Brice Nana   | 6 55 44 33 22 | Coiffeur / Coiffeuse / Barbier    | en attente | 26/11/2026 à 9 h 00  |
      | Grâce Mbarga | 6 70 11 22 33 | Praticien / Praticienne de beauté | expirée    | 17/11/2026 à 8 h 00  |
    Et elle ne voit pas l'invitation annulée de Ruth Abena

  @securite @RG-006-14 @EX-024
  Scénario: Les invitations d'un salon ne se voient que depuis ce salon
    Étant donné que "Go Beauty Akwa" a une invitation en attente pour "Brice Nana"
    Et que Mireille passe au salon "Go Beauty Bastos"
    Quand Mireille consulte les invitations du salon ouvert
    Alors elle n'y voit pas "Brice Nana"

  @nominal @RG-006-13
  Scénario: La propriétaire annule une invitation en attente
    Étant donné que Mireille a invité "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Quand Mireille annule l'invitation de "Brice Nana"
    Alors l'invitation de "Brice Nana" n'apparaît plus dans les invitations de "Go Beauty Akwa"
    Et Brice Nana ne pourra plus l'accepter

  @erreur @RG-006-13
  Plan du scénario: Seule une invitation en attente peut être annulée
    Étant donné que l'invitation de "Brice Nana" est <état>
    Quand Mireille annule l'invitation de "Brice Nana"
    Alors l'annulation est refusée avec le motif "Cette invitation n'est plus en attente : elle a été acceptée, annulée ou elle a expiré."

    Exemples:
      | état     |
      | expirée  |
      | annulée  |
      | acceptée |

  @securite @RG-006-13 @EX-024
  Plan du scénario: Une invitation d'un autre salon ne peut pas être annulée, et le refus ne dit pas pourquoi
    Étant donné que <situation>
    Quand Mireille annule <invitation visée>
    Alors l'annulation est refusée comme pour une invitation qui n'existe pas
    Et <conséquence>

    Exemples:
      | situation                                                           | invitation visée                       | conséquence                                          |
      | aucune invitation n'a l'identifiant demandé                         | une invitation dont l'identifiant n'existe pas | rien n'a changé                               |
      | Clarisse a invité "Brice Nana" dans "Élégance Bonamoussadi"         | l'invitation de Clarisse               | l'invitation de Clarisse est toujours en attente     |
      | "Go Beauty Bastos" a invité "Ruth Abena" et Mireille est dans Akwa  | l'invitation de "Go Beauty Bastos"     | l'invitation de "Go Beauty Bastos" est toujours en attente |

  @securite @RG-006-04 @EX-017 @apres-UC-008
  Plan du scénario: Un administrateur de salon n'invite qu'à un rôle qui n'a pas plus de droits que le sien
    Étant donné que Rodrigue Etoa est "Administrateur de salon" de "Go Beauty Akwa", avec les permissions par défaut de ce rôle
    Et que Rodrigue travaille dans le salon "Go Beauty Akwa"
    Quand Rodrigue invite "Esther Ngo Bilong", au 6 77 88 99 00, comme "<rôle>"
    Alors l'invitation est <résultat>

    Exemples:
      | rôle                           | résultat                                                                                                                          |
      | Coiffeur / Coiffeuse / Barbier | enregistrée                                                                                                                       |
      | Responsable financier          | refusée avec le motif "Ce rôle donne des droits que vous n'avez pas dans ce salon : demandez au propriétaire d'envoyer l'invitation." |

  @alternatif @RG-006-15 @EX-023 @EX-025
  Scénario: L'invitation et son annulation sont tracées sans donnée personnelle
    Étant donné que Mireille a invité "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier"
    Quand Mireille annule l'invitation de "Brice Nana"
    Alors le journal d'audit contient "collaborateur invité" puis "invitation annulée" pour "Go Beauty Akwa", avec le rôle et l'auteur
    Et aucune de ces lignes ne contient le nom "Brice Nana" ni le numéro 6 55 44 33 22

  @alternatif @RG-006-17 @EX-025
  Scénario: Le nom et le numéro d'une invitation non acceptée sont effacés 30 jours après sa fin
    Étant donné qu'une invitation de "Brice Nana", au 6 55 44 33 22, a expiré le 20/10/2026 à 10 h 00
    Quand le nettoyage des invitations passe le 19/11/2026 à 10 h 00
    Alors le nom et le numéro de cette invitation sont effacés
    Et l'invitation reste comptée comme expirée, avec son rôle et ses dates
