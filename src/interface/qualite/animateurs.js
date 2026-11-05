// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les modèles des deux vues des animateurs (§ 12.13, B22, D37, D38), purs :
// VueAnimateurs.svelte et VueDiversite.svelte les rendent. Ils mettent en
// forme les animateurs du détail d'un placement (detaillerQualite), dans
// l'ordre où le détail les porte, sans rien trier ni recompter.
//
// Les animateurs rencontrés : une série, m(p), et la borne des animateurs
// B(p) en repère pointillé, sous ce nom. Ni manque ni pourcentage : la
// borne n'est pas toujours atteignable (§ 4.5), et rien n'en mesure la part.
//
// La diversité par animateur : le graphique dessine la soirée, une ligne
// par animateur, le moins varié en tête, dans l'ordre du détail ; les
// organisations et les étiquettes en deux colonnes juxtaposées, chacune son
// axe, jamais empilées. Une colonne seule quand le détail n'a que celle-là,
// sous le jeton de sa série ; aucune quand il n'en a ni l'une ni l'autre. Le
// jumeau porte la soirée de chaque animateur, puis une ligne par tour animé,
// dans l'ordre des tours : il détaille au-delà du graphique (§ 12.7).
//
// Sans animateur ou sans personne concernée, les deux vues cèdent la place
// à leur phrase (§ 12.6) : la diversité d'un animateur que personne ne peut
// rencontrer ne répond pas à la question de la vue.

// Les colonnes de la diversité, dans l'ordre : chacune sous le nom de son
// drapeau dans detail.animateurs.diversite.colonnes, de son compte dans une
// ligne et de son libellé, avec le genre de sa série.
const COLONNES_DIVERSITE = [
  ['organisations', 'serie1'],
  ['etiquettes', 'serie2'],
];

/**
 * Le modèle de la vue des animateurs rencontrés, ou ce qui la remplace.
 *
 * - null sans détail mesuré ;
 * - {cas: 'aucun'} sans animateur ou sans personne concernée : la vue cède
 *   la place à sa phrase ;
 * - sinon {cas: 'animateurs', escalier, infobulle, jumeau} : escalier,
 *   {nom, synthese, series, reperes} pour Escalier, une ligne par rang du
 *   profil des animateurs ; la synthèse lit le minimum et son effectif à la
 *   première ligne de la répartition, croissante ; infobulle, {colonnes,
 *   lignes}, la ligne du jumeau de chaque rang ; jumeau, le profil — nom,
 *   m(p), B(p), statut —, puis la répartition de m(p).
 *
 * @param {Object|null} detail   le détail du placement (detaillerQualite)
 * @param {(cle: string, details?: Object) => string} t
 */
export function modeleAnimateurs(detail, t) {
  if (detail === null) return null;
  const { animateurs, personnes } = detail;
  if (animateurs === null || animateurs.profil === null) return { cas: 'aucun' };
  const { profil, repartition } = animateurs;
  const nomDe = new Map(personnes.map(({ id, nom }) => [id, nom]));

  const colonnes = [
    { cle: 'nom', libelle: t('qualite.animateurs.colonne.nom'), genre: 'texte' },
    { cle: 'rencontres', libelle: t('qualite.animateurs.colonne.rencontres'), genre: 'nombre' },
    { cle: 'borne', libelle: t('qualite.animateurs.colonne.borne'), genre: 'nombre' },
    { cle: 'statut', libelle: t('qualite.animateurs.colonne.statut'), genre: 'texte' },
  ];
  const lignes = profil.map(({ id, rencontres, borne, statut }) => ({
    nom: nomDe.get(id),
    rencontres,
    borne,
    statut: t(`participants.statut.${statut}`),
  }));
  const [minimum] = repartition;

  return {
    cas: 'animateurs',
    escalier: {
      nom: t('qualite.animateurs.graphique'),
      synthese: t('qualite.animateurs.synthese', { minimum: minimum.valeur, effectif: minimum.effectif }),
      series: [{ libelle: t('qualite.animateurs.serie'), valeurs: profil.map(({ rencontres }) => rencontres) }],
      reperes: [{ genre: 'borne', libelle: t('qualite.animateurs.repere.borne'), valeurs: profil.map(({ borne }) => borne) }],
    },
    infobulle: { colonnes, lignes },
    jumeau: [
      { nom: t('qualite.animateurs.jumeau.profil'), colonnes, lignes },
      {
        nom: t('qualite.animateurs.repartition.titre'),
        colonnes: [
          { cle: 'valeur', libelle: t('qualite.animateurs.repartition.valeur'), genre: 'nombre' },
          { cle: 'effectif', libelle: t('qualite.animateurs.repartition.effectif'), genre: 'nombre' },
        ],
        lignes: repartition.map(({ valeur, effectif }) => ({ valeur, effectif })),
      },
    ],
  };
}

