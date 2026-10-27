// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les conflits d'organisation et les inclusions d'organisation d'une charge
// (§ 4, § 8.9) : les organisations que l'événement porte, et les listes qui
// les nomment et suivent un geste qui change ces organisations. Une liste ne
// nomme qu'une organisation que porte un participant, exclus compris, et
// jamais celle de la personne : le fichier refuse le reste. Un geste qui
// renomme la dernière personne d'une organisation y fait suivre la
// référence ; un geste qui fait disparaître une organisation l'ôte de chaque
// liste, dans la même entrée d'historique. Aucune fonction ne modifie ce
// qu'elle reçoit, hors de suivreOrganisations, qui écrit dans la charge
// suivante qu'elle reçoit.

// Deux chaînes, comparées unité UTF-16 par unité : l'ordre de l'écriture.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Les organisations que porte la charge, chacune une fois : celle de chaque
 * participant qui en porte une, exclus compris.
 *
 * @param {{participants: Array<{organisation: string|null}>}} charge
 * @returns {Set<string>}
 */
export function organisationsDe({ participants }) {
  return new Set(participants.flatMap(({ organisation }) => (organisation === null ? [] : [organisation])));
}

/** @typedef {{renommee: {de: string, vers: string}|null, retirees: string[], propres: number}} Suivi */

// Les listes d'un participant qui nomment des organisations : la clé du
// rendu de suivreOrganisations, puis le champ du participant.
const LISTES_D_ORGANISATIONS = [
  ['conflits', 'conflits'],
  ['inclusions', 'inclusionsOrganisation'],
];

// Les listes champ de la charge suivante, ramenées en place comme le dit
// suivreOrganisations : disparues, les organisations qui quittent les
// listes ; suit, le renommage que les listes suivent, ou null. Rend ce
// qui a suivi pour ces listes.
function suivreListes(suivante, champ, disparues, suit) {
  let renommee = null;
  const retirees = new Set();
  let propres = 0;
  suivante.participants = suivante.participants.map((participant) => {
    if (participant[champ] === undefined) return participant;
    const noms = new Set();
    for (const nom of participant[champ]) {
      if (suit !== null && nom === suit.de) {
        renommee = { de: suit.de, vers: suit.vers };
        noms.add(suit.vers);
      } else if (disparues.has(nom)) {
        retirees.add(nom);
      } else {
        noms.add(nom);
      }
    }
    if (noms.delete(participant.organisation)) propres += 1;
    const liste = [...noms].sort(comparerTextes);
    const avant = participant[champ];
    if (liste.length === avant.length && liste.every((nom, rang) => nom === avant[rang])) return participant;
    const copie = { ...participant };
    delete copie[champ];
    return liste.length === 0 ? copie : { ...copie, [champ]: liste };
  });
  return { renommee, retirees: [...retirees].sort(comparerTextes), propres };
}

/**
 * Les listes de conflits et d'inclusions d'organisation de la charge
 * suivante, ramenées aux organisations qu'elle porte (§ 4, § 8.9), en place.
 * Une organisation qu'avant portait et que suivante ne porte plus suit
 * renommage quand il la nomme — {de, vers}, la dernière personne de de
 * passée à vers — et chaque liste qui nommait de nomme alors vers ; toute
 * autre organisation disparue quitte chaque liste. Puis chaque liste perd
 * l'organisation de sa propre personne, qu'un renommage ou un changement
 * d'organisation peut y faire entrer. La liste reste rangée par unités de
 * code, sans doublon, et le champ se retire quand elle se vide. Chaque
 * participant touché est remplacé par une copie : les objets que suivante
 * partage avec une autre charge ne changent pas.
 *
 * Rend ce que le libellé du geste en dit, pour les conflits et pour les
 * inclusions : renommee, {de, vers} quand une liste au moins a suivi le
 * renommage, null sinon ; retirees, les organisations disparues que des
 * listes nommaient, rangées ; propres, le nombre de personnes dont la liste
 * a perdu leur propre organisation.
 *
 * @param {Object} avant      la charge reçue par le geste
 * @param {Object} suivante   la charge qu'il rend, modifiée en place
 * @param {{de: string, vers: string}|null} [renommage]
 * @returns {{conflits: Suivi, inclusions: Suivi}}
 */
export function suivreOrganisations(avant, suivante, renommage = null) {
  const presentes = organisationsDe(suivante);
  const disparues = new Set([...organisationsDe(avant)].filter((nom) => !presentes.has(nom)));
  const suit = renommage !== null && disparues.has(renommage.de) && presentes.has(renommage.vers) ? renommage : null;
  return Object.fromEntries(LISTES_D_ORGANISATIONS.map(([cle, champ]) => [cle, suivreListes(suivante, champ, disparues, suit)]));
}

/**
 * Vrai quand suivreOrganisations n'a rien changé à une sorte de listes, les
 * conflits ou les inclusions : ni renommage suivi, ni organisation retirée,
 * ni propre organisation ôtée.
 *
 * @param {Suivi} suivi
 * @returns {boolean}
 */
export const rienASuivre = ({ renommee, retirees, propres }) =>
  renommee === null && retirees.length === 0 && propres === 0;
