// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La vue « Performance du calcul » dans un vrai moteur de rendu (§ 12.14,
// B23, D40, D49) : une génération de la séance sous l'horloge pilotée,
// avancée d'une durée écrite pendant le calcul, donne la durée et la cadence
// exactes ; sans avance, « durée inconnue » et aucune cadence ; les petits
// multiples marquent les seuls points de relevé, sur une abscisse
// logarithmique, chacun son seul axe vertical ; le dernier point du jumeau
// égale la ligne de la proposition au tableau des propositions, avant et
// après un changement de l'ordre des priorités ou d'un objectif ; rouverte
// par une autre séance, la proposition montre les mêmes points, durée
// inconnue ; compte 1, zéro mouvement, retenu non ajusté puis ajusté,
// proposition sans course. Chaque épreuve monte App par monterApp, sur le
// système de fichiers simulé où un fichier d'état d'épreuve est posé puis
// ouvert, au cadre de 1 366 × 700, et lit le rendu : le texte, les
// attributs data-…, l'élément focalisé — jamais une classe. Les noms
// d'épreuve sont inventés.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { appliquerCommande } from '../../application/commandes.js';
import { creerFormat } from '../../application/format.js';
import { creerExecuteurDirect } from '../../application/generation.js';
import { creerHorlogePilotee } from '../../application/horloge.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { rechercher } from '../../moteur/recherche.js';
import { serialiser } from '../../stockage/canonique.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { dessinerGraphiques, fixerCadre, touche } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { colonneDeValeur } from '../propositions/modele.js';
import { cleIndicateur } from './performance.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);
const V1 = VERSION.affichee;
const BASE = 'soiree';

// --- Les charges d'épreuve -------------------------------------------------

// Des personnes inventées, de deux appartenances ou sans — aucune quand
// appartenances est faux —, réparties sur des tables numérotées de 1 à
// tables, sans proposition ni retenu.
const PERSONNES = [
  ['Ombrelle', 'Iris', 'Coopérative Aubier'],
  ['Pervenche', 'Théo', 'Coopérative Aubier'],
  ['Lacasse', 'Ondine', 'Atelier Ressac'],
  ['Tourteau', 'Basile', 'Atelier Ressac'],
  ['Quenouille', 'Maëlle', null],
  ['Varech', 'Sidonie', null],
  ['Aubépin', 'Lucien', 'Coopérative Aubier'],
  ['Bruyère', 'Aglaé', 'Atelier Ressac'],
  ['Cormier', 'Félix', null],
  ['Dorine', 'Ysé', 'Coopérative Aubier'],
  ['Escourgeon', 'Paulin', 'Atelier Ressac'],
  ['Fenouil', 'Rosalie', null],
];

