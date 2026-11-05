<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Le plan de salle et sa vue (§ 7.2, § 7.3, § 7.5, § 7.7, § 8.4, § 8.5) :
  // la barre de vue, la légende des conflits quand elle est ouverte — les
  // règles que les réglages cochent, et le conflit d'organisation quand la
  // table d'évaluation le dit avec un objet (legendeConflits) —, puis la
  // surface [data-surface] qui porte le bandeau du plan, le <svg data-plan>
  // et l'échelle graphique. Ouvrir la légende change la taille du cadre, que
  // le ResizeObserver relit comme tout autre changement. Le <svg> racine n'a
  // ni viewBox, ni bordure, ni remplissage : son unité est le pixel CSS, et
  // le dessin vit dans un seul groupe <g data-vue>, dont l'attribut
  // transform est la vue, {k, tx, ty}. Un zoom n'écrit que cet attribut sous
  // la racine ; l'échelle et le bandeau, hors du <svg>, gardent leur taille
  // à l'écran.
  //
  // Le composant est le seul à calculer le modèle de dessin (modele.js), de
  // l'état des places du tour montré, au k de sa vue. La vue est null tant
  // qu'aucun cadre ne la permet — plan monté caché, cadre où kAjuste vaut
  // null — : rien ne se dessine alors, et le groupe ne porte pas de
  // transform. Un ResizeObserver sur la racine relit le cadre à chaque
  // changement de taille : tant que la vue est null, il la calcule par
  // vueInitiale, du cadrage que la séance a mémorisé ; ensuite par
  // vueApresCadre. Ni l'une ni l'autre ne s'écrit : seul un geste de
  // l'opérateur — molette, « Zoom + », « Zoom − », « Ajuster » — confie sa
  // vue à seance.demanderCadrage, qui l'écrit, différée, dans
  // reglages_locaux.json, jamais dans l'événement.
  //
  // Le cadre se relit au moment du geste, par getBoundingClientRect de la
  // racine : un défilement de la page le déplace sans changer sa taille.
  // Les écouteurs se posent sur la racine par addEventListener — Svelte 5
  // délègue au conteneur de montage un gestionnaire déclaré dans le
  // gabarit —, celui de la molette non passif, pour que la page ne défile
  // pas sous un zoom. touch-action: none sur la racine et la surface : le
  // navigateur ne prend aucun glissement du doigt pour un défilement.
  //
  // diagnostic : celui que rend diagnostiquer, que SectionPlan passe, ou
  // null — le bandeau ne porte alors que la phrase des conflits (§ 7.5).
  // etatTour : l'état des places du tour affiché (EtatPlaces, places.js), que
  // SectionPlan calcule pour le plan et les panneaux.
  //
  // Les gestes du pointeur (§ 7.1, § 7.3, § 8.4) passent par un seul
  // écouteur de chaque type, sur la racine : pointerdown identifie la source
  // — poignée, chaise, table, sinon le sol — par closest, relit le cadre, et
  // la machine de gestes.js capture le pointeur sur la racine ; les
  // mouvements se regroupent par image (requestAnimationFrame) et ne lisent
  // aucune mise en page ; pointerup achève, par au plus une commande de la
  // séance ; pointercancel, Échap — écouté sur document, en phase de
  // capture, le temps du geste — et le passage en lecture (surAnnulation)
  // restaurent. Pendant un geste, la molette ne zoome pas : le geste se
  // juge sur la vue de l'appui. Pendant le glissement, le composant écrit
  // l'attribut transform directement — groupe de la vue, groupe d'une table
  // et ses frères, fantôme — et ne confie le résultat au modèle qu'au relâcher :
  // aucun élément capturant n'est remplacé. La poignée passe son nombre au
  // modèle de dessin (option poignee), sans rien écrire. Un refus — du
  // dépôt, du contrôle de la poignée, de la commande — se pose sur la place
  // par RefusPlace, hors du <svg>, et la place le désigne par
  // aria-describedby ; l'appui suivant le retire. Tant que la commande d'un
  // geste n'est pas réglée, un appui ne saisit que le sol.
  //
  // La pose — refus ou avertissements sur une place — vit dans l'état de
  // navigation (ui.pose) : un panneau latéral y pose le refus d'une commande
  // de place, que le plan montre comme celui d'un geste. Son remède
  // choisirPlace (PLACE_RESERVEE) fait de la réservation qui tient la place
  // le choix en attente (ui.choix). Une commande d'un geste exécutée oublie
  // le choix en attente.
  //
  // Le clavier (§ 7.3, § 13.5) : la racine est le seul arrêt de tabulation
  // du plan — tabindex 0, un role, un aria-label — et désigne l'élément
  // actif, une table ou un siège, par aria-activedescendant, sur les id que
  // TablePlan pose. Les touches passent par toucheDuPlan (clavier.js) :
  // flèches, entrée, échappement. L'entrée sur un siège le sélectionne et
  // porte le focus au panneau de la place ; en régime table, elle ouvre le
  // panneau de la table et porte le focus sur la liste de ses sièges. Le
  // panneau rend le focus à la racine par Échap. Échap sur la racine oublie
  // le choix en attente, quel que soit l'élément actif. L'élément actif suit
  // la place sélectionnée. Une flèche, un focus venu du clavier et une
  // sélection venue d'ailleurs que du pointeur — un panneau, une liste de
  // travail — amènent l'élément actif dans le cadre (vueQuiMontre) ; la
  // sélection d'un appui sur le plan ne déplace pas la vue : la chaise
  // cliquée reste sous le pointeur.
  // La marque focus ne se montre que sous un focus venu du clavier
  // (:focus-visible, puis toute touche) : un clic n'en pose pas.
  //
  // L'infobulle (§ 7.1, § 7.3) : un seul [role=tooltip], ouvert sur une table
  // en conflit par le survol — un pointermove de la racine sans bouton
  // enfoncé, hors d'un geste —, par le focus du clavier sur la table ou l'un
  // de ses sièges, et par la pression longue d'un doigt, minuterie de
  // l'horloge de DUREE_PRESSION_LONGUE_MS, annulée au relâcher, à
  // l'annulation, ou quand la machine du geste juge l'appui devenu
  // glissement, au-delà du seuil. Elle reste ouverte jusqu'à l'appui
  // suivant.
  import { getContext, tick, untrack } from 'svelte';
  import { controlerCapacite } from '../../application/capacite.js';
  import { constante } from '../../geometrie/constantes.js';
  import { ajuster as vueAjustee, ecranDepuisDessin, transformDe } from '../../geometrie/vue.js';
  import { evaluation } from '../propositions/modele.js';
  import { effetDe } from '../raccourcis.js';
  import BandeauPlan from './BandeauPlan.svelte';
  import BarreVue from './BarreVue.svelte';
  import { toucheDuPlan, vueQuiMontre } from './clavier.js';
  import { deposer, designerAuPoint, reservationTenue } from './depot.js';
  import EchellePlan from './EchellePlan.svelte';
  import Fantome from './Fantome.svelte';
  import { REPOS, cleFantome, geste, memoriser } from './gestes.js';
  import Infobulle from './Infobulle.svelte';
  import Legende from './Legende.svelte';
  import { detailConflits, legendeConflits, modeleDessin } from './modele.js';
  import PlanDessin from './PlanDessin.svelte';
  import RefusPlace from './RefusPlace.svelte';
  import {
    organisationDeCharge,
    cadreDepuisRect,
    englobantDuTour,
    evidenceDe,
    nomDeCharge,
    sourceMontree,
    vueApresCadre,
    vueInitiale,
    zoomerBouton,
    zoomerMolette,
  } from './vue_plan.js';

  let { diagnostic = null, etatTour } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const horloge = getContext('horloge');

  const DUREE_PRESSION = constante('DUREE_PRESSION_LONGUE_MS');

  let racine = $state(null);
  let vue = $state.raw(null);
  let surface = $state(null);
  let groupeVue = $state(null);
  let elementFantome = $state(null);
  // Le nombre que la poignée tirée montre, {table, places}, ou null.
  let poignee = $state.raw(null);
  // Le fantôme montré, {nom, cle}, ou null.
  let fantome = $state.raw(null);
  // Le coin du <svg> dans la surface, en cadre dont le bord gauche et le
  // haut sont relatifs à la surface : relu à chaque changement de cadre et à
  // chaque appui, jamais dans un pointermove. C'est aussi la zone où
  // l'infobulle et le refus posé sur une place se tiennent.
  let origineSvg = $state.raw({ gauche: 0, haut: 0, largeur: 0, hauteur: 0 });
  // L'élément actif du clavier, {table, siege|null}, ou null ; la racine a
  // le focus ; le focus vient du clavier.
  let actif = $state.raw(null);
  let aLeFocus = $state(false);
  let auClavier = $state(false);
  // Les tables que désignent le survol et la pression longue, ou null.
  let survol = $state(null);
  let pression = $state(null);

  const prefixe = $props.id();
  const idPose = `${prefixe}-pose`;
  const idInfobulle = `${prefixe}-infobulle`;
  const idLegende = `${prefixe}-legende`;

  // La légende des conflits, ouverte ou non : un état de la vue, que le
  // bouton de la barre bascule ; rien ne s'écrit.
  let legendeOuverte = $state(false);

  const charge = $derived($seance.charge);
  const tours = $derived(charge.evenement.tours);
  const etat = $derived(etatTour);
  const tour = $derived(etat.tour);
  const englobantPlan = $derived(englobantDuTour(etat));
  const nomDe = $derived(nomDeCharge(charge));
  const organisationDe = $derived(organisationDeCharge(charge));
  // Les règles actives, que la légende montre : celles que les réglages
  // cochent, et le conflit d'organisation quand la table d'évaluation de la
  // charge le dit avec un objet.
  const legende = $derived(legendeConflits(charge.reglages, evaluation(charge).table?.criteres ?? []));
  const selection = $derived($ui.selection);
  const pose = $derived($ui.pose);
  // Le placement que le plan montre, que la barre de vue nomme.
  const source = $derived(sourceMontree(etat, $ui.proposition, charge.retenu !== null));
  // La personne mise en évidence, que la barre de vue nomme (evidenceDe) :
  // {id, nom, absente}, nom null pour une personne que la charge n'a plus,
  // absente vrai quand elle est absente au tour montré ; null sans mise en
  // évidence.
  const evidence = $derived($ui.miseEnEvidence === null ? null : evidenceDe($ui.miseEnEvidence, nomDe, etat));
  // L'élément actif que le dessin marque : sous un focus venu du clavier.
  const actifMontre = $derived(aLeFocus && auClavier ? actif : null);
  const modele = $derived(
    vue === null
      ? null
      : modeleDessin(etat, {
          k: vue.k,
          listes: $ui.listes,
          miseEnEvidence: $ui.miseEnEvidence,
          nomDe,
          diagnostic,
          poignee,
          selection,
          actif: actifMontre,
        }),
  );
  // La pose à sa position dans la surface, sous la vue courante ; rien pour
  // une place dont la table n'est plus dessinée.
  const poseAffichee = $derived.by(() => {
    if (pose === null || vue === null || modele === null) return null;
    const { place, refus, avertissements } = pose;
    const ancre = ancreDe(place);
    if (ancre === null) return null;
    const { x, y } = ecranDepuisDessin(vue, origineSvg, ancre.x, ancre.y);
    const numero = etat.tables.find(({ id }) => id === place.table)?.numero ?? null;
    return { id: idPose, numero, siege: place.siege ?? null, refus, avertissements, x, y };
  });
  // L'infobulle : la table que désignent la pression longue, le survol, puis
  // l'élément actif sous un focus venu du clavier ; rien quand elle n'a pas
  // de conflit. Posée au coin haut droit de l'emprise ; xRepli, le bord
  // gauche de l'emprise, où finit l'infobulle passée à gauche (placerBulle).
  const infobulleTable = $derived(pression ?? survol ?? (actifMontre === null ? null : actifMontre.table));
  const infobulle = $derived.by(() => {
    if (infobulleTable === null || vue === null || modele === null) return null;
    const etatTable = etat.tables.find(({ id }) => id === infobulleTable);
    const dessin = modele.tables.find(({ id }) => id === infobulleTable);
    if (etatTable === undefined || dessin === undefined) return null;
    const detail = detailConflits(etatTable, nomDe, organisationDe);
    if (detail === null) return null;
    const { centre, rayonEmprise } = dessin.geometrie;
    const { x, y } = ecranDepuisDessin(vue, origineSvg, centre.x + rayonEmprise, centre.y - rayonEmprise);
    const xRepli = ecranDepuisDessin(vue, origineSvg, centre.x - rayonEmprise, centre.y).x;
    return { detail, x, y, xRepli };
  });
  const infobulleDuFocus = $derived(infobulle !== null && pression === null && survol === null);

  // Le cadre de la racine, relu maintenant.
  const cadreCourant = () => cadreDepuisRect(racine.getBoundingClientRect());

  // Pose la vue d'un geste de l'opérateur et la confie à la séance ; une
  // vue null — rien à zoomer dans ce cadre — ne change rien.
  function poserVue(suivante) {
    if (suivante === null) return;
    vue = suivante;
    seance.demanderCadrage(suivante);
  }

  function zoomer(sens) {
    poserVue(zoomerBouton(vue, englobantPlan, cadreCourant(), sens));
  }

  function ajuster() {
    poserVue(vueAjustee(englobantPlan, cadreCourant()));
  }

  // --- Les gestes du pointeur ---------------------------------------------------

  // L'état d'une table du tour montré.
  const tableDeEtat = (id) => etat.tables.find((table) => table.id === id);

  // La source d'un appui, lue sur l'élément pressé et sur l'état des places.
  function sourceDe(element) {
    const saisie = element.closest('[data-poignee]');
    if (saisie !== null) {
      const table = Number(saisie.dataset.poignee);
      return { genre: 'poignee', table, siege: null, participant: null, places: tableDeEtat(table).capacite };
    }
    const chaise = element.closest('[data-siege]');
    if (chaise !== null) {
      const [table, siege] = chaise.dataset.siege.split(':').map(Number);
      const participant = tableDeEtat(table).chaises[siege - 1]?.occupant ?? null;
      return { genre: 'personne', table, siege, participant };
    }
    const groupe = element.closest('[data-table]');
    if (groupe !== null) {
      const table = Number(groupe.dataset.table);
      const { x, y } = tableDeEtat(table).position;
      return { genre: 'table', table, siege: null, participant: null, position: { x, y } };
    }
    return { genre: 'sol', table: null, siege: null, participant: null };
  }

  // Les éléments qu'un glissement de table déplace : son groupe, et ses
  // frères désignés par son identifiant.
  const elementsDeTable = (table) =>
    racine.querySelectorAll(`[data-table="${table}"], [data-poignee="${table}"], [data-pastille="${table}"], [data-liste="${table}"]`);

  // L'élément d'une place : la chaise, ou la table quand la place n'a pas
  // de siège ou que sa chaise n'est pas dessinée.
  function elementDePlace({ table, siege = null }) {
    const chaise = siege === null ? null : racine.querySelector(`[data-siege="${table}:${siege}"]`);
    return chaise ?? racine.querySelector(`[data-table="${table}"]`);
  }

  // Le point de dessin d'une place : le centre de sa chaise, ou de sa
  // table ; null pour une table que le dessin n'a pas.
  function ancreDe({ table, siege = null }) {
    const dessin = modele.tables.find(({ id }) => id === table);
    if (dessin === undefined) return null;
    const { geometrie } = dessin;
    const chaise = siege === null ? undefined : geometrie.chaises[siege - 1];
    return chaise === undefined ? { ...geometrie.centre } : { x: chaise.x, y: chaise.y };
  }

  // Relit le coin du <svg> dans la surface, du cadre relu à l'instant.
  function relireOrigine(cadre) {
    const rect = surface.getBoundingClientRect();
    origineSvg = { gauche: cadre.gauche - rect.left, haut: cadre.haut - rect.top, largeur: cadre.largeur, hauteur: cadre.hauteur };
  }

  // Pose un refus et des avertissements sur une place ; rien des deux
  // retire la pose.
  function poserSurPlace(place, refus, avertissements) {
    ui.poserSurPlace(refus === null && avertissements.length === 0 ? null : { place, refus, avertissements });
  }

  const fermerPose = () => {
    ui.poserSurPlace(null);
  };

  // Les gestes qu'un remède posé sur une place emprunte au plan : choisir
  // une place pour la réservation qui tient la place refusée (PLACE_RESERVEE,
  // { geste: 'choisirPlace', puis }) — elle devient le choix en attente, et
  // « Déplacer la réservation ici » la déplace (PanneauPlace).
  const gestesPose = {
    choisirPlace: (remede) => {
      const place = ui.etat().pose?.place ?? null;
      const { participant, de } = remede.puis.arguments;
      ui.choisir({
        genre: 'reservation',
        participant,
        depuis: place === null ? null : { table: place.table, siege: place.siege ?? null },
        de,
      });
      return true;
    },
  };

  // Amène une place dans le cadre, k inchangé ; la vue ne change que si la
  // place en sort.
  function montrer(place) {
    if (place === null || vue === null || modele === null) return;
    const ancre = ancreDe(place);
    if (ancre === null) return;
    const suivante = vueQuiMontre(vue, cadreCourant(), ancre);
    if (suivante !== vue) poserVue(suivante);
  }

  // Porte le focus à un panneau latéral de la section : à son élément
  // [data-focus-initial], sinon au panneau.
  async function focaliserPanneau(genre) {
    await tick();
    const section = racine.closest('[data-section]') ?? document;
    const panneau = section.querySelector(`[data-panneau="${genre}"]`);
    if (panneau === null) return;
    (panneau.querySelector('[data-focus-initial]') ?? panneau).focus();
  }

  // Le contexte de toucheDuPlan : les géométries dessinées, leur régime et
  // leur nombre de chaises.
  function contexteClavier() {
    const dessin = (id) => modele.tables.find((table) => table.id === id);
    return {
      geometries: modele.tables.map(({ geometrie }) => geometrie),
      regimeDe: (id) => dessin(id).regime,
      capaciteDe: (id) => dessin(id).geometrie.chaises.length,
    };
  }

  // L'élément actif qu'annonce aria-activedescendant : le siège quand sa
  // chaise est dessinée, sa table sinon.
  const activeDescendant = $derived.by(() => {
    if (actif === null || modele === null) return undefined;
    const dessin = modele.tables.find(({ id }) => id === actif.table);
    if (dessin === undefined) return undefined;
    if (actif.siege !== null && dessin.chaises.some(({ siege }) => siege === actif.siege)) return `siege-${actif.table}-${actif.siege}`;
    return `table-${actif.table}`;
  });

  // L'élément actif suit la place sélectionnée ; une sélection nouvelle
  // vient dans le cadre, sauf celle d'un appui du pointeur, que l'effet
  // selectionner d'un geste désigne ici par l'objet même qu'il confie à
  // ui.selectionner. La sélection du montage ne déplace pas la vue.
  let selectionSuivie = untrack(() => selection);
  let selectionDuPointeur = null;
  $effect(() => {
    const place = selection;
    if (place === selectionSuivie) return;
    selectionSuivie = place;
    const duPointeur = place !== null && place === selectionDuPointeur;
    selectionDuPointeur = null;
    if (place === null) return;
    untrack(() => {
      actif = { table: place.table, siege: place.siege ?? null };
      if (!duPointeur) montrer(actif);
    });
  });

  // Restaure ce qu'un geste a montré.
  function restaurer(cible) {
    if (cible === 'vue') groupeVue.setAttribute('transform', transformDe(vue));
    else if (cible === 'fantome') {
      fantome = null;
      elementFantome.removeAttribute('transform');
    } else if (cible.genre === 'table') {
      for (const element of elementsDeTable(cible.table)) element.removeAttribute('transform');
    } else poignee = null;
  }

  // Vrai de l'envoi de la commande d'un geste à son règlement, la cible
  // apres restaurée. La séance ne publie la charge qu'une fois l'écriture
  // faite : jusque-là, l'état des places et les positions que lirait un
  // nouvel appui sont ceux d'avant la commande, et la restauration de apres
  // retirerait le transform d'un second glissement de la même table.
  let commandeEnCours = false;

  // Vrai de l'appui d'un geste à son relâcher ou à son annulation : la
  // machine juge le geste entier sur la vue relevée à l'appui, et la
  // molette ne zoome pas pendant ce temps — le point du relâcher se
  // convertirait dans un autre repère que celui où le fantôme le montre.
  let gesteEnCours = false;

  // Confie la commande d'un geste à la séance ; un refus se pose sur la
  // place. La cible apres se restaure une fois la charge rendue : la table
  // se dessine alors à sa nouvelle position, ou revient.
  async function executerGeste({ commande, arguments: args, place, apres }) {
    commandeEnCours = true;
    try {
      await seance.executer(commande, args);
      ui.choisir(null);
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      poserSurPlace(place, { code: erreur.code, details: erreur.details ?? {} }, []);
    } finally {
      try {
        if (apres !== null) {
          await tick();
          restaurer(apres);
        }
      } finally {
        commandeEnCours = false;
      }
    }
  }

  $effect(() => {
    const element = racine;
    // La vue d'un changement de cadre : la vue initiale tant qu'il n'y en a
    // pas, sinon la vue gardée dans les bornes du nouveau cadre. Elle se
    // calcule à l'image suivante, sur le cadre relu alors : ce qu'elle fait
    // paraître dans la surface — l'échelle, le bandeau — ne change pas le
    // cadre pendant la livraison des observations de taille, et plusieurs
    // changements d'une même image n'en font qu'un.
    let image = null;
    const recadrer = () => {
      image = null;
      const cadre = cadreCourant();
      relireOrigine(cadre);
      vue = vue === null ? vueInitiale(seance.cadrage(), englobantPlan, cadre) : vueApresCadre(vue, englobantPlan, cadre);
    };
    const observateur = new ResizeObserver(() => {
      if (image === null) image = requestAnimationFrame(recadrer);
    });
    const surMolette = (evenement) => {
      evenement.preventDefault();
      if (gesteEnCours) return;
      poserVue(zoomerMolette(vue, englobantPlan, cadreCourant(), evenement));
    };
    observateur.observe(element);
    element.addEventListener('wheel', surMolette, { passive: false });
    return () => {
      observateur.disconnect();
      if (image !== null) cancelAnimationFrame(image);
      element.removeEventListener('wheel', surMolette);
    };
  });

  $effect(() => {
    const element = racine;
    let etatGeste = REPOS;
    let contexte = null;
    // La minuterie de la pression longue, armée par l'appui d'un doigt.
    let minuteriePression = null;
    const oublierPression = () => {
      if (minuteriePression !== null) horloge.annuler(minuteriePression);
      minuteriePression = null;
    };
    // Le dernier point d'un mouvement en attente de son image.
    let image = null;
    let enAttente = null;

    const oublierImage = () => {
      if (image !== null) cancelAnimationFrame(image);
      image = null;
      enAttente = null;
    };

    // Applique un pas de la machine : son état, puis chaque effet.
    function appliquer({ etat: suivant, effets }) {
      const pointeur = etatGeste.pointeur;
      etatGeste = suivant;
      gesteEnCours = suivant.phase !== 'repos';
      // Un appui devenu glissement — au-delà du seuil, que la machine juge —
      // n'est plus une pression longue.
      if (suivant.phase === 'glisse') oublierPression();
      for (const effet of effets) {
        switch (effet.type) {
          case 'capturer':
            element.setPointerCapture(effet.pointeur);
            document.addEventListener('keydown', surTouche, true);
            break;
          case 'debuterGeste':
            seance.debuterGeste();
            break;
          case 'finirGeste':
            oublierImage();
            document.removeEventListener('keydown', surTouche, true);
            if (element.hasPointerCapture(pointeur)) element.releasePointerCapture(pointeur);
            seance.finirGeste();
            break;
          case 'ecrireTransform':
            if (effet.cible === 'vue') groupeVue.setAttribute('transform', effet.transform);
            else if (effet.cible === 'fantome') elementFantome.setAttribute('transform', effet.transform);
            else for (const cible of elementsDeTable(effet.cible.table)) cible.setAttribute('transform', effet.transform);
            break;
          case 'montrerFantome':
            fantome = {
              nom: nomDe(effet.participant),
              cle: cleFantome(etat.cible, reservationTenue(etat, effet.participant, effet.depuis)?.portee ?? null, effet.surLeSol),
            };
            break;
          case 'montrerPlaces':
            poignee = { table: effet.table, places: effet.places };
            poserSurPlace({ table: effet.table }, ui.etat().pose?.refus ?? null, effet.avertissements);
            break;
          case 'montrerRefus':
            poserSurPlace(effet.place, effet.refus, ui.etat().pose?.avertissements ?? []);
            break;
          case 'restaurer':
            restaurer(effet.cible);
            break;
          case 'poserVue':
            poserVue(effet.vue);
            break;
          case 'selectionner':
            selectionDuPointeur = effet.place;
            ui.selectionner(effet.place);
            break;
          case 'executer':
            executerGeste(effet);
            break;
          default:
            throw new TypeError(`effet de geste inconnu : ${JSON.stringify(effet.type)}`);
        }
      }
    }

    const annulerGeste = (cause) => {
      if (etatGeste.phase !== 'repos') appliquer(geste(etatGeste, { type: 'annuler', cause }, contexte));
    };

    function surTouche(evenement) {
      if (effetDe('geste', evenement.key) !== 'annuler' || etatGeste.phase === 'repos') return;
      evenement.stopPropagation();
      evenement.preventDefault();
      annulerGeste('echap');
    }

    // Un appui au repos, du bouton principal, sur un plan dessiné. Tant
    // qu'une commande d'un geste n'est pas réglée, seul le sol se saisit :
    // le déplacement de vue ne lit ni la charge ni l'état des places.
    const surAppui = (evenement) => {
      auClavier = false;
      if (etatGeste.phase !== 'repos' || evenement.button !== 0 || vue === null || modele === null) return;
      const source = sourceDe(evenement.target);
      if (commandeEnCours && source.genre !== 'sol') return;
      const cadre = cadreCourant();
      relireOrigine(cadre);
      ui.poserSurPlace(null);
      survol = null;
      pression = null;
      oublierPression();
      // Un doigt posé sur une table : sa pression longue ouvre l'infobulle.
      if (evenement.pointerType === 'touch' && source.table !== null) {
        const table = source.table;
        minuteriePression = horloge.planifier(() => {
          minuteriePression = null;
          pression = table;
        }, DUREE_PRESSION);
      }
      // La charge, l'état, les géométries et k du moment de l'appui : le
      // geste se juge sur eux jusqu'à son terme.
      const chargeDuGeste = charge;
      const etatDuGeste = etat;
      const geometries = modele.tables.map((table) => table.geometrie);
      const k = vue.k;
      contexte = {
        controlerPlaces: memoriser((table, places) => controlerCapacite(chargeDuGeste, table, places, { origine: 'poignee' })),
        deposer: (source, point) =>
          deposer({
            etatPlaces: etatDuGeste,
            tour: etatDuGeste.tour,
            personne: source.participant,
            depuis: { table: source.table, siege: source.siege },
            point,
            geometries,
            k,
          }),
        surLeSol: (point) => designerAuPoint(point, geometries, k).surLeSol,
      };
      const point = { x: evenement.clientX, y: evenement.clientY };
      appliquer(geste(etatGeste, { type: 'presser', source, pointeur: evenement.pointerId, point, vue, cadre }, contexte));
    };

    const livrer = () => {
      image = null;
      const point = enAttente;
      enAttente = null;
      if (point !== null && etatGeste.phase !== 'repos') {
        appliquer(geste(etatGeste, { type: 'bouger', pointeur: etatGeste.pointeur, point }, contexte));
      }
    };

    const surMouvement = (evenement) => {
      if (etatGeste.phase === 'repos') {
        // Le survol : une souris ou un stylet sans bouton enfoncé.
        if (evenement.pointerType !== 'touch' && evenement.buttons === 0) {
          const groupe = evenement.target.closest('[data-table]');
          survol = groupe === null ? null : Number(groupe.dataset.table);
        }
        return;
      }
      if (evenement.pointerId !== etatGeste.pointeur) return;
      enAttente = { x: evenement.clientX, y: evenement.clientY };
      if (image === null) image = requestAnimationFrame(livrer);
    };

    const surRelache = (evenement) => {
      if (etatGeste.phase === 'repos' || evenement.pointerId !== etatGeste.pointeur) return;
      oublierPression();
      oublierImage();
      const point = { x: evenement.clientX, y: evenement.clientY };
      appliquer(geste(etatGeste, { type: 'relacher', pointeur: evenement.pointerId, point }, contexte));
    };

    const surAnnulationPointeur = (evenement) => {
      oublierPression();
      if (etatGeste.phase !== 'repos' && evenement.pointerId === etatGeste.pointeur) annulerGeste('pointercancel');
    };

    // La sortie du pointeur et la perte du focus arrivent aussi pendant
    // qu'un bloc démonte le plan — Chromium retire le focus d'un élément
    // qu'on détache — : l'état change hors du suivi des dépendances.
    const surSortie = () => {
      untrack(() => {
        survol = null;
      });
    };

    // Le focus de la racine. Venu du clavier, il active la sélection, sinon
    // la première table, quand rien n'est actif, et amène l'élément actif
    // dans le cadre. Un appui, qui donne aussi le focus, n'écrit rien sous
    // la racine et ne déplace pas la vue : la première touche activera.
    const surFocus = () => {
      aLeFocus = true;
      auClavier = element.matches(':focus-visible');
      if (!auClavier || modele === null || modele.tables.length === 0) return;
      const existe = actif !== null && modele.tables.some(({ id }) => id === actif.table);
      if (!existe) {
        const place = selection ?? { table: modele.tables[0].id, siege: null };
        actif = { table: place.table, siege: place.siege ?? null };
      }
      if (etatGeste.phase === 'repos') montrer(actif);
    };
    const surPerteFocus = () => {
      untrack(() => {
        aLeFocus = false;
      });
    };

    // Une touche sur la racine, hors d'un geste : Échap d'un geste en cours
    // passe d'abord par surTouche, en phase de capture. Échap d'un siège
    // remonte à sa table et garde la personne choisie : c'est le seul chemin
    // du clavier vers une autre table. Échap sur une table, ou sans élément
    // actif, l'oublie.
    const surToucheClavier = (evenement) => {
      if (etatGeste.phase !== 'repos' || modele === null || evenement.altKey || evenement.ctrlKey || evenement.metaKey) return;
      auClavier = true;
      const rendu = toucheDuPlan(actif, evenement.key, contexteClavier());
      if (effetDe('plan', evenement.key) === 'remonter' && (rendu === null || rendu.effet !== null)) ui.choisir(null);
      if (rendu === null) return;
      evenement.preventDefault();
      actif = rendu.actif;
      const { effet } = rendu;
      if (effet === null) {
        montrer(actif);
      } else if (effet.type === 'selectionner') {
        ui.selectionner(effet.place);
        focaliserPanneau('place');
      } else if (effet.type === 'ouvrirTable') {
        ui.selectionner({ table: effet.table });
        focaliserPanneau('table');
      } else {
        ui.poserSurPlace(null);
        ui.selectionner(null);
      }
    };

    const desabonner = seance.surAnnulation(() => annulerGeste('lecture'));
    element.addEventListener('pointerdown', surAppui);
    element.addEventListener('pointermove', surMouvement);
    element.addEventListener('pointerup', surRelache);
    element.addEventListener('pointercancel', surAnnulationPointeur);
    element.addEventListener('pointerleave', surSortie);
    element.addEventListener('focus', surFocus);
    element.addEventListener('blur', surPerteFocus);
    element.addEventListener('keydown', surToucheClavier);
    return () => {
      desabonner();
      oublierPression();
      element.removeEventListener('pointerleave', surSortie);
      element.removeEventListener('focus', surFocus);
      element.removeEventListener('blur', surPerteFocus);
      element.removeEventListener('keydown', surToucheClavier);
      element.removeEventListener('pointerdown', surAppui);
      element.removeEventListener('pointermove', surMouvement);
      element.removeEventListener('pointerup', surRelache);
      element.removeEventListener('pointercancel', surAnnulationPointeur);
      oublierImage();
      document.removeEventListener('keydown', surTouche, true);
      if (etatGeste.phase !== 'repos') seance.finirGeste();
      gesteEnCours = false;
    };
  });

  // La place qui porte la pose la désigne par aria-describedby ; l'effet
  // suit le modèle, qui peut redessiner la chaise.
  $effect(() => {
    if (poseAffichee === null || modele === null) return;
    const element = elementDePlace(pose.place);
    if (element === null) return;
    element.setAttribute('aria-describedby', idPose);
    return () => element.removeAttribute('aria-describedby');
  });
