// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la section des tables et des tours dans un vrai moteur de
// rendu (§ 4, § 4.3, § 6, § 2.1 étapes 4 et 5, § 19.3 captures 05 et 06).
// La section est montée par mount avec les contextes que pose App —
// 'seance', 't', 'horloge', 'ui' —, sur une séance qui ouvre un fichier
// d'état d'épreuve dans le système de fichiers simulé, à l'horloge pilotée :
// chaque écriture se compte, et chaque entrée se lit dans la révision. Les
// saisies et les clics passent par des entrées que Chromium traite comme
// réelles (test/navigateur/entrees.js). L'épreuve lit le texte rendu, les
// attributs data-… du contrat et la charge que la séance a écrite. Les noms
// d'épreuve sont inventés.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, describe, expect, test, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import '../jetons.css';
import { controlerCapacite } from '../../application/capacite.js';
import { exporterObjectifs } from '../../application/csv.js';
import { creerHorlogePilotee } from '../../application/horloge.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { nomAffiche } from '../../application/personnes.js';
import { creerSeance } from '../../application/seance.js';
import { creerTraduction } from '../../application/traduction.js';
import { constante } from '../../geometrie/constantes.js';
import { nombrePlaces, normaliser } from '../../moteur/configuration.js';
import { serialiser } from '../../stockage/canonique.js';
import { capacite, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { creerFichiersSimules } from '../../../test/fichiers_simules.js';
import { pointer, touche } from '../../../test/navigateur/entrees.js';
import { composantes, visible } from '../../../test/navigateur/rendu.js';
import { creerEtatUi } from '../etat_ui.js';
import { TABLES_INTERFACE } from '../libelles.js';
import SectionTables from './SectionTables.svelte';
import { comptesTables } from './modele.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

const BASE = 'soiree';

const NOMS = [
  ['Ombrelle', 'Iris'],
  ['Pervenche', 'Théo'],
  ['Lacasse', 'Ondine'],
  ['Grisaille', null],
  ['Bruyère', 'Anouk'],
  ['Sarcelle', 'Capucine'],
];

const personne = (id, exclu = false) => ({
  id,
  nom: NOMS[(id - 1) % NOMS.length][0],
  prenom: NOMS[(id - 1) % NOMS.length][1],
  appartenance: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu,
});

const resa = (participant, table, siege, tour = null) => ({ participant, table, siege, portee: tour === null ? 'tous' : 'tour', tour });
const suite = (de, a) => Array.from({ length: a - de + 1 }, (_, rang) => de + rang);

// Une charge : les tables données ({id, numero, sieges, forme}), n
// personnes dont les exclus, R tours, un défaut.
function chargeDe({ tables = [], n = 0, exclus = [], tours = 2, defaut = 8, attribuerSieges = false, reservations = [], titres = [] } = {}) {
  const charge = creerCharge({ id: 'evt-tables', nom: 'Soirée des Merles', siegesParDefaut: defaut, tours });
  charge.reglages.attribuerSieges = attribuerSieges;
  charge.participants = Array.from({ length: n }, (_, rang) => personne(rang + 1, exclus.includes(rang + 1)));
  charge.tables = tables.map(({ id, numero = id, sieges = null, forme = 'ronde' }) => ({ id, numero, sieges, forme, position: { x: 300 * id, y: 0 } }));
  charge.reservations = reservations;
  charge.titres = titres;
  charge.prochainsIds = { participant: n + 1, table: Math.max(0, ...tables.map(({ id }) => id)) + 1, proposition: 1 };
  return charge;
}

// Ajoute la proposition id, ses listes dans l'ordre de charge.tables, et la
// retient quand retenu est vrai.
function placer(charge, listes, { id, retenu = false }) {
  const participants = charge.participants.filter(({ exclu }) => !exclu).map(({ id: p }) => p);
  const plan = {
    siegesAttribues: charge.reglages.attribuerSieges,
    tables: charge.tables.map(({ id: table }) => table),
    capacites: charge.tables.map((table) => capacite(charge, table)),
    tours: listes.length,
    participants,
    placement: listes.map((tour) => ({ sieges: tour, reserve: participants.filter((p) => !tour.flat().includes(p)) })),
  };
  charge.propositions.push({ id, graine: id, arret: 40, historique: 1000, produitVersion: VERSION.affichee, ...plan });
  charge.prochainsIds.proposition = id + 1;
  if (retenu) {
    charge.retenu = { proposition: id, ...structuredClone(plan) };
    charge.evenement.etat = 'retenu';
  } else if (charge.evenement.etat === 'brouillon') {
    charge.evenement.etat = 'propose';
  }
  return charge;
}

// Treize tables : neuf suivent 8, les tables 3, 6, 9 et 12 sont surchargées
// à 7, 7, 6 et 12 ; 120 personnes, dont 2 exclues.
function treizeTables() {
  const surcharges = new Map([[3, 7], [6, 7], [9, 6], [12, 12]]);
  const tables = Array.from({ length: 13 }, (_, rang) => ({ id: rang + 1, sieges: surcharges.get(rang + 1) ?? null }));
  return chargeDe({ tables, n: 120, exclus: [40, 80] });
}

// Les composants montés par l'épreuve courante, et leurs conteneurs.
const montes = [];

afterEach(() => {
  for (const { composant, cible } of montes.splice(0)) {
    unmount(composant);
    cible.remove();
  }
  vi.restoreAllMocks();
});

// Le fichier d'état de la charge posé dans le système simulé, ouvert par une
// séance, en écriture sauf mode 'lecture' ; la section montée au début du
// corps, avec les contextes de l'application. La façade ne sait
// qu'enregistrer : chaque appel d'enregistrerSous se range dans enregistres.
async function preparer(charge, { mode = 'ecriture' } = {}) {
  const enregistres = [];
  const facade = {
    async enregistrerSous(nomPropose, octets) {
      enregistres.push({ nomPropose, octets });
      return nomPropose;
    },
  };
  const fs = creerFichiersSimules();
  fs.deposerDossier('documents');
  fs.deposer('documents', `${BASE}${SUFFIXES.etat}`, serialiser(charge, { revision: 1, produitVersion: VERSION.affichee }));
  const { documents } = await fs.racines();
  const horloge = creerHorlogePilotee();
  let tirages = 0;
  const seance = creerSeance({
    fs,
    racine: documents,
    horloge,
    identifiant: () => {
      tirages += 1;
      return `epreuve-${tirages}`;
    },
    produitVersion: VERSION.affichee,
    planifier: horloge.planifier,
    annuler: horloge.annuler,
  });
  await seance.ouvrir(BASE);
  if (mode === 'ecriture') await seance.passerEnEcriture();
  const ui = creerEtatUi();
  const contexte = new Map([
    ['seance', seance],
    ['t', t],
    ['horloge', horloge],
    ['ui', ui],
    ['facade', facade],
  ]);
  const cible = document.createElement('div');
  document.body.prepend(cible);
  const composant = mount(SectionTables, { target: cible, props: {}, context: contexte });
  flushSync();
  montes.push({ composant, cible });
  return { fs, seance, ui, cible, enregistres };
}

const section = (m) => m.cible.querySelector('[data-section="tables"]');
const charge = (m) => m.seance.etat().charge;
const revision = (m) => m.seance.etat().evenement.revision;
const ecritures = (m) => m.fs.compteurs.ecritures;
const ligne = (m, id) => section(m).querySelector(`[data-table="${id}"]`);
const champTable = (m, id) => ligne(m, id).querySelector(`input[data-champ="sieges-${id}"]`);
const champ = (m, cle) => section(m).querySelector(`input[data-champ="${cle}"]`);
const commande = (racine, nom) => racine.querySelector(`[data-commande="${nom}"]`);
// L'état se lit dans sa pastille, sans les blancs de bord de son balisage.
const etatDe = (m, id) => ligne(m, id).querySelector('[data-etat-table]').textContent.trim();
const enonce = (m) => section(m).querySelector('[data-enonce="defaut"]');
const phrases = (m) => [...enonce(m).querySelectorAll('[data-phrase]')].map((p) => p.textContent).join(' ');
const fenetre = () => document.querySelector('dialog[open]');
const elementsFenetre = () => [...fenetre().querySelectorAll('li')].map((li) => li.textContent);

// Attend que la file de la séance ait passé tout ce qui s'y trouve, par une
// lecture admise dans tout mode qui n'écrit rien, puis le rendu.
async function attendre(m) {
  await m.seance.formeNommee(null).catch(() => undefined);
  await tick();
  flushSync();
}

// Un clic réel au centre de l'élément, puis la file de la séance passée.
async function cliquer(m, element) {
  expect(element, 'élément à cliquer').not.toBeNull();
  element.scrollIntoView({ block: 'center' });
  const boite = element.getBoundingClientRect();
  const x = boite.left + boite.width / 2;
  const y = boite.top + boite.height / 2;
  await pointer('presser', x, y);
  await pointer('relacher', x, y);
  await attendre(m);
}

// Saisit texte dans le champ, la valeur courante remplacée, puis valide par
// Entrée : le geste s'achève, et la file de la séance passe.
async function saisir(m, entree, texte) {
  await cliquer(m, entree);
  entree.select();
  if (texte === '') await touche('Backspace');
  for (const caractere of texte) await touche(caractere);
  await touche('Enter');
  await attendre(m);
}

describe('une table créée (§ 4, § 6.1)', () => {
  test('défaut 8 : la table créée suit le défaut, affichée 8 ; le défaut à 10, elle affiche 10 ; changer de tour affiché ne change ni la valeur ni le contrôle', async () => {
    const m = await preparer(chargeDe({ n: 2 }));
    await cliquer(m, commande(section(m), 'creerTableRonde'));
    expect(charge(m).tables).toHaveLength(1);
    const { id, sieges } = charge(m).tables[0];
    expect(sieges).toBeNull();
    expect(champTable(m, id).value).toBe('8');
    expect(etatDe(m, id)).toBe(t('tables.etat.suitDefaut'));

    await saisir(m, champ(m, 'siegesParDefaut'), '10');
    await cliquer(m, commande(enonce(m), 'appliquer'));
    expect(charge(m).evenement.siegesParDefaut).toBe(10);
    expect(charge(m).tables[0].sieges).toBeNull();
    expect(champTable(m, id).value).toBe('10');

    const avant = { valeur: champTable(m, id).value, etat: etatDe(m, id), champ: champTable(m, id) };
    m.ui.montrerTour(2);
    await attendre(m);
    expect(champTable(m, id)).toBe(avant.champ);
    expect(champTable(m, id).value).toBe(avant.valeur);
    expect(etatDe(m, id)).toBe(avant.etat);
  });

  test('la forme : la création offre ronde et carrée ; carrée, puis ronde, une entrée chacune', async () => {
    const m = await preparer(chargeDe({ n: 2 }));
    expect(commande(section(m), 'creerTableRonde').textContent).toBe(t('tables.creer.ronde'));
    expect(commande(section(m), 'creerTableCarree').textContent).toBe(t('tables.creer.carree'));
    const r0 = revision(m);
    await cliquer(m, commande(section(m), 'creerTableCarree'));
    expect(charge(m).tables.map(({ forme }) => forme)).toEqual(['carree']);
    expect(revision(m)).toBe(r0 + 1);
    await cliquer(m, commande(section(m), 'creerTableRonde'));
    expect(charge(m).tables.map(({ forme }) => forme)).toEqual(['carree', 'ronde']);
    expect(revision(m)).toBe(r0 + 2);
    expect(ligne(m, charge(m).tables[0].id).textContent).toContain(t('tables.forme.carree'));
    expect(ligne(m, charge(m).tables[1].id).textContent).toContain(t('tables.forme.ronde'));
  });
});

describe('un geste en cours ne se relance pas (§ 2.1)', () => {
  test('« Créer une table » cliquée deux fois pendant l’écriture d’un support lent : une table, une entrée', async () => {
    const m = await preparer(chargeDe({ n: 2 }));
    const r0 = revision(m);
    // Le système simulé retient ses écritures jusqu'à liberer() : le geste
    // reste en cours d'écriture. Le premier geste crée le journal, par une
    // écriture entière ; les suivants y ajoutent une ligne.
    let liberer;
    const porte = new Promise((resoudre) => {
      liberer = resoudre;
    });
    for (const primitive of ['ajouterLigne', 'ecrireAtomique']) {
      const ecrire = m.fs[primitive];
      m.fs[primitive] = async (...parametres) => {
        await porte;
        return ecrire.apply(m.fs, parametres);
      };
    }
    const bouton = commande(section(m), 'creerTableRonde');
    bouton.scrollIntoView({ block: 'center' });
    const boite = bouton.getBoundingClientRect();
    const [x, y] = [boite.left + boite.width / 2, boite.top + boite.height / 2];
    for (let clic = 0; clic < 2; clic += 1) {
      await pointer('presser', x, y);
      await pointer('relacher', x, y);
      flushSync();
    }
    expect(bouton.getAttribute('aria-busy')).toBe('true');
    liberer();
    await attendre(m);
    expect(charge(m).tables).toHaveLength(1);
    expect(revision(m)).toBe(r0 + 1);
    expect(bouton.getAttribute('aria-busy')).toBeNull();
  });
});

describe('l’état, pas seulement la valeur (§ 6.1, § 19.3 05)', () => {
  test('deux tables à 8, l’une suit le défaut, l’autre surchargée à 8 : les états diffèrent, seule la seconde offre « Réaligner » ; réalignée, son état égale celui de la première', async () => {
    const m = await preparer(chargeDe({ tables: [{ id: 1 }, { id: 2, sieges: 8 }], n: 4 }));
    expect(champTable(m, 1).value).toBe('8');
    expect(champTable(m, 2).value).toBe('8');
    expect(etatDe(m, 1)).not.toBe(etatDe(m, 2));
    expect(visible(ligne(m, 1).querySelector('[data-etat-table]'))).toBe(true);
    expect(commande(ligne(m, 1), 'realignerTable')).toBeNull();
    expect(commande(ligne(m, 2), 'realignerTable').textContent).toBe(t('tables.liste.realigner'));

    const r0 = revision(m);
    await cliquer(m, commande(ligne(m, 2), 'realignerTable'));
    expect(revision(m)).toBe(r0 + 1);
    expect(charge(m).tables[1].sieges).toBeNull();
    expect(etatDe(m, 2)).toBe(etatDe(m, 1));
    expect(champTable(m, 2).value).toBe(champTable(m, 1).value);
    expect(commande(ligne(m, 2), 'realignerTable')).toBeNull();
  });

  test('surcharge et réalignement : 6 sur une table qui suit 8, surchargée ; le défaut à 10 la laisse à 6 ; « Réaligner » la rend au défaut, une entrée', async () => {
    const m = await preparer(chargeDe({ tables: [{ id: 1 }], n: 4 }));
    const r0 = revision(m);
    await saisir(m, champTable(m, 1), '6');
    expect(charge(m).tables[0].sieges).toBe(6);
    expect(etatDe(m, 1)).toBe(t('tables.etat.surchargee'));
    expect(revision(m)).toBe(r0 + 1);

    await saisir(m, champ(m, 'siegesParDefaut'), '10');
    await cliquer(m, commande(enonce(m), 'appliquer'));
    expect(charge(m).evenement.siegesParDefaut).toBe(10);
    expect(charge(m).tables[0].sieges).toBe(6);
    expect(champTable(m, 1).value).toBe('6');

    const r1 = revision(m);
    await cliquer(m, commande(ligne(m, 1), 'realignerTable'));
    expect(charge(m).tables[0].sieges).toBeNull();
    expect(champTable(m, 1).value).toBe('10');
    expect(etatDe(m, 1)).toBe(t('tables.etat.suitDefaut'));
    expect(revision(m)).toBe(r1 + 1);
  });
});

describe('changer le défaut (§ 6.1, § 6.2, § 19.3 06)', () => {
  test('treize tables, 120 participants dont 2 exclus ; 10 saisi : l’énoncé exact, zéro écriture avant le clic ; « Appliquer » : le total annoncé est celui de l’instance écrite, et 118 son N', async () => {
    const m = await preparer(treizeTables());
    const avant = ecritures(m);
    const r0 = revision(m);
    await saisir(m, champ(m, 'siegesParDefaut'), '10');
    expect(visible(enonce(m))).toBe(true);
    expect(phrases(m)).toBe(
      '9 tables suivent le défaut et passent de 8 à 10 places ; 4 tables surchargées (7, 7, 6, 12) ne changent pas. ' +
        'Total : 104 \u{2192} 122 sièges pour 118 participants.',
    );
    expect(ecritures(m)).toBe(avant);
    expect(commande(enonce(m), 'appliquer').textContent).toBe(t('tables.defaut.appliquer'));
    expect(commande(enonce(m), 'appliquerRealigner').textContent).toBe('Appliquer et réaligner les 4 surchargées');

    await cliquer(m, commande(enonce(m), 'appliquer'));
    expect(revision(m)).toBe(r0 + 1);
    const instance = normaliser(configurationDepuisCharge(charge(m)));
    expect(nombrePlaces(instance)).toBe(122);
    expect(instance.N).toBe(118);
    expect(enonce(m)).toBeNull();
  });

  test('appliquer et réaligner : la fenêtre nomme les surcharges perdues ; Annuler n’écrit rien ; Confirmer : les treize tables suivent 10, une entrée', async () => {
    const m = await preparer(treizeTables());
    await saisir(m, champ(m, 'siegesParDefaut'), '10');
    const avant = ecritures(m);
    const r0 = revision(m);
    await cliquer(m, commande(enonce(m), 'appliquerRealigner'));
    expect(fenetre()).not.toBeNull();
    expect(elementsFenetre()).toEqual(['Table 3 : 7 places', 'Table 6 : 7 places', 'Table 9 : 6 places', 'Table 12 : 12 places']);
    await cliquer(m, commande(fenetre(), 'renoncer'));
    expect(fenetre()).toBeNull();
    expect(ecritures(m)).toBe(avant);

    await cliquer(m, commande(enonce(m), 'appliquerRealigner'));
    await cliquer(m, commande(fenetre(), 'confirmer'));
    await attendre(m);
    expect(fenetre()).toBeNull();
    expect(revision(m)).toBe(r0 + 1);
    expect(charge(m).evenement.siegesParDefaut).toBe(10);
    expect(charge(m).tables).toHaveLength(13);
    expect(charge(m).tables.every(({ sieges }) => sieges === null)).toBe(true);
  });

  test('baisse refusée en bloc : la table 2 porte 7 réservations ; 6 saisi : l’énoncé nomme la table 2 et ses 7 réservations, aucune commande d’application, rien n’est écrit', async () => {
    const reservations = suite(1, 7).map((p) => resa(p, 2, null));
    const m = await preparer(chargeDe({ tables: [{ id: 1 }, { id: 2 }, { id: 3 }], n: 10, reservations }));
    const avant = ecritures(m);
    await saisir(m, champ(m, 'siegesParDefaut'), '6');
    const texte = enonce(m).textContent;
    expect(texte).toContain('Table 2');
    expect(texte).toContain('7 réservations');
    expect(commande(enonce(m), 'appliquer')).toBeNull();
    expect(commande(enonce(m), 'appliquerRealigner')).toBeNull();
    expect(charge(m).evenement.siegesParDefaut).toBe(8);
    expect([1, 2, 3].map((id) => champTable(m, id).value)).toEqual(['8', '8', '8']);
    expect(ecritures(m)).toBe(avant);
  });

  test('réaligner refusé : la table 2 surchargée à 12 porte 11 réservations ; 10 saisi, « Appliquer et réaligner » : aucune fenêtre, le refus nomme la table 2, rien n’est écrit', async () => {
    const reservations = suite(1, 11).map((p) => resa(p, 2, null));
    const m = await preparer(chargeDe({ tables: [{ id: 1 }, { id: 2, sieges: 12 }], n: 12, reservations }));
    await saisir(m, champ(m, 'siegesParDefaut'), '10');
    expect(enonce(m).textContent).not.toContain('Table 2');
    const avant = ecritures(m);
    await cliquer(m, commande(enonce(m), 'appliquerRealigner'));
    expect(fenetre()).toBeNull();
    const refus = enonce(m).querySelector('[data-refus-realigner]');
    expect(refus).not.toBeNull();
    // L'en-tête est celui du réalignement refusé, qui laisse « Appliquer »
    // offert, et non celui d'un défaut que rien n'applique.
    const tete = refus.querySelector('[data-phrase]');
    expect(tete?.textContent).toBe(t('tables.defaut.realignementRefuse', { avant: 8, apres: 10 }));
    expect(visible(tete)).toBe(true);
    expect(refus.textContent).not.toContain(t('tables.defaut.refusee', { avant: 8, apres: 10 }));
    expect(refus.textContent).toContain('Table 2');
    expect(refus.textContent).toContain('11 réservations');
    expect(ecritures(m)).toBe(avant);
    expect(charge(m).evenement.siegesParDefaut).toBe(8);
    expect(charge(m).tables.find(({ id }) => id === 2).sieges).toBe(12);
    expect(commande(enonce(m), 'appliquer')).not.toBeNull();
  });

  test('« Garder le défaut actuel » : l’énoncé se retire, le champ rend la valeur enregistrée, rien n’est écrit', async () => {
    const m = await preparer(treizeTables());
    const avant = ecritures(m);
    await saisir(m, champ(m, 'siegesParDefaut'), '10');
    await cliquer(m, commande(enonce(m), 'garder'));
    expect(enonce(m)).toBeNull();
    expect(champ(m, 'siegesParDefaut').value).toBe('8');
    expect(ecritures(m)).toBe(avant);
  });

  test('moins de 2 places par défaut : refusé sur le champ, sans énoncé ni écriture', async () => {
    const m = await preparer(chargeDe({ tables: [{ id: 1 }], n: 4 }));
    const avant = ecritures(m);
    await saisir(m, champ(m, 'siegesParDefaut'), '1');
    const bloc = champ(m, 'siegesParDefaut').closest('[data-defaut]');
    expect(bloc.querySelector('[data-refus="MOINS_DE_DEUX"]').textContent).toContain(t('MOINS_DE_DEUX'));
    expect(enonce(m)).toBeNull();
    expect(ecritures(m)).toBe(avant);
  });
});

describe('la capacité d’une table, saisie au champ (§ 6.2)', () => {
  test('1, 0, -3, 2.5, « 8abc », « huit » et vide : refusés sur le champ, leur cause, aucun remède, rien d’écrit ; 2 accepté', async () => {
    const m = await preparer(chargeDe({ tables: [{ id: 1 }], n: 4 }));
    const avant = ecritures(m);
    const saisies = [
      ['1', 'MOINS_DE_DEUX'],
      ['0', 'MOINS_DE_DEUX'],
      ['-3', 'NON_ENTIER'],
      ['2.5', 'NON_ENTIER'],
      ['8abc', 'NON_ENTIER'],
      ['huit', 'NON_ENTIER'],
      ['', 'NON_ENTIER'],
    ];
    expect(saisies).toHaveLength(7);
    for (const [saisie, code] of saisies) {
      await saisir(m, champTable(m, 1), saisie);
      const refus = ligne(m, 1).querySelector(`[data-refus="${code}"]`);
      expect(refus, `refus de « ${saisie} »`).not.toBeNull();
      const details = code === 'NON_ENTIER' ? { saisie } : {};
      expect(refus.querySelector('p').textContent).toBe(t(code, details));
      expect(refus.querySelector('[data-commande]')).toBeNull();
      expect(ecritures(m)).toBe(avant);
      expect(charge(m).tables[0].sieges).toBeNull();
    }
    await saisir(m, champTable(m, 1), '2');
    expect(charge(m).tables[0].sieges).toBe(2);
    expect(ligne(m, 1).querySelector('[data-refus]')).toBeNull();
  });

  test('sous les réservations : 5 réservations « tous » ; 4 refusé contre le champ, qui nomme 5, son remède offert ; 5 accepté, une entrée', async () => {
    const reservations = suite(1, 5).map((p) => resa(p, 1, null));
    const m = await preparer(chargeDe({ tables: [{ id: 1 }], n: 6, reservations }));
    const avant = ecritures(m);
    await saisir(m, champTable(m, 1), '4');
    const refus = ligne(m, 1).querySelector('[data-refus="SOUS_RESERVATIONS"]');
    expect(refus.textContent).toContain('5 réservations');
    expect(commande(refus, 'afficherTour').textContent).toBe(t('communs.remede.afficherTour', { tour: 1 }));
    expect(ecritures(m)).toBe(avant);
    const r0 = revision(m);
    await saisir(m, champTable(m, 1), '5');
    expect(charge(m).tables[0].sieges).toBe(5);
    expect(revision(m)).toBe(r0 + 1);
  });

  test('sièges retirés : sièges attribués, Iris Ombrelle au siège 7, un titre « animateur » au siège 8 ; 6 liste le siège 8 puis le siège 7 et sa personne, rien d’écrit ; 7, le siège 8 seul', async () => {
    const m = await preparer(
      chargeDe({
        tables: [{ id: 1 }],
        n: 4,
        attribuerSieges: true,
        reservations: [resa(1, 1, 7)],
        titres: [{ table: 1, siege: 8, libelle: 'animateur' }],
      }),
    );
    const avant = ecritures(m);
    await saisir(m, champTable(m, 1), '6');
    expect(ligne(m, 1).querySelector('[data-refus="SIEGES_RETIRES"]')).not.toBeNull();
    const retires = () => [...ligne(m, 1).querySelectorAll('[data-sieges-retires] li')].map((li) => li.textContent);
    expect(retires()).toEqual(['Siège 8 : titre « animateur »', 'Siège 7 : Iris Ombrelle']);
    const texte = ligne(m, 1).textContent;
    expect(texte.indexOf('animateur')).toBeLessThan(texte.indexOf('Iris Ombrelle'));
    expect(ecritures(m)).toBe(avant);

    await saisir(m, champTable(m, 1), '7');
    expect(retires()).toEqual(['Siège 8 : titre « animateur »']);
    expect(ligne(m, 1).textContent).not.toContain('Iris Ombrelle');
    expect(ecritures(m)).toBe(avant);
  });

  test('sièges retirés puis Échap dans le champ : le refus et la liste des sièges retirés partent ensemble ; rien d’écrit', async () => {
    const m = await preparer(
      chargeDe({
        tables: [{ id: 1 }],
        n: 4,
        attribuerSieges: true,
        reservations: [resa(1, 1, 7)],
        titres: [{ table: 1, siege: 8, libelle: 'animateur' }],
      }),
    );
    const avant = ecritures(m);
    await saisir(m, champTable(m, 1), '6');
    expect(ligne(m, 1).querySelector('[data-refus="SIEGES_RETIRES"]')).not.toBeNull();
    expect(ligne(m, 1).querySelector('[data-sieges-retires]')).not.toBeNull();
    expect(document.activeElement).toBe(champTable(m, 1));
    await touche('Escape');
    await attendre(m);
    expect(ligne(m, 1).querySelector('[data-refus="SIEGES_RETIRES"]')).toBeNull();
    expect(ligne(m, 1).querySelector('[data-sieges-retires]')).toBeNull();
    expect(ecritures(m)).toBe(avant);
  });

  test('surnuméraires et lisibilité : un retenu assied huit personnes à la table 3 au tour 2 ; 6 accepté, l’avertissement nomme les deux personnes versées en réserve ; S + 1 avertit de S ; S, non', async () => {
    const donnees = chargeDe({ tables: [{ id: 1 }, { id: 2 }, { id: 3 }], n: 18 });
    placer(
      donnees,
      [
        [suite(1, 6), suite(7, 12), suite(13, 18)],
        [suite(1, 5), suite(6, 10), suite(11, 18)],
      ],
      { id: 1, retenu: true },
    );
    const { avertissements } = controlerCapacite(donnees, 3, 6, { origine: 'champ' });
    expect(avertissements).toHaveLength(1);
    const noms = avertissements[0].details.personnes.map((id) => nomAffiche(donnees.participants[id - 1]));
    expect(noms).toHaveLength(2);

    const m = await preparer(donnees);
    const r0 = revision(m);
    await saisir(m, champTable(m, 3), '6');
    expect(charge(m).tables[2].sieges).toBe(6);
    expect(revision(m)).toBe(r0 + 1);
    const surnumeraires = ligne(m, 3).querySelector('[data-avertissement="SURNUMERAIRES"]');
    expect(surnumeraires.textContent).toContain(t('SURNUMERAIRES', avertissements[0].details));
    expect([...surnumeraires.querySelectorAll('li')].map((li) => li.textContent)).toEqual(noms);

    const seuil = constante('SEUIL_SIEGES_LISIBLES');
    await saisir(m, champTable(m, 1), String(seuil + 1));
    expect(charge(m).tables[0].sieges).toBe(seuil + 1);
    const lisible = ligne(m, 1).querySelector('[data-avertissement="AU_DELA_LISIBLE"]');
    expect(lisible.textContent).toContain(String(seuil));
    expect(lisible.querySelector('p').textContent).toBe(t('AU_DELA_LISIBLE', { seuil }));

    await saisir(m, champTable(m, 1), String(seuil));
    expect(charge(m).tables[0].sieges).toBe(seuil);
    expect(ligne(m, 1).querySelector('[data-avertissement="AU_DELA_LISIBLE"]')).toBeNull();
  });
});

describe('les tours (§ 4, § 4.3, § 2.1 étape 5)', () => {
  test('0, 2.5 et « x » refusés sur le champ, leur cause, sans fenêtre, rien d’écrit ; 1 accepté', async () => {
    // La réservation du tour 2 : un changement qui la détruirait ouvre la
    // fenêtre, que la saisie refusée n'ouvre pas.
    const m = await preparer(chargeDe({ tables: [{ id: 1 }], n: 4, reservations: [resa(1, 1, null, 2)] }));
    const avant = ecritures(m);
    const saisies = [
      ['0', 'MOINS_D_UN_TOUR', { tours: 0 }],
      ['2.5', 'NON_ENTIER', { saisie: '2.5' }],
      ['x', 'NON_ENTIER', { saisie: 'x' }],
    ];
    expect(saisies).toHaveLength(3);
    for (const [saisie, code, details] of saisies) {
      await saisir(m, champ(m, 'tours'), saisie);
      const refus = champ(m, 'tours').closest('[data-tours]').querySelector(`[data-refus="${code}"]`);
      expect(refus, `refus de « ${saisie} »`).not.toBeNull();
      expect(refus.querySelector('p').textContent).toBe(t(code, details));
      expect(refus.querySelector('[data-commande]')).toBeNull();
      expect(fenetre()).toBeNull();
      expect(ecritures(m)).toBe(avant);
    }
    const r0 = revision(m);
    await saisir(m, champ(m, 'tours'), '1');
    expect(ecritures(m)).toBe(avant);
    await cliquer(m, commande(fenetre(), 'confirmer'));
    await attendre(m);
    expect(charge(m).evenement.tours).toBe(1);
    expect(charge(m).reservations).toEqual([]);
    expect(revision(m)).toBe(r0 + 1);
  });

  test('aucune perte : le nombre de tours change sans fenêtre, une entrée', async () => {
    const m = await preparer(chargeDe({ tables: [{ id: 1 }], n: 4, reservations: [resa(1, 1, null)] }));
    const r0 = revision(m);
    await saisir(m, champ(m, 'tours'), '5');
    expect(fenetre()).toBeNull();
    expect(charge(m).evenement.tours).toBe(5);
    expect(revision(m)).toBe(r0 + 1);
  });

  test('R = 4, deux réservations au tour 4, une au tour 2, deux propositions ; 3 : la fenêtre les nomme, rien d’écrit avant ; Confirmer : les deux retirées, celle du tour 2 gardée, une entrée, le fichier se rouvre', async () => {
    const donnees = chargeDe({
      tables: [{ id: 1 }, { id: 2 }],
      n: 8,
      tours: 4,
      reservations: [resa(1, 2, null, 4), resa(2, 1, null, 4), resa(3, 1, null, 2)],
    });
    // Chaque proposition honore les réservations : Iris Ombrelle à la table
    // 2 et Théo Pervenche à la table 1 au tour 4, Ondine Lacasse à la table
    // 1 au tour 2.
    const listes = [[suite(1, 4), suite(5, 8)], [suite(1, 4), suite(5, 8)], [suite(1, 4), suite(5, 8)], [suite(2, 5), [1, 6, 7, 8]]];
    placer(donnees, listes, { id: 1 });
    placer(donnees, listes, { id: 2 });
    const m = await preparer(donnees);
    const avant = ecritures(m);
    const r0 = revision(m);
    await saisir(m, champ(m, 'tours'), '3');
    expect(fenetre()).not.toBeNull();
    expect(ecritures(m)).toBe(avant);
    const elements = elementsFenetre();
    expect(elements).toHaveLength(4);
    expect(elements[0]).toContain('Iris Ombrelle');
    expect(elements[0]).toContain('table 2');
    expect(elements[1]).toContain('Théo Pervenche');
    expect(elements[1]).toContain('table 1');
    expect(elements.slice(2)).toEqual([t('tables.touchee.proposition', { id: 1 }), t('tables.touchee.proposition', { id: 2 })]);

    await cliquer(m, commande(fenetre(), 'confirmer'));
    await attendre(m);
    expect(fenetre()).toBeNull();
    expect(revision(m)).toBe(r0 + 1);
    expect(charge(m).evenement.tours).toBe(3);
    expect(charge(m).reservations).toEqual([resa(3, 1, null, 2)]);

    await m.seance.fermer();
    await m.seance.ouvrir(BASE);
    expect(m.seance.etat().charge.evenement.tours).toBe(3);
    expect(m.seance.etat().charge.reservations).toEqual([resa(3, 1, null, 2)]);
  });

  test('une hausse avec une proposition : sans fenêtre, une entrée, la dérive avertie par la séance', async () => {
    const donnees = chargeDe({ tables: [{ id: 1 }], n: 4, tours: 2 });
    placer(donnees, [[suite(1, 4)], [suite(1, 4)]], { id: 1 });
    const m = await preparer(donnees);
    const r0 = revision(m);
    await saisir(m, champ(m, 'tours'), '3');
    expect(fenetre()).toBeNull();
    expect(revision(m)).toBe(r0 + 1);
    expect(charge(m).evenement.tours).toBe(3);
    expect(charge(m).propositions).toHaveLength(1);
    expect(m.seance.etat().avertissements.map(({ code }) => code)).toContain('DERIVE_NOUVELLE');
  });

  test('une baisse avec une proposition et sans réservation : la fenêtre nomme la proposition, rien d’écrit avant', async () => {
    const donnees = chargeDe({ tables: [{ id: 1 }], n: 4, tours: 3 });
    placer(donnees, [[suite(1, 4)], [suite(1, 4)], [suite(1, 4)]], { id: 1 });
    const m = await preparer(donnees);
    const avant = ecritures(m);
    await saisir(m, champ(m, 'tours'), '2');
    expect(fenetre()).not.toBeNull();
    expect(ecritures(m)).toBe(avant);
    expect(elementsFenetre()).toEqual([t('tables.touchee.proposition', { id: 1 })]);
  });

  test('Annuler la fenêtre des tours : rien n’est écrit, et le champ rend la valeur enregistrée', async () => {
    const donnees = chargeDe({ tables: [{ id: 1 }], n: 4, tours: 4, reservations: [resa(1, 1, null, 4)] });
    const m = await preparer(donnees);
    const avant = ecritures(m);
    await saisir(m, champ(m, 'tours'), '3');
    await cliquer(m, commande(fenetre(), 'renoncer'));
    expect(fenetre()).toBeNull();
    expect(ecritures(m)).toBe(avant);
    expect(champ(m, 'tours').value).toBe('4');
    expect(charge(m).reservations).toHaveLength(1);
  });
});

describe('supprimer une table (§ 6.2)', () => {
  test('une table qui porte une réservation « tous » d’Iris Ombrelle et un titre « animateur » : la fenêtre les nomme ; une table nue : aucune fenêtre, une entrée', async () => {
    const m = await preparer(
      chargeDe({
        tables: [{ id: 1 }, { id: 2 }],
        n: 4,
        reservations: [resa(1, 1, null)],
        titres: [{ table: 1, siege: 1, libelle: 'animateur' }],
      }),
    );
    const avant = ecritures(m);
    const r0 = revision(m);
    await cliquer(m, commande(ligne(m, 1), 'supprimerTable'));
    expect(fenetre()).not.toBeNull();
    expect(ecritures(m)).toBe(avant);
    const elements = elementsFenetre();
    expect(elements).toHaveLength(2);
    expect(elements[0]).toContain('Iris Ombrelle');
    expect(elements[1]).toContain('« animateur »');
    await cliquer(m, commande(fenetre(), 'confirmer'));
    await attendre(m);
    expect(fenetre()).toBeNull();
    expect(charge(m).tables.map(({ id }) => id)).toEqual([2]);
    expect(charge(m).reservations).toEqual([]);
    expect(charge(m).titres).toEqual([]);
    expect(revision(m)).toBe(r0 + 1);

    await cliquer(m, commande(ligne(m, 2), 'supprimerTable'));
    expect(fenetre()).toBeNull();
    expect(charge(m).tables).toEqual([]);
    expect(revision(m)).toBe(r0 + 2);
    expect(section(m).textContent).toContain(t('tables.liste.aucune'));
  });
});

describe('en lecture (§ 8.4)', () => {
  test('créer une table, surcharger, changer le défaut ou les tours : refusés contre la commande ou le champ, le message porte « Modifier », rien d’écrit', async () => {
    const m = await preparer(chargeDe({ tables: [{ id: 1 }], n: 4 }), { mode: 'lecture' });
    const avant = ecritures(m);
    const modifier = t('communs.remede.modifier');

    await cliquer(m, commande(section(m), 'creerTableRonde'));
    const pres = commande(section(m), 'creerTableRonde').parentElement;
    expect(pres.querySelector('[data-refus="MODE_LECTURE"]').textContent).toContain(modifier);

    const porteurs = [
      [champTable(m, 1), (e) => e.closest('[data-table]')],
      [champ(m, 'siegesParDefaut'), (e) => e.closest('[data-defaut]')],
      [champ(m, 'tours'), (e) => e.closest('[data-tours]')],
    ];
    expect(porteurs).toHaveLength(3);
    for (const [entree, porteur] of porteurs) {
      await cliquer(m, entree);
      await touche('5');
      await attendre(m);
      const refus = porteur(entree).querySelector('[data-refus="MODE_LECTURE"]');
      expect(refus, entree.dataset.champ).not.toBeNull();
      expect(refus.textContent).toContain(modifier);
      expect(commande(refus, 'modifier').textContent).toBe(modifier);
    }
    expect(charge(m).tables).toHaveLength(1);
    expect(ecritures(m)).toBe(avant);
  });
});

describe('l’habillage : cartes, pastilles, messages', () => {
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
  const pastilleDans = (conteneur) => [...conteneur.querySelectorAll('*')].find((e) => fondDe(e)[3] > 0) ?? null;
  const regions = (m) => [...section(m).querySelectorAll('section[aria-labelledby]')];
  const nomDe = (region) => document.getElementById(region.getAttribute('aria-labelledby')).textContent.trim();

  test('« Tables et tours » porte les réglages, « Tables » la liste ; l’en-tête de la liste compte tables et sièges, et suit les gestes', async () => {
    const m = await preparer(treizeTables());
    const [reglages, liste] = regions(m);
    expect(regions(m).map(nomDe)).toEqual([t('coquille.section.tables'), t('tables.liste.titre')]);
    expect(reglages.contains(champ(m, 'siegesParDefaut'))).toBe(true);
    expect(reglages.contains(champ(m, 'tours'))).toBe(true);
    expect(liste.contains(ligne(m, 1))).toBe(true);
    const comptes = () => [...liste.querySelectorAll('p')].map((p) => p.textContent);
    expect(comptesTables(charge(m))).toEqual({ tables: 13, sieges: 104 });
    expect(comptes()).toContain(t('tables.liste.comptes', { tables: 13, sieges: 104 }));
    // Les créations sont les actions de l'en-tête de la liste, avant la première ligne.
    const ronde = commande(liste, 'creerTableRonde');
    expect(ronde.compareDocumentPosition(ligne(m, 1)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await cliquer(m, ronde);
    expect(comptes()).toContain(t('tables.liste.comptes', { tables: 14, sieges: 112 }));
  });

  test('l’état d’une table en pastille : neutre quand elle suit le défaut, information surchargée, son libellé de l’encre de la page', async () => {
    const m = await preparer(treizeTables());
    const encre = jeton('--couleur-page-texte');
    for (const [id, teinte] of [[1, '--couleur-neutre-fond'], [3, '--couleur-information-fond']]) {
      const pastille = pastilleDans(ligne(m, id).querySelector('[data-etat-table]'));
      expect(pastille, `table ${id}`).not.toBeNull();
      expect(fondDe(pastille), `table ${id}`).toEqual(jeton(teinte));
      expect(composantes(getComputedStyle(pastille).color), `table ${id}`).toEqual(encre);
      expect(etatDe(m, id)).toBe(t(id === 3 ? 'tables.etat.surchargee' : 'tables.etat.suitDefaut'));
    }
  });

  test('un avertissement de table est un avis : fond et filet de l’avis, son signe, un texte de l’encre de la page', async () => {
    const m = await preparer(chargeDe({ tables: [{ id: 1 }], n: 4 }));
    const seuil = constante('SEUIL_SIEGES_LISIBLES');
    await saisir(m, champTable(m, 1), String(seuil + 1));
    const avis = ligne(m, 1).querySelector('[data-avertissement="AU_DELA_LISIBLE"]');
    expect(fondDe(avis)).toEqual(jeton('--couleur-avis-fond'));
    expect(composantes(getComputedStyle(avis).borderTopColor)).toEqual(jeton('--couleur-avis-filet'));
    const signe = avis.querySelector('svg');
    expect(signe).not.toBeNull();
    expect(composantes(getComputedStyle(signe).color)).toEqual(jeton('--couleur-avis-marque'));
    expect(composantes(getComputedStyle(avis.querySelector('p')).color)).toEqual(jeton('--couleur-page-texte'));
  });
});

// --- Les objectifs des tables (§ 4.5, § 10.4, D3, D19) ---------------------------

// L'objectif d'une table à l'écran, par sa clé : ‹table› pour la soirée,
// ‹table›-‹tour› pour un tour ; son champ d'étiquettes et son choix de règle.
const zoneObjectif = (m, cle) => section(m).querySelector(`[data-objectif="${cle}"]`);
const champObjectif = (m, cle) => zoneObjectif(m, cle).querySelector(`input[data-champ="objectif-${cle}"]`);
const choixRegle = (m, cle) => zoneObjectif(m, cle).querySelector(`select[data-champ="regle-${cle}"]`);
const regleDefaut = (m) => section(m).querySelector('[data-regle-objectifs] select[data-champ="regleObjectifs"]');
const objectifs = (m, id) => charge(m).tables.find((table) => table.id === id).objectifs;
// Le texte d'un objectif, sans les blancs du balisage.
const texteObjectif = (m, cle) => zoneObjectif(m, cle).textContent.replace(/\s+/g, ' ').trim();

// Choisit au clavier la valeur d'un sélecteur, un cran de flèche à la fois,
// la file de la séance passée à chaque cran : chaque cran est un choix. Un
// choix refusé rend la valeur enregistrée : au plus autant de crans que
// d'options.
async function choisirAuClavier(m, choix, valeur) {
  choix.focus();
  const cible = [...choix.options].findIndex((option) => option.value === valeur);
  expect(cible, `option ${valeur}`).toBeGreaterThanOrEqual(0);
  for (let cran = 0; cran < choix.options.length && choix.selectedIndex !== cible; cran += 1) {
    await touche(choix.selectedIndex < cible ? 'ArrowDown' : 'ArrowUp');
    await attendre(m);
  }
}

// Deux tables, trois tours, quatre personnes : Iris Ombrelle porte
// « finance », Théo Pervenche « cuisine ».
function chargeObjectifs(options = {}) {
  const donnees = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 4, tours: 3, ...options });
  donnees.participants[0].etiquettes = ['finance'];
  donnees.participants[1].etiquettes = ['cuisine'];
  return donnees;
}

describe('la règle par défaut des objectifs (§ 2.1 étape 4, § 4.5, D3)', () => {
  test('dans la carte des réglages, « au moins une (OU) » ; « toutes (ET) » choisie au clavier : une entrée, la règle propre d’un objectif ne change pas', async () => {
    const donnees = chargeObjectifs();
    donnees.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: 'ou', etiquettes: ['finance'] }];
    const m = await preparer(donnees);
    const [reglages] = section(m).querySelectorAll('section[aria-labelledby]');
    expect(reglages.contains(regleDefaut(m))).toBe(true);
    expect(regleDefaut(m).value).toBe('ou');
    expect(regleDefaut(m).selectedOptions[0].textContent).toBe(t('tables.regle.ou'));
    expect(section(m).querySelector(`label[for="${regleDefaut(m).id}"]`).textContent).toBe(t('tables.regle.etiquette'));
    const r0 = revision(m);
    await choisirAuClavier(m, regleDefaut(m), 'et');
    expect(revision(m)).toBe(r0 + 1);
    expect(charge(m).reglages.regleObjectifs).toBe('et');
    expect(regleDefaut(m).value).toBe('et');
    expect(objectifs(m, 1)[0].regle).toBe('ou');
    expect(choixRegle(m, '1').value).toBe('ou');
    expect(choixRegle(m, '1').options[0].textContent).toBe(t('tables.objectif.regleDefaut', { regle: 'et' }));
  });
});

