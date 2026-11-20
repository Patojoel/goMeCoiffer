# language: fr
@UC-011
Fonctionnalité: Gérer l'équipe du salon
  Pour maintenir des accès exacts et sûrs au fil de la vie du salon,
  la propriétaire ou un membre autorisé consulte l'équipe du salon ouvert,
  change le rôle d'un collaborateur, le retire avec effet immédiat et peut le réintégrer par une nouvelle invitation.

  Contexte:
    Étant donné que nous sommes le 20/11/2026 à 10 h 00, heure de Douala
    Et que l'organisation de Mireille Ndongo compte les salons "Go Beauty Akwa" et "Go Beauty Bastos"
    Et que les appartenances actives sont :
      | personne        | salon                 | rôle                              | arrivée le           |
      | Mireille Ndongo | Go Beauty Akwa        | Propriétaire                      | 18/11/2026 à 9 h 00  |
      | Mireille Ndongo | Go Beauty Bastos      | Propriétaire                      | 18/11/2026 à 9 h 30  |
      | Rodrigue Etoa   | Go Beauty Akwa        | Administrateur de salon           | 19/11/2026 à 8 h 00  |
      | Rodrigue Etoa   | Go Beauty Bastos      | Administrateur de salon           | 19/11/2026 à 8 h 30  |
      | Awa Tchoua      | Go Beauty Akwa        | Coiffeur / Coiffeuse / Barbier    | 19/11/2026 à 9 h 00  |
      | Hortense Mballa | Go Beauty Akwa        | Responsable financier             | 19/11/2026 à 10 h 00 |
      | Grâce Mbarga    | Go Beauty Akwa        | Praticien / Praticienne de beauté | 19/11/2026 à 11 h 00 |
      | Clarisse Fotso  | Élégance Bonamoussadi | Propriétaire                      | 18/11/2026 à 10 h 00 |
      | Paul Ebode      | Élégance Bonamoussadi | Coiffeur / Coiffeuse / Barbier    | 19/11/2026 à 12 h 00 |
    Et que les rôles de "Go Beauty Akwa" et de "Go Beauty Bastos" ont leurs permissions par défaut
    Et que Mireille est connectée et travaille dans le salon "Go Beauty Akwa"

  # --- Consultation, changement de rôle, retrait et réintégration ------------------------------

  @nominal @RG-011-02 @EX-037 @EX-025 @EX-026 @BR-11
  Scénario: La propriétaire consulte l'équipe active du salon ouvert
    Quand Mireille consulte l'équipe de "Go Beauty Akwa"
    Alors elle voit, dans cet ordre :
      | personne        | rôle                              | arrivée le           |
      | Mireille Ndongo | Propriétaire                      | 18/11/2026 à 9 h 00  |
      | Awa Tchoua      | Coiffeur / Coiffeuse / Barbier    | 19/11/2026 à 9 h 00  |
      | Grâce Mbarga    | Praticien / Praticienne de beauté | 19/11/2026 à 11 h 00 |
      | Hortense Mballa | Responsable financier             | 19/11/2026 à 10 h 00 |
      | Rodrigue Etoa   | Administrateur de salon           | 19/11/2026 à 8 h 00  |
    Et aucun numéro de téléphone n'apparaît dans la liste
    Et Paul Ebode n'apparaît pas dans cette liste

  @nominal @RG-011-08 @EX-037 @EX-016 @EX-007
  Scénario: La propriétaire change le rôle d'une coiffeuse avec effet immédiat
    Étant donné qu'Awa est connectée et travaille dans le salon "Go Beauty Akwa"
    Quand Mireille change le rôle d'Awa Tchoua en "Administrateur de salon" dans "Go Beauty Akwa"
    Alors Awa Tchoua apparaît comme "Administrateur de salon" dans l'équipe de "Go Beauty Akwa"
    Et dès sa requête suivante, sans se reconnecter, Awa peut inviter un collaborateur dans "Go Beauty Akwa"
    Et Awa est toujours connectée dans le salon "Go Beauty Akwa"

  @nominal @RG-011-10 @EX-006 @EX-037
  Scénario: La propriétaire retire un collaborateur de l'équipe avec coupure immédiate de son accès
    Étant donné que Grâce est connectée et travaille dans le salon "Go Beauty Akwa"
    Quand Mireille retire Grâce Mbarga de l'équipe de "Go Beauty Akwa"
    Alors Grâce Mbarga n'apparaît plus dans l'équipe active de "Go Beauty Akwa"
    Et son appartenance est conservée à l'état "retirée"
    Et dès sa requête suivante dans "Go Beauty Akwa", Grâce est refusée avec le motif "Choisissez d’abord le salon sur lequel vous travaillez."
    Et "Go Beauty Akwa" ne figure plus dans la liste des salons de Grâce
    Et toute tentative de Grâce pour rouvrir "Go Beauty Akwa" est refusée comme pour un salon qui n'existe pas

  @nominal @RG-011-13 @EX-006 @EX-037
  Scénario: Un collaborateur retiré est réintégré par une nouvelle invitation qui réactive son appartenance
    Étant donné que Mireille a retiré Grâce Mbarga de l'équipe de "Go Beauty Akwa"
    Et que Mireille a ensuite invité de nouveau Grâce Mbarga, au 6 70 11 22 33, comme "Administrateur de salon" dans "Go Beauty Akwa"
    Et que Grâce a prouvé son numéro 6 70 11 22 33 avec le code reçu par SMS
    Quand Grâce accepte la nouvelle invitation de "Go Beauty Akwa"
    Alors la même appartenance de Grâce à "Go Beauty Akwa" redevient active avec le rôle "Administrateur de salon"
    Et Grâce apparaît de nouveau dans l'équipe active de "Go Beauty Akwa" comme "Administrateur de salon"
    Et "Go Beauty Akwa" réapparaît dans la liste des salons de Grâce

  # --- Flux alternatifs ------------------------------------------------------------------------

  @alternatif @RG-011-06 @EX-017
  Scénario: Un administrateur de salon change le rôle d'un collaborateur dans la limite de ses droits
    Étant donné que Rodrigue est connecté et travaille dans le salon "Go Beauty Akwa"
    Quand Rodrigue change le rôle d'Awa Tchoua en "Praticien / Praticienne de beauté" dans "Go Beauty Akwa"
    Alors Awa Tchoua apparaît comme "Praticien / Praticienne de beauté" dans l'équipe de "Go Beauty Akwa"

  @alternatif @RG-011-06 @EX-017
  Scénario: Un administrateur de salon retire un collaborateur dans la limite de ses droits
    Étant donné que Rodrigue est connecté et travaille dans le salon "Go Beauty Akwa"
    Quand Rodrigue retire Grâce Mbarga de l'équipe de "Go Beauty Akwa"
    Alors Grâce Mbarga n'apparaît plus dans l'équipe active de "Go Beauty Akwa"

  @alternatif @RG-011-09
  Scénario: Changer le rôle d'un collaborateur vers son rôle actuel n'écrit rien et ne laisse aucune trace
    Quand Mireille change le rôle d'Awa Tchoua en "Coiffeur / Coiffeuse / Barbier" dans "Go Beauty Akwa"
    Alors la demande est acceptée
    Et la version de l'appartenance d'Awa n'a pas changé
    Et le journal d'audit n'a aucune nouvelle ligne
    Et aucun signal en direct n'est envoyé

  @alternatif @RG-011-12 @D-049
  Scénario: Les invitations déjà envoyées par un collaborateur retiré restent valables
    Étant donné que Rodrigue a invité "Brice Nana", au 6 55 44 33 22, comme "Coiffeur / Coiffeuse / Barbier" dans "Go Beauty Akwa"
    Quand Mireille retire Rodrigue Etoa de l'équipe de "Go Beauty Akwa"
    Alors l'invitation de "Brice Nana" dans "Go Beauty Akwa" est toujours en attente

  @alternatif @securite @RG-011-07 @RG-011-10 @EX-004 @EX-007 @BR-12
  Scénario: Retirer un collaborateur dans un salon ne touche pas son rôle dans un autre salon
    Étant donné que Rodrigue travaille dans "Go Beauty Bastos" sur la tablette du salon
    Quand Mireille retire Rodrigue Etoa de l'équipe de "Go Beauty Akwa"
    Alors Rodrigue n'a plus accès à "Go Beauty Akwa"
    Mais Rodrigue est toujours "Administrateur de salon" de "Go Beauty Bastos"
    Et Rodrigue continue de travailler dans "Go Beauty Bastos" sans interruption

  @alternatif @RG-011-08 @EX-036
  Scénario: Les écrans ouverts sont prévenus en direct d'un changement de rôle
    Étant donné qu'Awa suit "Go Beauty Akwa" en direct
    Quand Mireille change le rôle d'Awa Tchoua en "Administrateur de salon" dans "Go Beauty Akwa"
    Alors Awa reçoit en moins de 5 secondes le signal « rôle d'un collaborateur modifié » dans "Go Beauty Akwa"
    Et ce signal ne contient ni nom ni numéro de téléphone

  @erreur @RG-011-08
  Scénario: Une panne du suivi en direct n'annule pas le changement de rôle
    Étant donné que le suivi en direct est indisponible
    Quand Mireille change le rôle d'Awa Tchoua en "Administrateur de salon" dans "Go Beauty Akwa"
    Alors le changement de rôle est enregistré
    Et dès sa requête suivante, Awa a les permissions d'"Administrateur de salon" dans "Go Beauty Akwa"

  # --- Fermeture immédiate des flux SSE au retrait ---------------------------------------------

  @securite @RG-011-11 @EX-006 @EX-036
  Scénario: Le retrait ferme immédiatement les flux en direct du collaborateur sur ce salon, sans toucher ses autres salons
    Étant donné que Rodrigue suit "Go Beauty Akwa" en direct sur son téléphone
    Et que Rodrigue suit "Go Beauty Bastos" en direct sur la tablette du salon
    Quand Mireille retire Rodrigue Etoa de l'équipe de "Go Beauty Akwa"
    Alors le flux en direct de Rodrigue sur "Go Beauty Akwa" est fermé immédiatement
    Et une nouvelle de "Go Beauty Akwa" ne lui parvient plus
    Mais le flux en direct de Rodrigue sur "Go Beauty Bastos" reste ouvert

  @erreur @RG-011-11
  Scénario: Une panne du suivi en direct n'annule pas le retrait
    Étant donné que le suivi en direct est indisponible
    Quand Mireille retire Grâce Mbarga de l'équipe de "Go Beauty Akwa"
    Alors Grâce Mbarga est retirée de l'équipe de "Go Beauty Akwa"
    Et dès sa requête suivante, son accès à "Go Beauty Akwa" est coupé

  # --- Audit -----------------------------------------------------------------------------------

  @securite @RG-011-15 @EX-023 @EX-025
  Scénario: Le changement de rôle et le retrait sont tracés dans l'audit sans donnée personnelle
    Étant donné que Mireille a changé le rôle d'Awa Tchoua en "Administrateur de salon" dans "Go Beauty Akwa"
    Quand Mireille retire Grâce Mbarga de l'équipe de "Go Beauty Akwa"
    Alors le journal d'audit contient « rôle d'un collaborateur modifié » pour Awa (de "Coiffeur / Coiffeuse / Barbier" à "Administrateur de salon") et « collaborateur retiré de l'équipe » pour Grâce (rôle "Praticien / Praticienne de beauté") dans "Go Beauty Akwa"
    Et aucune de ces lignes ne contient de nom, de numéro de téléphone ni d'adresse réseau

  # --- Protections métier (Propriétaire, soi-même, non-élévation) ------------------------------

  @securite @RG-011-04 @EX-014 @EX-017
  Plan du scénario: Le propriétaire du salon ne peut ni changer de rôle ni être retiré de l'équipe
    Étant donné que <auteur> est connecté(e) et travaille dans le salon "Go Beauty Akwa"
    Quand <auteur> tente de <action> Mireille Ndongo dans "Go Beauty Akwa"
    Alors l'opération est refusée avec le motif "Le propriétaire du salon ne peut ni changer de rôle ni être retiré de l'équipe."
    Et Mireille Ndongo est toujours "Propriétaire" de "Go Beauty Akwa"

    Exemples:
      | auteur          | action                                           |
      | Rodrigue Etoa   | changer le rôle en "Coiffeur / Coiffeuse / Barbier" de |
      | Rodrigue Etoa   | retirer de l'équipe                              |
      | Mireille Ndongo | changer le rôle en "Administrateur de salon" de  |
      | Mireille Ndongo | retirer de l'équipe                              |

  @securite @RG-011-05 @EX-017
  Plan du scénario: Un collaborateur ne peut ni changer son propre rôle ni se retirer lui-même de l'équipe
    Étant donné que Rodrigue est connecté et travaille dans le salon "Go Beauty Akwa"
    Quand Rodrigue tente de <action> dans "Go Beauty Akwa"
    Alors l'opération est refusée avec le motif "Vous ne pouvez pas modifier votre propre rôle ni vous retirer vous-même de l'équipe : demandez au propriétaire."
    Et Rodrigue Etoa est toujours "Administrateur de salon" de "Go Beauty Akwa"

    Exemples:
      | action                                                     |
      | changer son propre rôle en "Coiffeur / Coiffeuse / Barbier" |
      | se retirer lui-même de l'équipe                            |

  @securite @RG-011-06 @EX-017 @EX-007
  Plan du scénario: Pas d'élévation de droits lors d'un changement de rôle ou d'un retrait
    Étant donné que, dans "Go Beauty Akwa", <réglage>
    Et que Rodrigue est connecté et travaille dans le salon "Go Beauty Akwa"
    Quand Rodrigue tente de <action> dans "Go Beauty Akwa"
    Alors l'opération est <résultat>

    Exemples:
      | réglage                                                                     | action                                                                   | résultat                                                                                                                  |
      | les rôles ont leurs permissions par défaut                                  | changer le rôle d'Awa Tchoua en "Responsable financier"                  | refusée avec le motif "Ce collaborateur ou ce rôle dispose de droits que vous n'avez pas dans ce salon : demandez au propriétaire." |
      | les rôles ont leurs permissions par défaut                                  | changer le rôle d'Hortense Mballa en "Coiffeur / Coiffeuse / Barbier"    | refusée avec le motif "Ce collaborateur ou ce rôle dispose de droits que vous n'avez pas dans ce salon : demandez au propriétaire." |
      | les rôles ont leurs permissions par défaut                                  | retirer Hortense Mballa de l'équipe                                      | refusée avec le motif "Ce collaborateur ou ce rôle dispose de droits que vous n'avez pas dans ce salon : demandez au propriétaire." |
      | l'Administrateur de salon a reçu en plus les trois permissions des finances | changer le rôle d'Hortense Mballa en "Coiffeur / Coiffeuse / Barbier"    | réussie                                                                                                                   |
      | l'Administrateur de salon a reçu en plus les trois permissions des finances | retirer Hortense Mballa de l'équipe                                      | réussie                                                                                                                   |
      | le Coiffeur / Coiffeuse / Barbier a reçu en plus "Finances : consulter"     | retirer Awa Tchoua de l'équipe                                           | refusée avec le motif "Ce collaborateur ou ce rôle dispose de droits que vous n'avez pas dans ce salon : demandez au propriétaire." |

  # --- Validation stricte, autorisations et isolation ------------------------------------------

  @erreur @securite @RG-011-03 @EX-012 @EX-014 @EX-015
  Plan du scénario: Seuls les quatre rôles de collaborateur peuvent être attribués
    Quand Mireille change le rôle d'Awa Tchoua en "<rôle demandé>" dans "Go Beauty Akwa"
    Alors l'opération est refusée avec le motif "Certaines informations sont invalides : corrigez les champs signalés."
    Et Awa Tchoua est toujours "Coiffeur / Coiffeuse / Barbier" de "Go Beauty Akwa"

    Exemples:
      | rôle demandé              | raison                                |
      | Propriétaire              | rôle lié à la propriété               |
      | Super Administrateur      | rôle système attribué par GoMeCoiffer |
      | Esthéticienne             | métier, pas un rôle                   |

  @erreur @securite @RG-011-01 @EX-024
  Plan du scénario: La demande ne porte que les champs attendus et la version lue
    Quand Mireille demande un changement de rôle d'Awa Tchoua dans "Go Beauty Akwa" avec <anomalie>
    Alors l'opération est refusée avec le motif "Certaines informations sont invalides : corrigez les champs signalés."
    Et Awa Tchoua est toujours "Coiffeur / Coiffeuse / Barbier" de "Go Beauty Akwa"

    Exemples:
      | anomalie                                      |
      | un identifiant de membre mal formé "membre-1" |
      | en plus le salon "Go Beauty Bastos"           |
      | en plus le statut "REVOKED"                   |
      | sans la version qu'elle a consultée           |

  @securite @RG-011-07 @EX-006 @EX-024 @BR-12
  Plan du scénario: Un membre inexistant ou d'un autre salon reçoit le même refus « introuvable »
    Quand Mireille tente de <action> sur <membre visé> depuis "Go Beauty Akwa"
    Alors l'opération est refusée comme pour un membre qui n'existe pas
    Et <conséquence>

    Exemples:
      | action              | membre visé                                        | conséquence                                                         |
      | changer le rôle     | un membre dont l'identifiant n'existe pas          | rien n'a changé                                                     |
      | changer le rôle     | l'appartenance de Rodrigue dans "Go Beauty Bastos" | Rodrigue est toujours "Administrateur de salon" de "Go Beauty Bastos" |
      | retirer de l'équipe | l'appartenance de Paul dans "Élégance Bonamoussadi" | Paul est toujours "Coiffeur / Coiffeuse / Barbier" d'"Élégance Bonamoussadi" |

  @securite @RG-011-01 @EX-007 @EX-024
  Plan du scénario: Sans le droit requis, consulter ou gérer l'équipe est refusé
    Étant donné que <situation>
    Quand <personne> tente de <action> dans "Go Beauty Akwa"
    Alors l'opération est refusée avec le motif "Votre rôle dans ce salon ne permet pas cette action : demandez-la au propriétaire."

    Exemples:
      | personne        | situation                                                                        | action                                           |
      | Awa Tchoua      | Awa est connectée et travaille dans "Go Beauty Akwa"                             | consulter l'équipe                               |
      | Hortense Mballa | Hortense est connectée et travaille dans "Go Beauty Akwa"                        | retirer Grâce Mbarga de l'équipe                 |
      | Rodrigue Etoa   | Mireille a retiré "Personnel : gérer" des permissions de "Administrateur de salon" | changer le rôle d'Awa Tchoua en "Praticien / Praticienne de beauté" |

  @erreur @RG-011-01
  Plan du scénario: Sans session, sans jeton de sécurité ou sans salon ouvert, rien ne change
    Étant donné que <situation>
    Quand Mireille change le rôle d'Awa Tchoua en "Administrateur de salon"
    Alors l'opération est refusée avec le motif "<motif>"
    Et Awa Tchoua est toujours "Coiffeur / Coiffeuse / Barbier" de "Go Beauty Akwa"

    Exemples:
      | situation                                           | motif                                                                    |
      | la session de Mireille a expiré                     | Session absente ou expirée : reconnectez-vous.                           |
      | la demande de Mireille n'a pas de jeton de sécurité | Jeton de sécurité absent ou expiré : rechargez la page puis recommencez. |
      | Mireille vient de se connecter, sans salon ouvert   | Choisissez d’abord le salon sur lequel vous travaillez.                  |

  # --- État incohérent, concurrence et panne ---------------------------------------------------

  @erreur @RG-011-10
  Plan du scénario: Un collaborateur déjà retiré ne peut plus être modifié ni retiré une seconde fois
    Étant donné que Mireille a déjà retiré Grâce Mbarga de l'équipe de "Go Beauty Akwa"
    Quand Mireille tente de <action> Grâce Mbarga dans "Go Beauty Akwa"
    Alors l'opération est refusée avec le motif "Ce collaborateur a déjà été retiré de l'équipe de ce salon."

    Exemples:
      | action                                           |
      | changer le rôle en "Coiffeur / Coiffeuse / Barbier" de |
      | retirer de l'équipe                              |

  @erreur @RG-011-14
  Scénario: Une modification faite à partir d'un écran périmé est refusée
    Étant donné que Mireille a ouvert l'équipe de "Go Beauty Akwa" sur sa tablette et sur son téléphone
    Et qu'elle a ensuite changé le rôle d'Awa Tchoua en "Administrateur de salon" depuis son téléphone
    Quand Mireille retire Awa Tchoua depuis sa tablette sans avoir rechargé
    Alors l'opération est refusée avec le motif "Ce membre vient d'être modifié sur un autre écran. Rechargez l'équipe puis recommencez."
    Et Awa Tchoua est toujours "Administrateur de salon" de "Go Beauty Akwa"

  @securite @RG-011-14
  Scénario: Deux opérations simultanées sur le même collaborateur : une seule réussit
    Quand Mireille lance en même temps, depuis deux écrans sur la même version, un changement de rôle d'Awa Tchoua et son retrait de "Go Beauty Akwa"
    Alors une seule opération réussit
    Et l'autre est refusée avec le motif "Ce membre vient d'être modifié sur un autre écran. Rechargez l'équipe puis recommencez."
    Et le journal d'audit n'a qu'une nouvelle ligne

  @alternatif @RG-011-14
  Scénario: Deux collaborateurs différents sont modifiés en même temps sans se gêner
    Quand Mireille change en même temps le rôle d'Awa Tchoua et retire Grâce Mbarga de "Go Beauty Akwa"
    Alors les deux opérations réussissent

  @erreur @RG-011-15
  Scénario: Une panne pendant l'enregistrement ne change rien et ne ferme aucun flux en direct
    Étant donné que Grâce suit "Go Beauty Akwa" en direct
    Et que le service GoMeCoiffer tombe en panne pendant l'enregistrement du retrait
    Quand Mireille retire Grâce Mbarga de l'équipe de "Go Beauty Akwa"
    Alors l'opération est refusée avec le motif "Opération impossible pour le moment. Réessayez dans quelques minutes."
    Et Grâce Mbarga est toujours "Praticien / Praticienne de beauté" de "Go Beauty Akwa"
    Et le journal d'audit n'a aucune nouvelle ligne
    Et le flux en direct de Grâce sur "Go Beauty Akwa" est toujours ouvert

  @securite @RG-011-16 @EX-011 @EX-012 @apres-UC-012
  Scénario: Gérer l'équipe d'un salon ne donne ni ne retire aucun rôle système
    Étant donné que Serge Kamga a le rôle système "Administrateur Opérations" et est "Administrateur de salon" de "Go Beauty Akwa"
    Quand Mireille retire Serge Kamga de l'équipe de "Go Beauty Akwa"
    Alors Serge a toujours le seul rôle système "Administrateur Opérations"
    Et Mireille n'a toujours aucun rôle système

