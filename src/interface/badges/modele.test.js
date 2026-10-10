// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle de la section des badges (§ 11.2, § 11.5, § 11.6, § 11.8, Q3),
// sans DOM : les sources offertes et celle qui vaut, les réglages d'une
// demande, les phrases de l'annonce, ce qui bloque « Produire », les
// personnes d'une réédition. Chaque clé que le modèle désigne existe, en
// français comme en langue témoin, et se compose sans lever. Une annonce se
// prend telle que la séance la rend (planche_seance.js), sur de petites
// soirées construites ; aucune production de PDF.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { personne, soiree, table } from '../../../test/fixtures/badges/cas.js';
import { lirePolices } from '../../../test/polices.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerPlanches } from '../../application/planche_seance.js';
import { MARQUE_TEMOIN, creerTraduction } from '../../application/traduction.js';
import { PAPIERS } from '../../geometrie/papiers.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import {
  IMPOSITIONS_OFFERTES,
  ORDRES_OFFERTS,
  cleImposition,
  cleOrdre,
  cleSource,
  filtrerPersonnes,
  libelleSource,
  memesReglages,
  personnesReeditables,
  phrasesAnnonce,
  produireBloque,
  selectionRetenue,
  sourceChoisie,
  sourcesOffertes,
} from './modele.js';

const TABLES = [...TABLES_APPLICATION, ...TABLES_INTERFACE];
const { t } = creerTraduction(TABLES);
const { t: tTemoin } = creerTraduction(TABLES, { langue: 'temoin' });

// Chaque phrase se compose, en français et en langue témoin, entière dans sa
// marque ; rend les textes français.
function composer(phrases) {
  assert.ok(phrases.length > 0, 'aucune phrase');
  return phrases.map(({ cle, details }) => {
    const francais = t(cle, details);
    assert.equal(typeof francais, 'string', cle);
    assert.notEqual(francais.trim(), '', cle);
    assert.equal(tTemoin(cle, details), `${MARQUE_TEMOIN.ouverture}${francais}${MARQUE_TEMOIN.fermeture}`, cle);
    return francais;
  });
}

const cles = (phrases) => phrases.map(({ cle }) => cle);

// Deux tables de quatre, deux tours : quatre personnes, dont une sans
// prénom ; la personne 5 est exclue.
const PERSONNES = () => [
  personne(1, 'Iris', 'Ombrelle', { appartenance: 'Club des Merles' }),
  personne(2, 'Théo', 'Pervenche'),
  personne(3, 'Ondine', 'Lacasse'),
  personne(4, null, 'Grisaille'),
  personne(5, 'Iris', 'Pervenche', { exclu: true }),
];
const TABLES_SOIREE = () => [table(1, 1, 4), table(2, 2, 4)];
const PLAN = [{ sieges: [[1, 2], [3, 4]] }, { sieges: [[1, 3], [2, 4]] }];

// La soirée retenue, datée, sur un plan retenu, et une proposition 2.
const retenue = (champs = {}) =>
  soiree({ personnes: PERSONNES(), tables: TABLES_SOIREE(), plan: PLAN, propositions: [[2, PLAN]], ...champs });

// Les opérations de la planche d'une séance, sur la police embarquée lue
// du disque, la provenance d'épreuve et la version engendrée.
const planches = creerPlanches({ polices: async () => lirePolices(), provenance: 'test', version: VERSION.affichee });
const fsInutile = Object.freeze({ nature: 'epreuve' });

// L'annonce que la séance rendrait sur cette charge, ce papier et cette
// demande : la lecture que la séance passe, sans système de fichiers lu.
const annoncer = (charge, papier, demande = {}) =>
  planches.preparer({ charge, base: 'lucioles', fs: fsInutile, racine: { id: 'documents', chemin: '/d' }, papier }, demande);

