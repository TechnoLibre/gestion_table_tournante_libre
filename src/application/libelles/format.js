// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les textes de la mise en forme (format.js, § 5.4, § 5.10, § 18.4) : la
// valeur absente, les unités d'une durée, son ordre de grandeur, les mois et
// l'heure. Les entrées reçoivent des nombres déjà contrôlés par creerFormat,
// ou des chiffres déjà mis en forme ; un mois hors de 1 à 12 lève RangeError.

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

// Le nom d'un mois, de 1 à 12.
function nomDuMois(mois) {
  if (!Number.isInteger(mois) || mois < 1 || mois > 12) {
    throw new RangeError(`format : mois inconnu ${JSON.stringify(mois)}`);
  }
  return MOIS[mois - 1];
}

export const TABLE = new Map([
  // Une valeur absente, celle d'une population vide (§ 5.4).
  ['format.vide', '\u{2014}'],

  // Une durée : secondes, déjà écrites ; minutes et secondes ; heures et
  // minutes. Une part nulle se tait.
  ['format.duree.secondes', ({ secondes }) => `${secondes} s`],
  [
    'format.duree.minutes',
    ({ minutes, secondes }) => (secondes === 0 ? `${minutes} min` : `${minutes} min ${secondes} s`),
  ],
  ['format.duree.heures', ({ heures, minutes }) => (minutes === 0 ? `${heures} h` : `${heures} h ${minutes} min`)],

  // L'ordre de grandeur d'une durée (§ 5.10), du plus court au plus long.
  ['format.duree.moinsDUneMinute', "moins d'une minute"],
  ['format.duree.deuxMinutes', 'environ deux minutes'],
  ['format.duree.cinqMinutes', 'environ cinq minutes'],
  ['format.duree.dixMinutes', 'environ dix minutes'],
  ['format.duree.vingtMinutes', 'environ vingt minutes'],
  ['format.duree.demiHeure', 'environ une demi-heure'],
  ['format.duree.uneHeure', 'environ une heure'],
  ['format.duree.plusieursHeures', 'plusieurs heures'],

  // Une date en lettres, « 1er » pour le premier du mois (§ 18.4) ; l'heure
  // sans zéro de tête, la minute sur deux chiffres.
  ['format.date', ({ annee, mois, jour }) => `${jour === 1 ? '1er' : jour} ${nomDuMois(mois)} ${annee}`],
  ['format.heure', ({ heure, minute }) => `${heure} h ${String(minute).padStart(2, '0')}`],
  ['format.horodatage', (details, texte) => `${texte('format.date', details)}, ${texte('format.heure', details)}`],
]);
