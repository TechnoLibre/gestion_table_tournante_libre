<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La fiche d'une personne à l'écran (§ 4, § 4.2, § 4.5, § 7.4, § 10.2) :
  // nom, prénom, appartenance, courriel, titre pressenti, notes, statut
  // calculé, ses étiquettes, sa présence par tour, ses réservations, et sa
  // table et son siège à chaque tour du retenu, ou son absence à ce tour ;
  // un tour que le retenu ne porte pas se dit hors du retenu. La fiche replie, ne tronque jamais : un nom de deux cents
  // caractères s'y lit entier, sur autant de lignes qu'il en faut. Chaque
  // donnée occupe son propre nœud de texte, et rien n'y est interprété
  // comme du balisage.
  //
  // Le statut est celui de statuts (src/application/places.js), lu dans
  // l'instance du moteur ; l'itinéraire, celui d'itineraire (grille.js), lu
  // tour par tour dans etatPlaces : la fiche ne recalcule ni l'un ni
  // l'autre. Ses contrôles de saisie sont le champ des étiquettes et les
  // cases de la présence.
  //
  // Les étiquettes (etiquettes.js) : une pastille neutre à icône par
  // étiquette, dans l'ordre de la charge — la teinte d'appartenance ne sert
  // qu'à l'appartenance (§ 12.7) —, chacune suivie, en écriture seulement,
  // de sa commande de retrait : une croix cerclée rouge (Commande, variante
  // retrait), nommée « Retirer « <étiquette> » » ; puis un formulaire
  // d'ajout, dont le champ reçoit une ou plusieurs étiquettes séparées
  // comme dans une cellule CSV. Entrée, ou « Ajouter », envoie la saisie entière à
  // changerEtiquettes, qui la découpe, la met en forme et la réconcilie : la
  // fiche ne lit rien elle-même. Un refus de l'ajout — étiquette mal formée,
  // trop d'étiquettes, séance en lecture, plan bloqué — se pose contre le
  // champ, avec son remède, la saisie gardée ; une frappe le retire. Un
  // ajout abouti vide le champ, sauf ce qui a été tapé pendant l'écriture,
  // et pose contre lui le signal de chaque orthographe retenue
  // (ORTHOGRAPHE_RETENUE), tant que la révision qui l'a produit est la
  // courante et la fiche celle de la personne. Le refus d'un retrait se
  // pose à côté de sa commande (Commande). En lecture comme sur un plan
  // bloqué (cleDeMode, mode.js), aucune commande de retrait ne se montre ;
  // pastilles, champ et « Ajouter » restent : la séance refuse l'ajout, et
  // le refus porte son remède. Une saisie non envoyée est un geste ouvert
  // (geste.js), qui suspend le compte d'inactivité ; l'envoi n'est pas
  // ré-entrant. Passer à une autre personne vide le champ et son refus ; le
  // refus d'un envoi qui revient après ce passage n'est posé nulle part.
  // Un retrait abouti rend le focus à la commande de retrait qui prend la
  // place de la sienne — la suivante, sinon la précédente (ligneVoisine) —,
  // ou au champ quand il n'en reste aucune.
  //
  // La rubrique « Présence » (data-presence-fiche), entre les étiquettes et
  // les réservations : la présence enregistrée, « tous » ou ses tours
  // nommés (affichagePresence, presence.js), puis une case par tour
  // (CasesPresence), « Tous les tours » et « Appliquer ». Cocher, décocher et
  // « Tous les tours » n'écrivent rien : le brouillon vit dans une machine
  // de champ.js, sur la saisie canonique de presence.js, et tient le geste
  // ouvert. « Appliquer », ou Entrée dans les cases, exécute changerPresence
  // (commandeDeCellule) : une entrée, et aucune quand le brouillon se lit
  // comme la présence enregistrée. Échap dans les cases rend la présence
  // enregistrée. Un refus — présence vide, séance en lecture, plan bloqué —
  // se pose sous les cases, avec son remède, le brouillon gardé. Une
  // écriture venue d'ailleurs — la grille, Défaire — arrive par recevoir :
  // les cases la suivent hors d'un brouillon. Passer à une autre personne
  // repart de sa présence, sans brouillon ni refus. Les avertissements de
  // la commande passent par la zone d'annonces de l'événement.
  //
  // La fiche est une carte : fond et filet de la carte, rayon de 12 px,
  // ombre légère ; ses étiquettes et légendes de tableau en petites
  // capitales d'encre secondaire.
  //
  // Ouverte, ou passée à une autre personne, la fiche se fait défiler
  // jusque dans la fenêtre : dans une fenêtre étroite, elle se pose sous la
  // grille.
  //
  // La rubrique « Rencontres » (§ 12.5, D33, data-rubrique-rencontres) porte
  // la ligne de la personne dans le placement que le plan montre — celui
  // que la page de qualité mesure —, par rubriqueRencontres
  // (qualite/paires.js) : la ligne de source qui le nomme, puis chaque
  // personne rencontrée, le nombre de fois, et chaque tour avec sa table,
  // les plus revues d'abord. Comme au tableau des paires, une personne
  // s'écrit par son nom, puis en encre secondaire l'identifiant d'un
  // homonyme et son appartenance : deux homonymes n'y font pas deux lignes
  // pareilles. Une source qui ne se mesure pas, une personne
  // exclue : une phrase le dit. Sans placement, la rubrique est absente,
  // sans phrase. Elle n'a aucune commande : elle se lit en lecture et sur un
  // plan bloqué comme en écriture.
  import { getContext, onDestroy, tick, untrack } from 'svelte';
  import { nomAffiche } from '../../application/personnes.js';
  import { etatPlaces, presenceSaisie, statuts } from '../../application/places.js';
  import { cleDeMode } from '../mode.js';
  import { creerMachineChamp } from '../primitives/champ.js';
  import Commande from '../primitives/Commande.svelte';
  import Icone from '../primitives/Icone.svelte';
  import Pastille from '../primitives/Pastille.svelte';
  import Refus from '../primitives/Refus.svelte';
  import { creerGeste } from '../primitives/geste.js';
  import { rubriqueRencontres } from '../qualite/paires.js';
  import { effetDe } from '../raccourcis.js';
  import CasesPresence from './CasesPresence.svelte';
  import { ajoutEtiquettes, etiquettesDeLaFiche, retraitEtiquette, saisieApresAjout, signauxOrthographe } from './etiquettes.js';
  import { cleDeColonne, cleDeStatut, commandeDeCellule, itineraire, ligneVoisine, reservationsDe } from './grille.js';
  import { affichagePresence, casesDeSaisie, lecturePresence, saisieApresBascule, saisieEnregistree, saisiePleine } from './presence.js';

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
  const rencontres = $derived(rubriqueRencontres(charge, $ui.proposition, participant.id));

  // La fiche et son champ d'ajout, montés : le défilement vise la fiche,
  // le focus d'après un retrait ses commandes de retrait ou le champ.
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
  // Les commandes de retrait ne se montrent qu'en écriture, hors d'un plan
  // bloqué.
  const retraitOffert = $derived(cleDeMode($seance) === 'coquille.mode.ecriture');
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

  // La présence : l'enregistrée, son affichage, et le brouillon des cases,
  // tenu par une machine de champ.js propre à la personne et au nombre de
  // tours ; le refus posé sous les cases, et l'envoi en cours.
  const tours = $derived(charge.evenement.tours);
  const presenceEnregistree = $derived(saisieEnregistree(participant, tours));
  const vuePresence = $derived(affichagePresence(presenceSaisie(participant)));
  let machinePresence = untrack(() => creerMachineChamp({ stockee: presenceEnregistree, lire: lecturePresence(tours) }));
  let saisiePresence = $state(untrack(() => machinePresence.saisie));
  let brouillonPresence = $state(false);
  let refusPresence = $state.raw(null);
  let envoiPresence = $state(false);
  const idRefusPresence = `${uid}-refus-presence`;

  // La saisie et le brouillon, relus de la machine après chacun de ses pas.
  function suivrePresence() {
    saisiePresence = machinePresence.saisie;
    brouillonPresence = machinePresence.enCours;
  }

  // Une autre personne, un autre nombre de tours : une machine neuve, sans
  // refus. La même : la présence enregistrée, venue d'ailleurs, est reçue.
  let presenceDe = untrack(() => `${participant.id}|${tours}`);
  $effect.pre(() => {
    const cle = `${participant.id}|${tours}`;
    const enregistree = presenceEnregistree;
    untrack(() => {
      if (cle === presenceDe) machinePresence.recevoir(enregistree);
      else {
        presenceDe = cle;
        machinePresence = creerMachineChamp({ stockee: enregistree, lire: lecturePresence(tours) });
        refusPresence = null;
      }
      suivrePresence();
    });
  });

  $effect(() => {
    geste.tenir(texte !== '' || brouillonPresence);
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
  // document, le porte à la commande de retrait voisine ou au champ. Un
  // refus remonte à Commande, qui le pose à côté du bouton resté en place.
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

  function basculerPresence(tour, coche) {
    machinePresence.saisir(saisieApresBascule(machinePresence.saisie, tour, coche));
    refusPresence = null;
    suivrePresence();
  }

  // « Tous les tours » : chaque case cochée, sans rien écrire.
  function toutCocher() {
    machinePresence.saisir(saisiePleine(tours));
    refusPresence = null;
    suivrePresence();
  }

  // Exécute la présence saisie, quand elle diffère de l'enregistrée ; un
  // refus la rend au brouillon et se pose sous les cases, tant que la
  // machine est la même. L'envoi n'est pas ré-entrant.
  async function appliquer(evenement) {
    evenement.preventDefault();
    if (envoiPresence) return;
    const enCours = machinePresence;
    const id = participant.id;
    refusPresence = null;
    const rendu = enCours.valider();
    suivrePresence();
    if (rendu.action !== 'executer') return;
    const { nom, args } = commandeDeCellule('presence', id, rendu.valeur);
    envoiPresence = true;
    try {
      await seance.executer(nom, args);
    } catch (erreur) {
      const refus = refusDe(erreur);
      if (machinePresence === enCours) {
        enCours.echec(refus);
        suivrePresence();
        refusPresence = refus;
      }
    } finally {
      envoiPresence = false;
    }
  }

  // Dans les cases : Entrée applique, Échap rend la présence enregistrée.
  // Entrée passe par appliquer et retient l'appui : l'envoi ne dépend pas
  // de la soumission implicite qu'un moteur offre, ou non, depuis une case.
  function surTouchePresence(evenement) {
    const effet = effetDe('champ', evenement.key);
    if (effet === 'valider') appliquer(evenement);
    else if (effet === 'rendre') {
      evenement.preventDefault();
      machinePresence.abandonner();
      refusPresence = null;
      suivrePresence();
    }
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
            {#if retraitOffert}
              <Commande
                cle="participants.etiquettes.retirer"
                details={{ motCle }}
                nom="retirerEtiquette"
                variante="retrait"
                executer={() => retirer(motCle)}
              />
            {/if}
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

  <section class="presence" data-presence-fiche aria-labelledby={`${uid}-titre-presence`}>
    <h4 id={`${uid}-titre-presence`}>{t('participants.fiche.presence')}</h4>
    {#if vuePresence.sorte === 'tous'}
      <p class="resume" data-presence="tous">{t(vuePresence.cle)}</p>
    {:else}
      <p class="resume" data-presence="partielle">{t(vuePresence.cle, vuePresence.details)}</p>
    {/if}
    <form novalidate onsubmit={appliquer}>
      <CasesPresence
        cases={casesDeSaisie(saisiePresence, tours)}
        nom={nomAffiche(participant)}
        invalide={refusPresence !== null}
        decrit={refusPresence === null ? undefined : idRefusPresence}
        basculer={basculerPresence}
        toucher={surTouchePresence}
      />
      <div class="boutons">
        <button type="button" data-commande="presenceTous" onclick={toutCocher}>{t('participants.presence.tousLesTours')}</button>
        <button
          type="submit"
          data-commande="changerPresence"
          aria-busy={envoiPresence ? 'true' : undefined}
          aria-disabled={envoiPresence ? 'true' : undefined}>{t('participants.presence.appliquer')}</button
        >
      </div>
      {#if refusPresence !== null}
        <div class="refus" {@attach montrer}>
          <Refus id={idRefusPresence} refus={refusPresence} lever={() => (refusPresence = null)} />
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
          <tr data-itineraire-tour={etape.tour}>
            <td>{etape.tour}</td>
            {#if etape.reserve}
              <td colspan="2">{t('participants.fiche.enReserve')}</td>
            {:else if etape.absente}
              <td colspan="2">{t('participants.fiche.absente')}</td>
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

  {#if rencontres.statut !== 'sansPlacement'}
    <section class="rencontres" data-rubrique-rencontres aria-labelledby={`${uid}-titre-rencontres`}>
      <h4 id={`${uid}-titre-rencontres`}>{t('participants.fiche.rencontres.titre')}</h4>
      <p class="source">
        <span>{t('participants.fiche.rencontres.intitule')}</span>
        <span class="placement">{t(rencontres.source.cle, rencontres.source.details)}</span>
      </p>
      {#if rencontres.statut === 'exclue'}
        <p>{t('participants.fiche.rencontres.exclue')}</p>
      {:else if rencontres.statut === 'nonMesurable'}
        <p>{t('participants.fiche.rencontres.nonMesurable')}</p>
      {:else if rencontres.lignes.length === 0}
        <p>{t('participants.fiche.rencontres.aucune')}</p>
      {:else}
        <table>
          <thead>
            <tr>
              <th scope="col">{t('participants.fiche.rencontres.personne')}</th>
              <th scope="col" class="fois">{t('participants.fiche.rencontres.fois')}</th>
              <th scope="col">{t('participants.fiche.rencontres.tours')}</th>
            </tr>
          </thead>
          <tbody>
            {#each rencontres.lignes as rencontre (rencontre.id)}
              <tr>
                <th scope="row">
                  <span class="nom">{rencontre.nom}</span>
                  {#if rencontre.homonyme}
                    <span class="secondaire">{t('qualite.paires.homonyme', { id: rencontre.id })}</span>
                  {/if}
                  {#if rencontre.appartenance !== null}
                    <span class="secondaire">{rencontre.appartenance}</span>
                  {/if}
                </th>
                <td class="fois">{rencontre.fois}</td>
                <td>{rencontre.tours.map((etape) => t('participants.fiche.rencontres.tour', etape)).join(' ; ')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>
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

  /* Les étiquettes et la présence : l'intitulé en petites capitales, puis,
     pour les étiquettes, les pastilles en rangée qui se replie, chacune
     suivie, en écriture, de sa croix de retrait ; puis le champ d'ajout et
     son bouton sur une ligne, le refus ou le signal dessous ; pour la
     présence, son résumé de l'encre de la page, les cases, leurs deux
     boutons sur une ligne, le refus dessous. */
  .etiquettes,
  .presence {
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

  .etiquettes p,
  .presence p {
    margin: 0;
  }

  .presence .resume {
    color: var(--couleur-page-texte);
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
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

  /* La rubrique des rencontres : l'intitulé en petites capitales, la ligne
     de source, le placement en gras, puis le tableau ; l'intitulé de ligne
     sur le fond de la carte, le nombre de fois aligné à droite. */
  .rencontres {
    margin: var(--espace-3) 0;
  }

  .rencontres .source {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--espace-1);
  }

  .placement {
    color: var(--couleur-page-texte);
    font-weight: bold;
  }

  .rencontres tbody th {
    background-color: var(--couleur-carte-fond);
    border-bottom-color: var(--couleur-ligne-filet);
    font-weight: normal;
  }

  /* Une personne rencontrée : son nom, puis l'identifiant d'un homonyme et
     son appartenance, chacun à la ligne, en petit corps d'encre secondaire. */
  .rencontres tbody th .secondaire {
    display: block;
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }

  .fois {
    width: 4rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
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
