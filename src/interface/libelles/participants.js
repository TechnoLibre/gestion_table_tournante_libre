// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les libellés de la liste des participants : en-tête, grille, formulaire,
// fiche (§ 14.6). Chaque clé commence par « participants. ».
//
// participants.entete.comptes compose la ligne de comptes de la carte
// (comptesEntete, entete.js), ses parties séparées d'un point médian, les
// présences partielles en dernier, seulement quand il y en a ;
// participants.legende.* nomme la légende des organisations et chacune de
// ses pastilles, le nom puis le compte ; participants.legendeEtiquettes.titre
// nomme la légende des étiquettes, dont chaque pastille se compose comme
// celle d'une organisation. participants.etiquettes.* porte la saisie des
// étiquettes sur la fiche : son champ, son ajout, et le retrait nommé par
// l'étiquette qu'il ôte.
//
// participants.colonne.* nomme chaque colonne de COLONNES (grille.js), dans
// l'en-tête de la grille, l'étiquette d'un champ du formulaire et celle
// d'une valeur de la fiche ; participants.statut.* nomme chaque statut
// calculé (§ 4.2), par cleDeStatut ; participants.groupe.* porte le
// groupement de la liste : le sélecteur de chaque niveau, l'en-tête d'un
// groupe et ses commandes ; participants.conflit.* les conflits du
// placement montré dans la liste groupée : la marque d'un groupe et celle
// d'une personne, puis chaque ligne de conflit — son lieu, la liaison de
// deux noms, sa raison par règle. participants.presence.* porte la présence
// par tour (participants/presence.js) : la cellule et l'en-tête de groupe
// — « tous », ou les tours nommés par toursNommes —, puis les cases d'une
// saisie, leur groupe et ses commandes ; participants.fiche.presence* la
// rubrique de la fiche, et participants.fiche.absente l'étape d'un tour
// d'absence dans l'itinéraire. participants.conflits.* porte la saisie des
// conflits d'organisation (participants/liste_conflits.js) : le groupe de
// ses cases, sa légende, le groupe sans choix et sa commande ;
// participants.fiche.conflits* la rubrique de la fiche.
// participants.fiche.logo et participants.fiche.aucunLogo portent la
// rubrique « Logo » de la fiche ; participants.logo.* ses commandes —
// « Logo », nommée par la personne, « Retirer le logo » —, sa vignette, qui
// agrandit, l'image agrandie, nommée par la personne, son « Fermer », et la
// phrase d'un logo dont l'image manque au dossier de l'événement ou ne se
// lit pas.
// participants.informations.* porte le bloc des informations de la fiche
// (InformationsFiche.svelte) : « Modifier », nommée par la personne, le
// formulaire, nommé de même, « Enregistrer », « Annuler », et l'avis de ce
// que les listes de conflits ont suivi (suiviDesConflits, informations.js),
// ses parties séparées d'un point-virgule.

import { cite, enumeration, toursNommes } from '../../application/libelles/aides.js';

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
  ['conflitsOrganisation', "conflit d'organisation"],
  ['separerOrganisations', 'même organisation'],
  ['nouveauxVoisins', 'se revoient'],
  ['nouvelleTable', 'revient à une table'],
]);

