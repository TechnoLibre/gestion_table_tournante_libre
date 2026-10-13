// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les vues des collisions d'appartenance (§ 12.4, B13, D31) et des
// appartenances à chaque table (§ 12.11, B20, D35, D54) dans un vrai moteur
// de rendu. Collisions : le segment « prouvé inévitable » égale le plancher
// que le diagnostic affiche ; les barres suivent l'excédent, non leur
// longueur ; chaque segment est peint de son jeton de graphique, jamais
// d'une teinte d'appartenance ou de conflit ; hors du domaine des
// planchers, un seul segment et la phrase. Tables : sous chacune des trois
// positions, la pire table en tête et l'ordre de la position ; chaque case
// écrit le compte que sa couleur porte, sans signe « % » ; une table de
// bénévoles sans appartenance écrit « — » et se range en dernier ; la
// position se choisit au clavier, survit à un aller-retour vers le plan,
// repart de « sièges » à la réouverture, et la choisir en lecture ou sur un
// plan bloqué n'écrit rien ; quarante tours au cadre de 1 366 px. Chaque
// épreuve monte App par monterApp, sur le système de fichiers simulé, et lit
// le rendu par les attributs data-…, le texte et les couleurs calculées —
// jamais une classe. Les comptes attendus sont calculés à la main ; les noms
// d'épreuve sont inventés.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { appliquerCommande } from '../../application/commandes.js';
import { diagnostiquerCharge } from '../../application/diagnostic.js';
import { detaillerQualite } from '../../application/evaluation.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { niveau } from '../../geometrie/graphique.js';
import { rechercher } from '../../moteur/recherche.js';
import { serialiser } from '../../stockage/canonique.js';
import { analyser, capacite, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { dessinerGraphiques, fixerCadre, pointer, touche } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { teintesAppartenances } from '../appartenances.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { CASE_MAX_TEXTES, sansCollision } from './appartenances.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const V1 = VERSION.affichee;
const BASE = 'soiree';
const AUBIER = 'Coopérative Aubier';
const RESSAC = 'Atelier Ressac';
const POSITIONS = ['sieges', 'assis', 'doublons'];

// --- Les charges d'épreuve -------------------------------------------------------

// Une charge de personnes inventées, de tables de capacités données, et une
// proposition, n° 1, écrite à la main : à chaque tour, les listes de chaque
// table dans l'ordre des tables ; reserves, les personnes en réserve de
// chaque tour ; premier, le numéro de la première table, les suivantes
// numérotées à la suite.
function chargeDe({ personnes, capacites, tours, reserves = tours.map(() => []), premier = 1 }) {
  const charge = creerCharge({ id: 'evt-appartenances', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: tours.length });
  charge.participants = personnes.map(([nom, prenom, appartenance], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = capacites.map((sieges, rang) => ({ id: rang + 1, numero: premier + rang, sieges, forme: 'ronde', position: { x: 300 * rang, y: 0 } }));
  charge.propositions = [
    {
      id: 1,
      graine: 1,
      arret: 40,
      historique: 1000,
      produitVersion: V1,
      siegesAttribues: false,
      tables: charge.tables.map(({ id }) => id),
      capacites: charge.tables.map((table) => capacite(charge, table)),
      tours: tours.length,
      participants: charge.participants.map(({ id }) => id),
      placement: tours.map((listes, r) => ({ sieges: listes, reserve: reserves[r] })),
    },
  ];
  charge.prochainsIds = { participant: personnes.length + 1, table: capacites.length + 1, proposition: 2 };
  charge.evenement.etat = 'propose';
  return charge;
}

// Treize personnes, quatre tables de 5, 4, 4 et 3 places, le même plan aux
// deux tours. Pour chaque case (c, o, α, δ) : table 1 (5, 2, 2, 2), table 2
// (4, 4, 4, 2), table 3 (4, 4, 2, 1), table 4, trois bénévoles sans
// appartenance. Comptes sièges, assis, doublons : table 1 (3, 0, 0), table
// 2 (2, 2, 2), table 3 (3, 3, 1). Ordres : sièges 1, 3, 2, 4 ; assis 3, 2,
// 1, 4 ; doublons 2, 3, 1, 4.
const PERSONNES_MELANGE = [
  ['Ombrelle', 'Iris', AUBIER],
  ['Lacasse', 'Ondine', RESSAC],
  ['Pervenche', 'Théo', AUBIER],
  ['Quenouille', 'Maëlle', AUBIER],
  ['Tourteau', 'Basile', RESSAC],
  ['Brindille', 'Anselme', RESSAC],
  ['Saule', 'Clothilde', AUBIER],
  ['Galet', 'Eudes', AUBIER],
  ['Mousse', 'Félicie', null],
  ['Ruisseau', 'Gaspard', null],
  ['Lichen', 'Hortense', null],
  ['Chardon', 'Jules', null],
  ['Ronce', 'Léonie', null],
];
const PLAN_MELANGE = [[1, 2], [3, 4, 5, 6], [7, 8, 9, 10], [11, 12, 13]];
const chargeMelange = () => chargeDe({ personnes: PERSONNES_MELANGE, capacites: [5, 4, 4, 3], tours: [PLAN_MELANGE, PLAN_MELANGE] });
const ORDRES = { sieges: [1, 3, 2, 4], assis: [3, 2, 1, 4], doublons: [2, 3, 1, 4] };
// Les comptes des deux tours de chaque table, par numéro, sous chaque
// position ; null pour « — ».
const COMPTES = {
  sieges: { 1: 3, 2: 2, 3: 3, 4: null },
  assis: { 1: 0, 2: 2, 3: 3, 4: null },
  doublons: { 1: 0, 2: 2, 3: 1, 4: null },
};

// Six personnes, deux appartenances de deux, deux tables de trois : aucun
// membre ne retrouve l'autre membre de son appartenance, sur le nombre de
// tours donné.
const PERSONNES_SIX = [
  ['Ombrelle', 'Iris', AUBIER],
  ['Pervenche', 'Théo', AUBIER],
  ['Lacasse', 'Ondine', RESSAC],
  ['Tourteau', 'Basile', RESSAC],
  ['Quenouille', 'Maëlle', null],
  ['Varech', 'Sidonie', null],
];
const chargeSix = ({ personnes = PERSONNES_SIX, tours = 2 } = {}) =>
  chargeDe({
    personnes,
    capacites: [3, 3],
    tours: Array.from({ length: tours }, (_, r) =>
      r % 2 === 0
        ? [
            [1, 3, 5],
            [2, 4, 6],
          ]
        : [
            [1, 4, 6],
            [2, 3, 5],
          ],
    ),
  });

// Douze personnes, quatre tables de trois, trois tours. Ressac (1 et 2) se
// retrouve aux trois tours : 3 collisions cumulées sur une paire, excédent
// 2. Aubier (3 à 6) réunit quatre paires distinctes, une fois chacune : 4
// collisions cumulées, excédent 0. La barre la plus longue vient en second.
const chargeExcedent = () =>
  chargeDe({
    personnes: [
      ['Ombrelle', 'Iris', RESSAC],
      ['Pervenche', 'Théo', RESSAC],
      ['Lacasse', 'Ondine', AUBIER],
      ['Tourteau', 'Basile', AUBIER],
      ['Quenouille', 'Maëlle', AUBIER],
      ['Brindille', 'Anselme', AUBIER],
      ['Saule', 'Clothilde', null],
      ['Galet', 'Eudes', null],
      ['Mousse', 'Félicie', null],
      ['Ruisseau', 'Gaspard', null],
      ['Lichen', 'Hortense', null],
      ['Chardon', 'Jules', null],
    ],
    capacites: [3, 3, 3, 3],
    tours: [
      [[1, 2, 7], [3, 4, 8], [5, 6, 9], [10, 11, 12]],
      [[1, 2, 10], [3, 5, 11], [4, 6, 12], [7, 8, 9]],
      [[1, 2, 3], [4, 7, 8], [5, 9, 10], [6, 11, 12]],
    ],
  });

// Six personnes dont deux seules ont une appartenance, la même, et se
// retrouvent aux deux tours : une appartenance unique, 2 collisions
// cumulées sur une paire.
const chargeUneAppartenance = () =>
  chargeDe({
    personnes: [
      ['Ombrelle', 'Iris', AUBIER],
      ['Pervenche', 'Théo', AUBIER],
      ['Quenouille', 'Maëlle', null],
      ['Varech', 'Sidonie', null],
      ['Mousse', 'Félicie', null],
      ['Ruisseau', 'Gaspard', null],
    ],
    capacites: [3, 3],
    tours: [
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      [
        [1, 2, 4],
        [3, 5, 6],
      ],
    ],
  });

const chargeDemo = (cle) => analyser(texteLivre(cle)).charge;

// La charge, une génération du moteur de plus, enregistrée par la commande.
function generee(charge, reglages) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, reglages);
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;

// --- Le montage --------------------------------------------------------------------

let montes = [];
beforeEach(async () => {
  await fixerCadre(1366, 700);
});
afterEach(() => {
  const erreurs = montes.flatMap((m) => m.erreurs());
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  window.scrollTo(0, 0);
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

// Attend que l'assertion passe, le rendu de Svelte à jour.
async function attendre(assertion) {
  for (let essai = 0; ; essai += 1) {
    flushSync();
    try {
      return assertion();
    } catch (erreur) {
      if (essai >= 200) throw erreur;
      // Un graphique que l'assertion lit attend peut-être d'approcher de la
      // zone visible : chacun se dessine, puis elle se relit.
      await dessinerGraphiques(document.body);
      await new Promise((resoudre) => requestAnimationFrame(resoudre));
    }
  }
}

// La charge posée en fichier d'état, ouverte par la séance — en écriture
// sauf mode 'lecture' —, la proposition demandée au plan, la page de la
// qualité ouverte.
async function ouvrir(charge, { mode = 'ecriture', proposition = charge.propositions[0]?.id ?? null } = {}) {
  const texte = serialiser(charge, { revision: 1, produitVersion: V1 });
  const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `${BASE}${SUFFIXES.etat}`, texte }] });
  montes.push(m);
  await m.seance.ouvrir(BASE);
  if (mode === 'ecriture') await m.seance.passerEnEcriture();
  if (proposition !== null) m.ui.montrerProposition(proposition);
  m.ui.allerA('qualite');
  flushSync();
  return m;
}

