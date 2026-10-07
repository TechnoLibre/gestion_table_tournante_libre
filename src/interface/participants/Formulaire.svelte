<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

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
  // Les notes sont une zone de texte, qui garde les sauts de ligne :
  // Maj+Entrée y insère un saut de ligne, Entrée seule envoie
  // (entreeValide, grille.js).
  import { getContext, onDestroy, tick, untrack } from 'svelte';
  import { cleNormalisee } from '../../application/csv.js';
  import { creerGeste } from '../primitives/geste.js';
  import Refus from '../primitives/Refus.svelte';
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
    if (evenement.key !== 'Enter' || !entreeValide({ maj: evenement.shiftKey, multiligne: true })) return;
    evenement.preventDefault();
    formulaire.requestSubmit();
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
      <div class="champ">
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
            <Refus id={idRefusNom} refus={refusNom} lever={() => (refusNom = null)} />
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
            <div class="signal" id={idOrthographe} role="status" data-avertissement="orthographe">
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
  </div>
  <div class="issue">
    <button
      type="submit"
      data-commande="ajouter"
      aria-busy={envoiEnCours ? 'true' : undefined}
      aria-disabled={envoiEnCours ? 'true' : undefined}>{t('participants.formulaire.ajouter')}</button
    >
    {#if refusAjout !== null}
      <Refus refus={refusAjout} lever={() => (refusAjout = null)} />
    {/if}
  </div>
</form>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
  }

  h3 {
    margin: 0;
    font-size: var(--taille-texte);
  }

  .champs {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-3);
  }

  .champ {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    max-width: 18rem;
  }

  input,
  textarea {
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
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

  .signal {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
    padding: var(--espace-1) var(--espace-2);
    border-left: 3px solid var(--couleur-avis);
    font-size: var(--taille-texte);
  }

  .signal p {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .donnee {
    font-weight: bold;
  }

  .issue {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
    cursor: pointer;
  }

  button[aria-disabled='true'] {
    border-style: dashed;
    color: var(--couleur-page-texte-secondaire);
    cursor: progress;
  }
</style>
