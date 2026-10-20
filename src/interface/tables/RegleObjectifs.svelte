<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La règle par défaut des objectifs de table (§ 2.1 étape 4, § 4.5, D3) :
  // un sélecteur, à côté des places par défaut et du nombre de tours, entre
  // « au moins une (OU) » et « toutes (ET) ». Un choix exécute
  // changerRegleObjectifs {regle}, une entrée ; les objectifs qui portent
  // une règle propre n'en changent pas. À l'issue du geste, le sélecteur
  // montre la règle de la charge, écrite ou inchangée. Un refus de la séance
  // — lecture, plan bloqué — se pose à côté du sélecteur, avec son remède,
  // et rien ne s'écrit.
  import { getContext } from 'svelte';
  import Refus from '../primitives/Refus.svelte';
  import ChoixRegle from './ChoixRegle.svelte';
  import { OPTIONS_REGLE_PAR_DEFAUT, regleParDefaut } from './objectifs.js';

  let { charge } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const uid = $props.id();
  const idChoix = `${uid}-regle`;
  const idRefus = `${uid}-regle-refus`;

  // Le refus du dernier choix, posé à côté du sélecteur.
  let refus = $state.raw(null);

  const options = $derived(OPTIONS_REGLE_PAR_DEFAUT.map(({ valeur, cle }) => ({ valeur, libelle: t(cle) })));

  async function choisir(evenement) {
    const choix = evenement.currentTarget;
    refus = null;
    try {
      await seance.executer('changerRegleObjectifs', { regle: choix.value });
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refus = { code: erreur.code, details: erreur.details ?? {} };
    } finally {
      choix.value = regleParDefaut(seance.etat().charge ?? charge);
    }
  }
</script>

<div class="regle" data-regle-objectifs>
  <label for={idChoix}>{t('tables.regle.etiquette')}</label>
  <ChoixRegle
    id={idChoix}
    champ="regleObjectifs"
    valeur={regleParDefaut(charge)}
    {options}
    idRefus={refus === null ? null : idRefus}
    surChoix={choisir}
  />
  {#if refus !== null}
    <Refus id={idRefus} {refus} lever={() => (refus = null)} />
  {/if}
</div>

<style>
  .regle {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
  }
</style>