describe('l’objectif d’une table (§ 4.5, D3, D19)', () => {
  test('saisi « finance, cuisine » : une entrée, la règle suit le défaut et le dit ; « au moins une (OU) » choisie sous le défaut « ou » : l’état dit « règle propre », jamais celui du défaut', async () => {
    const m = await preparer(chargeObjectifs());
    expect(zoneObjectif(m, '1').dataset.portee).toBe('tous');
    expect(choixRegle(m, '1').value).toBe('');
    expect(commande(zoneObjectif(m, '1'), 'retirerObjectif')).toBeNull();
    const r0 = revision(m);
    await saisir(m, champObjectif(m, '1'), 'finance, cuisine');
    expect(revision(m)).toBe(r0 + 1);
    expect(objectifs(m, 1)).toEqual([{ portee: 'tous', tour: null, regle: null, etiquettes: ['cuisine', 'finance'] }]);
    expect(champObjectif(m, '1').value).toBe('cuisine, finance');
    expect(choixRegle(m, '1').value).toBe('');
    const suit = texteObjectif(m, '1');
    expect(suit).toContain(t('tables.objectif.suitDefaut'));
    expect(suit).not.toContain(t('tables.objectif.reglePropre'));

    await choisirAuClavier(m, choixRegle(m, '1'), 'ou');
    expect(revision(m)).toBe(r0 + 2);
    expect(objectifs(m, 1)[0].regle).toBe('ou');
    expect(charge(m).reglages.regleObjectifs).toBeUndefined();
    const propre = texteObjectif(m, '1');
    expect(propre).toContain(t('tables.objectif.reglePropre'));
    expect(propre).not.toContain(t('tables.objectif.suitDefaut'));
  });

  test('un objectif neuf : sa règle se choisit avant ses étiquettes, rien d’écrit ; la saisie le pose sous elle, une seule entrée', async () => {
    const m = await preparer(chargeObjectifs());
    expect(section(m).querySelector(`label[for="${choixRegle(m, '1').id}"]`).textContent).toBe(t('tables.objectif.regle'));
    expect(texteObjectif(m, '1')).not.toContain(t('tables.objectif.suitDefaut'));
    const r0 = revision(m);
    await choisirAuClavier(m, choixRegle(m, '1'), 'et');
    expect(revision(m)).toBe(r0);
    expect(objectifs(m, 1)).toBeUndefined();
    expect(choixRegle(m, '1').value).toBe('et');
    expect(document.activeElement).toBe(choixRegle(m, '1'));
    await saisir(m, champObjectif(m, '1'), 'finance, cuisine');
    expect(revision(m)).toBe(r0 + 1);
    expect(objectifs(m, 1)).toEqual([{ portee: 'tous', tour: null, regle: 'et', etiquettes: ['cuisine', 'finance'] }]);
    expect(choixRegle(m, '1').value).toBe('et');
    expect(texteObjectif(m, '1')).toContain(t('tables.objectif.reglePropre'));
    // L'autre table garde son choix vide : le choix d'un objectif neuf est
    // le sien.
    expect(choixRegle(m, '2').value).toBe('');
  });

  test('les avis contre l’objectif : personne ne correspond, une étiquette que personne ne porte, sa voisine nommée ; le champ propose les étiquettes connues', async () => {
    const m = await preparer(chargeObjectifs());
    const liste = document.getElementById(champObjectif(m, '2').getAttribute('list'));
    expect(liste.localName).toBe('datalist');
    expect([...liste.options].map((option) => option.value)).toEqual(['cuisine', 'finance']);
    await saisir(m, champObjectif(m, '2'), 'Finances');
    const avis = [...zoneObjectif(m, '2').querySelectorAll('[data-avertissement]')].map((element) => element.dataset.avertissement);
    expect(avis).toEqual(['OBJECTIF_SANS_CORRESPONDANT', 'ETIQUETTE_ORPHELINE']);
    expect(texteObjectif(m, '2')).toContain(t('ETIQUETTE_ORPHELINE', { etiquette: 'Finances', voisine: null }));
    expect([...liste.options].map((option) => option.value)).toEqual(['Finances', 'cuisine', 'finance']);
    // Théo Pervenche visé : l'objectif sert quelqu'un, les avis tombent.
    await saisir(m, champObjectif(m, '2'), 'cuisine');
    expect(zoneObjectif(m, '2').querySelectorAll('[data-avertissement]')).toHaveLength(0);

    // Un objectif écrit « Finance » à la main, quand Iris Ombrelle porte
    // « finance » : l'orpheline nomme sa voisine de même clé.
    const donnees = chargeObjectifs();
    donnees.tables[1].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['Finance'] }];
    const n = await preparer(donnees);
    expect(texteObjectif(n, '2')).toContain(t('ETIQUETTE_ORPHELINE', { etiquette: 'Finance', voisine: 'finance' }));
  });

  test('une orthographe retenue se dit contre le champ : « FINANCE » saisi reçoit « finance »', async () => {
    const m = await preparer(chargeObjectifs());
    await saisir(m, champObjectif(m, '1'), 'FINANCE');
    expect(objectifs(m, 1)[0].etiquettes).toEqual(['finance']);
    expect(champObjectif(m, '1').value).toBe('finance');
    const retenue = zoneObjectif(m, '1').querySelector('[data-avertissement="ORTHOGRAPHE_RETENUE"]');
    expect(retenue).not.toBeNull();
    expect(retenue.textContent).toContain(t('ORTHOGRAPHE_RETENUE', { saisie: 'FINANCE', retenue: 'finance' }));
  });

  test('« Retirer l’objectif » : sans fenêtre, une entrée, le champ se vide ; vider le champ d’un objectif posé est refusé contre lui, et son remède le retire', async () => {
    const donnees = chargeObjectifs();
    donnees.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: 'et', etiquettes: ['finance'] }];
    donnees.tables[1].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['cuisine'] }];
    const m = await preparer(donnees);
    const r0 = revision(m);
    await cliquer(m, commande(zoneObjectif(m, '1'), 'retirerObjectif'));
    expect(fenetre()).toBeNull();
    expect(revision(m)).toBe(r0 + 1);
    expect(objectifs(m, 1)).toBeUndefined();
    expect(champObjectif(m, '1').value).toBe('');
    expect(choixRegle(m, '1').value).toBe('');
    expect(document.activeElement).toBe(champObjectif(m, '1'));

    await saisir(m, champObjectif(m, '2'), '');
    const refus = zoneObjectif(m, '2').querySelector('[data-refus="OBJECTIF_SANS_ETIQUETTE"]');
    expect(refus).not.toBeNull();
    expect(revision(m)).toBe(r0 + 1);
    await cliquer(m, commande(refus, 'retirerObjectif'));
    expect(fenetre()).toBeNull();
    expect(revision(m)).toBe(r0 + 2);
    expect(objectifs(m, 2)).toBeUndefined();
  });

  test('« Objectifs par tour » : replié, le bouton compte ceux qui existent ; déplié au clavier, un champ par tour ; posé au tour 2, une entrée, le bouton en compte deux ; replié à l’espace', async () => {
    const donnees = chargeObjectifs();
    donnees.tables[0].objectifs = [{ portee: 'tour', tour: 3, regle: null, etiquettes: ['finance'] }];
    const m = await preparer(donnees);
    const bouton = commande(ligne(m, 1), 'basculerObjectifsTours');
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(bouton.textContent.trim()).toBe(t('tables.objectifs.parTour', { nombre: 1 }));
    expect(commande(ligne(m, 2), 'basculerObjectifsTours').textContent.trim()).toBe(t('tables.objectifs.parTour', { nombre: 0 }));
    expect(zoneObjectif(m, '1-1')).toBeNull();
    bouton.focus();
    await touche('Enter');
    await attendre(m);
    expect(bouton.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(bouton.getAttribute('aria-controls')).contains(zoneObjectif(m, '1-1'))).toBe(true);
    expect(['1-1', '1-2', '1-3'].map((cle) => zoneObjectif(m, cle).dataset.portee)).toEqual(['tour', 'tour', 'tour']);
    expect(champObjectif(m, '1-3').value).toBe('finance');
    expect(zoneObjectif(m, '2-1')).toBeNull();
    const r0 = revision(m);
    await saisir(m, champObjectif(m, '1-2'), 'cuisine');
    expect(revision(m)).toBe(r0 + 1);
    expect(objectifs(m, 1).map(({ tour }) => tour)).toEqual([2, 3]);
    expect(bouton.textContent.trim()).toBe(t('tables.objectifs.parTour', { nombre: 2 }));
    bouton.focus();
    await touche(' ');
    await attendre(m);
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(zoneObjectif(m, '1-2')).toBeNull();
  });
});

