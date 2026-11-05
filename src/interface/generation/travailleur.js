// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le point d'entrée du travailleur de génération (§ 5.10) : un module qui
// s'exécute dans la portée du travailleur, self, et la branche sur la
// recherche du moteur par brancherTravailleur, puis sur les résumés de la
// liste par brancherTravailleurApercu (§ 8.1), qui lui laisse les messages
// de la recherche. src/main.js seul l'importe, par « ?worker&inline » : Vite
// l'inclut dans la page, une seule fois pour les deux usages, et la
// coquille, qui charge la page par file://, n'a aucun fichier de
// travailleur à charger. Les exécuteurs qui lui parlent sont ceux
// d'executeur_travailleur.js et d'executeur_apercu.js, chacun sur ses
// propres instances.
import { brancherTravailleurApercu } from '../../application/executeur_apercu.js';
import { brancherTravailleur } from '../../application/generation_travailleur.js';

brancherTravailleur(self);
brancherTravailleurApercu(self);
