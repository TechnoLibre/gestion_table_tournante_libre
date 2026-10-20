// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Registre des marques porteuses d'information et des textes (§ 14.5,
// § 7.5, § 7.6, § 7.7). Chaque entrée nomme le jeton qui la peint et chaque
// jeton sur lequel elle se peint ; verifierPalette (palette.js) mesure le
// seuil de chaque couple dans les deux thèmes, sous les trois dichromaties,
// et les épreuves de rendu atteignent la marque par data-marque, qui porte
// son nom.
//
// Les remplissages d'une chaise sont son fond, son remplissage plein et les
// deux couleurs de la hachure — des traits --couleur-hachure sur le fond de
// la chaise : une marque posée sur une chaise se mesure sur chacun.
//
// Deux registres de marques : MARQUES, celles que les écrans rendent sous
// data-marque et que les épreuves de rendu mesurent sur ce qui est peint
// dessous ; SIGNES, celles des pastilles, des messages, de la bande de mode
// et de l'action principale, qui se valident par calcul sur chacun de leurs
// fonds. Un signe ne porte jamais seul une information : un libellé
// l'accompagne toujours.
//
// La famille « graphique » (§ 12.7, § 13.3) a ses listes :
// MARQUES_GRAPHIQUE et TEXTES_GRAPHIQUE, de même forme, versées à la fin de
// MARQUES et de TEXTES — les écrans de la page de qualité les rendent, et la
// garde transversale exige que chaque entrée de MARQUES soit rendue sur un
// écran ; FONDS_GRAPHIQUE, la grille et le niveau 0, qui ne portent aucune
// information et restent hors de toute mesure.

const c = (nom) => `--couleur-${nom}`;

const REMPLISSAGES_CHAISE = ['chaise-fond', 'chaise-pleine', 'hachure'];

function entree(nom, jeton, fonds, seuil) {
  return Object.freeze({ nom, jeton: c(jeton), fonds: Object.freeze(fonds.map(c)), seuil });
}

const marque = (nom, jeton, fonds) => entree(nom, jeton, fonds, 3);
const texte = (nom, jeton, fonds) => entree(nom, jeton, fonds, 4.5);

// Les sortes de conflit : règle, marque de la trame, jeton court, forme.
const SORTES_CONFLIT = [
  ['separerOrganisations', 'trameOrganisation', 'conflit-organisation', 'hachuresDescendantes'],
  ['nouveauxVoisins', 'trameVoisins', 'conflit-voisins', 'hachuresMontantes'],
  ['nouvelleTable', 'trameTable', 'conflit-table', 'points'],
];

/** Les trois sortes de conflit qu'une table porte (§ 7.5, § 12.7), une par
 *  règle que le moteur localise (conflitsParTable), dans son ordre — l'ordre
 *  du dessin, de la légende et de l'infobulle : { regle, marque, jeton,
 *  forme } — la règle du moteur, la marque data-marque de sa trame, le jeton
 *  de sa teinte, réservée à cette trame, et la forme de son motif
 *  (Motifs.svelte), qui la distingue sans la couleur. Deux règles violées à
 *  une même table superposent leurs trames : les hachures descendantes et
 *  montantes se croisent en quadrillage, les points se posent par-dessus. */
export const CONFLITS = Object.freeze(
  SORTES_CONFLIT.map(([regle, trame, jeton, forme]) => Object.freeze({ regle, marque: trame, jeton: c(jeton), forme })),
);

/** Les jetons des teintes de conflit, dans l'ordre de CONFLITS. */
export const JETONS_CONFLIT = Object.freeze(CONFLITS.map(({ jeton }) => jeton));

/** Le jeton du rouge du retrait (§ 12.7) : la croix cerclée d'une commande
 *  qui retire (Commande, variante retrait), sur la carte et son fond sourd,
 *  jamais sur le plan. C'est le seul jeton chromatique admis à moins de 30°
 *  d'une teinte de conflit (verifierTeintesReservees, palette.js) : le
 *  canal chromatique que les conflits se réservent est celui du plan, où il
 *  ne se pose pas. */
