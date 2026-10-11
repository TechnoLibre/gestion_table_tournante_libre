// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés de l'aperçu avant impression et de la feuille imprimée
// (§ 11.7, § 8.5, § 11.2, § 18.6), et ceux de la question du papier, que
// l'aperçu et la section des badges partagent. Chaque clé commence par
// « impression. ». Une donnée — le nom de l'événement, une date, un
// horodatage, la version — n'entre dans aucun de ces textes : la feuille la
// pose dans son propre nœud, à côté.
export const TABLE = new Map([
  // --- L'écran et sa barre (§ 11.7) ------------------------------------------
  ['impression.titre', 'Aperçu avant impression'],
  ['impression.barre', "Commandes de l'aperçu"],
  ['impression.commande.ouvrir', 'Imprimer…'],
  ['impression.commande.imprimer', 'Imprimer'],
  ['impression.commande.fermer', "Fermer l'aperçu"],
  ['impression.groupe.reglages', 'Réglages de la vue'],
  ['impression.groupe.sortie', 'Papier et impression'],

  // --- Ce que l'aperçu imprime ----------------------------------------------
  ['impression.vue.titre', 'Vue imprimée'],
  ['impression.vue.plan', 'Plan de salle'],
  ['impression.vue.accueil', "Liste d'accueil"],
  ['impression.vue.tables', 'Feuilles par table'],
  ['impression.tour.titre', 'Tour imprimé'],
  ['impression.tour.option', ({ tour }) => `Tour ${tour}`],
  ['impression.listes', 'Listes de noms'],
  ['impression.decoupe.titre', 'Pages du plan'],
  ['impression.decoupe.auto', 'Découpage proposé'],
  ['impression.decoupe.unePage', 'Tout sur une page'],
  ['impression.decoupe.decoupe', 'Découper en pages'],
  ['impression.parTour', 'Une feuille par tour'],

  // --- La question du papier (§ 8.5, § 11.2) -----------------------------------
  ['impression.papier.question', 'Sur quel papier imprimez-vous ?'],
  [
    'impression.papier.explication',
    "Le format est celui du bac de l'imprimante de cette machine : il est retenu ici, et ne se redemande plus.",
  ],
  ['impression.papier.choix.a4', 'A4 (210 × 297 mm)'],
  ['impression.papier.choix.lettre', 'Lettre (215,9 × 279,4 mm)'],
  ['impression.papier.titre', 'Papier :'],
  ['impression.papier.nom.a4', 'A4'],
  ['impression.papier.nom.lettre', 'Lettre'],
  ['impression.papier.changer', 'Changer'],

  // --- La feuille imprimée (§ 11.7, § 18.6) -----------------------------------
  ['impression.filigrane', 'BROUILLON'],
  ['impression.pied.sansDate', 'Date non fixée'],
  ['impression.pied.tour', ({ tour }) => `Tour ${tour}`],
  ['impression.pied.tousLesTours', 'Tous les tours'],
  ['impression.pied.placement', 'Placement du'],
  ['impression.pied.placementInconnu', 'Placement non daté'],
  ['impression.pied.version', 'Version'],

  // --- Le plan imprimé (§ 7.7, § 11.7) ---------------------------------------
  ['impression.plan.page', ({ page, total }) => `Plan, page ${page} sur ${total}`],
  [
    'impression.plan.cartouche',
    ({ page, total, colonne, rangee }) => `Page ${page} sur ${total} \u{2014} colonne ${colonne}, rangée ${rangee}`,
  ],
  ['impression.plan.renvoi.haut', ({ page }) => `au-dessus : page ${page}`],
  ['impression.plan.renvoi.droite', ({ page }) => `à droite : page ${page}`],
  ['impression.plan.renvoi.bas', ({ page }) => `au-dessous : page ${page}`],
  ['impression.plan.renvoi.gauche', ({ page }) => `à gauche : page ${page}`],
  [
    'impression.plan.listes',
    "listes de noms hors d'échelle \u{2014} le plan à l'échelle du bâtiment s'imprime listes masquées",
  ],

  // --- Les vues, avant leur mise en page (§ 11.7) ------------------------------
  ['impression.accueil.titre', "Liste d'accueil"],
  ['impression.tables.titre', 'Feuilles par table'],
]);
