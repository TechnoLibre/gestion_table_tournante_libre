// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

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
import { lireLogo } from '../../../test/logo.js';
import { lirePolices } from '../../../test/polices.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerPlanches } from '../../application/planche_seance.js';
import { MARQUE_TEMOIN, creerTraduction } from '../../application/traduction.js';
import { PAPIERS } from '../../geometrie/papiers.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import {
  IMPOSITIONS_OFFERTES,
  MODELES_OFFERTS,
  ORDRES_OFFERTS,
  annonceDeLaMachine,
  cleImposition,
  cleModele,
  cleOrdre,
  cleSource,
  filtrerPersonnes,
  libelleSource,
  listeBloquee,
  memesReglages,
  modeleImposeSonPapier,
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
  personne(1, 'Iris', 'Ombrelle', { organisation: 'Club des Merles' }),
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
const planches = creerPlanches({ polices: async () => lirePolices(), logo: async () => lireLogo(), provenance: 'test', version: VERSION.affichee });
// Un dossier de travail vide : le nom de la planche ne lit que son
// séparateur et, pour une réédition, ses entrées.
const fsVide = Object.freeze({ nature: 'epreuve', emplacements: async () => ({ separateur: '/' }), lister: async () => [] });

// L'annonce que la séance rendrait sur cette charge, ce papier et cette
// demande : la lecture que la séance passe, sur un dossier vide.
const annoncer = (charge, papier, demande = {}) =>
  planches.preparer({ charge, base: 'lucioles', fs: fsVide, racine: { id: 'documents', chemin: '/d' }, papier }, demande);

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
    assert.equal(planchesLues, 'Planches : 1 planche en A4 (papier utilisé) et 2 planches en Lettre.');
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

  test('sans placement, ou sous tout refus du placement ou de la mise en page, « Produire » est bloqué ; sans refus, non', () => {
    const vide = { papier: 'A4', comptes: null, planches: null, homonymes: [], absents: [], brouillon: true, nom: null };
    assert.equal(produireBloque(null), false);
    assert.equal(produireBloque({ ...vide, refus: null }), false);
    for (const code of ['PLANCHE_SANS_PLACEMENT', 'RETENU_FAUTIF', 'PROPOSITION_FAUTIVE', 'PLANCHE_DERIVE', 'PLANCHE_TROP_DE_TOURS', 'PLANCHE_NOM_TROP_LONG']) {
      assert.equal(produireBloque({ ...vide, refus: { code, details: {} } }), true, code);
    }
  });

  test('la liste en CSV n’est bloquée que par un refus du placement, jamais par un refus de la mise en page', async () => {
    const vide = { papier: 'A4', comptes: null, planches: null, homonymes: [], absents: [], brouillon: true, nom: null };
    assert.equal(listeBloquee(null), false);
    assert.equal(listeBloquee({ ...vide, refus: null }), false);
    for (const code of ['PLANCHE_SANS_PLACEMENT', 'RETENU_FAUTIF', 'PROPOSITION_FAUTIVE', 'PLANCHE_DERIVE']) {
      assert.equal(listeBloquee({ ...vide, refus: { code, details: {} } }), true, code);
    }
    // Un refus de la mise en page vient avec le modèle : ses comptes.
    const comptes = { participants: 4, exclus: 0, produits: 4 };
    for (const code of ['PLANCHE_TROP_DE_TOURS', 'PLANCHE_NOM_TROP_LONG']) {
      assert.equal(listeBloquee({ ...vide, comptes, refus: { code, details: {} } }), false, code);
    }
    const long = retenue();
    long.participants[1].nom = `Pervenche${'w'.repeat(1990)}`;
    const annonce = await annoncer(long, 'A4');
    assert.equal(annonce.refus.code, 'PLANCHE_NOM_TROP_LONG');
    assert.deepEqual([produireBloque(annonce), listeBloquee(annonce)], [true, false]);
  });

  test('un papier absent : Lettre, sans refus, marqué parmi les planches des deux papiers, et le fichier le nomme', async () => {
    const annonce = await annoncer(retenue(), null);
    assert.deepEqual([annonce.refus, annonce.papier], [null, 'Lettre']);
    assert.match(annonce.nom, /_Lettre_feuille_/);
    const phrases = phrasesAnnonce(annonce, { source: 'retenu', proposition: null, selection: null });
    assert.deepEqual(cles(phrases), ['badges.annonce.source.retenu', 'badges.annonce.comptes', 'badges.annonce.planches', 'badges.annonce.fichier']);
    assert.deepEqual(phrases[2].details.parPapier.map(({ choisi }) => choisi), [false, true]);
    assert.equal(composer(phrases)[2], 'Planches : 1 planche en A4 et 2 planches en Lettre (papier utilisé).');
  });

  test('des homonymes : chaque groupe nommé, avec les identifiants que le badge imprime', async () => {
    const charge = retenue();
    charge.participants[2] = personne(3, 'Iris', 'Ombrelle', { organisation: 'Club des Merles' });
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
      { id: 6, nom: 'éloi Abeille', organisation: null },
      { id: 4, nom: 'Grisaille', organisation: null },
      { id: 1, nom: 'Iris Ombrelle', organisation: 'Club des Merles' },
      { id: 3, nom: 'Ondine Lacasse', organisation: null },
      { id: 2, nom: 'Théo Pervenche', organisation: null },
    ]);
  });

  test('le filtre retient les noms ou organisations qui contiennent la saisie normalisée ; une saisie vide retient tout', () => {
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

describe('le modèle de badge (§ 8.5, § 11.2)', () => {
  // L'annonce de la séance sur la soirée retenue, sous Avery 5392.
  const annoncerAvery = (charge, papier, demande = {}) =>
    planches.preparer(
      { charge, base: 'lucioles', fs: fsVide, racine: { id: 'documents', chemin: '/d' }, papier, modeleBadge: 'avery5392' },
      demande,
    );

  test('la section offre Avery 5392 puis l’A6, chacun son libellé ; seul Avery 5392 impose son papier', () => {
    assert.deepEqual(MODELES_OFFERTS, ['avery5392', 'a6']);
    assert.deepEqual(MODELES_OFFERTS.map(cleModele), ['badges.modele.avery5392', 'badges.modele.a6']);
    composer(MODELES_OFFERTS.map((modele) => ({ cle: cleModele(modele), details: {} })));
    assert.deepEqual(MODELES_OFFERTS.map(modeleImposeSonPapier), [true, false]);
    for (const inconnu of ['A6', null, 'toString']) {
      assert.throws(() => cleModele(inconnu), RangeError, String(inconnu));
      assert.throws(() => modeleImposeSonPapier(inconnu), RangeError, String(inconnu));
    }
  });

  test('une annonce est celle de la machine quand son modèle et son papier sont ceux que la machine donne ; sans modèle, elle est de l’A6', async () => {
    const avery = await annoncerAvery(retenue(), null);
    assert.equal(annonceDeLaMachine(avery, { modeleBadge: 'avery5392', papier: null }), true);
    assert.equal(annonceDeLaMachine(avery, { modeleBadge: 'avery5392', papier: 'A4' }), true);
    assert.equal(annonceDeLaMachine(avery, { modeleBadge: 'a6', papier: 'Lettre' }), false);
    const a6 = await annoncer(retenue(), 'A4');
    assert.equal(annonceDeLaMachine(a6, { modeleBadge: 'a6', papier: 'A4' }), true);
    assert.equal(annonceDeLaMachine(a6, { modeleBadge: 'a6', papier: 'Lettre' }), false);
    assert.equal(annonceDeLaMachine(a6, { modeleBadge: 'avery5392', papier: 'A4' }), false);
    const { modeleBadge: _modele, ...sansModele } = a6;
    assert.equal(annonceDeLaMachine(sansModele, { modeleBadge: 'a6', papier: 'A4' }), true);
  });

  test('Avery 5392 : les feuilles de cartes à la place des planches par papier, et les deux fichiers à la place d’un seul', async () => {
    const annonce = await annoncerAvery(retenue(), null);
    const phrases = phrasesAnnonce(annonce, { source: 'retenu' });
    assert.ok(cles(phrases).includes('badges.annonce.cartes'), JSON.stringify(cles(phrases)));
    assert.ok(!cles(phrases).includes('badges.annonce.planches'));
    assert.ok(!cles(phrases).includes('badges.annonce.fichier'));
    const textes = composer(phrases);
    assert.ok(textes.includes('Planches : 1 feuille de six cartes Avery 5392, sur Lettre.'), JSON.stringify(textes));
    assert.ok(textes.includes(`Fichiers : ${annonce.nom}, puis la feuille de contrôle ${annonce.nomControle}, à imprimer sur papier ordinaire.`));
  });
});

describe('le pied TechnoLibre (§ 8.5, § 11.4)', () => {
  // L'annonce de la séance sur la soirée retenue, la case donnée.
  const annoncerAvecCase = (charge, piedTechnolibre) =>
    planches.preparer({ charge, base: 'lucioles', fs: fsVide, racine: { id: 'documents', chemin: '/d' }, papier: 'A4', modeleBadge: 'a6', piedTechnolibre });

  test('une annonce est celle de la machine quand sa case est celle de la machine ; une annonce ou une machine qui ne la porte pas vaut décochée', async () => {
    const cochee = await annoncerAvecCase(retenue(), true);
    const decochee = await annoncerAvecCase(retenue(), false);
    const machine = { modeleBadge: 'a6', papier: 'A4' };
    assert.equal(annonceDeLaMachine(cochee, { ...machine, piedTechnolibre: true }), true);
    assert.equal(annonceDeLaMachine(cochee, { ...machine, piedTechnolibre: false }), false);
    assert.equal(annonceDeLaMachine(decochee, { ...machine, piedTechnolibre: true }), false);
    assert.equal(annonceDeLaMachine(decochee, { ...machine, piedTechnolibre: false }), true);
    assert.equal(annonceDeLaMachine(decochee, machine), true);
    const { piedTechnolibre: _case, ...sansCase } = cochee;
    assert.equal(annonceDeLaMachine(sansCase, { ...machine, piedTechnolibre: false }), true);
  });

  test('l’annonce nomme les badges d’où le pied TechnoLibre se retire, après les caractères absents ; rien quand il tient partout ou n’est pas demandé', async () => {
    const tient = await annoncerAvecCase(retenue(), true);
    assert.equal(tient.sansTechnolibre, 0);
    assert.ok(!cles(phrasesAnnonce(tient)).includes('badges.annonce.technolibreRetire'));
    assert.ok(!cles(phrasesAnnonce(await annoncerAvecCase(retenue(), false))).includes('badges.annonce.technolibreRetire'));
    for (const [n, texte] of [
      [1, 'Pied TechnoLibre : retiré d’un badge, faute de place sous ses tours.'],
      [3, 'Pied TechnoLibre : retiré de 3 badges, faute de place sous leurs tours.'],
    ]) {
      const charge = retenue();
      charge.participants[1] = personne(2, 'Théo', 'Pervenche 李');
      const annonce = { ...(await annoncerAvecCase(charge, true)), sansTechnolibre: n };
      const phrases = phrasesAnnonce(annonce);
      const rang = cles(phrases).indexOf('badges.annonce.technolibreRetire');
      assert.equal(rang, cles(phrases).indexOf('badges.annonce.absents') + 1, JSON.stringify(cles(phrases)));
      assert.deepEqual(phrases[rang].details, { n });
      assert.equal(composer(phrases)[rang], texte);
    }
  });

  test('la case et son avertissement ont leur libellé', () => {
    const textes = composer([
      { cle: 'badges.technolibre.case', details: {} },
      { cle: 'badges.technolibre.nonRetenu', details: {} },
    ]);
    assert.match(textes[0], /TechnoLibre/);
    assert.match(textes[1], /retenue sur ce poste/);
  });
});

describe('les logos des participants (§ 11.4, § 11.5, § 5.9)', () => {
  const avecLogos = async (logos) => ({ ...(await annoncer(retenue(), 'A4')), logos });

  test('sans logo désigné, l’annonce ne dit rien des logos', async () => {
    const annonce = await annoncer(retenue(), 'A4');
    assert.equal(annonce.logos, null);
    assert.ok(!cles(phrasesAnnonce(annonce)).some((cle) => cle.startsWith('badges.annonce.logos')));
    assert.ok(!cles(phrasesAnnonce(await avecLogos({ poses: 4, sansPlace: 0, introuvables: [] }))).some((cle) => cle.startsWith('badges.annonce.logos')));
  });

  test('les logos introuvables, puis illisibles, nomment leurs personnes dans l’ordre de la pile, puis le compte de ceux sans place, avant le pied TechnoLibre ; rien ne bloque', async () => {
    const annonce = {
      ...(await avecLogos({
        poses: 1,
        sansPlace: 2,
        introuvables: [
          { participant: 4, nom: 'Grisaille', cause: 'ABSENT' },
          { participant: 3, nom: 'Ondine Lacasse', cause: 'ILLISIBLE' },
          { participant: 1, nom: 'Iris Ombrelle', cause: 'ABSENT' },
        ],
      })),
      sansTechnolibre: 1,
    };
    const phrases = phrasesAnnonce(annonce);
    const rangs = ['badges.annonce.logosIntrouvables', 'badges.annonce.logosIllisibles', 'badges.annonce.logosSansPlace', 'badges.annonce.technolibreRetire'].map((cle) =>
      cles(phrases).indexOf(cle),
    );
    assert.ok(rangs.every((rang, k) => rang > 0 && (k === 0 || rang === rangs[k - 1] + 1)), JSON.stringify(cles(phrases)));
    assert.deepEqual(phrases[rangs[0]].details, { noms: ['Grisaille', 'Iris Ombrelle'] });
    const textes = composer(phrases);
    assert.equal(textes[rangs[0]], 'Logos introuvables dans le dossier de l’événement pour Grisaille et Iris Ombrelle : leurs badges s’impriment sans logo.');
    assert.equal(textes[rangs[1]], 'Logo illisible pour Ondine Lacasse : son badge s’imprime sans logo.');
    assert.equal(textes[rangs[2]], 'Logo du participant : retiré de 2 badges, faute de place sous leurs tours.');
    assert.equal(produireBloque(annonce), false);
  });

  test('au singulier comme au pluriel, chaque phrase des logos se compose', () => {
    const textes = composer([
      { cle: 'badges.annonce.logosIntrouvables', details: { noms: ['Iris Ombrelle'] } },
      { cle: 'badges.annonce.logosIllisibles', details: { noms: ['Iris Ombrelle', 'Théo Pervenche', 'Grisaille'] } },
      { cle: 'badges.annonce.logosSansPlace', details: { n: 1 } },
    ]);
    assert.deepEqual(textes, [
      'Logo introuvable dans le dossier de l’événement pour Iris Ombrelle : son badge s’imprime sans logo.',
      'Logos illisibles pour Iris Ombrelle, Théo Pervenche et Grisaille : leurs badges s’impriment sans logo.',
      'Logo du participant : retiré d’un badge, faute de place sous ses tours.',
    ]);
  });
});
