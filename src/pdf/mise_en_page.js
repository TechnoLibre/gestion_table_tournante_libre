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
// La page est un flux. En haut, le nom en gras, puis l'organisation, puis
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
//
// Chaque modèle de badge a son cadre utile (cadreUtile) et ses corps de
// départ, lus au registre des constantes (TYPOGRAPHIES) ; les planchers du
// nom et des tours sont ceux de la lisibilité, communs aux modèles.
//
// Le pied TechnoLibre, quand il est demandé, vient en dernier : un texte,
// puis le logo, sous le pied, le logo posé sur le bord du cadre ; un texte
// vide, ou fait d'espaces, ne pose que le logo. Il ne prend
// que la place que le badge entier laisse entre ses tours et son pied, et ne
// change rien à ce qui le précède : le badge se compose d'abord sans lui, le
// pied remonte ensuite de la hauteur du bloc. Il rapetisse de son corps de
// départ à son plancher, par paliers d'un point ; quand même le plancher ne
// tient pas, il se retire, et le badge est celui qu'il serait sans lui. Il
// se retire aussi d'un badge qui a perdu le nom de l'événement : il le suit
// dans l'ordre de sacrifice.
//
// Le logo du participant, quand il est demandé, passe avant le pied
// TechnoLibre et après tout le texte : il ne prend que l'écart entre les
// tours et le pied, moins un dégagement au-dessus et au-dessous
// (LOGO_PARTICIPANT_ECART_MM), le plus grand qui y tienne au rapport reçu,
// centré. Le pied TechnoLibre lui cède d'abord tout ce qui dépasse son
// plancher, puis reprend le plus grand palier que le logo laisse ; quand
// même ainsi la plus petite cote du logo n'atteint pas son plancher
// (LOGO_PARTICIPANT_PLANCHER_MM), le pied TechnoLibre se retire pour lui ;
// quand même seul le logo ne l'atteint pas, il ne se pose pas, et la page
// est celle du badge sans logo. Il se retire aussi d'un badge qui a perdu le
// nom de l'événement, comme le pied TechnoLibre.
import { constante } from '../geometrie/constantes.js';
import { MODELES_BADGE, estModeleBadge } from '../geometrie/papiers.js';
import { cadreUtile } from './imposition.js';

// Les noms au registre des corps de départ de chaque modèle : la capitale
// maximale du nom, les corps des tours, de l'organisation et du pied.
const TYPOGRAPHIES = Object.freeze({
  a6: Object.freeze({
    nomMax: 'HAUTEUR_CAPITALE_NOM_MAX_MM',
    tours: 'CORPS_TOURS_PT',
    organisation: 'CORPS_ORGANISATION_PT',
    pied: 'CORPS_PIED_PT',
  }),
  avery5392: Object.freeze({
    nomMax: 'HAUTEUR_CAPITALE_NOM_MAX_CARTE_MM',
    tours: 'CORPS_TOURS_CARTE_PT',
    organisation: 'CORPS_ORGANISATION_CARTE_PT',
    pied: 'CORPS_PIED_CARTE_PT',
  }),
});

/** Le point typographique en millimètres. */
const MM_PAR_PT = 25.4 / 72;

/** La marque d'abrègement d'une organisation ou d'un texte libre d'une
 *  ligne de tour. */
const MARQUE = '\u{2026}';

// La hauteur du logo du pied TechnoLibre, en cadratins du corps de son
// texte, commune aux modèles : une proportion du bloc, non un seuil de
// lisibilité. Le corps de départ du texte et son plancher, lisible à la
// loupe, sont au registre (CORPS_TECHNOLIBRE_PT, _PLANCHER_PT).
const LOGO_EN_CADRATINS = 2;

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