function chargeDe({ personnes = 6, tables = 2, sieges = 3, tours = 2, appartenances = true } = {}) {
  const charge = creerCharge({ id: 'evt-performance', nom: 'Atelier Ressac', siegesParDefaut: sieges, tours });
  charge.participants = PERSONNES.slice(0, personnes).map(([nom, prenom, appartenance], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance: appartenances ? appartenance : null,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = Array.from({ length: tables }, (_, rang) => ({
    id: rang + 1,
    numero: rang + 1,
    sieges: null,
    forme: 'ronde',
    position: { x: 300 * (rang + 1), y: 0 },
  }));
  charge.prochainsIds = { participant: personnes + 1, table: tables + 1, proposition: 1 };
  return charge;
}

// Douze personnes, trois tables de quatre, trois tours ; les six premières
// portent l'étiquette « finance », que la table 1 a pour objectif.
function chargeAObjectifs() {
  const charge = chargeDe({ personnes: 12, tables: 3, sieges: 4, tours: 3 });
  for (const personne of charge.participants) if (personne.id <= 6) personne.etiquettes = ['finance'];
  charge.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
  return charge;
}

// --- Le montage ------------------------------------------------------------

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

// L'exécuteur direct, dont chaque calcul avance l'horloge pilotée de
// dureeMs avant de rendre ses propositions, et qui dit employer coeurs
// cœurs : la durée que le contrôleur prend autour du calcul est dureeMs.
function executeurQuiDure(horloge, dureeMs, coeurs) {
  const direct = creerExecuteurDirect({ coeursDisponibles: coeurs });
  return {
    coeursDisponibles: direct.coeursDisponibles,
    lancer(configuration, reglages, options) {
      const execution = direct.lancer(configuration, reglages, options);
      const resultat = execution.resultat.then((propositions) => {
        horloge.avancer(dureeMs);
        return propositions;
      });
      return { ...execution, resultat, coeurs };
    },
  };
}

// La charge posée en fichier d'état, ouverte par la séance — en écriture
// sauf mode 'lecture' — ; options passe à monterApp.
async function ouvrir(charge, { mode = 'ecriture', ...options } = {}) {
  const texte = serialiser(charge, { revision: 1, produitVersion: V1 });
  const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `${BASE}${SUFFIXES.etat}`, texte }], ...options });
  montes.push(m);
  await m.seance.ouvrir(BASE);
  if (mode === 'ecriture') await m.seance.passerEnEcriture();
  return m;
}

// La page de qualité ouverte sur la proposition id, ou sur le retenu pour
// null.
function montrer(m, id) {
  m.ui.montrerProposition(id);
  m.ui.allerA('qualite');
  flushSync();
}

// --- Les lectures du rendu -------------------------------------------------

const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const vue = (m) => m.racine.querySelector('[data-vue-qualite="performance"]');
const tete = (m) => [...vue(m).querySelectorAll('[data-course] li')].map(texteDe);
const phrases = (m) => [...vue(m).querySelectorAll('[data-phrase-qualite]')].map((p) => [p.dataset.phraseQualite, texteDe(p)]);
const graphiques = (m) => [...vue(m).querySelectorAll('[data-graphique]')];

// Le jumeau de la vue ouvert : ses colonnes, puis chaque ligne, une Map
// colonne → texte de sa cellule.
async function lireJumeau(m) {
  const ouvrirJumeau = vue(m).querySelector('[data-commande="ouvrirJumeau"]');
  if (ouvrirJumeau !== null) ouvrirJumeau.click();
  const table = await attendre(() => {
    const trouvee = vue(m).querySelector('[data-jumeau="0"]');
    expect(trouvee).not.toBeNull();
    return trouvee;
  });
  const colonnes = [...table.querySelectorAll('thead th')].map((th) => th.dataset.colonne);
  const lignes = [...table.querySelectorAll('tbody tr')].map(
    (tr) => new Map([...tr.querySelectorAll('[data-colonne]')].map((cellule) => [cellule.dataset.colonne, texteDe(cellule)])),
  );
  return { colonnes, lignes };
}

// La ligne de la proposition id au tableau des propositions : une Map
// colonne → texte de sa cellule.
async function ligneAuTableau(m, id) {
  m.ui.allerA('propositions');
  const ligne = await attendre(() => {
    const trouvee = m.racine.querySelector(`[data-proposition="${id}"]`);
    expect(trouvee).not.toBeNull();
    return trouvee;
  });
  return new Map([...ligne.querySelectorAll('td[data-colonne]')].map((cellule) => [cellule.dataset.colonne, texteDe(cellule)]));
}

// La colonne du tableau des propositions qui porte une valeur de point de
// relevé : celle du minimum des rencontres pour le minimum brut.
const colonneAuTableau = (nom) => (nom === 'minimumBrut' ? 'rencontresTous' : colonneDeValeur(nom));

