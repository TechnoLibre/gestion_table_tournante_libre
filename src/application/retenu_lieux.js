// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les lieux d'une personne dans le retenu, et les retouches qui la déplacent
// à un tour (§ 7.1, § 8.9) : où il la place, la place qu'elle quitte, la
// réserve où elle attend. Chaque fonction lit ou modifie en place le retenu
// qu'elle reçoit, une copie que l'appelant a faite ; aucune ne contrôle ce
// qu'elle écrit. Sièges attribués, le siège est le rang dans la liste, une
// chaise vide s'y écrit null et une liste ne finit jamais par null.

const croissant = (a, b) => a - b;

/**
 * Où le retenu place id à ce tour : { table: rang de la liste, rang } à une
 * table, 'reserve' ailleurs — la réserve, et la liste des absents du tour
 * aussi —, ou null quand il ne le déclare pas.
 *
 * @param {Object} retenu
 * @param {number} tour  de 1 à retenu.tours
 * @param {number} id
 * @returns {{table: number, rang: number}|'reserve'|null}
 */
export function lieuDans(retenu, tour, id) {
  if (!retenu.participants.includes(id)) return null;
  const { sieges } = retenu.placement[tour - 1];
  for (let table = 0; table < sieges.length; table += 1) {
    const rang = sieges[table].indexOf(id);
    if (rang >= 0) return { table, rang };
  }
  return 'reserve';
}

/** Retire les null de fin d'une liste, en place. */
export function sansNullDeFin(liste) {
  while (liste.length > 0 && liste.at(-1) === null) liste.pop();
}

/**
 * Ôte id de sa place au tour, en place : sa chaise devient vide sous des
 * sièges attribués, la liste se resserre sinon ; ou il quitte la réserve.
 * Une personne que le retenu ne déclare pas, ou qu'il dit absente, ne bouge
 * pas.
 *
 * @param {Object} retenu
 * @param {number} tour
 * @param {number} id
 */
export function oter(retenu, tour, id) {
  const lieu = lieuDans(retenu, tour, id);
  const etage = retenu.placement[tour - 1];
  if (lieu === 'reserve') {
    etage.reserve = etage.reserve.filter((autre) => autre !== id);
  } else if (lieu !== null) {
    const liste = etage.sieges[lieu.table];
    if (retenu.siegesAttribues) {
      liste[lieu.rang] = null;
      sansNullDeFin(liste);
    } else {
      liste.splice(lieu.rang, 1);
    }
  }
}

/**
 * Verse id dans la réserve du tour, en place ; la réserve se range par
 * identifiant croissant.
 *
 * @param {Object} retenu
 * @param {number} tour
 * @param {number} id
 */
export function enReserve(retenu, tour, id) {
  const etage = retenu.placement[tour - 1];
  etage.reserve = [...etage.reserve, id].sort(croissant);
}