// Les textes libres de chaque ligne de tour, contrôlés : textes.abregeables,
// ou aucun pour chaque ligne quand il manque. Chaque ligne en a une liste de
// { debut, fin }, entiers, 0 ≤ debut < fin ≤ sa longueur, croissants et
// disjoints, un caractère au moins chacun ; TypeError sinon.
function morceauxLus({ lignes, abregeables }) {
  if (abregeables === undefined) return lignes.map(() => []);
  if (!Array.isArray(abregeables) || abregeables.length !== lignes.length) {
    throw new TypeError('mettreEnPage : abregeables, une liste par ligne de tour, attendus');
  }
  abregeables.forEach((morceaux, rang) => {
    let fin = 0;
    const bien =
      Array.isArray(morceaux) &&
      morceaux.every((morceau) => {
        const forme =
          Number.isSafeInteger(morceau?.debut) &&
          Number.isSafeInteger(morceau?.fin) &&
          morceau.debut >= fin &&
          morceau.debut < morceau.fin &&
          morceau.fin <= lignes[rang].length;
        fin = forme ? morceau.fin : fin;
        return forme;
      });
    if (!bien) throw new TypeError(`mettreEnPage : textes libres de la ligne ${rang + 1} mal désignés, reçu ${JSON.stringify(morceaux)}`);
  });
  return abregeables;
}

// Le pied TechnoLibre demandé, contrôlé : null, ou {texte, rapport}, un
// texte, vide admis, et le rapport largeur sur hauteur du logo, un nombre
// fini positif ; TypeError sinon.
function technolibreLu(technolibre) {
  if (technolibre === null) return null;
  const bien = typeof technolibre?.texte === 'string' && Number.isFinite(technolibre.rapport) && technolibre.rapport > 0;
  if (!bien) throw new TypeError(`mettreEnPage : pied TechnoLibre {texte, rapport} attendu, reçu ${JSON.stringify(technolibre)}`);
  return technolibre;
}

// Le logo du participant demandé, contrôlé : null, ou {rapport}, le rapport
// largeur sur hauteur de l'image, un nombre fini positif ; TypeError sinon.
function logoParticipantLu(logoParticipant) {
  if (logoParticipant === null) return null;
  if (!(Number.isFinite(logoParticipant?.rapport) && logoParticipant.rapport > 0)) {
    throw new TypeError(`mettreEnPage : logo du participant {rapport} attendu, reçu ${JSON.stringify(logoParticipant)}`);
  }
  return logoParticipant;
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
 * toujours pas, l'organisation. Le nom ne s'abrège jamais.
 *
 * Organisation : une ligne, abrégée par « … » au plus long préfixe qui
 * tient. Pied : chaque ligne se replie comme le nom, rien ne s'y abrège.
 *
 * Tours : une colonne, du corps des tours à leur plancher, puis deux
 * colonnes, la première rangée de haut en bas d'abord, séparées d'un
 * cadratin. Chaque ligne est entière, sauf au plancher : une ligne trop
 * large pour sa colonne y abrège ses textes libres — le libellé de la
 * table, puis le titre, ceux que textes.abregeables désigne —, chacun à son
 * plus long préfixe suivi de « … », une grappe au moins, le suivant ne
 * s'abrégeant que le précédent réduit à sa première grappe ; jamais le
 * reste de la ligne, tour, table et siège. Une ligne sans texte libre, ou
 * que même ses textes libres réduits ne font pas tenir, ne se pose pas.
 * Aucun corps ne dépasse celui du nom.
 *
 * Refus : PLANCHE_NOM_TROP_LONG quand le nom dépasse trois lignes et que
 * rien ne tient, PLANCHE_TROP_DE_TOURS {tours} sinon, tours étant le nombre
 * de lignes de tour. src/pdf ne connaît pas la personne : l'appelant
 * complète les détails.
 *
 * Le modèle de badge donne le cadre utile et les corps de départ : l'A6,
 * 89 × 132 mm ; la carte Avery 5392, 91,6 × 66,2 mm.
 *
 * Pied TechnoLibre : son texte, replié comme le pied, centré, puis le logo,
 * centré, de deux cadratins de haut, au rapport reçu, posé sur le bas du
 * cadre ; le pied remonte d'autant. Un texte vide, ou fait d'espaces, ne donne
 * aucune ligne : le bloc est le logo seul. Au plus grand corps, du corps de
 * départ à son plancher (CORPS_TECHNOLIBRE_PT, _PLANCHER_PT au registre), où le
 * bloc tient dans l'écart entre les tours et le pied du badge composé sans
 * lui ; technolibre rend alors ce corps et la boîte du logo. Sinon, ou quand le
 * badge a perdu le nom de l'événement, il se retire : technolibre rend {corps:
 * null, logo: null}, et la page est celle du badge sans lui. Non demandé,
 * technolibre rend null.
 *
 * Logo du participant : la boîte la plus grande, au rapport reçu, qui tient
 * dans la largeur du cadre et dans l'écart entre les tours et le pied, moins
 * LOGO_PARTICIPANT_ECART_MM au-dessus et au-dessous, centrée dans cette
 * zone. Le pied TechnoLibre demandé se compte d'abord à son plancher, puis
 * prend le plus grand palier que le logo laisse ; il se retire quand le logo
 * n'atteint qu'ainsi LOGO_PARTICIPANT_PLANCHER_MM sur sa plus petite cote.
 * logoParticipant rend {boite} ; boite null quand même sans pied TechnoLibre
 * le logo n'atteint pas son plancher, ou que le badge a perdu le nom de
 * l'événement : la page est alors celle du badge sans logo. Non demandé,
 * logoParticipant rend null, et la page est celle d'avant le logo.
 *
 * @param {{nom: string, lignes: string[], abregeables?: Array<Array<{debut: number, fin: number}>>,
 *          organisation: string|null, pied: string[], piedReduit: string[]}} textes
 *        abregeables : pour chaque ligne de tour, ses textes libres, par
 *        leurs positions en unités UTF-16, croissants et disjoints ; absent,
 *        aucune ligne n'en porte
 * @param {Metriques} metriques
 * @param {import('../geometrie/papiers.js').ModeleBadge} [modeleBadge]   'a6' par défaut
 * @param {{texte: string, rapport: number}|null} [technolibre]   le pied
 *        TechnoLibre : son texte, vide pour le logo seul, et le rapport
 *        largeur sur hauteur du logo ; null par défaut, sans pied TechnoLibre
 * @param {{rapport: number}|null} [logoParticipant]   le logo du
 *        participant : le rapport largeur sur hauteur de son image ; null par
 *        défaut, sans logo
 * @returns {{blocs: Array<{texte: string, corps: number, gras: boolean, x: number, y: number}>,
 *            colonnesTours: 1|2,
 *            technolibre: null | {corps: number|null,
 *                                 logo: null|{x: number, y: number, largeur: number, hauteur: number}},
 *            logoParticipant: null | {boite: null|{x: number, y: number, largeur: number, hauteur: number}}}
 *          | {refus: {code: string, details: object}}}
 *          les boîtes des logos en millimètres du cadre utile, y à leur haut
 * @throws {TypeError} un modèle de badge inconnu, des textes libres mal
 *         désignés, un pied TechnoLibre ou un logo du participant mal formés
 */
