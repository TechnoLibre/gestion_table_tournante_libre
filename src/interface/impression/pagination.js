// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La pagination des listes imprimées (§ 11.7) : la liste d'accueil et la
// feuille par table ne tronquent jamais, elles replient (§ 7.4) ; la hauteur
// d'une ligne dépend donc de son texte, et se mesure au rendu. Ce module
// range des hauteurs mesurées en pages, sans DOM, dans une seule unité au
// choix de l'appelant — px CSS pour les vues. Chaque page répète l'en-tête
// de sa liste. mesurerListes lit, sur une feuille rendue hors de la vue, ce
// que la pagination reçoit.
//
// tientEnCopie essaie, sur une copie d'une liste rendue, la taille du texte
// d'une feuille par table (echelleAjustee, listes.js).
//
// Une ligne plus haute qu'une page ne se coupe pas au bord de la page : son
// texte se partage en morceaux qui tiennent chacun sur une page sous
// l'en-tête (couperTexte), coupés au début d'un mot, et chaque morceau
// prend une page à la suite (morcelerPages). couperLigne essaie les
// morceaux sur une copie de la ligne rendue, hors de la vue ; trancher dit
// ce que chaque texte de la ligne garde dans un morceau.

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

// Les débuts de caractère où un mot peut se couper : un point de code —
// jamais entre les deux unités UTF-16 d'un caractère hors du plan de base —
// qui n'est ni une marque combinante (sélecteurs de variante compris) ni un
// liant sans chasse (U+200D), et ne suit pas un liant. Une coupe ne sépare
// donc ni une lettre de son accent, ni les éléments d'une suite liée. L'expression ne
// dépend pas de la langue du système, que l'interface ne lit pas.
const DEBUT_DE_CARACTERE = /(?<!\u{200D})[^\p{M}\u{200D}]/gu;

// Les débuts de mot : un caractère qui n'est pas un blanc sécable et suit
// un blanc sécable — espace, tabulation, saut de ligne. Les insécables
// U+00A0 et U+202F, que l'écran pose devant « : » ou « ? » et après « « »
// (§ 14.6), lient leurs voisins : un morceau ne finit pas sur elles, et un
// signe ne commence une page que si son mot ne tient pas seul sur elle.
const DEBUT_DE_MOT = /(?<=[ \t\n\r])[^ \t\n\r]/gu;

const sontDesTextes = (textes) => Array.isArray(textes) && textes.every((texte) => typeof texte === 'string');

/**
 * Ce que chaque texte garde entre deux positions de leur suite mise bout à
 * bout, en unités UTF-16 : la part de chacun qui tombe dans [debut, fin), le
 * texte vide pour un texte qui n'y tombe pas.
 *
 * @param {string[]} textes
 * @param {number} debut   entier, de 0 à fin
 * @param {number} fin     entier, de debut à la longueur totale
 * @returns {string[]}   un par texte reçu
 * @throws {TypeError} des textes qui ne sont pas une liste de chaînes
 * @throws {RangeError} des positions hors du texte, ou dans le désordre
 */
export function trancher(textes, debut, fin) {
  if (!sontDesTextes(textes)) throw new TypeError('trancher : une liste de textes attendue');
  const total = textes.reduce((somme, texte) => somme + texte.length, 0);
  if (!Number.isSafeInteger(debut) || !Number.isSafeInteger(fin) || debut < 0 || fin < debut || fin > total) {
    throw new RangeError(`trancher : [${String(debut)}, ${String(fin)}) hors de [0, ${total}]`);
  }
  let origine = 0;
  return textes.map((texte) => {
    const part = texte.slice(Math.max(0, debut - origine), Math.max(0, fin - origine));
    origine += texte.length;
    return part;
  });
}

