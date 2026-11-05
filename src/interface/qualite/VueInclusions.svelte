<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La vue « Inclusions » (§ 12.15) de la page de qualité. Elle reçoit le
  // contrat de propriétés des vues — detail, le détail du placement mesuré,
  // null tant qu'il n'est pas calculé ; ligne, sa ligne d'évaluation ;
  // table, la table d'évaluation de la charge — et ne lit que detail, mis en
  // forme par modeleInclusions (inclusions.js), les noms lus sur la charge
  // de la séance, exclues comprises : la vue ne calcule rien.
  //
  // La synthèse, puis trois listes, chacune sous son intertitre. Les
  // inclusions non satisfaites d'abord, une phrase par avis, à place fixe,
  // « Aucune. » quand il n'y en a pas. Puis, quand il y en a, les listes
  // au-delà du plafond, chacune avec ses inclusions satisfaites, ses
  // atteignables et celles qui restent possibles sans être atteintes, puis
  // les inclusions hors d'atteinte avec leur raison, chacune sous la phrase
  // qui dit qu'elle n'est pas un avis. Sans inclusion active, la vue cède la
  // place à sa phrase, suivie des inclusions hors d'atteinte quand les
  // listes en portent. Chaque liste porte le nom de son intertitre
  // (aria-labelledby).
  //
  // Désignations : data-vue-qualite sur le <div> qui enveloppe la carte, que
  // la carte ne transmet pas ; data-phrase-qualite sur la phrase, par son
  // cas ; data-liste-inclusions sur chaque liste, par son genre.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';
  import { nomDe } from '../propositions/modele.js';
  import { modeleInclusions } from './inclusions.js';
  import PhraseInclusion from './PhraseInclusion.svelte';

  let { detail = null, ligne = null, table = null } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const charge = $derived($seance.charge);
  const modele = $derived(modeleInclusions(detail, (id) => nomDe(charge, id)));
  const uid = $props.id();
</script>

{#snippet horsDAtteinte(inclusions)}
  <h4 id="{uid}-horsDAtteinte">{t('qualite.inclusions.horsDAtteinte')}</h4>
  <p class="secondaire">{t('qualite.inclusions.horsDAtteinte.explication')}</p>
  <ul data-liste-inclusions="horsDAtteinte" aria-labelledby="{uid}-horsDAtteinte">
    {#each inclusions as inclusion, rang (rang)}
      <li><PhraseInclusion avis={inclusion} raison={inclusion.raison} /></li>
    {/each}
  </ul>
{/snippet}

<div data-vue-qualite="inclusions">
  <Carte titre={t('qualite.vue.inclusions.titre')} sousTitre={t('qualite.vue.inclusions.question')} niveau={3}>
    {#if modele !== null}
      {#if modele.cas === 'aucun' && modele.horsDAtteinte.length === 0}
        <p data-phrase-qualite="inclusions.aucun">{t('qualite.inclusions.aucun')}</p>
      {:else if modele.cas === 'aucun'}
        <div class="vue">
          <p data-phrase-qualite="inclusions.aucun.horsDAtteinte">{t('qualite.inclusions.aucun.horsDAtteinte')}</p>
          {@render horsDAtteinte(modele.horsDAtteinte)}
        </div>
      {:else}
        <div class="vue">
          <p data-phrase-qualite="inclusions.synthese">{t('qualite.inclusions.synthese', modele.synthese)}</p>
          <h4 id="{uid}-avis">{t('qualite.inclusions.nonSatisfaites')}</h4>
          {#if modele.avis.length === 0}
            <p>{t('qualite.inclusions.aucunAvis')}</p>
          {:else}
            <ul data-liste-inclusions="avis" aria-labelledby="{uid}-avis">
              {#each modele.avis as avis, rang (rang)}
                <li><PhraseInclusion {avis} /></li>
              {/each}
            </ul>
          {/if}
          {#if modele.auDela.length > 0}
            <h4 id="{uid}-auDela">{t('qualite.inclusions.auDela')}</h4>
            <p class="secondaire">{t('qualite.inclusions.auDela.explication')}</p>
            <ul data-liste-inclusions="auDela" aria-labelledby="{uid}-auDela">
              {#each modele.auDela as personne (personne.id)}
                <li><span class="donnee">{personne.nom}</span><span>{t('qualite.inclusions.auDela.ligne', personne)}</span></li>
              {/each}
            </ul>
          {/if}
          {#if modele.horsDAtteinte.length > 0}
            {@render horsDAtteinte(modele.horsDAtteinte)}
          {/if}
        </div>
      {/if}
    {/if}
  </Carte>
</div>

<style>
  .vue {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    min-width: 0;
  }

  p {
    margin: 0;
  }

  /* Un intertitre en petites capitales, d'encre secondaire, comme ceux des
     listes de travail du plan. */
  h4 {
    margin: var(--espace-2) 0 0;
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  .secondaire {
    color: var(--couleur-page-texte-secondaire);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .donnee {
    white-space: pre-wrap;
  }
</style>
