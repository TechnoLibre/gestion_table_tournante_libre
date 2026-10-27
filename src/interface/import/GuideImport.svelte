<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Le guide de l'import, § 10.1 et § 10.4 : un bloc replié sous « Télécharger
  // un modèle », que son bouton « Guide import » ouvre et ferme. Le bouton
  // dit son état par aria-expanded et désigne le contenu ouvert par
  // aria-controls ; son chevron, tourné vers le bas quand le bloc est
  // ouvert, le redit sans la couleur. Le bloc est fermé à l'ouverture de la
  // section, et son état n'appartient qu'à ce composant : il ne s'écrit
  // nulle part.
  //
  // Ouvert, il porte les consignes générales, puis le tableau des colonnes
  // de la nature reçue (guideDeLImport) : une ligne par colonne reconnue,
  // dans l'ordre de sa table d'en-têtes, son en-tête et ses synonymes en
  // code, tels que la table les écrit, une graphie par apostrophe, s'il est
  // obligatoire, et son texte de guide. Changer de nature change le tableau, le bloc restant ouvert.
  import { getContext } from 'svelte';
  import Icone from '../primitives/Icone.svelte';
  import { CONSIGNES_DU_GUIDE, guideDeLImport } from './modele.js';

  /** @type {{nature: 'participants'|'objectifs'}} */
  let { nature } = $props();

  const t = getContext('t');
  const uid = $props.id();
  const idContenu = `${uid}-guide`;

  let ouvert = $state(false);
  const guide = $derived(guideDeLImport(nature));
</script>

<div class="guide">
  <button
    type="button"
    class="deplier"
    data-commande="guideImport"
    aria-expanded={ouvert ? 'true' : 'false'}
    aria-controls={ouvert ? idContenu : undefined}
    onclick={() => (ouvert = !ouvert)}
  >
    <span class="chevron"><Icone nom="chevron" /></span>
    <span>{t('import.guide.titre')}</span>
  </button>
  {#if ouvert}
    <div class="contenu" id={idContenu} data-guide-import>
      <ul class="consignes">
        {#each CONSIGNES_DU_GUIDE as cle (cle)}
          <li>{t(cle)}</li>
        {/each}
      </ul>
      <div class="defile">
        <table>
          <caption>{t(guide.legende)}</caption>
          <thead>
            <tr>
              <th scope="col">{t('import.guide.entete')}</th>
              <th scope="col">{t('import.guide.obligatoire')}</th>
              <th scope="col">{t('import.guide.contenu')}</th>
              <th scope="col">{t('import.guide.synonymes')}</th>
            </tr>
          </thead>
          <tbody>
            {#each guide.colonnes as colonne (colonne.champ)}
              <tr data-guide-colonne={colonne.champ}>
                <th scope="row"><code>{colonne.entete}</code></th>
                <td>{t(colonne.obligatoire ? 'import.guide.oui' : 'import.guide.non')}</td>
                <td><div class="texte">{t(colonne.cle)}</div></td>
                <td>
                  {#if colonne.synonymes.length === 0}
                    {t('import.guide.aucunSynonyme')}
                  {:else}
                    <ul class="synonymes">
                      {#each colonne.synonymes as synonyme (synonyme)}
                        <li><code>{synonyme}</code></li>
                      {/each}
                    </ul>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  .guide {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--espace-2);
    margin-top: var(--espace-3);
  }

  /* Le bouton qui déplie le guide : un texte de l'encre de la page, sans
     fond, et son chevron, tourné vers le bas quand le guide est ouvert. */
  .deplier {
    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    gap: var(--espace-1);
    min-height: var(--hauteur-cible);
    padding: 0 var(--espace-2);
    border: 1px solid transparent;
    border-radius: var(--rayon-2);
    background: none;
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
    cursor: pointer;
  }

  .deplier:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 1px;
  }

  .chevron {
    display: inline-flex;
  }

  .deplier[aria-expanded='true'] .chevron {
    transform: rotate(90deg);
  }

  .contenu {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
  }

  ul {
    margin: 0;
  }

  .consignes {
    padding-left: var(--espace-5);
  }

  /* Les synonymes d'une colonne, côte à côte, chacun en code. */
  .synonymes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1) var(--espace-2);
    padding: 0;
    list-style: none;
  }

  /* Un tableau plus large que la carte défile en elle, plutôt que
     d'élargir la page. */
  .defile {
    overflow-x: auto;
  }

  table {
    border-collapse: separate;
    border-spacing: 0;
  }

  caption {
    text-align: left;
    font-weight: bold;
    padding-bottom: var(--espace-1);
  }

  th,
  td {
    padding: var(--espace-1) var(--espace-2);
    border-bottom: 1px solid var(--couleur-ligne-filet);
    text-align: left;
    vertical-align: top;
  }

  thead th {
    border-top: 1px solid var(--couleur-carte-filet);
    border-bottom-color: var(--couleur-page-filet);
    background-color: var(--couleur-carte-fond-sourd);
  }

  /* Le texte d'une colonne garde une largeur de lecture, que l'en-tête et
     les synonymes ne lui prennent pas : une cellule ne tient pas de largeur
     minimale, le bloc qu'elle porte si. Plus étroite, la carte fait défiler
     le tableau. */
  .texte {
    min-width: 16rem;
  }

  /* Un en-tête ou un synonyme, dans la police de l'interface, la seule
     qu'elle emploie, sur le fond sourd de la carte : il ne se coupe pas, et
     « conflit_organisation » se lit d'un bloc, comme le tableur l'écrit. */
  code {
    padding: 0 var(--espace-1);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-carte-fond-sourd);
    font-family: inherit;
    font-size: inherit;
    white-space: nowrap;
  }
</style>
