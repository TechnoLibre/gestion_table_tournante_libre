<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La récupération d'un état qui ne s'ouvre pas (§ 8.8) : elle ne repart
  // jamais de zéro en silence. Elle nomme le fichier, en entier, et la raison
  // — le texte de l'ETAT_ILLISIBLE qu'a levé l'ouverture —, puis offre les
  // secours lisibles dans l'ordre du § 8.8, la version précédente puis le
  // dernier instant du journal (secoursOfferts), chacun ouvert en lecture
  // par seance.ouvrirSecours, sans rien écrire. Sans secours lisible, elle
  // le dit, et rien ne s'ouvre ni ne se crée. Le retour rend la liste.
  //
  // base, chemin : ceux de la ligne ; refus : { code, details } de
  // l'ouverture refusée ; retour() : rend la liste.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import Refus from '../primitives/Refus.svelte';
  import { secoursOfferts, surLaListe } from './modele.js';

  let { base, chemin, refus, retour } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const uid = $props.id();

  const offerts = $derived(secoursOfferts(refus.details.secours));
</script>

<section class="recuperation" data-ecran="recuperation" aria-labelledby={`${uid}-titre`}>
  <h1 id={`${uid}-titre`}>{t('accueil.recuperation.titre')}</h1>
  <p class="fichier">
    <span>{t('accueil.recuperation.fichier')}</span>
    <span class="chemin">{chemin}</span>
  </p>
  <Refus {refus} />
  {#if offerts.length > 0}
    <p>{t('accueil.recuperation.offerte')}</p>
    <ul class="secours">
      {#each offerts as { source, cle } (source)}
        <li data-secours={source}>
          <Commande {cle} executer={() => surLaListe(() => seance.ouvrirSecours(base, source))} />
        </li>
      {/each}
    </ul>
  {:else}
    <p>{t('accueil.recuperation.aucunSecours')}</p>
  {/if}
  <Commande cle="accueil.recuperation.retour" executer={retour} />
</section>

<style>
  .recuperation,
  .secours {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-3);
  }

  h1,
  p {
    margin: 0;
  }

  .fichier {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }

  .chemin {
    overflow-wrap: anywhere;
  }

  .secours {
    gap: var(--espace-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
