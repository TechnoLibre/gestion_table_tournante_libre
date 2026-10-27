// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves lourdes de la recherche (§ 5.10, § 14.10, § 15.3). Sur chacune des
// quatre démonstrations, une suite déterministe de mouvements, acceptés ou
// défaits, confronte l'état tenu à jour au recalcul complet, et son score au
// n-uplet que l'oracle de test/oracle_score.js énumère sur la configuration
// hors du moteur, à 1, 10, 100, 1 000 et 10 000 mouvements appliqués, et non
// au seul terme : une dérive qui se compense passe inaperçue à la fin, et le
// palier où un désaccord affleure est le chiffre que l'épreuve rend. Les
// mouvements gardés, défaits du dernier au premier, ramènent le score au
// départ. Le relevé liste chaque désaccord, palier et grandeur, au lieu de
// s'arrêter au premier. La même suite se joue sur une configuration inventée
// qui porte des objectifs de table — de soirée et de tour, des personnes aux
// tours possibles inégaux —, des animateurs — l'un d'un seul tour, une table
// à deux titres —, et des conflits d'organisation — une organisation en nomme
// une autre, une personne sans organisation une troisième —, les deux
// critères cochés, sous chacun des trois modes et sous un ordre déplacé
// (A13). La petite démonstration et sa variante conflit atteignent ensuite
// leur optimum sur vingt graines, trois propositions chacune, sous l'ordre du
// registre ; une recherche longue sur la grande démonstration rend des plans
// que jugent verifierInvariants et verifierIndicateurs, et chaque point de
// relevé de sa course égale le plan que regenerer rend à son compte. Une
// dérivée sur la grande démonstration, deux tours figés, rend de même chaque
// point de relevé par regenerer sous son départ, chacun portant les tours
// figés du départ, liste pour liste. Sur la grande démonstration où une
// personne sur sept est absente à un tour, l'état tenu à jour s'accorde au
// recalcul à chaque palier, et une recherche longue n'assied aucune absente,
// assied chaque présente une fois par tour, et tient la chaîne des plafonds
// jusqu'aux co-présents.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { FLUX, creerPcg32 } from '../demo/prng.js';
import { indexerPlan, normaliser } from './configuration.js';
import { CRITERES } from './criteres.js';
import { mesurer } from './indicateurs.js';
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
import { differences, empreintesDesPlans, exigerVerification, lireEmpreintes } from '../../test/empreintes_moteur.js';
import { scoreOracle } from '../../test/oracle_score.js';

const PALIERS = [1, 10, 100, 1_000, 10_000];
// Graine des suites de mouvements, écrite ici.
const GRAINE = 271_828;
// Un mouvement appliqué sur trois est défait : la suite passe par les deux
// chemins, l'acceptation et le retour en arrière.
const DEFAIT_TOUS_LES = 3;
// Propositions de mouvement au-delà desquelles une suite renonce : une
// instance où aucun mouvement ne s'applique n'atteindrait jamais le dernier
// palier.
const ESSAIS_MAX = 100 * PALIERS.at(-1);

// Vrai quand deux listes de nombres ont la même longueur et les mêmes
// valeurs, rang par rang, chacune un nombre fini : deux champs absents, deux
// undefined, ne s'accordent pas.
const egales = (a, b) =>
  a.length === b.length && a.every((valeur, i) => Number.isFinite(valeur) && valeur === b[i]);

