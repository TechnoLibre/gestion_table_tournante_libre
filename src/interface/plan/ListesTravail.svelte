<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

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
  import { conversionsPossibles, pressentisNonReserves, titresNonPourvus } from '../../application/listes_travail.js';
  import Commande from '../primitives/Commande.svelte';
  import { effetDe } from '../raccourcis.js';
  import { nomDeCharge } from './vue_plan.js';

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const uid = $props.id();

  const charge = $derived($seance.charge);
  const nomDe = $derived(charge === null ? null : nomDeCharge(charge));
  const titres = $derived(charge === null ? [] : titresNonPourvus(charge));
  const pressentis = $derived(charge === null ? [] : pressentisNonReserves(charge));
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

  function surTouche(evenement) {
    if (effetDe('plan', evenement.key) !== 'remonter' || choix === null) return;
    evenement.preventDefault();
    ui.choisir(null);
  }
</script>

<!-- Échap remonte des contrôles des listes jusqu'à elles, qui oublient le choix. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section aria-labelledby="{uid}-titre" onkeydown={surTouche}>
  <h3 id="{uid}-titre">{t('plan.listesTravail.titre')}</h3>
  {#if charge !== null}
    <h4 id="{uid}-titres">{t('plan.listesTravail.titres')}</h4>
    <ul data-liste-travail="titres" aria-labelledby="{uid}-titres">
      {#each titres as titre, rang (rang)}
        <li>
          <button type="button" data-titre="{titre.table}:{titre.siege}" onclick={(evenement) => allerAuTitre(evenement, titre)}
            ><span>{t('plan.listesTravail.titreNonPourvu', { numero: titre.numero })}</span><span class="donnee"
              >{titre.libelle}</span
            ><span>{t('plan.listesTravail.nonPourvu')}</span
            >{#if titre.pourvuAuxTours.length > 0}<span>{t('plan.listesTravail.pourvuAuxTours', { tours: titre.pourvuAuxTours })}</span
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
            <button type="button" data-commande="ignorer" onclick={() => (ignorees = [...ignorees, conversion.cle])}
              >{t('plan.listesTravail.ignorer')}</button
            >
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  h3,
  h4,
  p {
    margin: 0;
  }

  h3,
  h4 {
    font-size: var(--taille-texte);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li > button {
    width: 100%;
    text-align: start;
  }

  /* La personne choisie se dit par aria-pressed et par sa forme. */
  button[aria-pressed='true'] {
    border-width: 3px;
    font-weight: 700;
  }
</style>
