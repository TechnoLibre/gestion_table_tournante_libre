<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Une rubrique des inclusions dans la fiche d'une personne (§ 4, § 10.2),
  // data-inclusions-fiche : sorte 'organisation' porte « Inclusions
  // d'organisation », sorte 'participant' « Inclusions de participant ». La
  // fiche monte les deux, l'une sous l'autre, entre les conflits et la
  // présence, et les recrée à chaque personne ({#key}) : ni brouillon ni
  // refus d'une autre personne n'y restent.
  //
  // En tête, le résumé (data-inclusions-resume) : chaque organisation
  // incluse en pastille neutre à l'icône « ajouter », ou chaque personne
  // incluse par son libellé (libelleDeCible, liste_inclusions.js) — son nom,
  // l'identifiant d'un homonyme, « (exclue) » —, ou une phrase qui dit
  // qu'elle n'en nomme aucune. Puis le choix multiple (ChoixMultiple) : une
  // case par organisation de l'événement hors la sienne (choixDeConflits,
  // liste_conflits.js), ou par personne de l'événement hors elle-même,
  // exclues comprises (choixDeParticipants), avec une zone de recherche ;
  // puis « Appliquer ».
  //
  // Cocher et décocher n'écrivent rien : le brouillon vit dans une machine
  // de champ.js, sur la saisie canonique de liste_inclusions.js, et tient le
  // geste ouvert. « Appliquer », ou Entrée dans les cases ou la recherche,
  // exécute changerInclusionsOrganisation ou changerInclusionsParticipant
  // de la liste entière, une seule entrée pour le geste, et rien quand le
  // brouillon revient à la liste enregistrée ; Échap rend la liste
  // enregistrée. Un refus — séance en lecture, plan bloqué — se pose sous
  // les cases, avec son remède, le brouillon gardé ; une bascule le retire.
  // Une écriture venue d'ailleurs arrive par recevoir : les cases la suivent
  // hors d'un brouillon. L'envoi n'est pas ré-entrant.
  import { getContext, onDestroy, untrack } from 'svelte';
  import { organisationsDe } from '../../application/conflits_organisation.js';
  import { cleNormalisee } from '../../application/csv.js';
  import { nomAffiche } from '../../application/personnes.js';
  import { creerMachineChamp } from '../primitives/champ.js';
  import Pastille from '../primitives/Pastille.svelte';
  import Refus from '../primitives/Refus.svelte';
  import { creerGeste } from '../primitives/geste.js';
  import { effetDe } from '../raccourcis.js';
  import ChoixMultiple from './ChoixMultiple.svelte';
  import { choixDeConflits, lectureConflits, saisieApresBasculeConflit } from './liste_conflits.js';
  import {
    choixDeParticipants,
    ciblesDeParticipants,
    commandeInclusionsOrganisation,
    commandeInclusionsParticipant,
    lectureParticipants,
    libelleDeCible,
    nomDeCible,
    participantsInclus,
    saisieApresBasculeParticipant,
    saisieOrganisationsEnregistree,
    saisieParticipantsEnregistree,
  } from './liste_inclusions.js';

  let { participant, charge, sorte } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const uid = $props.id();
  const geste = creerGeste(seance);
  const idRefus = `${uid}-refus`;

  // Ce que chaque sorte lit et écrit : sa saisie enregistrée, sa lecture,
  // la bascule d'un choix et sa commande.
  const organisation = untrack(() => sorte === 'organisation');
  const lire = organisation ? lectureConflits : lectureParticipants;
  const enregistree = $derived(organisation ? saisieOrganisationsEnregistree(participant) : saisieParticipantsEnregistree(participant));
  const basculerSaisie = organisation ? saisieApresBasculeConflit : saisieApresBasculeParticipant;
  const commande = organisation ? commandeInclusionsOrganisation : commandeInclusionsParticipant;

  // Les organisations de l'événement, exclus compris, et ses personnes, par
  // identifiant : celles qu'une inclusion peut nommer.
  const organisations = $derived(organisationsDe(charge));
  const cibles = $derived(ciblesDeParticipants(charge.participants));
  const libelle = (id) => libelleDeCible(cibles, id, t);

  // Le brouillon des cases, tenu par une machine de champ.js ; le refus posé
  // sous les cases, et l'envoi en cours.
  let machine = untrack(() => creerMachineChamp({ stockee: enregistree, lire }));
  let saisie = $state(untrack(() => machine.saisie));
  let brouillon = $state(false);
  let refus = $state.raw(null);
  let envoi = $state(false);

  function suivre() {
    saisie = machine.saisie;
    brouillon = machine.enCours;
  }

  // La liste enregistrée, venue d'ailleurs, est reçue.
  $effect.pre(() => {
    const recue = enregistree;
    untrack(() => {
      machine.recevoir(recue);
      suivre();
    });
  });

  $effect(() => {
    geste.tenir(brouillon);
  });

  const choix = $derived(
    organisation
      ? choixDeConflits(saisie, organisations, participant.organisation, cleNormalisee)
      : choixDeParticipants(saisie, cibles, participant.id, cleNormalisee),
  );
  const inclus = $derived(
    organisation ? (participant.inclusionsOrganisation ?? []) : participantsInclus(participant.inclusionsParticipant, cibles, cleNormalisee),
  );

  function basculer(valeur, coche) {
    machine.saisir(basculerSaisie(machine.saisie, valeur, coche));
    refus = null;
    suivre();
  }

  // Exécute la liste saisie, quand elle diffère de l'enregistrée : une
  // seule commande, une entrée, pour le geste entier. Un refus la rend au
  // brouillon et se pose sous les cases.
  async function appliquer(evenement) {
    evenement.preventDefault();
    if (envoi) return;
    refus = null;
    const rendu = machine.valider();
    suivre();
    if (rendu.action !== 'executer') return;
    envoi = true;
    try {
      const { nom, args } = commande(participant.id, rendu.valeur);
      await seance.executer(nom, args);
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refus = { code: erreur.code, details: erreur.details ?? {} };
      machine.echec(refus);
      suivre();
    } finally {
      envoi = false;
    }
  }

  // Dans les cases et la recherche : Entrée applique, Échap rend la liste
  // enregistrée.
  function surTouche(evenement) {
    const effet = effetDe('champ', evenement.key);
    if (effet === 'valider') appliquer(evenement);
    else if (effet === 'rendre') {
      evenement.preventDefault();
      machine.abandonner();
      refus = null;
      suivre();
    }
  }

  // Fait défiler l'élément monté jusque dans la fenêtre, au plus court.
  function montrer(cible) {
    cible.scrollIntoView({ block: 'nearest' });
  }

  onDestroy(() => geste.liberer());
