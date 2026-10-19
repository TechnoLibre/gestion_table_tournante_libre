// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des composants de graphique de la page de qualité dans un vrai
// moteur de rendu (§ 12.3, § 12.4, § 12.5, § 12.7, § 14.5, D30, D34, D44,
// D51) : escalier, points de relevé, barres, grille, jumeau et pourcentage,
// montés chacun par mount sur des données forgées, avec les contextes que
// pose App — 't' et 'format'. Deux graphiques empilés partagent leur rang
// pointé comme une vue le ferait par bind:pointe : un magasin lu par
// fromStore, que chaque graphique lit et écrit. Les gestes passent par des
// entrées que Chromium traite comme réelles (test/navigateur/entrees.js).
// Les noms d'épreuve sont inventés.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import { fromStore, writable } from 'svelte/store';
import '../../jetons.css';
import { TABLES_APPLICATION } from '../../../application/libelles.js';
import { creerFormat } from '../../../application/format.js';
import { creerTraduction } from '../../../application/traduction.js';
import { creerMesureur, mesuresDuTexte } from '../../plan/mesure_texte.js';
import { SEPARATIONS } from '../../marques.js';
import { SIMULATIONS, ecartPercu, simuler } from '../../palette.js';
import { releverMarques } from '../../../../test/navigateur/captures.js';
import { fixerCadre, pointer, touche } from '../../../../test/navigateur/entrees.js';
import { attenuations, composantes, sousTheme } from '../../../../test/navigateur/rendu.js';
import { TABLES_INTERFACE } from '../../libelles.js';
import { creerDessinDiffere } from './dessin_differe.js';
import { LARGEUR_NOM_PX, margesCommunes } from './pointage.js';
import Barres from './Barres.svelte';
import Escalier from './Escalier.svelte';
import Grille from './Grille.svelte';
import Jumeau from './Jumeau.svelte';
import Pourcentage from './Pourcentage.svelte';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const CONTEXTE = new Map([
  ['t', t],
  ['format', creerFormat(t)],
]);

const NOM_LONG = 'Maëlle-Hortense Quenouille-Vasque de Belle-Rive';
const PRENOMS = ['Iris Ombrelle', 'Théo Pervenche', 'Ondine Lacasse', 'Basile Tourteau', NOM_LONG];
const nomDe = (i) => PRENOMS[i % PRENOMS.length];

const montes = [];

// Le cadre des écrans de l'application (§ 19.4) : un graphique de 1 000 px
// y tient en entier.
beforeAll(async () => {
  await fixerCadre(1366, 700);
});

afterAll(async () => {
  await fixerCadre(1366, 700);
});

afterEach(() => {
  for (const { composant, cible } of montes.splice(0)) {
    unmount(composant);
    cible.remove();
  }
});

// Monte un composant dans un conteneur neuf de la largeur donnée, au début
// du corps, puis laisse le graphique mesurer sa largeur et son texte.
async function monter(Composant, props, largeur = 800) {
  const cible = document.createElement('div');
  cible.style.width = `${largeur}px`;
  document.body.prepend(cible);
  const composant = mount(Composant, { target: cible, props, context: CONTEXTE });
  flushSync();
  montes.push({ composant, cible });
  await tick();
  flushSync();
  await tick();
  return cible;
}

// Un rang pointé partagé, comme bind:pointe le partage entre deux vues :
// avec(props) rend les propriétés reçues augmentées de pointe, un accesseur
// sur le magasin commun — une décomposition par « ... » copierait sa valeur
// et perdrait la liaison.
function rangPartage() {
  const rang = fromStore(writable(null));
  const accesseur = {
    get() {
      return rang.current;
    },
    set(valeur) {
      rang.current = valeur;
    },
    enumerable: true,
  };
  return { rang, avec: (props) => Object.defineProperty({ ...props }, 'pointe', accesseur) };
}

// Des marges partagées par un groupe de graphiques, comme une vue les lie :
// chaque graphique écrit les siennes (marges) et reçoit les marges communes
// de tous (alignerSur, margesCommunes). Les accesseurs se posent sur l'objet
// reçu même, qui garde ainsi celui de pointe.
function margesPartagees(n) {
  const marges = Array.from({ length: n }, () => fromStore(writable(null)));
  return (props, i) =>
    Object.defineProperties(
      props,
      {
        marges: { get: () => marges[i].current, set: (v) => (marges[i].current = v), enumerable: true },
        alignerSur: { get: () => margesCommunes(marges.map((m) => m.current)), enumerable: true },
      },
    );
}

// La couleur calculée d'un jeton, lue sur un élément témoin.
function couleurDuJeton(jeton) {
  const temoin = document.createElement('span');
  temoin.style.color = `var(${jeton})`;
  document.body.append(temoin);
  const couleur = getComputedStyle(temoin).color;
  temoin.remove();
  return couleur;
}

// Le motif calculé d'un trait, ses longueurs en px ; [] pour un trait plein.
const motifDe = (element) => (getComputedStyle(element).strokeDasharray.match(/[\d.]+/g) ?? []).map(Number);

// Le point (x, y) de l'élément SVG d'un graphique dans la fenêtre, pour un
// point local au SVG : sans viewBox, le pixel du dessin est celui de l'écran.
function versFenetre(svg, x, y) {
  const cadre = svg.getBoundingClientRect();
  return { x: cadre.left + x, y: cadre.top + y };
}

// La surface de pointage d'un graphique : le rect sans remplissage qui
// capte le pointeur.
const surfaceDe = (svg) => svg.querySelector(':scope > rect[pointer-events="all"]');

const infobulleDe = (cible) => cible.querySelector('[role="tooltip"]');

// Le profil forgé de n personnes : rencontres croissantes, appartenances
// rencontrées dessous, plafond réalisé en escalier, borne de diversité ;
// marques aux rangs 2 et 4.
function profil(n) {
  const rencontres = Array.from({ length: n }, (_, i) => 10 + Math.floor((17 * i) / Math.max(1, n - 1)));
  return {
    rencontres,
    appartenances: rencontres.map((r) => Math.floor(r / 3)),
    plafond: rencontres.map((_, i) => (i < n / 2 ? 27 : 26)),
    borne: rencontres.map(() => 6),
    marques: rencontres.map((_, i) => (i === 1 ? 'ancre' : i === 3 ? 'reserve' : null)),
  };
}

const COLONNES_PROFIL = [
  { cle: 'rang', libelle: 'Rang', genre: 'nombre' },
  { cle: 'nom', libelle: 'Personne', genre: 'texte' },
  { cle: 'rencontres', libelle: 'Rencontres', genre: 'nombre' },
  { cle: 'part', libelle: 'Part', genre: 'pourcentage' },
];

function infobulleProfil(p) {
  return {
    colonnes: COLONNES_PROFIL,
    lignes: p.rencontres.map((r, i) => ({
      rang: i + 1,
      nom: nomDe(i),
      rencontres: r,
      part: { texte: `${Math.floor((100 * r) / p.plafond[i])} %`, compte: `${r} sur ${p.plafond[i]}` },
    })),
  };
}

function propsProfil(n, extra = {}) {
  const p = profil(n);
  return {
    graphique: 'profil',
    nom: 'Qui rencontre le moins de monde ?',
    synthese: 'Minimum 10 rencontres, une personne.',
    series: [
      { libelle: 'rencontres', valeurs: p.rencontres },
      { libelle: 'appartenances rencontrées', valeurs: p.appartenances },
    ],
    reperes: [
      { genre: 'plafond', libelle: 'plafond réalisé', valeurs: p.plafond },
      { genre: 'borne', libelle: 'borne de diversité', valeurs: p.borne },
    ],
    marques: p.marques,
    infobulle: infobulleProfil(p),
    ...extra,
  };
}

