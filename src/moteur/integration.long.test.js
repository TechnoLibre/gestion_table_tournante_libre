// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves d'intégration lourdes du moteur. D'abord la grande démonstration
// (§ 5.5, § 12.10.4, § 15.1) : trois propositions traversent la chaîne
// d'integration.test.js, de rechercher au certificat. La configuration est
// exactement tendue et impose ses planchers, que le diagnostic chiffre avant
// la recherche : 99 retours imposés par les 33 ancrages ; un écart
// d'itinéraire maximal d'au moins 1, porté par au moins 24 mobiles ; un
// certificat « minimum atteint » hors d'atteinte. Les seuils de qualité sont
// posés après mesure, la mesure en commentaire (§ 14.1). Puis la grille de
// propriétés du § 14.12, sur des configurations tirées. Enfin l'ordre réglé
// (A21) : sur cinq graines, l'excédent et les cumulées atteints sous l'ordre
// par défaut et sous un ordre qui range les objectifs au deuxième palier ne
// s'écartent que d'une borne mesurée. Enfin la présence par tour (§ 5.5,
// § 5.7, § 12.4) : des propositions sous absences, puis une dérivée dont un
// tour figé laisse une arrivante en réserve imposée.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { FLUX, creerPcg32 } from '../demo/prng.js';
import { STATUT, indexerPlan, nombrePlaces, normaliser } from './configuration.js';
import { diagnostiquer } from './diagnostic.js';
import { assisAChaqueTourPresent, mesurer } from './indicateurs.js';
import {
  ecartsAuPlafondAPriori,
  ecartsItineraire,
  minimumAtteint,
  troisChiffres,
} from './manque.js';
import { plafondsAPriori, plafondsRealises } from './plafond.js';
import {
  creerEtat,
  defaire,
  proposerEtAppliquer,
  rechercher,
  regenerer,
  repartir,
  scoreComplet,
  scoreIncremental,
} from './recherche.js';
import { verifierIndicateurs, verifierInvariants } from './verification.js';
import { ORDRE_PAR_DEFAUT } from './criteres.js';
import { classer } from './classement.js';

// Compte d'arrêt choisi par la mesure. À 1 000 000 mouvements, chacune des
// trois propositions atteint, sur chaque seuil ci-dessous, la meilleure
// valeur que la configuration permette, sans rencontre répétée ni retour
// choisi. Avec cette graine, chaque seuil tient à partir de son propre
// compte :
// - rencontres minimales 24, sur tous comme sur les ancrés : déjà à
//   100 000 ;
// - écart au plafond a priori maximal 1, et rencontres minimales 27 des
//   mobiles : dès 250 000 ; à 200 000, ils valent 2 et 26 ;
// - manque maximal 0, aucun retour choisi : dès 350 000 ; à 300 000, une
//   proposition garde un manque de 1 et un retour choisi ;
// - aucune collision : dès 450 000 ; à 400 000, les trois propositions en
//   portent 8, 1 et 2.
// 1 000 000 vaut ainsi 4 fois le compte où tiennent l'écart au plafond a
// priori et les mobiles, 2,9 fois celui du manque et des retours choisis,
// 2,2 fois celui des collisions. Sur les graines 1 à 8, les vingt-quatre
// propositions tiennent l'écart au plafond a priori et les mobiles dès
// 250 000, le manque et les retours choisis dès 350 000, les collisions dès
// 500 000 ; à 450 000, deux en portent encore 1 et 5.
const REGLAGES = Object.freeze({ graine: 314_159, arret: 1_000_000, nombre: 3 });

// Seuils de qualité, posés après mesure ; chacun est la meilleure valeur
// que la configuration permette.
//
// Rencontres minimales : 24 mesuré à chacune des trois propositions. C'est
// le plafond a priori des quatre animateurs des tables de 7, qu'aucune
// proposition ne dépasse (§ 15.1) : le minimum global ne peut pas le
// dépasser, et l'épreuve exige qu'il l'atteigne. Les deux lignes
// secondaires du § 5.4 se lisent à part : 24 chez les ancrés, que ces
// quatre animateurs gouvernent ; 27 chez les mobiles. Un mobile assis une
// fois à une table de 7 rencontre 27 personnes au plus, une de moins que
// son plafond a priori de 28, et au moins 24 mobiles y passent (§ 15.1) ;
// l'écart au plafond a priori maximal de 1 interdit à chacun d'en
// rencontrer moins. Un agrégat « tous » qui écarterait les ancrés vaudrait
// 27 (§ 5.4).
const RENCONTRES_MIN = 24;
const RENCONTRES_MIN_ANCRES = 24;
const RENCONTRES_MIN_MOBILES = 27;
// Écart au plafond a priori maximal : 1 mesuré à chacune des trois
// propositions. Il ne descend pas sous l'écart d'itinéraire maximal, dont le
// plancher vaut 1 (§ 12.10.4) : ce seuil aussi est la meilleure valeur
// possible.
const ECART_AU_PLAFOND_A_PRIORI_MAX = 1;
// Collisions cumulées : 0 mesuré à chacune des trois propositions, la
// meilleure valeur possible ; le diagnostic n'impose à cette configuration
// aucun plancher de collisions. Une recherche qui ne sépare pas les
// organisations en laisse de 14 à 20 à chaque proposition.
const COLLISIONS_CUMULEES_MAX = 0;

