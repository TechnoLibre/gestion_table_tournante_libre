<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le dossier de travail sur la liste (§ 8.6, § 8.8), dans cet ordre : la
  // question qui attend sa réponse — elle vient avant toute liste, et nomme
  // le dossier, la cause et ce qu'il porte ; la proposition d'importer
  // l'autre emplacement, quand le dossier retenu est neuf et vide — son
  // compte, puis son chemin dans son propre nœud (data-autre-chemin) —, avec
  // la phrase sur les originaux ; les avis de la détermination, non modaux ;
  // puis le chemin du dossier, en entier, et la commande qui l'ouvre dans
  // l'explorateur, ou, sous web, la phrase qui dit pourquoi elle manque.
  //
  // issue : la détermination { dossier, avis } de la façade ; racine : le
  // dossier de travail de la séance, null tant qu'une question attend ;
  // avis : ceux à dire, vides hors du premier accueil de la séance ;
  // explorateur : { disponible, raison } de la façade ; repondre(choix) et
  // importerDepuisAutre(), les gestes de l'accueil ; reponseEnCours : vrai
  // pendant une réponse, qui retire les réponses offertes ; importAutre : les
  // comptes du dernier import, ou null ; lignesPresentes : le dossier retenu
  // porte déjà des événements, et l'import de l'autre emplacement ne se
  // propose plus.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import { reponsesDe, surLaListe } from './modele.js';

  let {
    issue,
    racine,
    avis,
    explorateur,
    repondre,
    reponseEnCours,
    importerDepuisAutre,
    importAutre,
    lignesPresentes,
  } = $props();

  const t = getContext('t');
  const facade = getContext('facade');
  const uid = $props.id();

  const question = $derived(issue.dossier.question);
  const autre = $derived(issue.dossier.autre);
  const reponses = $derived(question === null ? [] : reponsesDe(question));
</script>

<section class="dossier" data-dossier>
  {#if question !== null}
    <div class="question" role="group" data-question={question.code} aria-labelledby={`${uid}-question`}>
      <p id={`${uid}-question`}>{t(question.code, question)}</p>
      {#if !reponseEnCours}
        <div class="reponses">
          {#each reponses as { choix, cle } (choix)}
            <Commande {cle} executer={() => repondre(choix)} />
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if autre !== null && !lignesPresentes}
    <div class="autre" data-autre>
      <p>{t('accueil.autre.proposition', { evenements: autre.evenements })}</p>
      <p class="donnee" data-autre-chemin>{autre.racine.chemin}</p>
      <p>{t('accueil.autre.originaux')}</p>
      <Commande cle="accueil.autre.importer" nom="importerAutre" executer={importerDepuisAutre} />
    </div>
  {/if}
  {#if importAutre !== null}
    <p class="avis" role="status" data-avertissement="accueil.autre.resultat">{t('accueil.autre.resultat', importAutre)}</p>
  {/if}

  {#each avis as { code, details }, rang (rang)}
    <p class="avis" role="status" data-avertissement={code}>{t(code, details)}</p>
  {/each}

  {#if question === null && racine !== null}
    <div class="chemin">
      <h2 id={`${uid}-titre`}>{t('accueil.dossier.titre')}</h2>
      <p data-dossier-travail>{racine.chemin}</p>
      {#if explorateur.disponible}
        <Commande cle="accueil.dossier.explorateur" executer={() => surLaListe(() => facade.ouvrirExplorateur())} />
      {:else}
        <p class="avis" data-avertissement={explorateur.raison}>{t(explorateur.raison)}</p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .dossier {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
  }

  h2,
  p {
    margin: 0;
  }

  h2 {
    font-size: var(--taille-titre);
  }

  .question,
  .autre {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    padding: var(--espace-3);
    border: 2px solid var(--couleur-avis);
    border-radius: var(--rayon-2);
  }

  .reponses {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }

  .avis {
    padding: var(--espace-1) var(--espace-2);
    border-left: 3px solid var(--couleur-avis);
  }

  .chemin {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--espace-2) var(--espace-3);
  }

  [data-dossier-travail],
  .donnee {
    overflow-wrap: anywhere;
  }
</style>
