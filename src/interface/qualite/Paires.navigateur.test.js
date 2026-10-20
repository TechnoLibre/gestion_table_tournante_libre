// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La vue des paires répétées dans un vrai moteur de rendu (§ 12.5, B14,
// D32, D33, D50) : sur 12 / 4 × 3 / 6, le tableau des paires choisies puis,
// sous leur intitulé, des paires imposées ; la première commande d'une
// ligne mène au plan au premier tour où la paire se revoit, la première
// personne mise en évidence, et chaque tour à son tour ; la ligne n'est pas
// une cible ; la matrice dans l'ordre du profil, et sa phrase quand elle
// est trop étroite ou au-delà du seuil ; les pages de cent ; les cas d'une
// table et d'un tour. Les épreuves de la page montent App (monterApp) au
// cadre de 1 366 × 700 ; celles des pages montent la vue seule, sur un
// détail forgé. Le rendu se lit par le texte et les attributs data-…,
// jamais par une classe. Les noms d'épreuve sont inventés.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import '../jetons.css';
import { appliquerCommande } from '../../application/commandes.js';
import { detaillerQualite } from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { constante } from '../../geometrie/constantes.js';
import { rechercher } from '../../moteur/recherche.js';
import { serialiser } from '../../stockage/canonique.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { dessinerGraphiques, fixerCadre } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { creerEtatUi } from '../etat_ui.js';
import { TABLES_INTERFACE } from '../libelles.js';
import VuePaires from './VuePaires.svelte';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);
const V1 = VERSION.affichee;
const BASE = 'soiree';

// --- Les charges d'épreuve -------------------------------------------------------

// Des noms inventés, assez pour quarante personnes : prénom et nom se
// combinent.
const PRENOMS = ['Iris', 'Théo', 'Ondine', 'Basile', 'Maëlle', 'Sidonie', 'Aurèle', 'Clovis'];
const NOMS = ['Ombrelle', 'Pervenche', 'Lacasse', 'Tourteau', 'Quenouille'];
const APPARTENANCES = ['Coopérative Aubier', 'Atelier Ressac', null];

// n personnes inventées, t tables de s places numérotées 10 + identifiant,
// r tours ; avec reserver, les deux premières sont réservées ensemble à la
// table 1 à chaque tour : leur paire est imposée.
function chargeDe({ n, tables, sieges, tours, reserver = false }) {
  const charge = creerCharge({ id: 'evt-paires', nom: 'Atelier Ressac', siegesParDefaut: sieges, tours });
  charge.participants = Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    nom: NOMS[Math.floor(i / PRENOMS.length) % NOMS.length],
    prenom: PRENOMS[i % PRENOMS.length],
    appartenance: APPARTENANCES[i % APPARTENANCES.length],
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = Array.from({ length: tables }, (_, i) => ({
    id: i + 1,
    numero: 11 + i,
    sieges: null,
    forme: 'ronde',
    position: { x: 300 * (i + 1), y: 0 },
  }));
  if (reserver) charge.reservations = [1, 2].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
  charge.prochainsIds = { participant: n + 1, table: tables + 1, proposition: 1 };
  return charge;
}

// 12 personnes, 4 tables de 3, 6 tours (§ 12.5) : une répétition au moins
// pour chacun ; la paire 1:2 est imposée.
const chargeDouze = () => chargeDe({ n: 12, tables: 4, sieges: 3, tours: 6, reserver: true });

// La charge, une génération de plus, enregistrée par la commande.
function generee(charge, reglages = { graine: 5, arret: 60, nombre: 2 }) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, reglages);
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

const chargeDemo = (cle) => analyser(texteLivre(cle)).charge;

// --- Le montage --------------------------------------------------------------------