export const JETON_RETRAIT = c('retrait');

/** Écarts perçus minimaux d'une teinte de conflit, en distance OKLab × 100
 *  mesurée en couleurs d'origine et sous chaque dichromatie (ecartPercu,
 *  palette.js) : entreConflits, d'une teinte de conflit à une autre — la
 *  couleur redit la forme de la règle ; autresMarques, d'une teinte de
 *  conflit à chaque autre marque du plan. Le second seuil est plus bas : les
 *  gris du mobilier occupent la clarté où une teinte de conflit tient 3:1
 *  sur le plateau sombre, et la forme distingue toujours la trame de ce
 *  qu'elle côtoie. Sa valeur, 5, ne vient d'aucune référence de perception :
 *  elle se pose juste sous la plus petite séparation que la palette tient
 *  entre une teinte de conflit et une autre marque, et garde la palette de
 *  reculer sans établir qu'un écart de 5 se perçoit. */
export const SEPARATIONS = Object.freeze({ entreConflits: 12, autresMarques: 5, entreOrganisations: 10, clarteOrganisations: 10 });

/** La palette catégorielle des organisations, sur les listes seulement —
 *  jamais sur le plan, dont le canal chromatique appartient aux conflits :
 *  { rang, marque, fond }, rang de 1 à n, le jeton de son point et celui du
 *  fond de sa pastille. Ses marques se séparent deux à deux de
 *  SEPARATIONS.entreOrganisations sous les trois dichromaties, et deux
 *  teintes voisines de SEPARATIONS.clarteOrganisations en clarté
 *  (verifierClartes) : six teintes au plus tiennent ces deux seuils à 3:1
 *  sur la carte. Au-delà de n organisations, la pastille est neutre
 *  (organisations.js). */
export const TEINTES_ORGANISATION = Object.freeze(
  [1, 2, 3, 4, 5, 6].map((rang) =>
    Object.freeze({ rang, marque: c(`organisation-${rang}-marque`), fond: c(`organisation-${rang}-fond`) }),
  ),
);

// Les surfaces de contenu sur lesquelles une pastille se pose.
const SURFACES = ['carte-fond', 'carte-fond-sourd', 'page-fond'];
// Les teintes d'une pastille dont la marque se pose aussi hors de son fond.
const TEINTES_DE_PASTILLE = [
  ['etatBrouillon', 'etat-brouillon'],
  ['etatPropose', 'etat-propose'],
  ['etatRetenu', 'etat-retenu'],
  ['etatBloque', 'etat-bloque'],
  ['neutre', 'neutre'],
  ...TEINTES_ORGANISATION.map(({ rang }) => [`organisation${rang}`, `organisation-${rang}`]),
];

/** Les signes, même forme que MARQUES, seuil 3 : l'icône ou le point d'une
 *  pastille sur son fond teinté et sur les surfaces de contenu ; l'icône
 *  d'un message sur son fond ; l'icône de la bande de mode, de la teinte de
 *  son mode, sur le fond de la bande ; le fond de l'action principale,
 *  qui délimite le bouton, sur les surfaces. */
export const SIGNES = Object.freeze([
  ...TEINTES_DE_PASTILLE.map(([nom, teinte]) => marque(nom, `${teinte}-marque`, [`${teinte}-fond`, ...SURFACES])),
  marque('signeAvis', 'avis-marque', ['avis-fond']),
  marque('signeRefus', 'refus-marque', ['refus-fond']),
  marque('signeInformation', 'information-marque', ['information-fond']),
  marque('bandeEcriture', 'mode-ecriture', ['mode-ecriture-fond']),
  marque('bandeLecture', 'mode-lecture', ['mode-lecture-fond']),
  marque('bandeBloque', 'mode-bloque', ['mode-bloque-fond']),
  marque('actionPrincipale', 'action-fond', SURFACES),
]);

// --- La famille « graphique » (§ 12.7, § 13.3, D30, D43) ---------------------

const graphique = (nom) => `graphique-${nom}`;

