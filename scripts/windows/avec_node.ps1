# © 2026 TechnoLibre (http://www.technolibre.ca)
# SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

# Exécute une commande à la racine du projet, le Node du projet en tête du
# PATH, une fois l'installation vérifiée : c'est par lui que le Makefile
# lance npm, npx et node sous Windows.
#
#   powershell -File scripts\windows\avec_node.ps1 npm test
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Commande)
. (Join-Path $PSScriptRoot 'commun.ps1')

$elements = @($Commande | Where-Object { $_ })
if ($elements.Count -eq 0) {
  Write-Gtt 'usage : scripts\windows\avec_node.ps1 <commande> [argument…]'
  exit 2
}
Initialize-Gtt
Push-Location $script:GttRacine
try {
  $programme = $elements[0]
  # npm et npx se lancent par leur .cmd : leur variante .ps1 dépend de la
  # stratégie d'exécution de la machine.
  if (@('npm', 'npx') -contains $programme) { $programme = "$programme.cmd" }
  if ($elements.Count -gt 1) {
    $reste = $elements[1..($elements.Count - 1)]
    & $programme @reste
  } else {
    & $programme
  }
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
