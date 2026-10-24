// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La proposition choisie, expliquée (§ 5.5, § 5.6, § 12.2, § 12.10), pure :
// Diagnostic.svelte la pose dans une carte sous celle de tout l'événement.
//
// Laquelle : la proposition demandée au plan (ui.proposition) quand la
// liste la porte, sinon le placement retenu, sinon la première du
// classement — la règle de la source de la page de qualité, puis la
// meilleure proposition de la section Génération. Sans aucune, la carte dit
// d'en générer une ; une proposition en dérive ou fautive se dit telle,
// sans chiffres.
//
// Ce qui s'en dit se lit dans sa ligne de la table d'évaluation (evaluation,
// propositions/modele.js), la même que le tableau des propositions écrit,
// et dans le diagnostic que la table porte : aucune mesure ne se refait ici.
// Les seules opérations sont des comparaisons de ces chiffres entre eux, un
// minimum et un maximum sur les plafonds a priori des personnes au minimum,
// et la soustraction présents − places du diagnostic. Trois blocs :
// - atteint : les rencontres minimales, puis, chacun quand sa règle compte
//   — cochée et avec un objet, comme l'état des critères de la table le dit
//   —, les conflits d'organisation, les collisions, les retours choisis, la
//   diversité, les objectifs et les animateurs ;
// - manque : l'écart au plafond a priori décomposé en ses deux parts, la
//   place — écart d'itinéraire, places vides, plancher prouvé — et les
//   revoirs — plus grand manque, rencontres répétées —, puis ce qui se sait
//   de l'atteignabilité : hors d'atteinte quand le diagnostic prouve un
//   plancher d'écart d'itinéraire, inconnue sinon ;
// - tenter : les seuls gestes qui existent, « Repartir d'elle » ou
//   « Générer » quand une recherche peut encore réduire ce qui manque ou ce
//   qu'une règle active compte au-dessus de son plancher, les tables quand
//   des places vides ou des capacités différentes coûtent des rencontres ;
//   « rien » pour les rencontres au minimum atteint.
// Un bloc sans phrase ne s'écrit pas.
import { premiereDuClassement } from '../../application/evaluation.js';
import { evaluation } from '../propositions/modele.js';

const P = 'diagnostic.proposition';

// Une phrase neuve de la clé donnée, sous P.
const phrase = (cle, details = {}) => ({ cle: `${P}.${cle}`, details });

// La proposition choisie et sa ligne d'évaluation, null sans elle : la
// proposition demandée que la liste porte, sinon le retenu, sinon la
// première du classement ; sinon aucune, ou aucune qui se classe.
function choix(charge, table, demandee) {
  if (demandee !== null && charge.propositions.some(({ id }) => id === demandee)) {
    return { genre: 'montree', id: demandee, ligne: table.propositions.find(({ id }) => id === demandee) ?? null };
  }
  if (charge.retenu !== null) return { genre: 'retenu', id: 'retenu', ligne: table.retenu };
  const premiere = table === null ? null : premiereDuClassement(table);
  if (premiere !== null) return { genre: 'meilleure', id: premiere.id, ligne: premiere };
  return { genre: charge.propositions.length === 0 ? 'aucune' : 'aucuneClassee', id: null, ligne: null };
}

// La phrase qui dit laquelle : une proposition demandée que le plan ne
// montre pas — en dérive ou fautive — est dite demandée, non montrée.
function laquelle({ genre, id, ligne }) {
  if (genre === 'montree') return phrase(ligne.statut === 'comparable' ? 'laquelle.montree' : 'laquelle.demandee', { proposition: id });
  if (genre === 'meilleure') return phrase('laquelle.meilleure', { proposition: id });
  return phrase(`laquelle.${genre}`);
}

// Les places vides de chaque tour : places − présents, comptées aux seuls
// tours où quelqu'un est présent, sur les capacités du diagnostic.
function placesVides(diagnostic) {
  const places = diagnostic.ancrage.reduce((somme, { capacite }) => somme + capacite, 0);
  const presents = diagnostic.presence.presentsParTour;
  const vides = presents.map((n) => (n > 0 ? Math.max(0, places - n) : 0));
  return { places, presents, vides, plus: Math.max(0, ...vides) };
}