describe('les sources offertes (Q3)', () => {
  test('le retenu d’abord, puis la proposition demandée au plan quand elle existe ; rien sans l’un ni l’autre', () => {
    const charge = retenue();
    assert.deepEqual(sourcesOffertes(charge, null), [{ source: 'retenu', proposition: null }]);
    assert.deepEqual(sourcesOffertes(charge, 2), [
      { source: 'retenu', proposition: null },
      { source: 'proposition', proposition: 2 },
    ]);
    // Une proposition demandée que la charge ne porte plus n'est pas offerte.
    assert.deepEqual(sourcesOffertes(charge, 9), [{ source: 'retenu', proposition: null }]);
    const sansRetenu = soiree({ personnes: PERSONNES(), tables: TABLES_SOIREE(), etat: 'propose', propositions: [[2, PLAN]] });
    assert.deepEqual(sourcesOffertes(sansRetenu, 2), [{ source: 'proposition', proposition: 2 }]);
    assert.deepEqual(sourcesOffertes(sansRetenu, null), []);
  });

  test('la source qui vaut : celle de la clé choisie quand elle est offerte, sinon la première, sinon le retenu', () => {
    const offertes = [
      { source: 'retenu', proposition: null },
      { source: 'proposition', proposition: 2 },
    ];
    assert.equal(cleSource(offertes[0]), 'retenu');
    assert.equal(cleSource(offertes[1]), 'proposition:2');
    assert.deepEqual(sourceChoisie(offertes, null), offertes[0]);
    assert.deepEqual(sourceChoisie(offertes, 'proposition:2'), offertes[1]);
    assert.deepEqual(sourceChoisie(offertes, 'proposition:7'), offertes[0]);
    assert.deepEqual(sourceChoisie([offertes[1]], 'retenu'), offertes[1]);
    assert.deepEqual(sourceChoisie([], 'proposition:2'), { source: 'retenu', proposition: null });
  });

  test('chaque source, imposition et ordre a son libellé ; une valeur inconnue lève', () => {
    assert.deepEqual([...IMPOSITIONS_OFFERTES], ['feuille', 'pile']);
    assert.deepEqual([...ORDRES_OFFERTS], ['alphabetique', 'table']);
    composer([
      libelleSource({ source: 'retenu', proposition: null }),
      libelleSource({ source: 'proposition', proposition: 2 }),
      ...IMPOSITIONS_OFFERTES.map((imposition) => ({ cle: cleImposition(imposition), details: {} })),
      ...ORDRES_OFFERTS.map((ordre) => ({ cle: cleOrdre(ordre), details: {} })),
    ]);
    assert.match(t(libelleSource({ source: 'proposition', proposition: 2 }).cle, { id: 2 }), /2/);
    assert.throws(() => cleImposition('rame'), RangeError);
    assert.throws(() => cleOrdre('hasard'), RangeError);
    assert.throws(() => libelleSource({ source: 'reservations', proposition: null }), RangeError);
  });

  test('deux demandes ont les mêmes réglages quand source, proposition, imposition et ordre concordent, sélection à part', () => {
    const base = { source: 'retenu', proposition: null, imposition: 'feuille', ordre: 'alphabetique', selection: null };
    assert.equal(memesReglages(base, { ...base, selection: [1, 2] }), true);
    for (const [cle, valeur] of [
      ['source', 'proposition'],
      ['proposition', 2],
      ['imposition', 'pile'],
      ['ordre', 'table'],
    ]) {
      assert.equal(memesReglages(base, { ...base, [cle]: valeur }), false, cle);
    }
  });
});

