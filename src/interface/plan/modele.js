// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle de dessin du plan (§ 7.3 à § 7.7), sans DOM : ce que PlanDessin
// peint, tiré de l'état des places d'un tour (EtatPlaces, A5) et de la
// géométrie des tables (P2). Le modèle lit les conflits de l'état des
// places, jamais ne les recalcule (§ 7.5) ; il ne rend que des codes, des
// nombres et des données — noms, libellés de titre —, que les composants
// traduisent. Les mesures de texte sont injectées : getComputedTextLength
// au navigateur, une fonction quelconque sous node.
import { constante } from '../../geometrie/constantes.js';
import { regimeCibles } from '../../geometrie/designation.js';
import {
  ENCRE_BAS_LIGNE,
  ENCRE_HAUT_LIGNE,
  RAYON_PASTILLE,
  RETRAIT_GEL,
  lignesLibelle,
  placeGel,
  placeNumero,
  placePastille,
} from '../../geometrie/plateau.js';
import { geometrieTable } from '../../geometrie/tables.js';
import { decalagesLignes, replier, tronquer } from '../../geometrie/texte.js';
import { CONFLITS } from '../marques.js';

/** Largeur maximale de la barre de l'échelle graphique, en px d'écran. */
export const LARGEUR_ECHELLE_PX = 120;

/** Rayon du disque de la pastille, en cm de dessin (plateau.js). */
export { RAYON_PASTILLE };
/** Rayon du socle de la pastille, en cm de dessin : un disque du fond du
 *  plateau, centré sous la pastille sur le bord d'une table signalée, qui la
 *  sépare de la trame (§ 14.5). Le dessin le rogne au plateau : il ne peint
 *  rien hors de lui. Plus petit que le plateau le plus petit, de rayon
 *  PLANCHER_DIAMETRE / 2 : il n'en couvre qu'un bord, et la trame reste
 *  peinte sur le reste. */
export const RAYON_SOCLE_PASTILLE = 20;
/** Distance entre le centre de la pastille et chaque bout du retracé du
 *  contour épaissi, en cm de dessin. Plus courte que RAYON_PASTILLE : les
 *  coins des bouts du trait, coupés droits, restent sous le disque tant que
 *  le demi-trait, 2 px d'écran, fait moins de 7 cm, soit à tout zoom où le
 *  disque dépasse 9 px de diamètre. Le centre de la pastille reste hors du
 *  trait. */
export const ARRET_RETRACE = 12;
/** Corps du chiffre de la pastille, en cm de dessin. */
export const TAILLE_TEXTE_PASTILLE_CM = 18;
/** Épaisseur du halo du numéro d'une table, et de son libellé, en part de
 *  leur corps : un trait du fond du plateau peint sous le texte, dont la
 *  moitié extérieure le détache des trames qu'il recouvre (§ 14.5). */
export const HALO_NUMERO = 0.16;
/** Rayon du socle du numéro, en part de son corps : un disque du fond du
 *  plateau, centré sous le numéro d'une table signalée, qui le sépare des
 *  trames là où le halo ne passe pas (§ 14.5). Le corps valant 40 % de la
 *  largeur du plateau, le socle en prend 40 % du diamètre : la trame reste
 *  peinte autour. */
export const SOCLE_NUMERO = 0.5;

/** Écart entre le bord d'une chaise et son anneau, ou sa mise en évidence, en cm. */
export const ECART_ANNEAU = 6;
export const ECART_MISE_EN_EVIDENCE = 12;
/** Écart entre le bord d'une chaise, ou d'une emprise, et la marque de
 *  sélection (anneau en tirets), puis le carré du focus, en cm. */
export const ECART_DESIGNATION = 18;
export const ECART_FOCUS = 26;

// Les cadenas d'une chaise (§ 7.6), en cm, centrés sur l'origine : un corps
// plein et une anse, fermée ou ouverte, remplis d'un seul tenant. Le dessin
// les translate au centre de la chaise. Le centre de la boîte de chacun
// tombe dans son corps.
const CORPS = 'M-8,-6 H8 V9 H-8 Z';

