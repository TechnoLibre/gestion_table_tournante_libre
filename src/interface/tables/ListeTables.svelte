<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La liste des tables (§ 4, § 6.1, § 6.2) : une carte, dont l'en-tête
  // compte les tables et leurs sièges (comptesTables) et porte la création,
  // ronde ou carrée ; puis une ligne par table, par numéro — son numéro, sa
  // forme, son état en pastille (« suit le défaut » ou « surchargée »,
  // etatTable, de ton tonEtatTable), le champ de son libellé, celui de ses
  // places, « Réaligner » pour une surchargée, « Supprimer ». Le champ des
  // places montre la capacité ; une saisie lue par lireEntier s'exécute par
  // changerPlacesTable, au champ, et son refus se pose contre lui. Le champ
  // du libellé montre le libellé de la table, vide sans lui ; la saisie se
  // lit en NFC, ses blancs de bord retirés — la même qu'un libellé
  // enregistré ne relance rien —, et s'exécute par changerLibelleTable, qui
  // la retire quand elle est vide ; son refus, un libellé trop long, se pose
  // contre le champ.
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
  // Supprimer une table qui porte une réservation, un titre ou un objectif
  // ouvre la fenêtre à confirmer, qui les nomme (bilanSuppressionTable) ;
  // une table nue part sans fenêtre.
  //
  // Les objectifs d'une table (§ 4.5, D3, D19) se posent sous sa ligne :
  // l'objectif de la soirée, puis le bouton « Objectifs par tour », qui
  // déplie un objectif par tour et compte ceux qui existent (objectifs.js).
  // Chaque objectif a son champ d'étiquettes, que le datalist des étiquettes
  // connues complète, et le choix de sa règle (ChoixRegle) — le réglage
  // général, « au moins une (OU) », « toutes (ET) ». Une saisie validée
  // part à poserObjectif sous la règle choisie : celle de l'objectif posé,
  // ou, pour un objectif neuf, celle que son choix tient sans rien écrire,
  // le réglage général à défaut ; un seul geste, une seule entrée. Vider le
  // champ d'un objectif posé est refusé contre lui, avec le remède
  // « Retirer l'objectif ». Un objectif posé montre en plus son état en
  // mots, « suit la règle par défaut » ou « règle propre », et « Retirer
  // l'objectif », sans fenêtre : un retour à l'instant précédent le rend, et
  // le focus passe à son champ. Ses avis — personne ne lui correspond, une
  // étiquette que personne ne porte — se lisent contre lui, tant qu'ils
  // tiennent ; une orthographe retenue au dernier geste aussi, tant que sa
  // révision est la courante. Un refus de la séance se pose contre le
  // champ, par Champ, ou contre le choix de la règle, qui le désigne par
  // aria-describedby et montre alors la règle de la charge, ou le choix
  // tenu d'un objectif neuf.
  //
  // Les commandes que chaque table répète — ses places, « Réaligner »,
  // « Supprimer », le bouton qui déplie, et pour chaque objectif son champ,
  // le choix de sa règle et « Retirer l'objectif » — portent un nom
  // accessible qui nomme leur table, et l'objectif pour ce qui ne le dit
  // pas déjà (tables.nom.table, tables.nom.objectif) : leur texte visible,
  // puis ce qui les distingue, par la prop nom de Champ et de ChoixRegle,
  // nomAccessible de Commande. Le remède d'un refus posé contre l'une
  // d'elles se nomme par son texte puis par ce nom (Refus, objet). Le texte
  // affiché ne change pas.
  //
  // « Exporter les objectifs » (§ 10.4) remet les octets d'exporterObjectifs
  // à facade.enregistrerSous, sous le nom ‹base›-objectifs.csv
  // (nomExportObjectifs), comme l'export des participants : sortir n'est pas
  // modifier, elle part en lecture et sur un plan bloqué.
  import { getContext, tick } from 'svelte';
  import { on } from 'svelte/events';
  import { bilanSuppressionTable } from '../../application/bilans.js';
  import { lireEntier } from '../../application/capacite.js';
  import { exporterObjectifs } from '../../application/csv.js';
  import { ErreurCommande } from '../../application/erreurs.js';
  import Carte from '../primitives/Carte.svelte';
  import Champ from '../primitives/Champ.svelte';
  import Commande from '../primitives/Commande.svelte';
  import Confirmation from '../primitives/Confirmation.svelte';
  import Icone from '../primitives/Icone.svelte';
  import Pastille from '../primitives/Pastille.svelte';
  import Refus from '../primitives/Refus.svelte';
  import { effetDe } from '../raccourcis.js';
  import ChoixRegle from './ChoixRegle.svelte';
  import {
    basculerTable,
    etiquettesConnues,
    nomExportObjectifs,
    objectifsDeLaTable,
    optionsRegle,
    regleChoisie,
    regleParDefaut,
  } from './objectifs.js';
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
  const facade = getContext('facade');
  const uid = $props.id();
  const idConnues = `${uid}-etiquettes`;

  const tables = $derived(tablesParNumero(charge));
  const comptes = $derived(comptesTables(charge));
  const connues = $derived(etiquettesConnues(charge));
  const options = $derived(optionsRegle(regleParDefaut(charge)).map(({ valeur, cle, details }) => ({ valeur, libelle: t(cle, details) })));

  // Les tables dont les objectifs par tour sont dépliés ; par clé
  // d'objectif, les orthographes retenues de son dernier geste
  // { revision, avertissements }, le refus de son choix de règle, et, pour
  // un objectif neuf, la valeur que son choix tient jusqu'à la saisie.
  let ouvertes = $state.raw(new Set());
  let retenues = $state({});
  let refusRegle = $state({});
  let reglesNeuves = $state({});

  // La valeur du choix de règle d'un objectif : la sienne quand il existe,
  // celle que tient le choix d'un objectif neuf sinon, vide à défaut.
  const valeurRegle = (vue) => (vue.existe ? vue.regle : (reglesNeuves[vue.cle] ?? ''));

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

  // Les orthographes retenues du dernier geste sur l'objectif de clé donnée,
  // tant que sa révision est la courante.
  const retenuesDe = (cle) => {
    const note = retenues[cle];
    return note !== undefined && note.revision === revision ? note.avertissements : [];
  };

  // Pose l'objectif de la table au tour de vue : la saisie texte, sous la
  // règle donnée, par défaut celle de son choix (valeurRegle). Posé, il
  // porte sa règle : le choix tenu d'un objectif neuf s'oublie.
  async function poser(table, vue, texte, regle = regleChoisie(valeurRegle(vue))) {
    delete retenues[vue.cle];
    const rendu = await seance.executer('poserObjectif', { table: table.id, tour: vue.tour, etiquettes: texte, regle });
    delete reglesNeuves[vue.cle];
    retenues[vue.cle] = {
      revision: seance.etat().evenement.revision,
      avertissements: rendu.avertissements.filter(({ code }) => code === 'ORTHOGRAPHE_RETENUE'),
    };
  }

  // Le choix d'une règle : l'objectif posé se repose, mêmes étiquettes,
  // sous elle, et le sélecteur montre ensuite la règle de la charge, écrite
  // ou non. Pour un objectif neuf, le choix est tenu sans rien écrire ; le
  // refus courant de la séance le refuse aussitôt, comme la première
  // frappe d'un champ, et le choix rend sa valeur précédente.
  async function choisirRegle(evenement, table, vue) {
    const choix = evenement.currentTarget;
    delete refusRegle[vue.cle];
    if (!vue.existe) {
      const refus = seance.etat().refus;
      if (refus === null) reglesNeuves[vue.cle] = choix.value;
      else {
        refusRegle[vue.cle] = { code: refus.code, details: refus.details ?? {} };
        choix.value = valeurRegle(vue);
      }
      return;
    }
    try {
      await poser(table, vue, vue.texte, regleChoisie(choix.value));
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refusRegle[vue.cle] = { code: erreur.code, details: erreur.details ?? {} };
    } finally {
      const courante = seance.etat().charge?.tables.find(({ id }) => id === table.id);
      choix.value = courante?.objectifs?.find((objectif) => objectif.tour === vue.tour)?.regle ?? '';
    }
  }

  // Retire l'objectif de vue ; son retrait ôte le bouton cliqué, et le
  // focus passe au champ de l'objectif, qui reste.
  async function retirer(table, vue) {
    await seance.executer('retirerObjectif', { table: table.id, tour: vue.tour });
    await tick();
    document.getElementById(`${uid}-objectif-${vue.cle}`)?.querySelector('input')?.focus();
  }

  async function exporterLesObjectifs() {
    const { evenement, charge: courante } = seance.etat();
    await facade.enregistrerSous(nomExportObjectifs(evenement.base), exporterObjectifs(courante.tables));
  }

  // Le champ d'un objectif propose les étiquettes connues : son entrée
  // porte la liste du datalist de la carte.
  const avecConnues = (element) => {
    for (const entree of element.querySelectorAll('input')) entree.setAttribute('list', idConnues);
  };

  // La saisie d'étiquettes se lit telle quelle : poserObjectif la découpe,
  // la met en forme et la refuse.
  const lireTexte = (texte) => ({ valeur: texte });

  // La saisie d'un libellé, comme changerLibelleTable la reçoit.
  const lireLibelle = (texte) => ({ valeur: texte.normalize('NFC').trim() });

  // Les noms d'une commande de la table numero : son texte, sous ses
  // détails, puis la table ; et pour un objectif, son texte, la portée de
  // vue, puis la table.
  const nomDeTable = (numero, cle, details = {}) => t('tables.nom.table', { cle, details, numero });
  const nomDObjectif = (numero, cle, vue) => t('tables.nom.objectif', { cle, tour: vue.tour, numero });

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