/** L'échelle séquentielle des graphiques — la matrice des rencontres et la
 *  grille tables × tours (D33, D35) : quatre niveaux, 0, 1, 2, 3 et plus,
 *  { niveau, jeton, encre }, encre le jeton du compte écrit dans la case.
 *  Une seule teinte ; la clarté s'éloigne du fond de la carte du niveau 0
 *  au niveau 3, dans chaque thème : du clair au foncé dans le clair, du
 *  sombre au clair dans le sombre. Deux encres neutres, nommées d'après le
 *  thème clair : l'encre foncée sert les niveaux 0 et 1, les plus proches
 *  du fond, l'encre claire les niveaux 2 et 3. Le thème sombre inverse
 *  l'échelle et, avec elle, la clarté des deux encres, qui gardent leurs
 *  niveaux : une même déclaration se mesure dans les deux thèmes. */
export const NIVEAUX_GRAPHIQUE = Object.freeze(
  [
    [0, 'encre-foncee'],
    [1, 'encre-foncee'],
    [2, 'encre-claire'],
    [3, 'encre-claire'],
  ].map(([niveau, encre]) =>
    Object.freeze({ niveau, jeton: c(graphique(`niveau-${niveau}`)), encre: c(graphique(encre)) }),
  ),
);

/** Les seuils de l'échelle : ecartTeinte, le plus grand écart de teinte HSL
 *  admis entre deux niveaux, en degrés — une échelle est une seule teinte ;
 *  clarte, le pas minimal dont chaque niveau s'éloigne du fond de la carte
 *  de plus que le précédent, en L d'OKLab × 100. */
export const ECHELLE_GRAPHIQUE = Object.freeze({ ecartTeinte: 6, clarte: 10 });

// Le fond de la zone de tracé : la carte, et la grille de fond qu'une
// marque tracée croise.
const TRACE = ['carte-fond', graphique('grille')];

/** Les marques des graphiques, même forme que MARQUES, seuil 3 : les deux
 *  séries, mesurées aussi sur la page ; le repère d'un plafond (trait mixte)
 *  et celui d'une borne (pointillé), neutres, chacun son jeton (D30) ;
 *  l'axe ; les deux segments d'une barre de collisions, « prouvé
 *  inévitable » et « reste » ; les niveaux 1 à 3 de l'échelle et la bordure
 *  d'une case, sur la carte ; le signe d'un point marqué. Le niveau 0 et la
 *  grille n'en sont pas (FONDS_GRAPHIQUE). */
export const MARQUES_GRAPHIQUE = Object.freeze([
  marque('graphiqueSerie1', graphique('serie-1'), [...TRACE, 'page-fond']),
  marque('graphiqueSerie2', graphique('serie-2'), [...TRACE, 'page-fond']),
  marque('graphiqueRepere', graphique('repere'), TRACE),
  marque('graphiqueBorne', graphique('borne'), TRACE),
  marque('graphiqueAxe', graphique('axe'), ['carte-fond']),
  marque('graphiqueProuve', graphique('prouve'), TRACE),
  marque('graphiqueReste', graphique('reste'), TRACE),
  ...NIVEAUX_GRAPHIQUE.filter(({ niveau }) => niveau > 0).map(({ niveau }) =>
    marque(`graphiqueNiveau${niveau}`, graphique(`niveau-${niveau}`), ['carte-fond']),
  ),
  marque('graphiqueBordureCase', graphique('bordure-case'), ['carte-fond']),
  marque('graphiqueMarque', graphique('marque'), TRACE),
]);

// Les niveaux qu'une encre sert, en noms courts de jetons.
const niveauxServis = (encre) =>
  NIVEAUX_GRAPHIQUE.filter((n) => n.encre === c(graphique(encre))).map(({ niveau }) => graphique(`niveau-${niveau}`));

/** Les encres des comptes écrits dans les cases, même forme que TEXTES,
 *  seuil 4,5 : une entrée par encre, dans l'ordre des niveaux, mesurée sur
 *  chaque niveau que NIVEAUX_GRAPHIQUE lui donne. */
