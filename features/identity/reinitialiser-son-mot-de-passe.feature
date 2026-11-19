# language: fr
@UC-003
Fonctionnalité: Réinitialiser son mot de passe
  Pour retrouver l'accès à son salon après avoir oublié son mot de passe,
  un membre du personnel prouve qu'il possède son numéro par un code SMS
  et choisit un nouveau mot de passe, qui ferme ses anciennes sessions et lève les blocages de connexion.

  Contexte:
    Étant donné que nous sommes le 19/11/2026 à 10 h 00, heure de Douala
    Et que les SMS sont envoyés normalement
    Et que Paul Ebode, coiffeur, a un compte avec le mot de passe "Bastos-Fade-2026" pour le 6 99 00 11 22
    Et qu'Aïcha Mbarga a un compte client léger, sans mot de passe, pour le 6 55 44 33 22
    Et qu'aucun compte n'existe pour le 6 70 00 00 01

  @nominal @RG-003-07 @RG-003-11 @D-017 @EX-018
  Scénario: Un membre du personnel choisit un nouveau mot de passe avec le code reçu par SMS
    Étant donné que Paul a demandé un code de réinitialisation et a reçu le code "482913"
    Quand on confirme la réinitialisation pour le "6 99 00 11 22" avec le code "482913" et le nouveau mot de passe "Wouri-Degrade-2027"
    Alors Paul est connecté
    Et on l'invite à créer son organisation
    Et Paul se connecte désormais avec "Wouri-Degrade-2027"
    Et le mot de passe "Bastos-Fade-2026" est refusé

  @securite @RG-003-01 @RG-003-02 @D-019 @D-018
  Plan du scénario: La demande de code reçoit la même réponse quel que soit le numéro
    Quand on demande un code de réinitialisation pour le "<numéro>"
    Alors la demande est acceptée
    Et l'écran affiché est le même que pour le numéro de Paul
    Et ce qui est envoyé au <numéro> est <envoi>

    Exemples:
      | numéro        | situation                              | envoi               |
      | 6 99 00 11 22 | compte du personnel                    | un SMS avec un code |
      | 6 55 44 33 22 | compte client léger, sans mot de passe | rien                |
      | 6 70 00 00 01 | numéro sans compte                     | rien                |

  @securite @RG-003-02 @RG-003-14 @D-018 @D-019
  Plan du scénario: Sans compte du personnel, aucun code saisi ne permet de choisir un mot de passe
    Étant donné qu'un code de réinitialisation a été demandé pour le <numéro>
    Quand on confirme la réinitialisation pour le "<numéro>" avec le code "482913" et le nouveau mot de passe "Wouri-Degrade-2027"
    Alors la réinitialisation est refusée
    Et le motif indiqué est "Code incorrect. Il vous reste 4 essais."
    Et aucun mot de passe n'existe pour le <numéro>

    Exemples:
      | numéro        | situation                              |
      | 6 55 44 33 22 | compte client léger, sans mot de passe |
      | 6 70 00 00 01 | numéro sans compte                     |

  @erreur @RG-003-01
  Plan du scénario: Seuls les numéros camerounais valides sont acceptés
    Quand on demande un code de réinitialisation pour le "<numéro saisi>"
    Alors la demande est <résultat>

    Exemples:
      | numéro saisi       | résultat                    |
      | 6 99 00 11 22      | acceptée                    |
      | +237 6 99 00 11 22 | acceptée                    |
      | 6 99 00 11 2       | refusée : numéro mal formé  |
      | +33 6 12 34 56 78  | refusée : numéro mal formé  |

  @erreur @RG-003-04 @D-021
  Plan du scénario: Un nouveau code ne peut être demandé qu'après 60 secondes
    Étant donné que Paul a reçu un code de réinitialisation à 10 h 00 min 00 s
    Quand Paul demande un nouveau code de réinitialisation à <heure>
    Alors la demande est <résultat>

    Exemples:
      | heure            | résultat                                  |
      | 10 h 00 min 59 s | refusée : nouveau code possible dans 1 s  |
      | 10 h 01 min 00 s | acceptée                                  |

  @erreur @RG-003-04 @D-021 @D-023
  Plan du scénario: Au plus 5 codes par heure et 10 codes par 24 heures pour un même numéro
    Étant donné que <envois> ont été envoyés au 6 99 00 11 22 pour réinitialiser le mot de passe
    Quand Paul demande un code de réinitialisation à 10 h 00
    Alors la demande est <résultat>

    Exemples:
      | envois                                             | résultat                   |
      | 4 codes depuis 9 h 10                              | acceptée                   |
      | 5 codes depuis 9 h 10                              | refusée : trop de codes    |
      | 9 codes depuis hier 11 h 00, le dernier à 8 h 00   | acceptée                   |
      | 10 codes depuis hier 11 h 00, le dernier à 8 h 00  | refusée : trop de codes    |

  @securite @RG-003-04 @D-023
  Scénario: Après 10 codes faux en 24 heures, plus aucun code de réinitialisation n'est envoyé
    Étant donné que 10 codes de réinitialisation faux ont été saisis pour le 6 99 00 11 22 depuis hier 11 h 00
    Quand Paul demande un code de réinitialisation à 10 h 00
    Alors la demande est refusée
    Et le motif indiqué est "Trop de codes demandés pour ce numéro. Réessayez dans une heure ou contactez l'assistance."

  @securite @RG-003-04 @D-023
  Scénario: Les codes d'inscription ne comptent pas dans les limites de la réinitialisation
    Étant donné que 5 codes d'inscription ont été demandés pour le 6 99 00 11 22 depuis 9 h 10
    Quand Paul demande un code de réinitialisation à 10 h 00
    Alors la demande est acceptée
    Et le 6 99 00 11 22 reçoit un SMS avec un code

  @securite @RG-003-02 @RG-003-04 @D-019
  Scénario: Les demandes pour un numéro sans compte sont limitées comme les autres
    Étant donné que 5 codes de réinitialisation ont été demandés pour le 6 70 00 00 01 depuis 9 h 10
    Quand on demande un code de réinitialisation pour le "6 70 00 00 01" à 10 h 00
    Alors la demande est refusée
    Et le motif indiqué est "Trop de codes demandés pour ce numéro. Réessayez dans une heure ou contactez l'assistance."

  @erreur @RG-003-03
  Plan du scénario: Un code de réinitialisation n'est valable que 5 minutes
    Étant donné que Paul a reçu le code de réinitialisation "482913" à 10 h 00 min 00 s
    Quand on confirme la réinitialisation pour le "6 99 00 11 22" avec le code "482913" et le nouveau mot de passe "Wouri-Degrade-2027" à <heure>
    Alors la réinitialisation est <résultat>

    Exemples:
      | heure            | résultat                    |
      | 10 h 04 min 59 s | acceptée                    |
      | 10 h 05 min 00 s | refusée : code expiré       |

  @erreur @RG-003-03 @securite
  Scénario: Après 5 codes faux, même le bon code est refusé
    Étant donné que Paul a reçu le code de réinitialisation "482913"
    Et que 5 codes faux ont été saisis pour ce code
    Quand on confirme la réinitialisation pour le "6 99 00 11 22" avec le code "482913" et le nouveau mot de passe "Wouri-Degrade-2027"
    Alors la réinitialisation est refusée
    Et le motif indiqué est "Trop d'essais. Demandez un nouveau code."
    Et Paul se connecte toujours avec "Bastos-Fade-2026"

  @alternatif @RG-003-03
  Scénario: Un nouveau code de réinitialisation annule le précédent
    Étant donné que Paul a reçu le code de réinitialisation "482913" à 10 h 00
    Et qu'il a reçu le code de réinitialisation "105377" à 10 h 01
    Quand on confirme la réinitialisation pour le "6 99 00 11 22" avec le code "482913" et le nouveau mot de passe "Wouri-Degrade-2027"
    Alors la réinitialisation est refusée
    Et le motif indiqué est "Code incorrect. Il vous reste 4 essais."

  @erreur @RG-003-06 @D-020
  Plan du scénario: Le nouveau mot de passe doit être difficile à deviner
    Étant donné que Paul a reçu le code de réinitialisation "482913"
    Quand on confirme la réinitialisation pour le "6 99 00 11 22" avec le code "482913" et le nouveau mot de passe "<mot de passe>"
    Alors la réinitialisation est <résultat>

    Exemples:
      | mot de passe        | résultat                                    |
      | salon2026           | refusée : au moins 10 caractères            |
      | motdepasse123       | refusée : mot de passe trop courant         |
      | 699001122ab         | refusée : ne doit pas contenir votre numéro |
      | Wouri-Degrade-2027  | acceptée                                    |

  @erreur @RG-003-06
  Scénario: Un mot de passe refusé ne fait perdre ni le code ni un essai
    Étant donné que Paul a reçu le code de réinitialisation "482913"
    Et que sa réinitialisation a été refusée pour le mot de passe "salon2026"
    Quand on confirme la réinitialisation pour le "6 99 00 11 22" avec le code "482913" et le nouveau mot de passe "Wouri-Degrade-2027"
    Alors Paul est connecté
    Et Paul se connecte désormais avec "Wouri-Degrade-2027"

  @securite @RG-003-08 @D-028
  Scénario: La réinitialisation ferme toutes les sessions ouvertes de l'utilisateur
    Étant donné que Paul est connecté sur son téléphone et sur la tablette du salon
    Et que Paul a reçu le code de réinitialisation "482913" sur son téléphone
    Quand on confirme la réinitialisation depuis un autre navigateur pour le "6 99 00 11 22" avec le code "482913" et le nouveau mot de passe "Wouri-Degrade-2027"
    Alors les sessions de Paul sur son téléphone et sur la tablette ne donnent plus accès à rien
    Et Paul n'est connecté que sur le navigateur de la réinitialisation

  @securite @RG-003-08
  Scénario: Une connexion avec l'ancien mot de passe terminée pendant la réinitialisation ne donne pas accès
    Étant donné que Paul a reçu le code de réinitialisation "482913"
    Et qu'une connexion avec le mot de passe "Bastos-Fade-2026" se termine pendant la réinitialisation
    Quand la réinitialisation pour le "6 99 00 11 22" avec le code "482913" et le nouveau mot de passe "Wouri-Degrade-2027" est confirmée
    Alors la session ouverte par cette connexion ne donne plus accès à rien

  @alternatif @RG-003-09 @D-025
  Plan du scénario: La réinitialisation lève les blocages de connexion du numéro
    Étant donné que le 6 99 00 11 22 est <blocage>
    Et que Paul a réinitialisé son mot de passe avec "Wouri-Degrade-2027" à 10 h 00
    Quand Paul se connecte avec "Wouri-Degrade-2027" depuis un nouvel appareil à 10 h 05
    Alors Paul est connecté

    Exemples:
      | blocage                                                                  |
      | bloqué jusqu'à 10 h 15 après 5 mots de passe faux entre 9 h 55 et 9 h 59 |
      | bloqué pour la journée après 20 mots de passe faux depuis hier 11 h 00   |

  @securite @RG-003-09 @D-025
  Scénario: Les échecs saisis après la réinitialisation comptent normalement
    Étant donné que Paul a réinitialisé son mot de passe à 9 h 56
    Et que 5 mots de passe faux ont été saisis pour le 6 99 00 11 22 depuis un nouvel appareil entre 9 h 57 et 9 h 59
    Quand Paul se connecte avec son nouveau mot de passe depuis un nouvel appareil à 10 h 00
    Alors la connexion est refusée
    Et le motif indiqué est "Trop d'essais pour ce numéro. Réessayez dans 14 minutes ou utilisez « Mot de passe oublié »."

  @securite @RG-003-09
  Scénario: La réinitialisation ne lève pas le blocage d'une adresse réseau
    Étant donné que 30 connexions ont échoué depuis la même adresse réseau depuis 9 h 10, sur des numéros différents
    Et que Paul a réinitialisé son mot de passe depuis cette adresse à 10 h 00
    Quand Paul se connecte avec son nouveau mot de passe depuis cette adresse, sur un nouvel appareil
    Alors la connexion est refusée
    Et le motif indiqué est "Trop d'essais depuis ce réseau. Réessayez dans une heure ou connectez-vous depuis votre appareil habituel."

  @securite @RG-003-10
  Scénario: Les anciens appareils reconnus ne le sont plus après la réinitialisation
    Étant donné que Paul s'est connecté depuis son téléphone habituel le 10/11/2026
    Et que Paul a reçu le code de réinitialisation "482913"
    Quand on confirme la réinitialisation depuis la tablette du salon pour le "6 99 00 11 22" avec le code "482913" et le nouveau mot de passe "Wouri-Degrade-2027"
    Alors son téléphone habituel n'est plus reconnu comme un appareil habituel de Paul
    Et la tablette du salon est reconnue comme un appareil habituel de Paul

  @alternatif @RG-003-15 @RG-002-11
  Scénario: Une réinitialisation sur la tablette du salon remplace la session déjà ouverte
    Étant donné que Mireille Ndongo est connectée sur la tablette du salon
    Et que Paul a reçu le code de réinitialisation "482913"
    Quand on confirme la réinitialisation depuis cette tablette pour le "6 99 00 11 22" avec le code "482913" et le nouveau mot de passe "Wouri-Degrade-2027"
    Alors la tablette est connectée au compte de Paul
    Et l'ancienne session de Mireille sur la tablette ne donne plus accès à rien

  @securite @RG-003-13
  Scénario: Deux confirmations simultanées du même code ne réussissent qu'une fois
    Étant donné que Paul a reçu le code de réinitialisation "482913"
    Quand deux confirmations avec le code "482913" et le nouveau mot de passe "Wouri-Degrade-2027" arrivent en même temps
    Alors une seule réussit
    Et l'autre est refusée avec le motif "Ce code n'est plus valable. Demandez un nouveau code."

  @securite @RG-003-13 @D-023
  Scénario: Des demandes de code simultanées n'envoient qu'un seul SMS
    Quand 5 demandes de code de réinitialisation pour le "6 99 00 11 22" arrivent en même temps
    Alors un seul SMS est envoyé au 6 99 00 11 22
    Et les 4 autres demandes sont refusées pour renvoi trop tôt

  @securite @RG-003-12 @EX-025
  Scénario: La réinitialisation est tracée sans secret
    Étant donné que Paul a reçu le code de réinitialisation "482913"
    Quand on confirme la réinitialisation pour le "6 99 00 11 22" avec le code "482913" et le nouveau mot de passe "Wouri-Degrade-2027"
    Alors le journal d'audit contient "mot de passe réinitialisé" et "connexion" à 10 h 00 pour Paul
    Et ni le code, ni le mot de passe, ni le numéro, ni l'adresse réseau n'y figurent

  @erreur @RG-003-05
  Scénario: Une panne du fournisseur SMS ne bloque pas les demandes suivantes
    Étant donné que le fournisseur SMS est indisponible
    Et que Paul a demandé un code de réinitialisation à 10 h 00 sans le recevoir
    Et que le fournisseur SMS fonctionne de nouveau
    Quand Paul demande un code de réinitialisation à 10 h 00 min 30 s
    Alors la demande est acceptée
    Et le 6 99 00 11 22 reçoit un SMS avec un code

  @erreur @RG-003-01
  Scénario: Une demande sans jeton de sécurité est refusée sans rien compter
    Quand on demande un code de réinitialisation pour le "6 99 00 11 22" sans jeton de sécurité
    Alors la demande est refusée
    Et le motif indiqué est "Jeton de sécurité absent ou expiré : rechargez la page puis recommencez."
    Et aucun SMS n'est envoyé au 6 99 00 11 22

  @erreur
  Scénario: Une panne du service ne change ni le mot de passe ni les sessions
    Étant donné que Paul est connecté sur la tablette du salon
    Et que Paul a reçu le code de réinitialisation "482913"
    Et que le service GoMeCoiffer est momentanément indisponible
    Quand on confirme la réinitialisation pour le "6 99 00 11 22" avec le code "482913" et le nouveau mot de passe "Wouri-Degrade-2027"
    Alors la réinitialisation est refusée
    Et le motif indiqué est "Réinitialisation impossible pour le moment. Réessayez dans quelques minutes."
    Et Paul se connecte toujours avec "Bastos-Fade-2026"
    Et Paul est toujours connecté sur la tablette du salon
