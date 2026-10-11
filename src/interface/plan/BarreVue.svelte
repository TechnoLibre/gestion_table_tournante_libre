<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La barre de vue du plan (§ 7.2, § 7.5, § 7.7, § 8.4) : le sélecteur de
  // tour, « Zoom + », « Zoom − », « Ajuster », l'affichage des listes, la
  // légende des conflits et le plein écran. Des contrôles HTML, hors du
  // <svg data-plan>, tous vivants en lecture comme sur un plan bloqué : aucun
  // n'écrit l'événement. Le tour, les listes et le plein écran passent par
  // l'état de navigation ('ui') ; les zooms et l'ajustement par Plan.svelte,
  // qui tient la vue : zoomer(sens), sens valant 1 ou -1, et ajuster(). Un
  // bouton à bascule dit son état par aria-pressed, le bouton de la légende,
  // qui dévoile, par aria-expanded ; la forme du bouton redit l'un et l'autre.
  //
  // evidence : la personne mise en évidence, {id, nom} — nom null pour une
  // personne que la charge n'a plus —, ou null. La barre la nomme et offre
  // d'ôter la mise en évidence, que la personne soit assise au tour montré
  // ou non ; le menu de la personne la pose (MenuPersonne). Une personne que
  // la charge n'a plus se dit telle, sans nom.
  //
  // legende : vrai quand la légende des conflits est ouverte ; basculerLegende
  // l'ouvre ou la ferme ; idLegende, l'identifiant de la légende, que le
  // bouton désigne par aria-controls tant qu'elle est ouverte — fermée, elle
  // n'est pas dans le DOM, et l'attribut n'est pas posé. Plan.svelte tient
  // cet état : ouvrir la légende n'écrit rien. Le plein écran est la dernière
  // commande de vue ; une mise en évidence pose après lui son nom et « ôter ».
  //
  // La barre se lit en groupes, de gauche à droite : le placement montré, le
  // tour affiché, le zoom — ses deux boutons et « Ajuster » —, puis
  // l'affichage — listes, légende, plein écran —, chacun un role="group"
  // nommé, aux boutons accolés dans un même filet ; la mise en évidence
  // ferme la barre. Une bascule active, ou la légende dévoilée, se peint de
  // la teinte de l'action et garde sa forme distincte : trait intérieur
  // épais, texte souligné.
  //
  // source : ce que la barre dit du placement montré, que rend sourceMontree
  // (vue_plan.js) — {libelle, revenir} — : la barre le nomme, [data-source],
  // et, quand une proposition est demandée, offre de ne plus la montrer
  // (ui.montrerProposition(null)), sous le libellé revenir. Ni l'un ni
  // l'autre n'écrit l'événement.
  import { getContext } from 'svelte';
  import { toursOfferts } from './vue_plan.js';

  let { tour, tours, zoomer, ajuster, evidence = null, source, legende = false, basculerLegende = () => {}, idLegende = undefined } = $props();

  const t = getContext('t');
  const ui = getContext('ui');

  const offerts = $derived(toursOfferts(tours));
</script>

<div class="barre-vue" role="toolbar" aria-label={t('plan.vue.barre')}>
  <div class="placement">
    <p class="source" data-source>{t(source.libelle.cle, source.libelle.details)}</p>
    {#if source.revenir !== null}
      <button type="button" class="commande" data-commande="quitterProposition" onclick={() => ui.montrerProposition(null)}
        >{t(source.revenir)}</button
      >
    {/if}
  </div>
  <label class="tour">
    <span class="intertitre">{t('plan.vue.tour')}</span>
    <select data-champ="tour" value={tour} onchange={(evenement) => ui.montrerTour(Number(evenement.currentTarget.value))}>
      {#each offerts as numero (numero)}
        <option value={numero}>{numero}</option>
      {/each}
    </select>
  </label>
  <div class="groupe" role="group" aria-label={t('plan.vue.groupeZoom')}>
    <button type="button" data-commande="zoomer" onclick={() => zoomer(1)}>{t('plan.vue.zoomer')}</button>
    <button type="button" data-commande="dezoomer" onclick={() => zoomer(-1)}>{t('plan.vue.dezoomer')}</button>
    <button type="button" data-commande="ajuster" onclick={() => ajuster()}>{t('plan.vue.ajuster')}</button>
  </div>
  <div class="groupe" role="group" aria-label={t('plan.vue.groupeAffichage')}>
    <button type="button" data-commande="listes" aria-pressed={$ui.listes} onclick={() => ui.basculerListes()}
      >{t('plan.vue.listes')}</button
    >
    <button
      type="button"
      data-commande="legende"
      aria-expanded={legende}
      aria-controls={legende ? idLegende : undefined}
      onclick={() => basculerLegende()}
      >{t('plan.legende.ouvrir')}</button
    >
    <button type="button" data-commande="pleinEcran" aria-pressed={$ui.pleinEcran} onclick={() => ui.basculerPleinEcran()}
      >{t('plan.vue.pleinEcran')}</button
    >
  </div>
  {#if evidence !== null}
    <p class="evidence" data-evidence={evidence.id}>
      <span>{t('plan.evidence.personne')}</span>{#if evidence.nom !== null}<span class="donnee">{evidence.nom}</span>{:else}<span
          >{t('plan.evidence.absente')}</span
        >{/if}
      <button type="button" class="commande" data-commande="oterEvidence" onclick={() => ui.mettreEnEvidence(null)}
        >{t('plan.evidence.oter')}</button
      >
    </p>
  {/if}
</div>

<style>
  /* La barre : une carte basse, ses groupes alignés sur une ligne, repliés
     quand la place manque. */
  .barre-vue {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2) var(--espace-4);
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-3);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-carte);
  }

  .placement,
  .tour,
  .evidence {
    display: flex;
    align-items: center;
    gap: var(--espace-2);
    margin: 0;
  }

  .source {
    margin: 0;
    font-weight: 700;
  }

  .donnee {
    font-weight: 700;
  }

  /* L'étiquette du tour : un intertitre en petites capitales. */
  .intertitre {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: 700;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  select,
  .commande,
  .groupe {
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
  }

  select,
  button {
    padding: var(--espace-1) var(--espace-3);
    color: var(--couleur-page-texte);
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  /* Un groupe : ses boutons accolés dans un même filet, séparés d'un trait. */
  .groupe {
    display: flex;
    align-items: stretch;
  }

  .groupe button {
    border: 0;
    border-radius: 0;
    background-color: transparent;
  }

  .groupe button + button {
    border-left: 1px solid var(--couleur-page-filet);
  }

  .groupe button:first-child {
    border-radius: calc(var(--rayon-2) - 1px) 0 0 calc(var(--rayon-2) - 1px);
  }

  .groupe button:last-child {
    border-radius: 0 calc(var(--rayon-2) - 1px) calc(var(--rayon-2) - 1px) 0;
  }

  button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  /* Une bascule active, ou la légende dévoilée, se distingue par sa forme :
     trait intérieur épais, texte souligné, sur la teinte de l'action ; sa
     boîte ne change pas, et la barre ne bouge pas. */
  button[aria-pressed='true'],
  button[aria-expanded='true'] {
    background-color: var(--couleur-action-teinte);
    box-shadow: inset 0 0 0 2px var(--couleur-page-texte);
    text-decoration: underline;
  }

  button:focus-visible,
  select:focus-visible {
    position: relative;
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
