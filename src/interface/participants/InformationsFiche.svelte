<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Le bloc des informations de la fiche d'une personne (§ 4, § 10.2,
  // data-informations-fiche) : en lecture, les six valeurs de texte — nom,
  // prénom, organisation, courriel, titre pressenti, notes —, chacune sous
  // l'intitulé de sa colonne, « — » quand elle manque, puis l'animation
  // réservée, « oui » ou « non », puis le statut que la fiche lui passe ;
  // puis « Modifier », nommée par la personne.
  // Fiche.svelte le recrée pour chaque personne ({#key}) : un formulaire,
  // un refus ou un signal ne survivent pas au passage à une autre, et rien
  // ne s'écrit.
  //
  // « Modifier » refuse d'abord, à côté du bouton, ce que la séance
  // refuserait — lecture, plan bloqué —, avec son remède (Commande), comme
  // « Logo ». Sinon le formulaire prend la place du bloc : un champ par
  // valeur, prérempli (saisieDesInformations, informations.js), les notes en
  // zone de texte, l'organisation proposant celles de l'événement (datalist,
  // suggestionsOrganisation), puis la case « Animation réservée », cochée
  // sous la marque ; le focus va au nom. « Enregistrer », ou
  // Entrée, pose une seule commande, modifierParticipant des seuls champs que
  // la saisie change depuis l'ouverture et qui diffèrent de la personne
  // courante (commandeDesInformations) : une écriture venue d'ailleurs
  // pendant la saisie — une autre fenêtre, Défaire — garde les champs que la
  // saisie ne touche pas. Sans champ changé, le formulaire se referme sans
  // rien écrire. « Annuler », ou Échap dans le formulaire, le referment sans
  // rien écrire. Fermé, il rend le focus à « Modifier ». Dans les notes,
  // Entrée envoie et Maj+Entrée garde le saut de ligne (entreeValide), comme
  // au formulaire d'ajout.
  //
  // Un refus garde le formulaire ouvert et la saisie : NOM_REQUIS se pose
  // sous le nom, que le champ désigne par aria-describedby, tout autre —
  // séance en lecture, plan bloqué — sous « Enregistrer », avec son remède ;
  // une frappe dans le nom retire le refus du nom. Une saisie qui diffère de
  // celle de l'ouverture est un geste ouvert (geste.js), qui suspend le
  // compte d'inactivité ; l'envoi n'est pas ré-entrant.
  //
  // Une écriture aboutie laisse sous le bloc, tant que sa révision est la
  // courante, le signal de l'orthographe d'organisation retenue
  // (ORTHOGRAPHE_RETENUE) et l'avis de ce que les listes de conflits ont
  // suivi (suiviDesConflits) : Défaire, ou toute autre écriture, les
  // retire.
  //
  // Les conflits d'organisation de la personne restent dans leur rubrique,
  // hors du formulaire, actifs pendant la saisie : leur commande écrit sa
  // propre entrée, et le formulaire garde la sienne.
  import { getContext, onDestroy, tick, untrack } from 'svelte';
  import { cleNormalisee } from '../../application/csv.js';
  import { organisationsDe } from '../../application/conflits_organisation.js';
  import { ErreurCommande } from '../../application/erreurs.js';
  import { nomAffiche } from '../../application/personnes.js';
  import Commande from '../primitives/Commande.svelte';
  import Icone from '../primitives/Icone.svelte';
  import Refus from '../primitives/Refus.svelte';
  import { creerGeste } from '../primitives/geste.js';
  import { effetDe } from '../raccourcis.js';
  import { cleDeColonne, entreeValide } from './grille.js';
  import {
    CASE_ANIMATION,
    CHAMPS_INFORMATIONS,
    champDuRefus,
    commandeDesInformations,
    informationsModifiees,
    saisieDesInformations,
    suggestionsOrganisation,
    suiviDesConflits,
  } from './informations.js';

  let { participant, charge, statut } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const uid = $props.id();
  const geste = creerGeste(seance);

  const nom = $derived(nomAffiche(participant));
  const suggestions = $derived(suggestionsOrganisation(organisationsDe(charge), cleNormalisee));
  const idListe = `${uid}-organisations`;
  const idRefusNom = `${uid}-refus-nom`;

  // Le formulaire ouvert, la saisie de son ouverture et la courante, ses
  // refus — celui du nom, celui d'« Enregistrer » —, l'envoi en cours, et
  // le rendu de la dernière écriture aboutie : sa révision, l'orthographe
  // retenue et le suivi des conflits.
  let ouvert = $state(false);
  let initiale = $state.raw(untrack(() => saisieDesInformations(participant)));
  let saisie = $state(untrack(() => saisieDesInformations(participant)));
  let refusNom = $state.raw(null);
  let refusEnvoi = $state.raw(null);
  let envoi = $state(false);
  let dernier = $state.raw(null);
  let bloc;
  let formulaire = $state(null);
  let champNom = $state(null);

  const revision = $derived($seance.evenement?.revision ?? null);
  const signaux = $derived(dernier !== null && dernier.revision === revision ? dernier : null);

  $effect(() => {
    geste.tenir(ouvert && informationsModifiees(initiale, saisie));
  });

  // « Modifier » : le refus courant de la séance avant le formulaire, puis
  // le formulaire prérempli, le focus au nom.
  async function ouvrir() {
    const { refus } = seance.etat();
    if (refus !== null) throw new ErreurCommande(refus.code, refus.details);
    initiale = saisieDesInformations(participant);
    saisie = { ...initiale };
    refusNom = null;
    refusEnvoi = null;
    ouvert = true;
    await tick();
    champNom?.focus();
  }

  // Referme le formulaire sans rien écrire, et rend le focus à « Modifier ».
  async function fermer() {
    ouvert = false;
    refusNom = null;
    refusEnvoi = null;
    await tick();
    bloc?.querySelector('[data-commande="modifierInformations"]')?.focus();
  }

  // Exécute les seuls champs changés ; aboutie, garde son rendu et referme.
  // Un refus se pose contre son champ, le formulaire ouvert.
  async function enregistrer(evenement) {
    evenement.preventDefault();
    if (envoi) return;
    refusNom = null;
    refusEnvoi = null;
    const avant = seance.etat().charge;
    const rendu = commandeDesInformations(participant, saisie, avant.participants, cleNormalisee, initiale);
    if (rendu.action === 'aucune') {
      await fermer();
      return;
    }
    envoi = true;
    try {
      await seance.executer(rendu.nom, rendu.args);
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      const refus = { code: erreur.code, details: erreur.details ?? {} };
      if (champDuRefus(refus.code) === 'nom') refusNom = refus;
      else refusEnvoi = refus;
      return;
    } finally {
      envoi = false;
    }
    const apres = seance.etat();
    dernier = {
      revision: apres.evenement.revision,
      orthographe: rendu.orthographe,
      conflits: suiviDesConflits(avant, apres.charge, rendu.args.id),
    };
    await fermer();
  }

  // Échap dans le formulaire le referme sans rien écrire.
  function surTouche(evenement) {
    if (effetDe('champ', evenement.key) !== 'rendre') return;
    evenement.preventDefault();
    fermer();
  }

  // Entrée dans les notes envoie le formulaire ; Maj+Entrée y garde le saut
  // de ligne de la zone de texte.
  function surToucheNotes(evenement) {
    if (effetDe('champ', evenement.key) !== 'valider' || !entreeValide({ maj: evenement.shiftKey, multiligne: true })) return;
    evenement.preventDefault();
    formulaire?.requestSubmit();
  }

  // Fait défiler l'élément monté jusque dans la fenêtre, au plus court.
  function montrer(element) {
    element.scrollIntoView({ block: 'nearest' });
  }

  onDestroy(() => geste.liberer());
