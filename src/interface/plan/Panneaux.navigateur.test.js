// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le clavier, l'infobulle, les panneaux, le menu par personne et les listes
// de travail du plan, dans un vrai moteur de rendu (§ 2.1 étape 6, § 4,
// § 4.1, § 4.2, § 4.4, § 5.8, § 5.9, § 7.1, § 7.3, § 13.5) : le plan est un
// seul arrêt de tabulation ; l'infobulle s'ouvre par le survol, le focus et
// la pression longue ; cliquer une chaise la sélectionne et ouvre son
// panneau ; le choix en attente relie une personne et une place sans
// glisser ; le menu fait ce que fait le geste ; un refus se pose sur la
// place ; les listes de travail mènent à la place ou à la personne ; une
// absente au tour a sa carte, qui ouvre sa fiche, hors de la réserve.
//
// Chaque épreuve monte App par monterApp, sur le système de fichiers simulé
// où un fichier d'état d'épreuve est posé puis ouvert, au cadre de
// 1 366 × 700, et agit par des entrées réelles (test/navigateur/entrees.js)
// ou par le clic d'un bouton HTML ; elle lit le rendu — attributs data-…,
// style calculé, boîte, texte — et le disque simulé : « une entrée » est une
// entrée du journal relu de révision supérieure à celle de l'état avant le
// geste, l'en-tête de l'état relu portant cette révision plus un. Les points
// visés se calculent par la géométrie des tables et la vue relue de
// l'attribut (§ 19.1). Les noms d'épreuve sont inventés.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { get, writable } from 'svelte/store';
import { appliquerCommande } from '../../application/commandes.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { nomAffiche } from '../../application/personnes.js';
import { etatPlaces } from '../../application/places.js';
import { INACTIVITE_MS } from '../../application/seance.js';
import { creerTraduction } from '../../application/traduction.js';
import { constante } from '../../geometrie/constantes.js';
import { surLeSol } from '../../geometrie/designation.js';
import { geometrieTable } from '../../geometrie/tables.js';
import { dessinDepuisEcran, ecranDepuisDessin, transformDe, vueDepuisTransform } from '../../geometrie/vue.js';
import { serialiser, serialiserCharge } from '../../stockage/canonique.js';
import { analyser, creerCharge } from '../../stockage/document.js';
import { lireJournal } from '../../stockage/journal.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import TEXTE_HUIT from '../../../test/fixtures/plan/huit_tables_retenu.gtt.json?raw';
import TEXTE_CONFLIT from '../../../test/fixtures/plan/conflit_table_un.gtt.json?raw';
import { fixerCadre, glisser, pointer, touche, toucher } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { traductionEcran } from '../../../test/navigateur/rendu.js';
import { TABLES_INTERFACE } from '../libelles.js';
import ListesTravail from './ListesTravail.svelte';
import { detailConflits } from './modele.js';
import { organisationDeCharge, cadreDepuisRect, englobantDuTour, nomDeCharge } from './vue_plan.js';

const BASE = 'soiree';
const DUREE_PRESSION = constante('DUREE_PRESSION_LONGUE_MS');

// --- Les configurations d'épreuve ---------------------------------------------

const NOMS = [
  ['Ombrelle', 'Iris'], ['Pervenche', 'Théo'], ['Lacasse', 'Ondine'], ['Grisaille', null],
  ['Tourmaline', 'Basile'], ['Arrosoir', 'Capucine'], ['Cerfeuil', 'Aurèle'], ['Bruyère', 'Mélisande'],
  ['Galet', 'Firmin'], ['Mistral', 'Clélia'], ['Houblon', 'Anatole'], ['Sarcelle', 'Solveig'],
  ['Ravenelle', 'Octave'], ['Pimprenelle', 'Albane'], ['Coquelicot', 'Gaspard'], ['Lavandière', 'Ysaline'],
  ['Châtaigne', 'Bérénice'], ['Murier', 'Lazare'],
];

const IRIS = 1;
const THEO = 2;
const ONDINE = 3;

// La charge de huit_tables_retenu.gtt.json : huit rondes de trois, en deux
// rangées de quatre, vingt personnes, trois tours, la proposition 1
// retenue. Au tour 1, la table 2 assied 4, 5 et 6 ; la table 8, la seule
// personne 20 : ses sièges 2 et 3 sont libres.
const huitRetenue = () => analyser(TEXTE_HUIT).charge;

// La même, avant la retenue : la proposition 1 seule, le plan proposé.
function huitAvantRetenue() {
  const charge = huitRetenue();
  charge.retenu = null;
  charge.evenement.etat = 'propose';
  return charge;
}

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;

/**
 * Une charge d'épreuve : des rondes posées sur une ligne, aux places données
 * — null suit le défaut —, les personnes de NOMS, et, quand tours est donné,
 * une proposition à sièges non attribués de ces listes, retenue si retenir.
 */
function chargeDe({ id, defaut = 8, places, ecart = 300, personnes, nombreTours = 3, tours = null, retenir = true, attribuer = false }) {
  const charge = creerCharge({ id, nom: 'Club des Merles', siegesParDefaut: defaut, tours: nombreTours });
  charge.reglages.attribuerSieges = attribuer;
  charge.participants = NOMS.slice(0, personnes).map(([nom, prenom], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    organisation: null,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = places.map((sieges, rang) => ({ id: rang + 1, numero: rang + 1, sieges, forme: 'ronde', position: { x: ecart * rang, y: 0 } }));
  charge.prochainsIds = { participant: personnes + 1, table: places.length + 1, proposition: 1 };
  if (tours === null) return charge;
  charge.propositions = [
    {
      id: 1,
      graine: 1,
      arret: 40,
      historique: 1000,
      produitVersion: 'epreuve',
      siegesAttribues: false,
      tables: charge.tables.map((table) => table.id),
      capacites: places.map((sieges) => sieges ?? defaut),
      tours: nombreTours,
      participants: charge.participants.map((personne) => personne.id),
      placement: tours.map((listes) => ({ sieges: listes, reserve: [] })),
    },
  ];
  charge.prochainsIds.proposition = 2;
  charge.evenement.etat = 'propose';
  return retenir ? executer(charge, 'retenirProposition', { id: 1 }) : charge;
}

// Cinq tables de huit, douze personnes, aucune proposition : chacun attend
// dans la réserve, et un geste de personne pose une réservation.
const sansProposition = (autres = {}) => chargeDe({ id: 'evt-cinq', places: [null, null, null, null, null], personnes: 12, ...autres });

// --- Le montage ---------------------------------------------------------------

let montes = [];
let nettoyages = [];
let erreursDemontees = [];
beforeEach(async () => {
  await fixerCadre(1366, 700);
});
afterEach(async () => {
  for (const nettoyer of nettoyages.reverse()) nettoyer();
  nettoyages = [];
  const erreurs = [...erreursDemontees, ...montes.flatMap((m) => m.erreurs())];
  erreursDemontees = [];
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  window.scrollTo(0, 0);
  await fixerCadre(1366, 700);
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

function demonter(m) {
  erreursDemontees.push(...m.erreurs());
  m.demonter();
  montes = montes.filter((autre) => autre !== m);
}

// Attend que l'assertion passe, le rendu de Svelte à jour, une image après
// l'autre.
async function attendre(assertion) {
  for (let essai = 0; ; essai += 1) {
    flushSync();
    try {
      return assertion();
    } catch (erreur) {
      if (essai >= 200) throw erreur;
      await new Promise((resoudre) => requestAnimationFrame(resoudre));
    }
  }
}

const uneImage = () => new Promise((resoudre) => requestAnimationFrame(resoudre));
async function images(n = 3) {
  for (let i = 0; i < n; i += 1) await uneImage();
  flushSync();
}

// La charge posée en fichier d'état, ouverte — en écriture sauf mode
// 'lecture' —, la section du plan ouverte et sa vue posée.
async function ouvrir(charge, { mode = 'ecriture' } = {}) {
  const texte = serialiser(charge, { revision: 1, produitVersion: VERSION.affichee });
  const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `${BASE}/${BASE}${SUFFIXES.etat}`, texte }] });
  montes.push(m);
  await m.seance.ouvrir(`${BASE}/${BASE}`);
  if (mode === 'ecriture') await m.seance.passerEnEcriture();
  m.ui.allerA('plan');
  flushSync();
  await attendre(() => expect(groupe(m).getAttribute('transform')).not.toBeNull());
  await attendre(() => expect(tous(m, '[data-table]').length).toBe(charge.tables.length));
  return m;
}

// Une démonstration livrée chargée, sur la section du plan, la vue posée.
async function demonstration(cle) {
  const m = await monterApp();
  montes.push(m);
  await m.facade.chargerDemonstration(cle);
  flushSync();
  m.ui.allerA('plan');
  flushSync();
  await attendre(() => expect(groupe(m).getAttribute('transform')).not.toBeNull());
  return m;
}

// Pose la vue par le cadrage de la séance, puis remonte le plan, qui la
// restitue.
async function avecVue(m, vue) {
  m.seance.demanderCadrage(vue);
  m.ui.allerA('tables');
  flushSync();
  m.ui.allerA('plan');
  flushSync();
  await attendre(() => expect(groupe(m).getAttribute('transform')).toBe(transformDe(vue)));
  await images(2);
}

// La vue qui pose le centre de l'englobant du tour au centre du cadre, à k.
function vueCentree(m, k) {
  const cadre = cadreDe(m);
  const englobant = englobantDuTour(etatMontre(m));
  return {
    k,
    tx: cadre.largeur / 2 - (k * (englobant.minX + englobant.maxX)) / 2,
    ty: cadre.hauteur / 2 - (k * (englobant.minY + englobant.maxY)) / 2,
  };
}

// --- Les lectures du rendu et du disque ---------------------------------------

const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const tous = (m, selecteur) => [...m.racine.querySelectorAll(selecteur)];
const racinePlan = (m) => dans(m, '[data-plan]');
const groupe = (m) => dans(m, '[data-vue]');
const tableEl = (m, id) => dans(m, `[data-table="${id}"]`);
const chaiseEl = (m, table, siege) => dans(m, `[data-siege="${table}:${siege}"]`);
const panneau = (m, genre) => dans(m, `[data-panneau="${genre}"]`);
const cadreDe = (m) => cadreDepuisRect(racinePlan(m).getBoundingClientRect());
const vueLue = (m) => vueDepuisTransform(groupe(m).getAttribute('transform'));
const charge = (m) => m.seance.etat().charge;
const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
// Le t de l'écran, celui qu'App pose au contexte (§ 14.6) : l'attendu d'un
// texte lu tel que l'écran le porte, insécables comprises.
const { t: tEcran } = traductionEcran();
const actif = (m) => racinePlan(m).getAttribute('aria-activedescendant');

// Les commandes d'un conteneur : la valeur de data-commande de chaque
// bouton, dans l'ordre du document.
const commandesDe = (element) => [...element.querySelectorAll('[data-commande]')].map((bouton) => bouton.dataset.commande);

// L'état des places du tour montré, tel que le plan le calcule.
const etatMontre = (m) => etatPlaces(charge(m), { tour: m.ui.etat().tour, proposition: m.ui.etat().proposition });

function geometrieDe(m, id) {
  const table = etatMontre(m).tables.find((candidate) => candidate.id === id);
  return geometrieTable(table, table.capacite);
}

const ecranDe = (m, { x, y }) => ecranDepuisDessin(vueLue(m), cadreDe(m), x, y);
const pointTable = (m, id) => ecranDe(m, geometrieDe(m, id).centre);
const pointChaise = (m, id, siege) => ecranDe(m, geometrieDe(m, id).chaises[siege - 1]);

function pointSol(m) {
  const cadre = cadreDe(m);
  const point = { x: cadre.gauche + 6, y: cadre.haut + 6 };
  const geometries = etatMontre(m).tables.map((table) => geometrieTable(table, table.capacite));
  expect(surLeSol(dessinDepuisEcran(vueLue(m), cadre, point.x, point.y), geometries)).toBe(true);
  return point;
}

// Un appui relâché sur place, sous le seuil : un clic de pointeur réel.
async function cliquerPoint({ x, y }) {
  await pointer('presser', x, y);
  await pointer('relacher', x, y);
  await images(2);
}

// Un clic réel au centre d'une chaise. Quand elle est hors du cadre du
// plan — les annonces de l'écran de l'événement, avertissements compris,
// prennent leur hauteur à la surface —, la vue se déplace d'abord, par le
// cadrage de la séance, pour poser la chaise au centre du cadre, au même k.
async function cliquerChaise(m, table, siege) {
  const atteinte = () => {
    const { x, y } = pointChaise(m, table, siege);
    return chaiseEl(m, table, siege)?.contains(document.elementFromPoint(x, y)) ?? false;
  };
  if (!atteinte()) {
    const vue = vueLue(m);
    const cadre = cadreDe(m);
    const { x, y } = pointChaise(m, table, siege);
    await avecVue(m, {
      k: vue.k,
      tx: vue.tx + cadre.gauche + cadre.largeur / 2 - x,
      ty: vue.ty + cadre.haut + cadre.hauteur / 2 - y,
    });
    await attendre(() => expect(atteinte()).toBe(true));
  }
  await cliquerPoint(pointChaise(m, table, siege));
}

// Un clic de pointeur réel au centre d'un élément HTML, amené dans la
// fenêtre.
async function presserBouton(element) {
  element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const boite = element.getBoundingClientRect();
  await cliquerPoint({ x: boite.left + boite.width / 2, y: boite.top + boite.height / 2 });
}

// Presse un bouton par le vrai pointeur, et dit s'il a reçu l'appui : un
// bouton que le pointeur traverse laisse l'appui à ce qui est dessous.
async function presseRecue(element) {
  let recu = false;
  const noter = () => {
    recu = true;
  };
  element.addEventListener('pointerdown', noter);
  try {
    await presserBouton(element);
  } finally {
    element.removeEventListener('pointerdown', noter);
  }
  return recu;
}

// Presse au point depuis et avance jusqu'au point vers sans relâcher : le
// fantôme reste montré.
async function presserEtBouger(depuis, vers, { pas = 6 } = {}) {
  await pointer('presser', depuis.x, depuis.y);
  for (let i = 1; i <= pas; i += 1) {
    const t = i / pas;
    await pointer('bouger', depuis.x + (vers.x - depuis.x) * t, depuis.y + (vers.y - depuis.y) * t);
    await images(1);
  }
  flushSync();
}

// Clique un bouton par son clic HTML, puis laisse la séance écrire.
async function cliquer(element) {
  expect(element, 'bouton présent').not.toBeNull();
  element.click();
  flushSync();
  await images(2);
}

function fichiers(m) {
  return {
    etat: m.fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.etat}`),
    journal: m.fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.journal}`),
    revision: m.seance.etat().evenement.revision,
  };
}

function entreesApres(m, r) {
  const texte = m.fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.journal}`);
  return texte === null ? [] : lireJournal(texte).entrees.filter((entree) => entree.revision > r);
}

async function uneEntree(m, r) {
  await attendre(() => expect(m.seance.etat().evenement.revision).toBe(r + 1));
  const entrees = entreesApres(m, r);
  expect(entrees).toHaveLength(1);
  expect(analyser(m.fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.etat}`)).entete.revision).toBe(r + 1);
  return entrees[0].libelle;
}