export const TEXTES_GRAPHIQUE = Object.freeze([
  texte('graphiqueEncreFoncee', graphique('encre-foncee'), niveauxServis('encre-foncee')),
  texte('graphiqueEncreClaire', graphique('encre-claire'), niveauxServis('encre-claire')),
]);

/** Les fonds des graphiques, { nom, jeton } : la grille de fond et le
 *  niveau 0 de l'échelle. Ils ne portent aucune information que la bordure
 *  et le chiffre d'une case ne portent déjà : hors de la mesure 3:1, sans
 *  seuil, et sans data-marque — un fond n'est pas une marque. */
export const FONDS_GRAPHIQUE = Object.freeze(
  [
    ['graphiqueGrille', 'grille'],
    ['graphiqueNiveau0', 'niveau-0'],
  ].map(([nom, jeton]) => Object.freeze({ nom, jeton: c(graphique(jeton)) })),
);

/** Les marques porteuses d'information (§ 14.5) : { nom, jeton, fonds, seuil: 3 } — nom, la
 *  désignation data-marque ; jeton, celui qui la peint ; fonds, chaque jeton sur lequel elle
 *  se peint, chaque remplissage d'une chaise pour une marque qui passe sur une chaise. Celles
 *  du plan et des écrans, puis celles des graphiques (MARQUES_GRAPHIQUE), les mêmes entrées. */
export const MARQUES = Object.freeze([
  // Sur la chaise (§ 7.6) : cadenas posés sur ses remplissages ; l'anneau
  // l'entoure, sur le sol et le bord du plateau qu'elle touche.
  marque('cadenasFerme', 'marque', REMPLISSAGES_CHAISE),
  marque('cadenasOuvert', 'marque', REMPLISSAGES_CHAISE),
  marque('anneau', 'marque', ['sol', 'table-fond', ...REMPLISSAGES_CHAISE]),
  marque('hachure', 'hachure', ['chaise-fond']),
  marque('remplissagePlein', 'chaise-pleine', ['sol', 'table-fond']),
  // Le conflit (§ 7.5) : contour épaissi sur le sol, commun aux trois
  // règles et peint de l'encre forte du plan ; une trame par règle violée
  // sur le plateau, chacune de sa teinte, ses traits détachés par un halo
  // du fond du plateau ; pastille chiffrée près de la table.
  marque('contourConflit', 'contour-fort', ['sol', 'table-fond']),
  ...SORTES_CONFLIT.map(([, trame, jeton]) => marque(trame, jeton, ['table-fond'])),
  marque('pastille', 'pastille-fond', ['sol', 'table-fond']),
  marque('poignee', 'poignee', ['sol']),
  marque('gel', 'gel', ['sol', 'table-fond']),
  // La désignation se pose sur la page, le sol, le plateau et une chaise
  // vide, pourvue ou à pourvoir : chacun de ses remplissages est un fond.
  marque('miseEnEvidence', 'mise-en-evidence', ['page-fond', 'sol', 'table-fond', ...REMPLISSAGES_CHAISE]),
  // La sélection marque aussi une colonne du tableau des propositions, sur la
  // carte, son fond sourd et la ligne du retenu.
  marque('selection', 'selection', ['page-fond', 'carte-fond', 'carte-fond-sourd', 'etat-retenu-fond', 'sol', 'table-fond', ...REMPLISSAGES_CHAISE]),
  marque('focus', 'focus', ['page-fond', 'bandeau-fond', 'carte-fond', 'carte-fond-sourd', 'etat-retenu-fond', 'action-teinte', 'sol', 'table-fond', ...REMPLISSAGES_CHAISE]),
  // Le mobilier sur le sol : le trait de la table, celui de la chaise, qui
  // touche aussi le plateau.
  marque('contourTable', 'table-trait', ['sol']),
  marque('contourChaise', 'chaise-trait', ['sol', 'table-fond']),
  // L'échelle graphique (§ 7.7) vit dans la surface du plan, sur le sol ou la
  // page ; le fantôme d'un glissement passe sur le sol, les tables et les
  // chaises.
  marque('echelle', 'echelle', ['sol', 'page-fond']),
  marque('fantome', 'fantome', ['sol', 'table-fond', ...REMPLISSAGES_CHAISE]),
  // Le signe du chargement d'une valeur de la liste des événements (§ 8.1) :
  // un arc tracé de l'encre secondaire, dans une cellule du tableau, sur la
  // carte.
  marque('chargement', 'page-texte-secondaire', ['carte-fond']),
  // Le filigrane BROUILLON (§ 11.7) : un texte au trait, par-dessus le
  // contenu d'une feuille imprimée, mesuré sur le papier, clair dans les
  // deux thèmes.
  marque('filigrane', 'filigrane', ['papier']),
  // La croix cerclée d'un retrait, seul contenu de son bouton : sur la
  // carte, et sur son fond sourd, celui du survol.
  marque('retrait', 'retrait', ['carte-fond', 'carte-fond-sourd']),
  // Les graphiques de la page de qualité (§ 12.7).
  ...MARQUES_GRAPHIQUE,
]);

