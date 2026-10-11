// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Classement des propositions (§ 5.7, A11) : un ordre explicite, celui que
// l'interface écrit, et non le n-uplet que descend la recherche. Il applique
// la compilation de l'instance (compilationDe, criteres.js) : palier par
// palier, dans l'ordre de la liste réglée, la clé d'un palier partagé est la
// somme, sur ses critères, du poids multiplié par la valeur qui classe ; un
// critère seul à son palier y compare ses valeurs l'une après l'autre, chacune
// multipliée par son poids. Toutes sont des entiers exacts, à minimiser ;
// deux propositions égales sur tous les paliers se départagent par
// identifiant croissant (§ 15.5, point 4), jamais par l'ordre reçu.
//
// Sans compilation, classer applique l'ordre fixe de référence : l'ordre par
// défaut sous les quatre cases cochées, sans objectif ni case des
// animateurs, que le registre compile en cinq paliers — écart, excédent,
// cumulées, rencontres répétées, redondance (A11).
//
// L'excédent de collisions précède les collisions cumulées dans l'ordre par
// défaut : un plan qui répartit six collisions sur six paires passe devant
// un plan qui en concentre quatre sur une seule (§ 5.4). Les paires
// distinctes ne sont pas une clé ; elles valent les cumulées moins l'excédent.
import {
  CRITERES as REGISTRE,
  PRIORITES_PAR_DEFAUT,
  compilationDe,
  estCoche,
  valeursQuiClassent,
} from './criteres.js';
import { ecartsAuPlafondAPriori } from './manque.js';

// Le critère qui lit le plafond a priori par personne : sauté quand il est
// inconnu (§ 17, point 4), avec son palier, où il est seul (A11).
const CRITERE_A_PRIORI = 'ecartAuPlafondAPrioriMax';

// Les cases de l'ordre fixe de référence : les quatre de ses critères,
// cochées ; celles des objectifs et des animateurs, décochées. Sans objectif
// ni case des animateurs, ces deux critères ne comptent pas — décochés comme
// ici, ou sans objet, la compilation est la même (D10).
const CASES_DE_REFERENCE = Object.freeze({
  separerAppartenances: true,
  nouveauxVoisins: true,
  nouvelleTable: true,
  varierAppartenances: true,
  respecterObjectifs: false,
  rencontrerAnimateurs: false,
});

// La compilation de l'ordre fixe de référence, l'état des critères construit
// comme normaliser le construit (configuration.js).
const REFERENCE = compilationDe({
  priorites: PRIORITES_PAR_DEFAUT,
  modeObjectifs: 'places',
  etatCriteres: REGISTRE.map((nom) => ({
    nom,
    coche: estCoche(nom, CASES_DE_REFERENCE),
    sansObjet: false,
    valeurs: valeursQuiClassent(nom, CASES_DE_REFERENCE, 'places'),
  })),
});

/**
 * Les noms des critères que l'ordre fixe de référence applique, palier après
 * palier : la liste aplatie des critères appliqués de classer sans
 * compilation, plafond a priori connu. Dérivée du registre, elle n'en recopie
 * aucun nom.
 */
export const CRITERES = Object.freeze(REFERENCE.paliers.flatMap(({ criteres }) => criteres.map(({ nom }) => nom)));

// Le plus grand élément d'une liste ; null pour une liste vide.
function plusGrand(valeurs) {
  let plus = null;
  for (const valeur of valeurs) if (plus === null || valeur > plus) plus = valeur;
  return plus;
}

