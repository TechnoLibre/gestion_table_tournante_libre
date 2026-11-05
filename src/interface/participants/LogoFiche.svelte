<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La rubrique « Logo » de la fiche d'une personne (§ 8.9, § 10.2,
  // data-logo-fiche) : sous l'intitulé, la vignette de son logo, ou « Aucun
  // logo. », ou, quand l'image que nomme son chemin manque au dossier de
  // l'événement, « Logo introuvable » ; puis « Logo », qui pose ou remplace
  // le logo, et, en écriture hors d'un plan bloqué, « Retirer le logo ».
  // Fiche.svelte la recrée pour chaque personne ({#key}) : une rubrique ne
  // sert qu'une personne, et le refus, la vue grande ou l'image d'une autre
  // n'y restent jamais.
  //
  // L'image se lit par seance.lireLogoParticipant, dans tout mode, à chaque
  // changement du chemin — un geste, Défaire, une écriture venue d'ailleurs —
  // et se montre par une adresse blob:, libérée au démontage comme au
  // chemin suivant ; une lecture qui revient après eux ne se pose nulle
  // part. Un chemin sans image, ou une image que le moteur ne lit pas, se dit
  // « Logo introuvable ».
  //
  // « Logo » refuse d'abord, à côté du bouton, ce que la séance refuserait
  // — lecture, plan bloqué —, avec son remède, avant que le dialogue
  // s'ouvre. Puis le dialogue des images (facade.choisirImage), qui refuse
  // une image trop lourde sans la lire ; un dialogue fermé sans choix ne fait
  // rien. Puis la conversion en PNG (image_logo.js), sous l'indicateur
  // d'activité, qui refuse une image illisible ou de trop de pixels ; puis
  // seance.poserLogoParticipant. Chaque refus se pose à côté de « Logo »
  // (Commande), sauf celui du même logo choisi sous « Logo introuvable » :
  // la séance a réécrit son image, que la rubrique relit. Le geste reste ouvert du clic à la pose : le compte
  // d'inactivité ne ramène pas la séance en lecture pendant le choix.
  // L'image choisie va à la personne qui l'a demandée, même quand la fiche
  // est passée à une autre entre-temps. « Retirer le logo » retire le
  // chemin ; aboutie, quand le bouton disparu a laissé le focus au
  // document, elle le porte à « Logo ».
  //
  // La vignette est un bouton, nommé « Agrandir le logo de <personne> »,
  // dont l'image tient dans 6 rem de haut sur le papier blanc des badges, en
  // clair comme en sombre : un logo sombre sur fond transparent s'y voit.
  // Cliquée, elle laisse place, dans la fiche même — aucune fenêtre ne
  // s'ouvre —, à l'image à la largeur de la rubrique, proportions gardées,
  // puis à « Fermer », qui reçoit le focus ; « Fermer », ou Échap dans la
  // vue, rend la vignette et son focus. La vue se lit en lecture et sur un
  // plan bloqué comme en écriture. Un autre chemin la referme : l'image qui
  // le suit se montre en vignette, et le focus resté dans la rubrique va à
  // « Logo ».
  import { getContext, onDestroy, tick, untrack } from 'svelte';
  import { ErreurCommande } from '../../application/erreurs.js';
  import { nomAffiche } from '../../application/personnes.js';
  import { suivre } from '../activite.js';
  import { cleDeMode } from '../mode.js';
  import Commande from '../primitives/Commande.svelte';
  import { creerGeste } from '../primitives/geste.js';
  import { effetDe } from '../raccourcis.js';
  import { convertirLogo } from './image_logo.js';

  let { participant } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const facade = getContext('facade');
  const uid = $props.id();
  const geste = creerGeste(seance);

  const nom = $derived(nomAffiche(participant));
  // Le chemin seul : une révision qui ne le change pas ne relit rien.
  const chemin = $derived(participant.logo ?? null);
  const retraitOffert = $derived(cleDeMode($seance) === 'coquille.mode.ecriture');

  // L'image du chemin : etat 'aucun', 'chargement', 'pret' — adresse,
  // l'adresse blob: de ses octets — ou 'introuvable'.
  let image = $state.raw({ etat: 'aucun', adresse: null });
  let agrandi = $state(false);
  // Monte à chaque relecture demandée d'un chemin inchangé.
  let relecture = $state(0);
  let section;
  let vignette = $state(null);
  let fermer = $state(null);

  $effect(() => {
    const lu = chemin;
    relecture;
    untrack(refermerVue);
    if (lu === null) {
      image = { etat: 'aucun', adresse: null };
      return undefined;
    }
    let vivant = true;
    let adresse = null;
    image = { etat: 'chargement', adresse: null };
    seance.lireLogoParticipant(lu).then(
      (octets) => {
        if (!vivant) return;
        if (octets === null) {
          image = { etat: 'introuvable', adresse: null };
          return;
        }
        adresse = URL.createObjectURL(new Blob([octets], { type: 'image/png' }));
        image = { etat: 'pret', adresse };
      },
      (erreur) => {
        if (!vivant) return;
        if (typeof erreur?.code !== 'string') throw erreur;
        image = { etat: 'introuvable', adresse: null };
      },
    );
    return () => {
      vivant = false;
      if (adresse !== null) URL.revokeObjectURL(adresse);
    };
  });

  // La vue grande refermée au changement de chemin ; le focus qui était dans
  // la rubrique, et qu'un bouton disparu laisse au document, va à « Logo ».
  function refermerVue() {
    if (!agrandi) return;
    const dedans = section?.contains(document.activeElement) ?? false;
    agrandi = false;
    if (dedans) tick().then(() => section?.querySelector('[data-commande="choisirLogo"]')?.focus());
  }

  // Une image montrée que le moteur ne lit pas : introuvable, tant que son
  // adresse est la courante.
  function illisible(evenement) {
    if (image.adresse === evenement.currentTarget.getAttribute('src')) image = { etat: 'introuvable', adresse: null };
  }

  // « Logo » : le refus courant de la séance avant le dialogue, puis le
  // choix, la conversion et la pose, le geste tenu de bout en bout.
  async function choisir() {
    const id = participant.id;
    const { refus } = seance.etat();
    if (refus !== null) throw new ErreurCommande(refus.code, refus.details);
    geste.tenir(true);
    try {
      const choisi = await facade.choisirImage();
      if (choisi === null) return;
      const octets = await suivre(() => convertirLogo(choisi.octets, { fichier: choisi.nom }));
      try {
        await seance.poserLogoParticipant({ id, octets });
      } catch (erreur) {
        if (erreur?.code !== 'SANS_EFFET' || image.etat !== 'introuvable') throw erreur;
        relecture += 1;
      }
    } finally {
      geste.tenir(false);
    }
  }

  // « Retirer le logo » ; aboutie, le focus laissé au document va à « Logo ».
  async function retirer() {
    await seance.retirerLogoParticipant({ id: participant.id });
    await tick();
    const actuel = document.activeElement;
    if (actuel !== null && actuel !== document.body) return;
    section?.querySelector('[data-commande="choisirLogo"]')?.focus();
  }

  async function agrandir() {
    agrandi = true;
    await tick();
    fermer?.focus();
  }

  async function reduire() {
    agrandi = false;
    await tick();
    vignette?.focus();
  }

  // Échap, des contrôles de la vue jusqu'à elle, rend la vignette.
  function surToucheVue(evenement) {
    if (effetDe('fenetre', evenement.key) !== 'fermer') return;
    evenement.preventDefault();
    reduire();
  }

  onDestroy(() => geste.liberer());
