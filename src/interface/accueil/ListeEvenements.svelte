<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La liste des événements (§ 8.1), en tableau dans une carte titrée : une
  // ligne par événement du dossier de travail que le filtre retient, que
  // désigne data-evenement, rangée dans les groupes de groupesDeLaListe —
  // un corps de tableau par groupe, son intitulé (la pastille de l'état et
  // « n événement(s) ») en tête, dans l'ordre du § 9 ; un seul corps, sans
  // intitulé, sans groupement. Le choix du groupement est dans l'en-tête de
  // la carte. Un filtre qui ne retient aucune ligne le dit. Un dossier sans
  // événement n'affiche ni carte ni tableau : la création et les
  // démonstrations de l'accueil en tiennent lieu.
  //
  // Les en-têtes de colonnes sont groupés : l'événement — nom, état,
  // participants, dernière modification —, le placement retenu, à la teinte
  // de Retenu — ses deux mesures (COLONNES_DU_RETENU) —, la meilleure
  // proposition du classement, à la teinte de Proposé, sous le titre et les
  // libellés du bloc de la génération (MEILLEURE) — son identifiant et ses
  // collisions cumulées —, puis les actions. Chaque valeur est dans son
  // propre nœud : data-colonne, data-meilleure-id, data-meilleure-collisions,
  // « — » sans valeur. Le nom est l'en-tête de sa ligne ; la date et le
  // chemin le suivent en petite ligne, chacun précédé de son intitulé, que
  // lisent les technologies d'assistance et que l'œil ne voit pas, puis ses
  // signalements traduits — les bases qu'un doublon nomme suivent son
  // texte, chacune dans son propre nœud (data-doublon). L'état est une
  // pastille. La cellule des actions porte « Ouvrir », qui ouvre la ligne
  // en lecture, ses opérations, et le refus de son ouverture. « Ouvrir » se
  // nomme par aria-labelledby de son propre texte puis du nom de sa ligne :
  // chaque ligne a son « Ouvrir Bal des Grisailles », distinct des autres.
  // Les identifiants viennent du rang du groupe et du rang de la ligne :
  // une base est un nom de fichier, qui n'est pas un identifiant.
  //
  // lignes : LigneListe[] de la façade ; resumes : les résumés reçus de
  // facade.resumer, par base — une ligne sans le sien attend, et chacune de
  // ses quatre valeurs de résumé porte le signe du chargement (Chargement),
  // décoratif, dans une cellule qui se dit occupée (aria-busy), jusqu'à ce
  // qu'il arrive. La région d'état qui suit le tableau
  // (data-chargement-liste) existe tant que la liste a des lignes, et écrit
  // « accueil.chargement » tant qu'une ligne attend : le chargement
  // s'annonce une fois pour la liste, et sa fin la vide. vue : { filtre,
  // groupement } de l'accueil ; grouper(groupement) : le geste du choix ;
  // ouvrir(ligne) : le geste de l'accueil ; refusOuverture : { base, refus }
  // du dernier échec, ou null ; apresOperation() : à appeler quand une
  // opération a changé le dossier.
  //
  // L'intitulé de chaque mesure du retenu, le titre de la meilleure
  // proposition et l'intitulé de ses collisions s'expliquent dans
  // l'infobulle de la liste, une seule (Infobulle, primitive) : chaque terme
  // (data-terme, que pose le fragment termeExplique), un en-tête de colonne,
  // se focalise au clavier, son survol ou son focus ouvre l'explication, le
  // quitter la referme quand elle est encore la sienne, Échap aussi. Le
  // terme expliqué porte aria-describedby vers elle, et lui seul.
  //
  // Le tableau tient dans sa carte à 1024 px de large ; plus étroit, il
  // défile dans son propre conteneur, et la page ne défile pas en largeur.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';
  import Icone from '../primitives/Icone.svelte';
  import Infobulle from '../primitives/Infobulle.svelte';
  import Pastille from '../primitives/Pastille.svelte';
  import Refus from '../primitives/Refus.svelte';
  import Chargement from './Chargement.svelte';
  import Operations from './Operations.svelte';
  import { COLONNES_DU_RETENU, MEILLEURE, choixDeGroupement, groupesDeLaListe, ligneAffichee } from './modele.js';

  let { lignes, resumes, vue, grouper, ouvrir, refusOuverture, apresOperation } = $props();

  const t = getContext('t');
  const format = getContext('format');

  // Une ligne au moins attend son résumé.
  const enChargement = $derived(lignes.some((ligne) => ligneAffichee(ligne, format, resumes.get(ligne.base)).enAttente));
  const groupes = $derived(groupesDeLaListe(lignes, vue.filtre, vue.groupement));
  // Le nombre de colonnes du tableau, que l'intitulé d'un groupe couvre :
  // les quatre de l'événement, les deux du retenu, les deux de la meilleure
  // proposition, les actions.
  const COLONNES = 9;

  // Le terme expliqué : {ancre, terme, cle, details} — son élément, son nom
  // et la clé de son explication — ; null sans infobulle.
  const uid = $props.id();
  const idExplication = `${uid}-explication`;
  let expliquee = $state(null);
  function expliquer(evenement, terme, cle) {
    expliquee = { ancre: evenement.currentTarget, terme, cle, details: {} };
  }
  function taire(terme) {
    if (expliquee?.terme === terme) expliquee = null;
  }
  const fermerExplication = () => (expliquee = null);
  // L'aria-describedby d'un terme : l'infobulle quand elle l'explique.
  const decrit = (terme) => (expliquee?.terme === terme ? idExplication : undefined);