/**
 * Le modèle de la vue de la diversité par animateur, ou ce qui la remplace.
 *
 * - null sans détail mesuré ;
 * - {cas: 'aucun'} sans animateur ou sans personne concernée, comme la vue
 *   des animateurs rencontrés, même quand un animateur anime : la vue cède
 *   la place à sa phrase ;
 * - sinon {cas: 'diversite', phrase, equite, barres, infobulle, jumeau} :
 *   phrase, null quand les deux colonnes se dessinent, sinon le cas du
 *   § 12.6 — 'sansEtiquette', 'sansOrganisation' ou 'rien' ;
 *   equite, une entrée {genre, titre, moins, plus, auMinimum} par colonne
 *   dessinée, ses trois nombres ;
 *   barres, null sans colonne, sinon {nom, synthese, lignes, colonnes,
 *   segments} pour Barres — deux colonnes juxtaposées, ou un segment seul
 *   (colonnes null) —, une ligne {id, nom, valeurs, secondaire} par
 *   animateur, id son identifiant, valeurs la soirée, secondaire ses tours
 *   animés et ses personnes rencontrées en animant ;
 *   infobulle, null sans barres, sinon la ligne de la soirée du jumeau de
 *   chaque animateur ;
 *   jumeau, un tableau : la soirée de chaque animateur, puis chacun de ses
 *   tours animés — tours animés, personnes, et les colonnes dessinées.
 *
 * @param {Object|null} detail   le détail du placement (detaillerQualite)
 * @param {(cle: string, details?: Object) => string} t
 * @param {Array<string|null>} [nomsTours]   les noms des tours de
 *        l'événement (nomsDesTours), qui nomment la portée d'un tour
 */
export function modeleDiversite(detail, t, nomsTours = undefined) {
  if (detail === null) return null;
  const { animateurs, personnes, idsTables, numerosTables } = detail;
  if (animateurs === null || animateurs.profil === null || animateurs.diversite.lignes.length === 0) return { cas: 'aucun' };
  const { colonnes: drapeaux, lignes, equite } = animateurs.diversite;
  const nomDe = new Map(personnes.map(({ id, nom }) => [id, nom]));
  const numeroDe = new Map(idsTables.map((id, rang) => [id, numerosTables[rang]]));

  const dessinees = COLONNES_DIVERSITE.filter(([cle]) => drapeaux[cle]);
  let phrase = null;
  if (dessinees.length === 0) phrase = 'rien';
  else if (!drapeaux.etiquettes) phrase = 'sansEtiquette';
  else if (!drapeaux.organisations) phrase = 'sansOrganisation';
  const parts = dessinees.map(([cle, genre]) => ({ genre, libelle: t(`qualite.diversite.colonne.${cle}`) }));

  const colonnes = [
    { cle: 'animateur', libelle: t('qualite.diversite.colonne.animateur'), genre: 'texte' },
    { cle: 'portee', libelle: t('qualite.diversite.colonne.portee'), genre: 'texte' },
    { cle: 'toursAnimes', libelle: t('qualite.diversite.colonne.toursAnimes'), genre: 'nombre' },
    { cle: 'personnes', libelle: t('qualite.diversite.colonne.personnes'), genre: 'nombre' },
    ...dessinees.map(([cle]) => ({ cle, libelle: t(`qualite.diversite.colonne.${cle}`), genre: 'nombre' })),
  ];
  // Une ligne du jumeau : l'animateur, sa portée, et les comptes des
  // colonnes dessinées.
  const rangee = (animateur, portee, toursAnimes, comptes) => {
    const ligne = { animateur, portee, toursAnimes, personnes: comptes.personnes };
    for (const [cle] of dessinees) ligne[cle] = comptes[cle];
    return ligne;
  };
  const soirees = [];
  const rangees = [];
  for (const ligne of lignes) {
    const nom = nomDe.get(ligne.id);
    const soiree = rangee(nom, t('qualite.diversite.soiree'), ligne.toursAnimes, ligne);
    soirees.push(soiree);
    rangees.push(soiree);
    for (const tour of ligne.parTour) {
      const portee = t('qualite.diversite.tour', { tour: tour.tour + 1, table: numeroDe.get(tour.table), nomsTours });
      rangees.push(rangee(nom, portee, null, tour));
    }
  }

  const barres =
    dessinees.length === 0
      ? null
      : {
          nom: t('qualite.diversite.graphique'),
          synthese: t('qualite.diversite.synthese', equite),
          colonnes: dessinees.length === 2 ? parts : null,
          segments: dessinees.length === 2 ? null : parts,
          lignes: lignes.map((ligne) => ({
            id: ligne.id,
            nom: nomDe.get(ligne.id),
            valeurs: dessinees.map(([cle]) => ligne[cle]),
            secondaire: t('qualite.diversite.secondaire', { tours: ligne.toursAnimes, personnes: ligne.personnes }),
          })),
        };

  return {
    cas: 'diversite',
    phrase,
    equite: dessinees.map(([cle]) => ({ genre: cle, titre: t(`qualite.diversite.colonne.${cle}`), ...equite[cle] })),
    barres,
    infobulle: barres === null ? null : { colonnes, lignes: soirees },
    jumeau: [{ nom: t('qualite.diversite.jumeau'), colonnes, lignes: rangees }],
  };
}
