// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Version voisine d'une version affichée AAAA.MM.JJ.NN valide, pour les
// épreuves qui ont besoin d'une seconde version : même date, rang 01 changé
// en 02 et tout autre rang en 01. La date reste valide quelle qu'elle soit,
// un 29 février compris, et la voisine diffère toujours de la version reçue.
export function versionVoisine(version) {
  return version.replace(/\d{2}$/, (rang) => (rang === '01' ? '02' : '01'));
}
