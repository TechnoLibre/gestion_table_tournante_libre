// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves lourdes des plafonds (§ 14.4, § 14.12) : l'accord de la
// programmation dynamique et de l'énumération sur une grille plus large que
// celle de la série node, jusqu'à 8 tables et 5 tours ; la forme de la grande
// démonstration et sa variante, arbitrées par l'énumération ; la limite de
// l'énumération à sa frontière exacte ; le coût du plafond a priori et du
// diagnostic sur la grande démonstration, sa variante et la configuration
// pessimiste, chacun sous un seuil tiré de sa référence (§ 17, point 4) ; la
// borne de diversité contre chaque plan de deux salles inventées (§ 5.5) ;
// sous la présence par tour, l'accord avec l'énumération sur des présences
// tirées, la chaîne rencontres ≤ plafond réalisé ≤ plafond a priori ≤ C(p) ≤
// N − 1 sur un plan de chaque instance, et le coût sur la grande
// démonstration à six motifs de présence.
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { configurationPessimiste, FORME_PESSIMISTE } from '../../test/fixtures/banc/pessimiste.js';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { LIBRE, RESERVE, STATUT, normaliser } from './configuration.js';
import { diagnostiquer } from './diagnostic.js';
import { ErreurConfiguration } from './erreurs.js';
import { mesurer as mesurerPlan } from './indicateurs.js';
import {
  borneDiversite,
  plafondsAPriori,
  plafondsAPrioriParEnumeration,
  plafondsRealises,
  programmesDuPlafond,
} from './plafond.js';

const SANS_CONTRAINTE = {
  separerOrganisations: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierOrganisations: false,
};

// Graine de la grille, écrite ici (§ 14.12) ; chaque case de la grille en
// dérive la sienne.
const GRAINE = 314_159;

/**
 * Instance d'une salle : capacites[t] et ancres[t] décrivent la table
 * d'index t ; partiels[j][r] est la table imposée au j-ème partiellement
 * fixé au tour r, LIBRE pour un tour libre. Identifiants 1 à N : les ancrés,
 * table par table, puis les partiels, puis les mobiles ; la table d'index t
 * a pour identifiant 100 + t. presences[id − 1], quand il est donné, est la
 * présence de la personne id ; absent, elle est présente à chaque tour. Lève
 * ce que normaliser lève.
 */
function instanceDe({ capacites, ancres, mobiles, tours, partiels = [], presences = [] }) {
  const participants = [];
  const reservations = [];
  const nouveau = () => {
    const id = participants.length + 1;
    const presence = presences[id - 1];
    participants.push({ id, nom: `P${id}`, organisation: null, ...(presence === undefined ? {} : { presence }) });
    return id;
  };
  ancres.forEach((a, t) => {
    for (let i = 0; i < a; i += 1) {
      reservations.push({ participant: nouveau(), table: 100 + t, portee: 'tous' });
    }
  });
  for (const tables of partiels) {
    const id = nouveau();
    tables.forEach((t, r) => {
      if (t === LIBRE) return;
      reservations.push({ participant: id, table: 100 + t, portee: 'tour', tour: r + 1 });
    });
  }
  for (let i = 0; i < mobiles; i += 1) nouveau();
  return normaliser({
    participants,
    tables: capacites.map((capacite, t) => ({ id: 100 + t, numero: t + 1, capacite })),
    tours,
    reservations,
    contraintes: SANS_CONTRAINTE,
  });
}

