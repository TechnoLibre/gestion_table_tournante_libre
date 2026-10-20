// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le registre des critères (§ 5.3, § 5.7) : leurs noms, leurs familles, les
// cases qui les font compter, l'ordre des priorités par défaut, les critères
// seuls à leur palier, les trois modes des objectifs et leurs valeurs, la
// validation, le complément et la compilation d'une liste de priorités.
// Ces faits n'existent que là : la recherche, le classement, le schéma, les
// commandes et l'écran les lisent.
//
// Une liste de priorités range les sept critères en paliers, du premier au
// dernier : [[{critere, poids}, …], …]. Elle est complète, chaque critère y
// figure une fois, coché ou non ; un critère qui ne compte pas garde son
// rang et ne pose rien à la compilation (D10). Dans un palier, les critères
// suivent l'ordre de CRITERES (A16) : deux listes de même effet s'écrivent
// de la même façon.
//
// Les noms reçus de la saisie ne servent jamais de clé avant d'être reconnus
// par CRITERES ou MODES_OBJECTIFS : un nom hérité d'Object (« constructor »,
// « __proto__ ») est inconnu, et ne lit rien dans les tables du registre.

/**
 * Les sept critères, dans l'ordre du tableau du § 5.7, qui est aussi l'ordre
 * par défaut (D11).
 */
export const CRITERES = Object.freeze([
  'ecartAuPlafondAPrioriMax',
  'excedentCollisions',
  'collisionsCumulees',
  'toursHorsObjectif',
  'rencontresRepetees',
  'animateursNonRencontres',
  'redondance',
]);

/** La famille de chaque critère (§ 5.7), qui fait celle de son palier (D15). */
export const FAMILLE = Object.freeze({
  ecartAuPlafondAPrioriMax: 'rencontres',
  excedentCollisions: 'contrainte',
  collisionsCumulees: 'contrainte',
  toursHorsObjectif: 'contrainte',
  rencontresRepetees: 'contrainte',
  animateursNonRencontres: 'raffinement',
  redondance: 'raffinement',
});

/**
 * Les clés de contraintes qui font compter chaque critère (§ 5.3, A8) : le
 * critère est coché quand l'une d'elles l'est ; une liste vide, toujours.
 */
export const CASES = Object.freeze({
  ecartAuPlafondAPrioriMax: Object.freeze([]),
  excedentCollisions: Object.freeze(['separerAppartenances']),
  collisionsCumulees: Object.freeze(['separerAppartenances']),
  toursHorsObjectif: Object.freeze(['respecterObjectifs']),
  rencontresRepetees: Object.freeze(['nouveauxVoisins', 'nouvelleTable']),
  animateursNonRencontres: Object.freeze(['rencontrerAnimateurs']),
  redondance: Object.freeze(['varierAppartenances']),
});

// La valeur d'une case facultative absente des contraintes (A16) : les
// objectifs cochés, les animateurs décochés. Les quatre autres cases sont
// toujours présentes dans une configuration normalisée.
const CASES_ABSENTES = Object.freeze({ respecterObjectifs: true, rencontrerAnimateurs: false });

/** L'ordre par défaut (D11) : chaque critère seul à son palier, au poids 1. */
export const PRIORITES_PAR_DEFAUT = Object.freeze(
  CRITERES.map((critere) => Object.freeze([Object.freeze({ critere, poids: 1 })])),
);

/** Le plus grand poids d'un critère ; le plus petit est 1. */
export const POIDS_MAX = 100;
const POIDS_MIN = 1;

/** Les trois modes des objectifs (D20), le défaut en tête. */
export const MODES_OBJECTIFS = Object.freeze(['places', 'chacun', 'minimum']);

/**
 * Par mode, les valeurs que les tours hors objectif classent, dans l'ordre où
 * le classement les compare (§ 5.3, A8).
 */
export const VALEURS_DES_MODES = Object.freeze({
  places: Object.freeze(['toursHorsObjectif']),
  chacun: Object.freeze(['jamaisServies', 'toursHorsObjectif']),
  minimum: Object.freeze(['horsObjectifMax', 'toursHorsObjectif']),
});

