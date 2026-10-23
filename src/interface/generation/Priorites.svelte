<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // L'éditeur de l'ordre des priorités (§ 5.3, § 5.7, A11, A12) : un groupe
  // sous le libellé de l'entrée, la liste ordonnée des paliers (data-priorites),
  // chaque palier numéroté en texte, « Palier 2 sur 6 » (data-palier, son
  // index à partir de 0), et ses critères (data-priorite, leur nom) sous leur
  // nom complet, celui de mobilier.critere.<nom>. L'ordre se lit sur la charge
  // par valeurDuReglage, l'ordre par défaut quand elle n'en porte pas.
  //
  // Le nom d'un critère est un terme expliqué (data-terme, le nom du
  // critère), focalisable au clavier (tabindex 0) : son survol ou son focus
  // ouvre l'infobulle de l'éditeur, une seule (Infobulle, primitive), sur
  // generation.priorites.explication.<nom>, et le quitter la referme quand
  // elle est encore la sienne ; ouvrir sur un autre nom remplace
  // l'explication, Échap la referme, le focus restant sur le nom. Le nom
  // expliqué porte aria-describedby vers elle, et lui seul. Quand la liste
  // change, l'infobulle se replace contre son nom, ou se ferme quand ce nom
  // a quitté le document.
  //
  // L'état d'un critère, « décoché » ou « sans objet », s'écrit en texte à
  // côté de son nom : il se lit dans etats, l'état que la table d'évaluation
  // porte (etatsDesCriteres, priorites.js), jamais recalculé ici. Le critère
  // garde son rang dans la liste, quel que soit son état.
  //
  // Chaque critère porte les boutons de ses gestes offerts (gestesOfferts,
  // sous l'admission de la commande sur les réglages de l'événement) ; aucun
  // ne nomme une touche, aucun raccourci ne s'y ajoute : Tab les atteint,
  // Entrée ou Espace les active. Chaque libellé nomme le critère, ce qui
  // donne à chaque bouton un nom accessible à lui. Monter et descendre
  // déplacent le palier du critère, et disent « le palier » quand il en porte
  // plusieurs. Un geste est une commande changerPriorites {paliers} — une
  // entrée du journal — ; abouti, la région role="status" annonce la place du
  // critère, et le focus le suit : le même bouton quand le geste reste
  // offert, sinon son premier bouton, sinon son nom, qui ouvre alors son
  // explication comme tout focus. « Rétablir l'ordre par
  // défaut » est retablirPriorites, sans fenêtre à confirmer (D19).
  //
  // Le refus d'un geste — lecture, plan bloqué, support rompu — se pose
  // contre la liste, avec son remède, et décrit le groupe de l'éditeur
  // (aria-describedby), focalisable par programme (tabindex -1) : après le
  // remède, le focus revient au groupe ; rien ne s'écrit. Le poids d'un
  // critère d'un palier partagé se saisit dans un Champ nombre, étroit, de
  // 1 à POIDS_MAX par pas de 1 (poids.<nom>), lu par lireEntier et écrit à
  // la sortie du champ par changerPriorites ; son refus, un poids hors de
  // son domaine compris, se pose contre le champ : les bornes de l'entrée
  // guident ses flèches et ne refusent rien.
  import { getContext, tick, untrack } from 'svelte';
  import { lireEntier } from '../../application/capacite.js';
  import { POIDS_MAX } from '../../application/commandes_mobilier.js';
  import Champ from '../primitives/Champ.svelte';
  import Commande from '../primitives/Commande.svelte';
  import Infobulle from '../primitives/Infobulle.svelte';
  import Refus from '../primitives/Refus.svelte';
  import { admissionSous, avecPoids, etatAffiche, gestesOfferts, listeApres, placeDe } from './priorites.js';
  import { valeurDuReglage } from './reglages.js';

  let { charge, entree, etats = null } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const uid = $props.id();
  const idRefus = `${uid}-refus`;
  const idExplication = `${uid}-explication`;

  // La clé du libellé de chaque geste : celle d'un critère seul, puis celle
  // d'un critère d'un palier partagé.
  const LIBELLES = new Map([
    ['monterCritere', ['generation.priorites.monter', 'generation.priorites.monterPalier']],
    ['descendreCritere', ['generation.priorites.descendre', 'generation.priorites.descendrePalier']],
    ['joindrePalier', ['generation.priorites.joindre', 'generation.priorites.joindre']],
    ['separerPalier', ['generation.priorites.separer', 'generation.priorites.separer']],
  ]);
  const libelleDu = (geste, partage) => LIBELLES.get(geste)[partage ? 1 : 0];

  const liste = $derived(valeurDuReglage(charge.reglages, entree));
  const regle = $derived(charge.reglages[entree.cle] !== undefined);
  const admet = $derived(admissionSous(charge.reglages));

  // Le critère expliqué : {ancre, critere, cle, details} — l'élément de son
  // nom, le critère et la clé de son explication — ; null sans infobulle.
  let expliquee = $state.raw(null);
  function expliquer(evenement, critere) {
    expliquee = { ancre: evenement.currentTarget, critere, cle: `generation.priorites.explication.${critere}`, details: {} };
  }
  function taire(critere) {
    if (expliquee?.critere === critere) expliquee = null;
  }
  const fermerExplication = () => (expliquee = null);
  // L'aria-describedby du nom d'un critère : l'infobulle quand elle l'explique.
  const decrit = (critere) => (expliquee?.critere === critere ? idExplication : undefined);

  // Après chaque rendu d'une liste, l'explication ouverte se replace : une
  // copie d'expliquee relance le placement de l'infobulle, contre son nom
  // déplacé avec son palier ; un nom qu'un palier refait a retiré du
  // document la referme, la primitive le vérifiant à chaque placement.
  $effect(() => {
    void liste;
    untrack(() => {
      if (expliquee !== null) expliquee = { ...expliquee };
    });
  });

  // Le refus du dernier geste, posé contre la liste ; l'annonce du dernier
  // geste abouti.
  let refus = $state.raw(null);
  let annonce = $state('');
  let racine = $state(null);

  // Exécute la commande ; vrai quand elle aboutit. Un refus de la séance se
  // pose contre la liste ; une erreur sans code remonte.
  async function executer(nom, args) {
    refus = null;
    annonce = '';
    try {
      await seance.executer(nom, args);
      return true;
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refus = { code: erreur.code, details: erreur.details ?? {} };
      return false;
    }
  }

  // Le focus suit le critère : le bouton du même geste, sinon le premier de
  // ses boutons, sinon son nom.
  function suivre(critere, geste) {
    const porteur = racine?.querySelector(`[data-priorite="${critere}"]`) ?? null;
    if (porteur === null) return;
    const cible =
      porteur.querySelector(`button[data-commande="${geste}"]`) ?? porteur.querySelector('button') ?? porteur.querySelector('.nom');
    cible.focus();
  }

  async function deplacer(critere, geste) {
    const apres = listeApres(liste, geste, critere);
    if (!(await executer('changerPriorites', { paliers: apres }))) return;
    const { palier, paliers, avec } = placeDe(apres, critere);
    annonce = t('generation.priorites.annonce', { critere, palier: palier + 1, paliers, avec });
    await tick();
    suivre(critere, geste);
  }

  async function retablir() {
    if (await executer('retablirPriorites', {})) annonce = t('generation.priorites.annonceRetablie');
  }

  const ecrirePoids = (critere) => (poids) => seance.executer('changerPriorites', { paliers: avecPoids(liste, critere, poids) });
