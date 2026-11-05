<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Le panneau d'historique de l'événement (§ 8.3, § 8.4) : un <aside>
  // titré, data-panneau="historique", que SurfaceEvenement pose à droite de
  // la surface, monté à l'ouverture et démonté à la fermeture. Le montage
  // porte le focus sur son titre ; Échap, d'où que vienne la touche dans le
  // panneau, appelle fermer, qui le referme et rend le focus au bouton
  // « Historique… ». id est celui de l'<aside>, que le bouton désigne par
  // aria-controls.
  //
  // De haut en bas : le champ « Nom de l'instant courant » et « Nommer »,
  // qui nomme l'instant courant de ce nom (seance.nommer) et vide le champ
  // au succès ; la case « Instants nommés seulement » ; l'annonce de la
  // reprise quand l'état sur le disque est plus récent que le journal ;
  // puis la liste des instants, la plus récente d'abord, en pages de cent
  // (vueHistorique, historique.js). Le champ garde le nom sans rien écrire :
  // sa validation — la sortie du champ, Entrée — pose le nom que « Nommer »
  // enverra, et seul « Nommer » écrit.
  //
  // Une ligne, <li>, porte data-revision et data-fil — courant, abandonne ou
  // retour : son heure, en encre secondaire et en chiffres tabulaires, son
  // libellé figé, dans sa forme affichée (libelleAffiche), ses pastilles —
  // « instant courant », « fil abandonné », une par jalon, de son nom —, puis
  // « Revenir à cet instant », hors de la ligne courante, qui restitue
  // l'instant (seance.revenir), sous l'indicateur d'activité (activite.js).
  // Une ligne d'un fil abandonné est d'encre secondaire. Chaque pastille se
  // désigne par data-pastille-instant — courant, abandonne ou jalon. En
  // lecture, la liste se lit ; « Nommer » et « Revenir » sont refusés à côté
  // d'eux avec leur remède, comme toute commande.
  //
  // Le panneau relit seance.historique() à son montage, puis quand la
  // révision de l'événement, le nombre de ses jalons — un jalon ne change
  // pas la révision — ou l'événement lui-même changent : une autre
  // publication de la séance ne le relit pas. Fermé, il n'existe pas et ne
  // lit rien. Le filtre et la page sont des états du panneau : cocher la
  // case revient à la première page ; tourner la page rend le focus à
  // l'étendue de la nav du dessus, qui l'annonce.
  import { getContext, onMount, tick } from 'svelte';
  import { suivre } from '../activite.js';
  import Champ from '../primitives/Champ.svelte';
  import Commande from '../primitives/Commande.svelte';
  import Pages from '../primitives/Pages.svelte';
  import Pastille from '../primitives/Pastille.svelte';
  import { effetDe } from '../raccourcis.js';
  import { etendueHistorique, vueHistorique } from './historique.js';

  let { id, fermer } = $props();

  const t = getContext('t');
  const format = getContext('format');
  const seance = getContext('seance');
  const uid = $props.id();
  const idTitre = `${uid}-titre`;
  const idCase = `${uid}-jalons`;

  // Ce dont dépend la relecture : chacune ne change qu'avec sa valeur.
  const revision = $derived($seance.evenement?.revision ?? null);
  const jalons = $derived($seance.retours.jalons);
  const evenement = $derived($seance.evenement?.id ?? null);
  const historique = $derived.by(() => {
    void revision;
    void jalons;
    void evenement;
    return seance.historique();
  });

  let jalonsSeuls = $state(false);
  let page = $state(1);
  const vue = $derived(vueHistorique(historique, { jalonsSeuls, page }));

  // Le nom que « Nommer » envoie, posé par la validation du champ.
  let nom = $state('');
  const lireNom = (texte) => ({ valeur: texte });

  let racine = $state(null);
  let titre = $state(null);

  onMount(() => titre?.focus());

  async function nommer() {
    await seance.nommer(nom);
    nom = '';
  }

  function filtrer(evenementCase) {
    jalonsSeuls = evenementCase.currentTarget.checked;
    page = 1;
  }

  function tourner(numero) {
    page = numero;
    tick().then(() => racine?.querySelector('[data-pages="haut"] [data-etendue]')?.focus());
  }

  function surTouche(evenementClavier) {
    if (effetDe('fenetre', evenementClavier.key) !== 'fermer') return;
    evenementClavier.preventDefault();
    fermer();
  }
</script>

