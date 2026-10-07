<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le plan de salle et sa vue (§ 7.2, § 7.3, § 7.7, § 8.4, § 8.5) : la
  // barre de vue, puis la surface [data-surface] qui porte le bandeau du
  // plan, le <svg data-plan> et l'échelle graphique. Le <svg> racine n'a ni
  // viewBox, ni bordure, ni remplissage : son unité est le pixel CSS, et le
  // dessin vit dans un seul groupe <g data-vue>, dont l'attribut transform
  // est la vue, {k, tx, ty}. Un zoom n'écrit que cet attribut sous la
  // racine ; l'échelle et le bandeau, hors du <svg>, gardent leur taille à
  // l'écran.
  //
  // Le composant est le seul à calculer le modèle de dessin (modele.js), de
  // l'état des places du tour montré, au k de sa vue. La vue est null tant
  // qu'aucun cadre ne la permet — plan monté caché, cadre où kAjuste vaut
  // null — : rien ne se dessine alors, et le groupe ne porte pas de
  // transform. Un ResizeObserver sur la racine relit le cadre à chaque
  // changement de taille : tant que la vue est null, il la calcule par
  // vueInitiale, du cadrage que la séance a mémorisé ; ensuite par
  // vueApresCadre. Ni l'une ni l'autre ne s'écrit : seul un geste de
  // l'opérateur — molette, « Zoom + », « Zoom moins », « Ajuster » — confie sa
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
  //
  // Les gestes du pointeur (§ 7.1, § 7.3, § 8.4) passent par un seul
  // écouteur de chaque type, sur la racine : pointerdown identifie la source
  // — poignée, chaise, table, sinon le sol — par closest, relit le cadre, et
  // la machine de gestes.js capture le pointeur sur la racine ; les
  // mouvements se regroupent par image (requestAnimationFrame) et ne lisent
  // aucune mise en page ; pointerup achève, par au plus une commande de la
  // séance ; pointercancel, Échap — écouté sur document, en phase de
  // capture, le temps du geste — et le passage en lecture (surAnnulation)
  // restaurent. Pendant le glissement, le composant écrit l'attribut
  // transform directement — groupe de la vue, groupe d'une table et ses
  // frères, fantôme — et ne confie le résultat au modèle qu'au relâcher :
  // aucun élément capturant n'est remplacé. La poignée passe son nombre au
  // modèle de dessin (option poignee), sans rien écrire. Un refus — du
  // dépôt, du contrôle de la poignée, de la commande — se pose sur la place
  // par RefusPlace, hors du <svg>, et la place le désigne par
  // aria-describedby ; l'appui suivant le retire. Tant que la commande d'un
  // geste n'est pas réglée, un appui ne saisit que le sol.
  import { getContext, tick } from 'svelte';
  import { controlerCapacite } from '../../application/capacite.js';
  import { etatPlaces } from '../../application/places.js';
  import { ajuster as vueAjustee, ecranDepuisDessin, transformDe } from '../../geometrie/vue.js';
  import BandeauPlan from './BandeauPlan.svelte';
  import BarreVue from './BarreVue.svelte';
  import { deposer } from './depot.js';
  import EchellePlan from './EchellePlan.svelte';
  import Fantome from './Fantome.svelte';
  import { REPOS, cleFantome, geste, memoriser } from './gestes.js';
  import { modeleDessin } from './modele.js';
  import PlanDessin from './PlanDessin.svelte';
  import RefusPlace from './RefusPlace.svelte';
  import {
    cadreDepuisRect,
    englobantDuTour,
    nomDeCharge,
    tourAffiche,
    vueApresCadre,
    vueInitiale,
    zoomerBouton,
    zoomerMolette,
  } from './vue_plan.js';

  let { diagnostic = null } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');

  let racine = $state(null);
  let vue = $state.raw(null);
  let surface = $state(null);
  let groupeVue = $state(null);
  let elementFantome = $state(null);
  // Le nombre que la poignée tirée montre, {table, places}, ou null.
  let poignee = $state.raw(null);
  // Le fantôme montré, {nom, cle}, ou null.
  let fantome = $state.raw(null);
  // Le refus ou les avertissements posés sur une place : {place, refus,
  // avertissements, ancre — le point de dessin de la place, cm —, origine —
  // le coin du <svg> dans la surface, px —}, ou null.
  let pose = $state.raw(null);

  const prefixe = $props.id();
  const idPose = `${prefixe}-pose`;

  const charge = $derived($seance.charge);
  const tours = $derived(charge.evenement.tours);
  const tour = $derived(tourAffiche($ui.tour, tours));
  const etat = $derived(etatPlaces(charge, { tour, proposition: $ui.proposition }));
  const englobantPlan = $derived(englobantDuTour(etat));
  const nomDe = $derived(nomDeCharge(charge));
  const modele = $derived(
    vue === null
      ? null
      : modeleDessin(etat, { k: vue.k, listes: $ui.listes, miseEnEvidence: $ui.miseEnEvidence, nomDe, diagnostic, poignee }),
  );
  // La pose à sa position dans la surface, sous la vue courante.
  const poseAffichee = $derived.by(() => {
    if (pose === null || vue === null) return null;
    const { place, refus, avertissements, ancre, origine } = pose;
    const { x, y } = ecranDepuisDessin(vue, origine, ancre.x, ancre.y);
    const numero = etat.tables.find(({ id }) => id === place.table)?.numero ?? null;
    return { id: idPose, numero, siege: place.siege ?? null, refus, avertissements, x, y };
  });

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

  // Le point de dessin d'une place : le centre de sa chaise, ou de sa table.
  function ancreDe({ table, siege = null }) {
    const { geometrie } = modele.tables.find(({ id }) => id === table);
    const chaise = siege === null ? undefined : geometrie.chaises[siege - 1];
    return chaise === undefined ? { ...geometrie.centre } : { x: chaise.x, y: chaise.y };
  }

  // Le coin du <svg> dans la surface, relu à l'appui : un cadre dont le
  // bord gauche et le haut sont relatifs à la surface.
  let origineSurface = { gauche: 0, haut: 0, largeur: 0, hauteur: 0 };

  // Pose un refus et des avertissements sur une place ; rien des deux
  // retire la pose.
  function poserSurPlace(place, refus, avertissements) {
    if (refus === null && avertissements.length === 0) {
      pose = null;
      return;
    }
    pose = { place, refus, avertissements, ancre: ancreDe(place), origine: origineSurface };
  }

  const fermerPose = () => {
    pose = null;
  };

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

  // Confie la commande d'un geste à la séance ; un refus se pose sur la
  // place. La cible apres se restaure une fois la charge rendue : la table
  // se dessine alors à sa nouvelle position, ou revient.
  async function executerGeste({ commande, arguments: args, place, apres }) {
    commandeEnCours = true;
    try {
      await seance.executer(commande, args);
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
      vue = vue === null ? vueInitiale(seance.cadrage(), englobantPlan, cadre) : vueApresCadre(vue, englobantPlan, cadre);
    };
    const observateur = new ResizeObserver(() => {
      if (image === null) image = requestAnimationFrame(recadrer);
    });
    const surMolette = (evenement) => {
      evenement.preventDefault();
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
            fantome = { nom: nomDe(effet.participant), cle: cleFantome(etat.cible) };
            break;
          case 'montrerPlaces':
            poignee = { table: effet.table, places: effet.places };
            poserSurPlace({ table: effet.table }, pose?.refus ?? null, effet.avertissements);
            break;
          case 'montrerRefus':
            poserSurPlace(effet.place, effet.refus, pose?.avertissements ?? []);
            break;
          case 'restaurer':
            restaurer(effet.cible);
            break;
          case 'poserVue':
            poserVue(effet.vue);
            break;
          case 'selectionner':
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
      if (evenement.key !== 'Escape' || etatGeste.phase === 'repos') return;
      evenement.stopPropagation();
      evenement.preventDefault();
      annulerGeste('echap');
    }

    // Un appui au repos, du bouton principal, sur un plan dessiné. Tant
    // qu'une commande d'un geste n'est pas réglée, seul le sol se saisit :
    // le déplacement de vue ne lit ni la charge ni l'état des places.
    const surAppui = (evenement) => {
      if (etatGeste.phase !== 'repos' || evenement.button !== 0 || vue === null || modele === null) return;
      const source = sourceDe(evenement.target);
      if (commandeEnCours && source.genre !== 'sol') return;
      const cadre = cadreCourant();
      const rect = surface.getBoundingClientRect();
      origineSurface = { gauche: cadre.gauche - rect.left, haut: cadre.haut - rect.top, largeur: cadre.largeur, hauteur: cadre.hauteur };
      pose = null;
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
      if (etatGeste.phase === 'repos' || evenement.pointerId !== etatGeste.pointeur) return;
      enAttente = { x: evenement.clientX, y: evenement.clientY };
      if (image === null) image = requestAnimationFrame(livrer);
    };

    const surRelache = (evenement) => {
      if (etatGeste.phase === 'repos' || evenement.pointerId !== etatGeste.pointeur) return;
      oublierImage();
      const point = { x: evenement.clientX, y: evenement.clientY };
      appliquer(geste(etatGeste, { type: 'relacher', pointeur: evenement.pointerId, point }, contexte));
    };

    const surAnnulationPointeur = (evenement) => {
      if (etatGeste.phase !== 'repos' && evenement.pointerId === etatGeste.pointeur) annulerGeste('pointercancel');
    };

    const desabonner = seance.surAnnulation(() => annulerGeste('lecture'));
    element.addEventListener('pointerdown', surAppui);
    element.addEventListener('pointermove', surMouvement);
    element.addEventListener('pointerup', surRelache);
    element.addEventListener('pointercancel', surAnnulationPointeur);
    return () => {
      desabonner();
      element.removeEventListener('pointerdown', surAppui);
      element.removeEventListener('pointermove', surMouvement);
      element.removeEventListener('pointerup', surRelache);
      element.removeEventListener('pointercancel', surAnnulationPointeur);
      oublierImage();
      document.removeEventListener('keydown', surTouche, true);
      if (etatGeste.phase !== 'repos') seance.finirGeste();
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
  <BarreVue {tour} {tours} {zoomer} {ajuster} />
  <div class="surface" data-surface bind:this={surface}>
    <BandeauPlan bandeau={modele === null ? [] : modele.bandeau} />
    <svg class="dessin" data-plan aria-label={t('plan.vue.dessin')} bind:this={racine}>
      <g data-vue transform={vue === null ? undefined : transformDe(vue)} bind:this={groupeVue}>
        {#if modele !== null}
          <PlanDessin {modele} />
        {/if}
      </g>
      <Fantome {fantome} bind:element={elementFantome} />
    </svg>
    {#if poseAffichee !== null}
      <RefusPlace pose={poseAffichee} fermer={fermerPose} />
    {/if}
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
</style>
