// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des réglages locaux (§ 8.5) : la lecture, jamais bloquante, qui
// rend les défauts et un avertissement pour un fichier illisible ; la forme
// canonique, qui garde les clés inconnues d'une construction plus récente ;
// l'écriture atomique à la racine ; l'écrivain différé, à délai borné, sous
// un planificateur factice. Les réglages se lisent et s'écrivent sur le
// système de fichiers d'épreuve.
import assert from 'node:assert/strict';
import { PanneSimulee, creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { PAPIERS } from '../geometrie/papiers.js';
import { PALIERS_TAILLE_TEXTE, TAILLE_TEXTE_DEFAUT } from '../geometrie/taille_texte.js';
import { ErreurStockage } from './erreurs.js';
import {
  DONNEES_BADGE,
  FICHIER_REGLAGES,
  COLONNES_LISTE_BADGES,
  avecCacherNumero,
  avecCadrage,
  avecColonnesListe,
  avecDonneeBadge,
  avecModeleBadge,
  avecOrganisationEnGros,
  avecPapier,
  avecPiedTechnolibre,
  avecTailleTexte,
  avecTextePiedTechnolibre,
  cacherNumeroDe,
  cadrageDe,
  colonnesListeDe,
  creerEcrivainDiffere,
  donneesBadgeDe,
  ecrireReglages,
  lireReglages,
  modeleBadgeDe,
  normaliserTextePied,
  organisationEnGrosDe,
  piedTechnolibreDe,
  serialiserReglages,
  tailleTexteDe,
  textePiedTechnolibreDe,
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

// L'avertissement d'un fichier illisible, de raison donnée, et de la cause
// que porte le refus de lecture, quand il en porte une.
const illisibles = (raison, cause = null) => ({
  code: 'REGLAGES_ILLISIBLES',
  details: { chemin: FICHIER_REGLAGES, raison, ...(cause === null ? {} : { cause }) },
});

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

// Laisse s'écouler les promesses en attente et les rejets non traités :
// setImmediate rappelle une fois vidées les microtâches, et après l'annonce
// des rejets que rien ne traite ; il n'attend aucune durée.
const attendre = () => new Promise((resolve) => setImmediate(resolve));

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
      ['une taille du texte hors des paliers', '{"cadrages":[],"format":1,"papier":null,"taille_texte":120}\n', 'FORME'],
      ['une taille du texte en texte', '{"cadrages":[],"format":1,"papier":null,"taille_texte":"100"}\n', 'FORME'],
      ['une taille du texte nulle', '{"cadrages":[],"format":1,"papier":null,"taille_texte":null}\n', 'FORME'],
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

  test('une lecture refusée par le système de fichiers donne les défauts, son code pour raison et sa cause ; une panne du processus remonte', async () => {
    const fs = disque('{"cadrages":[],"format":1,"papier":"A4"}\n');
    fs.lireTexte = async (racine, chemin) => {
      throw new ErreurStockage('LECTURE', { chemin, dossier: racine.chemin, cause: 'EACCES' });
    };
    assert.deepEqual(await lireReglages(fs, DOC), {
      reglages: DEFAUTS,
      avertissement: illisibles('LECTURE', 'EACCES'),
    });

    // Des octets hors UTF-8 : le système a lu le fichier, la cause le dit ;
    // les octets du refus ne passent pas dans l'avertissement.
    const latin = disque();
    latin.deposerOctets('documents', FICHIER_REGLAGES, Uint8Array.of(0x7b, 0xe9, 0x7d));
    assert.deepEqual(await lireReglages(latin, DOC), {
      reglages: DEFAUTS,
      avertissement: illisibles('LECTURE', 'UTF8_INVALIDE'),
    });

    // Un refus sans cause ne lui en invente pas.
    const lien = disque();
    lien.lireTexte = async (_racine, chemin) => {
      throw new ErreurStockage('CHEMIN_REFUSE', { chemin });
    };
    assert.deepEqual(await lireReglages(lien, DOC), { reglages: DEFAUTS, avertissement: illisibles('CHEMIN_REFUSE') });

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

  test('la taille du texte se lit sous taille_texte ; un fichier qui ne la porte pas, ou absent, rend le défaut, sans que la clé s’ajoute aux réglages lus', async () => {
    const porte = await lireReglages(disque('{"cadrages":[],"format":1,"papier":"A4","taille_texte":130}\n'), DOC);
    assert.equal(porte.avertissement, null);
    assert.deepEqual(porte.reglages, { format: 1, papier: 'A4', cadrages: [], taille_texte: 130 });
    assert.equal(tailleTexteDe(porte.reglages), 130);
    const sans = await lireReglages(disque('{"cadrages":[],"format":1,"papier":"A4"}\n'), DOC);
    assert.deepEqual(sans.reglages, { format: 1, papier: 'A4', cadrages: [] });
    assert.equal(tailleTexteDe(sans.reglages), TAILLE_TEXTE_DEFAUT);
    const absent = await lireReglages(disque(), DOC);
    assert.equal(Object.hasOwn(absent.reglages, 'taille_texte'), false);
    assert.equal(tailleTexteDe(absent.reglages), TAILLE_TEXTE_DEFAUT);
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
    assert.equal(serialiserReglages(DEFAUTS), '{"cadrages":[],"format":1,"papier":null}\n', 'sans taille choisie, la clé ne s’écrit pas');
    assert.equal(
      serialiserReglages({ taille_texte: 115, ...DEFAUTS }),
      '{"cadrages":[],"format":1,"papier":null,"taille_texte":115}\n',
    );
    assert.throws(() => serialiserReglages({ ...DEFAUTS, taille_texte: 120 }), TypeError);
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

  test('avecTailleTexte pose la taille du texte, sans modifier les réglages reçus ni leurs autres clés ; chaque palier se pose, s’écrit et se relit ; hors des paliers, TypeError', async () => {
    const depart = avecCadrage(avecPapier(DEFAUTS, 'A4'), 'evt-a', { k: 1, tx: 0, ty: 0 });
    const copie = structuredClone(depart);
    const pose = avecTailleTexte(depart, 130);
    assert.deepEqual(depart, copie);
    assert.deepEqual(pose, { ...copie, taille_texte: 130 });
    assert.equal(avecTailleTexte(pose, 90).taille_texte, 90);
    assert.ok(PALIERS_TAILLE_TEXTE.length > 0);
    for (const palier of PALIERS_TAILLE_TEXTE) {
      const fs = disque();
      await ecrireReglages(fs, DOC, avecTailleTexte(DEFAUTS, palier));
      const { reglages, avertissement } = await lireReglages(fs, DOC);
      assert.equal(avertissement, null, String(palier));
      assert.equal(tailleTexteDe(reglages), palier);
    }
    for (const faute of [0, 120, '115', null, undefined, Number.NaN]) {
      assert.throws(() => avecTailleTexte(DEFAUTS, faute), TypeError, String(faute));
    }
    assert.throws(() => avecTailleTexte(DEFAUTS, 120), /taille du texte 90, 100, 115, 130 ou 150 attendue/);
  });

  test('le domaine du papier est celui de PAPIERS (src/geometrie/papiers.js) : chaque papier défini se pose, s’écrit et se relit ; une clé héritée ne passe pas', async () => {
    const definis = Object.keys(PAPIERS);
    assert.ok(definis.length > 0);
    for (const papier of definis) {
      const fs = disque();
      await ecrireReglages(fs, DOC, avecPapier(DEFAUTS, papier));
      assert.deepEqual(await lireReglages(fs, DOC), { reglages: { ...DEFAUTS, papier }, avertissement: null }, papier);
    }
    for (const papier of ['toString', '__proto__', 'constructor', 'hasOwnProperty', 'a4', 'Letter', 0]) {
      assert.throws(() => avecPapier(DEFAUTS, papier), TypeError, String(papier));
      assert.throws(() => serialiserReglages({ ...DEFAUTS, papier }), TypeError, String(papier));
      const lu = await lireReglages(disque(`{"cadrages":[],"format":1,"papier":${JSON.stringify(papier)}}\n`), DOC);
      assert.deepEqual(lu.avertissement, illisibles('FORME'), String(papier));
    }
    assert.throws(() => avecPapier(DEFAUTS, 'A3'), new RegExp(`papier null, ${definis.join(' ou ')} attendu`));
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

describe('réglages locaux : le modèle de badge (§ 8.5, § 11.2)', () => {
  test('modele_badge se lit tel quel ; absent, il vaut Avery 5392 sans que la clé s’ajoute aux réglages lus', async () => {
    for (const modele of ['a6', 'avery5392']) {
      const { reglages, avertissement } = await lireReglages(disque(`{"cadrages":[],"format":1,"modele_badge":"${modele}","papier":"A4"}\n`), DOC);
      assert.equal(avertissement, null);
      assert.deepEqual(reglages, { format: 1, papier: 'A4', cadrages: [], modele_badge: modele });
      assert.equal(modeleBadgeDe(reglages), modele);
    }
    const absent = await lireReglages(disque(), DOC);
    assert.equal(Object.hasOwn(absent.reglages, 'modele_badge'), false);
    assert.equal(modeleBadgeDe(absent.reglages), 'avery5392');
    assert.equal(modeleBadgeDe((await lireReglages(disque('{"cadrages":[],"format":1,"papier":null}\n'), DOC)).reglages), 'avery5392');
  });

  test('un modèle inconnu rend le fichier fautif comme un papier inconnu : les défauts et REGLAGES_ILLISIBLES, raison FORME', async () => {
    for (const valeur of ['"A6"', '"Avery5392"', '""', 'null', '5392', '"toString"']) {
      const fs = disque(`{"cadrages":[],"format":1,"modele_badge":${valeur},"papier":null}\n`);
      assert.deepEqual(await lireReglages(fs, DOC), { reglages: DEFAUTS, avertissement: illisibles('FORME') }, valeur);
      assert.equal(fs.compteurs.ecritures, 0, valeur);
    }
  });

  test('avecModeleBadge pose la clé sans toucher au reste ; un modèle inconnu lève TypeError ; le texte canonique la range à son rang', () => {
    const reglages = { ...DEFAUTS, papier: 'A4', theme: 'sombre' };
    const avec = avecModeleBadge(reglages, 'a6');
    assert.deepEqual(avec, { ...reglages, modele_badge: 'a6' });
    assert.equal(Object.hasOwn(reglages, 'modele_badge'), false);
    assert.equal(serialiserReglages(avec), '{"cadrages":[],"format":1,"modele_badge":"a6","papier":"A4","theme":"sombre"}\n');
    for (const mauvais of ['A6', null, undefined, 'toString']) assert.throws(() => avecModeleBadge(reglages, mauvais), TypeError, String(mauvais));
    assert.throws(() => serialiserReglages({ ...DEFAUTS, modele_badge: 'A6' }), TypeError);
  });

  test('un fichier qui porte le modèle, relu puis réécrit avec un autre papier, le garde', async () => {
    const fs = disque('{"cadrages":[],"format":1,"modele_badge":"a6","papier":null}\n');
    const { reglages } = await lireReglages(fs, DOC);
    await ecrireReglages(fs, DOC, avecPapier(reglages, 'Lettre'));
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), '{"cadrages":[],"format":1,"modele_badge":"a6","papier":"Lettre"}\n');
  });
});

describe('réglages locaux : le pied TechnoLibre des badges (§ 8.5, § 11.4)', () => {
  test('pied_technolibre se lit tel quel ; absent, il vaut vrai sans que la clé s’ajoute aux réglages lus', async () => {
    for (const valeur of [true, false]) {
      const { reglages, avertissement } = await lireReglages(disque(`{"cadrages":[],"format":1,"papier":null,"pied_technolibre":${valeur}}\n`), DOC);
      assert.equal(avertissement, null);
      assert.deepEqual(reglages, { format: 1, papier: null, cadrages: [], pied_technolibre: valeur });
      assert.equal(piedTechnolibreDe(reglages), valeur);
    }
    const absent = await lireReglages(disque(), DOC);
    assert.equal(Object.hasOwn(absent.reglages, 'pied_technolibre'), false);
    assert.equal(piedTechnolibreDe(absent.reglages), true);
    assert.equal(piedTechnolibreDe((await lireReglages(disque('{"cadrages":[],"format":1,"papier":"A4"}\n'), DOC)).reglages), true);
  });

  test('une valeur qui n’est pas un booléen rend le fichier fautif : les défauts et REGLAGES_ILLISIBLES, raison FORME', async () => {
    for (const valeur of ['"true"', '1', '0', 'null', '[]', '{}']) {
      const fs = disque(`{"cadrages":[],"format":1,"papier":null,"pied_technolibre":${valeur}}\n`);
      assert.deepEqual(await lireReglages(fs, DOC), { reglages: DEFAUTS, avertissement: illisibles('FORME') }, valeur);
      assert.equal(fs.compteurs.ecritures, 0, valeur);
    }
  });

  test('avecPiedTechnolibre pose la clé sans toucher au reste ; un non-booléen lève TypeError ; le texte canonique la range à son rang', () => {
    const reglages = { ...DEFAUTS, papier: 'A4', modele_badge: 'a6', theme: 'sombre' };
    const sans = avecPiedTechnolibre(reglages, false);
    assert.deepEqual(sans, { ...reglages, pied_technolibre: false });
    assert.equal(Object.hasOwn(reglages, 'pied_technolibre'), false);
    assert.equal(serialiserReglages(sans), '{"cadrages":[],"format":1,"modele_badge":"a6","papier":"A4","pied_technolibre":false,"theme":"sombre"}\n');
    assert.deepEqual(avecPiedTechnolibre(sans, true), { ...reglages, pied_technolibre: true });
    for (const mauvais of ['true', 1, 0, null, undefined]) assert.throws(() => avecPiedTechnolibre(reglages, mauvais), TypeError, String(mauvais));
    assert.throws(() => serialiserReglages({ ...DEFAUTS, pied_technolibre: 'non' }), TypeError);
  });

  test('un fichier qui porte la case, relu puis réécrit avec un autre papier, la garde', async () => {
    const fs = disque('{"cadrages":[],"format":1,"papier":null,"pied_technolibre":false}\n');
    const { reglages } = await lireReglages(fs, DOC);
    await ecrireReglages(fs, DOC, avecPapier(reglages, 'Lettre'));
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), '{"cadrages":[],"format":1,"papier":"Lettre","pied_technolibre":false}\n');
  });
});

describe('réglages locaux : la case qui laisse en blanc le nom des doublons (§ 8.5, § 11.4)', () => {
  test('cacher_numero_doublon se lit tel quel ; absent, il vaut vrai sans que la clé s’ajoute aux réglages lus', async () => {
    for (const valeur of [true, false]) {
      const texte = `{"cacher_numero_doublon":${valeur},"cadrages":[],"format":1,"papier":null}\n`;
      const { reglages, avertissement } = await lireReglages(disque(texte), DOC);
      assert.equal(avertissement, null);
      assert.deepEqual(reglages, { format: 1, papier: null, cadrages: [], cacher_numero_doublon: valeur });
      assert.equal(cacherNumeroDe(reglages), valeur);
      assert.equal(serialiserReglages(reglages), texte);
    }
    const absent = await lireReglages(disque(), DOC);
    assert.equal(Object.hasOwn(absent.reglages, 'cacher_numero_doublon'), false);
    assert.equal(cacherNumeroDe(absent.reglages), true);
    // Une autre case touchée ne la touche pas.
    const autre = await lireReglages(disque('{"cadrages":[],"donnees_badge":{"identifiant":false},"format":1,"papier":null,"pied_technolibre":false}\n'), DOC);
    assert.equal(cacherNumeroDe(autre.reglages), true);
  });

  test('une valeur qui n’est pas un booléen rend le fichier fautif : les défauts et REGLAGES_ILLISIBLES, raison FORME', async () => {
    for (const valeur of ['"true"', '1', '0', 'null', '[]', '{}']) {
      const fs = disque(`{"cacher_numero_doublon":${valeur},"cadrages":[],"format":1,"papier":null}\n`);
      assert.deepEqual(await lireReglages(fs, DOC), { reglages: DEFAUTS, avertissement: illisibles('FORME') }, valeur);
      assert.equal(fs.compteurs.ecritures, 0, valeur);
    }
  });

  test('avecCacherNumero pose la clé sans toucher au reste ; un non-booléen lève TypeError ; le texte canonique la range à son rang', () => {
    const reglages = { ...DEFAUTS, papier: 'A4', pied_technolibre: false, theme: 'sombre' };
    const sans = avecCacherNumero(reglages, false);
    assert.deepEqual(sans, { ...reglages, cacher_numero_doublon: false });
    assert.equal(Object.hasOwn(reglages, 'cacher_numero_doublon'), false);
    assert.equal(
      serialiserReglages(sans),
      '{"cacher_numero_doublon":false,"cadrages":[],"format":1,"papier":"A4","pied_technolibre":false,"theme":"sombre"}\n',
    );
    assert.deepEqual(avecCacherNumero(sans, true), { ...reglages, cacher_numero_doublon: true });
    for (const mauvais of ['true', 1, 0, null, undefined]) assert.throws(() => avecCacherNumero(reglages, mauvais), TypeError, String(mauvais));
    assert.throws(() => serialiserReglages({ ...DEFAUTS, cacher_numero_doublon: 'non' }), TypeError);
  });

  test('un fichier qui porte la case, relu puis réécrit avec un autre papier, la garde', async () => {
    const fs = disque('{"cacher_numero_doublon":false,"cadrages":[],"format":1,"papier":null}\n');
    const { reglages } = await lireReglages(fs, DOC);
    await ecrireReglages(fs, DOC, avecPapier(reglages, 'Lettre'));
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), '{"cacher_numero_doublon":false,"cadrages":[],"format":1,"papier":"Lettre"}\n');
  });
});

describe('réglages locaux : la case qui met l’organisation en gros sur les badges (§ 8.5, § 11.4)', () => {
  test('organisation_en_gros se lit tel quel ; absent, il vaut vrai sans que la clé s’ajoute aux réglages lus', async () => {
    for (const valeur of [true, false]) {
      const texte = `{"cadrages":[],"format":1,"organisation_en_gros":${valeur},"papier":null}\n`;
      const { reglages, avertissement } = await lireReglages(disque(texte), DOC);
      assert.equal(avertissement, null);
      assert.deepEqual(reglages, { format: 1, papier: null, cadrages: [], organisation_en_gros: valeur });
      assert.equal(organisationEnGrosDe(reglages), valeur);
      assert.equal(serialiserReglages(reglages), texte);
    }
    const absent = await lireReglages(disque(), DOC);
    assert.equal(Object.hasOwn(absent.reglages, 'organisation_en_gros'), false);
    assert.equal(organisationEnGrosDe(absent.reglages), true);
    // Une autre case touchée ne la touche pas, celle de l'organisation comprise.
    const autre = await lireReglages(
      disque('{"cacher_numero_doublon":false,"cadrages":[],"donnees_badge":{"organisation":false},"format":1,"papier":null}\n'),
      DOC,
    );
    assert.equal(organisationEnGrosDe(autre.reglages), true);
  });

  test('une valeur qui n’est pas un booléen rend le fichier fautif : les défauts et REGLAGES_ILLISIBLES, raison FORME', async () => {
    for (const valeur of ['"true"', '1', '0', 'null', '[]', '{}']) {
      const fs = disque(`{"cadrages":[],"format":1,"organisation_en_gros":${valeur},"papier":null}\n`);
      assert.deepEqual(await lireReglages(fs, DOC), { reglages: DEFAUTS, avertissement: illisibles('FORME') }, valeur);
      assert.equal(fs.compteurs.ecritures, 0, valeur);
    }
  });

  test('avecOrganisationEnGros pose la clé sans toucher au reste ; un non-booléen lève TypeError ; le texte canonique la range à son rang', () => {
    const reglages = { ...DEFAUTS, papier: 'A4', cacher_numero_doublon: false, theme: 'sombre' };
    const sans = avecOrganisationEnGros(reglages, false);
    assert.deepEqual(sans, { ...reglages, organisation_en_gros: false });
    assert.equal(Object.hasOwn(reglages, 'organisation_en_gros'), false);
    assert.equal(
      serialiserReglages(sans),
      '{"cacher_numero_doublon":false,"cadrages":[],"format":1,"organisation_en_gros":false,"papier":"A4","theme":"sombre"}\n',
    );
    assert.deepEqual(avecOrganisationEnGros(sans, true), { ...reglages, organisation_en_gros: true });
    for (const mauvais of ['true', 1, 0, null, undefined]) {
      assert.throws(() => avecOrganisationEnGros(reglages, mauvais), TypeError, String(mauvais));
    }
    assert.throws(() => serialiserReglages({ ...DEFAUTS, organisation_en_gros: 'non' }), TypeError);
  });

  test('un fichier qui porte la case, relu puis réécrit avec un autre papier, la garde', async () => {
    const fs = disque('{"cadrages":[],"format":1,"organisation_en_gros":false,"papier":null}\n');
    const { reglages } = await lireReglages(fs, DOC);
    await ecrireReglages(fs, DOC, avecPapier(reglages, 'Lettre'));
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), '{"cadrages":[],"format":1,"organisation_en_gros":false,"papier":"Lettre"}\n');
  });
});

