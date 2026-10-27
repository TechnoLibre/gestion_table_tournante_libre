// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle pur de la saisie des inclusions d'une personne (§ 4, § 10.2),
// que câblent la grille (Grille.svelte), la fiche (RubriqueInclusions.svelte)
// et leur éditeur à choix multiple (ChoixMultiple.svelte). Il ne lit aucune
// règle : changerInclusionsOrganisation, changerInclusionsParticipant et
// changerInclusions décident seules de ce qu'elles admettent, et les listes
// offertes se tirent de la charge que l'appelant lit.
//
// Une liste d'organisations se saisit comme celle des conflits
// (liste_conflits.js) : son texte canonique est la liste rangée par unités
// de code, sans doublon, écrite en JSON. Une liste de participants l'est par
// leurs identifiants croissants, sans doublon, écrits en JSON, '[]' pour
// aucun. La fiche saisit chaque liste à part, sous sa commande. La grille
// les saisit ensemble, dans une seule cellule : sa saisie est le JSON de la
// paire [organisations, participants], chacune canonique. Deux saisies
// égales disent les mêmes listes : la machine de champ
// (primitives/champ.js) reconnaît ainsi « rien de changé » à l'égalité de
// deux chaînes, et cocher puis décocher un choix ne valide rien.
//
// Une personne incluse se désigne par son identifiant, jamais par son nom :
// les cibles (ciblesDeParticipants) portent, pour chaque identifiant, le
// nom affiché, la marque d'une exclue et celle d'un homonyme, que le
// libellé d'un choix écrit (libelleDeCible). Les choix et l'affichage
// rangent les personnes par la clé normalisée de leur nom, deux noms de
// même clé départagés par l'identifiant croissant, jamais par une
// comparaison de langue. Aucune fonction ne modifie ce qu'elle reçoit.

import { nomAffiche } from '../../application/personnes.js';
import { saisieDeConflits } from './liste_conflits.js';

// Deux chaînes, comparées unité UTF-16 par unité : l'ordre du fichier.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Les identifiants d'une saisie de participants, croissants.
const idsDeSaisie = (saisie) => JSON.parse(saisie);

// La paire [organisations, participants] d'une saisie de la grille.
const paireDeSaisie = (saisie) => JSON.parse(saisie);

// Deux listes rangées, égales élément par élément.
const memesListes = (a, b) => a.length === b.length && a.every((valeur, rang) => valeur === b[rang]);

/**
 * La saisie canonique d'une liste de participants : les identifiants
 * croissants, sans doublon, en JSON.
 *
 * @param {number[]} ids   dans un ordre quelconque, doublons admis
 * @returns {string}
 */
export function saisieDeParticipants(ids) {
  return JSON.stringify([...new Set(ids)].sort((a, b) => a - b));
}

/**
 * La saisie des inclusions d'organisation enregistrées d'une personne : sa
 * liste, la liste vide quand le champ manque, sous la forme des conflits.
 *
 * @param {{inclusionsOrganisation?: readonly string[]}} personne
 * @returns {string}
 */
export function saisieOrganisationsEnregistree(personne) {
  return saisieDeConflits(personne.inclusionsOrganisation ?? []);
}

/**
 * La saisie des inclusions de participant enregistrées d'une personne : sa
 * liste, la liste vide quand le champ manque.
 *
 * @param {{inclusionsParticipant?: readonly number[]}} personne
 * @returns {string}
 */
export function saisieParticipantsEnregistree(personne) {
  return saisieDeParticipants(personne.inclusionsParticipant ?? []);
}

/**
 * La lecture d'une saisie de participants, celle que creerMachineChamp
 * reçoit : { valeur } avec ses identifiants, vide comprise. Elle ne refuse
 * jamais : la commande juge chaque identifiant.
 *
 * @param {string} texte
 * @returns {{valeur: number[]}}
 */
export function lectureParticipants(texte) {
  return { valeur: idsDeSaisie(texte) };
}

/**
 * La saisie de participants après la bascule d'un choix : l'identifiant
 * ajouté quand il se coche, retiré quand il se décoche.
 *
 * @param {string} saisie
 * @param {number} id
 * @param {boolean} coche
 * @returns {string}
 */
export function saisieApresBasculeParticipant(saisie, id, coche) {
  const autres = idsDeSaisie(saisie).filter((autre) => autre !== id);
  return saisieDeParticipants(coche ? [...autres, id] : autres);
}

/**
 * Les cibles possibles d'une inclusion de participant : chaque participant
 * de l'événement, exclus compris, par identifiant, avec son nom affiché
 * (nomAffiche), exclue quand il l'est, et homonyme quand une autre personne
 * porte le même nom affiché.
 *
 * @param {ReadonlyArray<{id: number, nom: string, prenom: string|null, exclu: boolean}>} participants
 * @returns {Map<number, {nom: string, exclue: boolean, homonyme: boolean}>}
 */