// Le jumeau lu sur la page de qualité restée ouverte sur la proposition
// id, puis la ligne de cette proposition au tableau des propositions : le
// dernier point égale la ligne, valeur par valeur. La page est rouverte
// sur la proposition id avant de rendre le jumeau lu, et le reste pendant
// le changement qui suit : la vue reçoit le détail de la charge changée
// sans être montée de nouveau.
async function dernierPointEgaleLaLigne(m, id, quoi) {
  const jumeau = await lireJumeau(m);
  const auTableau = await ligneAuTableau(m, id);
  const dernier = jumeau.lignes.at(-1);
  for (const nom of jumeau.colonnes.slice(1)) {
    expect(dernier.get(nom), `${quoi} : ${nom}`).toBe(auTableau.get(colonneAuTableau(nom)));
  }
  montrer(m, id);
  return jumeau;
}

// --- Les épreuves ----------------------------------------------------------

describe('la ligne de tête : la génération de la séance (§ 12.14, § 5.10, D40)', () => {
  const REGLAGES = { graine: 3, nombre: 2, arret: 400, historique: 1000 };

  test('rouge : horloge avancée de 2 500 ms pendant le calcul, sur deux cœurs : durée, cœurs, cadence et nombre exacts', async () => {
    const horloge = creerHorlogePilotee();
    const charge = chargeDe();
    const m = await ouvrir(charge, { horloge, executeur: executeurQuiDure(horloge, 2500, 2) });
    await m.app.generation().generer(REGLAGES);
    montrer(m, 1);
    const propositions = rechercher(configurationDepuisCharge(charge), REGLAGES);
    const evalues = propositions[0].evalues + propositions[1].evalues;
    await attendre(() =>
      expect(tete(m)).toEqual([
        t('qualite.performance.mouvements', { evalues: format.nombre(propositions[0].evalues), arret: format.nombre(400) }),
        'durée observée 2,5 s',
        '2 cœurs de calcul',
        `cadence ${format.nombre(Math.round((evalues * 1000) / 2500))} mouvements par seconde`,
        'génération de 2 propositions',
      ]),
    );
    expect(evalues).toBe(800);
    expect(tete(m)[3]).toBe('cadence 320 mouvements par seconde');
  });

  test('rouge : sans avance de l’horloge, durée nulle : « durée inconnue », aucune cadence', async () => {
    const m = await ouvrir(chargeDe());
    await m.app.generation().generer(REGLAGES);
    montrer(m, 1);
    await attendre(() => expect(tete(m)).toContain(t('qualite.performance.dureeInconnue')));
    expect(tete(m).filter((morceau) => morceau.includes('cadence'))).toEqual([]);
    expect(tete(m).filter((morceau) => morceau.startsWith('durée observée'))).toEqual([]);
  });
});

