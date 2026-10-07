// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle de l'événement ouvert (§ 8.4, § 8.5, § 8.8, § 8.9, § 9) : le cadre
// de mode et sa forme, la commande de la place fixe, les états du plan et
// leurs clés, la reprise de verrou offerte, et les avertissements ordonnés,
// chacun avec son remède. Chaque épreuve part d'un EtatSeance réduit à ce que
// la fonction lit ; les noms et identifiants sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { ETATS_PLAN, avertissementsOrdonnes, cadreDeMode, cleEtat, commandeFixe, repriseOfferte } from './modele.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

const FORMAT_REFUS = { code: 'LECTURE_SEULE', details: { raison: 'FORMAT', remede: null } };
const BLOQUE_REFUS = { code: 'LECTURE_SEULE', details: { raison: 'BLOQUE', remede: { geste: 'debloquer' } } };

// Un EtatSeance réduit : mode, événement (null, ou son état du plan), refus,
// avertissements, fautives, examen, verrouAutre.
function etat({
  mode = 'lecture',
  plan = 'brouillon',
  refus = null,
  avertissements = [],
  fautives = [],
  examen = null,
  verrouAutre = null,
} = {}) {
  return {
    mode,
    evenement:
      plan === null ? null : { base: 'merles', id: 'evt-merles', nom: 'Club des Merles', etat: plan, revision: 3, annonceFormat: null },
    refus,
    avertissements,
    fautives,
    examen,
    verrouAutre,
  };
}

describe('cadreDeMode (§ 8.4, § 14.5)', () => {
  test('null sans événement', () => {
    assert.equal(cadreDeMode(etat({ plan: null })), null);
  });

  test('lecture : tirets ; écriture : trait plein ; bloqué : trait double, quel que soit le mode', () => {
    assert.deepEqual(cadreDeMode(etat({ mode: 'lecture' })), { cle: 'coquille.mode.lecture', forme: 'tirets' });
    assert.deepEqual(cadreDeMode(etat({ mode: 'ecriture' })), { cle: 'coquille.mode.ecriture', forme: 'plein' });
    assert.deepEqual(cadreDeMode(etat({ mode: 'lecture', plan: 'bloque' })), { cle: 'coquille.mode.bloque', forme: 'double' });
    assert.deepEqual(cadreDeMode(etat({ mode: 'ecriture', plan: 'bloque' })), { cle: 'coquille.mode.bloque', forme: 'double' });
  });

  test('trois formes distinctes pour trois libellés distincts, chaque libellé traduit', () => {
    const cadres = [etat(), etat({ mode: 'ecriture' }), etat({ plan: 'bloque' })].map(cadreDeMode);
    assert.equal(new Set(cadres.map(({ forme }) => forme)).size, 3);
    assert.equal(new Set(cadres.map(({ cle }) => t(cle))).size, 3);
  });
});

describe('commandeFixe (§ 8.4, § 8.5, § 8.8)', () => {
  test('null sans événement ; modifier en lecture ; lecture en écriture ; debloquer sur un plan bloqué', () => {
    assert.equal(commandeFixe(etat({ plan: null })), null);
    assert.equal(commandeFixe(etat()), 'modifier');
    assert.equal(commandeFixe(etat({ mode: 'ecriture', plan: 'retenu' })), 'lecture');
    assert.equal(commandeFixe(etat({ plan: 'bloque', refus: BLOQUE_REFUS })), 'debloquer');
  });

  test("un format plus récent remplace la commande par l'explication, avant le plan bloqué", () => {
    assert.equal(commandeFixe(etat({ refus: FORMAT_REFUS })), 'format');
    assert.equal(commandeFixe(etat({ plan: 'bloque', refus: FORMAT_REFUS })), 'format');
  });
});

