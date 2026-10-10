<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Une commande (§ 2.1, § 8.5) : un bouton dont le libellé est la clé cle,
  // traduite, et qui appelle executer au clic. Avec confirmer, la clé du
  // libellé de confirmation, un premier clic arme la commande — son libellé
  // devient celui de confirmer — et seul un second exécute ; armée, elle se
  // désarme au terme de DELAI_CONFIRMATION_MS, par l'horloge du contexte.
  // La machine est celle de commande.js : le clic répété d'une série
  // — detail supérieur à 1 — est sans effet (§ 8.5). Le clavier n'en porte
  // pas : un appui d'Entrée ou d'Espace que la répétition automatique émet
  // — keydown dont repeat est vrai — voit son action par défaut empêchée, et
  // n'active pas le bouton. Une touche tenue n'active la commande qu'une
  // fois, et ne confirme jamais celle qu'elle vient d'armer.
  //
  // Pendant qu'une exécution qui rend une promesse s'achève, la commande est
  // occupée : un clic ne fait rien, et le bouton porte aria-busy et
  // aria-disabled, dessiné d'un filet tireté. Une exécution sans promesse
  // rend la commande aussitôt.
  //
  // Un refus — une erreur qui porte un code — s'affiche à côté du bouton,
  // avec son remède, et le bouton reste actif : jamais un bouton grisé muet.
  // Une erreur sans code n'est pas un refus et remonte.
  //
  // data-commande porte nom, ou à défaut le dernier segment de la clé.
  // confirmer se lit au montage : une commande qui change de confirmation se
  // remonte.
  import { getContext, onDestroy, untrack } from 'svelte';
  import { effetDe } from '../raccourcis.js';
  import { DELAI_CONFIRMATION_MS, creerMachineCommande } from './commande.js';
  import Refus from './Refus.svelte';

  let { cle, executer, confirmer = null, details = {}, nom = null, gestes = {} } = $props();

  const t = getContext('t');
  const horloge = getContext('horloge');
  const machine = creerMachineCommande({ confirmer: untrack(() => confirmer) });

  let armee = $state(false);
  let enCours = $state(false);
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

  async function cliquer(evenement) {
    const { action } = machine.cliquer({ repete: evenement.detail > 1 });
    armee = machine.armee;
    if (action === 'aucune') return;
    if (action === 'armer') {
      minuterie = horloge.planifier(expirer, DELAI_CONFIRMATION_MS);
      return;
    }
    desarmer();
    refus = null;
    try {
      const rendu = executer();
      if (typeof rendu?.then === 'function') {
        enCours = true;
        await rendu;
      }
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refus = { code: erreur.code, details: erreur.details ?? {} };
    } finally {
      machine.terminer();
      enCours = false;
    }
  }

  function surTouche(evenement) {
    if (evenement.repeat && effetDe('commande', evenement.key) === 'activer') evenement.preventDefault();
  }

  onDestroy(desarmer);
</script>

<div class="commande">
  <button
    type="button"
    data-commande={designation}
    aria-busy={enCours ? 'true' : undefined}
    aria-disabled={enCours ? 'true' : undefined}
    onkeydown={surTouche}
    onclick={cliquer}>{libelle}</button
  >
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

  button[aria-disabled='true'] {
    border-style: dashed;
    color: var(--couleur-page-texte-secondaire);
    cursor: progress;
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