describe('graphiques : l’escalier du profil (§ 12.3, D30)', () => {
  test('une image nommée et décrite, sans viewBox ; chaque trait peint son jeton, sans opacité ni filtre dans son ascendance', async () => {
    const cible = await monter(Escalier, propsProfil(12));
    const svg = cible.querySelector('svg[data-graphique="profil"]');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.hasAttribute('viewBox')).toBe(false);
    expect(document.getElementById(svg.getAttribute('aria-labelledby')).textContent).toBe('Qui rencontre le moins de monde ?');
    expect(document.getElementById(svg.getAttribute('aria-describedby')).textContent).toBe('Minimum 10 rencontres, une personne.');
    const attendus = [
      ['[data-serie="serie1"]', '--couleur-graphique-serie-1'],
      ['[data-serie="serie2"]', '--couleur-graphique-serie-2'],
      ['[data-repere="plafond"]', '--couleur-graphique-repere'],
      ['[data-repere="borne"]', '--couleur-graphique-borne'],
    ];
    for (const [selecteur, jeton] of attendus) {
      const trace = svg.querySelector(selecteur);
      expect(trace, selecteur).not.toBeNull();
      expect(getComputedStyle(trace).stroke, selecteur).toBe(couleurDuJeton(jeton));
      expect(attenuations(trace), selecteur).toEqual([]);
    }
    for (const marque of svg.querySelectorAll('[data-marque]')) expect(attenuations(marque)).toEqual([]);
  });

  test('rouge : les quatre traits — plein, tirets, mixte, pointillé — ont des motifs calculés deux à deux distincts', async () => {
    const cible = await monter(Escalier, propsProfil(12));
    const motifs = ['[data-serie="serie1"]', '[data-serie="serie2"]', '[data-repere="plafond"]', '[data-repere="borne"]'].map(
      (s) => getComputedStyle(cible.querySelector(s)).strokeDasharray,
    );
    expect(new Set(motifs).size, motifs.join(' | ')).toBe(4);
    expect(motifs[0]).toBe('none');
  });

  test('rouge : le plafond en tiret-point, la borne en pointillés plus courts que les tirets de la seconde série', async () => {
    const cible = await monter(Escalier, propsProfil(12));
    const [long, vide1, court, vide2, ...reste] = motifDe(cible.querySelector('path[data-repere="plafond"]'));
    expect([long, vide1, court, vide2].every(Number.isFinite) && reste.length === 0, 'plafond : tiret, vide, point, vide').toBe(true);
    expect(long).toBeGreaterThan(court);
    expect(court).toBeLessThanOrEqual(Math.min(vide1, vide2));
    const borne = motifDe(cible.querySelector('path[data-repere="borne"]'));
    expect(borne, 'borne : point, vide').toHaveLength(2);
    expect(borne[0]).toBeLessThanOrEqual(borne[1]);
    expect(borne[0]).toBeLessThan(motifDe(cible.querySelector('path[data-serie="serie2"]'))[0]);
  });

  test('rouge : plus étroit que ses marges, l’escalier se rend sans lever, zone nulle', async () => {
    const cible = await monter(Escalier, propsProfil(12), 150);
    const svg = cible.querySelector('svg[data-graphique="profil"]');
    expect(svg).not.toBeNull();
    expect(svg.querySelector('[data-serie="serie1"]')).not.toBeNull();
  });

  test('un seul axe vertical ; chaque trace porte son libellé sur le tracé, au bout de sa ligne', async () => {
    const cible = await monter(Escalier, propsProfil(12));
    const svg = cible.querySelector('svg');
    const axes = [...svg.querySelectorAll('line[data-marque="graphiqueAxe"]')];
    expect(axes.filter((a) => a.getAttribute('x1') === a.getAttribute('x2'))).toHaveLength(1);
    const surface = surfaceDe(svg);
    const fin = Number(surface.getAttribute('x')) + Number(surface.getAttribute('width'));
    const textes = [...svg.querySelectorAll('text')];
    for (const libelle of ['rencontres', 'appartenances rencontrées', 'plafond réalisé', 'borne de diversité']) {
      const etiquette = textes.find((x) => x.textContent === libelle);
      expect(etiquette, libelle).toBeDefined();
      expect(Number(etiquette.getAttribute('x'))).toBeGreaterThan(fin);
      const boite = etiquette.getBoundingClientRect();
      expect(boite.right).toBeLessThanOrEqual(svg.getBoundingClientRect().right + 0.5);
    }
  });

  test('un signe de forme aux seuls rangs marqués, de la marque du registre', async () => {
    const cible = await monter(Escalier, propsProfil(12));
    expect(cible.querySelectorAll('svg [data-marque="graphiqueMarque"]')).toHaveLength(2);
  });

  test('le signe d’une absente : un losange creux, de la marque du registre, et sa légende sous son libellé', async () => {
    const marques = profil(12).marques.map((marque, i) => (i === 5 ? 'absente' : marque));
    const cible = await monter(Escalier, propsProfil(12, { marques }));
    const svg = cible.querySelector('svg');
    const signes = [...svg.querySelectorAll('[data-marque="graphiqueMarque"]')];
    expect(signes).toHaveLength(3);
    // Le losange : quatre sommets, au-dessus, à droite, au-dessous et à
    // gauche d'un même centre, à égale distance.
    const losanges = signes.filter((signe) => /^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ Z$/.test(signe.getAttribute('d')));
    expect(losanges).toHaveLength(1);
    const [haut, droite, bas, gauche] = losanges[0].getAttribute('d').match(/[\d.]+ [\d.]+/g).map((paire) => paire.split(' ').map(Number));
    expect(haut[0]).toBeCloseTo(bas[0], 2);
    expect(gauche[1]).toBeCloseTo(droite[1], 2);
    expect(droite[0] - haut[0]).toBeCloseTo(bas[1] - droite[1], 2);
    expect(droite[0] - haut[0]).toBeGreaterThan(0);
    expect(getComputedStyle(losanges[0]).fill).toBe('none');
    expect(getComputedStyle(losanges[0]).stroke).toBe(couleurDuJeton('--couleur-graphique-marque'));
    // La légende nomme le signe, après la réserve, et en dessine le losange
    // creux.
    const entrees = [...cible.querySelectorAll('ul li')];
    const libelles = entrees.map((li) => li.textContent.trim());
    expect(libelles).toContain(t('graphiques.signe.absente'));
    expect(libelles.indexOf(t('graphiques.signe.absente'))).toBe(libelles.indexOf(t('graphiques.signe.reserve')) + 1);
    const echantillon = entrees.find((li) => li.textContent.trim() === t('graphiques.signe.absente')).querySelector('path');
    expect(echantillon.getAttribute('d')).toBe('M 14 2 L 18 6 L 14 10 L 10 6 Z');
    expect(getComputedStyle(echantillon).fill).toBe('none');
  });

  test('rouge : la surface de pointage est un rect sans remplissage, sœur des marques, jamais leur ancêtre', async () => {
    const cible = await monter(Escalier, propsProfil(12));
    const svg = cible.querySelector('svg');
    const surface = surfaceDe(svg);
    expect(surface).not.toBeNull();
    expect(surface.getAttribute('fill')).toBe('none');
    expect(surface.children).toHaveLength(0);
    for (const marque of svg.querySelectorAll('[data-marque]')) {
      expect(surface.contains(marque)).toBe(false);
      // Aucun ancêtre d'une marque, dans le dessin, ne capte le pointeur à
      // la place de la surface.
      for (let n = marque.parentElement; n !== svg; n = n.parentElement) {
        expect(getComputedStyle(n).pointerEvents, n.localName).not.toBe('all');
      }
    }
    // La surface est la dernière : rien de peint ne la couvre.
    expect(svg.lastElementChild).toBe(surface);
  });

  test('rouge : à 260 rangs dans 1 000 px, le pointage désigne le rang le plus proche, et l’infobulle porte sa ligne', async () => {
    const cible = await monter(Escalier, propsProfil(260), 1000);
    const svg = cible.querySelector('svg');
    const surface = surfaceDe(svg);
    const x0 = Number(surface.getAttribute('x'));
    const pas = Number(surface.getAttribute('width')) / 260;
    const y = Number(surface.getAttribute('y')) + 5;
    for (let rang = 1; rang <= 260; rang += 1) {
      const p = versFenetre(svg, x0 + (rang - 0.5) * pas, y);
      await pointer('bouger', p.x, p.y);
      flushSync();
      expect(svg.querySelector('[data-rang]')?.getAttribute('data-rang'), `rang ${rang}`).toBe(String(rang));
    }
    const bulle = infobulleDe(cible);
    expect(bulle.hidden).toBe(false);
    expect(bulle.textContent).toContain(nomDe(259));
    expect(bulle.querySelector('[data-pourcentage] + [data-compte-pire]').textContent).not.toBe('');
  });

  test('Échap ferme l’infobulle ; quitter le tracé aussi', async () => {
    const cible = await monter(Escalier, propsProfil(5));
    const svg = cible.querySelector('svg');
    const surface = surfaceDe(svg);
    const boite = surface.getBoundingClientRect();
    // Le document a le focus, comme quand l'opérateur survole puis tape :
    // une touche n'atteint que le document focalisé.
    const focalisable = document.createElement('button');
    cible.append(focalisable);
    focalisable.focus();
    await pointer('bouger', boite.left + 3, boite.top + 3);
    flushSync();
    expect(infobulleDe(cible).hidden).toBe(false);
    await touche('Escape');
    flushSync();
    expect(infobulleDe(cible).hidden).toBe(true);
    await pointer('bouger', boite.left + 4, boite.top + 3);
    flushSync();
    expect(infobulleDe(cible).hidden).toBe(false);
    await pointer('bouger', boite.right + 200, boite.bottom + 200);
    flushSync();
    expect(infobulleDe(cible).hidden).toBe(true);
  });

  test('rouge : deux graphiques empilés — comptes, puis pourcentages — désignent le même rang pointé, l’infobulle dans le seul graphique survolé', async () => {
    const p = profil(20);
    const partage = rangPartage();
    const aligner = margesPartagees(2);
    const pourcents = p.rencontres.map((r, i) => (i === 6 ? null : Math.floor((100 * r) / p.plafond[i])));
    const haut = await monter(Escalier, aligner(partage.avec(propsProfil(20)), 0), 900);
    const bas = await monter(
      Escalier,
      aligner(partage.avec({
        graphique: 'profilPourcent',
        nom: 'Quelle part de son plafond chacun rencontre-t-il ?',
        synthese: 'minimum 10 sur 27',
        series: [{ libelle: 'part du plafond réalisé', valeurs: pourcents }],
        reperes: [{ genre: 'cent', libelle: '100 %', valeurs: p.rencontres.map(() => 100) }],
        graduer: (v) => `${v} %`,
        infobulle: infobulleProfil(p),
      }), 1),
      900,
    );
    await tick();
    flushSync();
    const svgHaut = haut.querySelector('svg');
    const surface = surfaceDe(svgHaut);
    const pas = Number(surface.getAttribute('width')) / 20;
    const point = versFenetre(svgHaut, Number(surface.getAttribute('x')) + 7.5 * pas, Number(surface.getAttribute('y')) + 4);
    await pointer('bouger', point.x, point.y);
    flushSync();
    expect(haut.querySelector('[data-rang]').getAttribute('data-rang')).toBe('8');
    expect(bas.querySelector('[data-rang]')?.getAttribute('data-rang')).toBe('8');
    expect(infobulleDe(haut).hidden).toBe(false);
    expect(infobulleDe(bas).hidden).toBe(true);
    // La règle à 100 % a le motif du plafond, la série en pourcentage le plein.
    const regle = bas.querySelector('path[data-repere="cent"]');
    expect(bas.querySelector('text[data-repere="cent"]').textContent).toBe('100 %');
    expect(getComputedStyle(regle).strokeDasharray).toBe(getComputedStyle(haut.querySelector('[data-repere="plafond"]')).strokeDasharray);
    expect(getComputedStyle(regle).strokeDasharray).not.toBe(getComputedStyle(bas.querySelector('[data-serie="serie1"]')).strokeDasharray);
    // Les deux abscisses s'alignent : même zone, rang contre rang ; le rang
    // 7, sans valeur, interrompt le tracé du second.
    const zones = [haut, bas].map((c) => ['x', 'width'].map((a) => surfaceDe(c.querySelector('svg')).getAttribute(a)));
    expect(zones[1]).toEqual(zones[0]);
    expect(bas.querySelector('[data-serie="serie1"]').getAttribute('d').match(/M/g)).toHaveLength(2);
  });

  test('rouge : un chemin ne relie jamais deux rangs par-dessus un rang sans valeur', async () => {
    const cible = await monter(Escalier, {
      graphique: 'trou',
      nom: 'Trou',
      synthese: 'Un rang sans valeur.',
      series: [{ libelle: 'part', valeurs: [40, null, 40, 60] }],
    });
    const d = cible.querySelector('[data-serie="serie1"]').getAttribute('d');
    expect(d.match(/M/g)).toHaveLength(2);
  });
});

