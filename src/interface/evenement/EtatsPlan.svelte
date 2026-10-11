<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La suite des états du plan (§ 9), dans la barre de l'événement : sous
  // le nom « État du plan », que redit un intertitre en petites capitales
  // tant que la barre a la place, les quatre états dans l'ordre du § 9
  // (etapesEtat, modele.js), séparés de chevrons cachés à l'assistance.
  // Chaque étape est la Commande changerEtat de son état, restylée en
  // pilule, avec l'icône de sa pastille d'état posée sur le bouton, à
  // gauche de son nom, de la marque de sa teinte. L'état courant porte en plus le fond de sa teinte, un filet
  // plein et le gras ; les autres, un filet tireté, et restent cliquables
  // sous le même nom.
  //
  // Un état se pose en le cliquant : « Bloqué » est la commande « Bloquer »,
  // après laquelle la séance revient en lecture et rend le verrou. Ce que la
  // séance refuse — la lecture, un plan bloqué, « Retenu » sans placement
  // retenu, « Proposé » sans proposition — s'affiche à côté de l'état
  // cliqué, avec son remède : chaque état est un bloc, et la commande et son
  // refus en sont.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import Icone from '../primitives/Icone.svelte';
  import { etapesEtat } from './modele.js';

  const t = getContext('t');
  const seance = getContext('seance');

  const etapes = $derived(etapesEtat($seance));
</script>

<div class="etats" role="group" aria-label={t('evenement.etat.titre')}>
  <span class="intertitre" aria-hidden="true">{t('evenement.etat.titre')}</span>
  {#each etapes as etape, rang (etape.etat)}
    {#if rang > 0}
      <span class="chevron"><Icone nom="chevron" taille={14} /></span>
    {/if}
    <div
      class="etat"
      class:courant={etape.courant}
      class:brouillon={etape.etat === 'brouillon'}
      class:propose={etape.etat === 'propose'}
      class:retenu={etape.etat === 'retenu'}
      class:bloque={etape.etat === 'bloque'}
      data-etat={etape.etat}
    >
      <span class="signe"><Icone nom={etape.icone} taille={14} /></span>
      <Commande cle={etape.cle} nom="etat" executer={() => seance.executer('changerEtat', { etat: etape.etat })} />
    </div>
  {/each}
</div>

<style>
  .etats {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-1);
  }

  /* L'intertitre et les chevrons sont centrés sur la hauteur d'une étape. */
  .intertitre {
    display: flex;
    align-items: center;
    min-height: 2rem;
    margin-right: var(--espace-1);
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  /* Dans une barre étroite (SurfaceEvenement.svelte), l'intertitre
     s'efface : le groupe garde son nom, et les quatre étapes leur ligne. */
  @container barre (max-width: 80rem) {
    .intertitre {
      display: none;
    }
  }

  .chevron {
    display: flex;
    align-items: center;
    min-height: 2rem;
    color: var(--couleur-page-texte-secondaire);
  }

  /* L'étape : son bouton, une pilule de 2rem de haut, laisse à gauche la
     place de l'icône, posée dessus sans recevoir le pointeur. */
  .etat {
    position: relative;
    font-weight: normal;
  }

  .etat.courant {
    font-weight: bold;
  }

  .signe {
    position: absolute;
    top: calc((2rem - 14px) / 2);
    left: var(--espace-3);
    display: flex;
    pointer-events: none;
  }

  /* Le bouton de la Commande, non ceux du refus posé à côté. */
  .etat > :global(div > button) {
    display: inline-flex;
    align-items: center;
    min-height: 2rem;
    padding: 0 var(--espace-3) 0 calc(var(--espace-3) + 14px + var(--espace-2));
    border: 1px dashed var(--couleur-page-filet);
    border-radius: var(--rayon-pilule);
    background-color: transparent;
  }

  .etat > :global(div > button:hover) {
    background-color: var(--couleur-carte-fond);
  }

  .etat.courant > :global(div > button) {
    border-style: solid;
  }

  .brouillon .signe {
    color: var(--couleur-etat-brouillon-marque);
  }

  .propose .signe {
    color: var(--couleur-etat-propose-marque);
  }

  .retenu .signe {
    color: var(--couleur-etat-retenu-marque);
  }

  .bloque .signe {
    color: var(--couleur-etat-bloque-marque);
  }

  .courant.brouillon > :global(div > button) {
    border-color: var(--couleur-etat-brouillon-marque);
    background-color: var(--couleur-etat-brouillon-fond);
  }

  .courant.propose > :global(div > button) {
    border-color: var(--couleur-etat-propose-marque);
    background-color: var(--couleur-etat-propose-fond);
  }

  .courant.retenu > :global(div > button) {
    border-color: var(--couleur-etat-retenu-marque);
    background-color: var(--couleur-etat-retenu-fond);
  }

  .courant.bloque > :global(div > button) {
    border-color: var(--couleur-etat-bloque-marque);
    background-color: var(--couleur-etat-bloque-fond);
  }
</style>
