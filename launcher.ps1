Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$sync = [Hashtable]::Synchronized(@{})
$sync.Progress = 0
$sync.Status = "Initializing..."
$sync.Detail = ""
$sync.Ready = $false
$sync.Error = $null
$sync.Procs = @{}

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bootstrapScript = Join-Path $rootDir 'scripts\launch-bootstrap.ps1'

$accent = [Drawing.Color]::FromArgb(245, 124, 0)
$bg     = [Drawing.Color]::FromArgb(30, 35, 40)
$green  = [Drawing.Color]::FromArgb(76, 175, 80)
$red    = [Drawing.Color]::FromArgb(230, 70, 70)
$dim    = [Drawing.Color]::FromArgb(136, 144, 150)
$text   = [Drawing.Color]::FromArgb(224, 224, 224)

$form = New-Object System.Windows.Forms.Form
$form.Text = "StrikeScope Launcher"
$form.ClientSize = New-Object Drawing.Size(540, 370)
$form.FormBorderStyle = 'FixedDialog'
$form.ControlBox = $false
$form.StartPosition = 'CenterScreen'
$form.BackColor = $bg
$form.TopMost = $true
$form.ShowIcon = $false
$form.ShowInTaskbar = $false

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = "STRIKESCOPE"
$lblTitle.Font = New-Object Drawing.Font("Segoe UI", 28, [Drawing.FontStyle]::Bold)
$lblTitle.ForeColor = $accent
$lblTitle.BackColor = [Drawing.Color]::Transparent
$lblTitle.TextAlign = 'MiddleCenter'
$lblTitle.Size = New-Object Drawing.Size(540, 60)
$lblTitle.Location = New-Object Drawing.Point(0, 45)
$form.Controls.Add($lblTitle)

$lblSub = New-Object System.Windows.Forms.Label
$lblSub.Text = "CRM + Server Admin"
$lblSub.Font = New-Object Drawing.Font("Segoe UI", 12)
$lblSub.ForeColor = $dim
$lblSub.BackColor = [Drawing.Color]::Transparent
$lblSub.TextAlign = 'MiddleCenter'
$lblSub.Size = New-Object Drawing.Size(540, 28)
$lblSub.Location = New-Object Drawing.Point(0, 100)
$form.Controls.Add($lblSub)

$lblLine = New-Object System.Windows.Forms.Label
$lblLine.Text = "---------------------------------------------------"
$lblLine.Font = New-Object Drawing.Font("Consolas", 8)
$lblLine.ForeColor = $accent
$lblLine.BackColor = [Drawing.Color]::Transparent
$lblLine.TextAlign = 'MiddleCenter'
$lblLine.Size = New-Object Drawing.Size(540, 16)
$lblLine.Location = New-Object Drawing.Point(0, 133)
$form.Controls.Add($lblLine)

$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text = "Initializing..."
$lblStatus.Font = New-Object Drawing.Font("Segoe UI", 10)
$lblStatus.ForeColor = $text
$lblStatus.BackColor = [Drawing.Color]::Transparent
$lblStatus.TextAlign = 'MiddleCenter'
$lblStatus.Size = New-Object Drawing.Size(500, 24)
$lblStatus.Location = New-Object Drawing.Point(20, 175)
$form.Controls.Add($lblStatus)

$bar = New-Object System.Windows.Forms.ProgressBar
$bar.Size = New-Object Drawing.Size(440, 18)
$bar.Location = New-Object Drawing.Point(50, 210)
$bar.Style = 'Continuous'
$bar.Minimum = 0
$bar.Maximum = 100
$bar.Value = 0
$bar.ForeColor = $accent
$bar.BackColor = [Drawing.Color]::FromArgb(44, 52, 57)
$form.Controls.Add($bar)

$lblPct = New-Object System.Windows.Forms.Label
$lblPct.Text = "0%"
$lblPct.Font = New-Object Drawing.Font("Segoe UI", 9)
$lblPct.ForeColor = $dim
$lblPct.BackColor = [Drawing.Color]::Transparent
$lblPct.TextAlign = 'MiddleCenter'
$lblPct.Size = New-Object Drawing.Size(540, 18)
$lblPct.Location = New-Object Drawing.Point(0, 238)
$form.Controls.Add($lblPct)

$lblDetail = New-Object System.Windows.Forms.Label
$lblDetail.Text = ""
$lblDetail.Font = New-Object Drawing.Font("Consolas", 8)
$lblDetail.ForeColor = [Drawing.Color]::FromArgb(100, 110, 120)
$lblDetail.BackColor = [Drawing.Color]::Transparent
$lblDetail.TextAlign = 'MiddleCenter'
$lblDetail.Size = New-Object Drawing.Size(500, 16)
$lblDetail.Location = New-Object Drawing.Point(20, 262)
$form.Controls.Add($lblDetail)

