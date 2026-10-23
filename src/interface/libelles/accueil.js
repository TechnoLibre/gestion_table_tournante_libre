// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les libellés de l'accueil : la liste des événements, les démonstrations, les
// opérations de fichiers, la corbeille, le dossier de travail et la
// récupération (§ 14.6). Chaque clé commence par « accueil. ». Les codes que
// l'accueil affiche — avis et questions du dossier de travail, refus, état
// illisible — gardent leur texte dans les tables de l'application.

// Une donnée — un chemin, une base — n'entre dans aucun libellé d'écran :
// le composant la rend dans son propre nœud, à côté du texte traduit
// (§ 14.6). Un compte s'accorde dans la phrase qui le porte.
import { creerFormat } from '../../application/format.js';

const compte = (n, singulier, pluriel) => `${n} ${n <= 1 ? singulier : pluriel}`;

// Un compte mis en forme comme les nombres de la liste — espace fine entre
// les milliers —, accordé à sa valeur.
const compteEnForme = (n, singulier, pluriel, texte) => `${creerFormat(texte).nombre(n)} ${n <= 1 ? singulier : pluriel}`;

export const TABLE = new Map([
  // --- L'en-tête de la liste (§ 8.1) ----------------------------------------
  // evenements, participants : le nombre de lignes et la somme des
  // participants qu'elles portent déjà (resumeDeLaListe, modele.js).
  [
    'accueil.entete.resume',
    ({ evenements, participants }, texte) =>
      `${compteEnForme(evenements, 'événement', 'événements', texte)} \u{00B7} ` +
      `${compteEnForme(participants, 'participant', 'participants', texte)} au total`,
  ],
  // La commande de l'en-tête qui mène au champ du nom de la création.
  ['accueil.entete.creer', 'Créer un événement'],

  // --- Les tuiles des filtres par état du plan (§ 8.1, § 9) ------------------
  // Le nom du groupe des tuiles ; celui de « tous » ; l'aide de chacune, qui
  // redit pour un état sa ligne du tableau du § 9.
  ['accueil.filtre.groupe', 'Filtrer par état du plan'],
  ['accueil.filtre.tous', 'Tous les événements'],
  ['accueil.filtre.aide.tous', 'tous les états'],
  ['accueil.filtre.aide.brouillon', 'on prépare'],
  ['accueil.filtre.aide.propose', 'des placements existent, aucun n\u{2019}est retenu'],
  ['accueil.filtre.aide.retenu', 'un placement est en vigueur'],
  ['accueil.filtre.aide.bloque', 'rien ne peut plus changer'],
  // Le tableau quand le filtre ne retient aucune ligne.
  ['accueil.filtre.vide', 'Aucune ligne ne porte cet état : choisir « Tous les événements » les montre toutes.'],

  // --- Le tableau des événements (§ 8.1) ---------------------------------------
  ['accueil.liste.titre', 'Événements'],
  // Le choix du groupement, et ses deux valeurs.
  ['accueil.groupement.libelle', 'Grouper par'],
  ['accueil.groupement.etat', 'État du plan'],
  ['accueil.groupement.aucun', 'Aucun groupement'],
  // L'intitulé d'un groupe : le nom de son état, ou celui des états qui ne
  // se lisent pas, puis son compte (evenements).
  ['accueil.groupe.illisible', 'État illisible'],
  ['accueil.groupe.compte', ({ evenements }, texte) => compteEnForme(evenements, 'événement', 'événements', texte)],
  // Les en-têtes de groupes de colonnes ; la meilleure proposition porte le
  // titre du bloc de la génération.
  ['accueil.entete.evenement', 'Événement'],
  ['accueil.entete.retenu', 'Placement retenu'],
  ['accueil.colonne.nom', 'Nom'],
  ['accueil.colonne.actions', 'Actions'],
  // La commande qui ouvre l'événement de la ligne, en lecture.
  ['accueil.ouvrir', 'Ouvrir'],

  // --- La liste (§ 8.1) ----------------------------------------------------
  // Les intitulés des informations d'une ligne : en-têtes des colonnes, et,
  // pour la date et le chemin, l'intitulé caché à l'œil qui les précède sous
  // le nom, en tête de ligne. Le nom est l'en-tête de la ligne ; « Ouvrir »
  // ouvre l'événement.
  ['accueil.colonne.date', 'Date'],
  ['accueil.colonne.etat', 'État'],
  ['accueil.colonne.participants', 'Participants'],
  ['accueil.colonne.modification', 'Dernière modification'],
  ['accueil.colonne.chemin', 'Fichier'],
  // Les mesures du placement retenu (§ 5.4, § 8.1) : l'intitulé de chacune
  // est celui de la colonne du tableau des propositions qui porte la même
  // mesure ; l'explication que l'infobulle de l'intitulé donne dit ce que
  // compte le nombre, d'où il vient, et quand il vaut « — ».
  [
    'accueil.explication.collisionsCumulees',
    'Les collisions du placement retenu. Chaque fois que deux personnes de la même organisation partagent une ' +
      'table, compté une fois par paire et par tour : deux collègues ensemble aux quatre tours font 4. Le même nombre ' +
      'que la colonne « Collisions cumulées (paire et tour) » du tableau des propositions, sur la ligne du retenu. ' +
      "Plus il est bas, mieux c'est. « \u{2014} » quand aucun placement n'est retenu, ou que le retenu ne décrit " +
      "plus la configuration, ou se contredit.",
  ],
  [
    'accueil.explication.rencontresRepetees',
    "Les rencontres répétées du placement retenu : les paires de personnes réunies à la même table à plus d'un " +
      'tour que le placement a choisies, comptées une fois par paire : deux personnes ensemble à trois tours font 1. ' +
      "Une paire que les réservations réunissent à chacune de ses rencontres n'y entre pas. Le même nombre que " +
      'la colonne « Rencontres répétées choisies (paires) » du tableau des propositions, sur la ligne du retenu. ' +
      "Plus il est bas, mieux c'est. « \u{2014} » quand aucun placement n'est retenu, ou que le retenu ne décrit " +
      'plus la configuration, ou se contredit.',
  ],

  // La meilleure proposition du classement de chaque événement (§ 5.4,
  // § 5.7) : son titre et son identifiant s'écrivent sous les libellés du
  // bloc de la génération ; l'explication du titre est propre à la liste,
  // qui l'écrit « — » quand rien n'est classé.
  [
    'accueil.explication.meilleure',
    "La proposition au rang 1 du classement de l'événement, celle que la section de la génération annonce en tête : " +
      'son identifiant. Le classement range les propositions comparables, retenue comprise ; ' +
      'le placement retenu se lit à part, sous ses propres intitulés. ' +
      "« \u{2014} » quand aucune proposition n'est classée : aucune proposition, ou aucune qui décrive encore la " +
      'configuration.',
  ],

  // L'annonce de la région d'état de la liste tant que le résumé d'une de
  // ses lignes se calcule (§ 8.1) ; les signes de chaque valeur sont muets.
  ['accueil.chargement', 'Calcul des colonnes de la liste\u{2026}'],

  // Le nom d'un état du plan (§ 9), que rend cleDEtat (modele.js).
  ['accueil.etat.brouillon', 'Brouillon'],
  ['accueil.etat.propose', 'Proposé'],
  ['accueil.etat.retenu', 'Retenu'],
  ['accueil.etat.bloque', 'Bloqué'],

  // autres : le nombre des autres bases qui portent le même identifiant
  // (§ 8.7, § 8.8) ; elles suivent le texte, chacune dans son propre nœud.
  [
    'accueil.signalement.doublon',
    ({ autres }) =>
      autres <= 1
        ? 'Le même événement se trouve aussi dans le fichier nommé ci-dessous : deux fichiers portent son ' +
          'identifiant, comme après un renommage interrompu. Gardez-en un, et supprimez l\u{2019}autre.'
        : `Le même événement se trouve aussi dans les ${autres} fichiers nommés ci-dessous : chacun porte son ` +
          'identifiant, comme après un renommage interrompu. Gardez-en un, et supprimez les autres.',
  ],

  // --- La création (§ 2.1, étape 1) ----------------------------------------
  ['accueil.creation.titre', 'Créer un événement'],
  ['accueil.creation.nom', 'Nom de l\u{2019}événement'],
  // Le sélecteur de date montre son propre format, celui du poste.
  ['accueil.creation.date', 'Date, facultative'],
  ['accueil.creation.creer', 'Créer l\u{2019}événement'],

  // --- Les opérations de fichiers (§ 8.7) ----------------------------------
  ['accueil.operation.importer', 'Importer un événement depuis un fichier\u{2026}'],
  ['accueil.operation.copier', 'Copier'],
  ['accueil.operation.renommer', 'Renommer'],
  ['accueil.operation.supprimer', 'Supprimer'],
  ['accueil.operation.confirmerSuppression', 'Confirmer : déplacer dans la corbeille'],
  ['accueil.operation.nomCopie', 'Nom de la copie'],
  ['accueil.operation.nouveauNom', 'Nouveau nom'],
  ['accueil.operation.validerCopie', 'Créer la copie'],
  ['accueil.operation.validerRenommage', 'Renommer l\u{2019}événement'],
  ['accueil.operation.annuler', 'Annuler'],

  // --- Les démonstrations (§ 15) ---------------------------------------------
  ['accueil.demonstrations.titre', 'Démonstrations'],
  [
    'accueil.demonstrations.explication',
    'Chacune se charge comme un nouvel événement, numéroté et ouvert en lecture ; ' +
      'aucun autre événement n\u{2019}est touché.',
  ],
  // Une autre démonstration cliquée pendant un chargement : le nom de celle
  // qui se charge est une donnée.
  ['accueil.demonstrations.enCours', ({ nom }) => `${nom} se charge : attendre qu\u{2019}elle s\u{2019}ouvre.`],

  // --- La corbeille (§ 8.7) --------------------------------------------------
  ['accueil.corbeille.titre', 'Corbeille'],
  [
    'accueil.corbeille.explication',
    'Un événement supprimé y est déplacé avec tous ses fichiers, dans un dossier daté. ' +
      'Le logiciel ne la vide jamais.',
  ],

  // --- Le dossier de travail (§ 8.6) -----------------------------------------
  ['accueil.dossier.titre', 'Dossier de travail'],
  ['accueil.dossier.explorateur', 'Ouvrir dans l\u{2019}explorateur'],
  ['accueil.question.reessayer', 'Réessayer'],
  ['accueil.question.documents', 'Travailler dans les Documents, en y copiant ces événements'],
  ['accueil.question.continuer', 'Continuer : ouvrir la liste, aucun geste ne s\u{2019}y enregistrera'],
  // evenements : ce que porte l'autre emplacement, dont le chemin suit le
  // texte, dans son propre nœud.
  [
    'accueil.autre.proposition',
    ({ evenements }) =>
      `Le dossier de travail est neuf, et cet autre dossier porte ${compte(evenements, 'événement', 'événements')} :`,
  ],
  [
    'accueil.autre.originaux',
    'L\u{2019}import les copie : les originaux restent où ils sont, et chaque copie vit ensuite sa propre vie.',
  ],
  ['accueil.autre.importer', 'Importer ces événements'],
  // importes, refuses : les comptes de l'import de l'autre emplacement.
  [
    'accueil.autre.resultat',
    ({ importes, refuses }) =>
      refuses === 0
        ? `${compte(importes, 'événement importé', 'événements importés')}.`
        : `${compte(importes, 'événement importé', 'événements importés')} ; ` +
          `${compte(refuses, 'ne s\u{2019}est pas importé', 'ne se sont pas importés')}.`,
  ],

  // --- La récupération (§ 8.8) -----------------------------------------------
  ['accueil.recuperation.titre', 'Récupération d\u{2019}un événement'],
  ['accueil.recuperation.fichier', 'Fichier'],
  [
    'accueil.recuperation.offerte',
    'La version choisie s\u{2019}ouvre en lecture : rien ne s\u{2019}écrit avant un geste en écriture.',
  ],
  [
    'accueil.recuperation.aucunSecours',
    'Aucune version de secours ne se lit : l\u{2019}événement ne s\u{2019}ouvre pas, et rien n\u{2019}est créé à sa place.',
  ],
  ['accueil.recuperation.retour', 'Revenir à la liste'],
]);
