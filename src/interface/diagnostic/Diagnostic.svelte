<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le diagnostic de la configuration (§ 2.1 étape 8, § 5.6) : ce que la
  // configuration rend inévitable, combien, et ce qui le rendrait évitable.
  // Il se calcule sur la charge de l'état observable à chaque charge écrite,
  // par diagnostiquerCharge, et s'énonce par phrases.js : le composant ne
  // fait que traduire. Regarder n'écrit jamais (§ 8.4) : il se lit en
  // lecture comme sur un plan bloqué.
  //
  // compact : la forme du panneau latéral du plan, que SectionPlan monte
  // dans [data-panneau-diagnostic] — son titre et les énoncés seuls. Sinon, la section,
  // [data-section="diagnostic"] : chaque énoncé suivi du texte de son
  // remède et, quand une commande le réalise, de la Commande qui l'exécute
  // par la séance ; un refus de la séance — mode lecture, plan bloqué —
  // s'affiche à côté du bouton, avec son propre remède.
  //
  // Une configuration que le moteur refuse n'a pas de diagnostic : son
  // code, traduit, se pose à sa place, jamais le message de l'erreur.
  // L'appartenance d'un groupe est une donnée : elle occupe son propre
  // nœud, avant le texte.
  import { getContext } from 'svelte';
  import { diagnostiquerCharge } from '../../application/diagnostic.js';
  import { actionRemede } from '../primitives/commande.js';
  import Commande from '../primitives/Commande.svelte';
  import Refus from '../primitives/Refus.svelte';
  import { enonces, numeroDeCharge } from './phrases.js';

  let { compact = false } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui') ?? null;

  const charge = $derived($seance.charge);
  const resultat = $derived(charge === null ? null : diagnostiquerCharge(charge));
  const liste = $derived(
    resultat === null || resultat.diagnostic === null
      ? []
      : enonces(resultat.diagnostic, { numeroDe: numeroDeCharge(charge), tours: charge.evenement.tours }),
  );

  // L'action d'un remède que réalise une commande ; null pour un remède de
  // texte seul.
  const actionDe = (remede) => (remede?.commande === undefined ? null : actionRemede(remede, { seance, ui }));
</script>

{#snippet contenu()}
  {#if resultat !== null && resultat.erreur !== null}
    <p>{t('diagnostic.nonCalcule')}</p>
    <Refus refus={resultat.erreur} />
  {:else if liste.length > 0}
    <ul aria-label={t('diagnostic.enonces')}>
      {#each liste as enonce, rang (rang)}
        <li data-enonce={enonce.cle}>
          <p class="enonce">
            {#if enonce.details.groupe !== undefined}<span class="donnee" data-donnee>{enonce.details.groupe}</span>{/if}<span
              data-phrase>{t(enonce.cle, enonce.details)}</span
            >
          </p>
          {#if !compact && enonce.remede !== null}
            {@const action = actionDe(enonce.remede)}
            <p class="remede" data-remede>{t(enonce.remede.cle, enonce.remede.details)}</p>
            {#if action !== null}
              <Commande
                cle={action.cle}
                details={action.details}
                nom={action.nom}
                confirmer={action.confirmer}
                executer={action.executer}
              />
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

{#if compact}
  <div class="diagnostic compact">
    <h3>{t('coquille.section.diagnostic')}</h3>
    {@render contenu()}
  </div>
{:else}
  <section class="diagnostic" data-section="diagnostic">
    <h2>{t('coquille.section.diagnostic')}</h2>
    {@render contenu()}
  </section>
{/if}

<style>
  .diagnostic {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    min-width: 0;
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte);
  }

  h2 {
    margin: 0;
    font-size: var(--taille-titre);
  }

  h3 {
    margin: 0;
    font-size: var(--taille-texte);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .compact ul {
    gap: var(--espace-2);
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

  .enonce {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }

  .donnee {
    font-weight: 700;
  }

  .remede {
    color: var(--couleur-page-texte-secondaire);
  }
</style>
