// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le rapporteur des durées (test/rapporteur.js, § 14.14) : sa mesure au mur,
// son bilan, son refus, et sa déclaration dans vitest.config.js. Le
// rapporteur s'éprouve ici hors de Vitest : une fausse horloge date chaque
// événement, et de faux fichiers portent les épreuves et leurs durées.
import assert from 'node:assert/strict';
import configuration from '../vitest.config.js';
import Rapporteur, { PLAFONDS, bilan, dureeReunie, plusLentes } from './rapporteur.js';
import { describe, test } from './lanceur.js';
import { coeursDisponibles, ligneMachine, reglagesSeries } from './machine.js';

// Un faux fichier d'épreuves, tel que Vitest le passe au rapporteur : son
// identifiant, son projet, son chemin, et ses épreuves, chacune
// { nom, duree } ; une durée absente fait une épreuve sautée, sans
// diagnostic.
const fichier = (projet, chemin, epreuves = []) => ({
  id: `${projet}:${chemin}`,
  project: { name: projet },
  relativeModuleId: chemin,
  children: {
    *allTests() {
      for (const { nom, duree } of epreuves) {
        yield { fullName: nom, diagnostic: () => (duree === undefined ? undefined : { duration: duree }) };
      }
    },
  },
});

// Une épreuve telle que la lisent plusLentes et bilan.
const epreuve = (duree, fichierDEpreuve, nom, projet = 'node') => ({ duree, projet, fichier: fichierDEpreuve, nom });

// Projets mesurés tels que les lit bilan, depuis [nom, durée] : chacun suivi
// en entier.
const mesures = (paires) => new Map(paires.map(([nom, duree]) => [nom, { duree, nonSuivis: [] }]));

// Un rapporteur branché sur une horloge réglée à la main, sur des plafonds
// d'épreuve et sur un journal qui garde ses lignes. Rend le rapporteur, de
// quoi régler l'horloge, et les deux listes du journal.
function brancher() {
  let maintenant = 0;
  const journal = { lignes: [], erreurs: [] };
  const plafonds = new Map([['node', 30_000], ['node-long', 60_000]]);
  const rapporteur = new Rapporteur({ horloge: () => maintenant, plafonds });
  rapporteur.onInit({
    logger: { log: (texte) => journal.lignes.push(texte), error: (texte) => journal.erreurs.push(texte) },
  });
  return { rapporteur, journal, regler: (t) => (maintenant = t) };
}

// Exécute fin(), puis rend le code de sortie qu'elle a posé et remet celui
// d'avant : l'épreuve ne laisse pas son code au processus qui l'exécute.
function codeDeSortieDe(fin) {
  const avant = process.exitCode;
  process.exitCode = undefined;
  try {
    fin();
    return process.exitCode;
  } finally {
    process.exitCode = avant;
  }
}

describe('rapporteur : mesure', () => {
  test("dureeReunie mesure la réunion des intervalles, quel que soit leur ordre : chevauchés, emboîtés, bout à bout ou disjoints", () => {
    assert.equal(dureeReunie([]), 0);
    assert.equal(dureeReunie([{ debut: 5, fin: 9 }]), 4);
    assert.equal(dureeReunie([{ debut: 20, fin: 25 }, { debut: 0, fin: 10 }]), 15);
    assert.equal(dureeReunie([{ debut: 5, fin: 20 }, { debut: 0, fin: 10 }]), 20);
    assert.equal(dureeReunie([{ debut: 0, fin: 30 }, { debut: 5, fin: 10 }, { debut: 12, fin: 31 }]), 31);
    assert.equal(dureeReunie([{ debut: 10, fin: 20 }, { debut: 0, fin: 10 }]), 20);
  });

  test('plusLentes rend les n plus longues, de la plus lente à la plus rapide, à durée égale par fichier puis par nom', () => {
    const epreuves = [
      epreuve(3, 'b.test.js', 'x'),
      epreuve(9, 'a.test.js', 'y'),
      epreuve(3, 'a.test.js', 'z'),
      epreuve(3, 'a.test.js', 'w'),
      epreuve(1, 'a.test.js', 'v'),
    ];
    assert.deepEqual(plusLentes(epreuves, 4), [
      epreuve(9, 'a.test.js', 'y'),
      epreuve(3, 'a.test.js', 'w'),
      epreuve(3, 'a.test.js', 'z'),
      epreuve(3, 'b.test.js', 'x'),
    ]);
    assert.deepEqual(plusLentes(epreuves.slice(0, 2), 10), [epreuve(9, 'a.test.js', 'y'), epreuve(3, 'b.test.js', 'x')]);
  });
});

