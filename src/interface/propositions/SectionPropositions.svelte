<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La section des propositions (§ 2.1 étape 10, § 5.7, § 9) : la phrase de
  // l'ordre du classement, le tableau, et la commande qui efface la liste en
  // épargnant le retenu. Regarder n'écrit jamais (§ 8.4) : le tableau se lit
  // en lecture et sur un plan bloqué, où la séance refuse elle-même
  // « Retenir » et « Effacer », le refus posé à côté du bouton.
  //
  // La table d'évaluation se lit dans la charge de l'état observable, par
  // evaluation (modele.js) : une seule mesure, celle d'evaluer
  // (evaluation.js), refaite à chaque charge écrite ; les indicateurs du
  // retenu suivent donc l'ajustement (§ 2.1 étape 11).
  //
  // « Voir sur le plan » demande la proposition au plan par l'état de
  // navigation, sans écriture, et ouvre la section du plan ; voir(null) y
  // montre le retenu. « Retenir » exécute retenirProposition, puis remet la
  // demande à null : le plan montre le retenu. Quand le retenu est ajusté et
  // que la séance accepterait le geste, retenir détruit ces ajustements : la
  // fenêtre à confirmer le dit d'abord, nommant le retenu ajusté et la
  // proposition qui le remplace (§ 2.1). Un geste que la séance refuserait
  // s'exécute sans fenêtre, et son refus s'affiche. « Effacer » ne détruit
  // aucune saisie — chaque proposition se régénère de sa graine, et le geste
  // se défait — : il s'exécute sans fenêtre.
  //
  // La phrase de l'ordre se met bout à bout, morceau par morceau (modele.js) :
  // les paliers appliqués, chaque nom celui de la valeur que son palier
  // applique — deux noms pour un critère qui en classe deux. Chaque nom, et
  // l'identifiant croissant, est un élément focalisable qui porte le critère
  // qui le classe (data-critere) et désigne la colonne de sa valeur. Le
  // survoler ou le focaliser surligne cette colonne dans le tableau. Le
  // survol et le focus se tiennent à part, et surlignee (modele.js) choisit :
  // le nom survolé, sinon celui qui a le focus. Quitter un nom — pointeur
  // sorti, focus perdu — n'efface que l'état qu'il tenait, et laisse l'autre.
  //
  // Chaque nom de la phrase, celui d'une valeur appliquée, et chaque en-tête
  // de colonne s'expliquent dans l'infobulle de la section, une seule
  // (Infobulle, primitive) : le survol ou le focus l'ouvre sur le terme, le
  // quitter la referme quand elle est encore la sienne, Échap aussi. Une
  // valeur appliquée et sa colonne partagent leur explication
  // (explicationDeColonne, colonneDeValeur, modele.js). Le terme expliqué
  // porte aria-describedby vers elle, et lui seul.
  //
  // Au-delà de TAILLE_PAGE propositions (modele.js), le tableau se lit page
  // à page : pagine découpe le classement unique, sans le retrier, et la
  // ligne du retenu reste en tête de chaque page, hors du compte. Une nav
  // nommée au-dessus du tableau, répétée sous lui, porte « Précédentes »,
  // l'étendue de la page et « Suivantes » ; une commande sans objet n'y est
  // pas, comme « Refaire » sans retour à refaire. Changer de page n'écrit
  // rien (§ 8.4) : le focus va à l'étendue de la nav du dessus, une région
  // role="status" qui annonce la page ; chaque étendue se focalise par
  // programme (tabindex -1), jamais par Tab. La page est un état
  // d'interface que l'état de navigation retient (pagePropositions,
  // retenirPagePropositions) : elle survit au démontage de la section, et
  // repart de la première à chaque ouverture d'un événement, quand
  // l'état de navigation revient à son départ. suivrePage la recale à chaque
  // charge ou visée nouvelles — la première après une génération, bornée à
  // la dernière quand des propositions partent, celle de la proposition
  // visée à chaque nouvelle demande au plan (EtatUi.visee). Rien de ce
  // qu'une ligne tient — la colonne surlignée, la proposition demandée au
  // plan, le retenu — ne dépend de la page.
  //
  // Habillage : le tableau et la phrase de l'ordre vivent dans une carte
  // titrée, « Effacer les propositions » à droite de son en-tête ; le message
  // d'une liste vide et le champ de la cible, chacun dans sa carte.
  //
  // Le champ de la cible de la somme de redondance montre la cible de
  // l'événement (cibleRedondance), et exécute changerCibleRedondance à la
  // sortie du champ — une entrée ; la saisie se lit par lireEntier, et un
  // refus se pose contre le champ (Champ).
  import { getContext, tick, untrack } from 'svelte';
  import { lireEntier } from '../../application/capacite.js';
  import { cibleRedondance } from '../../application/evaluation.js';
  import { REGLAGES_GENERATION, reglagesDeSection } from '../generation/reglages.js';
  import Carte from '../primitives/Carte.svelte';
  import Champ from '../primitives/Champ.svelte';
  import Commande from '../primitives/Commande.svelte';
  import Confirmation from '../primitives/Confirmation.svelte';
  import Infobulle from '../primitives/Infobulle.svelte';
  import Refus from '../primitives/Refus.svelte';
  import TableauPropositions from './TableauPropositions.svelte';
  import {
    changerDePage,
    demandeConfirmation,
    evaluation,
    explicationDeColonne,
    nomDe,
    pagine,
    retenuAjuste,
    suivrePage,
    surlignee as colonneSurlignee,
    tableau,
    texteEtendue,
  } from './modele.js';

  const t = getContext('t');
  const format = getContext('format');
  // Le champ de la cible lit l'entrée que lit aussi le tableau des réglages
  // de la documentation (§ 19.8).
  const [entreeCible] = reglagesDeSection(REGLAGES_GENERATION, 'propositions');
  const seance = getContext('seance');
  const ui = getContext('ui');

  const charge = $derived($seance.charge);
  const evaluee = $derived(charge === null ? { table: null, refus: null } : evaluation(charge));
  const ajuste = $derived(charge !== null && retenuAjuste(charge));
  const vue = $derived(evaluee.table === null ? null : tableau(evaluee.table, { ajuste }));

  // Le suivi de la page (SuiviDePage, modele.js), que l'état de navigation
  // retient, recalé avant le rendu à chaque vue ou visée nouvelles ; sans
  // tableau, il reste tel. Le suivi inchangé revient identique de
  // suivrePage, et l'état de navigation ne publie rien : le recalage
  // s'arrête là. La page montrée en découle.
  const suivi = $derived($ui.pagePropositions);
  $effect.pre(() => {
    const observee = { vue, propositions: charge?.propositions ?? [], vise: $ui.proposition, visee: $ui.visee };
    if (vue === null) return;
    untrack(() => ui.retenirPagePropositions(suivrePage(ui.etat().pagePropositions, observee)));
  });
  const page = $derived(vue === null ? null : pagine(vue, suivi?.page ?? 1));
  const vuePage = $derived(page === null ? null : { ...vue, lignes: page.lignes, horsClassement: page.horsClassement });

  // L'élément de la section, où se trouve l'étendue de la nav du dessus.
  let racine = $state(null);

  // Montre la page demandée, puis rend le focus à l'étendue qui l'annonce.
  function tourner(numero) {
    ui.retenirPagePropositions(changerDePage(ui.etat().pagePropositions, numero));
    tick().then(() => racine?.querySelector('[data-pages="haut"] [data-etendue]')?.focus());
  }

  // La retenue en attente de confirmation, telle que demandeConfirmation la
  // rend : la proposition demandée, le titre et les éléments de la fenêtre ;
  // null sans fenêtre.
  let aConfirmer = $state(null);

  function voir(id) {
    ui.montrerProposition(id);
    ui.allerA('plan');
  }

  async function retenirSansQuestion(id) {
    await seance.executer('retenirProposition', { id });
    ui.montrerProposition(null);
  }

  async function retenir(id) {
    const demande = demandeConfirmation(seance.etat(), id);
    if (demande !== null) {
      aConfirmer = demande;
      return;
    }
    await retenirSansQuestion(id);
  }

  async function confirmer() {
    await retenirSansQuestion(aConfirmer.id);
    aConfirmer = null;
  }

  // Les colonnes du nom survolé et du nom focalisé, null sans lui ; la
  // colonne surlignée s'en déduit.
  let survolee = $state(null);
  let focalisee = $state(null);
  const surlignee = $derived(colonneSurlignee(survolee, focalisee));

  // Le terme expliqué : {ancre, terme, cle, details} — son élément, sa
  // désignation, 'valeur:<valeur>' pour un nom de la phrase, où chaque
  // valeur paraît une fois, ou 'colonne:<nom>' pour un en-tête, et la clé
  // de son explication — ; null sans infobulle. Ouvrir sur un terme remplace
  // l'explication d'un autre ; quitter un terme ne ferme que la sienne.
  const uid = $props.id();
  const idExplication = `${uid}-explication`;
  let expliquee = $state(null);
  function expliquer(evenement, terme, colonne) {
    expliquee = { ancre: evenement.currentTarget, terme, cle: explicationDeColonne(colonne), details: {} };
  }
  function taire(terme) {
    if (expliquee?.terme === terme) expliquee = null;
  }
  const fermerExplication = () => (expliquee = null);
  // L'aria-describedby d'un terme : l'infobulle quand elle l'explique.
  const decrit = (terme) => (expliquee?.terme === terme ? idExplication : undefined);

  // L'entrée sur un nom, par le pointeur ou par le focus, et sa sortie.
  function entrer(evenement, { valeur, colonne }, parFocus) {
    if (parFocus) focalisee = colonne;
    else survolee = colonne;
    expliquer(evenement, `valeur:${valeur}`, colonne);
  }
  function sortir({ valeur }, parFocus) {
    if (parFocus) focalisee = null;
    else survolee = null;
    taire(`valeur:${valeur}`);
  }

  const effacer = () => seance.executer('effacerPropositions', {});
  const changerCible = (cible) => seance.executer('changerCibleRedondance', { cible });
  const nommer = (id) => nomDe(charge, id);