describe('les phrases de l’annonce (§ 11.2, § 11.5, § 11.8)', () => {
  test('un retenu, papier choisi : la source, les comptes, les planches des deux papiers, le fichier ; ni brouillon ni refus', async () => {
    const charge = retenue();
    const annonce = await annoncer(charge, 'A4');
    assert.equal(annonce.refus, null);
    const phrases = phrasesAnnonce(annonce, { source: 'retenu', proposition: null, selection: null });
    assert.deepEqual(cles(phrases), [
      'badges.annonce.source.retenu',
      'badges.annonce.comptes',
      'badges.annonce.planches',
      'badges.annonce.fichier',
    ]);
    const [source, comptes, planchesLues, fichier] = composer(phrases);
    assert.match(source, /retenu/);
    assert.equal(comptes, '4 badges pour 5 participants, 1 exclu.');
    assert.deepEqual(phrases[2].details.parPapier, Object.keys(PAPIERS).map((papier) => ({
      papier,
      nom: `impression.papier.nom.${papier.toLowerCase()}`,
      planches: annonce.planches[papier],
      choisi: papier === 'A4',
    })));
    assert.equal(planchesLues, 'Planches : 1 planche en A4 (papier choisi) et 2 planches en Lettre.');
    assert.ok(fichier.endsWith(annonce.nom), fichier);
    assert.equal(produireBloque(annonce), false);
  });

  test('un brouillon : un plan proposé qui garde son retenu, puis une proposition, toujours BROUILLON, que l’annonce nomme', async () => {
    const proposee = retenue({ etat: 'propose' });
    const surRetenu = phrasesAnnonce(await annoncer(proposee, 'A4'), { source: 'retenu', proposition: null, selection: null });
    assert.ok(cles(surRetenu).includes('badges.annonce.brouillon.retenu'));
    composer(surRetenu);

    const demande = { source: 'proposition', proposition: 2, selection: null };
    const annonce = await annoncer(retenue(), 'A4', demande);
    assert.equal(annonce.brouillon, true);
    const phrases = phrasesAnnonce(annonce, demande);
    assert.deepEqual(cles(phrases), [
      'badges.annonce.source.proposition',
      'badges.annonce.comptes',
      'badges.annonce.planches',
      'badges.annonce.brouillon.proposition',
      'badges.annonce.fichier',
    ]);
    const textes = composer(phrases);
    assert.match(textes[0], /n° 2/);
    assert.match(textes[3], /BROUILLON/);
  });

  test('une dérive : le refus nomme ce qui a changé ; ni comptes, ni planches, ni fichier ; « Produire » bloqué', async () => {
    const charge = retenue();
    charge.participants.push(personne(6, 'Ondine', 'Pervenche'));
    charge.prochainsIds.participant = 7;
    const annonce = await annoncer(charge, 'A4');
    assert.equal(annonce.refus.code, 'PLANCHE_DERIVE');
    assert.ok(annonce.refus.details.raisons.length > 0);
    assert.deepEqual(annonce.refus.details.remede, { geste: 'ouvrirSection', section: 'propositions' });
    const phrases = phrasesAnnonce(annonce, { source: 'retenu', proposition: null, selection: null });
    assert.deepEqual(cles(phrases), ['badges.annonce.source.retenu']);
    composer(phrases);
    assert.match(t(annonce.refus.code, annonce.refus.details), /Ondine Pervenche/);
    assert.equal(produireBloque(annonce), true);
  });

  test('sans placement, ou sous tout refus du placement ou de la mise en page, « Produire » est bloqué ; sans papier, non', () => {
    const vide = { papier: null, comptes: null, planches: null, homonymes: [], absents: [], brouillon: true, nom: null };
    assert.equal(produireBloque(null), false);
    assert.equal(produireBloque({ ...vide, refus: null }), false);
    assert.equal(produireBloque({ ...vide, refus: { code: 'PAPIER_REQUIS', details: {} } }), false);
    for (const code of ['PLANCHE_SANS_PLACEMENT', 'RETENU_FAUTIF', 'PLANCHE_DERIVE', 'PLANCHE_TROP_DE_TOURS', 'PLANCHE_NOM_TROP_LONG']) {
      assert.equal(produireBloque({ ...vide, refus: { code, details: {} } }), true, code);
    }
  });

  test('un papier absent : PAPIER_REQUIS, remède « Choisir le papier », les planches des deux papiers sans papier choisi, aucun fichier', async () => {
    const annonce = await annoncer(retenue(), null);
    assert.equal(annonce.refus.code, 'PAPIER_REQUIS');
    assert.deepEqual(annonce.refus.details.remede, { geste: 'choisirPapier' });
    const phrases = phrasesAnnonce(annonce, { source: 'retenu', proposition: null, selection: null });
    assert.deepEqual(cles(phrases), ['badges.annonce.source.retenu', 'badges.annonce.comptes', 'badges.annonce.planches']);
    assert.ok(phrases[2].details.parPapier.every(({ choisi }) => choisi === false));
    assert.equal(composer(phrases)[2], 'Planches : 1 planche en A4 et 2 planches en Lettre.');
  });

  test('des homonymes : chaque groupe nommé, avec les identifiants que le badge imprime', async () => {
    const charge = retenue();
    charge.participants[2] = personne(3, 'Iris', 'Ombrelle', { appartenance: 'Club des Merles' });
    const annonce = await annoncer(charge, 'A4');
    assert.deepEqual(annonce.homonymes, [{ nom: 'Iris Ombrelle', ids: [1, 3] }]);
    const phrases = phrasesAnnonce(annonce, { source: 'retenu', proposition: null, selection: null });
    const rang = cles(phrases).indexOf('badges.annonce.homonymes');
    assert.ok(rang > 0);
    assert.deepEqual(phrases[rang].details, { nom: 'Iris Ombrelle', ids: [1, 3] });
    assert.equal(composer(phrases)[rang], 'Iris Ombrelle : 2 badges que seul leur identifiant imprimé sépare, n° 1 et n° 3.');
  });

  test('des glyphes absents : chaque caractère nommé avec son point de code, dans l’ordre de l’annonce', async () => {
    const charge = retenue();
    charge.participants[1] = personne(2, 'Théo', 'Pervenche 李');
    charge.participants[3] = personne(4, null, 'Grisaille \u{1F600}');
    const annonce = await annoncer(charge, 'A4');
    // Grisaille vient avant Théo Pervenche dans la pile : son caractère est
    // rencontré le premier.
    assert.deepEqual(annonce.absents, ['\u{1F600}', '李']);
    const phrases = phrasesAnnonce(annonce, { source: 'retenu', proposition: null, selection: null });
    const rang = cles(phrases).indexOf('badges.annonce.absents');
    assert.ok(rang > 0);
    assert.deepEqual(phrases[rang].details.caracteres, [
      { caractere: '\u{1F600}', point: 'U+1F600' },
      { caractere: '李', point: 'U+674E' },
    ]);
    assert.match(composer(phrases)[rang], /U\+1F600.*U\+674E/);
  });

  test('une réédition : son compte à la place de ceux de la soirée', async () => {
    const demande = { source: 'retenu', proposition: null, selection: [4, 2, 3] };
    const annonce = await annoncer(retenue(), 'A4', demande);
    const phrases = phrasesAnnonce(annonce, demande);
    assert.deepEqual(cles(phrases).slice(0, 2), ['badges.annonce.source.retenu', 'badges.annonce.reedition']);
    assert.deepEqual(phrases[1].details, { n: 3 });
    assert.match(composer(phrases)[1], /3 badges/);
    assert.match(annonce.nom, /\.badges-3_/);
  });

  test('sans demande, l’annonce se lit sur le retenu, sans sélection ; l’annonce reçue ne change pas', async () => {
    const annonce = await annoncer(retenue(), 'A4');
    const copie = structuredClone(annonce);
    assert.deepEqual(phrasesAnnonce(annonce), phrasesAnnonce(annonce, { source: 'retenu', proposition: null, selection: null }));
    assert.deepEqual(annonce, copie);
  });
});

