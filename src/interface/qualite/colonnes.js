// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle des colonnes côte à côte de la vue de comparaison (§ 12.10.6,
// § 12.8, D57, D67, D84, C20, C29), pur : ColonnesComparaison.svelte le
// câble.
//
// Deux colonnes, une par placement, portent les mêmes chiffres dans le même
// ordre : chaque ligne nomme un chiffre et porte une cellule par côté. En
// tête, ceux de la question de la vue — la place au classement, le minimum
// brut, le plus grand manque, l'effectif du manque, l'écart d'itinéraire
// maximal — ; puis, sous les groupes du tableau des propositions, chaque
// autre tuile de l'en-tête chiffré, « ne classe pas » compris pour une
// colonne que le tableau ne porte pas (groupesDeTuiles, entete.js).
//
// Chaque cellule de mesure s'écrit par celluleDeTuile, la fonction de la
// tuile, sur la ligne d'évaluation de son placement (lue dans la table) et
// sur les bornes de son côté de la comparaison : la même valeur, les mêmes
// bornes, les mêmes lignes secondaires, le même plancher, le même
// pourcentage suivi du même compte du pire que la tuile de ce placement.
// Rien ne se compte ni ne se divise ici (contrainte 41) : un pourcentage est
// l'entier que comparerPlacements porte, celui du pire cas de son placement,
// jamais une moyenne, et trois cellules seulement en portent un
// (TUILES_A_POURCENTAGE). L'ordre des lignes est fixe : aucune ne dépend des
// valeurs, aucun écart n'est écrit, aucune cellule n'est mise en avant
// (§ 12.8).
//
// Une comparaison ne porte ni la borne de diversité ni celle des
// animateurs : leurs cellules écrivent la valeur et le plancher, sans
// ligne de borne. Seule exception, commune aux deux côtés : quand aucune
// personne présente ne porte d'organisation — le diagnostic de la table
// n'a alors pas de redondance minimale (null), comme le détail n'a pas de
// borne de diversité —, la cellule de la diversité reçoit cette borne
// nulle et écrit la phrase de sa tuile.
import { texteFiliation } from '../propositions/filiation.js';
import { celluleDeTuile, enTeteDeTuile, groupesDeTuiles } from './entete.js';

/** Les lignes de la tête des colonnes, dans leur ordre : la place au
 *  classement, puis les chiffres de mesure que la vue met en tête. */
export const TETE_DES_COLONNES = Object.freeze(['rang', 'rencontresTous', 'manqueMax', 'effectifManque', 'ecartItineraireMax']);

/**
 * @typedef {Object} Cellule
 * @property {string} texte     la valeur, écrite comme au tableau
 * @property {string[]} bornes  les lignes de la borne, puis celle des lignes
 *           secondaires d'un agrégat, le plancher en dernier
 * @property {{texte: string|null, compte: string}|null} pourcentage
 *           comme sur la tuile : null hors des trois tuiles qui en portent
 *
 * @typedef {Object} Ligne
 * @property {string} nom       le nom de la colonne du tableau, ou 'rang'
 * @property {string} libelle   traduit : celui de la tuile
 * @property {string|null} neClassePas  la mention, null quand elle classe
 * @property {Cellule} a
 * @property {Cellule} b
 */

// La ligne d'évaluation du côté de clé cle, lue dans la table.
function ligneDuCote(table, cle) {
  const ligne = cle === 'retenu' ? table.retenu : (table.propositions.find(({ id }) => id === cle) ?? null);
  if (ligne === null || ligne.statut !== 'comparable') {
    throw new RangeError(`colonnesComparaison : ${JSON.stringify(cle)} n'a pas de ligne comparable`);
  }
  return ligne;
}

// La cellule de la place au classement : le rang, ou « — » pour un retenu
// ajusté, qui ne se classe pas et le dit.
function celluleDuRang({ rang, ajuste }, { t, format }) {
  return {
    texte: rang === null ? t('format.vide') : format.nombre(rang),
    bornes: ajuste ? [t('qualite.colonnes.rangRetenu')] : [],
    pourcentage: null,
  };
}

