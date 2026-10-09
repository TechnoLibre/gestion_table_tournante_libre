// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du registre des constantes mesurées (§ 14.1, § 19.10) : les
// dix-huit entrées du contrat de données, chacune complète et de statut
// épinglé, et la vérification qui nomme l'entrée et le champ d'une faute.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CONSTANTES, constante, verifierRegistre } from './constantes.js';

// Le contrat de données : nom, valeur de départ, unité, propriétaire,
// statut.
const CONTRAT = [
  ['SEUIL_GLISSER_PX', 4, 'px', 'manuel', 'defautDeTravail'],
  ['DUREE_PRESSION_LONGUE_MS', 500, 'ms', 'manuel', 'defautDeTravail'],
  ['SEUIL_SIEGES_LISIBLES', 16, 'places', 'banc', 'defautDeTravail'],
  ['K_LISTES', 0.3, 'px/cm', 'manuel', 'defautDeTravail'],
  ['LARGEUR_BLOC_NOMS_CM', 500, 'cm', 'manuel', 'defautDeTravail'],
  ['HAUTEUR_LIGNE', null, 'cm', 'execution', 'mesuree'],
  ['ZONE_SILENCE_MM', 8, 'mm', 'manuel', 'defautDeTravail'],
  ['HAUTEUR_CAPITALE_NOM_MAX_MM', 9, 'mm', 'manuel', 'defautDeTravail'],
  ['HAUTEUR_CAPITALE_NOM_PLANCHER_MM', 4, 'mm', 'manuel', 'defautDeTravail'],
  ['CORPS_TOURS_PT', 14, 'pt', 'manuel', 'defautDeTravail'],
  ['CORPS_TOURS_PLANCHER_PT', 10, 'pt', 'manuel', 'defautDeTravail'],
  ['CORPS_APPARTENANCE_PT', 12, 'pt', 'manuel', 'defautDeTravail'],
  ['CORPS_PIED_PT', 8, 'pt', 'manuel', 'defautDeTravail'],
  ['CORPS_MIN_IMPRESSION_MM', 2.5, 'mm', 'manuel', 'defautDeTravail'],
  ['MARGE_PAGE_MM', 10, 'mm', 'manuel', 'defautDeTravail'],
  ['HAUTEUR_BANDE_IMPRESSION', null, 'mm', 'execution', 'mesuree'],
  ['TOLERANCE_CHAINE_TEMOIN', 0.01, 'rapport', 'banc', 'defautDeTravail'],
  ['RALENTISSEMENT_PLEINE_CHARGE', 2, '×', 'banc', 'defautDeTravail'],
];

// Une copie du registre, entrée par entrée, que l'épreuve peut altérer.
const copie = () => CONSTANTES.map((entree) => ({ ...entree }));

describe('constantes : le registre (§ 14.1, § 19.10)', () => {
  test('le registre porte les dix-huit entrées du contrat, dans son ordre, chacune complète', () => {
    assert.equal(CONSTANTES.length, 18);
    assert.deepEqual(
      CONSTANTES.map(({ nom, valeur, unite, proprietaire, statut }) => [nom, valeur, unite, proprietaire, statut]),
      CONTRAT,
    );
    assert.deepEqual(verifierRegistre(CONSTANTES), []);
    for (const entree of CONSTANTES) {
      assert.ok(entree.protocole.length > 0 && entree.mesure.length > 0 && entree.raison.length > 0, entree.nom);
    }
  });

  test('tant que son propriétaire ne l\'a pas relevée, une constante se déclare défaut de travail ; une constante relevée à l\'exécution est mesurée', () => {
    for (const { nom, proprietaire, statut } of CONSTANTES) {
      assert.equal(statut, proprietaire === 'execution' ? 'mesuree' : 'defautDeTravail', nom);
    }
  });

  test('la zone de silence dit ses deux bornes, et K_LISTES est un seuil de lisibilité relu à la main', () => {
    const entree = (nom) => CONSTANTES.find((c) => c.nom === nom);
    assert.match(entree('ZONE_SILENCE_MM').raison, /bord de coupe/);
    assert.match(entree('ZONE_SILENCE_MM').raison, /bord de feuille/);
    assert.match(entree('K_LISTES').protocole, /n'a pas écrit le logiciel/);
    assert.match(entree('TOLERANCE_CHAINE_TEMOIN').protocole, /repli/);
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
