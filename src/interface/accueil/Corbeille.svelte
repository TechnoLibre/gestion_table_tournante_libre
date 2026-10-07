<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La corbeille du dossier de travail (§ 8.7) : un événement supprimé y est
  // déplacé avec tous ses fichiers, dans un dossier daté, et le logiciel ne la
  // vide jamais. Chaque dossier daté montre son chemin en entier et le nom de
  // chacun de ses fichiers, des données dans leur propre nœud. Une corbeille
  // vide ne montre rien.
  //
  // contenu : [{ dossier, chemin, fichiers }] de facade.corbeille().
  import { getContext } from 'svelte';

  let { contenu } = $props();

  const t = getContext('t');
  const uid = $props.id();
</script>

{#if contenu.length > 0}
  <section class="corbeille" data-corbeille aria-labelledby={`${uid}-titre`}>
    <h2 id={`${uid}-titre`}>{t('accueil.corbeille.titre')}</h2>
    <p>{t('accueil.corbeille.explication')}</p>
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
  </section>
{/if}

<style>
  .corbeille,
  .dossiers {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
  }

  h2,
  p {
    margin: 0;
  }

  h2 {
    font-size: var(--taille-titre);
  }

  .dossiers {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .chemin {
    overflow-wrap: anywhere;
  }

  .fichiers {
    margin: 0;
    padding-left: var(--espace-4);
    color: var(--couleur-page-texte-secondaire);
  }
</style>