let montes = [];
let vues = [];
beforeEach(async () => {
  await fixerCadre(1366, 700);
});
afterEach(async () => {
  const erreurs = montes.flatMap((m) => m.erreurs());
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  for (const { composant, cible } of vues.splice(0)) {
    unmount(composant);
    cible.remove();
  }
  window.scrollTo(0, 0);
  await fixerCadre(1366, 700);
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

// La charge posée en fichier d'état, ouverte en écriture par la séance, sa
// première proposition montrée au plan, la page de qualité ouverte.
async function ouvrir(charge, { montrer = charge.propositions[0]?.id ?? null } = {}) {
  const texte = serialiser(charge, { revision: 1, produitVersion: V1 });
  const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `${BASE}${SUFFIXES.etat}`, texte }] });
  montes.push(m);
  await m.seance.ouvrir(BASE);
  await m.seance.passerEnEcriture();
  if (montrer !== null) m.ui.montrerProposition(montrer);
  m.ui.allerA('qualite');
  flushSync();
  return m;
}

const vueDe = (m) => m.racine.querySelector('[data-vue-qualite="paires"]');
const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const commandes = (racine, nom) => [...racine.querySelectorAll(`[data-commande="${nom}"]`)];
const phrases = (racine) => [...racine.querySelectorAll('[data-phrase-qualite]')].map((p) => p.dataset.phraseQualite);

// La vue des paires, rendue, sous la page ouverte.
const vueRendue = (m) =>
  attendre(() => {
    const vue = vueDe(m);
    expect(vue).not.toBeNull();
    expect(vue.querySelector('[data-paire], [data-phrase-qualite]')).not.toBeNull();
    return vue;
  });

// La vue seule, montée sur un détail forgé, dans une boîte de la largeur
// donnée. Le détail se lit dans une SvelteMap, sous la clé 'detail' : la
// changer change la propriété de la vue, comme une autre proposition
// montrée.
async function monterVue(detail, largeur = 1100) {
  const cible = document.createElement('div');
  cible.style.width = `${largeur}px`;
  document.body.prepend(cible);
  const ui = creerEtatUi();
  const contexte = new Map([
    ['t', t],
    ['format', format],
    ['ui', ui],
  ]);
  const proprietes = new SvelteMap([['detail', detail]]);
  const props = {
    get detail() {
      return proprietes.get('detail');
    },
    ligne: null,
    table: null,
  };
  const composant = mount(VuePaires, { target: cible, props, context: contexte });
  vues.push({ composant, cible });
  flushSync();
  await tick();
  flushSync();
  return { cible, ui, proprietes };
}

// Un détail forgé : n personnes, une table, quatre tours, les paires
// choisies et imposées données, sans matrice.
function detailForge({ n, choisies, imposees }) {
  return {
    id: 1,
    statut: 'comparable',
    raisons: [],
    population: { mesuree: n, exclue: 0 },
    T: 4,
    R: 4,
    G: 1,
    idsTables: [1, 2, 3, 4],
    numerosTables: [1, 2, 3, 4],
    personnes: Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      nom: `${PRENOMS[i % PRENOMS.length]} ${NOMS[Math.floor(i / PRENOMS.length) % NOMS.length]}`,
      appartenance: null,
      statut: 'mobile',
    })),
    paires: { choisies, imposees },
    matrice: null,
  };
}

// --- Les épreuves -----------------------------------------------------------------

