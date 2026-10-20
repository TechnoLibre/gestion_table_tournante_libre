// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du modèle des paires répétées (§ 12.5, B14, D32, D33, D50) : les
// cas de la vue ; les paires choisies, puis les imposées, dans l'ordre du
// détail, tours écrits à partir de 1 et tables par leur numéro, la ligne
// menant au premier tour où la paire se revoit ; les pages de cent ; la
// matrice dans l'ordre du profil, jamais par l'alphabet, symétrique, vide
// sur la diagonale ; la rubrique « Rencontres » de la fiche, égale à la
// ligne de la matrice. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { detaillerQualite } from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { rechercher } from '../../moteur/recherche.js';
import { configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import {
  CAS_PAIRES,
  casDesPaires,
  lignesDesPaires,
  matriceDesPaires,
  nomDistinct,
  pageDesPaires,
  rubriqueRencontres,
  syntheseMatrice,
} from './paires.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);
const V1 = VERSION.affichee;

// Douze personnes inventées, deux appartenances, la dernière sans ; les deux
// premières réservées ensemble à la table 1 à chaque tour : leur paire est
// imposée.
const NOMS = [
  ['Ombrelle', 'Iris', 'Coopérative Aubier'],
  ['Pervenche', 'Théo', 'Coopérative Aubier'],
  ['Lacasse', 'Ondine', 'Atelier Ressac'],
  ['Tourteau', 'Basile', 'Atelier Ressac'],
  ['Quenouille', 'Maëlle', 'Coopérative Aubier'],
  ['Varech', 'Sidonie', 'Atelier Ressac'],
  ['Bruyère', 'Aurèle', 'Coopérative Aubier'],
  ['Embrun', 'Clovis', 'Atelier Ressac'],
  ['Sablière', 'Noé', 'Coopérative Aubier'],
  ['Goémon', 'Perrine', 'Atelier Ressac'],
  ['Ajonc', 'Tancrède', null],
  ['Fougeraie', 'Ysaline', null],
];

// Douze personnes, quatre tables de trois numérotées 11 à 14, six tours :
// douze places de voisinage pour onze autres, une répétition au moins pour
// chacun (§ 12.5).
function chargeDouze() {
  const charge = creerCharge({ id: 'evt-paires', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: 6 });
  charge.participants = NOMS.map(([nom, prenom, appartenance], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = [1, 2, 3, 4].map((id) => ({ id, numero: 10 + id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  charge.reservations = [1, 2].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
  charge.prochainsIds = { participant: 13, table: 5, proposition: 1 };
  return charge;
}

// La charge, une génération de plus, enregistrée par la commande.
function generee(charge, reglages = { graine: 5, arret: 60, nombre: 2 }) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, reglages);
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

const CHARGE = generee(chargeDouze());
const PREMIERE = CHARGE.propositions[0].id;
const DETAIL = detaillerQualite(CHARGE, PREMIERE);

// Une paire forgée du détail, a < b, rencontrée aux tours donnés, à partir
// de 0, à la table 1.
const paireForgee = (a, b, tours) => ({ a, b, fois: tours.length, tours: tours.map((tour) => ({ tour, table: 1 })) });

describe('le cas de la vue (§ 12.6)', () => {
  const paires = { choisies: [paireForgee(1, 2, [0, 1])], imposees: [] };
  const vide = { choisies: [], imposees: [] };

  test('une seule table l’emporte, puis un seul tour ; sans paire, aucune ; sinon le tableau', () => {
    assert.deepEqual(CAS_PAIRES, ['uneTable', 'unTour', 'aucune', 'tableau']);
    assert.equal(casDesPaires({ T: 1, R: 1, paires }), 'uneTable');
    assert.equal(casDesPaires({ T: 1, R: 3, paires }), 'uneTable');
    assert.equal(casDesPaires({ T: 4, R: 1, paires: vide }), 'unTour');
    assert.equal(casDesPaires({ T: 4, R: 6, paires: vide }), 'aucune');
    assert.equal(casDesPaires({ T: 4, R: 6, paires }), 'tableau');
    assert.equal(casDesPaires({ T: 4, R: 6, paires: { choisies: [], imposees: paires.choisies } }), 'tableau');
  });

  test('sur 12 / 4 × 3 / 6, le détail est comparable et sa vue est le tableau', () => {
    assert.equal(DETAIL.statut, 'comparable');
    assert.equal(casDesPaires(DETAIL), 'tableau');
  });
});

describe('les lignes du tableau des paires (§ 12.5, D32)', () => {
  const { choisies, imposees } = lignesDesPaires(DETAIL);

  test('les paires choisies d’abord, dans l’ordre du détail ; la paire réservée ensemble à chaque tour est imposée, et seulement elle', () => {
    assert.ok(choisies.length > 0, 'au moins une paire choisie sur 12 / 4 × 3 / 6');
    assert.deepEqual(
      choisies.map(({ cle }) => cle),
      DETAIL.paires.choisies.map(({ a, b }) => `${a}:${b}`),
    );
    assert.deepEqual(
      imposees.map(({ cle, genre, fois }) => [cle, genre, fois]),
      [['1:2', 'imposee', 6]],
    );
    assert.ok(choisies.every(({ genre }) => genre === 'choisie'));
    assert.ok(!choisies.some(({ cle }) => cle === '1:2'), 'la paire imposée n’est pas parmi les choisies');
  });

  test('chaque ligne écrit ses tours à partir de 1 et ses tables par leur numéro, et mène au premier tour où la paire se revoit', () => {
    for (const [ligne, brute] of [...choisies, ...imposees].map((l, i) => [l, [...DETAIL.paires.choisies, ...DETAIL.paires.imposees][i]])) {
      assert.deepEqual(
        ligne.tours,
        brute.tours.map(({ tour, table }) => ({ tour: tour + 1, table: 10 + table })),
      );
      assert.equal(ligne.repetition, brute.tours[1].tour + 1, `${ligne.cle} : le second tour ensemble`);
      assert.notEqual(ligne.repetition, ligne.tours[0].tour, `${ligne.cle} : jamais le premier tour de rencontre`);
      assert.equal(ligne.fois, ligne.tours.length);
    }
    assert.deepEqual(imposees[0].tours.map(({ tour, table }) => [tour, table]), [1, 2, 3, 4, 5, 6].map((tour) => [tour, 11]));
    assert.equal(imposees[0].repetition, 2);
  });

  test('chaque personne porte son nom affiché et son appartenance ; un homonyme se signale, pas les autres', () => {
    const { a, b } = imposees[0];
    assert.deepEqual(a, { id: 1, nom: 'Iris Ombrelle', appartenance: 'Coopérative Aubier', homonyme: false });
    assert.deepEqual(b, { id: 2, nom: 'Théo Pervenche', appartenance: 'Coopérative Aubier', homonyme: false });
    const forge = {
      ...DETAIL,
      personnes: [
        { id: 1, nom: 'Iris Ombrelle', appartenance: 'Coopérative Aubier', statut: 'mobile' },
        { id: 2, nom: 'Iris Ombrelle', appartenance: 'Atelier Ressac', statut: 'mobile' },
        { id: 3, nom: 'Ondine Lacasse', appartenance: null, statut: 'mobile' },
      ],
      idsTables: [1],
      numerosTables: [7],
      paires: { choisies: [paireForgee(1, 2, [0, 2]), paireForgee(1, 3, [1, 2])], imposees: [] },
    };
    const lignes = lignesDesPaires(forge).choisies;
    assert.deepEqual(
      lignes.map(({ a, b }) => [a.homonyme, b.homonyme]),
      [
        [true, true],
        [true, false],
      ],
    );
    assert.deepEqual(lignes[0].tours, [
      { tour: 1, table: 7 },
      { tour: 3, table: 7 },
    ]);
    assert.equal(lignes[0].repetition, 3);
  });
});

describe('les pages du tableau des paires (§ 5.7, D50)', () => {
  // 180 paires choisies et 70 imposées, forgées : 250 lignes.
  const forgees = (n, genre) => Array.from({ length: n }, (_, i) => ({ cle: `${genre}${i}`, genre }));
  const lignes = { choisies: forgees(180, 'choisie'), imposees: forgees(70, 'imposee') };

  test('250 paires font trois pages de cent : les choisies d’abord, puis les imposées, comptées à la suite', () => {
    const [une, deux, trois] = [1, 2, 3].map((page) => pageDesPaires(lignes, page));
    assert.deepEqual(
      [une, deux, trois].map(({ page, pages, premier, dernier, total, paginee }) => [page, pages, premier, dernier, total, paginee]),
      [
        [1, 3, 1, 100, 250, true],
        [2, 3, 101, 200, 250, true],
        [3, 3, 201, 250, 250, true],
      ],
    );
    assert.deepEqual(
      [une, deux, trois].map(({ choisies, imposees }) => [choisies.length, imposees.length]),
      [
        [100, 0],
        [80, 20],
        [0, 50],
      ],
    );
    assert.equal(deux.choisies[0].cle, 'choisie100');
    assert.equal(deux.imposees[0].cle, 'imposee0');
    assert.equal(trois.imposees[0].cle, 'imposee20');
  });

  test('une page hors des pages existantes se borne ; une seule page n’est pas paginée', () => {
    assert.equal(pageDesPaires(lignes, 9).page, 3);
    assert.equal(pageDesPaires(lignes, 0).page, 1);
    const seule = pageDesPaires({ choisies: forgees(3, 'choisie'), imposees: forgees(1, 'imposee') }, 1);
    assert.deepEqual([seule.pages, seule.premier, seule.dernier, seule.total, seule.paginee], [1, 1, 4, 4, false]);
  });
});

describe('la matrice « qui a rencontré qui » (§ 12.5, D33)', () => {
  const matrice = matriceDesPaires(DETAIL, { t, format });
  const n = DETAIL.personnes.length;

  test('les personnes viennent dans l’ordre du profil, jamais par l’alphabet', () => {
    const profil = DETAIL.profil.map(({ id }) => id);
    assert.deepEqual(DETAIL.matrice.ordre, profil);
    assert.deepEqual(
      matrice.personnes.map(({ id }) => id),
      profil,
    );
    const parNom = new Map(DETAIL.personnes.map(({ id, nom }) => [id, nom]));
    const alphabet = [...profil].sort((a, b) => (parNom.get(a) < parNom.get(b) ? -1 : 1));
    assert.notDeepEqual(profil, alphabet, 'l’épreuve exige un profil qui n’est pas l’ordre alphabétique');
    assert.deepEqual(
      matrice.lignes.map(({ libelle }) => libelle),
      profil.map((id, i) => `${i + 1}. ${parNom.get(id)}`),
    );
    assert.deepEqual(
      matrice.colonnes.map(({ libelle }) => libelle),
      profil.map((_, i) => String(i + 1)),
    );
  });

  test('n × n valeurs, symétriques, vides sur la diagonale, chacune le compte du triangle du détail', () => {
    assert.equal(matrice.valeurs.length, n * n);
    let k = 0;
    for (let i = 0; i < n; i += 1) {
      assert.equal(matrice.valeurs[i * n + i], null);
      for (let j = i + 1; j < n; j += 1) {
        assert.equal(matrice.valeurs[i * n + j], DETAIL.matrice.comptes[k], `case ${i}:${j}`);
        assert.equal(matrice.valeurs[j * n + i], DETAIL.matrice.comptes[k], `case ${j}:${i}`);
        k += 1;
      }
    }
  });

  test('la paire imposée se lit dans sa case ; l’infobulle porte une ligne par case, le jumeau une ligne par personne', () => {
    const i = matrice.personnes.findIndex(({ id }) => id === 1);
    const j = matrice.personnes.findIndex(({ id }) => id === 2);
    assert.equal(matrice.valeurs[i * n + j], 6);
    assert.deepEqual(matrice.infobulle.lignes[i * n + j], { paire: 'Iris Ombrelle et Théo Pervenche', fois: 6 });
    assert.deepEqual(matrice.infobulle.lignes[i * n + i], { paire: 'Iris Ombrelle', fois: null });
    assert.equal(matrice.infobulle.lignes.length, n * n);
    assert.deepEqual(
      matrice.infobulle.colonnes.map(({ cle, genre }) => [cle, genre]),
      [
        ['paire', 'texte'],
        ['fois', 'nombre'],
      ],
    );
    const { jumeau } = matrice;
    assert.equal(jumeau.nom, 'Qui a rencontré qui');
    assert.equal(jumeau.colonnes.length, n + 1);
    assert.equal(jumeau.lignes.length, n);
    assert.equal(jumeau.lignes[i].personne, matrice.lignes[i].libelle);
    assert.equal(jumeau.lignes[i][`c${j}`], 6);
    assert.equal(jumeau.lignes[i][`c${i}`], '');
  });

  test('deux homonymes : l’intitulé de leur ligne et l’infobulle de leurs cases portent leur identifiant, écrit une fois par personne', () => {
    // La personne 2 prend le nom affiché de la personne 1.
    const forge = {
      ...DETAIL,
      personnes: DETAIL.personnes.map((p) => (p.id === 2 ? { ...p, nom: 'Iris Ombrelle' } : p)),
    };
    const homonymes = matriceDesPaires(forge, { t, format });
    const indice = (id) => homonymes.personnes.findIndex((p) => p.id === id);
    const [i1, i2, i3] = [1, 2, 3].map(indice);
    const nom1 = t('qualite.paires.nomHomonyme', { nom: 'Iris Ombrelle', id: 1 });
    const nom2 = t('qualite.paires.nomHomonyme', { nom: 'Iris Ombrelle', id: 2 });
    assert.equal(nom1, 'Iris Ombrelle (n° 1)');
    assert.deepEqual([homonymes.personnes[i1].nom, homonymes.personnes[i2].nom], [nom1, nom2]);
    assert.equal(homonymes.lignes[i1].libelle, `${i1 + 1}. ${nom1}`);
    assert.equal(homonymes.lignes[i2].libelle, `${i2 + 1}. ${nom2}`);
    const bulle = (i, j) => homonymes.infobulle.lignes[i * n + j].paire;
    assert.equal(bulle(i1, i3), `${nom1} et Ondine Lacasse`);
    assert.equal(bulle(i2, i3), `${nom2} et Ondine Lacasse`);
    assert.notEqual(bulle(i1, i3), bulle(i2, i3));
    assert.equal(bulle(i1, i1), nom1);
    // Les autres gardent leur nom seul, dans l'intitulé comme dans
    // l'infobulle.
    assert.equal(homonymes.personnes[i3].nom, 'Ondine Lacasse');
    assert.equal(homonymes.jumeau.lignes[i2].personne, homonymes.lignes[i2].libelle);
    assert.equal(nomDistinct({ id: 3, nom: 'Ondine Lacasse', homonyme: false }, t), 'Ondine Lacasse');
  });

  test('sans matrice au détail, aucune', () => {
    assert.equal(matriceDesPaires({ ...DETAIL, matrice: null }, { t, format }), null);
  });

  test('la synthèse lit chaque liste du détail, sans la recompter : son effectif et le fois de sa tête, les choisies puis les imposées', () => {
    const synthese = syntheseMatrice(DETAIL);
    assert.deepEqual(synthese, {
      cle: 'qualite.paires.matrice.synthese',
      details: {
        choisies: { paires: DETAIL.paires.choisies.length, fois: DETAIL.paires.choisies[0].fois },
        imposees: { paires: 1, fois: 6 },
      },
    });
    // Chaque liste garde sa tête : aucune des deux n'est retenue sur l'autre.
    const deux = { paires: { choisies: [paireForgee(1, 2, [0, 1])], imposees: [paireForgee(3, 4, [0, 1, 2]), paireForgee(5, 6, [0, 1])] } };
    assert.deepEqual(syntheseMatrice(deux).details, { choisies: { paires: 1, fois: 2 }, imposees: { paires: 2, fois: 3 } });
    const seuleChoisie = { paires: { choisies: [paireForgee(1, 2, [0, 1])], imposees: [] } };
    assert.deepEqual(syntheseMatrice(seuleChoisie).details, { choisies: { paires: 1, fois: 2 }, imposees: null });
    assert.deepEqual(syntheseMatrice({ paires: { choisies: [], imposees: [] } }), { cle: 'qualite.paires.matrice.syntheseAucune', details: {} });
    assert.equal(
      t(syntheseMatrice(deux).cle, syntheseMatrice(deux).details),
      'Chaque case porte le nombre de rencontres de la paire. 1 paire choisie se revoit, 2 fois ; 2 paires imposées se revoient, la plus revue 3 fois.',
    );
  });
});

describe('la rubrique « Rencontres » de la fiche (§ 12.5, B14, D33)', () => {
  test('la ligne de la fiche égale celle de la matrice, pour chaque personne', () => {
    const matrice = matriceDesPaires(DETAIL, { t, format });
    const n = matrice.personnes.length;
    matrice.personnes.forEach(({ id }, i) => {
      const rubrique = rubriqueRencontres(CHARGE, PREMIERE, id);
      assert.equal(rubrique.statut, 'mesuree');
      assert.deepEqual(rubrique.source, { cle: 'participants.fiche.rencontres.proposition', details: { proposition: PREMIERE } });
      const deLaFiche = new Map(rubrique.lignes.map(({ id: autre, fois }) => [autre, fois]));
      const deLaMatrice = new Map();
      matrice.personnes.forEach(({ id: autre }, j) => {
        const fois = matrice.valeurs[i * n + j];
        if (fois !== null && fois > 0) deLaMatrice.set(autre, fois);
      });
      assert.deepEqual(deLaFiche, deLaMatrice, `personne ${id}`);
    });
  });

  test('les plus revues d’abord ; tours à partir de 1, tables par leur numéro', () => {
    const { lignes } = rubriqueRencontres(CHARGE, PREMIERE, 1);
    assert.deepEqual(lignes[0].id, 2);
    assert.equal(lignes[0].nom, 'Théo Pervenche');
    assert.deepEqual([lignes[0].appartenance, lignes[0].homonyme], ['Coopérative Aubier', false]);
    assert.equal(lignes[0].fois, 6);
    assert.deepEqual(lignes[0].tours, [1, 2, 3, 4, 5, 6].map((tour) => ({ tour, table: 11 })));
    for (let k = 1; k < lignes.length; k += 1) assert.ok(lignes[k - 1].fois >= lignes[k].fois);
  });

  test('la source est la proposition demandée qu’a la liste, sinon le retenu, sinon aucune : sans placement, rien à écrire', () => {
    const autre = CHARGE.propositions[1].id;
    assert.deepEqual(rubriqueRencontres(CHARGE, autre, 3).source.details, { proposition: autre });
    const retenue = appliquerCommande('retenirProposition', CHARGE, { id: autre }).charge;
    const duRetenu = rubriqueRencontres(retenue, null, 3);
    assert.deepEqual([duRetenu.statut, duRetenu.source], ['mesuree', { cle: 'participants.fiche.rencontres.retenu', details: {} }]);
    assert.deepEqual(rubriqueRencontres(retenue, 999, 3).source.cle, 'participants.fiche.rencontres.retenu');
    // Une proposition demandée l'emporte sur le retenu : la fiche mesure ce
    // que la page de qualité mesure.
    assert.notEqual(PREMIERE, autre);
    const demandeeSurRetenu = rubriqueRencontres(retenue, PREMIERE, 3);
    assert.deepEqual(demandeeSurRetenu.source, { cle: 'participants.fiche.rencontres.proposition', details: { proposition: PREMIERE } });
    assert.deepEqual(demandeeSurRetenu.lignes, rubriqueRencontres(CHARGE, PREMIERE, 3).lignes);
    assert.deepEqual(rubriqueRencontres(CHARGE, null, 3), { statut: 'sansPlacement', source: null, lignes: [] });
    assert.deepEqual(rubriqueRencontres(chargeDouze(), null, 3), { statut: 'sansPlacement', source: null, lignes: [] });
  });

  test('deux homonymes rencontrés : chaque ligne porte son identifiant, son appartenance et le signe homonyme, comme au tableau des paires', () => {
    // La personne 2, réservée avec la personne 1, prend son nom : qui
    // rencontre l'une rencontre l'autre. La 12, sans appartenance.
    const charge = structuredClone(CHARGE);
    Object.assign(charge.participants[1], { nom: 'Ombrelle', prenom: 'Iris' });
    const lignesDe = (personne) => rubriqueRencontres(charge, PREMIERE, personne).lignes;
    const temoin = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((personne) => lignesDe(personne).some(({ id }) => id === 1));
    assert.notEqual(temoin, undefined);
    const lignes = lignesDe(temoin);
    const de = (id) => lignes.find((ligne) => ligne.id === id);
    assert.deepEqual(
      [1, 2].map((id) => {
        const { nom, appartenance, homonyme } = de(id);
        return { id, nom, appartenance, homonyme };
      }),
      [
        { id: 1, nom: 'Iris Ombrelle', appartenance: 'Coopérative Aubier', homonyme: true },
        { id: 2, nom: 'Iris Ombrelle', appartenance: 'Coopérative Aubier', homonyme: true },
      ],
    );
    for (const ligne of lignes.filter(({ id }) => id > 2)) assert.equal(ligne.homonyme, false, `personne ${ligne.id}`);
    // Le même signe que celui du tableau des paires, sur les mêmes personnes.
    const detail = detaillerQualite(charge, PREMIERE);
    const paire = lignesDesPaires(detail).imposees[0];
    assert.deepEqual([paire.a.homonyme, paire.b.homonyme], [true, true]);
    // Une personne sans appartenance n'en porte aucune.
    const rencontreLa12 = [3, 4, 5, 6, 7, 8, 9, 10, 11].find((personne) => lignesDe(personne).some(({ id }) => id === 12));
    assert.equal(lignesDe(rencontreLa12).find(({ id }) => id === 12).appartenance, null);
  });

  test('une personne exclue, une source qui ne se mesure pas : le statut le dit, sans ligne', () => {
    const exclue = structuredClone(CHARGE);
    exclue.participants[2].exclu = true;
    assert.deepEqual(rubriqueRencontres(exclue, PREMIERE, 3).statut, 'exclue');
    assert.deepEqual(rubriqueRencontres(exclue, PREMIERE, 3).lignes, []);
    // La proposition dérive pour les autres : l'exclue n'y est plus mesurée.
    const derive = rubriqueRencontres(exclue, PREMIERE, 4);
    assert.deepEqual([derive.statut, derive.lignes], ['nonMesurable', []]);
    assert.deepEqual(derive.source, { cle: 'participants.fiche.rencontres.proposition', details: { proposition: PREMIERE } });
  });
});
