// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La machine d'une commande et les remèdes d'un refus (§ 2.1, § 8.5,
// § 14.6). Une commande à confirmer s'arme au premier clic et n'exécute
// qu'au second ; le délai la désarme. Le libellé d'un remède est une clé
// composée à l'exécution, communs.remede.<commande> ou
// communs.remede.<geste>[.<variante>] : la garde des clés littérales ne la
// voit pas, et cette épreuve l'énumère sur COMMANDES et sur les gestes du
// contrat de données.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, test } from '../../../test/lanceur.js';
import { COMMANDES } from '../../application/commandes.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { TABLE as COMMUNS } from '../libelles/communs.js';
import {
  CONFIRMATION_DEBLOCAGE,
  DELAI_CONFIRMATION_MS,
  GESTES,
  SECTIONS_REMEDE,
  SOURCES_SECOURS,
  VARIANTES_COMMANDE,
  actionRemede,
  creerMachineCommande,
  exigerVariante,
  libelleRemede,
} from './commande.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Une séance d'épreuve : chaque appel se consigne, et rend ce que l'épreuve
// lui donne.
function seanceEnregistreuse() {
  const appels = [];
  const consigner = (nom) => (...args) => {
    appels.push([nom, ...args]);
    return Promise.resolve({ nom });
  };
  return {
    appels,
    etat: () => ({ evenement: { base: 'Soirée des Merles' } }),
    executer: consigner('executer'),
    passerEnEcriture: consigner('passerEnEcriture'),
    debloquer: consigner('debloquer'),
    ouvrirSecours: consigner('ouvrirSecours'),
    ecrireAilleurs: consigner('ecrireAilleurs'),
  };
}

function uiEnregistreur() {
  const appels = [];
  return {
    appels,
    allerA: (section) => appels.push(['allerA', section]),
    montrerTour: (tour) => appels.push(['montrerTour', tour]),
    montrerProposition: (id) => appels.push(['montrerProposition', id]),
  };
}

const RACINE = { id: 'documents', chemin: 'D:\\Exemple\\Documents' };

describe('commande : la machine', () => {
  test('le délai de confirmation est de dix secondes', () => {
    assert.equal(DELAI_CONFIRMATION_MS, 10_000);
  });

  test('sans confirmer, chaque clic exécute une fois l’exécution précédente terminée, et la commande ne s’arme jamais', () => {
    const commande = creerMachineCommande();
    assert.deepEqual(commande.cliquer(), { action: 'executer' });
    commande.terminer();
    assert.deepEqual(commande.cliquer(), { action: 'executer' });
    commande.terminer();
    assert.equal(commande.armee, false);
  });

  test('avec confirmer : un clic arme, un second exécute et désarme', () => {
    const commande = creerMachineCommande({ confirmer: CONFIRMATION_DEBLOCAGE });
    assert.equal(commande.armee, false);
    assert.deepEqual(commande.cliquer(), { action: 'armer' });
    assert.equal(commande.armee, true);
    assert.deepEqual(commande.cliquer(), { action: 'executer' });
    assert.equal(commande.armee, false);
    commande.terminer();
    assert.deepEqual(commande.cliquer(), { action: 'armer' }, 'après exécution, le clic suivant arme de nouveau');
  });

  test('pendant l’exécution, un clic ne fait rien : ni seconde exécution, ni armement ; terminer() la rend', () => {
    const simple = creerMachineCommande();
    assert.deepEqual(simple.cliquer(), { action: 'executer' });
    assert.equal(simple.enCours, true);
    assert.deepEqual(simple.cliquer(), { action: 'aucune' });
    assert.deepEqual(simple.cliquer({ repete: true }), { action: 'aucune' });
    simple.terminer();
    assert.equal(simple.enCours, false);
    assert.deepEqual(simple.cliquer(), { action: 'executer' });

    const confirmee = creerMachineCommande({ confirmer: CONFIRMATION_DEBLOCAGE });
    confirmee.cliquer();
    assert.deepEqual(confirmee.cliquer(), { action: 'executer' });
    assert.deepEqual(confirmee.cliquer(), { action: 'aucune' }, 'occupée, le clic ne la réarme pas');
    assert.equal(confirmee.armee, false);
    confirmee.terminer();
    assert.deepEqual(confirmee.cliquer(), { action: 'armer' });
  });

  test('armée, le clic répété d’un double-clic ne confirme pas : elle reste armée, et un clic simple ensuite exécute (§ 8.5)', () => {
    const commande = creerMachineCommande({ confirmer: CONFIRMATION_DEBLOCAGE });
    assert.deepEqual(commande.cliquer({ repete: false }), { action: 'armer' });
    assert.deepEqual(commande.cliquer({ repete: true }), { action: 'aucune' });
    assert.equal(commande.armee, true);
    assert.equal(commande.enCours, false);
    assert.deepEqual(commande.cliquer({ repete: true }), { action: 'aucune' }, 'un triple clic non plus');
    assert.deepEqual(commande.cliquer({ repete: false }), { action: 'executer' });
    assert.equal(commande.armee, false);
  });

  test('le clic répété d’une série n’exécute jamais, avec ou sans confirmer : il ne fait rien, et le clic simple suivant exécute', () => {
    const simple = creerMachineCommande();
    assert.deepEqual(simple.cliquer({ repete: true }), { action: 'aucune' }, 'reçu sans le premier clic de sa série');
    assert.equal(simple.enCours, false);
    assert.deepEqual(simple.cliquer({ repete: false }), { action: 'executer' });
    simple.terminer();
    assert.deepEqual(simple.cliquer({ repete: true }), { action: 'aucune' }, 'le second clic d’un double-clic');
    assert.deepEqual(simple.cliquer({ repete: true }), { action: 'aucune' }, 'le troisième');
    assert.deepEqual(simple.cliquer(), { action: 'executer' });

    const confirmee = creerMachineCommande({ confirmer: CONFIRMATION_DEBLOCAGE });
    assert.deepEqual(confirmee.cliquer({ repete: true }), { action: 'aucune' }, 'désarmée, le clic répété ne l’arme pas');
    assert.equal(confirmee.armee, false);
  });

  test('armée puis expirer() : désarmée, et le clic suivant arme de nouveau, sans exécuter', () => {
    const commande = creerMachineCommande({ confirmer: CONFIRMATION_DEBLOCAGE });
    commande.cliquer();
    commande.expirer();
    assert.equal(commande.armee, false);
    assert.deepEqual(commande.cliquer(), { action: 'armer' });
  });
});

