<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Les réglages d'une génération (§ 5.7, § 5.10) : la graine, puis le
  // nombre de propositions, le compte d'arrêt et l'historique, chacun sous
  // son libellé, qui porte son unité ; puis la durée observée du dernier
  // calcul de la séance, et ce qu'elle laisse attendre des réglages courants.
  // Aucun champ ne prend une durée : la recherche s'arrête sur un compte.
  //
  // Les réglages de la charge sont ceux de definition, par défaut
  // REGLAGES_GENERATION (reglages.js), la définition dont s'engendre aussi
  // le tableau de la documentation : chaque entrée de la section
  // 'generation' paraît, dans son ordre, champ ou bascule selon son genre,
  // sous son libellé et désignée par sa clé (data-champ) ; une entrée d'une
  // autre section appartient à un autre écran. Une épreuve passe une
  // définition à elle.
  //
  // Les champs (generation.nombre, generation.arret,
  // generation.historique) sont des Champ : une saisie se lit par la
  // validation du contrôleur de génération, la même que celle de
  // « Générer », et s'écrit à la sortie du champ par modifierReglage — une
  // entrée par changement ; en lecture, la séance refuse la première frappe.
  //
  // La graine n'est pas au fichier : c'est une saisie de la commande, vivante
  // en lecture, que le parent tient (graine, liée) et contrôle au clic de
  // « Générer ». Son refus, refusGraine, se pose contre elle ; une frappe
  // appelle saisirGraine, qui le retire.
  //
  // Les six contraintes et l'attribution des sièges (§ 5.3) sont des
  // cases à cocher, chacune sous son nom du spec : un clic, ou la barre
  // d'espace, exécute modifierReglage {cle, valeur} — une entrée par
  // bascule. À l'issue du geste, la case montre la valeur de la charge,
  // écrite ou inchangée. Un refus de la séance — lecture, plan
  // bloqué, support rompu — se pose à côté de la case, avec son remède, et
  // rien ne s'écrit.
  //
  // Un choix (§ 5.3, A8) se montre sous sa bascule (entree.sous) : un groupe
  // data-mode-objectifs, sa légende, un bouton radio par valeur, chacun sous
  // son libellé et décrit par son explication (aria-describedby), puis par
  // le refus du groupe quand il y en a un. Il reste modifiable quel que soit
  // l'état de son critère, que le groupe écrit en texte, « décoché » ou
  // « sans objet », tel que la table d'évaluation le porte
  // (etatsDesCriteres) : rien ne se recalcule ici. Choisir, au pointeur
  // ou aux flèches du clavier, exécute modifierReglage {cle, valeur} — une
  // entrée par choix. Un refus — un mode qui compare deux valeurs alors que
  // son critère partage un palier (OBJECTIFS_PALIER_PARTAGE), la lecture, un
  // plan bloqué — se pose contre le groupe, et le choix revient à la valeur
  // de la charge.
  //
  // L'ordre des priorités (genre 'ordre') suit les contraintes, dans son
  // éditeur (Priorites.svelte), qui lit les mêmes états.
  //
  // Les cœurs de calcul sont un réglage du poste, que le contrôleur de
  // génération tient pour la séance du logiciel : ni le fichier ni le journal
  // ne les portent, et ils se règlent en lecture comme en écriture. La case
  // « Cœurs automatiques », cochée par défaut, emploie un cœur par
  // processeur logique ; décochée, elle montre « Nombre de cœurs », pré-rempli
  // du dernier nombre accepté. La saisie se valide à la sortie du champ ou
  // par Entrée, par controleur.reglerCoeurs ; son refus se pose contre le
  // champ, saisie gardée, et le parent le lit (refusCoeurs, lié) : un refus
  // posé, « Générer » ne part pas. Échap rend le dernier nombre accepté ; les
  // deux touches sont celles du contexte 'champ' de la table des raccourcis.
  // La valeur automatique du poste s'affiche à côté, dans les deux états.
  //
  // Habillage : la graine et les cœurs se saisissent comme un Champ, sur le
  // fond de la carte au filet de contrôle ; les contraintes et les cœurs sont
  // deux groupes sous un intertitre en petites capitales.
  import { getContext, untrack } from 'svelte';
  import Champ from '../primitives/Champ.svelte';
  import Refus from '../primitives/Refus.svelte';
  import { effetDe } from '../raccourcis.js';
  import Priorites from './Priorites.svelte';
  import { etatAffiche, etatsDesCriteres } from './priorites.js';
  import { REGLAGES_GENERATION, reglagesDeSection, reglagesDuGenre, valeurDuReglage } from './reglages.js';

  let {
    charge,
    mesure,
    estimation,
    graine = $bindable(),
    refusGraine = null,
    saisirGraine,
    refusCoeurs = $bindable(null),
    definition = REGLAGES_GENERATION,
  } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const generation = getContext('generation');
  const uid = $props.id();
  const idGraine = `${uid}-graine`;
  const idRefusGraine = `${uid}-graine-refus`;
  const idCoeursAutomatiques = `${uid}-coeurs-automatiques`;
  const idCoeurs = `${uid}-coeurs`;
  const idRefusCoeurs = `${uid}-coeurs-refus`;

  // Le réglage des cœurs, tel que le contrôleur le publie, et le texte du
  // champ « Nombre de cœurs ».
  const coeurs = $derived($generation.coeurs);
  let saisieCoeurs = $state(untrack(() => String(generation.coeurs().manuel)));

  // Rend au champ le dernier nombre accepté, sans refus.
  function rendreCoeurs() {
    saisieCoeurs = String(generation.coeurs().manuel);
    refusCoeurs = null;
  }

  function basculerCoeurs(evenement) {
    generation.reglerCoeurs({ automatique: evenement.currentTarget.checked });
    rendreCoeurs();
  }

  function validerCoeurs() {
    refusCoeurs = generation.reglerCoeurs({ saisie: saisieCoeurs }).refus;
  }

  function toucheCoeurs(evenement) {
    const effet = effetDe('champ', evenement.key);
    if (effet === 'rendre') rendreCoeurs();
    else if (effet === 'valider') {
      evenement.preventDefault();
      validerCoeurs();
    }
  }

  // Les champs et les bascules de la section de la génération, chacun dans
  // l'ordre de la définition.
  const deLaGeneration = $derived(reglagesDeSection(definition, 'generation'));
  const champs = $derived(reglagesDuGenre(deLaGeneration, 'champ'));
  const bascules = $derived(reglagesDuGenre(deLaGeneration, 'bascule'));
  const choix = $derived(reglagesDuGenre(deLaGeneration, 'choix'));
  const ordres = $derived(reglagesDuGenre(deLaGeneration, 'ordre'));
  // Les choix qui se montrent sous la bascule de clé cle.
  const choixSous = (cle) => choix.filter((entree) => entree.sous === cle);

  // L'état de chaque critère, lu dans la table d'évaluation de la charge ;
  // null quand la configuration ne se normalise pas.
  const etats = $derived(choix.length + ordres.length === 0 ? null : etatsDesCriteres(charge));

  // La lecture d'une saisie du réglage nom : la validation du contrôleur sur
  // les réglages proposés, ce réglage remplacé par la saisie ; son refus, ou
  // à défaut le premier, sinon la valeur lue.
  const lecteur = (nom) => (texte) => {
    const { reglages, refus } = generation.valider({ ...generation.reglagesProposes(), [nom]: texte });
    const propre = refus.find(({ champ }) => champ === nom) ?? refus[0];
    if (propre !== undefined) return { refus: { code: propre.code, details: propre.details } };
    return { valeur: reglages[nom] };
  };

  const ecrire = (cle) => (valeur) => seance.executer('modifierReglage', { cle, valeur });

  // Le refus de la dernière bascule, { cle, refus }, posé à côté d'elle.
  let refusBascule = $state.raw(null);

  // Le clic sur une case : la séance écrit la valeur contraire de celle de
  // la charge ; à l'issue, la case montre celle de la charge, écrite ou
  // inchangée. Annuler le clic ne suffirait pas : la séance peut avoir écrit
  // avant que le navigateur rétablisse la case, à la fin de l'événement.
  async function basculer(evenement, entree) {
    const caseACocher = evenement.currentTarget;
    const { cle } = entree;
    refusBascule = null;
    try {
      await seance.executer('modifierReglage', { cle, valeur: !valeurDuReglage(charge.reglages, entree) });
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refusBascule = { cle, refus: { code: erreur.code, details: erreur.details ?? {} } };
    } finally {
      caseACocher.checked = valeurDuReglage(charge.reglages, entree);
    }
  }

  // Le refus du dernier choix, { cle, refus }, posé contre son groupe.
  let refusChoix = $state.raw(null);

  // Le choix d'un bouton radio : la séance écrit sa valeur ; à l'issue,
  // chaque bouton du groupe montre la valeur de la charge, écrite ou
  // inchangée — un choix refusé revient ainsi à l'ancien.
  async function choisir(evenement, entree) {
    const groupe = evenement.currentTarget.closest('fieldset');
    const { value: valeur } = evenement.currentTarget;
    const { cle } = entree;
    refusChoix = null;
    try {
      await seance.executer('modifierReglage', { cle, valeur });
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refusChoix = { cle, refus: { code: erreur.code, details: erreur.details ?? {} } };
    } finally {
      const courante = valeurDuReglage(charge.reglages, entree);
      for (const bouton of groupe.querySelectorAll(`input[type="radio"][data-champ="${cle}"]`)) bouton.checked = bouton.value === courante;
    }
  }