</script>

<section class="inclusions" data-inclusions-fiche={sorte} aria-labelledby={`${uid}-titre`}>
  <h4 id={`${uid}-titre`}>{t(organisation ? 'participants.fiche.inclusionsOrganisation' : 'participants.fiche.inclusionsParticipant')}</h4>
  {#if inclus.length === 0}
    <p class="resume" data-inclusions-resume>
      {t(organisation ? 'participants.fiche.aucuneInclusionOrganisation' : 'participants.fiche.aucuneInclusionParticipant')}
    </p>
  {:else if organisation}
    <ul class="resume" data-inclusions-resume>
      {#each inclus as nom (nom)}
        <li><Pastille sorte="statut" valeur="neutre" icone="ajouter" libelle={nom} /></li>
      {/each}
    </ul>
  {:else}
    <ul class="resume" data-inclusions-resume>
      {#each inclus as id (id)}
        <li class="valeur">{libelle(id)}</li>
      {/each}
    </ul>
  {/if}
  <form novalidate onsubmit={appliquer}>
    {#if organisation}
      <ChoixMultiple
        {choix}
        nom={t('participants.inclusions.editeurOrganisations', { nom: nomAffiche(participant) })}
        legende={t('participants.inclusions.legendeOrganisations')}
        vide={t('participants.inclusions.aucuneOrganisation')}
        invalide={refus !== null}
        decrit={refus === null ? undefined : idRefus}
        {basculer}
        toucher={surTouche}
      />
    {:else}
      <ChoixMultiple
        {choix}
        {libelle}
        filtre={{
          nom: t('participants.inclusions.recherche'),
          aucun: (texte) => t('participants.inclusions.aucunResultat', { texte }),
          cle: cleNormalisee,
          lu: (id) => nomDeCible(cibles, id),
        }}
        nom={t('participants.inclusions.editeurParticipants', { nom: nomAffiche(participant) })}
        legende={t('participants.inclusions.legendeParticipants')}
        vide={t('participants.inclusions.aucunParticipant')}
        invalide={refus !== null}
        decrit={refus === null ? undefined : idRefus}
        {basculer}
        toucher={surTouche}
      />
    {/if}
    <div class="boutons">
      <button
        type="submit"
        data-commande={organisation ? 'appliquerInclusionsOrganisation' : 'appliquerInclusionsParticipant'}
        aria-busy={envoi ? 'true' : undefined}
        aria-disabled={envoi ? 'true' : undefined}>{t('participants.inclusions.appliquer')}</button
      >
    </div>
    {#if refus !== null}
      <div class="refus" {@attach montrer}>
        <Refus id={idRefus} {refus} lever={() => (refus = null)} />
      </div>
    {/if}
  </form>
</section>

<style>
  /* La rubrique, comme celle des conflits de la fiche : l'intitulé en
     petites capitales, le résumé de l'encre de la page, les cases, le
     bouton, le refus dessous. Le résumé passe à la ligne quand la place
     manque. */
  .inclusions {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    margin: var(--espace-3) 0;
  }

  h4 {
    margin: 0;
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  .resume {
    margin: 0;
    color: var(--couleur-page-texte);
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1) var(--espace-3);
    padding: 0;
    list-style: none;
  }

  li {
    display: inline-flex;
    align-items: center;
    min-width: 0;
  }

  .valeur {
    white-space: pre-wrap;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
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

  button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  button[aria-disabled='true'] {
    border-style: dashed;
    color: var(--couleur-page-texte-secondaire);
    cursor: progress;
  }

  .refus {
    min-width: 0;
  }
</style>
