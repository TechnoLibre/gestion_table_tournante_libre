// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La mise en page d'un badge (§ 11.4, § 11.5) : où tombe chaque ligne de
// texte dans le cadre utile, à quel corps, en quelle graisse. Module pur :
// toute mesure de texte passe par les métriques reçues, celles de la police
// embarquée lues par pdf-lib (metriquesDe) ou celles d'une épreuve ; aucune
// cote de glyphe n'y est posée. Les cotes sont en millimètres, l'origine au
// coin haut gauche du cadre utile, y sur la ligne de base ; les corps en
// points.
//
// La page est un flux. En haut, le nom en gras, puis l'appartenance, puis
// les lignes de tour ; en bas, le pied, sa dernière ligne posée sur le bord
// du cadre. Chaque ligne occupe la hauteur que la police lui donne, de
// l'ascendante à la descendante : deux lignes empilées ne se recouvrent
// jamais, et une ligne absente laisse sa place à la suivante.
//
// Le nom se choisit d'abord, sur la seule largeur : il passe avant tout le
// reste (§ 11.4, rang 1). Pour chaque forme du nom, de la plus grande au
// plancher, les tours essaient leurs dispositions, une colonne du corps des
// tours au plancher, puis deux colonnes ; la première qui tient l'emporte.
// Le nom au plancher, le badge se dépouille dans l'ordre de sacrifice
// (décision 8). Retirer un texte ne vient qu'après avoir réduit tout ce qui
// se réduit.
import { constante } from '../geometrie/constantes.js';
import { BADGE } from '../geometrie/papiers.js';
import { cadreUtile } from './imposition.js';

/** Le point typographique en millimètres. */
const MM_PAR_PT = 25.4 / 72;

/** La marque d'abrègement d'une appartenance ou d'un titre. */
const MARQUE = '\u{2026}';

/** Le séparateur que les libellés d'une ligne de tour posent devant la
 *  place, puis devant le titre : « Tour 2 — table 5, siège 3 — titre ». */
const SEPARATEUR = ' \u{2014} ';

/** La tolérance d'une comparaison de cotes, en millimètres : une somme de
 *  hauteurs égale à la hauteur utile tient, malgré l'arrondi flottant. */
const TOLERANCE_MM = 1e-9;

// Une grappe : un point de code suivi de ses marques combinantes. Une coupe
// entre deux grappes ne sépare jamais une lettre de son accent ; une marque
// en tête de texte forme sa propre grappe.
const GRAPPE = /\P{M}\p{M}*|\p{M}+/gu;

/**
 * Les mesures de texte dont la mise en page a besoin, en millimètres.
 *
 * @typedef {Object} Metriques
 * @property {(texte: string, corps: number, gras: boolean) => number} largeur
 * @property {(corps: number) => {ascendante: number, descendante: number, capitale: number}} hauteurs
 *           proportionnelles au corps ; la descendante est positive
 * @property {(texte: string) => string[]} absents   les caractères sans
 *           glyphe, une fois chacun, dans l'ordre de première rencontre
 */

// La police fontkit qu'une PDFFont de pdf-lib porte, quand elle a été
// embarquée d'un fichier par fontkit ; TypeError sinon (police standard,
// valeur quelconque).
function fonteDe(police, graisse) {
  const fonte = police?.embedder?.font;
  if (typeof fonte?.hasGlyphForCodePoint !== 'function' || !Number.isFinite(fonte?.unitsPerEm)) {
    throw new TypeError(`metriquesDe : police ${graisse} embarquée par fontkit attendue`);
  }
  return fonte;
}

/**
 * Les métriques des deux graisses de la police embarquée. La largeur est
 * celle que pdf-lib dessine (widthOfTextAtSize : les avances des glyphes
 * après substitution des ligatures). Les hauteurs viennent de la table de
 * la police, la plus grande des deux graisses pour chacune : une ligne
 * réservée à leur hauteur contient l'une comme l'autre. Un caractère est
 * absent quand l'une des deux graisses n'a pas son glyphe.
 *
 * @param {{regulier: import('pdf-lib').PDFFont, gras: import('pdf-lib').PDFFont}} polices
 * @returns {Metriques}
 * @throws {TypeError} une police qui n'a pas été embarquée par fontkit
 */
