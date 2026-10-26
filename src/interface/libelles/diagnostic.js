// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les libellés du diagnostic d'une configuration (§ 5.6, § 14.6). Chaque clé
// commence par « diagnostic. ». Un énoncé (phrases.js) a son texte sous sa
// clé, son remède sous diagnostic.remede.<nom>. Chaque chiffre nomme son
// unité : une collision se compte en occurrences, une paire distincte à
// part (§ 5.4). L'organisation d'un groupe est une donnée : l'écran la pose
// dans son propre nœud, avant le texte, qu'aucune entrée de cette table ne
// lui fait porter. Seules les phrases des conflits en étoile citent leurs
// organisations : plusieurs à la fois, elles n'ont pas de carte qui les
// porte.
import { creerFormat } from '../../application/format.js';
import { auxToursNommes, cite, compte, enumeration } from '../../application/libelles/aides.js';

// « sur le tour » ou « sur les R tours ».
const surLesTours = (tours) => (tours === 1 ? 'sur le tour' : `sur les ${tours} tours`);

// Une énumération que « ou » ferme : « a », « a ou b », « a, b ou c ».
const ouBien = (termes) => (termes.length <= 1 ? termes.join('') : `${termes.slice(0, -1).join(', ')} ou ${termes.at(-1)}`);

// Le plancher de chaque tour d'une étoile, entre parenthèses : le même à
// chaque tour, ou son étendue ; rien sur un seul tour.
function parTourEntreParentheses(parTour) {
  if (parTour.length <= 1) return '';
  const moins = Math.min(...parTour);
  const plus = Math.max(...parTour);
  return moins === plus ? ` (${plus} par tour)` : ` (de ${moins} à ${plus} selon le tour)`;
}

// Le plancher exact des collisions cumulées d'un plan sans conflit, et
// celui de chaque tour entre parenthèses.
const plancherExact = ({ plancher, tours, parTour }) =>
  "tant qu'aucun conflit ne se produit, les tables imposent au moins " +
  `${compte(plancher, 'collision cumulée', 'collisions cumulées')} ${surLesTours(tours)}${parTourEntreParentheses(parTour)}`;

// « au tour 3 » ou « aux tours 2 et 3 » ; rien pour une liste vide.
const auxToursListes = (tours) => (tours.length === 0 ? '' : ` ${auxToursNommes(tours)}`);

// « au tour » ou « aux R tours ».
const auxTours = (tours) => (tours === 1 ? 'au tour' : `aux ${tours} tours`);

// « au tour » ou « à chacun des R tours ».
const aChaqueTour = (tours) => (tours === 1 ? 'au tour' : `à chacun des ${tours} tours`);

// La suite commune des deux phrases des places vides.
const SUITE_PLACES_VIDES =
  ' : une personne assise à une table incomplète y rencontre une personne de moins par place vide, ' +
  'et ce plafond, compté sur des tables pleines, peut alors lui échapper.';

// La fin commune des deux phrases du plafond par les capacités : ancres
// vrai quand la ligne compte des ancrés.
const finAncres = (ancres) => (ancres ? ', et un ancré ne rencontre jamais les ancrés des autres tables.' : '.');

// La fin commune des deux phrases des retours imposés.
const RETOURS_VOULUS = ' ; ces retours sont voulus par les réservations et ne comptent pas contre les propositions.';

// Un nombre mis en forme par la traduction, decimales chiffres après la
// virgule ; une valeur qui n'est pas un nombre s'écrit telle quelle.
const nombre = (valeur, texte, decimales = 0) =>
  typeof valeur === 'number' ? creerFormat(texte).nombre(valeur, { decimales }) : String(valeur);

// Le geste « Générer » d'une recherche plus longue, commun aux deux
// phrases qui le proposent.
const RECHERCHE_PLUS_LONGUE = ' : une recherche plus longue peut réduire ce qui manque, sans rien promettre.';

// « 1 place manque » ou « n places manquent ».
const placesQuiManquent = (n) => (n === 1 ? '1 place manque' : `${n} places manquent`);

// Le manque de chaque tour où il est positif, [{tour, manque}] croissants :
// les tours d'un même manque se nomment ensemble, les manques dans l'ordre
// de leur premier tour. La Map ne sert qu'à retrouver un manque déjà
// rencontré.
function manquesParTour(tours) {
  const toursDe = new Map();
  for (const { tour, manque } of tours) toursDe.set(manque, [...(toursDe.get(manque) ?? []), tour]);
  return enumeration([...toursDe].map(([manque, siens]) => `${placesQuiManquent(manque)} ${auxToursNommes(siens)}`));
}

