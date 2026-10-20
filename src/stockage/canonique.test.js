// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la forme canonique du fichier d'état (§ 8.8, § 8.9) : le texte
// exact que le contrat de données attend du sérialiseur, la canonicité quel
// que soit l'ordre dans lequel une charge s'est construite, la charge seule
// dans la mise en page du fichier, l'aller-retour par l'analyse, le retenu
// que sa règle refuse, recopié hors du schéma, les champs facultatifs et
// leur rang, un sérialiseur dont la sortie ne dépend que de
// ses arguments, et la copie canonique partagée : les propositions figées y
// prêtent une copie figée et son texte, que les sorties ne distinguent pas
// d'une copie neuve, et la copie canonique refaite là seulement où des
// opérations l'ont modifiée en place (recanoniser), qui rend ce que rend
// canoniser. Les noms des charges d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { versionVoisine } from '../../test/version_voisine.js';
import { texteLivre } from '../demo/livrees.js';
import { VERSION } from '../version.genere.js';
import {
  canoniser,
  canoniserPartagee,
  recanoniser,
  serialiser,
  serialiserCanonique,
  serialiserCharge,
} from './canonique.js';
import { analyser } from './document.js';
import { estFigee, figer, gelerPropositions } from './gel.js';

// En-tête du texte du contrat.
const ENTETE = Object.freeze({ revision: 3, produitVersion: VERSION.affichee });

// Texte exact que le contrat de données (types.js) attend de serialiser pour
// chargeContrat() sous ENTETE, fin de ligne finale comprise.
const TEXTE_CONTRAT = `{
  "entete": {"format":3,"produitVersion":"${VERSION.affichee}","revision":3,"comptes":{"participants":4,"tables":2,"reservations":1,"titres":1,"propositions":1,"retenu":0}},
  "charge": {
    "evenement": {"id":"evt-essai","nom":"Soirée d'essai","date":null,"siegesParDefaut":2,"tours":2,"unite":"cm","etat":"propose","filiation":null},
    "reglages": {"separerAppartenances":true,"nouveauxVoisins":true,"nouvelleTable":true,"varierAppartenances":true,"attribuerSieges":false,"generation":{"nombre":5,"arret":200000,"historique":1000}},
    "prochainsIds": {"participant":5,"table":3,"proposition":2},
    "participants": [
      {"id":1,"nom":"Ombrelle","prenom":"Iris","appartenance":"Club des Merles","courriel":null,"titrePressenti":"animation","notes":null,"exclu":false},
      {"id":2,"nom":"Grisaille","prenom":null,"appartenance":"Club des Merles","courriel":"g@exemple.test","titrePressenti":null,"notes":null,"exclu":false},
      {"id":3,"nom":"Pervenche","prenom":"Théo","appartenance":null,"courriel":null,"titrePressenti":null,"notes":"arrive tard","exclu":false},
      {"id":4,"nom":"Lacasse","prenom":"Ondine","appartenance":"Société Alpha","courriel":null,"titrePressenti":null,"notes":null,"exclu":false}
    ],
    "tables": [
      {"id":1,"numero":1,"sieges":null,"forme":"ronde","position":{"x":0,"y":0}},
      {"id":2,"numero":2,"sieges":null,"forme":"carree","position":{"x":250,"y":0}}
    ],
    "reservations": [
      {"participant":1,"table":1,"siege":1,"portee":"tous","tour":null}
    ],
    "titres": [
      {"table":1,"siege":1,"libelle":"animation"}
    ],
    "propositions": [
      {"id":1,"graine":48271,"arret":200000,"historique":1000,"produitVersion":"${VERSION.affichee}","siegesAttribues":false,"tables":[1,2],"capacites":[2,2],"tours":2,"participants":[1,2,3,4],"placement":[
        {"sieges":[[1,3],[2,4]],"reserve":[]},
        {"sieges":[[1,4],[2,3]],"reserve":[]}
      ]}
    ],
    "retenu": null
  }
}
`;

// La charge que décrit TEXTE_CONTRAT, une copie neuve à chaque appel.
function chargeContrat() {
  return {
    evenement: {
      id: 'evt-essai',
      nom: "Soirée d'essai",
      date: null,
      siegesParDefaut: 2,
      tours: 2,
      unite: 'cm',
      etat: 'propose',
      filiation: null,
    },
    reglages: {
      separerAppartenances: true,
      nouveauxVoisins: true,
      nouvelleTable: true,
      varierAppartenances: true,
      attribuerSieges: false,
      generation: { nombre: 5, arret: 200_000, historique: 1_000 },
    },
    prochainsIds: { participant: 5, table: 3, proposition: 2 },
    participants: [
      { id: 1, nom: 'Ombrelle', prenom: 'Iris', appartenance: 'Club des Merles', courriel: null,
        titrePressenti: 'animation', notes: null, exclu: false },
      { id: 2, nom: 'Grisaille', prenom: null, appartenance: 'Club des Merles', courriel: 'g@exemple.test',
        titrePressenti: null, notes: null, exclu: false },
      { id: 3, nom: 'Pervenche', prenom: 'Théo', appartenance: null, courriel: null,
        titrePressenti: null, notes: 'arrive tard', exclu: false },
      { id: 4, nom: 'Lacasse', prenom: 'Ondine', appartenance: 'Société Alpha', courriel: null,
        titrePressenti: null, notes: null, exclu: false },
    ],
    tables: [
      { id: 1, numero: 1, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } },
      { id: 2, numero: 2, sieges: null, forme: 'carree', position: { x: 250, y: 0 } },
    ],
    reservations: [{ participant: 1, table: 1, siege: 1, portee: 'tous', tour: null }],
    titres: [{ table: 1, siege: 1, libelle: 'animation' }],
    propositions: [
      {
        id: 1,
        graine: 48_271,
        arret: 200_000,
        historique: 1_000,
        produitVersion: VERSION.affichee,
        siegesAttribues: false,
        tables: [1, 2],
        capacites: [2, 2],
        tours: 2,
        participants: [1, 2, 3, 4],
        placement: [
          { sieges: [[1, 3], [2, 4]], reserve: [] },
          { sieges: [[1, 4], [2, 3]], reserve: [] },
        ],
      },
    ],
    retenu: null,
  };
}

// texte où avant, qui doit y figurer exactement une fois, devient apres.
// Une épreuve qui dérive son attendu d'un autre texte échoue ainsi quand le
// remplacement ne trouve rien, au lieu de comparer deux textes inchangés.
function remplacer(texte, avant, apres) {
  assert.equal(texte.split(avant).length, 2, `« ${avant} » doit figurer une fois`);
  return texte.replace(avant, () => apres);
}

// La charge du contrat avec un retenu à sièges non attribués dont les listes
// de table arrivent non triées, et le texte qui l'écrit : le retenu prend la
// mise en page d'une proposition, à la clé retenu, et l'en-tête le compte.
function chargeAvecRetenu() {
  const charge = chargeContrat();
  charge.retenu = {
    proposition: 1,
    siegesAttribues: false,
    tables: [1, 2],
    capacites: [2, 2],
    tours: 2,
    participants: [1, 2, 3, 4],
    placement: [
      { sieges: [[3, 1], [2, 4]], reserve: [] },
      { sieges: [[4, 1], [3, 2]], reserve: [] },
    ],
  };
  return charge;
}
const TEXTE_AVEC_RETENU = remplacer(
  remplacer(TEXTE_CONTRAT, '"retenu":0}}', '"retenu":1}}'),
  '    "retenu": null\n',
  [
    '    "retenu": {"proposition":1,"siegesAttribues":false,"tables":[1,2],"capacites":[2,2],"tours":2,"participants":[1,2,3,4],"placement":[',
    '      {"sieges":[[1,3],[2,4]],"reserve":[]},',
    '      {"sieges":[[1,4],[2,3]],"reserve":[]}',
    '    ]}',
    '',
  ].join('\n'),
);

// Une charge dont toutes les listes sont vides, avec une filiation, et dont
// le nom porte des guillemets droits ; puis le texte qui l'écrit, révision 1.
function chargeSansListe() {
  return {
    evenement: {
      id: 'evt-neuf',
      nom: 'Atelier "jeudi"',
      date: '2026-11-12',
      siegesParDefaut: 8,
      tours: 3,
      unite: 'cm',
      etat: 'brouillon',
      filiation: {
        source: { id: 'evt-modele', nom: 'Atelier modèle' },
        instant: { revision: 7, libelle: 'Tables posées' },
      },
    },
    reglages: {
      separerAppartenances: false,
      nouveauxVoisins: true,
      nouvelleTable: false,
      varierAppartenances: true,
      attribuerSieges: false,
      generation: { nombre: 2, arret: 1_000, historique: 10 },
    },
    prochainsIds: { participant: 1, table: 1, proposition: 1 },
    participants: [],
    tables: [],
    reservations: [],
    titres: [],
    propositions: [],
    retenu: null,
  };
}
const TEXTE_SANS_LISTE = `{
  "entete": {"format":3,"produitVersion":"${VERSION.affichee}","revision":1,"comptes":{"participants":0,"tables":0,"reservations":0,"titres":0,"propositions":0,"retenu":0}},
  "charge": {
    "evenement": {"id":"evt-neuf","nom":"Atelier \\"jeudi\\"","date":"2026-11-12","siegesParDefaut":8,"tours":3,"unite":"cm","etat":"brouillon","filiation":{"source":{"id":"evt-modele","nom":"Atelier modèle"},"instant":{"revision":7,"libelle":"Tables posées"}}},
    "reglages": {"separerAppartenances":false,"nouveauxVoisins":true,"nouvelleTable":false,"varierAppartenances":true,"attribuerSieges":false,"generation":{"nombre":2,"arret":1000,"historique":10}},
    "prochainsIds": {"participant":1,"table":1,"proposition":1},
    "participants": [],
    "tables": [],
    "reservations": [],
    "titres": [],
    "propositions": [],
    "retenu": null
  }
}
`;

// Copie de valeur dont chaque objet reçoit ses clés dans l'ordre inverse :
// un sérialiseur qui suivrait l'ordre d'insertion écrirait un autre texte.
// Object.fromEntries pose chaque clé en propre, « __proto__ » comprise.
function aRebours(valeur) {
  if (Array.isArray(valeur)) return valeur.map(aRebours);
  if (typeof valeur !== 'object' || valeur === null) return valeur;
  return Object.fromEntries(Object.keys(valeur).reverse().map((cle) => [cle, aRebours(valeur[cle])]));
}

