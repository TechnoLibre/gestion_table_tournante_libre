<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Le cadre d'un graphique de la page de qualité (§ 12.7, § 14.5, D44) :
  // un <svg role="img"> sans viewBox — le pixel du dessin est celui de
  // l'écran —, nommé par la question de sa vue (aria-labelledby) et décrit
  // par sa phrase de synthèse, visible dessous (aria-describedby) ; la
  // légende ; la surface de pointage ; l'infobulle. Escalier, Barres et
  // Grille le remplissent : il ne dessine aucune marque et ne calcule rien.
  //
  // La largeur se mesure sur une règle de hauteur nulle en tête du
  // conteneur (largeur, liable) : sa hauteur ne suit pas le dessin, si bien
  // qu'un dessin dont la hauteur suit la largeur — une grille — ne change
  // pas, dans l'image même, la taille d'un élément déjà mesuré, ce que
  // ResizeObserver signale comme une boucle. Le texte se mesure sur
  // une sonde du dessin (mesures, liable : {mesurer, calculer,
  // hauteurTexte} de mesuresDuTexte, null tant que la sonde n'est pas
  // rendue) : le composant qui remplit le cadre en tire sa disposition
  // (pointage.js) par calculer, qui relève ses libellés inconnus par lots
  // et garde leurs largeurs pour la séance, puis rend ses marques par
  // children.
  //
  // dessine, liable, dit que les marques se rendent (le dessin différé,
  // plus bas) : le composant qui remplit le cadre ne calcule sa disposition
  // qu'alors. Avant, il ne mesure que ce qui fixe sa place dans la page :
  // les marges d'alignement d'un escalier, qui alignent deux graphiques, et
  // les intitulés d'une grille, qui décident de sa hauteur. La hauteur
  // qu'il passe est déjà celle de son dessin.
  //
  // Le pointage au plus proche (§ 12.7) : zone, {x, y, largeur, hauteur} en
  // px du dessin, porte la surface de pointage, un <rect fill="none"
  // pointer-events="all"> posé après les marques, sœur d'elles, jamais leur
  // ancêtre : aucune opacité n'est nécessaire pour capter le pointeur.
  // cibler(x, y) rend l'indice de la cible sous le point local — selon la
  // règle de la forme : rang, ligne, case, point de relevé —, ou null ;
  // pointe, liable, porte cet indice : deux graphiques qui le lient à un
  // même état désignent la même cible. Le pointeur qui quitte la surface
  // remet pointe à null.
  //
  // L'infobulle porte la ligne du jumeau de la cible pointée : infobulle,
  // {colonnes, lignes}, la ligne d'indice pointe, une liste de libellés et
  // de valeurs ; ou {colonnes, series}, une ligne par série à cet indice,
  // chacune précédée du nom de sa série et dans l'ordre des séries — deux
  // placements comparés, une personne chacun au même rang (C20, D66), en
  // comptes (lignesInfobulle, pointage.js). Un nombre s'écrit par
  // format.nombre comme les graduations, une cellule de pourcentage par
  // Pourcentage, son compte dessous.
  // Elle ne s'ouvre que dans le graphique survolé, sur le modèle de
  // l'infobulle primitive : un seul élément [role=tooltip], caché tant
  // qu'aucune cible n'est pointée, placé par placerInfobulle contre le point
  // d'ancrage de la cible (ancrer(indice) → {x, y} local), dans la zone
  // visible où défile le graphique (zoneVisible) — elle ne couvre ni le
  // bandeau collant ni ce qui reste fixe au-dessus de cette zone —, replacé
  // au défilement et au redimensionnement, invisible tant qu'il n'est pas
  // placé ; Échap la ferme. Elle ne capte aucun pointeur.
  //
  // legende : [{genre, libelle, signe}] — un trait, un remplissage ou un
  // signe, chacun dessiné de son jeton et de son motif, puis son libellé ;
  // libelle null pour un signe, que la table des graphiques nomme. Elle se
  // tire des données (legendeTraces, legendeBarres), jamais du dessin : la
  // liste se rend dès le montage, marques en attente ou non. synthese : un
  // texte déjà traduit, ou un snippet qui le rend.
  //
  // Le dessin différé : sous le contexte dessinDiffere (dessin_differe.js),
  // que la page de qualité pose, les marques d'un graphique loin de la zone
  // visible ne se disposent ni ne se rendent, et leurs libellés ne se
  // mesurent pas. Le <svg> garde la hauteur de son dessin, la légende et la
  // phrase de synthèse sont rendues : le dessin ne déplace rien dans la
  // page. L'image nommée et décrite reste, et le <svg> porte
  // data-dessin-differe tant que ses marques attendent : un <svg role="img">
  // ne montre pas ses enfants au lecteur d'écran, et le jumeau, chemin du
  // clavier et du lecteur d'écran, ne dépend pas du dessin. Une fois sa
  // largeur lue, un graphique qui coupe la zone visible — celle du plus
  // proche ancêtre qui défile, sinon la fenêtre — se dessine aussitôt ; un
  // autre s'inscrit au registre du contexte, qui peut le dessiner sur
  // demande, et attend qu'un IntersectionObserver, de marge une hauteur de
  // cette zone au-dessus et au-dessous, le voie approcher. Un graphique
  // dessiné le reste. Hors de ce contexte, chaque graphique se dessine dès
  // sa largeur lue.
  //
  // Aucune opacité, aucun filtre, aucun mode de fusion sur une marque, un
  // texte ou leur ascendance (§ 14.5).
  import { getContext } from 'svelte';
  import { mesurable, mesuresDuTexte } from '../../plan/mesure_texte.js';
  import { placerInfobulle } from '../../primitives/infobulle.js';
  import { effetDe } from '../../raccourcis.js';
  import Pourcentage from './Pourcentage.svelte';
  import { REMPLISSAGES, TRAITS, TRAIT_CONTOUR_PX, cheminSigne, lignesInfobulle } from './pointage.js';

  let {
    graphique,
    nom,
    synthese,
    hauteur,
    zone = null,
    cibler,
    ancrer,
    infobulle = null,
    legende = [],
    largeur = $bindable(0),
    mesures = $bindable(null),
    pointe = $bindable(null),
    dessine = $bindable(false),
    children,
  } = $props();

  const t = getContext('t');
  const format = getContext('format');
  const uid = $props.id();
  const idNom = `${uid}-nom`;
  const idSynthese = `${uid}-synthese`;
  const differe = getContext('dessinDiffere') ?? null;

  let svg = $state(null);
  let cadre = $state(null);
  let sonde = $state(null);
  let bulle = $state(null);
  let survole = $state(false);
  // Le coin haut gauche de l'infobulle dans la fenêtre, en px ; null tant
  // qu'elle n'est pas placée.
  let place = $state(null);

  // Le plus proche ancêtre de l'élément qui fait défiler son contenu à la
  // verticale, ou null.
  function ancetreQuiDefile(element) {
    for (let ancetre = element.parentElement; ancetre !== null; ancetre = ancetre.parentElement) {
      const { overflowY } = getComputedStyle(ancetre);
      if (overflowY === 'auto' || overflowY === 'scroll') return ancetre;
    }
    return null;
  }

  // Le dessin, dès la largeur lue ; différé, le cadre lu une fois, dans la
  // mise en page que la lecture de la largeur vient de faire, sinon le
  // registre et l'observateur, retirés au dessin.
  $effect(() => {
    if (dessine || cadre === null || largeur === 0) return undefined;
    if (differe === null) {
      dessine = true;
      return undefined;
    }
    const defile = ancetreQuiDefile(cadre);
    const zone = defile === null ? { top: 0, bottom: innerHeight } : defile.getBoundingClientRect();
    const boite = cadre.getBoundingClientRect();
    if (boite.bottom >= zone.top && boite.top <= zone.bottom) {
      dessine = true;
      return undefined;
    }
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((entree) => entree.isIntersecting)) dessine = true;
      },
      { root: defile, rootMargin: '100% 0px' },
    );
    observateur.observe(cadre);
    const retirer = differe.inscrire(cadre, () => {
      dessine = true;
    });
    return () => {
      observateur.disconnect();
      retirer();
    };
  });

  // La mesure du texte, relevée sur la sonde dès qu'elle est rendue : sous
  // un ancêtre caché, elle attend que la largeur mesurée change.
  $effect(() => {
    if (largeur > 0 && sonde !== null && mesures === null && mesurable(sonde)) {
      mesures = mesuresDuTexte(sonde);
    }
  });

  // Les lignes de la cible pointée, [{nom, cellules}], nom null sous la
  // forme {colonnes, lignes} ; null quand rien ne s'ouvre.
  const ligne = $derived(survole && pointe !== null && infobulle !== null ? lignesInfobulle(infobulle, pointe, format.nombre) : null);

  function pointer(evenement) {
    if (svg === null) return;
    const cadre = svg.getBoundingClientRect();
    pointe = cibler(evenement.clientX - cadre.left, evenement.clientY - cadre.top);
    survole = true;
  }

  function quitter() {
    survole = false;
    pointe = null;
  }

  // La zone visible où défile le graphique : le haut et le bas, dans le
  // repère de la fenêtre, du plus proche ancêtre qui fait défiler son
  // contenu à la verticale ; {} sans un tel ancêtre.
  function zoneVisible(element) {
    const defile = ancetreQuiDefile(element);
    if (defile === null) return {};
    const boite = defile.getBoundingClientRect();
    return { haut: boite.top, bas: boite.bottom };
  }

  function placer() {
    if (ligne === null || bulle === null || svg === null) return;
    const point = ancrer(pointe);
    const cadre = svg.getBoundingClientRect();
    const boite = bulle.getBoundingClientRect();
    const fenetre = document.documentElement;
    const x = cadre.left + point.x;
    const y = cadre.top + point.y;
    place = placerInfobulle(
      { gauche: x, haut: y, droite: x, bas: y },
      { largeur: boite.width, hauteur: boite.height },
      { largeur: fenetre.clientWidth, hauteur: fenetre.clientHeight, ...zoneVisible(svg) },
    );
  }

  // À chaque cible pointée, après le rendu de sa ligne.
  $effect(() => {
    if (ligne === null) {
      place = null;
      return;
    }
    placer();
  });

  function surTouche(evenement) {
    if (survole && effetDe('fenetre', evenement.key) === 'fermer') quitter();
  }
