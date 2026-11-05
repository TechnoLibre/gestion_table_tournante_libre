<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La barre, la tête et la surface de travail de l'événement (§ 8.4, § 8.5,
  // § 14.5), sans trait autour d'elles : le mode se lit dans la bande de
  // mode (BandeMode.svelte), dans le libellé de mode du bandeau, et dans
  // celui de la barre, à côté de la place fixe. data-mode porte le mode —
  // lecture, ecriture ou bloque. La barre porte, de gauche à droite, la
  // place fixe, le libellé de mode, puis « Défaire », « Refaire » et
  // « Historique… » (§ 8.3), puis les outils, outils — la suite des états
  // du plan —, et les actions, actions — « Imprimer… », calée à droite —,
  // quand ils sont donnés. Outils et actions suivent la place fixe et ne la
  // déplacent donc jamais : un refus posé à côté de la place fixe les
  // repousse sur la ligne suivante, à côté du libellé, sans ligne de plus.
  // Une barre de moins de 80rem — la fenêtre de 1 366 px lui en donne
  // davantage — passe les outils sous les commandes et les actions, sur une
  // ligne à eux : la barre garde deux lignes là où, dans l'ordre du
  // document, elle en prendrait trois.
  //
  // Sous la barre vient la tête, tete, quand elle est donnée — l'en-tête de
  // l'événement et la navigation des sections —, puis les annonces,
  // annonces, quand il y en a — support rompu et avertissements —, puis la
  // surface, children. La barre ouvre le composant, et seule la bande de
  // mode, de hauteur constante, le précède dans l'écran de l'événement : un
  // refus posé dans la barre ou la tête, ou un nom qui s'étend sur plusieurs
  // lignes, allonge la barre ou la tête sans déplacer la place fixe
  // (§ 8.4). Tête, annonces et surface défilent chacune dans sa zone : des
  // avertissements nombreux ne poussent pas la surface hors du composant, ni
  // le composant hors de la fenêtre. La surface porte le plan, que
  // l'opérateur regarde : elle réclame les trois quarts du composant avant
  // que les annonces ne dépassent leur première ligne, sauf devant un
  // support rompu, dont les issues restent en vue.
  //
  // Sous une tête, et hors d'un support rompu, les annonces se posent à
  // côté d'elle, dans la place que sa navigation laisse à droite. Leur zone
  // prend la hauteur de ce qu'elle porte, jusqu'à un plafond, et la tête
  // grandit avec elle : un avertissement s'y lit en entier, son action
  // comprise, jamais rogné par le bas de la zone ; au-delà du plafond, la
  // zone défile. Un avertissement qui tient dans la hauteur de la tête ne
  // retire donc aucune hauteur à la surface, ni au plan qu'elle porte, et
  // des avertissements nombreux ne lui retirent que ce qui sépare le
  // plafond de la hauteur de la tête. Une tête trop étroite pour les deux
  // passe la place à la ligne, sous son contenu, sur toute sa largeur.
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
  //
  // « Historique… », après eux dans le même groupe, présent hors d'un
  // format plus récent, ouvre et ferme le panneau d'historique
  // (Historique.svelte), qu'il désigne par aria-expanded et aria-controls.
  // Le panneau se pose à droite de la surface, dans la zone de travail, sur
  // toute sa hauteur ; la surface garde le reste. Sous 80rem de barre, il
  // passe par-dessus elle : la zone de travail est pour cela un conteneur
  // de largeur, et le repère de sa position. Ouvrir porte le focus sur son
  // titre ; un second clic, ou Échap dans le panneau, le ferme et rend le
  // focus au bouton. Le second clic d'une série — detail supérieur à 1 —
  // est sans effet, comme sur une commande : un double-clic laisse le
  // panneau ouvert. L'ouverture est un état de ce composant, que l'écran de
  // l'événement garde d'une section à l'autre, et qui ne s'écrit nulle part.
  // Dans une barre de moins de 30rem — celle d'un téléphone —, le bouton ne
  // montre que son icône, son libellé lu hors de la vue le nommant : la
  // barre n'y prend pas de ligne de plus.
  //
  // Les raccourcis de l'écran de l'événement (raccourcis.js, contexte
  // 'evenement') : un écouteur keydown sur le document, monté avec le
  // composant, nomme la touche par toucheDe, et sur Ctrl+Z appelle
  // seance.defaire({touche}), sur Ctrl+Maj+Z ou Ctrl+Y seance.refaire
  // ({touche}) — le libellé figé de l'entrée nomme la touche —, l'action par
  // défaut empêchée. Il laisse la touche passer, sans rien appeler, quand
  // elle est répétée — une touche tenue ne défait qu'une fois —, déjà prise
  // par un autre écouteur, ou que le focus est dans une saisie — un input
  // qui porte du texte, textarea, select, élément éditable : Ctrl+Z y
  // défait la frappe —, dans une fenêtre modale, qu'un pointeur est
  // enfoncé, qu'un menu d'actions est ouvert, ou devant un format plus
  // récent. Une case à cocher, un bouton radio ou tout input sans texte n'a
  // pas d'annulation à lui : Ctrl+Z y défait le plan. Les pointeurs
  // enfoncés se comptent par pointerdown et pointerup ou pointercancel, en
  // capture sur le document ; la fenêtre qui perd le focus les oublie, son
  // relâcher ne lui parvenant pas.
  //
  // Le refus d'un défaire, d'un clic sur « Défaire » comme d'un raccourci,
  // et celui d'un refaire au clavier se rangent dans un seul état,
  // refusDefaire, que « Défaire » montre par son refusExterne, avec le même
  // remède ; celui d'un clic sur « Refaire » se range dans refusRefaire, que
  // « Refaire » montre de la même façon. Un seul refus est montré, le
  // dernier posé : les deux tombent à chaque raccourci, à chaque clic sur
  // « Défaire » ou « Refaire », et dès que le mode, l'état du plan, la
  // révision ou le support rompu changent — un remède abouti change l'un
  // d'eux.
  //
  // « Modifier » est l'action principale de la lecture, pleine de la teinte
  // de l'action ; « Revenir en lecture » et « Débloquer » ne le sont pas.
  // Chaque commande de la barre a la hauteur d'une cible principale, et la
  // barre celle d'une ligne de ces commandes : passer d'une commande de la
  // place fixe à l'autre ne déplace ni la tête ni la surface. Le libellé de
  // mode est une pastille aux couleurs de la bande de mode, centrée dans
  // cette hauteur, d'encre neutre.
  //
  // La barre et la tête forment la carte d'en-tête de l'événement : la
  // barre sur le fond sourd de la carte, la tête sur son fond, séparées et
  // closes par le filet de la carte. La surface reste sur le fond de la
  // page.
  import { getContext, onMount, tick, untrack } from 'svelte';
  import { suivre } from '../activite.js';
  import Commande from '../primitives/Commande.svelte';
  import { CONFIRMATION_DEBLOCAGE } from '../primitives/commande.js';
  import Icone from '../primitives/Icone.svelte';
  import Refus from '../primitives/Refus.svelte';
  import { effetDe, toucheDe } from '../raccourcis.js';
  import Historique from './Historique.svelte';
  import { bandeDeMode, commandeFixe, repriseOfferte } from './modele.js';

  let { children, tete = null, annonces = null, outils = null, actions = null } = $props();

  const t = getContext('t');
  const seance = getContext('seance');

  // Le mode et la clé de son libellé, ceux de la bande. Sans événement —
  // l'instant où l'écran se retire —, le mode est la lecture, sans libellé.
  const libelle = $derived(bandeDeMode($seance));
  const mode = $derived(libelle?.mode ?? 'lecture');
  const commande = $derived(commandeFixe($seance));
  const verrou = $derived($seance.mode === 'lecture' ? $seance.verrouAutre : null);
  const reprise = $derived(repriseOfferte($seance));
  // Les annonces se posent à côté de la tête, ou dessous.
  const aCote = $derived(tete !== null && annonces !== null && $seance.supportRompu === null);

  // --- Le panneau d'historique ----------------------------------------------------
  const uid = $props.id();
  const idHistorique = `${uid}-historique`;
  let historiqueOuvert = $state(false);
  let boutonHistorique = $state(null);
  const panneauMontre = $derived(historiqueOuvert && commande !== 'format');

  function basculerHistorique(evenement) {
    if (evenement.detail > 1) return;
    if (historiqueOuvert) fermerHistorique();
    else historiqueOuvert = true;
  }

  function fermerHistorique() {
    historiqueOuvert = false;
    tick().then(() => boutonHistorique?.focus());
  }

  // Une touche tenue sur le bouton ne le bascule qu'une fois.
  function surToucheBouton(evenement) {
    if (evenement.repeat && effetDe('commande', evenement.key) === 'activer') evenement.preventDefault();
  }

  // --- Les retours, au clic et au clavier ------------------------------------------
  let refusDefaire = $state(null);
  let refusRefaire = $state(null);
  const modeCourant = $derived($seance.mode);
  const etatCourant = $derived($seance.evenement?.etat ?? null);
  const revisionCourante = $derived($seance.evenement?.revision ?? null);
  const supportCourant = $derived($seance.supportRompu);
  $effect.pre(() => {
    void modeCourant;
    void etatCourant;
    void revisionCourante;
    void supportCourant;
    untrack(() => {
      refusDefaire = null;
      refusRefaire = null;
    });
  });

  // Le défaire ou le refaire, options passées à la séance. Le retour
  // reconstruit la charge : il passe par l'indicateur d'activité
  // (activite.js), au clic comme au clavier, quel que soit le mode lu au
  // moment du geste — un passage en écriture peut encore attendre dans la
  // file de la séance. En lecture, la séance le refuse sans rien calculer, et
  // l'indicateur se retire avec le refus. Un refus,
  // une erreur qui porte un code, se range dans refusRefaire pour un clic
  // sur « Refaire », dans refusDefaire sinon ; toute autre erreur remonte.
  async function retourner(effet, options, clicRefaire = false) {
    refusDefaire = null;
    refusRefaire = null;
    const appeler = () => (effet === 'defaire' ? seance.defaire(options) : seance.refaire(options));
    try {
      await suivre(appeler);
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      const refus = { code: erreur.code, details: erreur.details ?? {} };
      if (clicRefaire) refusRefaire = refus;
      else refusDefaire = refus;
    }
  }

  const defaire = () => retourner('defaire');
  const refaire = () => retourner('refaire', undefined, true);

  // Les types d'input qui ne portent pas de texte : aucune frappe à défaire.
  const SANS_TEXTE = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);

  // Vrai quand l'élément cible d'une touche est une saisie de texte, ou dans
  // une fenêtre modale.
  const enSaisie = (cible) =>
    cible instanceof Element &&
    (cible.closest('textarea, select, dialog') !== null ||
      (cible instanceof HTMLInputElement && !SANS_TEXTE.has(cible.type)) ||
      (cible instanceof HTMLElement && cible.isContentEditable));

  onMount(() => {
    const enfonces = new Set();
    const presser = (evenement) => enfonces.add(evenement.pointerId);
    const relacher = (evenement) => enfonces.delete(evenement.pointerId);
    const oublier = () => enfonces.clear();
    const surTouche = (evenement) => {
      const touche = toucheDe(evenement);
      const effet = effetDe('evenement', touche);
      if (effet === null || evenement.repeat || evenement.defaultPrevented) return;
      if (enSaisie(evenement.target) || enfonces.size > 0 || commande === 'format' || $seance.evenement === null) return;
      if (document.querySelector('[data-menu-actions][aria-expanded="true"]') !== null) return;
      evenement.preventDefault();
      retourner(effet, { touche });
    };
    document.addEventListener('keydown', surTouche);
    document.addEventListener('pointerdown', presser, true);
    document.addEventListener('pointerup', relacher, true);
    document.addEventListener('pointercancel', relacher, true);
    window.addEventListener('blur', oublier);
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.removeEventListener('pointerdown', presser, true);
      document.removeEventListener('pointerup', relacher, true);
      document.removeEventListener('pointercancel', relacher, true);
      window.removeEventListener('blur', oublier);
    };
  });
