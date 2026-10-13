// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés du tableau des propositions (§ 5.4, § 5.5, § 5.7, § 9,
// § 14.6). Chaque clé commence par « propositions. ».
//
// Chaque en-tête de colonne nomme son unité (§ 5.4) : collisions cumulées,
// paires distinctes et excédent ne se confondent jamais. Des rencontres, le
// tableau ne porte que le minimum, sur les trois populations du § 5.4 ; la
// moyenne n'y paraît pas. La phrase de l'ordre nomme les paliers appliqués,
// chaque valeur qu'un palier applique par sa clé moteur.valeur.<valeur>,
// puis l'identifiant croissant, qui départage deux propositions égales sur
// tous (§ 5.7, A11).
import { creerFormat } from '../../application/format.js';
import { compte } from '../../application/libelles/aides.js';

// Un nombre de propositions, mis en forme, et son nom accordé.
const propositions = (n, texte) => `${creerFormat(texte).nombre(n)} ${n <= 1 ? 'proposition' : 'propositions'}`;

// « la meilleure » pour une, « les N meilleures » au-delà, N mis en forme.
const meilleures = (n, texte) => (n <= 1 ? 'la meilleure' : `les ${creerFormat(texte).nombre(n)} meilleures`);

// Le nom d'un critère du classement, celui de la table du moteur.
const critere = (nom, texte) => texte(`moteur.critere.${nom}`);

// Les noms d'un critère appliqué, {valeurs} : chaque valeur qu'il classe,
// séparées par « puis ».
const valeursDe = ({ valeurs }, texte) => valeurs.map((valeur) => texte(`moteur.valeur.${valeur}`)).join(texte('propositions.ordre.separateur'));

// Un palier, ses critères {nom, poids, valeurs} : les noms du critère seul ;
// pour un palier partagé, « ensemble, » puis chaque critère suivi de son
// poids. Les mêmes morceaux que la phrase de l'ordre (palierEnMorceaux,
// propositions/modele.js).
const palier = (criteres, texte) =>
  criteres.length === 1
    ? valeursDe(criteres[0], texte)
    : texte('propositions.ordre.ensemble') +
      criteres
        .map((applique) => `${valeursDe(applique, texte)}${texte('propositions.ordre.poids', { poids: applique.poids })}`)
        .join(texte('propositions.ordre.virgule'));