export const TABLE = new Map([
  // --- Les colonnes, que la grille, le formulaire et la fiche partagent ------
  ['participants.colonne.nom', 'Nom'],
  ['participants.colonne.prenom', 'Prénom'],
  ['participants.colonne.organisation', 'Organisation'],
  ['participants.colonne.conflits', "Conflit d'organisation"],
  ['participants.colonne.courriel', 'Courriel'],
  ['participants.colonne.titrePressenti', 'Titre pressenti'],
  ['participants.colonne.exclu', 'Exclusion'],
  ['participants.colonne.presence', 'Présence'],
  ['participants.colonne.notes', 'Notes'],

  // --- L'en-tête de la carte : la ligne de comptes et la légende -----------
  [
    'participants.entete.comptes',
    ({ personnes, aPlacer, exclues, organisations, partielles }) =>
      [
        compte(personnes, 'personne', 'personnes'),
        `${aPlacer} à placer`,
        compte(exclues, 'exclue', 'exclues'),
        compte(organisations, 'organisation', 'organisations'),
        ...(partielles > 0 ? [compte(partielles, 'présence partielle', 'présences partielles')] : []),
      ].join(' \u{00B7} '),
  ],
  ['participants.legende.titre', 'Organisations'],
  ['participants.legende.element', ({ nom, compte: n }) => `${nom} \u{00B7} ${n}`],
  ['participants.legendeEtiquettes.titre', 'Étiquettes'],

  // --- Le formulaire d'ajout (§ 10.2) ---------------------------------------
  ['participants.formulaire.titre', 'Ajouter une personne'],
  ['participants.formulaire.ajouter', 'Ajouter'],
  ['participants.formulaire.orthographe', 'Cette organisation existe déjà sous l\u{2019}orthographe'],
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

  // --- La présence par tour : cellule, groupe, cases d'une saisie ----------
  ['participants.presence.tous', 'tous'],
  ['participants.presence.tours', ({ tours }) => toursNommes(tours)],
  ['participants.presence.editeur', ({ nom }) => `Présence de ${nom}, une case par tour`],
  ['participants.presence.case', ({ tour }) => `Tour ${tour}`],
  ['participants.presence.caseCourte', ({ tour }) => String(tour)],
  ['participants.presence.tousLesTours', 'Tous les tours'],
  ['participants.presence.appliquer', 'Appliquer'],

  // --- Les conflits d'organisation : le choix multiple d'une saisie --------
  ['participants.conflits.editeur', ({ nom }) => `Conflits d'organisation de ${nom}, une case par organisation`],
  ['participants.conflits.legende', 'Organisations à éviter'],
  ['participants.conflits.aucuneAutre', "Aucune autre organisation dans l'événement."],
  ['participants.conflits.appliquer', 'Appliquer'],

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
  ['participants.conflit.raison.conflitsOrganisation', "\u{2014} conflit d'organisation"],
  ['participants.conflit.raison.separerOrganisations', '\u{2014} même organisation'],
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
  ['participants.fiche.etiquettes', 'Étiquettes'],
  ['participants.fiche.aucuneEtiquette', 'Aucune étiquette.'],
  ['participants.fiche.presence', 'Présence'],
  ['participants.fiche.presenceLegende', 'Présente aux tours'],
  ['participants.fiche.conflits', "Conflits d'organisation"],
  ['participants.fiche.aucunConflit', "Aucun conflit d'organisation."],
  ['participants.fiche.absente', 'absente'],
  ['participants.fiche.logo', 'Logo'],
  ['participants.fiche.aucunLogo', 'Aucun logo.'],

  // --- Les informations de la fiche et leur formulaire (§ 10.2) ------------
  ['participants.informations.modifier', 'Modifier'],
  ['participants.informations.modifierNomme', ({ nom }) => `Modifier les informations de ${nom}`],
  ['participants.informations.formulaire', ({ nom }) => `Informations de ${nom}`],
  ['participants.informations.enregistrer', 'Enregistrer'],
  ['participants.informations.annuler', 'Annuler'],
  [
    'participants.informations.conflitsSuivis',
    ({ renommee, retirees, propres }) => {
      const parties = [];
      if (renommee !== null) parties.push(`${cite(renommee.de)} devient ${cite(renommee.vers)}`);
      if (retirees.length > 0) parties.push(`${enumeration(retirees.map(cite))} ${retirees.length === 1 ? 'les quitte' : 'les quittent'}`);
      if (propres > 0) {
        parties.push(compte(propres, 'conflit avec sa propre organisation retiré', 'conflits avec leur propre organisation retirés'));
      }
      return `Les conflits d'organisation suivent ce changement : ${parties.join(' ; ')}.`;
    },
  ],

  // --- Le logo de la fiche (§ 8.9, § 10.2) ----------------------------------
  ['participants.logo.choisir', 'Logo'],
  ['participants.logo.choisirNomme', ({ nom }) => `Logo de ${nom} : choisir une image`],
  ['participants.logo.retirer', 'Retirer le logo'],
  ['participants.logo.agrandir', ({ nom }) => `Agrandir le logo de ${nom}`],
  ['participants.logo.image', ({ nom }) => `Logo de ${nom}`],
  ['participants.logo.fermer', 'Fermer'],
  ['participants.logo.introuvable', 'Logo introuvable : son image manque au dossier de l\u{2019}événement ou ne se lit pas.'],

  // --- La rubrique « Rencontres » de la fiche (§ 12.5, D33) -----------------
  // La ligne de la personne dans le placement que le plan montre, celui que
  // la page de qualité mesure, nommé sur la ligne de source.
  ['participants.fiche.rencontres.titre', 'Rencontres'],
  ['participants.fiche.rencontres.intitule', 'Placement mesuré :'],
  ['participants.fiche.rencontres.retenu', 'Placement retenu'],
  ['participants.fiche.rencontres.proposition', ({ proposition }) => `Proposition n° ${proposition}`],
  ['participants.fiche.rencontres.personne', 'Personne rencontrée'],
  ['participants.fiche.rencontres.fois', 'Fois'],
  ['participants.fiche.rencontres.tours', 'Tours'],
  ['participants.fiche.rencontres.tour', ({ tour, table }) => `tour ${tour}, table ${table}`],
  // Les tours d'une rencontre, [{tour, table}] dans l'ordre reçu, chacun
  // par participants.fiche.rencontres.tour, séparés par « ; ».
  [
    'participants.fiche.rencontres.toursListe',
    ({ tours }, texte) => tours.map((etape) => texte('participants.fiche.rencontres.tour', etape)).join(' ; '),
  ],
  ['participants.fiche.rencontres.aucune', 'Elle ne rencontre personne dans ce placement.'],
  [
    'participants.fiche.rencontres.nonMesurable',
    'Ce placement ne se mesure pas : la page Qualité en donne les raisons.',
  ],
  ['participants.fiche.rencontres.exclue', 'Exclue : elle ne rencontre personne dans les mesures.'],

  // --- Les étiquettes de la fiche (§ 4.5, § 10.2) ---------------------------
  ['participants.etiquettes.champ', 'Ajouter des étiquettes, séparées par une virgule'],
  ['participants.etiquettes.ajouter', 'Ajouter'],
  ['participants.etiquettes.retirer', ({ motCle }) => `Retirer « ${motCle} »`],

  // --- Les statuts calculés (§ 4.2) -----------------------------------------
  ['participants.statut.ancre', 'ancré'],
  ['participants.statut.partiel', 'partiellement fixé'],
  ['participants.statut.mobile', 'mobile'],
]);
