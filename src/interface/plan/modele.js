// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle de dessin du plan (§ 7.3 à § 7.7), sans DOM : ce que PlanDessin
// peint, tiré de l'état des places d'un tour (EtatPlaces, A5) et de la
// géométrie des tables (P2). Le modèle lit les conflits de l'état des
// places, jamais ne les recalcule (§ 7.5) ; il ne rend que des codes, des
// nombres et des données — noms, libellés de titre —, que les composants
// traduisent. Les mesures de texte sont injectées : getComputedTextLength
// au navigateur, une fonction quelconque sous node.
import { constante } from '../../geometrie/constantes.js';
import { regimeCibles } from '../../geometrie/designation.js';
import { geometrieTable } from '../../geometrie/tables.js';
import { decalagesLignes, tronquer } from '../../geometrie/texte.js';

/** Largeur maximale de la barre de l'échelle graphique, en px d'écran. */
export const LARGEUR_ECHELLE_PX = 120;

/** Rayon du disque de la pastille, en cm de dessin : sous la marque de gel
 *  d'une table de 2, la plus petite. */
export const RAYON_PASTILLE = 15;
/** Corps du chiffre de la pastille, en cm de dessin. */
export const TAILLE_TEXTE_PASTILLE_CM = 18;

/** Écart entre le bord d'une chaise et son anneau, ou sa mise en évidence, en cm. */
export const ECART_ANNEAU = 6;
export const ECART_MISE_EN_EVIDENCE = 12;

// Les cadenas d'une chaise (§ 7.6), en cm, centrés sur l'origine : un corps
// plein et une anse, fermée ou ouverte, remplis d'un seul tenant. Le dessin
// les translate au centre de la chaise. Le centre de la boîte de chacun
// tombe dans son corps.
const CORPS = 'M-8,-6 H8 V9 H-8 Z';

/** Le tracé du cadenas fermé, centré sur l'origine, en cm. */
export const CADENAS_FERME = `${CORPS} M-6,-6 V-10 A6,6 0 0 1 6,-10 V-6 H3.5 V-10 A3.5,3.5 0 0 0 -3.5,-10 V-6 Z`;
/** Le tracé du cadenas ouvert : la branche droite de l'anse ne rejoint pas le corps. */
export const CADENAS_OUVERT = `${CORPS} M-6,-6 V-13 A6,6 0 0 1 6,-13 V-10 H3.5 V-13 A3.5,3.5 0 0 0 -3.5,-13 V-6 Z`;

/** Distance entre le haut du plateau et le centre de la marque de gel, en cm. */
export const RETRAIT_GEL = 13;

/** Le tracé de la marque de gel, un hexagone plein centré sur l'origine, en cm. */
export const TRACE_GEL = 'M0,-8 L7,-4 L7,4 L0,8 L-7,4 L-7,-4 Z';

/**
 * Les formes d'une table en attributs SVG, en cm : plateau et emprise —
 * disques d'une ronde ({cx, cy, r}), carrés aux côtés parallèles aux axes
 * d'une carrée ({x, y, width, height}) —, le centre de la pastille, celui du
 * plateau, et celui de la marque de gel, dans le plateau, RETRAIT_GEL sous
 * son haut.
 *
 * @param {import('../../geometrie/tables.js').GeometrieTable} geometrie
 */
export function formesTable({ forme, centre, demiTaille, rayonEmprise }) {
  const ronde = forme === 'ronde';
  const dessiner = (demi) =>
    ronde ? { cx: centre.x, cy: centre.y, r: demi } : { x: centre.x - demi, y: centre.y - demi, width: 2 * demi, height: 2 * demi };
  return {
    ronde,
    plateau: dessiner(demiTaille),
    emprise: dessiner(rayonEmprise),
    pastille: { x: centre.x, y: centre.y },
    gel: { x: centre.x, y: centre.y - demiTaille + RETRAIT_GEL },
  };
}

