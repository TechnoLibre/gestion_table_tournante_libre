// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés de l'import d'une liste : aperçu et rapport (§ 14.6). Chaque
// clé commence par « import. ». Un nombre, un nom ou un rang s'affiche dans
// son propre nœud de texte : les libellés qui le suivent ne reçoivent que ce
// qui accorde le nom au compte.

// Le singulier jusqu'à un, le pluriel au-delà, comme le veut le français.
const accorde = (n, singulier, pluriel) => (n <= 1 ? singulier : pluriel);

export const TABLE = new Map([
  // --- La section et ses commandes (§ 10.1, § 10.2) ----------------------------
  [
    'import.consigne',
    'Choisissez un fichier CSV ou déposez-le sur la fenêtre ; une plage collée dans la grille des participants arrive ici. ' +
      "Rien ne s'importe avant l'aperçu.",
  ],
  ['import.commande.choisirFichier', 'Choisir un fichier CSV\u{2026}'],
  ['import.commande.importer', 'Importer'],
  ['import.commande.fermerApercu', "Fermer l'aperçu"],
  ['import.commande.ordreDeLaGrille', "Lire les colonnes dans l'ordre de la grille"],
  ['import.commande.enregistrerRefus', 'Enregistrer les lignes refusées'],
  ['import.commande.fermerRapport', 'Fermer le rapport'],
  ['import.refusEnregistres', 'Lignes refusées enregistrées :'],

  // --- La sorte d'un message de l'aperçu et du rapport (messageDuBloc) ------
  ['import.sorte.refus', 'Refus'],
  ['import.sorte.avis', 'Avis'],
  ['import.sorte.information', 'Information'],

  // --- Le mode de l'import (§ 10.1) -------------------------------------------
  ['import.mode.titre', "Mode de l'import"],
  ['import.mode.ajouter', 'Ajouter'],
  ['import.mode.mettreAJour', 'Mettre à jour'],
  ['import.mode.remplacer', 'Remplacer'],

  // --- L'aperçu : source, encodage, séparateur ---------------------------------
  ['import.apercu.titre', 'Aperçu'],
  ['import.apercu.fichier', 'Fichier'],
  ['import.apercu.collage', 'Texte collé'],
  ['import.apercu.encodage', 'Encodage'],
  ['import.apercu.separateur', 'Séparateur'],
  ['import.encodage.utf8Marque', 'UTF-8 avec marque'],
  ['import.encodage.utf16le', 'UTF-16 LE'],
  ['import.encodage.utf16be', 'UTF-16 BE'],
  ['import.encodage.utf8', 'UTF-8'],
  ['import.encodage.windows1252', 'windows-1252'],
  ['import.separateur.pointVirgule', 'point-virgule'],
  ['import.separateur.virgule', 'virgule'],
  ['import.separateur.tabulation', 'tabulation'],
  ['import.separateur.uneColonne', 'une seule colonne'],

  // --- L'aperçu : les colonnes et leur association (§ 10.1) --------------------
  ['import.apercu.colonnes', 'Colonnes'],
  ['import.apercu.entete', 'En-tête'],
  ['import.apercu.devient', 'Devient'],
  ['import.champ.nom', 'nom'],
  ['import.champ.prenom', 'prénom'],
  ['import.champ.appartenance', 'appartenance'],
  ['import.champ.courriel', 'courriel'],
  ['import.champ.titrePressenti', 'titre pressenti'],
  ['import.champ.exclu', 'exclu'],
  ['import.champ.notes', 'notes'],
  ['import.exclu.oui', 'oui'],
  ['import.exclu.non', 'non'],
  ['import.colonne.nonReconnue', 'non reconnue : ignorée'],
  ['import.colonne.aTrancher', 'à trancher'],
  ['import.colonne.ecartee', 'écartée par le choix'],
  ['import.ambiguite.question', 'Plusieurs colonnes répondent au même champ. Laquelle vaut :'],

  // --- L'aperçu : les lignes ---------------------------------------------------
  ['import.apercu.valides', ({ n }) => accorde(n, 'ligne valide', 'lignes valides')],
  ['import.apercu.refusees', 'Lignes refusées'],
  ['import.apercu.ligne', 'Ligne'],
  ['import.apercu.motif', 'Motif'],
  ['import.apercu.fusions', 'Orthographes fondues en une appartenance'],
  ['import.apercu.orthographeLignes', ({ n }) => accorde(n, 'ligne', 'lignes')],
  ['import.apercu.affichee', 'affichée :'],
  ['import.apercu.doublons', 'Doublons signalés, jamais fusionnés'],
  ['import.apercu.doublonLignes', 'lignes'],
  ['import.apercu.doublonExistants', 'déjà dans la liste :'],
  ['import.apercu.homonymes', "Ajoutées à côté d'une personne de même nom"],
  ['import.apercu.multilignes', 'Cellules sur plusieurs lignes qui portent le séparateur : à vérifier'],

  // --- Les refus globaux : le remède (§ 10.1) ---------------------------------
  ['import.remede.caractereNulCollage', 'Retirez le caractère nul du texte collé, ou importez le fichier réenregistré en UTF-8.'],
  ['import.remede.aucunEntete', "Ajoutez une ligne d'en-tête qui nomme les colonnes, « nom » au moins."],
  [
    'import.remede.aucunEnteteCollage',
    "Ajoutez une ligne d'en-tête qui nomme les colonnes, ou lisez les colonnes dans l'ordre de la grille.",
  ],
  ['import.remede.nomNonAssocie', 'Nommez « nom » la colonne des noms.'],
  ['import.remede.aucuneLigneValide', 'Corrigez les lignes refusées, listées avec leur motif.'],
  [
    'import.remede.guillemetOuvert',
    ({ ligne }) => `Fermez le guillemet ouvert${Number.isInteger(ligne) ? ` à la ligne ${ligne}` : ''}.`,
  ],
  [
    'import.remede.separateurIntrouvable',
    'Séparez les colonnes par « ; », « , » ou une tabulation, en même nombre à chaque ligne.',
  ],
  [
    'import.remede.separateurIntrouvableCollage',
    "Séparez les colonnes par « ; », « , » ou une tabulation, ou lisez la colonne dans l'ordre de la grille : " +
      'chaque ligne devient un nom.',
  ],

  // --- La fenêtre de « Remplacer » (§ 10.1) ------------------------------------
  ['import.remplacer.titre', 'Remplacer la liste des participants'],
  [
    'import.remplacer.participants',
    ({ n }) => `${n} ${accorde(n, 'personne sera supprimée', 'personnes seront supprimées')}`,
  ],
  [
    'import.remplacer.reservations',
    ({ n }) => `${n} ${accorde(n, 'réservation sera supprimée', 'réservations seront supprimées')}`,
  ],
  [
    'import.remplacer.titres',
    ({ n }) =>
      `${n} ${accorde(n, 'titre perdra la réservation qui le pourvoit', 'titres perdront la réservation qui les pourvoit')}, ` +
      'à un tour au moins',
  ],
  [
    'import.remplacer.propositions',
    ({ n }) => `${n} ${accorde(n, 'proposition deviendra périmée', 'propositions deviendront périmées')}`,
  ],

  // --- Le rapport (§ 10.1) ---------------------------------------------------
  ['import.rapport.titre', "Rapport d'import"],
  ['import.rapport.ajoutes', ({ n }) => accorde(n, 'personne ajoutée', 'personnes ajoutées')],
  ['import.rapport.misAJour', ({ n }) => accorde(n, 'personne mise à jour', 'personnes mises à jour')],
  ['import.rapport.inchanges', ({ n }) => accorde(n, 'personne inchangée', 'personnes inchangées')],
  ['import.rapport.retires', ({ n }) => accorde(n, 'personne retirée', 'personnes retirées')],
  ['import.rapport.reservationsRetirees', ({ n }) => accorde(n, 'réservation retirée', 'réservations retirées')],
  ['import.rapport.rienEcrit', "Rien n'a changé dans la liste : seules des lignes refusées restent à lire."],
  ['import.rapport.designees', 'désignées :'],
]);
