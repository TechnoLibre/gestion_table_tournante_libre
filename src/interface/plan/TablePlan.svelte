<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<svelte:options namespace="svg" />

<script>
  // Une table du plan (§ 7.1, § 7.3, § 7.5, § 7.6) : le groupe [data-table],
  // qui ne porte que le plateau et les chaises, avec les marques posées sur
  // eux ; puis, frères du groupe, la poignée [data-poignee] et la pastille
  // [data-pastille]. Tout vient de la TableDessin du modèle (modele.js) ; le
  // composant ne calcule rien.
  //
  // En régime table, les chaises ne se dessinent pas : l'emprise entière se
  // peint au fond de la chaise et devient la seule cible, sous le plateau.
  // En régime sièges, chaque chaise est un groupe [data-siege="table:siège"]
  // dont seul le disque reçoit le pointeur : ses marques, comme la pastille,
  // ont pointer-events: none, et la cible d'une chaise est le disque même que
  // la désignation lit (designation.js).
  //
  // Une table en conflit, quand le plan signale, porte un contour épaissi
  // (contourConflit) et une trame (trameConflit) par-dessus son plateau ; sa
  // pastille porte le nombre de violations, signalée ou non (§ 7.5).
  import { getContext } from 'svelte';
  import { RAYON_POIGNEE } from '../../geometrie/tables.js';
  import {
    CADENAS_FERME,
    CADENAS_OUVERT,
    ECART_ANNEAU,
    ECART_MISE_EN_EVIDENCE,
    RAYON_PASTILLE,
    TAILLE_TEXTE_PASTILLE_CM,
    TRACE_GEL,
    formesTable,
  } from './modele.js';

  let { table, signaler, prefixe } = $props();

  const t = getContext('t');

  // La marque que porte le disque d'une chaise, selon son remplissage.
  const MARQUE_DU_REMPLISSAGE = { normal: 'contourChaise', plein: 'remplissagePlein', hachure: 'hachure' };
  const TRACE_DU_CADENAS = { cadenasFerme: CADENAS_FERME, cadenasOuvert: CADENAS_OUVERT };

  const formes = $derived(formesTable(table.geometrie));
  const poignee = $derived(table.geometrie.poignee);
  const signal = $derived(signaler && table.conflit);
  const hachure = $derived(`url(#${prefixe}-hachure)`);
  const trame = $derived(`url(#${prefixe}-trame)`);
</script>

<g data-table={table.id} role="group" aria-label={t(table.nomAccessible.cle, table.nomAccessible.details)}>
  {#if table.regime === 'table'}
    {#if formes.ronde}
      <circle class="emprise" data-marque="contourChaise" {...formes.emprise} />
    {:else}
      <rect class="emprise" data-marque="contourChaise" {...formes.emprise} />
    {/if}
  {/if}
  {#if formes.ronde}
    <circle class="plateau" class:conflit={signal} data-marque={signal ? 'contourConflit' : 'contourTable'} {...formes.plateau} />
  {:else}
    <rect class="plateau" class:conflit={signal} data-marque={signal ? 'contourConflit' : 'contourTable'} {...formes.plateau} />
  {/if}
  {#if signal}
    {#if formes.ronde}
      <circle class="trame" data-marque="trameConflit" fill={trame} {...formes.plateau} />
    {:else}
      <rect class="trame" data-marque="trameConflit" fill={trame} {...formes.plateau} />
    {/if}
  {/if}
  {#if table.gelee}
    <path class="gel" data-marque="gel" d={TRACE_GEL} transform="translate({formes.gel.x},{formes.gel.y})" />
  {/if}
  {#each table.chaises as chaise (chaise.siege)}
    <g data-siege="{table.id}:{chaise.siege}">
      <circle
        class="chaise"
        class:pleine={chaise.remplissage === 'plein'}
        data-marque={MARQUE_DU_REMPLISSAGE[chaise.remplissage]}
        style:fill={chaise.remplissage === 'hachure' ? hachure : null}
        cx={chaise.x}
        cy={chaise.y}
        r={chaise.rayon}
      />
      {#each chaise.marques as marque (marque)}
        {#if marque === 'anneau'}
          <circle class="anneau" data-marque="anneau" cx={chaise.x} cy={chaise.y} r={chaise.rayon + ECART_ANNEAU} />
        {:else}
          <path class="cadenas" data-marque={marque} d={TRACE_DU_CADENAS[marque]} transform="translate({chaise.x},{chaise.y})" />
        {/if}
      {/each}
      {#if chaise.miseEnEvidence}
        <circle class="evidence" data-marque="miseEnEvidence" cx={chaise.x} cy={chaise.y} r={chaise.rayon + ECART_MISE_EN_EVIDENCE} />
      {/if}
    </g>
  {/each}
</g>
<circle class="poignee" data-poignee={table.id} data-marque="poignee" cx={poignee.x} cy={poignee.y} r={RAYON_POIGNEE} />
{#if table.pastille > 0}
  <g class="pastille" data-pastille={table.id}>
    <circle class="disque" data-marque="pastille" cx={formes.pastille.x} cy={formes.pastille.y} r={RAYON_PASTILLE} />
    <text
      class="nombre"
      x={formes.pastille.x}
      y={formes.pastille.y}
      font-size={TAILLE_TEXTE_PASTILLE_CM}
      text-anchor="middle"
      dominant-baseline="central">{table.pastille}</text>
  </g>
{/if}

<style>
  /* Les traits gardent leur épaisseur à l'écran, à tout zoom (§ 7.2). */
  .emprise,
  .plateau,
  .chaise,
  .poignee {
    vector-effect: non-scaling-stroke;
    stroke-width: 1.5;
  }

  .emprise {
    fill: var(--couleur-chaise-fond);
    stroke: var(--couleur-chaise-trait);
  }

  .plateau {
    fill: var(--couleur-table-fond);
    stroke: var(--couleur-table-trait);
  }

  .plateau.conflit {
    stroke: var(--couleur-conflit);
    stroke-width: 4;
  }

  .trame {
    stroke: none;
    pointer-events: none;
  }

  .gel {
    fill: var(--couleur-gel);
    pointer-events: none;
  }

  .chaise {
    fill: var(--couleur-chaise-fond);
    stroke: var(--couleur-chaise-trait);
  }

  .chaise.pleine {
    fill: var(--couleur-chaise-pleine);
  }

  .anneau {
    fill: none;
    stroke: var(--couleur-marque);
    stroke-width: 4;
    pointer-events: none;
  }

  .cadenas {
    fill: var(--couleur-marque);
    pointer-events: none;
  }

  .evidence {
    fill: none;
    stroke: var(--couleur-mise-en-evidence);
    stroke-width: 4;
    pointer-events: none;
  }

  .poignee {
    fill: var(--couleur-poignee);
    stroke: var(--couleur-poignee);
  }

  .pastille {
    pointer-events: none;
  }

  .disque {
    fill: var(--couleur-pastille-fond);
  }

  .nombre {
    fill: var(--couleur-pastille-texte);
    font-family: var(--police-interface);
    font-weight: 700;
  }
</style>
