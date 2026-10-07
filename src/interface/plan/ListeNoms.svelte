<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<svelte:options namespace="svg" />

<script>
  // La liste de noms d'une table (§ 7.4, § 7.6) : un <text data-liste>, une
  // ligne par siège, chacune un <tspan> à x et y explicites, précédée de
  // l'en-tête d'une table gelée. Chaque partie d'une ligne — tête, nom,
  // titre et ce qui l'entoure — est son propre tspan, nommé par
  // data-partie ; le titre est en italique. La ligne entière tient dans
  // largeur (ajusterLigne), mesurée par les mesureurs que PlanDessin crée
  // sur la police rendue ; les lignes s'espacent de la hauteur d'encre du
  // gabarit. La liste ne reçoit pas le pointeur : elle ne masque aucune
  // chaise.
  //
  // Le texte est en white-space: pre, pour que les espaces des parties
  // comptent comme elles ont été mesurées : le gabarit n'a aucun blanc entre
  // les balises du <text>.
  import { getContext } from 'svelte';
  import { TAILLE_TEXTE_LISTE_CM } from '../../geometrie/texte.js';
  import { ajusterLigne, ordonneesLignes, partiesLigne, textesLigne } from './modele.js';

  let { table, mesures, largeur } = $props();

  const t = getContext('t');

  const origine = $derived(table.geometrie.origineListe);
  const reglage = $derived({ ...mesures, largeur, marque: t('plan.liste.abreviation') });
  // Les rangées du bloc : l'en-tête, s'il y en a un, puis chaque ligne.
  const rangees = $derived.by(() => {
    const parties = table.lignes.map((ligne) => partiesLigne(ajusterLigne(textesLigne(ligne, t), reglage)));
    if (table.enTete !== null) {
      const enTete = t(table.enTete.cle, table.enTete.details);
      const seule = { tete: enTete, teteSansNom: enTete, nom: null, avantTitre: null, titre: null, apresTitre: null };
      parties.unshift(partiesLigne(ajusterLigne(seule, reglage)));
    }
    const ordonnees = ordonneesLignes(origine.y, parties.length, mesures.hauteur);
    return parties.map((partiesDeLaLigne, rang) => ({ rang, y: ordonnees[rang], parties: partiesDeLaLigne }));
  });
</script>

<text class="liste" data-liste={table.id} font-size={TAILLE_TEXTE_LISTE_CM}
  >{#each rangees as rangee (rangee.rang)}<tspan x={origine.x} y={rangee.y}
      >{#each rangee.parties as partie (partie.partie)}<tspan class:titre={partie.partie === 'titre'} data-partie={partie.partie}
          >{partie.texte}</tspan
        >{/each}</tspan
    >{/each}</text
>

<style>
  .liste {
    fill: var(--couleur-liste-texte);
    font-family: var(--police-interface);
    white-space: pre;
    pointer-events: none;
  }

  .titre {
    font-style: italic;
  }
</style>
