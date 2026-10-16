// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle de la vue de comparaison de la page de qualité (§ 12.6,
// § 12.7, § 12.10.6, § 12.10.7, D56 à D67, D85, C14, C17, C18, C20, C21,
// C29), pur : VueComparaison.svelte le câble.
//
// A est la source de la page ; B, la comparée ($ui.comparee) quand elle est
// parmi les candidats de A, sinon le défaut de candidatsDeComparaison : B
// n'est jamais A, ni le placement identique à A, ni un placement que la
// charge n'a plus. Sans second placement — comparaisonOfferte faux —, la
// vue écrit sa phrase. Sinon, comparerPlacements donne tout ce qui
// s'affiche, et ce module le met en forme dans l'ordre où il le porte :
// rien ne s'y trie, ne s'y compte ni ne s'y divise (contrainte 41). Une
// valeur de la comparaison se lit, ou se reconnaît à une égalité : le rang
// 1 de chaque côté, le côté qui sert mieux au rang de bascule, une valeur
// qu'aucun placement ne prend. L'effectif au manque maximal de la synthèse
// du tracé se lit dans les bornes de chaque côté, là où la cellule du
// manque maximal des colonnes et la tuile le lisent.
//
// Les cas, dans l'ordre où ils s'éprouvent : seul, un seul placement
// mesurable ; refus, la ligne de l'un des deux porte un refus de dessin, et
// la vue nomme ce placement et ses contradictions ; populations, les deux
// ne mesurent pas les mêmes personnes, et la vue nomme celles d'un seul
// côté ; phrase, les deux profils réunis prennent moins de valeurs que le
// seuil du registre, et la vue écrit, par valeur, les rangs de chaque
// placement, sans tracé ; trace, le manque des deux en escaliers
// superposés, sur l'axe commun que borne la borne haute de la comparaison.
// Sous trace, les phrases suivent : le rang 1 quand il ne désigne pas la
// même personne des deux côtés, les trois effectifs de rangs, puis la
// bascule, la dominance ou l'indiscernabilité, quand elles tiennent. Sous
// phrase, les effectifs par valeur ouvrent, puis viennent les trois
// effectifs de rangs, le rang 1 (C20), et les mêmes phrases de bascule, de
// dominance ou d'indiscernabilité. Le jumeau, l'escalier du manque, reste.
// Tout est en comptes : l'infobulle et le jumeau n'ont aucune colonne de
// pourcentage (D67, C29). Un placement se nomme par son nom — « n° 4 »,
// « placement retenu » — sur la ligne des placements, dans la liste, sur
// les courbes et dans le jumeau ; dans une phrase, par son sujet, l'article
// compris — « le placement retenu ».
import { candidatsDeComparaison, comparaisonOfferte, comparerPlacements } from '../../application/evaluation.js';
import { nomDe } from '../propositions/modele.js';

// Les colonnes de l'infobulle d'un rang, une ligne par placement, au format
// du § 12.10.3, total compris (D66) : [clé, genre].
const COLONNES_INFOBULLE = [
  ['nom', 'texte'],
  ['manque', 'nombre'],
  ['rencontres', 'nombre'],
  ['plafondRealise', 'nombre'],
  ['plafondAPriori', 'nombre'],
  ['total', 'nombre'],
];

// Le cas de la vue sous un statut de comparerPlacements qui ne trace rien.
const CAS_DU_STATUT = new Map([
  ['refusDessin', 'refus'],
  ['populationsDifferentes', 'populations'],
]);

// Le modèle sans second placement.
const SANS_COMPARAISON = {
  placements: null,
  liste: [],
  choisi: null,
  comparaison: null,
  borneHaute: null,
  graphique: null,
  series: null,
  infobulle: null,
  escalier: null,
};

// Une phrase de la vue : son code, que porte data-phrase-comparaison, son
// texte, et la liste qui la suit — {texte, nom}, nom la personne nommée
// après le texte, null sans —, null sans liste.
const phraseDe = (code, texte, liste = null) => ({ code, texte, liste });

