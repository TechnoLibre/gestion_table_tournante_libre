// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les modèles de la liste d'accueil et de la feuille par table (§ 11.7),
// sans DOM : ce que chaque ligne imprime, lu dans l'état des places de
// chaque tour (etatPlaces) — la source que l'aperçu imprime, tour par tour.
// Le modèle rend des nombres, des identifiants et des données — noms,
// organisations, libellés de titre — tels que la charge les porte, jamais
// abrégés : ces deux vues replient (§ 7.4). Des tours trop nombreux pour
// tenir côte à côte se répartissent en groupes (feuille par table) ou en
// blocs (liste d'accueil) de tours consécutifs. Les composants les
// traduisent et les posent.
//
// L'ordre de la liste d'accueil suit le tri choisi — par organisation, par
// nom ou par prénom — et ne dépend pas de l'environnement (§ 15.5) : la clé
// normalisée injectée, comparée point de code par point de code, jamais la
// collation de la langue du système ; deux lignes que rien d'autre ne
// sépare, par identifiant. Triée par organisation, un intertitre ouvre
// chaque organisation (rangeesAccueil).
//
// La feuille par table règle la taille de son texte pour remplir sa page
// sans exagérer : une échelle de son corps, de 1 — le plancher, la taille
// de toute liste imprimée — à ECHELLE_TEXTE_MAX, que bornent la largeur de
// ses colonnes (plafondEchelle) et la hauteur de la page (echelleAjustee),
// une par table (echellesParTable).
import { comparerPointsDeCode } from '../../application/planche.js';
import { nomAffiche } from '../../application/personnes.js';
import { etatPlaces } from '../../application/places.js';
import { estBrouillon, horodatagePlacement } from '../../application/sorties.js';
import { nomsDesTours } from '../../application/tours.js';
import { feuilleDe } from './modele.js';
import { trancher } from './pagination.js';

/**
 * L'état des places de chaque tour de la soirée, de 1 à R, de la source que
 * l'aperçu imprime : la proposition demandée — celle que porte l'état du
 * premier tour, null hors de la source proposition —, sinon le retenu,
 * sinon les réservations, tour par tour (etatPlaces).
 *
 * @param {Object} charge
 * @param {number|null} proposition
 * @returns {Object[]}   EtatPlaces, un par tour
 */
export function etatsDesTours(charge, proposition) {
  return Array.from({ length: charge.evenement.tours }, (_, rang) => etatPlaces(charge, { tour: rang + 1, proposition }));
}

// Où chaque personne s'assied à un tour : Map participant → { table
// (numéro affiché), siege }, le siège sous sièges attribués seulement.
function placesDuTour(etat) {
  const places = new Map();
  for (const { numero, chaises } of etat.tables) {
    for (const { siege, occupant } of chaises) {
      if (occupant !== null) places.set(occupant, { table: numero, siege: etat.siegesAttribues ? siege : null });
    }
  }
  return places;
}

// Les champs que compare chaque tri de la liste d'accueil, dans l'ordre :
// le premier est la clé du tri, les suivants départagent.
const ORDRES_ACCUEIL = new Map([
  ['organisation', ['organisation', 'prenom', 'nom']],
  ['nom', ['nom', 'prenom', 'organisation']],
  ['prenom', ['prenom', 'nom', 'organisation']],
]);

// La clé d'un champ texte d'une personne : la clé normalisée, celle du texte
// vide pour un champ absent ; un champ fait de blancs a la même.
const cleChamp = (cle, valeur) => cle(valeur ?? '');

