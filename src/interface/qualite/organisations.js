// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle pur des vues des collisions d'organisation (§ 12.4, B13, D31)
// et des organisations à chaque table (§ 12.11, B20, D35) :
// VueCollisions.svelte et VueTables.svelte le câblent. Il met en forme ce
// que le détail du placement porte, dans l'ordre où il le porte, et ne
// trie, ne réduit ni ne recompte rien (contrainte 41) : chaque nombre rendu
// est un champ du détail, chaque pourcentage un entier qu'il porte déjà,
// écrit par la seule clé du signe, qualite.pourcentage.valeur, et suivi du
// compte de sa ligne.
//
// Chaque modèle rend son cas — le dessin, ou la phrase qui en tient lieu —,
// le code du cas, que la vue pose sur sa phrase (data-phrase-qualite), et
// les données de ses composants de graphique : Barres et Grille reçoivent
// leurs lignes, leurs valeurs et leur infobulle, Jumeau ses tableaux.
import { POSITIONS_MELANGE } from '../etat_ui.js';

/**
 * Vrai quand aucune organisation ne compte de collision : chaque ligne des
 * collisions a zéro collision cumulée (§ 12.6, B15).
 * @param {{collisions: {lignes: Array<{cumulees: number}>}}} detail
 * @returns {boolean}
 */
export function sansCollision(detail) {
  return detail.collisions.lignes.every(({ cumulees }) => cumulees === 0);
}

// Un cas sans dessin : sa phrase, ni graphique ni jumeau.
const phraseSeule = (cas, code, phrase) => ({ cas, code, phrase, graphique: null, tableaux: [] });

/**
 * La vue des collisions d'organisation (§ 12.4, B13, D31). Une seule
 * table, aucune organisation, aucune collision : la phrase de son cas,
 * dans cet ordre. Sinon des barres, une ligne par organisation dans l'ordre
 * du détail — l'excédent décroissant —, chacune intitulée de l'organisation,
 * sa pastille de la teinte que teintes lui donne, ses deux segments,
 * prouvé inévitable et reste, puis en encre secondaire son effectif, ses
 * paires distinctes et son excédent. Hors du domaine des planchers, chaque
 * barre n'a qu'un segment, les collisions cumulées, et la phrase dit
 * pourquoi. Le jumeau, et l'infobulle de chaque barre, portent la ligne de
 * l'organisation : tous ses chiffres, prouvé et reste sur le domaine
 * seulement.
 *
 * @param {Object} detail   le détail du placement (detaillerQualite), comparable
 * @param {{t: Function, teintes: Map<string, number|null>}} contexte
 *        t, la traduction ; teintes, teintesOrganisations des participants
 *        de l'événement, exclus compris
 * @returns {{cas: 'uneTable'|'aucuneOrganisation'|'aucune'|'barres',
 *   code: string, phrase: string|null,
 *   graphique: {nom, synthese, segments, lignes, infobulle}|null,
 *   tableaux: Array<{nom, colonnes, lignes}>}}
 */
export function modeleCollisions(detail, { t, teintes }) {
  if (detail.T === 1) return phraseSeule('uneTable', 'collisionsUneTable', t('qualite.collisions.uneTable'));
  if (detail.G === 0) {
    return phraseSeule('aucuneOrganisation', 'collisionsAucuneOrganisation', t('qualite.collisions.aucuneOrganisation'));
  }
  if (sansCollision(detail)) return phraseSeule('aucune', 'collisionsAucune', t('qualite.collisions.aucune'));

  const { planchersValides, lignes } = detail.collisions;
  const colonne = (cle, genre = 'nombre') => ({ cle, libelle: t(`qualite.collisions.colonne.${cle}`), genre });
  const colonnes = [
    colonne('organisation', 'texte'),
    colonne('effectif'),
    colonne('cumulees'),
    ...(planchersValides ? [colonne('prouve'), colonne('reste')] : []),
    colonne('pairesDistinctes'),
    colonne('excedent'),
  ];
  const lignesJumeau = lignes.map(({ groupe, effectif, cumulees, prouve, reste, pairesDistinctes, excedent }) => ({
    organisation: groupe,
    effectif,
    cumulees,
    ...(planchersValides ? { prouve, reste } : {}),
    pairesDistinctes,
    excedent,
  }));
  const segments = planchersValides
    ? [
        { genre: 'prouve', libelle: t('qualite.collisions.segment.prouve') },
        { genre: 'reste', libelle: t('qualite.collisions.segment.reste') },
      ]
    : [{ genre: 'serie1', libelle: t('qualite.collisions.axe') }];
  const pire = lignes[0];
  return {
    cas: 'barres',
    code: planchersValides ? 'collisions' : 'collisionsHorsDomaine',
    phrase: planchersValides ? null : t('qualite.collisions.horsDomaine'),
    graphique: {
      nom: t('qualite.collisions.graphique'),
      synthese: t('qualite.collisions.synthese', { organisation: pire.groupe, excedent: pire.excedent }),
      segments,
      lignes: lignes.map(({ groupe, effectif, cumulees, prouve, reste, pairesDistinctes, excedent }) => ({
        id: groupe,
        nom: groupe,
        organisation: teintes.get(groupe) ?? null,
        valeurs: planchersValides ? [prouve, reste] : [cumulees],
        secondaire: t('qualite.collisions.secondaire', { effectif, paires: pairesDistinctes, excedent }),
      })),
      infobulle: { colonnes, lignes: lignesJumeau },
    },
    tableaux: [{ nom: t('qualite.collisions.graphique'), colonnes, lignes: lignesJumeau }],
  };
}

