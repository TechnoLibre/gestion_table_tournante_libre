<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // L'événement ouvert (§ 2.1, § 8.4) : le cadre de mode, qui entoure la
  // surface de travail de toute section, et porte sous sa barre — place
  // fixe, libellé, Défaire et Refaire — la tête de l'événement : son en-tête
  // — nom et états du plan — et la navigation des sections, dans l'ordre du
  // § 2.1. Rien ne précède le cadre dans l'écran : ce que la tête montre ne
  // déplace pas la place fixe. Aucune section n'en exige une autre : la
  // navigation les offre toutes, et la séance refuse elle-même ce qui ne
  // peut pas se faire. Le plein écran du plan efface la tête, jamais le
  // cadre ni sa place fixe.
  //
  // L'écran de l'événement tient dans la fenêtre, sous le bandeau : la page
  // ne défile pas, la surface de travail défile dans le cadre, et le cadre,
  // son libellé et sa place fixe restent où ils sont (§ 8.4). La règle
  // globale ci-dessous donne pour cela une hauteur à l'ascendance de l'écran
  // — le conteneur de l'application et son <main> — tant qu'il porte cet
  // écran, et à lui seul.
  //
  // Le support rompu et les avertissements se posent dans la zone des
  // annonces du cadre, qui défile seule, et non au-dessus de la section : la
  // section garde la hauteur de la surface, plan compris, quel que soit le
  // nombre des avertissements, et le support rompu, en tête de la zone,
  // garde ses issues en vue (CadreMode.svelte).
  import { getContext } from 'svelte';
  import Diagnostic from '../diagnostic/Diagnostic.svelte';
  import SectionGeneration from '../generation/SectionGeneration.svelte';
  import SectionImport from '../import/SectionImport.svelte';
  import SectionParticipants from '../participants/SectionParticipants.svelte';
  import SectionPlan from '../plan/SectionPlan.svelte';
  import SectionPropositions from '../propositions/SectionPropositions.svelte';
  import SectionTables from '../tables/SectionTables.svelte';
  import Avertissements from './Avertissements.svelte';
  import CadreMode from './CadreMode.svelte';
  import EnteteEvenement from './EnteteEvenement.svelte';
  import SupportRompu from './SupportRompu.svelte';
  import { avertissementsOrdonnes } from './modele.js';
  import { SECTIONS, cleDeSection } from './sections.js';

  const t = getContext('t');
  const ui = getContext('ui');
  const seance = getContext('seance');

  // Le composant de chaque section.
  const COMPOSANTS = new Map([
    ['import', SectionImport],
    ['participants', SectionParticipants],
    ['tables', SectionTables],
    ['plan', SectionPlan],
    ['diagnostic', Diagnostic],
    ['generation', SectionGeneration],
    ['propositions', SectionPropositions],
  ]);

  const Section = $derived(COMPOSANTS.get($ui.section));
  // La zone des annonces n'existe que lorsqu'elle a quelque chose à dire :
  // sans annonce, le cadre ne lui garde ni hauteur ni trait.
  const annoncer = $derived($seance.supportRompu !== null || avertissementsOrdonnes($seance).length > 0);
</script>

{#snippet tete()}
  <EnteteEvenement />
  <nav aria-label={t('coquille.navigation')}>
    {#each SECTIONS as nom (nom)}
      <button
        type="button"
        data-commande="section"
        data-cible={nom}
        aria-current={$ui.section === nom ? 'page' : undefined}
        onclick={() => ui.allerA(nom)}>{t(cleDeSection(nom))}</button
      >
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
  <CadreMode tete={$ui.pleinEcran ? null : tete} annonces={annoncer ? annonces : null}>
    <Section />
  </CadreMode>
</div>

<style>
  /* L'ascendance de l'écran de l'événement prend la hauteur de la fenêtre :
     le bandeau en haut, l'écran dessous, qui ne déborde pas. */
  :global(div:has(> main > [data-ecran='evenement'])) {
    height: 100vh;
  }

  :global(main:has(> [data-ecran='evenement'])) {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .evenement {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  nav {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }

  button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    cursor: pointer;
  }

  /* La section ouverte se distingue par sa forme : texte souligné et gras. */
  button[aria-current='page'] {
    font-weight: bold;
    text-decoration: underline;
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
