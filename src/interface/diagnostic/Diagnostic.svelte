<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Le diagnostic de la configuration (§ 2.1 étape 8, § 5.6) : ce que la
  // configuration rend inévitable, combien, et ce qui le rendrait évitable.
  // Il se calcule sur la charge de l'état observable à chaque charge écrite,
  // par diagnostiquerCharge, avec les planchers des conflits en étoile
  // (planchersConflits), et s'énonce par phrases.js : le composant ne fait
  // que traduire. Regarder n'écrit jamais (§ 8.4) : il se lit en lecture
  // comme sur un plan bloqué.
  //
  // Les énoncés se regroupent par cartesDiagnostic, sans changer d'ordre : la
  // séparation vidée de son sens, une carte par organisation en collision,
  // celle des organisations en conflit, le reste de l'événement, puis les
  // inclusions qu'aucun plan ne satisfait, chaque personne nommée par son
  // nom affiché sur la charge (nomDe, propositions/modele.js). Chaque
  // groupe a son intitulé, qui nomme sa liste (aria-labelledby) : celui d'une
  // organisation est sa pastille, de la teinte que teintesOrganisations donne
  // à son rang sur toute la liste des participants, exclus compris, et porte
  // la donnée [data-donnee] ; les autres, un intertitre.
  //
  // compact : la forme du panneau latéral du plan, que SectionPlan monte
  // dans [data-panneau-diagnostic] — une carte titrée, dont les groupes se
  // suivent sous un filet, et les énoncés seuls. Sinon, la section,
  // [data-section="diagnostic"] : une carte par groupe, chaque énoncé suivi,
  // toujours visibles, de son explication (expliquer) — « Concrètement : »
  // et ses phrases, [data-explication] —, du texte de son remède, précédé
  // de « Pour changer cela : » quand il dit un geste (remedeAgit), du geste
  // propre à l'énoncé quand il en a un, [data-levier], et, quand une
  // commande réalise le remède, de la Commande qui l'exécute par la séance ;
  // un refus de la séance — mode lecture, plan bloqué — s'affiche à côté du
  // bouton, avec son propre remède.
  //
  // Sous les cartes des énoncés, la section seule pose la carte de la
  // proposition choisie (propositionChoisie, proposition.js) :
  // [data-proposition-choisie], son genre, nommée par son intitulé, puis ses
  // blocs [data-bloc-proposition] — laquelle et son statut, puis ce qui est
  // atteint, ce qui manque et ce qu'on peut tenter, chacun sous son
  // intitulé —, toujours visibles. Elle suit la proposition demandée au plan
  // (ui.proposition) et se relit à chaque charge écrite ; une configuration
  // refusée n'en a pas.
  //
  // Les planchers des objectifs (A10) s'énoncent selon le mode réglé : ils
  // lisent l'état des critères, criteresDuDiagnostic, qui ne s'évalue que
  // lorsqu'un plancher des objectifs est positif. Chacun porte
  // data-plancher-objectifs, la valeur dont il donne le plancher.
  //
  // Les personnes non exclues qui manquent un tour (presencesPartielles) :
  // leur nombre fait énoncer les planchers que la présence retire.
  //
  // Une configuration que le moteur refuse n'a pas de diagnostic : son
  // code, traduit, se pose à sa place, jamais le message de l'erreur.
  //
  // Le plancher exact (§ 5.6, § 5.10) : quand App pose le suivi du solveur
  // au contexte, sous 'solveur' (suivi_solveur.js), le Diagnostic lit l'état
  // de la charge affichée, suivi.pour(charge), et passe ses planchers exacts,
  // une fois prêts, à enonces et à propositionChoisie ; d'ici là, et sans
  // suivi, les planchers instantanés seuls. La section, et non le panneau
  // compact, pose sous les cartes des énoncés la ligne du calcul,
  // [data-solveur], qui porte l'état en attribut — 'absent', 'enCours',
  // 'pret', 'annule' ou 'indisponible' — même quand elle n'écrit rien.
  // Pendant le calcul, elle dit ce qui se calcule, au tour près, et
  // pourquoi, dans une région role="status" aria-live="polite", précédée du
  // signe d'un calcul en cours (Chargement), qui tourne — immobile sous
  // prefers-reduced-motion —, montre une barre de progression accessible,
  // les tours résolus sur le total, et la commande « Annuler le calcul
  // exact », qui termine le travailleur. Annulé, elle le dit, et le focus
  // passe à la ligne qui le dit, à la place de la commande qui disparaît ;
  // prêt ou indisponible, elle se tait. Sans suivi, la ligne n'existe pas.
  import { getContext, tick } from 'svelte';
  import { diagnostiquerCharge } from '../../application/diagnostic.js';
  import { presencesPartielles } from '../../application/places.js';
  import { planchersConflits } from '../../application/planchers_conflits.js';
  import { nomsDesTours } from '../../application/tours.js';
  import Chargement from '../accueil/Chargement.svelte';
  import { teintesOrganisations } from '../organisations.js';
  import Carte from '../primitives/Carte.svelte';
  import { actionRemede } from '../primitives/commande.js';
  import Commande from '../primitives/Commande.svelte';
  import Pastille from '../primitives/Pastille.svelte';
  import Refus from '../primitives/Refus.svelte';
  import { nomDe } from '../propositions/modele.js';
  import { cartesDiagnostic, criteresDuDiagnostic, enonces, expliquer, numeroDeCharge, remedeAgit } from './phrases.js';
  import { propositionChoisie } from './proposition.js';

  let { compact = false } = $props();

  // L'intertitre de chaque carte que ne nomme pas une organisation.
  const INTERTITRES = new Map([
    ['separation', 'diagnostic.carte.separation'],
    ['conflits', 'diagnostic.carte.conflits'],
    ['ensemble', 'diagnostic.carte.ensemble'],
    ['inclusions', 'diagnostic.carte.inclusions'],
  ]);

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui') ?? null;
  const suivi = getContext('solveur') ?? null;
  // Les noms des tours, que les énoncés lisent (aides.js) : leurs détails
  // portent les tours par leur numéro.
  const nomsTours = $derived($seance?.charge ? nomsDesTours($seance.charge) : undefined);
  const uid = $props.id();

  const charge = $derived($seance.charge);
  const resultat = $derived(charge === null ? null : diagnostiquerCharge(charge));
  // L'état du calcul exact pour la charge affichée, null sans suivi ; le
  // magasin lu fait suivre chacun de ses changements.
  const solveur = $derived(suivi === null ? null : ($suivi, suivi.pour(charge)));
  const exacts = $derived(solveur?.exacts ?? null);
  let etatSolveur = $state(null);

  async function annulerSolveur() {
    suivi.annuler();
    await tick();
    etatSolveur?.focus();
  }
  const liste = $derived(
    resultat === null || resultat.diagnostic === null
      ? []
      : enonces(resultat.diagnostic, {
          numeroDe: numeroDeCharge(charge),
          tours: charge.evenement.tours,
          criteres: criteresDuDiagnostic(charge, resultat.diagnostic),
          absentes: presencesPartielles(charge).length,
          conflits: planchersConflits(charge),
          exacts,
          nomDe: (id) => nomDe(charge, id),
        }),
  );
  const cartes = $derived(cartesDiagnostic(liste));
  // La proposition choisie, expliquée ; null dans le panneau compact, sans
  // charge et quand la configuration est refusée.
  const demandee = $derived(ui === null ? null : ($ui?.proposition ?? null));
  const choisie = $derived(
    compact || resultat === null || resultat.erreur !== null ? null : propositionChoisie(charge, { demandee, exacts }),
  );
  // Le rang de teinte de chaque organisation, sur tous les participants.
  const rangs = $derived(charge === null ? new Map() : teintesOrganisations(charge.participants));
  // L'intitulé d'un groupe est un h3 dans la section, un h4 sous le titre
  // du panneau.
  const balise = $derived(compact ? 'h4' : 'h3');

  // L'explication d'un énoncé, ses phrases « Concrètement » jointes en un
  // texte, vide quand elle n'en a aucune, et son geste traduit, null sans
  // lui.
  function explicationDe(enonce) {
    const { concretement, levier } = expliquer(enonce, { diagnostic: resultat.diagnostic, tours: charge.evenement.tours });
    return {
      concretement: concretement.map(({ cle, details }) => t(cle, { nomsTours, ...details })).join(' '),
      levier: levier === null ? null : t(levier.cle, { nomsTours, ...levier.details }),
    };
  }

  // L'action d'un remède que réalise une commande ; null pour un remède de
  // texte seul.
  const actionDe = (remede) => (remede?.commande === undefined ? null : actionRemede(remede, { seance, ui }));