/**
 * Par mode, les grandeurs que la recherche descend pour les tours hors
 * objectif, une composante chacune : celles qui classent, et sous minimum le
 * nombre de personnes au plus grand nombre de tours hors objectif, qui
 * façonne la descente sans classer (D20).
 */
export const COMPOSANTES_DES_MODES = Object.freeze({
  places: VALEURS_DES_MODES.places,
  chacun: VALEURS_DES_MODES.chacun,
  minimum: Object.freeze(['horsObjectifMax', 'personnesAuMax', 'toursHorsObjectif']),
});

// Les deux grandeurs que la recherche descend pour l'écart au plafond a
// priori : le plus grand écart, puis la somme des carrés des écarts (§ 5.7).
const COMPOSANTES_DE_L_ECART = Object.freeze(['ecartAuPlafondAPrioriMax', 'carresEcartsAuPlafondAPriori']);

// Les critères seuls à leur palier sous tout mode (A16) : l'écart, dont la
// valeur nulle est le certificat du § 5.5, et les rencontres répétées, dont
// les deux valeurs ne s'échangent pas au même taux contre un autre critère
// (D8, D9).
const TOUJOURS_SEULS = Object.freeze(['ecartAuPlafondAPrioriMax', 'rencontresRepetees']);

function exigerCritere(nom) {
  if (!CRITERES.includes(nom)) throw new RangeError(`critère ${String(nom)} : inconnu du registre`);
}

function exigerMode(mode) {
  if (!MODES_OBJECTIFS.includes(mode)) throw new RangeError(`mode des objectifs ${String(mode)} : inconnu`);
}

/**
 * Vrai quand les cases de ces contraintes font compter le critère (§ 5.3,
 * A8) : l'écart toujours ; un autre quand l'une de ses cases est cochée, une
 * case facultative absente valant son défaut. « A un objet » ne se lit pas
 * ici : il dépend de l'instance. Lève RangeError pour un critère inconnu.
 *
 * @param {string} nom
 * @param {Object<string, boolean>} contraintes
 * @returns {boolean}
 */
export function estCoche(nom, contraintes) {
  exigerCritere(nom);
  const cases = CASES[nom];
  return cases.length === 0 || cases.some((cle) => contraintes[cle] ?? CASES_ABSENTES[cle] === true);
}

/**
 * Les critères seuls à leur palier sous ce mode, dans l'ordre de CRITERES :
 * l'écart et les rencontres répétées toujours, et les tours hors objectif
 * sous les modes qui leur font comparer deux valeurs (D8, D23). Chacun y
 * porte le poids 1 (A16) : un critère qui compare deux valeurs l'une après
 * l'autre ne se pondère pas. Lève RangeError pour un mode inconnu.
 *
 * @param {'places'|'chacun'|'minimum'} [mode='places']
 * @returns {string[]}
 */
export function seulsASonPalier(mode = 'places') {
  exigerMode(mode);
  return CRITERES.filter((nom) => TOUJOURS_SEULS.includes(nom) || (nom === 'toursHorsObjectif' && mode !== 'places'));
}

/**
 * Les grandeurs que la recherche descend pour ce critère, une composante
 * chacune, dans l'ordre : deux pour l'écart, celles du mode pour les tours
 * hors objectif, la grandeur du critère seule pour les autres. Un critère qui
 * en descend plusieurs est seul à son palier ; dans un palier partagé, chaque
 * critère n'en descend qu'une. Lève RangeError pour un nom ou un mode
 * inconnus.
 *
 * @param {string} nom
 * @param {'places'|'chacun'|'minimum'} [mode='places']
 * @returns {string[]}
 */
export function composantesDe(nom, mode = 'places') {
  exigerCritere(nom);
  exigerMode(mode);
  if (nom === 'ecartAuPlafondAPrioriMax') return [...COMPOSANTES_DE_L_ECART];
  if (nom === 'toursHorsObjectif') return [...COMPOSANTES_DES_MODES[mode]];
  return [nom];
}

