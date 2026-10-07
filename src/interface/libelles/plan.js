// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés du plan de salle : vue, tables, places, panneaux et listes de
// travail (§ 14.6). Chaque clé commence par « plan. ».
//
// Une ligne de la liste de noms (§ 7.6) se compose de parties, chacune son
// tspan : la tête — numéro, puis état de la place —, le nom, puis le titre
// entre ce qui le précède et ce qui le suit. Le nom et le libellé du titre
// sont des données : aucun texte de cette table ne les porte. La tête finit
// par une espace quand un nom la suit (avecNom).
import { compte } from '../../application/libelles/aides.js';

export const TABLE = new Map([
  // --- Le dessin d'une table (§ 7.5, § 7.6) ----------------------------------
  // Le nom accessible d'une table : numéro, places, conflits du tour quand
  // ils s'évaluent (conflits null sinon), puis gelée et surchargée.
  [
    'plan.table.nom',
    ({ numero, places, conflits, gelee, surchargee }) =>
      [
        `Table ${numero}`,
        compte(places, 'place', 'places'),
        ...(conflits === null ? [] : [conflits === 0 ? 'aucun conflit' : compte(conflits, 'conflit', 'conflits')]),
        ...(gelee ? ['gelée'] : []),
        ...(surchargee ? ['surchargée'] : []),
      ].join(', '),
  ],

  // --- La liste de noms (§ 7.4, § 7.6) ---------------------------------------
  ['plan.liste.gelee', 'table gelée'],
  ['plan.liste.abreviation', '\u{2026}'],
  [
    'plan.ligne.tete',
    ({ numero, etat, avecNom }, texte) =>
      `${numero}.${etat === null ? '' : ` ${texte(etat.cle, etat.details)}`}${avecNom ? ' ' : ''}`,
  ],
  ['plan.ligne.reserveeTous', '(réservée, tous les tours)'],
  ['plan.ligne.reserveeTour', ({ tour }) => `(réservée, tour ${tour})`],
  ['plan.ligne.libre', '(libre)'],
  // Une place réservée à une autre personne que l'occupant : l'état
  // s'écrit autour du nom de la titulaire, qui occupe son propre nœud,
  // entre teteReserveeA et reserveeA.
  ['plan.ligne.teteReserveeA', ({ numero }) => `${numero}. (réservée à `],
  ['plan.ligne.reserveeA', ({ portee, tour }) => (portee === 'tous' ? ', tous les tours)' : `, tour ${tour})`)],
  ['plan.ligne.avantTitrePourvu', ' \u{2014} '],
  ['plan.ligne.avantTitreNonPourvu', ' \u{2014} titre '],
  ['plan.ligne.apresTitreNonPourvu', ' non pourvu'],

  // --- Le bandeau du plan (§ 7.5) --------------------------------------------
  // L'appartenance d'un plancher de groupe est une donnée : l'écran la pose
  // dans son propre nœud, avant ce texte.
  ['plan.bandeau.toutesEnConflit', 'toutes les tables sont en conflit à ce tour'],
  [
    'plan.bandeau.collisionPartout',
    'tout placement porte une collision à chaque table : ajouter des tables ou désactiver la séparation',
  ],
  [
    'plan.bandeau.uneSeuleAppartenance',
    'une seule appartenance sous séparation active : chaque table réunit des personnes de la même appartenance',
  ],
  [
    'plan.bandeau.plancherGroupe',
    ({ effectif, plancherCumulees }) =>
      `${compte(effectif, 'personne', 'personnes')}, au moins ${compte(plancherCumulees, 'collision', 'collisions')} sur la soirée`,
  ],
  ['plan.bandeau.sansPlancher', 'le diagnostic ne prouve aucun plancher de collisions'],

  // --- L'échelle graphique et la mention (§ 7.7) -----------------------------
  ['plan.echelle.mention', "disposition relative \u{2014} l'encombrement dans la salle n'est pas vérifié"],
  ['plan.echelle.nom', 'Échelle graphique'],
  ['plan.echelle.centimetres', 'cm'],
  ['plan.echelle.metres', 'm'],
  ['plan.echelle.kilometres', 'km'],

  // --- La barre de vue (§ 7.2, § 7.7, § 8.4) ---------------------------------
  // Le numéro d'un tour, dans le sélecteur, est une donnée : son option ne
  // porte que lui.
  ['plan.vue.barre', 'Vue du plan'],
  ['plan.vue.tour', 'Tour affiché'],
  ['plan.vue.zoomer', 'Zoom +'],
  ['plan.vue.dezoomer', 'Zoom \u{2212}'],
  ['plan.vue.ajuster', 'Ajuster'],
  ['plan.vue.listes', 'Listes de noms'],
  ['plan.vue.pleinEcran', 'Plein écran'],
  ['plan.vue.dessin', 'Plan de salle'],

  // --- Les panneaux latéraux (§ 2.1, étape 8) --------------------------------
  ['plan.panneaux', 'Panneaux du plan'],
  ['plan.listesTravail.titre', 'Listes de travail'],
  ['plan.reserve.titre', 'Réserve'],
]);
