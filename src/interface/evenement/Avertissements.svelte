<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Les avertissements de l'événement ouvert (§ 8.6, § 8.8, § 8.9, § 9), dans
  // l'ordre de la séance (avertissementsOrdonnes, modele.js) : chacun par le
  // texte de son code, puis ce qu'il nomme — les propositions écartées, leur
  // numéro et leurs fautes ; les placements en dérive et leurs raisons —,
  // puis son remède en Commande, par actionRemede (primitives/commande.js),
  // confirmé en place quand actionRemede le demande — « Débloquer ».
  // PLACES_MANQUANTES offre en plus « Créer les tables… », qui ouvre la
  // section des tables, son formulaire déplié (demanderCreationTables,
  // CreerTables.svelte). Un avertissement n'empêche rien.
  //
  // Chacun est un message d'avis : le fond, le filet et l'encre de l'avis,
  // le triangle de sa marque devant le texte. Le remède se pose en haut à
  // droite, sur la première ligne du texte ; une liste trop étroite pour le
  // texte et l'action côte à côte passe l'action sous le texte, qui garde
  // alors toute la largeur du message. Ce qu'il nomme — propositions
  // écartées, placements en dérive — vient dessous, sur toute la largeur du
  // message : l'action n'étroitise que la première phrase. La zone des
  // annonces qui les porte prend la hauteur d'un avertissement ordinaire,
  // action comprise, et défile au-delà (SurfaceEvenement.svelte).
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import Icone from '../primitives/Icone.svelte';
  import { actionRemede } from '../primitives/commande.js';
  import { demanderCreationTables } from '../tables/CreerTables.svelte';
  import { avertissementsOrdonnes } from './modele.js';

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');

  const liste = $derived(avertissementsOrdonnes($seance));

  // La création des tables qui manquent, offerte à côté du remède de
  // PLACES_MANQUANTES quand l'état de navigation sait ouvrir les tables :
  // la demande précède l'ouverture, que le formulaire monté reçoit.
  function creerLesTables() {
    demanderCreationTables(seance);
    ui.allerA('tables');
  }
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
            {#if avertissement.code === 'PLACES_MANQUANTES' && ui !== null && ui !== undefined}
              <Commande cle="tables.manque.ouvrir" nom="creerTablesManquantes" executer={creerLesTables} />
            {/if}
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
  /* Des messages serrés : la zone des annonces en montre davantage sous
     son plafond. La liste est un conteneur de largeur, que lit la
     disposition étroite ci-dessous. */
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
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1);
    grid-row: 1;
    grid-column: 3;
  }

  ul {
    grid-column: 2 / 4;
  }

  /* Une liste trop étroite pour le texte et l'action côte à côte — moins
     de 30rem, comme la place des annonces à côté de la tête d'une fenêtre
     de 1 366 px — passe l'action sous le texte : le texte y garde toute la
     largeur du message, et tient en moins de lignes. */
  @container (max-width: 30rem) {
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