/**
 * Les grandeurs que ce critère classe, dans l'ordre où le classement les
 * compare (D9, D20) : pour les rencontres répétées, celles que le moteur a
 * choisies sous « nouveaux voisins », sinon les retours choisis ; pour les
 * tours hors objectif, celles du mode ; pour les autres, la grandeur du
 * critère seule. Lève RangeError pour un nom ou un mode inconnus. Rend une
 * liste neuve.
 *
 * @param {string} nom
 * @param {Object<string, boolean>} contraintes
 * @param {'places'|'chacun'|'minimum'} [mode='places']
 * @returns {string[]}
 */
export function valeursQuiClassent(nom, contraintes, mode = 'places') {
  exigerCritere(nom);
  exigerMode(mode);
  if (nom === 'rencontresRepetees') {
    return [contraintes.nouveauxVoisins ? 'rencontresRepeteesChoisies' : 'retoursChoisis'];
  }
  if (nom === 'toursHorsObjectif') return [...VALEURS_DES_MODES[mode]];
  return [nom];
}

// Vrai pour une entrée de palier de la forme {critere, poids} : un objet,
// ni liste ni null, qui porte en propre critere, une chaîne, et poids, jugé
// à part. Une clé de plus ne se relève pas ici : le moteur ne parcourt les
// clés d'aucun objet (§ 14.7), et le schéma du document juge les clés.
function aLaFormeDUneEntree(entree) {
  return typeof entree === 'object'
    && entree !== null
    && !Array.isArray(entree)
    && Object.hasOwn(entree, 'critere')
    && Object.hasOwn(entree, 'poids')
    && typeof entree.critere === 'string';
}

// Le rang d'un critère reconnu dans CRITERES.
function rangDe(nom) {
  return CRITERES.indexOf(nom);
}

// Vrai pour un poids du domaine : un entier de 1 à POIDS_MAX. Le poids 1
// d'un critère seul à son palier se juge avec le palier, après son partage.
function poidsDuDomaine(poids) {
  return Number.isInteger(poids) && poids >= POIDS_MIN && poids <= POIDS_MAX;
}

/**
 * La première faute d'une liste de priorités sous ce mode, ou null quand
 * elle est valide (§ 5.7, A12, A16). Les fautes sont des données :
 * - forme : la liste, un palier ou une entrée n'ont pas leur forme, ou les
 *   critères d'un palier ne suivent pas l'ordre de CRITERES — critere nomme
 *   alors le premier rangé avant celui qui le précède ;
 * - palierVide : un palier sans critère ;
 * - critereInconnu : un nom hors de CRITERES ;
 * - critereRepete : un critère nommé une seconde fois ;
 * - poids : hors des entiers de 1 à POIDS_MAX, ou autre que 1 pour un
 *   critère de seulsASonPalier(mode) ;
 * - seulASonPalier : un critère de seulsASonPalier(mode) qui partage son
 *   palier, quel que soit son poids dans le domaine ;
 * - critereAbsent : un critère que la liste ne nomme pas, le premier dans
 *   l'ordre de CRITERES.
 * La liste se lit dans l'ordre, palier par palier, entrée par entrée : la
 * forme, le nom, la répétition et le poids hors de 1 à POIDS_MAX se
 * relèvent entrée par entrée. Une fois les entrées d'un palier lues se
 * jugent son partage, puis le poids 1 du critère seul à son palier, puis
 * l'ordre de ses critères ; l'absence, une fois la liste lue. palier est
 * l'index du palier en cause, à partir de 0 ; critere, le nom en cause.
 *
 * Lève RangeError pour un mode inconnu. Ne modifie pas la liste.
 *
 * @param {unknown} liste
 * @param {'places'|'chacun'|'minimum'} [mode='places']
 * @returns {null|{faute: string, critere?: string, palier?: number}}
 */
