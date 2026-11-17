---
name: clean-code
description: "Qualité du code au niveau classe/fonction pour GoMeCoiffer (back NestJS/TypeScript + front React/TypeScript) — SOLID comme détecteurs de smells, patterns appliqués seulement sur une force nommée, garde-fous anti-overengineering (YAGNI/KISS/règle de trois), règles strictes sur les commentaires. À charger avant d'écrire ou refactorer du code, en complément de ddd/hexagonal (macro) : ce skill couvre le micro. Biais assumé : la simplicité par défaut."
---

# Clean code — SOLID, patterns, anti-overengineering (GoMeCoiffer)

> Complète ddd/hexagonal (structure) au niveau **classe/fonction**. Fil rouge : **la chose la plus simple
> qui fait passer le test**. On n'ajoute une abstraction que pour un besoin **présent et nommé**.

## SOLID = détecteurs de smells (pas une cérémonie)

L'archi en donne déjà : **DIP** = ports dans `domain/` liés par token ; **SRP** = un handler CQRS par cas
d'usage ; **OCP** = subscribers d'événements ; **ISP** = repositories focalisés ; **LSP** = repository TypeORM
et fake in-memory interchangeables. Ne les rejoue pas — traque seulement ce qui reste :

- **SRP** — une classe/fonction a **deux raisons de changer** (handler qui valide + calcule + persiste + envoie un SMS à la main au lieu de publier un événement) → sépare.
- **OCP** — un `switch` sur un type destiné à grossir → stratégie/polymorphisme **si** les cas se multiplient réellement (sinon un `switch` exhaustif sur union discriminée suffit, avec `satisfies never` dans le `default`).
- **LSP** — un fake ou un repository TypeORM qui jette « non supporté » ou ignore un paramètre (`salonId`) → c'est le contrat qui est mauvais.
- **ISP** — un repository/gateway gros dont chaque client n'utilise qu'une part → scinde.
- **DIP** — du code métier qui `new` une dépendance concrète (DataSource, client HTTP, `new Date()`, `randomUUID()`) → injecte le port.

## Patterns — seulement sur une force nommée

Applique un pattern **uniquement** si tu peux nommer la force présente. **Un pattern non justifié EST un
smell.** Ceux qui collent au code : **Factory statique** (`Booking.reserveAtSalon(...)`) · **Value Object**
(`Money`, `TimeRange`, `PhoneNumber`) · **Décorateur** (`TransactionalCommandBus`) · **Observer** (subscribers) ·
**Adapter / couche de traduction** (agrégateur de paiement, SMS) · **Builder** (tests). Pas de catalogue GoF.

## Garde-fous anti-overengineering (le cœur)

- **YAGNI / KISS** — code le besoin d'aujourd'hui (le PRD liste ce qui est **hors MVP** : avis, fidélité, chat, commissions automatiques, multi-intervenants… ne rien préparer pour eux).
- **Règle de trois** — pas d'abstraction avant la **3e** occurrence réelle ; deux cas similaires ≠ abstraction.
- **Test décisif** — avant d'abstraire : peux-tu nommer le **2e usage concret et présent** ? Non → inline.
- **Interfaces** — un **port** (repository, passerelle externe, horloge) garde une interface même à une seule implémentation (couture hexagonale, le fake de test est la 2e) ; une classe interne, NON.
- **Génériques TypeScript** — seulement quand deux types concrets les utilisent déjà ; pas de type utilitaire « pour plus tard ».
- **Simplicité** — préfère une fonction ou un objet simple à une hiérarchie ; **supprime avant d'ajouter**.

## Commentaires — par défaut, ON N'EN ÉCRIT PAS

**Le code** dit ce qu'il fait, **git** dit ce qui a changé, **`docs/*.md`** dit pourquoi l'architecture est
ainsi. Il ne reste au commentaire que **l'invariant non déductible du code, dont l'ignorance casse quelque chose.**

**Le test avant d'écrire** : « qu'est-ce qui casse si le prochain lecteur ne lit pas ça ? » Pas de réponse
concrète → tu ne l'écris pas.

**Interdits — à supprimer à vue, y compris dans l'existant que tu touches :**
- **Le journal des modifications** : « corrigé », « désormais », « avant ça valait X ». Ça va dans le commit (et `docs/EVOLUTIONS.md`).
- **La paraphrase** : le commentaire qui redit la ligne en français.
- **La pédagogie** : expliquer NestJS, TypeORM, React ou Redux. Un renvoi, pas un cours.
- **Le JSDoc qui reformule la signature** (`@param salonId l'id du salon`). Seulement s'il ajoute unité, borne, effet de bord.
- **La justification de séance** : répondre dans le code à un relecteur.
- **Le code commenté** : supprime — git le garde.
- **La mise en scène** : capitales, ⚠️ en série, paragraphes rhétoriques.

**Bornes, contrôlables :** un commentaire tient en **≤ 3 lignes** ; **aucun bloc > 5 lignes** ; un fichier
au-delà de **~15 %** de lignes de commentaire est suspect.

> **Une prose fausse est pire que pas de prose** : elle dissuade le suivant de vérifier.

## Limites concrètes (garde-fous, pas dogme)

- Fonctions courtes, **peu de paramètres** (objet nommé au-delà de 3) ; pas de **paramètre booléen** → fonction à l'intention explicite (`markNoShow()` plutôt que `setStatus('NO_SHOW')`).
- **Early-return** plutôt qu'imbrication ; pas de nesting > 2-3 niveaux.
- Noms tirés du **langage métier du salon** (skill ddd §1) ; pas d'abréviations obscures.
- Immuabilité par défaut : `readonly`, `as const`, `ReadonlyArray`, pas de mutation de paramètre.
- TypeScript strict : pas de `any` (`unknown` + garde), pas de `!` non justifié hors entités TypeORM, unions discriminées plutôt que booléens multiples, `satisfies` pour les tables de constantes.
- Pas de `null` et `undefined` mélangés pour le même sens : choisir et s'y tenir dans un module.

## Spécifique front (React)

- Logique **hors des composants** (use-case / hook `use*`) ; un composant qui calcule du métier = smell.
- Pas de **prop-drilling** profond ni de thunk dupliqué.
- Composants **petits et composables** ; réutilise `components/ui/` (shadcn) avant d'en créer ; pas de composant « générique » avant un 2e usage réel.
- React Compiler actif : pas de `useMemo`/`useCallback` réflexe.

## Avant de conclure

- [ ] Chaque abstraction ajoutée répond-elle à un besoin **présent et nommé** ?
- [ ] Le smell détecté a-t-il reçu le fix **minimal** (ni sous- ni sur-corrigé) ?
- [ ] Aurais-tu pu faire **plus simple** à couverture de test égale ?
- [ ] Chaque commentaire survivant porte-t-il un **invariant non déductible**, en ≤ 3 lignes ?
