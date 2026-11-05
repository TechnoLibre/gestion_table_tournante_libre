// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle de la vue des objectifs des tables (§ 12.12, B21, D34, D36,
// D52), pur : VueObjectifs.svelte le rend. Il met en forme les objectifs du
// détail d'un placement (detaillerQualite) dans l'ordre où le détail les
// porte, sans rien trier, sommer ni recompter : chaque pourcentage est
// l'entier du détail, chaque somme de la soirée est celle du détail.
//
// L'ordre des barres est le seul que la vue décide : le tour de pireTour —
// au plus grand reste, que le moteur désigne — en tête, à place fixe, puis
// les autres dans leur ordre. Aucune barre pour la soirée : elle s'écrit en
// texte, et pas du tout à un seul tour, que sa ligne dit déjà. Aucune
// couleur ne désigne un tour : une ligne ne porte pas de pastille.
//
// Une barre porte les tours hors objectif du tour en deux segments, le
// plancher du tour, prouvé inévitable, et le reste, tous deux lus au détail
// tels que le moteur les rend (B21) — la garde à quatre paramètres refuse un
// reste négatif avant tout dessin. Hors du domaine des planchers — un plan
// qui laisse quelqu'un en réserve —, la barre n'a qu'un segment, les tours
// hors objectif, et ni le plancher ni le reste ne s'écrivent (§ 12.4), pas
// même dans la phrase de synthèse.
// Un tour sans couple possible n'a ni barre ni pourcentage : « — », puis ses
// assis sans table possible, que chaque ligne écrit.

// La clé de traduction d'un segment, par son genre.
const SEGMENTS_DANS_LE_DOMAINE = [
  ['prouve', 'qualite.objectifs.segment.prouve'],
  ['reste', 'qualite.objectifs.segment.reste'],
];
const SEGMENT_HORS_DU_DOMAINE = ['serie1', 'qualite.objectifs.segment.hors'];

// Les colonnes du jumeau par tour, dans l'ordre : la première est
// l'en-tête de sa ligne.
const COLONNES_PAR_TOUR = [
  ['tour', 'texte'],
  ['possibles', 'nombre'],
  ['servis', 'nombre'],
  ['pourcent', 'pourcentage'],
  ['hors', 'nombre'],
  ['plancher', 'nombre'],
  ['assis', 'nombre'],
];

// Les colonnes {cle, libelle, genre} d'un jumeau, chacune sous la clé
// qualite.objectifs.colonne.<cle>.
const colonnesDe = (t, liste) => liste.map(([cle, genre]) => ({ cle, libelle: t(`qualite.objectifs.colonne.${cle}`), genre }));

/**
 * Le modèle de la vue des objectifs, ou ce qui la remplace.
 *
 * - null sans détail mesuré ;
 * - {cas: 'aucunConcerne'} sans personne concernée par les objectifs : la
 *   vue cède la place à sa phrase ;
 * - sinon {cas: 'objectifs', neClassePas, planchersValides, jamaisServies,
 *   soiree, barres, tours, infobulle, jumeau} :
 *   neClassePas, le critère des objectifs décoché ou sans objet ;
 *   planchersValides, le domaine des planchers du détail ;
 *   jamaisServies, [{id, nom, possibles}], possibles déjà écrit ;
 *   soiree, null à un seul tour, sinon {pourcentage: {texte, compte},
 *   comptes, hors} — la part des tours possibles servis, suivie des
 *   personnes jamais servies, puis ses servis sur ses possibles, ses tours
 *   hors objectif et leur plancher ;
 *   barres, {nom, synthese, segments, lignes} pour Barres, synthese le tour
 *   de tête, son reste puis ses tours hors objectif — ses tours hors
 *   objectif seuls hors du domaine —, une ligne {id, nom, valeurs,
 *   secondaire} par tour, id le numéro du tour, secondaire ses assis sans
 *   table possible ;
 *   tours, {tour, nom, pourcentage: {texte, compte}} dans l'ordre des
 *   barres, le pourcentage du tour suivi de ses deux comptes ;
 *   infobulle, {colonnes, lignes}, la ligne du jumeau de chaque barre ;
 *   jumeau, les tableaux de Jumeau : par tour puis la soirée, les personnes
 *   jamais servies quand il y en a, la répartition des tours hors objectif
 *   d'une personne.
 *
 * Tout texte vient de t ; ne modifie pas le détail.
 *
 * @param {Object|null} detail   le détail du placement (detaillerQualite)
 * @param {(cle: string, details?: Object) => string} t
 * @param {Array<string|null>} [nomsTours]   les noms des tours de
 *        l'événement (nomsDesTours), qui nomment les tours
 */
