// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le collecteur d'erreurs de la page (§ 19.2) : un script classique, que
// index.html charge avant le module d'entrée, et qui accumule dans
// globalThis.__gttErreurs ce qu'aucun pilote ne lit de façon portable dans la
// console — une erreur non rattrapée, une promesse rejetée sans
// gestionnaire, chaque appel de console.error —, dans l'ordre de leur
// arrivée. Le pilote relit le tableau à chaque étape et échoue sur sa
// première entrée.
//
// Une entrée est { type, message } : type vaut 'error', 'unhandledrejection'
// ou 'console.error' ; message est le texte de l'erreur, la raison du rejet,
// ou les arguments de console.error joints par une espace. Le script ne
// s'installe qu'une fois par page : chargé de nouveau, il garde le tableau
// et l'enveloppe déjà posés.
(function installer() {
  'use strict';
  if (Array.isArray(globalThis.__gttErreurs)) return;
  var erreurs = [];
  globalThis.__gttErreurs = erreurs;

  // Le texte d'une valeur levée, rejetée ou passée à console.error : le
  // message d'une erreur, la chaîne elle-même, sinon sa conversion.
  function texte(valeur) {
    if (valeur instanceof Error) return valeur.message;
    try {
      return String(valeur);
    } catch (_) {
      return Object.prototype.toString.call(valeur);
    }
  }

  globalThis.addEventListener('error', function (evenement) {
    erreurs.push({ type: 'error', message: evenement.error !== undefined && evenement.error !== null ? texte(evenement.error) : String(evenement.message) });
  });
  globalThis.addEventListener('unhandledrejection', function (evenement) {
    erreurs.push({ type: 'unhandledrejection', message: texte(evenement.reason) });
  });
  var original = console.error;
  console.error = function () {
    var morceaux = [];
    for (var i = 0; i < arguments.length; i += 1) morceaux.push(texte(arguments[i]));
    erreurs.push({ type: 'console.error', message: morceaux.join(' ') });
    return original.apply(console, arguments);
  };
})();
