<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La section de la génération (§ 2.1 étape 9, § 5.7, § 5.9, § 5.10,
  // § 15.4) : les réglages, « Générer », la question d'une génération longue,
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
  // La graine est pré-remplie de controleur.grainePropose() au montage, puis,
  // à chaque lancement, de la graine suivante. Pendant le calcul, la section
  // porte aria-busy="true" et montre l'avancement ; « Générer » reste offert,
  // et le contrôleur refuse un second lancement. Une annulation n'est pas un
  // refus : l'état prêt revient, et l'issue le dit. Le contrôleur vit plus
  // longtemps que la section : remontée pendant un calcul, elle en retrouve
  // l'avancement par subscribe.
  import { getContext, onDestroy, untrack } from 'svelte';
  import { ErreurCommande } from '../../application/erreurs.js';
  import { ErreurAnnulee } from '../../application/generation.js';
  import Commande from '../primitives/Commande.svelte';
  import Avancement from './Avancement.svelte';
  import Reglages from './Reglages.svelte';

  const t = getContext('t');
  const seance = getContext('seance');
  const generation = getContext('generation');

  // La graine saisie, et son refus ; la question d'une génération longue,
  // { estimation } ; l'issue de la dernière génération lancée d'ici,
  // { ajoutees, identiques }.
  let graine = $state(String(generation.grainePropose()));
  let refusGraine = $state.raw(null);
  let question = $state.raw(null);
  let issue = $state.raw(null);

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

  // La question tombe quand la charge change.
  $effect.pre(() => {
    void charge;
    untrack(() => {
      question = null;
    });
  });

  // La mesure du dernier calcul de la séance, relue à chaque publication du
  // contrôleur, et l'estimation des réglages de la charge qu'elle donne.
  const mesure = $derived.by(() => {
    void $generation;
    return generation.derniereGeneration();
  });
  const estimation = $derived(
    mesure === null || charge === null ? null : generation.estimer(charge.reglages.generation),
  );

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
    <Reglages {charge} {mesure} {estimation} bind:graine {refusGraine} {saisirGraine} />
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