/**
 * La liste d'accueil (§ 11.7) : une ligne par personne non exclue, dans
 * l'ordre du tri reçu. Par organisation : la clé de l'organisation, puis du
 * prénom, puis du nom ; par nom : celle du nom, puis du prénom, puis de
 * l'organisation ; par prénom : celle du prénom, puis du nom, puis de
 * l'organisation. Les clés se comparent par points de code, puis
 * l'identifiant départage. La clé du tri vide — pas d'organisation, ou pas
 * de prénom, ou un champ fait de blancs — range la ligne après toutes celles
 * qui en ont une ; un champ qui départage compte, vide, comme le texte
 * vide, avant tout autre. Chaque ligne porte nom, prénom et organisation
 * tels que la charge les écrit, et, pour chaque tour, la table où la
 * personne s'assied — son numéro affiché —, le siège sous sièges attribués
 * seulement (§ 11.4), table et siège null pour la réserve. Un tour où l'état
 * des places la dit absente (EtatPlaces.absents) porte table et siège null
 * et absente vrai ; le champ absente n'existe qu'à un tour d'absence, si
 * bien qu'une soirée sans présence partielle rend les places sans lui.
 *
 * @param {Object} charge
 * @param {Object[]} etatsParTour   etatsDesTours
 * @param {(texte: string) => string} cle   la clé normalisée (cleNormalisee)
 * @param {'organisation'|'nom'|'prenom'} tri   un de TRIS_ACCUEIL (src/interface/etat_ui.js)
 * @returns {Array<{participant: number, nom: string, prenom: string|null, organisation: string|null,
 *            places: Array<{tour: number, table: number|null, siege: number|null, absente?: true}>}>}
 * @throws {RangeError} un autre tri
 */
export function lignesAccueil(charge, etatsParTour, cle, tri) {
  const champs = ORDRES_ACCUEIL.get(tri);
  if (champs === undefined) throw new RangeError(`lignesAccueil : tri inconnu ${JSON.stringify(tri)}`);
  const parTour = etatsParTour.map((etat) => ({ tour: etat.tour, places: placesDuTour(etat), absents: new Set(etat.absents) }));
  const placeDe = (id, { tour, places, absents }) =>
    absents.has(id) ? { tour, table: null, siege: null, absente: true } : { tour, table: null, siege: null, ...places.get(id) };
  const lignes = charge.participants
    .filter(({ exclu }) => !exclu)
    .map((personne) => ({
      cles: champs.map((champ) => cleChamp(cle, personne[champ])),
      ligne: {
        participant: personne.id,
        nom: personne.nom,
        prenom: personne.prenom,
        organisation: personne.organisation,
        places: parTour.map((duTour) => placeDe(personne.id, duTour)),
      },
    }));
  const comparer = (a, b) =>
    Number(a.cles[0] === '') - Number(b.cles[0] === '') ||
    comparerPointsDeCode(a.cles[0], b.cles[0]) ||
    comparerPointsDeCode(a.cles[1], b.cles[1]) ||
    comparerPointsDeCode(a.cles[2], b.cles[2]) ||
    a.ligne.participant - b.ligne.participant;
  return lignes.sort(comparer).map(({ ligne }) => ligne);
}

/**
 * Les rangées de la liste d'accueil (§ 11.7), dans l'ordre où elle les
 * pose : sous le tri par organisation, un intertitre avant la première ligne
 * de chaque organisation — chaque changement de sa clé normalisée, la liste
 * reçue triée par lignesAccueil —, puis ses lignes. L'intertitre écrit
 * l'organisation comme sa première ligne l'écrit, null pour les personnes
 * sans organisation, ou dont l'organisation est faite de blancs ; premier
 * est l'identifiant de cette ligne. Une liste où personne n'a d'organisation
 * n'a pas d'intertitre : il ne séparerait rien. Sous un autre tri, les
 * lignes seules. Les lignes reçues ne changent pas.
 *
 * @param {ReturnType<typeof lignesAccueil>} lignes   dans l'ordre de la liste
 * @param {(texte: string) => string} cle   la clé normalisée (cleNormalisee)
 * @param {'organisation'|'nom'|'prenom'} tri   celui des lignes
 * @returns {Array<{intertitre: string|null, premier: number}|{ligne: ReturnType<typeof lignesAccueil>[number]}>}
 * @throws {RangeError} un autre tri
 */
export function rangeesAccueil(lignes, cle, tri) {
  if (!ORDRES_ACCUEIL.has(tri)) throw new RangeError(`rangeesAccueil : tri inconnu ${JSON.stringify(tri)}`);
  const cles = lignes.map(({ organisation }) => cleChamp(cle, organisation));
  if (tri !== 'organisation' || cles.every((cleLue) => cleLue === '')) return lignes.map((ligne) => ({ ligne }));
  return lignes.flatMap((ligne, rang) => {
    if (rang > 0 && cles[rang] === cles[rang - 1]) return [{ ligne }];
    return [{ intertitre: cles[rang] === '' ? null : ligne.organisation, premier: ligne.participant }, { ligne }];
  });
}

