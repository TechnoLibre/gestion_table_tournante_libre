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
// Une inclusion de participant désigne une personne par son identifiant,
// que le CSV n'écrit pas : sa cellule nomme chaque personne incluse par son
// nom affiché, prénom puis nom, numéro compris, et l'import la relit par ce
// nom. Deux personnes de même nom affiché ne s'y distinguent pas ;
// inclusionsVersHomonymes compte les inclusions qui en visent une, que
// l'écran annonce à l'export.
//
// Le modèle des participants (§ 10.1) est l'export de quatre personnes
// inventées, dont seule la présence suit le nombre de tours de l'événement :
// il a la forme de l'export, et s'importe tel quel sous ce nombre de tours.

import { TOURS_MAX } from '../stockage/document.js';
import { nomAffiche } from '../stockage/personnes.js';
import { lireConflits, organisationsConnues } from './apercu.js';
import { CHAMPS } from './colonnes.js';
import { cleNormalisee } from './normalisation.js';
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

/**
 * Jointure des conflits d'une cellule (§ 10.2) : un point-virgule, que la
 * découpe de l'import lit dans la cellule, suivi d'une espace, qu'elle
 * retire. La virgule n'en est pas une : un nom d'organisation peut en porter.
 * Les deux cellules d'inclusions se joignent de même.
 */
export const JOINTURE_CONFLITS = '; ';

// Les jointures qu'essaie une cellule de conflits ou d'inclusions, dans
// l'ordre : la première dont la cellule se relit (lireConflits) en la même
// liste. Une organisation qui porte « ; » fait relire « A; B » d'un seul nom
// quand l'événement la nomme ainsi : la barre verticale, puis la fin de
// ligne, séparent alors les noms. Un nom de personne qui en porte un se
// joint par la même règle.
const JOINTURES_CONFLITS = Object.freeze([JOINTURE_CONFLITS, ' | ', '\n']);

const MARQUE_ORDRE_OCTETS = '\u{FEFF}';
const FIN_DE_LIGNE = '\r\n';
const GUILLEMET = '"';

// Les deux valeurs écrites d'« exclu » et de l'animation réservée, que la
// liste fermée de l'aperçu relit : oui pour vrai, non pour faux.
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
  ['conflit_organisation', 'conflits'],
  ['animation_reservee', 'animationReservee'],
  ['inclusion_organisation', 'inclusionsOrganisation'],
  ['inclusion_participant', 'inclusionsParticipant'],
]);

// Les noms d'une cellule de conflits ou d'inclusions, dans l'ordre de leur
// liste, joints par la première jointure de JOINTURES_CONFLITS dont la
// cellule se relit (lireConflits) contre connues en la même liste, par
// JOINTURE_CONFLITS quand aucune ne le fait.
function joindreNoms(noms, connues) {
  const cles = noms.map(cleNormalisee).join('\n');
  const relue = (texte) => (lireConflits(texte, connues) ?? []).map(cleNormalisee).join('\n') === cles;
  return JOINTURES_CONFLITS.map((jointure) => noms.join(jointure)).find(relue) ?? noms.join(JOINTURE_CONFLITS);
}

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