describe('les états du plan (§ 9)', () => {
  test("les quatre états, dans l'ordre du § 9, figés, chacun sous sa clé evenement.etat.<etat>, traduite", () => {
    assert.deepEqual(ETATS_PLAN, ['brouillon', 'propose', 'retenu', 'bloque']);
    assert.ok(Object.isFrozen(ETATS_PLAN));
    assert.ok(ETATS_PLAN.length > 0);
    for (const nom of ETATS_PLAN) {
      assert.equal(cleEtat(nom), `evenement.etat.${nom}`);
      assert.notEqual(t(cleEtat(nom)).trim(), '');
    }
    assert.equal(new Set(ETATS_PLAN.map((nom) => t(cleEtat(nom)))).size, 4);
  });

  test('un état inconnu lève RangeError', () => {
    assert.throws(() => cleEtat('archive'), RangeError);
    assert.throws(() => cleEtat('toString'), RangeError);
  });
});

describe('repriseOfferte (§ 8.8)', () => {
  const lointain = { seance: 'lointaine-1', depuis: '2031-05-17T09:00:00-04:00', vivant: null };

  test('en lecture, un verrou refusé dont la vie ne se prouve pas : le verrou, à reprendre', () => {
    assert.deepEqual(repriseOfferte(etat({ verrouAutre: lointain })), lointain);
    const illisible = { seance: null, depuis: null, vivant: null };
    assert.deepEqual(repriseOfferte(etat({ verrouAutre: illisible })), illisible);
  });

  test('ni sans verrou refusé, ni en écriture, ni sans événement, ni pour un verrou vivant ou mort', () => {
    assert.equal(repriseOfferte(etat()), null);
    assert.equal(repriseOfferte(etat({ mode: 'ecriture', verrouAutre: lointain })), null);
    assert.equal(repriseOfferte(etat({ plan: null, verrouAutre: lointain })), null);
    assert.equal(repriseOfferte(etat({ verrouAutre: { ...lointain, vivant: true } })), null);
    assert.equal(repriseOfferte(etat({ verrouAutre: { ...lointain, vivant: false } })), null);
  });
});

