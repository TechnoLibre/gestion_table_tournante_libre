<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Les démonstrations (§ 15), une issue toujours offerte du premier écran :
  // une commande par démonstration reçue, dans leur ordre, qui porte son nom
  // — une donnée, dans son propre nœud — et data-demonstration, sa clé.
  // Charger crée un événement neuf, numéroté, ouvert en lecture ; aucun
  // autre n'est touché. Le refus d'un chargement s'affiche sous sa commande.
  //
  // demonstrations : [{ cle, nom }] ; charger(cle) : le geste de l'accueil ;
  // refus : { cle, refus } du dernier échec, ou null.
  //
  // Un chargement en cours ne se relance pas : tant que charger n'a pas
  // rendu la main, chaque démonstration porte aria-disabled, celle qui se
  // charge aussi aria-busy, et un clic ne charge rien. Un clic sur une autre
  // se dit : sous elle, un message [data-attente-demonstration] nomme celle
  // qui se charge, et le bouton le désigne par aria-describedby. Le message
  // part avec le chargement.
  //
  // Les démonstrations sont une carte titrée, l'explication en sous-titre ;
  // chacune un bouton secondaire, sur une rangée qui passe à la ligne.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';
  import Refus from '../primitives/Refus.svelte';

  let { demonstrations, charger, refus } = $props();

  const t = getContext('t');
  const uid = $props.id();

  // La clé de la démonstration qui se charge, ou null ; celle d'une autre
  // cliquée pendant ce temps, ou null.
  let enCours = $state(null);
  let attente = $state(null);

  const nomDe = (cle) => demonstrations.find((demonstration) => demonstration.cle === cle)?.nom ?? '';

  async function choisir(cle) {
    if (enCours !== null) {
      if (cle !== enCours) attente = cle;
      return;
    }
    enCours = cle;
    try {
      await charger(cle);
    } finally {
      enCours = null;
      attente = null;
    }
  }
</script>

<Carte titre={t('accueil.demonstrations.titre')} sousTitre={t('accueil.demonstrations.explication')} icone="demarrer">
  <ul>
    {#each demonstrations as { cle, nom } (cle)}
      <li>
        <button
          type="button"
          data-demonstration={cle}
          aria-busy={enCours === cle ? 'true' : undefined}
          aria-disabled={enCours !== null ? 'true' : undefined}
          aria-describedby={attente === cle ? `${uid}-attente` : undefined}
          onclick={() => choisir(cle)}>{nom}</button
        >
        {#if attente === cle}
          <p id={`${uid}-attente`} role="status" data-attente-demonstration
            >{t('accueil.demonstrations.enCours', { nom: nomDe(enCours) })}</p
          >
        {/if}
        {#if refus !== null && refus.cle === cle}
          <Refus refus={refus.refus} />
        {/if}
      </li>
    {/each}
  </ul>
</Carte>

<style>
  p {
    margin: 0;
  }

  /* Les démonstrations se rangent en ligne, et passent à la ligne quand la
     largeur manque : en colonne, quatre entrées repoussent la dernière
     au-dessous d'une fenêtre de 700 px de haut. */
  ul {
    display: flex;
    flex-flow: row wrap;
    align-items: flex-start;
    gap: var(--espace-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
  }

  button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
    text-align: start;
    cursor: pointer;
  }

  button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  button[aria-disabled='true'] {
    border-style: dashed;
    color: var(--couleur-page-texte-secondaire);
    cursor: progress;
  }
</style>