// Cellule d'un champ de CHAMPS pour le participant de rang donné, à partir de
// 0 : exclu en oui ou non, l'animation réservée en oui pour la marque, non
// sans elle, les étiquettes jointes par JOINTURE_ETIQUETTES dans l'ordre de
// leur liste, vide quand la clé manque, la présence par ecrirePresence, vide
// quand elle manque, les conflits et les inclusions d'organisation dans
// l'ordre de leur liste, joints par joindreNoms contre connues.organisations,
// les organisations de la liste exportée, les inclusions de participant par
// le nom affiché de chaque personne incluse, dans l'ordre de la liste, joints
// par joindreNoms contre connues.personnes, les noms affichés de la liste
// exportée, chacune vide quand la clé manque, un texte tel quel, null vide.
// Lèvent TypeError un exclu qui n'est pas un booléen, une marque présente qui
// n'est pas vraie, des étiquettes, des conflits ou des inclusions
// d'organisation présents qui ne sont pas une liste de textes, des
// inclusions de participant présentes qui ne sont pas une liste
// d'identifiants de la liste exportée, une présence présente qui n'est pas
// une liste croissante de tours, un nom qui n'est pas une chaîne, un autre
// texte ni chaîne ni null. Écrit sans bruit « non » ou vide, un exclu de
// travers réinviterait au réimport une personne qui s'est désistée ; un
// texte d'un autre genre lèverait plus loin, dans l'écriture, sans nommer ni
// la personne ni le champ.
function cellule(participant, champ, rang, connues) {
  const valeur = participant[PROPRIETE_DU_CHAMP.get(champ)];
  const refuser = (attendu) => {
    const recu = JSON.stringify(valeur) ?? String(valeur);
    throw new TypeError(`participant ${rang + 1} de la liste, ${champ} : ${attendu} attendu, reçu ${recu}`);
  };
  if (champ === 'exclu') {
    if (typeof valeur !== 'boolean') refuser('booléen');
    return valeur ? OUI : NON;
  }
  if (champ === 'animation_reservee') {
    if (valeur !== undefined && valeur !== true) refuser('vrai ou absent');
    return valeur === true ? OUI : NON;
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
  if (champ === 'conflit_organisation' || champ === 'inclusion_organisation') {
    if (valeur === undefined) return '';
    if (!Array.isArray(valeur) || !valeur.every((nom) => typeof nom === 'string')) refuser('liste de textes');
    return joindreNoms(valeur, connues.organisations);
  }
  if (champ === 'inclusion_participant') {
    if (valeur === undefined) return '';
    if (!Array.isArray(valeur) || !valeur.every((id) => connues.parId.has(id))) refuser("liste d'identifiants de la liste");
    return joindreNoms(valeur.map((id) => nomAffiche(connues.parId.get(id))), connues.personnes);
  }
  if (valeur === null && champ !== 'nom') return '';
  if (typeof valeur !== 'string') refuser(champ === 'nom' ? 'texte' : 'texte ou null');
  return valeur;
}

/**
 * La liste des participants en CSV, dans la forme exacte que l'import lit
 * (§ 10.2) : UTF-8 avec marque, « ; », CRLF ; l'en-tête
 * nom;prenom;organisation;courriel;titre_pressenti;exclu;notes;etiquettes;presence,
 * les champs de CHAMPS dans leur ordre, suivis de conflit_organisation dès
 * qu'un participant de la liste porte des conflits, de animation_reservee dès
 * qu'un participant porte la marque, de inclusion_organisation et de
 * inclusion_participant dès qu'un participant porte une telle liste, chacune
 * à part ; puis un participant par ligne, dans l'ordre de la liste reçue, que
 * la charge range par identifiant. exclu s'écrit oui ou non, un champ null
 * vide, la colonne etiquettes toujours, ses étiquettes jointes par « , »,
 * vide sans étiquette, puis la colonne presence toujours, vide pour tous les
 * tours, sinon en plages et en listes (ecrirePresence), puis, quand elle
 * s'écrit, la colonne des conflits, vide sans conflit, ses noms joints par
 * « ; », sauf quand la cellule se relirait autrement (JOINTURES_CONFLITS) ;
 * un champ qui porte « ; », un guillemet ou une fin de ligne entre
 * guillemets. Sans conflit, la colonne manque : le fichier d'une liste qui
 * n'en porte pas reste celui d'avant le champ, et son réimport en mise à jour
 * ne touche aucune liste. La colonne de l'animation réservée, quand elle
 * s'écrit, porte oui ou non ; sans marque dans la liste, elle manque de même.
 * Les colonnes des inclusions, quand elles s'écrivent, portent les
 * organisations comme les conflits, et les personnes par leur nom affiché
 * (nomAffiche), joints de même ; sans liste, chacune manque. L'identifiant ne
 * s'écrit pas : le réimport en attribue de neufs, et relit chaque personne
 * incluse par son nom, si bien qu'une inclusion qui vise une personne de même
 * nom affiché qu'une autre ne se relit pas (inclusionsVersHomonymes). La
 * liste reçue n'est pas modifiée.
 *
 * @param {import('../stockage/types.js').Participant[]} participants
 * @returns {Uint8Array}
 * @throws {TypeError} pour un exclu qui n'est pas un booléen, une marque
 *   d'animation réservée présente qui n'est pas vraie, des étiquettes, des
 *   conflits ou des inclusions d'organisation présents qui ne sont pas une
 *   liste de textes, des inclusions de participant présentes qui ne sont pas
 *   une liste d'identifiants de la liste reçue, une présence présente qui
 *   n'est pas une liste croissante de tours, un nom qui n'est pas une chaîne,
 *   un autre texte ni chaîne ni null
 */
export function exporterParticipants(participants) {
  const porte = (cle) => participants.some((participant) => Object.hasOwn(participant, cle));
  const omis = new Set(
    [
      ['conflits', 'conflit_organisation'],
      ['animationReservee', 'animation_reservee'],
      ['inclusionsOrganisation', 'inclusion_organisation'],
      ['inclusionsParticipant', 'inclusion_participant'],
    ].flatMap(([cle, champ]) => (porte(cle) ? [] : [champ])),
  );
  const champs = CHAMPS.filter((champ) => !omis.has(champ));
  const parId = new Map(participants.map((participant) => [participant.id, participant]));
  const connues = {
    organisations: organisationsConnues(
      participants.flatMap(({ organisation }) => (typeof organisation === 'string' ? [organisation] : [])),
    ),
    parId,
    personnes: organisationsConnues(omis.has('inclusion_participant') ? [] : participants.map(nomAffiche)),
  };
  const lignes = participants.map((participant, rang) =>
    champs.map((champ) => cellule(participant, champ, rang, connues)),
  );
  return ecrireCsv([[...champs], ...lignes], SEPARATEUR);
}

/**
 * Le nombre d'inclusions de participant qui visent une personne dont une
 * autre de la liste porte le nom affiché, à la clé normalisée près (§ 10.2) :
 * l'export les écrit sous ce nom, et l'import, qui relit une personne par
 * son nom, refuse la cellule, INCLUSION_PARTICIPANT_AMBIGU. Une personne
 * numérotée par « Rendre les noms uniques » n'en est pas une : son numéro
 * la distingue. Un identifiant que la liste ne porte pas ne compte pas.
 *
 * @param {import('../stockage/types.js').Participant[]} participants
 * @returns {number}
 */
export function inclusionsVersHomonymes(participants) {
  const porteurs = new Map();
  for (const participant of participants) {
    const cle = cleNormalisee(nomAffiche(participant));
    porteurs.set(cle, (porteurs.get(cle) ?? 0) + 1);
  }
  const cleDe = new Map(participants.map((participant) => [participant.id, cleNormalisee(nomAffiche(participant))]));
  let total = 0;
  for (const { inclusionsParticipant = [] } of participants) {
    for (const id of inclusionsParticipant) if (cleDe.has(id) && porteurs.get(cleDe.get(id)) > 1) total += 1;
  }
  return total;
}

// Une personne inventée du modèle, ses champs omis vides et non exclue.
// L'identifiant ne s'écrit pas : il sert aux inclusions de participant, que
// l'export écrit par nom.
const exemple = (id, nom, prenom, autres) => ({
  id, nom, prenom, organisation: null, courriel: null, titrePressenti: null, notes: null, exclu: false, etiquettes: [],
  ...autres,
});

// Les personnes du modèle : à elles quatre, elles remplissent chaque colonne
// de CHAMPS, exclu et l'animation réservée sous leurs deux valeurs — la
// personne au titre pressenti à désigner —, une organisation partagée, une
// absente, une cellule à deux étiquettes, un conflit, que nomme la personne
// sans organisation, envers celle de l'exclue : une organisation existe par
// ses exclus aussi, une inclusion de cette même organisation, celle de
// l'exclue, que nomme une autre personne, et une inclusion de participant, la
// personne sans organisation. Leur présence s'ajoute selon le nombre de tours
// (presencesDuModele).
const EXEMPLES_DU_MODELE = [
  exemple(1, 'Ombrelle', 'Iris', {
    organisation: 'Coopérative Aubier', courriel: 'iris.ombrelle@exemple.test', titrePressenti: 'animation',
    etiquettes: ['finance', 'Montréal'], animationReservee: true, inclusionsParticipant: [4],
  }),
  exemple(2, 'Pervenche', 'Théo', {
    organisation: 'Coopérative Aubier', notes: 'arrive au deuxième tour', etiquettes: ['ressources humaines'],
    inclusionsOrganisation: ['Atelier Ressac'],
  }),
  exemple(3, 'Lacasse', 'Ondine', {
    organisation: 'Atelier Ressac', courriel: 'ondine.lacasse@exemple.test', notes: 'désistement annoncé', exclu: true,
  }),
  exemple(4, 'Tourteau', 'Basile', { etiquettes: ['bénévole'], conflits: ['Atelier Ressac'] }),
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
