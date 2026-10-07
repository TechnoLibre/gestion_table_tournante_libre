<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le contenu d'un aperçu d'import (§ 10.1, § 10.2), celui que rend
  // modeleApercu (modele.js) : la source — le nom du fichier, ou le texte
  // collé —, l'encodage et le séparateur nommés, le refus global avec sa
  // cause et son remède, l'association des colonnes et ses ambiguïtés, les
  // lignes valides, les lignes refusées et leur motif, les orthographes
  // fondues, les doublons, les homonymes d'une mise à jour, les cellules sur
  // plusieurs lignes. Le rapport le reprend pour l'aperçu appliqué, ses
  // refus remplacés par ceux du résumé.
  //
  // modele : le modèle ; source : { origine: 'fichier'|'collage', nom } ;
  // participants : ceux de la charge, qui nomment les personnes désignées ;
  // refusees : les lignes refusées à montrer, celles du modèle par défaut ;
  // choisir(champ, rang) : tranche une ambiguïté, null pour un aperçu figé.
  // Chaque donnée — nom de fichier, en-tête, cellule, rang, compte — occupe
  // son propre nœud de texte.
  import { getContext } from 'svelte';
  import { COLONNES_DES_LIGNES, motifLigne, nommer } from './modele.js';

  let { modele, source, participants = [], refusees = null, choisir = null } = $props();

  const t = getContext('t');
  const format = getContext('format');
  const motif = motifLigne(t);

  const refuseesMontrees = $derived(refusees ?? modele.refusees);
  const global = $derived(modele.global);
</script>

