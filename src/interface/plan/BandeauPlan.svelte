<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le bandeau du plan (§ 7.5), au-dessus du <svg data-plan> et dans la
  // surface de travail de l'événement : vide tant qu'une table au moins est saine ; quand toutes
  // sont en conflit, la phrase, puis ce que le diagnostic prouve — chaque
  // entrée {cle, details} du modèle (modele.js), traduite. L'appartenance
  // d'un plancher de groupe est une donnée : elle occupe son propre nœud,
  // avant le texte. Le bandeau d'application garde la version, la
  // provenance et le mode.
  //
  // Il se lit comme un avis : fond, filet et trait de gauche de l'avis, et
  // son signe, le triangle, de la marque de l'avis ; le texte garde l'encre
  // de la page.
  import { getContext } from 'svelte';
  import Icone from '../primitives/Icone.svelte';

  let { bandeau } = $props();

  const t = getContext('t');
</script>

{#if bandeau.length > 0}
  <div class="bandeau-plan" data-bandeau-plan role="status">
    <span class="signe"><Icone nom="triangle" /></span><ul>
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
    display: flex;
    align-items: flex-start;
    gap: var(--espace-2);
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-avis-filet);
    border-left: 3px solid var(--couleur-avis);
    border-radius: var(--rayon-2);
    background: var(--couleur-avis-fond);
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte);
  }

  /* Le signe : la hauteur d'une ligne, centré sur elle. */
  .signe {
    display: inline-flex;
    flex: none;
    align-items: center;
    height: calc(var(--police-interligne) * 1em);
    color: var(--couleur-avis-marque);
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
