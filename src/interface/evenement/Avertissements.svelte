<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Les avertissements de l'événement ouvert (§ 8.6, § 8.8, § 8.9, § 9), dans
  // l'ordre de la séance (avertissementsOrdonnes, modele.js) : chacun par le
  // texte de son code, puis ce qu'il nomme — les propositions écartées, leur
  // numéro et leurs fautes ; les placements en dérive et leurs raisons —,
  // puis son remède en Commande, par actionRemede (primitives/commande.js).
  // Un avertissement n'empêche rien.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import { actionRemede } from '../primitives/commande.js';
  import { avertissementsOrdonnes } from './modele.js';

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');

  const liste = $derived(avertissementsOrdonnes($seance));
</script>

{#if liste.length > 0}
  <section class="avertissements" aria-label={t('evenement.avertissements')}>
    {#each liste as avertissement, rang (rang)}
      {@const action = actionRemede(avertissement.remede, { seance, ui })}
      <div class="avertissement" role="status" data-avertissement={avertissement.code}>
        <p>{t(avertissement.code, avertissement.details)}</p>
        {#if avertissement.fautives !== undefined && avertissement.fautives.length > 0}
          <ul>
            {#each avertissement.fautives as fautive, n (n)}
              <li data-fautive={fautive.id ?? ''}>
                {#if fautive.id !== null}
                  <span>{t('evenement.fautive.numero')}</span>
                  <span class="donnee">{fautive.id}</span>
                {:else}
                  <span>{t('evenement.fautive.rang')}</span>
                  <span class="donnee">{fautive.rang}</span>
                {/if}
                {#each fautive.fautes as faute, f (f)}
                  <span>{t(faute.code, faute)}</span>
                {/each}
              </li>
            {/each}
          </ul>
        {/if}
        {#if avertissement.derives !== undefined && avertissement.derives.length > 0}
          <ul>
            {#each avertissement.derives as derive (derive.id)}
              <li data-derive={derive.id}>
                {#if derive.id === 'retenu'}
                  <span>{t('evenement.derive.retenu')}</span>
                {:else}
                  <span>{t('evenement.derive.proposition')}</span>
                  <span class="donnee">{derive.id}</span>
                {/if}
                {#each derive.raisons as raison, r (r)}
                  <span>{t(raison.code, raison)}</span>
                {/each}
              </li>
            {/each}
          </ul>
        {/if}
        {#if action !== null}
          <Commande cle={action.cle} details={action.details} nom={action.nom} executer={action.executer} />
        {/if}
      </div>
    {/each}
  </section>
{/if}

<style>
  .avertissements {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
  }

  .avertissement {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
    padding: var(--espace-1) var(--espace-2);
    border-left: 3px solid var(--couleur-avis);
    font-size: var(--taille-texte);
  }

  p,
  ul {
    margin: 0;
  }

  ul {
    padding-left: var(--espace-4);
  }

  li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1) var(--espace-2);
  }

  .donnee {
    font-weight: bold;
  }
</style>
