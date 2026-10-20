// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La vue de comparaison de la page de qualité dans un vrai moteur de rendu
// (§ 12, § 12.6, § 12.7, § 12.10.6, § 12.10.7, D55 à D67, D85, C14, C15,
// C17, C18, C20, C29) : la troisième vue, après le profil, et son lien dans
// la liste des vues ; la vue demandée par la navigation, portée à l'écran
// et au focus ; la ligne qui nomme les deux placements, la liste
// « Comparer à : » qui porte exactement les candidats et se manie au
// clavier ; un seul <svg> à axe vertical, les deux courbes dessous, la
// borne haute de la comparaison, le zéro libellé ; les phrases, le jumeau ;
// le second placement qui change ou disparaît, que la vue entière suit,
// colonnes côte à côte comprises ; un refus de dessin ou des populations
// différentes, la phrase du cas sans colonnes, tracé ni jumeau ; aucun
// pourcentage hors des colonnes ; aucune commande qui écrive, en lecture
// et sur un plan bloqué ; la comparaison et la liste ne se calculent qu'au
// premier dessin de la vue ; la garde des marques sur les deux courbes.
//
// Le module de l'évaluation est remplacé par ses propres fonctions,
// espionnées (vi.mock, spy) : chacune garde son effet, et les appels de
// comparerPlacements et de candidatsDeComparaison se comptent ; une
// épreuve qui forge une table ou une comparaison pose une implémentation
// qui enveloppe la vraie, et rend la vraie en sortant. Chaque
// épreuve monte App par monterApp, sur le système de fichiers simulé où un
// fichier d'état d'épreuve est posé puis ouvert, au cadre de 1 366 × 700,
// et lit le rendu : le texte, les attributs data-…, l'élément focalisé —
// jamais une classe. Le texte attendu vient du modèle de la vue et de la
// même traduction que celle de l'application ; les noms d'épreuve sont
// inventés.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import { appliquerCommande } from '../../application/commandes.js';
import { candidatsDeComparaison, comparerPlacements, evaluer } from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { rechercher } from '../../moteur/recherche.js';
import { serialiser } from '../../stockage/canonique.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { releverMarques } from '../../../test/navigateur/captures.js';
import { fixerCadre, pointer, touche } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { vueComparaison } from './comparaison.js';

vi.mock('../../application/evaluation.js', { spy: true });

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);
const V1 = VERSION.affichee;
const BASE = 'soiree';

// Les vues de la page, dans leur ordre à l'écran (§ 12, B9, D55).
const VUES = ['entete', 'profil', 'comparaison', 'collisions', 'tables', 'paires', 'objectifs', 'animateurs', 'diversite', 'performance'];

// --- Les charges d'épreuve -------------------------------------------------------

const NOMS = [
  ['Ombrelle', 'Iris'],
  ['Pervenche', 'Théo'],
  ['Lacasse', 'Ondine'],
  ['Tourteau', 'Basile'],
  ['Quenouille', 'Maëlle'],
  ['Varech', 'Sidonie'],
  ['Grésil', 'Lucien'],
  ['Mirabelle', 'Agathe'],
  ['Ardoise', 'Anatole'],
  ['Cardon', 'Noémie'],
  ['Ronce', 'Gaspard'],
  ['Aubépine', 'Clémence'],
];

// n personnes inventées, tables de sieges places, tours tours, sans
// proposition ni retenu.
function chargeDe({ n, tables, sieges, tours }) {
  const charge = creerCharge({ id: 'evt-comparaison', nom: 'Atelier Ressac', siegesParDefaut: sieges, tours });
  charge.participants = NOMS.slice(0, n).map(([nom, prenom], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance: rang % 2 === 0 ? 'Coopérative Aubier' : 'Atelier Ressac',
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
  charge.prochainsIds = { participant: n + 1, table: tables + 1, proposition: 1 };
  return charge;
}

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;

// La charge, une génération de plus, enregistrée par la commande.
function generee(charge, reglages) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, reglages);
  return executer(charge, 'enregistrerGeneration', { propositions, configuration, produitVersion: V1 });
}

