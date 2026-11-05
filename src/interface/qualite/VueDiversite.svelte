<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La vue « Diversité par animateur » (§ 12.13, B22, D38) de la page de
  // qualité. Elle reçoit le contrat de propriétés des vues — detail, le
  // détail du placement mesuré, null tant qu'il n'est pas calculé ; ligne,
  // sa ligne d'évaluation ; table, la table d'évaluation de la charge — et
  // ne lit que detail, mis en forme par modeleDiversite (animateurs.js) : la
  // vue ne calcule rien.
  //
  // Le graphique dessine la soirée, le moins varié en tête : les
  // organisations et les étiquettes rencontrées en animant, en deux colonnes
  // de barres juxtaposées, chacune son axe — une seule quand le détail n'a
  // que celle-là, et la phrase qui le dit. Au-dessus, pour chaque colonne
  // dessinée, ses trois nombres : le moins varié, le plus varié, au minimum.
  // Chaque ligne porte en encre secondaire ses tours animés et ses personnes
  // rencontrées en animant. Le jumeau porte la soirée de chaque animateur,
  // puis une ligne par tour animé ; sans colonne à dessiner, il reste seul
  // sous la phrase. Sans animateur, la vue cède la place à sa phrase.
  //
  // Désignations : data-vue-qualite sur le <div> qui enveloppe la carte, que
  // la carte ne transmet pas ; data-equite sur les trois nombres d'une
  // colonne, par sa grandeur ; data-phrase-qualite sur chaque phrase, par son
  // cas.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';
  import { modeleDiversite } from './animateurs.js';
  import Barres from './graphiques/Barres.svelte';
  import Jumeau from './graphiques/Jumeau.svelte';

  let { detail = null, ligne = null, table = null } = $props();

  const t = getContext('t');
  const format = getContext('format');
  const modele = $derived(modeleDiversite(detail, t));
</script>

<!-- Les trois nombres d'une colonne, sous son titre. -->
{#snippet troisNombres(colonne)}
  <div><dt>{t('qualite.diversite.moins')}</dt><dd>{format.nombre(colonne.moins)}</dd></div>
  <div><dt>{t('qualite.diversite.plus')}</dt><dd>{format.nombre(colonne.plus)}</dd></div>
  <div><dt>{t('qualite.diversite.auMinimum')}</dt><dd>{format.nombre(colonne.auMinimum)}</dd></div>
{/snippet}

<div data-vue-qualite="diversite">
  <Carte titre={t('qualite.vue.diversite.titre')} sousTitre={t('qualite.vue.diversite.question')} niveau={3}>
    {#if modele !== null}
      {#if modele.cas === 'aucunAnimateur'}
        <p data-phrase-qualite="diversite.aucunAnimateur">{t('qualite.diversite.aucunAnimateur')}</p>
      {:else}
        <div class="vue">
          {#if modele.phrase !== null}
            <p data-phrase-qualite="diversite.{modele.phrase}">{t(`qualite.diversite.${modele.phrase}`)}</p>
          {/if}
          {#if modele.equite.length > 0}
            <div class="equite">
              {#each modele.equite as colonne (colonne.genre)}
                <div class="colonne">
                  <p class="titre">{colonne.titre}</p>
                  {#if colonne.genre === 'organisations'}
                    <dl data-equite="organisations">{@render troisNombres(colonne)}</dl>
                  {:else}
                    <dl data-equite="etiquettes">{@render troisNombres(colonne)}</dl>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
          {#if modele.barres !== null}
            <Barres
              graphique="diversite"
              nom={modele.barres.nom}
              synthese={modele.barres.synthese}
              lignes={modele.barres.lignes}
              colonnes={modele.barres.colonnes}
              segments={modele.barres.segments}
              infobulle={modele.infobulle}
            />
          {/if}
          <Jumeau tableaux={modele.jumeau} />
        </div>
      {/if}
    {/if}
  </Carte>
</div>

<style>
  .vue {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    min-width: 0;
  }

  p {
    margin: 0;
  }

  /* Les trois nombres de chaque colonne, côte à côte, dans l'ordre des
     colonnes du graphique. */
  .equite {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: var(--espace-2) var(--espace-5);
  }

  .titre {
    font-weight: bold;
  }

  dl {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1) var(--espace-4);
    margin: var(--espace-1) 0 0;
  }

  dl div {
    display: flex;
    gap: var(--espace-1);
  }

  dt {
    color: var(--couleur-page-texte-secondaire);
  }

  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
</style>
