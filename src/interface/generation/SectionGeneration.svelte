<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

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
  import { getContext, onDestroy, untrack } from 'svelte';
  import { ErreurCommande } from '../../application/erreurs.js';
  import { ErreurAnnulee } from '../../application/generation.js';
  import Commande from '../primitives/Commande.svelte';
  import Infobulle from '../primitives/Infobulle.svelte';
  import { explicationDeColonne, texteCellule } from '../propositions/modele.js';
  import Avancement from './Avancement.svelte';
  import Reglages from './Reglages.svelte';
  import { CLE_ANNONCEE, COLONNE_ANNONCEE, meilleureProposition } from './meilleure.js';

  const t = getContext('t');
  const format = getContext('format');
  const seance = getContext('seance');
  const generation = getContext('generation');

  // La graine saisie, et son refus ; la question d'une génération longue,
  // { estimation } ; l'issue de la dernière génération lancée d'ici,
  // { ajoutees, identiques }.
  let graine = $state(String(generation.grainePropose()));
  let refusGraine = $state.raw(null);
  let question = $state.raw(null);
  let issue = $state.raw(null);
  let refusCoeurs = $state.raw(null);

  // Un lancement — enCours qui passe à vrai — met dans le champ la graine
  // suivante et retire la question, le refus de la graine et l'issue d'avant.
  let enCoursAvant = false;
  const desabonner = generation.subscribe((etat) => {
    if (etat.enCours && !enCoursAvant) {
      graine = String(generation.grainePropose());
      refusGraine = null;
      question = null;
      issue = null;
    }
    enCoursAvant = etat.enCours;
  });
  onDestroy(desabonner);

  const charge = $derived($seance.charge);

  // La proposition au rang 1, { id, cellule }, ou null sans proposition
  // classée.
  const meilleure = $derived(charge === null ? null : meilleureProposition(charge));

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

  function saisirGraine() {
    refusGraine = null;
    question = null;
  }

  // Lance une génération sur la graine saisie et les réglages de la charge ;
  // confirmee : la réponse à la question d'une génération longue. Les
  // réglages se lisent quand la file de la séance a passé ce qui s'y
  // trouve : un réglage quitté par le clic même s'écrit d'abord, et la
  // génération part sur lui, quelle que soit la lenteur du disque.
  async function lancer(confirmee) {
    if (refusCoeurs !== null) return;
    refusGraine = null;
    issue = null;
    if (!confirmee) question = null;
    const saisie = graine;
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
      const rendu = await generation.generer(reglages, { confirmee });
      issue = { ajoutees: rendu.ajoutees.length, identiques: rendu.identiques };
    } catch (erreur) {
      if (erreur instanceof ErreurAnnulee) return;
      if (erreur?.code === 'CONFIRMATION_REQUISE') {
        question = { estimation: erreur.details.estimation };
        return;
      }
      throw erreur;
    }
  }
</script>

<section data-section="generation" aria-busy={$generation.enCours ? 'true' : 'false'}>
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
    <Reglages {charge} {mesure} {estimation} bind:graine {refusGraine} {saisirGraine} bind:refusCoeurs />
    <div class="lancer">
      <Commande cle="generation.commande.generer" nom="generer" executer={() => lancer(false)} />
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
      <p data-issue role="status">{t('generation.issue.ajoutees', issue)}</p>
    {:else if $generation.annulee === 'commande'}
      <p data-issue role="status">{t('generation.issue.annuleeCommande')}</p>
    {:else if $generation.annulee === 'seance'}
      <p data-issue role="status">{t('generation.issue.annuleeSeance')}</p>
    {/if}
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
  }

  h2 {
    margin: 0;
    font-size: var(--taille-titre);
  }

  /* La meilleure proposition : un bloc d'information encadré d'un filet,
     sur le fond de la page ; chaque libellé suivi de sa valeur, en gras. */
  .meilleure {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
  }

  h3 {
    margin: 0;
    font-size: var(--taille-texte);
  }

  dl {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2) var(--espace-5);
    margin: 0;
  }

  dl > div {
    display: flex;
    gap: var(--espace-2);
    align-items: baseline;
  }

  dd {
    margin: 0;
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

  .question {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    padding: var(--espace-2) var(--espace-3);
    border-left: 3px solid var(--couleur-avis);
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