// Douze personnes, trois tables de quatre, trois tours, quatre propositions
// classées [4, 2, 1, 3] : 1 contre son défaut, 4, prend quatre valeurs de
// manque, et se trace.
const aTracer = () => generee(chargeDe({ n: 12, tables: 3, sieges: 4, tours: 3 }), { graine: 5, arret: 30, nombre: 4 });
// Six personnes, deux tables de trois, deux tours, trois propositions : deux
// valeurs de manque, une phrase.
const aPhrase = () => generee(chargeDe({ n: 6, tables: 2, sieges: 3, tours: 2 }), { graine: 3, arret: 40, nombre: 3 });

// --- Le montage --------------------------------------------------------------------

let montes = [];
beforeEach(async () => {
  await fixerCadre(1366, 700);
  vi.mocked(comparerPlacements).mockClear();
  vi.mocked(candidatsDeComparaison).mockClear();
});
afterEach(() => {
  const erreurs = montes.flatMap((m) => m.erreurs());
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  window.scrollTo(0, 0);
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

const image = () => new Promise((resoudre) => requestAnimationFrame(resoudre));

// Attend que l'assertion passe, le rendu de Svelte à jour.
async function attendre(assertion) {
  for (let essai = 0; ; essai += 1) {
    flushSync();
    try {
      return assertion();
    } catch (erreur) {
      if (essai >= 200) throw erreur;
      await image();
    }
  }
}

// La charge posée en fichier d'état, ouverte par la séance — en écriture
// sauf mode 'lecture' —, la section donnée ouverte.
async function ouvrir(charge, { mode = 'ecriture', section = 'qualite' } = {}) {
  const texte = serialiser(charge, { revision: 1, produitVersion: V1 });
  const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `${BASE}${SUFFIXES.etat}`, texte }] });
  montes.push(m);
  await m.seance.ouvrir(BASE);
  if (mode === 'ecriture') await m.seance.passerEnEcriture();
  m.ui.allerA(section);
  flushSync();
  return m;
}

// --- Les lectures du rendu ---------------------------------------------------------

const page = (m) => m.racine.querySelector('[data-section="qualite"]');
const vue = (m) => page(m).querySelector('[data-vue-qualite="comparaison"]');
const liste = (m) => vue(m).querySelector('select[data-comparer-a]');
const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const vuesRendues = (m) => [...page(m).querySelectorAll('[data-vue-qualite]')].map((element) => element.dataset.vueQualite);
const phrases = (m) =>
  [...vue(m).querySelectorAll('[data-phrase-comparaison]')].map((p) => ({ code: p.dataset.phraseComparaison, texte: texteDe(p) }));
const charge = (m) => m.seance.etat().charge;
const appels = (espion) => vi.mocked(espion).mock.calls.length;
// L'en-tête de la colonne côte à côte d'un placement, a ou b.
const enteteColonne = (m, cote) => vue(m).querySelector(`th[data-colonne-comparaison="${cote}"]`);
// La valeur de la place au classement dans la colonne d'un placement.
const rangColonne = (m, cote) => vue(m).querySelector(`tr[data-colonne="rang"] td[data-colonne-comparaison="${cote}"] span`);

// Le modèle que la vue doit rendre, pour la source montrée et la comparée
// de la navigation.
function attendu(m, source) {
  const lue = charge(m);
  return vueComparaison(lue, evaluer(lue), { source: { cas: 'mesurable', id: source }, comparee: m.ui.etat().comparee }, { t, format });
}

// Attend la vue, l'amène à l'écran, et attend sa liste.
async function amener(m) {
  await attendre(() => expect(vue(m)).not.toBeNull());
  vue(m).scrollIntoView({ block: 'start' });
  await attendre(() => expect(liste(m)).not.toBeNull());
}

// Ce que la vue rend du modèle : la ligne des placements, la liste et son
// choix, les phrases dans leur ordre.
function exigerRendu(m, modele) {
  expect(texteDe(vue(m).querySelector('[data-placements-compares]'))).toBe(
    t('qualite.comparaison.placements', { a: modele.placements.a.nom, b: modele.placements.b.nom }),
  );
  const options = [...liste(m).options];
  expect(options.map((option) => texteDe(option))).toEqual(modele.liste.map(({ texte }) => texte));
  expect(liste(m).value).toBe(String(modele.choisi));
  expect(phrases(m)).toEqual(modele.phrases.map(({ code, texte }) => ({ code, texte })));
}

// --- Les épreuves -----------------------------------------------------------------

