<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Le premier écran (§ 8.1, § 8.6, § 18.6) : la liste des événements du
  // dossier de travail, avec ses trois issues toujours offertes — la liste,
  // la création, les démonstrations —, l'import d'un événement, la corbeille
  // et le dossier de travail, ses avis et sa question. Il ouvre un événement
  // en lecture par la séance ; ses autres gestes passent par la façade (A3),
  // et il ne lit ni n'écrit rien lui-même.
  //
  // De haut en bas : l'en-tête — le titre, le résumé de la liste
  // (resumeDeLaListe), la version, puis « Importer… » et « Créer un
  // événement », l'action principale, qui porte le focus sur le champ du nom
  // de la carte de création — ; le refus de la lecture et les messages du
  // dossier de travail ; les tuiles des filtres par état du plan et le
  // tableau, tant que la liste a des lignes ; enfin les cartes — la création,
  // le dossier de travail, les démonstrations, la corbeille. Le filtre et le
  // groupement forment la vue de la liste, que la séance retient
  // (vueDeLaListe) et que rien n'écrit : un retour à la liste la retrouve.
  //
  // Les lignes viennent d'App, qui lit la liste par la façade une fois la
  // détermination du dossier de travail réglée, puis leurs résumés, qu'App
  // reçoit un événement après l'autre (resumes, par clé) ; refusLecture est
  // le refus qu'App a reçu en la lisant. L'accueil prend la détermination par
  // facade.demarrer — la même pour toute la séance, sans nouvelle sonde — et
  // en montre la question, puis l'autre emplacement, les avis et le dossier.
  // Les avis ne se disent qu'au premier accueil de la séance (premiereAnnonce)
  // : un retour à la liste ne les répète pas. Toute opération qui change le
  // dossier de travail demande ensuite à App de relire la liste, par
  // relireListe du contexte, et relit la corbeille.
  //
  // Un état qui ne s'ouvre pas (ETAT_ILLISIBLE) mène à la récupération, qui
  // tient lieu de liste jusqu'à son retour. Chaque refus s'affiche, traduit,
  // là où son geste a eu lieu, sans remède : sur la liste, aucun événement
  // n'est ouvert pour l'exécuter (refusDeLaListe). Un geste qui écrit ne se
  // relance pas pendant qu'il s'écrit : la création, comme chaque commande,
  // ignore une seconde demande et se dit occupée. Ouvrir un événement et
  // charger une démonstration, opérations longues, passent par l'indicateur
  // d'activité (activite.js).
  import { getContext, onDestroy, untrack } from 'svelte';
  import { suivre } from '../activite.js';
  import { versionVisible } from '../apropos.js';
  import Carte from '../primitives/Carte.svelte';
  import Commande from '../primitives/Commande.svelte';
  import Refus from '../primitives/Refus.svelte';
  import Corbeille from './Corbeille.svelte';
  import Demonstrations from './Demonstrations.svelte';
  import DossierTravail from './DossierTravail.svelte';
  import Filtres from './Filtres.svelte';
  import ListeEvenements from './ListeEvenements.svelte';
  import Message from './Message.svelte';
  import MessagesDossier from './MessagesDossier.svelte';
  import Recuperation from './Recuperation.svelte';
  import {
    champDuRefus,
    premiereAnnonce,
    refusDeLaListe,
    resumeDeLaListe,
    retenirVue,
    surLaListe,
    tuilesDeLaListe,
    vueDeLaListe,
  } from './modele.js';

  const t = getContext('t');
  const format = getContext('format');
  const facade = getContext('facade');
  const seance = getContext('seance');
  const relireListe = getContext('relireListe');

  let { provenance, version, demonstrations, lignes, resumes, refusLecture } = $props();

  // Vrai au premier accueil de la séance : ses avis s'y disent.
  const annoncer = premiereAnnonce(facade);
  const uid = $props.id();

  // La détermination du dossier de travail, { dossier, avis }, null tant
  // qu'elle n'est pas connue ; le dossier de travail de la séance.
  let issue = $state.raw(null);
  let racine = $state.raw(seance.etat().racine);
  let corbeille = $state.raw([]);
  let importAutre = $state.raw(null);
  // La récupération d'un état illisible : { evenement, chemin, refus },
  // evenement la clé de la ligne.
  let recuperation = $state.raw(null);
  let refusOuverture = $state.raw(null);
  let refusDemonstration = $state.raw(null);
  // Le formulaire de création, et son refus.
  let nom = $state('');
  let date = $state('');
  let refusCreation = $state.raw(null);
  // Vrai pendant l'écriture d'une création : une seconde soumission ne
  // crée rien, et « Créer » se dit occupé.
  let creationEnCours = $state(false);
  const champRefuse = $derived(champDuRefus(refusCreation));

  const question = $derived(issue?.dossier.question ?? null);
  const avis = $derived(annoncer ? (issue?.avis ?? []) : []);

  // La vue de la liste, { filtre, groupement }, celle que la séance retient.
  let vue = $state.raw(vueDeLaListe(facade));
  function changerVue(changement) {
    vue = { ...vue, ...changement };
    retenirVue(facade, vue);
  }
  const filtrer = (filtre) => changerVue({ filtre });
  const grouper = (groupement) => changerVue({ groupement });

  // Le champ du nom de la création, où mène « Créer un événement ».
  let champNom = $state(null);
  const allerALaCreation = () => champNom?.focus();

  let detruit = false;
  const desabonner = seance.subscribe((etat) => {
    racine = etat.racine;
  });
  onDestroy(() => {
    detruit = true;
    desabonner();
  });

  // La corbeille du dossier de travail, quand aucune question n'attend ; un
  // refus de la lire la laisse vide.
  async function lireCorbeille() {
    if (question !== null) return;
    try {
      const lue = await facade.corbeille();
      if (!detruit) corbeille = lue;
    } catch (erreur) {
      if (refusDeLaListe(erreur) === null) throw erreur;
    }
  }

  // Une détermination rendue par demarrer ou repondre devient celle de
  // l'accueil ; refusée, elle laisse le refus qu'App affiche.
  async function prendreIssue(promesse) {
    let rendue;
    try {
      rendue = await promesse;
    } catch (erreur) {
      if (refusDeLaListe(erreur) === null) throw erreur;
      return;
    }
    if (detruit) return;
    issue = rendue;
    await lireCorbeille();
  }

  // La détermination se demande au montage, et de nouveau quand le refus de
  // la lecture se lève sans qu'elle soit connue : une détermination refusée
  // puis refaite se montre alors.
  let demande = null;
  function demander() {
    if (demande !== null) return;
    demande = prendreIssue(facade.demarrer()).finally(() => {
      demande = null;
    });
  }
  $effect(() => {
    if (refusLecture === null && issue === null) untrack(demander);
  });

  // Après une opération qui change le dossier de travail.
  function apresOperation() {
    relireListe();
    lireCorbeille();
  }

  // Les comptes d'un import depuis l'autre emplacement, ou de la copie que
  // fait la réponse « Documents ».
  const comptesImport = ({ importes, refuses }) => ({ importes: importes.length, refuses: refuses.length });

  // Une réponse à la question : la détermination qu'elle rend devient celle
  // de l'accueil, et la façade d'App relit la liste quand plus rien
  // n'attend. Un refus se pose contre la réponse. Tant qu'une réponse
  // s'exécute — « Réessayer » refait la détermination —, la question ne
  // s'offre plus : la façade n'en a aucune à recevoir.
  let reponseEnCours = $state(false);
  async function repondre(choix) {
    reponseEnCours = true;
    let rendue;
    try {
      rendue = await surLaListe(() => facade.repondre(choix));
    } finally {
      reponseEnCours = false;
    }
    if (detruit) return;
    if (rendue.importe !== undefined) importAutre = comptesImport(rendue.importe);
    issue = rendue;
    await lireCorbeille();
  }

  // L'import de l'autre emplacement ; la détermination relue ne le propose
  // plus.
  async function importerDepuisAutre() {
    importAutre = comptesImport(await surLaListe(() => facade.importerDepuisAutre()));
    await prendreIssue(facade.demarrer());
  }

  async function importerFichier() {
    const importe = await surLaListe(() => facade.importerFichier());
    if (importe !== null) apresOperation();
  }

  // Ouvre une ligne en lecture, sous l'indicateur d'activité ; un état
  // illisible mène à la récupération.
  async function ouvrir(ligne) {
    refusOuverture = null;
    try {
      await suivre(() => seance.ouvrir(ligne.cle));
    } catch (erreur) {
      const refus = refusDeLaListe(erreur);
      if (refus === null) throw erreur;
      if (refus.code === 'ETAT_ILLISIBLE') recuperation = { evenement: ligne.cle, chemin: ligne.chemin, refus };
      else refusOuverture = { cle: ligne.cle, refus };
    }
  }

  // Charge une démonstration, sous l'indicateur d'activité.
  async function charger(cle) {
    refusDemonstration = null;
    try {
      await surLaListe(() => suivre(() => facade.chargerDemonstration(cle)));
    } catch (refus) {
      if (typeof refus?.code !== 'string') throw refus;
      refusDemonstration = { cle, refus };
    }
  }

  async function creer(evenement) {
    evenement.preventDefault();
    if (creationEnCours) return;
    refusCreation = null;
    creationEnCours = true;
    try {
      await surLaListe(() => facade.creer({ nom, date }));
    } catch (refus) {
      if (typeof refus?.code !== 'string') throw refus;
      refusCreation = refus;
      return;
    } finally {
      creationEnCours = false;
    }
    apresOperation();
  }
