// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des deux vérificateurs du moteur (§ 14.12), par mutation : chaque
// épreuve part d'un état qui tient, et chaque mutation y produit la violation
// annoncée et aucune autre. Un vérificateur qui rend toujours la liste vide
// échoue à chacune.
//
// verifierInvariants part du plan parfait de la petite démonstration
// (§ 15.3), recopié ci-dessous. La configuration ajoute à la démonstration ce
// que deux codes demandent : un participant exclu, 13, dont la réservation
// est suspendue (§ 4.4), et une réservation de tour désigné que le plan
// honore, 6 à la table de numéro 1 au tour 2. Les épreuves désignent
// participants et tables par leur numéro ; participant() et table() en
// donnent l'identifiant. Les participants de numéro 1 à 13 portent les
// identifiants 107 à 191, de 7 en 7 : ni contigus, ni égaux à leur index plus
// un. Les tables de numéro 1 à 4 portent les identifiants 21 à 24, que
// l'instance range dans l'ordre 23, 21, 24, 22 et le plan dans l'ordre des
// numéros. Confondre identifiant, numéro, index et position, d'un participant
// comme d'une table, fait échouer une épreuve au lieu de passer inaperçu.
//
// verifierIndicateurs part des chiffres de ce même plan : N = 12, et 8 pour
// chacun en plafond a priori, en plafond réalisé et en rencontres (§ 15.3).
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { indexerPlan, normaliser } from './configuration.js';
import { planchersCollisions } from './diagnostic.js';
import { mesurer } from './indicateurs.js';
import { borneDiversite, plafondsAPriori, plafondsRealises } from './plafond.js';
import { ErreurConfiguration } from './erreurs.js';
import { verifierIndicateurs, verifierInvariants } from './verification.js';

const SANS_CONTRAINTE = {
  separerOrganisations: false,
  nouveauxVoisins: false,
  nouvelleTable: false,
  varierOrganisations: false,
};

// Identifiant du participant de numéro donné.
const participant = (numero) => 100 + 7 * numero;
// Identifiants des participants de numéros donnés, dans l'ordre donné.
const participants = (...numeros) => numeros.map(participant);
// Identifiant de la table de numéro donné.
const table = (numero) => 20 + numero;
// Identifiant qui n'est celui d'aucun participant, exclu compris, ni d'aucune
// table.
const ETRANGER = 99;

// Numéros des membres de chaque organisation de la petite démonstration
// (§ 15.3).
const MEMBRES = [
  ['A', [1, 5, 8, 12]],
  ['B', [2, 4, 9, 11]],
  ['C', [3, 6, 7, 10]],
];
const organisationDe = (numero) => MEMBRES.find(([, numeros]) => numeros.includes(numero))[0];

const RESERVATION_HONOREE = { participant: participant(6), table: table(1), portee: 'tour', tour: 2 };
const RESERVATION_SUSPENDUE = { participant: participant(13), table: table(2), portee: 'tous' };

function configuration(reservations = [RESERVATION_HONOREE, RESERVATION_SUSPENDUE]) {
  const membres = Array.from({ length: 12 }, (_, i) => ({
    id: participant(i + 1),
    nom: `P${i + 1}`,
    organisation: organisationDe(i + 1),
  }));
  return {
    participants: [...membres, { id: participant(13), nom: 'P13', organisation: null, exclu: true }],
    tables: [3, 1, 4, 2].map((numero) => ({ id: table(numero), numero, capacite: 3 })),
    tours: 4,
    reservations,
    contraintes: SANS_CONTRAINTE,
  };
}

