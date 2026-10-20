<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Le formulaire d'ajout d'une personne (§ 4, § 10.2) : un champ par
  // colonne de texte, seul le nom requis. Entrée, ou « Ajouter », exécute
  // ajouterParticipant par la séance ; la commande lit chaque saisie — NFC,
  // blancs de bord retirés, vide valant null — et refuse un nom vide,
  // NOM_REQUIS, que le formulaire pose contre le champ du nom. Un autre
  // refus — le mode, l'état du plan — se pose contre « Ajouter ».
  //
  // L'appartenance est collante : après un ajout, chaque champ se vide sauf
  // elle, et l'état de navigation la garde (garderAppartenance) : le
  // formulaire remonté — retour d'une autre section, fermeture d'« À propos »
  // — repart d'elle. Une appartenance qui ne diffère d'une existante que par la casse,
  // les accents ou les blancs (orthographeExistante, grille.js) est signalée
  // contre son champ, avec l'orthographe existante à reprendre d'un clic ;
  // rien ne fusionne seul.
  //
  // Le signal et chaque refus, apparus, se font défiler jusque dans la
  // fenêtre (montrer) : sous la bande de tête d'une carte, dans une fenêtre
  // étroite, ils tomberaient sinon sous le bord, loin du champ ou de la
  // commande qu'ils commentent.
  //
  // Une saisie non envoyée — un champ rempli, l'appartenance exceptée — est
  // un geste ouvert (geste.js), qui suspend le compte d'inactivité.
  //
  // L'envoi n'est pas ré-entrant : tant que l'ajout s'écrit, une seconde
  // soumission ne fait rien, et « Ajouter » porte aria-busy et
  // aria-disabled. Le formulaire envoie une copie des champs ; l'ajout
  // abouti, il ne vide que ceux qui portent encore la valeur envoyée : ce
  // que l'opérateur tape pendant l'écriture, la personne suivante, reste.
  // Le focus revient au nom quand rien n'a été tapé entre-temps.
  //
  // Le formulaire est la bande de tête de la carte des participants : fond
  // sourd, champs en grille, « Ajouter » en action principale dans la
  // dernière case de la grille, au pied des champs ; sur une fenêtre large,
  // la bande tient en une rangée.
  //
  // Les notes sont une zone de texte, qui garde les sauts de ligne :
  // Maj+Entrée y insère un saut de ligne, Entrée seule envoie
  // (entreeValide, grille.js).
  import { getContext, onDestroy, tick, untrack } from 'svelte';
  import { cleNormalisee } from '../../application/csv.js';
  import { creerGeste } from '../primitives/geste.js';
  import Icone from '../primitives/Icone.svelte';
  import Refus from '../primitives/Refus.svelte';
  import { effetDe } from '../raccourcis.js';
  import { cleDeColonne, entreeValide, orthographeExistante } from './grille.js';

  let { participants } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const uid = $props.id();
  const geste = creerGeste(seance);

  // Les champs du formulaire, dans l'ordre des colonnes de la grille.
  const CHAMPS = ['nom', 'prenom', 'appartenance', 'courriel', 'titrePressenti', 'notes'];
  // Ceux qu'un ajout vide : tous, l'appartenance exceptée.
  const EPHEMERES = CHAMPS.filter((cle) => cle !== 'appartenance');

  let valeurs = $state({
    nom: '',
    prenom: '',
    appartenance: untrack(() => ui.etat().appartenance),
    courriel: '',
    titrePressenti: '',
    notes: '',
  });
  let refusNom = $state.raw(null);
  let refusAjout = $state.raw(null);
  let entreeNom = $state(null);
  let formulaire;
  // Vrai pendant l'écriture d'un ajout.
  let envoiEnCours = $state(false);

  const orthographe = $derived(orthographeExistante(valeurs.appartenance, participants, cleNormalisee));
  const idRefusNom = `${uid}-refus-nom`;
  const idOrthographe = `${uid}-orthographe`;

  $effect(() => {
    geste.tenir(EPHEMERES.some((cle) => valeurs[cle] !== ''));
  });

  // Une frappe dans le nom retire le refus qu'il portait.
  function surSaisieNom() {
    refusNom = null;
  }

  async function ajouter(evenement) {
    evenement.preventDefault();
    if (envoiEnCours) return;
    refusNom = null;
    refusAjout = null;
    const champs = {
      nom: valeurs.nom,
      prenom: valeurs.prenom,
      appartenance: valeurs.appartenance,
      courriel: valeurs.courriel,
      titrePressenti: valeurs.titrePressenti,
      notes: valeurs.notes,
    };
    envoiEnCours = true;
    try {
      await seance.executer('ajouterParticipant', { champs });
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      const refus = { code: erreur.code, details: erreur.details ?? {} };
      if (refus.code === 'NOM_REQUIS') refusNom = refus;
      else refusAjout = refus;
      return;
    } finally {
      envoiEnCours = false;
    }
    ui.garderAppartenance(champs.appartenance);
    const intacts = EPHEMERES.filter((cle) => valeurs[cle] === champs[cle]);
    for (const cle of intacts) valeurs[cle] = '';
    if (intacts.length < EPHEMERES.length) return;
    await tick();
    entreeNom?.focus();
  }

  // Entrée dans les notes envoie le formulaire ; Maj+Entrée y garde le
  // saut de ligne de la zone de texte.
  function surToucheNotes(evenement) {
    if (effetDe('champ', evenement.key) !== 'valider' || !entreeValide({ maj: evenement.shiftKey, multiligne: true })) return;
    evenement.preventDefault();
    formulaire.requestSubmit();
  }

  // Fait défiler l'élément monté jusque dans la fenêtre, au plus court.
  function montrer(element) {
    element.scrollIntoView({ block: 'nearest' });
  }

  function reprendre() {
    valeurs.appartenance = orthographe;
  }

  onDestroy(() => geste.liberer());
