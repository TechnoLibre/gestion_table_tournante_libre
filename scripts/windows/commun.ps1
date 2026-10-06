# © 2026 TechnoLibre (http://www.technolibre.ca)
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

# Fonctions communes des scripts Windows : le Node du projet, posé hors du
# dépôt sous %LOCALAPPDATA%, et la vérification de l'installation. Ce
# fichier se charge par « . ». Il s'en tient à Windows PowerShell 5.1, livré
# avec Windows : ni ??, ni ?., ni opérateur ternaire. Il est enregistré en
# UTF-8 avec marque d'ordre d'octets, sans laquelle Windows PowerShell 5.1 le
# lit dans la page de code du système et défigure les accents.

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0
# Sans ces réglages, Windows PowerShell 5.1 écrit les accents dans la page de
# code de la console, peut refuser TLS 1.2 que nodejs.org exige, et ralentit
# chaque téléchargement par sa barre de progression.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Net.ServicePointManager]::SecurityProtocol =
  [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'

$script:GttRacine = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Write-Gtt([string]$Message) {
  [Console]::Error.WriteLine($Message)
}

function Stop-Gtt([string]$Message) {
  Write-Gtt "Refusé : $Message"
  exit 1
}

# Majeure de Node que vise le projet ; .node-version en est la seule source.
function Get-GttMajeure {
  $majeure = (Get-Content -Raw (Join-Path $script:GttRacine '.node-version')).Trim()
  if ($majeure -notmatch '^[0-9]+$') {
    Stop-Gtt ".node-version doit porter une majeure entière : « $majeure »."
  }
  return $majeure
}

# Architecture au sens de nodejs.org. PROCESSOR_ARCHITEW6432 nomme celle du
# système quand PowerShell lui-même tourne en 32 bits.
function Get-GttArchNode {
  $arch = $env:PROCESSOR_ARCHITEW6432
  if (-not $arch) { $arch = $env:PROCESSOR_ARCHITECTURE }
  switch ($arch) {
    'AMD64' { return 'x64' }
    'ARM64' { return 'arm64' }
    default { Stop-Gtt "architecture $arch : nodejs.org n'y publie pas Node pour Windows." }
  }
}

function Get-GttDossierDonnees {
  return (Join-Path $env:LOCALAPPDATA 'gestion_table_tournante_libre')
}

function Get-GttDossierNode {
  return (Join-Path (Get-GttDossierDonnees) ('node-{0}-win-{1}' -f (Get-GttMajeure), (Get-GttArchNode)))
}

# Somme et nom de l'archive .zip d'une architecture dans les lignes d'un
# SHASUMS256.txt de nodejs.org ; $null quand elle n'y figure pas.
function Find-GttArchiveNode([string[]]$Lignes, [string]$Arch) {
  $suffixe = "-win-$Arch.zip"
  foreach ($ligne in $Lignes) {
    $champs = @($ligne.Trim() -split '\s+')
    if ($champs.Count -ge 2 -and $champs[1] -match '^node-v[0-9]+\.[0-9]+\.[0-9]+-' -and
        $champs[1].EndsWith($suffixe, [StringComparison]::Ordinal)) {
      return @($champs[0], $champs[1])
    }
  }
  return $null
}

# Pose la dernière version publiée de la majeure voulue, une fois. L'archive
# est vérifiée contre la somme que publie nodejs.org, puis extraite à côté de
# la cible et renommée : une extraction interrompue ne laisse jamais une
# cible à moitié écrite.
function Install-GttNode {
  $majeure = Get-GttMajeure
  $arch = Get-GttArchNode
  $cible = Get-GttDossierNode
  $node = Join-Path $cible 'node.exe'
  if (Test-Path $node) {
    Write-Gtt ('Node {0} : {1}' -f (& $node --version), $cible)
    return
  }
  $cache = Join-Path (Get-GttDossierDonnees) 'cache'
  New-Item -ItemType Directory -Force -Path $cache | Out-Null
  $base = "https://nodejs.org/dist/latest-v$majeure.x"
  $sommes = Join-Path $cache "SHASUMS256-v$majeure.txt"
  Invoke-WebRequest -UseBasicParsing -Uri "$base/SHASUMS256.txt" -OutFile $sommes
  $trouve = Find-GttArchiveNode (Get-Content $sommes) $arch
  if (-not $trouve) { Stop-Gtt "nodejs.org ne publie pas Node $majeure pour win-$arch." }
  $somme = $trouve[0]
  $nom = $trouve[1]
  $archive = Join-Path $cache $nom
  if (-not (Test-Path $archive) -or (Get-FileHash -Algorithm SHA256 $archive).Hash -ne $somme) {
    Write-Gtt "Téléchargement de $nom"
    $partiel = "$archive.$PID.partiel"
    Invoke-WebRequest -UseBasicParsing -Uri "$base/$nom" -OutFile $partiel
    if ((Get-FileHash -Algorithm SHA256 $partiel).Hash -ne $somme) {
      Remove-Item -Force $partiel
      Stop-Gtt "$nom : la somme SHA-256 ne correspond pas à celle que publie nodejs.org."
    }
    Move-Item -Force $partiel $archive
  }
  $tmp = Join-Path (Get-GttDossierDonnees) ('extraction.' + [guid]::NewGuid().ToString('N'))
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($archive, $tmp)
  if (Test-Path $cible) { Remove-Item -Recurse -Force $cible }
  Move-Item (Join-Path $tmp ([IO.Path]::GetFileNameWithoutExtension($nom))) $cible
  Remove-Item -Force $tmp
  Write-Gtt ('Node {0} posé : {1}' -f (& $node --version), $cible)
}

# Met le Node du projet en tête du PATH de la séance ; faux quand il n'est
# pas posé.
function Enable-GttNode {
  $cible = Get-GttDossierNode
  if (-not (Test-Path (Join-Path $cible 'node.exe'))) { return $false }
  $env:Path = "$cible;$env:Path"
  return $true
}

# Vrai quand les dépendances npm suivent package-lock.json : npm écrit
# node_modules\.package-lock.json à chaque installation.
function Test-GttDependances {
  $recu = Join-Path $script:GttRacine 'node_modules\.package-lock.json'
  if (-not (Test-Path $recu)) { return $false }
  $verrou = Get-Item (Join-Path $script:GttRacine 'package-lock.json')
  return ($verrou.LastWriteTimeUtc -le (Get-Item $recu).LastWriteTimeUtc)
}

# Vrai sur une réponse affirmative — o, oui, y, yes. Le défaut est non, et
# une entrée redirigée ne consent à rien. GTT_OUI=1 répond oui d'avance.
function Confirm-Gtt([string]$Question) {
  if ($env:GTT_OUI -eq '1') { return $true }
  if ([Console]::IsInputRedirected) { return $false }
  $reponse = Read-Host "$Question [o/N]"
  return (@('o', 'oui', 'y', 'yes') -contains $reponse.Trim().ToLowerInvariant())
}

# Exécute un programme et refuse quand il échoue, en le nommant.
function Invoke-Gtt([string]$Programme, [string[]]$Arguments) {
  & $Programme @Arguments
  if ($LASTEXITCODE -ne 0) { Stop-Gtt "$Programme $($Arguments -join ' ') échoue (code $LASTEXITCODE)." }
}

function Invoke-GttNpmCi {
  Invoke-Gtt 'npm.cmd' @('ci', '--no-audit', '--no-fund')
}

# Rend prêt à exécuter : le Node du projet en tête du PATH, et des
# dépendances npm qui suivent package-lock.json. Node absent, il propose
# install.cmd ; des dépendances en retard se réinstallent sans question.
function Initialize-Gtt {
  if (-not (Enable-GttNode)) {
    Write-Gtt "Node $(Get-GttMajeure) n'est pas posé."
    if (-not (Confirm-Gtt 'Lancer install.cmd (Node, dépendances npm) ?')) {
      Stop-Gtt 'installation non lancée. Lancer install.cmd, puis recommencer.'
    }
    & (Join-Path $PSScriptRoot 'installer.ps1')
    if (-not (Enable-GttNode)) { Stop-Gtt "Node $(Get-GttMajeure) reste introuvable après l'installation." }
  }
  if (-not (Test-GttDependances)) {
    Write-Gtt 'Les dépendances npm ne suivent pas package-lock.json : npm ci.'
    Push-Location $script:GttRacine
    try { Invoke-GttNpmCi } finally { Pop-Location }
  }
}
