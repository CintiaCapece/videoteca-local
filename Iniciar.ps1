$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$runtimeCommand = Get-Command node -ErrorAction SilentlyContinue
$runtimePath = if ($runtimeCommand) { $runtimeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $runtimePath)) {
    Write-Host 'No se encontro Node.js. Instala Node.js 24 LTS desde https://nodejs.org y volve a abrir Iniciar.cmd.'
    exit 1
}
$runtimeVersion = & $runtimePath -p 'process.versions.node.split(".")[0]'
if ([int]$runtimeVersion -lt 24) { Write-Host 'Se necesita Node.js 24 o posterior.'; exit 1 }
$ffmpegLocal = Join-Path $PSScriptRoot 'herramientas\ffmpeg.exe'
$ffprobeLocal = Join-Path $PSScriptRoot 'herramientas\ffprobe.exe'
if (Test-Path -LiteralPath $ffmpegLocal) { $env:VIDEOTECA_FFMPEG = $ffmpegLocal }
if (Test-Path -LiteralPath $ffprobeLocal) { $env:VIDEOTECA_FFPROBE = $ffprobeLocal }
$pythonLocal = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (Test-Path -LiteralPath $pythonLocal) { $env:VIDEOTECA_PYTHON = $pythonLocal }
& $runtimePath --disable-warning=ExperimentalWarning (Join-Path $PSScriptRoot 'server.js') --open
exit $LASTEXITCODE