// Plus grand élément d'une liste non vide.
const plusGrand = (valeurs) => valeurs.reduce((plus, valeur) => Math.max(plus, valeur));

// Nombre de personnes non ancrées dont l'écart d'itinéraire, ecarts[p] dans
// l'ordre canonique, atteint plancher. Le diagnostic en écrit le minimum,
// mobilesAuMoins, à côté de plancher.
function mobilesAuPlancher(instance, ecarts, plancher) {
  let compte = 0;
  for (let p = 0; p < instance.N; p += 1) {
    if (instance.statut[p] !== STATUT.ANCRE && ecarts[p] >= plancher) compte += 1;
  }
  return compte;
}

// La génération et ses mesures, calculées au premier appel puis partagées
// par les épreuves du fichier : la recherche en est le coût. Chaque
// proposition porte la liste de ses violations ; ses mesures, ses plafonds
// réalisés, ses trois chiffres et ses écarts d'itinéraire ne sont calculés
// que pour un plan sans violation. indexerPlan n'examine ni capacités ni
// réservations et lève à la première faute de forme, là où le vérificateur
// les nomme toutes.
let generation = null;
function genererGrande() {
  if (generation !== null) return generation;
  const configuration = CATALOGUE.find(({ cle }) => cle === 'grande').construire();
  const instance = normaliser(configuration);
  const aPriori = plafondsAPriori(instance);
  const propositions = rechercher(configuration, REGLAGES).map(({ id, plan }) => {
    const violations = verifierInvariants(instance, plan);
    if (violations.length > 0) return { id, violations };
    const tableDe = indexerPlan(instance, plan);
    const mesures = mesurer(instance, tableDe);
    const realises = plafondsRealises(instance, tableDe);
    return {
      id,
      violations,
      mesures,
      realises,
      chiffres: troisChiffres(instance, mesures, aPriori, realises),
      ecartsItineraire: ecartsItineraire(aPriori, realises),
    };
  });
  generation = { instance, aPriori, diagnostic: diagnostiquer(configuration), propositions };
  return generation;
}

// Les propositions de la génération, chacune jugée par verifierInvariants
// avant toute lecture de ses mesures. Un parcours vide ne prouverait rien
// (§ 14.2).
function propositionsValides() {
  const { propositions } = genererGrande();
  assert.equal(propositions.length, REGLAGES.nombre);
  for (const { id, violations } of propositions) {
    assert.deepEqual(violations, [], `proposition ${id}`);
  }
  return propositions;
}

