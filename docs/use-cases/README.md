# Use cases — GoMeCoiffer

Index des use cases produits par `use-case-writer` à partir du PRD (`docs/cahier-des-charges/prd.md`). Une ligne
par use case ; numérotation continue. L'inventaire des exigences, les anomalies du PRD et la traçabilité vivent
dans `exigences.md` (créé à la première passe). Les scénarios exécutables sont dans `features/<module>/`.

| ID | Titre | Acteur | Module | Exigences | Priorité | Statut |
|---|---|---|---|---|---|---|
| [UC-001](UC-001-creer-son-compte-proprietaire.md) | Créer son compte propriétaire | futur propriétaire | `identity` | EX-001, EX-011, EX-012, EX-018, EX-019, EX-020, EX-023, EX-025, D-017, D-018 | Must | Prêt pour dev |
| [UC-002](UC-002-se-connecter.md) | Se connecter et se déconnecter | membre du personnel (propriétaire, collaborateur), administrateur GoMeCoiffer | `identity` | EX-001, EX-006, EX-009, EX-011, EX-018, EX-020, EX-024, EX-025, EX-029, D-004, D-017, D-018, D-019, D-020 | Must | Prêt pour dev |
| [UC-003](UC-003-reinitialiser-son-mot-de-passe.md) | Réinitialiser son mot de passe (mot de passe oublié) | membre du personnel non connecté | `identity` | EX-001, EX-018, EX-020, EX-024, EX-025, EX-029, D-004, D-017, D-018, D-019, D-020, D-021, D-023, D-025, D-028 | Must | Prêt pour dev |
| [UC-004](UC-004-creer-son-organisation.md) | Créer son organisation et son premier salon | utilisateur connecté sans organisation (propriétaire, collaborateur d'un autre salon, administrateur GoMeCoiffer) | `organizations` (+ `identity` : `GetMySession` ; `shared` : `ActorRights`) | EX-002, EX-003, EX-005, EX-006, EX-008, EX-009, EX-011, EX-012, EX-014 (en partie), EX-019, EX-020, EX-021, EX-023, EX-024, EX-025, EX-026, EX-030, EX-033, EX-034, D-003, D-004, D-007, D-027, D-035, D-036, D-037, D-038 | Must | Prêt pour dev |
| [UC-005](UC-005-ouvrir-et-changer-de-salon.md) | Ouvrir et changer de salon (salon actif) | membre du personnel d'un ou plusieurs salons (propriétaire, collaborateur, administrateur GoMeCoiffer membre d'un salon) | `organizations` (+ `identity` : `GetMySession` ; `shared` : session, suivi en direct, `ActorRights`) | EX-002, EX-004, EX-006, EX-007, EX-008, EX-009, EX-010 (en partie), EX-011, EX-020, EX-024, EX-033 (en partie), EX-036 (en partie), D-003, D-004, D-026, D-027, D-028, D-031, D-037, D-039, D-040, D-041 | Must | Prêt pour dev |
| UC-010 | Ajouter un salon à son organisation | propriétaire d'une organisation | `organizations` | EX-002, EX-003, EX-008, EX-033, D-035 (unicité du nom de salon dans l'organisation), D-041 (appartenance « Propriétaire » créée sur chaque nouveau salon) | Must | À rédiger |
