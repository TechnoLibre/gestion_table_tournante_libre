<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // L'avancement d'une génération en cours (§ 5.10) : les mouvements évalués
  // sur le total, en mots et en barre — une barre de progression accessible,
  // dont aria-valuenow porte les mouvements évalués —, et « Annuler la
  // génération », qui appelle annuler. fait et total viennent du contrôleur
  // de génération ; total est le produit du nombre de propositions et du
  // compte d'arrêt, jamais nul pendant un calcul.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';

  let { fait, total, annuler } = $props();

  const t = getContext('t');

  const largeur = $derived(total > 0 ? `${(fait / total) * 100}%` : '0%');
</script>

<div class="avancement" data-avancement>
  <p>{t('generation.avancement.texte', { fait, total })}</p>
  <div
    class="barre"
    role="progressbar"
    aria-label={t('generation.avancement.barre')}
    aria-valuemin="0"
    aria-valuemax={total}
    aria-valuenow={fait}
  >
    <div class="plein" style:width={largeur}></div>
  </div>
  <Commande cle="generation.commande.annuler" nom="annuler" executer={annuler} />
</div>

<style>
  .avancement {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  p {
    margin: 0;
  }

  .barre {
    box-sizing: border-box;
    width: min(30rem, 100%);
    height: var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
  }

  .plein {
    height: 100%;
    background-color: var(--couleur-page-texte);
  }
</style>
