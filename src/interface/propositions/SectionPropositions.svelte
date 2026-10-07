<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La section des propositions (§ 2.1 étape 10, § 5.7, § 9) : la phrase de
  // l'ordre du classement, le tableau, et la commande qui efface la liste en
  // épargnant le retenu. Regarder n'écrit jamais (§ 8.4) : le tableau se lit
  // en lecture et sur un plan bloqué, où la séance refuse elle-même
  // « Retenir » et « Effacer », le refus posé à côté du bouton.
  //
  // La table d'évaluation se lit dans la charge de l'état observable, par
  // evaluation (modele.js) : une seule mesure, celle d'evaluer (A6), refaite
  // à chaque charge écrite ; les indicateurs du retenu suivent donc
  // l'ajustement (§ 2.1 étape 11).
  //
  // « Voir sur le plan » demande la proposition au plan par l'état de
  // navigation, sans écriture, et ouvre la section du plan ; voir(null) y
  // montre le retenu. « Retenir » exécute retenirProposition, puis remet la
  // demande à null : le plan montre le retenu. Quand le retenu est ajusté et
  // que la séance accepterait le geste, retenir détruit ces ajustements : la
  // fenêtre à confirmer le dit d'abord, nommant le retenu ajusté et la
  // proposition qui le remplace (§ 2.1). Un geste que la séance refuserait
  // s'exécute sans fenêtre, et son refus s'affiche. « Effacer » ne détruit
  // aucune saisie — chaque proposition se régénère de sa graine, et le geste
  // se défait — : il s'exécute sans fenêtre.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import Confirmation from '../primitives/Confirmation.svelte';
  import Refus from '../primitives/Refus.svelte';
  import TableauPropositions from './TableauPropositions.svelte';
  import { demandeConfirmation, evaluation, nomDe, retenuAjuste, tableau } from './modele.js';

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');

  const charge = $derived($seance.charge);
  const evaluee = $derived(charge === null ? { table: null, refus: null } : evaluation(charge));
  const ajuste = $derived(charge !== null && retenuAjuste(charge));
  const vue = $derived(evaluee.table === null ? null : tableau(evaluee.table, { ajuste }));

  // La retenue en attente de confirmation, telle que demandeConfirmation la
  // rend : la proposition demandée, le titre et les éléments de la fenêtre ;
  // null sans fenêtre.
  let aConfirmer = $state(null);

  function voir(id) {
    ui.montrerProposition(id);
    ui.allerA('plan');
  }

  async function retenirSansQuestion(id) {
    await seance.executer('retenirProposition', { id });
    ui.montrerProposition(null);
  }

  async function retenir(id) {
    const demande = demandeConfirmation(seance.etat(), id);
    if (demande !== null) {
      aConfirmer = demande;
      return;
    }
    await retenirSansQuestion(id);
  }

  async function confirmer() {
    await retenirSansQuestion(aConfirmer.id);
    aConfirmer = null;
  }

  const effacer = () => seance.executer('effacerPropositions', {});
  const nommer = (id) => nomDe(charge, id);
</script>

<section data-section="propositions">
  <h2>{t('coquille.section.propositions')}</h2>

  {#if charge !== null && charge.propositions.length === 0}
    <p>{t('propositions.aucune')}</p>
  {/if}

  {#if evaluee.refus !== null}
    <Refus refus={evaluee.refus} />
  {/if}

  {#if vue !== null}
    <div class="ordre" data-ordre>
      {#each vue.ordre as phrase (phrase.cle)}
        <p>{t(phrase.cle, phrase.details)}</p>
      {/each}
    </div>
    <TableauPropositions {vue} {nommer} {voir} {retenir} />
  {/if}

  {#if charge !== null && charge.propositions.length > 0}
    <div class="effacer">
      <Commande cle="propositions.commande.effacer" executer={effacer} />
    </div>
  {/if}

  {#if aConfirmer !== null}
    <Confirmation
      titre={aConfirmer.titre.cle}
      details={aConfirmer.titre.details}
      elements={aConfirmer.elements.map((element) => t(element.cle, element.details))}
      surConfirmer={confirmer}
      surAnnuler={() => (aConfirmer = null)}
    />
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: var(--taille-titre);
  }

  p {
    margin: 0;
  }

  .ordre {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  .effacer {
    display: flex;
  }
</style>