describe('le tableau des paires sur 12 / 4 × 3 / 6 (§ 12.5, D32)', () => {
  const lue = generee(chargeDouze());
  const id = lue.propositions[0].id;
  const detail = detaillerQualite(lue, id);
  const nomDe = (personne) => detail.personnes.find((candidate) => candidate.id === personne).nom;

  test('les paires choisies, puis les imposées sous leur intitulé : chaque ligne nomme la paire, son nombre de fois et ses tours', async () => {
    const m = await ouvrir(lue);
    const vue = await vueRendue(m);
    const tableaux = [...vue.querySelectorAll('table')].filter((tableau) => tableau.querySelector('[data-paire]') !== null);
    expect(tableaux.map((tableau) => texteDe(tableau.querySelector('caption')))).toEqual([
      t('qualite.paires.choisies'),
      t('qualite.paires.imposees'),
    ]);
    const [choisies, imposees] = tableaux.map((tableau) => [...tableau.querySelectorAll('[data-paire]')].map((ligne) => ligne.dataset.paire));
    expect(choisies.length).toBeGreaterThan(0);
    expect(choisies).toEqual(detail.paires.choisies.map(({ a, b }) => `${a}:${b}`));
    expect(imposees).toEqual(['1:2']);
    expect(choisies).not.toContain('1:2');
    const imposee = vue.querySelector('[data-paire="1:2"]');
    expect(texteDe(imposee)).toContain('Iris Ombrelle');
    expect(texteDe(imposee)).toContain('Théo Ombrelle');
    expect(texteDe(imposee)).toContain('Coopérative Aubier');
    expect(texteDe(imposee)).toContain(t('qualite.paires.fois', { fois: 6 }));
    const tours = commandes(imposee, 'allerAuTour').map(texteDe);
    expect(tours).toEqual([
      t('qualite.paires.premierTour', { tour: 2 }),
      ...[1, 2, 3, 4, 5, 6].map((tour) => t('qualite.paires.tour', { tour, table: 11 })),
    ]);
    expect(texteDe(vue)).toContain(t('qualite.paires.pages.etendue', { premier: 1, dernier: choisies.length + 1, total: choisies.length + 1 }));
  });

  test('la première commande de chaque ligne mène au plan au premier tour où la paire se revoit, la première personne mise en évidence', async () => {
    const m = await ouvrir(lue);
    const paires = [...detail.paires.choisies, ...detail.paires.imposees];
    for (const { a, b, tours } of paires) {
      m.ui.allerA('qualite');
      const vue = await vueRendue(m);
      const premiere = commandes(vue.querySelector(`[data-paire="${a}:${b}"]`), 'allerAuTour')[0];
      expect(texteDe(premiere)).toBe(t('qualite.paires.premierTour', { tour: tours[1].tour + 1 }));
      premiere.click();
      flushSync();
      const etat = m.ui.etat();
      expect([etat.section, etat.tour, etat.miseEnEvidence, etat.proposition], `${a}:${b}`).toEqual(['plan', tours[1].tour + 1, a, id]);
      expect(tours[1].tour).not.toBe(tours[0].tour);
    }
  });

  test('chaque tour d’une ligne est une commande sœur qui mène au plan à ce tour', async () => {
    const m = await ouvrir(lue);
    const { a, b, tours } = detail.paires.choisies[0];
    for (const [rang, { tour, table }] of tours.entries()) {
      m.ui.allerA('qualite');
      const vue = await vueRendue(m);
      const ligne = vue.querySelector(`[data-paire="${a}:${b}"]`);
      const bouton = commandes(ligne, 'allerAuTour')[rang + 1];
      const libelle = t('qualite.paires.tour', { tour: tour + 1, table: 10 + table });
      expect(texteDe(bouton)).toBe(libelle);
      expect(bouton.getAttribute('aria-label')).toBe(t('qualite.paires.tourNom', { tour: tour + 1, table: 10 + table, a: nomDe(a), b: nomDe(b) }));
      bouton.click();
      flushSync();
      expect([m.ui.etat().section, m.ui.etat().tour, m.ui.etat().miseEnEvidence]).toEqual(['plan', tour + 1, a]);
    }
  });

  test('une ligne n’est pas une cible : un clic sur la paire ou son nombre de fois ne quitte pas la page, et rien d’autre que ses commandes ne prend le focus', async () => {
    const m = await ouvrir(lue);
    const vue = await vueRendue(m);
    for (const ligne of vue.querySelectorAll('[data-paire]')) {
      expect(ligne.hasAttribute('tabindex')).toBe(false);
      expect(ligne.getAttribute('role')).toBeNull();
      for (const cellule of ligne.querySelectorAll('th, td:not(:last-child)')) {
        cellule.click();
        flushSync();
        expect(m.ui.etat().section).toBe('qualite');
      }
      const focalisables = [...ligne.querySelectorAll('button, a, [tabindex]')];
      expect(focalisables.every((element) => element.dataset.commande === 'allerAuTour')).toBe(true);
    }
    expect(m.ui.etat().miseEnEvidence).toBe(null);
  });

  test('les commandes portent des noms accessibles distincts, chacun contenant son libellé', async () => {
    const m = await ouvrir(lue);
    const vue = await vueRendue(m);
    const noms = commandes(vue, 'allerAuTour').map((bouton) => [texteDe(bouton), bouton.getAttribute('aria-label')]);
    expect(noms.every(([libelle, nom]) => nom !== null && nom.startsWith(libelle))).toBe(true);
    expect(new Set(noms.map(([, nom]) => nom)).size).toBe(noms.length);
  });
});

