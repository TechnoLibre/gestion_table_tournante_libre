// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du relevé du coût du plafond a priori (§ 17, point 4, § 19.10),
// sous une horloge factice : la durée d'un appel est la différence de deux
// lectures, et ce que l'horloge rend fixe chaque durée, donc chaque médiane,
// à la valeur exacte. Les configurations mesurées sont petites ; celles du
// banc ne se mesurent ici qu'une fois, pour leur forme.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../../test/lanceur.js';
import { FORME_PESSIMISTE } from '../../test/fixtures/banc/pessimiste.js';
import { configurationsDuBanc, mediane, mesurerPlafondAPriori } from './plafond.js';

const SCRIPT = fileURLToPath(new URL('./plafond.js', import.meta.url));

// Une salle de tables de 3, une personne fixée à la table 1 au tour 1, les
// autres libres ; contraintes inactives.
function salle({ tables, personnes, tours }) {
  return {
    participants: Array.from({ length: personnes }, (_, i) => ({ id: i + 1, nom: `Ombrelle ${i + 1}`, appartenance: null })),
    tables: Array.from({ length: tables }, (_, t) => ({ id: t + 1, numero: t + 1, capacite: 3 })),
    tours,
    reservations: [{ participant: 1, table: 1, portee: 'tour', tour: 1 }],
    contraintes: {
      separerAppartenances: false,
      nouveauxVoisins: false,
      nouvelleTable: false,
      varierAppartenances: false,
    },
  };
}

const PETITE = { cle: 'petite', configuration: salle({ tables: 4, personnes: 12, tours: 3 }) };
const MOYENNE = { cle: 'moyenne', configuration: salle({ tables: 6, personnes: 17, tours: 2 }) };

// Horloge qui avance de pas à chaque lecture, en partant de 0 ; lectures
// compte les lectures.
function horlogeAPas(pas) {
  const horloge = () => {
    horloge.lectures += 1;
    return (horloge.lectures - 1) * pas;
  };
  horloge.lectures = 0;
  return horloge;
}

// Horloge qui rend, lecture après lecture, le début puis la fin de chaque
// durée de la liste, un écart de 1 000 entre la fin d'une durée et le début
// de la suivante ; lève au-delà, une lecture de trop étant une faute.
function horlogeScriptee(durees) {
  const instants = [];
  let t = 0;
  for (const d of durees) {
    instants.push(t, t + d);
    t += d + 1000;
  }
  let rang = 0;
  const horloge = () => {
    if (rang >= instants.length) throw new Error(`lecture ${rang + 1} de l'horloge, ${instants.length} prévues`);
    return instants[rang++];
  };
  horloge.restantes = () => instants.length - rang;
  return horloge;
}

// Une configuration piégée : toute lecture de l'une de ses clés lève une
// Error, qui n'est ni un TypeError ni un RangeError.
const PIEGEE = new Proxy(
  {},
  {
    get() {
      throw new Error('configuration lue');
    },
  },
);

// Une configuration dont les lectures se comptent, et une horloge qui note,
// à chaque lecture, le compte des lectures de la configuration faites
// depuis la sienne précédente : entre les deux lectures de l'horloge qui
// bornent un appel, le compte dit si l'appel a lu la configuration.
function configurationEspionnee(configuration) {
  const espion = { lectures: 0 };
  espion.configuration = new Proxy(configuration, {
    get(cible, cle, recepteur) {
      espion.lectures += 1;
      return Reflect.get(cible, cle, recepteur);
    },
  });
  espion.horloge = () => {
    espion.vues.push(espion.lectures - espion.dernier);
    espion.dernier = espion.lectures;
    return espion.vues.length;
  };
  espion.vues = [];
  espion.dernier = 0;
  return espion;
}

describe('banc : la médiane', () => {
  test("rang du milieu d'une liste impaire, moyenne des deux du milieu d'une liste paire, sans modifier la liste", () => {
    const liste = [7, 1, 5];
    assert.equal(mediane(liste), 5);
    assert.deepEqual(liste, [7, 1, 5]);
    assert.equal(mediane([5, 1, 4, 2]), 3);
    assert.equal(mediane([9]), 9);
    assert.throws(() => mediane([]), RangeError);
  });
});

