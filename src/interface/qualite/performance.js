// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle pur de la vue « Performance du calcul » (§ 12.14, B23, D40,
// D49) : il met en mots et en séries ce que la course du détail porte
// (detaillerQualite, evaluation.js), dans l'ordre où elle le porte, sans
// rien mesurer, trier ni recompter (contrainte 41). VuePerformance.svelte
// le rend.
//
// La ligne de tête dit les mouvements évalués sur le compte d'arrêt — ou
// « rien à reprendre après … » sous le compte, ou « le plan initial n'avait
// rien à reprendre » à zéro mouvement —, puis la génération de la séance :
// durée observée, cœurs, cadence, nombre de propositions. Une durée
// inconnue — nulle, absente, d'une proposition rouverte — s'écrit « durée
// inconnue », et aucune cadence ne s'écrit sans durée, même si le détail
// en portait une : la cadence ne vaut que divisée par une durée mesurée.
//
// Les petits multiples : un graphique par valeur de la course, dans
// l'ordre de ses indicateurs — le minimum brut, puis chaque valeur que les
// critères appliqués classent —, chacun la valeur de chaque point de
// relevé, sur les mouvements de ces points ; une valeur qu'aucun point ne
// porte (null partout) n'a pas de graphique et garde sa colonne au jumeau.
// Un seul point — compte 1, ou zéro mouvement — n'a rien à relier : aucun
// graphique. Le jumeau porte une ligne par point de relevé, ses mouvements
// puis une colonne par valeur, et aucune durée : la cadence est celle de
// la génération entière, et ne date aucun point (D40).
//
// La phrase du dernier changement s'arrête aux mouvements évalués, le
// dernier point, jamais au compte d'arrêt : elle n'affirme rien des
// mouvements que la recherche n'a pas évalués (D49).
//
// Le texte passe par t et les nombres par format, ceux de la page : le
// modèle les reçoit et rend du texte prêt à poser.

// Le rendu d'un détail absent, ou d'une source qui ne se compare pas.
const RIEN = Object.freeze({
  phrases: [],
  tete: null,
  synthese: null,
  dernierChangement: null,
  abscisses: null,
  multiples: [],
  jumeau: null,
});

/**
 * La clé du nom d'une valeur de point de relevé : celle de la page pour le
 * minimum brut, moteur.valeur.<nom> pour une valeur qui classe — le nom que
 * la phrase de l'ordre du tableau des propositions lui donne.
 *
 * @param {string} nom  un nom de course.indicateurs
 * @returns {string}
 */
export function cleIndicateur(nom) {
  return nom === 'minimumBrut' ? 'qualite.performance.minimumBrut' : `moteur.valeur.${nom}`;
}

// La phrase de tête de la vue : sur le retenu, qu'elle mesure une
// proposition, laquelle, et si elle en montre la course ; sur une
// proposition sans course gardée, que sa course ne l'est pas ; null sinon.
function phraseDeSource({ id, propositionDuRetenu, course }, t) {
  if (id === 'retenu') {
    if (course !== null) return { code: 'retenu', texte: t('qualite.performance.retenu', { proposition: course.propositionDuRetenu }) };
    if (propositionDuRetenu === null) return { code: 'retenuSansCourse', texte: t('qualite.performance.retenuSansCourse') };
    return {
      code: 'retenuCourseNonGardee',
      texte: t('qualite.performance.retenuCourseNonGardee', { proposition: propositionDuRetenu }),
    };
  }
  return course === null ? { code: 'sansCourse', texte: t('qualite.performance.sansCourse') } : null;
}

// Les morceaux de la ligne de tête, chacun un texte.
function teteDe({ evalues, arret, generation }, { t, format }) {
  const nombres = { evalues: format.nombre(evalues), arret: format.nombre(arret) };
  let mouvements;
  if (evalues === 0) mouvements = t('qualite.performance.planInitial');
  else if (evalues < arret) mouvements = t('qualite.performance.rienAReprendre', nombres);
  else mouvements = t('qualite.performance.mouvements', nombres);
  const { dureeMs, coeurs, cadence, nombre } = generation;
  const connue = dureeMs !== null;
  const morceaux = [
    mouvements,
    connue ? t('qualite.performance.duree', { duree: format.duree(dureeMs) }) : t('qualite.performance.dureeInconnue'),
  ];
  if (coeurs !== null) morceaux.push(t('qualite.performance.coeurs', { coeurs }));
  if (connue && cadence !== null) morceaux.push(t('qualite.performance.cadence', { cadence: format.nombre(cadence) }));
  if (nombre !== null) morceaux.push(t('qualite.performance.propositions', { nombre }));
  return morceaux;
}

