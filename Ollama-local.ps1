# Compartido por el iniciador y la configuracion. No modifica variables globales.
function Start-VideotecaOllama {
    param([string]$AppRoot)
    $env:OLLAMA_HOST = '127.0.0.1:11434'
    $env:OLLAMA_NO_CLOUD = '1'
    $env:OLLAMA_CONTEXT_LENGTH = '2048'
    $env:OLLAMA_NUM_PARALLEL = '1'
    $env:OLLAMA_MAX_LOADED_MODELS = '1'
    try {
        Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 | Out-Null
        return $true
    } catch { }
    $localExe = Join-Path $AppRoot 'herramientas\ollama\ollama.exe'
    if (-not (Test-Path -LiteralPath $localExe)) { return $false }
    $modelDir = Join-Path $AppRoot 'datos\modelos\ollama'
    New-Item -ItemType Directory -Force -Path $modelDir | Out-Null
    $env:OLLAMA_MODELS = $modelDir
    $logDir = Join-Path $AppRoot 'datos'
    Start-Process -FilePath $localExe -ArgumentList 'serve' -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'ollama-out.log') -RedirectStandardError (Join-Path $logDir 'ollama-error.log') | Out-Null
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Seconds 1
        try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 | Out-Null; return $true } catch { }
    }
    throw 'Ollama no inicio. Revisa datos/ollama-error.log.'
}
