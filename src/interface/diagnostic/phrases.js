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
// Les planchers des conflits en étoile (planchers_conflits.js) ne sont pas
// des champs du diagnostic : l'écran les calcule par l'application et les
// passe à enonces, qui en pose un énoncé par étoile, après les collisions de
// chaque groupe ; leurs chiffres sont ceux que l'application rend.
//
// Les planchers exacts du solveur (planchers_exacts.js), que le travailleur
// calcule après coup, arrivent de même, assemblés, ou null tant qu'ils
// manquent. Quand aucun plan sans conflit n'existe, l'énoncé de
// l'impossibilité nomme les tours sans issue — hors de ceux que des
// réservations en conflit imposent, que l'énoncé des conflits imposés dit
// déjà —, et les étoiles se taisent : leur promesse « tant qu'aucun conflit
// ne se produit » est vide. Sinon, le plancher exact des collisions
// cumulées s'énonce quand il dépasse la somme des planchers par groupe
// renforcée par les étoiles : exact, ou « au moins » quand un tour a
// atteint sa limite de temps. Sans gain, il n'apprend rien et se tait.
//
// L'ordre est celui du § 5.6 — collisions et excédent, conflits en étoile
// ou leur impossibilité, plancher exact, redondance, animateurs, ancrage,
// écart d'itinéraire, manque de places,
// objectifs hors d'atteinte —, précédé de ce qui vide la séparation de son
// sens (§ 15.4, § 7.5) et suivi du plafond a priori (§ 5.5), des retours
// imposés (§ 5.4) et des conflits d'organisation que les réservations
// imposent. Un plancher ne s'énonce que strictement positif : un plancher nul
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
import { plancherCollisionsTotal } from '../../application/planchers_conflits.js';

// Désactiver la séparation : le seul remède que réalise une commande. Un
// objet neuf à chaque appel.
const separer = () => ({
  cle: 'diagnostic.remede.separation',
  details: {},
  commande: 'modifierReglage',
  arguments: { cle: 'separerOrganisations', valeur: false },
});

// Un remède neuf de la clé donnée.
const remede = (cle, details = {}) => ({ cle, details });

// La séparation des organisations vidée de son sens : une seule
// organisation, ou une collision forcée à chaque table de chaque tour.
function separation({ uneSeuleOrganisation, collisionPartout }) {
  const liste = [];
  if (uneSeuleOrganisation) liste.push({ cle: 'diagnostic.uneSeuleOrganisation', details: {}, remede: separer() });
  if (collisionPartout) liste.push({ cle: 'diagnostic.collisionPartout', details: {}, remede: separer() });
  return liste;
}

// Les tables à ajouter que rend le moteur, ou, quand aucune ne suffit, la
// redistribution de l'organisation.
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

// Chaque étoile de conflits d'organisation : ses organisations, centre en
// tête, son plancher de collisions cumulées et celui de chaque tour, son
// gain sur les planchers par groupe, et le nombre de tours. Les listes sont
// neuves : l'énoncé ne partage rien avec ce qu'il reçoit.
const conflitsEtoile = (conflits, tours) =>
  conflits.map(({ organisations, plancherCumulees, parTour, gain }) => ({
    cle: 'diagnostic.conflitsEtoile',
    details: { organisations: [...organisations], plancherCumulees, parTour: [...parTour], gain, tours },
    remede: remede('diagnostic.remede.conflitsEtoile'),
  }));

// L'impossibilité de tout plan sans conflit, que le solveur prouve : les
// tours sans issue hors réservations, sans énoncé quand il n'y en a aucun.
function conflitsInevitables({ toursSansIssue }) {
  if (toursSansIssue.length === 0) return [];
  return [
    {
      cle: 'diagnostic.conflitsInevitables',
      details: { toursSansIssue: [...toursSansIssue] },
      remede: remede('diagnostic.remede.conflitsInevitables'),
    },
  ];
}