// Les positions où un morceau peut finir, croissantes, dans ]0, total[ :
// mots, le début de chaque texte et de chaque mot ; caracteres, en plus,
// chaque début de caractère (DEBUT_DE_CARACTERE).
function coupesPossibles(textes) {
  const mots = new Set();
  const caracteres = new Set();
  let origine = 0;
  for (const texte of textes) {
    mots.add(origine);
    caracteres.add(origine);
    for (const { index } of texte.matchAll(DEBUT_DE_MOT)) mots.add(origine + index);
    for (const { index } of texte.matchAll(DEBUT_DE_CARACTERE)) caracteres.add(origine + index);
    origine += texte.length;
  }
  const croissantes = (positions) => [...positions].filter((p) => p > 0 && p < origine).sort((a, b) => a - b);
  return { mots: croissantes(mots), caracteres: croissantes(caracteres), total: origine };
}

// La plus grande des positions (croissantes) de ]debut, borne[ où le
// morceau [debut, position) tient encore, par dichotomie — tient croît
// avec le morceau ; null quand aucune ne tient.
function plusGrandeQuiTient(positions, debut, borne, tient) {
  const candidates = positions.filter((p) => p > debut && p < borne);
  let bas = 0;
  let haut = candidates.length;
  while (bas < haut) {
    const milieu = (bas + haut) >> 1;
    if (tient(debut, candidates[milieu])) bas = milieu + 1;
    else haut = milieu;
  }
  return bas === 0 ? null : candidates[bas - 1];
}

/**
 * Les bornes des morceaux d'un texte trop haut pour une page, ses textes mis
 * bout à bout : [0, c₁, …, total], chaque morceau [cᵢ, cᵢ₊₁) le plus long
 * qui tient (tient), à partir de la fin du précédent. Un morceau finit au
 * début d'un mot ou d'un texte ; un mot qui ne tient pas seul se coupe au
 * dernier début de caractère qui tient (DEBUT_DE_CARACTERE), et le morceau
 * suivant reprend aux mots. Quand rien ne tient, un morceau prend un
 * caractère : le texte avance toujours. Un texte vide donne [0, 0].
 *
 * La recherche est dichotomique : tient doit croître avec le morceau — un
 * morceau qui tient, raccourci par la fin, tient encore.
 *
 * @param {string[]} textes
 * @param {(debut: number, fin: number) => boolean} tient
 * @returns {number[]}
 * @throws {TypeError} des textes qui ne sont pas une liste de chaînes, un
 *         prédicat qui n'est pas une fonction
 */
export function couperTexte(textes, tient) {
  if (!sontDesTextes(textes)) throw new TypeError('couperTexte : une liste de textes attendue');
  if (typeof tient !== 'function') throw new TypeError('couperTexte : un prédicat tient attendu');
  const { mots, caracteres, total } = coupesPossibles(textes);
  const bornes = [0];
  let debut = 0;
  while (debut < total) {
    let fin = total;
    if (!tient(debut, total)) {
      // Le premier mot qui suit borne le repli aux caractères : au-delà,
      // un morceau finirait dans un mot que l'on pouvait garder entier.
      const motSuivant = mots.find((p) => p > debut) ?? total;
      fin =
        plusGrandeQuiTient(mots, debut, total, tient) ??
        plusGrandeQuiTient(caracteres, debut, motSuivant, tient) ??
        caracteres.find((p) => p > debut) ??
        total;
    }
    bornes.push(fin);
    debut = fin;
  }
  if (total === 0) bornes.push(0);
  return bornes;
}

/**
 * Les pages d'un document dont les lignes seules sont continuées : chaque
 * page seule (paginerFeuilles) dont la ligne a des bornes à plus d'un
 * morceau (couperTexte) devient une page par morceau, sous la même ligne,
 * morceau {debut, fin} ; toute autre page reste telle, morceau null. rang
 * renumérote les pages du document, de 0.
 *
 * @param {Array<{rang: number, feuille: number, debut: number, fin: number, seule: boolean}>} pages
 * @param {Array<{feuille: number, ligne: number, bornes: number[]}>} coupures
 * @returns {Array<{rang: number, feuille: number, debut: number, fin: number, seule: boolean,
 *            morceau: {debut: number, fin: number}|null}>}
 * @throws {RangeError} des bornes qui ne partent pas de 0 ou ne croissent pas strictement
 */
