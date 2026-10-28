$ErrorActionPreference = 'Stop'
$appRoot = $PSScriptRoot
$destination = Join-Path $appRoot 'docs\downloads'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$allowed = @('Iniciar.cmd','Iniciar.ps1','LEEME.md','package.json','server.js','lib.js','transcribir.py','public','test')
$files = $allowed | ForEach-Object { Join-Path $appRoot $_ }
Compress-Archive -LiteralPath $files -DestinationPath (Join-Path $destination 'VideotecaLocal.zip') -Force
Write-Host 'Paquete actualizado en docs/downloads/VideotecaLocal.zip. No incluye datos personales.'