describe('« Exporter les objectifs » (§ 10.4)', () => {
  // Une proposition retenue, puis le plan bloqué.
  function chargeBloquee() {
    const donnees = chargeObjectifs();
    donnees.tables[0].objectifs = [
      { portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] },
      { portee: 'tour', tour: 2, regle: 'et', etiquettes: ['cuisine', 'finance'] },
    ];
    placer(donnees, [[[1, 2], [3, 4]], [[1, 3], [2, 4]], [[1, 4], [2, 3]]], { id: 1, retenu: true });
    donnees.evenement.etat = 'bloque';
    return donnees;
  }

  test('en écriture, en lecture et sur un plan bloqué : les octets d’exporterObjectifs, sous ‹base›-objectifs.csv, rien d’écrit au fichier', async () => {
    // Un plan bloqué ne passe pas en écriture : la séance le tient en
    // lecture seule, et refuse tout geste qui modifie.
    const ouverte = chargeObjectifs();
    ouverte.tables[1].objectifs = [{ portee: 'tour', tour: 3, regle: null, etiquettes: ['cuisine'] }];
    for (const [donnees, mode, refus] of [
      [ouverte, 'ecriture', null],
      [ouverte, 'lecture', 'MODE_LECTURE'],
      [chargeBloquee(), 'lecture', 'LECTURE_SEULE'],
    ]) {
      const m = await preparer(donnees, { mode });
      expect(m.seance.etat().refus?.code ?? null).toBe(refus);
      expect(charge(m).tables.some(({ objectifs: liste }) => liste !== undefined)).toBe(true);
      const avant = ecritures(m);
      const bouton = commande(section(m), 'exporterObjectifs');
      expect(bouton.textContent).toBe(t('tables.objectifs.exporter'));
      await cliquer(m, bouton);
      await attendre(m);
      expect(m.enregistres).toHaveLength(1);
      expect(m.enregistres[0].nomPropose).toBe(`${BASE}-objectifs.csv`);
      expect([...m.enregistres[0].octets]).toEqual([...exporterObjectifs(charge(m).tables)]);
      expect(bouton.parentElement.querySelector('[data-refus]')).toBeNull();
      expect(ecritures(m)).toBe(avant);
    }
  });
});

