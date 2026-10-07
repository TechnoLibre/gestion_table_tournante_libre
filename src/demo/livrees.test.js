// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des démonstrations livrées et des CSV d'exemple, série surveillée
// (§ 8.9, § 10.3, § 14.4, § 14.8, § 15) : un fichier par entrée du
// catalogue, que LIVREES porte octet pour octet, sous Vitest comme sous Node
// seul ; chacun une démonstration neuve, en forme canonique ;
// l'aller-retour sur la petite démonstration ; les deux CSV de
// démonstration, l'export exact des fichiers livrés ; les deux CSV des cas
// limites, la même lecture en deux encodages, où chaque cas du § 10.3 se
// voit, et des noms inventés hors des listes du générateur. L'empreinte, le
// profil et l'aller-retour sur la grande sont dans livrees.long.test.js.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { varianteWindows1252 } from '../../scripts/engendrer_livrables.js';
import { describe, test } from '../../test/lanceur.js';
import { versionVoisine } from '../../test/version_voisine.js';
import { apercevoir } from '../csv/apercu.js';
import { decoder } from '../csv/encodage.js';
import { exporterParticipants } from '../csv/export.js';
import { constante } from '../geometrie/constantes.js';
import { geometrieTable } from '../geometrie/tables.js';
import { serialiser } from '../stockage/canonique.js';
import { analyser } from '../stockage/document.js';
import { examiner } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { CATALOGUE } from './catalogue.js';
import { LIVREES, texteLivre } from './livrees.js';
import { NOMS_LONGS, PRENOMS, RACINES, TETES, patronymes } from './noms.js';

const DOSSIER_LIVREES = new URL('./livrees/', import.meta.url);
const EXEMPLES = new URL('../../exemples/', import.meta.url);

// Les démonstrations dont la série surveillée fait l'aller-retour ; la série
// longue le fait sur toutes (§ 14.4).
const PETITES = new Set(['petite', 'petite-conflit']);

const MARQUE_UTF8 = [0xef, 0xbb, 0xbf];

const lireLivre = (cle) => readFileSync(new URL(`${cle}.gtt.json`, DOSSIER_LIVREES));
const lireExemple = (nom) => readFileSync(new URL(nom, EXEMPLES));

// Texte d'un fichier livré, décodé en UTF-8 strict : un octet invalide lève.
const texteDuFichier = (cle) => new TextDecoder('utf-8', { fatal: true }).decode(lireLivre(cle));

// Programme que Node exécute seul, hors de Vite et de Vitest : il importe
// livrees.js et écrit LIVREES en JSON sur sa sortie standard.
const SOUS_NODE_SEUL = [
  `const { LIVREES } = await import(${JSON.stringify(new URL('./livrees.js', import.meta.url).href)});`,
  'process.stdout.write(JSON.stringify(LIVREES));',
].join('\n');

// Les fichiers livrés que retient garder ; lève quand il n'en reste aucun :
// un balayage qui n'examine rien ne prouve rien (§ 14.2).
function balayer(garder) {
  const examines = LIVREES.filter(({ cle }) => garder(cle));
  assert.ok(examines.length > 0, 'aucun fichier livré examiné');
  return examines;
}

// Aller-retour d'un fichier livré (§ 8.9) : charger — analyser, puis
// contrôler les placements, qui n'écartent ni ne signalent rien —,
// enregistrer sous une autre construction et à la révision suivante,
// recharger. Rend la charge chargée, la charge rechargée, et le texte que
// l'enregistrement écrirait sous l'en-tête lu.
function allerRetour(texte) {
  const lu = analyser(texte);
  const { charge, fautives, derives } = examiner(lu.charge);
  assert.deepEqual([fautives, derives], [[], []]);
  const enregistre = serialiser(charge, {
    revision: lu.entete.revision + 1,
    produitVersion: versionVoisine(VERSION.affichee),
  });
  const relu = analyser(enregistre);
  assert.notEqual(relu.entete.revision, lu.entete.revision);
  return { charge, relue: relu.charge, sousLEnteteLu: serialiser(charge, lu.entete) };
}

// Rang du premier octet où deux suites diffèrent, longueur comprise, ou -1.
function premierEcart(a, b) {
  const longueur = Math.min(a.length, b.length);
  for (let rang = 0; rang < longueur; rang += 1) if (a[rang] !== b[rang]) return rang;
  return a.length === b.length ? -1 : longueur;
}

// Les deux lectures du CSV des cas limites : celle du fichier écrit à la
// main et celle de sa variante windows-1252.
function lecturesDesCasLimites() {
  return [
    ['participants_cas_limites.csv', decoder(lireExemple('participants_cas_limites.csv'))],
    ['participants_cas_limites_cp1252.csv', decoder(lireExemple('participants_cas_limites_cp1252.csv'))],
  ].map(([nom, { texte, encodage }]) => ({ nom, encodage, apercu: apercevoir(texte) }));
}