export function verifierPriorites(liste, mode = 'places') {
  exigerMode(mode);
  if (!Array.isArray(liste)) return { faute: 'forme' };
  const seuls = seulsASonPalier(mode);
  const vus = [];
  for (let palier = 0; palier < liste.length; palier += 1) {
    const entrees = liste[palier];
    if (!Array.isArray(entrees)) return { faute: 'forme', palier };
    if (entrees.length === 0) return { faute: 'palierVide', palier };
    for (const entree of entrees) {
      if (!aLaFormeDUneEntree(entree)) return { faute: 'forme', palier };
      const { critere, poids } = entree;
      if (!CRITERES.includes(critere)) return { faute: 'critereInconnu', critere, palier };
      if (vus.includes(critere)) return { faute: 'critereRepete', critere, palier };
      if (!poidsDuDomaine(poids)) return { faute: 'poids', critere, palier };
      vus.push(critere);
    }
    const seul = entrees.find(({ critere }) => seuls.includes(critere));
    if (seul !== undefined) {
      if (entrees.length > 1) return { faute: 'seulASonPalier', critere: seul.critere, palier };
      if (seul.poids !== 1) return { faute: 'poids', critere: seul.critere, palier };
    }
    const deplace = entrees.find(({ critere }, k) => k > 0 && rangDe(critere) < rangDe(entrees[k - 1].critere));
    if (deplace !== undefined) return { faute: 'forme', critere: deplace.critere, palier };
  }
  const absent = CRITERES.find((nom) => !vus.includes(nom));
  return absent === undefined ? null : { faute: 'critereAbsent', critere: absent };
}

/**
 * La liste où chaque critère qu'elle ne nomme pas prend sa place de l'ordre
 * par défaut, seul à son palier, au poids 1 (A16) : juste après le palier
 * du critère qui le précède dans CRITERES, en tête pour le premier. Les
 * critères manquants se placent dans l'ordre de CRITERES, chacun après le
 * précédent déjà placé. Une liste complète se rend égale. Rend une liste
 * neuve, paliers et entrées copiés ; ne modifie pas celle qu'elle reçoit,
 * dont les entrées ont la forme {critere, poids}.
 *
 * @param {Array<Array<{critere: string, poids: number}>>} liste
 * @returns {Array<Array<{critere: string, poids: number}>>}
 */
export function completerPriorites(liste) {
  const complete = liste.map((palier) => palier.map(({ critere, poids }) => ({ critere, poids })));
  const palierDe = (nom) => complete.findIndex((palier) => palier.some(({ critere }) => critere === nom));
  CRITERES.forEach((nom, rang) => {
    if (palierDe(nom) >= 0) return;
    const place = rang === 0 ? 0 : palierDe(CRITERES[rang - 1]) + 1;
    complete.splice(place, 0, [{ critere: nom, poids: 1 }]);
  });
  return complete;
}

// La famille d'un palier (D15) : « raffinement » quand tous ses critères le
// sont ; sinon celle de son critère quand il est seul, « contrainte » quand
// il en porte plusieurs — l'écart, seul de sa famille, ne partage jamais
// son palier.
function familleDuPalier(criteres) {
  if (criteres.every(({ nom }) => FAMILLE[nom] === 'raffinement')) return 'raffinement';
  return criteres.length === 1 ? FAMILLE[criteres[0].nom] : 'contrainte';
}

/**
 * Compile une liste de priorités valide en n-uplet de recherche et en ordre
 * de classement (§ 5.7, D9, D10, D15).
 *
 * compte(nom) dit si le critère compte : coché, et avec un objet. Il est lu
 * une fois par critère, dans l'ordre de la liste. Un critère qui ne compte
 * pas sort de son palier et ne pose aucune composante ; un palier dont aucun
 * critère ne compte disparaît, les autres gardant leur ordre.
 *
 * Chaque palier rendu porte sa famille (D15), ses critères qui comptent
 * {nom, poids}, dans l'ordre de la liste, et les rangs de ses composantes
 * dans le n-uplet, consécutifs : celles de composantesDe pour un critère
 * seul, une seule, somme pondérée, pour un palier partagé.
 *
 * ordreScore range les composantes dans l'ordre des paliers. ordreContraintes
 * est l'ordre qu'adopte la recherche dès que le plus grand écart au plafond a
 * priori est nul : les composantes de l'écart passent juste avant le premier
 * palier « raffinement » qui suit le sien, à la fin s'il n'y en a pas, les
 * autres gardant leur ordre et chaque palier ses composantes ensemble.
 * rangEcart est le rang de la composante du plus grand écart, null quand
 * l'écart ne compte pas — l'ordre des contraintes égale alors celui du
 * score. taille, le nombre de composantes, est au plus 10.
 *
 * Lève RangeError pour un mode inconnu, ou pour une liste que
 * verifierPriorites refuse sous ce mode, le message nommant la faute. Rend
 * des objets neufs ; ne modifie pas la liste.
 *
 * @param {Array<Array<{critere: string, poids: number}>>} liste
 * @param {(nom: string) => boolean} compte
 * @param {'places'|'chacun'|'minimum'} [mode='places']
 * @returns {{paliers: Array<{famille: string, criteres: Array<{nom: string, poids: number}>, composantes: number[]}>,
 *            ordreScore: number[], ordreContraintes: number[], rangEcart: number|null, taille: number}}
 */
