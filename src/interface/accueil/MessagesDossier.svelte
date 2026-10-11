<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Les messages du dossier de travail en tête de la liste (§ 8.6, § 8.8),
  // dans cet ordre : la question qui attend sa réponse — un avis, avant toute
  // liste, qui nomme le dossier, la cause et ce qu'il porte, et offre ses
  // réponses ; la proposition d'importer l'autre emplacement, quand le
  // dossier retenu est neuf et vide — une information, son compte, puis son
  // chemin dans son propre nœud (data-autre-chemin), la phrase sur les
  // originaux et sa commande ; le compte du dernier import ; puis les avis de
  // la détermination, non modaux, chacun un message « avis ». Le chemin du
  // dossier retenu est dans sa carte (DossierTravail).
  //
  // issue : la détermination { dossier, avis } de la façade ; avis : ceux à
  // dire, vides hors du premier accueil de la séance ; repondre(choix) et
  // importerDepuisAutre(), les gestes de l'accueil ; reponseEnCours : vrai
  // pendant une réponse, qui retire les réponses offertes ; importAutre : les
  // comptes du dernier import, ou null ; lignesPresentes : le dossier retenu
  // porte déjà des événements, et l'import de l'autre emplacement ne se
  // propose plus.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import Message from './Message.svelte';
  import { reponsesDe } from './modele.js';

  let { issue, avis, repondre, reponseEnCours, importerDepuisAutre, importAutre, lignesPresentes } = $props();

  const t = getContext('t');
  const uid = $props.id();

  const question = $derived(issue.dossier.question);
  const autre = $derived(issue.dossier.autre);
  const reponses = $derived(question === null ? [] : reponsesDe(question));
</script>

{#if question !== null || (autre !== null && !lignesPresentes) || importAutre !== null || avis.length > 0}
  <div class="messages">
    {#if question !== null}
      <Message ton="avis">
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
      </Message>
    {/if}

    {#if autre !== null && !lignesPresentes}
      <Message ton="information">
        <div class="autre" data-autre>
          <p>{t('accueil.autre.proposition', { evenements: autre.evenements })}</p>
          <p class="donnee" data-autre-chemin>{autre.racine.chemin}</p>
          <p>{t('accueil.autre.originaux')}</p>
          <Commande cle="accueil.autre.importer" nom="importerAutre" executer={importerDepuisAutre} />
        </div>
      </Message>
    {/if}
    {#if importAutre !== null}
      <Message ton="information">
        <p role="status" data-avertissement="accueil.autre.resultat">{t('accueil.autre.resultat', importAutre)}</p>
      </Message>
    {/if}

    {#each avis as { code, details }, rang (rang)}
      <Message ton="avis">
        <p role="status" data-avertissement={code}>{t(code, details)}</p>
      </Message>
    {/each}
  </div>
{/if}

<style>
  .messages {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
  }

  p {
    margin: 0;
  }

  .question,
  .autre {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  .reponses {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }

  .donnee {
    font-weight: bold;
    overflow-wrap: anywhere;
  }
</style>
