// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'export de la liste des participants (§ 10.2, § 10.3), dans la forme exacte
// que l'import lit : UTF-8 avec marque d'ordre d'octets, « ; », CRLF, les
// champs de l'import pour en-têtes. Exporter puis réimporter rend les mêmes
// participants, champ par champ : le fichier sert de sauvegarde, et de gabarit
// que personne n'a besoin de documenter.
//
// L'écriture d'un CSV est unique : le CSV des lignes refusées d'un import passe
// par ecrireCsv, avec son propre séparateur. Une valeur s'écrit telle quelle,
// même quand elle commence par « = », « + », « - » ou « @ », qu'un tableur
// lirait comme une formule : la neutraliser romprait l'aller-retour. Une
// valeur se relit sans ses blancs de bord, que l'aperçu retire de chaque
// champ ; une valeur importée n'en porte pas.

import { CHAMPS } from './colonnes.js';

/** Séparateur de l'export : celui qu'un tableur francophone rouvre sans manipulation (§ 10.3). */
export const SEPARATEUR = ';';

const MARQUE_ORDRE_OCTETS = '\u{FEFF}';
const FIN_DE_LIGNE = '\r\n';
const GUILLEMET = '"';

// Les deux valeurs écrites d'« exclu », que la liste fermée de l'aperçu
// relit : oui pour vrai, non pour faux.
const OUI = 'oui';
const NON = 'non';

// Propriété du participant que porte chaque champ de CHAMPS.
const PROPRIETE_DU_CHAMP = new Map([
  ['nom', 'nom'],
  ['prenom', 'prenom'],
  ['appartenance', 'appartenance'],
  ['courriel', 'courriel'],
  ['titre_pressenti', 'titrePressenti'],
  ['exclu', 'exclu'],
  ['notes', 'notes'],
]);

// Un champ s'écrit cité (RFC 4180) quand il porte le séparateur, un retour
// chariot ou un saut de ligne, que la découpe lirait sinon comme des
// frontières, ou un guillemet, qui en tête ouvrirait un champ cité.
const SIGNES_A_CITER = /["\r\n]/;
const aCiter = (champ, separateur) => champ.includes(separateur) || SIGNES_A_CITER.test(champ);

// Champ cité : entre guillemets, chaque guillemet doublé.
const citer = (champ) => GUILLEMET + champ.replaceAll(GUILLEMET, GUILLEMET + GUILLEMET) + GUILLEMET;

/**
 * Octets d'un CSV : la marque d'ordre d'octets UTF-8, puis chaque
 * enregistrement, ses champs joints par le séparateur, terminé par CRLF,
 * dernier compris. Un champ qui porte le séparateur, un guillemet, un retour
 * chariot ou un saut de ligne s'écrit entre guillemets, les siens doublés ;
 * tout autre champ s'écrit tel quel, blancs compris. decouper relit chaque
 * enregistrement tel qu'il est donné, sous le même séparateur.
 *
 * @param {string[][]} enregistrements
 * @param {string} separateur  un caractère
 * @returns {Uint8Array}  UTF-8 avec marque
 */
export function ecrireCsv(enregistrements, separateur) {
  const lignes = enregistrements.map(
    (enregistrement) =>
      enregistrement.map((champ) => (aCiter(champ, separateur) ? citer(champ) : champ)).join(separateur) + FIN_DE_LIGNE,
  );
  return new TextEncoder().encode(MARQUE_ORDRE_OCTETS + lignes.join(''));
}

// Cellule d'un champ de CHAMPS pour le participant de rang donné, à partir
// de 0 : exclu en oui ou non, un texte tel quel, null vide. Lèvent TypeError
// un exclu qui n'est pas un booléen, un nom qui n'est pas une chaîne, un
// autre texte ni chaîne ni null. Écrit sans bruit « non » ou vide, un exclu
// de travers réinviterait au réimport une personne qui s'est désistée ; un
// texte d'un autre genre lèverait plus loin, dans l'écriture, sans nommer ni
// la personne ni le champ.
function cellule(participant, champ, rang) {
  const valeur = participant[PROPRIETE_DU_CHAMP.get(champ)];
  const refuser = (attendu) => {
    const recu = JSON.stringify(valeur) ?? String(valeur);
    throw new TypeError(`participant ${rang + 1} de la liste, ${champ} : ${attendu} attendu, reçu ${recu}`);
  };
  if (champ === 'exclu') {
    if (typeof valeur !== 'boolean') refuser('booléen');
    return valeur ? OUI : NON;
  }
  if (valeur === null && champ !== 'nom') return '';
  if (typeof valeur !== 'string') refuser(champ === 'nom' ? 'texte' : 'texte ou null');
  return valeur;
}

/**
 * La liste des participants en CSV, dans la forme exacte que l'import lit
 * (§ 10.2) : UTF-8 avec marque, « ; », CRLF ; l'en-tête
 * nom;prenom;appartenance;courriel;titre_pressenti;exclu;notes, les champs
 * de CHAMPS dans leur ordre ; puis un participant par ligne, dans l'ordre de
 * la liste reçue, que la charge range par identifiant. exclu s'écrit oui ou
 * non, un champ null vide, un champ qui porte « ; », un guillemet ou une fin
 * de ligne entre guillemets. L'identifiant ne s'écrit pas : le réimport en
 * attribue de neufs. La liste reçue n'est pas modifiée.
 *
 * @param {import('../stockage/types.js').Participant[]} participants
 * @returns {Uint8Array}
 * @throws {TypeError} pour un exclu qui n'est pas un booléen, un nom qui
 *   n'est pas une chaîne, un autre texte ni chaîne ni null
 */
export function exporterParticipants(participants) {
  const lignes = participants.map((participant, rang) => CHAMPS.map((champ) => cellule(participant, champ, rang)));
  return ecrireCsv([[...CHAMPS], ...lignes], SEPARATEUR);
}
