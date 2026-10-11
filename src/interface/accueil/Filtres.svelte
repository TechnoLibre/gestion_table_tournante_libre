<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Les tuiles des filtres de la liste par état du plan (§ 8.1, § 9) : un
  // groupe nommé de boutons-filtres, un par tuile de tuilesDeLaListe, dans
  // son ordre — tous les événements, puis chaque état dans l'ordre du § 9.
  // Chaque tuile porte la pastille de son filtre, le nombre de lignes qu'il
  // retient et son aide ; data-commande="filtrer" et data-cible, son filtre.
  // La tuile du filtre courant est pressée (aria-pressed), et se distingue
  // par un filet double de la teinte de l'action, non par la seule couleur.
  //
  // tuiles : celles de tuilesDeLaListe (modele.js) ; filtrer(filtre) : le
  // geste de l'accueil, qui ne lit ni n'écrit rien.
  import { getContext } from 'svelte';
  import Pastille from '../primitives/Pastille.svelte';

  let { tuiles, filtrer } = $props();

  const t = getContext('t');
</script>

<div class="tuiles" role="group" aria-label={t('accueil.filtre.groupe')}>
  {#each tuiles as { filtre, cle, aide, compte, presse, pastille } (filtre)}
    <button
      type="button"
      class="tuile"
      data-commande="filtrer"
      data-cible={filtre}
      aria-pressed={presse ? 'true' : 'false'}
      onclick={() => filtrer(filtre)}
      ><Pastille sorte={pastille.sorte} valeur={pastille.valeur} icone={pastille.icone} libelle={t(cle)} /><span class="compte"
        >{compte}</span
      ><span class="aide">{t(aide)}</span></button
    >
  {/each}
</div>

<style>
  /* Cinq tuiles de même largeur sur une rangée ; elles passent à la ligne
     quand la largeur manque. */
  .tuiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10.5rem), 1fr));
    gap: var(--espace-3);
  }

  /* Une tuile : une carte qui se presse. Le filet passe de 1 à 2 px quand
     elle est pressée ; le retrait perd 1 px, de sorte que rien ne bouge. */
  .tuile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
    min-width: 0;
    min-height: var(--hauteur-cible);
    padding: var(--espace-3) var(--espace-4);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-3);
    background-color: var(--couleur-carte-fond);
    box-shadow: var(--ombre-carte);
    color: var(--couleur-page-texte);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .tuile:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  .tuile[aria-pressed='true'] {
    padding: calc(var(--espace-3) - 1px) calc(var(--espace-4) - 1px);
    border: 2px solid var(--couleur-action-fond);
  }

  .tuile:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .compte {
    font-size: var(--taille-titre-grand);
    font-weight: bold;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .aide {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }
</style>