describe('réglages locaux : les colonnes de la liste des badges en CSV (§ 8.5, § 11.6)', () => {
  test('deux formes, une colonne par tour d’abord ; colonnes_liste_badges se lit tel quel ; absent, une colonne par tour, sans que la clé s’ajoute', async () => {
    assert.deepEqual(COLONNES_LISTE_BADGES, ['parTour', 'unique']);
    assert.ok(Object.isFrozen(COLONNES_LISTE_BADGES));
    for (const valeur of COLONNES_LISTE_BADGES) {
      const texte = `{"cadrages":[],"colonnes_liste_badges":"${valeur}","format":1,"papier":null}\n`;
      const { reglages, avertissement } = await lireReglages(disque(texte), DOC);
      assert.equal(avertissement, null);
      assert.deepEqual(reglages, { format: 1, papier: null, cadrages: [], colonnes_liste_badges: valeur });
      assert.equal(colonnesListeDe(reglages), valeur);
      assert.equal(serialiserReglages(reglages), texte);
    }
    const absent = await lireReglages(disque(), DOC);
    assert.equal(Object.hasOwn(absent.reglages, 'colonnes_liste_badges'), false);
    assert.equal(colonnesListeDe(absent.reglages), 'parTour');
  });

  test('une valeur hors des deux formes rend le fichier fautif : les défauts et REGLAGES_ILLISIBLES, raison FORME', async () => {
    for (const valeur of ['"par_tour"', '"Unique"', '"toString"', 'true', '1', 'null', '[]', '{}']) {
      const fs = disque(`{"cadrages":[],"colonnes_liste_badges":${valeur},"format":1,"papier":null}\n`);
      assert.deepEqual(await lireReglages(fs, DOC), { reglages: DEFAUTS, avertissement: illisibles('FORME') }, valeur);
      assert.equal(fs.compteurs.ecritures, 0, valeur);
    }
  });

  test('avecColonnesListe pose la clé sans toucher au reste ; une autre valeur lève TypeError ; le texte canonique la range à son rang', () => {
    const reglages = { ...DEFAUTS, papier: 'A4', cacher_numero_doublon: false, theme: 'sombre' };
    const unique = avecColonnesListe(reglages, 'unique');
    assert.deepEqual(unique, { ...reglages, colonnes_liste_badges: 'unique' });
    assert.equal(Object.hasOwn(reglages, 'colonnes_liste_badges'), false);
    assert.equal(
      serialiserReglages(unique),
      '{"cacher_numero_doublon":false,"cadrages":[],"colonnes_liste_badges":"unique","format":1,"papier":"A4","theme":"sombre"}\n',
    );
    assert.deepEqual(avecColonnesListe(unique, 'parTour'), { ...reglages, colonnes_liste_badges: 'parTour' });
    for (const mauvaise of ['par_tour', 'toString', true, null, undefined]) {
      assert.throws(() => avecColonnesListe(reglages, mauvaise), TypeError, String(mauvaise));
    }
    assert.throws(() => serialiserReglages({ ...DEFAUTS, colonnes_liste_badges: 'aucune' }), TypeError);
  });

  test('un fichier qui porte le choix, relu puis réécrit avec un autre papier, le garde', async () => {
    const fs = disque('{"cadrages":[],"colonnes_liste_badges":"unique","format":1,"papier":null}\n');
    const { reglages } = await lireReglages(fs, DOC);
    await ecrireReglages(fs, DOC, avecPapier(reglages, 'Lettre'));
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), '{"cadrages":[],"colonnes_liste_badges":"unique","format":1,"papier":"Lettre"}\n');
  });
});

