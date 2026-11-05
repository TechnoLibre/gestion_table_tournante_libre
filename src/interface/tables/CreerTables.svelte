<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script module>
  // Les demandes d'ouverture du formulaire venues d'ailleurs que la
  // section — le remède « Créer les tables… » de l'avis PLACES_MANQUANTES
  // (Avertissements.svelte) —, par séance : chaque séance a au plus un
  // formulaire monté, celui de sa section des tables, qui s'inscrit à son
  // montage et se retire à son démontage. Une demande qu'aucun formulaire
  // n'écoute attend le prochain montage pour cette séance, que l'ouverture
  // de la section des tables suit aussitôt. Les clés sont les séances
  // elles-mêmes : une séance oubliée emporte sa demande.
  const ecouteurs = new WeakMap();
  const enAttente = new WeakSet();

  /**
   * Ouvre le formulaire de la section des tables de la séance : tout de
   * suite quand elle est montée, à son montage sinon.
   *
   * @param {Object} seance
   */
  export function demanderCreationTables(seance) {
    const ouvrir = ecouteurs.get(seance);
    if (ouvrir === undefined) enAttente.add(seance);
    else ouvrir();
  }

  // Inscrit l'ouverture du formulaire monté de la séance, et l'appelle pour
  // une demande en attente ; rend le retrait de l'inscription.
  function ecouter(seance, ouvrir) {
    ecouteurs.set(seance, ouvrir);
    if (enAttente.delete(seance)) ouvrir();
    return () => {
      if (ecouteurs.get(seance) === ouvrir) ecouteurs.delete(seance);
    };
  }
</script>

<script>
  // Créer les tables qui manquent (§ 6.1) : tant que les places manquent —
  // le manque de l'avis PLACES_MANQUANTES, lu par bilanTablesManquantes —,
  // la commande « Créer les tables… » ; elle déplie en place un petit
  // formulaire : le nombre de places par table, pré-rempli du défaut de
  // l'événement et borné comme une table (PLACES_TABLE), puis l'aperçu
  // chiffré de ce que la création fera, puis « Créer » et « Annuler ». Une
  // taille validée ne s'applique pas : elle change l'aperçu, et une taille
  // que la commande refuserait reçoit son refus sur le champ (refusDeCommande),
  // l'aperçu gardant la taille précédente. « Créer » exécute creerTable
  // {forme: 'ronde', combler}, une seule entrée ; le formulaire se replie,
  // et l'annonce des tables créées reçoit le focus tant que la révision qui
  // les a créées est la courante : hors de tout champ, Ctrl+Z y défait le
  // geste. « Annuler » replie le formulaire et rend le focus à la commande.
  // Le formulaire se replie aussi quand plus aucune place ne manque.
  //
  // Le formulaire s'ouvre aussi par demanderCreationTables, ci-dessus : son
  // champ reçoit alors le focus, comme à l'ouverture par la commande.
  import { getContext, tick } from 'svelte';
  import { lireEntier } from '../../application/capacite.js';
  import { PLACES_TABLE, bilanTablesManquantes } from '../../application/commandes_mobilier.js';
  import { ErreurCommande } from '../../application/erreurs.js';
  import { aDesAbsences } from '../../application/places.js';
  import Champ from '../primitives/Champ.svelte';
  import Commande from '../primitives/Commande.svelte';
  import { refusDeCommande } from './modele.js';

  let { charge, revision } = $props();

  const t = getContext('t');
  const seance = getContext('seance');

  // Le formulaire déplié ; la taille validée, null pour le défaut ; les
  // tables créées par le dernier geste, {revision, premier, dernier}.
  let ouvert = $state(false);
  let taille = $state(null);
  let creees = $state.raw(null);
  let racine = $state(null);

  const sieges = $derived(taille ?? charge.evenement.siegesParDefaut);
  const bilan = $derived(bilanTablesManquantes(charge, sieges));
  const montre = $derived(ouvert && bilan.manque > 0);
  // Plus aucune place ne manque : le formulaire se replie, et un manque
  // revenu ensuite ne montre que la commande.
  $effect(() => {
    if (bilan.manque === 0) ouvert = false;
  });
  const annonce = $derived(creees !== null && creees.revision === revision ? creees : null);

  // Le champ des places reçoit le focus, le formulaire monté.
  async function ouvrir() {
    ouvert = true;
    taille = null;
    await tick();
    racine?.querySelector('input[data-champ="siegesParTable"]')?.focus();
  }

  $effect(() => ecouter(seance, ouvrir));

  // Une taille lue : celle que la commande refuserait reçoit son refus sur
  // le champ ; sinon elle devient celle de l'aperçu.
  function demander(valeur) {
    const refus = refusDeCommande(charge, 'creerTable', { forme: 'ronde', combler: valeur });
    if (refus !== null && refus.code !== 'PLACES_SUFFISANTES') throw new ErreurCommande(refus.code, refus.details);
    taille = valeur;
  }

  async function creer() {
    const avant = charge.prochainsIds.table;
    await seance.executer('creerTable', { forme: 'ronde', combler: sieges });
    const etat = seance.etat();
    const numeros = etat.charge.tables.filter(({ id }) => id >= avant).map(({ numero }) => numero);
    creees = { revision: etat.evenement.revision, premier: numeros[0], dernier: numeros.at(-1) };
    ouvert = false;
    await tick();
    racine?.querySelector('[data-enonce="tablesCreees"]')?.focus();
  }

  async function annuler() {
    ouvert = false;
    await tick();
    racine?.querySelector('[data-commande="creerTablesManquantes"]')?.focus();
  }
</script>

{#if montre || bilan.manque > 0 || annonce !== null}
  <div class="creer" bind:this={racine}>
    {#if annonce !== null && !montre}
      <p class="annonce" data-enonce="tablesCreees" role="status" tabindex="-1">
        {t('tables.manque.fait', { premier: annonce.premier, dernier: annonce.dernier })}
      </p>
    {/if}
    {#if montre}
      <div class="formulaire" data-enonce="creerTables" role="group" aria-label={t('tables.manque.titre')}>
        <Champ
          cle="siegesParTable"
          etiquette="tables.manque.places"
          valeur={sieges}
          type="number"
          min={PLACES_TABLE.min}
          max={PLACES_TABLE.max}
          pas={1}
          lire={lireEntier}
          executer={demander}
        />
        <p role="status">
          <span data-phrase
            >{t('tables.manque.apercu', {
              tables: bilan.tables,
              sieges: bilan.sieges,
              placesApres: bilan.placesApres,
              presentes: bilan.presentes,
              partielle: aDesAbsences(charge),
            })}</span
          >
        </p>
        <div class="issues">
          <Commande
            cle="tables.manque.creer"
            details={{ tables: bilan.tables }}
            nom="creerTables"
            variante="principale"
            executer={creer}
          />
          <Commande cle="tables.manque.annuler" nom="annulerCreationTables" executer={annuler} />
        </div>
      </div>
    {:else if bilan.manque > 0}
      <Commande cle="tables.manque.ouvrir" nom="creerTablesManquantes" executer={ouvrir} />
    {/if}
  </div>
{/if}

<style>
  .creer {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  .formulaire {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    max-width: 40rem;
    padding: var(--espace-3);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond-sourd);
  }

  .formulaire p,
  .annonce {
    margin: 0;
  }

  .issues {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }
</style>
