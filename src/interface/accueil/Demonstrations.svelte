<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Les démonstrations (§ 15), une issue toujours offerte du premier écran :
  // une commande par démonstration reçue, dans leur ordre, qui porte son nom
  // — une donnée, dans son propre nœud — et data-demonstration, sa clé.
  // Charger crée un événement neuf, numéroté, ouvert en lecture ; aucun
  // autre n'est touché. Le refus d'un chargement s'affiche sous sa commande.
  //
  // demonstrations : [{ cle, nom }] ; charger(cle) : le geste de l'accueil ;
  // refus : { cle, refus } du dernier échec, ou null.
  //
  // Un chargement en cours ne se relance pas : tant que charger n'a pas
  // rendu la main, un clic sur une démonstration ne fait rien, et celle qui
  // se charge porte aria-busy et aria-disabled.
  import { getContext } from 'svelte';
  import Refus from '../primitives/Refus.svelte';

  let { demonstrations, charger, refus } = $props();

  const t = getContext('t');
  const uid = $props.id();

  // La clé de la démonstration qui se charge, ou null.
  let enCours = $state(null);

  async function choisir(cle) {
    if (enCours !== null) return;
    enCours = cle;
    try {
      await charger(cle);
    } finally {
      enCours = null;
    }
  }
</script>

<section class="demonstrations" aria-labelledby={`${uid}-titre`}>
  <h2 id={`${uid}-titre`}>{t('accueil.demonstrations.titre')}</h2>
  <p>{t('accueil.demonstrations.explication')}</p>
  <ul>
    {#each demonstrations as { cle, nom } (cle)}
      <li>
        <button
          type="button"
          data-demonstration={cle}
          aria-busy={enCours === cle ? 'true' : undefined}
          aria-disabled={enCours === cle ? 'true' : undefined}
          onclick={() => choisir(cle)}>{nom}</button
        >
        {#if refus !== null && refus.cle === cle}
          <Refus refus={refus.refus} />
        {/if}
      </li>
    {/each}
  </ul>
</section>

<style>
  .demonstrations,
  ul {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  h2,
  p {
    margin: 0;
  }

  h2 {
    font-size: var(--taille-titre);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
  }

  button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
    text-align: start;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  button[aria-disabled='true'] {
    border-style: dashed;
    color: var(--couleur-page-texte-secondaire);
    cursor: progress;
  }
</style>
