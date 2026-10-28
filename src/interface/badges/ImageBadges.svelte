<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // L'image sur tous les badges (§ 8.9, § 11.4, data-image-badges) : un
  // réglage de l'événement, non du poste, que le fichier d'état garde avec
  // son image (imageBadgesDe). Chaque geste écrit une entrée et suit les
  // règles de toute écriture : la section des badges vit en lecture, mais
  // ces gestes demandent le mode écriture, et un refus — lecture, plan
  // bloqué — se pose à côté du contrôle, avec son remède.
  //
  // La case « Image sur tous les badges », décochée tant que l'événement ne
  // porte pas l'image, exécute changerImageBadges {active} : un clic, ou la
  // barre d'espace ; à l'issue, la case montre la valeur de la charge,
  // écrite ou inchangée. Cochée, elle montre sous elle, en retrait, la
  // vignette de l'image, ou « Aucune image choisie. », ou, quand l'image
  // que nomme son chemin manque au dossier de l'événement, « Image
  // introuvable » ; puis « Choisir l'image », et, en écriture quand une
  // image est choisie, « Retirer l'image » ; puis le groupe de la position,
  // un bouton radio par position (POSITIONS_IMAGE_BADGES), dont le choix
  // exécute changerImageBadges {position} et revient, refusé, à celui de la
  // charge. Décochée, l'image et la position restent dans l'événement,
  // cachées.
  //
  // « Choisir l'image » suit « Logo » de la fiche d'une personne
  // (LogoFiche.svelte) : le refus courant de la séance avant le dialogue,
  // puis le dialogue des images (facade.choisirImage), la conversion en PNG
  // (image_logo.js) sous l'indicateur d'activité, puis
  // seance.poserImageBadges, le geste tenu du clic à la pose. La même image
  // choisie sous « Image introuvable » réécrit son fichier : la vignette se
  // relit. L'image se lit par seance.lireLogoParticipant, dans tout mode, à
  // chaque changement du chemin, et se montre par une adresse blob:, libérée
  // au démontage comme au chemin suivant.
  import { getContext, onDestroy, tick } from 'svelte';
  import { ErreurCommande } from '../../application/erreurs.js';
  import { POSITIONS_IMAGE_BADGES, imageBadgesDe } from '../../application/seance.js';
  import { suivre } from '../activite.js';
  import { cleDeMode } from '../mode.js';
  import { convertirLogo } from '../participants/image_logo.js';
  import Commande from '../primitives/Commande.svelte';
  import { creerGeste } from '../primitives/geste.js';
  import Refus from '../primitives/Refus.svelte';

  let { charge } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const facade = getContext('facade');
  const uid = $props.id();
  const geste = creerGeste(seance);

  const reglage = $derived(imageBadgesDe(charge));
  // Le chemin seul : une révision qui ne le change pas ne relit rien.
  const chemin = $derived(reglage.chemin);
  const retraitOffert = $derived(cleDeMode($seance) === 'coquille.mode.ecriture');

  // L'image du chemin : etat 'aucun', 'chargement', 'pret' — adresse,
  // l'adresse blob: de ses octets — ou 'introuvable'.
  let image = $state.raw({ etat: 'aucun', adresse: null });
  // Monte à chaque relecture demandée d'un chemin inchangé.
  let relecture = $state(0);
  let section;

  $effect(() => {
    const lu = chemin;
    relecture;
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

  // Une image montrée que le moteur ne lit pas : introuvable, tant que son
  // adresse est la courante.
  function illisible(evenement) {
    if (image.adresse === evenement.currentTarget.getAttribute('src')) image = { etat: 'introuvable', adresse: null };
  }

  // Le refus du dernier geste de la case ou de la position, { controle,
  // refus }, posé à côté de son contrôle.
  let refusGeste = $state.raw(null);

  // Le clic sur la case : la séance écrit la valeur contraire de celle de la
  // charge ; à l'issue, la case montre celle de la charge.
  async function basculer(evenement) {
    const caseACocher = evenement.currentTarget;
    refusGeste = null;
    try {
      await seance.executer('changerImageBadges', { active: !imageBadgesDe(charge).active });
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refusGeste = { controle: 'case', refus: { code: erreur.code, details: erreur.details ?? {} } };
    } finally {
      caseACocher.checked = imageBadgesDe(charge).active;
    }
  }

  // Le choix d'une position : la séance l'écrit ; à l'issue, chaque bouton
  // montre la position de la charge, écrite ou inchangée.
  async function placer(evenement) {
    const groupe = evenement.currentTarget.closest('fieldset');
    const { value: position } = evenement.currentTarget;
    refusGeste = null;
    try {
      await seance.executer('changerImageBadges', { position });
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refusGeste = { controle: 'position', refus: { code: erreur.code, details: erreur.details ?? {} } };
    } finally {
      const courante = imageBadgesDe(charge).position;
      for (const bouton of groupe.querySelectorAll('input[type="radio"]')) bouton.checked = bouton.value === courante;
    }
  }

  // « Choisir l'image » : le refus courant de la séance avant le dialogue,
  // puis le choix, la conversion et la pose, le geste tenu de bout en bout.
  async function choisir() {
    const { refus } = seance.etat();
    if (refus !== null) throw new ErreurCommande(refus.code, refus.details);
    geste.tenir(true);
    try {
      const choisi = await facade.choisirImage();
      if (choisi === null) return;
      const octets = await suivre(() => convertirLogo(choisi.octets, { fichier: choisi.nom }));
      try {
        await seance.poserImageBadges({ octets });
      } catch (erreur) {
        if (erreur?.code !== 'SANS_EFFET' || image.etat !== 'introuvable') throw erreur;
        relecture += 1;
      }
    } finally {
      geste.tenir(false);
    }
  }

  // « Retirer l'image » ; aboutie, le focus laissé au document va à
  // « Choisir l'image ».
  async function retirer() {
    await seance.executer('changerImageBadges', { chemin: null });
    await tick();
    const actuel = document.activeElement;
    if (actuel !== null && actuel !== document.body) return;
    section?.querySelector('[data-commande="choisirImageBadges"]')?.focus();
  }

  onDestroy(() => geste.liberer());
</script>

<div bind:this={section} class="image" data-image-badges>
  <div class="case">
    <input
      id={`${uid}-case`}
      type="checkbox"
      data-champ="imageBadges"
      checked={reglage.active}
      aria-describedby={refusGeste?.controle === 'case' ? `${uid}-case-refus` : undefined}
      onclick={basculer}
    />
    <label for={`${uid}-case`}>{t('badges.image.case')}</label>
  </div>
  {#if refusGeste?.controle === 'case'}
    <Refus id={`${uid}-case-refus`} refus={refusGeste.refus} lever={() => (refusGeste = null)} />
  {/if}
  {#if reglage.active}
    <div class="reglages-image">
      {#if image.etat === 'pret'}
        <div class="vignette" data-image-vignette>
          <img src={image.adresse} alt={t('badges.image.vignette')} onerror={illisible} />
        </div>
      {:else if image.etat === 'introuvable'}
        <p data-image-introuvable>{t('badges.image.introuvable')}</p>
      {:else if image.etat === 'aucun'}
        <p data-image-absente>{t('badges.image.aucune')}</p>
      {/if}
      <div class="boutons">
        <Commande cle="badges.image.choisir" nom="choisirImageBadges" executer={choisir} />
        {#if retraitOffert && chemin !== null}
          <Commande cle="badges.image.retirer" nom="retirerImageBadges" executer={retirer} />
        {/if}
      </div>
      <fieldset class="positions" data-position-image>
        <legend>{t('badges.image.position')}</legend>
        <div class="options">
          {#each POSITIONS_IMAGE_BADGES as position (position)}
            <div class="option">
              <input
                id={`${uid}-position-${position}`}
                type="radio"
                name={`${uid}-position`}
                value={position}
                data-champ="positionImage"
                checked={reglage.position === position}
                aria-describedby={refusGeste?.controle === 'position' ? `${uid}-position-refus` : undefined}
                onchange={placer}
              />
              <label for={`${uid}-position-${position}`}>{t(`badges.image.position.${position}`)}</label>
            </div>
          {/each}
        </div>
        {#if refusGeste?.controle === 'position'}
          <Refus id={`${uid}-position-refus`} refus={refusGeste.refus} lever={() => (refusGeste = null)} />
        {/if}
      </fieldset>
    </div>
  {/if}
</div>

<style>
  /* La case, puis, cochée, ses réglages en retrait, alignés sur le texte du
     pied TechnoLibre : l'image ou sa phrase, les commandes, la position. */
  .image {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
  }

  .case,
  .option {
    display: flex;
    align-items: center;
    gap: var(--espace-2);
  }

  .case input,
  .option input {
    margin: 0;
  }

  .reglages-image {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    padding-left: var(--espace-5);
  }

  p {
    margin: 0;
    color: var(--couleur-page-texte-secondaire);
  }

  /* La vignette : l'image dans 6 rem de haut, sur le papier des badges,
     cernée du filet de la carte, comme le logo d'une fiche. */
  .vignette {
    max-width: 100%;
    padding: var(--espace-1);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-papier);
  }

  .vignette img {
    display: block;
    max-width: 100%;
    max-height: 6rem;
    object-fit: contain;
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  /* Le groupe de la position : sa légende en petites capitales d'encre
     secondaire, comme l'intitulé des cases, puis les boutons en rangée qui
     se replie. */
  .positions {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  legend {
    padding: 0 0 var(--espace-1);
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  .options {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2) var(--espace-5);
  }
</style>
