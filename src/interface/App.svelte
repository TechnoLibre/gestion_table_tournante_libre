<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Racine de l'interface (§ 13.4). Ses propriétés sont les dépendances de
  // l'application — système de fichiers, horloge, exécuteur de génération, en
  // option l'exécuteur de la vue d'ensemble de la liste, presse-papiers,
  // identifiants, langue, provenance, démonstrations, format courant, version
  // affichée du produit, chargement de la police embarquée, imprimante de la
  // plateforme, chargement de la section de la qualité, et en option le
  // chargement du solveur du plancher exact et le thème de départ — que
  // src/main.js construit pour la machine et monterApp pour une épreuve : App
  // ne choisit aucune plateforme, et ne lit la version que dans ses
  // propriétés, la même au bandeau, au titre, à l'accueil et dans le bloc
  // « À propos ».
  //
  // La section de la qualité forme son propre morceau dans la construction :
  // src/main.js passe une fonction qui la charge par un import différé,
  // monterApp une fonction qui rend le composant importé d'emblée. App en
  // fait une demande unique (creerChargeurSection), qu'il donne à
  // l'événement : le morceau ne se charge qu'à la première ouverture de la
  // section, et une fois.
  //
  // Le solveur du plancher exact du diagnostic (§ 5.6, § 5.10) : src/main.js
  // passe chargerSolveur, qui importe en différé le travailleur du solveur et
  // rend sa fabrique et l'adresse du module WebAssembly de HiGHS. App en
  // fait le suivi (suivi_solveur.js) sur l'exécuteur (executeur_solveur.js)
  // et son horloge, le pose au contexte sous 'solveur', lui demande la
  // charge de l'état observable à chaque changement — le calcul ne part
  // qu'après un délai, et seulement quand le modèle change —, et le termine
  // au démontage. Une faute du solveur va au collecteur (reportError). Sans
  // chargerSolveur, aucun suivi : le diagnostic garde ses planchers
  // instantanés seuls.
  //
  // À son initialisation, App crée une fois chacun la séance, sans racine, le
  // contrôleur de génération et la façade, et les donne aux composants par le
  // contexte de Svelte — clés 'seance', 'facade', 'generation', 'ui', 't',
  // 'format', 'horloge', 'imprimante', 'produit' — la provenance et la version
  // que le pied d'une page imprimée reprend du bandeau — et 'relireListe', et
  // 'solveur' quand le solveur se charge —, posé de façon synchrone avant que
  // la détermination du dossier de travail, asynchrone, ne rende. La façade
  // pose la racine de la séance par changerRacine : aussitôt sans question,
  // après la réponse sinon. App lit la liste du dossier de travail par la
  // façade et la donne à l'accueil, une fois la détermination réglée — sans
  // question au démarrage, après la réponse sinon : pret se résout quand la
  // détermination est faite, la liste lue quand aucune question n'attend, et le
  // premier écran — les lignes de la liste, ou la question — rendu. Les résumés
  // des lignes n'en sont pas : ceux des aperçus se lisent ensuite, puis ceux
  // des aperçus absents ou périmés se calculent, un événement après l'autre,
  // par l'exécuteur de la vue d'ensemble — sur le fil sans lui —, et l'accueil
  // montre chacun dès qu'il arrive. App termine cet exécuteur à son démontage,
  // après avoir abandonné le flux des résumés.
  //
  // L'écran suit la séance : la liste sans événement ouvert, l'événement
  // sinon ; le panneau « À propos » ou le panneau « Paramètres » les remplace
  // tant qu'il est ouvert — App dit au bandeau lequel est ouvert : sa commande,
  // bouton bascule, se montre enfoncée et le referme. L'aperçu avant impression
  // vit dans la section de l'impression de l'événement (§ 11.7). Chaque
  // ouverture d'un événement remet l'état de navigation à son départ. Le
  // bandeau, présent sur tout écran, ne défile pas : un écran plus haut que la
  // fenêtre défile sous lui.
  //
  // La page porte le fond de la page ; l'écran — l'élément <main>, parent
  // direct de chaque [data-ecran] — se centre dans --largeur-page au-delà
  // de cette largeur et prend la fenêtre en deçà ; l'écran de l'événement
  // retire cette borne et prend la fenêtre à toute largeur
  // (Evenement.svelte). App pose les styles de
  // base d'un titre de premier niveau, des cellules d'un tableau et des
  // champs de saisie de l'écran, de spécificité nulle : le style propre d'un
  // composant l'emporte toujours, et le document imprimé (§ 11.7), sous
  // [data-impression], ne les reçoit pas.
  //
  // Le thème part de la propriété themeInitial, ou de la préférence du
  // système lue au montage, posé dans l'état de navigation ; le réglage de
  // l'opérateur, au panneau « Paramètres », le change pour la séance, en
  // mémoire. App le pose en data-theme sur <html> (§ 19.2). La taille du
  // texte de l'écran est celle de la séance (EtatSeance.tailleTexte), relue
  // dans reglages_locaux.json au lancement : App la pose en taille de police
  // de <html>, que les jetons en rem suivent, et la retire au démontage
  // (§ 8.5, § 18.6). À la sortie
  // de la page (pagehide), la séance ferme l'événement et rend son verrou,
  // sans question ; aucun beforeunload ne retient la page (§ 8.4).
  //
  // App monte la pastille de l'indicateur d'activité (Activite.svelte), et
  // pose le curseur d'attente sur toute l'application tant qu'une opération
  // longue est suivie (activite.js). Les composants, et seance(), reçoivent
  // la séance enveloppée par seanceBarree : un geste fait pendant l'attente
  // d'image d'une opération suivie atteint la séance après elle. App suit
  // lui-même la fin d'une génération — le tri et l'enregistrement des
  // propositions, après le travailleur — : le contrôleur reçoit l'exécuteur
  // de suivreFinDeGeneration, et la fin suivie se retire quand le
  // contrôleur publie la génération finie, ou au démontage.
  import './jetons.css';
  import { onDestroy, setContext, tick, untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { chargerLogo } from '../actifs/logo.js';
  import { creerFacade } from '../application/evenements.js';
  import { creerFormat } from '../application/format.js';
  import { creerControleurGeneration } from '../application/generation.js';
  import { TABLES_APPLICATION } from '../application/libelles.js';
  import { creerSeance } from '../application/seance.js';
  import { creerTraduction } from '../application/traduction.js';
  import { taillePoliceRacine } from '../geometrie/taille_texte.js';
  import APropos from './APropos.svelte';
  import Accueil from './accueil/Accueil.svelte';
  import { creerPas } from './accueil/chargement.js';
  import Bandeau from './Bandeau.svelte';
  import { creerChargeurSection } from './evenement/differe.js';
  import { creerExecuteurSolveur } from './diagnostic/executeur_solveur.js';
  import { creerSuiviSolveur } from './diagnostic/suivi_solveur.js';
  import Evenement from './evenement/Evenement.svelte';
  import Activite from './primitives/Activite.svelte';
  import { activite, seanceBarree, suivreFinDeGeneration } from './activite.js';
  import { blocAPropos, provenanceVisible, versionVisible } from './apropos.js';
  import { creerEtatUi } from './etat_ui.js';
  import { TABLES_INTERFACE } from './libelles.js';
  import Parametres from './Parametres.svelte';
  import { themeInitial as themeDuSysteme } from './theme.js';

  // Les dépendances se lisent une fois, au montage : App crée ses services
  // une seule fois, et un changement de propriété ne les recrée pas.
  const dependances = $props();
  const {
    fs,
    horloge,
    executeur,
    // { calculer(charge) → Promise<résumés>, terminer() } : l'exécuteur de
    // la vue d'ensemble de la liste (executeur_apercu.js), que la façade
    // reçoit ; null, le calcul se fait sur le fil.
    executeurApercu = null,
    pressePapiers,
    identifiant,
    langue = 'fr',
    provenance,
    demonstrations,
    formatCourant,
    produitVersion,
    // () => Promise<{regulier: Uint8Array, gras: Uint8Array}> : les octets
    // de la police que la production de la planche embarque (§ 11.1).
    polices,
    // () => Promise<Uint8Array> : les octets SVG du logo que le pied
    // TechnoLibre des badges dessine (§ 11.4) ; par défaut, le fichier de
    // src/actifs, chargé à la première planche qui le demande.
    logo = async () => (await chargerLogo()).svg,
    // { imprimer({papier, orientation}) → Promise<{issue, cause}> } : la
    // frontière « impression » de la plateforme (§ 13.4), que les
    // composants reçoivent par le contexte, sans importer src/impression.
    imprimante,
    // () => Component | PromiseLike<Component> : le composant de la section
    // de la qualité, ou la promesse de son morceau.
    sectionQualite,
    // () => Promise<{fabrique: () => Worker, urlWasm: string}> : le
    // travailleur du solveur du plancher exact et l'adresse de son module
    // WebAssembly ; null, aucun calcul exact.
    chargerSolveur = null,
    themeInitial,
  } = untrack(() => dependances);

  // Deux traductions des mêmes tables. t, celle de l'écran, pose les
  // insécables de la ponctuation haute (§ 14.6) : c'est elle que les
  // composants lisent au contexte, et la mise en forme. tBrut garde le
  // texte des tables pour ce qui quitte l'écran : le bloc copié dans le
  // presse-papiers et le titre de la fenêtre, égal à titreAvecVersion.
  const tablesDeTextes = [...TABLES_APPLICATION, ...TABLES_INTERFACE];
  const { t } = creerTraduction(tablesDeTextes, { langue, ecran: true });
  const { t: tBrut } = creerTraduction(tablesDeTextes, { langue });
  const format = creerFormat(t);
  // Le bloc « À propos » se compose au montage, avant toute séance : une
  // version que les dépendances ne portent pas lève RangeError ici, et App
  // ne se monte pas avec un bloc copiable faux (§ 18.6).
  const bloc = blocAPropos({ version: produitVersion, plateforme: fs.nature, provenance, format: formatCourant }, tBrut);
  const seanceApp = creerSeance({
    fs,
    horloge,
    identifiant,
    produitVersion,
    planifier: horloge.planifier,
    annuler: horloge.annuler,
    // La planche de badges embarque la police et le logo du pied
    // TechnoLibre, et sa feuille de contrôle lit la provenance pour la
    // version visible (§ 11.4, § 19.4).
    polices,
    logo,
    provenance,
  });
  const finDeGeneration = suivreFinDeGeneration(executeur, activite);
  const generationApp = creerControleurGeneration({
    seance: seanceApp,
    executeur: finDeGeneration.executeur,
    horloge,
    produitVersion,
  });
  const desabonnerGeneration = generationApp.subscribe(({ enCours }) => {
    if (!enCours) finDeGeneration.terminer();
  });
  onDestroy(() => {
    desabonnerGeneration();
    finDeGeneration.fermer();
  });
  const facadeApp = creerFacade({
    fs,
    horloge,
    identifiant,
    produitVersion,
    demonstrations,
    ouvert: () => seanceApp.etat().evenement?.cle ?? null,
    ouvrir: (cle, annonce) => seanceApp.ouvrir(cle, undefined, annonce),
    fermer: () => seanceApp.fermer(),
    creer: (champs) => seanceApp.creer(champs),
    racine: () => seanceApp.etat().racine,
    changerRacine: (racine) => seanceApp.changerRacine(racine),
    executeurApercu,
  });
  // La façade que reçoivent les composants, et que rend l'export facade :
  // celle de creerFacade, dont demarrer et repondre relisent la liste une
  // fois la détermination réglée sans question. La façade appelle
  // changerRacine avant de retirer sa question, si bien qu'une lecture
  // lancée de ce rappel serait refusée (QUESTION_EN_ATTENTE). Une
  // détermination refusée ne laisse rien : le demarrer suivant la refait, et
  // relit alors la liste.
  const facadeContexte = {
    ...facadeApp,
    demarrer: async () => {
      const issue = await facadeApp.demarrer();
      if (issue.dossier.question === null) await relireListe();
      return issue;
    },
    repondre: async (choix) => {
      const issue = await facadeApp.repondre(choix);
      if (issue.dossier.question === null) await relireListe();
      return issue;
    },
  };
  const uiApp = creerEtatUi();
  uiApp.choisirTheme(themeInitial ?? themeDuSysteme(window.matchMedia('(prefers-color-scheme: dark)').matches));
  // Les sections chargées à part, chacune par sa demande unique.
  const chargeurs = { qualite: creerChargeurSection(sectionQualite) };

  const seanceInterface = seanceBarree(seanceApp, activite);
  setContext('seance', seanceInterface);
  setContext('facade', facadeContexte);
  setContext('relireListe', () => relireListe());
  setContext('generation', generationApp);
  setContext('ui', uiApp);
  setContext('t', t);
  setContext('format', format);
  setContext('horloge', horloge);
  setContext('imprimante', imprimante);
  setContext('produit', Object.freeze({ provenance, version: produitVersion }));
  const suiviSolveur =
    chargerSolveur === null
      ? null
      : creerSuiviSolveur(
          async () => {
            const { fabrique, urlWasm } = await chargerSolveur();
            return creerExecuteurSolveur(fabrique, { urlWasm, horloge });
          },
          { horloge, signaler: (erreur) => reportError(erreur) },
        );
  if (suiviSolveur !== null) setContext('solveur', suiviSolveur);
  onDestroy(() => suiviSolveur?.terminer());

  // Un refus de la séance ou de la façade porte un code, que l'écran
  // traduit ; toute autre erreur est une faute, qui remonte.
  const estRefus = (erreur) => typeof erreur?.code === 'string';
  const refusDe = (erreur) => ({ code: erreur.code, details: erreur.details });

  // La liste du dossier de travail, que l'accueil montre, et le refus qui en
  // tient lieu quand la façade refuse de la lire : une liste refusée ne
  // montre plus les lignes d'une lecture d'avant. lecture est la promesse de
  // la dernière lecture lancée, que preparer attend ; quand deux lectures se
  // chevauchent, seule la dernière pose ce qu'elle lit. La lecture passe par
  // facadeContexte, la façade que voient les composants et les épreuves.
  let lignes = $state.raw([]);
  let refusLecture = $state.raw(null);
  let lecture = Promise.resolve();
  let lectures = 0;

  // Les résumés des lignes lues, par clé, que facade.resumer rend un événement
  // après l'autre, chaque pas attendant l'image puis l'horloge (creerPas) ;
  // chargement est son flux en cours, ou null. Chaque résumé se range avec sa
  // marque, aJour : faux pour l'ancien chiffre d'un aperçu périmé, que la
  // ligne montre atténué jusqu'à son recalcul ; une marque absente vaut à
  // jour. Une lecture qui commence abandonne le flux de la précédente, comme
  // l'ouverture d'un événement et le démontage : un résumé calculé pour une
  // liste ne se pose jamais sur une plus récente. Une lecture qui s'achève
  // sous un événement ouvert pose ses lignes sans lancer de flux : la
  // fermeture relit la liste, et ses résumés avec elle. Le flux lit dans le
  // dossier de travail de sa liste, et un changement de dossier relit la
  // liste. Une faute d'un calcul rejette fin, que rien ne retient : la page la
  // reçoit comme toute faute, et la ligne écrit « — ».
  const resumes = new SvelteMap();
  let chargement = null;
  function abandonnerResumes() {
    chargement?.abandonner();
    chargement = null;
  }
  function chargerResumes(lues) {
    resumes.clear();
    chargement = facadeContexte.resumer(lues, {
      ceder: creerPas(horloge, (rappel) => requestAnimationFrame(rappel)),
      recevoir: (cle, resume, marque) => resumes.set(cle, { ...resume, aJour: marque?.aJour !== false }),
    });
  }
  onDestroy(abandonnerResumes);
  // terminer() ne règle pas le calcul en cours : le flux, abandonné au même
  // démontage, ne le reçoit pas.
  onDestroy(() => executeurApercu?.terminer());

  async function lireListe() {
    lectures += 1;
    const rang = lectures;
    abandonnerResumes();
    try {
      const lues = await facadeContexte.lister();
      if (rang !== lectures) return;
      lignes = lues;
      refusLecture = null;
      if (seanceApp.etat().evenement === null) chargerResumes(lues);
    } catch (erreur) {
      if (!estRefus(erreur)) throw erreur;
      if (rang !== lectures) return;
      lignes = [];
      refusLecture = refusDe(erreur);
    }
  }

  // Lance une lecture de la liste, qui devient la dernière, et rend sa
  // promesse. L'accueil l'appelle par le contexte après toute opération qui
  // change le dossier de travail.
  function relireListe() {
    lecture = lireListe();
    return lecture;
  }

  // L'état observable de la séance, et la clé de l'événement ouvert : une
  // clé qui change vers un événement remet la navigation à son départ. Le
  // refus de « Liste des événements » tient jusqu'au changement suivant.
  // La liste se relit à chaque fermeture d'un événement, qui a pu en créer,
  // en changer ou écrire ailleurs ; elle se lit aussi quand la détermination
  // se règle — preparer sans question, repondre de facadeContexte après la
  // réponse.
  let etatSeance = $state.raw(seanceApp.etat());
  let refusListe = $state.raw(null);
  let cleOuverte = null;
  const desabonner = seanceApp.subscribe((etat) => {
    const cle = etat.evenement?.cle ?? null;
    if (cle !== null) abandonnerResumes();
    if (cle !== null && cle !== cleOuverte) uiApp.reinitialiser();
    const fermeture = cleOuverte !== null && cle === null;
    cleOuverte = cle;
    etatSeance = etat;
    refusListe = null;
    if (fermeture) relireListe();
  });
  onDestroy(desabonner);

  $effect(() => {
    document.documentElement.setAttribute('data-theme', $uiApp.theme);
  });

  // Chaque charge de l'état observable va au suivi du solveur, qui ne
  // relance rien tant que le modèle ne change pas.
  $effect(() => {
    suiviSolveur?.demander(etatSeance.charge);
  });
  $effect(() => {
    document.documentElement.style.fontSize = taillePoliceRacine(etatSeance.tailleTexte);
  });
  onDestroy(() => {
    document.documentElement.style.removeProperty('font-size');
  });

  const titre = tBrut('coquille.titre', { version: produitVersion });
  const version = versionVisible(provenance, produitVersion, t);
  const provenanceAffichee = provenanceVisible(provenance, t);

  // « Liste des événements » : ferme l'événement, sans question ; sous un
  // support rompu, la séance le refuse, et le refus s'affiche à côté de la
  // commande.
  async function revenirALaListe() {
    try {
      await seanceApp.fermer();
    } catch (erreur) {
      if (!estRefus(erreur)) throw erreur;
      refusListe = refusDe(erreur);
    }
  }

  // La page se retire : la séance ferme l'événement et rend son verrou. Sous
  // un support rompu, elle le refuse et rien ne s'écrit.
  function quitterLaPage() {
    seanceApp.fermer().catch((erreur) => {
      if (!estRefus(erreur)) throw erreur;
    });
  }

  // La détermination faite sans question, la liste du dossier retenu se
  // lit ; une question laisse l'accueil sans lignes, jusqu'à la réponse. Un
  // refus de la détermination s'affiche à la place de la liste.
  async function preparer() {
    try {
      await facadeContexte.demarrer();
    } catch (erreur) {
      if (!estRefus(erreur)) throw erreur;
      refusLecture = refusDe(erreur);
    }
    await lecture;
    await tick();
  }

  /** Résolue quand la détermination du dossier de travail est faite et le
   *  premier écran rendu : les lignes de la liste lue, ou la question. */
  export const pret = preparer();
  /** La séance de ce montage, celle que voient ses composants. */
  export function seance() {
    return seanceInterface;
  }
  /** Le contrôleur de génération de ce montage. */
  export function generation() {
    return generationApp;
  }
  /** La façade des événements de ce montage. */
  export const facade = facadeContexte;
  /** L'état de navigation de ce montage. */
  export const ui = uiApp;
</script>

<svelte:window onpagehide={quitterLaPage} />

<svelte:head>
  <title>{titre}</title>
</svelte:head>

<div class="app" class:occupee={$activite}>
  <Bandeau
    etat={etatSeance}
    {version}
    provenance={provenanceAffichee}
    {refusListe}
    panneau={$uiApp.apropos ? 'apropos' : $uiApp.parametres ? 'parametres' : null}
    basculerParametres={() => uiApp.basculerParametres()}
    basculerApropos={() => uiApp.basculerApropos()}
    {revenirALaListe}
  />
  <main class="ecran">
    {#if $uiApp.apropos}
      <APropos {bloc} {pressePapiers} fermer={() => uiApp.fermerApropos()} />
    {:else if $uiApp.parametres}
      <Parametres fermer={() => uiApp.fermerParametres()} />
    {:else if etatSeance.evenement === null}
      <Accueil {provenance} version={produitVersion} {demonstrations} {lignes} {resumes} {refusLecture} />
    {:else}
      <Evenement {chargeurs} />
    {/if}
  </main>
  <Activite />
</div>

<style>
  :global(body) {
    margin: 0;
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font-family: var(--police-interface);
    line-height: var(--police-interligne);
  }

  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  /* Le curseur d'attente, sur l'application et chacun de ses éléments,
     pendant une opération longue. */
  .occupee,
  .occupee :global(*) {
    cursor: progress;
  }

  .ecran {
    flex: 1;
    box-sizing: border-box;
    width: 100%;
    max-width: var(--largeur-page);
    margin-inline: auto;
    padding: var(--espace-4);
  }

  /* Les styles de base de l'écran, sous :where : spécificité nulle. Le
     titre de page ; les en-têtes alignés au début de la ligne, les nombres
     en chiffres tabulaires ; les champs de saisie sur le fond de la carte,
     au filet de la page — cases à cocher, boutons radio et sélecteurs de
     fichier exceptés. */
  :global(:where(.ecran h1:not([data-impression] *))) {
    font-size: var(--taille-titre-page);
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  :global(:where(.ecran th:not([data-impression] *))) {
    text-align: start;
  }

  :global(:where(.ecran :is(td, th):not([data-impression] *))) {
    font-variant-numeric: tabular-nums;
  }

  :global(
      :where(
          .ecran
            :is(input:not([type='checkbox'], [type='radio'], [type='file']), select, textarea):not([data-impression] *)
        )
    ) {
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
  }
</style>