export function compiler(liste, compte, mode = 'places') {
  exigerMode(mode);
  const faute = verifierPriorites(liste, mode);
  if (faute !== null) throw new RangeError(`liste de priorités refusée : ${JSON.stringify(faute)}`);
  const paliers = [];
  let taille = 0;
  let palierEcart = -1;
  for (const entrees of liste) {
    const criteres = entrees.filter(({ critere }) => compte(critere)).map(({ critere, poids }) => ({ nom: critere, poids }));
    if (criteres.length === 0) continue;
    const largeur = criteres.length === 1 ? composantesDe(criteres[0].nom, mode).length : 1;
    if (criteres[0].nom === 'ecartAuPlafondAPrioriMax') palierEcart = paliers.length;
    paliers.push({
      famille: familleDuPalier(criteres),
      criteres,
      composantes: Array.from({ length: largeur }, (_, k) => taille + k),
    });
    taille += largeur;
  }
  const ordreScore = Array.from({ length: taille }, (_, k) => k);
  if (palierEcart < 0) {
    return { paliers, ordreScore, ordreContraintes: [...ordreScore], rangEcart: null, taille };
  }
  const suivant = paliers.findIndex((palier, i) => i > palierEcart && palier.famille === 'raffinement');
  const fin = suivant < 0 ? paliers.length : suivant;
  const ordreDesPaliers = [
    ...paliers.slice(0, palierEcart),
    ...paliers.slice(palierEcart + 1, fin),
    paliers[palierEcart],
    ...paliers.slice(fin),
  ];
  return {
    paliers,
    ordreScore,
    ordreContraintes: ordreDesPaliers.flatMap(({ composantes }) => composantes),
    rangEcart: paliers[palierEcart].composantes[0],
    taille,
  };
}

/**
 * La compilation d'une instance (§ 5.7, D10) : sa liste de priorités, déjà
 * complète, compilée sous son mode, chaque critère comptant quand son état le
 * dit coché et avec un objet. etatCriteres porte un état par critère, dans
 * l'ordre de CRITERES ({nom, coche, sansObjet, valeurs}, normaliser).
 *
 * Rend ce que compiler rend, où chaque critère d'un palier porte en plus
 * valeurs, une copie des grandeurs qu'il classe, dans l'ordre où le
 * classement les compare : la recherche et le classement lisent ainsi une
 * seule compilation. Lève ce que compiler lève, et RangeError quand
 * etatCriteres ne suit pas l'ordre de CRITERES. Ne modifie rien de ce
 * qu'elle reçoit.
 *
 * @param {{priorites: Array<Array<{critere: string, poids: number}>>,
 *          etatCriteres: Array<{nom: string, coche: boolean, sansObjet: boolean, valeurs: string[]}>,
 *          modeObjectifs: 'places'|'chacun'|'minimum'}} instance
 * @returns {ReturnType<typeof compiler>}
 */
export function compilationDe({ priorites, etatCriteres, modeObjectifs }) {
  const etatDe = (nom) => {
    const etat = etatCriteres[rangDe(nom)];
    if (etat?.nom !== nom) throw new RangeError(`état des critères : ${nom} attendu au rang ${rangDe(nom)}`);
    return etat;
  };
  const compilation = compiler(priorites, (nom) => etatDe(nom).coche && !etatDe(nom).sansObjet, modeObjectifs);
  for (const palier of compilation.paliers) {
    palier.criteres = palier.criteres.map(({ nom, poids }) => ({ nom, poids, valeurs: [...etatDe(nom).valeurs] }));
  }
  return compilation;
}
