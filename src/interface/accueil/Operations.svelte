<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Les opérations de fichiers d'une ligne de la liste (§ 8.7), leur seule
  // place : copier, renommer, supprimer. Copier et renommer demandent d'abord
  // un nom (saisieDe) : rien ne s'écrit avant la validation, et un nom vide
  // se refuse contre le champ. Copier ouvre la copie en lecture ; renommer
  // laisse la liste, que l'accueil relit. Supprimer déplace les fichiers dans
  // la corbeille et se confirme en place, par un second clic : aucune
  // fenêtre. Chaque refus s'affiche contre le champ ou à côté de sa
  // commande, sans remède (surLaListe) ; apresOperation() suit chaque
  // opération réussie. Une validation en cours ne se relance pas : une
  // seconde soumission pendant l'écriture ne fait rien, et le bouton de
  // validation se dit occupé ; supprimer passe par la Commande, qui a la
  // même garde. Dans la cellule des actions du tableau, les trois commandes
  // sont discrètes, à côté de « Ouvrir » ; la saisie s'ouvre à leur place.
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
  // Vrai pendant l'écriture d'une copie ou d'un renommage.
  let validationEnCours = $state(false);
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
    if (validationEnCours) return;
    refus = null;
    const { operation, texte } = saisie;
    validationEnCours = true;
    try {
      await surLaListe(() => GESTES[operation](texte));
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refus = erreur;
      return;
    } finally {
      validationEnCours = false;
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
    <Commande cle="accueil.operation.copier" variante="discrete" executer={() => ouvrirSaisie('copier')} />
    <Commande cle="accueil.operation.renommer" variante="discrete" executer={() => ouvrirSaisie('renommer')} />
    <Commande
      cle="accueil.operation.supprimer"
      variante="discrete"
      confirmer="accueil.operation.confirmerSuppression"
      executer={supprimer}
    />
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
        <button
          type="submit"
          data-commande={saisie.commande}
          aria-busy={validationEnCours ? 'true' : undefined}
          aria-disabled={validationEnCours ? 'true' : undefined}>{t(saisie.valider)}</button
        >
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
    gap: var(--espace-1);
  }

  form,
  .champ {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--espace-2);
  }

  .champ {
    gap: var(--espace-1);
  }

  label {
    font-weight: bold;
  }

  input {
    width: 14rem;
    max-width: 100%;
    box-sizing: border-box;
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
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
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
    cursor: pointer;
  }

  button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  /* La validation : l'action de la saisie, pleine de la teinte de
     l'action. */
  button[type='submit'] {
    border-color: var(--couleur-action-fond);
    background-color: var(--couleur-action-fond);
    color: var(--couleur-action-texte);
    font-weight: bold;
  }

  input:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  button[aria-disabled='true'] {
    border-style: dashed;
    cursor: progress;
  }

  button[type='submit'][aria-disabled='true'] {
    border-color: var(--couleur-action-texte);
  }
</style>
