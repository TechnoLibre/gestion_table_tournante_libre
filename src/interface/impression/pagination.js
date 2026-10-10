// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La pagination des listes imprimées (§ 11.7) : la liste d'accueil et la
// feuille par table ne tronquent jamais, elles replient (§ 7.4) ; la hauteur
// d'une ligne dépend donc de son texte, et se mesure au rendu. Ce module
// range des hauteurs mesurées en pages, sans DOM, dans une seule unité au
// choix de l'appelant — px CSS pour les vues. Chaque page répète l'en-tête
// de sa liste. mesurerListes lit, sur une feuille rendue hors de la vue, ce
// que la pagination reçoit.

// L'écart qu'une somme de hauteurs peut avoir avec la hauteur utile et y
// tenir encore : le bruit de l'arithmétique flottante (0,1 + 0,2 dépasse 0,3
// de 5,6 × 10⁻¹⁷), loin sous le centième que la pagination distingue.
const BRUIT = 1e-9;

const hauteurValide = (valeur) => typeof valeur === 'number' && Number.isFinite(valeur) && valeur >= 0;

/**
 * Les pages d'une liste : chacune porte l'en-tête, puis les lignes de debut
 * (compris) à fin (exclu), autant qu'il en tient — en-tête et lignes de
 * somme au plus hauteurUtile. Les lignes se suivent dans l'ordre reçu,
 * chacune sur une page et une seule. Une ligne plus haute que ce que
 * l'en-tête laisse d'une page est seule sur la sienne, et seule à porter
 * seule vrai. Une liste vide donne une page, son en-tête seul.
 *
 * @param {number[]} hauteurs   une par ligne, finies, ≥ 0
 * @param {{hauteurUtile: number, hauteurEntete: number}} page
 * @returns {Array<{debut: number, fin: number, seule: boolean}>}
 * @throws {TypeError} des hauteurs qui ne sont pas une liste
 * @throws {RangeError} une hauteur hors du domaine ; une hauteur utile ≤ 0 ;
 *         un en-tête négatif, ou qui ne laisse aucune place
 */
export function paginer(hauteurs, { hauteurUtile, hauteurEntete }) {
  if (!Array.isArray(hauteurs)) throw new TypeError('paginer : une liste de hauteurs attendue');
  hauteurs.forEach((hauteur, rang) => {
    if (!hauteurValide(hauteur)) throw new RangeError(`paginer : hauteur ${rang} hors du domaine, reçu ${String(hauteur)}`);
  });
  if (!hauteurValide(hauteurUtile) || hauteurUtile === 0) {
    throw new RangeError(`paginer : hauteur utile > 0 attendue, reçu ${String(hauteurUtile)}`);
  }
  if (!hauteurValide(hauteurEntete) || hauteurEntete >= hauteurUtile) {
    throw new RangeError(`paginer : en-tête de ${String(hauteurEntete)} sur une hauteur utile de ${hauteurUtile}`);
  }
  const plafond = hauteurUtile + BRUIT;
  const pages = [];
  let debut = 0;
  do {
    let fin = debut;
    let somme = hauteurEntete;
    while (fin < hauteurs.length && somme + hauteurs[fin] <= plafond) {
      somme += hauteurs[fin];
      fin += 1;
    }
    const seule = fin === debut && fin < hauteurs.length;
    if (seule) fin += 1;
    pages.push({ debut, fin, seule });
    debut = fin;
  } while (debut < hauteurs.length);
  return pages;
}

/**
 * Les pages de plusieurs listes bout à bout — une feuille par table, ou par
 * table et par tour — : chaque liste commence une page et se pagine sous
 * son propre en-tête (paginer). rang numérote les pages du document, de 0 ;
 * feuille est l'indice de la liste.
 *
 * @param {Array<{entete: number, lignes: number[]}>} feuilles
 * @param {number} hauteurUtile
 * @returns {Array<{rang: number, feuille: number, debut: number, fin: number, seule: boolean}>}
 */
export function paginerFeuilles(feuilles, hauteurUtile) {
  const pages = [];
  feuilles.forEach(({ entete, lignes }, feuille) => {
    for (const page of paginer(lignes, { hauteurUtile, hauteurEntete: entete })) {
      pages.push({ rang: pages.length, feuille, ...page });
    }
  });
  return pages;
}

/**
 * Ce que la pagination reçoit, lu sur une zone de contenu rendue : sa
 * hauteur, la hauteur utile ; et pour chaque liste [data-liste-imprimee],
 * dans l'ordre du document, son en-tête — du haut de la liste au haut de
 * son corps de tableau : titre et têtes de colonnes — et la hauteur de
 * chaque ligne de ce corps. Les mesures sont en px CSS, celles de la boîte
 * rendue.
 *
 * @param {Element} contenu   la zone [data-contenu] d'une feuille
 * @returns {{utile: number, feuilles: Array<{entete: number, lignes: number[]}>}}
 */
export function mesurerListes(contenu) {
  const feuilles = [...contenu.querySelectorAll('[data-liste-imprimee]')].map((liste) => {
    const corps = liste.querySelector('tbody');
    return {
      entete: corps.getBoundingClientRect().top - liste.getBoundingClientRect().top,
      lignes: [...corps.rows].map((ligne) => ligne.getBoundingClientRect().height),
    };
  });
  return { utile: contenu.getBoundingClientRect().height, feuilles };
}

// Ce qu'une colonne de tour reçoit au-delà de la largeur mesurée de sa
// sonde, en px : les largeurs en pour cent s'arrondissent à l'unité de
// mise en page, et une colonne plus étroite d'une fraction de pixel que son
// texte le replie.
const ARRONDI_PX = 1;

/**
 * La part de la largeur d'une liste que prend sa sonde, en pour cent : la
 * largeur rendue de la sonde, plus ARRONDI_PX, sur celle du tableau. La
 * sonde est un tableau d'une colonne, à la largeur de son contenu, qui
 * porte dans les cellules de la liste ce qu'une colonne de tour doit tenir :
 * sur une ligne, chaque libellé de place et chaque tête de tour de la liste
 * d'accueil (largeursColonnes) ; le plus long mot de chaque cellule et de
 * chaque tête de tour d'une feuille par table (toursParGroupe).
 *
 * @param {Element} sonde
 * @param {Element} tableau   le tableau de la liste, à sa largeur d'impression
 * @returns {number}
 * @throws {RangeError} un tableau sans largeur
 */
export function mesurerPlace(sonde, tableau) {
  const largeur = tableau.getBoundingClientRect().width;
  if (!(largeur > 0)) throw new RangeError(`mesurerPlace : tableau de largeur ${String(largeur)}`);
  return (100 * (sonde.getBoundingClientRect().width + ARRONDI_PX)) / largeur;
}
