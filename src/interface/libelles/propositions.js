// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés du tableau des propositions (§ 5.4, § 5.5, § 5.7, § 9,
// § 14.6). Chaque clé commence par « propositions. ».
//
// Chaque en-tête de colonne nomme son unité (§ 5.4) : collisions cumulées,
// paires distinctes et excédent ne se confondent jamais. Des rencontres, le
// tableau ne porte que le minimum, sur les trois populations du § 5.4 ; la
// moyenne n'y paraît pas. La phrase de l'ordre compose les noms des critères
// par leurs clés moteur.critere.<nom>, dans l'ordre reçu, puis l'identifiant
// croissant, qui départage deux propositions égales sur tous (§ 5.7).
import { compte } from '../../application/libelles/aides.js';

// Le nom d'un critère du classement, celui de la table du moteur.
const critere = (nom, texte) => texte(`moteur.critere.${nom}`);

export const TABLE = new Map([
  // --- La section (§ 5.7) ------------------------------------------------------
  ['propositions.tableau.titre', 'Propositions classées'],
  ['propositions.aucune', "Aucune proposition : la génération en produit, et chaque génération s'ajoute aux précédentes."],
  // La phrase des critères se compose de morceaux, chacun sa clé : le début,
  // les noms, leur séparateur, l'identifiant croissant et la fin. L'affichage
  // les met bout à bout, chaque nom dans son propre élément ;
  // propositions.ordre.criteres les assemble en une seule chaîne, la même.
  ['propositions.ordre.debut', "Ordre du classement, chaque critère au plus faible d'abord : "],
  ['propositions.ordre.separateur', ', puis '],
  ['propositions.ordre.identifiant', "l'identifiant croissant"],
  ['propositions.ordre.fin', '.'],
  [
    'propositions.ordre.criteres',
    ({ criteres }, texte) =>
      texte('propositions.ordre.debut') +
      [...criteres.map((nom) => critere(nom, texte)), texte('propositions.ordre.identifiant')].join(texte('propositions.ordre.separateur')) +
      texte('propositions.ordre.fin'),
  ],
  [
    'propositions.ordre.saute',
    ({ saute, applique }, texte) =>
      `Critère sauté, faute de plafond a priori par personne : ${critere(saute, texte)}. ` +
      `Appliqué à sa place : ${critere(applique, texte)}.`,
  ],

  // --- Les colonnes, chacune avec son unité (§ 5.4, § 5.5) ----------------------
  ['propositions.colonne.rang', 'Rang'],
  ['propositions.colonne.proposition', 'Proposition'],
  ['propositions.colonne.rencontresTous', 'Personnes distinctes rencontrées, minimum : tous'],
  ['propositions.colonne.rencontresMobiles', 'Personnes distinctes rencontrées, minimum : mobiles'],
  ['propositions.colonne.rencontresAncres', 'Personnes distinctes rencontrées, minimum : ancrés'],
  ['propositions.colonne.collisionsCumulees', 'Collisions cumulées (paire et tour)'],
  ['propositions.colonne.pairesDistinctes', 'Paires distinctes de même appartenance'],
  ['propositions.colonne.excedentCollisions', 'Excédent de collisions (retrouvailles au-delà de la première)'],
  ['propositions.colonne.rencontresRepetees', 'Rencontres répétées choisies (paires)'],
  ['propositions.colonne.maxRencontresPaire', "Rencontres d'une même paire, au plus"],
  ['propositions.colonne.retoursChoisis', 'Retours choisis à une table déjà occupée'],
  ['propositions.colonne.appartenancesVues', 'Appartenances rencontrées A(p), minimum'],
  ['propositions.colonne.totalRedondance', "Redondance d'appartenance, somme Σ r(p)"],
  ['propositions.colonne.diversite', 'Taux de diversité d(p), minimum'],
  ['propositions.colonne.manqueMax', 'Plus grand manque (personnes)'],
  ['propositions.colonne.effectifManque', 'Personnes à qui il en manque'],
  ['propositions.colonne.ecartItineraireMax', "Écart d'itinéraire maximal (personnes)"],
  ['propositions.colonne.ecartAuPlafondAPriori', 'Écart au plafond a priori maximal (personnes)'],
  ['propositions.colonne.certificat', 'Certificat'],
  ['propositions.colonne.imposes', 'Imposé par les réservations'],
  ['propositions.colonne.commandes', 'Commandes'],

  // --- Les valeurs écrites en mots (§ 5.5, § 12.6) ------------------------------
  ['propositions.valeur.inconnu', 'inconnu'],
  ['propositions.certificat.atteint', 'minimum atteint'],
  ['propositions.certificat.inconnue', 'atteignabilité inconnue'],

  // --- Ce que les réservations imposent, à part (§ 5.4) --------------------------
  [
    'propositions.imposes.retours',
    ({ retours, ancrages }) =>
      retours === 0
        ? 'Aucun retour imposé.'
        : `${compte(retours, 'retour imposé', 'retours imposés')} par ${compte(ancrages, 'ancrage', 'ancrages')}.`,
  ],
  [
    'propositions.imposes.repetees',
    ({ repetees }) =>
      repetees === 0
        ? 'Aucune rencontre répétée imposée.'
        : `${compte(repetees, 'rencontre répétée imposée', 'rencontres répétées imposées')}.`,
  ],

  // --- Les lignes (§ 5.7, § 9, § 12.6) -----------------------------------------
  ['propositions.marque.retenue', 'retenue'],
  ['propositions.retenu.titre', 'Placement retenu'],
  ['propositions.retenu.origine', ({ proposition }) => `Tel que la proposition n° ${proposition}.`],
  ['propositions.retenu.ajuste', ({ proposition }) => `Ajusté à la main depuis la proposition n° ${proposition}.`],
  ['propositions.horsClassement.titre', 'Hors classement'],
  ['propositions.statut.derive', 'Non comparable : la proposition ne décrit plus la configuration courante.'],
  ['propositions.statut.fautif', 'Non comparable : le placement se contredit.'],

  // --- Les commandes (§ 2.1 étape 10, § 5.7) ------------------------------------
  ['propositions.commande.voir', 'Voir sur le plan'],
  ['propositions.commande.retenir', 'Retenir'],
  ['propositions.commande.effacer', 'Effacer les propositions'],

  // --- Retenir sur un retenu ajusté (§ 2.1) ----------------------------------------
  [
    'propositions.confirmation.titre',
    ({ proposition }) => `Retenir la proposition n° ${proposition} détruit les ajustements du placement retenu`,
  ],
  [
    'propositions.confirmation.retenuAjuste',
    ({ proposition }) => `Le placement retenu, ajusté à la main depuis la proposition n° ${proposition}`,
  ],
  [
    'propositions.confirmation.remplacant',
    ({ proposition }) => `remplacé par la proposition n° ${proposition}, telle que générée`,
  ],
]);
