// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'aperçu avant impression sur des réglages locaux que la lecture ne prend
// pas, ou que le dossier de travail refuse d'écrire (§ 8.5, § 11.2, § 11.7) :
// la question du papier se pose, le choix vaut pour la séance sans que
// reglages_locaux.json le retienne, et l'aperçu rend son document, sur le
// papier choisi, et sa commande « Imprimer » au lieu de reposer la question.
// Rien ne s'écrit : ni le fichier illisible, ni l'événement ; sous un dossier
// qui refuse l'écriture, la seule tentative est celle des réglages.
//
// App est montée par test/navigateur/ecrans.js sur le système de fichiers
// simulé, au cadre de 1 366 × 700.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { PAPIERS } from '../../geometrie/papiers.js';
import { FICHIER_REGLAGES } from '../../stockage/reglages_locaux.js';
import { fixerCadre } from '../../../test/navigateur/entrees.js';
import { attendre, chargePrincipale, cliquer, creerContexte, ouvrirApercu } from '../../../test/navigateur/ecrans.js';
import { creerImprimanteSimulee } from '../../../test/imprimante_simulee.js';
import { MM_PAR_PX } from './modele.js';

// Images attendues au plus par étape, comme dans Apercu.navigateur.test.js.
const IMAGES = 300;

// Une feuille se mesure au dixième de millimètre (§ 11.7).
const TOLERANCE_MM = 0.1;

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

const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const feuilles = (m) => [...m.racine.querySelectorAll('[data-impression] [data-feuille]')];

// Des réglages que la lecture ne prend pas : un format plus récent qui porte
// un papier inconnu de cette construction, et un texte tronqué.
const ILLISIBLES = [
  ['FORME', '{"format":2,"papier":"Legal","cadrages":[]}'],
  ['JSON', '{"format":1,"papier":"A4","cadr'],
];

describe('des réglages locaux illisibles ne bloquent pas l’aperçu (§ 8.5, § 11.7)', () => {
  for (const [raison, texte] of ILLISIBLES) {
    test(`${raison} : le papier choisi, l’aperçu montre le document et « Imprimer » au lieu de la question ; le fichier intact, rien ne s’écrit`, async () => {
      const imprimante = creerImprimanteSimulee();
      const m = await ouvrirApercu(contexte, chargePrincipale(), {
        papier: null,
        options: { imprimante, fichiers: [{ racine: 'documents', chemin: FICHIER_REGLAGES, texte }] },
      });
      const octets = m.fs.octets('documents', FICHIER_REGLAGES);
      expect(dans(m, '[data-ecran="apercu"] [data-papier="question"]')).not.toBeNull();
      expect(dans(m, '[data-impression]')).toBeNull();
      const avant = m.trace.length;

      await cliquer(m, '[data-papier="question"] [data-cible="A4"] [data-commande="choisirPapier"]');
      await attendre('le document sur A4', () => feuilles(m).length > 0, IMAGES);
      expect(m.seance.etat().papier).toBe('A4');
      const boite = feuilles(m)[0].getBoundingClientRect();
      const dims = [boite.width * MM_PAR_PX, boite.height * MM_PAR_PX].sort((a, b) => a - b);
      expect(Math.abs(dims[0] - PAPIERS.A4.largeur)).toBeLessThanOrEqual(TOLERANCE_MM);
      expect(Math.abs(dims[1] - PAPIERS.A4.hauteur)).toBeLessThanOrEqual(TOLERANCE_MM);
      expect(dans(m, '[data-papier="question"]')).toBeNull();
      expect(dans(m, '[data-ecran="apercu"] [data-refus]')).toBeNull();
      const avis = m.seance.etat().avertissements.filter(({ code }) => code === 'REGLAGES_ILLISIBLES');
      expect(avis).toEqual([{ code: 'REGLAGES_ILLISIBLES', details: { chemin: FICHIER_REGLAGES, raison } }]);

      await cliquer(m, '[data-ecran="apercu"] [data-commande="imprimer"]');
      await attendre("l'impression demandée", () => imprimante.appels().length === 1, IMAGES);
      expect(imprimante.appels()[0].papier).toBe('A4');
      expect(m.trace.slice(avant)).toEqual([]);
      expect(m.fs.octets('documents', FICHIER_REGLAGES)).toEqual(octets);
    });
  }
});

describe('un dossier qui refuse l’écriture des réglages ne bloque pas l’aperçu (§ 8.5, § 11.7)', () => {
  test('EROFS : le papier choisi, l’aperçu montre le document et « Imprimer » ; un avis le dit, et rien ne s’écrit', async () => {
    const imprimante = creerImprimanteSimulee();
    const m = await ouvrirApercu(contexte, chargePrincipale(), { papier: null, options: { imprimante } });
    expect(dans(m, '[data-ecran="apercu"] [data-papier="question"]')).not.toBeNull();
    m.fs.pannes.ecriture('documents');
    const avant = m.trace.length;

    await cliquer(m, '[data-papier="question"] [data-cible="A4"] [data-commande="choisirPapier"]');
    await attendre('le document sur A4', () => feuilles(m).length > 0, IMAGES);
    expect(m.seance.etat().papier).toBe('A4');
    expect(dans(m, '[data-papier="question"]')).toBeNull();
    expect(dans(m, '[data-ecran="apercu"] [data-refus]')).toBeNull();
    const avis = m.seance.etat().avertissements.filter(({ code }) => code === 'REGLAGES_NON_ECRITS');
    expect(avis).toEqual([
      { code: 'REGLAGES_NON_ECRITS', details: { chemin: FICHIER_REGLAGES, dossier: expect.any(String), cause: 'EROFS' } },
    ]);

    await cliquer(m, '[data-ecran="apercu"] [data-commande="imprimer"]');
    await attendre("l'impression demandée", () => imprimante.appels().length === 1, IMAGES);
    expect(imprimante.appels()[0].papier).toBe('A4');
    expect(m.trace.slice(avant)).toEqual([['ecrireAtomique', 'documents', FICHIER_REGLAGES]]);
    expect(m.fs.contenu('documents', FICHIER_REGLAGES)).toBeNull();
  });
});
