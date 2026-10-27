<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La grille éditable des participants (§ 10.2) : une ligne par personne
  // de lignes, dans l'ordre que lui donne SectionParticipants, une cellule
  // par colonne de COLONNES (grille.js), puis les commandes de la ligne.
  //
  // Au clavier, une seule cellule est dans l'ordre de tabulation, la cellule
  // active ; flèches, Tab et Maj+Tab la déplacent (celluleSuivante), et Tab
  // après la dernière, Maj+Tab avant la première, rendent le focus au
  // navigateur. Entrée ou F2 ouvre l'édition d'une cellule de texte, que la
  // machine de champ.js tient : Entrée, Tab ou la sortie du champ valident,
  // Échap rend la valeur enregistrée. Les notes s'éditent dans une zone de
  // texte, qui garde leurs sauts de ligne ; un champ d'une ligne les
  // retirerait de toute note retouchée. Maj+Entrée y insère un saut de
  // ligne, Entrée seule valide (entreeValide). Une validation qui change la valeur
  // exécute la commande de la cellule (commandeDeCellule) par la séance :
  // modifierParticipant sur ce seul champ, ou changerPresence ; une
  // saisie qui se lit comme la valeur enregistrée — en NFC, sans blancs de
  // bord — n'exécute rien. Entrée sur la cellule d'exclusion exclut ou
  // réintègre la personne.
  //
  // La présence (§ 10.2) s'affiche « tous » en texte secondaire, ou ses
  // tours nommés en pastille d'information à calendrier (affichagesPresence,
  // presence.js). Entrée ou F2 l'ouvre en cases, une par tour de 1 à tours
  // (CasesPresence, compact), le focus sur la case active, celle du tour 1
  // à l'ouverture : ← → Début Fin passent d'une case à l'autre, l'espace
  // coche ou décoche sans rien écrire, et la saisie, canonique
  // (saisieApresBascule), passe par la même machine de champ.js que le
  // texte. Entrée, Tab ou la sortie du groupe valident une fois, en une
  // entrée : Tab valide puis mène à la cellule voisine, et la sortie d'une
  // case vers une autre case du groupe ne valide pas. Échap rend la présence
  // enregistrée. Cocher puis décocher un tour, puis valider, n'écrit rien.
  //
  // Les conflits d'organisation (§ 4, § 10.2) s'affichent en pastilles
  // neutres à l'icône « interdit », une par organisation nommée — la teinte
  // d'organisation reste à la colonne de l'organisation —, la cellule vide
  // sans conflit. Entrée ou F2 les ouvre en choix multiple (ChoixMultiple,
  // compact), une case par organisation de l'événement hors la sienne
  // (choixDeConflits, liste_conflits.js), le focus sur la première ; les
  // mêmes touches que la présence y valent, sur la même machine : la saisie
  // est la liste canonique, et la validation exécute changerConflits de la
  // liste entière (commandeDeCellule), une seule entrée pour le geste. Sans
  // autre organisation, le groupe le dit, et prend le focus.
  //
  // Un refus se pose dans la cellule où le geste a eu lieu, avec son
  // remède : celui de la séance, lu dans etat().refus avant d'ouvrir
  // l'édition, ou celui de la commande, la saisie gardée.
  //
  // « Voir sur le plan » met la personne en évidence et ouvre le plan
  // (§ 7.1, § 8.4) au tour montré quand elle y a une chaise, sinon au
  // premier tour où elle en a une : un geste de regard, qui n'écrit rien.
  //
  // L'en-tête trie : un clic sur une colonne la trie croissante, un second
  // décroissante ; le sens se lit en texte et dans aria-sort. Un collage sur
  // la grille, hors d'une cellule en édition, ouvre l'aperçu d'import (§
  // 10.2) : le texte part à l'état de navigation, intact, et rien ne
  // s'écrit ici.
  //
  // Groupée (groupes non null, ceux de groupesGrille), la grille porte un
  // corps par groupe du premier niveau, dont l'en-tête porte
  // scope="rowgroup" ; celui d'un sous-groupe porte scope="row", et ses
  // lignes n'héritent pas des en-têtes de ses aînés. Chaque groupe, de tout
  // niveau, y rend un en-tête, en retrait selon son niveau, dont le bouton replie ou
  // déplie le groupe et dit son état en texte et dans aria-expanded, puis,
  // déplié, ses sous-groupes, ou ses lignes au dernier niveau. Une ligne
  // porte la clé du plus étroit groupe qui la compte. Les lignes visibles
  // sont celles de lignesVisibles : flèches et Tab ne parcourent qu'elles,
  // jamais un en-tête ni une ligne repliée. Une saisie validée dont la
  // ligne quitte le rendu — tri ou groupe changé — rend le focus à la même
  // cellule de sa nouvelle ligne, et chaque groupe replié qui la reçoit, de
  // tout niveau, se déplie. Replier et déplier n'écrivent rien. Entrée sur
  // la cellule d'exclusion suit sa ligne de même : la personne exclue ou
  // réintégrée passe dans son nouveau groupe, et sa cellule garde le focus.
  //
  // L'organisation s'affiche en pastille de la teinte que teintes lui donne
  // (teintesOrganisations, calculée par la section sur la liste entière),
  // neutre au-delà de la palette ; le titre pressenti en pastille
  // d'information à étoile ; « exclue » en pastille neutre à croix,
  // « présente » en texte secondaire. Chaque pastille porte la valeur ou le
  // libellé en texte, et garde les blancs de la donnée comme la cellule.
  //
  // Les conflits du placement montré (conflits, clé d'un groupe → ses
  // lignes de conflit ; enConflit, identifiant → ses règles), que la section
  // ne donne que groupée : l'en-tête d'un groupe en conflit, de tout niveau,
  // porte une marque, un cadre plein qui dit en texte le nombre de ses
  // conflits ; un groupe du dernier niveau, déplié, écrit au-dessus de ses
  // lignes une ligne par conflit — lieu, noms, raison —, chaque nom dans son
  // propre nœud ; la cellule du nom d'une personne en conflit nomme ses
  // règles. Aucune couleur ne les distingue : la teinte de conflit reste au
  // plan.
  //
  // La colonne « Conflits du placement » (MESURES, grille.js), groupée ou
  // non, écrit les conflits de chaque personne dans le placement que le plan
  // montre — la proposition demandée, ui.proposition, sinon le retenu —,
  // que la grille lit elle-même par conflitsDuPlacement
  // (src/application/conflits_placement.js), les mêmes que ceux des groupes
  // et des pastilles du plan : une ligne de texte par tour où la personne
  // est en conflit, « tour 2 : » puis le texte de chaque règle — « se
  // revoient avec » le nom de chaque personne revue, « revient à la
  // table » et son numéro, le texte court des deux autres —
  // (conflitsParTour, texteDuTour, conflits.js), ou un tiret sans conflit
  // comme sans placement montré. Elle se lit seulement : sa cellule prend
  // le focus, Entrée et F2 n'y ouvrent rien, son en-tête ne trie pas, elle
  // ne se groupe ni ne se filtre, et l'export ne l'écrit pas.
  //
  // La colonne « Animation » (MESURES), juste après le titre pressenti, se
  // lit de même : les numéros affichés des tables que la personne anime,
  // « 3 » ou « 3, 5 », lus dans tablesAnimees
  // (src/application/animateurs.js) sur la charge entière, ou « à
  // désigner » en pastille d'avis à triangle pour une personne non exclue
  // qui porte la marque de l'animation réservée sans animer de table
  // (celluleAnimation, grille.js), vide sinon.
  import { getContext, onDestroy, tick } from 'svelte';
  import { tablesAnimees } from '../../application/animateurs.js';
  import { conflitsDuPlacement } from '../../application/conflits_placement.js';
  import { organisationsDe } from '../../application/conflits_organisation.js';
  import { cleNormalisee } from '../../application/csv.js';
  import { nomAffiche } from '../../application/personnes.js';
  import { etatPlaces } from '../../application/places.js';
  import { tourAffiche, tourPourVoir } from '../plan/vue_plan.js';
  import { creerMachineChamp } from '../primitives/champ.js';
  import Commande from '../primitives/Commande.svelte';
  import Pastille from '../primitives/Pastille.svelte';
  import { creerGeste } from '../primitives/geste.js';
  import Refus from '../primitives/Refus.svelte';
  import { effetDe } from '../raccourcis.js';
  import CasesPresence from './CasesPresence.svelte';
  import ChoixMultiple from './ChoixMultiple.svelte';
  import { cleDeRaison, conflitsParTour, texteDuTour } from './conflits.js';
  import {
    COLONNES,
    MESURES,
    TRIABLES,
    basculerGroupe,
    celluleAnimation,
    celluleSuivante,
    cheminDe,
    cleDeColonne,
    commandeDeCellule,
    deplierChemin,
    entreeValide,
    lignesVisibles,
    ligneVoisine,
  } from './grille.js';
  import { choixDeConflits, lectureConflits, saisieApresBasculeConflit, saisieConflitsEnregistree } from './liste_conflits.js';
  import { affichagesPresence, casesDeSaisie, lecturePresence, saisieApresBascule, saisieEnregistree } from './presence.js';

  let {
    lignes,
    groupes = null,
    teintes = new Map(),
    replies = $bindable(new Set()),
    tri = $bindable(null),
    supprimer,
    conflits = new Map(),
    enConflit = new Map(),
    tours = 1,
  } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');

  // Met la personne en évidence et ouvre le plan au tour où elle a une
  // chaise (tourPourVoir), dans le placement que le plan montre ; le tour
  // montré, et le choix en attente avec lui, ne change que si elle n'y en a
  // pas.
  function voirSurLePlan(id) {
    const { charge } = seance.etat();
    if (charge !== null) {
      const { tour: demande, proposition } = ui.etat();
      const montre = tourAffiche(demande, charge.evenement.tours);
      const tour = tourPourVoir(id, charge.evenement.tours, montre, (r) => etatPlaces(charge, { tour: r, proposition }));
      if (tour !== montre) ui.montrerTour(tour);
    }
    ui.mettreEnEvidence(id);
    ui.allerA('plan');
  }
  const uid = $props.id();
  const geste = creerGeste(seance);

  // La cellule active : l'identifiant de sa ligne et le rang de sa colonne.
  let actif = $state({ id: null, colonne: 0 });
  // La cellule en édition, {id, colonne}, et le texte saisi.
  let edition = $state.raw(null);
  let saisie = $state('');
  // Le refus posé sur une cellule : {id, colonne, refus}.
  let refusCellule = $state.raw(null);
  let machine = null;
  let tableau;
  let entree = $state(null);
  // Le groupe des cases en édition : celles de la présence (CasesPresence),
  // ou celles des conflits (ChoixMultiple).
  let editeur = $state(null);

  // Les organisations de l'événement, exclus compris : celles qu'un conflit
  // peut nommer. La grille ne reçoit que ses lignes, que le filtre réduit.
  const organisations = $derived($seance.charge === null ? new Set() : organisationsDe($seance.charge));

  // Les conflits du placement montré de chaque personne, tour par tour ;
  // une table vide sans placement montré. Un placement montré — proposition
  // ou retenu — dont les conflits ne se comptent pas (en dérive) n'est pas
  // « sans conflit » : sa colonne le dit (nonCompte).
  const conflitsBruts = $derived(
    $seance.charge === null ? null : conflitsDuPlacement($seance.charge, { proposition: $ui.proposition }),
  );
  const conflitsDesPersonnes = $derived(conflitsParTour(conflitsBruts, $seance.charge?.participants ?? []));
  const nonCompte = $derived(
    $seance.charge !== null && conflitsBruts === null && ($ui.proposition !== null || $seance.charge.retenu !== null),
  );

  // Les tables que chaque personne anime, lues sur la charge entière : la
  // grille ne reçoit que ses lignes.
  const animees = $derived($seance.charge === null ? new Map() : tablesAnimees($seance.charge));

  // Les lignes que la grille montre, dans leur ordre, et le rang de chacune
  // parmi elles, par identifiant.
  const visibles = $derived(groupes === null ? lignes : lignesVisibles(groupes, replies));
  const rangs = $derived(new Map(visibles.map(({ id }, rang) => [id, rang])));

  // Le rang de la ligne active ; la première quand l'active n'est plus affichée.
  const rangActif = $derived(rangs.get(actif.id) ?? 0);

  // L'affichage au repos de la présence de chaque personne, par identifiant.
  const affichages = $derived(affichagesPresence(lignes));

  const idRefus = (id, colonne) => `${uid}-refus-${id}-${colonne}`;
  const enEdition = (id, colonne) => edition !== null && edition.id === id && edition.colonne === colonne;
  const refusDe = (id, colonne) =>
    refusCellule !== null && refusCellule.id === id && refusCellule.colonne === colonne ? refusCellule.refus : null;

  // Le texte d'une valeur enregistrée, vide pour null ; et la valeur que
  // l'enregistrement en lirait, pour reconnaître une saisie sans changement.
  const texteDe = (valeur) => (valeur === null ? '' : valeur);
  const lire = (texte) => ({ valeur: texte.normalize('NFC').trim() });

  // Les colonnes qui s'éditent en cases, dans un groupe.
  const EN_CASES = new Set(['presence', 'conflits']);

  // Le contrôle de la cellule en édition — le groupe des cases de la
  // présence ou des conflits, le champ de texte sinon —, vrai quand le
  // focus est en lui, et le focus qui y revient : la case active, le groupe
  // des conflits quand il n'en porte aucune, ou le champ.
  const controleEnEdition = () => (EN_CASES.has(edition?.colonne) ? editeur : entree);
  const focusDans = (controle) => controle !== null && controle.contains(document.activeElement);
  function focaliserEdition() {
    if (edition?.colonne === 'presence') editeur?.querySelector('[data-presence-tour][tabindex="0"]')?.focus();
    else if (edition?.colonne === 'conflits') (editeur?.querySelector('[data-choix][tabindex="0"]') ?? editeur)?.focus();
    else entree?.focus();
  }

  function trier(colonne) {
    tri = tri !== null && tri.colonne === colonne && tri.sens === 'croissant' ? { colonne, sens: 'decroissant' } : { colonne, sens: 'croissant' };
  }

  const ariaSort = (colonne) => {
    if (tri === null || tri.colonne !== colonne) return 'none';
    return tri.sens === 'croissant' ? 'ascending' : 'descending';
  };

  function cellule(id, colonne) {
    return tableau?.querySelector(`[data-participant="${id}"] [data-champ="${colonne}"]`) ?? null;
  }

  async function activer(rang, colonne) {
    const ligne = visibles[rang];
    actif = { id: ligne.id, colonne };
    await tick();
    cellule(ligne.id, COLONNES[colonne])?.focus();
  }

  function refuser(id, colonne, erreur) {
    if (typeof erreur?.code !== 'string') throw erreur;
    refusCellule = { id, colonne, refus: { code: erreur.code, details: erreur.details ?? {} } };
  }

  async function ouvrirEdition(personne, colonne) {
    const courant = seance.etat().refus;
    if (courant !== null) {
      refusCellule = { id: personne.id, colonne, refus: courant };
      return;
    }
    refusCellule = null;
    if (colonne === 'presence') machine = creerMachineChamp({ stockee: saisieEnregistree(personne, tours), lire: lecturePresence(tours) });
    else if (colonne === 'conflits') machine = creerMachineChamp({ stockee: saisieConflitsEnregistree(personne), lire: lectureConflits });
    else machine = creerMachineChamp({ stockee: texteDe(personne[colonne]), lire });
    saisie = machine.saisie;
    edition = { id: personne.id, colonne };
    await tick();
    focaliserEdition();
    if (!EN_CASES.has(colonne)) entree?.setSelectionRange(saisie.length, saisie.length);
  }

  // Ferme l'édition et rend le focus à sa cellule quand il était dans le
  // champ, ou dans le groupe des cases.
  async function fermerEdition() {
    const fermee = edition;
    const avaitLeFocus = focusDans(controleEnEdition());
    edition = null;
    machine = null;
    geste.tenir(false);
    if (fermee === null || !avaitLeFocus) return;
    await tick();
    cellule(fermee.id, fermee.colonne)?.focus();
  }

  // Valide la saisie de la cellule en édition : rien quand elle se lit comme
  // la valeur enregistrée, la commande sinon. Rend une promesse de vrai quand
  // l'édition se clôt, de faux quand la commande est refusée : l'édition
  // reste alors ouverte sur la saisie, le refus contre elle, le focus dans
  // le champ.
  async function valider() {
    if (edition === null) return true;
    const { id, colonne } = edition;
    const rendu = machine.valider();
    saisie = machine.saisie;
    if (rendu.action !== 'executer') {
      await fermerEdition();
      return true;
    }
    const enCours = machine;
    const rangAvant = rangs.get(id) ?? 0;
    const { nom, args } = commandeDeCellule(colonne, id, rendu.valeur);
    let promesse;
    try {
      promesse = seance.executer(nom, args);
    } catch (erreur) {
      await echouer(enCours, id, colonne, erreur);
      return false;
    }
    const garderFocus = focusDans(controleEnEdition());
    fermerEdition();
    try {
      await promesse;
    } catch (erreur) {
      await echouer(enCours, id, colonne, erreur);
      return false;
    }
    await suivreLigne(id, colonne, garderFocus, rangAvant);
    return true;
  }

  // Après une modification écrite, quand la cellule avait le focus : la
  // ligne que la valeur a menée sous des groupes repliés, de tout niveau,
  // les déplie, puis la cellule reprend le focus que le retrait de son
  // ancienne ligne a rendu au document. Une ligne que le filtre ne montre
  // plus a laissé son rang, rangAvant, à la ligne qui la suivait — à la
  // dernière quand elle fermait la grille — : la même colonne de cette
  // voisine prend le focus. Un focus posé ailleurs entre-temps reste où il
  // est.
  async function suivreLigne(id, colonne, garderFocus, rangAvant) {
    if (!garderFocus) return;
    await tick();
    const deplies = groupes === null ? replies : deplierChemin(replies, cheminDe(groupes, id));
    if (deplies !== replies) {
      replies = deplies;
      await tick();
    }
    const actuel = document.activeElement;
    if (actuel !== null && actuel !== document.body) return;
    const voisine = ligneVoisine(rangAvant, visibles.length);
    if (rangs.has(id)) cellule(id, colonne)?.focus();
    else if (voisine !== null) activer(voisine, COLONNES.indexOf(colonne));
  }

  async function echouer(enCours, id, colonne, erreur) {
    refuser(id, colonne, erreur);
    enCours.echec(refusCellule.refus);
    machine = enCours;
    saisie = enCours.saisie;
    edition = { id, colonne };
    geste.tenir(enCours.enCours);
    await tick();
    focaliserEdition();
  }

  function abandonner() {
    machine?.abandonner();
    refusCellule = null;
    return fermerEdition();
  }

  function surSaisie(evenement) {
    machine.saisir(evenement.currentTarget.value);
    saisie = machine.saisie;
    refusCellule = null;
    geste.tenir(machine.enCours);
  }

  // La bascule d'une case de la présence ou des conflits : la saisie suit,
  // rien ne s'écrit.
  function surBascule(tour, coche) {
    machine.saisir(saisieApresBascule(machine.saisie, tour, coche));
    saisie = machine.saisie;
    refusCellule = null;
    geste.tenir(machine.enCours);
  }
  function surBasculeConflit(organisation, coche) {
    machine.saisir(saisieApresBasculeConflit(machine.saisie, organisation, coche));
    saisie = machine.saisie;
    refusCellule = null;
    geste.tenir(machine.enCours);
  }

  // Les effets de la grille qui mènent à une autre cellule (celluleSuivante).
  const DEPLACEMENTS = new Set(['haut', 'bas', 'gauche', 'droite', 'suivante', 'precedente']);

  // La touche d'un appui telle que RACCOURCIS la nomme dans la grille :
  // « Maj+ » devant la touche quand la table donne à la majuscule son effet
  // propre (Maj+Tab), la touche seule sinon — Maj+flèche se lit comme la
  // flèche.
  function toucheDeGrille(evenement) {
    const majuscule = `Maj+${evenement.key}`;
    return evenement.shiftKey && effetDe('grille', majuscule) !== null ? majuscule : evenement.key;
  }

  // Dans une cellule en édition, les effets du contexte 'champ' — valider,
  // rendre — passent d'abord ; seuls suivante et precedente de la grille
  // s'y ajoutent.
  async function surToucheEntree(evenement, rang) {
    const touche = toucheDeGrille(evenement);
    const saisie = effetDe('champ', evenement.key);
    const tabulation = effetDe('grille', touche);
    if (saisie === 'rendre') {
      evenement.preventDefault();
      abandonner();
    } else if (saisie === 'valider') {
      if (!entreeValide({ maj: evenement.shiftKey, multiligne: edition.colonne === 'notes' })) return;
      evenement.preventDefault();
      valider();
    } else if (tabulation === 'suivante' || tabulation === 'precedente') {
      // Une saisie refusée garde l'édition et le focus : Tab ne quitte pas
      // le champ, dont la sortie validerait une seconde fois.
      evenement.preventDefault();
      const { id } = edition;
      const colonne = COLONNES.indexOf(edition.colonne);
      if (!(await valider())) return;
      await tick();
      tabulerDepuis(id, rang, colonne, touche);
    }
  }

  // Tab ou Maj+Tab depuis la cellule validée de la personne id, au rang
  // rangAvant avant la validation. La ligne se relit par son identifiant :
  // la valeur validée peut l'avoir déplacée au tri, et le rang d'avant
  // désignerait une autre personne. Une ligne que le filtre ne montre plus a
  // laissé son rang à celle qui la suivait, les autres gardant leur ordre :
  // Tab mène à la première cellule de celle-ci, Maj+Tab à la dernière de la
  // ligne d'avant ; hors de la grille, le focus reste où il est.
  function tabulerDepuis(id, rangAvant, colonne, touche) {
    const rang = rangs.get(id) ?? -1;
    if (rang >= 0) return deplacer(rang, colonne, touche);
    const suivante = effetDe('grille', touche) === 'suivante' ? { ligne: rangAvant, colonne: 0 } : { ligne: rangAvant - 1, colonne: COLONNES.length - 1 };
    if (suivante.ligne < 0 || suivante.ligne >= visibles.length) return false;
    activer(suivante.ligne, suivante.colonne);
    return true;
  }

  // La sortie du champ valide, sauf quand l'édition s'est déjà close.
  function surSortie() {
    if (edition !== null) valider();
  }

  // La sortie du groupe des cases valide ; le focus passé d'une case à une
  // autre du groupe, ou au groupe lui-même, ne sort pas.
  function surSortieGroupe(evenement) {
    if (editeur?.contains(evenement.relatedTarget)) return;
    surSortie();
  }

  function deplacer(rang, colonne, touche) {
    const suivante = celluleSuivante({ ligne: rang, colonne }, touche, { lignes: visibles.length, colonnes: COLONNES.length });
    if (suivante === null) return false;
    activer(suivante.ligne, suivante.colonne);
    return true;
  }

  // Exclut ou réintègre la personne ; écrit, la ligne suit son nouveau
  // groupe, comme après une saisie validée, quand sa cellule avait le focus.
  function basculerExclusion(personne) {
    const nom = personne.exclu ? 'reintegrerParticipant' : 'exclureParticipant';
    refusCellule = null;
    const garderFocus = document.activeElement === cellule(personne.id, 'exclu');
    const rangAvant = rangs.get(personne.id) ?? 0;
    try {
      Promise.resolve(seance.executer(nom, { id: personne.id })).then(
        () => suivreLigne(personne.id, 'exclu', garderFocus, rangAvant),
        (erreur) => refuser(personne.id, 'exclu', erreur),
      );
    } catch (erreur) {
      refuser(personne.id, 'exclu', erreur);
    }
  }

  function surToucheCellule(evenement, personne, rang, colonne) {
    if (evenement.target !== evenement.currentTarget) return;
    const touche = toucheDeGrille(evenement);
    const effet = effetDe('grille', touche);
    if (DEPLACEMENTS.has(effet)) {
      if (deplacer(rang, colonne, touche)) evenement.preventDefault();
    } else if (effet === 'editer') {
      evenement.preventDefault();
      if (MESURES.includes(COLONNES[colonne])) return;
      if (COLONNES[colonne] === 'exclu') basculerExclusion(personne);
      else ouvrirEdition(personne, COLONNES[colonne]);
    } else if (effet === 'effacer') {
      refusCellule = null;
    }
  }

  function surCollage(evenement) {
    if (evenement.target instanceof HTMLInputElement || evenement.target instanceof HTMLTextAreaElement) return;
    const texte = evenement.clipboardData?.getData('text/plain') ?? '';
    if (texte === '') return;
    evenement.preventDefault();
    ui.ouvrirImport({ texte, origine: 'collage' });
    ui.allerA('import');
  }

  onDestroy(() => geste.liberer());
