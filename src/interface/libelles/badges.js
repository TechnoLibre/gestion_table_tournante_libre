// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les libellés de la section des badges (§ 11.2, § 11.5, § 11.6, § 11.8,
// Q3) : ses réglages — source, imposition, ordre —, ses commandes, les
// phrases de l'annonce que rend phrasesAnnonce (badges/modele.js), la
// planche produite et la réédition. Chaque clé commence par « badges. ».
// Les refus de la planche sont des textes de l'application
// (application/libelles/planche.js), le nom d'un papier un libellé de
// l'aperçu (impression.papier.nom.*), que l'annonce lit par texte. Le
// chemin de la planche produite est une donnée : l'écran le pose dans son
// propre nœud, à côté de son intitulé.
import { compte, enumeration } from '../../application/libelles/aides.js';

export const TABLE = new Map([
  ['badges.introduction', "Un badge A6 par personne présente, imposé sur le papier de l'imprimante, précédé d'une feuille de contrôle."],

  // --- Les réglages de la planche (§ 11.6, Q3) ------------------------------
  ['badges.planche.titre', 'Planche de badges'],
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
  ['badges.commande.produire', 'Produire la planche'],
  ['badges.commande.ouvrirDossier', 'Ouvrir le dossier'],
  ['badges.produire.bloque', 'La planche ne se produit pas tant que le refus de l\u{2019}annonce tient.'],

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
          ({ nom, planches, choisi }) => `${compte(planches, 'planche', 'planches')} en ${texte(nom)}${choisi ? ' (papier choisi)' : ''}`,
        ),
      )}.`,
  ],
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

  // --- La planche produite (§ 11.6, décision 13) -----------------------------
  ['badges.produite.chemin', 'Planche déposée :'],
  ['badges.produite.telechargee', ({ nom }) => `Planche téléchargée sous le nom ${nom}.`],

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