// --- Les lectures du rendu ---------------------------------------------------------

const vue = (m, nom) => m.racine.querySelector(`[data-section="qualite"] [data-vue-qualite="${nom}"]`);
const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const radio = (m, position) => vue(m, 'tables').querySelector(`[data-position-tables="${position}"]`);
const positionCochee = (m) => [...vue(m, 'tables').querySelectorAll('[data-position-tables]')].find((r) => r.checked)?.dataset.positionTables;

// Les intitulés des lignes de la grille, dans l'ordre rendu : les textes du
// dessin qui nomment une table.
const intitulesGrille = (svg) =>
  [...svg.querySelectorAll('text')].map((x) => x.textContent).filter((x) => /^Table \d+$/.test(x));

// Les cases de la grille : par ligne et colonne, le texte écrit, le
// remplissage du niveau, null sans remplissage, et le côté, lu sur le
// sous-chemin de sa bordure — le chemin des bordures en porte un par case,
// dans l'ordre des cases : « M x y h c v c h -c z », de côté c + 1.
function casesDe(svg) {
  const cotes = svg
    .querySelector('[data-marque="graphiqueBordureCase"]')
    .getAttribute('d')
    .split('z')
    .filter((sousChemin) => sousChemin !== '')
    .map((sousChemin) => Number(/h([\d.]+)/.exec(sousChemin)[1]) + 1);
  return [...svg.querySelectorAll('[data-case]')].map((g, i) => {
    const [ligne, colonne] = g.dataset.case.split(':').map(Number);
    const fond = [...g.querySelectorAll('rect')].find((r) => r.style.fill !== '') ?? null;
    return {
      ligne,
      colonne,
      texte: g.querySelector('text').textContent,
      marque: fond?.getAttribute('data-marque') ?? null,
      fond: fond === null ? null : getComputedStyle(fond).fill,
      cote: cotes[i],
    };
  });
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

// Les lignes d'un jumeau ouvert : par ligne, chaque cellule sous sa colonne.
function lignesJumeau(tableau) {
  return [...tableau.querySelectorAll('tbody tr')].map((tr) =>
    Object.fromEntries([...tr.children].map((cellule) => [cellule.dataset.colonne, texteDe(cellule)])),
  );
}

async function ouvrirJumeau(racine) {
  racine.querySelector('[data-commande="ouvrirJumeau"]').click();
  return attendre(() => {
    const tableau = racine.querySelector('[data-jumeau="0"]');
    expect(tableau).not.toBeNull();
    return tableau;
  });
}

// Choisit une position par un clic sur son bouton radio.
async function choisir(m, position) {
  radio(m, position).click();
  await attendre(() => expect(positionCochee(m)).toBe(position));
}

// --- Les collisions ----------------------------------------------------------------

describe('collisions d’appartenance (§ 12.4, B13, D31)', () => {
  test('petite démonstration au conflit inévitable : le segment prouvé vaut 4 et égale le plancher que le diagnostic affiche', async () => {
    const charge = generee(chargeDemo('petite-conflit'), { graine: 5, nombre: 1, arret: 300 });
    const plancher = diagnostiquerCharge(charge).diagnostic.collisions;
    expect(plancher).toHaveLength(1);
    expect(plancher[0].plancherCumulees).toBe(4);
    const m = await ouvrir(charge);
    const collisions = await attendre(() => {
      const v = vue(m, 'collisions');
      expect(v.querySelector('svg[data-graphique="collisions"]:not([data-dessin-differe])')).not.toBeNull();
      return v;
    });
    const ligne = collisions.querySelector(`[data-ligne-graphique="${plancher[0].groupe}"]`);
    expect(ligne.querySelector('[data-segment="prouve"]')).not.toBeNull();
    const tableau = await ouvrirJumeau(collisions);
    const lignes = lignesJumeau(tableau);
    const sienne = lignes.find((l) => l.appartenance === plancher[0].groupe);
    expect(sienne.prouve).toBe('4');
    expect(Number(sienne.prouve) + Number(sienne.reste)).toBe(Number(sienne.cumulees));
    // Le plancher que la section du diagnostic écrit, au même chiffre.
    m.ui.allerA('diagnostic');
    const enonce = await attendre(() => {
      const e = m.racine.querySelector('[data-section="diagnostic"] [data-enonce="diagnostic.collisions"]');
      expect(e).not.toBeNull();
      return e;
    });
    expect(texteDe(enonce).match(/au moins (\d+) collisions? cumulées?/)[1]).toBe(sienne.prouve);
  });

  test('les barres suivent l’excédent, non leur longueur ; chaque segment est peint de son jeton de graphique, aucun d’une teinte d’appartenance ou de conflit ; aucun « évitable »', async () => {
    const charge = chargeExcedent();
    const detail = detaillerQualite(charge, 1);
    expect(detail.collisions.lignes.map(({ groupe, cumulees, excedent }) => [groupe, cumulees, excedent])).toEqual([
      [RESSAC, 3, 2],
      [AUBIER, 4, 0],
    ]);
    const m = await ouvrir(charge);
    const collisions = await attendre(() => {
      const v = vue(m, 'collisions');
      expect(v.querySelectorAll('[data-ligne-graphique]')).toHaveLength(2);
      return v;
    });
    expect([...collisions.querySelectorAll('[data-ligne-graphique]')].map((g) => g.dataset.ligneGraphique)).toEqual([RESSAC, AUBIER]);
    const interdites = new Set(
      [
        '--couleur-conflit-appartenance',
        '--couleur-conflit-voisins',
        '--couleur-conflit-table',
        ...[1, 2, 3, 4, 5, 6].flatMap((k) => [`--couleur-appartenance-${k}-fond`, `--couleur-appartenance-${k}-marque`]),
      ].map(couleurDuJeton),
    );
    const segments = [...collisions.querySelectorAll('[data-segment]')];
    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      const genre = segment.dataset.segment;
      expect(['prouve', 'reste']).toContain(genre);
      const peint = getComputedStyle(segment).fill;
      expect(peint).toBe(couleurDuJeton(`--couleur-graphique-${genre}`));
      expect(interdites.has(peint), `${genre} peint ${peint}`).toBe(false);
    }
    // La pastille de chaque intitulé : le fond et le point de la teinte que
    // teintesAppartenances donne à l'appartenance sur les participants de
    // l'événement — deux teintes distinctes, aucune neutre.
    const teintes = teintesAppartenances(charge.participants);
    const pastilles = [...collisions.querySelectorAll('[data-ligne-graphique]')].map((g) => {
      const rang = teintes.get(g.dataset.ligneGraphique);
      expect(rang, g.dataset.ligneGraphique).toBeGreaterThanOrEqual(1);
      const fond = [...g.querySelectorAll('rect')].find((r) => !r.hasAttribute('data-segment'));
      const point = g.querySelector('circle');
      expect(getComputedStyle(fond).fill, g.dataset.ligneGraphique).toBe(couleurDuJeton(`--couleur-appartenance-${rang}-fond`));
      expect(getComputedStyle(point).fill, g.dataset.ligneGraphique).toBe(couleurDuJeton(`--couleur-appartenance-${rang}-marque`));
      return getComputedStyle(point).fill;
    });
    expect(new Set(pastilles).size).toBe(2);
    expect(pastilles).not.toContain(couleurDuJeton('--couleur-neutre-marque'));
    // Les chiffres de chaque ligne, en encre secondaire, après sa barre.
    expect(texteDe(collisions)).toContain(t('qualite.collisions.secondaire', { effectif: 2, paires: 1, excedent: 2 }));
    expect(texteDe(collisions)).not.toMatch(/(?<!in)évitable/i);
    const nom = collisions.querySelector('svg[data-graphique="collisions"]').getAttribute('aria-labelledby');
    expect(texteDe(document.getElementById(nom))).toBe(t('qualite.collisions.graphique'));
  });

  test('un plan qui laisse quelqu’un en réserve : un seul segment par barre, les collisions cumulées, et la phrase qui dit pourquoi', async () => {
    const reduit = [[1, 2], [3, 4, 5, 6], [7, 8, 9, 10], [11, 12]];
    const charge = chargeDe({ personnes: PERSONNES_MELANGE, capacites: [5, 4, 4, 3], tours: [PLAN_MELANGE, reduit], reserves: [[], [13]] });
    const m = await ouvrir(charge);
    const collisions = await attendre(() => {
      const v = vue(m, 'collisions');
      expect(v.querySelector('[data-phrase-qualite="collisionsHorsDomaine"]')).not.toBeNull();
      return v;
    });
    expect(texteDe(collisions.querySelector('[data-phrase-qualite="collisionsHorsDomaine"]'))).toBe(t('qualite.collisions.horsDomaine'));
    for (const ligne of collisions.querySelectorAll('[data-ligne-graphique]')) {
      expect([...ligne.querySelectorAll('[data-segment]')].map((s) => s.dataset.segment)).toEqual(['serie1']);
    }
    expect(collisions.querySelector('[data-segment="prouve"]')).toBeNull();
  });

  test('une seule table, aucune appartenance, aucune collision : la phrase du cas, sans graphique', async () => {
    const cas = [
      [chargeDe({ personnes: PERSONNES_SIX, capacites: [6], tours: [[[1, 2, 3, 4, 5, 6]], [[1, 2, 3, 4, 5, 6]]] }), 'collisionsUneTable'],
      [chargeSix({ personnes: PERSONNES_SIX.map(([nom, prenom]) => [nom, prenom, null]) }), 'collisionsAucuneAppartenance'],
      [chargeSix(), 'collisionsAucune'],
    ];
    for (const [charge, code] of cas) {
      const m = await ouvrir(charge);
      const collisions = await attendre(() => {
        const v = vue(m, 'collisions');
        expect(v.querySelector(`[data-phrase-qualite="${code}"]`)).not.toBeNull();
        return v;
      });
      expect(collisions.querySelector('svg[data-graphique]')).toBeNull();
      expect(collisions.querySelector('[data-commande="ouvrirJumeau"]')).toBeNull();
    }
  });
});

