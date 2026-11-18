# language: fr
@UC-002
Fonctionnalité: Se connecter et se déconnecter
  Pour retrouver son salon et ses rendez-vous sans que d'autres y accèdent,
  un membre du personnel se connecte avec son numéro de téléphone et son mot de passe,
  puis se déconnecte quand il a terminé.

  Contexte:
    Étant donné que nous sommes le 18/11/2026 à 10 h 00, heure de Douala
    Et que Paul Ebode, coiffeur, a un compte avec le mot de passe "Bastos-Fade-2026" pour le 6 99 00 11 22
    Et qu'Aïcha Mbarga a un compte client léger, sans mot de passe, pour le 6 55 44 33 22
    Et qu'aucun compte n'existe pour le 6 70 00 00 01

  @nominal @RG-002-01 @RG-002-10 @EX-029 @D-017
  Scénario: Un membre du personnel se connecte avec son numéro et son mot de passe
    Quand on se connecte avec le "6 99 00 11 22" et le mot de passe "Bastos-Fade-2026"
    Alors Paul est connecté
    Et aucun salon n'est ouvert dans sa session

  @nominal @RG-002-14 @EX-019 @EX-002 @EX-011
  Plan du scénario: Après la connexion, on indique où continuer
    Étant donné que Paul a <situation>
    Quand Paul se connecte avec son mot de passe
    Alors on l'invite à <étape suivante>

    Exemples:
      | situation                                                  | étape suivante                      |
      | aucune appartenance à un salon                             | créer son organisation              |
      | une appartenance au salon "Go Beauty Akwa"                 | ouvrir le salon "Go Beauty Akwa"    |
      | des appartenances à "Go Beauty Akwa" et "Go Beauty Bastos" | choisir son salon                   |
      | le rôle système "Administrateur Opérations"                | ouvrir l'administration GoMeCoiffer |

  @securite @RG-002-02 @D-018 @D-019
  Plan du scénario: Le refus est le même pour un numéro inconnu, un compte client ou un mot de passe faux
    Quand on se connecte avec le "<numéro>" et le mot de passe "<mot de passe>"
    Alors la connexion est refusée
    Et le motif indiqué est "Numéro ou mot de passe incorrect."
    Et la réponse est la même que pour un numéro sans compte

    Exemples:
      | numéro        | mot de passe     | situation                              |
      | 6 70 00 00 01 | Bastos-Fade-2026 | numéro sans compte                     |
      | 6 55 44 33 22 | Bastos-Fade-2026 | compte client léger, sans mot de passe |
      | 6 99 00 11 22 | Akwa-Fade-2026   | mot de passe faux de Paul              |

  @securite @RG-002-03 @D-019
  Scénario: Un numéro sans compte est refusé après une vérification aussi coûteuse qu'un mot de passe faux
    Quand on se connecte avec le "6 70 00 00 01" et le mot de passe "Bastos-Fade-2026"
    Alors la connexion est refusée
    Et une vérification de mot de passe complète a été faite, comme pour un compte existant

  @erreur @RG-002-01
  Plan du scénario: Le numéro et le mot de passe doivent être bien saisis
    Quand on se connecte avec le "<numéro>" et le mot de passe "<mot de passe>"
    Alors la connexion est <résultat>

    Exemples:
      | numéro             | mot de passe     | résultat                            |
      | 6 99 00 11 22      | Bastos-Fade-2026 | acceptée                            |
      | +237 6 99 00 11 22 | Bastos-Fade-2026 | acceptée                            |
      | 6 99 00 11 2       | Bastos-Fade-2026 | refusée : numéro mal formé          |
      | 6 99 00 11 22      |                  | refusée : mot de passe obligatoire  |

  @erreur @RG-002-01 @D-020
  Scénario: Un mot de passe de plus de 128 caractères est refusé sans être vérifié
    Quand on se connecte avec le "6 99 00 11 22" et un mot de passe de 129 caractères
    Alors la connexion est refusée
    Et le motif indiqué est "128 caractères au plus."
    Et aucun essai n'est compté pour le 6 99 00 11 22

  @erreur @RG-002-04
  Plan du scénario: Le numéro est bloqué à partir du 5e échec en moins de 15 minutes
    Étant donné que <échecs> mots de passe faux ont été saisis pour le 6 99 00 11 22 depuis un nouvel appareil entre 9 h 50 et 9 h 54
    Quand Paul se connecte avec son mot de passe depuis un nouvel appareil
    Alors la connexion est <résultat>

    Exemples:
      | échecs | résultat                 |
      | 4      | acceptée                 |
      | 5      | refusée : trop d'essais  |

  @erreur @RG-002-04
  Plan du scénario: Le blocage dure 15 minutes après le 5e échec
    Étant donné que 5 mots de passe faux ont été saisis pour le 6 99 00 11 22 depuis un nouvel appareil entre 10 h 00 et 10 h 04
    Quand Paul se connecte avec son mot de passe depuis un nouvel appareil à <heure>
    Alors la connexion est <résultat>

    Exemples:
      | heure            | résultat                |
      | 10 h 18 min 59 s | refusée : trop d'essais |
      | 10 h 19 min 00 s | acceptée                |

  @securite @RG-002-09
  Scénario: Pendant un blocage, même le bon mot de passe est refusé
    Étant donné que le 6 99 00 11 22 est bloqué jusqu'à 10 h 15 après 5 mots de passe faux
    Quand Paul se connecte avec son mot de passe depuis un nouvel appareil
    Alors la connexion est refusée
    Et le motif indiqué est "Trop d'essais pour ce numéro. Réessayez dans 15 minutes ou utilisez « Mot de passe oublié »."

  @securite @RG-002-04 @RG-002-09 @D-019
  Scénario: Un numéro sans compte se bloque comme un numéro inscrit
    Étant donné que 5 mots de passe faux ont été saisis pour le 6 70 00 00 01 entre 9 h 55 et 9 h 59
    Quand on se connecte avec le "6 70 00 00 01" et le mot de passe "Bastos-Fade-2026"
    Alors la connexion est refusée
    Et le motif indiqué est "Trop d'essais pour ce numéro. Réessayez dans 14 minutes ou utilisez « Mot de passe oublié »."

  @alternatif @RG-002-06
  Scénario: Un inconnu qui bloque le numéro ne gêne pas Paul sur son téléphone habituel
    Étant donné que Paul s'est connecté depuis son téléphone habituel le 10/11/2026
    Et que le 6 99 00 11 22 est bloqué jusqu'à 10 h 15 après 5 mots de passe faux saisis par un inconnu
    Quand Paul se connecte avec son mot de passe depuis son téléphone habituel
    Alors Paul est connecté

  @securite @RG-002-06
  Scénario: Un appareil habituel qui accumule 5 échecs n'est plus reconnu
    Étant donné que Paul s'est connecté depuis son téléphone habituel le 10/11/2026
    Et que 4 mots de passe faux ont été saisis depuis ce téléphone entre 9 h 55 et 9 h 58
    Quand un 5e mot de passe faux est saisi depuis ce téléphone
    Alors ce téléphone n'est plus reconnu comme un appareil habituel de Paul

  @erreur @RG-002-05
  Plan du scénario: Au 20e échec en 24 heures, le numéro reste bloqué sur les nouveaux appareils
    Étant donné que <échecs> mots de passe faux ont été saisis pour le 6 99 00 11 22 depuis hier 11 h 00, jamais 5 en moins de 15 minutes
    Quand Paul se connecte avec son mot de passe depuis un nouvel appareil
    Alors la connexion est <résultat>

    Exemples:
      | échecs | résultat                            |
      | 19     | acceptée                            |
      | 20     | refusée : trop d'essais aujourd'hui |

  @erreur @RG-002-07
  Plan du scénario: Au 30e échec en une heure depuis une même adresse réseau, cette adresse est bloquée
    Étant donné que <échecs> connexions ont échoué depuis la même adresse réseau depuis 9 h 10, sur des numéros différents
    Quand Paul se connecte avec son mot de passe depuis cette adresse, sur un nouvel appareil
    Alors la connexion est <résultat>

    Exemples:
      | échecs | résultat                                |
      | 29     | acceptée                                |
      | 30     | refusée : trop d'essais depuis ce réseau |

  @alternatif @RG-002-08
  Scénario: Une connexion réussie efface les échecs consécutifs
    Étant donné que 4 mots de passe faux ont été saisis pour le 6 99 00 11 22 depuis un nouvel appareil entre 9 h 50 et 9 h 53
    Et que Paul s'est connecté avec son mot de passe à 9 h 54
    Quand un mot de passe faux est saisi pour le 6 99 00 11 22 depuis un nouvel appareil
    Alors le 6 99 00 11 22 n'est pas bloqué

  @securite @RG-002-18
  Scénario: Des essais simultanés sur un même numéro sont comptés un à un
    Étant donné que 4 mots de passe faux ont été saisis pour le 6 99 00 11 22 depuis un nouvel appareil entre 9 h 55 et 9 h 58
    Quand 10 essais avec des mots de passe faux arrivent en même temps pour le 6 99 00 11 22
    Alors un seul de ces essais est vérifié
    Et les 9 autres sont refusés pour trop d'essais

  @securite @RG-002-10
  Scénario: La connexion attribue un nouvel identifiant de session
    Étant donné que le navigateur de Paul a une session de visiteur
    Quand Paul se connecte avec son mot de passe
    Alors l'identifiant de session de son navigateur a changé
    Et l'ancien identifiant de session ne donne accès à rien

  @securite @RG-002-10 @D-004
  Scénario: Un jeton de sécurité obtenu avant la connexion est refusé après
    Étant donné que le navigateur de Paul a reçu un jeton de sécurité avant de se connecter
    Et que Paul s'est connecté avec son mot de passe
    Quand Paul se déconnecte en présentant le jeton d'avant la connexion
    Alors la demande est refusée
    Et le motif indiqué est "Jeton de sécurité absent ou expiré : rechargez la page puis recommencez."

  @erreur @RG-002-10
  Scénario: Une connexion sans jeton de sécurité est refusée sans compter d'essai
    Quand Paul se connecte avec son mot de passe sans jeton de sécurité
    Alors la connexion est refusée
    Et le motif indiqué est "Jeton de sécurité absent ou expiré : rechargez la page puis recommencez."
    Et aucun essai n'est compté pour le 6 99 00 11 22

  @alternatif @RG-002-11
  Scénario: Se connecter sur la tablette du salon remplace la session déjà ouverte
    Étant donné que Mireille Ndongo est connectée sur la tablette du salon
    Quand Paul se connecte avec son mot de passe sur cette tablette
    Alors la tablette est connectée au compte de Paul
    Et l'ancienne session de Mireille ne donne plus accès à rien

  @erreur @RG-002-12
  Plan du scénario: Une session du personnel expire après 24 heures sans activité
    Étant donné que Paul s'est connecté le 16/11/2026 à 10 h 00 et n'a rien fait depuis
    Quand Paul ouvre son espace le 17/11/2026 à <heure>
    Alors l'accès est <résultat>

    Exemples:
      | heure   | résultat                  |
      | 09 h 59 | accordé                   |
      | 10 h 01 | refusé : session expirée  |

  @erreur @RG-002-12
  Plan du scénario: Une session du personnel expire 7 jours après la connexion, même utilisée sans interruption
    Étant donné que Paul s'est connecté le 16/11/2026 à 10 h 00 et utilise GoMeCoiffer toutes les heures depuis
    Quand Paul ouvre son espace le 23/11/2026 à <heure>
    Alors l'accès est <résultat>

  @erreur @RG-002-12 @apres-UC-008
  Plan du scénario: La session d'un administrateur GoMeCoiffer est plus courte
    Étant donné qu'Henri, administrateur GoMeCoiffer, s'est connecté le 16/11/2026 à 08 h 00
    Quand Henri ouvre l'administration le 16/11/2026 à <heure> après <inactivité> sans activité
    Alors l'accès est <résultat>

    Exemples:
      | heure   | inactivité    | résultat                 |
      | 09 h 59 | 1 h 59        | accordé                  |
      | 10 h 01 | 2 h 01        | refusé : session expirée |
      | 20 h 01 | 0 h 30        | refusé : session expirée |

    Exemples:
      | heure   | résultat                 |
      | 09 h 59 | accordé                  |
      | 10 h 01 | refusé : session expirée |

  @securite @RG-002-13 @EX-006
  Scénario: Être connecté ne donne aucun droit dans un salon
    Étant donné que Paul s'est connecté avec son mot de passe
    Quand Paul consulte le planning d'un salon
    Alors l'accès est refusé
    Et le motif indiqué est "Choisissez d’abord le salon sur lequel vous travaillez."

  @alternatif @RG-002-14
  Scénario: À la réouverture de l'application, une session valide est reprise sans mot de passe
    Étant donné que Paul s'est connecté à 8 h 00 depuis son téléphone
    Quand Paul rouvre l'application à 10 h 00
    Alors Paul est toujours connecté
    Et on l'invite à créer son organisation

  @alternatif @RG-002-14
  Scénario: Sans session ouverte, l'application demande de se connecter
    Quand un visiteur rouvre l'application sans être connecté
    Alors on lui demande de se connecter

  @nominal @RG-002-15
  Scénario: Se déconnecter ferme la session
    Étant donné que Paul est connecté sur la tablette du salon
    Quand Paul se déconnecte
    Alors la tablette n'a plus ni session ni jeton de sécurité
    Et l'ancienne session de Paul ne donne plus accès à rien

  @alternatif @RG-002-15
  Scénario: Se déconnecter sans session ouverte est confirmé quand même
    Étant donné que la session de Paul a expiré
    Quand Paul se déconnecte
    Alors la déconnexion est confirmée

  @securite @RG-002-16 @EX-025
  Scénario: La connexion et la déconnexion sont tracées sans secret
    Étant donné que Paul s'est connecté avec son mot de passe à 10 h 00
    Quand Paul se déconnecte à 10 h 30
    Alors le journal d'audit contient "connexion" à 10 h 00 et "déconnexion" à 10 h 30 pour Paul
    Et ni le mot de passe, ni le numéro, ni l'adresse réseau n'y figurent

  @securite @RG-002-16
  Scénario: Le blocage du numéro d'un compte est tracé
    Étant donné que 4 mots de passe faux ont été saisis pour le 6 99 00 11 22 depuis un nouvel appareil entre 9 h 55 et 9 h 58
    Quand un 5e mot de passe faux est saisi pour le 6 99 00 11 22 depuis un nouvel appareil
    Alors le journal d'audit contient "connexion bloquée" à 10 h 00 pour Paul

  @alternatif @RG-002-17
  Scénario: L'empreinte d'un mot de passe calculée avec d'anciens réglages est renforcée à la connexion
    Étant donné que l'empreinte du mot de passe de Paul a été calculée avec des réglages plus faibles que ceux en vigueur
    Quand Paul se connecte avec son mot de passe
    Alors Paul est connecté
    Et l'empreinte de son mot de passe utilise les réglages en vigueur
    Et Paul se connecte toujours avec "Bastos-Fade-2026"

  @erreur
  Scénario: Une panne du service n'ouvre aucune session
    Étant donné que le service GoMeCoiffer est momentanément indisponible
    Quand Paul se connecte avec son mot de passe
    Alors la connexion est refusée
    Et le motif indiqué est "Connexion impossible pour le moment. Réessayez dans quelques minutes."
    Et aucune session n'est ouverte
