// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'environnement où l'essai de démarrage lance la coquille (§ 8.6) : trois
// dossiers distincts sous la racine de l'essai, aucun sous un autre ; le
// lanceur portable publie exe, le poste a home pour dossier personnel et
// temp pour dossier temporaire, et la configuration XDG du poste réel n'y
// entre pas. Le module se charge sans rien lancer : l'essai ne part que
// lorsque node l'exécute.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estSous } from '../src/stockage/dossier_travail.js';
import { describe, test } from '../test/lanceur.js';
import { donneesApplicativesSurExe, dossiersDEssai, environnementDEssai, estLanceDirectement } from './essai_demarrage.js';

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
