// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés du diagnostic d'une configuration (§ 5.6, § 14.6). Chaque clé
// commence par « diagnostic. ». Un énoncé (phrases.js) a son texte sous sa
// clé, son remède sous diagnostic.remede.<nom>. Chaque chiffre nomme son
// unité : une collision se compte en occurrences, une paire distincte à
// part (§ 5.4). L'appartenance d'un groupe est une donnée : l'écran la pose
// dans son propre nœud, avant le texte, qu'aucune entrée de cette table ne
// lui fait porter.
import { compte, enumeration } from '../../application/libelles/aides.js';

// « sur le tour » ou « sur les R tours ».
const surLesTours = (tours) => (tours === 1 ? 'sur le tour' : `sur les ${tours} tours`);

export const TABLE = new Map([
  // --- Le cadre de l'écran ---------------------------------------------------
  ['diagnostic.enonces', 'Ce que la configuration impose'],
  ['diagnostic.nonCalcule', 'La configuration ne se normalise pas : le diagnostic ne se calcule pas.'],
  // Les intitulés des cartes que ne nomme pas une appartenance
  // (cartesDiagnostic) : la séparation vidée de son sens, puis le reste.
  ['diagnostic.carte.separation', 'Séparation des appartenances'],
  ['diagnostic.carte.ensemble', "Tout l'événement"],

  // --- La séparation vidée de son sens (§ 7.5, § 15.4) -----------------------
  [
    'diagnostic.uneSeuleAppartenance',
    'une seule appartenance, portée par chaque personne, sous séparation active : la séparation est vide de sens',
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

  // --- La redondance et les animateurs (§ 5.6) -------------------------------
  [
    'diagnostic.redondance',
    ({ redondanceMinimale }) =>
      `au moins ${compte(redondanceMinimale, 'appartenance recroisée', 'appartenances recroisées')} par personne`,
  ],
  [
    'diagnostic.animateurs',
    ({ redondanceImposeeParAnimateurs }) =>
      'tous les animateurs partagent une appartenance : chaque mobile accumule au moins ' +
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
  [
    'diagnostic.placesManquantes',
    ({ placesManquantes }) =>
      placesManquantes === 1 ? '1 place manque à chaque tour' : `${placesManquantes} places manquent à chaque tour`,
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

  // --- Les remèdes -----------------------------------------------------------
  ['diagnostic.remede.separation', 'désactiver la séparation des appartenances'],
  [
    'diagnostic.remede.tables',
    ({ tablesManquantes }) =>
      tablesManquantes === 1
        ? '1 table de plus, de la plus grande capacité présente, la rend évitable'
        : `${tablesManquantes} tables de plus, de la plus grande capacité présente, la rendent évitable`,
  ],
  [
    'diagnostic.remede.redistribuer',
    "les réservations assoient des membres ensemble : répartir autrement l'appartenance la rend évitable",
  ],
  [
    'diagnostic.remede.tours',
    ({ toursSansRedondance, tours }) =>
      `avec ${compte(toursSansRedondance, 'tour', 'tours')} au lieu de ${tours}, aucune ne le serait`,
  ],
  ['diagnostic.remede.appartenances', "aucun nombre de tours plus petit ne l'annule : elle tient aux appartenances déclarées"],
  ['diagnostic.remede.animateurs', 'laisser les animateurs sans appartenance déclarée, ou leur en donner des distinctes'],
  [
    'diagnostic.remede.ancrage',
    'retirer des réservations de portée « tous les tours » à cette table, ou lui ajouter des places, la remet en rotation',
  ],
  [
    'diagnostic.remede.ecartItineraire',
    "aucune relance ne le réduit : il tient aux tables pleines dont les capacités ou les ancrages diffèrent",
  ],
  ['diagnostic.remede.places', "ajouter des tables ou des places, ou exclure des personnes : d'ici là, la génération est refusée"],
  ['diagnostic.remede.plafond', 'seules les capacités et les réservations le changent : aucune relance ne le dépasse'],
  ['diagnostic.remede.imposes', 'les réservations les imposent : ils ne comptent pas parmi les retours que choisit le moteur'],
]);
