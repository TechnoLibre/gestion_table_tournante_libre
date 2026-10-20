<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // L'en-tête de l'événement ouvert, en tête de la tête
  // (SurfaceEvenement.svelte) : son nom, puis, sur la même ligne tant qu'elle
  // a la place, son résumé — la date quand il en a une, les participants, les
  // tables et leurs sièges, les tours (resumeEvenement, modele.js) —, d'encre
  // secondaire. Le nom se coupe où il le faut, même sans espace : un nom
  // long de glyphes larges passe à la ligne au lieu d'élargir la page. Le
  // résumé passe à la ligne entre ses éléments, jamais dans l'un d'eux.
  import { getContext } from 'svelte';
  import { resumeEvenement } from './modele.js';

  const t = getContext('t');
  const format = getContext('format');
  const seance = getContext('seance');

  const resume = $derived(resumeEvenement($seance));
</script>

<header class="entete">
  <h1>{$seance.evenement?.nom}</h1>
  {#if resume !== null}
    <p class="resume">
      {#if resume.date !== null}
        <span>{format.date(resume.date)}</span>
      {/if}
      <span>{t('evenement.resume.participants', { participants: resume.participants })}</span>
      <span>{t('evenement.resume.tables', { tables: resume.tables, sieges: resume.sieges })}</span>
      <span>{t('evenement.resume.tours', { tours: resume.tours })}</span>
    </p>
  {/if}
</header>

<style>
  .entete {
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 var(--espace-4);
  }

  h1 {
    min-width: 0;
    margin: 0;
    font-size: var(--taille-titre-grand);
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .resume {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--espace-4);
    margin: 0;
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }
</style>
