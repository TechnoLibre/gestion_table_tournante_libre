// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Garde des sources du plan (§ 7.3) : un seul écouteur, sur la racine, que
// Plan.svelte pose par addEventListener ; aucun élément SVG d'un composant
// de src/interface/plan/ ne déclare d'écouteur dans son gabarit — ni
// attribut on…, ni directive on:. Les contrôles HTML hors du <svg data-plan>
// — boutons de la barre de vue, des panneaux — portent les leurs, comme tout
// composant. Les gabarits se lisent par l'analyseur de Svelte
// (svelte/compiler), jamais par une expression régulière : un attribut se
// reconnaît à sa place dans l'arbre, non à son texte.
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'svelte/compiler';
import { describe, test } from '../../../test/lanceur.js';

const DOSSIER_PLAN = fileURLToPath(new URL('.', import.meta.url));

// Les éléments SVG qu'un gabarit du plan peut écrire, la racine comprise.
// <title> en est exclu : son nom est aussi celui d'un élément HTML.
const ELEMENTS_SVG = new Set([
  'svg', 'g', 'circle', 'rect', 'path', 'text', 'tspan', 'line', 'polyline', 'polygon', 'ellipse',
  'defs', 'pattern', 'use', 'symbol', 'clipPath', 'mask', 'marker', 'image', 'foreignObject',
  'linearGradient', 'radialGradient', 'stop', 'desc',
]);

// Vrai pour un attribut qui pose un écouteur : on… en Svelte 5, on: en
// Svelte 4.
const ecoute = (attribut) =>
  attribut.type === 'OnDirective' || (attribut.type === 'Attribute' && /^on[a-z]/i.test(attribut.name));

/**
 * Les éléments SVG d'un gabarit et les écouteurs qu'ils déclarent : elements,
 * le compte des éléments SVG ; ecouteurs, « élément attribut » pour chacun,
 * dans l'ordre du texte. Le parcours visite tout l'arbre de l'analyseur,
 * blocs {#if}, {#each}, {#key} et composants compris.
 */
function releverGabarit(source) {
  const arbre = parse(source, { modern: true });
  const vus = new WeakSet();
  let elements = 0;
  const ecouteurs = [];
  const visiter = (noeud) => {
    if (noeud === null || typeof noeud !== 'object' || vus.has(noeud)) return;
    vus.add(noeud);
    if (noeud.type === 'RegularElement' && ELEMENTS_SVG.has(noeud.name)) {
      elements += 1;
      for (const attribut of noeud.attributes) {
        if (ecoute(attribut)) ecouteurs.push({ debut: attribut.start, texte: `${noeud.name} ${attribut.name}` });
      }
    }
    for (const valeur of Object.values(noeud)) visiter(valeur);
  };
  visiter(arbre.fragment);
  return { elements, ecouteurs: ecouteurs.sort((a, b) => a.debut - b.debut).map(({ texte }) => texte) };
}

/** Le relevé des composants .svelte d'un dossier, triés par nom : le compte
 *  des éléments SVG et « fichier : élément attribut » pour chaque écouteur. */
function releverDossier(dossier) {
  const fichiers = readdirSync(dossier).filter((nom) => nom.endsWith('.svelte')).sort();
  let elements = 0;
  const ecouteurs = [];
  for (const fichier of fichiers) {
    const releve = releverGabarit(readFileSync(join(dossier, fichier), 'utf8'));
    elements += releve.elements;
    ecouteurs.push(...releve.ecouteurs.map((texte) => `${fichier} : ${texte}`));
  }
  return { fichiers: fichiers.length, elements, ecouteurs };
}

describe('aucun écouteur sur un élément SVG du plan (§ 7.3)', () => {
  test('les composants de src/interface/plan/ : balayage non vide, aucun écouteur dans le dessin', () => {
    const { fichiers, elements, ecouteurs } = releverDossier(DOSSIER_PLAN);
    assert.ok(fichiers >= 5, `${fichiers} composants balayés`);
    assert.ok(elements >= 20, `${elements} éléments SVG balayés`);
    assert.deepEqual(ecouteurs, []);
  });

  test('contrôle d’échec : un onpointerdown sur le <circle> d’une chaise est relevé, un onclick sur un <button> ne l’est pas', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'gtt-ecouteurs-'));
    try {
      writeFileSync(
        join(dossier, 'Chaise.svelte'),
        [
          '<svelte:options namespace="svg" />',
          '<script>let { saisir, chaises } = $props();</script>',
          '<g data-table="1">',
          '  {#each chaises as chaise (chaise.siege)}',
          '    <g data-siege="1:{chaise.siege}"><circle r="22" onpointerdown={saisir} /></g>',
          '  {/each}',
          '</g>',
          '{#if chaises.length > 0}<path d="M0,0" on:click={saisir} />{/if}',
          '',
        ].join('\n'),
      );
      writeFileSync(
        join(dossier, 'Barre.svelte'),
        ['<script>let { zoomer } = $props();</script>', '<div><button onclick={zoomer}>+</button></div>', ''].join('\n'),
      );
      const releve = releverDossier(dossier);
      assert.equal(releve.fichiers, 2);
      assert.equal(releve.elements, 4);
      assert.deepEqual(releve.ecouteurs, ['Chaise.svelte : circle onpointerdown', 'Chaise.svelte : path click']);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  test('un <svg> racine qui écoute est relevé aussi', () => {
    assert.deepEqual(releverGabarit('<svg data-plan onwheel={() => {}}><g data-vue></g></svg>').ecouteurs, ['svg onwheel']);
  });
});
