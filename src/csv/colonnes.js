// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Association des colonnes d'un CSV aux champs d'un participant (§ 10.1). Une
// colonne s'associe par son en-tête, jamais par sa position : un tableur dont
// une colonne a été déplacée importerait sinon les noms dans les
// appartenances, sans rien signaler. Deux colonnes reconnues sous le même
// champ ne se départagent pas toutes seules ; le choix de l'opérateur tranche.
// La règle se lit sur une table d'en-têtes : reconnaitreSelon et
// associerSelon la portent pour toute table, celle des objectifs de table
// (§ 10.4) comprise ; reconnaitre et associer sont celles des participants.

import { cleEntete } from './normalisation.js';

// Un champ et ses en-têtes, figés.
const champ = (nom, entetes) => Object.freeze([nom, Object.freeze(entetes)]);

/**
 * La table des colonnes reconnues (§ 10.1, § 19.8), seule source des champs
 * du CSV et de leurs synonymes : chaque champ, dans l'ordre de l'export, avec
 * ses en-têtes tels que le § 10.1 les écrit — son nom, puis ses synonymes.
 * CHAMPS et la reconnaissance en dérivent, et le tableau des colonnes de la
 * documentation s'en engendre. Figée à toute profondeur.
 *
 * @type {ReadonlyArray<readonly [string, ReadonlyArray<string>]>}
 */
export const ENTETES_DES_CHAMPS = Object.freeze([
  champ('nom', ['nom']),
  champ('prenom', ['prenom']),
  champ('appartenance', ['appartenance', 'organisation', 'entreprise', 'équipe']),
  champ('courriel', ['courriel']),
  champ('titre_pressenti', ['titre_pressenti', 'titre', 'rôle']),
  champ('exclu', ['exclu']),
  champ('notes', ['notes']),
  // En dernier : l'export écrit les étiquettes après les sept premiers
  // champs, puis la présence, et le collage en bloc les lit à la huitième et
  // à la neuvième colonne (§ 10.2). « presence » et « présence » partagent
  // leur clé d'en-tête, sous le même champ.
  champ('etiquettes', ['etiquettes', 'étiquette', 'mots-clés']),
  champ('presence', ['presence', 'présence', 'tours de présence']),
]);

/** Champs d'un participant que porte un CSV, dans l'ordre de l'export. */
export const CHAMPS = Object.freeze(ENTETES_DES_CHAMPS.map(([nom]) => nom));

/**
 * La reconnaissance d'une table d'en-têtes, de la forme d'ENTETES_DES_CHAMPS :
 * une fonction qui rend le champ qu'un en-tête désigne, synonymes compris,
 * sans égard à la casse, aux accents, aux espaces, à « _ » ni à « - » ; null
 * pour un en-tête inconnu. La clé de chaque en-tête de la table se tire de
 * son écriture par la même règle que celle d'un en-tête lu (cleEntete). La
 * table se lit une fois, à l'appel : la changer ensuite ne change rien.
 *
 * @param {ReadonlyArray<readonly [string, ReadonlyArray<string>]>} table
 * @returns {(entete: string) => string|null}
 * @throws {RangeError} quand deux champs partagent une clé d'en-tête, qu'il
 *   nomme : la colonne irait à l'un ou à l'autre selon l'ordre de la table.
 *   Un champ peut répéter la sienne, comme « règle » pour regle.
 */
export function reconnaitreSelon(table) {
  const champDeCle = new Map();
  for (const [champ, entetes] of table) {
    for (const entete of entetes) {
      const cle = cleEntete(entete);
      const deja = champDeCle.get(cle);
      if (deja !== undefined && deja !== champ) {
        throw new RangeError(`en-têtes : la clé ${JSON.stringify(cle)} est celle de ${deja} et de ${champ}`);
      }
      champDeCle.set(cle, champ);
    }
  }
  return (entete) => champDeCle.get(cleEntete(entete)) ?? null;
}

/**
 * L'association des colonnes selon une table d'en-têtes, de la forme
 * d'ENTETES_DES_CHAMPS : une fonction (entetes, choix) qui suit la règle
 * d'associer (voir associer), les champs pris dans l'ordre de la table. La
 * table se lit une fois, à l'appel.
 *
 * @param {ReadonlyArray<readonly [string, ReadonlyArray<string>]>} table
 * @returns {(entetes: string[], choix?: Object<string, number>) => {
 *   colonnes: Object<string, number>,
 *   ambigus: Array<{champ: string, rangs: number[]}>,
 *   nonReconnues: number[],
 * }}
 * @throws {RangeError} quand deux champs partagent une clé d'en-tête
 *   (reconnaitreSelon)
 */
export function associerSelon(table) {
  const reconnaitreLu = reconnaitreSelon(table);
  const champs = table.map(([champ]) => champ);
  return (entetes, choix = {}) => {
    const rangsDesChamps = new Map(champs.map((champ) => [champ, []]));
    const nonReconnues = [];
    entetes.forEach((entete, rang) => {
      const champ = reconnaitreLu(entete);
      if (champ === null) nonReconnues.push(rang);
      else rangsDesChamps.get(champ).push(rang);
    });

    const colonnes = {};
    const ambigus = [];
    for (const champ of champs) {
      const rangs = rangsDesChamps.get(champ);
      if (rangs.length === 1) {
        colonnes[champ] = rangs[0];
      } else if (rangs.length > 1) {
        if (Object.hasOwn(choix, champ) && rangs.includes(choix[champ])) colonnes[champ] = choix[champ];
        else ambigus.push({ champ, rangs });
      }
    }
    return { colonnes, ambigus, nonReconnues };
  };
}

// La reconnaissance et l'association des participants.
const RECONNAITRE_PARTICIPANT = reconnaitreSelon(ENTETES_DES_CHAMPS);
const ASSOCIER_PARTICIPANTS = associerSelon(ENTETES_DES_CHAMPS);

/**
 * Champ qu'un en-tête désigne, synonymes compris, sans égard à la casse, aux
 * accents, aux espaces, à « _ » ni à « - » ; null pour un en-tête inconnu,
 * comme « ligne » et « motif », les deux colonnes qu'ajoute le CSV des refus.
 *
 * @param {string} entete
 * @returns {string|null}  un élément de CHAMPS, ou null
 */
export function reconnaitre(entete) {
  return RECONNAITRE_PARTICIPANT(entete);
}

/**
 * Associe les colonnes aux champs par leurs en-têtes. Un rang de colonne est
 * son indice dans entetes, à partir de 0.
 *
 * Un champ que reconnaît une seule colonne lui est associé. Un champ que
 * reconnaissent plusieurs colonnes n'est associé à aucune et devient une
 * ambiguïté, sauf quand choix[champ] désigne l'une d'elles : celle-là est
 * associée, et l'ambiguïté levée. Un choix qui ne désigne pas l'une des
 * colonnes en conflit d'un champ ambigu est sans effet.
 *
 * @param {string[]} entetes  en-têtes tels qu'écrits
 * @param {Object<string, number>} [choix]  { champ: rang }
 * @returns {{
 *   colonnes: Object<string, number>,
 *   ambigus: Array<{champ: string, rangs: number[]}>,
 *   nonReconnues: number[],
 * }}
 *   colonnes : { champ: rang } des champs associés, dans l'ordre de CHAMPS ;
 *   ambigus : dans l'ordre de CHAMPS, rangs croissants ; nonReconnues : rangs
 *   croissants des colonnes dont l'en-tête est inconnu, vide compris.
 */
export function associer(entetes, choix = {}) {
  return ASSOCIER_PARTICIPANTS(entetes, choix);
}
