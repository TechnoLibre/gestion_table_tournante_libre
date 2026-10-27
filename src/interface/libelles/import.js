// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les libellés de l'import d'une liste de participants ou d'objectifs de
// table : nature du fichier, aperçu et rapport (§ 10.4, § 14.6). Chaque
// clé commence par « import. ». Un nombre, un nom ou un rang s'affiche dans
// son propre nœud de texte : les libellés qui le suivent ne reçoivent que ce
// qui accorde le nom au compte, ou, pour la présence, les tours que
// toursNommes met en mots, et pour un doublon, ses lignes, qu'enumeration
// joint en une phrase.
import { enumeration, toursNommes } from '../../application/libelles/aides.js';
import { creerFormat } from '../../application/format.js';

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
  ['import.commande.rendreNomsUniques', 'Rendre les noms uniques'],
  ['import.refusEnregistres', 'Lignes refusées enregistrées :'],

  // --- Le modèle à télécharger, de la nature cochée (§ 10.1, § 10.4) -----------
  // Le nom accessible de la commande commence par son libellé visible, puis
  // nomme la nature : le même texte ne désigne pas deux fichiers.
  ['import.commande.telechargerModele', 'Télécharger un modèle'],
  ['import.modele.participants', 'Télécharger un modèle de liste de participants'],
  ['import.modele.objectifs', "Télécharger un modèle d'objectifs de table"],
  ['import.modele.enregistre', 'Modèle enregistré :'],

  // --- Le guide de l'import, replié sous le modèle (§ 10.1, § 10.4) ----------
  // Une ligne par colonne reconnue de la nature cochée : son en-tête et ses
  // synonymes viennent de la table d'en-têtes, son texte d'ici. Un texte dit
  // ce que la colonne contient et comment une cellule sépare plusieurs
  // valeurs ; une liste fermée s'y donne en entier.
  ['import.guide.titre', 'Guide import'],
  ['import.guide.legende.participants', "Colonnes d'un fichier de participants"],
  ['import.guide.legende.objectifs', "Colonnes d'un fichier d'objectifs de table"],
  ['import.guide.entete', 'En-tête'],
  ['import.guide.obligatoire', 'Obligatoire'],
  ['import.guide.contenu', 'Contenu'],
  ['import.guide.synonymes', 'Synonymes'],
  ['import.guide.oui', 'oui'],
  ['import.guide.non', 'non'],
  ['import.guide.aucunSynonyme', 'aucun'],
  [
    'import.guide.consigne.entetes',
    "Chaque colonne se reconnaît à son en-tête, sans égard à la casse, aux accents, aux espaces, à « _ » ni à « - ». " +
      "L'ordre des colonnes est libre ; une colonne inconnue est ignorée.",
  ],
  [
    'import.guide.consigne.fichier',
    "Le séparateur des colonnes — « ; », « , » ou une tabulation — et l'encodage — UTF-8, UTF-16 avec marque " +
      "ou windows-1252 — se détectent seuls ; l'aperçu les nomme.",
  ],
  ['import.guide.consigne.modele', '« Télécharger un modèle » donne un fichier aux bons en-têtes, prêt à remplir.'],
  [
    'import.guide.consigne.apercu',
    "Rien ne s'importe avant l'aperçu, qui montre chaque ligne lue et chaque ligne refusée avec son motif.",
  ],
  ['import.guide.colonne.nom', 'Le nom de la personne ; une ligne sans nom est refusée.'],
  ['import.guide.colonne.prenom', 'Le prénom.'],
  [
    'import.guide.colonne.organisation',
    "L'organisation de la personne. Deux orthographes qui ne diffèrent que par la casse, les accents ou les espaces " +
      "n'en font qu'une.",
  ],
  ['import.guide.colonne.courriel', "L'adresse de courriel."],
  ['import.guide.colonne.titrePressenti', 'Un titre ou un rôle, pour information : il ne pourvoit aucune place.'],
  [
    'import.guide.colonne.exclu',
    "« oui », « o », « vrai », « 1 » ou « x » exclut la personne ; « non », « n », « faux », « 0 » ou une cellule vide " +
      "ne l'exclut pas. La casse et les accents ne comptent pas ; toute autre valeur refuse la ligne.",
  ],
  ['import.guide.colonne.notes', 'Un texte libre, jamais interprété.'],
  [
    'import.guide.colonne.etiquettes',
    'Les étiquettes de la personne, séparées par « , », « ; », « | » ou un retour à la ligne dans la cellule.',
  ],
  [
    'import.guide.colonne.presence',
    'Les tours où la personne vient, en tours et en plages : « 1-3 », « 2, 3 », « tours 1 et 2 » ; « tous » vaut ' +
      'tous les tours. Vide : tous les tours pour une personne créée, sa présence gardée en mise à jour.',
  ],
  [
    'import.guide.colonne.conflits',
    'Les organisations que celle de la personne évite à table, séparées par « ; », « | » ou un retour à la ligne ' +
      'dans la cellule — pas par une virgule, qui reste dans le nom. Chacune doit être portée par une personne que ' +
      "l'import laisse dans la liste, et différer de celle de la personne : sinon le fichier entier est refusé.",
  ],
  ['import.guide.colonne.table', "Le numéro de la table, tel que le plan l'affiche."],
  ['import.guide.colonne.tour', 'Le tour, de 1 au nombre de tours ; vide pour toute la soirée.'],
  [
    'import.guide.colonne.objectif',
    'Les étiquettes visées, séparées par « , », « ; », « | » ou un retour à la ligne dans la cellule. ' +
      'Une ligne sans objectif ni règle est passée, sans refus.',
  ],
  [
    'import.guide.colonne.regle',
    "« ou », « une » ou « au moins une » : au moins une des étiquettes ; « et » ou « toutes » : toutes ; vide : " +
      "la règle par défaut de l'événement. Toute autre valeur refuse la ligne.",
  ],

  // --- La sorte d'un message de l'aperçu et du rapport (messageDuBloc) ------
  ['import.sorte.refus', 'Refus'],
  ['import.sorte.avis', 'Avis'],
  ['import.sorte.information', 'Information'],

  // --- La nature du fichier, choisie avant l'aperçu (§ 10.4) --------------------
  ['import.nature.titre', 'Contenu du fichier'],
  ['import.nature.participants', 'Participants'],
  ['import.nature.objectifs', 'Objectifs de table'],

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
  ['import.champ.organisation', 'organisation'],
  ['import.champ.courriel', 'courriel'],
  ['import.champ.titrePressenti', 'titre pressenti'],
  ['import.champ.exclu', 'exclu'],
  ['import.champ.notes', 'notes'],
  ['import.champ.etiquettes', 'étiquettes'],
  ['import.champ.presence', 'présence'],
  ['import.champ.conflits', "conflits d'organisation"],
  ['import.champ.table', 'table'],
  ['import.champ.tour', 'tour'],
  ['import.champ.objectif', 'objectif'],
  ['import.champ.regle', 'règle'],
  ['import.tour.soiree', 'soirée'],
  ['import.regle.ou', 'au moins une'],
  ['import.regle.et', 'toutes'],
  ['import.regle.defaut', 'règle par défaut'],
  ['import.exclu.oui', 'oui'],
  ['import.exclu.non', 'non'],
  // La présence lue : tous les tours, les tours nommés, ou, en mise à jour,
  // une cellule vide qui garde la présence de la personne (§ 10.1).
  ['import.presence.tous', 'tous les tours'],
  ['import.presence.tours', ({ tours }) => toursNommes(tours)],
  ['import.presence.inchangee', 'présence inchangée'],
  ['import.colonne.nonReconnue', 'non reconnue : ignorée'],
  ['import.colonne.aTrancher', 'à trancher'],
  ['import.colonne.ecartee', 'écartée par le choix'],
  ['import.ambiguite.question', 'Plusieurs colonnes répondent au même champ. Laquelle vaut :'],

  // --- L'aperçu : les lignes ---------------------------------------------------
  ['import.apercu.valides', ({ n }) => accorde(n, 'ligne valide', 'lignes valides')],
  ['import.apercu.refusees', 'Lignes refusées'],
  ['import.apercu.ligne', 'Ligne'],
  ['import.apercu.motif', 'Motif'],
  ['import.apercu.fusions', 'Orthographes fondues en une organisation'],
  ['import.apercu.orthographeLignes', ({ n }) => accorde(n, 'ligne', 'lignes')],
  ['import.apercu.affichee', 'affichée :'],
  ['import.apercu.fusionsEtiquettes', 'Orthographes fondues en une étiquette'],
  ['import.apercu.retenue', 'retenue :'],
  ['import.apercu.orthographes', 'orthographes :'],
  ['import.apercu.lignesReecrites', ({ n }) => accorde(n, 'ligne réécrite', 'lignes réécrites')],
  ['import.apercu.doublons', 'Doublons signalés, jamais fusionnés'],
  // Les lignes d'un doublon, rangs du fichier en-tête compris, ceux de la
  // colonne « Ligne » : « lignes 15, 16 et 17 ».
  [
    'import.apercu.doublonLignes',
    ({ lignes }, texte) =>
      `${accorde(lignes.length, 'ligne', 'lignes')} ${enumeration(lignes.map((ligne) => creerFormat(texte).nombre(ligne)))}`,
  ],
  ['import.apercu.doublonExistants', 'déjà dans la liste :'],
  ['import.apercu.renommes', 'Noms rendus uniques'],
  [
    'import.apercu.nomsRendusUniques',
    ({ n }) => accorde(n, 'nom rendu unique par un suffixe numéroté', 'noms rendus uniques par un suffixe numéroté'),
  ],
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
  ['import.remede.aucunEnteteObjectifs', "Ajoutez une ligne d'en-tête qui nomme les colonnes, « table » et « objectif » au moins."],
  ['import.remede.tableNonAssociee', 'Nommez « table » la colonne des numéros de table.'],
  ['import.remede.objectifNonAssocie', 'Nommez « objectif » la colonne des étiquettes visées.'],
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
    'import.remede.conflitOrganisation',
    ({ ligne }) =>
      `Corrigez la colonne des conflits à la ligne ${ligne} \u{2014} ou ajoutez au fichier une personne de cette ` +
      'organisation \u{2014}, puis importez le fichier de nouveau.',
  ],
  [
    'import.remede.conflitPropre',
    ({ ligne }) =>
      `Retirez de la colonne des conflits, à la ligne ${ligne}, l'organisation de la personne, ` +
      'puis importez le fichier de nouveau.',
  ],
  [
    'import.remede.conflitOrganisationCollage',
    ({ ligne }) =>
      `Corrigez la colonne des conflits à la ligne ${ligne} \u{2014} ou ajoutez au texte une personne de cette ` +
      'organisation \u{2014}, puis collez-le de nouveau.',
  ],
  [
    'import.remede.conflitPropreCollage',
    ({ ligne }) =>
      `Retirez de la colonne des conflits, à la ligne ${ligne}, l'organisation de la personne, ` +
      'puis collez le texte de nouveau.',
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
  // Les logos des personnes retirées, que le CSV ne porte pas : l'élément
  // ne s'affiche qu'à partir de 1.
  ['import.remplacer.logos', ({ n }) => `${n} ${accorde(n, 'logo sera retiré', 'logos seront retirés')}`],

  // --- La fenêtre de « Remplacer » des objectifs (§ 10.4) ----------------------
  ['import.remplacer.titreObjectifs', 'Remplacer les objectifs des tables'],
  [
    'import.remplacer.objectifs',
    ({ n }) => `${n} ${accorde(n, 'objectif de table sera supprimé', 'objectifs de table seront supprimés')}`,
  ],
  ['import.remplacer.tables', ({ n }) => `${n} ${accorde(n, 'table perdra ses objectifs', 'tables perdront leurs objectifs')}`],

  // --- Le rapport (§ 10.1) ---------------------------------------------------
  ['import.rapport.titre', "Rapport d'import"],
  ['import.rapport.ajoutes', ({ n }) => accorde(n, 'personne ajoutée', 'personnes ajoutées')],
  ['import.rapport.misAJour', ({ n }) => accorde(n, 'personne mise à jour', 'personnes mises à jour')],
  ['import.rapport.inchanges', ({ n }) => accorde(n, 'personne inchangée', 'personnes inchangées')],
  ['import.rapport.retires', ({ n }) => accorde(n, 'personne retirée', 'personnes retirées')],
  ['import.rapport.reservationsRetirees', ({ n }) => accorde(n, 'réservation retirée', 'réservations retirées')],
  ['import.rapport.rienEcrit', "Rien n'a changé dans la liste : seules des lignes refusées restent à lire."],
  ['import.rapport.objectifsAjoutes', ({ n }) => accorde(n, 'objectif ajouté', 'objectifs ajoutés')],
  ['import.rapport.objectifsRemplaces', ({ n }) => accorde(n, 'objectif remplacé', 'objectifs remplacés')],
  ['import.rapport.objectifsInchanges', ({ n }) => accorde(n, 'objectif inchangé', 'objectifs inchangés')],
  ['import.rapport.objectifsRetires', ({ n }) => accorde(n, 'objectif retiré', 'objectifs retirés')],
  ['import.rapport.tablesTouchees', ({ n }) => accorde(n, 'table dont les objectifs changent', 'tables dont les objectifs changent')],
  [
    'import.rapport.rienEcritObjectifs',
    "Aucun objectif de table n'a changé : seules des lignes refusées restent à lire.",
  ],
  ['import.rapport.designees', 'désignées :'],
]);
