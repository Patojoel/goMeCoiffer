# language: fr
@UC-010
Fonctionnalité: Ajouter un salon à son organisation
  Pour gérer plusieurs établissements avec un seul compte utilisateur,
  le propriétaire d'une organisation ajoute un nouveau salon à son organisation :
  il en devient aussitôt propriétaire, le salon reçoit les permissions par défaut des quatre rôles de collaborateur,
  s'ouvre dans sa session et reste invisible des clients jusqu'à sa publication.

  Contexte:
    Étant donné que nous sommes le 20/11/2026 à 10 h 00, heure de Douala
    Et que l'organisation de Mireille Ndongo possède le salon "Go Beauty Akwa"
    Et que l'organisation de Clarisse Fotso possède le salon "Élégance Bonamoussadi"
    Et que les appartenances actives sont :
      | personne        | salon                 | rôle                              |
      | Mireille Ndongo | Go Beauty Akwa        | Propriétaire                      |
      | Rodrigue Etoa   | Go Beauty Akwa        | Administrateur de salon           |
      | Awa Tchoua      | Go Beauty Akwa        | Coiffeur / Coiffeuse / Barbier    |
      | Hortense Mballa | Go Beauty Akwa        | Responsable financier             |
      | Clarisse Fotso  | Élégance Bonamoussadi | Propriétaire                      |
      | Paul Ebode      | Élégance Bonamoussadi | Coiffeur / Coiffeuse / Barbier    |
      | Paul Ebode      | Paul Barber Deïdo     | Propriétaire                      |
    Et que Mireille est connectée et travaille dans le salon "Go Beauty Akwa"
    Et que le nouveau salon à ajouter est décrit ainsi :
      | nom commercial  | Go Beauty Bastos                                  |
      | type            | mixte                                             |
      | ville           | Yaoundé                                           |
      | quartier        | Bastos                                            |
      | point de repère | Avenue Jean-Paul II, face à l'ambassade de Chine  |
      | téléphone       | 6 91 22 33 44                                     |

  @nominal @RG-010-03 @RG-010-08 @RG-010-09 @EX-002 @EX-003 @EX-005 @EX-008 @EX-030 @EX-033 @EX-034
  Scénario: Une propriétaire ajoute un deuxième salon à son organisation
    Quand Mireille ajoute ce salon à son organisation
    Alors le salon "Go Beauty Bastos" est rattaché à l'organisation de Mireille, à l'heure de Douala
    Et le salon "Go Beauty Bastos" n'est pas publié et ne reprend rien de "Go Beauty Akwa"
    Et Mireille est "Propriétaire" du salon "Go Beauty Bastos" et reste "Propriétaire" de "Go Beauty Akwa"
    Et le nom de l'organisation de Mireille reste "Go Beauty Akwa"

  @nominal @RG-010-09 @EX-016 @D-038 @D-051
  Scénario: Le nouveau salon reçoit les permissions par défaut des quatre rôles, pas les réglages d'un autre salon
    Étant donné que Mireille a ajouté "Finances : consulter" au rôle "Administrateur de salon" dans "Go Beauty Akwa"
    Quand Mireille ajoute ce salon à son organisation
    Alors les quatre rôles de collaborateur de "Go Beauty Bastos" ont exactement leurs permissions par défaut
    Et le rôle "Administrateur de salon" de "Go Beauty Bastos" n'a pas "Finances : consulter"

  @nominal @RG-010-10 @RG-010-11 @EX-009 @D-003
  Scénario: Le nouveau salon s'ouvre dans la session et figure dans la liste des salons
    Quand Mireille ajoute ce salon à son organisation
    Alors le salon ouvert dans la session de Mireille est "Go Beauty Bastos"
    Et sa liste de salons contient "Go Beauty Akwa" et "Go Beauty Bastos", chacun avec le rôle "Propriétaire"
    Et Mireille peut aussitôt agir dans "Go Beauty Bastos" comme propriétaire

  @securite @RG-010-10 @D-037 @D-039 @D-004
  Scénario: L'ajout d'un salon régénère la session et ferme le suivi en direct de l'ancien salon
    Étant donné que Mireille s'est connectée à 9 h 00 et suit "Go Beauty Akwa" en direct sur son téléphone
    Et que Mireille suit aussi "Go Beauty Akwa" en direct sur la tablette du salon
    Quand Mireille ajoute ce salon à son organisation depuis son téléphone
    Alors sa session sur son téléphone reçoit un nouvel identifiant et un nouveau jeton de sécurité
    Et l'ancien identifiant de session et l'ancien jeton de sécurité sont refusés ensuite
    Et sa session expire toujours le 27/11/2026 à 9 h 00, 7 jours après sa connexion
    Et le suivi en direct de son téléphone s'arrête, tandis que la tablette continue de suivre "Go Beauty Akwa"

  @alternatif @RG-010-03 @EX-002 @EX-003
  Scénario: Une propriétaire ajoute un troisième salon à son organisation
    Étant donné que Mireille a déjà ajouté le salon "Go Beauty Bastos" à son organisation
    Quand Mireille ajoute à son organisation le salon "Go Beauty Biyem-Assi", de type "salon de coiffure", à "Yaoundé", quartier "Biyem-Assi", repère "Carrefour Biyem-Assi, à côté de la boulangerie Select", téléphone "6 78 55 44 33"
    Alors l'organisation de Mireille compte trois salons : "Go Beauty Akwa", "Go Beauty Bastos" et "Go Beauty Biyem-Assi"
    Et Mireille est "Propriétaire" de chacun des trois salons

  @alternatif @RG-010-02 @D-035
  Scénario: Une autre organisation peut ajouter un salon du même nom
    Étant donné que Mireille a déjà ajouté le salon "Go Beauty Bastos" à son organisation
    Et que Clarisse est connectée et travaille dans le salon "Élégance Bonamoussadi"
    Quand Clarisse ajoute à son organisation un salon nommé "Go Beauty Bastos" avec des informations valides
    Alors le salon "Go Beauty Bastos" est créé dans l'organisation de Clarisse
    Et Clarisse ne voit pas le salon "Go Beauty Bastos" de Mireille

  @alternatif @RG-010-04
  Scénario: Les espaces en trop du nom commercial sont retirés avant enregistrement
    Quand Mireille ajoute ce salon à son organisation, mais dont le nom commercial est "  Go   Beauty  Bastos  "
    Alors le salon "Go Beauty Bastos" est rattaché à l'organisation de Mireille

  @alternatif @RG-010-11 @EX-021 @D-027
  Scénario: À la connexion suivante, la propriétaire choisit parmi ses salons
    Étant donné que Mireille a ajouté le salon "Go Beauty Bastos" puis s'est déconnectée
    Quand Mireille se connecte le lendemain avec son mot de passe
    Alors aucun salon n'est ouvert dans sa session
    Et on l'invite à choisir son salon parmi "Go Beauty Akwa" et "Go Beauty Bastos"

  @alternatif @securite @RG-010-13 @EX-011 @EX-012 @apres-UC-012
  Scénario: Un administrateur GoMeCoiffer propriétaire ajoute un salon à sa propre organisation sans mélanger les rôles
    Étant donné que Serge Kamga a le rôle système "Administrateur Opérations" et est "Propriétaire" de "Salon Kamga Essos"
    Et que Serge est connecté et travaille dans "Salon Kamga Essos"
    Quand Serge ajoute ce salon à son organisation, mais dont le nom commercial est "Salon Kamga Mvog-Mbi"
    Alors Serge est "Propriétaire" de "Salon Kamga Mvog-Mbi"
    Et Serge a toujours le seul rôle système "Administrateur Opérations"
    Et sa session expire toujours au plus tard 12 heures après sa connexion

  @securite @RG-010-08 @EX-005 @EX-006
  Scénario: Les collaborateurs des autres salons de l'organisation n'obtiennent aucun accès au nouveau salon
    Quand Mireille ajoute ce salon à son organisation
    Alors Rodrigue, Awa et Hortense ne voient pas "Go Beauty Bastos" dans leur liste de salons
    Et aucun d'eux ne peut ouvrir "Go Beauty Bastos"

  @erreur @RG-010-02 @D-035
  Plan du scénario: Deux salons d'une même organisation ne peuvent pas porter le même nom
    Quand Mireille ajoute ce salon à son organisation, mais dont le nom commercial est <nom>
    Alors l'ajout est refusé avec le motif "Votre organisation a déjà un salon nommé « Go Beauty Akwa ». Choisissez un autre nom."
    Et l'organisation de Mireille ne compte toujours que le salon "Go Beauty Akwa"
    Et le salon ouvert dans la session de Mireille reste "Go Beauty Akwa"

    Exemples:
      | nom                    |
      | "Go Beauty Akwa"       |
      | "go beauty akwa"       |
      | "  Go   Beauty  Akwa " |

  @securite @RG-010-02 @D-035
  Scénario: Deux ajouts simultanés du même nom dans la même organisation ne créent qu'un salon
    Quand deux ajouts du salon "Go Beauty Bastos" par Mireille arrivent en même temps
    Alors un seul réussit
    Et l'autre est refusé avec le motif "Votre organisation a déjà un salon nommé « Go Beauty Bastos ». Choisissez un autre nom."
    Et l'organisation de Mireille ne compte qu'un seul salon "Go Beauty Bastos"

  @erreur @RG-010-04 @RG-010-05 @RG-010-06 @RG-010-07 @EX-030 @D-036
  Plan du scénario: Les six informations obligatoires du nouveau salon sont contrôlées
    Quand Mireille ajoute ce salon à son organisation, mais dont le <champ> est <valeur>
    Alors l'ajout est <résultat>

    Exemples:
      | champ           | valeur                      | résultat                                        |
      | nom commercial  | "G"                         | refusé : nom de 2 à 60 caractères               |
      | nom commercial  | "GB"                        | accepté                                         |
      | nom commercial  | un texte de 60 caractères   | accepté                                         |
      | nom commercial  | un texte de 61 caractères   | refusé : nom de 2 à 60 caractères               |
      | type            | "institut de manucure"      | refusé : type de salon à choisir dans la liste  |
      | type            | "barber shop"               | accepté                                         |
      | ville           | "Paris"                     | refusé : ville à choisir dans la liste          |
      | quartier        | "A"                         | refusé : quartier de 2 à 60 caractères          |
      | point de repère | un texte de 4 caractères    | refusé : point de repère de 5 à 160 caractères  |
      | point de repère | un texte de 5 caractères    | accepté                                         |
      | point de repère | un texte de 161 caractères  | refusé : point de repère de 5 à 160 caractères  |
      | téléphone       | "6 91 22 33 4"              | refusé : numéro camerounais de 9 chiffres       |
      | téléphone       | "+33 6 12 34 56 78"         | refusé : numéro camerounais de 9 chiffres       |
      | téléphone       | "6 77 12 34 56"             | accepté                                         |
      | téléphone       | "+237 2 22 20 15 10"        | accepté                                         |

  @securite @RG-010-12 @EX-024 @EX-012
  Plan du scénario: Les informations fixées par GoMeCoiffer ne peuvent pas être imposées dans la demande
    Quand Mireille ajoute ce salon à son organisation en indiquant aussi <information>
    Alors l'ajout est refusé avec le motif "Certaines informations sont invalides : corrigez les champs signalés."
    Et aucun nouveau salon n'est créé

    Exemples:
      | information                              |
      | l'organisation de Clarisse Fotso         |
      | Clarisse Fotso comme propriétaire        |
      | le statut « publié »                     |
      | le fuseau « Europe/Paris »               |
      | le rôle système « Super Administrateur » |

  @securite @RG-010-01 @EX-014 @EX-017 @EX-033 @D-050
  Plan du scénario: Seul le propriétaire de l'organisation peut ajouter un salon, jamais un collaborateur
    Étant donné que <situation>
    Et que <personne> est connecté et travaille dans le salon "<salon actif>"
    Quand <personne> ajoute ce salon à l'organisation
    Alors l'ajout est refusé avec le motif "Votre rôle dans ce salon ne permet pas cette action : demandez-la au propriétaire."
    Et aucun nouveau salon n'est créé

    Exemples:
      | personne | salon actif           | situation                                                                        |
      | Rodrigue | Go Beauty Akwa        | Rodrigue a toutes les 16 permissions ajustables dans "Go Beauty Akwa"            |
      | Awa      | Go Beauty Akwa        | Awa est "Coiffeur / Coiffeuse / Barbier" dans "Go Beauty Akwa"                   |
      | Hortense | Go Beauty Akwa        | Hortense est "Responsable financier" dans "Go Beauty Akwa"                       |
      | Paul     | Élégance Bonamoussadi | Paul est propriétaire de "Paul Barber Deïdo", mais travaille dans le salon de Clarisse |

  @erreur @RG-010-01 @EX-009 @D-003
  Scénario: Sans salon ouvert, l'ajout d'un salon est refusé
    Étant donné que Mireille est connectée, sans salon ouvert
    Quand Mireille ajoute ce salon à son organisation
    Alors l'ajout est refusé avec le motif "Choisissez d’abord le salon sur lequel vous travaillez."
    Et aucun nouveau salon n'est créé

  @erreur @RG-010-01 @EX-019 @D-035
  Scénario: Un utilisateur sans organisation ne peut pas ajouter de salon
    Étant donné que Nadège Fouda a un compte du personnel sans organisation
    Quand on tente d'ajouter ce salon à l'organisation de Nadège
    Alors l'ajout est refusé avec le motif "Créez d'abord votre organisation et votre premier salon."
    Et aucun salon n'est créé

  @securite @RG-010-01 @EX-013 @D-054 @D-055
  Scénario: Une session client ne permet jamais d'ajouter un salon, même pour une propriétaire
    Étant donné que Mireille a ouvert une session client par code SMS sur ce navigateur
    Quand Mireille ajoute ce salon à son organisation
    Alors l'ajout est refusé avec le motif "Cet espace est réservé aux salons : connectez-vous avec votre mot de passe."
    Et aucun nouveau salon n'est créé

  @erreur @RG-010-01
  Scénario: Sans session, aucun salon n'est ajouté
    Étant donné que la session de Mireille a expiré
    Quand Mireille ajoute ce salon à son organisation
    Alors l'ajout est refusé avec le motif "Session absente ou expirée : reconnectez-vous."
    Et aucun nouveau salon n'est créé

  @erreur @RG-010-01 @EX-024
  Scénario: Un ajout sans jeton de sécurité est refusé
    Quand Mireille ajoute ce salon à son organisation sans jeton de sécurité
    Alors l'ajout est refusé avec le motif "Jeton de sécurité absent ou expiré : rechargez la page puis recommencez."
    Et aucun nouveau salon n'est créé
    Et le salon ouvert dans la session de Mireille reste "Go Beauty Akwa"

  @securite @RG-010-14 @EX-023 @EX-025
  Scénario: L'ajout d'un salon est tracé dans le journal d'audit sans donnée personnelle
    Quand Mireille ajoute ce salon à son organisation
    Alors le journal d'audit contient « salon ajouté à l'organisation » et « appartenance de propriétaire accordée » à 10 h 00 pour Mireille et le salon "Go Beauty Bastos"
    Et ni le téléphone commercial, ni le point de repère, ni le numéro de Mireille n'y figurent

  @erreur @RG-010-15
  Scénario: Une panne pendant l'ajout ne laisse rien à moitié et ne change pas la session
    Étant donné que le service GoMeCoiffer tombe en panne pendant l'enregistrement du nouveau salon
    Quand Mireille ajoute ce salon à son organisation
    Alors l'ajout est refusé avec le motif "Ajout du salon impossible pour le moment. Réessayez dans quelques minutes."
    Et le salon "Go Beauty Bastos" n'existe pas, ni appartenance ni réglage de rôle associé
    Et le salon ouvert dans la session de Mireille reste "Go Beauty Akwa"
    Et l'identifiant de session et le jeton de sécurité de Mireille sont toujours acceptés

