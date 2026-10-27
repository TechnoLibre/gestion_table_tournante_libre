// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les libellés du plan de salle : vue, tables, places, panneaux et listes de
// travail (§ 14.6). Chaque clé commence par « plan. ».
//
// Une ligne de la liste de noms (§ 7.6) se compose de parties, chacune son
// tspan : la tête — numéro, puis état de la place —, le nom, puis le titre
// entre ce qui le précède et ce qui le suit. Le nom et le libellé du titre
// sont des données : aucun texte de cette table ne les porte. La tête finit
// par une espace quand un nom la suit (avecNom). Le libellé d'une table est
// une donnée de même : l'écran le pose dans son propre nœud, et seul le nom
// accessible de la table, un attribut, le cite.
import { auxToursNommes, cite, compte, enumeration } from '../../application/libelles/aides.js';

export const TABLE = new Map([
  // --- Le dessin d'une table (§ 7.5, § 7.6) ----------------------------------
  // Le nom accessible d'une table : numéro et libellé cité quand elle en
  // porte un (libelle null sinon), places, conflits du tour quand ils
  // s'évaluent (conflits null sinon), puis gelée et surchargée.
  [
    'plan.table.nom',
    ({ numero, libelle = null, places, conflits, gelee, surchargee }) =>
      [
        `Table ${numero}${libelle === null ? '' : ` ${cite(libelle)}`}`,
        compte(places, 'place', 'places'),
        ...(conflits === null ? [] : [conflits === 0 ? 'aucun conflit' : compte(conflits, 'conflit', 'conflits')]),
        ...(gelee ? ['gelée'] : []),
        ...(surchargee ? ['surchargée'] : []),
      ].join(', '),
  ],

  // Ce qui sépare le nom d'une table de son libellé, que l'écran pose dans
  // son propre nœud : l'en-tête de l'infobulle, le titre du panneau.
  ['plan.table.avantLibelle', ' \u{2014} '],

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
  // L'organisation de l'occupant, quand la barre de vue la montre, suit son
  // nom après ce séparateur fin.
  ['plan.ligne.avantOrganisation', ' \u{00B7} '],
  ['plan.ligne.avantTitrePourvu', ' \u{2014} '],
  ['plan.ligne.avantTitreNonPourvu', ' \u{2014} titre '],
  ['plan.ligne.apresTitreNonPourvu', ' non pourvu'],

  // --- Le bandeau du plan (§ 7.5) --------------------------------------------
  // L'organisation d'un plancher de groupe est une donnée : l'écran la pose
  // dans son propre nœud, avant ce texte.
  ['plan.bandeau.toutesEnConflit', 'toutes les tables sont en conflit à ce tour'],
  [
    'plan.bandeau.collisionPartout',
    'tout placement porte une collision à chaque table : ajouter des tables ou désactiver la séparation',
  ],
  [
    'plan.bandeau.uneSeuleOrganisation',
    'une seule organisation sous séparation active : chaque table réunit des personnes de la même organisation',
  ],
  [
    'plan.bandeau.plancherGroupe',
    ({ effectif, plancherCumulees, plancherPairesDistinctes }) =>
      `${compte(effectif, 'personne', 'personnes')}, au moins ` +
      `${compte(plancherCumulees, 'collision cumulée', 'collisions cumulées')} sur la soirée, ` +
      `${plancherCumulees === 1 ? 'portée' : 'portées'} par au moins ` +
      compte(plancherPairesDistinctes, 'paire distincte', 'paires distinctes'),
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
  // L'organisation à droite de chaque nom des listes ; listes masquées, la
  // bascule reste offerte, inactive, et dit pourquoi.
  ['plan.vue.organisations', 'Organisation'],
  ['plan.vue.organisationsSansListes', 'Montrez les listes de noms pour y voir les organisations'],
  ['plan.vue.pleinEcran', 'Plein écran'],
  // Les noms des groupes de la barre de vue (role="group").
  ['plan.vue.groupeZoom', 'Zoom'],
  ['plan.vue.groupeAffichage', 'Affichage'],
  ['plan.vue.dessin', 'Plan de salle'],
  // Le placement que le plan montre, et la commande qui quitte une
  // proposition montrée.
  ['plan.source.retenu', 'Placement retenu'],
  ['plan.source.reservations', 'Réservations'],
  ['plan.source.retenuFautif', 'Réservations : le placement retenu ne se lit pas'],
  ['plan.source.propositionReservations', ({ proposition }) => `Proposition n° ${proposition} : un geste y pose une réservation`],
  ['plan.source.propositionVueSeule', ({ proposition }) => `Proposition n° ${proposition}, vue seule`],
  ['plan.source.revenirRetenu', 'Revenir au placement retenu'],
  ['plan.source.revenirReservations', 'Revenir aux réservations'],

  // --- Les gestes du pointeur (§ 5.8, § 7.1, § 7.3) -------------------------
  // Le fantôme d'une personne glissée dit ce que le relâcher au point
  // courant modifie : l'état des données, non le geste (§ 5.8) ; une
  // personne réservée déplace sa réservation, dont il dit la portée, et
  // au-dessus du sol la retire (« ce tour ») ou se la voit refuser (« tous
  // les tours ») ; une personne que rien ne tient n'y change rien ; sous le
  // retenu, le sol retire du tour une personne que rien ne tient, et refuse
  // celle que sa réservation tient à sa table, de l'une ou l'autre portée.
  // Le nom de la personne est une donnée, dans son propre nœud.
  ['plan.fantome.reservations', 'pose une réservation'],
  ['plan.fantome.reservationTour', 'déplace sa réservation de ce tour'],
  ['plan.fantome.reservationTous', 'déplace sa réservation, à tous les tours'],
  ['plan.fantome.retireReservationTour', 'retire sa réservation de ce tour'],
  ['plan.fantome.refuseTous', 'refusé : sa réservation vaut pour tous les tours'],
  ['plan.fantome.refuseTour', 'refusé : sa réservation de ce tour la tient à cette table'],
  ['plan.fantome.rienNeChange', 'aucune réservation à retirer : rien ne change'],
  ['plan.fantome.retenu', 'déplace dans le placement retenu'],
  ['plan.fantome.retireDuTour', 'retire du tour : attend dans la réserve'],
  ['plan.fantome.vueSeule', 'proposition en vue seule : rien ne change'],
  // La place où un refus ou un avertissement du plan se pose.
  ['plan.refus.table', ({ numero }) => `Table ${numero}`],
  ['plan.refus.siege', ({ numero, siege }) => `Table ${numero}, siège ${siege}`],
  ['plan.refus.fermer', 'Fermer'],

  // --- Le clavier et l'infobulle (§ 7.1, § 7.3, § 13.5) ----------------------
  // Le plan est un seul arrêt de tabulation : sa description dit comment s'y
  // déplacer. L'infobulle d'une table en conflit nomme chaque règle violée,
  // puis ses groupes : les noms sont des données, chacun dans son nœud,
  // reliés par « et » dans une paire et séparés d'un groupe à l'autre. Une
  // ligne de séparer les organisations nomme l'organisation de ses paires,
  // une donnée dans son nœud, entre separerOrganisations et finOrganisation :
  // la phrase se partage en deux clés autour d'elle. Chaque ligne s'ouvre sur
  // une capitale.
  ['plan.vue.role', 'plan de salle interactif'],
  // L'en-tête de l'infobulle : la table, son libellé quand elle en porte
  // un, dans son propre nœud après plan.table.avantLibelle, puis le nombre
  // de violations.
  ['plan.infobulle.table', ({ numero }) => `Table ${numero}`],
  ['plan.infobulle.nombre', ({ nombre }) => ` : ${compte(nombre, 'conflit', 'conflits')}`],
  ['plan.infobulle.conflitsOrganisation', "Conflit d'organisation : "],
  ['plan.infobulle.separerOrganisations', 'Même organisation ('],
  ['plan.infobulle.finOrganisation', ') : '],
  ['plan.infobulle.nouveauxVoisins', 'Voisins revus : '],
  ['plan.infobulle.nouvelleTable', 'Table revue : '],
  ['plan.infobulle.et', ' et '],
  ['plan.infobulle.separateur', ', '],

  // --- La légende des conflits (§ 7.5) --------------------------------------
  // Une entrée par règle active : son échantillon, son nom, puis la forme de
  // sa trame, qui la distingue sans la couleur. L'exemple de la pastille est
  // le chiffre que porte son échantillon.
  ['plan.legende.ouvrir', 'Légende'],
  ['plan.legende.titre', 'Légende des conflits'],
  ['plan.legende.conflitsOrganisation', "Conflits d'organisation : organisations en conflit à la table"],
  ['plan.legende.separerOrganisations', 'Séparer les organisations : même organisation à la table'],
  ['plan.legende.nouveauxVoisins', 'Nouveaux voisins à chaque tour : voisins revus'],
  ['plan.legende.nouvelleTable', 'Nouvelle table à chaque tour : table revue'],
  ['plan.legende.forme.hachuresHorizontales', '(hachures horizontales)'],
  ['plan.legende.forme.hachuresDescendantes', '(hachures descendantes)'],
  ['plan.legende.forme.hachuresMontantes', '(hachures montantes)'],
  ['plan.legende.forme.points', '(points)'],
  ['plan.legende.aucune', 'Aucune règle de conflit n\u{2019}est active.'],
  [
    'plan.legende.superposition',
    'Une table qui viole plusieurs règles superpose leurs trames ; son contour épaissi la signale quelle que soit la règle.',
  ],
  ['plan.legende.pastille', 'Pastille : le nombre de conflits de la table à ce tour, toutes règles confondues.'],
  ['plan.legende.pastilleExemple', '2'],

  // --- Les panneaux latéraux (§ 2.1, étape 8) --------------------------------
  ['plan.panneaux', 'Panneaux du plan'],
  ['plan.listesTravail.titre', 'Listes de travail'],
  ['plan.reserve.titre', 'Réserve'],

  // --- Le choix en attente (§ 5.8, § 7.1) ------------------------------------
  // Le nom de la personne choisie est une donnée, dans son propre nœud.
  ['plan.choix.personne', 'Personne choisie : '],
  ['plan.choix.reservation', 'Réservation choisie : '],
  ['plan.choix.oublier', 'Oublier le choix'],
  [
    'plan.choix.inviter',
    "Choisissez d'abord une personne : dans la réserve, dans la liste des pressentis, ou par « Déplacer » dans son menu.",
  ],

  // --- Le panneau d'une place (§ 7.1, § 2.1 étape 6, § 4) --------------------
  ['plan.action.assigner', 'Assigner'],
  ['plan.action.reserver', 'Réserver'],
  ['plan.action.donnerTitre', 'Donner un titre'],
  ['plan.action.designer', 'Désigner'],
  ['plan.action.retirerReservation', 'Retirer la réservation'],
  ['plan.action.retirerTitre', 'Retirer le titre'],
  ['plan.action.deplacerReservationIci', 'Déplacer la réservation ici'],
  ['plan.portee.etiquette', 'Portée'],
  ['plan.portee.tour', ({ tour }) => `Tour ${tour}`],
  ['plan.portee.tous', 'Tous les tours'],
  ['plan.titre.etiquette', 'Libellé du titre'],

  // --- Le panneau d'une table (§ 7.3, § 2.1 étape 6) -------------------------
  ['plan.panneauTable.conflits', "Conflits d'organisation à ce tour"],
  ['plan.panneauTable.sieges', 'Sièges'],
  [
    'plan.panneauTable.titres',
    ({ titres, pourvus }) => `${compte(titres, 'titre', 'titres')} dont ${compte(pourvus, 'pourvu', 'pourvus')}`,
  ],
  ['plan.panneauTable.siege', 'Siège'],

  // --- Le menu par personne (§ 7.1) ------------------------------------------
  // Le nom de la personne, titre du menu, est une donnée dans son nœud.
  ['plan.menu.titre', 'Menu de '],
  ['plan.menu.deplacer', 'Déplacer'],
  ['plan.menu.echanger', 'Échanger'],
  ['plan.menu.retirerDuTour', 'Retirer du tour'],
  ['plan.menu.reserverIci', 'Réserver ici'],
  ['plan.menu.deplacerReservation', 'Déplacer sa réservation'],
  ['plan.menu.exclure', 'Exclure'],
  ['plan.menu.reintegrer', 'Réintégrer'],
  ['plan.menu.mettreEnEvidence', 'Mettre en évidence'],
  ['plan.menu.oterEvidence', 'Ôter la mise en évidence'],
  ['plan.menu.ouvrirFiche', 'Ouvrir la fiche'],

  // --- La mise en évidence d'une personne (§ 7.1, § 8.4) ----------------------
  // Le nom de la personne mise en évidence est une donnée dans son nœud.
  ['plan.evidence.personne', 'Mise en évidence : '],
  ['plan.evidence.absente', 'une personne qui n\u{2019}est plus dans la liste'],
  // La personne mise en évidence, absente au tour montré : la suite de son nom.
  ['plan.evidence.absenteAuTour', ({ tour }) => ` \u{2014} absente au tour ${tour}`],
  // La personne mise en évidence, dans la réserve au tour montré : sans
  // chaise à marquer, la suite de son nom le dit.
  ['plan.evidence.reserveAuTour', ({ tour }) => ` \u{2014} dans la réserve au tour ${tour}`],
  ['plan.evidence.oter', 'Ôter la mise en évidence'],
  ['plan.evidence.voir', 'Voir sur le plan'],

  // --- Les listes de travail (§ 5.8, § 4.1, § 4.2) ---------------------------
  // Le libellé d'un titre, le titre pressenti et le nom d'une personne sont
  // des données, chacun dans son nœud, entre ces textes.
  ['plan.listesTravail.titres', 'Titres de place non pourvus'],
  ['plan.listesTravail.pressentis', 'Titres pressentis sans réservation'],
  ['plan.listesTravail.conversions', 'Conversions proposées'],
  ['plan.listesTravail.aucun', 'Aucun.'],
  ['plan.listesTravail.titreNonPourvu', ({ numero }) => `table ${numero} : titre `],
  ['plan.listesTravail.nonPourvu', ' non pourvu'],
  [
    'plan.listesTravail.pourvuAuxTours',
    ({ tours }) => ` (pourvu ${tours.length === 1 ? 'au tour' : 'aux tours'} ${enumeration(tours.map(String))})`,
  ],
  ['plan.listesTravail.pressenti', ' \u{2014} titre pressenti '],
  ['plan.listesTravail.conversion', ({ numero }) => ` : une réservation à chaque tour, table ${numero}`],
  ['plan.listesTravail.convertir', 'Convertir en « tous les tours »'],
  // Les personnes que le placement retenu laisse en réserve, chacune suivie
  // des tours où il la réserve.
  ['plan.listesTravail.reserves', 'En réserve dans le placement retenu'],
  ['plan.listesTravail.enReserve', ({ tours }) => ` \u{2014} en réserve ${auxToursNommes(tours)}`],
  // Les inclusions que le placement montré laisse non satisfaites, chacune
  // par sa phrase (qualite.inclusions.*).
  ['plan.listesTravail.inclusions', 'Inclusions non satisfaites'],
  ['plan.listesTravail.aucuneInclusion', 'Aucune.'],
  ['plan.listesTravail.ignorer', 'Ignorer'],

  // --- La réserve (§ 7.1, § 5.8) ---------------------------------------------
  ['plan.reserve.tour', ({ tour }) => `Personnes en attente au tour ${tour}`],
  ['plan.reserve.vide', 'Personne en attente à ce tour.'],

  // --- Les absentes (§ 7.1) --------------------------------------------------
  // Les personnes absentes au tour montré : ni chaise ni place en réserve.
  // Le nom est une donnée, dans son nœud ; sa présence le suit, vide pour
  // une présence à tous les tours.
  ['plan.absentes.titre', 'Absentes'],
  ['plan.absentes.tour', ({ tour }) => `Personnes absentes au tour ${tour}, sans chaise ni place en réserve`],
  ['plan.absentes.presente', ({ tours }) => (tours === null ? '' : ` \u{2014} présente ${auxToursNommes(tours)}`)],
]);
