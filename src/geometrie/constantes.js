// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le registre des constantes mesurées (§ 14.1, § 19.10). Toute dimension qui
// dépend du rendu ou du geste se relève, jamais ne se déduit : chaque entrée
// dit ce qu'elle mesure, pourquoi elle existe, sur quelle configuration elle
// se relève, qui la relève et comment. Tant que son propriétaire ne l'a pas
// relevée, une constante porte sa valeur de départ et se déclare défaut de
// travail ; il écrit ici la valeur relevée, passe le statut à « mesuree » et
// complète la configuration. Le banc de mesure lit ce tableau pour en
// engendrer la région de la documentation (§ 19.10).

/**
 * @typedef {Object} Constante
 * @property {string} nom
 * @property {number|null} valeur  null pour une constante relevée à l'exécution
 * @property {string} unite
 * @property {string} mesure          ce qu'elle mesure
 * @property {string} raison          pourquoi elle existe
 * @property {string} configuration   sur quoi elle se relève : machine, cadre, configuration
 * @property {'banc'|'node'|'manuel'|'execution'} proprietaire
 * @property {'mesuree'|'defautDeTravail'} statut
 * @property {string} protocole       comment le propriétaire la relève, et où il l'écrit
 */

const PROPRIETAIRES = new Set(['banc', 'node', 'manuel', 'execution']);
const STATUTS = new Set(['mesuree', 'defautDeTravail']);