/** La plus grande case de la grille des tables, en hauteurs de ligne du
 *  compte qu'elle écrit (coteMaxTextes de Grille) : la case suit la taille
 *  du texte mesurée, et deux tours ne remplissent pas la carte de cases de
 *  plusieurs centaines de pixels. */
export const CASE_MAX_TEXTES = 2;

// Le nom de la colonne du pourcentage de chaque position, au jumeau.
const COLONNE_POURCENT = Object.freeze({ sieges: 'pourcentSieges', assis: 'pourcentAssis', doublons: 'pourcentDoublons' });

// Le pourcentage d'une case sous une position, pour Pourcentage : l'entier
// du détail suivi du signe, ou null pour « — », et le compte de sa ligne —
// δ organisations pour c sièges, o assis ou α affiliés. Une case sans
// affilié n'a ni pourcentage ni compte : elle le dit.
function pourcentDe(t, cellule, position, capacite) {
  if (cellule === null) return { texte: null, compte: t('qualite.tables.sansAffilie') };
  const pourcent = cellule.pourcents[position];
  return {
    texte: pourcent === null ? null : t('qualite.pourcentage.valeur', { pourcent }),
    compte: t(`qualite.tables.ligne.${position}`, {
      organisations: cellule.organisations,
      sieges: capacite,
      assis: cellule.occupants,
      affilies: cellule.affilies,
    }),
  };
}

// Les lignes du tableau des tables dans l'ordre de la position : pour
// chacune, son index dans le détail, sa ligne et son intitulé.
function rangees(detail, position, t) {
  return detail.tables.ordres[position].map((i) => ({
    ligne: detail.tables.lignes[i],
    libelle: t('qualite.tables.table', { numero: detail.numerosTables[i] }),
  }));
}

// Le jumeau de la grille : une ligne par table et par tour, dans l'ordre
// de la position, les trois comptes et leurs trois pourcentages, chacun
// suivi du compte de sa ligne, puis occupants, affiliés et capacité.
function jumeauTables(detail, position, t) {
  const colonne = (cle, genre = 'nombre') => ({ cle, libelle: t(`qualite.tables.colonne.${cle}`), genre });
  const colonnes = [colonne('table', 'texte'), colonne('tour', 'texte')];
  for (const p of POSITIONS_MELANGE) colonnes.push(colonne(p), colonne(COLONNE_POURCENT[p], 'pourcentage'));
  colonnes.push(colonne('occupants'), colonne('affilies'), colonne('capacite'));
  const lignes = [];
  for (const { ligne, libelle } of rangees(detail, position, t)) {
    ligne.tours.forEach((cellule, r) => {
      const valeurs = { table: libelle, tour: t('qualite.tables.tour', { tour: r + 1 }) };
      for (const p of POSITIONS_MELANGE) {
        valeurs[p] = cellule === null ? null : cellule.comptes[p];
        valeurs[COLONNE_POURCENT[p]] = pourcentDe(t, cellule, p, ligne.capacite);
      }
      lignes.push({
        ...valeurs,
        occupants: cellule?.occupants ?? null,
        affilies: cellule?.affilies ?? null,
        capacite: ligne.capacite,
      });
    });
  }
  return [{ nom: t('qualite.tables.graphique'), colonnes, lignes }];
}

