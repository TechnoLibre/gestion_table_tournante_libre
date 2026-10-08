<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le premier écran (§ 8.1, § 8.6, § 18.6) : la liste des événements du
  // dossier de travail, avec ses trois issues toujours offertes — la liste,
  // la création, les démonstrations —, l'import d'un événement, la corbeille
  // et le dossier de travail, ses avis et sa question. Il ouvre un événement
  // en lecture par la séance ; ses autres gestes passent par la façade (A3),
  // et il ne lit ni n'écrit rien lui-même.
  //
  // Les lignes viennent d'App, qui lit la liste par la façade une fois la
  // détermination du dossier de travail réglée, puis leurs résumés, qu'App
  // reçoit un événement après l'autre (resumes, par base) ; refusLecture est
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
  // ignore une seconde demande et se dit occupée.
  import { getContext, onDestroy, untrack } from 'svelte';
  import { versionVisible } from '../apropos.js';
  import Commande from '../primitives/Commande.svelte';
  import Refus from '../primitives/Refus.svelte';
  import Corbeille from './Corbeille.svelte';
  import Demonstrations from './Demonstrations.svelte';
  import DossierTravail from './DossierTravail.svelte';
  import ListeEvenements from './ListeEvenements.svelte';
  import Recuperation from './Recuperation.svelte';
  import { champDuRefus, premiereAnnonce, refusDeLaListe, surLaListe } from './modele.js';

  const t = getContext('t');
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
  // La récupération d'un état illisible : { base, chemin, refus }.
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

  // Ouvre une ligne en lecture ; un état illisible mène à la récupération.
  async function ouvrir(ligne) {
    refusOuverture = null;
    try {
      await seance.ouvrir(ligne.base);
    } catch (erreur) {
      const refus = refusDeLaListe(erreur);
      if (refus === null) throw erreur;
      if (refus.code === 'ETAT_ILLISIBLE') recuperation = { base: ligne.base, chemin: ligne.chemin, refus };
      else refusOuverture = { base: ligne.base, refus };
    }
  }

  async function charger(cle) {
    refusDemonstration = null;
    try {
      await surLaListe(() => facade.chargerDemonstration(cle));
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
    <h1>{t('coquille.liste')}</h1>
    <p class="version" data-version>
      <span>{t('coquille.version.libelle')}</span>
      <span>{versionVisible(provenance, version, t)}</span>
    </p>
    {#if refusLecture !== null}
      <p class="refus" data-refus="accueil">{t(refusLecture.code, refusLecture.details)}</p>
    {/if}

    {#if issue !== null}
      <DossierTravail
        {issue}
        {racine}
        {avis}
        explorateur={facade.explorateur()}
        {repondre}
        {reponseEnCours}
        {importerDepuisAutre}
        {importAutre}
        lignesPresentes={lignes.length > 0}
      />
    {/if}

    <ListeEvenements {lignes} {resumes} {ouvrir} {refusOuverture} {apresOperation} />

    <section class="creation" aria-labelledby={`${uid}-creation`}>
      <h2 id={`${uid}-creation`}>{t('accueil.creation.titre')}</h2>
      <form novalidate onsubmit={creer}>
        <div class="champ">
          <label for={`${uid}-nom`}>{t('accueil.creation.nom')}</label>
          <input
            id={`${uid}-nom`}
            type="text"
            data-champ="nom"
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
      <Commande cle="accueil.operation.importer" executer={importerFichier} />
    </section>

    <Demonstrations {demonstrations} {charger} refus={refusDemonstration} />

    <Corbeille contenu={corbeille} />
  </section>
{/if}

<style>
  .accueil {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h2 {
    font-size: var(--taille-titre);
  }

  .version {
    display: flex;
    gap: var(--espace-1);
  }

  .refus {
    color: var(--couleur-refus);
  }

  .creation,
  form {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  .champ {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
  }

  .commandes {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
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
    outline-offset: 2px;
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