async function rienEcrit(m, avant) {
  await images(4);
  expect(fichiers(m)).toEqual(avant);
}

const decrit = (element) => {
  const id = element.getAttribute('aria-describedby');
  return id === null ? null : document.getElementById(id);
};

function recoupe(a, b) {
  const p = a.getBoundingClientRect();
  const q = b.getBoundingClientRect();
  return p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
}

// La boîte d'un élément est dans la fenêtre et dans le cadre du plan.
function dansLaFenetre(m, element) {
  const boite = element.getBoundingClientRect();
  const cadre = racinePlan(m).getBoundingClientRect();
  return (
    boite.width > 0 &&
    boite.left >= Math.max(0, cadre.left) &&
    boite.top >= Math.max(0, cadre.top) &&
    boite.right <= Math.min(innerWidth, cadre.right) &&
    boite.bottom <= Math.min(innerHeight, cadre.bottom)
  );
}

// Une marque se peint : style calculé ni display: none ni visibility
// hidden, un trait ou un remplissage, et une boîte non nulle.
function peinte(element) {
  if (element === null) return false;
  const style = getComputedStyle(element);
  const boite = element.getBoundingClientRect();
  const peint = (style.stroke !== 'none' && parseFloat(style.strokeWidth) > 0) || style.fill !== 'none';
  return style.display !== 'none' && style.visibility !== 'hidden' && peint && boite.width > 0 && boite.height > 0;
}

// Relève les commandes que l'interface confie à la séance.
function releverCommandes(m) {
  const seance = m.seance;
  const originale = seance.executer;
  const appels = [];
  seance.executer = (nom, args) => {
    appels.push({ nom, args });
    return originale(nom, args);
  };
  nettoyages.push(() => {
    seance.executer = originale;
  });
  return appels;
}

// L'infobulle de la page : la seule, visible ou non.
function infobulles() {
  return [...document.querySelectorAll('[role="tooltip"]')];
}
const infobulleVisible = (element) =>
  element !== undefined && !element.hidden && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0;

// Choisit une personne de la réserve visible.
async function choisirDansLaReserve(m, participant) {
  const bouton = dans(m, `[data-reserve] [data-participant="${participant}"]`);
  expect(bouton, `personne ${participant} dans la réserve`).not.toBeNull();
  await cliquer(bouton);
  await attendre(() => expect(m.ui.etat().choix?.participant).toBe(participant));
}

// Le bouton d'une action du panneau d'une place.
const actionPlace = (m, action) => panneau(m, 'place')?.querySelector(`[data-commande="${action}"]`) ?? null;

// Entre dans le plan au clavier : Tab depuis le dernier contrôle de la barre
// de vue, l'élément qui le précède.
async function entrerAuClavier(m) {
  dans(m, '[data-commande="pleinEcran"]').focus();
  await touche('Tab');
  flushSync();
  expect(document.activeElement).toBe(racinePlan(m));
}

// Mène l'élément actif du plan à la table voulue, flèche après flèche, puis
// descend dans ses sièges jusqu'au siège voulu et l'active par l'entrée :
// la place est sélectionnée et le focus passe à son panneau.
async function activerSiegeAuClavier(m, table, siege) {
  await entrerAuClavier(m);
  // Un siège actif remonte d'abord à sa table.
  if (actif(m).startsWith('siege-')) await touche('Escape');
  flushSync();
  const cible = geometrieDe(m, table).centre;
  for (let pas = 0; actif(m) !== `table-${table}`; pas += 1) {
    expect(pas, 'flèches pour atteindre la table').toBeLessThan(12);
    const courante = Number(actif(m).replace(/^table-/, ''));
    const depuis = geometrieDe(m, courante).centre;
    const dx = cible.x - depuis.x;
    const dy = cible.y - depuis.y;
    await touche(Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : dy > 0 ? 'ArrowDown' : 'ArrowUp');
    flushSync();
  }
  await touche('Enter');
  flushSync();
  for (let s = 1; s < siege; s += 1) await touche('ArrowRight');
  flushSync();
  expect(actif(m)).toBe(`siege-${table}-${siege}`);
  await touche('Enter');
  await attendre(() => expect(m.ui.etat().selection).toEqual({ table, siege }));
  await attendre(() => expect(panneau(m, 'place').contains(document.activeElement)).toBe(true));
}

// Le refus posé sur une place : la cible de son aria-describedby, hors du
// <svg data-plan>, qui recoupe la table, porte les codes dans l'ordre, chacun
// avec une commande ; aucune fenêtre ; rien d'écrit.
async function refusSurLaPlace(m, element, table, codes, avant) {
  await attendre(() => expect(decrit(element)).not.toBeNull());
  const message = decrit(element);
  expect(racinePlan(m).contains(message)).toBe(false);
  expect(recoupe(message, tableEl(m, table))).toBe(true);
  const refus = [...message.querySelectorAll('[data-refus]')];
  expect(refus.map((r) => r.dataset.refus)).toEqual(codes);
  for (const r of refus) {
    expect(r.querySelector('[data-commande]'), r.dataset.refus).not.toBeNull();
    expect(texteDe(r).length).toBeGreaterThan(0);
  }
  expect(document.querySelector('[role="dialog"], dialog[open]')).toBeNull();
  await rienEcrit(m, avant);
  return message;
}

// --- Un seul arrêt (§ 7.3, § 13.5) --------------------------------------------

describe('le plan est un seul arrêt de tabulation (§ 7.3, § 13.5)', () => {
  test('grande démonstration sans exception, 264 sièges, k = 0,5 : Tab entre et sort, les flèches changent de table, l’entrée descend, l’échappement remonte ; à k = 0,39, l’entrée ouvre le panneau de la table et Échap rend le focus', async () => {
    const m = await demonstration('grande-sans-exception');
    await avecVue(m, vueCentree(m, 0.5));
    expect(vueLue(m).k).toBe(0.5);
    expect(tous(m, '[data-siege]').length).toBe(264);
    const racine = racinePlan(m);
    const arrets = [racine, ...racine.querySelectorAll('*')].filter((element) => element.tabIndex >= 0);
    expect(arrets).toEqual([racine]);

    dans(m, '[data-commande="pleinEcran"]').focus();
    await touche('Tab');
    expect(document.activeElement).toBe(racine);
    await touche('Tab');
    expect(document.activeElement).not.toBe(racine);
    expect(racine.contains(document.activeElement)).toBe(false);

    racine.focus();
    flushSync();
    const tables = charge(m).tables;
    const premiere = tables[0];
    expect(actif(m)).toBe(`table-${premiere.id}`);
    // La voisine de droite : la plus proche à droite, sur la même rangée.
    const voisine = tables
      .filter(({ position }) => position.y === premiere.position.y && position.x > premiere.position.x)
      .reduce((plus, table) => (plus === undefined || table.position.x < plus.position.x ? table : plus), undefined);
    expect(voisine).toBeDefined();
    await touche('ArrowRight');
    flushSync();
    expect(actif(m)).toBe(`table-${voisine.id}`);
    expect(document.getElementById(actif(m))).toBe(tableEl(m, voisine.id));
    await touche('Enter');
    flushSync();
    expect(actif(m)).toBe(`siege-${voisine.id}-1`);
    expect(document.getElementById(actif(m))).toBe(chaiseEl(m, voisine.id, 1));
    await touche('ArrowRight');
    flushSync();
    expect(actif(m)).toBe(`siege-${voisine.id}-2`);
    await touche('Escape');
    flushSync();
    expect(actif(m)).toBe(`table-${voisine.id}`);

    await avecVue(m, vueCentree(m, 0.39));
    expect(tous(m, '[data-siege]').length).toBe(0);
    await entrerAuClavier(m);
    const active = Number(actif(m).replace(/^table-/, ''));
    await touche('Enter');
    await attendre(() => expect(panneau(m, 'table')).not.toBeNull());
    expect(panneau(m, 'table').dataset.tablePanneau).toBe(String(active));
    await attendre(() => expect(panneau(m, 'table').contains(document.activeElement)).toBe(true));
    expect(document.activeElement.hasAttribute('data-choix-siege')).toBe(true);
    await touche('Escape');
    await attendre(() => expect(panneau(m, 'table')).toBeNull());
    expect(document.activeElement).toBe(racinePlan(m));

    // Le siège choisi dans le panneau de la table : le panneau de la place
    // s'ouvre et reçoit le focus, qui ne tombe pas sur le corps du document.
    await touche('Enter');
    await attendre(() => expect(panneau(m, 'table')?.contains(document.activeElement)).toBe(true));
    await touche('Enter');
    await attendre(() => expect(panneau(m, 'place')).not.toBeNull());
    expect(m.ui.etat().selection).toEqual({ table: active, siege: 1 });
    await attendre(() => expect(panneau(m, 'place').contains(document.activeElement)).toBe(true));
    await touche('Escape');
    await attendre(() => expect(panneau(m, 'place')).toBeNull());
    expect(document.activeElement).toBe(racinePlan(m));
  });

  test('noms accessibles : la racine porte tabindex 0, un role et un aria-label ; chaque table, numéro, places et conflits, tirés des libellés', async () => {
    const m = await ouvrir(analyser(TEXTE_CONFLIT).charge);
    m.ui.montrerTour(2);
    flushSync();
    await images(2);
    const racine = racinePlan(m);
    expect(racine.getAttribute('tabindex')).toBe('0');
    expect(racine.getAttribute('role')).toBeTruthy();
    expect(racine.getAttribute('aria-label')).toBe('Plan de salle');
    const etat = etatMontre(m);
    expect(etat.tables.length).toBe(4);
    for (const table of etat.tables) {
      const conflits = table.conflits.nombre === 0 ? 'aucun conflit' : `${table.conflits.nombre} conflits`;
      expect(tableEl(m, table.id).getAttribute('aria-label')).toBe(`Table ${table.numero}, 2 places, ${conflits}`);
    }
    const chaise = chaiseEl(m, 1, 1);
    expect(chaise.id).toBe('siege-1-1');
    expect(chaise.getAttribute('aria-label')).toBe('1. Iris Ombrelle');
    expect(tableEl(m, 1).id).toBe('table-1');
  });
});

// --- L'organisation nommée, la légende des conflits (§ 7.5) -------------------

