// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les conflits du placement montré dans la liste groupée (§ 7.5, § 10.2) :
// ceux de conflitsDuPlacement (src/application/conflits_placement.js), que
// SectionParticipants lit et que Grille range sous ses groupes. Un groupe,
// de tout niveau, porte chaque conflit qui touche l'une de ses lignes ; une
// personne, les règles de ses conflits. Aucune fonction ne modifie ce
// qu'elle reçoit.
import { nomAffiche } from '../../application/personnes.js';

/** Les règles qui se localisent à une table, dans l'ordre de conflitsParTable. */
export const REGLES = Object.freeze(['separerOrganisations', 'nouveauxVoisins', 'nouvelleTable']);

const CLES_RAISONS = new Map(REGLES.map((regle) => [regle, `participants.conflit.raison.${regle}`]));

/**
 * La clé du texte qui dit la raison d'un conflit de la règle donnée.
 *
 * @param {string} regle   l'une de REGLES
 * @returns {string}
 * @throws {RangeError} une autre règle
 */
export function cleDeRaison(regle) {
  const cle = CLES_RAISONS.get(regle);
  if (cle === undefined) throw new RangeError(`règle inconnue : ${JSON.stringify(regle)}`);
  return cle;
}

/**
 * Les conflits de chaque groupe de groupesGrille (grille.js), de tout
 * niveau : ceux dont l'une des personnes est parmi les lignes du groupe —
 * celles de tous ses sous-groupes —, dans l'ordre reçu. Un conflit dont les
 * deux personnes sont dans deux groupes paraît dans chacun ; un parent le
 * compte une fois. Un groupe sans conflit n'a pas d'entrée.
 *
 * @param {Array<{cle: string, lignes: Array<{id: number}>, sousGroupes: Array<Object>|null}>} groupes
 * @param {Array<{personnes: number[]}>|null} conflits   null : aucun placement montré
 * @returns {Map<string, Array<Object>>}   clé du groupe → ses conflits
 */
export function conflitsDesGroupes(groupes, conflits) {
  const parGroupe = new Map();
  if (conflits === null || conflits.length === 0) return parGroupe;
  const visiter = (groupe) => {
    const ids = new Set(groupe.lignes.map(({ id }) => id));
    const siens = conflits.filter(({ personnes }) => personnes.some((id) => ids.has(id)));
    if (siens.length > 0) parGroupe.set(groupe.cle, siens);
    for (const sousGroupe of groupe.sousGroupes ?? []) visiter(sousGroupe);
  };
  for (const groupe of groupes) visiter(groupe);
  return parGroupe;
}

/**
 * Les règles des conflits de chaque personne qui en a un, sans doublon,
 * dans l'ordre de REGLES.
 *
 * @param {Array<{regle: string, personnes: number[]}>|null} conflits
 * @returns {Map<number, string[]>}
 */
export function reglesParPersonne(conflits) {
  const vues = new Map();
  for (const { regle, personnes } of conflits ?? []) {
    for (const id of personnes) {
      if (!vues.has(id)) vues.set(id, new Set());
      vues.get(id).add(regle);
    }
  }
  return new Map([...vues].map(([id, regles]) => [id, REGLES.filter((regle) => regles.has(regle))]));
}

/**
 * Une ligne par conflit, dans l'ordre reçu, que la grille écrit : sa clé,
 * unique parmi les conflits d'un placement — tour, table, règle et
 * personnes —, le tour, le numéro affiché de la table, la règle, les
 * personnes du conflit, le nom affiché de chacune dans leur ordre, et ses
 * rencontres antérieures. Une personne que participants n'a pas n'est pas
 * nommée. Les lignes se rangent sous les groupes par conflitsDesGroupes,
 * comme les conflits ; null, aucun placement montré, rend null.
 *
 * @param {Array<Object>|null} conflits   ceux de conflitsDuPlacement
 * @param {Array<{id: number, nom: string, prenom: string|null}>} participants
 * @returns {Array<{cle: string, tour: number, numero: number, regle: string, personnes: number[],
 *          noms: string[], deja: Array<{tour: number, numero: number}>}>|null}
 */
export function lignesDeConflit(conflits, participants) {
  if (conflits === null) return null;
  const parId = new Map(participants.map((p) => [p.id, p]));
  return conflits.map(({ tour, table, numero, regle, personnes, deja }) => ({
    cle: `${tour}:${table}:${regle}:${personnes.join('-')}`,
    tour,
    numero,
    regle,
    personnes,
    noms: personnes.filter((id) => parId.has(id)).map((id) => nomAffiche(parId.get(id))),
    deja,
  }));
}
