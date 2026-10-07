<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le cadre de mode (§ 8.4, § 8.5, § 14.5) : un trait autour de la surface
  // de travail, dont la forme dit le mode — tirets en lecture, plein en
  // écriture, double sur un plan bloqué —, et une barre qui porte, de gauche
  // à droite, la place fixe, le libellé de mode, puis « Défaire » et
  // « Refaire » (§ 8.3). Sous la barre vient la tête, tete, quand elle est
  // donnée — l'en-tête de l'événement et la navigation des sections —, puis
  // la surface, children, qui défile seule. La barre ouvre le cadre : rien
  // ne la précède dans l'écran de l'événement, si bien qu'un refus posé dans
  // la tête, ou un nom qui s'étend sur plusieurs lignes, allonge la tête
  // sans déplacer la place fixe (§ 8.4).
  //
  // La place fixe porte la commande que rend commandeFixe (modele.js) :
  // « Modifier », « Débloquer » — confirmé en place, par la Commande d'I2 —,
  // « Revenir en lecture », ou, pour un format plus récent, l'explication du
  // refus courant à la place de toute commande. Le verrou d'une autre séance
  // qui a refusé le passage en écriture s'y nomme à côté du refus — sa
  // séance et l'instant de sa prise, chacun dans son nœud — et, quand sa vie
  // ne se prouve pas, « Reprendre le verrou » s'y offre, confirmé en place à
  // côté de ce qui le nomme (§ 8.8). « Refaire » n'est là que lorsqu'un
  // retour se refait ; « Défaire » est toujours là, et la séance refuse à
  // côté de lui ce qui ne se défait pas.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import { CONFIRMATION_DEBLOCAGE } from '../primitives/commande.js';
  import Refus from '../primitives/Refus.svelte';
  import { cadreDeMode, commandeFixe, repriseOfferte } from './modele.js';

  let { children, tete = null } = $props();

  const t = getContext('t');
  const seance = getContext('seance');

  // Sans événement — l'instant où l'écran se retire —, le cadre garde la
  // forme de la lecture, et n'a pas de libellé.
  const cadre = $derived(cadreDeMode($seance));
  const forme = $derived(cadre?.forme ?? 'tirets');
  // Le trait du cadre est une marque (§ 14.5) : data-marque nomme l'entrée
  // du registre (marques.js) qui porte le jeton de sa couleur.
  const MARQUE_DE_LA_FORME = { tirets: 'cadreLecture', plein: 'cadreEcriture', double: 'cadreBloque' };
  const commande = $derived(commandeFixe($seance));
  const verrou = $derived($seance.mode === 'lecture' ? $seance.verrouAutre : null);
  const reprise = $derived(repriseOfferte($seance));
</script>

<div class="cadre" data-mode={forme} data-marque={MARQUE_DE_LA_FORME[forme]} class:tirets={forme === 'tirets'} class:double={forme === 'double'}>
  <div class="barre" role="group" aria-label={t('evenement.cadre.commandes')}>
    <div class="ligne">
      <div class="fixe" data-place-fixe>
        {#if commande === 'format'}
          <Refus refus={$seance.refus} />
        {:else if commande === 'modifier'}
          <Commande cle="communs.commande.modifier" nom="modifier" executer={() => seance.passerEnEcriture()} />
        {:else if commande === 'debloquer'}
          <Commande
            cle="communs.commande.debloquer"
            nom="debloquer"
            confirmer={CONFIRMATION_DEBLOCAGE}
            executer={() => seance.debloquer()}
          />
        {:else if commande === 'lecture'}
          <Commande cle="communs.commande.lecture" nom="lecture" executer={() => seance.passerEnLecture()} />
        {/if}
      </div>
      {#if cadre !== null}
        <span class="libelle" data-mode-libelle="cadre">{t(cadre.cle)}</span>
      {/if}
      {#if commande !== 'format'}
        <div class="historique" data-historique>
          <Commande cle="evenement.commande.defaire" nom="defaire" executer={() => seance.defaire()} />
          {#if $seance.retours.refaire}
            <Commande cle="evenement.commande.refaire" nom="refaire" executer={() => seance.refaire()} />
          {/if}
        </div>
      {/if}
    </div>
    {#if verrou !== null}
      <div class="verrou" data-verrou>
        <p>{t('evenement.verrou.titre')}</p>
        <p>
          <span>{t('evenement.verrou.seance')}</span>
          <span class="donnee" data-verrou-seance>{verrou.seance ?? t('evenement.verrou.inconnu')}</span>
          <span>{t('evenement.verrou.depuis')}</span>
          <span class="donnee" data-verrou-depuis>{verrou.depuis ?? t('evenement.verrou.inconnu')}</span>
        </p>
        {#if reprise !== null}
          <p>{t('evenement.verrou.avis')}</p>
          <Commande
            cle="communs.remede.reprendreVerrou"
            nom="reprendreVerrou"
            confirmer="evenement.verrou.confirmerReprise"
            executer={() => seance.reprendreVerrou()}
          />
        {/if}
      </div>
    {/if}
  </div>
  {#if tete !== null}
    <div class="tete">
      {@render tete()}
    </div>
  {/if}
  <div class="surface">
    {@render children()}
  </div>
</div>

<style>
  /* Le trait du cadre : sa forme dit le mode, sa couleur le redit. */
  /* Une même épaisseur dans les trois formes : la place fixe ne bouge pas
     d'un mode à l'autre. */
  .cadre {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    border: 6px solid var(--couleur-cadre-ecriture);
    border-radius: var(--rayon-2);
  }

  .cadre.tirets {
    border-style: dashed;
    border-color: var(--couleur-cadre-lecture);
  }

  .cadre.double {
    border-style: double;
    border-color: var(--couleur-cadre-bloque);
  }

  /* La barre ne prend jamais toute la hauteur du cadre : au-delà, ses
     messages défilent, la place fixe en tête. */
  .barre {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    gap: var(--espace-2);
    max-height: 50%;
    overflow-y: auto;
    padding: var(--espace-2) var(--espace-3);
    border-bottom: 1px solid var(--couleur-page-filet);
  }

  .ligne {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2) var(--espace-3);
  }

  .fixe {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  .libelle {
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    font-weight: bold;
  }

  .historique {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  .verrou {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
    font-size: var(--taille-texte);
  }

  .verrou p {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1) var(--espace-2);
    margin: 0;
  }

  .donnee {
    font-weight: bold;
  }

  /* La tête ne prend jamais plus du tiers du cadre : au-delà, elle défile,
     et la surface garde sa place. */
  .tete {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    gap: var(--espace-2);
    max-height: 35%;
    overflow-y: auto;
    padding: var(--espace-2) var(--espace-3);
    border-bottom: 1px solid var(--couleur-page-filet);
  }

  .surface {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: var(--espace-3);
  }
</style>