export function ciblesDeParticipants(participants) {
  const noms = participants.map((personne) => [personne, nomAffiche(personne)]);
  const parNom = new Map();
  for (const [, nom] of noms) parNom.set(nom, (parNom.get(nom) ?? 0) + 1);
  return new Map(noms.map(([{ id, exclu }, nom]) => [id, { nom, exclue: exclu, homonyme: parNom.get(nom) > 1 }]));
}

/**
 * Le libellé d'une cible : participants.inclusions.cible, qui écrit le nom,
 * l'identifiant d'un homonyme et la marque d'une exclue ; un identifiant que
 * l'événement n'a plus se nomme par participants.inclusions.inconnue.
 *
 * @param {Map<number, {nom: string, exclue: boolean, homonyme: boolean}>} cibles
 * @param {number} id
 * @param {(cle: string, details?: Object) => string} t
 * @returns {string}
 */
export function libelleDeCible(cibles, id, t) {
  const cible = cibles.get(id);
  if (cible === undefined) return t('participants.inclusions.inconnue', { id });
  return t('participants.inclusions.cible', { id, ...cible });
}

/**
 * Le nom d'une cible, celui que lit la recherche d'un éditeur de
 * participants : le nom affiché, sans l'identifiant d'un homonyme ni la
 * marque d'une exclue ; vide pour un identifiant que l'événement n'a plus.
 *
 * @param {Map<number, {nom: string}>} cibles
 * @param {number} id
 * @returns {string}
 */
export function nomDeCible(cibles, id) {
  return cibles.get(id)?.nom ?? '';
}

// Les identifiants rangés par la clé normalisée du nom de leur cible, puis
// par identifiant croissant ; un identifiant sans cible après tous les
// autres.
function rangerIds(ids, cibles, cleNormalisee) {
  const cles = new Map(ids.map((id) => [id, cibles.has(id) ? cleNormalisee(cibles.get(id).nom) : null]));
  return [...ids].sort((a, b) => {
    const ca = cles.get(a);
    const cb = cles.get(b);
    if (ca !== cb) {
      if (ca === null) return 1;
      if (cb === null) return -1;
      const ecart = comparerTextes(ca, cb);
      if (ecart !== 0) return ecart;
    }
    return a - b;
  });
}

/**
 * Les choix d'un éditeur de participants : chaque cible hors soi, la
 * personne qui porte la liste, puis chaque identifiant de la saisie que
 * l'événement n'a plus, pour qu'il se décoche ; chacun coché quand la saisie
 * le nomme. Rangés par la clé normalisée du nom, puis par identifiant. Rend
 * une liste neuve.
 *
 * @param {string} saisie
 * @param {Map<number, Object>} cibles   celles de ciblesDeParticipants
 * @param {number} soi
 * @param {(texte: string) => string} cleNormalisee
 * @returns {Array<{valeur: number, coche: boolean}>}
 */
export function choixDeParticipants(saisie, cibles, soi, cleNormalisee) {
  const cochees = new Set(idsDeSaisie(saisie));
  const offerts = new Set([...cibles.keys()].filter((id) => id !== soi));
  for (const id of cochees) offerts.add(id);
  return rangerIds([...offerts], cibles, cleNormalisee).map((valeur) => ({ valeur, coche: cochees.has(valeur) }));
}

/**
 * Les personnes qu'une liste d'inclusions nomme, dans l'ordre où la grille et
 * la fiche les écrivent : par la clé normalisée du nom, puis par
 * identifiant ; vide sans liste.
 *
 * @param {readonly number[]|undefined} ids
 * @param {Map<number, Object>} cibles
 * @param {(texte: string) => string} cleNormalisee
 * @returns {number[]}
 */
export function participantsInclus(ids, cibles, cleNormalisee) {
  return rangerIds(ids ?? [], cibles, cleNormalisee);
}

/**
 * La commande qu'exécute une liste d'organisations validée :
 * changerInclusionsOrganisation de la liste entière, une entrée d'historique.
 *
 * @param {number} id
 * @param {readonly string[]} organisations
 * @returns {{nom: 'changerInclusionsOrganisation', args: {id: number, organisations: string[]}}}
 */
export function commandeInclusionsOrganisation(id, organisations) {
  return { nom: 'changerInclusionsOrganisation', args: { id, organisations: [...organisations] } };
}

/**
 * La commande qu'exécute une liste de participants validée :
 * changerInclusionsParticipant de la liste entière, une entrée d'historique.
 *
 * @param {number} id
 * @param {readonly number[]} participants
 * @returns {{nom: 'changerInclusionsParticipant', args: {id: number, participants: number[]}}}
 */
export function commandeInclusionsParticipant(id, participants) {
  return { nom: 'changerInclusionsParticipant', args: { id, participants: [...participants] } };
}