describe('la vue dans la page (§ 12, D55, C15)', () => {
  test('la troisième vue, après le profil, sous sa désignation ; la liste des vues porte son lien, qui y porte le focus', async () => {
    const m = await ouvrir(aTracer());
    m.ui.montrerProposition(1);
    await attendre(() => expect(vuesRendues(m)).toEqual(VUES));
    const lien = [...page(m).querySelectorAll('nav a')][2];
    expect(texteDe(lien)).toBe(t('qualite.vue.comparaison.titre'));
    const carte = vue(m).querySelector('section');
    expect(texteDe(carte.querySelector('h3'))).toBe(t('qualite.vue.comparaison.titre'));
    expect(texteDe(carte)).toContain(t('qualite.vue.comparaison.question'));
    lien.click();
    flushSync();
    expect(document.activeElement.querySelector('[data-vue-qualite]')).toBe(vue(m));
  });

  test('la vue demandée par la navigation est portée à l’écran et au focus, jamais sur body, puis la demande se retire ; depuis une autre section aussi', async () => {
    const m = await ouvrir(aTracer(), { section: 'propositions' });
    m.ui.montrerProposition(1);
    m.ui.comparerA(3);
    m.ui.allerA('qualite');
    m.ui.demanderVueQualite('comparaison');
    await attendre(() => expect(document.activeElement.querySelector('[data-vue-qualite]')).toBe(vue(m)));
    expect(document.activeElement).not.toBe(document.body);
    expect(m.ui.etat().vueQualite).toBeNull();
    // Portée à l'écran : son haut dans la zone visible, et elle se calcule.
    const haut = vue(m).getBoundingClientRect().top;
    expect(haut).toBeGreaterThanOrEqual(0);
    expect(haut).toBeLessThan(innerHeight);
    await attendre(() => expect(liste(m)).not.toBeNull());
    exigerRendu(m, attendu(m, 1));
    expect(liste(m).value).toBe('3');
  });
});

