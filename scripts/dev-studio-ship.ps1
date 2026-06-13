param(
  [Parameter(Mandatory = $true)]
  [string]$ManifestPath
)

$ErrorActionPreference = 'Stop'

function Write-DeployState {
  param([hashtable]$Patch)
  $statePath = Join-Path $rootDir 'packages\server\data\dev-agent\last-deploy.json'
  $dir = Split-Path $statePath -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $prev = @{}
  if (Test-Path $statePath) {
    try { $prev = Get-Content $statePath -Raw -Encoding UTF8 | ConvertFrom-Json -AsHashtable } catch { }
  }
  foreach ($k in $Patch.Keys) { $prev[$k] = $Patch[$k] }
  $prev['updatedAt'] = (Get-Date).ToUniversalTime().ToString('o')
  $prev | ConvertTo-Json -Depth 8 | Set-Content -Path $statePath -Encoding UTF8
}

function Stop-PortListener {
  param([int]$Port)
  try {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
      $procId = $c.OwningProcess
      if ($procId -and $procId -gt 0) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      }
    }
  } catch { }
}

function Wait-Url {
  param([string]$Url, [int]$TimeoutSec = 90)
  $elapsed = 0.0
  while ($elapsed -lt $TimeoutSec) {
    try {
      $req = [System.Net.WebRequest]::Create($Url)
      $req.Timeout = 3000
      $req.GetResponse().Close()
      return $true
    } catch {
      Start-Sleep -Milliseconds 800
      $elapsed += 0.8
    }
  }
  return $false
}

if (-not (Test-Path $ManifestPath)) {
  Write-Error "Manifest not found: $ManifestPath"
  exit 1
}

$manifest = Get-Content $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$rootDir = $manifest.rootDir
$deployId = $manifest.deployId
$snapshotId = $manifest.snapshotId
$restartAll = [bool]$manifest.restartAll

Set-Location $rootDir

Write-DeployState @{
  deployId = $deployId
  phase = 'shipping'
  snapshotId = $snapshotId
}

$buildOrder = @('shared', 'packages/server', 'packages/admin', 'packages/field', 'packages/installer', 'packages/monitor')
$moduleMap = @{
  'shared' = 'shared'
  'server' = 'packages/server'
  'admin' = 'packages/admin'
  'field' = 'packages/field'
  'installer' = 'packages/installer'
  'monitor' = 'packages/monitor'
}

$modules = @($manifest.modules)
$buildLog = @()
$failed = $false

foreach ($key in $moduleMap.Keys) {
  if ($modules -notcontains $key) { continue }
  $ws = $moduleMap[$key]
  $buildLog += "`n--- build -w $ws ---`n"
  $p = Start-Process -PassThru -NoNewWindow -Wait -FilePath 'npm.cmd' -ArgumentList @('run', 'build', '-w', $ws) -WorkingDirectory $rootDir
  if ($p.ExitCode -ne 0) {
    $failed = $true
    $buildLog += "BUILD FAILED: $ws exit $($p.ExitCode)"
    break
  }
}

if ($failed) {
  Write-DeployState @{
    phase = 'ship_failed'
    buildOk = $false
    buildLog = ($buildLog -join '')
    errors = 'Build failed during ship restart'
  }
  exit 1
}

$ports = @(3001, 5173, 5174, 5175, 5176)
if ($restartAll) {
  foreach ($port in $ports) {
    Stop-PortListener $port
    Start-Sleep -Milliseconds 300
  }
} else {
  $targets = @($manifest.restartTargets)
  if ($targets -contains 'server') { Stop-PortListener 3001 }
  if ($targets -contains 'monitor') { Stop-PortListener 5173 }
  if ($targets -contains 'installer') { Stop-PortListener 5174 }
  if ($targets -contains 'field') { Stop-PortListener 5175 }
  Start-Sleep -Milliseconds 500
}

$env:DEV_MODE = 'true'
$env:NODE_ENV = 'development'

$startServer = $restartAll -or ($manifest.restartTargets -contains 'server')
$startMonitor = $restartAll -or ($manifest.restartTargets -contains 'monitor')
$startInstaller = $restartAll -or ($manifest.restartTargets -contains 'installer')
$startField = $restartAll -or ($manifest.restartTargets -contains 'field')

if ($startServer) {
  Start-Process -NoNewWindow -FilePath 'npm.cmd' -ArgumentList @('run', 'start', '-w', 'packages/server') -WorkingDirectory $rootDir
}
if ($startInstaller) {
  Start-Process -NoNewWindow -FilePath 'npm.cmd' -ArgumentList @('run', 'dev:installer') -WorkingDirectory $rootDir
}
if ($startField) {
  Start-Process -NoNewWindow -FilePath 'npm.cmd' -ArgumentList @('run', 'dev:field') -WorkingDirectory $rootDir
}
if ($startMonitor) {
  Start-Process -NoNewWindow -FilePath 'npm.cmd' -ArgumentList @('run', 'dev:monitor') -WorkingDirectory $rootDir
}

Start-Sleep -Seconds 2
$healthOk = $false
$healthError = ''
if ($startServer) {
  $healthOk = Wait-Url 'http://localhost:3001/api/health' 90
  if (-not $healthOk) { $healthError = 'Server health check failed on :3001' }
} else {
  $healthOk = $true
}

if ($healthOk) {
  Write-DeployState @{
    phase = 'shipped'
    buildOk = $true
    healthOk = $true
    shippedAt = (Get-Date).ToUniversalTime().ToString('o')
    buildLog = ($buildLog -join '')
    errors = $null
  }
  exit 0
}

Write-DeployState @{
  phase = 'ship_failed'
  buildOk = $true
  healthOk = $false
  healthError = $healthError
  errors = $healthError
  buildLog = ($buildLog -join '')
}
exit 1