</script>

<section bind:this={section} class="logo" data-logo-fiche aria-labelledby={`${uid}-titre-logo`}>
  <h4 id={`${uid}-titre-logo`}>{t('participants.fiche.logo')}</h4>
  {#if image.etat === 'pret' && agrandi}
    <!-- Échap remonte de « Fermer » jusqu'à la vue, qui se referme ; un clic
         sur l'image laisse le focus à la vue (tabindex -1). -->
    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_no_noninteractive_tabindex -->
    <div class="agrandi" data-logo-agrandi tabindex="-1" onkeydown={surToucheVue}>
      <img src={image.adresse} alt={t('participants.logo.image', { nom })} />
      <button bind:this={fermer} type="button" data-commande="fermerLogo" onclick={reduire}>
        {t('participants.logo.fermer')}
      </button>
    </div>
  {:else if image.etat === 'pret'}
    <button
      bind:this={vignette}
      type="button"
      class="vignette"
      data-logo-vignette
      aria-label={t('participants.logo.agrandir', { nom })}
      onclick={agrandir}
    >
      <img src={image.adresse} alt="" onerror={illisible} />
    </button>
  {:else if image.etat === 'introuvable'}
    <p data-logo-introuvable>{t('participants.logo.introuvable')}</p>
  {:else if image.etat === 'aucun'}
    <p data-logo-absent>{t('participants.fiche.aucunLogo')}</p>
  {/if}
  <div class="boutons">
    <Commande
      cle="participants.logo.choisir"
      nom="choisirLogo"
      nomAccessible={t('participants.logo.choisirNomme', { nom })}
      executer={choisir}
    />
    {#if retraitOffert && chemin !== null}
      <Commande cle="participants.logo.retirer" nom="retirerLogo" executer={retirer} />
    {/if}
  </div>
</section>

<style>
  /* L'intitulé en petites capitales, l'image ou sa phrase, puis les
     commandes sur une ligne qui se replie. */
  .logo {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    margin: var(--espace-3) 0;
  }

  h4 {
    margin: 0;
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  p {
    margin: 0;
    color: var(--couleur-page-texte-secondaire);
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  /* La vignette : l'image dans 6 rem de haut, sur le papier des badges,
     cernée du filet de la carte. */
  .vignette {
    align-self: flex-start;
    max-width: 100%;
    padding: var(--espace-1);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-papier);
    cursor: zoom-in;
  }

  .vignette img {
    display: block;
    max-width: 100%;
    max-height: 6rem;
    object-fit: contain;
  }

  /* La vue grande : l'image à la largeur de la rubrique, sur le papier,
     puis « Fermer ». */
  .agrandi {
    outline: none;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  .agrandi img {
    box-sizing: border-box;
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-papier);
  }

  .vignette:focus-visible,
  .agrandi button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .agrandi button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    cursor: pointer;
  }

  .agrandi button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }
</style>
