<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La nav des pages d'une liste découpée (§ 5.7, § 8.3) : « Précédentes »
  // à gauche, l'étendue de la page au centre, « Suivantes » à droite. Une
  // commande sans objet n'y est pas — ni « Précédentes » sur la première
  // page, ni « Suivantes » sur la dernière — et sa place reste vide :
  // l'étendue ne bouge pas d'une page à l'autre.
  //
  // ou : 'haut' ou 'bas', porté en data-pages ; nom : le nom accessible de
  // la nav, déjà traduit ; page et pages : la page montrée et leur nombre ;
  // etendue : le texte de l'étendue, déjà traduit ; precedentes et
  // suivantes : les clés des libellés des deux commandes, qui se désignent
  // par data-commande « precedentes » et « suivantes » ; tourner(numero) :
  // montre la page numero. La nav du haut porte l'étendue en région
  // role="status", qui annonce la page ; chaque étendue, data-etendue, se
  // focalise par programme (tabindex -1), jamais par Tab : le porteur y rend
  // le focus après avoir tourné la page.
  import Commande from './Commande.svelte';

  let { ou, nom, page, pages, etendue, precedentes, suivantes, tourner } = $props();
</script>

<nav class="pages" data-pages={ou} aria-label={nom}>
  <div class="precedentes">
    {#if page > 1}
      <Commande cle={precedentes} nom="precedentes" executer={() => tourner(page - 1)} />
    {/if}
  </div>
  <p class="etendue" data-etendue role={ou === 'haut' ? 'status' : undefined} tabindex="-1">
    {etendue}
  </p>
  <div class="suivantes">
    {#if page < pages}
      <Commande cle={suivantes} nom="suivantes" executer={() => tourner(page + 1)} />
    {/if}
  </div>
</nav>

<style>
  /* L'étendue au centre, « Précédentes » contre elle à gauche,
     « Suivantes » à droite. */
  .pages {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--espace-3);
    padding: var(--espace-3) var(--espace-5);
  }

  .precedentes {
    justify-self: end;
  }

  .suivantes {
    justify-self: start;
  }

  .etendue {
    font-variant-numeric: tabular-nums;
  }

  .etendue:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