// Ajoute à releve un libellé « palier : grandeur » pour chaque grandeur où
// l'état tenu à jour diffère du recalcul complet, et « palier : score
// énuméré » quand le score tenu à jour diffère du n-uplet que l'oracle
// énumère sur la configuration, hors du moteur ; aPriori porte les plafonds
// a priori de l'instance.
function relever(etat, instance, configuration, aPriori, palier, releve) {
  const mesures = mesurer(instance, etat.tableDe);
  const confronter = (grandeur, tenue, recalculee) => {
    if (!egales(tenue, recalculee)) releve.push(`${palier} : ${grandeur}`);
  };
  confronter('score', scoreIncremental(etat), scoreComplet(etat));
  confronter('score énuméré', scoreIncremental(etat), scoreOracle(instance, etat.tableDe, aPriori, configuration).nUplet);
  confronter('rencontres', Array.from(etat.rencontres), mesures.rencontres);
  confronter('affilies', Array.from(etat.affilies), mesures.affilies);
  confronter('organisationsVues', Array.from(etat.organisationsVues), mesures.organisationsVues);
  confronter('collisionsCumulees', [etat.collisionsCumulees], [mesures.collisionsCumulees]);
  confronter('excedentCollisions', [etat.excedentCollisions], [mesures.excedentCollisions]);
  confronter('totalRetoursChoisis', [etat.totalRetoursChoisis], [mesures.totalRetoursChoisis]);
  confronter('totalRedondance', [etat.totalRedondance], [mesures.totalRedondance]);
  if (mesures.objectifs !== null) {
    const { tours, horsObjectif, jamaisServies, horsObjectifMax, personnesAuMax } = mesures.objectifs;
    confronter('servis', Array.from(etat.servis), tours);
    confronter(
      'objectifs',
      [etat.horsObjectif, etat.jamaisServies, etat.horsObjectifMax, etat.personnesAuMax],
      [horsObjectif, jamaisServies, horsObjectifMax, personnesAuMax],
    );
  }
  if (mesures.animateurs !== null) {
    confronter('rencontresAnimateurs', Array.from(etat.rencontresAnimateurs), mesures.animateurs.rencontres);
    confronter('animateursNonRencontres', [etat.animateursNonRencontres], [mesures.animateurs.nonRencontres]);
  }
}

// La suite déterministe de mouvements sur la configuration, relevée à chaque
// palier, puis chaque mouvement gardé défait, du dernier au premier : le
// relevé porte « retour : score » quand le score tenu à jour ne revient pas
// à celui du départ. Rend le relevé, et les comptes de mouvements appliqués
// et défaits pendant la suite.
function suivre(configuration) {
  const instance = normaliser(configuration);
  const aPriori = plafondsAPriori(instance);
  const rng = creerPcg32(GRAINE, FLUX.RECHERCHE);
  const etat = creerEtat(instance, rng);
  const depart = scoreIncremental(etat);
  const releve = [];
  relever(etat, instance, configuration, aPriori, 0, releve);
  const gardes = [];
  let appliques = 0;
  let defaits = 0;
  let palier = 0;
  for (let essai = 0; palier < PALIERS.length && essai < ESSAIS_MAX; essai += 1) {
    const mouvement = proposerEtAppliquer(etat, rng);
    if (mouvement === null) continue;
    appliques += 1;
    if (appliques % DEFAIT_TOUS_LES === 0) {
      defaire(etat, mouvement);
      defaits += 1;
    } else {
      gardes.push(mouvement);
    }
    if (appliques === PALIERS[palier]) {
      relever(etat, instance, configuration, aPriori, appliques, releve);
      palier += 1;
    }
  }
  for (const mouvement of gardes.reverse()) defaire(etat, mouvement);
  if (!egales(scoreIncremental(etat), depart)) releve.push('retour : score');
  return { releve, appliques, defaits };
}

// Une entrée de palier.
const e = (critere, poids = 1) => ({ critere, poids });