// Gèle valeur et tout ce qu'elle contient : une écriture y lève TypeError,
// le module s'exécutant en mode strict.
function geler(valeur) {
  if (typeof valeur === 'object' && valeur !== null) {
    for (const enfant of Object.values(valeur)) geler(enfant);
    Object.freeze(valeur);
  }
  return valeur;
}

// Chaque objet et chaque liste que porte valeur, elle comprise :
// JSON.stringify présente chacun à la fonction de remplacement avant de
// l'écrire.
function objetsDe(valeur) {
  const objets = new Set();
  JSON.stringify(valeur, (_, enfant) => {
    if (typeof enfant === 'object' && enfant !== null) objets.add(enfant);
    return enfant;
  });
  return objets;
}

// Exécute fonction pendant que l'horloge et les sources d'aléa lèvent à leur
// lecture, puis les rétablit telles qu'elles étaient, propres ou héritées ;
// rend ce que rend fonction.
function sansHorlogeNiAlea(fonction) {
  const interdite = (nom) => () => {
    throw new Error(`${nom} lu`);
  };
  const remplacees = [
    [Math, 'random'],
    [Date, 'now'],
    [performance, 'now'],
    [crypto, 'getRandomValues'],
    [crypto, 'randomUUID'],
  ].map(([objet, nom]) => ({ objet, nom, propre: Object.hasOwn(objet, nom), valeur: objet[nom] }));
  const DateReelle = globalThis.Date;
  for (const { objet, nom } of remplacees) objet[nom] = interdite(nom);
  function DateInterdite() {
    throw new Error('Date lu');
  }
  DateInterdite.now = interdite('Date.now');
  globalThis.Date = DateInterdite;
  try {
    return fonction();
  } finally {
    globalThis.Date = DateReelle;
    for (const { objet, nom, propre, valeur } of remplacees) {
      if (propre) objet[nom] = valeur;
      else delete objet[nom];
    }
  }
}

describe('serialiser : le texte du contrat de données (§ 8.8)', () => {
  test('la charge du contrat, révision 3, rend le texte du contrat octet pour octet, fin de ligne finale comprise', () => {
    assert.equal(serialiser(chargeContrat(), ENTETE), TEXTE_CONTRAT);
  });

  test("un retenu non nul suit la mise en page d'une proposition, à la clé retenu, et l'en-tête le compte", () => {
    assert.equal(serialiser(chargeAvecRetenu(), ENTETE), TEXTE_AVEC_RETENU);
  });

  test('une liste vide s\'écrit [] sur la ligne de sa clé ; les chaînes passent par JSON.stringify', () => {
    assert.equal(serialiser(chargeSansListe(), { revision: 1, produitVersion: VERSION.affichee }), TEXTE_SANS_LISTE);
  });

  test('un placement vide s\'écrit [] sur la ligne qui ouvre sa proposition', () => {
    const charge = chargeContrat();
    charge.propositions[0].placement = [];
    const attendu = remplacer(
      TEXTE_CONTRAT,
      '"placement":[\n        {"sieges":[[1,3],[2,4]],"reserve":[]},\n        {"sieges":[[1,4],[2,3]],"reserve":[]}\n      ]}',
      '"placement":[]}',
    );
    assert.equal(serialiser(charge, ENTETE), attendu);
  });
});

