<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La grille éditable des participants (§ 10.2) : une ligne par personne
  // de lignes, dans l'ordre que lui donne SectionParticipants, une cellule
  // par colonne de COLONNES (grille.js), puis les commandes de la ligne.
  //
  // Au clavier, une seule cellule est dans l'ordre de tabulation, la cellule
  // active ; flèches, Tab et Maj+Tab la déplacent (celluleSuivante), et Tab
  // après la dernière, Maj+Tab avant la première, rendent le focus au
  // navigateur. Entrée ou F2 ouvre l'édition d'une cellule de texte, que la
  // machine de champ.js tient : Entrée, Tab ou la sortie du champ valident,
  // Échap rend la valeur enregistrée. Les notes s'éditent dans une zone de
  // texte, qui garde leurs sauts de ligne ; un champ d'une ligne les
  // retirerait de toute note retouchée. Une validation qui change la valeur
  // exécute modifierParticipant par la séance, sur ce seul champ ; une
  // saisie qui se lit comme la valeur enregistrée — en NFC, sans blancs de
  // bord — n'exécute rien. Entrée sur la cellule d'exclusion exclut ou
  // réintègre la personne. Un refus se pose dans la cellule où le geste a eu
  // lieu, avec son remède : celui de la séance, lu dans etat().refus avant
  // d'ouvrir l'édition, ou celui de la commande, la saisie gardée.
  //
  // « Voir sur le plan » met la personne en évidence et ouvre le plan, au
  // tour montré (§ 7.1, § 8.4) : un geste de regard, qui n'écrit rien.
  //
  // L'en-tête trie : un clic sur une colonne la trie croissante, un second
  // décroissante ; le sens se lit en texte et dans aria-sort. Un collage sur
  // la grille, hors d'une cellule en édition, ouvre l'aperçu d'import (§
  // 10.2) : le texte part à l'état de navigation, intact, et rien ne
  // s'écrit ici.
  import { getContext, onDestroy, tick } from 'svelte';
  import { creerMachineChamp } from '../primitives/champ.js';
  import Commande from '../primitives/Commande.svelte';
  import { creerGeste } from '../primitives/geste.js';
  import Refus from '../primitives/Refus.svelte';
  import { COLONNES, celluleSuivante, cleDeColonne } from './grille.js';

  let { lignes, tri = $bindable(null), supprimer } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');

  function voirSurLePlan(id) {
    ui.mettreEnEvidence(id);
    ui.allerA('plan');
  }
  const uid = $props.id();
  const geste = creerGeste(seance);

  // La cellule active : l'identifiant de sa ligne et le rang de sa colonne.
  let actif = $state({ id: null, colonne: 0 });
  // La cellule en édition, {id, colonne}, et le texte saisi.
  let edition = $state.raw(null);
  let saisie = $state('');
  // Le refus posé sur une cellule : {id, colonne, refus}.
  let refusCellule = $state.raw(null);
  let machine = null;
  let tableau;
  let entree = $state(null);

  // Le rang de la ligne active ; la première quand l'active n'est plus affichée.
  const rangActif = $derived.by(() => {
    const rang = lignes.findIndex(({ id }) => id === actif.id);
    return rang < 0 ? 0 : rang;
  });

  const idRefus = (id, colonne) => `${uid}-refus-${id}-${colonne}`;
  const enEdition = (id, colonne) => edition !== null && edition.id === id && edition.colonne === colonne;
  const refusDe = (id, colonne) =>
    refusCellule !== null && refusCellule.id === id && refusCellule.colonne === colonne ? refusCellule.refus : null;

  // Le texte d'une valeur enregistrée, vide pour null ; et la valeur que
  // l'enregistrement en lirait, pour reconnaître une saisie sans changement.
  const texteDe = (valeur) => (valeur === null ? '' : valeur);
  const lire = (texte) => ({ valeur: texte.normalize('NFC').trim() });

  function trier(colonne) {
    tri = tri !== null && tri.colonne === colonne && tri.sens === 'croissant' ? { colonne, sens: 'decroissant' } : { colonne, sens: 'croissant' };
  }

  const ariaSort = (colonne) => {
    if (tri === null || tri.colonne !== colonne) return 'none';
    return tri.sens === 'croissant' ? 'ascending' : 'descending';
  };

  function cellule(id, colonne) {
    return tableau?.querySelector(`[data-participant="${id}"] [data-champ="${colonne}"]`) ?? null;
  }

  async function activer(rang, colonne) {
    const ligne = lignes[rang];
    actif = { id: ligne.id, colonne };
    await tick();
    cellule(ligne.id, COLONNES[colonne])?.focus();
  }

  function refuser(id, colonne, erreur) {
    if (typeof erreur?.code !== 'string') throw erreur;
    refusCellule = { id, colonne, refus: { code: erreur.code, details: erreur.details ?? {} } };
  }

  async function ouvrirEdition(personne, colonne) {
    const courant = seance.etat().refus;
    if (courant !== null) {
      refusCellule = { id: personne.id, colonne, refus: courant };
      return;
    }
    refusCellule = null;
    machine = creerMachineChamp({ stockee: texteDe(personne[colonne]), lire });
    saisie = machine.saisie;
    edition = { id: personne.id, colonne };
    await tick();
    entree?.focus();
    entree?.setSelectionRange(saisie.length, saisie.length);
  }

  // Ferme l'édition et rend le focus à sa cellule quand il était dans le
  // champ.
  async function fermerEdition() {
    const fermee = edition;
    const avaitLeFocus = entree !== null && document.activeElement === entree;
    edition = null;
    machine = null;
    geste.tenir(false);
    if (fermee === null || !avaitLeFocus) return;
    await tick();
    cellule(fermee.id, fermee.colonne)?.focus();
  }

  // Valide la saisie de la cellule en édition : rien quand elle se lit comme
  // la valeur enregistrée, la commande sinon. Refusée, l'édition reste
  // ouverte sur la saisie, le refus contre elle.
  function valider() {
    if (edition === null) return null;
    const { id, colonne } = edition;
    const rendu = machine.valider();
    saisie = machine.saisie;
    if (rendu.action !== 'executer') return fermerEdition();
    const enCours = machine;
    let promesse;
    try {
      promesse = seance.executer('modifierParticipant', { id, champs: { [colonne]: rendu.valeur } });
    } catch (erreur) {
      return echouer(enCours, id, colonne, erreur);
    }
    fermerEdition();
    return Promise.resolve(promesse).catch((erreur) => echouer(enCours, id, colonne, erreur));
  }

  async function echouer(enCours, id, colonne, erreur) {
    refuser(id, colonne, erreur);
    enCours.echec(refusCellule.refus);
    machine = enCours;
    saisie = enCours.saisie;
    edition = { id, colonne };
    geste.tenir(enCours.enCours);
    await tick();
    entree?.focus();
  }

  function abandonner() {
    machine?.abandonner();
    refusCellule = null;
    return fermerEdition();
  }

  function surSaisie(evenement) {
    machine.saisir(evenement.currentTarget.value);
    saisie = machine.saisie;
    refusCellule = null;
    geste.tenir(machine.enCours);
  }

  async function surToucheEntree(evenement, rang) {
    const touche = evenement.key;
    if (touche === 'Escape') {
      evenement.preventDefault();
      abandonner();
    } else if (touche === 'Enter') {
      evenement.preventDefault();
      valider();
    } else if (touche === 'Tab') {
      evenement.preventDefault();
      const { id } = edition;
      const colonne = COLONNES.indexOf(edition.colonne);
      const sens = evenement.shiftKey ? 'Maj+Tab' : 'Tab';
      await valider();
      await tick();
      tabulerDepuis(id, rang, colonne, sens);
    }
  }

  // Tab ou Maj+Tab depuis la cellule validée de la personne id, au rang
  // rangAvant avant la validation. La ligne se relit par son identifiant :
  // la valeur validée peut l'avoir déplacée au tri, et le rang d'avant
  // désignerait une autre personne. Une ligne que le filtre ne montre plus a
  // laissé son rang à celle qui la suivait, les autres gardant leur ordre :
  // Tab mène à la première cellule de celle-ci, Maj+Tab à la dernière de la
  // ligne d'avant ; hors de la grille, le focus reste où il est.
  function tabulerDepuis(id, rangAvant, colonne, touche) {
    const rang = lignes.findIndex((personne) => personne.id === id);
    if (rang >= 0) return deplacer(rang, colonne, touche);
    const suivante = touche === 'Tab' ? { ligne: rangAvant, colonne: 0 } : { ligne: rangAvant - 1, colonne: COLONNES.length - 1 };
    if (suivante.ligne < 0 || suivante.ligne >= lignes.length) return false;
    activer(suivante.ligne, suivante.colonne);
    return true;
  }

  // La sortie du champ valide, sauf quand l'édition s'est déjà close.
  function surSortie() {
    if (edition !== null) valider();
  }

  function deplacer(rang, colonne, touche) {
    const suivante = celluleSuivante({ ligne: rang, colonne }, touche, { lignes: lignes.length, colonnes: COLONNES.length });
    if (suivante === null) return false;
    activer(suivante.ligne, suivante.colonne);
    return true;
  }

  function basculerExclusion(personne) {
    const nom = personne.exclu ? 'reintegrerParticipant' : 'exclureParticipant';
    refusCellule = null;
    try {
      Promise.resolve(seance.executer(nom, { id: personne.id })).catch((erreur) => refuser(personne.id, 'exclu', erreur));
    } catch (erreur) {
      refuser(personne.id, 'exclu', erreur);
    }
  }

  function surToucheCellule(evenement, personne, rang, colonne) {
    if (evenement.target !== evenement.currentTarget) return;
    const touche = evenement.key === 'Tab' && evenement.shiftKey ? 'Maj+Tab' : evenement.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Maj+Tab'].includes(touche)) {
      if (deplacer(rang, colonne, touche)) evenement.preventDefault();
    } else if (touche === 'Enter' || touche === 'F2') {
      evenement.preventDefault();
      if (COLONNES[colonne] === 'exclu') basculerExclusion(personne);
      else ouvrirEdition(personne, COLONNES[colonne]);
    } else if (touche === 'Escape') {
      refusCellule = null;
    }
  }

  function surCollage(evenement) {
    if (evenement.target instanceof HTMLInputElement || evenement.target instanceof HTMLTextAreaElement) return;
    const texte = evenement.clipboardData?.getData('text/plain') ?? '';
    if (texte === '') return;
    evenement.preventDefault();
    ui.ouvrirImport({ texte, origine: 'collage' });
    ui.allerA('import');
  }

  onDestroy(() => geste.liberer());
