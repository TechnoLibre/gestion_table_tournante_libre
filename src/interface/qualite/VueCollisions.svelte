<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La vue « Collisions d'appartenance » (§ 12.4, B13, D31) de la page de
  // qualité : des barres horizontales, une par appartenance, la pire en
  // haut — l'excédent décroissant, dans l'ordre du détail —, chacune en deux
  // segments qui partent de zéro, « prouvé inévitable » et « reste », sur un
  // axe commun, puis en encre secondaire son effectif, ses paires distinctes
  // et son excédent ; l'intitulé porte la pastille de l'appartenance, de la
  // teinte que teintesAppartenances donne sur tous les participants de
  // l'événement, exclus compris, et le tracé n'en prend aucune. Hors du
  // domaine des planchers, chaque barre n'a qu'un segment, les collisions
  // cumulées, et une phrase dit pourquoi. Une seule table, aucune
  // appartenance, aucune collision : la phrase du cas en tient lieu
  // (§ 12.6, B15). Sous le graphique, son jumeau.
  //
  // Elle reçoit le contrat de propriétés des vues — detail, le détail du
  // placement mesuré, null tant qu'il n'est pas calculé ; ligne et table, que
  // cette vue ne lit pas — et met en forme le détail par modeleCollisions
  // (appartenances.js), sans rien calculer. Son <div> porte data-vue-qualite,
  // que la carte ne transmet pas : il enveloppe la carte.
  import { getContext } from 'svelte';
  import { teintesAppartenances } from '../appartenances.js';
  import Carte from '../primitives/Carte.svelte';
  import { modeleCollisions } from './appartenances.js';
  import Barres from './graphiques/Barres.svelte';
  import Jumeau from './graphiques/Jumeau.svelte';

  let { detail = null, ligne = null, table = null } = $props();

  const t = getContext('t');
  const seance = getContext('seance');

  const teintes = $derived(teintesAppartenances($seance.charge?.participants ?? []));
  const modele = $derived(detail === null || detail.collisions === null ? null : modeleCollisions(detail, { t, teintes }));
  let pointe = $state(null);
</script>

<div data-vue-qualite="collisions">
  <Carte titre={t('qualite.vue.collisions.titre')} sousTitre={t('qualite.vue.collisions.question')} niveau={3}>
    {#if modele !== null}
      <div class="corps">
        {#if modele.phrase !== null}
          <p data-phrase-qualite={modele.code}>{modele.phrase}</p>
        {/if}
        {#if modele.graphique !== null}
          {@const g = modele.graphique}
          <Barres
            graphique="collisions"
            nom={g.nom}
            synthese={g.synthese}
            lignes={g.lignes}
            segments={g.segments}
            infobulle={g.infobulle}
            bind:pointe
          />
          <Jumeau tableaux={modele.tableaux} />
        {/if}
      </div>
    {/if}
  </Carte>
</div>

<style>
  .corps {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    min-width: 0;
  }

  p {
    margin: 0;
  }
</style>
