# © 2026 TechnoLibre (http://www.technolibre.ca)
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)
#
# Environnement de développement sous NixOS : install.sh, run.sh et
# avec_node.sh s'y relancent d'eux-mêmes. Les binaires que les autres
# systèmes téléchargent — Node, Electron, le Chromium des épreuves —
# attendent un chargeur dynamique et des bibliothèques à des chemins que
# NixOS n'a pas ; ils viennent ici de nixpkgs. nixpkgs est épinglé par
# révision et par somme : l'environnement est le même sur toute machine, et
# ne dépend pas du canal du système.
#
#   nix-shell scripts/installation/shell.nix
let
  # nixos-26.05 : Node 26.10, Electron 43, Chromium 154.
  nixpkgs = fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/b25309931cfda5f0b8805f462a29897eeae50168.tar.gz";
    sha256 = "1svxsx57g7x76cjsgpw5vvg0l194mshk57fdvdqqgd5xdy0ari58";
  };
  pkgs = import nixpkgs { };
  # La majeure de Node vient de .node-version, seule source du projet.
  majeure = builtins.replaceStrings [ "\n" "\r" " " ] [ "" "" "" ]
    (builtins.readFile ../../.node-version);
in
pkgs.mkShell {
  packages = [
    pkgs."nodejs_${majeure}"
    pkgs.electron
    pkgs.chromium
    pkgs.gnumake
    pkgs.file
  ];
  # Les scripts du projet savent par là qu'ils s'exécutent ici.
  GTT_SHELL_NIX = "1";
  # Le paquet npm electron lance le binaire de ce dossier au lieu du sien.
  ELECTRON_OVERRIDE_DIST_PATH = "${pkgs.electron}/bin";
  # Les épreuves du navigateur lancent ce Chromium : celui que télécharge
  # Playwright ne démarre pas sous NixOS (vitest.config.js).
  GTT_CHROMIUM = "${pkgs.chromium}/bin/chromium";
  # Des polices pour Chromium et Electron, que les autres systèmes reçoivent
  # d'install_dev.sh : un NixOS minimal n'en déclare aucune, et un texte s'y
  # dessine sans largeur.
  FONTCONFIG_FILE = pkgs.makeFontsConf { fontDirectories = [ pkgs.dejavu_fonts ]; };
}
