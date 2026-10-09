<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La question du papier (§ 8.5, § 11.2), que l'aperçu avant impression et
  // la section des badges partagent : le papier est un réglage de la
  // machine, retenu dans reglages_locaux.json, demandé à la première sortie
  // et jamais ensuite. Sans papier — EtatSeance.papier null —, le composant
  // pose la question, un choix par papier de PAPIERS, chacun décrit ; avec
  // un papier, il le montre, « Papier : A4 », et offre « Changer », qui
  // rouvre la question. Aucun papier n'est choisi pour l'opérateur.
  //
  // Un choix passe par seance.choisirPapier, vivant dans tout mode, sur un
  // plan bloqué comme en lecture. Un refus — des réglages illisibles, une
  // écriture refusée — s'affiche sur le choix cliqué, par la commande, et
  // la question reste. Le choix écrit, onChoisi, quand il est donné, reçoit
  // le papier : la section qui demandait une production la poursuit.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import { PAPIERS_OFFERTS, clesPapier } from '../impression/modele.js';

  let { onChoisi = null } = $props();

  const t = getContext('t');
  const seance = getContext('seance');

  // Vrai après « Changer », jusqu'au choix suivant.
  let changer = $state(false);
  const papier = $derived($seance.papier);
  const question = $derived(papier === null || changer);

  async function choisir(choix) {
    await seance.choisirPapier(choix);
    changer = false;
    onChoisi?.(choix);
  }
</script>

{#if question}
  <div class="papier question" data-papier="question">
    <p class="intitule">{t('impression.papier.question')}</p>
    <p class="explication">{t('impression.papier.explication')}</p>
    <div class="choix">
      {#each PAPIERS_OFFERTS as choix (choix)}
        <div data-cible={choix}>
          <Commande cle={clesPapier(choix).choix} nom="choisirPapier" executer={() => choisir(choix)} />
        </div>
      {/each}
    </div>
  </div>
{:else}
  <div class="papier choisi" data-papier="choisi">
    <span>{t('impression.papier.titre')}</span>
    <span class="donnee">{t(clesPapier(papier).nom)}</span>
    <Commande cle="impression.papier.changer" nom="changerPapier" executer={() => (changer = true)} />
  </div>
{/if}

<style>
  .papier {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--espace-2);
  }

  .question {
    flex-direction: column;
    align-items: flex-start;
  }

  p {
    margin: 0;
  }

  .intitule {
    font-weight: bold;
  }

  .explication {
    color: var(--couleur-page-texte-secondaire);
  }

  .choix {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }

  .donnee {
    font-weight: bold;
  }
</style>
