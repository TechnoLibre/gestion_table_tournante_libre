<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La carte du dossier de travail (§ 8.6) : son chemin, en entier, dans son
  // propre nœud (data-dossier-travail), et la commande qui l'ouvre dans
  // l'explorateur, ou, sous web, la phrase qui dit pourquoi elle manque, en
  // message « avis ». Tant qu'une question attend, aucun dossier n'est
  // retenu : la carte n'existe pas, la question est en tête de la liste
  // (MessagesDossier).
  //
  // question : celle qui attend sa réponse, ou null ; racine : le dossier de
  // travail de la séance, null tant qu'une question attend ; explorateur :
  // { disponible, raison } de la façade.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';
  import Commande from '../primitives/Commande.svelte';
  import Message from './Message.svelte';
  import { surLaListe } from './modele.js';

  let { question, racine, explorateur } = $props();

  const t = getContext('t');
  const facade = getContext('facade');
</script>

{#if question === null && racine !== null}
  <Carte titre={t('accueil.dossier.titre')} icone="dossier">
    <div class="dossier" data-dossier>
      <p class="chemin" data-dossier-travail>{racine.chemin}</p>
      {#if explorateur.disponible}
        <Commande cle="accueil.dossier.explorateur" executer={() => surLaListe(() => facade.ouvrirExplorateur())} />
      {:else}
        <Message ton="avis">
          <p data-avertissement={explorateur.raison}>{t(explorateur.raison)}</p>
        </Message>
      {/if}
    </div>
  </Carte>
{/if}

<style>
  .dossier {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-3);
  }

  p {
    margin: 0;
  }

  .chemin {
    padding: var(--espace-2) var(--espace-3);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond-sourd);
    font-size: var(--taille-texte-petit);
    overflow-wrap: anywhere;
  }
</style>
