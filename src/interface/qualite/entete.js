// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle de l'en-tête chiffré de la page de qualité (§ 12.2, B11, D29,
// D34, D48, D52), pur : VueEntete.svelte le câble.
//
// Une tuile par colonne de mesure du tableau des propositions, dans l'ordre
// de COLONNES et sous ses groupes (GROUPES_COLONNES) : la tuile lit sa
// mesure dans la ligne d'évaluation de la source par lireColonne, la
// cellule même que le tableau écrit, mise en forme par texteCellule. Une
// colonne que le tableau porte donne à sa tuile son libellé et son
// explication ; une colonne qu'il ne porte pas — critère décoché, valeur
// que le mode réglé ne compare pas — donne la sienne sous le libellé
// qualite.tuile.<nom>, qui dit qu'elle ne classe pas. Un critère sans objet
// n'a pas de tuile : sa mesure est absente de la ligne (null), seul cas où
// une colonne conditionnelle n'a pas de valeur.
//
// Les bornes des tuiles viennent du détail du placement (detail.bornes),
// chacune celle d'une personne nommée, que la tuile nomme : rien ne s'y
// recompte, rien ne s'y moyenne. Les tours hors objectif portent le
// plancher de la soirée (detail.objectifs) quand le diagnostic en écrit
// un — non nul, sous des planchers valides — ; les rencontres répétées et
// les retours choisis énoncent à part les imposés, lus dans la ligne
// d'évaluation et dans la table. Trois tuiles portent un pourcentage, un
// entier que le détail porte déjà, suivi du compte du pire : le minimum
// brut (la personne au rang 1 du profil), les tours hors objectif (la
// soirée), le minimum de s(p) (la personne à ce minimum). Aucune autre.
import { COLONNES, GROUPES_COLONNES, explicationDeColonne, lireColonne, tableau, texteCellule } from '../propositions/modele.js';

/** Les tuiles qui portent un pourcentage (B11, D34), dans l'ordre de
 *  COLONNES : aucune autre n'en porte. */
export const TUILES_A_POURCENTAGE = Object.freeze(['rencontresTous', 'toursHorsObjectif', 'toursSelonObjectif']);

// La clé de l'en-tête de chaque colonne, celle que le tableau écrit.
const EN_TETES = new Map(COLONNES.map(({ nom, cle }) => [nom, cle]));

/**
 * @typedef {Object} Tuile
 * @property {string} nom            le nom de sa colonne
 * @property {string} libelle        traduit : celui de la colonne, ou qualite.tuile.<nom>
 * @property {string} explication    la clé de l'explication de la colonne
 * @property {string} texte          la valeur, écrite comme au tableau
 * @property {boolean} classe        vrai quand le tableau porte la colonne
 * @property {string|null} neClassePas   la mention, null quand elle classe
 * @property {string[]} bornes       les lignes de la borne, traduites
 * @property {{texte: string|null, compte: string}|null} pourcentage
 *           le pourcentage écrit, null quand son dénominateur est nul, et
 *           le compte du pire ; null hors des trois tuiles
 */

