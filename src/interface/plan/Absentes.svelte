<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La carte « Absentes » (§ 7.1), sous la réserve : les personnes absentes
  // au tour affiché, que l'état des places nomme (EtatPlaces.absents), dans
  // son ordre, chacune suivie de sa présence (absentesDuTour). Elles n'ont
  // ni chaise ni place en réserve. Chacune est un bouton [data-participant]
  // qui ouvre sa fiche (ui.ouvrirFiche), le lieu où sa présence se change ;
  // il n'a pas d'aria-pressed : une absente ne se choisit pas pour être
  // placée. La carte est une carte à part, section[data-absentes={tour}],
  // et non une partie de la réserve, dont chaque bouton choisit une
  // personne ; elle n'est pas dans le DOM quand le tour n'a pas d'absente.
  // Le panneau lit 'seance' et 'ui' au contexte ; etatTour, l'état des
  // places du tour affiché, que SectionPlan calcule, ou null sans événement.
  import { getContext } from 'svelte';
  import { absentesDuTour } from './absentes.js';

  let { etatTour } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const uid = $props.id();

  const charge = $derived($seance.charge);
  const absentes = $derived(etatTour === null || charge === null ? [] : absentesDuTour(etatTour, charge));
</script>

{#if absentes.length > 0}
  <section class="carte" data-absentes={etatTour.tour} aria-labelledby="{uid}-titre">
    <h3 id="{uid}-titre">{t('plan.absentes.titre')}</h3>
    <div class="corps">
      <p class="sous-titre">{t('plan.absentes.tour', { tour: etatTour.tour })}</p>
      <ul>
        {#each absentes as { id, nom, presence } (id)}
          <li>
            <button type="button" data-participant={id} onclick={() => ui.ouvrirFiche(id)}
              ><span class="donnee">{nom}</span><span>{t('plan.absentes.presente', { tours: presence })}</span></button
            >
          </li>
        {/each}
      </ul>
    </div>
  </section>
{/if}

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
    flex-direction: column;
    gap: var(--espace-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Un bouton de liste : la commande secondaire, au filet de la page, sur
     toute la largeur, le nom puis sa présence. */
  li > button {
    width: 100%;
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  li > button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  li > button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