describe('les deux placements, la liste « Comparer à : », le tracé (§ 12.10.6, D56, D60, C20)', () => {
  test('la ligne nomme les deux placements ; la liste porte exactement les candidats ; un seul <svg> à axe vertical, A et B dessous, borné par la borne haute de la comparaison, le zéro libellé', async () => {
    const m = await ouvrir(aTracer());
    m.ui.montrerProposition(1);
    await amener(m);
    const modele = attendu(m, 1);
    expect(modele.cas).toBe('trace');
    exigerRendu(m, modele);
    expect(modele.liste.map(({ cle }) => cle)).toEqual(candidatsDeComparaison(charge(m), evaluer(charge(m)), 1).candidats.map(({ cle }) => cle));
    const svgs = vue(m).querySelectorAll('svg[data-graphique]');
    expect(svgs).toHaveLength(1);
    const [svg] = svgs;
    expect(svg.dataset.graphique).toBe('comparaison');
    await attendre(() => expect(svg.querySelector('path[data-serie="a"]')).not.toBeNull());
    expect(svg.querySelector('path[data-serie="b"]')).not.toBeNull();
    // Les graduations de l'axe vertical : le zéro sous son libellé, les
    // autres entières, jamais au-delà de la borne haute.
    const graduations = [...svg.querySelectorAll('text[text-anchor="end"]')].map((texte) => texte.textContent);
    expect(graduations).toContain(t('qualite.comparaison.zero'));
    const nombres = graduations.filter((texte) => texte !== t('qualite.comparaison.zero')).map(Number);
    expect(nombres.length).toBeGreaterThan(0);
    for (const valeur of nombres) {
      expect(Number.isInteger(valeur)).toBe(true);
      expect(valeur).toBeLessThanOrEqual(modele.borneHaute);
    }
    expect(nombres).toContain(modele.borneHaute);
  });

  test('changer B à la liste, au clavier : la ligne, le tracé, les phrases et le jumeau ouvert suivent le nouveau B, sans rien écrire', async () => {
    const m = await ouvrir(aTracer());
    m.ui.montrerProposition(1);
    await amener(m);
    const ecritures = m.trace.length;
    vue(m).querySelector('[data-commande="ouvrirJumeau"]').click();
    flushSync();
    const avant = attendu(m, 1);
    liste(m).focus();
    await touche('ArrowDown');
    await attendre(() => expect(m.ui.etat().comparee).not.toBe(avant.choisi));
    const apres = attendu(m, 1);
    expect(apres.choisi).not.toBe(avant.choisi);
    expect(apres.choisi).toBe(m.ui.etat().comparee);
    await attendre(() => exigerRendu(m, apres));
    expect(document.activeElement).toBe(liste(m));
    // Les colonnes côte à côte : l'en-tête et la place au classement du
    // nouveau B, A inchangé.
    expect(texteDe(enteteColonne(m, 'b'))).toBe(apres.placements.b.nom);
    expect(texteDe(enteteColonne(m, 'a'))).toBe(apres.placements.a.nom);
    expect(texteDe(rangColonne(m, 'b'))).toBe(format.nombre(apres.comparaison.b.rang));
    expect(texteDe(rangColonne(m, 'b'))).not.toBe(format.nombre(avant.comparaison.b.rang));
    // Le libellé de la courbe B et les colonnes du jumeau nomment le nouveau B.
    expect(texteDe(vue(m).querySelector('svg text[data-serie="b"]'))).toBe(apres.placements.b.nom);
    const entetes = [...vue(m).querySelectorAll('table[data-jumeau] thead th')].map(texteDe);
    expect(entetes).toEqual(apres.escalier.colonnes.map(({ libelle }) => libelle));
    const lignes = [...vue(m).querySelectorAll('table[data-jumeau] tbody tr')];
    expect(lignes).toHaveLength(apres.escalier.lignes.length);
    expect(m.trace.length).toBe(ecritures);
    expect(vue(m).querySelector('[data-refus]')).toBeNull();
  });

  test('B qui disparaît — devenu la source, retiré par un retour, effacé par « Garder les N meilleures » — : la vue revient au défaut et nomme toujours les deux', async () => {
    const m = await ouvrir(aTracer());
    m.ui.montrerProposition(4);
    await amener(m);
    // Devenu la source : le défaut de la nouvelle source.
    m.ui.comparerA(3);
    await attendre(() => expect(liste(m).value).toBe('3'));
    m.ui.montrerProposition(3);
    await attendre(() => exigerRendu(m, attendu(m, 3)));
    expect(attendu(m, 3).choisi).not.toBe(3);

    // Retiré par un retour : une génération ajoute 5 à 8, B devient 7, le
    // retour la retire.
    m.ui.montrerProposition(4);
    const lue = charge(m);
    const configuration = configurationDepuisCharge(lue);
    await m.seance.executer('enregistrerGeneration', {
      propositions: rechercher(configuration, { graine: 9, arret: 30, nombre: 4 }),
      configuration,
      produitVersion: V1,
    });
    await attendre(() => expect([...liste(m).options].map((option) => option.value)).toContain('7'));
    m.ui.comparerA(7);
    await attendre(() => exigerRendu(m, attendu(m, 4)));
    expect(liste(m).value).toBe('7');
    await m.seance.defaire();
    await attendre(() => expect(charge(m).propositions.map(({ id }) => id)).toEqual([1, 2, 3, 4]));
    await attendre(() => exigerRendu(m, attendu(m, 4)));
    expect(liste(m).value).not.toBe('7');
    expect(m.ui.etat().comparee).toBeNull();

    // Effacé : « Garder les 2 meilleures » emporte 3, la vue revient au
    // défaut de 4.
    m.ui.comparerA(3);
    await attendre(() => expect(liste(m).value).toBe('3'));
    await m.seance.executer('garderMeilleures', { n: 2 });
    await attendre(() => expect(charge(m).propositions).toHaveLength(2));
    await attendre(() => exigerRendu(m, attendu(m, 4)));
    expect(liste(m).value).not.toBe('3');
  });

  test('une génération qui ajoute des propositions sous la vue ouverte : la liste les porte, B reste', async () => {
    const m = await ouvrir(aTracer());
    m.ui.montrerProposition(1);
    await amener(m);
    m.ui.comparerA(2);
    await attendre(() => expect(liste(m).value).toBe('2'));
    const lue = charge(m);
    const configuration = configurationDepuisCharge(lue);
    await m.seance.executer('enregistrerGeneration', {
      propositions: rechercher(configuration, { graine: 9, arret: 30, nombre: 2 }),
      configuration,
      produitVersion: V1,
    });
    await attendre(() => expect(liste(m).options).toHaveLength(5));
    exigerRendu(m, attendu(m, 1));
    expect(liste(m).value).toBe('2');
  });
});