export function mettreEnPage(textes, metriques, modeleBadge = 'a6', technolibre = null, logoParticipant = null) {
  if (!estModeleBadge(modeleBadge)) throw new TypeError(`mettreEnPage : modèle de badge inconnu ${JSON.stringify(modeleBadge)}`);
  const morceauxDesLignes = morceauxLus(textes);
  const promotion = technolibreLu(technolibre);
  const logoDemande = logoParticipantLu(logoParticipant);
  const badge = MODELES_BADGE[modeleBadge];
  const typographie = TYPOGRAPHIES[modeleBadge];
  const { largeur: L, hauteur: H } = cadreUtile({ x: 0, y: 0, largeur: badge.largeur, hauteur: badge.hauteur }, modeleBadge);
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

  // Le texte, entre avant et apres, entier si l'ensemble tient ; sinon son
  // plus long préfixe d'au moins `minimum` grappes, espaces finales
  // retirées, suivi de la marque — la marque seule pour un minimum nul ;
  // null quand aucun ne tient. Les avances sont positives ou nulles : la
  // largeur croît avec le nombre de grappes du préfixe, une dichotomie
  // trouve le plus long qui tient sans la marque, et aucun plus long ne
  // tient avec elle. De là, le premier qui tient avec elle, en descendant.
  function abregerEntre(avant, texte, apres, corps, gras, largeurMax, minimum) {
    const tientAvec = (milieu) => tient(`${avant}${milieu}${apres}`, corps, gras, largeurMax);
    if (tientAvec(texte)) return `${avant}${texte}${apres}`;
    if (!tientAvec('')) return null;
    const grappes = texte.match(GRAPPE) ?? [];
    const prefixe = (nombre) => grappes.slice(0, nombre).join('');
    // Le préfixe vide tient, le texte entier non.
    let bas = 0;
    let haut = grappes.length - 1;
    while (bas < haut) {
      const milieu = Math.ceil((bas + haut) / 2);
      if (tientAvec(prefixe(milieu))) bas = milieu;
      else haut = milieu - 1;
    }
    for (let nombre = bas; nombre >= minimum; nombre -= 1) {
      const garde = prefixe(nombre).replace(/ +$/u, '');
      if (garde === '' && minimum > 0) continue;
      if (tientAvec(`${garde}${MARQUE}`)) return `${avant}${garde}${MARQUE}${apres}`;
    }
    return null;
  }

  // Une organisation dans la largeur : entière, ou abrégée, la marque seule
  // au pis ; null si la marque seule déborde.
  const abreger = (texte, corps, gras, largeurMax) => abregerEntre('', texte, '', corps, gras, largeurMax, 0);

  // Une ligne de tour dans la largeur : entière si elle tient ; sinon ses
  // textes libres s'abrègent l'un après l'autre, dans l'ordre de la ligne,
  // une grappe au moins chacun : le premier à son plus long préfixe qui fait
  // tenir la ligne, les suivants entiers ; à défaut, réduit à sa première
  // grappe, et le suivant s'abrège. null quand la ligne n'en a pas, ou que
  // tous réduits ne la font pas tenir. Le reste de la ligne ne s'abrège
  // jamais.
  function abregerLigne(ligne, morceaux, corps, largeurMax) {
    if (tient(ligne, corps, false, largeurMax)) return ligne;
    // Les morceaux de la ligne : textes fixes et textes libres alternés,
    // chaque libre ensuite remplacé par sa forme réduite.
    const parts = [];
    let curseur = 0;
    for (const { debut, fin } of morceaux) {
      parts.push(ligne.slice(curseur, debut), ligne.slice(debut, fin));
      curseur = fin;
    }
    parts.push(ligne.slice(curseur));
    for (let rang = 1; rang < parts.length; rang += 2) {
      const avant = parts.slice(0, rang).join('');
      const apres = parts.slice(rang + 1).join('');
      const abregee = abregerEntre(avant, parts[rang], apres, corps, false, largeurMax, 1);
      if (abregee !== null) return abregee;
      parts[rang] = `${parts[rang].match(GRAPPE)[0]}${MARQUE}`;
    }
    return null;
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
  const corpsNomMax = constante(typographie.nomMax) / capitaleParPt;
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
  // l'organisation ; null quand aucune disposition des tours n'y tient. La
  // page rend aussi l'écart libre entre ses tours et son pied, en mm, le bas
  // de ses tours, et le nombre de ses blocs de pied, les derniers.
  function composer(forme, { evenement, avecOrganisation }) {
    const auPlusNom = (corps) => Math.min(corps, forme.corps);
    const corpsOrganisation = auPlusNom(constante(typographie.organisation));
    const corpsPied = auPlusNom(constante(typographie.pied));
    const corpsTours = paliers(auPlusNom(constante(typographie.tours)), auPlusNom(constante('CORPS_TOURS_PLANCHER_PT')));
    const plancherTours = corpsTours.at(-1);

    const organisation =
      !avecOrganisation || textes.organisation === null || textes.organisation.trim() === ''
        ? null
        : abreger(textes.organisation, corpsOrganisation, false, L);
    const pied = piedReplie(evenement ? textes.pied : textes.piedReduit, corpsPied);
    if (pied === null) return null;

    // Les lignes de tour d'une disposition, avec leur abscisse et leur rang ;
    // null quand l'une ne tient pas dans sa colonne. Une colonne reçoit les
    // lignes et leurs textes libres, { ligne, morceaux }.
    function disposerTours({ colonnes, corps }) {
      const poser = ({ ligne, morceaux }, largeurMax) => {
        if (corps === plancherTours) return abregerLigne(ligne, morceaux, corps, largeurMax);
        return tient(ligne, corps, false, largeurMax) ? ligne : null;
      };
      const poserColonne = (colonne, largeurMax) => {
        const posees = colonne.map((ligne) => poser(ligne, largeurMax));
        return posees.includes(null) ? null : posees;
      };
      const largeurColonne = (colonne) => Math.max(0, ...colonne.map((t) => largeur(t, corps, false)));
      const lignes = textes.lignes.map((ligne, rang) => ({ ligne, morceaux: morceauxDesLignes[rang] }));
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
      const largeurDroite = largeurColonne(droiteEntiere.map(({ ligne }) => ligne));
      const gauche = poserColonne(lignes.slice(0, rangees), L - gouttiere - Math.min(largeurDroite, demi));
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
    if (organisation !== null) {
      const pasOrganisation = pas(corpsOrganisation);
      const y = curseur + pasOrganisation.ascendante;
      blocs.push({ texte: organisation, corps: corpsOrganisation, gras: false, x: centre(organisation, corpsOrganisation, false), y });
      curseur = y + pasOrganisation.descendante;
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
      const finDesTours = curseur + Math.ceil(textes.lignes.length / disposition.colonnes) * pasTours.hauteur;
      return {
        blocs: [...blocs, ...blocsTours, ...blocsPied],
        colonnesTours: disposition.colonnes,
        libre: hautDuPied - finDesTours,
        finDesTours,
        nombrePied: blocsPied.length,
      };
    }
    return null;
  }

  // Les paliers du pied TechnoLibre demandé, du corps de départ au plancher,
  // ceux dont le texte se replie et dont le logo tient dans la largeur :
  // chacun {corps, lignes, hauteurLogo, largeurLogo, hauteurBloc}, le bloc
  // étant ses lignes puis son logo. Aucun sans pied TechnoLibre demandé.
  function paliersTechnolibre() {
    if (promotion === null) return [];
    const resultat = [];
    for (const corps of paliers(constante('CORPS_TECHNOLIBRE_PT'), constante('CORPS_TECHNOLIBRE_PLANCHER_PT'))) {
      const lignes = replier(promotion.texte, corps, false, Infinity);
      if (lignes === null) continue;
      const hauteurLogo = corps * MM_PAR_PT * LOGO_EN_CADRATINS;
      const largeurLogo = hauteurLogo * promotion.rapport;
      if (largeurLogo > L + TOLERANCE_MM) continue;
      resultat.push({ corps, lignes, hauteurLogo, largeurLogo, hauteurBloc: lignes.length * pas(corps).hauteur + hauteurLogo });
    }
    return resultat;
  }

  // La page composée, le bloc TechnoLibre du palier donné posé sous le pied,
  // le pied remonté de sa hauteur, le logo posé sur le bas du cadre.
  function poserTechnolibre({ blocs, colonnesTours, nombrePied }, { corps, lignes, hauteurLogo, largeurLogo, hauteurBloc }) {
    const pasTexte = pas(corps);
    const debutPied = blocs.length - nombrePied;
    const remonte = blocs.slice(debutPied).map((bloc) => ({ ...bloc, y: bloc.y - hauteurBloc }));
    const hautDuBloc = H - hauteurBloc;
    const blocsTexte = lignes.map((texte, rang) => ({
      texte,
      corps,
      gras: false,
      x: centre(texte, corps, false),
      y: hautDuBloc + rang * pasTexte.hauteur + pasTexte.ascendante,
    }));
    const logo = { x: (L - largeurLogo) / 2, y: H - hauteurLogo, largeur: largeurLogo, hauteur: hauteurLogo };
    return { blocs: [...blocs.slice(0, debutPied), ...remonte, ...blocsTexte], colonnesTours, technolibre: { corps, logo } };
  }

  // La page finale d'une page composée, sans logo du participant : sans pied
  // TechnoLibre demandé, telle quelle ; sinon, le bloc TechnoLibre au plus
  // grand corps qui tient dans l'écart libre, le pied remonté de sa hauteur.
  // La page reste telle quelle, le bloc retiré, quand même le plancher ne
  // tient pas, ou que la page a perdu le nom de l'événement : il le suit dans
  // l'ordre de sacrifice, et l'écart que le dépouillement libère ne lui
  // revient pas.
  function avecTechnolibre(page, { evenement }) {
    const { blocs, colonnesTours, libre } = page;
    if (promotion === null) return { blocs, colonnesTours, technolibre: null };
    const retire = { blocs, colonnesTours, technolibre: { corps: null, logo: null } };
    if (!evenement) return retire;
    const palier = paliersTechnolibre().find(({ hauteurBloc }) => hauteurBloc <= libre + TOLERANCE_MM);
    return palier === undefined ? retire : poserTechnolibre(page, palier);
  }

  // La page finale d'une page composée, le logo du participant demandé posé
  // avant le pied TechnoLibre ; null quand il ne se pose pas : page sans le
  // nom de l'événement, ou plus petite cote sous le plancher même sans pied
  // TechnoLibre. Le logo prend la zone entre les tours et le pied — remonté
  // du bloc TechnoLibre —, moins un dégagement de part et d'autre, centré.
  function avecLogo(page, { evenement }) {
    if (!evenement) return null;
    const ecart = constante('LOGO_PARTICIPANT_ECART_MM');
    const plancher = constante('LOGO_PARTICIPANT_PLANCHER_MM');
    const { rapport } = logoDemande;
    // Le plus grand logo dans une zone de la hauteur donnée, bornée aussi
    // par la largeur du cadre ; null quand sa plus petite cote passe sous le
    // plancher.
    const tailleDans = (hauteurZone) => {
      const hauteur = Math.min(hauteurZone, L / rapport);
      const largeur = hauteur * rapport;
      return Math.min(largeur, hauteur) >= plancher - TOLERANCE_MM ? { largeur, hauteur } : null;
    };
    // Le logo posé sur la page finale, centré entre le bas des tours et le
    // haut du pied, que le bloc TechnoLibre de la hauteur donnée remonte.
    const poser = (finale, { largeur, hauteur }, hauteurBloc) => {
      const haut = page.finDesTours + ecart;
      const zone = page.libre - hauteurBloc - 2 * ecart;
      const boite = { x: (L - largeur) / 2, y: haut + (zone - hauteur) / 2, largeur, hauteur };
      return { ...finale, logoParticipant: { boite } };
    };
    const lesPaliers = paliersTechnolibre();
    const plancherTechnolibre = lesPaliers.at(-1);
    if (plancherTechnolibre !== undefined) {
      const taille = tailleDans(page.libre - plancherTechnolibre.hauteurBloc - 2 * ecart);
      if (taille !== null) {
        // Le pied TechnoLibre reprend le plus grand palier que le logo
        // laisse : son plancher y tient au moins.
        const reste = page.libre - taille.hauteur - 2 * ecart;
        const palier = lesPaliers.find(({ hauteurBloc }) => hauteurBloc <= reste + TOLERANCE_MM) ?? plancherTechnolibre;
        return poser(poserTechnolibre(page, palier), taille, palier.hauteurBloc);
      }
    }
    const taille = tailleDans(page.libre - 2 * ecart);
    if (taille === null) return null;
    const { blocs, colonnesTours } = page;
    const technolibreRetire = promotion === null ? null : { corps: null, logo: null };
    return poser({ blocs, colonnesTours, technolibre: technolibreRetire }, taille, 0);
  }

  // La page finale d'une page composée : sans logo du participant demandé,
  // celle du pied TechnoLibre, logoParticipant null ; avec, celle où le logo
  // se pose, ou celle du badge sans logo, boîte null.
  function finir(page, niveau) {
    if (logoDemande === null) return { ...avecTechnolibre(page, niveau), logoParticipant: null };
    return avecLogo(page, niveau) ?? { ...avecTechnolibre(page, niveau), logoParticipant: { boite: null } };
  }

  // Les essais, du badge complet au plus dépouillé : chaque forme du nom
  // avec le badge entier, puis le nom au plancher sans le nom de
  // l'événement, puis sans l'organisation. Un nom au-delà de trois lignes a
  // déjà perdu le nom de l'événement.
  const plancherNom = nom.formes.at(-1);
  const essais = [
    ...(nom.auDela ? [] : nom.formes.map((forme) => ({ forme, evenement: true, avecOrganisation: true }))),
    { forme: plancherNom, evenement: false, avecOrganisation: true },
    { forme: plancherNom, evenement: false, avecOrganisation: false },
  ];
  for (const { forme, ...niveau } of essais) {
    const page = composer(forme, niveau);
    if (page !== null) return finir(page, niveau);
  }
  if (nom.auDela) return refusNom;
  return { refus: { code: 'PLANCHE_TROP_DE_TOURS', details: { tours: textes.lignes.length } } };
}