export const TABLE = new Map([
  // --- Le cadre de l'écran ---------------------------------------------------
  ['diagnostic.enonces', 'Ce que la configuration impose'],
  ['diagnostic.nonCalcule', 'La configuration ne se normalise pas : le diagnostic ne se calcule pas.'],
  // Les intitulés des cartes que ne nomme pas une organisation
  // (cartesDiagnostic) : la séparation vidée de son sens, les conflits en
  // étoile, puis le reste.
  ['diagnostic.carte.separation', 'Séparation des organisations'],
  ['diagnostic.carte.conflits', 'Organisations en conflit'],
  ['diagnostic.carte.ensemble', "Tout l'événement"],
  // La ligne du calcul exact sous les cartes de la section (Diagnostic.svelte)
  // : ce qui se calcule, au tour près, et pourquoi, puis la commande qui
  // l'arrête ; après l'arrêt, ce que le diagnostic garde.
  [
    'diagnostic.solveur.enCours',
    ({ tour, tours }) => `Calcul exact du plancher des collisions… tour ${tour} sur ${tours}.`,
  ],
  [
    'diagnostic.solveur.pourquoi',
    "Il prouve le minimum de collisions cumulées qu'un plan sans conflit d'organisation peut atteindre ; " +
      "d'ici là, le diagnostic montre les planchers instantanés.",
  ],
  ['diagnostic.solveur.barre', 'Tours du calcul exact résolus'],
  ['diagnostic.solveur.annuler', 'Annuler le calcul exact'],
  [
    'diagnostic.solveur.annule',
    'Calcul exact annulé : le diagnostic garde les planchers instantanés, et le calcul reprendra quand la configuration changera.',
  ],

  // --- La séparation vidée de son sens (§ 7.5, § 15.4) -----------------------
  [
    'diagnostic.uneSeuleOrganisation',
    'une seule organisation, portée par chaque personne, sous séparation active : la séparation est vide de sens',
  ],
  ['diagnostic.collisionPartout', 'tout placement porte une collision à chaque table, à chaque tour'],

  // --- Les collisions et l'excédent (§ 5.4, § 5.6) ---------------------------
  [
    'diagnostic.collisions',
    ({ effectif, plancherCumulees, plancherPairesDistinctes, tours }) =>
      `${compte(effectif, 'personne', 'personnes')} : au moins ` +
      `${compte(plancherCumulees, 'collision cumulée', 'collisions cumulées')} ${surLesTours(tours)}, ` +
      `${plancherCumulees === 1 ? 'portée' : 'portées'} par au moins ` +
      compte(plancherPairesDistinctes, 'paire distincte', 'paires distinctes'),
  ],
  [
    'diagnostic.excedent',
    ({ plancherExcedent }) =>
      `excédent d'au moins ${compte(plancherExcedent, 'collision', 'collisions')} : des retrouvailles sont forcées`,
  ],

  // --- Les conflits en étoile (§ 5.6) ------------------------------------------
  // organisations : le centre, puis ses branches ; les libellés y sont cités,
  // l'énoncé n'ayant pas de carte d'organisation qui les porte.
  [
    'diagnostic.conflitsEtoile',
    ({ organisations: [centre, ...branches], plancherCumulees, parTour, tours }) =>
      (branches.length === 1
        ? `les organisations ${cite(centre)} et ${cite(branches[0])} ne peuvent jamais partager une table`
        : `l'organisation ${cite(centre)} ne peut jamais partager une table avec ${ouBien(branches.map(cite))}`) +
      ` : tant qu'aucun conflit ne se produit, au moins ${compte(plancherCumulees, 'collision cumulée', 'collisions cumulées')} ` +
      `${surLesTours(tours)}${parTourEntreParentheses(parTour)}`,
  ],

  // --- Les planchers exacts du solveur (§ 5.6) --------------------------------
  // toursSansIssue : les tours où aucun placement n'évite tout conflit
  // d'organisation ; parTour, le plancher de chaque tour ; toursALimite,
  // ceux que la limite de temps a arrêtés.
  [
    'diagnostic.conflitsInevitables',
    ({ toursSansIssue }) => `aucun plan ne peut éviter tout conflit d'organisation ${auxToursNommes(toursSansIssue)}`,
  ],
  ['diagnostic.collisionsExactes', (details) => `${plancherExact(details)} : c'est le minimum exact, qu'au moins un plan sans conflit atteint`],
  ['diagnostic.collisionsAuMoins', (details) => plancherExact(details)],

  // --- La redondance et les animateurs (§ 5.6) -------------------------------
  [
    'diagnostic.redondance',
    ({ redondanceMinimale }) =>
      `au moins ${compte(redondanceMinimale, 'organisation recroisée', 'organisations recroisées')} par personne`,
  ],
  [
    'diagnostic.animateurs',
    ({ redondanceImposeeParAnimateurs }) =>
      'tous les animateurs partagent une organisation : chaque mobile accumule au moins ' +
      `${compte(redondanceImposeeParAnimateurs, 'redondance', 'redondances')} qu'aucune recherche ne réduit`,
  ],

  // --- L'ancrage par table (§ 5.6, § 5.9) ------------------------------------
  ['diagnostic.ancrage.gelee', ({ numero, capacite }) => `la table ${numero} ne tourne plus : ses ${capacite} places sont ancrées`],
  [
    'diagnostic.ancrage.moitie',
    ({ numero, ancres, capacite }) =>
      `la table ${numero} a ${compte(ancres, 'place ancrée', 'places ancrées')} sur ${capacite} : ` +
      "elle réduit d'autant le brassage de tout l'événement",
  ],

  // --- L'écart d'itinéraire, le manque de places (§ 5.6, § 12.10.4) ----------
  [
    'diagnostic.ecartItineraire',
    ({ plancher, mobilesAuMoins }) =>
      `écart d'itinéraire maximal : plancher ${plancher}, au moins ` +
      (mobilesAuMoins === 1 ? '1 mobile finit sous son plafond a priori' : `${mobilesAuMoins} mobiles finissent sous leur plafond a priori`),
  ],
  // Sans tours, le manque est le même à chaque tour ; tours : celui de
  // chaque tour où il est positif, quand il varie d'un tour à l'autre.
  [
    'diagnostic.placesManquantes',
    ({ placesManquantes, tours }) =>
      tours === undefined ? `${placesQuiManquent(placesManquantes)} à chaque tour` : manquesParTour(tours),
  ],
  // Une personne au moins manque un tour : le plancher de l'écart
  // d'itinéraire ne se prouve plus, et chaque mesure ne compte que les
  // tours de présence (§ 5.6).
  [
    'diagnostic.planchersRetires',
    ({ absentes }) =>
      `${absentes === 1 ? "1 personne n'est pas présente" : `${absentes} personnes ne sont pas présentes`} à chaque tour : ` +
      "l'écart d'itinéraire n'a pas de plancher prouvé, et chaque chiffre se lit sur les tours de présence.",
  ],

  // --- Les objectifs hors d'atteinte (§ 5.6, A10) -----------------------------
  // Un plancher par valeur que le mode des objectifs compare : le texte dit
  // ce qu'aucun placement n'évite.
  [
    'diagnostic.objectifs.toursHorsObjectif',
    ({ plancher }) =>
      `au moins ${compte(plancher, 'tour hors objectif', 'tours hors objectif')} : ` +
      "les tables qui portent un objectif n'ont pas assez de places libres pour chaque tour possible",
  ],
  [
    'diagnostic.objectifs.jamaisServies',
    ({ plancher }) =>
      `au moins ${compte(plancher, 'personne jamais servie', 'personnes jamais servies')} par une table à objectif, ` +
      'quel que soit le placement',
  ],
  [
    'diagnostic.objectifs.horsObjectifMax',
    ({ plancher }) =>
      `au moins une personne passe au moins ${compte(plancher, 'tour', 'tours')} hors objectif, quel que soit le placement`,
  ],

  // --- Le plafond a priori et les imposés (§ 5.4, § 5.5) ---------------------
  [
    'diagnostic.plafond',
    ({ valeur, ancres, mobiles }) =>
      `plafond a priori ${compte(valeur, 'rencontre', 'rencontres')} pour ` +
      enumeration([
        ...(ancres > 0 ? [compte(ancres, 'ancré', 'ancrés')] : []),
        ...(mobiles > 0 ? [compte(mobiles, 'mobile', 'mobiles')] : []),
      ]),
  ],
  ['diagnostic.plafondInconnu', (_, texte) => `plafond a priori : ${texte('format.vide')}`],
  [
    'diagnostic.imposes',
    ({ retoursImposes, ancragesImposantRetours }) =>
      `${compte(retoursImposes, 'retour imposé', 'retours imposés')} par ${compte(ancragesImposantRetours, 'ancrage', 'ancrages')}`,
  ],

  [
    'diagnostic.conflitsImposes',
    ({ conflits }) =>
      `${compte(conflits, "conflit d'organisation imposé", "conflits d'organisation imposés")} par les réservations`,
  ],

  // --- Les explications (§ 5.6) ------------------------------------------------
  // Sous chaque énoncé de la section, son amorce puis ses phrases
  // (phrases.js, expliquer) : « Concrètement : » dit le sens avec les
  // chiffres de l'événement ; « Pour changer cela : » précède le geste, celui
  // d'un remède qui en dit un ou celui propre à l'énoncé. Chaque phrase est
  // une proposition complète, close par un point ; aucune ne calcule, ses
  // chiffres arrivent composés.
  ['diagnostic.amorce.concretement', 'Concrètement :'],
  ['diagnostic.amorce.pourChanger', 'Pour changer cela :'],
  [
    'diagnostic.concretement.uneSeuleOrganisation',
    'toutes les personnes présentes déclarent la même organisation : toute table de deux personnes ou plus réunit des ' +
      "collègues, à chaque tour et quel que soit le placement, et la séparation n'a rien à séparer.",
  ],
  [
    'diagnostic.concretement.collisionPartout',
    ({ tours }) =>
      `${aChaqueTour(tours)}, chaque table réunit au moins deux personnes d'une même organisation, quel que soit le placement : ` +
      "aucune table n'échappe aux collisions.",
  ],
  // parReservations : des réservations assoient des membres ensemble, et
  // aucune table ajoutée ne les sépare ; sinon, les tables manquent.
  [
    'diagnostic.concretement.collisions',
    ({ effectif, plancherCumulees, plancherPairesDistinctes, tours, parReservations }) =>
      (parReservations
        ? 'des réservations assoient des membres de cette organisation à une même table'
        : `à un tour au moins, les tables ne suffisent pas à asseoir ses ${compte(effectif, 'membre', 'membres')} chacun à une table différente`) +
      ` : ${surLesTours(tours)}, deux d'entre eux partagent une table au moins ${compte(plancherCumulees, 'fois', 'fois')}, ` +
      'et ces tablées réunissent au moins ' +
      (plancherPairesDistinctes === 1 ? '1 paire de collègues.' : `${plancherPairesDistinctes} paires de collègues différentes.`),
  ],
  [
    'diagnostic.concretement.excedent',
    ({ plancherExcedent }) =>
      'ces collègues ne forment pas assez de paires différentes pour que chaque collision en réunisse une nouvelle : ' +
      `au moins ${compte(plancherExcedent, 'fois', 'fois')}, deux collègues déjà assis ensemble à un tour se retrouvent ` +
      'à la même table à un autre tour.',
  ],
  // parGroupe : le plancher des organisations de l'étoile une à une, sans le
  // conflit ; gain, ce que le partage des tables y ajoute.
  [
    'diagnostic.concretement.conflitsEtoile',
    ({ organisations: [centre, ...branches], parGroupe, gain }) =>
      `aucun membre de ${cite(centre)} ne s'assoit à une table où se trouve un membre de ${ouBien(branches.map(cite))} : ` +
      (branches.length === 1
        ? 'à chaque tour, les tables se partagent entre les deux organisations, et chacune se serre sur sa part. '
        : `à chaque tour, les tables se partagent entre ${cite(centre)} d'un côté et les autres, qui peuvent s'y mêler, de ` +
          "l'autre, et chaque côté se serre sur sa part. ") +
      (parGroupe === 0 ? "Sans le conflit, rien n'en imposerait" : `Sans le conflit, leurs planchers par organisation en prouvent ${parGroupe}`) +
      ` ; le partage des tables en impose au moins ${gain}${parGroupe === 0 ? '' : ' de plus'}, ` +
      'quel que soit le placement qui évite le conflit.',
  ],
  [
    'diagnostic.concretement.conflitsInevitables',
    ({ toursSansIssue }) =>
      'les places des tables, une fois les réservations assises, ne suffisent pas à séparer les organisations en conflit ' +
      `${auxToursNommes(toursSansIssue)}.`,
  ],
  [
    'diagnostic.concretement.collisionsExactes',
    "ce minimum vaut tour par tour, toutes organisations comprises ; le classement fait passer l'excédent et les rencontres " +
      'répétées avant les collisions cumulées : la meilleure proposition peut rester au-dessus.',
  ],
  [
    'diagnostic.concretement.collisionsAuMoins',
    ({ toursALimite }) =>
      `le calcul exact a atteint sa limite de temps${auxToursListes(toursALimite)} : ce nombre est prouvé, mais peut-être pas atteignable.`,
  ],
  // moins et plus : le plus petit et le plus grand nombre de présents d'un
  // tour.
  [
    'diagnostic.concretement.planchersRetires',
    ({ moins, plus }) =>
      (moins === plus
        ? `${compte(plus, 'personne est présente', 'personnes sont présentes')} à chaque tour, pas toujours les mêmes`
        : `de ${moins} à ${plus} personnes sont présentes selon le tour`) +
      " : une personne absente à un tour n'y rencontre personne, et son plafond a priori ne compte que ses tours de présence.",
  ],
  [
    'diagnostic.concretement.redondance',
    ({ redondanceMinimale }) =>
      "une organisation déjà croisée ne compte qu'une fois ; qui rencontre autant de personnes affiliées que son plafond " +
      `le permet en croise plus qu'il n'existe d'organisations, et en recroise au moins ${redondanceMinimale}, quel que soit le placement.`,
  ],
  // tables : le nombre de tables différentes où un mobile rencontre un
  // animateur ; redondances, une de moins.
  [
    'diagnostic.concretement.animateurs',
    ({ redondances, tables }) =>
      `un mobile qui s'assoit à ${tables} tables différentes y rencontre ${tables} animateurs ; comme ils portent tous la même ` +
      `organisation, chacun après le premier la lui fait recroiser : ${compte(redondances, 'redondance', 'redondances')} ` +
      "que le placement n'évite pas.",
  ],
  // autres : capacité − 1, les ancrés qu'un ancré de la table rencontre.
  [
    'diagnostic.concretement.ancrage.gelee',
    ({ numero, capacite, autres, tours }) => {
      if (autres === 0) return `la personne ancrée à la table ${numero} y reste seule ${auxTours(tours)} : elle ne rencontre personne.`;
      return (
        `les ${capacite} personnes ancrées à la table ${numero} y restent ${auxTours(tours)} : chacune ne rencontre que ` +
        (autres === 1 ? "l'autre" : `les ${autres} autres`) +
        ", et personne d'autre ne s'assoit à cette table."
      );
    },
  ],
  // libres : capacité − ancrés, les places qui changent d'occupant.
  [
    'diagnostic.concretement.ancrage.moitie',
    ({ numero, ancres, capacite, libres }) =>
      `à chaque tour, ${ancres} des ${capacite} places de la table ${numero} gardent les mêmes personnes : ` +
      (libres === 1 ? 'seule 1 place y reçoit' : `seules ${libres} places y reçoivent`) +
      " quelqu'un de nouveau d'un tour à l'autre, et qui s'y assoit rencontre les mêmes ancrés que tous ceux qui y passent.",
  ],
  [
    'diagnostic.concretement.ecartItineraire',
    ({ plancher, mobilesAuMoins }) =>
      'certaines tables offrent moins de rencontres que les autres, plus petites ou plus ancrées, et leurs places se ' +
      'remplissent quand même à chaque tour : au moins ' +
      (mobilesAuMoins === 1 ? '1 mobile y passe et finit' : `${mobilesAuMoins} mobiles y passent et finissent`) +
      ` au moins ${compte(plancher, 'rencontre', 'rencontres')} sous ${mobilesAuMoins === 1 ? 'son' : 'leur'} plafond a priori, ` +
      'quel que soit le placement.',
  ],
  // presents : le plus de présents d'un tour ; varie : le manque change
  // d'un tour à l'autre.
  [
    'diagnostic.concretement.placesManquantes',
    ({ places, presents, varie }) =>
      `${varie ? 'au tour le plus chargé, ' : ''}${compte(presents, 'personne', 'personnes')} pour ` +
      `${compte(places, 'place', 'places')}${varie ? '' : ' à chaque tour'} : il faudrait asseoir plus de personnes qu'il n'y a ` +
      'de places, et aucune proposition ne se génère avant que chacune ait la sienne.',
  ],
  [
    'diagnostic.concretement.objectifs.toursHorsObjectif',
    ({ plancher }) =>
      "les tables qui portent un objectif n'ont pas assez de places libres pour asseoir à chaque tour toutes les personnes " +
      `qu'elles visent : au moins ${compte(plancher, 'fois', 'fois')} sur la soirée, une personne visée passe un tour à une autre table.`,
  ],
  [
    'diagnostic.concretement.objectifs.jamaisServies',
    ({ plancher }) =>
      'même en répartissant au mieux les places libres des tables à objectif, au moins ' +
      `${compte(plancher, "personne visée ne s'y assoit", "personnes visées ne s'y assoient")} à aucun tour.`,
  ],
  [
    'diagnostic.concretement.objectifs.horsObjectifMax',
    ({ plancher }) =>
      "même en répartissant au mieux les tours hors objectif entre les personnes visées, l'une d'elles en passe encore " +
      `au moins ${plancher} à une autre table que celles de son objectif.`,
  ],
  // Le plafond a priori : par la table, quand la valeur égale tours ×
  // (capacité − 1) sur des tables de même capacité ; tous, quand elle égale
  // les N − 1 autres personnes ; sinon par les capacités sans absence, et
  // par les capacités et les présents de chaque tour sous absence ; ancres
  // vrai quand la ligne compte des ancrés.
  [
    'diagnostic.concretement.plafond.tables',
    ({ capacite, parTour, valeur, tours }) =>
      `à une table de ${capacite}, on rencontre ${compte(parTour, 'personne', 'personnes')} par tour ; ${surLesTours(tours)}, ` +
      `${compte(valeur, 'personne différente', 'personnes différentes')} au plus, et seulement sans jamais revoir quelqu'un.`,
  ],
  [
    'diagnostic.concretement.plafond.tous',
    ({ valeur }) =>
      `${compte(valeur, 'personne', 'personnes')}, c'est toutes les autres personnes présentes : seul leur nombre borne ce ` +
      "plafond, et l'atteindre suppose de ne revoir personne.",
  ],
  [
    'diagnostic.concretement.plafond.capacites',
    ({ valeur, tours, ancres }) =>
      `${compte(valeur, 'personne différente', 'personnes différentes')} au plus ${surLesTours(tours)}, ` +
      "en ne revoyant jamais personne : chaque tour n'ajoute au plus que les autres personnes de la table où l'on s'assoit, " +
      'selon sa capacité' +
      finAncres(ancres),
  ],
  [
    'diagnostic.concretement.plafond.presence',
    ({ valeur, ancres }) =>
      `${compte(valeur, 'personne différente', 'personnes différentes')} au plus, en ne revoyant jamais personne : ` +
      "chaque tour où l'on est présent n'ajoute au plus que les autres personnes de la table où l'on s'assoit, selon sa " +
      'capacité, et parmi celles qui sont présentes à ce tour seulement' +
      finAncres(ancres),
  ],
  [
    'diagnostic.concretement.placesVides',
    ({ placesVides, places, presents }) =>
      `${compte(placesVides, 'place reste vide', 'places restent vides')} à chaque tour, ${compte(presents, 'personne', 'personnes')} ` +
      `pour ${compte(places, 'place', 'places')}${SUITE_PLACES_VIDES}`,
  ],
  [
    'diagnostic.concretement.placesVidesSelonTour',
    ({ placesVides }) => `Jusqu'à ${compte(placesVides, 'place reste vide', 'places restent vides')} selon le tour${SUITE_PLACES_VIDES}`,
  ],
  ['diagnostic.concretement.plafondInconnu', "aucune personne n'est à placer : sans participant, aucune rencontre ne se compte."],
  // Chacune des personnes revient tours − 1 fois : retours, ce nombre.
  [
    'diagnostic.concretement.imposes.ancres',
    ({ personnes, tours, retours }) =>
      (personnes === 1 ? 'la personne réservée à une table y reste' : `chacune des ${personnes} personnes réservées à une table y reste`) +
      ` aux ${tours} tours, et y revient donc ${compte(retours, 'fois', 'fois')}${RETOURS_VOULUS}`,
  ],
  [
    'diagnostic.concretement.imposes',
    ({ personnes, retoursImposes }) =>
      `les réservations ramènent ${compte(personnes, 'personne', 'personnes')} à une table déjà occupée à un tour précédent, ` +
      `${compte(retoursImposes, 'fois', 'fois')} en tout${RETOURS_VOULUS}`,
  ],
  [
    'diagnostic.concretement.conflitsImposes',
    ({ conflits }) =>
      "des personnes en conflit d'organisation sont réservées à une même table : chaque tour où une telle paire s'y retrouve " +
      `compte un conflit, ${conflits} en tout, et aucun placement qui honore les réservations ne les évite.`,
  ],
  ['diagnostic.levier.plafond', 'des tables plus grandes, ou un tour de plus.'],

  // --- La proposition choisie, expliquée (proposition.js) --------------------
  // La carte sous celle de tout l'événement : laquelle, puis trois blocs
  // titrés. Chaque chiffre est celui de la ligne d'évaluation que le tableau
  // des propositions écrit.
  ['diagnostic.carte.proposition', 'La proposition choisie'],
  ['diagnostic.proposition.laquelle.montree', ({ proposition }) => `Proposition n° ${proposition}, montrée au plan.`],
  ['diagnostic.proposition.laquelle.demandee', ({ proposition }) => `Proposition n° ${proposition}, demandée au plan.`],
  ['diagnostic.proposition.laquelle.retenu', 'Le placement retenu.'],
  [
    'diagnostic.proposition.laquelle.meilleure',
    ({ proposition }) => `La meilleure du classement, n° ${proposition} : aucune proposition n'est montrée au plan ni retenue.`,
  ],
  [
    'diagnostic.proposition.laquelle.aucune',
    "Aucune proposition n'est encore générée : « Générer », dans la section Génération, en produit, et cette carte " +
      'explique alors la meilleure du classement.',
  ],
  [
    'diagnostic.proposition.laquelle.aucuneClassee',
    "Aucune proposition ne se classe : chacune est en dérive ou fautive, et le tableau des propositions en donne les raisons. " +
      "Une nouvelle génération en classe de nouveau, comme « Repartir d'elle » sur une proposition en dérive par ses seuls participants.",
  ],
  [
    'diagnostic.proposition.statut.derive',
    "Elle est en dérive : la soirée a changé depuis son calcul, et ses chiffres ne se lisent plus contre la configuration " +
      'actuelle. Le tableau des propositions en donne les raisons.',
  ],
  ['diagnostic.proposition.statut.fautif', 'Elle est fautive : elle ne se mesure pas, et le tableau des propositions en donne les fautes.'],
  ['diagnostic.proposition.bloc.atteint', 'Ce qui est atteint'],
  ['diagnostic.proposition.bloc.manque', 'Ce qui manque, et pourquoi'],
  ['diagnostic.proposition.bloc.tenter', "Ce qu'on peut tenter"],
  // Ce qui est atteint. plafond : le plafond a priori des personnes au
  // minimum, quand elles le partagent ; de et a, son étendue sinon.
  [
    'diagnostic.proposition.rencontres',
    ({ minimum, plafond }) =>
      `Le moins bien servi rencontre ${compte(minimum, 'personne différente', 'personnes différentes')}` +
      (minimum === plafond ? ', tout ce que son plafond a priori permet.' : `, sur les ${plafond} que son plafond a priori permet.`),
  ],
  [
    'diagnostic.proposition.rencontres.entre',
    ({ minimum, de, a }) =>
      `Le moins bien servi rencontre ${compte(minimum, 'personne différente', 'personnes différentes')} ; selon la personne, ` +
      `ce minimum se lit sur un plafond a priori de ${de} à ${a}.`,
  ],
  ['diagnostic.proposition.rencontres.seul', ({ minimum }) => `Le moins bien servi rencontre ${compte(minimum, 'personne différente', 'personnes différentes')}.`],
  [
    'diagnostic.proposition.populations',
    ({ mobiles, ancres }) => `Chez les mobiles, le moins bien servi en rencontre ${mobiles} ; chez les ancrés, ${ancres}.`,
  ],
  ['diagnostic.proposition.conflits.aucun', "Aucune paire de personnes en conflit d'organisation ne partage une table."],
  // imposes : les conflits égalent ceux que les réservations imposent.
  [
    'diagnostic.proposition.conflits',
    ({ conflits, imposes }) =>
      `${compte(conflits, 'fois', 'fois')}, deux personnes en conflit d'organisation partagent une table` +
      (imposes ? " : ce sont les conflits que les réservations imposent, et aucun placement qui les honore n'en compte moins." : '.'),
  ],
  // Aucun plan sans conflit n'existe, et la proposition en compte.
  [
    'diagnostic.proposition.conflits.inevitables',
    "Aucun plan n'évite tous les conflits d'organisation : une relance ne les fera pas tomber à zéro.",
  ],
  // Les collisions égalent le plancher renforcé par les conflits en étoile,
  // sans aucun conflit : seul un conflit les abaisserait.
  [
    'diagnostic.proposition.collisions.minimum',
    "Ses collisions sont au minimum : aucune relance ne les fera baisser sans créer de conflit d'organisation.",
  ],
  ['diagnostic.proposition.collisions.aucune', "Aucune paire de collègues d'une même organisation ne partage une table."],
  // plancher : les collisions égalent le plancher que le diagnostic prouve.
  [
    'diagnostic.proposition.collisions',
    ({ collisions, paires, excedent, plancher }) =>
      `${compte(collisions, 'fois', 'fois')}, deux personnes d'une même organisation partagent une table, ` +
      (excedent === 0
        ? 'toujours des paires différentes : aucune paire de collègues ne se retrouve deux fois'
        : `${paires === 1 ? 'toujours la même paire' : `en ${paires} paires différentes`} : ${compte(excedent, 'fois', 'fois')}, des collègues ` +
          'déjà assis ensemble se retrouvent') +
      (plancher ? " ; c'est le plancher que le diagnostic prouve, et aucun placement n'en compte moins." : '.'),
  ],
  [
    'diagnostic.proposition.retours',
    ({ retours }) =>
      retours === 0
        ? "Personne ne revient à une table où il s'est déjà assis, hors des retours que les réservations imposent."
        : `${compte(retours, 'fois', 'fois')}, quelqu'un revient à une table où il s'est déjà assis sans qu'une réservation ` +
          "l'y ramène : ce sont les retours choisis.",
  ],
  // diversite : le plus bas taux de diversité, au centième, comme au
  // tableau des propositions.
  [
    'diagnostic.proposition.diversite',
    ({ organisations, redondance, diversite }, texte) =>
      (organisations === 0
        ? "Quelqu'un ne rencontre personne qui déclare une organisation"
        : `Chacun rencontre au moins ${compte(organisations, 'organisation différente', 'organisations différentes')}`) +
      ` ; ${compte(redondance, 'fois', 'fois')} en tout, quelqu'un rencontre une personne d'une organisation qu'il a déjà ` +
      `croisée, et le taux de diversité le plus bas vaut ${nombre(diversite, texte, 2)}.`,
  ],
  [
    'diagnostic.proposition.objectifs',
    ({ horsObjectif, jamaisServies }) =>
      `Les objectifs des tables : ${compte(horsObjectif, 'tour', 'tours')} passés par une personne visée à une autre table ` +
      'que celles de son objectif, et ' +
      (jamaisServies === 0
        ? "aucune personne visée qui ne s'y assoie jamais."
        : `${compte(jamaisServies, "personne visée qui ne s'y assoit", "personnes visées qui ne s'y assoient")} à aucun tour.`),
  ],
  [
    'diagnostic.proposition.animateurs',
    ({ minimum, nonRencontres }) =>
      `Chacun rencontre au moins ${compte(minimum, 'animateur', 'animateurs')} là où ils animent ; ` +
      `${compte(nonRencontres, "rencontre d'animateur possible n'a", "rencontres d'animateurs possibles n'ont")} pas lieu.`,
  ],
  // Ce qui manque. ecart : l'écart au plafond a priori maximal, puis
  // l'écart d'itinéraire maximal ; manque, le plus grand manque, effectif,
  // les personnes à qui il en manque.
  [
    'diagnostic.proposition.manque.aucun',
    "Personne ne manque de rien : chacun rencontre tout ce que son plafond a priori permet, et c'est le minimum atteint.",
  ],
  [
    'diagnostic.proposition.manque.ecart',
    ({ ecart }) =>
      `Il manque au plus ${compte(ecart, 'rencontre', 'rencontres')} à une même personne pour atteindre son plafond a priori ; ` +
      'deux causes se le partagent, la place où chacun est assis et les revoirs.',
  ],
  [
    'diagnostic.proposition.manque.itineraire',
    ({ ecart }) =>
      `La place : là où ce placement assoit chacun, quelqu'un perd jusqu'à ${compte(ecart, 'rencontre', 'rencontres')} ` +
      "sur son plafond a priori, car s'asseoir à une table incomplète, ou passer par moins de tables différentes qu'il n'était " +
      'possible, offre moins de personnes nouvelles.',
  ],
  [
    'diagnostic.proposition.manque.itineraireNul',
    "La place ne coûte rien : personne ne perd de rencontre par la table où ce placement l'assoit.",
  ],
  [
    'diagnostic.proposition.manque.placesVides',
    ({ placesVides, places, presents }) =>
      `${compte(placesVides, 'place reste vide', 'places restent vides')} à chaque tour, ${compte(presents, 'personne', 'personnes')} ` +
      `pour ${compte(places, 'place', 'places')} : chaque tour passé à une table incomplète retire une rencontre possible par place vide.`,
  ],
  [
    'diagnostic.proposition.manque.placesVidesSelonTour',
    ({ placesVides }) =>
      `Jusqu'à ${compte(placesVides, 'place reste vide', 'places restent vides')} selon le tour : chaque tour passé à une table ` +
      'incomplète retire une rencontre possible par place vide.',
  ],
  // atteint : l'écart d'itinéraire maximal égale son plancher.
  [
    'diagnostic.proposition.manque.plancherItineraire',
    ({ plancher, atteint }) =>
      `Le diagnostic prouve que cette perte ne descend pas sous ${compte(plancher, 'rencontre', 'rencontres')} pour quelqu'un, ` +
      (atteint ? 'quel que soit le placement : cette proposition en est là.' : 'quel que soit le placement.'),
  ],
  [
    'diagnostic.proposition.manque.revoirs',
    ({ manque, effectif }) =>
      `Les revoirs : à ${compte(effectif, 'personne', 'personnes')}, il manque au moins une rencontre que ` +
      `${effectif <= 1 ? 'sa' : 'leur'} place permettait, ` +
      `jusqu'à ${manque} pour la plus privée ; revoir quelqu'un, c'est ne rencontrer personne de nouveau à sa place.`,
  ],
  // maxPaire : le plus de tours où une même paire se croise, null quand
  // une paire imposée par les réservations entre dans ce maximum.
  [
    'diagnostic.proposition.manque.repetees',
    ({ repetees, maxPaire }) =>
      `${compte(repetees, 'paire se croise', 'paires se croisent')} à plus d'un tour sans qu'une réservation l'impose` +
      (maxPaire === null ? '.' : ` ; une même paire se croise au plus ${compte(maxPaire, 'fois', 'fois')}.`),
  ],
  ['diagnostic.proposition.manque.revoirsNul', "Les revoirs ne coûtent rien : personne ne manque d'une rencontre que sa place permettait."],
  [
    'diagnostic.proposition.manque.nonAdditifs',
    'La plus grande perte par la place et la plus grande par les revoirs ne tombent pas sur la même personne : ' +
      "elles ne s'additionnent pas.",
  ],
  [
    'diagnostic.proposition.manque.inconnue',
    "Atteignabilité inconnue : rien ne prouve qu'un autre placement atteigne le plafond a priori de chacun, ni le contraire.",
  ],
  // mobiles : le nombre de mobiles que le plancher d'écart d'itinéraire
  // prouvé laisse sous leur plafond a priori, quel que soit le placement.
  [
    'diagnostic.proposition.manque.horsAtteinte',
    ({ mobiles }) =>
      `Hors d'atteinte, et c'est prouvé : quel que soit le placement, au moins ${compte(mobiles, 'mobile finit', 'mobiles finissent')} ` +
      `sous ${mobiles <= 1 ? 'son' : 'leur'} plafond a priori ; aucun placement n'atteint le plafond a priori de chacun.`,
  ],
  // Ce qu'on peut tenter. arret : pour « Repartir d'elle », le compte d'arrêt
  // qui a produit la proposition ; pour « Générer », le compte d'arrêt réglé.
  [
    'diagnostic.proposition.tenter.repartir',
    ({ proposition, arret }, texte) =>
      `« Repartir d'elle », dans le menu de la ligne n° ${proposition} du tableau des propositions, avec un compte d'arrêt ` +
      `plus élevé que ${nombre(arret, texte)} dans la section Génération${RECHERCHE_PLUS_LONGUE}`,
  ],
  [
    'diagnostic.proposition.tenter.generer',
    ({ arret }, texte) =>
      `« Générer », dans la section Génération, avec un compte d'arrêt plus élevé que ${nombre(arret, texte)}${RECHERCHE_PLUS_LONGUE}`,
  ],
  [
    'diagnostic.proposition.tenter.tables',
    'Accorder les places des tables au nombre de personnes présentes, dans la section « Tables et tours » : des tables pleines ' +
      "retirent les places vides ; si leurs capacités diffèrent alors, le diagnostic dit l'écart d'itinéraire qui demeure.",
  ],
  [
    'diagnostic.proposition.tenter.capacites',
    "Le plancher de l'écart d'itinéraire tient aux capacités ou aux ancrages qui diffèrent d'une table à l'autre : aucune " +
      'relance ne le franchit, seules les tables, dans la section « Tables et tours », le changent.',
  ],
  [
    'diagnostic.proposition.tenter.rien',
    "Rien pour les rencontres : elle atteint le plafond a priori de chacun, et aucune relance ne lui fait rencontrer plus de monde.",
  ],

  // --- Les remèdes -----------------------------------------------------------
  ['diagnostic.remede.separation', 'désactiver la séparation des organisations'],
  [
    'diagnostic.remede.tables',
    ({ tablesManquantes }) =>
      tablesManquantes === 1
        ? '1 table de plus, de la plus grande capacité présente, la rend évitable'
        : `${tablesManquantes} tables de plus, de la plus grande capacité présente, la rendent évitable`,
  ],
  [
    'diagnostic.remede.redistribuer',
    "les réservations assoient des membres ensemble ; répartir autrement l'organisation la rend évitable",
  ],
  [
    'diagnostic.remede.tours',
    ({ toursSansRedondance, tours }) =>
      `avec ${compte(toursSansRedondance, 'tour', 'tours')} au lieu de ${tours}, aucune ne le serait`,
  ],
  ['diagnostic.remede.organisations', "aucun nombre de tours plus petit ne l'annule : elle tient aux organisations déclarées"],
  ['diagnostic.remede.animateurs', 'laisser les animateurs sans organisation déclarée, ou leur en donner des distinctes'],
  [
    'diagnostic.remede.ancrage',
    'retirer des réservations de portée « tous les tours » à cette table, ou lui ajouter des places, la remet en rotation',
  ],
  [
    'diagnostic.remede.ecartItineraire',
    "aucune relance ne le réduit : il tient aux tables pleines dont les capacités ou les ancrages diffèrent",
  ],
  ['diagnostic.remede.places', "ajouter des tables ou des places, ou exclure des personnes ; d'ici là, la génération est refusée"],
  ['diagnostic.remede.plafond', 'seuls les capacités, le nombre de tours et les réservations le changent ; aucune relance ne le dépasse'],
  [
    'diagnostic.remede.objectifs',
    "ajouter des places aux tables qui portent un objectif, ou donner un objectif à d'autres tables, abaisse ce plancher",
  ],
  ['diagnostic.remede.imposes', 'les réservations les imposent : ils ne comptent pas parmi les retours que choisit le moteur'],
  [
    'diagnostic.remede.conflitsEtoile',
    "ajouter des tables abaisse ce plancher, jusqu'à l'annuler ; lever le conflit entre ces organisations, dans la colonne " +
      "« Conflit d'organisation » des participants, le ramène aux planchers de chacune",
  ],
  ['diagnostic.remede.conflitsInevitables', 'ajouter des tables, lever un conflit ou retirer une réservation'],
  ['diagnostic.remede.collisionsExactes', "ajouter des tables ou des places abaisse ce plancher, lever un conflit d'organisation aussi"],
  [
    'diagnostic.remede.conflitsImposes',
    'des personnes en conflit sont réservées à une même table ; déplacer ou retirer l’une de ces réservations les sépare',
  ],
]);
