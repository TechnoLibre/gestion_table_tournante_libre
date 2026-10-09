<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le panneau « À propos » (§ 18.6) : le bloc d'une ligne que l'opérateur
  // copie dans un courriel, tel que blocAPropos l'a composé, et sa copie dans
  // le presse-papiers de la plateforme. « Copier » remet exactement le texte
  // affiché ; l'issue de la copie se lit sous les commandes.
  import { getContext } from 'svelte';

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
  <p class="bloc" data-bloc>{bloc}</p>
  <div class="commandes">
    <button type="button" data-commande="copier" onclick={copier}>{t('coquille.apropos.copier')}</button>
    <button type="button" data-commande="fermerApropos" onclick={fermer}>{t('coquille.apropos.fermer')}</button>
  </div>
  {#if issue === 'faite'}
    <p role="status">{t('coquille.apropos.copie')}</p>
  {:else if issue === 'refusee'}
    <p role="status" class="refus" data-refus="copier">{t('coquille.apropos.copieRefusee')}</p>
  {/if}
</section>

<style>
  .bloc {
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    user-select: all;
    overflow-wrap: anywhere;
  }

  .commandes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }

  button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .refus {
    color: var(--couleur-refus);
  }
</style>
