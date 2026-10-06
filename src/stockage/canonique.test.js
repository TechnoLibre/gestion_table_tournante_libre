// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la forme canonique du fichier d'état (§ 8.8, § 8.9) : le texte
// exact que le contrat de données attend du sérialiseur, la canonicité quel
// que soit l'ordre dans lequel une charge s'est construite, la charge seule
// dans la mise en page du fichier, l'aller-retour par l'analyse, le retenu
// que sa règle refuse, recopié hors du schéma, et un sérialiseur dont la
// sortie ne dépend que de ses arguments. Les noms des charges d'épreuve sont
// inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { versionVoisine } from '../../test/version_voisine.js';
import { VERSION } from '../version.genere.js';
import { canoniser, serialiser, serialiserCharge } from './canonique.js';
import { analyser } from './document.js';

// En-tête du texte du contrat.
const ENTETE = Object.freeze({ revision: 3, produitVersion: VERSION.affichee });

// Texte exact que le contrat de données (types.js) attend de serialiser pour
// chargeContrat() sous ENTETE, fin de ligne finale comprise.
const TEXTE_CONTRAT = `{
  "entete": {"format":1,"produitVersion":"${VERSION.affichee}","revision":3,"comptes":{"participants":4,"tables":2,"reservations":1,"titres":1,"propositions":1,"retenu":0}},
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
  "entete": {"format":1,"produitVersion":"${VERSION.affichee}","revision":1,"comptes":{"participants":0,"tables":0,"reservations":0,"titres":0,"propositions":0,"retenu":0}},
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
      `  "entete": {"format":1,"produitVersion":"${autre}","revision":41,"comptes":{"participants":4,"tables":2,"reservations":1,"titres":1,"propositions":1,"retenu":0}},`,
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
