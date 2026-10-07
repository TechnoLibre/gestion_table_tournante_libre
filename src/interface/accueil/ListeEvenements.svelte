<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La liste des événements (§ 8.1) : une ligne par événement du dossier de
  // travail, dans l'ordre de la façade, que désigne data-evenement. Chaque
  // ligne porte la commande qui l'ouvre en lecture — son nom —, ses cinq
  // autres informations sous leur intitulé, chacune dans son propre nœud
  // (data-colonne), ses signalements traduits — les bases qu'un doublon
  // nomme suivent son texte, chacune dans son propre nœud (data-doublon) —,
  // le refus de son ouverture, et ses opérations. Un dossier sans événement n'affiche pas de liste vide :
  // la création et les démonstrations de l'accueil en tiennent lieu.
  //
  // lignes : LigneListe[] de la façade ; ouvrir(ligne) : le geste de
  // l'accueil ; refusOuverture : { base, refus } du dernier échec, ou null ;
  // apresOperation() : à appeler quand une opération a changé le dossier.
  import { getContext } from 'svelte';
  import Refus from '../primitives/Refus.svelte';
  import Operations from './Operations.svelte';
  import { ligneAffichee } from './modele.js';

  let { lignes, ouvrir, refusOuverture, apresOperation } = $props();

  const t = getContext('t');
  const format = getContext('format');
</script>

{#if lignes.length > 0}
  <ul class="liste">
    {#each lignes as ligne (ligne.base)}
      {@const affichee = ligneAffichee(ligne, format)}
      <li class="ligne" data-evenement={ligne.base}>
        <button type="button" class="ouvrir" data-commande="ouvrir" onclick={() => ouvrir(ligne)}
          ><span data-colonne="nom">{affichee.nom}</span></button
        >
        <dl class="informations">
          <div>
            <dt>{t('accueil.colonne.date')}</dt>
            <dd data-colonne="date">{affichee.date}</dd>
          </div>
          <div>
            <dt>{t('accueil.colonne.etat')}</dt>
            <dd data-colonne="etat">{t(affichee.etat)}</dd>
          </div>
          <div>
            <dt>{t('accueil.colonne.participants')}</dt>
            <dd data-colonne="participants">{affichee.participants}</dd>
          </div>
          <div>
            <dt>{t('accueil.colonne.modification')}</dt>
            <dd data-colonne="modification">{affichee.modification}</dd>
          </div>
          <div class="chemin">
            <dt>{t('accueil.colonne.chemin')}</dt>
            <dd data-colonne="chemin">{affichee.chemin}</dd>
          </div>
        </dl>
        {#each affichee.signalements as { cle, details, noms }, rang (rang)}
          <div class="signalement" data-signalement={cle}>
            <p>{t(cle, details)}</p>
            {#if noms.length > 0}
              <ul class="noms">
                {#each noms as nom (nom)}
                  <li data-doublon={nom}>{nom}</li>
                {/each}
              </ul>
            {/if}
          </div>
        {/each}
        {#if refusOuverture !== null && refusOuverture.base === ligne.base}
          <Refus refus={refusOuverture.refus} />
        {/if}
        <Operations {ligne} {apresOperation} />
      </li>
    {/each}
  </ul>
{/if}

<style>
  .liste {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .ligne {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    padding: var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
  }

  .ouvrir {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-titre);
    font-weight: bold;
    text-align: start;
    cursor: pointer;
  }

  .ouvrir:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .informations {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1) var(--espace-4);
    margin: 0;
  }

  .informations div {
    display: flex;
    flex-direction: column;
  }

  dt {
    color: var(--couleur-page-texte-secondaire);
  }

  dd {
    margin: 0;
  }

  .chemin dd {
    overflow-wrap: anywhere;
  }

  .signalement {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    padding: var(--espace-1) var(--espace-2);
    border-left: 3px solid var(--couleur-avis);
  }

  .signalement p {
    margin: 0;
  }

  .noms {
    margin: 0;
    padding-left: var(--espace-4);
    overflow-wrap: anywhere;
  }
</style>
