// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les textes que le panneau « À propos » donne à lire, incrustés par « ?raw »
// dans le morceau différé que licences.js importe à la demande : les deux
// licences du logiciel, sous le nom de chacune dans LICENCES, que lit
// chargerTexteLicence, puis les avis des tiers et le texte de la licence de
// la police, que lit chargerComposantsTiers. Les fichiers restent sous
// public/, que la construction copie aussi tels quels : le serveur de
// développement le signale à chaque import, sans conséquence sur ce qu'il
// sert.
export { default as agpl } from '../../public/licences/AGPL-3.0-or-later.txt?raw';
export { default as liliq } from '../../public/licences/LiLiQ-Rplus-1.1.txt?raw';
export { default as tiers } from '../../public/licences/TIERS.txt?raw';
export { default as police } from '../../public/licences/NotoSans-OFL.txt?raw';