// Une soirée inventée de quatorze personnes, quatre tables de 4, quatre
// tours, les six cases cochées. Objectifs : table 1 « finance » pour la
// soirée ; table 2 « finance ET Montréal » pour la soirée, « Montréal » au
// tour 2 ; table 3 « bénévole » au tour 3. 1 à 3 portent « finance », 4 et 5
// « finance » et « Montréal », 6 et 7 « Montréal », 8 et 9 « bénévole ». 6
// est réservé à la table 1 au tour 1, 1 à la table 4 au tour 4 : leurs tours
// possibles sont inégaux. 2 est réservé à la table 1 au tour 3, 4 à la table
// 2 au tour 1 : deux places réservées qui servent (D5), l'une sous « ou »,
// l'autre sous « et ». 10 anime à la table 1 à chaque tour ; 11 et 12
// tiennent les deux titres de la table 3 au seul tour 2 ; 13 est réservé
// sans animer. Les conflits d'organisation relient A et B, et la personne 4
// à C.
function soireeAObjectifs(mode, priorites) {
  const etiquettes = [
    ['finance'], ['finance'], ['finance'], ['Montréal', 'finance'], ['Montréal', 'finance'],
    ['Montréal'], ['Montréal'], ['bénévole'], ['bénévole'],
  ];
  const anime = new Map([[10, [1, 2, 3, 4]], [11, [2]], [12, [2]]]);
  const conflits = new Map([[1, ['B']], [4, ['C']]]);
  const auTour = (participant, table, tour) => ({ participant, table, portee: 'tour', tour });
  return {
    participants: Array.from({ length: 14 }, (_, rang) => ({
      id: rang + 1,
      organisation: ['A', 'B', 'C', null][rang % 4],
      ...(rang < etiquettes.length ? { etiquettes: etiquettes[rang] } : {}),
      ...(anime.has(rang + 1) ? { anime: anime.get(rang + 1) } : {}),
      ...(conflits.has(rang + 1) ? { conflits: conflits.get(rang + 1) } : {}),
    })),
    tables: [1, 2, 3, 4].map((id) => ({ id, capacite: 4 })),
    tours: 4,
    reservations: [
      { participant: 10, table: 1, portee: 'tous' },
      auTour(11, 3, 2), auTour(12, 3, 2), auTour(6, 1, 1), auTour(1, 4, 4), auTour(13, 2, 3),
      auTour(2, 1, 3), auTour(4, 2, 1),
    ],
    contraintes: {
      separerOrganisations: true,
      nouveauxVoisins: true,
      nouvelleTable: true,
      varierOrganisations: true,
      respecterObjectifs: true,
      rencontrerAnimateurs: true,
    },
    objectifs: [
      { table: 1, tour: null, regle: 'ou', etiquettes: ['finance'] },
      { table: 2, tour: null, regle: 'et', etiquettes: ['Montréal', 'finance'] },
      { table: 2, tour: 2, regle: 'ou', etiquettes: ['Montréal'] },
      { table: 3, tour: 3, regle: 'ou', etiquettes: ['bénévole'] },
    ],
    ...(mode === 'places' ? {} : { modeObjectifs: mode }),
    ...(priorites === undefined ? {} : { priorites }),
  };
}

// Les ordres déplacés : sous places, le palier { excédent × 1, tours hors
// objectif × 3 } en deuxième, le conflit d'organisation en quatrième ; sous
// les deux autres modes, les tours hors objectif seuls en deuxième, le
// conflit d'organisation en dernier.
const ORDRES_DEPLACES = {
  places: [
    [e('ecartAuPlafondAPrioriMax')],
    [e('excedentCollisions'), e('toursHorsObjectif', 3)],
    [e('collisionsCumulees')],
    [e('conflitsOrganisation')],
    [e('rencontresRepetees')],
    [e('animateursNonRencontres', 2)],
    [e('redondance')],
  ],
  autres: [
    [e('ecartAuPlafondAPrioriMax')],
    [e('toursHorsObjectif')],
    [e('excedentCollisions')],
    [e('collisionsCumulees')],
    [e('rencontresRepetees')],
    [e('animateursNonRencontres'), e('redondance', 4)],
    [e('conflitsOrganisation')],
  ],
};

