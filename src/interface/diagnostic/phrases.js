// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les énoncés du diagnostic (§ 5.6) : ce que la configuration rend
// inévitable, combien, et ce qui le rendrait évitable. Chaque énoncé est
// {cle, details, remede}, que l'écran traduit ; ses détails sont les
// chiffres du diagnostic tels que le moteur les rend — aucun ne se calcule
// ici —, plus le numéro affiché d'une table, que donne numeroDe, et le
// nombre de tours de l'événement, une donnée de la charge.
//
// remede : null, quand l'énoncé ne dit qu'une absence ; {cle, details}, le
// texte de ce qui lèverait l'inévitable ; {cle, details, commande,
// arguments} quand une commande le réalise sans rien détruire, exécutable
// telle quelle par seance.executer, comme le remède d'un refus. Retirer des
// tours détruit les réservations d'un tour retiré : le remède en tours reste
// un texte.
//
// L'ordre est celui du § 5.6 — collisions et excédent, redondance,
// animateurs, ancrage, écart d'itinéraire, manque de places, objectifs hors
// d'atteinte —, précédé de ce qui vide la séparation de son sens (§ 15.4,
// § 7.5) et suivi du plafond a priori (§ 5.5) et des retours imposés
// (§ 5.4). Un plancher ne s'énonce que strictement positif : un plancher nul
// laisserait croire qu'un plancher a été calculé là où il n'y en a pas.
//
// La présence par tour : quand une personne au moins manque un tour,
// l'énoncé des planchers retirés, sans remède, suit les collisions et
// ouvre ce qui concerne tout l'événement — une seule carte de l'événement,
// que cartesDiagnostic garde d'un tenant ; le moteur tait alors le
// plancher de l'écart d'itinéraire. Le manque de places s'énonce tour par
// tour quand il varie d'un tour à l'autre, et à chaque tour sinon.
//
// Les planchers des objectifs (A10, D16) se calculent toujours ; l'énoncé
// n'écrit que ceux des valeurs que le mode réglé compare, lues dans l'état
// du critère des tours hors objectif (les valeurs de valeursQuiClassent,
// telles qu'evaluer les rend), dans l'ordre où le classement les compare.
// Un critère décoché ou sans objet ne compare rien : ses planchers se
// taisent.
import { evaluer } from '../../application/evaluation.js';

// Désactiver la séparation : le seul remède que réalise une commande. Un
// objet neuf à chaque appel.
const separer = () => ({
  cle: 'diagnostic.remede.separation',
  details: {},
  commande: 'modifierReglage',
  arguments: { cle: 'separerAppartenances', valeur: false },
});

// Un remède neuf de la clé donnée.
const remede = (cle, details = {}) => ({ cle, details });

// La séparation des appartenances vidée de son sens : une seule
// appartenance, ou une collision forcée à chaque table de chaque tour.
function separation({ uneSeuleAppartenance, collisionPartout }) {
  const liste = [];
  if (uneSeuleAppartenance) liste.push({ cle: 'diagnostic.uneSeuleAppartenance', details: {}, remede: separer() });
  if (collisionPartout) liste.push({ cle: 'diagnostic.collisionPartout', details: {}, remede: separer() });
  return liste;
}

// Les tables à ajouter que rend le moteur, ou, quand aucune ne suffit, la
// redistribution de l'appartenance.
const remedeCollisions = ({ tablesManquantes }) =>
  tablesManquantes === null ? remede('diagnostic.remede.redistribuer') : remede('diagnostic.remede.tables', { tablesManquantes });

// Chaque groupe en collision : son plancher de collisions cumulées et de
// paires distinctes, puis son excédent quand il est strictement positif.
function collisions(diagnostic, tours) {
  return diagnostic.collisions.flatMap((ligne) => {
    const { groupe, effectif, plancherCumulees, plancherPairesDistinctes, plancherExcedent } = ligne;
    const liste = [
      {
        cle: 'diagnostic.collisions',
        details: { groupe, effectif, plancherCumulees, plancherPairesDistinctes, tours },
        remede: remedeCollisions(ligne),
      },
    ];
    if (plancherExcedent !== null) {
      liste.push({ cle: 'diagnostic.excedent', details: { groupe, plancherExcedent }, remede: remedeCollisions(ligne) });
    }
    return liste;
  });
}

// La redondance minimale, quand elle est positive, et le nombre de tours qui
// l'annule ; sans lui, ce qui la fait tenir.
function redondance({ redondanceMinimale, remedes }, tours) {
  if (redondanceMinimale === null || redondanceMinimale === 0) return [];
  const { toursSansRedondance } = remedes;
  return [
    {
      cle: 'diagnostic.redondance',
      details: { redondanceMinimale },
      remede:
        toursSansRedondance === null
          ? remede('diagnostic.remede.appartenances')
          : remede('diagnostic.remede.tours', { toursSansRedondance, tours }),
    },
  ];
}

