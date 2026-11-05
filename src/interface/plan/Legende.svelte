<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La légende des conflits du plan (§ 7.5, § 12.7) : pour chaque règle
  // active, un échantillon dessiné en SVG — un plateau au contour épaissi,
  // couvert de la trame de la règle, de la forme et de la teinte que le plan
  // peint, tirée des mêmes motifs (Motifs.svelte) — et son nom, suivi du nom
  // de sa forme ; puis la pastille et ce qu'elle compte. Une règle inactive
  // n'y paraît pas ; sans règle active, la légende le dit.
  //
  // entrees : celles de legendeConflits (modele.js), dans l'ordre du moteur ;
  // id : l'identifiant que le bouton de la barre de vue désigne par
  // aria-controls. Les motifs se définissent dans un <svg> sans taille,
  // propre à la légende : leurs identifiants portent son préfixe, et les
  // échantillons les désignent. Les tailles des échantillons sont en px.
  import { getContext } from 'svelte';
  import Motifs from './Motifs.svelte';

  let { entrees, id = undefined } = $props();

  const t = getContext('t');
  const prefixe = $props.id();

  // Le centre et le rayon du plateau d'un échantillon, et le rayon de la
  // pastille, en px.
  const CENTRE = 20;
  const RAYON = 16;
  const RAYON_PASTILLE = 12;
</script>

<section class="legende" data-legende {id} aria-labelledby="{prefixe}-titre">
  <svg class="motifs" width="0" height="0" aria-hidden="true"><Motifs {prefixe} /></svg>
  <h3 id="{prefixe}-titre">{t('plan.legende.titre')}</h3>
  {#if entrees.length === 0}
    <p>{t('plan.legende.aucune')}</p>
  {/if}
  <ul>
    {#each entrees as entree (entree.regle)}
      <li data-legende-regle={entree.regle}>
        <svg class="echantillon" width={2 * CENTRE} height={2 * CENTRE} aria-hidden="true">
          <circle class="plateau" data-marque="contourConflit" cx={CENTRE} cy={CENTRE} r={RAYON} />
          <circle class="trame" data-marque={entree.marque} fill="url(#{prefixe}-trame-{entree.regle})" cx={CENTRE} cy={CENTRE} r={RAYON} />
        </svg>
        <span>{t(entree.cle)}</span>
        <span>{t(entree.cleForme)}</span>
      </li>
    {/each}
    <li data-legende-pastille>
      <svg class="echantillon" width={2 * CENTRE} height={2 * CENTRE} aria-hidden="true">
        <circle class="disque" data-marque="pastille" cx={CENTRE} cy={CENTRE} r={RAYON_PASTILLE} />
        <text class="nombre" x={CENTRE} y={CENTRE} text-anchor="middle" dominant-baseline="central">{t('plan.legende.pastilleExemple')}</text>
      </svg>
      <span>{t('plan.legende.pastille')}</span>
    </li>
  </ul>
  {#if entrees.length > 1}
    <p>{t('plan.legende.superposition')}</p>
  {/if}
</section>

<style>
  /* Une carte : fond et filet de la carte ; les échantillons gardent le
     dessin du plan. */
  .legende {
    padding: var(--espace-3) var(--espace-4);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-3);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-carte);
  }

  .motifs {
    position: absolute;
    overflow: hidden;
  }

  h3 {
    margin: 0 0 var(--espace-2);
    font-size: var(--taille-titre-carte);
  }

  p {
    margin: var(--espace-2) 0 0;
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2) var(--espace-5);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--espace-1);
  }

  .echantillon {
    flex: none;
  }

  /* Le plateau de l'échantillon : le fond et le contour épaissi d'une table
     en conflit, sous la trame. */
  .plateau {
    fill: var(--couleur-table-fond);
    stroke: var(--couleur-contour-fort);
    stroke-width: 3;
  }

  .trame {
    stroke: none;
  }

  .disque {
    fill: var(--couleur-pastille-fond);
  }

  .nombre {
    fill: var(--couleur-pastille-texte);
    font-family: var(--police-interface);
    font-size: var(--taille-texte-petit);
    font-weight: 700;
  }
</style>
