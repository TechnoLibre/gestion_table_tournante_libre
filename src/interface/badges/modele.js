// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle des badges de la section de l'impression (§ 11.2, § 11.5, § 11.6,
// § 11.8, Q3), pur : SectionBadges.svelte et Reedition.svelte le câblent.
//
// Une planche se tire du placement retenu, ou d'une proposition — celle que
// la section des propositions a demandée au plan —, toujours BROUILLON (Q3).
// La section offre ces sources, le retenu d'abord ; la source qui vaut est
// celle que l'opérateur a choisie tant qu'elle reste offerte, sinon la
// première. Sans source offerte, la demande désigne le retenu, et la séance
// la refuse PLANCHE_SANS_PLACEMENT, remède vers les propositions.
//
// Le modèle de badge est un réglage de la machine (EtatSeance.modeleBadge) :
// la section l'offre, Avery 5392 d'abord. Un modèle qui impose son papier
// n'offre ni imposition ni papier. La case du pied TechnoLibre en est un
// autre (EtatSeance.piedTechnolibre), et l'annonce nomme les badges d'où il
// se retire ; la case qui laisse en blanc le nom des doublons aussi
// (EtatSeance.cacherNumero), comme celle qui met l'organisation en gros
// (EtatSeance.organisationEnGros).
//
// La liste des badges en CSV se tire du même placement que la planche : un
// refus du placement la bloque comme la planche, un refus de la mise en
// page non (listeBloquee).
//
// L'annonce que rend seance.preparerPlanche se dit en phrases : chacune une
// clé de libelles/badges.js et ses détails, données comprises — le nom du
// fichier, les noms des homonymes, les caractères absents de la police —,
// que t compose en une seule chaîne. Le refus de l'annonce ne fait pas de
// phrase : la section le pose par Refus, avec son remède. Le modèle ne rend
// que des clés, des détails et des données.
import { cleNormalisee } from '../../application/csv.js';
import { nomAffiche } from '../../application/personnes.js';
import { IMPOSITIONS, ORDRES, comparerPointsDeCode, papierDesBadges } from '../../application/planche.js';
import { MODELES_BADGE, PAPIERS, estModeleBadge } from '../../geometrie/papiers.js';
import { clesPapier } from '../impression/modele.js';

/** Les impositions que la section offre, la première par défaut (§ 11.6). */
export const IMPOSITIONS_OFFERTES = IMPOSITIONS;

/** Les ordres de la pile que la section offre, le premier par défaut. */
export const ORDRES_OFFERTS = ORDRES;

/** Les modèles de badge que la section offre, le défaut en tête (§ 11.2). */
export const MODELES_OFFERTS = Object.freeze(Object.keys(MODELES_BADGE));

/** La clé du libellé d'un modèle ; RangeError hors de MODELES_BADGE. */
export function cleModele(modele) {
  if (!estModeleBadge(modele)) throw new RangeError(`modèle de badge inconnu : ${JSON.stringify(modele)}`);
  return `badges.modele.${modele}`;
}

/**
 * Vrai pour un modèle qui impose son papier, et dont les cartes suivent la
 * pile : la section n'offre alors ni imposition ni papier.
 *
 * @throws {RangeError} hors de MODELES_BADGE
 */
export function modeleImposeSonPapier(modele) {
  cleModele(modele);
  return MODELES_BADGE[modele].papier !== null;
}

/**
 * Vrai quand l'annonce reçue est celle du modèle, du papier, de la case du
 * pied TechnoLibre, de celle du nom des doublons et de celle de
 * l'organisation en gros de la machine : son modèle est celui de la séance,
 * son papier celui que ce modèle prend (papierDesBadges), chaque case celle
 * de la séance. Une annonce sans modèle est celle de l'A6 ; une case que
 * l'annonce ou la machine ne porte pas vaut décochée.
 *
 * @param {import('../../application/planche_seance.js').Annonce} annonce
 * @param {{modeleBadge: string, papier: string|null, piedTechnolibre?: boolean, cacherNumero?: boolean,
 *          organisationEnGros?: boolean}} machine
 *        EtatSeance
 */
