<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script module>
  import { presDe } from './menu.js';

  // Le reste d'une série de clics, retenu après l'exécution d'un élément au
  // pointeur (absorberSerie). L'état vit avec le module, hors de la vie d'un
  // menu : l'élément qui ouvre une autre section démonte son menu avant que
  // le second clic n'arrive, et l'écoute lui survit.
  //
  // Une écoute du document, en capture, retient chaque mousedown, mouseup,
  // click et dblclick dont detail dépasse 1, sans effet par défaut — focus
  // compris — ni propagation. pointerdown et pointerup portent toujours
  // detail 0 : ils se retiennent par leur point, à RAYON_SERIE px au plus de
  // celui du clic qui pose l'écoute, sans propagation ; leur effet par défaut
  // reste, car l'annuler supprimerait le mousedown qui suit, et avec lui
  // l'appui de detail 1 qui retire l'écoute : un appui proche, dans le délai,
  // que le système compte déjà pour un clic neuf, perd ainsi son seul
  // pointerdown. Le premier mousedown, mouseup ou click de detail 1 retire
  // l'écoute et passe ; DELAI_SERIE ms sans appui retenu la retirent aussi,
  // comptés par l'horloge du menu qui la pose (horloge.js), et la minuterie
  // part avec l'écoute.

  // Le délai de double-clic par défaut le plus répandu, en ms.
  const DELAI_SERIE = 500;
  // L'écart, en px sur chaque axe, d'un appui au clic qui pose l'écoute.
  const RAYON_SERIE = 8;
  const TYPES_DETAIL = ['mousedown', 'mouseup', 'click', 'dblclick'];
  const TYPES_POINT = ['pointerdown', 'pointerup'];
  // L'écoute posée : { x, y, horloge, minuterie }, le point du clic qui la
  // pose, l'horloge qui arme sa minuterie et la minuterie ; null sans elle.
  let absorption = null;

  function absorber(evenement) {
    if (TYPES_POINT.includes(evenement.type)) {
      if (presDe(evenement, absorption, RAYON_SERIE)) evenement.stopPropagation();
    } else if (evenement.detail > 1) {
      evenement.preventDefault();
      evenement.stopPropagation();
      // Un appui retenu rouvre le délai : le clic suivant d'une série plus
      // longue reste retenu.
      if (evenement.type === 'mousedown') armer();
    } else if (evenement.detail === 1) {
      retirerAbsorption();
    }
  }

  function armer() {
    absorption.horloge.annuler(absorption.minuterie);
    absorption.minuterie = absorption.horloge.planifier(retirerAbsorption, DELAI_SERIE);
  }

  // Pose l'écoute au point du clic reçu, ou l'y déplace quand elle est déjà
  // posée ; horloge arme sa minuterie, et remplace celle qui l'armait. Le
  // clic qui l'installe a déjà franchi le document.
  function absorberSerie(clic, horloge) {
    if (absorption === null) {
      absorption = { x: clic.clientX, y: clic.clientY, horloge, minuterie: null };
      for (const type of [...TYPES_DETAIL, ...TYPES_POINT]) document.addEventListener(type, absorber, true);
    } else {
      absorption.horloge.annuler(absorption.minuterie);
      Object.assign(absorption, { x: clic.clientX, y: clic.clientY, horloge, minuterie: null });
    }
    armer();
  }

  function retirerAbsorption() {
    if (absorption === null) return;
    absorption.horloge.annuler(absorption.minuterie);
    for (const type of [...TYPES_DETAIL, ...TYPES_POINT]) document.removeEventListener(type, absorber, true);
    absorption = null;
  }
</script>