describe('intégration : la grande démonstration de bout en bout (§ 5.5, § 12.10.4, § 15.1)', () => {
  test('chaque proposition tient invariants et indicateurs, porte les 99 retours imposés du diagnostic et aucun retour choisi', () => {
    const { aPriori, diagnostic } = genererGrande();
    // 33 ancrages de 4 tours, 3 retours chacun : attribués aux réservations,
    // les mêmes pour toute proposition (§ 5.4).
    assert.equal(diagnostic.retoursImposes, 99);
    for (const { id, mesures, realises } of propositionsValides()) {
      assert.deepEqual(verifierIndicateurs(mesures, aPriori, realises), [], `proposition ${id}`);
      assert.equal(mesures.totalRetoursImposes, diagnostic.retoursImposes, `proposition ${id}`);
      // Retours choisis : 0 mesuré à chacune des trois propositions, la
      // meilleure valeur possible ; avec cette graine, dès 350 000
      // mouvements (REGLAGES). Les deux comptes restent séparés, chacun à sa
      // valeur : leur somme afficherait 99 retours choisis à chaque
      // proposition, une constante où la différence entre propositions ne se
      // lit plus (§ 5.4, § 14.10).
      assert.equal(mesures.totalRetoursChoisis, 0, `proposition ${id}`);
    }
  });

  test("le plancher du diagnostic tient : écart d'itinéraire maximal ≥ 1, au moins 24 mobiles sous leur plafond a priori", () => {
    const { instance, diagnostic } = genererGrande();
    // Les tables de 7 offrent 96 sièges-tours mobiles, qu'un mobile n'occupe
    // que 4 fois au plus : au moins 24 mobiles y passent, et chacun y perd au
    // moins 1 sur son plafond a priori de 28 avant toute rencontre, son écart
    // d'itinéraire (§ 12.10.4). Sans ce plancher écrit, les comparaisons
    // ci-dessous n'éprouveraient rien.
    assert.deepEqual(diagnostic.ecartItineraire, { plancher: 1, mobilesAuMoins: 24 });
    const { plancher, mobilesAuMoins } = diagnostic.ecartItineraire;
    for (const { id, chiffres, ecartsItineraire: ecarts } of propositionsValides()) {
      assert.ok(
        chiffres.ecartItineraireMax.tous >= plancher,
        `proposition ${id} : écart d'itinéraire maximal ${chiffres.ecartItineraireMax.tous}, plancher ${plancher}`,
      );
      const mobilesSous = mobilesAuPlancher(instance, ecarts, plancher);
      assert.ok(
        mobilesSous >= mobilesAuMoins,
        `proposition ${id} : ${mobilesSous} mobiles sous leur plafond a priori, au moins ${mobilesAuMoins} attendus`,
      );
    }
  });

  test('jamais « minimum atteint » (§ 15.1), même quand chacun atteint son plafond réalisé', () => {
    const { aPriori } = genererGrande();
    for (const { id, mesures, chiffres } of propositionsValides()) {
      // Manque maximal, seuil posé après mesure : 0 à chacune des trois
      // propositions, sur les 260 personnes. Chacun rencontre tout ce que son
      // itinéraire permet ; un certificat lu sur le seul manque serait
      // décerné, et il ne l'est pas : il se lit contre le plafond a priori
      // (§ 5.5).
      assert.equal(chiffres.manqueMax.tous, 0, `proposition ${id}`);
      assert.equal(minimumAtteint(mesures, aPriori), false, `proposition ${id}`);
    }
  });

  test('seuils de qualité posés après mesure : rencontres minimales et leurs lignes secondaires, écart au plafond a priori maximal, collisions cumulées', () => {
    const { aPriori } = genererGrande();
    for (const { id, mesures } of propositionsValides()) {
      const { tous, ancres, mobiles } = mesures.aggRencontres;
      assert.equal(tous.min, RENCONTRES_MIN, `proposition ${id} : rencontres minimales`);
      assert.equal(ancres.min, RENCONTRES_MIN_ANCRES, `proposition ${id} : rencontres minimales des ancrés`);
      assert.equal(mobiles.min, RENCONTRES_MIN_MOBILES, `proposition ${id} : rencontres minimales des mobiles`);
      const ecartMax = plusGrand(ecartsAuPlafondAPriori(mesures, aPriori));
      assert.ok(
        ecartMax <= ECART_AU_PLAFOND_A_PRIORI_MAX,
        `proposition ${id} : écart au plafond a priori maximal ${ecartMax}, seuil ${ECART_AU_PLAFOND_A_PRIORI_MAX}`,
      );
      assert.ok(
        mesures.collisionsCumulees <= COLLISIONS_CUMULEES_MAX,
        `proposition ${id} : ${mesures.collisionsCumulees} collisions cumulées, seuil ${COLLISIONS_CUMULEES_MAX}`,
      );
    }
  });
});

// Grille de propriétés (§ 14.12). Les quatre démonstrations ont quatre
// tours, chacun y porte une organisation, aucune n'a de partiellement fixé
// ni d'exclu, et une seule laisse des places vides : la grille tire des
// configurations hors de ce cadre, d'une graine écrite ici. Les propriétés
// éprouvées valent pour tout plan que rend la recherche, quelle qu'en soit
// la qualité : un compte d'arrêt bref suffit. Un historique court fait jouer
// la bascule de la descente dans l'ordre des contraintes, qu'un plancher
// compte ci-dessous.
const GRILLE = Object.freeze({ graine: 1_729, configurations: 300, arret: 3_000, nombre: 2 });

// Une salle sur cinq est trop petite, deux sont tendues, deux ont des places
// vides.
const SALLES = Object.freeze(['tendue', 'tendue', 'places vides', 'places vides', 'trop petite']);
const LIBELLES = Object.freeze(['A', 'B', 'C']);

// Mouvements appliqués où la marche confronte le score tenu à jour au score
// recalculé, après le placement initial ; un mouvement appliqué sur trois est
// défait, comme dans recherche.long.test.js.
const PALIERS = Object.freeze([1, 10, 100, 1_000]);
const DEFAIT_TOUS_LES = 3;

// k entiers distincts de 0 à n − 1, tirés sans remise par le mélange
// partiel de Fisher et Yates.
function tirerSansRemise(rng, n, k) {
  const pile = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < k; i += 1) {
    const j = i + rng.borne(n - i);
    [pile[i], pile[j]] = [pile[j], pile[i]];
  }
  return pile.slice(0, k);
}