// Une case de la grille : T tables et R tours fixés, capacités de 2 à 6.
// Une table est entièrement ancrée une fois sur quatre, et garde sinon de 1 à
// c sièges libres. Chaque tour d'un partiel est libre une fois sur deux, ou
// désigne par son rang l'une des tables qui gardent un siège, rang pris
// modulo leur nombre : seul l'empilement de partiels à une même table, au
// même tour, fait encore refuser une instance.
function arbitraireCase(T, R) {
  const table = fc
    .integer({ min: 2, max: 6 })
    .chain((c) =>
      fc.tuple(
        fc.constant(c),
        fc.oneof(
          { arbitrary: fc.integer({ min: 0, max: c - 1 }), weight: 3 },
          { arbitrary: fc.constant(c), weight: 1 },
        ),
      ),
    );
  const tour = fc.oneof(fc.constant(LIBRE), fc.integer({ min: 0, max: T - 1 }));
  return fc
    .record({
      salle: fc.array(table, { minLength: T, maxLength: T }),
      mobiles: fc.integer({ min: 0, max: 10 }),
      rangs: fc.array(fc.array(tour, { minLength: R, maxLength: R }), { maxLength: 4 }),
    })
    .map(({ salle, mobiles, rangs }) => {
      const ouvertes = [];
      salle.forEach(([c, a], t) => {
        if (a < c) ouvertes.push(t);
      });
      const partiels = rangs.map((tours) =>
        tours.map((rang) => (rang === LIBRE || ouvertes.length === 0 ? LIBRE : ouvertes[rang % ouvertes.length])),
      );
      return {
        capacites: salle.map(([c]) => c),
        ancres: salle.map(([, a]) => a),
        mobiles,
        tours: R,
        partiels,
      };
    });
}

describe("plafond a priori : la programmation dynamique contre l'énumération, grille large", () => {
  test('de 2 à 8 tables et de 2 à 5 tours, chaque case de la grille : le même plafond pour chacun', () => {
    const parCase = [];
    // Une valeur de STATUT et son compte ; la Map ne sert qu'à retrouver un
    // statut.
    const parStatut = new Map();
    for (let T = 2; T <= 8; T += 1) {
      for (let R = 2; R <= 5; R += 1) {
        let acceptees = 0;
        fc.assert(
          fc.property(arbitraireCase(T, R), (description) => {
            let instance;
            try {
              instance = instanceDe(description);
            } catch (erreur) {
              if (erreur instanceof ErreurConfiguration && erreur.code === 'SURRESERVATION') return;
              throw erreur;
            }
            if (instance.N === 0) return;
            acceptees += 1;
            for (const statut of instance.statut) parStatut.set(statut, (parStatut.get(statut) ?? 0) + 1);
            assert.deepEqual(plafondsAPriori(instance), plafondsAPrioriParEnumeration(instance));
          }),
          { seed: GRAINE + 10 * T + R, numRuns: 300 },
        );
        parCase.push([T, R, acceptees]);
      }
    }
    // Chaque case compte ses instances acceptées : une case que le
    // générateur viderait n'éprouverait rien.
    assert.equal(parCase.length, 28);
    const maigres = parCase
      .filter(([, , acceptees]) => acceptees < 200)
      .map(([T, R, n]) => `${T} tables, ${R} tours : ${n} acceptées sur 300, 200 au moins`);
    assert.deepEqual(maigres, []);
    const partiels = parStatut.get(STATUT.PARTIELLEMENT_FIXE) ?? 0;
    const ancres = parStatut.get(STATUT.ANCRE) ?? 0;
    assert.ok(partiels >= 5000, `${partiels} partiellement fixés comparés, 5000 au moins`);
    assert.ok(ancres >= 5000, `${ancres} ancrés comparés, 5000 au moins`);
  });

  test("forme de la grande démonstration et sa variante : la programmation dynamique égale l'énumération", () => {
    // Principale : 29 tables de 8 puis 4 de 7, un ancré par table. Variante :
    // 33 tables de 8, 4 places libres. 227 mobiles, 4 tours ; un mobile
    // énumère C(36, 4) = 58 905 multiensembles.
    const principale = instanceDe({
      capacites: [...Array(29).fill(8), ...Array(4).fill(7)],
      ancres: Array(33).fill(1),
      mobiles: 227,
      tours: 4,
    });
    // Les ancrés portent les identifiants 1 à 33, table par table.
    const attendu = new Array(260).fill(28);
    for (let t = 29; t < 33; t += 1) attendu[t] = 24;
    assert.deepEqual(plafondsAPriori(principale), attendu);
    assert.deepEqual(plafondsAPrioriParEnumeration(principale), attendu);

    const variante = instanceDe({
      capacites: Array(33).fill(8),
      ancres: Array(33).fill(1),
      mobiles: 227,
      tours: 4,
    });
    const vingtHuit = new Array(260).fill(28);
    assert.deepEqual(plafondsAPriori(variante), vingtHuit);
    assert.deepEqual(plafondsAPrioriParEnumeration(variante), vingtHuit);
  });

  test("la limite de l'énumération : 300 000 multiensembles passent, un de plus est refusé", () => {
    // Un tour libre : le compte est celui des tables admissibles.
    const unTour = (tables) =>
      instanceDe({ capacites: Array(tables).fill(2), ancres: [], mobiles: 1, tours: 1 });
    assert.deepEqual(plafondsAPrioriParEnumeration(unTour(300_000)), [0]);
    assert.throws(
      () => plafondsAPrioriParEnumeration(unTour(300_001)),
      (erreur) =>
        erreur instanceof ErreurConfiguration
        && erreur.code === 'ENUMERATION_TROP_GRANDE'
        && erreur.details.tablesAdmissibles === 300_001
        && erreur.details.toursLibres === 1,
    );
    // Deux tours libres : C(775, 2) = 299 925 passent, là où 774² le
    // refuserait ; C(776, 2) = 300 700 est refusé.
    const deuxTours = (tables) =>
      instanceDe({ capacites: Array(tables).fill(2), ancres: [], mobiles: 2, tours: 2 });
    const passe = deuxTours(774);
    assert.deepEqual(plafondsAPrioriParEnumeration(passe), plafondsAPriori(passe));
    assert.throws(
      () => plafondsAPrioriParEnumeration(deuxTours(775)),
      (erreur) => erreur instanceof ErreurConfiguration && erreur.code === 'ENUMERATION_TROP_GRANDE',
    );
  });
});