</script>

<div class="reglages" data-reglages>
  <div class="champs">
    <div class="champ">
      <label for={idGraine}>{t('generation.reglage.graine')}</label>
      <input
        id={idGraine}
        type="text"
        data-champ="graine"
        bind:value={graine}
        aria-invalid={refusGraine === null ? undefined : 'true'}
        aria-describedby={refusGraine === null ? undefined : idRefusGraine}
        oninput={() => saisirGraine()}
      />
      {#if refusGraine !== null}
        <Refus id={idRefusGraine} refus={refusGraine} />
      {/if}
    </div>
    {#each champs as entree (entree.cle)}
      <Champ
        cle={entree.cle}
        etiquette={entree.etiquette}
        valeur={valeurDuReglage(charge.reglages, entree)}
        lire={lecteur(entree.nom)}
        executer={ecrire(entree.cle)}
      />
    {/each}
  </div>
  <fieldset class="bascules">
    <legend>{t('generation.contraintes.titre')}</legend>
    {#each bascules as entree (entree.cle)}
      {@const { cle, etiquette } = entree}
      <div class="bascule">
        <input
          id={`${uid}-${cle}`}
          type="checkbox"
          data-champ={cle}
          checked={valeurDuReglage(charge.reglages, entree)}
          onclick={(evenement) => basculer(evenement, entree)}
        />
        <label for={`${uid}-${cle}`}>{t(etiquette)}</label>
        {#if refusBascule !== null && refusBascule.cle === cle}
          <Refus refus={refusBascule.refus} lever={() => (refusBascule = null)} />
        {/if}
      </div>
      {#each choixSous(cle) as entreeChoix (entreeChoix.cle)}
        {@const etat = etatAffiche(etats?.get(entreeChoix.critere))}
        {@const courante = valeurDuReglage(charge.reglages, entreeChoix)}
        {@const idRefusChoix = `${uid}-${entreeChoix.cle}-refus`}
        {@const refuse = refusChoix !== null && refusChoix.cle === entreeChoix.cle}
        <fieldset class="choix" data-mode-objectifs>
          <legend>{t(entreeChoix.etiquette)}</legend>
          {#each entreeChoix.valeurs as valeur (valeur)}
            {@const id = `${uid}-${entreeChoix.cle}-${valeur}`}
            <div class="option">
              <input
                {id}
                type="radio"
                name={`${uid}-${entreeChoix.cle}`}
                value={valeur}
                data-champ={entreeChoix.cle}
                checked={courante === valeur}
                aria-describedby={refuse ? `${id}-explication ${idRefusChoix}` : `${id}-explication`}
                onchange={(evenement) => choisir(evenement, entreeChoix)}
              />
              <label for={id}>{t(`${entreeChoix.etiquette}.${valeur}`)}</label>
              <p class="explication" id={`${id}-explication`}>{t(`${entreeChoix.etiquette}.${valeur}.explication`)}</p>
            </div>
          {/each}
          {#if etat !== null}
            <p class="note">{t(`${entreeChoix.etiquette}.etat.${etat}`)}</p>
          {/if}
          {#if refuse}
            <Refus id={idRefusChoix} refus={refusChoix.refus} lever={() => (refusChoix = null)} />
          {/if}
        </fieldset>
      {/each}
    {/each}
  </fieldset>
  {#each ordres as entree (entree.cle)}
    <Priorites {charge} {entree} {etats} />
  {/each}
  <fieldset class="coeurs" data-coeurs>
    <legend>{t('generation.coeurs.titre')}</legend>
    <div class="bascule">
      <input
        id={idCoeursAutomatiques}
        type="checkbox"
        data-champ="coeursAutomatiques"
        checked={coeurs.automatique}
        onchange={basculerCoeurs}
      />
      <label for={idCoeursAutomatiques}>{t('generation.coeurs.automatique')}</label>
    </div>
    {#if !coeurs.automatique}
      <div class="champ">
        <label for={idCoeurs}>{t('generation.coeurs.nombre', { disponibles: coeurs.disponibles })}</label>
        <input
          id={idCoeurs}
          type="text"
          inputmode="numeric"
          data-champ="coeurs"
          bind:value={saisieCoeurs}
          aria-invalid={refusCoeurs === null ? undefined : 'true'}
          aria-describedby={refusCoeurs === null ? undefined : idRefusCoeurs}
          oninput={() => (refusCoeurs = null)}
          onkeydown={toucheCoeurs}
          onblur={validerCoeurs}
        />
        {#if refusCoeurs !== null}
          <Refus id={idRefusCoeurs} refus={refusCoeurs} />
        {/if}
      </div>
    {/if}
    <p data-coeurs-disponibles>{t('generation.coeurs.disponibles', { disponibles: coeurs.disponibles })}</p>
    <p>{t('generation.coeurs.note')}</p>
  </fieldset>
  {#if mesure === null}
    <p class="note" data-duree>{t('generation.duree.inconnue')}</p>
  {:else}
    <p class="note" data-duree>{t('generation.duree.observee', mesure)}</p>
    <p class="note" data-estimation>{t('generation.duree.estimee', estimation)}</p>
  {/if}
</div>

<style>
  .reglages {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
  }

  .champs {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-4);
  }

  .champ {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
  }

  input {
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
  }

  input:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 1px;
  }

  input[aria-invalid='true'] {
    border-color: var(--couleur-refus);
  }

  /* Les deux groupes : un filet de carte, l'intertitre en petites capitales
     d'encre secondaire. */
  .coeurs,
  .bascules {
    margin: 0;
    padding: var(--espace-3) var(--espace-4);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
  }

  .coeurs {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  .bascules {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2) var(--espace-5);
  }

  legend {
    padding: 0 var(--espace-1);
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  .bascule {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-1);
  }

  .bascule input {
    margin: 0;
  }

  /* Le choix, sous sa case, sur toute la largeur du groupe : sa légende se
     lit comme le libellé d'un champ, chaque bouton suivi de son explication
     en encre secondaire. */
  .choix {
    display: flex;
    flex-basis: 100%;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    margin: 0 0 0 var(--espace-5);
    padding: 0;
    border: none;
  }

  .choix > legend {
    padding: 0;
    margin-bottom: var(--espace-2);
    color: var(--couleur-page-texte);
    font-size: var(--taille-texte);
    font-weight: normal;
    letter-spacing: normal;
    text-transform: none;
  }

  .option {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0 var(--espace-1);
  }

  .option input {
    margin: 0;
  }

  .option input:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .explication {
    grid-column: 2;
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
  }

  p {
    margin: 0;
  }

  .note {
    color: var(--couleur-page-texte-secondaire);
  }
</style>
