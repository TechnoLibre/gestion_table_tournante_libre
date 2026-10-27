<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Le plan imprimé d'un tour (§ 7.7, § 11.7, § 13.5) : une feuille par
  // page de la découpe (pagesDuPlan), chacune portant, dans sa zone de
  // contenu, un <svg> seul, de viewBox la tuile de la page en cm et de la
  // taille de la tuile sur le papier en mm. Le <svg> est une image nommée
  // (« Plan, page 2 sur 6 ») dont le contenu est caché aux technologies
  // d'assistance ; il dessine les tables de la page par PlanDessin, sur le
  // modèle du plan imprimé (modeleDessin, option impression) : régime des
  // sièges, ni poignée, ni cible, ni identifiant, ni sélection. Les listes
  // ont la largeur et la troncature de l'écran (§ 7.4), et portent
  // l'organisation de chaque occupant quand l'aperçu la demande. Une colonne
  // de tables par page, demandée, passe à la découpe (pagesDuPlan).
  //
  // Hors de la zone de contenu, dans la bande de la feuille : le cartouche
  // de repérage — page, colonne, rangée, renvois vers les pages voisines —,
  // l'échelle graphique de la page, la mention « disposition relative » et,
  // sur une page qui porte des listes, la mention qui les dit hors
  // d'échelle. La bande se mesure ainsi tout entière : sans bandeMm, la vue
  // rend sa feuille gabarit, en portrait — la largeur la plus étroite, où
  // la bande replie le plus —, qui porte chaque élément que la bande peut
  // porter, aux numéros les plus larges (CARTOUCHE_GABARIT) ; l'aperçu la
  // mesure, et la découpe reçoit la bande mesurée.
  //
  // La hauteur d'une ligne de liste (HAUTEUR_LIGNE) se mesure sur une sonde
  // au style des listes, rendue sans taille à côté des feuilles : les blocs
  // de noms entrent dans la découpe à la hauteur qu'elle leur donne. Les
  // pages attendent la mesure. L'orientation de la découpe remonte à
  // l'aperçu par la propriété liée orientation : c'est celle qu'il demande
  // à l'imprimante.
  import { getContext } from 'svelte';
  import { TAILLE_TEXTE_LISTE_CM } from '../../geometrie/texte.js';
  import { hauteurLigne, mesurable } from '../plan/mesure_texte.js';
  import { libelleLongueur, modeleDessin } from '../plan/modele.js';
  import PlanDessin from '../plan/PlanDessin.svelte';
  import { nomDeCharge, organisationDeCharge } from '../plan/vue_plan.js';
  import Feuille from './Feuille.svelte';
  import { CARTOUCHE_GABARIT, ECHELLE_GABARIT, MENTIONS_GABARIT, modeleDeLaPage, pagesDuPlan, renvois } from './plan.js';

  let { etat, options, feuille, bandeMm = null, orientation = $bindable(null) } = $props();

  const t = getContext('t');
  const format = getContext('format');
  const seance = getContext('seance');

  // La hauteur de ligne mesurée sur la sonde, en cm de dessin ; null avant
  // la mesure.
  let hauteur = $state(null);

  const modele = $derived(
    modeleDessin(etat, {
      listes: options.listes,
      nomDe: nomDeCharge($seance.charge),
      organisations: options.organisations,
      organisationDe: organisationDeCharge($seance.charge),
      impression: true,
    }),
  );
  const pages = $derived(
    bandeMm === null || hauteur === null
      ? null
      : pagesDuPlan(
          etat,
          modele.tables.map((table) => table.geometrie),
          options.decoupe,
          { papier: options.papier, bandeMm, listes: options.listes, hauteurLigne: hauteur, parColonne: options.parColonne, pied: feuille },
        ),
  );

  $effect(() => {
    if (pages !== null) orientation = pages[0].orientation;
  });

  function mesurerLigne(sonde) {
    if (mesurable(sonde)) hauteur = hauteurLigne(sonde);
  }
</script>

{#snippet bandeDe(cartouche, echelle, mentions)}
  {@const longueur = libelleLongueur(echelle.longueurCm)}
  <div class="bande">
    <p class="cartouche" data-cartouche>
      <span>{t('impression.plan.cartouche', cartouche)}</span>
      {#each renvois(cartouche) as renvoi (renvoi.sens)}
        <span>{t(renvoi.cle, { page: renvoi.page })}</span>
      {/each}
    </p>
    <div class="graduation" role="img" aria-label={t('plan.echelle.nom')}>
      <div class="barre" data-marque="echelle" style:width="{echelle.largeurMm}mm"></div>
      <span class="longueur"
        ><span>{format.nombre(longueur.valeur, { decimales: longueur.decimales })}</span>&#32;<span>{t(longueur.cle)}</span></span
      >
    </div>
    <p class="mention" data-mention="relative">{t('plan.echelle.mention')}</p>
    {#if mentions.listes}
      <p class="mention" data-mention="listes">{t('impression.plan.listes')}</p>
    {/if}
  </div>
{/snippet}

{#if bandeMm === null}
  <Feuille papier={options.papier} orientation="portrait" {feuille}>
    {#snippet bande()}
      {@render bandeDe(CARTOUCHE_GABARIT, ECHELLE_GABARIT, MENTIONS_GABARIT)}
    {/snippet}
  </Feuille>
{:else}
  <svg class="sonde" aria-hidden="true" width="0" height="0"
    ><text font-size={TAILLE_TEXTE_LISTE_CM} {@attach mesurerLigne}></text></svg
  >
  {#if pages !== null}
    {#each pages as page (page.rang)}
      <Feuille rang={page.rang} papier={options.papier} orientation={page.orientation} {feuille} {bandeMm}>
        {#snippet contenu()}
          <svg
            viewBox="{page.viewBox.x} {page.viewBox.y} {page.viewBox.largeur} {page.viewBox.hauteur}"
            style:width="{page.taille.largeur}mm"
            style:height="{page.taille.hauteur}mm"
            role="img"
            aria-label={t('impression.plan.page', { page: page.cartouche.page, total: page.cartouche.total })}
          >
            <g aria-hidden="true">
              <PlanDessin modele={modeleDeLaPage(modele, page)} />
            </g>
          </svg>
        {/snippet}
        {#snippet bande()}
          {@render bandeDe(page.cartouche, page.echelle, page.mentions)}
        {/snippet}
      </Feuille>
    {/each}
  {/if}
{/if}

<style>
  svg {
    display: block;
  }

  /* La sonde de la hauteur de ligne : le style des listes (ListeNoms),
     rendue sans taille ni place, jamais vue ni imprimée. */
  .sonde {
    position: absolute;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
  }

  .sonde text {
    font-family: var(--police-interface);
    white-space: pre;
  }

  .bande {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    padding-top: var(--espace-2);
    font-size: var(--taille-texte-petit);
  }

  .bande p {
    margin: 0;
  }

  .cartouche {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--espace-3);
    font-weight: bold;
  }

  .graduation {
    display: flex;
    align-items: center;
    gap: var(--espace-2);
  }

  /* La barre de l'échelle se trace de ses bords : une bordure s'imprime
     sans l'option qui imprime les fonds. */
  .barre {
    box-sizing: border-box;
    height: 2mm;
    border: 1mm solid var(--couleur-echelle);
  }
</style>
