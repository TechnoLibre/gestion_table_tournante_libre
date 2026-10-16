<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La section de la qualité (§ 12, B9, D24, D25) : la page qui mesure la
  // proposition demandée au plan, sinon le retenu, que le plan la montre ou
  // non. Elle ne modifie rien : elle se lit en lecture, en écriture et sur un
  // plan bloqué, et reste ouverte pendant une génération ; aucune commande
  // n'y passe par la séance (§ 8.4).
  //
  // La source se lit par sourceQualite (source.js), sur la charge de l'état
  // observable et la proposition demandée au plan — le placement entier, à
  // chaque tour du plan : la ligne de source reprend le libellé de la barre
  // de vue du plan, ou dit qu'une proposition fautive n'y est pas montrée,
  // et sa commande de retour ne montre plus la proposition demandée. Une
  // source qui est une proposition dérivée porte, sous cette ligne, la
  // phrase qui la rattache à son départ, celle du tableau des propositions
  // (texteFiliation, propositions/filiation.js), quel que soit son statut ;
  // le retenu garde son libellé, sa filiation se lisant dans la
  // performance (§ 12.6, § 12.14, C17, C23, D76). Sans
  // source mesurable, la page ne dessine aucune vue, et un seul de ses cas
  // s'écrit, chacun par sa phrase [data-phrase-qualite] :
  //
  // - configuration : la configuration ne se normalise pas, et le refus de
  //   la génération, son code traduit ;
  // - aucunPlacement : ni proposition ni retenu, et le diagnostic préalable,
  //   sous sa forme compacte ;
  // - aucuneMontree : des propositions, aucune demandée au plan ni retenue,
  //   et la commande qui montre la première comparable du classement, absente
  //   quand aucune ne se compare ;
  // - derive, fautif : la source ne se mesure pas, et ses raisons, chacune
  //   suivie de la personne qu'elle nomme, comme au tableau des propositions.
  //
  // Une source mesurable dont une mesure contredit sa borne (refusDessin,
  // § 12.3) n'est pas dessinée : la phrase du refus, puis chaque
  // contradiction, son code traduit et la personne nommée.
  //
  // Sinon, la liste des vues, dans leur ordre à l'écran, mène à chacune :
  // un lien porte le focus sur la vue, qui se fait voir. Puis les dix vues,
  // chacune sous le contrat de propriétés {detail, ligne, table} — le
  // détail du placement (detailDe, modele.js), la ligne d'évaluation de la
  // source, la table d'évaluation de la charge. Le détail se mesure pour la
  // seule source mesurable, avec la course que la séance garde et la
  // génération qui l'a produite ; sa garde à quatre paramètres donne les
  // contradictions qui retirent le dessin.
  //
  // Elle pose le contexte dessinDiffere : un graphique loin de la zone
  // visible n'est dessiné que quand il en approche (Graphique), et la vue
  // de comparaison ne se calcule qu'à son premier dessin (VueComparaison),
  // si bien que l'ouverture ne mesure et ne rend que ce qui se voit.
  //
  // La vue que la navigation demande (ui.demanderVueQualite, la
  // comparaison que « Comparer » ouvre) se porte à l'écran et au focus
  // comme par son lien, une fois la page rendue, puis la demande se retire
  // (ui.vueQualiteAtteinte) ; sans vue à l'écran — une source qui ne se
  // mesure pas —, elle se retire aussi, et le focus ne bouge pas.
  import { flushSync, getContext, setContext } from 'svelte';
  import Diagnostic from '../diagnostic/Diagnostic.svelte';
  import Carte from '../primitives/Carte.svelte';
  import Commande from '../primitives/Commande.svelte';
  import Refus from '../primitives/Refus.svelte';
  import { derivationDe } from '../../application/depart.js';
  import { texteFiliation } from '../propositions/filiation.js';
  import { evaluation, nomDe } from '../propositions/modele.js';
  import { detailDe } from './modele.js';
  import { sourceQualite } from './source.js';
  import VueAnimateurs from './VueAnimateurs.svelte';
  import VueCollisions from './VueCollisions.svelte';
  import VueComparaison from './VueComparaison.svelte';
  import VueDiversite from './VueDiversite.svelte';
  import VueEntete from './VueEntete.svelte';
  import VueObjectifs from './VueObjectifs.svelte';
  import VuePaires from './VuePaires.svelte';
  import VuePerformance from './VuePerformance.svelte';
  import VueProfil from './VueProfil.svelte';
  import VueTables from './VueTables.svelte';
  import { creerDessinDiffere } from './graphiques/dessin_differe.js';

  const t = getContext('t');
  const format = getContext('format');
  const ui = getContext('ui');
  const seance = getContext('seance');
  const generation = getContext('generation');
  const uid = $props.id();
  const dessinDiffere = setContext('dessinDiffere', creerDessinDiffere());

  // Les vues, dans leur ordre à l'écran (§ 12, B9), chacune sous le nom de
  // la clé de son titre, qualite.vue.<nom>.titre.
  const VUES = [
    ['entete', VueEntete],
    ['profil', VueProfil],
    ['comparaison', VueComparaison],
    ['collisions', VueCollisions],
    ['tables', VueTables],
    ['paires', VuePaires],
    ['objectifs', VueObjectifs],
    ['animateurs', VueAnimateurs],
    ['diversite', VueDiversite],
    ['performance', VuePerformance],
  ];

  const charge = $derived($seance.charge);
  const source = $derived(charge === null ? null : sourceQualite(charge, { demandee: $ui.proposition }));
  const table = $derived(charge === null ? null : evaluation(charge).table);
  const ligne = $derived(source?.ligne ?? null);
  // La phrase de filiation de la source, null pour le retenu, sans source
  // et hors d'une dérivée.
  const filiation = $derived(typeof source?.id === 'number' ? texteFiliation(derivationDe(charge, source.id), { t, format }) : null);
  const detail = $derived(
    source?.cas === 'mesurable'
      ? detailDe(charge, source.id, { courseDe: (id) => seance.courseDe(id), generationDe: (id) => generation.generationDe(id) })
      : null,
  );
  // Les contradictions qui retirent le dessin : celles de la garde du
  // détail, une liste vide sans source mesurable.
  const refusDessin = $derived(detail?.refusDessin ?? []);
  const nommer = (id) => (id === null || id === undefined ? null : nomDe(charge, id));

  // L'identifiant de l'élément qui porte une vue.
  const idVue = (nom) => `${uid}-vue-${nom}`;

  // Porte le focus sur la vue nommée, qui se fait voir ; rien quand elle
  // n'est pas à l'écran. Ce qui attend son premier dessin au-dessus d'elle
  // — les graphiques, la vue de comparaison — se dessine d'abord, rendu
  // avant le défilement : aucun dessin au-dessus d'elle ne la déplace
  // ensuite.
  function porterALaVue(nom) {
    const cible = document.getElementById(idVue(nom));
    if (cible === null) return;
    dessinDiffere.dessinerAvant(cible);
    flushSync();
    cible.scrollIntoView({ block: 'start' });
    cible.focus({ preventScroll: true });
  }

  // Le lien d'une vue : il la porte à l'écran sans changer l'adresse de la
  // page.
  function allerALaVue(evenement, nom) {
    evenement.preventDefault();
    porterALaVue(nom);
  }

  // La vue demandée, portée une fois la page rendue : flushSync ne se
  // prend pas dans un effet, la vue se porte à la microtâche qui le suit.
  $effect(() => {
    const demandee = $ui.vueQualite;
    if (demandee === null || charge === null) return;
    queueMicrotask(() => {
      porterALaVue(demandee);
      ui.vueQualiteAtteinte();
    });
  });