// Une configuration de la grille, ses réglages de génération, sa salle et le
// nombre de places qui lui manquent, tirés de rng :
// - de 2 à 6 tables de 2 à 6 sièges, de 1 à 5 tours ;
// - N = S personnes présentes dans une salle tendue, S = Σ c_t ; S − v, v de
//   1 à ⌊S / 2⌋, dans une salle à places vides ; S + 1 à S + 3 dans une salle
//   trop petite ;
// - chacun une fois sur deux : des ancrés, des réservations d'une partie des
//   tours, un ou deux exclus. Une réservation d'une partie des tours fait un
//   partiellement fixé quand R ≥ 2, parfois deux fois à la même table, et un
//   ancré par la portée « tour » quand R = 1 ;
// - de 1 à 3 organisations, et des personnes sans organisation ;
// - des identifiants de participant croissants à trous, des identifiants de
//   table dans un ordre quelconque, une liste de participants mélangée ;
// - une réservation d'exclu une fois sur deux, suspendue et sans siège, sa
//   table fût-elle pleine (§ 4.4), et une réservation en double une fois sur
//   quatre ;
// - chaque contrainte active trois fois sur quatre ; la graine de la
//   génération, et un historique de 16 à 64 cases.
// Une réservation de personne présente ne se pose que sur une table où il
// reste un siège à chacun de ses tours : la configuration ne lève jamais
// SURRESERVATION, et normaliser l'accepte toujours.
function tirerConfiguration(rng) {
  const T = 2 + rng.borne(5);
  const capacites = Array.from({ length: T }, () => 2 + rng.borne(5));
  const R = 1 + rng.borne(5);
  const S = capacites.reduce((somme, c) => somme + c, 0);
  const salle = SALLES[rng.borne(SALLES.length)];
  let N = S;
  if (salle === 'places vides') N = S - 1 - rng.borne(Math.floor(S / 2));
  if (salle === 'trop petite') N = S + 1 + rng.borne(3);
  const avecAncres = rng.borne(2) === 0;
  const avecToursReserves = rng.borne(2) === 0;
  const exclus = rng.borne(2) === 0 ? 1 + rng.borne(2) : 0;
  const G = 1 + rng.borne(LIBELLES.length);

  const ids = [];
  for (let i = 0, id = 0; i < N + exclus; i += 1) {
    id += 1 + rng.borne(2);
    ids.push(id);
  }
  const idsExclus = new Set(tirerSansRemise(rng, ids.length, exclus).map((i) => ids[i]));
  const participants = ids.map((id) => {
    const g = rng.borne(G + 1);
    return {
      id,
      nom: `P${id}`,
      organisation: g < G ? LIBELLES[g] : null,
      exclu: idsExclus.has(id),
    };
  });
  const idsTables = [];
  for (let t = 0, id = 0; t < T; t += 1) {
    id += 1 + rng.borne(3);
    idsTables.push(id);
  }
  rng.melanger(idsTables);
  const tables = idsTables.map((id, t) => ({ id, numero: t + 1, capacite: capacites[t] }));

  // fixees[t × R + r] : les personnes présentes que les réservations
  // assoient à la table t au tour r.
  const fixees = new Int32Array(T * R);
  const siegeLibre = (t, r) => fixees[t * R + r] < capacites[t];
  const tousLesTours = Array.from({ length: R }, (_, r) => r);
  const reservations = [];
  for (const { id, exclu } of participants) {
    const role = rng.borne(6);
    if (exclu) {
      if (role < 3) {
        const table = idsTables[rng.borne(T)];
        const portee = role === 0 ? { portee: 'tous' } : { portee: 'tour', tour: 1 + rng.borne(R) };
        reservations.push({ participant: id, table, ...portee });
      }
    } else if (avecAncres && role === 0) {
      const t = rng.borne(T);
      if (tousLesTours.every((r) => siegeLibre(t, r))) {
        for (const r of tousLesTours) fixees[t * R + r] += 1;
        reservations.push({ participant: id, table: idsTables[t], portee: 'tous' });
      }
    } else if (avecToursReserves && role === 1) {
      const tours = R === 1 ? 1 : 1 + rng.borne(R - 1);
      for (const r of tirerSansRemise(rng, R, tours)) {
        const t = rng.borne(T);
        if (!siegeLibre(t, r)) continue;
        fixees[t * R + r] += 1;
        reservations.push({ participant: id, table: idsTables[t], portee: 'tour', tour: r + 1 });
      }
    }
  }
  if (reservations.length > 0 && rng.borne(4) === 0) {
    reservations.push({ ...reservations[rng.borne(reservations.length)] });
  }
  rng.melanger(participants);
  const contraintes = {
    separerOrganisations: rng.borne(4) > 0,
    nouveauxVoisins: rng.borne(4) > 0,
    nouvelleTable: rng.borne(4) > 0,
    varierOrganisations: rng.borne(4) > 0,
  };
  const reglages = {
    graine: rng.suivant(),
    arret: GRILLE.arret,
    nombre: GRILLE.nombre,
    historique: 16 + rng.borne(49),
  };
  return {
    configuration: { participants, tables, tours: R, reservations, contraintes },
    reglages,
    salle,
    placesManquantes: Math.max(0, N - S),
  };
}

