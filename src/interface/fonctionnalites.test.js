// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le sommaire des fonctionnalités (§ 2.2, § 18.6) : la forme des numéros,
// leur unicité, la règle qui interdit de réutiliser un numéro retiré, un
// libellé par catégorie et par fonctionnalité, et la concordance avec le
// tableau du § 2.2 de spec.md — mêmes catégories, mêmes numéros dans le même
// ordre, mêmes intitulés, mêmes renvois, mêmes numéros retirés —, chaque
// renvoi désignant une section qui existe. spec.md se lit par le disque : il
// ne voyage pas avec l'application.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { TABLES_APPLICATION } from '../application/libelles.js';
import { creerTraduction } from '../application/traduction.js';
import { CATEGORIES, RETIRES, cleDeCategorie, cleDeFonctionnalite } from './fonctionnalites.js';
import { TABLES_INTERFACE } from './libelles.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const SPEC = readFileSync(new URL('../../spec.md', import.meta.url), 'utf8');

const NUMERO = /^([A-Z]{3})-(\d{2})$/;
const numeros = () => CATEGORIES.flatMap(({ fonctionnalites }) => fonctionnalites.map(({ numero }) => numero));

// Les numéros des sections de spec.md, d'après ses intitulés : « ## 2. … »
// donne 2, « ### 2.1 … » donne 2.1.
function sectionsDe(texte) {
  return new Set([...texte.matchAll(/^#{2,4} (\d+(?:\.\d+)*)\.? /gmu)].map(([, numero]) => numero));
}

// Le texte du § 2.2 : de son intitulé à l'intitulé suivant de niveau 2 ou 3 ;
// null sans lui.
function paragrapheSommaire(texte) {
  const debut = texte.search(/^### 2\.2 /mu);
  if (debut === -1) return null;
  const corps = texte.indexOf('\n', debut) + 1;
  const suite = texte.slice(corps).search(/^#{2,3} /mu);
  return suite === -1 ? texte.slice(debut) : texte.slice(debut, corps + suite);
}

// Ce que le § 2.2 porte : ses catégories dans l'ordre — libellé, code, et
// chaque ligne de leur tableau, numéro, intitulé et renvois sans « § » — et
// ses numéros retirés ; null sans le paragraphe.
function lireSommaire(texte) {
  const paragraphe = paragrapheSommaire(texte);
  if (paragraphe === null) return null;
  const categories = [];
  let retires = null;
  for (const ligne of paragraphe.split('\n')) {
    const categorie = /^\*\*(.+?)\*\* — `([A-Z]{3})`$/u.exec(ligne);
    if (categorie !== null) {
      categories.push({ libelle: categorie[1], code: categorie[2], lignes: [] });
      continue;
    }
    const rang = /^\| `([^`]+)` \| (.+?) \| (.+?) \|$/u.exec(ligne);
    if (rang !== null) {
      const renvois = rang[3].split(', ').map((renvoi) => renvoi.replace(/^§ /u, ''));
      categories.at(-1)?.lignes.push({ numero: rang[1], intitule: rang[2], renvois });
      continue;
    }
    const retire = /^\*\*Numéros retirés\*\* : (.+)\.$/u.exec(ligne);
    if (retire !== null) retires = retire[1] === 'aucun' ? [] : retire[1].split(', ').map((n) => n.replaceAll('`', ''));
  }
  return { categories, retires };
}

// Les différences entre le sommaire de l'application et le § 2.2 d'un texte
// de spécification : chacune une phrase, dans l'ordre du sommaire ; [] quand
// ils concordent. Les libellés écrivent l'apostrophe typographique, la
// spécification l'apostrophe droite : les intitulés se comparent sous la
// seconde.
function ecartsAuSommaire(texte, categories, retires, traduireTypographie) {
  const traduire = (cle) => traduireTypographie(cle).replaceAll('\u{2019}', "'");
  const lu = lireSommaire(texte);
  if (lu === null) return ['§ 2.2 absent'];
  const sections = sectionsDe(texte);
  const fautes = [];
  const attendues = categories.map(({ code }) => code).join(' ');
  const trouvees = lu.categories.map(({ code }) => code).join(' ');
  if (attendues !== trouvees) fautes.push(`catégories : ${trouvees} au lieu de ${attendues}`);
  for (const { code, fonctionnalites } of categories) {
    const lue = lu.categories.find((c) => c.code === code);
    if (lue === undefined) continue;
    if (lue.libelle !== traduire(cleDeCategorie(code))) fautes.push(`${code} : libellé « ${lue.libelle} »`);
    const attendus = fonctionnalites.map(({ numero }) => numero).join(' ');
    const trouves = lue.lignes.map(({ numero }) => numero).join(' ');
    if (attendus !== trouves) fautes.push(`${code} : numéros ${trouves} au lieu de ${attendus}`);
    for (const { numero, renvois } of fonctionnalites) {
      const ligne = lue.lignes.find((l) => l.numero === numero);
      if (ligne === undefined) continue;
      if (ligne.intitule !== traduire(cleDeFonctionnalite(numero))) fautes.push(`${numero} : intitulé « ${ligne.intitule} »`);
      if (ligne.renvois.join(', ') !== renvois.join(', ')) fautes.push(`${numero} : renvois ${ligne.renvois.join(', ')}`);
      for (const renvoi of renvois) if (!sections.has(renvoi)) fautes.push(`${numero} : § ${renvoi} absent`);
    }
  }
  if (JSON.stringify(lu.retires) !== JSON.stringify([...retires])) fautes.push(`numéros retirés : ${JSON.stringify(lu.retires)}`);
  return fautes;
}

describe('le sommaire des fonctionnalités : les numéros (§ 2.2)', () => {
  test('chaque catégorie a un code de trois capitales, unique, et un libellé ; chaque numéro porte le code de sa catégorie et deux chiffres', () => {
    assert.ok(CATEGORIES.length >= 5, `${CATEGORIES.length} catégories`);
    const codes = CATEGORIES.map(({ code }) => code);
    assert.equal(new Set(codes).size, codes.length, codes.join(' '));
    for (const { code, fonctionnalites } of CATEGORIES) {
      assert.match(code, /^[A-Z]{3}$/u);
      assert.ok(t(cleDeCategorie(code)).length > 0, code);
      assert.ok(fonctionnalites.length > 0, `${code} sans fonctionnalité`);
      for (const { numero } of fonctionnalites) assert.equal(NUMERO.exec(numero)?.[1], code, numero);
    }
  });

  test('un numéro est unique dans tout le sommaire, et aucun numéro retiré n’y reparaît', () => {
    const tous = numeros();
    assert.ok(tous.length > 30, `${tous.length} fonctionnalités`);
    assert.equal(new Set(tous).size, tous.length);
    assert.deepEqual(tous.filter((numero) => RETIRES.includes(numero)), []);
    assert.equal(new Set(RETIRES).size, RETIRES.length);
    for (const numero of RETIRES) assert.match(numero, NUMERO);
  });

  test('dans chaque catégorie, les numéros actifs et retirés couvrent 01 à leur maximum sans trou : un numéro retiré du sommaire passe aux retirés, et le suivant prend le maximum plus un', () => {
    for (const { code, fonctionnalites } of CATEGORIES) {
      const rangs = [...fonctionnalites.map(({ numero }) => numero), ...RETIRES.filter((n) => n.startsWith(`${code}-`))]
        .map((numero) => Number(NUMERO.exec(numero)[2]))
        .sort((a, b) => a - b);
      assert.deepEqual(rangs, rangs.map((_, rang) => rang + 1), code);
    }
  });

  test('chaque fonctionnalité a son intitulé et au moins un renvoi de la forme d’un numéro de section', () => {
    for (const { fonctionnalites } of CATEGORIES) {
      for (const { numero, renvois } of fonctionnalites) {
        assert.equal(cleDeFonctionnalite(numero), `coquille.apropos.fonctionnalite.${numero.toLowerCase().replace('-', '')}`);
        assert.ok(t(cleDeFonctionnalite(numero)).length > 0, numero);
        assert.ok(renvois.length > 0, numero);
        for (const renvoi of renvois) assert.match(renvoi, /^\d+(?:\.\d+)*$/u, numero);
      }
    }
  });

  test('le sommaire, ses catégories et leurs listes sont gelés', () => {
    assert.ok(Object.isFrozen(CATEGORIES) && Object.isFrozen(RETIRES));
    for (const categorie of CATEGORIES) {
      assert.ok(Object.isFrozen(categorie) && Object.isFrozen(categorie.fonctionnalites), categorie.code);
      for (const f of categorie.fonctionnalites) assert.ok(Object.isFrozen(f) && Object.isFrozen(f.renvois), f.numero);
    }
  });
});

describe('le sommaire des fonctionnalités : la concordance avec spec.md (§ 2.2, § 19.8)', () => {
  test('le § 2.2 porte les catégories, les numéros, les intitulés, les renvois et les numéros retirés du sommaire, et chaque renvoi désigne une section', () => {
    assert.deepEqual(ecartsAuSommaire(SPEC, CATEGORIES, RETIRES, t), []);
  });

  test('la garde relève une catégorie, un numéro, un intitulé, un renvoi et un retrait qui diffèrent, et un renvoi vers une section absente', () => {
    const categories = [
      { code: 'AAA', fonctionnalites: [{ numero: 'AAA-01', renvois: ['1'] }, { numero: 'AAA-02', renvois: ['1.1', '9'] }] },
      { code: 'BBB', fonctionnalites: [{ numero: 'BBB-01', renvois: ['1.1'] }] },
    ];
    const libelles = new Map([
      ['coquille.apropos.categorie.aaa', 'Première'],
      ['coquille.apropos.categorie.bbb', 'Seconde'],
      ['coquille.apropos.fonctionnalite.aaa01', 'Faire une chose'],
      ['coquille.apropos.fonctionnalite.aaa02', 'Faire une autre chose'],
      ['coquille.apropos.fonctionnalite.bbb01', 'Faire la dernière chose'],
    ]);
    const traduire = (cle) => libelles.get(cle);
    const juste = [
      '## 1. Objet',
      '### 1.1 Détail',
      '### 2.2 Les fonctionnalités',
      '**Première** — `AAA`',
      '| `AAA-01` | Faire une chose | § 1 |',
      '| `AAA-02` | Faire une autre chose | § 1.1, § 9 |',
      '**Seconde** — `BBB`',
      '| `BBB-01` | Faire la dernière chose | § 1.1 |',
      '**Numéros retirés** : `AAA-03`.',
      '## 9. Suite',
      '| `ZZZ-01` | Hors du paragraphe | § 1 |',
      '',
    ].join('\n');
    assert.deepEqual(ecartsAuSommaire(juste, categories, ['AAA-03'], traduire), []);
    const fausse = juste
      .replace('**Seconde**', '**Autre**')
      .replace('| `AAA-02` | Faire une autre chose | § 1.1, § 9 |', '| `AAA-02` | Faire autre chose | § 1.1, § 8 |')
      .replace('`BBB-01`', '`BBB-02`')
      .replace('`AAA-03`', 'aucun');
    assert.deepEqual(ecartsAuSommaire(fausse, categories, ['AAA-03'], traduire), [
      'AAA-02 : intitulé « Faire autre chose »',
      'AAA-02 : renvois 1.1, 8',
      'BBB : libellé « Autre »',
      'BBB : numéros BBB-02 au lieu de BBB-01',
      'numéros retirés : []',
    ]);
    assert.deepEqual(ecartsAuSommaire(juste.replace('## 9. Suite', '## 8. Suite'), categories, ['AAA-03'], traduire), [
      'AAA-02 : § 9 absent',
    ]);
    assert.deepEqual(ecartsAuSommaire(juste.replace('**Seconde** — `BBB`', '**Seconde** — `CCC`'), categories, ['AAA-03'], traduire), [
      'catégories : AAA CCC au lieu de AAA BBB',
    ]);
    assert.deepEqual(ecartsAuSommaire('## 1. Objet\n', categories, [], traduire), ['§ 2.2 absent']);
  });
});