describe('en comptes, sans commande qui écrive (§ 12.8, D55, D67, C29, contrainte 57)', () => {
  test('aucun pourcentage hors des colonnes : ni au tracé, ni à son infobulle, ni au jumeau, ni dans une phrase ; l’infobulle d’un rang porte une ligne par placement', async () => {
    const m = await ouvrir(aTracer());
    m.ui.montrerProposition(1);
    await amener(m);
    const modele = attendu(m, 1);
    const svg = vue(m).querySelector('svg[data-graphique="comparaison"]');
    await attendre(() => expect(svg.querySelector('path[data-serie="a"]')).not.toBeNull());
    // Le tracé amené dans la zone visible avant d'en lire la boîte : sous
    // les colonnes, il commence plus bas que la fenêtre.
    svg.scrollIntoView({ block: 'center' });
    await image();
    const boite = svg.querySelector('path[data-serie="a"]').getBoundingClientRect();
    expect(boite.top).toBeGreaterThanOrEqual(0);
    expect(boite.top).toBeLessThan(innerHeight);
    await pointer('bouger', boite.left + 2, boite.top + boite.height / 2);
    const bulle = vue(m).querySelector('[role="tooltip"]');
    await attendre(() => expect(bulle.hidden).toBe(false));
    expect(bulle.querySelectorAll('dl')).toHaveLength(2);
    expect([...bulle.querySelectorAll('p')].map(texteDe)).toEqual([modele.placements.a.nom, modele.placements.b.nom]);
    // Chaque ligne porte le total du § 12.10.3, celui de la comparaison.
    for (const ligne of bulle.querySelectorAll('dl')) {
      const termes = [...ligne.querySelectorAll('dt')].map(texteDe);
      const rang = termes.indexOf(t('qualite.comparaison.colonne.total'));
      expect(rang).toBeGreaterThanOrEqual(0);
      expect(texteDe(ligne.querySelectorAll('dd')[rang])).toBe(format.nombre(modele.comparaison.total));
    }
    vue(m).querySelector('[data-commande="ouvrirJumeau"]').click();
    flushSync();
    // Hors des colonnes côte à côte, aucun pourcentage rendu, aucun signe.
    const horsColonnes = (element) => element.closest('[data-colonne-comparaison]') === null;
    expect([...vue(m).querySelectorAll('[data-pourcentage]')].filter(horsColonnes)).toEqual([]);
    for (const element of [svg, bulle, ...vue(m).querySelectorAll('table[data-jumeau], [data-phrase-comparaison], [data-placements-compares]')]) {
      expect(element.textContent).not.toContain('%');
    }
    await touche('Escape');
  });

  test('peu de valeurs : la phrase par valeur, puis les trois effectifs ; aucun tracé ; le jumeau reste', async () => {
    const m = await ouvrir(aPhrase());
    m.ui.montrerProposition(1);
    await amener(m);
    const modele = attendu(m, 1);
    expect(modele.cas).toBe('phrase');
    exigerRendu(m, modele);
    expect(vue(m).querySelector('svg')).toBeNull();
    const valeurs = [...vue(m).querySelectorAll('[data-phrase-comparaison="peuDeValeurs"] + ul li')].map(texteDe);
    expect(valeurs).toEqual(modele.phrases[0].liste.map(({ texte }) => texte));
    expect(vue(m).querySelector('[data-commande="ouvrirJumeau"]')).not.toBeNull();
  });

  test('un seul placement mesurable : la vue garde son entrée et écrit sa phrase, sans liste ni tracé', async () => {
    const m = await ouvrir(generee(chargeDe({ n: 6, tables: 2, sieges: 3, tours: 2 }), { graine: 3, arret: 40, nombre: 1 }));
    m.ui.montrerProposition(1);
    await attendre(() => expect(vuesRendues(m)).toEqual(VUES));
    vue(m).scrollIntoView({ block: 'start' });
    await attendre(() => expect(phrases(m)).toEqual([{ code: 'seul', texte: t('qualite.comparaison.seul') }]));
    expect(liste(m)).toBeNull();
    expect(vue(m).querySelector('[data-placements-compares], svg, table')).toBeNull();
  });

  for (const [cas, mode, fabrique] of [
    ['en lecture', 'lecture', aTracer],
    ['sur un plan bloqué', 'lecture', () => executer(executer(aTracer(), 'retenirProposition', { id: 2 }), 'changerEtat', { etat: 'bloque' })],
  ]) {
    test(`${cas} : la liste vit, aucun refus, aucune entrée au journal ; la vue n’offre ni « Retenir » ni aucune commande qui écrive`, async () => {
      const m = await ouvrir(fabrique(), { mode });
      const ecritures = m.trace.length;
      m.ui.montrerProposition(1);
      await amener(m);
      liste(m).focus();
      await touche('ArrowDown');
      await attendre(() => expect(m.ui.etat().comparee).not.toBeNull());
      exigerRendu(m, attendu(m, 1));
      expect(page(m).querySelector('[data-refus]')).toBeNull();
      expect(m.trace.length).toBe(ecritures);
      // Chaque commande de la vue se presse : aucune n'écrit ni ne refuse,
      // et aucune n'est « Retenir ».
      const commandes = () => [...vue(m).querySelectorAll('[data-commande]')];
      expect(commandes().length).toBeGreaterThan(0);
      expect(commandes().map((element) => element.dataset.commande)).not.toContain('retenir');
      for (const element of commandes()) {
        element.click();
        flushSync();
      }
      expect(page(m).querySelector('[data-refus]')).toBeNull();
      expect(m.trace.length).toBe(ecritures);
    });
  }
});

