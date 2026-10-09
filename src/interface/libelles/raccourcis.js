// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés des raccourcis clavier (§ 7.3, § 19.8) : ce que fait chaque
// effet de la table des raccourcis (raccourcis.js), une clé par contexte et
// par effet, raccourcis.<contexte>.<effet>. Le tableau engendré des
// raccourcis les lit ; le nom de la touche n'entre dans aucun de ces textes.
export const TABLE = new Map([
  // --- Le plan -------------------------------------------------------------------
  ['raccourcis.plan.droite', 'Passe à la table voisine à droite, ou au siège suivant.'],
  ['raccourcis.plan.bas', 'Passe à la table voisine en dessous, ou au siège suivant.'],
  ['raccourcis.plan.gauche', 'Passe à la table voisine à gauche, ou au siège précédent.'],
  ['raccourcis.plan.haut', 'Passe à la table voisine au-dessus, ou au siège précédent.'],
  ['raccourcis.plan.entrer', 'Descend dans les sièges de la table, ou choisit la place.'],
  ['raccourcis.plan.remonter', 'Remonte du siège à sa table ; sur une table, oublie le choix.'],
  // --- La grille des participants -----------------------------------------------
  ['raccourcis.grille.droite', 'Passe à la cellule de droite.'],
  ['raccourcis.grille.bas', 'Passe à la cellule du dessous.'],
  ['raccourcis.grille.gauche', 'Passe à la cellule de gauche.'],
  ['raccourcis.grille.haut', 'Passe à la cellule du dessus.'],
  ['raccourcis.grille.suivante', 'Valide la saisie en cours et passe à la cellule suivante.'],
  ['raccourcis.grille.precedente', 'Valide la saisie en cours et revient à la cellule précédente.'],
  ['raccourcis.grille.editer', "Ouvre la saisie de la cellule, ou bascule l'exclusion."],
  ['raccourcis.grille.effacer', 'Efface le refus affiché sous la cellule.'],
  // --- Un champ --------------------------------------------------------------------
  ['raccourcis.champ.valider', 'Valide la saisie.'],
  ['raccourcis.champ.rendre', "Rend la valeur d'avant la saisie."],
  // --- Une commande ----------------------------------------------------------------
  ['raccourcis.commande.activer', 'Exécute la commande une fois, même maintenue.'],
  // --- Un geste, une fenêtre -------------------------------------------------------
  ['raccourcis.geste.annuler', 'Annule le geste en cours : la table revient où elle était.'],
  ['raccourcis.fenetre.fermer', "Ferme le panneau ou l'infobulle."],
]);
