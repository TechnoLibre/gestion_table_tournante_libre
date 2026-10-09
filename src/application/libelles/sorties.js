// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des sorties (§ 11.7, § 18.6, § 19.4) : ce que porte une page
// imprimée ou la feuille de contrôle des badges, et que l'écran reprend.
// L'écran les lit par t, le papier par libelle : chaque clé vit donc dans
// une table de l'application, que les deux traductions réunissent.
import { causeEntreParentheses } from './aides.js';

export const TABLE = new Map([
  // La marque qui remplace la version dans une construction de
  // documentation (§ 19.4) : au bandeau, au premier écran, au pied des pages
  // imprimées et sur la feuille de contrôle.
  ['sorties.version.documentation', 'construction de documentation'],

  // L'impression que l'imprimante de la plateforme rend échouée
  // (refusImpression, § 11.7, § 13.4) : la cause est la raison que donne le
  // système d'impression, quand il en donne une.
  [
    'IMPRESSION_ECHEC',
    ({ cause }, texte) =>
      `L'impression a échoué${causeEntreParentheses(cause, texte)} : vérifiez l'imprimante choisie, puis imprimez de nouveau.`,
  ],
]);
