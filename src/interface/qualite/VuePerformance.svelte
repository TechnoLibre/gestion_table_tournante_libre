<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La vue « Performance du calcul » (§ 12.14, B23, D40, D49) de la page de
  // qualité : relancer plus longtemps aurait-il donné mieux ? Elle rend ce
  // que vuePerformance (performance.js) tire de la course du détail, sans
  // rien calculer (contrainte 41) :
  //
  // - la phrase de la source, sous [data-phrase-qualite] : sur le retenu,
  //   la proposition qu'elle mesure ; sans course gardée, que sa course ne
  //   l'est pas ; d'un seul point de relevé, qu'il n'y a rien à relier ;
  // - la ligne de tête [data-course], un morceau par élément de liste :
  //   mouvements évalués sur le compte, puis, pour une dérivée ou un retenu
  //   non ajusté venu d'une dérivée, « partie de la proposition n° X »,
  //   puis durée, cœurs, cadence et nombre de propositions de la
  //   génération, ou « durée inconnue » ;
  // - les petits multiples : un Escalier en forme points par valeur, sur
  //   l'abscisse logarithmique des mouvements, graduée aux points de
  //   relevé ; ils partagent leurs marges — l'abscisse alignée, point
  //   contre point — et le point pointé, désigné dans tous à la fois ;
  //   chaque graphique a son seul axe vertical, de zéro à sa plus grande
  //   valeur, et son infobulle porte la ligne du jumeau ;
  // - la phrase du dernier changement [data-dernier-changement] ;
  // - le jumeau, une ligne par point de relevé, le chemin du clavier et du
  //   lecteur d'écran vers chaque valeur.
  //
  // Elle reçoit le contrat de propriétés des vues — detail, le détail du
  // placement mesuré, null tant qu'il n'est pas calculé ; ligne, sa ligne
  // d'évaluation ; table, la table d'évaluation de la charge — et ne lit que
  // detail : le dernier point est le plan de la proposition, mesuré sous la
  // même charge que sa ligne. Son <div> porte data-vue-qualite, que la carte
  // ne transmet pas : il enveloppe la carte.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';
  import Escalier from './graphiques/Escalier.svelte';
  import Jumeau from './graphiques/Jumeau.svelte';
  import { margesCommunes } from './graphiques/pointage.js';
  import { vuePerformance } from './performance.js';

  let { detail = null, ligne = null, table = null } = $props();

  const t = getContext('t');
  const format = getContext('format');

  const vue = $derived(vuePerformance(detail, { t, format }));
  const remplie = $derived(vue.phrases.length > 0 || vue.tete !== null);
  // L'infobulle de chaque petit multiple : la ligne du jumeau du point
  // pointé.
  const infobulle = $derived(vue.jumeau === null ? null : { colonnes: vue.jumeau.colonnes, lignes: vue.jumeau.lignes });

  // Les marges que chaque petit multiple demande pour son texte, par rang,
  // absentes tant qu'il ne les a pas mesurées — la liaison lit alors null ;
  // tous reçoivent les plus grandes, et leurs abscisses s'alignent.
  let marges = $state([]);
  const alignees = $derived(margesCommunes(marges));
  // Le point de relevé pointé, commun aux petits multiples.
  let pointe = $state(null);
  let ouvert = $state(false);
</script>

<div data-vue-qualite="performance">
  {#if remplie}
    <Carte titre={t('qualite.vue.performance.titre')} sousTitre={t('qualite.vue.performance.question')} niveau={3}>
      <div class="performance">
        {#each vue.phrases as phrase (phrase.code)}
          <p data-phrase-qualite={phrase.code}>{phrase.texte}</p>
        {/each}
        {#if vue.tete !== null}
          <ul class="tete" data-course>
            {#each vue.tete as morceau, rang (rang)}
              <li>{morceau}</li>
            {/each}
          </ul>
        {/if}
        {#if vue.multiples.length > 0}
          <p class="synthese">{vue.synthese}</p>
          <div class="multiples">
            {#each vue.multiples as multiple, rang (multiple.nom)}
              <div class="multiple">
                <Escalier
                  graphique={multiple.graphique}
                  nom={multiple.titre}
                  synthese={multiple.synthese}
                  series={[{ libelle: multiple.libelle, valeurs: multiple.valeurs }]}
                  forme="points"
                  abscisses={vue.abscisses}
                  hauteur={150}
                  titreX={t('qualite.performance.axe')}
                  {infobulle}
                  alignerSur={alignees}
                  bind:marges={() => marges[rang] ?? null, (requises) => (marges[rang] = requises)}
                  bind:pointe
                />
              </div>
            {/each}
          </div>
        {/if}
        {#if vue.dernierChangement !== null}
          <p data-dernier-changement>{vue.dernierChangement}</p>
        {/if}
        {#if vue.jumeau !== null}
          <Jumeau tableaux={[vue.jumeau]} bind:ouvert />
        {/if}
      </div>
    </Carte>
  {:else}
    <Carte titre={t('qualite.vue.performance.titre')} sousTitre={t('qualite.vue.performance.question')} niveau={3} />
  {/if}
</div>

<style>
  .performance {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    min-width: 0;
  }

  p {
    margin: 0;
  }

  /* La ligne de tête : ses morceaux côte à côte, séparés par un filet,
     repliés quand ils ne tiennent pas. */
  .tete {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1) var(--espace-3);
    margin: 0;
    padding: 0;
    list-style: none;
    font-weight: bold;
  }

  .tete li + li {
    padding-left: var(--espace-3);
    border-left: 1px solid var(--couleur-carte-filet);
  }

  .synthese {
    color: var(--couleur-page-texte-secondaire);
  }

  /* Les petits multiples : deux par ligne quand la carte le permet, un
     seul sinon. */
  .multiples {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
    gap: var(--espace-4);
    min-width: 0;
  }

  .multiple {
    min-width: 0;
  }
</style>