// Le minimum des rencontres, rapporté au plafond a priori des personnes qui
// l'atteignent : une valeur quand elles le partagent, l'étendue sinon, rien
// quand le plafond a priori est inconnu.
function rencontres(mesures, plafondsAPriori) {
  const minimum = mesures.aggRencontres.tous.min;
  if (minimum === null) return [];
  if (plafondsAPriori === null) return [phrase('rencontres.seul', { minimum })];
  let de = Infinity;
  let a = -Infinity;
  mesures.rencontres.forEach((n, p) => {
    if (n !== minimum) return;
    de = Math.min(de, plafondsAPriori[p]);
    a = Math.max(a, plafondsAPriori[p]);
  });
  return [de === a ? phrase('rencontres', { minimum, plafond: a }) : phrase('rencontres.entre', { minimum, de, a })];
}

// Ce qui est atteint. comptent : les noms des critères cochés et avec un
// objet. Un plancher du diagnostic ne se dit égalé que sur un plan qui
// honore les réservations, le domaine où il vaut.
function atteint(ligne, table, charge, comptent) {
  const { mesures } = ligne;
  const honore = ligne.violations.length === 0;
  const liste = [...rencontres(mesures, table.plafondsAPriori)];
  const { mobiles, ancres } = mesures.aggRencontres;
  if (mobiles.effectif > 0 && ancres.effectif > 0) liste.push(phrase('populations', { mobiles: mobiles.min, ancres: ancres.min }));
  if (comptent.has('conflitsOrganisation') && mesures.conflitsOrganisation !== null) {
    const conflits = mesures.conflitsOrganisation;
    const imposes = honore && conflits > 0 && conflits === table.diagnostic.conflitsImposes;
    liste.push(conflits === 0 ? phrase('conflits.aucun') : phrase('conflits', { conflits, imposes }));
  }
  if (comptent.has('collisionsCumulees') && mesures.parGroupe.some(({ effectif }) => effectif >= 2)) {
    const { collisionsCumulees: collisions, pairesDistinctes: paires, excedentCollisions: excedent } = mesures;
    const plancher = table.diagnostic.collisions.reduce((somme, { plancherCumulees }) => somme + plancherCumulees, 0);
    liste.push(
      collisions === 0
        ? phrase('collisions.aucune')
        : phrase('collisions', { collisions, paires, excedent, plancher: honore && plancher > 0 && collisions === plancher }),
    );
  }
  if (comptent.has('rencontresRepetees') && charge.reglages.nouvelleTable) liste.push(phrase('retours', { retours: mesures.totalRetoursChoisis }));
  if (comptent.has('redondance') && mesures.aggDiversite.tous.min !== null) {
    liste.push(
      phrase('diversite', {
        organisations: mesures.aggOrganisationsVues.tous.min,
        redondance: mesures.totalRedondance,
        diversite: mesures.aggDiversite.tous.min,
      }),
    );
  }
  if (comptent.has('toursHorsObjectif') && mesures.objectifs !== null) {
    liste.push(phrase('objectifs', { horsObjectif: mesures.objectifs.horsObjectif, jamaisServies: mesures.objectifs.jamaisServies }));
  }
  if (comptent.has('animateursNonRencontres') && mesures.animateurs !== null) {
    liste.push(phrase('animateurs', { minimum: mesures.animateurs.agregat.tous.min, nonRencontres: mesures.animateurs.nonRencontres }));
  }
  return liste;
}

// Les trois grandeurs du manque de la ligne : l'écart au plafond a priori,
// l'écart d'itinéraire et le plus grand manque, sur toute la population ;
// null quand l'a priori est inconnu ou la population vide.
function troisParts(ligne) {
  const ecart = ligne.ecartAuPlafondAPrioriMax;
  if (ecart === null) return null;
  return { ecart, itineraire: ligne.troisChiffres.ecartItineraireMax.tous, manque: ligne.troisChiffres.manqueMax.tous };
}