describe('graphiques : deux séries sur une borne reçue, l’infobulle à plusieurs lignes (C20, D59, D60, D66)', () => {
  // Deux placements comparés : le manque de chacun par rang, trié par son
  // propre manque décroissant ; A monte à 3, B à 7.
  const MANQUES_A = [3, 3, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0];
  const MANQUES_B = [7, 5, 4, 2, 2, 1, 0, 0, 0, 0, 0, 0];
  const COLONNES_MANQUE = [
    { cle: 'nom', libelle: 'Personne', genre: 'texte' },
    { cle: 'manque', libelle: 'manque', genre: 'nombre' },
    { cle: 'rencontres', libelle: 'rencontres', genre: 'nombre' },
    { cle: 'plafond', libelle: 'plafond réalisé', genre: 'nombre' },
  ];
  const lignesDe = (manques, decalage) =>
    manques.map((manque, i) => ({ nom: nomDe(i + decalage), manque, rencontres: 27 - manque, plafond: 27 }));

  function propsComparaison(borneHaute, extra = {}) {
    return {
      graphique: 'comparaison',
      nom: 'Laquelle des deux sert mieux, et qui y perd ?',
      synthese: 'n° 4 sert mieux à 5 rangs, n° 7 à 2, égalité à 5.',
      series: [
        { libelle: 'n° 4', valeurs: MANQUES_A, cle: 'a' },
        { libelle: 'n° 7', valeurs: MANQUES_B, cle: 'b' },
      ],
      borneHaute,
      infobulle: {
        colonnes: COLONNES_MANQUE,
        series: [
          { nom: 'n° 4', lignes: lignesDe(MANQUES_A, 0) },
          { nom: 'n° 7', lignes: lignesDe(MANQUES_B, 1) },
        ],
      },
      ...extra,
    };
  }

  // Le haut du tracé d'une série, en px du dessin : la plus petite ordonnée
  // de son chemin, hors de l'épaisseur du trait.
  const hautDe = (trace) => trace.getBBox().y;

  // Pointe le rang donné, à partir de 1, d'un escalier de n rangs.
  async function pointerRang(cible, rang, n) {
    const svg = cible.querySelector('svg');
    const surface = surfaceDe(svg);
    const pas = Number(surface.getAttribute('width')) / n;
    const p = versFenetre(svg, Number(surface.getAttribute('x')) + (rang - 0.5) * pas, Number(surface.getAttribute('y')) + 4);
    await pointer('bouger', p.x, p.y);
    flushSync();
  }

  test('rouge : deux séries partagent une seule échelle verticale, bornée par la borne fournie', async () => {
    for (const borne of [7, 9]) {
      const cible = await monter(Escalier, propsComparaison(borne));
      const svg = cible.querySelector('svg[data-graphique="comparaison"]');
      const axes = [...svg.querySelectorAll('line[data-marque="graphiqueAxe"]')];
      expect(axes.filter((x) => x.getAttribute('x1') === x.getAttribute('x2')), `borne ${borne}`).toHaveLength(1);
      const surface = surfaceDe(svg);
      const haut = Number(surface.getAttribute('y'));
      const bas = haut + Number(surface.getAttribute('height'));
      // Chaque série à la hauteur de son plus grand manque sur la borne
      // reçue : A ne s'étire pas jusqu'au haut, B ne l'atteint qu'à la borne.
      const a = svg.querySelector('path[data-serie="a"]');
      const b = svg.querySelector('path[data-serie="b"]');
      expect(a, `borne ${borne}`).not.toBeNull();
      expect(b, `borne ${borne}`).not.toBeNull();
      expect(hautDe(a), `A, borne ${borne}`).toBeCloseTo(bas - ((bas - haut) * 3) / borne, 1);
      expect(hautDe(b), `B, borne ${borne}`).toBeCloseTo(bas - ((bas - haut) * 7) / borne, 1);
      expect(hautDe(a) - hautDe(b), `borne ${borne}`).toBeGreaterThan(10);
    }
  });

  test('A en trait plein, B en tirets, chacune étiquetée de son nom au bout du tracé et dans la légende ; leurs couleurs se séparent sous les trois dichromaties, dans les deux thèmes', async () => {
    const cible = await monter(Escalier, propsComparaison(7));
    const svg = cible.querySelector('svg');
    const [a, b] = ['a', 'b'].map((cle) => svg.querySelector(`path[data-serie="${cle}"]`));
    expect(getComputedStyle(a).strokeDasharray).toBe('none');
    expect(motifDe(b).length).toBeGreaterThan(0);
    expect(svg.querySelector('text[data-serie="a"]').textContent).toBe('n° 4');
    expect(svg.querySelector('text[data-serie="b"]').textContent).toBe('n° 7');
    const fin = Number(surfaceDe(svg).getAttribute('x')) + Number(surfaceDe(svg).getAttribute('width'));
    for (const cle of ['a', 'b']) expect(Number(svg.querySelector(`text[data-serie="${cle}"]`).getAttribute('x'))).toBeGreaterThan(fin);
    expect([...cible.querySelectorAll('ul li')].map((li) => li.textContent)).toEqual(['n° 4', 'n° 7']);
    for (const theme of ['clair', 'sombre']) {
      const [ca, cb, ja, jb] = await sousTheme(theme, () => [
        ...[a, b].map((trace) => composantes(getComputedStyle(trace).stroke)),
        ...['--couleur-graphique-serie-1', '--couleur-graphique-serie-2'].map((jeton) => composantes(couleurDuJeton(jeton))),
      ]);
      // Les jetons existants des deux séries, sans couleur neuve.
      expect([ca, cb], theme).toEqual([ja, jb]);
      for (const vue of ['origine', ...Object.keys(SIMULATIONS)]) {
        const vu = (c) => (vue === 'origine' ? c : simuler(c, vue));
        expect(ecartPercu(vu(ca), vu(cb)), `${theme}, ${vue}`).toBeGreaterThanOrEqual(SEPARATIONS.autresMarques);
      }
    }
  });

  test('rouge : l’infobulle d’un rang porte une ligne par placement, chacune précédée du nom de sa série, sans pourcentage ; Échap la ferme', async () => {
    const cible = await monter(Escalier, propsComparaison(7));
    const focalisable = document.createElement('button');
    cible.append(focalisable);
    focalisable.focus();
    await pointerRang(cible, 2, MANQUES_A.length);
    const bulle = infobulleDe(cible);
    expect(bulle.hidden).toBe(false);
    expect(cible.querySelector('[data-rang]').getAttribute('data-rang')).toBe('2');
    const blocs = [...bulle.querySelectorAll('dl')];
    expect(blocs).toHaveLength(2);
    // Chaque ligne suit le nom de sa série, dans l'ordre des séries : la
    // personne au rang 2 de A, puis celle au rang 2 de B.
    for (const [k, [nom, personne, manque]] of [['n° 4', nomDe(1), '3'], ['n° 7', nomDe(2), '5']].entries()) {
      const precedent = blocs[k].previousElementSibling;
      expect(precedent?.textContent, nom).toBe(nom);
      expect(blocs[k].textContent, nom).toContain(personne);
      const cellules = [...blocs[k].querySelectorAll('dt')].map((dt) => [dt.textContent, dt.nextElementSibling.textContent.trim()]);
      expect(cellules, nom).toContainEqual(['manque', manque]);
    }
    expect(bulle.querySelector('[data-pourcentage]')).toBeNull();
    expect(bulle.textContent).not.toContain('%');
    await touche('Escape');
    flushSync();
    expect(bulle.hidden).toBe(true);
  });

  test('rouge : les marges liées se mesurent sur la borne reçue, celles de la zone tracée', async () => {
    // Une borne bien plus large que les données : sa graduation, plus
    // longue que celle de la plus grande valeur, fixe la marge de gauche.
    const marges = fromStore(writable(null));
    const props = Object.defineProperty(propsComparaison(1000), 'marges', {
      get: () => marges.current,
      set: (v) => (marges.current = v),
      enumerable: true,
    });
    const cible = await monter(Escalier, props);
    const surface = surfaceDe(cible.querySelector('svg'));
    expect(marges.current).not.toBeNull();
    expect(marges.current.gauche).toBeCloseTo(Number(surface.getAttribute('x')), 3);
  });

  test('rouge : une série d’infobulle sous un autre nom que la série tracée de même rang lève au montage', () => {
    const inverse = propsComparaison(7);
    inverse.infobulle = { ...inverse.infobulle, series: [...inverse.infobulle.series].reverse() };
    const cible = document.createElement('div');
    document.body.prepend(cible);
    let composant = null;
    try {
      expect(() => {
        composant = mount(Escalier, { target: cible, props: inverse, context: CONTEXTE });
        flushSync();
      }).toThrow(RangeError);
    } finally {
      if (composant !== null) unmount(composant);
      cible.remove();
    }
  });

  test('rouge : une série seule s’infobulle en une seule liste, sans nom de série, avec les cellules de sa ligne', async () => {
    const p = profil(5);
    const cible = await monter(Escalier, propsProfil(5));
    await pointerRang(cible, 3, 5);
    const bulle = infobulleDe(cible);
    expect(bulle.hidden).toBe(false);
    expect([...bulle.children].map((e) => e.localName)).toEqual(['dl']);
    const ligne = infobulleProfil(p).lignes[2];
    const lus = [...bulle.querySelectorAll('dt')].map((dt) => [dt.textContent, dt.nextElementSibling]);
    expect(lus.map(([libelle]) => libelle)).toEqual(COLONNES_PROFIL.map((c) => c.libelle));
    expect(lus.slice(0, 3).map(([, dd]) => dd.textContent.trim())).toEqual(['3', ligne.nom, String(ligne.rencontres)]);
    expect(lus[3][1].querySelector('[data-pourcentage]').textContent).toBe(ligne.part.texte);
    expect(lus[3][1].querySelector('[data-pourcentage] + [data-compte-pire]').textContent).toBe(ligne.part.compte);
    // Une seule série : son tracé garde la désignation d’une série seule.
    expect(cible.querySelector('path[data-serie="serie1"]')).not.toBeNull();
    expect(cible.querySelector('path[data-serie="a"]')).toBeNull();
  });
});