/**
 * La vue des organisations à chaque table sous une position du sélecteur
 * (§ 12.11, B20, D35). Une seule table, aucune organisation : la phrase de
 * son cas sous les trois positions, sans sélecteur. Sous « doublons », sans
 * collision : la phrase de la vue des collisions, le sélecteur et le
 * jumeau restant. Sinon la grille, une ligne par table dans l'ordre de la
 * position — la pire en tête, une table sans affilié en dernier —, une
 * colonne par tour, chaque case le compte de la position, null pour une
 * case sans affilié ; son infobulle, une ligne par case dans l'ordre de la
 * grille : la table, le tour, le compte, son pourcentage suivi de ses deux
 * comptes, les occupants, les affiliés, la capacité. Le jumeau porte les
 * trois comptes de chaque table à chaque tour, dans l'ordre de la position.
 * La synthèse nomme la pire table et sa case la plus haute sous la
 * position, puis le nombre de cases de la grille à ce compte, que le détail
 * porte (casesAuPire).
 *
 * Lève RangeError sur une position hors de POSITIONS_MELANGE.
 *
 * @param {Object} detail   le détail du placement (detaillerQualite), comparable
 * @param {'sieges'|'assis'|'doublons'} position
 * @param {{t: Function}} contexte
 * @returns {{cas: 'uneTable'|'aucuneOrganisation'|'sansCollision'|'grille',
 *   code: string, phrase: string|null, selecteur: boolean,
 *   grille: {nom, synthese, phrase, lignes, colonnes, valeurs, infobulle}|null,
 *   tableaux: Array<{nom, colonnes, lignes}>}}
 */
export function modeleTables(detail, position, { t }) {
  if (!POSITIONS_MELANGE.includes(position)) {
    throw new RangeError(`mélange des tables : position hors de ${POSITIONS_MELANGE.join(', ')}, reçu ${String(position)}`);
  }
  const sansSelecteur = (cas, code, cle) => ({ cas, code, phrase: t(cle), selecteur: false, grille: null, tableaux: [] });
  if (detail.T === 1) return sansSelecteur('uneTable', 'tablesUneTable', 'qualite.tables.uneTable');
  if (detail.G === 0) return sansSelecteur('aucuneOrganisation', 'tablesAucuneOrganisation', 'qualite.tables.aucuneOrganisation');

  const tableaux = jumeauTables(detail, position, t);
  if (position === 'doublons' && sansCollision(detail)) {
    const phrase = t('qualite.collisions.aucune');
    return { cas: 'sansCollision', code: 'tablesSansCollision', phrase, selecteur: true, grille: null, tableaux };
  }

  const lignes = rangees(detail, position, t);
  const colonneInfobulle = (cle, cleLibelle, genre = 'nombre') => ({ cle, libelle: t(cleLibelle), genre });
  const infobulle = {
    colonnes: [
      colonneInfobulle('table', 'qualite.tables.colonne.table', 'texte'),
      colonneInfobulle('tour', 'qualite.tables.colonne.tour', 'texte'),
      colonneInfobulle('compte', `qualite.tables.colonne.${position}`),
      colonneInfobulle('pourcent', `qualite.tables.colonne.${COLONNE_POURCENT[position]}`, 'pourcentage'),
      colonneInfobulle('occupants', 'qualite.tables.colonne.occupants'),
      colonneInfobulle('affilies', 'qualite.tables.colonne.affilies'),
      colonneInfobulle('capacite', 'qualite.tables.colonne.capacite'),
    ],
    lignes: lignes.flatMap(({ ligne, libelle }) =>
      ligne.tours.map((cellule, r) => ({
        table: libelle,
        tour: t('qualite.tables.tour', { tour: r + 1 }),
        compte: cellule === null ? null : cellule.comptes[position],
        pourcent: pourcentDe(t, cellule, position, ligne.capacite),
        occupants: cellule?.occupants ?? null,
        affilies: cellule?.affilies ?? null,
        capacite: ligne.capacite,
      })),
    ),
  };
  const [tete] = lignes;
  const tetes = detail.tables.ordres[position];
  return {
    cas: 'grille',
    code: 'tables',
    phrase: null,
    selecteur: true,
    grille: {
      nom: t('qualite.tables.graphique'),
      synthese:
        tete.ligne.pire === null
          ? t('qualite.tables.aucuneOrganisation')
          : t('qualite.tables.synthese', {
              numero: detail.numerosTables[tetes[0]],
              valeur: tete.ligne.pire[position],
              cases: detail.tables.casesAuPire[position],
            }),
      phrase: t('qualite.tables.tropLarge'),
      lignes: lignes.map(({ libelle }) => ({ libelle })),
      colonnes: Array.from({ length: detail.R }, (_, r) => ({ libelle: t('qualite.tables.tour', { tour: r + 1 }) })),
      valeurs: lignes.flatMap(({ ligne }) => ligne.tours.map((cellule) => (cellule === null ? null : cellule.comptes[position]))),
      infobulle,
    },
    tableaux,
  };
}
