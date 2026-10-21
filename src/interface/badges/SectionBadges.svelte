<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La section des badges (§ 2.1 étape 12, § 11.2, § 11.6, § 11.8, Q1, Q3) :
  // la planche de badges, un PDF à imprimer et à couper. Produire n'est pas
  // modifier (§ 8.4, § 11.6) : la section vit en lecture comme sur un plan
  // bloqué, et la séance n'écrit que le PDF et, pour le papier,
  // reglages_locaux.json — ni l'état ni le journal.
  //
  // Le modèle de badge est un réglage de la machine (EtatSeance.modeleBadge,
  // seance.choisirModeleBadge), Avery 5392 tant que l'opérateur n'en a pas
  // choisi. Un modèle qui impose son papier — Avery 5392, sur Lettre — ne
  // montre ni l'imposition ni le papier ; l'A6 montre les deux. Aucune
  // production ne pose la question du papier : l'A6 prend celui de la
  // machine, Lettre tant qu'elle n'en a pas (PAPIER_BADGES_DEFAUT), montré
  // comme un papier choisi, que « Changer » remplace pour la machine.
  //
  // Les réglages d'une demande : la source — le retenu s'il existe, sinon la
  // proposition demandée au plan depuis les propositions, choisie quand les
  // deux sont offertes (sourcesOffertes) —, l'imposition, feuille par
  // feuille par défaut, et l'ordre, alphabétique par défaut. Aucun n'est un
  // réglage local : ils valent pour la section ouverte.
  //
  // « Préparer » demande l'annonce à la séance (preparerPlanche) et la
  // montre, phrase par phrase (phrasesAnnonce), avec son refus et le remède
  // de celui-ci. L'annonce montrée est celle des réglages, du modèle, du
  // papier et de la charge courants : qu'un d'eux change, elle se retire, et
  // la suivante se prépare. « Produire » prépare d'abord : une dérive, et
  // tout refus du placement ou de la mise en page, se nomme avant toute
  // production (§ 11.8), et « Produire » reste désactivé, expliqué, tant que
  // l'annonce montrée le porte. Un papier choisi par « Changer »
  // (Papier.svelte) prépare de nouveau l'annonce montrée.
  //
  // La planche produite nomme son chemin — à côté des fichiers d'événement
  // —, ou, sous web, où elle se télécharge, son nom ; pour Avery 5392, ceux
  // de la feuille de contrôle à part suivent. « Ouvrir le dossier »
  // se tient parmi les commandes en tout temps, avant comme après une
  // production, quand la plateforme a un explorateur : il montre par la
  // façade le dossier de travail, où la planche se dépose, et jamais le
  // chemin choisi par « Enregistrer sous… ». Une écriture refusée se dit
  // PLANCHE_NON_ECRITE, remède « Enregistrer sous… » (enregistrerPlancheSous),
  // dont le chemin choisi remplace celui de la planche.
  //
  // La réédition (Reedition.svelte) passe par la même production, sa
  // sélection dans la demande.
  //
  // Préparer, produire et « Enregistrer sous… » passent par l'indicateur
  // d'activité (activite.js) : l'annonce et la planche se calculent sur le
  // fil du rendu.
  //
  // Habillage : les réglages, le papier, les commandes, l'annonce et la
  // planche produite vivent dans la carte de la planche ; « Produire la
  // planche » en est l'action principale. L'annonce se pose sur le fond
  // sourd de la carte, la planche produite sur le fond de l'information. La
  // réédition est une carte à elle.
  import { getContext } from 'svelte';
  import { PAPIER_BADGES_DEFAUT } from '../../geometrie/papiers.js';
  import { suivre } from '../activite.js';
  import Carte from '../primitives/Carte.svelte';
  import Commande from '../primitives/Commande.svelte';
  import Refus from '../primitives/Refus.svelte';
  import Papier from '../sorties/Papier.svelte';
  import Reedition from './Reedition.svelte';
  import {
    IMPOSITIONS_OFFERTES,
    MODELES_OFFERTS,
    ORDRES_OFFERTS,
    annonceDeLaMachine,
    cleImposition,
    cleModele,
    cleOrdre,
    cleSource,
    libelleSource,
    memesReglages,
    modeleImposeSonPapier,
    phrasesAnnonce,
    produireBloque,
    sourceChoisie,
    sourcesOffertes,
  } from './modele.js';

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const facade = getContext('facade');
  const uid = $props.id();

  const charge = $derived($seance.charge);
  const modeleBadge = $derived($seance.modeleBadge);
  const cartes = $derived(modeleImposeSonPapier(modeleBadge));
  const offertes = $derived(charge === null ? [] : sourcesOffertes(charge, $ui.proposition));

  // La clé de la source que l'opérateur a choisie, null avant tout choix.
  let cleChoisie = $state(null);
  let imposition = $state(IMPOSITIONS_OFFERTES[0]);
  let ordre = $state(ORDRES_OFFERTS[0]);
  const source = $derived(sourceChoisie(offertes, cleChoisie));

  // La demande des réglages courants, avec la sélection d'une réédition,
  // null pour toute la soirée.
  const demandeDe = (selection) => ({ source: source.source, proposition: source.proposition, imposition, ordre, selection });

  // La dernière annonce préparée : {annonce, demande, charge}, la charge lue
  // au départ de la préparation. Montrée tant que réglages, modèle, papier
  // et charge sont ceux qu'elle a lus. Gardée telle quelle, sans mandataire
  // réactif : la charge se compare par identité à celle de la séance.
  let preparee = $state.raw(null);
  const montree = $derived(
    preparee !== null &&
      preparee.charge === charge &&
      annonceDeLaMachine(preparee.annonce, $seance) &&
      memesReglages(preparee.demande, demandeDe(null))
      ? preparee
      : null,
  );
  const phrases = $derived(montree === null ? [] : phrasesAnnonce(montree.annonce, montree.demande));
  const bloque = $derived(montree !== null && produireBloque(montree.annonce));

  // La planche produite : {chemin, nom, controle}, chemin null sous web ;
  // controle, la feuille de contrôle à part, {chemin, nom}, ou null.
  let produite = $state(null);
  // La demande de la dernière production, que « Enregistrer sous… » reprend.
  let derniere = null;
  // Le refus de l'annonce préparée de nouveau après le choix du papier, que
  // nulle commande ne porte.
  let refusRepris = $state(null);

  async function preparer(selection) {
    const demande = demandeDe(selection);
    const lue = seance.etat().charge;
    const annonce = await suivre(() => seance.preparerPlanche(demande));
    preparee = { annonce, demande, charge: lue };
    return { annonce, demande };
  }

  async function produire(selection) {
    // Une nouvelle production efface la planche montrée : un refus ne se
    // pose jamais à côté du chemin d'une production précédente.
    refusRepris = null;
    produite = null;
    const { annonce, demande } = await preparer(selection);
    if (produireBloque(annonce)) return;
    derniere = demande;
    produite = await suivre(() => seance.produirePlanche(demande));
  }

  // Le papier choisi par la question de la section : l'annonce montrée se
  // prépare de nouveau. Un refus de cette préparation se pose sous les
  // commandes.
  async function papierChoisi() {
    try {
      if (preparee !== null) await preparer(preparee.demande.selection);
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refusRepris = { code: erreur.code, details: erreur.details ?? {} };
    }
  }

  // Le remède que la section exécute : l'enregistrement ailleurs de la
  // dernière planche demandée. Le chemin choisi remplace celui de la
  // planche ; null quand l'opérateur annule.
  const gestes = {
    enregistrerSous: async () => {
      const chemin = await suivre(() => seance.enregistrerPlancheSous(derniere));
      if (chemin !== null) produite = { chemin, nom: null, controle: null };
      return chemin;
    },
  };

  const explorateur = facade.explorateur();

  // Le modèle choisi s'écrit sur la machine ; l'état de la séance le porte
  // aussitôt, et l'avertissement d'une écriture refusée, que la séance rend,
  // ne bloque pas le choix.
  const choisirModele = (modele) => seance.choisirModeleBadge(modele);