describe('graphiques : les points de relevé (§ 12.14, D49)', () => {
  const ABSCISSES = [1, 10, 100, 1000, 10000, 20000];
  const multiple = (graphique, valeurs) => ({
    graphique,
    nom: `Le ${graphique} au fil de la recherche`,
    synthese: t('graphiques.synthese.pointsDeReleve'),
    forme: 'points',
    abscisses: ABSCISSES,
    series: [{ libelle: graphique, valeurs }],
    infobulle: {
      colonnes: [
        { cle: 'mouvements', libelle: 'Mouvements', genre: 'nombre' },
        { cle: 'valeur', libelle: 'Valeur', genre: 'nombre' },
      ],
      lignes: ABSCISSES.map((mouvements, i) => ({ mouvements, valeur: valeurs[i] })),
    },
    hauteur: 140,
  });

  test('rouge : un point aux seuls points de relevé ; le point pointé est désigné dans tous les petits multiples à la fois', async () => {
    const partage = rangPartage();
    const aligner = margesPartagees(2);
    const a = await monter(Escalier, aligner(partage.avec(multiple('collisions', [9, 7, 4, 2, 1, 1])), 0), 700);
    const b = await monter(Escalier, aligner(partage.avec(multiple('appartenances rencontrées', [3, 5, 8, 9, 10, 10])), 1), 700);
    await tick();
    flushSync();
    for (const cible of [a, b]) expect(cible.querySelectorAll('[data-point-releve]')).toHaveLength(6);
    // L'abscisse est commune : chaque point de relevé à la même abscisse.
    const abscisses = [a, b].map((c) => [...c.querySelectorAll('[data-point-releve]')].map((p) => p.getAttribute('cx')));
    expect(abscisses[1]).toEqual(abscisses[0]);
    const point = a.querySelector('[data-point-releve="100"]');
    const boite = point.getBoundingClientRect();
    await pointer('bouger', boite.left + boite.width / 2 + 2, boite.top + boite.height / 2);
    flushSync();
    for (const cible of [a, b]) {
      const designe = cible.querySelector('[data-rang]');
      expect(designe?.getAttribute('data-rang')).toBe('3');
      expect(designe.getAttribute('cx')).toBe(cible.querySelector('[data-point-releve="100"]').getAttribute('cx'));
    }
    expect(infobulleDe(a).hidden).toBe(false);
    expect(infobulleDe(b).hidden).toBe(true);
  });

  test('rouge : l’infobulle écrit les nombres comme les axes, par format.nombre', async () => {
    const cible = await monter(Escalier, multiple('collisions', [9, 7, 4, 2, 1, 1]), 700);
    const boite = cible.querySelector('[data-point-releve="20000"]').getBoundingClientRect();
    await pointer('bouger', boite.left + boite.width / 2, boite.top + boite.height / 2);
    flushSync();
    const bulle = infobulleDe(cible);
    expect(bulle.hidden).toBe(false);
    expect(bulle.textContent).toContain('20\u{202F}000');
    expect(bulle.textContent).not.toContain('20000');
    const graduations = [...cible.querySelectorAll('svg text')].map((x) => x.textContent);
    expect(graduations).toContain('20\u{202F}000');
  });
});

