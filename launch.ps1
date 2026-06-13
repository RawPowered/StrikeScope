# StrikeScope — Developer Launch Script (console)
# Builds all workspaces, starts server on :3001, opens Server Admin

Write-Host "=== StrikeScope Dev Launch ===" -ForegroundColor Cyan

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

. (Join-Path $root 'scripts\launch-bootstrap.ps1') -OnProgress {
  param($pct, $status, $detail)
  Write-Host ("[{0,3}%] {1} {2}" -f $pct, $status, $detail) -ForegroundColor Yellow
}

$env:DEV_MODE = 'true'
$env:NODE_ENV = 'development'

Write-Host "`nStarting server on http://localhost:3001" -ForegroundColor Green
Write-Host "  Server Admin: http://localhost:3001/server/dashboard" -ForegroundColor Cyan
Write-Host "  Dev Studio:   http://localhost:3001/server/dev-studio" -ForegroundColor Cyan
Write-Host ""

Start-Process 'http://localhost:3001/server/dashboard'
npm run start -w packages/server