// Les animateurs d'une même appartenance, quand ils imposent au moins une
// redondance.
function animateurs({ animateursMemeAppartenance, redondanceImposeeParAnimateurs }) {
  if (!animateursMemeAppartenance || redondanceImposeeParAnimateurs === 0) return [];
  return [
    {
      cle: 'diagnostic.animateurs',
      details: { redondanceImposeeParAnimateurs },
      remede: remede('diagnostic.remede.animateurs'),
    },
  ];
}

// Chaque table gelée ou à moitié ancrée, dans l'ordre du diagnostic,
// désignée par son numéro affiché.
function ancrage(diagnostic, numeroDe) {
  return diagnostic.ancrage
    .filter(({ gelee, moitie }) => gelee || moitie)
    .map(({ table, ancres, capacite, gelee }) => ({
      cle: gelee ? 'diagnostic.ancrage.gelee' : 'diagnostic.ancrage.moitie',
      details: { numero: numeroDe(table), ancres, capacite },
      remede: remede('diagnostic.remede.ancrage'),
    }));
}

// Le plancher de l'écart d'itinéraire maximal, là où le moteur le prouve.
function ecartItineraire({ ecartItineraire: ecart }) {
  if (ecart === null) return [];
  return [
    {
      cle: 'diagnostic.ecartItineraire',
      details: { plancher: ecart.plancher, mobilesAuMoins: ecart.mobilesAuMoins },
      remede: remede('diagnostic.remede.ecartItineraire'),
    },
  ];
}

// Le manque de places, quand il est positif : le plus grand d'un tour, et,
// quand il varie d'un tour à l'autre, celui de chaque tour où il est
// positif, sous tours.
function placesManquantes({ placesManquantes: manquantes, placesManquantesParTour: parTour }) {
  if (manquantes === 0) return [];
  const details = { placesManquantes: manquantes };
  if (parTour.some((manque) => manque !== parTour[0])) {
    details.tours = parTour.flatMap((manque, r) => (manque > 0 ? [{ tour: r + 1, manque }] : []));
  }
  return [{ cle: 'diagnostic.placesManquantes', details, remede: remede('diagnostic.remede.places') }];
}

// Les planchers que la présence retire, quand absentes personnes non
// exclues manquent un tour au moins.
const planchersRetires = (absentes) =>
  absentes > 0 ? [{ cle: 'diagnostic.planchersRetires', details: { absentes }, remede: null }] : [];

// Le nom du critère des objectifs dans l'état des critères, et, pour chaque
// valeur qu'il peut comparer, le champ de objectifsInevitables qui en donne
// le plancher.
const CRITERE_DES_OBJECTIFS = 'toursHorsObjectif';
const PLANCHERS_DES_OBJECTIFS = new Map([
  ['toursHorsObjectif', 'horsObjectif'],
  ['jamaisServies', 'jamaisServies'],
  ['horsObjectifMax', 'horsObjectifMax'],
]);

// Vrai quand un plancher des objectifs au moins est strictement positif.
const unPlancherDesObjectifs = ({ objectifsInevitables }) =>
  [...PLANCHERS_DES_OBJECTIFS.values()].some((champ) => objectifsInevitables[champ] > 0);

// Le plancher de chaque valeur que le critère des objectifs compare, quand
// il est strictement positif, dans l'ordre de ses valeurs ; rien quand le
// critère manque à criteres, est décoché ou sans objet. grandeur nomme la
// valeur, que l'écran pose en data-plancher-objectifs.
function objectifs({ objectifsInevitables }, criteres) {
  const etat = criteres.find(({ nom }) => nom === CRITERE_DES_OBJECTIFS);
  if (etat === undefined || !etat.coche || etat.sansObjet) return [];
  return etat.valeurs.flatMap((grandeur) => {
    if (!PLANCHERS_DES_OBJECTIFS.has(grandeur)) throw new RangeError(`valeur des objectifs inconnue : ${JSON.stringify(grandeur)}`);
    const plancher = objectifsInevitables[PLANCHERS_DES_OBJECTIFS.get(grandeur)];
    if (plancher === 0) return [];
    return [{ cle: `diagnostic.objectifs.${grandeur}`, details: { plancher }, remede: remede('diagnostic.remede.objectifs'), grandeur }];
  });
}

/**
 * L'état des critères que l'énoncé des objectifs lit (§ 5.3, D10, D20) :
 * celui qu'evaluer rend, sur la charge sans ses placements — aucune
 * proposition ne se mesure pour le lire. Quand aucun plancher des objectifs
 * n'est positif, il n'y a rien à lire : la liste vide, sans évaluation.
 * Ne modifie pas la charge.
 *
 * @param {Object} charge
 * @param {Object} diagnostic   celui de diagnostiquerCharge pour cette charge
 * @returns {Array<{nom: string, coche: boolean, sansObjet: boolean, valeurs: string[]}>}
 */
export function criteresDuDiagnostic(charge, diagnostic) {
  if (!unPlancherDesObjectifs(diagnostic)) return [];
  return evaluer({ ...charge, propositions: [], retenu: null }, { plafondsAPriori: null }).criteres;
}

