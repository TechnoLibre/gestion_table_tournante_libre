// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La graisse Bold de la police embarquée, un module par graisse : chacune
// devient son propre morceau différé, que chargerPolices (chargement.js)
// importe à la demande. « ?inline » rend sous Vite le fichier en URL data:,
// incrustée dans le morceau : la page la lit sans requête, sous file://
// comme sous http://.
export { default } from './NotoSans-Bold.ttf?inline';
