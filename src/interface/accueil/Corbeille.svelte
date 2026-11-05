<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La corbeille du dossier de travail (§ 8.7) : un événement supprimé y est
  // déplacé avec tout le contenu de son dossier, dans un dossier daté, et le
  // logiciel ne la vide jamais. Chaque dossier daté montre son chemin en
  // entier et chacun de ses fichiers, à toute profondeur, par son chemin
  // relatif au dossier daté, au séparateur du système — « logo\‹nom› » pour
  // un fichier du sous-dossier logo —, des données dans leur propre nœud.
  // Une corbeille vide ne montre rien.
  //
  // contenu : [{ dossier, chemin, fichiers }] de facade.corbeille().
  //
  // La corbeille est une carte titrée, l'explication en sous-titre ; elle
  // n'offre aucune commande.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';

  let { contenu } = $props();

  const t = getContext('t');
</script>

{#if contenu.length > 0}
  <div class="corbeille" data-corbeille>
    <Carte titre={t('accueil.corbeille.titre')} sousTitre={t('accueil.corbeille.explication')} icone="dossier">
      <ul class="dossiers">
        {#each contenu as { dossier, chemin, fichiers } (dossier)}
          <li data-corbeille-dossier={dossier}>
            <p class="chemin">{chemin}</p>
            <ul class="fichiers">
              {#each fichiers as nom (nom)}
                <li>{nom}</li>
              {/each}
            </ul>
          </li>
        {/each}
      </ul>
    </Carte>
  </div>
{/if}

<style>
  .corbeille {
    min-width: 0;
  }

  .dossiers {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  p {
    margin: 0;
  }

  .chemin {
    font-size: var(--taille-texte-petit);
    font-weight: bold;
    overflow-wrap: anywhere;
  }

  .fichiers {
    margin: 0;
    padding-left: var(--espace-4);
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
    overflow-wrap: anywhere;
  }
</style>
