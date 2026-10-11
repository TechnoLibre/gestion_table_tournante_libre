// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés de la liste des participants : en-tête, grille, formulaire,
// fiche (§ 14.6). Chaque clé commence par « participants. ».
//
// participants.entete.comptes compose la ligne de comptes de la carte
// (comptesEntete, entete.js), ses parties séparées d'un point médian ;
// participants.legende.* nomme la légende des appartenances et chacune de
// ses pastilles, le nom puis le compte.
//
// participants.colonne.* nomme chaque colonne de COLONNES (grille.js), dans
// l'en-tête de la grille, l'étiquette d'un champ du formulaire et celle
// d'une valeur de la fiche ; participants.statut.* nomme chaque statut
// calculé (§ 4.2), par cleDeStatut ; participants.groupe.* porte le
// groupement de la liste : le sélecteur de chaque niveau, l'en-tête d'un
// groupe et ses commandes ; participants.conflit.* les conflits du
// placement montré dans la liste groupée : la marque d'un groupe et celle
// d'une personne, puis chaque ligne de conflit — son lieu, la liaison de
// deux noms, sa raison par règle.

// Un nombre suivi de son nom, au singulier pour 0 et 1.
const compte = (n, singulier, pluriel) => `${n} ${n <= 1 ? singulier : pluriel}`;

// La portée d'une réservation : tous les tours, ou le tour désigné.
const portee = ({ portee: genre, tour }) => (genre === 'tous' ? 'tous les tours' : `tour ${tour}`);

// Les tours antérieurs d'une personne revenue, entre parenthèses : « (déjà
// au tour 1) », « (déjà aux tours 1 et 2) », « (déjà aux tours 1, 2 et
// 3) » ; rien sans tour.
function dejaAux(tours) {
  if (tours.length === 0) return '';
  if (tours.length === 1) return ` (déjà au tour ${tours[0]})`;
  return ` (déjà aux tours ${tours.slice(0, -1).join(', ')} et ${tours.at(-1)})`;
}

// Les rencontres antérieures d'une paire revue, entre parenthèses : « (déjà
// à la table 1 au tour 1, à la table 2 au tour 3) » ; rien sans rencontre.
const dejaReunis = (deja) =>
  deja.length === 0 ? '' : ` (déjà ${deja.map(({ tour, numero }) => `à la table ${numero} au tour ${tour}`).join(', ')})`;

// Le texte court de chaque règle dans la marque d'une personne en conflit.
const REGLES_COURTES = new Map([
  ['separerAppartenances', 'même appartenance'],
  ['nouveauxVoisins', 'se revoient'],
  ['nouvelleTable', 'revient à une table'],
]);

