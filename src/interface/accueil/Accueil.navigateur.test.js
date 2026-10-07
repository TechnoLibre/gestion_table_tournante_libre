// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La liste des événements et le dossier de travail dans un vrai moteur de
// rendu (§ 8.1, § 8.4, § 8.5, § 8.6, § 8.7, § 8.8, § 15, § 18.6, § 19.4) :
// le premier écran, le répertoire vide, les trois issues, créer, un seul
// événement ouvert, ouvrir sans écrire, les signalements, la récupération,
// l'ouverture en lecture, les réglages illisibles, le dossier de travail, ses
// avis et ses questions, l'explorateur, l'autre emplacement, copier,
// renommer, importer, supprimer, les démonstrations, la racine neutre, et la
// liste qui défile sous le bandeau. Chaque épreuve monte App par monterApp
// (test/navigateur/montage.js), sur le système de fichiers simulé, et lit
// le relevé de ses écritures.
//
// Le test interroge le rendu et le disque, jamais une classe : le texte, la
// visibilité, l'élément qu'atteint le centre d'une boîte, les fichiers du
// disque simulé. Les éléments s'atteignent par leurs attributs data-….
// Les noms d'épreuve sont inventés.
//
// Le projet navigateur emploie expect, et prend test et describe chez Vitest
// (voir src/interface/App.navigateur.test.js).
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushSync, tick } from 'svelte';
import { creerFormat } from '../../application/format.js';
import { creerHorlogePilotee } from '../../application/horloge.js';
import { TABLES_APPLICATION, libelle } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { CATALOGUE } from '../../demo/catalogue.js';
import { LIVREES } from '../../demo/livrees.js';
import { serialiser } from '../../stockage/canonique.js';
import { creer as creerDansLeDepot, ouvrir as ouvrirDansLeDepot } from '../../stockage/depot.js';
import { analyser, creerCharge } from '../../stockage/document.js';
import { lireJournal } from '../../stockage/journal.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { libelleDeLInstant } from '../../stockage/operations.js';
import { VERSION } from '../../version.genere.js';
import { creerFichiersSimules } from '../../../test/fichiers_simules.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { visible as visibleDansLaFenetre } from '../../../test/navigateur/rendu.js';
import { TABLES_INTERFACE } from '../libelles.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);

const DOCUMENTS = 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre';
const PUBLIE = 'E:\\soirees';
const DATA = 'E:\\soirees\\data';
const SOUS_APPDATA = 'C:\\Users\\Exemple\\AppData\\Local\\Programmes\\Tablee';
const HORODATAGE_DEPOT = '2031-05-17T08:05:00-04:00';
// Le dossier daté de la corbeille au départ de l'horloge pilotée.
const CORBEILLE_DU_DEPART = 'corbeille/2026-10-06_19-00-00';
// Un dossier daté que la corbeille porte avant le montage, antérieur au
// départ de l'horloge pilotée.
const ANCIEN_DOSSIER = 'corbeille/2026-01-15_12-00-00';
const UTF8 = new TextEncoder();

// --- Les fichiers d'épreuve ------------------------------------------------------

// Le fichier d'état d'une démonstration livrée, renommé, au format courant.
const PETITE = LIVREES.find(({ cle }) => cle === 'petite').texte;
function texteRenomme(nom, { etat = null } = {}) {
  const { charge } = analyser(PETITE);
  charge.evenement.nom = nom;
  if (etat !== null) charge.evenement.etat = etat;
  return serialiser(charge, { revision: 1, produitVersion: VERSION.affichee });
}

// Le texte d'état d'un événement neuf.
const texteNeuf = ({ id, nom }) =>
  serialiser(creerCharge({ id, nom, siegesParDefaut: 8, tours: 2 }), { revision: 1, produitVersion: VERSION.affichee });

const fichier = (chemin, texte, racine = 'documents') => ({ racine, chemin, texte });

// Un disque garni par le dépôt avant le montage — un autre processus, celui
// d'une séance d'avant : chaque événement a son journal d'une entrée et son
// jalon. Rend le disque, l'instance qui l'a garni et ses racines.
async function disqueAvec(evenements, reglages = {}) {
  const disque = new Map();
  const fs = creerFichiersSimules({ disque, ...reglages });
  const racines = await fs.racines();
  for (const { racine = 'documents', id, nom, etat = null, date = null } of evenements) {
    fs.deposerDossier(racine);
    const charge = creerCharge({ id, nom, date, siegesParDefaut: 8, tours: 2 });
    if (etat !== null) charge.evenement.etat = etat;
    await creerDansLeDepot(fs, racines[racine], charge, {
      libelle: libelle('ENTREE_CREATION', { nom }),
      nomJalon: libelle('JALON_CREATION'),
      horodatage: HORODATAGE_DEPOT,
      produitVersion: VERSION.affichee,
    });
  }
  return { disque, fs, racines };
}

// --- Le montage et ses lectures ---------------------------------------------------

let montes = [];
let erreursAdmises = false;
let erreursAvant = 0;
async function monter(options) {
  const m = await monterApp(options);
  montes.push(m);
  return m;
}
beforeEach(() => {
  erreursAvant = globalThis.__gttErreurs?.length ?? 0;
  erreursAdmises = false;
});
afterEach(() => {
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  vi.restoreAllMocks();
  window.scrollTo(0, 0);
  const recues = globalThis.__gttErreurs?.slice(erreursAvant) ?? [];
  if (!erreursAdmises) expect(recues, 'erreurs reçues par le collecteur').toEqual([]);
});

const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const tous = (m, selecteur) => [...m.racine.querySelectorAll(selecteur)];
const accueil = (m) => dans(m, '[data-ecran="accueil"]');
const lignes = (m) => tous(m, '[data-evenement]');
const ligneDe = (m, base) => dans(m, `[data-evenement="${CSS.escape(base)}"]`);
const colonne = (ligne, nom) => ligne.querySelector(`[data-colonne="${nom}"]`)?.textContent;
const ecritures = (m) => m.trace.length;
const sondes = (m) => m.trace.filter(([primitive]) => primitive === 'sonder').length;

// Visible une fois ramené dans la fenêtre : la liste défile sous le bandeau.
function visible(element) {
  element.scrollIntoView({ block: 'center' });
  return visibleDansLaFenetre(element);
}

// Le centre d'un élément, ramené dans la fenêtre, atteint l'élément.
function atteint(element) {
  element.scrollIntoView({ block: 'center' });
  const boite = element.getBoundingClientRect();
  const touche = document.elementFromPoint(boite.left + boite.width / 2, boite.top + boite.height / 2);
  return element === touche || element.contains(touche);
}

