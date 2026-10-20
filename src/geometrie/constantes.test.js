// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du registre des constantes mesurées (§ 14.1, § 19.10) : les
// vingt et une entrées du contrat de données, chacune complète et de statut
// épinglé, la vérification qui nomme l'entrée et le champ d'une faute, et
// l'accord du registre avec le relevé committé du banc : le banc écrit un
// relevé, jamais le registre, et une constante du banc déclarée mesurée
// porte la valeur que le relevé propose, sur la configuration qu'il décrit.
// Quatre valeurs du relevé sont adoptées — le seuil de sièges lisibles, la
// tolérance de la chaîne témoin, et les deux seuils de la page de qualité,
// celui de la matrice et la largeur de troncature des noms — ; le
// ralentissement à pleine charge garde son défaut de travail : la machine de
// référence est le poste de développement, ρ à son défaut (Q13 b). Le seuil
// de la comparaison, une règle de forme, reste un défaut de travail que le
// banc ne relève pas.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { accordRegistre } from '../../scripts/banc/releve.js';
import releveCommite from '../../scripts/banc/releve.json' with { type: 'json' };
import { CONSTANTES, LONGUEUR_NOM_REFERENCE, constante, verifierRegistre } from './constantes.js';

// Le contrat de données : nom, valeur de départ, unité, propriétaire,
// statut.
const CONTRAT = [
  ['SEUIL_GLISSER_PX', 4, 'px', 'manuel', 'defautDeTravail'],
  ['DUREE_PRESSION_LONGUE_MS', 500, 'ms', 'manuel', 'defautDeTravail'],
  ['SEUIL_SIEGES_LISIBLES', 18, 'places', 'banc', 'mesuree'],
  ['K_LISTES', 0.3, 'px/cm', 'manuel', 'defautDeTravail'],
  ['LARGEUR_BLOC_NOMS_CM', 500, 'cm', 'manuel', 'defautDeTravail'],
  ['HAUTEUR_LIGNE', null, 'cm', 'execution', 'mesuree'],
  ['ZONE_SILENCE_MM', 8, 'mm', 'manuel', 'defautDeTravail'],
  ['HAUTEUR_CAPITALE_NOM_MAX_MM', 9, 'mm', 'manuel', 'defautDeTravail'],
  ['HAUTEUR_CAPITALE_NOM_PLANCHER_MM', 4, 'mm', 'manuel', 'defautDeTravail'],
  ['CORPS_TOURS_PT', 14, 'pt', 'manuel', 'defautDeTravail'],
  ['CORPS_TOURS_PLANCHER_PT', 10, 'pt', 'manuel', 'defautDeTravail'],
  ['CORPS_ORGANISATION_PT', 12, 'pt', 'manuel', 'defautDeTravail'],
  ['CORPS_PIED_PT', 8, 'pt', 'manuel', 'defautDeTravail'],
  ['CORPS_MIN_IMPRESSION_MM', 2.5, 'mm', 'manuel', 'defautDeTravail'],
  ['MARGE_PAGE_MM', 10, 'mm', 'manuel', 'defautDeTravail'],
  ['HAUTEUR_BANDE_IMPRESSION', null, 'mm', 'execution', 'mesuree'],
  ['TOLERANCE_CHAINE_TEMOIN', 0.011, 'rapport', 'banc', 'mesuree'],
  ['RALENTISSEMENT_PLEINE_CHARGE', 2, '×', 'banc', 'defautDeTravail'],
  ['SEUIL_MATRICE_PARTICIPANTS', 44, 'participants', 'banc', 'mesuree'],
  ['LARGEUR_TRONCATURE_NOM_PX', 168, 'px', 'banc', 'mesuree'],
  ['VALEURS_MANQUE_COURBE', 3, 'valeurs', 'manuel', 'defautDeTravail'],
];

// Les constantes du banc dont le registre a adopté la valeur relevée.
const ADOPTEES = ['SEUIL_SIEGES_LISIBLES', 'TOLERANCE_CHAINE_TEMOIN', 'SEUIL_MATRICE_PARTICIPANTS', 'LARGEUR_TRONCATURE_NOM_PX'];

// Une copie du registre, entrée par entrée, que l'épreuve peut altérer.
const copie = () => CONSTANTES.map((entree) => ({ ...entree }));