</script>

<div class="informations" data-informations-fiche bind:this={bloc}>
  {#if ouvert}
    <!-- Échap remonte de chaque champ et de chaque bouton jusqu'au
         formulaire, qui se referme. -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      novalidate
      aria-label={t('participants.informations.formulaire', { nom })}
      onsubmit={enregistrer}
      onkeydown={surTouche}
      bind:this={formulaire}
    >
      {#each CHAMPS_INFORMATIONS as cle (cle)}
        <div class="champ">
          <label for={`${uid}-${cle}`}>{t(cleDeColonne(cle))}</label>
          {#if cle === 'nom'}
            <input
              id={`${uid}-${cle}`}
              type="text"
              data-champ={cle}
              bind:value={saisie.nom}
              bind:this={champNom}
              aria-invalid={refusNom === null ? undefined : 'true'}
              aria-describedby={refusNom === null ? undefined : idRefusNom}
              oninput={() => (refusNom = null)}
            />
            {#if refusNom !== null}
              <div class="refus" {@attach montrer}>
                <Refus id={idRefusNom} refus={refusNom} lever={() => (refusNom = null)} />
              </div>
            {/if}
          {:else if cle === 'organisation'}
            <input id={`${uid}-${cle}`} type="text" data-champ={cle} list={idListe} bind:value={saisie.organisation} />
            <datalist id={idListe}>
              {#each suggestions as organisation (organisation)}
                <option value={organisation}></option>
              {/each}
            </datalist>
          {:else if cle === 'notes'}
            <textarea id={`${uid}-${cle}`} rows="3" data-champ={cle} bind:value={saisie.notes} onkeydown={surToucheNotes}></textarea>
          {:else}
            <input id={`${uid}-${cle}`} type="text" data-champ={cle} bind:value={saisie[cle]} />
          {/if}
        </div>
      {/each}
      <div class="case">
        <input id={`${uid}-${CASE_ANIMATION}`} type="checkbox" data-champ={CASE_ANIMATION} bind:checked={saisie[CASE_ANIMATION]} />
        <label for={`${uid}-${CASE_ANIMATION}`}>{t('participants.informations.animationReservee')}</label>
      </div>
      <div class="boutons">
        <button
          type="submit"
          class="principal"
          data-commande="enregistrerInformations"
          aria-busy={envoi ? 'true' : undefined}
          aria-disabled={envoi ? 'true' : undefined}>{t('participants.informations.enregistrer')}</button
        >
        <button type="button" data-commande="annulerInformations" onclick={fermer}>{t('participants.informations.annuler')}</button>
      </div>
      {#if refusEnvoi !== null}
        <div class="refus" {@attach montrer}>
          <Refus refus={refusEnvoi} lever={() => (refusEnvoi = null)} />
        </div>
      {/if}
    </form>
  {:else}
    <dl>
      {#each CHAMPS_INFORMATIONS as cle (cle)}
        <dt>{t(cleDeColonne(cle))}</dt>
        <dd>{participant[cle] ?? t('participants.fiche.vide')}</dd>
      {/each}
      <dt>{t('participants.informations.animationReservee')}</dt>
      <dd>{t(participant[CASE_ANIMATION] === true ? 'participants.informations.animationOui' : 'participants.informations.animationNon')}</dd>
      <dt>{t('participants.fiche.statut')}</dt>
      <dd>{statut}</dd>
    </dl>
    <Commande
      cle="participants.informations.modifier"
      nom="modifierInformations"
      nomAccessible={t('participants.informations.modifierNomme', { nom })}
      executer={ouvrir}
    />
  {/if}
  {#if signaux !== null && signaux.orthographe !== null}
    <div class="signal" role="status" data-avertissement="ORTHOGRAPHE_RETENUE" {@attach montrer}>
      <span class="signe"><Icone nom="triangle" /></span>
      <p>{t('ORTHOGRAPHE_RETENUE', signaux.orthographe)}</p>
    </div>
  {/if}
  {#if signaux !== null && signaux.conflits !== null}
    <div class="signal" role="status" data-avertissement="conflitsSuivis" {@attach montrer}>
      <span class="signe"><Icone nom="triangle" /></span>
      <p>{t('participants.informations.conflitsSuivis', signaux.conflits)}</p>
    </div>
  {/if}
</div>

<style>
  /* Le bloc : les valeurs en grille de deux colonnes, l'intitulé en petites
     capitales d'encre secondaire, puis « Modifier » et les signaux. */
  .informations {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    margin: var(--espace-3) 0;
  }

  dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    align-items: baseline;
    gap: var(--espace-2) var(--espace-3);
    align-self: stretch;
    margin: 0;
  }

  dt,
  label {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  dd {
    min-width: 0;
    margin: 0;
    white-space: pre-wrap;
  }

  /* Le formulaire : un champ par ligne, l'intitulé dessus, puis ses
     boutons sur une ligne qui se replie, le refus dessous. */
  form {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    align-self: stretch;
  }

  .champ {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
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
  }

  textarea {
    resize: vertical;
  }

  /* La case de l'animation réservée : la case à la taille du texte, son
     intitulé à côté, dans l'encre et le corps du texte, la rangée haute d'une
     cible de pointage au moins, comme les cases de l'historique. */
  .case {
    display: flex;
    align-items: center;
    gap: var(--espace-1);
    min-height: var(--cible-minimale);
  }

  .case input {
    width: auto;
    min-height: 0;
    margin: 0;
  }

  .case label {
    color: var(--couleur-page-texte);
    font-size: inherit;
    font-weight: normal;
    letter-spacing: normal;
    text-transform: none;
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

  /* « Enregistrer », l'action du formulaire : pleine de la teinte de
     l'action. Occupé, il garde ses couleurs, d'un filet tireté de l'encre
     de son texte. */
  button.principal {
    border-color: var(--couleur-action-fond);
    background-color: var(--couleur-action-fond);
    color: var(--couleur-action-texte);
    font-weight: bold;
  }

  button.principal[aria-disabled='true'] {
    border-style: dashed;
    border-color: var(--couleur-action-texte);
    cursor: progress;
  }

  .refus {
    min-width: 0;
  }

  /* Un signal sous le bloc : un avis, son signe, un texte de l'encre de la
     page. */
  .signal {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    align-self: stretch;
    gap: var(--espace-2);
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
    color: var(--couleur-page-texte);
  }
</style>