</script>

<section data-section="badges">
  <h2>{t('coquille.section.badges')}</h2>
  <p>{t('badges.introduction')}</p>

  {#if charge !== null}
    <Carte titre={t('badges.planche.titre')} niveau={3}>
      <div class="planche">
        <div class="reglages">
          <label class="reglage">
            <span>{t('badges.modele.titre')}</span>
            <select data-champ="modeleBadge" value={modeleBadge} onchange={(evenement) => choisirModele(evenement.currentTarget.value)}>
              {#each MODELES_OFFERTS as valeur (valeur)}
                <option value={valeur}>{t(cleModele(valeur))}</option>
              {/each}
            </select>
          </label>
          {#if offertes.length > 1}
            <label class="reglage">
              <span>{t('badges.source.titre')}</span>
              <select data-champ="source" value={cleSource(source)} onchange={(evenement) => (cleChoisie = evenement.currentTarget.value)}>
                {#each offertes as offerte (cleSource(offerte))}
                  <option value={cleSource(offerte)}>{t(libelleSource(offerte).cle, libelleSource(offerte).details)}</option>
                {/each}
              </select>
            </label>
          {/if}
          {#if !cartes}
            <label class="reglage">
              <span>{t('badges.imposition.titre')}</span>
              <select data-champ="imposition" value={imposition} onchange={(evenement) => (imposition = evenement.currentTarget.value)}>
                {#each IMPOSITIONS_OFFERTES as valeur (valeur)}
                  <option value={valeur}>{t(cleImposition(valeur))}</option>
                {/each}
              </select>
            </label>
          {/if}
          <label class="reglage">
            <span>{t('badges.ordre.titre')}</span>
            <select data-champ="ordre" value={ordre} onchange={(evenement) => (ordre = evenement.currentTarget.value)}>
              {#each ORDRES_OFFERTS as valeur (valeur)}
                <option value={valeur}>{t(cleOrdre(valeur))}</option>
              {/each}
            </select>
          </label>
        </div>

        {#if !cartes}
          <Papier defaut={PAPIER_BADGES_DEFAUT} onChoisi={papierChoisi} />
        {/if}

        <div class="commandes">
          <Commande cle="badges.commande.preparer" nom="preparerPlanche" executer={() => preparer(null)} {gestes} />
          {#if bloque}
            <button type="button" data-commande="produirePlanche" aria-disabled="true" aria-describedby={`${uid}-bloque`}
              >{t('badges.commande.produire')}</button
            >
          {:else}
            <Commande cle="badges.commande.produire" nom="produirePlanche" variante="principale" executer={() => produire(null)} {gestes} />
          {/if}
          {#if explorateur.disponible}
            <Commande cle="badges.commande.ouvrirDossier" nom="ouvrirDossier" executer={() => facade.ouvrirExplorateur()} />
          {/if}
        </div>
        {#if bloque}
          <p class="explication" id={`${uid}-bloque`}>{t('badges.produire.bloque')}</p>
        {/if}
        {#if refusRepris !== null}
          <Refus refus={refusRepris} lever={() => (refusRepris = null)} {gestes} />
        {/if}

        {#if montree !== null}
          <div class="annonce" data-annonce-planche role="group" aria-labelledby={`${uid}-annonce`}>
            <h3 id={`${uid}-annonce`}>{t('badges.annonce.titre')}</h3>
            <ul>
              {#each phrases as phrase, rang (rang)}
                <li>{t(phrase.cle, phrase.details)}</li>
              {/each}
            </ul>
            {#if montree.annonce.refus !== null}
              <Refus refus={montree.annonce.refus} {gestes} />
            {/if}
          </div>
        {/if}

        {#if produite !== null}
          <div class="produite">
            {#if produite.chemin !== null}
              <p>
                <span>{t('badges.produite.chemin')}</span>
                <span class="chemin" data-chemin-planche>{produite.chemin}</span>
              </p>
              {#if produite.controle !== null}
                <p>
                  <span>{t('badges.produite.controle')}</span>
                  <span class="chemin" data-chemin-controle>{produite.controle.chemin}</span>
                </p>
              {/if}
            {:else}
              <p data-chemin-planche>{t('badges.produite.telechargee', { nom: produite.nom })}</p>
              {#if produite.controle !== null}
                <p data-chemin-controle>{t('badges.produite.controleTelechargee', { nom: produite.controle.nom })}</p>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
    </Carte>

    <Reedition {charge} executer={produire} {gestes} />
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: var(--taille-titre);
  }

  h3 {
    margin: 0;
    font-size: var(--taille-texte);
  }

  p {
    margin: 0;
  }

  .planche {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
  }

  /* Les réglages : chaque libellé, en petites capitales d'encre secondaire,
     au-dessus de son sélecteur. */
  .reglages {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--espace-3) var(--espace-5);
  }

  .reglage {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
  }

  .reglage > span {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  .commandes {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-3);
    padding-top: var(--espace-3);
    border-top: 1px solid var(--couleur-ligne-filet);
  }

  select {
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
  }

  /* « Produire » désactivé tant qu'un refus tient : à la hauteur de l'action
     principale, son filet tireté et son texte secondaire le distinguent, et
     son explication suit la rangée des commandes, sans séparer deux
     commandes. */
  button {
    min-height: var(--hauteur-cible);
    padding: 0 var(--espace-4);
    border: 1px dashed var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte-secondaire);
    font: inherit;
    font-size: var(--taille-texte);
    font-weight: bold;
    cursor: not-allowed;
  }

  select:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .explication {
    color: var(--couleur-page-texte-secondaire);
  }

  .annonce {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    padding: var(--espace-3) var(--espace-4);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond-sourd);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    margin: 0;
    padding-left: var(--espace-4);
  }

  .produite {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2);
    padding: var(--espace-3) var(--espace-4);
    border: 1px solid var(--couleur-information-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-information-fond);
  }

  /* Un chemin long se coupe où il faut, plutôt que de déborder. */
  .chemin {
    font-weight: bold;
    overflow-wrap: anywhere;
  }
</style>