</script>

<form novalidate aria-labelledby={`${uid}-titre`} onsubmit={ajouter} bind:this={formulaire}>
  <h3 id={`${uid}-titre`}>{t('participants.formulaire.titre')}</h3>
  <div class="champs">
    {#each CHAMPS as cle (cle)}
      <div class="champ" class:large={cle === 'notes'}>
        <label for={`${uid}-${cle}`}>{t(cleDeColonne(cle))}</label>
        {#if cle === 'nom'}
          <input
            id={`${uid}-${cle}`}
            type="text"
            data-champ={cle}
            bind:value={valeurs.nom}
            bind:this={entreeNom}
            aria-invalid={refusNom === null ? undefined : 'true'}
            aria-describedby={refusNom === null ? undefined : idRefusNom}
            oninput={surSaisieNom}
          />
          {#if refusNom !== null}
            <div class="refus" {@attach montrer}>
              <Refus id={idRefusNom} refus={refusNom} lever={() => (refusNom = null)} />
            </div>
          {/if}
        {:else if cle === 'appartenance'}
          <input
            id={`${uid}-${cle}`}
            type="text"
            data-champ={cle}
            bind:value={valeurs.appartenance}
            aria-describedby={orthographe === null ? undefined : idOrthographe}
          />
          {#if orthographe !== null}
            <div class="signal" id={idOrthographe} role="status" data-avertissement="orthographe" {@attach montrer}>
              <span class="signe"><Icone nom="triangle" /></span>
              <p><span>{t('participants.formulaire.orthographe')}</span> <span class="donnee">{orthographe}</span></p>
              <button type="button" data-commande="reprendreOrthographe" onclick={reprendre}>
                {t('participants.formulaire.reprendre')}
              </button>
            </div>
          {/if}
        {:else if cle === 'notes'}
          <textarea id={`${uid}-${cle}`} rows="2" data-champ={cle} bind:value={valeurs.notes} onkeydown={surToucheNotes}></textarea>
        {:else}
          <input id={`${uid}-${cle}`} type="text" data-champ={cle} bind:value={valeurs[cle]} />
        {/if}
      </div>
    {/each}
    <div class="issue">
      <button
        type="submit"
        data-commande="ajouter"
        aria-busy={envoiEnCours ? 'true' : undefined}
        aria-disabled={envoiEnCours ? 'true' : undefined}>{t('participants.formulaire.ajouter')}</button
      >
      {#if refusAjout !== null}
        <div class="refus" {@attach montrer}>
          <Refus refus={refusAjout} lever={() => (refusAjout = null)} />
        </div>
      {/if}
    </div>
  </div>
</form>

<style>
  /* La bande est un conteneur de requête : les notes ne prennent deux
     colonnes que là où la grille en a au moins deux. */
  form {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    padding: var(--espace-4) var(--espace-5);
    border-bottom: 1px solid var(--couleur-carte-filet);
    background-color: var(--couleur-carte-fond-sourd);
  }

  /* L'intitulé de la bande, en petites capitales. */
  h3 {
    margin: 0;
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  .champs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    align-items: start;
    gap: var(--espace-3);
  }

  .champ {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    min-width: 0;
    font-size: var(--taille-texte-petit);
    font-weight: bold;
  }

  /* Les notes prennent deux colonnes quand la grille en a la place ; sur
     une colonne, un empan de deux en créerait une seconde, implicite, qui
     élargirait la grille hors de la bande. */
  @container (min-width: 22rem) {
    .champ.large {
      grid-column: span 2;
    }
  }

  .refus {
    min-width: 0;
  }

  input,
  textarea {
    box-sizing: border-box;
    width: 100%;
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

  /* La zone des notes a la hauteur d'un champ, et s'agrandit à la main. */
  textarea {
    height: 2.5rem;
    resize: vertical;
  }

  input[aria-invalid='true'] {
    border-color: var(--couleur-refus);
  }

  input:focus-visible,
  textarea:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 1px;
  }

  /* L'orthographe existante : un avis, son signe, un texte de l'encre de
     la page. */
  .signal {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: var(--espace-1) var(--espace-2);
    padding: var(--espace-2);
    border: 1px solid var(--couleur-avis-filet);
    border-left: 3px solid var(--couleur-avis-marque);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-avis-fond);
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte-petit);
    font-weight: normal;
  }

  .signal .signe {
    display: inline-flex;
    color: var(--couleur-avis-marque);
  }

  .signal p {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .signal button {
    grid-column: 2;
    justify-self: start;
  }

  .donnee {
    font-weight: bold;
  }

  .issue {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    align-self: end;
    gap: var(--espace-2);
    min-width: 0;
  }

  button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte-petit);
    cursor: pointer;
  }

  button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  /* « Ajouter », l'action principale de la carte : pleine de la teinte de
     l'action, haute d'une cible principale. */
  button[type='submit'] {
    min-height: var(--hauteur-cible);
    padding: var(--espace-1) var(--espace-4);
    border-color: var(--couleur-action-fond);
    background-color: var(--couleur-action-fond);
    color: var(--couleur-action-texte);
    font-size: var(--taille-texte);
    font-weight: bold;
  }

  /* Occupé, il garde ses couleurs, d'un filet tireté de l'encre de son
     texte. */
  button[type='submit'][aria-disabled='true'] {
    border-style: dashed;
    border-color: var(--couleur-action-texte);
    cursor: progress;
  }
</style>
