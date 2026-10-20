// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

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
  ['raccourcis.grille.editer', "Ouvre la saisie de la cellule \u{2014} les cases de présence comprises \u{2014}, ou bascule l'exclusion."],
  ['raccourcis.grille.effacer', 'Efface le refus affiché sous la cellule.'],
  // --- Les cases d'une saisie de présence, dans la grille ou la fiche ------------
  ['raccourcis.cases.precedente', 'Passe à la case du tour précédent.'],
  ['raccourcis.cases.suivante', 'Passe à la case du tour suivant.'],
  ['raccourcis.cases.premiere', 'Passe à la case du premier tour.'],
  ['raccourcis.cases.derniere', 'Passe à la case du dernier tour.'],
  // --- Un champ --------------------------------------------------------------------
  ['raccourcis.champ.valider', 'Valide la saisie.'],
  ['raccourcis.champ.rendre', "Rend la valeur d'avant la saisie."],
  // --- Une commande ----------------------------------------------------------------
  ['raccourcis.commande.activer', 'Exécute la commande une fois, même maintenue.'],
  // --- Un menu d'actions : son bouton, puis le menu ouvert ----------------------
  ['raccourcis.boutonMenu.ouvrirPremier', 'Ouvre le menu sur sa première action.'],
  ['raccourcis.boutonMenu.ouvrirDernier', 'Ouvre le menu sur sa dernière action.'],
  ['raccourcis.menu.suivant', "Passe à l'action suivante ; après la dernière, revient à la première."],
  ['raccourcis.menu.precedent', "Passe à l'action précédente ; avant la première, va à la dernière."],
  ['raccourcis.menu.premier', 'Va à la première action.'],
  ['raccourcis.menu.dernier', 'Va à la dernière action.'],
  ['raccourcis.menu.fermer', 'Ferme le menu et rend le focus à son bouton.'],
  ['raccourcis.menu.quitter', 'Ferme le menu ; le focus passe au contrôle suivant.'],
  // --- Un geste, l'écran de l'événement, une fenêtre -------------------------------
  ['raccourcis.geste.annuler', 'Annule le geste en cours : la table revient où elle était.'],
  ['raccourcis.evenement.defaire', 'Défait le dernier geste.'],
  ['raccourcis.evenement.refaire', 'Refait le dernier retour.'],
  ['raccourcis.fenetre.fermer', "Ferme le panneau ou l'infobulle."],
]);
