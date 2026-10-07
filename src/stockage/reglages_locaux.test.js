// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des réglages locaux (§ 8.5) : la lecture, jamais bloquante, qui
// rend les défauts et un avertissement pour un fichier illisible ; la forme
// canonique, qui garde les clés inconnues d'une construction plus récente ;
// l'écriture atomique à la racine ; l'écrivain différé, à délai borné, sous
// un planificateur factice. Les réglages se lisent et s'écrivent sur le
// système de fichiers d'épreuve.
import assert from 'node:assert/strict';
import { PanneSimulee, creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { ErreurStockage } from './erreurs.js';
import {
  FICHIER_REGLAGES,
  avecCadrage,
  avecPapier,
  cadrageDe,
  creerEcrivainDiffere,
  ecrireReglages,
  lireReglages,
  serialiserReglages,
} from './reglages_locaux.js';

const DOC = { id: 'documents', chemin: 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre' };

// Les réglages d'un dossier qui n'en a pas : ni papier choisi, ni cadrage.
const DEFAUTS = Object.freeze({ format: 1, papier: null, cadrages: Object.freeze([]) });

// Un disque neuf dont la racine documents existe, et son premier processus ;
// texte, quand il est donné, est le fichier des réglages.
function disque(texte = null) {
  const fs = creerFichiersSimules({ disque: new Map() });
  fs.deposerDossier('documents');
  if (texte !== null) fs.deposer('documents', FICHIER_REGLAGES, texte);
  return fs;
}

// L'avertissement d'un fichier illisible, de raison donnée.
const illisibles = (raison) => ({ code: 'REGLAGES_ILLISIBLES', details: { chemin: FICHIER_REGLAGES, raison } });

// Trois réglages successifs : le papier, puis un cadrage, puis ce cadrage
// zoomé et déplacé.
const R1 = { format: 1, papier: 'A4', cadrages: [] };
const R2 = { format: 1, papier: 'A4', cadrages: [{ evenement: 'evt-a', k: 1, tx: 0, ty: 0 }] };
const R3 = { format: 1, papier: 'A4', cadrages: [{ evenement: 'evt-a', k: 2, tx: -40, ty: 15 }] };

// Un planificateur factice : planifier inscrit un minuteur et rend son
// numéro, annuler le retire, echoir déclenche ceux qui restent, dans l'ordre
// de leur armement ; armements et annulations comptent les appels.
function planificateur() {
  const minuteurs = new Map();
  const compte = { armements: 0, annulations: 0 };
  return {
    compte,
    planifier: (fonction, delai) => {
      compte.armements += 1;
      minuteurs.set(compte.armements, { fonction, delai });
      return compte.armements;
    },
    annuler: (numero) => {
      compte.annulations += 1;
      minuteurs.delete(numero);
    },
    echoir: () => {
      const echus = [...minuteurs.values()];
      minuteurs.clear();
      for (const { fonction } of echus) fonction();
    },
    delais: () => [...minuteurs.values()].map(({ delai }) => delai),
  };
}

// Laisse s'écouler les promesses en attente et les rejets non traités.
const attendre = () => new Promise((resolve) => setTimeout(resolve, 0));

// Exécute travail en relevant chaque rejet de promesse que rien ne traite ;
// rend ce relevé.
async function rejetsNonTraites(travail) {
  const rejets = [];
  const ecouteur = (raison) => rejets.push(raison);
  process.on('unhandledRejection', ecouteur);
  try {
    await travail();
    await attendre();
    await attendre();
  } finally {
    process.off('unhandledRejection', ecouteur);
  }
  return rejets;
}

describe('réglages locaux : lire, jamais bloquant (§ 8.5)', () => {
  test('un fichier absent rend les défauts, sans avertissement ni écriture', async () => {
    const fs = disque();
    assert.deepEqual(await lireReglages(fs, DOC), { reglages: DEFAUTS, avertissement: null });
    assert.equal(fs.compteurs.ecritures, 0);
  });

  test('un fichier illisible rend les défauts et REGLAGES_ILLISIBLES, sa raison nommée, sans lever ni écrire', async () => {
    const cadrage = (plus) => JSON.stringify({ evenement: 'evt-a', k: 1, tx: 0, ty: 0, ...plus });
    const avecCadrages = (...cadrages) => `{"cadrages":[${cadrages.join(',')}],"format":1,"papier":null}\n`;
    // Par cas : le texte du fichier, et la raison de l'avertissement.
    const cas = [
      ['un texte vide', '', 'JSON'],
      ['du JSON invalide', '{"papier":', 'JSON'],
      ['une liste', '[]\n', 'FORME'],
      ['un format absent', '{"cadrages":[],"papier":null}\n', 'FORME'],
      ['un format non entier', '{"cadrages":[],"format":1.5,"papier":null}\n', 'FORME'],
      ['un format nul', '{"cadrages":[],"format":0,"papier":null}\n', 'FORME'],
      ['un papier absent', '{"cadrages":[],"format":1}\n', 'FORME'],
      ['un papier inconnu', '{"cadrages":[],"format":1,"papier":"A3"}\n', 'FORME'],
      ['des cadrages absents', '{"format":1,"papier":null}\n', 'FORME'],
      ['un cadrage qui n’est pas un objet', avecCadrages('[]'), 'FORME'],
      ['un événement vide', avecCadrages(cadrage({ evenement: '' })), 'FORME'],
      ['un zoom nul', avecCadrages(cadrage({ k: 0 })), 'FORME'],
      ['un zoom négatif', avecCadrages(cadrage({ k: -1 })), 'FORME'],
      ['une translation en texte', avecCadrages(cadrage({ tx: '10' })), 'FORME'],
      ['une translation nulle', avecCadrages(cadrage({ ty: null })), 'FORME'],
      ['un cadrage en double', avecCadrages(cadrage({}), cadrage({ k: 2 })), 'FORME'],
    ];
    for (const [nom, texte, raison] of cas) {
      const fs = disque(texte);
      assert.deepEqual(
        await lireReglages(fs, DOC),
        { reglages: DEFAUTS, avertissement: illisibles(raison) },
        nom,
      );
      assert.equal(fs.compteurs.ecritures, 0, nom);
    }
  });

  test('une lecture refusée par le système de fichiers donne les défauts et son code pour raison ; une panne du processus remonte', async () => {
    const fs = disque('{"cadrages":[],"format":1,"papier":"A4"}\n');
    fs.lireTexte = async (racine, chemin) => {
      throw new ErreurStockage('LECTURE', { chemin, dossier: racine.chemin, cause: 'EACCES' });
    };
    assert.deepEqual(await lireReglages(fs, DOC), { reglages: DEFAUTS, avertissement: illisibles('LECTURE') });

    const coupe = disque('{"cadrages":[],"format":1,"papier":"A4"}\n');
    coupe.pannes.couperApres(0);
    await assert.rejects(lireReglages(coupe, DOC), PanneSimulee);
  });

  test('un fichier lisible rend son papier et ses cadrages triés par événement, ses clés inconnues et son format gardés ; une marque d’ordre d’octets en tête est admise', async () => {
    const texte =
      '\u{FEFF}{"format":2,"papier":"Lettre","theme":"sombre","cadrages":[' +
      '{"evenement":"evt-b","k":0.5,"tx":10,"ty":-20,"rotation":90},' +
      '{"evenement":"evt-a","k":1.25,"tx":0,"ty":0}]}\n';
    const fs = disque(texte);
    const { reglages, avertissement } = await lireReglages(fs, DOC);
    assert.equal(avertissement, null);
    assert.deepEqual(reglages, {
      format: 2,
      papier: 'Lettre',
      theme: 'sombre',
      cadrages: [
        { evenement: 'evt-a', k: 1.25, tx: 0, ty: 0 },
        { evenement: 'evt-b', k: 0.5, tx: 10, ty: -20, rotation: 90 },
      ],
    });
    assert.deepEqual(cadrageDe(reglages, 'evt-b'), { k: 0.5, tx: 10, ty: -20 });
    assert.equal(cadrageDe(reglages, 'evt-c'), null);
    assert.equal(fs.compteurs.ecritures, 0);
  });
});

describe('réglages locaux : la forme canonique et l’écriture', () => {
  test('serialiserReglages range les clés à chaque niveau et les cadrages par identifiant d’événement, et finit sur une fin de ligne : deux constructions dans deux ordres donnent le même texte', () => {
    const attendu =
      '{"cadrages":[{"evenement":"evt-a","k":1.25,"tx":0,"ty":0},' +
      '{"evenement":"evt-b","k":0.5,"tx":10,"ty":-20}],"format":1,"papier":"A4"}\n';
    const a = avecCadrage(
      avecCadrage(avecPapier(DEFAUTS, 'A4'), 'evt-b', { k: 0.5, tx: 10, ty: -20 }),
      'evt-a',
      { k: 1.25, tx: 0, ty: 0 },
    );
    const b = avecPapier(
      avecCadrage(avecCadrage(DEFAUTS, 'evt-a', { k: 1.25, tx: 0, ty: 0 }), 'evt-b', { k: 0.5, tx: 10, ty: -20 }),
      'A4',
    );
    const aLaMain = {
      papier: 'A4',
      format: 1,
      cadrages: [
        { ty: -20, tx: 10, k: 0.5, evenement: 'evt-b' },
        { evenement: 'evt-a', k: 1.25, tx: 0, ty: 0 },
      ],
    };
    for (const reglages of [a, b, aLaMain]) assert.equal(serialiserReglages(reglages), attendu);
    assert.equal(
      serialiserReglages({ zeta: { b: 1, a: [2, { d: 3, c: 4 }] }, ...DEFAUTS }),
      '{"cadrages":[],"format":1,"papier":null,"zeta":{"a":[2,{"c":4,"d":3}],"b":1}}\n',
    );
    assert.throws(() => serialiserReglages({ ...DEFAUTS, papier: 'A3' }), TypeError);
    const zoomIndefini = { evenement: 'evt-a', k: Number.NaN, tx: 0, ty: 0 };
    assert.throws(() => serialiserReglages({ ...DEFAUTS, cadrages: [zoomIndefini] }), TypeError);
    assert.throws(() => serialiserReglages(null), TypeError);
  });

  test("avecCadrage remplace le cadrage d'un événement ou l'ajoute à son rang, avecPapier pose le papier, sans modifier les réglages reçus ; une valeur hors de sa règle lève TypeError", () => {
    const depart = avecCadrage(DEFAUTS, 'evt-b', { k: 0.5, tx: 10, ty: -20 });
    const copie = structuredClone(depart);
    const ajoute = avecCadrage(depart, 'evt-a', { k: 1, tx: 1, ty: 1 });
    const remplace = avecCadrage(ajoute, 'evt-b', { k: 2, tx: 0, ty: 0 });
    assert.deepEqual(depart, copie);
    assert.deepEqual(DEFAUTS, { format: 1, papier: null, cadrages: [] });
    assert.deepEqual(remplace.cadrages, [
      { evenement: 'evt-a', k: 1, tx: 1, ty: 1 },
      { evenement: 'evt-b', k: 2, tx: 0, ty: 0 },
    ]);
    const lettre = avecPapier(remplace, 'Lettre');
    assert.deepEqual([remplace.papier, lettre.papier, avecPapier(lettre, null).papier], [null, 'Lettre', null]);
    assert.deepEqual(lettre.cadrages, remplace.cadrages);
    const refus = [
      ['un zoom nul', () => avecCadrage(DEFAUTS, 'evt-a', { k: 0, tx: 0, ty: 0 })],
      ['un zoom négatif', () => avecCadrage(DEFAUTS, 'evt-a', { k: -1, tx: 0, ty: 0 })],
      ['une translation infinie', () => avecCadrage(DEFAUTS, 'evt-a', { k: 1, tx: Number.POSITIVE_INFINITY, ty: 0 })],
      ['une translation absente', () => avecCadrage(DEFAUTS, 'evt-a', { k: 1, tx: 0 })],
      ['un événement vide', () => avecCadrage(DEFAUTS, '', { k: 1, tx: 0, ty: 0 })],
      ['un papier inconnu', () => avecPapier(DEFAUTS, 'A3')],
    ];
    for (const [nom, appel] of refus) assert.throws(appel, TypeError, nom);
  });

  test("ecrireReglages écrit le texte canonique par une seule écriture atomique à la racine, sans créer un dossier de travail qui manque", async () => {
    const fs = disque();
    const ecritures = [];
    const ecrire = fs.ecrireAtomique;
    fs.ecrireAtomique = (racine, chemin, texte) => {
      ecritures.push(chemin);
      return ecrire(racine, chemin, texte);
    };
    await ecrireReglages(fs, DOC, R3);
    assert.deepEqual(ecritures, [FICHIER_REGLAGES]);
    assert.equal(fs.compteurs.ecritures, 1);
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), serialiserReglages(R3));
    assert.deepEqual(await lireReglages(fs, DOC), { reglages: R3, avertissement: null });

    const sansDossier = creerFichiersSimules({ disque: new Map() });
    await assert.rejects(ecrireReglages(sansDossier, DOC, R1), (erreur) => erreur.code === 'ECRITURE');
  });

  test("une clé inconnue d'un fichier lisible survit à la réécriture, à tout niveau, son format compris : le réglage d'une construction plus récente reste", async () => {
    const texte =
      '{"cadrages":[{"evenement":"evt-a","k":1,"rotation":90,"tx":0,"ty":0}],' +
      '"format":2,"papier":null,"theme":"sombre"}\n';
    const fs = disque(texte);
    const { reglages } = await lireReglages(fs, DOC);
    await ecrireReglages(fs, DOC, avecPapier(reglages, 'A4'));
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), texte.replace('"papier":null', '"papier":"A4"'));
  });
});