</script>

{#if recuperation !== null}
  <Recuperation {...recuperation} retour={() => (recuperation = null)} />
{:else}
  <section class="accueil" data-ecran="accueil">
    <header class="entete">
      <div class="titres">
        <h1>{t('coquille.liste')}</h1>
        {#if lignes.length > 0}
          <p class="resume">{t('accueil.entete.resume', resumeDeLaListe(lignes))}</p>
        {/if}
        <p class="version" data-version>
          <span>{t('coquille.version.libelle')}</span>
          <span>{versionVisible(provenance, version, t)}</span>
        </p>
      </div>
      <div class="commandes-entete">
        <Commande cle="accueil.operation.importer" executer={importerFichier} />
        <Commande cle="accueil.entete.creer" nom="allerCreation" variante="principale" executer={allerALaCreation} />
      </div>
    </header>

    {#if refusLecture !== null}
      <Message ton="refus">
        <p data-refus="accueil">{t(refusLecture.code, refusLecture.details)}</p>
      </Message>
    {/if}

    {#if issue !== null}
      <MessagesDossier
        {issue}
        {avis}
        {repondre}
        {reponseEnCours}
        {importerDepuisAutre}
        {importAutre}
        lignesPresentes={lignes.length > 0}
      />
    {/if}

    {#if lignes.length > 0}
      <Filtres tuiles={tuilesDeLaListe(lignes, vue.filtre, format)} {filtrer} />
    {/if}

    <ListeEvenements {lignes} {resumes} {vue} {grouper} {ouvrir} {refusOuverture} {apresOperation} />

    <div class="cartes">
      <Carte titre={t('accueil.creation.titre')} icone="ajouter">
        <form novalidate onsubmit={creer}>
          <div class="champ">
            <label for={`${uid}-nom`}>{t('accueil.creation.nom')}</label>
            <input
              id={`${uid}-nom`}
              type="text"
              data-champ="nom"
              bind:this={champNom}
              bind:value={nom}
              aria-invalid={champRefuse === 'nom' ? 'true' : undefined}
              aria-describedby={champRefuse === 'nom' ? `${uid}-refus` : undefined}
            />
            {#if champRefuse === 'nom'}
              <Refus id={`${uid}-refus`} refus={refusCreation} />
            {/if}
          </div>
          <div class="champ">
            <label for={`${uid}-date`}>{t('accueil.creation.date')}</label>
            <input
              id={`${uid}-date`}
              type="text"
              data-champ="date"
              bind:value={date}
              aria-invalid={champRefuse === 'date' ? 'true' : undefined}
              aria-describedby={champRefuse === 'date' ? `${uid}-refus` : undefined}
            />
            {#if champRefuse === 'date'}
              <Refus id={`${uid}-refus`} refus={refusCreation} />
            {/if}
          </div>
          <div class="commandes">
            <button
              type="submit"
              data-commande="creer"
              aria-busy={creationEnCours ? 'true' : undefined}
              aria-disabled={creationEnCours ? 'true' : undefined}>{t('accueil.creation.creer')}</button
            >
            {#if refusCreation !== null && champRefuse === null}
              <Refus refus={refusCreation} />
            {/if}
          </div>
        </form>
      </Carte>

      {#if issue !== null}
        <DossierTravail {question} {racine} explorateur={facade.explorateur()} />
      {/if}

      <Demonstrations {demonstrations} {charger} refus={refusDemonstration} />

      <Corbeille contenu={corbeille} />
    </div>
  </section>
{/if}

<style>
  .accueil {
    display: flex;
    flex-direction: column;
    gap: var(--espace-5);
  }

  h1,
  p {
    margin: 0;
  }

  /* L'en-tête : les titres à gauche, les deux commandes à droite ; elles
     passent dessous quand la largeur manque. */
  .entete {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--espace-3) var(--espace-5);
  }

  .titres {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    min-width: 0;
  }

  h1 {
    line-height: 1.2;
  }

  .resume {
    color: var(--couleur-page-texte-secondaire);
    font-variant-numeric: tabular-nums;
  }

  .version {
    display: flex;
    gap: var(--espace-1);
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }

  .commandes-entete {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2) var(--espace-3);
  }

  /* Les cartes qui suivent la liste : autant de colonnes que la largeur en
     admet, chacune de 19 rem au moins. */
  .cartes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
    align-items: start;
    gap: var(--espace-4);
  }

  form {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--espace-3);
  }

  .champ {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--espace-1);
  }

  label {
    font-weight: bold;
  }

  .commandes {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  input {
    min-height: 2.5rem;
    box-sizing: border-box;
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
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
    outline-offset: 2px;
  }

  /* « Créer l'événement » : l'action de la carte, pleine de la teinte de
     l'action, à hauteur de cible. */
  button {
    min-height: var(--hauteur-cible);
    padding: var(--espace-2) var(--espace-4);
    border: 1px solid var(--couleur-action-fond);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-action-fond);
    color: var(--couleur-action-texte);
    font: inherit;
    font-size: var(--taille-texte);
    font-weight: bold;
    cursor: pointer;
  }

  button[aria-disabled='true'] {
    border-style: dashed;
    border-color: var(--couleur-action-texte);
    cursor: progress;
  }
</style>
