// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le vrai solveur du plancher exact pour les épreuves du navigateur (§ 5.6,
// § 5.10) : chargerSolveurReel est le chargerSolveur de src/main.js, le
// travailleur du solveur importé en différé par « ?worker&inline » et
// l'adresse du module WebAssembly de HiGHS par highs/runtime?url. Sous le
// serveur de Vite des épreuves, le travailleur n'est pas incrusté : il est
// servi en http, et l'adresse du wasm est un chemin racine que ce
// travailleur résout ; seuls l'essai de démarrage et la construction voient
// le travailleur servi depuis blob:. Il vit sous test/ : la couche interface
// ne charge pas highs, et seul src/main.js le désigne parmi les modules
// livrés. Une épreuve le passe à monterApp (chargerSolveur) ou en fait
// elle-même un exécuteur.
import urlHighs from 'highs/runtime?url';

/** L'adresse du module WebAssembly de HiGHS, que le travailleur charge. */
export const URL_HIGHS = urlHighs;

/**
 * Le chargement du solveur, comme src/main.js le passe à App.
 *
 * @returns {Promise<{fabrique: () => Worker, urlWasm: string}>}
 */
export async function chargerSolveurReel() {
  const { default: TravailleurSolveur } = await import('../../src/interface/diagnostic/travailleur_solveur.js?worker&inline');
  return { fabrique: () => new TravailleurSolveur(), urlWasm: urlHighs };
}
