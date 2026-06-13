# Shared launch bootstrap: prerequisites, deps, builds, health checks
param(
  [scriptblock]$OnProgress = { param($pct, $status, $detail) }
)

function Write-LaunchProgress {
  param([int]$Pct, [string]$Status, [string]$Detail = '')
  & $OnProgress $Pct $Status $Detail
}

function Test-CommandExists {
  param([string]$Name)
  $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-PortInUse {
  param([int]$Port)
  try {
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $c
  } catch {
    return $false
  }
}

function Stop-PortListener {
  param([int]$Port)
  try {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
      $procId = $c.OwningProcess
      if ($procId -and $procId -ne 0) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      }
    }
  } catch { }
}

function Wait-Url {
  param([string]$Url, [int]$TimeoutSec = 45)
  $elapsed = 0.0
  while ($elapsed -lt $TimeoutSec) {
    try {
      $req = [System.Net.WebRequest]::Create($Url)
      $req.Timeout = 2000
      $req.GetResponse().Close()
      return $true
    } catch {
      Start-Sleep -Milliseconds 500
      $elapsed += 0.5
    }
  }
  return $false
}

$script:RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Invoke-RootNpm {
  param([string[]]$NpmArgs)
  $npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  $npm = if ($npmCmd) { $npmCmd.Source } else { 'npm.cmd' }
  $p = Start-Process -FilePath $npm -ArgumentList $NpmArgs -WorkingDirectory $script:RootDir -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ne 0) { throw "npm $($NpmArgs -join ' ') failed (exit $($p.ExitCode))" }
}

$rootDir = $script:RootDir
$serverDir = Join-Path $rootDir 'packages\server'
$dataDir = Join-Path $serverDir 'data'
$dbFile = Join-Path $dataDir 'strikescope.db'

Write-LaunchProgress 2 'Checking prerequisites...' ''

if (-not (Test-CommandExists 'node')) {
  throw 'Node.js is not installed. Install Node 20+ from https://nodejs.org'
}
if (-not (Test-CommandExists 'npm')) {
  throw 'npm is not available. Reinstall Node.js with npm included.'
}

$nodeVer = (node -v) -replace 'v', ''
$nodeMajor = [int]($nodeVer.Split('.')[0])
if ($nodeMajor -lt 18) {
  throw "Node.js $nodeVer is too old. Require Node 18+."
}

Write-LaunchProgress 8 'Installing dependencies...' 'npm install (root workspaces)'
if (-not (Test-Path (Join-Path $rootDir 'node_modules'))) {
  Invoke-RootNpm @('install')
} else {
  $lock = Join-Path $rootDir 'package-lock.json'
  $nm = Join-Path $rootDir 'node_modules'
  if ((Get-Item $lock).LastWriteTimeUtc -gt (Get-Item $nm).LastWriteTimeUtc) {
    Invoke-RootNpm @('install')
  }
}

Write-LaunchProgress 18 'Building workspaces...' 'shared, server, admin, installer, field, monitor'
Invoke-RootNpm @('run', 'build', '-w', 'shared')
Invoke-RootNpm @('run', 'build', '-w', 'packages/server')
Invoke-RootNpm @('run', 'build', '-w', 'packages/admin')
Invoke-RootNpm @('run', 'build', '-w', 'packages/installer')
Invoke-RootNpm @('run', 'build', '-w', 'packages/field')
Invoke-RootNpm @('run', 'build', '-w', 'packages/monitor')

$adminDist = Join-Path $rootDir 'packages\admin\dist\index.html'
$serverDist = Join-Path $rootDir 'packages\server\dist\index.js'
if (-not (Test-Path $adminDist)) { throw 'Admin build missing: packages/admin/dist/index.html' }
if (-not (Test-Path $serverDist)) { throw 'Server build missing: packages/server/dist/index.js' }

Write-LaunchProgress 55 'Verifying database...' ''
if (-not (Test-Path $dataDir)) {
  New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
}
$npmCmd2 = Get-Command npm.cmd -ErrorAction SilentlyContinue
$npm2 = if ($npmCmd2) { $npmCmd2.Source } else { 'npm.cmd' }
$dbStatus = Start-Process -FilePath $npm2 -ArgumentList @('run', 'db:status', '-w', 'packages/server') -WorkingDirectory $rootDir -Wait -PassThru -NoNewWindow
if ($dbStatus.ExitCode -ne 0) {
  Write-LaunchProgress 55 'Database will initialize on first server start...' ''
}

if (Test-CommandExists 'ollama') {
  Write-LaunchProgress 58 'Checking Ollama models (Dev Studio)...' ''
  try {
    $tags = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 5
    $names = @($tags.models | ForEach-Object { $_.name })
    $needCoder = -not ($names | Where-Object { $_ -match 'qwen2.5-coder|deepseek-coder|codellama' })
    $needEmbed = -not ($names | Where-Object { $_ -match 'nomic-embed|embed' })
    if ($needCoder) {
      Write-LaunchProgress 58 'Dev Studio: pull coding model' 'ollama pull qwen2.5-coder:7b'
    } elseif ($needEmbed) {
      Write-LaunchProgress 58 'Dev Studio: pull embed model' 'ollama pull nomic-embed-text'
    } else {
      Write-LaunchProgress 58 'Ollama models ready (Dev Studio)' ''
    }
  } catch {
    Write-LaunchProgress 58 'Ollama installed but not running' 'run: ollama serve'
  }
} else {
  Write-LaunchProgress 58 'Ollama not found — Dev Studio AI optional' 'https://ollama.com'
}

if (Test-CommandExists 'docker') {
  Write-LaunchProgress 60 'Starting Activepieces (optional)...' 'services/activepieces'
  $composeFile = Join-Path $rootDir 'services\activepieces\docker-compose.yml'
  $envFile = Join-Path $rootDir 'services\activepieces\.env.example'
  if ((Test-Path $composeFile) -and (Test-Path $envFile)) {
    try {
      $dc = Start-Process -FilePath 'docker' -ArgumentList @(
        'compose', '-f', $composeFile, '--env-file', $envFile, 'up', '-d'
      ) -WorkingDirectory $rootDir -Wait -PassThru -NoNewWindow
      if ($dc.ExitCode -eq 0) {
        $apOk = Wait-Url 'http://localhost:8080/api/v1/health' 30
        if ($apOk) {
          Write-LaunchProgress 61 'Activepieces ready' 'http://localhost:8080'
        } else {
          Write-LaunchProgress 61 'Activepieces starting (health pending)' 'http://localhost:8080'
        }
      } else {
        Write-LaunchProgress 61 'Activepieces skipped' 'docker compose failed — CRM still works'
      }
    } catch {
      Write-LaunchProgress 61 'Activepieces skipped' $_.Exception.Message
    }
  }
} else {
  Write-LaunchProgress 60 'Docker not found — automations optional' 'npm run automations:up'
}

Write-LaunchProgress 62 'Preparing ports...' '3001, 5173-5176'
foreach ($port in 3001, 5173, 5174, 5175, 5176) {
  if (Test-PortInUse $port) { Stop-PortListener $port }
  Start-Sleep -Milliseconds 200
}

return @{
  RootDir = $rootDir
  ServerDir = $serverDir
  WaitUrl = ${function:Wait-Url}
}