// Le coût du plafond a priori (§ 17, point 4). L'application le calcule à
// chaque évaluation (src/application/evaluation.js) et diagnostiquer le
// rappelle dans ses sondes, dans le fil de l'interface : ces épreuves
// empêchent une régression de rendre nécessaire le chemin « inconnu » que le
// moteur garde (§ 12.10.9, § 5.7). Le relevé de la mesure est celui du banc
// (scripts/banc/plafond.js) ; ici, une garde.
//
// L'échantillonnage suit celui de src/stockage/depot.long.test.js : après un
// appel de chauffe, ESSAIS appels mesurés, puis d'autres tant que le plus
// court dépasse le seuil, jusqu'à ESSAIS_AU_PLUS appels ou la fin de
// FENETRE_MESURE_MS, ce qui vient d'abord. Le seuil porte sur le plus court :
// le minimum écarte ce qu'une machine occupée ajoute à un appel, une
// régression allonge chacun.
const ESSAIS = 5;
const ESSAIS_AU_PLUS = 25;
const FENETRE_MESURE_MS = 10_000;

// Les références, en millisecondes, par configuration : le plus court des ESSAIS appels que
// mesurent ces épreuves, le fichier lancé seul, le plus grand de plusieurs
// lancements arrondi au-dessus à deux chiffres significatifs, sur un
// processeur x86-64 de bureau de génération Zen 3, seize cœurs virtuels sous
// KVM, sous Linux et Node 26. plafonds mesure plafondsAPriori sur l'instance
// normalisée ; diagnostic, diagnostiquer sur la configuration, normalisation
// et sondes comprises.
//
// MARGE, le facteur qui tire chaque seuil de sa référence, couvre quatre
// séries node-long lancées ensemble sur la machine des références, comme
// celle de depot.long.test.js. Elle reste assez basse pour que retirer la
// mémoïsation par signature de plafondsAPriori dépasse les seuils de la
// grande démonstration et de sa variante, où des centaines de personnes
// partagent une signature. La pessimiste n'a que des signatures distinctes :
// la mémoïsation n'y épargne rien, et son seuil garde la programmation
// dynamique elle-même, 260 fois sur 8 tours libres.
//
// Propriétaire (§ 14.1) : la série node-long, où ces épreuves relèvent la
// mesure à chaque exécution et la nomment quand elle dépasse son seuil.
const REFERENCES_MS = Object.freeze([
  Object.freeze({ cle: 'grande', plafonds: 0.19, diagnostic: 1.7 }),
  Object.freeze({ cle: 'grande-sans-exception', plafonds: 0.085, diagnostic: 0.94 }),
  Object.freeze({ cle: 'pessimiste', plafonds: 13, diagnostic: 8.8 }),
]);
const MARGE = 4;

