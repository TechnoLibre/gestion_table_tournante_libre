// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le point d'entrée du travailleur de génération (§ 5.10) : un module qui
// s'exécute dans la portée du travailleur, self, et la branche sur la
// recherche du moteur par brancherTravailleur. src/main.js seul l'importe,
// par « ?worker&inline » : Vite l'inclut dans la page, et la coquille, qui
// charge la page par file://, n'a aucun fichier de travailleur à charger.
// L'exécuteur qui lui parle est celui d'executeur_travailleur.js.
import { brancherTravailleur } from '../../application/generation_travailleur.js';

brancherTravailleur(self);