// Chaque valeur qui classe, lue pour une proposition : { mesures, ecarts },
// ecarts étant ses écarts au plafond a priori. Chaque grandeur se lit dans
// la mesure ou dans manque.js, aucune ne se refait ici ; les tours hors
// objectif sont le horsObjectif de la mesure. La Map ne sert qu'à retrouver
// une valeur par son nom ; la compilation en fixe l'ordre.
const VALEUR = new Map([
  ['ecartAuPlafondAPrioriMax', ({ ecarts }) => plusGrand(ecarts)],
  ['excedentCollisions', ({ mesures }) => mesures.excedentCollisions],
  ['collisionsCumulees', ({ mesures }) => mesures.collisionsCumulees],
  ['toursHorsObjectif', ({ mesures }) => mesures.objectifs.horsObjectif],
  ['jamaisServies', ({ mesures }) => mesures.objectifs.jamaisServies],
  ['horsObjectifMax', ({ mesures }) => mesures.objectifs.horsObjectifMax],
  ['rencontresRepeteesChoisies', ({ mesures }) => mesures.rencontresRepetees.choisies],
  ['retoursChoisis', ({ mesures }) => mesures.totalRetoursChoisis],
  ['animateursNonRencontres', ({ mesures }) => mesures.animateurs.nonRencontres],
  ['redondance', ({ mesures }) => mesures.totalRedondance],
]);

// La lecture d'une valeur qui classe ; RangeError pour un nom qu'aucune
// lecture ne porte.
function lecture(valeur) {
  const lire = VALEUR.get(valeur);
  if (lire === undefined) throw new RangeError(`valeur de classement inconnue : ${valeur}`);
  return lire;
}

// Les composantes de la clé de classement d'un palier, chacune une liste de
// termes [poids, lecture] à sommer : une par valeur pour un critère seul à
// son palier, une seule, la somme pondérée de chaque critère sur sa valeur,
// pour un palier partagé. Un critère qui classe deux valeurs est seul à son
// palier (criteres.js) ; RangeError s'il ne l'est pas.
function composantesDuPalier({ criteres }) {
  if (criteres.length === 1) {
    const [{ poids, valeurs }] = criteres;
    return valeurs.map((valeur) => [[poids, lecture(valeur)]]);
  }
  return [criteres.map(({ nom, poids, valeurs }) => {
    if (valeurs.length !== 1) throw new RangeError(`critère ${nom} : ${valeurs.length} valeurs dans un palier partagé`);
    return [poids, lecture(valeurs[0])];
  })];
}

// Lève TypeError pour un identifiant qui n'est pas un entier, et RangeError
// pour un identifiant répété : deux entrées de même identifiant ne se
// départagent pas. L'ensemble ne sert qu'à retrouver un identifiant déjà vu.
function exigerIdentifiants(entrees) {
  const vus = new Set();
  for (const { id } of entrees) {
    if (!Number.isInteger(id)) {
      throw new TypeError(`proposition d'identifiant ${String(id)} : entier attendu`);
    }
    if (vus.has(id)) throw new RangeError(`proposition ${id} : identifiant répété`);
    vus.add(id);
  }
}

// Lève RangeError quand deux entrées mesurent des populations de tailles
// différentes : leurs chiffres ne se comparent pas. Les mesures ne portent
// aucun identifiant de personne : deux populations de même taille mais de
// personnes différentes passent, et l'appelant en répond (voir classer).
function exigerMemeTaille(entrees) {
  const [premiere] = entrees;
  for (const { id, mesures } of entrees) {
    const taille = mesures.rencontres.length;
    const attendue = premiere.mesures.rencontres.length;
    if (taille !== attendue) {
      throw new RangeError(
        `proposition ${id} : ${taille} personnes mesurées, `
          + `${attendue} pour la proposition ${premiere.id}`,
      );
    }
  }
}