const croissant = (a, b) => a - b;
const ms = (duree) => `${duree.toFixed(3).replace('.', ',')} ms`;

// La mesure échantillonnée d'un appel : faire s'exécute une fois pour
// chauffer, puis ESSAIS fois mesuré, puis tant que le plus court dépasse
// seuil, jusqu'à ESSAIS_AU_PLUS mesures ou la fin de FENETRE_MESURE_MS,
// comptée depuis la première. Rend les durées, dans l'ordre des appels, et
// ce qui a clos une mesure restée au-delà du seuil.
function mesurer(faire, seuil) {
  faire();
  const durees = [];
  const debut = performance.now();
  const ouverte = () => performance.now() - debut < FENETRE_MESURE_MS;
  while (durees.length < ESSAIS || (Math.min(...durees) > seuil && durees.length < ESSAIS_AU_PLUS && ouverte())) {
    const avant = performance.now();
    faire();
    durees.push(performance.now() - avant);
  }
  const arret =
    durees.length >= ESSAIS_AU_PLUS
      ? `plafond de ${ESSAIS_AU_PLUS} mesures atteint`
      : `fenêtre de ${FENETRE_MESURE_MS / 1000} s écoulée`;
  return { durees, arret };
}

// Le message d'un seuil dépassé : le minimum, le nombre de mesures, leur
// médiane et la plus longue, ce qui a clos la mesure, le seuil et la
// référence dont MARGE le tire.
function depasse(quoi, { durees, arret }, seuil, reference) {
  const triees = [...durees].sort(croissant);
  return (
    `${quoi} prend ${ms(triees[0])} au minimum de ${durees.length} mesures ` +
    `(médiane ${ms(triees[Math.floor((triees.length - 1) / 2)])}, la plus longue ${ms(triees.at(-1))} ; ` +
    `${arret}), au-delà du seuil de ${ms(seuil)} (§ 17, point 4) : référence ${ms(reference)}, MARGE ${MARGE}`
  );
}

// La configuration de clé donnée : une démonstration du catalogue, ou la
// pessimiste.
function configurationDe(cle) {
  if (cle === 'pessimiste') return configurationPessimiste();
  return CATALOGUE.find((entree) => entree.cle === cle).construire();
}

// Un plan de l'instance, sans rien tirer : à chaque tour, chaque présent
// fixé à sa table, puis chaque présent libre, par index croissant, au
// premier siège qui reste, de la table d'index (p + r) modulo T en
// avançant ; sans siège, en réserve. Un absent vaut RESERVE. Les tables qui
// reçoivent un libre gardent un siège après les fixés : aucune n'est
// entièrement ancrée.
function planDesPresents({ N, T, R, fixe, capacite, present }) {
  const tableDe = new Int32Array(N * R).fill(RESERVE);
  for (let r = 0; r < R; r += 1) {
    const sieges = Int32Array.from(capacite);
    for (let p = 0; p < N; p += 1) {
      const t = fixe[p * R + r];
      if (present[p * R + r] === 1 && t !== LIBRE) {
        tableDe[p * R + r] = t;
        sieges[t] -= 1;
      }
    }
    for (let p = 0; p < N; p += 1) {
      if (present[p * R + r] === 0 || fixe[p * R + r] !== LIBRE) continue;
      for (let essai = 0; essai < T; essai += 1) {
        const t = (p + r + essai) % T;
        if (sieges[t] === 0) continue;
        tableDe[p * R + r] = t;
        sieges[t] -= 1;
        break;
      }
    }
  }
  return tableDe;
}