describe('banc : mesurerPlafondAPriori', () => {
  test("sous une horloge qui avance d'un pas fixe à chaque lecture, chaque médiane vaut exactement le pas, et l'horloge se lit deux fois par appel mesuré, jamais pendant la chauffe", () => {
    const horloge = horlogeAPas(0.25);
    const releve = mesurerPlafondAPriori({ configurations: [PETITE, MOYENNE], maintenant: horloge, repetitions: 5 });
    assert.deepEqual(releve, [
      { cle: 'petite', N: 12, T: 4, R: 3, msPlafonds: 0.25, msDiagnostic: 0.25 },
      { cle: 'moyenne', N: 17, T: 6, R: 2, msPlafonds: 0.25, msDiagnostic: 0.25 },
    ]);
    // Deux configurations, deux grandeurs, cinq appels mesurés, deux lectures.
    assert.equal(horloge.lectures, 2 * 2 * 5 * 2);
  });

  test("les durées d'une configuration : ses répétitions du plafond a priori, puis celles du diagnostic ; chaque grandeur rend la médiane des siennes, impaire comme paire", () => {
    const impaire = horlogeScriptee([7, 1, 5, 2, 9, 3]);
    assert.deepEqual(mesurerPlafondAPriori({ configurations: [PETITE], maintenant: impaire, repetitions: 3 }), [
      { cle: 'petite', N: 12, T: 4, R: 3, msPlafonds: 5, msDiagnostic: 3 },
    ]);
    assert.equal(impaire.restantes(), 0);

    const paire = horlogeScriptee([5, 1, 4, 2, 10, 6, 8, 1, 3, 3, 3, 3, 1, 2, 3, 4]);
    assert.deepEqual(
      mesurerPlafondAPriori({ configurations: [PETITE, MOYENNE], maintenant: paire, repetitions: 4 }),
      [
        { cle: 'petite', N: 12, T: 4, R: 3, msPlafonds: 3, msDiagnostic: 7 },
        { cle: 'moyenne', N: 17, T: 6, R: 2, msPlafonds: 3, msDiagnostic: 2.5 },
      ],
    );
    assert.equal(paire.restantes(), 0);
  });

  test("chaque appel mesuré du plafond a priori porte sur l'instance normalisée, sans relire la configuration ; chaque appel mesuré du diagnostic la lit", () => {
    const espion = configurationEspionnee(PETITE.configuration);
    mesurerPlafondAPriori({
      configurations: [{ cle: 'petite', configuration: espion.configuration }],
      maintenant: espion.horloge,
      repetitions: 3,
    });
    // vues[2i + 1] : les lectures de la configuration pendant le i-ème appel
    // mesuré ; les trois du plafond a priori, puis les trois du diagnostic.
    const pendant = espion.vues.filter((_, rang) => rang % 2 === 1);
    assert.equal(pendant.length, 6);
    assert.deepEqual(pendant.slice(0, 3), [0, 0, 0]);
    assert.ok(pendant.slice(3).every((lectures) => lectures > 0), `lectures pendant le diagnostic : ${pendant.slice(3)}`);
  });

  test('une liste de configurations vide ou absente, des répétitions non entières ou sous 1, une horloge absente ou une clé en double sont refusées avant toute lecture des configurations et de l’horloge', () => {
    const horloge = horlogeAPas(1);
    const piegee = { cle: 'piegee', configuration: PIEGEE };
    const mesurer = (options) => () => mesurerPlafondAPriori({ configurations: [piegee], maintenant: horloge, repetitions: 1, ...options });
    assert.throws(mesurer({ configurations: [] }), RangeError);
    assert.throws(mesurer({ configurations: undefined }), TypeError);
    for (const repetitions of [0, -1, 0.5, Number.NaN, '3', undefined]) {
      assert.throws(mesurer({ repetitions }), RangeError, `repetitions ${String(repetitions)}`);
    }
    assert.throws(mesurer({ maintenant: undefined }), TypeError);
    assert.throws(mesurer({ configurations: [piegee, { cle: 'piegee', configuration: PIEGEE }] }), RangeError);
    assert.throws(mesurer({ configurations: [piegee, { cle: '', configuration: PIEGEE }] }), TypeError);
    assert.equal(horloge.lectures, 0);
    // Le piège lui-même : une mesure qui atteint la configuration lève Error.
    assert.throws(mesurer({}), (erreur) => erreur.constructor === Error && erreur.message === 'configuration lue');
  });

  test("les configurations du banc : la grande démonstration et sa variante telles qu'elles sont livrées, puis la pessimiste ; une mesure les parcourt toutes", () => {
    const configurations = configurationsDuBanc();
    assert.deepEqual(
      configurations.map(({ cle }) => cle),
      ['grande', 'grande-sans-exception', 'pessimiste'],
    );
    const releve = mesurerPlafondAPriori({ configurations, maintenant: horlogeAPas(1), repetitions: 1 });
    assert.deepEqual(
      releve.map(({ cle, N, T, R }) => ({ cle, N, T, R })),
      [
        { cle: 'grande', N: 260, T: 33, R: 4 },
        { cle: 'grande-sans-exception', N: 260, T: 33, R: 4 },
        { cle: 'pessimiste', N: FORME_PESSIMISTE.personnes, T: FORME_PESSIMISTE.tables, R: FORME_PESSIMISTE.tours },
      ],
    );
  });
});

describe('banc : le script lancé', () => {
  test('node scripts/banc/plafond.js 1 imprime le relevé en JSON, une entrée par configuration du banc, sans autre clé ; un nombre de répétitions invalide sort en 2 sans rien imprimer', () => {
    const lance = spawnSync(process.execPath, [SCRIPT, '1'], { encoding: 'utf8' });
    assert.equal(lance.status, 0, lance.stderr);
    const releve = JSON.parse(lance.stdout);
    assert.deepEqual(releve.map(({ cle }) => cle), ['grande', 'grande-sans-exception', 'pessimiste']);
    for (const entree of releve) {
      assert.deepEqual(Object.keys(entree), ['cle', 'N', 'T', 'R', 'msPlafonds', 'msDiagnostic']);
      assert.ok(entree.msPlafonds >= 0 && entree.msDiagnostic >= 0);
    }
    const refuse = spawnSync(process.execPath, [SCRIPT, 'zero'], { encoding: 'utf8' });
    assert.equal(refuse.status, 2);
    assert.equal(refuse.stdout, '');
    assert.match(refuse.stderr, /répétitions/);
  });
});