/** @type {ReadonlyArray<Readonly<Constante>>} */
export const CONSTANTES = Object.freeze(
  [
    {
      nom: 'SEUIL_GLISSER_PX',
      valeur: 4,
      unite: 'px',
      mesure: "déplacement du pointeur, entre pointerdown et pointerup, au-delà duquel un appui devient un glissement",
      raison: "un clic délibéré bouge de quelques pixels : sous ce seuil, il resterait un clic et ne déplacerait rien (§ 8.4)",
      configuration: 'pavé tactile de la machine de référence',
      proprietaire: 'manuel',
      statut: 'defautDeTravail',
      protocole:
        'vingt clics délibérés au pavé tactile de la machine de référence ; le plus grand déplacement entre ' +
        'pointerdown et pointerup, × 1,5, écrit dans ce registre',
    },
    {
      nom: 'DUREE_PRESSION_LONGUE_MS',
      valeur: 500,
      unite: 'ms',
      mesure: "durée d'un appui immobile au-delà de laquelle il ouvre le menu d'une personne",
      raison: "un appui bref ne doit jamais ouvrir le menu, ni une pression voulue se faire attendre (§ 7.3)",
      configuration: 'écran tactile de la machine de référence',
      proprietaire: 'manuel',
      statut: 'defautDeTravail',
      protocole:
        "à l'écran tactile de la machine de référence, la plus courte durée qu'aucun appui bref ne déclenche, " +
        'sur dix essais, écrite dans ce registre',
    },
    {
      nom: 'SEUIL_SIEGES_LISIBLES',
      valeur: 18,
      unite: 'places',
      mesure: "plus grand nombre de places d'une table dont la liste de noms reste lisible",
      raison: "au-delà, le dessin d'une table cesse d'être lisible, et l'application le signale (§ 6.2)",
      configuration:
        'banc de mesure, cadre de 1 366 × 700 px, facteur 1, Chromium 153.0.8010.12, Node v26.10.0, ' +
        '16 processeurs logiques, processeur non ralenti, police Noto Sans',
      proprietaire: 'banc',
      statut: 'mesuree',
      protocole:
        'banc de mesure, cadre de 1 366 × 700 px : le plus grand nombre de places dont la liste, à la hauteur ' +
        "de ligne mesurée, tient dans la hauteur du cadre au zoom ajusté d'une table seule, ronde puis carrée, " +
        'par dichotomie ; le plus petit des deux seuils, écrit dans ce registre',
    },
    {
      nom: 'K_LISTES',
      valeur: 0.3,
      unite: 'px/cm',
      mesure: 'échelle sous laquelle le plan retire les listes de noms',
      raison:
        "sous elle, les listes de la grande démonstration ne se lisent plus : les dessiner n'apporte rien " +
        "à l'opérateur et charge chaque image (§ 17, point 6). Leur coût ne dépend pas du zoom : le temps " +
        'par image reste une garde du banc, pas son arbitre',
      configuration: 'grande démonstration, 33 tables avec listes, machine de référence, cadre de 1 366 × 700 px',
      proprietaire: 'manuel',
      statut: 'defautDeTravail',
      protocole:
        "une personne qui n'a pas écrit le logiciel lit les listes de la grande démonstration sur la machine " +
        'de référence à k décroissant ; le plus petit k où elle les lit sans erreur, écrit dans ce registre',
    },
    {
      nom: 'LARGEUR_BLOC_NOMS_CM',
      valeur: 500,
      unite: 'cm',
      mesure: "largeur, dans le dessin, du bloc de noms d'une table, où un nom trop long s'abrège",
      raison:
        "la ligne entière d'une place réservée et titrée (numéro, état, nom, titre) tient sur une ligne " +
        'du plan au corps des listes, la liste faisant foi (§ 7.4, § 7.6)',
      configuration: 'grande démonstration au zoom par défaut',
      proprietaire: 'manuel',
      statut: 'defautDeTravail',
      protocole:
        "relecture de la grande démonstration au zoom par défaut par une personne qui n'a pas écrit le " +
        'logiciel (§ 19.11) ; la largeur retenue, écrite dans ce registre',
    },
    {
      nom: 'HAUTEUR_LIGNE',
      valeur: null,
      unite: 'cm',
      mesure: "hauteur d'une ligne d'une liste de noms, dans le dessin",
      raison: 'deux lignes ne se chevauchent pas, quels que soient les accents et les jambages (§ 7.4)',
      configuration: 'police calculée des listes, relevée à chaque montage du plan',
      proprietaire: 'execution',
      statut: 'mesuree',
      protocole:
        'mesurée à chaque montage du plan : measureText du gabarit « Ôjgq Æ W » sur la police calculée des ' +
        "listes ; aucune valeur n'est écrite dans ce registre",
    },
    {
      nom: 'ZONE_SILENCE_MM',
      valeur: 8,
      unite: 'mm',
      mesure: "distance en deçà de laquelle aucun texte ni aucune marque ne s'approche d'un bord de badge",
      raison:
        'la garantie de la coupe (§ 11.3), qui couvre deux bornes différentes selon le bord : sur un bord de ' +
        "coupe, le décalage de l'imprimante, qui déplace la planche entière, plus l'erreur de main, qui " +
        "déplace la lame ; sur un bord de feuille, la marge non imprimable de l'imprimante et le biais " +
        "d'entraînement du papier. La plus grande des deux se relève, et ne se calcule pas",
      configuration: 'imprimantes visées, chaque papier des sorties, massicot et ciseaux',
      proprietaire: 'manuel',
      statut: 'defautDeTravail',
      protocole:
        'sur chaque imprimante visée : une planche de filets imprimée, son décalage mesuré à la règle, plus ' +
        "l'erreur de dix coupes ; puis sa marge non imprimable et le biais d'entraînement sur dix feuilles. " +
        'La plus grande des deux bornes, arrondie au millimètre supérieur, écrite dans ce registre',
    },
    {
      nom: 'HAUTEUR_CAPITALE_NOM_MAX_MM',
      valeur: 9,
      unite: 'mm',
      mesure: "hauteur de capitale du nom sur le badge, au plus grand corps que la mise en page lui donne",
      raison: "le nom se lit à un mètre (§ 11.4) ; au-delà, il replie trop tôt sans se lire mieux",
      configuration: 'badge A6 imprimé, police embarquée, lecture à un mètre',
      proprietaire: 'manuel',
      statut: 'defautDeTravail',
      protocole:
        "impression réelle d'une planche ; lecture à un mètre par une personne qui n'a pas écrit le " +
        'logiciel ; la hauteur retenue, écrite dans ce registre',
    },
    {
      nom: 'HAUTEUR_CAPITALE_NOM_PLANCHER_MM',
      valeur: 4,
      unite: 'mm',
      mesure: 'hauteur de capitale du nom sous laquelle la mise en page ne descend pas : un nom plus long replie',
      raison: "sous elle, le nom ne se lit plus à un mètre (§ 11.5) ; elle se convertit en corps par la hauteur de capitale de la police embarquée",
      configuration: 'badge A6 imprimé, police embarquée, lecture à un mètre',
      proprietaire: 'manuel',
      statut: 'defautDeTravail',
      protocole:
        "impression réelle d'une planche à hauteurs décroissantes ; lecture à un mètre par une personne qui " +
        "n'a pas écrit le logiciel ; la plus petite lue sans erreur, écrite dans ce registre",
    },
    {
      nom: 'CORPS_TOURS_PT',
      valeur: 14,
      unite: 'pt',
      mesure: 'corps des lignes de tour du badge',
      raison: 'la table et le siège de chaque tour se lisent en main, badge au cou (§ 11.4)',
      configuration: 'badge A6 imprimé, police embarquée, lecture en main',
      proprietaire: 'manuel',
      statut: 'defautDeTravail',
      protocole:
        "impression réelle d'une planche ; lecture en main par une personne qui n'a pas écrit le logiciel ; " +
        'le corps retenu, écrit dans ce registre',
    },
    {
      nom: 'CORPS_TOURS_PLANCHER_PT',
      valeur: 10,
      unite: 'pt',
      mesure: 'corps sous lequel les lignes de tour ne descendent pas',
      raison: 'au-delà, des tours trop nombreux se refusent plutôt que de devenir illisibles (§ 11.5)',
      configuration: 'badge A6 imprimé, police embarquée, lecture en main',
      proprietaire: 'manuel',
      statut: 'defautDeTravail',
      protocole:
        "impression réelle d'une planche à corps décroissants ; lecture en main par une personne qui n'a pas " +
        'écrit le logiciel ; le plus petit corps lu sans erreur, écrit dans ce registre',
    },
    {
      nom: 'CORPS_APPARTENANCE_PT',
      valeur: 12,
      unite: 'pt',
      mesure: "corps de la ligne d'appartenance du badge",
      raison: "l'appartenance se lit en main, sous le nom, sans lui disputer la lecture à un mètre (§ 11.4)",
      configuration: 'badge A6 imprimé, police embarquée, lecture en main',
      proprietaire: 'manuel',
      statut: 'defautDeTravail',
      protocole:
        "impression réelle d'une planche ; lecture en main par une personne qui n'a pas écrit le logiciel ; " +
        'le corps retenu, écrit dans ce registre',
    },
    {
      nom: 'CORPS_PIED_PT',
      valeur: 8,
      unite: 'pt',
      mesure: "corps du pied du badge : nom et date de l'événement, horodatage du placement",
      raison: "le pied se lit en main, à l'accueil, et ne prend pas la place du nom (§ 11.4)",
      configuration: 'badge A6 imprimé, police embarquée, lecture en main',
      proprietaire: 'manuel',
      statut: 'defautDeTravail',
      protocole:
        "impression réelle d'une planche ; lecture en main par une personne qui n'a pas écrit le logiciel ; " +
        'le corps retenu, écrit dans ce registre',
    },
    {
      nom: 'CORPS_MIN_IMPRESSION_MM',
      valeur: 2.5,
      unite: 'mm',
      mesure: 'hauteur de caractère du plan imprimé en deçà de laquelle le plan se découpe en pages',
      raison:
        "un plan réduit sur une page n'est utile que s'il se lit. Un banc de navigateur ne mesure pas une " +
        'imprimante, pas plus que la zone de silence (§ 11.3) : la mesure relève du niveau manuel',
      configuration: 'imprimante visée, chaque papier des sorties, lecture à bout de bras',
      proprietaire: 'manuel',
      statut: 'defautDeTravail',
      protocole:
        "page d'essai à corps décroissants imprimée sur l'imprimante visée, lue à bout de bras ; le plus " +
        'petit corps lu sans erreur, écrit dans ce registre',
    },
    {
      nom: 'MARGE_PAGE_MM',
      valeur: 10,
      unite: 'mm',
      mesure: "marge de chaque bord d'une page imprimée par l'aperçu",
      raison: "le contenu d'une page tient hors de la marge non imprimable de toute imprimante visée (§ 11.7)",
      configuration: 'imprimantes visées, chaque papier des sorties',
      proprietaire: 'manuel',
      statut: 'defautDeTravail',
      protocole:
        "marge non imprimable mesurée sur chaque imprimante visée (une page de filets à 1 mm d'écart, lue " +
        'à la règle) ; la plus grande, écrite dans ce registre',
    },
    {
      nom: 'HAUTEUR_BANDE_IMPRESSION',
      valeur: null,
      unite: 'mm',
      mesure: 'hauteur de ce que porte une feuille imprimée hors de sa zone de contenu : pied, mentions, barre, cartouche',
      raison: "la hauteur utile d'une page en dépend ; elle suit la police et le rendu, et se lit donc sur la page (§ 14.1)",
      configuration: "rendu de l'aperçu, relevé à chaque ouverture",
      proprietaire: 'execution',
      statut: 'mesuree',
      protocole:
        "mesurée à l'ouverture de l'aperçu : tout ce qu'une feuille porte hors de [data-contenu] ; aucune " +
        "valeur n'est écrite dans ce registre",
    },
    {
      nom: 'TOLERANCE_CHAINE_TEMOIN',
      valeur: 0.011,
      unite: 'rapport',
      mesure: 'écart relatif admis entre la longueur rendue de la chaîne témoin et celle que donnent les avances de la police',
      raison:
        "la mesure du § 19.4 trahit une police de repli ; trop serrée, elle échoue sur la gigue du rendu, trop " +
        'large, elle laisse passer le repli',
      configuration:
        'banc de mesure, cadre de 1 366 × 700 px, facteur 1, Chromium 153.0.8010.12, Node v26.10.0, ' +
        '16 processeurs logiques, processeur non ralenti, police Noto Sans',
      proprietaire: 'banc',
      statut: 'mesuree',
      protocole:
        "banc de mesure : le quart de l'écart relatif entre la police embarquée et une famille de repli " +
        'forcée, et au moins trois fois la gigue de dix mesures, chaîne témoin à 16 px, crénage et ligatures ' +
        'coupés ; arrondi par excès à deux chiffres significatifs, écrit dans ce registre',
    },
    {
      nom: 'RALENTISSEMENT_PLEINE_CHARGE',
      valeur: 2,
      unite: '×',
      mesure: "ralentissement d'une génération quand tous les processeurs logiques travaillent, t(L) / t(1)",
      raison: "l'estimation de durée d'une génération parallèle compte un cœur chargé plus lent qu'un cœur seul",
      configuration: "banc de mesure, exécuteur de production dans Chromium, L processeurs logiques",
      proprietaire: 'banc',
      statut: 'defautDeTravail',
      protocole:
        "banc de mesure : durée d'une même génération sur un travailleur, puis sur L travailleurs ; le " +
        'rapport ρ des médianes, écrit dans ce registre',
    },
  ].map((entree) => Object.freeze(entree)),
);

