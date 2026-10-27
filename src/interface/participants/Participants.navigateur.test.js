// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La liste des participants dans un vrai moteur de rendu (§ 4, § 4.2, § 4.4,
// § 5.9, § 7.4, § 10.2) : la saisie par le seul nom, l'organisation
// collante, la grille au clavier, le tri, le filtre et le compte,
// l'exclusion, la présence par tour saisie en cases dans la grille, les
// conflits d'organisation saisis par un choix multiple, la colonne des
// inclusions, masquée par défaut, et ses deux choix multiples sous une
// recherche, le manque de places à l'ajout et à la réintégration, la fiche
// et l'itinéraire, les étiquettes de la fiche et leur légende, l'export, le
// collage, et la liste groupée par une colonne ou plusieurs, ses groupes
// imbriqués, repliés et dépliés, et les conflits du placement montré sous
// ses groupes. Chaque épreuve monte App par
// monterApp, sur le système de fichiers simulé et l'horloge pilotée ; chaque
// écriture se relève (trace) et chaque entrée se compte dans le journal. Les
// gestes passent par des entrées que Chromium traite comme réelles
// (test/navigateur/entrees.js). Les noms d'épreuve sont inventés.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cdp } from 'vitest/browser';
import { flushSync, tick } from 'svelte';
import { bilanChangementDefaut } from '../../application/bilans.js';
import { appliquerCommande } from '../../application/commandes.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { apercevoir, cleNormalisee, decoder, exporterParticipants } from '../../application/csv.js';
import { etatPlaces, statuts } from '../../application/places.js';
import { texteLivre } from '../../demo/livrees.js';
import { kSieges } from '../../geometrie/designation.js';
import { geometrieTable } from '../../geometrie/tables.js';
import { ajuster, vueDepuisTransform } from '../../geometrie/vue.js';
import { STATUT, nombrePlacesManquantes, normaliser } from '../../moteur/configuration.js';
import { rechercher } from '../../moteur/recherche.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { serialiser } from '../../stockage/canonique.js';
import { lireJournal } from '../../stockage/journal.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { formeNommee } from '../../stockage/placements.js';
import { VERSION } from '../../version.genere.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { actionDe, boutonActions } from '../../../test/navigateur/menus.js';
import { fixerCadre, pointer, touche } from '../../../test/navigateur/entrees.js';
import { composantes, rangeesDeTexte, sousTheme, traductionEcran, visible } from '../../../test/navigateur/rendu.js';
import CAS_LIMITES from '../../../exemples/participants_cas_limites.csv?url';
import { RANGS_ORGANISATION, teintesOrganisations } from '../organisations.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { cadreDepuisRect, englobantDuTour } from '../plan/vue_plan.js';
import { comptesEntete } from './entete.js';
import {
  COLONNES,
  GROUPEMENTS,
  MASQUABLES,
  cheminDe,
  cleDeGroupement,
  cleDeStatut,
  colonnesMontrees,
  groupesGrille,
  lignesGrille,
  lignesVisibles,
} from './grille.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
// Le t de l'écran, celui qu'App pose au contexte (§ 14.6) : l'attendu d'un
// texte lu tel que l'écran le porte, insécables comprises.
const { t: tEcran } = traductionEcran();

const EVENEMENT = 'Soirée des Merles';
const CLUB = 'Club des Merles';

// Des noms inventés, hors du réservoir du générateur.
const NOMS = [
  'Quenouillet',
  'Brindelle',
  'Calvaille',
  'Doucemer',
  'Esquirol',
  'Faverolle',
  'Glanduc',
  'Houblonnet',
  'Isardin',
  'Joncaille',
  'Kerbouet',
  'Lisonnet',
  'Moucheron',
  'Nivelette',
  'Orbelin',
  'Pistachon',
  'Rouvrelle',
];

// Les montages de l'épreuve en cours, démontés après elle ; le collecteur
// n'a rien reçu pendant l'épreuve.
let montes = [];
let erreursAvant = 0;
beforeEach(() => {
  erreursAvant = globalThis.__gttErreurs?.length ?? 0;
});
afterEach(() => {
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  vi.restoreAllMocks();
  const recues = globalThis.__gttErreurs?.slice(erreursAvant) ?? [];
  expect(recues, 'erreurs reçues par le collecteur').toEqual([]);
});

async function rendu() {
  flushSync();
  await tick();
}

// Attend que la file de la séance ait passé ce que le geste y a posé, par
// une lecture admise dans tout mode qui n'écrit rien, puis le rendu.
async function attendreSeance(m) {
  await m.seance.formeNommee(null).catch(() => undefined);
  await rendu();
  await rendu();
}

// Un CSV d'épreuve, séparé par « ; » : nom, prénom, organisation, exclu,
// titre pressenti, notes.
const csv = (personnes) =>
  [
    'nom;prenom;organisation;exclu;titre_pressenti;notes',
    ...personnes.map((p) => [p.nom, p.prenom ?? '', p.organisation ?? '', p.exclu ? 'oui' : '', p.titre ?? '', p.notes ?? ''].join(';')),
  ].join('\n');

// L'aperçu d'un texte sous le nombre de tours de l'événement ouvert, comme
// la section d'import le calcule : la présence s'y lit sous ce nombre.
const apercuPour = (m, texte) => apercevoir(texte, { tours: m.seance.etat().charge.evenement.tours });

// Importe un texte par la commande, comme le ferait l'aperçu.
const importer = (m, texte) => m.seance.executer('importerParticipants', { apercu: apercuPour(m, texte), mode: 'ajouter' });

// Les octets d'un CSV livré, lus par son adresse.
async function octetsLivres(url) {
  const reponse = await fetch(url);
  return new Uint8Array(await reponse.arrayBuffer());
}

/**
 * Un montage, un événement créé — sieges places par défaut, tours tours,
 * tables tables rondes, personnes importées —, en écriture, la section des
 * participants ouverte.
 */
async function evenementOuvert({ sieges = 8, tours = 2, tables = 0, personnes = [] } = {}) {
  const m = await monterApp();
  montes.push(m);
  await m.seance.creer({ nom: EVENEMENT, date: null, siegesParDefaut: sieges, tours });
  await m.seance.passerEnEcriture();
  for (let i = 0; i < tables; i += 1) await m.seance.executer('creerTable', { forme: 'ronde' });
  if (personnes.length > 0) await importer(m, csv(personnes));
  m.ui.allerA('participants');
  await rendu();
  return m;
}

const base = (m) => m.seance.etat().evenement.base;
const texteJournal = (m) => m.fs.contenu('documents', `${m.seance.etat().evenement.cle}${SUFFIXES.journal}`);
const entrees = (m) => lireJournal(texteJournal(m)).entrees;
const texteEtat = (m) => m.fs.contenu('documents', `${m.seance.etat().evenement.cle}${SUFFIXES.etat}`);
const participants = (m) => m.seance.etat().charge.participants;
const idDe = (m, nom) => participants(m).find((p) => p.nom === nom).id;

const section = (m) => m.racine.querySelector('[data-section="participants"]');
const formulaire = (m) => section(m).querySelector('form');
const champ = (m, cle) => formulaire(m).querySelector(`[data-champ="${cle}"]`);
const grille = (m) => section(m).querySelector('[role="grid"]');
const lignes = (m) => [...grille(m).querySelectorAll('[data-participant]')];
const idsAffiches = (m) => lignes(m).map((ligne) => Number(ligne.dataset.participant));
const ligne = (m, id) => grille(m).querySelector(`[data-participant="${id}"]`);
const cellule = (m, id, colonne) => ligne(m, id).querySelector(`[data-champ="${colonne}"]`);
const commandeDeLigne = (m, id, nom) => ligne(m, id).querySelector(`[data-commande="${nom}"]`);
// Le <svg> du plan, et la vue que porte son groupe [data-vue].
const svgDe = (m) => m.racine.querySelector('svg[data-plan]');
const vueDe = (m) => vueDepuisTransform(m.racine.querySelector('[data-vue]').getAttribute('transform'));
const fiche = (m) => section(m).querySelector('[data-fiche]');

const centre = (element) => {
  const b = element.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
};

// Un clic réel au centre de l'élément, amené d'abord dans la fenêtre.
async function cliquer(element) {
  element.scrollIntoView({ block: 'center' });
  const { x, y } = centre(element);
  await pointer('presser', x, y);
  await pointer('relacher', x, y);
  await rendu();
}

// Remplace le texte d'un champ par une saisie réelle : le champ prend le
// focus, son texte est sélectionné, puis remplacé par l'insertion du texte,
// ou effacé.
async function saisir(entree, texte) {
  entree.focus();
  entree.select();
  if (texte === '') await touche('Backspace');
  else await cdp().send('Input.insertText', { text: texte });
  await rendu();
}

// Ajoute une personne par le formulaire : chaque champ donné saisi, puis
// Entrée dans le champ du nom.
async function ajouter(m, champs) {
  for (const [cle, valeur] of Object.entries(champs)) await saisir(champ(m, cle), valeur);
  champ(m, 'nom').focus();
  await touche('Enter');
  await attendreSeance(m);
}

// Maj+Tab réel : touche() ne porte pas de modificateur ; 8 est le masque de
// Maj dans Input.dispatchKeyEvent.
async function majTab() {
  const commun = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, modifiers: 8 };
  await cdp().send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...commun });
  await cdp().send('Input.dispatchKeyEvent', { type: 'keyUp', ...commun });
}

// Maj+Entrée réel, le saut de ligne d'une zone de texte ; 8 est le masque
// de Maj.
async function majEntree() {
  const commun = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, modifiers: 8 };
  await cdp().send('Input.dispatchKeyEvent', { type: 'keyDown', ...commun, text: '\r', unmodifiedText: '\r' });
  await cdp().send('Input.dispatchKeyEvent', { type: 'keyUp', ...commun });
  await rendu();
}

// La valeur de la fiche que nomme l'étiquette de clé donnée.
function valeurDeFiche(m, cle) {
  const etiquette = [...fiche(m).querySelectorAll('dt')].find((dt) => dt.textContent === t(cle));
  expect(etiquette, cle).toBeDefined();
  return etiquette.nextElementSibling;
}

// Le tableau de la fiche que titre la légende de clé donnée.
const tableauDeFiche = (m, cle) => [...fiche(m).querySelectorAll('table')].find((tableau) => tableau.caption?.textContent === t(cle));

// L'écart entre deux boîtes : 0 quand elles se touchent ou se chevauchent.
function ecart(a, b) {
  const ba = a.getBoundingClientRect();
  const bb = b.getBoundingClientRect();
  const dx = Math.max(0, ba.left - bb.right, bb.left - ba.right);
  const dy = Math.max(0, ba.top - bb.bottom, bb.top - ba.bottom);
  return Math.max(dx, dy);
}

// Retient les ajouts de ligne au journal du système simulé jusqu'à
// liberer() : l'écriture d'un geste reste en cours, comme sur un support
// lent, sans délai ni minuterie. L'application lit la primitive sur fs au
// moment du geste.
function retenirJournal(m) {
  const ajouterLigne = m.fs.ajouterLigne;
  let liberer;
  const porte = new Promise((resoudre) => {
    liberer = resoudre;
  });
  m.fs.ajouterLigne = async (...parametres) => {
    await porte;
    return ajouterLigne.apply(m.fs, parametres);
  };
  return () => liberer();
}

const aucuneFenetre = () => expect(document.querySelectorAll('dialog[open], [role=dialog], [role=alertdialog]').length).toBe(0);

describe('la saisie (§ 4, § 10.2)', () => {
  test('seul le nom : « Pervenche » enregistre une personne aux autres champs null, en une entrée ; un nom tapé en NFD est enregistré en NFC', async () => {
    const m = await evenementOuvert();
    const avant = entrees(m).length;
    await ajouter(m, { nom: 'Pervenche' });
    expect(entrees(m)).toHaveLength(avant + 1);
    const [{ id, ...champs }] = participants(m);
    expect(Number.isInteger(id)).toBe(true);
    expect(champs).toEqual({
      nom: 'Pervenche',
      prenom: null,
      organisation: null,
      courriel: null,
      titrePressenti: null,
      notes: null,
      exclu: false,
    });
    expect(champ(m, 'nom').value).toBe('');

    const decompose = 'Ombre\u{0301}lle';
    expect(decompose.length).toBe(9);
    await ajouter(m, { nom: decompose });
    expect(entrees(m)).toHaveLength(avant + 2);
    expect(participants(m).at(-1).nom).toBe('Ombr\u{00E9}lle');
  });

  test('une seconde Entrée pendant l’écriture n’ajoute rien ; ce qui est tapé pendant l’écriture reste, ce qui a été envoyé se vide (§ 10.2)', async () => {
    const m = await evenementOuvert();
    const avant = entrees(m).length;
    const liberer = retenirJournal(m);
    const ajout = () => section(m).querySelector('form [data-commande="ajouter"]');
    expect(ajout()).not.toBeNull();
    const styleRepos = getComputedStyle(ajout()).borderTopStyle;
    expect(ajout().getAttribute('aria-busy')).toBeNull();
    expect(ajout().getAttribute('aria-disabled')).toBeNull();
    await saisir(champ(m, 'nom'), 'Ombrelle');
    await saisir(champ(m, 'notes'), 'arrive tard');
    champ(m, 'nom').focus();
    await touche('Enter');
    await rendu();
    // L'écriture retenue : « Ajouter » se dit occupé, d'un filet tireté.
    expect(ajout().getAttribute('aria-busy')).toBe('true');
    expect(ajout().getAttribute('aria-disabled')).toBe('true');
    expect(getComputedStyle(ajout()).borderTopStyle).toBe('dashed');
    expect(getComputedStyle(ajout()).borderTopStyle).not.toBe(styleRepos);
    await touche('Enter');
    await rendu();
    // La personne suivante se tape pendant l'écriture de la première.
    await saisir(champ(m, 'prenom'), 'Théo');
    await saisir(champ(m, 'nom'), 'Pervenche');
    liberer();
    await vi.waitFor(() => expect(participants(m)).toHaveLength(1));
    await attendreSeance(m);
    await rendu();
    expect(ajout().getAttribute('aria-busy')).toBeNull();
    expect(ajout().getAttribute('aria-disabled')).toBeNull();
    expect(getComputedStyle(ajout()).borderTopStyle).toBe(styleRepos);
    expect(participants(m)).toHaveLength(1);
    expect(participants(m)[0]).toMatchObject({ nom: 'Ombrelle', prenom: null, notes: 'arrive tard' });
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(champ(m, 'nom').value).toBe('Pervenche');
    expect(champ(m, 'prenom').value).toBe('Théo');
    expect(champ(m, 'notes').value).toBe('');
    // La saisie gardée s'envoie à son tour.
    champ(m, 'nom').focus();
    await touche('Enter');
    await attendreSeance(m);
    expect(participants(m).map((p) => [p.nom, p.prenom])).toEqual([
      ['Ombrelle', null],
      ['Pervenche', 'Théo'],
    ]);
  });

  test('nom vide : « ␠␠ » pose sur le champ aria-invalid et un message visible qui le jouxte ; aucune fenêtre, zéro écriture', async () => {
    const m = await evenementOuvert();
    const trace = m.trace.length;
    const etat = texteEtat(m);
    await ajouter(m, { nom: '  ' });
    const entree = champ(m, 'nom');
    expect(entree.getAttribute('aria-invalid')).toBe('true');
    const message = document.getElementById(entree.getAttribute('aria-describedby'));
    expect(message).not.toBeNull();
    expect(message.textContent).toContain(t('NOM_REQUIS', {}));
    expect(visible(message)).toBe(true);
    expect(ecart(entree, message)).toBeLessThanOrEqual(16);
    aucuneFenetre();
    expect(m.trace.length).toBe(trace);
    expect(texteEtat(m)).toBe(etat);
    expect(participants(m)).toHaveLength(0);
  });

  test('organisation collante : trois personnes portent « Club des Merles » ; le champ vidé, la quatrième n’en porte aucune', async () => {
    const m = await evenementOuvert();
    await ajouter(m, { nom: 'Ombrelle', prenom: 'Iris', organisation: CLUB });
    expect(champ(m, 'organisation').value).toBe(CLUB);
    expect(champ(m, 'prenom').value).toBe('');
    await ajouter(m, { nom: 'Pervenche' });
    await ajouter(m, { nom: 'Lacasse' });
    expect(participants(m).map((p) => [p.nom, p.prenom, p.organisation])).toEqual([
      ['Ombrelle', 'Iris', CLUB],
      ['Pervenche', null, CLUB],
      ['Lacasse', null, CLUB],
    ]);
    await saisir(champ(m, 'organisation'), '');
    await ajouter(m, { nom: 'Grisaille' });
    expect(participants(m).at(-1).organisation).toBeNull();
  });

  test('l’organisation collante survit à un aller-retour par le plan et par « À propos » ; un autre événement repart d’un champ vide', async () => {
    const m = await evenementOuvert();
    await ajouter(m, { nom: 'Ombrelle', organisation: CLUB });
    m.ui.allerA('plan');
    await rendu();
    m.ui.allerA('participants');
    await rendu();
    expect(champ(m, 'organisation').value).toBe(CLUB);
    m.ui.ouvrirApropos();
    await rendu();
    m.ui.fermerApropos();
    await rendu();
    expect(champ(m, 'organisation').value).toBe(CLUB);
    await ajouter(m, { nom: 'Pervenche' });
    expect(participants(m).at(-1).organisation).toBe(CLUB);
    await m.seance.fermer();
    await m.seance.creer({ nom: 'Bal des Grisailles', date: null, siegesParDefaut: 8, tours: 2 });
    m.ui.allerA('participants');
    await rendu();
    expect(champ(m, 'organisation').value).toBe('');
  });

  test('une organisation qui ne diffère d’une existante que par la casse et les blancs est signalée sur le champ, l’orthographe existante à reprendre ; rien ne fusionne seul', async () => {
    const m = await evenementOuvert({ personnes: [{ nom: 'Ombrelle', prenom: 'Iris', organisation: CLUB }] });
    const trace = m.trace.length;
    await saisir(champ(m, 'organisation'), 'club des  merles');
    const signal = formulaire(m).querySelector('[data-avertissement]');
    expect(signal).not.toBeNull();
    expect(visible(signal)).toBe(true);
    expect(signal.textContent).toContain(CLUB);
    expect(champ(m, 'organisation').getAttribute('aria-describedby')).toContain(signal.id);
    expect(champ(m, 'organisation').value).toBe('club des  merles');
    await cliquer(signal.querySelector('[data-commande="reprendreOrthographe"]'));
    expect(champ(m, 'organisation').value).toBe(CLUB);
    expect(formulaire(m).querySelector('[data-avertissement]')).toBeNull();
    expect(m.trace.length).toBe(trace);
  });
});

