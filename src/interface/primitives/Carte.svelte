<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Une carte : la surface d'un contenu, sur le fond de la page — fond de la
  // carte, filet, rayon, ombre légère. Titrée, c'est une région (<section>)
  // nommée par son titre, un intitulé de niveau niveau, que suivent son
  // sous-titre puis, à droite, ses actions ; le contenu vient dessous, séparé
  // par un filet. Sans titre, c'est une boîte sans nom, que son contenu
  // remplit.
  //
  // titre : le texte de l'intitulé, déjà traduit, ou null ; sousTitre : une
  // ligne d'encre secondaire sous le titre, ou null ; niveau : 2 à 4 ;
  // icone : une icône des primitives devant le titre, ou null ; plein : le
  // contenu touche les bords — un tableau —, sinon il s'en écarte ; actions
  // et children : des snippets.
  import Icone from './Icone.svelte';

  let { titre = null, sousTitre = null, niveau = 2, icone = null, plein = false, actions = null, children = null } = $props();

  const uid = $props.id();
  const idTitre = `${uid}-titre`;
  // L'élément de l'intitulé ; un niveau hors de 2 à 4 lève au montage.
  const balise = $derived.by(() => {
    if (![2, 3, 4].includes(niveau)) throw new RangeError(`carte : niveau de titre hors de 2 à 4 : ${JSON.stringify(niveau)}`);
    return `h${niveau}`;
  });
</script>

{#if titre !== null}
  <section class="carte" aria-labelledby={idTitre}>
    <div class="entete" class:seule={children === null}>
      <div class="intitule">
        <!-- Le titre suit l'icône sans blanc entre eux : le texte de
             l'intitulé est le titre seul, sans espace de tête. -->
        <svelte:element this={balise} id={idTitre} class="titre"
          >{#if icone !== null}<span class="pictogramme"><Icone nom={icone} /></span>{/if}{titre}</svelte:element
        >
        {#if sousTitre !== null}
          <p class="sous-titre">{sousTitre}</p>
        {/if}
      </div>
      {#if actions !== null}
        <div class="actions">{@render actions()}</div>
      {/if}
    </div>
    {#if children !== null}
      <div class="corps" class:plein>{@render children()}</div>
    {/if}
  </section>
{:else}
  <div class="carte">
    <div class="corps" class:plein>{@render children?.()}</div>
  </div>
{/if}

<style>
  .carte {
    min-width: 0;
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-3);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-carte);
  }

  .entete {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--espace-3);
    padding: var(--espace-4) var(--espace-5);
    border-bottom: 1px solid var(--couleur-carte-filet);
  }

  .entete.seule {
    border-bottom: none;
  }

  .intitule {
    min-width: 0;
  }

  .titre {
    display: flex;
    align-items: center;
    gap: var(--espace-2);
    margin: 0;
    font-size: var(--taille-titre-carte);
    font-weight: bold;
    line-height: var(--police-interligne);
  }

  .pictogramme {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--rayon-2);
    background-color: var(--couleur-neutre-fond);
    color: var(--couleur-neutre-marque);
  }

  .sous-titre {
    margin: var(--espace-1) 0 0;
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2);
  }

  .corps {
    padding: var(--espace-4) var(--espace-5);
  }

  .corps.plein {
    padding: 0;
  }
</style>