describe('graphiques : les barres (§ 12.4, § 12.13)', () => {
  const LIGNES = [
    { id: 'aubier', nom: 'Coopérative Aubier', appartenance: 1, valeurs: [0, 3] },
    { id: 'long', nom: NOM_LONG, appartenance: null, valeurs: [2, 0] },
    { id: 'ressac', nom: 'Atelier Ressac', appartenance: 2, valeurs: [1, 1] },
  ];
  const INFOBULLE = {
    colonnes: [
      { cle: 'nom', libelle: 'Appartenance', genre: 'texte' },
      { cle: 'cumulees', libelle: 'Collisions cumulées', genre: 'nombre' },
    ],
    lignes: LIGNES.map((l) => ({ nom: l.nom, cumulees: l.valeurs[0] + l.valeurs[1] })),
  };
  const props = (extra) => ({
    graphique: 'collisions',
    nom: 'Où les appartenances se retrouvent-elles ?',
    synthese: 'Trois appartenances.',
    lignes: LIGNES,
    segments: [
      { genre: 'prouve', libelle: 'prouvé inévitable' },
      { genre: 'reste', libelle: 'reste' },
    ],
    infobulle: INFOBULLE,
    ...extra,
  });

  test('rouge : un nom long se tronque sur le tracé, et reste entier dans l’infobulle et le jumeau', async () => {
    const cible = await monter(Barres, props());
    const ligne = cible.querySelector('[data-ligne-graphique="long"]');
    const intitule = [...ligne.querySelectorAll('text')].find((x) => x.textContent.startsWith('Maëlle'));
    expect(intitule.textContent).not.toBe(NOM_LONG);
    expect(intitule.textContent.endsWith(t('graphiques.troncature'))).toBe(true);
    expect(intitule.getComputedTextLength()).toBeLessThanOrEqual(LARGEUR_NOM_PX);
    const boite = ligne.querySelector('[data-segment]').getBoundingClientRect();
    await pointer('bouger', boite.left + 2, boite.top + boite.height / 2);
    flushSync();
    expect(infobulleDe(cible).hidden).toBe(false);
    expect(infobulleDe(cible).textContent).toContain(NOM_LONG);
    expect(cible.querySelector('[data-rang]').getAttribute('data-rang')).toBe('2');

    const jumeau = await monter(Jumeau, { tableaux: [{ nom: 'Collisions', ...INFOBULLE }] });
    jumeau.querySelector('button').click();
    flushSync();
    expect(jumeau.querySelector('[data-jumeau]').textContent).toContain(NOM_LONG);
  });

  test('rouge : le libellé de chaque segment se pose sur la première barre où il est non nul, et dans la légende', async () => {
    const cible = await monter(Barres, props());
    const svg = cible.querySelector('svg');
    const textes = [...svg.querySelectorAll('text')];
    for (const [libelle, id] of [['prouvé inévitable', 'long'], ['reste', 'aubier']]) {
      const etiquette = textes.find((x) => x.textContent === libelle);
      const barre = svg.querySelector(`[data-ligne-graphique="${id}"] [data-segment]`).getBoundingClientRect();
      const boite = etiquette.getBoundingClientRect();
      expect(boite.top, libelle).toBeGreaterThanOrEqual(barre.top - 1);
      expect(boite.bottom, libelle).toBeLessThanOrEqual(barre.bottom + 1);
      expect(cible.querySelector('ul').textContent).toContain(libelle);
    }
    for (const segment of svg.querySelectorAll('[data-segment]')) {
      expect(Number(segment.getAttribute('width'))).toBeGreaterThan(0);
      expect(attenuations(segment)).toEqual([]);
    }
    expect(svg.querySelectorAll('[data-segment="prouve"]')).toHaveLength(2);
  });

  test('rouge : chaque ligne porte ses autres chiffres en encre secondaire, après sa barre ; une ligne sans barre écrit « — »', async () => {
    const vide = t('format.vide');
    const cible = await monter(
      Barres,
      props({
        lignes: [
          { ...LIGNES[0], secondaire: '7 personnes, 3 paires, excédent 2' },
          { ...LIGNES[1], secondaire: '4 personnes, 2 paires, excédent 0' },
          { id: 'sans', nom: 'Ondine Lacasse', valeurs: [0, 0], secondaire: vide },
        ],
        infobulle: null,
      }),
      640,
    );
    const svg = cible.querySelector('svg');
    const droite = svg.getBoundingClientRect().right;
    const encre = couleurDuJeton('--couleur-page-texte-secondaire');
    for (const [id, texte] of [['aubier', '7 personnes, 3 paires, excédent 2'], ['long', '4 personnes, 2 paires, excédent 0'], ['sans', vide]]) {
      const ligne = svg.querySelector(`[data-ligne-graphique="${id}"]`);
      const ecrit = [...ligne.querySelectorAll('text')].find((x) => x.textContent === texte);
      expect(ecrit, id).toBeDefined();
      expect(getComputedStyle(ecrit).fill, id).toBe(encre);
      expect(attenuations(ecrit), id).toEqual([]);
      const boite = ecrit.getBoundingClientRect();
      expect(boite.right, id).toBeLessThanOrEqual(droite + 0.5);
      for (const segment of ligne.querySelectorAll('[data-segment]')) {
        expect(boite.left, id).toBeGreaterThanOrEqual(segment.getBoundingClientRect().right);
      }
    }
    // Le libellé du segment « reste », posé sur la ligne d'Aubier, précède
    // ses chiffres.
    const reste = [...svg.querySelectorAll('text')].find((x) => x.textContent === 'reste').getBoundingClientRect();
    const chiffres = [...svg.querySelectorAll('[data-ligne-graphique="aubier"] text')].find((x) => x.textContent.startsWith('7 personnes'));
    expect(chiffres.getBoundingClientRect().left).toBeGreaterThanOrEqual(reste.right);
    expect(svg.querySelectorAll('[data-ligne-graphique="sans"] [data-segment]')).toHaveLength(0);
  });

  test('deux colonnes juxtaposées, chacune son axe, les lignes dans le même ordre', async () => {
    const cible = await monter(Barres, {
      graphique: 'diversite',
      nom: 'Quel animateur rencontre le moins de diversité ?',
      synthese: 'Deux animateurs.',
      lignes: [
        { id: 'iris', nom: 'Iris Ombrelle', valeurs: [2, 9] },
        { id: 'theo', nom: 'Théo Pervenche', valeurs: [4, 1] },
      ],
      colonnes: [
        { genre: 'serie1', libelle: 'appartenances' },
        { genre: 'serie2', libelle: 'étiquettes' },
      ],
    });
    const svg = cible.querySelector('svg');
    const lignes = [...svg.querySelectorAll('[data-ligne-graphique]')].map((g) => g.getAttribute('data-ligne-graphique'));
    expect(lignes).toEqual(['iris', 'theo']);
    const [premiere, seconde] = ['serie1', 'serie2'].map((g) => svg.querySelector(`[data-ligne-graphique="theo"] [data-segment="${g}"]`));
    expect(premiere.getBoundingClientRect().right).toBeLessThan(seconde.getBoundingClientRect().left);
    expect(svg.querySelectorAll('line[data-marque="graphiqueAxe"]')).toHaveLength(2);
  });
});

