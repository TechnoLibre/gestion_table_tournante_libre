// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les libellés de la section des badges (§ 11.2, § 11.5, § 11.6, § 11.8,
// Q3) : ses réglages — modèle de badge, source, imposition, ordre —, ses
// commandes, les phrases de l'annonce que rend phrasesAnnonce
// (badges/modele.js), la planche et la liste produites, et la réédition.
// Chaque clé commence par « badges. ». Les refus de la planche sont des
// textes de l'application (application/libelles/planche.js), le nom d'un
// papier un libellé de l'aperçu (impression.papier.nom.*), que l'annonce lit
// par texte. Le chemin d'un fichier produit est une donnée : l'écran le pose
// dans son propre nœud, à côté de son intitulé.
import { compte, enumeration } from '../../application/libelles/aides.js';

export const TABLE = new Map([
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
  ['badges.source.titre', 'Placement imprimé'],
  ['badges.source.retenu', 'Le placement retenu'],
  ['badges.source.proposition', ({ id }) => `La proposition n° ${id}`],
  ['badges.imposition.titre', 'Imposition'],
  ['badges.imposition.feuille', 'Feuille par feuille (ciseaux, massicot à main)'],
  ['badges.imposition.pile', 'En pile (massicot qui tranche toute la rame)'],
  ['badges.ordre.titre', 'Ordre des badges'],
  ['badges.ordre.alphabetique', 'Alphabétique'],
  ['badges.ordre.table', 'Par table du premier tour'],

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
