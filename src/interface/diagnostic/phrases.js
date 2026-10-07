// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
// animateurs, ancrage, écart d'itinéraire, manque de places —, précédé de ce
// qui vide la séparation de son sens (§ 15.4, § 7.5) et suivi du plafond a
// priori (§ 5.5) et des retours imposés (§ 5.4). Un plancher ne s'énonce que
// strictement positif : un plancher nul laisserait croire qu'un plancher a
// été calculé là où il n'y en a pas.

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

// Le manque de places, quand il est positif.
function placesManquantes({ placesManquantes: manquantes }) {
  if (manquantes === 0) return [];
  return [{ cle: 'diagnostic.placesManquantes', details: { placesManquantes: manquantes }, remede: remede('diagnostic.remede.places') }];
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
 * @param {{numeroDe: (table: number) => number, tours: number}} options
 *        numeroDe : le numéro affiché d'un identifiant de table ; tours : le
 *        nombre de tours de l'événement
 * @returns {Array<{cle: string, details: Object, remede: null|{cle: string, details: Object,
 *           commande?: string, arguments?: Object}}>}
 */
export function enonces(diagnostic, { numeroDe, tours }) {
  return [
    ...separation(diagnostic),
    ...collisions(diagnostic, tours),
    ...redondance(diagnostic, tours),
    ...animateurs(diagnostic),
    ...ancrage(diagnostic, numeroDe),
    ...ecartItineraire(diagnostic),
    ...placesManquantes(diagnostic),
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
