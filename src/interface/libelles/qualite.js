// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés de la page de qualité (§ 12 à § 12.14, § 14.6), une table.
// Chaque clé commence par « qualite. » : la source et ses cas, la liste des
// vues, le refus de dessiner, les pourcentages, puis un sous-préfixe par vue
// — tuile, profil, collisions, tables, paires, objectifs, animateurs,
// diversite, performance.
//
// Le signe « % » ne s'écrit que sous qualite.pourcentage.* : la valeur
// « N % », les graduations d'un axe en pourcentages et le libellé de sa
// règle, et la part des tours possibles servis (§ 12.8, D34, D52). Chaque
// pourcentage est un entier que le détail du placement porte déjà ; la page
// écrit dessous, juste après lui, le compte du pire, que ses clés de vue
// portent : sur une tuile, une synthèse ou la soirée, le pire cas de la
// population ; sur une ligne de jumeau ou d'infobulle, le compte de la ligne.
//
// Le vocabulaire est celui du glossaire (§ 5.5) : « borne de diversité » et
// « borne des animateurs », jamais « plafond » pour l'une ou l'autre ; les
// « points de relevé » de la recherche ; « le moins varié », « le plus
// varié » et « au minimum » pour la diversité d'un animateur ; « des tours
// possibles servis » pour la part servie des objectifs.
import { compte } from '../../application/libelles/aides.js';

