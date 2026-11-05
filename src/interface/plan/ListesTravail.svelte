<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Les listes de travail du plan (§ 5.8, § 4.1, § 4.2, § 2.1 étape 6) : le
  // travail qui reste, montré plutôt que fait, par des listes cliquables qui
  // mènent à la place ou à la personne.
  //  - Les titres de place non pourvus (titresNonPourvus, A5),
  //    [data-liste-travail=titres] : « table N : titre <libellé> non
  //    pourvu ». Un clic sélectionne la place et porte le focus à la racine
  //    du plan, qui l'active et l'amène dans le cadre.
  //  - Les personnes au titre pressenti sans réservation
  //    (pressentisNonReserves), [data-liste-travail=pressentis] : un clic en
  //    fait la personne choisie ; « Désigner », dans le panneau de la place,
  //    propose son titre pressenti pour libellé (A5).
  //  - Les personnes que le placement retenu laisse en réserve
  //    (enReserveDansLeRetenu), [data-liste-travail=reserves] : « <nom> — en
  //    réserve aux tours 3 et 4 », le travail qu'un changement de
  //    participants laisse. Un clic montre le premier de ces tours, puis en
  //    fait la personne choisie, dans cet ordre : montrer un tour oublie le
  //    choix (etat_ui.js). Un clic sur la personne déjà choisie l'oublie.
  //    La liste n'est pas dans le DOM sans retenu.
  //  - Les inclusions non satisfaites du placement que le plan montre — la
  //    proposition demandée, sinon le retenu — (inclusionsDuPlacement,
  //    qualite/inclusions.js), [data-liste-travail=inclusions] : la phrase
  //    de chaque avis (PhraseInclusion), dans l'ordre de la mesure. Un clic
  //    fait de la personne qui le porte la personne choisie, un clic sur la
  //    personne déjà choisie l'oublie. Aucune table ne la signale. La liste
  //    n'est dans le DOM que quand ce placement se mesure et qu'une
  //    inclusion est active.
  //  - Les conversions proposées (conversionsPossibles, § 4.2) : R
  //    réservations « tour » à une table qu'une seule « tous les tours »
  //    remplacerait. « Convertir » l'exécute ; « Ignorer » la retire de la
  //    liste jusqu'au prochain montage, sans rien écrire.
  // Chaque ligne de titre a pour clé son rang : deux titres égaux à une
  // même place restent deux lignes.
  // Le libellé d'un titre, le titre pressenti et le nom d'une personne sont
  // des données, chacun dans son nœud. Échap, sur le panneau ou l'un de ses
  // contrôles, oublie le choix en attente. Le panneau lit 'seance' et 'ui'
  // au contexte, sans propriété.
  import { getContext, tick } from 'svelte';
  import { nomsDesTours } from '../../application/tours.js';
  import {
    conversionsPossibles,
    enReserveDansLeRetenu,
    pressentisNonReserves,
    titresNonPourvus,
  } from '../../application/listes_travail.js';
  import Commande from '../primitives/Commande.svelte';
  import { avisNomme, inclusionsDuPlacement } from '../qualite/inclusions.js';
  import PhraseInclusion from '../qualite/PhraseInclusion.svelte';
  import { effetDe } from '../raccourcis.js';
  import { nomDeCharge } from './vue_plan.js';

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const uid = $props.id();

  const charge = $derived($seance.charge);
  // Les noms des tours, que les libellés d'un tour lisent (aides.js).
  const nomsTours = $derived(charge === null ? [] : nomsDesTours(charge));
  const nomDe = $derived(charge === null ? null : nomDeCharge(charge));
  const titres = $derived(charge === null ? [] : titresNonPourvus(charge));
  const pressentis = $derived(charge === null ? [] : pressentisNonReserves(charge));
  const avecRetenu = $derived(charge !== null && charge.retenu !== null);
  const enReserve = $derived(avecRetenu ? enReserveDansLeRetenu(charge) : []);
  // Les avis des inclusions du placement montré, nommés ; null quand ce
  // placement ne se mesure pas ou qu'aucune inclusion n'est active.
  const inclusions = $derived(charge === null ? null : inclusionsDuPlacement(charge, $ui.proposition));
  const avisInclusions = $derived(
    inclusions?.statut === 'mesuree' ? inclusions.inclusions.nonSatisfaites.map((avis) => avisNomme(avis, nomDe)) : null,
  );
  // Les conversions que l'opérateur a ignorées, par clé « personne:table ».
  let ignorees = $state([]);
  const conversions = $derived(
    charge === null
      ? []
      : conversionsPossibles(charge)
          .map((conversion) => ({ ...conversion, cle: `${conversion.participant}:${conversion.table}` }))
          .filter(({ cle }) => !ignorees.includes(cle)),
  );
  const numeroDe = (id) => charge.tables.find((table) => table.id === id).numero;
  const choix = $derived($ui.choix);
  const choisie = (id) => choix !== null && choix.genre === 'personne' && choix.participant === id;

  // La place d'un titre sélectionnée, puis le focus à la racine du plan.
  async function allerAuTitre(evenement, { table, siege }) {
    const section = evenement.currentTarget.closest('[data-section]');
    ui.selectionner({ table, siege });
    await tick();
    section?.querySelector('[data-plan]')?.focus();
  }

  function basculer(id) {
    ui.choisir(choisie(id) ? null : { genre: 'personne', participant: id, depuis: null });
  }

  // Le premier tour où le retenu la réserve, montré, puis la personne
  // choisie ; la personne déjà choisie est oubliée.
  function placerDepuisLaReserve(participant, tours) {
    if (choisie(participant)) {
      ui.choisir(null);
      return;
    }
    ui.montrerTour(tours[0]);
    ui.choisir({ genre: 'personne', participant, depuis: null });
  }

  function surTouche(evenement) {
    if (effetDe('plan', evenement.key) !== 'remonter' || choix === null) return;
    evenement.preventDefault();
    ui.choisir(null);
  }