</script>

{#snippet pages(ou)}
  <nav class="pages" data-pages={ou} aria-label={t(`propositions.pages.${ou}`)}>
    <div class="precedentes">
      {#if page.page > 1}
        <Commande cle="propositions.pages.precedentes" executer={() => tourner(page.page - 1)} />
      {/if}
    </div>
    <p
      class="etendue"
      data-etendue
      role={ou === 'haut' ? 'status' : undefined}
      tabindex="-1">
      {texteEtendue(page, { t, format })}
    </p>
    <div class="suivantes">
      {#if page.page < page.pages}
        <Commande cle="propositions.pages.suivantes" executer={() => tourner(page.page + 1)} />
      {/if}
    </div>
  </nav>
{/snippet}

{#snippet effacerListe()}
  <Commande cle="propositions.commande.effacer" executer={effacer} />
{/snippet}

<section data-section="propositions" bind:this={racine}>
  <h2>{t('coquille.section.propositions')}</h2>

  {#if charge !== null && charge.propositions.length === 0}
    <Carte>
      <p>{t('propositions.aucune')}</p>
    </Carte>
  {/if}

  {#if evaluee.refus !== null}
    <Refus refus={evaluee.refus} />
  {/if}

  {#if vue !== null}
    <Carte titre={t('propositions.tableau.titre')} niveau={3} plein actions={charge.propositions.length > 0 ? effacerListe : null}>
      <div class="ordre" data-ordre>
        {#each vue.ordre as morceaux, rang (rang)}
          <p>
            {#each morceaux as morceau, place (place)}
              {#if morceau.colonne === null}
                {t(morceau.cle, morceau.details)}
              {:else}
                <!-- Le nom est un terme, non une commande : aucun rôle n'annonce
                     d'action, et le focus ne sert qu'à montrer au clavier la
                     colonne que le pointeur montre au survol. -->
                <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
                <span
                  class="critere"
                  class:actif={surlignee === morceau.colonne}
                  data-critere={morceau.critere}
                  tabindex="0"
                  aria-describedby={decrit(`valeur:${morceau.valeur}`)}
                  onmouseenter={(evenement) => entrer(evenement, morceau, false)}
                  onmouseleave={() => sortir(morceau, false)}
                  onfocus={(evenement) => entrer(evenement, morceau, true)}
                  onblur={() => sortir(morceau, true)}>{t(morceau.cle, morceau.details)}</span
                >
              {/if}
            {/each}
          </p>
        {/each}
      </div>
      {#if page.paginee}{@render pages('haut')}{/if}
      <TableauPropositions vue={vuePage} {surlignee} {nommer} {voir} {retenir} {expliquer} {taire} {decrit} />
      {#if page.paginee}{@render pages('bas')}{/if}
    </Carte>
  {:else if charge !== null && charge.propositions.length > 0}
    <div class="effacer">{@render effacerListe()}</div>
  {/if}

  <Infobulle id={idExplication} ouverte={expliquee} fermer={fermerExplication} />

  {#if charge !== null}
    <Carte>
      <div class="cible" data-cible-redondance>
        <Champ
          cle={entreeCible.cle}
          etiquette={entreeCible.etiquette}
          valeur={cibleRedondance(charge)}
          lire={lireEntier}
          executer={changerCible}
        />
        <p class="aide">{t('propositions.cible.aide')}</p>
      </div>
    </Carte>
  {/if}

  {#if aConfirmer !== null}
    <Confirmation
      titre={aConfirmer.titre.cle}
      details={aConfirmer.titre.details}
      elements={aConfirmer.elements.map((element) => t(element.cle, element.details))}
      surConfirmer={confirmer}
      surAnnuler={() => (aConfirmer = null)}
    />
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: var(--taille-titre);
  }

  p {
    margin: 0;
  }

  /* La phrase de l'ordre, en tête de la carte, au retrait du contenu d'une
     carte ; le tableau la suit, collé aux bords. */
  .ordre {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    padding: var(--espace-3) var(--espace-5);
  }

  /* Un nom qui désigne une colonne se signale par un soulignement pointillé ;
     survolé ou focalisé, par un soulignement plein. Il ne se coupe pas d'une
     ligne à l'autre : sa boîte, que le pointeur survole, reste d'un tenant. */
  .critere {
    white-space: nowrap;
    text-decoration: underline dotted;
    text-underline-offset: 0.2em;
  }

  .critere.actif {
    text-decoration-style: solid;
    text-decoration-thickness: 2px;
  }

  .critere:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .effacer {
    display: flex;
  }

  /* Une nav des pages : l'étendue au centre, « Précédentes » contre elle à
     gauche, « Suivantes » à droite ; une commande absente laisse sa place
     vide, et l'étendue ne bouge pas d'une page à l'autre. */
  .pages {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--espace-3);
    padding: var(--espace-3) var(--espace-5);
  }

  .precedentes {
    justify-self: end;
  }

  .suivantes {
    justify-self: start;
  }

  .etendue {
    font-variant-numeric: tabular-nums;
  }

  .etendue:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .cible {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
  }

  .aide {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }
</style>
