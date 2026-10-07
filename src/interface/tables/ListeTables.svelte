<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La liste des tables (§ 4, § 6.1, § 6.2) : la création, ronde ou carrée,
  // puis une ligne par table, par numéro — son numéro, sa forme, son état
  // (« suit le défaut » ou « surchargée », etatTable), le champ de ses
  // places, « Réaligner » pour une surchargée, « Supprimer ». Le champ
  // montre la capacité ; une saisie lue par lireEntier s'exécute par
  // changerPlacesTable, au champ, et son refus se pose contre lui.
  //
  // Chaque ligne porte le complément de son dernier geste, tant que la
  // révision qui l'a vu est la courante : les sièges qu'un refus
  // SIEGES_RETIRES retire, nommés (siegesRetiresNommes), ou les
  // avertissements d'un geste accepté, leurs personnes nommées
  // (avertissementsNommes). Une frappe dans le champ, ou Échap, retire le
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
  import Champ from '../primitives/Champ.svelte';
  import Commande from '../primitives/Commande.svelte';
  import Confirmation from '../primitives/Confirmation.svelte';
  import {
    annonceSuppression,
    avertissementsNommes,
    cleForme,
    elementsSuppression,
    etatTable,
    siegesRetiresNommes,
    tablesParNumero,
  } from './modele.js';

  let { charge, revision } = $props();

  const t = getContext('t');
  const seance = getContext('seance');

  const tables = $derived(tablesParNumero(charge));

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
        if (evenement.key === 'Escape') oublier(id);
      }),
    ];
    return () => {
      for (const arreter of arrets) arreter();
    };
  };
</script>

<div class="liste">
  <h3>{t('tables.liste.titre')}</h3>
  <div class="creation">
    <Commande cle="tables.creer.ronde" nom="creerTableRonde" executer={() => seance.executer('creerTable', { forme: 'ronde' })} />
    <Commande cle="tables.creer.carree" nom="creerTableCarree" executer={() => seance.executer('creerTable', { forme: 'carree' })} />
  </div>

  {#if tables.length === 0}
    <p>{t('tables.liste.aucune')}</p>
  {:else}
    <ul class="tables">
      {#each tables as table (table.id)}
        {@const etat = etatTable(table, charge.evenement.siegesParDefaut)}
        {@const complement = complementDe(table.id)}
        <li data-table={table.id}>
          <div class="entete">
            <span class="numero"><span>{t('tables.liste.table')}</span> <span>{table.numero}</span></span>
            <span>{t(cleForme(table.forme))}</span>
            <span class="etat" data-etat-table>{t(etat.cle)}</span>
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
          {#if complement !== null && complement.retires.length > 0}
            <ul class="retires" data-sieges-retires>
              {#each complement.retires as retire, rang (rang)}
                <li>{t(retire.cle, retire.details)}{#if retire.nom !== null}{' '}<span>{retire.nom}</span>{/if}</li>
              {/each}
            </ul>
          {/if}
          {#if complement !== null}
            {#each complement.avertissements as avertissement, rang (rang)}
              <div class="avertissement" data-avertissement={avertissement.code} role="status">
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
          {/if}
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
        </li>
      {/each}
    </ul>
  {/if}

  {#if suppression !== null}
    <Confirmation
      titre="tables.suppression.confirmation"
      details={{ numero: suppression.numero }}
      elements={suppression.elements}
      surConfirmer={confirmerSuppression}
      surAnnuler={() => (suppression = null)}
    />
  {/if}
</div>

<style>
  .liste {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
  }

  h3 {
    margin: 0;
    font-size: var(--taille-texte);
  }

  .creation,
  .commandes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }

  .tables {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tables > li {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
  }

  .entete {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-3);
  }

  .numero {
    font-weight: bold;
  }

  /* L'état se lit par son texte ; l'italique le détache de la forme. */
  .etat {
    font-style: italic;
  }

  .retires {
    margin: 0;
    padding-left: var(--espace-5);
    color: var(--couleur-refus);
  }

  .avertissement {
    padding: var(--espace-1) var(--espace-2);
    border-left: 3px solid var(--couleur-avis);
    font-size: var(--taille-texte);
  }

  .avertissement p,
  .avertissement ul {
    margin: 0;
  }
</style>
