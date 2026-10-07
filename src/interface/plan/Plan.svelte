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
  import { getContext } from 'svelte';
  import { etatPlaces } from '../../application/places.js';
  import { ajuster as vueAjustee, transformDe } from '../../geometrie/vue.js';
  import BandeauPlan from './BandeauPlan.svelte';
  import BarreVue from './BarreVue.svelte';
  import EchellePlan from './EchellePlan.svelte';
  import { modeleDessin } from './modele.js';
  import PlanDessin from './PlanDessin.svelte';
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

  const charge = $derived($seance.charge);
  const tours = $derived(charge.evenement.tours);
  const tour = $derived(tourAffiche($ui.tour, tours));
  const etat = $derived(etatPlaces(charge, { tour, proposition: $ui.proposition }));
  const englobantPlan = $derived(englobantDuTour(etat));
  const nomDe = $derived(nomDeCharge(charge));
  const modele = $derived(
    vue === null
      ? null
      : modeleDessin(etat, { k: vue.k, listes: $ui.listes, miseEnEvidence: $ui.miseEnEvidence, nomDe, diagnostic }),
  );

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
</script>

<div class="plan">
  <BarreVue {tour} {tours} {zoomer} {ajuster} />
  <div class="surface" data-surface>
    <BandeauPlan bandeau={modele === null ? [] : modele.bandeau} />
    <svg class="dessin" data-plan aria-label={t('plan.vue.dessin')} bind:this={racine}>
      <g data-vue transform={vue === null ? undefined : transformDe(vue)}>
        {#if modele !== null}
          <PlanDessin {modele} />
        {/if}
      </g>
    </svg>
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
  }
</style>
