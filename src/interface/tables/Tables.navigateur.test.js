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
import { visible } from '../../../test/navigateur/rendu.js';
import { creerEtatUi } from '../etat_ui.js';
import { TABLES_INTERFACE } from '../libelles.js';
import SectionTables from './SectionTables.svelte';

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
// corps, avec les contextes de l'application.
async function preparer(charge, { mode = 'ecriture' } = {}) {
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
  ]);
  const cible = document.createElement('div');
  document.body.prepend(cible);
  const composant = mount(SectionTables, { target: cible, props: {}, context: contexte });
  flushSync();
  montes.push({ composant, cible });
  return { fs, seance, ui, cible };
}

const section = (m) => m.cible.querySelector('[data-section="tables"]');
const charge = (m) => m.seance.etat().charge;
const revision = (m) => m.seance.etat().evenement.revision;
const ecritures = (m) => m.fs.compteurs.ecritures;
const ligne = (m, id) => section(m).querySelector(`[data-table="${id}"]`);
const champTable = (m, id) => ligne(m, id).querySelector(`input[data-champ="sieges-${id}"]`);
const champ = (m, cle) => section(m).querySelector(`input[data-champ="${cle}"]`);
const commande = (racine, nom) => racine.querySelector(`[data-commande="${nom}"]`);
const etatDe = (m, id) => ligne(m, id).querySelector('[data-etat-table]').textContent;
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