// Les fonds teintés d'une pastille : ceux de ses teintes, puis ceux des
// messages, qu'un statut reprend, et la teinte de l'action.
const FONDS_ETIQUETTE = [
  ...TEINTES_DE_PASTILLE.map(([, teinte]) => `${teinte}-fond`),
  'avis-fond',
  'refus-fond',
  'information-fond',
  'action-teinte',
];

/** Les textes et leurs fonds, même forme, seuil 4,5 : page, secondaire,
 *  bandeau, refus, avis, listes du plan sur le sol, pastille du plan, numéro
 *  d'une table sur son plateau, que son halo prolonge sous les trames ; puis
 *  l'encre de la page sur la carte, l'encre secondaire sur la carte, le
 *  texte d'une étiquette — l'encre de la page sur chaque fond teinté de
 *  pastille (§ 12.7) —, celui de la bande de mode, la version et la
 *  provenance du bandeau, le thème retenu du bandeau, aux couleurs du
 *  bandeau inversées, le texte de l'action principale, un lien ou un texte
 *  mis en valeur de l'encre de l'action, et l'information. Le refus, l'avis
 *  et l'information gardent l'encre de leur message, sur son fond. Puis les
 *  deux encres des comptes d'une case de graphique (TEXTES_GRAPHIQUE), les
 *  mêmes entrées. */
export const TEXTES = Object.freeze([
  texte('page', 'page-texte', ['page-fond']),
  texte('secondaire', 'page-texte-secondaire', ['page-fond']),
  texte('bandeau', 'bandeau-texte', ['bandeau-fond']),
  texte('refus', 'refus', ['page-fond', 'refus-fond', 'carte-fond']),
  texte('avis', 'avis', ['page-fond', 'avis-fond', 'carte-fond']),
  texte('listes', 'liste-texte', ['sol']),
  texte('pastille', 'pastille-texte', ['pastille-fond']),
  texte('numeroTable', 'liste-texte', ['table-fond']),
  texte('carte', 'page-texte', ['carte-fond', 'carte-fond-sourd']),
  texte('secondaireCarte', 'page-texte-secondaire', ['carte-fond', 'carte-fond-sourd']),
  texte('etiquette', 'page-texte', FONDS_ETIQUETTE),
  texte('bandeMode', 'page-texte', ['mode-ecriture-fond', 'mode-lecture-fond', 'mode-bloque-fond']),
  texte('bandeauSecondaire', 'bandeau-texte-secondaire', ['bandeau-fond']),
  texte('bandeauChoisi', 'bandeau-fond', ['bandeau-texte']),
  texte('action', 'action-texte', ['action-fond']),
  texte('lien', 'action-encre', ['page-fond', 'carte-fond', 'carte-fond-sourd', 'action-teinte']),
  texte('information', 'information', ['information-fond', 'page-fond', 'carte-fond']),
  ...TEXTES_GRAPHIQUE,
]);
