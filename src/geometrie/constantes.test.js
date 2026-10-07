// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du registre des constantes mesurées (§ 14.1, § 19.10) : les six
// entrées du contrat de données, chacune complète, et la vérification qui
// nomme l'entrée et le champ d'une faute.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CONSTANTES, constante, verifierRegistre } from './constantes.js';

// Le contrat de données : nom, valeur de départ, unité, propriétaire.
const CONTRAT = [
  ['SEUIL_GLISSER_PX', 4, 'px', 'manuel'],
  ['DUREE_PRESSION_LONGUE_MS', 500, 'ms', 'manuel'],
  ['SEUIL_SIEGES_LISIBLES', 16, 'places', 'banc'],
  ['K_LISTES', 0.3, 'px/cm', 'banc'],
  ['LARGEUR_BLOC_NOMS_CM', 500, 'cm', 'manuel'],
  ['HAUTEUR_LIGNE', null, 'cm', 'execution'],
];

// Une copie du registre, entrée par entrée, que l'épreuve peut altérer.
const copie = () => CONSTANTES.map((entree) => ({ ...entree }));

describe('constantes : le registre (§ 14.1, § 19.10)', () => {
  test('le registre porte les six entrées du contrat, dans son ordre, chacune complète', () => {
    assert.equal(CONSTANTES.length, 6);
    assert.deepEqual(
      CONSTANTES.map(({ nom, valeur, unite, proprietaire }) => [nom, valeur, unite, proprietaire]),
      CONTRAT,
    );
    assert.deepEqual(verifierRegistre(CONSTANTES), []);
    for (const entree of CONSTANTES) {
      assert.ok(entree.protocole.length > 0 && entree.mesure.length > 0 && entree.raison.length > 0, entree.nom);
    }
  });

  test('tant que son propriétaire ne l\'a pas relevée, une constante se déclare défaut de travail', () => {
    const statuts = CONSTANTES.map(({ nom, statut }) => [nom, statut]);
    assert.deepEqual(statuts.slice(0, 5), CONTRAT.slice(0, 5).map(([nom]) => [nom, 'defautDeTravail']));
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
});
