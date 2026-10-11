<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La fenêtre à confirmer (§ 2.1) : la seule fenêtre du logiciel, réservée
  // à la destruction de saisie. Un <dialog> modal, ouvert au montage, qui
  // porte le titre — la clé titre traduite — et nomme chaque élément détruit,
  // chacun dans son propre nœud de texte. Annuler a le focus par défaut ;
  // Échap annule. Annuler ferme la fenêtre puis appelle surAnnuler.
  // Confirmer appelle surConfirmer et attend sa promesse : aboutie, la
  // fenêtre se ferme ; refusée — une erreur qui porte un code —, elle reste
  // ouverte et le refus, avec son remède, s'y pose, là où le geste a eu
  // lieu ; une erreur sans code ferme la fenêtre et remonte. Le parent la
  // démonte.
  //
  // Pendant l'attente, la fenêtre est occupée : la destruction est déjà
  // demandée, et rien ne la dit annulée pendant qu'elle s'achève. Annuler,
  // Échap et un second Confirmer ne font rien ; les deux boutons portent
  // aria-disabled, se dessinent d'un filet tireté, et une annonce dit
  // l'attente. Seule la fin de l'action ferme la fenêtre ou la rend active.
  // Aucune touche ne la ferme : le navigateur peut fermer un <dialog> sans
  // que cancel l'en empêche — Chromium n'annule pas une seconde demande de
  // fermeture sans activation de l'utilisateur entre les deux —, et la
  // fenêtre fermée pendant l'attente se rouvre aussitôt par showModal,
  // toujours occupée. Fermée hors de l'attente par un autre chemin que le
  // sien, elle annule, comme Échap.
  //
  // Ouverte, la fenêtre tient un geste de la séance du contexte (geste.js),
  // rendu à la fermeture ou au démontage : il suspend le compte
  // d'inactivité, qui ne la ramène pas en lecture sous l'opérateur, et se
  // recompte quand la séance, renvoyée en lecture, repasse en écriture.
  import { getContext, onDestroy, onMount } from 'svelte';
  import { creerGeste } from './geste.js';
  import Refus from './Refus.svelte';

  let { titre, elements, surConfirmer, surAnnuler, details = {} } = $props();

  const t = getContext('t');
  const seance = getContext('seance') ?? null;
  const uid = $props.id();
  let fenetre;
  let renoncer;
  let refus = $state(null);
  // L'action confirmée en cours : la fenêtre est occupée.
  let enAttente = $state(false);
  // Vrai dès que fermer() a fermé la fenêtre : l'événement close qui suit
  // est le sien.
  let fermee = false;
  const geste = seance === null ? null : creerGeste(seance);

  onMount(() => {
    fenetre.showModal();
    renoncer.focus();
    geste?.tenir(true);
  });

  function fermer() {
    fermee = true;
    if (fenetre?.open) fenetre.close();
    geste?.tenir(false);
  }

  function annuler() {
    if (enAttente) return undefined;
    fermer();
    return surAnnuler();
  }

  async function confirmer() {
    if (enAttente) return;
    enAttente = true;
    refus = null;
    try {
      await surConfirmer();
    } catch (erreur) {
      enAttente = false;
      if (typeof erreur?.code !== 'string') {
        fermer();
        throw erreur;
      }
      refus = { code: erreur.code, details: erreur.details ?? {} };
      return;
    }
    enAttente = false;
    fermer();
  }

  onDestroy(() => geste?.liberer());

  // Échap : l'annulation, par le même chemin qu'Annuler ; la fenêtre ne se
  // ferme jamais d'elle-même.
  function surCancel(evenement) {
    evenement.preventDefault();
    annuler();
  }

  // La fenêtre fermée sans fermer() : occupée, elle se rouvre, modale ;
  // sinon, c'est une annulation. Démontée, elle ne se rouvre pas.
  function surClose() {
    if (fermee) return;
    if (enAttente) {
      if (fenetre.isConnected) fenetre.showModal();
      return;
    }
    annuler();
  }
</script>

<dialog
  bind:this={fenetre}
  aria-labelledby={`${uid}-titre`}
  aria-busy={enAttente ? 'true' : undefined}
  oncancel={surCancel}
  onclose={surClose}
>
  <h2 id={`${uid}-titre`}>{t(titre, details)}</h2>
  <ul>
    {#each elements as element, rang (rang)}
      <li>{element}</li>
    {/each}
  </ul>
  {#if refus !== null}
    <div class="refus">
      <Refus {refus} lever={() => (refus = null)} />
    </div>
  {/if}
  {#if enAttente}
    <p class="attente" role="status">{t('communs.confirmation.enCours')}</p>
  {/if}
  <div class="issues">
    <button
      type="button"
      data-commande="renoncer"
      aria-disabled={enAttente ? 'true' : undefined}
      bind:this={renoncer}
      onclick={annuler}
    >
      {t('communs.confirmation.annuler')}
    </button>
    <button
      type="button"
      data-commande="confirmer"
      aria-disabled={enAttente ? 'true' : undefined}
      onclick={confirmer}
    >
      {t('communs.confirmation.confirmer')}
    </button>
  </div>
</dialog>

<style>
  dialog {
    max-width: min(40rem, calc(100vw - 2 * var(--espace-4)));
    padding: var(--espace-5);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-3);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-2);
  }

  dialog::backdrop {
    background: none;
  }

  h2 {
    margin: 0 0 var(--espace-3);
    font-size: var(--taille-titre);
  }

  ul {
    margin: 0 0 var(--espace-4);
    padding-left: var(--espace-5);
  }

  .refus {
    margin: 0 0 var(--espace-3);
  }

  .attente {
    margin: 0 0 var(--espace-3);
  }

  .issues {
    display: flex;
    gap: var(--espace-3);
  }

  button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
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