describe('les petits multiples et le jumeau (§ 12.14, D49)', () => {
  test('rouge : des points aux seuls points de relevé, reliés tout droit, sur une abscisse logarithmique ; un seul axe vertical par graphique', async () => {
    const m = await ouvrir(chargeDe());
    await m.app.generation().generer({ graine: 3, nombre: 1, arret: 400, historique: 1000 });
    montrer(m, 1);
    const svgs = await attendre(() => {
      const trouves = graphiques(m);
      expect(trouves.length).toBeGreaterThan(1);
      expect(trouves[0].querySelectorAll('[data-point-releve]').length).toBe(4);
      return trouves;
    });
    expect(svgs[0].dataset.graphique).toBe('performance-minimumBrut');
    const noms = svgs.map((svg) => document.getElementById(svg.getAttribute('aria-labelledby')).textContent);
    expect(new Set(noms).size).toBe(noms.length);
    for (const svg of svgs) {
      const points = [...svg.querySelectorAll('[data-point-releve]')];
      expect(points.map((p) => p.dataset.pointReleve)).toEqual(['1', '10', '100', '400']);
      const x = points.map((p) => Number(p.getAttribute('cx')));
      // Une décade a la même largeur : 1 → 10 comme 10 → 100.
      expect(Math.abs(x[1] - x[0] - (x[2] - x[1]))).toBeLessThan(0.5);
      expect(x[3] - x[2]).toBeLessThan(x[2] - x[1]);
      // Le trait passe d'un point au suivant, sans palier entre eux.
      const d = svg.querySelector('path[data-serie="serie1"]').getAttribute('d');
      expect(d.replace(/[^A-Za-z]/g, '')).toBe('MLLL');
      const sommets = [...d.matchAll(/[ML] ([-\d.]+) ([-\d.]+)/g)].map(([, px, py]) => [Number(px), Number(py)]);
      points.forEach((point, i) => {
        expect(sommets[i][0]).toBeCloseTo(Number(point.getAttribute('cx')), 1);
        expect(sommets[i][1]).toBeCloseTo(Number(point.getAttribute('cy')), 1);
      });
      expect(svg.querySelectorAll('[data-serie]:not(text)')).toHaveLength(1);
      const verticaux = [...svg.querySelectorAll('[data-marque="graphiqueAxe"]')].filter(
        (axe) => axe.getAttribute('x1') === axe.getAttribute('x2'),
      );
      expect(verticaux).toHaveLength(1);
    }
    // Les petits multiples alignent leurs abscisses, point contre point.
    const abscisses = svgs.map((svg) => [...svg.querySelectorAll('[data-point-releve]')].map((p) => p.getAttribute('cx')));
    const colonnes = svgs.map((svg) => Math.round(svg.getBoundingClientRect().left));
    svgs.forEach((svg, i) => {
      if (colonnes[i] === colonnes[0]) expect(abscisses[i]).toEqual(abscisses[0]);
    });
    expect(texteDe(vue(m).querySelector('[data-dernier-changement]')).length).toBeGreaterThan(0);
  });

  test('rouge : le jumeau, au clavier : une ligne par point, ses mouvements puis une colonne par valeur, aucune durée ; refermé, le focus reste sur la commande', async () => {
    const m = await ouvrir(chargeDe());
    await m.app.generation().generer({ graine: 3, nombre: 1, arret: 400, historique: 1000 });
    montrer(m, 1);
    const ouvrirJumeau = await attendre(() => {
      const trouvee = vue(m).querySelector('[data-commande="ouvrirJumeau"]');
      expect(trouvee).not.toBeNull();
      return trouvee;
    });
    ouvrirJumeau.focus();
    await touche('Enter');
    const table = await attendre(() => {
      const trouvee = vue(m).querySelector('[data-jumeau="0"]');
      expect(trouvee).not.toBeNull();
      return trouvee;
    });
    expect(table.getAttribute('aria-label')).toBe(t('qualite.performance.jumeau'));
    const colonnes = [...table.querySelectorAll('thead th')].map((th) => th.dataset.colonne);
    expect(colonnes[0]).toBe('mouvements');
    expect(colonnes.slice(1)).toEqual(graphiques(m).map((svg) => svg.dataset.graphique.replace('performance-', '')));
    expect(colonnes.filter((colonne) => /duree|temps|cadence/i.test(colonne))).toEqual([]);
    expect([...table.querySelectorAll('thead th')].map(texteDe)).toEqual([
      t('qualite.performance.colonne.mouvements'),
      ...colonnes.slice(1).map((nom) => t(cleIndicateur(nom))),
    ]);
    expect([...table.querySelectorAll('tbody tr')].map((tr) => texteDe(tr.querySelector('[data-colonne="mouvements"]')))).toEqual([
      '1',
      '10',
      '100',
      '400',
    ]);
    const fermer = vue(m).querySelector('[data-commande="fermerJumeau"]');
    fermer.focus();
    await touche('Enter');
    await attendre(() => expect(vue(m).querySelector('[data-jumeau]')).toBeNull());
    expect(document.activeElement?.dataset.commande).toBe('ouvrirJumeau');
  });
});

