# language: fr
@UC-013
Fonctionnalité: Ouvrir une session depuis l'application mobile (jeton de session)
  Pour travailler au salon ou retrouver ses réservations depuis l'application GoMeCoiffer,
  l'utilisateur ouvre une session dont la preuve est un jeton gardé par l'application,
  avec les mêmes droits, les mêmes durées et la même fermeture que dans le navigateur.
  Un navigateur ne peut jamais utiliser cette variante, qui se passe du jeton de sécurité.

  Contexte:
    Étant donné que nous sommes le 20/11/2026 à 10 h 00, heure de Douala
    Et que Paul Ebode a un compte du personnel avec le mot de passe "Bastos-Fade-2026" pour le 6 99 00 11 22
    Et que Paul est "Propriétaire" de "Paul Barber Deïdo" et "Coiffeur" chez "Élégance Bonamoussadi"
    Et qu'Aïcha Mbarga a un compte client léger pour le 6 55 44 33 22
    Et qu'aucun compte n'existe pour le 6 70 00 00 01

  # --- Obtenir le jeton ------------------------------------------------------------------------

  @nominal @RG-013-03 @RG-013-04 @EX-047 @D-004
  Scénario: Paul se connecte depuis l'application et reçoit un jeton de session
    Quand Paul se connecte depuis l'application avec le "6 99 00 11 22" et le mot de passe "Bastos-Fade-2026"
    Alors Paul est connecté sur l'application, sans salon ouvert
    Et la réponse contient un jeton de session et l'invitation à choisir son salon
    Et aucun cookie n'est posé
    Et aucun jeton de sécurité ne lui a été demandé

  @securite @RG-013-04 @D-019
  Plan du scénario: Depuis l'application, le refus de connexion est le même pour un numéro inconnu, un compte client ou un mot de passe faux
    Quand on se connecte depuis l'application avec le "<numéro>" et le mot de passe "<mot de passe>"
    Alors la connexion est refusée avec le motif "Numéro ou mot de passe incorrect."
    Et la réponse est la même que pour un numéro sans compte
    Et aucun jeton n'est remis

    Exemples:
      | numéro        | mot de passe     |
      | 6 70 00 00 01 | Bastos-Fade-2026 |
      | 6 55 44 33 22 | Bastos-Fade-2026 |
      | 6 99 00 11 22 | Akwa-Fade-2026   |

  @alternatif @RG-013-06 @D-025
  Scénario: Un inconnu qui bloque le numéro ne gêne pas Paul sur l'application de son téléphone habituel
    Étant donné que Paul s'est connecté depuis l'application de son téléphone le 10/11/2026
    Et que le 6 99 00 11 22 est bloqué jusqu'à 10 h 15 après 5 mots de passe faux saisis par un inconnu
    Quand Paul se connecte depuis l'application de son téléphone avec son mot de passe
    Alors Paul est connecté sur l'application

  @nominal @RG-013-05 @D-054
  Scénario: Aïcha ouvre son espace client dans l'application avec le code reçu par SMS
    Étant donné qu'Aïcha a reçu le code "482913" pour retrouver ses réservations
    Quand Aïcha saisit le code "482913" dans l'application
    Alors l'application reçoit un jeton de session client
    Et Aïcha voit "Vous êtes connecté avec le 6 55 •• •• 22"

  @alternatif @RG-013-14 @RG-002-11
  Scénario: Se connecter dans l'application remplace la session qu'elle portait
    Étant donné qu'Aïcha est connectée à son espace client dans l'application de la tablette du salon
    Quand Paul se connecte avec son mot de passe dans cette application
    Alors l'application est connectée au compte de Paul
    Et l'ancien jeton d'Aïcha ne donne plus accès à rien

  # --- Utiliser le jeton -----------------------------------------------------------------------

  @nominal @RG-013-07 @EX-006
  Scénario: Avec son jeton, Paul travaille dans son salon sans jeton de sécurité
    Étant donné que Paul est connecté sur l'application et a ouvert "Paul Barber Deïdo"
    Quand Paul consulte l'équipe de "Paul Barber Deïdo" depuis l'application
    Alors l'équipe de "Paul Barber Deïdo" s'affiche
    Et aucun jeton de sécurité ne lui a été demandé

  @securite @RG-013-07 @D-055 @EX-013
  Scénario: Un jeton de session client n'ouvre pas le back-office
    Étant donné que l'application de Paul porte un jeton de session client ouvert par code SMS
    Quand Paul ouvre le planning de "Paul Barber Deïdo" depuis l'application
    Alors l'accès est refusé avec le motif "Cet espace est réservé aux salons. Connectez-vous avec votre mot de passe, ou créez votre compte salon."

  @nominal @RG-013-08 @EX-036
  Scénario: Le suivi en direct de l'application s'ouvre avec le jeton
    Étant donné que Paul est connecté sur l'application et a ouvert "Paul Barber Deïdo"
    Quand l'application ouvre le suivi en direct avec son jeton
    Alors elle reçoit les changements de "Paul Barber Deïdo"

  @securite @RG-013-16
  Scénario: Un jeton placé dans l'adresse est refusé
    Étant donné que Paul est connecté sur l'application
    Quand l'application ouvre le suivi en direct en plaçant le jeton de Paul dans l'adresse
    Alors l'accès est refusé avec le motif "Session absente ou expirée : reconnectez-vous."

  # --- Le navigateur ne peut pas emprunter la variante ----------------------------------------

  @securite @RG-013-01 @RG-013-02 @D-004
  Plan du scénario: La variante sans jeton de sécurité est refusée à ce qui vient d'un navigateur
    Quand <demande>
    Alors la demande est refusée
    Et aucune session n'est ouverte ni modifiée

    Exemples:
      | demande                                                                                     |
      | une connexion de Paul portant la marque de l'application arrive avec un cookie de session   |
      | une connexion de Paul portant la marque de l'application arrive depuis la page d'un autre site |
      | une demande présente à la fois un cookie de session et le jeton de Paul                    |
      | une demande présente le jeton de Paul sans la marque de l'application                       |

  @securite @RG-013-02
  Plan du scénario: Une session ne s'utilise que par le canal qui l'a ouverte
    Étant donné que Paul est connecté <canal d'ouverture>
    Quand sa preuve de session est présentée <autre canal>
    Alors l'accès est refusé avec le motif "Session absente ou expirée : reconnectez-vous."

    Exemples:
      | canal d'ouverture    | autre canal                                    |
      | dans son navigateur  | comme jeton de l'application                   |
      | sur l'application    | comme cookie de session d'un navigateur        |

  @securite @RG-013-01 @RG-002-10
  Scénario: Dans le navigateur, une connexion sans jeton de sécurité reste refusée
    Quand Paul se connecte depuis son navigateur avec son mot de passe sans jeton de sécurité
    Alors la connexion est refusée avec le motif "Jeton de sécurité absent ou expiré : rechargez la page puis recommencez."

  # --- Renouveler le jeton ---------------------------------------------------------------------

  @nominal @RG-013-10 @D-039 @UC-005
  Scénario: Changer de salon dans l'application remplace le jeton
    Étant donné que Paul s'est connecté sur l'application à 10 h 00 et a ouvert "Paul Barber Deïdo"
    Quand Paul ouvre "Élégance Bonamoussadi" dans l'application
    Alors l'application reçoit un nouveau jeton, avec "Élégance Bonamoussadi" comme salon actif
    Et l'ancien jeton ne donne plus accès à rien
    Et la session expire toujours le 27/11/2026 à 10 h 00

  @securite @RG-013-10 @RG-013-08 @D-039
  Scénario: Après un changement de salon, seul le suivi en direct de l'ancien jeton est fermé
    Étant donné que Paul suit "Paul Barber Deïdo" en direct dans l'application de son téléphone et sur la tablette du salon
    Quand Paul ouvre "Élégance Bonamoussadi" dans l'application de son téléphone
    Alors le suivi en direct de son téléphone sur "Paul Barber Deïdo" est fermé
    Et la tablette du salon suit toujours "Paul Barber Deïdo"

  @securite @RG-013-10
  Scénario: Deux changements de salon simultanés ne laissent qu'un jeton valable
    Étant donné que Paul est connecté sur l'application
    Quand deux ouvertures de salon partent en même temps avec le même jeton
    Alors une seule réussit et remet un nouveau jeton
    Et l'autre est refusée avec le motif "Session absente ou expirée : reconnectez-vous."

  @alternatif @RG-013-11 @app-mobile
  Scénario: Le refus d'une demande partie avec l'ancien jeton ne déconnecte pas l'application
    Étant donné que Paul a ouvert "Élégance Bonamoussadi" dans l'application et reçu un nouveau jeton
    Quand le refus d'une consultation partie avec l'ancien jeton arrive
    Alors l'application reste connectée avec le nouveau jeton

  @erreur @RG-013-11 @app-mobile
  Scénario: Si la réponse d'un changement de salon se perd, l'application demande de se reconnecter
    Étant donné que Paul a demandé d'ouvrir "Élégance Bonamoussadi" et que la réponse s'est perdue faute de réseau
    Quand l'application envoie une demande avec son ancien jeton
    Alors l'application affiche « Se connecter » avec le message "Votre session a expiré. Reconnectez-vous avec votre mot de passe."

  # --- Durées ----------------------------------------------------------------------------------

  @erreur @RG-013-09 @D-026 @D-054
  Plan du scénario: Les sessions de l'application ont les mêmes durées que dans le navigateur
    Étant donné que <personne> s'est connecté sur l'application le 16/11/2026 à 10 h 00 et <activité>
    Quand l'application de <personne> fait une demande le <instant>
    Alors l'accès est <résultat>

    Exemples:
      | personne                         | activité                     | instant              | résultat                 |
      | Paul                             | n'a rien fait depuis         | 17/11/2026 à 09 h 59 | accordé                  |
      | Paul                             | n'a rien fait depuis         | 17/11/2026 à 10 h 01 | refusé : session expirée |
      | Paul                             | l'utilise toutes les heures  | 23/11/2026 à 10 h 01 | refusé : session expirée |
      | Henri, Administrateur Opérations | n'a rien fait depuis         | 16/11/2026 à 12 h 01 | refusé : session expirée |
      | Aïcha, avec un jeton client      | n'a rien fait depuis         | 23/11/2026 à 09 h 59 | accordé                  |
      | Aïcha, avec un jeton client      | l'utilise chaque jour        | 16/12/2026 à 10 h 01 | refusé : session expirée |

  # --- Fermer ----------------------------------------------------------------------------------

  @nominal @RG-013-12 @RG-013-06
  Scénario: Se déconnecter dans l'application rend le jeton inutilisable
    Étant donné que Paul est connecté sur l'application de son téléphone
    Quand Paul se déconnecte dans l'application
    Alors l'application n'a plus de jeton de session
    Et l'ancien jeton de Paul ne donne plus accès à rien
    Et l'application de son téléphone reste un appareil reconnu de Paul

  @alternatif @RG-013-12 @app-mobile
  Scénario: Sans réseau, la déconnexion efface quand même le jeton de l'application
    Étant donné que Paul est connecté sur l'application et que son téléphone n'a pas de réseau
    Quand Paul se déconnecte dans l'application
    Alors l'application n'a plus de jeton de session et affiche « Se connecter »

  @securite @RG-013-13 @D-031 @D-058
  Plan du scénario: Ce qui ferme les sessions d'un compte ferme aussi celle de son application
    Étant donné que <personne> est connecté sur l'application de son téléphone
    Quand <événement>
    Alors le jeton de l'application de son téléphone ne donne plus accès à rien

    Exemples:
      | personne                         | événement                                                              |
      | Paul                             | Paul réinitialise son mot de passe sur la tablette du salon            |
      | Henri, Administrateur Opérations | un Super Administrateur retire à Henri le rôle "Administrateur Opérations" |

  @securite @RG-013-13 @UC-011
  Scénario: Un collaborateur retiré de l'équipe perd ce salon dans l'application
    Étant donné que Paul travaille dans "Élégance Bonamoussadi" depuis l'application et le suit en direct
    Quand Clarisse retire Paul de l'équipe d'"Élégance Bonamoussadi"
    Alors le suivi en direct d'"Élégance Bonamoussadi" est fermé dans l'application
    Et la demande suivante de Paul n'a plus de salon actif

  @securite @RG-013-15
  Plan du scénario: Un jeton inutilisable reçoit toujours le même refus
    Quand l'application présente <jeton>
    Alors l'accès est refusé avec le motif "Session absente ou expirée : reconnectez-vous."
    Et la réponse est la même pour les quatre jetons

    Exemples:
      | jeton                                            |
      | un jeton inventé                                 |
      | le jeton de Paul, expiré                         |
      | le jeton de Paul remplacé par un changement de salon |
      | le jeton de Paul fermé par sa déconnexion        |

  # --- Ce que voit l'utilisateur, secret du jeton ----------------------------------------------

  @erreur @RG-013-17 @app-mobile
  Plan du scénario: À l'expiration, l'application dit quoi faire
    Étant donné que la session <type> de l'application de <personne> a expiré
    Quand <personne> rouvre l'application
    Alors l'application efface son jeton et les données affichées
    Et elle affiche <écran> avec le message "<message>"

    Exemples:
      | personne | type          | écran                | message                                                                         |
      | Paul     | du personnel  | « Se connecter »     | Votre session a expiré. Reconnectez-vous avec votre mot de passe.               |
      | Aïcha    | client        | « Recevoir un code » | Votre session a expiré. Recevez un nouveau code pour retrouver vos réservations. |

  @alternatif @RG-013-17 @app-mobile
  Scénario: Une coupure du réseau ne déconnecte pas l'application
    Étant donné que Paul est connecté sur l'application
    Quand l'application ne joint pas GoMeCoiffer faute de réseau
    Alors l'application garde son jeton
    Et elle affiche "Pas de connexion internet. Vos données s'afficheront dès le retour du réseau."

  @securite @RG-013-18 @app-mobile
  Scénario: Le jeton ne suit pas une sauvegarde restaurée sur un autre téléphone
    Étant donné que Paul est connecté sur l'application de son téléphone
    Quand Paul restaure la sauvegarde de son téléphone sur un nouveau téléphone
    Alors l'application du nouveau téléphone demande de se connecter

  @securite @RG-013-16 @EX-025
  Scénario: Le jeton n'apparaît ni dans les journaux ni dans l'audit
    Quand Paul se connecte depuis l'application, consulte son équipe puis se déconnecte
    Alors ni les journaux techniques ni le journal d'audit ne contiennent son jeton
    Et le journal d'audit contient "connexion" et "déconnexion" pour Paul, par l'application

  @erreur
  Scénario: Une panne du service ne remet aucun jeton
    Étant donné que le service GoMeCoiffer est momentanément indisponible
    Quand Paul se connecte depuis l'application avec son mot de passe
    Alors la connexion est refusée avec le motif "Connexion impossible pour le moment. Réessayez dans quelques minutes."
    Et aucun jeton n'est remis
