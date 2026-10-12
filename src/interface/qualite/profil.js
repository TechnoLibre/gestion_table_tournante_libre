// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle du profil trié des rencontres de la page de qualité (§ 12.3,
// B12, B15, D28, D30, D34, D41, D51), pur : VueProfil.svelte le câble.
//
// Le profil se dessine en deux graphiques empilés, au même ordre de rangs,
// celui que le détail rend (detail.profil, D28) : rien ne s'y trie ni ne
// s'y recompte. Le premier, en comptes de personnes : les rencontres, puis
// les appartenances rencontrées, et deux repères, le plafond réalisé et la
// borne de diversité. Le second, en pourcentages : le pourcentage de chaque
// rang, l'entier que le détail porte, null — sans point — à plafond réalisé
// nul, et la règle à 100 %, l'image du plafond réalisé. Chaque rang marqué
// porte son signe dans les deux graphiques : au second, celui d'un rang
// sans point se pose au pied de l'axe. Une appartenance au plus : une
// seule série, sans borne de diversité tracée, et la phrase du cas (B15) ;
// une seule table : la phrase seule, pour les deux graphiques.
//
// L'infobulle des deux graphiques et la première table du jumeau portent la
// même ligne entière par rang, le pourcentage suivi du compte de la ligne
// (« 24 sur 27 ») ; la seconde table, la répartition des rencontres.

/** Les graduations de l'axe du second graphique : une valeur, écrite par
 *  format.nombre, suivie du signe sous la clé de l'axe (contrainte 44). */
export const graduerPourcent =
  ({ t, format }) =>
  (valeur) =>
    t('qualite.pourcentage.axe', { valeur: format.nombre(valeur) });

// Les colonnes de la ligne d'un rang, dans l'ordre de l'infobulle et du
// jumeau : [clé, genre] ; les deux colonnes des appartenances s'écrivent
// dès qu'une appartenance est portée (B5), même quand le premier graphique
// ne les trace pas ; sans appartenance, elles valent 0 partout et tombent.
const COLONNES_LIGNE = [
  ['rang', 'nombre'],
  ['nom', 'texte'],
  ['appartenance', 'texte'],
  ['rencontres', 'nombre'],
  ['plafondRealise', 'nombre'],
  ['pourcent', 'pourcentage'],
  ['plafondAPriori', 'nombre'],
  ['appartenances', 'nombre'],
  ['borneDiversite', 'nombre'],
  ['toursNonAssis', 'nombre'],
  ['marque', 'texte'],
];
const DES_APPARTENANCES = new Set(['appartenances', 'borneDiversite']);

// Les colonnes de la répartition des rencontres : la valeur, l'effectif,
// l'effectif cumulé, les personnes à leur plafond réalisé.
const COLONNES_REPARTITION = ['valeur', 'effectif', 'cumul', 'auPlafond'];

/**
 * Le profil d'une source mesurée : null sans détail comparable ou sans
 * personne mesurée — aucun axe vide ne se dessine ; une seule
 * table, {cas: 'uneTable', phrase: 'uneTable'} ; sinon les deux graphiques.
 *
 * @param {Object|null} detail   le détail du placement (detaillerQualite)
 * @param {{t: Function, format: {nombre: Function}}} outils
 * @returns {null|{cas: 'uneTable', phrase: 'uneTable'}|{cas: 'profil',
 *   phrase: null|'uneAppartenance'|'aucuneAppartenance',
 *   comptes: {nom, series, reperes, marques, synthese},
 *   pourcentages: {nom, series, reperes, marques,
 *     synthese: {texte, pourcentage: null|{texte, compte}}},
 *   infobulle: {colonnes, lignes}, tableaux: Array<{nom, colonnes, lignes}>}}
 *   phrase : le code du cas limite, sa phrase sous qualite.profil.<code> ;
 *   series et reperes : ceux d'Escalier, libellés traduits, une valeur par
 *   rang ; marques : la marque de chaque rang, null sans, la même dans
 *   les deux graphiques ; synthese : la phrase du premier graphique, et
 *   celle du second, la personne au rang 1 puis son pourcentage et le
 *   compte du pire — à plafond réalisé nul, une phrase entière qui le dit,
 *   et pourcentage null ; infobulle : les colonnes et une ligne par rang ;
 *   tableaux : les tables du jumeau
 */
