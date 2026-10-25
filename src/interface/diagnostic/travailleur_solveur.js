// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le point d'entrée du travailleur du solveur (§ 5.6, § 5.10) : un module
// qui s'exécute dans la portée du travailleur, self, et la branche sur la
// résolution des tours par brancherTravailleurSolveur
// (solveur_travailleur.js, seul module de src/ qui importe highs). Il
// n'importe que l'application : la couche interface ne charge aucun paquet
// hors de Svelte.
//
// Un travailleur à part de celui de la génération : la résolution d'un tour
// est synchrone et retiendrait les messages des résumés de la liste, et
// highs alourdirait le point d'entrée de la page. src/main.js seul l'importe,
// par un import différé de « ?worker&inline » : le travailleur forme un
// morceau que la page ne télécharge qu'au premier calcul du plancher exact,
// et son module WebAssembly reste un actif à part, dont src/main.js donne
// l'adresse à chaque calcul (executeur_solveur.js).
import { brancherTravailleurSolveur } from '../../application/solveur_travailleur.js';

brancherTravailleurSolveur(self);