/**
 * La ligne d'une chaise (§ 7.6) : son numéro, l'état de la place — réservée
 * pour tous les tours, réservée au tour désigné, libre, ou rien pour un
 * occupant sans réservation —, le nom de l'occupant, et le titre de la place.
 * La réservation dit l'état de la place ; l'occupant, le nom : l'occupant
 * d'une place titrée n'en devient pas titulaire (§ 4.1).
 *
 * Une réservation dont la titulaire n'occupe pas la chaise — une source
 * qui assied une autre personne, ou personne, sur la place réservée — ne
 * s'attribue pas à l'occupant : l'état devient plan.ligne.reserveeA, de
 * mêmes portée et tour, et titulaire porte le nom de la personne réservée,
 * que la ligne énonce dans sa propre partie.
 *
 * @param {Object} chaise   EtatChaise
 * @param {(id: number) => string} nomDe   le nom affiché d'un participant
 * @returns {{numero: number, etat: {cle: string, details: Object}|null, titulaire: string|null,
 *            nom: string|null, titre: {libelle: string, pourvu: boolean}|null}}
 */
export function ligneListe(chaise, nomDe) {
  const { siege, occupant, reservation, titre } = chaise;
  let etat = null;
  let titulaire = null;
  if (reservation !== null && reservation.participant !== occupant) {
    etat = { cle: 'plan.ligne.reserveeA', details: { portee: reservation.portee, tour: reservation.tour } };
    titulaire = nomDe(reservation.participant);
  } else if (reservation !== null) {
    etat =
      reservation.portee === 'tous'
        ? { cle: 'plan.ligne.reserveeTous', details: {} }
        : { cle: 'plan.ligne.reserveeTour', details: { tour: reservation.tour } };
  } else if (occupant === null) {
    etat = { cle: 'plan.ligne.libre', details: {} };
  }
  return {
    numero: siege,
    etat,
    titulaire,
    nom: occupant === null ? null : nomDe(occupant),
    titre: titre === null ? null : { libelle: titre.libelle, pourvu: titre.pourvu },
  };
}

/**
 * Les textes d'une ligne, partie par partie : tete — numéro et état, suivis
 * d'une espace quand un nom suit —, teteSansNom — la même sans l'espace,
 * quand le nom tombe —, titulaire et suite, nom, avantTitre, titre — le
 * libellé seul —, apresTitre ; null pour une partie absente. Leur
 * concaténation, dans cet ordre et sans les formes « SansNom », est la
 * ligne entière.
 *
 * Quand la ligne a une titulaire, l'état s'écrit autour de son nom : tete
 * porte le numéro et le début de l'état, titulaire le nom de la personne
 * réservée, suite la portée — suivie d'une espace quand un nom suit —, et
 * suiteSansNom la même sans l'espace ; tete et teteSansNom sont alors
 * égales. Sans titulaire, titulaire, suite et suiteSansNom valent null.
 *
 * @param {ReturnType<typeof ligneListe>} ligne
 * @param {(cle: string, details?: Object) => string} t
 */
export function textesLigne({ numero, etat, titulaire = null, nom, titre }, t) {
  const tete = (avecNom) => t('plan.ligne.tete', { numero, etat, avecNom });
  const espace = nom === null ? '' : ' ';
  const reservee = titulaire === null ? null : t(etat.cle, etat.details);
  return {
    tete: titulaire === null ? tete(nom !== null) : t('plan.ligne.teteReserveeA', { numero }),
    teteSansNom: titulaire === null ? tete(false) : t('plan.ligne.teteReserveeA', { numero }),
    titulaire,
    suite: reservee === null ? null : `${reservee}${espace}`,
    suiteSansNom: reservee,
    nom,
    avantTitre: titre === null ? null : t(titre.pourvu ? 'plan.ligne.avantTitrePourvu' : 'plan.ligne.avantTitreNonPourvu'),
    titre: titre === null ? null : titre.libelle,
    apresTitre: titre === null || titre.pourvu ? null : t('plan.ligne.apresTitreNonPourvu'),
  };
}