/**
 * La saisie canonique de la grille : le JSON de la paire [organisations,
 * participants], chacune canonique.
 *
 * @param {readonly string[]} organisations
 * @param {readonly number[]} participants
 * @returns {string}
 */
export function saisieDInclusions(organisations, participants) {
  return JSON.stringify([JSON.parse(saisieDeConflits(organisations)), JSON.parse(saisieDeParticipants(participants))]);
}

/**
 * La saisie de la grille pour les inclusions enregistrées d'une personne.
 *
 * @param {{inclusionsOrganisation?: readonly string[], inclusionsParticipant?: readonly number[]}} personne
 * @returns {string}
 */
export function saisieInclusionsEnregistree(personne) {
  return saisieDInclusions(personne.inclusionsOrganisation ?? [], personne.inclusionsParticipant ?? []);
}

/**
 * La lecture d'une saisie de la grille : { valeur: {organisations,
 * participants} }, vides comprises. Elle ne refuse jamais.
 *
 * @param {string} texte
 * @returns {{valeur: {organisations: string[], participants: number[]}}}
 */
export function lectureInclusions(texte) {
  const [organisations, participants] = paireDeSaisie(texte);
  return { valeur: { organisations, participants } };
}

/**
 * Les deux saisies que porte une saisie de la grille, chacune sous la forme
 * de sa liste : celle des organisations, que lit choixDeConflits, et celle
 * des participants, que lit choixDeParticipants.
 *
 * @param {string} saisie
 * @returns {{organisations: string, participants: string}}
 */
export function partiesDInclusions(saisie) {
  const [organisations, participants] = paireDeSaisie(saisie);
  return { organisations: JSON.stringify(organisations), participants: JSON.stringify(participants) };
}

/**
 * La saisie de la grille après la bascule d'un choix de l'une de ses deux
 * listes : sorte 'organisation' bascule un nom, 'participant' un
 * identifiant ; l'autre liste ne change pas.
 *
 * @param {string} saisie
 * @param {'organisation'|'participant'} sorte
 * @param {string|number} valeur
 * @param {boolean} coche
 * @returns {string}
 * @throws {RangeError} une autre sorte
 */
export function saisieApresBasculeInclusion(saisie, sorte, valeur, coche) {
  const [organisations, participants] = paireDeSaisie(saisie);
  if (sorte === 'organisation') {
    const autres = organisations.filter((nom) => nom !== valeur);
    return saisieDInclusions(coche ? [...autres, valeur] : autres, participants);
  }
  if (sorte === 'participant') {
    const autres = participants.filter((id) => id !== valeur);
    return saisieDInclusions(organisations, coche ? [...autres, valeur] : autres);
  }
  throw new RangeError(`sorte inconnue : ${JSON.stringify(sorte)}`);
}

/**
 * La commande qu'exécute une saisie de la grille validée : changerInclusions,
 * une seule entrée d'historique, qui ne porte que les listes que la saisie
 * change. Une liste part quand sa valeur validée diffère de celle de
 * l'ouverture, initiale, et de celle que la personne porte à la
 * validation. Une liste que la saisie ne touche pas ne part jamais : une
 * écriture venue d'ailleurs pendant la saisie la garde. Une liste que la
 * saisie ramène à ce que la personne porte déjà ne part pas non plus. null
 * quand aucune ne part.
 *
 * @param {{id: number, inclusionsOrganisation?: readonly string[], inclusionsParticipant?: readonly number[]}} personne
 *        la personne à la validation
 * @param {{organisations: string[], participants: number[]}} initiale   la
 *        lecture de la saisie de l'ouverture
 * @param {{organisations: string[], participants: number[]}} valeur   la
 *        lecture de la saisie validée
 * @returns {{nom: 'changerInclusions', args: {id: number, organisations?: string[], participants?: number[]}}|null}
 */
export function commandeDInclusions(personne, initiale, valeur) {
  const [organisations, participants] = paireDeSaisie(saisieInclusionsEnregistree(personne));
  const args = { id: personne.id };
  if (!memesListes(valeur.organisations, initiale.organisations) && !memesListes(valeur.organisations, organisations)) {
    args.organisations = [...valeur.organisations];
  }
  if (!memesListes(valeur.participants, initiale.participants) && !memesListes(valeur.participants, participants)) {
    args.participants = [...valeur.participants];
  }
  return Object.keys(args).length === 1 ? null : { nom: 'changerInclusions', args };
}

/**
 * La valeur de tri des inclusions d'une personne : le nombre de ses lignes,
 * organisations et participants ensemble ; null sans aucune.
 *
 * @param {{inclusionsOrganisation?: readonly string[], inclusionsParticipant?: readonly number[]}} personne
 * @returns {number|null}
 */
export function cleTriInclusions(personne) {
  const lignes = (personne.inclusionsOrganisation?.length ?? 0) + (personne.inclusionsParticipant?.length ?? 0);
  return lignes === 0 ? null : lignes;
}
