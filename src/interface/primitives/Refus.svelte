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
  //
  // id est l'identifiant du refus, que le contrôle qu'il décrit nomme dans
  // son aria-describedby. Un refus de details.autres n'a pas d'id : il
  // reçoit idPorteur, celui du refus qui le porte, et décrit le même
  // contrôle. objet, déjà traduit, est le nom distinct de ce contrôle, null
  // quand son étiquette suffit : le remède se nomme alors par son texte puis
  // par objet (communs.nom.remede), et deux remèdes de même texte posés
  // contre deux homonymes ne se confondent pas.
  //
  // Le focus ne tombe pas sur le corps de la page : un remède lancé depuis
  // le refus — le focus en lui à son départ — qui retire ce refus retire
  // aussi le bouton qui avait le focus. Après le rendu, un focus tombé sur
  // le corps revient au contrôle décrit : l'élément dont aria-describedby
  // nomme id, ou idPorteur. Un refus sans l'un ni l'autre ne décrit aucun
  // contrôle, et ne rend pas le focus. Un remède qui a porté le focus
  // ailleurs l'y laisse ; un contrôle sorti du document ne le reprend pas.
  //
  // Le refus se peint sur son propre fond, --couleur-refus-fond, bordé de son
  // filet et d'un trait de gauche de la teinte du refus, une icône devant son
  // texte : il se lit de même sur la page, une carte ou une fenêtre.
  import { getContext, tick } from 'svelte';
  import { actionRemede } from './commande.js';
  import Commande from './Commande.svelte';
  import Icone from './Icone.svelte';
  import Refus from './Refus.svelte';

  let { refus, lever = null, gestes = {}, id = undefined, idPorteur = undefined, objet = null } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui') ?? null;

  const message = $derived(t(refus.code, refus.details));
  const action = $derived(actionRemede(refus.details?.remede ?? null, { seance, ui, gestes }));
  const autres = $derived(refus.details?.autres ?? []);

  // L'élément du refus : il dit si le focus est en lui.
  let racine = $state.raw(null);

  // L'id que nomme le contrôle décrit : celui du refus qui porte ce refus
  // de details.autres, sinon le sien ; undefined s'il n'en a aucun.
  const idDecrit = $derived(idPorteur ?? id);

  // Le nom du remède : son texte puis objet, ou null, son texte seul.
  const nomRemede = $derived(
    action === null || objet === null ? null : t('communs.nom.remede', { cle: action.cle, details: action.details, objet }),
  );

  // Le contrôle décrit : l'élément dont aria-describedby nomme idDecrit,
  // parmi les noms qu'il énumère ; null s'il n'y en a aucun.
  function controleDecrit() {
    if (idDecrit === undefined) return null;
    return document.querySelector(`[aria-describedby~="${CSS.escape(idDecrit)}"]`);
  }

  // Rend le focus au contrôle, après le rendu, s'il est tombé sur le corps
  // de la page et que le contrôle est encore dans le document.
  async function rendreFocus(controle) {
    await tick();
    const actif = document.activeElement;
    if ((actif === null || actif === document.body) && controle.isConnected) controle.focus();
  }

  async function executerRemede() {
    const affiche = refus;
    const controle = racine?.contains(document.activeElement) ? controleDecrit() : null;
    const rendu = await action.executer();
    if (rendu !== null) lever?.(affiche);
    if (controle !== null) await rendreFocus(controle);
    return rendu;
  }

  // Le lever d'un refus de details.autres : celui du refus qui le porte.
  const leverPorteur = $derived(lever === null ? null : () => lever(refus));
</script>

<div class="refus" role="status" data-refus={refus.code} {id} bind:this={racine}>
  <p><span class="signe"><Icone nom="interdit" /></span>{message}</p>
  {#if action !== null}
    {#key action}
      <Commande
        cle={action.cle}
        details={action.details}
        nom={action.nom}
        nomAccessible={nomRemede}
        confirmer={action.confirmer}
        executer={executerRemede}
        {gestes}
      />
    {/key}
  {/if}
  {#each autres as autre, rang (rang)}
    <Refus refus={autre} lever={leverPorteur} idPorteur={idDecrit} {objet} {gestes} />
  {/each}
</div>

<style>
  .refus {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-refus-filet);
    border-left: 3px solid var(--couleur-refus);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-refus-fond);
    color: var(--couleur-refus);
    font-size: var(--taille-texte);
  }

  p {
    margin: 0;
  }

  .signe {
    margin-right: var(--espace-1);
    color: var(--couleur-refus-marque);
  }
</style>
