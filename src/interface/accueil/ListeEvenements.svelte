<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La liste des événements (§ 8.1) : une ligne par événement du dossier de
  // travail, dans l'ordre de la façade, que désigne data-evenement. Chaque
  // ligne porte la commande qui l'ouvre en lecture — son nom —, ses cinq
  // autres informations et les deux mesures de son retenu (COLONNES_DU_RETENU)
  // sous leur intitulé, chacune dans son propre nœud (data-colonne), ses
  // signalements traduits — les bases qu'un doublon
  // nomme suivent son texte, chacune dans son propre nœud (data-doublon) —,
  // le refus de son ouverture, et ses opérations. Un dossier sans événement n'affiche pas de liste vide :
  // la création et les démonstrations de l'accueil en tiennent lieu.
  //
  // lignes : LigneListe[] de la façade ; ouvrir(ligne) : le geste de
  // l'accueil ; refusOuverture : { base, refus } du dernier échec, ou null ;
  // apresOperation() : à appeler quand une opération a changé le dossier.
  //
  // L'intitulé de chaque mesure du retenu s'explique dans l'infobulle de la
  // liste, une seule (Infobulle, primitive) : son terme (data-terme) se
  // focalise au clavier, son survol ou son focus ouvre l'explication, le
  // quitter la referme quand elle est encore la sienne, Échap aussi. Le
  // terme expliqué porte aria-describedby vers elle, et lui seul.
  import { getContext } from 'svelte';
  import Infobulle from '../primitives/Infobulle.svelte';
  import Refus from '../primitives/Refus.svelte';
  import Operations from './Operations.svelte';
  import { COLONNES_DU_RETENU, ligneAffichee } from './modele.js';

  let { lignes, ouvrir, refusOuverture, apresOperation } = $props();

  const t = getContext('t');
  const format = getContext('format');

  // Le terme expliqué : {ancre, terme, cle, details} — son élément, sa
  // désignation '<base>:<colonne>' et la clé de son explication — ; null
  // sans infobulle.
  const uid = $props.id();
  const idExplication = `${uid}-explication`;
  let expliquee = $state(null);
  function expliquer(evenement, terme, cle) {
    expliquee = { ancre: evenement.currentTarget, terme, cle, details: {} };
  }
  function taire(terme) {
    if (expliquee?.terme === terme) expliquee = null;
  }
  const fermerExplication = () => (expliquee = null);
  // L'aria-describedby d'un terme : l'infobulle quand elle l'explique.
  const decrit = (terme) => (expliquee?.terme === terme ? idExplication : undefined);
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
          {#each COLONNES_DU_RETENU as { colonne, cle, explication } (colonne)}
            {@const terme = `${ligne.base}:${colonne}`}
            <div>
              <dt>
                <!-- L'intitulé est un terme, non une commande : le focus ne
                     sert qu'à montrer au clavier l'explication que le
                     pointeur montre au survol. -->
                <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
                <span
                  class="terme"
                  data-terme={colonne}
                  tabindex="0"
                  aria-describedby={decrit(terme)}
                  onmouseenter={(evenement) => expliquer(evenement, terme, explication)}
                  onmouseleave={() => taire(terme)}
                  onfocus={(evenement) => expliquer(evenement, terme, explication)}
                  onblur={() => taire(terme)}>{t(cle)}</span
                >
              </dt>
              <dd data-colonne={colonne}>{affichee[colonne]}</dd>
            </div>
          {/each}
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
  <Infobulle id={idExplication} ouverte={expliquee} fermer={fermerExplication} />
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

  /* Un intitulé qui s'explique se signale par un soulignement pointillé ;
     focalisé, par le contour du focus. */
  .terme {
    text-decoration: underline dotted;
    text-underline-offset: 0.2em;
  }

  .terme:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
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
