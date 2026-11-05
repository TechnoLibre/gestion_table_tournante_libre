<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La vue « Animateurs rencontrés » (§ 12.13, B22, D37) de la page de
  // qualité. Elle reçoit le contrat de propriétés des vues — detail, le
  // détail du placement mesuré, null tant qu'il n'est pas calculé ; ligne,
  // sa ligne d'évaluation ; table, la table d'évaluation de la charge — et
  // ne lit que detail, mis en forme par modeleAnimateurs (animateurs.js) :
  // la vue ne calcule rien.
  //
  // Un profil trié de m(p), sur les personnes concernées, de la moins servie
  // à la mieux servie : une seule série, et la borne des animateurs B(p) en
  // repère pointillé, sous ce nom. Ni manque ni pourcentage : la borne ne se
  // garantit pas (§ 4.5). Puis le jumeau, le profil et la répartition de
  // m(p). Sans animateur ou sans personne concernée, la vue cède la place à
  // sa phrase.
  //
  // Désignations : data-vue-qualite sur le <div> qui enveloppe la carte, que
  // la carte ne transmet pas ; data-phrase-qualite sur la phrase, par son
  // cas.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';
  import { modeleAnimateurs } from './animateurs.js';
  import Escalier from './graphiques/Escalier.svelte';
  import Jumeau from './graphiques/Jumeau.svelte';

  let { detail = null, ligne = null, table = null } = $props();

  const t = getContext('t');
  const modele = $derived(modeleAnimateurs(detail, t));
</script>

<div data-vue-qualite="animateurs">
  <Carte titre={t('qualite.vue.animateurs.titre')} sousTitre={t('qualite.vue.animateurs.question')} niveau={3}>
    {#if modele !== null}
      {#if modele.cas === 'aucun'}
        <p data-phrase-qualite="animateurs.aucun">{t('qualite.animateurs.aucun')}</p>
      {:else}
        <div class="vue">
          <Escalier
            graphique="animateurs"
            nom={modele.escalier.nom}
            synthese={modele.escalier.synthese}
            series={modele.escalier.series}
            reperes={modele.escalier.reperes}
            infobulle={modele.infobulle}
          />
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
</style>
