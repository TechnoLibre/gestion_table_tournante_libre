// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle de l'événement ouvert (§ 8.4, § 8.5, § 8.8, § 8.9, § 9) : la
// commande de la place fixe, les états du plan et
// leurs clés, la reprise de verrou offerte, et les avertissements ordonnés,
// chacun avec son remède ; puis l'enveloppe : le résumé chiffré de
// l'en-tête et ses textes, les étapes des états, la bande de mode. Chaque
// épreuve part d'un EtatSeance réduit à ce que la fonction lit ; les noms et
// identifiants sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { cleDeMode } from '../mode.js';
import {
  ETATS_PLAN,
  avertissementsOrdonnes,
  bandeDeMode,
  cleEtat,
  commandeFixe,
  etapesEtat,
  repriseOfferte,
  resumeEvenement,
} from './modele.js';

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
    'RESERVATIONS_RETABLIES',
    'RESERVATIONS_RETIREES',
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

  test('un avertissement qui porte son remède en details.remede le garde : LISTE_SUR_VOISINE déplace la voisine (§ 7.1)', () => {
    const remede = { commande: 'deplacerTable', arguments: { id: 2, position: { x: 1626, y: 0 } } };
    const details = { table: 1, voisine: 2, numero: 1, numeroVoisine: 2, remede };
    const [rendu] = avertissementsOrdonnes(etat({ avertissements: [{ code: 'LISTE_SUR_VOISINE', details }] }));
    assert.deepEqual(rendu, { code: 'LISTE_SUR_VOISINE', details, remede });
    // Un remède null ou absent laisse celui de REMEDES, ou aucun.
    const [derive, verrou] = avertissementsOrdonnes(
      etat({
        avertissements: [
          { code: 'DERIVE', details: { ids: [], retenu: false, remede: null } },
          { code: 'VERROU_REPRIS', details: { seance: 'b', depuis: null } },
        ],
      }),
    );
    assert.deepEqual(derive.remede, REMEDES.get('DERIVE'));
    assert.equal(verrou.remede, null);
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

// Une charge réduite à ce que lit le résumé : l'événement, ses
// participants et ses tables.
function charge({ date = null, tours = 3, defaut = 8, participants = 0, exclus = 0, sieges = [] } = {}) {
  const personnes = Array.from({ length: participants }, (_, rang) => ({ id: rang + 1, nom: `Quillard ${rang + 1}`, exclu: rang < exclus }));
  return {
    evenement: { id: 'evt-merles', nom: 'Club des Merles', date, siegesParDefaut: defaut, tours, etat: 'brouillon' },
    participants: personnes,
    tables: sieges.map((nombre, rang) => ({ id: rang + 1, numero: rang + 1, sieges: nombre })),
  };
}

describe('resumeEvenement : la ligne de méta de l’en-tête', () => {
  test('null sans charge', () => {
    assert.equal(resumeEvenement({ ...etat(), charge: null }), null);
    assert.equal(resumeEvenement({ ...etat({ plan: null }), charge: null }), null);
  });

  test('la date de l’événement, ses participants exclus compris, ses tables, leurs sièges — le défaut ou la surcharge —, ses tours', () => {
    const lu = resumeEvenement({ ...etat(), charge: charge({ date: '2031-05-17', tours: 4, defaut: 8, participants: 13, exclus: 2, sieges: [null, 6, null] }) });
    assert.deepEqual(lu, { date: '2031-05-17', participants: 13, tables: 3, sieges: 22, tours: 4 });
  });

  test('sans date, la date est null ; sans table, zéro table et zéro siège', () => {
    const lu = resumeEvenement({ ...etat(), charge: charge({ tours: 1 }) });
    assert.deepEqual(lu, { date: null, participants: 0, tables: 0, sieges: 0, tours: 1 });
  });
});

describe('les textes du résumé', () => {
  test('le singulier jusqu’à un, le pluriel au-delà, les milliers groupés d’une espace fine', () => {
    assert.equal(t('evenement.resume.participants', { participants: 0 }), '0 participant');
    assert.equal(t('evenement.resume.participants', { participants: 1 }), '1 participant');
    assert.equal(t('evenement.resume.participants', { participants: 13 }), '13 participants');
    assert.equal(t('evenement.resume.participants', { participants: 1200 }), '1\u{202F}200 participants');
    assert.equal(t('evenement.resume.tables', { tables: 1, sieges: 1 }), '1 table \u{00B7} 1 siège');
    assert.equal(t('evenement.resume.tables', { tables: 2, sieges: 18 }), '2 tables \u{00B7} 18 sièges');
    assert.equal(t('evenement.resume.tours', { tours: 1 }), '1 tour');
    assert.equal(t('evenement.resume.tours', { tours: 3 }), '3 tours');
  });
});

describe('etapesEtat : la suite des états du plan', () => {
  test('les quatre états dans l’ordre du § 9, chacun sa clé, l’icône de sa pastille, un seul courant', () => {
    const etapes = etapesEtat(etat({ plan: 'retenu' }));
    assert.deepEqual(etapes, [
      { etat: 'brouillon', cle: 'evenement.etat.brouillon', icone: 'crayon', courant: false },
      { etat: 'propose', cle: 'evenement.etat.propose', icone: 'listePoints', courant: false },
      { etat: 'retenu', cle: 'evenement.etat.retenu', icone: 'coche', courant: true },
      { etat: 'bloque', cle: 'evenement.etat.bloque', icone: 'cadenas', courant: false },
    ]);
  });

  test('chaque état du plan est courant à son tour ; sans événement, aucun', () => {
    for (const plan of ETATS_PLAN) {
      const courants = etapesEtat(etat({ plan })).filter(({ courant }) => courant);
      assert.deepEqual(courants.map(({ etat: e }) => e), [plan]);
    }
    assert.deepEqual(etapesEtat(etat({ plan: null })).filter(({ courant }) => courant), []);
    assert.equal(etapesEtat(etat({ plan: null })).length, 4);
  });
});

describe('bandeDeMode : la bande sous le bandeau', () => {
  test('null sans événement', () => {
    assert.equal(bandeDeMode(etat({ plan: null })), null);
  });

  test('lecture, écriture, plan bloqué — quel que soit le mode : le libellé de mode, une explication, une icône', () => {
    assert.deepEqual(bandeDeMode(etat({ mode: 'lecture' })), {
      mode: 'lecture',
      cle: 'coquille.mode.lecture',
      explication: 'evenement.bande.lecture',
      icone: 'oeil',
    });
    assert.deepEqual(bandeDeMode(etat({ mode: 'ecriture' })), {
      mode: 'ecriture',
      cle: 'coquille.mode.ecriture',
      explication: 'evenement.bande.ecriture',
      icone: 'stylo',
    });
    for (const mode of ['lecture', 'ecriture']) {
      assert.deepEqual(bandeDeMode(etat({ mode, plan: 'bloque' })), {
        mode: 'bloque',
        cle: 'coquille.mode.bloque',
        explication: 'evenement.bande.bloque',
        icone: 'cadenas',
      });
    }
  });

  test('le libellé est celui du bandeau ; trois libellés et trois explications traduits, distincts ; chaque explication cite la commande qui en sort', () => {
    const etats = [etat(), etat({ mode: 'ecriture' }), etat({ plan: 'bloque' })];
    for (const e of etats) assert.equal(bandeDeMode(e).cle, cleDeMode(e));
    assert.equal(new Set(etats.map((e) => t(bandeDeMode(e).cle))).size, 3);
    const explications = etats.map((e) => t(bandeDeMode(e).explication));
    for (const texte of explications) assert.notEqual(texte.trim(), '');
    assert.equal(new Set(explications).size, 3);
    const commandes = ['communs.commande.modifier', 'communs.commande.lecture', 'communs.commande.debloquer'];
    explications.forEach((texte, rang) => assert.ok(texte.includes(`« ${t(commandes[rang])} »`), texte));
  });

  test('un format plus récent, plan bloqué ou non : son mode, et une explication qui ne cite aucune commande', () => {
    const attendus = [
      [etat({ refus: FORMAT_REFUS }), { mode: 'lecture', cle: 'coquille.mode.lecture', icone: 'oeil' }],
      [etat({ plan: 'bloque', refus: FORMAT_REFUS }), { mode: 'bloque', cle: 'coquille.mode.bloque', icone: 'cadenas' }],
    ];
    const commandes = ['communs.commande.modifier', 'communs.commande.debloquer', 'evenement.commande.defaire', 'communs.commande.lecture'];
    for (const [e, attendu] of attendus) {
      assert.equal(commandeFixe(e), 'format');
      assert.deepEqual(bandeDeMode(e), { ...attendu, explication: 'evenement.bande.lectureSeule' });
      const texte = t(bandeDeMode(e).explication);
      assert.notEqual(texte.trim(), '');
      for (const cle of commandes) assert.ok(!texte.includes(t(cle)), `${texte} cite ${t(cle)}`);
    }
  });
});