// La clé qui dit d'où vient un retenu : tel que sa proposition, ajusté aux
// seuls participants, ou retouché à la main.
function cleOrigine({ ajuste, retouche }) {
  if (retouche) return 'propositions.retenu.ajuste';
  return ajuste ? 'propositions.retenu.presence' : 'propositions.retenu.origine';
}

// L'en-tête d'une colonne : le nom de son placement, sous les clés qui le
// nomment dans le tracé et les phrases de la vue, la proposition d'où vient
// un retenu, et la filiation d'une dérivée.
function placementDe(cote, table, outils) {
  const { t } = outils;
  const retenu = cote.cle === 'retenu';
  return {
    nom: retenu ? t('qualite.comparaison.nom.retenu') : t('qualite.comparaison.nom.proposition', { proposition: cote.cle }),
    origine: retenu ? t(cleOrigine(cote), { proposition: table.retenu.id }) : null,
    filiation: texteFiliation(cote.derivation, outils),
  };
}

/**
 * Les colonnes côte à côte d'une comparaison de deux placements.
 *
 * @param {import('../../application/evaluation.js').ComparaisonPlacements} comparaison
 *        comparerPlacements(charge, table, a, b)
 * @param {import('../../application/evaluation.js').TableEvaluation} table
 *        la table d'évaluation d'où la comparaison se lit
 * @param {{t: Function, format: {nombre: Function}, nomDe: (id: number) => string,
 *          nomsTours?: Array<string|null>}} outils
 *        nomDe(id) : le nom affiché de la personne id ; nomsTours : les noms
 *        des tours de l'événement, que la filiation lit (texteFiliation)
 * @returns {{placements: {a: {nom: string, origine: string|null, filiation: string|null},
 *   b: {nom: string, origine: string|null, filiation: string|null}},
 *   tete: Ligne[], groupes: Array<{cle: string, libelle: string, lignes: Ligne[]}>}}
 *   placements : l'en-tête de chaque colonne ; tete : les lignes de
 *   TETE_DES_COLONNES ; groupes : ceux de groupesDeTuiles, chacun de ses
 *   tuiles hors de la tête, un groupe vide omis
 * @throws {RangeError} un côté dont la table n'a pas de ligne comparable
 */
export function colonnesComparaison(comparaison, table, outils) {
  const { t, format, nomDe } = outils;
  const cotes = { a: comparaison.a, b: comparaison.b };
  const lignes = { a: ligneDuCote(table, cotes.a.cle), b: ligneDuCote(table, cotes.b.cle) };
  // Sans organisation présente, la borne de diversité est nulle des deux
  // côtés, comme dans le détail ; sinon elle reste absente.
  const sansOrganisation = table.diagnostic.redondanceMinimale === null;
  const bornesDuCote = (cote) => (sansOrganisation ? { ...cotes[cote].bornes, diversite: null } : cotes[cote].bornes);
  const cellule = (nom, cote) => celluleDeTuile(nom, { bornes: bornesDuCote(cote), ligne: lignes[cote], table, t, format, nomDe });
  const ligneDe = ({ nom, classe }) => {
    const { libelle, neClassePas } = enTeteDeTuile(nom, classe, t);
    return { nom, libelle, neClassePas, a: cellule(nom, 'a'), b: cellule(nom, 'b') };
  };

  const groupes = groupesDeTuiles(table, [lignes.a, lignes.b], t);
  const tuiles = new Map(groupes.flatMap(({ tuiles: deGroupe }) => deGroupe.map((tuile) => [tuile.nom, tuile])));
  const [, ...mesures] = TETE_DES_COLONNES;
  return {
    placements: { a: placementDe(cotes.a, table, outils), b: placementDe(cotes.b, table, outils) },
    tete: [
      {
        nom: 'rang',
        libelle: t('propositions.colonne.rang'),
        neClassePas: null,
        a: celluleDuRang(cotes.a, outils),
        b: celluleDuRang(cotes.b, outils),
      },
      ...mesures.map((nom) => ligneDe(tuiles.get(nom))),
    ],
    groupes: groupes
      .map(({ cle, libelle, tuiles: deGroupe }) => ({
        cle,
        libelle,
        lignes: deGroupe.filter(({ nom }) => !TETE_DES_COLONNES.includes(nom)).map(ligneDe),
      }))
      .filter(({ lignes: deGroupe }) => deGroupe.length > 0),
  };
}