describe('les objectifs que les fenêtres nomment (§ 2.1 étape 5, § 4.3, § 6.2, A3, A6)', () => {
  test('trois tours, un objectif au tour 3 et un de la soirée ; 2 saisi : la fenêtre nomme l’objectif du tour 3, rien d’écrit ; Confirmer : il part, la soirée reste', async () => {
    const donnees = chargeObjectifs();
    donnees.tables[1].objectifs = [
      { portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] },
      { portee: 'tour', tour: 3, regle: null, etiquettes: ['cuisine'] },
    ];
    const m = await preparer(donnees);
    const avant = ecritures(m);
    await saisir(m, champ(m, 'tours'), '2');
    expect(fenetre()).not.toBeNull();
    expect(ecritures(m)).toBe(avant);
    expect(elementsFenetre()).toEqual([t('tables.tours.objectif', { numero: 2, tour: 3, etiquettes: ['cuisine'] })]);
    await cliquer(m, commande(fenetre(), 'confirmer'));
    expect(fenetre()).toBeNull();
    expect(objectifs(m, 2)).toEqual([{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }]);
  });

  test('une table qui ne porte qu’un objectif : sa suppression ouvre la fenêtre, qui le nomme', async () => {
    const donnees = chargeObjectifs();
    donnees.tables[0].objectifs = [{ portee: 'tour', tour: 2, regle: 'et', etiquettes: ['cuisine', 'finance'] }];
    const m = await preparer(donnees);
    await cliquer(m, commande(ligne(m, 1), 'supprimerTable'));
    expect(fenetre()).not.toBeNull();
    expect(elementsFenetre()).toEqual([t('tables.suppression.objectif', { tour: 2, etiquettes: ['cuisine', 'finance'] })]);
    await cliquer(m, commande(fenetre(), 'renoncer'));
    expect(charge(m).tables).toHaveLength(2);
  });
});