// Ordre lexicographique de deux clés de même longueur. Sur une population
// vide, le plus grand écart au plafond a priori vaut null pour chaque entrée,
// que son poids ramène à 0 : toutes y sont égales.
function comparerCles(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/**
 * Ordre des propositions (§ 5.7, A11), la meilleure d'abord : palier par
 * palier dans l'ordre de la compilation, chacun croissant, puis identifiant
 * croissant (en-tête du module).
 *
 * Chaque entrée porte id, l'identifiant entier de la proposition ; mesures,
 * telles que mesurer les rend ; plafondsAPriori, la liste de plafond.js, ou
 * null quand le plafond a priori est inconnu (§ 17, point 4). Une seule
 * entrée à plafond a priori inconnu fait sauter, pour toutes, le palier de
 * l'écart au plafond a priori, où il est seul : critereSaute le nomme,
 * criteresAppliques omet ce palier, et rangSaute est son rang, à partir de
 * 0, dans la compilation — criteresAppliques[rangSaute] est le palier qui
 * prend sa place, absent quand aucun ne le suit. Sinon critereSaute et
 * rangSaute valent null.
 *
 * compilation : ce que rend compilationDe (criteres.js) pour l'instance
 * mesurée ; par défaut, l'ordre fixe de référence. criteresAppliques porte,
 * par palier appliqué dans son ordre, ses critères {nom, valeurs, poids},
 * des copies : valeurs, les grandeurs qu'il classe, comparées dans l'ordre.
 * Sous l'ordre par défaut et les quatre cases cochées, la liste aplatie des
 * noms égale CRITERES.
 *
 * Toutes les entrées sont mesurées sur une même population : leurs chiffres
 * ne se comparent qu'à cette condition. classer n'en contrôle que la taille,
 * les mesures ne portant aucun identifiant de personne ; deux populations de
 * même taille mais de personnes différentes, après une exclusion et un ajout
 * (§ 9, § 12.6), passent sans bruit. Les identifiants sont uniques parmi les
 * entrées, et rechercher numérote les propositions de chaque génération de 1
 * à nombre : l'appelant qui accumule des générations (§ 5.7) les partitionne
 * par population, et donne à chaque proposition un identifiant unique à
 * travers les générations.
 *
 * Lève TypeError pour un identifiant qui n'est pas un entier, ou un
 * plafondsAPriori qui n'est ni une liste ni null ; RangeError pour un
 * identifiant répété, pour des mesures de populations de tailles
 * différentes, pour un plafond a priori qui n'a pas une case par personne
 * mesurée, ou pour une valeur que classer ne sait pas lire. Ne modifie pas
 * ce qu'il reçoit.
 *
 * @param {Array<{id: number, mesures: import('./indicateurs.js').Mesures,
 *                plafondsAPriori: ArrayLike<number>|null}>} entrees
 * @param {ReturnType<typeof compilationDe>} [compilation]
 * @returns {{ordre: number[], criteresAppliques: Array<{criteres: Array<{nom: string, valeurs: string[], poids: number}>}>,
 *            critereSaute: string|null, rangSaute: number|null}}
 */
export function classer(entrees, compilation = REFERENCE) {
  exigerIdentifiants(entrees);
  exigerMemeTaille(entrees);
  const lues = entrees.map(({ id, mesures, plafondsAPriori }) => ({
    id,
    mesures,
    ecarts: ecartsAuPlafondAPriori(mesures, plafondsAPriori),
  }));
  const saute = lues.some(({ ecarts }) => ecarts === null);
  const rangSaute = saute
    ? compilation.paliers.findIndex(({ criteres }) => criteres.some(({ nom }) => nom === CRITERE_A_PRIORI))
    : -1;
  const appliques = compilation.paliers.filter((_, rang) => rang !== rangSaute);
  const composantes = appliques.flatMap(composantesDuPalier);
  const classees = lues.map((lue) => ({
    id: lue.id,
    cle: composantes.map((termes) => {
      let somme = 0;
      for (const [poids, lire] of termes) somme += poids * lire(lue);
      return somme;
    }),
  }));
  classees.sort((a, b) => comparerCles(a.cle, b.cle) || a.id - b.id);
  return {
    ordre: classees.map(({ id }) => id),
    criteresAppliques: appliques.map(({ criteres }) => ({
      criteres: criteres.map(({ nom, valeurs, poids }) => ({ nom, valeurs: [...valeurs], poids })),
    })),
    critereSaute: saute ? CRITERE_A_PRIORI : null,
    rangSaute: rangSaute < 0 ? null : rangSaute,
  };
}
