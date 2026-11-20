# language: fr
@UC-009
Fonctionnalité: Accéder à son espace client par code SMS (compte client léger)
  Pour retrouver ses réservations sans mot de passe ni application,
  le client prouve son numéro par un code SMS ; une session client s'ouvre sur son navigateur.
  Un même numéro reste un seul utilisateur, mais un code SMS n'ouvre jamais le back-office d'un salon.

  Contexte:
    Étant donné que nous sommes le 20/11/2026 à 10 h 00, heure de Douala
    Et que les SMS sont envoyés normalement
    Et qu'aucun compte n'existe pour le 6 94 12 34 56
    Et qu'Aïcha Mbarga a un compte client léger pour le 6 55 44 33 22, vérifié le 02/11/2026
    Et que Paul Ebode a un compte du personnel avec le mot de passe "Bastos-Fade-2026" pour le 6 99 00 11 22
    Et que Paul est "Propriétaire" de "Paul Barber Deïdo"

  # --- Parcours nominal -------------------------------------------------------------------------

  @nominal @RG-009-05 @RG-009-07 @D-018 @EX-028
  Scénario: Une nouvelle cliente accède à son espace client avec le code reçu par SMS
    Étant donné que Nadège Fotso a reçu le code "482913" pour retrouver ses réservations au 6 94 12 34 56
    Quand Nadège saisit le code "482913"
    Alors Nadège est connectée à son espace client avec le 6 94 12 34 56
    Et un compte client léger existe pour le +237694123456, sans nom ni mot de passe
    Et aucun mot de passe ne lui a été demandé

  @nominal @RG-009-02
  Scénario: Le code d'accès client arrive par un SMS à texte fixe
    Quand Nadège demande un code pour retrouver ses réservations avec le "6 94 12 34 56" en acceptant les conditions
    Alors le 6 94 12 34 56 reçoit le SMS "GoMeCoiffer : votre code pour retrouver vos réservations est 482913. Il expire dans 5 minutes. Ne le communiquez à personne."

  @nominal @RG-009-05 @EX-001
  Scénario: Une cliente qui a déjà un compte client retrouve le même compte
    Étant donné qu'Aïcha a reçu le code "482913" pour retrouver ses réservations
    Quand Aïcha saisit le code "482913"
    Alors Aïcha est connectée à son espace client avec le 6 55 44 33 22
    Et il existe un seul compte pour le +237655443322

  # --- Non-énumération et séparation des espaces ----------------------------------------------

  @securite @RG-009-01 @D-019
  Plan du scénario: La demande de code reçoit la même réponse quel que soit le compte du numéro
    Quand on demande un code pour retrouver ses réservations avec le "<numéro>" en acceptant les conditions
    Alors la demande est acceptée et l'écran affiché est le même que pour le 6 94 12 34 56
    Et le <numéro> reçoit un SMS avec un code

    Exemples:
      | numéro        |
      | 6 94 12 34 56 |
      | 6 55 44 33 22 |
      | 6 99 00 11 22 |

  @securite @RG-009-10 @D-019 @EX-025
  Plan du scénario: La connexion client ne dit rien du compte du numéro
    Étant donné que le <numéro> a reçu le code "482913" pour retrouver ses réservations
    Quand on saisit le code "482913" pour le <numéro>
    Alors la réponse est de la même forme que pour le 6 94 12 34 56
    Et elle ne contient ni nom, ni salon, ni rôle, ni indication qu'un compte existait

    Exemples:
      | numéro        |
      | 6 55 44 33 22 |
      | 6 99 00 11 22 |

  @securite @RG-009-05 @RG-009-08 @D-017 @EX-001
  Scénario: Un membre du personnel qui vérifie son numéro comme client n'ouvre que son espace client
    Étant donné que Paul a reçu le code "482913" pour retrouver ses réservations
    Et que Paul a saisi le code "482913"
    Quand Paul ouvre le planning de "Paul Barber Deïdo"
    Alors l'accès est refusé avec le motif "Cet espace est réservé aux salons. Connectez-vous avec votre mot de passe, ou créez votre compte salon."
    Et Paul se connecte toujours avec "Bastos-Fade-2026" et reste "Propriétaire" de "Paul Barber Deïdo"

  @securite @RG-009-08 @EX-013 @EX-024
  Plan du scénario: Une session client n'ouvre aucun espace du salon ni de l'administration
    Étant donné qu'Aïcha est connectée à son espace client
    Quand Aïcha <action>
    Alors l'accès est refusé avec le motif "Cet espace est réservé aux salons. Connectez-vous avec votre mot de passe, ou créez votre compte salon."
    Et rien n'a changé

    Exemples:
      | action                                      |
      | crée son organisation "Aïcha Coiffure"      |
      | consulte le résumé de sa session de salon   |
      | ouvre le salon "Paul Barber Deïdo"          |
      | ouvre l'administration GoMeCoiffer          |

  @alternatif @RG-009-09
  Scénario: Un membre du personnel connecté par mot de passe ouvre son espace client sans code
    Étant donné que Paul est connecté avec son mot de passe
    Quand Paul ouvre son espace client
    Alors l'espace client de Paul s'affiche
    Et aucun code ne lui est envoyé

  @alternatif @RG-009-07 @RG-002-11
  Scénario: Vérifier son numéro sur la tablette du salon remplace la session qui y était ouverte
    Étant donné que Mireille Ndongo est connectée avec son mot de passe sur la tablette de "Go Beauty Akwa"
    Et qu'Aïcha a reçu le code "482913" pour retrouver ses réservations
    Quand Aïcha saisit le code "482913" sur cette tablette
    Alors la tablette est connectée à l'espace client d'Aïcha, avec un nouveau jeton de sécurité
    Et l'ancienne session de Mireille sur la tablette ne donne plus accès à rien

  # --- Demande du code : formats, conditions, limites -----------------------------------------

  @erreur @RG-009-01
  Plan du scénario: Seuls les numéros camerounais valides reçoivent un code
    Quand on demande un code pour retrouver ses réservations avec le "<numéro saisi>" en acceptant les conditions
    Alors la demande est <résultat>

    Exemples:
      | numéro saisi       | résultat                   |
      | 6 94 12 34 56      | acceptée                   |
      | +237 6 94 12 34 56 | acceptée                   |
      | 6 94 12 34 5       | refusée : numéro mal formé |
      | +33 6 12 34 56 78  | refusée : numéro mal formé |

  @erreur @RG-009-01 @D-022
  Scénario: Les conditions d'utilisation doivent être acceptées pour recevoir un code
    Quand Nadège demande un code pour retrouver ses réservations avec le "6 94 12 34 56" sans accepter les conditions
    Alors la demande est refusée avec le motif "Acceptez les conditions d'utilisation pour continuer."
    Et aucun SMS n'est envoyé au 6 94 12 34 56

  @erreur @RG-009-01
  Scénario: Une demande de code sans jeton de sécurité est refusée sans rien compter
    Quand on demande un code pour retrouver ses réservations avec le "6 94 12 34 56" sans jeton de sécurité
    Alors la demande est refusée avec le motif "Jeton de sécurité absent ou expiré : rechargez la page puis recommencez."
    Et aucun SMS n'est envoyé au 6 94 12 34 56

  @erreur @RG-009-03 @D-021
  Plan du scénario: Un nouveau code ne peut être demandé qu'après 60 secondes
    Étant donné que Nadège a reçu un code pour retrouver ses réservations à 10 h 00 min 00 s
    Quand Nadège demande un nouveau code à <heure>
    Alors la demande est <résultat>

    Exemples:
      | heure            | résultat                                 |
      | 10 h 00 min 59 s | refusée : nouveau code possible dans 1 s |
      | 10 h 01 min 00 s | acceptée                                 |

  @erreur @RG-009-03 @D-021 @D-023
  Plan du scénario: Au plus 5 codes par heure et 10 codes par 24 heures pour un même numéro
    Étant donné que <envois> ont été envoyés au 6 94 12 34 56 pour retrouver ses réservations
    Quand Nadège demande un code pour retrouver ses réservations à 10 h 00
    Alors la demande est <résultat>

    Exemples:
      | envois                                            | résultat                |
      | 4 codes depuis 9 h 10                             | acceptée                |
      | 5 codes depuis 9 h 10                             | refusée : trop de codes |
      | 9 codes depuis hier 11 h 00, le dernier à 8 h 00  | acceptée                |
      | 10 codes depuis hier 11 h 00, le dernier à 8 h 00 | refusée : trop de codes |

  @securite @RG-009-03 @D-023
  Scénario: Après 10 codes faux en 24 heures, plus aucun code d'accès client n'est envoyé
    Étant donné que 10 codes faux pour retrouver ses réservations ont été saisis pour le 6 94 12 34 56 depuis hier 11 h 00
    Quand Nadège demande un code pour retrouver ses réservations à 10 h 00
    Alors la demande est refusée avec le motif "Trop de codes demandés pour ce numéro. Réessayez dans une heure ou contactez l'assistance."

  @securite @RG-009-02 @RG-009-03 @D-023
  Scénario: Les codes d'un autre motif ne comptent pas et n'ouvrent pas l'espace client
    Étant donné que 5 codes d'inscription ont été demandés pour le 6 94 12 34 56 depuis 9 h 10, le dernier étant "105377"
    Et que Nadège a reçu le code "482913" pour retrouver ses réservations à 10 h 00
    Quand Nadège saisit le code "105377" pour retrouver ses réservations
    Alors la vérification est refusée avec le motif "Code incorrect. Il vous reste 4 essais."

  @securite @RG-009-03
  Scénario: Des demandes de code simultanées n'envoient qu'un seul SMS
    Quand 5 demandes de code pour retrouver ses réservations avec le "6 94 12 34 56" arrivent en même temps
    Alors un seul SMS est envoyé au 6 94 12 34 56
    Et les 4 autres demandes sont refusées pour renvoi trop tôt

  @erreur @RG-009-04 @D-021
  Scénario: Une panne du fournisseur SMS est annoncée et ne compte pas dans les limites
    Étant donné que le fournisseur SMS est indisponible
    Et que Nadège a demandé un code pour retrouver ses réservations à 10 h 00
    Et que la demande a été refusée avec le motif "L'envoi du SMS est impossible pour le moment. Réessayez dans quelques minutes."
    Et que le fournisseur SMS fonctionne de nouveau
    Quand Nadège demande un code pour retrouver ses réservations à 10 h 00 min 30 s
    Alors la demande est acceptée

  # --- Vérification du code --------------------------------------------------------------------

  @erreur @RG-009-02
  Plan du scénario: Un code d'accès client n'est valable que 5 minutes
    Étant donné que Nadège a reçu le code "482913" à 10 h 00 min 00 s
    Quand Nadège saisit le code "482913" à <heure>
    Alors la vérification est <résultat>

    Exemples:
      | heure            | résultat              |
      | 10 h 04 min 59 s | acceptée              |
      | 10 h 05 min 00 s | refusée : code expiré |

  @securite @RG-009-02
  Scénario: Après 5 codes faux, même le bon code est refusé
    Étant donné que Nadège a reçu le code "482913"
    Et que 5 codes faux ont été saisis pour ce code
    Quand Nadège saisit le code "482913"
    Alors la vérification est refusée avec le motif "Trop d'essais. Demandez un nouveau code."
    Et aucun compte n'existe pour le 6 94 12 34 56

  @alternatif @RG-009-02
  Scénario: Un nouveau code annule le précédent
    Étant donné que Nadège a reçu le code "482913" à 10 h 00
    Et qu'elle a reçu le code "105377" à 10 h 01
    Quand Nadège saisit le code "482913"
    Alors la vérification est refusée avec le motif "Code incorrect. Il vous reste 4 essais."

  @securite @RG-009-14 @EX-001
  Scénario: Deux vérifications simultanées ne créent qu'un compte
    Étant donné que Nadège a reçu le code "482913" pour retrouver ses réservations
    Quand deux vérifications du code "482913" pour le 6 94 12 34 56 arrivent en même temps
    Alors une seule réussit
    Et l'autre est refusée avec le motif "Ce code n'est plus valable. Demandez un nouveau code."
    Et il existe un seul compte pour le +237694123456

  @erreur @RG-009-15
  Scénario: Une panne pendant la vérification ne crée rien et laisse le code utilisable
    Étant donné que Nadège a reçu le code "482913" pour retrouver ses réservations
    Et que le service GoMeCoiffer tombe en panne pendant l'enregistrement de la vérification
    Quand Nadège saisit le code "482913"
    Alors la vérification est refusée avec le motif "Connexion impossible pour le moment. Réessayez dans quelques minutes."
    Et aucun compte n'existe pour le 6 94 12 34 56
    Et le code "482913" est encore accepté juste après

  # --- Numéro recyclé ---------------------------------------------------------------------------

  @securite @RG-009-06 @EX-025
  Plan du scénario: Un numéro resté plus de 180 jours sans preuve change de titulaire présumé
    Étant donné que le 6 75 31 42 00 est le compte client de Jeanne Ewane, dont la dernière preuve du numéro date du <dernière preuve>
    Et que le 6 75 31 42 00 a reçu le code "482913" pour retrouver ses réservations
    Quand on saisit le code "482913" pour le 6 75 31 42 00
    Alors le titulaire du 6 75 31 42 00 est considéré comme <titulaire>

    Exemples:
      | dernière preuve          | titulaire                                   |
      | 24/05/2026 à 10 h 00     | inchangé                                    |
      | 24/05/2026 à 9 h 59 min 59 s | nouveau depuis le 20/11/2026 à 10 h 00  |
      | 10/04/2026 à 15 h 00     | nouveau depuis le 20/11/2026 à 10 h 00      |

  @securite @RG-009-06 @lot-4
  Scénario: Le nouveau titulaire d'un numéro recyclé ne voit pas les réservations de l'ancien
    Étant donné que Jeanne Ewane a réservé une "Coupe femme" chez "Go Beauty Akwa" le 05/04/2026 avec le 6 75 31 42 00
    Et que la dernière preuve du 6 75 31 42 00 date du 10/04/2026
    Quand le nouveau titulaire du 6 75 31 42 00 accède à son espace client avec le code reçu par SMS
    Alors son espace client ne montre aucune réservation
    Et "Go Beauty Akwa" voit toujours la réservation du 05/04/2026

  # --- Session client ---------------------------------------------------------------------------

  @erreur @RG-009-11
  Plan du scénario: Une session client expire après 7 jours sans activité et 30 jours après la vérification
    Étant donné qu'Aïcha s'est connectée à son espace client le 20/11/2026 à 10 h 00
    Et que <activité>
    Quand Aïcha ouvre son espace client le <instant>
    Alors l'accès est <résultat>

    Exemples:
      | activité                        | instant              | résultat                                                       |
      | elle n'a rien fait depuis       | 27/11/2026 à 9 h 59  | accordé                                                        |
      | elle n'a rien fait depuis       | 27/11/2026 à 10 h 01 | refusé : "Session absente ou expirée : reconnectez-vous."      |
      | elle a ouvert son espace chaque jour | 20/12/2026 à 9 h 59  | accordé                                                   |
      | elle a ouvert son espace chaque jour | 20/12/2026 à 10 h 01 | refusé : "Session absente ou expirée : reconnectez-vous." |

  @nominal @RG-009-12
  Scénario: La déconnexion ferme la session client
    Étant donné qu'Aïcha est connectée à son espace client
    Quand Aïcha se déconnecte
    Alors on lui indique "Vous êtes déconnecté."
    Et son ancien cookie de session ne donne plus accès à son espace client

  @securite @RG-009-13 @D-031
  Scénario: Une réinitialisation du mot de passe ferme aussi les sessions client du compte
    Étant donné que Paul est connecté à son espace client sur son téléphone, par code SMS
    Quand Paul réinitialise son mot de passe sur la tablette du salon
    Alors la session client de son téléphone ne donne plus accès à son espace client

  # --- Audit ------------------------------------------------------------------------------------

  @securite @RG-009-16 @EX-023 @EX-025
  Scénario: La création du compte client et la connexion sont tracées sans numéro ni code
    Étant donné que Nadège a reçu le code "482913" pour retrouver ses réservations
    Quand Nadège saisit le code "482913"
    Alors le journal d'audit contient "compte client créé" et "connexion client" pour le compte de Nadège à 10 h 00
    Et aucune de ces lignes ne contient le numéro 6 94 12 34 56 ni le code
