// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'avertissement LISTE_SUR_VOISINE dans un vrai moteur de rendu (§ 7.1,
// § 7.4, § 9) : une table agrandie dont la liste de noms passe sur sa
// voisine. Sur une charge construite — deux rondes de 8 posées par
// creerTable, la table 1 portée à 16 places par le champ de la section des
// tables —, l'avertissement paraît dans les annonces de l'événement, nomme
// la voisine par son numéro, et son remède déplace la voisine sur la case
// libre que la commande a choisie, par deplacerTable. App est montée par
// ouvrirEvenement (test/navigateur/ecrans.js), sur le système de fichiers
// simulé, au cadre de 1 366 × 700 ; le texte attendu vient de la même
// traduction que celle de l'application.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { appliquerCommande } from '../../application/commandes.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { creerCharge } from '../../stockage/document.js';
import { fixerCadre, touche } from '../../../test/navigateur/entrees.js';
import { attendre, cliquer, creerContexte, ouvrirEvenement } from '../../../test/navigateur/ecrans.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { avertissementsOrdonnes } from './modele.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Images attendues au plus par étape : bien au-delà d'une écriture simulée
// et de son rendu, et sous le délai d'une épreuve, pour qu'une étape qui ne
// vient pas se nomme.
const IMAGES = 300;

// Deux rondes de 8, la table 1 en (0, 0), la table 2 en (813, 0) : la
// grille de creerTable les écarte de la largeur d'un bloc de noms à 8
// places, que la table 1 à 16 places dépasse.
function chargeVoisines() {
  let charge = creerCharge({ id: 'epreuve-voisines', nom: 'Club des Merles', siegesParDefaut: 8, tours: 2 });
  for (let i = 0; i < 2; i += 1) charge = appliquerCommande('creerTable', charge, { forme: 'ronde' }).charge;
  return charge;
}

let contexte = null;
beforeEach(async () => {
  await fixerCadre(1366, 700);
  contexte = creerContexte();
});
afterEach(async () => {
  const erreurs = contexte.erreurs();
  await contexte.defaire();
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

describe('LISTE_SUR_VOISINE : la liste d’une table agrandie passe sur sa voisine (§ 7.1, Q17)', () => {
  test('agrandie par son champ, la table 1 : l’avertissement paraît dans les annonces de l’événement, nomme la table 2, et son remède la déplace sur la case libre', async () => {
    const charge = chargeVoisines();
    expect(charge.tables.map(({ id, numero, position }) => [id, numero, position.x, position.y])).toEqual([
      [1, 1, 0, 0],
      [2, 2, 813, 0],
    ]);
    // Ce que la commande dit du même geste : un avertissement, la table 1
    // et sa voisine 2, et la case où le remède pose la voisine.
    const attendu = appliquerCommande('changerPlacesTable', charge, { id: 1, sieges: 16, origine: 'champ' }).avertissements;
    expect(attendu.map(({ code, details }) => [code, details.table, details.voisine, details.numeroVoisine])).toEqual([
      ['LISTE_SUR_VOISINE', 1, 2, 2],
    ]);
    const [{ details }] = attendu;
    expect(details.remede.commande).toBe('deplacerTable');
    const { position } = details.remede.arguments;
    expect(position).not.toEqual({ x: 813, y: 0 });

    const m = await ouvrirEvenement(contexte, charge, { ecriture: true, section: 'tables' });
    const champ = await attendre('le champ des places de la table 1', () => m.racine.querySelector('input[data-champ="sieges-1"]'), IMAGES);
    champ.focus();
    champ.select();
    for (const caractere of '16') await touche(caractere);
    await touche('Enter');
    await attendre('la table 1 à 16 places', () => m.seance.etat().charge.tables[0].sieges === 16, IMAGES);

    const annonce = await attendre(
      "l'avertissement dans les annonces de l'événement",
      () => m.racine.querySelector('[data-annonces] [data-avertissement="LISTE_SUR_VOISINE"]'),
      IMAGES,
    );
    // Les annonces montrent les avertissements de la séance, dans son ordre.
    const montres = [...m.racine.querySelectorAll('[data-annonces] [data-avertissement]')].map((element) => element.dataset.avertissement);
    expect(montres).toEqual(avertissementsOrdonnes(m.seance.etat()).map(({ code }) => code));
    expect(montres).toContain('LISTE_SUR_VOISINE');
    const texte = t('LISTE_SUR_VOISINE', details);
    expect(annonce.querySelector('p').textContent).toBe(texte);
    expect(texte).toContain('table 2');

    const remede = await attendre('le remède de l’avertissement', () => annonce.querySelector('[data-commande="deplacerTable"]'), IMAGES);
    expect(remede.textContent.trim()).toBe(t('communs.remede.deplacerTable', details.remede.arguments));
    await cliquer(m, '[data-annonces] [data-avertissement="LISTE_SUR_VOISINE"] [data-commande="deplacerTable"]');
    await attendre('la table 2 déplacée', () => m.seance.etat().charge.tables[1].position.x !== 813, IMAGES);
    const apres = m.seance.etat().charge;
    expect(apres.tables.map(({ id, position: { x, y } }) => [id, x, y])).toEqual([
      [1, 0, 0],
      [2, position.x, position.y],
    ]);
    expect(apres.tables[0].sieges).toBe(16);
  });
});
