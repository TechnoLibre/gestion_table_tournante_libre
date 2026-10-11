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
  // Le panneau lit 'seance' et 'ui' au contexte ; etatTour, l'état des
  // places du tour affiché, que SectionPlan calcule, ou null sans événement.
  import { getContext } from 'svelte';
  import { effetDe } from '../raccourcis.js';
  import { nomDeCharge } from './vue_plan.js';

  let { etatTour } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const uid = $props.id();

  const charge = $derived($seance.charge);
  const tour = $derived(etatTour === null ? 1 : etatTour.tour);
  const reserve = $derived(etatTour === null ? [] : etatTour.reserve);
  const nomDe = $derived(charge === null ? null : nomDeCharge(charge));
  const choix = $derived($ui.choix);
  const choisie = (id) => choix !== null && choix.genre === 'personne' && choix.participant === id;

  function basculer(id) {
    ui.choisir(choisie(id) ? null : { genre: 'personne', participant: id, depuis: null });
  }

  function surTouche(evenement) {
    if (effetDe('plan', evenement.key) !== 'remonter' || choix === null) return;
    evenement.preventDefault();
    ui.choisir(null);
  }
</script>

<!-- Échap remonte des boutons de la réserve jusqu'à elle, qui oublie le choix. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="carte" data-reserve={tour} aria-labelledby="{uid}-titre" onkeydown={surTouche}>
  <h3 id="{uid}-titre">{t('plan.reserve.titre')}</h3>
  {#if charge !== null}
    <div class="corps">
      <p class="sous-titre">{t('plan.reserve.tour', { tour })}</p>
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
    </div>
  {/if}
</section>

<style>
  /* Le panneau est une carte : fond, filet, rayon et ombre de la carte ;
     son titre au-dessus d'un filet, son contenu en retrait. */
  .carte {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-3);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-carte);
  }

  .carte > h3 {
    margin: 0;
    padding: var(--espace-3) var(--espace-4);
    border-bottom: 1px solid var(--couleur-carte-filet);
    font-size: var(--taille-titre-carte);
  }

  .corps {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    padding: var(--espace-3) var(--espace-4);
  }

  p {
    margin: 0;
  }

  .sous-titre {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Un bouton de liste : la commande secondaire, au filet de la page. */
  li > button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    cursor: pointer;
  }

  li > button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  li > button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  /* La personne choisie se dit par aria-pressed et par sa forme : un trait
     épais et du gras, sur la teinte de l'action. */
  li > button[aria-pressed='true'] {
    border: 3px solid var(--couleur-page-texte);
    background-color: var(--couleur-action-teinte);
    font-weight: 700;
  }
</style>
