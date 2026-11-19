# language: fr
@UC-004
Fonctionnalité: Créer son organisation et son premier salon
  Pour commencer à configurer son établissement,
  un utilisateur connecté sans organisation enregistre son premier salon :
  il devient propriétaire, le salon s'ouvre dans sa session et reste invisible des clients jusqu'à sa publication.

  Contexte:
    Étant donné que nous sommes le 19/11/2026 à 10 h 00, heure de Douala
    Et que Mireille Ndongo a un compte propriétaire pour le 6 77 12 34 56, sans organisation
    Et que Mireille est connectée
    Et que le salon à créer est décrit ainsi :
      | nom commercial  | Go Beauty Akwa                            |
      | type            | mixte                                     |
      | ville           | Douala                                    |
      | quartier        | Akwa                                      |
      | point de repère | Rue Joffre, face à la pharmacie du Centre |
      | téléphone       | 6 99 88 77 66                             |

  @nominal @RG-004-03 @RG-004-09 @RG-004-10 @EX-019 @EX-030 @EX-033 @EX-034
  Scénario: Une propriétaire crée son organisation et son premier salon en une seule fois
    Quand Mireille crée son organisation avec ce salon
    Alors l'organisation "Go Beauty Akwa" existe, avec Mireille pour propriétaire
    Et le salon "Go Beauty Akwa" lui est rattaché, à l'heure de Douala
    Et le salon "Go Beauty Akwa" n'est pas publié
    Et Mireille est "Propriétaire" du salon "Go Beauty Akwa"

  @nominal @RG-004-11 @RG-004-12 @EX-009 @D-003
  Scénario: Le salon créé est ouvert dans la session, sans nouvelle connexion
    Quand Mireille crée son organisation avec ce salon
    Alors le salon ouvert dans la session de Mireille est "Go Beauty Akwa"
    Et son résumé de session liste le salon "Go Beauty Akwa" avec le rôle "Propriétaire"

  @securite @RG-004-11 @D-037 @D-004
  Scénario: Devenir propriétaire régénère la session
    Étant donné que Mireille s'est connectée à 9 h 00
    Quand Mireille crée son organisation avec ce salon
    Alors sa session reçoit un nouvel identifiant et un nouveau jeton de sécurité
    Et l'ancien identifiant de session et l'ancien jeton de sécurité sont refusés ensuite
    Et sa session expire toujours le 26/11/2026 à 9 h 00, 7 jours après sa connexion

  @nominal @RG-004-10 @RG-004-11 @EX-008
  Scénario: La propriétaire peut agir dans son salon dès sa création
    Étant donné que Mireille a créé son organisation avec ce salon
    Quand Mireille fait, dans le salon "Go Beauty Akwa", une action qui exige la permission "gérer les réservations"
    Alors l'action est permise

  @erreur @RG-004-04 @RG-004-05 @RG-004-06 @RG-004-07 @RG-004-08 @EX-030
  Plan du scénario: Les informations du salon sont contrôlées
    Quand Mireille crée son organisation avec ce salon, mais dont le <champ> est <valeur>
    Alors la création est <résultat>

    Exemples:
      | champ           | valeur                      | résultat                                         |
      | nom commercial  | "G"                         | refusée : nom de 2 à 60 caractères               |
      | nom commercial  | "GB"                        | acceptée                                         |
      | nom commercial  | un texte de 60 caractères   | acceptée                                         |
      | nom commercial  | un texte de 61 caractères   | refusée : nom de 2 à 60 caractères               |
      | type            | "institut de manucure"      | refusée : type de salon à choisir dans la liste  |
      | type            | "barber shop"               | acceptée                                         |
      | ville           | "Paris"                     | refusée : ville à choisir dans la liste          |
      | quartier        | "A"                         | refusée : quartier de 2 à 60 caractères          |
      | point de repère | un texte de 4 caractères    | refusée : point de repère de 5 à 160 caractères  |
      | point de repère | un texte de 5 caractères    | acceptée                                         |
      | point de repère | un texte de 161 caractères  | refusée : point de repère de 5 à 160 caractères  |
      | téléphone       | "6 99 88 77 6"              | refusée : numéro camerounais de 9 chiffres       |
      | téléphone       | "+33 6 12 34 56 78"         | refusée : numéro camerounais de 9 chiffres       |
      | téléphone       | "6 77 12 34 56"             | acceptée                                         |
      | téléphone       | "+237 2 33 42 10 10"        | acceptée                                         |

  @erreur @RG-004-16
  Scénario: Une création refusée ne crée rien
    Quand Mireille crée son organisation avec ce salon, mais dont le nom commercial est "G"
    Alors la création est refusée
    Et Mireille n'a toujours ni organisation ni salon
    Et aucun salon n'est ouvert dans sa session

  @alternatif @RG-004-04
  Scénario: Les espaces en trop du nom commercial sont retirés
    Quand Mireille crée son organisation avec ce salon, mais dont le nom commercial est "  Go   Beauty  Akwa  "
    Alors Mireille est "Propriétaire" du salon "Go Beauty Akwa"

  @erreur @RG-004-02
  Scénario: Un utilisateur ne possède qu'une seule organisation
    Étant donné que Mireille a créé son organisation avec ce salon
    Quand Mireille crée son organisation avec ce salon, mais dont le nom commercial est "Go Beauty Bastos"
    Alors la création est refusée
    Et le motif indiqué est "Vous avez déjà une organisation. Ouvrez votre salon pour continuer."
    Et Mireille n'a toujours qu'une organisation, avec le seul salon "Go Beauty Akwa"

  @securite @RG-004-02
  Scénario: Deux envois simultanés ne créent qu'une organisation
    Quand deux créations d'organisation de Mireille avec ce salon arrivent en même temps
    Alors une seule réussit
    Et l'autre est refusée avec le motif "Vous avez déjà une organisation. Ouvrez votre salon pour continuer."
    Et Mireille a une seule organisation, un seul salon et une seule appartenance

  @securite @RG-004-13 @EX-024 @EX-012
  Plan du scénario: Les informations fixées par GoMeCoiffer ne peuvent pas être imposées dans la demande
    Quand Mireille crée son organisation avec ce salon en indiquant aussi <information>
    Alors la création est refusée
    Et Mireille n'a toujours ni organisation ni salon

    Exemples:
      | information                                 |
      | Paul Ebode comme propriétaire               |
      | l'organisation d'un autre propriétaire      |
      | le statut « publié »                        |
      | le fuseau « Europe/Paris »                  |
      | le rôle système « Super Administrateur »    |

  @securite @RG-004-14 @EX-011 @EX-012
  Scénario: Créer une organisation ne donne aucun accès à l'administration GoMeCoiffer
    Étant donné que Mireille a créé son organisation avec ce salon
    Quand Mireille ouvre l'administration GoMeCoiffer
    Alors l'accès est refusé avec le motif "Action réservée à l’équipe GoMeCoiffer."
    Et Mireille n'a aucun rôle système

  @alternatif @RG-004-10 @RG-004-11 @EX-002
  Scénario: Un coiffeur qui travaille dans un autre salon crée sa propre organisation
    Étant donné que Paul Ebode est "Coiffeur" du salon "Élégance Bonamoussadi" de Clarisse Fotso
    Et que Paul est connecté, sans organisation
    Quand Paul crée son organisation avec ce salon, mais dont le nom commercial est "Paul Barber Deïdo"
    Alors Paul est "Propriétaire" du salon "Paul Barber Deïdo"
    Et Paul est toujours "Coiffeur" du salon "Élégance Bonamoussadi"
    Et le salon ouvert dans la session de Paul est "Paul Barber Deïdo"

  @securite @RG-004-10 @EX-005 @EX-006
  Scénario: Le propriétaire du salon où travaille un coiffeur n'obtient aucun droit sur le salon que ce coiffeur crée
    Étant donné que Paul Ebode est "Coiffeur" du salon "Élégance Bonamoussadi" de Clarisse Fotso
    Et que Paul a créé son organisation avec le salon "Paul Barber Deïdo"
    Quand Clarisse consulte son résumé de session
    Alors seul le salon "Élégance Bonamoussadi" y figure

  @alternatif @RG-004-12 @EX-021 @D-027
  Plan du scénario: L'étape proposée à la connexion suivante dépend des salons de l'utilisateur
    Étant donné que <personne> a créé son organisation avec le salon "<salon>" puis s'est déconnecté
    Et que <autres salons>
    Quand <personne> se connecte le lendemain avec son mot de passe
    Alors on l'invite à <étape suivante>

    Exemples:
      | personne | salon             | autres salons                                          | étape suivante                      |
      | Mireille | Go Beauty Akwa    | Mireille n'appartient à aucun autre salon              | ouvrir le salon "Go Beauty Akwa"    |
      | Paul     | Paul Barber Deïdo | Paul est "Coiffeur" du salon "Élégance Bonamoussadi"   | choisir son salon                   |

  @alternatif @securite @RG-004-14 @EX-011 @apres-UC-008
  Scénario: Un administrateur GoMeCoiffer peut créer sa propre organisation sans mélanger les rôles
    Étant donné que Serge Kamga a le rôle système "Administrateur Opérations" et aucune organisation
    Et que Serge est connecté
    Quand Serge crée son organisation avec ce salon, mais dont le nom commercial est "Salon Kamga Essos"
    Alors Serge est "Propriétaire" du salon "Salon Kamga Essos"
    Et Serge a toujours le seul rôle système "Administrateur Opérations"
    Et à sa prochaine connexion, on l'invite à ouvrir l'administration GoMeCoiffer

  @erreur @RG-004-01
  Scénario: Sans session, aucune organisation n'est créée
    Étant donné que la session de Mireille a expiré
    Quand Mireille crée son organisation avec ce salon
    Alors la création est refusée
    Et le motif indiqué est "Session absente ou expirée : reconnectez-vous."
    Et Mireille n'a toujours ni organisation ni salon

  @erreur @RG-004-01 @EX-024
  Scénario: Une création sans jeton de sécurité est refusée
    Quand Mireille crée son organisation avec ce salon sans jeton de sécurité
    Alors la création est refusée
    Et le motif indiqué est "Jeton de sécurité absent ou expiré : rechargez la page puis recommencez."
    Et Mireille n'a toujours ni organisation ni salon

  @erreur @RG-004-01 @D-018 @apres-UC-009
  Scénario: Un compte client léger ne crée pas d'organisation
    Étant donné qu'Aïcha Mbarga a un compte client léger pour le 6 55 44 33 22 et une session client ouverte
    Quand Aïcha crée son organisation avec ce salon
    Alors la création est refusée
    Et le motif indiqué est "Créez d'abord votre compte salon avec un mot de passe, puis votre organisation."
    Et Aïcha n'a ni organisation ni salon

  @securite @RG-004-15 @EX-023 @EX-025
  Scénario: La création est tracée sans donnée personnelle
    Quand Mireille crée son organisation avec ce salon
    Alors le journal d'audit contient "organisation créée" et "appartenance de propriétaire accordée" à 10 h 00 pour Mireille et le salon "Go Beauty Akwa"
    Et ni le téléphone commercial, ni le point de repère, ni le numéro de Mireille n'y figurent

  @erreur @RG-004-16
  Scénario: Une panne pendant la création ne laisse rien à moitié
    Étant donné que le service GoMeCoiffer tombe en panne pendant l'enregistrement
    Quand Mireille crée son organisation avec ce salon
    Alors la création est refusée
    Et le motif indiqué est "Création impossible pour le moment. Réessayez dans quelques minutes."
    Et Mireille n'a ni organisation, ni salon, ni appartenance
    Et aucun salon n'est ouvert dans sa session
