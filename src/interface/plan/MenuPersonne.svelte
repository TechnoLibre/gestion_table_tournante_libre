<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Le menu d'une personne (§ 7.1) : les actions d'un glissement, sans
  // glisser, pour le tactile et le clavier, et ce qu'aucun glissement ne
  // fait. Les actions sont celles d'actionsPersonne (modele.js), lues sur la
  // place que la personne occupe au tour montré :
  //  - déplacer, échanger : la personne devient le choix en attente
  //    (ui.choix) ; une place choisie ensuite, « Assigner » donne ce que
  //    donne le dépôt du glissement (PanneauPlace, commandeDeDepot) ;
  //  - retirer du tour : le dépôt sur le sol, par commandeDeDepot ;
  //  - réserver ici : une réservation du tour montré à sa place ;
  //  - déplacer sa réservation : la réservation qui tient sa chaise devient
  //    le choix en attente, que « Déplacer la réservation ici » déplace ;
  //  - exclure, ou réintégrer une exclue ;
  //  - ouvrir la fiche, dans la section des participants (ui.ouvrirFiche).
  // Un refus se pose sur sa place, ou sur la place sélectionnée quand elle
  // n'est pas assise (executerSurPlace), sinon à côté de la commande.
  //
  // participant : l'identifiant de la personne ; le menu porte data-menu.
  // etatTour : l'état des places du tour affiché, que SectionPlan calcule et
  // que le panneau de la place passe, ou null sans événement.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import { commandeDeDepot } from './depot.js';
  import { actionsPersonne, executerSurPlace } from './modele.js';
  import { nomDeCharge } from './vue_plan.js';

  let { participant, etatTour } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const uid = $props.id();

  const charge = $derived($seance.charge);
  const fiche = $derived(charge === null ? undefined : charge.participants.find(({ id }) => id === participant));
  const etat = $derived(fiche === undefined ? null : etatTour);
  const tour = $derived(etatTour === null ? 1 : etatTour.tour);
  // La place que la personne occupe au tour montré, et sa chaise, ou null.
  const assise = $derived.by(() => {
    if (etat === null) return null;
    for (const table of etat.tables) {
      const chaise = table.chaises.find(({ occupant }) => occupant === participant);
      if (chaise !== undefined) return { place: { table: table.id, siege: chaise.siege }, chaise };
    }
    return null;
  });
  const retrait = $derived(
    assise === null
      ? null
      : commandeDeDepot({ etatPlaces: etat, tour, personne: participant, depuis: assise.place, cible: null, surLeSol: true }),
  );
  const enEvidence = $derived($ui.miseEnEvidence === participant);
  const actions = $derived(
    fiche === undefined ? [] : actionsPersonne({ exclu: fiche.exclu, chaise: assise?.chaise ?? null, retrait, enEvidence }),
  );

  const dependances = { seance, ui };
  // Où poser un refus : sa place, sinon la place sélectionnée.
  const lieu = () => assise?.place ?? ui.etat().selection ?? null;

  function choisirPersonne() {
    ui.choisir({ genre: 'personne', participant, depuis: assise === null ? null : assise.place });
  }

  async function retirerDuTour() {
    if (Object.hasOwn(retrait, 'refus')) {
      ui.poserSurPlace({ place: assise.place, refus: retrait.refus, avertissements: [] });
      return;
    }
    await executerSurPlace(dependances, assise.place, retrait.commande, retrait.arguments);
  }

  async function reserverIci() {
    const { table, siege } = assise.place;
    await executerSurPlace(dependances, assise.place, 'reserver', { participant, table, siege, portee: 'tour', tour });
  }

  function deplacerReservation() {
    const { portee, tour: sonTour } = assise.chaise.reservation;
    ui.choisir({ genre: 'reservation', participant, depuis: assise.place, de: { table: assise.place.table, portee, tour: sonTour } });
  }

  const EXECUTIONS = {
    deplacer: choisirPersonne,
    echanger: choisirPersonne,
    retirerDuTour,
    reserverIci,
    deplacerReservation,
    exclure: () => executerSurPlace(dependances, lieu(), 'exclureParticipant', { id: participant }),
    reintegrer: () => executerSurPlace(dependances, lieu(), 'reintegrerParticipant', { id: participant }),
    mettreEnEvidence: () => ui.mettreEnEvidence(participant),
    oterEvidence: () => ui.mettreEnEvidence(null),
    ouvrirFiche: () => ui.ouvrirFiche(participant),
  };
</script>

{#if fiche !== undefined}
  <section class="menu" data-menu={participant} aria-labelledby="{uid}-titre">
    <h4 id="{uid}-titre"><span>{t('plan.menu.titre')}</span><span class="donnee">{nomDeCharge(charge)(participant)}</span></h4>
    <div class="actions">
      {#each actions as action (action)}
        <Commande cle="plan.menu.{action}" nom={action} executer={EXECUTIONS[action]} />
      {/each}
    </div>
  </section>
{/if}

<style>
  /* Le menu suit les actions de la place, dans la même carte, sous un filet
     de la carte ; son titre nomme la personne. */
  .menu {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    margin-top: var(--espace-1);
    padding-top: var(--espace-3);
    border-top: 1px solid var(--couleur-carte-filet);
  }

  h4 {
    margin: 0;
    font-size: var(--taille-texte);
  }

  .donnee {
    font-weight: 700;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }
</style>
