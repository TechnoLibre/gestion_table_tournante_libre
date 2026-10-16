<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La vue « Comparaison » (§ 12.10.6, § 12.10.7, D55 à D67, D85) de la page
  // de qualité, la troisième, après le profil : laquelle des deux sert
  // mieux, et qui y perd ? La source de la page, A, contre un second
  // placement, B. Une ligne nomme les deux ; la liste « Comparer à : » porte
  // exactement les candidats de A, et pose B par ui.comparerA, un état de la
  // navigation, vivant en lecture et sur un plan bloqué : la vue n'écrit
  // rien et n'offre aucune commande qui écrive. Puis les colonnes côte à
  // côte (ColonnesComparaison), le tracé — le manque des deux en escaliers
  // superposés, A en plein, B en tirets, sur un seul axe vertical que borne
  // la borne haute de la comparaison, le zéro libellé —, les phrases, et le
  // jumeau, l'escalier du manque. Un seul placement mesurable : sa phrase
  // seule ; un refus de dessin d'un côté, des populations différentes, peu
  // de valeurs : la phrase du cas, sans tracé.
  //
  // Elle reçoit le contrat de propriétés des vues — detail et ligne, qu'elle
  // ne lit pas ; table, la table d'évaluation de la charge — et lit la
  // charge et la navigation par contexte. Le modèle (vueComparaison,
  // comparaison.js) se bâtit de la source de la page et de la comparée ;
  // rien ne se trie ni ne se calcule ici. Il suit B : un autre choix de la
  // liste, un B qui quitte la liste, une génération, et la ligne, les
  // colonnes, le tracé et le jumeau ouvert suivent ensemble.
  //
  // Le premier dessin : sous le contexte dessinDiffere, que la page pose, ni
  // la comparaison ni la liste ne se calculent tant que la vue n'a pas
  // coupé la zone visible — celle du plus proche ancêtre qui défile, sinon
  // la fenêtre —, ou que la page ne l'a pas dessinée pour amener une vue
  // qui la suit (dessinerAvant) ; une ouverture de la page sur une autre
  // vue ne la calcule pas. Une vue atteinte le reste. Hors de ce contexte,
  // elle se calcule au montage.
  //
  // Désignations : data-vue-qualite sur le <div> qui enveloppe la carte,
  // que la carte ne transmet pas — le cadre que la zone visible coupe est
  // le <div> qu'il contient — ; data-placements-compares sur la ligne qui
  // nomme les deux placements ; data-comparer-a sur la liste ;
  // data-phrase-comparaison sur chaque phrase, par son code ;
  // data-graphique comparaison sur le <svg>, data-serie a et b sur les deux
  // tracés.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';
  import ColonnesComparaison from './ColonnesComparaison.svelte';
  import { vueComparaison } from './comparaison.js';
  import Escalier from './graphiques/Escalier.svelte';
  import Jumeau from './graphiques/Jumeau.svelte';
  import { sourceQualite } from './source.js';

  let { detail = null, ligne = null, table = null } = $props();

  const t = getContext('t');
  const format = getContext('format');
  const ui = getContext('ui');
  const seance = getContext('seance');
  const differe = getContext('dessinDiffere') ?? null;

  let cadre = $state(null);
  let atteinte = $state(false);

  // Le plus proche ancêtre de l'élément qui fait défiler son contenu à la
  // verticale, ou null.
  function ancetreQuiDefile(element) {
    for (let ancetre = element.parentElement; ancetre !== null; ancetre = ancetre.parentElement) {
      const { overflowY } = getComputedStyle(ancetre);
      if (overflowY === 'auto' || overflowY === 'scroll') return ancetre;
    }
    return null;
  }

  // La vue est atteinte au montage quand elle coupe la zone visible ;
  // sinon, quand un IntersectionObserver la voit y entrer, ou que le
  // registre du contexte la dessine. L'observateur et l'inscription se
  // retirent une fois la vue atteinte, ou démontée.
  $effect(() => {
    if (atteinte || cadre === null) return undefined;
    if (differe === null) {
      atteinte = true;
      return undefined;
    }
    const defile = ancetreQuiDefile(cadre);
    const zone = defile === null ? { top: 0, bottom: innerHeight } : defile.getBoundingClientRect();
    const boite = cadre.getBoundingClientRect();
    if (boite.bottom >= zone.top && boite.top <= zone.bottom) {
      atteinte = true;
      return undefined;
    }
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((entree) => entree.isIntersecting)) atteinte = true;
      },
      { root: defile },
    );
    observateur.observe(cadre);
    const retirer = differe.inscrire(cadre, () => {
      atteinte = true;
    });
    return () => {
      observateur.disconnect();
      retirer();
    };
  });

  const charge = $derived($seance.charge);
  const modele = $derived(
    !atteinte || charge === null || table === null
      ? null
      : vueComparaison(charge, table, { source: sourceQualite(charge, { demandee: $ui.proposition }), comparee: $ui.comparee }, { t, format }),
  );
  const traceOuPhrase = $derived(modele !== null && (modele.cas === 'trace' || modele.cas === 'phrase'));

  // Le choix de la liste : la clé du candidat dont l'option porte la valeur.
  function choisir(evenement) {
    const valeur = evenement.currentTarget.value;
    const candidat = modele.liste.find(({ cle }) => String(cle) === valeur);
    if (candidat !== undefined) ui.comparerA(candidat.cle);
  }