/**
 * Le libellé d'une place de la liste d'accueil : « absente » à un tour
 * d'absence, avant le cas de la réserve, dont elle partage table et siège
 * null ; sinon la table, la table et le siège, ou la réserve.
 *
 * @param {{table: number|null, siege: number|null, absente?: boolean}} place
 * @returns {{cle: string, details: Object}}
 */
export function libellePlace({ table, siege, absente = false }) {
  if (absente) return { cle: 'feuilles.accueil.absente', details: {} };
  if (table === null) return { cle: 'feuilles.accueil.reserve', details: {} };
  if (siege === null) return { cle: 'feuilles.accueil.table', details: { table } };
  return { cle: 'feuilles.accueil.tableSiege', details: { table, siege } };
}

/**
 * Les feuilles par table (§ 11.7, Q6 c) : par défaut une feuille par table,
 * les tours de la soirée en colonnes ; sous parTour, une feuille par table
 * et par tour, les tours d'une table à la suite. Une table où personne
 * n'est assis à aucun des tours d'une feuille n'a pas cette feuille, même
 * quand ses places portent un titre. Les tables se rangent par numéro
 * affiché, puis par identifiant. Une feuille porte le libellé de sa table,
 * null quand elle n'en a pas, et liste chaque place de la table, de 1 à sa
 * capacité, et pour chaque tour de ses colonnes ce que l'état des places y
 * montre : l'occupant, son nom affiché et son organisation telle que la
 * charge l'écrit — null quand elle est absente ou faite de blancs —, ou une
 * place vide (null), et le titre de la place, pourvu ou non à ce tour, tel
 * que le plan le montre (§ 4.1) — un titre appartient à la place,
 * l'occupant n'en devient pas titulaire.
 *
 * @param {Object} charge
 * @param {Object[]} etatsParTour   etatsDesTours
 * @param {{parTour?: boolean}} [options]
 * @returns {Array<{table: number, numero: number, libelle: string|null, tours: number[],
 *            lignes: Array<{place: number, cellules: Array<{tour: number, occupant: number|null,
 *            nom: string|null, organisation: string|null,
 *            titre: {libelle: string, pourvu: boolean}|null}>}>}>}
 * @throws {TypeError} parTour hors des booléens
 */
export function feuillesTables(charge, etatsParTour, { parTour = false } = {}) {
  if (typeof parTour !== 'boolean') throw new TypeError(`feuillesTables : parTour booléen attendu, reçu ${String(parTour)}`);
  const noms = new Map(charge.participants.map((personne) => [personne.id, nomAffiche(personne)]));
  const organisations = new Map(charge.participants.map(({ id, organisation }) => [id, champPose(organisation ?? null) || null]));
  const tables = [...charge.tables].sort((a, b) => a.numero - b.numero || a.id - b.id);
  // Les chaises de la table id à chaque tour, dans l'ordre des tours reçus.
  const chaisesDe = (id) => etatsParTour.map((etat) => ({ tour: etat.tour, chaises: etat.tables.find((table) => table.id === id).chaises }));
  const cellule = (tour, chaise) =>
    chaise === undefined || chaise.occupant === null
      ? { tour, occupant: null, nom: null, organisation: null, titre: chaise?.titre ?? null }
      : { tour, occupant: chaise.occupant, nom: noms.get(chaise.occupant), organisation: organisations.get(chaise.occupant), titre: chaise.titre };
  // Vrai quand quelqu'un est assis à la table à l'un des tours des colonnes.
  const occupee = (colonnes) => colonnes.some(({ chaises }) => chaises.some(({ occupant }) => occupant !== null));
  const feuille = (table, colonnes) => {
    const places = Math.max(0, ...colonnes.map(({ chaises }) => chaises.length));
    return {
      table: table.id,
      numero: table.numero,
      libelle: table.libelle ?? null,
      tours: colonnes.map(({ tour }) => tour),
      lignes: Array.from({ length: places }, (_, rang) => ({
        place: rang + 1,
        cellules: colonnes.map(({ tour, chaises }) => cellule(tour, chaises[rang])),
      })),
    };
  };
  return tables.flatMap((table) => {
    const colonnes = chaisesDe(table.id);
    const parFeuille = parTour ? colonnes.map((colonne) => [colonne]) : [colonnes];
    return parFeuille.filter(occupee).map((deLaFeuille) => feuille(table, deLaFeuille));
  });
}

