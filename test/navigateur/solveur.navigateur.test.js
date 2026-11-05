// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le vrai travailleur du solveur dans Chromium (§ 5.6, § 5.10) : l'exécuteur
// du solveur sur le travailleur que src/main.js charge, servi en http par le
// serveur de Vite des épreuves, et le module WebAssembly de HiGHS par
// highs/runtime?url (test/navigateur/solveur.js). Le protocole de bout en
// bout : chaque tour résolu, la fin, une faute de chargement, et la
// supersession, qui termine le travailleur. Le filet ne se déclenche jamais
// ici : l'horloge pilotée n'avance pas seule. Les noms d'épreuve sont
// inventés.
import { afterEach, describe, expect, test } from 'vitest';
import { creerHorlogePilotee } from '../../src/application/horloge.js';
import { assemblerPlanchers, entreesDuSolveur } from '../../src/application/planchers_exacts.js';
import { creerExecuteurSolveur } from '../../src/interface/diagnostic/executeur_solveur.js';
import { creerCharge } from '../../src/stockage/document.js';
import { chargerSolveurReel } from './solveur.js';

const MERLES = 'Club des Merles';
const HERONS = 'Cercle des Hérons';

// Vingt membres du Club, qui nomme le Cercle, treize membres ; tables de
// capacités données ; tours tours.
function chargeEtoile({ capacites, tours }) {
  const charge = creerCharge({ id: 'evt-solveur', nom: 'Soirée des Grèbes', siegesParDefaut: 8, tours });
  charge.participants = [...Array(20).fill(MERLES), ...Array(13).fill(HERONS)].map((organisation, rang) => ({
    id: rang + 1,
    nom: `Grèbe${rang + 1}`,
    prenom: 'Iris',
    organisation,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.participants[0].conflits = [HERONS];
  charge.tables = capacites.map((sieges, t) => ({ id: t + 1, numero: t + 1, sieges, forme: 'ronde', position: { x: 300 * t, y: 0 } }));
  charge.prochainsIds = { participant: 34, table: capacites.length + 1, proposition: 1 };
  return charge;
}

let executeurs = [];
afterEach(() => {
  for (const executeur of executeurs) executeur.terminer();
  executeurs = [];
});

async function executeur({ urlWasm } = {}) {
  const { fabrique, urlWasm: reelle } = await chargerSolveurReel();
  const neuf = creerExecuteurSolveur(fabrique, { urlWasm: urlWasm ?? reelle, horloge: creerHorlogePilotee() });
  executeurs.push(neuf);
  return neuf;
}

describe('le travailleur du solveur (§ 5.6, § 5.10)', () => {
  test('l’étoile 20 contre 13 sur 22 tables de 8 : 11 par tour, chaque tour annoncé dans l’ordre, 44 en tout', async () => {
    const { tours } = entreesDuSolveur(chargeEtoile({ capacites: Array(22).fill(8), tours: 4 }));
    const vus = [];
    const issues = await (await executeur()).resoudre(tours, { surTour: (faits) => vus.push(faits) });
    expect(vus).toEqual([1, 2, 3, 4]);
    expect(issues.map(({ minimum }) => minimum)).toEqual([11, 11, 11, 11]);
    // Quatre tours identiques : une seule résolution, les autres du cache.
    expect(issues.map(({ cache }) => cache)).toEqual([false, true, true, true]);
    const exacts = assemblerPlanchers(tours, issues);
    expect([exacts.sansConflit, exacts.plancherCumulees, exacts.exact]).toEqual([true, 44, true]);
  }, 60_000);

  test('le même conflit sur des tables de 11, 11, 6 et 5 places : aucun placement sans conflit', async () => {
    const { tours } = entreesDuSolveur(chargeEtoile({ capacites: [11, 11, 6, 5], tours: 1 }));
    const issues = await (await executeur()).resoudre(tours);
    expect(issues[0].faisable).toBe(false);
    expect(assemblerPlanchers(tours, issues).toursSansIssue).toEqual([1]);
  }, 60_000);

  test('une adresse du wasm fausse : le calcul rejette par une faute de chargement', async () => {
    const { tours } = entreesDuSolveur(chargeEtoile({ capacites: Array(22).fill(8), tours: 1 }));
    const fautif = await executeur({ urlWasm: '/introuvable/highs.wasm' });
    await expect(fautif.resoudre(tours)).rejects.toMatchObject({ etape: 'chargement' });
  }, 60_000);

  test('deux demandes rapides : la première rejette par une AbortError, la seconde répond', async () => {
    const { tours } = entreesDuSolveur(chargeEtoile({ capacites: Array(22).fill(8), tours: 2 }));
    const solveur = await executeur();
    const premiere = solveur.resoudre(tours);
    const seconde = solveur.resoudre(tours.slice(0, 1));
    await expect(premiere).rejects.toMatchObject({ name: 'AbortError' });
    expect((await seconde).map(({ minimum }) => minimum)).toEqual([11]);
  }, 60_000);
});
