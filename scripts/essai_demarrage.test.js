// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La police que l'essai relève dans la page chargée sous file:// (§ 19.4) :
// les deux faces de Noto Sans chargées, le corps du document en Noto Sans,
// et la chaîne témoin à la longueur des avances, dans la tolérance ; chaque
// écart se nomme.
//
// L'environnement où l'essai de démarrage lance la coquille (§ 8.6) : trois
// dossiers distincts sous la racine de l'essai, aucun sous un autre ; le
// lanceur portable publie exe, le poste a home pour dossier personnel et
// temp pour dossier temporaire, et la configuration XDG du poste réel n'y
// entre pas. Le module se charge sans rien lancer : l'essai ne part que
// lorsque node l'exécute.
//
// L'impression de l'aperçu par la coquille (§ 11.7) : une page du PDF par
// feuille de l'aperçu, chacune aux dimensions de la sienne à la tolérance
// près ; chaque écart se nomme.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decrireSysteme } from '../electron/fichiers.js';
import { estSous } from '../src/stockage/dossier_travail.js';
import { describe, test } from '../test/lanceur.js';
import {
  donneesApplicativesSurExe,
  dossiersDEssai,
  environnementDEssai,
  estLanceDirectement,
  fautesDImpression,
  fautesDePolice,
} from './essai_demarrage.js';

const RACINE_ESSAI = join('/', 'racine-essai', 'gtt-essai-demarrage-x');

// Vrai quand b est a ou se trouve sous a.
const sous = (a, b) => {
  const chemin = relative(a, b);
  return chemin === '' || (!chemin.startsWith('..') && !isAbsolute(chemin));
};

