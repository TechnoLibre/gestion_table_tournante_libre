<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La section des participants (§ 2.1 étape 3, § 4, § 10.2) : le
  // formulaire d'ajout, le filtre, le compte, l'export, la grille et la
  // fiche ouverte. Les lignes de la grille sont celles de lignesGrille
  // (grille.js) sur la liste de la séance, le tri et le filtre de la
  // section : regarder, trier et filtrer n'écrivent rien, en écriture comme
  // en lecture. La fiche ouverte est celle de l'état de navigation, ui.fiche.
  //
  // Supprimer une personne qui porte des réservations ouvre la fenêtre à
  // confirmer, qui les nomme ; sans réservation, ou quand la séance refuse
  // déjà tout geste modifiant, la commande part et la séance répond. L'export
  // remet les octets d'exporterParticipants à facade.enregistrerSous, sous le
  // nom ‹base›-participants.csv (nomExport).
  import { getContext } from 'svelte';
  import { cleNormalisee, exporterParticipants } from '../../application/csv.js';
  import { nomAffiche } from '../../application/personnes.js';
  import Commande from '../primitives/Commande.svelte';
  import Confirmation from '../primitives/Confirmation.svelte';
  import Fiche from './Fiche.svelte';
  import Formulaire from './Formulaire.svelte';
  import Grille from './Grille.svelte';
  import { lignesGrille, nomExport, reservationsDe } from './grille.js';

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const facade = getContext('facade');
  const uid = $props.id();

  let tri = $state.raw(null);
  let filtre = $state('');
  // La suppression qui attend sa confirmation : {participant, reservations}.
  let aSupprimer = $state.raw(null);

  const charge = $derived($seance.charge);
  const participants = $derived(charge?.participants ?? []);
  const lignes = $derived(lignesGrille(participants, { tri, filtre }, cleNormalisee));
  const personneFiche = $derived($ui.fiche === null ? null : (participants.find(({ id }) => id === $ui.fiche) ?? null));

  async function exporter() {
    const { evenement, charge: courante } = seance.etat();
    await facade.enregistrerSous(nomExport(evenement.base), exporterParticipants(courante.participants));
  }

  function supprimer(participant) {
    const reservations = reservationsDe(seance.etat().charge, participant.id);
    if (seance.etat().refus === null && reservations.length > 0) {
      aSupprimer = { participant, reservations };
      return null;
    }
    return seance.executer('supprimerParticipant', { id: participant.id });
  }

  async function confirmerSuppression() {
    await seance.executer('supprimerParticipant', { id: aSupprimer.participant.id });
    aSupprimer = null;
  }
</script>

<section data-section="participants">
  <h2>{t('coquille.section.participants')}</h2>

  <Formulaire {participants} />

  <div class="outils">
    <div class="filtre">
      <label for={`${uid}-filtre`}>{t('participants.grille.filtre')}</label>
      <input id={`${uid}-filtre`} type="search" data-champ="filtre" bind:value={filtre} />
    </div>
    <output>{t('participants.grille.compte', { total: participants.length, affiches: lignes.length })}</output>
    <Commande cle="participants.commande.exporter" nom="exporter" executer={exporter} />
  </div>

  <div class="corps">
    <div class="liste">
      <Grille {lignes} bind:tri {supprimer} />
      {#if participants.length === 0}
        <p>{t('participants.grille.vide')}</p>
      {:else if lignes.length === 0}
        <p>{t('participants.grille.aucunResultat')}</p>
      {/if}
    </div>
    {#if personneFiche !== null}
      <Fiche participant={personneFiche} {charge} />
    {/if}
  </div>

  {#if aSupprimer !== null}
    <Confirmation
      titre="participants.suppression.titre"
      details={{ personne: nomAffiche(aSupprimer.participant) }}
      elements={aSupprimer.reservations.map((reservation) => t('participants.suppression.reservation', reservation))}
      surConfirmer={confirmerSuppression}
      surAnnuler={() => (aSupprimer = null)}
    />
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
  }

  h2 {
    margin: 0;
    font-size: var(--taille-titre);
  }

  .outils {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--espace-3);
  }

  .filtre {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  input {
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
  }

  input:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 1px;
  }

  output {
    font-size: var(--taille-texte);
  }

  .corps {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-4);
  }

  .liste {
    flex: 1 1 32rem;
    min-width: 0;
  }

  p {
    margin: var(--espace-2) 0;
  }
</style>
