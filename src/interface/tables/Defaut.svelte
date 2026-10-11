<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le nombre de places par défaut (§ 6.1) : son champ, puis, avant toute
  // application, l'énoncé chiffré de son changement. Une saisie validée ne
  // s'applique pas : elle devient la demande, dont l'énoncé se calcule sur
  // la charge courante (bilanChangementDefaut, enonceDefaut). Accepté, il
  // offre « Appliquer » et, quand des tables sont surchargées, « Appliquer
  // et réaligner », dont la fenêtre à confirmer nomme les surcharges
  // perdues ; refusé, il nomme chaque table qui refuse et n'offre aucune
  // application. Le réalignement a son propre bilan, avec realigner : une
  // surchargée qui ne peut descendre au nouveau défaut le refuse. Refusé, le
  // clic n'ouvre aucune fenêtre ; le refus se pose sous les commandes,
  // chaque table nommée par son numéro, et « Appliquer » reste offert. « Garder le défaut actuel » retire la demande et remonte le
  // champ, qui rend la valeur enregistrée. Un refus de l'événement entier —
  // moins de 2 places — se pose sur le champ (refusDuChampDefaut).
  //
  // L'énoncé se pose sur le fond sourd de la carte ; le refus d'une table
  // en refus, un avertissement en avis, chacun son signe et un texte de
  // l'encre de la page.
  //
  // La demande tombe quand le défaut l'atteint ; appliquée, elle tombe, et
  // les avertissements du geste s'affichent tant que la révision qui les a
  // produits est la courante.
  import { getContext } from 'svelte';
  import { bilanChangementDefaut } from '../../application/bilans.js';
  import { lireEntier } from '../../application/capacite.js';
  import { ErreurCommande } from '../../application/erreurs.js';
  import Champ from '../primitives/Champ.svelte';
  import Commande from '../primitives/Commande.svelte';
  import Confirmation from '../primitives/Confirmation.svelte';
  import Icone from '../primitives/Icone.svelte';
  import { actionRemede } from '../primitives/commande.js';
  import { avertissementsNommes, enonceDefaut, refusDuChampDefaut, surchargesPerdues } from './modele.js';

  let { charge, revision } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui') ?? null;

  // Le défaut demandé, pas encore appliqué ; le rang du champ, qui le
  // remonte ; la fenêtre du réalignement ; le rendu du dernier geste.
  let demande = $state(null);
  let rangChamp = $state(0);
  let fenetreRealigner = $state.raw(null);
  let realignementTente = $state(false);
  let dernier = $state.raw(null);

  const enAttente = $derived(demande !== null && demande !== charge.evenement.siegesParDefaut ? demande : null);
  const bilan = $derived(enAttente === null ? null : bilanChangementDefaut(charge, enAttente));
  const entrees = $derived(bilan === null ? [] : enonceDefaut(bilan, charge.tables));
  const refuse = $derived(bilan !== null && bilan.refus.length > 0);
  const bilanRealigne = $derived(
    bilan === null || refuse || bilan.surchargees.length === 0
      ? null
      : bilanChangementDefaut(charge, enAttente, { realigner: true }),
  );
  const refusRealigne = $derived(
    realignementTente && bilanRealigne !== null && bilanRealigne.refus.length > 0
      ? enonceDefaut(bilanRealigne, charge.tables, { realigner: true })
      : [],
  );
  const avertissements = $derived(
    dernier !== null && dernier.revision === revision ? avertissementsNommes(charge, dernier.avertissements) : [],
  );

  // Le refus courant de la séance, levé avant d'ouvrir une fenêtre : la
  // séance l'aurait levé à l'exécution, et la fenêtre n'annonce rien qui ne
  // s'appliquerait pas.
  function exigerModifiable() {
    const refus = seance.etat().refus;
    if (refus !== null) throw new ErreurCommande(refus.code, refus.details);
  }

  // Une saisie lue : le bilan de ce défaut, son refus de l'événement entier
  // posé sur le champ, sinon la demande.
  function demander(sieges) {
    const refus = refusDuChampDefaut(bilanChangementDefaut(charge, sieges));
    if (refus !== null) throw new ErreurCommande(refus.code, refus.details);
    demande = sieges;
    realignementTente = false;
    dernier = null;
  }

  async function appliquer(realigner) {
    const sieges = enAttente;
    const rendu = await seance.executer('changerDefaut', { sieges, realigner });
    demande = null;
    realignementTente = false;
    dernier = { revision: seance.etat().evenement.revision, avertissements: rendu.avertissements };
  }

  // Le réalignement que son bilan refuse pose son refus et n'ouvre rien :
  // la fenêtre n'annonce que ce qui s'appliquera.
  function ouvrirRealignement() {
    exigerModifiable();
    realignementTente = bilanRealigne.refus.length > 0;
    if (realignementTente) return;
    fenetreRealigner = surchargesPerdues(charge).map(({ cle, details }) => t(cle, details));
  }

  async function confirmerRealignement() {
    await appliquer(true);
    fenetreRealigner = null;
  }

  function garder() {
    demande = null;
    realignementTente = false;
    rangChamp += 1;
  }
