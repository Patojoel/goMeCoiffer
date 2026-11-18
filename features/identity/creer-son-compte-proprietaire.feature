# language: fr
@UC-001
Fonctionnalité: Créer son compte propriétaire
  Pour configurer son salon puis gérer ses rendez-vous,
  un responsable de salon crée son compte avec son numéro de téléphone,
  prouvé par un code SMS, et un mot de passe.

  Contexte:
    Étant donné que nous sommes le 18/11/2026 à 10 h 00, heure de Douala
    Et que les SMS sont envoyés normalement

  @nominal @RG-001-03 @EX-018 @EX-019
  Scénario: Un nouveau responsable crée son compte avec le code reçu par SMS
    Étant donné que Mireille Ndongo a demandé un code d'inscription pour le 6 77 12 34 56
    Et qu'elle a reçu le code "482913" par SMS
    Quand elle confirme son inscription avec le code "482913", le nom "Mireille Ndongo" et le mot de passe "Akwa-Tresses-27"
    Alors son compte est créé pour le +237677123456
    Et elle est connectée
    Et on l'invite à créer son organisation

  @nominal @RG-001-13 @EX-011 @EX-012 @securite
  Scénario: Un compte tout juste créé n'a aucun rôle
    Étant donné que Mireille Ndongo vient de créer son compte
    Quand elle ouvre l'administration GoMeCoiffer
    Alors l'accès est refusé
    Et elle n'appartient à aucun salon

  @alternatif @RG-001-10 @D-018
  Scénario: Le compte client léger d'une future propriétaire est complété, pas dupliqué
    Étant donné que le 6 77 12 34 56 est le compte client de Mireille, avec 2 réservations
    Et que Mireille a reçu le code "482913" pour s'inscrire avec ce numéro
    Quand elle confirme son inscription avec le code "482913", le nom "Mireille Ndongo" et le mot de passe "Akwa-Tresses-27"
    Alors il existe un seul compte pour le +237677123456
    Et ce compte retrouve ses 2 réservations

  @alternatif @RG-001-11 @RG-001-12 @securite
  Scénario: Un numéro déjà inscrit reçoit une information, pas un code
    Étant donné que Paul Ebode a déjà un compte avec mot de passe pour le 6 99 00 11 22
    Quand quelqu'un demande un code d'inscription pour le 6 99 00 11 22
    Alors l'écran affiché est le même que pour un nouveau numéro
    Et le 6 99 00 11 22 reçoit un SMS qui l'invite à se connecter, sans code

  @alternatif @RG-001-06
  Scénario: Un nouveau code annule le précédent
    Étant donné que Mireille a reçu le code "482913" à 10 h 00
    Et qu'elle a reçu le code "105377" à 10 h 01
    Quand elle confirme son inscription avec le code "482913"
    Alors l'inscription est refusée
    Et le motif indiqué est "Code incorrect. Il vous reste 4 essais."

  @erreur @RG-001-02
  Plan du scénario: Seuls les numéros camerounais valides reçoivent un code
    Quand Mireille demande un code d'inscription pour le "<numéro saisi>"
    Alors la demande est <résultat>

    Exemples:
      | numéro saisi       | résultat  |
      | 6 77 12 34 56      | acceptée  |
      | +237 6 77 12 34 56 | acceptée  |
      | 2 22 23 45 67      | acceptée  |
      | 6 77 12 34 5       | refusée   |
      | 6 77 12 34 567     | refusée   |
      | +33 6 12 34 56 78  | refusée   |
      | 5 77 12 34 56      | refusée   |

  @erreur @RG-001-05
  Plan du scénario: Un nouveau code ne peut être demandé qu'après 60 secondes
    Étant donné que Mireille a reçu un code à 10 h 00 min 00 s
    Quand elle demande un nouveau code à <heure>
    Alors la demande est <résultat>

    Exemples:
      | heure          | résultat |
      | 10 h 00 min 59 s | refusée  |
      | 10 h 01 min 00 s | acceptée |

  @erreur @RG-001-05
  Scénario: Plus de 5 codes en une heure pour le même numéro sont refusés
    Étant donné que 5 codes ont été envoyés au 6 77 12 34 56 depuis 9 h 10
    Quand Mireille demande un nouveau code à 10 h 00
    Alors la demande est refusée
    Et le motif indiqué est "Trop de codes demandés pour ce numéro. Réessayez dans une heure ou contactez l'assistance."

  @erreur @RG-001-04
  Plan du scénario: Un code n'est valable que 5 minutes
    Étant donné que Mireille a reçu le code "482913" à 10 h 00 min 00 s
    Quand elle confirme son inscription avec le code "482913" à <heure>
    Alors l'inscription est <résultat>

    Exemples:
      | heure            | résultat |
      | 10 h 04 min 59 s | acceptée |
      | 10 h 05 min 01 s | refusée  |

  @erreur @RG-001-04 @securite
  Scénario: Après 5 essais faux, même le bon code est refusé
    Étant donné que Mireille a reçu le code "482913"
    Et qu'elle a saisi 5 codes faux
    Quand elle confirme son inscription avec le code "482913"
    Alors l'inscription est refusée
    Et le motif indiqué est "Trop d'essais. Demandez un nouveau code."
    Et aucun compte n'existe pour le +237677123456

  @erreur @RG-001-07
  Plan du scénario: Le mot de passe doit être difficile à deviner
    Étant donné que Mireille a reçu le code "482913" pour le 6 77 12 34 56
    Quand elle confirme son inscription avec le code "482913" et le mot de passe "<mot de passe>"
    Alors l'inscription est <résultat>

    Exemples:
      | mot de passe      | résultat                                         |
      | salon2026         | refusée : au moins 10 caractères                 |
      | motdepasse123     | refusée : mot de passe trop courant              |
      | 677123456ab       | refusée : ne doit pas contenir votre numéro      |
      | Akwa-Tresses-27   | acceptée                                         |

  @erreur @RG-001-08 @RG-001-09 @EX-018
  Plan du scénario: Le nom est obligatoire et l'e-mail, facultatif, doit être bien formé
    Étant donné que Mireille a reçu le code "482913" pour le 6 77 12 34 56
    Quand elle confirme son inscription avec le code "482913", le nom "<nom>" et l'e-mail "<e-mail>"
    Alors l'inscription est <résultat>

    Exemples:
      | nom              | e-mail               | résultat                         |
      | Mireille Ndongo  |                      | acceptée                         |
      | Mireille Ndongo  | mireille@gobeauty.cm | acceptée                         |
      | Mi               |                      | acceptée                         |
      | M                |                      | refusée : nom trop court         |
      |                  |                      | refusée : nom obligatoire        |
      | Mireille Ndongo  | mireille@            | refusée : e-mail mal formé       |

  @erreur @RG-001-07 @RG-001-03
  Scénario: Un mot de passe refusé ne fait pas perdre le code
    Étant donné que Mireille a reçu le code "482913"
    Et que son inscription a été refusée pour le mot de passe "salon2026"
    Quand elle confirme son inscription avec le code "482913" et le mot de passe "Akwa-Tresses-27"
    Alors son compte est créé pour le +237677123456

  @erreur @RG-001-15
  Scénario: Une panne du fournisseur SMS ne bloque pas les demandes suivantes
    Étant donné que le fournisseur SMS est indisponible
    Et que Mireille a demandé un code à 10 h 00 sans le recevoir
    Et que le fournisseur SMS fonctionne de nouveau
    Quand elle demande un code à 10 h 00 min 30 s
    Alors la demande est acceptée

  @erreur @RG-001-01 @securite
  Scénario: Deux confirmations simultanées ne créent qu'un seul compte
    Étant donné que Mireille a reçu le code "482913"
    Quand deux confirmations avec le code "482913" arrivent en même temps
    Alors une seule réussit
    Et il existe un seul compte pour le +237677123456

  @erreur @RG-001-16
  Scénario: L'inscription demande l'acceptation des conditions
    Quand Mireille demande un code d'inscription sans accepter les conditions d'utilisation
    Alors la demande est refusée
    Et le motif indiqué est "Acceptez les conditions d'utilisation pour continuer."

  @securite @RG-001-14
  Scénario: La création du compte est tracée sans secret
    Étant donné que Mireille a reçu le code "482913"
    Quand elle confirme son inscription avec le code "482913", le nom "Mireille Ndongo" et le mot de passe "Akwa-Tresses-27"
    Alors le journal d'audit contient "compte propriétaire créé" à 10 h 00
    Et ni le code ni le mot de passe n'y figurent