describe('la grille (§ 10.2, § 19.3)', () => {
  const TROIS = [
    { nom: 'Ombrelle', prenom: 'Iris', organisation: CLUB },
    { nom: 'Pervenche', prenom: 'Théo', organisation: 'CLUB DES MERLES' },
    { nom: 'Lacasse', prenom: 'Ondine' },
    { nom: 'Grisaille' },
  ];

  test('au clavier seul : le courriel d’Ondine Lacasse changé en une entrée ; Échap rend la valeur, valider sans changement n’écrit rien', async () => {
    const m = await evenementOuvert({ personnes: TROIS });
    const ondine = idDe(m, 'Lacasse');
    const rang = idsAffiches(m).indexOf(ondine);
    const colonne = colonnesMontrees([]).indexOf('courriel');
    expect(rang).toBeGreaterThan(0);
    expect(colonne).toBeGreaterThan(0);

    const premiere = grille(m).querySelector('[tabindex="0"]');
    expect(premiere).toBe(cellule(m, idsAffiches(m)[0], COLONNES[0]));
    premiere.focus();
    for (let i = 0; i < rang; i += 1) await touche('ArrowDown');
    for (let i = 0; i < colonne; i += 1) await touche('ArrowRight');
    await rendu();
    const cible = cellule(m, ondine, 'courriel');
    expect(document.activeElement).toBe(cible);

    const avant = entrees(m).length;
    await touche('Enter');
    await rendu();
    for (const caractere of 'ondine@exemple.test') await touche(caractere);
    await touche('Enter');
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(entrees(m).at(-1).libelle).toBe('Modifié Ondine Lacasse : courriel');
    expect(participants(m).find((p) => p.id === ondine).courriel).toBe('ondine@exemple.test');
    expect(cellule(m, ondine, 'courriel').textContent.trim()).toBe('ondine@exemple.test');

    // Échap en cours d'édition : rien ne s'écrit, la valeur d'origine revient.
    const trace = m.trace.length;
    cellule(m, ondine, 'courriel').focus();
    await touche('Enter');
    await rendu();
    for (const caractere of 'zz') await touche(caractere);
    await touche('Escape');
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(cellule(m, ondine, 'courriel').querySelector('input')).toBeNull();
    expect(cellule(m, ondine, 'courriel').textContent.trim()).toBe('ondine@exemple.test');

    // Valider sans changement : aucune commande ne part, donc aucun refus
    // SANS_EFFET ne se pose sur la cellule, et rien ne s'écrit.
    const executer = vi.spyOn(m.seance, 'executer');
    cellule(m, ondine, 'courriel').focus();
    await touche('Enter');
    await rendu();
    await touche('Enter');
    await attendreSeance(m);
    expect(executer).not.toHaveBeenCalled();
    expect(cellule(m, ondine, 'courriel').querySelector('[data-refus]')).toBeNull();
    expect(cellule(m, ondine, 'courriel').querySelector('[aria-invalid]')).toBeNull();
    expect(cellule(m, ondine, 'courriel').querySelector('input')).toBeNull();
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(m.trace.length).toBe(trace);
  });

  test('Flèche gauche sur une cellule hors édition mène à la cellule précédente de la ligne, et s’arrête à la première', async () => {
    const m = await evenementOuvert({ personnes: TROIS });
    const premier = idsAffiches(m)[0];
    cellule(m, premier, COLONNES[1]).focus();
    await touche('ArrowLeft');
    await rendu();
    expect(document.activeElement).toBe(cellule(m, premier, COLONNES[0]));
    await touche('ArrowLeft');
    await rendu();
    expect(document.activeElement).toBe(cellule(m, premier, COLONNES[0]));
  });

  test('Tab après une saisie qui déplace la ligne au tri mène à la cellule suivante de la même personne', async () => {
    const m = await evenementOuvert({ personnes: TROIS });
    await cliquer(section(m).querySelector('[data-commande="trier"][data-cible="nom"]'));
    const premier = idsAffiches(m)[0];
    expect(participants(m).find((p) => p.id === premier).nom).toBe('Grisaille');

    cellule(m, premier, 'nom').focus();
    await touche('Enter');
    await rendu();
    await saisir(cellule(m, premier, 'nom').querySelector('input'), 'Zed');
    await touche('Tab');
    await attendreSeance(m);
    expect(participants(m).find((p) => p.id === premier).nom).toBe('Zed');
    expect(idsAffiches(m).at(-1)).toBe(premier);
    expect(document.activeElement).toBe(cellule(m, premier, COLONNES[1]));
  });

  test('Tab après une saisie qui retire la ligne du filtre mène à la première cellule de la personne qui la suivait', async () => {
    const m = await evenementOuvert({ personnes: TROIS });
    await cliquer(section(m).querySelector('[data-commande="trier"][data-cible="nom"]'));
    await saisir(section(m).querySelector('[data-champ="filtre"]'), 'merles');
    const [premier, second] = idsAffiches(m);
    expect(idsAffiches(m)).toHaveLength(2);

    cellule(m, premier, 'organisation').focus();
    await touche('Enter');
    await rendu();
    await saisir(cellule(m, premier, 'organisation').querySelector('input'), 'Cercle des Pinsons');
    await touche('Tab');
    await attendreSeance(m);
    expect(idsAffiches(m)).toEqual([second]);
    expect(document.activeElement).toBe(cellule(m, second, COLONNES[0]));
  });

  test('Entrée sur une saisie qui retire la ligne du filtre : la même colonne de la personne qui la suivait prend le focus, non le document', async () => {
    const m = await evenementOuvert({ personnes: TROIS });
    await cliquer(section(m).querySelector('[data-commande="trier"][data-cible="nom"]'));
    await saisir(section(m).querySelector('[data-champ="filtre"]'), 'merles');
    const [premier, second] = idsAffiches(m);

    cellule(m, premier, 'organisation').focus();
    await touche('Enter');
    await rendu();
    await saisir(cellule(m, premier, 'organisation').querySelector('input'), 'Cercle des Pinsons');
    await touche('Enter');
    await attendreSeance(m);
    expect(idsAffiches(m)).toEqual([second]);
    await vi.waitFor(() => expect(document.activeElement).toBe(cellule(m, second, 'organisation')));
  });

  test('Tab sur une saisie refusée : une seule commande, l’édition et le focus restent dans le champ, le refus contre lui', async () => {
    const m = await evenementOuvert({ personnes: TROIS });
    const premier = idsAffiches(m)[0];
    cellule(m, premier, 'nom').focus();
    await touche('Enter');
    await rendu();
    const champ = cellule(m, premier, 'nom').querySelector('input');
    await saisir(champ, '   ');
    const executer = vi.spyOn(m.seance, 'executer');
    const avant = entrees(m).length;
    await touche('Tab');
    await attendreSeance(m);
    await rendu();
    expect(executer).toHaveBeenCalledTimes(1);
    const refuse = cellule(m, premier, 'nom').querySelector('input');
    expect(refuse).not.toBeNull();
    expect(document.activeElement).toBe(refuse);
    expect(refuse.getAttribute('aria-invalid')).toBe('true');
    expect(cellule(m, premier, 'nom').querySelector('[data-refus]')).not.toBeNull();
    expect(entrees(m)).toHaveLength(avant);
  });

  test('Maj+Tab après une saisie qui retire la ligne du filtre mène à la dernière cellule de la personne qui la précédait', async () => {
    const m = await evenementOuvert({ personnes: TROIS });
    await cliquer(section(m).querySelector('[data-commande="trier"][data-cible="nom"]'));
    await saisir(section(m).querySelector('[data-champ="filtre"]'), 'merles');
    const [premier, second] = idsAffiches(m);
    expect(idsAffiches(m)).toHaveLength(2);

    cellule(m, second, 'organisation').focus();
    await touche('Enter');
    await rendu();
    await saisir(cellule(m, second, 'organisation').querySelector('input'), 'Cercle des Pinsons');
    await majTab();
    await attendreSeance(m);
    expect(idsAffiches(m)).toEqual([premier]);
    expect(document.activeElement).toBe(cellule(m, premier, COLONNES.at(-1)));
  });

  test('hors édition, Maj+Tab mène de la première cellule d’une ligne à la dernière de la ligne d’avant, Tab l’y ramène', async () => {
    const m = await evenementOuvert({ personnes: TROIS });
    const [premier, second] = idsAffiches(m);
    cellule(m, second, COLONNES[0]).focus();
    await rendu();
    await majTab();
    await rendu();
    expect(document.activeElement).toBe(cellule(m, premier, COLONNES.at(-1)));
    expect(cellule(m, premier, COLONNES.at(-1)).querySelector('input, textarea')).toBeNull();
    await touche('Tab');
    await rendu();
    expect(document.activeElement).toBe(cellule(m, second, COLONNES[0]));
  });

  test('hors édition, Échap efface le refus de la cellule : Entrée en lecture le pose sans ouvrir de champ, la cellule garde le focus', async () => {
    const m = await evenementOuvert({ personnes: TROIS });
    await m.seance.passerEnLecture();
    await rendu();
    const cible = cellule(m, idsAffiches(m)[0], 'nom');
    cible.focus();
    await touche('Enter');
    await rendu();
    expect(cible.querySelector('input')).toBeNull();
    expect(cible.querySelector('[data-refus]')).not.toBeNull();
    expect(document.activeElement).toBe(cible);
    await touche('Escape');
    await rendu();
    expect(cible.querySelector('[data-refus]')).toBeNull();
    expect(cible.hasAttribute('aria-describedby')).toBe(false);
  });

  test('une note de deux lignes, retouchée dans la grille, garde son saut de ligne', async () => {
    const m = await evenementOuvert();
    await m.seance.executer('ajouterParticipant', { champs: { nom: 'Lacasse', prenom: 'Ondine', notes: 'arrive tard\nrepart tôt' } });
    await rendu();
    const id = idDe(m, 'Lacasse');
    const avant = entrees(m).length;
    cellule(m, id, 'notes').focus();
    await touche('Enter');
    await rendu();
    for (const caractere of ' x') await touche(caractere);
    await touche('Enter');
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(participants(m).find((p) => p.id === id).notes).toBe('arrive tard\nrepart tôt x');
  });

  test('une note saisie sur deux lignes : Maj+Entrée insère le saut de ligne, dans la grille comme au formulaire ; Entrée valide (§ 10.2, § 10.3)', async () => {
    const m = await evenementOuvert();
    // Au formulaire : la note de deux lignes, puis Entrée dans les notes envoie.
    await saisir(champ(m, 'nom'), 'Lacasse');
    champ(m, 'notes').focus();
    for (const caractere of 'a') await touche(caractere);
    await majEntree();
    for (const caractere of 'b') await touche(caractere);
    await touche('Enter');
    await attendreSeance(m);
    expect(participants(m)).toHaveLength(1);
    expect(participants(m)[0].notes).toBe('a\nb');
    // Dans la grille : la cellule des notes, éditée, reçoit une troisième ligne.
    const id = idDe(m, 'Lacasse');
    const avant = entrees(m).length;
    cellule(m, id, 'notes').focus();
    await touche('Enter');
    await rendu();
    await majEntree();
    for (const caractere of 'c') await touche(caractere);
    await rendu();
    expect(entrees(m)).toHaveLength(avant);
    await touche('Enter');
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(participants(m)[0].notes).toBe('a\nb\nc');
  });

  test('trier par nom, croissant puis décroissant, filtrer « merles » : l’ordre et les lignes suivent ; rien ne s’écrit, en écriture comme en lecture', async () => {
    const m = await evenementOuvert({ personnes: TROIS });
    const parNom = (sens) =>
      [...participants(m)]
        .sort((a, b) => (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : a.id - b.id) * (sens === 'croissant' ? 1 : -1))
        .map((p) => p.id);
    const merles = participants(m)
      .filter((p) => p.organisation !== null)
      .map((p) => p.id);
    expect(merles).toHaveLength(2);

    for (const mode of ['ecriture', 'lecture']) {
      if (mode === 'lecture') {
        await m.seance.passerEnLecture();
        await rendu();
      }
      const journal = texteJournal(m);
      const etat = texteEtat(m);
      const trace = m.trace.length;
      const trier = section(m).querySelector('[data-commande="trier"][data-cible="nom"]');
      await cliquer(trier);
      expect(idsAffiches(m), mode).toEqual(parNom('croissant'));
      await cliquer(section(m).querySelector('[data-commande="trier"][data-cible="nom"]'));
      expect(idsAffiches(m), mode).toEqual(parNom('decroissant'));
      await saisir(section(m).querySelector('[data-champ="filtre"]'), 'merles');
      expect([...idsAffiches(m)].sort((a, b) => a - b), mode).toEqual(merles);
      expect(section(m).querySelector('output').textContent).toBe(t('participants.grille.compte', { total: 4, affiches: 2 }));
      await saisir(section(m).querySelector('[data-champ="filtre"]'), '');
      expect(idsAffiches(m)).toHaveLength(4);
      await attendreSeance(m);
      expect(texteJournal(m), mode).toBe(journal);
      expect(texteEtat(m), mode).toBe(etat);
      expect(m.trace.length, mode).toBe(trace);
    }
  });

  test('après l’import des cas limites, le compte affiché égale le nombre de lignes importées ; une personne exclue reste visible', async () => {
    const m = await evenementOuvert();
    const octets = await octetsLivres(CAS_LIMITES);
    const { resume } = await m.seance.executer('importerParticipants', {
      apercu: apercuPour(m, decoder(octets).texte),
      mode: 'ajouter',
    });
    await rendu();
    expect(resume.ajoutes).toBeGreaterThan(0);
    expect(participants(m)).toHaveLength(resume.ajoutes);
    expect(lignes(m)).toHaveLength(resume.ajoutes);
    expect(section(m).querySelector('output').textContent).toBe(
      t('participants.grille.compte', { total: resume.ajoutes, affiches: resume.ajoutes }),
    );
    const exclue = participants(m).find((p) => p.exclu);
    expect(exclue).toBeDefined();
    expect(cellule(m, exclue.id, 'exclu').textContent.trim()).toBe(t('participants.grille.exclue'));
  });

  test('exclusion : douze personnes, en exclure une → douze lignes, la sienne porte « exclue » en texte ; le bilan compte onze participants', async () => {
    const m = await evenementOuvert({ personnes: NOMS.slice(0, 12).map((nom) => ({ nom })) });
    const id = idDe(m, NOMS[3]);
    const avant = entrees(m).length;
    await cliquer(commandeDeLigne(m, id, 'exclureParticipant'));
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(lignes(m)).toHaveLength(12);
    expect(cellule(m, id, 'exclu').textContent.trim()).toBe(t('participants.grille.exclue'));
    const autres = participants(m).filter((p) => p.id !== id);
    expect(autres).toHaveLength(11);
    // La marque est un texte, distinct de celui d'une personne présente.
    for (const p of autres) expect(cellule(m, p.id, 'exclu').textContent.trim()).toBe(t('participants.grille.presente'));
    expect(t('participants.grille.presente')).not.toBe(t('participants.grille.exclue'));
    expect(bilanChangementDefaut(m.seance.etat().charge, 8).participants).toBe(11);
  });

  test('notes jamais interprétées : « <b>x</b> & =1+1 » s’affiche tel quel dans la grille et sur la fiche, sans élément <b>', async () => {
    const m = await evenementOuvert();
    const notes = '<b>x</b> & =1+1';
    await m.seance.executer('ajouterParticipant', { champs: { nom: 'Ombrelle', notes } });
    await rendu();
    const id = idDe(m, 'Ombrelle');
    expect(cellule(m, id, 'notes').textContent.trim()).toBe(notes);
    m.ui.ouvrirFiche(id);
    await rendu();
    expect(valeurDeFiche(m, 'participants.colonne.notes').textContent).toBe(notes);
    expect(section(m).querySelectorAll('b')).toHaveLength(0);
  });

  test('titre pressenti : visible dans la grille et sur la fiche', async () => {
    const m = await evenementOuvert({ personnes: [{ nom: 'Pervenche', prenom: 'Théo', titre: 'hôtesse' }] });
    const id = idDe(m, 'Pervenche');
    expect(cellule(m, id, 'titrePressenti').textContent.trim()).toBe('hôtesse');
    cellule(m, id, 'titrePressenti').scrollIntoView({ block: 'center', inline: 'center' });
    expect(visible(cellule(m, id, 'titrePressenti'))).toBe(true);
    m.ui.ouvrirFiche(id);
    await rendu();
    const valeur = valeurDeFiche(m, 'participants.colonne.titrePressenti');
    expect(valeur.textContent).toBe('hôtesse');
    expect(visible(valeur)).toBe(true);
  });

  test('supprimer sans réservation : aucune fenêtre, une entrée ; avec réservations, la fenêtre les nomme, et Annuler ne détruit rien', async () => {
    const m = await evenementOuvert({ tables: 1, personnes: [{ nom: 'Ombrelle' }, { nom: 'Pervenche' }] });
    const iris = idDe(m, 'Ombrelle');
    const theo = idDe(m, 'Pervenche');
    const table = m.seance.etat().charge.tables[0];
    await m.seance.executer('reserver', { participant: theo, table: table.id, siege: 2, portee: 'tous', tour: null });
    await rendu();
    const avant = entrees(m).length;

    await cliquer(commandeDeLigne(m, iris, 'supprimerParticipant'));
    await attendreSeance(m);
    aucuneFenetre();
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(participants(m).map((p) => p.id)).toEqual([theo]);

    await cliquer(commandeDeLigne(m, theo, 'supprimerParticipant'));
    const fenetre = document.querySelector('dialog[open]');
    expect(fenetre).not.toBeNull();
    const elements = [...fenetre.querySelectorAll('li')].map((li) => li.textContent);
    expect(elements).toEqual([
      t('participants.suppression.reservation', { numero: table.numero, siege: 2, portee: 'tous', tour: null }),
    ]);
    await cliquer(fenetre.querySelector('[data-commande="renoncer"]'));
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(participants(m).map((p) => p.id)).toEqual([theo]);

    await cliquer(commandeDeLigne(m, theo, 'supprimerParticipant'));
    await cliquer(document.querySelector('dialog[open] [data-commande="confirmer"]'));
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 2);
    expect(participants(m)).toEqual([]);
  });
});

