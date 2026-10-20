// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

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
//
// Le modèle des participants (§ 10.1) est l'export de quatre personnes
// inventées, dont seule la présence suit le nombre de tours de l'événement :
// il a la forme de l'export, et s'importe tel quel sous ce nombre de tours.

import { TOURS_MAX } from '../stockage/document.js';
import { CHAMPS } from './colonnes.js';
import { ecrirePresence } from './presence.js';

/** Séparateur de l'export : celui qu'un tableur francophone rouvre sans manipulation (§ 10.3). */
export const SEPARATEUR = ';';

/**
 * Jointure des étiquettes d'une cellule (§ 10.2) : une virgule, séparateur
 * que la découpe de la saisie lit (SEPARATEURS_ETIQUETTES), suivie d'une
 * espace, que la mise en forme retire. Une étiquette ne porte aucun
 * séparateur : la cellule se relit en les mêmes étiquettes.
 */
export const JOINTURE_ETIQUETTES = ', ';

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
  ['organisation', 'organisation'],
  ['courriel', 'courriel'],
  ['titre_pressenti', 'titrePressenti'],
  ['exclu', 'exclu'],
  ['notes', 'notes'],
  ['etiquettes', 'etiquettes'],
  ['presence', 'presence'],
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

// Vrai pour une liste non vide d'entiers positifs strictement croissants :
// une présence que ecrirePresence écrit.
const presenceEcrite = (valeur) =>
  Array.isArray(valeur) &&
  valeur.length > 0 &&
  valeur.every((tour, rang) => Number.isInteger(tour) && tour >= 1 && (rang === 0 || tour > valeur[rang - 1]));

// Cellule d'un champ de CHAMPS pour le participant de rang donné, à partir
// de 0 : exclu en oui ou non, les étiquettes jointes par JOINTURE_ETIQUETTES
// dans l'ordre de leur liste, vide quand la clé manque, la présence par
// ecrirePresence, vide quand elle manque, un texte tel quel, null vide.
// Lèvent TypeError un exclu qui n'est pas un booléen, des étiquettes
// présentes qui ne sont pas une liste de textes, une présence présente qui
// n'est pas une liste croissante de tours, un nom qui n'est pas une chaîne,
// un autre texte ni chaîne ni null. Écrit sans bruit « non »
// ou vide, un exclu de travers réinviterait au réimport une personne qui
// s'est désistée ; un texte d'un autre genre lèverait plus loin, dans
// l'écriture, sans nommer ni la personne ni le champ.
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
  if (champ === 'etiquettes') {
    if (!Object.hasOwn(participant, 'etiquettes')) return '';
    if (!Array.isArray(valeur) || !valeur.every((motCle) => typeof motCle === 'string')) refuser('liste de textes');
    return valeur.join(JOINTURE_ETIQUETTES);
  }
  if (champ === 'presence') {
    if (valeur === undefined) return '';
    if (!presenceEcrite(valeur)) refuser('liste croissante de tours');
    return ecrirePresence(valeur);
  }
  if (valeur === null && champ !== 'nom') return '';
  if (typeof valeur !== 'string') refuser(champ === 'nom' ? 'texte' : 'texte ou null');
  return valeur;
}

/**
 * La liste des participants en CSV, dans la forme exacte que l'import lit
 * (§ 10.2) : UTF-8 avec marque, « ; », CRLF ; l'en-tête
 * nom;prenom;organisation;courriel;titre_pressenti;exclu;notes;etiquettes;presence,
 * les champs de CHAMPS dans leur ordre ; puis un participant par ligne, dans
 * l'ordre de la liste reçue, que la charge range par identifiant. exclu
 * s'écrit oui ou non, un champ null vide, la colonne etiquettes toujours,
 * ses étiquettes jointes par « , », vide sans étiquette, puis la colonne
 * presence toujours, vide pour tous les tours, sinon en plages et en listes
 * (ecrirePresence) ; un champ qui porte « ; », un guillemet ou une fin de
 * ligne entre guillemets. L'identifiant ne s'écrit pas : le réimport en
 * attribue de neufs. La liste reçue n'est pas modifiée.
 *
 * @param {import('../stockage/types.js').Participant[]} participants
 * @returns {Uint8Array}
 * @throws {TypeError} pour un exclu qui n'est pas un booléen, des étiquettes
 *   présentes qui ne sont pas une liste de textes, une présence présente
 *   qui n'est pas une liste croissante de tours, un nom qui n'est pas une
 *   chaîne, un autre texte ni chaîne ni null
 */
