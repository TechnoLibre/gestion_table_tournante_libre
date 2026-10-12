<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // L'hôte d'une section que la construction range dans son propre morceau
  // (differe.js). demander, appelée une fois au montage de l'hôte, rend le
  // composant ou sa promesse : un composant déjà connu se monte aussitôt,
  // sans état intermédiaire ; une promesse montre d'abord l'état de
  // chargement — la région de la section, son titre et une phrase
  // d'attente, région role="status" —, puis la section. Une promesse rejetée
  // est une faute : l'erreur va au collecteur de la page (reportError), et
  // la région dit, à la place de la section, qu'elle ne s'est pas chargée.
  // Le retour à la section la redemande.
  //
  // nom : le nom de la section (sections.js), qui titre la région d'attente
  // et la marque [data-chargement-section] ; demander : la demande unique de
  // creerChargeurSection.
  import { getContext, untrack } from 'svelte';
  import { cleDeSection } from './sections.js';

  const proprietes = $props();
  const nom = $derived(proprietes.nom);
  const t = getContext('t');

  // La demande se fait au montage, une seule fois : un changement de
  // propriété ne la refait pas (Evenement.svelte remonte l'hôte à chaque
  // changement de section).
  const rendu = untrack(() => proprietes.demander());
  const attendu = typeof rendu?.then === 'function';
  let Composant = $state.raw(attendu ? null : rendu);
  let echec = $state(false);
  if (attendu) {
    rendu.then(
      (lu) => {
        Composant = lu;
      },
      (erreur) => {
        echec = true;
        reportError(erreur);
      },
    );
  }
</script>

{#if Composant !== null}
  <Composant />
{:else}
  <section data-chargement-section={nom} aria-busy={!echec}>
    <h2>{t(cleDeSection(nom))}</h2>
    {#if echec}
      <p role="status" data-echec-section={nom}>{t('evenement.section.echec')}</p>
    {:else}
      <p role="status">{t('evenement.section.chargement')}</p>
    {/if}
  </section>
{/if}

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte);
  }

  h2 {
    margin: 0;
    font-size: var(--taille-titre);
  }

  p {
    margin: 0;
    color: var(--couleur-page-texte-secondaire);
  }
</style>