/** Le tracé du cadenas fermé, centré sur l'origine, en cm. */
export const CADENAS_FERME = `${CORPS} M-6,-6 V-10 A6,6 0 0 1 6,-10 V-6 H3.5 V-10 A3.5,3.5 0 0 0 -3.5,-10 V-6 Z`;
/** Le tracé du cadenas ouvert : la branche droite de l'anse ne rejoint pas le corps. */
export const CADENAS_OUVERT = `${CORPS} M-6,-6 V-13 A6,6 0 0 1 6,-13 V-10 H3.5 V-13 A3.5,3.5 0 0 0 -3.5,-13 V-6 Z`;

/** Distance entre le haut du plateau et le centre de la marque de gel, en cm (plateau.js). */
export { RETRAIT_GEL };

/** Le tracé de la marque de gel, un hexagone plein centré sur l'origine, en cm. */
export const TRACE_GEL = 'M0,-8 L7,-4 L7,4 L0,8 L-7,4 L-7,-4 Z';

/**
 * Les formes d'une table en attributs SVG, en cm : plateau et emprise —
 * disques d'une ronde ({cx, cy, r}), carrés aux côtés parallèles aux axes
 * d'une carrée ({x, y, width, height}) —, la place du numéro, au centre du
 * plateau, au corps que permettent sa largeur et les chiffres du numéro
 * ({x, y, corps}, placeNumero) — monté au-dessus du centre quand l'option
 * libelle dit qu'un libellé se dessine dessous —, les lignes de ce libellé
 * (lignesLibelle), null sans lui, le centre de la
 * pastille, sur le bord du plateau en haut à droite (placePastille),
 * celui de la marque de gel, dans le plateau, RETRAIT_GEL sous son haut, et
 * le retracé du contour (retrace, l'attribut d d'un <path> ouvert) : le bord
 * du plateau, interrompu sous le disque de la pastille, de ARRET_RETRACE de
 * part et d'autre de son centre. Celui d'une ronde part de la pastille dans
 * le sens des angles croissants et la rejoint par le grand arc ; celui
 * d'une carrée, dont la pastille tient le coin haut droit, descend le côté
 * droit et fait le tour jusqu'au côté haut.
 *
 * @param {import('../../geometrie/tables.js').GeometrieTable} geometrie
 * @param {{libelle?: boolean}} [options]
 *        libelle : vrai quand le libellé de la table se dessine
 */
export function formesTable(geometrie, { libelle = false } = {}) {
  const { forme, centre, demiTaille, rayonEmprise } = geometrie;
  const ronde = forme === 'ronde';
  const dessiner = (demi) =>
    ronde ? { cx: centre.x, cy: centre.y, r: demi } : { x: centre.x - demi, y: centre.y - demi, width: 2 * demi, height: 2 * demi };
  const pastille = placePastille(geometrie);
  return {
    ronde,
    plateau: dessiner(demiTaille),
    emprise: dessiner(rayonEmprise),
    numero: placeNumero(geometrie, { libelle }),
    libelle: libelle ? lignesLibelle(geometrie) : null,
    pastille,
    gel: placeGel(geometrie),
    retrace: ronde ? retraceRonde(centre, demiTaille, pastille) : retraceCarree(centre, demiTaille),
  };
}

// Le bord d'une ronde, de l'angle de la pastille plus l'angle que sous-tend
// une corde de ARRET_RETRACE, jusqu'à l'angle de la pastille moins le même :
// le grand arc, angles croissants.
function retraceRonde(centre, demiTaille, pastille) {
  const angle = Math.atan2(pastille.y - centre.y, pastille.x - centre.x);
  const ouverture = 2 * Math.asin(ARRET_RETRACE / (2 * demiTaille));
  const auBord = (a) => `${centre.x + demiTaille * Math.cos(a)},${centre.y + demiTaille * Math.sin(a)}`;
  return `M${auBord(angle + ouverture)} A${demiTaille},${demiTaille} 0 1 1 ${auBord(angle - ouverture)}`;
}

