// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les libellés de la section de l'impression (§ 11.2, § 11.5, § 11.6, § 11.8,
// Q3) : les titres de ses deux parties, « Badges » et « Plan », l'aperçu de la
// seconde ayant ses propres libellés (impression.*) ; les réglages de la
// planche — modèle de badge, case du pied TechnoLibre et son texte, cases de ce
// que le badge imprime, image des badges, source, imposition, ordre, colonnes
// de la liste —, ses commandes, les phrases de l'annonce que rend
// phrasesAnnonce (badges/modele.js), logos des participants compris, la planche
// et la liste produites, et la réédition. Chaque clé commence par « badges. ».
// Les refus de la planche sont des textes de l'application
// (application/libelles/planche.js), le nom d'un papier un libellé de l'aperçu
// (impression.papier.nom.*), que l'annonce lit par texte. Le chemin d'un
// fichier produit est une donnée : l'écran le pose dans son propre nœud, à côté
// de son intitulé.
import { compte, enumeration } from '../../application/libelles/aides.js';

export const TABLE = new Map([
  // --- Les deux parties de la section de l'impression -----------------------
  ['badges.partie.badges', 'Badges'],
  ['badges.partie.plan', 'Plan'],

  [
    'badges.introduction',
    'Un badge par personne présente, sur des cartes Avery 5392 prédécoupées ou en A6 à découper, ' +
      'avec une feuille de contrôle à mesurer avant d\u{2019}imprimer ; ' +
      'les mêmes badges se tirent aussi en liste CSV, pour un tableur.',
  ],

  // --- Les réglages de la planche (§ 11.6, Q3) ------------------------------
  ['badges.planche.titre', 'Planche de badges'],
  ['badges.modele.titre', 'Modèle de badge'],
  ['badges.modele.avery5392', 'Avery 5392 (six cartes prédécoupées par feuille Lettre)'],
  ['badges.modele.a6', 'A6 à découper (sur A4 ou Lettre)'],
  [
    'badges.modele.nonRetenu',
    'Le modèle choisi vaut pour cette séance, sans être retenu sur ce poste : les réglages locaux ne se sont pas écrits.',
  ],
  ['badges.technolibre.case', 'Pied TechnoLibre : une invitation et le logo en couleurs, sous le pied de chaque badge'],
  [
    'badges.technolibre.nonRetenu',
    'La case vaut pour cette séance, sans être retenue sur ce poste : les réglages locaux ne se sont pas écrits.',
  ],
  // Le texte du pied TechnoLibre (§ 8.5, § 11.4), sous sa case : le champ,
  // son aide, la commande qui remet la phrase d'origine, et l'annonce d'un
  // texte que le poste ne retient pas.
  ['badges.technolibre.texte', 'Texte du pied TechnoLibre'],
  ['badges.technolibre.texteAide', 'Laissé vide, le pied ne porte que le logo. Le texte se replie seul sur le badge.'],
  ['badges.technolibre.texteDefaut', 'Texte par défaut'],
  [
    'badges.technolibre.texteNonRetenu',
    'Le texte vaut pour cette séance, sans être retenu sur ce poste : les réglages locaux ne se sont pas écrits.',
  ],
  // Les cases de ce que le badge imprime (§ 11.4), une par donnée de
  // DONNEES_BADGE, sous l'intitulé du groupe qui porte aussi celle du pied
  // TechnoLibre ; le nom et les tours s'impriment toujours.
  ['badges.donnees.titre', 'Sur chaque badge, en plus du nom et des tours'],
  ['badges.donnees.organisation', 'Organisation'],
  ['badges.donnees.evenement', 'Nom de l\u{2019}événement'],
  ['badges.donnees.date', 'Date de l\u{2019}événement'],
  ['badges.donnees.horodatage', 'Date du placement'],
  ['badges.donnees.identifiant', 'Identifiant'],
  [
    'badges.donnees.nonRetenues',
    'Les cases valent pour cette séance, sans être retenues sur ce poste : les réglages locaux ne se sont pas écrits.',
  ],
  // La case qui met l'organisation en gros au-dessus du nom (§ 8.5, § 11.4),
  // dans le même groupe, et l'annonce d'une case que le poste ne retient pas.
  ['badges.organisationEnGros.case', 'Organisation en gros, au-dessus du nom'],
  [
    'badges.organisationEnGros.nonRetenu',
    'La case « Organisation en gros, au-dessus du nom » vaut pour cette séance, sans être retenue sur ce poste : les réglages locaux ne se sont pas écrits.',
  ],
  // L'image sur tous les badges (§ 8.9, § 11.4), réglage de l'événement :
  // sa case, puis, cochée, la vignette de l'image ou sa phrase, ses deux
  // commandes, et le groupe de sa position.
  ['badges.image.case', 'Image sur tous les badges'],
  ['badges.image.vignette', 'Image des badges'],
  ['badges.image.aucune', 'Aucune image choisie.'],
  ['badges.image.introuvable', 'Image introuvable : son fichier manque au dossier de l\u{2019}événement ou ne se lit pas.'],
  ['badges.image.choisir', 'Choisir l\u{2019}image'],
  ['badges.image.retirer', 'Retirer l\u{2019}image'],
  ['badges.image.position', 'Position de l\u{2019}image'],
  ['badges.image.position.haut', 'En haut'],
  ['badges.image.position.centre', 'Au centre'],
  ['badges.image.position.bas', 'En bas'],
  // La case qui laisse en blanc le nom des doublons (§ 8.5, § 11.4), dans le
  // même groupe, la note qui dit à quoi sert la place vide, et l'annonce
  // d'une case que le poste ne retient pas.
  ['badges.doublons.case', 'Laisser le nom des doublons en blanc'],
  ['badges.doublons.note', 'La place du nom reste vide, pour l\u{2019}écrire à la main.'],
  [
    'badges.doublons.nonRetenu',
    'La case « Laisser le nom des doublons en blanc » vaut pour cette séance, sans être retenue sur ce poste : les réglages locaux ne se sont pas écrits.',
  ],
  ['badges.source.titre', 'Placement imprimé'],
  ['badges.source.retenu', 'Le placement retenu'],
  ['badges.source.proposition', ({ id }) => `La proposition n° ${id}`],
  ['badges.imposition.titre', 'Imposition'],
  ['badges.imposition.feuille', 'Feuille par feuille (ciseaux, massicot à main)'],
  ['badges.imposition.pile', 'En pile (massicot qui tranche toute la rame)'],
  ['badges.ordre.titre', 'Ordre des badges'],
  ['badges.ordre.alphabetique', 'Alphabétique'],
  ['badges.ordre.table', 'Par table du premier tour'],
  // Les colonnes de la liste des badges en CSV (§ 8.5, § 11.6), une par
  // forme de COLONNES_LISTE_BADGES, et l'annonce d'un choix que le poste ne
  // retient pas.
  ['badges.liste.colonnes.titre', 'Colonnes de la liste (CSV)'],
  ['badges.liste.colonnes.parTour', 'Une colonne par tour'],
  ['badges.liste.colonnes.unique', 'Une seule colonne'],
  [
    'badges.liste.colonnes.nonRetenu',
    'Les colonnes choisies pour la liste valent pour cette séance, sans être retenues sur ce poste : les réglages locaux ne se sont pas écrits.',
  ],

  // --- Les commandes ----------------------------------------------------------
  ['badges.commande.preparer', 'Préparer'],
  ['badges.commande.produire', 'Produire la planche (PDF)'],
  ['badges.commande.produireListe', 'Produire la liste (CSV)'],
  ['badges.commande.ouvrirDossier', 'Ouvrir le dossier'],
  ['badges.produire.bloque', 'La planche ne se produit pas tant que le refus de l\u{2019}annonce tient.'],
  ['badges.liste.bloquee', 'La liste ne se produit pas tant que le refus du placement tient.'],

  // --- L'annonce, avant de produire (§ 11.2, § 11.5, § 11.8) ------------------
  ['badges.annonce.titre', 'Avant de produire'],
  ['badges.annonce.source.retenu', 'Source : le placement retenu.'],
  [
    'badges.annonce.source.proposition',
    ({ id }) => `Source : la proposition n° ${id}, qui n\u{2019}est pas le placement retenu.`,
  ],
  [
    'badges.annonce.comptes',
    ({ produits, participants, exclus }) =>
      `${compte(produits, 'badge', 'badges')} pour ${compte(participants, 'participant', 'participants')}` +
      `${exclus === 0 ? '' : `, ${compte(exclus, 'exclu', 'exclus')}`}.`,
  ],
  [
    'badges.annonce.reedition',
    ({ n }) => `Réédition : ${compte(n, 'badge', 'badges')}, que la feuille de contrôle annonce comme telle.`,
  ],
  // parPapier : par papier, la clé de son nom, ses planches, et s'il est
  // celui de la machine.
  [
    'badges.annonce.planches',
    ({ parPapier }, texte) =>
      `Planches : ${enumeration(
        parPapier.map(
          ({ nom, planches, choisi }) => `${compte(planches, 'planche', 'planches')} en ${texte(nom)}${choisi ? ' (papier utilisé)' : ''}`,
        ),
      )}.`,
  ],
  // Avery 5392 : les feuilles de cartes, sur le seul papier qu'il admet.
  ['badges.annonce.cartes', ({ planches }) => `Planches : ${compte(planches, 'feuille', 'feuilles')} de six cartes Avery 5392, sur Lettre.`],
  [
    'badges.annonce.homonymes',
    ({ nom, ids }) =>
      `${nom} : ${compte(ids.length, 'badge', 'badges')} que seul leur identifiant imprimé sépare, ` +
      `${enumeration(ids.map((id) => `n° ${id}`))}.`,
  ],
  [
    'badges.annonce.absents',
    ({ caracteres }) =>
      `Caractères absents de la police, imprimés sans glyphe et listés sur la feuille de contrôle : ${enumeration(
        caracteres.map(({ caractere, point }) => `« ${caractere} » (${point})`),
      )}.`,
  ],
  // L'image des badges, sa case cochée : aucune image choisie, son fichier
  // qui manque au dossier de l'événement ou ne se lit pas, ou le compte des
  // badges où elle ne trouve pas de place. Aucune ne bloque.
  ['badges.annonce.imageAucune', 'Image des badges : aucune image choisie, les badges s\u{2019}impriment sans image.'],
  [
    'badges.annonce.imageIntrouvable',
    'Image des badges introuvable dans le dossier de l\u{2019}événement : les badges s\u{2019}impriment sans image.',
  ],
  ['badges.annonce.imageIllisible', 'Image des badges illisible : les badges s\u{2019}impriment sans image.'],
  [
    'badges.annonce.imageSansPlace',
    ({ n }) =>
      n === 1
        ? 'Image des badges : retirée d\u{2019}un badge, faute de place.'
        : `Image des badges : retirée de ${n} badges, faute de place.`,
  ],
  // Les logos des participants : ceux dont le fichier manque au dossier de
  // l'événement, ceux qui ne se lisent pas, nommés par leur personne, et le
  // compte des badges où le logo ne trouve pas de place. Aucun ne bloque.
  [
    'badges.annonce.logosIntrouvables',
    ({ noms }) =>
      noms.length === 1
        ? `Logo introuvable dans le dossier de l\u{2019}événement pour ${noms[0]} : son badge s\u{2019}imprime sans logo.`
        : `Logos introuvables dans le dossier de l\u{2019}événement pour ${enumeration(noms)} : leurs badges s\u{2019}impriment sans logo.`,
  ],
  [
    'badges.annonce.logosIllisibles',
    ({ noms }) =>
      noms.length === 1
        ? `Logo illisible pour ${noms[0]} : son badge s\u{2019}imprime sans logo.`
        : `Logos illisibles pour ${enumeration(noms)} : leurs badges s\u{2019}impriment sans logo.`,
  ],
  [
    'badges.annonce.logosSansPlace',
    ({ n }) =>
      n === 1
        ? 'Logo du participant : retiré d\u{2019}un badge, faute de place sous ses tours.'
        : `Logo du participant : retiré de ${n} badges, faute de place sous leurs tours.`,
  ],
  [
    'badges.annonce.technolibreRetire',
    ({ n }) =>
      n === 1
        ? 'Pied TechnoLibre : retiré d\u{2019}un badge, faute de place sous ses tours.'
        : `Pied TechnoLibre : retiré de ${n} badges, faute de place sous leurs tours.`,
  ],
  [
    'badges.annonce.brouillon.retenu',
    'Chaque badge portera la mention BROUILLON : le plan n\u{2019}est ni retenu ni bloqué, ou son placement ne couvre pas tous les tours.',
  ],
  [
    'badges.annonce.brouillon.proposition',
    'Chaque badge portera la mention BROUILLON : une proposition n\u{2019}est pas le placement retenu.',
  ],
  ['badges.annonce.fichier', ({ nom }) => `Fichier : ${nom}`],
  [
    'badges.annonce.fichiers',
    ({ nom, nomControle }) => `Fichiers : ${nom}, puis la feuille de contrôle ${nomControle}, à imprimer sur papier ordinaire.`,
  ],

  // --- La planche produite (§ 11.6, décision 13) -----------------------------
  ['badges.produite.chemin', 'Planche déposée :'],
  ['badges.produite.telechargee', ({ nom }) => `Planche téléchargée sous le nom ${nom}.`],
  ['badges.produite.controle', 'Feuille de contrôle déposée :'],
  ['badges.produite.controleTelechargee', ({ nom }) => `Feuille de contrôle téléchargée sous le nom ${nom}.`],
  ['badges.produite.liste', 'Liste déposée :'],
  ['badges.produite.listeTelechargee', ({ nom }) => `Liste téléchargée sous le nom ${nom}.`],

  // --- La réédition (§ 11.8) --------------------------------------------------
  ['badges.reedition.titre', 'Rééditer des badges'],
  [
    'badges.reedition.explication',
    "Cochez les personnes dont le badge est à refaire : la planche ne porte qu'elles, et sa feuille de contrôle l'annonce.",
  ],
  ['badges.reedition.filtre', 'Chercher une personne'],
  ['badges.reedition.personnes', 'Personnes présentes'],
  ['badges.reedition.aucune', 'Aucune personne ne répond à cette recherche.'],
  ['badges.reedition.produire', ({ n }) => `Rééditer ${compte(n, 'badge', 'badges')}`],
]);