export const TABLE = new Map([
  // --- La section (§ 5.7) ------------------------------------------------------
  ['propositions.tableau.titre', 'Propositions classées'],
  ['propositions.aucune', "Aucune proposition : la génération en produit, et chaque génération s'ajoute aux précédentes."],
  // La phrase des critères se compose de morceaux, chacun sa clé : le début,
  // les noms des valeurs appliquées, le séparateur des paliers, les mots d'un
  // palier partagé — « ensemble, », le poids qui suit chaque critère, la
  // virgule entre deux critères —, l'identifiant croissant et la fin.
  // L'affichage les met bout à bout, chaque nom dans son propre élément.
  // propositions.ordre.criteres assemble en une seule chaîne celle de l'ordre
  // fixe de référence, sur la liste de ses critères : sous l'ordre par
  // défaut, les quatre cases cochées, sans objectif ni case des animateurs,
  // la phrase affichée l'égale mot pour mot.
  ['propositions.ordre.debut', "Ordre du classement, chaque critère au plus faible d'abord : "],
  ['propositions.ordre.separateur', ', puis '],
  ['propositions.ordre.ensemble', (_, texte) => `${texte('moteur.palier.ensemble')}, `],
  ['propositions.ordre.poids', ({ poids }, texte) => ` (${texte('moteur.palier.poids', { poids })})`],
  ['propositions.ordre.virgule', ', '],
  ['propositions.ordre.identifiant', "l'identifiant croissant"],
  ['propositions.ordre.fin', '.'],
  [
    'propositions.ordre.criteres',
    ({ criteres }, texte) =>
      texte('propositions.ordre.debut') +
      [...criteres.map((nom) => critere(nom, texte)), texte('propositions.ordre.identifiant')].join(texte('propositions.ordre.separateur')) +
      texte('propositions.ordre.fin'),
  ],
  // Le critère sauté, puis le palier appliqué à sa place : un critère seul
  // s'y nomme par les valeurs qu'il applique ; un palier partagé se lit
  // « ensemble, » suivi de chaque critère et de son poids. applique null,
  // aucun palier ne prend sa place, et la seconde phrase se tait.
  [
    'propositions.ordre.saute',
    ({ saute, applique }, texte) =>
      `Critère sauté, faute de plafond a priori par personne : ${critere(saute, texte)}.` +
      (applique === null ? '' : ` Appliqué à sa place : ${palier(applique, texte)}.`),
  ],

  // --- Les pages du classement (§ 5.7) -------------------------------------------
  // Au-delà de cent propositions, le classement se lit page à page ; chaque
  // nav des pages se nomme, celle du dessus et celle du dessous. L'étendue
  // reçoit ses nombres déjà mis en forme (texteEtendue,
  // propositions/modele.js), et nombre, le compte de la page, qui accorde
  // son nom.
  ['propositions.pages.haut', 'Pages du classement'],
  ['propositions.pages.bas', 'Pages du classement, sous le tableau'],
  ['propositions.pages.precedentes', 'Précédentes'],
  ['propositions.pages.suivantes', 'Suivantes'],
  [
    'propositions.pages.etendue',
    ({ premier, dernier, total, nombre }) =>
      nombre <= 1 ? `Proposition ${premier} sur ${total}` : `Propositions ${premier} à ${dernier} sur ${total}`,
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
  ['propositions.colonne.jamaisServies', 'Personnes jamais servies par un objectif'],
  ['propositions.colonne.horsObjectifMax', "Tours hors objectif d'une personne, au plus"],
  ['propositions.colonne.toursHorsObjectif', 'Tours hors objectif (personne et tour)'],
  ['propositions.colonne.toursSelonObjectif', "Tours selon l'objectif s(p), minimum"],
  ['propositions.colonne.animateursRencontres', 'Animateurs rencontrés m(p), minimum'],
  ['propositions.colonne.animateursNonRencontres', 'Animateurs non rencontrés (personne et animateur)'],
  ['propositions.colonne.certificat', 'Certificat'],
  ['propositions.colonne.imposes', 'Imposé par les réservations'],
  ['propositions.colonne.commandes', 'Commandes'],

  // --- Les groupes d'en-têtes, au-dessus des colonnes -------------------------
  // Chaque groupe réunit des colonnes voisines ; les en-têtes de colonne
  // gardent chacun son unité. Le sixième ne paraît que quand le critère des
  // objectifs ou celui des animateurs compte (A11).
  ['propositions.groupe.rencontres', 'Personnes rencontrées'],
  ['propositions.groupe.collisions', "Collisions d'appartenance"],
  ['propositions.groupe.repetitions', 'Rencontres répétées et retours'],
  ['propositions.groupe.diversite', "Diversité d'appartenance"],
  ['propositions.groupe.manque', 'Manque et plafond a priori'],
  ['propositions.groupe.objectifs', 'Objectifs des tables et animateurs'],

  // --- Les explications, une par colonne (§ 5.4, § 5.5, § 5.7, § 12.10.4) --------
  // Le texte de l'infobulle d'un en-tête, et celui du nom de la valeur
  // appliquée qui désigne la colonne dans la phrase de l'ordre : une valeur
  // appliquée et sa colonne partagent la clé. Chacune dit ce que la colonne
  // compte, sur quelle population, et dans quel sens elle sert le mieux quand
  // ce sens existe ; les termes sont ceux du glossaire du § 5.5. Celle d'une
  // valeur qui classe ne fixe aucun rang : l'ordre se règle, et sa place se
  // lit dans la phrase de l'ordre au-dessus du tableau ; un rang par défaut
  // s'y dit comme tel.
  [
    'propositions.explication.rang',
    "La place de la proposition dans le classement, 1 pour la première, selon l'ordre écrit au-dessus du tableau. " +
      "Une proposition hors classement n'a pas de rang.",
  ],
  [
    'propositions.explication.proposition',
    'Le numéro de la proposition, donné à sa génération ; un numéro effacé ne revient jamais. ' +
      'Il sert de dernier départage : deux propositions égales sur tous les critères se rangent par numéro croissant.',
  ],
  [
    'propositions.explication.rencontresTous',
    'Le nombre de personnes différentes que rencontre, sur toute la soirée, la personne la moins bien servie : ' +
      "quelqu'un revu à plusieurs tours compte une fois. Il porte sur toutes les personnes placées, ancrées comprises. " +
      "Plus il est grand, mieux c'est.",
  ],
  [
    'propositions.explication.rencontresMobiles',
    "Le même minimum, sur les seules personnes mobiles, celles qu'aucune réservation n'assied à la même table à tous les tours, " +
      "partiellement fixées comprises ; « \u{2014} » s'il n'y en a aucune. Comparé aux deux autres, il dit si un minimum bas vient " +
      "du placement ou des réservations. Plus il est grand, mieux c'est.",
  ],
  [
    'propositions.explication.rencontresAncres',
    "Le même minimum, sur les seules personnes ancrées, celles qu'une réservation assied à la même table à chaque tour ; " +
      "« \u{2014} » s'il n'y en a aucune. Plus il est grand, mieux c'est.",
  ],
  [
    'propositions.explication.collisionsCumulees',
    'Chaque fois que deux personnes de la même appartenance partagent une table, compté une fois par paire et par tour : ' +
      "deux collègues ensemble aux quatre tours font 4. Critère du classement à la place que lui donne " +
      "l'ordre écrit au-dessus du tableau ; l'ordre par défaut le lit après l'excédent, pour départager deux " +
      "propositions de même excédent. Plus il est bas, mieux c'est.",
  ],
  [
    'propositions.explication.pairesDistinctes',
    'Le nombre de paires différentes de personnes de la même appartenance réunies au moins une fois : deux collègues ' +
      "ensemble aux quatre tours font 1. Ce n'est pas un critère du classement : il vaut les collisions cumulées moins " +
      "l'excédent.",
  ],
  [
    'propositions.explication.excedentCollisions',
    'Les retrouvailles entre personnes de même appartenance après leur première rencontre, soit les collisions ' +
      'cumulées moins les paires distinctes : deux collègues ensemble aux quatre tours font 3. Critère du classement ' +
      "placé par l'ordre écrit au-dessus du tableau, par défaut avant les collisions cumulées : passer la soirée avec " +
      "le même collègue est pire que croiser six collègues une fois. Plus il est bas, mieux c'est.",
  ],
  [
    'propositions.explication.rencontresRepetees',
    "Le nombre de paires de personnes réunies à plus d'un tour que le placement a choisies ; celles qu'imposent les " +
      "réservations sont dans la colonne des imposés. Critère du classement à la place que lui donne l'ordre écrit " +
      'au-dessus du tableau. ' +
      "Plus il est bas, mieux c'est.",
  ],
  [
    'propositions.explication.maxRencontresPaire',
    'Le plus grand nombre de tours que passe une même paire de personnes à la même table, réservations comprises ; ' +
      "à 1, personne ne retrouve personne. Plus il est bas, mieux c'est.",
  ],
  [
    'propositions.explication.retoursChoisis',
    "Le nombre de fois où une personne revient à une table où elle s'est déjà assise, additionné sur toutes les personnes ; " +
      "seuls comptent les retours que le placement a choisis, ceux qu'imposent les réservations étant dans la colonne " +
      "des imposés. Critère du classement quand seule « nouvelle table » est cochée, là où l'ordre écrit au-dessus du " +
      "tableau place les rencontres répétées. " +
      "Plus il est bas, mieux c'est.",
  ],
  [
    'propositions.explication.appartenancesVues',
    "A(p) : le nombre d'appartenances différentes parmi les personnes que p rencontre et qui en ont une, la sienne " +
      "comptée dès qu'elle rencontre un collègue. La colonne donne le plus petit A(p), celui de la personne qui en voit " +
      "le moins. Plus il est grand, mieux c'est.",
  ],
  [
    'propositions.explication.totalRedondance',
    "r(p) : le nombre de personnes que p rencontre et qui ont une appartenance, moins A(p), le nombre d'appartenances " +
      "différentes qu'elles portent ; à 0, aucune appartenance n'est recroisée. La colonne donne la somme sur toutes les " +
      "personnes, Σ r(p), critère du classement à la place que lui donne l'ordre écrit au-dessus du tableau. " +
      "Plus elle est basse, mieux c'est.",
  ],
  [
    'propositions.explication.diversite',
    "d(p) : A(p) divisé par le nombre de personnes que p rencontre et qui ont une appartenance ; à 1, elles portent " +
      "toutes des appartenances différentes. La colonne donne le plus petit d(p), « \u{2014} » quand personne ne rencontre " +
      "quelqu'un qui en a une. Plus il est grand, mieux c'est.",
  ],
  [
    'propositions.explication.manqueMax',
    "Le manque d'une personne : son plafond réalisé, le plus de rencontres que permettent les tables où la proposition " +
      "l'assoit et leur occupation, moins ses rencontres. La colonne donne le plus grand manque ; un manque nul ne dit " +
      "rien d'un itinéraire bas, que l'écart d'itinéraire montre. Plus il est bas, mieux c'est.",
  ],
  [
    'propositions.explication.effectifManque',
    "Le nombre de personnes dont le manque vaut au moins 1 ; 0 veut dire que personne n'a de manque. " +
      "Il dit si le plus grand manque touche une personne ou beaucoup : déplacer quelqu'un, ou ajouter une table. " +
      "Plus il est bas, mieux c'est.",
  ],
  [
    'propositions.explication.ecartItineraireMax',
    "L'écart d'itinéraire d'une personne : son plafond a priori moins son plafond réalisé, ce que son itinéraire lui " +
      'retire avant toute rencontre \u{2014} moins de tables différentes, des tables incomplètes, des tours en réserve. ' +
      "La colonne donne le plus grand, « inconnu » quand le plafond a priori n'a pas pu être calculé. " +
      "Plus il est bas, mieux c'est.",
  ],
  [
    'propositions.explication.ecartAuPlafondAPriori',
    "Pour chaque personne, son plafond a priori, le plus de rencontres que permettent les " +
      "capacités des tables sur le meilleur itinéraire, moins ses rencontres, soit son manque plus son écart d'itinéraire. " +
      "La colonne donne le plus grand, critère du classement à sa place dans l'ordre écrit au-dessus du tableau ; " +
      "sans plafond a priori calculé, il est sauté et la cellule écrit « inconnu ». " +
      "Plus il est bas, mieux c'est.",
  ],
  // Les colonnes des objectifs des tables et des animateurs (A9) : une
  // personne est concernée par les objectifs quand une table qui lui
  // correspond peut l'accueillir à un tour au moins, par les animateurs
  // quand elle peut en rencontrer un là où il anime.
  [
    'propositions.explication.jamaisServies',
    "Les personnes concernées par un objectif de table, celles qui ont au moins un tour possible, que le placement " +
      "n'assied jamais à une table dont l'objectif leur correspond. Critère du classement sous le mode « chacun au moins " +
      "une fois », lu avant les tours hors objectif, au palier que l'ordre écrit au-dessus du tableau " +
      "donne aux objectifs. " +
      "Plus il est bas, mieux c'est.",
  ],
  [
    'propositions.explication.horsObjectifMax',
    "Pour chaque personne concernée par un objectif, ses tours possibles moins ses tours selon l'objectif ; la colonne " +
      "donne le plus grand, celui de la personne la moins servie. Critère du classement sous le mode qui sert d'abord " +
      "la personne la moins servie, lu avant les tours hors objectif, au palier que l'ordre écrit au-dessus du " +
      "tableau donne aux objectifs. Plus il est bas, mieux c'est.",
  ],
  [
    'propositions.explication.toursHorsObjectif',
    "Les couples d'une personne et d'un tour où une table dont l'objectif lui correspond pouvait l'accueillir, mais où " +
      "le placement l'assied ailleurs, additionnés sur toutes les personnes. Critère du classement quand des objectifs " +
      "de table peuvent servir quelqu'un, à la place que lui donne l'ordre écrit au-dessus du tableau. " +
      "Plus il est bas, mieux c'est.",
  ],
  [
    'propositions.explication.toursSelonObjectif',
    "s(p) : le nombre de tours où p est assis à une table dont l'objectif lui correspond. La colonne donne le plus " +
      "petit s(p) parmi les personnes concernées, celles qu'une table à objectif peut accueillir à un tour au moins. " +
      "Plus il est grand, mieux c'est.",
  ],
  [
    'propositions.explication.animateursRencontres',
    "m(p) : le nombre d'animateurs différents que p rencontre à un tour où ils animent, un animateur revu comptant " +
      "une fois. La colonne donne le plus petit m(p) parmi les personnes qui peuvent en rencontrer au moins un. " +
      "Plus il est grand, mieux c'est.",
  ],
  [
    'propositions.explication.animateursNonRencontres',
    "Pour chaque personne, le nombre d'animateurs qu'elle pouvait rencontrer là où ils animent, selon les tables et " +
      "les réservations, moins ceux qu'elle rencontre, additionné sur toutes les personnes. Critère du classement quand " +
      "la case des animateurs est cochée, à la place que lui donne l'ordre écrit au-dessus du tableau. " +
      "Plus il est bas, mieux c'est.",
  ],
  [
    'propositions.explication.certificat',
    '« minimum atteint » quand chaque personne rencontre autant de monde que son plafond a priori le permet : ' +
      'personne ne peut en rencontrer davantage. Sinon, « atteignabilité inconnue » : le logiciel ne sait pas si un ' +
      'placement peut y parvenir pour tous.',
  ],
  [
    'propositions.explication.imposes',
    'Ce que les réservations imposent, compté à part et jamais ajouté aux colonnes du placement : les retours à une ' +
      'table que fixent les ancrages, et les rencontres répétées entre personnes réservées ensemble à la même table.',
  ],
  [
    'propositions.explication.commandes',
    '« Voir sur le plan » montre la proposition sur le plan de salle, sans rien écrire. « Retenir » en fait le ' +
      "placement retenu, celui qu'on ajuste à la main ; les autres propositions restent dans la liste.",
  ],

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
  // « Qualité » montre la proposition de sa ligne au plan et ouvre la page
  // de qualité, qui la mesure (§ 12).
  ['propositions.commande.qualite', 'Qualité'],
  ['propositions.commande.effacer', 'Effacer les propositions'],
  ['propositions.commande.garder', ({ n }, texte) => `Garder ${meilleures(n, texte)}`],

  // --- Garder les meilleures (§ 5.7) ---------------------------------------------
  // n : le nombre à garder ; effacees : celles qui s'effacent, comptées par
  // nettoyage (evaluation.js) ; proposition : celle du retenu, gardée en plus.
  ['propositions.nettoyage.champ', 'Propositions à garder'],
  [
    'propositions.nettoyage.titre',
    ({ n, effacees }, texte) => `Effacer ${propositions(effacees, texte)} et garder ${meilleures(n, texte)} ?`,
  ],
  [
    'propositions.nettoyage.gardees',
    ({ n }, texte) =>
      n <= 1
        ? 'La première proposition du classement reste.'
        : `Les ${creerFormat(texte).nombre(n)} premières propositions du classement restent.`,
  ],
  [
    'propositions.nettoyage.origine',
    ({ proposition }) => `La proposition n° ${proposition} reste aussi : le placement retenu en vient.`,
  ],
  [
    'propositions.nettoyage.defaire',
    ({ effacees }, texte) =>
      effacees <= 1 ? '« Défaire » rend la proposition effacée.' : `« Défaire » rend les ${propositions(effacees, texte)} effacées.`,
  ],
  [
    'propositions.nettoyage.annonce',
    ({ effacees }, texte) => `${propositions(effacees, texte)} ${effacees <= 1 ? 'effacée' : 'effacées'}.`,
  ],

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