// Le bord d'une carrée, du côté droit sous le coin haut droit jusqu'au côté
// haut à gauche de ce coin.
function retraceCarree({ x, y }, demi) {
  return `M${x + demi},${y - demi + ARRET_RETRACE} V${y + demi} H${x - demi} V${y - demi} H${x + demi - ARRET_RETRACE}`;
}

/**
 * Les lignes du libellé d'une table sur son plateau (§ 7.4, § 7.7) : le
 * texte replié (replier) dans les lignes que lignesLibelle tire de la
 * géométrie, sous le numéro monté, puis abrégé de la marque quand il ne
 * tient pas dans la dernière. Chaque ligne porte l'ancre de son texte (x,
 * y), au corps des listes, son texte, et son socle en attributs SVG
 * ({x, y, width, height}) : un rectangle du fond du plateau, de la largeur
 * mesurée du texte, son halo compris, et de la hauteur de son encre bornée
 * (ENCRE_HAUT_LIGNE, ENCRE_BAS_LIGNE), que le dessin peint sous le texte
 * d'une table signalée. Deux socles voisins se touchent.
 *
 * @param {import('../../geometrie/tables.js').GeometrieTable} geometrie
 * @param {string} texte   le libellé
 * @param {{mesurer: (s: string) => number, marque: string}} mesures
 *        mesurer : la largeur d'une chaîne au corps des listes, en cm
 * @returns {{corps: number, lignes: Array<{x: number, y: number, texte: string,
 *            socle: {x: number, y: number, width: number, height: number}}>}}
 */
