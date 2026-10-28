<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Les noms des tours (§ 4, § 8.9) : un champ par tour, dans l'ordre des
  // tours, vide pour un tour sans nom, dont le texte indicatif est le nom
  // par défaut, « Tour 3 ». La saisie se lit par lireNomTour — le nom par
  // défaut vaut le champ vide — et s'exécute par changerNomTour, une
  // entrée, qui retire le nom d'un champ vidé ; son refus, un nom trop
  // long, se pose contre le champ. Changer le nombre de tours ajoute ou
  // retire des champs : un tour ajouté vient sans nom, et la fenêtre de la
  // baisse nomme le nom d'un tour qu'elle retire (Tours).
  import { getContext } from 'svelte';
  import { nomsDesTours } from '../../application/tours.js';
  import Champ from '../primitives/Champ.svelte';
  import { lireNomTour } from './modele.js';

  let { charge } = $props();

  const t = getContext('t');
  const seance = getContext('seance');

  const noms = $derived(nomsDesTours(charge));
</script>

<fieldset class="noms" data-noms-tours>
  <legend>{t('tables.tours.noms')}</legend>
  <div class="champs">
    {#each noms as nom, rang (rang)}
      <Champ
        cle={`nom-tour-${rang + 1}`}
        etiquette="tables.tours.nom"
        details={{ tour: rang + 1 }}
        valeur={nom ?? ''}
        indice={t('tables.tours.nomParDefaut', { tour: rang + 1 })}
        lire={lireNomTour(rang + 1)}
        executer={(saisi) => seance.executer('changerNomTour', { tour: rang + 1, nom: saisi })}
      />
    {/each}
  </div>
</fieldset>

<style>
  .noms {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  /* Le titre du groupe, comme celui du tableau des présences par tour. */
  legend {
    padding: 0 0 var(--espace-1);
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  /* Un champ par tour, en rangées qui se replient à la largeur de la
     carte. */
  .champs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2) var(--espace-4);
  }
</style>
