<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La vue « Appartenances à chaque table » (§ 12.11, B20, D35, D54) de la
  // page de qualité. Un sélecteur à trois positions — un groupe de boutons
  // radio, au clavier — choisit ce que la grille compte : les sièges, les
  // assis ou les doublons parmi les affiliés. La position est un état de la
  // séance (etat_ui.js, melangeTables) : elle survit au changement de
  // section, repart de « sièges » à l'ouverture d'un événement, n'écrit rien
  // et ne fait aucune entrée d'historique ; elle vit en lecture et sur un
  // plan bloqué.
  //
  // Puis la grille, une ligne par table dans l'ordre de la position — la
  // pire en tête, une table sans affilié en dernier —, une colonne par tour ;
  // chaque case écrit et colore le compte de la position, « — » sans
  // couleur sans affilié ; l'infobulle d'une case porte son pourcentage et
  // ses deux comptes. Une grille dont les cases ne tiennent pas dans la
  // largeur de la carte cède la place à sa phrase, et son jumeau s'ouvre ;
  // le sélecteur reste. Sous « doublons », sans collision, la phrase de la
  // vue des collisions tient lieu de grille. Une seule table, aucune
  // appartenance : la phrase du cas, sans sélecteur (§ 12.6, B15). Sous la
  // grille, son jumeau : les trois comptes de chaque table à chaque tour.
  //
  // Elle reçoit le contrat de propriétés des vues — detail, le détail du
  // placement mesuré, null tant qu'il n'est pas calculé ; ligne et table, que
  // cette vue ne lit pas — et met en forme le détail par modeleTables
  // (appartenances.js), sans rien calculer. Son <div> porte data-vue-qualite,
  // que la carte ne transmet pas : il enveloppe la carte.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';
  import { CASE_MAX_TEXTES, modeleTables } from './appartenances.js';
  import Grille from './graphiques/Grille.svelte';
  import Jumeau from './graphiques/Jumeau.svelte';

  let { detail = null, ligne = null, table = null } = $props();

  const t = getContext('t');
  const ui = getContext('ui');
  const uid = $props.id();
  const nomGroupe = `${uid}-position`;

  const position = $derived($ui.melangeTables);
  const modele = $derived(detail === null || detail.tables === null ? null : modeleTables(detail, position, { t }));
  let pointe = $state(null);
  let dessinable = $state(true);
  let ouvert = $state(false);

  // Une grille qui ne tient pas cède la place à son jumeau, ouvert.
  $effect(() => {
    if (!dessinable) ouvert = true;
  });
</script>

<div data-vue-qualite="tables">
  <Carte titre={t('qualite.vue.tables.titre')} sousTitre={t('qualite.vue.tables.question')} niveau={3}>
    {#if modele !== null}
      <div class="corps">
        {#if modele.selecteur}
          <fieldset class="selecteur">
            <legend>{t('qualite.tables.selecteur')}</legend>
            <label class="option">
              <input
                type="radio"
                name={nomGroupe}
                value="sieges"
                data-position-tables="sieges"
                checked={position === 'sieges'}
                onchange={() => ui.reglerMelangeTables('sieges')}
              />
              <span>{t('qualite.tables.position.sieges')}</span>
            </label>
            <label class="option">
              <input
                type="radio"
                name={nomGroupe}
                value="assis"
                data-position-tables="assis"
                checked={position === 'assis'}
                onchange={() => ui.reglerMelangeTables('assis')}
              />
              <span>{t('qualite.tables.position.assis')}</span>
            </label>
            <label class="option">
              <input
                type="radio"
                name={nomGroupe}
                value="doublons"
                data-position-tables="doublons"
                checked={position === 'doublons'}
                onchange={() => ui.reglerMelangeTables('doublons')}
              />
              <span>{t('qualite.tables.position.doublons')}</span>
            </label>
          </fieldset>
        {/if}
        {#if modele.phrase !== null}
          <p data-phrase-qualite={modele.code}>{modele.phrase}</p>
        {/if}
        {#if modele.grille !== null}
          {@const g = modele.grille}
          <div class="grille">
            <Grille
              graphique="tables"
              nom={g.nom}
              synthese={g.synthese}
              lignes={g.lignes}
              colonnes={g.colonnes}
              valeurs={g.valeurs}
              phrase={g.phrase}
              coteMaxTextes={CASE_MAX_TEXTES}
              infobulle={g.infobulle}
              bind:dessinable
              bind:pointe
            />
          </div>
        {/if}
        {#if modele.tableaux.length > 0}
          <Jumeau tableaux={modele.tableaux} bind:ouvert />
        {/if}
      </div>
    {/if}
  </Carte>
</div>

<style>
  .corps {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    min-width: 0;
  }

  p {
    margin: 0;
  }

  /* La grille reçoit toute la largeur du corps de la carte et la mesure ;
     min-width: 0 la laisse rétrécir avec la carte. */
  .grille {
    min-width: 0;
  }

  /* Le sélecteur : sa légende comme le libellé d'un champ, puis les trois
     boutons côte à côte, qui passent à la ligne. */
  .selecteur {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-1) var(--espace-4);
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    float: left;
    margin-right: var(--espace-2);
    padding: 0;
    color: var(--couleur-page-texte-secondaire);
  }

  .option {
    display: inline-flex;
    align-items: center;
    gap: var(--espace-1);
    min-height: var(--cible-minimale);
    cursor: pointer;
  }

  .option input {
    margin: 0;
  }

  .option input:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