/**
 * Les textes qu'une cellule de la feuille par table pose, dans l'ordre du
 * document : le nom de l'occupant, ou la place vide ; le séparateur et
 * l'organisation de l'occupant, quand il en a une ; le libellé du titre de
 * la place ; « non pourvu » quand rien ne le pourvoit. Le texte vide pour
 * ce que la cellule ne porte pas. Une ligne plus haute qu'une page se
 * continue sur les suivantes par morceaux de cette suite (couperTexte,
 * partsDesCellules).
 *
 * @param {{nom: string|null, organisation?: string|null, titre: {libelle: string, pourvu: boolean}|null}} cellule
 * @param {(cle: string) => string} t
 * @returns {[string, string, string, string, string]}
 */
export function textesCellule({ nom, organisation = null, titre }, t) {
  const avecOrganisation = nom !== null && organisation !== null;
  return [
    nom ?? t('feuilles.tables.vide'),
    avecOrganisation ? t('feuilles.tables.avantOrganisation') : '',
    avecOrganisation ? organisation : '',
    titre?.libelle ?? '',
    titre !== null && !titre.pourvu ? t('feuilles.tables.titreNonPourvu') : '',
  ];
}

/**
 * Les textes que chaque cellule d'une ligne de la feuille par table pose
 * sur une page : sans morceau, ses textes entiers (textesCellule) ; avec,
 * la part de chacun qui tombe dans le morceau {debut, fin}, les textes de
 * toutes les cellules mis bout à bout dans l'ordre du document, comme
 * couperLigne les lit (trancher).
 *
 * @param {Array<Parameters<typeof textesCellule>[0]>} cellules
 * @param {(cle: string) => string} t
 * @param {{debut: number, fin: number}|null} morceau
 * @returns {string[][]}   une liste de textes par cellule
 */
export function partsDesCellules(cellules, t, morceau) {
  const textes = cellules.map((cellule) => textesCellule(cellule, t));
  if (morceau === null) return textes;
  const parts = trancher(textes.flat(), morceau.debut, morceau.fin);
  let debut = 0;
  return textes.map(({ length }) => {
    const deLaCellule = parts.slice(debut, debut + length);
    debut += length;
    return deLaCellule;
  });
}

// Un champ de la liste d'accueil tel qu'une ligne le pose : le texte vide
// pour un champ absent ou fait de blancs, qui ne pose aucun nœud de texte
// que couperLigne lise.
const champPose = (texte) => (texte === null || texte.trim() === '' ? '' : texte);

/**
 * Les textes qu'une ligne de la liste d'accueil pose, dans l'ordre du
 * document : le nom, le prénom, l'organisation, puis le libellé de la place
 * à chaque tour (libellePlace). Le texte vide pour un champ absent ou fait
 * de blancs. Une ligne plus haute qu'une page se continue sur les suivantes
 * par morceaux de cette suite (couperLigne, trancher).
 *
 * @param {{nom: string, prenom: string|null, organisation: string|null,
 *          places: Array<{table: number|null, siege: number|null, absente?: boolean}>}} ligne   lignesAccueil
 * @param {(cle: string, details?: Object) => string} t
 * @returns {string[]}
 */
export function textesLigneAccueil({ nom, prenom, organisation, places }, t) {
  return [
    champPose(nom),
    champPose(prenom),
    champPose(organisation),
    ...places.map((place) => {
      const { cle, details } = libellePlace(place);
      return t(cle, details);
    }),
  ];
}

/**
 * La feuille d'une page qui ne couvre qu'un tour (Q6 c) : le pied reçu
 * (feuilleDe), dont le nom de l'événement, sa date et la version restent,
 * au tour de l'état, daté de l'horodatage de sa source (horodatagePlacement),
 * et le filigrane de la règle du brouillon à ce tour (estBrouillon, Q5 b).
 *
 * @param {Object} charge
 * @param {ReturnType<typeof feuilleDe>} feuille   celle de la soirée, que l'aperçu compose
 * @param {Object} etat   EtatPlaces du tour
 * @returns {ReturnType<typeof feuilleDe>}
 */
export function feuilleDuTour(charge, feuille, etat) {
  const donnee = (nom) => feuille.elements.find(({ element }) => element === nom).donnee;
  const { source, proposition, tour } = etat;
  const pied = {
    nom: donnee('nom'),
    date: donnee('date'),
    tour,
    horodatage: horodatagePlacement(charge, { source, proposition }),
    version: donnee('version'),
  };
  return feuilleDe(pied, estBrouillon(charge, { source, tour }), nomsDesTours(charge));
}