describe('plafond a priori sous la présence par tour : des présences tirées (§ 5.5, § 14.12)', () => {
  test("de 2 à 5 tables et de 2 à 5 tours, chacun présent à des tours tirés : le même plafond que l'énumération, et la chaîne des plafonds sur un plan", () => {
    // Une présence sur trois couvre chaque tour ; les autres, une partie
    // non vide des tours, tirée. Les ancrés en reçoivent aussi : absents à un
    // tour, ils deviennent partiellement fixés.
    const arbitraire = fc
      .tuple(fc.integer({ min: 2, max: 5 }), fc.integer({ min: 2, max: 5 }))
      .chain(([T, R]) =>
        fc.tuple(
          arbitraireCase(T, R),
          fc.array(
            fc.oneof(
              { arbitrary: fc.constant(undefined), weight: 1 },
              { arbitrary: fc.subarray(Array.from({ length: R }, (_, r) => r + 1), { minLength: 1 }), weight: 2 },
            ),
            { minLength: 40, maxLength: 40 },
          ),
        ),
      );
    const bilan = { acceptees: 0, absences: 0, partiels: 0, ancres: 0 };
    fc.assert(
      fc.property(arbitraire, ([description, presences]) => {
        let instance;
        try {
          instance = instanceDe({ ...description, presences });
        } catch (erreur) {
          if (erreur instanceof ErreurConfiguration && erreur.code === 'SURRESERVATION') return;
          throw erreur;
        }
        if (instance.N === 0) return;
        bilan.acceptees += 1;
        bilan.absences += instance.absences;
        for (const statut of instance.statut) {
          if (statut === STATUT.PARTIELLEMENT_FIXE) bilan.partiels += 1;
          if (statut === STATUT.ANCRE) bilan.ancres += 1;
        }
        const aPriori = plafondsAPriori(instance);
        assert.deepEqual(aPriori, plafondsAPrioriParEnumeration(instance));
        const tableDe = planDesPresents(instance);
        const { rencontres } = mesurerPlan(instance, tableDe);
        const realises = plafondsRealises(instance, tableDe);
        for (let p = 0; p < instance.N; p += 1) {
          const chaine = [rencontres[p], realises[p], aPriori[p], instance.coPresents[p], instance.N - 1];
          assert.ok(chaine.every((valeur, i) => i === 0 || chaine[i - 1] <= valeur), `personne d'index ${p} : ${chaine.join(' ≤ ')}`);
        }
      }),
      { seed: GRAINE + 7, numRuns: 2000 },
    );
    assert.ok(bilan.acceptees >= 1500, `${bilan.acceptees} instances acceptées, 1500 au moins`);
    assert.ok(bilan.absences >= 10_000, `${bilan.absences} absences, 10 000 au moins`);
    assert.ok(bilan.partiels >= 1000 && bilan.ancres >= 1000, `${bilan.partiels} partiels, ${bilan.ancres} ancrés`);
  });
});

