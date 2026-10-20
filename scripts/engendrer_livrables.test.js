// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du script qui engendre les fichiers livrés (§ 10.3, § 15.5) : la
// charge de chaque démonstration — la configuration du catalogue,
// l'événement demo:<clé>, la salle en grille, les animateurs au siège 1 —,
// le fichier d'état qu'il en écrit, la variante windows-1252 du CSV des cas
// limites, et la ligne de commande, qui écrit dans le dossier donné et nulle
// part ailleurs, et réécrit les mêmes octets quand on la relance. « Nulle
// part ailleurs » s'éprouve sur une copie du projet, photographiée avant et
// après chaque lancement : tout fichier écrit hors des sept livrables s'y
// voit, le CSV des cas limites, que le script lit sans l'écrire, comme les
// autres. Le contenu des fichiers livrés eux-mêmes s'éprouve à côté d'eux,
// dans src/demo/livrees.test.js et src/demo/livrees.long.test.js.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exporterParticipants } from '../src/csv/export.js';
import { decouper } from '../src/csv/lecture.js';
import { CATALOGUE } from '../src/demo/catalogue.js';
import { serialiser } from '../src/stockage/canonique.js';
import { GENERATION_PAR_DEFAUT, analyser, configurationDepuisCharge } from '../src/stockage/document.js';
import { VERSION } from '../src/version.genere.js';
import { describe, test } from '../test/lanceur.js';
import { versionVoisine } from '../test/version_voisine.js';
import {
  chargeDeDemonstration,
  enWindows1252,
  livrables,
  texteDeDemonstration,
  varianteWindows1252,
} from './engendrer_livrables.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = fileURLToPath(new URL('./engendrer_livrables.js', import.meta.url));
const CAS_LIMITES = join(RACINE, 'exemples', 'participants_cas_limites.csv');

// Les sept livrables que le script écrit, chemins relatifs à la racine, dans
// l'ordre où il les écrit : un fichier d'état par démonstration du
// catalogue, les deux CSV de démonstration, puis la variante windows-1252 du
// CSV des cas limites (§ 10.3).
const LIVRABLES = [
  ...CATALOGUE.map(({ cle }) => `src/demo/livrees/${cle}.gtt.json`),
  'exemples/participants_demo_petite.csv',
  'exemples/participants_demo_grande.csv',
  'exemples/participants_cas_limites_cp1252.csv',
];

// Ce que le script lit, chemins relatifs à la racine du projet : package.json,
// qui déclare les modules ES, le script, le code de src/ qu'il importe et les
// CSV de exemples/, celui des cas limites compris, qu'il lit sans l'écrire.
const COPIES = ['package.json', 'scripts/engendrer_livrables.js', 'src', 'exemples'];

// Date de modification, en secondes, de chaque fichier copié : un instant
// ancien. Toute écriture ultérieure la déplace, d'octets identiques comprise,
// quelle que soit la finesse de l'horloge du système de fichiers.
const DATE_ANCIENNE = 1_000_000_000;

const MARQUE = '\u{FEFF}';

// Entrée du catalogue de clé donnée.
const entreeDe = (cle) => CATALOGUE.find((entree) => entree.cle === cle);

// Entrée d'essai : la petite démonstration, sa configuration retouchée par
// retoucher, qui reçoit une copie et la rend.
const entreeRetouchee = (retoucher) => ({
  cle: 'essai',
  nom: 'Essai',
  construire: () => retoucher(entreeDe('petite').construire()),
});

const parTable = (a, b) => a.table - b.table;