// La part de la largeur que prennent les colonnes de texte de chaque vue —
// nom, prénom, organisation ; le numéro de la place —, en pour cent, quand
// les tours se partagent le reste à parts égales.
const COLONNES_FIXES = new Map([
  ['accueil', [24, 18, 18]],
  ['tables', [12]],
]);

// La part que nom, prénom et organisation de la liste d'accueil gardent au
// moins quand les colonnes de tour se règlent sur leur texte, en pour cent :
// au-delà, les tours se partagent le reste et leurs libellés replient.
const PLANCHER_NOMS = 100 / 3;

// L'écart sous lequel une somme de parts égale encore sa borne : le bruit
// de l'arithmétique flottante.
const BRUIT = 1e-9;

/**
 * Les largeurs des colonnes d'une liste imprimée, en pour cent de la
 * largeur du contenu, de somme 100 : celles de la vue, puis une par tour.
 * Les deux vues se rendent en disposition fixe, si bien que la feuille où
 * se mesurent les lignes et les pages qui les impriment replient de même.
 *
 * Sans partTour, les tours se partagent à parts égales ce que COLONNES_FIXES
 * laisse. Avec partTour — la liste d'accueil seule —, la part de la largeur
 * que le plus large libellé de place ou tête de tour prend sur une ligne
 * (mesurerPlace) : chaque tour la reçoit si tous tiennent en laissant aux
 * noms PLANCHER_NOMS, sinon les tours se partagent à parts égales ce que le
 * plancher laisse ; les noms prennent le reste, dans les proportions de
 * COLONNES_FIXES. Un tour à sa part tient sur une ligne ; sous le plancher,
 * son libellé replie, entre ses mots d'abord. La liste d'accueil reçoit ses
 * tours par blocs (toursParBloc, blocsAccueil), dont chaque tour tient à sa
 * part : seul un bloc d'un tour plus large que ce que le plancher laisse
 * passe sous sa part.
 *
 * @param {'accueil'|'tables'} vue
 * @param {number} tours   le nombre de colonnes de tour, entier ≥ 1
 * @param {number|null} [partTour]   en pour cent, finie, > 0 ; null par défaut
 * @returns {number[]}
 * @throws {RangeError} une autre vue, un nombre de tours hors du domaine ;
 *         une part hors du domaine, ou reçue pour la feuille par table
 */
export function largeursColonnes(vue, tours, partTour = null) {
  const fixes = COLONNES_FIXES.get(vue);
  if (fixes === undefined) throw new RangeError(`largeursColonnes : vue inconnue ${JSON.stringify(vue)}`);
  if (!Number.isSafeInteger(tours) || tours < 1) throw new RangeError(`largeursColonnes : tours entier ≥ 1 attendu, reçu ${String(tours)}`);
  const somme = fixes.reduce((a, b) => a + b, 0);
  if (partTour === null) return [...fixes, ...Array.from({ length: tours }, () => (100 - somme) / tours)];
  if (vue !== 'accueil') throw new RangeError(`largeursColonnes : une part de tour pour la vue ${vue}`);
  if (typeof partTour !== 'number' || !Number.isFinite(partTour) || partTour <= 0) {
    throw new RangeError(`largeursColonnes : part de tour finie > 0 attendue, reçu ${String(partTour)}`);
  }
  const tour = tours * partTour <= 100 - PLANCHER_NOMS + BRUIT ? partTour : (100 - PLANCHER_NOMS) / tours;
  const noms = 100 - tours * tour;
  return [...fixes.map((part) => (part * noms) / somme), ...Array.from({ length: tours }, () => tour)];
}

// La part de la largeur que les colonnes de tour d'un bloc de la liste
// d'accueil se partagent au plus, en pour cent : ce que le plancher des
// noms laisse.
const PART_TOURS_ACCUEIL = 100 - PLANCHER_NOMS;

// Le plus grand n de 1 à tours dont n colonnes de part chacune tiennent
// dans budget ; 1 quand une seule colonne le dépasse déjà.
const colonnesQuiTiennent = (budget, part, tours) => Math.max(1, Math.min(tours, Math.floor((budget + BRUIT) / part)));

