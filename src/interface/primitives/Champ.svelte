<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // Un champ de saisie (§ 2, § 8.2, § 8.4) : son étiquette, la clé etiquette
  // traduite ; data-champ porte cle. La machine est celle de champ.js : la
  // saisie se valide à la sortie du champ ou par Entrée, jamais par un
  // minuteur, et Échap rend la valeur enregistrée. executer(valeur) part
  // dans le même tour que la sortie du champ : la séance passe ses appels
  // dans l'ordre, et un retour en lecture cliqué ensuite attend son écriture.
  //
  // Une saisie non validée est un geste ouvert, que tient geste.js : il
  // suspend le compte d'inactivité de la séance, et se recompte quand la
  // séance, renvoyée en lecture pendant la saisie, repasse en écriture.
  //
  // Le refus courant de la séance, etat().refus, refuse la première frappe
  // aussitôt : le texte revient à la valeur enregistrée, et le refus, avec
  // son remède, se pose contre le champ. Le champ lit ce refus et ne refait
  // pas le contrôle. Un refus de l'exécution dont le code nomme un état de
  // la séance (estRefusSeance, champ.js) se range avec lui. Posé, un refus
  // de la séance suit la séance par subscribe (refusSeanceCourant) : levé
  // par quelque chemin que ce soit, il quitte le champ, et une autre cause
  // le remplace. La saisie qu'une exécution refusée par un tel code a
  // laissée dans le champ reste affichée, marquée, tant qu'un refus de la
  // séance la couvre ; ce refus levé, le champ rend la valeur enregistrée :
  // il n'affiche jamais, sans marque, une saisie que rien n'a appliquée.
  // Un refus de lire, ou de l'exécution sur un autre code, est
  // local : il se pose de même, la saisie gardée, et le refus de la séance
  // passe devant lui tant qu'il dure. Le remède abouti ne retire que le
  // refus qu'il levait, celui qui s'affichait à son départ. Le champ porte
  // aria-invalid et aria-describedby vers le message. La sortie du champ ne
  // retire pas un refus : son remède, qu'un clic atteint, resterait sinon
  // hors de portée.
  //
  // nom, déjà traduit, est le nom accessible du champ, en aria-label, quand
  // son étiquette seule ne le distingue pas d'un homonyme ; null,
  // l'étiquette le nomme. L'étiquette visible ne change pas. Le refus reçoit
  // nom pour nommer son remède.
  //
  // type est celui de l'entrée : 'text', le défaut, ou 'number', un champ
  // étroit de six caractères, qui porte min, max et pas (step) quand ils
  // sont donnés. La lecture reste celle de lire, et le domaine celui de
  // l'exécution : le navigateur rend vide un texte qu'il ne lit pas comme
  // un nombre, que lire refuse comme tout texte vide.
  import { getContext, onDestroy, untrack } from 'svelte';
  import { effetDe } from '../raccourcis.js';
  import { creerMachineChamp, estRefusSeance, refusSeanceCourant } from './champ.js';
  import { creerGeste } from './geste.js';
  import Refus from './Refus.svelte';

  let {
    cle,
    etiquette,
    valeur,
    lire,
    executer,
    details = {},
    nom = null,
    gestes = {},
    type = 'text',
    min = null,
    max = null,
    pas = null,
  } = $props();

  const t = getContext('t');
  const seance = getContext('seance') ?? null;
  const uid = $props.id();
  const idEntree = `${uid}-entree`;
  const idRefus = `${uid}-refus`;

  // Le texte d'une valeur enregistrée : vide pour null.
  const texteDe = (v) => (v === null || v === undefined ? '' : String(v));

  const machine = creerMachineChamp({ stockee: untrack(() => texteDe(valeur)), lire: (texte) => lire(texte) });
  let saisie = $state(machine.saisie);
  // Le refus de la séance, posé par une frappe ou par l'exécution, et le
  // refus local, de lire ou de l'exécution ; le premier s'affiche avant le
  // second. Bruts : un refus se compare par identité, celle de l'objet que
  // Refus reçoit et rend à lever.
  let refusSeance = $state.raw(null);
  let refusLocal = $state.raw(null);
  const refus = $derived(refusSeance ?? refusLocal);
  const geste = seance === null ? null : creerGeste(seance);
  // Vrai tant que la saisie affichée est celle qu'une exécution, refusée
  // par un code de la séance, n'a pas appliquée.
  let saisieRefusee = false;

  // Pose le refus de la séance : tout changement passe par ici. Levé alors
  // qu'il couvrait une saisie refusée, celle-ci cède la place à la valeur
  // enregistrée, et le geste qu'elle tenait se rend.
  function poserRefusSeance(nouveau) {
    refusSeance = nouveau;
    if (!saisieRefusee || refusSeance !== null) return;
    saisieRefusee = false;
    machine.abandonner();
    saisie = machine.saisie;
    refusLocal = null;
    suivre();
  }

  // Le refus de la séance posé suit l'état : le même objet tant qu'il tient
  // — sa commande garde son état, une confirmation armée —, null quand il
  // est levé, la cause courante quand une autre l'a remplacé.
  const desabonner =
    seance?.subscribe((etat) => {
      if (refusSeance === null) return;
      poserRefusSeance(refusSeanceCourant(refusSeance, etat));
    }) ?? null;

  // Le remède abouti d'un refus rend celui qui s'affichait à son départ :
  // il ne retire que lui. Déjà levé par la séance, il ne retire rien.
  function lever(affiche) {
    if (affiche === refusSeance) poserRefusSeance(null);
    else if (affiche === refusLocal) refusLocal = null;
  }

  // Une valeur enregistrée nouvelle, venue de la séance : la saisie la suit
  // hors d'une saisie en cours.
  $effect.pre(() => {
    machine.recevoir(texteDe(valeur));
    untrack(() => {
      saisie = machine.saisie;
    });
  });

  // Le geste de la séance suit la saisie en cours de la machine.
  function suivre() {
    geste?.tenir(machine.enCours);
  }

  function surSaisie(evenement) {
    const entree = evenement.currentTarget;
    const courant = seance?.etat().refus ?? null;
    if (courant !== null) {
      entree.value = machine.saisie;
      poserRefusSeance(courant);
      return;
    }
    machine.saisir(entree.value);
    saisie = machine.saisie;
    saisieRefusee = false;
    poserRefusSeance(null);
    refusLocal = null;
    suivre();
  }

  // Le refus d'une exécution ; une erreur sans code n'en est pas un et
  // remonte. Un refus de la séance se confronte aussitôt à son état : levé
  // avant d'arriver, il ne se pose pas, et la saisie refusée cède la place
  // à la valeur enregistrée.
  function echouer(erreur) {
    if (typeof erreur?.code !== 'string') throw erreur;
    const recu = { code: erreur.code, details: erreur.details ?? {} };
    machine.echec(recu);
    saisie = machine.saisie;
    suivre();
    if (seance !== null && estRefusSeance(recu)) {
      saisieRefusee = true;
      poserRefusSeance(refusSeanceCourant(recu, seance.etat()));
    } else refusLocal = recu;
  }

  function valider() {
    saisieRefusee = false;
    const rendu = machine.valider();
    saisie = machine.saisie;
    suivre();
    if (rendu.action === 'refus') {
      refusLocal = rendu.refus;
      return;
    }
    if (rendu.action === 'aucune') return;
    refusLocal = null;
    let resultat;
    try {
      resultat = executer(rendu.valeur);
    } catch (erreur) {
      echouer(erreur);
      return;
    }
    Promise.resolve(resultat).catch(echouer);
  }

  function abandonner(entree) {
    machine.abandonner();
    saisie = machine.saisie;
    entree.value = machine.saisie;
    saisieRefusee = false;
    poserRefusSeance(null);
    refusLocal = null;
    suivre();
  }

  function surTouche(evenement) {
    const effet = effetDe('champ', evenement.key);
    if (effet === 'rendre') abandonner(evenement.currentTarget);
    else if (effet === 'valider') {
      evenement.preventDefault();
      valider();
    }
  }

  onDestroy(() => {
    desabonner?.();
    geste?.liberer();
  });
</script>

<div class="champ">
  <label for={idEntree}>{t(etiquette, details)}</label>
  <input
    id={idEntree}
    {type}
    min={min ?? undefined}
    max={max ?? undefined}
    step={pas ?? undefined}
    data-champ={cle}
    value={saisie}
    aria-label={nom ?? undefined}
    aria-invalid={refus === null ? undefined : 'true'}
    aria-describedby={refus === null ? undefined : idRefus}
    oninput={surSaisie}
    onkeydown={surTouche}
    onblur={valider}
  />
  {#if refus !== null}
    <Refus id={idRefus} {refus} {lever} objet={nom} {gestes} />
  {/if}
</div>

<style>
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

  /* Un nombre : six caractères de large, flèches comprises. */
  input[type='number'] {
    width: 6ch;
  }

  input:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 1px;
  }

  input[aria-invalid='true'] {
    border-color: var(--couleur-refus);
  }
</style>