// Le plan parfait de la petite démonstration (§ 15.3), écrit en numéros : à
// chaque tour, les tables de numéro 1 à 4, chacune réunissant un membre de
// chaque organisation ; personne en réserve. Gelé, comme chaque plan que les
// épreuves passent à verifierInvariants : une écriture du vérificateur y lève
// TypeError, quelle que soit la branche qui la fait.
const PLAN_PARFAIT = gelerPlan({
  tables: [table(1), table(2), table(3), table(4)],
  tours: [
    [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
    [[6, 9, 12], [3, 8, 11], [2, 5, 10], [1, 4, 7]],
    [[4, 8, 10], [2, 7, 12], [1, 6, 11], [3, 5, 9]],
    [[5, 7, 11], [1, 9, 10], [3, 4, 12], [2, 6, 8]],
  ].map((listes) => listes.map((numeros) => participants(...numeros))),
  reserves: [[], [], [], []],
});

const INSTANCE = normaliser(configuration());

// Copie du plan parfait, mutée par modifier puis gelée.
function planMute(modifier) {
  const plan = structuredClone(PLAN_PARFAIT);
  modifier(plan);
  return gelerPlan(plan);
}

// Violations du plan parfait, une fois que modifier a muté une copie.
function apresMutation(modifier, options) {
  return verifierInvariants(INSTANCE, planMute(modifier), options);
}

// Retire id de la liste de table qui le porte.
function retirer(listes, id) {
  for (const liste of listes) {
    if (liste.includes(id)) liste.splice(liste.indexOf(id), 1);
  }
}

// Chaque cas [libellé, calcul, attendu] dont le résultat diffère de
// l'attendu, en une ligne lisible ; une exception est un écart.
function ecarts(cas) {
  assert.ok(cas.length > 0, 'aucun cas examiné');
  return cas.flatMap(([libelle, calcul, attendu]) => {
    let obtenu;
    try {
      obtenu = calcul();
    } catch (erreur) {
      return [`${libelle} : ${erreur?.name} ${erreur?.message}`];
    }
    try {
      assert.deepEqual(obtenu, attendu);
      return [];
    } catch {
      return [`${libelle} : ${JSON.stringify(obtenu)}`];
    }
  });
}

// Gèle un plan et chacune de ses listes, puis le rend : une écriture faite
// depuis un module ES, toujours en mode strict, y lève TypeError.
function gelerPlan(plan) {
  const geler = (valeur) => {
    if (Array.isArray(valeur)) valeur.forEach(geler);
    return Object.freeze(valeur);
  };
  geler(plan.tables);
  geler(plan.tours);
  geler(plan.reserves);
  return Object.freeze(plan);
}

const CODES = [
  'TOURS',
  'TABLE_INCONNUE',
  'INCONNU',
  'EXCLU_PLACE',
  'DOUBLE_PLACE',
  'NON_ASSIS',
  'CAPACITE',
  'RESERVATION',
];

// [libellé, mutation du plan parfait, options, violations attendues]. Chaque
// code a au moins une mutation qui le produit seul.
const MUTATIONS = [
  ['un tour de moins', (plan) => {
    plan.tours.pop();
    plan.reserves.pop();
  }, undefined, [{ code: 'TOURS' }]],
  ['un tour de trop', (plan) => {
    plan.tours.push(structuredClone(plan.tours[0]));
    plan.reserves.push([]);
  }, undefined, [{ code: 'TOURS' }]],
  ['une réserve de moins', (plan) => {
    plan.reserves.pop();
  }, undefined, [{ code: 'TOURS' }]],

  ['une table inconnue, vide à chaque tour', (plan) => {
    plan.tables.push(ETRANGER);
    plan.tours.forEach((listes) => listes.push([]));
  }, undefined, [{ code: 'TABLE_INCONNUE', table: ETRANGER, detail: 'inconnue' }]],
  ['une table inconnue déclarée deux fois, vide à chaque tour', (plan) => {
    plan.tables.push(ETRANGER, ETRANGER);
    plan.tours.forEach((listes) => listes.push([], []));
  }, undefined, [{ code: 'TABLE_INCONNUE', table: ETRANGER, detail: 'inconnue' }]],
  ['une table déclarée deux fois, vide à sa seconde position', (plan) => {
    plan.tables.push(table(3));
    plan.tours.forEach((listes) => listes.push([]));
  }, undefined, [{ code: 'TABLE_INCONNUE', table: table(3), detail: 'doublon' }]],
  // La table de numéro 1 déclarée une seconde fois. Au tour 1, sa seconde
  // liste reçoit ses trois convives et 4 : quatre entrées, qu'aucune capacité
  // ne borne. Au tour 2, elle reçoit 6, réservé à la table de numéro 1 : la
  // réservation ne s'y honore pas.
  ['une table déclarée deux fois, sa seconde liste peuplée', (plan) => {
    plan.tables.push(table(1));
    plan.tours.forEach((listes) => listes.push([]));
    retirer(plan.tours[0], participant(4));
    plan.tours[0][4] = [...plan.tours[0][0], participant(4)];
    plan.tours[0][0] = [];
    retirer(plan.tours[1], participant(6));
    plan.tours[1][4].push(participant(6));
  }, undefined, [
    { code: 'TABLE_INCONNUE', table: table(1), detail: 'doublon' },
    { code: 'RESERVATION', participant: participant(6), table: table(1), tour: 2 },
  ]],
  ['une table déclarée à la place d’une autre', (plan) => {
    plan.tables[1] = table(1);
  }, undefined, [
    { code: 'TABLE_INCONNUE', table: table(1), detail: 'doublon' },
    { code: 'TABLE_INCONNUE', table: table(2), detail: 'absente' },
  ]],
  ['une table non déclarée, ses occupants en réserve permise', (plan) => {
    plan.tables.pop();
    plan.tours.forEach((listes, r) => plan.reserves[r].push(...listes.pop()));
  }, { reserveAutorisee: true }, [{ code: 'TABLE_INCONNUE', table: table(4), detail: 'absente' }]],
  ['une liste de trop au tour 3', (plan) => {
    plan.tours[2].push([]);
  }, undefined, [{ code: 'TABLE_INCONNUE', tour: 3, detail: 'listes' }]],
  ['une liste de moins au tour 3, ses occupants en réserve permise', (plan) => {
    plan.reserves[2].push(...plan.tours[2].pop());
  }, { reserveAutorisee: true }, [{ code: 'TABLE_INCONNUE', tour: 3, detail: 'listes' }]],
  // Le nombre de listes d'un tour se lit avant ses présences, dans l'ordre où
  // indexerPlan refuse : l'épreuve croisée compare les deux sur ce plan.
  ['une liste de trop au tour 2, un inconnu en réserve au même tour', (plan) => {
    plan.tours[1].push([]);
    plan.reserves[1].push(ETRANGER);
  }, undefined, [
    { code: 'TABLE_INCONNUE', tour: 2, detail: 'listes' },
    { code: 'INCONNU', participant: ETRANGER, tour: 2 },
  ]],

  ['un inconnu en réserve', (plan) => {
    plan.reserves[1].push(ETRANGER);
  }, undefined, [{ code: 'INCONNU', participant: ETRANGER, tour: 2 }]],

  ['l’exclu en réserve', (plan) => {
    plan.reserves[0].push(participant(13));
  }, undefined, [{ code: 'EXCLU_PLACE', participant: participant(13), tour: 1 }]],
  ['l’exclu à la place de 11, passé en réserve permise', (plan) => {
    plan.tours[3][0] = participants(5, 7, 13);
    plan.reserves[3].push(participant(11));
  }, { reserveAutorisee: true }, [{ code: 'EXCLU_PLACE', participant: participant(13), tour: 4 }]],

  // 6, assis à la table de numéro 1 au tour 2, occupe aussi la place de 11 à
  // la table de numéro 2 ; 11 attend en réserve.
  ['à deux tables au tour 2', (plan) => {
    plan.tours[1][1] = participants(3, 6, 8);
    plan.reserves[1].push(participant(11));
  }, { reserveAutorisee: true }, [{ code: 'DOUBLE_PLACE', participant: participant(6), tour: 2 }]],
  ['deux sièges à la même table', (plan) => {
    plan.tours[1][0] = participants(6, 6, 12);
    plan.reserves[1].push(participant(9));
  }, { reserveAutorisee: true }, [{ code: 'DOUBLE_PLACE', participant: participant(6), tour: 2 }]],
  ['assis et en réserve', (plan) => {
    plan.reserves[1].push(participant(6));
  }, undefined, [{ code: 'DOUBLE_PLACE', participant: participant(6), tour: 2 }]],

  ['absent d’un tour', (plan) => {
    retirer(plan.tours[2], participant(7));
  }, undefined, [{ code: 'NON_ASSIS', participant: participant(7), tour: 3 }]],
  ['absent d’un tour, la réserve permise', (plan) => {
    retirer(plan.tours[2], participant(7));
  }, { reserveAutorisee: true }, [{ code: 'NON_ASSIS', participant: participant(7), tour: 3 }]],
  ['en réserve, la réserve interdite par défaut', (plan) => {
    retirer(plan.tours[2], participant(7));
    plan.reserves[2].push(participant(7));
  }, undefined, [{ code: 'NON_ASSIS', participant: participant(7), tour: 3 }]],
  ['en réserve, la réserve interdite nommément', (plan) => {
    retirer(plan.tours[2], participant(7));
    plan.reserves[2].push(participant(7));
  }, { reserveAutorisee: false }, [{ code: 'NON_ASSIS', participant: participant(7), tour: 3 }]],

  ['quatre à la table de numéro 2, de trois places', (plan) => {
    retirer(plan.tours[3], participant(11));
    plan.tours[3][1].push(participant(11));
  }, undefined, [{ code: 'CAPACITE', table: table(2), tour: 4 }]],

  // 6, réservé à la table de numéro 1 au tour 2, échange sa place avec 3,
  // assis à la table de numéro 2.
  ['le réservé échangé avec un convive d’une autre table', (plan) => {
    plan.tours[1][0] = participants(3, 9, 12);
    plan.tours[1][1] = participants(6, 8, 11);
  }, undefined, [{ code: 'RESERVATION', participant: participant(6), table: table(1), tour: 2 }]],
  ['le réservé en réserve permise', (plan) => {
    retirer(plan.tours[1], participant(6));
    plan.reserves[1].push(participant(6));
  }, { reserveAutorisee: true }, [{ code: 'RESERVATION', participant: participant(6), table: table(1), tour: 2 }]],
  // La même réserve, interdite : 6 n'est pas assis, et sa réservation n'est
  // pas honorée. Deux règles enfreintes : NON_ASSIS, puis RESERVATION.
  ['le réservé en réserve, la réserve interdite', (plan) => {
    retirer(plan.tours[1], participant(6));
    plan.reserves[1].push(participant(6));
  }, undefined, [
    { code: 'NON_ASSIS', participant: participant(6), tour: 2 },
    { code: 'RESERVATION', participant: participant(6), table: table(1), tour: 2 },
  ]],
];

describe('verifierInvariants : le plan parfait de la petite démonstration (§ 15.3)', () => {
  test('ne viole rien, la réserve interdite ou permise', () => {
    assert.deepEqual(verifierInvariants(INSTANCE, PLAN_PARFAIT), []);
    assert.deepEqual(verifierInvariants(INSTANCE, PLAN_PARFAIT, { reserveAutorisee: true }), []);
  });

  test('ne viole rien, ses tables déclarées dans un autre ordre et ses listes dans le désordre', () => {
    // L'ordre de l'instance, 23, 21, 24, 22 : chaque liste suit sa table.
    const ordre = [2, 0, 3, 1];
    const permute = gelerPlan({
      tables: ordre.map((i) => PLAN_PARFAIT.tables[i]),
      tours: PLAN_PARFAIT.tours.map((listes) => ordre.map((i) => [...listes[i]].reverse())),
      reserves: [[], [], [], []],
    });
    assert.deepEqual(verifierInvariants(INSTANCE, permute), []);
  });
});

describe('verifierInvariants : chaque mutation, sa violation et aucune autre (§ 14.12)', () => {
  test('chaque code a sa mutation, et chaque mutation produit exactement ses violations', () => {
    const seuls = new Set(MUTATIONS
      .filter(([, , , attendu]) => attendu.length === 1)
      .map(([, , , [{ code }]]) => code));
    assert.deepEqual(CODES.filter((code) => !seuls.has(code)), [], 'code sans mutation qui le produise seul');
    const cas = MUTATIONS.map(([libelle, modifier, options, attendu]) => [
      libelle,
      () => apresMutation(modifier, options),
      attendu,
    ]);
    assert.deepEqual(ecarts(cas), []);
  });

  test('NON_ASSIS : chaque participant retiré de chaque tour, et lui seul, la réserve interdite ou permise', () => {
    // La réserve est une liste du plan (§ 8.9) : un participant qui n'y
    // figure pas plus qu'à une table n'attend pas, il manque.
    const cas = [];
    for (const reserveAutorisee of [false, true]) {
      for (let tour = 1; tour <= 4; tour += 1) {
        for (let numero = 1; numero <= 12; numero += 1) {
          const id = participant(numero);
          cas.push([
            `${numero} retiré du tour ${tour}, réserve ${reserveAutorisee ? 'permise' : 'interdite'}`,
            () => apresMutation((plan) => retirer(plan.tours[tour - 1], id), { reserveAutorisee }),
            [{ code: 'NON_ASSIS', participant: id, tour }],
          ]);
        }
      }
    }
    assert.equal(cas.length, 96);
    assert.deepEqual(ecarts(cas), []);
  });

  test('DOUBLE_PLACE : chaque participant ajouté à la réserve de chaque tour, et lui seul', () => {
    const cas = [];
    for (let tour = 1; tour <= 4; tour += 1) {
      for (let numero = 1; numero <= 12; numero += 1) {
        const id = participant(numero);
        cas.push([
          `${numero} en réserve au tour ${tour}`,
          () => apresMutation((plan) => plan.reserves[tour - 1].push(id)),
          [{ code: 'DOUBLE_PLACE', participant: id, tour }],
        ]);
      }
    }
    assert.equal(cas.length, 48);
    assert.deepEqual(ecarts(cas), []);
  });

  test('CAPACITE : chaque table de chaque tour, nommée par son identifiant', () => {
    // Le dernier convive de la table suivante rejoint la table examinée. Le
    // dernier n'est jamais 6 au tour 2 : la réservation reste honorée.
    const cas = [];
    for (let tour = 1; tour <= 4; tour += 1) {
      for (let i = 0; i < 4; i += 1) {
        cas.push([
          `tour ${tour}, table de numéro ${i + 1}`,
          () => apresMutation((plan) => {
            const listes = plan.tours[tour - 1];
            listes[i].push(listes[(i + 1) % 4].pop());
          }),
          [{ code: 'CAPACITE', table: table(i + 1), tour }],
        ]);
      }
    }
    assert.equal(cas.length, 16);
    assert.deepEqual(ecarts(cas), []);
  });

  test('RESERVATION : chaque participant, réservé à chaque tour, à sa table puis à la suivante', () => {
    // Une seule réservation de tour désigné par configuration : à la table
    // où le plan parfait assoit la personne, elle est honorée ; à la table
    // de numéro suivant, elle ne l'est pas.
    const cas = [];
    for (let tour = 1; tour <= 4; tour += 1) {
      for (let numero = 1; numero <= 12; numero += 1) {
        const id = participant(numero);
        const sienne = PLAN_PARFAIT.tours[tour - 1].findIndex((liste) => liste.includes(id)) + 1;
        const ailleurs = (sienne % 4) + 1;
        const reserve = (numeroTable) => normaliser(configuration([
          { participant: id, table: table(numeroTable), portee: 'tour', tour },
        ]));
        cas.push([
          `${numero} réservé à sa table au tour ${tour}`,
          () => verifierInvariants(reserve(sienne), PLAN_PARFAIT),
          [],
        ]);
        cas.push([
          `${numero} réservé à une autre table au tour ${tour}`,
          () => verifierInvariants(reserve(ailleurs), PLAN_PARFAIT),
          [{ code: 'RESERVATION', participant: id, table: table(ailleurs), tour }],
        ]);
      }
    }
    assert.equal(cas.length, 96);
    assert.deepEqual(ecarts(cas), []);
  });
});

describe('verifierInvariants : ce que chaque code couvre', () => {
  test('une personne en réserve n’est signalée que si la réserve est interdite, une personne absente l’est toujours (point d’attention 1)', () => {
    const enReserve = (plan) => {
      retirer(plan.tours[2], participant(7));
      plan.reserves[2].push(participant(7));
    };
    const absente = (plan) => retirer(plan.tours[2], participant(7));
    const nonAssis = [{ code: 'NON_ASSIS', participant: participant(7), tour: 3 }];
    assert.deepEqual(apresMutation(enReserve), nonAssis);
    assert.deepEqual(apresMutation(enReserve, { reserveAutorisee: true }), []);
    assert.deepEqual(apresMutation(absente), nonAssis);
    assert.deepEqual(apresMutation(absente, { reserveAutorisee: true }), nonAssis);
  });

  test('une réservation « tous les tours » se juge à chacun des tours', () => {
    // 1 est réservé à la table de numéro 1 à chaque tour ; le plan parfait
    // l'y assoit au tour 1, puis aux tables de numéro 4, 3 et 2.
    const instance = normaliser(configuration([
      RESERVATION_HONOREE,
      { participant: participant(1), table: table(1), portee: 'tous' },
    ]));
    assert.deepEqual(verifierInvariants(instance, PLAN_PARFAIT), [2, 3, 4].map((tour) => (
      { code: 'RESERVATION', participant: participant(1), table: table(1), tour })));
  });

  test('CAPACITE se juge contre la capacité de la table que la liste désigne', () => {
    // Deux tables de capacités différentes, que le plan déclare dans l'ordre
    // inverse de l'instance.
    const instance = normaliser({
      participants: [1, 2, 3, 4, 5, 6].map((id) => ({ id, nom: `P${id}`, organisation: null })),
      tables: [{ id: 7, numero: 1, capacite: 2 }, { id: 5, numero: 2, capacite: 4 }],
      tours: 1,
      reservations: [],
      contraintes: SANS_CONTRAINTE,
    });
    const plan = (listes) => gelerPlan({ tables: [5, 7], tours: [listes], reserves: [[]] });
    assert.deepEqual(verifierInvariants(instance, plan([[1, 2, 3, 4], [5, 6]])), []);
    assert.deepEqual(
      verifierInvariants(instance, plan([[1, 2, 3], [4, 5, 6]])),
      [{ code: 'CAPACITE', table: 7, tour: 1 }],
    );
  });

  test('une table inconnue : ses occupants sont placés, hors capacité, sans réservation honorée', () => {
    // La table de numéro 1 déclarée sous un identifiant étranger : il est
    // inconnu, 21 absente. Ses occupants restent placés ; au tour 1, elle en
    // reçoit quatre ; au tour 2, 6 y est assis alors que sa réservation le
    // fixe à la table 21.
    const obtenu = apresMutation((plan) => {
      plan.tables[0] = ETRANGER;
      retirer(plan.tours[0], participant(4));
      plan.tours[0][0].push(participant(4));
    });
    assert.deepEqual(obtenu, [
      { code: 'TABLE_INCONNUE', table: ETRANGER, detail: 'inconnue' },
      { code: 'TABLE_INCONNUE', table: table(1), detail: 'absente' },
      { code: 'RESERVATION', participant: participant(6), table: table(1), tour: 2 },
    ]);
  });

  test('les occupants d’une liste au-delà des tables déclarées sont placés', () => {
    const obtenu = apresMutation((plan) => {
      retirer(plan.tours[2], participant(7));
      plan.tours[2].push([participant(7)]);
    });
    assert.deepEqual(obtenu, [{ code: 'TABLE_INCONNUE', tour: 3, detail: 'listes' }]);
  });

  test('un identifiant étranger assis à une table ne tient la place d’aucun participant', () => {
    // Au tour 1, la table de numéro 1 réunit l'étranger et 2 : 1 et 3, les
    // participants de rang 0 et 2 dans l'ordre canonique, manquent au tour.
    const obtenu = apresMutation((plan) => {
      plan.tours[0][0] = [ETRANGER, participant(2)];
    });
    assert.deepEqual(obtenu, [
      { code: 'INCONNU', participant: ETRANGER, tour: 1 },
      { code: 'NON_ASSIS', participant: participant(1), tour: 1 },
      { code: 'NON_ASSIS', participant: participant(3), tour: 1 },
    ]);
  });

  test('CAPACITE compte chaque entrée de la liste, étrangère ou répétée', () => {
    // Le siège est la position dans la liste : un id étranger ou répété
    // occupe un siège comme un autre.
    const obtenu = apresMutation((plan) => {
      plan.tours[0][0].push(ETRANGER);
      plan.tours[1][0].push(participant(12));
    });
    assert.deepEqual(obtenu, [
      { code: 'INCONNU', participant: ETRANGER, tour: 1 },
      { code: 'CAPACITE', table: table(1), tour: 1 },
      { code: 'DOUBLE_PLACE', participant: participant(12), tour: 2 },
      { code: 'CAPACITE', table: table(1), tour: 2 },
    ]);
  });

  test('un participant présent trois fois dans un tour se signale une fois', () => {
    // 6 occupe aussi la place de 11 à la table de numéro 2 et figure en
    // réserve ; 11 attend en réserve.
    const obtenu = apresMutation((plan) => {
      plan.tours[1][1] = participants(3, 6, 8);
      plan.reserves[1].push(participant(6), participant(11));
    }, { reserveAutorisee: true });
    assert.deepEqual(obtenu, [{ code: 'DOUBLE_PLACE', participant: participant(6), tour: 2 }]);
  });

  test('un identifiant étranger à l’instance se signale une fois par tour où il figure', () => {
    const obtenu = apresMutation((plan) => {
      plan.reserves[0].push(ETRANGER, participant(13), ETRANGER);
      plan.tours[0][0].push(participant(13));
      retirer(plan.tours[0], participant(3));
      plan.reserves[0].push(participant(3));
      plan.reserves[2].push(ETRANGER);
    }, { reserveAutorisee: true });
    assert.deepEqual(obtenu, [
      { code: 'EXCLU_PLACE', participant: participant(13), tour: 1 },
      { code: 'INCONNU', participant: ETRANGER, tour: 1 },
      { code: 'INCONNU', participant: ETRANGER, tour: 3 },
    ]);
  });

  test('une table déclarée trois fois se signale une fois', () => {
    const obtenu = apresMutation((plan) => {
      plan.tables.push(table(2), table(2));
      plan.tours.forEach((listes) => listes.push([], []));
    });
    assert.deepEqual(obtenu, [{ code: 'TABLE_INCONNUE', table: table(2), detail: 'doublon' }]);
  });
});

describe('verifierInvariants : la liste rendue', () => {
  test('les violations se rangent dans l’ordre de lecture du plan', () => {
    // Un tour de moins : seuls les tours 1 à 3 sont lus. Une table inconnue,
    // vide. Au tour 2 : une liste de trop, 6 échangé avec 3, 5 retiré, 2
    // passé de la table de numéro 3 à la table de numéro 4, et en réserve un
    // étranger, l'exclu et 12. Au tour 3, une liste de trop encore. Le nombre
    // de listes ouvre les violations de son tour : celle du tour 2 précède ses
    // présences, celle du tour 3 suit tout le tour 2.
    const obtenu = apresMutation((plan) => {
      plan.tours.pop();
      plan.reserves.pop();
      plan.tables.push(ETRANGER);
      plan.tours.forEach((listes) => listes.push([]));
      plan.tours[1][0] = participants(3, 9, 12);
      plan.tours[1][1] = participants(6, 8, 11);
      plan.tours[1][2] = participants(10);
      plan.tours[1][3] = participants(1, 2, 4, 7);
      plan.reserves[1].push(ETRANGER, participant(13), participant(12));
      plan.tours[1].push([]);
      plan.tours[2].push([]);
    });
    assert.deepEqual(obtenu, [
      { code: 'TOURS' },
      { code: 'TABLE_INCONNUE', table: ETRANGER, detail: 'inconnue' },
      { code: 'TABLE_INCONNUE', tour: 2, detail: 'listes' },
      { code: 'INCONNU', participant: ETRANGER, tour: 2 },
      { code: 'EXCLU_PLACE', participant: participant(13), tour: 2 },
      { code: 'DOUBLE_PLACE', participant: participant(12), tour: 2 },
      { code: 'CAPACITE', table: table(4), tour: 2 },
      { code: 'NON_ASSIS', participant: participant(5), tour: 2 },
      { code: 'RESERVATION', participant: participant(6), table: table(1), tour: 2 },
      { code: 'TABLE_INCONNUE', tour: 3, detail: 'listes' },
    ]);
  });

  test('les tables absentes se rangent dans l’ordre de l’instance', () => {
    // Les tables de numéro 2 et 3 retirées du plan, leurs occupants en
    // réserve permise. L'instance range 23 avant 22, à l'inverse du plan et
    // des numéros.
    const obtenu = apresMutation((plan) => {
      plan.tables.splice(1, 2);
      plan.tours.forEach((listes, r) => plan.reserves[r].push(...listes.splice(1, 2).flat()));
    }, { reserveAutorisee: true });
    assert.deepEqual(obtenu, [
      { code: 'TABLE_INCONNUE', table: table(3), detail: 'absente' },
      { code: 'TABLE_INCONNUE', table: table(2), detail: 'absente' },
    ]);
  });

  test('NON_ASSIS et RESERVATION se rangent participant par participant', () => {
    // Au tour 2, 6 échangé avec 3, et 7 retiré : la violation de 6 précède
    // celle de 7, quel que soit son code.
    const obtenu = apresMutation((plan) => {
      plan.tours[1][0] = participants(3, 9, 12);
      plan.tours[1][1] = participants(6, 8, 11);
      retirer(plan.tours[1], participant(7));
    });
    assert.deepEqual(obtenu, [
      { code: 'RESERVATION', participant: participant(6), table: table(1), tour: 2 },
      { code: 'NON_ASSIS', participant: participant(7), tour: 2 },
    ]);
  });

  test('ne modifie ni le plan ni l’instance, sous chaque mutation', () => {
    // planMute rend un plan gelé. L'instance est bâtie pour chaque cas et
    // copiée avant tout appel : la copie d'une instance déjà passée au
    // vérificateur porterait ce qu'il y aurait écrit, et la comparaison ne le
    // verrait pas.
    const cas = MUTATIONS.map(([libelle, modifier, options]) => [libelle, () => {
      const instance = normaliser(configuration());
      const copie = structuredClone(instance);
      verifierInvariants(instance, planMute(modifier), options);
      assert.deepEqual(instance, copie, 'instance modifiée');
      return 'intacte';
    }, 'intacte']);
    assert.deepEqual(ecarts(cas), []);
  });
});

describe('verifierInvariants : la présence par tour (§ 8.9, § 14.12)', () => {
  // Deux tables de 3, d'identifiants 22 puis 21, deux tours. 103 n'est
  // présente qu'au tour 1, réservée à la table 22 pour la soirée : la
  // réservation est suspendue au tour 2. 105 n'est présente qu'au tour 2.
  // 104 est réservée à la table 22 au seul tour 2. Les identifiants des
  // personnes ne suivent pas leurs index.
  const PRESENCES = normaliser({
    participants: [
      { id: 101, nom: 'P101', organisation: null },
      { id: 102, nom: 'P102', organisation: null },
      { id: 103, nom: 'P103', organisation: null, presence: [1] },
      { id: 104, nom: 'P104', organisation: null },
      { id: 105, nom: 'P105', organisation: null, presence: [2] },
    ],
    tables: [{ id: 22, numero: 1, capacite: 3 }, { id: 21, numero: 2, capacite: 3 }],
    tours: 2,
    reservations: [
      { participant: 103, table: 22, portee: 'tous' },
      { participant: 104, table: 22, portee: 'tour', tour: 2 },
    ],
    contraintes: SANS_CONTRAINTE,
  });
  // Le plan qui tient : chaque absente omise de son tour d'absence, chaque
  // réservation active tenue, personne en réserve.
  const planPresences = (modifier = () => {}) => {
    const plan = {
      tables: [22, 21],
      tours: [
        [[103, 104], [101, 102]],
        [[102, 104], [101, 105]],
      ],
      reserves: [[], []],
    };
    modifier(plan);
    return gelerPlan(plan);
  };
  const verifier = (modifier, options) => verifierInvariants(PRESENCES, planPresences(modifier), options);

  test('une absente omise de son tour ne manque pas au plan : ni NON_ASSIS, ni RESERVATION pour sa réservation « tous » suspendue', () => {
    assert.deepEqual(verifier(), []);
    assert.deepEqual(verifier(undefined, { reserveAutorisee: true }), []);
  });

  test('ABSENT_PLACE pour une absente assise à une table, et rien d’autre, sa réservation suspendue comprise', () => {
    assert.deepEqual(verifier((plan) => { plan.tours[0][1].push(105); }), [
      { code: 'ABSENT_PLACE', participant: 105, tour: 1 },
    ]);
    // 103, réservée à 22 pour la soirée, assise à 21 au tour 2 où elle est
    // absente : la réservation suspendue ne s'y lit pas.
    assert.deepEqual(verifier((plan) => { plan.tours[1][1].push(103); }), [
      { code: 'ABSENT_PLACE', participant: 103, tour: 2 },
    ]);
  });

  test('ABSENT_PLACE pour une absente en réserve, que la réserve soit permise ou non', () => {
    for (const reserveAutorisee of [false, true]) {
      assert.deepEqual(verifier((plan) => { plan.reserves[1].push(103); }, { reserveAutorisee }), [
        { code: 'ABSENT_PLACE', participant: 103, tour: 2 },
      ], `reserveAutorisee ${reserveAutorisee}`);
    }
  });

  test('DOUBLE_PLACE au comptage, puis ABSENT_PLACE dans la boucle des participants, par identifiant croissant', () => {
    // Au tour 1 : 105, absente, assise à 21 et en réserve ; 101 retirée.
    // DOUBLE_PLACE se lit en comptant la réserve ; puis les participants,
    // 101 avant 105.
    const obtenu = verifier((plan) => {
      plan.tours[0][1] = [102, 105];
      plan.reserves[0].push(105);
    });
    assert.deepEqual(obtenu, [
      { code: 'DOUBLE_PLACE', participant: 105, tour: 1 },
      { code: 'NON_ASSIS', participant: 101, tour: 1 },
      { code: 'ABSENT_PLACE', participant: 105, tour: 1 },
    ]);
  });

  test('une réserve imposée en réserve à son tour : ni NON_ASSIS ni RESERVATION sous l’option ; sans elle, les deux', () => {
    // 104, réservée à 22 au tour 2, y est laissée en réserve.
    const enReserve = (plan) => {
      plan.tours[1][0] = [102];
      plan.reserves[1].push(104);
    };
    const imposee = [{ participant: 104, tour: 2 }];
    assert.deepEqual(verifier(enReserve, { reservesImposees: imposee }), []);
    assert.deepEqual(verifier(enReserve, { reserveAutorisee: true, reservesImposees: imposee }), []);
    assert.deepEqual(verifier(enReserve), [
      { code: 'NON_ASSIS', participant: 104, tour: 2 },
      { code: 'RESERVATION', participant: 104, table: 22, tour: 2 },
    ]);
    assert.deepEqual(verifier(enReserve, { reserveAutorisee: true }), [
      { code: 'RESERVATION', participant: 104, table: 22, tour: 2 },
    ]);
    // L'option ne vaut qu'à son tour : imposée au tour 1, 104 laissée en
    // réserve au tour 2 reçoit ses deux violations.
    assert.deepEqual(verifier(enReserve, { reservesImposees: [{ participant: 104, tour: 1 }] }), [
      { code: 'NON_ASSIS', participant: 104, tour: 2 },
      { code: 'RESERVATION', participant: 104, table: 22, tour: 2 },
    ]);
  });

  test('une réserve imposée assise à une table ou omise du plan se contrôle comme les autres', () => {
    const imposee = { reservesImposees: [{ participant: 104, tour: 2 }] };
    // Assise à 21 au lieu de 22 : la réservation n'est pas tenue.
    assert.deepEqual(verifier((plan) => { plan.tours[1] = [[102], [101, 104, 105]]; }, imposee), [
      { code: 'RESERVATION', participant: 104, table: 22, tour: 2 },
    ]);
    // Assise à sa table : rien.
    assert.deepEqual(verifier(undefined, imposee), []);
    // Ni assise ni en réserve : elle manque au plan.
    assert.deepEqual(verifier((plan) => { plan.tours[1][0] = [102]; }, imposee), [
      { code: 'NON_ASSIS', participant: 104, tour: 2 },
    ]);
  });

  test('une option reservesImposees mal formée lève : TypeError pour une non-liste, RangeError pour une personne ou un tour hors de l’instance', () => {
    assert.throws(() => verifier(undefined, { reservesImposees: null }), TypeError);
    assert.throws(() => verifier(undefined, { reservesImposees: [null] }), TypeError);
    for (const entree of [{ participant: 999, tour: 1 }, { participant: 104, tour: 0 }, { participant: 104, tour: 3 }, { participant: 104, tour: 1.5 }]) {
      assert.throws(() => verifier(undefined, { reservesImposees: [entree] }), RangeError, JSON.stringify(entree));
    }
  });

  test('une option reservesImposees mal formée lève TypeError avec son message : la liste, puis chaque entrée', () => {
    // Une non-liste, itérable ou non, se refuse avant toute lecture d'entrée.
    for (const reservesImposees of [null, { participant: 104, tour: 2 }, '104']) {
      assert.throws(() => verifier(undefined, { reservesImposees }), { name: 'TypeError', message: 'reservesImposees : liste attendue' });
    }
    // Une entrée null ou qui n'est pas un objet se refuse avant d'être lue,
    // même placée après une entrée valide.
    for (const entree of [null, 104, 'P104', true]) {
      assert.throws(() => verifier(undefined, { reservesImposees: [{ participant: 104, tour: 2 }, entree] }), {
        name: 'TypeError',
        message: 'reservesImposees : {participant, tour} attendu',
      });
    }
  });
});

describe('verifierInvariants et indexerPlan : une même lecture du plan (§ 8.9)', () => {
  // Code sous lequel indexerPlan refuse chaque violation de forme, désignée
  // par son code, suivi de son detail quand elle en porte un. CAPACITE et
  // RESERVATION n'en ont pas : indexerPlan n'examine ni les capacités ni les
  // réservations.
  const cle = ({ code, detail }) => (detail === undefined ? code : `${code} ${detail}`);
  const REFUS = new Map([
    ['TOURS', 'PLAN_TOURS'],
    ['TABLE_INCONNUE inconnue', 'PLAN_TABLE_INCONNUE'],
    ['TABLE_INCONNUE doublon', 'PLAN_TABLE_DOUBLON'],
    ['TABLE_INCONNUE absente', 'PLAN_TABLE_ABSENTE'],
    ['TABLE_INCONNUE listes', 'PLAN_LISTES'],
    ['INCONNU', 'PLAN_INCONNU'],
    ['EXCLU_PLACE', 'PLAN_EXCLU_PLACE'],
    ['DOUBLE_PLACE', 'PLAN_DOUBLE_PLACE'],
    ['NON_ASSIS', 'PLAN_NON_ASSIS'],
  ]);
  const SANS_REFUS = new Set(['CAPACITE', 'RESERVATION']);

  // Ce qu'indexerPlan fait du plan selon verifierInvariants, la réserve
  // permise comme la forme indexée la porte : refuser sous le code de la
  // première violation de forme, en désignant le même participant, la même
  // table et le même tour ; accepter quand il n'y en a aucune.
  function refusAttendu(plan) {
    const forme = verifierInvariants(INSTANCE, plan, { reserveAutorisee: true })
      .filter(({ code }) => !SANS_REFUS.has(code));
    if (forme.length === 0) return 'accepté';
    const [premiere] = forme;
    const { participant: id, table: idTable, tour } = premiere;
    return { code: REFUS.get(cle(premiere)), participant: id, table: idTable, tour };
  }

  // Ce qu'indexerPlan fait du plan, sous la même forme. Une erreur qui n'est
  // pas un refus du contenu se propage.
  function refusObtenu(plan) {
    try {
      indexerPlan(INSTANCE, plan);
      return 'accepté';
    } catch (erreur) {
      if (!(erreur instanceof ErreurConfiguration)) throw erreur;
      const { participant: id, table: idTable, tour } = erreur.details;
      return { code: erreur.code, participant: id, table: idTable, tour };
    }
  }

  // Le plan parfait, chaque plan du tableau des mutations, et pour chaque
  // participant à chaque tour : retiré, passé en réserve, ajouté à la réserve.
  function plansEprouves() {
    const plans = [['le plan parfait', PLAN_PARFAIT]];
    for (const [libelle, modifier] of MUTATIONS) plans.push([libelle, planMute(modifier)]);
    for (let tour = 1; tour <= 4; tour += 1) {
      for (let numero = 1; numero <= 12; numero += 1) {
        const id = participant(numero);
        plans.push([`${numero} retiré du tour ${tour}`, planMute((plan) => {
          retirer(plan.tours[tour - 1], id);
        })]);
        plans.push([`${numero} passé en réserve au tour ${tour}`, planMute((plan) => {
          retirer(plan.tours[tour - 1], id);
          plan.reserves[tour - 1].push(id);
        })]);
        plans.push([`${numero} ajouté à la réserve du tour ${tour}`, planMute((plan) => {
          plan.reserves[tour - 1].push(id);
        })]);
      }
    }
    return plans;
  }

  test('indexerPlan refuse la première violation de forme que relève verifierInvariants, et accepte le plan qui n’en a aucune', () => {
    const plans = plansEprouves();
    const acceptes = plans.filter(([, plan]) => refusAttendu(plan) === 'accepté').length;
    assert.ok(acceptes > 0 && acceptes < plans.length, `${acceptes} plans acceptés sur ${plans.length}`);
    const cas = plans.map(([libelle, plan]) => [libelle, () => refusObtenu(plan), refusAttendu(plan)]);
    assert.deepEqual(ecarts(cas), []);
  });
});

describe('verifierIndicateurs : la ligne de décomposition (§ 12.3, § 12.10.5)', () => {
  // Chiffres du plan parfait, dans l'ordre canonique : N − 1 = 11, puis 8 pour
  // chacun. Chaque inégalité y tient, les deux dernières avec égalité.
  const N = 12;
  const huit = () => Array.from({ length: N }, () => 8);
  // Copie de huit() dont la case index prend la valeur donnée.
  const sauf = (index, valeur) => huit().map((v, p) => (p === index ? valeur : v));

  // Mutations d'une seule case, de rang index : [libellé, rencontres,
  // a priori, réalisé, code attendu]. null en a priori : inconnu.
  const mutations = (index) => [
    ['a priori 12 > N − 1', huit(), sauf(index, 12), huit(), 'PLAFOND_A_PRIORI'],
    ['a priori 7 < réalisé 8', huit(), sauf(index, 7), huit(), 'ORDRE_PLAFONDS'],
    ['réalisé 9 > a priori 8', huit(), huit(), sauf(index, 9), 'ORDRE_PLAFONDS'],
    ['rencontres 9 > réalisé 8', sauf(index, 9), huit(), huit(), 'DEPASSEMENT'],
    ['réalisé 7 < rencontres 8', huit(), huit(), sauf(index, 7), 'DEPASSEMENT'],
    ['a priori inconnu, réalisé 12 > N − 1', huit(), null, sauf(index, 12), 'PLAFOND_REALISE'],
    ['a priori inconnu, rencontres 9 > réalisé 8', sauf(index, 9), null, huit(), 'DEPASSEMENT'],
  ];

  test('les chiffres du plan parfait tiennent, le plafond a priori connu ou inconnu', () => {
    assert.deepEqual(verifierIndicateurs({ rencontres: huit() }, huit(), huit()), []);
    assert.deepEqual(verifierIndicateurs({ rencontres: huit() }, null, huit()), []);
  });

  test('ne modifie ni les mesures ni les plafonds, que la ligne tienne ou qu’elle tombe', () => {
    // Entrées gelées : une écriture, un tri en place ou un champ ajouté y lève
    // TypeError. La copie, prise avant l'appel, verrait de plus ce qu'aurait
    // changé une entrée qu'on aurait oublié de geler.
    const cas = [
      ['la ligne tient', huit(), huit(), huit()],
      ['la ligne tient, a priori inconnu', huit(), null, huit()],
      ...mutations(5).map(([libelle, rencontres, aPriori, realises]) => [libelle, rencontres, aPriori, realises]),
    ].map(([libelle, rencontres, aPriori, realises]) => [libelle, () => {
      const mesures = Object.freeze({ rencontres: Object.freeze(rencontres) });
      if (aPriori !== null) Object.freeze(aPriori);
      Object.freeze(realises);
      const copie = structuredClone({ mesures, aPriori, realises });
      verifierIndicateurs(mesures, aPriori, realises);
      assert.deepEqual({ mesures, aPriori, realises }, copie);
      return 'intactes';
    }, 'intactes']);
    assert.deepEqual(ecarts(cas), []);
  });

  test('chaque mutation fait tomber une inégalité de la ligne, et aucune autre', () => {
    const cas = mutations(5).map(([libelle, rencontres, aPriori, realises, code]) => [
      libelle,
      () => verifierIndicateurs({ rencontres }, aPriori, realises),
      [{ code, index: 5 }],
    ]);
    assert.deepEqual(ecarts(cas), []);
  });

  test('chaque personne est éprouvée, sur chaque inégalité', () => {
    const cas = [];
    for (let index = 0; index < N; index += 1) {
      for (const [libelle, rencontres, aPriori, realises, code] of mutations(index)) {
        cas.push([
          `${libelle}, rang ${index}`,
          () => verifierIndicateurs({ rencontres }, aPriori, realises),
          [{ code, index }],
        ]);
      }
    }
    assert.equal(cas.length, N * 7);
    assert.deepEqual(ecarts(cas), []);
  });

  test('chaque inégalité est large : l’égalité tient sur toute la ligne', () => {
    const onze = Array.from({ length: N }, () => 11);
    assert.deepEqual(verifierIndicateurs({ rencontres: onze }, onze, onze), []);
    assert.deepEqual(verifierIndicateurs({ rencontres: onze }, null, onze), []);
  });

  test('les violations se rangent par index croissant, puis de gauche à droite sur la ligne', () => {
    // Au rang 2, les trois inégalités tombent : a priori 12 > N − 1, réalisé
    // 13 > a priori 12, rencontres 14 > réalisé 13. Au rang 7, la dernière
    // seule : rencontres 9 > réalisé 8.
    const rencontres = sauf(2, 14);
    rencontres[7] = 9;
    const realises = sauf(2, 13);
    assert.deepEqual(verifierIndicateurs({ rencontres }, sauf(2, 12), realises), [
      { code: 'PLAFOND_A_PRIORI', index: 2 },
      { code: 'ORDRE_PLAFONDS', index: 2 },
      { code: 'DEPASSEMENT', index: 2 },
      { code: 'DEPASSEMENT', index: 7 },
    ]);
    assert.deepEqual(verifierIndicateurs({ rencontres }, null, realises), [
      { code: 'PLAFOND_REALISE', index: 2 },
      { code: 'DEPASSEMENT', index: 2 },
      { code: 'DEPASSEMENT', index: 7 },
    ]);
  });

  test('les tableaux typés du moteur se lisent comme des listes', () => {
    const type = (valeurs) => Int32Array.from(valeurs);
    assert.deepEqual(verifierIndicateurs({ rencontres: type(huit()) }, type(huit()), type(huit())), []);
    assert.deepEqual(
      verifierIndicateurs({ rencontres: type(huit()) }, type(sauf(3, 7)), type(huit())),
      [{ code: 'ORDRE_PLAFONDS', index: 3 }],
    );
  });

  test('une valeur qui n’est pas un nombre fait tomber les inégalités qui la lisent', () => {
    // Converti, un texte tiendrait l'inégalité face à un 8 : '8' en terme de
    // droite, '9' en terme de gauche. Chaque côté a donc son contrôle de type
    // éprouvé.
    const cas = [
      ['rencontres NaN', sauf(3, Number.NaN), huit(), huit(), ['DEPASSEMENT']],
      ['réalisé NaN', huit(), huit(), sauf(3, Number.NaN), ['ORDRE_PLAFONDS', 'DEPASSEMENT']],
      ['a priori NaN', huit(), sauf(3, Number.NaN), huit(), ['PLAFOND_A_PRIORI', 'ORDRE_PLAFONDS']],
      ['a priori null', huit(), sauf(3, null), huit(), ['PLAFOND_A_PRIORI', 'ORDRE_PLAFONDS']],
      ['réalisé indéfini', huit(), huit(), sauf(3, undefined), ['ORDRE_PLAFONDS', 'DEPASSEMENT']],
      ['rencontres en texte', sauf(3, '8'), huit(), huit(), ['DEPASSEMENT']],
      ['réalisé en texte', huit(), huit(), sauf(3, '9'), ['ORDRE_PLAFONDS', 'DEPASSEMENT']],
      ['a priori en texte', huit(), sauf(3, '9'), huit(), ['PLAFOND_A_PRIORI', 'ORDRE_PLAFONDS']],
      ['a priori inconnu, réalisé null', huit(), null, sauf(3, null), ['PLAFOND_REALISE', 'DEPASSEMENT']],
    ].map(([libelle, rencontres, aPriori, realises, codes]) => [
      libelle,
      () => verifierIndicateurs({ rencontres }, aPriori, realises),
      codes.map((code) => ({ code, index: 3 })),
    ]);
    assert.deepEqual(ecarts(cas), []);
  });

  test('un tableau de plafonds d’une autre longueur que les rencontres lève RangeError', () => {
    const court = huit().slice(1);
    const long = [...huit(), 8];
    assert.throws(() => verifierIndicateurs({ rencontres: huit() }, huit(), court), RangeError);
    assert.throws(() => verifierIndicateurs({ rencontres: huit() }, long, huit()), RangeError);
    assert.throws(() => verifierIndicateurs({ rencontres: huit() }, null, long), RangeError);
  });

  test('un plafond qui n’est pas une liste lève TypeError, et seul null dit l’a priori inconnu', () => {
    // undefined est la valeur d'un champ manquant : lu comme l'a priori
    // inconnu, il ôterait deux inégalités à la garde sans rien signaler.
    const rencontres = huit();
    for (const valeur of [undefined, 8, {}]) {
      assert.throws(() => verifierIndicateurs({ rencontres }, valeur, huit()),
        { name: 'TypeError', message: /plafondsAPriori/ }, `a priori ${String(valeur)}`);
    }
    for (const valeur of [undefined, null, 8, {}]) {
      assert.throws(() => verifierIndicateurs({ rencontres }, huit(), valeur),
        { name: 'TypeError', message: /plafondsRealises/ }, `réalisé ${String(valeur)}`);
    }
  });
});

describe('verifierIndicateurs : les objectifs et les animateurs (§ 5.4, A9)', () => {
  // Quatre personnes, deux tours : 1 et 2 ont deux tours possibles, 2 en a
  // un servi, 3 et 4 n'en ont aucun ; la borne des animateurs vaut 1 pour
  // chacun, et 4 seul en rencontre un. Chaque inégalité y tient.
  const base = () => ({
    rencontres: [3, 3, 3, 3],
    toursAssis: [2, 2, 2, 2],
    objectifs: { tours: [0, 1, 0, 0], possibles: [2, 2, 0, 0], jamaisServies: 1, horsObjectifMax: 2, concernes: 2 },
    animateurs: { rencontres: [0, 0, 0, 1], bornes: [1, 1, 1, 1] },
  });
  const plafonds = () => [3, 3, 3, 3];
  // La base dont modifier(mesures) a changé une valeur.
  const avec = (modifier) => {
    const mesures = base();
    modifier(mesures);
    return mesures;
  };

  test('les mesures d’un plan tiennent : la base, et un plan mesuré par le moteur', () => {
    assert.deepEqual(verifierIndicateurs(base(), plafonds(), plafonds()), []);
    const instance = normaliser({
      participants: [
        { id: 1, nom: 'P1', organisation: null, anime: [1, 2] },
        { id: 2, nom: 'P2', organisation: null, etiquettes: ['finance'] },
        { id: 3, nom: 'P3', organisation: null, etiquettes: ['finance'] },
        { id: 4, nom: 'P4', organisation: null },
      ],
      tables: [{ id: 1, numero: 1, capacite: 2 }, { id: 2, numero: 2, capacite: 2 }],
      tours: 2,
      reservations: [{ participant: 1, table: 1, portee: 'tous' }],
      contraintes: SANS_CONTRAINTE,
      objectifs: [{ table: 1, tour: null, regle: 'ou', etiquettes: ['finance'] }],
    });
    const tableDe = indexerPlan(instance, { tables: [1, 2], tours: [[[1, 2], [3, 4]], [[1, 4], [2, 3]]], reserves: [[], []] });
    const mesures = mesurer(instance, tableDe);
    assert.equal(mesures.objectifs.concernes, 2);
    assert.equal(mesures.animateurs.concernes, 3);
    assert.deepEqual(verifierIndicateurs(mesures, plafondsAPriori(instance), plafondsRealises(instance, tableDe)), []);
  });

  test('chaque dépassement a son code, et aucun autre ne tombe', () => {
    const cas = [
      ['tours servis 3 > tours possibles 2', avec((m) => { m.objectifs.tours[1] = 3; m.toursAssis[1] = 3; }),
        [{ code: 'TOURS_SERVIS', index: 1 }]],
      ['tours servis 1 > tours assis 0', avec((m) => { m.toursAssis[1] = 0; }),
        [{ code: 'TOURS_SERVIS_NON_ASSIS', index: 1 }]],
      ['animateurs rencontrés 2 > borne 1', avec((m) => { m.animateurs.rencontres[3] = 2; }),
        [{ code: 'ANIMATEURS_RENCONTRES', index: 3 }]],
      ['jamais servies 3 > concernées 2', avec((m) => { m.objectifs.jamaisServies = 3; }),
        [{ code: 'JAMAIS_SERVIES' }]],
      ['le plus de tours hors objectif 3 > tours possibles 2', avec((m) => { m.objectifs.horsObjectifMax = 3; }),
        [{ code: 'HORS_OBJECTIF_MAX' }]],
      // Personne n'a de tour possible : le plus de tours possibles vaut 0, et
      // un seul tour hors objectif le dépasse.
      ['le plus de tours hors objectif 1 > aucun tour possible', avec((m) => {
        m.objectifs.tours = [0, 0, 0, 0];
        m.objectifs.possibles = [0, 0, 0, 0];
        m.objectifs.horsObjectifMax = 1;
      }), [{ code: 'HORS_OBJECTIF_MAX' }]],
    ].map(([libelle, mesures, attendu]) => [libelle, () => verifierIndicateurs(mesures, plafonds(), plafonds()), attendu]);
    assert.deepEqual(ecarts(cas), []);
  });

  test('les violations d’une personne suivent celles de sa ligne, les deux globales viennent en dernier', () => {
    const mesures = avec((m) => {
      m.rencontres[1] = 4;
      m.objectifs.tours[1] = 3;
      m.toursAssis[1] = 3;
      m.animateurs.rencontres[1] = 2;
      m.objectifs.jamaisServies = 3;
      m.objectifs.horsObjectifMax = 3;
    });
    assert.deepEqual(verifierIndicateurs(mesures, plafonds(), plafonds()), [
      { code: 'DEPASSEMENT', index: 1 },
      { code: 'TOURS_SERVIS', index: 1 },
      { code: 'ANIMATEURS_RENCONTRES', index: 1 },
      { code: 'JAMAIS_SERVIES' },
      { code: 'HORS_OBJECTIF_MAX' },
    ]);
  });

  test('des objectifs et des animateurs null, ou absents, ne sont pas lus ; une liste d’une autre longueur lève RangeError', () => {
    assert.deepEqual(verifierIndicateurs({ ...base(), objectifs: null, animateurs: null }, plafonds(), plafonds()), []);
    assert.deepEqual(verifierIndicateurs({ rencontres: [3, 3, 3, 3] }, plafonds(), plafonds()), []);
    assert.throws(() => verifierIndicateurs(avec((m) => { m.objectifs.possibles.pop(); }), plafonds(), plafonds()), RangeError);
    assert.throws(() => verifierIndicateurs(avec((m) => { m.toursAssis.pop(); }), plafonds(), plafonds()), RangeError);
    assert.throws(() => verifierIndicateurs(avec((m) => { m.animateurs.bornes.push(1); }), plafonds(), plafonds()), RangeError);
  });
});

describe('verifierIndicateurs : les compléments de la page de qualité (§ 12.3, § 14.12, D42)', () => {
  // Quatre personnes, trois rencontres chacune ; deux organisations, de
  // collisions cumulées 2 et 1 sur des planchers 1 et 1 ; deux tours, hors
  // objectif 2 puis 0 sur des planchers 1 et 0 ; deux conflits
  // d'organisation sur un plancher de 1. A(p) 2, 2, 1, 2 ; |F(p)| 3, 2, 2,
  // 3 ; Φ_aff 3, 3, 2, 3 ; A_max 2, 2, 2, 3. Chaque inégalité y tient, et
  // seule la personne de rang 2 n'y est pas à l'égalité de A_max.
  const base = () => ({
    rencontres: [3, 3, 3, 3],
    conflitsOrganisation: 2,
    affilies: [3, 2, 2, 3],
    organisationsVues: [2, 2, 1, 2],
    parGroupe: [
      { groupe: 'Coopérative Aubier', effectif: 2, collisionsCumulees: 2, pairesDistinctes: 1, excedent: 1 },
      { groupe: 'Atelier Ressac', effectif: 2, collisionsCumulees: 1, pairesDistinctes: 1, excedent: 0 },
    ],
  });
  const complementsDeBase = () => ({
    planchersValides: true,
    planchersCollisions: [1, 1],
    objectifsParTour: [{ hors: 2, plancher: 1 }, { hors: 0, plancher: 0 }],
    plancherConflits: 1,
    phiAffilies: [3, 3, 2, 3],
    aMax: [2, 2, 2, 3],
  });
  const plafonds = () => [3, 3, 3, 3];
  // La base, mesures et compléments, dont modifier(mesures, complements) a
  // changé une valeur.
  const avec = (modifier) => {
    const mesures = base();
    const complements = complementsDeBase();
    modifier(mesures, complements);
    return { mesures, complements };
  };
  const verifier = ({ mesures, complements }) => verifierIndicateurs(mesures, plafonds(), plafonds(), complements);

  // Chaque code, la mesure forgée qui le lève, seul.
  const MUTATIONS_COMPLEMENTS = [
    ['collisions cumulées 0 sous le plancher 1 de Ressac', (m) => { m.parGroupe[1].collisionsCumulees = 0; },
      [{ code: 'RESTE_NEGATIF', groupe: 1 }]],
    ['hors objectif 0 sous le plancher 1 du tour 1', (m, c) => { c.objectifsParTour[0].hors = 0; },
      [{ code: 'RESTE_OBJECTIFS_NEGATIF', tour: 1 }]],
    ['conflits 0 sous le plancher 1 des réservations', (m) => { m.conflitsOrganisation = 0; },
      [{ code: 'RESTE_CONFLITS_NEGATIF' }]],
    ['A(p) 2 au-delà de rencontres 1', (m) => { m.rencontres[0] = 1; },
      [{ code: 'DIVERSITE_RENCONTRES', index: 0 }]],
    ['A(p) 2 au-delà de |F(p)| 1', (m) => { m.affilies[1] = 1; },
      [{ code: 'DIVERSITE_AFFILIES', index: 1 }]],
    ['|F(p)| 3 au-delà de Φ_aff 2', (m, c) => { c.phiAffilies[3] = 2; },
      [{ code: 'AFFILIES_PLAFOND', index: 3 }]],
    ['A(p) 2 au-delà de A_max 1', (m, c) => { c.aMax[1] = 1; },
      [{ code: 'BORNE_DIVERSITE', index: 1 }]],
  ];

  test('les compléments d’un plan qui tient ne lèvent rien ; chaque inégalité est large', () => {
    assert.deepEqual(verifier(avec(() => {})), []);
    const egalite = avec((m, c) => {
      m.affilies = [3, 3, 3, 3];
      m.organisationsVues = [3, 3, 3, 3];
      m.parGroupe[0].collisionsCumulees = 1;
      c.phiAffilies = [3, 3, 3, 3];
      c.aMax = [3, 3, 3, 3];
      c.objectifsParTour[0].hors = 1;
      m.conflitsOrganisation = 1;
    });
    assert.deepEqual(verifier(egalite), []);
  });

  test('chaque code a sa mesure forgée, et aucun autre ne tombe', () => {
    const cas = MUTATIONS_COMPLEMENTS.map(([libelle, modifier, attendu]) => [libelle, () => verifier(avec(modifier)), attendu]);
    assert.deepEqual(ecarts(cas), []);
  });

  test('sans compléments, aucun des sept codes ne tombe : la sortie est celle des trois paramètres', () => {
    // Chaque mesure forgée, puis toutes à la fois, avec une DEPASSEMENT :
    // sans compléments, null ou absents, seule la ligne est éprouvée.
    const toutes = avec((m, c) => {
      for (const [, modifier] of MUTATIONS_COMPLEMENTS) modifier(m, c);
      m.rencontres[2] = 4;
    });
    const cas = [];
    for (const [libelle, modifier] of [...MUTATIONS_COMPLEMENTS, ['toutes', () => {}]]) {
      const { mesures } = libelle === 'toutes' ? toutes : avec(modifier);
      const attendu = verifierIndicateurs(mesures, plafonds(), plafonds());
      cas.push([`${libelle}, compléments null`, () => verifierIndicateurs(mesures, plafonds(), plafonds(), null), attendu]);
      cas.push([`${libelle}, compléments absents`, () => verifierIndicateurs(mesures, plafonds(), plafonds(), undefined), attendu]);
    }
    assert.deepEqual(ecarts(cas), []);
    assert.deepEqual(verifierIndicateurs(toutes.mesures, plafonds(), plafonds()), [{ code: 'DEPASSEMENT', index: 2 }]);
  });

  test('les trois restes ne s’éprouvent que sur un plan où les planchers valent', () => {
    const horsDomaine = avec((m, c) => {
      c.planchersValides = false;
      m.parGroupe[1].collisionsCumulees = 0;
      c.objectifsParTour[0].hors = 0;
      m.conflitsOrganisation = 0;
    });
    assert.deepEqual(verifier(horsDomaine), []);
    // La diversité s'éprouve, elle, hors du domaine des planchers.
    horsDomaine.complements.aMax[1] = 1;
    assert.deepEqual(verifier(horsDomaine), [{ code: 'BORNE_DIVERSITE', index: 1 }]);
  });

  test('un complément null n’est pas lu : planchers des collisions, des objectifs, Φ_aff, A_max', () => {
    const cas = [
      ['planchersCollisions null', (m, c) => { m.parGroupe[1].collisionsCumulees = 0; c.planchersCollisions = null; }],
      ['objectifsParTour null', (m, c) => { c.objectifsParTour[0].hors = 0; c.objectifsParTour = null; }],
      ['plancherConflits null', (m, c) => { m.conflitsOrganisation = 0; c.plancherConflits = null; }],
      ['plancherConflits absent', (m, c) => { m.conflitsOrganisation = 0; delete c.plancherConflits; }],
      ['phiAffilies null', (m, c) => { c.phiAffilies[3] = 2; c.phiAffilies = null; }],
      ['aMax null', (m, c) => { c.aMax[1] = 1; c.aMax = null; }],
      ['parGroupe absent, planchersCollisions null', (m, c) => { delete m.parGroupe; c.planchersCollisions = null; }],
    ].map(([libelle, modifier]) => [libelle, () => verifier(avec(modifier)), []]);
    // Φ_aff et A_max null : leurs deux codes se taisent, ceux que les mesures
    // seules décident s'éprouvent encore.
    cas.push([
      'phiAffilies et aMax null, A(p) au-delà de rencontres et de |F(p)|',
      () => verifier(avec((m, c) => {
        m.rencontres[0] = 1;
        m.affilies[1] = 1;
        c.phiAffilies = null;
        c.aMax = null;
      })),
      [{ code: 'DIVERSITE_RENCONTRES', index: 0 }, { code: 'DIVERSITE_AFFILIES', index: 1 }],
    ]);
    assert.deepEqual(ecarts(cas), []);
  });

  test('un tour sans objet, hors et plancher null, n’est pas lu ; un seul des deux null fait tomber le tour', () => {
    const cas = [
      ['hors et plancher null au tour 2', (m, c) => { c.objectifsParTour[1] = { hors: null, plancher: null }; }, []],
      ['hors et plancher null au tour 1, hors 0 sous le plancher 1 au tour 2', (m, c) => {
        c.objectifsParTour = [{ hors: null, plancher: null }, { hors: 0, plancher: 1 }];
      }, [{ code: 'RESTE_OBJECTIFS_NEGATIF', tour: 2 }]],
      ['plancher null seul', (m, c) => { c.objectifsParTour[1].plancher = null; }, [{ code: 'RESTE_OBJECTIFS_NEGATIF', tour: 2 }]],
    ].map(([libelle, modifier, attendu]) => [libelle, () => verifier(avec(modifier)), attendu]);
    assert.deepEqual(ecarts(cas), []);
  });

  test('les violations d’une personne suivent sa ligne ; les restes viennent après les totaux, organisation puis tour', () => {
    const { mesures, complements } = avec((m, c) => {
      for (const [, modifier] of MUTATIONS_COMPLEMENTS) modifier(m, c);
      m.parGroupe[0].collisionsCumulees = 0;
      c.objectifsParTour[1].plancher = 1;
      m.rencontres[1] = 4;
      m.objectifs = { tours: [0, 0, 0, 0], possibles: [0, 0, 0, 0], jamaisServies: 3, horsObjectifMax: 0, concernes: 2 };
      m.toursAssis = [2, 2, 2, 2];
    });
    assert.deepEqual(verifierIndicateurs(mesures, plafonds(), plafonds(), complements), [
      { code: 'DIVERSITE_RENCONTRES', index: 0 },
      { code: 'DEPASSEMENT', index: 1 },
      { code: 'DIVERSITE_AFFILIES', index: 1 },
      { code: 'BORNE_DIVERSITE', index: 1 },
      { code: 'AFFILIES_PLAFOND', index: 3 },
      { code: 'JAMAIS_SERVIES' },
      { code: 'RESTE_NEGATIF', groupe: 0 },
      { code: 'RESTE_NEGATIF', groupe: 1 },
      { code: 'RESTE_OBJECTIFS_NEGATIF', tour: 1 },
      { code: 'RESTE_OBJECTIFS_NEGATIF', tour: 2 },
      { code: 'RESTE_CONFLITS_NEGATIF' },
    ]);
  });

  test('une valeur qui n’est pas un nombre fait tomber les inégalités qui la lisent', () => {
    const cas = [
      ['A(p) NaN', (m) => { m.organisationsVues[2] = Number.NaN; },
        [{ code: 'DIVERSITE_RENCONTRES', index: 2 }, { code: 'DIVERSITE_AFFILIES', index: 2 }, { code: 'BORNE_DIVERSITE', index: 2 }]],
      ['|F(p)| en texte', (m) => { m.affilies[2] = '2'; },
        [{ code: 'DIVERSITE_AFFILIES', index: 2 }, { code: 'AFFILIES_PLAFOND', index: 2 }]],
      ['Φ_aff indéfini', (m, c) => { c.phiAffilies[2] = undefined; }, [{ code: 'AFFILIES_PLAFOND', index: 2 }]],
      ['A_max null', (m, c) => { c.aMax[2] = null; }, [{ code: 'BORNE_DIVERSITE', index: 2 }]],
      ['plancher des collisions NaN', (m, c) => { c.planchersCollisions[0] = Number.NaN; }, [{ code: 'RESTE_NEGATIF', groupe: 0 }]],
      ['hors objectif null', (m, c) => { c.objectifsParTour[1].hors = null; }, [{ code: 'RESTE_OBJECTIFS_NEGATIF', tour: 2 }]],
    ].map(([libelle, modifier, attendu]) => [libelle, () => verifier(avec(modifier)), attendu]);
    assert.deepEqual(ecarts(cas), []);
  });

  test('un complément d’une autre forme lève : longueurs, listes manquantes, validité non booléenne', () => {
    const cas = [
      ['Φ_aff de 3 cases', (m, c) => { c.phiAffilies.pop(); }, RangeError],
      ['A_max de 5 cases', (m, c) => { c.aMax.push(3); }, RangeError],
      ['un plancher de collisions de plus que parGroupe', (m, c) => { c.planchersCollisions.push(0); }, RangeError],
      ['parGroupe absent, des planchers de collisions', (m) => { delete m.parGroupe; },
        { name: 'TypeError', message: 'parGroupe : liste attendue avec planchersCollisions' }],
      ['parGroupe en objet, des planchers de collisions', (m) => { m.parGroupe = { length: 2 }; },
        { name: 'TypeError', message: 'parGroupe : liste attendue avec planchersCollisions' }],
      ['A(p) absent', (m) => { delete m.organisationsVues; }, TypeError],
      ['|F(p)| de 3 cases', (m) => { m.affilies.pop(); }, RangeError],
      ['objectifsParTour qui n’est pas une liste', (m, c) => { c.objectifsParTour = { hors: 0, plancher: 0 }; },
        { name: 'TypeError', message: 'objectifsParTour : liste ou null attendue' }],
      // Une erreur nommée, et non celle d'une déstructuration de null.
      ['un tour null dans objectifsParTour', (m, c) => { c.objectifsParTour[1] = null; },
        { name: 'TypeError', message: /^objectifsParTour\[1\] : objet attendu/ }],
      ['un tour nombre dans objectifsParTour, hors du domaine des planchers', (m, c) => {
        c.planchersValides = false;
        c.objectifsParTour[0] = 2;
      }, { name: 'TypeError', message: /^objectifsParTour\[0\] : objet attendu/ }],
      ['planchersValides en texte', (m, c) => { c.planchersValides = 'oui'; }, TypeError],
      ['planchersValides absent', (m, c) => { delete c.planchersValides; }, TypeError],
    ];
    for (const [libelle, modifier, erreur] of cas) assert.throws(() => verifier(avec(modifier)), erreur, libelle);
    for (const valeur of [3, 'compléments', true]) {
      assert.throws(
        () => verifierIndicateurs(base(), plafonds(), plafonds(), valeur),
        { name: 'TypeError', message: 'complements : objet ou null attendu' },
        String(valeur),
      );
    }
  });

  test('ne modifie ni les mesures ni les compléments, que tout tienne ou que tout tombe', () => {
    const geler = (valeur) => {
      if (valeur !== null && typeof valeur === 'object') {
        for (const champ of Object.values(valeur)) geler(champ);
        Object.freeze(valeur);
      }
      return valeur;
    };
    const tout = avec((m, c) => {
      for (const [, modifier] of MUTATIONS_COMPLEMENTS) modifier(m, c);
    });
    for (const entrees of [avec(() => {}), tout]) {
      geler(entrees);
      const copie = structuredClone(entrees);
      verifier(entrees);
      assert.deepEqual(entrees, copie);
    }
  });

  test('la petite démonstration et son plan parfait tiennent ; un plancher forgé au-delà de ses collisions lève', () => {
    const tableDe = indexerPlan(INSTANCE, PLAN_PARFAIT);
    const mesures = mesurer(INSTANCE, tableDe);
    const { phiAffilies, aMax } = borneDiversite(INSTANCE, tableDe);
    // Le plancher de chaque organisation, 0 quand le diagnostic se tait.
    const parNom = new Map(planchersCollisions(INSTANCE).map(({ groupe, plancherCumulees }) => [groupe, plancherCumulees]));
    const planchers = INSTANCE.groupes.map((groupe) => parNom.get(groupe) ?? 0);
    const complements = { planchersValides: true, planchersCollisions: planchers, objectifsParTour: null, phiAffilies, aMax };
    const realises = plafondsRealises(INSTANCE, tableDe);
    assert.deepEqual(verifierIndicateurs(mesures, plafondsAPriori(INSTANCE), realises, complements), []);
    const forges = planchers.map((plancher, g) => (g === 1 ? mesures.parGroupe[g].collisionsCumulees + 1 : plancher));
    assert.deepEqual(
      verifierIndicateurs(mesures, plafondsAPriori(INSTANCE), realises, { ...complements, planchersCollisions: forges }),
      [{ code: 'RESTE_NEGATIF', groupe: 1 }],
    );
  });
});

describe('verifierIndicateurs : les inclusions (§ 5.4, § 12.3)', () => {
  // Quatre personnes qui rencontrent chacune une personne sous des plafonds
  // de 3 : la ligne de décomposition tient. 1 et 3 portent des lignes.
  const plafonds = () => [3, 3, 3, 3];
  const inclusions = () => ({
    cible: 3,
    satisfaites: 2,
    avis: 1,
    nonSatisfaites: [{ p: 0, cible: 1, reciproque: false }],
    parPersonne: [
      { p: 0, actives: 2, besoin: 2, plafond: 3, atteignables: 2, satisfaites: 1, auDelaDuPlafond: false },
      { p: 2, actives: 1, besoin: 1, plafond: 3, atteignables: 1, satisfaites: 1, auDelaDuPlafond: false },
    ],
  });
  const avec = (modifier) => {
    const mesures = { rencontres: [1, 1, 1, 1], inclusions: inclusions() };
    modifier(mesures.inclusions);
    return mesures;
  };

  test('des inclusions qui tiennent, null ou absentes : aucune violation', () => {
    assert.deepEqual(verifierIndicateurs(avec(() => {}), plafonds(), plafonds()), []);
    assert.deepEqual(verifierIndicateurs({ rencontres: [1, 1, 1, 1], inclusions: null }, plafonds(), plafonds()), []);
    assert.deepEqual(verifierIndicateurs({ rencontres: [1, 1, 1, 1] }, plafonds(), plafonds()), []);
  });

  test('chaque écart a son code ; la borne de chacun ne se lit pas quand le plafond a priori est inconnu', () => {
    const cas = [
      ['satisfaites 2 > atteignables 1', (i) => { i.parPersonne[1].satisfaites = 2; }, [{ code: 'INCLUSIONS_SATISFAITES', index: 2 }]],
      ['satisfaites négatives', (i) => { i.parPersonne[0].satisfaites = -1; }, [{ code: 'INCLUSIONS_SATISFAITES', index: 0 }]],
      ['avis ≠ cible − satisfaites', (i) => { i.avis = 2; }, [{ code: 'INCLUSIONS_AVIS' }]],
      ['un avis sans unité nommée', (i) => { i.nonSatisfaites = []; }, [{ code: 'INCLUSIONS_AVIS' }]],
      ['satisfaites > cible', (i) => { i.satisfaites = 4; i.avis = -1; }, [{ code: 'INCLUSIONS_AVIS' }]],
      ['satisfaites négatives au total', (i) => { i.satisfaites = -1; i.avis = 4; }, [{ code: 'INCLUSIONS_AVIS' }]],
      ['les deux, la personne d’abord', (i) => { i.parPersonne[0].satisfaites = 3; i.avis = 0; },
        [{ code: 'INCLUSIONS_SATISFAITES', index: 0 }, { code: 'INCLUSIONS_AVIS' }]],
    ];
    const ecarts = cas
      .map(([libelle, modifier, attendu]) => [libelle, verifierIndicateurs(avec(modifier), plafonds(), plafonds()), attendu])
      .filter(([, recu, attendu]) => JSON.stringify(recu) !== JSON.stringify(attendu))
      .map(([libelle, recu]) => `${libelle} : ${JSON.stringify(recu)}`);
    assert.deepEqual(ecarts, []);
    const inconnu = verifierIndicateurs(avec((i) => { i.parPersonne[1].satisfaites = 2; }), null, plafonds());
    assert.deepEqual(inconnu, []);
  });

  test('les violations des inclusions suivent celles des totaux et précèdent les restes', () => {
    const mesures = {
      ...avec((i) => { i.avis = 0; }),
      toursAssis: [1, 1, 1, 1],
      objectifs: { tours: [0, 0, 0, 0], possibles: [0, 0, 0, 0], jamaisServies: 5, concernes: 0, horsObjectifMax: 0 },
      organisationsVues: [0, 0, 0, 0],
      affilies: [0, 0, 0, 0],
      parGroupe: [],
      conflitsOrganisation: 0,
    };
    const complements = { planchersValides: true, plancherConflits: 1 };
    assert.deepEqual(verifierIndicateurs(mesures, plafonds(), plafonds(), complements), [
      { code: 'JAMAIS_SERVIES' },
      { code: 'INCLUSIONS_AVIS' },
      { code: 'RESTE_CONFLITS_NEGATIF' },
    ]);
  });

  test('sur un plan mesuré, les inclusions tiennent', () => {
    // 1 inclut 2, qu'il rencontre, et 3, qu'il ne rencontre pas.
    const instance = normaliser({
      participants: [
        { id: 1, nom: 'P1', organisation: null, inclusionsParticipant: [2, 3] },
        { id: 2, nom: 'P2', organisation: null },
        { id: 3, nom: 'P3', organisation: null },
        { id: 4, nom: 'P4', organisation: null },
      ],
      tables: [{ id: 1, numero: 1, capacite: 2 }, { id: 2, numero: 2, capacite: 2 }],
      tours: 2,
      reservations: [],
      contraintes: { separerOrganisations: false, nouveauxVoisins: false, nouvelleTable: false, varierOrganisations: false },
    });
    const tableDe = indexerPlan(instance, { tables: [1, 2], tours: [[[1, 2], [3, 4]], [[1, 2], [3, 4]]], reserves: [[], []] });
    const mesures = mesurer(instance, tableDe);
    assert.equal(mesures.inclusions.avis, 1);
    assert.deepEqual(verifierIndicateurs(mesures, plafondsAPriori(instance), plafondsRealises(instance, tableDe)), []);
  });
});