export function annonceDeLaMachine(
  annonce,
  { modeleBadge, papier, piedTechnolibre = false, cacherNumero = false, organisationEnGros = false },
) {
  const modele = annonce.modeleBadge ?? 'a6';
  return (
    modele === modeleBadge &&
    annonce.papier === papierDesBadges(modeleBadge, papier) &&
    (annonce.piedTechnolibre ?? false) === piedTechnolibre &&
    (annonce.cacherNumero ?? false) === cacherNumero &&
    (annonce.organisationEnGros ?? false) === organisationEnGros
  );
}
/** La source que désigne une demande sans source offerte : le retenu, que
 *  la séance refuse alors PLANCHE_SANS_PLACEMENT. */
const SOURCE_PAR_DEFAUT = Object.freeze({ source: 'retenu', proposition: null });

/**
 * Les sources d'une planche que la section offre (Q3) : le retenu quand la
 * charge en porte un, puis la proposition demandée au plan quand la charge
 * la porte. Une liste neuve, vide sans l'un ni l'autre.
 *
 * @param {Object} charge   la charge de l'événement ouvert
 * @param {number|null} demandee   la proposition demandée au plan (EtatUi.proposition)
 * @returns {Array<{source: 'retenu'|'proposition', proposition: number|null}>}
 */
export function sourcesOffertes(charge, demandee) {
  const offertes = [];
  if (charge.retenu !== null) offertes.push({ source: 'retenu', proposition: null });
  if (demandee !== null && charge.propositions.some(({ id }) => id === demandee)) {
    offertes.push({ source: 'proposition', proposition: demandee });
  }
  return offertes;
}

/** La clé d'une source, valeur de son option : 'retenu', ou
 *  'proposition:<id>'. */
export const cleSource = ({ source, proposition }) => (source === 'retenu' ? 'retenu' : `proposition:${proposition}`);

/**
 * La source qui vaut : l'offerte de clé choisie, sinon la première
 * offerte, sinon le retenu.
 *
 * @param {Array<{source: string, proposition: number|null}>} offertes
 * @param {string|null} choisie   la clé que l'opérateur a choisie
 */
export function sourceChoisie(offertes, choisie) {
  return offertes.find((offerte) => cleSource(offerte) === choisie) ?? offertes[0] ?? SOURCE_PAR_DEFAUT;
}

/**
 * Le libellé d'une source, pour son option : {cle, details}.
 *
 * @throws {RangeError} une source hors de 'retenu' et 'proposition'
 */
export function libelleSource({ source, proposition }) {
  if (source === 'retenu') return { cle: 'badges.source.retenu', details: {} };
  if (source === 'proposition') return { cle: 'badges.source.proposition', details: { id: proposition } };
  throw new RangeError(`source inconnue : ${JSON.stringify(source)}`);
}

/** La clé du libellé d'une imposition ; RangeError hors d'IMPOSITIONS. */
export function cleImposition(imposition) {
  if (!IMPOSITIONS.includes(imposition)) throw new RangeError(`imposition inconnue : ${JSON.stringify(imposition)}`);
  return `badges.imposition.${imposition}`;
}

/** La clé du libellé d'un ordre ; RangeError hors d'ORDRES. */
export function cleOrdre(ordre) {
  if (!ORDRES.includes(ordre)) throw new RangeError(`ordre inconnu : ${JSON.stringify(ordre)}`);
  return `badges.ordre.${ordre}`;
}

/**
 * Deux demandes ont-elles les mêmes réglages — source, proposition,
 * imposition, ordre — ? La sélection d'une réédition n'en est pas un :
 * l'annonce d'une réédition reste montrée tant que les réglages tiennent.
 */
export function memesReglages(a, b) {
  return a.source === b.source && a.proposition === b.proposition && a.imposition === b.imposition && a.ordre === b.ordre;
}

/**
 * Vrai quand l'annonce porte un refus, qui empêche toute production : celui
 * du placement ou de la mise en page. Faux sans annonce.
 *
 * @param {import('../../application/planche_seance.js').Annonce|null} annonce
 */
