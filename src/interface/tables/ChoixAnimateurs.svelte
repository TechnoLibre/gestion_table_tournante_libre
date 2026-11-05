<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La fenêtre d'ajout des animateurs d'une table (§ 2.1 étape 6, § 6.1) :
  // un <dialog> modal, ouvert au montage, titré du numéro de la table, le
  // focus dans sa recherche. Elle porte la recherche — nom, prénom ou
  // organisation, sans égard à la casse ni aux accents —, la case « Grouper
  // par organisation », cochée au montage, le champ « Titre », prérempli du
  // titre par défaut des places, puis la liste des personnes
  // (personnesPourAnimation, groupesParOrganisation, chaque groupe nommé
  // d'après la liste entière, avant la recherche), une case à cocher
  // chacune, son statut en texte et son titre pressenti. La case de qui ne
  // se choisit pas est désactivée, cochée pour qui anime déjà la table ; le
  // statut en dit la raison. Le compte dit les personnes choisies et les
  // places libres de la table (placesLibresPourAnimer).
  //
  // Le choix tient par identifiant : une personne choisie que la recherche
  // cache reste choisie. « Ajouter », désactivé sans choix, appelle
  // executer({participants, libelle}) — les personnes choisies dans l'ordre
  // de la liste, le titre tel que saisi — et attend sa promesse : aboutie,
  // la fenêtre se ferme et appelle surFermer ; refusée — une erreur qui
  // porte un code —, elle reste ouverte et le refus, avec son remède, s'y
  // pose ; une erreur sans code ferme la fenêtre, appelle surFermer et
  // remonte. Le refus posé porte l'id ${uid}-refus, qu'« Ajouter » nomme
  // dans son aria-describedby : le remède abouti retire le refus, et Refus
  // rend le focus à « Ajouter ». Pendant l'attente, un second « Ajouter »,
  // « Annuler » et Échap ne font rien. « Annuler » et Échap ferment sans rien
  // écrire et appellent surFermer ; Échap ferme d'une seule pression, même
  // depuis la recherche remplie, que le navigateur viderait d'abord. Entrée
  // dans la recherche ou le titre ne valide rien : aucun formulaire ne
  // l'entoure. Le parent la démonte et rend le focus.
  //
  // Ouverte, la fenêtre tient un geste de la séance (geste.js), rendu à la
  // fermeture ou au démontage, comme la fenêtre à confirmer.
  import { getContext, onDestroy, onMount } from 'svelte';
  import { libelle } from '../../application/libelles.js';
  import { creerGeste } from '../primitives/geste.js';
  import { effetDe } from '../raccourcis.js';
  import Refus from '../primitives/Refus.svelte';
  import { groupesParOrganisation, personnesPourAnimation, placesLibresPourAnimer } from './modele.js';

  let { charge, table, numero, executer, surFermer } = $props();

  const t = getContext('t');
  const seance = getContext('seance') ?? null;
  const uid = $props.id();
  const geste = seance === null ? null : creerGeste(seance);

  let fenetre;
  let champRecherche;
  let recherche = $state('');
  let grouper = $state(true);
  let titre = $state(libelle('places.titreParDefaut'));
  let choisies = $state.raw(new Set());
  let refus = $state(null);
  let enAttente = $state(false);
  // Vrai dès que fermer() a fermé la fenêtre : l'événement close qui suit
  // est le sien.
  let fermee = false;

  const toutes = $derived(personnesPourAnimation(charge, table, ''));
  const personnes = $derived(personnesPourAnimation(charge, table, recherche));
  const groupes = $derived(grouper ? groupesParOrganisation(personnes, toutes) : [{ organisation: undefined, personnes }]);
  const libres = $derived(placesLibresPourAnimer(charge, table));

  onMount(() => {
    fenetre.showModal();
    champRecherche.focus();
    geste?.tenir(true);
  });

  onDestroy(() => geste?.liberer());

  function fermer() {
    fermee = true;
    if (fenetre?.open) fenetre.close();
    geste?.tenir(false);
  }

  function annuler() {
    if (enAttente) return undefined;
    fermer();
    return surFermer();
  }

  function basculer(id, coche) {
    const suivantes = new Set(choisies);
    if (coche) suivantes.add(id);
    else suivantes.delete(id);
    choisies = suivantes;
  }

  async function confirmer() {
    if (enAttente || choisies.size === 0) return;
    enAttente = true;
    refus = null;
    const participants = toutes.map(({ participant }) => participant).filter((id) => choisies.has(id));
    try {
      await executer({ participants, libelle: titre });
    } catch (erreur) {
      enAttente = false;
      if (typeof erreur?.code !== 'string') {
        fermer();
        surFermer();
        throw erreur;
      }
      refus = { code: erreur.code, details: erreur.details ?? {} };
      return;
    }
    enAttente = false;
    fermer();
    surFermer();
  }

  // Échap : l'annulation, par le même chemin qu'« Annuler ».
  function surCancel(evenement) {
    evenement.preventDefault();
    annuler();
  }

  // Échap dans la recherche : un champ de type search se vide à la première
  // pression et garde l'événement cancel ; la touche, retenue ici, annule
  // tout de suite.
  function surToucheRecherche(evenement) {
    if (effetDe('fenetre', evenement.key) !== 'fermer') return;
    evenement.preventDefault();
    annuler();
  }

  // La fenêtre fermée sans fermer() : occupée, elle se rouvre, modale ;
  // sinon, c'est une annulation.
  function surClose() {
    if (fermee) return;
    if (enAttente) {
      if (fenetre.isConnected) fenetre.showModal();
      return;
    }
    annuler();
  }