// Ce qui manque, et pourquoi. L'écart au plafond a priori d'une personne
// est la somme de son écart d'itinéraire et de son manque ; les deux plus
// grands ne tombent pas toujours sur la même personne, et la phrase le dit
// quand leur somme dépasse le plus grand écart. Un plancher d'écart
// d'itinéraire prouvé (§ 12.10.4) vaut pour tout placement : au moins
// mobilesAuMoins mobiles y finissent sous leur plafond a priori, que nul
// placement n'atteint donc pour tous ; sans lui, l'atteignabilité reste
// inconnue.
function manque(ligne, table, parts, vides) {
  if (parts === null) return [];
  const { ecart, itineraire, manque: plusGrand } = parts;
  if (ecart === 0) return [phrase('manque.aucun')];
  const liste = [phrase('manque.ecart', { ecart })];
  if (itineraire > 0) {
    liste.push(phrase('manque.itineraire', { ecart: itineraire }));
    if (vides.plus > 0) {
      liste.push(
        vides.vides.every((n) => n === vides.vides[0])
          ? phrase('manque.placesVides', { placesVides: vides.plus, places: vides.places, presents: vides.presents[0] })
          : phrase('manque.placesVidesSelonTour', { placesVides: vides.plus }),
      );
    }
    const prouve = table.diagnostic.ecartItineraire;
    if (prouve !== null) liste.push(phrase('manque.plancherItineraire', { plancher: prouve.plancher, atteint: itineraire === prouve.plancher }));
  } else {
    liste.push(phrase('manque.itineraireNul'));
  }
  if (plusGrand > 0) {
    liste.push(phrase('manque.revoirs', { manque: plusGrand, effectif: ligne.troisChiffres.effectifManque.tous }));
    const { choisies: repetees, imposees } = ligne.mesures.rencontresRepetees;
    const maxPaire = imposees === 0 ? ligne.mesures.maxRencontresPaire : null;
    if (repetees > 0) liste.push(phrase('manque.repetees', { repetees, maxPaire }));
  } else {
    liste.push(phrase('manque.revoirsNul'));
  }
  if (itineraire > 0 && plusGrand > 0 && itineraire + plusGrand > ecart) liste.push(phrase('manque.nonAdditifs'));
  if (ligne.minimumAtteint === false) {
    const prouve = table.diagnostic.ecartItineraire;
    liste.push(prouve === null ? phrase('manque.inconnue') : phrase('manque.horsAtteinte', { mobiles: prouve.mobilesAuMoins }));
  }
  return liste;
}

// Les règles actives qui restent au-dessus de ce que le diagnostic prouve
// inévitable : des conflits d'organisation au-delà des conflits imposés,
// des collisions au-delà de leur plancher, ou un excédent. Un plancher ne
// vaut que sur un plan qui honore les réservations.
function reglesAuDessus(ligne, table, comptent) {
  const { mesures } = ligne;
  const honore = ligne.violations.length === 0;
  const conflits = mesures.conflitsOrganisation;
  if (comptent.has('conflitsOrganisation') && conflits !== null && conflits > 0) {
    if (!honore || conflits !== table.diagnostic.conflitsImposes) return true;
  }
  if (comptent.has('collisionsCumulees') && mesures.collisionsCumulees > 0) {
    const plancher = table.diagnostic.collisions.reduce((somme, { plancherCumulees }) => somme + plancherCumulees, 0);
    if (!honore || mesures.collisionsCumulees !== plancher || mesures.excedentCollisions > 0) return true;
  }
  return false;
}