/**
 * Le modèle de la vue de comparaison ; null quand la source n'est pas
 * mesurable — la page n'a alors aucune vue. Ne modifie rien.
 *
 * @param {Object} charge   la charge de l'état observable de la séance
 * @param {Object} table    sa table d'évaluation (evaluer)
 * @param {{source: {cas: string, id: number|'retenu'|null}|null,
 *          comparee: number|'retenu'|null}} etat
 *        source : la source de la page (sourceQualite) ; comparee : le
 *        second placement que la navigation demande, null pour le défaut
 * @param {{t: Function, format: {nombre: Function}}} outils
 * @returns {null|{cas: 'seul'|'refus'|'populations'|'phrase'|'trace',
 *   placements: null|{a: {cle, nom}, b: {cle, nom}},
 *   liste: Array<{cle, texte}>, choisi: number|'retenu'|null,
 *   comparaison: Object|null, borneHaute: number|null,
 *   graphique: null|{nom, titreX, synthese, graduer},
 *   series: null|Array<{cle, libelle, valeurs}>,
 *   infobulle: null|{colonnes, series: Array<{nom, lignes}>},
 *   escalier: null|{nom, colonnes, lignes},
 *   phrases: Array<{code, texte, liste: null|Array<{texte, nom}>}>}}
 *   placements : A et B, chacun sous sa clé et son nom ; liste : les
 *   candidats de A, dans leur ordre, chacun sous son nom et sa place au
 *   classement ; choisi : la clé de B ; comparaison : celle de
 *   comparerPlacements ; borneHaute, graphique, series, infobulle : le
 *   tracé, sous trace seulement — graduer(v) écrit une graduation de l'axe
 *   vertical, le zéro sous son libellé ; escalier : le jumeau, sous phrase
 *   et trace ; phrases : celles de la vue, dans leur ordre
 */