describe('canonicité (§ 8.8, § 8.9)', () => {
  test('la même charge construite dans un autre ordre — participants 4, 2, 1, 3, clés à rebours, listes de table non triées — rend le même texte', () => {
    const desordre = chargeContrat();
    desordre.participants = [4, 2, 1, 3].map((id) => desordre.participants.find((p) => p.id === id));
    desordre.propositions[0].placement = [
      { sieges: [[3, 1], [4, 2]], reserve: [] },
      { sieges: [[4, 1], [3, 2]], reserve: [] },
    ];
    const renversee = aRebours(desordre);
    // L'épreuve n'a d'objet que si l'ordre a réellement changé.
    assert.deepEqual(Object.keys(renversee.evenement), Object.keys(chargeContrat().evenement).reverse());
    assert.deepEqual(Object.keys(renversee)[0], 'retenu');
    assert.deepEqual(renversee.participants.map((p) => p.id), [4, 2, 1, 3]);
    assert.equal(serialiser(renversee, ENTETE), serialiser(chargeContrat(), ENTETE));
    assert.equal(serialiser(renversee, ENTETE), TEXTE_CONTRAT);
  });

  test("une proposition, ou le retenu, à siegesAttribues vrai garde l'ordre de ses listes de table ; à faux, chacune se trie", () => {
    const charge = chargeContrat();
    charge.propositions[0].siegesAttribues = true;
    charge.propositions[0].placement[0].sieges = [[3, 1], [4, 2]];
    const attendu = remplacer(
      remplacer(
        TEXTE_CONTRAT,
        `"produitVersion":"${VERSION.affichee}","siegesAttribues":false`,
        `"produitVersion":"${VERSION.affichee}","siegesAttribues":true`,
      ),
      '{"sieges":[[1,3],[2,4]],"reserve":[]}',
      '{"sieges":[[3,1],[4,2]],"reserve":[]}',
    );
    assert.equal(serialiser(charge, ENTETE), attendu);
    assert.deepEqual(canoniser(charge).propositions[0].placement[0].sieges, [[3, 1], [4, 2]]);
    const retenu = chargeAvecRetenu();
    assert.deepEqual(canoniser(retenu).retenu.placement[1].sieges, [[1, 4], [2, 3]]);
    retenu.retenu.siegesAttribues = true;
    assert.deepEqual(canoniser(retenu).retenu.placement[1].sieges, [[4, 1], [3, 2]]);
  });

  test("basculer le réglage attribuerSieges ne change l'ordre d'aucune proposition déjà écrite", () => {
    // Deux propositions, l'une à sièges attribués dont les listes ne sont
    // pas croissantes, l'autre à sièges non attribués ; un retenu à sièges
    // attribués. Le réglage vaut tour à tour faux et vrai.
    const charge = chargeAvecRetenu();
    charge.retenu.siegesAttribues = true;
    charge.propositions.push({
      ...charge.propositions[0],
      id: 2,
      siegesAttribues: true,
      placement: [
        { sieges: [[3, 1], [4, 2]], reserve: [] },
        { sieges: [[4, 1], [3, 2]], reserve: [] },
      ],
    });
    const textes = [false, true].map((attribuerSieges) => {
      charge.reglages.attribuerSieges = attribuerSieges;
      return serialiser(charge, ENTETE).split('\n');
    });
    assert.equal(textes[1].length, textes[0].length);
    const differentes = textes[0].flatMap((ligne, i) => (ligne === textes[1][i] ? [] : [i]));
    assert.deepEqual(differentes.map((i) => textes[0][i].slice(0, 16)), ['    "reglages": ']);
    for (const lignes of textes) {
      assert.ok(lignes.includes('        {"sieges":[[1,3],[2,4]],"reserve":[]},'));
      assert.ok(lignes.includes('        {"sieges":[[3,1],[4,2]],"reserve":[]},'));
      assert.ok(lignes.includes('      {"sieges":[[4,1],[3,2]],"reserve":[]}'));
    }
  });

  test("l'ordre des tables d'une proposition est gardé : il apparie chaque liste à sa table", () => {
    const charge = chargeContrat();
    Object.assign(charge.propositions[0], {
      tables: [2, 1],
      capacites: [2, 2],
      placement: [
        { sieges: [[4, 2], [3, 1]], reserve: [] },
        { sieges: [[3, 2], [4, 1]], reserve: [] },
      ],
    });
    const proposition = canoniser(charge).propositions[0];
    assert.deepEqual(proposition.tables, [2, 1]);
    assert.deepEqual(proposition.placement.map((tour) => tour.sieges), [[[2, 4], [1, 3]], [[2, 3], [1, 4]]]);
  });

  test("les participants d'un plan et chaque réserve sont des ensembles : ils se rangent par identifiant croissant, quel que soit siegesAttribues", () => {
    // Au tour 1 du retenu et au tour 2 de la proposition, deux personnes
    // attendent hors des tables. croissants faux pose chaque réserve et
    // chaque liste de participants à rebours ; les listes de table, elles,
    // sont les mêmes dans les deux charges.
    const plans = (siegesAttribues, croissants) => {
      const ordonner = (ids) => (croissants ? ids : [...ids].reverse());
      const charge = chargeAvecRetenu();
      for (const plan of [charge.propositions[0], charge.retenu]) {
        Object.assign(plan, { siegesAttribues, participants: ordonner([1, 2, 3, 4]) });
      }
      charge.retenu.placement[0] = { sieges: [[1], [4]], reserve: ordonner([2, 3]) };
      charge.propositions[0].placement[1] = { sieges: [[1], [2]], reserve: ordonner([3, 4]) };
      return charge;
    };
    for (const siegesAttribues of [false, true]) {
      assert.equal(serialiser(plans(siegesAttribues, false), ENTETE), serialiser(plans(siegesAttribues, true), ENTETE));
      const copie = canoniser(plans(siegesAttribues, false));
      assert.deepEqual(copie.propositions[0].participants, [1, 2, 3, 4]);
      assert.deepEqual(copie.retenu.participants, [1, 2, 3, 4]);
      assert.deepEqual(copie.retenu.placement[0].reserve, [2, 3]);
      assert.deepEqual(copie.propositions[0].placement[1].reserve, [3, 4]);
    }
  });

  test('tables et propositions se trient par identifiant', () => {
    const charge = chargeContrat();
    charge.tables.reverse();
    const [premiere] = charge.propositions;
    charge.propositions = [{ ...premiere, id: 3 }, premiere, { ...premiere, id: 2 }];
    const copie = canoniser(charge);
    assert.deepEqual(copie.tables.map((table) => table.id), [1, 2]);
    assert.deepEqual(copie.propositions.map((proposition) => proposition.id), [1, 2, 3]);
  });

  test("des propositions de même identifiant se rangent par graine, arrêt, historique, puis texte canonique : ni l'ordre reçu ni l'écriture de chacune n'y entrent", () => {
    // L'analyse n'examine pas les propositions : elle admet deux
    // propositions de même identifiant. Les voici dans leur ordre canonique,
    // chacune ne différant de la précédente que par ce qui les départage.
    // Chaque clé numérique oppose 9 à 10, que l'ordre des textes rangerait à
    // l'inverse. Les trois égales sur ces clés ne diffèrent que par leur
    // placement : seul le texte canonique les départage. Une proposition 2
    // de graine 1 les suit toutes.
    const [premiere] = chargeContrat().propositions;
    const [tourA, tourB] = premiere.placement;
    const egales = [
      [tourA, tourB],
      [tourB, tourA],
      [
        { sieges: [[2, 3], [1, 4]], reserve: [] },
        { sieges: [[2, 4], [1, 3]], reserve: [] },
      ],
    ].map((placement) => ({ ...premiere, graine: 10, arret: 10, historique: 10, placement }));
    const rangees = [
      { ...premiere, graine: 9 },
      { ...premiere, graine: 10, arret: 9 },
      { ...premiere, graine: 10, arret: 10, historique: 9 },
      ...egales,
      { ...premiere, id: 2, graine: 1 },
    ];
    // Deux écritures qui changent le JSON d'une proposition sans changer sa
    // copie canonique : ses clés à rebours ; ou ses participants, ses
    // réserves et, à sièges non attribués, ses listes de table à rebours.
    const listesARebours = (proposition) => ({
      ...proposition,
      participants: [...proposition.participants].reverse(),
      placement: proposition.placement.map(({ sieges, reserve }) => ({
        sieges: sieges.map((liste) => [...liste].reverse()),
        reserve: [...reserve].reverse(),
      })),
    });
    const avec = (propositions) => {
      const charge = chargeContrat();
      charge.propositions = propositions;
      charge.prochainsIds.proposition = 3;
      return charge;
    };
    const parTexte = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    const texte = serialiser(avec(rangees), ENTETE);
    for (const ecrire of [aRebours, listesARebours]) {
      for (const parite of [0, 1]) {
        // Une proposition sur deux change d'écriture, selon la parité de son
        // rang canonique.
        const ecrites = rangees.map((proposition, rang) => (rang % 2 === parite ? ecrire(proposition) : proposition));
        const cas = `${ecrire.name}, parité ${parite}`;
        // L'épreuve n'a d'objet que si le JSON des propositions égales, telles
        // qu'écrites, les rangerait autrement que leur texte canonique.
        const brutes = egales.map((proposition) => JSON.stringify(ecrites[rangees.indexOf(proposition)]));
        assert.notDeepEqual([...brutes].sort(parTexte), brutes, cas);
        for (const ordre of [[6, 5, 4, 3, 2, 1, 0], [2, 6, 0, 5, 3, 1, 4], [1, 0, 3, 2, 5, 4, 6]]) {
          const recues = ordre.map((rang) => ecrites[rang]);
          assert.deepEqual(canoniser(avec(recues)).propositions, rangees, `${cas}, ordre reçu ${ordre}`);
          assert.equal(serialiser(avec(recues), ENTETE), texte, `${cas}, ordre reçu ${ordre}`);
          // Le même désordre dans un texte que l'analyse admet se réécrit pareil.
          const fichier = JSON.parse(texte);
          fichier.charge.propositions = recues;
          const relue = analyser(JSON.stringify(fichier)).charge;
          assert.equal(serialiser(relue, ENTETE), texte, `texte lu, ${cas}, ordre ${ordre}`);
        }
      }
    }
  });

  test('réservations triées par participant, table, portée — tous avant tour —, tour puis siège, null en tête', () => {
    const reservation = (participant, table, portee, tour, siege) => ({ participant, table, siege, portee, tour });
    const attendues = [
      reservation(1, 1, 'tous', null, null),
      reservation(1, 1, 'tous', null, 2),
      reservation(1, 1, 'tour', 1, null),
      reservation(1, 1, 'tour', 1, 1),
      reservation(1, 1, 'tour', 1, 2),
      reservation(1, 1, 'tour', 2, null),
      reservation(1, 2, 'tour', 1, null),
      reservation(2, 1, 'tour', 2, null),
    ];
    const charge = chargeContrat();
    // Chaque réservation arrive après celle qui la suit : seul le tri les
    // remet en ordre.
    charge.reservations = [...attendues].reverse();
    assert.deepEqual(canoniser(charge).reservations, attendues);
  });

  test('titres triés par table puis siège, et par libellé à égalité', () => {
    const titre = (table, siege, libelle) => ({ table, siege, libelle });
    const charge = chargeContrat();
    charge.titres = [titre(2, 1, 'b'), titre(1, 3, 'a'), titre(1, 1, 'z'), titre(1, 1, 'm')];
    assert.deepEqual(canoniser(charge).titres, [titre(1, 1, 'm'), titre(1, 1, 'z'), titre(1, 3, 'a'), titre(2, 1, 'b')]);
  });

  test("deux textes se départagent unité UTF-16 par unité, ni selon la langue ni sans égard à la casse : libellés d'une même place, puis propositions qui ne diffèrent que par leur version", () => {
    // Les capitales (0x41, 0x43) précèdent les minuscules, et é (0xE9) suit
    // f (0x66) ; l'ordre de la langue rangerait a, A, b, C, é, f, et un
    // ordre sans casse laisserait l'ordre reçu départager a et A.
    const libelles = ['b', 'C', 'a', 'A', 'f', '\u{e9}'];
    const [premiere] = chargeContrat().propositions;
    for (const ordre of [libelles, [...libelles].reverse()]) {
      const charge = chargeContrat();
      charge.titres = ordre.map((libelle) => ({ table: 1, siege: 1, libelle }));
      assert.deepEqual(canoniser(charge).titres.map(({ libelle }) => libelle), ['A', 'C', 'a', 'b', 'f', '\u{e9}']);
    }
    for (const ordre of [['b', 'C'], ['C', 'b']]) {
      const charge = chargeContrat();
      charge.propositions = ordre.map((produitVersion) => ({ ...premiere, produitVersion }));
      assert.deepEqual(canoniser(charge).propositions.map(({ produitVersion }) => produitVersion), ['C', 'b']);
    }
  });

  test("canoniser, serialiser et serialiserCharge laissent intacte la charge reçue, et la copie s'en détache", () => {
    const desordre = chargeAvecRetenu();
    desordre.participants.reverse();
    desordre.propositions[0].placement[0].sieges = [[3, 1], [4, 2]];
    const charge = geler(aRebours(desordre));
    const avant = JSON.stringify(charge);
    const copie = canoniser(charge);
    serialiser(charge, ENTETE);
    serialiserCharge(charge);
    copie.participants[0].nom = 'Autre';
    copie.propositions[0].placement[0].sieges[0].push(9);
    copie.retenu.placement[0].reserve.push(9);
    assert.equal(JSON.stringify(charge), avant);
  });

  test("les clés de la copie suivent l'ordre du schéma : JSON.stringify de la copie est canonique", () => {
    const attendu = JSON.stringify(JSON.parse(TEXTE_CONTRAT).charge);
    assert.equal(JSON.stringify(canoniser(aRebours(chargeContrat()))), attendu);
  });

  test('une clé du schéma absente lève TypeError au lieu de disparaître du texte', () => {
    const charge = chargeContrat();
    delete charge.participants[2].notes;
    assert.throws(() => serialiser(charge, ENTETE), {
      name: 'TypeError',
      message: /charge\.participants\[2\]\.notes/,
    });
    assert.throws(() => canoniser(charge), { name: 'TypeError', message: /charge\.participants\[2\]\.notes/ });
    const sansDrapeau = chargeContrat();
    delete sansDrapeau.propositions[0].siegesAttribues;
    assert.throws(() => canoniser(sansDrapeau), {
      name: 'TypeError',
      message: /charge\.propositions\[0\]\.siegesAttribues/,
    });
    assert.throws(() => serialiser(chargeContrat(), { produitVersion: VERSION.affichee }), {
      name: 'TypeError',
      message: /entete\.revision/,
    });
  });
});

describe('serialiserCharge : la charge seule (§ 8.8)', () => {
  test("la charge s'écrit dans la mise en page du fichier, sans en-tête, et finit sur une fin de ligne", () => {
    // Les lignes de la charge dans le texte du contrat, un niveau plus haut :
    // l'accolade qui ouvre la clé charge, puis tout jusqu'à celle qui la ferme.
    const lignes = TEXTE_CONTRAT.split('\n');
    assert.equal(lignes[2], '  "charge": {');
    assert.deepEqual(lignes.slice(-3), ['  }', '}', '']);
    const attendu = ['{', ...lignes.slice(3, -3).map((ligne) => ligne.slice(2)), '}', ''].join('\n');
    assert.equal(serialiserCharge(chargeContrat()), attendu);
    assert.equal(serialiserCharge(aRebours(chargeContrat())), attendu);
  });

  test("révision et produitVersion ne changent que la ligne de l'en-tête", () => {
    const autre = versionVoisine(VERSION.affichee);
    const avant = serialiser(chargeContrat(), ENTETE).split('\n');
    const apres = serialiser(chargeContrat(), { revision: 41, produitVersion: autre }).split('\n');
    assert.equal(apres.length, avant.length);
    assert.deepEqual(avant.flatMap((ligne, i) => (ligne === apres[i] ? [] : [i])), [1]);
    assert.equal(
      apres[1],
      `  "entete": {"format":3,"produitVersion":"${autre}","revision":41,"comptes":{"participants":4,"tables":2,"reservations":1,"titres":1,"propositions":1,"retenu":0}},`,
    );
  });
});

describe('aller-retour par analyser (§ 8.9)', () => {
  test("serialiser(analyser(t).charge, en-tête de t) rend t : texte du contrat, retenu, listes vides", () => {
    const textes = [TEXTE_CONTRAT, TEXTE_AVEC_RETENU, TEXTE_SANS_LISTE];
    for (const texte of textes) {
      const { entete, charge } = analyser(texte);
      assert.equal(serialiser(charge, { revision: entete.revision, produitVersion: entete.produitVersion }), texte);
    }
  });

  test("le sérialiseur ne normalise aucune chaîne : un nom en NFD s'écrit tel quel, et le texte relu se réécrit octet pour octet", () => {
    // La conversion en NFC se fait à l'entrée, jamais à l'écriture : un
    // fichier écrit à la main en NFD garde ses octets.
    const nfd = 'Re\u{301}glisse';
    assert.equal(nfd.length, 9);
    assert.notEqual(nfd.normalize('NFC'), nfd);
    const charge = chargeContrat();
    charge.participants[3].nom = nfd;
    const texte = serialiser(charge, ENTETE);
    assert.ok(texte.includes(`"nom":"${nfd}"`));
    const { entete, charge: relue } = analyser(texte);
    assert.equal(relue.participants[3].nom, nfd);
    assert.equal(serialiser(relue, { revision: entete.revision, produitVersion: entete.produitVersion }), texte);
  });
});