</script>

<!-- Le refus d'une table, nommée par son numéro, et le remède qu'il offre. -->
{#snippet refusDeTable(entree)}
  {@const action = actionRemede(entree.details.refus.details.remede ?? null, { seance, ui })}
  <div class="refus" data-refus={entree.details.refus.code}>
    <span class="signe"><Icone nom="interdit" /></span>
    <p><span data-phrase>{t(entree.cle, entree.details)}</span></p>
    {#if action !== null}
      <Commande
        cle={action.cle}
        details={action.details}
        nom={action.nom}
        confirmer={action.confirmer}
        executer={action.executer}
      />
    {/if}
  </div>
{/snippet}

<div class="defaut" data-defaut>
  {#key rangChamp}
    <Champ
      cle="siegesParDefaut"
      etiquette="tables.defaut.etiquette"
      valeur={charge.evenement.siegesParDefaut}
      lire={lireEntier}
      executer={demander}
    />
  {/key}

  {#if enAttente !== null}
    <div class="enonce" data-enonce="defaut" role="status">
      {#if refuse}
        {#each entrees as entree, rang (rang)}
          {#if rang === 0}
            <p><span data-phrase>{t(entree.cle, entree.details)}</span></p>
          {:else}
            {@render refusDeTable(entree)}
          {/if}
        {/each}
      {:else}
        <p>
          {#each entrees as entree, rang (rang)}{#if rang > 0}{' '}{/if}<span data-phrase
              >{t(entree.cle, entree.details)}</span
            >{/each}
        </p>
      {/if}
      <div class="issues">
        {#if !refuse}
          <Commande cle="tables.defaut.appliquer" nom="appliquer" executer={() => appliquer(false)} />
          {#if bilan.surchargees.length > 0}
            <Commande
              cle="tables.defaut.appliquerRealigner"
              details={{ n: bilan.surchargees.length }}
              nom="appliquerRealigner"
              executer={ouvrirRealignement}
            />
          {/if}
        {/if}
        <Commande cle="tables.defaut.garder" nom="garder" executer={garder} />
      </div>
      {#if refusRealigne.length > 0}
        <div class="realignement" data-refus-realigner>
          {#each refusRealigne as entree, rang (rang)}
            {#if rang === 0}
              <p><span data-phrase>{t(entree.cle, entree.details)}</span></p>
            {:else}
              {@render refusDeTable(entree)}
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#each avertissements as avertissement, rang (rang)}
    <div class="avertissement" data-avertissement={avertissement.code} role="status">
      <span class="signe"><Icone nom="triangle" /></span>
      {#if avertissement.numero !== null}
        <p><span>{t('tables.liste.table')}</span> <span>{avertissement.numero}</span></p>
      {/if}
      <p>{t(avertissement.code, avertissement.details)}</p>
      {#if avertissement.noms.length > 0}
        <ul>
          {#each avertissement.noms as nom, rangNom (rangNom)}
            <li>{nom}</li>
          {/each}
        </ul>
      {/if}
    </div>
  {/each}

  {#if fenetreRealigner !== null}
    <Confirmation
      titre="tables.defaut.confirmationRealigner"
      details={{ n: fenetreRealigner.length }}
      elements={fenetreRealigner}
      surConfirmer={confirmerRealignement}
      surAnnuler={() => (fenetreRealigner = null)}
    />
  {/if}
</div>

<style>
  .defaut {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    max-width: 40rem;
  }

  .enonce {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    padding: var(--espace-3);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond-sourd);
  }

  .enonce p {
    margin: 0;
  }

  /* Le refus d'une table : le signe à gauche, la phrase et le remède
     dessous l'un de l'autre, à sa droite. */
  .refus {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: var(--espace-1) var(--espace-2);
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-refus-filet);
    border-left: 3px solid var(--couleur-refus-marque);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-refus-fond);
    color: var(--couleur-page-texte);
  }

  .refus > :not(.signe) {
    grid-column: 2;
  }

  .refus .signe {
    color: var(--couleur-refus-marque);
  }

  .realignement {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  .realignement p {
    margin: 0;
  }

  .issues {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }

  .avertissement {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: var(--espace-1) var(--espace-2);
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-avis-filet);
    border-left: 3px solid var(--couleur-avis-marque);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-avis-fond);
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte);
  }

  .avertissement > :not(.signe) {
    grid-column: 2;
  }

  .avertissement .signe {
    color: var(--couleur-avis-marque);
  }

  .signe {
    display: inline-flex;
    grid-row: 1 / span 3;
    padding-top: 0.125rem;
  }

  .avertissement p,
  .avertissement ul {
    margin: 0;
  }

  .refus p {
    margin: 0;
  }
</style>