export const TABLE = new Map([
  // --- Les colonnes, que la grille, le formulaire et la fiche partagent ------
  ['participants.colonne.nom', 'Nom'],
  ['participants.colonne.prenom', 'Prénom'],
  ['participants.colonne.appartenance', 'Appartenance'],
  ['participants.colonne.courriel', 'Courriel'],
  ['participants.colonne.titrePressenti', 'Titre pressenti'],
  ['participants.colonne.exclu', 'Exclusion'],
  ['participants.colonne.notes', 'Notes'],

  // --- L'en-tête de la carte : la ligne de comptes et la légende -----------
  [
    'participants.entete.comptes',
    ({ personnes, aPlacer, exclues, appartenances }) =>
      [
        compte(personnes, 'personne', 'personnes'),
        `${aPlacer} à placer`,
        compte(exclues, 'exclue', 'exclues'),
        compte(appartenances, 'appartenance', 'appartenances'),
      ].join(' \u{00B7} '),
  ],
  ['participants.legende.titre', 'Appartenances'],
  ['participants.legende.element', ({ nom, compte: n }) => `${nom} \u{00B7} ${n}`],

  // --- Le formulaire d'ajout (§ 10.2) ---------------------------------------
  ['participants.formulaire.titre', 'Ajouter une personne'],
  ['participants.formulaire.ajouter', 'Ajouter'],
  ['participants.formulaire.orthographe', 'Cette appartenance existe déjà sous l\u{2019}orthographe'],
  ['participants.formulaire.reprendre', 'Reprendre cette orthographe'],

  // --- La grille (§ 10.2) ---------------------------------------------------
  ['participants.grille.titre', 'Liste des participants'],
  ['participants.grille.filtre', 'Filtrer'],
  [
    'participants.grille.compte',
    ({ total, affiches }) =>
      affiches === total ? compte(total, 'participant', 'participants') : `${affiches} sur ${compte(total, 'participant', 'participants')}`,
  ],
  ['participants.grille.croissant', '(croissant)'],
  ['participants.grille.decroissant', '(décroissant)'],
  ['participants.grille.actions', 'Actions'],
  ['participants.grille.exclue', 'exclue'],
  ['participants.grille.presente', 'présente'],
  ['participants.grille.vide', 'Aucun participant. Ajoutez une personne, ou collez une liste dans la grille.'],
  ['participants.grille.aucunResultat', 'Aucune personne ne correspond au filtre.'],

  // --- La liste groupée par une colonne ou plusieurs ------------------------
  ['participants.groupe.grouperPar', 'Grouper par'],
  ['participants.groupe.puisPar', ({ niveau }) => `Puis par (niveau ${niveau})`],
  ['participants.groupe.aucun', 'Aucun groupement'],
  ['participants.groupe.aucunSousGroupe', 'Aucun sous-groupe'],
  ['participants.groupe.statut', 'Statut'],
  ['participants.groupe.vide', '(vide)'],
  ['participants.groupe.statutInconnu', 'statut non calculé'],
  ['participants.groupe.compte', ({ compte: n }) => compte(n, 'personne', 'personnes')],
  ['participants.groupe.replier', 'Replier'],
  ['participants.groupe.deplier', 'Déplier'],
  ['participants.groupe.toutReplier', 'Tout replier'],
  ['participants.groupe.toutDeplier', 'Tout déplier'],

  // --- Les conflits du placement montré, dans la liste groupée (§ 7.5) -----
  ['participants.conflit.groupe', ({ nombre }) => `en conflit : ${compte(nombre, 'conflit', 'conflits')}`],
  ['participants.conflit.personne', ({ regles }) => `en conflit : ${regles.map((regle) => REGLES_COURTES.get(regle)).join(', ')}`],
  ['participants.conflit.lieu', ({ tour, numero }) => `Tour ${tour}, table ${numero} :`],
  ['participants.conflit.et', 'et'],
  ['participants.conflit.raison.separerAppartenances', '\u{2014} même appartenance'],
  [
    'participants.conflit.raison.nouveauxVoisins',
    ({ deja }) => `\u{2014} se revoient${dejaReunis(deja)}`,
  ],
  [
    'participants.conflit.raison.nouvelleTable',
    ({ numero, deja }) => `\u{2014} revient à la table ${numero}${dejaAux(deja.map(({ tour }) => tour))}`,
  ],

  // --- Les commandes de la section ------------------------------------------
  ['participants.commande.fiche', 'Fiche'],
  ['participants.commande.exclure', 'Exclure'],
  ['participants.commande.reintegrer', 'Réintégrer'],
  ['participants.commande.supprimer', 'Supprimer'],
  ['participants.commande.exporter', 'Exporter la liste'],
  ['participants.commande.fermerFiche', 'Fermer la fiche'],

  // --- La suppression d'une personne qui porte des réservations (§ 2.1) -----
  ['participants.suppression.titre', ({ personne }) => `Supprimer ${personne} et ses réservations ?`],
  [
    'participants.suppression.reservation',
    (details) =>
      `Réservation à la table ${details.numero}${details.siege === null ? '' : `, siège ${details.siege}`}, ${portee(details)}`,
  ],

  // --- La fiche (§ 4, § 4.2, § 7.4) -----------------------------------------
  ['participants.fiche.titre', 'Fiche de la personne'],
  ['participants.fiche.vide', '\u{2014}'],
  ['participants.fiche.statut', 'Statut'],
  ['participants.fiche.statutExclue', 'exclue : ni placée, ni comptée'],
  ['participants.fiche.statutInconnu', 'non calculé : la configuration est incohérente'],
  ['participants.fiche.reservations', 'Réservations'],
  ['participants.fiche.aucuneReservation', 'Aucune réservation.'],
  ['participants.fiche.suspendues', 'Suspendues tant que la personne est exclue.'],
  ['participants.fiche.table', 'Table'],
  ['participants.fiche.siege', 'Siège'],
  ['participants.fiche.portee', 'Portée'],
  ['participants.fiche.sansSiege', 'sans siège'],
  ['participants.fiche.tousLesTours', 'tous les tours'],
  ['participants.fiche.auTour', 'tour'],
  ['participants.fiche.itineraire', 'Placement retenu, tour par tour'],
  ['participants.fiche.tour', 'Tour'],
  ['participants.fiche.enReserve', 'en réserve'],
  ['participants.fiche.horsRetenu', 'hors du placement retenu'],
  ['participants.fiche.siegeNonAttribue', 'non attribué'],
  ['participants.fiche.aucunRetenu', 'Aucun placement retenu ne la nomme.'],

  // --- Les statuts calculés (§ 4.2) -----------------------------------------
  ['participants.statut.ancre', 'ancré'],
  ['participants.statut.partiel', 'partiellement fixé'],
  ['participants.statut.mobile', 'mobile'],
]);
