// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les conflits du placement montré dans la liste (§ 7.5, § 10.2) : ceux de
// conflitsDuPlacement (src/application/conflits_placement.js). Groupée, la
// liste les range sous ses groupes, que SectionParticipants lit et que
// Grille écrit : un groupe, de tout niveau, porte chaque conflit qui touche
// l'une de ses lignes ; une personne, les règles de ses conflits. Groupée ou
// non, la colonne « Conflits du placement » de Grille écrit ceux de chaque
// personne tour par tour, qui elle revoit et à quelle table elle revient
// (conflitsParTour, texteDuTour), et la rubrique du même nom de sa fiche,
// ligne par ligne (lignesDePersonne). Aucune fonction ne modifie ce qu'elle
// reçoit.
import { nomAffiche } from '../../application/personnes.js';

/** Les règles qui se localisent à une table, dans l'ordre de conflitsParTable. */
export const REGLES = Object.freeze(['conflitsOrganisation', 'separerOrganisations', 'nouveauxVoisins', 'nouvelleTable']);

const CLES_RAISONS = new Map(REGLES.map((regle) => [regle, `participants.conflit.raison.${regle}`]));
// La clé du texte de chaque règle dans la colonne « Conflits du placement » :
// celles qui portent un détail lisent les noms ou les tables, les deux
// autres gardent leur texte court, celui de la marque d'une personne en
// conflit.
const CLES_DU_TOUR = new Map([
  ['conflitsOrganisation', 'participants.conflit.regle.conflitsOrganisation'],
  ['separerOrganisations', 'participants.conflit.regle.separerOrganisations'],
  ['nouveauxVoisins', 'participants.conflit.regle.nouveauxVoisinsAvec'],
  ['nouvelleTable', 'participants.conflit.regle.nouvelleTableNumero'],
]);

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

/**
 * Les conflits de chaque personne qui en a un, tour par tour, que la colonne
 * « Conflits du placement » écrit : par identifiant, un élément par tour où
 * elle est en conflit, les tours croissants quel que soit l'ordre reçu,
 * chacun avec les règles de ses conflits à ce tour, sans doublon, dans
 * l'ordre de REGLES. Chaque règle porte son détail : avec, le nom affiché
 * de chaque autre personne de ses conflits à ce tour, dans l'ordre des
 * paires, chacune une fois ; tables, le numéro affiché de la table de ses
 * conflits, croissants, sans doublon — un seul, une personne n'étant assise
 * qu'à une table par tour. Comme dans la fiche, une autre personne se
 * reconnaît à son identifiant : deux homonymes y font deux noms. Une
 * personne que participants n'a pas n'est pas nommée. Une personne sans
 * conflit n'a pas d'entrée ; null, aucun placement montré, rend une table
 * vide.
 *
 * @param {Array<{tour: number, numero: number, regle: string, personnes: number[]}>|null} conflits   ceux de conflitsDuPlacement
 * @param {Array<{id: number, nom: string, prenom: string|null}>} participants
 * @returns {Map<number, Array<{tour: number, regles: Array<{regle: string, avec: string[], tables: number[]}>}>>}
 */
export function conflitsParTour(conflits, participants) {
  const parId = new Map(participants.map((p) => [p.id, p]));
  // Par personne, par tour, puis par règle : les autres personnes vues,
  // dans l'ordre d'arrivée, et les numéros des tables.
  const vues = new Map();
  for (const { tour, numero, regle, personnes } of conflits ?? []) {
    for (const id of personnes) {
      if (!vues.has(id)) vues.set(id, new Map());
      const parTour = vues.get(id);
      if (!parTour.has(tour)) parTour.set(tour, new Map());
      const parRegle = parTour.get(tour);
      if (!parRegle.has(regle)) parRegle.set(regle, { autres: new Set(), tables: new Set() });
      const vue = parRegle.get(regle);
      vue.tables.add(numero);
      for (const autre of personnes) if (autre !== id) vue.autres.add(autre);
    }
  }
  const detail = (regle, { autres, tables }) => ({
    regle,
    avec: [...autres].filter((autre) => parId.has(autre)).map((autre) => nomAffiche(parId.get(autre))),
    tables: [...tables].sort((a, b) => a - b),
  });
  return new Map(
    [...vues].map(([id, parTour]) => [
      id,
      [...parTour]
        .sort(([a], [b]) => a - b)
        .map(([tour, parRegle]) => ({
          tour,
          regles: REGLES.filter((regle) => parRegle.has(regle)).map((regle) => detail(regle, parRegle.get(regle))),
        })),
    ]),
  );
}

