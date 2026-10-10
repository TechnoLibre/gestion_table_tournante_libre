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
  // dont la cible reçoit le pointeur : un disque sans peinture, de rayon
  // rayonCible — max(RAYON_CHAISE, pas / 2), le disque même que la
  // désignation lit (designation.js) —, dernier enfant du groupe, au-dessus
  // de la chaise et de ses marques ; les marques, comme la pastille, ont
  // pointer-events: none. La cible ne porte aucune marque et ne peint rien :
  // le premier disque du groupe reste la chaise.
  //
  // Une table en conflit, quand le plan signale, porte un contour épaissi
  // (contourConflit), commun aux trois règles, et, par-dessus son plateau,
  // une trame par règle violée (table.trames, dans l'ordre du moteur) : la
  // forme et la teinte de sa sorte (CONFLITS, Motifs.svelte), superposées
  // quand elle en viole plusieurs. Sa pastille porte le nombre de
  // violations, signalée ou non (§ 7.5). Sur les trames, un socle
  // [data-socle] du fond du plateau, centré sous la pastille, la sépare de
  // leurs traits : la pastille se mesure contre le fond du plateau (§ 14.5),
  // et les trames restent peintes autour. Le socle précède la marque de gel,
  // qui se peint sur lui.
  //
  // Le groupe de la table porte id="table-<id>", celui d'une chaise
  // id="siege-<table>-<siège>" : la racine du plan, seul arrêt de tabulation,
  // désigne l'élément actif par aria-activedescendant (§ 7.3, § 13.5). Une
  // chaise a pour nom accessible sa ligne entière (texteLigne). La place
  // sélectionnée porte la marque selection, un anneau en tirets ; l'élément
  // actif du clavier, la marque focus, un carré : deux formes, que la
  // couleur ne porte pas seule. Sur la chaise que le modèle désigne, ou sur
  // l'emprise de la table quand la place n'a pas de chaise dessinée.
  //
  // Imprimée (impression vrai, § 11.7), la table ne reçoit aucun geste : ni
  // identifiant, ni rôle, ni nom accessible — le <svg> de la page porte le
  // sien, et son contenu est caché aux technologies d'assistance —, ni
  // poignée, ni cible. Le plateau, les chaises, les marques, les trames et
  // la pastille sont ceux de l'écran : le noir et blanc se lit par la forme.
  import { getContext } from 'svelte';
  import { RAYON_POIGNEE } from '../../geometrie/tables.js';
  import {
    CADENAS_FERME,
    CADENAS_OUVERT,
    ECART_ANNEAU,
    ECART_DESIGNATION,
    ECART_FOCUS,
    ECART_MISE_EN_EVIDENCE,
    RAYON_PASTILLE,
    RAYON_SOCLE_PASTILLE,
    TAILLE_TEXTE_PASTILLE_CM,
    TRACE_GEL,
    formesTable,
    texteLigne,
  } from './modele.js';

  let { table, signaler, prefixe, impression = false } = $props();

  const t = getContext('t');

  // La marque que porte le disque d'une chaise, selon son remplissage.
  const MARQUE_DU_REMPLISSAGE = { normal: 'contourChaise', plein: 'remplissagePlein', hachure: 'hachure' };
  const TRACE_DU_CADENAS = { cadenasFerme: CADENAS_FERME, cadenasOuvert: CADENAS_OUVERT };

  const formes = $derived(formesTable(table.geometrie));
  const poignee = $derived(table.geometrie.poignee);
  const signal = $derived(signaler && table.conflit);
  const hachure = $derived(`url(#${prefixe}-hachure)`);
  // Les marques de désignation de la table, autour de l'emprise.
  const autour = $derived(formesTable({ ...table.geometrie, rayonEmprise: table.geometrie.rayonEmprise + ECART_DESIGNATION }));
  const cadreFocus = $derived(carreAutour(table.geometrie.centre, table.geometrie.rayonEmprise + ECART_FOCUS));

  // Le carré de demi-côté demi centré sur un point, en attributs SVG.
  function carreAutour({ x, y }, demi) {
    return { x: x - demi, y: y - demi, width: 2 * demi, height: 2 * demi };
  }