describe('rapporteur : bilan et refus', () => {
  test("un projet refuse au-delà de son plafond, pas à son plafond ; un projet sans plafond ne refuse jamais", () => {
    const plafonds = new Map([['node', 30_000], ['node-long', 60_000]]);
    const { refus } = bilan({
      duree: 70_000,
      projets: mesures([['node', 30_001], ['node-long', 60_000], ['navigateur', 90_000]]),
      epreuves: [],
      plafonds,
    });
    assert.deepEqual(refus, ['Le projet node dure 30,00 s au mur, au-delà de son plafond de 30,00 s (§ 14.14).']);
    assert.deepEqual(bilan({ duree: 1, projets: mesures([['node', 30_000]]), epreuves: [], plafonds }).refus, []);
  });

  test("une exécution sans épreuve le dit au lieu d'une liste vide", () => {
    assert.deepEqual(bilan({ duree: 4, projets: new Map(), epreuves: [], plafonds: new Map() }).lignes, [
      'Durée totale : 0,00 s',
      'Aucune épreuve exécutée.',
    ]);
  });

  test('le bilan donne la durée totale, chaque projet trié par nom avec son plafond, et les dix épreuves les plus lentes', () => {
    const epreuves = Array.from({ length: 12 }, (_, i) => epreuve(10 * (i + 1), 'a.test.js', `e${i + 1}`));
    const { lignes } = bilan({
      duree: 2_345,
      projets: mesures([['node-long', 2_000], ['navigateur', 1_234]]),
      epreuves,
      plafonds: new Map([['node-long', 60_000]]),
    });
    assert.deepEqual(lignes, [
      'Durée totale : 2,35 s',
      '  navigateur : 1,23 s au mur',
      '  node-long : 2,00 s au mur, plafond 60,00 s',
      'Épreuves les plus lentes (10 sur 12) :',
      '     120 ms  node  a.test.js > e12',
      '     110 ms  node  a.test.js > e11',
      '     100 ms  node  a.test.js > e10',
      '      90 ms  node  a.test.js > e9',
      '      80 ms  node  a.test.js > e8',
      '      70 ms  node  a.test.js > e7',
      '      60 ms  node  a.test.js > e6',
      '      50 ms  node  a.test.js > e5',
      '      40 ms  node  a.test.js > e4',
      '      30 ms  node  a.test.js > e3',
    ]);
  });
});