describe('réglages locaux : les cases de ce que le badge imprime (§ 8.5, § 11.4)', () => {
  const TOUTES = { organisation: true, evenement: true, date: true, horodatage: true, identifiant: true };

  test('les cinq données, dans l’ordre des cases ; absentes, toutes cochées, sans que la clé s’ajoute aux réglages lus', async () => {
    assert.deepEqual(DONNEES_BADGE, ['organisation', 'evenement', 'date', 'horodatage', 'identifiant']);
    assert.ok(Object.isFrozen(DONNEES_BADGE));
    const absent = await lireReglages(disque(), DOC);
    assert.equal(Object.hasOwn(absent.reglages, 'donnees_badge'), false);
    assert.deepEqual(donneesBadgeDe(absent.reglages), TOUTES);
    assert.deepEqual(Object.keys(donneesBadgeDe(absent.reglages)), DONNEES_BADGE);
  });

  test('donnees_badge se lit tel quel ; une case absente de l’objet vaut cochée, une clé inconnue se garde', async () => {
    const texte = '{"cadrages":[],"donnees_badge":{"horodatage":false,"organisation":false,"zeta":3},"format":1,"papier":null}\n';
    const { reglages, avertissement } = await lireReglages(disque(texte), DOC);
    assert.equal(avertissement, null);
    assert.deepEqual(reglages.donnees_badge, { horodatage: false, organisation: false, zeta: 3 });
    assert.deepEqual(donneesBadgeDe(reglages), { ...TOUTES, organisation: false, horodatage: false });
    assert.equal(serialiserReglages(reglages), texte);
  });

  test('un objet fautif, ou une case connue qui n’est pas un booléen, rend le fichier fautif : les défauts et REGLAGES_ILLISIBLES, raison FORME', async () => {
    for (const valeur of ['true', 'null', '[]', '"non"', '{"evenement":"false"}', '{"identifiant":0}', '{"date":null}']) {
      const fs = disque(`{"cadrages":[],"donnees_badge":${valeur},"format":1,"papier":null}\n`);
      assert.deepEqual(await lireReglages(fs, DOC), { reglages: DEFAUTS, avertissement: illisibles('FORME') }, valeur);
      assert.equal(fs.compteurs.ecritures, 0, valeur);
    }
    assert.throws(() => serialiserReglages({ ...DEFAUTS, donnees_badge: { organisation: 1 } }), TypeError);
  });

  test('avecDonneeBadge pose une case sans toucher aux autres ni au reste ; une donnée inconnue ou un non-booléen lève TypeError ; le texte canonique range la clé à son rang', () => {
    const reglages = { ...DEFAUTS, papier: 'A4', pied_technolibre: false, theme: 'sombre' };
    const une = avecDonneeBadge(reglages, 'evenement', false);
    assert.deepEqual(une, { ...reglages, donnees_badge: { evenement: false } });
    assert.equal(Object.hasOwn(reglages, 'donnees_badge'), false);
    const deux = avecDonneeBadge(avecDonneeBadge(une, 'identifiant', false), 'evenement', true);
    assert.deepEqual(deux.donnees_badge, { evenement: true, identifiant: false });
    assert.deepEqual(une.donnees_badge, { evenement: false });
    assert.equal(
      serialiserReglages(deux),
      '{"cadrages":[],"donnees_badge":{"evenement":true,"identifiant":false},"format":1,"papier":"A4","pied_technolibre":false,"theme":"sombre"}\n',
    );
    const inconnue = avecDonneeBadge({ ...DEFAUTS, donnees_badge: { zeta: 1 } }, 'date', false);
    assert.deepEqual(inconnue.donnees_badge, { zeta: 1, date: false });
    for (const mauvaise of ['nom', 'tours', 'toString', '__proto__', '', null]) {
      assert.throws(() => avecDonneeBadge(reglages, mauvaise, false), TypeError, String(mauvaise));
    }
    for (const mauvais of ['false', 0, 1, null, undefined]) assert.throws(() => avecDonneeBadge(reglages, 'date', mauvais), TypeError, String(mauvais));
  });

  test('un fichier qui porte les cases, relu puis réécrit avec un autre papier, les garde', async () => {
    const fs = disque('{"cadrages":[],"donnees_badge":{"date":false},"format":1,"papier":null}\n');
    const { reglages } = await lireReglages(fs, DOC);
    await ecrireReglages(fs, DOC, avecPapier(reglages, 'Lettre'));
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), '{"cadrages":[],"donnees_badge":{"date":false},"format":1,"papier":"Lettre"}\n');
  });
});

