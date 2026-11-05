<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Le tableau « Personnes présentes par tour » (§ 6.1) : une ligne par
  // tour, ses personnes présentes, ses places et ses places manquantes, lus
  // dans lignesPresences (presences.js), qui recopie capaciteParTour. Il ne
  // se montre que lorsqu'une personne non exclue manque un tour : sans
  // absence, le modèle rend null et rien n'est dans le DOM. Un manque
  // positif se pose dans une pastille d'avis, son signe et son nombre de
  // l'encre de la page ; un manque nul s'écrit seul. Chaque ligne se nomme
  // par le nom de son tour, ou par son numéro pour un tour sans nom.
  import { getContext } from 'svelte';
  import { nomsDesTours } from '../../application/tours.js';
  import Pastille from '../primitives/Pastille.svelte';
  import { lignesPresences } from './presences.js';

  let { charge } = $props();

  const t = getContext('t');

  const lignes = $derived(lignesPresences(charge));
  const nomsTours = $derived(nomsDesTours(charge));
</script>

{#if lignes !== null}
  <table class="presences" data-presences-tours>
    <caption>{t('tables.presences.titre')}</caption>
    <thead>
      <tr>
        <th scope="col">{t('tables.presences.colonne.tour')}</th>
        <th scope="col" class="nombre">{t('tables.presences.colonne.presentes')}</th>
        <th scope="col" class="nombre">{t('tables.presences.colonne.places')}</th>
        <th scope="col" class="nombre">{t('tables.presences.colonne.manque')}</th>
      </tr>
    </thead>
    <tbody>
      {#each lignes as ligne (ligne.tour)}
        <tr data-presences-tour={ligne.tour}>
          <th scope="row">{t('tables.presences.ligne', { tour: ligne.tour, nomsTours })}</th>
          <td class="nombre">{ligne.presentes}</td>
          <td class="nombre">{ligne.places}</td>
          <td class="nombre">
            {#if ligne.ton === 'avis'}
              <Pastille sorte="statut" valeur="avis" icone="triangle" libelle={ligne.manque} />
            {:else}
              {ligne.manque}
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<style>
  .presences {
    max-width: 40rem;
    border-collapse: collapse;
  }

  caption {
    padding-bottom: var(--espace-1);
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-align: left;
    text-transform: uppercase;
  }

  th,
  td {
    padding: var(--espace-1) var(--espace-3);
    border-bottom: 1px solid var(--couleur-ligne-filet);
    text-align: start;
    vertical-align: middle;
  }

  thead th {
    font-size: var(--taille-texte-petit);
    font-weight: bold;
    vertical-align: bottom;
  }

  .nombre {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
