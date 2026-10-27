// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le nom d'une personne tel que les libellés figés, le plan et le CSV
// l'écrivent (§ 8.2, § 10.1) : la seule composition de ce nom. Il vit sous
// src/stockage parce qu'il ne lit que les champs du fichier : le CSV, qui
// n'importe pas src/application, nomme ainsi une personne incluse, et
// l'application le réexporte (src/application/personnes.js).

/**
 * Le prénom, puis le nom ; le nom seul quand le prénom est null.
 *
 * @param {{nom: string, prenom: string|null}} personne
 * @returns {string}
 */
export function nomAffiche({ nom, prenom }) {
  return prenom === null ? nom : `${prenom} ${nom}`;
}
