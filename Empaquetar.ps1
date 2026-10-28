$ErrorActionPreference = 'Stop'
$appRoot = $PSScriptRoot
$destination = Join-Path $appRoot 'docs\downloads'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$allowed = @('Iniciar.cmd','Iniciar.ps1','Configurar-herramientas.cmd','Configurar-herramientas.ps1','Ollama-local.ps1','requirements-audio.txt','LEEME.md','package.json','server.js','folder-picker.js','Elegir-carpeta.ps1','lib.js','transcribir.py','transcription_progress.py','stream-progress.js','vision-response.js','public','test')
$files = $allowed | ForEach-Object { Join-Path $appRoot $_ }
Compress-Archive -LiteralPath $files -DestinationPath (Join-Path $destination 'VideotecaLocal.zip') -Force
Write-Host 'Paquete actualizado en docs/downloads/VideotecaLocal.zip. No incluye datos personales.'