// Champs textuels d'une entrée, qui ne peuvent être vides.
const CHAMPS_TEXTE = ['unite', 'mesure', 'raison', 'configuration'];

const estTexte = (valeur) => typeof valeur === 'string' && valeur.length > 0;

/**
 * La valeur de la constante nommée ; null pour une constante relevée à
 * l'exécution. Lève RangeError sur un nom absent du registre.
 * @param {string} nom
 * @returns {number|null}
 */
export function constante(nom) {
  const entree = CONSTANTES.find((c) => c.nom === nom);
  if (entree === undefined) throw new RangeError(`constante inconnue : ${String(nom)}`);
  return entree.valeur;
}

/**
 * Les fautes d'un registre, [] quand chaque entrée est complète : une par
 * champ fautif, dans l'ordre des entrées, puis dans l'ordre des champs du
 * type Constante. Un nom vide, ou déjà porté par une entrée précédente, est
 * une faute ; la valeur est un nombre fini, et null pour une constante
 * relevée à l'exécution seulement ; les champs textuels ne sont pas vides ;
 * propriétaire et statut prennent une valeur de leur liste, et une
 * constante relevée à l'exécution est mesurée : sa valeur vient du rendu à
 * chaque relevé, jamais d'un défaut de travail.
 * @param {ReadonlyArray<Constante>} liste
 * @returns {Array<{nom: string, champ: string}>}
 */
export function verifierRegistre(liste) {
  const vus = new Set();
  const fautes = [];
  for (const entree of liste) {
    const nom = entree.nom;
    const faute = (champ) => fautes.push({ nom, champ });
    if (!estTexte(nom) || vus.has(nom)) faute('nom');
    vus.add(nom);
    const execution = entree.proprietaire === 'execution';
    if (execution ? entree.valeur !== null : !Number.isFinite(entree.valeur)) faute('valeur');
    for (const champ of CHAMPS_TEXTE) {
      if (!estTexte(entree[champ])) faute(champ);
    }
    if (!PROPRIETAIRES.has(entree.proprietaire)) faute('proprietaire');
    if (!STATUTS.has(entree.statut) || (execution && entree.statut !== 'mesuree')) faute('statut');
    if (!estTexte(entree.protocole)) faute('protocole');
  }
  return fautes;
}
