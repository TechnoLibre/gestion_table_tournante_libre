<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Des barres horizontales qui partent de zéro (§ 12.4, § 12.12, § 12.13,
  // D31, D38) : une ligne par entrée, dans l'ordre reçu du détail, intitulée
  // de son nom tronqué à LARGEUR_TRONCATURE_NOM_PX (registre des constantes)
  // sur des largeurs mesurées — le nom entier reste dans l'infobulle et le
  // jumeau —, précédé d'une pastille d'appartenance quand la ligne en porte
  // une : la liste garde sa teinte, le tracé n'en prend aucune (§ 12.7).
  //
  // lignes : [{id, nom, appartenance?, valeurs, secondaire?}] — appartenance,
  // le rang de teinte de 1 à 6 (teintesAppartenances), null pour la pastille
  // neutre, absente sans pastille ; secondaire, un texte déjà écrit ou null,
  // les autres chiffres de la ligne, ou « — » d'une ligne sans barre, écrit
  // en encre secondaire après la barre et les libellés posés sur elle
  // (dispositionBarres). Deux formes, exclusives :
  //   segments, un ou deux [{genre, libelle}], empilés depuis zéro sur un
  //   axe commun, valeurs[k] celle du segment k ; le libellé de chaque
  //   segment se pose sur la première barre où il est non nul, et dans la
  //   légende ;
  //   colonnes, deux [{genre, libelle}], juxtaposées, chacune son axe et son
  //   titre, jamais empilées ni sur un axe commun, valeurs[k] celle de la
  //   colonne k, les lignes dans le même ordre.
  // genre : serie1, serie2, prouve ou reste, chacun son jeton (REMPLISSAGES,
  // pointage.js). Un segment au remplissage en contour — « prouvé
  // inévitable » — se trace d'un trait de TRAIT_CONTOUR_PX de son jeton,
  // tenu dans la boîte du segment, que la disposition garde au moins large
  // de LARGEUR_MIN_CONTOUR_PX ; les autres en aplat : prouvé et reste se
  // distinguent par la forme comme par la couleur, à toute largeur (§ 12.4,
  // B13). Un segment nul ne se trace pas.
  //
  // Le pointage désigne la ligne sous le pointeur ; pointe, liable, en porte
  // l'indice ; infobulle, {colonnes, lignes}, une ligne du jumeau par ligne
  // de barres (Graphique). graduer(v) écrit une graduation, par défaut le
  // nombre mis en forme.
  //
  // Désignations : data-graphique sur le <svg>, data-ligne-graphique sur
  // chaque ligne, par l'identifiant de ce qu'elle porte, data-segment sur
  // chaque segment, par son genre, data-rang sur la désignation de la ligne
  // pointée, par son rang à partir de 1. Chaque marque porte data-marque.
  import { getContext } from 'svelte';
  import Graphique from './Graphique.svelte';
  import { TRAIT_CONTOUR_PX, cibleLigne, dispositionBarres, hauteurBarres, legendeBarres } from './pointage.js';

  let {
    graphique,
    nom,
    synthese,
    lignes,
    segments = null,
    colonnes = null,
    graduer = null,
    infobulle = null,
    pointe = $bindable(null),
  } = $props();

  const t = getContext('t');
  const format = getContext('format');

  let largeur = $state(0);
  let mesures = $state(null);
  let dessine = $state(false);

  const disposition = $derived(
    !dessine || mesures === null || largeur === 0
      ? null
      : mesures.calculer((mesurer) =>
          dispositionBarres({
            largeur,
            lignes,
            segments,
            colonnes,
            mesurer,
            hauteurTexte: mesures.hauteurTexte,
            graduer: graduer ?? ((v) => format.nombre(v)),
            marque: t('graphiques.troncature'),
          }),
        ),
  );

  // La hauteur du dessin et la légende ne lisent aucune largeur de texte :
  // un graphique qui attend son dessin les porte déjà.
  const hauteur = $derived(
    mesures === null ? 0 : hauteurBarres({ n: lignes.length, juxtaposees: colonnes !== null, hauteurTexte: mesures.hauteurTexte }),
  );
  const legende = $derived(legendeBarres({ segments, colonnes }));

  // La surface de pointage couvre les lignes, intitulés compris.
  const zone = $derived(
    disposition === null ? null : { x: 0, y: disposition.haut, largeur, hauteur: disposition.hauteurTotale - disposition.haut },
  );
  const cibler = (_x, y) => cibleLigne(y, disposition);
  const ancrer = (indice) => {
    const ligne = disposition.lignes[indice];
    return { x: ligne.fin, y: ligne.y + ligne.hauteur / 2 };
  };
  // La classe de teinte d'une pastille : son rang, ou la neutre.
  const teinte = (rang) => (rang === null ? 'neutre' : `appartenance-${rang}`);
</script>

<Graphique
  {graphique}
  {nom}
  {synthese}
  {infobulle}
  {hauteur}
  {zone}
  {legende}
  {cibler}
  {ancrer}
  bind:largeur
  bind:mesures
  bind:dessine
  bind:pointe
>
  {#if disposition !== null}
    {#each disposition.axes as axe, rang (rang)}
      {#if axe.titre !== null}
        <text class="titre" x={axe.titre.x} y={axe.titre.y} dominant-baseline="central">{axe.titre.texte}</text>
      {/if}
      {#each axe.graduations as graduation (graduation.valeur)}
        <line class="grille" x1={graduation.x} y1={axe.axe.y1} x2={graduation.x} y2={axe.axe.y2} />
        <text class="graduation" x={graduation.x} y={graduation.y} text-anchor="middle" dominant-baseline="central"
          >{graduation.texte}</text
        >
      {/each}
      <line class="axe" data-marque="graphiqueAxe" x1={axe.axe.x1} y1={axe.axe.y1} x2={axe.axe.x2} y2={axe.axe.y2} />
    {/each}
    {#if pointe !== null && disposition.lignes[pointe] !== undefined}
      {@const ligne = disposition.lignes[pointe]}
      <rect class="designation" data-rang={pointe + 1} x="0.75" y={ligne.y} width={largeur - 1.5} height={ligne.hauteur} />
    {/if}
    {#each disposition.lignes as ligne (ligne.id)}
      <g data-ligne-graphique={ligne.id}>
        {#if ligne.pastille !== null}
          {@const p = ligne.pastille}
          <rect class="pastille {teinte(ligne.appartenance)}" x={p.x} y={p.y} width={p.largeur} height={p.hauteur} rx={p.rayon} />
          <circle class="point {teinte(ligne.appartenance)}" cx={p.point.x} cy={p.point.y} r="4" />
        {/if}
        <text class="intitule" x={ligne.intitule.x} y={ligne.intitule.y} dominant-baseline="central">{ligne.intitule.texte}</text>
        {#if ligne.secondaire !== null}
          <text class="secondaire" x={ligne.secondaire.x} y={ligne.secondaire.y} dominant-baseline="central">{ligne.secondaire.texte}</text>
        {/if}
        {#each ligne.segments as segment (segment.colonne)}
          {#if segment.contour}
            <rect
              class="contour"
              data-segment={segment.genre}
              data-marque={segment.marque}
              x={segment.x + TRAIT_CONTOUR_PX / 2}
              y={segment.y + TRAIT_CONTOUR_PX / 2}
              width={segment.largeur - TRAIT_CONTOUR_PX}
              height={segment.hauteur - TRAIT_CONTOUR_PX}
              style:stroke={`var(${segment.jeton})`}
              style:stroke-width={`${TRAIT_CONTOUR_PX}px`}
            />
          {:else}
            <rect
              data-segment={segment.genre}
              data-marque={segment.marque}
              x={segment.x}
              y={segment.y}
              width={segment.largeur}
              height={segment.hauteur}
              style:fill={`var(${segment.jeton})`}
            />
          {/if}
        {/each}
      </g>
    {/each}
    {#each disposition.etiquettesSegments as etiquette (etiquette.genre)}
      <text class="etiquette" x={etiquette.x} y={etiquette.y} dominant-baseline="central">{etiquette.libelle}</text>
    {/each}
  {/if}
</Graphique>

<style>
  .contour {
    fill: none;
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

  .graduation,
  .secondaire {
    fill: var(--couleur-page-texte-secondaire);
  }

  .titre,
  .intitule,
  .etiquette {
    fill: var(--couleur-page-texte);
  }

  /* La pastille d'appartenance d'un intitulé : le fond teinté et le point de
     la marque de sa teinte, comme la primitive Pastille ; le nom se lit de
     l'encre de la page. */
  .pastille.neutre {
    fill: var(--couleur-neutre-fond);
  }

  .point.neutre {
    fill: var(--couleur-neutre-marque);
  }

  .pastille.appartenance-1 {
    fill: var(--couleur-appartenance-1-fond);
  }

  .point.appartenance-1 {
    fill: var(--couleur-appartenance-1-marque);
  }

  .pastille.appartenance-2 {
    fill: var(--couleur-appartenance-2-fond);
  }

  .point.appartenance-2 {
    fill: var(--couleur-appartenance-2-marque);
  }

  .pastille.appartenance-3 {
    fill: var(--couleur-appartenance-3-fond);
  }

  .point.appartenance-3 {
    fill: var(--couleur-appartenance-3-marque);
  }

  .pastille.appartenance-4 {
    fill: var(--couleur-appartenance-4-fond);
  }

  .point.appartenance-4 {
    fill: var(--couleur-appartenance-4-marque);
  }

  .pastille.appartenance-5 {
    fill: var(--couleur-appartenance-5-fond);
  }

  .point.appartenance-5 {
    fill: var(--couleur-appartenance-5-marque);
  }

  .pastille.appartenance-6 {
    fill: var(--couleur-appartenance-6-fond);
  }

  .point.appartenance-6 {
    fill: var(--couleur-appartenance-6-marque);
  }
</style>