describe('essai de démarrage : dossiers et environnement (§ 8.6)', () => {
  test('trois dossiers distincts sous la racine, aucun sous un autre', () => {
    const dossiers = dossiersDEssai(RACINE_ESSAI);
    const noms = ['exe', 'home', 'temp'];
    assert.deepEqual(Object.keys(dossiers).sort(), noms);
    const chemins = noms.map((nom) => dossiers[nom]);
    assert.equal(chemins.length, 3);
    for (const chemin of chemins) assert.ok(sous(RACINE_ESSAI, chemin) && chemin !== RACINE_ESSAI, chemin);
    for (const a of chemins) {
      for (const b of chemins) if (a !== b) assert.ok(!sous(a, b), `${b} sous ${a}`);
    }
    assert.equal(new Set(chemins).size, 3);
  });

  test('exe publié, home et temp posés, XDG_CONFIG_HOME retiré, le reste gardé', () => {
    const dossiers = dossiersDEssai(RACINE_ESSAI);
    const poste = Object.freeze({
      HOME: join('/', 'maison-originale'),
      XDG_CONFIG_HOME: join('/', 'maison-originale', 'configuration'),
      TMPDIR: join('/', 'temporaire-du-poste'),
      PATH: join('/', 'outils'),
      LANG: 'fr_CA.UTF-8',
    });
    const env = environnementDEssai(poste, dossiers);
    assert.equal(env.PORTABLE_EXECUTABLE_DIR, dossiers.exe);
    assert.equal(env.HOME, dossiers.home);
    assert.equal(env.TMPDIR, dossiers.temp);
    assert.equal(env.TEMP, dossiers.temp);
    assert.equal(env.TMP, dossiers.temp);
    assert.ok(!Object.hasOwn(env, 'XDG_CONFIG_HOME'));
    assert.equal(env.PATH, poste.PATH);
    assert.equal(env.LANG, poste.LANG);
    // L'environnement du poste reste tel quel.
    assert.equal(poste.HOME, join('/', 'maison-originale'));
  });

  test('sous X11 sans XAUTHORITY, le fichier d’autorisation reste celui du dossier personnel réel', () => {
    const dossiers = dossiersDEssai(RACINE_ESSAI);
    const maison = join('/', 'maison-originale');
    const avecX = environnementDEssai({ HOME: maison, DISPLAY: ':9' }, dossiers);
    assert.equal(avecX.XAUTHORITY, join(maison, '.Xauthority'));
    const pose = join('/', 'autorisation-posee');
    assert.equal(environnementDEssai({ HOME: maison, DISPLAY: ':9', XAUTHORITY: pose }, dossiers).XAUTHORITY, pose);
    assert.ok(!Object.hasOwn(environnementDEssai({ HOME: maison }, dossiers), 'XAUTHORITY'));
  });

  test('sous Windows, un temporaire du poste rangé sous LOCALAPPDATA ne met pas exe sous les données applicatives', () => {
    const W = path.win32;
    const profil = 'C:\\Users\\profil-essai';
    const local = W.join(profil, 'AppData', 'Local');
    const poste = Object.freeze({
      USERPROFILE: profil,
      APPDATA: W.join(profil, 'AppData', 'Roaming'),
      LOCALAPPDATA: local,
      TEMP: W.join(local, 'Temp'),
      TMP: W.join(local, 'Temp'),
    });
    const dossiers = dossiersDEssai(W.join(poste.TEMP, 'gtt-essai-demarrage-x'), W);
    const env = environnementDEssai(poste, dossiers, W);
    // Les données applicatives de la coquille (§ 8.6 point 2) : AppData,
    // dossier connu que l'environnement ne déplace pas, le LOCALAPPDATA de
    // son environnement, et le temporaire, que TMP désigne.
    const emplacements = { insensibleCasse: true, separateur: '\\' };
    assert.equal(env.PORTABLE_EXECUTABLE_DIR, W.join(poste.TEMP, 'gtt-essai-demarrage-x', 'exe'));
    assert.deepEqual(
      [poste.APPDATA, env.LOCALAPPDATA, env.TMP].filter((dossier) => estSous(dossiers.exe, dossier, emplacements)),
      [],
    );
    // Le profil, AppData et LOCALAPPDATA de la coquille sont sous home.
    assert.equal(env.USERPROFILE, dossiers.home);
    assert.ok(estSous(env.APPDATA, dossiers.home, emplacements) && env.APPDATA !== dossiers.home, env.APPDATA);
    assert.ok(estSous(env.LOCALAPPDATA, dossiers.home, emplacements) && env.LOCALAPPDATA !== dossiers.home, env.LOCALAPPDATA);
    assert.deepEqual(donneesApplicativesSurExe(env, poste, 'win32'), []);
    assert.equal(poste.LOCALAPPDATA, local);
  });

  test("la garde nomme les données applicatives qui portent exe, avant tout lancement", () => {
    // Sous Linux : des chemins composés par path.posix de bout en bout, que
    // le système hôte de l'épreuve ne change pas.
    const P = path.posix;
    const R = P.join('/', 'racine-essai', 'gtt-essai-demarrage-x');
    const dossiers = dossiersDEssai(R, P);
    const env = environnementDEssai({ HOME: P.join('/', 'maison-originale') }, dossiers, P);
    assert.deepEqual(donneesApplicativesSurExe(env, {}, 'linux'), []);
    // Le temporaire de la coquille au-dessus d'exe.
    assert.deepEqual(donneesApplicativesSurExe({ ...env, TMPDIR: R }, {}, 'linux'), [R]);
    // Le dossier de configuration XDG au-dessus d'exe.
    assert.deepEqual(donneesApplicativesSurExe({ ...env, XDG_CONFIG_HOME: R }, {}, 'linux'), [R]);
    // Sous Windows : l'AppData du poste, dossier connu, que l'environnement
    // de la coquille ne déplace pas ; puis le LOCALAPPDATA de la coquille.
    const W = path.win32;
    const racine = W.join('D:\\', 'essais', 'gtt-essai-demarrage-x');
    const dossiersW = dossiersDEssai(racine, W);
    const envW = environnementDEssai({}, dossiersW, W);
    assert.deepEqual(donneesApplicativesSurExe(envW, {}, 'win32'), []);
    assert.deepEqual(donneesApplicativesSurExe(envW, { APPDATA: W.join('D:\\', 'essais') }, 'win32'), [
      W.join('D:\\', 'essais'),
    ]);
    assert.deepEqual(donneesApplicativesSurExe({ ...envW, LOCALAPPDATA: 'd:\\ESSAIS' }, {}, 'win32'), ['d:\\ESSAIS']);
    // Sans exécutable publié, rien ne le porte.
    assert.deepEqual(donneesApplicativesSurExe({ TMPDIR: '/' }, {}, 'linux'), []);
  });

  test('sous macOS, Application Support de la coquille et du poste ; sous Windows, TMP l’emporte sur TEMP', () => {
    // macOS : un essai rangé sous le dossier Application Support du poste,
    // que le HOME de la coquille ne déplace pas, puis sous celui de la
    // coquille.
    const P = path.posix;
    const maison = P.join('/', 'maison-essai');
    const support = P.join(maison, 'Library', 'Application Support');
    const dossiers = dossiersDEssai(P.join(support, 'gtt-essai-demarrage-x'), P);
    const env = environnementDEssai({ HOME: maison }, dossiers, P);
    assert.deepEqual(donneesApplicativesSurExe(env, {}, 'darwin'), []);
    assert.deepEqual(donneesApplicativesSurExe(env, { HOME: maison }, 'darwin'), [support]);
    assert.deepEqual(donneesApplicativesSurExe({ ...env, HOME: maison }, {}, 'darwin'), [support]);
    // Sous Linux, le même poste ne range rien sous Application Support.
    assert.deepEqual(donneesApplicativesSurExe(env, { HOME: maison }, 'linux'), []);
    // Windows : le temporaire est TMP, puis TEMP à défaut.
    const W = path.win32;
    const racine = W.join('D:\\', 'essais', 'gtt-essai-demarrage-x');
    const envW = environnementDEssai({}, dossiersDEssai(racine, W), W);
    const dessus = W.join('D:\\', 'essais');
    const ailleurs = W.join('E:\\', 'temporaire');
    assert.deepEqual(donneesApplicativesSurExe({ ...envW, TMP: dessus, TEMP: ailleurs }, {}, 'win32'), [dessus]);
    assert.deepEqual(donneesApplicativesSurExe({ ...envW, TMP: ailleurs, TEMP: dessus }, {}, 'win32'), []);
    assert.deepEqual(donneesApplicativesSurExe({ ...envW, TMP: '', TEMP: dessus }, {}, 'win32'), [dessus]);
  });

  test('la liste des données applicatives est celle que decrireSysteme compose : un emplacement qu’elle ajoute est jugé, et un app.getPath que l’essai ne sait pas émuler lève', () => {
    const P = path.posix;
    const R = P.join('/', 'racine-essai', 'gtt-essai-demarrage-x');
    const dossiers = dossiersDEssai(R, P);
    const env = environnementDEssai({ HOME: P.join('/', 'maison-originale') }, dossiers, P);
    const autre = P.join('/', 'racine-essai');
    // Une coquille qui range aussi GTT_DONNEES parmi ses données applicatives.
    const avecUnDossier = (poste) => {
      const decrit = decrireSysteme(poste);
      const donneesApplicatives = [...decrit.emplacements.donneesApplicatives, poste.env.GTT_DONNEES];
      return { ...decrit, emplacements: { ...decrit.emplacements, donneesApplicatives } };
    };
    assert.deepEqual(donneesApplicativesSurExe({ ...env, GTT_DONNEES: autre }, {}, 'linux', avecUnDossier), [autre]);
    assert.deepEqual(donneesApplicativesSurExe({ ...env, GTT_DONNEES: P.join('/', 'ailleurs') }, {}, 'linux', avecUnDossier), []);
    // Une coquille qui lit un autre dossier du système : l'essai le refuse
    // plutôt que de juger une liste incomplète.
    const avecUserData = (poste) => {
      poste.cheminSysteme('userData');
      return decrireSysteme(poste);
    };
    assert.throws(() => donneesApplicativesSurExe(env, {}, 'linux', avecUserData), /userData/);
  });
});