describe('démonstrations livrées : les fichiers (§ 15.5, point 5)', () => {
  test("un fichier par entrée du catalogue, nommé <clé>.gtt.json, et rien d'autre : ni journal ni proposition", () => {
    const fichiers = readdirSync(DOSSIER_LIVREES).sort();
    assert.ok(fichiers.length > 0, 'aucun fichier livré');
    assert.deepEqual(fichiers, CATALOGUE.map(({ cle }) => `${cle}.gtt.json`).sort());
  });

  test("LIVREES porte le texte de chaque fichier, octet pour octet, dans l'ordre du catalogue, figé", () => {
    assert.deepEqual(
      LIVREES.map(({ cle }) => cle),
      CATALOGUE.map(({ cle }) => cle),
    );
    for (const livree of LIVREES) {
      assert.equal(
        livree.texte,
        texteDuFichier(livree.cle),
        `${livree.cle} : LIVREES ne porte pas le texte du fichier ; un fichier hors de la forme canonique s'y réécrit autrement`,
      );
      assert.ok(Object.isFrozen(livree), livree.cle);
    }
    assert.ok(Object.isFrozen(LIVREES));
  });

  test('Node seul, sans Vite ni Vitest, importe livrees.js et y lit le texte de chaque fichier : le repli « node --test » le charge (§ 14.8)', () => {
    const resultat = spawnSync(process.execPath, ['--input-type=module', '--eval', SOUS_NODE_SEUL], {
      encoding: 'utf8',
    });
    assert.equal(resultat.status, 0, resultat.stderr);
    const lues = JSON.parse(resultat.stdout);
    assert.deepEqual(
      lues.map(({ cle }) => cle),
      CATALOGUE.map(({ cle }) => cle),
    );
    for (const { cle, texte } of lues) {
      assert.equal(texte, texteDuFichier(cle), `${cle} : le texte lu sous Node seul diffère du fichier`);
    }
  });

  test("texteLivre rend le texte d'une clé, et refuse une clé qu'aucune démonstration ne porte", () => {
    for (const { cle, texte } of LIVREES) assert.equal(texteLivre(cle), texte, cle);
    assert.throws(() => texteLivre('moyenne'), (erreur) => erreur instanceof RangeError && /moyenne/.test(erreur.message));
  });

  test('chaque fichier : UTF-8 sans marque, des LF seules, une seule fin de ligne finale', () => {
    for (const { cle } of LIVREES) {
      const octets = lireLivre(cle);
      assert.notDeepEqual([...octets.subarray(0, 3)], MARQUE_UTF8, cle);
      const texte = new TextDecoder('utf-8', { fatal: true }).decode(octets);
      assert.ok(!texte.includes('\r'), cle);
      assert.ok(texte.endsWith('}\n') && !texte.endsWith('\n\n'), cle);
    }
  });

  test("chaque fichier est une démonstration neuve : identifiant demo:<clé>, nom du catalogue, révision 1, brouillon, sans filiation, ni proposition ni retenu", () => {
    for (const { cle, texte } of LIVREES) {
      const { entete, charge } = analyser(texte);
      assert.deepEqual(
        [entete.revision, charge.evenement.id, charge.evenement.nom, charge.evenement.etat, charge.evenement.filiation],
        [1, `demo:${cle}`, CATALOGUE.find((entree) => entree.cle === cle).nom, 'brouillon', null],
        cle,
      );
      assert.deepEqual([charge.propositions, charge.retenu], [[], null], cle);
    }
  });

  test("le bloc de noms d'une table, de toute sa largeur, ne rencontre l'emprise d'aucune autre table, d'aucune rangée (§ 7.4)", () => {
    // Le bloc s'étend de origineListe.x sur LARGEUR_BLOC_NOMS_CM, où toute
    // ligne s'abrège ; sa hauteur, mesurée sur la police, ne se connaît pas
    // ici : l'épreuve exige la bande verticale entière libre de toute emprise.
    const largeur = constante('LARGEUR_BLOC_NOMS_CM');
    for (const { cle, texte } of LIVREES) {
      const { charge } = analyser(texte);
      const geometries = charge.tables.map((table) => geometrieTable(table, table.sieges ?? charge.evenement.siegesParDefaut));
      const rencontres = geometries.flatMap((g) =>
        geometries
          .filter((autre) => autre !== g)
          .filter((autre) => autre.centre.x - autre.rayonEmprise < g.origineListe.x + largeur && autre.centre.x + autre.rayonEmprise > g.origineListe.x)
          .map((autre) => `table ${g.numero} sur la table ${autre.numero}`),
      );
      assert.ok(geometries.length > 1, cle);
      assert.deepEqual(rencontres, [], cle);
    }
  });
});