describe('graphiques : la grille (§ 12.5, § 12.11, D33)', () => {
  const PERSONNES = [{ libelle: 'Iris Ombrelle' }, { libelle: 'Théo Pervenche' }, { libelle: 'Basile Tourteau' }];
  const VALEURS = [null, 1, 3, 1, null, 0, 3, 0, null];
  const props = (extra) => ({
    graphique: 'matrice',
    nom: 'Qui a rencontré qui ?',
    synthese: 'Une paire vue trois fois.',
    lignes: PERSONNES,
    colonnes: PERSONNES,
    valeurs: VALEURS,
    diagonale: true,
    infobulle: {
      colonnes: [{ cle: 'paire', libelle: 'Paire', genre: 'texte' }, { cle: 'fois', libelle: 'Fois', genre: 'nombre' }],
      lignes: VALEURS.map((fois, i) => ({ paire: `${PERSONNES[Math.floor(i / 3)].libelle} et ${PERSONNES[i % 3].libelle}`, fois })),
    },
    ...extra,
  });

  test('cases bordées, de leur niveau, le compte écrit de l’encre du niveau ; diagonale vide ; aucune case n’est une cible', async () => {
    const cible = await monter(Grille, props());
    const cases = cible.querySelectorAll('[data-case]');
    expect(cases).toHaveLength(9);
    const trois = cible.querySelector('[data-case="0:2"]');
    expect(trois.querySelector('[data-marque="graphiqueNiveau3"]')).not.toBeNull();
    // Les bordures : un seul <path>, un sous-chemin fermé par case,
    // diagonale comprise ; le bord gauche de 0:2 est sur son trait, à
    // RETRAIT_CASE_PX − 0,5 px à gauche de son remplissage.
    const bordures = cible.querySelectorAll('[data-marque="graphiqueBordureCase"]');
    expect(bordures).toHaveLength(1);
    expect(bordures[0].getAttribute('d').match(/M/g)).toHaveLength(9);
    const fond = trois.querySelector('[data-marque="graphiqueNiveau3"]');
    const [x, y, cote] = ['x', 'y', 'height'].map((nom) => Number(fond.getAttribute(nom)));
    const bord = new DOMPoint(x - 1.5, y + cote / 2);
    expect(bordures[0].isPointInStroke(bord)).toBe(true);
    expect(trois.querySelector('text').textContent).toBe('3');
    expect(getComputedStyle(trois.querySelector('text')).fill).toBe(couleurDuJeton('--couleur-graphique-encre-claire'));
    const diagonale = cible.querySelector('[data-case="1:1"]');
    expect(diagonale.querySelector('text')?.textContent ?? '').toBe('');
    expect(diagonale.querySelector('[data-marque^="graphiqueNiveau"]')).toBeNull();
    for (const c of cases) {
      expect(c.querySelector('[tabindex], [role="button"], a, button')).toBeNull();
      expect(c.hasAttribute('tabindex')).toBe(false);
    }
    const zero = cible.querySelector('[data-case="1:2"]');
    expect(zero.querySelector('[data-marque^="graphiqueNiveau"]')).toBeNull();
    expect(zero.querySelector('text').textContent).toBe('0');
  });

  test('le pointage désigne la case ; la diagonale n’ouvre rien', async () => {
    const cible = await monter(Grille, props());
    const boite = cible.querySelector('[data-case="1:2"] rect').getBoundingClientRect();
    await pointer('bouger', boite.left + boite.width / 2, boite.top + boite.height / 2);
    flushSync();
    expect(infobulleDe(cible).hidden).toBe(false);
    expect(infobulleDe(cible).textContent).toContain('Théo Pervenche et Basile Tourteau');
    // La case 1:1, vide : la colonne du compte de 0:1, la ligne de celui de
    // 1:0.
    const colonne = cible.querySelector('[data-case="0:1"] text').getBoundingClientRect();
    const ligne = cible.querySelector('[data-case="1:0"] text').getBoundingClientRect();
    await pointer('bouger', colonne.left + colonne.width / 2, ligne.top + ligne.height / 2);
    flushSync();
    expect(infobulleDe(cible).hidden).toBe(true);
  });

  test('une case sans compte écrit « — », sans couleur ; une grille trop étroite cède la place à sa phrase', async () => {
    const cible = await monter(Grille, props({ diagonale: false }));
    const vide = cible.querySelector('[data-case="0:0"]');
    expect(vide.querySelector('text').textContent).toBe(t('format.vide'));
    expect(vide.querySelector('[data-marque^="graphiqueNiveau"]')).toBeNull();
    const etroite = await monter(Grille, props({ phrase: 'La grille ne tient pas dans la carte.' }), 60);
    expect(etroite.querySelector('svg')).toBeNull();
    expect(etroite.textContent).toContain('La grille ne tient pas dans la carte.');
  });
});

describe('graphiques : le jumeau (§ 12.7, D44)', () => {
  const TABLEAU = {
    nom: 'Profil des rencontres',
    colonnes: COLONNES_PROFIL,
    lignes: [
      { rang: 1, nom: 'Iris Ombrelle', rencontres: 24, part: { texte: '88 %', compte: '24 sur 27' } },
      { rang: 2, nom: 'Théo Pervenche', rencontres: 0, part: { texte: null, compte: '0 sur 0' } },
    ],
  };

  test('rouge : ouvert au clavier, refermé au clavier, le focus revient à la commande, jamais sur body', async () => {
    const cible = await monter(Jumeau, { tableaux: [TABLEAU] });
    const avant = document.createElement('button');
    avant.textContent = 'avant';
    cible.prepend(avant);
    avant.focus();
    await touche('Tab');
    const commande = document.activeElement;
    expect(commande.getAttribute('data-commande')).toBe('ouvrirJumeau');
    expect(commande.getAttribute('aria-expanded')).toBe('false');
    expect(cible.querySelector('[data-jumeau]')).toBeNull();
    await touche('Enter');
    flushSync();
    await tick();
    expect(commande.getAttribute('aria-expanded')).toBe('true');
    expect(commande.getAttribute('data-commande')).toBe('fermerJumeau');
    expect(cible.querySelector('table[data-jumeau]')).not.toBeNull();
    await touche('Enter');
    flushSync();
    await tick();
    expect(cible.querySelector('[data-jumeau]')).toBeNull();
    expect(document.activeElement).toBe(commande);
    expect(document.activeElement).not.toBe(document.body);
    expect(commande.getAttribute('aria-expanded')).toBe('false');
  });

  test('rouge : chaque cellule de pourcentage est suivie du compte de sa ligne ; « — » sans valeur', async () => {
    const cible = await monter(Jumeau, { tableaux: [TABLEAU], ouvert: true });
    const cellules = cible.querySelectorAll('td[data-colonne="part"]');
    expect(cellules).toHaveLength(2);
    const lus = [...cellules].map((c) => [c.querySelector('[data-pourcentage]').textContent, c.querySelector('[data-pourcentage] + [data-compte-pire]').textContent]);
    expect(lus).toEqual([
      ['88 %', '24 sur 27'],
      [t('format.vide'), '0 sur 0'],
    ]);
    expect(cible.querySelector('th[scope="row"]').textContent).toBe('1');
  });

  test('rouge : une cellule de nombre s’écrit par format.nombre, aux décimales de sa colonne', async () => {
    const tableau = {
      nom: 'Course',
      colonnes: [
        { cle: 'nom', libelle: 'Personne', genre: 'texte' },
        { cle: 'mouvements', libelle: 'Mouvements', genre: 'nombre' },
        { cle: 'taux', libelle: 'Taux de diversité', genre: 'nombre', decimales: 2 },
      ],
      lignes: [{ nom: 'Basile Tourteau', mouvements: 20000, taux: 0.75 }],
    };
    const cible = await monter(Jumeau, { tableaux: [tableau], ouvert: true });
    expect(cible.querySelector('td[data-colonne="mouvements"]').textContent.trim()).toBe('20\u{202F}000');
    expect(cible.querySelector('td[data-colonne="taux"]').textContent.trim()).toBe('0,75');
  });
});

