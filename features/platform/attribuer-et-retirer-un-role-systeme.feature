# language: fr
@UC-012
Fonctionnalité: Attribuer et retirer un rôle système
  Pour répartir l'administration de la plateforme GoMeCoiffer en toute sécurité,
  un Super Administrateur consulte les administrateurs actifs, attribue un ou plusieurs rôles système
  à des comptes du personnel existants et retire un rôle système avec effet immédiat,
  sans jamais modifier ses propres rôles, retirer le dernier Super Administrateur ni mélanger rôles système et rôles salon.

  Contexte:
    Étant donné que nous sommes le 20/11/2026 à 10 h 00, heure de Douala
    Et que les comptes existants sont :
      | personne            | numéro        | type de compte      |
      | Henri Ondoa         | 6 90 11 22 33 | compte du personnel |
      | Nadine Tchatchouang | 6 91 22 33 44 | compte du personnel |
      | Serge Kamga         | 6 92 33 44 55 | compte du personnel |
      | Brice Mvondo        | 6 93 44 55 66 | compte du personnel |
      | Mireille Ndongo     | 6 77 12 34 56 | compte du personnel |
      | Aïcha Mbarga        | 6 55 44 33 22 | compte client léger |
    Et qu'aucun compte n'existe pour le 6 70 00 00 01
    Et que les rôles système actifs sont :
      | personne    | rôle système              |
      | Henri Ondoa | Super Administrateur      |
      | Serge Kamga | Administrateur Opérations |
    Et que les appartenances salon actives sont :
      | personne        | salon             | rôle                    |
      | Mireille Ndongo | Go Beauty Akwa    | Propriétaire            |
      | Serge Kamga     | Salon Kamga Essos | Propriétaire            |
      | Serge Kamga     | Go Beauty Akwa    | Administrateur de salon |
    Et qu'Henri est connecté en tant que membre du personnel

  @nominal @RG-012-07 @EX-012
  Scénario: Initialisation du premier Super Administrateur par commande d'exploitation
    Étant donné qu'aucun utilisateur n'a encore de rôle système sur la plateforme
    Quand l'exploitant exécute la commande d'initialisation du premier Super Administrateur pour le "6 90 11 22 33"
    Alors Henri Ondoa possède le rôle système "Super Administrateur"
    Et le journal d'audit contient « rôle système attribué » pour Henri Ondoa, rôle "Super Administrateur", par "commande d'exploitation"

  @alternatif @RG-012-07
  Scénario: Relancer la commande d'exploitation pour un Super Administrateur existant est sans effet
    Quand l'exploitant exécute la commande d'initialisation du premier Super Administrateur pour le "6 90 11 22 33"
    Alors la commande réussit
    Et Henri Ondoa possède toujours une seule fois le rôle système "Super Administrateur"
    Et le journal d'audit n'a aucune nouvelle ligne

  @nominal @RG-012-01 @RG-012-02 @RG-012-04 @RG-012-08 @EX-012
  Scénario: Un Super Administrateur attribue un rôle système à un compte du personnel
    Étant donné que Brice Mvondo est connecté depuis 9 h 30
    Quand Henri attribue le rôle système "Administrateur Finance Plateforme" au "6 93 44 55 66"
    Alors Brice Mvondo possède le rôle système "Administrateur Finance Plateforme"
    Et dès sa requête suivante, le résumé de session de Brice mentionne le rôle système "Administrateur Finance Plateforme"
    Et à sa prochaine connexion, on invite Brice à ouvrir l'administration GoMeCoiffer

  @nominal @RG-012-03 @EX-011
  Scénario: Une même personne peut cumuler plusieurs rôles système
    Quand Henri attribue le rôle système "Administrateur Finance Plateforme" au "6 92 33 44 55"
    Alors Serge Kamga possède les rôles système "Administrateur Opérations" et "Administrateur Finance Plateforme"

  @nominal @RG-012-10 @EX-025
  Scénario: Le Super Administrateur consulte la liste des administrateurs GoMeCoiffer sans numéro en clair
    Quand Henri consulte la liste des administrateurs GoMeCoiffer
    Alors il voit les administrateurs suivants :
      | nom         | numéro masqué | rôles système             |
      | Henri Ondoa | 6 •• •• •• 33 | Super Administrateur      |
      | Serge Kamga | 6 •• •• •• 55 | Administrateur Opérations |
    Et la liste indique 1 Super Administrateur actif
    Et ni Brice Mvondo, ni Mireille Ndongo, ni Aïcha Mbarga n'apparaissent dans la liste
    Et aucun numéro de téléphone complet n'est exposé

  @nominal @RG-012-06 @RG-012-08 @EX-012
  Scénario: Un Super Administrateur retire un rôle système et ferme immédiatement les sessions de la personne
    Étant donné que Serge Kamga est connecté sur deux appareils et suit GoMeCoiffer en direct
    Quand Henri retire le rôle système "Administrateur Opérations" à Serge Kamga
    Alors Serge Kamga ne possède plus le rôle système "Administrateur Opérations"
    Et les deux sessions de Serge sont refusées dès la requête suivante avec le motif "Session absente ou expirée : reconnectez-vous."
    Et les flux de suivi en direct de Serge sont fermés

  @alternatif @RG-012-06
  Scénario: Un Super Administrateur peut retirer le rôle Super Administrateur s'il en reste au moins un autre
    Étant donné que Nadine Tchatchouang possède aussi le rôle système "Super Administrateur"
    Quand Henri retire le rôle système "Super Administrateur" à Nadine Tchatchouang
    Alors Nadine Tchatchouang ne possède plus le rôle système "Super Administrateur"
    Et Henri Ondoa reste Super Administrateur actif

  @alternatif @RG-012-08 @D-026
  Plan du scénario: La durée de session réduite s'applique dès qu'une personne porte un rôle système
    Étant donné que Serge Kamga s'est connecté le 20/11/2026 à 08 h 00
    Quand Serge accède à l'administration le 20/11/2026 à <heure> après <inactivité> sans activité
    Alors l'accès est <résultat>

    Exemples:
      | heure   | inactivité | résultat                 |
      | 09 h 59 | 1 h 59     | accordé                  |
      | 10 h 01 | 2 h 01     | refusé : session expirée |
      | 20 h 01 | 0 h 30     | refusé : session expirée |

  @alternatif @RG-012-08 @D-026
  Scénario: Après retrait de son dernier rôle système, la personne retrouve les durées de session du personnel à sa reconnexion
    Étant donné qu'Henri a retiré le rôle système "Administrateur Opérations" à Serge Kamga
    Et que Serge s'est reconnecté le 20/11/2026 à 10 h 05
    Quand Serge accède à son espace le 20/11/2026 à 13 h 00 après 2 h 55 sans activité
    Alors l'accès est accordé

  @securite @RG-012-09 @EX-011 @EX-012
  Scénario: Attribuer ou retirer un rôle système ne change aucune appartenance ni permission salon
    Quand Henri retire le rôle système "Administrateur Opérations" à Serge Kamga
    Alors Serge Kamga reste "Propriétaire" du salon "Salon Kamga Essos"
    Et Serge Kamga reste "Administrateur de salon" du salon "Go Beauty Akwa"
    Et lorsque Serge se reconnecte, on l'invite à choisir son salon

  @securite @RG-012-09 @EX-011 @EX-024
  Scénario: Un rôle système ne donne aucun accès au back-office d'un salon sans appartenance
    Quand Henri tente d'ouvrir le salon "Go Beauty Akwa"
    Alors l'ouverture est refusée comme pour un salon qui n'existe pas

  @securite @RG-012-12 @EX-023 @EX-025
  Scénario: Chaque attribution et chaque retrait est tracé sans donnée personnelle
    Étant donné qu'Henri a attribué le rôle système "Administrateur Finance Plateforme" au "6 93 44 55 66" à 10 h 00
    Quand Henri retire le rôle système "Administrateur Finance Plateforme" à Brice Mvondo à 10 h 05
    Alors le journal d'audit contient « rôle système attribué » à 10 h 00 et « rôle système retiré » à 10 h 05 pour Brice Mvondo, rôle "Administrateur Finance Plateforme", par Henri Ondoa
    Et ni le nom ni le numéro de téléphone de Brice ou d'Henri n'y figurent

  @erreur @RG-012-08
  Scénario: Une panne du suivi en direct n'empêche pas le retrait d'un rôle système
    Étant donné que le service de suivi en direct est indisponible
    Et que Serge Kamga est connecté
    Quand Henri retire le rôle système "Administrateur Opérations" à Serge Kamga
    Alors le retrait est enregistré
    Et la session de Serge est refusée dès la requête suivante avec le motif "Session absente ou expirée : reconnectez-vous."

  @securite @RG-012-01 @EX-012 @EX-024
  Plan du scénario: Seul un Super Administrateur consulte, attribue ou retire un rôle système
    Étant donné que <personne> est connecté(e) avec <type de session>
    Quand <personne> tente d'attribuer le rôle système "Administrateur Finance Plateforme" au "6 93 44 55 66"
    Alors la demande est refusée avec le motif "<motif>"
    Et Brice Mvondo n'a toujours aucun rôle système

    Exemples:
      | personne        | type de session         | motif                                                                                    |
      | Serge Kamga     | une session personnel   | Action réservée à l’équipe GoMeCoiffer.                                                  |
      | Mireille Ndongo | une session personnel   | Action réservée à l’équipe GoMeCoiffer.                                                  |
      | Aïcha Mbarga    | une session client      | Cet espace est réservé aux comptes du personnel : connectez-vous avec votre mot de passe. |

  @erreur @RG-012-01
  Plan du scénario: Sans session ou sans jeton de sécurité, aucune action n'est effectuée
    Étant donné que <situation>
    Quand Henri attribue le rôle système "Administrateur Finance Plateforme" au "6 93 44 55 66"
    Alors la demande est refusée avec le motif "<motif>"
    Et Brice Mvondo n'a toujours aucun rôle système

    Exemples:
      | situation                                         | motif                                                                    |
      | la session d'Henri a expiré                       | Session absente ou expirée : reconnectez-vous.                           |
      | la demande d'Henri n'a pas de jeton de sécurité   | Jeton de sécurité absent ou expiré : rechargez la page puis recommencez. |

  @erreur @securite @RG-012-01 @RG-012-02
  Plan du scénario: Seuls les trois rôles système et les informations attendues sont acceptés
    Quand Henri attribue <rôle> au "<numéro>" <extra>
    Alors la demande est refusée avec le motif "Certaines informations sont invalides : corrigez les champs signalés."
    Et aucun rôle système n'a été ajouté

    Exemples:
      | rôle                               | numéro        | extra                                     |
      | le rôle "Propriétaire"             | 6 93 44 55 66 | sans information en trop                  |
      | le rôle inconnu "Modérateur"       | 6 93 44 55 66 | sans information en trop                  |
      | le rôle "Administrateur Opérations"| 6 93 44 55 6  | sans information en trop                  |
      | le rôle "Administrateur Opérations"| 6 93 44 55 66 | en indiquant en plus le salon "Go Beauty Akwa" |

  @erreur @RG-012-04
  Plan du scénario: Seul un compte du personnel existant peut recevoir un rôle système
    Quand Henri attribue le rôle système "Administrateur Opérations" au "<numéro>"
    Alors la demande est refusée avec le motif "<motif>"
    Et aucun rôle système n'a été ajouté

    Exemples:
      | numéro        | motif                                                                                                                      |
      | 6 70 00 00 01 | Aucun compte du personnel n'existe pour ce numéro. Demandez à la personne de créer son compte d'abord.                     |
      | 6 55 44 33 22 | Ce compte est un compte client sans mot de passe. La personne doit d'abord créer un compte du personnel avec mot de passe. |

  @erreur @securite @RG-012-05 @EX-012
  Plan du scénario: Un Super Administrateur ne peut jamais modifier ses propres rôles système
    Étant donné que Nadine Tchatchouang possède aussi le rôle système "Super Administrateur"
    Quand Henri tente de <action> sur son propre compte
    Alors la demande est refusée avec le motif "Vous ne pouvez pas modifier vos propres rôles système. Demandez à un autre Super Administrateur."
    Et les rôles système d'Henri n'ont pas changé

    Exemples:
      | action                                                   |
      | s'attribuer le rôle "Administrateur Finance Plateforme"  |
      | se retirer le rôle "Super Administrateur"                |

  @erreur @RG-012-03
  Scénario: Attribuer un rôle système déjà détenu est refusé sans créer de doublon
    Quand Henri attribue le rôle système "Administrateur Opérations" au "6 92 33 44 55"
    Alors la demande est refusée avec le motif "Cette personne possède déjà ce rôle système."
    Et le journal d'audit n'a aucune nouvelle ligne

  @erreur @RG-012-06
  Scénario: Retirer un rôle système non détenu par la personne est refusé
    Quand Henri retire le rôle système "Administrateur Finance Plateforme" à Serge Kamga
    Alors la demande est refusée avec le motif "Ce rôle système n'est pas attribué à cette personne."
    Et les sessions de Serge ne sont pas fermées

  @securite @RG-012-06
  Scénario: Impossible de retirer le dernier Super Administrateur actif
    Étant donné qu'Henri Ondoa est le seul Super Administrateur actif
    Et que le système traite une demande de retrait du rôle "Super Administrateur" d'Henri Ondoa
    Quand le retrait du dernier Super Administrateur est évalué
    Alors le retrait est refusé avec le motif "Impossible de retirer le dernier Super Administrateur. Attribuez d'abord ce rôle à une autre personne."
    Et Henri Ondoa reste Super Administrateur actif

  @securite @RG-012-11
  Scénario: Deux attributions simultanées du même rôle ne créent qu'une seule attribution
    Quand deux demandes d'Henri attribuant "Administrateur Finance Plateforme" au "6 93 44 55 66" arrivent en même temps
    Alors une seule réussit
    Et l'autre est refusée avec le motif "Cette personne possède déjà ce rôle système."
    Et le journal d'audit n'a qu'une nouvelle ligne

  @securite @RG-012-06 @RG-012-11
  Scénario: Deux retraits simultanés des deux derniers Super Administrateurs en conservent toujours un
    Étant donné que Nadine Tchatchouang possède aussi le rôle système "Super Administrateur"
    Et que Nadine est connectée
    Quand Henri retire "Super Administrateur" à Nadine au même instant où Nadine retire "Super Administrateur" à Henri
    Alors un seul des deux retraits réussit
    Et l'autre est refusé avec le motif "Impossible de retirer le dernier Super Administrateur. Attribuez d'abord ce rôle à une autre personne."
    Et il reste exactement 1 Super Administrateur actif sur la plateforme

  @erreur @RG-012-12
  Scénario: Une panne pendant l'enregistrement ne laisse aucun changement partiel
    Étant donné que le service GoMeCoiffer tombe en panne pendant le retrait
    Et que Serge Kamga est connecté
    Quand Henri retire le rôle système "Administrateur Opérations" à Serge Kamga
    Alors la demande est refusée avec le motif "Enregistrement impossible pour le moment. Réessayez dans quelques minutes."
    Et Serge Kamga possède toujours le rôle système "Administrateur Opérations"
    Et la session de Serge est toujours active
    Et le journal d'audit n'a aucune nouvelle ligne
