<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La carte du départ d'une génération dérivée (§ 5.7, C6), au-dessus de
  // « Générer » : « Départ : proposition n° 4 », la commande « Repartir de
  // zéro », puis un groupe de cases, une par tour de la soirée, sous sa
  // légende, chacune au clavier comme toute case. Tout ce qu'elle montre se
  // lit dans carte (carteDuDepart, depart.js) ; elle n'écrit rien : cocher
  // appelle cocher(tour, coche), « Repartir de zéro » appelle
  // repartirDeZero, et la section les porte à l'état de navigation, vivant
  // en lecture et sur un plan bloqué (§ 8.4, C9).
  //
  // Sous le titre, avant tout lancement, les écarts du départ à la soirée
  // (carte.ecarts, [data-ecarts-depart]) : « Depuis n° 4 : », puis une
  // ligne par personne, son nom puis ce qui la sépare du départ — retirée,
  // assise à la meilleure chaise libre d'un tour figé, en réserve à un tour
  // figé, à asseoir. Quand le retenu, retenu de ce départ, en diffère à un
  // tour coché, la phrase qui le dit ([data-ecart-retenu]) suit les cases :
  // elle paraît et tombe avec la case qui la fait naître. Le texte est celui
  // des clés de la carte ; rien ne s'y compose.
  //
  // refusCases : le refus du lancement qui se pose contre les cases — tous
  // les tours figés —, {code, details}, ou null. Chaque case le désigne par
  // aria-describedby tant qu'il est posé.
  //
  // La section la monte sous un bloc clé sur l'identifiant du départ : un
  // autre départ en monte une neuve, ses cases toutes décochées à l'écran.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import Refus from '../primitives/Refus.svelte';

  let { carte, refusCases = null, cocher, repartirDeZero } = $props();

  const t = getContext('t');
  const uid = $props.id();
  const idTitre = `${uid}-titre`;
  const idRefus = `${uid}-refus`;
</script>

<section class="depart" data-depart aria-labelledby={idTitre}>
  <div class="tete">
    <h4 id={idTitre}>{t('generation.depart.titre', { depart: carte.depart })}</h4>
    <Commande cle="generation.commande.repartirDeZero" nom="repartirDeZero" executer={repartirDeZero} />
  </div>
  {#if carte.ecarts.length > 0}
    <div class="ecarts" data-ecarts-depart>
      <p>{t('generation.depart.ecarts', { depart: carte.depart })}</p>
      <ul>
        {#each carte.ecarts as ecart (ecart.participant)}
          <li data-participant={ecart.participant}>{t(ecart.nom.cle, ecart.nom.details)}{#each ecart.morceaux as morceau, rang (rang)}{t(morceau.cle, morceau.details)}{/each}</li>
        {/each}
      </ul>
    </div>
  {/if}
  <fieldset>
    <legend>{t('generation.depart.legende')}</legend>
    <div class="cases">
      {#each carte.cases as { tour, coche } (tour)}
        {@const id = `${uid}-tour-${tour}`}
        <div class="case">
          <input
            {id}
            type="checkbox"
            data-tour-fige={tour}
            checked={coche}
            aria-describedby={refusCases === null ? undefined : idRefus}
            onchange={(evenement) => cocher(tour, evenement.currentTarget.checked)}
          />
          <label for={id}>{t('generation.depart.tour', { tour })}</label>
        </div>
      {/each}
    </div>
    {#if refusCases !== null}
      <Refus id={idRefus} refus={refusCases} />
    {/if}
  </fieldset>
  {#if carte.ecartRetenu !== null}
    <p class="ecart-retenu" role="status" data-ecart-retenu>{t(carte.ecartRetenu.cle, carte.ecartRetenu.details)}</p>
  {/if}
  <p class="note">{t('generation.depart.note')}</p>
</section>

<style>
  /* Le départ : un filet de carte, son titre et « Repartir de zéro » sur
     une ligne, les cases dessous. */
  .depart {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    padding: var(--espace-3) var(--espace-4);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
  }

  .tete {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--espace-2);
  }

  h4 {
    margin: 0;
    font-size: var(--taille-texte);
  }

  fieldset {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    margin-bottom: var(--espace-1);
    padding: 0;
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  .cases {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2) var(--espace-4);
  }

  .case {
    display: flex;
    align-items: center;
    gap: var(--espace-1);
    min-height: var(--cible-minimale);
  }

  .case input {
    margin: 0;
  }

  .case input:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 1px;
  }

  /* Les écarts : « Depuis n° X : », puis une ligne par personne, sans puce. */
  .ecarts {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  .ecarts p,
  .ecarts ul {
    margin: 0;
  }

  .ecarts ul {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    padding: 0 0 0 var(--espace-3);
    list-style: none;
  }

  /* La retouche du retenu à un tour figé : un avis, filet et marque de
     l'avis. */
  .ecart-retenu {
    margin: 0;
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-avis-filet);
    border-left: 3px solid var(--couleur-avis-marque);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-avis-fond);
  }

  .note {
    margin: 0;
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte);
  }
</style>