describe('un retenu hors de sa règle (§ 8.9, point 3)', () => {
  // Façons d'abîmer le retenu de chargeAvecRetenu, chacune en place : sa
  // règle le refuse, l'analyse, qui n'en lit que le conteneur, l'admet, et
  // examiner le garde en le signalant.
  const FACONS = [
    ['« tours » renommé « toura »', (r) => {
      r.toura = r.tours;
      delete r.tours;
    }],
    ['une clé du schéma retirée', (r) => { delete r.siegesAttribues; }],
    ['un placement objet', (r) => { r.placement = {}; }],
    ['des capacités nombre', (r) => { r.capacites = 2; }],
    ['un tour devenu la liste de ses tables', (r) => { r.placement[0] = r.placement[0].sieges; }],
    ['une clé inconnue', (r) => { r.note = 'à revoir'; }],
    ['une clé inconnue dans un tour', (r) => { r.placement[1].commentaire = 'tour calme'; }],
    ['tours à 0', (r) => { r.tours = 0; }],
    ['une clé « __proto__ »', (r) => {
      Object.defineProperty(r, '__proto__', { value: 'x', enumerable: true, writable: true, configurable: true });
    }],
    ["des clés d'index entier", (r) => {
      r['9'] = 'neuf';
      r['10'] = 'dix';
    }],
    ['un objet vide', (r) => {
      for (const cle of Object.keys(r)) delete r[cle];
    }],
  ];
  const abimee = (facon) => {
    const charge = chargeAvecRetenu();
    facon(charge.retenu);
    return charge;
  };
  const LIGNE_DU_RETENU = '    "retenu": ';

  test("un retenu que sa règle refuse s'écrit compact à la clé retenu, recopié hors du schéma : ses clés rangées par unités UTF-16, ses listes dans l'ordre écrit, ses clés inconnues gardées", () => {
    const charge = abimee(FACONS[0][1]);
    charge.retenu.note = 'à revoir';
    const attendu = remplacer(
      remplacer(TEXTE_CONTRAT, '"retenu":0}}', '"retenu":1}}'),
      '    "retenu": null\n',
      `${LIGNE_DU_RETENU}{"capacites":[2,2],"note":"à revoir","participants":[1,2,3,4],"placement":[{"reserve":[],"sieges":[[3,1],[2,4]]},{"reserve":[],"sieges":[[4,1],[3,2]]}],"proposition":1,"siegesAttribues":false,"tables":[1,2],"toura":2}\n`,
    );
    assert.equal(serialiser(charge, ENTETE), attendu);
    assert.equal(serialiser(aRebours(charge), ENTETE), attendu);
  });

  test("chaque retenu que sa règle refuse et que l'analyse admet s'écrit, se relit au même retenu et se réécrit octet pour octet, quel que soit l'ordre de ses clés ; canoniser en rend une copie détachée, qui ne partage aucun objet ni aucune liste avec lui", () => {
    assert.ok(FACONS.length > 0, 'aucune façon examinée');
    const ecarts = FACONS.flatMap(([libelle, facon]) => {
      const charge = abimee(facon);
      try {
        const texte = serialiser(charge, ENTETE);
        const ligne = texte.split('\n').find((candidate) => candidate.startsWith(LIGNE_DU_RETENU));
        assert.deepEqual(JSON.parse(ligne.slice(LIGNE_DU_RETENU.length)), charge.retenu);
        const { entete, charge: relue } = analyser(texte);
        assert.deepEqual(relue.retenu, charge.retenu);
        assert.equal(serialiser(relue, { revision: entete.revision, produitVersion: entete.produitVersion }), texte);
        assert.equal(serialiser(aRebours(charge), ENTETE), texte);
        assert.equal(serialiserCharge(charge), serialiserCharge(relue));
        const avant = JSON.stringify(charge.retenu);
        const source = geler(structuredClone(charge));
        const copie = canoniser(source).retenu;
        assert.deepEqual(copie, charge.retenu);
        const recus = objetsDe(source.retenu);
        assert.deepEqual([...objetsDe(copie)].filter((objet) => recus.has(objet)), []);
        assert.equal(JSON.stringify(canoniser(charge).retenu), JSON.stringify(copie));
        assert.equal(JSON.stringify(charge.retenu), avant);
        return [];
      } catch (erreur) {
        return [`${libelle} : ${erreur.name} ${erreur.message.split('\n')[0]}`];
      }
    });
    assert.deepEqual(ecarts, []);
  });

  test("un retenu que sa règle admet mais qui se contredit — cinq tours déclarés, deux écrits — suit la mise en page d'une proposition : seul un retenu que sa règle refuse s'écrit compact", () => {
    const charge = chargeAvecRetenu();
    charge.retenu.tours = 5;
    const ligne = '"retenu": {"proposition":1,"siegesAttribues":false,"tables":[1,2],"capacites":[2,2],"tours":';
    const attendu = remplacer(TEXTE_AVEC_RETENU, `${ligne}2,`, `${ligne}5,`);
    assert.equal(serialiser(charge, ENTETE), attendu);
    assert.equal(serialiser(aRebours(charge), ENTETE), attendu);
    const { entete, charge: relue } = analyser(attendu);
    assert.equal(serialiser(relue, { revision: entete.revision, produitVersion: entete.produitVersion }), attendu);
  });

  test("un retenu qui n'est pas un objet, que l'analyse refuse, lève TypeError : aucun texte qu'elle refuserait ne s'écrit", () => {
    for (const retenu of [[], 42, 'retenu', false]) {
      const charge = chargeContrat();
      charge.retenu = retenu;
      assert.throws(() => serialiser(charge, ENTETE), TypeError, JSON.stringify(retenu));
      assert.throws(() => canoniser(charge), TypeError, JSON.stringify(retenu));
    }
  });
});

describe('déterminisme (§ 8.8, § 14.7)', () => {
  test("serialiser, serialiserCharge et canoniser ne lisent ni horloge ni aléa : leur sortie ne dépend que de leurs arguments", () => {
    // Le filet est éprouvé d'abord : chaque source lève pendant qu'il est tendu.
    for (const lecture of [
      () => Math.random(),
      () => Date.now(),
      () => new Date(),
      () => performance.now(),
      () => crypto.getRandomValues(new Uint8Array(1)),
      () => crypto.randomUUID(),
    ]) {
      assert.throws(() => sansHorlogeNiAlea(lecture), / lu$/);
    }
    assert.equal(typeof Date.now(), 'number');
    const rendre = () => {
      const charge = chargeAvecRetenu();
      return [serialiser(charge, ENTETE), serialiserCharge(charge), JSON.stringify(canoniser(charge))];
    };
    assert.deepEqual(sansHorlogeNiAlea(rendre), rendre());
  });
});

describe('les champs facultatifs (§ 8.9, A16)', () => {
  // La charge du contrat, chaque champ facultatif posé hors de son défaut,
  // ses listes à rebours de l'ordre canonique, et le texte qui l'écrit.
  function chargeFormat2() {
    const charge = chargeContrat();
    charge.reglages.rencontrerAnimateurs = true;
    charge.reglages.modeObjectifs = 'chacun';
    charge.reglages.respecterObjectifs = false;
    charge.reglages.regleObjectifs = 'et';
    charge.participants[0].etiquettes = ['finance', 'bénévole', 'Montréal'];
    charge.tables[1].objectifs = [
      { portee: 'tour', tour: 2, regle: 'ou', etiquettes: ['ressources humaines', 'finance'] },
      { portee: 'tour', tour: 1, regle: null, etiquettes: ['bénévole'] },
      { portee: 'tous', tour: null, regle: null, etiquettes: ['Montréal'] },
    ];
    return charge;
  }
  const TEXTE_FORMAT_2 = remplacer(
    remplacer(
      remplacer(
        TEXTE_CONTRAT,
        '"generation":{"nombre":5,"arret":200000,"historique":1000}}',
        '"generation":{"nombre":5,"arret":200000,"historique":1000},"regleObjectifs":"et","respecterObjectifs":false,"modeObjectifs":"chacun","rencontrerAnimateurs":true}',
      ),
      '"notes":null,"exclu":false},\n      {"id":2',
      '"notes":null,"exclu":false,"etiquettes":["Montréal","bénévole","finance"]},\n      {"id":2',
    ),
    '"position":{"x":250,"y":0}}',
    '"position":{"x":250,"y":0},"objectifs":[{"portee":"tous","tour":null,"regle":null,"etiquettes":["Montréal"]},{"portee":"tour","tour":1,"regle":null,"etiquettes":["bénévole"]},{"portee":"tour","tour":2,"regle":"ou","etiquettes":["finance","ressources humaines"]}]}',
  );

  test('chacun s’écrit après les clés toujours présentes de son objet, les réglages dans l’ordre de A16, les étiquettes par unités de code, les objectifs la soirée puis les tours', () => {
    assert.equal(serialiser(chargeFormat2(), ENTETE), TEXTE_FORMAT_2);
    assert.equal(serialiser(aRebours(chargeFormat2()), ENTETE), TEXTE_FORMAT_2);
    const lu = analyser(TEXTE_FORMAT_2);
    assert.equal(serialiser(lu.charge, lu.entete), TEXTE_FORMAT_2);
  });

  test('absents, ils ne s’écrivent pas : la charge sans eux rend le texte du contrat', () => {
    const charge = chargeFormat2();
    for (const cle of ['regleObjectifs', 'respecterObjectifs', 'modeObjectifs', 'rencontrerAnimateurs']) {
      delete charge.reglages[cle];
    }
    delete charge.participants[0].etiquettes;
    delete charge.tables[1].objectifs;
    assert.equal(serialiser(charge, ENTETE), TEXTE_CONTRAT);
  });

  test('la cible de redondance, un ancien réglage qu’une charge porte encore, ne se copie ni ne s’écrit', () => {
    const charge = chargeFormat2();
    charge.reglages = { cibleRedondance: 800, ...charge.reglages };
    assert.equal(Object.hasOwn(canoniser(charge).reglages, 'cibleRedondance'), false);
    assert.equal(serialiser(charge, ENTETE), TEXTE_FORMAT_2);
    assert.equal(serialiserCharge(charge), serialiserCharge(chargeFormat2()));
  });

  test('l’ordre des étiquettes est celui des unités de code : une lettre hors du plan de base passe avant U+FF21, une majuscule avant une minuscule', () => {
    const charge = chargeContrat();
    charge.participants[1].etiquettes = ['\u{FF21}', 'été', 'Été', '\u{1D538}', 'zèbre'];
    // Par points de code, U+FF21 passerait avant U+1D538 ; ses deux unités
    // commencent par 0xD835, plus petite que 0xFF21.
    assert.deepEqual(canoniser(charge).participants[1].etiquettes, ['zèbre', 'Été', 'été', '\u{1D538}', '\u{FF21}']);
  });

  test('deux objectifs d’une même portée et d’un même tour, que l’analyse refuse, s’écrivent pareil quel que soit l’ordre reçu : l’ordre reste total', () => {
    const doubles = [
      { portee: 'tous', tour: null, regle: 'et', etiquettes: ['finance'] },
      { portee: 'tous', tour: null, regle: null, etiquettes: ['bénévole'] },
    ];
    const une = chargeContrat();
    une.tables[0].objectifs = structuredClone(doubles);
    const autre = chargeContrat();
    autre.tables[0].objectifs = structuredClone(doubles).reverse();
    assert.equal(serialiser(une, ENTETE), serialiser(autre, ENTETE));
    // Deux objectifs identiques s'écrivent deux fois, à l'identique.
    une.tables[0].objectifs = [structuredClone(doubles[0]), structuredClone(doubles[0])];
    assert.deepEqual(canoniser(une).tables[0].objectifs, [doubles[0], doubles[0]]);
  });

  test('la copie canonique ne partage aucune liste d’étiquettes ni aucun objectif avec la charge reçue, qui reste intacte', () => {
    const charge = geler(chargeFormat2());
    const copie = canoniser(charge);
    const recus = objetsDe(charge);
    for (const objet of objetsDe(copie)) assert.ok(!recus.has(objet));
    assert.deepEqual(charge.participants[0].etiquettes, ['finance', 'bénévole', 'Montréal']);
  });
});