// --- Les appartenances à chaque table ----------------------------------------------

describe('appartenances à chaque table (§ 12.11, B20, D35)', () => {
  test('sous chacune des trois positions : la pire table en tête, l’ordre de la position, chaque case écrit le compte que son niveau colore, sans « % » ; la table de bénévoles écrit « — » et vient en dernier', async () => {
    const charge = chargeMelange();
    const detail = detaillerQualite(charge, 1);
    const m = await ouvrir(charge);
    await attendre(() => expect(positionCochee(m)).toBe('sieges'));
    for (const position of POSITIONS) {
      await choisir(m, position);
      const svg = await attendre(() => {
        const s = vue(m, 'tables').querySelector('svg[data-graphique="tables"]');
        expect(s).not.toBeNull();
        expect(intitulesGrille(s)).toEqual(ORDRES[position].map((numero) => `Table ${numero}`));
        return s;
      });
      expect(detail.tables.ordres[position].map((i) => detail.numerosTables[i])).toEqual(ORDRES[position]);
      const cases = casesDe(svg);
      expect(cases).toHaveLength(8);
      // Deux tours ne font pas de cases géantes : la case ne dépasse pas
      // CASE_MAX_TEXTES hauteurs de ligne du compte qu'elle écrit.
      const ligneTexte = svg.querySelector('[data-case] text').getBBox().height;
      expect(Math.max(...cases.map((c) => c.cote))).toBeLessThanOrEqual(CASE_MAX_TEXTES * ligneTexte + 1);
      for (const c of cases) {
        const attendu = COMPTES[position][ORDRES[position][c.ligne]];
        expect(c.texte).not.toMatch(/%/);
        if (attendu === null) {
          expect(c.texte, position).toBe(t('format.vide'));
          expect(c.fond).toBeNull();
          continue;
        }
        expect(c.texte, `${position} ${c.ligne}:${c.colonne}`).toBe(String(attendu));
        const n = niveau(Number(c.texte));
        expect(c.fond).toBe(couleurDuJeton(`--couleur-graphique-niveau-${n}`));
        expect(c.marque).toBe(n === 0 ? null : `graphiqueNiveau${n}`);
      }
      // La table de bénévoles, sans affilié, en dernière ligne.
      expect(intitulesGrille(svg).at(-1)).toBe('Table 4');
    }
  });

  test('l’infobulle d’une case : le pourcentage de la position puis ses deux comptes, occupants, affiliés, capacité', async () => {
    const m = await ouvrir(chargeMelange());
    const svg = await attendre(() => {
      const s = vue(m, 'tables').querySelector('svg[data-graphique="tables"]:not([data-dessin-differe])');
      expect(s).not.toBeNull();
      return s;
    });
    // Sous « sièges », la case 0:0 est la table 1 au tour 1 : δ = 2 pour 5 sièges.
    const case00 = svg.querySelector('[data-case="0:0"]');
    case00.scrollIntoView({ block: 'center' });
    const boite = case00.getBoundingClientRect();
    await pointer('bouger', boite.left + boite.width / 2, boite.top + boite.height / 2);
    const bulle = await attendre(() => {
      const b = vue(m, 'tables').querySelector('[role="tooltip"]');
      expect(b.hidden).toBe(false);
      return b;
    });
    expect(bulle.querySelector('[data-pourcentage]').textContent).toBe('40\u{202F}%');
    expect(texteDe(bulle.querySelector('[data-compte-pire]'))).toBe('2 appartenances pour 5 sièges');
    for (const fragment of ['Table 1', 'Tour 1', t('qualite.tables.colonne.occupants'), t('qualite.tables.colonne.capacite')]) {
      expect(texteDe(bulle)).toContain(fragment);
    }
    await pointer('bouger', 2, 2);
  });

  test('le jumeau : une ligne par table et tour dans l’ordre de la position, les trois comptes, chaque pourcentage suivi du compte de sa ligne', async () => {
    const m = await ouvrir(chargeMelange());
    await choisir(m, 'doublons');
    const tableau = await ouvrirJumeau(vue(m, 'tables'));
    const lignes = lignesJumeau(tableau);
    expect(lignes.map((l) => l.table)).toEqual(['Table 2', 'Table 2', 'Table 3', 'Table 3', 'Table 1', 'Table 1', 'Table 4', 'Table 4']);
    expect(lignes[2]).toMatchObject({ tour: 'Tour 1', sieges: '3', assis: '3', doublons: '1', occupants: '4', affilies: '2', capacite: '4' });
    const cellule = tableau.querySelectorAll('tbody tr')[2].querySelector('[data-colonne="pourcentDoublons"]');
    expect(cellule.querySelector('[data-pourcentage]').textContent).toBe('50\u{202F}%');
    expect(texteDe(cellule.querySelector('[data-compte-pire]'))).toBe('1 appartenance pour 2 affiliés');
    expect(lignes[7].doublons).toBe(t('format.vide'));
    for (const pourcentage of tableau.querySelectorAll('[data-pourcentage]')) {
      expect(pourcentage.nextElementSibling?.hasAttribute('data-compte-pire')).toBe(true);
    }
    expect(tableau.querySelectorAll('[data-pourcentage]')).toHaveLength(8 * 3);
  });

  test('le sélecteur au clavier : la flèche passe à la position suivante ; les deux graphiques de la page ont des noms distincts', async () => {
    const m = await ouvrir(chargeMelange());
    await attendre(() => expect(radio(m, 'sieges')).not.toBeNull());
    radio(m, 'sieges').focus();
    await touche('ArrowRight');
    await attendre(() => expect(positionCochee(m)).toBe('assis'));
    expect(m.ui.etat().melangeTables).toBe('assis');
    expect(document.activeElement).toBe(radio(m, 'assis'));
    await touche('ArrowRight');
    await attendre(() => expect(m.ui.etat().melangeTables).toBe('doublons'));
    const noms = ['collisions', 'tables'].map((nom) => {
      const svg = vue(m, nom).querySelector(`svg[data-graphique="${nom}"]`);
      return texteDe(document.getElementById(svg.getAttribute('aria-labelledby')));
    });
    expect(noms[0]).not.toBe(noms[1]);
    expect(noms.every((nom) => nom.length > 0)).toBe(true);
  });

  test('la position survit à un aller-retour vers le plan et repart de « sièges » à la réouverture de l’événement', async () => {
    const m = await ouvrir(chargeMelange());
    await choisir(m, 'doublons');
    m.ui.allerA('plan');
    flushSync();
    m.ui.allerA('qualite');
    await attendre(() => expect(positionCochee(m)).toBe('doublons'));
    await m.seance.fermer();
    await m.seance.ouvrir(BASE);
    m.ui.montrerProposition(1);
    m.ui.allerA('qualite');
    await attendre(() => expect(positionCochee(m)).toBe('sieges'));
  });

  for (const [cas, fabriquer] of [
    ['en lecture', () => chargeMelange()],
    [
      'sur un plan bloqué',
      () => executer(executer(chargeMelange(), 'retenirProposition', { id: 1 }), 'changerEtat', { etat: 'bloque' }),
    ],
  ]) {
    test(`${cas} : chaque position se choisit sans refus ni écriture`, async () => {
      const charge = fabriquer();
      const m = await ouvrir(charge, { mode: 'lecture', proposition: cas === 'en lecture' ? 1 : null });
      await attendre(() => expect(radio(m, 'sieges')).not.toBeNull());
      const ecritures = m.trace.length;
      for (const position of ['assis', 'doublons', 'sieges']) {
        await choisir(m, position);
        expect(m.ui.etat().melangeTables).toBe(position);
      }
      expect(m.racine.querySelector('[data-refus]')).toBeNull();
      expect(m.trace.length).toBe(ecritures);
    });
  }

  test('sans collision : sous « doublons », la phrase des collisions tient lieu de grille, le sélecteur reste ; sous « sièges », la grille', async () => {
    const charge = chargeSix();
    expect(sansCollision(detaillerQualite(charge, 1))).toBe(true);
    const m = await ouvrir(charge);
    const tables = await attendre(() => {
      const v = vue(m, 'tables');
      expect(v.querySelector('svg[data-graphique="tables"]')).not.toBeNull();
      return v;
    });
    await choisir(m, 'doublons');
    await attendre(() => expect(tables.querySelector('[data-phrase-qualite="tablesSansCollision"]')).not.toBeNull());
    expect(texteDe(tables.querySelector('[data-phrase-qualite="tablesSansCollision"]'))).toBe(t('qualite.collisions.aucune'));
    expect(tables.querySelector('svg[data-graphique="tables"]')).toBeNull();
    expect(tables.querySelectorAll('[data-position-tables]')).toHaveLength(3);
  });

  test('une seule appartenance : les barres, la grille et le sélecteur, comme pour plusieurs (B15)', async () => {
    const m = await ouvrir(chargeUneAppartenance());
    const tables = await attendre(() => {
      const v = vue(m, 'tables');
      expect(v.querySelector('svg[data-graphique="tables"]:not([data-dessin-differe])')).not.toBeNull();
      return v;
    });
    expect(tables.querySelectorAll('[data-position-tables]')).toHaveLength(3);
    expect(tables.querySelector('[data-phrase-qualite]')).toBeNull();
    const collisions = vue(m, 'collisions');
    expect(collisions.querySelector('svg[data-graphique="collisions"]')).not.toBeNull();
    expect([...collisions.querySelectorAll('[data-ligne-graphique]')].map((g) => g.dataset.ligneGraphique)).toEqual([AUBIER]);
    expect(collisions.querySelector('[data-phrase-qualite]')).toBeNull();
    for (const position of ['assis', 'doublons']) {
      await choisir(m, position);
      await attendre(() => expect(tables.querySelector('svg[data-graphique="tables"]')).not.toBeNull());
    }
  });

  test('la vue ne borne pas la largeur de la grille : à un tour, des intitulés longs, le dessin prend la largeur de la carte', async () => {
    const charge = chargeDe({ personnes: PERSONNES_SIX, capacites: [3, 3], tours: [[[1, 2, 5], [3, 4, 6]]], premier: 1000 });
    const m = await ouvrir(charge);
    const svg = await attendre(() => {
      const s = vue(m, 'tables').querySelector('svg[data-graphique="tables"]');
      expect(s).not.toBeNull();
      expect(intitulesGrille(s)).toEqual(['Table 1000', 'Table 1001']);
      return s;
    });
    const carte = vue(m, 'tables').getBoundingClientRect().width;
    expect(svg.getBoundingClientRect().width).toBeGreaterThanOrEqual(0.8 * carte);
  });

  test('une seule table, aucune appartenance : la phrase, sans sélecteur ni grille', async () => {
    const cas = [
      [chargeDe({ personnes: PERSONNES_SIX, capacites: [6], tours: [[[1, 2, 3, 4, 5, 6]], [[1, 2, 3, 4, 5, 6]]] }), 'tablesUneTable'],
      [chargeSix({ personnes: PERSONNES_SIX.map(([nom, prenom]) => [nom, prenom, null]) }), 'tablesAucuneAppartenance'],
    ];
    for (const [charge, code] of cas) {
      const m = await ouvrir(charge);
      const tables = await attendre(() => {
        const v = vue(m, 'tables');
        expect(v.querySelector(`[data-phrase-qualite="${code}"]`)).not.toBeNull();
        return v;
      });
      expect(tables.querySelector('[data-position-tables]')).toBeNull();
      expect(tables.querySelector('svg[data-graphique]')).toBeNull();
    }
  });

  test('quarante tours au cadre de 1 366 px : chaque case tient 24 px dans la carte ; cent tours : la phrase et le jumeau ouvert, le sélecteur restant', async () => {
    const m = await ouvrir(chargeSix({ tours: 40 }));
    const svg = await attendre(() => {
      const s = vue(m, 'tables').querySelector('svg[data-graphique="tables"]');
      expect(s).not.toBeNull();
      expect(s.querySelectorAll('[data-case]')).toHaveLength(80);
      return s;
    });
    const cases = casesDe(svg);
    expect(Math.min(...cases.map((c) => c.cote))).toBeGreaterThanOrEqual(24);
    const carte = vue(m, 'tables').getBoundingClientRect();
    for (const g of svg.querySelectorAll('[data-case]')) {
      const boite = g.getBoundingClientRect();
      expect(boite.right).toBeLessThanOrEqual(carte.right);
      expect(boite.left).toBeGreaterThanOrEqual(carte.left);
    }
    // Cent tours ne tiennent pas : la grille cède la place à sa phrase et à
    // son jumeau, ouvert ; le sélecteur reste.
    const large = await ouvrir(chargeSix({ tours: 100 }));
    const tables = await attendre(() => {
      const v = vue(large, 'tables');
      expect(v.querySelector('[data-jumeau="0"]')).not.toBeNull();
      return v;
    });
    expect(tables.querySelector('svg[data-graphique="tables"]')).toBeNull();
    expect(texteDe(tables)).toContain(t('qualite.tables.tropLarge'));
    expect(tables.querySelectorAll('[data-position-tables]')).toHaveLength(3);
    expect(tables.querySelector('[data-commande="fermerJumeau"]')).not.toBeNull();
    expect(tables.querySelectorAll('[data-jumeau="0"] tbody tr')).toHaveLength(200);
  });
});

describe('la grande démonstration : le poids des deux vues', () => {
  test('les nœuds des vues des collisions et des tables, relevés sur la grande', async () => {
    const charge = generee(chargeDemo('grande'), { graine: 2, nombre: 1, arret: 50 });
    const m = await ouvrir(charge);
    const noeuds = await attendre(() => {
      const comptes = ['collisions', 'tables'].map((nom) => {
        const v = vue(m, nom);
        expect(v.querySelector('svg[data-graphique]')).not.toBeNull();
        return v.querySelectorAll('*').length + 1;
      });
      return comptes;
    });
    console.info(`nœuds : collisions ${noeuds[0]}, tables ${noeuds[1]}`);
    expect(noeuds[0] + noeuds[1]).toBeLessThan(1500);
  });
});