describe('commande : le libellé d’un remède', () => {
  test('un remède de commande → communs.remede.<commande>, ses arguments pour détails', () => {
    const remede = { commande: 'reintegrerParticipant', arguments: { id: 3 } };
    assert.deepEqual(libelleRemede(remede), { cle: 'communs.remede.reintegrerParticipant', details: { id: 3 } });
  });

  test('un geste à variantes → communs.remede.<geste>.<variante>', () => {
    assert.equal(libelleRemede({ geste: 'ouvrirSecours', source: 'precedent' }).cle, 'communs.remede.ouvrirSecours.precedent');
    assert.equal(libelleRemede({ geste: 'ouvrirSecours', source: 'journal' }).cle, 'communs.remede.ouvrirSecours.journal');
    assert.equal(libelleRemede({ geste: 'ecrireAilleurs', racine: RACINE }).cle, 'communs.remede.ecrireAilleurs.documents');
    assert.equal(libelleRemede({ geste: 'ecrireAilleurs', racine: null }).cle, 'communs.remede.ecrireAilleurs.choisi');
    assert.equal(libelleRemede({ geste: 'ouvrirSection', section: 'tables' }).cle, 'communs.remede.ouvrirSection.tables');
  });

  test('un geste sans variante → communs.remede.<geste> ; afficherTour porte son tour', () => {
    assert.deepEqual(libelleRemede({ geste: 'modifier' }), { cle: 'communs.remede.modifier', details: {} });
    assert.deepEqual(libelleRemede({ geste: 'debloquer' }), { cle: 'communs.remede.debloquer', details: {} });
    assert.deepEqual(libelleRemede({ geste: 'afficherTour', tour: 2, proposition: null }), {
      cle: 'communs.remede.afficherTour',
      details: { tour: 2 },
    });
    assert.equal(libelleRemede({ geste: 'choisirPlace', puis: { commande: 'deplacerReservation', arguments: {} } }).cle, 'communs.remede.choisirPlace');
  });

  test('un geste, une source ou une section hors du contrat lève RangeError en les nommant', () => {
    assert.throws(() => libelleRemede({ geste: 'voler' }), (e) => e instanceof RangeError && /voler/.test(e.message));
    assert.throws(() => libelleRemede({ geste: 'ouvrirSecours', source: 'ailleurs' }), RangeError);
    assert.throws(() => libelleRemede({ geste: 'ouvrirSection', section: 'accueil' }), RangeError);
    assert.throws(() => libelleRemede({ commande: 'voler', arguments: {} }), RangeError);
  });
});