export function metriquesDe({ regulier, gras }) {
  const fontes = [fonteDe(regulier, 'regulier'), fonteDe(gras, 'gras')];
  const rapport = (lire) => Math.max(...fontes.map((f) => lire(f) / f.unitsPerEm));
  const ascendante = rapport((f) => f.ascent);
  const descendante = rapport((f) => -f.descent);
  const capitale = rapport((f) => f.capHeight);
  // La largeur d'un texte au corps 1000, par graisse : pdf-lib la rend
  // proportionnelle au corps (somme des avances × corps / 1000), et la mise en
  // page mesure le même texte à chaque palier. Une mise en forme par fontkit
  // par texte suffit ; le produit par corps / 1000 refait l'opération de
  // pdf-lib à l'identique.
  const avances = [new Map(), new Map()];
  const largeurMille = (texte, enGras) => {
    const memoire = avances[enGras ? 1 : 0];
    let mille = memoire.get(texte);
    if (mille === undefined) {
      mille = (enGras ? gras : regulier).widthOfTextAtSize(texte, 1000);
      memoire.set(texte, mille);
    }
    return mille;
  };
  return {
    largeur: (texte, corps, enGras) => largeurMille(texte, enGras) * (corps / 1000) * MM_PAR_PT,
    hauteurs: (corps) => ({
      ascendante: ascendante * corps * MM_PAR_PT,
      descendante: descendante * corps * MM_PAR_PT,
      capitale: capitale * corps * MM_PAR_PT,
    }),
    absents: (texte) => {
      const vus = new Set();
      const absents = [];
      for (const caractere of texte) {
        if (vus.has(caractere)) continue;
        vus.add(caractere);
        const point = caractere.codePointAt(0);
        if (!fontes.every((f) => f.hasGlyphForCodePoint(point))) absents.push(caractere);
      }
      return absents;
    },
  };
}

// Les corps d'une réduction par paliers d'un point, du départ au plancher,
// le plancher compris même quand l'écart n'est pas un nombre entier de
// points. Un départ sous le plancher ne garde que le plancher.
function paliers(depart, plancher) {
  const corps = [];
  for (let c = depart; c > plancher + TOLERANCE_MM; c -= 1) corps.push(c);
  corps.push(plancher);
  return corps;
}

/**
 * La mise en page d'un badge, ou le refus qui dit pourquoi il ne tient pas.
 *
 * Nom : le corps de départ donne au nom la hauteur de capitale maximale du
 * registre, et descend d'un point par palier jusqu'au plancher, dont la
 * capitale vaut le plancher du registre ; les deux se convertissent par la
 * capitale que les métriques donnent. Le nom tient d'abord sur une ligne,
 * puis sur deux, puis sur trois, chaque fois au plus grand corps possible,
 * coupé aux espaces ; à défaut seulement, coupé entre deux grappes, de deux
 * à trois lignes. Quand le reste du badge ne tient pas sous ce nom, il
 * descend d'un palier à la fois jusqu'au plancher, au même nombre de lignes
 * au plus. Au plancher, ou au-delà de trois lignes, où il se replie au
 * plancher sur autant de lignes qu'il lui faut, le badge perd le nom de
 * l'événement (le pied devient le pied réduit), puis, s'il ne tient
 * toujours pas, l'appartenance. Le nom ne s'abrège jamais.
 *
 * Appartenance : une ligne, abrégée par « … » au plus long préfixe qui
 * tient. Pied : chaque ligne se replie comme le nom, rien ne s'y abrège.
 *
 * Tours : une colonne, du corps des tours à leur plancher, puis deux
 * colonnes, la première rangée de haut en bas d'abord, séparées d'un
 * cadratin. Chaque ligne est entière, sauf au plancher : une ligne trop
 * large pour sa colonne y abrège son titre, jamais sa place ; une ligne sans
 * titre trop large ne se pose pas. Aucun corps ne dépasse celui du nom.
 *
 * Refus : PLANCHE_NOM_TROP_LONG quand le nom dépasse trois lignes et que
 * rien ne tient, PLANCHE_TROP_DE_TOURS {tours} sinon, tours étant le nombre
 * de lignes de tour. src/pdf ne connaît pas la personne : l'appelant
 * complète les détails.
 *
 * @param {{nom: string, lignes: string[], appartenance: string|null,
 *          pied: string[], piedReduit: string[]}} textes
 * @param {Metriques} metriques
 * @returns {{blocs: Array<{texte: string, corps: number, gras: boolean, x: number, y: number}>,
 *            colonnesTours: 1|2}
 *          | {refus: {code: string, details: object}}}
 */