/**
 * Le texte des règles d'un tour dans la colonne « Conflits du placement »,
 * celles d'un élément de conflitsParTour : « se revoient » nomme les autres
 * personnes, « revient à une table » donne le numéro de la table, les deux
 * autres règles gardent leur texte court ; la clé
 * participants.conflit.reglesDuTour les réunit. Chaque texte passe par t,
 * si bien que celui de l'écran y pose ses insécables.
 *
 * @param {Array<{regle: string, avec: string[], tables: number[]}>} regles
 * @param {(cle: string, details?: Object) => string} t
 * @returns {string}
 * @throws {RangeError} une règle hors de REGLES
 */
export function texteDuTour(regles, t) {
  const textes = regles.map(({ regle, avec, tables }) => {
    const cle = CLES_DU_TOUR.get(regle);
    if (cle === undefined) throw new RangeError(`règle inconnue : ${JSON.stringify(regle)}`);
    return t(cle, { noms: avec, tables });
  });
  return t('participants.conflit.reglesDuTour', { textes });
}

/**
 * Les lignes de la rubrique « Conflits du placement » de la fiche de la
 * personne id : une par conflit qui la nomme, dans l'ordre reçu — celui des
 * tours, puis des tables —, avec sa clé, le tour, le numéro affiché de la
 * table, la règle, le nom affiché de chaque autre personne du conflit et
 * les rencontres antérieures. Les conflits d'une même règle, à la même
 * table et au même tour, aux mêmes rencontres antérieures, se réunissent
 * en une ligne, qui nomme leurs autres personnes dans l'ordre des paires :
 * trois collègues à une table font, pour chacune, une ligne qui nomme les
 * deux autres. Deux paires revues aux rencontres différentes restent deux
 * lignes, chacune avec les siennes. Une nouvelle table ne nomme personne ;
 * une personne que participants n'a pas n'est pas nommée. La clé, unique
 * parmi les lignes de la personne, joint le tour, l'identifiant de la
 * table, la règle et les rencontres antérieures. null, aucun placement
 * montré, rend null.
 *
 * @param {Array<Object>|null} conflits   ceux de conflitsDuPlacement
 * @param {Array<{id: number, nom: string, prenom: string|null}>} participants
 * @param {number} id
 * @returns {Array<{cle: string, tour: number, numero: number, regle: string, avec: string[],
 *          deja: Array<{tour: number, numero: number}>}>|null}
 */
export function lignesDePersonne(conflits, participants, id) {
  if (conflits === null) return null;
  const parId = new Map(participants.map((p) => [p.id, p]));
  // Par clé, la ligne : chaque autre personne s'y nomme par son
  // identifiant, si bien que deux homonymes y font deux noms.
  const parCle = new Map();
  for (const { tour, table, numero, regle, personnes, deja } of conflits) {
    if (!personnes.includes(id)) continue;
    const cle = `${tour}:${table}:${regle}:${deja.map((rencontre) => `${rencontre.tour}.${rencontre.numero}`).join(',')}`;
    if (!parCle.has(cle)) parCle.set(cle, { ligne: { cle, tour, numero, regle, avec: [], deja } });
    const { ligne } = parCle.get(cle);
    for (const autre of personnes) {
      if (autre === id || !parId.has(autre)) continue;
      ligne.avec.push(nomAffiche(parId.get(autre)));
    }
  }
  return [...parCle.values()].map(({ ligne }) => ligne);
}
