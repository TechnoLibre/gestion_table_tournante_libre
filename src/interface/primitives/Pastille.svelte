<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Une pastille (§ 12.7) : un fond teinté, un signe — une icône ou un
  // point — de la marque de sa teinte, et un libellé de l'encre de la page.
  // La couleur redit le libellé et ne le remplace jamais. Le modèle — la
  // teinte, le signe — est celui de pastille.js ; une sorte ou une valeur
  // hors contrat lève RangeError au montage.
  //
  // sorte : 'etat', 'appartenance' ou 'statut' ; valeur : l'état du plan, le
  // rang de 1 à 6 ou null (teintesAppartenances), le ton ; libelle : le
  // texte affiché, déjà traduit ou une donnée ; icone : une icône des
  // primitives, qui remplace le signe par défaut. Le signe est caché aux
  // technologies d'assistance.
  //
  // Un libellé court tient sur une ligne. Un libellé plus long que la place
  // donnée se replie, entre deux mots puis entre deux caractères, et ne se
  // tronque jamais : la pastille ne dépasse pas son conteneur, padding
  // compris, et le texte ne sort pas de son fond.
  import Icone from './Icone.svelte';
  import { modelePastille } from './pastille.js';

  let { sorte, valeur, libelle, icone = null } = $props();

  const modele = $derived(modelePastille(sorte, valeur, icone));
</script>

<span class="pastille {modele.teinte}" class:etat={sorte === 'etat'}>
  {#if modele.icone !== null}
    <span class="signe"><Icone nom={modele.icone} taille={14} /></span>
  {:else if modele.point}
    <span class="point" aria-hidden="true"></span>
  {/if}
  <span class="libelle">{libelle}</span>
</span>

<style>
  /* box-sizing: border-box borne la pastille à max-width padding compris.
     Sa largeur minimale reste celle de son mot le plus long : dans une rangée
     flexible trop étroite, ce sont ses voisins qui rétrécissent, et un
     libellé court ne se casse pas en colonne de lettres. */
  .pastille {
    display: inline-flex;
    box-sizing: border-box;
    align-items: center;
    gap: var(--espace-1);
    max-width: 100%;
    padding: 0.125rem var(--espace-2) 0.125rem 0.4375rem;
    /* Le rayon vaut la moitié de la hauteur d'une ligne, padding compris :
       une pastille d'une ligne est une pilule, une pastille repliée un
       rectangle arrondi dont les coins ne rognent pas le texte. Un moteur
       sans l'unité lh garde la pilule. */
    border-radius: var(--rayon-pilule);
    border-radius: calc(0.5lh + 0.125rem);
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte-petit);
    line-height: var(--police-interligne);
  }

  /* Le libellé se replie même sous un parent en nowrap ; overflow-wrap:
     break-word coupe entre deux caractères un mot plus long que la largeur
     bornée par max-width, sans le compter dans la largeur minimale ;
     min-width: 0 laisse le libellé descendre à cette largeur. */
  .libelle {
    min-width: 0;
    white-space: normal;
    overflow-wrap: break-word;
  }

  /* Un état du plan se lit en gras. */
  .etat {
    font-weight: bold;
  }

  .signe {
    display: inline-flex;
    flex: none;
  }

  .point {
    flex: none;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
  }

  /* Chaque teinte : le fond de la pastille, la couleur du signe — le trait
     d'une icône, qui la lit en currentColor, ou le fond d'un point. */
  .neutre {
    background-color: var(--couleur-neutre-fond);
  }
  .neutre .signe {
    color: var(--couleur-neutre-marque);
  }
  .neutre .point {
    background-color: var(--couleur-neutre-marque);
  }

  .etat-brouillon {
    background-color: var(--couleur-etat-brouillon-fond);
  }
  .etat-brouillon .signe {
    color: var(--couleur-etat-brouillon-marque);
  }
  .etat-brouillon .point {
    background-color: var(--couleur-etat-brouillon-marque);
  }

  .etat-propose {
    background-color: var(--couleur-etat-propose-fond);
  }
  .etat-propose .signe {
    color: var(--couleur-etat-propose-marque);
  }
  .etat-propose .point {
    background-color: var(--couleur-etat-propose-marque);
  }

  .etat-retenu {
    background-color: var(--couleur-etat-retenu-fond);
  }
  .etat-retenu .signe {
    color: var(--couleur-etat-retenu-marque);
  }
  .etat-retenu .point {
    background-color: var(--couleur-etat-retenu-marque);
  }

  .etat-bloque {
    background-color: var(--couleur-etat-bloque-fond);
  }
  .etat-bloque .signe {
    color: var(--couleur-etat-bloque-marque);
  }
  .etat-bloque .point {
    background-color: var(--couleur-etat-bloque-marque);
  }

  .appartenance-1 {
    background-color: var(--couleur-appartenance-1-fond);
  }
  .appartenance-1 .signe {
    color: var(--couleur-appartenance-1-marque);
  }
  .appartenance-1 .point {
    background-color: var(--couleur-appartenance-1-marque);
  }

  .appartenance-2 {
    background-color: var(--couleur-appartenance-2-fond);
  }
  .appartenance-2 .signe {
    color: var(--couleur-appartenance-2-marque);
  }
  .appartenance-2 .point {
    background-color: var(--couleur-appartenance-2-marque);
  }

  .appartenance-3 {
    background-color: var(--couleur-appartenance-3-fond);
  }
  .appartenance-3 .signe {
    color: var(--couleur-appartenance-3-marque);
  }
  .appartenance-3 .point {
    background-color: var(--couleur-appartenance-3-marque);
  }

  .appartenance-4 {
    background-color: var(--couleur-appartenance-4-fond);
  }
  .appartenance-4 .signe {
    color: var(--couleur-appartenance-4-marque);
  }
  .appartenance-4 .point {
    background-color: var(--couleur-appartenance-4-marque);
  }

  .appartenance-5 {
    background-color: var(--couleur-appartenance-5-fond);
  }
  .appartenance-5 .signe {
    color: var(--couleur-appartenance-5-marque);
  }
  .appartenance-5 .point {
    background-color: var(--couleur-appartenance-5-marque);
  }

  .appartenance-6 {
    background-color: var(--couleur-appartenance-6-fond);
  }
  .appartenance-6 .signe {
    color: var(--couleur-appartenance-6-marque);
  }
  .appartenance-6 .point {
    background-color: var(--couleur-appartenance-6-marque);
  }

  .information {
    background-color: var(--couleur-information-fond);
  }
  .information .signe {
    color: var(--couleur-information-marque);
  }

  .avis {
    background-color: var(--couleur-avis-fond);
  }
  .avis .signe {
    color: var(--couleur-avis-marque);
  }

  .refus {
    background-color: var(--couleur-refus-fond);
  }
  .refus .signe {
    color: var(--couleur-refus-marque);
  }
</style>