/**
 * Le nombre de colonnes de tour qu'un bloc de la liste d'accueil garde côte
 * à côte quand chacune prend part de la largeur — la part de son plus large
 * libellé de place ou tête de tour (mesurerPlace) — et que nom, prénom et
 * organisation gardent PLANCHER_NOMS : le plus grand n de 1 à tours dont
 * n × part tient dans ce que le plancher laisse. Un libellé plus large que
 * toute cette part donne 1 : il replie, entre ses mots d'abord, dans la plus
 * large colonne que le plancher permet (largeursColonnes).
 *
 * @param {number} part   en pour cent, finie, > 0
 * @param {number} tours   le nombre de tours de la soirée, entier ≥ 1
 * @returns {number}
 * @throws {RangeError} une part ou un nombre de tours hors du domaine
 */
export function toursParBloc(part, tours) {
  if (typeof part !== 'number' || !Number.isFinite(part) || part <= 0) {
    throw new RangeError(`toursParBloc : part finie > 0 attendue, reçu ${String(part)}`);
  }
  if (!Number.isSafeInteger(tours) || tours < 1) throw new RangeError(`toursParBloc : tours entier ≥ 1 attendu, reçu ${String(tours)}`);
  return colonnesQuiTiennent(PART_TOURS_ACCUEIL, part, tours);
}

/**
 * La liste d'accueil répartie en blocs de tours consécutifs (§ 7.4) : au
 * plus taille tours par bloc, en ⌈T / taille⌉ blocs, T les tours, tous de
 * ⌈T / blocs⌉ tours sauf le dernier, plus court quand la division ne tombe
 * pas juste — 31 tours par 30 donnent 16 et 15, 100 par 34 donnent 34, 34 et
 * 32. Chaque bloc porte ses tours et chaque ligne de la liste, dans l'ordre
 * reçu, nom, prénom et organisation entiers, ses places réduites à celles
 * des tours du bloc : chaque bloc se lit seul, les colonnes de noms répétées.
 * Une liste qui garde tous ses tours donne un seul bloc, égal à elle. Les
 * lignes reçues ne changent pas.
 *
 * @param {ReturnType<typeof lignesAccueil>} lignes
 * @param {number[]} tours   les tours de la soirée, ceux des places de chaque ligne, dans leur ordre
 * @param {number} taille   entier ≥ 1 (toursParBloc)
 * @returns {Array<{tours: number[], lignes: ReturnType<typeof lignesAccueil>}>}
 * @throws {RangeError} une taille hors du domaine ; aucun tour ; une ligne
 *         dont les places ne sont pas une par tour
 */
export function blocsAccueil(lignes, tours, taille) {
  if (!Number.isSafeInteger(taille) || taille < 1) throw new RangeError(`blocsAccueil : taille entière ≥ 1 attendue, reçu ${String(taille)}`);
  if (tours.length < 1) throw new RangeError('blocsAccueil : au moins un tour attendu');
  for (const { participant, places } of lignes) {
    if (places.length !== tours.length) {
      throw new RangeError(`blocsAccueil : ${places.length} place(s) pour ${tours.length} tour(s), personne ${participant}`);
    }
  }
  const pas = Math.ceil(tours.length / Math.ceil(tours.length / taille));
  return Array.from({ length: Math.ceil(tours.length / pas) }, (_, rang) => {
    const debut = rang * pas;
    const fin = debut + pas;
    return {
      tours: tours.slice(debut, fin),
      lignes: lignes.map((ligne) => ({ ...ligne, places: ligne.places.slice(debut, fin) })),
    };
  });
}

// La part de la largeur que la colonne du numéro de la place prend dans la
// feuille par table, et celle que les colonnes de tour se partagent, en
// pour cent.
const PART_PLACE_TABLES = COLONNES_FIXES.get('tables').reduce((a, b) => a + b, 0);
const PART_TOURS_TABLES = 100 - PART_PLACE_TABLES;

/**
 * Le nombre de colonnes de tour qu'une feuille par table garde côte à côte
 * quand chacune doit prendre au moins part de la largeur de la liste — la
 * part de son plus long mot (mesurerPlace) : le plus grand n de 1 à tours
 * dont les n colonnes, à parts égales de ce que la place laisse
 * (largeursColonnes), en reçoivent chacune au moins part. Un mot plus large
 * que toute cette part donne 1 : il replie dans la plus large colonne
 * possible.
 *
 * @param {number} part   en pour cent, finie, > 0
 * @param {number} tours   le nombre de tours de la feuille, entier ≥ 1
 * @returns {number}
 * @throws {RangeError} une part ou un nombre de tours hors du domaine
 */
