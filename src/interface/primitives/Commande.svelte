<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Une commande (§ 2.1, § 8.5) : un bouton dont le libellé est la clé cle,
  // traduite, et qui appelle executer au clic. Avec confirmer, la clé du
  // libellé de confirmation, un premier clic arme la commande — son libellé
  // devient celui de confirmer — et seul un second exécute ; armée, elle se
  // désarme au terme de DELAI_CONFIRMATION_MS, par l'horloge du contexte.
  // La machine est celle de commande.js.
  //
  // Un refus — une erreur qui porte un code — s'affiche à côté du bouton,
  // avec son remède, et le bouton reste actif : jamais un bouton grisé muet.
  // Une erreur sans code n'est pas un refus et remonte.
  //
  // data-commande porte nom, ou à défaut le dernier segment de la clé.
  // confirmer se lit au montage : une commande qui change de confirmation se
  // remonte.
  import { getContext, onDestroy, untrack } from 'svelte';
  import { DELAI_CONFIRMATION_MS, creerMachineCommande } from './commande.js';
  import Refus from './Refus.svelte';

  let { cle, executer, confirmer = null, details = {}, nom = null, gestes = {} } = $props();

  const t = getContext('t');
  const horloge = getContext('horloge');
  const machine = creerMachineCommande({ confirmer: untrack(() => confirmer) });

  let armee = $state(false);
  let refus = $state(null);
  let minuterie = null;

  const libelle = $derived(armee ? t(confirmer) : t(cle, details));
  const designation = $derived(nom ?? cle.slice(cle.lastIndexOf('.') + 1));

  function desarmer() {
    if (minuterie === null) return;
    horloge.annuler(minuterie);
    minuterie = null;
  }

  function expirer() {
    minuterie = null;
    machine.expirer();
    armee = machine.armee;
  }

  async function cliquer() {
    const { action } = machine.cliquer();
    armee = machine.armee;
    if (action === 'armer') {
      minuterie = horloge.planifier(expirer, DELAI_CONFIRMATION_MS);
      return;
    }
    desarmer();
    refus = null;
    try {
      await executer();
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refus = { code: erreur.code, details: erreur.details ?? {} };
    }
  }

  onDestroy(desarmer);
</script>

<div class="commande">
  <button type="button" data-commande={designation} onclick={cliquer}>{libelle}</button>
  {#if refus !== null}
    <Refus {refus} lever={() => (refus = null)} {gestes} />
  {/if}
</div>

<style>
  .commande {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
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

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
