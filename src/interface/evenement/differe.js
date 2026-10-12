// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le chargeur d'une section que la construction range dans son propre
// morceau. L'interface ne charge aucun module elle-même : src/main.js lui
// passe une fonction qui rend la promesse du composant, chargée par un
// import différé ; le montage des épreuves lui passe une fonction qui rend
// le composant tout de suite, importé d'emblée. creerChargeurSection en
// fait une demande unique, que l'hôte de la section (SectionDifferee.svelte)
// appelle à chaque montage.

/**
 * La demande d'une section chargée à part.
 *
 * charger n'est appelé qu'à la première demande, puis à la demande qui suit
 * un échec : une section chargée, ou en cours de chargement, ne se charge
 * pas deux fois. Chaque demande rend ce qui est déjà connu — le composant,
 * de façon synchrone, quand charger l'a rendu tel quel ou que sa promesse
 * est résolue ; sinon la promesse en cours, la même d'une demande à
 * l'autre. Une promesse rejetée oublie son chargement : la demande suivante
 * rappelle charger.
 *
 * @param {() => Function | PromiseLike<Function>} charger  rend le
 *        composant de la section, ou une promesse de lui
 * @returns {() => Function | Promise<Function>}
 * @throws {TypeError} (à la demande, ou par rejet de la promesse rendue)
 *         quand charger rend autre chose qu'un composant, une fonction : la
 *         section ne se monterait pas, et le rejet le dit en nommant ce qui
 *         a été rendu
 */
export function creerChargeurSection(charger) {
  if (typeof charger !== 'function') throw new TypeError(`creerChargeurSection : fonction attendue, reçu ${typeof charger}`);
  let composant = null;
  let enCours = null;
  const exiger = (rendu) => {
    if (typeof rendu !== 'function') throw new TypeError(`section chargée à part : composant attendu, reçu ${rendu === null ? 'null' : typeof rendu}`);
    return rendu;
  };
  return function demander() {
    if (composant !== null) return composant;
    if (enCours !== null) return enCours;
    const rendu = charger();
    if (typeof rendu?.then !== 'function') {
      composant = exiger(rendu);
      return composant;
    }
    enCours = Promise.resolve(rendu)
      .then(exiger)
      .then((lu) => {
        composant = lu;
        return lu;
      })
      .finally(() => {
        enCours = null;
      });
    return enCours;
  };
}