describe('les objectifs en lecture (§ 8.4)', () => {
  test('poser un objectif, choisir la règle par défaut ou celle d’un objectif, le retirer : refusés contre le geste, le message porte « Modifier », rien d’écrit ; le choix montre la règle enregistrée', async () => {
    const donnees = chargeObjectifs();
    donnees.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
    const m = await preparer(donnees, { mode: 'lecture' });
    const avant = ecritures(m);
    const modifier = t('communs.remede.modifier');

    await cliquer(m, champObjectif(m, '2'));
    await touche('x');
    await attendre(m);
    expect(zoneObjectif(m, '2').querySelector('[data-refus="MODE_LECTURE"]').textContent).toContain(modifier);

    await choisirAuClavier(m, regleDefaut(m), 'et');
    expect(regleDefaut(m).value).toBe('ou');
    expect(regleDefaut(m).closest('[data-regle-objectifs]').querySelector('[data-refus="MODE_LECTURE"]').textContent).toContain(modifier);

    const decrit = (choix) => document.getElementById(choix.getAttribute('aria-describedby'));
    expect(decrit(regleDefaut(m)).dataset.refus).toBe('MODE_LECTURE');

    await choisirAuClavier(m, choixRegle(m, '1'), 'ou');
    expect(choixRegle(m, '1').value).toBe('');
    expect(zoneObjectif(m, '1').querySelector('[data-refus="MODE_LECTURE"]').textContent).toContain(modifier);
    expect(choixRegle(m, '1').getAttribute('aria-invalid')).toBe('true');
    expect(decrit(choixRegle(m, '1')).dataset.refus).toBe('MODE_LECTURE');
    expect(decrit(choixRegle(m, '1')).textContent).toContain(modifier);
    expect(document.activeElement).toBe(choixRegle(m, '1'));

    // Le choix d'un objectif que la table ne porte pas encore : refusé de
    // même, il rend la valeur vide.
    await choisirAuClavier(m, choixRegle(m, '2'), 'et');
    expect(choixRegle(m, '2').value).toBe('');
    expect(decrit(choixRegle(m, '2')).dataset.refus).toBe('MODE_LECTURE');

    await cliquer(m, commande(zoneObjectif(m, '1'), 'retirerObjectif'));
    expect(commande(zoneObjectif(m, '1'), 'retirerObjectif').parentElement.querySelector('[data-refus="MODE_LECTURE"]')).not.toBeNull();
    expect(objectifs(m, 1)).toHaveLength(1);
    expect(charge(m).reglages.regleObjectifs).toBeUndefined();
    expect(ecritures(m)).toBe(avant);
  });
});