export function toursParGroupe(part, tours) {
  if (typeof part !== 'number' || !Number.isFinite(part) || part <= 0) {
    throw new RangeError(`toursParGroupe : part finie > 0 attendue, reçu ${String(part)}`);
  }
  if (!Number.isSafeInteger(tours) || tours < 1) throw new RangeError(`toursParGroupe : tours entier ≥ 1 attendu, reçu ${String(tours)}`);
  return colonnesQuiTiennent(PART_TOURS_TABLES, part, tours);
}

/**
 * Les feuilles par table, chacune scindée en groupes de tours consécutifs
 * (§ 7.4) : la feuille de rang i en ⌈T / parGroupe[i]⌉ groupes, T ses tours,
 * de tailles égales à un près, les plus grands d'abord — dix tours par six
 * donnent deux groupes de cinq. Chaque groupe est une feuille à part
 * entière : la table, son numéro, son libellé, ses tours, et chaque place
 * avec les cellules de ces tours seuls ; source est le rang de la feuille
 * d'où il vient. Une feuille qui garde tous ses tours donne un seul groupe,
 * égal à elle.
 *
 * @param {ReturnType<typeof feuillesTables>} feuilles
 * @param {number[]} parGroupe   un par feuille, entiers ≥ 1
 * @returns {Array<ReturnType<typeof feuillesTables>[number] & {source: number}>}
 * @throws {RangeError} un compte qui n'est pas celui des feuilles ; une
 *         taille de groupe hors du domaine
 */
export function grouperTours(feuilles, parGroupe) {
  if (!Array.isArray(parGroupe) || parGroupe.length !== feuilles.length) {
    throw new RangeError(`grouperTours : une taille de groupe par feuille attendue, ${feuilles.length} feuille(s)`);
  }
  return feuilles.flatMap((feuille, source) => {
    const taille = parGroupe[source];
    if (!Number.isSafeInteger(taille) || taille < 1) throw new RangeError(`grouperTours : taille ${String(taille)} pour la feuille ${source}`);
    const total = feuille.tours.length;
    const groupes = Math.max(1, Math.ceil(total / taille));
    const petite = Math.floor(total / groupes);
    const grandes = total % groupes;
    let debut = 0;
    return Array.from({ length: groupes }, (_, rang) => {
      const fin = debut + petite + (rang < grandes ? 1 : 0);
      const groupe = {
        table: feuille.table,
        numero: feuille.numero,
        libelle: feuille.libelle,
        tours: feuille.tours.slice(debut, fin),
        lignes: feuille.lignes.map(({ place, cellules }) => ({ place, cellules: cellules.slice(debut, fin) })),
        source,
      };
      debut = fin;
      return groupe;
    });
  });
}

/**
 * Les tailles de groupe resserrées d'après la pagination (§ 7.4) : une
 * feuille dont un groupe porte une page seule — une ligne plus haute que la
 * page (paginer) — et dont un groupe porte plus d'un tour voit sa taille
 * ramenée à la moitié, arrondie au-dessus, de son plus grand groupe : ses
 * colonnes s'élargissent, ses lignes raccourcissent. null quand aucune
 * taille ne change : les groupes sont ceux que l'on imprime.
 *
 * @param {number[]} parGroupe   la taille de chaque feuille
 * @param {ReturnType<typeof grouperTours>} groupes   grouperTours(feuilles, parGroupe)
 * @param {Array<{feuille: number, seule: boolean}>} pages   paginerFeuilles des groupes
 * @returns {number[]|null}
 */
export function resserrerGroupes(parGroupe, groupes, pages) {
  const suivants = [...parGroupe];
  let change = false;
  for (const { feuille, seule } of pages) {
    if (!seule) continue;
    const { source } = groupes[feuille];
    const plusGrand = Math.max(...groupes.filter((groupe) => groupe.source === source).map(({ tours }) => tours.length));
    if (plusGrand === 1) continue;
    const resserre = Math.ceil(plusGrand / 2);
    if (resserre < suivants[source]) {
      suivants[source] = resserre;
      change = true;
    }
  }
  return change ? suivants : null;
}

/** L'échelle la plus grande du texte d'une feuille par table : le corps
 *  des noms, de 16 px (12 pt) au plancher, monte au plus à 24 px (18 pt),
 *  les titres dans la même proportion. */