export function modeleObjectifs(detail, t, nomsTours = undefined) {
  if (detail === null) return null;
  const { objectifs, personnes, R } = detail;
  if (objectifs === null) return { cas: 'aucunConcerne' };
  const planchersValides = detail.collisions.planchersValides;
  const { critere, parTour, pireTour, soiree, repartition } = objectifs;

  const nomDe = new Map(personnes.map(({ id, nom }) => [id, nom]));
  const jamaisServies = objectifs.jamaisServies.map(({ id, possibles }) => ({
    id,
    nom: nomDe.get(id),
    possibles: t('qualite.objectifs.toursPossibles', { possibles }),
  }));

  // Les indices des tours, celui de tête d'abord, les autres dans leur ordre.
  const ordre = [pireTour, ...parTour.map((_, r) => r).filter((r) => r !== pireTour)];

  const segments = (planchersValides ? SEGMENTS_DANS_LE_DOMAINE : [SEGMENT_HORS_DU_DOMAINE]).map(([genre, cle]) => ({
    genre,
    libelle: t(cle),
  }));
  const pourcentageDe = (pourcent) => (pourcent === null ? null : t('qualite.pourcentage.valeur', { pourcent }));

  const tours = [];
  const lignes = [];
  const rangees = [];
  for (const r of ordre) {
    const { possibles, servis, pourcent, hors, plancher, reste, sansCouple } = parTour[r];
    const tour = r + 1;
    const nom = t('qualite.objectifs.tour', { tour, nomsTours });
    const sansCoupleAuTour = possibles === 0;
    let valeurs;
    if (sansCoupleAuTour) valeurs = segments.map(() => 0);
    else valeurs = planchersValides ? [plancher, reste] : [hors];
    lignes.push({
      id: tour,
      nom,
      valeurs,
      secondaire: t(sansCoupleAuTour ? 'qualite.objectifs.secondaireSansCouple' : 'qualite.objectifs.assisSansTable', {
        assis: sansCouple,
      }),
    });
    const pourcentage = {
      texte: pourcentageDe(pourcent),
      compte: sansCoupleAuTour ? t('qualite.objectifs.sansCouple') : t('qualite.objectifs.comptes', { servis, possibles }),
    };
    tours.push({ tour, nom, pourcentage });
    rangees.push({ tour: nom, possibles, servis, pourcent: pourcentage, hors, plancher: planchersValides ? plancher : null, assis: sansCouple });
  }

  const colonnes = colonnesDe(t, COLONNES_PAR_TOUR);
  const unTour = R === 1;
  const jumeau = [
    {
      nom: t('qualite.objectifs.jumeau.tours'),
      colonnes,
      lignes: unTour
        ? rangees
        : [
            ...rangees,
            {
              tour: t('qualite.objectifs.soiree'),
              possibles: soiree.possibles,
              servis: soiree.servis,
              pourcent: { texte: pourcentageDe(soiree.pourcent), compte: t('qualite.objectifs.comptes', soiree) },
              hors: soiree.hors,
              plancher: planchersValides ? soiree.plancher : null,
              assis: null,
            },
          ],
    },
  ];
  if (jamaisServies.length > 0) {
    jumeau.push({
      nom: t('qualite.objectifs.jamaisServies'),
      colonnes: [
        { cle: 'nom', libelle: t('qualite.objectifs.colonne.personne'), genre: 'texte' },
        { cle: 'possibles', libelle: t('qualite.objectifs.colonne.toursPossibles'), genre: 'nombre' },
      ],
      lignes: objectifs.jamaisServies.map(({ id, possibles }) => ({ nom: nomDe.get(id), possibles })),
    });
  }
  jumeau.push({
    nom: t('qualite.objectifs.repartition.titre'),
    colonnes: [
      { cle: 'valeur', libelle: t('qualite.objectifs.repartition.valeur'), genre: 'nombre' },
      { cle: 'effectif', libelle: t('qualite.objectifs.repartition.effectif'), genre: 'nombre' },
    ],
    lignes: repartition.map(({ valeur, effectif }) => ({ valeur, effectif })),
  });

  return {
    cas: 'objectifs',
    neClassePas: !critere.coche || critere.sansObjet,
    planchersValides,
    jamaisServies,
    soiree: unTour
      ? null
      : {
          pourcentage: {
            texte: t('qualite.pourcentage.servis', { pourcent: soiree.pourcent }),
            compte: t('qualite.objectifs.pire', { personnes: detail.bornes.soiree.jamaisServies }),
          },
          comptes: t('qualite.objectifs.comptes', soiree),
          hors: planchersValides
            ? t('qualite.objectifs.horsObjectif', { hors: soiree.hors, plancher: soiree.plancher })
            : t('qualite.objectifs.hors', { hors: soiree.hors }),
        },
    barres: {
      nom: t('qualite.objectifs.graphique'),
      synthese: planchersValides
        ? t('qualite.objectifs.synthese', { tour: pireTour + 1, reste: parTour[pireTour].reste, hors: parTour[pireTour].hors, nomsTours })
        : t('qualite.objectifs.syntheseHorsDomaine', { tour: pireTour + 1, hors: parTour[pireTour].hors, nomsTours }),
      segments,
      lignes,
    },
    tours,
    infobulle: { colonnes, lignes: rangees },
    jumeau,
  };
}