</script>

<div class="defilement">
  <table
    role="grid"
    aria-label={t('participants.grille.titre')}
    tabindex={lignes.length === 0 ? 0 : undefined}
    bind:this={tableau}
    onpaste={surCollage}
  >
    <thead>
      <tr>
        {#each COLONNES as colonne (colonne)}
          <th scope="col" aria-sort={ariaSort(colonne)}>
            <button type="button" data-commande="trier" data-cible={colonne} onclick={() => trier(colonne)}>
              <span>{t(cleDeColonne(colonne))}</span>
              {#if tri !== null && tri.colonne === colonne}
                <span class="sens">{t(tri.sens === 'croissant' ? 'participants.grille.croissant' : 'participants.grille.decroissant')}</span>
              {/if}
            </button>
          </th>
        {/each}
        <th scope="col">{t('participants.grille.actions')}</th>
      </tr>
    </thead>
    <tbody>
      {#each lignes as personne, rang (personne.id)}
        <tr data-participant={personne.id}>
          {#each COLONNES as colonne, rangColonne (colonne)}
            {@const refus = refusDe(personne.id, colonne)}
            <td
              role="gridcell"
              data-champ={colonne}
              tabindex={rang === rangActif && rangColonne === actif.colonne ? 0 : -1}
              aria-describedby={refus === null || enEdition(personne.id, colonne) ? undefined : idRefus(personne.id, colonne)}
              onfocus={(evenement) => {
                if (evenement.target === evenement.currentTarget) actif = { id: personne.id, colonne: rangColonne };
              }}
              onkeydown={(evenement) => surToucheCellule(evenement, personne, rang, rangColonne)}
            >
              {#if enEdition(personne.id, colonne) && colonne === 'notes'}
                <textarea
                  rows="3"
                  aria-label={t(cleDeColonne(colonne))}
                  value={saisie}
                  bind:this={entree}
                  aria-invalid={refus === null ? undefined : 'true'}
                  aria-describedby={refus === null ? undefined : idRefus(personne.id, colonne)}
                  oninput={surSaisie}
                  onkeydown={(evenement) => surToucheEntree(evenement, rang)}
                  onblur={surSortie}
                ></textarea>
              {:else if enEdition(personne.id, colonne)}
                <input
                  type="text"
                  aria-label={t(cleDeColonne(colonne))}
                  value={saisie}
                  bind:this={entree}
                  aria-invalid={refus === null ? undefined : 'true'}
                  aria-describedby={refus === null ? undefined : idRefus(personne.id, colonne)}
                  oninput={surSaisie}
                  onkeydown={(evenement) => surToucheEntree(evenement, rang)}
                  onblur={surSortie}
                />
              {:else if colonne === 'exclu'}
                <span class:exclue={personne.exclu}>
                  {t(personne.exclu ? 'participants.grille.exclue' : 'participants.grille.presente')}
                </span>
              {:else}
                <span class="valeur">{personne[colonne] ?? ''}</span>
              {/if}
              {#if refus !== null}
                <Refus id={idRefus(personne.id, colonne)} {refus} lever={() => (refusCellule = null)} />
              {/if}
            </td>
          {/each}
          <td role="gridcell">
            <div class="commandes">
            <button type="button" data-commande="fiche" onclick={() => ui.ouvrirFiche(personne.id)}>
              {t('participants.commande.fiche')}
            </button>
            <button type="button" data-commande="voirSurLePlan" onclick={() => voirSurLePlan(personne.id)}>
              {t('plan.evidence.voir')}
            </button>
            {#if personne.exclu}
              <Commande
                cle="participants.commande.reintegrer"
                nom="reintegrerParticipant"
                executer={() => seance.executer('reintegrerParticipant', { id: personne.id })}
              />
            {:else}
              <Commande
                cle="participants.commande.exclure"
                nom="exclureParticipant"
                executer={() => seance.executer('exclureParticipant', { id: personne.id })}
              />
            {/if}
            <Commande cle="participants.commande.supprimer" nom="supprimerParticipant" executer={() => supprimer(personne)} />
            </div>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .defilement {
    max-width: 100%;
    overflow-x: auto;
  }

  table {
    border-collapse: collapse;
    font-size: var(--taille-texte);
  }

  th,
  td {
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    text-align: left;
    vertical-align: top;
  }

  td {
    max-width: 18rem;
    overflow-wrap: anywhere;
  }

  .valeur {
    white-space: pre-wrap;
  }

  /* L'exclusion se lit en texte ; l'italique la double, sans couleur. */
  .exclue {
    font-style: italic;
  }

  th button {
    display: inline-flex;
    gap: var(--espace-1);
    padding: 0;
    border: none;
    background: none;
    color: var(--couleur-page-texte);
    font: inherit;
    font-weight: bold;
    cursor: pointer;
  }

  .sens {
    font-weight: normal;
  }

  .commandes {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-1);
  }

  .commandes > button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    cursor: pointer;
  }

  input,
  textarea {
    width: 100%;
    box-sizing: border-box;
    padding: var(--espace-1);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
  }

  input[aria-invalid='true'],
  textarea[aria-invalid='true'] {
    border-color: var(--couleur-refus);
  }

  td:focus-visible,
  button:focus-visible,
  input:focus-visible,
  textarea:focus-visible,
  table:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: -2px;
  }
</style>