describe('l’infobulle nomme l’organisation d’une paire réunie ; la légende des conflits (§ 7.5)', () => {

  // Deux tables de trois, six personnes, un tour : la table 1 réunit Iris
  // et Théo, du Club des Merles ; la table 2, Basile et Capucine, d'une
  // organisation écrite avec une minuscule et un blanc final, telle que la
  // liste la porte.
  function deuxOrganisations(reglages = {}) {
    const charge = chargeDe({ id: 'evt-organisations', defaut: 3, places: [null, null], personnes: 6, nombreTours: 1, tours: [[[1, 2, 4], [3, 5, 6]]] });
    const organisations = new Map([[1, 'Club des Merles'], [2, 'Club des Merles'], [5, 'cercle des Hérons '], [6, 'cercle des Hérons ']]);
    for (const personne of charge.participants) personne.organisation = organisations.get(personne.id) ?? null;
    Object.assign(charge.reglages, reglages);
    return charge;
  }

  test('le survol d’une table en conflit d’organisation : « Même organisation (…) : … et … », l’organisation dans son propre nœud', async () => {
    const m = await ouvrir(deuxOrganisations());
    expect(etatMontre(m).tables.map(({ conflits }) => conflits.nombre)).toEqual([1, 1]);
    const infobulle = () => document.querySelector('[role="tooltip"]');
    // Le pointeur part du sol : un survol commence par un mouvement.
    await pointer('bouger', pointSol(m).x, pointSol(m).y);
    for (const [table, organisation, noms] of [
      [1, 'Club des Merles', ['Iris Ombrelle', 'Théo Pervenche']],
      [2, 'cercle des Hérons ', ['Basile Tourmaline', 'Capucine Arrosoir']],
    ]) {
      const point = pointTable(m, table);
      await pointer('bouger', point.x, point.y);
      await attendre(() => expect(infobulleVisible(infobulle())).toBe(true));
      const lignes = [...infobulle().querySelectorAll('p')];
      expect(lignes.map((p) => p.textContent)).toEqual([
        `${tEcran('plan.infobulle.table', { numero: table })}${tEcran('plan.infobulle.nombre', { nombre: 1 })}`,
        `${tEcran('plan.infobulle.separerOrganisations')}${organisation}${tEcran('plan.infobulle.finOrganisation')}${noms.join(tEcran('plan.infobulle.et'))}`,
      ]);
      expect(lignes[1].textContent).toMatch(/^Même organisation \(/);
      const noeuds = [...lignes[1].children].map((e) => e.textContent);
      expect(noeuds).toContain(organisation);
      for (const nom of noms) expect(noeuds).toContain(nom);
      await pointer('bouger', pointSol(m).x, pointSol(m).y);
      await attendre(() => expect(infobulleVisible(infobulle())).toBe(false));
    }
  });

  test('une table libellée : son nom accessible le cite ; l’infobulle et le titre de son panneau le portent dans leur propre nœud', async () => {
    const libellee = deuxOrganisations();
    libellee.tables[0].libelle = 'Coin des invités';
    const m = await ouvrir(libellee);
    expect(tableEl(m, 1).getAttribute('aria-label')).toBe('Table 1 «\u{A0}Coin des invités\u{A0}», 3 places, 1 conflit');
    expect(tableEl(m, 2).getAttribute('aria-label')).toBe('Table 2, 3 places, 1 conflit');
    const infobulle = () => document.querySelector('[role="tooltip"]');
    await pointer('bouger', pointSol(m).x, pointSol(m).y);
    const entetes = [];
    for (const table of [1, 2]) {
      const point = pointTable(m, table);
      await pointer('bouger', point.x, point.y);
      await attendre(() => expect(infobulleVisible(infobulle())).toBe(true));
      entetes.push(infobulle().querySelector('p'));
      const entete = entetes.at(-1);
      if (table === 1) {
        expect(entete.textContent).toBe(
          `${tEcran('plan.infobulle.table', { numero: 1 })}${tEcran('plan.table.avantLibelle')}Coin des invités${tEcran('plan.infobulle.nombre', { nombre: 1 })}`,
        );
        expect([...entete.children].map((e) => e.textContent)).toContain('Coin des invités');
      } else {
        expect(entete.textContent).toBe(`${tEcran('plan.infobulle.table', { numero: 2 })}${tEcran('plan.infobulle.nombre', { nombre: 1 })}`);
      }
      await pointer('bouger', pointSol(m).x, pointSol(m).y);
      await attendre(() => expect(infobulleVisible(infobulle())).toBe(false));
    }
    m.ui.selectionner({ table: 1 });
    await attendre(() => expect(panneau(m, 'table')).not.toBeNull());
    const titre = panneau(m, 'table').querySelector('h3');
    expect(titre.textContent).toBe(`${t('plan.refus.table', { numero: 1 })}${t('plan.table.avantLibelle')}Coin des invités`);
    expect([...titre.children].map((e) => e.textContent)).toContain('Coin des invités');
    m.ui.selectionner({ table: 2 });
    await attendre(() => expect(panneau(m, 'table').querySelector('h3').textContent).toBe(t('plan.refus.table', { numero: 2 })));
  });

  test('la barre de vue se lit en groupes nommés : le zoom, puis l’affichage, leurs commandes dans l’ordre', async () => {
    const m = await ouvrir(deuxOrganisations({ nouvelleTable: false }));
    const barre = dans(m, '[role="toolbar"]');
    expect(barre).not.toBeNull();
    const groupes = [...barre.querySelectorAll('[role="group"]')];
    expect(groupes.map((g) => g.getAttribute('aria-label'))).toEqual([t('plan.vue.groupeZoom'), t('plan.vue.groupeAffichage')]);
    expect(groupes.map((g) => [...g.querySelectorAll('[data-commande]')].map((b) => b.dataset.commande))).toEqual([
      ['zoomer', 'dezoomer', 'ajuster'],
      ['listes', 'organisations', 'legende', 'pleinEcran'],
    ]);
  });

  test('une liste de conflits qui relie deux présents ouvre la légende sur le conflit d’organisation, avant les règles des réglages', async () => {
    // Capucine Arrosoir, du cercle des Hérons, nomme le Club des Merles :
    // le critère a un objet, sans qu'aucune table du plan n'en soit en
    // conflit. Sans liste, l'épreuve suivante attend la légende sans lui.
    const charge = deuxOrganisations({ nouvelleTable: false });
    charge.participants.find(({ id }) => id === 6).conflits = ['Club des Merles'];
    const m = await ouvrir(charge);
    await cliquer(dans(m, '[data-commande="legende"]'));
    await attendre(() => expect(dans(m, '[data-legende]')).not.toBeNull());
    expect(tous(m, '[data-legende] [data-legende-regle]').map((e) => e.dataset.legendeRegle)).toEqual([
      'conflitsOrganisation',
      'separerOrganisations',
      'nouveauxVoisins',
    ]);
  });

  for (const mode of ['ecriture', 'lecture']) {
    test(`mode ${mode} : le bouton « Légende » de la barre de vue ouvre la légende des seules règles actives, et la referme ; rien ne s’écrit`, async () => {
      const m = await ouvrir(deuxOrganisations({ nouvelleTable: false }), { mode });
      const revision = m.seance.etat().evenement.revision;
      const bouton = dans(m, '[data-commande="legende"]');
      expect(bouton).not.toBeNull();
      expect(bouton.closest('[role="toolbar"]')).not.toBeNull();
      expect(bouton.textContent).toBe(t('plan.legende.ouvrir'));
      // Un dévoilement : aria-expanded, et non aria-pressed ; aria-controls ne
      // désigne la légende que lorsqu'elle est dans le DOM.
      expect(bouton.hasAttribute('aria-pressed')).toBe(false);
      expect(bouton.getAttribute('aria-expanded')).toBe('false');
      expect(bouton.hasAttribute('aria-controls')).toBe(false);
      expect(dans(m, '[data-legende]')).toBeNull();
      await cliquer(bouton);
      await attendre(() => expect(dans(m, '[data-legende]')).not.toBeNull());
      expect(bouton.getAttribute('aria-expanded')).toBe('true');
      expect(bouton.getAttribute('aria-controls')).toBe(dans(m, '[data-legende]').id);
      expect(tous(m, '[data-legende] [data-legende-regle]').map((e) => e.dataset.legendeRegle)).toEqual(['separerOrganisations', 'nouveauxVoisins']);
      expect(dans(m, '[data-legende] [data-marque="trameTable"]')).toBeNull();
      expect(infobulleVisible(dans(m, '[data-legende]'))).toBe(true);
      await cliquer(bouton);
      await attendre(() => expect(dans(m, '[data-legende]')).toBeNull());
      expect(bouton.getAttribute('aria-expanded')).toBe('false');
      expect(bouton.hasAttribute('aria-controls')).toBe(false);
      expect(m.seance.etat().evenement.revision).toBe(revision);
    });
  }
});

// --- L'infobulle (§ 7.1, § 7.3, § 19.4) ---------------------------------------

describe('l’infobulle : un composant, trois déclencheurs (§ 7.1, § 7.3)', () => {
  // Le détail que rend le moteur pour la table 1 au tour 2, nommé par
  // detailConflits, en mots : chaque ligne de l'infobulle, telle que ses
  // nœuds la composent.
  function detailAttendu(m) {
    const table = etatMontre(m).tables.find(({ id }) => id === 1);
    expect(table.conflits.nombre).toBeGreaterThan(0);
    const detail = detailConflits(table, nomDeCharge(charge(m)), organisationDeCharge(charge(m)));
    return [
      `${t('plan.infobulle.table', { numero: detail.numero })}${t('plan.infobulle.nombre', { nombre: detail.nombre })}`,
      ...detail.lignes.map(({ cle, organisation, groupes }) =>
        [
          t(cle),
          ...(organisation === null ? [] : [organisation, t('plan.infobulle.finOrganisation')]),
          groupes.map((groupe) => groupe.join(t('plan.infobulle.et'))).join(t('plan.infobulle.separateur')),
        ]
          .join('')
          .replace(/\s+/g, ' ')
          .trim(),
      ),
    ];
  }
  const lignes = (element) => [...element.querySelectorAll('p')].map(texteDe);

  test('survol, focus par les flèches, pression longue : le même [role=tooltip], seul de son espèce, au détail du moteur ; relâchée avant le terme, rien ; aucun <title>', async () => {
    const m = await ouvrir(analyser(TEXTE_CONFLIT).charge);
    m.ui.montrerTour(2);
    flushSync();
    await images(2);
    const attendu = detailAttendu(m);
    expect(attendu.length).toBeGreaterThan(1);
    expect(infobulles()).toHaveLength(1);
    const infobulle = infobulles()[0];
    expect(infobulleVisible(infobulle)).toBe(false);

    // (a) le survol, sans bouton enfoncé.
    const centre = pointTable(m, 1);
    await pointer('bouger', centre.x, centre.y);
    await attendre(() => expect(infobulleVisible(infobulles()[0])).toBe(true));
    expect(infobulles()).toEqual([infobulle]);
    expect(lignes(infobulle)).toEqual(attendu);
    const sol = pointSol(m);
    await pointer('bouger', sol.x, sol.y);
    await attendre(() => expect(infobulleVisible(infobulle)).toBe(false));
    const saine = pointTable(m, 2);
    await pointer('bouger', saine.x, saine.y);
    await images(2);
    expect(infobulleVisible(infobulle)).toBe(false);
    await pointer('bouger', sol.x, sol.y);

    // (b) le focus, par les flèches.
    await entrerAuClavier(m);
    expect(actif(m)).toBe('table-1');
    await touche('ArrowRight');
    flushSync();
    expect(actif(m)).toBe('table-2');
    await attendre(() => expect(infobulleVisible(infobulle)).toBe(false));
    await touche('ArrowLeft');
    flushSync();
    expect(actif(m)).toBe('table-1');
    await attendre(() => expect(infobulleVisible(infobulle)).toBe(true));
    expect(infobulles()).toEqual([infobulle]);
    expect(lignes(infobulle)).toEqual(attendu);
    racinePlan(m).blur();
    await attendre(() => expect(infobulleVisible(infobulle)).toBe(false));

    // (c) la pression longue : relâchée avant le terme, rien ; tenue, l'infobulle.
    await toucher('presser', [centre]);
    m.horloge.avancer(DUREE_PRESSION - 1);
    await images(2);
    expect(infobulleVisible(infobulle)).toBe(false);
    await toucher('relacher', []);
    m.horloge.avancer(DUREE_PRESSION);
    await images(2);
    expect(infobulleVisible(infobulle)).toBe(false);
    // Glissée au-delà du seuil, la pression devient un glissement : rien.
    document.activeElement?.blur();
    await toucher('presser', [centre]);
    await toucher('bouger', [{ x: centre.x + 3 * constante('SEUIL_GLISSER_PX'), y: centre.y }]);
    await images(2);
    m.horloge.avancer(DUREE_PRESSION);
    await images(2);
    expect(infobulleVisible(infobulle)).toBe(false);
    await toucher('annuler', []);
    await images(2);
    document.activeElement?.blur();
    await toucher('presser', [centre]);
    m.horloge.avancer(DUREE_PRESSION);
    await attendre(() => expect(infobulleVisible(infobulle)).toBe(true));
    expect(infobulles()).toEqual([infobulle]);
    expect(lignes(infobulle)).toEqual(attendu);
    await toucher('relacher', []);
    await images(2);

    expect(racinePlan(m).querySelector('title')).toBeNull();
  });
});

// --- Cliquer une chaise (§ 7.1, § 8.4) ----------------------------------------

describe('cliquer une chaise sélectionne la place (§ 7.1, § 8.4)', () => {
  test('une chaise libre : la marque selection se peint ; le panneau offre exactement Assigner, Réserver, Donner un titre, Désigner ; rien d’écrit ; une chaise réservée et titrée : Retirer la réservation, Retirer le titre', async () => {
    const base = executer(huitRetenue(), 'designer', { participant: 9, table: 8, siege: 3, libelle: 'animateur' });
    const m = await ouvrir(base);
    const avant = fichiers(m);
    await cliquerChaise(m, 8, 2);
    expect(m.ui.etat().selection).toEqual({ table: 8, siege: 2 });
    const marque = chaiseEl(m, 8, 2).querySelector('[data-marque="selection"]');
    expect(peinte(marque)).toBe(true);
    expect(tous(m, '[data-marque="selection"]')).toEqual([marque]);
    await attendre(() => expect(panneau(m, 'place')).not.toBeNull());
    expect(commandesDe(panneau(m, 'place'))).toEqual(['assigner', 'reserver', 'donnerTitre', 'designer']);
    await rienEcrit(m, avant);

    await cliquerChaise(m, 8, 3);
    expect(m.ui.etat().selection).toEqual({ table: 8, siege: 3 });
    await attendre(() => expect(commandesDe(panneau(m, 'place'))).toContain('retirerReservation'));
    const offertes = commandesDe(panneau(m, 'place'));
    expect(offertes).toContain('retirerTitre');
    expect(offertes).not.toContain('donnerTitre');
    expect(offertes).not.toContain('designer');
    await rienEcrit(m, avant);
  });
});

// --- Assigner (§ 7.1, § 5.8) ----------------------------------------------------

describe('assigner, par le choix en attente (§ 7.1, § 5.8)', () => {
  test('avant toute proposition : Théo choisi dans la réserve, puis une chaise libre de la table 4, « Assigner » → reserver, portée « tour », au tour affiché ; l’ordre inverse rend la même charge', async () => {
    const premier = await ouvrir(sansProposition());
    const commandes = releverCommandes(premier);
    let r = fichiers(premier).revision;
    await choisirDansLaReserve(premier, THEO);
    expect(dans(premier, `[data-reserve] [data-participant="${THEO}"]`).getAttribute('aria-pressed')).toBe('true');
    await cliquerChaise(premier, 4, 3);
    await cliquer(actionPlace(premier, 'assigner'));
    await uneEntree(premier, r);
    expect(commandes).toEqual([{ nom: 'reserver', args: { participant: THEO, table: 4, siege: 3, portee: 'tour', tour: 1 } }]);
    expect(premier.ui.etat().choix).toBeNull();
    const chargePremier = serialiserCharge(charge(premier));
    demonter(premier);

    const second = await ouvrir(sansProposition());
    r = fichiers(second).revision;
    await cliquerChaise(second, 4, 3);
    await choisirDansLaReserve(second, THEO);
    expect(second.ui.etat().selection).toEqual({ table: 4, siege: 3 });
    await cliquer(actionPlace(second, 'assigner'));
    await uneEntree(second, r);
    expect(serialiserCharge(charge(second))).toBe(chargePremier);
  });

  test('sur un retenu : une personne de la réserve du tour 2 → deplacerDansRetenu, une entrée ; une proposition montrée → PROPOSITION_MONTREE sur la place, aucune entrée', async () => {
    const base = executer(huitRetenue(), 'retirerDuTour', { tour: 2, participant: ONDINE });
    const m = await ouvrir(base);
    m.ui.montrerTour(2);
    flushSync();
    await images(2);
    const commandes = releverCommandes(m);
    const r = fichiers(m).revision;
    await choisirDansLaReserve(m, ONDINE);
    await cliquerChaise(m, 8, 1);
    await cliquer(actionPlace(m, 'assigner'));
    await uneEntree(m, r);
    expect(commandes.at(-1)).toEqual({ nom: 'deplacerDansRetenu', args: { tour: 2, participant: ONDINE, table: 8, siege: 1 } });

    m.ui.montrerProposition(1);
    flushSync();
    await images(2);
    const avant = fichiers(m);
    const assise = etatMontre(m).tables[0].chaises[0].occupant;
    await cliquerChaise(m, 1, 1);
    await cliquer(dans(m, `[data-menu="${assise}"] [data-commande="deplacer"]`));
    await cliquerChaise(m, 8, 2);
    expect(m.ui.etat().choix?.participant).toBe(assise);
    await cliquer(actionPlace(m, 'assigner'));
    await refusSurLaPlace(m, chaiseEl(m, 8, 2), 8, ['PROPOSITION_MONTREE'], avant);
  });
});

describe("un conflit d'organisation se signale à la table, il ne se refuse pas (§ 5.9, § 7.5)", () => {
  // Les paires que le panneau de la table nomme, chacune « A et B ».
  const pairesDuPanneau = (m) => [...panneau(m, 'table').querySelectorAll('[data-conflits-table] [data-conflit-organisation]')].map(texteDe);
  const trameEvitement = (m, table) => tableEl(m, table).querySelector('[data-marque="trameEvitement"]');

  test("une réservation qui réunit deux personnes en conflit : acceptée en une entrée ; la table porte la trame du conflit, et son panneau nomme la paire", async () => {
    // Iris Ombrelle, du Club des Merles, réservée à la table 4 ; Théo
    // Pervenche, sans organisation, nomme le Club des Merles.
    const base = sansProposition();
    base.participants[IRIS - 1].organisation = 'Club des Merles';
    base.participants[THEO - 1].conflits = ['Club des Merles'];
    base.reservations = [{ participant: IRIS, table: 4, siege: 1, portee: 'tous', tour: null }];
    const m = await ouvrir(base);
    expect(trameEvitement(m, 4)).toBeNull();
    const commandes = releverCommandes(m);
    const r = fichiers(m).revision;
    await choisirDansLaReserve(m, THEO);
    await cliquerChaise(m, 4, 3);
    await cliquer(actionPlace(m, 'assigner'));
    await uneEntree(m, r);
    expect(commandes).toEqual([{ nom: 'reserver', args: { participant: THEO, table: 4, siege: 3, portee: 'tour', tour: 1 } }]);
    expect(dans(m, '[data-refus]')).toBeNull();
    await attendre(() => expect(trameEvitement(m, 4)).not.toBeNull());
    expect(etatMontre(m).tables.find(({ id }) => id === 4).conflits.regles.map(({ regle }) => regle)).toContain('conflitsOrganisation');
    m.ui.selectionner({ table: 4 });
    await attendre(() => expect(panneau(m, 'table')).not.toBeNull());
    expect(texteDe(panneau(m, 'table').querySelector('[data-conflits-table]').previousElementSibling)).toBe(t('plan.panneauTable.conflits'));
    expect(pairesDuPanneau(m)).toEqual([`Iris Ombrelle${t('plan.infobulle.et')}Théo Pervenche`.replace(/\s+/g, ' ')]);
    // Une table sans conflit d'organisation : ni liste ni intertitre.
    m.ui.selectionner({ table: 2 });
    await attendre(() => expect(panneau(m, 'table')?.dataset.tablePanneau).toBe('2'));
    expect(panneau(m, 'table').querySelector('[data-conflits-table]')).toBeNull();
  });

  test("sur un retenu, un placement à la main qui réunit deux personnes en conflit : deplacerDansRetenu en une entrée, la table signalée", async () => {
    const base = executer(huitRetenue(), 'retirerDuTour', { tour: 2, participant: ONDINE });
    // Ondine Lacasse nomme l'organisation d'une personne assise, au tour 2,
    // à une table où une chaise reste libre, qu'elle rejoint.
    const cible = etatPlaces(base, { tour: 2 }).tables.find(
      ({ chaises }) => chaises.some(({ occupant }) => occupant === null) && chaises.some(({ occupant }) => occupant !== null),
    );
    const table = cible.id;
    const assise = cible.chaises.find(({ occupant }) => occupant !== null).occupant;
    const libre = cible.chaises.find(({ occupant }) => occupant === null).siege;
    base.participants.find(({ id }) => id === assise).organisation = 'Atelier Ressac';
    base.participants.find(({ id }) => id === ONDINE).organisation = null;
    base.participants.find(({ id }) => id === ONDINE).conflits = ['Atelier Ressac'];
    const m = await ouvrir(base);
    m.ui.montrerTour(2);
    flushSync();
    await images(2);
    expect(trameEvitement(m, table)).toBeNull();
    const commandes = releverCommandes(m);
    const r = fichiers(m).revision;
    await choisirDansLaReserve(m, ONDINE);
    await cliquerChaise(m, table, libre);
    await cliquer(actionPlace(m, 'assigner'));
    await uneEntree(m, r);
    expect(commandes.at(-1)).toEqual({ nom: 'deplacerDansRetenu', args: { tour: 2, participant: ONDINE, table, siege: libre } });
    await attendre(() => expect(trameEvitement(m, table)).not.toBeNull());
    m.ui.selectionner({ table });
    await attendre(() => expect(panneau(m, 'table')).not.toBeNull());
    expect(pairesDuPanneau(m)).toHaveLength(1);
    expect(pairesDuPanneau(m)[0]).toContain(nomAffiche(charge(m).participants.find(({ id }) => id === ONDINE)));
  });
});

describe('Échap oublie le choix en attente (§ 7.1, § 7.3)', () => {
  test('choisie dans la réserve, puis dans les pressentis : Échap sur son bouton l’oublie ; sur le plan, Échap d’un siège remonte à sa table et garde le choix, Échap sur la table l’oublie', async () => {
    const base = sansProposition();
    base.participants[ONDINE - 1].titrePressenti = 'hôte';
    const m = await ouvrir(base);
    const bouton = dans(m, `[data-reserve] [data-participant="${THEO}"]`);
    await choisirDansLaReserve(m, THEO);
    bouton.focus();
    await touche('Escape');
    await attendre(() => expect(m.ui.etat().choix).toBeNull());
    expect(bouton.getAttribute('aria-pressed')).toBe('false');

    const pressenti = dans(m, `[data-liste-travail="pressentis"] [data-participant="${ONDINE}"]`);
    await cliquer(pressenti);
    expect(m.ui.etat().choix?.participant).toBe(ONDINE);
    pressenti.focus();
    await touche('Escape');
    await attendre(() => expect(m.ui.etat().choix).toBeNull());

    await choisirDansLaReserve(m, THEO);
    await entrerAuClavier(m);
    expect(actif(m)).toMatch(/^table-/);
    await touche('Escape');
    await attendre(() => expect(m.ui.etat().choix).toBeNull());

    await choisirDansLaReserve(m, THEO);
    await entrerAuClavier(m);
    await touche('Enter');
    flushSync();
    const siege = actif(m);
    expect(siege).toMatch(/^siege-/);
    await touche('Escape');
    flushSync();
    expect(actif(m)).toBe(`table-${siege.split('-')[1]}`);
    // Au clavier, Échap est le seul chemin d'un siège vers une autre table :
    // remonter ne perd pas la personne choisie.
    expect(m.ui.etat().choix?.participant).toBe(THEO);
    await touche('Escape');
    await attendre(() => expect(m.ui.etat().choix).toBeNull());
  });

  test('choisie d’un vrai clic dans la réserve : Échap sur le plan sans élément actif l’oublie', async () => {
    const m = await ouvrir(sansProposition());
    // Le vrai pointeur ne rend pas le focus suivant focus-visible : la
    // racine du plan, focalisée ensuite, n'a aucun élément actif.
    await presserBouton(dans(m, `[data-reserve] [data-participant="${THEO}"]`));
    await attendre(() => expect(m.ui.etat().choix?.participant).toBe(THEO));
    racinePlan(m).focus();
    flushSync();
    expect(actif(m)).toBeNull();
    await touche('Escape');
    await attendre(() => expect(m.ui.etat().choix).toBeNull());
  });
});

// --- Les bulles posées sur le plan (§ 7.1, § 7.3, capture 20) -------------------

describe('une bulle posée près du bord reste dans le cadre du plan (§ 7.1, § 7.3)', () => {
  // Le panneau latéral du plan, que la bulle ne doit pas couvrir.
  const panneaux = (m) => dans(m, '[data-section="plan"] aside');

  test('le refus d\u{2019}une chaise au coin bas droit du cadre passe à gauche et au-dessus : dans le cadre, hors des panneaux', async () => {
    const m = await ouvrir(huitRetenue(), { mode: 'lecture' });
    const cadre = cadreDe(m);
    const chaise = geometrieDe(m, 8).chaises[1];
    await avecVue(m, { k: 1, tx: cadre.largeur - 24 - chaise.x, ty: cadre.hauteur - 24 - chaise.y });
    await cliquerChaise(m, 8, 2);
    expect(m.ui.etat().selection).toEqual({ table: 8, siege: 2 });
    await cliquer(panneau(m, 'place').querySelector('[data-commande="donnerTitre"]'));
    const place = chaiseEl(m, 8, 2);
    const refus = await attendre(() => {
      const trouve = decrit(place);
      expect(trouve?.querySelector('[data-refus="MODE_LECTURE"]')).not.toBeNull();
      return trouve;
    });
    await attendre(() => expect(dansLaFenetre(m, refus)).toBe(true));
    expect(recoupe(refus, panneaux(m))).toBe(false);
    // Le refus redit sa place, et la chaise reste à son bord : la bulle
    // s'est déplacée, pas la vue.
    expect(pointChaise(m, 8, 2).x).toBeCloseTo(cadreDe(m).gauche + cadreDe(m).largeur - 24, 0);
  });

  test('l\u{2019}infobulle d\u{2019}une table en conflit au bord droit passe à gauche de son emprise : dans le cadre, hors des panneaux', async () => {
    const m = await ouvrir(analyser(TEXTE_CONFLIT).charge);
    m.ui.montrerTour(2);
    flushSync();
    await images(2);
    const cadre = cadreDe(m);
    const geometrie = geometrieDe(m, 1);
    await avecVue(m, {
      k: 1,
      tx: cadre.largeur - 8 - geometrie.centre.x - geometrie.rayonEmprise,
      ty: cadre.hauteur / 2 - geometrie.centre.y,
    });
    const centre = pointTable(m, 1);
    await pointer('bouger', centre.x, centre.y);
    const infobulle = infobulles()[0];
    await attendre(() => expect(infobulleVisible(infobulle)).toBe(true));
    await attendre(() => expect(dansLaFenetre(m, infobulle)).toBe(true));
    expect(recoupe(infobulle, panneaux(m))).toBe(false);
    // Passée à gauche, elle ne couvre pas le centre de la table qu'elle décrit.
    const boite = infobulle.getBoundingClientRect();
    expect(boite.right).toBeLessThanOrEqual(centre.x);
    await pointer('bouger', pointSol(m).x, pointSol(m).y);
  });
});

describe('un clic ne déplace pas la vue (§ 7.3, § 8.4)', () => {
  test('une chaise à 12 px du bord gauche du cadre, cliquée : la place est sélectionnée, le transform du groupe et le cadrage restent', async () => {
    const m = await ouvrir(sansProposition());
    const cadre = cadreDe(m);
    const chaise = geometrieDe(m, 1).chaises[0];
    await avecVue(m, { k: 1, tx: 12 - chaise.x, ty: cadre.hauteur / 2 - chaise.y });
    expect(pointChaise(m, 1, 1).x - cadreDe(m).gauche).toBeCloseTo(12, 6);
    const transform = groupe(m).getAttribute('transform');
    const cadrage = m.seance.cadrage();
    await cliquerChaise(m, 1, 1);
    expect(m.ui.etat().selection).toEqual({ table: 1, siege: 1 });
    await images(4);
    expect(groupe(m).getAttribute('transform')).toBe(transform);
    expect(m.seance.cadrage()).toEqual(cadrage);
  });
});

// --- Sous le seuil (§ 7.3) ------------------------------------------------------

describe('sous le seuil, la table est la cible et son panneau choisit le siège (§ 7.3)', () => {
  test('sans exception, k = 0,39 : un clic à la position d’une chaise sélectionne la table, ouvre son panneau, qui liste ses sièges ; un siège choisi ouvre le panneau de la place', async () => {
    const m = await demonstration('grande-sans-exception');
    await avecVue(m, vueCentree(m, 0.39));
    expect(tous(m, '[data-siege]').length).toBe(0);
    // La table la plus proche du centre du cadre.
    const cadre = cadreDe(m);
    const centre = { x: cadre.gauche + cadre.largeur / 2, y: cadre.haut + cadre.hauteur / 2 };
    const distance = (id) => Math.hypot(pointTable(m, id).x - centre.x, pointTable(m, id).y - centre.y);
    const id = charge(m).tables.map((table) => table.id).reduce((a, b) => (distance(b) < distance(a) ? b : a));
    await cliquerPoint(pointChaise(m, id, 3));
    expect(m.ui.etat().selection).toEqual({ table: id });
    await attendre(() => expect(panneau(m, 'table')).not.toBeNull());
    const sieges = [...panneau(m, 'table').querySelectorAll('[data-choix-siege]')];
    expect(sieges.map((bouton) => bouton.dataset.choixSiege)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    await cliquer(sieges[2]);
    expect(m.ui.etat().selection).toEqual({ table: id, siege: 3 });
    await attendre(() => expect(panneau(m, 'place')).not.toBeNull());
    expect(tableEl(m, id).querySelector('[data-marque="selection"]')).not.toBeNull();
  });
});

// --- Le menu fait ce que fait le geste (§ 7.1, § 10.2) --------------------------

describe('le menu fait ce que fait le geste (§ 7.1, § 10.2)', () => {
  // Joue les gestes dans un montage, le menu dans un autre, sur le même
  // fichier d'état ; rend les deux charges et les libellés de leurs entrées.
  async function comparer(base, preparer, actions) {
    const rendus = [];
    for (const facon of ['geste', 'menu']) {
      const m = await ouvrir(base);
      preparer(m);
      flushSync();
      await images(2);
      const r = fichiers(m).revision;
      for (const action of actions) await action[facon](m);
      await attendre(() => expect(m.seance.etat().evenement.revision).toBe(r + actions.length));
      rendus.push({ charge: serialiserCharge(charge(m)), libelles: entreesApres(m, r).map(({ libelle }) => libelle) });
      demonter(m);
    }
    expect(rendus[1].libelles).toHaveLength(rendus[0].libelles.length);
    expect(rendus[1]).toEqual(rendus[0]);
    return rendus[0];
  }

  // Le menu de l'occupant d'une chaise, atteint au clavier, puis une action
  // pressée ; une place cliquée ; « Assigner » pressé.
  const parLeMenu = (table, siege, action, vers = null) => async (m) => {
    const occupant = etatMontre(m).tables.find(({ id }) => id === table).chaises[siege - 1].occupant;
    const r = fichiers(m).revision;
    await activerSiegeAuClavier(m, table, siege);
    const menu = dans(m, `[data-menu="${occupant}"]`);
    expect(menu, `menu de ${occupant}`).not.toBeNull();
    await presserBouton(menu.querySelector(`[data-commande="${action}"]`));
    if (vers !== null) {
      await cliquerChaise(m, ...vers);
      await presserBouton(actionPlace(m, 'assigner'));
    }
    await uneEntree(m, r);
  };
  const parLeGeste = (depuis, vers) => async (m) => {
    const r = fichiers(m).revision;
    await glisser(pointChaise(m, ...depuis), vers === 'sol' ? pointSol(m) : pointChaise(m, ...vers));
    await uneEntree(m, r);
  };

  test('sur un retenu : déplacer, échanger, retirer — la même charge, octet pour octet, et les mêmes libellés', async () => {
    const { libelles } = await comparer(huitRetenue(), () => {}, [
      { geste: parLeGeste([2, 1], [8, 2]), menu: parLeMenu(2, 1, 'deplacer', [8, 2]) },
      { geste: parLeGeste([1, 1], [3, 1]), menu: parLeMenu(1, 1, 'echanger', [3, 1]) },
      { geste: parLeGeste([5, 1], 'sol'), menu: parLeMenu(5, 1, 'retirerDuTour') },
    ]);
    expect(libelles[0]).toMatch(/^Déplacé .* à la table 8, tour 1$/);
    expect(libelles[1]).toMatch(/^Échangé /);
    expect(libelles[2]).toMatch(/^Retiré /);
  });

  test('avant la retenue, la proposition 1 montrée au tour 2 : « Réserver ici » du menu → reserver, portée « tour », au tour affiché, une entrée ; la charge que donne « Réserver » du panneau sur la même place', async () => {
    // Un glissement sur la chaise d'origine ne rend aucune commande
    // (commandeDeDepot) : la même place se réserve par le panneau.
    const rendus = [];
    for (const facon of ['menu', 'panneau']) {
      const m = await ouvrir(huitAvantRetenue());
      m.ui.montrerTour(2);
      m.ui.montrerProposition(1);
      flushSync();
      await images(2);
      const occupant = etatMontre(m).tables.find(({ id }) => id === 2).chaises[0].occupant;
      expect(occupant).not.toBeNull();
      const commandes = releverCommandes(m);
      const r = fichiers(m).revision;
      await cliquerChaise(m, 2, 1);
      if (facon === 'menu') {
        await cliquer(dans(m, `[data-menu="${occupant}"] [data-commande="reserverIci"]`));
      } else {
        await cliquer(dans(m, `[data-menu="${occupant}"] [data-commande="deplacer"]`));
        await cliquer(actionPlace(m, 'reserver'));
      }
      await uneEntree(m, r);
      expect(commandes, facon).toEqual([{ nom: 'reserver', args: { participant: occupant, table: 2, siege: 1, portee: 'tour', tour: 2 } }]);
      rendus.push(serialiserCharge(charge(m)));
      demonter(m);
    }
    expect(rendus[1]).toBe(rendus[0]);
  });

  test('avant la retenue, la proposition montrée : réserver — la même charge et le même libellé', async () => {
    await comparer(huitAvantRetenue(), (m) => m.ui.montrerProposition(1), [
      { geste: parLeGeste([2, 1], [8, 2]), menu: parLeMenu(2, 1, 'deplacer', [8, 2]) },
    ]);
  });
});

// --- Deux titres identiques à une même place (§ 5.8) -----------------------------

describe('les listes de travail tiennent deux titres identiques à une même place (§ 5.8)', () => {
  test('deux titres « animateur » au siège 2 de la table 1, rendus par titresNonPourvus : deux lignes, aucune erreur de rendu', () => {
    // Le panneau est monté seul, sur une séance d'épreuve qui porte la
    // charge telle quelle : une charge que l'analyse admettrait ou non, le
    // rendu ne doit pas tomber sur elle.
    const charge = sansProposition();
    charge.titres = [
      { table: 1, siege: 2, libelle: 'animateur' },
      { table: 1, siege: 2, libelle: 'animateur' },
    ];
    const seance = writable({ charge });
    const etatUi = writable({ choix: null, selection: null });
    const ui = { subscribe: etatUi.subscribe, etat: () => get(etatUi), selectionner: () => {}, choisir: () => {} };
    const conteneur = document.createElement('div');
    document.body.prepend(conteneur);
    const contexte = new Map([['t', t], ['seance', seance], ['ui', ui]]);
    let composant = null;
    try {
      composant = mount(ListesTravail, { target: conteneur, context: contexte });
      flushSync();
      const lignes = [...conteneur.querySelectorAll('[data-liste-travail="titres"] [data-titre="1:2"]')];
      expect(lignes).toHaveLength(2);
      expect(lignes.map(texteDe)).toEqual(['table 1 : titre animateur non pourvu', 'table 1 : titre animateur non pourvu']);
    } finally {
      if (composant !== null) unmount(composant);
      conteneur.remove();
    }
  });
});

// --- Le plan dit le placement qu'il montre (§ 2.1 étape 11, § 5.8) ----------------

describe('le plan dit le placement qu’il montre, et revient d’une proposition (§ 2.1 étape 11, § 5.8)', () => {
  const source = (m) => texteDe(dans(m, '[data-source]'));
  const reserve = (m) => [...dans(m, '[data-reserve]').querySelectorAll('[data-participant]')].map((e) => Number(e.dataset.participant));

  test('avant la retenue : « Voir » une proposition, puis revenir aux réservations depuis le plan ; la réserve liste de nouveau les non-réservés', async () => {
    const m = await ouvrir(huitAvantRetenue());
    expect(source(m)).toBe('Réservations');
    expect(dans(m, '[data-commande="quitterProposition"]')).toBeNull();
    const nonReserves = reserve(m);
    expect(nonReserves).toHaveLength(charge(m).participants.length);
    m.ui.montrerProposition(1);
    flushSync();
    await images(2);
    expect(source(m)).toBe('Proposition n° 1 : un geste y pose une réservation');
    expect(reserve(m)).not.toEqual(nonReserves);
    const quitter = dans(m, '[data-commande="quitterProposition"]');
    expect(texteDe(quitter)).toBe('Revenir aux réservations');
    await presserBouton(quitter);
    flushSync();
    await images(2);
    expect(m.ui.etat().proposition).toBeNull();
    expect(source(m)).toBe('Réservations');
    expect(reserve(m)).toEqual(nonReserves);
    expect(dans(m, '[data-commande="quitterProposition"]')).toBeNull();
  });

  test('après la retenue : la proposition montrée se dit en vue seule, et la commande revient au placement retenu', async () => {
    const m = await ouvrir(huitRetenue());
    expect(source(m)).toBe('Placement retenu');
    m.ui.montrerProposition(1);
    flushSync();
    await images(2);
    expect(source(m)).toBe('Proposition n° 1, vue seule');
    const quitter = dans(m, '[data-commande="quitterProposition"]');
    expect(texteDe(quitter)).toBe('Revenir au placement retenu');
    await presserBouton(quitter);
    flushSync();
    await images(2);
    expect(m.ui.etat().proposition).toBeNull();
    expect(source(m)).toBe('Placement retenu');
  });
});

// --- Un geste à un tour ne change pas les autres tours (§ 7.1, § 5.8) -----------

describe('une réservation « tous les tours » ne se retire pas par un geste (§ 7.1)', () => {
  test('sol ou « Retirer du tour » : refus sur la place, rien d’écrit ; le remède la retire ; « ce tour » se retire par le sol', async () => {
    const base = executer(
      executer(sansProposition(), 'reserver', { participant: IRIS, table: 3, siege: 1, portee: 'tous', tour: null }),
      'reserver',
      { participant: THEO, table: 4, siege: 2, portee: 'tour', tour: 1 },
    );
    const m = await ouvrir(base);
    expect(etatMontre(m).cible).toBe('reservations');
    const place = () => chaiseEl(m, 3, 1);
    const refusSur = () => decrit(place())?.querySelector('[data-refus="RESERVATION_TOUS_LES_TOURS"]') ?? null;

    let avant = fichiers(m);
    await glisser(pointChaise(m, 3, 1), pointSol(m));
    await attendre(() => expect(refusSur()).not.toBeNull());
    expect(texteDe(decrit(place()))).toContain(t('RESERVATION_TOUS_LES_TOURS', { participant: IRIS, table: 3 }).replace(/\s+/g, ' ').trim());
    expect(texteDe(decrit(place()))).toContain(`Table ${charge(m).tables.find(({ id }) => id === 3).numero}, siège 1`);
    await rienEcrit(m, avant);
    expect(charge(m).reservations).toEqual(base.reservations);

    // Le message laisse passer le pointeur, ses boutons le prennent : « Fermer »,
    // pressé par le vrai pointeur, reçoit l'appui et retire la pose.
    const fermer = decrit(place()).querySelector('[data-commande="fermerPose"]');
    expect(fermer).not.toBeNull();
    expect(texteDe(fermer)).toBe(t('plan.refus.fermer'));
    expect(await presseRecue(fermer)).toBe(true);
    await attendre(() => expect(refusSur()).toBeNull());
    expect(m.ui.etat().pose).toBeNull();
    await rienEcrit(m, avant);

    await activerSiegeAuClavier(m, 3, 1);
    await presserBouton(dans(m, `[data-menu="${IRIS}"] [data-commande="retirerDuTour"]`));
    await attendre(() => expect(refusSur()).not.toBeNull());
    await rienEcrit(m, avant);

    // Le remède, pressé par le vrai pointeur : il reçoit l'appui, et sa
    // commande écrit une entrée.
    const remede = refusSur().querySelector('[data-commande="retirerReservation"]');
    expect(remede).not.toBeNull();
    const r = fichiers(m).revision;
    expect(await presseRecue(remede)).toBe(true);
    await uneEntree(m, r);
    expect(charge(m).reservations).toEqual([{ participant: THEO, table: 4, siege: 2, portee: 'tour', tour: 1 }]);

    avant = fichiers(m);
    await glisser(pointChaise(m, 4, 2), pointSol(m));
    await uneEntree(m, avant.revision);
    expect(charge(m).reservations).toEqual([]);
  });

  test('une personne réservée glissée vers une chaise libre : le fantôme dit qu’elle déplace sa réservation, et sa portée ; « tous les tours » se déplace à chaque tour', async () => {
    const base = executer(
      executer(sansProposition(), 'reserver', { participant: IRIS, table: 3, siege: 1, portee: 'tous', tour: null }),
      'reserver',
      { participant: THEO, table: 4, siege: 2, portee: 'tour', tour: 1 },
    );
    const m = await ouvrir(base);
    expect(etatMontre(m).cible).toBe('reservations');
    const etatDuFantome = () => texteDe(dans(m, '[data-fantome] [data-partie="etat"]'));

    let r = fichiers(m).revision;
    let vers = pointChaise(m, 4, 3);
    await presserEtBouger(pointChaise(m, 3, 1), vers);
    expect(etatDuFantome()).toBe('déplace sa réservation, à tous les tours');
    await pointer('relacher', vers.x, vers.y);
    await uneEntree(m, r);
    expect(charge(m).reservations).toContainEqual({ participant: IRIS, table: 4, siege: 3, portee: 'tous', tour: null });

    r = fichiers(m).revision;
    vers = pointChaise(m, 4, 4);
    await presserEtBouger(pointChaise(m, 4, 2), vers);
    expect(etatDuFantome()).toBe('déplace sa réservation de ce tour');
    await pointer('relacher', vers.x, vers.y);
    await uneEntree(m, r);
    expect(charge(m).reservations).toContainEqual({ participant: THEO, table: 4, siege: 4, portee: 'tour', tour: 1 });
  });
});

// Mène le pointeur, déjà pressé, de depuis à vers en six pas, une image
// entre deux.
async function mener(depuis, vers, pas = 6) {
  for (let i = 1; i <= pas; i += 1) {
    await pointer('bouger', depuis.x + (vers.x - depuis.x) * (i / pas), depuis.y + (vers.y - depuis.y) * (i / pas));
    await images(1);
  }
  flushSync();
}

describe('le fantôme d’une personne réservée au-dessus du sol (§ 5.8)', () => {
  test('« ce tour » se dit retirée, « tous les tours » refusée ; revenue sur une chaise libre, le fantôme redit le déplacement ; rien d’écrit', async () => {
    const base = executer(
      executer(sansProposition(), 'reserver', { participant: IRIS, table: 3, siege: 1, portee: 'tous', tour: null }),
      'reserver',
      { participant: THEO, table: 4, siege: 2, portee: 'tour', tour: 1 },
    );
    const m = await ouvrir(base);
    expect(etatMontre(m).cible).toBe('reservations');
    const etatDuFantome = () => texteDe(dans(m, '[data-fantome] [data-partie="etat"]'));
    const avant = fichiers(m);
    const cas = [
      { depuis: [3, 1], surLeSol: 'plan.fantome.refuseTous', surUneChaise: 'plan.fantome.reservationTous' },
      { depuis: [4, 2], surLeSol: 'plan.fantome.retireReservationTour', surUneChaise: 'plan.fantome.reservationTour' },
    ];
    for (const { depuis, surLeSol, surUneChaise } of cas) {
      const origine = pointChaise(m, ...depuis);
      const libre = pointChaise(m, 4, 3);
      const sol = pointSol(m);
      await presserEtBouger(origine, libre);
      expect(etatDuFantome(), surUneChaise).toBe(t(surUneChaise));
      await mener(libre, sol);
      expect(etatDuFantome(), surLeSol).toBe(t(surLeSol));
      await mener(sol, libre);
      expect(etatDuFantome(), surUneChaise).toBe(t(surUneChaise));
      // Rendue à sa chaise, la personne n'a pas bougé.
      await mener(libre, origine);
      await pointer('relacher', origine.x, origine.y);
      await images(2);
      await attendre(() => expect(dans(m, '[data-fantome] [data-partie="etat"]')).toBeNull());
    }
    await rienEcrit(m, avant);
    expect(charge(m).reservations).toEqual(base.reservations);
  });

  test('sous le retenu, une personne que sa réservation tient se dit refusée au-dessus du sol, à chaque portée ; relâchée, le refus se pose sur sa chaise, et rien d’écrit', async () => {
    // Deux rondes de quatre, six personnes assises de même aux trois tours ;
    // Iris réservée à la table 1 pour tous les tours, Théo au tour 1 seul.
    const listes = [[1, 2, 3], [4, 5, 6]];
    const base = executer(
      executer(chargeDe({ id: 'evt-retenu-tenu', places: [4, 4], personnes: 6, tours: [listes, listes, listes] }), 'reserver', {
        participant: IRIS,
        table: 1,
        siege: null,
        portee: 'tous',
        tour: null,
      }),
      'reserver',
      { participant: THEO, table: 1, siege: null, portee: 'tour', tour: 1 },
    );
    const m = await ouvrir(base);
    expect(etatMontre(m).cible).toBe('retenu');
    const etatDuFantome = () => texteDe(dans(m, '[data-fantome] [data-partie="etat"]'));
    const avant = fichiers(m);
    const cas = [
      { personne: IRIS, cle: 'plan.fantome.refuseTous', code: 'RESERVATION_TOUS_LES_TOURS' },
      { personne: THEO, cle: 'plan.fantome.refuseTour', code: 'RESERVATION_CE_TOUR' },
    ];
    for (const { personne, cle, code } of cas) {
      const { siege } = etatMontre(m).tables[0].chaises.find(({ occupant }) => occupant === personne);
      const sol = pointSol(m);
      await presserEtBouger(pointChaise(m, 1, siege), sol);
      expect(etatDuFantome(), cle).toBe(t(cle));
      await pointer('relacher', sol.x, sol.y);
      const place = () => chaiseEl(m, 1, siege);
      const refusSur = () => decrit(place())?.querySelector(`[data-refus="${code}"]`) ?? null;
      await attendre(() => expect(refusSur(), code).not.toBeNull());
      expect(texteDe(decrit(place()))).toContain(t(code, { participant: personne, table: 1, tour: 1 }).replace(/\s+/g, ' ').trim());
      expect(refusSur().querySelector('[data-commande="retirerReservation"]'), code).not.toBeNull();
      await rienEcrit(m, avant);
      await presserBouton(decrit(place()).querySelector('[data-commande="fermerPose"]'));
      await attendre(() => expect(m.ui.etat().pose).toBeNull());
    }
    await rienEcrit(m, avant);
    expect(charge(m).reservations).toEqual(base.reservations);
  });
});

// --- Réserver, titrer, désigner (§ 4, § 2.1 étape 6, § 5.8) ---------------------

describe('réserver, titrer, désigner depuis le panneau (§ 4, § 2.1 étape 6)', () => {
  test('réserver Théo Pervenche au tour 2 → {participant, table, siege, portee: tour, tour: 2} ; puis Iris pour tous les tours', async () => {
    const m = await ouvrir(sansProposition());
    m.ui.montrerTour(2);
    flushSync();
    let r = fichiers(m).revision;
    await choisirDansLaReserve(m, THEO);
    await cliquerChaise(m, 4, 3);
    await cliquer(actionPlace(m, 'reserver'));
    await uneEntree(m, r);
    expect(charge(m).reservations).toEqual([{ participant: THEO, table: 4, siege: 3, portee: 'tour', tour: 2 }]);

    r += 1;
    await choisirDansLaReserve(m, IRIS);
    await cliquerChaise(m, 4, 5);
    const portee = panneau(m, 'place').querySelector('[data-champ="portee"]');
    portee.value = 'tous';
    portee.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    await cliquer(actionPlace(m, 'reserver'));
    await uneEntree(m, r);
    expect(charge(m).reservations).toContainEqual({ participant: IRIS, table: 4, siege: 5, portee: 'tous', tour: null });
  });

  test('titrer : « animateur » à la table 5 → un titre {table, siege, libelle}, ni personne ni tour ; un libellé vide refusé sur le champ, rien d’écrit', async () => {
    const m = await ouvrir(sansProposition({ attribuer: true }));
    await cliquerChaise(m, 5, 2);
    const champ = panneau(m, 'place').querySelector('[data-champ="libelle"] input, input[data-champ="libelle"]');
    expect(champ).not.toBeNull();
    const avant = fichiers(m);
    champ.value = '   ';
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    await cliquer(actionPlace(m, 'donnerTitre'));
    await attendre(() => expect(panneau(m, 'place').querySelector('[data-refus="LIBELLE_VIDE"]')).not.toBeNull());
    expect(decrit(chaiseEl(m, 5, 2))).toBeNull();
    await rienEcrit(m, avant);
    champ.value = 'animateur';
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    await cliquer(actionPlace(m, 'donnerTitre'));
    await uneEntree(m, avant.revision);
    expect(charge(m).titres).toEqual([{ table: 5, siege: 2, libelle: 'animateur' }]);
    expect(charge(m).reservations).toEqual([]);
  });

  test('désigner Iris à la table 3 → une réservation « tous » à la place du titre, un titre, une entrée', async () => {
    const base = executer(sansProposition({ attribuer: true }), 'poserTitre', { table: 3, siege: 1, libelle: 'animateur' });
    const m = await ouvrir(base);
    const r = fichiers(m).revision;
    await choisirDansLaReserve(m, IRIS);
    await cliquerChaise(m, 3, 1);
    await cliquer(actionPlace(m, 'designer'));
    await uneEntree(m, r);
    expect(charge(m).reservations).toEqual([{ participant: IRIS, table: 3, siege: 1, portee: 'tous', tour: null }]);
    expect(charge(m).titres).toEqual([{ table: 3, siege: 1, libelle: 'animateur' }]);
  });

  test('après la génération : sur un retenu qui assied Iris à la table 2, la désigner à la table 3 → une réservation et un titre de plus, retenu et propositions identiques, une entrée, RESERVATION_NON_HONOREE visible', async () => {
    const base = chargeDe({
      id: 'evt-apres-generation',
      places: [4, 4, 4],
      personnes: 9,
      tours: [
        [[2, 3, 4], [1, 5, 6], [7, 8, 9]],
        [[5, 7, 9], [1, 2, 8], [3, 4, 6]],
        [[6, 8, 3], [1, 4, 7], [2, 5, 9]],
      ],
    });
    const m = await ouvrir(base);
    const origine = structuredClone(charge(m));
    const r = fichiers(m).revision;
    const siegeIris = etatMontre(m).tables[1].chaises.findIndex(({ occupant }) => occupant === IRIS) + 1;
    await cliquerChaise(m, 2, siegeIris);
    await cliquer(dans(m, `[data-menu="${IRIS}"] [data-commande="deplacer"]`));
    expect(m.ui.etat().choix).toEqual({ genre: 'personne', participant: IRIS, depuis: { table: 2, siege: siegeIris } });
    await cliquerChaise(m, 3, 4);
    await cliquer(actionPlace(m, 'designer'));
    await uneEntree(m, r);
    const apres = charge(m);
    expect(apres.reservations).toHaveLength(origine.reservations.length + 1);
    expect(apres.reservations.at(-1)).toMatchObject({ participant: IRIS, table: 3, portee: 'tous', tour: null });
    expect(apres.titres).toHaveLength(origine.titres.length + 1);
    expect(apres.retenu).toEqual(origine.retenu);
    expect(apres.propositions).toEqual(origine.propositions);
    expect(m.seance.etat().avertissements).toContainEqual({
      code: 'RESERVATION_NON_HONOREE',
      details: { participant: IRIS, table: 3, tour: 1, personne: 'Iris Ombrelle', numero: 3 },
    });
    await attendre(() => expect(dans(m, '[data-avertissement="RESERVATION_NON_HONOREE"]')).not.toBeNull());
  });

  // L'avertissement nomme Iris et la table 3 : ses détails portent le nom
  // affiché de la personne et le numéro de la table (avertissementsApres).
  test('RESERVATION_NON_HONOREE nomme Iris Ombrelle et la table 3', async () => {
    const base = chargeDe({
      id: 'evt-apres-generation',
      places: [4, 4, 4],
      personnes: 9,
      tours: [
        [[2, 3, 4], [1, 5, 6], [7, 8, 9]],
        [[5, 7, 9], [1, 2, 8], [3, 4, 6]],
        [[6, 8, 3], [1, 4, 7], [2, 5, 9]],
      ],
    });
    const m = await ouvrir(base);
    const r = fichiers(m).revision;
    m.ui.choisir({ genre: 'personne', participant: IRIS, depuis: null });
    await cliquerChaise(m, 3, 4);
    await cliquer(actionPlace(m, 'designer'));
    await uneEntree(m, r);
    await attendre(() => expect(dans(m, '[data-avertissement="RESERVATION_NON_HONOREE"]')).not.toBeNull());
    const texte = texteDe(dans(m, '[data-avertissement="RESERVATION_NON_HONOREE"]'));
    expect(texte).toContain('Iris Ombrelle');
    expect(texte).toContain('table 3');
  });
});

// --- Le libellé tapé suspend le compte d'inactivité (§ 8.4) -------------------

describe('un libellé tapé et non appliqué est une saisie en cours (§ 8.4)', () => {
  // Tape texte dans le champ du libellé du panneau du genre donné.
  function taperLibelle(m, genre, texte) {
    const champ = panneau(m, genre).querySelector('input[data-champ="libelle"]');
    champ.value = texte;
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    return champ;
  }

  // L'horloge passe le délai d'inactivité ; la file de la séance vidée.
  async function laisserPasser(m) {
    m.horloge.avancer(INACTIVITE_MS + 1);
    await m.seance.attendre();
    flushSync();
  }

  test('panneau de la place : le libellé tapé tient la séance en écriture ; « Donner un titre » l’applique et rend le compte, qui ramène en lecture', async () => {
    const m = await ouvrir(sansProposition({ attribuer: true }));
    await cliquerChaise(m, 5, 2);
    expect(m.seance.gesteEnCours).toBe(false);
    taperLibelle(m, 'place', 'hôte');
    expect(m.seance.gesteEnCours).toBe(true);
    await laisserPasser(m);
    expect(m.seance.etat().mode).toBe('ecriture');
    const r = fichiers(m).revision;
    await cliquer(actionPlace(m, 'donnerTitre'));
    await uneEntree(m, r);
    await attendre(() => expect(m.seance.gesteEnCours).toBe(false));
    expect(panneau(m, 'place').querySelector('input[data-champ="libelle"]').value).toBe('hôte');
    await laisserPasser(m);
    expect(m.seance.etat().mode).toBe('lecture');
  });

  test('panneau de la place : un libellé refusé reste une saisie en cours ; une autre place sélectionnée la rend', async () => {
    const m = await ouvrir(sansProposition({ attribuer: true }));
    await cliquerChaise(m, 5, 2);
    taperLibelle(m, 'place', '   ');
    await cliquer(actionPlace(m, 'donnerTitre'));
    await attendre(() => expect(panneau(m, 'place').querySelector('[data-refus="LIBELLE_VIDE"]')).not.toBeNull());
    expect(m.seance.gesteEnCours).toBe(true);
    await cliquerChaise(m, 4, 1);
    await attendre(() => expect(m.ui.etat().selection).toEqual({ table: 4, siege: 1 }));
    expect(m.seance.gesteEnCours).toBe(false);
    await laisserPasser(m);
    expect(m.seance.etat().mode).toBe('lecture');
  });

  test('panneau de la table : le libellé tapé tient la séance en écriture ; Échap referme le panneau et rend le compte', async () => {
    const m = await ouvrir(sansProposition());
    await cliquerPoint(pointTable(m, 2));
    await attendre(() => expect(panneau(m, 'table')).not.toBeNull());
    const champ = taperLibelle(m, 'table', 'secrétaire');
    expect(m.seance.gesteEnCours).toBe(true);
    await laisserPasser(m);
    expect(m.seance.etat().mode).toBe('ecriture');
    champ.focus();
    await touche('Escape');
    await attendre(() => expect(panneau(m, 'table')).toBeNull());
    expect(m.seance.gesteEnCours).toBe(false);
    await laisserPasser(m);
    expect(m.seance.etat().mode).toBe('lecture');
  });

  test('panneau de la table : « Donner un titre » applique le libellé tapé et rend le compte ; une nouvelle frappe le reprend', async () => {
    const m = await ouvrir(sansProposition());
    await cliquerPoint(pointTable(m, 2));
    await attendre(() => expect(panneau(m, 'table')).not.toBeNull());
    taperLibelle(m, 'table', 'secrétaire');
    const r = fichiers(m).revision;
    await cliquer(panneau(m, 'table').querySelector('[data-commande="donnerTitre"]'));
    await uneEntree(m, r);
    expect(charge(m).titres.map(({ table, libelle }) => [table, libelle])).toEqual([[2, 'secrétaire']]);
    await attendre(() => expect(m.seance.gesteEnCours).toBe(false));
    taperLibelle(m, 'table', 'hôte');
    expect(m.seance.gesteEnCours).toBe(true);
  });
});

// --- Le titre reste, le mode table, la capacité (§ 4.1, § 2.1 étape 6, § 5.9) ---

describe('le titre appartient à la place (§ 4.1, § 2.1 étape 6, § 5.9)', () => {
  test('quatre variantes depuis une désignation à la table 3 — réservation retirée, déplacée, personne supprimée, exclue : « table 3 : titre animateur non pourvu » dans la liste de travail et sur la place', async () => {
    const designee = executer(sansProposition({ attribuer: true }), 'designer', { participant: IRIS, table: 3, siege: 1, libelle: 'animateur' });
    const variantes = [
      ['retiree', (c) => executer(c, 'retirerReservation', { participant: IRIS, table: 3, portee: 'tous', tour: null })],
      ['deplacee', (c) => executer(c, 'deplacerReservation', { participant: IRIS, de: { table: 3, portee: 'tous', tour: null }, vers: { table: 4, siege: 1 } })],
      ['supprimee', (c) => executer(c, 'supprimerParticipant', { id: IRIS })],
      ['exclue', (c) => executer(c, 'exclureParticipant', { id: IRIS })],
    ];
    expect(variantes.length).toBe(4);
    for (const [nom, appliquer] of variantes) {
      const m = await ouvrir(appliquer(structuredClone(designee)));
      const liste = dans(m, '[data-liste-travail="titres"]');
      const elements = [...liste.querySelectorAll('[data-titre]')];
      expect(elements.map(texteDe), nom).toEqual(['table 3 : titre animateur non pourvu']);
      // Sur la place : son nom accessible, la ligne entière, et la hachure.
      expect(chaiseEl(m, 3, 1).getAttribute('aria-label'), nom).toMatch(/^1\. .*titre animateur non pourvu$/);
      expect(chaiseEl(m, 3, 1).querySelector('[data-marque="hachure"]'), nom).not.toBeNull();
      demonter(m);
    }
  });

  test('mode table : sans attribution, trois titres à la table 2 et une désignation → « 3 titres dont 1 pourvu », deux éléments pour la table 2, aucun choix de siège ; sièges attribués, le numéro se choisit', async () => {
    let base = sansProposition();
    for (const libelle of ['animateur', 'hôte', 'secrétaire']) base = executer(base, 'poserTitre', { table: 2, siege: null, libelle });
    const m = await ouvrir(base);
    const r = fichiers(m).revision;
    await cliquerPoint(pointTable(m, 2));
    expect(m.ui.etat().selection).toEqual({ table: 2 });
    await attendre(() => expect(panneau(m, 'table')).not.toBeNull());
    expect(panneau(m, 'table').querySelector('[data-champ="siege"]')).toBeNull();
    await choisirDansLaReserve(m, IRIS);
    await cliquer(panneau(m, 'table').querySelector('[data-commande="designer"]'));
    await uneEntree(m, r);
    expect(charge(m).reservations).toEqual([{ participant: IRIS, table: 2, siege: 1, portee: 'tous', tour: null }]);
    await attendre(() => expect(texteDe(panneau(m, 'table'))).toContain('3 titres dont 1 pourvu'));
    const pourLaTable = [...dans(m, '[data-liste-travail="titres"]').querySelectorAll('[data-titre]')].filter((e) => e.dataset.titre.startsWith('2:'));
    expect(pourLaTable).toHaveLength(2);
    demonter(m);

    const attribuee = await ouvrir(executer(sansProposition({ attribuer: true }), 'poserTitre', { table: 2, siege: 4, libelle: 'animateur' }));
    await cliquerPoint(pointTable(attribuee, 2));
    await attendre(() => expect(panneau(attribuee, 'table')).not.toBeNull());
    expect(panneau(attribuee, 'table').querySelector('[data-champ="siege"]')).not.toBeNull();

    // Le numéro choisi est celui que reçoivent le titre, puis la désignation.
    const poserChamps = (siege, libelle) => {
      const choixSiege = panneau(attribuee, 'table').querySelector('[data-champ="siege"]');
      choixSiege.value = String(siege);
      choixSiege.dispatchEvent(new Event('change', { bubbles: true }));
      const champ = panneau(attribuee, 'table').querySelector('[data-champ="libelle"]');
      champ.value = libelle;
      champ.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
    };
    let ra = fichiers(attribuee).revision;
    poserChamps(3, 'secrétaire');
    await cliquer(panneau(attribuee, 'table').querySelector('[data-commande="donnerTitre"]'));
    await uneEntree(attribuee, ra);
    expect(charge(attribuee).titres).toContainEqual({ table: 2, siege: 3, libelle: 'secrétaire' });

    ra += 1;
    await choisirDansLaReserve(attribuee, IRIS);
    poserChamps(5, 'hôte');
    await cliquer(panneau(attribuee, 'table').querySelector('[data-commande="designer"]'));
    await uneEntree(attribuee, ra);
    expect(charge(attribuee).titres).toContainEqual({ table: 2, siege: 5, libelle: 'hôte' });
    expect(charge(attribuee).reservations).toEqual([{ participant: IRIS, table: 2, siege: 5, portee: 'tous', tour: null }]);
  });

  test('capacité et animateurs : table de 4, la quatrième désignation acceptée et le gel signalé par une forme ; la cinquième refusée sur la place ; des places qui manquent déjà n’ajoutent ni refus ni avertissement ; une table sans animateur n’avertit de rien', async () => {
    // Huit places pour dix personnes : il en manque deux à chaque tour.
    const base = chargeDe({ id: 'evt-capacite', places: [4, 2, 2], personnes: 10 });
    const m = await ouvrir(base);
    const rendus = [];
    const originale = m.seance.executer;
    m.seance.executer = async (nom, args) => {
      const rendu = await originale(nom, args);
      rendus.push(rendu);
      return rendu;
    };
    nettoyages.push(() => {
      m.seance.executer = originale;
    });
    const manques = () =>
      [...rendus.flatMap(({ avertissements }) => avertissements), ...m.seance.etat().avertissements].filter(
        ({ code }) => code === 'PLACES_MANQUANTES',
      ).length;
    await cliquerPoint(pointTable(m, 1));
    await attendre(() => expect(panneau(m, 'table')).not.toBeNull());
    for (const personne of [1, 2, 3, 4]) {
      const r = fichiers(m).revision;
      await choisirDansLaReserve(m, personne);
      await cliquer(panneau(m, 'table').querySelector('[data-commande="designer"]'));
      await uneEntree(m, r);
      expect(decrit(tableEl(m, 1))).toBeNull();
      expect(manques()).toBe(0);
    }
    expect(rendus).toHaveLength(4);
    expect(charge(m).reservations).toHaveLength(4);
    const gel = tableEl(m, 1).querySelector('[data-marque="gel"]');
    expect(peinte(gel)).toBe(true);
    expect(gel.tagName).toBe('path');
    const avant = fichiers(m);
    await choisirDansLaReserve(m, 5);
    await cliquer(panneau(m, 'table').querySelector('[data-commande="designer"]'));
    await refusSurLaPlace(m, tableEl(m, 1), 1, ['AUCUN_SIEGE_SANS_TITRE'], avant);
    const autres = m.seance.etat().avertissements.filter(({ details }) => details?.table === 2 || details?.table === 3);
    expect(autres).toEqual([]);
  });
});

// --- Le refus sur la place (§ 5.9, § 2.1, § 19.3 09) ----------------------------

describe('le refus se pose sur la place (§ 5.9)', () => {
  // Avant la retenue, la proposition 1 montrée ; la table 8 réservée pour
  // tous les tours à ses trois sièges ; Théo Pervenche réservé « tous » à la
  // table 6 sans siège, que la proposition assied ailleurs.
  function preparee() {
    let c = huitAvantRetenue();
    for (const [participant, siege] of [[18, 1], [19, 2], [20, 3]]) {
      c = executer(c, 'reserver', { participant, table: 8, siege, portee: 'tous', tour: null });
    }
    return executer(c, 'reserver', { participant: THEO, table: 6, siege: null, portee: 'tous', tour: null });
  }
  async function monter() {
    const m = await ouvrir(preparee());
    m.ui.montrerProposition(1);
    flushSync();
    await images(2);
    return m;
  }

  test('réserver tous les sièges d’une table pour tous les tours est accepté, et le gel se voit ; k_t > c_t, par glissement puis par le menu : SURRESERVATION puis PLACE_RESERVEE sur la chaise, chacun avec sa commande', async () => {
    const m = await monter();
    expect(peinte(tableEl(m, 8).querySelector('[data-marque="gel"]'))).toBe(true);
    let avant = fichiers(m);
    await glisser(pointChaise(m, 1, 1), pointChaise(m, 8, 1));
    await refusSurLaPlace(m, chaiseEl(m, 8, 1), 8, ['SURRESERVATION', 'PLACE_RESERVEE'], avant);

    avant = fichiers(m);
    await activerSiegeAuClavier(m, 1, 1);
    await presserBouton(panneau(m, 'place').querySelector('[data-menu] [data-commande="deplacer"]'));
    await cliquerChaise(m, 8, 1);
    await cliquer(actionPlace(m, 'assigner'));
    await refusSurLaPlace(m, chaiseEl(m, 8, 1), 8, ['SURRESERVATION', 'PLACE_RESERVEE'], avant);
  });

  test('deux places sur un même tour, par glissement puis par le menu : DEUX_PLACES_MEME_TOUR sur la chaise, sa commande déplace la réservation', async () => {
    const m = await monter();
    const chaiseTheo = etatMontre(m).tables.flatMap((t) => t.chaises.map((c) => ({ table: t.id, ...c }))).find((c) => c.occupant === THEO);
    expect(chaiseTheo.table).not.toBe(6);
    let avant = fichiers(m);
    await glisser(pointChaise(m, chaiseTheo.table, chaiseTheo.siege), pointChaise(m, 7, 3));
    const message = await refusSurLaPlace(m, chaiseEl(m, 7, 3), 7, ['DEUX_PLACES_MEME_TOUR'], avant);
    expect(message.querySelector('[data-commande="deplacerReservation"]')).not.toBeNull();

    avant = fichiers(m);
    await cliquerChaise(m, chaiseTheo.table, chaiseTheo.siege);
    await cliquer(dans(m, `[data-menu="${THEO}"] [data-commande="deplacer"]`));
    await cliquerChaise(m, 7, 3);
    await cliquer(actionPlace(m, 'assigner'));
    await refusSurLaPlace(m, chaiseEl(m, 7, 3), 7, ['DEUX_PLACES_MEME_TOUR'], avant);
  });

  test('une place réservée à un autre, par glissement puis par le menu : PLACE_RESERVEE ; une personne exclue, par le menu : PERSONNE_EXCLUE ; exclue et place réservée à un autre : les deux, dans l’ordre du contrat', async () => {
    let base = huitAvantRetenue();
    base = executer(base, 'reserver', { participant: 19, table: 7, siege: 1, portee: 'tous', tour: null });
    const m = await ouvrir(base);
    m.ui.montrerProposition(1);
    flushSync();
    await images(2);
    let avant = fichiers(m);
    await glisser(pointChaise(m, 1, 1), pointChaise(m, 7, 1));
    await refusSurLaPlace(m, chaiseEl(m, 7, 1), 7, ['PLACE_RESERVEE'], avant);
    avant = fichiers(m);
    await cliquerChaise(m, 1, 1);
    const occupant = etatMontre(m).tables[0].chaises[0].occupant;
    await cliquer(dans(m, `[data-menu="${occupant}"] [data-commande="deplacer"]`));
    await cliquerChaise(m, 7, 1);
    await cliquer(actionPlace(m, 'assigner'));
    await refusSurLaPlace(m, chaiseEl(m, 7, 1), 7, ['PLACE_RESERVEE'], avant);

    // Exclure l'occupante de la chaise 2 de la table 1 par son menu : son menu
    // reste, et « Déplacer » la choisit.
    await cliquerChaise(m, 1, 2);
    const exclue = etatMontre(m).tables[0].chaises[1].occupant;
    const r = fichiers(m).revision;
    await cliquer(dans(m, `[data-menu="${exclue}"] [data-commande="exclure"]`));
    await uneEntree(m, r);
    avant = fichiers(m);
    await cliquer(dans(m, `[data-menu="${exclue}"] [data-commande="deplacer"]`));
    expect(m.ui.etat().choix?.participant).toBe(exclue);
    await cliquerChaise(m, 8, 3);
    await cliquer(actionPlace(m, 'assigner'));
    await refusSurLaPlace(m, chaiseEl(m, 8, 3), 8, ['PERSONNE_EXCLUE'], avant);

    m.ui.choisir({ genre: 'personne', participant: exclue, depuis: null });
    await cliquerChaise(m, 7, 1);
    await cliquer(actionPlace(m, 'assigner'));
    await refusSurLaPlace(m, chaiseEl(m, 7, 1), 7, ['PERSONNE_EXCLUE', 'PLACE_RESERVEE'], avant);
  });
});

// --- Déplacer la réservation (§ 5.9, § 2.1 étape 7) ------------------------------

describe('la pose ne survit ni au tour ni à la section (§ 5.9)', () => {
  test('PLACE_RESERVEE posée par un glissement : quitter la section puis revenir au plan ne la remontre pas ; un changement de tour la retire', async () => {
    const base = executer(huitAvantRetenue(), 'reserver', { participant: 19, table: 7, siege: 1, portee: 'tous', tour: null });
    const m = await ouvrir(base);
    m.ui.montrerProposition(1);
    flushSync();
    await images(2);
    await glisser(pointChaise(m, 1, 1), pointChaise(m, 7, 1));
    await attendre(() => expect(dans(m, '[data-refus="PLACE_RESERVEE"]')).not.toBeNull());
    m.ui.allerA('tables');
    flushSync();
    m.ui.allerA('plan');
    flushSync();
    await attendre(() => expect(tous(m, '[data-table]').length).toBe(8));
    await images(2);
    expect(dans(m, '[data-refus]')).toBeNull();
    expect(m.ui.etat().pose).toBeNull();

    await glisser(pointChaise(m, 1, 1), pointChaise(m, 7, 1));
    await attendre(() => expect(dans(m, '[data-refus="PLACE_RESERVEE"]')).not.toBeNull());
    m.ui.montrerTour(2);
    flushSync();
    await images(2);
    expect(dans(m, '[data-refus]')).toBeNull();
    expect(m.ui.etat().pose).toBeNull();
    expect(chaiseEl(m, 7, 1).getAttribute('aria-describedby')).toBeNull();
  });
});

describe('déplacer la réservation, remède d’une place réservée (§ 5.9, § 2.1 étape 7)', () => {
  // Basile Tourmaline (5), que les deux sources assoient à la table 2 au
  // tour 1, désigné à son siège 2 : sa réservation et le titre « animateur ».
  // Sur le retenu, le dépôt d'Iris sur sa place est un échange, qui le
  // ferait aussi quitter sa réservation : RESERVEE_AILLEURS suit.
  const avecDesignation = (charge) => executer(charge, 'designer', { participant: 5, table: 2, siege: 2, libelle: 'animateur' });

  for (const [nom, base, preparer, codes] of [
    ['avant la retenue', () => avecDesignation(huitAvantRetenue()), (m) => m.ui.montrerProposition(1), ['PLACE_RESERVEE']],
    ['sur un retenu', () => avecDesignation(huitRetenue()), () => {}, ['PLACE_RESERVEE', 'RESERVEE_AILLEURS']],
  ]) {
    test(`${nom} : le dépôt sur la place est refusé, le remède choisit la réservation ; une place libre, puis « Déplacer la réservation ici » → une entrée, la réservation à la nouvelle place, le titre resté`, async () => {
      const m = await ouvrir(base());
      preparer(m);
      flushSync();
      await images(2);
      const origine = structuredClone(charge(m));
      const avant = fichiers(m);
      expect(etatMontre(m).tables[1].chaises[1]).toMatchObject({ occupant: 5, reservation: { participant: 5, portee: 'tous' } });
      await glisser(pointChaise(m, 1, 1), pointChaise(m, 2, 2));
      const message = await refusSurLaPlace(m, chaiseEl(m, 2, 2), 2, codes, avant);
      await cliquer(message.querySelector('[data-refus="PLACE_RESERVEE"] [data-commande="choisirPlace"]'));
      expect(m.ui.etat().choix).toEqual({
        genre: 'reservation',
        participant: 5,
        depuis: { table: 2, siege: 2 },
        de: { table: 2, portee: 'tous', tour: null },
      });
      await cliquerChaise(m, 8, 3);
      await cliquer(actionPlace(m, 'deplacerReservationIci'));
      await uneEntree(m, avant.revision);
      expect(charge(m).reservations).toEqual([{ participant: 5, table: 8, siege: 3, portee: 'tous', tour: null }]);
      expect(charge(m).titres).toEqual([{ table: 2, siege: 2, libelle: 'animateur' }]);
      expect(charge(m).retenu).toEqual(origine.retenu);
      expect(m.ui.etat().choix).toBeNull();
    });
  }
});

// --- Les listes de travail (§ 5.8, § 2.1 étape 6) --------------------------------

describe('les listes de travail mènent à la place ou à la personne (§ 5.8)', () => {
  test('un titre non pourvu à la table 5, Ondine pressentie « hôte » : chaque liste porte son élément ; le titre sélectionne sa place, focalisée et dans la fenêtre ; Ondine devient la personne choisie ; « Désigner » → une entrée, les deux listes vides', async () => {
    let base = executer(sansProposition({ attribuer: true }), 'poserTitre', { table: 5, siege: 1, libelle: 'animateur' });
    base.participants[ONDINE - 1].titrePressenti = 'hôte';
    const m = await ouvrir(base);
    const cadre = cadreDe(m);
    await avecVue(m, { k: 1, tx: cadre.largeur / 2, ty: cadre.hauteur / 2 });
    expect(dansLaFenetre(m, chaiseEl(m, 5, 1))).toBe(false);
    const titres = dans(m, '[data-liste-travail="titres"]');
    const pressentis = dans(m, '[data-liste-travail="pressentis"]');
    expect([...titres.querySelectorAll('[data-titre]')].map(texteDe)).toEqual(['table 5 : titre animateur non pourvu']);
    expect([...pressentis.querySelectorAll('[data-participant]')].map((e) => e.dataset.participant)).toEqual([String(ONDINE)]);

    await cliquer(titres.querySelector('[data-titre]'));
    expect(m.ui.etat().selection).toEqual({ table: 5, siege: 1 });
    await attendre(() => expect(document.activeElement).toBe(racinePlan(m)));
    expect(actif(m)).toBe('siege-5-1');
    await attendre(() => expect(dansLaFenetre(m, chaiseEl(m, 5, 1))).toBe(true));

    const ondine = pressentis.querySelector(`[data-participant="${ONDINE}"]`);
    await cliquer(ondine);
    expect(m.ui.etat().choix).toEqual({ genre: 'personne', participant: ONDINE, depuis: null });
    expect(ondine.getAttribute('aria-pressed')).toBe('true');
    const r = fichiers(m).revision;
    await cliquer(actionPlace(m, 'designer'));
    await uneEntree(m, r);
    expect(charge(m).reservations).toEqual([{ participant: ONDINE, table: 5, siege: 1, portee: 'tous', tour: null }]);
    await attendre(() => expect(dans(m, '[data-liste-travail="titres"]').querySelectorAll('[data-titre]').length).toBe(0));
    expect(dans(m, '[data-liste-travail="pressentis"]').querySelectorAll('[data-participant]').length).toBe(0);
  });

  test('exclusion par le menu : RESERVATIONS_SUSPENDUES nomme Iris, compte sa réservation et le titre ; la liste gagne le titre ; la chaise hachurée à cadenas ouvert ; réservations inchangées ; réintégrer rend tout', async () => {
    const base = executer(sansProposition({ attribuer: true }), 'designer', { participant: IRIS, table: 3, siege: 1, libelle: 'animateur' });
    const m = await ouvrir(base);
    const reservations = structuredClone(charge(m).reservations);
    const DESIGNATION = new Set(['selection', 'focus']);
    const marques = () =>
      [...chaiseEl(m, 3, 1).querySelectorAll('[data-marque]')]
        .map((e) => e.dataset.marque)
        .filter((marque) => !DESIGNATION.has(marque))
        .sort();
    expect(marques()).toEqual(['anneau', 'cadenasFerme', 'remplissagePlein']);
    await cliquerChaise(m, 3, 1);
    let r = fichiers(m).revision;
    await cliquer(dans(m, `[data-menu="${IRIS}"] [data-commande="exclure"]`));
    await uneEntree(m, r);
    await attendre(() => expect(dans(m, '[data-avertissement="RESERVATIONS_SUSPENDUES"]')).not.toBeNull());
    const texte = texteDe(dans(m, '[data-avertissement="RESERVATIONS_SUSPENDUES"]'));
    expect(texte).toContain('Iris Ombrelle');
    expect(texte).toContain('1 réservation suspendue');
    expect(texte).toContain('1 titre de place');
    expect([...dans(m, '[data-liste-travail="titres"]').querySelectorAll('[data-titre]')].map(texteDe)).toEqual([
      'table 3 : titre animateur non pourvu',
    ]);
    await attendre(() => expect(marques()).toEqual(['cadenasOuvert', 'hachure']));
    expect(charge(m).reservations).toEqual(reservations);

    r += 1;
    await cliquer(dans(m, `[data-menu="${IRIS}"] [data-commande="reintegrer"]`));
    await uneEntree(m, r);
    await attendre(() => expect(marques()).toEqual(['anneau', 'cadenasFerme', 'remplissagePlein']));
    expect(dans(m, '[data-liste-travail="titres"]').querySelectorAll('[data-titre]').length).toBe(0);
    expect(charge(m).reservations).toEqual(reservations);
  });

  test('conversion proposée : la R-ième réservation « tour » de Théo à la table 1 la fait paraître, la charge inchangée ; ignorer → rien ; accepter → une entrée, une réservation « tous »', async () => {
    let base = sansProposition();
    for (const tour of [1, 2, 3]) base = executer(base, 'reserver', { participant: THEO, table: 1, siege: 2, portee: 'tour', tour });
    const m = await ouvrir(base);
    const avant = fichiers(m);
    const conversion = () => dans(m, `[data-conversion="${THEO}:1"]`);
    await attendre(() => expect(conversion()).not.toBeNull());
    await rienEcrit(m, avant);
    await cliquer(conversion().querySelector('[data-commande="ignorer"]'));
    expect(conversion()).toBeNull();
    await rienEcrit(m, avant);

    m.ui.allerA('tables');
    flushSync();
    m.ui.allerA('plan');
    flushSync();
    await attendre(() => expect(conversion()).not.toBeNull());
    await cliquer(conversion().querySelector('[data-commande="convertir"]'));
    await uneEntree(m, avant.revision);
    expect(charge(m).reservations).toEqual([{ participant: THEO, table: 1, siege: 2, portee: 'tous', tour: null }]);
  });

  test('réserve visible : sur un retenu, une personne en attente au tour affiché, choisie, une chaise libre, « Assigner » → deplacerDansRetenu ; changer de tour change la réserve et oublie le choix', async () => {
    const base = executer(executer(huitRetenue(), 'retirerDuTour', { tour: 1, participant: 7 }), 'retirerDuTour', { tour: 2, participant: 9 });
    const m = await ouvrir(base);
    const reserve = () => [...dans(m, '[data-reserve]').querySelectorAll('[data-participant]')].map((e) => Number(e.dataset.participant));
    expect(dans(m, '[data-reserve]').dataset.reserve).toBe('1');
    expect(reserve()).toEqual([7]);
    const commandes = releverCommandes(m);
    const r = fichiers(m).revision;
    await choisirDansLaReserve(m, 7);
    await cliquerChaise(m, 8, 3);
    await cliquer(actionPlace(m, 'assigner'));
    await uneEntree(m, r);
    expect(commandes.at(-1)).toEqual({ nom: 'deplacerDansRetenu', args: { tour: 1, participant: 7, table: 8, siege: 3 } });
    await attendre(() => expect(reserve()).toEqual([]));

    m.ui.choisir({ genre: 'personne', participant: 8, depuis: null });
    m.ui.montrerTour(2);
    flushSync();
    await images(2);
    expect(dans(m, '[data-reserve]').dataset.reserve).toBe('2');
    expect(reserve()).toEqual([9]);
    expect(m.ui.etat().choix).toBeNull();
  });
});

// --- La mise en évidence d'une personne (§ 7.1, § 8.2, § 8.4) ------------------------

describe('la mise en évidence d’une personne : posée et ôtée par un geste, en lecture, sans rien écrire (§ 7.1, § 8.4)', () => {
  // La chaise qui porte la marque de mise en évidence, ou null ; la marque
  // se voit au style calculé.
  const marquees = (m) => tous(m, '[data-marque="miseEnEvidence"]');
  const chaiseMarquee = (m) => {
    const [marque, ...autres] = marquees(m);
    expect(autres).toEqual([]);
    if (marque === undefined) return null;
    expect(marque.checkVisibility({ opacityProperty: true, visibilityProperty: true })).toBe(true);
    return marque.closest('[data-siege]').dataset.siege;
  };
  // La place qu'occupe une personne au tour montré, « table:siège ».
  const placeDe = (m, personne) => {
    for (const table of etatMontre(m).tables) {
      const chaise = table.chaises.find(({ occupant }) => occupant === personne);
      if (chaise !== undefined) return `${table.id}:${chaise.siege}`;
    }
    return null;
  };

  test('par le menu de la personne : sa chaise marquée, et elle seule, à chaque tour montré ; ôtée par le menu, puis posée et ôtée par la barre de vue', async () => {
    const m = await ouvrir(huitRetenue(), { mode: 'lecture' });
    expect(m.seance.etat().mode).toBe('lecture');
    const avant = fichiers(m);
    await cliquerChaise(m, 2, 1);
    const personne = etatMontre(m).tables[1].chaises[0].occupant;
    expect(personne).not.toBeNull();
    expect(chaiseMarquee(m)).toBeNull();
    const vueAvant = dans(m, '[data-vue]').getAttribute('transform');
    await cliquer(dans(m, `[data-menu="${personne}"] [data-commande="mettreEnEvidence"]`));
    await attendre(() => expect(chaiseMarquee(m)).toBe('2:1'));
    expect(dans(m, `[data-menu="${personne}"] [data-commande="mettreEnEvidence"]`)).toBeNull();
    // Le menu d'une personne déjà sous les yeux ne déplace pas la vue.
    expect(m.ui.etat().centrerEvidence).toBe(false);
    expect(dans(m, '[data-vue]').getAttribute('transform')).toBe(vueAvant);
    // La barre de vue nomme la personne mise en évidence.
    const barre = dans(m, '[data-evidence]');
    expect(barre).not.toBeNull();
    expect(texteDe(barre)).toContain(nomAffiche(charge(m).participants.find(({ id }) => id === personne)));
    expect(Number(barre.dataset.evidence)).toBe(personne);
    for (const tour of [2, 3, 1]) {
      m.ui.montrerTour(tour);
      flushSync();
      await images(2);
      expect(chaiseMarquee(m), `tour ${tour}`).toBe(placeDe(m, personne));
    }
    await cliquerChaise(m, 2, 1);
    await cliquer(dans(m, `[data-menu="${personne}"] [data-commande="oterEvidence"]`));
    await attendre(() => expect(chaiseMarquee(m)).toBeNull());
    expect(dans(m, '[data-evidence]')).toBeNull();
    expect(m.ui.etat().miseEnEvidence).toBeNull();

    await cliquer(dans(m, `[data-menu="${personne}"] [data-commande="mettreEnEvidence"]`));
    await attendre(() => expect(chaiseMarquee(m)).toBe('2:1'));
    await cliquer(dans(m, '[data-evidence] [data-commande="oterEvidence"]'));
    await attendre(() => expect(chaiseMarquee(m)).toBeNull());
    expect(fichiers(m)).toEqual(avant);
    expect(m.seance.etat().mode).toBe('lecture');
  });

  test('une personne mise en évidence puis supprimée : la barre dit qu’elle n’est plus dans la liste, et offre toujours d’ôter la mise en évidence', async () => {
    const m = await ouvrir(huitRetenue());
    const personne = etatMontre(m).tables[1].chaises[0].occupant;
    m.ui.mettreEnEvidence(personne);
    flushSync();
    await m.seance.executer('supprimerParticipant', { id: personne });
    flushSync();
    await images(2);
    const barre = dans(m, '[data-evidence]');
    expect(barre).not.toBeNull();
    expect(texteDe(barre)).toContain('une personne qui n’est plus dans la liste');
    await cliquer(barre.querySelector('[data-commande="oterEvidence"]'));
    expect(dans(m, '[data-evidence]')).toBeNull();
  });

  test('depuis sa ligne de la grille des participants : « Voir sur le plan » ouvre le plan, sa chaise marquée ; rien d’écrit', async () => {
    const m = await ouvrir(huitRetenue(), { mode: 'lecture' });
    const avant = fichiers(m);
    const personne = etatMontre(m).tables[2].chaises[1].occupant;
    m.ui.allerA('participants');
    flushSync();
    const voir = await attendre(() => {
      const bouton = dans(m, `[data-participant="${personne}"] [data-commande="voirSurLePlan"]`);
      expect(bouton).not.toBeNull();
      return bouton;
    });
    await cliquer(voir);
    await attendre(() => expect(m.ui.etat().section).toBe('plan'));
    await attendre(() => expect(tous(m, '[data-table]').length).toBe(8));
    await attendre(() => expect(chaiseMarquee(m)).toBe('3:2'));
    expect(m.ui.etat().miseEnEvidence).toBe(personne);
    expect(fichiers(m)).toEqual(avant);
  });
});

// --- La présence par tour (§ 7.1, § 5.8) ---------------------------------------

// Trois tables de quatre, neuf personnes, trois tours, la proposition 1
// retenue ; puis les gestes reçus, chacun par sa commande, le retenu ajusté
// dans la même entrée.
function avecPresences(gestes) {
  let charge = chargeDe({
    id: 'evt-presence',
    places: [4, 4, 4],
    personnes: 9,
    tours: [
      [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
      [[1, 4, 7], [2, 5, 8], [3, 6, 9]],
      [[1, 5, 9], [2, 6, 7], [3, 4, 8]],
    ],
  });
  for (const [nom, args] of gestes) charge = executer(charge, nom, args);
  return charge;
}

// Iris Ombrelle présente aux tours 1 et 2 : le retenu la dit absente au tour 3.
const irisPartie = () => avecPresences([['changerPresence', { id: IRIS, tours: [1, 2] }]]);

// La personne ajoutée, présente aux tours 2 et 3 : le retenu la réserve à
// ces tours.
const FIRMIN = 10;
const firminArrive = () =>
  avecPresences([['ajouterParticipant', { champs: { nom: 'Galet', prenom: 'Firmin' }, presence: [2, 3] }]]);

async function montrerTour(m, tour) {
  m.ui.montrerTour(tour);
  flushSync();
  await images(2);
}

describe('la présence par tour sur le plan : les absentes, la réserve du retenu, la mise en évidence (§ 7.1, § 5.8)', () => {
  test('la carte « Absentes » paraît au tour d\u{2019}absence, sous la réserve, et quitte le DOM au tour de présence ; la réserve ne contient pas l\u{2019}absente', async () => {
    const m = await ouvrir(irisPartie());
    await montrerTour(m, 1);
    expect(dans(m, '[data-absentes]')).toBeNull();
    expect(dans(m, `[data-reserve] [data-participant="${IRIS}"]`)).toBeNull();

    await montrerTour(m, 3);
    const carte = await attendre(() => {
      const element = dans(m, '[data-absentes="3"]');
      expect(element).not.toBeNull();
      return element;
    });
    const boutons = [...carte.querySelectorAll('[data-participant]')];
    expect(boutons.map((bouton) => Number(bouton.dataset.participant))).toEqual([IRIS]);
    expect(texteDe(boutons[0])).toBe('Iris Ombrelle \u{2014} présente aux tours 1 et 2');
    expect(boutons[0].hasAttribute('aria-pressed')).toBe(false);
    expect(texteDe(carte)).toContain(t('plan.absentes.tour', { tour: 3 }));
    const reserve = dans(m, '[data-reserve="3"]');
    expect(reserve.querySelector(`[data-participant="${IRIS}"]`)).toBeNull();
    expect(reserve.compareDocumentPosition(carte) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await montrerTour(m, 2);
    expect(dans(m, '[data-absentes]')).toBeNull();
  });

  test('le bouton d\u{2019}une absente ouvre sa fiche, sans la choisir ni rien écrire', async () => {
    const m = await ouvrir(irisPartie());
    await montrerTour(m, 3);
    const avant = fichiers(m);
    const bouton = await attendre(() => {
      const element = dans(m, `[data-absentes="3"] [data-participant="${IRIS}"]`);
      expect(element).not.toBeNull();
      return element;
    });
    await cliquer(bouton);
    await attendre(() => expect(m.ui.etat().fiche).toBe(IRIS));
    expect(m.ui.etat().section).toBe('participants');
    expect(m.ui.etat().choix).toBeNull();
    await rienEcrit(m, avant);
  });

  test('« En réserve dans le placement retenu » : un clic montre le premier tour, puis choisit la personne ; placée, elle quitte ce tour de la liste', async () => {
    const m = await ouvrir(firminArrive());
    await montrerTour(m, 1);
    const liste = dans(m, '[data-liste-travail="reserves"]');
    expect(liste).not.toBeNull();
    const bouton = liste.querySelector(`[data-participant="${FIRMIN}"]`);
    expect(texteDe(bouton)).toBe('Firmin Galet \u{2014} en réserve aux tours 2 et 3');
    expect(texteDe(dans(m, `#${liste.getAttribute('aria-labelledby')}`))).toBe(t('plan.listesTravail.reserves'));

    await cliquer(bouton);
    await attendre(() => expect(m.ui.etat().tour).toBe(2));
    expect(m.ui.etat().choix).toEqual({ genre: 'personne', participant: FIRMIN, depuis: null });
    await attendre(() => expect(bouton.getAttribute('aria-pressed')).toBe('true'));

    await cliquer(bouton);
    await attendre(() => expect(bouton.getAttribute('aria-pressed')).toBe('false'));
    expect(m.ui.etat().choix).toBeNull();
    expect(m.ui.etat().tour).toBe(2);

    await cliquer(bouton);
    await attendre(() => expect(bouton.getAttribute('aria-pressed')).toBe('true'));

    const r = fichiers(m).revision;
    await cliquerChaise(m, 1, 4);
    await cliquer(actionPlace(m, 'assigner'));
    await uneEntree(m, r);
    await attendre(() =>
      expect(texteDe(dans(m, `[data-liste-travail="reserves"] [data-participant="${FIRMIN}"]`))).toBe(
        'Firmin Galet \u{2014} en réserve au tour 3',
      ),
    );
  });

  test('la liste des réserves du retenu : « Aucun. » quand il n\u{2019}en laisse pas, absente sans retenu', async () => {
    const m = await ouvrir(irisPartie());
    const liste = dans(m, '[data-liste-travail="reserves"]');
    expect(liste).not.toBeNull();
    expect(liste.querySelectorAll('[data-participant]')).toHaveLength(0);
    expect(texteDe(liste.nextElementSibling)).toBe(t('plan.listesTravail.aucun'));
    demonter(m);

    const sans = await ouvrir(sansProposition());
    expect(dans(sans, '[data-liste-travail="pressentis"]')).not.toBeNull();
    expect(dans(sans, '[data-liste-travail="reserves"]')).toBeNull();
  });

  test('la barre de vue dit de la personne mise en évidence « absente au tour 3 », au seul tour de son absence', async () => {
    const m = await ouvrir(irisPartie(), { mode: 'lecture' });
    m.ui.mettreEnEvidence(IRIS);
    await montrerTour(m, 3);
    const barre = await attendre(() => {
      const element = dans(m, `[data-evidence="${IRIS}"]`);
      expect(element).not.toBeNull();
      return element;
    });
    expect(texteDe(barre)).toContain('Iris Ombrelle \u{2014} absente au tour 3');
    await montrerTour(m, 2);
    expect(texteDe(dans(m, `[data-evidence="${IRIS}"]`))).not.toContain('absente');
  });

  test('assignée à un tour d\u{2019}absence, une pressentie reçoit PERSONNE_ABSENTE_AU_TOUR sur la place, remède « La dire présente aux tours 1 et 3 »', async () => {
    const charge = avecPresences([
      ['modifierParticipant', { id: THEO, champs: { titrePressenti: 'hôte' } }],
      ['changerPresence', { id: THEO, tours: [1] }],
    ]);
    const m = await ouvrir(charge);
    await montrerTour(m, 3);
    expect(dans(m, `[data-absentes="3"] [data-participant="${THEO}"]`)).not.toBeNull();
    const avant = fichiers(m);
    await cliquer(dans(m, `[data-liste-travail="pressentis"] [data-participant="${THEO}"]`));
    await attendre(() => expect(m.ui.etat().choix?.participant).toBe(THEO));
    await cliquerChaise(m, 2, 4);
    await cliquer(actionPlace(m, 'assigner'));
    const message = await refusSurLaPlace(m, chaiseEl(m, 2, 4), 2, ['PERSONNE_ABSENTE_AU_TOUR'], avant);
    const remede = message.querySelector('[data-refus="PERSONNE_ABSENTE_AU_TOUR"] [data-commande]');
    expect(remede.dataset.commande).toBe('changerPresence');
    expect(texteDe(remede)).toBe('La dire présente aux tours 1 et 3');
  });
});