export function profilDe(detail, { t }) {
  if (detail === null || detail.statut !== 'comparable' || detail.profil.length === 0) return null;
  if (detail.idsTables.length === 1) return { cas: 'uneTable', phrase: 'uneTable' };
  const { profil, bornes } = detail;
  const personnes = new Map(detail.personnes.map((personne) => [personne.id, personne]));
  const avecAppartenances = detail.G > 1;
  const colonnesAppartenances = detail.G > 0;
  let phrase = null;
  if (detail.G === 1) phrase = 'uneAppartenance';
  else if (detail.G === 0) phrase = 'aucuneAppartenance';
  const pourcent = (valeur) => (valeur === null ? null : t('qualite.pourcentage.valeur', { pourcent: valeur }));
  const valeursDe = (champ) => profil.map((rang) => rang[champ]);
  const rencontres = { libelle: t('qualite.profil.serie.rencontres'), valeurs: valeursDe('rencontres') };

  const colonnes = COLONNES_LIGNE.filter(([cle]) => colonnesAppartenances || !DES_APPARTENANCES.has(cle)).map(([cle, genre]) => ({
    cle,
    libelle: t(`qualite.profil.colonne.${cle}`),
    genre,
  }));
  const lignes = profil.map((rang, indice) => {
    const personne = personnes.get(rang.id);
    const ligne = {
      rang: indice + 1,
      nom: personne.nom,
      appartenance: personne.appartenance,
      rencontres: rang.rencontres,
      plafondRealise: rang.plafondRealise,
      pourcent: {
        texte: pourcent(rang.pourcent),
        compte: t('qualite.profil.ligne', { rencontres: rang.rencontres, plafond: rang.plafondRealise }),
      },
      plafondAPriori: rang.plafondAPriori,
      toursNonAssis: rang.toursNonAssis,
      marque: rang.marque === null ? null : t(`qualite.profil.marque.${rang.marque}`),
    };
    if (colonnesAppartenances) {
      ligne.appartenances = rang.appartenances;
      ligne.borneDiversite = rang.borneDiversite;
    }
    return ligne;
  });
  const infobulle = { colonnes, lignes };

  const { rang1 } = bornes;
  const nomRang1 = personnes.get(rang1.id).nom;
  const marques = valeursDe('marque');
  return {
    cas: 'profil',
    phrase,
    comptes: {
      nom: t('qualite.profil.graphique.comptes'),
      series: avecAppartenances
        ? [rencontres, { libelle: t('qualite.profil.serie.appartenances'), valeurs: valeursDe('appartenances') }]
        : [rencontres],
      reperes: [
        { genre: 'plafond', libelle: t('qualite.profil.repere.plafond'), valeurs: valeursDe('plafondRealise') },
        ...(avecAppartenances ? [{ genre: 'borne', libelle: t('qualite.profil.repere.borne'), valeurs: valeursDe('borneDiversite') }] : []),
      ],
      marques,
      synthese: t('qualite.profil.synthese', detail.synthese),
    },
    pourcentages: {
      nom: t('qualite.profil.graphique.pourcentages'),
      series: [{ libelle: t('qualite.profil.serie.rencontres'), valeurs: valeursDe('pourcent') }],
      reperes: [{ genre: 'cent', libelle: t('qualite.pourcentage.cent'), valeurs: profil.map(() => 100) }],
      marques,
      synthese:
        rang1.pourcent === null
          ? { texte: t('qualite.profil.plafondNul', { nom: nomRang1 }), pourcentage: null }
          : {
              texte: t('qualite.profil.synthesePourcentage', { nom: nomRang1 }),
              pourcentage: {
                texte: pourcent(rang1.pourcent),
                compte: t('qualite.profil.pire', { rencontres: rang1.rencontres, plafond: rang1.plafondRealise }),
              },
            },
    },
    infobulle,
    tableaux: [
      { nom: t('qualite.vue.profil.titre'), colonnes, lignes },
      {
        nom: t('qualite.profil.repartition.titre'),
        colonnes: COLONNES_REPARTITION.map((cle) => ({ cle, libelle: t(`qualite.profil.repartition.${cle}`), genre: 'nombre' })),
        lignes: detail.repartitionRencontres,
      },
    ],
  };
}
