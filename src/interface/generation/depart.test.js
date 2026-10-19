// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le départ d'une génération dérivée dans la section de la génération
// (§ 5.7, C6) : la carte du départ — son numéro, une case par tour, le
// libellé de « Générer » sous lui — et l'issue d'une génération dérivée,
// lue dans la table d'évaluation, sans tri ni compte. Les tables
// d'évaluation d'épreuve ne portent que ce que l'issue lit : l'ordre du
// classement. Les écarts du départ à la soirée se lisent sur une charge
// écrite à la main, changée par les commandes de l'application.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { ecartAuRetenu, ecartsDuDepart } from '../../application/depart.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { carteDuDepart, issueDerivee } from './depart.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Une charge réduite à ce que la carte lit quand aucune proposition ne
// l'écarte : le nombre de tours, sans personne, proposition ni retenu.
const chargeDe = (tours) => ({ evenement: { tours }, participants: [], propositions: [], retenu: null });

// Une table d'évaluation réduite à l'ordre de son classement.
const tableDe = (ordre) => ({ classement: { ordre } });

// Le rendu d'une génération dérivée depuis la proposition depart.
const rendu = ({ ajoutees, identiques = 0, identiquesAuDepart = 0, depart = 4, toursFiges = [], departEnDerive = false, avertissements = [] }) => ({
  ajoutees,
  identiques,
  identiquesAuDepart,
  dureeMs: 0,
  depart: { id: depart, toursFiges },
  departEnDerive,
  ecarts: [],
  avertissements,
});

// Le texte qu'une issue écrit.
const texte = (issue) => t(issue.cle, issue.details);

describe('la carte du départ', () => {
  test('sans départ, aucune carte', () => {
    assert.equal(carteDuDepart(chargeDe(3), null), null);
  });

  test('sous un départ : son numéro, une case par tour de la soirée, cochée pour un tour figé, et « Générer depuis n° 4 »', () => {
    const carte = carteDuDepart(chargeDe(3), { id: 4, toursFiges: [2] });
    assert.deepEqual(carte, {
      depart: 4,
      cases: [
        { tour: 1, coche: false },
        { tour: 2, coche: true },
        { tour: 3, coche: false },
      ],
      commande: { cle: 'generation.commande.genererDepuis', nom: 'genererDepuis', details: { depart: 4 } },
      ecarts: [],
      ecartRetenu: null,
    });
    assert.equal(t(carte.commande.cle, carte.commande.details), 'Générer depuis n° 4');
    assert.equal(t('generation.depart.titre', { depart: 4 }), 'Départ : proposition n° 4');
  });

  test('un départ choisi part de cases toutes décochées ; un tour figé au-delà de la soirée n’a pas de case', () => {
    assert.deepEqual(
      carteDuDepart(chargeDe(2), { id: 7, toursFiges: [] }).cases.map(({ coche }) => coche),
      [false, false],
    );
    assert.deepEqual(carteDuDepart(chargeDe(2), { id: 7, toursFiges: [1, 5] }).cases, [
      { tour: 1, coche: true },
      { tour: 2, coche: false },
    ]);
  });

  test('une soirée d’un seul tour a sa case : la cocher fige tous les tours, que le lancement refuse contre les cases', () => {
    assert.deepEqual(carteDuDepart(chargeDe(1), { id: 2, toursFiges: [1] }).cases, [{ tour: 1, coche: true }]);
  });

  test('dix tours, dix cases, chacune son libellé distinct', () => {
    const { cases } = carteDuDepart(chargeDe(10), { id: 3, toursFiges: [] });
    const libelles = cases.map(({ tour }) => t('generation.depart.tour', { tour }));
    assert.equal(new Set(libelles).size, 10);
    assert.equal(libelles[9], 'Tour 10');
  });
});