</script>

<svelte:window onkeydown={surTouche} onscrollcapture={placer} onresize={placer} />

{#snippet echantillon(entree)}
  <svg class="echantillon" width="28" height="12" aria-hidden="true">
    {#if entree.genre === 'signe'}
      <path
        class="signe"
        class:plein={entree.signe === 'ancre'}
        d={cheminSigne(entree.signe, 14, 6)}
      />
    {:else if Object.hasOwn(TRAITS, entree.genre)}
      <line
        x1="1"
        y1="6"
        x2="27"
        y2="6"
        class="trait"
        stroke-dasharray={TRAITS[entree.genre].motif}
        style:stroke={`var(${TRAITS[entree.genre].jeton})`}
      />
    {:else if REMPLISSAGES[entree.genre].contour}
      <rect
        x="2"
        y="3"
        width="24"
        height="6"
        class="contour"
        style:stroke={`var(${REMPLISSAGES[entree.genre].jeton})`}
        style:stroke-width={`${TRAIT_CONTOUR_PX}px`}
      />
    {:else}
      <rect x="1" y="2" width="26" height="8" style:fill={`var(${REMPLISSAGES[entree.genre].jeton})`} />
    {/if}
  </svg>
{/snippet}

<div class="graphique" bind:this={cadre}>
  <div class="mesure" bind:clientWidth={largeur}></div>
  <span id={idNom} hidden>{nom}</span>
  <svg
    bind:this={svg}
    data-graphique={graphique}
    role="img"
    aria-labelledby={idNom}
    aria-describedby={idSynthese}
    data-dessin-differe={dessine ? undefined : ''}
    width={largeur}
    height={hauteur}
  >
    <text bind:this={sonde} class="sonde" x="0" y="0"></text>
    {#if dessine}
      {@render children()}
    {/if}
    {#if zone !== null}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <rect
        x={zone.x}
        y={zone.y}
        width={zone.largeur}
        height={zone.hauteur}
        fill="none"
        pointer-events="all"
        onpointermove={pointer}
        onpointerleave={quitter}
      />
    {/if}
  </svg>
  {#if legende.length > 0}
    <ul class="legende" aria-label={t('graphiques.legende')}>
      {#each legende as entree, rang (rang)}
        <li>
          {@render echantillon(entree)}<span>{entree.libelle ?? t(`graphiques.signe.${entree.signe}`)}</span>
        </li>
      {/each}
    </ul>
  {/if}
  <p id={idSynthese} class="synthese">
    {#if typeof synthese === 'function'}{@render synthese()}{:else}{synthese}{/if}
  </p>
  <div
    bind:this={bulle}
    class="infobulle"
    class:placee={place !== null}
    role="tooltip"
    hidden={ligne === null}
    style:left={place === null ? null : `${place.gauche}px`}
    style:top={place === null ? null : `${place.haut}px`}
  >
    {#if ligne !== null}
      {#each ligne as serie, rang (rang)}
        {#if serie.nom !== null}
          <p class="nom-serie">{serie.nom}</p>
        {/if}
        <dl>
          {#each serie.cellules as cellule (cellule.cle)}
            <div class="cellule">
              <dt>{cellule.libelle}</dt>
              <dd>
                {#if cellule.genre === 'pourcentage'}
                  <Pourcentage texte={cellule.texte} compte={cellule.compte} />
                {:else}
                  {cellule.texte ?? t('format.vide')}
                {/if}
              </dd>
            </div>
          {/each}
        </dl>
      {/each}
    {/if}
  </div>
</div>

<style>
  /* La règle de la largeur : la largeur du conteneur, aucune hauteur ;
     posée hors du flux, elle n'ajoute pas d'écart à la colonne. */
  .mesure {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    height: 0;
  }

  .graphique {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    min-width: 0;
  }

  svg {
    display: block;
    overflow: visible;
  }

  /* Le texte du dessin : le petit corps de l'interface ; la sonde le mesure
     et ne se voit pas. */
  svg :global(text) {
    font-size: var(--taille-texte-petit);
  }

  .sonde {
    visibility: hidden;
  }

  .legende {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1) var(--espace-4);
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte-petit);
  }

  .legende li {
    display: inline-flex;
    align-items: center;
    gap: var(--espace-1);
  }

  .trait {
    fill: none;
    stroke-width: 2;
  }

  .signe {
    fill: none;
    stroke: var(--couleur-graphique-marque);
    stroke-width: 1.5;
  }

  /* L'échantillon d'un segment tracé en contour : « prouvé inévitable ». */
  .contour {
    fill: none;
  }

  .signe.plein {
    fill: var(--couleur-graphique-marque);
  }

  .synthese {
    margin: 0;
    color: var(--couleur-page-texte);
  }

  /* L'infobulle, sur le modèle de la primitive : posée dans la fenêtre,
     invisible tant qu'elle n'est pas placée, sans capter le pointeur. */
  .infobulle {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 3;
    box-sizing: border-box;
    width: max-content;
    max-width: min(26rem, calc(100% - 16px));
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-2);
    font-size: var(--taille-texte);
    line-height: 1.4;
    pointer-events: none;
    visibility: hidden;
  }

  .infobulle.placee {
    visibility: visible;
  }

  .infobulle[hidden] {
    display: none;
  }

  /* Le nom de la série devant sa ligne ; une seconde série s'écarte de la
     ligne qui la précède. */
  .nom-serie {
    margin: 0 0 var(--espace-1);
    font-weight: bold;
  }

  dl + .nom-serie {
    margin-top: var(--espace-2);
  }

  dl {
    display: grid;
    grid-template-columns: auto auto;
    gap: var(--espace-1) var(--espace-3);
    margin: 0;
  }

  .cellule {
    display: contents;
  }

  dt {
    color: var(--couleur-page-texte-secondaire);
  }

  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
</style>
