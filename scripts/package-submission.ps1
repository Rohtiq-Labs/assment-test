# Creates a source-only ZIP for submission using git archive (no node_modules, .venv, or untracked junk).
# Run from repository root:  .\scripts\package-submission.ps1

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

if (-not (Test-Path (Join-Path $repoRoot '.git'))) {
  Write-Host 'No .git directory found. Use manual zipping per README.md (Submission packaging).' -ForegroundColor Yellow
  exit 1
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$outName = "smh-blockly-assignment-submission-$stamp.zip"
$outPath = Join-Path $repoRoot $outName

git archive --format=zip -o $outPath HEAD
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "Created: $outPath" -ForegroundColor Green
Write-Host 'Reminder: .env is not in the archive; reviewers create it from README.' -ForegroundColor Cyan