describe('démonstrations livrées : aller-retour sur la petite (§ 8.9, § 14.4)', () => {
  test("charger, enregistrer, recharger rend la même charge ; le texte livré est celui qu'écrit le sérialiseur", () => {
    for (const { cle, texte } of balayer((cle) => PETITES.has(cle))) {
      const { charge, relue, sousLEnteteLu } = allerRetour(texte);
      assert.deepEqual(relue, charge, cle);
      assert.equal(sousLEnteteLu, texte, cle);
    }
  });

  test("le balayage refuse de passer quand il n'examine aucun fichier (§ 14.2)", () => {
    assert.throws(() => balayer(() => false), /aucun fichier livré examiné/);
  });
});

describe("CSV d'exemple : les deux de démonstration (§ 10.3)", () => {
  test("participants_demo_petite.csv et participants_demo_grande.csv égalent, octet pour octet, l'export des fichiers livrés", () => {
    for (const cle of ['petite', 'grande']) {
      const lus = lireExemple(`participants_demo_${cle}.csv`);
      const attendus = exporterParticipants(analyser(texteLivre(cle)).charge.participants);
      assert.equal(premierEcart(lus, attendus), -1, `participants_demo_${cle}.csv : premier octet qui diffère`);
    }
  });
});

describe("CSV d'exemple : les cas limites (§ 10.3)", () => {
  test('UTF-8 avec marque et « ; », puis windows-1252 et « , » : la même lecture, séparateur à part', () => {
    assert.deepEqual([...lireExemple('participants_cas_limites.csv').subarray(0, 3)], MARQUE_UTF8);
    const [utf8, windows1252] = lecturesDesCasLimites();
    assert.deepEqual(
      [utf8.encodage, utf8.apercu.separateur, windows1252.encodage, windows1252.apercu.separateur],
      ['utf-8-bom', ';', 'windows-1252', ','],
    );
    assert.equal(utf8.apercu.refusGlobal, null);
    assert.deepEqual({ ...windows1252.apercu, separateur: ';' }, utf8.apercu);
  });

  test('la variante windows-1252 est celle que le script dérive du fichier écrit à la main', () => {
    const lus = lireExemple('participants_cas_limites_cp1252.csv');
    const attendus = varianteWindows1252(lireExemple('participants_cas_limites.csv'));
    assert.equal(premierEcart(lus, attendus), -1, 'participants_cas_limites_cp1252.csv : premier octet qui diffère');
  });

  test('chaque cas du § 10.3 se voit dans les deux fichiers', () => {
    for (const { nom, apercu } of lecturesDesCasLimites()) {
      const champs = apercu.lignes.map((ligne) => ligne.champs);
      const bruts = apercu.lignes.flatMap(({ brut }) => brut);
      const cas = [
        ['une colonne non reconnue', apercu.association.nonReconnues.length > 0],
        ['une personne sans appartenance', champs.some(({ appartenance }) => appartenance === null)],
        ['une exclusion', champs.some(({ exclu }) => exclu === true)],
        // Un champ qui porte le séparateur n'a pu se lire entier que cité.
        ['un champ cité contenant le séparateur', bruts.some((champ) => champ.includes(apercu.separateur))],
        ['un champ cité sur deux lignes', bruts.some((champ) => champ.includes('\n'))],
        ['un doublon', apercu.doublons.length > 0],
        ['une personne sans prénom', champs.some(({ prenom }) => prenom === null)],
        ['deux orthographes fondues', apercu.fusions.some(({ orthographes }) => orthographes.length >= 2)],
        ['une ligne refusée faute de nom', apercu.refusees.some(({ code }) => code === 'NOM_ABSENT')],
      ];
      assert.deepEqual(cas.filter(([, vu]) => !vu).map(([libelle]) => libelle), [], nom);
    }
  });

  test('noms, organisations et courriels inventés : aucun nom des listes du générateur, chaque courriel sous .test', () => {
    const { texte } = decoder(lireExemple('participants_cas_limites.csv'));
    // Chaque nom des listes, en mot entier, sans égard à la casse, en NFC.
    const noms = [...PRENOMS, ...patronymes(), ...NOMS_LONGS, ...TETES, ...RACINES]
      .map((nom) => nom.normalize('NFC').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const motif = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${noms.join('|')})(?![\\p{L}\\p{M}\\p{N}])`, 'giu');
    assert.deepEqual([...texte.normalize('NFC').matchAll(motif)].map(([mot]) => mot), []);
    const courriels = texte.match(/[^\s;,"]+@[^\s;,"]+/g) ?? [];
    assert.ok(courriels.length > 0, 'aucun courriel');
    assert.deepEqual(courriels.filter((courriel) => !courriel.endsWith('.test')), []);
  });
});