</script>

<dialog
  bind:this={fenetre}
  aria-labelledby={`${uid}-titre`}
  aria-busy={enAttente ? 'true' : undefined}
  oncancel={surCancel}
  onclose={surClose}
>
  <h2 id={`${uid}-titre`}>{t('tables.animateurs.fenetre', { numero })}</h2>
  <div class="reglages">
    <div class="champ">
      <label for={`${uid}-recherche`}>{t('tables.animateurs.recherche')}</label>
      <input
        bind:this={champRecherche}
        id={`${uid}-recherche`}
        type="search"
        data-champ="rechercheAnimateurs"
        autocomplete="off"
        bind:value={recherche}
        onkeydown={surToucheRecherche}
      />
    </div>
    <div class="champ">
      <label for={`${uid}-libelle`}>{t('tables.animateurs.libelle')}</label>
      <input id={`${uid}-libelle`} type="text" data-champ="titreAnimateurs" autocomplete="off" bind:value={titre} />
    </div>
    <label class="case">
      <input type="checkbox" data-champ="grouperAnimateurs" bind:checked={grouper} />
      <span>{t('tables.animateurs.grouper')}</span>
    </label>
  </div>

  <div class="liste">
    {#if personnes.length === 0}
      <p class="aucune">{t('tables.animateurs.aucunePersonne')}</p>
    {:else}
      {#each groupes as groupe, rang (groupe.organisation)}
        {#if groupe.organisation === undefined}
          {@render listePersonnes(groupe.personnes)}
        {:else}
          {@const idGroupe = `${uid}-groupe-${rang}`}
          <section class="groupe" aria-labelledby={idGroupe}>
            <h3 id={idGroupe}>
              {groupe.organisation === null ? t('tables.animateurs.sansOrganisation') : groupe.organisation}
            </h3>
            {@render listePersonnes(groupe.personnes)}
          </section>
        {/if}
      {/each}
    {/if}
  </div>

  <p class="compte" data-compte role="status">{t('tables.animateurs.compte', { choisies: choisies.size, libres })}</p>
  {#if refus !== null}
    <div class="refus">
      <Refus {refus} id={`${uid}-refus`} lever={() => (refus = null)} />
    </div>
  {/if}
  <div class="issues">
    <button
      type="button"
      data-commande="annulerAnimateurs"
      aria-disabled={enAttente ? 'true' : undefined}
      onclick={annuler}
    >
      {t('tables.animateurs.annuler')}
    </button>
    <button
      type="button"
      data-commande="confirmerAnimateurs"
      disabled={choisies.size === 0}
      aria-describedby={refus === null ? undefined : `${uid}-refus`}
      aria-disabled={enAttente ? 'true' : undefined}
      onclick={confirmer}
    >
      {t('tables.animateurs.confirmer')}
    </button>
  </div>
</dialog>

<!-- Les personnes d'un groupe, ou de la liste entière : une case chacune,
     nommée par la personne, décrite par son statut puis son titre pressenti,
     écrits dessous. -->
{#snippet listePersonnes(liste)}
  <ul class="personnes">
    {#each liste as personne (personne.participant)}
      {@const idCase = `${uid}-personne-${personne.participant}`}
      <li data-participant={personne.participant}>
        <input
          id={idCase}
          type="checkbox"
          checked={personne.anime || choisies.has(personne.participant)}
          disabled={!personne.choisissable}
          aria-describedby={personne.titre === null ? `${idCase}-statut` : `${idCase}-statut ${idCase}-titre`}
          onchange={(evenement) => basculer(personne.participant, evenement.currentTarget.checked)}
        />
        <div class="personne">
          <label for={idCase}>{personne.nom}</label>
          <span class="statut">
            <span id={`${idCase}-statut`}>{t(personne.statut.cle, personne.statut.details)}</span>
            {#if personne.titre !== null}
              <span id={`${idCase}-titre`}>{t(personne.titre.cle, personne.titre.details)}</span>
            {/if}
          </span>
        </div>
      </li>
    {/each}
  </ul>
{/snippet}

<style>
  dialog {
    box-sizing: border-box;
    width: min(44rem, calc(100vw - 2 * var(--espace-4)));
    max-height: calc(100vh - 2 * var(--espace-4));
    padding: var(--espace-5);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-3);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-2);
  }

  dialog[open] {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
  }

  dialog::backdrop {
    background: none;
  }

  h2 {
    margin: 0;
    font-size: var(--taille-titre);
  }

  .reglages {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--espace-2) var(--espace-4);
  }

  .champ {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  input[type='search'],
  input[type='text'] {
    min-height: var(--hauteur-cible);
    padding: 0 var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
  }

  .case {
    display: inline-flex;
    align-items: center;
    gap: var(--espace-2);
    min-height: var(--hauteur-cible);
  }

  input[type='checkbox'] {
    margin: 0;
  }

  input:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 1px;
  }

  /* La liste défile dans la fenêtre ; la recherche, le compte et les
     boutons restent visibles. */
  .liste {
    min-height: 0;
    overflow-y: auto;
    border-top: 1px solid var(--couleur-ligne-filet);
    border-bottom: 1px solid var(--couleur-ligne-filet);
  }

  .aucune {
    margin: 0;
    padding: var(--espace-3) 0;
    color: var(--couleur-page-texte-secondaire);
  }

  h3 {
    margin: var(--espace-3) 0 var(--espace-1);
    font-size: var(--taille-texte);
    font-weight: bold;
  }

  .personnes {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .personnes li {
    display: flex;
    align-items: flex-start;
    gap: var(--espace-2);
    padding: var(--espace-2) 0;
  }

  .personnes li input {
    margin-top: 0.1875rem;
  }

  .personne {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .statut {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--espace-3);
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }

  .compte {
    margin: 0;
  }

  .issues {
    display: flex;
    gap: var(--espace-3);
  }

  button {
    min-height: var(--hauteur-cible);
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    cursor: pointer;
  }

  button:disabled {
    border-style: dashed;
    color: var(--couleur-page-texte-secondaire);
    cursor: default;
  }

  button[aria-disabled='true'] {
    border-style: dashed;
    color: var(--couleur-page-texte-secondaire);
    cursor: progress;
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