export const TABLE = new Map([
  // --- La source et les cas sans source mesurable (§ 12, B9, § 12.6) ---------
  // La ligne de source nomme le placement mesuré, après cet intitulé, par le
  // libellé que la barre de vue du plan lui donne (plan.source.*) ; une
  // proposition fautive, que le plan ne montre jamais, a le sien.
  ['qualite.source.intitule', 'Placement mesuré :'],
  ['qualite.source.propositionFautive', ({ proposition }) => `Proposition n° ${proposition}, fautive : le plan ne la montre pas`],
  ['qualite.source.montrerPremiere', ({ proposition }) => `Montrer la proposition n° ${proposition}`],
  [
    'qualite.phrase.aucunPlacement',
    "Aucun placement à mesurer : ni proposition ni placement retenu. Le diagnostic dit ce que la configuration rend inévitable.",
  ],
  [
    'qualite.phrase.aucuneMontree',
    "Le plan ne montre aucune proposition : la page mesure la proposition demandée au plan, sinon le retenu. « Qualité », sur une ligne du tableau des propositions, en demande une.",
  ],
  ['qualite.phrase.aucuneComparable', 'Aucune proposition ne se compare : chacune est en dérive ou fautive.'],
  ['qualite.phrase.derive', 'Ce placement est en dérive : la page ne le mesure pas, pour ces raisons.'],
  ['qualite.phrase.fautif', 'Ce placement est fautif : la page ne le mesure pas, pour ces raisons.'],
  ['qualite.phrase.configuration', 'La configuration ne se normalise pas : la page ne mesure aucun placement.'],

  // --- Le refus de dessiner (§ 12.3) -----------------------------------------
  [
    'qualite.refus.phrase',
    'La page ne dessine pas ce placement : une mesure y contredit sa borne, et le calcul est faux. Chaque contradiction est nommée ci-dessous.',
  ],

  // --- Les vues, leurs titres et leurs questions (§ 12.1, B9, B10) -----------
  ['qualite.vues.titre', 'Vues de la page de qualité'],
  ['qualite.vue.entete.titre', 'En-tête chiffré'],
  ['qualite.vue.entete.question', "Ce placement est-il bon, et qui s'y trouve mal servi ?"],
  ['qualite.vue.profil.titre', 'Profil trié des rencontres'],
  ['qualite.vue.profil.question', 'Qui est le plus mal servi, de combien, et combien sont-ils ?'],
  ['qualite.vue.collisions.titre', "Collisions d'appartenance"],
  ['qualite.vue.collisions.question', "D'où vient le problème, et relancer peut-il y changer quelque chose ?"],
  ['qualite.vue.tables.titre', 'Appartenances à chaque table'],
  ['qualite.vue.tables.question', 'Où les mêmes cercles se retrouvent-ils à une même table ?'],
  ['qualite.vue.paires.titre', 'Paires répétées'],
  ['qualite.vue.paires.question', 'Qui revoit trop souvent la même personne ?'],
  ['qualite.vue.objectifs.titre', 'Objectifs des tables'],
  [
    'qualite.vue.objectifs.question',
    "Qui n'est jamais assis à une table qui lui correspond, et à quel tour l'objectif perd-il ?",
  ],
  ['qualite.vue.animateurs.titre', 'Animateurs rencontrés'],
  ['qualite.vue.animateurs.question', "Qui a rencontré le moins d'animateurs ?"],
  ['qualite.vue.diversite.titre', 'Diversité par animateur'],
  ['qualite.vue.diversite.question', 'Quel animateur voit le moins de diversité à sa table ?'],
  ['qualite.vue.performance.titre', 'Performance du calcul'],
  ['qualite.vue.performance.question', 'Relancer plus longtemps aurait-il donné mieux ?'],

  // --- Les pourcentages, seules clés du signe (§ 12.8, D34, D52) -------------
  ['qualite.pourcentage.valeur', ({ pourcent }) => `${pourcent}\u{202F}%`],
  ['qualite.pourcentage.axe', ({ valeur }) => `${valeur}\u{202F}%`],
  ['qualite.pourcentage.cent', '100\u{202F}%'],
  ['qualite.pourcentage.servis', ({ pourcent }) => `${pourcent}\u{202F}% des tours possibles servis`],

  // --- L'en-tête chiffré (§ 12.2, B11, D29, D48) -----------------------------
  // Une tuile qui a sa colonne au tableau des propositions en lit le libellé ;
  // une tuile sans colonne — critère décoché, valeur que le mode réglé ne
  // compare pas — prend le sien ci-dessous, et dit qu'elle ne classe pas.
  ['qualite.tuile.neClassePas', 'ne classe pas'],
  ['qualite.tuile.population', ({ mesuree, exclue }) =>
    exclue === 0
      ? `Population mesurée : ${compte(mesuree, 'personne', 'personnes')}.`
      : `Population mesurée : ${compte(mesuree, 'personne', 'personnes')}, ${compte(exclue, 'exclue', 'exclues')} à part.`],
  ['qualite.tuile.jamaisServies', 'Personnes jamais servies'],
  ['qualite.tuile.horsObjectifMax', "Plus de tours hors objectif d'une personne"],
  ['qualite.tuile.toursHorsObjectif', 'Tours hors objectif'],
  ['qualite.tuile.toursSelonObjectif', "Tours selon l'objectif, minimum"],
  ['qualite.tuile.animateursRencontres', 'Animateurs rencontrés, minimum'],
  ['qualite.tuile.animateursNonRencontres', 'Animateurs non rencontrés'],
  ['qualite.tuile.personne', ({ nom }) => `chez ${nom}`],
  ['qualite.tuile.plafondRealise', ({ plafond }) => `plafond réalisé ${plafond}`],
  ['qualite.tuile.plafondAPriori', ({ plafond }) => `plafond a priori ${plafond}`],
  ['qualite.tuile.effectifManque', ({ effectif }) => `${compte(effectif, 'personne', 'personnes')} au manque maximal`],
  ['qualite.tuile.borneDiversite', ({ borne }) => `borne de diversité ${borne}`],
  ['qualite.tuile.borneAnimateurs', ({ borne }) => `borne des animateurs ${borne}`],
  ['qualite.tuile.plancher', ({ plancher }) => `plancher ${plancher}`],
  ['qualite.tuile.toursPossibles', ({ possibles }) => compte(possibles, 'tour possible', 'tours possibles')],
  ['qualite.tuile.imposees', ({ imposees }) => `${compte(imposees, 'imposée', 'imposées')}, à part`],
  ['qualite.tuile.imposes', ({ imposes }) => `${compte(imposes, 'imposé', 'imposés')}, à part`],
  ['qualite.tuile.sansAppartenance', "Aucune personne présente ne porte d'appartenance."],
  ['qualite.tuile.pireRencontres', ({ rencontres, plafond }) => `minimum ${rencontres} sur ${plafond}`],
  ['qualite.tuile.pireServis', ({ servis, possibles }) => `minimum ${servis} sur ${possibles}`],
  [
    'qualite.tuile.pireJamaisServies',
    ({ personnes }) => compte(personnes, 'personne jamais servie', 'personnes jamais servies'),
  ],

  // --- Le profil trié (§ 12.3, B12, D28, D30, D41, D51) ----------------------
  ['qualite.profil.graphique.comptes', 'Profil trié des rencontres, en comptes de personnes'],
  ['qualite.profil.graphique.pourcentages', 'Profil trié des rencontres, en pourcentage du plafond réalisé'],
  ['qualite.profil.axe.rangs', 'Personnes, de la moins servie à la mieux servie'],
  ['qualite.profil.axe.comptes', 'Personnes distinctes'],
  ['qualite.profil.axe.pourcentages', 'Rencontres en pourcentage du plafond réalisé'],
  ['qualite.profil.serie.rencontres', 'rencontres'],
  ['qualite.profil.serie.appartenances', 'appartenances rencontrées'],
  ['qualite.profil.repere.plafond', 'plafond réalisé'],
  ['qualite.profil.repere.borne', 'borne de diversité'],
  [
    'qualite.profil.synthese',
    ({ minimum, effectifAuMinimum, effectifSousPlafond }) =>
      `Minimum ${compte(minimum, 'personne rencontrée', 'personnes rencontrées')}, ` +
      `${compte(effectifAuMinimum, 'personne', 'personnes')} au minimum, ` +
      `${compte(effectifSousPlafond, 'personne', 'personnes')} sous leur plafond réalisé.`,
  ],
  ['qualite.profil.pire', ({ rencontres, plafond }) => `minimum ${rencontres} sur ${plafond}`],
  ['qualite.profil.ligne', ({ rencontres, plafond }) => `${rencontres} sur ${plafond}`],
  ['qualite.profil.marque.ancre', 'ancré'],
  ['qualite.profil.marque.partiel', 'partiellement fixé'],
  ['qualite.profil.marque.reserve', 'en réserve à un tour au moins'],
  ['qualite.profil.marque.plafondNul', 'plafond réalisé nul'],
  ['qualite.profil.colonne.rang', 'Rang'],
  ['qualite.profil.colonne.nom', 'Personne'],
  ['qualite.profil.colonne.appartenance', 'Appartenance'],
  ['qualite.profil.colonne.rencontres', 'Personnes distinctes rencontrées'],
  ['qualite.profil.colonne.plafondRealise', 'Plafond réalisé'],
  ['qualite.profil.colonne.pourcent', 'Rencontres sur le plafond réalisé'],
  ['qualite.profil.colonne.plafondAPriori', 'Plafond a priori'],
  ['qualite.profil.colonne.appartenances', 'Appartenances rencontrées'],
  ['qualite.profil.colonne.borneDiversite', 'Borne de diversité'],
  ['qualite.profil.colonne.toursNonAssis', 'Tours non assis'],
  ['qualite.profil.repartition.titre', 'Répartition des rencontres'],
  ['qualite.profil.repartition.valeur', 'Personnes distinctes rencontrées'],
  ['qualite.profil.repartition.effectif', 'Effectif'],
  ['qualite.profil.repartition.cumul', 'Effectif cumulé'],
  ['qualite.profil.repartition.auPlafond', 'À leur plafond réalisé'],
  [
    'qualite.profil.uneTable',
    "Une seule table : chacun y rencontre tous les autres, et le profil dirait la même chose de chacun.",
  ],
  [
    'qualite.profil.uneAppartenance',
    "Une seule appartenance : le profil n'a qu'une série, les rencontres, et pas de borne de diversité.",
  ],
  [
    'qualite.profil.aucuneAppartenance',
    "Aucune appartenance : le profil n'a qu'une série, les rencontres, et pas de borne de diversité.",
  ],
  ['qualite.profil.plafondNul', 'Plafond réalisé nul : ce rang n’a pas de point en pourcentage.'],

  // --- Les collisions d'appartenance (§ 12.4, B13, D31) ----------------------
  ['qualite.collisions.graphique', "Collisions d'appartenance, par appartenance"],
  ['qualite.collisions.axe', 'Collisions cumulées (paire et tour)'],
  ['qualite.collisions.segment.prouve', 'prouvé inévitable'],
  ['qualite.collisions.segment.reste', 'reste'],
  ['qualite.collisions.colonne.appartenance', 'Appartenance'],
  ['qualite.collisions.colonne.effectif', 'Effectif'],
  ['qualite.collisions.colonne.cumulees', 'Collisions cumulées'],
  ['qualite.collisions.colonne.prouve', 'Prouvé inévitable'],
  ['qualite.collisions.colonne.reste', 'Reste'],
  ['qualite.collisions.colonne.pairesDistinctes', 'Paires distinctes'],
  ['qualite.collisions.colonne.excedent', 'Excédent de collisions'],
  [
    'qualite.collisions.synthese',
    ({ appartenance, excedent }) => `L'excédent le plus grand est celui de « ${appartenance} » : ${compte(excedent, 'collision', 'collisions')}.`,
  ],
  [
    'qualite.collisions.horsDomaine',
    "Ce placement laisse quelqu'un en réserve ou n'honore pas une réservation : le plancher du diagnostic ne s'y applique pas, et chaque barre n'a qu'un segment, les collisions cumulées.",
  ],
  ['qualite.collisions.aucune', "Aucune collision d'appartenance : à chaque tour, chaque table réunit des appartenances distinctes."],
  ['qualite.collisions.aucuneAppartenance', "Aucune appartenance : il n'y a pas de collision à montrer."],
  ['qualite.collisions.uneTable', 'Une seule table : chacun y retrouve chaque membre de son appartenance, à chaque tour.'],

  // --- Les appartenances à chaque table (§ 12.11, B20, D35, D54) -------------
  ['qualite.tables.selecteur', 'Ce que la grille compte'],
  ['qualite.tables.position.sieges', 'appartenances par siège'],
  ['qualite.tables.position.assis', 'appartenances par personne assise'],
  ['qualite.tables.position.doublons', 'doublons parmi les affiliés'],
  ['qualite.tables.compte.sieges', 'sièges sans appartenance nouvelle'],
  ['qualite.tables.compte.assis', 'assis sans appartenance nouvelle'],
  ['qualite.tables.compte.doublons', "doublons d'appartenance"],
  [
    'qualite.tables.ligne.sieges',
    ({ appartenances, sieges }) => `${compte(appartenances, 'appartenance', 'appartenances')} pour ${compte(sieges, 'siège', 'sièges')}`,
  ],
  [
    'qualite.tables.ligne.assis',
    ({ appartenances, assis }) => `${compte(appartenances, 'appartenance', 'appartenances')} pour ${assis} assis`,
  ],
  [
    'qualite.tables.ligne.doublons',
    ({ appartenances, affilies }) => `${compte(appartenances, 'appartenance', 'appartenances')} pour ${compte(affilies, 'affilié', 'affiliés')}`,
  ],
  ['qualite.tables.graphique', 'Appartenances à chaque table, tables par tours'],
  ['qualite.tables.table', ({ numero }) => `Table ${numero}`],
  ['qualite.tables.tour', ({ tour }) => `Tour ${tour}`],
  ['qualite.tables.colonne.occupants', 'Occupants'],
  ['qualite.tables.colonne.affilies', 'Affiliés'],
  ['qualite.tables.colonne.capacite', 'Capacité'],
  [
    'qualite.tables.synthese',
    ({ numero, valeur }) => `La table ${numero} porte la case la plus haute : ${valeur}.`,
  ],
  ['qualite.tables.tropLarge', 'La grille ne tient pas dans la largeur de la carte : son tableau jumeau la remplace.'],
  ['qualite.tables.aucuneAppartenance', "Aucune appartenance : aucune table n'a d'appartenance à mélanger."],
  ['qualite.tables.uneTable', 'Une seule table : elle réunit toutes les appartenances à chaque tour.'],

  // --- Les paires répétées, la matrice (§ 12.5, B14, D32, D33, D50) ----------
  ['qualite.paires.choisies', "Paires que la recherche réunit plus d'une fois"],
  ['qualite.paires.imposees', 'Paires que les réservations imposent'],
  ['qualite.paires.colonne.paire', 'Paire'],
  ['qualite.paires.colonne.fois', 'Rencontres de la paire'],
  ['qualite.paires.colonne.tours', 'Tours'],
  ['qualite.paires.premierTour', ({ tour }) => `Voir au tour ${tour}`],
  ['qualite.paires.tour', ({ tour }) => `Tour ${tour}`],
  ['qualite.paires.fois', ({ fois }) => `${fois} fois`],
  ['qualite.paires.aucune', 'Aucune paire ne se revoit : chaque rencontre est unique.'],
  ['qualite.paires.uneTable', 'Une seule table : chaque paire se revoit à chaque tour.'],
  [
    'qualite.paires.pages.etendue',
    ({ premier, dernier, total }) => (premier === dernier ? `Paire ${premier} sur ${total}` : `Paires ${premier} à ${dernier} sur ${total}`),
  ],
  ['qualite.paires.matrice.titre', 'Qui a rencontré qui'],
  ['qualite.paires.matrice.diagonale', 'la personne elle-même'],
  [
    'qualite.paires.matrice.seuil',
    ({ participants, seuil }) =>
      `La matrice n'est pas dessinée : ${participants} personnes dépassent le seuil de ${seuil}. La fiche de chaque personne porte ses rencontres.`,
  ],
  [
    'qualite.paires.matrice.etroite',
    "La matrice n'est pas dessinée : ses cases ne tiendraient pas dans la largeur de la carte. La fiche de chaque personne porte ses rencontres.",
  ],

  // --- Les objectifs des tables, tour par tour (§ 12.12, B21, D36) -----------
  ['qualite.objectifs.jamaisServies', 'Personnes jamais servies'],
  ['qualite.objectifs.toursPossibles', ({ possibles }) => compte(possibles, 'tour possible', 'tours possibles')],
  ['qualite.objectifs.pire', ({ personnes }) => compte(personnes, 'personne jamais servie', 'personnes jamais servies')],
  [
    'qualite.objectifs.comptes',
    ({ servis, possibles }) => `${compte(servis, 'servi', 'servis')} sur ${compte(possibles, 'possible', 'possibles')}`,
  ],
  [
    'qualite.objectifs.horsObjectif',
    ({ hors, plancher }) => `${compte(hors, 'tour hors objectif', 'tours hors objectif')}, plancher ${plancher}`,
  ],
  ['qualite.objectifs.soiree', 'La soirée'],
  ['qualite.objectifs.tour', ({ tour }) => `Tour ${tour}`],
  ['qualite.objectifs.assisSansTable', ({ assis }) => `${assis} assis sans table possible`],
  ['qualite.objectifs.sansCouple', 'aucun couple possible à ce tour'],
  ['qualite.objectifs.segment.prouve', 'prouvé inévitable'],
  ['qualite.objectifs.segment.reste', 'reste'],
  ['qualite.objectifs.graphique', 'Tours hors objectif, tour par tour'],
  ['qualite.objectifs.colonne.possibles', 'Possibles'],
  ['qualite.objectifs.colonne.servis', 'Servis'],
  ['qualite.objectifs.colonne.pourcent', 'Des tours possibles servis'],
  ['qualite.objectifs.colonne.hors', 'Hors objectif'],
  ['qualite.objectifs.colonne.plancher', 'Plancher'],
  ['qualite.objectifs.colonne.assis', 'Assis sans table possible'],
  ['qualite.objectifs.repartition.titre', "Répartition des tours hors objectif d'une personne"],
  ['qualite.objectifs.repartition.valeur', 'Tours hors objectif'],
  ['qualite.objectifs.repartition.effectif', 'Effectif'],
  [
    'qualite.objectifs.critereDecoche',
    "Le critère des tours hors objectif n'est pas coché : cette vue ne classe pas.",
  ],
  [
    'qualite.objectifs.aucunConcerne',
    "Aucune personne n'est concernée par les objectifs des tables : la vue n'a rien à montrer.",
  ],
  [
    'qualite.objectifs.horsDomaine',
    "Ce placement laisse quelqu'un en réserve ou n'honore pas une réservation : le plancher des tours ne s'y applique pas, et chaque barre n'a qu'un segment.",
  ],

  // --- Les animateurs rencontrés (§ 12.13, B22, D37) -------------------------
  ['qualite.animateurs.graphique', 'Animateurs rencontrés, de la personne la moins servie à la mieux servie'],
  ['qualite.animateurs.serie', 'animateurs rencontrés'],
  ['qualite.animateurs.repere.borne', 'borne des animateurs'],
  ['qualite.animateurs.colonne.nom', 'Personne'],
  ['qualite.animateurs.colonne.rencontres', 'Animateurs rencontrés'],
  ['qualite.animateurs.colonne.borne', 'Borne des animateurs'],
  ['qualite.animateurs.colonne.statut', 'Statut'],
  ['qualite.animateurs.repartition.titre', 'Répartition des animateurs rencontrés'],
  [
    'qualite.animateurs.synthese',
    ({ minimum, effectif }) =>
      `Minimum ${compte(minimum, 'animateur rencontré', 'animateurs rencontrés')}, ${compte(effectif, 'personne', 'personnes')} au minimum.`,
  ],
  [
    'qualite.animateurs.aucun',
    "Aucune personne n'est concernée par les animateurs, ou aucun animateur n'est désigné : la vue n'a rien à montrer.",
  ],

  // --- La diversité par animateur (§ 12.13, B22, D38) ------------------------
  ['qualite.diversite.graphique', 'Diversité rencontrée en animant, sur la soirée'],
  ['qualite.diversite.colonne.appartenances', 'Appartenances rencontrées en animant'],
  ['qualite.diversite.colonne.etiquettes', 'Étiquettes rencontrées en animant'],
  ['qualite.diversite.colonne.toursAnimes', 'Tours animés'],
  ['qualite.diversite.colonne.personnes', 'Personnes rencontrées en animant'],
  ['qualite.diversite.moins', 'le moins varié'],
  ['qualite.diversite.plus', 'le plus varié'],
  ['qualite.diversite.auMinimum', 'au minimum'],
  ['qualite.diversite.soiree', 'la soirée'],
  ['qualite.diversite.tour', ({ tour, table }) => `tour ${tour}, table ${table}`],
  ['qualite.diversite.toursAnimes', ({ tours }) => compte(tours, 'tour animé', 'tours animés')],
  ['qualite.diversite.personnes', ({ personnes }) => `${compte(personnes, 'personne rencontrée', 'personnes rencontrées')} en animant`],
  [
    'qualite.diversite.sansEtiquette',
    "Aucune personne présente ne porte d'étiquette : seule la colonne des appartenances se dessine.",
  ],
  [
    'qualite.diversite.sansAppartenance',
    'Une appartenance au plus : seule la colonne des étiquettes se dessine, triée sur les étiquettes.',
  ],
  [
    'qualite.diversite.rien',
    "Ni étiquette, ni plus d'une appartenance : la diversité par animateur n'a rien à dessiner. Son tableau jumeau garde les tours animés et les personnes rencontrées en animant.",
  ],
  ['qualite.diversite.aucunAnimateur', "Aucun animateur n'est désigné : la vue n'a rien à montrer."],

  // --- La performance du calcul (§ 12.14, B23, D40, D49) ---------------------
  ['qualite.performance.mouvements', ({ evalues, arret }) => `${evalues} mouvements évalués sur ${arret}`],
  ['qualite.performance.duree', ({ duree }) => `durée observée ${duree}`],
  ['qualite.performance.dureeInconnue', 'durée inconnue'],
  ['qualite.performance.cadence', ({ cadence }) => `cadence ${cadence} mouvements par seconde`],
  ['qualite.performance.coeurs', ({ coeurs }) => compte(coeurs, 'cœur de calcul', 'cœurs de calcul')],
  ['qualite.performance.propositions', ({ nombre }) => `génération de ${compte(nombre, 'proposition', 'propositions')}`],
  [
    'qualite.performance.rienAReprendre',
    ({ evalues, arret }) => `rien à reprendre après ${evalues} mouvements sur ${arret}`,
  ],
  ['qualite.performance.planInitial', "le plan initial n'avait rien à reprendre"],
  [
    'qualite.performance.dernierChangement',
    ({ de, a }) => `aucune valeur n'a changé entre ${de} et ${a} mouvements ; une autre graine est l'autre façon de chercher`,
  ],
  ['qualite.performance.changeAuDernier', ({ a }) => `une valeur a changé au dernier point de relevé, à ${a} mouvements`],
  ['qualite.performance.graphique', ({ indicateur }) => `${indicateur}, aux points de relevé`],
  ['qualite.performance.axe', 'Mouvements évalués, échelle logarithmique'],
  ['qualite.performance.minimumBrut', 'minimum brut'],
  ['qualite.performance.colonne.mouvements', 'Mouvements évalués'],
  [
    'qualite.performance.synthese',
    "Valeurs mesurées aux seuls points de relevé, sous les réglages courants, reliées par un trait : entre deux points, rien n'est mesuré.",
  ],
  [
    'qualite.performance.sansCourse',
    "Sa course n'est pas gardée.",
  ],
  [
    'qualite.performance.retenu',
    ({ proposition }) =>
      `La vue mesure une proposition : le placement retenu vient de la proposition n° ${proposition}, dont elle montre la course.`,
  ],
  [
    'qualite.performance.retenuSansCourse',
    "La vue mesure une proposition : le placement retenu a été ajusté, ou sa proposition effacée, et n'a pas de course.",
  ],
]);