describe('constantes : le registre (§ 14.1, § 19.10)', () => {
  test('le registre porte les vingt et une entrées du contrat, dans son ordre, chacune complète', () => {
    assert.equal(CONSTANTES.length, 21);
    assert.deepEqual(
      CONSTANTES.map(({ nom, valeur, unite, proprietaire, statut }) => [nom, valeur, unite, proprietaire, statut]),
      CONTRAT,
    );
    assert.deepEqual(verifierRegistre(CONSTANTES), []);
    for (const entree of CONSTANTES) {
      assert.ok(entree.protocole.length > 0 && entree.mesure.length > 0 && entree.raison.length > 0, entree.nom);
    }
  });

  test('tant que son propriétaire ne l\'a pas relevée, une constante se déclare défaut de travail ; une constante relevée à l\'exécution, ou adoptée du relevé, est mesurée', () => {
    for (const { nom, proprietaire, statut } of CONSTANTES) {
      const mesuree = proprietaire === 'execution' || ADOPTEES.includes(nom);
      assert.equal(statut, mesuree ? 'mesuree' : 'defautDeTravail', nom);
    }
  });

  test('la zone de silence dit ses deux bornes, et K_LISTES est un seuil de lisibilité relu à la main', () => {
    const entree = (nom) => CONSTANTES.find((c) => c.nom === nom);
    assert.match(entree('ZONE_SILENCE_MM').raison, /bord de coupe/);
    assert.match(entree('ZONE_SILENCE_MM').raison, /bord de feuille/);
    assert.match(entree('K_LISTES').protocole, /n'a pas écrit le logiciel/);
    assert.match(entree('TOLERANCE_CHAINE_TEMOIN').protocole, /repli/);
  });

  test('les deux seuils de la page de qualité sont adoptés du banc, protocole écrit (B29) ; la troncature se cale sur une longueur de nom écrite ici', () => {
    const entree = (nom) => CONSTANTES.find((c) => c.nom === nom);
    const matrice = entree('SEUIL_MATRICE_PARTICIPANTS');
    assert.match(matrice.mesure, /24 px/);
    assert.match(matrice.protocole, /cadre de 1 366 × 700 px/);
    assert.match(matrice.raison, /fiche/);
    const troncature = entree('LARGEUR_TRONCATURE_NOM_PX');
    assert.ok(Number.isInteger(LONGUEUR_NOM_REFERENCE) && LONGUEUR_NOM_REFERENCE > 0);
    assert.ok(troncature.protocole.includes(`nom de ${LONGUEUR_NOM_REFERENCE} caractères`), troncature.protocole);
    assert.match(troncature.protocole, /glyphe le plus large/);
    // Jamais les noms d'une démonstration, que sa régénération change.
    assert.match(troncature.protocole, /jamais un nom de démonstration/);
    // Le banc les relève ; le registre les déclare mesurés, sur la
    // configuration du relevé non ralenti, ce que l'accord avec le relevé
    // committé éprouve à son tour.
    for (const seuil of [matrice, troncature]) {
      assert.equal(seuil.proprietaire, 'banc', seuil.nom);
      assert.equal(seuil.statut, 'mesuree', seuil.nom);
      assert.match(seuil.configuration, /processeur non ralenti, police Noto Sans/, seuil.nom);
    }
  });

  test('le seuil de la comparaison est une règle de forme du § 12.6, au défaut de travail, que le banc ne relève pas (C28, D62)', () => {
    const entree = CONSTANTES.find((c) => c.nom === 'VALEURS_MANQUE_COURBE');
    assert.equal(constante('VALEURS_MANQUE_COURBE'), 3);
    assert.equal(entree.statut, 'defautDeTravail');
    assert.equal(entree.raison, "règle de forme du § 12.6 : une ou deux valeurs se disent mieux qu'elles ne se tracent");
    assert.notEqual(entree.proprietaire, 'banc');
    assert.match(entree.mesure, /deux profils/);
    assert.match(entree.protocole, /le banc ne la relève pas/);
    // Le relevé committé ne la porte pas : aucune garde du banc ne la juge.
    assert.equal(releveCommite.mesures.find((m) => m.nom === 'VALEURS_MANQUE_COURBE'), undefined);
  });

  test('constante rend la valeur par le nom ; un nom inconnu lève', () => {
    assert.equal(constante('SEUIL_GLISSER_PX'), 4);
    assert.equal(constante('K_LISTES'), 0.3);
    assert.equal(constante('LARGEUR_BLOC_NOMS_CM'), 500);
    assert.equal(constante('HAUTEUR_LIGNE'), null);
    assert.throws(() => constante('INCONNUE'), RangeError);
    assert.throws(() => constante('nom'), RangeError);
  });

  test('le registre et ses entrées sont figés', () => {
    assert.ok(Object.isFrozen(CONSTANTES));
    assert.ok(CONSTANTES.every((entree) => Object.isFrozen(entree)));
  });

  test("verifierRegistre nomme l'entrée et le champ d'une faute : propriétaire, configuration ou statut perdu", () => {
    for (const champ of ['proprietaire', 'configuration', 'statut']) {
      const liste = copie();
      delete liste[2][champ];
      assert.deepEqual(verifierRegistre(liste), [{ nom: 'SEUIL_SIEGES_LISIBLES', champ }], champ);
    }
    const vide = copie();
    vide[0].configuration = '';
    vide[4].proprietaire = 'personne';
    vide[1].statut = 'mesure';
    assert.deepEqual(verifierRegistre(vide), [
      { nom: 'SEUIL_GLISSER_PX', champ: 'configuration' },
      { nom: 'DUREE_PRESSION_LONGUE_MS', champ: 'statut' },
      { nom: 'LARGEUR_BLOC_NOMS_CM', champ: 'proprietaire' },
    ]);
  });

  test("verifierRegistre relève aussi une valeur absente hors de l'exécution, un texte vide, un nom répété", () => {
    const liste = copie();
    liste[0].valeur = null;
    liste[1].valeur = Number.NaN;
    liste[2].protocole = '';
    liste[3].unite = undefined;
    liste[4].mesure = 3;
    liste[5].raison = '';
    liste.push({ ...liste[3], unite: 'px/cm' });
    assert.deepEqual(verifierRegistre(liste), [
      { nom: 'SEUIL_GLISSER_PX', champ: 'valeur' },
      { nom: 'DUREE_PRESSION_LONGUE_MS', champ: 'valeur' },
      { nom: 'SEUIL_SIEGES_LISIBLES', champ: 'protocole' },
      { nom: 'K_LISTES', champ: 'unite' },
      { nom: 'LARGEUR_BLOC_NOMS_CM', champ: 'mesure' },
      { nom: 'HAUTEUR_LIGNE', champ: 'raison' },
      { nom: 'K_LISTES', champ: 'nom' },
    ]);
    assert.deepEqual(verifierRegistre([{ ...liste[0], nom: '', valeur: 4 }]), [{ nom: '', champ: 'nom' }]);
    // Une constante relevée à l'exécution n'a pas de valeur dans le registre :
    // un nombre y serait le relevé d'une autre machine.
    assert.deepEqual(verifierRegistre([{ ...CONSTANTES[5], valeur: 21.5 }]), [{ nom: 'HAUTEUR_LIGNE', champ: 'valeur' }]);
  });

  test("verifierRegistre refuse une constante relevée à l'exécution qui n'est pas mesurée (R6), et une constante sans protocole", () => {
    const execution = CONSTANTES.find((c) => c.nom === 'HAUTEUR_BANDE_IMPRESSION');
    assert.deepEqual(verifierRegistre([{ ...execution, statut: 'defautDeTravail' }]), [
      { nom: 'HAUTEUR_BANDE_IMPRESSION', champ: 'statut' },
    ]);
    assert.deepEqual(verifierRegistre([{ ...execution }]), []);
    const sansProtocole = { ...CONSTANTES[6] };
    delete sansProtocole.protocole;
    assert.deepEqual(verifierRegistre([sansProtocole]), [{ nom: 'ZONE_SILENCE_MM', champ: 'protocole' }]);
    assert.deepEqual(verifierRegistre([{ ...CONSTANTES[6], protocole: '' }]), [{ nom: 'ZONE_SILENCE_MM', champ: 'protocole' }]);
  });
});

describe('constantes : accord avec le relevé du banc (§ 19.10, § 14.1)', () => {
  test('chaque constante du banc déclarée mesurée porte la valeur du relevé committé et cite sa configuration', () => {
    assert.ok(CONSTANTES.some((c) => c.proprietaire === 'banc'), 'le registre ne porte aucune constante du banc');
    // L'accord n'examine que les constantes mesurées : sans elles, il serait
    // vert sans rien éprouver (§ 14.2).
    assert.deepEqual(
      CONSTANTES.filter((c) => c.proprietaire === 'banc' && c.statut === 'mesuree').map(({ nom }) => nom),
      ADOPTEES,
    );
    assert.deepEqual(accordRegistre(CONSTANTES, releveCommite), []);
  });

  test('une adoption porte la valeur proposée par le relevé, et sa configuration cite le cadre, le navigateur et la police du relevé', () => {
    for (const nom of ADOPTEES) {
      const entree = CONSTANTES.find((c) => c.nom === nom);
      const mesure = releveCommite.mesures.find((m) => m.nom === nom);
      assert.equal(entree.valeur, mesure.valeurProposee, nom);
      assert.ok(entree.configuration.includes(releveCommite.configuration.navigateur), nom);
      assert.ok(entree.configuration.includes(`police ${mesure.police}`), nom);
      assert.match(entree.configuration, /cadre de 1 366 × 700 px, facteur 1/, nom);
    }
    // Une valeur du registre qui s'écarte du relevé est une faute de l'accord.
    const ecartee = CONSTANTES.map((c) => (c.nom === 'SEUIL_SIEGES_LISIBLES' ? { ...c, valeur: 16 } : c));
    assert.deepEqual(accordRegistre(ecartee, releveCommite), [{ nom: 'SEUIL_SIEGES_LISIBLES', faute: 'valeur' }]);
  });

  test('le ralentissement à pleine charge garde sa valeur de départ, défaut de travail, quoi que le relevé propose (Q13 b)', () => {
    const entree = CONSTANTES.find((c) => c.nom === 'RALENTISSEMENT_PLEINE_CHARGE');
    assert.deepEqual([entree.valeur, entree.statut], [2, 'defautDeTravail']);
    assert.notEqual(releveCommite.mesures.find((m) => m.nom === 'RALENTISSEMENT_PLEINE_CHARGE').valeurProposee, entree.valeur);
  });
});