describe('la matrice « qui a rencontré qui » (§ 12.5, D33)', () => {
  const lue = generee(chargeDouze());
  const id = lue.propositions[0].id;
  const detail = detaillerQualite(lue, id);

  test('sous le seuil, à 1 366 px : la grille 12 × 12 dans l’ordre du profil, les comptes du détail écrits, la diagonale vide, aucune case cible', async () => {
    const m = await ouvrir(lue);
    const vue = await vueRendue(m);
    const grille = await attendre(() => {
      const trouvee = vue.querySelector('[data-graphique="matrice"]');
      expect(trouvee).not.toBeNull();
      expect(trouvee.querySelectorAll('[data-case]')).toHaveLength(144);
      return trouvee;
    });
    const ordre = detail.profil.map(({ id: personne }) => personne);
    expect(detail.matrice.ordre).toEqual(ordre);
    const parId = new Map(detail.personnes.map(({ id: personne, nom }) => [personne, nom]));
    const intitules = [...grille.querySelectorAll('text')].map((texte) => texte.textContent).filter((texte) => /^\d+\. /.test(texte));
    expect(intitules).toEqual(ordre.map((personne, i) => `${i + 1}. ${parId.get(personne)}`));
    const n = ordre.length;
    let k = 0;
    for (let i = 0; i < n; i += 1) {
      expect(texteDe(grille.querySelector(`[data-case="${i}:${i}"]`))).toBe('');
      for (let j = i + 1; j < n; j += 1) {
        const attendu = String(detail.matrice.comptes[k]);
        expect(texteDe(grille.querySelector(`[data-case="${i}:${j}"]`)), `${i}:${j}`).toBe(attendu);
        expect(texteDe(grille.querySelector(`[data-case="${j}:${i}"]`)), `${j}:${i}`).toBe(attendu);
        k += 1;
      }
    }
    expect(grille.querySelector('[data-case] [tabindex], [data-case] button, [data-case][tabindex]')).toBeNull();
    expect(phrases(vue)).not.toContain('matriceEtroite');
    // Le jumeau porte les mêmes comptes, une ligne par personne.
    commandes(vue, 'ouvrirJumeau')[0].click();
    flushSync();
    const jumeau = vue.querySelector('[data-jumeau]');
    expect(jumeau.querySelectorAll('tbody tr')).toHaveLength(n);
    const i = ordre.indexOf(1);
    const j = ordre.indexOf(2);
    expect(texteDe(jumeau.querySelectorAll('tbody tr')[i].querySelector(`[data-colonne="c${j}"]`))).toBe('6');
  });

  test('sous le seuil mais trop étroite à 1 024 px : la phrase de la matrice non dessinée, qui renvoie à la fiche', async () => {
    const n = constante('SEUIL_MATRICE_PARTICIPANTS');
    const lue40 = generee(chargeDe({ n, tables: n / 4, sieges: 4, tours: 3 }), { graine: 2, arret: 20, nombre: 1 });
    await fixerCadre(1024, 700);
    const m = await ouvrir(lue40);
    const vue = await vueRendue(m);
    await attendre(() => expect(phrases(vue)).toContain('matriceEtroite'));
    expect(vue.querySelector('[data-graphique="matrice"]')).toBeNull();
    expect(texteDe(vue)).toContain(t('qualite.paires.matrice.etroite'));
    expect(commandes(vue, 'ouvrirJumeau')).toHaveLength(0);
  });

  // Un arrêt court laisse beaucoup de paires revues : la page de cent est
  // pleine, la vue à son plus lourd. Le budget de 1 500 nœuds vaut pour la
  // page entière et se mesure avec elle ; cette épreuve borne la part de la
  // vue seule, PART_DES_PAIRES, sa page pleine et une marge de quelques
  // lignes.
  const PART_DES_PAIRES = 1400;
  test('la grande : aucune matrice, la phrase du seuil ; cent lignes au plus, la vue dans sa part du budget de la page', async () => {
    const lueGrande = generee(chargeDemo('grande'), { graine: 1, nombre: 1, arret: 50 });
    const m = await ouvrir(lueGrande);
    const vue = await vueRendue(m);
    expect(phrases(vue)).toContain('matriceSeuil');
    expect(vue.querySelector('[data-graphique]')).toBeNull();
    const mesuree = detaillerQualite(lueGrande, lueGrande.propositions[0].id).population.mesuree;
    expect(texteDe(vue)).toContain(
      t('qualite.paires.matrice.seuil', { participants: format.nombre(mesuree), seuil: format.nombre(constante('SEUIL_MATRICE_PARTICIPANTS')) }),
    );
    expect(vue.querySelectorAll('[data-paire]').length).toBeLessThanOrEqual(100);
    expect(vue.querySelectorAll('*').length).toBeLessThanOrEqual(PART_DES_PAIRES);
  });
});