</script>

{#snippet personne(id)}
  {@const nom = nommer(id)}
  {#if nom !== null}
    <span class="nom">{nom}</span>
  {/if}
{/snippet}

<section data-section="qualite">
  <h2>{t('coquille.section.qualite')}</h2>

  {#if source !== null}
    <div class="source">
      <p data-source-qualite>
        <span class="intitule">{t('qualite.source.intitule')}</span>
        <span class="placement">{t(source.libelle.cle, source.libelle.details)}</span>
      </p>
      {#if source.revenir !== null}
        <Commande cle={source.revenir} nom="revenir" executer={() => ui.montrerProposition(null)} />
      {/if}
      {#if filiation !== null}
        <p class="filiation" data-filiation>{filiation}</p>
      {/if}
    </div>

    {#if source.cas === 'configuration'}
      <Carte>
        <div class="cas">
          <p data-phrase-qualite="configuration">{t('qualite.phrase.configuration')}</p>
          <Refus refus={source.refus} />
        </div>
      </Carte>
    {:else if source.cas === 'aucunPlacement'}
      <Carte>
        <p data-phrase-qualite="aucunPlacement">{t('qualite.phrase.aucunPlacement')}</p>
      </Carte>
      <Diagnostic compact />
    {:else if source.cas === 'aucuneMontree'}
      <Carte>
        <div class="cas">
          <p data-phrase-qualite="aucuneMontree">{t('qualite.phrase.aucuneMontree')}</p>
          {#if source.premiere === null}
            <p data-phrase-qualite="aucuneComparable">{t('qualite.phrase.aucuneComparable')}</p>
          {:else}
            {@const premiere = source.premiere}
            <Commande
              cle="qualite.source.montrerPremiere"
              details={{ proposition: premiere }}
              nom="montrerPremiere"
              executer={() => ui.montrerProposition(premiere)}
            />
          {/if}
        </div>
      </Carte>
    {:else if source.cas === 'derive' || source.cas === 'fautif'}
      <Carte>
        <div class="cas">
          <p data-phrase-qualite={source.cas}>{t(`qualite.phrase.${source.cas}`)}</p>
          <ul class="raisons">
            {#each source.raisons as raison, rang (rang)}
              <li><span>{t(raison.cle, raison.details)}</span>{@render personne(raison.participant)}</li>
            {/each}
          </ul>
        </div>
      </Carte>
    {:else if refusDessin.length > 0}
      <Carte>
        <div class="cas">
          <p data-phrase-qualite="refusDessin">{t('qualite.refus.phrase')}</p>
          <ul class="raisons">
            {#each refusDessin as violation, rang (rang)}
              <li><span>{t(violation.code, violation)}</span>{@render personne(violation.participant)}</li>
            {/each}
          </ul>
        </div>
      </Carte>
    {:else}
      <nav class="vues" aria-label={t('qualite.vues.titre')}>
        <ul>
          {#each VUES as [nom] (nom)}
            <li><a href="#{idVue(nom)}" onclick={(evenement) => allerALaVue(evenement, nom)}>{t(`qualite.vue.${nom}.titre`)}</a></li>
          {/each}
        </ul>
      </nav>
      {#each VUES as [nom, Vue] (nom)}
        <div class="vue" id={idVue(nom)} tabindex="-1">
          <Vue {detail} {ligne} {table} />
        </div>
      {/each}
    {/if}
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    min-width: 0;
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte);
  }

  h2 {
    margin: 0;
    font-size: var(--taille-titre);
  }

  p {
    margin: 0;
  }

  /* La ligne de source : l'intitulé en encre secondaire, le placement en
     gras, puis la commande de retour, sur la même ligne quand elle tient. */
  .source {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2) var(--espace-3);
  }

  .source p {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--espace-1);
  }

  .intitule {
    color: var(--couleur-page-texte-secondaire);
  }

  .placement {
    font-weight: bold;
  }

  /* La filiation d'une dérivée, sous la ligne de source, sur toute sa
     largeur. */
  .filiation {
    flex-basis: 100%;
  }

  .cas {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  .raisons {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .raisons li {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--espace-2);
  }

  .nom {
    font-weight: bold;
  }

  /* La liste des vues : des liens côte à côte, qui passent à la ligne. */
  .vues ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1) var(--espace-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .vues a {
    color: var(--couleur-action-encre);
    text-underline-offset: 0.2em;
  }

  .vues a:focus-visible,
  .vue:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