export function morcelerPages(pages, coupures) {
  const resultat = [];
  for (const page of pages) {
    const coupure = page.seule ? coupures.find(({ feuille, ligne }) => feuille === page.feuille && ligne === page.debut) : undefined;
    const bornes = coupure?.bornes;
    if (bornes !== undefined) {
      const croissantes = bornes.every((borne, rang) => Number.isSafeInteger(borne) && (rang === 0 ? borne === 0 : borne > bornes[rang - 1]));
      if (bornes.length < 2 || !croissantes) throw new RangeError(`morcelerPages : bornes ${JSON.stringify(bornes)}`);
    }
    if (bornes === undefined || bornes.length === 2) {
      resultat.push({ ...page, rang: resultat.length, morceau: null });
      continue;
    }
    for (let rang = 1; rang < bornes.length; rang += 1) {
      resultat.push({ ...page, rang: resultat.length, morceau: { debut: bornes[rang - 1], fin: bornes[rang] } });
    }
  }
  return resultat;
}

/**
 * Les bornes des morceaux d'une ligne plus haute qu'une page (couperTexte),
 * lues sur le rendu : la ligne rendue dans sa liste, hors de la vue. Ses
 * textes sont les nœuds de texte non blancs de ses cellules de données
 * (td), dans l'ordre du document : une ligne de plusieurs cellules se
 * continue cellule après cellule, et une page porte de chacune la part qui
 * tombe dans son morceau (trancher). Les en-têtes de rangée (th) restent
 * entiers sur chaque page. Un morceau tient quand une copie de la ligne, ses
 * textes réduits à ce morceau, dans une copie du tableau à ses colonnes,
 * mesure au plus hauteur ; la copie se retire avant le retour.
 *
 * @param {HTMLTableRowElement} ligne
 * @param {number} hauteur   en px CSS, ce que l'en-tête laisse d'une page
 * @returns {number[]}
 */
export function couperLigne(ligne, hauteur) {
  const tableau = ligne.closest('table');
  const essai = tableau.cloneNode(false);
  for (const colonnes of tableau.querySelectorAll(':scope > colgroup')) essai.append(colonnes.cloneNode(true));
  const corps = document.createElement('tbody');
  const copie = ligne.cloneNode(true);
  corps.append(copie);
  essai.append(corps);
  // Les nœuds de texte non blancs des cellules de données d'une rangée,
  // dans l'ordre du document.
  const noeuds = (rangee) => {
    const lus = [];
    for (const cellule of rangee.cells) {
      if (cellule.tagName !== 'TD') continue;
      const parcours = document.createTreeWalker(cellule, NodeFilter.SHOW_TEXT);
      for (let noeud = parcours.nextNode(); noeud !== null; noeud = parcours.nextNode()) if (noeud.data.trim() !== '') lus.push(noeud);
    }
    return lus;
  };
  const textes = noeuds(ligne).map((noeud) => noeud.data);
  const copies = noeuds(copie);
  tableau.after(essai);
  try {
    return couperTexte(textes, (debut, fin) => {
      trancher(textes, debut, fin).forEach((part, rang) => {
        copies[rang].data = part;
      });
      return copie.getBoundingClientRect().height <= hauteur + BRUIT;
    });
  } finally {
    essai.remove();
  }
}

/**
 * Vrai quand une liste rendue [data-liste-imprimee] tient dans hauteur une
 * fois préparée : une copie de la liste, posée à côté d'elle — même
 * largeur, mêmes colonnes —, reçoit ce que preparer y change — la taille
 * de son texte —, et sa hauteur, du haut de la liste au bas de son corps de
 * tableau — l'en-tête et ses lignes, comme paginer les somme —, ne passe
 * pas hauteur. La copie se retire avant le retour.
 *
 * @param {Element} liste
 * @param {number} hauteur   en px CSS, la hauteur utile de la page
 * @param {(copie: Element) => void} preparer
 * @returns {boolean}
 */
export function tientEnCopie(liste, hauteur, preparer) {
  const copie = liste.cloneNode(true);
  preparer(copie);
  liste.after(copie);
  try {
    const bas = copie.querySelector('tbody').getBoundingClientRect().bottom;
    return bas - copie.getBoundingClientRect().top <= hauteur + BRUIT;
  } finally {
    copie.remove();
  }
}