describe("plafond a priori : le coût, sous un seuil tiré d'une référence (§ 17, point 4)", () => {
  test('la configuration pessimiste : 260 personnes sur 33 tables de 8 et 10 tours, deux tours fixés chacune, 260 signatures distinctes', () => {
    const instance = normaliser(configurationPessimiste());
    assert.deepEqual(
      { N: instance.N, T: instance.T, R: instance.R },
      { N: FORME_PESSIMISTE.personnes, T: FORME_PESSIMISTE.tables, R: FORME_PESSIMISTE.tours },
    );
    assert.deepEqual([...instance.capacite], Array(FORME_PESSIMISTE.tables).fill(FORME_PESSIMISTE.capacite));
    // La signature est le statut, l'ancrage et le multiensemble des tables
    // fixées : sans ancré, chaque personne partiellement fixée, des
    // multiensembles distincts font des signatures distinctes.
    assert.equal(instance.k, 0);
    const multiensembles = new Set();
    for (let p = 0; p < instance.N; p += 1) {
      assert.equal(instance.statut[p], STATUT.PARTIELLEMENT_FIXE);
      const fixees = [...instance.fixe.subarray(p * instance.R, (p + 1) * instance.R)].filter((t) => t !== LIBRE);
      assert.equal(fixees.length, 2);
      multiensembles.add(fixees.sort(croissant).join(','));
    }
    assert.equal(multiensembles.size, FORME_PESSIMISTE.personnes);
  });

  for (const reference of REFERENCES_MS) {
    const { cle } = reference;
    const seuilPlafonds = reference.plafonds * MARGE;
    const seuilDiagnostic = reference.diagnostic * MARGE;
    test(`${cle} : plafondsAPriori en au plus ${ms(seuilPlafonds)}, diagnostiquer en au plus ${ms(seuilDiagnostic)}, chacun au minimum de ${ESSAIS} à ${ESSAIS_AU_PLUS} mesures après un appel de chauffe`, () => {
      const configuration = configurationDe(cle);
      const instance = normaliser(configuration);
      const plafonds = mesurer(() => plafondsAPriori(instance), seuilPlafonds);
      const diagnostic = mesurer(() => diagnostiquer(configuration), seuilDiagnostic);
      assert.ok(
        Math.min(...plafonds.durees) <= seuilPlafonds,
        depasse(`plafondsAPriori sur ${cle}`, plafonds, seuilPlafonds, reference.plafonds),
      );
      assert.ok(
        Math.min(...diagnostic.durees) <= seuilDiagnostic,
        depasse(`diagnostiquer sur ${cle}`, diagnostic, seuilDiagnostic, reference.diagnostic),
      );
    });
  }

  test('la grande démonstration à six motifs de présence : plafondsAPriori et diagnostiquer sous le double de leur durée sans absence, mesurée ici', () => {
    const sans = configurationDe('grande');
    // Chaque personne sans réservation ni tour animé reçoit, une fois sur
    // trois, l'un de six motifs de présence, par un générateur congruentiel
    // de graine fixe dont seuls les bits de poids fort servent.
    const MOTIFS = [[1], [1, 2], [2, 3, 4], [3, 4], [1, 3], [4]];
    const reservees = new Set(sans.reservations.map(({ participant }) => participant));
    let etat = GRAINE;
    const tirer = (n) => {
      etat = (Math.imul(etat, 1_103_515_245) + 12_345) >>> 0;
      return (etat >>> 16) % n;
    };
    const avec = {
      ...sans,
      participants: sans.participants.map((personne) =>
        reservees.has(personne.id) || personne.anime !== undefined || tirer(3) !== 0
          ? personne
          : { ...personne, presence: MOTIFS[tirer(MOTIFS.length)] }),
    };
    const instanceSans = normaliser(sans);
    const instanceAvec = normaliser(avec);
    const motifs = new Set(avec.participants.filter(({ presence }) => presence !== undefined).map(({ presence }) => presence.join(',')));
    assert.equal(motifs.size, 6);
    assert.ok(instanceAvec.absences >= 100, `${instanceAvec.absences} absences`);
    // Le nombre de programmes ne croît pas avec les motifs : un de plus par
    // compte de tours libres présents, ici de 1 à 3.
    assert.equal(programmesDuPlafond(instanceAvec), programmesDuPlafond(instanceSans) + 3);
    const eprouver = (quoi, faireSans, faireAvec) => {
      const reference = mesurer(faireSans, Number.POSITIVE_INFINITY);
      const seuil = 2 * Math.min(...reference.durees);
      const mesure = mesurer(faireAvec, seuil);
      assert.ok(
        Math.min(...mesure.durees) <= seuil,
        depasse(`${quoi} sous absences`, mesure, seuil, Math.min(...reference.durees)),
      );
    };
    eprouver('plafondsAPriori', () => plafondsAPriori(instanceSans), () => plafondsAPriori(instanceAvec));
    eprouver('diagnostiquer', () => diagnostiquer(sans), () => diagnostiquer(avec));
  });
});