describe('rapporteur : branché sur les événements de Vitest', () => {
  test("chaque exécution compte à chaque projet sa durée moins le temps où seuls d'autres projets tournent, imprime son bilan, et sort en code 1 quand un projet dépasse son plafond", () => {
    const { rapporteur, journal, regler } = brancher();
    const a = fichier('node', 'src/a.test.js', [{ nom: 'a > un', duree: 7 }, { nom: 'a > sautée' }]);
    const b = fichier('node', 'src/b.test.js', [{ nom: 'b > deux', duree: 29_000 }]);
    const c = fichier('node-long', 'src/c.long.test.js', [{ nom: 'c > trois', duree: 19_000 }]);
    regler(0);
    rapporteur.onTestRunStart([]);
    regler(100);
    rapporteur.onTestModuleQueued(a);
    rapporteur.onTestModuleQueued(c);
    regler(400);
    rapporteur.onTestModuleEnd(a);
    regler(20_100);
    rapporteur.onTestModuleEnd(c);
    rapporteur.onTestModuleQueued(b);
    regler(50_000);
    rapporteur.onTestModuleEnd(b);
    regler(50_500);
    const code = codeDeSortieDe(() => rapporteur.onTestRunEnd([a, b, c], [], 'passed'));
    assert.equal(code, 1);
    // Aucun fichier ne tourne pendant 0,6 s, compté à chaque projet. node y
    // ajoute ses fichiers, [100, 400] et [20 100, 50 000], soit 30,8 s : les
    // 19,7 s où c tourne seul ne lui sont pas comptées. node-long y ajoute
    // [100, 20 100], soit 20,6 s.
    assert.deepEqual(journal.lignes.slice(0, 3), [
      'Durée totale : 50,50 s',
      '  node : 30,80 s au mur, plafond 30,00 s',
      '  node-long : 20,60 s au mur, plafond 60,00 s',
    ]);
    assert.deepEqual(journal.lignes.slice(3), [
      'Épreuves les plus lentes (3 sur 3) :',
      '   29000 ms  node  src/b.test.js > b > deux',
      '   19000 ms  node-long  src/c.long.test.js > c > trois',
      '       7 ms  node  src/a.test.js > a > un',
      // Le bilan finit sur le mode que cette machine fait retenir.
      ligneMachine(reglagesSeries(coeursDisponibles())),
    ]);
    assert.deepEqual(journal.erreurs, ['Le projet node dure 30,80 s au mur, au-delà de son plafond de 30,00 s (§ 14.14).']);

    // Une seconde exécution, comme une relance sous surveillance, repart de
    // zéro. Seul, le projet dure toute l'exécution, temps d'avant la prise de
    // son fichier compris ; sous son plafond, il ne pose aucun code de
    // sortie.
    journal.lignes.length = 0;
    journal.erreurs.length = 0;
    regler(60_000);
    rapporteur.onTestRunStart([]);
    regler(60_200);
    rapporteur.onTestModuleQueued(a);
    regler(60_300);
    rapporteur.onTestModuleEnd(a);
    regler(60_400);
    assert.equal(codeDeSortieDe(() => rapporteur.onTestRunEnd([a], [], 'passed')), undefined);
    assert.deepEqual(journal.lignes.slice(0, 2), ['Durée totale : 0,40 s', '  node : 0,40 s au mur, plafond 30,00 s']);
    assert.deepEqual(journal.erreurs, []);
  });

  test("un fichier dont le rapporteur n'a vu ni la prise ni la fin rend la durée de son projet inconnue, et refuse quand le projet a un plafond", () => {
    const { rapporteur, journal, regler } = brancher();
    const a = fichier('node', 'src/a.test.js', [{ nom: 'a > un', duree: 1 }]);
    const b = fichier('node', 'src/b.test.js', [{ nom: 'b > deux', duree: 1 }]);
    const n = fichier('navigateur', 'src/n.navigateur.test.js', [{ nom: 'n > trois', duree: 1 }]);
    regler(0);
    rapporteur.onTestRunStart([]);
    rapporteur.onTestModuleQueued(a);
    regler(10);
    rapporteur.onTestModuleEnd(a);
    const code = codeDeSortieDe(() => rapporteur.onTestRunEnd([a, b, n], [], 'passed'));
    assert.equal(code, 1);
    assert.deepEqual(journal.lignes.slice(0, 3), [
      'Durée totale : 0,01 s',
      '  navigateur : durée inconnue, 1 fichier non suivi',
      '  node : durée inconnue, 1 fichier non suivi, plafond 30,00 s',
    ]);
    assert.deepEqual(journal.erreurs, [
      "Le projet node a un plafond de 30,00 s, et sa durée ne se mesure pas : le rapporteur n'a pas suivi src/b.test.js (§ 14.14).",
    ]);
  });

  test("une exécution interrompue imprime son bilan sans rien refuser", () => {
    const { rapporteur, journal, regler } = brancher();
    const a = fichier('node', 'src/a.test.js', [{ nom: 'a > un', duree: 1 }]);
    regler(0);
    rapporteur.onTestRunStart([]);
    rapporteur.onTestModuleQueued(a);
    regler(40_000);
    assert.equal(codeDeSortieDe(() => rapporteur.onTestRunEnd([a], [], 'interrupted')), undefined);
    assert.deepEqual(journal.lignes.slice(0, 2), ['Durée totale : 40,00 s', '  node : 40,00 s au mur, plafond 30,00 s']);
    assert.deepEqual(journal.erreurs, []);
  });
});

describe('rapporteur : déclaration', () => {
  test('vitest.config.js déclare le rapporteur à côté du rapporteur par défaut', () => {
    assert.deepEqual(configuration.test.reporters, ['default', './test/rapporteur.js']);
  });

  test("chaque plafond nomme un projet de vitest.config.js sous son nom d'exécution, et node comme node-long ont le leur (§ 14.14)", () => {
    // Vitest nomme chaque instance d'un projet navigateur d'après le projet
    // et le navigateur, « navigateur (chromium) » : seul ce nom s'apparie à
    // un plafond.
    const projets = configuration.test.projects.flatMap(({ test: { name, browser } }) =>
      browser?.enabled ? browser.instances.map((instance) => `${name} (${instance.browser})`) : [name],
    );
    assert.ok(projets.includes('navigateur (chromium)'), `noms d'exécution : ${projets.join(', ')}`);
    assert.deepEqual([...PLAFONDS.keys()].filter((projet) => !projets.includes(projet)), []);
    assert.ok(PLAFONDS.has('node'), 'aucun plafond pour node');
    assert.ok(PLAFONDS.has('node-long'), 'aucun plafond pour node-long');
    assert.equal(PLAFONDS.get('node'), 30_000);
    assert.equal(PLAFONDS.get('node-long'), 60_000);
  });
});