// Le plancher exact des collisions cumulées des plans sans conflit, quand il
// dépasse la somme des planchers par groupe renforcée par les étoiles :
// exact, ou « au moins » avec les tours arrêtés à leur limite. Le plancher
// d'un tour est son minimum, sinon sa borne, sinon 0, comme dans la somme.
function collisionsExactes(diagnostic, etoiles, exacts, tours) {
  const { plancherCumulees, exact, parTour, toursALimite } = exacts;
  if (plancherCumulees === null || plancherCumulees <= plancherCollisionsTotal(diagnostic.collisions, etoiles)) return [];
  const details = { plancher: plancherCumulees, tours, parTour: parTour.map(({ minimum, auMoins }) => minimum ?? auMoins ?? 0) };
  return [
    exact
      ? { cle: 'diagnostic.collisionsExactes', details, remede: remede('diagnostic.remede.collisionsExactes') }
      : {
          cle: 'diagnostic.collisionsAuMoins',
          details: { ...details, toursALimite: [...toursALimite] },
          remede: remede('diagnostic.remede.collisionsExactes'),
        },
  ];
}

// Les énoncés des conflits et des planchers exacts : sans planchers exacts,
// les étoiles ; quand aucun plan sans conflit n'existe, l'impossibilité à
// leur place ; sinon les étoiles, puis le plancher exact quand il apprend
// quelque chose.
function conflitsEtExacts(diagnostic, conflits, exacts, tours) {
  if (exacts === null) return conflitsEtoile(conflits, tours);
  if (exacts.sansConflit === false) return conflitsInevitables(exacts);
  return [...conflitsEtoile(conflits, tours), ...collisionsExactes(diagnostic, conflits, exacts, tours)];
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
          ? remede('diagnostic.remede.organisations')
          : remede('diagnostic.remede.tours', { toursSansRedondance, tours }),
    },
  ];
}

