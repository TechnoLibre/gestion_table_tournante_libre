// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des sorties (§ 11.4, § 11.7, § 11.8, § 18.6) : l'horodatage du
// placement qu'une sortie imprime, selon sa source ; la règle du filigrane
// BROUILLON, sur la table complète des états et des sources ; le pied de
// page, ses cinq éléments, la version remplacée par la marque dans une
// construction de documentation, et aucune lecture d'horloge. Les noms
// d'épreuve sont inventés ; la version vient du module engendré. Enfin le
// refus que rend l'issue d'une impression, que l'aperçu affiche.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { TABLES_INTERFACE } from '../interface/libelles.js';
import { creerCharge } from '../stockage/document.js';
import { VERSION } from '../version.genere.js';
import { ErreurCommande } from './erreurs.js';
import { creerHorlogePilotee } from './horloge.js';
import { TABLES_APPLICATION, libelle } from './libelles.js';
import { SOURCES_SORTIE, estBrouillon, horodatagePlacement, piedDePage, refusImpression } from './sorties.js';
import { creerTraduction } from './traduction.js';

const H = '2031-05-17T20:15:00-04:00';
const H2 = '2031-05-17T21:40:00-04:00';
const H3 = '2031-05-17T22:05:00-04:00';
const ETATS = ['brouillon', 'propose', 'retenu', 'bloque'];

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Le placement de deux tables de deux places, sur tours tours.
const placement = (tours) =>
  Array.from({ length: tours }, (_, rang) => ({ sieges: rang % 2 === 0 ? [[1, 2], [3, 4]] : [[1, 3], [2, 4]], reserve: [] }));

// Une proposition d'identifiant id sur tours tours, datée quand horodatage
// est donné.
function proposition(id, tours, horodatage) {
  const p = {
    id,
    graine: id,
    arret: 40,
    historique: 500,
    produitVersion: VERSION.affichee,
    siegesAttribues: false,
    tables: [1, 2],
    capacites: [2, 2],
    tours,
    participants: [1, 2, 3, 4],
    placement: placement(tours),
  };
  return horodatage === undefined ? p : { ...p, horodatage };
}

// Une soirée de R tours, deux propositions — la première datée H, la
// seconde sans date —, et la première retenue, retouchée à H3, à l'état
// donné ; retenu faux : sans retenu.
function soiree({ etat = 'retenu', R = 2, toursRetenus = R, retenu = true } = {}) {
  const charge = creerCharge({ id: 'evt-grives', nom: 'Veillée des Grives', date: '2031-05-17', siegesParDefaut: 2, tours: R });
  charge.evenement.etat = etat;
  charge.prochainsIds.proposition = 3;
  charge.propositions = [proposition(1, R, H), proposition(2, R)];
  if (retenu) {
    const { id, graine, arret, historique, produitVersion, ...plan } = proposition(1, toursRetenus);
    charge.retenu = { proposition: id, ...plan, horodatage: H3 };
  }
  return charge;
}

describe('horodatagePlacement : la date du placement que la sortie imprime (§ 11.4, § 11.8, Q2)', () => {
  test("le retenu rend le sien, une proposition le sien, même montrée après la retenue ; les réservations n'en ont pas", () => {
    const charge = soiree();
    assert.equal(horodatagePlacement(charge, { source: 'retenu' }), H3);
    assert.equal(horodatagePlacement(charge, { source: 'proposition', proposition: 1 }), H);
    assert.equal(horodatagePlacement(charge, { source: 'proposition', proposition: 2 }), null);
    assert.equal(horodatagePlacement(charge, { source: 'reservations' }), null);
  });

  test('sans le champ — un fichier ancien —, ou sans retenu : null, horodatage inconnu', () => {
    const ancienne = soiree();
    delete ancienne.retenu.horodatage;
    assert.equal(horodatagePlacement(ancienne, { source: 'retenu' }), null);
    assert.equal(horodatagePlacement(soiree({ retenu: false }), { source: 'retenu' }), null);
  });

  test('un identifiant absent lève PROPOSITION_INCONNUE ; une source inconnue ou un identifiant qui n’est pas un entier, TypeError', () => {
    assert.throws(
      () => horodatagePlacement(soiree(), { source: 'proposition', proposition: 9 }),
      (erreur) => erreur instanceof ErreurCommande && erreur.code === 'PROPOSITION_INCONNUE' && erreur.details.id === 9,
    );
    for (const source of ['brouillon', 'Retenu', undefined, null]) {
      assert.throws(() => horodatagePlacement(soiree(), { source }), TypeError, String(source));
    }
    for (const id of [null, '1', 1.5]) {
      assert.throws(() => horodatagePlacement(soiree(), { source: 'proposition', proposition: id }), TypeError, String(id));
    }
  });
});