</script>

<g
  id={impression ? undefined : `table-${table.id}`}
  data-table={table.id}
  role={impression ? undefined : 'group'}
  aria-label={impression ? undefined : t(table.nomAccessible.cle, table.nomAccessible.details)}
>
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
    {#each table.trames as trame (trame.regle)}
      {#if formes.ronde}
        <circle class="trame" data-marque={trame.marque} fill="url(#{prefixe}-trame-{trame.regle})" {...formes.plateau} />
      {:else}
        <rect class="trame" data-marque={trame.marque} fill="url(#{prefixe}-trame-{trame.regle})" {...formes.plateau} />
      {/if}
    {/each}
    <circle class="socle" data-socle cx={formes.pastille.x} cy={formes.pastille.y} r={RAYON_SOCLE_PASTILLE} />
  {/if}
  {#if table.gelee}
    <path class="gel" data-marque="gel" d={TRACE_GEL} transform="translate({formes.gel.x},{formes.gel.y})" />
  {/if}
  {#if table.selection}
    {#if autour.ronde}
      <circle class="selection" data-marque="selection" {...autour.emprise} />
    {:else}
      <rect class="selection" data-marque="selection" {...autour.emprise} />
    {/if}
  {/if}
  {#if table.focus}
    <rect class="focus" data-marque="focus" {...cadreFocus} />
  {/if}
  {#each table.chaises as chaise (chaise.siege)}
    <g
      id={impression ? undefined : `siege-${table.id}-${chaise.siege}`}
      data-siege="{table.id}:{chaise.siege}"
      role={impression ? undefined : 'img'}
      aria-label={impression ? undefined : texteLigne(table.lignes[chaise.siege - 1], t)}
    >
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
      {#if chaise.selection}
        <circle class="selection" data-marque="selection" cx={chaise.x} cy={chaise.y} r={chaise.rayon + ECART_DESIGNATION} />
      {/if}
      {#if chaise.focus}
        <rect class="focus" data-marque="focus" {...carreAutour(chaise, chaise.rayon + ECART_FOCUS)} />
      {/if}
      {#if !impression}
        <circle class="cible" cx={chaise.x} cy={chaise.y} r={table.geometrie.rayonCible} />
      {/if}
    </g>
  {/each}
</g>
{#if !impression}
  <circle class="poignee" data-poignee={table.id} data-marque="poignee" cx={poignee.x} cy={poignee.y} r={RAYON_POIGNEE} />
{/if}
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

  /* Le contour d'une table en conflit : épaissi, de l'encre forte du plan ;
     les teintes des règles sont sur les trames. */
  .plateau.conflit {
    stroke: var(--couleur-contour-fort);
    stroke-width: 4;
  }

  .trame {
    stroke: none;
    pointer-events: none;
  }

  .socle {
    fill: var(--couleur-table-fond);
    stroke: none;
    pointer-events: none;
  }

  .gel {
    fill: var(--couleur-gel);
    pointer-events: none;
  }

  /* La cible d'un siège : aucune peinture, le pointeur la reçoit tout de
     même. */
  .cible {
    fill: none;
    stroke: none;
    pointer-events: all;
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

  /* La sélection : un anneau en tirets ; le focus du clavier : un carré
     plein trait. Les deux gardent leur épaisseur à l'écran. */
  .selection,
  .focus {
    fill: none;
    vector-effect: non-scaling-stroke;
    stroke-width: 3;
    pointer-events: none;
  }

  .selection {
    stroke: var(--couleur-selection);
    stroke-dasharray: 6 4;
  }

  .focus {
    stroke: var(--couleur-focus);
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