// Organisations inventées des salles énumérées.
const AUBIER = 'Coopérative Aubier';
const RESSAC = 'Atelier Ressac';
const BRISANT = 'Collectif Brisant';

/**
 * Instance d'une salle aux organisations données : personnes[i] = [id,
 * organisation ou null] ; la table d'index t a la capacité capacites[t] et
 * l'identifiant 100 + t ; reservations : [id, index de table, tour ou null],
 * null pour tous les tours.
 */
function salle({ personnes, capacites, tours, reservations }) {
  return normaliser({
    participants: personnes.map(([id, organisation]) => ({ id, nom: `P${id}`, organisation })),
    tables: capacites.map((capacite, t) => ({ id: 100 + t, numero: t + 1, capacite })),
    tours,
    reservations: reservations.map(([participant, t, tour]) =>
      tour === null
        ? { participant, table: 100 + t, portee: 'tous' }
        : { participant, table: 100 + t, portee: 'tour', tour },
    ),
    contraintes: SANS_CONTRAINTE,
  });
}

// Chaque affectation du tour r : les personnes fixées à leur table, chacune
// des autres, par index croissant, à chaque table qui garde un siège, puis en
// réserve quand reserve est vrai. Une affectation est un Int32Array de N
// cases, index de table ou RESERVE.
function affectationsDuTour({ N, T, R, fixe, capacite }, r, reserve) {
  const sieges = Int32Array.from(capacite);
  const courante = new Int32Array(N).fill(RESERVE);
  const aPlacer = [];
  for (let p = 0; p < N; p += 1) {
    const t = fixe[p * R + r];
    if (t === LIBRE) {
      aPlacer.push(p);
    } else {
      courante[p] = t;
      sieges[t] -= 1;
    }
  }
  const affectations = [];
  const poser = (i) => {
    if (i === aPlacer.length) {
      affectations.push(Int32Array.from(courante));
      return;
    }
    const p = aPlacer[i];
    for (let t = 0; t < T; t += 1) {
      if (sieges[t] === 0) continue;
      sieges[t] -= 1;
      courante[p] = t;
      poser(i + 1);
      sieges[t] += 1;
    }
    if (reserve) {
      courante[p] = RESERVE;
      poser(i + 1);
    }
  };
  poser(0);
  return affectations;
}

// Chaque plan de l'instance, sur le gabarit de plafondsAPrioriParEnumeration :
// une affectation par tour, les suites d'affectations dans l'ordre
// lexicographique, de (0, …, 0) au dernier rang de chaque tour. Appelle
// visiter(tableDe) pour chacun ; le même Int32Array sert d'un plan à l'autre.
// Rend le nombre de plans visités.
function enumererPlans(instance, reserve, visiter) {
  const { N, R } = instance;
  const parTour = Array.from({ length: R }, (_, r) => affectationsDuTour(instance, r, reserve));
  const choix = new Int32Array(R);
  const tableDe = new Int32Array(N * R);
  let plans = 0;
  for (;;) {
    for (let r = 0; r < R; r += 1) {
      const affectation = parTour[r][choix[r]];
      for (let p = 0; p < N; p += 1) tableDe[p * R + r] = affectation[p];
    }
    visiter(tableDe);
    plans += 1;
    let r = R - 1;
    while (r >= 0 && choix[r] === parTour[r].length - 1) r -= 1;
    if (r < 0) return plans;
    choix[r] += 1;
    for (let q = r + 1; q < R; q += 1) choix[q] = 0;
  }
}