</script>

<div class="corps" data-mode={mode}>
  <div class="barre" role="group" aria-label={t('evenement.barre.commandes')}>
    <div class="ligne">
      <div class="fixe" data-place-fixe>
        {#if commande === 'format'}
          <Refus refus={$seance.refus} />
        {:else if commande === 'modifier'}
          <Commande cle="communs.commande.modifier" nom="modifier" variante="principale" executer={() => seance.passerEnEcriture()} />
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
      {#if libelle !== null}
        <span class="porte-libelle">
          <span class="libelle" class:ecriture={mode === 'ecriture'} class:bloque={mode === 'bloque'} data-mode-libelle="barre"
            >{t(libelle.cle)}</span
          >
        </span>
      {/if}
      {#if commande !== 'format'}
        <div class="historique" data-historique>
          <Commande cle="evenement.commande.defaire" nom="defaire" refusExterne={refusDefaire} executer={defaire} />
          {#if $seance.retours.refaire}
            <Commande cle="evenement.commande.refaire" nom="refaire" refusExterne={refusRefaire} executer={refaire} />
          {/if}
          <button
            type="button"
            class="panneau"
            data-commande="historique"
            aria-expanded={panneauMontre ? 'true' : 'false'}
            aria-controls={panneauMontre ? idHistorique : undefined}
            bind:this={boutonHistorique}
            onkeydown={surToucheBouton}
            onclick={basculerHistorique}
            ><Icone nom="listePoints" /><span class="nom">{t('evenement.commande.historique')}</span></button
          >
        </div>
      {/if}
      {#if outils !== null}
        <div class="outils">
          {@render outils()}
        </div>
      {/if}
      {#if actions !== null}
        <div class="actions">
          {@render actions()}
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
  <div class="travail">
    <div class="surface">
      {@render children()}
    </div>
    {#if panneauMontre}
      <Historique id={idHistorique} fermer={fermerHistorique} />
    {/if}
  </div>
</div>

<style>
  /* Sans trait : rien autour de la surface ne change d'un mode à l'autre,
     et la place fixe ne bouge pas. */
  .corps {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
  }

  /* La barre ne prend jamais toute la hauteur du composant : au-delà, ses
     messages défilent, la place fixe en tête. */
  .barre {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    gap: var(--espace-2);
    max-height: 50%;
    overflow-y: auto;
    padding: var(--espace-1) var(--espace-3);
    border-bottom: 1px solid var(--couleur-carte-filet);
    background-color: var(--couleur-carte-fond-sourd);
    container: barre / inline-size;
  }

  .ligne {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2) var(--espace-3);
  }

  /* Les outils et les actions, centrés sur la hauteur d'une cible
     principale ; les actions calées à droite de leur ligne. */
  .outils,
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    min-height: var(--hauteur-cible);
    gap: var(--espace-2);
  }

  .actions {
    margin-left: auto;
  }

  @container barre (max-width: 80rem) {
    .outils {
      order: 1;
      min-height: 0;
    }
  }

  .fixe {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  /* Le bouton de chaque commande de la barre — celui de la Commande, non
     ceux du refus posé à côté — a la hauteur d'une cible principale. */
  .fixe > :global(div > button),
  .historique > :global(div > button) {
    min-height: var(--hauteur-cible);
  }

  .porte-libelle {
    display: flex;
    align-items: center;
    min-height: var(--hauteur-cible);
  }

  /* Le libellé de mode : une pastille du fond et du filet de la bande de
     mode, d'encre neutre, en gras. */
  .libelle {
    padding: 0.125rem var(--espace-3);
    border: 1px solid var(--couleur-mode-lecture-filet);
    border-radius: var(--rayon-pilule);
    background-color: var(--couleur-mode-lecture-fond);
    color: var(--couleur-page-texte);
    font-weight: bold;
  }

  .libelle.ecriture {
    border-color: var(--couleur-mode-ecriture-filet);
    background-color: var(--couleur-mode-ecriture-fond);
  }

  .libelle.bloque {
    border-color: var(--couleur-mode-bloque-filet);
    background-color: var(--couleur-mode-bloque-fond);
  }

  .historique {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  /* « Historique… » : l'apparence d'une commande discrète — ni fond ni
     filet au repos, le fond sourd de la carte au survol —, haute d'une
     cible principale comme ses voisines, son icône devant son libellé.
     Ouvert, il prend le filet et le fond d'une commande secondaire : la
     barre, du fond sourd de la carte, ne le distinguerait pas sinon. */
  .panneau {
    display: inline-flex;
    align-items: center;
    gap: var(--espace-1);
    min-height: var(--hauteur-cible);
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid transparent;
    border-radius: var(--rayon-2);
    background-color: transparent;
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
    cursor: pointer;
  }

  .panneau:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  .panneau[aria-expanded='true'] {
    border-color: var(--couleur-page-filet);
    background-color: var(--couleur-carte-fond);
  }

  .panneau:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  /* Dans une barre de téléphone, l'icône seule, dans une cible carrée de la
     hauteur d'une cible principale ; le libellé, une boîte d'un pixel,
     rognée, qui ne pousse rien, nomme encore le bouton. */
  @container barre (max-width: 30rem) {
    .panneau {
      justify-content: center;
      min-width: var(--hauteur-cible);
      padding-inline: 0;
    }

    .nom {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }
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

  /* La tête ne prend jamais plus de 35 % du composant : au-delà, elle défile,
     et la surface garde sa place. Elle n'a pas de retrait en bas : le trait
     des onglets de la navigation se pose sur son filet. */
  .tete {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    gap: var(--espace-2);
    max-height: 35%;
    overflow-y: auto;
    padding: var(--espace-2) var(--espace-3) 0;
    border-bottom: 1px solid var(--couleur-carte-filet);
    background-color: var(--couleur-carte-fond);
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
     place des annonces à droite. La ligne a la hauteur du plus haut des
     deux : le contenu de la tête, ou la zone des annonces. La place prend
     une part fixe de la largeur, et le contenu le reste :
     la zone ne bouge pas d'une section à l'autre, quand le libellé de la
     section ouverte, en gras, change la largeur de la navigation. Sa part,
     32 %, laisse au contenu 886 px dans une fenêtre de 1 366 px : les neuf
     onglets et les blancs entre les phases y tiennent sur une ligne, quelle
     que soit la section ouverte, la plus large en demandant 885. Une tête
     de moins de 70rem — celle d'une fenêtre de 1 024 px — passe la place
     à la ligne, sous le contenu, sur toute sa largeur, où un avertissement
     d'une phrase tient en deux lignes, son action à côté. La tête est pour
     cela un conteneur de largeur. */
  .tete.cote {
    flex-flow: row wrap;
    container: tete / inline-size;
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
    padding-top: var(--espace-2);
  }

  .place {
    flex: 0 0 32%;
    min-width: 16rem;
    min-height: 3rem;
    border-left: 1px solid var(--couleur-carte-filet);
  }

  /* Passée à la ligne, la place prend toute la largeur de la tête, séparée
     du contenu par un filet au-dessus d'elle. */
  @container tete (max-width: 70rem) {
    .place {
      flex-basis: 100%;
      border-top: 1px solid var(--couleur-carte-filet);
      border-left: none;
    }
  }

  /* Dans la place, la zone a un retrait vertical de 2 px et un plafond,
     retrait compris : 7,25rem tiennent entier, dans la place de 32 % d'une
     fenêtre de 1 366 px, un avertissement de trois lignes de texte et son
     action dessous (Avertissements.svelte). Au-delà, la zone défile, et la
     tête, qui ne grandit pas plus, laisse le reste du composant à la surface. */
  .place > .annonces {
    box-sizing: border-box;
    max-height: 7.25rem;
    padding-block: 0.125rem;
  }

  /* Une zone qui ne porte qu'un message — un seul enfant, qui n'en a qu'un
     lui-même — n'a rien à faire défiler pour en montrer d'autres : son
     plafond, 10rem, tient entier un avertissement de cinq lignes de texte
     et son action dessous. Le plafond de plusieurs messages reste celui
     ci-dessus, et la surface garde sa hauteur devant des avertissements
     nombreux. Ces enfants viennent d'un autre composant : :global les
     soustrait à la portée des styles de celui-ci. */
  .place > .annonces:has(> :global(:only-child > :only-child)) {
    max-height: 10rem;
  }

  /* Seules — sans tête, en plein écran, ou devant un support rompu —, les
     annonces ne prennent jamais plus du quart du composant, et cèdent d'abord
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
     surface, et gardent leur hauteur jusqu'au quart du composant ; les
     avertissements qui le suivent défilent sous lui. */
  .annonces.rompu {
    flex-shrink: 0;
  }

  /* La zone de travail part des trois quarts du composant, s'étend à ce qui
     reste, et ne rétrécit, après les annonces, que pour la barre et la
     tête. Elle porte la surface et, à sa droite, le panneau d'historique
     ouvert ; conteneur de largeur, elle est le repère du panneau qui passe
     par-dessus la surface (Historique.svelte). */
  .travail {
    display: flex;
    position: relative;
    flex: 1 1 75%;
    min-height: 0;
    container: travail / inline-size;
  }

  /* La surface prend la largeur que le panneau laisse. Sa hauteur ne dépend
     pas de son contenu : elle est un conteneur de taille, dont une section
     borne un panneau à la hauteur visible (unités cqb). */
  .surface {
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    padding: var(--espace-3);
    container-type: size;
  }
</style>
