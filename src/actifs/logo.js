// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le logo de TechnoLibre, marque de l'éditeur, que le panneau « À propos »
// affiche et offre au téléchargement (§ 18.6) : les fichiers
// full_logo_technolibre_2023.svg et .png de ce dossier, tels que TechnoLibre
// les fournit. chargerLogo les lit par un import() différé de
// donnees_logo.js : la construction en fait un morceau à part, que la page
// ne télécharge ni ne précharge au lancement.
//
// Sous Vite, « ?raw » rend le SVG en texte, et « ?inline » le PNG en URL
// data: base64, incrustée dans le morceau : la page les lit sans requête,
// sous file:// où la coquille la charge comme sous http://. Le SVG est de
// l'UTF-8 sans marque d'ordre d'octets : son texte, réencodé, redonne ses
// octets. Les octets du PNG se décodent par octetsDeDonnees (octets.js).
import { octetsDeDonnees } from './octets.js';

/** Le nom proposé à l'enregistrement de chaque forme du logo : celui de son
 *  fichier. */
export const FICHIERS_LOGO = Object.freeze({ svg: 'full_logo_technolibre_2023.svg', png: 'full_logo_technolibre_2023.png' });

/**
 * Le logo de TechnoLibre : les octets de ses deux fichiers, et une image
 * affichable du SVG, une URL data: que porte l'attribut src d'une image.
 *
 * @returns {Promise<{svg: Uint8Array, png: Uint8Array, image: string}>}  des
 *          tableaux neufs à chaque appel : un appelant peut écrire dans les
 *          siens
 */
export async function chargerLogo() {
  const { svg, png } = await import('./donnees_logo.js');
  return {
    svg: new TextEncoder().encode(svg),
    png: octetsDeDonnees(png),
    image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  };
}