describe('graphiques : le pourcentage et son compte (D34, contrainte 44)', () => {
  test('rouge : le compte se rend juste sous le pourcentage ; « — » quand le pourcentage n’a pas de valeur', async () => {
    const cible = await monter(Pourcentage, { texte: '88 %', compte: 'minimum 24 sur 27' });
    const valeur = cible.querySelector('[data-pourcentage]');
    const compte = cible.querySelector('[data-pourcentage] + [data-compte-pire]');
    expect(valeur.textContent).toBe('88 %');
    expect(compte.textContent).toBe('minimum 24 sur 27');
    expect(compte.getBoundingClientRect().top).toBeGreaterThanOrEqual(valeur.getBoundingClientRect().bottom - 0.5);
    const vide = await monter(Pourcentage, { texte: null, compte: '0 sur 0' });
    expect(vide.querySelector('[data-pourcentage]').textContent).toBe(t('format.vide'));
    expect(vide.querySelector('[data-compte-pire]').textContent).toBe('0 sur 0');
  });
});

describe('graphiques : les marques mesurées dans les deux thèmes (§ 14.5)', () => {
  test('chaque marque de graphique rendue est au registre, peinte de son jeton, à 3:1 de ce qui l’entoure', async () => {
    const racine = document.createElement('div');
    racine.style.background = 'var(--couleur-carte-fond)';
    const montages = [
      await monter(Escalier, propsProfil(12)),
      await monter(Barres, {
        graphique: 'collisions',
        nom: 'Collisions',
        synthese: 'Deux.',
        lignes: [{ id: 'a', nom: 'Atelier Ressac', appartenance: 1, valeurs: [2, 1] }],
        segments: [
          { genre: 'prouve', libelle: 'prouvé inévitable' },
          { genre: 'reste', libelle: 'reste' },
        ],
      }),
      await monter(Grille, {
        graphique: 'grille',
        nom: 'Grille',
        synthese: 'Quatre niveaux.',
        lignes: [{ libelle: 'Table 1' }, { libelle: 'Table 2' }],
        colonnes: [{ libelle: 'Tour 1' }, { libelle: 'Tour 2' }],
        valeurs: [0, 1, 2, 3],
      }),
    ];
    for (const m of montages) racine.append(m);
    document.body.prepend(racine);
    try {
      for (const theme of ['clair', 'sombre']) {
        const releve = await sousTheme(theme, () => releverMarques(racine));
        console.log(`contrastes ${theme} : ${releve.ratios.map((r) => `${r.marque} ${r.ratio.toFixed(2)}`).join(', ')}`);
        expect(releve.fautes, `${theme} :\n${releve.fautes.join('\n')}`).toEqual([]);
        expect(releve.attenuations, theme).toEqual([]);
        expect(releve.mesures, theme).toBeGreaterThan(0);
      }
    } finally {
      racine.remove();
    }
  });

  test('rouge : le losange creux posé sur la série, cerné d’un halo du fond de la carte, à 3:1 de ce qui l’entoure', async () => {
    // Des rangs serrés, comme une soirée réelle : chaque signe se pose sur
    // le tracé de la première série, que le losange creux laisse passer.
    const racine = document.createElement('div');
    racine.style.background = 'var(--couleur-carte-fond)';
    for (const n of [12, 40]) {
      const p = profil(n);
      const marques = p.marques.map((marque, i) => (i % 5 === 2 ? 'absente' : marque));
      racine.append(await monter(Escalier, propsProfil(n, { marques })));
    }
    document.body.prepend(racine);
    try {
      for (const theme of ['clair', 'sombre']) {
        const releve = await sousTheme(theme, () => releverMarques(racine));
        console.log(`contrastes ${theme} : ${releve.ratios.filter((r) => r.marque === 'graphiqueMarque').map((r) => r.ratio.toFixed(2)).join(', ')}`);
        expect(releve.fautes, `${theme} :\n${releve.fautes.join('\n')}`).toEqual([]);
        expect(releve.ratios.filter((r) => r.marque === 'graphiqueMarque').length, theme).toBeGreaterThan(0);
        await sousTheme(theme, () => {
          const fond = couleurDuJeton('--couleur-carte-fond');
          for (const svg of racine.querySelectorAll('svg[data-graphique]')) {
            const signes = [...svg.querySelectorAll('[data-marque="graphiqueMarque"]')];
            expect(signes.length).toBeGreaterThan(0);
            const halos = [...svg.querySelectorAll('path.halo')];
            expect(halos.map((h) => h.getAttribute('d')), theme).toEqual(signes.map((s) => s.getAttribute('d')));
            const series = [...svg.querySelectorAll('[data-serie]')];
            for (const [i, halo] of halos.entries()) {
              // Le halo : sans marque ni remplissage, du fond de la carte,
              // plus large que le signe de 2 px de chaque côté, peint
              // par-dessus les séries et sous chaque signe.
              expect(halo.hasAttribute('data-marque')).toBe(false);
              expect(getComputedStyle(halo).fill).toBe('none');
              expect(getComputedStyle(halo).stroke, theme).toBe(fond);
              const largeur = (e) => Number.parseFloat(getComputedStyle(e).strokeWidth);
              expect(largeur(halo)).toBeCloseTo(largeur(signes[i]) + 4, 5);
              for (const serie of series) expect(serie.compareDocumentPosition(halo) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
              for (const signe of signes) expect(halo.compareDocumentPosition(signe) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
            }
          }
        });
      }
    } finally {
      racine.remove();
    }
  });
});

describe('graphiques : le dessin différé et les mesures de la séance (E2s)', () => {
  // Une zone qui défile de 400 px de haut, posée en tête du document : un
  // graphique, puis un intervalle de 2 000 px, puis un second, puis fin, un
  // élément vide. Chacun est monté sous les contextes de App, et sous
  // dessinDiffere quand differe est vrai, comme la page de qualité les
  // monte ; registre est ce contexte, null sans lui.
  async function monterDansUneZone(premier, second, { differe = true } = {}) {
    const zone = document.createElement('div');
    zone.style.cssText = 'width: 800px; height: 400px; overflow-y: auto;';
    const intervalle = document.createElement('div');
    intervalle.style.height = '2000px';
    const cibles = [document.createElement('div'), document.createElement('div')];
    const fin = document.createElement('div');
    zone.append(cibles[0], intervalle, cibles[1], fin);
    document.body.prepend(zone);
    const registre = differe ? creerDessinDiffere() : null;
    const context = new Map([...CONTEXTE, ...(differe ? [['dessinDiffere', registre]] : [])]);
    for (const [i, [Composant, props]] of [premier, second].entries()) {
      const composant = mount(Composant, { target: cibles[i], props, context });
      montes.push({ composant, cible: i === 0 ? zone : cibles[i] });
    }
    flushSync();
    await tick();
    flushSync();
    return { zone, fin, registre, svgs: cibles.map((cible) => cible.querySelector('svg[data-graphique]')) };
  }

  const image = () => new Promise((resoudre) => requestAnimationFrame(resoudre));

  test('sous dessinDiffere : le graphique visible se dessine au montage, l’autre attend, nommé et décrit, et se dessine en approchant ; leurs marges sont communes dès le montage', async () => {
    const partager = margesPartagees(2);
    const props = [partager(propsProfil(12, { graphique: 'haut' }), 0), partager(propsProfil(12, { graphique: 'bas' }), 1)];
    const { zone, svgs } = await monterDansUneZone([Escalier, props[0]], [Escalier, props[1]]);
    const [haut, bas] = svgs;
    expect(haut.hasAttribute('data-dessin-differe')).toBe(false);
    expect(haut.querySelector('[data-marque]')).not.toBeNull();
    expect(bas.hasAttribute('data-dessin-differe')).toBe(true);
    expect(bas.querySelector('[data-marque]')).toBeNull();
    expect(document.getElementById(bas.getAttribute('aria-labelledby')).textContent).toBe('Qui rencontre le moins de monde ?');
    expect(document.getElementById(bas.getAttribute('aria-describedby')).textContent).toBe('Minimum 10 rencontres, une personne.');
    // Les marges du second se mesurent sans son dessin : le premier est
    // aligné sur elles avant que le second ne se dessine, et ne bouge pas
    // quand il se dessine.
    expect(props[1].marges).not.toBeNull();
    const avant = surfaceDe(haut).getAttribute('x');
    bas.scrollIntoView({ block: 'center' });
    for (let n = 0; n < 60 && bas.hasAttribute('data-dessin-differe'); n += 1) await image();
    expect(bas.hasAttribute('data-dessin-differe')).toBe(false);
    expect(bas.querySelector('[data-marque]')).not.toBeNull();
    expect(surfaceDe(haut).getAttribute('x')).toBe(avant);
    expect(surfaceDe(bas).getAttribute('x')).toBe(avant);
    // Remonté, le second reste dessiné.
    zone.scrollTo(0, 0);
    await image();
    await image();
    expect(bas.querySelector('[data-marque]')).not.toBeNull();
  });

  test('en attente, Barres et Grille réservent la hauteur de leur dessin, chaque graphique porte déjà sa légende ; le registre dessine ce qui précède une cible, rien de ce qui la suit', async () => {
    const barres = {
      graphique: 'collisions',
      nom: 'Collisions',
      synthese: 'Trois appartenances.',
      lignes: [
        { id: 'aubier', nom: 'Coopérative Aubier', appartenance: 1, valeurs: [0, 3] },
        { id: 'long', nom: NOM_LONG, appartenance: null, valeurs: [2, 0] },
        { id: 'ressac', nom: 'Atelier Ressac', appartenance: 2, valeurs: [1, 1] },
      ],
      segments: [
        { genre: 'prouve', libelle: 'prouvé inévitable' },
        { genre: 'reste', libelle: 'reste' },
      ],
    };
    const colonnes = {
      ...barres,
      graphique: 'diversite',
      segments: undefined,
      colonnes: [
        { genre: 'serie1', libelle: 'Appartenances' },
        { genre: 'serie2', libelle: 'Personnes' },
      ],
    };
    const grille = (extra) => ({
      graphique: 'tables',
      nom: 'Tables',
      synthese: 'Quatre niveaux.',
      lignes: [{ libelle: 'Tour 1' }, { libelle: 'Tour 2' }],
      colonnes: [{ libelle: 'Table 1' }, { libelle: 'Table 2' }, { libelle: 'Table 3' }],
      valeurs: [0, 1, 2, 3, null, 1],
      ...extra,
    });
    const cas = [
      ['barres empilées', Barres, barres],
      ['barres juxtaposées', Barres, colonnes],
      ['grille bornée', Grille, grille({ coteMaxTextes: 3 })],
      ['grille, intitulés tournés', Grille, grille({ colonnes: [{ libelle: 'Une table au nom très long' }, { libelle: 'Deux' }, { libelle: 'Trois' }], coteMaxTextes: 2 })],
      ['grille sans borne', Grille, grille()],
      ['escalier', Escalier, propsProfil(12, { graphique: 'bas' })],
    ];
    for (const [quoi, Composant, props] of cas) {
      const { svgs, registre, fin } = await monterDansUneZone([Escalier, propsProfil(12, { graphique: 'haut' })], [Composant, props]);
      const [haut, bas] = svgs;
      const cadre = bas.parentElement;
      const releve = () => ({
        svg: bas.getAttribute('height'),
        cadre: cadre.getBoundingClientRect().height,
        legende: [...cadre.querySelectorAll('ul li')].map((li) => li.textContent),
      });
      expect(bas.hasAttribute('data-dessin-differe'), quoi).toBe(true);
      expect(bas.querySelector('[data-marque]'), quoi).toBeNull();
      const avant = releve();
      expect(Number(avant.svg), quoi).toBeGreaterThan(0);
      if (quoi === 'barres empilées' || quoi === 'escalier') expect(avant.legende.length, quoi).toBeGreaterThan(0);
      // Le graphique en attente suit la cible haut : il reste en attente.
      registre.dessinerAvant(haut);
      flushSync();
      expect(bas.hasAttribute('data-dessin-differe'), quoi).toBe(true);
      registre.dessinerAvant(fin);
      flushSync();
      expect(bas.hasAttribute('data-dessin-differe'), quoi).toBe(false);
      expect(bas.querySelector('[data-marque]'), quoi).not.toBeNull();
      expect(releve(), quoi).toEqual(avant);
      for (const { composant, cible } of montes.splice(0)) {
        unmount(composant);
        cible.remove();
      }
    }
  });

  test('hors de dessinDiffere, un graphique loin de la zone visible se dessine au montage', async () => {
    const haut = [Escalier, propsProfil(12, { graphique: 'haut' })];
    const bas = [Escalier, propsProfil(12, { graphique: 'bas' })];
    const { svgs } = await monterDansUneZone(haut, bas, { differe: false });
    for (const svg of svgs) {
      expect(svg.hasAttribute('data-dessin-differe')).toBe(false);
      expect(svg.querySelector('[data-marque]')).not.toBeNull();
    }
  });

  // Un <svg> sans viewBox au style des textes de graphique, une sonde, et le
  // compte des appels de getComputedTextLength et des relevés (after) que
  // faire() provoque.
  function sousSonde(faire) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.fontSize = '13px';
    const sonde = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    svg.append(sonde);
    document.body.prepend(svg);
    const longueur = SVGTextContentElement.prototype.getComputedTextLength;
    const apres = Element.prototype.after;
    const comptes = { longueurs: 0, releves: 0 };
    SVGTextContentElement.prototype.getComputedTextLength = function compter() {
      comptes.longueurs += 1;
      return longueur.call(this);
    };
    Element.prototype.after = function compter(...noeuds) {
      comptes.releves += 1;
      return apres.apply(this, noeuds);
    };
    try {
      return { rendu: faire(sonde), comptes };
    } finally {
      SVGTextContentElement.prototype.getComputedTextLength = longueur;
      Element.prototype.after = apres;
      svg.remove();
    }
  }

  test('mesuresDuTexte : les largeurs de creerMesureur ; un relevé par lot, calcul relu jusqu’à ne rien demander d’inconnu ; gardées pour la séance, oubliées à la fin d’un chargement de police', () => {
    document.fonts.dispatchEvent(new Event('loadingdone'));
    const chaines = ['Iris Ombrelle', 'Théo Pervenche', '27', ''];
    const temoins = sousSonde((sonde) => chaines.map(creerMesureur(sonde))).rendu;
    // Le calcul demande d'abord trois chaînes, puis une quatrième qui
    // dépend de la largeur de la première : deux lots, trois passages.
    let passages = 0;
    const calcul = (mesurer) => {
      passages += 1;
      const premieres = chaines.slice(0, 3).map(mesurer);
      return premieres[0] > 0 ? [...premieres, mesurer(chaines[3])] : premieres;
    };
    const premier = sousSonde((sonde) => mesuresDuTexte(sonde).calculer(calcul));
    expect(premier.rendu).toEqual(temoins);
    expect(passages).toBe(3);
    expect(premier.comptes).toEqual({ longueurs: 4, releves: 2 });
    // Une autre sonde du même style : tout vient de la séance.
    passages = 0;
    const second = sousSonde((sonde) => mesuresDuTexte(sonde).calculer(calcul));
    expect(second.rendu).toEqual(temoins);
    expect(passages).toBe(1);
    expect(second.comptes).toEqual({ longueurs: 0, releves: 0 });
    // Une police chargée : les largeurs se relèvent.
    document.fonts.dispatchEvent(new Event('loadingdone'));
    const releve = sousSonde((sonde) => mesuresDuTexte(sonde).calculer(calcul));
    expect(releve.rendu).toEqual(temoins);
    expect(releve.comptes.longueurs).toBe(4);
  });

  test('mesuresDuTexte : sous un ancêtre caché, une largeur nulle vaut 0 pour le calcul, ne se garde pas, et le calcul finit', () => {
    document.fonts.dispatchEvent(new Event('loadingdone'));
    const { rendu, comptes } = sousSonde((sonde) => {
      sonde.parentNode.style.display = 'none';
      const mesures = mesuresDuTexte(sonde);
      const cache = mesures.calculer((mesurer) => mesurer('Ondine Lacasse'));
      sonde.parentNode.style.display = '';
      return [cache, mesures.mesurer('Ondine Lacasse')];
    });
    expect(rendu[0]).toBe(0);
    expect(rendu[1]).toBeGreaterThan(0);
    expect(comptes.longueurs).toBe(2);
  });
});
