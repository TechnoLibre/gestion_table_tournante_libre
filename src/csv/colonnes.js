// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Association des colonnes d'un CSV aux champs d'un participant (§ 10.1). Une
// colonne s'associe par son en-tête, jamais par sa position : un tableur dont
// une colonne a été déplacée importerait sinon les noms dans les
// appartenances, sans rien signaler. Deux colonnes reconnues sous le même
// champ ne se départagent pas toutes seules ; le choix de l'opérateur tranche.

import { cleEntete } from './normalisation.js';

/** Champs d'un participant que porte un CSV, dans l'ordre de l'export. */
export const CHAMPS = Object.freeze(['nom', 'prenom', 'appartenance', 'courriel', 'titre_pressenti', 'exclu', 'notes']);

// En-têtes de chaque champ tels que le § 10.1 les écrit : son nom, puis ses
// synonymes.
const ENTETES_DES_CHAMPS = [
  ['nom', ['nom']],
  ['prenom', ['prenom']],
  ['appartenance', ['appartenance', 'organisation', 'entreprise', 'équipe']],
  ['courriel', ['courriel']],
  ['titre_pressenti', ['titre_pressenti', 'titre', 'rôle']],
  ['exclu', ['exclu']],
  ['notes', ['notes']],
];

// Champ de chaque clé d'en-tête, la clé tirée de l'écriture du § 10.1 par la
// même règle que celle d'un en-tête lu.
const CHAMP_DE_CLE = new Map(
  ENTETES_DES_CHAMPS.flatMap(([champ, entetes]) => entetes.map((entete) => [cleEntete(entete), champ])),
);

/**
 * Champ qu'un en-tête désigne, synonymes compris, sans égard à la casse, aux
 * accents, aux espaces, à « _ » ni à « - » ; null pour un en-tête inconnu,
 * comme « ligne » et « motif », les deux colonnes qu'ajoute le CSV des refus.
 *
 * @param {string} entete
 * @returns {string|null}  un élément de CHAMPS, ou null
 */
export function reconnaitre(entete) {
  return CHAMP_DE_CLE.get(cleEntete(entete)) ?? null;
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
  const rangsDesChamps = new Map(CHAMPS.map((champ) => [champ, []]));
  const nonReconnues = [];
  entetes.forEach((entete, rang) => {
    const champ = reconnaitre(entete);
    if (champ === null) nonReconnues.push(rang);
    else rangsDesChamps.get(champ).push(rang);
  });

  const colonnes = {};
  const ambigus = [];
  for (const champ of CHAMPS) {
    const rangs = rangsDesChamps.get(champ);
    if (rangs.length === 1) {
      colonnes[champ] = rangs[0];
    } else if (rangs.length > 1) {
      if (Object.hasOwn(choix, champ) && rangs.includes(choix[champ])) colonnes[champ] = choix[champ];
      else ambigus.push({ champ, rangs });
    }
  }
  return { colonnes, ambigus, nonReconnues };
}