// Une marche depuis le placement initial de la proposition de graine
// dérivée graine, mouvements tirés du même générateur que sa descente :
// chaque palier ajoute à fautes un désaccord entre le score tenu à jour et le
// score recalculé. Rend vrai quand la marche atteint le dernier palier. Une
// configuration où les mouvements ne s'appliquent pas l'arrête plus tôt :
// celle dont chaque tour n'a de sièges mobiles qu'à une seule table, ou n'y
// a que des places fantômes.
function marcher(nom, instance, graine, fautes) {
  const rng = creerPcg32(graine, FLUX.RECHERCHE);
  const etat = creerEtat(instance, rng);
  const confronter = (appliques) => {
    const tenu = scoreIncremental(etat);
    const recalcule = scoreComplet(etat);
    if (tenu.some((valeur, k) => valeur !== recalcule[k])) {
      fautes.push(`${nom}, ${appliques} mouvements : score tenu ${tenu}, recalculé ${recalcule}`);
    }
  };
  confronter(0);
  let appliques = 0;
  let palier = 0;
  for (let essai = 0; palier < PALIERS.length && essai < 100 * PALIERS.at(-1); essai += 1) {
    const mouvement = proposerEtAppliquer(etat, rng);
    if (mouvement === null) continue;
    appliques += 1;
    if (appliques % DEFAIT_TOUS_LES === 0) defaire(etat, mouvement);
    if (appliques === PALIERS[palier]) {
      confronter(appliques);
      palier += 1;
    }
  }
  return palier === PALIERS.length;
}

// Ajoute à fautes ce qu'une proposition enfreint : les deux vérificateurs,
// les retours imposés du diagnostic, ses planchers de collisions et d'écart
// d'itinéraire, et sa régénération à partir de sa graine dérivée, de son
// compte d'arrêt et de son historique, sans son plan ni son identifiant. Ses
// mesures ne se lisent que sur un plan sans violation.
function juger(nom, { configuration, instance, aPriori, diagnostic }, proposition, fautes) {
  const { graine, arret, historique, plan } = proposition;
  const violations = verifierInvariants(instance, plan);
  if (violations.length > 0) {
    fautes.push(`${nom} : ${JSON.stringify(violations)}`);
    return false;
  }
  const tableDe = indexerPlan(instance, plan);
  const mesures = mesurer(instance, tableDe);
  const realises = plafondsRealises(instance, tableDe);
  const indicateurs = verifierIndicateurs(mesures, aPriori, realises);
  if (indicateurs.length > 0) fautes.push(`${nom} : ${JSON.stringify(indicateurs)}`);
  if (mesures.totalRetoursImposes !== diagnostic.retoursImposes) {
    fautes.push(`${nom} : ${mesures.totalRetoursImposes} retours imposés, ${diagnostic.retoursImposes} au diagnostic`);
  }
  for (const plancher of diagnostic.collisions) {
    const mesure = mesures.parGroupe.find(({ groupe }) => groupe === plancher.groupe);
    if (mesure.collisionsCumulees < plancher.plancherCumulees
      || mesure.pairesDistinctes < plancher.plancherPairesDistinctes
      || (plancher.plancherExcedent !== null && mesure.excedent < plancher.plancherExcedent)) {
      fautes.push(
        `${nom}, groupe ${plancher.groupe} : collisions ${mesure.collisionsCumulees} sur `
          + `${mesure.pairesDistinctes} paires, excédent ${mesure.excedent}, sous le plancher `
          + JSON.stringify(plancher),
      );
    }
  }
  if (diagnostic.ecartItineraire !== null) {
    const { plancher, mobilesAuMoins } = diagnostic.ecartItineraire;
    const { ecartItineraireMax } = troisChiffres(instance, mesures, aPriori, realises);
    const mobilesSous = mobilesAuPlancher(instance, ecartsItineraire(aPriori, realises), plancher);
    if (ecartItineraireMax.tous < plancher || mobilesSous < mobilesAuMoins) {
      fautes.push(
        `${nom} : écart d'itinéraire maximal ${ecartItineraireMax.tous}, ${mobilesSous} mobiles `
          + `à au moins ${plancher}, sous le plancher ${JSON.stringify(diagnostic.ecartItineraire)}`,
      );
    }
  }
  if (JSON.stringify(regenerer(configuration, { graine, arret, historique })) !== JSON.stringify(plan)) {
    fautes.push(`${nom} : la régénération rend un autre plan`);
  }
  // Une proposition a basculé dans l'ordre des contraintes exactement quand
  // son plan atteint un écart au plafond a priori maximal nul.
  return Math.max(...ecartsAuPlafondAPriori(mesures, aPriori)) === 0;
}