// Les animateurs d'une même organisation, quand ils imposent au moins une
// redondance.
function animateurs({ animateursMemeOrganisation, redondanceImposeeParAnimateurs }) {
  if (!animateursMemeOrganisation || redondanceImposeeParAnimateurs === 0) return [];
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

// Les conflits d'organisation que les réservations imposent : des personnes
// en conflit réservées à une même table d'un tour, qu'aucune recherche ne
// sépare.
function conflitsImposes({ conflitsImposes: conflits }) {
  if (conflits === 0) return [];
  return [{ cle: 'diagnostic.conflitsImposes', details: { conflits }, remede: remede('diagnostic.remede.conflitsImposes') }];
}

/**
 * Les énoncés d'un diagnostic, dans l'ordre décrit en tête. Ne modifie pas
 * le diagnostic.
 *
 * @param {Object} diagnostic   celui que rend diagnostiquerCharge
 * @param {{numeroDe: (table: number) => number, tours: number,
 *          criteres?: Array<{nom: string, coche: boolean, sansObjet: boolean, valeurs: string[]}>,
 *          absentes?: number,
 *          conflits?: Array<{organisations: string[], plancherCumulees: number, parTour: number[], gain: number}>,
 *          exacts?: import('../../application/planchers_exacts.js').PlanchersExacts|null}} options
 *        numeroDe : le numéro affiché d'un identifiant de table ; tours : le
 *        nombre de tours de l'événement ; criteres : l'état des critères
 *        (criteresDuDiagnostic), vide par défaut, et aucun plancher des
 *        objectifs ne s'écrit alors ; absentes : le nombre de personnes non
 *        exclues qui manquent un tour (presencesPartielles), 0 par défaut ;
 *        conflits : les planchers des conflits en étoile (planchersConflits),
 *        aucun par défaut ; exacts : les planchers exacts du solveur
 *        (assemblerPlanchers), null par défaut, tant qu'ils manquent
 * @returns {Array<{cle: string, details: Object, remede: null|{cle: string, details: Object,
 *           commande?: string, arguments?: Object}, grandeur?: string}>}
 */
export function enonces(diagnostic, { numeroDe, tours, criteres = [], absentes = 0, conflits = [], exacts = null }) {
  return [
    ...separation(diagnostic),
    ...collisions(diagnostic, tours),
    ...conflitsEtExacts(diagnostic, conflits, exacts, tours),
    ...planchersRetires(absentes),
    ...redondance(diagnostic, tours),
    ...animateurs(diagnostic),
    ...ancrage(diagnostic, numeroDe),
    ...ecartItineraire(diagnostic),
    ...placesManquantes(diagnostic),
    ...objectifs(diagnostic, criteres),
    ...plafond(diagnostic),
    ...imposes(diagnostic),
    ...conflitsImposes(diagnostic),
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
const CLES_SEPARATION = new Set(['diagnostic.uneSeuleOrganisation', 'diagnostic.collisionPartout']);

// Les énoncés que porte la carte des organisations en conflit.
const CLES_CONFLITS = new Set(['diagnostic.conflitsEtoile', 'diagnostic.conflitsInevitables']);

// Le genre et le groupe de la carte d'un énoncé.
function carteDe({ cle, details }) {
  if (details.groupe !== undefined) return { genre: 'organisation', groupe: details.groupe };
  if (CLES_CONFLITS.has(cle)) return { genre: 'conflits', groupe: null };
  return { genre: CLES_SEPARATION.has(cle) ? 'separation' : 'ensemble', groupe: null };
}

/**
 * Les cartes du diagnostic (§ 5.6) : les énoncés regroupés, sans en changer
 * l'ordre, par suites d'énoncés voisins de même carte — la séparation vidée
 * de son sens ('separation'), une organisation, celle de details.groupe
 * ('organisation'), les conflits en étoile ou leur impossibilité
 * ('conflits'), ou le reste de l'événement ('ensemble'), que le plancher
 * exact ouvre quand il s'énonce. Dans l'ordre d'enonces, la séparation vient
 * d'abord, puis une carte par organisation en collision — ses collisions et
 * son excédent —, puis une carte des conflits, puis l'événement : les
 * cartes mises bout à bout redonnent la liste reçue, énoncé pour énoncé, les
 * mêmes objets. Ne modifie pas la liste.
 *
 * @param {Array<{cle: string, details: Object}>} liste  celle que rend enonces
 * @returns {Array<{genre: 'separation'|'organisation'|'conflits'|'ensemble', groupe: string|null,
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

// --- Les explications : « Concrètement » et « Pour changer cela » ------------
//
// Sous chaque énoncé, la section dit ce qu'il signifie avec les chiffres de
// l'événement, et, quand un geste le change, ce geste. Une explication ne
// lit que les chiffres de l'énoncé et ceux que le diagnostic porte déjà :
// les capacités de son ancrage, les présents de chaque tour, le nombre de
// tours. Elle ne refait aucun calcul du moteur et n'en invente aucun ; une
// soustraction ou une somme de ces chiffres reste dans la phrase qui la
// nomme. Une phrase qui ne se chiffrerait pas honnêtement se tait : une
// formule ne s'écrit que quand le chiffre de l'énoncé l'égale.

// Les remèdes qui disent un constat, non un geste : la section ne les fait
// pas précéder de « Pour changer cela ».
const REMEDES_CONSTATS = new Set([
  'diagnostic.remede.organisations',
  'diagnostic.remede.ecartItineraire',
  'diagnostic.remede.plafond',
  'diagnostic.remede.imposes',
]);

/**
 * Vrai quand le remède dit un geste qui change l'énoncé ; faux pour un
 * constat — ce qu'aucune relance ne change, ce que les réservations
 * veulent — et pour l'absence de remède.
 *
 * @param {null|{cle: string}} remede
 * @returns {boolean}
 */
export const remedeAgit = (remede) => remede !== null && !REMEDES_CONSTATS.has(remede.cle);

// Une phrase neuve de la clé donnée.
const phrase = (cle, details = {}) => ({ cle, details });

// Les grandeurs de l'événement que lisent plusieurs explications : le
// nombre de places, la capacité commune des tables (null quand elles
// diffèrent ou qu'il n'y en a aucune), les présents de chaque tour, et les
// places vides de chaque tour, que seul un tour où quelqu'un est présent
// compte.
function grandeurs(diagnostic) {
  const capacites = diagnostic.ancrage.map(({ capacite }) => capacite);
  const places = capacites.reduce((somme, capacite) => somme + capacite, 0);
  const commune = capacites.length > 0 && capacites.every((capacite) => capacite === capacites[0]) ? capacites[0] : null;
  const presents = diagnostic.presence.presentsParTour;
  const vides = presents.map((n) => (n > 0 ? Math.max(0, places - n) : 0));
  return { places, commune, presents, vides, absences: diagnostic.presence.absences };
}

// Les places vides : le même nombre à chaque tour, avec les présents et les
// places ; sinon le plus grand d'un tour. Rien quand aucune ne reste vide.
function placesVides({ places, presents, vides }) {
  const plus = Math.max(0, ...vides);
  if (plus === 0) return [];
  if (vides.every((n) => n === vides[0])) {
    return [phrase('diagnostic.concretement.placesVides', { placesVides: plus, places, presents: presents[0] })];
  }
  return [phrase('diagnostic.concretement.placesVidesSelonTour', { placesVides: plus })];
}

// Le plafond a priori d'une ligne de la répartition. Une valeur égale à
// N − 1, N les personnes de l'événement, se dit « toutes les autres » :
// seule la population la borne. Sa formule par la table ne s'écrit que si
// la valeur égale tours × (capacité − 1) sur des tables toutes de même
// capacité : chaque tour en ajoute alors capacité − 1, présence comprise.
// Ailleurs, sans absence, la valeur reste sous N − 1 par les capacités et
// l'ancrage, et la phrase le dit. Sous absence, elle peut aussi venir des
// seules personnes présentes aux tours de chacun, que le diagnostic ne
// donne pas par ligne : la phrase nomme les deux bornes sans trancher. Le
// geste — des tables plus grandes, un tour de plus — ne s'écrit que sous
// la formule par la table, sans absence, quand il reste des personnes à
// rencontrer. La première ligne porte aussi les places vides : le plafond
// se compte sur des tables pleines.
function explicationPlafond({ valeur, ancres: ancresDeLaLigne }, diagnostic, tours, g) {
  const tous = valeur === diagnostic.plafondAPriori.parPersonne.length - 1;
  const parLaTable = g.commune !== null && valeur === tours * (g.commune - 1);
  const ancres = ancresDeLaLigne > 0;
  let premiere;
  if (tous) premiere = phrase('diagnostic.concretement.plafond.tous', { valeur });
  else if (parLaTable) premiere = phrase('diagnostic.concretement.plafond.tables', { capacite: g.commune, parTour: g.commune - 1, valeur, tours });
  else if (g.absences > 0) premiere = phrase('diagnostic.concretement.plafond.presence', { valeur, ancres });
  else premiere = phrase('diagnostic.concretement.plafond.capacites', { valeur, tours, ancres });
  const vides = valeur === diagnostic.plafondAPriori.repartition[0].valeur ? placesVides(g) : [];
  const levier = !tous && parLaTable && g.absences === 0 ? phrase('diagnostic.levier.plafond') : null;
  return { concretement: [premiere, ...vides], levier };
}

// Les retours imposés : quand chacune des personnes qui en portent revient
// tours − 1 fois, chacune reste à sa table à chaque tour, et la phrase le
// dit ; sinon, le compte seul.
function explicationImposes({ retoursImposes, ancragesImposantRetours: personnes }, tours) {
  if (tours > 1 && retoursImposes === personnes * (tours - 1)) {
    return phrase('diagnostic.concretement.imposes.ancres', { personnes, tours, retours: tours - 1 });
  }
  return phrase('diagnostic.concretement.imposes', { personnes, retoursImposes });
}

// La phrase « Concrètement » d'un énoncé autre que le plafond, par sa clé.
const CONCRETEMENT = new Map([
  ['diagnostic.uneSeuleOrganisation', () => phrase('diagnostic.concretement.uneSeuleOrganisation')],
  ['diagnostic.collisionPartout', (_, { tours }) => phrase('diagnostic.concretement.collisionPartout', { tours })],
  [
    'diagnostic.collisions',
    ({ details }, { diagnostic }) => {
      const { groupe, ...chiffres } = details;
      const ligne = diagnostic.collisions.find((candidate) => candidate.groupe === groupe);
      return phrase('diagnostic.concretement.collisions', { ...chiffres, parReservations: ligne.tablesManquantes === null });
    },
  ],
  ['diagnostic.excedent', ({ details }) => phrase('diagnostic.concretement.excedent', { plancherExcedent: details.plancherExcedent })],
  // parGroupe : le plancher que le diagnostic prouve pour ces organisations
  // une à une, sans le conflit ; le gain s'y ajoute.
  [
    'diagnostic.conflitsEtoile',
    ({ details: { organisations, plancherCumulees, gain } }) =>
      phrase('diagnostic.concretement.conflitsEtoile', { organisations: [...organisations], parGroupe: plancherCumulees - gain, gain }),
  ],
  ['diagnostic.conflitsInevitables', ({ details }) => phrase('diagnostic.concretement.conflitsInevitables', { toursSansIssue: [...details.toursSansIssue] })],
  ['diagnostic.collisionsExactes', () => phrase('diagnostic.concretement.collisionsExactes')],
  [
    'diagnostic.collisionsAuMoins',
    ({ details }) => phrase('diagnostic.concretement.collisionsAuMoins', { toursALimite: [...details.toursALimite] }),
  ],
  [
    'diagnostic.planchersRetires',
    (_, { g }) => phrase('diagnostic.concretement.planchersRetires', { moins: Math.min(...g.presents), plus: Math.max(...g.presents) }),
  ],
  ['diagnostic.redondance', ({ details }) => phrase('diagnostic.concretement.redondance', { ...details })],
  [
    'diagnostic.animateurs',
    ({ details }) =>
      phrase('diagnostic.concretement.animateurs', {
        redondances: details.redondanceImposeeParAnimateurs,
        tables: details.redondanceImposeeParAnimateurs + 1,
      }),
  ],
  [
    'diagnostic.ancrage.gelee',
    ({ details: { numero, capacite } }, { tours }) =>
      phrase('diagnostic.concretement.ancrage.gelee', { numero, capacite, autres: capacite - 1, tours }),
  ],
  [
    'diagnostic.ancrage.moitie',
    ({ details: { numero, ancres, capacite } }) =>
      phrase('diagnostic.concretement.ancrage.moitie', { numero, ancres, capacite, libres: capacite - ancres }),
  ],
  ['diagnostic.ecartItineraire', ({ details }) => phrase('diagnostic.concretement.ecartItineraire', { ...details })],
  [
    'diagnostic.placesManquantes',
    ({ details }, { g }) =>
      phrase('diagnostic.concretement.placesManquantes', {
        places: g.places,
        presents: Math.max(...g.presents),
        varie: details.tours !== undefined,
      }),
  ],
  ['diagnostic.objectifs.toursHorsObjectif', ({ details }) => phrase('diagnostic.concretement.objectifs.toursHorsObjectif', { ...details })],
  ['diagnostic.objectifs.jamaisServies', ({ details }) => phrase('diagnostic.concretement.objectifs.jamaisServies', { ...details })],
  ['diagnostic.objectifs.horsObjectifMax', ({ details }) => phrase('diagnostic.concretement.objectifs.horsObjectifMax', { ...details })],
  ['diagnostic.plafondInconnu', () => phrase('diagnostic.concretement.plafondInconnu')],
  ['diagnostic.imposes', ({ details }, { tours }) => explicationImposes(details, tours)],
  ['diagnostic.conflitsImposes', ({ details }) => phrase('diagnostic.concretement.conflitsImposes', { ...details })],
]);

/**
 * L'explication d'un énoncé (§ 5.6) : concretement, les phrases
 * « Concrètement », dans l'ordre où elles se lisent ; levier, la phrase
 * « Pour changer cela » propre à l'énoncé, null quand son remède dit déjà
 * le geste ou qu'aucun geste ne le change. Chaque phrase est {cle, details},
 * que l'écran traduit. Ne modifie ni l'énoncé ni le diagnostic.
 *
 * @param {{cle: string, details: Object}} enonce   un énoncé d'enonces
 * @param {{diagnostic: Object, tours: number}} contexte
 *        diagnostic : celui dont l'énoncé vient ; tours : le nombre de tours
 *        de l'événement
 * @returns {{concretement: Array<{cle: string, details: Object}>, levier: null|{cle: string, details: Object}}}
 *   lève RangeError pour une clé d'énoncé inconnue
 */
export function expliquer(enonce, { diagnostic, tours }) {
  const g = grandeurs(diagnostic);
  if (enonce.cle === 'diagnostic.plafond') return explicationPlafond(enonce.details, diagnostic, tours, g);
  const composer = CONCRETEMENT.get(enonce.cle);
  if (composer === undefined) throw new RangeError(`énoncé inconnu : ${JSON.stringify(enonce.cle)}`);
  return { concretement: [composer(enonce, { diagnostic, tours, g })], levier: null };
}