</script>

<div class="plan">
  <BarreVue
    {tour}
    {tours}
    {zoomer}
    {ajuster}
    {evidence}
    {source}
    legende={legendeOuverte}
    basculerLegende={() => (legendeOuverte = !legendeOuverte)}
    {idLegende}
  />
  {#if legendeOuverte}
    <Legende entrees={legende} id={idLegende} />
  {/if}
  <div class="surface" data-surface bind:this={surface}>
    <BandeauPlan bandeau={modele === null ? [] : modele.bandeau} />
    <!-- Le plan est un composant interactif à deux dimensions, que le
         clavier parcourt par aria-activedescendant : role="application",
         que le compilateur range parmi les rôles non interactifs. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <svg
      class="dessin"
      data-plan
      tabindex="0"
      role="application"
      aria-roledescription={t('plan.vue.role')}
      aria-label={t('plan.vue.dessin')}
      aria-activedescendant={activeDescendant}
      aria-describedby={infobulleDuFocus ? idInfobulle : undefined}
      bind:this={racine}
    >
      <g data-vue transform={vue === null ? undefined : transformDe(vue)} bind:this={groupeVue}>
        {#if modele !== null}
          <PlanDessin {modele} />
        {/if}
      </g>
      <Fantome {fantome} bind:element={elementFantome} />
    </svg>
    {#if poseAffichee !== null}
      <RefusPlace pose={poseAffichee} zone={origineSvg} fermer={fermerPose} gestes={gestesPose} />
    {/if}
    <Infobulle {infobulle} zone={origineSvg} id={idInfobulle} />
    <!-- L'échelle occupe sa place avant que la vue n'existe, cachée : sa
         venue ne change pas le cadre du dessin. -->
    <div class="pied" class:cache={vue === null}>
      <EchellePlan k={vue === null ? 1 : vue.k} />
    </div>
  </div>
</div>

<style>
  .plan {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--espace-2);
    min-width: 0;
    min-height: 0;
  }

  .surface {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--espace-2);
    min-height: 0;
    touch-action: none;
  }

  .pied.cache {
    visibility: hidden;
  }

  /* Ni bordure, ni remplissage, ni viewBox : un pixel CSS du <svg> est un
     pixel de l'écran, et le cadre est sa boîte (§ 7.2). */
  .dessin {
    display: block;
    flex: 1 1 0;
    width: 100%;
    min-height: 0;
    margin: 0;
    border: 0;
    padding: 0;
    overflow: hidden;
    touch-action: none;
    user-select: none;
  }

  /* Un focus venu du clavier se voit sur la racine, contour tracé en
     dedans : un contour ne change pas la boîte du cadre. L'élément actif
     porte en plus la marque focus. */
  .dessin:focus {
    outline: none;
  }

  .dessin:focus-visible {
    outline: 3px solid var(--couleur-focus);
    outline-offset: -3px;
  }
</style>