// Planchers de la grille (§ 14.2) : ce que la boucle doit avoir éprouvé pour
// que ses propriétés disent quelque chose. Un générateur qui cesserait de
// tirer l'un de ces cas laisserait les propriétés vraies sans les éprouver.
// Les comptes lisent donc ce que la boucle a éprouvé, l'instance, le
// diagnostic ou la marche, et non l'étiquette que le générateur a tirée.
// Seules les salles trop petites se comptent sur leur étiquette : une salle
// ainsi étiquetée qui ne l'est pas fait échouer la boucle, qui exige son
// refus. Chaque plancher est posé sous le compte que donne la graine écrite,
// en commentaire.
const PLANCHERS = Object.freeze([
  ['configurations éprouvées', 'eprouvees', 200], // 230 sur 300
  ['salles trop petites refusées', 'tropPetites', 50], // 70
  ['salles tendues', 'tendues', 90], // 120
  ['salles à places vides', 'placesVides', 80], // 110
  ['avec ancrés', 'ancres', 90], // 122
  ['avec partiellement fixés', 'partiellementFixes', 60], // 87
  ['avec exclus', 'exclus', 90], // 122
  ['à un seul tour', 'unTour', 30], // 47
  ['avec retours imposés', 'retoursImposes', 70], // 103
  ['avec plancher de collisions', 'plancherCollisions', 120], // 173
  ["avec plancher d'excédent", 'plancherExcedent', 10], // 15
  ["avec plancher d'écart d'itinéraire", 'plancherEcartItineraire', 35], // 50
  ['marches au dernier palier', 'marches', 400], // 460, une par proposition
  ["propositions qui basculent dans l'ordre des contraintes", 'bascules', 40], // 53
]);

describe('intégration : grille de propriétés sur des configurations tirées (§ 14.12)', () => {
  test(`${GRILLE.configurations} configurations : chaque proposition tient les deux vérificateurs, les retours imposés et les planchers du diagnostic, et se régénère ; le score tenu à jour égale le recalcul le long d'une marche tirée de sa graine dérivée ; une salle trop petite est refusée du nombre de places du diagnostic`, () => {
    const rng = creerPcg32(GRILLE.graine, FLUX.DEMO);
    const comptes = {
      eprouvees: 0,
      tropPetites: 0,
      tendues: 0,
      placesVides: 0,
      ancres: 0,
      partiellementFixes: 0,
      exclus: 0,
      unTour: 0,
      retoursImposes: 0,
      plancherCollisions: 0,
      plancherExcedent: 0,
      plancherEcartItineraire: 0,
      marches: 0,
      bascules: 0,
    };
    const fautes = [];
    for (let c = 1; c <= GRILLE.configurations; c += 1) {
      const { configuration, reglages, salle, placesManquantes } = tirerConfiguration(rng);
      const nom = `configuration ${c}`;
      const instance = normaliser(configuration);
      const diagnostic = diagnostiquer(configuration);
      if (diagnostic.placesManquantes !== placesManquantes) {
        fautes.push(`${nom} : ${diagnostic.placesManquantes} places manquantes au diagnostic, ${placesManquantes} tirées`);
      }
      if (salle === 'trop petite') {
        comptes.tropPetites += 1;
        try {
          rechercher(configuration, reglages);
          fautes.push(`${nom} : salle trop petite acceptée`);
        } catch (erreur) {
          if (erreur.code !== 'PLACES_MANQUANTES'
            || erreur.details.placesManquantes !== diagnostic.placesManquantes) {
            fautes.push(`${nom} : ${erreur.message}`);
          }
        }
        continue;
      }
      comptes.eprouvees += 1;
      if (nombrePlaces(instance) === instance.N) comptes.tendues += 1;
      else comptes.placesVides += 1;
      if (instance.k > 0) comptes.ancres += 1;
      if (instance.statut.includes(STATUT.PARTIELLEMENT_FIXE)) comptes.partiellementFixes += 1;
      if (instance.exclus.size > 0) comptes.exclus += 1;
      if (instance.R === 1) comptes.unTour += 1;
      if (diagnostic.retoursImposes > 0) comptes.retoursImposes += 1;
      if (diagnostic.collisions.length > 0) comptes.plancherCollisions += 1;
      if (diagnostic.collisions.some(({ plancherExcedent }) => plancherExcedent !== null)) {
        comptes.plancherExcedent += 1;
      }
      if (diagnostic.ecartItineraire !== null) comptes.plancherEcartItineraire += 1;
      const contexte = { configuration, instance, aPriori: plafondsAPriori(instance), diagnostic };
      const propositions = rechercher(configuration, reglages);
      if (propositions.length !== GRILLE.nombre) fautes.push(`${nom} : ${propositions.length} propositions`);
      for (const proposition of propositions) {
        const nomProposition = `${nom}, proposition ${proposition.id}`;
        if (juger(nomProposition, contexte, proposition, fautes)) comptes.bascules += 1;
        if (marcher(nomProposition, instance, proposition.graine, fautes)) comptes.marches += 1;
      }
    }
    // Les vingt premières fautes suffisent à désigner un défaut ; le message
    // en donne le nombre.
    assert.deepEqual(fautes.slice(0, 20), [], `${fautes.length} fautes`);
    const sousLePlancher = PLANCHERS
      .filter(([, cle, plancher]) => comptes[cle] < plancher)
      .map(([libelle, cle, plancher]) => `${libelle} : ${comptes[cle]}, plancher ${plancher}`);
    assert.deepEqual(sousLePlancher, [], JSON.stringify(comptes));
  });
});