describe('borne de diversité : chaque plan de deux salles inventées (§ 5.5, B5, § 14.12)', () => {
  // Pour chaque plan : A(p) ≤ A_max(p) et |F(p)| ≤ Φ_aff(p) pour chacun ;
  // sur l'ensemble des plans, Φ_aff(p) atteint pour une personne au moins.
  // Rend les écarts, en lignes lisibles, les personnes qui atteignent leur
  // Φ_aff non nul à un plan au moins, le nombre de plans et celui des plans
  // qui laissent quelqu'un en réserve.
  function eprouver(instance, reserve) {
    const ecarts = [];
    const atteintes = new Set();
    let avecReserve = 0;
    const plans = enumererPlans(instance, reserve, (tableDe) => {
      const { phiAffilies, aMax } = borneDiversite(instance, tableDe);
      const { organisationsVues, affilies } = mesurerPlan(instance, tableDe);
      if (tableDe.includes(RESERVE)) avecReserve += 1;
      for (let p = 0; p < instance.N; p += 1) {
        const id = instance.ids[p];
        if (organisationsVues[p] > aMax[p]) ecarts.push(`${tableDe.join(',')} : A(${id}) > A_max`);
        if (affilies[p] > phiAffilies[p]) ecarts.push(`${tableDe.join(',')} : |F(${id})| > Φ_aff`);
        if (phiAffilies[p] > 0 && affilies[p] === phiAffilies[p]) atteintes.add(id);
      }
    });
    return { ecarts: ecarts.slice(0, 10), atteintes: [...atteintes].sort((x, y) => x - y), plans, avecReserve };
  }

  test('une table de 3 et une de 2, 2 tours, la réserve permise : un ancré affilié, un partiellement fixé, une personne sans organisation', () => {
    // 1 (Aubier) ancré à la table de 3 ; 3 (Ressac) fixé à la table de 2 au
    // tour 1 ; 2 (Aubier), 4 (Ressac), 5 sans organisation, libres.
    const instance = salle({
      personnes: [[1, AUBIER], [2, AUBIER], [3, RESSAC], [4, RESSAC], [5, null]],
      capacites: [3, 2],
      tours: 2,
      reservations: [[1, 0, null], [3, 1, 1]],
    });
    const { ecarts, atteintes, plans, avecReserve } = eprouver(instance, true);
    assert.deepEqual(ecarts, []);
    // 19 affectations au tour 1, 63 au tour 2 ; tous sauf 18 laissent
    // quelqu'un en réserve. Chacun atteint son Φ_aff à un plan au moins.
    assert.deepEqual({ plans, avecReserve }, { plans: 1197, avecReserve: 1179 });
    assert.deepEqual(atteintes, [1, 2, 3, 4, 5]);
  });

  test('trois tables de 2, 3 tours, chacun assis : un ancré seul de son organisation, un partiellement fixé', () => {
    // 1 (Brisant) ancré à la table d'index 2 ; 5 (Ressac) fixé à la table
    // d'index 0 au tour 2 ; 2, 3, 6 (Aubier), 4 (Ressac), libres.
    const instance = salle({
      personnes: [[1, BRISANT], [2, AUBIER], [3, AUBIER], [4, RESSAC], [5, RESSAC], [6, AUBIER]],
      capacites: [2, 2, 2],
      tours: 3,
      reservations: [[1, 2, null], [5, 0, 2]],
    });
    const { ecarts, atteintes, plans, avecReserve } = eprouver(instance, false);
    assert.deepEqual(ecarts, []);
    // 30 affectations aux tours 1 et 3, 12 au tour 2.
    assert.deepEqual({ plans, avecReserve }, { plans: 10_800, avecReserve: 0 });
    assert.deepEqual(atteintes, [1, 2, 3, 4, 5, 6]);
  });
});
