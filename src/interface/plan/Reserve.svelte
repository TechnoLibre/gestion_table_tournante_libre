<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La réserve visible (§ 7.1, § 5.8) : les personnes en attente au tour
  // affiché, celles de l'état des places (EtatPlaces.reserve, A5) — avant
  // toute proposition, chaque personne qu'aucune réservation n'assied à ce
  // tour —, par identifiant croissant. Chacune est un bouton
  // [data-participant] qui en fait la personne choisie (ui.choix), puis
  // l'oublie ; aria-pressed dit la personne choisie. Aucun glisser ne part
  // d'une liste vers le plan : la place se choisit ensuite sur le plan. Un
  // changement de tour change la liste et oublie le choix (etat_ui.js) ;
  // Échap, sur la réserve ou l'un de ses boutons, l'oublie aussi.
  // Le panneau lit 'seance' et 'ui' au contexte, sans propriété.
  import { getContext } from 'svelte';
  import { etatPlaces } from '../../application/places.js';
  import { nomDeCharge, tourAffiche } from './vue_plan.js';

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const uid = $props.id();

  const charge = $derived($seance.charge);
  const tour = $derived(charge === null ? 1 : tourAffiche($ui.tour, charge.evenement.tours));
  const reserve = $derived(charge === null ? [] : etatPlaces(charge, { tour, proposition: $ui.proposition }).reserve);
  const nomDe = $derived(charge === null ? null : nomDeCharge(charge));
  const choix = $derived($ui.choix);
  const choisie = (id) => choix !== null && choix.genre === 'personne' && choix.participant === id;

  function basculer(id) {
    ui.choisir(choisie(id) ? null : { genre: 'personne', participant: id, depuis: null });
  }

  function surTouche(evenement) {
    if (evenement.key !== 'Escape' || choix === null) return;
    evenement.preventDefault();
    ui.choisir(null);
  }
</script>

<!-- Échap remonte des boutons de la réserve jusqu'à elle, qui oublie le choix. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section data-reserve={tour} aria-labelledby="{uid}-titre" onkeydown={surTouche}>
  <h3 id="{uid}-titre">{t('plan.reserve.titre')}</h3>
  {#if charge !== null}
    <p>{t('plan.reserve.tour', { tour })}</p>
    {#if reserve.length === 0}
      <p>{t('plan.reserve.vide')}</p>
    {:else}
      <ul>
        {#each reserve as id (id)}
          <li>
            <button type="button" data-participant={id} aria-pressed={choisie(id)} onclick={() => basculer(id)}>{nomDe(id)}</button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    font-size: var(--taille-texte);
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* La personne choisie se dit par aria-pressed et par sa forme : un trait
     épais et du gras. */
  button[aria-pressed='true'] {
    border-width: 3px;
    font-weight: 700;
  }
</style>