describe('un refus de dessin, des populations différentes : la phrase du cas, sans colonnes ni tracé (D64, D65, C17)', () => {
  // Ce que la vue ne monte pas sous ces deux cas : les colonnes côte à
  // côte, le tracé, le jumeau et sa commande.
  function exigerPhraseSeule(m) {
    expect(vue(m).querySelector('[data-colonne-comparaison], [data-tous-les-indicateurs]')).toBeNull();
    expect(vue(m).querySelector('svg')).toBeNull();
    expect(vue(m).querySelector('table, [data-commande="ouvrirJumeau"]')).toBeNull();
  }

  test('un refus de dessin sur la ligne de B : la phrase nomme B, sa contradiction dessous ; la liste reste', async () => {
    const { evaluer: reel } = await vi.importActual('../../application/evaluation.js');
    vi.mocked(evaluer).mockImplementation((lue, ...reste) => {
      const table = reel(lue, ...reste);
      const refus = [{ code: 'DEPASSEMENT', index: 0, participant: table.population[0] }];
      return { ...table, propositions: table.propositions.map((ligne) => (ligne.id === 2 ? { ...ligne, refusDessin: refus } : ligne)) };
    });
    try {
      const m = await ouvrir(aTracer());
      m.ui.montrerProposition(1);
      m.ui.comparerA(2);
      await amener(m);
      const modele = attendu(m, 1);
      expect(modele.cas).toBe('refus');
      await attendre(() => exigerRendu(m, modele));
      const contradictions = [...vue(m).querySelectorAll('[data-phrase-comparaison="refus"] + ul li')].map(texteDe);
      expect(contradictions).toEqual(modele.phrases[0].liste.map(({ texte, nom }) => `${texte} ${nom}`));
      exigerPhraseSeule(m);
    } finally {
      vi.mocked(evaluer).mockImplementation(reel);
    }
  });

  test('des populations différentes : la phrase, puis les personnes de chaque côté ; la liste reste', async () => {
    const { comparerPlacements: reel } = await vi.importActual('../../application/evaluation.js');
    vi.mocked(comparerPlacements).mockImplementation((...args) => ({
      ...reel(...args),
      statut: 'populationsDifferentes',
      populations: { seulementA: [12], seulementB: [99] },
      profils: null,
      rangs: null,
      borneHaute: null,
      valeursDistinctes: null,
      trace: false,
      escalier: null,
      indiscernables: null,
    }));
    try {
      const m = await ouvrir(aTracer());
      m.ui.montrerProposition(1);
      await amener(m);
      const modele = attendu(m, 1);
      expect(modele.cas).toBe('populations');
      await attendre(() => exigerRendu(m, modele));
      const personnes = [...vue(m).querySelectorAll('[data-phrase-comparaison="populations"] + ul li')].map(texteDe);
      expect(personnes).toEqual(modele.phrases.flatMap(({ liste: elements }) => (elements ?? []).map(({ texte }) => texte)));
      expect(personnes).toHaveLength(2);
      exigerPhraseSeule(m);
    } finally {
      vi.mocked(comparerPlacements).mockImplementation(reel);
    }
  });
});