{#snippet pages(ou)}
  <Pages
    {ou}
    nom={t(`evenement.historique.pages.${ou}`)}
    page={vue.page}
    pages={vue.pages}
    etendue={etendueHistorique(vue, { t, format })}
    precedentes="evenement.historique.pages.precedents"
    suivantes="evenement.historique.pages.suivants"
    {tourner}
  />
{/snippet}

<!-- Échap remonte des contrôles du panneau jusqu'à lui, qui se referme. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<aside {id} class="historique" data-panneau="historique" aria-labelledby={idTitre} bind:this={racine} onkeydown={surTouche}>
  <h2 id={idTitre} tabindex="-1" bind:this={titre}>{t('evenement.historique.titre')}</h2>
  <div class="corps">
    <div class="nommer">
      <Champ cle="nomInstant" etiquette="evenement.historique.nom" valeur={nom} lire={lireNom} executer={(valeur) => (nom = valeur)} />
      <Commande cle="evenement.historique.nommer" executer={nommer} />
    </div>
    <div class="case">
      <input id={idCase} type="checkbox" data-jalons-seuls checked={jalonsSeuls} onchange={filtrer} />
      <label for={idCase}>{t('evenement.historique.jalonsSeuls')}</label>
    </div>
    {#if historique?.reprise}
      <p class="reprise" data-reprise>{t('evenement.historique.reprise')}</p>
    {/if}
    {#if vue.vide !== null}
      <p class="vide" data-vide={vue.vide}>{t(`evenement.historique.${vue.vide}`)}</p>
    {:else}
      {#if vue.paginee}{@render pages('haut')}{/if}
      <ol class="instants">
        {#each vue.lignes as ligne (ligne.revision)}
          <li data-revision={ligne.revision} data-fil={ligne.fil} class:abandonne={ligne.fil === 'abandonne'}>
            <p class="instant"><span class="quand">{ligne.quand}</span><span class="libelle">{ligne.libelleAffiche}</span></p>
            {#if ligne.courante || ligne.fil === 'abandonne' || ligne.jalons.length > 0}
              <p class="pastilles">
                {#if ligne.courante}
                  <span data-pastille-instant="courant"><Pastille sorte="statut" valeur="information" libelle={t('evenement.historique.courant')} /></span>
                {/if}
                {#if ligne.fil === 'abandonne'}
                  <span data-pastille-instant="abandonne"><Pastille sorte="statut" valeur="neutre" libelle={t('evenement.historique.abandonne')} /></span>
                {/if}
                {#each ligne.jalons as jalon, rang (rang)}
                  <span data-pastille-instant="jalon"><Pastille sorte="statut" valeur="neutre" icone="etiquettes" libelle={jalon.nom} /></span>
                {/each}
              </p>
            {/if}
            {#if ligne.revenir}
              <Commande
                cle="evenement.historique.revenir"
                nom="revenir"
                variante="discrete"
                nomAccessible={t('evenement.historique.revenirNom', { libelle: ligne.libelle, quand: ligne.quand })}
                executer={() => suivre(() => seance.revenir(ligne.revision))}
              />
            {/if}
          </li>
        {/each}
      </ol>
      {#if vue.paginee}{@render pages('bas')}{/if}
    {/if}
  </div>
</aside>

<style>
  /* Le panneau : le fond et le filet de la carte, à droite de la surface,
     sur toute sa hauteur, d'une largeur fixe ; il défile seul. Sous 80rem
     de barre — 81,5rem de zone de travail, les deux retraits de la barre
     compris (SurfaceEvenement.svelte) —, il passe par-dessus la surface,
     collé à droite, d'une ombre qui l'en détache. */
  .historique {
    display: flex;
    box-sizing: border-box;
    flex: 0 0 24rem;
    flex-direction: column;
    max-width: 100%;
    min-height: 0;
    overflow-y: auto;
    border-left: 1px solid var(--couleur-carte-filet);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
  }

  @container travail (max-width: 81.5rem) {
    .historique {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 1;
      width: 24rem;
      box-shadow: var(--ombre-2);
    }
  }

  h2 {
    margin: 0;
    padding: var(--espace-3) var(--espace-4);
    border-bottom: 1px solid var(--couleur-carte-filet);
    font-size: var(--taille-titre-carte);
  }

  h2:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: -2px;
  }

  .corps {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    padding: var(--espace-3) var(--espace-4);
  }

  .nommer {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--espace-2);
  }

  .case {
    display: flex;
    align-items: center;
    gap: var(--espace-1);
    min-height: var(--cible-minimale);
  }

  .case input {
    margin: 0;
  }

  .case input:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 1px;
  }

  p {
    margin: 0;
  }

  .reprise,
  .vide {
    color: var(--couleur-page-texte-secondaire);
  }

  .instants {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Une ligne : l'heure et le libellé, les pastilles dessous, puis
     « Revenir à cet instant » ; un filet entre deux lignes. */
  .instants > li {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
    padding: var(--espace-2) 0;
    border-top: 1px solid var(--couleur-carte-filet);
  }

  .instant {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--espace-2);
  }

  .quand {
    color: var(--couleur-page-texte-secondaire);
    font-variant-numeric: tabular-nums;
  }

  .libelle {
    overflow-wrap: anywhere;
  }

  .abandonne .libelle {
    color: var(--couleur-page-texte-secondaire);
  }

  .pastilles {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1);
  }
</style>
