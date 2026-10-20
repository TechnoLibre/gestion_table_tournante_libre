// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le nom d'une personne tel que les libellés figés et le plan l'écrivent
// (§ 8.2) : la seule composition de ce nom dans l'application.

/**
 * Le prénom, puis le nom ; le nom seul quand le prénom est null.
 *
 * @param {{nom: string, prenom: string|null}} personne
 * @returns {string}
 */
export function nomAffiche({ nom, prenom }) {
  return prenom === null ? nom : `${prenom} ${nom}`;
}
