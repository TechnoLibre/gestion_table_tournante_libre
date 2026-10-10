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
  // retirerait de toute note retouchée. Maj+Entrée y insère un saut de
  // ligne, Entrée seule valide (entreeValide). Une validation qui change la valeur
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
  //
  // Groupée (groupes non null, ceux de groupesGrille), la grille porte un
  // corps par groupe du premier niveau, dont l'en-tête porte
  // scope="rowgroup" ; celui d'un sous-groupe porte scope="row", et ses
  // lignes n'héritent pas des en-têtes de ses aînés. Chaque groupe, de tout
  // niveau, y rend un en-tête, en retrait selon son niveau, dont le bouton replie ou
  // déplie le groupe et dit son état en texte et dans aria-expanded, puis,
  // déplié, ses sous-groupes, ou ses lignes au dernier niveau. Une ligne
  // porte la clé du plus étroit groupe qui la compte. Les lignes visibles
  // sont celles de lignesVisibles : flèches et Tab ne parcourent qu'elles,
  // jamais un en-tête ni une ligne repliée. Une saisie validée dont la
  // ligne quitte le rendu — tri ou groupe changé — rend le focus à la même
  // cellule de sa nouvelle ligne, et chaque groupe replié qui la reçoit, de
  // tout niveau, se déplie. Replier et déplier n'écrivent rien. Entrée sur
  // la cellule d'exclusion suit sa ligne de même : la personne exclue ou
  // réintégrée passe dans son nouveau groupe, et sa cellule garde le focus.
  //
  // Les conflits du placement montré (conflits, clé d'un groupe → ses
  // lignes de conflit ; enConflit, identifiant → ses règles), que la section
  // ne donne que groupée : l'en-tête d'un groupe en conflit, de tout niveau,
  // porte une marque, un cadre plein qui dit en texte le nombre de ses
  // conflits ; un groupe du dernier niveau, déplié, écrit au-dessus de ses
  // lignes une ligne par conflit — lieu, noms, raison —, chaque nom dans son
  // propre nœud ; la cellule du nom d'une personne en conflit nomme ses
  // règles. Aucune couleur ne les distingue : la teinte de conflit reste au
  // plan.
  import { getContext, onDestroy, tick } from 'svelte';
  import { creerMachineChamp } from '../primitives/champ.js';
  import Commande from '../primitives/Commande.svelte';
  import { creerGeste } from '../primitives/geste.js';
  import Refus from '../primitives/Refus.svelte';
  import { effetDe } from '../raccourcis.js';
  import { cleDeRaison } from './conflits.js';
  import { COLONNES, basculerGroupe, celluleSuivante, cheminDe, cleDeColonne, deplierChemin, entreeValide, lignesVisibles, ligneVoisine } from './grille.js';

  let {
    lignes,
    groupes = null,
    replies = $bindable(new Set()),
    tri = $bindable(null),
    supprimer,
    conflits = new Map(),
    enConflit = new Map(),
  } = $props();

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

  // Les lignes que la grille montre, dans leur ordre, et le rang de chacune
  // parmi elles, par identifiant.
  const visibles = $derived(groupes === null ? lignes : lignesVisibles(groupes, replies));
  const rangs = $derived(new Map(visibles.map(({ id }, rang) => [id, rang])));

  // Le rang de la ligne active ; la première quand l'active n'est plus affichée.
  const rangActif = $derived(rangs.get(actif.id) ?? 0);

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
    const ligne = visibles[rang];
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
  // la valeur enregistrée, la commande sinon. Rend une promesse de vrai quand
  // l'édition se clôt, de faux quand la commande est refusée : l'édition
  // reste alors ouverte sur la saisie, le refus contre elle, le focus dans
  // le champ.
  async function valider() {
    if (edition === null) return true;
    const { id, colonne } = edition;
    const rendu = machine.valider();
    saisie = machine.saisie;
    if (rendu.action !== 'executer') {
      await fermerEdition();
      return true;
    }
    const enCours = machine;
    const rangAvant = rangs.get(id) ?? 0;
    let promesse;
    try {
      promesse = seance.executer('modifierParticipant', { id, champs: { [colonne]: rendu.valeur } });
    } catch (erreur) {
      await echouer(enCours, id, colonne, erreur);
      return false;
    }
    const garderFocus = entree !== null && document.activeElement === entree;
    fermerEdition();
    try {
      await promesse;
    } catch (erreur) {
      await echouer(enCours, id, colonne, erreur);
      return false;
    }
    await suivreLigne(id, colonne, garderFocus, rangAvant);
    return true;
  }

  // Après une modification écrite, quand la cellule avait le focus : la
  // ligne que la valeur a menée sous des groupes repliés, de tout niveau,
  // les déplie, puis la cellule reprend le focus que le retrait de son
  // ancienne ligne a rendu au document. Une ligne que le filtre ne montre
  // plus a laissé son rang, rangAvant, à la ligne qui la suivait — à la
  // dernière quand elle fermait la grille — : la même colonne de cette
  // voisine prend le focus. Un focus posé ailleurs entre-temps reste où il
  // est.
  async function suivreLigne(id, colonne, garderFocus, rangAvant) {
    if (!garderFocus) return;
    await tick();
    const deplies = groupes === null ? replies : deplierChemin(replies, cheminDe(groupes, id));
    if (deplies !== replies) {
      replies = deplies;
      await tick();
    }
    const actuel = document.activeElement;
    if (actuel !== null && actuel !== document.body) return;
    const voisine = ligneVoisine(rangAvant, visibles.length);
    if (rangs.has(id)) cellule(id, colonne)?.focus();
    else if (voisine !== null) activer(voisine, COLONNES.indexOf(colonne));
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

  // Les effets de la grille qui mènent à une autre cellule (celluleSuivante).
  const DEPLACEMENTS = new Set(['haut', 'bas', 'gauche', 'droite', 'suivante', 'precedente']);

  // La touche d'un appui telle que RACCOURCIS la nomme dans la grille :
  // « Maj+ » devant la touche quand la table donne à la majuscule son effet
  // propre (Maj+Tab), la touche seule sinon — Maj+flèche se lit comme la
  // flèche.
  function toucheDeGrille(evenement) {
    const majuscule = `Maj+${evenement.key}`;
    return evenement.shiftKey && effetDe('grille', majuscule) !== null ? majuscule : evenement.key;
  }

  // Dans une cellule en édition, les effets du contexte 'champ' — valider,
  // rendre — passent d'abord ; seuls suivante et precedente de la grille
  // s'y ajoutent.
  async function surToucheEntree(evenement, rang) {
    const touche = toucheDeGrille(evenement);
    const saisie = effetDe('champ', evenement.key);
    const tabulation = effetDe('grille', touche);
    if (saisie === 'rendre') {
      evenement.preventDefault();
      abandonner();
    } else if (saisie === 'valider') {
      if (!entreeValide({ maj: evenement.shiftKey, multiligne: edition.colonne === 'notes' })) return;
      evenement.preventDefault();
      valider();
    } else if (tabulation === 'suivante' || tabulation === 'precedente') {
      // Une saisie refusée garde l'édition et le focus : Tab ne quitte pas
      // le champ, dont la sortie validerait une seconde fois.
      evenement.preventDefault();
      const { id } = edition;
      const colonne = COLONNES.indexOf(edition.colonne);
      if (!(await valider())) return;
      await tick();
      tabulerDepuis(id, rang, colonne, touche);
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
    const rang = rangs.get(id) ?? -1;
    if (rang >= 0) return deplacer(rang, colonne, touche);
    const suivante = effetDe('grille', touche) === 'suivante' ? { ligne: rangAvant, colonne: 0 } : { ligne: rangAvant - 1, colonne: COLONNES.length - 1 };
    if (suivante.ligne < 0 || suivante.ligne >= visibles.length) return false;
    activer(suivante.ligne, suivante.colonne);
    return true;
  }

  // La sortie du champ valide, sauf quand l'édition s'est déjà close.
  function surSortie() {
    if (edition !== null) valider();
  }

  function deplacer(rang, colonne, touche) {
    const suivante = celluleSuivante({ ligne: rang, colonne }, touche, { lignes: visibles.length, colonnes: COLONNES.length });
    if (suivante === null) return false;
    activer(suivante.ligne, suivante.colonne);
    return true;
  }

  // Exclut ou réintègre la personne ; écrit, la ligne suit son nouveau
  // groupe, comme après une saisie validée, quand sa cellule avait le focus.
  function basculerExclusion(personne) {
    const nom = personne.exclu ? 'reintegrerParticipant' : 'exclureParticipant';
    refusCellule = null;
    const garderFocus = document.activeElement === cellule(personne.id, 'exclu');
    const rangAvant = rangs.get(personne.id) ?? 0;
    try {
      Promise.resolve(seance.executer(nom, { id: personne.id })).then(
        () => suivreLigne(personne.id, 'exclu', garderFocus, rangAvant),
        (erreur) => refuser(personne.id, 'exclu', erreur),
      );
    } catch (erreur) {
      refuser(personne.id, 'exclu', erreur);
    }
  }

  function surToucheCellule(evenement, personne, rang, colonne) {
    if (evenement.target !== evenement.currentTarget) return;
    const touche = toucheDeGrille(evenement);
    const effet = effetDe('grille', touche);
    if (DEPLACEMENTS.has(effet)) {
      if (deplacer(rang, colonne, touche)) evenement.preventDefault();
    } else if (effet === 'editer') {
      evenement.preventDefault();
      if (COLONNES[colonne] === 'exclu') basculerExclusion(personne);
      else ouvrirEdition(personne, COLONNES[colonne]);
    } else if (effet === 'effacer') {
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

{#snippet rangee(personne, rang, dans)}
  <tr data-participant={personne.id} data-groupe-ligne={dans}>
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
          {#if colonne === 'nom' && enConflit.has(personne.id)}
            <span class="marque-conflit" data-conflit-personne>{t('participants.conflit.personne', { regles: enConflit.get(personne.id) })}</span>
          {/if}
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
{/snippet}

{#snippet bloc(groupe)}
  {@const replie = replies.has(groupe.cle)}
  <tr class="groupe" data-groupe={groupe.cle} data-niveau={groupe.niveau}>
    <th scope={groupe.niveau === 1 ? 'rowgroup' : 'row'} colspan={COLONNES.length + 1}>
      <button
        type="button"
        data-commande="basculerGroupe"
        data-cible={groupe.cle}
        aria-expanded={replie ? 'false' : 'true'}
        onclick={() => (replies = basculerGroupe(replies, groupe.cle))}
      >
        <span class="etat" data-groupe-etat>{t(replie ? 'participants.groupe.deplier' : 'participants.groupe.replier')}</span>
        {#if groupe.libelle === null}
          <span class="libelle" data-groupe-libelle>{t(groupe.cleLibelle)}</span>
        {:else}
          <span class="libelle valeur" data-groupe-libelle>{groupe.libelle}</span>
        {/if}
        <span class="compte" data-groupe-compte>{t('participants.groupe.compte', { compte: groupe.compte })}</span>
        {#if conflits.has(groupe.cle)}
          <span class="marque-conflit" data-groupe-conflits>{t('participants.conflit.groupe', { nombre: conflits.get(groupe.cle).length })}</span>
        {/if}
      </button>
    </th>
  </tr>
  {#if !replie}
    {#if groupe.sousGroupes === null && conflits.has(groupe.cle)}
      <tr class="conflits" data-conflits={groupe.cle}>
        <td colspan={COLONNES.length + 1}>
          <ul>
            {#each conflits.get(groupe.cle) as conflit (conflit.cle)}
              <li data-conflit>
                <span>{t('participants.conflit.lieu', { tour: conflit.tour, numero: conflit.numero })}</span>
                {#each conflit.noms as nom, rang (rang)}{' '}{#if rang > 0}<span>{t('participants.conflit.et')}</span>{' '}{/if}<span
                    class="valeur">{nom}</span
                  >{/each}{' '}<span>{t(cleDeRaison(conflit.regle), { numero: conflit.numero, deja: conflit.deja })}</span>
              </li>
            {/each}
          </ul>
        </td>
      </tr>
    {/if}
    {#if groupe.sousGroupes === null}
      {#each groupe.lignes as personne (personne.id)}
        {@render rangee(personne, rangs.get(personne.id), groupe.cle)}
      {/each}
    {:else}
      {#each groupe.sousGroupes as sousGroupe (sousGroupe.cle)}
        {@render bloc(sousGroupe)}
      {/each}
    {/if}
  {/if}
{/snippet}

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
    {#if groupes === null}
      <tbody>
        {#each lignes as personne (personne.id)}
          {@render rangee(personne, rangs.get(personne.id), undefined)}
        {/each}
      </tbody>
    {:else}
      {#each groupes as groupe (groupe.cle)}
        <tbody>
          {@render bloc(groupe)}
        </tbody>
      {/each}
    {/if}
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

  /* L'en-tête d'un groupe : un bouton qui porte son état en texte, le
     libellé du groupe en gras et son compte. */
  .groupe button {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--espace-2);
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  /* Le retrait d'un en-tête croît avec le niveau de son groupe, jusqu'au
     dernier niveau possible, un par colonne de GROUPEMENTS. */
  .groupe[data-niveau='2'] button {
    margin-left: var(--espace-5);
  }

  .groupe[data-niveau='3'] button {
    margin-left: calc(2 * var(--espace-5));
  }

  .groupe[data-niveau='4'] button {
    margin-left: calc(3 * var(--espace-5));
  }

  .groupe[data-niveau='5'] button {
    margin-left: calc(4 * var(--espace-5));
  }

  .groupe[data-niveau='6'] button {
    margin-left: calc(5 * var(--espace-5));
  }

  .groupe[data-niveau='7'] button {
    margin-left: calc(6 * var(--espace-5));
  }

  .groupe[data-niveau='8'] button {
    margin-left: calc(7 * var(--espace-5));
  }

  .libelle {
    font-weight: bold;
    overflow-wrap: anywhere;
  }

  /* La marque d'un conflit : un cadre plein, de l'encre du texte, autour
     d'un texte qui nomme le conflit ; la forme ne dépend d'aucune couleur. */
  .marque-conflit {
    display: inline-block;
    padding: 0 var(--espace-1);
    border: 2px solid var(--couleur-page-texte);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font-weight: bold;
  }

  .conflits ul {
    margin: 0;
    padding-left: var(--espace-5);
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