describe('essai de démarrage : lancement direct', () => {
  const MODULE = fileURLToPath(new URL('./essai_demarrage.js', import.meta.url));

  // Le lien désigne le dossier du module : une jonction sous Windows, qui se
  // crée sans privilège, un lien symbolique ailleurs.
  test('le script atteint par un lien symbolique est le module', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'gtt-essai-lien-'));
    try {
      const lien = join(dossier, 'scripts');
      symlinkSync(dirname(MODULE), lien, 'junction');
      assert.equal(estLanceDirectement(join(lien, 'essai_demarrage.js')), true);
      assert.equal(estLanceDirectement(MODULE), true);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  test('un autre script, un script absent ou aucun script ne lance pas l’essai', () => {
    assert.equal(estLanceDirectement(fileURLToPath(import.meta.url)), false);
    assert.equal(estLanceDirectement(join(tmpdir(), 'gtt-essai-absent', 'essai_demarrage.js')), false);
    assert.equal(estLanceDirectement(undefined), false);
  });
});

describe('essai de démarrage : la police de la page (§ 19.4)', () => {
  // Un relevé conforme : les deux faces chargées, une face d'une autre
  // famille, le corps en Noto Sans, la chaîne témoin à 1 000 px.
  const RELEVE = Object.freeze({
    faces: [
      { famille: 'Noto Sans', graisse: '400', style: 'normal', etat: 'loaded' },
      { famille: '"Noto Sans"', graisse: '700', style: 'normal', etat: 'loaded' },
      { famille: 'Famille Inventée', graisse: '400', style: 'normal', etat: 'unloaded' },
    ],
    familleCorps: '"Noto Sans", system-ui, sans-serif',
    largeurTemoin: 1000,
  });
  const TEMOIN = Object.freeze({ longueurAttendue: 1000, tolerance: 0.01 });

  test('un relevé conforme ne porte aucune faute ; un écart égal à la tolérance est admis', () => {
    assert.deepEqual(fautesDePolice(RELEVE, TEMOIN), []);
    assert.deepEqual(fautesDePolice({ ...RELEVE, largeurTemoin: 1010 }, TEMOIN), []);
    assert.deepEqual(fautesDePolice({ ...RELEVE, largeurTemoin: 990 }, TEMOIN), []);
  });

  test('une face absente ou non chargée se nomme par sa graisse ; une autre famille n’y entre pas', () => {
    const sans700 = RELEVE.faces.filter(({ graisse, famille }) => !(graisse === '700' && famille.includes('Noto')));
    assert.deepEqual(fautesDePolice({ ...RELEVE, faces: sans700 }, TEMOIN), ['face 700 de Noto Sans absente']);
    const enErreur = RELEVE.faces.map((face) => (face.graisse === '400' && face.famille === 'Noto Sans' ? { ...face, etat: 'error' } : face));
    assert.deepEqual(fautesDePolice({ ...RELEVE, faces: enErreur }, TEMOIN), ['face 400 de Noto Sans : error']);
    assert.deepEqual(fautesDePolice({ ...RELEVE, faces: [] }, TEMOIN), [
      'face 400 de Noto Sans absente',
      'face 700 de Noto Sans absente',
    ]);
  });

  test('un corps du document dans une autre famille se nomme, telle que la page la calcule', () => {
    assert.deepEqual(fautesDePolice({ ...RELEVE, familleCorps: 'system-ui, sans-serif' }, TEMOIN), [
      'corps du document en system-ui, sans-serif',
    ]);
  });

  test('une chaîne témoin hors de la tolérance se nomme, mesurée et attendue', () => {
    assert.deepEqual(fautesDePolice({ ...RELEVE, largeurTemoin: 1010.5 }, TEMOIN), ['chaîne témoin : 1010.5 px pour 1000 px']);
    assert.deepEqual(fautesDePolice({ ...RELEVE, largeurTemoin: 960 }, TEMOIN), ['chaîne témoin : 960 px pour 1000 px']);
    assert.deepEqual(fautesDePolice({ ...RELEVE, largeurTemoin: 0 }, TEMOIN), ['chaîne témoin : 0 px pour 1000 px']);
  });
});

