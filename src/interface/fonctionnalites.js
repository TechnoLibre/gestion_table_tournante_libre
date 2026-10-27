// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le sommaire des fonctionnalités que porte le panneau « À propos » (§ 2.2,
// § 18.6) : des catégories dans l'ordre de lecture, chacune un code de trois
// capitales et ses fonctionnalités, chacune un numéro — le code, un tiret,
// deux chiffres — et ses renvois aux sections de la spécification. Les
// intitulés sont des libellés de la coquille (libelles/coquille.js), sous
// cleDeCategorie et cleDeFonctionnalite.
//
// Le sommaire s'écrit à la main (§ 19.8), comme le tableau du § 2.2 de
// spec.md, qui porte les mêmes numéros, intitulés et renvois ; une épreuve
// les compare. Un numéro ne se réutilise jamais : une fonctionnalité retirée
// laisse le sien dans RETIRES, et une fonctionnalité nouvelle prend le plus
// grand numéro de sa catégorie, retirés compris, plus un.

// Une fonctionnalité gelée : son numéro et ses renvois, numéros de section
// sans « § ».
const f = (numero, ...renvois) => Object.freeze({ numero, renvois: Object.freeze(renvois) });
const categorie = (code, ...fonctionnalites) => Object.freeze({ code, fonctionnalites: Object.freeze(fonctionnalites) });

/** Les catégories du sommaire, dans l'ordre de lecture du panneau. */
export const CATEGORIES = Object.freeze([
  categorie(
    'PRE',
    f('PRE-01', '10.1'),
    f('PRE-02', '10.1'),
    f('PRE-03', '10.1'),
    f('PRE-04', '10.2'),
    f('PRE-05', '10.2'),
    f('PRE-06', '4.5'),
    f('PRE-07', '4', '10.2'),
    f('PRE-08', '4.4'),
    f('PRE-09', '6.1'),
    f('PRE-10', '2.1', '4.3'),
    f('PRE-11', '4.5', '10.4'),
    f('PRE-12', '10.1', '10.3'),
    f('PRE-13', '4', '7.7'),
    f('PRE-14', '8.9', '10.2'),
    f('PRE-15', '4', '10.2'),
  ),
  categorie(
    'PLA',
    f('PLA-01', '7.1', '7.7'),
    f('PLA-02', '7.1', '7.3'),
    f('PLA-03', '2.1', '5.8'),
    f('PLA-04', '5.8'),
    f('PLA-05', '5.9'),
    f('PLA-06', '5.5', '5.6'),
    f('PLA-07', '5.3', '5.7'),
    f('PLA-08', '5.7'),
    f('PLA-09', '5.10'),
    f('PLA-10', '5.7'),
    f('PLA-11', '5.7'),
    f('PLA-12', '12'),
    f('PLA-13', '12.10'),
    f('PLA-14', '9'),
    f('PLA-15', '5.8'),
    f('PLA-16', '7.5'),
    f('PLA-17', '7.7'),
  ),
  categorie(
    'PRO',
    f('PRO-01', '11.1', '11.2'),
    f('PRO-02', '11.3'),
    f('PRO-03', '11.6'),
    f('PRO-04', '11.6'),
    f('PRO-05', '11.7'),
    f('PRO-06', '11.7'),
    f('PRO-07', '11.7'),
    f('PRO-08', '11.7'),
    f('PRO-09', '11.6'),
  ),
  categorie(
    'FIC',
    f('FIC-01', '8.1', '8.6'),
    f('FIC-02', '8.2'),
    f('FIC-03', '8.3'),
    f('FIC-04', '8.4'),
    f('FIC-05', '9'),
    f('FIC-06', '8.7'),
    f('FIC-07', '8.8'),
    f('FIC-08', '8.6'),
    f('FIC-09', '2'),
  ),
  categorie(
    'INT',
    f('INT-01', '2.1'),
    f('INT-02', '15'),
    f('INT-03', '14.5', '18.6'),
    f('INT-04', '18.6'),
    f('INT-05', '14.5'),
    f('INT-06', '18.6'),
    f('INT-07', '2.2', '18.6'),
  ),
]);

/** Les numéros retirés du sommaire, qu'aucune fonctionnalité ne reprend. */
export const RETIRES = Object.freeze([]);

/**
 * La clé du libellé d'une catégorie.
 *
 * @param {string} code  « PRE »
 * @returns {string}  « coquille.apropos.categorie.pre »
 */
export function cleDeCategorie(code) {
  return `coquille.apropos.categorie.${code.toLowerCase()}`;
}

/**
 * La clé de l'intitulé d'une fonctionnalité.
 *
 * @param {string} numero  « PRE-03 »
 * @returns {string}  « coquille.apropos.fonctionnalite.pre03 »
 */
export function cleDeFonctionnalite(numero) {
  return `coquille.apropos.fonctionnalite.${numero.toLowerCase().replace('-', '')}`;
}