// La grande démonstration à objectifs : une personne sur trois, dans l'ordre
// de la liste, porte « finance », et une table sur quatre attend « finance »
// pour la soirée.
function grandeAObjectifs(priorites) {
  const base = CATALOGUE.find(({ cle }) => cle === 'grande').construire();
  return {
    ...base,
    participants: base.participants.map((participant, rang) => (rang % 3 === 0 ? { ...participant, etiquettes: ['finance'] } : participant)),
    objectifs: base.tables.filter((_, rang) => rang % 4 === 0).map(({ id }) => ({ table: id, tour: null, regle: 'ou', etiquettes: ['finance'] })),
    ...(priorites === undefined ? {} : { priorites }),
  };
}

// Mesure, graines 1 à 5, 100 000 mouvements : sous l'ordre par défaut,
// excédent 0 à chaque graine et cumulées 64, 59, 46, 61, 50 (somme 280) ;
// les objectifs au deuxième palier, excédent 0 à chaque graine et cumulées
// 55, 67, 57, 48, 50 (somme 277). Les bornes laissent la marge
// d'une graine à l'autre, que les sommes ne lissent pas : 5 sur l'excédent,
// 15 % des cumulées de l'ordre par défaut.
const ECART_EXCEDENT_MAX = 5;
const ECART_CUMULEES_RELATIF_MAX = 0.15;

describe("intégration : l'ordre réglé ne défait pas les collisions (A21)", () => {
  test("grande à objectifs, cinq graines : l'excédent et les cumulées sous les objectifs au deuxième palier restent près de ceux de l'ordre par défaut", () => {
    // L'ordre par défaut, les tours hors objectif montés juste après
    // l'excédent : au deuxième palier qui compte, le conflit d'organisation,
    // sans liste, étant sans objet.
    const e = (critere) => ({ critere, poids: 1 });
    const [conflits, excedent, ...suite] = ORDRE_PAR_DEFAUT;
    const deplace = [
      [e(conflits)],
      [e(excedent)],
      [e('toursHorsObjectif')],
      ...suite.filter((nom) => nom !== 'toursHorsObjectif').map((nom) => [e(nom)]),
    ];
    const sommes = [undefined, deplace].map((priorites) => {
      const configuration = grandeAObjectifs(priorites);
      const instance = normaliser(configuration);
      assert.equal(instance.etatCriteres.find(({ nom }) => nom === 'toursHorsObjectif').sansObjet, false);
      let excedent = 0;
      let cumulees = 0;
      for (const graine of [1, 2, 3, 4, 5]) {
        const [{ plan }] = rechercher(configuration, { graine, arret: 100_000, nombre: 1 });
        const mesures = mesurer(instance, indexerPlan(instance, plan));
        excedent += mesures.excedentCollisions;
        cumulees += mesures.collisionsCumulees;
      }
      return { excedent, cumulees };
    });
    const [defaut, objectifsDevant] = sommes;
    assert.ok(Math.abs(objectifsDevant.excedent - defaut.excedent) <= ECART_EXCEDENT_MAX, JSON.stringify(sommes));
    assert.ok(Math.abs(objectifsDevant.cumulees - defaut.cumulees) <= ECART_CUMULEES_RELATIF_MAX * defaut.cumulees, JSON.stringify(sommes));
  });
});

// La démonstration du catalogue, le participant d'id i recevant presences[i]
// pour présence, et les réservations ajoutées.
function demonstrationAvec(cle, presences, reservations = []) {
  const base = CATALOGUE.find((entree) => entree.cle === cle).construire();
  return {
    ...base,
    participants: base.participants.map((personne) =>
      (presences[personne.id] === undefined ? personne : { ...personne, presence: presences[personne.id] })),
    reservations: [...base.reservations, ...reservations],
  };
}

// Les listes d'un tour, chacune triée, dans l'ordre des tables du plan.
const tourTrie = (plan, tour) => plan.tours[tour - 1].map((liste) => [...liste].sort((a, b) => a - b));

const REGLAGES_PRESENCE = Object.freeze({ graine: 271_828, arret: 50_000, nombre: 3 });

