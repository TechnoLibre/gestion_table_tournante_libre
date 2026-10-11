<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Les avertissements de l'événement ouvert (§ 8.6, § 8.8, § 8.9, § 9), dans
  // l'ordre de la séance (avertissementsOrdonnes, modele.js) : chacun par le
  // texte de son code, puis ce qu'il nomme — les propositions écartées, leur
  // numéro et leurs fautes ; les placements en dérive et leurs raisons —,
  // puis son remède en Commande, par actionRemede (primitives/commande.js),
  // confirmé en place quand actionRemede le demande — « Débloquer ».
  // Un avertissement n'empêche rien.
  //
  // Chacun est un message d'avis : le fond, le filet et l'encre de l'avis,
  // le triangle de sa marque devant le texte. Le remède se pose en haut à
  // droite, sur la première ligne du texte, et non sous lui : dans la zone
  // des annonces, qui défile à la hauteur de la tête, l'action d'un
  // avertissement se voit dès que son début se voit, et n'est jamais
  // rognée par le bas de la zone. Ce qu'il nomme — propositions écartées,
  // placements en dérive — vient dessous, sur toute la largeur du message :
  // l'action n'étroitise que la première phrase. Une zone trop étroite pour
  // le texte et l'action côte à côte passe l'action sous le texte.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import Icone from '../primitives/Icone.svelte';
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
        <span class="signe"><Icone nom="triangle" taille={18} /></span>
        <p class:seul={action === null}>{t(avertissement.code, avertissement.details)}</p>
        {#if action !== null}
          <div class="action">
            <Commande
              cle={action.cle}
              details={action.details}
              nom={action.nom}
              confirmer={action.confirmer}
              executer={action.executer}
            />
          </div>
        {/if}
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
      </div>
    {/each}
  </section>
{/if}

<style>
  /* Des messages serrés : dans la zone des annonces, à la hauteur de la
     tête, les deux avertissements d'un journal abîmé, de deux lignes
     chacun, se voient l'un et l'autre. La liste est un conteneur de
     largeur, que lit la disposition étroite ci-dessous. */
  .avertissements {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    container-type: inline-size;
  }

  /* Une grille : le signe, le texte, l'action en haut à droite ; sous le
     texte et l'action, les listes, sur toute leur largeur. Sans action, le
     texte prend sa place. */
  .avertissement {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--espace-1) var(--espace-2);
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-avis-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-avis-fond);
    color: var(--couleur-avis);
    font-size: var(--taille-texte);
  }

  .signe {
    display: flex;
    grid-row: 1;
    padding-top: 0.125rem;
    color: var(--couleur-avis-marque);
  }

  p {
    grid-row: 1;
    grid-column: 2;
  }

  p.seul {
    grid-column: 2 / 4;
  }

  .action {
    grid-row: 1;
    grid-column: 3;
  }

  ul {
    grid-column: 2 / 4;
  }

  /* Une liste trop étroite pour le texte et l'action côte à côte — moins
     de 26rem — passe l'action sous le texte. */
  @container (max-width: 26rem) {
    p {
      grid-column: 2 / 4;
    }

    .action {
      grid-row: auto;
      grid-column: 2 / 4;
    }
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
