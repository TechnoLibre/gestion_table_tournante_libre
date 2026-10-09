<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le cadre de mode (§ 8.4, § 8.5, § 14.5) : un trait autour de la surface
  // de travail, dont la forme dit le mode — tirets en lecture, plein en
  // écriture, double sur un plan bloqué —, et une barre qui porte, de gauche
  // à droite, la place fixe, le libellé de mode, puis « Défaire » et
  // « Refaire » (§ 8.3). Sous la barre vient la tête, tete, quand elle est
  // donnée — l'en-tête de l'événement et la navigation des sections —, puis
  // les annonces, annonces, quand il y en a — support rompu et
  // avertissements —, puis la surface, children. La barre ouvre le cadre :
  // rien ne la précède dans l'écran de l'événement, si bien qu'un refus posé
  // dans la tête, ou un nom qui s'étend sur plusieurs lignes, allonge la tête
  // sans déplacer la place fixe (§ 8.4). Tête, annonces et surface défilent
  // chacune dans sa zone : des avertissements nombreux ne poussent pas la
  // surface hors du cadre, ni le cadre hors de la fenêtre. La surface porte
  // le plan, que l'opérateur regarde : elle réclame les trois quarts du
  // cadre avant que les annonces ne dépassent leur première ligne, sauf
  // devant un support rompu, dont les issues restent en vue.
  //
  // Sous une tête, et hors d'un support rompu, les annonces se posent à
  // côté d'elle, dans la place que sa navigation laisse à droite : leur zone
  // prend la hauteur de la tête et défile dedans, si bien qu'un
  // avertissement ne retire aucune hauteur à la surface, ni au plan qu'elle
  // porte. Une fenêtre trop étroite pour les deux les passe à la ligne, et
  // la zone garde alors sa hauteur minimale.
  //
  // La tête se rend en un seul point du DOM, quelle que soit la place des
  // annonces : seules les annonces passent de côté à dessous quand une
  // annonce vient, s'en va, ou que le support se rompt. Un rendu de la tête
  // dans deux blocs la démonterait à chacun de ces passages — la Commande
  // en cours détruite, le refus posé à côté du geste perdu (§ 2.1), le
  // focus du clavier rendu au corps de la page.
  //
  // La place fixe porte la commande que rend commandeFixe (modele.js) :
  // « Modifier », « Débloquer » — confirmé en place, par la primitive Commande —,
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

  let { children, tete = null, annonces = null } = $props();

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
  // Les annonces se posent à côté de la tête, ou dessous.
  const aCote = $derived(tete !== null && annonces !== null && $seance.supportRompu === null);
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
    <div class="tete" class:cote={aCote}>
      <div class="contenu">
        {@render tete()}
      </div>
      {#if aCote}
        <div class="place">
          <div class="annonces" data-annonces>
            {@render annonces()}
          </div>
        </div>
      {/if}
    </div>
  {/if}
  {#if annonces !== null && !aCote}
    <div class="annonces seules" class:rompu={$seance.supportRompu !== null} data-annonces>
      {@render annonces()}
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

  /* La tête ne prend jamais plus de 35 % du cadre : au-delà, elle défile,
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

  /* Les annonces défilent dans leur zone, au-delà de sa hauteur. */
  .annonces {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    overflow-y: auto;
    padding: var(--espace-2) var(--espace-3);
  }

  /* À côté de la tête : la tête passe en ligne, son contenu à gauche, la
     place des annonces à droite. La place ne donne à la ligne que sa
     hauteur minimale ; la zone des annonces la remplit, posée en absolu,
     et ne l'agrandit jamais : la ligne a la hauteur du contenu de la tête.
     La place prend une part fixe de la largeur, et le contenu le reste :
     la zone ne bouge pas d'une section à l'autre, quand le libellé de la
     section ouverte, en gras, change la largeur de la navigation. Sa part,
     36 %, tient en deux lignes de Noto Sans chacun des deux avertissements
     d'un journal tronqué dans une fenêtre de 1 366 px : le second paraît
     dans la hauteur de la tête. Sous 30rem de contenu, la place passe à la
     ligne. */
  .tete.cote {
    flex-flow: row wrap;
    align-items: stretch;
    gap: 0 var(--espace-3);
    padding-right: 0;
    padding-block: 0;
  }

  .contenu {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
  }

  .cote > .contenu {
    flex: 1 1 0;
    min-width: min(100%, 30rem);
    padding-block: var(--espace-2);
  }

  .place {
    position: relative;
    flex: 0 0 36%;
    min-width: 16rem;
    min-height: 3rem;
    border-left: 1px solid var(--couleur-page-filet);
  }

  .place > .annonces {
    position: absolute;
    inset: 0;
  }

  /* Seules — sans tête, en plein écran, ou devant un support rompu —, les
     annonces ne prennent jamais plus du quart du cadre, et cèdent d'abord
     leur hauteur à la surface : leur facteur de rétrécissement, mille fois
     celui de la surface, leur fait absorber presque tout le manque de
     place, jusqu'à leur hauteur minimale : un avertissement d'une ligne en
     entier, et le haut du suivant, qui dit que la zone en porte d'autres. */
  .annonces.seules {
    flex: 0 1000 auto;
    min-height: 3rem;
    max-height: 25%;
    border-bottom: 1px solid var(--couleur-page-filet);
  }

  /* Le support rompu, en tête des annonces, porte les seules issues de
     l'opérateur : tant qu'il est là, les annonces ne cèdent rien à la
     surface, et gardent leur hauteur jusqu'au quart du cadre ; les
     avertissements qui le suivent défilent sous lui. */
  .annonces.rompu {
    flex-shrink: 0;
  }

  /* La surface part des trois quarts du cadre, s'étend à ce qui reste, et
     ne rétrécit, après les annonces, que pour la barre et la tête. Sa
     hauteur ne dépend pas de son contenu : elle est un conteneur de taille,
     dont une section borne un panneau à la hauteur visible (unités cqb). */
  .surface {
    flex: 1 1 75%;
    min-height: 0;
    overflow: auto;
    padding: var(--espace-3);
    container-type: size;
  }
</style>
