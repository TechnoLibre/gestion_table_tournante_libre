<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le sélecteur d'une règle d'objectifs (§ 4.5, D3), que partagent la
  // règle par défaut (RegleObjectifs) et celle de chaque objectif
  // (ListeTables) : un <select> et son style. Le porteur pose l'étiquette et
  // le refus. options est [{valeur, libelle}], le libellé déjà traduit ;
  // champ nomme sa désignation data-champ. idRefus est l'identifiant du
  // refus affiché, null sans refus : il pose aria-invalid et le lien
  // aria-describedby vers le message. nom, déjà traduit, est le nom
  // accessible du sélecteur quand son étiquette seule ne le distingue pas
  // d'un autre ; null, l'étiquette le nomme. surChoix reçoit l'événement
  // change, dont currentTarget est le sélecteur.
  let { id, champ, valeur, options, idRefus = null, nom = null, surChoix } = $props();
</script>

<select
  {id}
  data-champ={champ}
  value={valeur}
  aria-label={nom ?? undefined}
  aria-invalid={idRefus === null ? undefined : 'true'}
  aria-describedby={idRefus ?? undefined}
  onchange={surChoix}
>
  {#each options as option (option.valeur)}
    <option value={option.valeur}>{option.libelle}</option>
  {/each}
</select>

<style>
  select {
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
  }

  select:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 1px;
  }

  select[aria-invalid='true'] {
    border-color: var(--couleur-refus);
  }
</style>
