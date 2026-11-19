# language: fr
@UC-005
Fonctionnalité: Ouvrir et changer de salon
  Pour travailler dans le bon établissement avec les bons droits,
  un membre du personnel choisit son salon actif parmi les salons où il a une appartenance, et en change sans se reconnecter :
  ses droits deviennent ceux de son rôle dans ce salon, et rien d'un autre salon.

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

  @nominal @RG-005-02 @RG-005-08 @EX-004 @EX-006
  Scénario: Un coiffeur ouvre le salon où il travaille
    Étant donné que Paul est connecté, sans salon ouvert
    Quand Paul ouvre le salon "Élégance Bonamoussadi"
    Alors le salon ouvert dans la session de Paul est "Élégance Bonamoussadi"
    Et son résumé de session indique le rôle "Coiffeur" pour ce salon

  @nominal @RG-005-05 @EX-009 @EX-007 @D-003
  Scénario: Changer de salon change les droits
    Étant donné que Paul est connecté et travaille dans le salon "Paul Barber Deïdo"
    Et qu'une action qui exige la permission "gérer les réservations" lui est permise dans ce salon
    Quand Paul passe au salon "Élégance Bonamoussadi"
    Alors la même action lui est refusée avec le motif "Votre rôle dans ce salon ne permet pas cette action : demandez-la au propriétaire."

  @nominal @RG-005-04 @EX-008 @EX-002 @EX-033
  Scénario: Une propriétaire passe d'un salon à l'autre de son organisation
    Étant donné que Mireille est connectée et travaille dans le salon "Go Beauty Akwa"
    Quand Mireille passe au salon "Go Beauty Bastos"
    Alors le salon ouvert dans la session de Mireille est "Go Beauty Bastos"
    Et une action qui exige la permission "gérer les réservations" lui est permise dans ce salon

  @alternatif @RG-005-08 @EX-004 @EX-006
  Scénario: La liste de ses salons indique son rôle dans chacun
    Étant donné que Paul est connecté
    Quand Paul consulte la liste de ses salons
    Alors il voit, dans cet ordre :
      | salon                 | rôle         | ville  | quartier     |
      | Élégance Bonamoussadi | Coiffeur     | Douala | Bonamoussadi |
      | Paul Barber Deïdo     | Propriétaire | Douala | Deïdo        |
    Et il n'y voit ni "Go Beauty Akwa" ni "Go Beauty Bastos"

  @alternatif @RG-005-09 @D-027
  Scénario: Un utilisateur qui n'a qu'un salon y entre sans rien choisir
    Étant donné qu'Awa vient de se connecter et qu'on l'invite à ouvrir le salon "Go Beauty Akwa"
    Quand l'application ouvre d'office ce salon pour Awa
    Alors le salon ouvert dans la session d'Awa est "Go Beauty Akwa"
    Et aucun écran de choix ne lui a été présenté

  @alternatif @RG-005-10 @D-027
  Scénario: Le dernier salon utilisé n'est pas retenu à la connexion suivante
    Étant donné que Mireille a travaillé dans le salon "Go Beauty Bastos" puis s'est déconnectée
    Quand Mireille se connecte le lendemain avec son mot de passe
    Alors aucun salon n'est ouvert dans sa session
    Et on l'invite à choisir son salon

  @alternatif @RG-005-07
  Scénario: Rouvrir le salon déjà ouvert ne change rien d'autre que le jeton
    Étant donné que Paul est connecté et travaille dans le salon "Paul Barber Deïdo"
    Quand Paul ouvre le salon "Paul Barber Deïdo"
    Alors le salon ouvert dans la session de Paul est toujours "Paul Barber Deïdo"
    Et sa session reçoit un nouveau jeton de sécurité

  @securite @RG-005-03 @EX-006 @EX-024
  Plan du scénario: Un salon sans appartenance active ne s'ouvre pas, et le refus ne dit pas pourquoi
    Étant donné que <personne> est connecté et travaille dans le salon "<salon actif>"
    Et que <situation>
    Quand <personne> ouvre <salon demandé>
    Alors l'ouverture est refusée comme pour un salon qui n'existe pas
    Et le salon ouvert dans sa session est toujours "<salon actif>"

    Exemples:
      | personne | salon actif       | situation                                               | salon demandé                        |
      | Paul     | Paul Barber Deïdo | aucun salon n'a l'identifiant demandé                   | un salon dont l'identifiant n'existe pas |
      | Paul     | Paul Barber Deïdo | Paul n'a aucune appartenance dans l'organisation de Mireille | le salon "Go Beauty Bastos"          |
      | Awa      | Go Beauty Akwa    | Awa n'a pas d'appartenance au salon "Go Beauty Bastos"  | le salon "Go Beauty Bastos"          |
      | Paul     | Paul Barber Deïdo | Clarisse a retiré l'appartenance de Paul à son salon    | le salon "Élégance Bonamoussadi"     |

  @securite @RG-005-03 @RG-005-06
  Scénario: Un refus ne régénère pas la session
    Étant donné que Paul est connecté et travaille dans le salon "Paul Barber Deïdo"
    Quand Paul ouvre le salon "Go Beauty Bastos"
    Alors l'ouverture est refusée comme pour un salon qui n'existe pas
    Et l'identifiant de session et le jeton de sécurité de Paul sont toujours acceptés

  @securite @RG-005-06 @D-037 @D-004
  Scénario: Ouvrir un salon régénère la session sans la prolonger
    Étant donné que Mireille s'est connectée à 9 h 00 et travaille dans le salon "Go Beauty Akwa"
    Quand Mireille passe au salon "Go Beauty Bastos"
    Alors sa session reçoit un nouvel identifiant et un nouveau jeton de sécurité
    Et l'ancien identifiant de session et l'ancien jeton de sécurité sont refusés ensuite
    Et sa session expire toujours le 26/11/2026 à 9 h 00, 7 jours après sa connexion

  @securite @RG-005-06 @D-031
  Scénario: Une réinitialisation du mot de passe ferme aussi la session régénérée
    Étant donné que Mireille est passée au salon "Go Beauty Bastos"
    Quand Mireille réinitialise son mot de passe depuis un autre appareil
    Alors la session où "Go Beauty Bastos" est ouvert est refusée avec le motif "Session absente ou expirée : reconnectez-vous."

  @securite @RG-005-01 @EX-024
  Plan du scénario: La demande ne porte que l'identifiant du salon
    Étant donné que Paul est connecté et travaille dans le salon "Paul Barber Deïdo"
    Quand Paul ouvre le salon "Élégance Bonamoussadi" en indiquant aussi <information>
    Alors l'ouverture est refusée avec le motif "Certaines informations sont invalides : corrigez les champs signalés."
    Et le salon ouvert dans sa session est toujours "Paul Barber Deïdo"

    Exemples:
      | information                              |
      | le rôle « Propriétaire »                 |
      | l'utilisateur Clarisse Fotso             |
      | la permission « gérer les réservations » |
      | l'organisation de Clarisse Fotso         |

  @erreur @RG-005-01
  Scénario: Un identifiant de salon mal formé est refusé
    Étant donné que Paul est connecté
    Quand Paul ouvre un salon dont l'identifiant est "salon-123"
    Alors l'ouverture est refusée avec le motif "Certaines informations sont invalides : corrigez les champs signalés."

  @erreur @RG-005-01
  Scénario: Sans session, aucun salon ne s'ouvre
    Étant donné que la session de Paul a expiré
    Quand Paul ouvre le salon "Élégance Bonamoussadi"
    Alors l'ouverture est refusée avec le motif "Session absente ou expirée : reconnectez-vous."

  @erreur @RG-005-01 @EX-024
  Scénario: Une ouverture sans jeton de sécurité est refusée
    Étant donné que Paul est connecté et travaille dans le salon "Paul Barber Deïdo"
    Quand Paul ouvre le salon "Élégance Bonamoussadi" sans jeton de sécurité
    Alors l'ouverture est refusée avec le motif "Jeton de sécurité absent ou expiré : rechargez la page puis recommencez."
    Et le salon ouvert dans sa session est toujours "Paul Barber Deïdo"

  @securite @RG-005-11 @EX-036 @EX-009
  Scénario: Après un changement de salon, le suivi en direct ne porte plus que le nouveau salon
    Étant donné que Mireille travaille dans le salon "Go Beauty Akwa" et en suit les nouvelles en direct
    Quand Mireille passe au salon "Go Beauty Bastos"
    Alors son suivi en direct de "Go Beauty Akwa" s'arrête
    Et une nouvelle de "Go Beauty Akwa" ne lui parvient plus
    Et après la reconnexion de son suivi, une nouvelle de "Go Beauty Bastos" lui parvient

  @alternatif @RG-005-11 @D-028
  Scénario: Changer de salon sur un appareil ne touche pas les autres appareils
    Étant donné que Mireille suit "Go Beauty Akwa" en direct sur la tablette du salon
    Et qu'elle travaille dans "Go Beauty Akwa" sur son téléphone
    Quand Mireille passe au salon "Go Beauty Bastos" sur son téléphone
    Alors la tablette suit toujours "Go Beauty Akwa" en direct
    Et le salon ouvert sur la tablette est toujours "Go Beauty Akwa"

  @securite @RG-005-12
  Scénario: Un onglet resté sur l'ancien salon ne peut rien y modifier
    Étant donné que Mireille a deux onglets ouverts sur le salon "Go Beauty Akwa"
    Et qu'elle passe au salon "Go Beauty Bastos" dans le premier onglet
    Quand le second onglet, sans rechargement, envoie une modification
    Alors la modification est refusée avec le motif "Jeton de sécurité absent ou expiré : rechargez la page puis recommencez."
    Et rien n'est modifié, ni dans "Go Beauty Akwa" ni dans "Go Beauty Bastos"

  @securite @RG-005-12
  Scénario: Deux changements simultanés laissent un seul salon ouvert, avec ses droits
    Étant donné que Mireille travaille dans le salon "Go Beauty Akwa" dans deux onglets
    Quand elle demande en même temps "Go Beauty Bastos" dans un onglet et "Go Beauty Akwa" dans l'autre
    Alors sa session n'a qu'un salon ouvert, "Go Beauty Bastos" ou "Go Beauty Akwa"
    Et les droits appliqués à sa requête suivante sont ceux de ce salon-là

  @securite @RG-005-12
  Scénario: Une requête encore en cours ne ramène pas l'ancienne session
    Étant donné que Mireille travaille dans le salon "Go Beauty Akwa" et qu'une consultation de ce salon est en cours
    Quand Mireille passe au salon "Go Beauty Bastos" avant la fin de cette consultation
    Alors l'ancien identifiant de session reste refusé après la fin de la consultation
    Et Mireille ne se retrouve jamais dans "Go Beauty Akwa" sans l'avoir choisi

  @securite @RG-005-14 @EX-006
  Scénario: Une appartenance retirée pendant que le salon est ouvert cesse de compter aussitôt
    Étant donné que Paul est connecté et travaille dans le salon "Élégance Bonamoussadi"
    Et que Clarisse vient de retirer l'appartenance de Paul à son salon
    Quand Paul fait, dans ce salon, une action qui exige une permission
    Alors l'action est refusée avec le motif "Choisissez d’abord le salon sur lequel vous travaillez."
    Et "Élégance Bonamoussadi" ne figure plus dans la liste de ses salons

  @alternatif @securite @RG-005-13 @EX-011 @apres-UC-008
  Scénario: Un administrateur GoMeCoiffer ouvre son salon sans mélanger les rôles
    Étant donné que Serge Kamga a le rôle système "Administrateur Opérations" et est "Propriétaire" du salon "Salon Kamga Essos"
    Et que Serge s'est connecté à 9 h 00
    Quand Serge ouvre le salon "Salon Kamga Essos"
    Alors Serge a toujours le seul rôle système "Administrateur Opérations"
    Et sa session expire toujours au plus tard à 21 h 00, 12 heures après sa connexion

  @alternatif @RG-005-15 @EX-023
  Scénario: Changer de salon n'écrit rien au journal d'audit
    Étant donné que Mireille travaille dans le salon "Go Beauty Akwa"
    Quand Mireille passe au salon "Go Beauty Bastos"
    Alors le journal d'audit ne contient aucune ligne nouvelle

  @erreur @RG-005-06
  Scénario: Une panne pendant l'ouverture ne change rien
    Étant donné que Paul est connecté et travaille dans le salon "Paul Barber Deïdo"
    Et que le service GoMeCoiffer tombe en panne pendant la vérification de son appartenance
    Quand Paul ouvre le salon "Élégance Bonamoussadi"
    Alors l'ouverture est refusée avec le motif "Changement de salon impossible pour le moment. Réessayez dans quelques minutes."
    Et le salon ouvert dans sa session est toujours "Paul Barber Deïdo"
    Et son identifiant de session et son jeton de sécurité sont toujours acceptés
