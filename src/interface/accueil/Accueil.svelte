<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le premier écran sous sa forme minimale (§ 8.1, § 18.6) : son titre, la
  // version — ou la marque d'une construction de documentation —, puis une
  // commande par événement du dossier de travail, qui l'ouvre en lecture, et
  // une par démonstration, qui la charge. Les lignes viennent d'App, qui lit
  // la liste par la façade une fois la détermination réglée : l'accueil n'en
  // lit rien lui-même, et une question en attente les laisse vides jusqu'à
  // la réponse. Un geste qui change le dossier de travail — importer,
  // copier, renommer, supprimer — demande ensuite à App de relire la liste,
  // par la fonction relireListe du contexte. refusLecture est le refus qu'App a
  // reçu en lisant la liste ; le refus d'un geste de l'accueil le précède,
  // jusqu'au geste suivant. Chacun s'affiche par son code traduit.
  import { getContext } from 'svelte';
  import { versionVisible } from '../apropos.js';

  const t = getContext('t');
  const facade = getContext('facade');
  const seance = getContext('seance');

  let { provenance, version, demonstrations, lignes, refusLecture } = $props();

  let refusGeste = $state.raw(null);
  const refus = $derived(refusGeste ?? refusLecture);

  const estRefus = (erreur) => typeof erreur?.code === 'string';

  // Exécute un geste ; un refus s'affiche, toute autre erreur remonte.
  async function tenter(geste) {
    refusGeste = null;
    try {
      await geste();
    } catch (erreur) {
      if (!estRefus(erreur)) throw erreur;
      refusGeste = { code: erreur.code, details: erreur.details };
    }
  }
</script>

<section class="accueil" data-ecran="accueil">
  <h1>{t('coquille.liste')}</h1>
  <p class="version">
    <span>{t('coquille.version.libelle')}</span>
    <span>{versionVisible(provenance, version, t)}</span>
  </p>
  {#if refus !== null}
    <p class="refus" data-refus="accueil">{t(refus.code, refus.details)}</p>
  {/if}
  <ul class="entrees">
    {#each lignes as ligne (ligne.base)}
      <li>
        <button type="button" data-evenement={ligne.base} onclick={() => tenter(() => seance.ouvrir(ligne.base))}
          >{ligne.nom ?? ligne.base}</button
        >
      </li>
    {/each}
    {#each demonstrations as demonstration (demonstration.cle)}
      <li>
        <button
          type="button"
          data-demonstration={demonstration.cle}
          onclick={() => tenter(() => facade.chargerDemonstration(demonstration.cle))}>{demonstration.nom}</button
        >
      </li>
    {/each}
  </ul>
</section>

<style>
  .entrees {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    padding: 0;
    list-style: none;
  }

  button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .refus {
    color: var(--couleur-refus);
  }
</style>