<div class="apercu">
  <dl class="source">
    {#if source.origine === 'fichier'}
      <dt>{t('import.apercu.fichier')}</dt>
      <dd data-fichier>{source.nom}</dd>
    {:else}
      <dt data-collage>{t('import.apercu.collage')}</dt>
      <dd></dd>
    {/if}
    {#if modele.encodage !== null}
      <dt>{t('import.apercu.encodage')}</dt>
      <dd data-encodage>{t(modele.encodage)}</dd>
    {/if}
    {#if modele.separateur !== null}
      <dt>{t('import.apercu.separateur')}</dt>
      <dd data-separateur>{t(modele.separateur)}</dd>
    {/if}
  </dl>

  {#if global !== null}
    <div class="refus" role="status" data-refus={global.cle}>
      <p>{t(global.cle, global.details)}</p>
      {#if !global.remede.dansLaCause}
        <p>{t(global.remede.cle, global.remede.details)}</p>
      {/if}
    </div>
  {/if}

  {#if modele.colonnes.length > 0}
    <table class="colonnes" data-colonnes>
      <caption>{t('import.apercu.colonnes')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('import.apercu.entete')}</th>
          <th scope="col">{t('import.apercu.devient')}</th>
        </tr>
      </thead>
      <tbody>
        {#each modele.colonnes as colonne (colonne.rang)}
          <tr data-colonne={colonne.rang}>
            <td data-entete>{colonne.entete}</td>
            <td data-devient>{t(colonne.cle)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  {#if choisir !== null}
    {#each modele.ambigus as ambigu (ambigu.champ)}
      <fieldset class="ambigu" data-champ={`choix-${ambigu.champ}`}>
        <legend><span>{t('import.ambiguite.question')}</span> <span>{t(ambigu.cle)}</span></legend>
        {#each ambigu.rangs as { rang, entete } (rang)}
          <label>
            <input type="radio" name={`choix-${ambigu.champ}`} value={rang} onchange={() => choisir(ambigu.champ, rang)} />
            <span>{entete}</span>
          </label>
        {/each}
      </fieldset>
    {/each}
  {/if}

  {#if global === null || modele.valides > 0}
    <p data-valides>
      <span data-nombre>{format.nombre(modele.valides)}</span>
      <span>{t('import.apercu.valides', { n: modele.valides })}</span>
    </p>
  {/if}

  {#if modele.lignes.length > 0}
    <div class="defile">
      <table class="lignes" data-lignes>
        <thead>
          <tr>
            <th scope="col">{t('import.apercu.ligne')}</th>
            {#each COLONNES_DES_LIGNES as { champ, cle } (champ)}
              <th scope="col">{t(cle)}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each modele.lignes as { ligne, cellules } (ligne)}
            <tr data-ligne={ligne}>
              <th scope="row">{format.nombre(ligne)}</th>
              {#each cellules as { champ, texte, cle } (champ)}
                <td data-cellule={champ}>{cle === null ? (texte ?? '') : t(cle)}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if refuseesMontrees.length > 0}
    <table class="refusees" data-refusees>
      <caption>{t('import.apercu.refusees')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('import.apercu.ligne')}</th>
          <th scope="col">{t('import.apercu.motif')}</th>
        </tr>
      </thead>
      <tbody>
        {#each refuseesMontrees as { ligne, code, details } (ligne)}
          <tr data-ligne={ligne}>
            <th scope="row">{format.nombre(ligne)}</th>
            <td>
              <span data-motif>{motif(code, details)}</span>
              {#if details.participants !== undefined}
                <span>{t('import.rapport.designees')}</span>
                {#each nommer(participants, details.participants) as personne (personne.id)}
                  <span class="personne" data-participant={personne.id}>
                    {#if personne.prenom !== null}<span>{personne.prenom}</span>{/if}
                    <span>{personne.nom}</span>
                  </span>
                {/each}
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  {#if modele.fusions.length > 0}
    <section class="bloc">
      <h4>{t('import.apercu.fusions')}</h4>
      <ul data-fusions>
        {#each modele.fusions as fusion, rang (rang)}
          <li data-fusion>
            <span>{t('import.apercu.affichee')}</span>
            <strong data-affichee>{fusion.affichee}</strong>
            <ul>
              {#each fusion.orthographes as orthographe (orthographe.texte)}
                <li data-orthographe>
                  <span data-texte>{orthographe.texte}</span>
                  <span data-nombre>{format.nombre(orthographe.lignes)}</span>
                  <span>{t('import.apercu.orthographeLignes', { n: orthographe.lignes })}</span>
                </li>
              {/each}
            </ul>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if modele.doublons.length > 0}
    <section class="bloc">
      <h4>{t('import.apercu.doublons')}</h4>
      <ul data-doublons>
        {#each modele.doublons as doublon, rang (rang)}
          <li data-doublon>
            <span>{t('import.apercu.doublonLignes')}</span>
            {#each doublon.lignes as ligne (ligne)}
              <span data-nombre>{format.nombre(ligne)}</span>
            {/each}
            {#if doublon.existants.length > 0}
              <span>{t('import.apercu.doublonExistants')}</span>
              {#each nommer(participants, doublon.existants) as personne (personne.id)}
                <span class="personne" data-participant={personne.id}>
                  {#if personne.prenom !== null}<span>{personne.prenom}</span>{/if}
                  <span>{personne.nom}</span>
                </span>
              {/each}
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if modele.homonymes.length > 0}
    <section class="bloc">
      <h4>{t('import.apercu.homonymes')}</h4>
      <ul>
        {#each modele.homonymes as homonyme (homonyme.ligne)}
          <li data-homonyme={homonyme.ligne}>
            <span>{t('import.apercu.ligne')}</span>
            <span>{format.nombre(homonyme.ligne)}</span>
            {#each nommer(participants, homonyme.participants) as personne (personne.id)}
              <span class="personne" data-participant={personne.id}>
                {#if personne.prenom !== null}<span>{personne.prenom}</span>{/if}
                <span>{personne.nom}</span>
              </span>
            {/each}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if modele.multilignes.length > 0}
    <section class="bloc">
      <h4>{t('import.apercu.multilignes')}</h4>
      <ul>
        {#each modele.multilignes as multiligne (multiligne.ligne)}
          <li data-multiligne={multiligne.ligne}>
            <span>{t('import.apercu.ligne')}</span>
            <span>{format.nombre(multiligne.ligne)}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .apercu {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
  }

  .source {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--espace-1) var(--espace-3);
    margin: 0;
  }

  dt {
    font-weight: bold;
  }

  dd {
    margin: 0;
  }

  .refus {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    padding: var(--espace-1) var(--espace-2);
    border-left: 3px solid var(--couleur-refus);
    color: var(--couleur-refus);
  }

  .refus p {
    margin: 0;
  }

  table {
    border-collapse: collapse;
  }

  caption {
    text-align: left;
    font-weight: bold;
    padding-bottom: var(--espace-1);
  }

  th,
  td {
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    text-align: left;
    vertical-align: top;
    white-space: pre-wrap;
  }

  .defile {
    max-height: 24rem;
    overflow: auto;
  }

  .ambigu {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
  }

  .bloc h4 {
    margin: 0 0 var(--espace-1);
  }

  .bloc ul {
    margin: 0;
    padding-left: var(--espace-5);
  }

  .personne {
    display: inline-flex;
    gap: var(--espace-1);
    font-weight: bold;
  }
</style>
