<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // L'événement ouvert (§ 2.1, § 8.4) : la bande de mode, sous le bandeau,
  // puis le cadre de mode, qui entoure la surface de travail de toute
  // section. Sa barre porte la place fixe, le libellé, Défaire et Refaire,
  // puis les outils — la suite des états du plan — et les actions —
  // « Imprimer… », l'action principale de l'en-tête. Sous la barre, la tête
  // de l'événement : son en-tête — nom et résumé — et la navigation des
  // sections, dans l'ordre du § 2.1. La barre et la tête forment la carte
  // d'en-tête. Seule la bande précède le cadre dans l'écran, à hauteur
  // constante : ce que la tête montre ne déplace pas la place fixe. Aucune
  // section n'en exige une autre : la navigation les offre toutes, et la
  // séance refuse elle-même ce qui ne peut pas se faire. Le plein écran du
  // plan efface les outils, les actions et la tête, jamais la bande, le
  // cadre ni sa place fixe.
  //
  // « Imprimer… » ouvre l'aperçu avant impression (§ 11.7) sur le plan, au
  // tour montré : toute impression passe par lui. Vivante dans tout mode,
  // elle n'écrit rien.
  //
  // La navigation groupe les sections par phase (PHASES, sections.js) —
  // préparer, placer, produire — : chaque phase est un groupe nommé par son
  // intertitre, en petites capitales d'encre secondaire, précédé d'une
  // marque de couleur qui ne porte aucune information que le nom ne porte
  // déjà. Les sections sont des onglets : la section ouverte, aria-current,
  // se distingue par sa forme, en gras et soulignée d'un trait de la teinte
  // de l'action.
  //
  // L'écran de l'événement tient dans la fenêtre, sous le bandeau : la page
  // ne défile pas, la surface de travail défile dans le cadre, et le cadre,
  // son libellé et sa place fixe restent où ils sont (§ 8.4). La règle
  // globale ci-dessous donne pour cela une hauteur à l'ascendance de l'écran
  // — le conteneur de l'application et son <main> — tant qu'il porte cet
  // écran, et à lui seul.
  //
  // Le support rompu et les avertissements se posent dans la zone des
  // annonces du cadre, qui défile seule au-delà de son plafond, et non
  // au-dessus de la section : la section ne cède à la zone que ce dont elle
  // dépasse la tête, quel que soit le nombre des avertissements, et le
  // support rompu, en tête de la zone, garde ses issues en vue
  // (CadreMode.svelte).
  import { getContext } from 'svelte';
  import SectionBadges from '../badges/SectionBadges.svelte';
  import Diagnostic from '../diagnostic/Diagnostic.svelte';
  import SectionGeneration from '../generation/SectionGeneration.svelte';
  import SectionImport from '../import/SectionImport.svelte';
  import SectionParticipants from '../participants/SectionParticipants.svelte';
  import SectionPlan from '../plan/SectionPlan.svelte';
  import SectionPropositions from '../propositions/SectionPropositions.svelte';
  import SectionTables from '../tables/SectionTables.svelte';
  import Avertissements from './Avertissements.svelte';
  import BandeMode from './BandeMode.svelte';
  import Commande from '../primitives/Commande.svelte';
  import CadreMode from './CadreMode.svelte';
  import EnteteEvenement from './EnteteEvenement.svelte';
  import EtatsPlan from './EtatsPlan.svelte';
  import SupportRompu from './SupportRompu.svelte';
  import { avertissementsOrdonnes } from './modele.js';
  import { PHASES, cleDeSection } from './sections.js';

  const t = getContext('t');
  const ui = getContext('ui');
  const seance = getContext('seance');
  const uid = $props.id();

  // Le composant de chaque section.
  const COMPOSANTS = new Map([
    ['import', SectionImport],
    ['participants', SectionParticipants],
    ['tables', SectionTables],
    ['plan', SectionPlan],
    ['diagnostic', Diagnostic],
    ['generation', SectionGeneration],
    ['propositions', SectionPropositions],
    ['badges', SectionBadges],
  ]);

  const Section = $derived(COMPOSANTS.get($ui.section));
  // La zone des annonces n'existe que lorsqu'elle a quelque chose à dire :
  // sans annonce, le cadre ne lui garde ni hauteur ni trait.
  const annoncer = $derived($seance.supportRompu !== null || avertissementsOrdonnes($seance).length > 0);