export function vueComparaison(charge, table, { source, comparee }, { t, format }) {
  if (source === null || source.cas !== 'mesurable') return null;
  if (!comparaisonOfferte(charge, table)) {
    return { cas: 'seul', ...SANS_COMPARAISON, phrases: [phraseDe('seul', t('qualite.comparaison.seul'))] };
  }
  const a = source.id;
  const { candidats, defaut } = candidatsDeComparaison(charge, table, a);
  const b = candidats.some(({ cle }) => cle === comparee) ? comparee : defaut;
  const comparaison = comparerPlacements(charge, table, a, b);

  const nom = (cle) =>
    cle === 'retenu' ? t('qualite.comparaison.nom.retenu') : t('qualite.comparaison.nom.proposition', { proposition: cle });
  const sujet = (cle) => (cle === 'retenu' ? t('qualite.comparaison.sujet.retenu') : nom(cle));
  const personne = (id) => nomDe(charge, id);
  const [nomA, nomB, sujetA, sujetB] = [nom(a), nom(b), sujet(a), sujet(b)];

  const base = {
    ...SANS_COMPARAISON,
    placements: { a: { cle: a, nom: nomA }, b: { cle: b, nom: nomB } },
    liste: candidats.map(({ cle, rang }) => ({
      cle,
      texte:
        rang === null
          ? t('qualite.comparaison.candidatHorsClassement', { nom: nom(cle) })
          : t('qualite.comparaison.candidat', { nom: nom(cle), rang }),
    })),
    choisi: b,
    comparaison,
  };

  if (comparaison.statut === 'refusDessin') {
    const { cote, violations } = comparaison.refusDessin;
    const liste = violations.map((violation) => ({ texte: t(violation.code, violation), nom: personne(violation.participant) }));
    return {
      ...base,
      cas: CAS_DU_STATUT.get(comparaison.statut),
      phrases: [phraseDe('refus', t('qualite.comparaison.refus', { nom: cote === 'a' ? sujetA : sujetB }), liste)],
    };
  }
  if (comparaison.statut === 'populationsDifferentes') {
    const { seulementA, seulementB } = comparaison.populations;
    const nommees = (ids) => ids.map((id) => ({ texte: personne(id) ?? t('qualite.comparaison.personneInconnue', { id }), nom: null }));
    return {
      ...base,
      cas: CAS_DU_STATUT.get(comparaison.statut),
      phrases: [
        phraseDe('populations', t('qualite.comparaison.populations', { a: sujetA, b: sujetB })),
        phraseDe('populations', t('qualite.comparaison.populationsSeulement', { nom: sujetA }), nommees(seulementA)),
        phraseDe('populations', t('qualite.comparaison.populationsSeulement', { nom: sujetB }), nommees(seulementB)),
      ],
    };
  }

  const { profils, rangs, escalier, indiscernables } = comparaison;
  const [premierA] = profils.a;
  const [premierB] = profils.b;

  // Le rang 1, quand il ne désigne pas la même personne des deux côtés ;
  // les trois effectifs de rangs.
  const rang1 =
    premierA.id === premierB.id
      ? []
      : [
          phraseDe(
            'rang1',
            t('qualite.comparaison.rang1Different', { a: sujetA, nomA: personne(premierA.id), b: sujetB, nomB: personne(premierB.id) }),
          ),
        ];
  const effectifs = phraseDe(
    'effectifs',
    t('qualite.comparaison.effectifs', { a: sujetA, rangsA: rangs.a, b: sujetB, rangsB: rangs.b, egalite: rangs.egalite }),
  );
  const phrases = [];
  if (comparaison.trace) phrases.push(...rang1, effectifs);
  else {
    const prises = escalier.filter((ligne) => ligne.a.effectif !== 0 || ligne.b.effectif !== 0);
    phrases.push(
      phraseDe(
        'peuDeValeurs',
        t('qualite.comparaison.peuDeValeurs.phrase'),
        prises.map((ligne) => ({
          texte: t('qualite.comparaison.peuDeValeurs.valeur', {
            valeur: ligne.valeur,
            a: sujetA,
            effectifA: ligne.a.effectif,
            b: sujetB,
            effectifB: ligne.b.effectif,
          }),
          nom: null,
        })),
      ),
      effectifs,
      ...rang1,
    );
  }
  if (rangs.bascule !== null) {
    // Au rang de bascule, le côté au plus petit manque commence à servir
    // mieux.
    const aGagne = profils.a[rangs.bascule - 1].manque < profils.b[rangs.bascule - 1].manque;
    phrases.push(
      phraseDe(
        'bascule',
        t('qualite.comparaison.bascule', { rang: rangs.bascule, gagne: aGagne ? sujetA : sujetB, perd: aGagne ? sujetB : sujetA }),
      ),
    );
  }
  if (rangs.domine !== null) {
    const dominant = rangs.domine === 'a' ? a : b;
    phrases.push(
      phraseDe(
        'domine',
        dominant === 'retenu' ? t('qualite.comparaison.dominePlacementRetenu') : t('qualite.comparaison.domine', { proposition: dominant }),
      ),
    );
  }
  if (indiscernables !== null) {
    let texte = t('qualite.comparaison.indiscernables.retenu');
    if (!indiscernables.retenu) {
      texte =
        indiscernables.palier === null
          ? t('qualite.comparaison.indiscernables.identifiant')
          : t('qualite.comparaison.indiscernables.palier', indiscernables.palier);
    }
    phrases.push(phraseDe('indiscernables', texte));
  }

  const jumeau = {
    nom: t('qualite.comparaison.escalier.titre'),
    colonnes: [
      { cle: 'valeur', libelle: t('qualite.comparaison.escalier.valeur'), genre: 'nombre' },
      { cle: 'effectifA', libelle: t('qualite.comparaison.escalier.effectif', { nom: nomA }), genre: 'nombre' },
      { cle: 'cumulA', libelle: t('qualite.comparaison.escalier.cumul', { nom: nomA }), genre: 'nombre' },
      { cle: 'effectifB', libelle: t('qualite.comparaison.escalier.effectif', { nom: nomB }), genre: 'nombre' },
      { cle: 'cumulB', libelle: t('qualite.comparaison.escalier.cumul', { nom: nomB }), genre: 'nombre' },
    ],
    lignes: escalier.map((ligne) => ({
      valeur: ligne.valeur,
      effectifA: ligne.a.effectif,
      cumulA: ligne.a.cumul,
      effectifB: ligne.b.effectif,
      cumulB: ligne.b.cumul,
    })),
  };
  if (!comparaison.trace) return { ...base, cas: 'phrase', escalier: jumeau, phrases };

  const lignesInfobulle = (profil) =>
    profil.map(({ id, manque, rencontres, plafondRealise, plafondAPriori }) => ({
      nom: personne(id),
      manque,
      rencontres,
      plafondRealise,
      plafondAPriori,
      total: comparaison.total,
    }));
  return {
    ...base,
    cas: 'trace',
    borneHaute: comparaison.borneHaute,
    graphique: {
      nom: t('qualite.comparaison.graphique'),
      titreX: t('qualite.comparaison.axe'),
      synthese: t('qualite.comparaison.synthese', {
        a: sujetA,
        manqueA: premierA.manque,
        effectifA: comparaison.a.bornes.manque.effectif,
        b: sujetB,
        manqueB: premierB.manque,
        effectifB: comparaison.b.bornes.manque.effectif,
      }),
      graduer: (valeur) => (valeur === 0 ? t('qualite.comparaison.zero') : format.nombre(valeur)),
    },
    series: [
      { cle: 'a', libelle: nomA, valeurs: profils.a.map(({ manque }) => manque) },
      { cle: 'b', libelle: nomB, valeurs: profils.b.map(({ manque }) => manque) },
    ],
    infobulle: {
      colonnes: COLONNES_INFOBULLE.map(([cle, genre]) => ({ cle, libelle: t(`qualite.comparaison.colonne.${cle}`), genre })),
      series: [
        { nom: nomA, lignes: lignesInfobulle(profils.a) },
        { nom: nomB, lignes: lignesInfobulle(profils.b) },
      ],
    },
    escalier: jumeau,
    phrases,
  };
}