/**
 * La ligne qui tient dans largeur (§ 7.4) : le nom s'abrège, suivi de la
 * marque, à la largeur que lui laissent les autres parties ; quand la
 * marque n'y tient plus, le nom tombe — la tête, ou la suite, perd son
 * espace — et le titre s'abrège à son tour ; quand il ne tient plus, il
 * tombe avec ce qui l'entoure, puis le nom de la titulaire s'abrège dans sa
 * partie ; enfin une tête encore trop large s'abrège seule. Le numéro, en
 * tête, part le dernier.
 *
 * Les parties de même style se mesurent ensemble, comme le moteur de rendu
 * les compose : tête, titulaire, suite, nom et avantTitre droits d'un
 * tenant, le titre en italique, apresTitre droit ; un changement de style
 * coupe la composition.
 *
 * @param {ReturnType<typeof textesLigne>} textes
 * @param {{mesurer: (s: string) => number, mesurerItalique: (s: string) => number,
 *          largeur: number, marque: string}} mesures
 * @returns {{tete: string, titulaire: string|null, suite: string|null, nom: string|null,
 *            avantTitre: string|null, titre: string|null, apresTitre: string|null}}
 */
export function ajusterLigne(textes, { mesurer, mesurerItalique, largeur, marque }) {
  const { tete, teteSansNom, nom, avantTitre, titre, apresTitre } = textes;
  const titulaire = textes.titulaire ?? null;
  const suite = textes.suite ?? null;
  const suiteSansNom = textes.suiteSansNom ?? null;
  // Le début droit de la ligne, jusqu'au nom : tête, titulaire et suite.
  const debutAvecNom = `${tete}${titulaire ?? ''}${suite ?? ''}`;
  const debutSansNom = `${teteSansNom}${titulaire ?? ''}${suiteSansNom ?? ''}`;
  // Largeur de ce qui suit le titre, puis du titre en italique.
  const apres = apresTitre === null ? 0 : mesurer(apresTitre);
  const italique = (texte) => (texte === null ? 0 : mesurerItalique(texte));
  const vide = { nom: null, avantTitre: null, titre: null, apresTitre: null };

  if (nom !== null) {
    const reste = italique(titre) + apres;
    const nomAjuste = tronquer(nom, largeur, (candidat) => mesurer(`${debutAvecNom}${candidat}${avantTitre ?? ''}`) + reste, marque);
    if (nomAjuste !== '') return { tete, titulaire, suite, nom: nomAjuste, avantTitre, titre, apresTitre };
  }

  if (titre !== null) {
    const debut = mesurer(`${debutSansNom}${avantTitre}`);
    const titreAjuste = tronquer(titre, largeur, (candidat) => debut + italique(candidat) + apres, marque);
    if (titreAjuste !== '') return { tete: teteSansNom, titulaire, suite: suiteSansNom, ...vide, avantTitre, titre: titreAjuste, apresTitre };
  }

  if (titulaire !== null) {
    const titulaireAjuste = tronquer(titulaire, largeur, (candidat) => mesurer(`${teteSansNom}${candidat}${suiteSansNom}`), marque);
    if (titulaireAjuste !== '') return { tete: teteSansNom, titulaire: titulaireAjuste, suite: suiteSansNom, ...vide };
  }

  return { tete: tronquer(teteSansNom, largeur, mesurer, marque), titulaire: null, suite: null, ...vide };
}

// L'ordre des parties d'une ligne, celui de la lecture.
const PARTIES = ['tete', 'titulaire', 'suite', 'nom', 'avantTitre', 'titre', 'apresTitre'];

/**
 * Les parties présentes d'une ligne ajustée, dans l'ordre de la lecture :
 * chacune son tspan, nommé par data-partie ; le titre seul en italique.
 * @param {ReturnType<typeof ajusterLigne>} ligne
 * @returns {Array<{partie: string, texte: string}>}
 */