export function libelleDessin(geometrie, texte, { mesurer, marque }) {
  const { corps, lignes: emplacements } = lignesLibelle(geometrie);
  const halo = HALO_NUMERO * corps;
  const largeurs = emplacements.map(({ largeur }) => largeur);
  const lignes = replier(texte, largeurs, mesurer, marque).map((ligne, rang) => {
    const { x, y } = emplacements[rang];
    const largeur = mesurer(ligne) + halo;
    const hauteur = (ENCRE_HAUT_LIGNE + ENCRE_BAS_LIGNE) * corps;
    return { x, y, texte: ligne, socle: { x: x - largeur / 2, y: y - ENCRE_HAUT_LIGNE * corps, width: largeur, height: hauteur } };
  });
  return { corps, lignes };
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
 * La ligne entière en un seul texte : les parties de textesLigne bout à
 * bout, dans l'ordre de la lecture. C'est le nom accessible d'un siège, que
 * le plan annonce quand il devient l'élément actif.
 *
 * @param {ReturnType<typeof ligneListe>} ligne
 * @param {(cle: string, details?: Object) => string} t
 * @returns {string}
 */
export function texteLigne(ligne, t) {
  const textes = textesLigne(ligne, t);
  return ['tete', 'titulaire', 'suite', 'nom', 'avantTitre', 'titre', 'apresTitre']
    .map((partie) => textes[partie] ?? '')
    .join('');
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
// les planchers — une seule organisation, ou chaque groupe de collisions,
// ou l'absence de plancher prouvé. Les chiffres sont ceux du moteur, tels
// quels, sans somme ; sans diagnostic, la phrase seule.
function bandeauDe(toutesEnConflit, diagnostic) {
  if (!toutesEnConflit) return [];
  const entrees = [{ cle: 'plan.bandeau.toutesEnConflit', details: {} }];
  if (diagnostic === null) return entrees;
  if (diagnostic.collisionPartout) entrees.push({ cle: 'plan.bandeau.collisionPartout', details: {} });
  if (diagnostic.uneSeuleOrganisation) {
    entrees.push({ cle: 'plan.bandeau.uneSeuleOrganisation', details: {} });
  } else if (diagnostic.collisions.length > 0) {
    for (const { groupe, effectif, plancherCumulees } of diagnostic.collisions) {
      entrees.push({ cle: 'plan.bandeau.plancherGroupe', details: { groupe, effectif, plancherCumulees } });
    }
  } else {
    entrees.push({ cle: 'plan.bandeau.sansPlancher', details: {} });
  }
  return entrees;
}

// La sorte de conflit de chaque règle du moteur (CONFLITS).
const SORTE_DE_REGLE = new Map(CONFLITS.map((sorte) => [sorte.regle, sorte]));

// Une chaise libre au siège s : celle qu'ajoute la poignée au-delà de la
// capacité, que rien ne tient ni n'occupe.
const chaiseLibre = (siege) => ({ siege, occupant: null, reservation: null, titre: null, remplissage: 'normal', marques: [] });

// Les chaises d'une table de l'état des places à places sièges : les siennes
// jusqu'à sa capacité, des chaises libres au-delà.
function chaisesA(etatTable, places) {
  return Array.from({ length: places }, (_, i) => etatTable.chaises[i] ?? chaiseLibre(i + 1));
}

// Le porteur d'une place {table, siege|null} dans une table dessinée : le
// siège quand la place en nomme un que le régime sièges dessine, 'table'
// quand elle n'en nomme pas ou que le régime table n'en dessine aucun, null
// pour une place d'une autre table.
function porteurDe(place, id, regime) {
  if (place === null || place === undefined || place.table !== id) return null;
  const siege = place.siege ?? null;
  return siege === null || regime === 'table' ? 'table' : siege;
}

// Le dessin d'une table de l'état des places au zoom k ; places, le nombre
// de sièges que la poignée montre, sinon sa capacité. Imprimée, la table
// est en régime sièges, quel que soit k. Son libellé se dessine à
// l'impression et dès K_LISTES, comme les listes de noms, sans égard à leur
// affichage ; le nom accessible le porte à tout zoom.
function tableDessin(etatTable, { k, miseEnEvidence, nomDe, selection = null, actif = null, impression = false }, places = etatTable.capacite) {
  const { id, numero, gelee, surchargee, conflits } = etatTable;
  const libelle = etatTable.libelle ?? null;
  const geometrie = geometrieTable(etatTable, places);
  const trames = conflits === null ? [] : conflits.regles.map(({ regle }) => ({ ...SORTE_DE_REGLE.get(regle) }));
  const regime = impression ? 'sieges' : regimeCibles(k, geometrie);
  const pastille = conflits === null ? 0 : conflits.nombre;
  const etatChaises = chaisesA(etatTable, places);
  const selectionnee = porteurDe(selection, id, regime);
  const active = porteurDe(actif, id, regime);
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
            selection: selectionnee === chaise.siege,
            focus: active === chaise.siege,
          };
        });
  return {
    id,
    numero,
    libelle: impression || k >= constante('K_LISTES') ? libelle : null,
    geometrie,
    regime,
    conflit: pastille > 0,
    pastille,
    trames,
    selection: selectionnee === 'table',
    focus: active === 'table',
    gelee,
    surchargee,
    nomAccessible: {
      cle: 'plan.table.nom',
      details: { numero, libelle, places, conflits: conflits === null ? null : conflits.nombre, gelee, surchargee },
    },
    chaises,
    enTete: gelee ? { cle: 'plan.liste.gelee', details: {} } : null,
    lignes: etatChaises.map((chaise) => ligneListe(chaise, nomDe)),
  };
}

