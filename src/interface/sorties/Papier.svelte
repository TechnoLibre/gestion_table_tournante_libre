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
  // plan bloqué comme en lecture. Des réglages illisibles ou une écriture
  // refusée ne refusent pas le choix : il vaut pour la séance, et
  // l'avertissement que rend la séance va à EtatSeance.avertissements, que
  // ce composant n'affiche pas. Un refus s'affiche sur le choix cliqué, par
  // la commande, et la question reste. Le choix fait, onChoisi, quand il est
  // donné, reçoit le papier : la section qui demandait une production la
  // poursuit.
  //
  // Habillage : la question montre chaque papier comme un choix distinct,
  // une tuile à son filet que son bouton remplit, haut d'une cible
  // principale ; le papier choisi se montre dans une pastille neutre.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import Pastille from '../primitives/Pastille.svelte';
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
        <div class="tuile" data-cible={choix}>
          <Commande cle={clesPapier(choix).choix} nom="choisirPapier" executer={() => choisir(choix)} />
        </div>
      {/each}
    </div>
  </div>
{:else}
  <div class="papier choisi" data-papier="choisi">
    <span class="titre">{t('impression.papier.titre')}</span>
    <Pastille sorte="statut" valeur="neutre" icone="imprimer" libelle={t(clesPapier(papier).nom)} />
    <Commande cle="impression.papier.changer" nom="changerPapier" executer={() => (changer = true)} />
  </div>
{/if}

<style>
  .papier {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2);
  }

  .question {
    flex-direction: column;
    align-items: stretch;
  }

  p {
    margin: 0;
  }

  .intitule {
    font-weight: bold;
  }

  .explication,
  .titre {
    color: var(--couleur-page-texte-secondaire);
  }

  /* Les choix : une tuile par papier, côte à côte tant que la largeur le
     permet, l'une sous l'autre sinon. */
  .choix {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--espace-3);
    max-width: 36rem;
  }

  .tuile {
    padding: var(--espace-2);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
  }

  /* Le bouton de la Commande remplit sa tuile, haut d'une cible principale ;
     son refus se pose dessous. */
  .tuile :global(.commande) {
    display: flex;
    width: 100%;
  }

  .tuile :global(button) {
    flex: 1 1 100%;
    min-height: var(--hauteur-cible);
    font-weight: bold;
  }
</style>