export function partiesLigne(ligne) {
  return PARTIES.filter((partie) => (ligne[partie] ?? null) !== null).map((partie) => ({ partie, texte: ligne[partie] }));
}

/**
 * Les lignes de base des n lignes d'un bloc dont le haut est à hautY : la
 * première une hauteur de ligne sous le haut, chacune une hauteur sous la
 * précédente. hauteur est la hauteur d'encre du gabarit (§ 7.4) : deux
 * lignes consécutives ne se chevauchent pas.
 * @param {number} hautY  @param {number} n  @param {number} hauteur
 * @returns {number[]}
 */
export function ordonneesLignes(hautY, n, hauteur) {
  return decalagesLignes(n, hauteur).map((decalage) => hautY + hauteur + decalage);
}

/**
 * La longueur d'une barre d'échelle en mots : sa valeur dans l'unité qui la
 * rend lisible — cm sous le mètre, m sous le kilomètre, km au-delà —, le
 * nombre de décimales qu'elle demande, et la clé de l'unité.
 * @param {number} longueurCm   1, 2 ou 5 × 10ⁿ
 * @returns {{valeur: number, decimales: number, cle: string}}
 */
export function libelleLongueur(longueurCm) {
  let valeur = longueurCm;
  let cle = 'plan.echelle.centimetres';
  if (longueurCm >= 100000) {
    valeur = longueurCm / 100000;
    cle = 'plan.echelle.kilometres';
  } else if (longueurCm >= 100) {
    valeur = longueurCm / 100;
    cle = 'plan.echelle.metres';
  }
  // Sous l'unité, une mantisse 1, 2 ou 5 × 10⁻ⁿ demande n décimales ; la
  // marge absorbe l'arrondi du logarithme d'une puissance de dix.
  const decimales = valeur >= 1 ? 0 : Math.ceil(-Math.log10(valeur) - 1e-9);
  return { valeur, decimales, cle };
}

// Le bandeau du plan (§ 7.5) : vide tant qu'une table au moins est saine ;
// sinon la phrase, puis collisionPartout quand le diagnostic le prouve, puis
// les planchers — une seule appartenance, ou chaque groupe de collisions,
// ou l'absence de plancher prouvé. Les chiffres sont ceux du moteur, tels
// quels, sans somme ; sans diagnostic, la phrase seule.
function bandeauDe(toutesEnConflit, diagnostic) {
  if (!toutesEnConflit) return [];
  const entrees = [{ cle: 'plan.bandeau.toutesEnConflit', details: {} }];
  if (diagnostic === null) return entrees;
  if (diagnostic.collisionPartout) entrees.push({ cle: 'plan.bandeau.collisionPartout', details: {} });
  if (diagnostic.uneSeuleAppartenance) {
    entrees.push({ cle: 'plan.bandeau.uneSeuleAppartenance', details: {} });
  } else if (diagnostic.collisions.length > 0) {
    for (const { groupe, effectif, plancherCumulees } of diagnostic.collisions) {
      entrees.push({ cle: 'plan.bandeau.plancherGroupe', details: { groupe, effectif, plancherCumulees } });
    }
  } else {
    entrees.push({ cle: 'plan.bandeau.sansPlancher', details: {} });
  }
  return entrees;
}

// Une chaise libre au siège s : celle qu'ajoute la poignée au-delà de la
// capacité, que rien ne tient ni n'occupe.
const chaiseLibre = (siege) => ({ siege, occupant: null, reservation: null, titre: null, remplissage: 'normal', marques: [] });

// Les chaises d'une table de l'état des places à places sièges : les siennes
// jusqu'à sa capacité, des chaises libres au-delà.
function chaisesA(etatTable, places) {
  return Array.from({ length: places }, (_, i) => etatTable.chaises[i] ?? chaiseLibre(i + 1));
}

