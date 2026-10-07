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
  // elle. Une appartenance qui ne diffère d'une existante que par la casse,
  // les accents ou les blancs (orthographeExistante, grille.js) est signalée
  // contre son champ, avec l'orthographe existante à reprendre d'un clic ;
  // rien ne fusionne seul.
  //
  // Une saisie non envoyée — un champ rempli, l'appartenance exceptée — est
  // un geste ouvert (geste.js), qui suspend le compte d'inactivité.
  import { getContext, onDestroy, tick } from 'svelte';
  import { cleNormalisee } from '../../application/csv.js';
  import { creerGeste } from '../primitives/geste.js';
  import Refus from '../primitives/Refus.svelte';
  import { cleDeColonne, orthographeExistante } from './grille.js';

  let { participants } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const uid = $props.id();
  const geste = creerGeste(seance);

  // Les champs du formulaire, dans l'ordre des colonnes de la grille.
  const CHAMPS = ['nom', 'prenom', 'appartenance', 'courriel', 'titrePressenti', 'notes'];
  // Ceux qu'un ajout vide : tous, l'appartenance exceptée.
  const EPHEMERES = CHAMPS.filter((cle) => cle !== 'appartenance');

  let valeurs = $state({ nom: '', prenom: '', appartenance: '', courriel: '', titrePressenti: '', notes: '' });
  let refusNom = $state.raw(null);
  let refusAjout = $state.raw(null);
  let entreeNom = $state(null);

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
    try {
      await seance.executer('ajouterParticipant', { champs });
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      const refus = { code: erreur.code, details: erreur.details ?? {} };
      if (refus.code === 'NOM_REQUIS') refusNom = refus;
      else refusAjout = refus;
      return;
    }
    valeurs = { nom: '', prenom: '', appartenance: valeurs.appartenance, courriel: '', titrePressenti: '', notes: '' };
    await tick();
    entreeNom?.focus();
  }

  function reprendre() {
    valeurs.appartenance = orthographe;
  }

  onDestroy(() => geste.liberer());
</script>

<form aria-labelledby={`${uid}-titre`} onsubmit={ajouter}>
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
        {:else}
          <input id={`${uid}-${cle}`} type="text" data-champ={cle} bind:value={valeurs[cle]} />
        {/if}
      </div>
    {/each}
  </div>
  <div class="issue">
    <button type="submit" data-commande="ajouter">{t('participants.formulaire.ajouter')}</button>
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

  input {
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
</style>
