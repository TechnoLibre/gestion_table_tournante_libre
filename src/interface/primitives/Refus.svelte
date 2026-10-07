<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Un refus posé là où le geste a eu lieu (§ 2.1, § 5.9, § 14.6) : son
  // texte, celui de t sur son code et ses détails, puis son remède en
  // Commande, puis chacun de details.autres dans leur ordre, de même. Une
  // région role="status", jamais une fenêtre.
  //
  // refus : {code, details}, le remède dans details.remede. Le remède
  // s'exécute par actionRemede (commande.js), sur la séance et l'état de
  // navigation du contexte, ou par gestes, ceux que l'écran fournit — le
  // choix d'une place sur le plan. Un remède que rien ne sait exécuter ne
  // pose aucune commande ; le texte du refus reste. Le remède abouti — tout
  // rendu autre que null, qui dit une désignation annulée —, lever(refus),
  // quand il est donné, reçoit le refus affiché au départ du remède, celui
  // qu'il levait : le porteur ne retire que lui, même remplacé entre-temps.
  // Un refus de details.autres rend à lever le refus qui le porte.
  import { getContext } from 'svelte';
  import { actionRemede } from './commande.js';
  import Commande from './Commande.svelte';
  import Refus from './Refus.svelte';

  let { refus, lever = null, gestes = {}, id = undefined } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui') ?? null;

  const message = $derived(t(refus.code, refus.details));
  const action = $derived(actionRemede(refus.details?.remede ?? null, { seance, ui, gestes }));
  const autres = $derived(refus.details?.autres ?? []);

  async function executerRemede() {
    const affiche = refus;
    const rendu = await action.executer();
    if (rendu !== null) lever?.(affiche);
    return rendu;
  }

  // Le lever d'un refus de details.autres : celui du refus qui le porte.
  const leverPorteur = $derived(lever === null ? null : () => lever(refus));
</script>

<div class="refus" role="status" data-refus={refus.code} {id}>
  <p>{message}</p>
  {#if action !== null}
    {#key action}
      <Commande
        cle={action.cle}
        details={action.details}
        nom={action.nom}
        confirmer={action.confirmer}
        executer={executerRemede}
        {gestes}
      />
    {/key}
  {/if}
  {#each autres as autre, rang (rang)}
    <Refus refus={autre} lever={leverPorteur} {gestes} />
  {/each}
</div>

<style>
  .refus {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
    padding: var(--espace-1) var(--espace-2);
    border-left: 3px solid var(--couleur-refus);
    color: var(--couleur-refus);
    font-size: var(--taille-texte);
  }

  p {
    margin: 0;
  }
</style>