</script>

<div data-vue-qualite="comparaison">
  <div bind:this={cadre}>
    <Carte titre={t('qualite.vue.comparaison.titre')} sousTitre={t('qualite.vue.comparaison.question')} niveau={3}>
      {#if modele !== null}
        <div class="vue">
          {#if modele.placements !== null}
            <div class="placements">
              <p data-placements-compares>{t('qualite.comparaison.placements', { a: modele.placements.a.nom, b: modele.placements.b.nom })}</p>
              <label class="liste">
                <span>{t('qualite.comparaison.comparerA')}</span>
                <select data-comparer-a value={String(modele.choisi)} onchange={choisir}>
                  {#each modele.liste as candidat (candidat.cle)}
                    <option value={String(candidat.cle)}>{candidat.texte}</option>
                  {/each}
                </select>
              </label>
            </div>
          {/if}
          {#if traceOuPhrase}
            <ColonnesComparaison comparaison={modele.comparaison} {table} />
          {/if}
          {#if modele.cas === 'trace'}
            <Escalier
              graphique="comparaison"
              nom={modele.graphique.nom}
              synthese={modele.graphique.synthese}
              series={modele.series}
              borneHaute={modele.borneHaute}
              graduer={modele.graphique.graduer}
              titreX={modele.graphique.titreX}
              infobulle={modele.infobulle}
            />
          {/if}
          {#each modele.phrases as phrase, rang (rang)}
            <div class="phrase">
              <p data-phrase-comparaison={phrase.code}>{phrase.texte}</p>
              {#if phrase.liste !== null}
                <ul>
                  {#each phrase.liste as element, i (i)}
                    <li>
                      <span>{element.texte}</span>
                      {#if element.nom !== null}
                        <span class="nom">{element.nom}</span>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/each}
          {#if modele.escalier !== null}
            <Jumeau tableaux={[modele.escalier]} />
          {/if}
        </div>
      {/if}
    </Carte>
  </div>
</div>

<style>
  .vue {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    min-width: 0;
  }

  p {
    margin: 0;
  }

  /* La ligne des deux placements, puis la liste, sur la même ligne quand
     elle tient. */
  .placements {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2) var(--espace-4);
  }

  .liste {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-1) var(--espace-2);
  }

  select {
    max-width: 100%;
    padding: var(--espace-1) var(--espace-3);
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

  .phrase {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  /* Une liste sous sa phrase : une valeur, une contradiction ou une
     personne par ligne. */
  ul {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--espace-2);
  }

  .nom {
    font-weight: bold;
  }
</style>
