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
  // « Grouper par » groupe les lignes par une ou plusieurs colonnes de
  // GROUPEMENTS, la plus large d'abord, en groupes imbriqués de
  // groupesGrille, sur les lignes déjà filtrées et triées. Un sélecteur par
  // niveau de niveauxAffiches : un par colonne choisie, puis celui du
  // niveau suivant tant qu'une colonne reste libre ; chacun offre
  // colonnesOffertes, et son choix passe par choisirGroupement — la valeur
  // vide retire son niveau et ceux d'après. Le statut se lit dans statuts
  // (src/application/places.js), calculé seulement quand il groupe.
  // Le libellé d'un groupe se lit sur la liste entière, avant le filtre, et
  // ne change pas avec lui. « Tout replier » replie les groupes du premier
  // niveau de la liste entière, ceux que le filtre cache compris : effacer
  // le filtre les montre repliés. « Tout déplier » déplie les groupes de tout
  // niveau. Le groupement et les groupes repliés vivent
  // dans la section, le temps qu'elle est ouverte : changer de groupement
  // déplie tout, et rien ne s'écrit.
  //
  // Groupée, la liste lit les conflits du placement que le plan montre —
  // la proposition demandée, ui.proposition, sinon le retenu — par
  // conflitsDuPlacement (src/application/conflits_placement.js), recalculés
  // à chaque changement de la charge, du groupement ou de la proposition
  // montrée, puis rangés sous les groupes par conflitsDesGroupes, que Grille
  // écrit. Sans groupement, ou sans placement montré, aucun conflit ne se
  // lit.
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
  import { statuts } from '../../application/places.js';
  import { conflitsDuPlacement } from '../../application/conflits_placement.js';
  import { conflitsDesGroupes, lignesDeConflit, reglesParPersonne } from './conflits.js';
  import {
    choisirGroupement,
    cleDeGroupement,
    clesPremierNiveau,
    colonnesOffertes,
    groupesGrille,
    lignesGrille,
    niveauxAffiches,
    nomExport,
    reservationsDe,
  } from './grille.js';

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const facade = getContext('facade');
  const uid = $props.id();

  let tri = $state.raw(null);
  let filtre = $state('');
  // Les colonnes du groupement, la plus large d'abord, vide sans
  // groupement, et les clés des groupes repliés.
  let groupement = $state.raw([]);
  let replies = $state.raw(new Set());
  // La suppression qui attend sa confirmation : {participant, reservations}.
  let aSupprimer = $state.raw(null);

  const charge = $derived($seance.charge);
  const participants = $derived(charge?.participants ?? []);
  const lignes = $derived(lignesGrille(participants, { tri, filtre }, cleNormalisee));
  const toutes = $derived(lignesGrille(participants, { tri, filtre: '' }, cleNormalisee));
  const parStatut = $derived(groupement.includes('statut') && charge !== null ? statuts(charge).parId : null);
  const groupes = $derived(
    groupement.length === 0 ? null : groupesGrille(lignes, groupement, { tri, cleNormalisee, statuts: parStatut, toutes }),
  );
  // Les groupes de la liste entière, que « Tout replier » replie.
  const groupesEntiers = $derived(
    groupement.length === 0 ? null : groupesGrille(toutes, groupement, { tri, cleNormalisee, statuts: parStatut }),
  );
  const niveaux = $derived(niveauxAffiches(groupement));
  const conflits = $derived(
    groupes === null || charge === null ? null : lignesDeConflit(conflitsDuPlacement(charge, { proposition: $ui.proposition }), participants),
  );
  const conflitsParGroupe = $derived(groupes === null ? new Map() : conflitsDesGroupes(groupes, conflits));
  const enConflit = $derived(reglesParPersonne(conflits));
  const personneFiche = $derived($ui.fiche === null ? null : (participants.find(({ id }) => id === $ui.fiche) ?? null));

  function choisirNiveau(rang, colonne) {
    groupement = choisirGroupement(groupement, rang, colonne);
    replies = new Set();
  }

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
    {#each niveaux as rang (rang)}
      <div class="filtre">
        <label for={`${uid}-grouper-${rang + 1}`}>
          {rang === 0 ? t('participants.groupe.grouperPar') : t('participants.groupe.puisPar', { niveau: rang + 1 })}
        </label>
        <select
          id={`${uid}-grouper-${rang + 1}`}
          data-champ="grouper"
          data-niveau={rang + 1}
          value={groupement[rang] ?? ''}
          onchange={(evenement) => choisirNiveau(rang, evenement.currentTarget.value)}
        >
          <option value="">{t(rang === 0 ? 'participants.groupe.aucun' : 'participants.groupe.aucunSousGroupe')}</option>
          {#each colonnesOffertes(groupement, rang) as colonne (colonne)}
            <option value={colonne}>{t(cleDeGroupement(colonne))}</option>
          {/each}
        </select>
      </div>
    {/each}
    {#if groupes !== null}
      <button type="button" data-commande="toutReplier" onclick={() => (replies = new Set(clesPremierNiveau(groupesEntiers)))}>
        {t('participants.groupe.toutReplier')}
      </button>
      <button type="button" data-commande="toutDeplier" onclick={() => (replies = new Set())}>
        {t('participants.groupe.toutDeplier')}
      </button>
    {/if}
    <output>{t('participants.grille.compte', { total: participants.length, affiches: lignes.length })}</output>
    <Commande cle="participants.commande.exporter" nom="exporter" executer={exporter} />
  </div>

  <div class="corps">
    <div class="liste">
      <Grille {lignes} {groupes} bind:replies bind:tri {supprimer} conflits={conflitsParGroupe} {enConflit} />
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

  input,
  select {
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
  }

  .outils > button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
    cursor: pointer;
  }

  input:focus-visible,
  select:focus-visible,
  .outils > button:focus-visible {
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
