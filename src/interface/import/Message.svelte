<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Un bloc de messages de l'aperçu ou du rapport d'import (§ 10.1), classé
  // en refus, avis ou information par messageDuBloc (modele.js) : une
  // pastille de la sorte — son libellé, son icône, le fond de sa teinte —,
  // puis le titre du bloc, puis son contenu. Le cadre porte le filet de la
  // sorte et un trait de gauche de sa marque ; le texte garde l'encre de la
  // page. La sorte se lit au libellé de la pastille : la couleur la redit.
  //
  // bloc : le nom du bloc, que messageDuBloc classe ; titre : le titre déjà
  // traduit, ou null quand le contenu se nomme lui-même (la légende d'un
  // tableau) ; children : le contenu.
  import { getContext } from 'svelte';
  import Pastille from '../primitives/Pastille.svelte';
  import { messageDuBloc } from './modele.js';

  let { bloc, titre = null, children = null } = $props();

  const t = getContext('t');
  const message = $derived(messageDuBloc(bloc));
</script>

<section class="message {message.sorte}">
  <div class="tete">
    <Pastille sorte="statut" valeur={message.sorte} icone={message.icone} libelle={t(message.cle)} />
    {#if titre !== null}
      <h4>{titre}</h4>
    {/if}
  </div>
  {@render children?.()}
</section>

<style>
  .message {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    min-width: 0;
    padding: var(--espace-3);
    border: 1px solid var(--couleur-carte-filet);
    border-left-width: 3px;
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
  }

  /* Le cadre de chaque sorte : son filet, le trait de gauche de sa marque. */
  .refus {
    border-color: var(--couleur-refus-filet);
    border-left-color: var(--couleur-refus-marque);
  }

  .avis {
    border-color: var(--couleur-avis-filet);
    border-left-color: var(--couleur-avis-marque);
  }

  .information {
    border-color: var(--couleur-information-filet);
    border-left-color: var(--couleur-information-marque);
  }

  .tete {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2);
  }

  h4 {
    margin: 0;
    font-size: var(--taille-texte);
  }
</style>
