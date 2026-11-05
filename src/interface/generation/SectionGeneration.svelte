<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La section de la génération (§ 2.1 étape 9, § 5.7, § 5.9, § 5.10,
  // § 15.4) : en tête, la meilleure proposition du classement ; puis les
  // réglages, « Générer », la question d'une génération longue,
  // l'avancement d'un calcul et l'issue du dernier. Tout passe par le
  // contrôleur de génération du contexte, qui seul contrôle, lance, mesure et
  // enregistre ; la section ne refait aucun de ses contrôles.
  //
  // « Générer » lit la graine saisie et les réglages de la charge par
  // controleur.valider : un refus de la graine se pose contre elle, et rien
  // ne part. Un refus du contrôleur — l'état de la séance, ce qui doit avoir
  // eu lieu, les places manquantes — se pose à côté de « Générer », avec son
  // remède ; aucune fenêtre ne s'ouvre. Une génération longue
  // (CONFIRMATION_REQUISE) pose en place la question qui nomme l'ordre de
  // grandeur attendu : « Générer quand même » la relance confirmée, « Ne pas
  // générer » la retire sans rien écrire. La question tombe à toute autre
  // frappe dans la graine, au clic de « Générer », et dès que la charge
  // change : elle ne vaut que pour les réglages qu'elle nomme.
  //
  // Le nombre de cœurs refusé — refusCoeurs, que Reglages pose contre son
  // champ — retient « Générer » : rien ne part tant qu'il est posé.
  //
  // La graine est pré-remplie de controleur.grainePropose() au montage, puis,
  // à chaque lancement, de la graine suivante. Pendant le calcul, la section
  // porte aria-busy="true" et montre l'avancement ; « Générer » reste offert,
  // et le contrôleur refuse un second lancement. Une annulation n'est pas un
  // refus : l'état prêt revient, et l'issue le dit. Le contrôleur vit plus
  // longtemps que la section : remontée pendant un calcul, elle en retrouve
  // l'avancement par subscribe.
  //
  // La meilleure proposition (§ 5.4, § 5.7) est un bloc d'information en
  // lecture seule : l'identifiant de la proposition au rang 1 du classement
  // et ses collisions cumulées, la cellule même que le tableau des
  // propositions porte à ce rang (meilleureProposition, meilleure.js), relue
  // à chaque charge écrite — une génération enregistrée, des propositions
  // effacées. Sans proposition classée, il le dit en mots. Il se lit en
  // lecture, sur un plan bloqué et pendant un calcul, où il montre le
  // classement tel qu'il est. Le libellé des collisions est l'en-tête de la
  // colonne du tableau ; son survol ou son focus ouvre l'infobulle de la
  // section, une seule, sur l'explication de cette colonne, et le quitter la
  // referme ; le terme expliqué porte aria-describedby vers elle.
  //
  // Les réglages (Reglages.svelte) portent le choix du mode des objectifs,
  // sous sa case, et l'éditeur de l'ordre des priorités, après les
  // contraintes (§ 5.3, § 5.7) : chacun s'écrit par ses commandes, sans que
  // la section s'en mêle.
  //
  // Le départ d'une génération dérivée (§ 5.7, C6, Q9) est un état de la
  // navigation, ui.etat().depart, que « Repartir d'elle » pose au tableau des
  // propositions. Sous lui, la carte du départ (Depart.svelte) se tient
  // au-dessus de « Générer », qui se lit « Générer depuis n° 4 » et passe
  // {id, toursFiges} à generation.generer ; « Repartir de zéro » le retire et
  // rend « Générer », le focus sur lui. Choisir et cocher n'écrivent rien,
  // en lecture comme sur un plan bloqué : seul le lancement écrit, et la
  // séance le refuse. Un refus du départ — DEPART_*, TOUR_FIGE_*,
  // TOURS_FIGES_TOUS — se garde ici avec l'état du départ qu'il juge, et
  // tombe dès que cet état change : un autre départ, une case cochée ou
  // décochée, « Repartir de zéro ». Les remèdes d'un refus du départ
  // — repartirDeZero, libererTour — changent cet état : le refus tombe par
  // lui, et la commande n'a rien à lever. Tous les tours figés se posent
  // contre les cases ; les autres à côté de « Générer depuis », avec leur
  // remède, par le refusExterne de la commande. Tout autre refus passe par la
  // commande elle-même, qui ne se remonte jamais : un départ retiré pendant
  // un calcul laisse « Générer » occupé jusqu'à sa fin, et le refus que le
  // calcul rend ensuite se pose à côté de lui. Le départ reste choisi après
  // la génération : une génération ordinaire passe par « Repartir de zéro ».
  // La carte est clé sur l'identifiant du départ : un autre départ en monte
  // une neuve. Elle dit, avant le lancement, les écarts du départ à la
  // soirée et la retouche du retenu à un tour coché (carteDuDepart,
  // depart.js). Un départ en dérive par ses seuls participants reste choisi :
  // l'état de navigation ne le retire que quand il quitte la liste, et la
  // génération part de lui ajusté à la présence.
  //
  // L'issue (issueDerivee, depart.js) se relit dans la table d'évaluation de
  // chaque charge : celle d'une génération dérivée nomme la meilleure
  // dérivée, sa place et celle du départ — « en dérive, n'est pas classée »
  // pour un départ en dérive par ses participants —, et offre « Comparer
  // n° 23 à n° 4 », qui montre n° 23 au plan, met n° 4 en second placement et
  // ouvre la vue de comparaison de la page de qualité, sans rien écrire. Les
  // avertissements que la génération rend — DEPART_ECART_AU_RETENU — suivent
  // l'issue, chacun sous son code.
  //
  // Habillage : la meilleure proposition est une carte à elle, chaque valeur
  // sous son intitulé ; les réglages, « Générer » — l'action principale de
  // l'écran —, la question, l'avancement et l'issue vivent dans la carte des
  // réglages, sous elle.
  import { getContext, onDestroy, tick, untrack } from 'svelte';
  import { ErreurCommande } from '../../application/erreurs.js';
  import { ErreurAnnulee } from '../../application/generation.js';
  import Carte from '../primitives/Carte.svelte';
  import Commande from '../primitives/Commande.svelte';
  import Infobulle from '../primitives/Infobulle.svelte';
  import { evaluation, explicationDeColonne, texteCellule } from '../propositions/modele.js';
  import Avancement from './Avancement.svelte';
  import Depart from './Depart.svelte';
  import { carteDuDepart, issueDerivee } from './depart.js';
  import Reglages from './Reglages.svelte';
  import { CLE_ANNONCEE, COLONNE_ANNONCEE, meilleureProposition } from './meilleure.js';

  const t = getContext('t');
  const format = getContext('format');
  const seance = getContext('seance');
  const generation = getContext('generation');
  const ui = getContext('ui');

  // La graine saisie, et son refus ; la question d'une génération longue,
  // { estimation } ; ce que rend la dernière génération lancée d'ici ; le
  // dernier refus du départ, { refus, depart }, depart étant l'état du
  // départ qu'il juge.
  let graine = $state(String(generation.grainePropose()));
  let refusGraine = $state.raw(null);
  let question = $state.raw(null);
  let rendu = $state.raw(null);
  let refusCoeurs = $state.raw(null);
  let refusDepart = $state.raw(null);

  // Un lancement — enCours qui passe à vrai — met dans le champ la graine
  // suivante et retire la question, le refus de la graine et l'issue d'avant.
  let enCoursAvant = false;
  const desabonner = generation.subscribe((etat) => {
    if (etat.enCours && !enCoursAvant) {
      graine = String(generation.grainePropose());
      refusGraine = null;
      question = null;
      rendu = null;
      refusDepart = null;
    }
    enCoursAvant = etat.enCours;
  });
  onDestroy(desabonner);

  const charge = $derived($seance.charge);

  // La proposition au rang 1, { id, cellule }, ou null sans proposition
  // classée.
  const meilleure = $derived(charge === null ? null : meilleureProposition(charge));

  // La carte du départ, null sans départ ; la commande de lancement qu'elle
  // nomme, ou « Générer ».
  const carte = $derived(charge === null ? null : carteDuDepart(charge, $ui.depart));
  const lancement = $derived(carte === null ? { cle: 'generation.commande.generer', nom: 'generer', details: {} } : carte.commande);
  // Sous un départ, « Générer depuis n° X » se nomme par son libellé : un
  // remède posé à côté de lui se nomme par lui, et ne se confond pas avec la
  // commande de même texte de la carte.
  const nomLancement = $derived(carte === null ? null : t(lancement.cle, lancement.details));
  // Le refus du départ, tant que le départ qu'il juge est celui de l'état :
  // contre les cases pour tous les tours figés, à côté de la commande de
  // lancement sinon.
  const refusDuDepart = $derived(refusDepart !== null && refusDepart.depart === $ui.depart ? refusDepart.refus : null);
  const refusDesCases = $derived(refusDuDepart?.code === 'TOURS_FIGES_TOUS' ? refusDuDepart : null);
  const refusDuLancement = $derived(refusDuDepart?.code === 'TOURS_FIGES_TOUS' ? null : refusDuDepart);

  // L'issue de la dernière génération, relue dans la table d'évaluation de
  // la charge.
  const issue = $derived(rendu === null || charge === null ? null : issueDerivee(evaluation(charge).table, rendu));

  // La racine de la section : « Repartir de zéro » y retrouve « Générer ».
  let racine = $state.raw(null);

  const uid = $props.id();
  const idTitreMeilleure = `${uid}-meilleure`;
  const idExplication = `${uid}-explication`;
  // L'explication ouverte, {ancre, cle, details}, ou null : celle du libellé
  // des collisions cumulées, le seul terme expliqué de la section.
  let expliquee = $state.raw(null);
  function expliquer(evenement) {
    expliquee = { ancre: evenement.currentTarget, cle: explicationDeColonne(COLONNE_ANNONCEE), details: {} };
  }
  const taire = () => (expliquee = null);

  // La question tombe quand la charge change.
  $effect.pre(() => {
    void charge;
    untrack(() => {
      question = null;
    });
  });

  // La mesure du dernier calcul de la séance, et l'estimation des réglages
  // de la charge qu'elle donne sur les cœurs réglés, relues à chaque
  // publication du contrôleur — un changement des cœurs compris.
  const mesure = $derived.by(() => {
    void $generation;
    return generation.derniereGeneration();
  });
  const estimation = $derived.by(() => {
    void $generation;
    return mesure === null || charge === null ? null : generation.estimer(charge.reglages.generation);
  });

  // Coche ou décoche le tour du départ choisi, par l'état de navigation.
  function cocher(tour, coche) {
    const { depart } = ui.etat();
    if (depart === null) return;
    const autres = depart.toursFiges.filter((autre) => autre !== tour);
    ui.reglerToursFiges(coche ? [...autres, tour] : autres);
  }

  // Vrai pour un code de la famille du départ, celui d'un refus qui juge le
  // départ choisi et ne vaut que pour lui.
  function estRefusDuDepart(code) {
    return typeof code === 'string' && (code.startsWith('DEPART_') || code.startsWith('TOUR_FIGE_') || code === 'TOURS_FIGES_TOUS');
  }

  // « Repartir de zéro », de la carte ou en remède d'un refus du départ : le
  // départ retiré, la carte et le refus du départ tombent avec la commande
  // qui avait le focus ; le focus passe à « Générer ».
  async function repartirDeZero() {
    ui.retirerDepart();
    await tick();
    const actif = document.activeElement;
    if (actif === null || actif === document.body) racine?.querySelector('[data-commande="generer"]')?.focus();
  }

  // « Comparer n° a à n° X » : la paire posée dans l'état de navigation.
  function comparer({ a, depart }) {
    ui.montrerProposition(a);
    ui.comparerA(depart);
    ui.allerA('qualite');
    ui.demanderVueQualite('comparaison');
  }

  function saisirGraine() {
    refusGraine = null;
    question = null;
  }

  // Lance une génération sur la graine saisie et les réglages de la charge,
  // depuis le départ de l'état de navigation quand il y en a un ;
  // confirmee : la réponse à la question d'une génération longue. Les
  // réglages se lisent quand la file de la séance a passé ce qui s'y
  // trouve : un réglage quitté par le clic même s'écrit d'abord, et la
  // génération part sur lui, quelle que soit la lenteur du disque.
  async function lancer(confirmee) {
    if (refusCoeurs !== null) return;
    refusGraine = null;
    rendu = null;
    refusDepart = null;
    if (!confirmee) question = null;
    const saisie = graine;
    const depart = ui.etat().depart;
    await seance.attendre();
    const { reglages, refus } = generation.valider({ ...generation.reglagesProposes(), graine: saisie });
    const deGraine = refus.find(({ champ }) => champ === 'graine');
    if (deGraine !== undefined) {
      refusGraine = { code: deGraine.code, details: deGraine.details };
      question = null;
      return;
    }
    if (reglages === null) throw new ErreurCommande(refus[0].code, refus[0].details);
    try {
      const options = { confirmee, depart: depart === null ? null : { id: depart.id, toursFiges: [...depart.toursFiges] } };
      rendu = await generation.generer(reglages, options);
    } catch (erreur) {
      if (erreur instanceof ErreurAnnulee) return;
      if (estRefusDuDepart(erreur?.code)) {
        refusDepart = { refus: { code: erreur.code, details: erreur.details ?? {} }, depart };
        return;
      }
      if (erreur?.code === 'CONFIRMATION_REQUISE') {
        question = { estimation: erreur.details.estimation };
        return;
      }
      throw erreur;
    }
  }
</script>

<section data-section="generation" aria-busy={$generation.enCours ? 'true' : 'false'} bind:this={racine}>
  <h2>{t('coquille.section.generation')}</h2>
  {#if charge !== null}
    <section class="meilleure" data-meilleure aria-labelledby={idTitreMeilleure}>
      <h3 id={idTitreMeilleure}>{t('generation.meilleure.titre')}</h3>
      {#if meilleure === null}
        <p data-meilleure-vide>{t('generation.meilleure.aucune')}</p>
      {:else}
        <dl>
          <div>
            <dt data-meilleure-libelle-id>{t('generation.meilleure.proposition')}</dt>
            <dd data-meilleure-id>{format.nombre(meilleure.id)}</dd>
          </div>
          <div>
            <!-- Le libellé est un terme, non une commande : le focus ne sert
                 qu'à montrer au clavier l'explication que le pointeur montre
                 au survol. -->
            <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
            <dt
              class="terme"
              data-terme={COLONNE_ANNONCEE}
              tabindex="0"
              aria-describedby={expliquee === null ? undefined : idExplication}
              onmouseenter={expliquer}
              onmouseleave={taire}
              onfocus={expliquer}
              onblur={taire}>{t(CLE_ANNONCEE)}</dt
            >
            <dd data-meilleure-collisions>{texteCellule(meilleure.cellule, { t, format })}</dd>
          </div>
        </dl>
      {/if}
    </section>
    <Infobulle id={idExplication} ouverte={expliquee} fermer={taire} />
    <Carte titre={t('generation.reglages.titre')} niveau={3}>
      <div class="reglages">
        <Reglages {charge} {mesure} {estimation} bind:graine {refusGraine} {saisirGraine} bind:refusCoeurs />
        {#if carte !== null}
          {#key carte.depart}
            <Depart {carte} refusCases={refusDesCases} {cocher} {repartirDeZero} />
          {/key}
        {/if}
        <div class="lancer">
          <Commande
            cle={lancement.cle}
            nom={lancement.nom}
            details={lancement.details}
            nomAccessible={nomLancement}
            gestes={{ repartirDeZero }}
            variante="principale"
            refusExterne={refusDuLancement}
            executer={() => lancer(false)}
          />
        </div>
        {#if question !== null}
          <div class="question" data-question="longue" role="status">
            <p>{t('generation.longue.question', question)}</p>
            <div class="issues">
              <Commande cle="generation.longue.confirmer" nom="confirmerGeneration" executer={() => lancer(true)} />
              <Commande cle="generation.longue.renoncer" nom="renoncerGeneration" executer={() => (question = null)} />
            </div>
          </div>
        {/if}
        {#if $generation.enCours}
          <Avancement fait={$generation.fait} total={$generation.total} annuler={() => generation.annuler()} />
        {:else if issue !== null}
          <div class="issue">
            <p data-issue role="status">{t(issue.cle, issue.details)}</p>
            {#each issue.avertissements as avertissement, rang (rang)}
              <p class="avertissement" role="status" data-avertissement={avertissement.cle}>{t(avertissement.cle, avertissement.details)}</p>
            {/each}
            {#if issue.comparer !== null}
              <Commande
                cle="generation.commande.comparerIssue"
                nom="comparerIssue"
                details={issue.comparer}
                executer={() => comparer(issue.comparer)}
              />
            {/if}
          </div>
        {:else if $generation.annulee === 'commande'}
          <p data-issue role="status">{t('generation.issue.annuleeCommande')}</p>
        {:else if $generation.annulee === 'seance'}
          <p data-issue role="status">{t('generation.issue.annuleeSeance')}</p>
        {/if}
      </div>
    </Carte>
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

  /* La meilleure proposition : une carte, son titre en tête, puis chaque
     valeur en grand, sous son intitulé en petites capitales. */
  .meilleure {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    padding: var(--espace-4) var(--espace-5);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-3);
    background-color: var(--couleur-carte-fond);
    box-shadow: var(--ombre-carte);
  }

  h3 {
    margin: 0;
    font-size: var(--taille-titre-carte);
  }

  dl {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-3) var(--espace-6);
    margin: 0;
  }

  dl > div {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  dt {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  dd {
    margin: 0;
    font-size: var(--taille-titre);
    font-weight: bold;
    font-variant-numeric: tabular-nums;
  }

  /* Le terme expliqué se signale par un soulignement pointillé, comme un
     en-tête de colonne du tableau des propositions. */
  .terme {
    text-decoration: underline dotted;
    text-underline-offset: 0.2em;
  }

  .terme:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .reglages {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
  }

  .lancer {
    display: flex;
    padding-top: var(--espace-3);
    border-top: 1px solid var(--couleur-ligne-filet);
  }

  .question {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    padding: var(--espace-3) var(--espace-4);
    border: 1px solid var(--couleur-avis-filet);
    border-left: 3px solid var(--couleur-avis-marque);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-avis-fond);
  }

  .issue {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  /* Un avertissement de la génération : filet et marque de l'avis. */
  .avertissement {
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-avis-filet);
    border-left: 3px solid var(--couleur-avis-marque);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-avis-fond);
  }

  .issues {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }

  p {
    margin: 0;
  }
</style>
