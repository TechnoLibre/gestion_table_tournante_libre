<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le pied d'une feuille imprimée (§ 11.7, § 18.6) : ses cinq éléments —
  // nom de l'événement, date, tour, horodatage du placement, version —, dans
  // l'ordre que rend feuilleDe (modele.js). Chaque élément pose son libellé
  // traduit, puis sa donnée dans son propre nœud : le nom et la version
  // tels quels, la date et l'horodatage mis en forme par format. Les
  // éléments se suivent sur une ligne et passent à la suivante quand la
  // largeur manque : un nom d'événement long replie, il ne se tronque pas.
  import { getContext } from 'svelte';

  let { elements } = $props();

  const t = getContext('t');
  const format = getContext('format');

  // La donnée d'un élément, dans sa forme.
  function donnee({ donnee: valeur, forme }) {
    if (forme === 'date') return format.date(valeur);
    if (forme === 'horodatage') return format.horodatage(valeur);
    return valeur;
  }
</script>

<footer class="pied" data-pied>
  {#each elements as element (element.element)}
    <span class="element">
      {#if element.libelle !== null}
        <span>{t(element.libelle.cle, element.libelle.details)}</span>
      {/if}
      {#if element.donnee !== null}
        <span class="donnee">{donnee(element)}</span>
      {/if}
    </span>
  {/each}
</footer>

<style>
  .pied {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    gap: var(--espace-1) var(--espace-4);
    padding-top: var(--espace-2);
    border-top: 1px solid var(--couleur-page-filet);
    font-size: var(--taille-texte-petit);
    overflow-wrap: anywhere;
  }

  .element {
    display: inline-flex;
    flex-wrap: wrap;
    gap: var(--espace-1);
    min-width: 0;
  }

  .donnee {
    font-weight: bold;
  }
</style>
