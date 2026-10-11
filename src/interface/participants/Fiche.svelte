<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La fiche d'une personne à l'écran (§ 4, § 4.2, § 7.4) : nom, prénom,
  // appartenance, courriel, titre pressenti, notes, statut calculé, ses
  // réservations, et sa table et son siège à chaque tour du retenu ; un
  // tour que le retenu ne porte pas se dit hors du retenu. La fiche
  // replie, ne tronque jamais : un nom de deux cents caractères s'y lit
  // entier, sur autant de lignes qu'il en faut. Chaque donnée occupe son
  // propre nœud de texte, et rien n'y est interprété comme du balisage.
  //
  // Le statut est celui de statuts (src/application/places.js), lu dans
  // l'instance du moteur ; l'itinéraire, celui d'itineraire (grille.js), lu
  // tour par tour dans etatPlaces : la fiche ne recalcule ni l'un ni
  // l'autre, et ne porte aucun contrôle de saisie.
  //
  // La fiche est une carte : fond et filet de la carte, rayon de 12 px,
  // ombre légère ; ses étiquettes et légendes de tableau en petites
  // capitales d'encre secondaire.
  //
  // Ouverte, ou passée à une autre personne, la fiche se fait défiler
  // jusque dans la fenêtre : dans une fenêtre étroite, elle se pose sous la
  // grille.
  import { getContext } from 'svelte';
  import { nomAffiche } from '../../application/personnes.js';
  import { etatPlaces, statuts } from '../../application/places.js';
  import { cleDeColonne, cleDeStatut, itineraire, reservationsDe } from './grille.js';

  let { participant, charge } = $props();

  const t = getContext('t');
  const ui = getContext('ui');

  // Les valeurs de la fiche, sous l'étiquette de leur colonne.
  const CHAMPS = ['nom', 'prenom', 'appartenance', 'courriel', 'titrePressenti', 'notes'];

  const statut = $derived.by(() => {
    if (participant.exclu) return t('participants.fiche.statutExclue');
    const { parId, erreur } = statuts(charge);
    if (erreur !== null || !parId.has(participant.id)) return t('participants.fiche.statutInconnu');
    return t(cleDeStatut(parId.get(participant.id)));
  });
  const reservations = $derived(reservationsDe(charge, participant.id));
  const etapes = $derived(itineraire(participant.id, charge.evenement.tours, (tour) => etatPlaces(charge, { tour })));

  let element;
  $effect(() => {
    if (participant.id !== null) element.scrollIntoView({ block: 'nearest' });
  });
</script>

<aside bind:this={element} class="fiche" data-fiche={participant.id} aria-label={t('participants.fiche.titre')}>
  <div class="entete">
    <h3>{nomAffiche(participant)}</h3>
    <button type="button" data-commande="fermerFiche" onclick={() => ui.ouvrirFiche(null)}>
      {t('participants.commande.fermerFiche')}
    </button>
  </div>

  <dl>
    {#each CHAMPS as cle (cle)}
      <dt>{t(cleDeColonne(cle))}</dt>
      <dd>{participant[cle] ?? t('participants.fiche.vide')}</dd>
    {/each}
    <dt>{t('participants.fiche.statut')}</dt>
    <dd>{statut}</dd>
  </dl>

  <table>
    <caption>{t('participants.fiche.reservations')}</caption>
    {#if reservations.length > 0}
      <thead>
        <tr>
          <th scope="col">{t('participants.fiche.table')}</th>
          <th scope="col">{t('participants.fiche.siege')}</th>
          <th scope="col">{t('participants.fiche.portee')}</th>
        </tr>
      </thead>
    {/if}
    <tbody>
      {#each reservations as reservation, rang (rang)}
        <tr>
          <td>{reservation.numero}</td>
          <td>
            {#if reservation.siege === null}{t('participants.fiche.sansSiege')}{:else}{reservation.siege}{/if}
          </td>
          <td>
            {#if reservation.portee === 'tous'}
              {t('participants.fiche.tousLesTours')}
            {:else}
              <span>{t('participants.fiche.auTour')}</span> <span>{reservation.tour}</span>
            {/if}
          </td>
        </tr>
      {:else}
        <tr><td colspan="3">{t('participants.fiche.aucuneReservation')}</td></tr>
      {/each}
    </tbody>
  </table>
  {#if participant.exclu && reservations.length > 0}
    <p>{t('participants.fiche.suspendues')}</p>
  {/if}

  {#if etapes === null}
    <p>{t('participants.fiche.aucunRetenu')}</p>
  {:else}
    <table>
      <caption>{t('participants.fiche.itineraire')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('participants.fiche.tour')}</th>
          <th scope="col">{t('participants.fiche.table')}</th>
          <th scope="col">{t('participants.fiche.siege')}</th>
        </tr>
      </thead>
      <tbody>
        {#each etapes as etape (etape.tour)}
          <tr>
            <td>{etape.tour}</td>
            {#if etape.reserve}
              <td colspan="2">{t('participants.fiche.enReserve')}</td>
            {:else if etape.horsRetenu}
              <td colspan="2">{t('participants.fiche.horsRetenu')}</td>
            {:else}
              <td>{etape.numero}</td>
              <td>
                {#if etape.siege === null}{t('participants.fiche.siegeNonAttribue')}{:else}{etape.siege}{/if}
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</aside>

<style>
  .fiche {
    box-sizing: border-box;
    width: 24rem;
    max-width: 100%;
    padding: var(--espace-4) var(--espace-5);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-3);
    background-color: var(--couleur-carte-fond);
    box-shadow: var(--ombre-carte);
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte);
    line-height: 1.4;
    overflow-wrap: anywhere;
    /* Jamais plus haute que la surface qui la porte (CadreMode) : ouverte
       sous la grille, dans une fenêtre étroite, elle se montre en entier,
       et son contenu défile en elle. */
    max-height: 100cqb;
    overflow-y: auto;
  }

  .entete {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--espace-2);
    padding-bottom: var(--espace-3);
    border-bottom: 1px solid var(--couleur-carte-filet);
  }

  h3 {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--taille-titre-carte);
  }

  dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    align-items: baseline;
    gap: var(--espace-2) var(--espace-3);
    margin: var(--espace-3) 0;
  }

  dt,
  caption {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  dd {
    min-width: 0;
    margin: 0;
    white-space: pre-wrap;
  }

  table {
    width: 100%;
    margin: var(--espace-3) 0;
    border-collapse: collapse;
    table-layout: fixed;
  }

  caption {
    padding-bottom: var(--espace-1);
    text-align: left;
  }

  th,
  td {
    padding: var(--espace-1) var(--espace-2);
    border-bottom: 1px solid var(--couleur-ligne-filet);
    text-align: left;
  }

  th {
    border-bottom-color: var(--couleur-carte-filet);
    background-color: var(--couleur-carte-fond-sourd);
  }

  p {
    margin: var(--espace-2) 0;
    color: var(--couleur-page-texte-secondaire);
  }

  button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
