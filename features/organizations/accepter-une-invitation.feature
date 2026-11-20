# language: fr
@UC-007
Fonctionnalité: Accepter une invitation (rejoindre un salon)
  Pour travailler dans le salon qui l'a invitée avec son propre compte,
  la personne invitée prouve qu'elle possède le numéro invité par un code SMS,
  découvre alors le salon et le rôle proposés, puis accepte : son appartenance au salon est créée avec ce rôle.

  Contexte:
    Étant donné que nous sommes le 20/11/2026 à 10 h 00, heure de Douala
    Et que les SMS sont envoyés normalement
    Et que Paul Ebode a un compte du personnel avec le mot de passe "Bastos-Fade-2026" pour le 6 99 00 11 22
    Et que Paul est "Propriétaire" de "Paul Barber Deïdo" et "Coiffeur" chez "Élégance Bonamoussadi"
    Et qu'aucun compte n'existe pour le 6 55 44 33 22 ni pour le 6 70 00 00 01
    Et que les invitations en attente sont :
      | salon                 | ville, quartier      | personne invitée | numéro        | rôle                           | envoyée le           | valable jusqu'au     |
      | Go Beauty Akwa        | Douala, Akwa         | Brice Nana       | 6 55 44 33 22 | Coiffeur / Coiffeuse / Barbier | 19/11/2026 à 10 h 00 | 26/11/2026 à 10 h 00 |
      | Élégance Bonamoussadi | Douala, Bonamoussadi | Brice Nana       | 6 55 44 33 22 | Administrateur de salon        | 19/11/2026 à 15 h 00 | 26/11/2026 à 15 h 00 |
      | Go Beauty Akwa        | Douala, Akwa         | Paul Ebode       | 6 99 00 11 22 | Administrateur de salon        | 19/11/2026 à 11 h 00 | 26/11/2026 à 11 h 00 |

  # --- Parcours nominal -------------------------------------------------------------------------

  @nominal @RG-007-05 @RG-007-08 @RG-007-11 @RG-007-13 @RG-007-14 @EX-022 @EX-037 @D-017
  Scénario: Une personne sans compte rejoint le salon qui l'a invitée
    Étant donné que Brice a prouvé son numéro 6 55 44 33 22 avec le code reçu par SMS
    Quand Brice accepte l'invitation de "Go Beauty Akwa" avec le nom "Brice Nana", le mot de passe "Wouri-Barber-2027" et les conditions acceptées
    Alors Brice est connecté et travaille dans le salon "Go Beauty Akwa" comme "Coiffeur / Coiffeuse / Barbier"
    Et Brice se connecte désormais avec le 6 55 44 33 22 et le mot de passe "Wouri-Barber-2027"
    Et l'invitation d'"Élégance Bonamoussadi" pour Brice est toujours en attente

  @nominal @RG-007-02 @D-046
  Scénario: Le code pour rejoindre une équipe arrive par un SMS qui ne nomme aucun salon
    Quand on demande un code pour rejoindre un salon avec le "6 55 44 33 22"
    Alors le 6 55 44 33 22 reçoit, après la réponse, le SMS "GoMeCoiffer : votre code pour rejoindre une équipe est 482913. Il expire dans 5 minutes. Ne le communiquez à personne."

  @nominal @RG-007-06 @EX-004
  Scénario: Après le code, la personne découvre les salons qui l'invitent
    Étant donné que Brice a reçu le code "482913" pour le 6 55 44 33 22
    Quand Brice saisit le code "482913"
    Alors il voit, dans cet ordre, les invitations :
      | salon                 | ville, quartier      | rôle                           | à accepter avant le  |
      | Élégance Bonamoussadi | Douala, Bonamoussadi | Administrateur de salon        | 26/11/2026 à 15 h 00 |
      | Go Beauty Akwa        | Douala, Akwa         | Coiffeur / Coiffeuse / Barbier | 26/11/2026 à 10 h 00 |
    Et on lui demande de créer son compte, avec le nom "Brice Nana" déjà rempli
    Et il ne voit pas l'invitation de Paul Ebode

  @nominal @RG-007-12 @EX-025
  Scénario: Une invitation acceptée quitte les invitations du salon et n'en garde ni le nom ni le numéro
    Étant donné que Brice a accepté l'invitation de "Go Beauty Akwa" en créant son compte
    Quand Mireille consulte les invitations de "Go Beauty Akwa"
    Alors elle n'y voit plus "Brice Nana"
    Et l'invitation acceptée ne garde que le salon, le rôle, ses dates et le compte de Brice

  # --- Demande du code : non-énumération et limites -------------------------------------------

  @securite @RG-007-01 @RG-007-02 @D-019 @D-030
  Plan du scénario: La demande de code reçoit la même réponse et ne nomme aucun salon
    Étant donné que le <numéro> a <situation>
    Quand on demande un code pour rejoindre un salon avec le "<numéro>"
    Alors la demande est acceptée et l'écran affiché est le même que pour le 6 55 44 33 22
    Et cet écran ne cite aucun salon ni aucun rôle
    Et ce qui est envoyé au <numéro> est <envoi>

    Exemples:
      | numéro        | situation                                           | envoi               |
      | 6 55 44 33 22 | une invitation en attente et aucun compte           | un SMS avec un code |
      | 6 99 00 11 22 | une invitation en attente et un compte du personnel | un SMS avec un code |
      | 6 70 00 00 01 | aucune invitation                                   | rien                |
      | 6 70 11 22 33 | seulement une invitation expirée le 17/11/2026      | rien                |

  @securite @RG-007-02 @RG-007-05
  Plan du scénario: Sans invitation en attente, aucun code saisi ne prouve le numéro
    Étant donné que le <numéro> a <situation>
    Et qu'un code pour rejoindre un salon a été demandé pour le <numéro>
    Quand on saisit le code "482913" pour le <numéro>
    Alors la vérification est refusée avec le motif "Code incorrect. Il vous reste 4 essais."
    Et aucune invitation n'est montrée

    Exemples:
      | numéro        | situation                                      |
      | 6 70 00 00 01 | aucune invitation                              |
      | 6 70 11 22 33 | seulement une invitation expirée le 17/11/2026 |

  @erreur @RG-007-01
  Plan du scénario: Seuls les numéros camerounais valides reçoivent un code
    Quand on demande un code pour rejoindre un salon avec le "<numéro saisi>"
    Alors la demande est <résultat>

    Exemples:
      | numéro saisi       | résultat                   |
      | 6 55 44 33 22      | acceptée                   |
      | +237 6 55 44 33 22 | acceptée                   |
      | 6 55 44 33 2       | refusée : numéro mal formé |
      | +33 6 12 34 56 78  | refusée : numéro mal formé |

  @erreur @RG-007-01
  Scénario: Une demande de code sans jeton de sécurité est refusée sans rien compter
    Quand on demande un code pour rejoindre un salon avec le "6 55 44 33 22" sans jeton de sécurité
    Alors la demande est refusée avec le motif "Jeton de sécurité absent ou expiré : rechargez la page puis recommencez."
    Et aucun SMS n'est envoyé au 6 55 44 33 22

  @erreur @RG-007-04 @D-021
  Plan du scénario: Un nouveau code ne peut être demandé qu'après 60 secondes
    Étant donné que Brice a reçu un code pour rejoindre un salon à 10 h 00 min 00 s
    Quand Brice demande un nouveau code à <heure>
    Alors la demande est <résultat>

    Exemples:
      | heure            | résultat                                 |
      | 10 h 00 min 59 s | refusée : nouveau code possible dans 1 s |
      | 10 h 01 min 00 s | acceptée                                 |

  @erreur @RG-007-04 @D-021 @D-023
  Plan du scénario: Au plus 5 codes par heure et 10 codes par 24 heures pour un même numéro
    Étant donné que <envois> ont été envoyés au 6 55 44 33 22 pour rejoindre un salon
    Quand Brice demande un code pour rejoindre un salon à 10 h 00
    Alors la demande est <résultat>

    Exemples:
      | envois                                            | résultat                |
      | 4 codes depuis 9 h 10                             | acceptée                |
      | 5 codes depuis 9 h 10                             | refusée : trop de codes |
      | 9 codes depuis hier 11 h 00, le dernier à 8 h 00  | acceptée                |
      | 10 codes depuis hier 11 h 00, le dernier à 8 h 00 | refusée : trop de codes |

  @securite @RG-007-04 @D-023
  Scénario: Après 10 codes faux en 24 heures, plus aucun code pour rejoindre un salon n'est envoyé
    Étant donné que 10 codes faux pour rejoindre un salon ont été saisis pour le 6 55 44 33 22 depuis hier 11 h 00
    Quand Brice demande un code pour rejoindre un salon à 10 h 00
    Alors la demande est refusée
    Et le motif indiqué est "Trop de codes demandés pour ce numéro. Réessayez dans une heure ou contactez l'assistance."

  @securite @RG-007-04
  Scénario: Des demandes de code simultanées n'envoient qu'un seul SMS
    Quand 5 demandes de code pour rejoindre un salon avec le "6 55 44 33 22" arrivent en même temps
    Alors un seul SMS est envoyé au 6 55 44 33 22
    Et les 4 autres demandes sont refusées pour renvoi trop tôt

  @erreur @securite @RG-007-02 @D-033
  Scénario: Une demande dont le SMS n'est pas parti compte dans les limites, sans que l'écran le dise
    Étant donné que le fournisseur SMS est indisponible
    Et que Brice a demandé un code pour rejoindre un salon à 10 h 00 sans le recevoir
    Quand Brice demande un nouveau code à 10 h 00 min 30 s
    Alors la demande est refusée avec le motif "Un code vient d'être envoyé. Vous pourrez en demander un autre dans 30 secondes."
    Et la réponse est la même que pour le 6 70 00 00 01 dans la même situation

  # --- Vérification du code et preuve du numéro -----------------------------------------------

  @erreur @RG-007-03
  Plan du scénario: Un code pour rejoindre un salon n'est valable que 5 minutes
    Étant donné que Brice a reçu le code "482913" à 10 h 00 min 00 s
    Quand Brice saisit le code "482913" à <heure>
    Alors la vérification est <résultat>

    Exemples:
      | heure            | résultat              |
      | 10 h 04 min 59 s | acceptée              |
      | 10 h 05 min 00 s | refusée : code expiré |

  @securite @RG-007-03
  Scénario: Après 5 codes faux, même le bon code est refusé
    Étant donné que Brice a reçu le code "482913"
    Et que 5 codes faux ont été saisis pour ce code
    Quand Brice saisit le code "482913"
    Alors la vérification est refusée avec le motif "Trop d'essais. Demandez un nouveau code."
    Et aucune invitation n'est montrée

  @alternatif @RG-007-03
  Scénario: Un nouveau code annule le précédent
    Étant donné que Brice a reçu le code "482913" à 10 h 00
    Et qu'il a reçu le code "105377" à 10 h 01
    Quand Brice saisit le code "482913"
    Alors la vérification est refusée avec le motif "Code incorrect. Il vous reste 4 essais."

  @securite @RG-007-03 @RG-007-04 @D-023
  Scénario: Les codes d'un autre motif ne comptent pas et ne permettent pas de rejoindre un salon
    Étant donné que 5 codes de réinitialisation ont été demandés pour le 6 99 00 11 22 depuis 9 h 10, le dernier étant "105377"
    Et que Paul a reçu le code "482913" pour rejoindre un salon à 10 h 00
    Quand Paul saisit le code "105377" pour rejoindre un salon
    Alors la vérification est refusée avec le motif "Code incorrect. Il vous reste 4 essais."

  @erreur @RG-007-06
  Scénario: Une invitation annulée pendant la saisie du code n'est plus proposée
    Étant donné que Paul a reçu le code "482913" pour rejoindre un salon
    Et que Mireille a ensuite annulé l'invitation de Paul
    Quand Paul saisit le code "482913"
    Alors on lui indique "Aucune invitation en attente pour ce numéro : elle a peut-être expiré ou été annulée. Demandez au salon de vous inviter de nouveau."

  @securite @RG-007-05 @EX-006
  Plan du scénario: Sans preuve du numéro sur ce navigateur, aucune invitation n'est acceptée
    Étant donné que <situation>
    Quand on accepte depuis ce navigateur l'invitation de Brice dans "Go Beauty Akwa" en créant son compte
    Alors l'acceptation est refusée avec le motif "Votre vérification a expiré : demandez un nouveau code pour continuer."
    Et aucun compte n'existe pour le 6 55 44 33 22

    Exemples:
      | situation                                                          |
      | aucun code n'a été saisi sur ce navigateur                         |
      | Brice a prouvé son numéro sur son téléphone, pas sur ce navigateur |

  @erreur @RG-007-05
  Plan du scénario: La preuve du numéro est valable 15 minutes
    Étant donné que Brice a prouvé son numéro 6 55 44 33 22 à 10 h 02 min 00 s
    Quand Brice accepte l'invitation de "Go Beauty Akwa" à <heure> en créant son compte
    Alors l'acceptation est <résultat>

    Exemples:
      | heure            | résultat                                                                                      |
      | 10 h 16 min 59 s | réussie                                                                                       |
      | 10 h 17 min 00 s | refusée avec le motif "Votre vérification a expiré : demandez un nouveau code pour continuer." |

  # --- Acceptation : invitation visée ---------------------------------------------------------

  @securite @RG-007-07 @EX-024
  Plan du scénario: Une invitation adressée à un autre numéro ne peut pas être acceptée, et le refus ne dit pas pourquoi
    Étant donné que Brice a prouvé son numéro 6 55 44 33 22
    Quand Brice accepte <invitation visée>
    Alors l'acceptation est refusée comme pour une invitation qui n'existe pas
    Et <conséquence>

    Exemples:
      | invitation visée                                 | conséquence                                    |
      | l'invitation de Paul Ebode dans "Go Beauty Akwa" | l'invitation de Paul est toujours en attente   |
      | une invitation dont l'identifiant n'existe pas   | rien n'a changé                                |

  @erreur @RG-007-07 @RG-007-12
  Scénario: Une invitation annulée après la saisie du code ne peut plus être acceptée
    Étant donné que Brice a prouvé son numéro 6 55 44 33 22
    Et que Mireille a ensuite annulé l'invitation de Brice dans "Go Beauty Akwa"
    Quand Brice accepte l'invitation de "Go Beauty Akwa" en créant son compte
    Alors l'acceptation est refusée avec le motif "Cette invitation n'est plus en attente : elle a été acceptée, annulée ou elle a expiré."
    Et aucun compte n'existe pour le 6 55 44 33 22

  @erreur @RG-007-07
  Plan du scénario: Une invitation s'accepte jusqu'à son échéance, échéance exclue
    Étant donné que Brice a prouvé son numéro 6 55 44 33 22 le 26/11/2026 à 9 h 50
    Quand Brice accepte l'invitation de "Go Beauty Akwa" le 26/11/2026 à <heure> en créant son compte
    Alors l'acceptation est <résultat>

    Exemples:
      | heure            | résultat                                                                                                       |
      | 9 h 59 min 59 s  | réussie                                                                                                        |
      | 10 h 00 min 00 s | refusée avec le motif "Cette invitation n'est plus en attente : elle a été acceptée, annulée ou elle a expiré." |

  @securite @RG-007-11 @EX-024 @EX-012 @EX-014
  Plan du scénario: L'acceptation ne porte que l'invitation choisie et, pour un nouveau compte, le nom, le mot de passe et les conditions
    Étant donné que Brice a prouvé son numéro 6 55 44 33 22
    Quand Brice accepte l'invitation de "Go Beauty Akwa" en créant son compte et en indiquant aussi <information>
    Alors l'acceptation est refusée avec le motif "Certaines informations sont invalides : corrigez les champs signalés."
    Et aucun compte n'existe pour le 6 55 44 33 22

    Exemples:
      | information                            |
      | le rôle "Propriétaire"                 |
      | le salon "Go Beauty Bastos"            |
      | le numéro 6 99 00 11 22                |
      | le rôle système "Super Administrateur" |

  # --- Acceptation : création du compte -------------------------------------------------------

  @erreur @RG-007-08 @D-020
  Plan du scénario: Le mot de passe du nouveau compte doit être difficile à deviner
    Étant donné que Brice a prouvé son numéro 6 55 44 33 22
    Quand Brice accepte l'invitation de "Go Beauty Akwa" avec le nom "Brice Nana", le mot de passe "<mot de passe>" et les conditions acceptées
    Alors l'acceptation est <résultat>

    Exemples:
      | mot de passe      | résultat                                    |
      | salon2026         | refusée : au moins 10 caractères            |
      | motdepasse123     | refusée : mot de passe trop courant         |
      | 655443322ab       | refusée : ne doit pas contenir votre numéro |
      | Wouri-Barber-2027 | réussie                                     |

  @erreur @RG-007-08 @D-022
  Plan du scénario: Le nouveau compte demande un nom de 2 à 80 caractères et l'acceptation des conditions
    Étant donné que Brice a prouvé son numéro 6 55 44 33 22
    Quand Brice accepte l'invitation de "Go Beauty Akwa" avec le nom <nom>, le mot de passe "Wouri-Barber-2027" et <conditions>
    Alors l'acceptation est <résultat>

    Exemples:
      | nom                     | conditions                   | résultat                                                          |
      | "Bo"                    | les conditions acceptées     | réussie                                                           |
      | "B"                     | les conditions acceptées     | refusée : nom trop court                                          |
      | un nom de 81 caractères | les conditions acceptées     | refusée : nom trop long                                           |
      | "Brice Nana"            | les conditions non acceptées | refusée : "Acceptez les conditions d'utilisation pour continuer." |

  @erreur @RG-007-08 @RG-007-05
  Scénario: Un mot de passe refusé ne fait perdre ni la preuve du numéro ni l'invitation
    Étant donné que Brice a prouvé son numéro 6 55 44 33 22
    Et que son acceptation a été refusée pour le mot de passe "salon2026"
    Quand Brice accepte l'invitation de "Go Beauty Akwa" avec le nom "Brice Nana", le mot de passe "Wouri-Barber-2027" et les conditions acceptées
    Alors Brice est connecté et travaille dans le salon "Go Beauty Akwa"

  @alternatif @RG-007-09 @D-018 @EX-001 @apres-UC-009
  Scénario: Le compte client léger d'une personne invitée est complété, pas dupliqué
    Étant donné que le 6 91 23 45 67 est le compte client d'Aïcha Bello, avec 2 réservations
    Et que "Go Beauty Bastos" a invité Aïcha Bello, au 6 91 23 45 67, comme "Praticien / Praticienne de beauté"
    Et qu'Aïcha a prouvé son numéro 6 91 23 45 67 avec le code reçu par SMS
    Quand Aïcha accepte l'invitation de "Go Beauty Bastos" avec le nom "Aïcha Bello", le mot de passe "Bastos-Ongles-2027" et les conditions acceptées
    Alors il existe un seul compte pour le +237691234567, qui retrouve ses 2 réservations
    Et Aïcha travaille dans le salon "Go Beauty Bastos" comme "Praticien / Praticienne de beauté"

  # --- Acceptation : compte du personnel existant et session ----------------------------------

  @alternatif @RG-007-10 @RG-007-13 @EX-004 @D-037
  Scénario: Un membre du personnel déjà connecté rejoint un autre salon sans ressaisir de mot de passe
    Étant donné que Paul est connecté sur son téléphone et travaille dans "Paul Barber Deïdo"
    Et que Paul a prouvé son numéro 6 99 00 11 22 sur son téléphone avec le code reçu par SMS
    Quand Paul accepte l'invitation de "Go Beauty Akwa"
    Alors Paul travaille dans le salon "Go Beauty Akwa" comme "Administrateur de salon", avec un nouveau jeton de sécurité
    Et Paul est toujours "Propriétaire" de "Paul Barber Deïdo" et "Coiffeur" chez "Élégance Bonamoussadi"
    Et Paul se connecte toujours avec "Bastos-Fade-2026"

  @alternatif @RG-007-10 @RG-007-13 @EX-004
  Scénario: Un membre du personnel non connecté rejoint le salon puis se connecte avec son mot de passe habituel
    Étant donné que Paul a prouvé son numéro 6 99 00 11 22 sur un navigateur où personne n'est connecté
    Quand Paul accepte l'invitation de "Go Beauty Akwa"
    Alors on lui indique "Vous faites maintenant partie de l'équipe de Go Beauty Akwa. Connectez-vous avec votre mot de passe habituel pour y travailler."
    Et aucune session n'est ouverte sur ce navigateur
    Et la réponse ne montre ni ses autres salons ni le nom de son compte
    Et à sa prochaine connexion, Paul choisit parmi "Élégance Bonamoussadi", "Go Beauty Akwa" et "Paul Barber Deïdo"

  @securite @RG-007-11 @RG-007-13 @EX-006
  Scénario: L'appartenance va au titulaire du numéro prouvé, jamais au compte connecté sur l'appareil
    Étant donné que Mireille Ndongo est connectée sur la tablette du salon
    Et que Paul a prouvé son numéro 6 99 00 11 22 sur cette tablette
    Quand Paul accepte l'invitation de "Go Beauty Akwa" sur cette tablette
    Alors Paul est "Administrateur de salon" de "Go Beauty Akwa"
    Et Mireille est toujours connectée sur la tablette, sans nouveau rôle

  @alternatif @RG-007-13 @RG-002-11
  Scénario: Créer son compte sur la tablette du salon remplace la session qui y était ouverte
    Étant donné que Mireille Ndongo est connectée sur la tablette du salon
    Et que Brice a prouvé son numéro 6 55 44 33 22 sur cette tablette
    Quand Brice accepte l'invitation de "Go Beauty Akwa" en créant son compte sur cette tablette
    Alors la tablette est connectée au compte de Brice, dans le salon "Go Beauty Akwa"
    Et l'ancienne session de Mireille sur la tablette ne donne plus accès à rien

  @alternatif @RG-007-14 @RG-007-13 @EX-004
  Scénario: Une personne invitée par deux salons les rejoint l'un après l'autre
    Étant donné que Brice a prouvé son numéro 6 55 44 33 22 avec le code reçu par SMS
    Et que Brice a accepté l'invitation de "Go Beauty Akwa" en créant son compte
    Quand Brice accepte l'invitation d'"Élégance Bonamoussadi"
    Alors Brice est "Coiffeur / Coiffeuse / Barbier" de "Go Beauty Akwa" et "Administrateur de salon" d'"Élégance Bonamoussadi"
    Et Brice travaille dans le salon "Élégance Bonamoussadi"
    Et cette seconde acceptation n'a demandé ni nom ni mot de passe

  # --- Concurrence, panne, audit --------------------------------------------------------------

  @securite @RG-007-16 @EX-001
  Scénario: Deux acceptations simultanées ne créent qu'un compte et qu'une appartenance
    Étant donné que Brice a prouvé son numéro 6 55 44 33 22
    Quand deux acceptations de l'invitation de "Go Beauty Akwa" par Brice, en créant son compte, arrivent en même temps
    Alors une seule réussit
    Et il existe un seul compte pour le +237655443322, membre une seule fois de "Go Beauty Akwa"

  @securite @RG-007-16
  Scénario: Une acceptation et une annulation simultanées ne réussissent pas toutes les deux
    Étant donné que Paul a prouvé son numéro 6 99 00 11 22
    Quand Paul accepte l'invitation de "Go Beauty Akwa" pendant que Mireille l'annule
    Alors une seule des deux actions réussit
    Et Paul est membre de "Go Beauty Akwa" si et seulement si l'invitation est acceptée

  @erreur @RG-007-12
  Scénario: Une panne pendant l'acceptation ne laisse ni compte ni appartenance
    Étant donné que Brice a prouvé son numéro 6 55 44 33 22
    Et que le service GoMeCoiffer tombe en panne pendant l'enregistrement de l'acceptation
    Quand Brice accepte l'invitation de "Go Beauty Akwa" en créant son compte
    Alors l'acceptation est refusée avec le motif "Impossible de rejoindre le salon pour le moment. Réessayez dans quelques minutes."
    Et aucun compte n'existe pour le 6 55 44 33 22
    Et l'invitation de Brice dans "Go Beauty Akwa" est toujours en attente

  @securite @RG-007-17 @EX-023 @EX-025
  Scénario: L'acceptation est tracée sans donnée personnelle ni secret
    Étant donné que Brice a prouvé son numéro 6 55 44 33 22
    Quand Brice accepte l'invitation de "Go Beauty Akwa" en créant son compte
    Alors le journal d'audit contient "compte collaborateur créé" et "invitation acceptée" pour "Go Beauty Akwa", avec le rôle et le compte de Brice
    Et aucune de ces lignes ne contient le nom "Brice Nana", le numéro 6 55 44 33 22, le code ni le mot de passe