</script>

{#snippet outils()}
  <EtatsPlan />
{/snippet}

{#snippet actions()}
  <Commande
    cle="impression.commande.ouvrir"
    nom="apercu"
    variante="principale"
    executer={() => ui.ouvrirApercu({ vue: 'plan', tour: $ui.tour })}
  />
{/snippet}

{#snippet tete()}
  <EnteteEvenement />
  <nav aria-label={t('coquille.navigation')}>
    {#each PHASES as phase (phase.nom)}
      <div class="phase" role="group" aria-labelledby="{uid}-{phase.nom}">
        <span class="intertitre" id="{uid}-{phase.nom}"
          ><span
            class="marque"
            class:preparer={phase.nom === 'preparer'}
            class:placer={phase.nom === 'placer'}
            class:produire={phase.nom === 'produire'}
            aria-hidden="true"
          ></span>{t(phase.cle)}</span
        >
        <div class="onglets">
          {#each phase.sections as nom (nom)}
            <button
              type="button"
              data-commande="section"
              data-cible={nom}
              aria-current={$ui.section === nom ? 'page' : undefined}
              onclick={() => ui.allerA(nom)}>{t(cleDeSection(nom))}</button
            >
          {/each}
        </div>
      </div>
    {/each}
  </nav>
{/snippet}

{#snippet annonces()}
  {#if $seance.supportRompu !== null}
    <SupportRompu />
  {/if}
  <Avertissements />
{/snippet}

<div class="evenement" data-ecran="evenement">
  <BandeMode />
  <CadreMode outils={$ui.pleinEcran ? null : outils} actions={$ui.pleinEcran ? null : actions} tete={$ui.pleinEcran ? null : tete} annonces={annoncer ? annonces : null}>
    <Section />
  </CadreMode>
</div>

<style>
  /* L'ascendance de l'écran de l'événement prend la hauteur de la fenêtre :
     le bandeau en haut, l'écran dessous, qui ne déborde pas. Le retrait du
     bas de l'écran se réduit à --espace-2 : la bande de mode prend le
     retrait du haut, et le plan garde sa hauteur. */
  :global(div:has(> main > [data-ecran='evenement'])) {
    height: 100vh;
  }

  :global(main:has(> [data-ecran='evenement'])) {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* La classe de l'écran (App.svelte) porte la spécificité de son retrait,
     que cette règle doit dépasser. */
  :global(main.ecran:has(> [data-ecran='evenement'])) {
    padding-bottom: var(--espace-2);
  }

  .evenement {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  /* Les phases côte à côte, séparées d'un blanc : les huit onglets tiennent
     sur une ligne à côté de la place des annonces dans une fenêtre de
     1 366 px (CadreMode.svelte). */
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--espace-5);
  }

  .phase {
    display: flex;
    flex-direction: column;
  }

  .intertitre {
    display: flex;
    align-items: center;
    gap: var(--espace-1);
    padding: 0 var(--espace-2);
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    line-height: 1.2;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  .marque {
    flex: none;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: var(--rayon-pilule);
  }

  .marque.preparer {
    background-color: var(--couleur-action-fond);
  }

  .marque.placer {
    background-color: var(--couleur-etat-retenu-marque);
  }

  .marque.produire {
    background-color: var(--couleur-etat-bloque-marque);
  }

  .onglets {
    display: flex;
    flex-wrap: wrap;
  }

  /* Un onglet : sans fond ni cadre, un trait transparent sous lui, que la
     section ouverte remplit de la teinte de l'action. Son retrait latéral
     vaut --espace-2 ; sa hauteur, trait compris, celle d'une commande
     secondaire. */
  button {
    padding: var(--espace-1) var(--espace-2);
    border: 0;
    border-bottom: 3px solid transparent;
    background-color: transparent;
    color: var(--couleur-page-texte);
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  button[aria-current='page'] {
    border-bottom-color: var(--couleur-action-fond);
    font-weight: bold;
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