// Ce qu'on peut tenter. Une recherche plus longue vise ce qu'un placement
// peut reprendre : les revoirs, l'écart d'itinéraire au-dessus de ce qui
// est inévitable, et les règles actives au-dessus de leur plancher. Est
// inévitable le plancher prouvé ; sinon, une perte de 1 quand des places
// restent vides, car qui s'assoit à une table incomplète y perd au moins
// une rencontre et chaque tour en compte une. Une proposition se reprend
// par « Repartir d'elle », le retenu, qui ne l'offre pas, par une
// génération. Des tables pleines retirent les places vides ; le plancher
// prouvé tient aux capacités et aux ancrages, qu'aucune relance ne
// franchit. Au minimum atteint, « rien » ne vaut que pour les rencontres.
function tenter(choisie, ligne, table, charge, parts, vides, comptent) {
  if (parts === null) return [];
  const { itineraire, manque: plusGrand } = parts;
  const prouve = table.diagnostic.ecartItineraire;
  const inevitable = prouve !== null ? prouve.plancher : vides.plus > 0 ? 1 : 0;
  const parLaPlace = itineraire > inevitable;
  const liste = ligne.minimumAtteint === true ? [phrase('tenter.rien')] : [];
  if (plusGrand > 0 || parLaPlace || reglesAuDessus(ligne, table, comptent)) {
    const { arret } = charge.reglages.generation;
    liste.push(choisie.genre === 'retenu' ? phrase('tenter.generer', { arret }) : phrase('tenter.repartir', { proposition: choisie.id, arret }));
  }
  if (ligne.minimumAtteint === true) return liste;
  if (itineraire > 0 && vides.plus > 0) liste.push(phrase('tenter.tables'));
  if (itineraire > 0 && prouve !== null) liste.push(phrase('tenter.capacites'));
  return liste;
}

/**
 * La proposition choisie et son explication. Ne modifie pas la charge.
 *
 * @param {Object|null} charge  la charge de l'état observable de la séance
 * @param {{demandee?: number|null}} [demande]  demandee : la proposition
 *        demandée au plan (ui.proposition)
 * @returns {null|{genre: 'montree'|'retenu'|'meilleure'|'aucune'|'aucuneClassee',
 *   id: number|'retenu'|null, laquelle: {cle: string, details: Object},
 *   statut: null|{cle: string, details: Object},
 *   blocs: Array<{nom: 'atteint'|'manque'|'tenter', titre: string, phrases: Array<{cle: string, details: Object}>}>}}
 *   null sans charge, et quand la configuration ne se normalise pas : le
 *   diagnostic dit alors son refus. genre : laquelle est choisie, ou
 *   pourquoi aucune ; id : son identifiant, 'retenu', ou null ; laquelle :
 *   la phrase qui la nomme ; statut : la phrase d'une proposition en dérive
 *   ou fautive, null sinon ; blocs : ceux qui ont une phrase au moins, dans
 *   l'ordre atteint, manque, tenter, vides sauf pour une ligne comparable
 */
export function propositionChoisie(charge, { demandee = null } = {}) {
  if (charge === null) return null;
  const { table, refus } = evaluation(charge);
  if (refus !== null) return null;
  const choisie = choix(charge, table, demandee);
  const { ligne } = choisie;
  const resultat = { genre: choisie.genre, id: choisie.id, laquelle: laquelle(choisie), statut: null, blocs: [] };
  if (ligne === null) return resultat;
  if (ligne.statut !== 'comparable') return { ...resultat, statut: phrase(`statut.${ligne.statut}`) };
  const comptent = new Set(table.criteres.filter(({ coche, sansObjet }) => coche && !sansObjet).map(({ nom }) => nom));
  const parts = troisParts(ligne);
  const vides = placesVides(table.diagnostic);
  const blocs = [
    ['atteint', atteint(ligne, table, charge, comptent)],
    ['manque', manque(ligne, table, parts, vides)],
    ['tenter', tenter(choisie, ligne, table, charge, parts, vides, comptent)],
  ];
  return {
    ...resultat,
    blocs: blocs.filter(([, phrases]) => phrases.length > 0).map(([nom, phrases]) => ({ nom, titre: `${P}.bloc.${nom}`, phrases })),
  };
}