describe('le dernier point égale la ligne du tableau, sous les réglages courants (§ 12.14, D40)', () => {
  test('rouge : après un changement de l’ordre des priorités puis d’un objectif, les points remesurés, le dernier toujours égal à la nouvelle ligne', async () => {
    const m = await ouvrir(chargeAObjectifs());
    await m.app.generation().generer({ graine: 4, nombre: 1, arret: 400, historique: 1000 });
    montrer(m, 1);
    const avant = await dernierPointEgaleLaLigne(m, 1, 'à la génération');
    expect(avant.colonnes).toContain('toursHorsObjectif');

    const paliers = [
      [{ critere: 'ecartAuPlafondAPrioriMax', poids: 1 }],
      [{ critere: 'redondance', poids: 1 }],
      [{ critere: 'excedentCollisions', poids: 1 }],
      [{ critere: 'collisionsCumulees', poids: 1 }],
      [{ critere: 'toursHorsObjectif', poids: 1 }],
      [{ critere: 'rencontresRepetees', poids: 1 }],
      [{ critere: 'animateursNonRencontres', poids: 1 }],
    ];
    await m.seance.executer('changerPriorites', { paliers });
    const reglee = await dernierPointEgaleLaLigne(m, 1, 'priorités');
    expect(reglee.colonnes).not.toEqual(avant.colonnes);
    expect(reglee.colonnes.slice(0, 4)).toEqual(['mouvements', 'minimumBrut', 'ecartAuPlafondAPrioriMax', 'redondance']);

    await m.seance.executer('poserObjectif', { table: 2, tour: null, etiquettes: 'finance', regle: null });
    const objectif = await dernierPointEgaleLaLigne(m, 1, 'objectif');
    const hors = (jumeau) => jumeau.lignes.map((ligne) => ligne.get('toursHorsObjectif'));
    expect(hors(objectif)).not.toEqual(hors(reglee));
    expect(objectif.lignes.map((ligne) => ligne.get('mouvements'))).toEqual(reglee.lignes.map((ligne) => ligne.get('mouvements')));
  });
});

describe('une proposition rouverte, sa course lue du compagnon (§ 8.6, B23, D53)', () => {
  test('rouge : une autre séance rouvre l’événement : les mêmes points et les mêmes valeurs, la course montrée, « durée inconnue », aucune cadence', async () => {
    const horloge = creerHorlogePilotee();
    const premiere = await ouvrir(chargeDe(), { horloge, executeur: executeurQuiDure(horloge, 2500, 2) });
    await premiere.app.generation().generer({ graine: 3, nombre: 2, arret: 400, historique: 1000 });
    montrer(premiere, 2);
    await attendre(() => expect(tete(premiere)).toContain('durée observée 2,5 s'));
    const ecrit = await lireJumeau(premiere);

    const seconde = await monterApp({ systeme: { disque: premiere.disque } });
    montes.push(seconde);
    await seconde.seance.ouvrir(BASE);
    montrer(seconde, 2);
    const relu = await lireJumeau(seconde);
    expect(relu.colonnes).toEqual(ecrit.colonnes);
    expect(relu.lignes.map((ligne) => [...ligne])).toEqual(ecrit.lignes.map((ligne) => [...ligne]));
    expect(phrases(seconde)).toEqual([]);
    expect(graphiques(seconde).length).toBeGreaterThan(0);
    expect(tete(seconde)).toContain(t('qualite.performance.dureeInconnue'));
    expect(tete(seconde).filter((morceau) => /cadence|durée observée|cœur/.test(morceau))).toEqual([]);
  });
});