export function mettreEnPage(textes, metriques) {
  const { largeur: L, hauteur: H } = cadreUtile({ x: 0, y: 0, largeur: BADGE.largeur, hauteur: BADGE.hauteur });
  const memoire = new Map();
  const largeur = (texte, corps, gras) => {
    const cle = `${gras ? 'g' : 'r'}${corps}\u{0}${texte}`;
    if (!memoire.has(cle)) memoire.set(cle, metriques.largeur(texte, corps, gras));
    return memoire.get(cle);
  };
  const tient = (texte, corps, gras, largeurMax = L) => largeur(texte, corps, gras) <= largeurMax + TOLERANCE_MM;
  const pas = (corps) => {
    const { ascendante, descendante } = metriques.hauteurs(corps);
    return { ascendante, descendante, hauteur: ascendante + descendante };
  };

  // Les lignes du texte repliées dans la largeur, au plus `limite` ; null
  // quand il en faut davantage, ou qu'une grappe seule déborde. Un mot qui
  // ne tient pas seul sur une ligne se coupe entre deux grappes, sauf sous
  // `motsEntiers`, où le repli échoue.
  function replier(texte, corps, gras, limite, motsEntiers = false) {
    const lignes = [];
    let courante = '';
    const clore = () => {
      lignes.push(courante);
      courante = '';
      return lignes.length <= limite;
    };
    for (const mot of texte.split(' ')) {
      if (mot === '') continue;
      const avecMot = courante === '' ? mot : `${courante} ${mot}`;
      if (tient(avecMot, corps, gras)) {
        courante = avecMot;
        continue;
      }
      if (courante !== '' && !clore()) return null;
      if (tient(mot, corps, gras)) {
        courante = mot;
        continue;
      }
      if (motsEntiers) return null;
      for (const grappe of mot.match(GRAPPE)) {
        const avecGrappe = courante + grappe;
        if (courante === '' || tient(avecGrappe, corps, gras)) {
          courante = avecGrappe;
        } else if (!clore()) {
          return null;
        } else {
          courante = grappe;
        }
        if (!tient(courante, corps, gras)) return null;
      }
    }
    if (courante !== '' && !clore()) return null;
    return lignes;
  }

  // Le texte entier s'il tient, sinon son plus long préfixe, espaces finales
  // retirées, suivi de la marque ; null si la marque seule déborde. Les
  // avances sont positives ou nulles : la largeur d'un préfixe croît avec
  // son nombre de grappes, une dichotomie trouve le plus long qui tient seul,
  // et aucun préfixe plus long ne tient avec la marque. De là, le premier qui
  // tient avec elle, en descendant.
  function abreger(texte, corps, gras, largeurMax) {
    if (tient(texte, corps, gras, largeurMax)) return texte;
    const grappes = texte.match(GRAPPE);
    const prefixe = (nombre) => grappes.slice(0, nombre).join('');
    // Le préfixe vide tient, le texte entier non.
    let bas = 0;
    let haut = grappes.length - 1;
    while (bas < haut) {
      const milieu = Math.ceil((bas + haut) / 2);
      if (tient(prefixe(milieu), corps, gras, largeurMax)) bas = milieu;
      else haut = milieu - 1;
    }
    for (let nombre = bas; nombre > 0; nombre -= 1) {
      const candidat = `${prefixe(nombre).replace(/ +$/u, '')}${MARQUE}`;
      if (tient(candidat, corps, gras, largeurMax)) return candidat;
    }
    return tient(MARQUE, corps, gras, largeurMax) ? MARQUE : null;
  }

  // Une ligne de tour dans la largeur : entière si elle tient ; sinon
  // abrégée dans son titre, qui suit le second séparateur, sa place (tour,
  // table, siège) gardée entière et au moins une grappe du titre ; null pour
  // une ligne sans titre, ou dont la place et une grappe, suivies de la
  // marque, débordent. Le plus long préfixe qu'abreger rend ne couvre pas
  // la place : aucun autre ne la couvre.
  function abregerTitre(ligne, corps, largeurMax) {
    if (tient(ligne, corps, false, largeurMax)) return ligne;
    const premier = ligne.indexOf(SEPARATEUR);
    const finDeLaPlace = premier < 0 ? -1 : ligne.indexOf(SEPARATEUR, premier + SEPARATEUR.length);
    if (finDeLaPlace < 0) return null;
    const abregee = abreger(ligne, corps, false, largeurMax);
    // Au moins une grappe du titre reste : la place suivie du seul séparateur
    // et de la marque se lirait comme une place abrégée.
    const titreGarde = abregee !== null && abregee.length - MARQUE.length > finDeLaPlace + SEPARATEUR.trimEnd().length;
    return titreGarde ? abregee : null;
  }

  // Les formes du nom, dans l'ordre où le badge les essaie, chacune
  // {corps, lignes}. La première est la plus grande qui tient en largeur :
  // de une à trois lignes, du corps maximal au plancher, coupées aux
  // espaces ; à défaut seulement, coupées entre deux grappes. Suivent les
  // corps plus petits jusqu'au plancher, au même nombre de lignes au plus,
  // qui libèrent de la hauteur. Au-delà de trois lignes, une forme seule :
  // le plancher, sur autant de lignes qu'il en faut, bornées par ce que la
  // hauteur utile empile.
  const capitaleParPt = metriques.hauteurs(1).capitale;
  const corpsNomMax = constante('HAUTEUR_CAPITALE_NOM_MAX_MM') / capitaleParPt;
  const corpsNomPlancher = constante('HAUTEUR_CAPITALE_NOM_PLANCHER_MM') / capitaleParPt;
  const paliersNom = paliers(corpsNomMax, corpsNomPlancher);
  function choisirNom() {
    for (const motsEntiers of [true, false]) {
      for (let nombre = 1; nombre <= 3; nombre += 1) {
        const premier = paliersNom.findIndex((corps) => replier(textes.nom, corps, true, nombre, motsEntiers) !== null);
        if (premier < 0) continue;
        const formes = [];
        for (const corps of paliersNom.slice(premier)) {
          const lignes = replier(textes.nom, corps, true, nombre, motsEntiers);
          if (lignes !== null) formes.push({ corps, lignes });
        }
        return { formes, auDela: false };
      }
    }
    const empilables = Math.floor((H + TOLERANCE_MM) / pas(corpsNomPlancher).hauteur);
    const lignes =
      replier(textes.nom, corpsNomPlancher, true, empilables, true) ??
      replier(textes.nom, corpsNomPlancher, true, empilables, false);
    return lignes === null ? null : { formes: [{ corps: corpsNomPlancher, lignes }], auDela: true };
  }
  const refusNom = { refus: { code: 'PLANCHE_NOM_TROP_LONG', details: {} } };
  const nom = choisirNom();
  if (nom === null) return refusNom;

  const piedReplie = (lignes, corps) => {
    const resultat = [];
    for (const ligne of lignes) {
      const repliee = replier(ligne, corps, false, Infinity);
      if (repliee === null) return null;
      resultat.push(...repliee);
    }
    return resultat;
  };
  const centre = (texte, corps, gras) => (L - largeur(texte, corps, gras)) / 2;

  // Le badge sous une forme du nom, avec ou sans le nom de l'événement et
  // l'appartenance ; null quand aucune disposition des tours n'y tient.
  function composer(forme, { evenement, avecAppartenance }) {
    const auPlusNom = (corps) => Math.min(corps, forme.corps);
    const corpsAppartenance = auPlusNom(constante('CORPS_APPARTENANCE_PT'));
    const corpsPied = auPlusNom(constante('CORPS_PIED_PT'));
    const corpsTours = paliers(auPlusNom(constante('CORPS_TOURS_PT')), auPlusNom(constante('CORPS_TOURS_PLANCHER_PT')));
    const plancherTours = corpsTours.at(-1);

    const appartenance =
      !avecAppartenance || textes.appartenance === null || textes.appartenance.trim() === ''
        ? null
        : abreger(textes.appartenance, corpsAppartenance, false, L);
    const pied = piedReplie(evenement ? textes.pied : textes.piedReduit, corpsPied);
    if (pied === null) return null;

    // Les lignes de tour d'une disposition, avec leur abscisse et leur rang ;
    // null quand l'une ne tient pas dans sa colonne.
    function disposerTours({ colonnes, corps }) {
      const poser = (ligne, largeurMax) =>
        corps === plancherTours ? abregerTitre(ligne, corps, largeurMax) : tient(ligne, corps, false, largeurMax) ? ligne : null;
      const poserColonne = (colonne, largeurMax) => {
        const posees = colonne.map((ligne) => poser(ligne, largeurMax));
        return posees.includes(null) ? null : posees;
      };
      const largeurColonne = (colonne) => Math.max(0, ...colonne.map((t) => largeur(t, corps, false)));
      const lignes = textes.lignes;
      if (colonnes === 1) {
        const posees = poserColonne(lignes, L);
        if (posees === null) return null;
        const x = (L - largeurColonne(posees)) / 2;
        return { lignes: posees.map((texte, rang) => ({ texte, x, rang })) };
      }
      // La colonne de gauche reçoit ce que la droite, entière, lui laisse, et
      // jamais moins d'une demi-colonne ; la droite, ce que la gauche posée
      // lui laisse. Les deux tiennent ensemble par construction, et des
      // lignes entières qui tiennent ensemble passent telles quelles.
      const rangees = Math.ceil(lignes.length / 2);
      const gouttiere = corps * MM_PAR_PT;
      const demi = (L - gouttiere) / 2;
      const droiteEntiere = lignes.slice(rangees);
      const gauche = poserColonne(lignes.slice(0, rangees), L - gouttiere - Math.min(largeurColonne(droiteEntiere), demi));
      if (gauche === null) return null;
      const droite = poserColonne(droiteEntiere, L - gouttiere - largeurColonne(gauche));
      if (droite === null) return null;
      const x = (L - (largeurColonne(gauche) + gouttiere + largeurColonne(droite))) / 2;
      const xDroite = x + largeurColonne(gauche) + gouttiere;
      return {
        lignes: [
          ...gauche.map((texte, rang) => ({ texte, x, rang })),
          ...droite.map((texte, rang) => ({ texte, x: xDroite, rang })),
        ],
      };
    }

    const pasPied = pas(corpsPied);
    const hautDuPied = H - pied.length * pasPied.hauteur;
    // Le flux du haut, jusqu'aux tours.
    const blocs = [];
    let curseur = 0;
    const pasNom = pas(forme.corps);
    for (const texte of forme.lignes) {
      const y = curseur + pasNom.ascendante;
      blocs.push({ texte, corps: forme.corps, gras: true, x: centre(texte, forme.corps, true), y });
      curseur = y + pasNom.descendante;
    }
    if (appartenance !== null) {
      const pasAppartenance = pas(corpsAppartenance);
      const y = curseur + pasAppartenance.ascendante;
      blocs.push({ texte: appartenance, corps: corpsAppartenance, gras: false, x: centre(appartenance, corpsAppartenance, false), y });
      curseur = y + pasAppartenance.descendante;
    }
    // Les dispositions des tours, dans l'ordre de préférence : une colonne
    // du corps des tours au plancher, puis deux.
    const dispositions = [
      ...corpsTours.map((corps) => ({ colonnes: 1, corps })),
      ...corpsTours.map((corps) => ({ colonnes: 2, corps })),
    ];
    for (const disposition of dispositions) {
      const pasTours = pas(disposition.corps);
      if (curseur + Math.ceil(textes.lignes.length / disposition.colonnes) * pasTours.hauteur > hautDuPied + TOLERANCE_MM) {
        continue;
      }
      const tours = disposerTours(disposition);
      if (tours === null) continue;
      const blocsTours = tours.lignes.map(({ texte, x, rang }) => ({
        texte,
        corps: disposition.corps,
        gras: false,
        x,
        y: curseur + rang * pasTours.hauteur + pasTours.ascendante,
      }));
      const blocsPied = pied.map((texte, rang) => ({
        texte,
        corps: corpsPied,
        gras: false,
        x: centre(texte, corpsPied, false),
        y: hautDuPied + rang * pasPied.hauteur + pasPied.ascendante,
      }));
      return { blocs: [...blocs, ...blocsTours, ...blocsPied], colonnesTours: disposition.colonnes };
    }
    return null;
  }

  // Les essais, du badge complet au plus dépouillé : chaque forme du nom
  // avec le badge entier, puis le nom au plancher sans le nom de
  // l'événement, puis sans l'appartenance. Un nom au-delà de trois lignes a
  // déjà perdu le nom de l'événement.
  const plancherNom = nom.formes.at(-1);
  const essais = [
    ...(nom.auDela ? [] : nom.formes.map((forme) => ({ forme, evenement: true, avecAppartenance: true }))),
    { forme: plancherNom, evenement: false, avecAppartenance: true },
    { forme: plancherNom, evenement: false, avecAppartenance: false },
  ];
  for (const { forme, ...niveau } of essais) {
    const page = composer(forme, niveau);
    if (page !== null) return page;
  }
  if (nom.auDela) return refusNom;
  return { refus: { code: 'PLANCHE_TROP_DE_TOURS', details: { tours: textes.lignes.length } } };
}
