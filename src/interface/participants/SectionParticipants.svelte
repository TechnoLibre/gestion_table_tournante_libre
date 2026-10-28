<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La section des participants (§ 2.1 étape 3, § 4, § 10.2) : une carte
  // titrée, dont l'en-tête porte la ligne de comptes (comptesEntete,
  // entete.js) et l'export ; dessous, le formulaire d'ajout en bande de tête,
  // puis la barre du filtre, du groupement, du compte et des légendes des
  // organisations et des étiquettes, puis la grille ; à côté, la fiche ouverte, ou dessous
  // quand la ligne ne tient pas les deux. Les lignes de la grille sont
  // celles de lignesGrille (grille.js) sur la liste de la séance, le tri et le filtre de la
  // section : regarder, trier et filtrer n'écrivent rien, en écriture comme
  // en lecture. La grille reçoit le nombre de tours de l'événement, celui
  // des cases de la présence. La fiche ouverte est celle de l'état de
  // navigation, ui.fiche. La ligne de comptes dit les présences partielles
  // quand il y en a.
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
  // La case « Montrer les inclusions » (data-champ="montrerInclusions"),
  // après le groupement, montre la colonne des inclusions et celle des
  // inclusions du placement, masquées par défaut (MASQUABLES,
  // colonnesMontrees) ; la grille reçoit les colonnes montrées. Le choix vit
  // dans la section, le temps qu'elle est ouverte, et n'écrit rien. Masquer
  // les colonnes retire le tri que portait celle des inclusions, et la grille
  // abandonne une édition ouverte sur elle.
  //
  // Groupée, la liste lit les conflits du placement que le plan montre —
  // la proposition demandée, ui.proposition, sinon le retenu — par
  // conflitsDuPlacement (src/application/conflits_placement.js), recalculés
  // à chaque changement de la charge, du groupement ou de la proposition
  // montrée, puis rangés sous les groupes par conflitsDesGroupes, que Grille
  // écrit. Sans groupement, ou sans placement montré, aucun conflit ne se
  // lit.
  //
  // Les teintes d'organisation (teintesOrganisations) se calculent une fois
  // sur la liste entière, exclues comprises, et la légende comme la grille
  // les lisent : un filtre ne repeint rien. La légende nomme chaque
  // organisation avec le nombre de personnes qui la portent. Dessous, quand
  // l'événement porte des étiquettes, la légende des étiquettes
  // (legendeEtiquettes, entete.js) nomme chacune avec le nombre de
  // personnes qui la portent, exclues comprises, en pastilles neutres à
  // icône : la teinte d'organisation ne sert qu'à l'organisation (§ 12.7).
  // Sans étiquette, elle n'est pas montrée.
  //
  // Supprimer une personne qui porte des réservations ouvre la fenêtre à
  // confirmer, qui les nomme ; sans réservation, ou quand la séance refuse
  // déjà tout geste modifiant, la commande part et la séance répond. L'export
  // remet les octets d'exporterParticipants à facade.enregistrerSous, sous le
  // nom ‹base›-participants.csv (nomExport). Un export enregistré dont des
  // inclusions visent une personne de même nom qu'une autre
  // (inclusionsVersHomonymes) le dit en avis sous l'en-tête
  // (data-avertissement="inclusionsVersHomonymes"), tant que la liste reste
  // celle qu'il a écrite.
  import { getContext } from 'svelte';
  import { cleNormalisee, exporterParticipants, inclusionsVersHomonymes } from '../../application/csv.js';
  import { nomAffiche } from '../../application/personnes.js';
  import { teintesOrganisations } from '../organisations.js';
  import Carte from '../primitives/Carte.svelte';
  import Commande from '../primitives/Commande.svelte';
  import Pastille from '../primitives/Pastille.svelte';
  import Confirmation from '../primitives/Confirmation.svelte';
  import Icone from '../primitives/Icone.svelte';
  import Fiche from './Fiche.svelte';
  import Formulaire from './Formulaire.svelte';
  import Grille from './Grille.svelte';
  import { statuts } from '../../application/places.js';
  import { conflitsDuPlacement } from '../../application/conflits_placement.js';
  import { nomsDesTours } from '../../application/tours.js';
  import { conflitsDesGroupes, lignesDeConflit, reglesParPersonne } from './conflits.js';
  import { comptesEntete, legendeOrganisations, legendeEtiquettes } from './entete.js';
  import {
    MASQUABLES,
    choisirGroupement,
    cleDeGroupement,
    clesPremierNiveau,
    colonnesMontrees,
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
  // Les colonnes des inclusions montrées, et les colonnes que la grille
  // reçoit.
  let inclusionsMontrees = $state(false);
  const colonnes = $derived(colonnesMontrees(inclusionsMontrees ? MASQUABLES : []));
  // La suppression qui attend sa confirmation : {participant, reservations}.
  let aSupprimer = $state.raw(null);
  // Le dernier export enregistré qui nomme des homonymes : la liste qu'il a
  // écrite et le nombre d'inclusions en cause ; null sinon.
  let exportAHomonymes = $state.raw(null);

  const charge = $derived($seance.charge);
  const participants = $derived(charge?.participants ?? []);
  const teintes = $derived(teintesOrganisations(participants));
  const comptes = $derived(comptesEntete(participants));
  const legende = $derived(legendeOrganisations(participants, teintes));
  const legendeDesEtiquettes = $derived(legendeEtiquettes(participants));
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
  const homonymesExportes = $derived(exportAHomonymes?.participants === participants ? exportAHomonymes.n : 0);

  // Montre ou masque la colonne des inclusions ; masquée, son tri tombe.
  function montrerInclusions(montrer) {
    inclusionsMontrees = montrer;
    if (!montrer && tri?.colonne === 'inclusions') tri = null;
  }

  function choisirNiveau(rang, colonne) {
    groupement = choisirGroupement(groupement, rang, colonne);
    replies = new Set();
  }

  async function exporter() {
    const { evenement, charge: courante } = seance.etat();
    const chemin = await facade.enregistrerSous(nomExport(evenement.base), exporterParticipants(courante.participants));
    const n = chemin === null ? 0 : inclusionsVersHomonymes(courante.participants);
    exportAHomonymes = n === 0 ? null : { participants: courante.participants, n };
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

<div class="section" data-section="participants">
  <div class="corps">
    <div class="liste">
      <Carte titre={t('coquille.section.participants')} sousTitre={t('participants.entete.comptes', comptes)} plein>
        {#snippet actions()}
          <Commande cle="participants.commande.exporter" nom="exporter" executer={exporter} />
        {/snippet}

        {#if homonymesExportes > 0}
          <div class="signal" role="status" data-avertissement="inclusionsVersHomonymes">
            <span class="signe"><Icone nom="triangle" /></span>
            <p>{t('participants.export.homonymes', { n: homonymesExportes })}</p>
          </div>
        {/if}

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
          <label class="bascule">
            <input
              type="checkbox"
              data-champ="montrerInclusions"
              checked={inclusionsMontrees}
              onchange={(evenement) => montrerInclusions(evenement.currentTarget.checked)}
            />
            <span>{t('participants.grille.montrerInclusions')}</span>
          </label>
          {#if groupes !== null}
            <button type="button" data-commande="toutReplier" onclick={() => (replies = new Set(clesPremierNiveau(groupesEntiers)))}>
              {t('participants.groupe.toutReplier')}
            </button>
            <button type="button" data-commande="toutDeplier" onclick={() => (replies = new Set())}>
              {t('participants.groupe.toutDeplier')}
            </button>
          {/if}
          <output>{t('participants.grille.compte', { total: participants.length, affiches: lignes.length })}</output>
          {#if legende.length > 0 || legendeDesEtiquettes.length > 0}
            <div class="legendes">
              {#if legende.length > 0}
                <ul class="legende" aria-label={t('participants.legende.titre')}>
                  {#each legende as { nom, rang, compte } (nom)}
                    <li><Pastille sorte="organisation" valeur={rang} libelle={t('participants.legende.element', { nom, compte })} /></li>
                  {/each}
                </ul>
              {/if}
              {#if legendeDesEtiquettes.length > 0}
                <ul class="legende" data-legende-etiquettes aria-label={t('participants.legendeEtiquettes.titre')}>
                  {#each legendeDesEtiquettes as { nom, compte } (nom)}
                    <li>
                      <Pastille sorte="statut" valeur="neutre" icone="etiquettes" libelle={t('participants.legende.element', { nom, compte })} />
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        </div>

        <Grille
          {lignes}
          {groupes}
          {teintes}
          {colonnes}
          bind:replies
          bind:tri
          {supprimer}
          conflits={conflitsParGroupe}
          {enConflit}
          tours={charge?.evenement.tours ?? 1}
        />
        {#if participants.length === 0}
          <p class="vide">{t('participants.grille.vide')}</p>
        {:else if lignes.length === 0}
          <p class="vide">{t('participants.grille.aucunResultat')}</p>
        {/if}
      </Carte>
    </div>
    {#if personneFiche !== null}
      <Fiche participant={personneFiche} {charge} />
    {/if}
  </div>

  {#if aSupprimer !== null}
    <Confirmation
      titre="participants.suppression.titre"
      details={{ personne: nomAffiche(aSupprimer.participant) }}
      elements={aSupprimer.reservations.map((reservation) =>
        t('participants.suppression.reservation', { ...reservation, nomsTours: nomsDesTours(charge) }),
      )}
      surConfirmer={confirmerSuppression}
      surAnnuler={() => (aSupprimer = null)}
    />
  {/if}
</div>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
  }

  /* L'avis d'un export qui nomme des homonymes, en tête de la carte : le
     filet et la marque de l'avis, comme les signaux de la fiche. */
  .signal {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: var(--espace-2);
    margin: var(--espace-3) var(--espace-5) 0;
    padding: var(--espace-2);
    border: 1px solid var(--couleur-avis-filet);
    border-left: 3px solid var(--couleur-avis-marque);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-avis-fond);
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte-petit);
  }

  .signal .signe {
    display: inline-flex;
    color: var(--couleur-avis-marque);
  }

  .signal p {
    margin: 0;
  }

  /* La barre sous le formulaire : filtre, groupement, compte, puis la
     légende, poussée à droite tant que la ligne la tient. */
  .outils {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--espace-3) var(--espace-4);
    padding: var(--espace-3) var(--espace-5);
  }

  .filtre {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    font-size: var(--taille-texte-petit);
    font-weight: bold;
  }

  input,
  select {
    box-sizing: border-box;
    min-height: 2.5rem;
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
    font-weight: normal;
  }

  /* La case de la colonne des inclusions, à la hauteur des champs, son
     libellé à droite. */
  .bascule {
    display: inline-flex;
    align-items: center;
    gap: var(--espace-1);
    min-height: 2.5rem;
    font-size: var(--taille-texte-petit);
    font-weight: bold;
  }

  .bascule input {
    min-height: 0;
    margin: 0;
    padding: 0;
  }

  .outils > button {
    min-height: 2.5rem;
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
    cursor: pointer;
  }

  .outils > button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  input:focus-visible,
  select:focus-visible,
  .outils > button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 1px;
  }

  output {
    align-self: center;
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }

  /* Les légendes, poussées à droite tant que la ligne les tient : celle
     des étiquettes sous celle des organisations. */
  .legendes {
    display: flex;
    flex-direction: column;
    align-self: center;
    align-items: flex-end;
    gap: var(--espace-2);
    min-width: 0;
    margin-left: auto;
  }

  .legende {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--espace-1) var(--espace-2);
    min-width: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .legende li {
    display: flex;
    min-width: 0;
  }

  .corps {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-4);
  }

  /* La liste réclame le plancher du tableau (Grille, 59rem) et le cadre de
     sa carte : quand la ligne ne tient plus la liste et la fiche côte à
     côte, la fiche passe dessous, et le tableau garde toute sa largeur. */
  .liste {
    flex: 1 1 60rem;
    min-width: 0;
  }

  .vide {
    margin: 0;
    padding: var(--espace-4) var(--espace-5);
    color: var(--couleur-page-texte-secondaire);
  }
</style>
