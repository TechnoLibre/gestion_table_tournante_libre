// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés de l'accueil : la liste des événements, les démonstrations, les
// opérations de fichiers, la corbeille, le dossier de travail et la
// récupération (§ 14.6). Chaque clé commence par « accueil. ». Les codes que
// l'accueil affiche — avis et questions du dossier de travail, refus, état
// illisible — gardent leur texte dans les tables de l'application.

// Une donnée — un chemin, une base — n'entre dans aucun libellé d'écran :
// le composant la rend dans son propre nœud, à côté du texte traduit
// (§ 14.6). Un compte s'accorde dans la phrase qui le porte.
import { CIBLE_REDONDANCE_PAR_DEFAUT } from '../../application/evaluation.js';

const compte = (n, singulier, pluriel) => `${n} ${n <= 1 ? singulier : pluriel}`;

export const TABLE = new Map([
  // --- La liste (§ 8.1) ----------------------------------------------------
  // Les intitulés des informations d'une ligne ; le nom est la commande qui
  // ouvre l'événement.
  ['accueil.colonne.date', 'Date'],
  ['accueil.colonne.etat', 'État'],
  ['accueil.colonne.participants', 'Participants'],
  ['accueil.colonne.modification', 'Dernière modification'],
  ['accueil.colonne.chemin', 'Fichier'],
  // Les deux mesures du placement retenu (§ 5.4, § 8.9), et l'explication
  // que l'infobulle de leur intitulé donne : ce que compte le nombre, d'où
  // il vient, et quand il vaut « — ».
  ['accueil.colonne.collisionsCumulees', 'Collisions cumulées (paire et tour)'],
  ['accueil.colonne.diffRedondance', "Diff somme d'appartenance"],
  [
    'accueil.explication.collisionsCumulees',
    'Celles du placement retenu : chaque fois que deux personnes de la même appartenance partagent une table, ' +
      'compté une fois par paire et par tour ; deux collègues ensemble aux quatre tours font 4. Le même nombre que la ' +
      "colonne « Collisions cumulées » du tableau des propositions. Plus il est bas, mieux c'est. " +
      "« \u{2014} » quand aucun placement n'est retenu, ou que le retenu ne décrit plus la configuration.",
  ],
  [
    'accueil.explication.diffRedondance',
    '|cible \u{2212} Σ r(p)| : la différence, sans signe, entre la cible de la soirée et la somme Σ r(p) du placement ' +
      "retenu, celle de la colonne « Redondance d'appartenance, somme Σ r(p) » du tableau des propositions. r(p) compte " +
      "les personnes que p rencontre et qui ont une appartenance, moins le nombre d'appartenances différentes qu'elles " +
      `portent. La cible vaut ${CIBLE_REDONDANCE_PAR_DEFAUT} tant qu'on ne la change pas, dans la section des ` +
      "propositions. « \u{2014} » quand aucun placement n'est retenu, ou que le retenu ne décrit plus la configuration.",
  ],

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
  ['accueil.creation.date', 'Date, facultative (AAAA-MM-JJ)'],
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