// --- Les noms accessibles et le focus (§ 14.5) ------------------------------------

// Le nom accessible d'un contrôle, calculé comme le font les technologies
// d'assistance pour les formes que la section emploie : aria-labelledby,
// puis aria-label, puis l'étiquette du champ, puis le texte du contrôle.
// Chaque nom relevé est confronté à toHaveAccessibleName, qui suit
// l'algorithme complet : le calcul ne s'écarte jamais de lui.
function nomAccessible(element) {
  const texte = (noeud) => noeud.textContent.replace(/\s+/g, ' ').trim();
  const designes = element.getAttribute('aria-labelledby');
  if (designes !== null) return designes.split(/\s+/).map((id) => texte(document.getElementById(id))).join(' ');
  const etiquette = element.getAttribute('aria-label');
  if (etiquette !== null) return etiquette.trim();
  if (element.labels !== undefined && element.labels.length > 0) return [...element.labels].map(texte).join(' ');
  return texte(element);
}

// Le texte que l'œil lit pour un contrôle : son étiquette, ou son texte.
const texteVu = (element) =>
  (element.labels !== undefined && element.labels.length > 0 ? element.labels[0] : element).textContent.replace(/\s+/g, ' ').trim();

describe('les commandes répétées sous chaque table se distinguent (§ 14.5)', () => {
  test('deux tables dépliées, en lecture, chacune avec cinq refus : chaque contrôle, remèdes compris, nomme sa table après son texte visible, et les noms sont deux à deux distincts', async () => {
    const donnees = chargeObjectifs({ tables: [{ id: 1, sieges: 6 }, { id: 2, sieges: 6 }] });
    for (const table of donnees.tables) {
      table.objectifs = [
        { portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] },
        { portee: 'tour', tour: 2, regle: 'et', etiquettes: ['cuisine'] },
      ];
    }
    const m = await preparer(donnees);
    for (const id of [1, 2]) await cliquer(m, commande(ligne(m, id), 'basculerObjectifsTours'));
    // En lecture, chaque table refuse ses places, le champ et la règle de
    // son objectif de la soirée, « Supprimer » et « Retirer l'objectif » :
    // cinq refus par table, chacun avec son remède « Modifier ».
    await m.seance.passerEnLecture();
    await attendre(m);
    for (const id of [1, 2]) {
      await saisir(m, champTable(m, id), '7');
      await saisir(m, champObjectif(m, String(id)), 'x');
      await choisirAuClavier(m, choixRegle(m, String(id)), 'et');
      await cliquer(m, commande(ligne(m, id), 'supprimerTable'));
      await cliquer(m, commande(zoneObjectif(m, String(id)), 'retirerObjectif'));
    }
    const remedes = [1, 2].flatMap((id) => [...ligne(m, id).querySelectorAll('[data-refus="MODE_LECTURE"] button')]);
    expect(remedes).toHaveLength(2 * 5);
    expect(new Set(remedes.map(texteVu))).toEqual(new Set([t('communs.remede.modifier')]));

    const controles = [1, 2].flatMap((id) => [...ligne(m, id).querySelectorAll('input, select, button')]);
    // Par table : places, réaligner, supprimer, le bouton qui déplie, et,
    // pour la soirée et les trois tours, un champ et un choix de règle,
    // plus « Retirer l'objectif » pour les deux objectifs posés ; puis les
    // cinq remèdes.
    expect(controles).toHaveLength(2 * (4 + 4 * 2 + 2 + 5));
    const noms = controles.map(nomAccessible);
    for (const [rang, element] of controles.entries()) {
      expect(element).toHaveAccessibleName(noms[rang]);
      expect(noms[rang].startsWith(texteVu(element)), `« ${noms[rang]} » commence par « ${texteVu(element)} »`).toBe(true);
    }
    const doublons = noms.filter((nom, rang) => noms.indexOf(nom) !== rang);
    expect(doublons).toEqual([]);

    // Le texte visible ne change pas ; le nom ajoute la portée et la table.
    const regle = choixRegle(m, '2-2');
    expect(texteVu(regle)).toBe(t('tables.objectif.regle'));
    expect(nomAccessible(regle)).toBe(t('tables.nom.objectif', { cle: 'tables.objectif.regle', tour: 2, numero: 2 }));
    expect(nomAccessible(champObjectif(m, '1'))).toBe(t('tables.nom.table', { cle: 'tables.objectif.soiree', numero: 1 }));
    expect(nomAccessible(commande(ligne(m, 2), 'supprimerTable'))).toBe(t('tables.nom.table', { cle: 'tables.liste.supprimer', numero: 2 }));
    // Le remède nomme, après son texte, le contrôle dont il lève le refus.
    const remedePlaces = ligne(m, 1).querySelector('.saisie [data-refus] button');
    expect(nomAccessible(remedePlaces)).toBe(
      t('communs.nom.remede', { cle: 'communs.remede.modifier', objet: t('tables.nom.table', { cle: 'tables.liste.places', numero: 1 }) }),
    );
  });
});

