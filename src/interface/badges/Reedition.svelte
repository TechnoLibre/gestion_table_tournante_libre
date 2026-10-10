<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La réédition de badges (§ 11.8) : une commande nommée, qui produit une
  // planche des seules personnes cochées, annoncée comme telle sur sa
  // feuille de contrôle. La liste porte les personnes non exclues, par ordre
  // alphabétique de leur nom affiché (personnesReeditables) ; la saisie du
  // filtre la restreint aux noms et appartenances qui la contiennent, et une
  // personne cochée le reste quand le filtre la cache. « Rééditer n badges »
  // paraît dès qu'une personne cochée reste rééditable, et remet la
  // sélection — dans l'ordre de la liste — à executer, la production de la
  // section, qui annonce puis produit. Un refus s'affiche à côté de la
  // commande, avec son remède, que gestes exécute quand l'écran le fournit.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';
  import { filtrerPersonnes, personnesReeditables, selectionRetenue } from './modele.js';

  // charge : celle de l'événement ouvert ; executer(selection) : la
  // production de la section ; gestes : les remèdes que l'écran exécute.
  let { charge, executer, gestes = {} } = $props();

  const t = getContext('t');
  const uid = $props.id();

  let saisie = $state('');
  let cochees = $state([]);

  const personnes = $derived(personnesReeditables(charge));
  const montrees = $derived(filtrerPersonnes(personnes, saisie));
  const selection = $derived(selectionRetenue(cochees, personnes));

  function cocher(id, coche) {
    cochees = coche ? [...cochees, id] : cochees.filter((autre) => autre !== id);
  }
</script>

<div class="reedition" role="group" aria-labelledby={`${uid}-titre`}>
  <h3 id={`${uid}-titre`}>{t('badges.reedition.titre')}</h3>
  <p>{t('badges.reedition.explication')}</p>
  <label class="filtre">
    <span>{t('badges.reedition.filtre')}</span>
    <input type="search" data-champ="reedition" value={saisie} oninput={(evenement) => (saisie = evenement.currentTarget.value)} />
  </label>
  {#if montrees.length === 0}
    <p>{t('badges.reedition.aucune')}</p>
  {:else}
    <ul aria-label={t('badges.reedition.personnes')}>
      {#each montrees as personne (personne.id)}
        <li data-participant={personne.id}>
          <label>
            <input type="checkbox" checked={cochees.includes(personne.id)} onchange={(evenement) => cocher(personne.id, evenement.currentTarget.checked)} />
            <span>{personne.nom}</span>
            {#if personne.appartenance !== null}
              <span class="appartenance">{personne.appartenance}</span>
            {/if}
          </label>
        </li>
      {/each}
    </ul>
  {/if}
  {#if selection !== null}
    <Commande cle="badges.reedition.produire" details={{ n: selection.length }} nom="reediter" executer={() => executer(selection)} {gestes} />
  {/if}
</div>

<style>
  .reedition {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  h3 {
    margin: 0;
    font-size: var(--taille-texte);
  }

  p {
    margin: 0;
  }

  .filtre {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--espace-2);
  }

  input[type='search'] {
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
  }

  input:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  /* La liste défile dans sa propre hauteur : une soirée de plusieurs
     centaines de personnes ne repousse pas la commande hors de vue. */
  ul {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    max-height: 16rem;
    margin: 0;
    padding: var(--espace-1) var(--espace-2);
    overflow-y: auto;
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    list-style: none;
  }

  label {
    display: inline-flex;
    align-items: baseline;
    gap: var(--espace-2);
  }

  .appartenance {
    color: var(--couleur-page-texte-secondaire);
  }
</style>