</script>

{#snippet groupe(carte, rang)}
  {@const id = `${uid}-groupe-${rang}`}
  <svelte:element this={balise} {id} class="intitule" class:intertitre={carte.genre !== 'organisation'}>
    {#if carte.genre === 'organisation'}<span class="donnee" data-donnee
        ><Pastille sorte="organisation" valeur={rangs.get(carte.groupe) ?? null} libelle={carte.groupe} /></span
      >{:else}{t(INTERTITRES.get(carte.genre))}{/if}
  </svelte:element>
  <ul aria-labelledby={id}>
    {#each carte.enonces as enonce, n (n)}
      <li data-enonce={enonce.cle} data-plancher-objectifs={enonce.grandeur}>
        <p class="enonce"><span data-phrase>{t(enonce.cle, { nomsTours, ...enonce.details })}</span></p>
        {#if !compact}
          {@const explication = explicationDe(enonce)}
          {#if explication.concretement !== ''}
            <p class="explication" data-explication>
              <span class="amorce">{t('diagnostic.amorce.concretement')}</span>
              {explication.concretement}
            </p>
          {/if}
          {#if enonce.remede !== null}
            {@const action = actionDe(enonce.remede)}
            <p class="remede">
              {#if remedeAgit(enonce.remede)}<span class="amorce">{t('diagnostic.amorce.pourChanger')}</span>{' '}{/if}<span data-remede
                >{t(enonce.remede.cle, { nomsTours, ...enonce.remede.details })}</span
              >
            </p>
            {#if action !== null}
              <Commande cle={action.cle} details={action.details} nom={action.nom} confirmer={action.confirmer} executer={action.executer} />
            {/if}
          {/if}
          {#if explication.levier !== null}
            <p class="remede" data-levier>
              <span class="amorce">{t('diagnostic.amorce.pourChanger')}</span>
              {explication.levier}
            </p>
          {/if}
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet calculExact()}
  <div class="solveur" class:cache={solveur.etat !== 'enCours' && solveur.etat !== 'annule'} data-solveur={solveur.etat}>
    <p class="etat-solveur" role="status" aria-live="polite" tabindex="-1" bind:this={etatSolveur}>
      {#if solveur.etat === 'enCours'}
        <span><Chargement /> {t('diagnostic.solveur.enCours', { tour: solveur.tour, tours: solveur.total })}</span>
        <span class="pourquoi">{t('diagnostic.solveur.pourquoi')}</span>
      {:else if solveur.etat === 'annule'}
        <span>{t('diagnostic.solveur.annule')}</span>
      {/if}
    </p>
    {#if solveur.etat === 'enCours'}
      <div
        class="barre"
        role="progressbar"
        aria-label={t('diagnostic.solveur.barre')}
        aria-valuemin="0"
        aria-valuemax={solveur.total}
        aria-valuenow={solveur.faits}
      >
        <div class="plein" style:width={`${(solveur.faits / solveur.total) * 100}%`}></div>
      </div>
      <Commande cle="diagnostic.solveur.annuler" nom="annulerSolveur" executer={annulerSolveur} />
    {/if}
  </div>
{/snippet}

{#snippet erreur()}
  <p>{t('diagnostic.nonCalcule')}</p>
  <Refus refus={resultat.erreur} />
{/snippet}

{#if compact}
  <section class="diagnostic compact" aria-labelledby="{uid}-titre">
    <h3 id="{uid}-titre" class="titre-panneau">{t('coquille.section.diagnostic')}</h3>
    {#if resultat !== null && resultat.erreur !== null}
      <div class="corps">{@render erreur()}</div>
    {:else if cartes.length > 0}
      <div class="corps groupes" role="group" aria-label={t('diagnostic.enonces')}>
        {#each cartes as carte, rang (rang)}
          <div class="groupe">{@render groupe(carte, rang)}</div>
        {/each}
      </div>
    {/if}
  </section>
{:else}
  <section class="diagnostic" data-section="diagnostic">
    <h2>{t('coquille.section.diagnostic')}</h2>
    {#if resultat !== null && resultat.erreur !== null}
      <Carte>{@render erreur()}</Carte>
    {:else if cartes.length > 0}
      <div class="cartes" role="group" aria-label={t('diagnostic.enonces')}>
        {#each cartes as carte, rang (rang)}
          <Carte>{@render groupe(carte, rang)}</Carte>
        {/each}
      </div>
    {/if}
    {#if solveur !== null}{@render calculExact()}{/if}
    {#if choisie !== null}
      <Carte>
        <div class="choisie" role="group" aria-labelledby="{uid}-choisie" data-proposition-choisie={choisie.genre}>
          <h3 id="{uid}-choisie" class="intitule intertitre">{t('diagnostic.carte.proposition')}</h3>
          <div class="bloc" data-bloc-proposition="laquelle">
            <p>{t(choisie.laquelle.cle, { nomsTours, ...choisie.laquelle.details })}</p>
            {#if choisie.statut !== null}
              <p>{t(choisie.statut.cle, { nomsTours, ...choisie.statut.details })}</p>
            {/if}
          </div>
          {#each choisie.blocs as bloc (bloc.nom)}
            <div class="bloc" data-bloc-proposition={bloc.nom}>
              <h4 class="titre-bloc">{t(bloc.titre)}</h4>
              {#each bloc.phrases as phrase, n (n)}
                <p>{t(phrase.cle, { nomsTours, ...phrase.details })}</p>
              {/each}
            </div>
          {/each}
        </div>
      </Carte>
    {/if}
  </section>
{/if}

<style>
  .diagnostic {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    min-width: 0;
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte);
  }

  h2 {
    margin: 0;
    font-size: var(--taille-titre);
  }

  .cartes {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
  }

  /* L'intitulé d'un groupe : la pastille de son organisation, ou un
     intertitre en petites capitales d'encre secondaire. */
  .intitule {
    margin: 0 0 var(--espace-2);
    font-size: var(--taille-texte);
    font-weight: bold;
  }

  .intertitre {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  .donnee {
    display: flex;
    min-width: 0;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
  }

  p {
    margin: 0;
  }

  .remede {
    color: var(--couleur-page-texte-secondaire);
  }

  /* L'amorce d'une explication ou d'un geste : en gras, de l'encre du
     paragraphe qui la porte. */
  .amorce {
    font-weight: bold;
  }

  /* La carte de la proposition choisie : ses blocs l'un sous l'autre,
     chacun sous un intitulé en gras de la taille du texte. */
  .choisie,
  .bloc {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  .choisie {
    gap: var(--espace-3);
  }

  .choisie .intitule {
    margin: 0;
  }

  .titre-bloc {
    margin: 0;
    font-size: var(--taille-texte);
    font-weight: bold;
  }

  /* La ligne du calcul exact : son texte, puis, pendant le calcul, la barre
     des tours résolus — remplie de la teinte de l'action, qui se détache à
     3:1 sur le fond sourd de la carte (SIGNES, actionPrincipale) — et la
     commande qui l'arrête. Sans texte, la ligne est une boîte d'un pixel,
     rognée, qui ne pousse rien : sa région d'état reste dans l'arbre
     d'accessibilité, prête à annoncer le calcul suivant. */
  .solveur {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  .cache {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  .etat-solveur {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    font-variant-numeric: tabular-nums;
  }

  .etat-solveur:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .pourquoi {
    color: var(--couleur-page-texte-secondaire);
  }

  .barre {
    display: flex;
    box-sizing: border-box;
    width: 100%;
    height: 0.75rem;
    overflow: hidden;
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-pilule);
    background-color: var(--couleur-carte-fond-sourd);
  }

  .plein {
    flex: none;
    height: 100%;
    background-color: var(--couleur-action-fond);
  }

  /* Le panneau compact : une carte titrée ; ses groupes se suivent, chacun
     sous un filet. */
  .compact {
    gap: 0;
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-3);
    background-color: var(--couleur-carte-fond);
    box-shadow: var(--ombre-carte);
  }

  .titre-panneau {
    margin: 0;
    padding: var(--espace-3) var(--espace-4);
    border-bottom: 1px solid var(--couleur-carte-filet);
    font-size: var(--taille-titre-carte);
  }

  .compact .corps {
    padding: var(--espace-3) var(--espace-4);
  }

  .compact .groupes {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
  }

  .compact .groupe + .groupe {
    padding-top: var(--espace-3);
    border-top: 1px solid var(--couleur-carte-filet);
  }

  .compact ul {
    gap: var(--espace-2);
  }
</style>
