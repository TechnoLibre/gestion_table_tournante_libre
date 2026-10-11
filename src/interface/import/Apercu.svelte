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
  //
  // Chaque message est classé (Message, messageDuBloc) : le refus global et
  // les lignes refusées en refus, les doublons, les homonymes et les
  // cellules sur plusieurs lignes en avis, les orthographes fondues en
  // information. Les tableaux prennent le langage des cartes : en-tête sur
  // le fond sourd, lignes séparées d'un filet léger.
  import { getContext } from 'svelte';
  import Pastille from '../primitives/Pastille.svelte';
  import Message from './Message.svelte';
  import { COLONNES_DES_LIGNES, messageDuBloc, motifLigne, nommer } from './modele.js';

  let { modele, source, participants = [], refusees = null, choisir = null } = $props();

  const t = getContext('t');
  const format = getContext('format');
  const motif = motifLigne(t);

  const refuseesMontrees = $derived(refusees ?? modele.refusees);
  const global = $derived(modele.global);
  const refusGlobal = messageDuBloc('global');
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
      <Pastille sorte="statut" valeur={refusGlobal.sorte} icone={refusGlobal.icone} libelle={t(refusGlobal.cle)} />
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
    <Message bloc="refusees">
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
    </Message>
  {/if}

  {#if modele.fusions.length > 0}
    <Message bloc="fusions" titre={t('import.apercu.fusions')}>
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
    </Message>
  {/if}

  {#if modele.doublons.length > 0}
    <Message bloc="doublons" titre={t('import.apercu.doublons')}>
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
    </Message>
  {/if}

  {#if modele.homonymes.length > 0}
    <Message bloc="homonymes" titre={t('import.apercu.homonymes')}>
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
    </Message>
  {/if}

  {#if modele.multilignes.length > 0}
    <Message bloc="multilignes" titre={t('import.apercu.multilignes')}>
      <ul>
        {#each modele.multilignes as multiligne (multiligne.ligne)}
          <li data-multiligne={multiligne.ligne}>
            <span>{t('import.apercu.ligne')}</span>
            <span>{format.nombre(multiligne.ligne)}</span>
          </li>
        {/each}
      </ul>
    </Message>
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
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
    align-self: center;
  }

  dd {
    margin: 0;
  }

  /* Le refus global : la pastille du refus, puis la cause et le remède, de
     l'encre de la page, sur le fond du refus. */
  .refus {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-refus-filet);
    border-left: 3px solid var(--couleur-refus-marque);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
  }

  .refus p {
    margin: 0;
  }

  table {
    border-collapse: separate;
    border-spacing: 0;
  }

  caption {
    text-align: left;
    font-weight: bold;
    padding-bottom: var(--espace-1);
  }

  th,
  td {
    padding: var(--espace-1) var(--espace-2);
    border-bottom: 1px solid var(--couleur-ligne-filet);
    text-align: left;
    vertical-align: top;
    white-space: pre-wrap;
  }

  thead th {
    border-top: 1px solid var(--couleur-carte-filet);
    border-bottom-color: var(--couleur-page-filet);
    background-color: var(--couleur-carte-fond-sourd);
    white-space: nowrap;
  }

  tbody th {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .defile {
    max-height: 24rem;
    overflow: auto;
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
  }

  .defile thead th {
    position: sticky;
    top: 0;
    border-top: none;
  }

  .ambigu {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
    border: 1px solid var(--couleur-avis-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-avis-fond);
  }

  ul {
    margin: 0;
    padding-left: var(--espace-5);
  }

  .personne {
    display: inline-flex;
    gap: var(--espace-1);
    font-weight: bold;
  }
</style>
