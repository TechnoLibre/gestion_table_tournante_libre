// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés communs aux écrans : commandes, confirmations, remèdes d'un
// refus (§ 14.6). Chaque clé commence par « communs. ».
//
// communs.commande.* nomme les commandes de mode et de secours, que la place
// fixe de l'événement et les écrans de la liste reprennent. communs.remede.*
// nomme le remède d'un refus : communs.remede.<commande> pour chaque commande
// du registre (src/application/commandes.js), communs.remede.<geste> pour un
// geste du contrat, suivi de .<variante> quand ses arguments changent son
// libellé (primitives/commande.js, libelleRemede). Un remède qui fait ce que
// fait une commande de mode en reprend le texte, par texte.

// Le libellé d'une autre clé de cette table.
const meme = (cle) => (details, texte) => texte(cle);

export const TABLE = new Map([
  // --- Les commandes de mode et de secours (§ 8.4, § 8.5, § 8.6, § 8.8) -----
  ['communs.commande.modifier', 'Modifier'],
  ['communs.commande.debloquer', 'Débloquer'],
  ['communs.commande.confirmerDeblocage', 'Confirmer le déblocage'],
  ['communs.commande.lecture', 'Revenir en lecture'],
  ['communs.commande.ecrireDocuments', 'Écrire dans les Documents'],
  ['communs.commande.choisirDossier', 'Choisir un dossier\u{2026}'],
  ['communs.commande.ouvrirPrecedent', 'Ouvrir la version précédente'],
  ['communs.commande.ouvrirJournal', 'Ouvrir le dernier instant du journal'],

  // --- La fenêtre à confirmer (§ 2.1) -------------------------------------------
  ['communs.confirmation.confirmer', 'Confirmer'],
  ['communs.confirmation.annuler', 'Annuler'],
  ['communs.confirmation.enCours', 'Opération en cours\u{2026}'],

  // --- Les remèdes des gestes du contrat ------------------------------------
  ['communs.remede.modifier', meme('communs.commande.modifier')],
  ['communs.remede.debloquer', meme('communs.commande.debloquer')],
  ['communs.remede.reprendreVerrou', 'Reprendre le verrou'],
  ['communs.remede.afficherTour', ({ tour }) => `Afficher le tour ${tour}`],
  ['communs.remede.choisirPlace', 'Choisir une place'],
  ['communs.remede.enregistrerSous', 'Enregistrer sous\u{2026}'],
  ['communs.remede.choisirPapier', 'Choisir le papier'],
  ['communs.remede.ouvrirSecours.precedent', meme('communs.commande.ouvrirPrecedent')],
  ['communs.remede.ouvrirSecours.journal', meme('communs.commande.ouvrirJournal')],
  ['communs.remede.ecrireAilleurs.documents', meme('communs.commande.ecrireDocuments')],
  ['communs.remede.ecrireAilleurs.choisi', meme('communs.commande.choisirDossier')],
  ['communs.remede.ouvrirSection.import', "Ouvrir l'import"],
  ['communs.remede.ouvrirSection.participants', 'Ouvrir les participants'],
  ['communs.remede.ouvrirSection.tables', 'Ouvrir les tables'],
  ['communs.remede.ouvrirSection.plan', 'Ouvrir le plan'],
  ['communs.remede.ouvrirSection.diagnostic', 'Ouvrir le diagnostic'],
  ['communs.remede.ouvrirSection.generation', 'Ouvrir la génération'],
  ['communs.remede.ouvrirSection.propositions', 'Ouvrir les propositions'],

  // --- Les remèdes de commande : un par commande du registre ------------------
  // debloquer, commande et geste, porte la clé des gestes, plus haut.
  ['communs.remede.ajouterParticipant', 'Ajouter la personne'],
  ['communs.remede.modifierParticipant', 'Modifier la personne'],
  ['communs.remede.exclureParticipant', 'Exclure la personne'],
  ['communs.remede.reintegrerParticipant', 'Réintégrer la personne'],
  ['communs.remede.supprimerParticipant', 'Supprimer la personne'],
  ['communs.remede.importerParticipants', 'Importer la liste'],
  ['communs.remede.importerObjectifs', 'Importer les objectifs'],
  ['communs.remede.changerEtat', "Changer l'état du plan"],
  ['communs.remede.enregistrerGeneration', 'Enregistrer la génération'],
  ['communs.remede.retenirProposition', 'Retenir la proposition'],
  ['communs.remede.effacerPropositions', 'Effacer les propositions'],
  ['communs.remede.creerTable', 'Créer une table'],
  ['communs.remede.supprimerTable', 'Supprimer la table'],
  ['communs.remede.deplacerTable', 'Déplacer la table'],
  // sieges : le nombre de places que le remède donne à la table, quand il le
  // fixe (SURRESERVATION, § 5.9).
  [
    'communs.remede.changerPlacesTable',
    ({ sieges }) => (Number.isInteger(sieges) ? `Passer la table à ${sieges} places` : 'Changer le nombre de places'),
  ],
  ['communs.remede.realignerTable', 'Réaligner la table'],
  ['communs.remede.changerDefaut', 'Changer le nombre de places par défaut'],
  ['communs.remede.changerTours', 'Changer le nombre de tours'],
  ['communs.remede.modifierReglage', 'Modifier le réglage'],
  ['communs.remede.changerCibleRedondance', 'Changer la cible de la somme de redondance'],
  ['communs.remede.changerEtiquettes', 'Changer les étiquettes'],
  ['communs.remede.poserObjectif', "Poser l'objectif"],
  ['communs.remede.retirerObjectif', "Retirer l'objectif"],
  ['communs.remede.changerRegleObjectifs', 'Changer la règle par défaut des objectifs'],
  ['communs.remede.changerPriorites', "Changer l'ordre des priorités"],
  ['communs.remede.retablirPriorites', "Rétablir l'ordre par défaut"],
  ['communs.remede.reserver', 'Réserver la place'],
  ['communs.remede.retirerReservation', 'Retirer la réservation'],
  ['communs.remede.deplacerReservation', 'Déplacer la réservation'],
  ['communs.remede.poserTitre', 'Poser le titre'],
  ['communs.remede.retirerTitre', 'Retirer le titre'],
  ['communs.remede.designer', 'Désigner la personne'],
  ['communs.remede.convertirEnTous', 'Réserver pour tous les tours'],
  ['communs.remede.deplacerDansRetenu', 'Déplacer dans le placement retenu'],
  ['communs.remede.echangerDansRetenu', 'Échanger les deux places'],
  ['communs.remede.retirerDuTour', 'Retirer du tour'],
]);