</script>

<fieldset class="priorites" tabindex="-1" aria-describedby={refus === null ? undefined : idRefus}>
  <legend>{t(entree.etiquette)}</legend>
  <p class="note">{t('generation.priorites.note')}</p>
  <p class="note">{t(regle ? 'generation.priorites.regle' : 'generation.priorites.parDefaut')}</p>
  <ol data-priorites bind:this={racine}>
    {#each liste as palier, index (palier.map(({ critere }) => critere).join())}
      {@const partage = palier.length > 1}
      <li data-palier={index}>
        <p class="numero">{t('generation.priorites.palier', { palier: index + 1, paliers: liste.length })}</p>
        <ul>
          {#each palier as { critere, poids } (critere)}
            {@const etat = etatAffiche(etats?.get(critere))}
            <li data-priorite={critere}>
              <!-- Le nom est un terme, non une commande : le focus ne sert qu'à
                   montrer au clavier l'explication que le pointeur montre au
                   survol. -->
              <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
              <span
                class="nom"
                data-terme={critere}
                tabindex="0"
                aria-describedby={decrit(critere)}
                onmouseenter={(evenement) => expliquer(evenement, critere)}
                onmouseleave={() => taire(critere)}
                onfocus={(evenement) => expliquer(evenement, critere)}
                onblur={() => taire(critere)}>{t(`mobilier.critere.${critere}`)}</span
              >
              {#if etat !== null}
                <span class="etat">{t(`generation.priorites.etat.${etat}`)}</span>
              {/if}
              {#if partage}
                <Champ
                  cle={`poids.${critere}`}
                  etiquette="generation.priorites.poids"
                  details={{ critere }}
                  valeur={poids}
                  lire={lireEntier}
                  executer={ecrirePoids(critere)}
                  type="number"
                  min={1}
                  max={POIDS_MAX}
                  pas={1}
                />
              {/if}
              <div class="gestes">
                {#each gestesOfferts(liste, critere, admet) as geste (geste)}
                  <Commande
                    cle={libelleDu(geste, partage)}
                    details={{ critere }}
                    nom={geste}
                    executer={() => deplacer(critere, geste)}
                  />
                {/each}
              </div>
            </li>
          {/each}
        </ul>
      </li>
    {/each}
  </ol>
  <Infobulle id={idExplication} ouverte={expliquee} fermer={fermerExplication} />
  <p class="annonce" role="status">{annonce}</p>
  <div class="retablir">
    <Commande cle="generation.priorites.retablir" nom="retablirPriorites" executer={retablir} />
  </div>
  {#if refus !== null}
    <Refus id={idRefus} {refus} lever={() => (refus = null)} />
  {/if}
</fieldset>

<style>
  /* Le groupe : un filet de carte, l'intertitre en petites capitales d'encre
     secondaire, comme les contraintes et les cœurs. */
  .priorites {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    margin: 0;
    padding: var(--espace-3) var(--espace-4);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
  }

  legend {
    padding: 0 var(--espace-1);
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  p {
    margin: 0;
  }

  .note {
    color: var(--couleur-page-texte-secondaire);
  }

  /* Les paliers, l'un sous l'autre, chacun séparé du suivant par un filet ;
     son numéro en tête, en texte. */
  ol {
    display: flex;
    flex-direction: column;
    align-self: stretch;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  ol > li {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    padding: var(--espace-2) 0;
    border-top: 1px solid var(--couleur-ligne-filet);
  }

  .numero {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-texte-petit);
    font-weight: bold;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    margin: 0;
    padding: 0 0 0 var(--espace-4);
    list-style: none;
  }

  /* Un critère : son nom, son état, son poids et ses gestes sur une ligne,
     qui passe à la suivante quand la place manque. */
  ul > li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-1) var(--espace-3);
  }

  /* Le nom, terme expliqué, se signale par un soulignement pointillé, comme
     un en-tête de colonne du tableau des propositions. */
  .nom {
    font-weight: bold;
    text-decoration: underline dotted;
    text-underline-offset: 0.2em;
  }

  .nom:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .etat {
    color: var(--couleur-page-texte-secondaire);
    font-style: italic;
  }

  .gestes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-1);
  }
</style>