describe('la réédition (§ 11.8)', () => {
  test('les personnes non exclues, par ordre alphabétique de leur nom affiché, accents et casse ignorés', () => {
    const charge = retenue();
    charge.participants.push(personne(6, 'éloi', 'Abeille'));
    assert.deepEqual(personnesReeditables(charge), [
      { id: 6, nom: 'éloi Abeille', appartenance: null },
      { id: 4, nom: 'Grisaille', appartenance: null },
      { id: 1, nom: 'Iris Ombrelle', appartenance: 'Club des Merles' },
      { id: 3, nom: 'Ondine Lacasse', appartenance: null },
      { id: 2, nom: 'Théo Pervenche', appartenance: null },
    ]);
  });

  test('le filtre retient les noms ou appartenances qui contiennent la saisie normalisée ; une saisie vide retient tout', () => {
    const personnes = personnesReeditables(retenue());
    assert.deepEqual(filtrerPersonnes(personnes, ''), personnes);
    assert.deepEqual(filtrerPersonnes(personnes, '   '), personnes);
    assert.deepEqual(filtrerPersonnes(personnes, 'THEO').map(({ id }) => id), [2]);
    assert.deepEqual(filtrerPersonnes(personnes, 'merles').map(({ id }) => id), [1]);
    assert.deepEqual(filtrerPersonnes(personnes, 'zz'), []);
  });

  test('la sélection retenue : les cochées encore rééditables, dans l’ordre de la liste, null quand aucune', () => {
    const personnes = personnesReeditables(retenue());
    assert.deepEqual(selectionRetenue([2, 5, 1], personnes), [1, 2]);
    assert.equal(selectionRetenue([5], personnes), null);
    assert.equal(selectionRetenue([], personnes), null);
  });
});
