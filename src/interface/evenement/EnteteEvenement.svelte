<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // L'en-tête de l'événement ouvert (§ 9) : son nom, puis ses quatre états,
  // dans l'ordre du § 9. Un état se pose en le cliquant, par la commande
  // changerEtat de la séance — « Bloqué » est la commande « Bloquer », après
  // laquelle la séance revient en lecture et rend le verrou. Ce que la séance
  // refuse — la lecture, un plan bloqué, « Retenu » sans placement retenu,
  // « Proposé » sans proposition — s'affiche à côté de l'état cliqué, avec
  // son remède. L'état courant se distingue par sa forme : gras, et un trait
  // sous lui. Le nom se coupe où il le faut, même sans espace : un nom long
  // de glyphes larges passe à la ligne au lieu d'élargir la page.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import { ETATS_PLAN, cleEtat } from './modele.js';

  const t = getContext('t');
  const seance = getContext('seance');

  const courant = $derived($seance.evenement?.etat ?? null);
</script>

<header class="entete">
  <h1>{$seance.evenement?.nom}</h1>
  <div class="etats" role="group" aria-label={t('evenement.etat.titre')}>
    {#each ETATS_PLAN as etat (etat)}
      <span class="etat" class:courant={courant === etat} data-etat={etat}>
        <Commande cle={cleEtat(etat)} nom="etat" executer={() => seance.executer('changerEtat', { etat })} />
      </span>
    {/each}
  </div>
</header>

<style>
  .entete {
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2) var(--espace-4);
  }

  h1 {
    min-width: 0;
    margin: 0;
    font-size: var(--taille-titre);
    overflow-wrap: anywhere;
  }

  .etats {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  .etat {
    padding-bottom: var(--espace-1);
    border-bottom: 3px solid var(--couleur-page-fond);
  }

  .etat.courant {
    border-bottom-color: var(--couleur-page-texte);
    font-weight: bold;
  }
</style>
