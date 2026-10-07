// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés de l'événement ouvert : son en-tête, ses états, la place fixe
// de son cadre de mode, la reprise d'un verrou, ses avertissements, le
// support rompu (§ 8.3 à § 8.9, § 9, § 14.6). Chaque clé commence par «
// evenement. ». Une donnée — un numéro, une séance, un instant — n'entre
// dans aucun de ces textes : l'écran la pose dans son propre nœud, à côté.
export const TABLE = new Map([
  // --- L'en-tête et les états du plan (§ 9) -----------------------------------
  ['evenement.etat.titre', 'État du plan'],
  ['evenement.etat.brouillon', 'Brouillon'],
  ['evenement.etat.propose', 'Proposé'],
  ['evenement.etat.retenu', 'Retenu'],
  ['evenement.etat.bloque', 'Bloqué'],

  // --- Le cadre de mode et sa place fixe (§ 8.3, § 8.4, § 8.5) -------------
  ['evenement.cadre.commandes', 'Mode et historique'],
  ['evenement.commande.defaire', 'Défaire'],
  ['evenement.commande.refaire', 'Refaire'],

  // --- La reprise d'un verrou dont la vie ne se prouve pas (§ 8.8) ----------
  ['evenement.verrou.titre', 'Le verrou qui tient cet événement'],
  ['evenement.verrou.seance', 'Séance'],
  ['evenement.verrou.depuis', 'Pris le'],
  ['evenement.verrou.inconnu', 'illisible'],
  [
    'evenement.verrou.avis',
    "Reprendre ce verrou n'est sûr que si cette séance est arrêtée : deux séances qui écrivent le même événement se contrediraient.",
  ],
  ['evenement.verrou.confirmerReprise', 'Confirmer la reprise de ce verrou'],

  // --- Les avertissements (§ 8.6, § 8.9, § 9) -------------------------------
  ['evenement.avertissements', 'Avertissements'],
  ['evenement.fautive.numero', 'Proposition n°'],
  ['evenement.fautive.rang', 'Proposition illisible, au rang'],
  ['evenement.derive.retenu', 'Placement retenu'],
  ['evenement.derive.proposition', 'Proposition n°'],

  // --- Le support rompu (§ 8.6) ----------------------------------------------
  ['evenement.supportRompu.abandonner', 'Fermer sans écrire ailleurs'],
  ['evenement.supportRompu.confirmerAbandon', "Confirmer : fermer sans l'écrire ailleurs"],
]);
