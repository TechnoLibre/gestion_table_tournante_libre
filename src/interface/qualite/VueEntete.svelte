<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La vue « En-tête chiffré » (§ 12.2, B11, D29, D34, D48) de la page de
  // qualité : la population mesurée, puis une tuile par colonne de mesure
  // du tableau des propositions, sous les groupes de ses en-têtes, puis la
  // mention du certificat. Elle reçoit le contrat de propriétés des vues —
  // detail, le détail du placement mesuré, null tant qu'il n'est pas
  // calculé ; ligne, sa ligne d'évaluation ; table, la table d'évaluation de
  // la charge — et rend ce que enteteDe (entete.js) en tire : rien ne se
  // calcule ici.
  //
  // Une tuile porte son libellé, sa valeur écrite comme au tableau, « ne
  // classe pas » quand le tableau ne porte pas sa colonne, son pourcentage
  // et le compte du pire (Pourcentage) sur trois tuiles seulement, puis les
  // lignes de sa borne, chacune d'une personne nommée. Le libellé est un
  // terme : le survol et le focus du clavier ouvrent l'infobulle de son
  // explication, celle de la colonne au tableau (Infobulle, primitive).
  //
  // Désignations : data-vue-qualite sur le <div> qui enveloppe la carte,
  // que la carte ne transmet pas ; data-tuile sur chaque tuile, par le nom
  // de sa colonne ; data-terme sur son libellé.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';
  import Infobulle from '../primitives/Infobulle.svelte';
  import Pourcentage from './graphiques/Pourcentage.svelte';
  import { enteteDe } from './entete.js';

  let { detail = null, ligne = null, table = null } = $props();

  const t = getContext('t');
  const format = getContext('format');
  const uid = $props.id();
  const idExplication = `${uid}-explication`;

  const entete = $derived(enteteDe({ detail, ligne, table }, { t, format }));

  // Le terme expliqué : {ancre, terme, cle, details}, null sans infobulle.
  // Ouvrir sur un terme remplace l'explication d'un autre ; quitter un terme
  // ne ferme que la sienne.
  let expliquee = $state(null);
  function expliquer(evenement, tuile) {
    expliquee = { ancre: evenement.currentTarget, terme: tuile.nom, cle: tuile.explication, details: {} };
  }
  function taire(tuile) {
    if (expliquee?.terme === tuile.nom) expliquee = null;
  }
  const fermer = () => (expliquee = null);
  const decrit = (tuile) => (expliquee?.terme === tuile.nom ? idExplication : undefined);
</script>

<div data-vue-qualite="entete">
  <Carte titre={t('qualite.vue.entete.titre')} sousTitre={t('qualite.vue.entete.question')} niveau={3}>
    {#if entete !== null}
      <div class="entete">
        <p class="population">{entete.population}</p>
        {#each entete.groupes as groupe (groupe.cle)}
          <section class="groupe" aria-labelledby="{uid}-{groupe.cle}">
            <h4 id="{uid}-{groupe.cle}">{groupe.libelle}</h4>
            <ul class="tuiles">
              {#each groupe.tuiles as tuile (tuile.nom)}
                <li class="tuile" data-tuile={tuile.nom}>
                  <!-- Le libellé est un terme, non une commande : le focus ne
                       sert qu'à montrer au clavier l'explication que le
                       pointeur montre au survol. -->
                  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
                  <span
                    class="libelle terme"
                    data-terme="tuile:{tuile.nom}"
                    tabindex="0"
                    aria-describedby={decrit(tuile)}
                    onmouseenter={(evenement) => expliquer(evenement, tuile)}
                    onmouseleave={() => taire(tuile)}
                    onfocus={(evenement) => expliquer(evenement, tuile)}
                    onblur={() => taire(tuile)}>{tuile.libelle}</span
                  >
                  <span class="valeur">{tuile.texte}</span>
                  {#if tuile.neClassePas !== null}
                    <span class="ne-classe-pas">{tuile.neClassePas}</span>
                  {/if}
                  {#if tuile.pourcentage !== null}
                    <Pourcentage texte={tuile.pourcentage.texte} compte={tuile.pourcentage.compte} />
                  {/if}
                  {#each tuile.bornes as borne, rang (rang)}
                    <span class="borne">{borne}</span>
                  {/each}
                </li>
              {/each}
            </ul>
          </section>
        {/each}
        <p class="certificat">{entete.certificat}</p>
      </div>
    {/if}
  </Carte>
  <Infobulle id={idExplication} ouverte={expliquee} {fermer} />
</div>

<style>
  .entete {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    min-width: 0;
  }

  p {
    margin: 0;
  }

  .population,
  .certificat {
    color: var(--couleur-page-texte-secondaire);
  }

  .groupe {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
  }

  /* L'intitulé d'un groupe : un intertitre en petit corps, comme la rangée
     des groupes du tableau. */
  h4 {
    margin: 0;
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
    font-weight: bold;
  }

  /* Les tuiles d'un groupe, côte à côte, qui passent à la ligne ; chacune
     sur le fond sourd de la carte, sous un filet. */
  .tuiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
    gap: var(--espace-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tuile {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    min-width: 0;
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond-sourd);
  }

  .libelle {
    align-self: flex-start;
    font-size: var(--taille-texte-petit);
  }

  /* Un libellé qui s'explique se signale par un soulignement pointillé ;
     focalisé, par le contour du focus. */
  .terme {
    text-decoration: underline dotted;
    text-underline-offset: 0.2em;
  }

  .terme:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .valeur {
    font-size: var(--taille-titre);
    font-weight: bold;
    font-variant-numeric: tabular-nums;
  }

  .ne-classe-pas,
  .borne {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }

  .ne-classe-pas {
    font-style: italic;
  }
</style>
