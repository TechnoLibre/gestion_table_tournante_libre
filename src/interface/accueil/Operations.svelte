<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Les opérations de fichiers d'une ligne de la liste (§ 8.7), leur seule
  // place : copier, renommer, supprimer. Copier et renommer demandent d'abord
  // un nom (saisieDe) : rien ne s'écrit avant la validation, et un nom vide
  // se refuse contre le champ. Copier ouvre la copie en lecture ; renommer
  // laisse la liste, que l'accueil relit. Supprimer déplace les fichiers dans
  // la corbeille et se confirme en place, par un second clic : aucune
  // fenêtre. Chaque refus s'affiche contre le champ ou à côté de sa
  // commande, sans remède (surLaListe) ; apresOperation() suit chaque
  // opération réussie.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import Refus from '../primitives/Refus.svelte';
  import { champDuRefus, saisieDe, surLaListe } from './modele.js';

  let { ligne, apresOperation } = $props();

  const t = getContext('t');
  const facade = getContext('facade');
  const uid = $props.id();

  // La saisie en cours, { operation, champ, etiquette, commande, valider,
  // texte }, ou null ; et son refus.
  let saisie = $state(null);
  let refus = $state.raw(null);
  const surLeChamp = $derived(champDuRefus(refus) === 'nom');

  function ouvrirSaisie(operation) {
    refus = null;
    saisie = { operation, ...saisieDe(operation, ligne.nom) };
  }

  function fermerSaisie() {
    saisie = null;
    refus = null;
  }

  // Le geste de chaque saisie, par la façade.
  const GESTES = {
    copier: (nom) => facade.copier(ligne.base, { nom }),
    renommer: (nom) => facade.renommer(ligne.base, { nom }),
  };

  async function valider(evenement) {
    evenement.preventDefault();
    refus = null;
    const { operation, texte } = saisie;
    try {
      await surLaListe(() => GESTES[operation](texte));
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refus = erreur;
      return;
    }
    fermerSaisie();
    apresOperation();
  }

  async function supprimer() {
    await surLaListe(() => facade.supprimer(ligne.base));
    apresOperation();
  }
</script>

<div class="operations">
  {#if saisie === null}
    <Commande cle="accueil.operation.copier" executer={() => ouvrirSaisie('copier')} />
    <Commande cle="accueil.operation.renommer" executer={() => ouvrirSaisie('renommer')} />
    <Commande cle="accueil.operation.supprimer" confirmer="accueil.operation.confirmerSuppression" executer={supprimer} />
  {:else}
    <form novalidate onsubmit={valider}>
      <div class="champ">
        <label for={`${uid}-nom`}>{t(saisie.etiquette)}</label>
        <input
          id={`${uid}-nom`}
          type="text"
          data-champ={saisie.champ}
          bind:value={saisie.texte}
          aria-invalid={surLeChamp ? 'true' : undefined}
          aria-describedby={surLeChamp ? `${uid}-refus` : undefined}
        />
        {#if surLeChamp}
          <Refus id={`${uid}-refus`} {refus} />
        {/if}
      </div>
      <div class="commandes">
        <button type="submit" data-commande={saisie.commande}>{t(saisie.valider)}</button>
        <button type="button" data-commande="annuler" onclick={fermerSaisie}>{t('accueil.operation.annuler')}</button>
        {#if refus !== null && !surLeChamp}
          <Refus {refus} />
        {/if}
      </div>
    </form>
  {/if}
</div>

<style>
  .operations,
  .commandes {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  form,
  .champ {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  .champ {
    gap: var(--espace-1);
  }

  input {
    min-width: 20em;
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
  }

  input[aria-invalid='true'] {
    border-color: var(--couleur-refus);
  }

  button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
    cursor: pointer;
  }

  input:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
