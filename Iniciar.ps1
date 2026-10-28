param([switch]$SoloComprobar)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$runtimeCommand = Get-Command node -ErrorAction SilentlyContinue
$runtimePath = if ($runtimeCommand) { $runtimeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $runtimePath)) {
    Write-Host 'No se encontro Node.js. Instala Node.js 24 LTS desde https://nodejs.org y volve a abrir Iniciar.cmd.'
    exit 1
}
$runtimeVersion = & $runtimePath --version
if ($LASTEXITCODE -ne 0 -or $runtimeVersion -notmatch '^v(\d+)\.') {
    Write-Host 'No se pudo comprobar la version de Node.js.'
    exit 1
}
if ([int]$Matches[1] -lt 24) { Write-Host 'Se necesita Node.js 24 o posterior.'; exit 1 }
if ($SoloComprobar) { Write-Host "Node.js compatible: $runtimeVersion"; exit 0 }
$ffmpegLocal = Join-Path $PSScriptRoot 'herramientas\ffmpeg.exe'
$ffprobeLocal = Join-Path $PSScriptRoot 'herramientas\ffprobe.exe'
if (Test-Path -LiteralPath $ffmpegLocal) { $env:VIDEOTECA_FFMPEG = $ffmpegLocal }
if (Test-Path -LiteralPath $ffprobeLocal) { $env:VIDEOTECA_FFPROBE = $ffprobeLocal }
$pythonLocal = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (Test-Path -LiteralPath $pythonLocal) { $env:VIDEOTECA_PYTHON = $pythonLocal }
. (Join-Path $PSScriptRoot 'Ollama-local.ps1')
try { Start-VideotecaOllama $PSScriptRoot | Out-Null } catch { Write-Warning $_.Exception.Message }
& $runtimePath --disable-warning=ExperimentalWarning (Join-Path $PSScriptRoot 'server.js') --open
exit $LASTEXITCODE