</script>

<!-- Une valeur de résumé : le signe du chargement tant que la ligne
     attend, sa valeur ensuite. -->
{#snippet resume(affichee, valeur)}
  {#if affichee.enAttente}<Chargement />{:else}{valeur}{/if}
{/snippet}

<!-- Un terme expliqué : nom est son data-terme, cle son intitulé,
     explication la clé que l'infobulle montre. -->
{#snippet termeExplique(nom, cle, explication)}
  <!-- L'intitulé est un terme, non une commande : le focus ne sert qu'à
       montrer au clavier l'explication que le pointeur montre au survol. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
  <span
    class="terme"
    data-terme={nom}
    tabindex="0"
    aria-describedby={decrit(nom)}
    onmouseenter={(evenement) => expliquer(evenement, nom, explication)}
    onmouseleave={() => taire(nom)}
    onfocus={(evenement) => expliquer(evenement, nom, explication)}
    onblur={() => taire(nom)}>{t(cle)}</span
  >
{/snippet}

<!-- Le choix du groupement, dans l'en-tête de la carte. -->
{#snippet choixDuGroupement()}
  <label class="groupement">
    <span>{t('accueil.groupement.libelle')}</span>
    <select data-champ="groupement" value={vue.groupement} onchange={(evenement) => grouper(evenement.currentTarget.value)}>
      {#each choixDeGroupement() as { groupement, cle } (groupement)}
        <option value={groupement}>{t(cle)}</option>
      {/each}
    </select>
  </label>
{/snippet}

{#if lignes.length > 0}
  <Carte titre={t('accueil.liste.titre')} plein actions={choixDuGroupement}>
    {#if groupes.length === 0}
      <p class="vide">{t('accueil.filtre.vide')}</p>
    {:else}
      <div class="defilement">
        <table>
          <colgroup span="4"></colgroup>
          <colgroup span="2"></colgroup>
          <colgroup span="2"></colgroup>
          <colgroup></colgroup>
          <thead>
            <tr>
              <th scope="colgroup" colspan="4" class="groupe">{t('accueil.entete.evenement')}</th>
              <th scope="colgroup" colspan="2" class="groupe retenu"
                ><span class="entete-groupe"
                  ><span class="signe"><Icone nom="coche" taille={14} /></span><span>{t('accueil.entete.retenu')}</span></span
                ></th
              >
              <th scope="colgroup" colspan="2" class="groupe propose"
                ><span class="entete-groupe"
                  ><span class="signe"><Icone nom="listePoints" taille={14} /></span>{@render termeExplique(
                    'meilleure',
                    MEILLEURE.titre,
                    MEILLEURE.explication,
                  )}</span
                ></th
              >
              <th scope="col" rowspan="2" class="actions">{t('accueil.colonne.actions')}</th>
            </tr>
            <tr>
              <th scope="col">{t('accueil.colonne.nom')}</th>
              <th scope="col">{t('accueil.colonne.etat')}</th>
              <th scope="col" class="nombre">{t('accueil.colonne.participants')}</th>
              <th scope="col">{t('accueil.colonne.modification')}</th>
              {#each COLONNES_DU_RETENU as { colonne, cle, explication } (colonne)}
                <th scope="col" class="nombre">{@render termeExplique(colonne, cle, explication)}</th>
              {/each}
              <th scope="col" class="nombre">{t(MEILLEURE.proposition)}</th>
              <th scope="col" class="nombre"
                >{@render termeExplique('meilleureCollisions', MEILLEURE.collisions, MEILLEURE.explicationCollisions)}</th
              >
            </tr>
          </thead>
          {#each groupes as groupe, rangGroupe (groupe.groupe ?? '')}
            <tbody>
              {#if groupe.cle !== null}
                <tr class="intertitre">
                  <th scope="rowgroup" colspan={COLONNES}
                    ><span class="intitule"
                      ><Pastille
                        sorte={groupe.pastille.sorte}
                        valeur={groupe.pastille.valeur}
                        icone={groupe.pastille.icone}
                        libelle={t(groupe.cle)}
                      /><span class="compte">{t('accueil.groupe.compte', groupe.details)}</span></span
                    ></th
                  >
                </tr>
              {/if}
              {#each groupe.lignes as ligne, rangLigne (ligne.base)}
                {@const affichee = ligneAffichee(ligne, format, resumes.get(ligne.base))}
                {@const idLigne = `${uid}-ligne-${rangGroupe}-${rangLigne}`}
                {@const occupee = affichee.enAttente ? 'true' : undefined}
                <tr data-evenement={ligne.base}>
                  <th scope="row" class="evenement">
                    <span class="nom" id="{idLigne}-nom" data-colonne="nom">{affichee.nom}</span>
                    <span class="sous-ligne"
                      ><span class="date"
                        ><span class="cache">{t('accueil.colonne.date')}</span><span class="signe-date"
                          ><Icone nom="calendrier" taille={13} /></span
                        ><span data-colonne="date">{affichee.date}</span></span
                      ><span class="chemin"
                        ><span class="cache">{t('accueil.colonne.chemin')}</span><span data-colonne="chemin"
                          >{affichee.chemin}</span
                        ></span
                      ></span
                    >
                    {#each affichee.signalements as { cle, details, noms }, rang (rang)}
                      <div class="signalement" data-signalement={cle}>
                        <p>{t(cle, details)}</p>
                        {#if noms.length > 0}
                          <ul class="noms">
                            {#each noms as nom (nom)}
                              <li data-doublon={nom}>{nom}</li>
                            {/each}
                          </ul>
                        {/if}
                      </div>
                    {/each}
                  </th>
                  <td data-colonne="etat"
                    >{#if ligne.etat !== null}<Pastille sorte="etat" valeur={ligne.etat} libelle={t(affichee.etat)} />{:else}{t(
                        affichee.etat,
                      )}{/if}</td
                  >
                  <td class="nombre" data-colonne="participants">{affichee.participants}</td>
                  <td data-colonne="modification">{affichee.modification}</td>
                  {#each COLONNES_DU_RETENU as { colonne } (colonne)}
                    <td class="nombre" data-colonne={colonne} aria-busy={occupee}>{@render resume(affichee, affichee[colonne])}</td>
                  {/each}
                  <td class="nombre" data-meilleure-id aria-busy={occupee}>{@render resume(affichee, affichee.meilleure.id)}</td>
                  <td class="nombre" data-meilleure-collisions aria-busy={occupee}
                    >{@render resume(affichee, affichee.meilleure.collisions)}</td
                  >
                  <td class="actions">
                    <div class="commandes-ligne">
                      <button
                        type="button"
                        class="ouvrir"
                        id="{idLigne}-ouvrir"
                        aria-labelledby="{idLigne}-ouvrir {idLigne}-nom"
                        data-commande="ouvrir"
                        onclick={() => ouvrir(ligne)}>{t('accueil.ouvrir')}</button
                      >
                      <Operations {ligne} {apresOperation} />
                    </div>
                    {#if refusOuverture !== null && refusOuverture.base === ligne.base}
                      <Refus refus={refusOuverture.refus} />
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          {/each}
        </table>
      </div>
    {/if}
    <p class="chargement" class:annonce={enChargement} role="status" data-chargement-liste
      >{#if enChargement}{t('accueil.chargement')}{/if}</p
    >
  </Carte>
  <Infobulle id={idExplication} ouverte={expliquee} fermer={fermerExplication} />
{/if}

<style>
  p {
    margin: 0;
  }

  .groupement {
    display: flex;
    align-items: center;
    gap: var(--espace-2);
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }

  select {
    min-height: 2.25rem;
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
  }

  select:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .vide {
    padding: var(--espace-4) var(--espace-5);
    color: var(--couleur-page-texte-secondaire);
  }

  /* Le conteneur défilant du tableau : un tableau plus large que la carte
     y défile, la page ne défile pas. */
  .defilement {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--taille-texte-petit);
  }

  th,
  td {
    padding: var(--espace-2);
    border-bottom: 1px solid var(--couleur-ligne-filet);
    text-align: start;
    vertical-align: top;
  }

  th:first-child,
  td:first-child {
    padding-left: var(--espace-3);
  }

  th:last-child,
  td:last-child {
    padding-right: var(--espace-3);
  }

  thead th {
    border-bottom-color: var(--couleur-carte-filet);
    background-color: var(--couleur-carte-fond-sourd);
    font-weight: bold;
    vertical-align: bottom;
  }

  /* Les en-têtes de groupes de colonnes : en petites capitales, sur la
     teinte de l'état qu'ils résument, le signe de l'état devant. */
  thead .groupe {
    font-size: var(--taille-intertitre);
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  thead .retenu {
    background-color: var(--couleur-etat-retenu-fond);
  }

  thead .retenu .signe {
    color: var(--couleur-etat-retenu-marque);
  }

  thead .propose {
    background-color: var(--couleur-etat-propose-fond);
  }

  thead .propose .signe {
    color: var(--couleur-etat-propose-marque);
  }

  .entete-groupe {
    display: inline-flex;
    align-items: center;
    gap: var(--espace-1);
  }

  .signe {
    display: inline-flex;
    flex: none;
  }

  .nombre {
    text-align: end;
    font-variant-numeric: tabular-nums;
  }

  /* L'intitulé d'un groupe de lignes, sur le fond sourd de la carte. */
  .intertitre th {
    padding-top: var(--espace-2);
    padding-bottom: var(--espace-2);
    background-color: var(--couleur-carte-fond-sourd);
    font-weight: normal;
  }

  .intitule {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2);
  }

  .compte {
    color: var(--couleur-page-texte-secondaire);
  }

  /* L'en-tête d'une ligne : le nom en gras, au corps du texte, puis la
     petite ligne de la date et du chemin, et les signalements. */
  .evenement {
    min-width: 9rem;
    font-weight: normal;
    overflow-wrap: anywhere;
  }

  .nom {
    display: block;
    font-size: var(--taille-texte);
    font-weight: bold;
  }

  .sous-ligne {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--espace-3);
    margin-top: var(--espace-1);
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
  }

  .date {
    display: inline-flex;
    align-items: center;
    gap: var(--espace-1);
    white-space: nowrap;
  }

  .signe-date {
    display: inline-flex;
  }

  .chemin {
    min-width: 0;
  }

  /* Un intitulé lu par les technologies d'assistance, hors de la vue : une
     boîte d'un pixel, rognée, qui ne pousse rien. */
  .cache {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  /* Les actions : « Ouvrir », puis les opérations, sur une rangée qui
     passe à la ligne quand la colonne est étroite. « Ouvrir » est la
     commande principale de la ligne : sa cible a la hauteur des cibles
     principales. */
  .actions {
    min-width: 8rem;
  }

  .commandes-ligne {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1);
  }

  .ouvrir {
    min-height: var(--hauteur-cible);
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
    font-weight: bold;
    cursor: pointer;
  }

  .ouvrir:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  .ouvrir:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  /* Un intitulé qui s'explique se signale par un soulignement pointillé ;
     focalisé, par le contour du focus. */
  .terme {
    text-decoration: underline dotted;
    text-underline-offset: 0.2em;
  }

  .terme:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .signalement {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    margin-top: var(--espace-2);
    padding: var(--espace-1) var(--espace-2);
    border-left: 3px solid var(--couleur-avis);
    background-color: var(--couleur-avis-fond);
    font-size: var(--taille-texte-petit);
  }

  .noms {
    margin: 0;
    padding-left: var(--espace-4);
  }

  .chargement {
    padding: 0 var(--espace-5);
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }

  .chargement.annonce {
    padding: var(--espace-2) var(--espace-5);
  }
</style>
