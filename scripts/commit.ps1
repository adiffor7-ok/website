<#
.SYNOPSIS
  Stage all changes in the repo, commit, and optionally push.

.EXAMPLE
  .\scripts\commit.ps1 -Message "Rebuild gallery data"
.EXAMPLE
  .\scripts\commit.ps1 -Message "Site updates" -Push
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Message,
  [switch]$Push
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error 'git not found in PATH. Install Git for Windows or open Git Bash and use scripts/commit.sh instead.'
}

git add -A
if (-not (git status --porcelain)) {
  Write-Host 'Nothing to commit (working tree clean).' -ForegroundColor Yellow
  exit 0
}

git commit -m $Message
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

if ($Push) {
  git push
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
