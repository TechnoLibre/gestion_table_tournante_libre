<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

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
  //
  // Sous le titre de l'écran, une carte : le fichier, la raison, les secours
  // — le premier offert est l'action principale —, puis le retour.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';
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
  <Carte>
    <div class="contenu">
      <p class="fichier">
        <span class="intitule">{t('accueil.recuperation.fichier')}</span>
        <span class="chemin">{chemin}</span>
      </p>
      <Refus {refus} />
      {#if offerts.length > 0}
        <p>{t('accueil.recuperation.offerte')}</p>
        <ul class="secours">
          {#each offerts as { source, cle }, rang (source)}
            <li data-secours={source}>
              <Commande
                {cle}
                variante={rang === 0 ? 'principale' : 'secondaire'}
                executer={() => surLaListe(() => seance.ouvrirSecours(base, source))}
              />
            </li>
          {/each}
        </ul>
      {:else}
        <p>{t('accueil.recuperation.aucunSecours')}</p>
      {/if}
      <div class="retour">
        <Commande cle="accueil.recuperation.retour" executer={retour} />
      </div>
    </div>
  </Carte>
</section>

<style>
  .recuperation {
    display: flex;
    flex-direction: column;
    gap: var(--espace-5);
  }

  .contenu,
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

  h1 {
    line-height: 1.2;
  }

  .fichier {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }

  .intitule {
    font-weight: bold;
  }

  .chemin {
    overflow-wrap: anywhere;
  }

  .secours {
    flex-flow: row wrap;
    align-items: center;
    gap: var(--espace-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .retour {
    padding-top: var(--espace-3);
    border-top: 1px solid var(--couleur-carte-filet);
    align-self: stretch;
  }
</style>