describe('réglages locaux : l’écriture différée (§ 8.2, § 8.5)', () => {
  test('trois demandes rapprochées arment un seul minuteur, jamais réarmé, et donnent une écriture, la dernière ; une demande après elle en arme un autre', async () => {
    const ecrits = [];
    const minuterie = planificateur();
    const ecrivain = creerEcrivainDiffere({
      ecrire: async (reglages) => {
        ecrits.push(reglages);
      },
      planifier: minuterie.planifier,
      annuler: minuterie.annuler,
      delaiMs: 500,
    });
    ecrivain.demander(R1);
    ecrivain.demander(R2);
    ecrivain.demander(R3);
    assert.deepEqual(minuterie.compte, { armements: 1, annulations: 0 });
    assert.deepEqual(minuterie.delais(), [500]);
    assert.deepEqual(ecrits, []);
    minuterie.echoir();
    await attendre();
    assert.deepEqual(ecrits, [R3]);

    ecrivain.demander(R1);
    assert.deepEqual(minuterie.compte, { armements: 2, annulations: 0 });
    minuterie.echoir();
    await attendre();
    assert.deepEqual(ecrits, [R3, R1]);
  });

  test("vider annule le minuteur et écrit tout de suite la demande en attente, et rend la promesse de l'écriture ; sans demande en attente, il n'écrit rien", async () => {
    const ecrits = [];
    const minuterie = planificateur();
    const ecrivain = creerEcrivainDiffere({
      ecrire: async (reglages) => {
        ecrits.push(reglages);
      },
      planifier: minuterie.planifier,
      annuler: minuterie.annuler,
      delaiMs: 500,
    });
    await ecrivain.vider();
    assert.deepEqual([ecrits, minuterie.compte], [[], { armements: 0, annulations: 0 }]);
    ecrivain.demander(R1);
    ecrivain.demander(R2);
    const promesse = ecrivain.vider();
    assert.deepEqual([minuterie.delais(), minuterie.compte.annulations], [[], 1]);
    await promesse;
    assert.deepEqual(ecrits, [R2]);
    minuterie.echoir();
    await ecrivain.vider();
    assert.deepEqual(ecrits, [R2]);
  });

  test("une écriture refusée au terme du minuteur va au signaleur, jamais en rejet non traité ; les réglages restent en attente pour la demande suivante ou pour vider, qui rejette à son tour", async () => {
    let refuser = true;
    const ecrits = [];
    const signales = [];
    const refus = new ErreurStockage('ECRITURE', { chemin: FICHIER_REGLAGES, dossier: DOC.chemin, cause: 'EROFS' });
    const ecrire = async (reglages) => {
      if (refuser) throw refus;
      ecrits.push(reglages);
    };
    const minuterie = planificateur();
    const commun = { ecrire, planifier: minuterie.planifier, annuler: minuterie.annuler, delaiMs: 500 };
    const rejets = await rejetsNonTraites(async () => {
      const ecrivain = creerEcrivainDiffere({ ...commun, signaler: (erreur) => signales.push(erreur) });
      ecrivain.demander(R1);
      minuterie.echoir();
      await attendre();
      assert.deepEqual([signales, ecrits], [[refus], []]);
      await assert.rejects(ecrivain.vider(), (erreur) => erreur === refus);
      refuser = false;
      await ecrivain.vider();
      assert.deepEqual(ecrits, [R1]);

      // Sans signaleur, le refus se tait ; la demande suivante remplace
      // celle qui attend, et l'écrit.
      const muet = creerEcrivainDiffere(commun);
      refuser = true;
      muet.demander(R2);
      minuterie.echoir();
      await attendre();
      refuser = false;
      muet.demander(R3);
      minuterie.echoir();
      await attendre();
      assert.deepEqual(ecrits, [R1, R3]);
    });
    assert.deepEqual(rejets, []);
    assert.equal(signales.length, 1);
  });

  test("les écritures ne se chevauchent jamais : celle d'une demande suivante attend la fin de la précédente, et vider attend celle en cours", async () => {
    const appels = [];
    const liberations = [];
    const minuterie = planificateur();
    const ecrivain = creerEcrivainDiffere({
      ecrire: (reglages) => {
        appels.push(reglages);
        return new Promise((resolve) => liberations.push(resolve));
      },
      planifier: minuterie.planifier,
      annuler: minuterie.annuler,
      delaiMs: 500,
    });
    ecrivain.demander(R1);
    minuterie.echoir();
    await attendre();
    ecrivain.demander(R2);
    minuterie.echoir();
    await attendre();
    assert.deepEqual(appels, [R1]);
    liberations[0]();
    await attendre();
    assert.deepEqual(appels, [R1, R2]);
    let fini = false;
    const fin = ecrivain.vider().then(() => {
      fini = true;
    });
    await attendre();
    assert.equal(fini, false);
    liberations[1]();
    await fin;
    assert.equal(fini, true);
  });

  test("la dernière demande l'emporte : une écriture refusée pendant que la suivante attend la fin ne revient pas en attente, et vider n'écrit ensuite rien de plus", async () => {
    // Les deux premières écritures se tiennent jusqu'à ce que l'épreuve les
    // libère ou les refuse ; les suivantes réussissent tout de suite. ecrits
    // reçoit les réglages de chaque écriture réussie.
    const ecrits = [];
    const tenues = [];
    const signales = [];
    const refus = new ErreurStockage('ECRITURE', { chemin: FICHIER_REGLAGES, dossier: DOC.chemin, cause: 'EBUSY' });
    const minuterie = planificateur();
    const rejets = await rejetsNonTraites(async () => {
      const ecrivain = creerEcrivainDiffere({
        ecrire: (reglages) =>
          new Promise((resolve, reject) => {
            const liberer = () => {
              ecrits.push(reglages);
              resolve();
            };
            if (tenues.length < 2) tenues.push({ liberer, refuser: reject });
            else liberer();
          }),
        planifier: minuterie.planifier,
        annuler: minuterie.annuler,
        delaiMs: 500,
        signaler: (erreur) => signales.push(erreur),
      });
      ecrivain.demander(R1);
      minuterie.echoir();
      await attendre();
      ecrivain.demander(R2);
      minuterie.echoir();
      await attendre();
      assert.equal(tenues.length, 1);
      tenues[0].refuser(refus);
      await attendre();
      assert.equal(tenues.length, 2);
      tenues[1].liberer();
      await ecrivain.vider();
      assert.deepEqual(ecrits, [R2]);
      assert.deepEqual(minuterie.delais(), []);
    });
    assert.deepEqual([rejets, signales], [[], [refus]]);
  });

  test("creerEcrivainDiffere refuse des paramètres hors de leur forme, TypeError", () => {
    const valides = { ecrire: async () => {}, planifier: () => 1, annuler: () => {}, delaiMs: 500 };
    const refus = [
      ['ecrire absent', { ...valides, ecrire: undefined }],
      ['planifier absent', { ...valides, planifier: null }],
      ['annuler absent', { ...valides, annuler: 'non' }],
      ['un délai négatif', { ...valides, delaiMs: -1 }],
      ['un délai qui n’est pas un nombre', { ...valides, delaiMs: '500' }],
      ['un signaleur qui n’est pas une fonction', { ...valides, signaler: 1 }],
    ];
    for (const [nom, parametres] of refus) assert.throws(() => creerEcrivainDiffere(parametres), TypeError, nom);
    assert.equal(typeof creerEcrivainDiffere({ ...valides, signaler: null }).demander, 'function');
  });
});