describe('la dérivation : depart et toursFiges dans le texte canonique (§ 8.9, C11, D74)', () => {
  // La charge du contrat, sa proposition 1 suivie d'une proposition 3
  // dérivée de la 1, de même plan, derivation posant ses champs.
  function avecDerivee(derivation) {
    const charge = chargeContrat();
    charge.prochainsIds.proposition = 4;
    charge.propositions.push({ ...structuredClone(charge.propositions[0]), id: 3, ...derivation });
    return charge;
  }
  const LIGNE_1 = `{"id":1,"graine":48271,"arret":200000,"historique":1000,"produitVersion":"${VERSION.affichee}",`;
  const ligneDerivee = (champs) => `{"id":3,"graine":48271,"arret":200000,"historique":1000,${champs}"produitVersion":"${VERSION.affichee}",`;

  test('une dérivée écrit depart puis toursFiges juste après historique, sans tour figé depart seul ; le texte se relit et se réécrit à l’identique', () => {
    const cas = [
      [{ depart: 1, toursFiges: [1] }, '"depart":1,"toursFiges":[1],'],
      [{ toursFiges: [2], depart: 1 }, '"depart":1,"toursFiges":[2],'],
      [{ depart: 1 }, '"depart":1,'],
    ];
    for (const [derivation, champs] of cas) {
      const texte = serialiser(avecDerivee(derivation), ENTETE);
      assert.ok(texte.includes(`\n      ${LIGNE_1}`), texte);
      assert.ok(texte.includes(`\n      ${ligneDerivee(champs)}`), texte);
      assert.equal(texte.split('"depart"').length, 2, texte);
      const lu = analyser(texte);
      assert.equal(serialiser(lu.charge, lu.entete), texte);
      assert.deepEqual(canoniser(lu.charge), canoniser(avecDerivee(derivation)));
    }
  });

  test('les tours figés s’écrivent dans l’ordre reçu, sans tri : une liste désordonnée est une faute, que le texte ne corrige pas', () => {
    const texte = serialiser(avecDerivee({ depart: 1, toursFiges: [2, 1] }), ENTETE);
    assert.ok(texte.includes('"depart":1,"toursFiges":[2,1],'), texte);
  });

  test('sans dérivation, la charge du contrat s’écrit octet pour octet comme son texte', () => {
    const charge = avecDerivee({ depart: 1, toursFiges: [1] });
    charge.propositions.pop();
    assert.equal(serialiser(charge, ENTETE), TEXTE_CONTRAT.replace('"proposition":2}', '"proposition":4}'));
  });
});

describe('la présence par tour dans le texte canonique (§ 8.9)', () => {
  // La charge témoin : retenu daté, étiquettes, objectif, mode des objectifs,
  // une dérivée à sièges attribués avec une chaise vide et une réserve ;
  // aucune présence, aucun absent.
  function chargeTemoin() {
    const charge = chargeAvecRetenu();
    charge.participants[0].etiquettes = ['finance', 'Montréal'];
    charge.tables[1].objectifs = [{ portee: 'tour', tour: 2, regle: 'et', etiquettes: ['finance'] }];
    charge.reglages.modeObjectifs = 'chacun';
    charge.prochainsIds.proposition = 4;
    charge.propositions.push({
      ...structuredClone(charge.propositions[0]),
      id: 3,
      depart: 1,
      toursFiges: [1],
      siegesAttribues: true,
      placement: [
        { sieges: [[1, 3], [2, 4]], reserve: [] },
        { sieges: [[null, 4], [2, 3]], reserve: [1] },
      ],
    });
    charge.retenu.horodatage = '2031-05-17T08:05:00-04:00';
    return charge;
  }

  // Empreinte FNV-1a sur 32 bits des unités UTF-16 du texte, et sa longueur.
  function empreinte(texte) {
    let valeur = 0x811c9dc5;
    for (let rang = 0; rang < texte.length; rang += 1) {
      valeur ^= texte.charCodeAt(rang);
      valeur = Math.imul(valeur, 0x01000193) >>> 0;
    }
    return { longueur: texte.length, valeur };
  }

  // La charge du contrat où la personne 3 n'arrive qu'au tour 2 : absente au
  // tour 1 de la proposition, la table 1 y garde une chaise libre.
  function chargeAbsente() {
    const charge = chargeContrat();
    charge.participants[2].presence = [2];
    charge.propositions[0].placement[0] = { sieges: [[1], [2, 4]], reserve: [], absents: [3] };
    return charge;
  }

  test('une charge sans absence garde ses octets : empreinte figée du texte de la charge témoin', () => {
    assert.deepEqual(empreinte(serialiserCharge(chargeTemoin())), { longueur: 2427, valeur: 1810167972 });
  });

  test('presence s’écrit après etiquettes, absents après reserve ; chacun omis quand il manque', () => {
    const texte = serialiser(chargeAbsente(), ENTETE);
    assert.ok(texte.includes('"notes":"arrive tard","exclu":false,"presence":[2]}'), texte);
    assert.ok(texte.includes('\n        {"sieges":[[1],[2,4]],"reserve":[],"absents":[3]},\n'), texte);
    assert.ok(texte.includes('\n        {"sieges":[[1,4],[2,3]],"reserve":[]}\n'), texte);
    assert.equal(texte.split('"presence"').length, 2, texte);
    assert.equal(texte.split('"absents"').length, 2, texte);
    const avecEtiquettes = chargeAbsente();
    avecEtiquettes.participants[2].etiquettes = ['finance'];
    assert.ok(serialiser(avecEtiquettes, ENTETE).includes('"exclu":false,"etiquettes":["finance"],"presence":[2]}'));
    const lu = analyser(texte);
    assert.equal(serialiser(lu.charge, lu.entete), texte);
  });

  test('canonicité : presence et absents reçus dans un autre ordre, clés à rebours, rendent le même texte', () => {
    const rangee = chargeAbsente();
    rangee.evenement.tours = 3;
    rangee.participants[2].presence = [2, 3];
    rangee.participants[3].presence = [2];
    rangee.propositions[0].placement[0] = { sieges: [[1], [2]], reserve: [], absents: [3, 4] };
    const attendu = serialiser(rangee, ENTETE);
    assert.ok(attendu.includes('"exclu":false,"presence":[2,3]}'), attendu);
    assert.ok(attendu.includes('{"sieges":[[1],[2]],"reserve":[],"absents":[3,4]}'), attendu);
    const desordre = structuredClone(rangee);
    desordre.participants[2].presence = [3, 2];
    desordre.propositions[0].placement[0].absents = [4, 3];
    assert.equal(serialiser(aRebours(desordre), ENTETE), attendu);
  });

  test('sous des sièges attribués, les listes de table gardent leur ordre et absents se trie : c’est un ensemble', () => {
    const charge = chargeAbsente();
    charge.propositions[0].siegesAttribues = true;
    charge.propositions[0].placement[0] = { sieges: [[null, 1], [4]], reserve: [], absents: [3, 2] };
    const texte = serialiser(charge, ENTETE);
    assert.ok(texte.includes('{"sieges":[[null,1],[4]],"reserve":[],"absents":[2,3]}'), texte);
    charge.propositions[0].siegesAttribues = false;
    charge.propositions[0].placement[0] = { sieges: [[4, 1], []], reserve: [], absents: [3, 2] };
    assert.ok(serialiser(charge, ENTETE).includes('{"sieges":[[1,4],[]],"reserve":[],"absents":[2,3]}'));
  });

  test('la copie canonique ne partage ni la présence ni les absents avec la charge reçue, qui reste intacte', () => {
    const charge = geler(chargeAbsente());
    const copie = canoniser(charge);
    const recus = objetsDe(charge);
    for (const objet of objetsDe(copie)) assert.ok(!recus.has(objet));
    assert.deepEqual(copie.participants[2].presence, [2]);
    assert.deepEqual(copie.propositions[0].placement[0].absents, [3]);
  });
});

