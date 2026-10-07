<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le bandeau du plan (§ 7.5), au-dessus du <svg data-plan> et dans le
  // cadre de mode : vide tant qu'une table au moins est saine ; quand toutes
  // sont en conflit, la phrase, puis ce que le diagnostic prouve — chaque
  // entrée {cle, details} du modèle (modele.js), traduite. L'appartenance
  // d'un plancher de groupe est une donnée : elle occupe son propre nœud,
  // avant le texte. Le bandeau d'application garde la version, la
  // provenance et le mode.
  import { getContext } from 'svelte';

  let { bandeau } = $props();

  const t = getContext('t');
</script>

{#if bandeau.length > 0}
  <div class="bandeau-plan" data-bandeau-plan role="status">
    <ul>
      {#each bandeau as entree, rang (rang)}
        <li>
          {#if entree.details.groupe !== undefined}<span class="donnee">{entree.details.groupe}</span>{/if}<span
            >{t(entree.cle, entree.details)}</span
          >
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .bandeau-plan {
    padding: var(--espace-2) var(--espace-3);
    border-left: 4px solid var(--couleur-avis);
    background: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }

  .donnee {
    font-weight: 700;
  }
</style>