describe('la présence par tour dans la grille (§ 7.3, § 10.2)', () => {
  const QUATRE = [{ nom: 'Ombrelle', prenom: 'Iris' }, { nom: 'Pervenche', prenom: 'Théo' }, { nom: 'Lacasse', prenom: 'Ondine' }, { nom: 'Grisaille' }];

  const editeurDe = (m, id) => cellule(m, id, 'presence').querySelector('[data-editeur-presence]');
  const casesDe = (m, id) => [...cellule(m, id, 'presence').querySelectorAll('[data-presence-tour]')];
  const coches = (m, id) => casesDe(m, id).map((c) => c.checked);
  const presenceDe = (m, id) => participants(m).find((p) => p.id === id).presence;
  const affichee = (m, id) => cellule(m, id, 'presence').querySelector('[data-presence]');

  // Ouvre les cases de la personne par Entrée sur sa cellule.
  async function ouvrir(m, id) {
    cellule(m, id, 'presence').focus();
    await touche('Enter');
    await rendu();
    expect(editeurDe(m, id)).not.toBeNull();
  }

  test('au repos, « tous » en texte secondaire ; au clavier, Entrée ouvre une case par tour, le focus sur la case du tour 1, chacune nommée « Tour r », dans un groupe nommé par la personne', async () => {
    const m = await evenementOuvert({ tours: 4, personnes: QUATRE });
    const id = idDe(m, 'Lacasse');
    expect(COLONNES.indexOf('presence')).toBe(COLONNES.indexOf('exclu') + 1);
    expect(section(m).querySelector(`[data-commande="trier"][data-cible="presence"]`).textContent).toContain(t('participants.colonne.presence'));
    expect(affichee(m, id).dataset.presence).toBe('tous');
    expect(affichee(m, id).textContent.trim()).toBe(t('participants.presence.tous'));
    expect(composantes(getComputedStyle(affichee(m, id)).color)).toEqual(jeton('--couleur-page-texte-secondaire'));

    await ouvrir(m, id);
    const editeur = editeurDe(m, id);
    expect(editeur.getAttribute('role')).toBe('group');
    expect(editeur.getAttribute('aria-label')).toBe(t('participants.presence.editeur', { nom: 'Ondine Lacasse' }));
    expect(editeur.getAttribute('aria-label')).toBe('Présence de Ondine Lacasse, une case par tour');
    const cases = casesDe(m, id);
    expect(cases.map((c) => c.type)).toEqual(['checkbox', 'checkbox', 'checkbox', 'checkbox']);
    expect(cases.map((c) => c.getAttribute('aria-label'))).toEqual(['Tour 1', 'Tour 2', 'Tour 3', 'Tour 4']);
    expect(coches(m, id)).toEqual([true, true, true, true]);
    expect(document.activeElement).toBe(cases[0]);
    expect(cases.map((c) => c.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  test('→ et Fin, ← et Début passent d’une case à l’autre sans boucler ; l’espace coche et décoche sans rien écrire ; Entrée écrit une entrée, et la cellule dit « tours 1 et 2 »', async () => {
    const m = await evenementOuvert({ tours: 4, personnes: QUATRE });
    const id = idDe(m, 'Lacasse');
    const avant = entrees(m).length;
    const trace = m.trace.length;
    await ouvrir(m, id);
    const cases = casesDe(m, id);
    const parcours = [];
    for (const cle of ['ArrowRight', 'End', 'ArrowRight', 'ArrowLeft', 'Home', 'ArrowLeft']) {
      await touche(cle);
      await rendu();
      parcours.push(cases.indexOf(document.activeElement) + 1);
    }
    expect(parcours).toEqual([2, 4, 4, 3, 1, 1]);
    // La case active seule est dans l'ordre de tabulation.
    expect(cases.map((c) => c.tabIndex)).toEqual([0, -1, -1, -1]);
    // Les cases ouvertes sans bascule ne tiennent aucun geste.
    expect(m.seance.gesteEnCours).toBe(false);
    await touche('End');
    await touche(' ');
    await rendu();
    expect(cases.map((c) => c.tabIndex)).toEqual([-1, -1, -1, 0]);
    // Une bascule non validée est un geste ouvert.
    expect(m.seance.gesteEnCours).toBe(true);
    await touche('ArrowLeft');
    await touche(' ');
    await rendu();
    expect(coches(m, id)).toEqual([true, true, false, false]);
    await attendreSeance(m);
    expect(m.trace.length).toBe(trace);

    await touche('Enter');
    await attendreSeance(m);
    expect(m.seance.gesteEnCours).toBe(false);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(presenceDe(m, id)).toEqual([1, 2]);
    expect(editeurDe(m, id)).toBeNull();
    expect(affichee(m, id).dataset.presence).toBe('partielle');
    expect(affichee(m, id).textContent.trim()).toBe('tours 1 et 2');
    expect(affichee(m, id).querySelector('svg')).not.toBeNull();
    expect(document.activeElement).toBe(cellule(m, id, 'presence'));
  });

  test('Échap rend la présence enregistrée sans rien écrire ; décocher puis recocher, puis Entrée, n’exécute rien', async () => {
    const m = await evenementOuvert({ tours: 3, personnes: QUATRE });
    const id = idDe(m, 'Ombrelle');
    await m.seance.executer('changerPresence', { id, tours: [1, 2] });
    await attendreSeance(m);
    const avant = entrees(m).length;
    const trace = m.trace.length;

    await ouvrir(m, id);
    expect(coches(m, id)).toEqual([true, true, false]);
    await touche(' ');
    await touche('End');
    await touche(' ');
    await rendu();
    expect(coches(m, id)).toEqual([false, true, true]);
    expect(m.seance.gesteEnCours).toBe(true);
    await touche('Escape');
    await attendreSeance(m);
    expect(m.seance.gesteEnCours).toBe(false);
    expect(editeurDe(m, id)).toBeNull();
    expect(affichee(m, id).textContent.trim()).toBe('tours 1 et 2');
    expect(document.activeElement).toBe(cellule(m, id, 'presence'));
    expect(presenceDe(m, id)).toEqual([1, 2]);

    const executer = vi.spyOn(m.seance, 'executer');
    await ouvrir(m, id);
    expect(coches(m, id)).toEqual([true, true, false]);
    await touche('ArrowRight');
    await touche(' ');
    await touche(' ');
    await rendu();
    expect(coches(m, id)).toEqual([true, true, false]);
    await touche('Enter');
    await attendreSeance(m);
    expect(executer).not.toHaveBeenCalled();
    expect(editeurDe(m, id)).toBeNull();
    expect(entrees(m)).toHaveLength(avant);
    expect(m.trace.length).toBe(trace);
  });

  test('une seule entrée par Tab : Tab valide une fois, puis mène aux notes ; la sortie du groupe qui suit ne valide pas de nouveau', async () => {
    const m = await evenementOuvert({ tours: 3, personnes: QUATRE });
    const id = idDe(m, 'Pervenche');
    const avant = entrees(m).length;
    await ouvrir(m, id);
    await touche(' ');
    await rendu();
    const executer = vi.spyOn(m.seance, 'executer');
    await touche('Tab');
    await attendreSeance(m);
    await attendreSeance(m);
    expect(executer).toHaveBeenCalledTimes(1);
    expect(executer).toHaveBeenCalledWith('changerPresence', { id, tours: [2, 3] });
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(presenceDe(m, id)).toEqual([2, 3]);
    expect(editeurDe(m, id)).toBeNull();
    expect(document.activeElement).toBe(cellule(m, id, 'notes'));
    expect(affichee(m, id).textContent.trim()).toBe('tours 2 et 3');
  });

  test('une sortie à la souris valide : un clic sur une autre case du groupe n’écrit rien, un clic hors du groupe écrit une entrée', async () => {
    const m = await evenementOuvert({ tours: 3, personnes: QUATRE });
    const id = idDe(m, 'Grisaille');
    const avant = entrees(m).length;
    await ouvrir(m, id);
    const executer = vi.spyOn(m.seance, 'executer');
    await cliquer(casesDe(m, id)[1]);
    await attendreSeance(m);
    expect(coches(m, id)).toEqual([true, false, true]);
    expect(document.activeElement).toBe(casesDe(m, id)[1]);
    expect(executer).not.toHaveBeenCalled();
    await cliquer(section(m).querySelector('[data-champ="filtre"]'));
    await attendreSeance(m);
    expect(executer).toHaveBeenCalledTimes(1);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(presenceDe(m, id)).toEqual([1, 3]);
    expect(editeurDe(m, id)).toBeNull();
    expect(affichee(m, id).textContent.trim()).toBe('tours 1 et 3');
  });

  test('tout décoché puis Entrée : PRESENCE_VIDE dans la cellule, sans remède ; les cases restent, décochées, marquées et décrites par le refus ; rien ne s’écrit', async () => {
    const m = await evenementOuvert({ tours: 2, personnes: QUATRE });
    const id = idDe(m, 'Lacasse');
    const avant = entrees(m).length;
    await ouvrir(m, id);
    await touche(' ');
    await touche('ArrowRight');
    await touche(' ');
    await rendu();
    await touche('Enter');
    await attendreSeance(m);
    await rendu();
    const refus = cellule(m, id, 'presence').querySelector('[data-refus="PRESENCE_VIDE"]');
    expect(refus).not.toBeNull();
    expect(refus.querySelector('button')).toBeNull();
    expect(editeurDe(m, id)).not.toBeNull();
    expect(coches(m, id)).toEqual([false, false]);
    for (const c of casesDe(m, id)) expect(c.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(editeurDe(m, id).getAttribute('aria-describedby'))).toBe(refus);
    for (const c of casesDe(m, id)) expect(document.getElementById(c.getAttribute('aria-describedby'))).toBe(refus);
    // Les cases rouvertes rendent le focus à la case active, la première.
    expect(document.activeElement).toBe(casesDe(m, id)[0]);
    expect(entrees(m)).toHaveLength(avant);
    expect(presenceDe(m, id)).toBeUndefined();
    // Recocher un tour retire le refus ; Entrée écrit.
    await touche('End');
    await touche(' ');
    await rendu();
    expect(cellule(m, id, 'presence').querySelector('[data-refus]')).toBeNull();
    await touche('Enter');
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(presenceDe(m, id)).toEqual([2]);
  });

  test('en lecture : Entrée sur la cellule pose le refus de la séance et son remède, sans ouvrir les cases ; rien ne s’écrit', async () => {
    const m = await evenementOuvert({ tours: 3, personnes: QUATRE });
    await m.seance.passerEnLecture();
    await rendu();
    const id = idDe(m, 'Ombrelle');
    const trace = m.trace.length;
    cellule(m, id, 'presence').focus();
    await touche('Enter');
    await rendu();
    expect(editeurDe(m, id)).toBeNull();
    const refus = cellule(m, id, 'presence').querySelector('[data-refus]');
    expect(refus).not.toBeNull();
    expect(refus.dataset.refus).toBe(m.seance.etat().refus.code);
    expect(refus.querySelector('button')).not.toBeNull();
    expect(document.activeElement).toBe(cellule(m, id, 'presence'));
    expect(m.trace.length).toBe(trace);
  });

  test('le tri sur « Présence » : « tous » en tête en croissant, puis par tours ; l’inverse en décroissant ; rien ne s’écrit', async () => {
    const m = await evenementOuvert({ tours: 3, personnes: QUATRE });
    await m.seance.executer('changerPresence', { id: idDe(m, 'Ombrelle'), tours: [2] });
    await m.seance.executer('changerPresence', { id: idDe(m, 'Lacasse'), tours: [1, 3] });
    await attendreSeance(m);
    const trace = m.trace.length;
    const trier = section(m).querySelector('[data-commande="trier"][data-cible="presence"]');
    await cliquer(trier);
    const croissant = ['Pervenche', 'Grisaille', 'Lacasse', 'Ombrelle'].map((nom) => idDe(m, nom));
    expect(idsAffiches(m)).toEqual(croissant);
    expect(trier.closest('th').getAttribute('aria-sort')).toBe('ascending');
    await cliquer(trier);
    expect(idsAffiches(m)).toEqual(['Ombrelle', 'Lacasse', 'Pervenche', 'Grisaille'].map((nom) => idDe(m, nom)));
    expect(trier.closest('th').getAttribute('aria-sort')).toBe('descending');
    expect(m.trace.length).toBe(trace);
  });
});

describe("les conflits d'organisation dans la grille (§ 4, § 10.2)", () => {
  // Quatre personnes, trois organisations ; Grisaille n'en porte aucune.
  const QUATRE = [
    { nom: 'Ombrelle', prenom: 'Iris', organisation: CLUB },
    { nom: 'Pervenche', prenom: 'Théo', organisation: 'Atelier Ressac' },
    { nom: 'Lacasse', prenom: 'Ondine', organisation: 'cercle des Hérons' },
    { nom: 'Grisaille' },
  ];

  const editeurDe = (m, id) => cellule(m, id, 'conflits').querySelector('[data-editeur-choix]');
  const casesDe = (m, id) => [...cellule(m, id, 'conflits').querySelectorAll('[data-choix]')];
  const nomsDe = (m, id) => casesDe(m, id).map((c) => c.closest('label').textContent.trim());
  const coches = (m, id) => casesDe(m, id).map((c) => c.checked);
  const conflitsDe = (m, id) => participants(m).find((p) => p.id === id).conflits;
  const pastilles = (m, id) => [...cellule(m, id, 'conflits').querySelectorAll('[data-conflits-personne] li')].map((li) => li.textContent.trim());

  async function ouvrir(m, id) {
    cellule(m, id, 'conflits').focus();
    await touche('Enter');
    await rendu();
  }

  test("la colonne « Conflit d'organisation » suit l'organisation ; au repos, une pastille par organisation nommée, vide sans conflit", async () => {
    const m = await evenementOuvert({ personnes: QUATRE });
    await m.seance.executer('ajouterConflit', { id: idDe(m, 'Grisaille'), organisation: 'Atelier Ressac' });
    await m.seance.executer('ajouterConflit', { id: idDe(m, 'Grisaille'), organisation: CLUB });
    await attendreSeance(m);
    expect(COLONNES.indexOf('conflits')).toBe(COLONNES.indexOf('organisation') + 1);
    const entetes = [...grille(m).querySelectorAll('[data-commande="trier"]')].map((b) => b.dataset.cible);
    expect(entetes.indexOf('conflits')).toBe(entetes.indexOf('organisation') + 1);
    expect(section(m).querySelector('[data-commande="trier"][data-cible="conflits"]').textContent).toContain("Conflit d'organisation");
    expect(pastilles(m, idDe(m, 'Grisaille'))).toEqual(['Atelier Ressac', CLUB]);
    expect(cellule(m, idDe(m, 'Grisaille'), 'conflits').querySelector('svg')).not.toBeNull();
    expect(cellule(m, idDe(m, 'Ombrelle'), 'conflits').textContent.trim()).toBe('');
  });

  test('Entrée ouvre une case par organisation de l’événement hors la sienne, rangée, nommée par l’organisation, dans un groupe nommé par la personne ; le focus sur la première', async () => {
    const m = await evenementOuvert({ personnes: QUATRE });
    const id = idDe(m, 'Ombrelle');
    await ouvrir(m, id);
    const editeur = editeurDe(m, id);
    expect(editeur).not.toBeNull();
    expect(editeur.getAttribute('role')).toBe('group');
    expect(editeur.getAttribute('aria-label')).toBe("Conflits d'organisation de Iris Ombrelle, une case par organisation");
    expect(nomsDe(m, id)).toEqual(['Atelier Ressac', 'cercle des Hérons']);
    expect(casesDe(m, id).map((c) => c.type)).toEqual(['checkbox', 'checkbox']);
    expect(coches(m, id)).toEqual([false, false]);
    expect(document.activeElement).toBe(casesDe(m, id)[0]);
    expect(casesDe(m, id).map((c) => c.tabIndex)).toEqual([0, -1]);
  });

  test('→, Fin, ← et Début passent d’une case à l’autre sans boucler ; l’espace coche sans rien écrire ; Entrée écrit le geste entier en une entrée, qu’un seul Défaire reprend, et rend le focus à la cellule', async () => {
    const m = await evenementOuvert({ personnes: QUATRE });
    const id = idDe(m, 'Grisaille');
    const avant = entrees(m).length;
    const trace = m.trace.length;
    await ouvrir(m, id);
    const cases = casesDe(m, id);
    expect(nomsDe(m, id)).toEqual(['Atelier Ressac', 'cercle des Hérons', CLUB]);
    const parcours = [];
    for (const cle of ['ArrowRight', 'End', 'ArrowRight', 'ArrowLeft', 'Home', 'ArrowLeft']) {
      await touche(cle);
      await rendu();
      parcours.push(cases.indexOf(document.activeElement) + 1);
    }
    expect(parcours).toEqual([2, 3, 3, 2, 1, 1]);
    expect(m.seance.gesteEnCours).toBe(false);
    await touche(' ');
    await touche('End');
    await touche(' ');
    await rendu();
    expect(coches(m, id)).toEqual([true, false, true]);
    expect(m.seance.gesteEnCours).toBe(true);
    await attendreSeance(m);
    expect(m.trace.length).toBe(trace);

    await touche('Enter');
    await attendreSeance(m);
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(entrees(m).at(-1).libelle).toBe(`Conflits de Grisaille : ajouté « Atelier Ressac » et « ${CLUB} »`);
    expect(conflitsDe(m, id)).toEqual(['Atelier Ressac', CLUB]);
    expect(editeurDe(m, id)).toBeNull();
    expect(pastilles(m, id)).toEqual(['Atelier Ressac', CLUB]);
    expect(document.activeElement).toBe(cellule(m, id, 'conflits'));
    expect(m.seance.gesteEnCours).toBe(false);
    await m.seance.defaire();
    await attendreSeance(m);
    expect(conflitsDe(m, id)).toBeUndefined();
    expect(pastilles(m, id)).toEqual([]);
  });

  test('Échap rend la liste enregistrée sans rien écrire ; cocher puis décocher, puis Entrée, n’exécute rien ; Tab valide une fois et mène aux conflits du placement', async () => {
    const m = await evenementOuvert({ personnes: QUATRE });
    const id = idDe(m, 'Pervenche');
    await m.seance.executer('ajouterConflit', { id, organisation: CLUB });
    await attendreSeance(m);
    const avant = entrees(m).length;
    const executer = vi.spyOn(m.seance, 'executer');

    await ouvrir(m, id);
    expect(coches(m, id)).toEqual([false, true]);
    await touche(' ');
    await rendu();
    expect(coches(m, id)).toEqual([true, true]);
    await touche('Escape');
    await attendreSeance(m);
    expect(editeurDe(m, id)).toBeNull();
    expect(document.activeElement).toBe(cellule(m, id, 'conflits'));
    expect(conflitsDe(m, id)).toEqual([CLUB]);

    await ouvrir(m, id);
    await touche(' ');
    await touche(' ');
    await touche('Enter');
    await attendreSeance(m);
    expect(executer).not.toHaveBeenCalled();
    expect(entrees(m)).toHaveLength(avant);

    await ouvrir(m, id);
    await touche('End');
    await touche(' ');
    await rendu();
    await touche('Tab');
    await attendreSeance(m);
    await attendreSeance(m);
    expect(executer).toHaveBeenCalledTimes(1);
    expect(executer).toHaveBeenCalledWith('changerConflits', { id, organisations: [] });
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(conflitsDe(m, id)).toBeUndefined();
    // La cellule voisine, en lecture seule, prend le focus.
    expect(document.activeElement).toBe(cellule(m, id, 'conflitsPlacement'));
  });

  test('sans autre organisation, le groupe le dit et prend le focus ; Échap le referme', async () => {
    const m = await evenementOuvert({ personnes: [{ nom: 'Ombrelle', organisation: CLUB }, { nom: 'Pervenche', organisation: CLUB }] });
    const id = idDe(m, 'Ombrelle');
    await ouvrir(m, id);
    const editeur = editeurDe(m, id);
    expect(casesDe(m, id)).toEqual([]);
    expect(editeur.textContent.trim()).toBe(t('participants.conflits.aucuneAutre'));
    expect(document.activeElement).toBe(editeur);
    await touche('Escape');
    await rendu();
    expect(editeurDe(m, id)).toBeNull();
    expect(document.activeElement).toBe(cellule(m, id, 'conflits'));
  });

  test('une commande refusée pose son refus dans la cellule, la saisie gardée, les cases marquées et décrites ; en lecture, Entrée pose le refus de la séance sans ouvrir les cases', async () => {
    const m = await evenementOuvert({ personnes: QUATRE });
    const id = idDe(m, 'Lacasse');
    const trace = m.trace.length;
    // La séance refuse la commande comme sur un plan bloqué.
    vi.spyOn(m.seance, 'executer').mockImplementation(() =>
      Promise.reject(Object.assign(new Error('PLAN_BLOQUE'), { code: 'PLAN_BLOQUE', details: { remede: { geste: 'debloquer' } } })),
    );
    await ouvrir(m, id);
    await touche(' ');
    await touche('Enter');
    await attendreSeance(m);
    const refus = cellule(m, id, 'conflits').querySelector('[data-refus="PLAN_BLOQUE"]');
    expect(refus).not.toBeNull();
    expect(editeurDe(m, id)).not.toBeNull();
    expect(coches(m, id)).toEqual([true, false]);
    for (const c of casesDe(m, id)) expect(c.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(editeurDe(m, id).getAttribute('aria-describedby'))).toBe(refus);
    expect(m.trace.length).toBe(trace);
    await touche('Escape');
    await rendu();
    vi.restoreAllMocks();

    await m.seance.passerEnLecture();
    await rendu();
    const autre = idDe(m, 'Ombrelle');
    cellule(m, autre, 'conflits').focus();
    await touche('Enter');
    await rendu();
    expect(editeurDe(m, autre)).toBeNull();
    const refusSeance = cellule(m, autre, 'conflits').querySelector('[data-refus]');
    expect(refusSeance.dataset.refus).toBe(m.seance.etat().refus.code);
    expect(refusSeance.querySelector('button')).not.toBeNull();
  });
});

describe('les inclusions dans la grille (§ 4, § 10.2)', () => {
  // Quatre personnes, trois organisations ; Grisaille n'en porte aucune,
  // Lacasse est exclue.
  const QUATRE = [
    { nom: 'Ombrelle', prenom: 'Iris', organisation: CLUB },
    { nom: 'Pervenche', prenom: 'Théo', organisation: 'Atelier Ressac' },
    { nom: 'Lacasse', prenom: 'Ondine', organisation: 'cercle des Hérons', exclu: true },
    { nom: 'Grisaille' },
  ];

  const editeurDe = (m, id) => cellule(m, id, 'inclusions').querySelector('[data-editeur-inclusions]');
  const groupes = (m, id) => [...cellule(m, id, 'inclusions').querySelectorAll('[data-editeur-choix]')];
  const casesDe = (groupe) => [...groupe.querySelectorAll('[data-choix]')];
  const nomsDe = (groupe) => casesDe(groupe).map((c) => c.closest('label').textContent.trim());
  const coches = (groupe) => casesDe(groupe).map((c) => c.checked);
  const recherche = (m, id) => cellule(m, id, 'inclusions').querySelector('[data-recherche-choix]');
  const personneDe = (m, id) => participants(m).find((p) => p.id === id);
  const affichees = (m, id) => [...cellule(m, id, 'inclusions').querySelectorAll('[data-inclusions-personne] li')].map((li) => li.textContent.trim());

  const bascule = (m) => section(m).querySelector('[data-champ="montrerInclusions"]');

  // Un événement des quatre personnes, la colonne des inclusions montrée.
  async function ouvert() {
    const m = await evenementOuvert({ personnes: QUATRE });
    await cliquer(bascule(m));
    return m;
  }

  async function ouvrir(m, id) {
    cellule(m, id, 'inclusions').focus();
    await touche('Enter');
    await rendu();
  }

  test('masquée par défaut ; la case « Montrer les inclusions » la montre et la masque sans rien écrire, et masquée, son tri tombe ; la cellule active garde sa colonne', async () => {
    const m = await evenementOuvert({ personnes: QUATRE });
    const trace = m.trace.length;
    const active = () => grille(m).querySelector('td[tabindex="0"]');
    expect(bascule(m).checked).toBe(false);
    expect(bascule(m).closest('label').textContent.trim()).toBe(t('participants.grille.montrerInclusions'));
    expect(grille(m).querySelector('[data-champ="inclusions"]')).toBeNull();
    expect(grille(m).querySelector('[data-champ="inclusionsPlacement"]')).toBeNull();
    expect(grille(m).tHead.rows[0].cells).toHaveLength(COLONNES.length - MASQUABLES.length + 1);
    const id = idDe(m, 'Pervenche');
    cellule(m, id, 'courriel').focus();
    await rendu();
    await cliquer(bascule(m));
    expect(grille(m).tHead.rows[0].cells).toHaveLength(COLONNES.length + 1);
    for (const colonne of MASQUABLES) {
      expect(lignes(m).every((rangee) => rangee.querySelector(`[data-champ="${colonne}"]`) !== null)).toBe(true);
    }
    // Montrer une colonne devant la cellule active ne la déplace pas ; masquer
    // la colonne active la cède à sa voisine, et la remontrer la rend.
    expect(active()).toBe(cellule(m, id, 'courriel'));
    cellule(m, id, 'inclusions').focus();
    await rendu();
    await cliquer(bascule(m));
    expect(active()).toBe(cellule(m, id, 'courriel'));
    await cliquer(bascule(m));
    expect(active()).toBe(cellule(m, id, 'inclusions'));
    await cliquer(section(m).querySelector('[data-commande="trier"][data-cible="inclusions"]'));
    expect(section(m).querySelector('[data-cible="inclusions"]').closest('th').getAttribute('aria-sort')).toBe('ascending');
    await cliquer(bascule(m));
    expect(grille(m).querySelector('[data-champ="inclusions"]')).toBeNull();
    expect([...grille(m).tHead.rows[0].cells].some((th) => th.getAttribute('aria-sort') !== 'none' && th.hasAttribute('aria-sort'))).toBe(false);
    expect(m.trace.length).toBe(trace);
  });

  test('la colonne « Inclusions » suit les conflits du placement ; au repos, une pastille par organisation incluse, puis chaque personne incluse, « (exclue) » comprise ; vide sans inclusion', async () => {
    const m = await ouvert();
    const id = idDe(m, 'Grisaille');
    await m.seance.executer('changerInclusionsOrganisation', { id, organisations: ['Atelier Ressac', CLUB] });
    await m.seance.executer('changerInclusionsParticipant', { id, participants: [idDe(m, 'Lacasse'), idDe(m, 'Ombrelle')] });
    await attendreSeance(m);
    expect(COLONNES.indexOf('inclusions')).toBe(COLONNES.indexOf('conflitsPlacement') + 1);
    const entete = section(m).querySelector('[data-commande="trier"][data-cible="inclusions"]');
    expect(entete.textContent).toContain(t('participants.colonne.inclusions'));
    expect(affichees(m, id)).toEqual(['Atelier Ressac', CLUB, 'Iris Ombrelle', 'Ondine Lacasse (exclue)']);
    expect(cellule(m, id, 'inclusions').querySelectorAll('[data-inclusion-organisation] svg')).toHaveLength(2);
    expect(cellule(m, id, 'inclusions').querySelectorAll('[data-inclusion-participant]')).toHaveLength(2);
    expect(cellule(m, idDe(m, 'Ombrelle'), 'inclusions').textContent.trim()).toBe('');
    // Le tri par le nombre de lignes : Grisaille, la seule à en porter, en
    // tête dans les deux sens.
    await cliquer(entete);
    expect(idsAffiches(m)[0]).toBe(id);
    await cliquer(entete);
    expect(idsAffiches(m)[0]).toBe(id);
  });

  test('Entrée ouvre deux groupes : les organisations hors la sienne, puis les personnes hors elle-même sous une recherche ; Tab passe d’un contrôle à l’autre ; Entrée écrit les deux listes en une entrée, que Défaire reprend d’un coup', async () => {
    const m = await ouvert();
    const id = idDe(m, 'Ombrelle');
    const avant = entrees(m).length;
    const trace = m.trace.length;
    await ouvrir(m, id);
    expect(editeurDe(m, id)).not.toBeNull();
    const [organisations, personnes] = groupes(m, id);
    expect(organisations.getAttribute('aria-label')).toBe("Inclusions d'organisation de Iris Ombrelle, une case par organisation");
    expect(personnes.getAttribute('aria-label')).toBe('Inclusions de participant de Iris Ombrelle, une case par personne');
    expect(nomsDe(organisations)).toEqual(['Atelier Ressac', 'cercle des Hérons']);
    expect(nomsDe(personnes)).toEqual(['Grisaille', 'Ondine Lacasse (exclue)', 'Théo Pervenche']);
    expect(document.activeElement).toBe(casesDe(organisations)[0]);

    // Tab : de la case active des organisations à la recherche, puis à la
    // case active des personnes ; Maj+Tab revient.
    await touche('Tab');
    await rendu();
    expect(document.activeElement).toBe(recherche(m, id));
    await touche('Tab');
    await rendu();
    expect(document.activeElement).toBe(casesDe(personnes)[0]);
    await majTab();
    await rendu();
    expect(document.activeElement).toBe(recherche(m, id));
    expect(m.trace.length).toBe(trace);

    // La recherche ne garde que les cases qui la contiennent ; Échap la vide
    // sans refermer l'éditeur.
    await saisir(recherche(m, id), 'theo');
    expect(nomsDe(groupes(m, id)[1])).toEqual(['Théo Pervenche']);
    await saisir(recherche(m, id), 'zéphyr');
    expect(nomsDe(groupes(m, id)[1])).toEqual([]);
    expect(groupes(m, id)[1].querySelector('[data-aucun-choix]').textContent.trim()).toBe(tEcran('participants.inclusions.aucunResultat', { texte: 'zéphyr' }));
    recherche(m, id).focus();
    await touche('Escape');
    await rendu();
    expect(editeurDe(m, id)).not.toBeNull();
    expect(recherche(m, id).value).toBe('');
    expect(nomsDe(groupes(m, id)[1])).toHaveLength(3);

    // L'espace coche sans rien écrire ; Entrée valide.
    await touche('Tab');
    await touche('End');
    await touche(' ');
    await majTab();
    await majTab();
    await touche(' ');
    await rendu();
    expect(coches(groupes(m, id)[0])).toEqual([true, false]);
    expect(coches(groupes(m, id)[1])).toEqual([false, false, true]);
    expect(m.seance.gesteEnCours).toBe(true);
    await attendreSeance(m);
    expect(m.trace.length).toBe(trace);
    await touche('Enter');
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(entrees(m).at(-1).libelle).toBe(
      "Inclusions d'organisation de Iris Ombrelle : ajouté « Atelier Ressac » ; inclusions de participant : ajouté Théo Pervenche",
    );
    expect(personneDe(m, id).inclusionsOrganisation).toEqual(['Atelier Ressac']);
    expect(personneDe(m, id).inclusionsParticipant).toEqual([idDe(m, 'Pervenche')]);
    expect(editeurDe(m, id)).toBeNull();
    expect(affichees(m, id)).toEqual(['Atelier Ressac', 'Théo Pervenche']);
    expect(document.activeElement).toBe(cellule(m, id, 'inclusions'));
    expect(m.seance.gesteEnCours).toBe(false);
    await m.seance.defaire();
    await attendreSeance(m);
    expect(personneDe(m, id).inclusionsParticipant).toBeUndefined();
    expect(personneDe(m, id).inclusionsOrganisation).toBeUndefined();
    expect(affichees(m, id)).toEqual([]);
  });

  test('une seule liste changée : la commande ne porte qu’elle ; Échap rend la saisie sans rien écrire ; Tab depuis le dernier contrôle valide une fois et mène à la cellule voisine', async () => {
    const m = await ouvert();
    const id = idDe(m, 'Pervenche');
    await m.seance.executer('changerInclusionsOrganisation', { id, organisations: [CLUB] });
    await attendreSeance(m);
    const avant = entrees(m).length;
    const executer = vi.spyOn(m.seance, 'executer');

    await ouvrir(m, id);
    expect(nomsDe(groupes(m, id)[0])).toEqual(['cercle des Hérons', CLUB]);
    expect(coches(groupes(m, id)[0])).toEqual([false, true]);
    await touche(' ');
    await touche('Escape');
    await attendreSeance(m);
    expect(editeurDe(m, id)).toBeNull();
    expect(document.activeElement).toBe(cellule(m, id, 'inclusions'));
    expect(personneDe(m, id).inclusionsOrganisation).toEqual([CLUB]);
    expect(executer).not.toHaveBeenCalled();

    await ouvrir(m, id);
    await touche('Tab');
    await touche('Tab');
    await touche(' ');
    await rendu();
    expect(coches(groupes(m, id)[1])).toEqual([true, false, false]);
    await touche('Tab');
    await attendreSeance(m);
    await attendreSeance(m);
    expect(executer).toHaveBeenCalledTimes(1);
    expect(executer).toHaveBeenCalledWith('changerInclusions', { id, participants: [idDe(m, 'Grisaille')] });
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(document.activeElement).toBe(cellule(m, id, 'inclusionsPlacement'));
  });

  test('montrée à 1366 et 1024 de large : la page ne défile pas, la grille défile au besoin dans son conteneur, sans quitter la carte, et chaque inclusion tient dans sa cellule', async () => {
    const avant = { largeur: innerWidth, hauteur: innerHeight };
    try {
      for (const largeur of [1366, 1024]) {
        await fixerCadre(largeur, 700);
        const m = await ouvert();
        const id = idDe(m, 'Grisaille');
        await m.seance.executer('changerInclusionsOrganisation', { id, organisations: ['Atelier Ressac', 'cercle des Hérons', CLUB] });
        await m.seance.executer('changerInclusionsParticipant', { id, participants: [idDe(m, 'Lacasse'), idDe(m, 'Ombrelle'), idDe(m, 'Pervenche')] });
        await attendreSeance(m);
        expect(document.documentElement.scrollWidth, `${largeur}`).toBeLessThanOrEqual(innerWidth);
        const defilement = grille(m).parentElement;
        const carteDe = section(m).querySelector('section[aria-labelledby]');
        expect(defilement.getBoundingClientRect().right, `${largeur}`).toBeLessThanOrEqual(carteDe.getBoundingClientRect().right);
        const inclus = cellule(m, id, 'inclusions');
        expect(inclus.querySelectorAll('[data-inclusions-personne] li')).toHaveLength(6);
        for (const li of inclus.querySelectorAll('li')) {
          expect(li.getBoundingClientRect().right, `${largeur} ${li.textContent}`).toBeLessThanOrEqual(inclus.getBoundingClientRect().right + 0.5);
        }
        m.demonter();
        montes.splice(montes.indexOf(m), 1);
      }
    } finally {
      await fixerCadre(avant.largeur, avant.hauteur);
    }
  });

  test('un refus dans la cellule, la saisie gardée, les deux groupes marqués ; masquer la colonne l’abandonne, geste libéré ; en lecture, Entrée pose le refus de la séance', async () => {
    const m = await ouvert();
    const id = idDe(m, 'Grisaille');
    const trace = m.trace.length;
    vi.spyOn(m.seance, 'executer').mockImplementation(() =>
      Promise.reject(Object.assign(new Error('PLAN_BLOQUE'), { code: 'PLAN_BLOQUE', details: { remede: { geste: 'debloquer' } } })),
    );
    await ouvrir(m, id);
    await touche(' ');
    await touche('Enter');
    await attendreSeance(m);
    const refus = cellule(m, id, 'inclusions').querySelector('[data-refus="PLAN_BLOQUE"]');
    expect(refus).not.toBeNull();
    expect(editeurDe(m, id)).not.toBeNull();
    expect(coches(groupes(m, id)[0])).toEqual([true, false, false]);
    for (const groupe of groupes(m, id)) {
      expect(document.getElementById(groupe.getAttribute('aria-describedby'))).toBe(refus);
      for (const c of casesDe(groupe)) expect(c.getAttribute('aria-invalid')).toBe('true');
    }
    expect(m.trace.length).toBe(trace);
    // La colonne masquée pendant le refus emporte l'éditeur : la saisie
    // s'abandonne, le geste se libère, rien ne s'écrit ; remontrée, la
    // cellule est au repos. Le clic passe par click(), sans pointeur : le
    // focus reste dans l'éditeur, que la case masque alors qu'il est ouvert.
    expect(m.seance.gesteEnCours).toBe(true);
    bascule(m).click();
    await rendu();
    await attendreSeance(m);
    expect(grille(m).querySelector('[data-champ="inclusions"]')).toBeNull();
    expect(m.seance.gesteEnCours).toBe(false);
    expect(m.trace.length).toBe(trace);
    await cliquer(bascule(m));
    expect(editeurDe(m, id)).toBeNull();
    expect(cellule(m, id, 'inclusions').querySelector('[data-refus]')).toBeNull();
    expect(personneDe(m, id).inclusionsOrganisation).toBeUndefined();
    vi.restoreAllMocks();

    await m.seance.passerEnLecture();
    await rendu();
    const autre = idDe(m, 'Ombrelle');
    cellule(m, autre, 'inclusions').focus();
    await touche('Enter');
    await rendu();
    expect(editeurDe(m, autre)).toBeNull();
    const refusSeance = cellule(m, autre, 'inclusions').querySelector('[data-refus]');
    expect(refusSeance.dataset.refus).toBe(m.seance.etat().refus.code);
  });
});

describe('le manque de places (§ 5.9, § 4.4)', () => {
  test('deux tables de 8 et seize personnes : la dix-septième est acceptée, une entrée, et avertit PLACES_MANQUANTES de 1', async () => {
    const m = await evenementOuvert({ tables: 2, personnes: NOMS.slice(0, 16).map((nom) => ({ nom })) });
    const executer = vi.spyOn(m.seance, 'executer');
    const avant = entrees(m).length;
    await ajouter(m, { nom: NOMS[16] });
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(participants(m)).toHaveLength(17);
    expect(executer).toHaveBeenCalledTimes(1);
    expect(executer.mock.calls[0][0]).toBe('ajouterParticipant');
    const rendus = await executer.mock.results[0].value;
    const attendu = nombrePlacesManquantes(normaliser(configurationDepuisCharge(m.seance.etat().charge)));
    expect(attendu).toBe(1);
    const manque = rendus.avertissements.find(({ code }) => code === 'PLACES_MANQUANTES');
    expect(manque?.details.placesManquantes).toBe(attendu);
    const etat = m.seance.etat().avertissements.find(({ code }) => code === 'PLACES_MANQUANTES');
    expect(etat?.details.placesManquantes).toBe(attendu);
  });

  test('deux tables de 8, dix-sept personnes dont une exclue : la réintégrer est accepté, une entrée, et avertit PLACES_MANQUANTES de 1', async () => {
    const personnes = NOMS.slice(0, 17).map((nom, rang) => ({ nom, exclu: rang === 5 }));
    const m = await evenementOuvert({ tables: 2, personnes });
    const id = idDe(m, NOMS[5]);
    const executer = vi.spyOn(m.seance, 'executer');
    const avant = entrees(m).length;
    await cliquer(commandeDeLigne(m, id, 'reintegrerParticipant'));
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(participants(m).find((p) => p.id === id).exclu).toBe(false);
    expect(executer).toHaveBeenCalledTimes(1);
    expect(executer.mock.calls[0]).toEqual(['reintegrerParticipant', { id }]);
    const rendus = await executer.mock.results[0].value;
    const attendu = nombrePlacesManquantes(normaliser(configurationDepuisCharge(m.seance.etat().charge)));
    expect(attendu).toBe(1);
    expect(rendus.avertissements.find(({ code }) => code === 'PLACES_MANQUANTES')?.details.placesManquantes).toBe(attendu);
    expect(m.seance.etat().avertissements.find(({ code }) => code === 'PLACES_MANQUANTES')?.details.placesManquantes).toBe(
      attendu,
    );
  });
});

describe('la fiche (§ 4.2, § 7.4)', () => {
  test('statuts : A, B, C, D → ancré, ancré, partiellement fixé, mobile, égaux au statut du moteur ; aucun contrôle de saisie de statut', async () => {
    const m = await evenementOuvert({
      sieges: 4,
      tours: 3,
      tables: 2,
      personnes: [
        { nom: 'Ombrelle', prenom: 'Iris' },
        { nom: 'Pervenche', prenom: 'Théo' },
        { nom: 'Lacasse', prenom: 'Ondine' },
        { nom: 'Grisaille' },
      ],
    });
    const [t1, t2] = m.seance.etat().charge.tables.map(({ id }) => id);
    const [a, b, c, d] = ['Ombrelle', 'Pervenche', 'Lacasse', 'Grisaille'].map((nom) => idDe(m, nom));
    const reserver = (participant, table, portee, tour = null) =>
      m.seance.executer('reserver', { participant, table, siege: null, portee, tour });
    await reserver(a, t1, 'tous');
    for (const tour of [1, 2, 3]) await reserver(b, t1, 'tour', tour);
    await reserver(c, t1, 'tour', 1);
    await reserver(c, t2, 'tour', 2);
    await rendu();

    const instance = normaliser(configurationDepuisCharge(m.seance.etat().charge));
    const NOMS_STATUTS = new Map([
      [STATUT.ANCRE, 'ancre'],
      [STATUT.PARTIELLEMENT_FIXE, 'partiel'],
      [STATUT.MOBILE, 'mobile'],
    ]);
    const attendus = [
      [a, 'ancre'],
      [b, 'ancre'],
      [c, 'partiel'],
      [d, 'mobile'],
    ];
    for (const [id, statut] of attendus) {
      expect(NOMS_STATUTS.get(instance.statut[instance.indexDe.get(id)])).toBe(statut);
      m.ui.ouvrirFiche(id);
      await rendu();
      expect(fiche(m).dataset.fiche).toBe(String(id));
      expect(valeurDeFiche(m, 'participants.fiche.statut').textContent).toBe(t(cleDeStatut(statut)));
      // Les seuls contrôles de saisie de la fiche sont le champ des
      // étiquettes, la recherche et les cases des inclusions de participant
      // — sans organisation, aucune case d'organisation —, et les cases de
      // la présence, une par tour.
      const tours = m.seance.etat().charge.evenement.tours;
      const nature = (champ) => {
        if (champ.closest('[data-inclusions-fiche]') !== null) return 'inclusions';
        return champ.dataset.champ ?? `tour ${champ.dataset.presenceTour}`;
      };
      expect([...fiche(m).querySelectorAll('input, select, textarea')].map(nature)).toEqual([
        'etiquettes',
        ...Array.from({ length: participants(m).length }, () => 'inclusions'),
        ...Array.from({ length: tours }, (_, rang) => `tour ${rang + 1}`),
      ]);
    }
  });

  test('ouverte depuis sa ligne, puis par ui.ouvrirFiche : visible ; sur un retenu, son itinéraire égale, tour par tour, la forme nommée', async () => {
    const m = await evenementOuvert({ sieges: 4, tours: 3, tables: 2, personnes: NOMS.slice(0, 7).map((nom) => ({ nom })) });
    await m.seance.executer('modifierReglage', { cle: 'attribuerSieges', valeur: true });
    await m.app.generation().generer({ graine: 1, nombre: 1, arret: 50, historique: 1000 });
    const [proposition] = m.seance.etat().charge.propositions;
    await m.seance.executer('retenirProposition', { id: proposition.id });
    // Une personne quitte sa table au tour 2 : la réserve figure à l'itinéraire.
    await m.seance.executer('retirerDuTour', { tour: 2, participant: idDe(m, NOMS[2]) });
    await rendu();
    const charge = m.seance.etat().charge;
    const forme = formeNommee(charge.retenu, charge);
    expect(forme.some((ligneForme) => ligneForme.reserve)).toBe(true);

    const id = idDe(m, NOMS[2]);
    await cliquer(commandeDeLigne(m, id, 'fiche'));
    expect(m.ui.etat().fiche).toBe(id);
    expect(fiche(m).dataset.fiche).toBe(String(id));
    expect(visible(fiche(m))).toBe(true);
    await cliquer(fiche(m).querySelector('[data-commande="fermerFiche"]'));
    expect(fiche(m)).toBeNull();
    expect(m.ui.etat().section).toBe('participants');

    // Chaque personne : l'itinéraire de la fiche, ligne par ligne.
    expect(charge.participants).toHaveLength(7);
    for (const { id: personne } of charge.participants) {
      m.ui.ouvrirFiche(personne);
      await rendu();
      expect(visible(fiche(m))).toBe(true);
      const tableau = tableauDeFiche(m, 'participants.fiche.itineraire');
      expect(tableau).toBeDefined();
      const lus = [...tableau.tBodies[0].rows].map((rangee) => [...rangee.cells].map((c) => c.textContent.trim()));
      const attendus = forme
        .filter((l) => l.participant === personne)
        .map((l) => (l.reserve ? [String(l.tour), t('participants.fiche.enReserve')] : [String(l.tour), String(l.numero), String(l.siege)]));
      expect(attendus).toHaveLength(3);
      expect(lus).toEqual(attendus);
    }
  });

  test('retenu à 3 tours, l’événement passé à 4 : la fiche garde les tours du retenu, et dit le quatrième hors du retenu (§ 9)', async () => {
    const m = await evenementOuvert({ sieges: 3, tours: 3, tables: 2, personnes: NOMS.slice(0, 6).map((nom) => ({ nom })) });
    await m.seance.executer('modifierReglage', { cle: 'attribuerSieges', valeur: true });
    await m.app.generation().generer({ graine: 1, nombre: 1, arret: 50, historique: 1000 });
    const [proposition] = m.seance.etat().charge.propositions;
    await m.seance.executer('retenirProposition', { id: proposition.id });
    await m.seance.executer('changerTours', { tours: 4 });
    await rendu();
    const charge = m.seance.etat().charge;
    expect(charge.evenement.tours).toBe(4);
    expect(charge.retenu.placement).toHaveLength(3);
    const forme = formeNommee(charge.retenu, charge);
    expect(charge.participants).toHaveLength(6);
    for (const { id: personne } of charge.participants) {
      m.ui.ouvrirFiche(personne);
      await rendu();
      expect(fiche(m).textContent).not.toContain(t('participants.fiche.aucunRetenu'));
      const tableau = tableauDeFiche(m, 'participants.fiche.itineraire');
      expect(tableau).toBeDefined();
      const lus = [...tableau.tBodies[0].rows].map((rangee) => [...rangee.cells].map((c) => c.textContent.trim()));
      const attendus = forme
        .filter((l) => l.participant === personne)
        .map((l) => (l.reserve ? [String(l.tour), t('participants.fiche.enReserve')] : [String(l.tour), String(l.numero), String(l.siege)]));
      expect(attendus).toHaveLength(3);
      expect(lus).toEqual([...attendus, ['4', t('participants.fiche.horsRetenu')]]);
    }
  });

  test('un nom de deux cents caractères se lit entier sur la fiche, replié, sans marque ni débordement', async () => {
    const long = 'Ombrelle'.repeat(25);
    expect(long).toHaveLength(200);
    const m = await evenementOuvert();
    await m.seance.executer('ajouterParticipant', { champs: { nom: long } });
    const id = idDe(m, long);
    m.ui.ouvrirFiche(id);
    await rendu();
    const porteur = fiche(m);
    const valeur = valeurDeFiche(m, 'participants.colonne.nom');
    expect(valeur.textContent).toBe(long);
    expect(porteur.textContent).not.toContain('\u{2026}');
    expect(porteur.scrollWidth).toBeLessThanOrEqual(porteur.clientWidth);
    expect(valeur.scrollWidth).toBeLessThanOrEqual(valeur.clientWidth);
    const interligne = Number.parseFloat(getComputedStyle(valeur).lineHeight);
    expect(interligne).toBeGreaterThan(0);
    expect(valeur.getBoundingClientRect().height).toBeGreaterThanOrEqual(2 * interligne);
  });
});

describe('les étiquettes : la fiche et la légende (§ 4.5, § 10.2, § 5.9)', () => {
  // La rubrique des étiquettes de la fiche, son champ d'ajout, sa commande
  // d'ajout, et la légende des étiquettes de la section.
  const rubrique = (m) => fiche(m).querySelector('[data-etiquettes]');
  const champEtiquettes = (m) => fiche(m).querySelector('[data-champ="etiquettes"]');
  const ajoutEtiquettes = (m) => fiche(m).querySelector('[data-commande="ajouterEtiquettes"]');
  // La commande de retrait d'une étiquette : une croix cerclée sans texte,
  // nommée par son aria-label.
  const retraits = (m) => [...fiche(m).querySelectorAll('[data-commande="retirerEtiquette"]')];
  const retrait = (m, motCle) =>
    retraits(m).find((bouton) => bouton.getAttribute('aria-label') === tEcran('participants.etiquettes.retirer', { motCle })) ?? null;
  const legendeEtiquettes = (m) => section(m).querySelector('[data-legende-etiquettes]');
  const etiquettesDe = (m, nom) => participants(m).find((p) => p.nom === nom).etiquettes;

  // Trois personnes de deux organisations : les teintes d'organisation
  // existent, et aucune ne doit peindre une étiquette.
  const TROIS_ETIQUETEES = [
    { nom: 'Ombrelle', prenom: 'Iris', organisation: CLUB },
    { nom: 'Pervenche', prenom: 'Théo', organisation: 'Cercle des Pinsons' },
    { nom: 'Lacasse', prenom: 'Ondine', organisation: CLUB, exclu: true },
  ];

  // La fiche de la personne nommée, ouverte.
  async function ouvrirFiche(m, nom) {
    m.ui.ouvrirFiche(idDe(m, nom));
    await rendu();
  }

  // Une saisie dans le champ des étiquettes, envoyée par Entrée.
  async function ajouterParClavier(m, texte) {
    await saisir(champEtiquettes(m), texte);
    champEtiquettes(m).focus();
    await touche('Enter');
    await attendreSeance(m);
  }

  test('la fiche montre chaque étiquette en pastille neutre à icône, sa croix de retrait rouge nommée par elle ; sans étiquette, elle le dit', async () => {
    const m = await evenementOuvert({ personnes: TROIS_ETIQUETEES });
    await m.seance.executer('changerEtiquettes', { id: idDe(m, 'Ombrelle'), ajouter: 'finance, Montréal' });
    await ouvrirFiche(m, 'Ombrelle');
    const elements = [...rubrique(m).querySelectorAll('li')];
    expect(elements.map((li) => texteDe(pastilleDans(li)))).toEqual(['Montréal', 'finance']);
    const encre = jeton('--couleur-page-texte');
    for (const li of elements) {
      const pastille = pastilleDans(li);
      expect(fondDe(pastille)).toEqual(jeton('--couleur-neutre-fond'));
      expect(pastille.querySelector('svg')).not.toBeNull();
      expect(composantes(getComputedStyle(pastille).color)).toEqual(encre);
    }
    // La teinte d'organisation ne sert qu'à l'organisation (§ 12.7).
    const teintes = new Set([1, 2, 3, 4, 5, 6].map((rang) => JSON.stringify(jeton(`--couleur-organisation-${rang}-fond`))));
    for (const li of elements) expect(teintes.has(JSON.stringify(fondDe(pastilleDans(li))))).toBe(false);
    // La croix de retrait : une icône seule, sans texte, la croix cerclée
    // de la teinte du retrait, marquée « retrait », dans une cible de
    // 24 px de côté au moins, et un anneau de focus au clavier.
    for (const motCle of ['Montréal', 'finance']) {
      const bouton = retrait(m, motCle);
      expect(bouton, motCle).not.toBeNull();
      expect(bouton.textContent.trim(), motCle).toBe('');
      const traces = [...bouton.querySelectorAll('svg path')];
      expect(traces.length, motCle).toBeGreaterThan(0);
      for (const trace of traces) {
        expect(trace.dataset.marque).toBe('retrait');
        expect(composantes(getComputedStyle(trace).stroke)).toEqual(jeton('--couleur-retrait'));
      }
      const { width, height } = bouton.getBoundingClientRect();
      expect(Math.min(width, height), motCle).toBeGreaterThanOrEqual(24);
    }
    // Tab mène d'une croix à la suivante, qui porte l'anneau de focus.
    retrait(m, 'Montréal').focus();
    await touche('Tab');
    expect(document.activeElement).toBe(retrait(m, 'finance'));
    expect(retrait(m, 'finance').matches(':focus-visible')).toBe(true);
    expect(getComputedStyle(retrait(m, 'finance')).outlineStyle).toBe('solid');
    expect(composantes(getComputedStyle(retrait(m, 'finance')).outlineColor)).toEqual(jeton('--couleur-focus'));
    // En sombre, la pastille prend le neutre sombre, la croix le rouge sombre.
    await sousTheme('sombre', async () => {
      for (const li of elements) expect(fondDe(pastilleDans(li))).toEqual(jeton('--couleur-neutre-fond'));
      expect(composantes(getComputedStyle(retrait(m, 'finance').querySelector('path')).stroke)).toEqual(jeton('--couleur-retrait'));
    });

    await ouvrirFiche(m, 'Pervenche');
    expect(rubrique(m).querySelectorAll('li')).toHaveLength(0);
    expect(rubrique(m).textContent).toContain(t('participants.fiche.aucuneEtiquette'));
    expect(fiche(m).querySelectorAll('[data-commande="retirerEtiquette"]')).toHaveLength(0);
  });

  test('au clavier : une saisie de trois étiquettes, Entrée, une entrée au journal ; le champ se vide et garde le focus ; la croix de retrait ôte la sienne et rend le focus à sa voisine', async () => {
    const m = await evenementOuvert({ personnes: TROIS_ETIQUETEES });
    await ouvrirFiche(m, 'Pervenche');
    const champ = champEtiquettes(m);
    expect(document.querySelector(`label[for="${champ.id}"]`).textContent.trim()).toBe(t('participants.etiquettes.champ'));
    expect(ajoutEtiquettes(m).textContent.trim()).toBe(t('participants.etiquettes.ajouter'));
    const avant = entrees(m).length;
    const gestes = vi.spyOn(m.seance, 'debuterGeste');
    const finis = vi.spyOn(m.seance, 'finirGeste');
    await saisir(champ, 'ressources  humaines ; bénévole ; voile');
    // Une saisie non envoyée est un geste ouvert.
    expect(gestes).toHaveBeenCalled();
    expect(m.seance.gesteEnCours).toBe(true);
    champ.focus();
    await touche('Enter');
    await attendreSeance(m);
    expect(etiquettesDe(m, 'Pervenche')).toEqual(['bénévole', 'ressources humaines', 'voile']);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(champEtiquettes(m).value).toBe('');
    // Le champ vidé par l'envoi rend le geste : le compte d'inactivité reprend.
    expect(finis).toHaveBeenCalledTimes(1);
    expect(m.seance.gesteEnCours).toBe(false);
    expect(document.activeElement).toBe(champEtiquettes(m));
    expect([...rubrique(m).querySelectorAll('li')].map((li) => texteDe(pastilleDans(li)))).toEqual(['bénévole', 'ressources humaines', 'voile']);

    // La croix de retrait activée par Entrée : le focus passe à la croix
    // suivante, sinon à la précédente, sinon au champ ; jamais au document.
    const retirerAuClavier = async (motCle) => {
      retrait(m, motCle).focus();
      await touche('Enter');
      await attendreSeance(m);
    };
    await retirerAuClavier('ressources humaines');
    expect(etiquettesDe(m, 'Pervenche')).toEqual(['bénévole', 'voile']);
    expect(entrees(m)).toHaveLength(avant + 2);
    expect(retrait(m, 'ressources humaines')).toBeNull();
    expect(document.activeElement).toBe(retrait(m, 'voile'));

    await retirerAuClavier('voile');
    expect(etiquettesDe(m, 'Pervenche')).toEqual(['bénévole']);
    expect(document.activeElement).toBe(retrait(m, 'bénévole'));

    // Le dernier retrait retire le champ de la personne.
    await retirerAuClavier('bénévole');
    expect(etiquettesDe(m, 'Pervenche')).toBeUndefined();
    expect(rubrique(m).textContent).toContain(t('participants.fiche.aucuneEtiquette'));
    expect(document.activeElement).toBe(champEtiquettes(m));

    // Une saisie non envoyée : fermer la fiche rend le geste qu'elle tient.
    await saisir(champEtiquettes(m), 'voile');
    expect(m.seance.gesteEnCours).toBe(true);
    finis.mockClear();
    await cliquer(fiche(m).querySelector('[data-commande="fermerFiche"]'));
    expect(fiche(m)).toBeNull();
    expect(finis).toHaveBeenCalledTimes(1);
    expect(m.seance.gesteEnCours).toBe(false);
  });

  test('« FINANCE » saisi quand « finance » existe s’enregistre sous « finance », et le signal d’orthographe se pose contre le champ', async () => {
    const m = await evenementOuvert({ personnes: TROIS_ETIQUETEES });
    await m.seance.executer('changerEtiquettes', { id: idDe(m, 'Ombrelle'), ajouter: 'finance' });
    await ouvrirFiche(m, 'Pervenche');
    await ajouterParClavier(m, 'FINANCE');
    expect(etiquettesDe(m, 'Pervenche')).toEqual(['finance']);
    const signal = fiche(m).querySelector('[data-avertissement="ORTHOGRAPHE_RETENUE"]');
    expect(signal).not.toBeNull();
    expect(visible(signal)).toBe(true);
    expect(texteDe(signal)).toBe(t('ORTHOGRAPHE_RETENUE', { saisie: 'FINANCE', retenue: 'finance' }));
    expect(champEtiquettes(m).getAttribute('aria-describedby')).toBe(signal.id);
    // Contre le champ : le signal suit le champ dans la fiche, sans rien entre eux.
    expect(ecart(signal, champEtiquettes(m))).toBeLessThan(48);

    // Une autre fiche ne le montre pas ; revenue à la personne, sous la même
    // révision, la fiche le montre de nouveau.
    await ouvrirFiche(m, 'Ombrelle');
    expect(fiche(m).querySelector('[data-avertissement]')).toBeNull();
    expect(champEtiquettes(m).hasAttribute('aria-describedby')).toBe(false);
    await ouvrirFiche(m, 'Pervenche');
    expect(fiche(m).querySelector('[data-avertissement="ORTHOGRAPHE_RETENUE"]')).not.toBeNull();

    // Un geste suivant le retire.
    await ajouterParClavier(m, 'bénévole');
    expect(fiche(m).querySelector('[data-avertissement="ORTHOGRAPHE_RETENUE"]')).toBeNull();
    expect(champEtiquettes(m).hasAttribute('aria-describedby')).toBe(false);
  });

  test('refusé contre le champ : une tabulation, 41 caractères, des séparateurs seuls, une vingt et unième ; la saisie reste, rien ne s’écrit', async () => {
    const m = await evenementOuvert({ personnes: TROIS_ETIQUETEES });
    const vingt = Array.from({ length: 20 }, (_, i) => `mot${String(i).padStart(2, '0')}`).join(', ');
    await m.seance.executer('changerEtiquettes', { id: idDe(m, 'Ombrelle'), ajouter: vingt });
    await ouvrirFiche(m, 'Pervenche');
    const avant = texteJournal(m);
    const cas = [
      ['voile, a\u{0009}b', 'ETIQUETTE_INVALIDE'],
      ['x'.repeat(41), 'ETIQUETTE_INVALIDE'],
      [' , ; | ', 'ETIQUETTE_INVALIDE'],
    ];
    for (const [saisie, code] of cas) {
      await ajouterParClavier(m, saisie);
      const champ = champEtiquettes(m);
      expect(champ.getAttribute('aria-invalid'), saisie).toBe('true');
      const message = document.getElementById(champ.getAttribute('aria-describedby'));
      expect(message.dataset.refus, saisie).toBe(code);
      expect(visible(message)).toBe(true);
      expect(champ.value, saisie).toBe(saisie);
      expect(fiche(m).contains(message)).toBe(true);
    }
    expect(texteJournal(m)).toBe(avant);
    // Une frappe retire le refus.
    await saisir(champEtiquettes(m), 'voile');
    expect(champEtiquettes(m).hasAttribute('aria-invalid')).toBe(false);

    await ouvrirFiche(m, 'Ombrelle');
    await ajouterParClavier(m, 'voile');
    const champ = champEtiquettes(m);
    const message = document.getElementById(champ.getAttribute('aria-describedby'));
    expect(message.dataset.refus).toBe('ETIQUETTES_EN_TROP');
    expect(texteDe(message)).toContain(t('ETIQUETTES_EN_TROP', { nombre: 21 }));
    expect(etiquettesDe(m, 'Ombrelle')).toHaveLength(20);
    expect(texteJournal(m)).toBe(avant);

    // Passer à une autre personne vide le champ et son refus.
    await ouvrirFiche(m, 'Pervenche');
    expect(champEtiquettes(m).value).toBe('');
    expect(champEtiquettes(m).hasAttribute('aria-invalid')).toBe(false);
    expect(champEtiquettes(m).hasAttribute('aria-describedby')).toBe(false);
    expect(fiche(m).querySelector('[data-refus]')).toBeNull();
  });

  test('un refus rendu après le passage à une autre personne ne se pose pas sur son champ', async () => {
    const m = await evenementOuvert({ personnes: TROIS_ETIQUETEES });
    // Une écriture retenue tient la file de la séance : l'ajout tapé
    // ensuite attend derrière elle.
    const liberer = retenirJournal(m);
    const tenue = m.seance.executer('changerEtiquettes', { id: idDe(m, 'Lacasse'), ajouter: 'finance' });
    await ouvrirFiche(m, 'Pervenche');
    await saisir(champEtiquettes(m), 'a\u{0009}b');
    champEtiquettes(m).focus();
    await touche('Enter');
    await rendu();
    await ouvrirFiche(m, 'Ombrelle');
    liberer();
    await tenue;
    await attendreSeance(m);
    expect(champEtiquettes(m).value).toBe('');
    expect(champEtiquettes(m).hasAttribute('aria-invalid')).toBe(false);
    expect(champEtiquettes(m).hasAttribute('aria-describedby')).toBe(false);
    expect(fiche(m).querySelector('[data-refus]')).toBeNull();
  });

  test('une seconde Entrée pendant l’écriture n’envoie rien : un seul envoi, une entrée au journal, aucun refus', async () => {
    const m = await evenementOuvert({ personnes: TROIS_ETIQUETEES });
    await ouvrirFiche(m, 'Pervenche');
    const avant = entrees(m).length;
    const executer = vi.spyOn(m.seance, 'executer');
    const liberer = retenirJournal(m);
    await saisir(champEtiquettes(m), 'bénévole');
    champEtiquettes(m).focus();
    await touche('Enter');
    await rendu();
    expect(ajoutEtiquettes(m).getAttribute('aria-busy')).toBe('true');
    await touche('Enter');
    await rendu();
    liberer();
    await vi.waitFor(() => expect(etiquettesDe(m, 'Pervenche')).toEqual(['bénévole']));
    await attendreSeance(m);
    expect(executer.mock.calls.filter(([nom]) => nom === 'changerEtiquettes')).toHaveLength(1);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(fiche(m).querySelector('[data-refus]')).toBeNull();
    expect(champEtiquettes(m).hasAttribute('aria-invalid')).toBe(false);
  });

  test('la légende des étiquettes suit celle des organisations, chacune chiffrée exclues comprises, en pastilles neutres ; absente sans étiquette', async () => {
    const m = await evenementOuvert({ personnes: TROIS_ETIQUETEES });
    expect(legendeEtiquettes(m)).toBeNull();
    expect(legende(m)).not.toBeNull();
    await m.seance.executer('changerEtiquettes', { id: idDe(m, 'Ombrelle'), ajouter: 'finance, Montréal' });
    await m.seance.executer('changerEtiquettes', { id: idDe(m, 'Lacasse'), ajouter: 'finance' });
    await attendreSeance(m);
    const porteur = legendeEtiquettes(m);
    expect(porteur).not.toBeNull();
    expect(porteur.getAttribute('aria-label')).toBe(t('participants.legendeEtiquettes.titre'));
    // Sous celle des organisations : sa voisine immédiate, dans le même
    // porteur des légendes.
    expect(legende(m).nextElementSibling).toBe(porteur);
    expect(porteur.parentElement).toBe(legende(m).parentElement);
    const lue = () => [...porteur.querySelectorAll('li')].map((li) => ({ texte: texteDe(li), fond: fondDe(pastilleDans(li)) }));
    const neutre = jeton('--couleur-neutre-fond');
    expect(lue()).toEqual([
      { texte: t('participants.legende.element', { nom: 'finance', compte: 2 }), fond: neutre },
      { texte: t('participants.legende.element', { nom: 'Montréal', compte: 1 }), fond: neutre },
    ]);
    for (const li of porteur.querySelectorAll('li')) expect(pastilleDans(li).querySelector('svg')).not.toBeNull();
    // Un filtre ne la change pas.
    await saisir(section(m).querySelector('[data-champ="filtre"]'), 'Pervenche');
    expect(idsAffiches(m)).toHaveLength(1);
    expect(lue()).toHaveLength(2);
    // La dernière étiquette retirée, la légende part.
    await m.seance.executer('changerEtiquettes', { id: idDe(m, 'Ombrelle'), retirer: 'finance' });
    await m.seance.executer('changerEtiquettes', { id: idDe(m, 'Ombrelle'), retirer: 'Montréal' });
    await m.seance.executer('changerEtiquettes', { id: idDe(m, 'Lacasse'), retirer: 'finance' });
    await attendreSeance(m);
    expect(legendeEtiquettes(m)).toBeNull();
  });

  test('en lecture : les pastilles restent, sans croix de retrait ; « Ajouter » est refusé avec son remède, rien ne s’écrit ; de retour en écriture, les croix reviennent', async () => {
    const m = await evenementOuvert({ personnes: TROIS_ETIQUETEES });
    await m.seance.executer('changerEtiquettes', { id: idDe(m, 'Ombrelle'), ajouter: 'finance' });
    await m.seance.passerEnLecture();
    await ouvrirFiche(m, 'Ombrelle');
    const avant = texteJournal(m);
    expect(texteDe(pastilleDans(rubrique(m).querySelector('li')))).toBe('finance');
    expect(retraits(m)).toHaveLength(0);

    await ajouterParClavier(m, 'bénévole');
    const message = document.getElementById(champEtiquettes(m).getAttribute('aria-describedby'));
    expect(message.dataset.refus).toBe('MODE_LECTURE');
    expect(message.querySelector('[data-commande]')).not.toBeNull();
    expect(etiquettesDe(m, 'Ombrelle')).toEqual(['finance']);
    expect(texteJournal(m)).toBe(avant);

    await m.seance.passerEnEcriture();
    await rendu();
    expect(retrait(m, 'finance')).not.toBeNull();
    await m.seance.passerEnLecture();
    await rendu();
    expect(retraits(m)).toHaveLength(0);
  });

  test('plan bloqué : aucune croix de retrait ; « Ajouter » est refusé avec « Débloquer » pour remède', async () => {
    const m = await evenementOuvert({ sieges: 4, tours: 2, tables: 1, personnes: TROIS_ETIQUETEES });
    await m.seance.executer('changerEtiquettes', { id: idDe(m, 'Ombrelle'), ajouter: 'finance' });
    await m.app.generation().generer({ graine: 1, nombre: 1, arret: 50, historique: 1000 });
    const [proposition] = m.seance.etat().charge.propositions;
    await m.seance.executer('retenirProposition', { id: proposition.id });
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    await ouvrirFiche(m, 'Ombrelle');
    const avant = texteJournal(m);

    expect(texteDe(pastilleDans(rubrique(m).querySelector('li')))).toBe('finance');
    expect(retraits(m)).toHaveLength(0);

    await ajouterParClavier(m, 'bénévole');
    const message = document.getElementById(champEtiquettes(m).getAttribute('aria-describedby'));
    expect(message.querySelector('[data-commande="debloquer"]')).not.toBeNull();
    expect(texteJournal(m)).toBe(avant);
  });
});

describe('export et collage (§ 10.2)', () => {
  test('« Exporter la liste » remet les octets d’exporterParticipants ; réimportés dans un événement neuf, ils rendent les mêmes participants, exclu compris', async () => {
    const m = await evenementOuvert();
    const octets = await octetsLivres(CAS_LIMITES);
    await m.seance.executer('importerParticipants', { apercu: apercuPour(m, decoder(octets).texte), mode: 'ajouter' });
    await rendu();
    const releves = [];
    m.fs.enregistrerSous = async (nomPropose, contenu) => {
      releves.push({ nomPropose, octets: contenu });
      return nomPropose;
    };
    const avant = participants(m);
    expect(avant.some((p) => p.exclu)).toBe(true);
    const trace = m.trace.length;
    await cliquer(section(m).querySelector('[data-commande="exporter"]'));
    await attendreSeance(m);
    expect(releves).toHaveLength(1);
    expect(releves[0].nomPropose).toBe(`${base(m)}-participants.csv`);
    expect([...releves[0].octets]).toEqual([...exporterParticipants(avant)]);
    expect(m.trace.length).toBe(trace);

    await m.seance.fermer();
    await m.seance.creer({ nom: 'Soirée des Grisailles', date: null, siegesParDefaut: 8, tours: 2 });
    await m.seance.passerEnEcriture();
    await m.seance.executer('importerParticipants', { apercu: apercuPour(m, decoder(releves[0].octets).texte), mode: 'ajouter' });
    const sansId = (liste) => liste.map(({ id, ...champs }) => champs);
    expect(avant.length).toBeGreaterThan(0);
    expect(sansId(participants(m))).toEqual(sansId(avant));
  });

  test('un export dont des inclusions visent un homonyme le dit en avis, tant que la liste reste celle qu’il a écrite ; annulé, il ne dit rien', async () => {
    const m = await evenementOuvert({
      personnes: [
        { nom: 'Galet', prenom: 'Roger', organisation: 'Club des Merles' },
        { nom: 'Galet', prenom: 'Roger', organisation: 'Atelier Ressac' },
        { nom: 'Ombrelle', prenom: 'Iris' },
      ],
    });
    const [premier, second] = participants(m).filter(({ nom }) => nom === 'Galet').map(({ id }) => id);
    await m.seance.executer('changerInclusionsParticipant', { id: idDe(m, 'Ombrelle'), participants: [premier, second] });
    await rendu();
    const avis = () => section(m).querySelector('[data-avertissement="inclusionsVersHomonymes"]');
    expect(avis()).toBeNull();
    m.fs.enregistrerSous = async () => null;
    await cliquer(section(m).querySelector('[data-commande="exporter"]'));
    await attendreSeance(m);
    expect(avis(), 'export annulé').toBeNull();
    m.fs.enregistrerSous = async (nomPropose) => nomPropose;
    const trace = m.trace.length;
    await cliquer(section(m).querySelector('[data-commande="exporter"]'));
    await attendreSeance(m);
    await rendu();
    expect(avis()).not.toBeNull();
    expect(avis().getAttribute('role')).toBe('status');
    expect(avis().textContent.trim()).toBe(tEcran('participants.export.homonymes', { n: 2 }));
    expect(t('participants.export.homonymes', { n: 2 })).toMatch(/^2 inclusions visent une personne/);
    expect(m.trace.length).toBe(trace);
    // La liste change : l'avis tombe avec elle.
    await m.seance.executer('ajouterParticipant', { champs: { nom: 'Pervenche', prenom: 'Théo' } });
    await rendu();
    expect(avis()).toBeNull();
  });

  test('un collage sur la grille ouvre l’aperçu d’import : importEnAttente porte le texte intact, origine collage, et la section import ; zéro écriture', async () => {
    const m = await evenementOuvert({ personnes: [{ nom: 'Ombrelle' }] });
    const etats = [];
    const desabonner = m.ui.subscribe((etat) => etats.push(etat));
    const trace = m.trace.length;
    const texte = 'nom;prénom\r\nPervenche;Théo\n"Lacasse; Ondine";\u{00A0}x\t';
    grille(m).querySelector('[tabindex="0"]').focus();
    const presse = new DataTransfer();
    presse.setData('text/plain', texte);
    grille(m).querySelector('[tabindex="0"]').dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: presse, bubbles: true, cancelable: true }),
    );
    await rendu();
    desabonner();
    expect(etats.some((etat) => etat.importEnAttente?.texte === texte && etat.importEnAttente.origine === 'collage' && etat.section === 'import')).toBe(
      true,
    );
    expect(m.ui.etat().section).toBe('import');
    await attendreSeance(m);
    expect(m.trace.length).toBe(trace);
  });
});

describe('la liste groupée par une colonne ou plusieurs', () => {
  // Cinq personnes : deux du Club des Merles sous deux orthographes, deux
  // du Cercle des Pinsons dont une exclue, une sans organisation.
  const CINQ = [
    { nom: 'Ombrelle', prenom: 'Iris', organisation: CLUB, titre: 'hôtesse' },
    { nom: 'Pervenche', prenom: 'Théo', organisation: 'CLUB DES MERLES' },
    { nom: 'Lacasse', prenom: 'Ondine' },
    { nom: 'Grisaille', organisation: 'Cercle des Pinsons', exclu: true },
    { nom: 'Brindelle', organisation: 'Cercle des Pinsons' },
  ];
  const PINSONS = 'texte:cercle des pinsons';
  const MERLES = 'texte:club des merles';

  // Le sélecteur du niveau donné, 1 pour le plus large, et tous ceux
  // affichés.
  const selecteur = (m, niveau = 1) => section(m).querySelector(`[data-champ="grouper"][data-niveau="${niveau}"]`);
  const selecteurs = (m) => [...section(m).querySelectorAll('[data-champ="grouper"]')];
  // Les en-têtes de groupe affichés, de tout niveau, dans l'ordre du rendu ;
  // l'en-tête d'un groupe porte sa clé, chaque ligne celle du plus étroit
  // groupe qui la compte.
  const groupes = (m) => [...grille(m).querySelectorAll('[data-groupe]')];
  const groupe = (m, cle) => grille(m).querySelector(`[data-groupe="${cle}"]`);
  const bascule = (m, cle) => groupe(m, cle).querySelector('[data-commande="basculerGroupe"]');
  const idsDuGroupe = (m, cle) =>
    lignes(m)
      .filter(({ dataset: { groupeLigne } }) => groupeLigne === cle || groupeLigne.startsWith(`${cle}/`))
      .map((l) => Number(l.dataset.participant));
  const ouverts = (m) => groupes(m).map((g) => bascule(m, g.dataset.groupe).getAttribute('aria-expanded'));
  // Tous les groupes d'un arbre de groupesGrille, chacun avant ses
  // sous-groupes : l'ordre des en-têtes déplié.
  const aplatir = (arbre) => arbre.flatMap((g) => [g, ...(g.sousGroupes === null ? [] : aplatir(g.sousGroupes))]);
  // Ce que montre l'en-tête d'un groupe : son libellé et son compte.
  const entete = (m, cle) => ({
    libelle: groupe(m, cle).querySelector('[data-groupe-libelle]').textContent,
    compte: groupe(m, cle).querySelector('[data-groupe-compte]').textContent,
  });
  // Le libellé et le compte qu'un groupe de groupesGrille doit afficher.
  const enteteAttendu = ({ libelle, cleLibelle, detailsLibelle, compte }) => ({
    libelle: libelle ?? t(cleLibelle, detailsLibelle ?? {}),
    compte: t('participants.groupe.compte', { compte }),
  });

  // Choisit la colonne d'un niveau du groupement au clavier seul : le
  // sélecteur de ce niveau prend le focus, puis les flèches le mènent à
  // l'option voulue.
  async function grouperPar(m, colonne, niveau = 1) {
    const choix = selecteur(m, niveau);
    const valeurs = [...choix.options].map((option) => option.value);
    const cible = valeurs.indexOf(colonne);
    expect(cible, colonne).toBeGreaterThanOrEqual(0);
    choix.focus();
    for (let essai = 0; essai < valeurs.length && choix.selectedIndex !== cible; essai += 1) {
      await touche(choix.selectedIndex < cible ? 'ArrowDown' : 'ArrowUp');
      await rendu();
    }
    expect(choix.value).toBe(colonne);
    await rendu();
  }

  // Le groupement par organisation puis par statut, Ombrelle ancrée par une
  // réservation : les autres présentes sont mobiles.
  async function organisationPuisStatut() {
    const m = await evenementOuvert({ tables: 1, personnes: CINQ });
    const charge = m.seance.etat().charge;
    await m.seance.executer('reserver', { participant: idDe(m, 'Ombrelle'), table: charge.tables[0].id, siege: null, portee: 'tous', tour: null });
    await attendreSeance(m);
    await grouperPar(m, 'organisation', 1);
    await grouperPar(m, 'statut', 2);
    return m;
  }

  // Le journal, l'état et la trace d'écriture, à comparer après des gestes
  // de regard.
  const empreinte = (m) => ({ journal: texteJournal(m), etat: texteEtat(m), trace: m.trace.length });

  test('le sélecteur offre « Aucun » puis chaque colonne groupable ; sans groupement, aucun en-tête de groupe', async () => {
    const m = await evenementOuvert({ personnes: CINQ });
    const options = [...selecteur(m).options];
    expect(options.map((o) => o.value)).toEqual(['', ...GROUPEMENTS]);
    expect(options.map((o) => o.textContent)).toEqual([t('participants.groupe.aucun'), ...GROUPEMENTS.map((c) => t(cleDeGroupement(c)))]);
    expect(selecteur(m).value).toBe('');
    expect(selecteurs(m)).toHaveLength(1);
    expect(groupes(m)).toHaveLength(0);
    expect(lignes(m)).toHaveLength(5);
    expect(section(m).querySelector('[data-commande="toutReplier"]')).toBeNull();
  });

  test('chaque colonne choisie ouvre le niveau suivant, aux colonnes pas encore prises ; « Aucun » retire un niveau et les suivants', async () => {
    const m = await evenementOuvert({ personnes: CINQ });
    await grouperPar(m, 'organisation', 1);
    expect(selecteurs(m)).toHaveLength(2);
    expect(selecteur(m, 2).value).toBe('');
    const deuxieme = [...selecteur(m, 2).options];
    expect(deuxieme.map((o) => o.value)).toEqual(['', ...GROUPEMENTS.filter((c) => c !== 'organisation')]);
    expect(deuxieme[0].textContent).toBe(t('participants.groupe.aucunSousGroupe'));
    // Chaque sélecteur a son étiquette, distincte des autres.
    const etiquettes = selecteurs(m).map((choix) => choix.labels[0]?.textContent);
    expect(etiquettes).toEqual([t('participants.groupe.grouperPar'), t('participants.groupe.puisPar', { niveau: 2 })]);

    await grouperPar(m, 'statut', 2);
    expect(selecteurs(m).map((choix) => choix.value)).toEqual(['organisation', 'statut', '']);
    expect([...selecteur(m, 3).options].map((o) => o.value)).toEqual(['', ...GROUPEMENTS.filter((c) => c !== 'organisation' && c !== 'statut')]);
    expect(new Set(groupes(m).map((g) => g.dataset.niveau))).toEqual(new Set(['1', '2']));

    // La colonne d'un niveau prise plus haut quitte le niveau plus bas.
    await grouperPar(m, 'statut', 1);
    expect(selecteurs(m).map((choix) => choix.value)).toEqual(['statut', '']);
    await grouperPar(m, 'nom', 2);
    await grouperPar(m, 'prenom', 3);
    expect(selecteurs(m).map((choix) => choix.value)).toEqual(['statut', 'nom', 'prenom', '']);
    await grouperPar(m, '', 2);
    expect(selecteurs(m).map((choix) => choix.value)).toEqual(['statut', '']);
    expect(new Set(groupes(m).map((g) => g.dataset.niveau))).toEqual(new Set(['1']));
    await grouperPar(m, '', 1);
    expect(selecteurs(m).map((choix) => choix.value)).toEqual(['']);
    expect(groupes(m)).toHaveLength(0);
    expect(lignes(m)).toHaveLength(5);

    // Toutes les colonnes prises : aucun sélecteur de plus.
    for (const [rang, colonne] of GROUPEMENTS.entries()) await grouperPar(m, colonne, rang + 1);
    expect(selecteurs(m)).toHaveLength(GROUPEMENTS.length);
  });

  test('par organisation : un en-tête par groupe, son libellé et son compte, ses lignes dessous ; puis chaque colonne groupable suit groupesGrille ; rien ne s’écrit', async () => {
    const m = await evenementOuvert({ tables: 1, personnes: CINQ });
    const charge = m.seance.etat().charge;
    await m.seance.executer('reserver', { participant: idDe(m, 'Ombrelle'), table: charge.tables[0].id, siege: null, portee: 'tous', tour: null });
    await attendreSeance(m);
    const avant = empreinte(m);

    await grouperPar(m, 'organisation');
    expect(groupes(m).map((g) => g.dataset.groupe)).toEqual([PINSONS, MERLES, 'vide']);
    expect(entete(m, PINSONS)).toEqual({ libelle: 'Cercle des Pinsons', compte: t('participants.groupe.compte', { compte: 2 }) });
    expect(entete(m, MERLES)).toEqual({ libelle: CLUB, compte: t('participants.groupe.compte', { compte: 2 }) });
    expect(entete(m, 'vide')).toEqual({ libelle: t('participants.groupe.vide'), compte: t('participants.groupe.compte', { compte: 1 }) });
    expect(idsDuGroupe(m, PINSONS)).toEqual([idDe(m, 'Grisaille'), idDe(m, 'Brindelle')]);
    expect(idsDuGroupe(m, MERLES)).toEqual([idDe(m, 'Ombrelle'), idDe(m, 'Pervenche')]);
    expect(idsDuGroupe(m, 'vide')).toEqual([idDe(m, 'Lacasse')]);
    // L'en-tête précède les lignes de son groupe, dans le rendu.
    const premiere = ligne(m, idDe(m, 'Grisaille')).getBoundingClientRect();
    expect(bascule(m, PINSONS).getBoundingClientRect().bottom).toBeLessThanOrEqual(premiere.top + 1);

    await grouperPar(m, 'statut');
    expect(groupes(m).map((g) => g.dataset.groupe)).toEqual(['statut:ancre', 'statut:mobile', 'statut:exclue']);
    expect(entete(m, 'statut:ancre').libelle).toBe(t('participants.statut.ancre'));
    expect(idsDuGroupe(m, 'statut:ancre')).toEqual([idDe(m, 'Ombrelle')]);
    expect(idsDuGroupe(m, 'statut:exclue')).toEqual([idDe(m, 'Grisaille')]);

    expect(GROUPEMENTS.length).toBeGreaterThan(0);
    const lignesAttendues = lignesGrille(participants(m), { tri: null, filtre: '' }, cleNormalisee);
    for (const colonne of GROUPEMENTS) {
      await grouperPar(m, colonne);
      const attendus = groupesGrille(lignesAttendues, [colonne], { tri: null, cleNormalisee, statuts: statuts(m.seance.etat().charge).parId });
      expect(attendus.length, colonne).toBeGreaterThan(0);
      expect(groupes(m).map((g) => g.dataset.groupe), colonne).toEqual(attendus.map(({ cle }) => cle));
      for (const attendu of attendus) {
        expect(entete(m, attendu.cle), `${colonne} ${attendu.cle}`).toEqual(enteteAttendu(attendu));
        expect(idsDuGroupe(m, attendu.cle), `${colonne} ${attendu.cle}`).toEqual(attendu.lignes.map(({ id }) => id));
        expect(bascule(m, attendu.cle).getAttribute('aria-expanded')).toBe('true');
      }
    }
    await grouperPar(m, '');
    expect(groupes(m)).toHaveLength(0);
    expect(lignes(m)).toHaveLength(5);
    await attendreSeance(m);
    expect(empreinte(m)).toEqual(avant);
  });

  test('par présence : « tous » d’abord, puis chaque présence nommée par ses tours, son compte, ses lignes ; triée décroissante, l’ordre s’inverse ; rien ne s’écrit', async () => {
    const m = await evenementOuvert({ tours: 4, personnes: CINQ });
    await m.seance.executer('changerPresence', { id: idDe(m, 'Ombrelle'), tours: [1, 2] });
    await m.seance.executer('changerPresence', { id: idDe(m, 'Lacasse'), tours: [1, 2] });
    await m.seance.executer('changerPresence', { id: idDe(m, 'Brindelle'), tours: [3] });
    await attendreSeance(m);
    const avant = empreinte(m);

    await grouperPar(m, 'presence');
    expect(groupes(m).map((g) => g.dataset.groupe)).toEqual(['presence:tous', 'presence:001,002', 'presence:003']);
    expect(entete(m, 'presence:tous')).toEqual({ libelle: 'tous', compte: t('participants.groupe.compte', { compte: 2 }) });
    expect(entete(m, 'presence:001,002')).toEqual({ libelle: 'tours 1 et 2', compte: t('participants.groupe.compte', { compte: 2 }) });
    expect(entete(m, 'presence:003').libelle).toBe('tour 3');
    expect(idsDuGroupe(m, 'presence:tous')).toEqual([idDe(m, 'Pervenche'), idDe(m, 'Grisaille')]);
    expect(idsDuGroupe(m, 'presence:001,002')).toEqual([idDe(m, 'Ombrelle'), idDe(m, 'Lacasse')]);
    expect(idsDuGroupe(m, 'presence:003')).toEqual([idDe(m, 'Brindelle')]);

    const trier = section(m).querySelector('[data-commande="trier"][data-cible="presence"]');
    await cliquer(trier);
    await cliquer(trier);
    expect(groupes(m).map((g) => g.dataset.groupe)).toEqual(['presence:003', 'presence:001,002', 'presence:tous']);
    await attendreSeance(m);
    expect(empreinte(m)).toEqual(avant);
  });

  test('replier masque exactement les lignes du groupe, déplier les rend ; Tout replier, Tout déplier ; l’état se lit en texte et dans aria-expanded ; rien ne s’écrit, en écriture comme en lecture', async () => {
    const m = await evenementOuvert({ personnes: CINQ });
    for (const mode of ['ecriture', 'lecture']) {
      if (mode === 'lecture') {
        await m.seance.passerEnLecture();
        await rendu();
      }
      const avant = empreinte(m);
      await grouperPar(m, 'organisation');
      const tous = idsAffiches(m);
      expect(tous, mode).toHaveLength(5);
      const merles = idsDuGroupe(m, MERLES);
      expect(merles, mode).toHaveLength(2);
      const texteOuvert = bascule(m, MERLES).querySelector('[data-groupe-etat]').textContent;

      await cliquer(bascule(m, MERLES));
      expect(bascule(m, MERLES).getAttribute('aria-expanded'), mode).toBe('false');
      expect(idsDuGroupe(m, MERLES), mode).toEqual([]);
      expect(idsAffiches(m), mode).toEqual(tous.filter((id) => !merles.includes(id)));
      expect(entete(m, MERLES).compte, mode).toBe(t('participants.groupe.compte', { compte: 2 }));
      // Replié et ouvert se distinguent par le texte, pas seulement par la couleur.
      expect(bascule(m, MERLES).querySelector('[data-groupe-etat]').textContent, mode).not.toBe(texteOuvert);
      expect(bascule(m, PINSONS).getAttribute('aria-expanded'), mode).toBe('true');

      await cliquer(bascule(m, MERLES));
      expect(bascule(m, MERLES).getAttribute('aria-expanded'), mode).toBe('true');
      expect(idsAffiches(m), mode).toEqual(tous);

      // Au clavier : Entrée sur le bouton replie.
      bascule(m, PINSONS).focus();
      await touche('Enter');
      await rendu();
      expect(bascule(m, PINSONS).getAttribute('aria-expanded'), mode).toBe('false');
      expect(idsDuGroupe(m, PINSONS), mode).toEqual([]);
      await touche(' ');
      await rendu();
      expect(bascule(m, PINSONS).getAttribute('aria-expanded'), mode).toBe('true');

      await cliquer(section(m).querySelector('[data-commande="toutReplier"]'));
      expect(lignes(m), mode).toHaveLength(0);
      expect(groupes(m).map((g) => bascule(m, g.dataset.groupe).getAttribute('aria-expanded')), mode).toEqual(['false', 'false', 'false']);
      await cliquer(section(m).querySelector('[data-commande="toutDeplier"]'));
      expect(idsAffiches(m), mode).toEqual(tous);
      expect(groupes(m).map((g) => bascule(m, g.dataset.groupe).getAttribute('aria-expanded')), mode).toEqual(['true', 'true', 'true']);

      await attendreSeance(m);
      expect(empreinte(m), mode).toEqual(avant);
    }
  });

  test('le filtre passe d’abord : un groupe sans ligne disparaît, chaque compte est celui des lignes montrées ; trié par la colonne groupée, les groupes suivent le sens', async () => {
    const m = await evenementOuvert({ personnes: CINQ });
    // Deux orthographes du même groupe : la plus ancienne personne le nomme.
    await m.seance.executer('modifierParticipant', { id: idDe(m, 'Pervenche'), champs: { organisation: 'CLUB DES MERLES' } });
    await grouperPar(m, 'organisation');
    const libelleEntier = entete(m, MERLES).libelle;
    expect(participants(m).find(({ nom }) => nom === 'Pervenche').organisation).toBe('CLUB DES MERLES');
    expect(libelleEntier).toBe(CLUB);
    await saisir(section(m).querySelector('[data-champ="filtre"]'), 'pinsons');
    expect(groupes(m).map((g) => g.dataset.groupe)).toEqual([PINSONS]);
    expect(entete(m, PINSONS).compte).toBe(t('participants.groupe.compte', { compte: 2 }));
    await saisir(section(m).querySelector('[data-champ="filtre"]'), 'ondine');
    expect(groupes(m).map((g) => g.dataset.groupe)).toEqual(['vide']);
    expect(entete(m, 'vide').compte).toBe(t('participants.groupe.compte', { compte: 1 }));
    await saisir(section(m).querySelector('[data-champ="filtre"]'), 'iris');
    expect(groupes(m).map((g) => g.dataset.groupe)).toEqual([MERLES]);
    expect(entete(m, MERLES).compte).toBe(t('participants.groupe.compte', { compte: 1 }));
    // Le libellé ne suit pas le filtre : chacune des deux orthographes seule
    // montrée, le groupe garde celui de la liste entière.
    expect(entete(m, MERLES).libelle).toBe(libelleEntier);
    await saisir(section(m).querySelector('[data-champ="filtre"]'), 'pervenche');
    expect(entete(m, MERLES).libelle).toBe(libelleEntier);
    // Tout replier vise chaque groupe, même ceux que le filtre cache.
    await saisir(section(m).querySelector('[data-champ="filtre"]'), 'pinsons');
    await cliquer(section(m).querySelector('[data-commande="toutReplier"]'));
    await saisir(section(m).querySelector('[data-champ="filtre"]'), '');
    expect(groupes(m).map((g) => g.dataset.groupe)).toEqual([PINSONS, MERLES, 'vide']);
    expect(ouverts(m)).toEqual(['false', 'false', 'false']);
    expect(lignes(m)).toHaveLength(0);
    await cliquer(section(m).querySelector('[data-commande="toutDeplier"]'));

    await cliquer(section(m).querySelector('[data-commande="trier"][data-cible="organisation"]'));
    await cliquer(section(m).querySelector('[data-commande="trier"][data-cible="organisation"]'));
    expect(groupes(m).map((g) => g.dataset.groupe)).toEqual([MERLES, PINSONS, 'vide']);
    // Trié par nom décroissant : groupes croissants, lignes au tri dans chacun.
    await cliquer(section(m).querySelector('[data-commande="trier"][data-cible="nom"]'));
    await cliquer(section(m).querySelector('[data-commande="trier"][data-cible="nom"]'));
    expect(groupes(m).map((g) => g.dataset.groupe)).toEqual([PINSONS, MERLES, 'vide']);
    expect(idsDuGroupe(m, PINSONS)).toEqual([idDe(m, 'Grisaille'), idDe(m, 'Brindelle')]);
    expect(idsDuGroupe(m, MERLES)).toEqual([idDe(m, 'Pervenche'), idDe(m, 'Ombrelle')]);
  });

  test('au clavier, les flèches et Tab passent d’une ligne visible à la suivante, par-dessus les en-têtes et les groupes repliés', async () => {
    const m = await evenementOuvert({ personnes: CINQ });
    await grouperPar(m, 'organisation');
    await cliquer(bascule(m, MERLES));
    const [grisaille, brindelle, lacasse] = ['Grisaille', 'Brindelle', 'Lacasse'].map((nom) => idDe(m, nom));
    expect(idsAffiches(m)).toEqual([grisaille, brindelle, lacasse]);

    const premiere = grille(m).querySelector('td[tabindex="0"]');
    expect(premiere).toBe(cellule(m, grisaille, COLONNES[0]));
    premiere.focus();
    await touche('ArrowDown');
    await rendu();
    expect(document.activeElement).toBe(cellule(m, brindelle, COLONNES[0]));
    await touche('ArrowDown');
    await rendu();
    expect(document.activeElement).toBe(cellule(m, lacasse, COLONNES[0]));
    await touche('ArrowDown');
    await rendu();
    expect(document.activeElement).toBe(cellule(m, lacasse, COLONNES[0]));
    await touche('ArrowUp');
    await rendu();
    expect(document.activeElement).toBe(cellule(m, brindelle, COLONNES[0]));

    // Tab depuis la dernière cellule de Brindelle mène à la première de Lacasse.
    cellule(m, brindelle, COLONNES.at(-1)).focus();
    await touche('Tab');
    await rendu();
    expect(document.activeElement).toBe(cellule(m, lacasse, COLONNES[0]));
    // Une seule cellule de la grille dans l'ordre de tabulation.
    expect(grille(m).querySelectorAll('td[tabindex="0"]')).toHaveLength(1);
  });

  test('une saisie qui change la valeur groupée mène la ligne à son nouveau groupe, la cellule garde le focus ; un groupe replié qui la reçoit se déplie ; une entrée par saisie', async () => {
    const m = await evenementOuvert({ personnes: CINQ });
    await grouperPar(m, 'organisation');
    const lacasse = idDe(m, 'Lacasse');
    const brindelle = idDe(m, 'Brindelle');
    const avant = entrees(m).length;

    cellule(m, lacasse, 'organisation').focus();
    await touche('Enter');
    await rendu();
    await saisir(cellule(m, lacasse, 'organisation').querySelector('input'), 'Cercle des Pinsons');
    await touche('Enter');
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(idsDuGroupe(m, PINSONS)).toContain(lacasse);
    expect(groupe(m, 'vide')).toBeNull();
    expect(document.activeElement).toBe(cellule(m, lacasse, 'organisation'));
    expect(entete(m, PINSONS).compte).toBe(t('participants.groupe.compte', { compte: 3 }));

    // Vers un groupe replié : il se déplie, et la cellule garde le focus.
    await cliquer(bascule(m, MERLES));
    expect(idsDuGroupe(m, MERLES)).toEqual([]);
    cellule(m, brindelle, 'organisation').focus();
    await touche('Enter');
    await rendu();
    await saisir(cellule(m, brindelle, 'organisation').querySelector('input'), CLUB);
    await touche('Enter');
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 2);
    expect(bascule(m, MERLES).getAttribute('aria-expanded')).toBe('true');
    expect(idsDuGroupe(m, MERLES)).toContain(brindelle);
    expect(document.activeElement).toBe(cellule(m, brindelle, 'organisation'));
  });

  test('changer de groupement déplie tout : d’une colonne à une autre, ou à l’ajout d’un niveau', async () => {
    const m = await evenementOuvert({ personnes: CINQ });
    await grouperPar(m, 'organisation');
    await cliquer(bascule(m, 'vide'));
    expect(bascule(m, 'vide').getAttribute('aria-expanded')).toBe('false');
    expect(idsAffiches(m)).toHaveLength(4);

    // Le prénom a lui aussi un groupe « vide ».
    await grouperPar(m, 'prenom');
    expect(groupe(m, 'vide')).not.toBeNull();
    expect(ouverts(m).length).toBeGreaterThan(0);
    expect(ouverts(m).every((etat) => etat === 'true')).toBe(true);
    expect(idsAffiches(m)).toHaveLength(5);

    await cliquer(bascule(m, 'vide'));
    expect(idsAffiches(m)).toHaveLength(3);
    await grouperPar(m, 'statut', 2);
    expect(ouverts(m).every((etat) => etat === 'true')).toBe(true);
    expect(idsAffiches(m)).toHaveLength(5);
  });

  test('validée par la sortie du champ, le focus posé ailleurs y reste ; le groupe replié qui reçoit la ligne le reste', async () => {
    const m = await evenementOuvert({ personnes: CINQ });
    await grouperPar(m, 'organisation');
    const lacasse = idDe(m, 'Lacasse');
    const ombrelle = idDe(m, 'Ombrelle');
    const filtre = section(m).querySelector('[data-champ="filtre"]');
    const avant = entrees(m).length;

    cellule(m, lacasse, 'organisation').focus();
    await touche('Enter');
    await rendu();
    await saisir(cellule(m, lacasse, 'organisation').querySelector('input'), 'Cercle des Pinsons');
    await cliquer(filtre);
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(idsDuGroupe(m, PINSONS)).toContain(lacasse);
    expect(document.activeElement).toBe(filtre);

    // Le groupe qui reçoit la ligne, replié avant la saisie, le reste.
    await cliquer(bascule(m, PINSONS));
    cellule(m, ombrelle, 'organisation').focus();
    await touche('Enter');
    await rendu();
    await saisir(cellule(m, ombrelle, 'organisation').querySelector('input'), 'Cercle des Pinsons');
    await cliquer(filtre);
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 2);
    expect(bascule(m, PINSONS).getAttribute('aria-expanded')).toBe('false');
    expect(entete(m, PINSONS).compte).toBe(t('participants.groupe.compte', { compte: 4 }));
    expect(idsAffiches(m)).not.toContain(ombrelle);
    expect(document.activeElement).toBe(filtre);
  });

  test('organisation puis statut : en-têtes imbriqués, comptes, repli du sous-groupe seul ou du parent entier ; rien ne s’écrit', async () => {
    const m = await organisationPuisStatut();
    const avant = empreinte(m);
    const [ombrelle, pervenche] = ['Ombrelle', 'Pervenche'].map((nom) => idDe(m, nom));
    const attendus = groupesGrille(lignesGrille(participants(m), { tri: null, filtre: '' }, cleNormalisee), ['organisation', 'statut'], {
      tri: null,
      cleNormalisee,
      statuts: statuts(m.seance.etat().charge).parId,
    });
    const tous = aplatir(attendus);
    expect(tous.some(({ niveau }) => niveau === 2)).toBe(true);
    expect(groupes(m).map((g) => g.dataset.groupe)).toEqual(tous.map(({ cle }) => cle));
    expect(groupes(m).map((g) => Number(g.dataset.niveau))).toEqual(tous.map(({ niveau }) => niveau));
    for (const attendu of tous) {
      expect(entete(m, attendu.cle), attendu.cle).toEqual(enteteAttendu(attendu));
      expect(idsDuGroupe(m, attendu.cle), attendu.cle).toEqual(lignesVisibles([attendu], new Set()).map(({ id }) => id));
    }
    expect(idsAffiches(m)).toEqual(lignesVisibles(attendus, new Set()).map(({ id }) => id));
    expect(entete(m, MERLES).compte).toBe(t('participants.groupe.compte', { compte: 2 }));
    expect(idsDuGroupe(m, `${MERLES}/statut:ancre`)).toEqual([ombrelle]);
    expect(idsDuGroupe(m, `${MERLES}/statut:mobile`)).toEqual([pervenche]);
    // Seul l'en-tête d'un groupe du premier niveau couvre son corps
    // (rowgroup) ; celui d'un sous-groupe ne nomme que sa ligne (§ 14.5).
    for (const g of groupes(m)) {
      expect(g.querySelector('th').getAttribute('scope'), g.dataset.groupe).toBe(g.dataset.niveau === '1' ? 'rowgroup' : 'row');
    }
    // Un en-tête de sous-groupe est en retrait de celui de son parent.
    expect(bascule(m, `${MERLES}/statut:ancre`).getBoundingClientRect().left).toBeGreaterThan(bascule(m, MERLES).getBoundingClientRect().left);

    await cliquer(bascule(m, `${MERLES}/statut:mobile`));
    expect(bascule(m, `${MERLES}/statut:mobile`).getAttribute('aria-expanded')).toBe('false');
    expect(idsDuGroupe(m, MERLES)).toEqual([ombrelle]);
    expect(entete(m, MERLES).compte).toBe(t('participants.groupe.compte', { compte: 2 }));
    expect(entete(m, `${MERLES}/statut:mobile`).compte).toBe(t('participants.groupe.compte', { compte: 1 }));
    expect(bascule(m, MERLES).getAttribute('aria-expanded')).toBe('true');

    await cliquer(bascule(m, MERLES));
    expect(groupe(m, `${MERLES}/statut:ancre`)).toBeNull();
    expect(groupe(m, `${MERLES}/statut:mobile`)).toBeNull();
    expect(idsDuGroupe(m, MERLES)).toEqual([]);
    expect(idsAffiches(m)).toEqual(lignesVisibles(attendus, new Set([MERLES])).map(({ id }) => id));
    // Déplié, le parent rend ses sous-groupes dans l'état où il les a laissés.
    await cliquer(bascule(m, MERLES));
    expect(bascule(m, `${MERLES}/statut:mobile`).getAttribute('aria-expanded')).toBe('false');
    expect(bascule(m, `${MERLES}/statut:ancre`).getAttribute('aria-expanded')).toBe('true');

    // Tout replier replie le premier niveau ; Tout déplier déplie tous les niveaux.
    await cliquer(section(m).querySelector('[data-commande="toutReplier"]'));
    expect(lignes(m)).toHaveLength(0);
    expect(groupes(m).map((g) => g.dataset.groupe)).toEqual(attendus.map(({ cle }) => cle));
    expect(ouverts(m).every((etat) => etat === 'false')).toBe(true);
    // Un parent déplié après Tout replier montre ses sous-groupes dépliés.
    await cliquer(bascule(m, MERLES));
    expect(ouverts(m).filter((etat) => etat === 'true')).toHaveLength(3);
    expect(idsDuGroupe(m, MERLES)).toEqual([ombrelle, pervenche]);
    await cliquer(section(m).querySelector('[data-commande="toutDeplier"]'));
    expect(groupes(m).map((g) => g.dataset.groupe)).toEqual(tous.map(({ cle }) => cle));
    expect(ouverts(m).every((etat) => etat === 'true')).toBe(true);
    expect(idsAffiches(m)).toEqual(lignesVisibles(attendus, new Set()).map(({ id }) => id));

    await attendreSeance(m);
    expect(empreinte(m)).toEqual(avant);
  });

  test('imbriqués : les flèches sautent tout en-tête ; une ligne menée sous un parent et un sous-groupe repliés les déplie', async () => {
    const m = await organisationPuisStatut();
    const [ombrelle, pervenche, lacasse, grisaille, brindelle] = ['Ombrelle', 'Pervenche', 'Lacasse', 'Grisaille', 'Brindelle'].map((nom) => idDe(m, nom));
    await cliquer(bascule(m, `${MERLES}/statut:ancre`));
    expect(idsAffiches(m)).toEqual([brindelle, grisaille, pervenche, lacasse]);
    cellule(m, grisaille, COLONNES[0]).focus();
    await touche('ArrowDown');
    await rendu();
    expect(document.activeElement).toBe(cellule(m, pervenche, COLONNES[0]));
    await touche('ArrowUp');
    await rendu();
    expect(document.activeElement).toBe(cellule(m, grisaille, COLONNES[0]));
    await cliquer(section(m).querySelector('[data-commande="toutDeplier"]'));
    expect(idsAffiches(m)).toContain(ombrelle);

    // Lacasse rejoint les Merles, mobile comme Pervenche : le sous-groupe
    // et son parent, tous deux repliés, se déplient.
    const destination = `${MERLES}/statut:mobile`;
    expect(cheminDe(groupesGrille(lignesGrille(participants(m), { tri: null, filtre: '' }, cleNormalisee), ['organisation', 'statut'], {
      tri: null,
      cleNormalisee,
      statuts: statuts(m.seance.etat().charge).parId,
    }), pervenche)).toEqual([MERLES, destination]);
    await cliquer(bascule(m, destination));
    await cliquer(bascule(m, MERLES));
    const avant = entrees(m).length;
    cellule(m, lacasse, 'organisation').focus();
    await touche('Enter');
    await rendu();
    await saisir(cellule(m, lacasse, 'organisation').querySelector('input'), CLUB);
    await touche('Enter');
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(bascule(m, MERLES).getAttribute('aria-expanded')).toBe('true');
    expect(bascule(m, destination).getAttribute('aria-expanded')).toBe('true');
    expect(idsDuGroupe(m, destination)).toEqual([pervenche, lacasse]);
    expect(document.activeElement).toBe(cellule(m, lacasse, 'organisation'));
  });

  test('groupée par exclusion, Entrée sur l’exclusion : la ligne change de groupe, garde le focus, déplie son groupe', async () => {
    const m = await evenementOuvert({ tables: 1, personnes: CINQ });
    await grouperPar(m, 'exclu');
    const lacasse = idDe(m, 'Lacasse');
    const avant = entrees(m).length;

    cellule(m, lacasse, 'exclu').focus();
    await touche('Enter');
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(participants(m).find(({ id }) => id === lacasse).exclu).toBe(true);
    expect(idsDuGroupe(m, 'exclu:oui')).toContain(lacasse);
    expect(document.activeElement).toBe(cellule(m, lacasse, 'exclu'));

    // Vers le groupe des présentes, replié : il se déplie, la cellule garde
    // le focus.
    await cliquer(bascule(m, 'exclu:non'));
    expect(bascule(m, 'exclu:non').getAttribute('aria-expanded')).toBe('false');
    cellule(m, lacasse, 'exclu').focus();
    await touche('Enter');
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 2);
    expect(participants(m).find(({ id }) => id === lacasse).exclu).toBe(false);
    expect(bascule(m, 'exclu:non').getAttribute('aria-expanded')).toBe('true');
    expect(idsDuGroupe(m, 'exclu:non')).toContain(lacasse);
    expect(document.activeElement).toBe(cellule(m, lacasse, 'exclu'));
  });

  describe('les conflits du placement montré (§ 7.5)', () => {
    // Deux tables de trois places, numérotées 4 (identifiant 1) et 1
    // (identifiant 2), deux tours. 1 et 2 du Club des Merles, 3 et 4 du
    // Cercle des Pinsons, 5 et 6 sans organisation, 7 des Pinsons, exclue.
    const SEPT = [
      ['Ombrelle', 'Iris', CLUB],
      ['Fontaine', 'Noé', CLUB],
      ['Pervenche', 'Théo', 'Cercle des Pinsons'],
      ['Lacasse', 'Ondine', 'Cercle des Pinsons'],
      ['Grisaille', null, null],
      ['Bruyère', 'Anouk', null],
      ['Sarcelle', 'Capucine', 'Cercle des Pinsons'],
    ];
    // Proposition 1 : au tour 1, 1 et 2, collègues, à la table 4 ; au tour
    // 2, 4 et 5 se revoient à la table 4, 2 et 3 à la table 1, 1 revient à
    // la table 4 et 6 à la table 1. Proposition 2 : au tour 2, 2 et 3 se
    // revoient à la table 4 et y reviennent, 4 et 5 de même à la table 1.
    const PLANS = [
      [
        [[1, 2, 3], [4, 5, 6]],
        [[1, 4, 5], [2, 3, 6]],
      ],
      [
        [[1, 2, 3], [4, 5, 6]],
        [[2, 3, 6], [1, 4, 5]],
      ],
    ];
    const TIRET = '\u{2014}';

    const planFichier = (tours) => ({
      siegesAttribues: false,
      tables: [1, 2],
      capacites: [3, 3],
      tours: tours.length,
      participants: [1, 2, 3, 4, 5, 6],
      placement: tours.map((listes) => ({ sieges: structuredClone(listes), reserve: [] })),
    });

    function chargeSept() {
      const charge = creerCharge({ id: 'evt-conflits', nom: EVENEMENT, siegesParDefaut: 3, tours: 2 });
      charge.participants = SEPT.map(([nom, prenom, organisation], rang) => ({
        id: rang + 1,
        nom,
        prenom,
        organisation,
        courriel: null,
        titrePressenti: null,
        notes: null,
        exclu: rang === 6,
      }));
      charge.tables = [
        { id: 1, numero: 4, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } },
        { id: 2, numero: 1, sieges: null, forme: 'ronde', position: { x: 300, y: 0 } },
      ];
      charge.propositions = PLANS.map((tours, rang) => ({
        id: rang + 1,
        graine: rang + 1,
        arret: 40,
        historique: 1000,
        produitVersion: VERSION.affichee,
        ...planFichier(tours),
      }));
      charge.prochainsIds = { participant: 8, table: 3, proposition: 3 };
      charge.evenement.etat = 'propose';
      return charge;
    }

    // L'événement de la charge, ouvert depuis le disque simulé, en écriture,
    // la section des participants ouverte.
    async function ouvrirSept() {
      const texte = serialiser(chargeSept(), { revision: 1, produitVersion: VERSION.affichee });
      const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `soiree/soiree${SUFFIXES.etat}`, texte }] });
      montes.push(m);
      await m.seance.ouvrir('soiree/soiree');
      await m.seance.passerEnEcriture();
      m.ui.allerA('participants');
      await rendu();
      return m;
    }

    // Un geste du menu « Actions » de la ligne d'une proposition dans sa
    // section, puis le retour aux participants par la navigation des
    // sections.
    async function gesteDeProposition(m, id, nom) {
      m.ui.allerA('propositions');
      await rendu();
      // La ligne amenée dans la fenêtre avant d'ouvrir le menu : le menu, en
      // position fixe, se presse ensuite là où il est posé, sans défiler.
      const ligneProposition = m.racine.querySelector(`[data-section="propositions"] [data-proposition="${id}"]`);
      boutonActions(ligneProposition).scrollIntoView({ block: 'center' });
      await rendu();
      const action = actionDe(ligneProposition, nom);
      await rendu();
      const { x, y } = centre(action);
      await pointer('presser', x, y);
      await pointer('relacher', x, y);
      await rendu();
      await attendreSeance(m);
      await cliquer(m.racine.querySelector('[data-commande="section"][data-cible="participants"]'));
      expect(section(m)).not.toBeNull();
    }

    const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
    const marqueDeGroupe = (m, cle) => groupe(m, cle).querySelector('[data-groupe-conflits]');
    const conflitsDuGroupe = (m, cle) => [...grille(m).querySelectorAll(`[data-conflits="${cle}"] [data-conflit]`)].map(texteDe);
    const marqueDePersonne = (m, id) => ligne(m, id).querySelector('[data-conflit-personne]');
    const toutesLesMarques = (m) => grille(m).querySelectorAll('[data-groupe-conflits], [data-conflits], [data-conflit], [data-conflit-personne]');

    // Ce que montre la liste groupée par organisation sous la proposition 1,
    // ou sous un retenu du même plan.
    const SOUS_LE_PLAN_1 = {
      [MERLES]: [
        `Tour 1, table 4 : Iris Ombrelle et Noé Fontaine ${TIRET} même organisation`,
        `Tour 2, table 4 : Iris Ombrelle ${TIRET} revient à la table 4 (déjà au tour 1)`,
        `Tour 2, table 1 : Noé Fontaine et Théo Pervenche ${TIRET} se revoient (déjà à la table 4 au tour 1)`,
      ],
      [PINSONS]: [
        `Tour 2, table 4 : Ondine Lacasse et Grisaille ${TIRET} se revoient (déjà à la table 1 au tour 1)`,
        `Tour 2, table 1 : Noé Fontaine et Théo Pervenche ${TIRET} se revoient (déjà à la table 4 au tour 1)`,
      ],
      vide: [
        `Tour 2, table 4 : Ondine Lacasse et Grisaille ${TIRET} se revoient (déjà à la table 1 au tour 1)`,
        `Tour 2, table 1 : Anouk Bruyère ${TIRET} revient à la table 1 (déjà au tour 1)`,
      ],
    };

    async function attendreSousLePlan1(m) {
      for (const [cle, attendues] of Object.entries(SOUS_LE_PLAN_1)) {
        expect(texteDe(marqueDeGroupe(m, cle)), cle).toBe(t('participants.conflit.groupe', { nombre: attendues.length }));
        expect(conflitsDuGroupe(m, cle), cle).toEqual(attendues);
      }
      expect(texteDe(marqueDePersonne(m, 1))).toBe('en conflit : même organisation, revient à une table');
      expect(texteDe(marqueDePersonne(m, 3))).toBe('en conflit : se revoient');
      expect(marqueDePersonne(m, 7)).toBeNull();
    }

    test('voir la proposition 1 : marque et nombre par groupe, une ligne par conflit, dans chaque groupe touché ; rien ne s’écrit', async () => {
      const m = await ouvrirSept();
      await gesteDeProposition(m, 1, 'voir');
      expect(m.ui.etat().proposition).toBe(1);
      const avant = { journal: texteJournal(m), etat: texteEtat(m) };
      await grouperPar(m, 'organisation');
      expect(groupes(m).map((g) => g.dataset.groupe)).toEqual([PINSONS, MERLES, 'vide']);
      await attendreSousLePlan1(m);

      // La marque se lit en texte, dans une forme : un cadre de trait plein,
      // non une seule couleur.
      const marque = getComputedStyle(marqueDeGroupe(m, MERLES));
      expect(marque.borderTopStyle).toBe('solid');
      expect(Number.parseFloat(marque.borderTopWidth)).toBeGreaterThanOrEqual(2);
      // Les lignes de conflit d'un groupe précèdent ses lignes de personnes.
      const premiere = grille(m).querySelector(`[data-conflits="${MERLES}"]`);
      expect(premiere.compareDocumentPosition(ligne(m, 1)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(premiere.compareDocumentPosition(groupe(m, MERLES)) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();

      // Replié, le groupe garde sa marque et retire ses lignes de conflit.
      await cliquer(bascule(m, MERLES));
      expect(texteDe(marqueDeGroupe(m, MERLES))).toBe(t('participants.conflit.groupe', { nombre: 3 }));
      expect(conflitsDuGroupe(m, MERLES)).toEqual([]);
      expect({ journal: texteJournal(m), etat: texteEtat(m) }).toEqual(avant);
    });

    test('imbriqués : un en-tête compte son sous-arbre, les lignes vont au plus étroit groupe', async () => {
      const m = await ouvrirSept();
      await gesteDeProposition(m, 1, 'voir');
      await grouperPar(m, 'organisation');
      await grouperPar(m, 'prenom', 2);
      expect(texteDe(marqueDeGroupe(m, MERLES))).toBe(t('participants.conflit.groupe', { nombre: 3 }));
      expect(conflitsDuGroupe(m, MERLES)).toEqual([]);
      const [iris, noe] = ['texte:iris', 'texte:noe'].map((segment) => `${MERLES}/${segment}`);
      expect(texteDe(marqueDeGroupe(m, iris))).toBe(t('participants.conflit.groupe', { nombre: 2 }));
      expect(conflitsDuGroupe(m, iris)).toEqual([SOUS_LE_PLAN_1[MERLES][0], SOUS_LE_PLAN_1[MERLES][1]]);
      expect(conflitsDuGroupe(m, noe)).toEqual([SOUS_LE_PLAN_1[MERLES][0], SOUS_LE_PLAN_1[MERLES][2]]);
      // Capucine Sarcelle, exclue, n'est dans aucun conflit : son groupe n'a
      // pas de marque.
      expect(marqueDeGroupe(m, `${PINSONS}/texte:capucine`)).toBeNull();
    });

    test('retenir la 1 : mêmes marques, lues sur le retenu ; voir la 2 montre les siennes', async () => {
      const m = await ouvrirSept();
      await gesteDeProposition(m, 1, 'retenir');
      expect(m.seance.etat().charge.retenu?.proposition).toBe(1);
      expect(m.ui.etat().proposition).toBeNull();
      await grouperPar(m, 'organisation');
      await attendreSousLePlan1(m);

      await gesteDeProposition(m, 2, 'voir');
      expect(m.ui.etat().proposition).toBe(2);
      await grouperPar(m, 'organisation');
      expect(texteDe(marqueDeGroupe(m, PINSONS))).toBe(t('participants.conflit.groupe', { nombre: 4 }));
      expect(conflitsDuGroupe(m, PINSONS)).toEqual([
        `Tour 2, table 4 : Noé Fontaine et Théo Pervenche ${TIRET} se revoient (déjà à la table 4 au tour 1)`,
        `Tour 2, table 4 : Théo Pervenche ${TIRET} revient à la table 4 (déjà au tour 1)`,
        `Tour 2, table 1 : Ondine Lacasse et Grisaille ${TIRET} se revoient (déjà à la table 1 au tour 1)`,
        `Tour 2, table 1 : Ondine Lacasse ${TIRET} revient à la table 1 (déjà au tour 1)`,
      ]);
    });

    test('une règle désactivée retire ses conflits des groupes et des personnes', async () => {
      const m = await ouvrirSept();
      await gesteDeProposition(m, 1, 'voir');
      await grouperPar(m, 'organisation');
      expect(texteDe(marqueDeGroupe(m, MERLES))).toBe(t('participants.conflit.groupe', { nombre: 3 }));
      await m.seance.executer('modifierReglage', { cle: 'separerOrganisations', valeur: false });
      await attendreSeance(m);
      expect(texteDe(marqueDeGroupe(m, MERLES))).toBe(t('participants.conflit.groupe', { nombre: 2 }));
      expect(conflitsDuGroupe(m, MERLES)).toEqual(SOUS_LE_PLAN_1[MERLES].slice(1));
      expect(texteDe(marqueDePersonne(m, 1))).toBe('en conflit : revient à une table');
    });

    // La colonne « Conflits du placement » : une ligne de texte par tour où
    // la personne est en conflit, ou le tiret ; « se revoient » y nomme qui,
    // « revient à une table » y donne laquelle.
    const toursDe = (m, id) => [...cellule(m, id, 'conflitsPlacement').querySelectorAll('li')].map(texteDe);
    const COLONNE_SOUS_LE_PLAN_1 = new Map([
      [1, ['tour 1 : même organisation', 'tour 2 : revient à la table 4']],
      [2, ['tour 1 : même organisation', 'tour 2 : se revoient avec Théo Pervenche']],
      [3, ['tour 2 : se revoient avec Noé Fontaine']],
      [4, ['tour 2 : se revoient avec Grisaille']],
      [5, ['tour 2 : se revoient avec Ondine Lacasse']],
      [6, ['tour 2 : revient à la table 1']],
      [7, []],
    ]);
    function attendreColonneSousLePlan1(m) {
      for (const [id, attendus] of COLONNE_SOUS_LE_PLAN_1) {
        expect(toursDe(m, id), String(id)).toEqual(attendus);
        if (attendus.length === 0) expect(texteDe(cellule(m, id, 'conflitsPlacement')), String(id)).toBe(TIRET);
        else expect(texteDe(cellule(m, id, 'conflitsPlacement')), String(id)).not.toContain(TIRET);
      }
    }

    test('sans groupement, la colonne après les conflits d’organisation écrit les règles de chaque personne par tour, le tiret sans conflit ; sans tri, sans écriture', async () => {
      const m = await ouvrirSept();
      await gesteDeProposition(m, 1, 'voir');
      expect(selecteur(m).value).toBe('');
      const avant = { journal: texteJournal(m), etat: texteEtat(m) };
      expect(COLONNES.indexOf('conflitsPlacement')).toBe(COLONNES.indexOf('conflits') + 1);
      const entetes = [...grille(m).tHead.rows[0].cells];
      const entete = entetes[COLONNES.indexOf('conflitsPlacement')];
      expect(texteDe(entete)).toBe('Conflits du placement');
      expect(entete.getAttribute('scope')).toBe('col');
      expect(entete.querySelector('button')).toBeNull();
      expect(entete.hasAttribute('aria-sort')).toBe(false);
      expect(texteDe(entetes[COLONNES.indexOf('conflits')])).toContain("Conflit d'organisation");
      attendreColonneSousLePlan1(m);
      // Les marques de la liste groupée restent à la liste groupée.
      expect(toutesLesMarques(m)).toHaveLength(0);
      expect({ journal: texteJournal(m), etat: texteEtat(m) }).toEqual(avant);
    });

    test('la cellule se lit au clavier, la flèche y mène, et ne s’édite pas : Entrée et F2 n’ouvrent rien', async () => {
      const m = await ouvrirSept();
      await gesteDeProposition(m, 1, 'voir');
      const trace = m.trace.length;
      cellule(m, 2, 'conflits').focus();
      await touche('ArrowRight');
      await rendu();
      const mesure = cellule(m, 2, 'conflitsPlacement');
      expect(document.activeElement).toBe(mesure);
      expect(mesure.getAttribute('role')).toBe('gridcell');
      // F2, que l'entrée simulée ne connaît pas, arrive en évènement du
      // document, comme la grille le lit.
      for (const cle of ['Enter', 'F2']) {
        if (cle === 'Enter') await touche(cle);
        else mesure.dispatchEvent(new KeyboardEvent('keydown', { key: cle, bubbles: true, cancelable: true }));
        await rendu();
        expect(mesure.querySelector('input, textarea, [role="group"]'), cle).toBeNull();
        expect(document.activeElement, cle).toBe(mesure);
      }
      expect(toursDe(m, 2)).toEqual(COLONNE_SOUS_LE_PLAN_1.get(2));
      await touche('ArrowRight');
      await rendu();
      expect(document.activeElement).toBe(cellule(m, 2, 'courriel'));
      await attendreSeance(m);
      expect(m.trace.length).toBe(trace);
    });

    test('la colonne suit le placement montré : le retenu, puis la proposition 2 ; groupée, elle reste', async () => {
      const m = await ouvrirSept();
      await gesteDeProposition(m, 1, 'retenir');
      expect(m.ui.etat().proposition).toBeNull();
      attendreColonneSousLePlan1(m);

      await gesteDeProposition(m, 2, 'voir');
      expect(toursDe(m, 1)).toEqual(['tour 1 : même organisation']);
      expect(toursDe(m, 3)).toEqual(['tour 2 : se revoient avec Noé Fontaine ; revient à la table 4']);
      expect(toursDe(m, 4)).toEqual(['tour 2 : se revoient avec Grisaille ; revient à la table 1']);
      expect(toursDe(m, 6)).toEqual([]);
      // Le texte même de l'écran, insécables comprises : celui du t de
      // l'écran, les règles réunies par reglesDuTour.
      const [, regles] = cellule(m, 3, 'conflitsPlacement').querySelector('li').children;
      expect(regles.textContent).toBe(
        tEcran('participants.conflit.reglesDuTour', {
          textes: [
            tEcran('participants.conflit.regle.nouveauxVoisinsAvec', { noms: ['Noé Fontaine'] }),
            tEcran('participants.conflit.regle.nouvelleTableNumero', { tables: [4] }),
          ],
        }),
      );
      expect(regles.textContent).toContain('\u{202F};');

      await grouperPar(m, 'organisation');
      expect(toursDe(m, 3)).toEqual(['tour 2 : se revoient avec Noé Fontaine ; revient à la table 4']);
      // La marque de la personne, dans la liste groupée, garde ses textes courts.
      expect(texteDe(marqueDePersonne(m, 3))).toBe('en conflit : se revoient, revient à une table');
    });

    test('à 1366 et 1024 de large, la colonne remplie tient dans la grille, la grille dans son conteneur', async () => {
      const avant = { largeur: innerWidth, hauteur: innerHeight };
      try {
        for (const largeur of [1366, 1024]) {
          await fixerCadre(largeur, 700);
          const m = await ouvrirSept();
          await gesteDeProposition(m, 1, 'voir');
          attendreColonneSousLePlan1(m);
          const defilement = grille(m).parentElement;
          expect(defilement.scrollWidth, `${largeur}`).toBeLessThanOrEqual(defilement.clientWidth);
          const mesure = cellule(m, 1, 'conflitsPlacement').getBoundingClientRect();
          for (const li of cellule(m, 1, 'conflitsPlacement').querySelectorAll('li')) {
            expect(li.getBoundingClientRect().right, `${largeur}`).toBeLessThanOrEqual(mesure.right);
          }
          m.demonter();
          montes.splice(montes.indexOf(m), 1);
        }
      } finally {
        await fixerCadre(avant.largeur, avant.hauteur);
      }
    });

    test('une règle désactivée quitte la colonne ; ni proposition montrée ni retenu : le tiret partout', async () => {
      const m = await ouvrirSept();
      for (const id of COLONNE_SOUS_LE_PLAN_1.keys()) expect(texteDe(cellule(m, id, 'conflitsPlacement'))).toBe(TIRET);
      await gesteDeProposition(m, 1, 'voir');
      await m.seance.executer('modifierReglage', { cle: 'separerOrganisations', valeur: false });
      await attendreSeance(m);
      expect(toursDe(m, 1)).toEqual(['tour 2 : revient à la table 4']);
      expect(toursDe(m, 2)).toEqual(['tour 2 : se revoient avec Théo Pervenche']);
      // Une personne placée exclue : la proposition montrée dérive, ses
      // conflits ne se comptent pas, et la colonne le dit au lieu du tiret.
      await m.seance.executer('exclureParticipant', { id: 3 });
      await attendreSeance(m);
      for (const id of COLONNE_SOUS_LE_PLAN_1.keys()) {
        if (id === 3) continue;
        expect(texteDe(cellule(m, id, 'conflitsPlacement'))).toBe(t('participants.conflit.nonCompte'));
      }
    });

    test('ni proposition montrée ni retenu : aucune marque ; sans groupement, rien ne change', async () => {
      const m = await ouvrirSept();
      expect(m.ui.etat().proposition).toBeNull();
      await grouperPar(m, 'organisation');
      expect(groupes(m)).toHaveLength(3);
      expect(toutesLesMarques(m)).toHaveLength(0);

      await gesteDeProposition(m, 1, 'voir');
      expect(m.ui.etat().proposition).toBe(1);
      expect(selecteur(m).value).toBe('');
      expect(lignes(m)).toHaveLength(7);
      expect(toutesLesMarques(m)).toHaveLength(0);
      expect(texteDe(cellule(m, 1, 'nom'))).toBe('Ombrelle');
    });
  });
});