</script>

<!-- Échap remonte des contrôles des listes jusqu'à elles, qui oublient le choix. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="carte" aria-labelledby="{uid}-titre" onkeydown={surTouche}>
  <h3 id="{uid}-titre">{t('plan.listesTravail.titre')}</h3>
  {#if charge !== null}
    <div class="corps">
      <h4 id="{uid}-titres">{t('plan.listesTravail.titres')}</h4>
      <ul data-liste-travail="titres" aria-labelledby="{uid}-titres">
        {#each titres as titre, rang (rang)}
          <li>
            <button type="button" data-titre="{titre.table}:{titre.siege}" onclick={(evenement) => allerAuTitre(evenement, titre)}
              ><span>{t('plan.listesTravail.titreNonPourvu', { numero: titre.numero })}</span><span class="donnee"
                >{titre.libelle}</span
              ><span>{t('plan.listesTravail.nonPourvu')}</span
              >{#if titre.pourvuAuxTours.length > 0}<span>{t('plan.listesTravail.pourvuAuxTours', { tours: titre.pourvuAuxTours, nomsTours })}</span
                >{/if}</button
            >
          </li>
        {/each}
      </ul>
      {#if titres.length === 0}
        <p>{t('plan.listesTravail.aucun')}</p>
      {/if}

      <h4 id="{uid}-pressentis">{t('plan.listesTravail.pressentis')}</h4>
      <ul data-liste-travail="pressentis" aria-labelledby="{uid}-pressentis">
        {#each pressentis as { participant, titrePressenti } (participant)}
          <li>
            <button type="button" data-participant={participant} aria-pressed={choisie(participant)} onclick={() => basculer(participant)}
              ><span class="donnee">{nomDe(participant)}</span><span>{t('plan.listesTravail.pressenti')}</span><span class="donnee"
                >{titrePressenti}</span
              ></button
            >
          </li>
        {/each}
      </ul>
      {#if pressentis.length === 0}
        <p>{t('plan.listesTravail.aucun')}</p>
      {/if}

      {#if avecRetenu}
        <h4 id="{uid}-reserves">{t('plan.listesTravail.reserves')}</h4>
        <ul data-liste-travail="reserves" aria-labelledby="{uid}-reserves">
          {#each enReserve as { participant, tours } (participant)}
            <li>
              <button
                type="button"
                data-participant={participant}
                aria-pressed={choisie(participant)}
                onclick={() => placerDepuisLaReserve(participant, tours)}
                ><span class="donnee">{nomDe(participant)}</span><span>{t('plan.listesTravail.enReserve', { tours, nomsTours })}</span></button
              >
            </li>
          {/each}
        </ul>
        {#if enReserve.length === 0}
          <p>{t('plan.listesTravail.aucun')}</p>
        {/if}
      {/if}

      {#if avisInclusions !== null}
        <h4 id="{uid}-inclusions">{t('plan.listesTravail.inclusions')}</h4>
        <ul data-liste-travail="inclusions" aria-labelledby="{uid}-inclusions">
          {#each avisInclusions as avis, rang (rang)}
            <li>
              <button
                type="button"
                data-participant={avis.source.id}
                aria-pressed={choisie(avis.source.id)}
                onclick={() => basculer(avis.source.id)}><PhraseInclusion {avis} /></button
              >
            </li>
          {/each}
        </ul>
        {#if avisInclusions.length === 0}
          <p>{t('plan.listesTravail.aucuneInclusion')}</p>
        {/if}
      {/if}

      {#if conversions.length > 0}
        <h4 id="{uid}-conversions">{t('plan.listesTravail.conversions')}</h4>
        <ul aria-labelledby="{uid}-conversions">
          {#each conversions as conversion (conversion.cle)}
            <li data-conversion={conversion.cle}>
              <p>
                <span class="donnee">{nomDe(conversion.participant)}</span><span
                  >{t('plan.listesTravail.conversion', { numero: numeroDe(conversion.table) })}</span
                >
              </p>
              <Commande
                cle="plan.listesTravail.convertir"
                nom="convertir"
                executer={() => seance.executer('convertirEnTous', { participant: conversion.participant, table: conversion.table })}
              />
              <button type="button" class="ignorer" data-commande="ignorer" onclick={() => (ignorees = [...ignorees, conversion.cle])}
                >{t('plan.listesTravail.ignorer')}</button
              >
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</section>

<style>
  /* Le panneau est une carte : fond, filet, rayon et ombre de la carte ;
     son titre au-dessus d'un filet, son contenu en retrait. */
  .carte {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-3);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-carte);
  }

  .carte > h3 {
    margin: 0;
    padding: var(--espace-3) var(--espace-4);
    border-bottom: 1px solid var(--couleur-carte-filet);
    font-size: var(--taille-titre-carte);
  }

  .corps {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    padding: var(--espace-3) var(--espace-4);
  }

  p {
    margin: 0;
  }

  /* Un intertitre en petites capitales, d'encre secondaire. */
  h4 {
    margin: var(--espace-1) 0 0;
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li[data-conversion] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-1) var(--espace-2);
  }

  li[data-conversion] p {
    flex: 1 0 100%;
  }

  /* Un bouton de liste : la commande secondaire, au filet de la page. */
  li > button,
  .ignorer {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    cursor: pointer;
  }

  li > button:hover,
  .ignorer:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  li > button:focus-visible,
  .ignorer:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  [data-liste-travail] li > button {
    width: 100%;
    text-align: start;
  }

  /* La personne choisie se dit par aria-pressed et par sa forme : un trait
     épais et du gras, sur la teinte de l'action. */
  li > button[aria-pressed='true'] {
    border: 3px solid var(--couleur-page-texte);
    background-color: var(--couleur-action-teinte);
    font-weight: 700;
  }
</style>