describe('intégration : la présence par tour de bout en bout (§ 5.5, § 5.7, § 12.4)', () => {
  test('petite à conflit, trois présences partielles : chaque proposition n’assied que les présentes, tient les deux vérificateurs, les retours imposés et les planchers gardés, et se classe', () => {
    // 2 arrive au tour 2, 7 part après le tour 2, 10 (« A ») manque le
    // tour 2.
    const configuration = demonstrationAvec('petite-conflit', { 2: [2, 3, 4], 7: [1, 2], 10: [1, 3, 4] });
    const instance = normaliser(configuration);
    assert.equal(instance.absences, 4);
    const aPriori = plafondsAPriori(instance);
    const diagnostic = diagnostiquer(configuration);
    assert.deepEqual(diagnostic.placesManquantesParTour, [0, 0, 0, 0]);
    assert.equal(diagnostic.ecartItineraire, null);
    assert.deepEqual(diagnostic.planchersRetires, ['ecartItineraire']);
    // Cinq « A » sur quatre tables à trois tours, quatre au tour 2 : un
    // plancher de collisions demeure.
    assert.ok(diagnostic.collisions.length > 0, JSON.stringify(diagnostic.collisions));
    const propositions = rechercher(configuration, REGLAGES_PRESENCE);
    assert.equal(propositions.length, REGLAGES_PRESENCE.nombre);
    const entrees = propositions.map(({ id, plan }) => {
      const nom = `proposition ${id}`;
      assert.deepEqual(verifierInvariants(instance, plan), [], nom);
      for (const [absente, tours] of [[2, [1]], [7, [3, 4]], [10, [2]]]) {
        for (const tour of tours) {
          assert.ok(!plan.tours[tour - 1].flat().includes(absente) && !plan.reserves[tour - 1].includes(absente), `${nom}, ${absente} au tour ${tour}`);
        }
      }
      const tableDe = indexerPlan(instance, plan);
      const mesures = mesurer(instance, tableDe);
      const realises = plafondsRealises(instance, tableDe);
      assert.deepEqual(verifierIndicateurs(mesures, aPriori, realises), [], nom);
      assert.equal(assisAChaqueTourPresent(instance, mesures.toursAssis), true, nom);
      assert.equal(mesures.totalRetoursImposes, diagnostic.retoursImposes, nom);
      for (const plancher of diagnostic.collisions) {
        const mesure = mesures.parGroupe.find(({ groupe }) => groupe === plancher.groupe);
        assert.ok(mesure.collisionsCumulees >= plancher.plancherCumulees && mesure.pairesDistinctes >= plancher.plancherPairesDistinctes, `${nom}, ${plancher.groupe}`);
      }
      return { id, mesures, plafondsAPriori: aPriori };
    });
    const { ordre } = classer(entrees);
    assert.deepEqual([...ordre].sort((a, b) => a - b), [1, 2, 3]);
  });

  test('une dérivée sous réserve imposée : le tour figé garde son départ, la réserve imposée y reste, et verifierInvariants ne la tient pour faute que sans l’option', () => {
    // Départ : la petite, 5 absente au tour 1. Puis 5 est dite présente à
    // chaque tour et réservée au tour 1 à une table que le départ remplit :
    // au tour 1, figé, elle reste en réserve.
    const [{ plan: depart }] = rechercher(demonstrationAvec('petite', { 5: [2, 3, 4] }), { ...REGLAGES_PRESENCE, nombre: 1 });
    const pleine = depart.tables.find((_, i) => depart.tours[0][i].length === 3);
    const configuration = demonstrationAvec('petite', {}, [{ participant: 5, table: pleine, portee: 'tour', tour: 1 }]);
    const instance = normaliser(configuration);
    const aPriori = plafondsAPriori(instance);
    const reservesImposees = [{ participant: 5, tour: 1 }];
    const propositions = repartir(configuration, REGLAGES_PRESENCE, { plan: depart, toursFiges: [1], reservesImposees });
    assert.equal(propositions.length, REGLAGES_PRESENCE.nombre);
    for (const { id, plan } of propositions) {
      const nom = `dérivée ${id}`;
      assert.deepEqual(tourTrie(plan, 1), tourTrie(depart, 1), nom);
      assert.deepEqual(plan.reserves[0], [5], nom);
      assert.deepEqual(verifierInvariants(instance, plan, { reservesImposees }), [], nom);
      assert.deepEqual(verifierInvariants(instance, plan), [
        { code: 'NON_ASSIS', participant: 5, tour: 1 },
        { code: 'RESERVATION', participant: 5, table: pleine, tour: 1 },
      ], nom);
      const tableDe = indexerPlan(instance, plan);
      const mesures = mesurer(instance, tableDe);
      assert.deepEqual(verifierIndicateurs(mesures, aPriori, plafondsRealises(instance, tableDe)), [], nom);
      // Une présente en réserve sort le plan du domaine des planchers.
      assert.equal(assisAChaqueTourPresent(instance, mesures.toursAssis), false, nom);
    }
  });
});
