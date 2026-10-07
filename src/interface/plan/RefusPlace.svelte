<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Un refus, ou un avertissement, posé sur une place du plan (§ 5.9, § 6.2,
  // § 7.1) : hors du <svg data-plan>, dans la surface qui le porte, à la
  // position que Plan.svelte calcule par ecranDepuisDessin au moment du
  // refus, puis à chaque changement de vue. Il nomme la place — la table, et
  // le siège quand c'en est un, par le libellé que rend libellePlace —, puis
  // montre le refus et chacun de details.autres par la primitive Refus,
  // chacun avec la commande de son remède, puis chaque avertissement. La
  // place le désigne par aria-describedby, vers id.
  //
  // pose : {id, numero, siege|null, refus|null, avertissements, x, y} — x et y
  // en px de la surface ; fermer : retire la pose.
  import { getContext } from 'svelte';
  import Refus from '../primitives/Refus.svelte';
  import { libellePlace } from './gestes.js';

  let { pose, fermer } = $props();

  const t = getContext('t');
  const libelle = $derived(libellePlace(pose));
</script>

<div class="refus-place" id={pose.id} style:left="{pose.x}px" style:top="{pose.y}px">
  <p class="place">
    {t(libelle.cle, libelle.details)}
  </p>
  {#if pose.refus !== null}
    <Refus refus={pose.refus} lever={fermer} />
  {/if}
  {#each pose.avertissements as avertissement, rang (rang)}
    <p class="avertissement" role="status" data-avertissement={avertissement.code}>{t(avertissement.code, avertissement.details)}</p>
  {/each}
  <button type="button" class="fermer" onclick={fermer}>{t('plan.refus.fermer')}</button>
</div>

<style>
  .refus-place {
    position: absolute;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
    box-sizing: border-box;
    max-width: 22rem;
    padding: var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-1);
    font-size: var(--taille-texte);
  }

  p {
    margin: 0;
  }

  .place {
    font-weight: 700;
  }

  .avertissement {
    color: var(--couleur-avis);
  }
</style>