// Le plafond a priori, une ligne par valeur de la répartition ; une
// population vide n'en a aucun, et l'énoncé le dit par le tiret.
function plafond({ plafondAPriori }) {
  if (plafondAPriori.repartition.length === 0) return [{ cle: 'diagnostic.plafondInconnu', details: {}, remede: null }];
  return plafondAPriori.repartition.map(({ valeur, ancres, mobiles }) => ({
    cle: 'diagnostic.plafond',
    details: { valeur, ancres, mobiles },
    remede: remede('diagnostic.remede.plafond'),
  }));
}

// Les retours que les réservations imposent, à part des retours choisis.
function imposes({ retoursImposes, ancragesImposantRetours }) {
  if (retoursImposes === 0) return [];
  return [
    {
      cle: 'diagnostic.imposes',
      details: { retoursImposes, ancragesImposantRetours },
      remede: remede('diagnostic.remede.imposes'),
    },
  ];
}

/**
 * Les énoncés d'un diagnostic, dans l'ordre décrit en tête. Ne modifie pas
 * le diagnostic.
 *
 * @param {Object} diagnostic   celui que rend diagnostiquerCharge
 * @param {{numeroDe: (table: number) => number, tours: number,
 *          criteres?: Array<{nom: string, coche: boolean, sansObjet: boolean, valeurs: string[]}>,
 *          absentes?: number}} options
 *        numeroDe : le numéro affiché d'un identifiant de table ; tours : le
 *        nombre de tours de l'événement ; criteres : l'état des critères
 *        (criteresDuDiagnostic), vide par défaut, et aucun plancher des
 *        objectifs ne s'écrit alors ; absentes : le nombre de personnes non
 *        exclues qui manquent un tour (presencesPartielles), 0 par défaut
 * @returns {Array<{cle: string, details: Object, remede: null|{cle: string, details: Object,
 *           commande?: string, arguments?: Object}, grandeur?: string}>}
 */
export function enonces(diagnostic, { numeroDe, tours, criteres = [], absentes = 0 }) {
  return [
    ...separation(diagnostic),
    ...collisions(diagnostic, tours),
    ...planchersRetires(absentes),
    ...redondance(diagnostic, tours),
    ...animateurs(diagnostic),
    ...ancrage(diagnostic, numeroDe),
    ...ecartItineraire(diagnostic),
    ...placesManquantes(diagnostic),
    ...objectifs(diagnostic, criteres),
    ...plafond(diagnostic),
    ...imposes(diagnostic),
  ];
}

/**
 * Le numéro affiché de chaque table de la charge, par identifiant.
 *
 * @param {{tables: Array<{id: number, numero: number}>}} charge
 * @returns {(table: number) => number}  lève RangeError pour un identifiant
 *          que la charge n'a pas
 */
export function numeroDeCharge(charge) {
  const numeros = new Map(charge.tables.map(({ id, numero }) => [id, numero]));
  return (table) => {
    const numero = numeros.get(table);
    if (numero === undefined) throw new RangeError(`table inconnue : ${JSON.stringify(table)}`);
    return numero;
  };
}

// Les énoncés de la séparation vidée de son sens, que porte la carte de la
// séparation.
const CLES_SEPARATION = new Set(['diagnostic.uneSeuleAppartenance', 'diagnostic.collisionPartout']);

// Le genre et le groupe de la carte d'un énoncé.
function carteDe({ cle, details }) {
  if (details.groupe !== undefined) return { genre: 'appartenance', groupe: details.groupe };
  return { genre: CLES_SEPARATION.has(cle) ? 'separation' : 'ensemble', groupe: null };
}

/**
 * Les cartes du diagnostic (§ 5.6) : les énoncés regroupés, sans en changer
 * l'ordre, par suites d'énoncés voisins de même carte — la séparation vidée
 * de son sens ('separation'), une appartenance, celle de details.groupe
 * ('appartenance'), ou le reste de l'événement ('ensemble'). Dans l'ordre
 * d'enonces, la séparation vient d'abord, puis une carte par appartenance
 * en collision — ses collisions et son excédent —, puis l'événement : les
 * cartes mises bout à bout redonnent la liste reçue, énoncé pour énoncé, les
 * mêmes objets. Ne modifie pas la liste.
 *
 * @param {Array<{cle: string, details: Object}>} liste  celle que rend enonces
 * @returns {Array<{genre: 'separation'|'appartenance'|'ensemble', groupe: string|null,
 *           enonces: Array<Object>}>}
 */
export function cartesDiagnostic(liste) {
  const cartes = [];
  for (const enonce of liste) {
    const { genre, groupe } = carteDe(enonce);
    const derniere = cartes.at(-1);
    if (derniere !== undefined && derniere.genre === genre && derniere.groupe === groupe) derniere.enonces.push(enonce);
    else cartes.push({ genre, groupe, enonces: [enonce] });
  }
  return cartes;
}
