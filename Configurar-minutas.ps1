$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
. (Join-Path $PSScriptRoot 'Ollama-local.ps1')
try {
    Write-Host 'Se prepararan Qwen3 4B para minutas y Whisper medium para transcripcion precisa.'
    Write-Host 'Necesita internet y varios GB adicionales. No procesa tus videos.'
    if (-not (Start-VideotecaOllama $PSScriptRoot)) { throw 'Configura primero las herramientas de Videoteca.' }
    $ollama = Join-Path $PSScriptRoot 'herramientas\ollama\ollama.exe'
    $tags = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 5
    if ('qwen3:4b' -notin @($tags.models.name)) {
        & $ollama pull qwen3:4b
        if ($LASTEXITCODE -ne 0) {
            $check = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 5
            if ('qwen3:4b' -notin @($check.models.name)) { throw 'No se pudo descargar Qwen3 4B.' }
            Write-Warning 'Ollama reporto un problema de limpieza, pero el modelo aparece instalado. Se comprobara al generar la minuta.'
        }
    }
    & (Join-Path $PSScriptRoot '.venv\Scripts\python.exe') (Join-Path $PSScriptRoot 'preparar-modelo.py') medium (Join-Path $PSScriptRoot 'datos\modelos')
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar Whisper medium.' }
    Write-Host 'Modelos preparados. Reinicia Videoteca cuando no haya trabajos en curso.'
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