export const ECHELLE_TEXTE_MAX = 1.5;

/** Le pas des échelles qu'essaie echelleAjustee : un trente-deuxième, soit
 *  un demi-pixel du corps des noms. */
export const PAS_ECHELLE = 1 / 32;

const partValide = (part) => typeof part === 'number' && Number.isFinite(part) && part > 0;

/**
 * L'échelle au-delà de laquelle un mot d'une feuille par table passerait la
 * largeur de sa colonne et se couperait : les largeurs des colonnes restent
 * celles du plancher (largeursColonnes), et un texte s'élargit comme son
 * corps. La plus petite de deux marges : la part de chaque colonne de tour
 * sur celle du plus long mot de ses cellules et de ses têtes, et la part de
 * la colonne de la place sur celle de sa tête et de son plus grand numéro,
 * chacune mesurée au plancher, retraits compris (mesurerPlace).
 *
 * @param {number} tours   le nombre de colonnes de tour, entier ≥ 1
 * @param {number} partTour   en pour cent, finie, > 0
 * @param {number} partPlace   en pour cent, finie, > 0
 * @returns {number}
 * @throws {RangeError} un nombre de tours ou une part hors du domaine
 */
export function plafondEchelle(tours, partTour, partPlace) {
  if (!Number.isSafeInteger(tours) || tours < 1) throw new RangeError(`plafondEchelle : tours entier ≥ 1 attendu, reçu ${String(tours)}`);
  if (!partValide(partTour) || !partValide(partPlace)) {
    throw new RangeError(`plafondEchelle : parts finies > 0 attendues, reçu ${String(partTour)} et ${String(partPlace)}`);
  }
  return Math.min(PART_TOURS_TABLES / tours / partTour, PART_PLACE_TABLES / partPlace);
}

/**
 * L'échelle du texte d'une feuille par table : la plus grande de la forme
 * 1 + k × PAS_ECHELLE, au plus ECHELLE_TEXTE_MAX et plafond, pour laquelle
 * la feuille tient sur sa page (tient) ; 1, le plancher, quand aucune plus
 * grande ne tient. tient n'est appelée qu'au-delà de 1 et jamais au-delà
 * des bornes ; la recherche est dichotomique, et tient doit décroître avec
 * l'échelle — une feuille qui tient, son texte réduit, tient encore.
 *
 * @param {number} plafond   plafondEchelle, ou Infinity ; un nombre
 * @param {(echelle: number) => boolean} tient
 * @returns {number}
 * @throws {RangeError} un plafond qui n'est pas un nombre
 * @throws {TypeError} un prédicat qui n'est pas une fonction
 */
export function echelleAjustee(plafond, tient) {
  if (typeof plafond !== 'number' || Number.isNaN(plafond)) throw new RangeError(`echelleAjustee : plafond attendu, reçu ${String(plafond)}`);
  if (typeof tient !== 'function') throw new TypeError('echelleAjustee : un prédicat tient attendu');
  const borne = Math.min(plafond, ECHELLE_TEXTE_MAX);
  const pas = borne < 1 ? 0 : Math.floor((borne - 1) / PAS_ECHELLE + BRUIT);
  let bas = 0;
  let haut = pas;
  while (bas < haut) {
    const milieu = (bas + haut + 1) >> 1;
    if (tient(1 + milieu * PAS_ECHELLE)) bas = milieu;
    else haut = milieu - 1;
  }
  return 1 + bas * PAS_ECHELLE;
}

/**
 * Une échelle par table : chaque groupe de feuille par table (grouperTours)
 * reçoit la plus petite des échelles des groupes de sa table, ceux des
 * autres feuilles de la même table compris — une feuille par tour aussi.
 *
 * @param {Array<{table: number}>} groupes
 * @param {number[]} echelles   une par groupe
 * @returns {number[]}
 * @throws {RangeError} un compte qui n'est pas celui des groupes
 */
export function echellesParTable(groupes, echelles) {
  if (!Array.isArray(echelles) || echelles.length !== groupes.length) {
    throw new RangeError(`echellesParTable : une échelle par groupe attendue, ${groupes.length} groupe(s)`);
  }
  const plusPetites = new Map();
  groupes.forEach(({ table }, rang) => plusPetites.set(table, Math.min(plusPetites.get(table) ?? Infinity, echelles[rang])));
  return groupes.map(({ table }) => plusPetites.get(table));
}
