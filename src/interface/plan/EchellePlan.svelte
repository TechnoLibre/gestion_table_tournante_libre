<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // L'échelle graphique et la mention du plan (§ 7.7), hors du <svg
  // data-plan>, dans la surface qui le porte : elles gardent leur taille à
  // l'écran, et un zoom ne réécrit que la transformation du dessin. La barre
  // a la largeur de sa longueur ronde à l'échelle k (echelleGraphique, P1),
  // jamais un rapport écrit en chiffres ; sa longueur se lit en cm, m ou km
  // (libelleLongueur), le nombre dans son propre nœud. La mention dit que la
  // disposition est relative : aucune dimension de salle n'est saisie.
  import { getContext } from 'svelte';
  import { echelleGraphique } from '../../geometrie/echelle.js';
  import { LARGEUR_ECHELLE_PX, libelleLongueur } from './modele.js';

  let { k } = $props();

  const t = getContext('t');
  const format = getContext('format');

  const echelle = $derived(echelleGraphique(k, LARGEUR_ECHELLE_PX));
  const longueur = $derived(libelleLongueur(echelle.longueurCm));
</script>

<div class="echelle">
  <div class="graduation" role="img" aria-label={t('plan.echelle.nom')}>
    <div class="barre" data-marque="echelle" style:width="{echelle.largeurPx}px"></div>
    <span class="longueur"
      ><span>{format.nombre(longueur.valeur, { decimales: longueur.decimales })}</span>&#32;<span
        >{t(longueur.cle)}</span
      ></span
    >
  </div>
  <p class="mention">{t('plan.echelle.mention')}</p>
</div>

<style>
  .echelle {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte-petit);
  }

  .graduation {
    display: flex;
    align-items: center;
    gap: var(--espace-2);
  }

  .barre {
    box-sizing: border-box;
    height: 0.5rem;
    background: var(--couleur-echelle);
  }

  .mention {
    margin: 0;
  }
</style>
