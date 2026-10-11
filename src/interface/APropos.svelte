<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le panneau « À propos » (§ 18.6) : le bloc d'une ligne que l'opérateur
  // copie dans un courriel, tel que blocAPropos l'a composé, et sa copie dans
  // le presse-papiers de la plateforme. « Copier » remet exactement le texte
  // affiché ; l'issue de la copie se lit sous les commandes.
  //
  // Habillage : le titre de l'écran, puis une carte qui porte le bloc, sur
  // le fond sourd de la carte, et les commandes — « Copier », l'action
  // principale, et « Fermer ». Une copie refusée se dit dans l'encre du
  // refus.
  import { getContext } from 'svelte';
  import Carte from './primitives/Carte.svelte';
  import Commande from './primitives/Commande.svelte';

  const t = getContext('t');

  let { bloc, pressePapiers, fermer } = $props();

  // null avant toute copie, puis 'faite' ou 'refusee'.
  let issue = $state(null);

  async function copier() {
    try {
      await pressePapiers.copier(bloc);
      issue = 'faite';
    } catch {
      issue = 'refusee';
    }
  }
</script>

<section class="apropos" data-ecran="apropos">
  <h1>{t('coquille.apropos.titre')}</h1>
  <Carte>
    <div class="contenu">
      <p class="bloc" data-bloc>{bloc}</p>
      <div class="commandes">
        <Commande cle="coquille.apropos.copier" nom="copier" variante="principale" executer={copier} />
        <Commande cle="coquille.apropos.fermer" nom="fermerApropos" executer={fermer} />
      </div>
      {#if issue === 'faite'}
        <p role="status">{t('coquille.apropos.copie')}</p>
      {:else if issue === 'refusee'}
        <p role="status" class="refus" data-refus="copier">{t('coquille.apropos.copieRefusee')}</p>
      {/if}
    </div>
  </Carte>
</section>

<style>
  .apropos {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
  }

  h1 {
    margin: 0;
  }

  .contenu {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
  }

  p {
    margin: 0;
  }

  /* Le bloc se sélectionne d'un clic, entier, et se coupe où il faut
     plutôt que de déborder. */
  .bloc {
    padding: var(--espace-3) var(--espace-4);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond-sourd);
    font-variant-numeric: tabular-nums;
    user-select: all;
    overflow-wrap: anywhere;
  }

  .commandes {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2);
  }

  .refus {
    color: var(--couleur-refus);
  }
</style>