// --- L'habillage : carte, bandes, légende et pastilles ----------------------

// La couleur qu'un jeton donne dans le thème courant, relue sur une sonde.
function jeton(nom) {
  const sonde = document.createElement('span');
  sonde.style.color = `var(${nom})`;
  document.body.append(sonde);
  const couleur = composantes(getComputedStyle(sonde).color);
  sonde.remove();
  return couleur;
}

const fondDe = (element) => composantes(getComputedStyle(element).backgroundColor);
const opaque = (element) => fondDe(element)[3] > 0;
const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();

// La pastille d'un conteneur : le premier élément qu'il contient dont le
// fond est peint, ou null.
const pastilleDans = (conteneur) => [...conteneur.querySelectorAll('*')].find(opaque) ?? null;

// La région titrée de la section : la carte des participants.
const carte = (m) => section(m).querySelector('section[aria-labelledby]');
const legende = (m) => section(m).querySelector(`[aria-label="${t('participants.legende.titre')}"]`);

// Sept organisations — une de plus que la palette —, une exclue, une
// personne sans organisation et une au titre pressenti.
const SEPT = [
  { nom: 'Quenouillet', organisation: 'Atelier Pivoine' },
  { nom: 'Brindelle', organisation: 'Banc des Loutres', exclu: true },
  { nom: 'Calvaille', organisation: 'Cercle des Grives', titre: 'hôtesse' },
  { nom: 'Doucemer', organisation: 'Cercle des Grives' },
  { nom: 'Esquirol', organisation: 'Dune des Hérons' },
  { nom: 'Faverolle', organisation: 'Étang des Sarcelles' },
  { nom: 'Glanduc', organisation: 'Forge des Martres' },
  { nom: 'Houblonnet', organisation: 'Grange des Mulots' },
  { nom: 'Isardin' },
];