describe('recherche : incrémental contre recalcul complet (§ 5.10, § 14.10)', () => {
  test('le catalogue fournit les quatre démonstrations éprouvées ci-dessous', () => {
    assert.equal(CATALOGUE.length, 4);
  });

  for (const { cle, construire } of CATALOGUE) {
    test(`${cle} : accord à 1, 10, 100, 1 000 et 10 000 mouvements`, () => {
      const { releve, appliques, defaits } = suivre(construire());
      assert.equal(appliques, PALIERS.at(-1), `${cle} : mouvements appliqués`);
      assert.equal(defaits, Math.floor(PALIERS.at(-1) / DEFAIT_TOUS_LES));
      assert.deepEqual(releve, [], cle);
    });
  }

  for (const mode of ['places', 'chacun', 'minimum']) {
    for (const [ordre, priorites] of [['ordre par défaut', undefined], ['ordre déplacé', mode === 'places' ? ORDRES_DEPLACES.places : ORDRES_DEPLACES.autres]]) {
      test(`soirée à objectifs et animateurs, ${mode}, ${ordre} : accord à 1, 10, 100, 1 000 et 10 000 mouvements`, () => {
        const configuration = soireeAObjectifs(mode, priorites);
        const instance = normaliser(configuration);
        assert.ok(instance.etatCriteres.every(({ coche, sansObjet }) => coche && !sansObjet));
        assert.ok(instance.pairesEnConflit > 0);
        const { releve, appliques } = suivre(configuration);
        assert.equal(appliques, PALIERS.at(-1));
        assert.deepEqual(releve, [], `${mode}, ${ordre}`);
      });
    }
  }
});

// Graines 0 à GRAINES − 1, trois propositions chacune : l'optimum se juge sur
// une suite de graines, et non sur une seule, qu'un réglage de l'algorithme
// pourrait servir par hasard.
const GRAINES = 20;

describe('recherche : la petite démonstration et sa variante, sur vingt graines, l’ordre du registre (§ 5.7, § 15.3)', () => {
  // Plancher de collisions cumulées : aucune dans la petite démonstration ;
  // une par tour dans la variante, dont le groupe de cinq ne se répartit pas
  // sur quatre tables, chacune d'une paire différente au mieux.
  //
  // L'ordre du registre, chaque critère seul à son palier : l'écart au
  // plafond a priori en tête, puis l'excédent, les collisions cumulées, les
  // tours hors objectif et seulement ensuite les rencontres répétées. La
  // recherche annule d'abord l'écart, puis la bascule passe les contraintes
  // devant lui, les collisions avant les rencontres répétées. C'est l'ordre
  // où chaque proposition atteint l'optimum ; l'ordre par défaut, qui range
  // l'excédent, les rencontres répétées et les collisions cumulées devant
  // l'écart, s'éprouve à part, sur des planchers.
  const ORDRE_DU_REGISTRE = CRITERES.map((critere) => [{ critere, poids: 1 }]);
  for (const [cle, plancher] of [['petite', 0], ['petite-conflit', 4]]) {
    test(`${cle} : chaque proposition rencontre 8 pour les douze, sans répétition, ${plancher} collisions sur ${plancher} paires`, () => {
      const configuration = { ...CATALOGUE.find((entree) => entree.cle === cle).construire(), priorites: ORDRE_DU_REGISTRE };
      const instance = normaliser(configuration);
      const manquees = [];
      let examinees = 0;
      for (let graine = 0; graine < GRAINES; graine += 1) {
        for (const { id, plan } of rechercher(configuration, { graine, arret: 200_000, nombre: 3 })) {
          examinees += 1;
          const m = mesurer(instance, indexerPlan(instance, plan));
          const optimale = m.rencontres.every((rencontres) => rencontres === 8)
            && m.maxRencontresPaire === 1
            && m.collisionsCumulees === plancher
            && m.pairesDistinctes === plancher;
          if (!optimale) {
            manquees.push(
              `graine ${graine}, proposition ${id} : minimum ${m.aggRencontres.tous.min}, `
                + `collisions ${m.collisionsCumulees} sur ${m.pairesDistinctes} paires, `
                + `paire la plus revue ${m.maxRencontresPaire} fois`,
            );
          }
        }
      }
      assert.equal(examinees, 3 * GRAINES);
      assert.deepEqual(manquees, []);
    });
  }
});

