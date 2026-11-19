# GoMeCoiffer — Guide d'usage du logo

## 1. Le logo

**L'idée** : le G de GoMe s'enroule en boucle de cheveu crépu, et le petit **m** en exposant fait lire « G puissance m », donc **GoMe**.

| Version | Quand l'utiliser | Fichier |
|---|---|---|
| Horizontale (principale) | site, en-têtes, documents, signature e-mail | `masters/gomecoiffer-horizontal.svg` |
| Empilée | enseigne, vitrine, affiche, réseaux sociaux | `masters/gomecoiffer-stacked.svg` |
| Symbole G^m | icône d'app, avatar, tampon, petits espaces | `masters/gomecoiffer-symbol.svg` |
| Symbole petite taille (G seul) | favicon, tout affichage sous 32 px | `masters/gomecoiffer-symbol-small.svg` |
| Nom seul | quand le symbole apparaît déjà ailleurs sur la page | `masters/gomecoiffer-wordmark.svg` |

Chaque version existe en **couleur** (`masters/`), en **inversé pour fond foncé** (`*-reversed`), en **version pour fond terre cuite** (`*-on-terra`), en **noir**, en **blanc** et en **bleu nuit seul** (`variants/`). PNG prêts à l'emploi dans `png/` et `variants/`.

- **Écran** : SVG en priorité, sinon PNG.
- **Impression** : SVG transmis à l'imprimeur, qui le convertit en PDF ou EPS. Les couleurs sont à caler sur épreuve (voir § 4).

## 2. Zone de protection

Autour du logo, laissez un espace vide égal à **la hauteur du petit m** sur les quatre côtés. Cet espace grandit avec le logo : ce n'est jamais une distance fixe.

## 3. Taille minimale

| Version | Écran | Impression |
|---|---|---|
| Horizontale | 120 px de large | 30 mm de large |
| Empilée | 80 px de large | 20 mm de large |
| Symbole G^m | 32 px | 8 mm |
| Sous ces tailles | G seul (`symbol-small`, favicon) | G seul |

À 16 px, le m devient illisible : c'est pour ça que la favicon n'utilise que le G.

## 4. Couleurs

| Nom | HEX | RVB | CMJN (approx.) | Rôle |
|---|---|---|---|---|
| **Bleu nuit** | `#17213B` | 23 · 33 · 59 | 61 · 44 · 0 · 77 | couleur principale : le G, le texte, les fonds foncés |
| **Terre cuite** | `#D2603A` | 210 · 96 · 58 | 0 · 54 · 72 · 18 | couleur signature : le m, « Me », les accents |
| **Ivoire** | `#F6EFE6` | 246 · 239 · 230 | 0 · 3 · 7 · 4 | fond clair chaleureux, logo inversé |

Les valeurs CMJN sont une conversion mathématique : faites valider les teintes par l'imprimeur sur épreuve. La référence Pantone est à choisir avec lui sur nuancier physique, car je ne l'ai pas vérifiée.

**Contrastes (accessibilité)**
- Le bleu nuit sur blanc (15,9:1) et l'ivoire sur bleu nuit (14:1) conviennent à tous les usages, texte compris.
- La terre cuite sur blanc (3,8:1) convient aux grands éléments (logo, titres, boutons au texte gras de 18 px ou plus). Elle ne convient **pas** au petit texte courant.

**Associations logo / fond autorisées**

| Fond | Version à utiliser |
|---|---|
| Blanc ou ivoire | couleur |
| Bleu nuit, ou très foncé | inversée (`*-reversed` : G ivoire, m terre cuite) |
| Terre cuite | **pour fond terre cuite** (`*-on-terra` : G bleu nuit, m ivoire), ou blanche (`*-white`) |
| Photo | blanche ou noire, sur une zone calme de la photo ; sinon logo posé dans un cartouche bleu nuit |
| Noir | inversée (`*-reversed` : G ivoire, m terre cuite), ou blanche |

## 5. Typographie

- **Logo** : Outfit SemiBold, vectorisée (déjà en tracés dans les fichiers : ne pas retaper le nom).
- **Titres de l'application et des supports** : Outfit (SemiBold, Bold).
- **Texte courant** : Outfit Regular, ou la police système (`system-ui, "Segoe UI", Roboto, sans-serif`).
- **Licence** : SIL Open Font License 1.1 (`fonts/OFL.txt`). L'usage commercial et dans un logo est autorisé, sans frais.

## 6. À ne pas faire

- Étirer, écraser, pencher ou faire pivoter le logo.
- Changer les couleurs hors palette, ou intervertir bleu nuit et terre cuite.
- Ajouter une ombre, un contour, un dégradé ou un effet.
- Déplacer le m, changer sa taille ou le retirer du symbole G^m (sauf la version petite taille prévue).
- Retaper « GoMeCoiffer » dans une police : toujours utiliser les fichiers fournis.
- Poser la version couleur sur un fond noir ou terre cuite : le G ou le m y disparaît. Chaque fond a sa version (§ 4).
- Poser le logo sur un fond chargé sans cartouche.

## 7. Fichiers

| Dossier | Contenu |
|---|---|
| `masters/` | fichiers maîtres SVG couleur et inversés |
| `variants/` | noir, blanc, bleu nuit seul (SVG + PNG 1200) |
| `png/` | PNG couleur haute définition |
| `web/` | favicon.ico et .svg (s'adapte au mode sombre), icônes 16 à 512, icône d'app, `site.webmanifest`, `head-snippet.html` |
| `presentation/` | planche de présentation (`presentation.html`) et diapositives PNG |
| `fonts/` | police Outfit et sa licence |
| `source/` | scripts qui régénèrent les fichiers (`python source/kit.py masters fonts/Outfit-Variable.ttf`, nécessite `fonttools`) |
