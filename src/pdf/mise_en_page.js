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
// La page est un flux. En haut, le nom en gras, puis l'organisation, puis les
// lignes de tour ; en bas, le pied, sa dernière ligne posée sur le bord du
// cadre. Chaque ligne occupe la hauteur que la police lui donne, de
// l'ascendante à la descendante, ou, sur un badge serré, une hauteur moindre,
// jamais sous celle de l'encre des textes du badge : deux lignes empilées ne
// se recouvrent jamais, et une ligne absente laisse sa place à la suivante.
// Un nom laissé en blanc n'est pas absent : ses lignes gardent leur place,
// vide.
//
// Le haut de la page porte deux rôles : le gros texte, en gras, et le petit
// texte, en romain, sous lui. Le gros texte est le nom, le petit
// l'organisation ; sous la marque organisationEnGros, quand l'organisation
// n'est pas vide, ils s'échangent, et l'organisation prend le rôle du nom.
// Chaque règle qui suit — corps, repli, ordre de sacrifice, refus — suit
// le rôle, non la donnée : « le nom » y désigne le gros texte,
// « l'organisation » le petit. Un nom laissé en blanc garde sa place dans
// son rôle.
//
// Aucun texte du badge ne s'abrège : un texte trop large pour sa ligne se
// replie comme un paragraphe, au dernier espace qui tient, et un mot plus
// large que la ligne se coupe entre deux grappes (replier). Le texte entier
// reste donc sur la page, ou le badge se refuse.
//
// Le nom se choisit d'abord, sur la seule largeur : il passe avant tout le
// reste (§ 11.4, rang 1). Pour chaque forme du nom, de la plus grande au
// plancher, les tours essaient leurs dispositions, une colonne du corps des
// tours au plancher, puis deux colonnes ; sous chacune, une organisation
// qui se replie essaie ses corps, du départ à son plancher ; la première
// qui tient l'emporte. Une organisation qui tient sur une ligne garde son
// corps de départ.
//
// Le nom au plancher, le badge se resserre avant de perdre un texte : ses
// lignes se serrent par paliers, juste assez, jusqu'à l'encre de ses textes,
// puis son pied rapetisse jusqu'à son plancher. Alors seulement il se
// dépouille dans l'ordre de sacrifice (décision 8), le nom de l'événement
// d'abord, puis l'organisation, et chaque badge dépouillé se compose de
// nouveau au pas de la police, puis se resserre de même. Hors du dernier
// recours, retirer un texte ne vient donc qu'après avoir réduit tout ce qui
// se réduit. Un badge serré ne porte ni image des badges, ni logo du
// participant, ni pied TechnoLibre.
//
// Le refus ne vient qu'après le dernier recours : quand même le badge le plus
// dépouillé, serré, son pied à son plancher, ne tient pas, son nom passe sous
// le sien, jusqu'à un plancher de dernier recours qui ne descend jamais sous
// celui des tours. Les tours gardent leur plancher : tout ce qui n'est pas
// elles se réduit pour leur laisser la place.
//
// Chaque modèle de badge a son cadre utile (cadreUtile) et ses corps de
// départ, lus au registre des constantes (TYPOGRAPHIES) ; les planchers du
// nom, des tours, de l'organisation et du pied sont ceux de la lisibilité,
// communs aux modèles, comme le plancher du nom au dernier recours.
//
// Après tout le texte, l'écart libre entre les tours et le pied se donne
// dans l'ordre : le logo du participant, puis le pied TechnoLibre, puis
// l'image des badges. Le pied TechnoLibre cède au logo ce qui dépasse son
// plancher, puis se retire pour lui, mais ne cède rien à l'image, et le logo
// ne cède à l'image que ce qui dépasse son plancher : sur un badge chargé,
// l'image rapetisse, puis se retire, la première. Aucun des trois ne réduit
// ni ne retire un texte, ni ne cause un refus, et aucun ne se pose sur un
// badge dépouillé ou serré : ils suivent tous les textes dans l'ordre de
// sacrifice.
//
// Le pied TechnoLibre, quand il est demandé : un texte, puis le logo, sous
// le pied, le logo posé sur le bord du cadre ; un texte vide, ou fait
// d'espaces, ne pose que le logo. Son texte se replie sans laisser un mot
// seul sur sa dernière ligne, au même nombre de lignes que le repli glouton
// (sansMotSeul), sauf quand ses deux derniers mots, le dernier morceau d'un
// mot coupé compris, ne tiennent pas ensemble sur une ligne : le dernier
// reste alors seul. Il ne prend que la place que le badge entier et le logo
// du participant laissent entre ses tours et son pied, et ne change rien à
// ce qui le précède : le badge se compose d'abord sans lui, le pied remonte
// ensuite de la hauteur du bloc. Il rapetisse de son corps de départ à son
// plancher, par paliers d'un point ; quand même le plancher ne tient pas, il
// se retire, et le badge est celui qu'il serait sans lui. Il se retire aussi
// d'un badge qui a perdu le nom de l'événement : il le suit dans l'ordre de
// sacrifice.
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
//
// L'image des badges, quand elle est demandée, prend la plus grande taille
// qui tient, au rapport reçu, sous la hauteur maximale du modèle
// (TYPOGRAPHIES), dans ce que le logo posé et le pied TechnoLibre laissent :
// le pied TechnoLibre garde le palier du badge sans image, le logo la plus
// petite zone où il atteint son plancher, avec ses dégagements, et il prend
// ensuite tout ce qu'elle laisse. Elle a ses propres dégagements
// (LOGO_PARTICIPANT_ECART_MM). Le texte se compose sans elle et ne change
// pas : en haut, elle repousse le nom, l'organisation et les tours vers le
// bas ; au centre, les tours seuls ; en bas, rien, et elle se pose au-dessus
// du pied. Elle rapetisse avec l'écart, et ne se pose pas quand sa plus
// petite cote n'atteint pas le plancher du logo
// (LOGO_PARTICIPANT_PLANCHER_MM).
import { constante } from '../geometrie/constantes.js';
import { MODELES_BADGE, estModeleBadge } from '../geometrie/papiers.js';
import { cadreUtile } from './imposition.js';

// Les noms au registre des corps de départ de chaque modèle : la capitale
// maximale du nom, les corps des tours, de l'organisation et du pied, et la
// hauteur maximale de l'image des badges.
const TYPOGRAPHIES = Object.freeze({
  a6: Object.freeze({
    nomMax: 'HAUTEUR_CAPITALE_NOM_MAX_MM',
    tours: 'CORPS_TOURS_PT',
    organisation: 'CORPS_ORGANISATION_PT',
    pied: 'CORPS_PIED_PT',
    imageMax: 'IMAGE_BADGES_HAUTEUR_MAX_MM',
  }),
  avery5392: Object.freeze({
    nomMax: 'HAUTEUR_CAPITALE_NOM_MAX_CARTE_MM',
    tours: 'CORPS_TOURS_CARTE_PT',
    organisation: 'CORPS_ORGANISATION_CARTE_PT',
    pied: 'CORPS_PIED_CARTE_PT',
    imageMax: 'IMAGE_BADGES_HAUTEUR_MAX_CARTE_MM',
  }),
});