$btn = New-Object System.Windows.Forms.Button
$btn.Text = "  LAUNCH  "
$btn.Font = New-Object Drawing.Font("Segoe UI", 11, [Drawing.FontStyle]::Bold)
$btn.ForeColor = [Drawing.Color]::White
$btn.BackColor = $green
$btn.FlatStyle = 'Flat'
$btn.FlatAppearance.BorderSize = 0
$btn.Size = New-Object Drawing.Size(160, 40)
$btn.Location = New-Object Drawing.Point(190, 300)
$btn.Visible = $false
$btn.Add_Click({ $form.Close() })
$form.Controls.Add($btn)

$lblVer = New-Object System.Windows.Forms.Label
$lblVer.Text = "v1.0.0 - All State Solar Inc."
$lblVer.Font = New-Object Drawing.Font("Segoe UI", 8)
$lblVer.ForeColor = [Drawing.Color]::FromArgb(80, 88, 95)
$lblVer.BackColor = [Drawing.Color]::Transparent
$lblVer.TextAlign = 'MiddleCenter'
$lblVer.Size = New-Object Drawing.Size(540, 16)
$lblVer.Location = New-Object Drawing.Point(0, 350)
$form.Controls.Add($lblVer)

$rs = [RunspaceFactory]::CreateRunspace()
$rs.ApartmentState = "STA"
$rs.ThreadOptions = "ReuseThread"
$rs.Open()
$rs.SessionStateProxy.SetVariable("sync", $sync)
$rs.SessionStateProxy.SetVariable("rootDir", $rootDir)
$rs.SessionStateProxy.SetVariable("bootstrapScript", $bootstrapScript)

$ps = [PowerShell]::Create()
$ps.Runspace = $rs
[void]$ps.AddScript({
  try {
    function Set-Prog {
      param([int]$pct, [string]$status, [string]$detail)
      $sync.Progress = $pct; $sync.Status = $status; $sync.Detail = $detail
    }
    function Start-Svc {
      param([string]$Name, [string]$Cmd, [string[]]$ArgList, [string]$WorkDir = $rootDir)
      $joined = $ArgList -join ' '
      if ($Cmd -eq 'npm') {
        $npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
        $npmExe = if ($npmCmd) { $npmCmd.Source } else { 'npm.cmd' }
        $p = Start-Process -PassThru -NoNewWindow -FilePath $npmExe -ArgumentList $ArgList -WorkingDirectory $WorkDir
      } else {
        $p = Start-Process -PassThru -NoNewWindow -FilePath 'cmd.exe' -ArgumentList "/c $Cmd $joined" -WorkingDirectory $WorkDir
      }
      $sync.Procs[$Name] = $p
      return $p
    }

    . $bootstrapScript -OnProgress ${function:Set-Prog}

    Set-Prog 68 'Starting API server...' 'http://localhost:3001 (serves Admin + API)'
    $env:DEV_MODE = 'true'
    $env:NODE_ENV = 'development'
    Start-Svc 'server' 'npm' @('run', 'start', '-w', 'packages/server')

    if (-not (Wait-Url 'http://localhost:3001/api/health' 45)) {
      $sync.Error = 'Server failed to start on port 3001'
      return
    }

    Set-Prog 78 'Starting field apps (dev)...' 'installer, field, monitor'
    Start-Svc 'installer' 'npm' @('run', 'dev:installer')
    Start-Svc 'field' 'npm' @('run', 'dev:field')
    Start-Svc 'monitor' 'npm' @('run', 'dev:monitor')

    Wait-Url 'http://localhost:5174' 30 | Out-Null
    Wait-Url 'http://localhost:5175' 30 | Out-Null

    Set-Prog 92 'Opening browser...' 'Server Admin at :3001'
    Start-Process 'http://localhost:3001/server/dashboard'

    Set-Prog 100 'Ready!' 'Server Admin: http://localhost:3001/server/dashboard'
    $sync.Ready = $true
  } catch {
    $sync.Error = $_.Exception.Message
  }
})
$handle = $ps.BeginInvoke()

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 150
$timer.Add_Tick({
  $bar.Value = [Math]::Min(100, $sync.Progress)
  $lblPct.Text = "$($sync.Progress)%"
  $lblStatus.Text = $sync.Status
  $lblDetail.Text = $sync.Detail

  if ($sync.Error) {
    $timer.Stop()
    $lblStatus.ForeColor = $red
    $lblStatus.Text = "Error: $($sync.Error)"
    $btn.Text = "  EXIT  "
    $btn.BackColor = $red
    $btn.Visible = $true
    $form.TopMost = $false
  } elseif ($sync.Ready) {
    $timer.Stop()
    $bar.Value = 100
    $lblPct.Text = "100%"
    $lblStatus.ForeColor = $green
    $lblStatus.Text = "Ready - Server Admin at :3001"
    $lblDetail.Text = "Click LAUNCH to close this window (services keep running)"
    $btn.Text = "  LAUNCH  "
    $btn.BackColor = $green
    $btn.Visible = $true
    $form.TopMost = $false
  }
})
$timer.Start()

$form.Add_FormClosed({
  $timer.Stop()
  $ps.Dispose()
  $rs.Dispose()
})

[void]$form.ShowDialog()