// Saisit un texte dans un champ, comme une frappe : la valeur, puis input.
function saisir(entree, texte) {
  entree.value = texte;
  entree.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

async function cliquer(element) {
  expect(element, 'élément à cliquer').not.toBeNull();
  element.click();
  await tick();
}

// L'écran de l'événement ouvert, une fois rendu.
async function attendreEvenement(m, quoi = () => true) {
  await vi.waitFor(() => {
    const evenement = m.seance.etat().evenement;
    expect(evenement).not.toBeNull();
    expect(quoi(evenement)).toBe(true);
    expect(dans(m, '[data-ecran="evenement"]')).not.toBeNull();
  });
  return m.seance.etat().evenement;
}

// « Liste des événements » du bandeau, puis la liste relue de n lignes.
async function revenirALaListe(m, n = null) {
  await cliquer(dans(m, '[data-bandeau] [data-commande="liste"]'));
  await vi.waitFor(() => {
    expect(m.seance.etat().evenement).toBeNull();
    expect(accueil(m)).not.toBeNull();
    if (n !== null) expect(lignes(m).length).toBe(n);
  });
}

// Ouvre la ligne base par sa commande.
async function ouvrirLigne(m, base) {
  await cliquer(ligneDe(m, base).querySelector('[data-commande="ouvrir"]'));
}

// Crée par le formulaire de l'accueil.
async function creerParLeFormulaire(m, nom, date = '') {
  saisir(dans(m, '[data-champ="nom"]'), nom);
  saisir(dans(m, '[data-champ="date"]'), date);
  await cliquer(dans(m, '[data-commande="creer"]'));
}

// Aucune fenêtre ni boîte de dialogue dans le document.
function aucuneFenetre() {
  expect(document.querySelectorAll('[role=dialog], [role=alertdialog], dialog[open]').length).toBe(0);
}

// Les nœuds de texte non blancs d'un élément, dans l'ordre du document.
function noeudsDeTexte(element) {
  const textes = [];
  const parcours = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (parcours.nextNode()) if (parcours.currentNode.textContent.trim() !== '') textes.push(parcours.currentNode.textContent);
  return textes;
}

// Les textes de chaque fichier d'une racine du disque, par chemin relatif.
async function photographier(m, racine, dossier = '') {
  const racines = await m.fs.racines();
  const photo = {};
  for (const { nom, type } of await m.fs.lister(racines[racine], dossier)) {
    const chemin = dossier === '' ? nom : `${dossier}/${nom}`;
    if (type === 'fichier') photo[chemin] = m.fs.contenu(racine, chemin);
  }
  return photo;
}

// --- Le premier écran (§ 8.1, § 18.6) ---------------------------------------------

describe('le premier écran (§ 8.1, § 18.6)', () => {
  test('le logiciel démarre sur la liste, sans événement ; « version » puis la version ; deux événements, six informations égales au fichier', async () => {
    const { disque, fs, racines } = await disqueAvec([
      { id: 'evt-printemps', nom: 'Gala du printemps', date: '2031-05-17' },
    ]);
    // Renommé à la main : ses deux fichiers sous une autre base.
    for (const suffixe of [SUFFIXES.etat, SUFFIXES.journal]) {
      fs.deposer('documents', `soiree-a${suffixe}`, fs.contenu('documents', `Gala du printemps${suffixe}`));
      await fs.supprimer(racines.documents, `Gala du printemps${suffixe}`);
    }
    // Sans journal.
    const club = texteRenomme('Club des Merles');
    fs.deposer('documents', `club${SUFFIXES.etat}`, club);
    const m = await monter({ systeme: { disque } });

    expect(m.seance.etat().evenement).toBeNull();
    expect(accueil(m)).not.toBeNull();
    const version = dans(m, '[data-version]');
    expect(version.textContent.replace(/\s+/g, ' ').trim()).toBe(`${t('coquille.version.libelle')} ${VERSION.affichee}`);
    expect(visible(version)).toBe(true);

    expect(lignes(m).length).toBe(2);
    const gala = ligneDe(m, 'soiree-a');
    const lue = analyser(m.fs.contenu('documents', `soiree-a${SUFFIXES.etat}`));
    expect(colonne(gala, 'nom')).toBe(lue.charge.evenement.nom);
    expect(colonne(gala, 'nom')).toBe('Gala du printemps');
    expect(colonne(gala, 'date')).toBe(format.date('2031-05-17'));
    expect(colonne(gala, 'etat')).toBe(t('accueil.etat.brouillon'));
    expect(colonne(gala, 'participants')).toBe(format.nombre(lue.entete.comptes.participants));
    expect(colonne(gala, 'modification')).toBe(format.horodatage(HORODATAGE_DEPOT));
    expect(colonne(gala, 'chemin')).toBe(`${DOCUMENTS}\\soiree-a${SUFFIXES.etat}`);

    const ligneClub = ligneDe(m, 'club');
    const lu = analyser(club);
    expect(colonne(ligneClub, 'nom')).toBe('Club des Merles');
    expect(colonne(ligneClub, 'date')).toBe(lu.charge.evenement.date === null ? '\u{2014}' : format.date(lu.charge.evenement.date));
    expect(colonne(ligneClub, 'participants')).toBe(format.nombre(lu.entete.comptes.participants));
    expect(Number(lu.entete.comptes.participants)).toBeGreaterThan(0);
    expect(colonne(ligneClub, 'modification')).toBe('\u{2014}');
    expect(colonne(ligneClub, 'chemin')).toBe(`${DOCUMENTS}\\club${SUFFIXES.etat}`);
    for (const ligne of lignes(m)) expect(visible(ligne)).toBe(true);
  });

  test('répertoire vide : « version » et la version, la création, une entrée par démonstration du catalogue, atteinte ; aucun « aucun événement »', async () => {
    const m = await monter();
    expect(lignes(m).length).toBe(0);
    expect(dans(m, '[data-version]').textContent).toContain(VERSION.affichee);
    const creer = dans(m, '[data-commande="creer"]');
    expect(visible(creer)).toBe(true);
    expect(atteint(creer)).toBe(true);
    const entrees = tous(m, '[data-demonstration]');
    expect(CATALOGUE.length).toBeGreaterThan(0);
    expect(entrees.length).toBe(CATALOGUE.length);
    entrees.forEach((entree, rang) => {
      expect(entree.textContent.trim()).toBe(CATALOGUE[rang].nom);
      expect(atteint(entree)).toBe(true);
    });
    expect(accueil(m).textContent.toLowerCase()).not.toContain('aucun événement');
  });

  test('répertoire vide, construction de documentation : la marque tient lieu de version au premier écran', async () => {
    const m = await monter({ provenance: 'documentation' });
    const version = dans(m, '[data-version]').textContent;
    expect(version).toContain(t('coquille.version.libelle'));
    expect(version).toContain(t('coquille.version.documentation'));
    expect(version).not.toContain(VERSION.affichee);
  });

  test('contre-épreuve : un catalogue d’une entrée de plus en montre une de plus', async () => {
    const demonstrations = LIVREES.map(({ cle, texte }) => ({ cle, nom: CATALOGUE.find((e) => e.cle === cle).nom, texte }));
    const plus = [...demonstrations, { cle: 'epreuve', nom: 'Démonstration des Pervenches', texte: PETITE }];
    const m = await monter({ demonstrations: plus });
    const entrees = tous(m, '[data-demonstration]');
    expect(entrees.length).toBe(CATALOGUE.length + 1);
    expect(entrees.at(-1).textContent.trim()).toBe('Démonstration des Pervenches');
  });

  test('trois issues toujours offertes : devant une liste non vide, la création et les démonstrations restent atteignables', async () => {
    const m = await monter({ fichiers: [fichier(`bal${SUFFIXES.etat}`, texteRenomme('Bal des Grisailles'))] });
    expect(lignes(m).length).toBe(1);
    expect(atteint(dans(m, '[data-commande="creer"]'))).toBe(true);
    const entrees = tous(m, '[data-demonstration]');
    expect(entrees.length).toBe(CATALOGUE.length);
    for (const entree of entrees) expect(atteint(entree)).toBe(true);
    expect(atteint(ligneDe(m, 'bal').querySelector('[data-commande="ouvrir"]'))).toBe(true);
  });
});

// --- Créer, ouvrir (§ 2.1, § 8.1, § 8.2, § 8.4, § 8.8) ------------------------------------

describe('créer et ouvrir', () => {
  test('créer « Soirée d’essai » : le journal avant l’état, une entrée et le jalon « Création » ; ouvert en lecture ; la liste compte une ligne de plus', async () => {
    const m = await monter({ fichiers: [fichier(`bal${SUFFIXES.etat}`, texteRenomme('Bal des Grisailles'))] });
    const avant = ecritures(m);
    await creerParLeFormulaire(m, 'Soirée d\u{2019}essai');
    const ouvert = await attendreEvenement(m);
    expect(ouvert.nom).toBe('Soirée d\u{2019}essai');
    expect(m.seance.etat().mode).toBe('lecture');
    const ecrits = m.trace.slice(avant).map(([, , chemin]) => chemin);
    const journal = ecrits.indexOf(`${ouvert.base}${SUFFIXES.journal}`);
    const etat = ecrits.indexOf(`${ouvert.base}${SUFFIXES.etat}`);
    expect(journal).toBeGreaterThanOrEqual(0);
    expect(etat).toBeGreaterThan(journal);
    const lu = lireJournal(m.fs.contenu('documents', `${ouvert.base}${SUFFIXES.journal}`));
    expect(lu.entrees.length).toBe(1);
    expect(lu.jalons.map(({ nom }) => nom)).toEqual([libelle('JALON_CREATION')]);
    await revenirALaListe(m, 2);
    expect(colonne(ligneDe(m, ouvert.base), 'nom')).toBe('Soirée d\u{2019}essai');
  });

  test('un nom vide : un message contre le champ, rien au relevé, aucun « Sans titre »', async () => {
    const m = await monter();
    const avant = ecritures(m);
    await creerParLeFormulaire(m, '   ');
    const champ = dans(m, '[data-champ="nom"]');
    const message = await vi.waitFor(() => {
      const element = dans(m, '[data-refus="NOM_REQUIS"]');
      expect(element).not.toBeNull();
      return element;
    });
    expect(visible(message)).toBe(true);
    expect(message.textContent).toContain(t('NOM_REQUIS'));
    expect(champ.getAttribute('aria-invalid')).toBe('true');
    expect(message.id).not.toBe('');
    expect(champ.getAttribute('aria-describedby')).toBe(message.id);
    expect(ecritures(m)).toBe(avant);
    expect(m.seance.etat().evenement).toBeNull();
    expect([...m.disque.keys()].some((cle) => cle.toLowerCase().includes('sans titre'))).toBe(false);
    aucuneFenetre();
  });

  test('une date hors du calendrier : le message contre le champ de la date, rien au relevé', async () => {
    const m = await monter();
    const avant = ecritures(m);
    await creerParLeFormulaire(m, 'Bal des Grisailles', '2031-02-30');
    const message = await vi.waitFor(() => {
      const element = dans(m, '[data-refus="DATE_INVALIDE"]');
      expect(element).not.toBeNull();
      return element;
    });
    expect(message.textContent).toContain(t('DATE_INVALIDE', { date: '2031-02-30' }));
    expect(dans(m, '[data-champ="date"]').getAttribute('aria-describedby')).toBe(message.id);
    expect(dans(m, '[data-champ="nom"]').getAttribute('aria-invalid')).toBeNull();
    expect(ecritures(m)).toBe(avant);
  });

  test('un seul événement ouvert : A en écriture, « Liste des événements » le ferme sans question ni verrou ; B s’ouvre en lecture', async () => {
    const confirmer = vi.spyOn(window, 'confirm');
    const m = await monter({
      fichiers: [
        fichier(`bal${SUFFIXES.etat}`, texteRenomme('Bal des Grisailles')),
        fichier(`club${SUFFIXES.etat}`, texteNeuf({ id: 'evt-merles', nom: 'Club des Merles' })),
      ],
    });
    await ouvrirLigne(m, 'bal');
    await attendreEvenement(m, ({ base }) => base === 'bal');
    await m.seance.passerEnEcriture();
    expect(m.fs.contenu('documents', `bal${SUFFIXES.verrou}`)).not.toBeNull();
    await revenirALaListe(m, 2);
    aucuneFenetre();
    expect(m.fs.contenu('documents', `bal${SUFFIXES.verrou}`)).toBeNull();
    await ouvrirLigne(m, 'club');
    await attendreEvenement(m, ({ base }) => base === 'club');
    expect(m.seance.etat().mode).toBe('lecture');
    expect(confirmer).not.toHaveBeenCalled();
  });

  test('ouvrir et lister n’écrivent rien : le relevé n’a rien gagné depuis le montage', async () => {
    const m = await monter({ fichiers: [fichier(`bal${SUFFIXES.etat}`, texteRenomme('Bal des Grisailles'))] });
    const avant = ecritures(m);
    expect(lignes(m).length).toBe(1);
    await ouvrirLigne(m, 'bal');
    await attendreEvenement(m);
    expect(ecritures(m)).toBe(avant);
    await revenirALaListe(m, 1);
    expect(ecritures(m)).toBe(avant);
  });

  test('tout s’ouvre en lecture : l’événement créé, celui rouvert après l’écriture, une démonstration, une copie ; le fichier ne porte aucun mode', async () => {
    const m = await monter();
    await creerParLeFormulaire(m, 'Bal des Grisailles');
    const cree = await attendreEvenement(m);
    expect(m.seance.etat().mode).toBe('lecture');
    await m.seance.passerEnEcriture();
    expect(m.seance.etat().mode).toBe('ecriture');
    await revenirALaListe(m, 1);
    await ouvrirLigne(m, cree.base);
    await attendreEvenement(m);
    expect(m.seance.etat().mode).toBe('lecture');
    await revenirALaListe(m, 1);
    await cliquer(dans(m, '[data-demonstration="petite"]'));
    const demonstration = await attendreEvenement(m, ({ base }) => base !== cree.base);
    expect(m.seance.etat().mode).toBe('lecture');
    await revenirALaListe(m, 2);
    const ligne = ligneDe(m, cree.base);
    await cliquer(ligne.querySelector('[data-commande="copier"]'));
    saisir(ligne.querySelector('[data-champ="nomCopie"]'), 'Bal des Grisailles, variante');
    await cliquer(ligne.querySelector('[data-commande="validerCopie"]'));
    const copie = await attendreEvenement(m, ({ nom }) => nom === 'Bal des Grisailles, variante');
    expect(m.seance.etat().mode).toBe('lecture');
    for (const { base } of [cree, demonstration, copie]) {
      const texte = m.fs.contenu('documents', `${base}${SUFFIXES.etat}`);
      expect(texte, base).not.toBeNull();
      expect(texte).not.toMatch(/"mode"|lecture|ecriture/);
    }
  });
});

// --- Les signalements et la récupération (§ 8.1, § 8.8) ---------------------------------

describe('signalements et récupération (§ 8.1, § 8.8)', () => {
  test('un état vide, un journal seul, deux états de même identifiant ; réglages, corbeille et PDF : quatre lignes signalées, de trois sortes', async () => {
    const { disque, fs, racines } = await disqueAvec([{ id: 'evt-hiboux', nom: 'Soirée des Hiboux' }]);
    await fs.supprimer(racines.documents, `Soirée des Hiboux${SUFFIXES.etat}`);
    const merles = texteNeuf({ id: 'evt-merles', nom: 'Club des Merles' });
    const m = await monter({
      systeme: { disque },
      fichiers: [
        fichier(`Soirée vide${SUFFIXES.etat}`, ''),
        fichier(`Merles A${SUFFIXES.etat}`, merles),
        fichier(`Merles B${SUFFIXES.etat}`, merles),
        fichier('reglages_locaux.json', '{}'),
        fichier(`corbeille/2031-01-01_00-00-00/Ancienne${SUFFIXES.etat}`, merles),
        fichier('planche.pdf', '%PDF'),
      ],
    });
    expect(lignes(m).map((l) => l.dataset.evenement).sort()).toEqual([
      'Merles A',
      'Merles B',
      'Soirée des Hiboux',
      'Soirée vide',
    ]);
    const signalements = (base) => [...ligneDe(m, base).querySelectorAll('[data-signalement]')];
    for (const ligne of lignes(m)) expect(signalements(ligne.dataset.evenement).length).toBe(1);
    const vide = signalements('Soirée vide')[0];
    expect(vide.dataset.signalement).toBe('ETAT_ILLISIBLE');
    expect(vide.textContent).toContain(t('ETAT_ILLISIBLE', { base: 'Soirée vide', raison: 'VIDE', chemin: null, secours: { precedent: null, journal: null } }));
    const hiboux = signalements('Soirée des Hiboux')[0];
    expect(hiboux.dataset.signalement).toBe('ETAT_ILLISIBLE');
    expect(hiboux.textContent).toContain(t('ETAT_ILLISIBLE', { base: 'Soirée des Hiboux', raison: 'ABSENT', chemin: null, secours: { precedent: null, journal: 1 } }));
    const a = signalements('Merles A')[0];
    const b = signalements('Merles B')[0];
    expect(a.dataset.signalement).toBe('accueil.signalement.doublon');
    // Chaque doublon nomme l'autre base dans son propre nœud de texte, à part
    // de la phrase traduite.
    for (const [element, autre] of [
      [a, 'Merles B'],
      [b, 'Merles A'],
    ]) {
      expect(element.textContent).toContain(t('accueil.signalement.doublon', { autres: 1 }));
      expect(element.querySelector(`[data-doublon="${CSS.escape(autre)}"]`)?.textContent).toBe(autre);
      const noeuds = noeudsDeTexte(element).filter((texte) => texte.includes('Merles'));
      expect(noeuds).toEqual([autre]);
    }
    const sortes = new Set([vide.textContent, hiboux.textContent, a.dataset.signalement]);
    expect(sortes.size).toBe(3);
    for (const element of [vide, hiboux, a, b]) expect(visible(element)).toBe(true);
  });

  test('récupération : un état tronqué, .precedent et journal lisibles → un panneau nomme le fichier et la raison, offre le .precedent puis le journal, sans écrire ; .precedent ouvre en lecture ; le premier geste réécrit l’état', async () => {
    const { disque, fs } = await disqueAvec([{ id: 'evt-lucioles', nom: 'Nuit des Lucioles' }]);
    const base = 'Nuit des Lucioles';
    const sain = fs.contenu('documents', `${base}${SUFFIXES.etat}`);
    fs.deposer('documents', `${base}${SUFFIXES.precedent}`, sain);
    fs.deposer('documents', `${base}${SUFFIXES.etat}`, sain.slice(0, Math.floor(sain.length / 2)));
    const m = await monter({ systeme: { disque } });
    const avant = ecritures(m);
    await ouvrirLigne(m, base);
    const panneau = await vi.waitFor(() => {
      const element = dans(m, '[data-ecran="recuperation"]');
      expect(element).not.toBeNull();
      return element;
    });
    expect(visible(panneau)).toBe(true);
    expect(panneau.textContent).toContain(`${DOCUMENTS}\\${base}${SUFFIXES.etat}`);
    const raison = panneau.querySelector('[data-refus="ETAT_ILLISIBLE"]');
    expect(raison).not.toBeNull();
    expect(raison.textContent).toContain(base);
    const offerts = [...panneau.querySelectorAll('[data-secours]')].map((e) => e.dataset.secours);
    expect(offerts).toEqual(['precedent', 'journal']);
    expect(panneau.querySelector('[data-secours="precedent"]').textContent).toContain(t('communs.commande.ouvrirPrecedent'));
    expect(ecritures(m)).toBe(avant);
    expect(m.seance.etat().evenement).toBeNull();

    await cliquer(panneau.querySelector('[data-secours="precedent"] [data-commande="ouvrirPrecedent"]'));
    await attendreEvenement(m, (evenement) => evenement.base === base);
    expect(m.seance.etat().mode).toBe('lecture');
    expect(ecritures(m)).toBe(avant);

    await m.seance.passerEnEcriture();
    await m.seance.executer('ajouterParticipant', { champs: { nom: 'Pervenche' } });
    const reecrit = analyser(m.fs.contenu('documents', `${base}${SUFFIXES.etat}`));
    expect(reecrit.charge.participants.some(({ nom }) => nom === 'Pervenche')).toBe(true);
  });

  test('sans aucun secours lisible : un message, aucune commande d’ouverture, et aucun événement n’est créé', async () => {
    const m = await monter({ fichiers: [fichier(`Soirée vide${SUFFIXES.etat}`, '')] });
    const cles = [...m.disque.keys()].sort();
    const avant = ecritures(m);
    await ouvrirLigne(m, 'Soirée vide');
    const panneau = await vi.waitFor(() => {
      const element = dans(m, '[data-ecran="recuperation"]');
      expect(element).not.toBeNull();
      return element;
    });
    expect(panneau.textContent).toContain(t('accueil.recuperation.aucunSecours'));
    expect(panneau.querySelectorAll('[data-secours]').length).toBe(0);
    expect(ecritures(m)).toBe(avant);
    expect([...m.disque.keys()].sort()).toEqual(cles);
    expect(m.seance.etat().evenement).toBeNull();
    await cliquer(panneau.querySelector('[data-commande="retour"]'));
    await vi.waitFor(() => expect(accueil(m)).not.toBeNull());
    expect(lignes(m).length).toBe(1);
  });
});

// --- Le dossier de travail (§ 8.5, § 8.6) -------------------------------------------------

describe('le dossier de travail (§ 8.5, § 8.6)', () => {
  test('réglages locaux illisibles : l’avis REGLAGES_ILLISIBLES visible, la liste utilisable', async () => {
    const m = await monter({
      fichiers: [fichier('reglages_locaux.json', 'pas du JSON'), fichier(`bal${SUFFIXES.etat}`, texteRenomme('Bal des Grisailles'))],
    });
    const avis = dans(m, '[data-avertissement="REGLAGES_ILLISIBLES"]');
    expect(avis).not.toBeNull();
    expect(visible(avis)).toBe(true);
    const { avis: attendus } = await m.facade.demarrer();
    const reglages = attendus.find(({ code }) => code === 'REGLAGES_ILLISIBLES');
    expect(avis.textContent).toBe(t(reglages.code, reglages.details));
    aucuneFenetre();
    expect(atteint(ligneDe(m, 'bal').querySelector('[data-commande="ouvrir"]'))).toBe(true);
    await ouvrirLigne(m, 'bal');
    await attendreEvenement(m);
  });

  test('publié, sonde réussie : la liste affiche le dossier data en entier ; non publié : celui des Documents', async () => {
    const portable = await monter({ systeme: { executable: PUBLIE } });
    expect(dans(portable, '[data-dossier-travail]').textContent).toBe(DATA);
    expect(accueil(portable).textContent).not.toContain(DOCUMENTS);
    const documents = await monter();
    expect(dans(documents, '[data-dossier-travail]').textContent).toBe(DOCUMENTS);
  });

  test('la règle ne s’applique qu’une fois : ouvrir, fermer, revenir à la liste n’ajoutent aucune sonde', async () => {
    const m = await monter({ fichiers: [fichier(`bal${SUFFIXES.etat}`, texteRenomme('Bal des Grisailles'))] });
    const avant = sondes(m);
    expect(avant).toBe(1);
    await ouvrirLigne(m, 'bal');
    await attendreEvenement(m);
    await revenirALaListe(m, 1);
    await ouvrirLigne(m, 'bal');
    await attendreEvenement(m);
    await revenirALaListe(m, 1);
    expect(sondes(m)).toBe(avant);
  });

  const REPLIS = [
    ['NON_PUBLIE', {}, {}],
    ['DONNEES_APPLICATIVES', { executable: SOUS_APPDATA }, {}],
    ['SONDE_ECHOUEE', { executable: PUBLIE, sonde: { portable: 'EACCES' } }, { cause: 'EACCES' }],
  ];
  for (const [code, systeme, details] of REPLIS) {
    test(`repli en Documents, ${code} : un avis non modal, une fois, la liste utilisable dessous`, async () => {
      const m = await monter({ systeme, fichiers: [fichier(`bal${SUFFIXES.etat}`, texteRenomme('Bal des Grisailles'))] });
      const avis = tous(m, `[data-avertissement="${code}"]`);
      expect(avis.length).toBe(1);
      expect(visible(avis[0])).toBe(true);
      expect(avis[0].textContent).toBe(t(code, details));
      aucuneFenetre();
      expect(atteint(ligneDe(m, 'bal').querySelector('[data-commande="ouvrir"]'))).toBe(true);
      expect(atteint(dans(m, '[data-commande="creer"]'))).toBe(true);
      await ouvrirLigne(m, 'bal');
      await attendreEvenement(m);
      await revenirALaListe(m, 1);
      expect(tous(m, `[data-avertissement="${code}"]`).length).toBe(0);
    });
  }

  test('plateforme web : l’avis PLATEFORME_WEB ; support amovible : l’avis SUPPORT_AMOVIBLE', async () => {
    const web = await monter({ systeme: { nature: 'web' } });
    expect(visible(dans(web, '[data-avertissement="PLATEFORME_WEB"]'))).toBe(true);
    const amovible = await monter({ systeme: { support: { documents: 'amovible' } } });
    const avis = dans(amovible, '[data-avertissement="SUPPORT_AMOVIBLE"]');
    expect(visible(avis)).toBe(true);
    expect(avis.textContent).toBe(t('SUPPORT_AMOVIBLE', {}));
  });

  test('explorateur : la commande appelle ouvrirDansExplorateur avec la racine ; sous web, absente, et une phrase dit pourquoi', async () => {
    const m = await monter();
    const espion = vi.fn(async () => undefined);
    m.fs.ouvrirDansExplorateur = espion;
    await cliquer(dans(m, '[data-commande="explorateur"]'));
    await vi.waitFor(() => expect(espion).toHaveBeenCalledTimes(1));
    expect(espion.mock.calls[0][0]).toEqual(m.seance.etat().racine);

    const web = await monter({ systeme: { nature: 'web' } });
    expect(dans(web, '[data-commande="explorateur"]')).toBeNull();
    const phrase = dans(web, '[data-avertissement="EXPLORATEUR_ABSENT"]');
    expect(phrase?.textContent).toBe(t('EXPLORATEUR_ABSENT'));
    expect(visible(phrase)).toBe(true);
    expect(web.erreurs()).toEqual([]);
  });

  test('data/ porte deux événements et refuse l’écriture : la question nomme le dossier et la cause, dit « 2 », offre ses réponses ; aucune liste des Documents', async () => {
    const m = await monter({
      systeme: { executable: PUBLIE, sonde: { portable: 'EACCES' } },
      fichiers: [
        fichier(`bal${SUFFIXES.etat}`, texteRenomme('Bal des Grisailles'), 'portable'),
        fichier(`club${SUFFIXES.etat}`, texteNeuf({ id: 'evt-merles', nom: 'Club des Merles' }), 'portable'),
      ],
    });
    const question = dans(m, '[data-question="PORTABLE_NON_INSCRIPTIBLE"]');
    expect(question).not.toBeNull();
    expect(visible(question)).toBe(true);
    expect(question.textContent).toContain(DATA);
    expect(question.textContent).toContain('EACCES');
    expect(question.textContent).toContain('2');
    expect(visible(question.querySelector('[data-commande="reessayer"]'))).toBe(true);
    expect(visible(question.querySelector('[data-commande="documents"]'))).toBe(true);
    expect(lignes(m).length).toBe(0);
    expect(accueil(m).textContent).not.toContain(DOCUMENTS);
    aucuneFenetre();
    // Répondre « Documents » : les événements y sont copiés, la liste paraît.
    await cliquer(question.querySelector('[data-commande="documents"]'));
    await vi.waitFor(() => expect(lignes(m).length).toBe(2));
    expect(dans(m, '[data-question]')).toBeNull();
    expect(dans(m, '[data-dossier-travail]').textContent).toBe(DOCUMENTS);
  });

  test('non publié, Documents non inscriptibles : la question avant toute liste ; « Réessayer », la panne tenant, la repose', async () => {
    const m = await monter({
      systeme: { sonde: { documents: 'EROFS' } },
      fichiers: [fichier(`bal${SUFFIXES.etat}`, texteRenomme('Bal des Grisailles'))],
    });
    const question = dans(m, '[data-question="DOCUMENTS_NON_INSCRIPTIBLE"]');
    expect(visible(question)).toBe(true);
    expect(question.textContent).toContain(DOCUMENTS);
    expect(question.textContent).toContain('EROFS');
    expect(lignes(m).length).toBe(0);
    const avant = sondes(m);
    await cliquer(question.querySelector('[data-commande="reessayer"]'));
    await vi.waitFor(() => expect(sondes(m)).toBe(avant + 1));
    // La question reposée offre de nouveau ses réponses.
    await vi.waitFor(() =>
      expect(dans(m, '[data-question="DOCUMENTS_NON_INSCRIPTIBLE"] [data-commande="continuer"]')).not.toBeNull(),
    );
    expect(lignes(m).length).toBe(0);
    // « Continuer » : la liste s'ouvre telle qu'elle se lit.
    await cliquer(dans(m, '[data-question] [data-commande="continuer"]'));
    await vi.waitFor(() => expect(lignes(m).length).toBe(1));
    expect(dans(m, '[data-question]')).toBeNull();
  });

  test('l’autre emplacement : la proposition en tête, son chemin, son compte, la phrase sur les originaux ; importer copie, originaux intacts', async () => {
    const reglages = { executable: SOUS_APPDATA };
    const { disque } = await disqueAvec(
      [
        { racine: 'portable', id: 'evt-lucioles', nom: 'Nuit des Lucioles' },
        { racine: 'portable', id: 'evt-cerfs', nom: 'Soirée des Cerfs' },
      ],
      reglages,
    );
    const m = await monter({ systeme: { disque, ...reglages } });
    const proposition = dans(m, '[data-autre]');
    expect(visible(proposition)).toBe(true);
    const cheminAutre = `${SOUS_APPDATA}\\data`;
    expect(proposition.textContent).toContain(t('accueil.autre.proposition', { evenements: 2 }));
    // Le chemin est une donnée : son propre nœud de texte, à part de la phrase.
    expect(dans(m, '[data-autre-chemin]')?.textContent).toBe(cheminAutre);
    expect(noeudsDeTexte(proposition).filter((texte) => texte.includes('\\'))).toEqual([cheminAutre]);
    expect(proposition.textContent).toContain(t('accueil.autre.originaux'));
    // En tête : avant la création, les démonstrations et toute ligne.
    for (const suivant of [dans(m, '[data-commande="creer"]'), dans(m, '[data-demonstration]')]) {
      expect(proposition.compareDocumentPosition(suivant) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    const originaux = await photographier(m, 'portable');
    expect(Object.keys(originaux).length).toBe(4);
    await cliquer(proposition.querySelector('[data-commande="importerAutre"]'));
    await vi.waitFor(() => expect(lignes(m).length).toBe(2));
    expect(await photographier(m, 'portable')).toEqual(originaux);
    expect(lignes(m).map((l) => colonne(l, 'nom')).sort()).toEqual(['Nuit des Lucioles', 'Soirée des Cerfs']);
    // Des paires copiées : chaque état importé garde son journal, octet pour
    // octet, et sa dernière modification est celle du journal d'origine.
    const journaux = (photo) =>
      Object.entries(photo)
        .filter(([chemin]) => chemin.endsWith(SUFFIXES.journal))
        .map(([, texte]) => texte)
        .sort();
    expect(journaux(originaux).length).toBe(2);
    expect(journaux(await photographier(m, 'documents'))).toEqual(journaux(originaux));
    for (const ligne of lignes(m)) expect(colonne(ligne, 'modification')).toBe(format.horodatage(HORODATAGE_DEPOT));
  });
});

// --- Copier, renommer, importer, supprimer (§ 8.7) ----------------------------------------

describe('les opérations de fichiers (§ 8.7)', () => {
  test('copier un plan bloqué : un champ de nom, rien avant validation ; une ligne de plus, une entrée au libellé exact, un état non bloqué, l’original intact', async () => {
    const { disque } = await disqueAvec([{ id: 'evt-grisailles', nom: 'Bal des Grisailles', etat: 'bloque' }]);
    const m = await monter({ systeme: { disque } });
    const original = await photographier(m, 'documents');
    const avant = ecritures(m);
    const ligne = ligneDe(m, 'Bal des Grisailles');
    expect(colonne(ligne, 'etat')).toBe(t('accueil.etat.bloque'));
    await cliquer(ligne.querySelector('[data-commande="copier"]'));
    const champ = ligne.querySelector('[data-champ="nomCopie"]');
    expect(visible(champ)).toBe(true);
    saisir(champ, 'Bal des Grisailles, variante');
    expect(ecritures(m)).toBe(avant);
    await cliquer(ligne.querySelector('[data-commande="validerCopie"]'));
    const copie = await attendreEvenement(m, ({ nom }) => nom === 'Bal des Grisailles, variante');
    await revenirALaListe(m, 2);
    const racines = await m.fs.racines();
    const source = await ouvrirDansLeDepot(m.fs, racines.documents, 'Bal des Grisailles');
    const attendu = libelle('ENTREE_COPIE', {
      source: 'Bal des Grisailles',
      instant: libelleDeLInstant(source, libelle('ENTREE_REPRISE')),
    });
    const journal = lireJournal(m.fs.contenu('documents', `${copie.base}${SUFFIXES.journal}`));
    expect(journal.entrees.map(({ libelle: texte }) => texte)).toEqual([attendu]);
    expect(analyser(m.fs.contenu('documents', `${copie.base}${SUFFIXES.etat}`)).charge.evenement.etat).not.toBe('bloque');
    expect(colonne(ligneDe(m, copie.base), 'etat')).not.toBe(t('accueil.etat.bloque'));
    const apres = await photographier(m, 'documents');
    for (const [chemin, texte] of Object.entries(original)) expect(apres[chemin]).toBe(texte);
  });

  test('copier sous un nom vide : refusé contre le champ, aucune copie, aucun « (copie) »', async () => {
    const m = await monter({ fichiers: [fichier(`bal${SUFFIXES.etat}`, texteRenomme('Bal des Grisailles'))] });
    const avant = ecritures(m);
    const ligne = ligneDe(m, 'bal');
    await cliquer(ligne.querySelector('[data-commande="copier"]'));
    saisir(ligne.querySelector('[data-champ="nomCopie"]'), '  ');
    await cliquer(ligne.querySelector('[data-commande="validerCopie"]'));
    await vi.waitFor(() => expect(ligne.querySelector('[data-refus="NOM_REQUIS"]')).not.toBeNull());
    expect(ligne.querySelector('[data-champ="nomCopie"]').getAttribute('aria-invalid')).toBe('true');
    expect(ecritures(m)).toBe(avant);
    expect([...m.disque.keys()].some((cle) => cle.includes('(COPIE)'))).toBe(false);
  });

  test('renommer : le nouveau nom et le nouveau chemin dans la liste', async () => {
    const { disque } = await disqueAvec([{ id: 'evt-pervenches', nom: 'Gala des Pervenches' }]);
    const m = await monter({ systeme: { disque } });
    const ligne = ligneDe(m, 'Gala des Pervenches');
    await cliquer(ligne.querySelector('[data-commande="renommer"]'));
    const champ = ligne.querySelector('[data-champ="nouveauNom"]');
    expect(champ.value).toBe('Gala des Pervenches');
    saisir(champ, 'Gala des Ombrelles');
    await cliquer(ligne.querySelector('[data-commande="validerRenommage"]'));
    await vi.waitFor(() => expect(ligneDe(m, 'Gala des Ombrelles')).not.toBeNull());
    expect(lignes(m).length).toBe(1);
    const renomme = ligneDe(m, 'Gala des Ombrelles');
    expect(colonne(renomme, 'nom')).toBe('Gala des Ombrelles');
    expect(colonne(renomme, 'chemin')).toBe(`${DOCUMENTS}\\Gala des Ombrelles${SUFFIXES.etat}`);
    expect(m.fs.contenu('documents', `Gala des Pervenches${SUFFIXES.verrou}`)).toBeNull();
  });

  // Coupe le processus du montage juste après l'écriture réussie de chemin.
  function couperApres(m, chemin) {
    for (const primitive of ['ecrireAtomique', 'ajouterLigne']) {
      const originale = m.fs[primitive];
      m.fs[primitive] = async (racine, cible, ...reste) => {
        const rendu = await Reflect.apply(originale, m.fs, [racine, cible, ...reste]);
        if (cible === chemin) m.fs.pannes.couperApres(0);
        return rendu;
      };
    }
  }

  async function renommerCoupe(chemin) {
    erreursAdmises = true;
    const { disque } = await disqueAvec([{ id: 'evt-pervenches', nom: 'Gala des Pervenches' }]);
    const m = await monter({ systeme: { disque } });
    couperApres(m, chemin);
    const ligne = ligneDe(m, 'Gala des Pervenches');
    await cliquer(ligne.querySelector('[data-commande="renommer"]'));
    saisir(ligne.querySelector('[data-champ="nouveauNom"]'), 'Gala des Ombrelles');
    await cliquer(ligne.querySelector('[data-commande="validerRenommage"]'));
    await vi.waitFor(() => expect(m.erreurs().length).toBeGreaterThan(0));
    // Réouverture : un second processus sur le même disque.
    return monter({ systeme: { disque } });
  }

  test('renommer coupé après le nouvel état : à la réouverture, deux lignes signalées doublons l’une de l’autre', async () => {
    const rouvert = await renommerCoupe(`Gala des Ombrelles${SUFFIXES.etat}`);
    expect(lignes(rouvert).map((l) => l.dataset.evenement).sort()).toEqual(['Gala des Ombrelles', 'Gala des Pervenches']);
    const signalement = (base) => ligneDe(rouvert, base).querySelector('[data-signalement="accueil.signalement.doublon"]');
    for (const [base, autre] of [
      ['Gala des Ombrelles', 'Gala des Pervenches'],
      ['Gala des Pervenches', 'Gala des Ombrelles'],
    ]) {
      expect(signalement(base).textContent).toContain(t('accueil.signalement.doublon', { autres: 1 }));
      expect(noeudsDeTexte(signalement(base)).filter((texte) => texte.includes('Gala'))).toEqual([autre]);
    }
  });

  test('renommer coupé après le seul nouveau journal : à la réouverture, une ligne, l’ancienne', async () => {
    const rouvert = await renommerCoupe(`Gala des Ombrelles${SUFFIXES.journal}`);
    expect(lignes(rouvert).map((l) => l.dataset.evenement)).toEqual(['Gala des Pervenches']);
    expect(ligneDe(rouvert, 'Gala des Pervenches').querySelectorAll('[data-signalement]').length).toBe(0);
  });

  test('importer un événement : une ligne de plus, octets identiques ; une seconde fois, un refus qui nomme la base ; le libellé nomme l’événement, pas les participants', async () => {
    const octets = UTF8.encode(texteRenomme('Bal des Grisailles'));
    const m = await monter({
      aImporter: [
        { nom: `Bal des Grisailles${SUFFIXES.etat}`, octets },
        { nom: `Bal des Grisailles${SUFFIXES.etat}`, octets },
      ],
    });
    const commande = dans(m, '[data-commande="importer"]');
    expect(commande.textContent).toContain(t('accueil.operation.importer'));
    expect(commande.textContent.toLowerCase()).toContain('événement');
    expect(commande.textContent.toLowerCase()).not.toContain('participants');
    await cliquer(commande);
    await vi.waitFor(() => expect(lignes(m).length).toBe(1));
    const base = lignes(m)[0].dataset.evenement;
    expect([...m.fs.octets('documents', `${base}${SUFFIXES.etat}`)]).toEqual([...octets]);
    await cliquer(dans(m, '[data-commande="importer"]'));
    const refus = await vi.waitFor(() => {
      const element = dans(m, '[data-refus="IDENTIFIANT_PRESENT"]');
      expect(element).not.toBeNull();
      return element;
    });
    expect(refus.textContent).toContain(base);
    expect(visible(refus)).toBe(true);
    expect(lignes(m).length).toBe(1);
  });

  test('supprimer : à confirmer en place ; la ligne part, la corbeille montre son dossier daté et ses fichiers, à côté de ceux qu’elle portait', async () => {
    const m = await monter({
      fichiers: [
        fichier(`bal${SUFFIXES.etat}`, texteRenomme('Bal des Grisailles')),
        fichier(`${ANCIEN_DOSSIER}/Ancienne${SUFFIXES.etat}`, texteNeuf({ id: 'evt-cerfs', nom: 'Soirée des Cerfs' })),
        fichier(`${ANCIEN_DOSSIER}/Ancienne${SUFFIXES.journal}`, ''),
      ],
    });
    await vi.waitFor(() => expect(dans(m, `[data-corbeille-dossier="${ANCIEN_DOSSIER}"]`)).not.toBeNull());
    const avant = ecritures(m);
    const commande = () => ligneDe(m, 'bal')?.querySelector('[data-commande="supprimer"]') ?? null;
    await cliquer(commande());
    expect(commande().textContent).toBe(t('accueil.operation.confirmerSuppression'));
    expect(ecritures(m)).toBe(avant);
    aucuneFenetre();
    await cliquer(commande());
    await vi.waitFor(() => expect(lignes(m).length).toBe(0));
    const corbeille = await vi.waitFor(() => {
      const element = dans(m, `[data-corbeille-dossier="${CORBEILLE_DU_DEPART}"]`);
      expect(element).not.toBeNull();
      return element;
    });
    expect(visible(corbeille)).toBe(true);
    expect(corbeille.textContent).toContain(`${DOCUMENTS}\\corbeille\\2026-10-06_19-00-00`);
    expect(corbeille.textContent).toContain(`bal${SUFFIXES.etat}`);
    expect(m.fs.contenu('documents', `${CORBEILLE_DU_DEPART}/bal${SUFFIXES.etat}`)).not.toBeNull();
    // Rien ne la vide : le dossier daté qu'elle portait reste montré, avec ses
    // fichiers, et elle n'offre aucune commande.
    const dossiers = tous(m, '[data-corbeille-dossier]');
    expect(dossiers.map((element) => element.dataset.corbeilleDossier).sort()).toEqual([ANCIEN_DOSSIER, CORBEILLE_DU_DEPART]);
    const ancien = dans(m, `[data-corbeille-dossier="${ANCIEN_DOSSIER}"]`);
    expect(visible(ancien)).toBe(true);
    for (const nom of [`Ancienne${SUFFIXES.etat}`, `Ancienne${SUFFIXES.journal}`]) {
      expect(noeudsDeTexte(ancien)).toContain(nom);
    }
    expect(noeudsDeTexte(corbeille)).toContain(`bal${SUFFIXES.etat}`);
    expect(dans(m, '[data-corbeille]').querySelectorAll('button, [data-commande]').length).toBe(0);
    expect(m.fs.contenu('documents', `${ANCIEN_DOSSIER}/Ancienne${SUFFIXES.etat}`)).not.toBeNull();
  });

  test('une corbeille déjà présente au lancement se montre, et encore après un aller-retour vers un événement', async () => {
    const m = await monter({
      fichiers: [
        fichier(`bal${SUFFIXES.etat}`, texteRenomme('Bal des Grisailles')),
        fichier(`${ANCIEN_DOSSIER}/Ancienne${SUFFIXES.etat}`, texteNeuf({ id: 'evt-cerfs', nom: 'Soirée des Cerfs' })),
      ],
    });
    const montree = () => {
      const element = dans(m, `[data-corbeille-dossier="${ANCIEN_DOSSIER}"]`);
      expect(element).not.toBeNull();
      expect(visible(element)).toBe(true);
      expect(noeudsDeTexte(element)).toContain(`Ancienne${SUFFIXES.etat}`);
    };
    await vi.waitFor(montree);
    await ouvrirLigne(m, 'bal');
    await attendreEvenement(m);
    expect(dans(m, '[data-corbeille]')).toBeNull();
    await revenirALaListe(m, 1);
    await vi.waitFor(montree);
  });

  test('supprimer un événement qu’une séance vivante tient en écriture : refusé, la séance nommée, fichiers en place', async () => {
    const m = await monter({ fichiers: [fichier(`bal${SUFFIXES.etat}`, texteRenomme('Bal des Grisailles'))] });
    const second = await monter({ systeme: { disque: m.disque } });
    await second.seance.ouvrir('bal');
    await second.seance.passerEnEcriture();
    const commande = ligneDe(m, 'bal').querySelector('[data-commande="supprimer"]');
    await cliquer(commande);
    await cliquer(ligneDe(m, 'bal').querySelector('[data-commande="supprimer"]'));
    const refus = await vi.waitFor(() => {
      const element = ligneDe(m, 'bal').querySelector('[data-refus="VERROU_PRIS"]');
      expect(element).not.toBeNull();
      return element;
    });
    expect(visible(refus)).toBe(true);
    // Le texte d'une séance vivante, sans son instant : celui-ci vient de
    // l'horloge du disque.
    const vivante = t('VERROU_PRIS', { seance: null, depuis: null, vivant: true }).split(' : ')[0];
    expect(refus.textContent).toContain(vivante);
    expect(m.fs.contenu('documents', `bal${SUFFIXES.etat}`)).not.toBeNull();
    expect(lignes(m).length).toBe(1);
  });

  test('supprimer un événement passé en écriture, après « Liste des événements » : il part, sans VERROU_PRIS', async () => {
    const m = await monter({ fichiers: [fichier(`bal${SUFFIXES.etat}`, texteRenomme('Bal des Grisailles'))] });
    await ouvrirLigne(m, 'bal');
    await attendreEvenement(m);
    await m.seance.passerEnEcriture();
    await revenirALaListe(m, 1);
    await cliquer(ligneDe(m, 'bal').querySelector('[data-commande="supprimer"]'));
    await cliquer(ligneDe(m, 'bal').querySelector('[data-commande="supprimer"]'));
    await vi.waitFor(() => expect(lignes(m).length).toBe(0));
    expect(dans(m, '[data-refus="VERROU_PRIS"]')).toBeNull();
    expect(m.fs.contenu('documents', `bal${SUFFIXES.etat}`)).toBeNull();
  });
});

// --- Les démonstrations (§ 15) -------------------------------------------------------------

describe('les démonstrations (§ 15)', () => {
  test('deux chargements : « Petite démonstration 1 » puis « … 2 », en lecture, la première intacte', async () => {
    const m = await monter();
    const nom = CATALOGUE.find(({ cle }) => cle === 'petite').nom;
    await cliquer(dans(m, '[data-demonstration="petite"]'));
    const premiere = await attendreEvenement(m, (e) => e.nom === `${nom} 1`);
    expect(m.seance.etat().mode).toBe('lecture');
    await revenirALaListe(m, 1);
    const photo = await photographier(m, 'documents');
    const fichiersPremiere = Object.keys(photo).filter((chemin) => chemin.startsWith(premiere.base));
    expect(fichiersPremiere.length).toBeGreaterThan(0);
    await cliquer(dans(m, '[data-demonstration="petite"]'));
    await attendreEvenement(m, (e) => e.nom === `${nom} 2`);
    expect(m.seance.etat().mode).toBe('lecture');
    const apres = await photographier(m, 'documents');
    for (const chemin of fichiersPremiere) expect(apres[chemin]).toBe(photo[chemin]);
  });
});

// --- La racine neutre et la liste qui défile (§ 18.6, § 19.4) ----------------------------------

describe('la racine neutre et la liste qui défile (§ 18.6, § 19.4)', () => {
  const RACINE = 'C:\\Epreuve\\Tablees';

  async function listeSousRacine() {
    const m = await monter({ systeme: { documents: RACINE }, horloge: creerHorlogePilotee() });
    await creerParLeFormulaire(m, 'Bal des Grisailles');
    await attendreEvenement(m);
    await revenirALaListe(m, 1);
    return m;
  }

  test('chaque chemin de la liste est sous la racine d’épreuve ; deux montages au même départ rendent le même texte', async () => {
    const premier = await listeSousRacine();
    const textes = [];
    const parcours = document.createTreeWalker(accueil(premier), NodeFilter.SHOW_TEXT);
    while (parcours.nextNode()) textes.push(parcours.currentNode.textContent);
    const chemins = textes.filter((texte) => texte.includes('\\'));
    expect(chemins.length).toBeGreaterThan(0);
    for (const chemin of chemins) expect(chemin.startsWith(RACINE), chemin).toBe(true);
    const texte = accueil(premier).textContent;
    premier.demonter();
    montes = montes.filter((m) => m !== premier);
    const second = await listeSousRacine();
    expect(accueil(second).textContent).toBe(texte);
  });

  test('deux cents événements, la liste défilée jusqu’en bas : le bandeau reste dans la fenêtre, son centre l’atteint', async () => {
    const fichiers = Array.from({ length: 200 }, (_, rang) =>
      fichier(`soiree-${String(rang).padStart(3, '0')}${SUFFIXES.etat}`, texteNeuf({ id: `evt-${rang}`, nom: `Soirée des Cerfs ${rang}` })),
    );
    const m = await monter({ fichiers });
    expect(lignes(m).length).toBe(200);
    window.scrollTo(0, document.documentElement.scrollHeight);
    expect(window.scrollY).toBeGreaterThan(0);
    const bandeau = dans(m, '[data-bandeau]');
    const boite = bandeau.getBoundingClientRect();
    expect(boite.top).toBeGreaterThanOrEqual(0);
    expect(boite.bottom).toBeLessThanOrEqual(window.innerHeight);
    const touche = document.elementFromPoint(boite.left + boite.width / 2, boite.top + boite.height / 2);
    expect(bandeau.contains(touche)).toBe(true);
  });
});