/**
 * Le modèle de dessin d'un tour (§ 7.3 à § 7.7).
 *
 * Chaque table, dans l'ordre de l'état des places, porte son numéro — celui
 * que le plan inscrit sur son plateau, distinct de son identifiant —, son
 * libellé, quand elle en a un et qu'il se dessine — à l'impression, et dès
 * que k atteint K_LISTES —, null sinon, sa
 * géométrie (geometrieTable, P2), son régime des cibles au zoom k (regimeCibles) —
 * aucune chaise dessinée en régime table —, son conflit et sa pastille, lus
 * dans conflits — null : ni conflit, ni pastille —, ses trames — la sorte
 * de conflit (CONFLITS, marques.js) de chaque règle violée, {regle, marque,
 * jeton, forme}, dans l'ordre du moteur —, son nom accessible, et
 * une ligne par siège, de 1 à la capacité, précédée de l'en-tête d'une
 * table gelée. Quand toutes les tables sont en conflit, aucune n'est
 * signalée — signalerConflits faux — et le bandeau énonce le diagnostic ;
 * les pastilles gardent leur nombre. Les listes se rendent quand elles
 * sont demandées et que k atteint K_LISTES (§ 17, point 6). La largeur du
 * bloc de noms n'est pas dans le modèle : c'est LARGEUR_BLOC_NOMS_CM du
 * registre, que le dessin lit.
 *
 * La place sélectionnée (option selection) et l'élément actif du clavier
 * (option actif), {table, siege|null} ou null, marquent leur chaise —
 * drapeaux selection et focus d'une chaise — quand la place nomme un siège
 * que le régime sièges dessine, leur table sinon — drapeaux selection et
 * focus d'une table — ; tout autre porteur garde ses drapeaux faux.
 *
 * Pendant le tirage d'une poignée (option poignee), la table qu'elle désigne
 * se dessine à places sièges — géométrie, régime, chaises, lignes et nom
 * accessible —, ses chaises 1 à places, celles au-delà de sa capacité
 * libres ; l'état des places n'est pas touché, et rien ne s'écrit (§ 7.1).
 *
 * L'option impression rend le plan imprimé (§ 11.7) : k n'y entre pas,
 * chaque table est en régime sièges, ses chaises de 1 à sa capacité, et les
 * listes se rendent dès qu'elles sont demandées. Le papier ne reçoit aucun
 * geste : poignee, selection, actif et miseEnEvidence sont sans effet, et
 * aucun porteur n'est marqué. Le modèle porte impression, que le dessin lit
 * pour ne poser ni poignée, ni cible, ni identifiant, ni rôle.
 *
 * @param {Object} etatPlaces   EtatPlaces (A5)
 * @param {{k?: number, listes: boolean, miseEnEvidence?: number|null,
 *          nomDe: (id: number) => string, diagnostic?: Object|null,
 *          poignee?: {table: number, places: number}|null,
 *          selection?: {table: number, siege?: number|null}|null,
 *          actif?: {table: number, siege: number|null}|null,
 *          impression?: boolean}} options
 *        diagnostic : celui que rend diagnostiquer, compléments de M1 compris ;
 *        k : exigé hors de l'impression ; miseEnEvidence : null par défaut
 * @returns {Object}   ModeleDessin
 */
export function modeleDessin(
  etatPlaces,
  { k, listes, miseEnEvidence = null, nomDe, diagnostic = null, poignee = null, selection = null, actif = null, impression = false },
) {
  const gestes = impression ? { miseEnEvidence: null, selection: null, actif: null } : { miseEnEvidence, selection, actif };
  const tables = etatPlaces.tables.map((etatTable) =>
    tableDessin(
      etatTable,
      { k, nomDe, impression, ...gestes },
      !impression && poignee !== null && poignee.table === etatTable.id ? poignee.places : etatTable.capacite,
    ),
  );
  const toutesEnConflit = tables.length > 0 && tables.every(({ conflit }) => conflit);
  return {
    tables,
    signalerConflits: !toutesEnConflit,
    bandeau: bandeauDe(toutesEnConflit, diagnostic),
    listesRendues: listes && (impression || k >= constante('K_LISTES')),
    impression,
  };
}

