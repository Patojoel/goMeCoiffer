# language: fr
@UC-008
Fonctionnalité: Ajuster les permissions des rôles de son salon
  Pour confier à chacun ce dont il a besoin, et rien de plus,
  la propriétaire part des permissions par défaut de chaque rôle et les ajuste pour le salon ouvert :
  le changement vaut tout de suite pour toutes les personnes de ce rôle dans ce salon, et nulle part ailleurs.

  Contexte:
    Étant donné que nous sommes le 20/11/2026 à 10 h 00, heure de Douala
    Et que l'organisation de Mireille Ndongo compte les salons "Go Beauty Akwa" et "Go Beauty Bastos"
    Et que les appartenances actives sont :
      | personne        | salon            | rôle                              |
      | Mireille Ndongo | Go Beauty Akwa   | Propriétaire                      |
      | Mireille Ndongo | Go Beauty Bastos | Propriétaire                      |
      | Rodrigue Etoa   | Go Beauty Akwa   | Administrateur de salon           |
      | Rodrigue Etoa   | Go Beauty Bastos | Administrateur de salon           |
      | Awa Tchoua      | Go Beauty Akwa   | Coiffeur / Coiffeuse / Barbier    |
      | Hortense Mballa | Go Beauty Akwa   | Responsable financier             |
      | Grâce Mbarga    | Go Beauty Akwa   | Praticien / Praticienne de beauté |
    Et que les rôles de "Go Beauty Akwa" et de "Go Beauty Bastos" ont leurs permissions par défaut
    Et que Mireille est connectée et travaille dans le salon "Go Beauty Akwa"

  @nominal @RG-008-05 @EX-016 @EX-039
  Scénario: Un nouveau salon reçoit les permissions par défaut de chaque rôle
    Étant donné que Clarisse Fotso vient de créer son organisation avec le salon "Élégance Bonamoussadi"
    Quand Clarisse consulte les rôles et permissions de "Élégance Bonamoussadi"
    Alors les permissions des rôles de collaborateur sont :
      | permission                                | Administrateur de salon | Coiffeur / Coiffeuse / Barbier | Responsable financier | Praticien / Praticienne de beauté |
      | Tableau de bord : consulter               | oui                     | non                            | oui                   | non                               |
      | Réservations : voir les siennes           | oui                     | oui                            | non                   | oui                               |
      | Réservations : voir toutes                | oui                     | non                            | oui                   | non                               |
      | Réservations : gérer                      | oui                     | non                            | non                   | non                               |
      | Disponibilités : modifier les siennes     | oui                     | oui                            | non                   | oui                               |
      | Disponibilités : gérer celles de l'équipe | oui                     | non                            | non                   | non                               |
      | Prestations : consulter                   | oui                     | non                            | non                   | non                               |
      | Prestations : gérer                       | oui                     | non                            | non                   | non                               |
      | Personnel : consulter                     | oui                     | non                            | non                   | non                               |
      | Personnel : inviter                       | oui                     | non                            | non                   | non                               |
      | Personnel : gérer                         | oui                     | non                            | non                   | non                               |
      | Finances : consulter                      | non                     | non                            | oui                   | non                               |
      | Finances : déclarer un encaissement       | non                     | non                            | oui                   | non                               |
      | Finances : exporter                       | non                     | non                            | oui                   | non                               |
      | Paramètres salon : consulter              | oui                     | non                            | non                   | non                               |
      | Paramètres salon : modifier               | non                     | non                            | non                   | non                               |
    Et chacun de ces rôles est indiqué « par défaut »

  @nominal @RG-008-05
  Scénario: Un salon créé avant les permissions ajustables reçoit les permissions par défaut
    Étant donné que le salon "Paul Barber Deïdo" a été créé avant la mise en service des permissions ajustables
    Quand les permissions ajustables sont mises en service
    Alors les quatre rôles de collaborateur de "Paul Barber Deïdo" ont leurs permissions par défaut

  @nominal @RG-008-03 @RG-008-04 @EX-014
  Scénario: Le rôle Propriétaire garde tous les droits et ne se règle pas
    Quand Mireille consulte les rôles et permissions de "Go Beauty Akwa"
    Alors le rôle "Propriétaire" apparaît avec les 17 permissions du salon et les droits réservés au propriétaire
    Et il est indiqué « Tous les droits, non modifiables »
    Et seuls les quatre rôles de collaborateur peuvent être modifiés

  @nominal @RG-008-17
  Scénario: La propriétaire voit les rôles de son salon, ce qui a changé et combien de personnes chacun concerne
    Étant donné que Mireille a ajouté "Finances : consulter" aux permissions de "Administrateur de salon"
    Quand Mireille consulte les rôles et permissions de "Go Beauty Akwa"
    Alors elle voit, dans cet ordre :
      | rôle                              | réglage        | personnes |
      | Propriétaire                      | non modifiable | 1         |
      | Administrateur de salon           | modifié        | 1         |
      | Coiffeur / Coiffeuse / Barbier    | par défaut     | 1         |
      | Responsable financier             | par défaut     | 1         |
      | Praticien / Praticienne de beauté | par défaut     | 1         |
    Et aucun nom de membre n'y apparaît

  @nominal @RG-008-09 @RG-008-10 @EX-016
  Scénario: La propriétaire donne l'accès aux finances à l'administrateur de son salon
    Étant donné que Rodrigue est connecté et travaille dans le salon "Go Beauty Akwa"
    Quand Mireille ajoute aux permissions de "Administrateur de salon" : "Finances : consulter", "Finances : déclarer un encaissement" et "Finances : exporter"
    Alors le rôle "Administrateur de salon" de "Go Beauty Akwa" a ces trois permissions en plus de ses permissions par défaut
    Et dès sa requête suivante, sans se reconnecter, Rodrigue a "Finances : consulter" dans "Go Beauty Akwa"

  @nominal @RG-008-11 @BR-11
  Scénario: Chaque membre connaît ses propres permissions dans le salon ouvert, et seulement les siennes
    Étant donné qu'Awa est connectée et travaille dans le salon "Go Beauty Akwa"
    Quand Awa consulte le résumé de sa session
    Alors elle y voit ses permissions dans "Go Beauty Akwa" : "Réservations : voir les siennes" et "Disponibilités : modifier les siennes"
    Et elle n'y voit les permissions d'aucun autre rôle ni d'aucun autre salon

  @alternatif @RG-008-10 @RG-008-12
  Scénario: Une permission retirée est refusée dès la requête suivante, sans déconnecter personne
    Étant donné que Rodrigue est connecté et travaille dans le salon "Go Beauty Akwa"
    Et que Mireille a retiré "Personnel : inviter" des permissions de "Administrateur de salon"
    Quand Rodrigue invite "Esther Ngo Bilong", au 6 77 88 99 00, comme "Coiffeur / Coiffeuse / Barbier"
    Alors l'invitation est refusée avec le motif "Votre rôle dans ce salon ne permet pas cette action : demandez-la au propriétaire."
    Et Rodrigue est toujours connecté et travaille toujours dans le salon "Go Beauty Akwa"

  @alternatif @RG-008-06 @RG-008-07 @EX-007
  Scénario: Les permissions se règlent rôle par rôle et salon par salon
    Quand Mireille ajoute "Finances : consulter" aux permissions de "Administrateur de salon"
    Alors Rodrigue a "Finances : consulter" dans "Go Beauty Akwa"
    Mais Rodrigue n'a pas "Finances : consulter" dans "Go Beauty Bastos"
    Et les permissions des autres rôles de "Go Beauty Akwa" n'ont pas changé

  @alternatif @securite @RG-008-12 @EX-017
  Plan du scénario: Un administrateur n'invite qu'à un rôle dont il a toutes les permissions dans ce salon
    Étant donné que, dans "Go Beauty Akwa", <réglage>
    Et que Rodrigue est connecté et travaille dans le salon "Go Beauty Akwa"
    Quand Rodrigue invite "Esther Ngo Bilong", au 6 77 88 99 00, comme "<rôle>"
    Alors l'invitation est <résultat>

    Exemples:
      | réglage                                                                                  | rôle                           | résultat                                                                                                                            |
      | les rôles ont leurs permissions par défaut                                               | Coiffeur / Coiffeuse / Barbier | enregistrée                                                                                                                         |
      | les rôles ont leurs permissions par défaut                                               | Responsable financier          | refusée avec le motif "Ce rôle donne des droits que vous n'avez pas dans ce salon : demandez au propriétaire d'envoyer l'invitation." |
      | l'Administrateur de salon a reçu en plus les trois permissions des finances              | Responsable financier          | enregistrée                                                                                                                         |
      | le Coiffeur / Coiffeuse / Barbier a reçu en plus "Finances : consulter"                  | Coiffeur / Coiffeuse / Barbier | refusée avec le motif "Ce rôle donne des droits que vous n'avez pas dans ce salon : demandez au propriétaire d'envoyer l'invitation." |

  @alternatif @RG-008-16
  Scénario: La propriétaire rétablit les permissions par défaut d'un rôle
    Étant donné que Mireille a ajouté les trois permissions des finances aux permissions de "Administrateur de salon"
    Quand Mireille rétablit les permissions par défaut de "Administrateur de salon"
    Alors le rôle "Administrateur de salon" de "Go Beauty Akwa" a de nouveau exactement ses permissions par défaut
    Et il est indiqué « par défaut »

  @alternatif @RG-008-13
  Scénario: Enregistrer sans rien changer ne modifie rien et ne laisse aucune trace
    Quand Mireille enregistre les permissions de "Coiffeur / Coiffeuse / Barbier" sans rien changer
    Alors l'enregistrement est accepté
    Et le journal d'audit n'a aucune nouvelle ligne
    Et aucun signal « permissions modifiées » n'est envoyé

  @alternatif @RG-008-09
  Scénario: Un rôle peut être laissé sans aucune permission, sans retirer personne de l'équipe
    Quand Mireille retire toutes les permissions de "Praticien / Praticienne de beauté"
    Alors le rôle "Praticien / Praticienne de beauté" de "Go Beauty Akwa" n'a plus aucune permission
    Et Grâce peut toujours ouvrir le salon "Go Beauty Akwa"

  @alternatif @RG-008-14
  Scénario: Deux rôles différents se règlent en même temps sans se gêner
    Quand Mireille enregistre en même temps un réglage de "Administrateur de salon" et un réglage de "Responsable financier"
    Alors les deux réglages sont enregistrés

  @alternatif @RG-008-15 @EX-023 @EX-025
  Scénario: Chaque modification est tracée, sans donnée personnelle
    Quand Mireille enregistre pour "Administrateur de salon" ses permissions par défaut avec "Finances : consulter" et sans "Personnel : inviter"
    Alors le journal d'audit contient « permissions d'un rôle modifiées » pour "Go Beauty Akwa", rôle "Administrateur de salon", par Mireille, le 20/11/2026 à 10 h 00
    Et cette ligne indique la permission ajoutée "Finances : consulter" et la permission retirée "Personnel : inviter"
    Et elle ne contient ni nom ni numéro de téléphone

  @alternatif @RG-008-10 @EX-036
  Scénario: Les écrans ouverts du salon sont prévenus en direct
    Étant donné que Rodrigue suit "Go Beauty Akwa" en direct
    Quand Mireille ajoute "Finances : consulter" aux permissions de "Administrateur de salon"
    Alors Rodrigue reçoit en moins de 5 secondes le signal « permissions modifiées » pour le rôle "Administrateur de salon"
    Et ce signal ne contient ni la liste des permissions ni aucune donnée personnelle

  @erreur @RG-008-10
  Scénario: Une panne du suivi en direct ne fait pas perdre la modification
    Étant donné que le suivi en direct est indisponible
    Quand Mireille ajoute "Finances : consulter" aux permissions de "Administrateur de salon"
    Alors la modification est enregistrée
    Et dès sa requête suivante, Rodrigue a "Finances : consulter" dans "Go Beauty Akwa"

  @erreur @securite @RG-008-03 @EX-014 @EX-011 @EX-015
  Plan du scénario: Seuls les quatre rôles de collaborateur se règlent
    Quand Mireille modifie les permissions du rôle "<rôle visé>"
    Alors la modification est refusée avec le motif "Certaines informations sont invalides : corrigez les champs signalés."
    Et aucune permission n'a changé dans "Go Beauty Akwa"

    Exemples:
      | rôle visé            | raison                                |
      | Propriétaire         | tous les droits, non modifiables      |
      | Super Administrateur | rôle système attribué par GoMeCoiffer |
      | Esthéticienne        | métier, pas un rôle                   |

  @erreur @securite @RG-008-04 @EX-014 @EX-017
  Plan du scénario: Les droits réservés au propriétaire ne se donnent à aucun autre rôle
    Quand Mireille ajoute "<droit réservé>" aux permissions de "Administrateur de salon"
    Alors la modification est refusée avec le motif "Certaines informations sont invalides : corrigez les champs signalés."
    Et les permissions de "Administrateur de salon" n'ont pas changé

    Exemples:
      | droit réservé                                          |
      | Rôles et permissions : administrer                     |
      | Gérer les salons de l'organisation                     |
      | Gérer l'abonnement                                     |
      | Gérer les comptes de règlement (destination des fonds) |

  @erreur @securite @RG-008-02
  Plan du scénario: La demande ne porte que des permissions du catalogue, chacune une fois, et la version lue
    Quand Mireille enregistre les permissions de "Coiffeur / Coiffeuse / Barbier" avec <anomalie>
    Alors la modification est refusée avec le motif "Certaines informations sont invalides : corrigez les champs signalés."
    Et les permissions de "Coiffeur / Coiffeuse / Barbier" n'ont pas changé

    Exemples:
      | anomalie                                             |
      | une permission inconnue « Réservations : supprimer » |
      | deux fois « Réservations : voir les siennes »        |
      | en plus le salon "Go Beauty Bastos"                  |
      | en plus la personne "Awa Tchoua"                     |
      | sans la version qu'elle a consultée                  |

  @erreur @RG-008-08
  Plan du scénario: Une action demande la consultation du même module
    Quand Mireille enregistre pour "Responsable financier" une liste qui contient "<action>" mais pas "<consultation>"
    Alors la modification est refusée avec le motif "Pour donner « <action> », donnez aussi « <consultation> »."
    Et les permissions de "Responsable financier" n'ont pas changé

    Exemples:
      | action                              | consultation                 |
      | Finances : exporter                 | Finances : consulter         |
      | Finances : déclarer un encaissement | Finances : consulter         |
      | Réservations : gérer                | Réservations : voir toutes   |
      | Prestations : gérer                 | Prestations : consulter      |
      | Personnel : inviter                 | Personnel : consulter        |
      | Personnel : gérer                   | Personnel : consulter        |
      | Paramètres salon : modifier         | Paramètres salon : consulter |

  @erreur @RG-008-01
  Plan du scénario: Sans session, sans jeton ou sans salon ouvert, rien ne change
    Étant donné que <situation>
    Quand Mireille ajoute "Finances : consulter" aux permissions de "Administrateur de salon"
    Alors la modification est refusée avec le motif "<motif>"
    Et les permissions de "Administrateur de salon" n'ont pas changé

    Exemples:
      | situation                                           | motif                                                                    |
      | la session de Mireille a expiré                     | Session absente ou expirée : reconnectez-vous.                           |
      | la demande de Mireille n'a pas de jeton de sécurité | Jeton de sécurité absent ou expiré : rechargez la page puis recommencez. |
      | Mireille vient de se connecter, sans salon ouvert   | Choisissez d’abord le salon sur lequel vous travaillez.                  |

  @erreur @RG-008-14
  Scénario: Un enregistrement fait à partir d'un écran périmé est refusé
    Étant donné que Mireille a ouvert les permissions de "Administrateur de salon" sur sa tablette
    Et qu'elle a ensuite ajouté "Finances : consulter" à ce rôle depuis son téléphone
    Quand Mireille enregistre depuis sa tablette les permissions de "Administrateur de salon" sans "Personnel : inviter"
    Alors la modification est refusée avec le motif "Les permissions de ce rôle viennent d'être modifiées sur un autre écran. Rechargez pour voir la version à jour, puis recommencez."
    Et le rôle "Administrateur de salon" a toujours "Finances : consulter" et "Personnel : inviter"

  @erreur @RG-008-15
  Scénario: Une panne pendant l'enregistrement ne change rien
    Étant donné que le service GoMeCoiffer tombe en panne pendant l'enregistrement
    Quand Mireille ajoute "Finances : consulter" aux permissions de "Administrateur de salon"
    Alors la modification est refusée avec le motif "Enregistrement impossible pour le moment. Réessayez dans quelques minutes."
    Et les permissions de "Administrateur de salon" n'ont pas changé
    Et le journal d'audit n'a aucune nouvelle ligne

  @securite @RG-008-01 @EX-017
  Plan du scénario: Seule la propriétaire règle les permissions des rôles
    Étant donné que <personne> est connecté(e) et travaille dans le salon "Go Beauty Akwa"
    Quand <personne> ajoute "Finances : consulter" aux permissions de "<rôle visé>"
    Alors la modification est refusée avec le motif "Votre rôle dans ce salon ne permet pas cette action : demandez-la au propriétaire."
    Et les permissions de "<rôle visé>" n'ont pas changé

    Exemples:
      | personne        | rôle visé                      |
      | Rodrigue Etoa   | Administrateur de salon        |
      | Awa Tchoua      | Coiffeur / Coiffeuse / Barbier |
      | Hortense Mballa | Administrateur de salon        |

  @securite @RG-008-01 @RG-008-04 @EX-017
  Scénario: Même avec toutes les permissions ajustables, un administrateur ne consulte ni ne règle les rôles
    Étant donné que Mireille a donné à "Administrateur de salon" les 16 permissions ajustables
    Et que Rodrigue est connecté et travaille dans le salon "Go Beauty Akwa"
    Quand Rodrigue consulte les rôles et permissions de "Go Beauty Akwa"
    Alors la consultation est refusée avec le motif "Votre rôle dans ce salon ne permet pas cette action : demandez-la au propriétaire."

  @securite @RG-008-01 @BR-12 @EX-024
  Scénario: Les réglages visent toujours le salon ouvert
    Étant donné que Mireille passe au salon "Go Beauty Bastos"
    Quand Mireille ajoute "Finances : consulter" aux permissions de "Administrateur de salon"
    Alors Rodrigue a "Finances : consulter" dans "Go Beauty Bastos"
    Mais les permissions de "Administrateur de salon" de "Go Beauty Akwa" n'ont pas changé

  @securite @RG-008-14
  Scénario: Deux enregistrements simultanés du même rôle : un seul réussit
    Quand Mireille enregistre en même temps, depuis deux écrans ouverts sur la même version, deux réglages différents de "Administrateur de salon"
    Alors un seul réglage est enregistré
    Et l'autre est refusé avec le motif "Les permissions de ce rôle viennent d'être modifiées sur un autre écran. Rechargez pour voir la version à jour, puis recommencez."
    Et le journal d'audit n'a qu'une nouvelle ligne

  @securite @RG-008-18 @EX-011 @EX-012 @apres-UC-012
  Scénario: Régler les rôles d'un salon ne donne ni ne retire aucun rôle système
    Étant donné que Serge Kamga a le rôle système "Administrateur Opérations" et est "Administrateur de salon" de "Go Beauty Akwa"
    Quand Mireille retire toutes les permissions de "Administrateur de salon"
    Alors Serge a toujours le seul rôle système "Administrateur Opérations"
    Et Mireille n'a toujours aucun rôle système