describe('les cas d’un seul point, du retenu et de la course absente (§ 12.6, B15)', () => {
  test('compte 1 : un seul point, sa phrase, aucun graphique ; le jumeau garde sa ligne', async () => {
    const m = await ouvrir(chargeDe());
    await m.app.generation().generer({ graine: 3, nombre: 1, arret: 1, historique: 1000 });
    montrer(m, 1);
    await attendre(() => expect(phrases(m)).toEqual([['unPoint', t('qualite.performance.unPoint')]]));
    expect(tete(m)[0]).toBe('1 mouvement évalué sur 1');
    expect(graphiques(m)).toEqual([]);
    expect(vue(m).querySelector('[data-dernier-changement]')).toBeNull();
    expect((await lireJumeau(m)).lignes.map((ligne) => ligne.get('mouvements'))).toEqual(['1']);
  });

  test('zéro mouvement : « le plan initial n’avait rien à reprendre », aucun graphique', async () => {
    const m = await ouvrir(chargeDe({ personnes: 4, tables: 1, sieges: 4, tours: 1, appartenances: false }));
    await m.app.generation().generer({ graine: 3, nombre: 1, arret: 50, historique: 1000 });
    montrer(m, 1);
    await attendre(() => expect(tete(m)[0]).toBe(t('qualite.performance.planInitial')));
    expect(graphiques(m)).toEqual([]);
    expect(phrases(m)).toEqual([]);
    expect((await lireJumeau(m)).lignes.map((ligne) => ligne.get('mouvements'))).toEqual(['0']);
  });

  test('un retenu non ajusté nomme sa proposition et en montre la course ; ajusté, sa phrase seule', async () => {
    const m = await ouvrir(chargeDe());
    await m.app.generation().generer({ graine: 3, nombre: 2, arret: 400, historique: 1000 });
    await m.seance.executer('retenirProposition', { id: 2 });
    montrer(m, null);
    await attendre(() => expect(phrases(m)).toEqual([['retenu', t('qualite.performance.retenu', { proposition: 2 })]]));
    expect(graphiques(m).length).toBeGreaterThan(0);
    expect(tete(m).length).toBeGreaterThan(0);

    const [premierTour] = m.seance.etat().charge.retenu.placement;
    const [a] = premierTour.sieges[0];
    const [b] = premierTour.sieges[1];
    await m.seance.executer('echangerDansRetenu', { tour: 1, a, b });
    montrer(m, null);
    await attendre(() => expect(phrases(m)).toEqual([['retenuSansCourse', t('qualite.performance.retenuSansCourse')]]));
    expect(graphiques(m)).toEqual([]);
    expect(vue(m).querySelector('[data-course]')).toBeNull();
    expect(vue(m).querySelector('[data-commande="ouvrirJumeau"]')).toBeNull();
  });

  test('une proposition écrite sans compagnon des courses : « Sa course n’est pas gardée. », rien d’autre', async () => {
    const charge = chargeDe();
    const configuration = configurationDepuisCharge(charge);
    const propositions = rechercher(configuration, { graine: 3, nombre: 1, arret: 400 });
    const generee = appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
    const m = await ouvrir(generee, { mode: 'lecture' });
    montrer(m, 1);
    await attendre(() => expect(phrases(m)).toEqual([['sansCourse', "Sa course n'est pas gardée."]]));
    expect(graphiques(m)).toEqual([]);
    expect(vue(m).querySelector('[data-course]')).toBeNull();
    expect(vue(m).querySelector('[data-commande="ouvrirJumeau"]')).toBeNull();
  });
});

describe('le poids de la vue sur la grande démonstration (§ 12.14, E2s)', () => {
  test('une course de sept points : la vue tient sous le budget de nœuds de la page entière', async () => {
    const charge = analyser(texteLivre('grande')).charge;
    const m = await ouvrir(charge);
    await m.app.generation().generer({ graine: 1, nombre: 1, arret: 200000, historique: 1000 }, { confirmee: true });
    const id = m.seance.etat().charge.propositions.at(-1).id;
    montrer(m, id);
    await attendre(() => expect(graphiques(m)[0]?.querySelectorAll('[data-point-releve]').length).toBe(7));
    const noeuds = vue(m).querySelectorAll('*').length + 1;
    expect(noeuds).toBeLessThan(1500);
  }, 120_000);
});