describe('réglages locaux : le texte du pied TechnoLibre (§ 8.5, § 11.4)', () => {
  test('normaliserTextePied : NFC, blancs de bord retirés, sauts de ligne et tabulations ramenés à une espace, espaces répétées réduites ; le reste tel quel', () => {
    assert.equal(normaliserTextePied('Caf\u{65}\u{301} des Loutres'), 'Caf\u{E9} des Loutres');
    assert.equal(normaliserTextePied('  \n Atelier des Hérons\t '), 'Atelier des Hérons');
    assert.equal(normaliserTextePied('Atelier\r\ndes\n\nHérons\u{2028}du lac'), 'Atelier des Hérons du lac');
    assert.equal(normaliserTextePied('Atelier   des \t Hérons'), 'Atelier des Hérons');
    assert.equal(normaliserTextePied('Atelier\u{A0}: les Hérons'), 'Atelier\u{A0}: les Hérons');
    assert.equal(normaliserTextePied(''), '');
    assert.equal(normaliserTextePied(' \n\t '), '');
    for (const mauvais of [null, undefined, 3, ['a'], {}]) assert.throws(() => normaliserTextePied(mauvais), TypeError, String(mauvais));
  });

  test('normaliserTextePied : l’insécable et les espaces typographiques restent entre deux mots, et partent aux deux bords comme tout blanc', () => {
    assert.equal(normaliserTextePied('\u{A0}Atelier des Hérons\u{A0}'), 'Atelier des Hérons');
    assert.equal(normaliserTextePied('\u{202F}\u{2009} Atelier\u{A0}des Hérons \u{202F}'), 'Atelier\u{A0}des Hérons');
    assert.equal(normaliserTextePied('\u{A0}\u{202F}'), '');
    assert.equal(normaliserTextePied('Atelier\u{202F}des\u{2009}Hérons'), 'Atelier\u{202F}des\u{2009}Hérons');
  });

  test('texte_pied_technolibre se lit normalisé ; absent, null, sans que la clé s’ajoute aux réglages lus', async () => {
    const texte = '{"cadrages":[],"format":1,"papier":null,"texte_pied_technolibre":"Atelier des Hérons"}\n';
    const { reglages, avertissement } = await lireReglages(disque(texte), DOC);
    assert.equal(avertissement, null);
    assert.equal(textePiedTechnolibreDe(reglages), 'Atelier des Hérons');
    assert.equal(serialiserReglages(reglages), texte);
    const brut = await lireReglages(disque('{"cadrages":[],"format":1,"papier":null,"texte_pied_technolibre":" Atelier\\ndes Hérons "}\n'), DOC);
    assert.equal(brut.avertissement, null);
    assert.equal(textePiedTechnolibreDe(brut.reglages), 'Atelier des Hérons');
    const vide = await lireReglages(disque('{"cadrages":[],"format":1,"papier":null,"texte_pied_technolibre":""}\n'), DOC);
    assert.equal(textePiedTechnolibreDe(vide.reglages), '');
    const absent = await lireReglages(disque(), DOC);
    assert.equal(Object.hasOwn(absent.reglages, 'texte_pied_technolibre'), false);
    assert.equal(textePiedTechnolibreDe(absent.reglages), null);
  });

  test('une valeur qui n’est pas une chaîne rend le fichier fautif : les défauts et REGLAGES_ILLISIBLES, raison FORME', async () => {
    for (const valeur of ['null', 'true', '3', '[]', '{}', '["Atelier"]']) {
      const fs = disque(`{"cadrages":[],"format":1,"papier":null,"texte_pied_technolibre":${valeur}}\n`);
      assert.deepEqual(await lireReglages(fs, DOC), { reglages: DEFAUTS, avertissement: illisibles('FORME') }, valeur);
      assert.equal(fs.compteurs.ecritures, 0, valeur);
    }
    assert.throws(() => serialiserReglages({ ...DEFAUTS, texte_pied_technolibre: 3 }), TypeError);
  });

  test('avecTextePiedTechnolibre pose le texte normalisé sans toucher au reste ; null retire la clé ; une autre valeur lève TypeError ; le texte canonique range la clé à son rang', () => {
    const reglages = { ...DEFAUTS, papier: 'A4', pied_technolibre: true, theme: 'sombre' };
    const avec = avecTextePiedTechnolibre(reglages, '  Atelier\ndes Hérons ');
    assert.deepEqual(avec, { ...reglages, texte_pied_technolibre: 'Atelier des Hérons' });
    assert.equal(Object.hasOwn(reglages, 'texte_pied_technolibre'), false);
    assert.equal(
      serialiserReglages(avec),
      '{"cadrages":[],"format":1,"papier":"A4","pied_technolibre":true,"texte_pied_technolibre":"Atelier des Hérons","theme":"sombre"}\n',
    );
    assert.deepEqual(avecTextePiedTechnolibre(avec, ''), { ...reglages, texte_pied_technolibre: '' });
    const sans = avecTextePiedTechnolibre(avec, null);
    assert.deepEqual(sans, reglages);
    assert.equal(Object.hasOwn(sans, 'texte_pied_technolibre'), false);
    assert.deepEqual(avecTextePiedTechnolibre(reglages, null), reglages);
    for (const mauvais of [undefined, 3, true, ['a'], {}]) assert.throws(() => avecTextePiedTechnolibre(reglages, mauvais), TypeError, String(mauvais));
  });

  test('un fichier qui porte le texte, relu puis réécrit avec un autre papier, le garde', async () => {
    const fs = disque('{"cadrages":[],"format":1,"papier":null,"texte_pied_technolibre":"Atelier des Hérons"}\n');
    const { reglages } = await lireReglages(fs, DOC);
    await ecrireReglages(fs, DOC, avecPapier(reglages, 'Lettre'));
    assert.equal(fs.contenu('documents', FICHIER_REGLAGES), '{"cadrages":[],"format":1,"papier":"Lettre","texte_pied_technolibre":"Atelier des Hérons"}\n');
  });
});
