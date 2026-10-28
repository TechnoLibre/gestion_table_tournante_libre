<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<svelte:options namespace="svg" />

<script>
  // La liste de noms d'une table (§ 7.4, § 7.6) : un <text data-liste>, une
  // rangée par ligne de siège, chacune un <tspan> à x et y explicites,
  // précédée de l'en-tête d'une table gelée. Chaque partie d'une ligne —
  // tête, nom, organisation, titre et ce qui les entoure — est son propre
  // tspan, nommé par data-partie ; le titre est en italique, l'organisation
  // et son séparateur dans l'encre secondaire, à la même police. La ligne
  // entière tient dans largeur (ajusterLigne), mesurée par les mesureurs que
  // PlanDessin crée sur la police rendue ; une organisation qui n'y tient pas
  // se replie sous elle, ses rangées décalées de RETRAIT_ORGANISATION
  // (rangeesListe), et le bloc s'allonge d'autant, vers le bas, sans borne :
  // le plan écarté descend les rangées de tables du dessous (rangeesEcartees,
  // § 7.4), et la liste part de l'origine que la table dessinée lui donne.
  // Les rangées s'espacent de la hauteur d'encre du gabarit. La liste ne
  // reçoit pas le pointeur : elle ne masque aucune chaise.
  //
  // Le texte est en white-space: pre, pour que les espaces des parties
  // comptent comme elles ont été mesurées : le gabarit n'a aucun blanc entre
  // les balises du <text>.
  //
  // Le texte se compose en text-rendering: geometricPrecision, comme la
  // sonde qui le mesure (PlanDessin) : le moteur de rendu le met alors en
  // page à son corps du dessin, sans le recomposer au corps qu'il prend à
  // l'écran. Sans lui, la largeur mesurée suit l'échelle d'affichage — le
  // zoom du plan, l'échelle d'une page imprimée —, et une même ligne
  // s'abrège à des longueurs différentes à l'écran et sur le papier (§ 7.4).
  import { getContext } from 'svelte';
  import { TAILLE_TEXTE_LISTE_CM } from '../../geometrie/texte.js';
  import { RETRAIT_ORGANISATION, ordonneesLignes, rangeesListe } from './modele.js';

  let { table, mesures, largeur } = $props();

  const t = getContext('t');

  const origine = $derived(table.geometrie.origineListe);
  // Les rangées du bloc, chacune à son abscisse et à son ordonnée.
  const rangees = $derived.by(() => {
    const lues = rangeesListe(table, t, { mesurer: mesures.mesurer, mesurerItalique: mesures.mesurerItalique, largeur });
    const ordonnees = ordonneesLignes(origine.y, lues.length, mesures.hauteur);
    return lues.map(({ parties, retrait }, rang) => ({
      rang,
      x: origine.x + (retrait ? RETRAIT_ORGANISATION : 0),
      y: ordonnees[rang],
      parties,
    }));
  });
</script>

<text class="liste" data-liste={table.id} font-size={TAILLE_TEXTE_LISTE_CM}
  >{#each rangees as rangee (rangee.rang)}<tspan x={rangee.x} y={rangee.y}
      >{#each rangee.parties as partie (partie.partie)}<tspan
          class:titre={partie.partie === 'titre'}
          class:organisation={partie.partie === 'organisation' || partie.partie === 'avantOrganisation'}
          data-partie={partie.partie}>{partie.texte}</tspan
        >{/each}</tspan
    >{/each}</text
>

<style>
  .liste {
    fill: var(--couleur-liste-texte);
    font-family: var(--police-interface);
    text-rendering: geometricPrecision;
    white-space: pre;
    pointer-events: none;
  }

  .titre {
    font-style: italic;
  }

  .organisation {
    fill: var(--couleur-page-texte-secondaire);
  }
</style>