// Le dessin d'une table de l'état des places au zoom k ; places, le nombre
// de sièges que la poignée montre, sinon sa capacité.
function tableDessin(etatTable, { k, miseEnEvidence, nomDe }, places = etatTable.capacite) {
  const { id, numero, gelee, surchargee, conflits } = etatTable;
  const geometrie = geometrieTable(etatTable, places);
  const regime = regimeCibles(k, geometrie);
  const pastille = conflits === null ? 0 : conflits.nombre;
  const etatChaises = chaisesA(etatTable, places);
  const chaises =
    regime === 'table'
      ? []
      : etatChaises.map((chaise, i) => {
          const { x, y, rayon } = geometrie.chaises[i];
          return {
            siege: chaise.siege,
            x,
            y,
            rayon,
            remplissage: chaise.remplissage,
            marques: [...chaise.marques],
            miseEnEvidence: miseEnEvidence !== null && chaise.occupant === miseEnEvidence,
          };
        });
  return {
    id,
    geometrie,
    regime,
    conflit: pastille > 0,
    pastille,
    gelee,
    surchargee,
    nomAccessible: {
      cle: 'plan.table.nom',
      details: { numero, places, conflits: conflits === null ? null : conflits.nombre, gelee, surchargee },
    },
    chaises,
    enTete: gelee ? { cle: 'plan.liste.gelee', details: {} } : null,
    lignes: etatChaises.map((chaise) => ligneListe(chaise, nomDe)),
  };
}

/**
 * Le modèle de dessin d'un tour (§ 7.3 à § 7.7).
 *
 * Chaque table, dans l'ordre de l'état des places, porte sa géométrie
 * (geometrieTable, P2), son régime des cibles au zoom k (regimeCibles) —
 * aucune chaise dessinée en régime table —, son conflit et sa pastille, lus
 * dans conflits — null : ni conflit, ni pastille —, son nom accessible, et
 * une ligne par siège, de 1 à la capacité, précédée de l'en-tête d'une
 * table gelée. Quand toutes les tables sont en conflit, aucune n'est
 * signalée — signalerConflits faux — et le bandeau énonce le diagnostic ;
 * les pastilles gardent leur nombre. Les listes se rendent quand elles
 * sont demandées et que k atteint K_LISTES (§ 17, point 6). La largeur du
 * bloc de noms n'est pas dans le modèle : c'est LARGEUR_BLOC_NOMS_CM du
 * registre, que le dessin lit.
 *
 * Pendant le tirage d'une poignée (option poignee), la table qu'elle désigne
 * se dessine à places sièges — géométrie, régime, chaises, lignes et nom
 * accessible —, ses chaises 1 à places, celles au-delà de sa capacité
 * libres ; l'état des places n'est pas touché, et rien ne s'écrit (§ 7.1).
 *
 * @param {Object} etatPlaces   EtatPlaces (A5)
 * @param {{k: number, listes: boolean, miseEnEvidence: number|null,
 *          nomDe: (id: number) => string, diagnostic?: Object|null,
 *          poignee?: {table: number, places: number}|null}} options
 *        diagnostic : celui que rend diagnostiquer, compléments de M1 compris
 * @returns {Object}   ModeleDessin
 */
export function modeleDessin(etatPlaces, { k, listes, miseEnEvidence, nomDe, diagnostic = null, poignee = null }) {
  const tables = etatPlaces.tables.map((etatTable) =>
    tableDessin(etatTable, { k, miseEnEvidence, nomDe }, poignee !== null && poignee.table === etatTable.id ? poignee.places : etatTable.capacite),
  );
  const toutesEnConflit = tables.length > 0 && tables.every(({ conflit }) => conflit);
  return {
    tables,
    signalerConflits: !toutesEnConflit,
    bandeau: bandeauDe(toutesEnConflit, diagnostic),
    listesRendues: listes && k >= constante('K_LISTES'),
  };
}