export function exporterParticipants(participants) {
  const lignes = participants.map((participant, rang) => CHAMPS.map((champ) => cellule(participant, champ, rang)));
  return ecrireCsv([[...CHAMPS], ...lignes], SEPARATEUR);
}

// Une personne inventée du modèle, ses champs omis vides et non exclue.
const exemple = (nom, prenom, autres) => ({
  nom, prenom, organisation: null, courriel: null, titrePressenti: null, notes: null, exclu: false, etiquettes: [], ...autres,
});

// Les personnes du modèle : à elles quatre, elles remplissent chaque colonne
// de CHAMPS, exclu sous ses deux valeurs, une organisation partagée, une
// absente, et une cellule à deux étiquettes. Leur présence s'ajoute selon le
// nombre de tours (presencesDuModele).
const EXEMPLES_DU_MODELE = [
  exemple('Ombrelle', 'Iris', {
    organisation: 'Coopérative Aubier', courriel: 'iris.ombrelle@exemple.test', titrePressenti: 'animation',
    etiquettes: ['finance', 'Montréal'],
  }),
  exemple('Pervenche', 'Théo', {
    organisation: 'Coopérative Aubier', notes: 'arrive au deuxième tour', etiquettes: ['ressources humaines'],
  }),
  exemple('Lacasse', 'Ondine', {
    organisation: 'Atelier Ressac', courriel: 'ondine.lacasse@exemple.test', notes: 'désistement annoncé', exclu: true,
  }),
  exemple('Tourteau', 'Basile', { etiquettes: ['bénévole'] }),
];

// Les tours de 1 à n.
const jusqua = (n) => Array.from({ length: n }, (_, rang) => rang + 1);

// La présence de chaque personne du modèle, rang à rang, sous tours tours :
// à deux tours au moins, une liste et une plage — Pervenche aux tours 2 et
// 3, Tourteau aux tours 1 à R − 1 —, « 2, 3 » et « 1-3 » à quatre tours,
// « 2 » et « 1 » à deux ; à un tour, aucune, la colonne reste vide. Aucune
// ne nomme chaque tour, si bien que chacune s'importe telle qu'écrite.
function presencesDuModele(tours) {
  if (tours === 1) return [undefined, undefined, undefined, undefined];
  return [undefined, [2, 3].filter((tour) => tour <= tours), undefined, jusqua(tours - 1)];
}

/**
 * Le modèle du CSV des participants, à télécharger (§ 10.1) : l'export
 * (exporterParticipants) de quatre personnes inventées, toujours les mêmes,
 * dont les cellules remplissent chaque colonne que l'import lit, et dont la
 * présence suit le nombre de tours de l'événement (presencesDuModele).
 * Importé tel quel sous ce nombre de tours, il ne refuse aucune ligne.
 * Chaque appel rend un tableau neuf.
 *
 * @param {{tours: number}} evenement  le nombre de tours de l'événement
 * @returns {Uint8Array}  UTF-8 avec marque, « ; », CRLF
 * @throws {TypeError} quand tours n'est pas un entier de 1 à TOURS_MAX
 */
export function modeleParticipants({ tours } = {}) {
  if (!Number.isInteger(tours) || tours < 1 || tours > TOURS_MAX) {
    throw new TypeError(`modeleParticipants : tours, entier de 1 à ${TOURS_MAX} attendu, reçu ${String(tours)}`);
  }
  const presences = presencesDuModele(tours);
  return exporterParticipants(
    EXEMPLES_DU_MODELE.map((personne, rang) =>
      presences[rang] === undefined ? personne : { ...personne, presence: presences[rang] },
    ),
  );
}
