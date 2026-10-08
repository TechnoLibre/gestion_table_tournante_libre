<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // L'infobulle du plan (§ 7.1, § 7.3) : un seul élément [role=tooltip],
  // toujours présent dans la surface du plan, hors du <svg data-plan>, caché
  // tant qu'aucune table en conflit n'est désignée. Plan.svelte l'ouvre par
  // trois déclencheurs — le survol, le focus du clavier, la pression longue —
  // et lui passe le détail des conflits (detailConflits, modele.js) et sa
  // position dans la surface, en px. Elle énonce la table et son nombre de
  // violations, puis chaque ligne du détail et ses groupes : chaque nom
  // occupe son propre nœud, relié à l'autre nom d'une paire par « et »,
  // séparé du groupe suivant. Une ligne qui porte une appartenance — séparer
  // les appartenances — la nomme dans son propre nœud, entre son libellé et
  // finAppartenance.
  //
  // infobulle : null, ou {detail, x, y} ; id : l'identifiant que la racine
  // du plan désigne par aria-describedby quand l'infobulle s'ouvre par le
  // focus.
  import { getContext } from 'svelte';

  let { infobulle, id } = $props();

  const t = getContext('t');
</script>

<div
  class="infobulle"
  role="tooltip"
  {id}
  hidden={infobulle === null}
  style:left={infobulle === null ? null : `${infobulle.x}px`}
  style:top={infobulle === null ? null : `${infobulle.y}px`}
>
  {#if infobulle !== null}
    <p class="entete">{t('plan.infobulle.entete', { numero: infobulle.detail.numero, nombre: infobulle.detail.nombre })}</p>
    {#each infobulle.detail.lignes as ligne, rang (rang)}
      <p>
        <span>{t(ligne.cle)}</span>{#if ligne.appartenance !== null}<span class="donnee">{ligne.appartenance}</span><span
            >{t('plan.infobulle.finAppartenance')}</span
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
  .infobulle {
    position: absolute;
    z-index: 2;
    box-sizing: border-box;
    max-width: 24rem;
    padding: var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-1);
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
    font-weight: 700;
  }
</style>
