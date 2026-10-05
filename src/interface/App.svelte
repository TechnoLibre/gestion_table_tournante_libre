<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Racine de l'interface. Le bandeau d'application, présent sur tout écran,
  // porte le nom, la version affichée et la provenance de la construction ;
  // le nom suivi de la version affichée devient aussi le titre de la fenêtre
  // (§ 8.4, § 18.6). La provenance vient du mode de Vite, que pose la
  // commande de construction.
  import './jetons.css';
  import { VERSION } from '../version.genere.js';
  import { libelleProvenance, titreAvecVersion } from './libelles.js';

  const titre = titreAvecVersion(VERSION.affichee);
  const provenance = libelleProvenance(import.meta.env.MODE);
</script>

<svelte:head>
  <title>{titre}</title>
</svelte:head>

<header class="bandeau">
  <span class="titre">{titre}</span>
  <span class="provenance">{provenance}</span>
</header>

<style>
  :global(body) {
    margin: 0;
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font-family: var(--police-interface);
  }

  .bandeau {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--espace-3);
    padding: var(--espace-2) var(--espace-4);
    border-bottom: 1px solid var(--couleur-bandeau-filet);
    background-color: var(--couleur-bandeau-fond);
    color: var(--couleur-bandeau-texte);
    font-size: var(--taille-texte-bandeau);
  }

  .provenance {
    padding: 0 var(--espace-2);
    border: 1px solid var(--couleur-bandeau-filet);
    border-radius: var(--rayon-1);
  }
</style>
