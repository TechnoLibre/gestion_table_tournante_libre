<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La liste des tables (§ 4, § 6.1, § 6.2) : une carte, dont l'en-tête
  // compte les tables et leurs sièges (comptesTables) et porte la création,
  // ronde ou carrée ; puis une ligne par table, par numéro — son numéro, sa
  // forme, son état en pastille (« suit le défaut » ou « surchargée »,
  // etatTable, de ton tonEtatTable), le champ de ses places, « Réaligner »
  // pour une surchargée, « Supprimer ». Le champ
  // montre la capacité ; une saisie lue par lireEntier s'exécute par
  // changerPlacesTable, au champ, et son refus se pose contre lui.
  //
  // Chaque ligne porte le complément de son dernier geste, tant que la
  // révision qui l'a vu est la courante : les sièges qu'un refus
  // SIEGES_RETIRES retire, nommés (siegesRetiresNommes), ou les
  // avertissements d'un geste accepté, leurs personnes nommées
  // (avertissementsNommes) : les sièges retirés en refus, les
  // avertissements en avis, chacun son signe et un texte de l'encre de la
  // page. Une frappe dans le champ, ou Échap, retire le
  // complément d'un refus avec le refus que le champ retire.
  //
  // Supprimer une table qui porte une réservation ou un titre ouvre la
  // fenêtre à confirmer, qui les nomme (bilanSuppressionTable) ; une table
  // nue part sans fenêtre.
  import { getContext } from 'svelte';
  import { on } from 'svelte/events';
  import { bilanSuppressionTable } from '../../application/bilans.js';
  import { lireEntier } from '../../application/capacite.js';
  import { ErreurCommande } from '../../application/erreurs.js';
  import Carte from '../primitives/Carte.svelte';
  import Champ from '../primitives/Champ.svelte';
  import Commande from '../primitives/Commande.svelte';
  import Confirmation from '../primitives/Confirmation.svelte';
  import Icone from '../primitives/Icone.svelte';
  import Pastille from '../primitives/Pastille.svelte';
  import { effetDe } from '../raccourcis.js';
  import {
    annonceSuppression,
    avertissementsNommes,
    cleForme,
    comptesTables,
    elementsSuppression,
    etatTable,
    siegesRetiresNommes,
    tablesParNumero,
    tonEtatTable,
  } from './modele.js';

  let { charge, revision } = $props();

  const t = getContext('t');
  const seance = getContext('seance');

  const tables = $derived(tablesParNumero(charge));
  const comptes = $derived(comptesTables(charge));

  // Le complément de chaque ligne, par identifiant de table :
  // { revision, retires, avertissements }. La fenêtre de suppression
  // ouverte : la table et ce qu'elle nomme.
  let complements = $state({});
  let suppression = $state.raw(null);

  const complementDe = (id) => {
    const complement = complements[id];
    return complement !== undefined && complement.revision === revision ? complement : null;
  };

  function oublier(id) {
    delete complements[id];
  }

  // Le refus courant de la séance, levé avant d'ouvrir une fenêtre.
  function exigerModifiable() {
    const refus = seance.etat().refus;
    if (refus !== null) throw new ErreurCommande(refus.code, refus.details);
  }

  // Exécute une commande sur la table id ; son complément suit le rendu ou
  // le refus.
  async function executerSurTable(id, nom, args) {
    oublier(id);
    try {
      const rendu = await seance.executer(nom, args);
      const etat = seance.etat();
      complements[id] = {
        revision: etat.evenement.revision,
        retires: [],
        avertissements: avertissementsNommes(etat.charge, rendu.avertissements),
      };
    } catch (erreur) {
      if (erreur?.code === 'SIEGES_RETIRES') {
        const etat = seance.etat();
        complements[id] = { revision: etat.evenement.revision, retires: siegesRetiresNommes(etat.charge, erreur), avertissements: [] };
      }
      throw erreur;
    }
  }

  function supprimer(table) {
    exigerModifiable();
    const bilan = bilanSuppressionTable(charge, table.id);
    if (!annonceSuppression(bilan)) return seance.executer('supprimerTable', { id: table.id });
    suppression = {
      id: table.id,
      numero: table.numero,
      elements: elementsSuppression(charge, bilan).map(({ cle, details }) => t(cle, details)),
    };
    return undefined;
  }

  async function confirmerSuppression() {
    await seance.executer('supprimerTable', { id: suppression.id });
    suppression = null;
  }

  // Une frappe ou Échap dans le champ de la table id retire le complément
  // de son refus : le champ retire le refus au même instant.
  const suivreSaisie = (id) => (element) => {
    const arrets = [
      on(element, 'input', () => oublier(id)),
      on(element, 'keydown', (evenement) => {
        if (effetDe('champ', evenement.key) === 'rendre') oublier(id);
      }),
    ];
    return () => {
      for (const arreter of arrets) arreter();
    };
  };
</script>