describe('les pages de cent (§ 5.7, D50)', () => {
  // 250 paires forgées sur 30 personnes : 180 choisies, puis 70 imposées.
  const paires = [];
  for (let a = 1; a <= 30 && paires.length < 250; a += 1) {
    for (let b = a + 1; b <= 30 && paires.length < 250; b += 1) {
      paires.push({ a, b, fois: 2, tours: [{ tour: 0, table: 1 }, { tour: 2, table: 2 }] });
    }
  }
  const detail = detailForge({ n: 30, choisies: paires.slice(0, 180), imposees: paires.slice(180) });

  test('250 paires font trois pages : l’étendue et le total écrits, les commandes de page, les imposées à la suite des choisies', async () => {
    const { cible } = await monterVue(detail);
    const lignes = () => [...cible.querySelectorAll('[data-paire]')].map((ligne) => ligne.dataset.paire);
    const etendue = (premier, dernier) => t('qualite.paires.pages.etendue', { premier, dernier, total: 250 });
    expect(lignes()).toHaveLength(100);
    expect(texteDe(cible)).toContain(etendue(1, 100));
    expect(commandes(cible, 'precedentes')).toHaveLength(0);
    commandes(cible, 'suivantes')[0].click();
    await tick();
    flushSync();
    expect(lignes()).toHaveLength(100);
    expect(lignes()[0]).toBe(`${paires[100].a}:${paires[100].b}`);
    expect(lignes()[80]).toBe(`${paires[180].a}:${paires[180].b}`);
    expect(texteDe(cible)).toContain(etendue(101, 200));
    expect([...cible.querySelectorAll('caption')].map(texteDe)).toEqual([t('qualite.paires.choisies'), t('qualite.paires.imposees')]);
    commandes(cible, 'suivantes')[0].click();
    await tick();
    flushSync();
    expect(lignes()).toHaveLength(50);
    expect(texteDe(cible)).toContain(etendue(201, 250));
    expect([...cible.querySelectorAll('caption')].map(texteDe)).toEqual([t('qualite.paires.imposees')]);
    expect(commandes(cible, 'suivantes')).toHaveLength(0);
    await attendre(() => expect(texteDe(document.activeElement)).toBe(etendue(201, 250)));
    commandes(cible, 'precedentes')[0].click();
    await tick();
    flushSync();
    expect(texteDe(cible)).toContain(etendue(101, 200));
  });

  test('une autre proposition montrée s’ouvre à sa première page ; la même, remesurée, garde la sienne', async () => {
    const { cible, proprietes } = await monterVue(detail);
    const etendue = (premier, dernier) => t('qualite.paires.pages.etendue', { premier, dernier, total: 250 });
    commandes(cible, 'suivantes')[0].click();
    await tick();
    flushSync();
    expect(texteDe(cible)).toContain(etendue(101, 200));
    // Le même détail, remesuré : un nouvel objet, le même identifiant.
    proprietes.set('detail', structuredClone(detail));
    flushSync();
    expect(texteDe(cible)).toContain(etendue(101, 200));
    // Une autre proposition, autant de paires.
    proprietes.set('detail', { ...structuredClone(detail), id: detail.id + 1 });
    flushSync();
    expect(texteDe(cible)).toContain(etendue(1, 100));
    expect(texteDe(cible)).not.toContain(etendue(101, 200));
    expect(cible.querySelector('[data-paire]').dataset.paire).toBe(`${paires[0].a}:${paires[0].b}`);
  });
});