// Les lignes de borne et le pourcentage d'une tuile, lus dans le détail.
// nommer(id) rend la ligne qui nomme la personne id ; lire(nom) la valeur
// d'une colonne de la ligne d'évaluation ; ligne et table, la ligne
// d'évaluation et la table, qui portent les imposés.
function bornesDe(nom, { detail, ligne, table, t, nommer, lire }) {
  const { bornes } = detail;
  const pourcent = (valeur) => (valeur === null ? null : t('qualite.pourcentage.valeur', { pourcent: valeur }));
  const rendu = (lignes, pourcentage = null) => ({ bornes: lignes, pourcentage });
  switch (nom) {
    case 'rencontresTous': {
      const { rang1 } = bornes;
      if (rang1 === null) return rendu([]);
      const lignes = [nommer(rang1.id), t('qualite.tuile.plafondRealise', { plafond: rang1.plafondRealise })];
      if (rang1.plafondAPriori !== null) lignes.push(t('qualite.tuile.plafondAPriori', { plafond: rang1.plafondAPriori }));
      return rendu(lignes, {
        texte: pourcent(rang1.pourcent),
        compte: t('qualite.tuile.pireRencontres', { rencontres: rang1.rencontres, plafond: rang1.plafondRealise }),
      });
    }
    case 'manqueMax': {
      const { manque } = bornes;
      if (manque === null) return rendu([]);
      const effectif = lire('effectifManque');
      return rendu([
        nommer(manque.id),
        ...(effectif === null ? [] : [t('qualite.tuile.effectifManque', { effectif })]),
        t('qualite.tuile.plafondRealise', { plafond: manque.plafondRealise }),
      ]);
    }
    case 'appartenancesVues': {
      const { diversite } = bornes;
      if (diversite === null) return rendu([t('qualite.tuile.sansAppartenance')]);
      return rendu([nommer(diversite.id), t('qualite.tuile.borneDiversite', { borne: diversite.aMax })]);
    }
    case 'toursHorsObjectif': {
      const { soiree } = bornes;
      if (soiree === null) return rendu([]);
      const plancher = detail.objectifs?.soiree.plancher ?? null;
      const ecrit = detail.collisions.planchersValides && plancher !== null && plancher > 0;
      return rendu(ecrit ? [t('qualite.tuile.plancher', { plancher })] : [], {
        texte: soiree.pourcent === null ? null : t('qualite.pourcentage.servis', { pourcent: soiree.pourcent }),
        compte: t('qualite.tuile.pireJamaisServies', { personnes: soiree.jamaisServies }),
      });
    }
    case 'toursSelonObjectif': {
      const { objectifs } = bornes;
      if (objectifs === null) return rendu([]);
      return rendu([nommer(objectifs.id), t('qualite.tuile.toursPossibles', { possibles: objectifs.possibles })], {
        texte: pourcent(objectifs.pourcent),
        compte: t('qualite.tuile.pireServis', { servis: objectifs.servis, possibles: objectifs.possibles }),
      });
    }
    case 'rencontresRepetees':
      return rendu([t('qualite.tuile.imposees', { imposees: ligne.mesures.rencontresRepetees.imposees })]);
    case 'retoursChoisis':
      return rendu([t('qualite.tuile.imposes', { imposes: table.imposes.retours })]);
    case 'animateursRencontres': {
      const { animateurs } = bornes;
      if (animateurs === null) return rendu([]);
      return rendu([nommer(animateurs.id), t('qualite.tuile.borneAnimateurs', { borne: animateurs.borne })]);
    }
    default:
      return rendu([]);
  }
}

/**
 * L'en-tête chiffré d'une source mesurée, sous le contrat de propriétés des
 * vues : null sans détail comparable, sans ligne ou sans table.
 *
 * @param {{detail: Object|null, ligne: Object|null, table: Object|null}} vue
 *        le détail du placement (detaillerQualite), sa ligne d'évaluation
 *        et la table d'évaluation de la charge
 * @param {{t: Function, format: {nombre: Function}}} outils
 * @returns {null|{population: string, groupes: Array<{cle: string,
 *   libelle: string, tuiles: Tuile[]}>, certificat: string}}
 *   population : la mention de la population mesurée ; groupes : ceux de
 *   GROUPES_COLONNES qui portent une tuile au moins, dans leur ordre ;
 *   certificat : « minimum atteint » ou « atteignabilité inconnue », qui
 *   suit les tuiles
 */
export function enteteDe({ detail, ligne, table }, { t, format }) {
  if (detail === null || detail.statut !== 'comparable' || ligne === null || table === null) return null;
  const portees = new Set(tableau(table).colonnes.map(({ nom }) => nom));
  const noms = new Map(detail.personnes.map(({ id, nom }) => [id, nom]));
  const contexte = {
    detail,
    ligne,
    table,
    t,
    nommer: (id) => t('qualite.tuile.personne', { nom: noms.get(id) }),
    lire: (nom) => lireColonne(ligne, nom).valeur,
  };
  const groupes = [];
  for (const { cle, colonnes } of GROUPES_COLONNES) {
    if (cle === null) continue;
    const deGroupe = [];
    for (const nom of colonnes) {
      const cellule = lireColonne(ligne, nom);
      const classe = portees.has(nom);
      if (!classe && cellule.valeur === null) continue;
      deGroupe.push({
        nom,
        libelle: t(classe ? EN_TETES.get(nom) : `qualite.tuile.${nom}`),
        explication: explicationDeColonne(nom),
        texte: texteCellule(cellule, { t, format }),
        classe,
        neClassePas: classe ? null : t('qualite.tuile.neClassePas'),
        ...bornesDe(nom, contexte),
      });
    }
    if (deGroupe.length > 0) groupes.push({ cle, libelle: t(cle), tuiles: deGroupe });
  }
  return {
    population: t('qualite.tuile.population', detail.population),
    groupes,
    certificat: texteCellule(lireColonne(ligne, 'certificat'), { t, format }),
  };
}
