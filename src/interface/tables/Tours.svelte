<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le nombre de tours (§ 2.1 étape 5, § 4, § 4.3) : son champ. Une saisie
  // lue s'essaie d'abord sur la charge sans rien écrire (refusDeCommande) :
  // refusée, son refus se pose sur le champ. Acceptée, elle s'applique
  // aussitôt quand rien ne se perd — une hausse, dont la dérive des
  // placements s'avertit par la séance ; sinon la fenêtre à confirmer
  // nomme, avant toute écriture, les réservations « tour désigné » qu'elle
  // détruit — personne et table —, les objectifs de table des tours retirés
  // — table, tour et étiquettes (§ 4.3, A3) — et les placements qui perdent
  // des tours (bilanTours, annonceTours, elementsTours). Annuler la ferme et
  // remonte le champ, qui rend la valeur enregistrée ; Confirmer exécute le
  // changement, une entrée.
  import { getContext } from 'svelte';
  import { bilanTours } from '../../application/bilans.js';
  import { lireEntier } from '../../application/capacite.js';
  import { ErreurCommande } from '../../application/erreurs.js';
  import Champ from '../primitives/Champ.svelte';
  import Confirmation from '../primitives/Confirmation.svelte';
  import { annonceTours, elementsTours, refusDeCommande } from './modele.js';

  let { charge } = $props();

  const t = getContext('t');
  const seance = getContext('seance');

  // Le rang du champ, qui le remonte ; la fenêtre ouverte : les tours
  // demandés, ceux d'avant et ce qu'elle nomme.
  let rangChamp = $state(0);
  let fenetre = $state.raw(null);

  function demander(tours) {
    const refus = refusDeCommande(charge, 'changerTours', { tours });
    if (refus !== null) throw new ErreurCommande(refus.code, refus.details);
    const bilan = bilanTours(charge, tours);
    if (!annonceTours(bilan, charge.evenement.tours, tours)) return seance.executer('changerTours', { tours });
    fenetre = {
      tours,
      avant: charge.evenement.tours,
      elements: elementsTours(charge, bilan).map(({ cle, details }) => t(cle, details)),
    };
    return undefined;
  }

  async function confirmer() {
    await seance.executer('changerTours', { tours: fenetre.tours });
    fenetre = null;
  }

  function annuler() {
    fenetre = null;
    rangChamp += 1;
  }
</script>

<div class="tours" data-tours>
  {#key rangChamp}
    <Champ cle="tours" etiquette="tables.tours.etiquette" valeur={charge.evenement.tours} lire={lireEntier} executer={demander} />
  {/key}
  {#if fenetre !== null}
    <Confirmation
      titre="tables.tours.confirmation"
      details={{ avant: fenetre.avant, apres: fenetre.tours }}
      elements={fenetre.elements}
      surConfirmer={confirmer}
      surAnnuler={annuler}
    />
  {/if}
</div>

<style>
  .tours {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
  }
</style>