describe('la copie canonique partagée : propositions figées et textes en cache (§ 8.8, § 8.9)', () => {
  // Propositions inventées pour charge, en place : nombre plans répartissant
  // les participants non exclus sur les tables, d'un pas qui change à chaque
  // tour ; une table pleine renvoie à la réserve. Les listes de table, la
  // réserve et les participants s'écrivent à rebours, que la copie canonique
  // range ; une proposition sur deux a ses sièges attribués, et les
  // identifiants décroissent, que le tri des propositions renverse.
  function avecPropositions(charge, nombre) {
    const tables = charge.tables.map(({ id }) => id);
    const capacites = charge.tables.map(({ sieges }) => sieges ?? charge.evenement.siegesParDefaut);
    const presents = charge.participants.filter(({ exclu }) => !exclu).map(({ id }) => id);
    const { tours } = charge.evenement;
    charge.propositions = Array.from({ length: nombre }, (_, rang) => ({
      id: nombre - rang,
      graine: 7_001 + rang,
      arret: 200_000,
      historique: 1_000,
      produitVersion: VERSION.affichee,
      siegesAttribues: rang % 2 === 1,
      tables: [...tables],
      capacites: [...capacites],
      tours,
      participants: [...presents].reverse(),
      placement: Array.from({ length: tours }, (__, tour) => {
        const sieges = tables.map(() => []);
        const reserve = [];
        presents.forEach((id, place) => {
          const table = (place * (tour + 1) + rang) % tables.length;
          if (sieges[table].length < capacites[table]) sieges[table].unshift(id);
          else reserve.unshift(id);
        });
        return { sieges, reserve };
      }),
    }));
    charge.prochainsIds.proposition = nombre + 1;
    return charge;
  }

  // La charge du contrat et quatre propositions de plus : une à sièges
  // attribués avec une chaise vide, une dérivée datée avec un absent, et deux
  // de même identité que seul leur texte départage (produitVersion).
  function chargeVariee() {
    const charge = chargeAvecRetenu();
    const premiere = charge.propositions[0];
    charge.propositions.push(
      {
        ...structuredClone(premiere),
        id: 2,
        siegesAttribues: true,
        placement: [
          { sieges: [[null, 3], [4, 2]], reserve: [1] },
          { sieges: [[4, 1], [3, 2]], reserve: [] },
        ],
      },
      {
        ...structuredClone(premiere),
        id: 3,
        depart: 1,
        toursFiges: [1],
        horodatage: '2031-05-17T08:05:00-04:00',
        placement: [
          { sieges: [[3, 1], [4]], reserve: [], absents: [2] },
          { sieges: [[4, 1], [3, 2]], reserve: [] },
        ],
      },
      { ...structuredClone(premiere), id: 4, produitVersion: 'b' },
      { ...structuredClone(premiere), id: 4, produitVersion: 'C' },
    );
    charge.prochainsIds.proposition = 5;
    return charge;
  }

  // Les charges que chaque épreuve parcourt, chacune neuve à chaque appel :
  // le contrat, les variantes du format — ordres renversés, clés à rebours,
  // retenu hors de sa règle, champs facultatifs —, et deux démonstrations
  // livrées munies de propositions.
  const CHARGES = [
    ['le contrat', chargeContrat],
    ['le contrat et son retenu', chargeAvecRetenu],
    ['des propositions variées', chargeVariee],
    ['des propositions variées, à rebours', () => {
      const charge = chargeVariee();
      charge.propositions.reverse();
      charge.participants.reverse();
      return aRebours(charge);
    }],
    ['un retenu hors de sa règle', () => {
      const charge = chargeVariee();
      charge.retenu.note = 'à revoir';
      return charge;
    }],
    ['une démonstration livrée, grande', () => avecPropositions(analyser(texteLivre('grande')).charge, 6)],
    ['une démonstration livrée, petite', () => avecPropositions(analyser(texteLivre('petite-conflit')).charge, 3)],
  ];

  // Texte de référence de charge, par la copie neuve de canoniser :
  // serialiserCanonique ne lit que la copie qu'on lui donne.
  const reference = (charge) => serialiserCanonique(canoniser(charge), ENTETE);

  // Exécute fonction en comptant les appels à JSON.stringify, puis le
  // rétablit ; rend le compte.
  function appelsAStringify(fonction) {
    const reel = JSON.stringify;
    let appels = 0;
    JSON.stringify = (...arguments_) => {
      appels += 1;
      return reel(...arguments_);
    };
    try {
      fonction();
    } finally {
      JSON.stringify = reel;
    }
    return appels;
  }

  test('E1 — serialiser, serialiserCharge et canoniserPartagee rendent sur une charge figée, cache froid puis chaud, ce qu\'ils rendent sur sa copie libre', () => {
    const ecarts = CHARGES.flatMap(([libelle, construire]) => {
      const figee = gelerPropositions(construire());
      const libre = structuredClone(figee);
      assert.ok(figee.propositions.every(estFigee) && !libre.propositions.some(estFigee), libelle);
      const attendu = reference(construire());
      // La charge seule : les lignes de la clé charge, un niveau plus haut.
      const lignes = attendu.slice(0, -1).split('\n').slice(2, -1);
      assert.equal(lignes[0], '  "charge": {', libelle);
      const attenduCharge = `{\n${lignes.slice(1).map((ligne) => ligne.slice(2)).join('\n')}\n`;
      return [1, 2].flatMap((passe) => {
        const ecartsDeLaPasse = [];
        const comparer = (nom, obtenu, voulu) => {
          if (obtenu !== voulu) ecartsDeLaPasse.push(`${libelle}, passe ${passe} : ${nom}`);
        };
        comparer('serialiser figée', serialiser(figee, ENTETE), attendu);
        comparer('serialiserCharge figée', serialiserCharge(figee), attenduCharge);
        comparer('serialiser libre', serialiser(libre, ENTETE), attendu);
        comparer('serialiserCharge libre', serialiserCharge(libre), attenduCharge);
        comparer('canoniserPartagee', JSON.stringify(canoniserPartagee(figee)), JSON.stringify(canoniser(libre)));
        comparer('serialiserCanonique', serialiserCanonique(canoniserPartagee(figee), ENTETE), attendu);
        return ecartsDeLaPasse;
      });
    });
    assert.deepEqual(ecarts, []);
  });

  test('E1 — figées, la charge du contrat et celle de son retenu rendent le texte du contrat octet pour octet', () => {
    for (const passe of [1, 2]) {
      assert.equal(serialiser(gelerPropositions(chargeContrat()), ENTETE), TEXTE_CONTRAT, `passe ${passe}`);
      const avecRetenu = gelerPropositions(chargeAvecRetenu());
      assert.equal(serialiser(avecRetenu, ENTETE), TEXTE_AVEC_RETENU, `passe ${passe}`);
      assert.equal(serialiser(avecRetenu, ENTETE), TEXTE_AVEC_RETENU, `passe ${passe}, cache chaud`);
    }
  });

  test('E1 — une même proposition figée, en tête ou en queue, sous un autre réglage attribuerSieges, prête la même copie et le même texte', () => {
    const proposition = figer(chargeVariee().propositions[1]);
    const seule = chargeContrat();
    seule.propositions = [proposition];
    const ailleurs = chargeVariee();
    ailleurs.reglages.attribuerSieges = true;
    ailleurs.propositions[1] = proposition;
    const copie = canoniserPartagee(seule).propositions[0];
    assert.equal(canoniserPartagee(ailleurs).propositions.find(({ id }) => id === 2), copie);
    for (const charge of [seule, ailleurs]) {
      assert.equal(serialiser(charge, ENTETE), reference(structuredClone(charge)));
      assert.equal(serialiserCharge(charge), serialiserCharge(structuredClone(charge)));
    }
  });

  test('canoniserPartagee prête, pour chaque proposition figée, une copie canonique figée et inscrite, toujours la même ; tout le reste est neuf et modifiable', () => {
    const figee = gelerPropositions(chargeVariee());
    const avant = JSON.stringify(figee);
    const une = canoniserPartagee(figee);
    const autre = canoniserPartagee(figee);
    assert.equal(une.propositions.length, 5);
    une.propositions.forEach((copie, rang) => {
      assert.equal(autre.propositions[rang], copie, `rang ${rang}`);
      assert.ok(estFigee(copie) && Object.isFrozen(copie.placement[0].sieges), `rang ${rang}`);
      assert.ok(!figee.propositions.includes(copie), `rang ${rang}`);
    });
    assert.throws(() => une.propositions[0].placement[0].reserve.push(9), TypeError);
    assert.notEqual(une.propositions, autre.propositions);
    const partagees = new Set(une.propositions.flatMap((copie) => [...objetsDe(copie)]));
    const recus = objetsDe(figee);
    for (const objet of objetsDe(une)) {
      if (partagees.has(objet)) continue;
      assert.ok(!recus.has(objet) && !objetsDe(autre).has(objet) && !Object.isFrozen(objet));
    }
    une.participants[0].nom = 'Autre';
    une.retenu.placement[0].reserve.push(9);
    une.propositions.pop();
    assert.equal(JSON.stringify(figee), avant);
    assert.equal(JSON.stringify(canoniserPartagee(figee)), JSON.stringify(canoniser(figee)));
  });

  test('une copie canonique partagée est sa propre copie : canoniserPartagee la rend telle quelle', () => {
    const une = canoniserPartagee(gelerPropositions(chargeVariee()));
    const encore = canoniserPartagee(une);
    une.propositions.forEach((copie, rang) => assert.equal(encore.propositions[rang], copie, `rang ${rang}`));
    assert.equal(serialiserCanonique(encore, ENTETE), reference(chargeVariee()));
  });

  test('une proposition libre, ou gelée par Object.freeze seul, ne prête rien : sa copie est neuve à chaque appel, ni gelée ni inscrite', () => {
    const charge = chargeVariee();
    figer(charge.propositions[0]);
    Object.freeze(charge.propositions[2]);
    const une = canoniserPartagee(charge);
    const autre = canoniserPartagee(charge);
    const parId = (copie, id, graine = 48_271) => copie.propositions.find((p) => p.id === id && p.graine === graine);
    assert.equal(parId(une, 1), parId(autre, 1));
    for (const id of [2, 3]) {
      assert.notEqual(parId(une, id), parId(autre, id), `proposition ${id}`);
      assert.ok(!estFigee(parId(une, id)) && !Object.isFrozen(parId(une, id)), `proposition ${id}`);
    }
  });

  test('le texte d\'une proposition figée se rend une fois par retrait : cache chaud, serialiser et serialiserCharge ne la relisent plus', () => {
    const figee = gelerPropositions(avecPropositions(analyser(texteLivre('petite')).charge, 4));
    const sans = { ...figee, propositions: [] };
    serialiser(figee, ENTETE);
    serialiserCharge(figee);
    assert.equal(appelsAStringify(() => serialiserCharge(figee)), appelsAStringify(() => serialiserCharge(sans)));
    assert.equal(appelsAStringify(() => serialiser(figee, ENTETE)), appelsAStringify(() => serialiser(sans, ENTETE)));
    const libre = structuredClone(figee);
    assert.ok(appelsAStringify(() => serialiserCharge(libre)) > appelsAStringify(() => serialiserCharge(sans)));
  });

  test('E2 — une proposition remplacée par un objet neuf de même identifiant change le texte', () => {
    const figee = gelerPropositions(chargeContrat());
    assert.equal(serialiserCharge(figee), serialiserCharge(chargeContrat()));
    assert.equal(serialiser(figee, ENTETE), TEXTE_CONTRAT);
    const neuve = structuredClone(figee.propositions[0]);
    neuve.placement[0].sieges = [[1, 2], [3, 4]];
    figee.propositions[0] = figer(neuve);
    const attendu = remplacer(TEXTE_CONTRAT, '{"sieges":[[1,3],[2,4]]', '{"sieges":[[1,2],[3,4]]');
    assert.equal(serialiser(figee, ENTETE), attendu);
    assert.equal(serialiserCharge(figee), serialiserCharge(structuredClone(figee)));
    assert.notEqual(serialiserCharge(figee), serialiserCharge(chargeContrat()));
  });

  test('E2 — une charge libre, ou une proposition gelée en surface seulement, modifiée en place entre deux écritures, n\'est jamais servie du cache', () => {
    const libre = chargeContrat();
    const surface = chargeContrat();
    Object.freeze(surface.propositions[0]);
    const attendu = remplacer(TEXTE_CONTRAT, '{"sieges":[[1,3],[2,4]]', '{"sieges":[[1,2],[3,4]]');
    for (const charge of [libre, surface]) {
      for (const passe of [1, 2]) {
        assert.equal(serialiserCharge(charge), serialiserCharge(chargeContrat()), `passe ${passe}`);
        assert.equal(serialiser(charge, ENTETE), TEXTE_CONTRAT, `passe ${passe}`);
        canoniserPartagee(charge);
      }
      const sieges = charge.propositions[0].placement[0].sieges;
      sieges[0][1] = 2;
      sieges[1][0] = 3;
      assert.equal(serialiser(charge, ENTETE), attendu);
      assert.equal(serialiserCharge(charge), serialiserCharge(structuredClone(charge)));
      assert.equal(JSON.stringify(canoniserPartagee(charge)), JSON.stringify(canoniser(structuredClone(charge))));
    }
  });

  test('E2 — serialiserCanonique, rendu deux fois sur le même objet modifié en place entre les deux, ne sert jamais le premier texte : une proposition libre tirée de canoniserPartagee, ou gelée en surface par Object.freeze seul', () => {
    // Chaque cas rend la même copie deux fois, au retrait où serialiser
    // écrit une proposition : seule la garde du cache de texte la distingue
    // d'une copie canonique partagée.
    const tireeDuPartage = canoniserPartagee(chargeContrat());
    const enSurface = chargeContrat();
    Object.freeze(enSurface.propositions[0]);
    for (const [libelle, copie] of [['tirée de canoniserPartagee', tireeDuPartage], ['gelée en surface', enSurface]]) {
      const premier = serialiserCanonique(copie, ENTETE);
      assert.equal(premier, TEXTE_CONTRAT, libelle);
      const sieges = copie.propositions[0].placement[0].sieges;
      sieges[0][1] = 2;
      sieges[1][0] = 3;
      const second = serialiserCanonique(copie, ENTETE);
      assert.notEqual(second, premier, libelle);
      assert.equal(second, reference(structuredClone(copie)), libelle);
    }
  });

  test('E2 — canoniser rend toujours des objets neufs et non gelés, même quand la copie partagée est en cache', () => {
    const figee = gelerPropositions(chargeVariee());
    const partagee = canoniserPartagee(figee);
    serialiser(figee, ENTETE);
    const une = canoniser(figee);
    const autre = canoniser(figee);
    const dejaVus = new Set([...objetsDe(figee), ...objetsDe(partagee), ...objetsDe(autre)]);
    for (const objet of objetsDe(une)) assert.ok(!dejaVus.has(objet) && !Object.isFrozen(objet) && !estFigee(objet));
    une.propositions[0].placement[0].sieges[0].push(9);
    assert.equal(serialiser(figee, ENTETE), reference(chargeVariee()));
  });

  test('une proposition figée hors de sa règle lève à chaque écriture la TypeError de canoniser, qui nomme son rang', () => {
    const charge = chargeVariee();
    delete charge.propositions[2].siegesAttribues;
    gelerPropositions(charge);
    const attendue = { name: 'TypeError', message: /charge\.propositions\[2\]\.siegesAttribues absente/ };
    for (const passe of [1, 2]) {
      assert.throws(() => canoniser(charge), attendue, `passe ${passe}`);
      assert.throws(() => canoniserPartagee(charge), attendue, `passe ${passe}`);
      assert.throws(() => serialiser(charge, ENTETE), attendue, `passe ${passe}`);
      assert.throws(() => serialiserCharge(charge), attendue, `passe ${passe}`);
    }
    const ailleurs = chargeContrat();
    ailleurs.propositions = [charge.propositions[0], charge.propositions[2]];
    assert.throws(() => serialiser(ailleurs, ENTETE), {
      name: 'TypeError',
      message: /charge\.propositions\[1\]\.siegesAttribues/,
    });
  });

  test("une liste de propositions mal formée — null, un texte, un objet — rend sous canoniserPartagee ce qu'elle rend sous canoniser, copie ou refus", () => {
    // Ce que rend fonction : sa valeur écrite en JSON, ou le nom et le
    // message de ce qu'elle lève.
    const issue = (fonction) => {
      try {
        return { valeur: JSON.stringify(fonction()) };
      } catch (erreur) {
        return { erreur: `${erreur.name}: ${erreur.message}` };
      }
    };
    for (const propositions of [null, 'aucune', {}]) {
      const charge = chargeContrat();
      charge.propositions = propositions;
      const libelle = JSON.stringify(propositions);
      assert.deepEqual(issue(() => canoniserPartagee(charge)), issue(() => canoniser(charge)), libelle);
      assert.deepEqual(issue(() => serialiser(charge, ENTETE)), issue(() => reference(charge)), libelle);
    }
    const nulle = chargeContrat();
    nulle.propositions = null;
    assert.equal(canoniserPartagee(nulle).propositions, null);
  });

  test('serialiser garde ses refus : un en-tête absent lève avant la copie, une révision absente après elle', () => {
    const charge = gelerPropositions(chargeContrat());
    assert.throws(() => serialiser(charge), TypeError);
    delete charge.participants[0].notes;
    assert.throws(
      () => serialiser(charge),
      (erreur) => erreur instanceof TypeError && !/charge\.participants/.test(erreur.message),
    );
    assert.throws(() => serialiser(charge, { produitVersion: VERSION.affichee }), {
      name: 'TypeError',
      message: /charge\.participants\[0\]\.notes/,
    });
    assert.throws(() => serialiserCanonique(canoniser(chargeContrat()), { produitVersion: VERSION.affichee }), {
      name: 'TypeError',
      message: /entete\.revision/,
    });
  });

  test('la copie partagée et son texte ne lisent ni horloge ni aléa, cache froid comme chaud', () => {
    const attendu = reference(chargeVariee());
    const figee = gelerPropositions(chargeVariee());
    for (const passe of [1, 2]) {
      assert.equal(sansHorlogeNiAlea(() => serialiser(figee, ENTETE)), attendu, `passe ${passe}`);
      sansHorlogeNiAlea(() => serialiserCharge(figee));
    }
  });
});