export function produireBloque(annonce) {
  return annonce !== null && annonce.refus !== null;
}

/**
 * Vrai quand l'annonce porte un refus du placement, qui empêche aussi la
 * liste en CSV : une annonce refusée sans modèle, donc sans comptes. Un
 * refus de la mise en page, qui ne touche pas la liste, vient avec le
 * modèle et ses comptes. Faux sans annonce.
 *
 * @param {import('../../application/planche_seance.js').Annonce|null} annonce
 */
export function listeBloquee(annonce) {
  return annonce !== null && annonce.refus !== null && annonce.comptes === null;
}

// Le point de code d'un caractère, écrit U+XXXX, quatre chiffres au moins,
// comme la feuille de contrôle l'imprime.
const pointDeCode = (caractere) => `U+${caractere.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

/**
 * Les phrases de l'annonce d'une planche (§ 11.2, § 11.5, § 11.8, décision
 * 12), dans cet ordre : la source ; les comptes de la soirée, ou celui d'une
 * réédition ; le nombre de planches sur chaque papier de PAPIERS, le papier
 * utilisé marqué — pour Avery 5392, le nombre de feuilles de cartes ; chaque
 * groupe d'homonymes ; les caractères absents de la police avec leur point de
 * code ; l'image des badges, sa case cochée, quand aucune n'est choisie,
 * qu'elle manque au dossier de l'événement ou ne se lit pas, ou le nombre de
 * badges où elle ne trouve pas de place ; les personnes dont le logo manque
 * au dossier de l'événement, puis celles dont il ne se lit pas, dans l'ordre
 * de la pile, et le nombre de badges où il ne trouve pas de place, quand il y
 * en a — des avertissements, jamais un refus ; le nombre de badges d'où le
 * pied TechnoLibre se retire, quand il y en a ; la mention BROUILLON, de la
 * source ; le nom du fichier — pour Avery 5392, ceux des cartes et de la
 * feuille de contrôle à part. Une annonce sans modèle est celle de l'A6. Sous
 * un refus du placement, seule la source se dit : comptes, planches et nom
 * manquent à l'annonce. L'annonce reçue n'est pas modifiée.
 *
 * @param {import('../../application/planche_seance.js').Annonce} annonce
 * @param {{source?: 'retenu'|'proposition', proposition?: number|null, selection?: number[]|null}} [demande]
 * @returns {Array<{cle: string, details: Object}>}
 */
export function phrasesAnnonce(annonce, { source = 'retenu', proposition = null, selection = null } = {}) {
  const { details } = libelleSource({ source, proposition });
  const phrases = [{ cle: `badges.annonce.source.${source}`, details }];
  if (annonce.comptes !== null) {
    phrases.push(
      selection === null
        ? { cle: 'badges.annonce.comptes', details: { ...annonce.comptes } }
        : { cle: 'badges.annonce.reedition', details: { n: annonce.comptes.produits } },
    );
  }
  const cartes = modeleImposeSonPapier(annonce.modeleBadge ?? 'a6');
  if (annonce.planches !== null && cartes) {
    phrases.push({ cle: 'badges.annonce.cartes', details: { planches: annonce.planches[annonce.papier] } });
  } else if (annonce.planches !== null) {
    const parPapier = Object.keys(PAPIERS).map((papier) => ({
      papier,
      nom: clesPapier(papier).nom,
      planches: annonce.planches[papier],
      choisi: papier === annonce.papier,
    }));
    phrases.push({ cle: 'badges.annonce.planches', details: { parPapier } });
  }
  for (const { nom, ids } of annonce.homonymes) phrases.push({ cle: 'badges.annonce.homonymes', details: { nom, ids: [...ids] } });
  if (annonce.absents.length > 0) {
    const caracteres = annonce.absents.map((caractere) => ({ caractere, point: pointDeCode(caractere) }));
    phrases.push({ cle: 'badges.annonce.absents', details: { caracteres } });
  }
  const image = annonce.imageBadges ?? null;
  if (image !== null) {
    if (image.chemin === null) phrases.push({ cle: 'badges.annonce.imageAucune', details: {} });
    else if (image.introuvable === 'ABSENT') phrases.push({ cle: 'badges.annonce.imageIntrouvable', details: {} });
    else if (image.introuvable === 'ILLISIBLE') phrases.push({ cle: 'badges.annonce.imageIllisible', details: {} });
    else if (image.sansPlace > 0) phrases.push({ cle: 'badges.annonce.imageSansPlace', details: { n: image.sansPlace } });
  }
  const logos = annonce.logos ?? null;
  if (logos !== null) {
    for (const [cause, cle] of [
      ['ABSENT', 'badges.annonce.logosIntrouvables'],
      ['ILLISIBLE', 'badges.annonce.logosIllisibles'],
    ]) {
      const noms = logos.introuvables.filter((introuvable) => introuvable.cause === cause).map(({ nom }) => nom);
      if (noms.length > 0) phrases.push({ cle, details: { noms } });
    }
    if (logos.sansPlace > 0) phrases.push({ cle: 'badges.annonce.logosSansPlace', details: { n: logos.sansPlace } });
  }
  if ((annonce.sansTechnolibre ?? 0) > 0) {
    phrases.push({ cle: 'badges.annonce.technolibreRetire', details: { n: annonce.sansTechnolibre } });
  }
  if (annonce.comptes !== null && annonce.brouillon) {
    phrases.push({ cle: `badges.annonce.brouillon.${source === 'proposition' ? 'proposition' : 'retenu'}`, details: {} });
  }
  if (annonce.nom !== null && cartes) {
    phrases.push({ cle: 'badges.annonce.fichiers', details: { nom: annonce.nom, nomControle: annonce.nomControle } });
  } else if (annonce.nom !== null) {
    phrases.push({ cle: 'badges.annonce.fichier', details: { nom: annonce.nom } });
  }
  return phrases;
}

// La clé de tri d'un nom affiché : sa forme normalisée (§ 10.1).
const cleDeNom = (personne) => cleNormalisee(nomAffiche(personne));

/**
 * Les personnes dont un badge peut se rééditer (§ 11.8) : les non exclues,
 * par ordre de leur nom affiché normalisé, comparé par points de code,
 * départagées par identifiant. {id, nom, organisation}, nom affiché.
 *
 * @param {Object} charge   la charge de l'événement ouvert
 * @returns {Array<{id: number, nom: string, organisation: string|null}>}
 */
export function personnesReeditables(charge) {
  return charge.participants
    .filter(({ exclu }) => !exclu)
    .map((personne) => ({ personne, cle: cleDeNom(personne) }))
    .sort((a, b) => comparerPointsDeCode(a.cle, b.cle) || a.personne.id - b.personne.id)
    .map(({ personne }) => ({ id: personne.id, nom: nomAffiche(personne), organisation: personne.organisation }));
}

/**
 * Les personnes dont le nom affiché ou l'organisation contient la saisie,
 * l'un et l'autre normalisés ; toutes pour une saisie vide ou de blancs.
 *
 * @param {Array<{id: number, nom: string, organisation: string|null}>} personnes
 * @param {string} saisie
 */
export function filtrerPersonnes(personnes, saisie) {
  const cherchee = cleNormalisee(saisie);
  if (cherchee === '') return personnes;
  return personnes.filter(
    ({ nom, organisation }) => cleNormalisee(nom).includes(cherchee) || cleNormalisee(organisation ?? '').includes(cherchee),
  );
}

/**
 * La sélection d'une réédition : les identifiants cochés qui restent
 * rééditables, dans l'ordre de la liste ; null quand il n'en reste aucun.
 *
 * @param {number[]} cochees
 * @param {Array<{id: number}>} personnes   celles de personnesReeditables
 * @returns {number[]|null}
 */
export function selectionRetenue(cochees, personnes) {
  const retenues = personnes.filter(({ id }) => cochees.includes(id)).map(({ id }) => id);
  return retenues.length === 0 ? null : retenues;
}
