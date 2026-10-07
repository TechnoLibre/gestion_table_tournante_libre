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
      valeur: 16,
      unite: 'places',
      mesure: "plus grand nombre de places d'une table dont la liste de noms reste lisible",
      raison: "au-delà, le dessin d'une table cesse d'être lisible, et l'application le signale (§ 6.2)",
      configuration: 'banc de mesure, cadre de 1 366 × 700 px',
      proprietaire: 'banc',
      statut: 'defautDeTravail',
      protocole:
        'banc de mesure, cadre de 1 366 × 700 px : le plus grand nombre de places dont la liste, à la hauteur ' +
        "de ligne mesurée, tient dans la hauteur du cadre au zoom ajusté d'une table seule ; écrit dans ce registre",
    },
    {
      nom: 'K_LISTES',
      valeur: 0.3,
      unite: 'px/cm',
      mesure: 'échelle sous laquelle le plan retire les listes de noms',
      raison: "sous elle, dessiner les listes coûte plus d'une image par déplacement de vue (§ 17, point 6)",
      configuration: 'banc de mesure, grande démonstration, 33 tables avec listes',
      proprietaire: 'banc',
      statut: 'defautDeTravail',
      protocole:
        'banc de mesure : temps par image pendant un déplacement de vue sur la grande démonstration, 33 tables ' +
        'avec listes, à plusieurs k ; le plus petit k qui tient le critère de temps par image, écrit dans ce registre',
    },
    {
      nom: 'LARGEUR_BLOC_NOMS_CM',
      valeur: 180,
      unite: 'cm',
      mesure: "largeur, dans le dessin, du bloc de noms d'une table, où un nom trop long s'abrège",
      raison: 'un nom tient sur une ligne du plan sans recouvrir la table voisine (§ 7.4)',
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
 * propriétaire et statut prennent une valeur de leur liste.
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
    if (!STATUTS.has(entree.statut)) faute('statut');
    if (!estTexte(entree.protocole)) faute('protocole');
  }
  return fautes;
}
