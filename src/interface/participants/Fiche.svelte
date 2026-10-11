<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La fiche d'une personne à l'écran (§ 4, § 4.2, § 4.5, § 7.4, § 10.2) :
  // nom, prénom, appartenance, courriel, titre pressenti, notes, statut
  // calculé, ses étiquettes, ses réservations, et sa table et son siège à
  // chaque tour du retenu ; un tour que le retenu ne porte pas se dit hors
  // du retenu. La fiche replie, ne tronque jamais : un nom de deux cents
  // caractères s'y lit entier, sur autant de lignes qu'il en faut. Chaque
  // donnée occupe son propre nœud de texte, et rien n'y est interprété
  // comme du balisage.
  //
  // Le statut est celui de statuts (src/application/places.js), lu dans
  // l'instance du moteur ; l'itinéraire, celui d'itineraire (grille.js), lu
  // tour par tour dans etatPlaces : la fiche ne recalcule ni l'un ni
  // l'autre. Son seul contrôle de saisie est le champ des étiquettes.
  //
  // Les étiquettes (etiquettes.js) : une pastille neutre à icône par
  // étiquette, dans l'ordre de la charge — la teinte d'appartenance ne sert
  // qu'à l'appartenance (§ 12.7) —, chacune suivie de sa commande
  // « Retirer », nommée par elle ; puis un formulaire d'ajout, dont le
  // champ reçoit une ou plusieurs étiquettes séparées comme dans une
  // cellule CSV. Entrée, ou « Ajouter », envoie la saisie entière à
  // changerEtiquettes, qui la découpe, la met en forme et la réconcilie : la
  // fiche ne lit rien elle-même. Un refus de l'ajout — étiquette mal formée,
  // trop d'étiquettes, séance en lecture, plan bloqué — se pose contre le
  // champ, avec son remède, la saisie gardée ; une frappe le retire. Un
  // ajout abouti vide le champ, sauf ce qui a été tapé pendant l'écriture,
  // et pose contre lui le signal de chaque orthographe retenue
  // (ORTHOGRAPHE_RETENUE), tant que la révision qui l'a produit est la
  // courante et la fiche celle de la personne. Le refus d'un retrait se
  // pose à côté de sa commande (Commande). En lecture comme sur un plan
  // bloqué, pastilles et commandes restent : la séance refuse le geste, et
  // le refus porte son remède. Une saisie non envoyée est un geste ouvert
  // (geste.js), qui suspend le compte d'inactivité ; l'envoi n'est pas
  // ré-entrant. Passer à une autre personne vide le champ et son refus ; le
  // refus d'un envoi qui revient après ce passage n'est posé nulle part.
  // Un retrait abouti rend le focus au « Retirer » qui prend la place du
  // sien — le suivant, sinon le précédent (ligneVoisine) —, ou au champ
  // quand il n'en reste aucun.
  //
  // La fiche est une carte : fond et filet de la carte, rayon de 12 px,
  // ombre légère ; ses étiquettes et légendes de tableau en petites
  // capitales d'encre secondaire.
  //
  // Ouverte, ou passée à une autre personne, la fiche se fait défiler
  // jusque dans la fenêtre : dans une fenêtre étroite, elle se pose sous la
  // grille.
  import { getContext, onDestroy, tick, untrack } from 'svelte';
  import { nomAffiche } from '../../application/personnes.js';
  import { etatPlaces, statuts } from '../../application/places.js';
  import Commande from '../primitives/Commande.svelte';
  import Icone from '../primitives/Icone.svelte';
  import Pastille from '../primitives/Pastille.svelte';
  import Refus from '../primitives/Refus.svelte';
  import { creerGeste } from '../primitives/geste.js';
  import { ajoutEtiquettes, etiquettesDeLaFiche, retraitEtiquette, saisieApresAjout, signauxOrthographe } from './etiquettes.js';
  import { cleDeColonne, cleDeStatut, itineraire, ligneVoisine, reservationsDe } from './grille.js';

  let { participant, charge } = $props();

  const t = getContext('t');
  const ui = getContext('ui');
  const seance = getContext('seance');
  const uid = $props.id();
  const geste = creerGeste(seance);

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

  // La fiche et son champ d'ajout, montés : le défilement vise la fiche,
  // le focus d'après un retrait ses « Retirer » ou le champ.
  let element;
  let champ;
  $effect(() => {
    if (participant.id !== null) element.scrollIntoView({ block: 'nearest' });
  });

  // La saisie des étiquettes, le refus posé contre son champ, le rendu du
  // dernier ajout abouti, et l'envoi en cours.
  let texte = $state('');
  let refusChamp = $state.raw(null);
  let dernier = $state.raw(null);
  let envoiEnCours = $state(false);
  const idChamp = `${uid}-etiquettes`;
  const idRefus = `${uid}-refus-etiquettes`;
  const idSignal = `${uid}-orthographe`;

  const pastilles = $derived(etiquettesDeLaFiche(participant));
  const signaux = $derived(signauxOrthographe(dernier, { revision: $seance.evenement?.revision ?? null, participant: participant.id }));
  const decrit = $derived(refusChamp !== null ? idRefus : signaux.length > 0 ? idSignal : undefined);

  // Une autre personne : le champ repart vide, sans refus.
  let personneSaisie = untrack(() => participant.id);
  $effect.pre(() => {
    if (participant.id === personneSaisie) return;
    personneSaisie = participant.id;
    untrack(() => {
      texte = '';
      refusChamp = null;
    });
  });

  $effect(() => {
    geste.tenir(texte !== '');
  });

  // Le refus d'un geste, ou une erreur sans code, qui remonte.
  const refusDe = (erreur) => {
    if (typeof erreur?.code !== 'string') throw erreur;
    return { code: erreur.code, details: erreur.details ?? {} };
  };

  async function ajouter(evenement) {
    evenement.preventDefault();
    if (envoiEnCours) return;
    refusChamp = null;
    const envoyee = texte;
    const id = participant.id;
    const { nom, args } = ajoutEtiquettes(id, envoyee);
    envoiEnCours = true;
    try {
      const rendu = await seance.executer(nom, args);
      dernier = { revision: seance.etat().evenement.revision, participant: id, avertissements: rendu.avertissements };
      texte = saisieApresAjout(envoyee, texte);
    } catch (erreur) {
      const refus = refusDe(erreur);
      if (participant.id === id) refusChamp = refus;
    } finally {
      envoiEnCours = false;
    }
  }

  // Retire motCle ; aboutie, quand le bouton détruit a laissé le focus au
  // document, le porte au « Retirer » voisin ou au champ. Un refus remonte
  // à Commande, qui le pose à côté du bouton resté en place.
  async function retirer(motCle) {
    const id = participant.id;
    const rang = pastilles.indexOf(motCle);
    const { nom, args } = retraitEtiquette(id, motCle);
    await seance.executer(nom, args);
    await tick();
    if (participant.id !== id) return;
    const actuel = document.activeElement;
    if (actuel !== null && actuel !== document.body) return;
    const voisin = ligneVoisine(rang, pastilles.length);
    const boutons = element.querySelectorAll('[data-etiquettes] [data-commande="retirerEtiquette"]');
    (voisin === null ? champ : (boutons[voisin] ?? champ))?.focus();
  }

  // Fait défiler l'élément monté jusque dans la fenêtre, au plus court.
  function montrer(cible) {
    cible.scrollIntoView({ block: 'nearest' });
  }

  onDestroy(() => geste.liberer());
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

  <section class="etiquettes" data-etiquettes aria-labelledby={`${uid}-titre-etiquettes`}>
    <h4 id={`${uid}-titre-etiquettes`}>{t('participants.fiche.etiquettes')}</h4>
    {#if pastilles.length > 0}
      <ul>
        {#each pastilles as motCle (motCle)}
          <li>
            <Pastille sorte="statut" valeur="neutre" icone="etiquettes" libelle={motCle} />
            <Commande
              cle="participants.etiquettes.retirer"
              details={{ motCle }}
              nom="retirerEtiquette"
              variante="discrete"
              executer={() => retirer(motCle)}
            />
          </li>
        {/each}
      </ul>
    {:else}
      <p>{t('participants.fiche.aucuneEtiquette')}</p>
    {/if}
    <form novalidate onsubmit={ajouter}>
      <label for={idChamp}>{t('participants.etiquettes.champ')}</label>
      <div class="saisie">
        <input
          bind:this={champ}
          id={idChamp}
          type="text"
          data-champ="etiquettes"
          bind:value={texte}
          aria-invalid={refusChamp === null ? undefined : 'true'}
          aria-describedby={decrit}
          oninput={() => (refusChamp = null)}
        />
        <button
          type="submit"
          data-commande="ajouterEtiquettes"
          aria-busy={envoiEnCours ? 'true' : undefined}
          aria-disabled={envoiEnCours ? 'true' : undefined}>{t('participants.etiquettes.ajouter')}</button
        >
      </div>
      {#if refusChamp !== null}
        <div class="refus" {@attach montrer}>
          <Refus id={idRefus} refus={refusChamp} lever={() => (refusChamp = null)} />
        </div>
      {:else if signaux.length > 0}
        <div class="signal" id={idSignal} role="status" data-avertissement="ORTHOGRAPHE_RETENUE" {@attach montrer}>
          <span class="signe"><Icone nom="triangle" /></span>
          <div>
            {#each signaux as signal, rang (rang)}
              <p>{t(signal.code, signal.details)}</p>
            {/each}
          </div>
        </div>
      {/if}
    </form>
  </section>

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
    /* Jamais plus haute que la surface qui la porte
       (SurfaceEvenement.svelte) : ouverte sous la grille, dans une fenêtre
       étroite, elle se montre en entier, et son contenu défile en elle. */
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
  caption,
  h4 {
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

  /* Les étiquettes : l'intitulé en petites capitales, les pastilles en
     rangée qui se replie, chacune suivie de son « Retirer » ; puis le champ
     d'ajout et son bouton sur une ligne, le refus ou le signal dessous. */
  .etiquettes {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    margin: var(--espace-3) 0;
  }

  h4 {
    margin: 0;
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1) var(--espace-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-1);
    min-width: 0;
  }

  .etiquettes p {
    margin: 0;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  label {
    font-size: var(--taille-texte-petit);
    font-weight: bold;
  }

  .saisie {
    display: flex;
    gap: var(--espace-2);
  }

  input {
    box-sizing: border-box;
    flex: 1;
    min-width: 0;
    min-height: 2.5rem;
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
  }

  input[aria-invalid='true'] {
    border-color: var(--couleur-refus);
  }

  input:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 1px;
  }

  button[aria-disabled='true'] {
    border-style: dashed;
    color: var(--couleur-page-texte-secondaire);
    cursor: progress;
  }

  .refus {
    min-width: 0;
  }

  /* L'orthographe retenue : un avis, son signe, un texte de l'encre de la
     page. */
  .signal {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: var(--espace-2);
    padding: var(--espace-2);
    border: 1px solid var(--couleur-avis-filet);
    border-left: 3px solid var(--couleur-avis-marque);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-avis-fond);
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte-petit);
  }

  .signal .signe {
    display: inline-flex;
    color: var(--couleur-avis-marque);
  }

  .signal p {
    color: var(--couleur-page-texte);
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