describe('la garde des marques sur les deux courbes (test/navigateur/captures.js, § 14.5)', () => {
  test('B en tirets posée sur A : contre le fond tant que son jeton diffère de celui de A ; du jeton de A, contre A, et relevée', async () => {
    const m = await ouvrir(aTracer());
    m.ui.montrerProposition(1);
    await amener(m);
    const svg = vue(m).querySelector('svg[data-graphique="comparaison"]');
    await attendre(() => expect(svg.querySelector('path[data-serie="b"]')).not.toBeNull());
    svg.scrollIntoView({ block: 'center' });
    await image();
    const [a, b] = ['a', 'b'].map((cle) => svg.querySelector(`path[data-serie="${cle}"]`));
    expect(getComputedStyle(b).strokeDasharray).not.toBe('none');
    const fautesDeB = () => releverMarques(svg).fautes.filter((faute) => faute.includes('data-serie="b"'));
    // B recouvre A sur toute sa longueur.
    b.setAttribute('d', a.getAttribute('d'));
    expect(fautesDeB()).toEqual([]);
    // Du jeton de A, seul son motif la distingue.
    b.style.stroke = a.style.stroke;
    b.dataset.marque = a.dataset.marque;
    expect(fautesDeB()).toHaveLength(1);
  });
});

describe('le premier dessin de la vue (contrainte 53)', () => {
  test('la grande : l’ouverture de la page sur sa première vue ne calcule ni la comparaison ni la liste ; amenée à l’écran, la vue les calcule, une fois', async () => {
    const m = await ouvrir(generee(analyser(texteLivre('grande')).charge, { graine: 1, arret: 2_000, nombre: 2 }));
    m.ui.montrerProposition(charge(m).propositions[0].id);
    await attendre(() => expect(vuesRendues(m)).toEqual(VUES));
    for (let n = 0; n < 5; n += 1) await image();
    expect(vue(m).getBoundingClientRect().top).toBeGreaterThan(innerHeight);
    expect(appels(comparerPlacements)).toBe(0);
    expect(appels(candidatsDeComparaison)).toBe(0);
    expect(liste(m)).toBeNull();
    await amener(m);
    expect(appels(comparerPlacements)).toBe(1);
    expect(appels(candidatsDeComparaison)).toBe(1);
  }, 60_000);

  test('la grande : le lien vers la dernière vue dessine la comparaison avant de défiler ; la vue y est posée, et 30 images n’y changent rien', async () => {
    const m = await ouvrir(generee(analyser(texteLivre('grande')).charge, { graine: 1, arret: 2_000, nombre: 2 }));
    m.ui.montrerProposition(charge(m).propositions[0].id);
    await attendre(() => expect(vuesRendues(m)).toEqual(VUES));
    for (let n = 0; n < 3; n += 1) await image();
    expect(liste(m)).toBeNull();
    const lien = page(m).querySelector('nav a[href$="-vue-performance"]');
    const cible = document.getElementById(lien.getAttribute('href').slice(1));
    // Le plus proche ancêtre de la page qui défile à la verticale.
    let zone = page(m).parentElement;
    while (zone !== null && !['auto', 'scroll'].includes(getComputedStyle(zone).overflowY)) zone = zone.parentElement;
    zone ??= document.scrollingElement;
    const haut = () => cible.getBoundingClientRect().top - zone.getBoundingClientRect().top;
    lien.click();
    flushSync();
    // La comparaison est calculée et rendue avant le défilement.
    expect(liste(m)).not.toBeNull();
    expect(appels(comparerPlacements)).toBe(1);
    const hauts = [haut()];
    for (let n = 0; n < 30; n += 1) {
      await image();
      flushSync();
      hauts.push(haut());
    }
    expect(new Set(hauts).size, hauts.join(', ')).toBe(1);
    expect(hauts[0]).toBeGreaterThanOrEqual(0);
    expect(hauts[0]).toBeLessThan(zone.clientHeight);
    expect(document.activeElement).toBe(cible);
  }, 60_000);
});