describe('l’issue d’une génération dérivée', () => {
  test('toutes les dérivées égales à leur départ : « n’avait rien à reprendre », sans comparaison', () => {
    const issue = issueDerivee(tableDe([4, 1]), rendu({ ajoutees: [], identiques: 3, identiquesAuDepart: 3 }));
    assert.deepEqual(issue, { cle: 'generation.issue.departSansReprise', details: { depart: 4 }, comparer: null, avertissements: [] });
    assert.equal(texte(issue), "La proposition n° 4 n'avait rien à reprendre sous ces réglages : ses propositions dérivées l'égalent toutes, et sont écartées.");
  });

  test('toutes écartées, une seule égale à une autre proposition : l’issue d’une génération ordinaire, jamais « rien à reprendre »', () => {
    for (const [identiques, identiquesAuDepart] of [[3, 2], [1, 0]]) {
      const issue = issueDerivee(tableDe([4, 1]), rendu({ ajoutees: [], identiques, identiquesAuDepart }));
      assert.deepEqual(issue, { cle: 'generation.issue.ajoutees', details: { ajoutees: 0, identiques }, comparer: null, avertissements: [] });
      assert.doesNotMatch(texte(issue), /reprendre/);
    }
  });

  test('cinq dérivées : la meilleure au classement et sa place, la place du départ, les identiques écartées, et la paire à comparer', () => {
    // Le classement range n° 7, puis n° 23, puis le départ n° 4.
    const table = tableDe([7, 23, 4, 21, 1, 25, 22, 24]);
    const issue = issueDerivee(table, rendu({ ajoutees: [21, 22, 23, 24, 25], identiques: 1, identiquesAuDepart: 1 }));
    assert.deepEqual(issue, {
      cle: 'generation.issue.derivee',
      details: { ajoutees: 5, premier: 21, dernier: 25, depart: 4, meilleure: 23, placeMeilleure: 2, placeDepart: 3, identiques: 1, departEnDerive: false },
      comparer: { a: 23, depart: 4 },
      avertissements: [],
    });
    assert.equal(
      texte(issue),
      '5 propositions dérivées de n° 4 (n° 21 à 25) ; la meilleure, n° 23, est 2\u{1D49} du classement ; n° 4 est 3\u{1D49} ; ' +
        '1 placement identique à une proposition présente, écarté.',
    );
    assert.equal(t('generation.commande.comparerIssue', issue.comparer), 'Comparer n° 23 à n° 4');
  });

  test('une seule dérivée, première du classement : « elle est première », le départ derrière', () => {
    const issue = issueDerivee(tableDe([21, 4]), rendu({ ajoutees: [21] }));
    assert.deepEqual(issue.details, {
      ajoutees: 1,
      premier: 21,
      dernier: 21,
      depart: 4,
      meilleure: 21,
      placeMeilleure: 1,
      placeDepart: 2,
      identiques: 0,
      departEnDerive: false,
    });
    assert.equal(texte(issue), '1 proposition dérivée de n° 4 (n° 21) ; elle est 1\u{02B3}\u{1D49} du classement ; n° 4 est 2\u{1D49}.');
    assert.deepEqual(issue.comparer, { a: 21, depart: 4 });
  });

  test('le départ devant toutes ses dérivées : il est premier, la meilleure dérivée la suit', () => {
    const issue = issueDerivee(tableDe([4, 9, 8]), rendu({ ajoutees: [8, 9] }));
    assert.deepEqual([issue.details.meilleure, issue.details.placeMeilleure, issue.details.placeDepart], [9, 2, 1]);
    assert.match(texte(issue), /la meilleure, n° 9, est 2\u{1D49} du classement ; n° 4 est 1\u{02B3}\u{1D49}\.$/u);
  });

  test('le départ hors du classement — effacé entre-temps : aucune place pour lui, rien à comparer', () => {
    const issue = issueDerivee(tableDe([22, 21]), rendu({ ajoutees: [21, 22] }));
    assert.deepEqual([issue.details.meilleure, issue.details.placeMeilleure, issue.details.placeDepart, issue.comparer], [22, 1, null, null]);
    assert.equal(texte(issue), '2 propositions dérivées de n° 4 (n° 21 à 22) ; la meilleure, n° 22, est 1\u{02B3}\u{1D49} du classement.');
  });

  test('aucune dérivée classée : la place du départ seule, dite « du classement », rien à comparer', () => {
    const issue = issueDerivee(tableDe([4]), rendu({ ajoutees: [30] }));
    assert.deepEqual([issue.details.meilleure, issue.details.placeMeilleure, issue.details.placeDepart, issue.comparer], [null, null, 1, null]);
    assert.equal(texte(issue), '1 proposition dérivée de n° 4 (n° 30) ; n° 4 est 1\u{02B3}\u{1D49} du classement.');
  });

  test('sans table d’évaluation — une configuration que la mesure refuse : les propositions seules', () => {
    const issue = issueDerivee(null, rendu({ ajoutees: [21, 22] }));
    assert.deepEqual([issue.details.meilleure, issue.details.placeMeilleure, issue.details.placeDepart, issue.comparer], [null, null, null, null]);
    assert.equal(texte(issue), '2 propositions dérivées de n° 4 (n° 21 à 22).');
  });

  test('une génération ordinaire garde l’issue de toujours', () => {
    const ordinaire = { ajoutees: [6, 7], identiques: 1, identiquesAuDepart: 0, dureeMs: 0, depart: null, departEnDerive: false, ecarts: [], avertissements: [] };
    const issue = issueDerivee(tableDe([7, 6]), ordinaire);
    assert.deepEqual(issue, { cle: 'generation.issue.ajoutees', details: { ajoutees: 2, identiques: 1 }, comparer: null, avertissements: [] });
    assert.equal(texte(issue), '2 propositions ajoutées ; 1 placement identique à une proposition présente, écarté.');
  });

  test('la meilleure dérivée est la première que le classement range, quel que soit l’ordre de ses identifiants', () => {
    for (const ordre of [[25, 21, 4], [21, 25, 4], [4, 23, 21]]) {
      const issue = issueDerivee(tableDe(ordre), rendu({ ajoutees: [21, 23, 25] }));
      assert.equal(issue.details.meilleure, ordre.find((id) => id !== 4), JSON.stringify(ordre));
    }
  });

  test('le module ne trie rien : les places se lisent dans l’ordre du classement de la table', () => {
    const source = readFileSync(new URL('./depart.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\.sort\(|toSorted\(|\.reverse\(/);
  });
});

// --- Les écarts du départ à la soirée ------------------------------------------------

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;

// Six personnes inventées, deux tables de quatre places, trois tours, et la
// proposition n° 1 écrite à la main : la table 1 pleine au tour 1.
function chargeEcarts() {
  const charge = creerCharge({ id: 'evt-ecarts', nom: 'Cercle des Loriots', siegesParDefaut: 4, tours: 3 });
  const noms = [['Ombrelle', 'Iris'], ['Pervenche', 'Théo'], ['Lacasse', 'Ondine'], ['Grisaille', 'Basile'], ['Bruyère', 'Anouk'], ['Sarcelle', 'Capucine']];
  charge.participants = noms.map(([nom, prenom], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance: null,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  const tours = [
    [[1, 2, 3, 4], [5, 6]],
    [[1, 4, 5], [2, 3, 6]],
    [[1, 5, 6], [2, 3, 4]],
  ];
  charge.propositions = [
    {
      id: 1,
      graine: 1,
      arret: 40,
      historique: 1000,
      produitVersion: VERSION.affichee,
      siegesAttribues: false,
      tables: [1, 2],
      capacites: [4, 4],
      tours: 3,
      participants: [1, 2, 3, 4, 5, 6],
      placement: tours.map((sieges) => ({ sieges, reserve: [] })),
    },
  ];
  charge.prochainsIds = { participant: 7, table: 3, proposition: 2 };
  charge.evenement.etat = 'propose';
  return charge;
}

// La soirée changée depuis la proposition n° 1 : Théo Pervenche (2) présente
// au seul tour 1 ; Capucine Sarcelle (6) exclue ; Anouk Bruyère (5)
// supprimée ; deux ajoutées, présentes à tous les tours — Aubépine
// Quenouillard (7), libre, et Gaspard Fenouillet (8), réservée à la table 1.
function soireeChangee() {
  let charge = executer(chargeEcarts(), 'changerPresence', { id: 2, tours: [1] });
  charge = executer(charge, 'exclureParticipant', { id: 6 });
  charge = executer(charge, 'supprimerParticipant', { id: 5 });
  charge = executer(charge, 'ajouterParticipant', { champs: { nom: 'Quenouillard', prenom: 'Aubépine' } });
  charge = executer(charge, 'ajouterParticipant', { champs: { nom: 'Fenouillet', prenom: 'Gaspard' } });
  return executer(charge, 'reserver', { participant: 8, table: 1, portee: 'tous' });
}

// Le texte d'une ligne d'écart : le nom, puis chaque morceau.
const ligneEcrite = ({ nom, morceaux }) => `${t(nom.cle, nom.details)}${morceaux.map(({ cle, details }) => t(cle, details)).join('')}`;

describe('la carte du départ : les écarts du départ à la soirée, avant le lancement', () => {
  test('une ligne par personne qui en a, dans l’ordre d’ecartsDuDepart : retirée, assise à la meilleure chaise libre d’un tour figé, en réserve imposée, à asseoir', () => {
    const charge = soireeChangee();
    const depart = { id: 1, toursFiges: [1] };
    const carte = carteDuDepart(charge, depart);
    const ecarts = ecartsDuDepart(charge, depart);
    assert.deepEqual(carte.ecarts.map(({ participant }) => participant), ecarts.map(({ participant }) => participant));
    assert.deepEqual(carte.ecarts.map(({ participant }) => participant), [2, 5, 6, 7, 8]);
    assert.deepEqual(carte.ecarts.map(ligneEcrite), [
      'Théo Pervenche — retirée des tours 2 et 3',
      'La personne n° 5, supprimée — retirée des tours 1 à 3 ; ses rencontres du tour 1, figé, ne comptent plus',
      'Capucine Sarcelle — retirée des tours 1 à 3 ; ses rencontres du tour 1, figé, ne comptent plus',
      'Aubépine Quenouillard — assise à la meilleure chaise libre du tour 1, figé — à asseoir aux tours 2 et 3',
      "Gaspard Fenouillet — en réserve au tour 1, figé : sa table n'a plus de chaise libre — à asseoir aux tours 2 et 3",
    ]);
    assert.equal(t('generation.depart.ecarts', { depart: 1 }), 'Depuis n° 1 :');
    assert.deepEqual(carte.ecarts[3].nom, { cle: 'generation.depart.personne', details: { personne: 'Aubépine Quenouillard', participant: 7 } });
  });

  test('sans tour figé : l’absente et l’exclue sont retirées sans rien dire de leurs rencontres, les ajoutées sont à asseoir à chaque tour', () => {
    const carte = carteDuDepart(soireeChangee(), { id: 1, toursFiges: [] });
    assert.deepEqual(carte.ecarts.map(ligneEcrite), [
      'Théo Pervenche — retirée des tours 2 et 3',
      'La personne n° 5, supprimée — retirée des tours 1 à 3',
      'Capucine Sarcelle — retirée des tours 1 à 3',
      'Aubépine Quenouillard — à asseoir aux tours 1 à 3',
      'Gaspard Fenouillet — à asseoir aux tours 1 à 3',
    ]);
  });

  test('une absente retirée d’un tour figé ne dit rien de ses rencontres : sa présence se règle d’elle-même ; deux tours figés s’accordent au pluriel', () => {
    let charge = executer(chargeEcarts(), 'changerPresence', { id: 1, tours: [3] });
    charge = executer(charge, 'ajouterParticipant', { champs: { nom: 'Quenouillard', prenom: 'Aubépine' } });
    const carte = carteDuDepart(charge, { id: 1, toursFiges: [1, 2] });
    assert.deepEqual(carte.ecarts.map(ligneEcrite), [
      'Iris Ombrelle — retirée des tours 1 et 2',
      'Aubépine Quenouillard — assise à la meilleure chaise libre des tours 1 et 2, figés — à asseoir au tour 3',
    ]);
  });

  test('sous sièges attribués, une arrivante au siège réservé pris : « son siège réservé est pris »', () => {
    assert.equal(
      t('generation.depart.enReserveFige', { tour: 2, cause: 'siege' }),
      ' — en réserve au tour 2, figé : son siège réservé est pris',
    );
    assert.equal(t('generation.depart.enReserveFige', { tour: 1, cause: 'table' }), " — en réserve au tour 1, figé : sa table n'a plus de chaise libre");
  });

  test('un départ comparable, absent, ou en dérive par le mobilier n’a aucun écart', () => {
    const charge = chargeEcarts();
    assert.deepEqual(carteDuDepart(charge, { id: 1, toursFiges: [1] }).ecarts, []);
    assert.deepEqual(carteDuDepart(charge, { id: 9, toursFiges: [] }).ecarts, []);
    const meublee = executer(executer(charge, 'changerPresence', { id: 2, tours: [1] }), 'changerPlacesTable', { id: 2, sieges: '5', origine: 'champ' });
    assert.deepEqual(carteDuDepart(meublee, { id: 1, toursFiges: [] }).ecarts, []);
  });

  test('la retouche du retenu à un tour figé : la phrase de DEPART_ECART_AU_RETENU, seulement sous le départ d’où vient le retenu et ce tour figé', () => {
    let charge = executer(chargeEcarts(), 'retenirProposition', { id: 1 });
    charge = executer(charge, 'echangerDansRetenu', { tour: 1, a: 1, b: 5 });
    const carte = carteDuDepart(charge, { id: 1, toursFiges: [1] });
    assert.deepEqual(ecartAuRetenu(charge, { id: 1, toursFiges: [1] }), [1]);
    assert.deepEqual(carte.ecartRetenu, { cle: 'DEPART_ECART_AU_RETENU', details: { depart: 1, tours: [1] } });
    assert.equal(
      t(carte.ecartRetenu.cle, carte.ecartRetenu.details),
      "Le tour figé 1 vient de la proposition n° 1 : les retouches du placement retenu à ce tour n'y sont pas.",
    );
    assert.equal(carteDuDepart(charge, { id: 1, toursFiges: [2] }).ecartRetenu, null);
    assert.equal(carteDuDepart(charge, { id: 1, toursFiges: [] }).ecartRetenu, null);
    // Un retenu seulement ajusté à la présence ne la porte pas.
    const ajuste = executer(executer(chargeEcarts(), 'retenirProposition', { id: 1 }), 'changerPresence', { id: 2, tours: [1] });
    assert.equal(carteDuDepart(ajuste, { id: 1, toursFiges: [1] }).ecartRetenu, null);
  });
});

describe('l’issue d’une dérivée partie d’un départ en dérive, et ses avertissements', () => {
  test('le départ en dérive par ses participants n’a pas de place : « n° 4, en dérive, n’est pas classée »', () => {
    const issue = issueDerivee(tableDe([22, 21]), rendu({ ajoutees: [21, 22], departEnDerive: true }));
    assert.deepEqual(issue.details, {
      ajoutees: 2,
      premier: 21,
      dernier: 22,
      depart: 4,
      meilleure: 22,
      placeMeilleure: 1,
      placeDepart: null,
      identiques: 0,
      departEnDerive: true,
    });
    assert.equal(issue.comparer, null);
    assert.equal(
      texte(issue),
      "2 propositions dérivées de n° 4 (n° 21 à 22) ; la meilleure, n° 22, est 1\u{02B3}\u{1D49} du classement ; n° 4, en dérive, n'est pas classée.",
    );
    const seule = issueDerivee(tableDe([]), rendu({ ajoutees: [30], departEnDerive: true }));
    assert.equal(texte(seule), "1 proposition dérivée de n° 4 (n° 30) ; n° 4, en dérive, n'est pas classée.");
  });

  test('les avertissements de la génération suivent l’issue, chacun par son code et ses détails', () => {
    const avertissement = { code: 'DEPART_ECART_AU_RETENU', details: { depart: 4, tours: [1, 2] } };
    const issue = issueDerivee(tableDe([21, 4]), rendu({ ajoutees: [21], avertissements: [avertissement] }));
    assert.deepEqual(issue.avertissements, [{ cle: 'DEPART_ECART_AU_RETENU', details: { depart: 4, tours: [1, 2] } }]);
    assert.equal(
      t(issue.avertissements[0].cle, issue.avertissements[0].details),
      "Les tours figés 1 et 2 viennent de la proposition n° 4 : les retouches du placement retenu à ces tours n'y sont pas.",
    );
    const sansReprise = issueDerivee(tableDe([4]), rendu({ ajoutees: [], identiques: 2, identiquesAuDepart: 2, avertissements: [avertissement] }));
    assert.equal(sansReprise.avertissements.length, 1);
  });
});