// Dossier temporaire neuf, passé à faire, puis effacé ; rend ce que rend
// faire.
function avecDossier(faire) {
  const dossier = mkdtempSync(join(tmpdir(), 'livrables-'));
  try {
    return faire(dossier);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

// Fichiers d'un dossier, à toute profondeur, en chemins relatifs séparés par
// « / », triés.
const fichiersSous = (dossier) =>
  readdirSync(dossier, { recursive: true, withFileTypes: true })
    .filter((entree) => entree.isFile())
    .map((entree) => relative(dossier, join(entree.parentPath, entree.name)).split(sep).join('/'))
    .sort();

// Instantané d'un dossier : la taille et la date de modification, en
// nanosecondes, de chaque fichier à toute profondeur, sous son chemin relatif
// séparé par « / ».
const instantane = (dossier) =>
  new Map(
    fichiersSous(dossier).map((chemin) => {
      const { size, mtimeNs } = statSync(join(dossier, chemin), { bigint: true });
      return [chemin, `${size} octets, modifié à ${mtimeNs} ns`];
    }),
  );

// Chemins que deux instantanés distinguent, triés : un fichier créé, retiré,
// ou dont la taille ou la date de modification change. Un fichier réécrit avec
// les mêmes octets en fait partie, sa date de modification avance.
const differences = (avant, apres) =>
  [...new Set([...avant.keys(), ...apres.keys()])].filter((chemin) => avant.get(chemin) !== apres.get(chemin)).sort();

// Lance le script de chemin donné depuis le répertoire cwd ; rend son statut
// et ses sorties.
const lancerScript = (script, cwd, ...arguments_) =>
  spawnSync(process.execPath, [script, ...arguments_], { cwd, encoding: 'utf8' });

// Lance le script du projet depuis le répertoire cwd.
const lancer = (cwd, ...arguments_) => lancerScript(SCRIPT, cwd, ...arguments_);

// Dossier temporaire neuf qui porte, sous projet/, une copie de ce que le
// script lit, chaque fichier daté de DATE_ANCIENNE. Passe à faire ce dossier
// et lancerCopie, qui lance depuis lui le script copié ; efface le dossier ;
// rend ce que rend faire. Le script y est à la racine de son arbre, comme
// dans le projet : un fichier qu'il écrit hors de la destination tombe dans
// ce dossier, copie du projet ou répertoire courant, jamais dans le projet.
function avecProjetCopie(faire) {
  return avecDossier((dossier) => {
    for (const chemin of COPIES) {
      cpSync(join(RACINE, chemin), join(dossier, 'projet', chemin), { recursive: true });
    }
    for (const chemin of fichiersSous(dossier)) utimesSync(join(dossier, chemin), DATE_ANCIENNE, DATE_ANCIENNE);
    const copie = join(dossier, 'projet', 'scripts', 'engendrer_livrables.js');
    return faire(dossier, (...arguments_) => lancerScript(copie, dossier, ...arguments_));
  });
}

const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe("engendrer_livrables : la charge d'une démonstration (§ 15)", () => {
  test('porte la configuration du catalogue : participants, capacités, tours, réservations, contraintes', () => {
    for (const entree of CATALOGUE) {
      const configuration = entree.construire();
      const charge = chargeDeDemonstration(entree);
      const lue = configurationDepuisCharge(charge);
      assert.deepEqual(
        { ...lue, reservations: [...lue.reservations].sort(parTable) },
        {
          ...configuration,
          participants: configuration.participants.map(({ id, nom, appartenance }) => ({
            id,
            nom,
            appartenance,
            exclu: false,
          })),
          reservations: [...configuration.reservations].sort(parTable),
        },
        entree.cle,
      );
      assert.deepEqual(
        charge.participants.map(({ prenom }) => prenom),
        configuration.participants.map(({ prenom }) => prenom),
        entree.cle,
      );
    }
  });

  test("l'événement demo:<clé> : nom du catalogue, sans date, en brouillon, sans filiation, les tours et le défaut de sièges de la configuration", () => {
    // Sièges par défaut des quatre démonstrations (§ 15.1, § 15.3).
    const defauts = new Map([['grande', 8], ['grande-sans-exception', 8], ['petite', 3], ['petite-conflit', 3]]);
    assert.deepEqual(CATALOGUE.map(({ cle }) => cle).sort(), [...defauts.keys()].sort());
    for (const entree of CATALOGUE) {
      assert.deepEqual(
        chargeDeDemonstration(entree).evenement,
        {
          id: `demo:${entree.cle}`,
          nom: entree.nom,
          date: null,
          siegesParDefaut: defauts.get(entree.cle),
          tours: entree.construire().tours,
          unite: 'cm',
          etat: 'brouillon',
          filiation: null,
        },
        entree.cle,
      );
    }
  });

  test('les réglages : les contraintes de la configuration, une à une, les sièges non attribués, la génération par défaut', () => {
    for (const entree of CATALOGUE) {
      assert.deepEqual(
        chargeDeDemonstration(entree).reglages,
        { ...entree.construire().contraintes, attribuerSieges: false, generation: { ...GENERATION_PAR_DEFAUT } },
        entree.cle,
      );
    }
    const contraintes = {
      separerAppartenances: false,
      nouveauxVoisins: true,
      nouvelleTable: false,
      varierAppartenances: true,
    };
    const entree = entreeRetouchee((configuration) => ({ ...configuration, contraintes }));
    assert.deepEqual(chargeDeDemonstration(entree).reglages, {
      ...contraintes,
      attribuerSieges: false,
      generation: { ...GENERATION_PAR_DEFAUT },
    });
  });

  test('les tables : rondes, en grille rangée par rangée, la dernière rangée seule incomplète ; rangées à 300 cm, colonnes assez écartées pour le bloc de noms', () => {
    // Écart des colonnes : 2 × l'emprise de la plus grande table, deux écarts
    // de liste (36 cm) et la largeur du bloc de noms (500 cm), arrondi au cm
    // supérieur — petite, 3 places, emprise 79 : 158 + 72 + 500 = 730 ;
    // grande, 8 places, emprise 120,39 : ⌈240,79 + 72 + 500⌉ = 813.
    assert.deepEqual(chargeDeDemonstration(entreeDe('petite')).tables, [
      { id: 1, numero: 1, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } },
      { id: 2, numero: 2, sieges: null, forme: 'ronde', position: { x: 730, y: 0 } },
      { id: 3, numero: 3, sieges: null, forme: 'ronde', position: { x: 0, y: 300 } },
      { id: 4, numero: 4, sieges: null, forme: 'ronde', position: { x: 730, y: 300 } },
    ]);
    // 33 tables : six colonnes, cinq rangées pleines, puis trois tables.
    const { tables } = chargeDeDemonstration(entreeDe('grande'));
    const positions = tables.map(({ position: { x, y } }) => [x, y]);
    assert.deepEqual(positions.slice(0, 7), [[0, 0], [813, 0], [1626, 0], [2439, 0], [3252, 0], [4065, 0], [0, 300]]);
    assert.deepEqual(positions.slice(-4), [[4065, 1200], [0, 1500], [813, 1500], [1626, 1500]]);
    assert.equal(new Set(positions.map(String)).size, 33);
    assert.ok(tables.every(({ forme }) => forme === 'ronde'));
    assert.deepEqual(tables.map(({ id, numero }) => [id, numero]), positions.map((_, rang) => [rang + 1, rang + 1]));
  });

  test("les sièges : le défaut est la capacité la plus fréquente, la plus grande à égalité ; toute autre capacité surcharge sa table (§ 6.1)", () => {
    const surcharges = (charge) =>
      charge.tables.filter(({ sieges }) => sieges !== null).map(({ numero, sieges }) => [numero, sieges]);
    assert.deepEqual(surcharges(chargeDeDemonstration(entreeDe('grande'))), [[30, 7], [31, 7], [32, 7], [33, 7]]);
    for (const cle of ['grande-sans-exception', 'petite', 'petite-conflit']) {
      assert.deepEqual(surcharges(chargeDeDemonstration(entreeDe(cle))), [], cle);
    }
    const capacites = [6, 9, 6, 9];
    const egalite = chargeDeDemonstration(
      entreeRetouchee((configuration) => ({
        ...configuration,
        tables: configuration.tables.map((table, rang) => ({ ...table, capacite: capacites[rang] })),
      })),
    );
    assert.equal(egalite.evenement.siegesParDefaut, 9);
    assert.deepEqual(surcharges(egalite), [[1, 6], [3, 6]]);
  });

  test("grandes : chaque animateur réservé au siège 1 de sa table pour tous les tours, ce siège titré « animation », le titre pressenti porté par lui seul ; petites : ni réservation ni titre", () => {
    for (const cle of ['grande', 'grande-sans-exception']) {
      const entree = entreeDe(cle);
      const animateurs = entree.construire().reservations;
      const charge = chargeDeDemonstration(entree);
      assert.equal(animateurs.length, 33, cle);
      assert.deepEqual(
        [...charge.reservations].sort(parTable),
        animateurs
          .map(({ participant, table }) => ({ participant, table, siege: 1, portee: 'tous', tour: null }))
          .sort(parTable),
        cle,
      );
      assert.deepEqual(
        [...charge.titres].sort(parTable),
        charge.tables.map(({ id }) => ({ table: id, siege: 1, libelle: 'animation' })),
        cle,
      );
      assert.deepEqual(
        charge.participants
          .filter(({ titrePressenti }) => titrePressenti !== null)
          .map(({ id, titrePressenti }) => [id, titrePressenti]),
        animateurs.map(({ participant }) => [participant, 'animation']).sort((a, b) => a[0] - b[0]),
        cle,
      );
    }
    for (const cle of ['petite', 'petite-conflit']) {
      const charge = chargeDeDemonstration(entreeDe(cle));
      assert.deepEqual([charge.reservations, charge.titres], [[], []], cle);
      assert.ok(charge.participants.every(({ titrePressenti }) => titrePressenti === null), cle);
    }
  });

  test("ni proposition ni retenu, personne d'exclu, ni courriel ni notes ; les compteurs dépassent chaque identifiant", () => {
    for (const entree of CATALOGUE) {
      const charge = chargeDeDemonstration(entree);
      assert.deepEqual([charge.propositions, charge.retenu], [[], null], entree.cle);
      assert.ok(
        charge.participants.every(({ exclu, courriel, notes }) => exclu === false && courriel === null && notes === null),
        entree.cle,
      );
      const plusGrand = (liste) => Math.max(...liste.map(({ id }) => id));
      assert.deepEqual(
        charge.prochainsIds,
        { participant: plusGrand(charge.participants) + 1, table: plusGrand(charge.tables) + 1, proposition: 1 },
        entree.cle,
      );
    }
  });

  test("refuse une configuration qu'il ne sait pas écrire : deux réservations à une table, une réservation d'un seul tour", () => {
    const avecReservations = (reservations) =>
      entreeRetouchee((configuration) => ({ ...configuration, reservations }));
    assert.throws(
      () =>
        chargeDeDemonstration(
          avecReservations([
            { participant: 1, table: 2, portee: 'tous' },
            { participant: 5, table: 2, portee: 'tous' },
          ]),
        ),
      /essai.*table 2/,
    );
    assert.throws(
      () => chargeDeDemonstration(avecReservations([{ participant: 1, table: 3, portee: 'tour', tour: 2 }])),
      /essai.*table 3/,
    );
  });
});

describe("engendrer_livrables : le fichier d'état écrit (§ 8.8, § 18.6)", () => {
  test('format 2, révision 1, la version de la construction qui écrit, la forme canonique ; UTF-8 sans marque, des LF seules, une fin de ligne finale', () => {
    for (const entree of CATALOGUE) {
      const texte = texteDeDemonstration(entree);
      const lu = analyser(texte);
      assert.deepEqual(
        [lu.entete.format, lu.entete.produitVersion, lu.entete.revision],
        [2, VERSION.affichee, 1],
        entree.cle,
      );
      assert.equal(serialiser(lu.charge, lu.entete), texte, entree.cle);
      assert.ok(!texte.startsWith(MARQUE) && !texte.includes('\r'), entree.cle);
      assert.ok(texte.endsWith('}\n') && !texte.endsWith('\n\n'), entree.cle);
    }
  });

  test("une autre construction n'écrit qu'un autre en-tête : la charge est la même", () => {
    const voisine = versionVoisine(VERSION.affichee);
    for (const entree of CATALOGUE) {
      const ici = analyser(texteDeDemonstration(entree));
      const ailleurs = analyser(texteDeDemonstration(entree, { produitVersion: voisine }));
      assert.equal(ailleurs.entete.produitVersion, voisine, entree.cle);
      assert.deepEqual(ailleurs.charge, ici.charge, entree.cle);
    }
  });
});

describe('engendrer_livrables : la variante windows-1252 (§ 10.3)', () => {
  test('enWindows1252 : un octet par caractère, les signes propres à windows-1252 compris', () => {
    // Octets de la table publiée de windows-1252.
    assert.deepEqual(
      [...enWindows1252('aé€\u{2019}œŸ\u{A0}ÿ')],
      [0x61, 0xe9, 0x80, 0x92, 0x9c, 0x9f, 0xa0, 0xff],
    );
    const decodeur = new TextDecoder('windows-1252');
    for (let octet = 0; octet < 256; octet += 1) {
      assert.deepEqual([...enWindows1252(decodeur.decode(Uint8Array.of(octet)))], [octet], `octet ${octet}`);
    }
  });

  test('enWindows1252 refuse un caractère que windows-1252 ne porte pas, et nomme son point de code et son rang', () => {
    assert.throws(
      () => enWindows1252('noté ✓'),
      (erreur) => erreur instanceof RangeError && /U\+2713/.test(erreur.message) && /rang 5/.test(erreur.message),
    );
    assert.throws(() => enWindows1252('\u{1D11E}'), /U\+1D11E/);
  });

  test('varianteWindows1252 : les mêmes enregistrements, séparés par des virgules, en windows-1252 sans marque', () => {
    const source = [
      'Nom;Prénom;Notes',
      'Lanterneau;Basile;"chœur; l\u{2019}Anse, nord"',
      'Coudraie;Apolline;"deux\nlignes"',
      'Brunœil;;sans prénom',
    ];
    const octets = new TextEncoder().encode(`${MARQUE}${source.join('\r\n')}\r\n`);
    const variante = varianteWindows1252(octets);
    assert.equal(
      new TextDecoder('windows-1252').decode(variante),
      [
        'Nom,Prénom,Notes',
        'Lanterneau,Basile,"chœur; l\u{2019}Anse, nord"',
        'Coudraie,Apolline,"deux\nlignes"',
        'Brunœil,,sans prénom',
        '',
      ].join('\r\n'),
    );
    assert.deepEqual([...variante.subarray(0, 3)], [...enWindows1252('Nom')]);
    assert.deepEqual(
      decouper(new TextDecoder('windows-1252').decode(variante), ',').enregistrements,
      decouper(new TextDecoder().decode(octets), ';').enregistrements,
    );
  });

  test('varianteWindows1252 refuse un fichier dont un guillemet reste ouvert', () => {
    const octets = new TextEncoder().encode(`${MARQUE}Nom;Notes\r\nLanterneau;"sans fin\r\n`);
    assert.throws(() => varianteWindows1252(octets), /guillemet/);
  });
});

describe('engendrer_livrables : les livrables (§ 10.3, § 15.5)', () => {
  test("les sept fichiers, dans l'ordre ; les CSV de démonstration exportent les fichiers d'état écrits, la variante dérive des cas limites", () => {
    const casLimites = readFileSync(CAS_LIMITES);
    const fichiers = livrables({ casLimites });
    assert.deepEqual(
      fichiers.map(({ chemin }) => chemin),
      LIVRABLES,
    );
    const octetsDe = new Map(fichiers.map(({ chemin, octets }) => [chemin, octets]));
    for (const entree of CATALOGUE) {
      assert.equal(
        new TextDecoder().decode(octetsDe.get(`src/demo/livrees/${entree.cle}.gtt.json`)),
        texteDeDemonstration(entree),
        entree.cle,
      );
    }
    for (const cle of ['petite', 'grande']) {
      const etat = new TextDecoder().decode(octetsDe.get(`src/demo/livrees/${cle}.gtt.json`));
      assert.deepEqual(
        octetsDe.get(`exemples/participants_demo_${cle}.csv`),
        exporterParticipants(analyser(etat).charge.participants),
        cle,
      );
    }
    assert.deepEqual(octetsDe.get('exemples/participants_cas_limites_cp1252.csv'), varianteWindows1252(casLimites));
  });
});

describe('engendrer_livrables : la ligne de commande', () => {
  test('écrit les sept livrables sous le dossier donné, relatif au répertoire courant, et rien ailleurs, au premier lancement comme au suivant', () =>
    avecProjetCopie((dossier, lancerCopie) => {
      // Le dossier entier, copie du projet comprise, est photographié avant et
      // après chaque lancement : seuls les sept livrables, sous sortie/, y
      // apparaissent. Le CSV des cas limites écrit à la main, tout autre
      // fichier de la copie et le répertoire courant doivent y rester tels
      // quels.
      const sept = LIVRABLES.map((chemin) => `sortie/${chemin}`).sort();
      const avant = instantane(dossier);
      assert.ok(avant.has('projet/exemples/participants_cas_limites.csv'), 'la copie porte le CSV des cas limites');
      const premier = lancerCopie('sortie');
      assert.equal(premier.status, 0, premier.stderr);
      const apres = instantane(dossier);
      assert.deepEqual(differences(avant, apres), sept, "le premier lancement n'écrit pas exactement les sept livrables");
      const attendus = livrables({ casLimites: readFileSync(CAS_LIMITES) });
      for (const { chemin, octets } of attendus) {
        assert.deepEqual(new Uint8Array(readFileSync(join(dossier, 'sortie', chemin))), octets, chemin);
        assert.match(premier.stdout, new RegExp(`^ *créé +${echapper(chemin)} `, 'm'), chemin);
      }
      // Relancé, le script ne touche rien hors des sept livrables, qu'il
      // réécrit sans en changer un octet : leurs dates peuvent avancer, leurs
      // octets non.
      const second = lancerCopie('sortie');
      assert.equal(second.status, 0, second.stderr);
      assert.deepEqual(
        differences(apres, instantane(dossier)).filter((chemin) => !sept.includes(chemin)),
        [],
        'le lancement suivant écrit autre chose que les sept livrables',
      );
      for (const { chemin, octets } of attendus) {
        assert.deepEqual(new Uint8Array(readFileSync(join(dossier, 'sortie', chemin))), octets, chemin);
      }
    }));

  test('relancé, il réécrit les mêmes octets, et le dit', () =>
    avecDossier((dossier) => {
      const premier = lancer(dossier, '.');
      assert.equal(premier.status, 0, premier.stderr);
      const octets = LIVRABLES.map((chemin) => readFileSync(join(dossier, chemin)));
      const second = lancer(dossier, dossier);
      assert.equal(second.status, 0, second.stderr);
      LIVRABLES.forEach((chemin, rang) => {
        assert.deepEqual(readFileSync(join(dossier, chemin)), octets[rang], chemin);
        assert.match(second.stdout, new RegExp(`^ *inchangé +${echapper(chemin)} `, 'm'), chemin);
      });
    }));

  test("une destination qui ne s'écrit pas sort en 1 en nommant la cause", () =>
    avecDossier((dossier) => {
      writeFileSync(join(dossier, 'occupe'), 'un fichier, pas un dossier\n');
      const resultat = lancer(dossier, 'occupe');
      assert.equal(resultat.status, 1, resultat.stdout);
      assert.match(resultat.stderr, /^Livrables : .*occupe/m);
      assert.deepEqual(fichiersSous(dossier), ['occupe']);
    }));

  test("un argument de trop, ou une option, sort en 2 en rappelant l'usage, sans rien écrire", () =>
    avecDossier((dossier) => {
      for (const arguments_ of [['a', 'b'], ['--aide']]) {
        const resultat = lancer(dossier, ...arguments_);
        assert.equal(resultat.status, 2, arguments_.join(' '));
        assert.match(resultat.stderr, /usage : node scripts\/engendrer_livrables\.js \[destination\]/);
      }
      assert.deepEqual(fichiersSous(dossier), []);
    }));
});