/**
 * Le détail des conflits d'une table au tour montré (§ 7.1, § 7.3, § 7.5),
 * que l'infobulle énonce : son numéro, son libellé — null quand elle n'en
 * porte pas —, le nombre de violations, puis ses
 * lignes, dans l'ordre des règles du moteur (conflitsParTable, M1). Chaque
 * ligne porte sa règle, sa clé de libellé plan.infobulle.<règle>, une
 * organisation et ses groupes nommés. Séparer les organisations donne une
 * ligne par organisation, dans l'ordre de sa première paire, qui nomme
 * l'organisation qu'ont en commun les deux personnes de chacune de ses
 * paires — le moteur ne réunit que des personnes de même organisation non
 * nulle, la chaîne même que la liste porte — ; nouveaux voisins et nouvelle
 * table, une ligne chacune, organisation null, une paire de noms ou un nom
 * seul par groupe. Les noms et l'organisation sont des données :
 * l'infobulle pose chacun dans son nœud. null quand les conflits ne
 * s'évaluent pas ou qu'il n'y en a aucun.
 *
 * @param {Object} etatTable   EtatTable (A5)
 * @param {(id: number) => string} nomDe
 * @param {(id: number) => string|null} organisationDe
 * @returns {null|{numero: number, libelle: string|null, nombre: number,
 *   lignes: Array<{regle: string, cle: string, organisation: string|null, groupes: string[][]}>}}
 */
export function detailConflits({ numero, libelle = null, conflits }, nomDe, organisationDe) {
  if (conflits === null || conflits.nombre === 0) return null;
  const lignes = [];
  for (const { regle, paires, personnes } of conflits.regles) {
    const cle = `plan.infobulle.${regle}`;
    if (regle !== 'separerOrganisations') {
      lignes.push({ regle, cle, organisation: null, groupes: (paires ?? personnes.map((id) => [id])).map((groupe) => groupe.map(nomDe)) });
      continue;
    }
    const parOrganisation = new Map();
    for (const paire of paires) {
      const organisation = organisationDe(paire[0]);
      if (!parOrganisation.has(organisation)) {
        const ligne = { regle, cle, organisation, groupes: [] };
        parOrganisation.set(organisation, ligne);
        lignes.push(ligne);
      }
      parOrganisation.get(organisation).groupes.push(paire.map(nomDe));
    }
  }
  return { numero, libelle, nombre: conflits.nombre, lignes };
}

/**
 * La légende des conflits (§ 7.5) : la sorte de conflit (CONFLITS) de
 * chaque règle active des réglages, dans l'ordre du moteur, avec la clé de
 * son nom, plan.legende.<règle>, et celle de sa forme,
 * plan.legende.forme.<forme>. Une règle inactive n'y paraît pas ; varier
 * les organisations, qui ne se localise pas à une table, n'a pas de sorte.
 *
 * @param {{separerOrganisations: boolean, nouveauxVoisins: boolean, nouvelleTable: boolean}} reglages
 * @returns {Array<{regle: string, marque: string, jeton: string, forme: string, cle: string, cleForme: string}>}
 */
export function legendeConflits(reglages) {
  return CONFLITS.filter(({ regle }) => reglages[regle] === true).map((sorte) => ({
    ...sorte,
    cle: `plan.legende.${sorte.regle}`,
    cleForme: `plan.legende.forme.${sorte.forme}`,
  }));
}

/**
 * Les actions qu'offre le panneau d'une place (§ 7.1, § 2.1 étape 6), dans
 * l'ordre de l'affichage : sur une place qu'aucune réservation ne tient,
 * assigner, réserver et désigner, qui portent sur la personne choisie ;
 * assigner aussi sur une place tenue quand une personne est choisie — le
 * dépôt du menu, que la pose refuse sur la place comme un glissement ;
 * donner un titre sur une place sans titre ; retirer la réservation et
 * retirer le titre sur celles qui en portent ; déplacer la réservation ici
 * quand le choix en attente est une réservation.
 *
 * @param {{reservation: Object|null, titre: Object|null}} chaise   EtatChaise
 * @param {Object|null} choix   EtatUi.choix
 * @returns {string[]}   parmi assigner, reserver, donnerTitre, designer,
 *   retirerReservation, retirerTitre, deplacerReservationIci
 */