/** Le point typographique en millimètres. */
const MM_PAR_PT = 25.4 / 72;

// La hauteur du logo du pied TechnoLibre, en cadratins du corps de son
// texte, commune aux modèles : une proportion du bloc, non un seuil de
// lisibilité. Le corps de départ du texte et son plancher, lisible à la
// loupe, sont au registre (CORPS_TECHNOLIBRE_PT, _PLANCHER_PT).
const LOGO_EN_CADRATINS = 2;

// Le nombre de paliers par lesquels le pas d'une ligne serrée descend de
// celui de la police à celui de l'encre, chacun en ôtant la même part : le
// premier qui tient l'emporte, et le badge ne se serre que de ce qu'il lui
// faut. Une finesse de composition, non un seuil de lisibilité : l'encre
// reste le plancher.
const PALIERS_DU_PAS_SERRE = 8;

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
 * @property {(texte: string, corps: number, gras: boolean) => {haut: number, bas: number}} encre
 *           l'encre du texte : la plus haute de ses glyphes au-dessus de la
 *           ligne de base, la plus basse au-dessous, positive ; 0 pour un
 *           texte sans encre
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
 * réservée à leur hauteur contient l'une comme l'autre. L'encre d'un texte
 * vient des boîtes des glyphes que fontkit pose pour lui, dans sa graisse,
 * telles que pdf-lib les dessine : sans décalage de positionnement. Un
 * caractère est absent quand l'une des deux graisses n'a pas son glyphe.
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
  // L'encre d'un texte en cadratins, par graisse : le plus haut et le plus
  // bas des glyphes posés. Une espace n'a pas de boîte : ses bornes ne sont
  // pas finies, et elle ne compte pas.
  const encres = [new Map(), new Map()];
  const encreCadratins = (texte, enGras) => {
    const memoire = encres[enGras ? 1 : 0];
    let encre = memoire.get(texte);
    if (encre === undefined) {
      const fonte = fontes[enGras ? 1 : 0];
      encre = { haut: 0, bas: 0 };
      for (const { bbox } of fonte.layout(texte).glyphs) {
        if (Number.isFinite(bbox.maxY)) encre.haut = Math.max(encre.haut, bbox.maxY / fonte.unitsPerEm);
        if (Number.isFinite(bbox.minY)) encre.bas = Math.max(encre.bas, -bbox.minY / fonte.unitsPerEm);
      }
      memoire.set(texte, encre);
    }
    return encre;
  };
  return {
    largeur: (texte, corps, enGras) => largeurMille(texte, enGras) * (corps / 1000) * MM_PAR_PT,
    encre: (texte, corps, enGras) => {
      const { haut, bas } = encreCadratins(texte, enGras);
      return { haut: haut * corps * MM_PAR_PT, bas: bas * corps * MM_PAR_PT };
    },
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

// Les positions de l'image des badges : en haut du cadre, au centre — entre
// le bloc du nom et les tours —, en bas — au-dessus du pied.
const POSITIONS_IMAGE = Object.freeze(['haut', 'centre', 'bas']);

// L'image des badges demandée, contrôlée : null, ou {rapport, position}, le
// rapport largeur sur hauteur de l'image, un nombre fini positif, et l'une
// de POSITIONS_IMAGE ; TypeError sinon.
function imageBadgesLue(imageBadges) {
  if (imageBadges === null) return null;
  const bien = Number.isFinite(imageBadges?.rapport) && imageBadges.rapport > 0 && POSITIONS_IMAGE.includes(imageBadges?.position);
  if (!bien) throw new TypeError(`mettreEnPage : image des badges {rapport, position} attendue, reçu ${JSON.stringify(imageBadges)}`);
  return imageBadges;
}

// Le nom laissé en blanc, contrôlé : textes.nomEnBlanc, un booléen, faux
// quand il manque ; TypeError sinon.
function nomEnBlancLu({ nomEnBlanc = false }) {
  if (typeof nomEnBlanc !== 'boolean') throw new TypeError(`mettreEnPage : nomEnBlanc, un booléen, attendu, reçu ${JSON.stringify(nomEnBlanc)}`);
  return nomEnBlanc;
}

// Les deux rôles du haut de la page, lus des textes : gros, le texte en
// gras et sa marque en blanc ; petit, le texte en romain sous lui, null
// quand il n'existe pas, et sa marque. textes.organisationEnGros, un booléen
// faux quand il manque, échange le nom et l'organisation, sauf quand
// celle-ci est null, vide ou faite d'espaces : le nom reste alors en gros.
// enGros dit lequel des deux tient le rôle du gros texte. TypeError pour
// une marque qui n'est pas un booléen.
function rolesLus(textes) {
  const nomEnBlanc = nomEnBlancLu(textes);
  const { organisationEnGros = false } = textes;
  if (typeof organisationEnGros !== 'boolean') {
    throw new TypeError(`mettreEnPage : organisationEnGros, un booléen, attendu, reçu ${JSON.stringify(organisationEnGros)}`);
  }
  const organisation = textes.organisation === null || textes.organisation.trim() === '' ? null : textes.organisation;
  if (organisationEnGros && organisation !== null) {
    return { enGros: 'organisation', gros: { texte: organisation, enBlanc: false }, petit: { texte: textes.nom, enBlanc: nomEnBlanc } };
  }
  return { enGros: 'nom', gros: { texte: textes.nom, enBlanc: nomEnBlanc }, petit: { texte: organisation, enBlanc: false } };
}

/**
 * La mise en page d'un badge, ou le refus qui dit pourquoi il ne tient pas.
 *
 * Rôles : le nom est le gros texte, l'organisation le petit. Sous
 * organisationEnGros, une organisation qui n'est pas vide prend le rôle du
 * nom, et le nom celui de l'organisation : tout ce qui suit dit « nom »
 * pour le gros texte et « organisation » pour le petit. La page est alors
 * celle des deux textes échangés, refus compris, à la marque du nom laissé
 * en blanc près, qui suit le nom dans son rôle.
 *
 * Nom : le corps de départ donne au nom la hauteur de capitale maximale du
 * registre, et descend d'un point par palier jusqu'au plancher, dont la
 * capitale vaut le plancher du registre ; les deux se convertissent par la
 * capitale que les métriques donnent. Le nom tient d'abord sur une ligne,
 * puis sur deux, puis sur trois, chaque fois au plus grand corps possible,
 * coupé aux espaces ; à défaut seulement, coupé entre deux grappes, de deux à
 * trois lignes. Quand le reste du badge ne tient pas sous ce nom, il descend
 * d'un palier à la fois jusqu'au plancher, au même nombre de lignes au plus.
 * Au plancher, le badge se resserre (voir Badge serré), puis perd le nom de
 * l'événement (le pied devient le pied réduit), puis, s'il ne tient toujours
 * pas, resserré de nouveau, l'organisation. Au-delà de trois lignes, où il se
 * replie au plancher sur autant de lignes qu'il lui faut, le badge a perdu
 * d'emblée le nom de l'événement. Le nom ne s'abrège jamais. Un badge qui
 * perd l'un ou l'autre est dépouillé ; un pied égal au pied réduit, celui
 * dont une case retire déjà le nom de l'événement, ne dépouille pas le badge
 * en passant au pied réduit.
 *
 * Nom de la personne laissé en blanc : la page se compose sur le nom tel
 * quel, puis n'en pose aucune ligne, dans l'un ou l'autre rôle. Sa place
 * reste vide, à la hauteur exacte des lignes qu'il aurait prises, et tout le
 * reste de la page — corps, positions, dépouillement, pied TechnoLibre, logo
 * du participant, refus — est celui du nom imprimé. Dans le rôle de
 * l'organisation, il part comme elle dans l'ordre de sacrifice.
 *
 * Organisation : entière sur une ligne, à son corps de départ, quand elle
 * y tient ; sinon repliée en paragraphe sur autant de lignes qu'il lui
 * faut, chacune centrée, et, quand le badge ne tient pas, descendue d'un
 * point par palier jusqu'à son plancher (CORPS_ORGANISATION_PLANCHER_PT).
 * Quand le badge ne tient pas même ainsi, elle se retire dans l'ordre de
 * sacrifice. Pied : chaque ligne se replie comme le nom.
 *
 * Tours : une colonne, du corps des tours à leur plancher, puis deux
 * colonnes, la première rangée de haut en bas d'abord, séparées d'un
 * cadratin. Chaque ligne est entière, sauf au plancher : une ligne trop
 * large pour sa colonne s'y replie en paragraphe, un nombre gardé sur la
 * ligne du mot qui le précède, et sa suite descend sous elle en retrait
 * d'un cadratin, dans la même colonne. La hauteur des tours compte ces
 * lignes repliées. Rien ne s'y abrège, ni le libellé de la table, ni le
 * titre, ni le numéro. Aucun corps ne dépasse celui du nom.
 *
 * Badge serré, avant chaque retrait d'un texte, le nom au plancher : le pas
 * de chaque ligne descend, en PALIERS_DU_PAS_SERRE paliers égaux, de celui
 * de la police à l'encre que posent les textes de la page — le nom,
 * l'organisation quand elle y est, les tours et le pied, entier ou réduit,
 * un texte laissé en blanc compté comme imprimé —, du plus haut au plus bas
 * de leurs glyphes ; puis, à l'encre, le pied descend d'un point par palier
 * jusqu'à son plancher (CORPS_PIED_PLANCHER_PT). Le premier palier qui tient
 * l'emporte. Un badge serré qui n'a perdu aucun texte n'est pas dépouillé,
 * mais ne porte, comme lui, ni pied TechnoLibre, ni logo du participant, ni
 * image des badges : l'écart que libère son resserrement ne leur revient
 * pas.
 *
 * Dernier recours, quand même le badge sans le nom de l'événement ni
 * l'organisation, serré, le pied à son plancher, ne tient pas : le nom, d'un
 * point par palier, replié chaque fois sur le moins de lignes qui tient,
 * jusqu'à la capitale du dernier recours
 * (HAUTEUR_CAPITALE_NOM_DERNIER_RECOURS_MM), jamais sous le plancher des
 * tours. Le badge reste dépouillé : ni pied TechnoLibre, ni logo du
 * participant, ni image des badges.
 *
 * Refus : PLANCHE_NOM_TROP_LONG quand le nom dépasse trois lignes et que
 * rien ne tient, ses détails {organisation: true} quand l'organisation tient
 * ce rôle, {} sinon ; PLANCHE_TROP_DE_TOURS {tours, repliees} dans les
 * autres cas, tours étant le nombre de lignes de tour reçues ; repliees,
 * vrai quand ces lignes, une rangée chacune, tiendraient : ce sont alors des
 * lignes trop larges, repliées, qui débordent. src/pdf ne connaît pas la
 * personne : l'appelant complète les détails.
 *
 * Le modèle de badge donne le cadre utile et les corps de départ : l'A6,
 * 89 × 132 mm ; la carte Avery 5392, 91,6 × 66,2 mm.
 *
 * Pied TechnoLibre : son texte, replié comme le pied, centré, puis le logo,
 * centré, de deux cadratins de haut, au rapport reçu, posé sur le bas du
 * cadre ; le pied remonte d'autant. Un texte vide, ou fait d'espaces, ne
 * donne aucune ligne : le bloc est le logo seul. Au plus grand corps, du
 * corps de départ à son plancher (CORPS_TECHNOLIBRE_PT, _PLANCHER_PT au
 * registre), où le bloc tient dans l'écart entre les tours et le pied du
 * badge composé sans lui ; technolibre rend alors ce corps et la boîte du
 * logo. Sinon, ou quand le badge est dépouillé ou serré, il se retire :
 * technolibre rend {corps: null, logo: null}, et la page est celle du badge
 * sans lui. Non demandé, technolibre rend null. Il passe avant l'image des
 * badges : son palier est celui du badge sans elle.
 *
 * Logo du participant : la boîte la plus grande, au rapport reçu, qui tient
 * dans la largeur du cadre et dans l'écart entre les tours et le pied, moins
 * LOGO_PARTICIPANT_ECART_MM au-dessus et au-dessous, centrée dans cette zone,
 * au-dessus de l'image des badges posée en bas, sous elle ailleurs. Le pied
 * TechnoLibre demandé se compte d'abord à son plancher, puis prend le plus
 * grand palier que le logo laisse ; il se retire quand le logo n'atteint
 * qu'ainsi LOGO_PARTICIPANT_PLANCHER_MM sur sa plus petite cote.
 * logoParticipant rend {boite} ; boite null quand même sans pied TechnoLibre
 * le logo n'atteint pas son plancher, ou que le badge est dépouillé ou
 * serré : la page est alors celle du badge sans logo. Non demandé,
 * logoParticipant rend null, et la page est celle d'avant le logo.
 *
 * Image des badges : la boîte la plus grande, au rapport reçu, au plus de la
 * hauteur maximale du modèle (IMAGE_BADGES_HAUTEUR_MAX_MM,
 * IMAGE_BADGES_HAUTEUR_MAX_CARTE_MM), dans la largeur du cadre et dans
 * l'écart entre les tours et le pied, moins le bloc TechnoLibre, moins, sous
 * un logo posé, la plus petite zone où il atteint son plancher et ses deux
 * dégagements, moins LOGO_PARTICIPANT_ECART_MM sous elle en haut, de part et
 * d'autre au centre et en bas ; centrée en largeur. En haut, au haut du
 * cadre, tout ce qui précède le pied descendant de sa hauteur et d'un
 * dégagement ; au centre, entre le petit texte et les tours, qui descendent
 * de sa hauteur et de deux dégagements ; en bas, un dégagement au-dessus du
 * pied, remonté avec lui sous un pied TechnoLibre. Elle se taille après le
 * logo du participant, qui ne lui cède que ce qui dépasse son plancher, et
 * après le pied TechnoLibre, qui garde le palier du badge sans elle.
 * imageBadges rend {boite} ; boite null quand sa plus petite cote n'atteint
 * pas LOGO_PARTICIPANT_PLANCHER_MM, ou que le badge est dépouillé ou serré :
 * la page est alors celle du badge sans image. Non demandée, imageBadges rend
 * null, et la page est celle d'avant l'image.
 *
 * @param {{nom: string, nomEnBlanc?: boolean, organisationEnGros?: boolean, lignes: string[],
 *          organisation: string|null, pied: string[], piedReduit: string[]}} textes
 *        nomEnBlanc : vrai, le nom se mesure sans se poser ; absent, faux.
 *        organisationEnGros : vrai, l'organisation prend le rôle du nom ;
 *        absent, faux
 * @param {Metriques} metriques
 * @param {import('../geometrie/papiers.js').ModeleBadge} [modeleBadge]   'a6' par défaut
 * @param {{texte: string, rapport: number}|null} [technolibre]   le pied
 *        TechnoLibre : son texte, vide pour le logo seul, et le rapport
 *        largeur sur hauteur du logo ; null par défaut, sans pied TechnoLibre
 * @param {{rapport: number}|null} [logoParticipant]   le logo du
 *        participant : le rapport largeur sur hauteur de son image ; null par
 *        défaut, sans logo
 * @param {{rapport: number, position: 'haut'|'centre'|'bas'}|null} [imageBadges]
 *        l'image des badges : le rapport largeur sur hauteur de l'image et
 *        sa position ; null par défaut, sans image
 * @returns {{blocs: Array<{texte: string, corps: number, gras: boolean, x: number, y: number}>,
 *            colonnesTours: 1|2,
 *            technolibre: null | {corps: number|null,
 *                                 logo: null|{x: number, y: number, largeur: number, hauteur: number}},
 *            logoParticipant: null | {boite: null|{x: number, y: number, largeur: number, hauteur: number}},
 *            imageBadges: null | {boite: null|{x: number, y: number, largeur: number, hauteur: number}}}
 *          | {refus: {code: string, details: object}}}
 *          les boîtes des logos et de l'image en millimètres du cadre utile,
 *          y à leur haut
 * @throws {TypeError} un modèle de badge inconnu, un nomEnBlanc ou un
 *         organisationEnGros qui n'est pas un booléen, un pied TechnoLibre,
 *         un logo du participant ou une image des badges mal formés
 */
export function mettreEnPage(textes, metriques, modeleBadge = 'a6', technolibre = null, logoParticipant = null, imageBadges = null) {
  if (!estModeleBadge(modeleBadge)) throw new TypeError(`mettreEnPage : modèle de badge inconnu ${JSON.stringify(modeleBadge)}`);
  const { enGros, gros, petit } = rolesLus(textes);
  const promotion = technolibreLu(technolibre);
  const logoDemande = logoParticipantLu(logoParticipant);
  const imageDemandee = imageBadgesLue(imageBadges);
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
  // Le pas serré : au plus serré, une ligne occupe la hauteur de l'encre
  // que posent les textes de la page — le nom en gras, l'organisation, les
  // tours et le pied en romain, un texte laissé en blanc compté comme
  // imprimé —, du plus haut au plus bas de leurs glyphes, au lieu de la
  // hauteur que la police réserve à tout glyphe. Deux lignes empilées ne
  // mêlent donc pas leur encre, et toutes les lignes d'un corps avancent du
  // même pas. Aucun jeu ne s'y ajoute : le plus bas jambage d'une ligne et le
  // plus haut accent de la suivante peuvent se toucher, à la verticale l'un
  // de l'autre. L'encre, proportionnelle au corps, se mesure une fois par
  // texte, au corps 1, et seulement quand une page se serre. pasSerre rend
  // le pas des textes donnés, le nom compris, les autres en romain, à la
  // part donnée du chemin de la police à l'encre, de 0 exclu à 1 : son
  // ascendante et sa descendante en sont chacune la moyenne pondérée, celles
  // de l'encre exactement à 1.
  const encres = new Map();
  const encreParPt = (texte, gras) => {
    const cle = `${gras ? 'g' : 'r'}${texte}`;
    if (!encres.has(cle)) encres.set(cle, metriques.encre(texte, 1, gras));
    return encres.get(cle);
  };
  const pasSerre = (romains, part) => {
    const lues = [encreParPt(gros.texte, true), ...romains.map((texte) => encreParPt(texte, false))];
    const haut = Math.max(...lues.map((encre) => encre.haut));
    const bas = Math.max(...lues.map((encre) => encre.bas));
    return (corps) => {
      const police = pas(corps);
      const ascendante = (1 - part) * police.ascendante + part * haut * corps;
      const descendante = (1 - part) * police.descendante + part * bas * corps;
      return { ascendante, descendante, hauteur: ascendante + descendante };
    };
  };

  // Les lignes du texte repliées, au plus `limite` ; null quand il en faut
  // davantage, ou qu'une grappe seule déborde. Chaque ligne prend les mots
  // qui tiennent, et la coupe tombe au dernier espace qui tient. Un mot qui
  // ne tient pas seul sur une ligne ouvre la suivante et se coupe entre deux
  // grappes, sauf sous `motsEntiers`, où le repli échoue. La première ligne
  // tient dans la largeur `premiere`, les suivantes dans `suite` ; toutes
  // dans la largeur du cadre par défaut. Sous `lier`, un mot qui commence
  // par un chiffre reste sur la ligne du mot qui le précède — « Tour 2 »,
  // « table 5 », « siège 3 » ne se séparent pas —, tant que les deux tiennent
  // ensemble sur une ligne nouvelle ; sinon, ils se replient chacun.
  function replier(texte, corps, gras, limite, motsEntiers = false, { premiere = L, suite = premiere, lier = false } = {}) {
    const lignes = [];
    let courante = '';
    const tientIci = (morceau) => tient(morceau, corps, gras, lignes.length === 0 ? premiere : suite);
    const clore = () => {
      lignes.push(courante);
      courante = '';
      return lignes.length <= limite;
    };
    // Les unités du repli, chacune ses mots : un mot seul, ou, sous `lier`,
    // un mot suivi des mots qui commencent par un chiffre.
    const unites = [];
    for (const mot of texte.split(' ')) {
      if (mot === '') continue;
      if (lier && unites.length > 0 && /^\p{Nd}/u.test(mot)) unites.at(-1).push(mot);
      else unites.push([mot]);
    }
    for (let rang = 0; rang < unites.length; rang += 1) {
      const unite = unites[rang];
      const mot = unite.join(' ');
      const avecMot = courante === '' ? mot : `${courante} ${mot}`;
      if (tientIci(avecMot)) {
        courante = avecMot;
        continue;
      }
      // Une unité de plusieurs mots qui ne tient pas sur la ligne qu'elle
      // ouvrirait se défait en ses mots, qui se replient chacun.
      const ouverte = courante === '' && lignes.length === 0 ? premiere : suite;
      if (unite.length > 1 && !tient(mot, corps, gras, ouverte)) {
        unites.splice(rang + 1, 0, ...unite.map((seul) => [seul]));
        continue;
      }
      if (courante !== '' && !clore()) return null;
      if (tientIci(mot)) {
        courante = mot;
        continue;
      }
      if (motsEntiers) return null;
      for (const grappe of mot.match(GRAPPE)) {
        const avecGrappe = courante + grappe;
        if (courante === '' || tientIci(avecGrappe)) {
          courante = avecGrappe;
        } else if (!clore()) {
          return null;
        } else {
          courante = grappe;
        }
        if (!tientIci(courante)) return null;
      }
    }
    if (courante !== '' && !clore()) return null;
    return lignes;
  }

  // Un paragraphe dans la largeur donnée : le texte tel quel quand il tient
  // sur une ligne, sinon replié, ses lignes après la première en retrait,
  // un nombre lié au mot qui le précède sous `lier` ; null quand une grappe
  // seule déborde.
  const paragraphe = (texte, corps, largeurMax, { retrait = 0, lier = false } = {}) =>
    tient(texte, corps, false, largeurMax)
      ? [texte]
      : replier(texte, corps, false, Infinity, false, { premiere: largeurMax, suite: largeurMax - retrait, lier });

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
        const premier = paliersNom.findIndex((corps) => replier(gros.texte, corps, true, nombre, motsEntiers) !== null);
        if (premier < 0) continue;
        const formes = [];
        for (const corps of paliersNom.slice(premier)) {
          const lignes = replier(gros.texte, corps, true, nombre, motsEntiers);
          if (lignes !== null) formes.push({ corps, lignes });
        }
        return { formes, auDela: false };
      }
    }
    const empilables = Math.floor((H + TOLERANCE_MM) / pas(corpsNomPlancher).hauteur);
    const lignes =
      replier(gros.texte, corpsNomPlancher, true, empilables, true) ??
      replier(gros.texte, corpsNomPlancher, true, empilables, false);
    return lignes === null ? null : { formes: [{ corps: corpsNomPlancher, lignes }], auDela: true };
  }
  const refusNom = { refus: { code: 'PLANCHE_NOM_TROP_LONG', details: enGros === 'organisation' ? { organisation: true } : {} } };
  const nom = choisirNom();
  if (nom === null) return refusNom;

  // Vrai dès qu'une disposition tient les tours, une ligne chacun, sous une
  // forme du badge : quand le badge se refuse ensuite, ce sont des lignes
  // trop larges, repliées, qui débordent, et non le nombre des tours.
  let toursEnLignesTiennent = false;

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
  // l'organisation ; null quand aucune disposition des tours n'y tient.
  // `serre`, de 0, le pas de la police, à 1, celui de l'encre, est la part
  // du chemin de l'un à l'autre que fait le pas de chaque ligne, serré sur
  // les textes que la page pose (pasSerre) ; `corpsPied` remplace le corps
  // de départ du pied, plafonné de même par le nom. La page rend aussi
  // l'écart libre entre ses tours et son pied, en mm, le haut et le bas de
  // ses tours, le rang de son premier bloc de tour, et le nombre de ses blocs
  // de pied, les derniers.
  function composer(forme, { evenement, avecOrganisation, serre = 0, corpsPied: piedDemande = null }) {
    const auPlusNom = (corps) => Math.min(corps, forme.corps);
    const sansOrganisation = !avecOrganisation || petit.texte === null;
    const lignesPied = evenement ? textes.pied : textes.piedReduit;
    const romains = [...(sansOrganisation ? [] : [petit.texte]), ...textes.lignes, ...lignesPied];
    const pasDe = serre > 0 ? pasSerre(romains, serre) : pas;
    const corpsPied = auPlusNom(piedDemande ?? constante(typographie.pied));
    const corpsTours = paliers(auPlusNom(constante(typographie.tours)), auPlusNom(constante('CORPS_TOURS_PLANCHER_PT')));
    const plancherTours = corpsTours.at(-1);

    const pied = piedReplie(lignesPied, corpsPied);
    if (pied === null) return null;

    // Les lignes de tour d'une disposition, avec leur abscisse et leur rang
    // dans leur colonne, et le nombre de rangées de la plus haute colonne ;
    // null quand l'une ne tient pas dans sa colonne. Au plancher, une ligne
    // trop large se replie, sa suite en retrait d'un cadratin.
    function disposerTours({ colonnes, corps }) {
      const retrait = corps * MM_PAR_PT;
      const poser = (ligne, largeurMax) => {
        if (corps === plancherTours) return paragraphe(ligne, corps, largeurMax, { retrait, lier: true });
        return tient(ligne, corps, false, largeurMax) ? [ligne] : null;
      };
      const poserColonne = (colonne, largeurMax) => {
        const posees = colonne.map((ligne) => poser(ligne, largeurMax));
        return posees.includes(null) ? null : posees;
      };
      // La largeur d'une colonne posée : sa plus large ligne, une suite
      // comptée avec son retrait.
      const largeurColonne = (posees) =>
        Math.max(0, ...posees.flatMap((morceaux) => morceaux.map((t, rang) => (rang === 0 ? 0 : retrait) + largeur(t, corps, false))));
      // Les lignes d'une colonne posée à l'abscisse x, de haut en bas, chaque
      // suite décalée de son retrait.
      const ranger = (posees, x) =>
        posees
          .flatMap((morceaux) => morceaux.map((texte, rang) => ({ texte, x: rang === 0 ? x : x + retrait })))
          .map((ligne, rang) => ({ ...ligne, rang }));
      if (colonnes === 1) {
        const posees = poserColonne(textes.lignes, L);
        if (posees === null) return null;
        const lignes = ranger(posees, (L - largeurColonne(posees)) / 2);
        return { lignes, rangees: lignes.length };
      }
      // La colonne de gauche reçoit ce que la droite, entière, lui laisse, et
      // jamais moins d'une demi-colonne ; la droite, ce que la gauche posée
      // lui laisse. Les deux tiennent ensemble par construction, et des
      // lignes entières qui tiennent ensemble passent telles quelles. Une
      // ligne et ses suites restent dans leur colonne.
      const rangees = Math.ceil(textes.lignes.length / 2);
      const gouttiere = corps * MM_PAR_PT;
      const demi = (L - gouttiere) / 2;
      const droiteEntiere = textes.lignes.slice(rangees);
      const largeurDroite = largeurColonne(droiteEntiere.map((ligne) => [ligne]));
      const gauche = poserColonne(textes.lignes.slice(0, rangees), L - gouttiere - Math.min(largeurDroite, demi));
      if (gauche === null) return null;
      const droite = poserColonne(droiteEntiere, L - gouttiere - largeurColonne(gauche));
      if (droite === null) return null;
      const x = (L - (largeurColonne(gauche) + gouttiere + largeurColonne(droite))) / 2;
      const lignesGauche = ranger(gauche, x);
      const lignesDroite = ranger(droite, x + largeurColonne(gauche) + gouttiere);
      return { lignes: [...lignesGauche, ...lignesDroite], rangees: Math.max(lignesGauche.length, lignesDroite.length) };
    }

    const pasPied = pasDe(corpsPied);
    const hautDuPied = H - pied.length * pasPied.hauteur;
    // Le flux du haut, jusqu'à l'organisation. Un nom laissé en blanc avance
    // le curseur de ses lignes sans en poser aucune.
    const blocs = [];
    let curseurNom = 0;
    const pasNom = pasDe(forme.corps);
    for (const texte of forme.lignes) {
      const y = curseurNom + pasNom.ascendante;
      if (!gros.enBlanc) blocs.push({ texte, corps: forme.corps, gras: true, x: centre(texte, forme.corps, true), y });
      curseurNom = y + pasNom.descendante;
    }
    // Les formes de l'organisation, chacune ses blocs et le curseur sous
    // elle : son corps de départ seul quand elle y tient sur une ligne,
    // sinon de son corps de départ à son plancher ; une forme seule, vide,
    // sans organisation. Aucune quand même son plancher ne se replie pas :
    // une grappe seule déborde. Laissée en blanc, elle avance le curseur de
    // ses lignes sans en poser aucune.
    const departOrganisation = auPlusNom(constante(typographie.organisation));
    const corpsOrganisation = sansOrganisation
      ? []
      : tient(petit.texte, departOrganisation, false)
        ? [departOrganisation]
        : paliers(departOrganisation, auPlusNom(constante('CORPS_ORGANISATION_PLANCHER_PT')));
    const formesOrganisation = sansOrganisation ? [{ blocs: [], curseur: curseurNom }] : [];
    for (const corps of corpsOrganisation) {
      const lignes = paragraphe(petit.texte, corps, L);
      if (lignes === null) continue;
      const pasOrganisation = pasDe(corps);
      const blocsOrganisation = [];
      let curseur = curseurNom;
      for (const texte of lignes) {
        const y = curseur + pasOrganisation.ascendante;
        if (!petit.enBlanc) blocsOrganisation.push({ texte, corps, gras: false, x: centre(texte, corps, false), y });
        curseur = y + pasOrganisation.descendante;
      }
      formesOrganisation.push({ blocs: blocsOrganisation, curseur });
    }
    if (formesOrganisation.length === 0) return null;
    const curseurLePlusHaut = Math.min(...formesOrganisation.map(({ curseur }) => curseur));
    // Les dispositions des tours, dans l'ordre de préférence : une colonne
    // du corps des tours au plancher, puis deux. Sous chacune, la première
    // forme de l'organisation qui laisse la place aux tours.
    const dispositions = [
      ...corpsTours.map((corps) => ({ colonnes: 1, corps })),
      ...corpsTours.map((corps) => ({ colonnes: 2, corps })),
    ];
    for (const disposition of dispositions) {
      const pasTours = pasDe(disposition.corps);
      // Une ligne par tour au moins : une disposition qui ne les tient pas
      // sous l'organisation la plus basse ne se compose pas. Une qui les
      // tient, une ligne chacun, dit que leur nombre n'est pas en cause.
      if (curseurLePlusHaut + Math.ceil(textes.lignes.length / disposition.colonnes) * pasTours.hauteur > hautDuPied + TOLERANCE_MM) {
        continue;
      }
      toursEnLignesTiennent = true;
      const tours = disposerTours(disposition);
      if (tours === null) continue;
      const hauteurTours = tours.rangees * pasTours.hauteur;
      const organisation = formesOrganisation.find(({ curseur }) => curseur + hauteurTours <= hautDuPied + TOLERANCE_MM);
      if (organisation === undefined) continue;
      const { curseur } = organisation;
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
      const finDesTours = curseur + hauteurTours;
      return {
        blocs: [...blocs, ...organisation.blocs, ...blocsTours, ...blocsPied],
        colonnesTours: disposition.colonnes,
        libre: hautDuPied - finDesTours,
        finDesTours,
        hautDesTours: curseur,
        debutTours: blocs.length + organisation.blocs.length,
        nombrePied: blocsPied.length,
      };
    }
    return null;
  }

  // Le repli du texte TechnoLibre au corps donné, à partir de son repli
  // glouton : tel quel, sauf quand sa dernière ligne porte un mot seul.
  // Alors, quand un mot est coupé, les lignes qui précèdent celle du
  // dernier morceau du dernier mot coupé restent celles du repli glouton,
  // et ce morceau compte pour un mot ; sans mot coupé, toutes les lignes se
  // répartissent. Les mots à répartir vont sur autant de lignes qu'il en
  // reste, chacune dans la largeur, la dernière de deux mots au moins, la
  // plus large ligne la plus étroite possible ; à largeur égale, la première
  // ligne la plus longue, les suivantes se répartissant de même entre elles
  // (leur plus large ligne la plus étroite possible, puis leur première ligne
  // la plus longue). Le repli glouton reste quand aucune découpe n'existe :
  // les deux derniers mots, le dernier morceau d'un mot coupé compris, ne
  // tiennent pas ensemble sur une ligne.
  function sansMotSeul(lignes, corps) {
    if (lignes.length < 2 || lignes.at(-1).includes(' ')) return lignes;
    // depart : la ligne qui porte le dernier morceau du dernier mot coupé,
    // sinon la première. Les lignes se lisent de la fin : tant que leurs
    // mots sont ceux de la fin du texte, aucun mot n'y est coupé. Un morceau
    // est plus court que le mot qu'il coupe, et n'est donc jamais égal au
    // mot de même rang.
    const entiers = promotion.texte.split(' ').filter((mot) => mot !== '');
    let depart = lignes.length - 1;
    for (let reste = entiers.length; depart > 0; depart -= 1) {
      const jetons = lignes[depart].split(' ');
      if (!jetons.every((jeton, rang) => jeton === entiers[reste - jetons.length + rang])) break;
      reste -= jetons.length;
    }
    const nombre = lignes.length - depart;
    const mots = lignes.slice(depart).join(' ').split(' ');
    const ligne = (debut, fin) => mots.slice(debut, fin).join(' ');
    // decoupes[k - 1][debut] : la meilleure découpe en k lignes des mots à
    // partir de debut, {pire, fin}, la plus large de ses lignes et la fin
    // de la première ; pire vaut Infinity sans découpe. Les largeurs
    // croissent avec les mots ajoutés : une ligne qui déborde arrête
    // l'allongement. La dernière ligne part de l'avant-dernier mot au plus
    // tard.
    const derniere = mots.map(() => ({ pire: Infinity, fin: mots.length }));
    for (let debut = mots.length - 2; debut >= 0; debut -= 1) {
      const texte = ligne(debut, mots.length);
      if (!tient(texte, corps, false)) break;
      derniere[debut] = { pire: largeur(texte, corps, false), fin: mots.length };
    }
    const decoupes = [derniere];
    for (let k = 2; k <= nombre; k += 1) {
      const suite = decoupes.at(-1);
      decoupes.push(
        mots.map((_, debut) => {
          let meilleure = { pire: Infinity, fin: -1 };
          for (let fin = debut + 1; fin < mots.length; fin += 1) {
            const premiere = ligne(debut, fin);
            if (!tient(premiere, corps, false)) break;
            const pire = Math.max(largeur(premiere, corps, false), suite[fin].pire);
            if (pire <= meilleure.pire) meilleure = { pire, fin };
          }
          return meilleure;
        }),
      );
    }
    if (decoupes.at(-1)[0].pire === Infinity) return lignes;
    const equilibrees = lignes.slice(0, depart);
    let debut = 0;
    for (let k = nombre; k >= 2; k -= 1) {
      const { fin } = decoupes[k - 1][debut];
      equilibrees.push(ligne(debut, fin));
      debut = fin;
    }
    equilibrees.push(ligne(debut, mots.length));
    return equilibrees;
  }

  // Les paliers du pied TechnoLibre demandé, du corps de départ au plancher,
  // ceux dont le texte se replie et dont le logo tient dans la largeur :
  // chacun {corps, lignes, hauteurLogo, largeurLogo, hauteurBloc}, le bloc
  // étant ses lignes puis son logo, les lignes celles du repli glouton, dont
  // poserTechnolibre retire le mot seul quand les deux derniers mots tiennent
  // ensemble sur une ligne (sansMotSeul). Aucun sans pied TechnoLibre demandé.
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
  // ses lignes repliées par sansMotSeul, le pied remonté de sa hauteur, le
  // logo posé sur le bas du cadre.
  function poserTechnolibre({ blocs, colonnesTours, nombrePied }, { corps, lignes, hauteurLogo, largeurLogo, hauteurBloc }) {
    const pasTexte = pas(corps);
    const debutPied = blocs.length - nombrePied;
    const remonte = blocs.slice(debutPied).map((bloc) => ({ ...bloc, y: bloc.y - hauteurBloc }));
    const hautDuBloc = H - hauteurBloc;
    const blocsTexte = sansMotSeul(lignes, corps).map((texte, rang) => ({
      texte,
      corps,
      gras: false,
      x: centre(texte, corps, false),
      y: hautDuBloc + rang * pasTexte.hauteur + pasTexte.ascendante,
    }));
    const logo = { x: (L - largeurLogo) / 2, y: H - hauteurLogo, largeur: largeurLogo, hauteur: hauteurLogo };
    return { blocs: [...blocs.slice(0, debutPied), ...remonte, ...blocsTexte], colonnesTours, technolibre: { corps, logo } };
  }

  // Le plus grand logo du participant demandé dans une zone de la hauteur
  // donnée, bornée aussi par la largeur du cadre, {largeur, hauteur} ; null
  // quand sa plus petite cote passe sous le plancher
  // (LOGO_PARTICIPANT_PLANCHER_MM).
  function tailleLogo(hauteurZone) {
    const { rapport } = logoDemande;
    const hauteur = Math.min(hauteurZone, L / rapport);
    const largeur = hauteur * rapport;
    return Math.min(largeur, hauteur) >= constante('LOGO_PARTICIPANT_PLANCHER_MM') - TOLERANCE_MM ? { largeur, hauteur } : null;
  }

  // L'image des badges demandée sur une page composée, dans la place donnée,
  // une part de l'écart libre : la plus grande boîte, au rapport reçu, sous
  // la hauteur maximale du modèle, dans la largeur du cadre et dans cette
  // place moins ses dégagements — un sous elle en haut, un de part et d'autre
  // au centre et en bas ; null quand sa plus petite cote n'atteint pas le
  // plancher. Rend la page où elle prend sa place : en haut, tout ce qui
  // précède le pied descend de sa hauteur et d'un dégagement, l'image au haut
  // du cadre ; au centre, les tours descendent de sa hauteur et de deux
  // dégagements, l'image sous le haut des tours d'avant, un dégagement plus
  // bas ; en bas, rien ne bouge, l'écart libre seul se réduit, l'image posée
  // ensuite au-dessus du pied.
  function avecImage(page, place) {
    const ecart = constante('LOGO_PARTICIPANT_ECART_MM');
    const { rapport, position } = imageDemandee;
    const degagements = position === 'haut' ? ecart : 2 * ecart;
    const hauteur = Math.min(constante(typographie.imageMax), place - degagements, L / rapport);
    const largeur = hauteur * rapport;
    if (Math.min(largeur, hauteur) < constante('LOGO_PARTICIPANT_PLANCHER_MM') - TOLERANCE_MM) return null;
    const descente = hauteur + degagements;
    const x = (L - largeur) / 2;
    const debutPied = page.blocs.length - page.nombrePied;
    const descendre = (debut) =>
      page.blocs.map((bloc, rang) => (rang >= debut && rang < debutPied ? { ...bloc, y: bloc.y + descente } : bloc));
    const reduite = { ...page, libre: page.libre - descente };
    if (position === 'haut') {
      return { page: { ...reduite, blocs: descendre(0), finDesTours: page.finDesTours + descente }, boite: { x, y: 0, largeur, hauteur } };
    }
    if (position === 'centre') {
      const boite = { x, y: page.hautDesTours + ecart, largeur, hauteur };
      return { page: { ...reduite, blocs: descendre(page.debutTours), finDesTours: page.finDesTours + descente }, boite };
    }
    return { page: reduite, boite: { x, y: null, largeur, hauteur } };
  }

  // Le partage d'un écart libre de la hauteur donnée entre le logo du
  // participant et le pied TechnoLibre, sans l'image des badges : {palier,
  // taille}, palier undefined quand le pied TechnoLibre se retire ou n'est
  // pas demandé, taille, {largeur, hauteur}, null quand le logo ne se pose
  // pas ou n'est pas demandé. Le logo passe avant : il se taille sous le pied
  // TechnoLibre à son plancher, puis le pied TechnoLibre reprend le plus
  // grand palier qu'il laisse ; quand même ainsi le logo n'atteint pas son
  // plancher, il se taille seul, le pied TechnoLibre retiré ; quand même seul
  // il ne l'atteint pas, il ne se pose pas, et le pied TechnoLibre prend le
  // plus grand palier qui tient dans l'écart.
  function partager(libre) {
    const ecart = constante('LOGO_PARTICIPANT_ECART_MM');
    const lesPaliers = paliersTechnolibre();
    const palierDans = (place) => lesPaliers.find(({ hauteurBloc }) => hauteurBloc <= place + TOLERANCE_MM);
    if (logoDemande !== null) {
      const plancherTechnolibre = lesPaliers.at(-1);
      if (plancherTechnolibre !== undefined) {
        const taille = tailleLogo(libre - plancherTechnolibre.hauteurBloc - 2 * ecart);
        if (taille !== null) return { palier: palierDans(libre - taille.hauteur - 2 * ecart) ?? plancherTechnolibre, taille };
      }
      const taille = tailleLogo(libre - 2 * ecart);
      if (taille !== null) return { palier: undefined, taille };
    }
    return { palier: palierDans(libre), taille: null };
  }

  // La page finale d'une page composée, dépouillée, serrée ou non. L'écart
  // libre entre ses tours et son pied se partage d'abord entre le logo du
  // participant et le pied TechnoLibre comme sur le badge sans image
  // (partager) ; l'image des badges prend ensuite ce qu'ils laissent, la
  // plus petite zone où le logo posé atteint son plancher réservée avec ses
  // deux dégagements, et le logo prend enfin tout ce que l'image laisse,
  // centré entre ses deux dégagements. L'image rapetisse donc puis se retire
  // la première, sans ôter au logo sa place ni rien au pied TechnoLibre. Sur
  // une page dépouillée ou serrée, aucun des trois ne se pose : ils suivent
  // dans l'ordre de sacrifice tous les textes, et l'écart que leur retrait
  // ou leur resserrement libère ne leur revient pas. Le texte ne change pas,
  // sinon par l'image, qui le fait descendre (avecImage), et par le bloc
  // TechnoLibre, qui remonte le pied de sa hauteur ; en bas, l'image remonte
  // avec le pied. Chaque élément demandé qui ne se pose pas rend sa marque de
  // retrait : technolibre {corps: null, logo: null}, logoParticipant et
  // imageBadges {boite: null} ; non demandé, il rend null.
  function finir(page, { depouillee, serree }) {
    const pose = !depouillee && !serree;
    const ecart = constante('LOGO_PARTICIPANT_ECART_MM');
    const { palier, taille } = pose ? partager(page.libre) : { palier: undefined, taille: null };
    const hauteurBloc = palier?.hauteurBloc ?? 0;
    // La plus petite zone où le logo atteint son plancher : la hauteur du
    // plancher, ou, pour un logo plus haut que large, celle qui donne le
    // plancher à sa largeur.
    const reserveLogo = taille === null ? 0 : constante('LOGO_PARTICIPANT_PLANCHER_MM') / Math.min(1, logoDemande.rapport) + 2 * ecart;
    const posee = pose && imageDemandee !== null ? avecImage(page, page.libre - hauteurBloc - reserveLogo) : null;
    const pageImage = posee?.page ?? page;
    const avecPied = palier === undefined ? pageImage : poserTechnolibre(pageImage, palier);
    const finale = {
      blocs: avecPied.blocs,
      colonnesTours: avecPied.colonnesTours,
      technolibre: promotion === null ? null : (avecPied.technolibre ?? { corps: null, logo: null }),
      logoParticipant: logoDemande === null ? null : { boite: null },
      imageBadges: imageDemandee === null ? null : { boite: null },
    };
    if (taille !== null) {
      // Sans l'image, la taille du partage ; sous elle, tout ce qu'elle
      // laisse, la plus petite zone du logo au moins.
      const zone = pageImage.libre - hauteurBloc - 2 * ecart;
      const { largeur, hauteur } = posee === null ? taille : tailleLogo(zone);
      const boite = { x: (L - largeur) / 2, y: pageImage.finDesTours + ecart + (zone - hauteur) / 2, largeur, hauteur };
      finale.logoParticipant = { boite };
    }
    if (posee !== null) {
      const { boite } = posee;
      const y = boite.y ?? pageImage.finDesTours + pageImage.libre - hauteurBloc + ecart;
      finale.imageBadges = { boite: { ...boite, y } };
    }
    return finale;
  }

  // Les essais, par niveau, du badge complet au plus dépouillé : le badge
  // entier, puis sans le nom de l'événement, puis sans l'organisation non
  // plus. Chaque niveau essaie d'abord le pas de la police, sous chaque forme
  // du nom pour le badge entier, du plus grand corps au plancher, sous le nom
  // au plancher seul pour les autres ; puis, le nom au plancher, ses lignes
  // au pas serré (pasSerre), de la police à l'encre en PALIERS_DU_PAS_SERRE
  // paliers ; puis, à l'encre, le pied d'un point par palier de son corps de
  // départ à son plancher (CORPS_PIED_PLANCHER_PT), date et horodatage
  // toujours entiers. Un texte ne part donc qu'une fois réduit tout ce qui se
  // réduit, hors le nom sous son plancher. Un nom au-delà de trois lignes a
  // déjà perdu le nom de l'événement : le badge entier ne s'essaie pas.
  const plancherNom = nom.formes.at(-1);
  const partsSerrees = Array.from({ length: PALIERS_DU_PAS_SERRE }, (_, rang) => (rang + 1) / PALIERS_DU_PAS_SERRE);
  const paliersPied = paliers(constante(typographie.pied), constante('CORPS_PIED_PLANCHER_PT'));
  const niveaux = [
    ...(nom.auDela ? [] : [{ formes: nom.formes, evenement: true, avecOrganisation: true }]),
    { formes: [plancherNom], evenement: false, avecOrganisation: true },
    { formes: [plancherNom], evenement: false, avecOrganisation: false },
  ];
  function* essais() {
    for (const { formes, ...niveau } of niveaux) {
      for (const forme of formes) yield { forme, ...niveau };
      for (const serre of partsSerrees) yield { forme: plancherNom, ...niveau, serre };
      for (const corpsPied of paliersPied.slice(1)) yield { forme: plancherNom, ...niveau, serre: 1, corpsPied };
    }
  }
  // Un pied égal au pied réduit, celui d'un badge dont une case retire le nom
  // de l'événement, ne perd rien en passant au pied réduit : le badge n'est
  // dépouillé que de l'organisation. Sans organisation, les essais qui la
  // retirent composent les mêmes pages que ceux du niveau précédent, et ne
  // sont donc jamais ceux qui aboutissent.
  const sansNomEvenement =
    textes.pied.length === textes.piedReduit.length && textes.pied.every((ligne, rang) => ligne === textes.piedReduit[rang]);
  // Le dernier recours, quand même le badge le plus dépouillé, serré, le
  // pied à son plancher, ne tient pas : le nom sous son plancher, d'un point
  // par palier, replié chaque fois sur le moins de lignes qui tient, jusqu'à
  // son plancher de dernier recours (HAUTEUR_CAPITALE_NOM_DERNIER_RECOURS_MM).
  // Ce plancher ne passe jamais sous celui des tours : le nom plafonne leur
  // corps, et ils gardent le leur. Le badge reste serré, le pied à son
  // plancher, dépouillé de l'organisation et du nom de l'événement, donc du
  // logo et du pied TechnoLibre. Au pas serré, la gouttière entre deux
  // colonnes et le retrait d'une suite gardent leur cadratin : la gouttière
  // seule sépare deux colonnes de lignes inégales, le retrait seul dit
  // qu'une ligne continue la précédente.
  function* derniersRecours() {
    const reglage = { evenement: false, avecOrganisation: false, serre: 1, corpsPied: paliersPied.at(-1) };
    const corpsNomDernier = Math.max(
      constante('HAUTEUR_CAPITALE_NOM_DERNIER_RECOURS_MM') / capitaleParPt,
      constante('CORPS_TOURS_PLANCHER_PT'),
    );
    for (const corps of paliers(corpsNomPlancher, corpsNomDernier).slice(1)) {
      const lignes = replier(gros.texte, corps, true, Infinity, true) ?? replier(gros.texte, corps, true, Infinity, false);
      if (lignes !== null) yield { forme: { corps, lignes }, ...reglage };
    }
  }
  function* tousLesEssais() {
    yield* essais();
    yield* derniersRecours();
  }
  for (const { forme, ...niveau } of tousLesEssais()) {
    const page = composer(forme, niveau);
    if (page === null) continue;
    const depouillee = !niveau.avecOrganisation || (!niveau.evenement && !sansNomEvenement);
    return finir(page, { depouillee, serree: niveau.serre > 0 });
  }
  if (nom.auDela) return refusNom;
  return { refus: { code: 'PLANCHE_TROP_DE_TOURS', details: { tours: textes.lignes.length, repliees: toursEnLignesTiennent } } };
}
