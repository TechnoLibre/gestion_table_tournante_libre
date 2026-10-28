<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La vue « Objectifs des tables » (§ 12.12, B21, D34, D36) de la page de
  // qualité. Elle reçoit le contrat de propriétés des vues — detail, le
  // détail du placement mesuré, null tant qu'il n'est pas calculé ; ligne,
  // sa ligne d'évaluation ; table, la table d'évaluation de la charge — et
  // ne lit que detail, mis en forme par modeleObjectifs (objectifs.js) : la
  // vue ne calcule rien.
  //
  // Dans l'ordre : les phrases du critère décoché — la vue ne classe pas,
  // ses planchers se dessinent quand même — et du domaine des planchers ;
  // les personnes jamais servies, à place fixe, chacune avec ses tours
  // possibles ; la soirée en texte, absente à un seul tour — la part des
  // tours possibles servis, suivie des personnes jamais servies, puis ses
  // deux comptes, ses tours hors objectif et leur plancher ; les barres
  // par tour, le tour au plus grand reste en tête, chaque ligne suivie de
  // ses assis sans table possible ; dessous, dans l'ordre des barres et en
  // encre secondaire, le pourcentage de chaque tour et ses deux comptes —
  // un pourcentage s'écrit hors du dessin, par Pourcentage, son compte juste
  // après lui ; enfin le jumeau. Sans personne concernée, la vue cède la
  // place à sa phrase.
  //
  // Désignations : data-vue-qualite sur le <div> qui enveloppe la carte, que
  // la carte ne transmet pas ; data-jamais-servies sur la liste des
  // personnes jamais servies, data-soiree-objectifs sur la ligne de la
  // soirée, data-phrase-qualite sur chaque phrase, par son cas.
  //
  // Les tours se nomment par les noms que leur donne la charge de la séance
  // (nomsDesTours), sinon par « Tour 3 ».
  import { getContext } from 'svelte';
  import { nomsDesTours } from '../../application/tours.js';
  import Carte from '../primitives/Carte.svelte';
  import Barres from './graphiques/Barres.svelte';
  import Jumeau from './graphiques/Jumeau.svelte';
  import Pourcentage from './graphiques/Pourcentage.svelte';
  import { modeleObjectifs } from './objectifs.js';

  let { detail = null, ligne = null, table = null } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const uid = $props.id();
  const idJamais = `${uid}-jamais`;
  const nomsTours = $derived($seance?.charge ? nomsDesTours($seance.charge) : undefined);
  const modele = $derived(modeleObjectifs(detail, t, nomsTours));
</script>

<div data-vue-qualite="objectifs">
  <Carte titre={t('qualite.vue.objectifs.titre')} sousTitre={t('qualite.vue.objectifs.question')} niveau={3}>
    {#if modele !== null}
      {#if modele.cas === 'aucunConcerne'}
        <p data-phrase-qualite="objectifs.aucunConcerne">{t('qualite.objectifs.aucunConcerne')}</p>
      {:else}
        <div class="vue">
          {#if modele.neClassePas}
            <p data-phrase-qualite="objectifs.critereDecoche">{t('qualite.objectifs.critereDecoche')}</p>
          {/if}
          {#if !modele.planchersValides}
            <p data-phrase-qualite="objectifs.horsDomaine">{t('qualite.objectifs.horsDomaine')}</p>
          {/if}
          <section class="jamais" aria-labelledby={idJamais}>
            <h4 id={idJamais}>{t('qualite.objectifs.jamaisServies')}</h4>
            {#if modele.jamaisServies.length === 0}
              <p class="secondaire" data-jamais-servies>{t('qualite.objectifs.aucuneJamaisServie')}</p>
            {:else}
              <ul data-jamais-servies>
                {#each modele.jamaisServies as personne (personne.id)}
                  <li><span class="nom">{personne.nom}</span><span class="secondaire">{personne.possibles}</span></li>
                {/each}
              </ul>
            {/if}
          </section>
          {#if modele.soiree !== null}
            <div class="soiree" data-soiree-objectifs>
              <Pourcentage texte={modele.soiree.pourcentage.texte} compte={modele.soiree.pourcentage.compte} />
              <p>{modele.soiree.comptes}</p>
              <p>{modele.soiree.hors}</p>
            </div>
          {/if}
          <Barres
            graphique="objectifs"
            nom={modele.barres.nom}
            synthese={modele.barres.synthese}
            lignes={modele.barres.lignes}
            segments={modele.barres.segments}
            infobulle={modele.infobulle}
          />
          <ol class="tours" aria-label={t('qualite.objectifs.parTour')}>
            {#each modele.tours as tour (tour.tour)}
              <li>
                <span class="tour">{tour.nom}</span>
                <Pourcentage texte={tour.pourcentage.texte} compte={tour.pourcentage.compte} />
              </li>
            {/each}
          </ol>
          <Jumeau tableaux={modele.jumeau} />
        </div>
      {/if}
    {/if}
  </Carte>
</div>

<style>
  .vue {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    min-width: 0;
  }

  p {
    margin: 0;
  }

  h4 {
    margin: 0 0 var(--espace-1);
    font-size: var(--taille-texte);
  }

  /* Les personnes jamais servies : le nom, puis ses tours possibles en
     encre secondaire, une par ligne. */
  ul {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--espace-2);
  }

  .nom {
    font-weight: bold;
  }

  .secondaire {
    color: var(--couleur-page-texte-secondaire);
  }

  /* La soirée, en texte : la part servie en gras, son compte dessous, puis
     ses comptes. */
  .soiree {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  .soiree :global([data-pourcentage]) {
    font-weight: bold;
  }

  /* Le pourcentage de chaque tour, dans l'ordre des barres, en encre
     secondaire : côte à côte, chacun son compte dessous. */
  .tours {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2) var(--espace-5);
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--couleur-page-texte-secondaire);
  }

  .tours li {
    flex-direction: column;
    gap: 0;
  }

  .tour {
    font-size: var(--taille-texte-petit);
  }
</style>
