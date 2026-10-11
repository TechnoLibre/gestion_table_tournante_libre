<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Un message de l'accueil (§ 8.6, § 8.8, § 12.7) : un avis, une
  // information ou un refus, en bande sur le fond teinté de son ton, filet
  // de son ton et trait de gauche de son encre, son signe — une icône de la
  // marque du ton, cachée aux technologies d'assistance — devant le texte.
  // Le texte garde l'encre de la page : le signe et le fond redisent le ton,
  // ils ne le portent pas seuls. Le contenu (children) apporte ses propres
  // désignations, son rôle d'état et ses commandes.
  //
  // ton : 'avis', 'information' ou 'refus' ; un autre lève RangeError au
  // montage.
  import Icone from '../primitives/Icone.svelte';

  let { ton, children } = $props();

  // L'icône de chaque ton.
  const ICONES = new Map([
    ['avis', 'triangle'],
    ['information', 'information'],
    ['refus', 'interdit'],
  ]);
  const icone = $derived.by(() => {
    if (!ICONES.has(ton)) throw new RangeError(`message : ton inconnu ${JSON.stringify(ton)}`);
    return ICONES.get(ton);
  });
</script>

<div class="message" class:avis={ton === 'avis'} class:information={ton === 'information'} class:refus={ton === 'refus'}>
  <span class="signe"><Icone nom={icone} taille={18} /></span>
  <div class="texte">{@render children()}</div>
</div>

<style>
  .message {
    display: flex;
    align-items: flex-start;
    gap: var(--espace-2);
    min-width: 0;
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid;
    border-left-width: 3px;
    border-radius: var(--rayon-2);
    color: var(--couleur-page-texte);
  }

  .avis {
    border-color: var(--couleur-avis-filet);
    border-left-color: var(--couleur-avis);
    background-color: var(--couleur-avis-fond);
  }

  .avis .signe {
    color: var(--couleur-avis-marque);
  }

  .information {
    border-color: var(--couleur-information-filet);
    border-left-color: var(--couleur-information);
    background-color: var(--couleur-information-fond);
  }

  .information .signe {
    color: var(--couleur-information-marque);
  }

  .refus {
    border-color: var(--couleur-refus-filet);
    border-left-color: var(--couleur-refus);
    background-color: var(--couleur-refus-fond);
  }

  .refus .signe {
    color: var(--couleur-refus-marque);
  }

  /* Le signe se cale sur la première ligne du texte. */
  .signe {
    display: inline-flex;
    flex: none;
    align-items: center;
    height: calc(1em * var(--police-interligne));
  }

  .texte {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .texte :global(p) {
    margin: 0;
  }
</style>