describe('le focus après un remède qui retire son refus (§ 14.5)', () => {
  test('vider l’objectif posé, puis son remède « Retirer l’objectif » : le refus part, le focus revient au champ, jamais au corps de la page', async () => {
    const donnees = chargeObjectifs();
    donnees.tables[1].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['cuisine'] }];
    const m = await preparer(donnees);
    await saisir(m, champObjectif(m, '2'), '');
    const refus = zoneObjectif(m, '2').querySelector('[data-refus="OBJECTIF_SANS_ETIQUETTE"]');
    expect(refus).not.toBeNull();
    await cliquer(m, commande(refus, 'retirerObjectif'));
    expect(objectifs(m, 2)).toBeUndefined();
    await vi.waitFor(() => expect(zoneObjectif(m, '2').querySelector('[data-refus]')).toBeNull());
    await vi.waitFor(() => expect(document.activeElement).toBe(champObjectif(m, '2')));
  });

  test('en lecture, le choix d’une règle refusé, puis « Modifier » : le focus revient au choix qui portait le refus, celui de l’objectif comme celui du défaut', async () => {
    const donnees = chargeObjectifs();
    donnees.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
    for (const choix of [(m) => choixRegle(m, '1'), (m) => regleDefaut(m)]) {
      const m = await preparer(donnees, { mode: 'lecture' });
      await choisirAuClavier(m, choix(m), 'et');
      const refus = document.getElementById(choix(m).getAttribute('aria-describedby'));
      expect(refus.dataset.refus).toBe('MODE_LECTURE');
      await cliquer(m, refus.querySelector('button'));
      await vi.waitFor(() => expect(m.seance.etat().mode).toBe('ecriture'));
      await vi.waitFor(() => expect(choix(m).getAttribute('aria-describedby')).toBeNull());
      await vi.waitFor(() => expect(document.activeElement).toBe(choix(m)));
    }
  });

  test('en lecture, une commande de table refusée — « Supprimer », « Retirer l’objectif » —, puis « Modifier » : le refus part, le focus revient au bouton de la commande', async () => {
    const donnees = chargeObjectifs();
    donnees.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
    for (const bouton of [(m) => commande(ligne(m, 1), 'supprimerTable'), (m) => commande(zoneObjectif(m, '1'), 'retirerObjectif')]) {
      const m = await preparer(donnees, { mode: 'lecture' });
      await cliquer(m, bouton(m));
      const refus = bouton(m).parentElement.querySelector('[data-refus="MODE_LECTURE"]');
      expect(refus).not.toBeNull();
      await cliquer(m, refus.querySelector('button'));
      await vi.waitFor(() => expect(m.seance.etat().mode).toBe('ecriture'));
      await vi.waitFor(() => expect(bouton(m).parentElement.querySelector('[data-refus]')).toBeNull());
      await vi.waitFor(() => expect(document.activeElement).toBe(bouton(m)));
    }
  });
});