// La phrase du dernier changement : entre le dernier point où une valeur a
// changé et le dernier point, aux mouvements évalués ; au dernier point
// lui-même, qu'une valeur y a changé.
function phraseDuChangement({ dernierChangement, evalues }, { t, format }) {
  const a = format.nombre(evalues);
  if (dernierChangement === evalues) return t('qualite.performance.changeAuDernier', { a });
  return t('qualite.performance.dernierChangement', { de: format.nombre(dernierChangement), a });
}

/**
 * Ce que la vue de la performance montre du détail d'un placement.
 *
 * @param {import('../../application/evaluation.js').DetailQualite|null} detail
 * @param {{t: Function, format: {nombre: Function, duree: Function}}} ecrire
 *        la traduction et l'écriture des nombres de la page
 * @returns {{phrases: Array<{code: string, texte: string}>,
 *   tete: string[]|null, synthese: string|null,
 *   dernierChangement: string|null, abscisses: number[]|null,
 *   multiples: Array<{nom: string, graphique: string, titre: string,
 *     libelle: string, valeurs: Array<number|null>, synthese: string}>,
 *   jumeau: {nom: string, colonnes: Array<{cle: string, libelle: string,
 *     genre: 'nombre'}>, lignes: Object[]}|null}}
 *   phrases : la phrase du retenu, de la course absente ou d'un seul point,
 *   chacune sous son code ; tete : les morceaux de la ligne de tête ;
 *   abscisses : les mouvements de chaque point, null sans graphique ;
 *   multiples : un graphique par valeur, graphique son nom de désignation,
 *   titre son nom accessible, libelle le nom de sa série ; jumeau : un
 *   tableau, une ligne par point. Sans course, ni tête, ni graphique, ni
 *   jumeau.
 */
export function vuePerformance(detail, { t, format }) {
  if (detail === null || detail.statut !== 'comparable') return RIEN;
  const source = phraseDeSource(detail, t);
  const phrases = source === null ? [] : [source];
  const { course } = detail;
  if (course === null) return { ...RIEN, phrases };

  const { indicateurs, releves } = course;
  const libelles = indicateurs.map((nom) => t(cleIndicateur(nom)));
  const jumeau = {
    nom: t('qualite.performance.jumeau'),
    colonnes: [
      { cle: 'mouvements', libelle: t('qualite.performance.colonne.mouvements'), genre: 'nombre' },
      ...indicateurs.map((nom, k) => ({ cle: nom, libelle: libelles[k], genre: 'nombre' })),
    ],
    lignes: releves.map(({ mouvements, valeurs }) => ({ mouvements, ...valeurs })),
  };
  const tete = teteDe(course, { t, format });
  if (releves.length < 2) {
    if (course.evalues > 0) phrases.push({ code: 'unPoint', texte: t('qualite.performance.unPoint') });
    return { ...RIEN, phrases, tete, jumeau };
  }

  const premier = releves[0];
  const dernier = releves[releves.length - 1];
  const multiples = [];
  indicateurs.forEach((nom, k) => {
    const valeurs = releves.map((point) => point.valeurs[nom]);
    if (valeurs.every((valeur) => valeur === null)) return;
    multiples.push({
      nom,
      graphique: `performance-${nom}`,
      titre: t('qualite.performance.graphique', { indicateur: libelles[k] }),
      libelle: libelles[k],
      valeurs,
      synthese: t('qualite.performance.syntheseIndicateur', {
        indicateur: libelles[k],
        premier: format.nombre(premier.valeurs[nom]),
        dernier: format.nombre(dernier.valeurs[nom]),
      }),
    });
  });
  return {
    phrases,
    tete,
    synthese: t('qualite.performance.synthese'),
    dernierChangement: phraseDuChangement(course, { t, format }),
    abscisses: releves.map(({ mouvements }) => mouvements),
    multiples,
    jumeau,
  };
}
