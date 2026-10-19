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
  // Les énoncés se regroupent par cartesDiagnostic, sans changer d'ordre :
  // la séparation vidée de son sens, une carte par appartenance en
  // collision, puis le reste de l'événement. Chaque groupe a son intitulé,
  // qui nomme sa liste (aria-labelledby) : celui d'une appartenance est sa
  // pastille, de la teinte que teintesAppartenances donne à son rang sur
  // toute la liste des participants, exclus compris, et porte la donnée
  // [data-donnee] ; les autres, un intertitre.
  //
  // compact : la forme du panneau latéral du plan, que SectionPlan monte
  // dans [data-panneau-diagnostic] — une carte titrée, dont les groupes se
  // suivent sous un filet, et les énoncés seuls. Sinon, la section,
  // [data-section="diagnostic"] : une carte par groupe, chaque énoncé suivi
  // du texte de son remède et, quand une commande le réalise, de la Commande
  // qui l'exécute par la séance ; un refus de la séance — mode lecture, plan
  // bloqué — s'affiche à côté du bouton, avec son propre remède.
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
  import { getContext } from 'svelte';
  import { diagnostiquerCharge } from '../../application/diagnostic.js';
  import { presencesPartielles } from '../../application/places.js';
  import { teintesAppartenances } from '../appartenances.js';
  import Carte from '../primitives/Carte.svelte';
  import { actionRemede } from '../primitives/commande.js';
  import Commande from '../primitives/Commande.svelte';
  import Pastille from '../primitives/Pastille.svelte';
  import Refus from '../primitives/Refus.svelte';
  import { cartesDiagnostic, criteresDuDiagnostic, enonces, numeroDeCharge } from './phrases.js';

  let { compact = false } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui') ?? null;
  const uid = $props.id();

  const charge = $derived($seance.charge);
  const resultat = $derived(charge === null ? null : diagnostiquerCharge(charge));
  const liste = $derived(
    resultat === null || resultat.diagnostic === null
      ? []
      : enonces(resultat.diagnostic, {
          numeroDe: numeroDeCharge(charge),
          tours: charge.evenement.tours,
          criteres: criteresDuDiagnostic(charge, resultat.diagnostic),
          absentes: presencesPartielles(charge).length,
        }),
  );
  const cartes = $derived(cartesDiagnostic(liste));
  // Le rang de teinte de chaque appartenance, sur tous les participants.
  const rangs = $derived(charge === null ? new Map() : teintesAppartenances(charge.participants));
  // L'intitulé d'un groupe est un h3 dans la section, un h4 sous le titre
  // du panneau.
  const balise = $derived(compact ? 'h4' : 'h3');

  // L'action d'un remède que réalise une commande ; null pour un remède de
  // texte seul.
  const actionDe = (remede) => (remede?.commande === undefined ? null : actionRemede(remede, { seance, ui }));
</script>

{#snippet groupe(carte, rang)}
  {@const id = `${uid}-groupe-${rang}`}
  <svelte:element this={balise} {id} class="intitule" class:intertitre={carte.genre !== 'appartenance'}>
    {#if carte.genre === 'appartenance'}<span class="donnee" data-donnee
        ><Pastille sorte="appartenance" valeur={rangs.get(carte.groupe) ?? null} libelle={carte.groupe} /></span
      >{:else if carte.genre === 'separation'}{t('diagnostic.carte.separation')}{:else}{t('diagnostic.carte.ensemble')}{/if}
  </svelte:element>
  <ul aria-labelledby={id}>
    {#each carte.enonces as enonce, n (n)}
      <li data-enonce={enonce.cle} data-plancher-objectifs={enonce.grandeur}>
        <p class="enonce"><span data-phrase>{t(enonce.cle, enonce.details)}</span></p>
        {#if !compact && enonce.remede !== null}
          {@const action = actionDe(enonce.remede)}
          <p class="remede" data-remede>{t(enonce.remede.cle, enonce.remede.details)}</p>
          {#if action !== null}
            <Commande cle={action.cle} details={action.details} nom={action.nom} confirmer={action.confirmer} executer={action.executer} />
          {/if}
        {/if}
      </li>
    {/each}
  </ul>
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

  /* L'intitulé d'un groupe : la pastille de son appartenance, ou un
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
