<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // L'infobulle du plan (§ 7.1, § 7.3) : un seul élément [role=tooltip],
  // toujours présent dans la surface du plan, hors du <svg data-plan>, caché
  // tant qu'aucune table en conflit n'est désignée. Plan.svelte l'ouvre par
  // trois déclencheurs — le survol, le focus du clavier, la pression longue —
  // et lui passe le détail des conflits (detailConflits, modele.js) et sa
  // position dans la surface, en px. Elle énonce la table, son libellé dans
  // son propre nœud quand elle en porte un, et son nombre de violations,
  // puis chaque ligne du détail et ses groupes : chaque nom
  // occupe son propre nœud, relié à l'autre nom d'une paire par « et »,
  // séparé du groupe suivant. Une ligne qui porte une organisation — séparer
  // les organisations — la nomme dans son propre nœud, entre son libellé et
  // finOrganisation.
  //
  // infobulle : null, ou {detail, x, y, xRepli} — x et y, le coin haut droit
  // de l'emprise de la table, xRepli son bord gauche, en px de la surface ;
  // zone : le cadre du <svg> dans la surface ; id : l'identifiant que la
  // racine du plan désigne par aria-describedby quand l'infobulle s'ouvre
  // par le focus. L'infobulle se pose par placerBulle : à droite de
  // l'emprise quand elle y tient, sinon à sa gauche, et dans la zone — elle
  // ne couvre pas le panneau voisin. Sa taille se lit par un observateur de
  // taille (bind:offsetWidth), jamais dans un pointermove ; elle ne dépend
  // pas de sa position, sa largeur étant celle de son contenu, bornée.
  import { getContext } from 'svelte';
  import { placerBulle } from './vue_plan.js';

  let { infobulle, zone, id } = $props();

  const t = getContext('t');

  let largeur = $state(0);
  let hauteur = $state(0);
  const position = $derived(
    infobulle === null ? null : placerBulle({ x: infobulle.x, y: infobulle.y, xRepli: infobulle.xRepli }, { largeur, hauteur }, zone),
  );
</script>

<div
  class="infobulle"
  role="tooltip"
  {id}
  hidden={infobulle === null}
  style:left={position === null ? null : `${position.x}px`}
  style:top={position === null ? null : `${position.y}px`}
  bind:offsetWidth={largeur}
  bind:offsetHeight={hauteur}
>
  {#if infobulle !== null}
    {@const { numero, libelle, nombre } = infobulle.detail}
    <p class="entete">
      <span>{t('plan.infobulle.table', { numero })}</span>{#if libelle !== null}<span>{t('plan.table.avantLibelle')}</span><span
          class="donnee">{libelle}</span
        >{/if}<span>{t('plan.infobulle.nombre', { nombre })}</span>
    </p>
    {#each infobulle.detail.lignes as ligne, rang (rang)}
      <p>
        <span>{t(ligne.cle)}</span>{#if ligne.organisation !== null}<span class="donnee">{ligne.organisation}</span><span
            >{t('plan.infobulle.finOrganisation')}</span
          >{/if}{#each ligne.groupes as groupe, g (g)}{#if g > 0}<span
              >{t('plan.infobulle.separateur')}</span
            >{/if}{#each groupe as nom, n (n)}{#if n > 0}<span>{t('plan.infobulle.et')}</span>{/if}<span class="donnee"
              >{nom}</span
            >{/each}{/each}
      </p>
    {/each}
  {/if}
</div>

<style>
  /* Une carte flottante : fond et filet de la carte, ombre portée. Sa
     largeur est celle de son contenu, bornée à 24rem et à la surface : elle
     ne dépend pas de sa position, que placerBulle choisit sur sa taille. */
  .infobulle {
    position: absolute;
    z-index: 2;
    box-sizing: border-box;
    width: max-content;
    max-width: min(24rem, 100%);
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-2);
    font-size: var(--taille-texte);
    pointer-events: none;
  }

  .infobulle[hidden] {
    display: none;
  }

  p {
    margin: 0;
  }

  .entete {
    margin-bottom: var(--espace-1);
    font-weight: 700;
  }
</style>