describe('les homonymes (§ 12.6)', () => {
  // Deux personnes mesurées du même nom et de la même appartenance, chacune
  // revue par la troisième au tour 3 : seul l'identifiant les distingue.
  const detail = {
    ...detailForge({ n: 3, choisies: [], imposees: [] }),
    personnes: [
      { id: 1, nom: 'Iris Ombrelle', appartenance: 'Coopérative Aubier', statut: 'mobile' },
      { id: 2, nom: 'Iris Ombrelle', appartenance: 'Coopérative Aubier', statut: 'mobile' },
      { id: 3, nom: 'Ondine Lacasse', appartenance: 'Atelier Ressac', statut: 'mobile' },
    ],
    paires: {
      choisies: [
        { a: 1, b: 3, fois: 2, tours: [{ tour: 0, table: 1 }, { tour: 2, table: 1 }] },
        { a: 2, b: 3, fois: 2, tours: [{ tour: 1, table: 2 }, { tour: 2, table: 1 }] },
      ],
      imposees: [],
    },
  };

  test('chaque ligne écrit l’identifiant de l’homonyme, et les noms accessibles de ses commandes le portent : aucun ne se répète', async () => {
    const { cible } = await monterVue(detail);
    for (const id of [1, 2]) {
      const ligne = cible.querySelector(`[data-paire="${id}:3"]`);
      expect(texteDe(ligne)).toContain(t('qualite.paires.homonyme', { id }));
      expect(texteDe(ligne)).not.toContain(t('qualite.paires.homonyme', { id: 3 - id }));
      for (const bouton of commandes(ligne, 'allerAuTour')) {
        expect(bouton.getAttribute('aria-label')).toContain(t('qualite.paires.homonyme', { id }));
      }
    }
    const noms = commandes(cible, 'allerAuTour').map((bouton) => bouton.getAttribute('aria-label'));
    expect(noms).toHaveLength(6);
    expect(new Set(noms).size).toBe(noms.length);
    expect(noms.every((nom) => !nom.includes(t('qualite.paires.homonyme', { id: 3 })))).toBe(true);
  });
});

describe('les cas de la vue (§ 12.6)', () => {
  test('une seule table : la phrase, ni tableau ni matrice', async () => {
    const lue = generee(chargeDe({ n: 4, tables: 1, sieges: 4, tours: 2 }), { graine: 1, arret: 10, nombre: 1 });
    const m = await ouvrir(lue);
    const vue = await vueRendue(m);
    expect(phrases(vue)).toEqual(['pairesUneTable']);
    expect(vue.querySelector('[data-paire], [data-graphique]')).toBeNull();
    expect(texteDe(vue)).toContain(t('qualite.paires.uneTable'));
  });

  test('un seul tour : la phrase au lieu du tableau, jamais un tableau vide ; la matrice reste', async () => {
    const lue = generee(chargeDe({ n: 6, tables: 2, sieges: 3, tours: 1 }), { graine: 1, arret: 10, nombre: 1 });
    const m = await ouvrir(lue);
    const vue = await vueRendue(m);
    expect(phrases(vue)).toEqual(['pairesUnTour']);
    expect(vue.querySelector('[data-paire], table')).toBeNull();
    await attendre(() => expect(vue.querySelector('[data-graphique="matrice"]')).not.toBeNull());
  });

  test('aucune paire revue : la phrase, sans tableau', async () => {
    const lue = generee(chargeDe({ n: 9, tables: 3, sieges: 3, tours: 2 }), { graine: 1, arret: 200, nombre: 1 });
    const detail = detaillerQualite(lue, lue.propositions[0].id);
    expect(detail.paires.choisies.length + detail.paires.imposees.length).toBe(0);
    const m = await ouvrir(lue);
    const vue = await vueRendue(m);
    expect(phrases(vue)).toEqual(['pairesAucune']);
    expect(vue.querySelector('[data-paire]')).toBeNull();
  });
});