describe('avertissementsOrdonnes (§ 8.6, § 8.8, § 8.9, § 9)', () => {
  // Un avertissement de chaque code du contrat, dans l'ordre où la séance
  // les rend, avec des détails de forme quelconque : la fonction n'en lit
  // aucun, hors de ceux qu'elle complète.
  const CODES = [
    'RETENU_FAUTIF',
    'JOURNAL_REPRIS',
    'JOURNAL_EN_AVANCE_DE',
    'JOURNAL_INCOMPLET',
    'JOURNAL_ECARTEES',
    'JOURNAL_RECREE',
    'JOURNAL_FORMAT_PLUS_RECENT',
    'JOURNAL_ILLISIBLE',
    'JOURNAL_ETRANGER',
    'PROPOSITIONS_FAUTIVES',
    'PROPOSITIONS_MANQUANTES',
    'DERIVE',
    'INVARIANT_VIOLE',
    'VERROU_REPRIS',
    'EVENEMENT_CHANGE',
    'VERROU_NON_RENDU',
    'JALON_NON_ECRIT',
    'SUPPORT_AMOVIBLE',
    'RESERVATIONS_SUSPENDUES',
    'IMPORT_EN_RETENU',
    'PLACES_MANQUANTES',
    'DERIVE_NOUVELLE',
    'RESERVATION_NON_HONOREE',
    'CONFIGURATION_INCOHERENTE',
    'RETOUR_AUTOMATIQUE',
  ];
  const REMEDES = new Map([
    ['RETENU_FAUTIF', { geste: 'ouvrirSecours', source: 'precedent' }],
    ['DERIVE', { geste: 'ouvrirSection', section: 'propositions' }],
    ['DERIVE_NOUVELLE', { geste: 'ouvrirSection', section: 'propositions' }],
    ['PLACES_MANQUANTES', { geste: 'ouvrirSection', section: 'tables' }],
  ]);
  const avertissement = (code, rang) => ({ code, details: { rang, ids: [], retenu: false } });

  test('[] sans avertissement', () => {
    assert.deepEqual(avertissementsOrdonnes(etat()), []);
    assert.deepEqual(avertissementsOrdonnes(etat({ plan: null })), []);
  });

  test("l'ordre de la séance, codes et détails gardés, chacun avec son remède, null hors des quatre", () => {
    const recus = CODES.map(avertissement);
    const rendus = avertissementsOrdonnes(etat({ avertissements: recus }));
    assert.equal(rendus.length, CODES.length);
    assert.ok(rendus.length > 0);
    rendus.forEach((rendu, rang) => {
      assert.equal(rendu.code, CODES[rang]);
      assert.deepEqual(rendu.details, recus[rang].details);
      assert.deepEqual(rendu.remede, REMEDES.get(rendu.code) ?? null, rendu.code);
    });
  });

  test("l'ordre est celui reçu, jamais un ordre propre : la liste renversée revient renversée", () => {
    const renverses = [...CODES].reverse().map(avertissement);
    assert.deepEqual(
      avertissementsOrdonnes(etat({ avertissements: renverses })).map(({ code }) => code),
      [...CODES].reverse(),
    );
  });

  test('PROPOSITIONS_FAUTIVES porte les fautives de la séance, et lui seul', () => {
    const fautives = [{ rang: 1, id: 4, fautes: [{ code: 'LONGUEUR', chemin: 'tours' }] }];
    const rendus = avertissementsOrdonnes(
      etat({ fautives, avertissements: [{ code: 'PROPOSITIONS_FAUTIVES', details: { ids: [4] } }, avertissement('DERIVE_NOUVELLE', 0)] }),
    );
    assert.deepEqual(rendus[0].fautives, fautives);
    assert.equal(Object.hasOwn(rendus[1], 'fautives'), false);
  });

  test("DERIVE porte ce que l'examen dit de chaque placement nommé : le retenu d'abord, puis chaque proposition de ids", () => {
    const raisonRetenu = { code: 'PARTICIPANT_EXCLU', participant: 2 };
    const raisonCinq = { code: 'TOURS_CHANGES', avant: 3, maintenant: 2 };
    const examen = {
      derives: [
        { id: 5, raisons: [raisonCinq] },
        { id: 9, raisons: [raisonCinq] },
      ],
      retenu: { fautes: [], raisons: [raisonRetenu] },
    };
    const [derive] = avertissementsOrdonnes(
      etat({ examen, avertissements: [{ code: 'DERIVE', details: { ids: [5], retenu: true } }] }),
    );
    assert.deepEqual(derive.derives, [
      { id: 'retenu', raisons: [raisonRetenu] },
      { id: 5, raisons: [raisonCinq] },
    ]);
    const [seule] = avertissementsOrdonnes(etat({ examen, avertissements: [{ code: 'DERIVE', details: { ids: [9], retenu: false } }] }));
    assert.deepEqual(seule.derives, [{ id: 9, raisons: [raisonCinq] }]);
    const [sansExamen] = avertissementsOrdonnes(etat({ avertissements: [{ code: 'DERIVE', details: { ids: [9], retenu: false } }] }));
    assert.deepEqual(sansExamen.derives, []);
  });

  test('chaque remède rendu se traduit : sa clé existe', () => {
    const rendus = avertissementsOrdonnes(etat({ avertissements: CODES.map(avertissement) }));
    const avecRemede = rendus.filter(({ remede }) => remede !== null);
    assert.equal(avecRemede.length, 4);
    for (const { remede } of avecRemede) {
      const cle = remede.geste === 'ouvrirSecours' ? `communs.remede.ouvrirSecours.${remede.source}` : `communs.remede.ouvrirSection.${remede.section}`;
      assert.notEqual(t(cle).trim(), '');
    }
  });
});