describe('recanoniser : la copie canonique refaite là seulement où des opérations ont touché (§ 8.8)', () => {
  // La charge du contrat et son retenu, à sièges attribués, ses listes de
  // table dans l'ordre des sièges, plus une table munie d'objectifs et une
  // proposition dérivée, datée, à sièges attribués, avec un absent : chaque
  // forme que recanoniser refait y figure. Neuve à chaque appel.
  function chargeDeTravail() {
    const charge = chargeAvecRetenu();
    charge.retenu.siegesAttribues = true;
    charge.tables[1].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['jardin'] }];
    charge.propositions.push({
      ...structuredClone(charge.propositions[0]),
      id: 2,
      depart: 1,
      siegesAttribues: true,
      horodatage: '2031-05-17T08:05:00-04:00',
      placement: [
        { sieges: [[3, 1], [4]], reserve: [2] },
        { sieges: [[4, 1], [3]], reserve: [], absents: [2] },
      ],
    });
    charge.prochainsIds.proposition = 3;
    return charge;
  }

  // Traces vides : ni conteneur sali, ni valeur neuve.
  const tracesVides = () => ({ sales: new Set(), neufs: new Set() });

  // Descend de charge par etapes, clés ou rangs, en inscrivant dans
  // traces.sales charge et chaque conteneur traversé, le dernier compris,
  // comme une opération qui écrit sous ce chemin ; rend le dernier.
  function salir(traces, charge, ...etapes) {
    traces.sales.add(charge);
    return etapes.reduce((conteneur, etape) => {
      traces.sales.add(conteneur[etape]);
      return conteneur[etape];
    }, charge);
  }

  // Inscrit valeur dans traces.neufs, une valeur posée entière ou le
  // porteur d'un drapeau posé, et la rend.
  function neuf(traces, valeur) {
    traces.neufs.add(valeur);
    return valeur;
  }

  // recanoniser(charge, traces), après avoir vérifié qu'il rend le JSON et le
  // texte de canoniser(charge), sans modifier la charge reçue.
  function refaire(charge, traces) {
    const attendu = canoniser(charge);
    const avant = JSON.stringify(charge);
    const refaite = recanoniser(charge, traces);
    assert.equal(JSON.stringify(charge), avant, 'la charge reçue reste telle quelle');
    assert.equal(JSON.stringify(refaite), JSON.stringify(attendu));
    assert.equal(serialiserCanonique(refaite, ENTETE), serialiserCanonique(attendu, ENTETE));
    return refaite;
  }

  test("un identifiant changé se range de nouveau — participant de la charge, participant d'une proposition, occupant d'une table sans sièges attribués — et reste à son siège quand ils sont attribués", () => {
    const x = canoniser(chargeDeTravail());
    const t = tracesVides();
    salir(t, x, 'participants', 0).id = 6;
    salir(t, x, 'propositions', 0, 'participants')[0] = 6;
    salir(t, x, 'propositions', 0, 'placement', 0, 'sieges', 0)[0] = 6;
    salir(t, x, 'propositions', 1, 'placement', 0, 'sieges', 0)[0] = 5;
    const refaite = refaire(x, t);
    assert.deepEqual(refaite.participants.map(({ id }) => id), [2, 3, 4, 6]);
    assert.deepEqual(refaite.propositions[0].participants, [2, 3, 4, 6]);
    assert.deepEqual(refaite.propositions[0].placement[0].sieges, [[3, 6], [2, 4]]);
    assert.deepEqual(refaite.propositions[1].placement[0].sieges, [[5, 1], [4]]);
  });

  test("un drapeau siegesAttribues basculé à faux range chaque liste de table de son porteur, proposition ou retenu ; basculé à vrai, l'ordre posé se garde", () => {
    const x = canoniser(chargeDeTravail());
    const t = tracesVides();
    neuf(t, salir(t, x, 'propositions', 1)).siegesAttribues = false;
    neuf(t, salir(t, x, 'retenu')).siegesAttribues = false;
    const refaite = refaire(x, t);
    assert.deepEqual(refaite.propositions[1].placement.map(({ sieges }) => sieges), [[[1, 3], [4]], [[1, 4], [3]]]);
    assert.deepEqual(refaite.retenu.placement.map(({ sieges }) => sieges), [[[1, 3], [2, 4]], [[1, 4], [2, 3]]]);

    const y = canoniser(chargeDeTravail());
    const u = tracesVides();
    const premiere = neuf(u, salir(u, y, 'propositions', 0));
    premiere.siegesAttribues = true;
    premiere.placement[0].sieges[0] = [3, 1];
    assert.deepEqual(refaire(y, u).propositions[0].placement[0].sieges[0], [3, 1]);
  });

  test("une liste posée entière, à rebours et ses clés à rebours, se recopie et se range, de même qu'un enregistrement inséré hors de son rang, et une liste de table sous le drapeau de son porteur ; rien de neuf n'est partagé", () => {
    const x = canoniser(chargeDeTravail());
    const t = tracesVides();
    const posee = neuf(
      t,
      aRebours([
        { participant: 3, table: 2, siege: null, portee: 'tour', tour: 2 },
        { participant: 1, table: 1, siege: 1, portee: 'tous', tour: null },
        { participant: 2, table: 1, siege: 2, portee: 'tous', tour: null },
      ]),
    );
    salir(t, x).reservations = posee;
    const insere = neuf(
      t,
      aRebours({ id: 5, nom: 'Liseron', prenom: null, appartenance: null, courriel: null,
        titrePressenti: null, notes: null, exclu: false, presence: [3, 1] }),
    );
    salir(t, x, 'participants').splice(1, 0, insere);
    salir(t, x, 'propositions', 0, 'placement', 1, 'sieges')[0] = neuf(t, [4, 1]);
    salir(t, x, 'retenu', 'placement', 0, 'sieges')[1] = neuf(t, [4, 2]);
    const refaite = refaire(x, t);
    assert.deepEqual(refaite.propositions[0].placement[1].sieges[0], [1, 4]);
    assert.deepEqual(refaite.retenu.placement[0].sieges[1], [4, 2]);
    assert.deepEqual(refaite.reservations.map(({ participant }) => participant), [1, 2, 3]);
    assert.deepEqual(refaite.participants.map(({ id }) => id), [1, 2, 3, 4, 5]);
    assert.deepEqual(refaite.participants[4].presence, [1, 3]);
    const deNeuf = new Set([...objetsDe(posee), ...objetsDe(insere)]);
    assert.deepEqual([...objetsDe(refaite)].filter((objet) => deNeuf.has(objet)), []);
  });

  test("un champ facultatif posé prend son rang dans l'ordre du schéma et sa liste se range ; retiré, il manque à la copie", () => {
    const x = canoniser(chargeDeTravail());
    const t = tracesVides();
    const participant = salir(t, x, 'participants', 1);
    participant.presence = neuf(t, [2, 1]);
    participant.etiquettes = neuf(t, ['jardin', 'atelier']);
    const reglages = salir(t, x, 'reglages');
    reglages.rencontrerAnimateurs = true;
    reglages.regleObjectifs = 'et';
    delete salir(t, x, 'tables', 1).objectifs;
    delete salir(t, x, 'propositions', 1).horodatage;
    delete salir(t, x, 'propositions', 1, 'placement', 1).absents;
    const refaite = refaire(x, t);
    assert.deepEqual(Object.keys(refaite.participants[1]).slice(-2), ['etiquettes', 'presence']);
    assert.deepEqual(refaite.participants[1].presence, [1, 2]);
    assert.deepEqual(refaite.participants[1].etiquettes, ['atelier', 'jardin']);
    assert.deepEqual(Object.keys(refaite.reglages).slice(-2), ['regleObjectifs', 'rencontrerAnimateurs']);
    assert.equal(Object.hasOwn(refaite.tables[1], 'objectifs'), false);
    assert.equal(Object.hasOwn(refaite.propositions[1], 'horodatage'), false);
    assert.equal(Object.hasOwn(refaite.propositions[1].placement[1], 'absents'), false);
  });

  test("un objet sali se refait par les champs du schéma : une clé inconnue ou oubliée ne se copie pas", () => {
    const x = canoniser(chargeDeTravail());
    const t = tracesVides();
    salir(t, x, 'participants', 2).inconnue = 1;
    salir(t, x, 'reglages').cibleRedondance = 800;
    const refaite = refaire(x, t);
    assert.equal(Object.hasOwn(refaite.participants[2], 'inconnue'), false);
    assert.equal(Object.hasOwn(refaite.reglages, 'cibleRedondance'), false);
  });

  test("un retenu que sa règle refuse se recopie hors du schéma, qu'il le soit devenu en place ou qu'il soit posé entier", () => {
    const x = canoniser(chargeDeTravail());
    const t = tracesVides();
    salir(t, x, 'retenu').note = 'à revoir';
    assert.equal(refaire(x, t).retenu.note, 'à revoir');

    const y = canoniser(chargeDeTravail());
    const u = tracesVides();
    salir(u, y).retenu = neuf(u, { ...aRebours(structuredClone(y.retenu)), note: 'à revoir' });
    assert.equal(refaire(y, u).retenu.note, 'à revoir');
  });

  test("un retenu que sa règle refuse, recopié hors du schéma, qui redevient conforme en place se refait entier sous sa règle : ses listes se rangent, enfants propres compris", () => {
    const charge = chargeDeTravail();
    charge.retenu = {
      proposition: 1,
      siegesAttribues: false,
      tables: [1, 2],
      capacites: [2, 2],
      tours: 2,
      participants: [4, 2, 1, 3],
      horodatage: 'pas une date',
      placement: [
        { sieges: [[3, 1], [4, 2]], reserve: [] },
        { sieges: [[4, 1], [3, 2]], reserve: [] },
      ],
    };
    const x = canoniser(charge);
    assert.deepEqual(x.retenu.participants, [4, 2, 1, 3], "le retenu fautif garde ses listes dans l'ordre écrit");
    const t = tracesVides();
    delete salir(t, x, 'retenu').horodatage;
    const refaite = refaire(x, t);
    assert.deepEqual(refaite.retenu.participants, [1, 2, 3, 4]);
    assert.deepEqual(Object.keys(refaite.retenu.placement[0]), ['sieges', 'reserve']);
    assert.deepEqual(refaite.retenu.placement.map(({ sieges }) => sieges), [[[1, 3], [2, 4]], [[1, 4], [2, 3]]]);
  });

  test("ce qui n'est ni sali ni neuf revient tel quel, partagé avec la charge reçue, et ce qui l'est revient neuf ; sans rien de touché, la charge elle-même revient", () => {
    const x = canoniser(chargeDeTravail());
    assert.equal(recanoniser(x, tracesVides()), x);
    const t = tracesVides();
    salir(t, x, 'participants', 0).nom = 'Liseron';
    const refaite = refaire(x, t);
    assert.notEqual(refaite, x);
    assert.notEqual(refaite.participants, x.participants);
    assert.notEqual(refaite.participants[0], x.participants[0]);
    for (const cle of ['evenement', 'reglages', 'prochainsIds', 'tables', 'reservations', 'titres', 'propositions', 'retenu']) {
      assert.equal(refaite[cle], x[cle], cle);
    }
    assert.ok(refaite.participants.slice(1).every((participant, rang) => participant === x.participants[rang + 1]));
  });

  test('sur une copie de canoniserPartagee, les propositions partagées que rien ne touche restent partagées, et une proposition insérée se range parmi elles', () => {
    const x = canoniserPartagee(gelerPropositions(chargeDeTravail()));
    const partagees = [...x.propositions];
    assert.ok(partagees.every(estFigee));
    const t = tracesVides();
    const inseree = neuf(t, aRebours({ ...structuredClone(partagees[0]), id: 3 }));
    salir(t, x, 'propositions').unshift(inseree);
    const refaite = refaire(x, t);
    assert.deepEqual(refaite.propositions.map(({ id }) => id), [1, 2, 3]);
    assert.equal(refaite.propositions[0], partagees[0]);
    assert.equal(refaite.propositions[1], partagees[1]);
    assert.equal(estFigee(refaite.propositions[2]), false);
  });

  test('deux tours de suite, comme une suite de correctifs : la copie refaite, modifiée en place à son tour, se refait encore', () => {
    let x = canoniser(chargeDeTravail());
    let t = tracesVides();
    salir(t, x, 'participants', 0).id = 7;
    x = refaire(x, t);
    t = tracesVides();
    salir(t, x, 'tables', 0).id = 9;
    salir(t, x, 'propositions', 0, 'placement', 1, 'sieges', 1)[0] = 7;
    const refaite = refaire(x, t);
    assert.deepEqual(refaite.participants.map(({ id }) => id), [2, 3, 4, 7]);
    assert.deepEqual(refaite.tables.map(({ id }) => id), [2, 9]);
    assert.deepEqual(refaite.propositions[0].placement[1].sieges, [[1, 4], [3, 7]]);
  });

  test('un objet sali qui perd une clé du schéma lève la TypeError de canoniser, qui nomme son chemin', () => {
    const x = canoniser(chargeDeTravail());
    const t = tracesVides();
    delete salir(t, x, 'participants', 2).notes;
    const attendu = { name: 'TypeError', message: 'charge.participants[2].notes absente' };
    assert.throws(() => canoniser(x), attendu);
    assert.throws(() => recanoniser(x, t), attendu);
  });

  test('recanoniser ne lit ni horloge ni aléa', () => {
    const x = canoniser(chargeDeTravail());
    const t = tracesVides();
    salir(t, x, 'participants', 0).id = 6;
    neuf(t, salir(t, x, 'propositions', 1)).siegesAttribues = false;
    const attendu = JSON.stringify(canoniser(x));
    assert.equal(sansHorlogeNiAlea(() => JSON.stringify(recanoniser(x, t))), attendu);
  });
});