describe('recherche : recherche longue sur la grande démonstration (§ 14.12)', () => {
  test('arret 200 000 : plans valides, et rencontres ≤ plafond réalisé ≤ plafond a priori ≤ N − 1', () => {
    const configuration = CATALOGUE.find((entree) => entree.cle === 'grande').construire();
    const instance = normaliser(configuration);
    const aPriori = plafondsAPriori(instance);
    const propositions = rechercher(configuration, { graine: 31, arret: 200_000, nombre: 2 });
    assert.equal(propositions.length, 2);
    for (const { id, plan } of propositions) {
      assert.deepEqual(verifierInvariants(instance, plan), [], `proposition ${id}`);
      const tableDe = indexerPlan(instance, plan);
      const mesures = mesurer(instance, tableDe);
      assert.deepEqual(
        verifierIndicateurs(mesures, aPriori, plafondsRealises(instance, tableDe)),
        [],
        `proposition ${id}`,
      );
    }
  });
});

describe('recherche : le mode ne touche pas au défaut, grande démonstration et sa variante (A21)', () => {
  exigerVerification(process.env);
  const REFERENCE = lireEmpreintes();
  for (const mode of ['chacun', 'minimum']) {
    for (const cle of ['grande', 'grande-sans-exception']) {
      test(`${cle}, ${mode} : les plans des empreintes de référence`, () => {
        assert.deepEqual(differences(`${cle}, ${mode}`, empreintesDesPlans(cle, undefined, mode), REFERENCE.plans[cle]), []);
      });
    }
  }
});

// Les puissances de dix strictement sous n, croissantes : les abscisses des
// points de relevé copiés d'une descente de n mouvements évalués.
function puissancesSous(n) {
  const liste = [];
  for (let k = 1; k < n; k *= 10) liste.push(k);
  return liste;
}

describe('recherche : la course sur la grande démonstration (§ 5.10, B6, D40)', () => {
  // Arrêt au compte : 200 000 mouvements évalués, six points copiés, de 1 à
  // 100 000, chacun le plan que la même graine rend à son compte ; le
  // dernier point, 200 000, est le plan de la proposition.
  for (const cle of ['grande', 'grande-sans-exception']) {
    test(`${cle}, arret 200 000 : le point de relevé k égale regenerer au compte k, de 1 à 100 000`, () => {
      const configuration = CATALOGUE.find((entree) => entree.cle === cle).construire();
      const [proposition] = rechercher(configuration, { graine: 31, arret: 200_000, nombre: 1 });
      const { graine, historique, evalues, releves, plan } = proposition;
      assert.equal(evalues, 200_000);
      assert.deepEqual(releves.map(({ mouvements }) => mouvements), puissancesSous(evalues));
      assert.equal(releves.length, 6);
      for (const { mouvements, plan: copie } of releves) {
        assert.deepStrictEqual(copie, regenerer(configuration, { graine, arret: mouvements, historique }), `${cle}, point ${mouvements}`);
      }
      assert.deepStrictEqual(plan, regenerer(configuration, { graine, arret: evalues, historique }));
    });
  }
});

