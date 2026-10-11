<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // L'avancement d'une génération en cours (§ 5.10) : les mouvements évalués
  // sur le total, en mots et en barre — une barre de progression accessible,
  // dont aria-valuenow porte les mouvements évalués —, et « Annuler la
  // génération », qui appelle annuler. fait et total viennent du contrôleur
  // de génération ; total est le produit du nombre de propositions et du
  // compte d'arrêt, jamais nul pendant un calcul.
  //
  // La barre occupe la largeur de son bloc : sa piste sur le fond sourd de la
  // carte, son remplissage de la teinte de l'action principale, qui s'y
  // détache à 3:1 (SIGNES, actionPrincipale).
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
    padding: var(--espace-3) var(--espace-4);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
  }

  p {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  .barre {
    box-sizing: border-box;
    width: 100%;
    height: 0.75rem;
    overflow: hidden;
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-pilule);
    background-color: var(--couleur-carte-fond-sourd);
  }

  .plein {
    height: 100%;
    background-color: var(--couleur-action-fond);
  }
</style>
