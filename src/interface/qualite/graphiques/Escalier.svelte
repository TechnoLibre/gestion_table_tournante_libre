<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Un graphique à un seul axe vertical, qui part de zéro (§ 12.3, § 12.7,
  // § 12.14, D30, D49, D51), sous deux formes.
  //
  // forme 'escalier' : une ou deux séries par rang — la première en plein,
  // la seconde en tirets —, et jusqu'à deux repères — un plafond en trait
  // mixte, la règle à 100 % du même motif, une borne en pointillés —, chacun
  // en règle quand il est constant, en escalier sinon ; l'abscisse linéaire
  // des rangs. Un rang sans valeur (null) interrompt le chemin de sa série,
  // sans point ni segment. marques : une entrée par rang, null ou un genre
  // de SIGNES (pointage.js), dont le signe de forme se pose au rang, sur un
  // halo du fond de la carte qui le détache du tracé qu'il recouvre.
  //
  // forme 'points' : les petits multiples de la performance — des points aux
  // seuls points de relevé, reliés par un trait mince, sur l'abscisse
  // logarithmique des mouvements évalués (abscisses), graduée à ces points.
  //
  // series : [{libelle, valeurs, cle?}] ; reperes : [{genre, libelle,
  // valeurs}], genre plafond, borne ou cent ; libellés déjà traduits, valeurs
  // une par rang ou par point, dans l'ordre du détail : rien ne se trie ni ne
  // se recompte ici. cle, facultative, désigne la série (data-serie) — a et b
  // pour les deux placements d'une comparaison —, son genre sans elle.
  // Chaque trace porte son libellé au bout de son tracé, et la légende le
  // reprend. borneHaute : null, l'axe vertical monte à la plus grande valeur
  // tracée ; ou la borne reçue, commune aux deux séries, que le composant ne
  // calcule jamais (C20, D60, contrainte 41). graduer(v) écrit une
  // graduation de l'axe vertical, graduerX(v) une graduation de l'abscisse
  // — un rang ou des mouvements évalués —, chacun par défaut le nombre mis
  // en forme ; titreX nomme l'abscisse, null pour aucun titre, par défaut
  // celui de la forme.
  //
  // marges, liable en sortie : les marges que le graphique demande pour son
  // texte (margesVerticales, pointage.js) ; alignerSur : null, ou les marges
  // communes d'un groupe (margesCommunes) — deux graphiques empilés, ou des
  // petits multiples, qui reçoivent les mêmes alignent leur abscisse, rang
  // contre rang, point contre point (§ 12.3).
  //
  // pointe, liable : l'indice du rang ou du point pointé, null sans. Deux
  // graphiques empilés qui le lient au même état — le profil en comptes,
  // puis en pourcentages, ou les petits multiples — désignent la même cible
  // à la fois, l'infobulle dans le seul graphique survolé. infobulle :
  // {colonnes, lignes}, les colonnes et les lignes du jumeau, une ligne par
  // rang ou par point ; ou {colonnes, series}, une ligne par rang et par
  // série, chaque série de l'infobulle sous le libellé de la série tracée
  // de même rang (exigerInfobulleDesTraces, Graphique).
  //
  // Désignations : data-graphique sur le <svg>, data-serie sur le tracé de
  // chaque série (sa clé : serie1, serie2, ou celle reçue) puis sur son
  // libellé, data-repere sur le tracé de chaque repère (plafond, borne,
  // cent) puis sur son libellé — le tracé vient d'abord —, data-point-releve
  // sur chaque point, par ses mouvements, data-rang sur la désignation de la
  // cible pointée, par son rang à partir de 1. Chaque marque porte
  // data-marque, son nom au registre (marques.js).
  import { getContext } from 'svelte';
  import Graphique from './Graphique.svelte';
  import {
    ESPACE_PX,
    TRAITS,
    ancrePoint,
    ancreRang,
    ciblePoint,
    cibleRang,
    dispositionEscalier,
    dispositionPoints,
    exigerInfobulleDesTraces,
    legendeTraces,
    margesVerticales,
  } from './pointage.js';

  let {
    graphique,
    nom,
    synthese,
    series,
    reperes = [],
    marques = null,
    forme = 'escalier',
    abscisses = null,
    hauteur = 240,
    borneHaute = null,
    graduer = null,
    graduerX = null,
    titreX = undefined,
    infobulle = null,
    alignerSur = null,
    marges = $bindable(null),
    pointe = $bindable(null),
  } = $props();

  const t = getContext('t');
  const format = getContext('format');
  const nombre = (v) => format.nombre(v);
  const enPoints = $derived(forme === 'points');

  let largeur = $state(0);
  let mesures = $state(null);
  let dessine = $state(false);

  const titre = $derived(titreX === undefined ? t(enPoints ? 'graphiques.axe.mouvements' : 'graphiques.axe.rangs') : titreX);
  const reperesTraces = $derived(enPoints ? [] : reperes);

  // Les marges du seul texte de ce graphique : elles ne lisent pas
  // alignerSur, et un groupe qui s'aligne ne boucle pas.
  const requises = $derived(
    mesures === null
      ? null
      : mesures.calculer((mesurer) =>
          margesVerticales({ series, reperes: reperesTraces, mesurer, graduer: graduer ?? nombre, titreX: titre, borneHaute }),
        ),
  );
  $effect(() => {
    marges = requises;
  });

  const disposition = $derived.by(() => {
    if (!dessine || mesures === null || largeur === 0) return null;
    return mesures.calculer((mesurer) => {
      const communes = {
        largeur,
        hauteur,
        series,
        mesurer,
        hauteurTexte: mesures.hauteurTexte,
        graduer: graduer ?? nombre,
        titreX: titre,
        aligner: alignerSur,
        borneHaute,
      };
      return enPoints
        ? dispositionPoints({ ...communes, abscisses, graduerX: graduerX ?? nombre })
        : dispositionEscalier({ ...communes, reperes, marques, graduerX: graduerX ?? nombre });
    });
  });

  // La légende, des seules données : un graphique qui attend son dessin la
  // porte déjà.
  const legende = $derived(legendeTraces({ series, reperes: reperesTraces, marques: enPoints ? null : marques }));

  // L'infobulle, rapportée aux séries tracées : une forme à séries nomme
  // chaque ligne comme le tracé nomme sa série.
  const bulle = $derived(exigerInfobulleDesTraces(infobulle, series));

  const cibler = (x) => (enPoints ? ciblePoint(x, disposition) : cibleRang(x, disposition));
  const ancrer = (indice) => (enPoints ? ancrePoint(indice, disposition) : ancreRang(indice, disposition));
  // L'attribut de désignation d'une trace : data-serie pour une série, de
  // sa clé, data-repere pour un repère, de son genre ; undefined l'omet.
  const estSerie = (genre) => genre.startsWith('serie');
</script>

<Graphique
  {graphique}
  {nom}
  {synthese}
  {hauteur}
  infobulle={bulle}
  zone={disposition?.zone ?? null}
  {legende}
  {cibler}
  {ancrer}
  bind:largeur
  bind:mesures
  bind:dessine
  bind:pointe
>
  {#if disposition !== null}
    {@const zone = disposition.zone}
    {@const bas = zone.y + zone.hauteur}
    {#each disposition.graduationsY as graduation (graduation.valeur)}
      <line class="grille" x1={zone.x} y1={graduation.y} x2={zone.x + zone.largeur} y2={graduation.y} />
      <text class="graduation" x={zone.x - ESPACE_PX} y={graduation.y} text-anchor="end" dominant-baseline="central"
        >{graduation.texte}</text
      >
    {/each}
    {#each disposition.graduationsX as graduation (graduation.valeur)}
      <text class="graduation" x={graduation.x} y={bas + ESPACE_PX} text-anchor="middle" dominant-baseline="hanging"
        >{graduation.texte}</text
      >
    {/each}
    {#if disposition.titreX !== null}
      <text class="graduation" x={disposition.titreX.x} y={bas + ESPACE_PX} dominant-baseline="hanging"
        >{disposition.titreX.texte}</text
      >
    {/if}
    {#each disposition.axes as axe, rang (rang)}
      <line class="axe" data-marque="graphiqueAxe" x1={axe.x1} y1={axe.y1} x2={axe.x2} y2={axe.y2} />
    {/each}
    {#if pointe !== null && disposition.traces[0].valeurs[pointe] !== undefined}
      {@const point = ancrer(pointe)}
      {#if enPoints}
        <circle class="designation" data-rang={pointe + 1} cx={point.x} cy={point.y} r="7" />
      {:else}
        <line class="designation" data-rang={pointe + 1} x1={point.x} y1={zone.y} x2={point.x} y2={bas} />
      {/if}
    {/if}
    {#each disposition.traces as trace (trace.genre)}
      <path
        class="trace"
        class:serie={estSerie(trace.genre)}
        data-serie={estSerie(trace.genre) ? trace.cle : undefined}
        data-repere={estSerie(trace.genre) ? undefined : trace.genre}
        data-marque={TRAITS[trace.genre].marque}
        d={trace.d}
        stroke-dasharray={TRAITS[trace.genre].motif}
        style:stroke={`var(${TRAITS[trace.genre].jeton})`}
      />
      {#if enPoints}
        {#each trace.points as point (point.indice)}
          {#if point.y !== null}
            <circle
              data-point-releve={point.mouvements}
              data-marque={TRAITS[trace.genre].marque}
              cx={point.x}
              cy={point.y}
              r="3.5"
              style:fill={`var(${TRAITS[trace.genre].jeton})`}
            />
          {/if}
        {/each}
      {/if}
      <text
        class="etiquette"
        data-serie={estSerie(trace.genre) ? trace.cle : undefined}
        data-repere={estSerie(trace.genre) ? undefined : trace.genre}
        x={trace.etiquette.x}
        y={trace.etiquette.y}
        dominant-baseline="central">{trace.libelle}</text
      >
    {/each}
    {#each disposition.signes as signe (signe.indice)}
      <path class="halo" d={signe.d} />
    {/each}
    {#each disposition.signes as signe (signe.indice)}
      <path class="signe" class:plein={signe.plein} data-marque="graphiqueMarque" d={signe.d} />
    {/each}
  {/if}
</Graphique>

<style>
  /* Une série, d'un trait épais ; un repère, d'un trait mince (D30). */
  .trace {
    fill: none;
    stroke-width: 1.25;
  }

  .trace.serie {
    stroke-width: 2;
  }

  .axe {
    stroke: var(--couleur-graphique-axe);
    stroke-width: 1;
  }

  .grille {
    stroke: var(--couleur-graphique-grille);
    stroke-width: 1;
  }

  .designation {
    fill: none;
    stroke: var(--couleur-graphique-axe);
    stroke-width: 1.5;
  }

  /* Le halo d'un signe : son chemin, du fond de la carte qui porte le
     graphique, plus large que lui de 2 px de chaque côté. Les halos se
     peignent sur les tracés, puis les signes sur les halos : un signe posé
     sur une série se lit contre le fond, non contre la série, et le halo
     d'un rang voisin ne recouvre aucun signe. Sans data-marque, il ne
     porte aucune donnée. */
  .halo {
    fill: none;
    stroke: var(--couleur-carte-fond);
    stroke-width: 5.5;
  }

  .signe {
    fill: none;
    stroke: var(--couleur-graphique-marque);
    stroke-width: 1.5;
  }

  .signe.plein {
    fill: var(--couleur-graphique-marque);
  }

  .graduation {
    fill: var(--couleur-page-texte-secondaire);
  }

  .etiquette {
    fill: var(--couleur-page-texte);
  }
</style>