describe('estBrouillon : le filigrane BROUILLON (§ 11.4, § 11.7, Q5)', () => {
  test('la table complète état × source au tour 1 : faux seulement pour le retenu, sur un plan retenu ou bloqué', () => {
    assert.deepEqual(SOURCES_SORTIE, ['retenu', 'proposition', 'reservations']);
    const definitifs = [];
    let cases = 0;
    for (const etat of ETATS) {
      for (const source of SOURCES_SORTIE) {
        cases += 1;
        const brouillon = estBrouillon(soiree({ etat }), { source, tour: 1 });
        assert.equal(typeof brouillon, 'boolean');
        if (!brouillon) definitifs.push(`${etat}/${source}`);
      }
    }
    assert.equal(cases, 12);
    assert.deepEqual(definitifs, ['retenu/retenu', 'bloque/retenu']);
  });

  test("un tour que le retenu ne porte pas, 'tous' sur un retenu plus court que la soirée, un plan bloqué sans retenu : BROUILLON", () => {
    const court = soiree({ R: 4, toursRetenus: 3 });
    const cas = [
      ['retenu à 3 tours, R = 4, tour 4', court, 4, true],
      ['retenu à 3 tours, R = 4, tour 3', court, 3, false],
      ["retenu à 3 tours, R = 4, 'tous'", court, 'tous', true],
      ["retenu à 4 tours, R = 4, 'tous'", soiree({ R: 4 }), 'tous', false],
      ['bloqué sans retenu', soiree({ etat: 'bloque', retenu: false }), 1, true],
      ['bloqué sans retenu, tous', soiree({ etat: 'bloque', retenu: false }), 'tous', true],
    ];
    const brouillons = cas.filter(([libelle, charge, tour, attendu]) => {
      assert.equal(estBrouillon(charge, { source: 'retenu', tour }), attendu, libelle);
      return attendu;
    });
    assert.ok(brouillons.length > 0);
  });

  test('une proposition imprimée est toujours BROUILLON, tour par tour comme pour la soirée (Q3)', () => {
    for (const etat of ETATS) {
      for (const tour of [1, 2, 'tous']) assert.equal(estBrouillon(soiree({ etat }), { source: 'proposition', tour }), true, `${etat} ${tour}`);
    }
  });

  test("un tour qui n'est ni un entier ≥ 1 ni 'tous', une source inconnue : TypeError", () => {
    for (const tour of [0, -1, 1.5, 'toutes', null, undefined, '1']) {
      assert.throws(() => estBrouillon(soiree(), { source: 'retenu', tour }), TypeError, String(tour));
    }
    assert.throws(() => estBrouillon(soiree(), { source: 'plan', tour: 1 }), TypeError);
  });
});

