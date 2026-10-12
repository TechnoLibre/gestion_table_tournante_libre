// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés des composants de graphique de la page de qualité (§ 12.3,
// § 12.7, § 12.14) : les titres des abscisses, la commande du jumeau, la
// légende et les signes des rangs marqués, la marque de troncature d'un nom,
// la phrase des petits multiples. Chaque clé commence par « graphiques. ».
// Les questions des vues, leurs phrases de synthèse et leurs pourcentages
// sont des libellés de la page (qualite.*) : la vue les écrit et les passe
// au composant déjà rendus. Aucune valeur de cette table n'écrit le signe du
// pourcentage (contrainte 44).
export const TABLE = new Map([
  // --- Les axes ---------------------------------------------------------------
  ['graphiques.axe.rangs', 'rang'],
  ['graphiques.axe.mouvements', 'mouvements évalués'],

  // --- La légende et les signes des rangs marqués (§ 12.3) --------------------
  ['graphiques.legende', 'Légende'],
  ['graphiques.signe.ancre', 'ancré'],
  ['graphiques.signe.partiel', 'partiellement fixé'],
  ['graphiques.signe.reserve', 'en réserve à un tour au moins'],
  ['graphiques.signe.plafondNul', 'plafond réalisé nul'],

  // --- Le jumeau tabulaire (§ 12.7, D44) --------------------------------------
  ['graphiques.jumeau.ouvrir', 'Voir le tableau'],
  ['graphiques.jumeau.fermer', 'Masquer le tableau'],

  // --- Le texte des graphiques ------------------------------------------------
  // La marque d'un nom tronqué sur le tracé ; le nom entier reste dans
  // l'infobulle et le jumeau (§ 12.6).
  ['graphiques.troncature', '\u{2026}'],
  // Les petits multiples de la performance ne marquent que les points de
  // relevé (D49) : la phrase de synthèse le dit.
  ['graphiques.synthese.pointsDeReleve', 'Valeurs aux seuls points de relevé, reliées par un trait mince.'],
]);