describe('essai de démarrage : l’impression de l’aperçu (§ 11.7)', () => {
  // Trois feuilles de 210 × 297 mm et la troisième à plat, et les boîtes de
  // média qui leur répondent, chacune décalée de moins que la tolérance.
  const FEUILLES = Object.freeze([
    { largeur: 210, hauteur: 297 },
    { largeur: 210, hauteur: 297 },
    { largeur: 297, hauteur: 210 },
  ]);
  const PAGES = Object.freeze([
    { largeur: 209.9, hauteur: 297.1 },
    { largeur: 210, hauteur: 297 },
    { largeur: 297.2, hauteur: 209.8 },
  ]);
  const TOLERANCE = 0.25;

  test('une page par feuille, chacune aux dimensions de la sienne : aucune faute ; un écart égal à la tolérance est admis', () => {
    assert.deepEqual(fautesDImpression(FEUILLES, PAGES, TOLERANCE), []);
    const auBord = PAGES.map(({ largeur, hauteur }, rang) => (rang === 0 ? { largeur: 210.25, hauteur: 296.75 } : { largeur, hauteur }));
    assert.deepEqual(fautesDImpression(FEUILLES, auBord, TOLERANCE), []);
  });

  test('un compte de pages qui n’est pas celui des feuilles se nomme, et rien d’autre ne se compare', () => {
    assert.deepEqual(fautesDImpression(FEUILLES, PAGES.slice(0, 1), TOLERANCE), ['1 page(s) pour 3 feuille(s)']);
    assert.deepEqual(fautesDImpression(FEUILLES.slice(0, 1), PAGES, TOLERANCE), ['3 page(s) pour 1 feuille(s)']);
  });

  test('une page hors de la tolérance se nomme par son rang, lue puis attendue ; une orientation inversée aussi', () => {
    const large = PAGES.map((page, rang) => (rang === 1 ? { largeur: 210.3, hauteur: 297 } : page));
    assert.deepEqual(fautesDImpression(FEUILLES, large, TOLERANCE), ['page 2 : 210.3 × 297 mm pour une feuille de 210 × 297 mm']);
    const debout = PAGES.map((page, rang) => (rang === 2 ? { largeur: 210, hauteur: 297 } : page));
    assert.deepEqual(fautesDImpression(FEUILLES, debout, TOLERANCE), ['page 3 : 210 × 297 mm pour une feuille de 297 × 210 mm']);
  });

  test('un aperçu sans feuille est une faute, même sans page', () => {
    assert.deepEqual(fautesDImpression([], [], TOLERANCE), ['aucune feuille dans l’aperçu']);
  });
});