<script>
  // Un menu d'actions (§ 2.1, § 14.5, § 14.6) : un bouton « Actions » qui
  // ouvre un menu de commandes, selon le motif du bouton de menu de
  // WAI-ARIA. Le bouton porte aria-haspopup="menu", aria-expanded et
  // aria-controls, l'id du menu ; le menu, role="menu", toujours présent,
  // caché et vide tant qu'il est fermé, se nomme par le bouton
  // (aria-labelledby). Ouvert, chacun de ses éléments est un bouton
  // role="menuitem", hors de l'ordre de Tab (tabindex -1), qui porte
  // data-commande, sa désignation (menu.js).
  //
  // nomAccessible, déjà traduit, nomme le bouton : sur un écran qui en pose
  // plusieurs, il dit lequel — « Actions de la proposition n° 4 ». elements :
  // les éléments du menu, dans leur ordre (menu.js) ; une liste vide, ou une
  // désignation en double, lève RangeError au montage. gestes : ceux que
  // reçoit le remède d'un refus (Refus).
  //
  // Le clic sur le bouton ouvre le menu, le focus sur son premier élément, et
  // le referme quand il est ouvert ; le clic répété d'une série — detail
  // au-delà de 1 — n'y change rien, et son appui ne déplace pas le focus. Au
  // clavier, les touches se lisent par effetDe : sur le bouton, Entrée,
  // l'espace et la flèche bas ouvrent le menu sur son premier élément, la
  // flèche haut sur le dernier ; dans le menu, les flèches passent d'un
  // élément à l'autre en bouclant, Début et Fin vont aux bouts
  // (rangOuverture, rangApres), Échap ferme le menu et rend le focus au
  // bouton. Le menu se ferme dès que le focus le quitte pour un contrôle hors
  // de lui : Tab et Maj+Tab le ferment ainsi, le focus passant au contrôle
  // suivant ou au bouton. Seul un focus porté sur le bouton lui-même, par le
  // bouton principal du pointeur, laisse le menu ouvert : le clic qui suit le
  // referme. Un autre bouton du pointeur ne donne aucun clic, et le focus
  // qu'il porte sur le bouton ferme le menu. Un appui relâché hors du bouton
  // ne donne pas ce clic, et le menu reste ouvert, le focus sur le bouton :
  // Échap l'y ferme, et le focus qui quitte le bouton pour un contrôle hors
  // du menu le ferme aussi. Un appui sur le pointeur hors du menu et de son
  // bouton le ferme, même quand il ne déplace pas le focus : le focus revient
  // au bouton, puis va où l'appui le porte. Un appui que la répétition
  // automatique émet — keydown dont repeat est vrai — ne rouvre pas le menu.
  //
  // Un élément s'exécute par son clic, celui qu'Entrée et l'espace donnent
  // au bouton qui a le focus, une seule fois même tenues (commande.js,
  // contexte 'commande') : le menu se ferme et le focus revient au bouton
  // avant le geste, qui trouve le focus là où il se rendra — une fenêtre
  // qui s'ouvre le rend au bouton en se fermant. La machine d'une commande
  // (creerMachineCommande) tient le menu entier : le clic répété d'une série
  // est sans effet, et pendant qu'une exécution qui rend une promesse
  // s'achève, aucun élément ne s'exécute ; le bouton porte alors aria-busy
  // et aria-disabled, dessiné d'un filet tireté, et quand le menu se
  // rouvre, chaque élément porte aria-disabled, l'élément en cours aria-busy
  // aussi.
  //
  // Le menu fermé par l'exécution d'un élément au pointeur, le reste de la
  // série de clics tomberait sur ce que le menu couvrait : le bouton d'un
  // autre menu, une section qui vient de s'ouvrir. Une écoute du document le
  // retient alors (absorberSerie, plus haut), jusqu'au premier appui de
  // detail 1, qui ouvre une série neuve, ou la fin du délai de double-clic.
  //
  // Un refus — une erreur qui porte un code — se pose à côté du bouton, avec
  // son remède, et y reste, menu fermé ; le bouton le désigne par
  // aria-describedby. Le remède se nomme par le nom accessible de l'élément
  // refusé, ou à défaut par nomAccessible (Refus, objet) ; abouti, il retire
  // le refus et rend le focus au bouton. L'exécution suivante d'un élément le
  // retire aussi. Une erreur sans code n'est pas un refus et remonte.
  //
  // Le menu ouvert se pose dans la fenêtre, en position fixe, sous le bouton
  // ou au-dessus quand il n'y tient pas (placerInfobulle) : un conteneur qui
  // défile ne le rogne pas. Sa place se recalcule à chaque défilement — un
  // conteneur défilant compris, que l'écoute en capture atteint — et à
  // chaque redimensionnement.
  import { flushSync, getContext, tick, untrack } from 'svelte';
  import { effetDe } from '../raccourcis.js';
  import { creerMachineCommande } from './commande.js';
  import Icone from './Icone.svelte';
  import { placerInfobulle } from './infobulle.js';
  import { designationDe, exigerElements, rangApres, rangOuverture } from './menu.js';
  import Refus from './Refus.svelte';

  let { nomAccessible, elements, gestes = {} } = $props();

  const t = getContext('t');
  const horloge = getContext('horloge');
  const uid = $props.id();
  const idBouton = `${uid}-bouton`;
  const idMenu = `${uid}-menu`;
  const idRefus = `${uid}-refus`;
  const machine = creerMachineCommande();

  // Les éléments se vérifient au montage, puis à chaque liste reçue.
  untrack(() => exigerElements(elements));
  const liste = $derived(exigerElements(elements));

  let ouvert = $state(false);
  // La désignation de l'élément dont l'exécution s'achève, null sans elle.
  let enCours = $state(null);
  // Le refus affiché : {code, details, objet}, null sans lui.
  let refus = $state(null);
  // Le coin haut gauche du menu dans la fenêtre, en px ; null fermé.
  let place = $state(null);
  // Vrai quand le menu était ouvert à l'appui du pointeur sur le bouton :
  // le clic qui suit le laisse fermé. Un relâcher hors du bouton, ou un
  // appui annulé, le remet à faux : aucun clic ne suivra.
  let ouvertALAppui = false;

  let bouton = $state(null);
  let menu = $state(null);

  const lever = () => (refus = null);

  // Les éléments rendus du menu, dans leur ordre.
  const elementsRendus = () => [...(menu?.querySelectorAll('[role="menuitem"]') ?? [])];

  function placer() {
    if (!ouvert || bouton === null || menu === null) return;
    const a = bouton.getBoundingClientRect();
    const b = menu.getBoundingClientRect();
    const fenetre = document.documentElement;
    place = placerInfobulle(
      { gauche: a.left, haut: a.top, droite: a.right, bas: a.bottom },
      { largeur: b.width, hauteur: b.height },
      { largeur: fenetre.clientWidth, hauteur: fenetre.clientHeight },
    );
  }

  // Ouvre le menu, le place, puis porte le focus sur son élément de rang
  // rang. Le menu est en position fixe : le focus ne fait défiler aucun
  // conteneur, qui déplacerait le bouton sous le menu déjà placé.
  function ouvrir(rang) {
    ouvert = true;
    flushSync();
    placer();
    elementsRendus()[rang]?.focus({ preventScroll: true });
  }

  function fermer() {
    ouvert = false;
    place = null;
  }

  function fermerVersBouton() {
    fermer();
    bouton?.focus();
  }

  // Le menu ouvert, un appui sur le bouton attend son relâcher : sous le
  // bouton, le clic qui suit décide ; ailleurs, ou annulé, aucun clic ne
  // vient. Le point du relâcher se lit sous le pointeur, car un doigt garde
  // pour cible le bouton qu'il a touché. Un appui d'un autre bouton que le
  // principal ne donne aucun clic : il est ignoré.
  function appuiBouton(evenement) {
    if (evenement.button !== 0) return;
    ouvertALAppui = ouvert;
    if (!ouvert) return;
    const fin = new AbortController();
    const relache = (evenement) => {
      fin.abort();
      const sous = evenement.type === 'pointerup' ? document.elementFromPoint(evenement.clientX, evenement.clientY) : null;
      if (!bouton?.contains(sous)) ouvertALAppui = false;
    };
    document.addEventListener('pointerup', relache, { capture: true, signal: fin.signal });
    document.addEventListener('pointercancel', relache, { capture: true, signal: fin.signal });
  }

  // L'appui répété d'une série laisse le focus où il est : dans le menu
  // qu'ouvre le premier clic d'un double-clic, il reste sur son élément.
  function appuiRepeteBouton(evenement) {
    if (evenement.detail > 1) evenement.preventDefault();
  }

  function clicBouton(evenement) {
    const fermeParAppui = ouvertALAppui;
    ouvertALAppui = false;
    if (evenement.detail > 1) return;
    if (ouvert || fermeParAppui) fermer();
    else ouvrir(0);
  }

  // Le focus quitte le bouton, menu ouvert : vers un contrôle hors du menu,
  // le menu se ferme.
  function sortieBouton(evenement) {
    const vers = evenement.relatedTarget;
    if (!ouvert || (vers !== null && menu?.contains(vers))) return;
    fermer();
  }

  function toucheBouton(evenement) {
    if (ouvert && effetDe('menu', evenement.key) === 'fermer') {
      evenement.preventDefault();
      fermer();
      return;
    }
    const effet = effetDe('boutonMenu', evenement.key);
    if (effet === null) return;
    evenement.preventDefault();
    if (evenement.repeat) return;
    ouvrir(rangOuverture(effet, liste.length));
  }

  function toucheMenu(evenement) {
    if (evenement.repeat && effetDe('commande', evenement.key) === 'activer') {
      evenement.preventDefault();
      return;
    }
    const effet = effetDe('menu', evenement.key);
    if (effet === null) return;
    if (effet === 'quitter') return; // le focus part, et focusout ferme le menu
    evenement.preventDefault();
    if (effet === 'fermer') {
      fermerVersBouton();
      return;
    }
    const rendus = elementsRendus();
    const rang = rendus.indexOf(document.activeElement);
    rendus[rangApres(effet, rang === -1 ? 0 : rang, rendus.length)]?.focus({ preventScroll: true });
  }

  // Le focus quitte le menu : vers un contrôle hors de lui, le menu se
  // ferme, sauf vers le bouton au pointeur, dont le clic décide.
  function sortieMenu(evenement) {
    const vers = evenement.relatedTarget;
    if (vers !== null && menu?.contains(vers)) return;
    if (vers === bouton && ouvertALAppui) return;
    fermer();
  }

  // Un appui du pointeur hors du menu et de son bouton le ferme. Le focus,
  // dans le menu, revient au bouton avant que l'élément qui le porte ne
  // disparaisse ; l'appui le porte ensuite là où il se pose, et un appui qui
  // retient le focus le laisse au bouton.
  $effect(() => {
    if (!ouvert) return;
    const appui = (evenement) => {
      if (menu?.contains(evenement.target) || bouton?.contains(evenement.target)) return;
      const dedans = menu?.contains(document.activeElement) ?? false;
      fermer();
      if (dedans) bouton?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', appui, true);
    return () => document.removeEventListener('pointerdown', appui, true);
  });

  async function activer(element, evenement) {
    const { action } = machine.cliquer({ repete: evenement.detail > 1 });
    if (action !== 'executer') return;
    // Un clic du clavier porte detail 0 : aucune série ne le suit.
    if (evenement.detail > 0) absorberSerie(evenement, horloge);
    fermerVersBouton();
    refus = null;
    try {
      const rendu = element.executer();
      if (typeof rendu?.then === 'function') {
        enCours = designationDe(element);
        await rendu;
      }
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refus = { code: erreur.code, details: erreur.details ?? {}, objet: element.nomAccessible ?? nomAccessible };
      await tick();
      const actif = document.activeElement;
      if ((actif === null || actif === document.body) && bouton?.isConnected) bouton.focus();
    } finally {
      machine.terminer();
      enCours = null;
    }
  }
</script>

<svelte:window onscrollcapture={placer} onresize={placer} />

<div class="menu-actions">
  <button
    bind:this={bouton}
    type="button"
    id={idBouton}
    data-menu-actions
    aria-haspopup="menu"
    aria-expanded={ouvert ? 'true' : 'false'}
    aria-controls={idMenu}
    aria-label={nomAccessible}
    aria-describedby={refus === null ? undefined : idRefus}
    aria-busy={enCours === null ? undefined : 'true'}
    aria-disabled={enCours === null ? undefined : 'true'}
    onpointerdown={appuiBouton}
    onmousedown={appuiRepeteBouton}
    onclick={clicBouton}
    onkeydown={toucheBouton}
    onfocusout={sortieBouton}
    >{t('communs.menu.actions')}<span class="chevron"><Icone nom="chevron" taille={14} /></span></button
  >
  <div
    bind:this={menu}
    class="menu"
    role="menu"
    id={idMenu}
    aria-labelledby={idBouton}
    hidden={!ouvert}
    tabindex="-1"
    style:left={place === null ? null : `${place.gauche}px`}
    style:top={place === null ? null : `${place.haut}px`}
    onkeydown={toucheMenu}
    onfocusout={sortieMenu}
  >
    {#if ouvert}
      {#each liste as element (designationDe(element))}
        {@const designation = designationDe(element)}
        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          data-commande={designation}
          aria-label={element.nomAccessible ?? undefined}
          aria-busy={enCours === designation ? 'true' : undefined}
          aria-disabled={enCours === null ? undefined : 'true'}
          onclick={(evenement) => activer(element, evenement)}>{t(element.cle, element.details ?? {})}</button
        >
      {/each}
    {/if}
  </div>
  {#if refus !== null}
    <Refus id={idRefus} {refus} {lever} objet={refus.objet} {gestes} />
  {/if}
</div>

<style>
  .menu-actions {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  /* Le bouton : celui d'une commande secondaire, à filet sur le fond de la
     carte, suivi d'un chevron tourné vers le bas. */
  button[data-menu-actions] {
    display: inline-flex;
    align-items: center;
    gap: var(--espace-1);
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
    white-space: nowrap;
    cursor: pointer;
  }

  button[data-menu-actions]:hover,
  button[data-menu-actions][aria-expanded='true'] {
    background-color: var(--couleur-carte-fond-sourd);
  }

  .chevron {
    display: inline-flex;
    transform: rotate(90deg);
  }

  /* Le menu ouvert : une carte posée au-dessus de la page, ses éléments en
     colonne. */
  .menu {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    min-width: 12rem;
    max-width: min(26rem, calc(100% - 16px));
    padding: var(--espace-1);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    box-shadow: var(--ombre-2);
  }

  .menu[hidden] {
    display: none;
  }

  .menu:focus {
    outline: none;
  }

  /* Un élément : la largeur du menu, sans fond ni filet au repos ; le
     survol et le focus lui donnent le fond sourd de la carte. */
  [role='menuitem'] {
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid transparent;
    border-radius: var(--rayon-1);
    background-color: transparent;
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
    text-align: start;
    cursor: pointer;
  }

  [role='menuitem']:hover,
  [role='menuitem']:focus {
    background-color: var(--couleur-carte-fond-sourd);
  }

  button[aria-disabled='true'] {
    border-style: dashed;
    border-color: var(--couleur-page-filet);
    color: var(--couleur-page-texte-secondaire);
    cursor: progress;
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  [role='menuitem']:focus-visible {
    outline-offset: -2px;
  }
</style>