<Carte titre={t('tables.liste.titre')} sousTitre={t('tables.liste.comptes', comptes)} niveau={3} plein>
  {#snippet actions()}
    <Commande cle="tables.creer.ronde" nom="creerTableRonde" executer={() => seance.executer('creerTable', { forme: 'ronde' })} />
    <Commande cle="tables.creer.carree" nom="creerTableCarree" executer={() => seance.executer('creerTable', { forme: 'carree' })} />
  {/snippet}

  {#if tables.length === 0}
    <p class="aucune">{t('tables.liste.aucune')}</p>
  {:else}
    <ul class="tables">
      {#each tables as table (table.id)}
        {@const etat = etatTable(table, charge.evenement.siegesParDefaut)}
        {@const complement = complementDe(table.id)}
        <li data-table={table.id}>
          <div class="entete">
            <span class="numero"><span>{t('tables.liste.table')}</span> <span>{table.numero}</span></span>
            <span class="forme">{t(cleForme(table.forme))}</span>
            <span class="etat" data-etat-table><Pastille sorte="statut" valeur={tonEtatTable(etat)} libelle={t(etat.cle)} /></span>
          </div>
          <div class="saisie" {@attach suivreSaisie(table.id)}>
            <Champ
              cle={`sieges-${table.id}`}
              etiquette="tables.liste.places"
              valeur={etat.capacite}
              lire={lireEntier}
              executer={(sieges) => executerSurTable(table.id, 'changerPlacesTable', { id: table.id, sieges, origine: 'champ' })}
            />
          </div>
          <div class="commandes">
            {#if etat.realignable}
              <Commande
                cle="tables.liste.realigner"
                nom="realignerTable"
                executer={() => executerSurTable(table.id, 'realignerTable', { id: table.id })}
              />
            {/if}
            <Commande cle="tables.liste.supprimer" nom="supprimerTable" executer={() => supprimer(table)} />
          </div>
          {#if complement !== null && complement.retires.length > 0}
            <div class="message refus">
              <span class="signe"><Icone nom="interdit" /></span>
              <ul class="retires" data-sieges-retires>
                {#each complement.retires as retire, rang (rang)}
                  <li>{t(retire.cle, retire.details)}{#if retire.nom !== null}{' '}<span>{retire.nom}</span>{/if}</li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if complement !== null}
            {#each complement.avertissements as avertissement, rang (rang)}
              <div class="message avis" data-avertissement={avertissement.code} role="status">
                <span class="signe"><Icone nom="triangle" /></span>
                <div class="texte">
                  <p>{t(avertissement.code, avertissement.details)}</p>
                  {#if avertissement.noms.length > 0}
                    <ul>
                      {#each avertissement.noms as nom, rangNom (rangNom)}
                        <li>{nom}</li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              </div>
            {/each}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</Carte>

{#if suppression !== null}
  <Confirmation
    titre="tables.suppression.confirmation"
    details={{ numero: suppression.numero }}
    elements={suppression.elements}
    surConfirmer={confirmerSuppression}
    surAnnuler={() => (suppression = null)}
  />
{/if}

<style>
  .aucune {
    margin: 0;
    padding: var(--espace-4) var(--espace-5);
    color: var(--couleur-page-texte-secondaire);
  }

  .tables {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Une table par ligne : en-tête, champ et commandes sur une rangée tant
     qu'elle les tient, les messages dessous, sur toute la largeur. */
  .tables > li {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--espace-2) var(--espace-5);
    padding: var(--espace-3) var(--espace-5);
    border-bottom: 1px solid var(--couleur-ligne-filet);
  }

  .tables > li:last-child {
    border-bottom: none;
  }

  .entete {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2) var(--espace-3);
    min-width: 12rem;
    align-self: center;
  }

  .numero {
    font-weight: bold;
    font-variant-numeric: tabular-nums;
  }

  .forme {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }

  .etat {
    display: flex;
    min-width: 0;
  }

  .commandes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
    margin-left: auto;
  }

  /* Un message de ligne : son signe, un texte de l'encre de la page, sur
     le fond de sa sorte. */
  .message {
    display: flex;
    flex-basis: 100%;
    align-items: flex-start;
    gap: var(--espace-2);
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid;
    border-left-width: 3px;
    border-radius: var(--rayon-2);
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte);
  }

  .signe {
    display: inline-flex;
    flex: none;
    padding-top: 0.125rem;
  }

  .refus {
    border-color: var(--couleur-refus-filet);
    border-left-color: var(--couleur-refus-marque);
    background-color: var(--couleur-refus-fond);
  }

  .refus .signe {
    color: var(--couleur-refus-marque);
  }

  .avis {
    border-color: var(--couleur-avis-filet);
    border-left-color: var(--couleur-avis-marque);
    background-color: var(--couleur-avis-fond);
  }

  .avis .signe {
    color: var(--couleur-avis-marque);
  }

  .retires,
  .texte ul {
    margin: 0;
    padding-left: var(--espace-5);
  }

  .texte p {
    margin: 0;
  }
</style>