describe('commande : les clés des remèdes, par énumération (§ 14.6)', () => {
  test('chaque commande de COMMANDES a son libellé de remède, une chaîne non vide', () => {
    const noms = [...COMMANDES.keys()];
    assert.ok(noms.length >= 20, `${noms.length} commandes`);
    for (const nom of noms) {
      const { cle, details } = libelleRemede({ commande: nom, arguments: {} });
      const texte = t(cle, details);
      assert.equal(typeof texte, 'string', nom);
      assert.ok(texte.length > 0 && !texte.includes('undefined'), `${nom} : « ${texte} »`);
    }
  });

  test('chaque geste du contrat, chaque variante comprise, a son libellé', () => {
    assert.deepEqual([...GESTES], [
      'modifier', 'debloquer', 'afficherTour', 'ouvrirSection', 'choisirPlace', 'ouvrirSecours', 'ecrireAilleurs',
      'enregistrerSous', 'choisirPapier', 'repartirDeZero', 'libererTour',
    ]);
    assert.deepEqual([...SOURCES_SECOURS], ['precedent', 'journal']);
    assert.deepEqual([...SECTIONS_REMEDE], ['import', 'participants', 'tables', 'plan', 'diagnostic', 'generation', 'propositions']);
    const remedes = [
      { geste: 'modifier' },
      { geste: 'debloquer' },
      { geste: 'afficherTour', tour: 3, proposition: null },
      ...SECTIONS_REMEDE.map((section) => ({ geste: 'ouvrirSection', section })),
      { geste: 'choisirPlace', puis: { commande: 'deplacerReservation', arguments: {} } },
      ...SOURCES_SECOURS.map((source) => ({ geste: 'ouvrirSecours', source })),
      { geste: 'ecrireAilleurs', racine: RACINE },
      { geste: 'ecrireAilleurs', racine: null },
      { geste: 'enregistrerSous' },
      { geste: 'choisirPapier' },
      { geste: 'repartirDeZero' },
      { geste: 'libererTour', tour: 3 },
    ];
    assert.equal(remedes.length, 19);
    const textes = remedes.map((remede) => {
      const { cle, details } = libelleRemede(remede);
      return t(cle, details);
    });
    for (const texte of textes) assert.ok(texte.length > 0 && !texte.includes('undefined'), texte);
    assert.equal(t('communs.remede.afficherTour', { tour: 3 }), 'Afficher le tour 3');
    assert.equal(new Set(textes).size, textes.length, 'deux variantes ne se confondent pas');
  });

  test('les remèdes de la planche : enregistrerSous et choisirPapier ont leur clé, sans variante', () => {
    assert.deepEqual(libelleRemede({ geste: 'enregistrerSous' }), { cle: 'communs.remede.enregistrerSous', details: {} });
    assert.deepEqual(libelleRemede({ geste: 'choisirPapier' }), { cle: 'communs.remede.choisirPapier', details: {} });
    assert.equal(t('communs.remede.enregistrerSous'), 'Enregistrer sous\u{2026}');
    assert.equal(t('communs.remede.choisirPapier'), 'Choisir le papier');
  });

  test('les remèdes du départ : repartirDeZero sans détail, libererTour porte son tour comme afficherTour', () => {
    assert.deepEqual(libelleRemede({ geste: 'repartirDeZero' }), { cle: 'communs.remede.repartirDeZero', details: {} });
    assert.deepEqual(libelleRemede({ geste: 'libererTour', tour: 2 }), { cle: 'communs.remede.libererTour', details: { tour: 2 } });
    assert.equal(t('communs.remede.repartirDeZero'), 'Repartir de zéro');
    assert.equal(t('communs.remede.libererTour', { tour: 2 }), 'Ne plus figer le tour 2');
  });

  test('reprendreVerrou, offert à côté de VERROU_PRIS, a sa clé', () => {
    assert.equal(t('communs.remede.reprendreVerrou'), 'Reprendre le verrou');
  });

  test('aucune clé communs.remede.* hors de l’énumération : chacune est atteinte par une commande, un geste ou reprendreVerrou', () => {
    const atteintes = new Set([
      'communs.remede.reprendreVerrou',
      ...[...COMMANDES.keys()].map((nom) => libelleRemede({ commande: nom, arguments: {} }).cle),
      libelleRemede({ geste: 'modifier' }).cle,
      libelleRemede({ geste: 'debloquer' }).cle,
      libelleRemede({ geste: 'afficherTour', tour: 1, proposition: null }).cle,
      libelleRemede({ geste: 'choisirPlace' }).cle,
      ...SECTIONS_REMEDE.map((section) => libelleRemede({ geste: 'ouvrirSection', section }).cle),
      ...SOURCES_SECOURS.map((source) => libelleRemede({ geste: 'ouvrirSecours', source }).cle),
      libelleRemede({ geste: 'ecrireAilleurs', racine: RACINE }).cle,
      libelleRemede({ geste: 'ecrireAilleurs', racine: null }).cle,
      libelleRemede({ geste: 'enregistrerSous' }).cle,
      libelleRemede({ geste: 'choisirPapier' }).cle,
      libelleRemede({ geste: 'repartirDeZero' }).cle,
      libelleRemede({ geste: 'libererTour', tour: 1 }).cle,
    ]);
    const posees = [...COMMUNS.keys()].filter((cle) => cle.startsWith('communs.remede.'));
    assert.ok(posees.length > 0);
    assert.deepEqual(posees.filter((cle) => !atteintes.has(cle)), []);
  });

  test('chaque geste, source et section qu’un remède de src/application écrit en littéral est du contrat', () => {
    const dossier = new URL('../../application/', import.meta.url);
    const sources = readdirSync(dossier).filter((nom) => nom.endsWith('.js') && !nom.endsWith('.test.js'));
    const releves = { geste: new Set(), source: new Set(), section: new Set() };
    for (const nom of sources) {
      const texte = readFileSync(new URL(nom, dossier), 'utf8');
      // Le geste de tout remède ; la source d'un secours et la section ouverte
      // dans leur remède seul — EtatPlaces porte aussi une source —, et la
      // section que generation.js passe à son aide versSection.
      for (const [, geste] of texte.matchAll(/\bgeste: '([A-Za-z]+)'/g)) releves.geste.add(geste);
      for (const [, source] of texte.matchAll(/geste: 'ouvrirSecours', source: '([A-Za-z]+)'/g)) releves.source.add(source);
      for (const [, , section] of texte.matchAll(/(geste: 'ouvrirSection', section: |versSection\()'([A-Za-z]+)'/g)) {
        releves.section.add(section);
      }
    }
    assert.ok(releves.geste.size >= 5, [...releves.geste].join(', '));
    assert.ok(releves.section.size > 0 && releves.source.size > 0);
    assert.deepEqual([...releves.geste].filter((g) => !GESTES.includes(g)), []);
    assert.deepEqual([...releves.source].filter((s) => !SOURCES_SECOURS.includes(s)), []);
    assert.deepEqual([...releves.section].filter((s) => !SECTIONS_REMEDE.includes(s)), []);
  });
});

describe('commande : l’action d’un remède', () => {
  test('un remède null n’offre aucune action', () => {
    assert.equal(actionRemede(null, { seance: seanceEnregistreuse() }), null);
  });

  test('un remède de commande exécute la commande telle quelle, par la séance', async () => {
    const seance = seanceEnregistreuse();
    const action = actionRemede({ commande: 'retirerTitre', arguments: { table: 2, siege: 4 } }, { seance });
    assert.equal(action.nom, 'retirerTitre');
    assert.equal(action.cle, 'communs.remede.retirerTitre');
    assert.equal(action.confirmer, null);
    await action.executer();
    assert.deepEqual(seance.appels, [['executer', 'retirerTitre', { table: 2, siege: 4 }]]);
  });

  test('modifier → passerEnEcriture ; ouvrirSecours → la base ouverte et la source ; ecrireAilleurs → la racine du remède', async () => {
    const seance = seanceEnregistreuse();
    await actionRemede({ geste: 'modifier' }, { seance }).executer();
    await actionRemede({ geste: 'ouvrirSecours', source: 'journal' }, { seance }).executer();
    await actionRemede({ geste: 'ecrireAilleurs', racine: RACINE }, { seance }).executer();
    await actionRemede({ geste: 'ecrireAilleurs', racine: null }, { seance }).executer();
    assert.deepEqual(seance.appels, [
      ['passerEnEcriture'],
      ['ouvrirSecours', 'Soirée des Merles', 'journal'],
      ['ecrireAilleurs', RACINE],
      ['ecrireAilleurs', null],
    ]);
  });

  test('debloquer se confirme : son action porte la clé de confirmation, et appelle seance.debloquer', async () => {
    const seance = seanceEnregistreuse();
    const action = actionRemede({ geste: 'debloquer' }, { seance });
    assert.equal(action.confirmer, CONFIRMATION_DEBLOCAGE);
    assert.equal(CONFIRMATION_DEBLOCAGE, 'communs.commande.confirmerDeblocage');
    assert.equal(action.nom, 'debloquer');
    await action.executer();
    assert.deepEqual(seance.appels, [['debloquer']]);
  });

  test('debloquer offert comme commande se confirme aussi : aucun chemin ne débloque en un clic (§ 8.5)', async () => {
    const seance = seanceEnregistreuse();
    const action = actionRemede({ commande: 'debloquer', arguments: {} }, { seance });
    assert.equal(action.confirmer, CONFIRMATION_DEBLOCAGE);
    assert.equal(action.nom, 'debloquer');
    await action.executer();
    assert.deepEqual(seance.appels, [['executer', 'debloquer', {}]]);
  });

  test('afficherTour et ouvrirSection passent par l’état de navigation ; sans lui, aucune action', () => {
    const seance = seanceEnregistreuse();
    const ui = uiEnregistreur();
    actionRemede({ geste: 'afficherTour', tour: 2, proposition: null }, { seance, ui }).executer();
    actionRemede({ geste: 'ouvrirSection', section: 'participants' }, { seance, ui }).executer();
    assert.deepEqual(ui.appels, [['montrerProposition', null], ['montrerTour', 2], ['allerA', 'participants']]);
    assert.equal(actionRemede({ geste: 'ouvrirSection', section: 'tables' }, { seance }), null);
    assert.deepEqual(seance.appels, []);
  });

  test('enregistrerSous et choisirPapier passent par les gestes de l’écran, qui sait la planche et le papier ; sans eux, aucune action', () => {
    const seance = seanceEnregistreuse();
    const recus = [];
    for (const geste of ['enregistrerSous', 'choisirPapier']) {
      assert.equal(actionRemede({ geste }, { seance, ui: uiEnregistreur() }), null, geste);
      const action = actionRemede({ geste }, { seance, gestes: { [geste]: (remede) => recus.push(remede) } });
      assert.deepEqual([action.nom, action.cle, action.confirmer], [geste, `communs.remede.${geste}`, null]);
      action.executer();
    }
    assert.deepEqual(recus, [{ geste: 'enregistrerSous' }, { geste: 'choisirPapier' }]);
    assert.deepEqual(seance.appels, []);
  });

  test('choisirPlace, et tout geste que l’écran fournit, passent par gestes ; sans lui, choisirPlace n’offre aucune action', () => {
    const seance = seanceEnregistreuse();
    const recus = [];
    const remede = { geste: 'choisirPlace', puis: { commande: 'deplacerReservation', arguments: { participant: 4 } } };
    assert.equal(actionRemede(remede, { seance, ui: uiEnregistreur() }), null);
    const action = actionRemede(remede, { seance, gestes: { choisirPlace: (r) => recus.push(r) } });
    action.executer();
    assert.deepEqual(recus, [remede]);
    assert.equal(action.cle, 'communs.remede.choisirPlace');
  });
});

describe('commande : la variante', () => {
  test('quatre variantes, la secondaire en tête : celle d’une commande qui n’en donne pas', () => {
    assert.deepEqual(VARIANTES_COMMANDE, ['secondaire', 'principale', 'discrete', 'retrait']);
    assert.ok(Object.isFrozen(VARIANTES_COMMANDE));
  });

  test('exigerVariante rend une variante du contrat telle quelle ; une autre lève RangeError en la nommant', () => {
    for (const variante of VARIANTES_COMMANDE) assert.equal(exigerVariante(variante), variante);
    for (const autre of ['primaire', '', null, undefined, 'Principale']) {
      assert.throws(() => exigerVariante(autre), (e) => e instanceof RangeError && e.message.includes(JSON.stringify(autre) ?? 'undefined'), String(autre));
    }
  });

  test('le retrait ne se confirme pas : avec une clé de confirmation, exigerVariante lève RangeError ; les autres variantes la prennent', () => {
    assert.throws(() => exigerVariante('retrait', 'communs.commande.confirmer'), RangeError);
    assert.equal(exigerVariante('retrait', null), 'retrait');
    for (const variante of ['secondaire', 'principale', 'discrete']) assert.equal(exigerVariante(variante, 'communs.commande.confirmer'), variante);
  });
});