describe('piedDePage : les cinq éléments de toute page imprimée (§ 11.7, § 18.6)', () => {
  test("nom, date, tour, horodatage du placement et version, et rien d'autre", () => {
    const charge = soiree();
    const pied = piedDePage(charge, { source: 'retenu', tour: 2, provenance: 'livraison', version: VERSION.affichee, texte: t });
    assert.deepEqual(Object.keys(pied).sort(), ['date', 'horodatage', 'nom', 'tour', 'version']);
    assert.deepEqual(pied, { nom: 'Veillée des Grives', date: '2031-05-17', tour: 2, horodatage: H3, version: VERSION.affichee });
    const soireeEntiere = piedDePage(charge, { source: 'proposition', proposition: 2, tour: 'tous', provenance: 'test', version: VERSION.affichee, texte: libelle });
    assert.deepEqual(soireeEntiere, { nom: 'Veillée des Grives', date: '2031-05-17', tour: 'tous', horodatage: null, version: VERSION.affichee });
    const sansDate = soiree();
    sansDate.evenement.date = null;
    assert.equal(piedDePage(sansDate, { source: 'reservations', tour: 1, provenance: 'test', version: VERSION.affichee, texte: t }).date, null);
  });

  test("dans une construction de documentation, la version cède la place à la marque, par t comme par libelle", () => {
    for (const texte of [t, libelle]) {
      const { version } = piedDePage(soiree(), { source: 'retenu', tour: 1, provenance: 'documentation', version: VERSION.affichee, texte });
      assert.equal(version, libelle('sorties.version.documentation'));
      assert.ok(!version.includes(VERSION.affichee), version);
    }
  });

  test("deux appels sous une horloge avancée rendent les mêmes valeurs : le pied ne lit aucune horloge", () => {
    const horloge = creerHorlogePilotee({ depart: H });
    const charge = soiree();
    charge.retenu.horodatage = horloge.horodatage();
    const args = { source: 'retenu', tour: 1, provenance: 'livraison', version: VERSION.affichee, texte: t };
    const avant = piedDePage(charge, args);
    horloge.avancer(3_600_000);
    const { Date: DateReelle } = globalThis;
    const maintenant = performance.now;
    const piege = () => {
      throw new Error('horloge lue');
    };
    let apres;
    try {
      globalThis.Date = new Proxy(DateReelle, { construct: piege, apply: piege, get: (cible, cle) => (cle === 'now' ? piege : cible[cle]) });
      performance.now = piege;
      apres = piedDePage(charge, args);
    } finally {
      globalThis.Date = DateReelle;
      performance.now = maintenant;
    }
    assert.deepEqual(apres, avant);
    assert.equal(apres.horodatage, H);
  });

  test("un tour hors de son domaine, une source inconnue : TypeError ; un identifiant absent : PROPOSITION_INCONNUE", () => {
    const base = { provenance: 'test', version: VERSION.affichee, texte: t };
    assert.throws(() => piedDePage(soiree(), { ...base, source: 'retenu', tour: 0 }), TypeError);
    assert.throws(() => piedDePage(soiree(), { ...base, source: 'inventee', tour: 1 }), TypeError);
    assert.throws(() => piedDePage(soiree(), { ...base, source: 'proposition', proposition: 7, tour: 1 }), ErreurCommande);
  });
});

describe("refusImpression : le refus que rend l'issue d'une impression (§ 11.7, § 13.4)", () => {
  test('une impression envoyée, annulée par l’opérateur ou d’issue inconnue ne rend aucun refus', () => {
    for (const issue of ['envoye', 'annule', 'inconnue']) assert.equal(refusImpression({ issue, cause: null }), null, issue);
  });

  test('un échec rend IMPRESSION_ECHEC, sa cause et aucun remède ; le texte nomme la cause, ou s’en passe', () => {
    const avecCause = refusImpression({ issue: 'echec', cause: 'Imprimante hors ligne' });
    assert.ok(avecCause instanceof ErreurCommande);
    assert.equal(avecCause.code, 'IMPRESSION_ECHEC');
    assert.deepEqual(avecCause.details, { cause: 'Imprimante hors ligne', remede: null });
    assert.match(libelle(avecCause.code, avecCause.details), /\(Imprimante hors ligne\)/);
    const sansCause = refusImpression({ issue: 'echec', cause: null });
    assert.deepEqual(sansCause.details, { cause: null, remede: null });
    assert.doesNotMatch(libelle(sansCause.code, sansCause.details), /\(|null|undefined/);
  });

  test('une issue hors du contrat de l’imprimante lève TypeError', () => {
    for (const issue of [
      { issue: 'imprime', cause: null },
      { issue: 'echec', cause: 3 },
      { issue: 'echec' },
      { issue: 'annule', cause: 'cancelled' },
      null,
      undefined,
    ]) {
      assert.throws(() => refusImpression(issue), TypeError, JSON.stringify(issue));
    }
  });
});