<!-- Un objectif d'une table, celui de la soirée ou d'un tour (vue). Sa
     portée se pose en littéral, une branche par valeur : la garde des
     désignations en tient la liste fermée. -->
{#snippet objectif(table, vue)}
  {#if vue.tour === null}
    <div class="objectif" id={`${uid}-objectif-${vue.cle}`} data-objectif={vue.cle} data-portee="tous">
      {@render contenuObjectif(table, vue)}
    </div>
  {:else}
    <div class="objectif" id={`${uid}-objectif-${vue.cle}`} data-objectif={vue.cle} data-portee="tour">
      {@render contenuObjectif(table, vue)}
    </div>
  {/if}
{/snippet}

{#snippet contenuObjectif(table, vue)}
  {@const refusDuChoix = refusRegle[vue.cle] ?? null}
  {@const idRegle = `${uid}-regle-${vue.cle}`}
  {@const idRefusRegle = `${idRegle}-refus`}
  <div class="ligne-objectif">
    <div class="saisie-objectif" {@attach avecConnues}>
      <Champ
        cle={`objectif-${vue.cle}`}
        etiquette={vue.tour === null ? 'tables.objectif.soiree' : 'tables.objectif.tour'}
        details={{ tour: vue.tour }}
        nom={nomDeTable(table.numero, vue.tour === null ? 'tables.objectif.soiree' : 'tables.objectif.tour', { tour: vue.tour })}
        valeur={vue.texte}
        lire={lireTexte}
        executer={(texte) => poser(table, vue, texte)}
      />
    </div>
    <div class="regle-objectif">
      <label for={idRegle}>{t('tables.objectif.regle')}</label>
      <ChoixRegle
        id={idRegle}
        champ={`regle-${vue.cle}`}
        valeur={valeurRegle(vue)}
        {options}
        idRefus={refusDuChoix === null ? null : idRefusRegle}
        nom={nomDObjectif(table.numero, 'tables.objectif.regle', vue)}
        surChoix={(evenement) => choisirRegle(evenement, table, vue)}
      />
    </div>
    {#if vue.existe}
      <span class="etat-regle"><Pastille sorte="statut" valeur={vue.etat.ton} libelle={t(vue.etat.cle)} /></span>
      <Commande
        cle="tables.objectif.retirer"
        nom="retirerObjectif"
        nomAccessible={nomDObjectif(table.numero, 'tables.objectif.retirer', vue)}
        executer={() => retirer(table, vue)}
      />
    {/if}
  </div>
  {#if refusDuChoix !== null}
    <Refus
      id={idRefusRegle}
      refus={refusDuChoix}
      lever={() => delete refusRegle[vue.cle]}
      objet={nomDObjectif(table.numero, 'tables.objectif.regle', vue)}
    />
  {/if}
  {#each [...retenuesDe(vue.cle), ...vue.avis] as avis, rang (rang)}
    <div class="message avis" data-avertissement={avis.code} role="status">
      <span class="signe"><Icone nom="triangle" /></span>
      <div class="texte"><p>{t(avis.code, avis.details)}</p></div>
    </div>
  {/each}
{/snippet}

<Carte titre={t('tables.liste.titre')} sousTitre={t('tables.liste.comptes', comptes)} niveau={3} plein>
  {#snippet actions()}
    <Commande cle="tables.creer.ronde" nom="creerTableRonde" executer={() => seance.executer('creerTable', { forme: 'ronde' })} />
    <Commande cle="tables.creer.carree" nom="creerTableCarree" executer={() => seance.executer('creerTable', { forme: 'carree' })} />
    <Commande cle="tables.objectifs.exporter" nom="exporterObjectifs" executer={exporterLesObjectifs} />
  {/snippet}

  <datalist id={idConnues}>
    {#each connues as motCle (motCle)}
      <option value={motCle}></option>
    {/each}
  </datalist>

  {#if tables.length === 0}
    <p class="aucune">{t('tables.liste.aucune')}</p>
  {:else}
    <ul class="tables">
      {#each tables as table (table.id)}
        {@const etat = etatTable(table, charge.evenement.siegesParDefaut)}
        {@const complement = complementDe(table.id)}
        {@const vues = objectifsDeLaTable(charge, table)}
        {@const ouverte = ouvertes.has(table.id)}
        {@const idTours = `${uid}-tours-${table.id}`}
        <li data-table={table.id}>
          <div class="entete">
            <span class="numero"><span>{t('tables.liste.table')}</span> <span>{table.numero}</span></span>
            <span class="forme">{t(cleForme(table.forme))}</span>
            <span class="etat" data-etat-table><Pastille sorte="statut" valeur={tonEtatTable(etat)} libelle={t(etat.cle)} /></span>
          </div>
          <div class="libelle">
            <Champ
              cle={`libelle-${table.id}`}
              etiquette="tables.liste.libelle"
              nom={nomDeTable(table.numero, 'tables.liste.libelle')}
              valeur={table.libelle ?? ''}
              lire={lireLibelle}
              executer={(libelle) => seance.executer('changerLibelleTable', { id: table.id, libelle })}
            />
          </div>
          <div class="saisie" {@attach suivreSaisie(table.id)}>
            <Champ
              cle={`sieges-${table.id}`}
              etiquette="tables.liste.places"
              nom={nomDeTable(table.numero, 'tables.liste.places')}
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
                nomAccessible={nomDeTable(table.numero, 'tables.liste.realigner')}
                executer={() => executerSurTable(table.id, 'realignerTable', { id: table.id })}
              />
            {/if}
            <Commande
              cle="tables.liste.supprimer"
              nom="supprimerTable"
              nomAccessible={nomDeTable(table.numero, 'tables.liste.supprimer')}
              executer={() => supprimer(table)}
            />
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
          <div class="objectifs">
            {@render objectif(table, vues.soiree)}
            <button
              type="button"
              class="deplier"
              data-commande="basculerObjectifsTours"
              aria-label={nomDeTable(table.numero, 'tables.objectifs.parTour', { nombre: vues.parTour })}
              aria-expanded={ouverte ? 'true' : 'false'}
              aria-controls={ouverte ? idTours : undefined}
              onclick={() => (ouvertes = basculerTable(ouvertes, table.id))}
            >
              <span class="chevron"><Icone nom="chevron" /></span>
              <span>{t('tables.objectifs.parTour', { nombre: vues.parTour })}</span>
            </button>
            {#if ouverte}
              <ul class="par-tour" id={idTours}>
                {#each vues.tours as vue (vue.cle)}
                  <li>{@render objectif(table, vue)}</li>
                {/each}
              </ul>
            {/if}
          </div>
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

  /* Une table par ligne : en-tête, champs et commandes sur une rangée tant
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

  /* Les objectifs d'une table : sous sa ligne, sur toute la largeur ; un
     objectif par rangée, son champ, son choix de règle, son état et son
     retrait côte à côte tant qu'elle les tient, ses messages dessous. */
  .objectifs {
    display: flex;
    flex-basis: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: var(--espace-2);
  }

  .objectif {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
  }

  .ligne-objectif {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--espace-2) var(--espace-4);
  }

  .regle-objectif {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
  }

  .etat-regle {
    display: flex;
    align-self: center;
    min-width: 0;
  }

  /* Le bouton qui déplie les objectifs par tour : un texte de l'encre de la
     page, sans fond, et son chevron, tourné vers le bas quand la liste est
     dépliée. */
  .deplier {
    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    gap: var(--espace-1);
    min-height: var(--hauteur-cible);
    padding: 0 var(--espace-2);
    border: 1px solid transparent;
    border-radius: var(--rayon-2);
    background: none;
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
    cursor: pointer;
  }

  .deplier:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 1px;
  }

  .chevron {
    display: inline-flex;
  }

  .deplier[aria-expanded='true'] .chevron {
    transform: rotate(90deg);
  }

  .par-tour {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    margin: 0;
    padding: 0 0 0 var(--espace-5);
    list-style: none;
  }
</style>