describe('l’habillage de la liste : carte, bandes, légende, pastilles', () => {
  test('la carte « Participants » : sa ligne de comptes suit la liste, le formulaire d’ajout en est la bande de tête, sur le fond sourd, avant la grille', async () => {
    const m = await evenementOuvert({ personnes: SEPT });
    const region = carte(m);
    expect(region).not.toBeNull();
    expect(texteDe(document.getElementById(region.getAttribute('aria-labelledby')))).toBe(t('coquille.section.participants'));
    const ligneDeComptes = () => [...region.querySelectorAll('p')].map((p) => p.textContent);
    expect(comptesEntete(participants(m))).toEqual({ personnes: 9, aPlacer: 8, exclues: 1, organisations: 7, partielles: 0 });
    expect(ligneDeComptes()).toContain(t('participants.entete.comptes', comptesEntete(participants(m))));

    await m.seance.executer('exclureParticipant', { id: idDe(m, 'Isardin') });
    await attendreSeance(m);
    expect(ligneDeComptes()).toContain(t('participants.entete.comptes', { personnes: 9, aPlacer: 7, exclues: 2, organisations: 7 }));
    // Deux présences partielles, dont celle d'une exclue, qui ne compte pas :
    // « 1 présence partielle » s'ajoute à la ligne.
    expect(ligneDeComptes().join(' ')).not.toContain('présence');
    await m.seance.executer('changerPresence', { id: idDe(m, 'Quenouillet'), tours: [2] });
    await m.seance.executer('changerPresence', { id: idDe(m, 'Isardin'), tours: [1] });
    await attendreSeance(m);
    expect(ligneDeComptes()).toContain(t('participants.entete.comptes', { personnes: 9, aPlacer: 7, exclues: 2, organisations: 7, partielles: 1 }));
    expect(ligneDeComptes().join(' ')).toContain('1 présence partielle');

    expect(region.contains(formulaire(m))).toBe(true);
    expect(fondDe(formulaire(m))).toEqual(jeton('--couleur-carte-fond-sourd'));
    expect(formulaire(m).compareDocumentPosition(grille(m)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // « Ajouter » est l'action principale de la carte : pleine, haute d'une cible.
    const ajout = formulaire(m).querySelector('[data-commande="ajouter"]');
    expect(fondDe(ajout)).toEqual(jeton('--couleur-action-fond'));
    expect(composantes(getComputedStyle(ajout).color)).toEqual(jeton('--couleur-action-texte'));
    expect(ajout.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    // « Exporter la liste » est dans l'en-tête de la carte, avant le formulaire.
    const exporter = region.querySelector('[data-commande="exporter"]');
    expect(exporter.compareDocumentPosition(formulaire(m)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('la légende : une pastille par organisation, dans l’ordre des teintes, avec son compte, la teinte de son rang ; un filtre ne la change pas', async () => {
    const m = await evenementOuvert({ personnes: SEPT });
    const teintes = teintesOrganisations(participants(m));
    const attendue = [...teintes].map(([nom, rang]) => ({
      texte: t('participants.legende.element', { nom, compte: participants(m).filter((p) => p.organisation === nom).length }),
      rang,
    }));
    expect(attendue.map(({ rang }) => rang)).toEqual([1, 2, 3, 4, 5, 6, null]);
    const lue = () =>
      [...legende(m).querySelectorAll('li')].map((li) => ({ texte: texteDe(li), fond: fondDe(pastilleDans(li)) }));
    const peinte = attendue.map(({ texte, rang }) => ({
      texte,
      fond: jeton(rang === null ? '--couleur-neutre-fond' : `--couleur-organisation-${rang}-fond`),
    }));
    expect(lue()).toEqual(peinte);
    expect(lue()[2].texte).toBe('Cercle des Grives \u{00B7} 2');

    await saisir(section(m).querySelector('[data-champ="filtre"]'), 'Grives');
    await rendu();
    expect(idsAffiches(m)).toHaveLength(2);
    expect(lue()).toEqual(peinte);
  });

  test('la grille : organisation en pastille de sa teinte, stable sous le filtre ; « exclue » et le titre pressenti en pastilles à icône ; encre de la page', async () => {
    const m = await evenementOuvert({ personnes: SEPT });
    const teintes = teintesOrganisations(participants(m));
    const encre = jeton('--couleur-page-texte');
    for (const p of participants(m)) {
      const pastille = pastilleDans(cellule(m, p.id, 'organisation'));
      if (p.organisation === null) {
        expect(pastille, p.nom).toBeNull();
        continue;
      }
      const rang = teintes.get(p.organisation);
      expect(texteDe(pastille), p.nom).toBe(p.organisation);
      expect(fondDe(pastille), p.nom).toEqual(jeton(rang === null ? '--couleur-neutre-fond' : `--couleur-organisation-${rang}-fond`));
      expect(composantes(getComputedStyle(pastille).color), p.nom).toEqual(encre);
    }
    const loutres = idDe(m, 'Brindelle');
    const exclue = pastilleDans(cellule(m, loutres, 'exclu'));
    expect(texteDe(exclue)).toBe(t('participants.grille.exclue'));
    expect(fondDe(exclue)).toEqual(jeton('--couleur-neutre-fond'));
    expect(exclue.querySelector('svg')).not.toBeNull();
    const presente = cellule(m, idDe(m, 'Doucemer'), 'exclu');
    expect(texteDe(presente)).toBe(t('participants.grille.presente'));
    expect(pastilleDans(presente)).toBeNull();
    const titre = pastilleDans(cellule(m, idDe(m, 'Calvaille'), 'titrePressenti'));
    expect(texteDe(titre)).toBe('hôtesse');
    expect(fondDe(titre)).toEqual(jeton('--couleur-information-fond'));
    expect(titre.querySelector('svg')).not.toBeNull();
    expect(pastilleDans(cellule(m, idDe(m, 'Doucemer'), 'titrePressenti'))).toBeNull();

    // Le filtre ne repeint rien : la teinte se lit sur la liste entière.
    const grives = idDe(m, 'Doucemer');
    const avant = fondDe(pastilleDans(cellule(m, grives, 'organisation')));
    await saisir(section(m).querySelector('[data-champ="filtre"]'), 'Doucemer');
    await rendu();
    expect(idsAffiches(m)).toEqual([grives]);
    expect(fondDe(pastilleDans(cellule(m, grives, 'organisation')))).toEqual(avant);

    // En sombre, la pastille prend la teinte sombre du même rang.
    await sousTheme('sombre', async () => {
      expect(fondDe(pastilleDans(cellule(m, grives, 'organisation')))).toEqual(jeton(`--couleur-organisation-${teintes.get('Cercle des Grives')}-fond`));
    });
    expect(RANGS_ORGANISATION).toBe(6);
  });

  test('les actions de ligne sont des boutons secondaires : fond de la carte, filet de la page, rayon de 8 px', async () => {
    const m = await evenementOuvert({ personnes: SEPT.slice(0, 2) });
    const id = idDe(m, 'Quenouillet');
    for (const nom of ['fiche', 'voirSurLePlan', 'exclureParticipant', 'supprimerParticipant']) {
      const bouton = commandeDeLigne(m, id, nom);
      const style = getComputedStyle(bouton);
      expect(fondDe(bouton), nom).toEqual(jeton('--couleur-carte-fond'));
      expect(composantes(style.borderTopColor), nom).toEqual(jeton('--couleur-page-filet'));
      expect(style.borderTopLeftRadius, nom).toBe('8px');
    }
  });

  test('la fiche est une carte : fond de la carte, filet de la carte, rayon de 12 px', async () => {
    const m = await evenementOuvert({ personnes: SEPT.slice(0, 2) });
    m.ui.ouvrirFiche(idDe(m, 'Quenouillet'));
    await rendu();
    const style = getComputedStyle(fiche(m));
    expect(fondDe(fiche(m))).toEqual(jeton('--couleur-carte-fond'));
    expect(composantes(style.borderTopColor)).toEqual(jeton('--couleur-carte-filet'));
    expect(style.borderTopLeftRadius).toBe('12px');
  });
});

describe('l’habillage dans le cadre : rien ne déborde, rien ne se cache sous le bord', () => {
  // Pose le cadre largeur × hauteur le temps de mesure, puis rend celui d'avant.
  async function dansLeCadre(largeur, hauteur, mesure) {
    const avant = { largeur: innerWidth, hauteur: innerHeight };
    await fixerCadre(largeur, hauteur);
    try {
      await mesure();
    } finally {
      await fixerCadre(avant.largeur, avant.hauteur);
    }
  }

  for (const largeur of [1366, 1024]) {
    test(`à ${largeur} × 700 : la page ne défile pas en largeur, la carte tient dans la fenêtre, la grille dans la carte, la pastille « tours 1 à 3 et 5 » et quatre conflits compris`, async () => {
      await dansLeCadre(largeur, 700, async () => {
        const m = await evenementOuvert({ personnes: SEPT, tours: 5 });
        await m.seance.executer('changerPresence', { id: idDe(m, 'Calvaille'), tours: [1, 2, 3, 5] });
        // Quatre conflits : leurs pastilles passent à la ligne dans leur
        // cellule, sans élargir la grille.
        const conflits = ['Étang des Sarcelles', 'Grange des Mulots', 'Forge des Martres', 'Dune des Hérons'];
        await m.seance.executer('changerConflits', { id: idDe(m, 'Quenouillet'), organisations: conflits });
        m.ui.ouvrirFiche(idDe(m, 'Calvaille'));
        await attendreSeance(m);
        // La pastille de la présence la plus longue tient dans sa cellule.
        const presence = cellule(m, idDe(m, 'Calvaille'), 'presence');
        expect(presence.querySelector('[data-presence="partielle"]').textContent.trim()).toBe('tours 1 à 3 et 5');
        const pastille = presence.querySelector('[data-presence="partielle"] > *').getBoundingClientRect();
        expect(pastille.right).toBeLessThanOrEqual(presence.getBoundingClientRect().right);
        expect(pastille.left).toBeGreaterThanOrEqual(presence.getBoundingClientRect().left);
        const conflit = cellule(m, idDe(m, 'Quenouillet'), 'conflits');
        expect(conflit.querySelectorAll('[data-conflits-personne] li')).toHaveLength(conflits.length);
        // La colonne des inclusions est masquée par défaut.
        expect(grille(m).querySelector('[data-champ="inclusions"]')).toBeNull();
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(innerWidth);
        const region = carte(m).getBoundingClientRect();
        expect(region.right).toBeLessThanOrEqual(innerWidth);
        expect(fiche(m).getBoundingClientRect().right).toBeLessThanOrEqual(innerWidth);
        // Le conteneur de défilement tient dans la carte, et le tableau dans
        // le conteneur : aucune colonne, celle des actions de ligne comprise,
        // ne se cache au-delà de son bord.
        const defilement = grille(m).parentElement;
        expect(defilement.getBoundingClientRect().right).toBeLessThanOrEqual(region.right);
        expect(defilement.scrollWidth, 'le tableau défile en largeur dans son conteneur').toBeLessThanOrEqual(defilement.clientWidth);
        for (const li of legende(m).querySelectorAll('li')) expect(li.getBoundingClientRect().right).toBeLessThanOrEqual(region.right);
        // Chaque action de ligne tient sur une ligne : les boîtes de son
        // texte partagent un même haut.
        for (const rangee of lignes(m)) {
          for (const bouton of rangee.lastElementChild.querySelectorAll('button')) {
            const etendue = document.createRange();
            etendue.selectNodeContents(bouton);
            const hauts = new Set([...etendue.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
            expect(hauts.size, `${rangee.dataset.participant} : ${bouton.textContent.trim()}`).toBe(1);
          }
        }
      });
    });
  }

  test('à 1 366 × 700, les cas limites triés : en-têtes d’une ligne, actions sur deux rangées, prénoms et présence d’un tenant', async () => {
    await dansLeCadre(1366, 700, async () => {
      const m = await evenementOuvert({ tours: 4, tables: 1 });
      const octets = await octetsLivres(CAS_LIMITES);
      await m.seance.executer('importerParticipants', { apercu: apercuPour(m, decoder(octets).texte), mode: 'ajouter' });
      await attendreSeance(m);
      await m.seance.executer('changerPresence', { id: idDe(m, 'Pommerel'), tours: [3, 4] });
      await m.seance.executer('changerConflits', { id: idDe(m, 'Marbrelle'), organisations: ['Société des Hérons'] });
      await attendreSeance(m);
      const tri = section(m).querySelector('[data-commande="trier"][data-cible="nom"]');
      await cliquer(tri);
      await cliquer(tri);
      expect(tri.closest('th').getAttribute('aria-sort')).toBe('descending');
      expect(participants(m).some((p) => p.exclu)).toBe(true);

      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(innerWidth);
      const defilement = grille(m).parentElement;
      expect(defilement.scrollWidth, 'le tableau défile en largeur dans son conteneur').toBeLessThanOrEqual(defilement.clientWidth);
      // L'en-tête garde la hauteur d'une ligne : aucun intitulé ne se
      // replie, celui des conflits d'organisation compris, hors de celui des
      // conflits du placement, une mesure, sur deux lignes entre ses mots.
      const entetes = [...grille(m).tHead.rows[0].cells];
      expect(entetes.map(texteDe)).toContain(t('participants.colonne.conflits'));
      const mesure = entetes[COLONNES.indexOf('conflitsPlacement')];
      expect(texteDe(mesure)).toBe(t('participants.colonne.conflitsPlacement'));
      expect(rangeesDeTexte(mesure)).toBe(2);
      for (const entete of entetes.filter((e) => e !== mesure)) expect(rangeesDeTexte(entete), texteDe(entete)).toBe(1);
      // Les quatre actions de chaque ligne, sur deux rangées au plus, chacune
      // sur une ligne ; « Réintégrer » sur celle de la personne exclue.
      for (const rangee of lignes(m)) {
        const boutons = [...rangee.lastElementChild.querySelectorAll('button')];
        expect(boutons, rangee.dataset.participant).toHaveLength(4);
        const hauts = new Set(boutons.map((bouton) => Math.round(bouton.getBoundingClientRect().top)));
        expect(hauts.size, `${rangee.dataset.participant} : rangées d’actions`).toBeLessThanOrEqual(2);
        for (const bouton of boutons) expect(rangeesDeTexte(bouton), bouton.textContent.trim()).toBe(1);
      }
      // Un prénom d'un mot tient sur une ligne : il ne se coupe pas entre
      // deux lettres.
      for (const p of participants(m).filter(({ prenom }) => prenom !== null)) {
        expect(p.prenom.split(' '), p.prenom).toHaveLength(1);
        expect(rangeesDeTexte(cellule(m, p.id, 'prenom')), p.prenom).toBe(1);
      }
      // Les actions forment deux colonnes alignées d'une ligne à l'autre :
      // « Voir sur le plan » et « Supprimer » partagent un même bord gauche.
      const gauche = (id, nom) => Math.round(commandeDeLigne(m, id, nom).getBoundingClientRect().left);
      const gauches = new Set(idsAffiches(m).flatMap((id) => [gauche(id, 'voirSurLePlan'), gauche(id, 'supprimerParticipant')]));
      expect(gauches.size).toBe(1);
      // La pastille des tours nommés tient sur une ligne, dans sa cellule.
      const presence = cellule(m, idDe(m, 'Pommerel'), 'presence');
      const pastille = presence.querySelector('[data-presence="partielle"]');
      expect(texteDe(pastille)).toBe('tours 3 et 4');
      expect(rangeesDeTexte(pastille)).toBe(1);
      expect(pastille.getBoundingClientRect().right).toBeLessThanOrEqual(presence.getBoundingClientRect().right);
    });
  });

  test('à 1 366 × 700, le refus d’une action de ligne se replie dans sa cellule : la grille ne s’élargit pas', async () => {
    await dansLeCadre(1366, 700, async () => {
      const m = await evenementOuvert({ personnes: SEPT, tours: 3 });
      const id = idDe(m, 'Calvaille');
      await m.seance.executer('exclureParticipant', { id });
      await attendreSeance(m);
      const defilement = grille(m).parentElement;
      const avant = defilement.clientWidth;
      // La séance refuse la réintégration, comme sous une place réservée.
      vi.spyOn(m.seance, 'executer').mockImplementation(() =>
        Promise.reject(
          Object.assign(new Error('PLACE_RESERVEE'), { code: 'PLACE_RESERVEE', details: { siege: 1, tour: 3, portee: 'tour' } }),
        ),
      );
      await cliquer(commandeDeLigne(m, id, 'reintegrerParticipant'));
      await attendreSeance(m);
      vi.restoreAllMocks();
      const refus = ligne(m, id).lastElementChild.querySelector('[data-refus="PLACE_RESERVEE"]');
      expect(refus).not.toBeNull();
      expect(defilement.clientWidth).toBe(avant);
      expect(defilement.scrollWidth, 'le tableau défile en largeur dans son conteneur').toBeLessThanOrEqual(defilement.clientWidth);
      expect(refus.getBoundingClientRect().right).toBeLessThanOrEqual(ligne(m, id).lastElementChild.getBoundingClientRect().right);
      // Le refus prend la largeur des deux colonnes d'actions, de « Fiche »
      // à « Voir sur le plan » au moins : sa phrase reste lisible.
      expect(Math.round(refus.getBoundingClientRect().left)).toBe(Math.round(commandeDeLigne(m, id, 'fiche').getBoundingClientRect().left));
      expect(refus.getBoundingClientRect().right).toBeGreaterThanOrEqual(commandeDeLigne(m, id, 'voirSurLePlan').getBoundingClientRect().right);
    });
  });

  // La largeur en pixels d'un jeton d'espacement, résolue dans la section.
  function espace(m, jeton) {
    const sonde = document.createElement('div');
    sonde.style.width = `var(${jeton})`;
    section(m).append(sonde);
    const largeur = sonde.getBoundingClientRect().width;
    sonde.remove();
    return largeur;
  }

  test('la tenue suit la place de la carte, non la fenêtre : carte sous 86 rem, cellules serrées ; carte sous 80 rem, en-têtes repliables et actions en ligne', async () => {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    // Une fenêtre de plus de 86 rem dont la carte en a moins : les cellules
    // et les bords de la ligne se serrent, les en-têtes restent d'une ligne.
    await dansLeCadre(1400, 700, async () => {
      const m = await evenementOuvert({ personnes: SEPT });
      const defilement = grille(m).parentElement;
      expect(innerWidth).toBeGreaterThan(86 * rem);
      expect(defilement.clientWidth).toBeLessThan(86 * rem);
      const id = idDe(m, 'Calvaille');
      expect(parseFloat(getComputedStyle(cellule(m, id, 'prenom')).paddingRight)).toBe(espace(m, '--espace-1'));
      expect(parseFloat(getComputedStyle(cellule(m, id, 'prenom')).paddingLeft)).toBe(espace(m, '--espace-1'));
      expect(parseFloat(getComputedStyle(cellule(m, id, 'exclu')).paddingLeft)).toBe(espace(m, '--espace-1'));
      expect(parseFloat(getComputedStyle(ligne(m, id).firstElementChild).paddingLeft)).toBe(espace(m, '--espace-3'));
      // Chaque en-tête sur une ligne, hors de celui des conflits du
      // placement, qui se replie toujours entre ses mots.
      for (const [rang, entete] of [...grille(m).tHead.rows[0].cells].entries()) {
        const attendu = COLONNES[rang] === 'conflitsPlacement' ? 'normal' : 'nowrap';
        expect(getComputedStyle(entete).whiteSpace, texteDe(entete)).toBe(attendu);
      }
    });
    // Une fenêtre de plus de 80 rem dont la carte en a moins : les en-têtes
    // se replient entre leurs mots, les actions ne forment pas de grille.
    await dansLeCadre(1300, 700, async () => {
      const m = await evenementOuvert({ personnes: SEPT });
      const defilement = grille(m).parentElement;
      expect(innerWidth).toBeGreaterThan(80 * rem);
      expect(defilement.clientWidth).toBeLessThan(80 * rem);
      for (const entete of grille(m).tHead.rows[0].cells) expect(getComputedStyle(entete).whiteSpace, texteDe(entete)).not.toBe('nowrap');
      const commandes = commandeDeLigne(m, idDe(m, 'Calvaille'), 'fiche').parentElement;
      expect(getComputedStyle(commandes).display).not.toBe('grid');
    });
  });

  test('à 1 366 × 700, les cas limites triés sous l’avertissement des places manquantes : la grille en haut, le « Réintégrer » de la personne exclue se voit et répond au point', async () => {
    await dansLeCadre(1366, 700, async () => {
      const m = await evenementOuvert({ tours: 4, tables: 1 });
      const octets = await octetsLivres(CAS_LIMITES);
      await m.seance.executer('importerParticipants', { apercu: apercuPour(m, decoder(octets).texte), mode: 'ajouter' });
      // Exclure puis réintégrer une personne laisse, dans la zone des
      // annonces à côté de la tête, l'avertissement des places manquantes,
      // qui abaisse la carte de la grille de la hauteur de sa boîte.
      const cible = participants(m).find((p) => !p.exclu && p.courriel === null);
      await m.seance.executer('exclureParticipant', { id: cible.id });
      await m.seance.executer('reintegrerParticipant', { id: cible.id });
      await attendreSeance(m);
      expect(m.racine.querySelector('[data-annonces] [data-avertissement="PLACES_MANQUANTES"]')).not.toBeNull();
      const tri = section(m).querySelector('[data-commande="trier"][data-cible="nom"]');
      await cliquer(tri);
      await cliquer(tri);
      expect(tri.closest('th').getAttribute('aria-sort')).toBe('descending');
      // Sans focus, la grille et ses ancêtres ramenés en haut : la ligne de
      // la personne exclue tient dans la hauteur de la fenêtre, et le point
      // du centre de son « Réintégrer » atteint ce bouton, rien ne le couvre.
      document.activeElement?.blur();
      for (let ancetre = grille(m).parentElement; ancetre !== null; ancetre = ancetre.parentElement) {
        if (ancetre.scrollHeight > ancetre.clientHeight) ancetre.scrollTop = 0;
      }
      await rendu();
      const exclue = participants(m).find((p) => p.exclu);
      expect(exclue).toBeDefined();
      const reintegrer = commandeDeLigne(m, exclue.id, 'reintegrerParticipant');
      const boite = reintegrer.getBoundingClientRect();
      expect(boite.top, 'le haut de « Réintégrer » sous le haut de la grille').toBeGreaterThanOrEqual(grille(m).getBoundingClientRect().top);
      expect(boite.bottom, 'le bas de « Réintégrer » dans la fenêtre').toBeLessThanOrEqual(innerHeight);
      const atteint = document.elementFromPoint(boite.left + boite.width / 2, boite.top + boite.height / 2);
      expect(reintegrer.contains(atteint), 'le centre de « Réintégrer » atteint le bouton').toBe(true);
    });
  });

  test('dans une fenêtre basse, le signal d’orthographe et le refus du nom viennent dans la fenêtre, à côté de leur champ', async () => {
    await dansLeCadre(1024, 420, async () => {
      const m = await evenementOuvert({ personnes: [{ nom: 'Ombrelle', prenom: 'Iris', organisation: CLUB }] });
      await saisir(champ(m, 'organisation'), 'club des  merles');
      const signal = formulaire(m).querySelector('[data-avertissement]');
      expect(visible(signal)).toBe(true);
      await cliquer(signal.querySelector('[data-commande="reprendreOrthographe"]'));
      // Le champ du nom au bord bas de la fenêtre : Entrée y pose le refus
      // dessous, que le défilement amène dans la fenêtre.
      await saisir(champ(m, 'nom'), '  ');
      champ(m, 'nom').scrollIntoView({ block: 'end' });
      champ(m, 'nom').focus({ preventScroll: true });
      await touche('Enter');
      await vi.waitFor(() => expect(champ(m, 'nom').getAttribute('aria-describedby')).not.toBeNull());
      await rendu();
      const message = document.getElementById(champ(m, 'nom').getAttribute('aria-describedby'));
      expect(visible(message)).toBe(true);
      expect(participants(m)).toHaveLength(1);
    });
  });
});

// --- « Voir sur le plan » depuis la grille (§ 7.1, § 5.8) -------------------

describe('« Voir sur le plan » depuis sa ligne de la grille', () => {
  // Le plan ne se dessine que dans un cadre qui lui donne une vue : celui
  // de 1 366 × 700 le temps de l'épreuve, puis celui d'avant.
  let avant = null;
  beforeEach(async () => {
    avant = { largeur: innerWidth, hauteur: innerHeight };
    await fixerCadre(1366, 700);
  });
  afterEach(async () => {
    await fixerCadre(avant.largeur, avant.hauteur);
  });

  // Les chaises marquées [data-marque=miseEnEvidence], « table:siège ».
  const marquees = (m) =>
    [...m.racine.querySelectorAll('[data-marque="miseEnEvidence"]')].map((marque) => marque.closest('[data-siege]').dataset.siege);
  // La place d'une personne au tour donné, « table:siège », ou null hors de
  // toute chaise : dans le placement que le plan montre, ou dans celui de la
  // proposition donnée, le retenu pour null.
  function placeAuTour(m, id, tour, proposition = m.ui.etat().proposition) {
    const etat = etatPlaces(m.seance.etat().charge, { tour, proposition });
    for (const table of etat.tables) {
      const chaise = table.chaises.find(({ occupant }) => occupant === id);
      if (chaise !== undefined) return `${table.id}:${chaise.siege}`;
    }
    return null;
  }

  // Sept personnes, deux tables de quatre, trois tours, nombre propositions
  // dont la première est retenue ; rend le montage et l'identifiant de la
  // personne de NOMS[2]. Le plan montre le tour 1.
  async function montage({ nombre = 1 } = {}) {
    const m = await evenementOuvert({ sieges: 4, tours: 3, tables: 2, personnes: NOMS.slice(0, 7).map((nom) => ({ nom })) });
    await m.seance.executer('modifierReglage', { cle: 'attribuerSieges', valeur: true });
    await m.app.generation().generer({ graine: 1, nombre, arret: 50, historique: 1000 });
    const [proposition] = m.seance.etat().charge.propositions;
    await m.seance.executer('retenirProposition', { id: proposition.id });
    return { m, id: idDe(m, NOMS[2]) };
  }

  // Clique « Voir sur le plan » sur la ligne de la personne, attend la vue,
  // les tables du tour — deux par défaut — et le retrait de la demande de
  // centrer ; rend la barre de la mise en évidence.
  async function voir(m, id, { tables = 2 } = {}) {
    await cliquer(commandeDeLigne(m, id, 'voirSurLePlan'));
    expect(m.ui.etat().section).toBe('plan');
    expect(m.ui.etat().miseEnEvidence).toBe(id);
    await vi.waitFor(() => expect(m.racine.querySelector('[data-vue]')?.getAttribute('transform') ?? null).not.toBeNull());
    await vi.waitFor(() => expect(m.racine.querySelectorAll('[data-table]')).toHaveLength(tables));
    await vi.waitFor(() => expect(m.ui.etat().centrerEvidence).toBe(false));
    await rendu();
    const barre = m.racine.querySelector('[data-evidence]');
    expect(barre).not.toBeNull();
    expect(Number(barre.dataset.evidence)).toBe(id);
    return barre;
  }

  // La personne sans chaise au tour 1 — absente, ou laissée dans la
  // réserve —, assise aux tours 2 et 3.
  const CAS = [
    ['absente au tour montré', (m, id) => m.seance.executer('changerPresence', { id, tours: [2, 3] })],
    ['dans la réserve au tour montré', (m, id) => m.seance.executer('retirerDuTour', { tour: 1, participant: id })],
  ];

  test.each(CAS)('%s, assise à un autre tour : le plan s’ouvre au premier tour où elle est assise, sa chaise marquée', async (_cas, poser) => {
    const { m, id } = await montage();
    await poser(m, id);
    await rendu();
    expect(m.ui.etat().tour).toBe(1);
    expect(placeAuTour(m, id, 1)).toBeNull();
    expect(placeAuTour(m, id, 2)).not.toBeNull();

    const barre = await voir(m, id);
    expect(m.ui.etat().tour).toBe(2);
    expect(marquees(m), 'une chaise marquée au tour où elle est assise').toHaveLength(1);
    expect(marquees(m)).toEqual([placeAuTour(m, id, 2)]);
    expect(barre.textContent).not.toContain(tEcran('plan.evidence.absenteAuTour', { tour: 2 }));
    expect(barre.textContent).not.toContain(tEcran('plan.evidence.reserveAuTour', { tour: 2 }));
  });

  test('assise au tour montré, qui n’est pas le premier où elle l’est : le tour montré reste', async () => {
    const { m, id } = await montage();
    await m.seance.executer('changerPresence', { id, tours: [2, 3] });
    m.ui.montrerTour(3);
    await rendu();
    expect(placeAuTour(m, id, 3)).not.toBeNull();

    await voir(m, id);
    expect(m.ui.etat().tour).toBe(3);
    expect(marquees(m)).toEqual([placeAuTour(m, id, 3)]);
  });

  test('une proposition montrée : le tour se cherche dans ce placement, non dans le retenu', async () => {
    const { m, id } = await montage({ nombre: 2 });
    // La seconde proposition, que le retenu ne copie pas.
    const autre = m.seance.etat().charge.propositions[1];
    expect(autre.id).not.toBe(m.seance.etat().charge.retenu.proposition);
    // Absente au tour 1 partout ; le retenu la laisse aussi dans la réserve
    // au tour 2, la proposition l'y assied.
    await m.seance.executer('changerPresence', { id, tours: [2, 3] });
    await m.seance.executer('retirerDuTour', { tour: 2, participant: id });
    m.ui.montrerProposition(autre.id);
    await rendu();
    expect(m.ui.etat().tour).toBe(1);
    expect(placeAuTour(m, id, 1)).toBeNull();
    expect(placeAuTour(m, id, 2), 'la proposition l’assied au tour 2').not.toBeNull();
    expect(placeAuTour(m, id, 2, null), 'le retenu la laisse dans la réserve au tour 2').toBeNull();
    expect(placeAuTour(m, id, 3, null)).not.toBeNull();

    await voir(m, id);
    expect(m.ui.etat().proposition).toBe(autre.id);
    expect(m.ui.etat().tour).toBe(2);
    expect(marquees(m)).toEqual([placeAuTour(m, id, 2)]);
  });

  test('dans la réserve à chaque tour : le tour montré reste, la vue ajustée aussi, rien n’est marqué, la barre dit la réserve', async () => {
    const { m, id } = await montage();
    for (const tour of [1, 2, 3]) await m.seance.executer('retirerDuTour', { tour, participant: id });
    await rendu();
    expect([1, 2, 3].map((tour) => placeAuTour(m, id, tour))).toEqual([null, null, null]);

    const barre = await voir(m, id);
    expect(m.ui.etat().tour).toBe(1);
    const cadre = cadreDepuisRect(svgDe(m).getBoundingClientRect());
    const ajustee = ajuster(englobantDuTour(etatPlaces(m.seance.etat().charge, { tour: 1, proposition: null })), cadre);
    expect(vueDe(m), 'la vue ajustée, que rien ne déplace').toEqual(ajustee);
    expect(marquees(m)).toEqual([]);
    expect(barre.textContent).toContain(tEcran('plan.evidence.reserveAuTour', { tour: 1 }));
    expect(barre.textContent).not.toContain(tEcran('plan.evidence.absenteAuTour', { tour: 1 }));
  });
});

describe('« Voir sur le plan » sur la grande démonstration : la chaise au centre du cadre (§ 7.1, § 7.3)', () => {
  let avant = null;
  beforeEach(async () => {
    avant = { largeur: innerWidth, hauteur: innerHeight };
    await fixerCadre(1366, 700);
  });
  afterEach(async () => {
    await fixerCadre(avant.largeur, avant.hauteur);
  });

  // La grande démonstration livrée, une proposition générée puis retenue,
  // ouverte en lecture depuis le disque simulé ; cadrage, s'il est donné,
  // mémorisé avant que le plan ne s'ouvre. La section des participants
  // ouverte.
  async function ouvrirGrande({ cadrage = null } = {}) {
    const lue = analyser(texteLivre('grande')).charge;
    const configuration = configurationDepuisCharge(lue);
    const propositions = rechercher(configuration, { graine: 1, nombre: 1, arret: 50 });
    const generee = appliquerCommande('enregistrerGeneration', lue, { propositions, configuration, produitVersion: VERSION.affichee }).charge;
    const charge = appliquerCommande('retenirProposition', generee, { id: generee.propositions[0].id }).charge;
    const texte = serialiser(charge, { revision: 1, produitVersion: VERSION.affichee });
    const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `soiree/soiree${SUFFIXES.etat}`, texte }] });
    montes.push(m);
    await m.seance.ouvrir('soiree/soiree');
    if (cadrage !== null) m.seance.demanderCadrage(cadrage);
    m.ui.allerA('participants');
    await rendu();
    return m;
  }

  // La personne assise au tour 1 la plus loin du centre du plan, sa table,
  // son siège et la géométrie de sa table.
  function laPlusLoin(m) {
    const etat = etatPlaces(m.seance.etat().charge, { tour: 1, proposition: null });
    const { minX, minY, maxX, maxY } = englobantDuTour(etat);
    const milieu = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    let retenue = null;
    for (const table of etat.tables) {
      const geometrie = geometrieTable(table, table.capacite);
      for (const [rang, { occupant, siege }] of table.chaises.entries()) {
        if (occupant === null) continue;
        const { x, y } = geometrie.chaises[rang];
        const distance = Math.hypot(x - milieu.x, y - milieu.y);
        if (retenue === null || distance > retenue.distance) retenue = { id: occupant, table: table.id, siege, geometrie, distance };
      }
    }
    return { ...retenue, tables: etat.tables.length };
  }

  // Ouvre « Voir sur le plan » sur la ligne de la personne et attend la
  // vue, les tables et le retrait de la demande de centrer.
  async function voirGrande(m, id, tables) {
    await cliquer(commandeDeLigne(m, id, 'voirSurLePlan'));
    expect([m.ui.etat().section, m.ui.etat().miseEnEvidence]).toEqual(['plan', id]);
    await vi.waitFor(() => expect(m.racine.querySelector('[data-vue]')?.getAttribute('transform') ?? null).not.toBeNull());
    await vi.waitFor(() => expect(m.racine.querySelectorAll('[data-table]')).toHaveLength(tables));
    await vi.waitFor(() => expect(m.ui.etat().centrerEvidence).toBe(false));
    await rendu();
  }

  // La chaise marquée, seule, visible, et son centre à l'écran.
  function marqueSeule(m) {
    const marques = [...m.racine.querySelectorAll('[data-marque="miseEnEvidence"]')];
    expect(marques).toHaveLength(1);
    expect(marques[0].checkVisibility({ opacityProperty: true, visibilityProperty: true })).toBe(true);
    const rect = marques[0].getBoundingClientRect();
    return { siege: marques[0].closest('[data-siege]').dataset.siege, rect, centre: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } };
  }

  test('le plan ajusté ne dessine aucune chaise ; « Voir sur le plan » amène la sienne, marquée, au centre du cadre, au zoom où sa table dessine ses chaises', async () => {
    const m = await ouvrirGrande();
    const personne = laPlusLoin(m);
    // Ouvert sans demande, le plan ajusté ne dessine aucune chaise.
    m.ui.allerA('plan');
    await vi.waitFor(() => expect(m.racine.querySelectorAll('[data-table]')).toHaveLength(personne.tables));
    await rendu();
    expect(m.racine.querySelectorAll('[data-siege]')).toHaveLength(0);
    expect(vueDe(m).k).toBeLessThan(kSieges(personne.geometrie));
    expect(m.seance.cadrage(), 'la vue ajustée ne s’écrit pas').toBeNull();
    m.ui.allerA('participants');
    await rendu();

    await voirGrande(m, personne.id, personne.tables);
    expect(m.ui.etat().tour).toBe(1);
    const vue = vueDe(m);
    expect(vue.k, 'le seuil de sa table, à l’arrondi de l’attribut près').toBeCloseTo(kSieges(personne.geometrie), 12);
    expect(m.seance.cadrage(), 'mémorisée comme un zoom de l’opérateur (§ 8.5)').toEqual(vue);
    const marque = marqueSeule(m);
    expect(marque.siege).toBe(`${personne.table}:${personne.siege}`);
    const cadre = svgDe(m).getBoundingClientRect();
    expect(marque.rect.left >= cadre.left && marque.rect.right <= cadre.right, 'dans le cadre, en largeur').toBe(true);
    expect(marque.rect.top >= cadre.top && marque.rect.bottom <= cadre.bottom, 'dans le cadre, en hauteur').toBe(true);
    expect(Math.abs(marque.centre.x - (cadre.left + cadre.width / 2))).toBeLessThan(1);
    expect(Math.abs(marque.centre.y - (cadre.top + cadre.height / 2))).toBeLessThan(1);
  });

  test('un cadrage déjà plus près que le seuil garde son zoom ; la chaise vient au centre du cadre', async () => {
    const m = await ouvrirGrande({ cadrage: { k: 2, tx: 0, ty: 0 } });
    const personne = laPlusLoin(m);
    await voirGrande(m, personne.id, personne.tables);
    expect(vueDe(m).k).toBe(2);
    expect(m.seance.cadrage(), 'mémorisée comme un zoom de l’opérateur (§ 8.5)').toEqual(vueDe(m));
    const marque = marqueSeule(m);
    expect(marque.siege).toBe(`${personne.table}:${personne.siege}`);
    const cadre = svgDe(m).getBoundingClientRect();
    expect(Math.abs(marque.centre.x - (cadre.left + cadre.width / 2))).toBeLessThan(1);
    expect(Math.abs(marque.centre.y - (cadre.top + cadre.height / 2))).toBeLessThan(1);
  });
});

describe('la colonne « Animation » : les tables animées, ou « à désigner » (§ 10.2)', () => {
  // Quatre personnes et deux tables, numérotées 1 et 2 : Ombrelle anime la
  // table 2, Pervenche et Lacasse portent la marque, Lacasse exclue,
  // Grisaille ne porte rien.
  async function ouvrirAnimees() {
    const m = await evenementOuvert({
      tables: 2,
      personnes: [{ nom: 'Ombrelle' }, { nom: 'Pervenche' }, { nom: 'Lacasse', exclu: true }, { nom: 'Grisaille' }],
    });
    for (const nom of ['Ombrelle', 'Pervenche', 'Lacasse']) {
      await m.seance.executer('modifierParticipant', { id: idDe(m, nom), champs: { animationReservee: true } });
    }
    const table = m.seance.etat().charge.tables.find(({ numero }) => numero === 2);
    await m.seance.executer('designerAnimateurs', { table: table.id, participants: [idDe(m, 'Ombrelle')], libelle: 'animation' });
    await attendreSeance(m);
    return m;
  }

  test('juste après le titre pressenti : les numéros des tables animées, « à désigner » sous la marque, rien pour une exclue ni sans marque ; l’en-tête ne trie pas', async () => {
    const m = await ouvrirAnimees();
    expect(COLONNES.indexOf('animation')).toBe(COLONNES.indexOf('titrePressenti') + 1);
    const entete = [...grille(m).tHead.rows[0].cells][colonnesMontrees([]).indexOf('animation')];
    expect(texteDe(entete)).toBe(t('participants.colonne.animation'));
    expect(entete.querySelector('button')).toBeNull();
    expect(texteDe(cellule(m, idDe(m, 'Ombrelle'), 'animation'))).toBe('2');
    expect(cellule(m, idDe(m, 'Ombrelle'), 'animation').querySelector('[data-animation="tables"]')).not.toBeNull();
    expect(texteDe(cellule(m, idDe(m, 'Pervenche'), 'animation'))).toBe(t('participants.animation.aDesigner'));
    expect(cellule(m, idDe(m, 'Pervenche'), 'animation').querySelector('[data-animation="aDesigner"]')).not.toBeNull();
    expect(texteDe(cellule(m, idDe(m, 'Lacasse'), 'animation'))).toBe('');
    expect(texteDe(cellule(m, idDe(m, 'Grisaille'), 'animation'))).toBe('');
  });

  test('la cellule se lit au clavier et ne s’édite pas ; une désignation la met à jour', async () => {
    const m = await ouvrirAnimees();
    const id = idDe(m, 'Pervenche');
    const trace = m.trace.length;
    cellule(m, id, 'titrePressenti').focus();
    await touche('ArrowRight');
    await rendu();
    const mesure = cellule(m, id, 'animation');
    expect(document.activeElement).toBe(mesure);
    await touche('Enter');
    await rendu();
    expect(mesure.querySelector('input, textarea, [role="group"]')).toBeNull();
    expect(m.trace.length).toBe(trace);
    const table = m.seance.etat().charge.tables.find(({ numero }) => numero === 1);
    await m.seance.executer('designerAnimateurs', { table: table.id, participants: [id], libelle: 'animation' });
    await attendreSeance(m);
    expect(texteDe(cellule(m, id, 'animation'))).toBe('1');
  });
});