export function actionsPlace({ reservation, titre }, choix) {
  const libre = reservation === null;
  const personne = choix !== null && choix.genre === 'personne';
  return [
    ['assigner', libre || personne],
    ['reserver', libre],
    ['donnerTitre', titre === null],
    ['designer', libre],
    ['retirerReservation', !libre],
    ['retirerTitre', titre !== null],
    ['deplacerReservationIci', choix !== null && choix.genre === 'reservation'],
  ]
    .filter(([, offerte]) => offerte)
    .map(([action]) => action);
}

/**
 * Le menu d'une personne (§ 7.1), dans l'ordre de l'affichage : déplacer —
 * le choix en attente —, toujours ; échanger quand elle est assise au tour
 * montré ; retirer du tour quand le dépôt sur le sol rend une commande ou un
 * refus (retrait non null) ; réserver ici quand elle est assise sur une
 * place qu'aucune réservation ne tient ; déplacer sa réservation quand la
 * sienne tient sa chaise ; exclure, ou réintégrer une exclue ; la mettre en
 * évidence, ou ôter sa mise en évidence quand elle l'est ; ouvrir la fiche.
 *
 * @param {{exclu: boolean, chaise: Object|null, retrait: Object|null, enEvidence: boolean}} personne
 *        chaise, l'EtatChaise qu'elle occupe au tour montré, null hors du dessin ;
 *        enEvidence, vrai quand elle est la personne mise en évidence (ui.miseEnEvidence)
 * @returns {string[]}   parmi deplacer, echanger, retirerDuTour, reserverIci,
 *   deplacerReservation, exclure, reintegrer, mettreEnEvidence, oterEvidence, ouvrirFiche
 */
export function actionsPersonne({ exclu, chaise, retrait, enEvidence }) {
  const assise = chaise !== null;
  const tenue = assise && chaise.reservation !== null && chaise.reservation.participant === chaise.occupant;
  return [
    ['deplacer', true],
    ['echanger', assise],
    ['retirerDuTour', retrait !== null],
    ['reserverIci', assise && !exclu && chaise.reservation === null],
    ['deplacerReservation', tenue],
    ['exclure', !exclu],
    ['reintegrer', exclu],
    ['mettreEnEvidence', !enEvidence],
    ['oterEvidence', enEvidence],
    ['ouvrirFiche', true],
  ]
    .filter(([, offerte]) => offerte)
    .map(([action]) => action);
}

/**
 * Exécute la commande d'un panneau du plan — panneau d'une place, d'une
 * table, menu d'une personne — et pose son refus sur la place, là où le
 * geste a lieu (§ 5.9) : la même place qu'un glissement refusé, que
 * Plan.svelte montre par ui.pose. Réussie, la commande oublie le choix en
 * attente et retire la pose ; elle rend ce que rend la séance. Refusée — une
 * erreur qui porte un code —, le refus se pose, et null est rendu. Un code de
 * locaux, que l'appelant montre à côté de son champ, une place null et une
 * erreur sans code remontent.
 *
 * @param {{seance: {executer: Function}, ui: {choisir: Function, poserSurPlace: Function}}} dependances
 * @param {{table: number, siege?: number|null}|null} place
 * @param {string} commande
 * @param {Object} args
 * @param {{locaux?: string[]}} [options]
 * @returns {Promise<Object|null>}
 */
export async function executerSurPlace({ seance, ui }, place, commande, args, { locaux = [] } = {}) {
  let rendu;
  try {
    rendu = await seance.executer(commande, args);
  } catch (erreur) {
    if (typeof erreur?.code !== 'string' || place === null || locaux.includes(erreur.code)) throw erreur;
    ui.poserSurPlace({ place, refus: { code: erreur.code, details: erreur.details ?? {} }, avertissements: [] });
    return null;
  }
  ui.choisir(null);
  ui.poserSurPlace(null);
  return rendu;
}