</script>

{#snippet rangee(personne, rang, dans)}
  <tr data-participant={personne.id} data-groupe-ligne={dans}>
    {#each COLONNES as colonne, rangColonne (colonne)}
      {@const refus = refusDe(personne.id, colonne)}
      <td
        role="gridcell"
        data-champ={colonne}
        tabindex={rang === rangActif && rangColonne === actif.colonne ? 0 : -1}
        aria-describedby={refus === null || enEdition(personne.id, colonne) ? undefined : idRefus(personne.id, colonne)}
        onfocus={(evenement) => {
          if (evenement.target === evenement.currentTarget) actif = { id: personne.id, colonne: rangColonne };
        }}
        onkeydown={(evenement) => surToucheCellule(evenement, personne, rang, rangColonne)}
      >
        {#if enEdition(personne.id, colonne) && colonne === 'notes'}
          <textarea
            rows="3"
            aria-label={t(cleDeColonne(colonne))}
            value={saisie}
            bind:this={entree}
            aria-invalid={refus === null ? undefined : 'true'}
            aria-describedby={refus === null ? undefined : idRefus(personne.id, colonne)}
            oninput={surSaisie}
            onkeydown={(evenement) => surToucheEntree(evenement, rang)}
            onblur={surSortie}
          ></textarea>
        {:else if enEdition(personne.id, colonne) && colonne === 'presence'}
          <CasesPresence
            compact
            cases={casesDeSaisie(saisie, tours)}
            nom={nomAffiche(personne)}
            invalide={refus !== null}
            decrit={refus === null ? undefined : idRefus(personne.id, colonne)}
            bind:conteneur={editeur}
            basculer={surBascule}
            toucher={(evenement) => surToucheEntree(evenement, rang)}
            sortir={surSortieGroupe}
          />
        {:else if enEdition(personne.id, colonne) && colonne === 'conflits'}
          <ChoixMultiple
            compact
            choix={choixDeConflits(saisie, organisations, personne.organisation, cleNormalisee)}
            nom={t('participants.conflits.editeur', { nom: nomAffiche(personne) })}
            vide={t('participants.conflits.aucuneAutre')}
            invalide={refus !== null}
            decrit={refus === null ? undefined : idRefus(personne.id, colonne)}
            bind:conteneur={editeur}
            basculer={surBasculeConflit}
            toucher={(evenement) => surToucheEntree(evenement, rang)}
            sortir={surSortieGroupe}
          />
        {:else if enEdition(personne.id, colonne)}
          <input
            type="text"
            aria-label={t(cleDeColonne(colonne))}
            value={saisie}
            bind:this={entree}
            aria-invalid={refus === null ? undefined : 'true'}
            aria-describedby={refus === null ? undefined : idRefus(personne.id, colonne)}
            oninput={surSaisie}
            onkeydown={(evenement) => surToucheEntree(evenement, rang)}
            onblur={surSortie}
          />
        {:else if colonne === 'presence'}
          {@const vue = affichages.get(personne.id)}
          {#if vue.sorte === 'tous'}
            <span class="presence-tous" data-presence="tous">{t(vue.cle)}</span>
          {:else}
            <span class="donnee-pastille" data-presence="partielle">
              <Pastille sorte="statut" valeur="information" icone="calendrier" libelle={t(vue.cle, vue.details)} />
            </span>
          {/if}
        {:else if colonne === 'exclu'}
          {#if personne.exclu}
            <Pastille sorte="statut" valeur="neutre" icone="croix" libelle={t('participants.grille.exclue')} />
          {:else}
            <span class="presente">{t('participants.grille.presente')}</span>
          {/if}
        {:else if colonne === 'conflits'}
          {#if personne.conflits !== undefined}
            <ul class="liste-conflits" data-conflits-personne>
              {#each personne.conflits as organisation (organisation)}
                <li class="donnee-pastille">
                  <Pastille sorte="statut" valeur="neutre" icone="interdit" libelle={organisation} />
                </li>
              {/each}
            </ul>
          {/if}
        {:else if colonne === 'conflitsPlacement'}
          {#if conflitsDesPersonnes.has(personne.id)}
            <ul class="conflits-placement">
              {#each conflitsDesPersonnes.get(personne.id) as { tour, regles } (tour)}
                <li>
                  <span class="tour">{t('participants.conflit.tour', { tour })}</span>
                  <span>{texteDuTour(regles, t)}</span>
                </li>
              {/each}
            </ul>
          {:else if nonCompte}
            <span class="sans-conflit">{t('participants.conflit.nonCompte')}</span>
          {:else}
            <span class="sans-conflit">{t('participants.conflit.aucun')}</span>
          {/if}
        {:else if colonne === 'animation'}
          {@const animation = celluleAnimation(personne, animees)}
          {#if animation.sorte === 'tables'}
            <span class="valeur" data-animation="tables">{t('participants.animation.tables', { numeros: animation.numeros })}</span>
          {:else if animation.sorte === 'aDesigner'}
            <span class="donnee-pastille" data-animation="aDesigner">
              <Pastille sorte="statut" valeur="avis" icone="triangle" libelle={t('participants.animation.aDesigner')} />
            </span>
          {/if}
        {:else if colonne === 'organisation' && personne.organisation !== null}
          <span class="donnee-pastille">
            <Pastille sorte="organisation" valeur={teintes.get(personne.organisation) ?? null} libelle={personne.organisation} />
          </span>
        {:else if colonne === 'titrePressenti' && personne.titrePressenti !== null}
          <span class="donnee-pastille">
            <Pastille sorte="statut" valeur="information" icone="etoile" libelle={personne.titrePressenti} />
          </span>
        {:else}
          <span class="valeur">{personne[colonne] ?? ''}</span>
          {#if colonne === 'nom' && enConflit.has(personne.id)}
            <span class="marque-conflit" data-conflit-personne>{t('participants.conflit.personne', { regles: enConflit.get(personne.id) })}</span>
          {/if}
        {/if}
        {#if refus !== null}
          <Refus id={idRefus(personne.id, colonne)} {refus} lever={() => (refusCellule = null)} />
        {/if}
      </td>
    {/each}
    <td role="gridcell">
      <div class="commandes">
      <button type="button" data-commande="fiche" onclick={() => ui.ouvrirFiche(personne.id)}>
        {t('participants.commande.fiche')}
      </button>
      <button type="button" data-commande="voirSurLePlan" onclick={() => voirSurLePlan(personne.id)}>
        {t('plan.evidence.voir')}
      </button>
      {#if personne.exclu}
        <Commande
          cle="participants.commande.reintegrer"
          nom="reintegrerParticipant"
          executer={() => seance.executer('reintegrerParticipant', { id: personne.id })}
        />
      {:else}
        <Commande
          cle="participants.commande.exclure"
          nom="exclureParticipant"
          executer={() => seance.executer('exclureParticipant', { id: personne.id })}
        />
      {/if}
      <Commande cle="participants.commande.supprimer" nom="supprimerParticipant" executer={() => supprimer(personne)} />
      </div>
    </td>
  </tr>
{/snippet}

{#snippet bloc(groupe)}
  {@const replie = replies.has(groupe.cle)}
  <tr class="groupe" data-groupe={groupe.cle} data-niveau={groupe.niveau}>
    <th scope={groupe.niveau === 1 ? 'rowgroup' : 'row'} colspan={COLONNES.length + 1}>
      <button
        type="button"
        data-commande="basculerGroupe"
        data-cible={groupe.cle}
        aria-expanded={replie ? 'false' : 'true'}
        onclick={() => (replies = basculerGroupe(replies, groupe.cle))}
      >
        <span class="etat" data-groupe-etat>{t(replie ? 'participants.groupe.deplier' : 'participants.groupe.replier')}</span>
        {#if groupe.libelle === null}
          <span class="libelle" data-groupe-libelle>{t(groupe.cleLibelle, groupe.detailsLibelle ?? {})}</span>
        {:else}
          <span class="libelle valeur" data-groupe-libelle>{groupe.libelle}</span>
        {/if}
        <span class="compte" data-groupe-compte>{t('participants.groupe.compte', { compte: groupe.compte })}</span>
        {#if conflits.has(groupe.cle)}
          <span class="marque-conflit" data-groupe-conflits>{t('participants.conflit.groupe', { nombre: conflits.get(groupe.cle).length })}</span>
        {/if}
      </button>
    </th>
  </tr>
  {#if !replie}
    {#if groupe.sousGroupes === null && conflits.has(groupe.cle)}
      <tr class="conflits" data-conflits={groupe.cle}>
        <td colspan={COLONNES.length + 1}>
          <ul>
            {#each conflits.get(groupe.cle) as conflit (conflit.cle)}
              <li data-conflit>
                <span>{t('participants.conflit.lieu', { tour: conflit.tour, numero: conflit.numero })}</span>
                {#each conflit.noms as nom, rang (rang)}{' '}{#if rang > 0}<span>{t('participants.conflit.et')}</span>{' '}{/if}<span
                    class="valeur">{nom}</span
                  >{/each}{' '}<span>{t(cleDeRaison(conflit.regle), { numero: conflit.numero, deja: conflit.deja })}</span>
              </li>
            {/each}
          </ul>
        </td>
      </tr>
    {/if}
    {#if groupe.sousGroupes === null}
      {#each groupe.lignes as personne (personne.id)}
        {@render rangee(personne, rangs.get(personne.id), groupe.cle)}
      {/each}
    {:else}
      {#each groupe.sousGroupes as sousGroupe (sousGroupe.cle)}
        {@render bloc(sousGroupe)}
      {/each}
    {/if}
  {/if}
{/snippet}

<div class="defilement">
  <table
    role="grid"
    aria-label={t('participants.grille.titre')}
    tabindex={lignes.length === 0 ? 0 : undefined}
    bind:this={tableau}
    onpaste={surCollage}
  >
    <thead>
      <tr>
        {#each COLONNES as colonne (colonne)}
          {#if TRIABLES.includes(colonne)}
            <th scope="col" class:etroite={colonne === 'exclu' || colonne === 'presence'} aria-sort={ariaSort(colonne)}>
              <button type="button" data-commande="trier" data-cible={colonne} onclick={() => trier(colonne)}>
                <span>{t(cleDeColonne(colonne))}</span>
                {#if tri !== null && tri.colonne === colonne}
                  <span class="sens">{t(tri.sens === 'croissant' ? 'participants.grille.croissant' : 'participants.grille.decroissant')}</span>
                {/if}
              </button>
            </th>
          {:else}
            <th scope="col" class="mesure" class:replie={colonne === 'conflitsPlacement'} class:etroite={colonne === 'animation'}
              >{t(cleDeColonne(colonne))}</th
            >
          {/if}
        {/each}
        <th scope="col">{t('participants.grille.actions')}</th>
      </tr>
    </thead>
    {#if groupes === null}
      <tbody>
        {#each lignes as personne (personne.id)}
          {@render rangee(personne, rangs.get(personne.id), undefined)}
        {/each}
      </tbody>
    {:else}
      {#each groupes as groupe (groupe.cle)}
        <tbody>
          {@render bloc(groupe)}
        </tbody>
      {/each}
    {/if}
  </table>
</div>

<style>
  /* Le conteneur du tableau est aussi celui des requêtes de largeur : la
     tenue suit la place que la carte lui laisse, pas la fenêtre. */
  .defilement {
    max-width: 100%;
    overflow-x: auto;
    container-type: inline-size;
  }

  /* Le tableau d'une carte : en-tête sur le fond sourd, lignes séparées
     d'un filet léger, sans filet vertical. */
  /* Au-dessous de 59rem, le tableau défile dans son conteneur plutôt que de
     replier ses cellules caractère par caractère sous des actions d'une
     rangée. Le plancher tient dans la carte pleine largeur d'une fenêtre de
     1024 px ; la liste qui la porte (SectionParticipants) réclame un peu
     plus, pour que la fiche passe dessous plutôt que de le rogner. */
  table {
    width: 100%;
    min-width: 59rem;
    border-collapse: separate;
    border-spacing: 0;
    font-size: var(--taille-texte);
  }

  th,
  td {
    padding: var(--espace-2) var(--espace-3);
    border-bottom: 1px solid var(--couleur-ligne-filet);
    text-align: left;
    vertical-align: middle;
  }

  th:first-child,
  td:first-child {
    padding-left: var(--espace-5);
  }

  th:last-child,
  td:last-child {
    padding-right: var(--espace-5);
  }

  /* Les en-têtes en petit corps : les onze colonnes, dont chacune prend au
     moins la largeur de son plus long mot d'en-tête, tiennent dans les
     cartes décrites plus bas. Sous 80rem de place, un en-tête se replie
     entre ses mots : celui des conflits d'organisation sur deux lignes. */
  thead th {
    font-size: var(--taille-texte-petit);
    border-top: 1px solid var(--couleur-carte-filet);
    border-bottom-color: var(--couleur-page-filet);
    background-color: var(--couleur-carte-fond-sourd);
  }

  /* L'animation, l'exclusion et la présence, en mots courts ou en
     pastille : un retrait plus étroit leur suffit. */
  th.etroite,
  td[data-champ='animation'],
  td[data-champ='exclu'],
  td[data-champ='presence'] {
    padding-right: var(--espace-2);
    padding-left: var(--espace-2);
  }

  /* Sous 86rem de place, les cellules se serrent à un quart de rem de
     chaque côté, étroites comprises, les bords de la ligne à trois quarts :
     les onze colonnes et les actions tiennent dans la carte pleine largeur
     d'une fenêtre de 1024 px, sans défiler, et dans celle d'une fenêtre de
     1 366 px avec leurs en-têtes sur une ligne, un tri compris. */
  @container (max-width: 86rem) {
    th,
    td,
    th.etroite,
    td[data-champ] {
      padding-right: var(--espace-1);
      padding-left: var(--espace-1);
    }

    th:first-child,
    td:first-child {
      padding-left: var(--espace-3);
    }

    th:last-child,
    td:last-child {
      padding-right: var(--espace-3);
    }
  }

  td {
    max-width: 18rem;
    overflow-wrap: anywhere;
  }

  td[data-champ='nom'] {
    font-weight: bold;
  }

  td[data-champ='notes'] {
    color: var(--couleur-page-texte-secondaire);
  }

  .valeur {
    white-space: pre-wrap;
  }

  /* La pastille d'une donnée garde ses blancs, comme la cellule de texte :
     deux orthographes qui ne diffèrent que par eux restent distinctes. */
  .donnee-pastille {
    display: flex;
    min-width: 0;
  }

  .donnee-pastille :global(.libelle) {
    white-space: pre-wrap;
  }

  /* Les conflits d'organisation d'une personne : une pastille par
     organisation nommée, qui passent à la ligne quand la cellule est
     étroite. */
  .liste-conflits {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Les conflits du placement d'une personne : une ligne par tour, le tour
     en gras ; le tiret d'une personne sans conflit en encre secondaire. Le
     texte seul les dit : aucune teinte ne s'y ajoute. */
  .conflits-placement {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .conflits-placement .tour {
    font-weight: bold;
  }

  .sans-conflit,
  .presente,
  .presence-tous {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }

  th button {
    display: inline-flex;
    gap: var(--espace-1);
    padding: 0;
    border: none;
    background: none;
    color: var(--couleur-page-texte);
    font: inherit;
    font-weight: bold;
    cursor: pointer;
  }

  .sens {
    font-weight: normal;
  }

  /* L'en-tête d'un groupe : une ligne sur le fond sourd, un bouton qui porte
     son état en texte, le libellé du groupe en gras et son compte. */
  .groupe th {
    background-color: var(--couleur-carte-fond-sourd);
  }

  .groupe button {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--espace-2);
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  /* Le retrait d'un en-tête croît avec le niveau de son groupe, jusqu'au
     dernier niveau possible, un par colonne de GROUPEMENTS. */
  .groupe[data-niveau='2'] button {
    margin-left: var(--espace-5);
  }

  .groupe[data-niveau='3'] button {
    margin-left: calc(2 * var(--espace-5));
  }

  .groupe[data-niveau='4'] button {
    margin-left: calc(3 * var(--espace-5));
  }

  .groupe[data-niveau='5'] button {
    margin-left: calc(4 * var(--espace-5));
  }

  .groupe[data-niveau='6'] button {
    margin-left: calc(5 * var(--espace-5));
  }

  .groupe[data-niveau='7'] button {
    margin-left: calc(6 * var(--espace-5));
  }

  .groupe[data-niveau='8'] button {
    margin-left: calc(7 * var(--espace-5));
  }

  .libelle {
    font-weight: bold;
    overflow-wrap: anywhere;
  }

  .compte {
    color: var(--couleur-page-texte-secondaire);
  }

  /* La marque d'un conflit : un cadre plein, de l'encre du texte, autour
     d'un texte qui nomme le conflit ; la forme ne dépend d'aucune couleur. */
  .marque-conflit {
    display: inline-block;
    padding: 0 var(--espace-1);
    border: 2px solid var(--couleur-page-texte);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font-weight: bold;
  }

  .conflits ul {
    margin: 0;
    padding-left: var(--espace-5);
  }

  /* Les actions d'une ligne vont sur une rangée, qui passe à la ligne
     quand la colonne est étroite ; chaque action garde son libellé sur une
     ligne : un mot ne se coupe jamais entre deux lettres. */
  td:last-child {
    max-width: none;
  }

  .commandes {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-1);
  }

  .commandes > :global(button) {
    white-space: nowrap;
  }

  /* Les actions de ligne : des boutons secondaires, comme Commande. */
  .commandes > button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    cursor: pointer;
  }

  @container (max-width: 86rem) {
    .commandes > button {
      padding-right: var(--espace-2);
      padding-left: var(--espace-2);
    }
  }

  .commandes > button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  input,
  textarea {
    width: 100%;
    box-sizing: border-box;
    padding: var(--espace-1);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
  }

  input[aria-invalid='true'],
  textarea[aria-invalid='true'] {
    border-color: var(--couleur-refus);
  }

  td:focus-visible,
  button:focus-visible,
  input:focus-visible,
  textarea:focus-visible,
  table:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: -2px;
  }

  /* À partir de 80rem de place, celle de la carte d'une fenêtre de
     1 366 px, chaque en-tête tient sur une ligne — hors de celui des
     conflits du placement (replie), qui se replie toujours entre ses
     mots : sur une ligne, il ferait déborder la grille —, les quatre actions d'une
     ligne vont sur deux rangées de deux, en colonnes alignées d'une ligne à
     l'autre, un prénom ne se coupe qu'entre ses mots, et les tours nommés
     de la présence ne se coupent pas. En deçà, les en-têtes se replient
     entre leurs mots, et les actions passent à la ligne quand leur colonne
     est étroite. */
  @container (min-width: 80rem) {
    thead th:not(.replie) {
      white-space: nowrap;
    }

    .commandes {
      display: grid;
      grid-template-columns: repeat(2, minmax(max-content, 1fr));
      justify-items: start;
    }

    /* Une action refusée prend les deux colonnes, son refus toute leur
       largeur : sans largeur propre, il se replie dans la cellule, et sa
       phrase n'élargit ni la colonne ni la grille. */
    .commandes > :global(.commande:has(.refus)) {
      grid-column: 1 / -1;
      justify-self: stretch;
    }

    .commandes :global(.refus) {
      flex-basis: 100%;
      contain: inline-size;
    }

    td[data-champ='prenom'] {
      overflow-wrap: break-word;
    }

    td[data-champ='presence'] .donnee-pastille :global(.libelle) {
      white-space: nowrap;
    }
  }
</style>
