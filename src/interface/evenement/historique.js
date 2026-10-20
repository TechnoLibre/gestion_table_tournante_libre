// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La vue du panneau d'historique (§ 8.3), pure : Historique.svelte la
// câble. Elle reçoit ce que rend seance.historique() — { position, lignes,
// reprise }, les lignes de la plus ancienne à la plus récente — et rend
// les lignes à montrer, de la plus récente à la plus ancienne, filtrées
// sur les instants nommés quand on le demande, découpées en pages de
// TAILLE_PAGE lignes comme le tableau des propositions. Rien ne s'y écrit :
// filtrer et paginer sont des états d'interface (§ 8.4).
//
// L'instant courant est la ligne la plus récente du journal : sa révision
// est celle de l'Ouvert, celle où « Nommer » pose son jalon, de sorte que
// le nom donné à l'instant courant se montre sur la ligne qui en porte la
// pastille. Après un retour, c'est donc la ligne du retour, et non la
// ligne visée : celle-ci, de même contenu, offre encore « Revenir », que la
// séance refuse comme sans effet. En reprise, le journal finit sur une
// autre révision que l'Ouvert, et aucune ligne n'est courante.
import { TAILLE_PAGE, nombreDePages } from '../propositions/modele.js';

// L'heure affichée d'un horodatage AAAA-MM-JJTHH:MM:SS±HH:MM : sa date et
// ses heures et minutes, découpées telles qu'écrites, dans le fuseau de
// leur écriture. Aucune conversion : l'opérateur lit l'heure de l'instant
// où le geste a eu lieu.
const quandDe = (horodatage) => `${horodatage.slice(0, 10)} ${horodatage.slice(11, 16)}`;

/**
 * La vue de l'historique.
 *
 * @param {{position: number|null, lignes: Object[], reprise: boolean}|null} historique
 *        ce que rend seance.historique() ; null sans événement, vu comme un
 *        historique sans ligne
 * @param {{jalonsSeuls?: boolean, page?: number}} [options]  jalonsSeuls :
 *        ne garder que les lignes qui portent un jalon au moins ; page :
 *        entière, à partir de 1, bornée aux pages existantes
 * @returns {{lignes: Object[], page: number, pages: number, premier: number,
 *   dernier: number, total: number, paginee: boolean,
 *   vide: 'aucunInstant'|'aucunJalon'|null}}  lignes : celles de la page, de
 *   la plus récente à la plus ancienne, chacune une copie de la ligne reçue
 *   — ses jalons copiés — qui porte en plus courante (la plus récente du
 *   journal, hors reprise), revenir (vrai hors de la ligne courante) et
 *   quand (son horodatage « AAAA-MM-JJ HH:MM ») ; page : la page bornée ;
 *   pages : leur nombre, un au moins ; premier et dernier : les places, à
 *   partir de 1, de la première et de la dernière ligne de la page parmi
 *   les lignes gardées, 0 et 0 sans ligne ; total : le nombre de lignes
 *   gardées ; paginee : vrai au-delà d'une page ; vide : 'aucunInstant'
 *   quand l'historique n'a aucune ligne, 'aucunJalon' quand le filtre n'en
 *   garde aucune, null sinon
 * @throws {TypeError} une page qui n'est pas un entier
 */
export function vueHistorique(historique, { jalonsSeuls = false, page = 1 } = {}) {
  if (!Number.isInteger(page)) throw new TypeError(`page : entier attendu, reçu ${JSON.stringify(page)}`);
  const recues = historique?.lignes ?? [];
  const courante = historique?.reprise === false ? recues.at(-1) : undefined;
  const gardees = [];
  for (let rang = recues.length - 1; rang >= 0; rang -= 1) {
    if (!jalonsSeuls || recues[rang].jalons.length > 0) gardees.push(recues[rang]);
  }
  const total = gardees.length;
  const pages = nombreDePages(total);
  const montree = Math.min(Math.max(1, page), pages);
  const debut = (montree - 1) * TAILLE_PAGE;
  const fin = Math.min(debut + TAILLE_PAGE, total);
  const lignes = gardees.slice(debut, fin).map((ligne) => ({
    ...ligne,
    jalons: ligne.jalons.map((jalon) => ({ ...jalon })),
    courante: ligne === courante,
    revenir: ligne !== courante,
    quand: quandDe(ligne.horodatage),
  }));
  let vide = null;
  if (recues.length === 0) vide = 'aucunInstant';
  else if (total === 0) vide = 'aucunJalon';
  return { lignes, page: montree, pages, premier: total === 0 ? 0 : debut + 1, dernier: fin, total, paginee: total > TAILLE_PAGE, vide };
}

/**
 * Le texte de l'étendue d'une page de l'historique, ses nombres mis en
 * forme par format.nombre ; nombre, le compte de la page, accorde son nom.
 *
 * @param {{premier: number, dernier: number, total: number}} vue
 * @param {{t: Function, format: {nombre: Function}}} outils
 * @returns {string}
 */
export function etendueHistorique({ premier, dernier, total }, { t, format }) {
  return t('evenement.historique.pages.etendue', {
    premier: format.nombre(premier),
    dernier: format.nombre(dernier),
    total: format.nombre(total),
    nombre: dernier - premier + 1,
  });
}