describe('repartir : la course d\'une dérivée sur la grande démonstration (§ 5.7, § 8.9, C24)', () => {
  // Le départ : une proposition à compte court. La dérivée compte 20 000
  // mouvements, cinq points copiés de 1 à 10 000, chacun le plan que
  // regenerer rend à son compte sous le même départ et les mêmes tours
  // figés ; le dernier, 20 000, est le plan de la proposition.
  for (const cle of ['grande', 'grande-sans-exception']) {
    test(`${cle}, tours 1 et 3 figés, arret 20 000 : le point de relevé k égale regenerer au compte k, de 1 à 10 000`, () => {
      const configuration = CATALOGUE.find((entree) => entree.cle === cle).construire();
      const instance = normaliser(configuration);
      const [{ plan: planDuDepart }] = rechercher(configuration, { graine: 17, arret: 2_000, nombre: 1 });
      const toursFiges = [1, 3];
      const [proposition] = repartir(configuration, { graine: 31, arret: 20_000, nombre: 1 }, { plan: planDuDepart, toursFiges });
      const { evalues, releves, plan } = proposition;
      assert.equal(evalues, 20_000);
      assert.deepEqual(releves.map(({ mouvements }) => mouvements), puissancesSous(evalues));
      const fichier = { ...proposition, depart: 1, toursFiges };
      for (const { mouvements, plan: copie } of releves) {
        assert.deepStrictEqual(copie, regenerer(configuration, { ...fichier, arret: mouvements }, { planDuDepart }), `${cle}, point ${mouvements}`);
      }
      assert.deepStrictEqual(plan, regenerer(configuration, fichier, { planDuDepart }));
      for (const { mouvements, plan: point } of [...releves, { mouvements: evalues, plan }]) {
        for (const r of [0, 2]) assert.deepEqual(point.tours[r], planDuDepart.tours[r], `${cle}, point ${mouvements}, tour ${r + 1}`);
      }
      assert.deepEqual(verifierInvariants(instance, plan), []);
      assert.notDeepStrictEqual(plan.tours[1], planDuDepart.tours[1]);
    });
  }
});

// La grande démonstration où une personne sur sept, sans réservation ni tour
// animé, est absente à un tour : la k-ième d'entre elles l'est au tour
// (k mod R) + 1.
function grandeSousAbsences() {
  const configuration = CATALOGUE.find((entree) => entree.cle === 'grande').construire();
  const reserves = new Set(configuration.reservations.map(({ participant }) => participant));
  let k = 0;
  const participants = configuration.participants.map((participant, rang) => {
    if (rang % 7 !== 0 || reserves.has(participant.id) || participant.anime !== undefined || participant.exclu) return participant;
    const absent = (k % configuration.tours) + 1;
    k += 1;
    const presence = Array.from({ length: configuration.tours }, (_, r) => r + 1).filter((tour) => tour !== absent);
    return { ...participant, presence };
  });
  return { ...configuration, participants };
}

describe('recherche : la grande démonstration sous absences (§ 5.9, § 5.10, § 14.10)', () => {
  test('accord à 1, 10, 100, 1 000 et 10 000 mouvements, plus de trente absences', () => {
    const configuration = grandeSousAbsences();
    const instance = normaliser(configuration);
    assert.ok(instance.absences >= 30, `${instance.absences} absences`);
    const { releve, appliques } = suivre(configuration);
    assert.equal(appliques, PALIERS.at(-1));
    assert.deepEqual(releve, []);
  });

  test("arret 200 000 : aucune absente listée, chaque présente assise une fois par tour, et rencontres ≤ plafond réalisé ≤ plafond a priori ≤ co-présents", () => {
    const configuration = grandeSousAbsences();
    const instance = normaliser(configuration);
    const { N, R, ids, present, coPresents } = instance;
    const aPriori = plafondsAPriori(instance);
    for (const { id, plan } of rechercher(configuration, { graine: 31, arret: 200_000, nombre: 2 })) {
      const tableDe = indexerPlan(instance, plan);
      assert.deepEqual(plan.reserves, plan.reserves.map(() => []), `proposition ${id}`);
      for (let r = 0; r < R; r += 1) {
        const listes = plan.tours[r].flat();
        assert.equal(new Set(listes).size, listes.length, `proposition ${id}, tour ${r + 1}`);
        for (let p = 0; p < N; p += 1) {
          assert.equal(listes.includes(ids[p]), present[p * R + r] === 1, `proposition ${id}, ${ids[p]}, tour ${r + 1}`);
        }
      }
      const mesures = mesurer(instance, tableDe);
      assert.deepEqual(verifierIndicateurs(mesures, aPriori, plafondsRealises(instance, tableDe)), [], `proposition ${id}`);
      for (let p = 0; p < N; p += 1) assert.ok(aPriori[p] <= coPresents[p], `${ids[p]}`);
    }
  });
});
